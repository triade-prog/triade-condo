-- Documentos e memória com banco (fase D, área D; MP-12, MP-05, CT-02, CT-03). Desenho nos quadros
-- 262 a 267 do canvas, aprovado pela Carolina em 24/10/2026 com as decisões D.1, D.2 e D.3.
-- 1. Histórico do prontuário (D.1): as mudanças dos itens, que o histórico já guardava, e o que
--    venceu, numa lista para ler; com o item escolhido, só as dele.
-- 2. O arquivo do contrato do prestador (D.2): é um documento do tipo Contrato em Documentos,
--    ligado ao prestador. A data de fim do prestador e o Vale até do documento andam juntos.
-- 3. Linha do tempo com busca e período (D.3). A versão da 0180 passa a ser linha_do_tempo_r1.
-- O "assume como síndico" sem o gênero já saiu na 0286 ("assume a sindicatura").

-- ---------------------------------------------------------------------------------------
-- 1. Histórico do prontuário, do mais novo ao mais antigo, 50 por vez.

create function plataforma_historico_prontuario(p_pessoa uuid, p_condominio uuid, p_item uuid default null, p_antes timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restritos boolean;
  v jsonb;
  v_corte timestamptz;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  if p_item is not null and not exists (select 1 from itens_prontuario where id = p_item) then
    raise exception 'Item não encontrado' using errcode = 'TC404';
  end if;
  v_restritos := pode(p_pessoa, p_condominio, 'documentos.restritos');
  with ev as materialized (
         select h.ocorrido_em as quando, h.id as seq, h.id::text as id, h.entidade_id::uuid as item_id,
                substr(h.acao, length('prontuario.') + 1) as acao, nome_pessoa(h.autor_id) as autor,
                h.dados ->> 'item' as item, h.dados ->> 'grupo' as grupo, (h.dados ->> 'avisarDias')::integer as avisar_dias,
                h.dados ->> 'motivo' as motivo,
                case when h.dados ? 'documento' then
                  (select case when d.restrito and not v_restritos then 'documento restrito' else h.dados ->> 'documentoTitulo' end
                     from documentos d where d.id = (h.dados ->> 'documento')::uuid) end as documento
           from historico h
          where h.entidade = 'itens_prontuario' and h.acao like 'prontuario.%'
            and (p_item is null or h.entidade_id = p_item::text)
         union all
         -- O que venceu não passa por ninguém: entra pela data de validade do documento ligado.
         select (x.vale_ate::timestamp at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo')),
                0::bigint, 'venceu-' || x.id, x.id, 'venceu', null, x.nome, null, null, null,
                (select case when d.restrito and not v_restritos then 'documento restrito' else d.titulo end from documentos d where d.id = x.documento_id)
           from prontuario_lista() x
          where x.situacao = 'VENCEU' and x.id is not null and (p_item is null or x.id = p_item)),
       antes as (select * from ev where p_antes is null or quando < p_antes),
       -- Corta no quando do 50º e leva todos os empatados nele, para Ver mais antigos não pular nenhum.
       pagina as (select * from antes
                   where quando >= coalesce((select quando from antes order by quando desc, seq desc offset 49 limit 1), '-infinity'))
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', id, 'quando', quando, 'data', to_char(data_no_condominio(quando), 'YYYY-MM-DD'), 'acao', upper(acao), 'itemId', item_id,
           'item', item, 'grupo', grupo, 'autor', autor, 'documento', documento, 'avisarDias', avisar_dias, 'motivo', motivo))
           order by quando desc, seq desc), '[]'::jsonb),
         case when (select count(*) from pagina) >= 50
                   and exists (select 1 from ev where quando < (select min(quando) from pagina)) then (select min(quando) from pagina) end
    into v, v_corte
    from pagina;
  return jsonb_strip_nulls(jsonb_build_object(
    'eventos', v,
    'maisAntigosAntes', v_corte,
    'item', (select jsonb_build_object('id', i.id, 'nome', i.nome) from itens_prontuario i where i.id = p_item),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.ordem)
                         from prontuario_lista() x where x.id is not null), '[]'::jsonb)));
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. O contrato do prestador em Documentos.

alter table prestadores add column contrato_documento_id uuid;
alter table prestadores add constraint prestadores_contrato_documento
  foreign key (contrato_documento_id, condominio_id) references documentos (id, condominio_id);

-- Quem deixa de ter contrato deixa de ter o arquivo ligado; o documento continua em Documentos.
create function prestador_sem_contrato() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.acordo <> 'CONTRATO' then new.contrato_documento_id := null; end if;
  return new;
end $$;
create trigger prestadores_sem_contrato before update on prestadores for each row execute function prestador_sem_contrato();

-- A data de fim é uma só: mudar no prestador muda no documento, e o contrário; apagar também.
create function contrato_prestador_para_documento() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contrato_documento_id is not null then
    update documentos set vale_ate = new.contrato_ate
     where id = new.contrato_documento_id and vale_ate is distinct from new.contrato_ate;
  end if;
  return null;
end $$;
create trigger prestadores_contrato_ate after update of contrato_ate on prestadores
  for each row when (new.contrato_ate is distinct from old.contrato_ate) execute function contrato_prestador_para_documento();

create function contrato_documento_para_prestador() returns trigger
language plpgsql
set search_path = public
as $$
begin
  update prestadores set contrato_ate = new.vale_ate
   where contrato_documento_id = new.id and acordo = 'CONTRATO' and contrato_ate is distinct from new.vale_ate;
  return null;
end $$;
create trigger documentos_vale_ate after update of vale_ate on documentos
  for each row when (new.vale_ate is distinct from old.vale_ate) execute function contrato_documento_para_prestador();

-- O arquivo do contrato, para quem vê o documento; para os outros, só que existe.
create function contrato_prestador_json(x prestadores, p_pessoa uuid) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  d documentos;
  v versoes_documento;
  v_cond uuid := contexto_condominio();
begin
  if x.contrato_documento_id is null or x.acordo <> 'CONTRATO' then return null; end if;
  select * into d from documentos where id = x.contrato_documento_id and arquivado_em is null;
  if not found then return null; end if;
  if not pode(p_pessoa, v_cond, 'documentos.ver') or (d.restrito and not pode(p_pessoa, v_cond, 'documentos.restritos')) then
    return jsonb_build_object('oculto', true);
  end if;
  v := versao_em_vigor(d.id);
  return jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'titulo', d.titulo, 'restrito', case when d.restrito then true end, 'versao', d.versao,
    'arquivo', v.nome, 'versaoId', v.id, 'numero', v.numero,
    'enviando', exists (select 1 from versoes_documento e where e.documento_id = d.id and e.situacao = 'ENVIANDO')));
end $$;

create or replace function plataforma_prestadores(p_pessoa uuid, p_condominio uuid, p_arquivados boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(prestador_json(x) || jsonb_strip_nulls(jsonb_build_object('contratoDocumento', contrato_prestador_json(x, p_pessoa)))
                       order by x.acordo = 'CHAMADO', lower(x.nome))
        from prestadores x where (x.arquivado_em is not null) = coalesce(p_arquivados, false)), '[]'::jsonb),
    'arquivados', (select count(*) from prestadores where arquivado_em is not null),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar')));
end $$;

create or replace function plataforma_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare x prestadores;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  select * into x from prestadores where id = p_id;
  if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'prestador', prestador_json(x) || jsonb_strip_nulls(jsonb_build_object('contratoDocumento', contrato_prestador_json(x, p_pessoa))),
    'manutencoes', coalesce((
      select jsonb_agg(manutencao_json(m, p_pessoa) order by m.estado in ('CONCLUIDA', 'CANCELADA'), coalesce(m.concluida_em, m.criado_em) desc)
        from manutencoes m
       where m.prestador_id = x.id
          or exists (select 1 from providencias_manutencao pv where pv.manutencao_id = m.id and pv.prestador_id = x.id)), '[]'::jsonb),
    'reservaDe', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome) order by lower(r.nome))
                             from prestadores r where r.reserva_id = x.id and r.arquivado_em is null), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar'),
                               'contrato', pode(p_pessoa, p_condominio, 'manutencao.editar') and pode(p_pessoa, p_condominio, 'documentos.editar')));
end $$;

-- Ligar o documento do contrato ao prestador e, se vier, mudar a data de fim (que vale para os dois).
create function plataforma_ligar_contrato_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_documento uuid,
                                                    p_vale_ate date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x prestadores;
  d documentos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  if not pode(p_pessoa, p_condominio, 'documentos.editar') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
  select * into x from prestadores where id = p_id;
  if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  if x.arquivado_em is not null then perform recusar_motivo('O prestador está arquivado', 'PRESTADOR_ARQUIVADO'); end if;
  if x.acordo <> 'CONTRATO' then perform recusar_motivo('Só prestador com contrato tem o arquivo do contrato', 'SEM_CONTRATO'); end if;
  -- Quem não vê o contrato restrito que já está ligado não o troca.
  if exists (select 1 from documentos o where o.id = x.contrato_documento_id and o.restrito and o.arquivado_em is null)
     and not pode(p_pessoa, p_condominio, 'documentos.restritos') then
    perform recusar_motivo('O contrato ligado é restrito', 'CONTRATO_RESTRITO');
  end if;
  select * into d from documentos where id = p_documento;
  if not found or d.arquivado_em is not null or d.tipo <> 'CONTRATO'
     or (d.restrito and not pode(p_pessoa, p_condominio, 'documentos.restritos')) then
    perform recusar_campos('Escolha um contrato guardado em Documentos', 'documentoId');
  end if;
  if exists (select 1 from prestadores o where o.contrato_documento_id = d.id and o.id <> x.id and o.arquivado_em is null) then
    perform recusar_motivo('Este contrato já está com outro prestador', 'CONTRATO_DE_OUTRO');
  end if;
  if p_vale_ate is not null and p_vale_ate not between date '2000-01-01' and date '2100-12-31' then
    perform recusar_campos('Data fora do esperado', 'valeAte');
  end if;
  update prestadores set contrato_documento_id = d.id, contrato_ate = coalesce(p_vale_ate, d.vale_ate, contrato_ate)
   where id = x.id and versao = p_versao returning * into x;
  if not found then perform conflito_versao('prestadores', p_id); end if;
  -- O documento ganha a data do prestador, se ainda não tinha (o gatilho só anda quando a data muda).
  if x.contrato_ate is not null then
    update documentos set vale_ate = x.contrato_ate where id = d.id and vale_ate is distinct from x.contrato_ate;
  end if;
  perform registrar_historico('prestador.contrato_ligado', 'prestadores', x.id::text,
    jsonb_strip_nulls(jsonb_build_object('documento', d.id, 'documentoTitulo', d.titulo, 'ate', x.contrato_ate)));
  return jsonb_build_object('prestador', prestador_json(x) || jsonb_strip_nulls(jsonb_build_object('contratoDocumento', contrato_prestador_json(x, p_pessoa))));
end $$;

-- Enviar o contrato: guarda o documento do tipo Contrato e liga ao prestador numa transação só, para
-- não sobrar documento solto. Se já existe um contrato com o mesmo título, sem prestador (o acordo
-- foi e voltou), ele é reaproveitado e o arquivo vira a versão seguinte dele.
create function plataforma_guardar_contrato_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                                      p_descricao text, p_restrito boolean, p_vale_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x prestadores;
  v_doc uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  if not pode(p_pessoa, p_condominio, 'documentos.editar') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
  select * into x from prestadores where id = p_id;
  if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  if x.versao <> p_versao then perform conflito_versao('prestadores', p_id); end if;
  select d.id into v_doc from documentos d
   where d.tipo = 'CONTRATO' and d.arquivado_em is null and lower(d.titulo) = lower(btrim(p_titulo))
     and (not d.restrito or pode(p_pessoa, p_condominio, 'documentos.restritos'))
     and not exists (select 1 from prestadores o where o.contrato_documento_id = d.id and o.id <> x.id and o.arquivado_em is null);
  if v_doc is null then
    v_doc := (plataforma_salvar_documento(p_pessoa, p_condominio, null, null, 'CONTRATO', p_titulo, p_descricao, coalesce(p_restrito, false),
                                          false, p_vale_ate) ->> 'id')::uuid;
  end if;
  return jsonb_build_object('id', v_doc)
      || plataforma_ligar_contrato_prestador(p_pessoa, p_condominio, p_id, p_versao, v_doc, p_vale_ate);
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. A linha do tempo com a busca e o período.

alter function plataforma_linha_do_tempo(uuid, uuid, text, date) rename to linha_do_tempo_r1;
alter function linha_do_tempo_r1(uuid, uuid, text, date) security invoker;

create function plataforma_linha_do_tempo(p_pessoa uuid, p_condominio uuid, p_filtro text, p_antes date,
                                          p_busca text default null, p_de date default null, p_ate date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filtro text := coalesce(p_filtro, 'TUDO');
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_corte date;
  v_eventos jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  if v_filtro not in ('TUDO', 'ANOTADO', 'MANUTENCAO', 'DOCUMENTOS', 'COMUNICADOS', 'PESSOAS') then
    perform recusar_campos('Filtro desconhecido', 'filtro');
  end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  if p_de > p_ate then perform recusar_campos('O fim do período vem depois do começo', 'ate'); end if;
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with e as materialized (
         select * from eventos_memoria(p_pessoa) x
          where (v_filtro = 'TUDO' or x.categoria = v_filtro) and (p_antes is null or x.data < p_antes) and x.data is not null
            and (p_de is null or x.data >= p_de) and (p_ate is null or x.data <= p_ate)
            and (v_busca is null or lower(coalesce(x.evento ->> 'titulo', '')) like '%' || v_busca || '%'
                                 or lower(coalesce(x.evento ->> 'detalhe', '')) like '%' || v_busca || '%'
                                 or lower(coalesce(x.evento ->> 'texto', '')) like '%' || v_busca || '%')),
       corte as (select min(t.data) as data from (select data from e order by data desc limit 60) t)
  select (select jsonb_agg(e.evento || jsonb_build_object('data', to_char(e.data, 'YYYY-MM-DD'), 'categoria', e.categoria)
                           order by e.data desc, e.momento desc nulls last)
            from e, corte where e.data >= corte.data),
         case when exists (select 1 from e, corte where e.data < corte.data) then (select data from corte) end
    into v_eventos, v_corte;
  return jsonb_strip_nulls(jsonb_build_object(
    'eventos', coalesce(v_eventos, '[]'::jsonb),
    'maisAntigosAntes', to_char(v_corte, 'YYYY-MM-DD'),
    'podeAnotar', pode(p_pessoa, p_condominio, 'documentos.editar')));
end $$;

call fechar_acesso();

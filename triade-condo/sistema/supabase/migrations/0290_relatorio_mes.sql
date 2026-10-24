-- 0290 · Relatório do mês para a assembleia (TR-02, TR-05, TR-08, TR-10). Telas aprovadas pela
-- Carolina em 23/10/2026 (canvas do novo frontend, quadros 230 a 236), com as decisões A.1, B.1,
-- C.1 e D.1.
--
-- Regras desta parte:
-- 1. Só mês fechado (TR-11): o mês em andamento não tem relatório. Vale até 24 meses para trás.
-- 2. Partes: resumo, atendimento do mês com o mês anterior ao lado (TR-02), por categoria e por
--    bloco ou torre com o tempo médio de fechamento (TR-05), decisões do síndico, reincidência e
--    a palavra do síndico. O resumo e a palavra são texto de quem gera.
-- 3. Números congelados (B.1): o relatório gerado guarda os números daquele momento e não muda
--    mais. "Gerar de novo" cria o número seguinte do mesmo mês; o anterior continua aberto.
-- 4. Quem gera (C.1, TR-08): quem vê os pedidos (Acompanhar ou outra permissão de pedidos). Cada
--    parte e cada anexo seguem a permissão de quem gera: decisões só com Aprovar; documento só
--    se a pessoa vê o documento (o restrito, só quem cuida dos documentos). O que ficou de fora
--    por permissão fica escrito no relatório. Quem abre um relatório gerado vê o que foi gerado.
--    Pedido privado entra na conta, sem aparecer: nenhuma parte lista pedido.
-- 5. Anexos (TR-10, D.1): até 10, fotos (JPG, PNG) e PDF, enviados na hora (bucket privado
--    "relatorios", até 10 MB) ou a versão em vigor de um documento. O navegador monta um PDF só,
--    com a folha e os anexos, pelos links de 5 minutos que a API gera.
-- 6. Modelo (TR-10): as partes escolhidas podem ficar como o modelo do condomínio, que vem
--    marcado no mês seguinte. Mudar o modelo não muda relatório gerado.
-- 7. Histórico: gerar, guardar o modelo e baixar o PDF ou as tabelas.

-- ---------------------------------------------------------------------------------------
-- Arquivos enviados para os relatórios. Ficam com quem enviou até entrarem num relatório.

create table arquivos_relatorio (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  nome               text not null check (length(btrim(nome)) between 1 and 200),
  tipo               text not null check (tipo in ('image/jpeg', 'image/png', 'application/pdf')),
  tamanho_declarado  integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho            integer check (tamanho between 1 and 10485760),
  caminho            text not null unique,
  situacao           text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa      text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em         timestamptz not null default app_now(),
  enviado_por        uuid not null references pessoas (id),
  verificado_em      timestamptz,
  unique (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null))
);
create index arquivos_relatorio_pessoa on arquivos_relatorio (enviado_por, enviado_em);
call proteger_tabela_condominio('arquivos_relatorio');
create trigger arquivos_relatorio_sem_exclusao before delete on arquivos_relatorio for each row execute function somente_insercao();

-- O arquivo não muda: só recebe a verificação, uma vez.
create function arquivos_relatorio_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.nome, new.tipo, new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from (old.id, old.condominio_id, old.nome, old.tipo, old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'O arquivo não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' then raise exception 'O arquivo já foi verificado' using errcode = 'TC422'; end if;
  return new;
end $$;
create trigger arquivos_relatorio_regras before update on arquivos_relatorio for each row execute function arquivos_relatorio_regras();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('relatorios', 'relatorios', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- O relatório gerado: o retrato fica como foi gerado (B.1).

create table relatorios_mes (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  mes            date not null check (extract(day from mes) = 1),
  numero         smallint not null check (numero between 1 and 99),
  partes         text[] not null check (cardinality(partes) between 1 and 7),
  resumo         text check (length(btrim(resumo)) between 3 and 2000),
  palavra        text check (length(btrim(palavra)) between 3 and 3000),
  conteudo       jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  gerado_em      timestamptz not null default app_now(),
  gerado_por     uuid not null references pessoas (id),
  unique (id, condominio_id),
  unique (condominio_id, mes, numero),
  check (partes <@ array['RESUMO', 'ATENDIMENTO', 'CATEGORIA', 'TORRE', 'DECISOES', 'REINCIDENCIA', 'PALAVRA']),
  check (('RESUMO' = any (partes)) = (resumo is not null)),
  check (('PALAVRA' = any (partes)) = (palavra is not null))
);
create index relatorios_mes_data on relatorios_mes (condominio_id, mes desc, numero desc);
call proteger_tabela_condominio('relatorios_mes');
create trigger relatorios_mes_sem_exclusao before delete on relatorios_mes for each row execute function somente_insercao();
create trigger relatorios_mes_sem_mudanca before update on relatorios_mes for each row execute function somente_insercao();

-- Os anexos, na ordem em que saem no PDF. Ou um arquivo enviado, ou a versão de um documento.
create table anexos_relatorio (
  id                   uuid primary key default gen_random_uuid(),
  condominio_id        uuid not null references condominios (id) on delete restrict,
  relatorio_id         uuid not null,
  ordem                smallint not null check (ordem between 1 and 10),
  titulo               text not null check (length(btrim(titulo)) between 1 and 200),
  tipo                 text not null check (tipo in ('image/jpeg', 'image/png', 'application/pdf')),
  arquivo_id           uuid,
  documento_id         uuid,
  versao_documento_id  uuid references versoes_documento (id),
  unique (relatorio_id, ordem),
  foreign key (relatorio_id, condominio_id) references relatorios_mes (id, condominio_id),
  foreign key (arquivo_id, condominio_id) references arquivos_relatorio (id, condominio_id),
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  check ((arquivo_id is null) <> (versao_documento_id is null)),
  check ((documento_id is null) = (versao_documento_id is null))
);
create index anexos_relatorio_relatorio on anexos_relatorio (relatorio_id, ordem);
call proteger_tabela_condominio('anexos_relatorio');
create trigger anexos_relatorio_sem_exclusao before delete on anexos_relatorio for each row execute function somente_insercao();
create trigger anexos_relatorio_sem_mudanca before update on anexos_relatorio for each row execute function somente_insercao();

-- O modelo do condomínio: as partes que vêm marcadas. Um por condomínio.
create table modelos_relatorio (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null unique references condominios (id) on delete restrict,
  partes         text[] not null check (cardinality(partes) between 1 and 7),
  guardado_em    timestamptz not null default app_now(),
  guardado_por   uuid not null references pessoas (id),
  check (partes <@ array['RESUMO', 'ATENDIMENTO', 'CATEGORIA', 'TORRE', 'DECISOES', 'REINCIDENCIA', 'PALAVRA'])
);
call proteger_tabela_condominio('modelos_relatorio');
create trigger modelos_relatorio_sem_exclusao before delete on modelos_relatorio for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Cálculos do mês, no condomínio do contexto.

-- A ordem das partes no relatório e o modelo de quem nunca guardou um.
create function partes_relatorio() returns text[]
language sql immutable
set search_path = public
as $$ select array['RESUMO', 'ATENDIMENTO', 'CATEGORIA', 'TORRE', 'DECISOES', 'REINCIDENCIA', 'PALAVRA'] $$;

create function modelo_relatorio_padrao() returns text[]
language sql immutable
set search_path = public
as $$ select array['RESUMO', 'ATENDIMENTO', 'CATEGORIA', 'TORRE', 'DECISOES', 'PALAVRA'] $$;

-- Os retornos do período com a marca de no prazo, pela mesma regra dos indicadores (0120).
create function retornos_do_periodo(p_ini timestamptz, p_fim timestamptz) returns table (pedido_id uuid, no_prazo boolean)
language sql stable
set search_path = public
as $$
  select h.entidade_id::uuid, h.ocorrido_em <= (h.dados ->> 'de')::timestamptz
    from historico h
   where h.condominio_id = contexto_condominio() and h.entidade = 'pedidos' and h.acao = 'pedido.retorno_registrado'
     and h.ocorrido_em >= p_ini and h.ocorrido_em < p_fim and jsonb_typeof(h.dados -> 'de') = 'string'
  union all
  select h.entidade_id::uuid, false
    from historico h
   where h.condominio_id = contexto_condominio() and h.entidade = 'pedidos' and h.acao = 'pedido.retorno_venceu'
     and h.ocorrido_em >= p_ini and h.ocorrido_em < p_fim
     and not exists (select 1 from historico r
                      where r.condominio_id = h.condominio_id and r.entidade = 'pedidos' and r.entidade_id = h.entidade_id
                        and r.acao = 'pedido.retorno_registrado' and r.dados ->> 'de' = h.dados ->> 'de')
$$;

-- Por categoria e por bloco ou torre (TR-05): registrados no mês, concluídos no mês, tempo médio
-- de fechamento (da abertura à conclusão, dos pedidos concluídos no mês e ainda concluídos) e
-- retornos no prazo. Sem pedido concluído, o tempo vem nulo ("sem dados"), nunca zero.
create function relatorio_por(p_agrupar text, p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
begin
  return coalesce((
    with base as (
      select p.id, p.criado_em, p.estado, p.encerrado_em,
             case when p_agrupar = 'CATEGORIA' then p.categoria_id::text
                  when p.unidade_id is null then 'AREAS_COMUNS'
                  else coalesce((select u.bloco_id::text from unidades u where u.id = p.unidade_id), 'SEM_BLOCO') end as chave
        from pedidos p
    ), grupos as (
      select c.id::text as chave, c.nome, lower(c.nome) as ordem, 0 as fim, c.ativa as fixo
        from categorias c where p_agrupar = 'CATEGORIA'
      union all
      select b.id::text, b.nome, lpad(b.ordem::text, 6, '0') || lower(b.nome), 0, b.ativo
        from blocos b where p_agrupar = 'TORRE'
      union all
      select 'SEM_BLOCO', 'Unidades sem bloco', '', 1, false where p_agrupar = 'TORRE'
      union all
      select 'AREAS_COMUNS', 'Áreas comuns e sem unidade', '', 2, false where p_agrupar = 'TORRE'
    ), numeros as (
      select g.chave, g.nome, g.ordem, g.fim, g.fixo,
             (select count(*) from base b where b.chave = g.chave and b.criado_em >= v_ini and b.criado_em < v_fim) as registrados,
             (select count(*) from historico h join base b on b.id = h.entidade_id::uuid
               where h.condominio_id = contexto_condominio() and h.entidade = 'pedidos' and h.acao = 'estado.mudou'
                 and h.dados ->> 'para' = 'ENCERRADO' and h.ocorrido_em >= v_ini and h.ocorrido_em < v_fim and b.chave = g.chave) as concluidos,
             (select round((avg(extract(epoch from b.encerrado_em - b.criado_em)) / 3600)::numeric, 1) from base b
               where b.chave = g.chave and b.estado = 'ENCERRADO' and b.encerrado_em >= v_ini and b.encerrado_em < v_fim) as tempo_medio,
             (select count(*) from retornos_do_periodo(v_ini, v_fim) r join base b on b.id = r.pedido_id where b.chave = g.chave) as retornos,
             (select count(*) from retornos_do_periodo(v_ini, v_fim) r join base b on b.id = r.pedido_id where b.chave = g.chave and r.no_prazo) as no_prazo
        from grupos g
    )
    select jsonb_agg(jsonb_build_object(
             'chave', n.chave, 'nome', n.nome, 'registrados', n.registrados, 'concluidos', n.concluidos,
             'tempoMedioHoras', n.tempo_medio, 'retornos', n.retornos, 'noPrazo', n.no_prazo,
             'porcentagem', case when n.retornos = 0 then null else round(100.0 * n.no_prazo / n.retornos) end)
           order by n.fim, n.ordem)
      from numeros n
     where n.fixo or n.registrados > 0 or n.concluidos > 0 or n.retornos > 0), '[]'::jsonb);
end $$;

-- Decisões do mês: pedidas e decididas no mês, o tempo típico e as que esperavam no último dia.
create function relatorio_decisoes(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
  v jsonb := decisoes_no_periodo(p_de, p_ate);
begin
  return jsonb_build_object(
    'pedidas', (select count(*) from decisoes_pedido where pedida_em >= v_ini and pedida_em < v_fim),
    'decididas', v -> 'decididas', 'aprovadas', v -> 'aprovadas', 'devolvidas', v -> 'devolvidas',
    'medianaHoras', v -> 'medianaHoras',
    'aguardandoNoFim', (select count(*) from decisoes_pedido where pedida_em < v_fim and (respondida_em is null or respondida_em >= v_fim)));
end $$;

-- As partes calculadas do mês, só as pedidas e só as que a pessoa pode ver (C.1, TR-08). O que
-- ficou de fora por permissão volta em "foraPorPermissao".
create function relatorio_calcular(p_pessoa uuid, p_mes date, p_partes text[]) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_ate date := (p_mes + interval '1 month' - interval '1 day')::date;
  v_antes date := (p_mes - interval '1 month')::date;
  v jsonb := jsonb_build_object('mes', to_char(p_mes, 'YYYY-MM'), 'de', to_char(p_mes, 'YYYY-MM-DD'), 'ate', to_char(v_ate, 'YYYY-MM-DD'),
                                'fuso', coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'foraPorPermissao', '[]'::jsonb);
begin
  if 'ATENDIMENTO' = any (p_partes) or 'RESUMO' = any (p_partes) then
    v := v || jsonb_build_object('atendimento', jsonb_build_object(
      'atual', indicadores_atendimento(p_mes, v_ate) - 'porCategoria' - 'de' - 'ate',
      'anterior', indicadores_atendimento(v_antes, (p_mes - 1)) - 'porCategoria' - 'de' - 'ate'));
  end if;
  if 'CATEGORIA' = any (p_partes) or 'RESUMO' = any (p_partes) then
    v := v || jsonb_build_object('categorias', relatorio_por('CATEGORIA', p_mes, v_ate));
  end if;
  if 'TORRE' = any (p_partes) or 'RESUMO' = any (p_partes) then
    v := v || jsonb_build_object('torres', relatorio_por('TORRE', p_mes, v_ate));
  end if;
  if 'DECISOES' = any (p_partes) then
    if pode(p_pessoa, contexto_condominio(), 'decisoes.aprovar') then
      v := v || jsonb_build_object('decisoes', relatorio_decisoes(p_mes, v_ate));
    else
      v := jsonb_set(v, '{foraPorPermissao}', (v -> 'foraPorPermissao') || '"DECISOES"'::jsonb);
    end if;
  end if;
  if 'REINCIDENCIA' = any (p_partes) then
    v := v || jsonb_build_object('reincidencia', (
      select r || jsonb_build_object('ondeVolta', coalesce((select jsonb_agg(x - 'ultima') from jsonb_array_elements(r -> 'ondeVolta') x), '[]'::jsonb))
        from reincidencia_no_periodo(p_mes, v_ate) r));
  end if;
  return v;
end $$;

-- O mês pedido, em "AAAA-MM": só mês fechado e até 24 meses para trás.
create function exigir_mes_fechado(p_mes text) returns date
language plpgsql stable
set search_path = public
as $$
declare
  v_atual date := date_trunc('month', hoje_no_condominio())::date;
  v date;
begin
  if p_mes is null or p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then perform recusar_campos('Diga o mês, como 2026-09', 'mes'); end if;
  v := to_date(p_mes || '-01', 'YYYY-MM-DD');
  if v >= v_atual then perform recusar_motivo('O mês ainda não fechou', 'MES_EM_ANDAMENTO'); end if;
  if v < (v_atual - interval '24 months')::date then perform recusar_motivo('Só os últimos 24 meses', 'MES_ANTIGO'); end if;
  return v;
end $$;

create function exigir_partes_relatorio(p_partes text[]) returns text[]
language plpgsql immutable
set search_path = public
as $$
begin
  if p_partes is null or cardinality(p_partes) = 0 or not (p_partes <@ partes_relatorio()) then
    perform recusar_campos('Escolha ao menos uma parte do relatório', 'partes');
  end if;
  -- Na ordem do relatório, sem repetir.
  return array(select x from unnest(partes_relatorio()) with ordinality t(x, n) where x = any (p_partes) order by n);
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API (security definer).

-- A tela Relatórios do mês: o mês fechado, os meses que dá para escolher, o modelo e os gerados.
create function plataforma_relatorios(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual date;
  v_fechado date;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v_atual := date_trunc('month', hoje_no_condominio())::date;
  v_fechado := (v_atual - interval '1 month')::date;
  return jsonb_build_object(
    'mesFechado', to_char(v_fechado, 'YYYY-MM'),
    'mesFechadoGerado', exists (select 1 from relatorios_mes where mes = v_fechado),
    'meses', (select jsonb_agg(to_char(m, 'YYYY-MM') order by m desc)
                from generate_series((v_atual - interval '24 months')::date, v_fechado, interval '1 month') m
               where m >= date_trunc('month', (select criado_em from condominios where id = p_condominio)
                                              at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))
                  or m = v_fechado),
    'modelo', coalesce((select jsonb_build_object('partes', to_jsonb(m.partes), 'guardadoEm', m.guardado_em,
                                                  'guardadoPor', (select nome from pessoas where id = m.guardado_por))
                          from modelos_relatorio m), jsonb_build_object('partes', to_jsonb(modelo_relatorio_padrao()))),
    'gerados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'mes', to_char(r.mes, 'YYYY-MM'), 'numero', r.numero, 'partes', to_jsonb(r.partes),
               'anexos', (select count(*) from anexos_relatorio a where a.relatorio_id = r.id),
               'geradoEm', r.gerado_em, 'autor', (select nome from pessoas where id = r.gerado_por),
               'ultimo', r.numero = (select max(numero) from relatorios_mes x where x.mes = r.mes))
             order by r.mes desc, r.numero desc)
        from (select * from relatorios_mes order by mes desc, numero desc limit 100) r), '[]'::jsonb),
    'pode', jsonb_build_object('decisoes', pode(p_pessoa, p_condominio, 'decisoes.aprovar'),
                               'documentos', pode(p_pessoa, p_condominio, 'documentos.ver')));
end $$;

-- A prévia para montar: os números do mês de todas as partes que a pessoa pode ver.
create function plataforma_previa_relatorio(p_pessoa uuid, p_condominio uuid, p_mes text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_mes date;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v_mes := exigir_mes_fechado(p_mes);
  return relatorio_calcular(p_pessoa, v_mes, partes_relatorio())
      || jsonb_build_object('condominio', (select nome from condominios where id = p_condominio),
                            'ultimoNumero', (select max(numero) from relatorios_mes where mes = v_mes));
end $$;

-- Começa o envio de um anexo: confere o que dá antes de o arquivo chegar.
create function plataforma_iniciar_anexo_relatorio(p_pessoa uuid, p_condominio uuid, p_nome text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_caminho text := p_condominio::text || '/' || p_pessoa::text || '/' || v_id::text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then
    perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome');
  end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'application/pdf') then
    perform recusar_motivo('Só fotos JPG ou PNG e PDF entram no relatório', 'TIPO_NAO_ACEITO_RELATORIO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  if (select count(*) from arquivos_relatorio where enviado_por = p_pessoa and enviado_em > app_now() - interval '1 day') >= 50 then
    perform recusar_motivo('Você já enviou 50 anexos hoje', 'LIMITE_ANEXOS_DIA');
  end if;
  insert into arquivos_relatorio (id, condominio_id, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function exigir_anexo_enviado(p_pessoa uuid, p_arquivo uuid) returns arquivos_relatorio
language plpgsql
set search_path = public
as $$
declare v arquivos_relatorio;
begin
  select * into v from arquivos_relatorio where id = p_arquivo and enviado_por = p_pessoa;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function plataforma_anexo_relatorio_a_verificar(p_pessoa uuid, p_condominio uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v arquivos_relatorio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_anexo_enviado(p_pessoa, p_arquivo);
  if v.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', v.caminho, 'tipo', v.tipo);
end $$;

create function plataforma_verificar_anexo_relatorio(p_pessoa uuid, p_condominio uuid, p_arquivo uuid, p_liberado boolean,
                                                     p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v arquivos_relatorio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_anexo_enviado(p_pessoa, p_arquivo);
  if v.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  update arquivos_relatorio
     set situacao = case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end,
         tamanho = case when p_liberado then p_tamanho end,
         motivo_recusa = case when p_liberado then null else coalesce(left(btrim(p_motivo), 300), 'Arquivo recusado') end,
         verificado_em = app_now()
   where id = p_arquivo;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

-- Gera o relatório do mês: calcula na hora, congela e guarda os anexos na ordem dada.
-- p_anexos: [{"arquivoId": "..."} | {"documentoId": "..."}], na ordem do PDF.
create function plataforma_gerar_relatorio(p_pessoa uuid, p_condominio uuid, p_mes text, p_partes text[], p_resumo text,
                                           p_palavra text, p_anexos jsonb, p_guardar_modelo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date;
  v_partes text[];
  v_resumo text := nullif(btrim(coalesce(p_resumo, '')), '');
  v_palavra text := nullif(btrim(coalesce(p_palavra, '')), '');
  v_conteudo jsonb;
  v_numero smallint;
  v_rel relatorios_mes;
  v_cargo text;
  a jsonb;
  n integer := 0;
  arq arquivos_relatorio;
  doc documentos;
  ver versoes_documento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v_mes := exigir_mes_fechado(p_mes);
  v_partes := exigir_partes_relatorio(p_partes);
  if 'RESUMO' = any (v_partes) and length(coalesce(v_resumo, '')) not between 3 and 2000 then
    perform recusar_campos('Resumo de 3 a 2.000 caracteres, ou desmarque a parte', 'resumo');
  end if;
  if 'PALAVRA' = any (v_partes) and length(coalesce(v_palavra, '')) not between 3 and 3000 then
    perform recusar_campos('Palavra do síndico de 3 a 3.000 caracteres, ou desmarque a parte', 'palavra');
  end if;
  if p_anexos is not null and jsonb_typeof(p_anexos) <> 'array' then perform recusar_campos('Anexos em lista', 'anexos'); end if;
  if jsonb_array_length(coalesce(p_anexos, '[]'::jsonb)) > 10 then perform recusar_motivo('Até 10 anexos', 'LIMITE_ANEXOS'); end if;
  if (select count(*) from relatorios_mes where gerado_em > app_now() - interval '1 day') >= 20 then
    perform recusar_motivo('Já foram gerados 20 relatórios hoje', 'LIMITE_RELATORIOS');
  end if;
  -- Trava os relatórios do condomínio para o número não repetir.
  perform pg_advisory_xact_lock(hashtext('relatorios_mes:' || p_condominio::text));
  v_numero := coalesce((select max(numero) from relatorios_mes where mes = v_mes), 0) + 1;
  if v_numero > 99 then perform recusar_motivo('O mês já tem 99 relatórios', 'LIMITE_RELATORIOS'); end if;

  select cargo into v_cargo from vinculos where pessoa_id = p_pessoa and condominio_id = p_condominio and revogado_em is null
   order by funcao = 'SINDICO' desc limit 1;
  v_conteudo := relatorio_calcular(p_pessoa, v_mes, v_partes)
             || jsonb_build_object('condominio', (select nome from condominios where id = p_condominio),
                                   'autor', jsonb_strip_nulls(jsonb_build_object('nome', (select nome from pessoas where id = p_pessoa),
                                                                                 'cargo', v_cargo, 'sindico', eh_sindico(p_pessoa))));
  -- A parte que ficou de fora por permissão não entra na lista de partes.
  v_partes := array(select x from unnest(v_partes) x where not (v_conteudo -> 'foraPorPermissao') ? x);
  if cardinality(v_partes) = 0 then perform recusar_campos('Escolha ao menos uma parte que você pode ver', 'partes'); end if;

  insert into relatorios_mes (condominio_id, mes, numero, partes, resumo, palavra, conteudo, gerado_por)
  values (p_condominio, v_mes, v_numero, v_partes,
          case when 'RESUMO' = any (v_partes) then v_resumo end, case when 'PALAVRA' = any (v_partes) then v_palavra end,
          v_conteudo, p_pessoa)
  returning * into v_rel;

  for a in select * from jsonb_array_elements(coalesce(p_anexos, '[]'::jsonb)) loop
    n := n + 1;
    if jsonb_typeof(a) <> 'object' or ((a ? 'arquivoId') = (a ? 'documentoId')) then
      perform recusar_campos('Cada anexo é um arquivo enviado ou um documento', 'anexos');
    end if;
    if a ? 'arquivoId' then
      -- O arquivo de quem gera, ou um que já foi para um relatório deste condomínio (gerar de novo).
      select * into arq from arquivos_relatorio x
       where x.id = (a ->> 'arquivoId')::uuid
         and (x.enviado_por = p_pessoa or exists (select 1 from anexos_relatorio y where y.arquivo_id = x.id));
      if not found then raise exception 'Anexo não encontrado' using errcode = 'TC404'; end if;
      if arq.situacao <> 'LIBERADO' then perform recusar_motivo('Um anexo ainda não foi liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
      insert into anexos_relatorio (condominio_id, relatorio_id, ordem, titulo, tipo, arquivo_id)
      values (p_condominio, v_rel.id, n, left(regexp_replace(arq.nome, '\.[A-Za-z0-9]{1,5}$', ''), 200), arq.tipo, arq.id);
    else
      -- Documento: só o que a pessoa vê (TR-08), na versão em vigor.
      if not pode(p_pessoa, p_condominio, 'documentos.ver') then
        raise exception 'Documento não encontrado' using errcode = 'TC404';
      end if;
      doc := exigir_documento(p_pessoa, (a ->> 'documentoId')::uuid);
      if doc.arquivado_em is not null then perform recusar_motivo('Documento arquivado', 'ANEXO_ARQUIVADO'); end if;
      ver := versao_em_vigor(doc.id);
      if ver.id is null then perform recusar_motivo('O documento não tem versão em vigor', 'ANEXO_SEM_VERSAO'); end if;
      if ver.tipo not in ('image/jpeg', 'image/png', 'application/pdf') then
        perform recusar_motivo('Só fotos JPG ou PNG e PDF entram no relatório', 'TIPO_NAO_ACEITO_RELATORIO');
      end if;
      insert into anexos_relatorio (condominio_id, relatorio_id, ordem, titulo, tipo, documento_id, versao_documento_id)
      values (p_condominio, v_rel.id, n, doc.titulo, ver.tipo, doc.id, ver.id);
    end if;
  end loop;

  if coalesce(p_guardar_modelo, false) then
    insert into modelos_relatorio (condominio_id, partes, guardado_por) values (p_condominio, exigir_partes_relatorio(p_partes), p_pessoa)
    on conflict (condominio_id) do update set partes = excluded.partes, guardado_em = app_now(), guardado_por = excluded.guardado_por;
    perform registrar_historico('relatorio.modelo_guardado', 'modelos_relatorio', p_condominio::text,
                                jsonb_build_object('partes', to_jsonb(exigir_partes_relatorio(p_partes))));
  end if;
  perform registrar_historico('relatorio.gerado', 'relatorios_mes', v_rel.id::text, jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'), 'numero', v_numero, 'partes', to_jsonb(v_partes), 'anexos', n,
    'foraPorPermissao', v_conteudo -> 'foraPorPermissao'));
  return jsonb_build_object('id', v_rel.id, 'mes', to_char(v_mes, 'YYYY-MM'), 'numero', v_numero);
end $$;

-- O relatório gerado, como foi gerado.
create function plataforma_relatorio(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r relatorios_mes;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into r from relatorios_mes where id = p_id;
  if not found then raise exception 'Relatório não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'id', r.id, 'mes', to_char(r.mes, 'YYYY-MM'), 'numero', r.numero, 'partes', to_jsonb(r.partes),
    'resumo', r.resumo, 'palavra', r.palavra, 'conteudo', r.conteudo, 'geradoEm', r.gerado_em,
    'ultimo', r.numero = (select max(numero) from relatorios_mes x where x.mes = r.mes),
    'anexos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                                 'ordem', a.ordem, 'titulo', a.titulo, 'tipo', a.tipo, 'arquivoId', a.arquivo_id,
                                 'documentoId', a.documento_id, 'tamanho', coalesce(x.tamanho, v.tamanho),
                                 'origem', case when a.arquivo_id is null then 'DOCUMENTO' else 'ENVIADO' end))
                               order by a.ordem)
                          from anexos_relatorio a
                          left join arquivos_relatorio x on x.id = a.arquivo_id
                          left join versoes_documento v on v.id = a.versao_documento_id
                         where a.relatorio_id = r.id), '[]'::jsonb));
end $$;

-- Abrir um anexo para montar o PDF: o banco confere e a API gera o link de 5 minutos. O anexo
-- de documento abre a versão que entrou no relatório, mesmo que já exista outra em vigor.
create function plataforma_abrir_anexo_relatorio(p_pessoa uuid, p_condominio uuid, p_id uuid, p_ordem integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a anexos_relatorio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into a from anexos_relatorio where relatorio_id = p_id and ordem = p_ordem;
  if not found then raise exception 'Anexo não encontrado' using errcode = 'TC404'; end if;
  if a.arquivo_id is not null then
    return (select jsonb_build_object('armazenamento', 'relatorios', 'caminho', x.caminho, 'nome', x.nome, 'tipo', x.tipo)
              from arquivos_relatorio x where x.id = a.arquivo_id);
  end if;
  return (select jsonb_build_object('armazenamento', 'documentos', 'caminho', v.caminho, 'nome', v.nome, 'tipo', v.tipo)
            from versoes_documento v where v.id = a.versao_documento_id);
end $$;

-- Baixar o PDF ou as tabelas fica no histórico (TR-08).
create function plataforma_relatorio_baixado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_formato text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare r relatorios_mes;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into r from relatorios_mes where id = p_id;
  if not found then raise exception 'Relatório não encontrado' using errcode = 'TC404'; end if;
  if p_formato is null or p_formato not in ('PDF', 'CSV') then perform recusar_campos('Formato PDF ou CSV', 'formato'); end if;
  perform registrar_historico('relatorio.baixado', 'relatorios_mes', r.id::text, jsonb_build_object(
    'mes', to_char(r.mes, 'YYYY-MM'), 'numero', r.numero, 'formato', p_formato));
end $$;

call fechar_acesso();

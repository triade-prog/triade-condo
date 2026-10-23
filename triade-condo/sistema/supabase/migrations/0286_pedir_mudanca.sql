-- 0286 · Pedir mudança à TRÍADE (item 8 do novo frontend; PI-04, CF-09, PI-20, CT-03).
-- Desenho nos quadros 193 a 200 do canvas do novo frontend, aprovado pela Carolina em 23/10/2026.
--
-- Decisões (todas a opção 1, 23/10/2026):
-- A. "Mudança de configuração" é um tipo próprio de chamado (MUDANCA). Ele nasce só do "Pedir
--    mudança" das Configurações, por plataforma_pedir_mudanca; o "Abrir chamado" continua com
--    Dúvida, Problema e Sugestão.
-- B. O chamado guarda a parte (um código, como FUSO) e o valor de hoje. A Configuração mostra que a
--    mudança já foi pedida; por isso não se pede de novo uma parte com pedido aberto.
-- C. O Console filtra os chamados por tipo na tela; o resumo do chamado passa a trazer a parte e o
--    valor de hoje.
-- D. A linha do tempo da memória (0180) diz "assume a sindicatura" e "deixa a sindicatura", no
--    lugar de "assume como síndico" e "deixa de ser síndico".

-- ---------------------------------------------------------------------------------------
-- Colunas e regras.

alter table chamados drop constraint chamados_tipo_check;
alter table chamados
  add constraint chamados_tipo_check check (tipo in ('DUVIDA', 'PROBLEMA', 'SUGESTAO', 'MUDANCA')),
  add column mudanca_parte text check (mudanca_parte ~ '^[A-Z][A-Z_]{1,39}$'),
  add column mudanca_hoje  text check (length(btrim(mudanca_hoje)) between 1 and 300),
  add constraint chamados_mudanca_parte check ((tipo = 'MUDANCA') = (mudanca_parte is not null)),
  add constraint chamados_mudanca_hoje check ((mudanca_parte is null) = (mudanca_hoje is null));

-- Decisão B: um pedido aberto por parte, conferido ao pedir (o índice só ajuda a achar). Não é
-- único porque responder um chamado resolvido o reabre, mesmo que a parte já tenha outro pedido.
create index chamados_mudanca_aberta on chamados (condominio_id, mudanca_parte)
  where tipo = 'MUDANCA' and situacao <> 'RESOLVIDO';

-- ---------------------------------------------------------------------------------------
-- O resumo do chamado (0190) com a parte e o valor de hoje.

create or replace function resumo_chamado(c chamados, p_internas boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'condominioId', c.condominio_id, 'numero', c.numero, 'tipo', c.tipo, 'area', c.area, 'titulo', c.titulo,
    'situacao', c.situacao, 'abertoPorId', c.aberto_por, 'abertoPor', nome_pessoa(c.aberto_por),
    'responsavelId', c.responsavel_id, 'responsavel', nome_pessoa(c.responsavel_id),
    'parte', c.mudanca_parte, 'hoje', c.mudanca_hoje,
    'imagens', (select count(*) from arquivos_chamado a where a.chamado_id = c.id and a.situacao = 'LIBERADO'),
    'ultima', (select jsonb_build_object('lado', m.lado, 'autor', nome_pessoa(m.autor_id), 'em', m.criado_em)
                 from mensagens_chamado m where m.chamado_id = c.id and (p_internas or not m.interna)
                order by m.criado_em desc limit 1),
    'resolvidoEm', c.resolvido_em, 'criadoEm', c.criado_em, 'atualizadoEm', c.atualizado_em, 'versao', c.versao))
$$;

-- ---------------------------------------------------------------------------------------
-- Pedir a mudança (decisões A e B). O título vem pronto da API ("Mudar: Fuso do condomínio"),
-- que conhece o nome de cada parte.

create function plataforma_pedir_mudanca(p_pessoa uuid, p_condominio uuid, p_parte text, p_titulo text, p_hoje text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_numero integer;
  v_aberto integer;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_hoje text := btrim(coalesce(p_hoje, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  if p_parte is null or p_parte !~ '^[A-Z][A-Z_]{1,39}$' then perform recusar_campos('Diga qual parte mudar', 'parte'); end if;
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if coalesce(length(v_hoje), 0) not between 1 and 300 then perform recusar_campos('Diga como está hoje (até 300 caracteres)', 'hoje'); end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Diga o que precisa e por quê (até 4.000 caracteres)', 'texto'); end if;
  perform pg_advisory_xact_lock(hashtext('chamados:' || p_condominio));
  select numero into v_aberto from chamados
   where condominio_id = p_condominio and tipo = 'MUDANCA' and mudanca_parte = p_parte and situacao <> 'RESOLVIDO';
  if found then
    perform recusar_motivo(format('Já há um pedido aberto para esta parte: chamado %s', v_aberto), 'MUDANCA_JA_PEDIDA');
  end if;
  if not limite_contar('chamado', p_pessoa::text) then
    perform recusar_motivo('Muitos chamados abertos hoje; responda num dos que já existem', 'LIMITE_CHAMADOS');
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from chamados where condominio_id = p_condominio;
  insert into chamados (condominio_id, numero, aberto_por, tipo, area, titulo, mudanca_parte, mudanca_hoje)
  values (p_condominio, v_numero, p_pessoa, 'MUDANCA', 'CONFIGURACOES', v_titulo, p_parte, v_hoje)
  returning id into v_id;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, v_id, p_pessoa, 'CLIENTE', v_texto);
  perform registrar_historico('chamado.aberto', 'chamado', v_id::text,
                              jsonb_build_object('tipo', 'MUDANCA', 'area', 'CONFIGURACOES', 'parte', p_parte));
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- As mudanças pedidas e ainda abertas, para a Configuração mostrar ao lado de cada parte.
-- Todos do condomínio veem que a parte já foi pedida; "ver" diz se a pessoa pode abrir o chamado.
create function plataforma_mudancas_pedidas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  return coalesce((
    select jsonb_agg(jsonb_build_object('parte', c.mudanca_parte, 'id', c.id, 'numero', c.numero, 'situacao', c.situacao,
                                        'abertoPor', nome_pessoa(c.aberto_por), 'ver', chamado_visivel(p_pessoa, c)) order by c.numero)
      from chamados c where c.tipo = 'MUDANCA' and c.situacao <> 'RESOLVIDO'), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Decisão D: a linha do tempo da memória (0180; envolvida pela 0240 como eventos_memoria_r10).

create or replace function eventos_memoria_r10(p_pessoa uuid) returns table (data date, momento timestamptz, categoria text, evento jsonb)
language plpgsql stable
set search_path = public
as $$
declare
  v_cond uuid := contexto_condominio();
  v_manut boolean := pode(p_pessoa, v_cond, 'manutencao.ver');
  v_restritos boolean := pode(p_pessoa, v_cond, 'documentos.restritos');
  v_comunicados boolean := pode(p_pessoa, v_cond, 'comunicados.ver');
begin
  return query
    select a.aconteceu_em, a.criado_em, 'ANOTADO'::text, jsonb_build_object('fonte', 'ANOTADO') || anotacao_json(p_pessoa, a)
      from anotacoes_memoria a where a.retirada_em is null;
  if v_manut then
    return query
      select coalesce(m.realizada_em, data_no_condominio(m.concluida_em)), m.concluida_em, 'MANUTENCAO'::text,
             jsonb_strip_nulls(jsonb_build_object('fonte', 'MANUTENCAO', 'id', m.id, 'titulo', 'Manutenção concluída: ' || m.titulo,
               'detalhe', coalesce((select x.nome from prestadores x where x.id = m.prestador_id), m.executor_texto, nome_do_vinculo(m.executor_vinculo)),
               'manutencaoId', m.id))
        from manutencoes m where m.estado = 'CONCLUIDA' and m.concluida_em is not null;
  end if;
  return query
    select v.vigente_desde, v.verificado_em, 'DOCUMENTOS'::text,
           jsonb_strip_nulls(jsonb_build_object('fonte', 'DOCUMENTO', 'id', v.id, 'documentoId', d.id,
             'titulo', case when v.numero = 1 then 'Documento guardado: ' || d.titulo else d.titulo || ', versão ' || v.numero end,
             'detalhe', coalesce(v.mudanca, case when v.aprovado_em is not null then 'Aprovado em ' || v.aprovado_em end)))
      from versoes_documento v join documentos d on d.id = v.documento_id
     where v.situacao = 'LIBERADO' and (not d.restrito or v_restritos);
  return query
    select x.vale_ate, x.vale_ate::timestamptz, 'DOCUMENTOS'::text,
           jsonb_build_object('fonte', 'PRONTUARIO', 'id', x.id, 'titulo', x.nome || ' venceu', 'detalhe', 'Do prontuário')
      from prontuario_lista() x where x.situacao = 'VENCEU';
  if v_comunicados then
    return query
      select data_no_condominio(c.publicado_em), c.publicado_em, 'COMUNICADOS'::text,
             jsonb_build_object('fonte', 'COMUNICADO', 'id', c.id, 'titulo', 'Assembleia: ' || c.titulo, 'detalhe', 'Comunicado publicado')
        from comunicados c where c.assunto = 'ASSEMBLEIA' and c.numero = 1 and c.publicado_em is not null;
  end if;
  return query
    select data_no_condominio(v.criado_em), v.criado_em, 'PESSOAS'::text,
           jsonb_build_object('fonte', 'PESSOA', 'id', v.id, 'titulo', p.nome || ' assume a sindicatura', 'detalhe', 'Entrada na Plataforma')
      from vinculos v join pessoas p on p.id = v.pessoa_id where v.condominio_id = v_cond and v.funcao = 'SINDICO'
    union all
    select data_no_condominio(v.revogado_em), v.revogado_em, 'PESSOAS'::text,
           jsonb_build_object('fonte', 'PESSOA', 'id', v.id, 'titulo', p.nome || ' deixa a sindicatura', 'detalhe', 'Acesso encerrado')
      from vinculos v join pessoas p on p.id = v.pessoa_id where v.condominio_id = v_cond and v.funcao = 'SINDICO' and v.revogado_em is not null;
end $$;

call fechar_acesso();

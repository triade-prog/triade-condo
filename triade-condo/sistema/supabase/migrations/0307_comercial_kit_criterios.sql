-- 0307 · Kit para o conselho pelos critérios do síndico (R17.3b; IDEIAS CM-20 e CM-16; desenho dos
-- quadros 322 e 337 aprovado pela Carolina em 24/10/2026). O resto da CM-20 que a R17.3 não entregou.
--
-- 1. Critérios do síndico (CM-16, CM-20): na ficha do prédio, os critérios que o síndico marcou na
--    visita, de uma lista fechada e curta, com "outro" em texto, e o problema do prédio em texto
--    curto. A ficha e o "Escolher critérios" do kit editam a mesma escolha.
-- 2. Comparativo pelos critérios: uma linha por critério escolhido. A coluna da TRÍADE tem textos
--    fixos (EM-07: só o que já existe, o planejado dito como planejado, sem ROI); o custo por
--    apartamento sai da versão enviada, como estimativa. As colunas do sistema atual e dos
--    concorrentes da ficha mostram o fato que a equipe confirmou; o que não se sabe fica a
--    confirmar. O custo por apartamento do concorrente também vem da Tabela de preços quando o
--    preço foi conferido lá (como na 0304).
-- 3. Fatos do comparativo: a equipe registra o fato confirmado por sistema e critério, com a fonte
--    e a data. O fato vale para todo interessado que tem aquele sistema (o nome é comparado sem
--    acento nem espaço); o do critério "outro" é só do prédio dele. A fonte, quem registrou e quando
--    ficam só para a equipe: o link e o kit levam só o texto (CM-12).
-- 4. O kit (Console e link) traz o problema do prédio para a apresentação curta e o mesmo
--    comparativo nos dois. O piloto da apresentação continua fora: depende do piloto com critério
--    de sucesso (CM-21, R17.4).
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- A lista fechada (quadro 337) e o texto fixo da TRÍADE em cada critério (EM-07). Mudar é uma
-- migration nova. O custo por apartamento da TRÍADE sai da versão enviada; o título do "outro"
-- sai da ficha.

create function comercial_criterios() returns jsonb
language sql immutable
set search_path = public
as $$
  select '[
    {"codigo": "PEDIDO_COM_PRAZO", "titulo": "Todo pedido com responsável e prazo", "triade": "Sim: todo pedido tem responsável, prazo e conclusão explicada"},
    {"codigo": "SEM_BAIXAR_APP", "titulo": "Morador usa sem baixar app", "triade": "Sim: comunicados, documentos e mural do prédio abrem por link, sem baixar app; o WhatsApp oficial ainda é planejado"},
    {"codigo": "HISTORICO_PASSA", "titulo": "Histórico que passa para o próximo síndico", "triade": "Sim: o histórico fica com o prédio e passa ao próximo síndico com o dossiê de passagem de bastão"},
    {"codigo": "CUSTO_APARTAMENTO", "titulo": "Custo por apartamento por mês"},
    {"codigo": "COMO_CANCELAR", "titulo": "Como cancelar", "triade": "A TRÍADE propõe aviso de 30 dias, sem multa; vale o que estiver no contrato assinado"},
    {"codigo": "DEVOLUCAO_DADOS", "titulo": "Devolução dos dados na saída", "triade": "Sim: o síndico exporta todo o histórico do prédio pela Plataforma, quando quiser"},
    {"codigo": "OUTRO", "titulo": "Outro", "triade": "A equipe da TRÍADE responde este ponto com o conselho"}
  ]'::jsonb
$$;

create function comercial_criterio_valido(p text) returns boolean
language sql immutable
set search_path = public
as $$ select p in ('PEDIDO_COM_PRAZO', 'SEM_BAIXAR_APP', 'HISTORICO_PASSA', 'CUSTO_APARTAMENTO', 'COMO_CANCELAR', 'DEVOLUCAO_DADOS', 'OUTRO') $$;

-- ---------------------------------------------------------------------------------------
-- 1. Os critérios e o problema na ficha do prédio.

alter table interessados
  add column criterios      text[] not null default '{}'
    check (criterios <@ array['PEDIDO_COM_PRAZO', 'SEM_BAIXAR_APP', 'HISTORICO_PASSA', 'CUSTO_APARTAMENTO', 'COMO_CANCELAR', 'DEVOLUCAO_DADOS', 'OUTRO']),
  add column criterio_outro text check (length(btrim(criterio_outro)) between 2 and 120),
  add column problema       text check (length(btrim(problema)) between 2 and 300),
  add constraint interessados_criterio_outro check (('OUTRO' = any (criterios)) = (criterio_outro is not null));

-- A escolha vem da lista; "outro" pede o texto; o texto do outro só existe com "outro" marcado.
create function interessados_criterios() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.criterios := coalesce((select array_agg(distinct c order by c) from unnest(new.criterios) c), '{}');
  if exists (select 1 from unnest(new.criterios) c where not comercial_criterio_valido(c)) then
    perform recusar_campos('Escolha os critérios da lista', 'criterios');
  end if;
  new.criterio_outro := case when 'OUTRO' = any (new.criterios) then nullif(btrim(new.criterio_outro), '') end;
  new.problema := nullif(btrim(new.problema), '');
  if 'OUTRO' = any (new.criterios) and new.criterio_outro is null then
    perform recusar_campos('Diga qual é o outro critério', 'criterioOutro');
  end if;
  if length(new.criterio_outro) not between 2 and 120 then perform recusar_campos('O outro critério tem até 120 letras', 'criterioOutro'); end if;
  if length(new.problema) not between 2 and 300 then perform recusar_campos('O problema do prédio tem até 300 letras', 'problema'); end if;
  return new;
end $$;
create trigger interessados_criterios before insert or update of criterios, criterio_outro, problema on interessados
  for each row execute function interessados_criterios();

-- ---------------------------------------------------------------------------------------
-- 3. Os fatos confirmados pela equipe, por sistema e critério.

create table fatos_comparativo (
  id             uuid primary key default gen_random_uuid(),
  sistema        text not null check (length(btrim(sistema)) between 2 and 120),
  -- O nome sem acento, espaço nem pontuação: "App da Contábil Norte" e "app da contabil norte" são o mesmo.
  sistema_chave  text not null,
  criterio       text not null check (comercial_criterio_valido(criterio)),
  -- Só no critério "outro", que é do prédio: o fato vale só para aquele interessado.
  interessado_id uuid references interessados (id),
  texto          text not null check (length(btrim(texto)) between 2 and 200),
  -- De onde a equipe confirmou (site, contrato, conversa com eles). Só a equipe vê.
  fonte          text not null check (length(btrim(fonte)) between 3 and 200),
  confirmado_em  date not null,
  retirado_em    timestamptz,
  retirado_por   uuid references pessoas (id),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1,
  check ((criterio = 'OUTRO') = (interessado_id is not null))
);
create unique index fatos_comparativo_um on fatos_comparativo (sistema_chave, criterio) where interessado_id is null and retirado_em is null;
create unique index fatos_comparativo_outro on fatos_comparativo (interessado_id, sistema_chave) where interessado_id is not null and retirado_em is null;
call proteger_tabela_comercial('fatos_comparativo', 'console.comercial.editar',
  'Fatos que a equipe confirmou sobre o sistema atual e os concorrentes, para o comparativo do kit (CM-20)');
create trigger fatos_comparativo_sem_exclusao before delete on fatos_comparativo for each row execute function somente_insercao();

-- O sistema e o critério não mudam; o fato retirado não volta (registre outro).
create function fatos_comparativo_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.sistema, new.sistema_chave, new.criterio, new.interessado_id, new.criado_em, new.criado_por)
     is distinct from (old.sistema, old.sistema_chave, old.criterio, old.interessado_id, old.criado_em, old.criado_por) then
    raise exception 'O sistema e o critério do fato não mudam' using errcode = 'TC422', detail = '{"motivo":"FATO_FIXO"}';
  end if;
  if old.retirado_em is not null then
    raise exception 'Fato retirado não muda; registre outro' using errcode = 'TC422', detail = '{"motivo":"FATO_RETIRADO"}';
  end if;
  return new;
end $$;
create trigger fatos_comparativo_regras before update on fatos_comparativo for each row execute function fatos_comparativo_regras();

-- O histórico dos fatos fica com o resto do Comercial.
alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial', 'proposta', 'resposta_comercial',
                                                                'referencia_comercial', 'fato_comparativo')
             and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- A ficha: o prédio passa a ter os critérios e o problema. Mesmo corpo da 0296.

create or replace function comercial_json(i interessados, p_completo boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_tarefa jsonb := comercial_tarefa(i);
  v jsonb;
begin
  v := jsonb_build_object(
    'id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'cidade', i.cidade, 'uf', i.uf, 'faixa', i.faixa, 'unidades', i.unidades,
    'pessoa', i.nome_contato, 'papel', i.papel_contato, 'whatsappMascarado', comercial_mascarar(i.whatsapp),
    'origem', i.origem, 'origemDetalhe', i.origem_detalhe, 'etapa', i.etapa, 'etapaDesde', i.etapa_desde,
    'probabilidade', (select probabilidade from parametros_etapa_comercial where etapa = i.etapa),
    'responsavel', case when i.responsavel_id is not null then jsonb_build_object('id', i.responsavel_id, 'nome', comercial_nome(i.responsavel_id)) end,
    'proximoPasso', case when i.proximo_passo is not null then
      jsonb_strip_nulls(jsonb_build_object('texto', i.proximo_passo, 'data', i.proximo_passo_data, 'hora', to_char(i.proximo_passo_hora, 'HH24:MI'))) end,
    'primeiroRetornoAte', i.primeiro_retorno_ate, 'primeiraRespostaEm', i.primeira_resposta_em,
    'ultimaConversa', (select jsonb_build_object('em', c.criado_em, 'resumo', c.resumo, 'canal', c.canal)
                         from conversas_comercial c where c.interessado_id = i.id order by c.criado_em desc, c.id desc limit 1),
    'motivoPerda', i.motivo_perda, 'anonimizado', i.anonimizado_em is not null, 'criadoEm', i.criado_em,
    'tarefa', v_tarefa, 'atencao', comercial_atencao(v_tarefa),
    'temWhatsapp', i.optin_em is not null and i.whatsapp is not null and not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj));
  if p_completo then
    v := v || jsonb_build_object(
      'whatsapp', i.whatsapp, 'email', i.email, 'cnpj', i.cnpj, 'endereco', i.endereco, 'utm', i.utm,
      'lote', (select jsonb_build_object('id', l.id, 'arquivo', l.arquivo, 'origem', l.origem_texto) from lotes_comercial l where l.id = i.lote_id),
      'baseLegal', jsonb_build_object('tipo', i.base_legal, 'texto', i.base_legal_texto, 'em', i.base_legal_em),
      'optin', case when i.optin_em is not null then jsonb_build_object('em', i.optin_em, 'canal', i.optin_canal, 'texto', i.optin_texto) end,
      'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
      'predio', jsonb_strip_nulls(jsonb_build_object(
        'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
        'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate,
        'decisor', i.decisor, 'decisaoEm', i.decisao_em, 'visitaEm', i.visita_em, 'visitaNota', i.visita_nota,
        'demonstracaoEm', i.demonstracao_em,
        'criterios', comercial_criterios_ordem(i.criterios), 'criterioOutro', i.criterio_outro, 'problema', i.problema)),
      'objecoes', to_jsonb(i.objecoes), 'concorrentes', i.concorrentes,
      'perda', case when i.etapa = 'PERDIDO' then jsonb_strip_nulls(jsonb_build_object('motivo', i.motivo_perda, 'detalhe', i.perda_detalhe,
                                                                                      'vencedor', i.vencedor, 'retomarEm', i.retomar_em)) end,
      'observacao', i.observacao,
      'cadencia', (select jsonb_strip_nulls(jsonb_build_object('id', c.id, 'nome', c.nome, 'passos', c.passos, 'feitos', i.cadencia_feitos,
                                                               'inicio', i.cadencia_inicio, 'fimEm', i.cadencia_fim_em, 'fimMotivo', i.cadencia_fim_motivo))
                     from cadencias_comercial c where c.id = i.cadencia_id),
      'falta', (select jsonb_object_agg(p.etapa, to_jsonb(comercial_falta(i, p.etapa))) from parametros_etapa_comercial p
                 where cardinality(comercial_falta(i, p.etapa)) > 0));
  end if;
  return jsonb_strip_nulls(v);
end $$;

-- Os critérios escolhidos na ordem da lista (quadro 337).
create function comercial_criterios_ordem(p text[]) returns jsonb
language sql immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(c -> 'codigo' order by n), '[]'::jsonb)
    from jsonb_array_elements(comercial_criterios()) with ordinality x(c, n) where c ->> 'codigo' = any (p)
$$;

-- Salvar a ficha (CM-16): igual à 0296; os critérios e o problema só mudam quando a tela manda
-- o campo, para quem ainda manda a ficha sem eles não apagar a escolha feita no kit.
create or replace function comercial_salvar(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cnpj     text := comercial_texto(p_dados, 'cnpj');
  v_resp     uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_existe   record;
  v_versao   integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if v_whatsapp is null and v_email is null and i.origem <> 'IMPORTACAO' then
    perform recusar_campos('Informe o WhatsApp ou o e-mail', 'whatsapp', 'email');
  end if;
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, v_cnpj, null, p_id);
  if v_existe.id is not null then
    raise exception 'Este contato já é de outro interessado' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'DUPLICADO', 'campos', jsonb_build_array(lower(v_existe.campo)), 'interessadoId', v_existe.id)::text;
  end if;
  perform comercial_exigir_responsavel(v_resp);
  update interessados set
    nome_contato = comercial_texto(p_dados, 'pessoa'), papel_contato = comercial_texto(p_dados, 'papel'), whatsapp = v_whatsapp, email = v_email,
    condominio = comercial_texto(p_dados, 'condominio'), cnpj = v_cnpj, endereco = comercial_texto(p_dados, 'endereco'),
    cidade = comercial_texto(p_dados, 'cidade'), uf = comercial_texto(p_dados, 'uf'), faixa = comercial_texto(p_dados, 'faixa'),
    unidades = (p_dados ->> 'unidades')::integer, responsavel_id = v_resp,
    administradora = comercial_texto(p_dados, 'administradora'), app_administradora = (p_dados ->> 'appAdministradora')::boolean,
    sistema_atual = comercial_texto(p_dados, 'sistemaAtual'), fidelidade_ate = (p_dados ->> 'fidelidadeAte')::date,
    assembleia_ordinaria = (p_dados ->> 'assembleiaOrdinaria')::date, mandato_ate = (p_dados ->> 'mandatoAte')::date,
    decisor = comercial_texto(p_dados, 'decisor'), decisao_em = (p_dados ->> 'decisaoEm')::date,
    visita_em = (p_dados ->> 'visitaEm')::date, visita_nota = comercial_texto(p_dados, 'visitaNota'),
    demonstracao_em = (p_dados ->> 'demonstracaoEm')::timestamptz,
    criterios = case when p_dados ? 'criterios'
                     then coalesce((select array_agg(distinct c) from jsonb_array_elements_text(coalesce(p_dados -> 'criterios', '[]')) c), '{}')
                     else criterios end,
    criterio_outro = case when p_dados ? 'criterioOutro' then comercial_texto(p_dados, 'criterioOutro') else criterio_outro end,
    problema = case when p_dados ? 'problema' then comercial_texto(p_dados, 'problema') else problema end,
    objecoes = coalesce((select array_agg(distinct o) from jsonb_array_elements_text(coalesce(p_dados -> 'objecoes', '[]')) o), '{}'),
    concorrentes = coalesce(p_dados -> 'concorrentes', '[]'),
    observacao = comercial_texto(p_dados, 'observacao'),
    -- Opt-in novo: guarda data, canal e o texto; tirar o opt-in apaga os três.
    optin_em = case when comercial_texto(p_dados, 'optinTexto') is null then null
                    when comercial_texto(p_dados, 'optinTexto') is distinct from i.optin_texto then app_now() else i.optin_em end,
    optin_canal = case when comercial_texto(p_dados, 'optinTexto') is null then null else coalesce(comercial_texto(p_dados, 'optinCanal'), i.optin_canal, 'WHATSAPP') end,
    optin_texto = comercial_texto(p_dados, 'optinTexto'),
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  perform registrar_historico_interno('comercial.ficha', 'interessado', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- "Escolher critérios" do kit (quadro 337): só os critérios, o outro e o problema do prédio.
create function comercial_salvar_criterios(p_pessoa uuid, p_id uuid, p_versao integer, p_criterios text[], p_outro text, p_problema text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  perform comercial_buscar(p_id);
  update interessados set criterios = coalesce(p_criterios, '{}'), criterio_outro = p_outro, problema = p_problema,
                          alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  perform registrar_historico_interno('comercial.criterios', 'interessado', p_id::text,
    jsonb_build_object('criterios', comercial_criterios_ordem(p_criterios)));
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. Registrar, mudar e retirar o fato confirmado.

create function comercial_salvar_fato(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sistema     text := comercial_texto(p_dados, 'sistema');
  v_criterio    text := comercial_texto(p_dados, 'criterio');
  v_texto       text := comercial_texto(p_dados, 'texto');
  v_fonte       text := comercial_texto(p_dados, 'fonte');
  v_confirmado  date := coalesce(nullif(p_dados ->> 'confirmadoEm', '')::date, comercial_hoje());
  v_interessado uuid;
  f             fatos_comparativo;
  v_id          uuid;
  v_versao      integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if coalesce(length(v_texto), 0) not between 2 and 200 then perform recusar_campos('Escreva o fato confirmado', 'texto'); end if;
  if coalesce(length(v_fonte), 0) not between 3 and 200 then perform recusar_campos('Diga onde confirmou', 'fonte'); end if;
  if v_confirmado > comercial_hoje() then perform recusar_campos('A data da confirmação não pode ser futura', 'confirmadoEm'); end if;
  if p_id is not null then
    select * into f from fatos_comparativo where id = p_id;
    if not found then raise exception 'Fato não encontrado' using errcode = 'TC404'; end if;
    if f.retirado_em is not null then perform recusar_motivo('Fato retirado não muda; registre outro', 'FATO_RETIRADO'); end if;
    update fatos_comparativo set texto = v_texto, fonte = v_fonte, confirmado_em = v_confirmado, alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id and versao = p_versao
    returning id, versao into v_id, v_versao;
    if v_versao is null then perform conflito_versao('fatos_comparativo', p_id); end if;
  else
    if coalesce(length(v_sistema), 0) not between 2 and 120 then perform recusar_campos('Diga de qual sistema é o fato', 'sistema'); end if;
    if v_criterio is null or not comercial_criterio_valido(v_criterio) then perform recusar_campos('Escolha o critério da lista', 'criterio'); end if;
    if v_criterio = 'OUTRO' then
      v_interessado := nullif(p_dados ->> 'interessadoId', '')::uuid;
      if v_interessado is null then perform recusar_campos('O critério outro é do prédio: diga qual', 'interessadoId'); end if;
      perform comercial_buscar(v_interessado);
    end if;
    select * into f from fatos_comparativo x
     where x.retirado_em is null and x.sistema_chave = comercial_normalizar(v_sistema) and x.criterio = v_criterio
       and x.interessado_id is not distinct from v_interessado;
    if f.id is not null then
      raise exception 'Já há um fato confirmado para este sistema e critério' using errcode = 'TC422',
        detail = jsonb_build_object('motivo', 'FATO_EXISTE', 'fatoId', f.id)::text;
    end if;
    insert into fatos_comparativo (sistema, sistema_chave, criterio, interessado_id, texto, fonte, confirmado_em, criado_por)
    values (v_sistema, comercial_normalizar(v_sistema), v_criterio, v_interessado, v_texto, v_fonte, v_confirmado, p_pessoa)
    returning id, versao into v_id, v_versao;
  end if;
  perform registrar_historico_interno('comercial.fato', 'fato_comparativo', v_id::text,
    jsonb_build_object('sistema', coalesce(f.sistema, v_sistema), 'criterio', coalesce(f.criterio, v_criterio)));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Retirar: o comparativo volta a "a confirmar" (ou ao preço conferido na Tabela de preços).
create function comercial_retirar_fato(p_pessoa uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f fatos_comparativo;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into f from fatos_comparativo where id = p_id;
  if not found then raise exception 'Fato não encontrado' using errcode = 'TC404'; end if;
  if f.retirado_em is not null then perform recusar_motivo('Fato já retirado', 'FATO_RETIRADO'); end if;
  update fatos_comparativo set retirado_em = app_now(), retirado_por = p_pessoa where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('fatos_comparativo', p_id); end if;
  perform registrar_historico_interno('comercial.fato_retirado', 'fato_comparativo', p_id::text,
    jsonb_build_object('sistema', f.sistema, 'criterio', f.criterio));
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. O comparativo pelos critérios.

-- As colunas: o sistema atual e os concorrentes da ficha, sem repetir o mesmo nome.
create function comercial_colunas_comparativo(i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  with c as (
    select i.sistema_atual as nome, 'SISTEMA_ATUAL' as tipo, 0::bigint as o where i.sistema_atual is not null
    union all
    select x ->> 'nome', 'CONCORRENTE', o from jsonb_array_elements(i.concorrentes) with ordinality t(x, o)
  ), u as (
    select distinct on (comercial_normalizar(nome)) nome, tipo, o from c where comercial_normalizar(nome) is not null
     order by comercial_normalizar(nome), o
  )
  select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo) order by o), '[]'::jsonb) from u
$$;

-- O custo por apartamento da TRÍADE, da versão enviada: estimativa, implantação dita à parte.
create function comercial_custo_triade(v versoes_proposta) returns text
language sql stable
set search_path = public
as $$
  select reais(v.por_apartamento_centavos) || ' por apartamento por mês (estimativa)'
         || case when v.implantacao_sem_custo then ', sem custo de implantação' else ', implantação à parte' end
$$;

-- Uma célula: o fato confirmado pela equipe; no custo, o preço conferido na Tabela de preços;
-- senão, a confirmar.
create function comercial_valor_comparativo(i interessados, v versoes_proposta, p_criterio text, p_sistema text) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('confirmado', true, 'texto', f.texto) from fatos_comparativo f
      where f.retirado_em is null and f.sistema_chave = comercial_normalizar(p_sistema) and f.criterio = p_criterio
        and f.interessado_id is not distinct from case when p_criterio = 'OUTRO' then i.id end),
    case when p_criterio = 'CUSTO_APARTAMENTO' then
      (select jsonb_build_object('confirmado', true, 'texto', string_agg(
                case when x.a_partir_de then 'a partir de ' else '' end || reais(greatest(round(x.preco::numeric / v.unidades), 1)::bigint::centavos)
                || ' por apartamento (' || coalesce(x.plano || ': ', '') || reais(x.preco::centavos) || ' por mês)', '; ' order by x.plano nulls first))
         from (select pc.plano, pc.a_partir_de, comercial_preco_concorrente(pc, v.unidades) as preco from precos_concorrentes pc
                where pc.arquivado_em is null and pc.conferido and comercial_normalizar(pc.nome) = comercial_normalizar(p_sistema)) x
        where x.preco is not null having count(*) > 0) end,
    '{"confirmado": false}'::jsonb)
$$;

create function proposta_comparativo_criterios(v versoes_proposta, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  with col as (
    select c ->> 'nome' as nome, n from jsonb_array_elements(comercial_colunas_comparativo(i)) with ordinality x(c, n)
  ), crit as (
    select c ->> 'codigo' as codigo, c ->> 'titulo' as titulo, c ->> 'triade' as triade, n
      from jsonb_array_elements(comercial_criterios()) with ordinality x(c, n) where c ->> 'codigo' = any (i.criterios)
  )
  select jsonb_build_object(
    'colunas', comercial_colunas_comparativo(i),
    'linhas', coalesce((select jsonb_agg(jsonb_build_object(
        'criterio', k.codigo,
        'titulo', case when k.codigo = 'OUTRO' then coalesce(i.criterio_outro, k.titulo) else k.titulo end,
        'triade', case when k.codigo = 'CUSTO_APARTAMENTO' then comercial_custo_triade(v) else k.triade end,
        'valores', (select coalesce(jsonb_agg(comercial_valor_comparativo(i, v, k.codigo, col.nome) order by col.n), '[]'::jsonb) from col))
      order by k.n) from crit k), '[]'::jsonb))
$$;

-- Os fatos por trás do comparativo, para a equipe mudar ou retirar (só no Console: a fonte e
-- quem registrou não vão para o link).
create function comercial_fatos_do_kit(i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', f.id, 'versao', f.versao, 'sistema', f.sistema, 'criterio', f.criterio, 'texto', f.texto, 'fonte', f.fonte,
      'confirmadoEm', f.confirmado_em, 'por', comercial_pessoa_json(coalesce(f.alterado_por, f.criado_por)), 'em', coalesce(f.alterado_em, f.criado_em)))
      order by f.criado_em), '[]'::jsonb)
    from fatos_comparativo f
   where f.retirado_em is null and f.criterio = any (i.criterios)
     and f.interessado_id is not distinct from case when f.criterio = 'OUTRO' then i.id end
     and f.sistema_chave in (select comercial_normalizar(c ->> 'nome') from jsonb_array_elements(comercial_colunas_comparativo(i)) c)
$$;

-- 4. O kit (Console e link): o mesmo da 0304, com o problema e os critérios no prédio e as
-- linhas do comparativo pelos critérios. O preço conferido dos concorrentes continua lá.
create or replace function proposta_kit_json(v versoes_proposta, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'proposta', proposta_publica_json(v) - 'aosCuidados' - 'podeAceitar' - 'aceite',
    'predio', jsonb_strip_nulls(jsonb_build_object(
      'condominio', v.condominio, 'cidade', v.cidade, 'uf', v.uf, 'unidades', v.unidades,
      'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
      'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate, 'decisaoEm', i.decisao_em,
      'problema', i.problema, 'criterios', comercial_criterios_ordem(i.criterios), 'criterioOutro', i.criterio_outro)),
    'comparativo', jsonb_strip_nulls(jsonb_build_object(
      'triade', jsonb_strip_nulls(jsonb_build_object('ciclo', v.ciclo, 'mensal', v.mensal_centavos, 'anual', v.anual_centavos,
                                                     'porApartamento', v.por_apartamento_centavos, 'implantacao', v.implantacao_centavos,
                                                     'implantacaoSemCusto', v.implantacao_sem_custo, 'estimativa', true)),
      'sistemaAtual', case when i.sistema_atual is not null then jsonb_strip_nulls(jsonb_build_object('nome', i.sistema_atual, 'fidelidadeAte', i.fidelidade_ate)) end,
      'concorrentes', (select coalesce(jsonb_agg(jsonb_build_object(
            'nome', c ->> 'nome',
            'confirmado', exists (select 1 from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                                                       and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome')),
            'planos', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'plano', pc.plano, 'modelo', pc.modelo, 'preco', comercial_preco_concorrente(pc, v.unidades), 'aPartirDe', pc.a_partir_de,
                  'porApartamento', case when comercial_preco_concorrente(pc, v.unidades) is not null
                                         then greatest(round(comercial_preco_concorrente(pc, v.unidades)::numeric / v.unidades), 1)::bigint end,
                  'fonte', pc.fonte, 'lidoEm', pc.lido_em)) order by pc.plano nulls first), '[]'::jsonb)
                from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                              and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome'))) order by o), '[]'::jsonb)
         from jsonb_array_elements(i.concorrentes) with ordinality x(c, o))))
      || proposta_comparativo_criterios(v, i),
    'respostas', proposta_conteudo(v) -> 'respostas',
    'referencias', proposta_referencias(v),
    'oferta', jsonb_build_object('incluido', v.incluido, 'planejado', v.planejado))
$$;

-- O kit do Console (quadro 337): o mesmo do link, mais o que é da equipe: o interessado (para o
-- Escolher critérios), os fatos com a fonte e as respostas que dá para escolher.
create or replace function comercial_kit(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  p := comercial_buscar_proposta(p_id);
  select * into v from versoes_proposta x where x.proposta_id = p.id and proposta_situacao(x) in ('ENVIADA', 'ACEITA') order by x.numero desc limit 1;
  if v.id is null then perform recusar_motivo('O kit sai da versão enviada; envie a proposta antes', 'SEM_VERSAO_ENVIADA'); end if;
  i := comercial_buscar(p.interessado_id);
  return proposta_kit_json(v, i)
    || jsonb_build_object('propostaId', p.id, 'versaoId', v.id, 'respostasDisponiveis', comercial_respostas_revisadas(),
                          'interessado', jsonb_build_object('id', i.id, 'versao', i.versao), 'fatos', comercial_fatos_do_kit(i),
                          'podeEditar', pode_global('console.comercial.editar'));
end $$;

-- ---------------------------------------------------------------------------------------
-- LGPD (CM-12): a anonimização apaga também o problema do prédio e o texto do outro critério
-- (podem citar pessoas). Mesmo corpo da 0306, com os dois campos.

create or replace function comercial_anonimizar(p_id uuid, p_resumo text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('app.comercial_sistema', 'on', true);
  update interessados set nome_contato = null, papel_contato = null, whatsapp = null, email = null, cnpj = null, endereco = null,
         optin_em = null, optin_canal = null, optin_texto = null, observacao = null, perda_detalhe = null, decisor = null, visita_nota = null,
         proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null,
         criterios = array_remove(criterios, 'OUTRO'), criterio_outro = null, problema = null,
         cadencia_fim_em = case when cadencia_id is not null then coalesce(cadencia_fim_em, app_now()) end,
         cadencia_fim_motivo = case when cadencia_id is not null then coalesce(cadencia_fim_motivo, 'NAO_CONTATAR') end,
         anonimizado_em = app_now()
   where id = p_id;
  update conversas_comercial set resumo = p_resumo where interessado_id = p_id;
  update aceites_proposta a set nome = null, cpf = null, ip = null, aparelho = null, anonimizado_em = app_now()
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.anonimizado_em is null;
  update aberturas_proposta a set aparelho = null
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.aparelho is not null;
  update versoes_proposta v set nota_interna = null
    from propostas_comercial p
   where p.id = v.proposta_id and p.interessado_id = p_id and v.nota_interna is not null;
  perform comercial_revogar_links_interessado(p_id, 'Dados apagados (LGPD)', null);
  perform set_config('app.comercial_sistema', '', true);
end $$;

call fechar_acesso();

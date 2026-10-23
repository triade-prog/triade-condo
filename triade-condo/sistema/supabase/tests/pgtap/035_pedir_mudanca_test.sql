-- Pedir mudança à TRÍADE (0286; PI-04, CF-09, PI-20, CT-03): o tipo próprio de chamado, com a
-- parte e o valor de hoje guardados, um pedido aberto por parte e a frase nova da linha do tempo.
begin;
select plan(18);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, sup, 'SUPORTE'), teste.vincular(ana, ipe), teste.vincular(davi, jatoba),
       plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER'])
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vch(p uuid) returns integer language sql as $$ select versao from chamados where id = p $$;

-- Decisão A: o tipo nasce só do Pedir mudança.
select is(pg_temp.campos($$ select plataforma_abrir_chamado(ana, ipe, 'MUDANCA', 'CONFIGURACOES', 'Mudar o fuso', 'Quero o de Manaus.') from ids, c $$),
  '["tipo"]', 'PI-04: o Abrir chamado não abre pedido de mudança');
select is(pg_temp.campos($$ select plataforma_pedir_mudanca(ana, ipe, 'fuso', 'Mudar: Fuso do condomínio', 'Horário de Brasília', 'Quero o de Manaus.') from ids, c $$),
  '["parte"]', 'PI-04: a parte é um código');
select is(pg_temp.campos($$ select plataforma_pedir_mudanca(ana, ipe, 'FUSO', 'Mudar: Fuso do condomínio', '  ', 'Quero o de Manaus.') from ids, c $$),
  '["hoje"]', 'PI-04: o pedido diz como está hoje');
select is(pg_temp.campos($$ select plataforma_pedir_mudanca(ana, ipe, 'FUSO', 'Mudar: Fuso do condomínio', 'Horário de Brasília', ' ') from ids, c $$),
  '["texto"]', 'PI-04: o pedido diz o que precisa');

create temp table ch as select
  (plataforma_pedir_mudanca(gil, ipe, 'FUSO', 'Mudar: Fuso do condomínio', 'Horário de Brasília',
     'Mudar para o horário de Manaus: os prazos estão contando uma hora adiantados.') ->> 'id')::uuid as fuso
  from ids, c;
select is((select tipo || ' ' || area || ' ' || mudanca_parte || ' ' || mudanca_hoje from chamados, ch where id = fuso),
  'MUDANCA CONFIGURACOES FUSO Horário de Brasília', 'PI-04: o chamado guarda o tipo, a parte e o valor de hoje (decisão B)');
select is((select texto from mensagens_chamado, ch where chamado_id = fuso), 'Mudar para o horário de Manaus: os prazos estão contando uma hora adiantados.',
  'PI-20: o que precisa vira a primeira mensagem');
select ok(exists (select 1 from historico h, ch where h.entidade_id = fuso::text and h.acao = 'chamado.aberto' and h.dados ->> 'parte' = 'FUSO'),
  'PI-20: o histórico diz a parte pedida');

-- Decisão B: um pedido aberto por parte, visto por todos do condomínio.
select is(pg_temp.motivo($$ select plataforma_pedir_mudanca(ana, ipe, 'FUSO', 'Mudar: Fuso do condomínio', 'Horário de Brasília', 'De novo.') from ids, c $$),
  'MUDANCA_JA_PEDIDA', 'PI-04: a mesma parte não se pede de novo enquanto o pedido está aberto');
select lives_ok($$ select plataforma_pedir_mudanca(ana, ipe, 'ETAPAS_PEDIDOS', 'Mudar: Etapas dos pedidos', '6 etapas ativas', 'Tirar a etapa Orçamento.') from ids, c $$,
  'PI-04: outra parte pode ser pedida');
select is((select jsonb_agg(x ->> 'parte' order by x ->> 'parte') from ids, c, jsonb_array_elements(plataforma_mudancas_pedidas(ana, ipe)) x),
  '["ETAPAS_PEDIDOS", "FUSO"]', 'PI-04: a Configuração sabe o que está pedido');
select is((select jsonb_agg((x ->> 'ver')::boolean order by x ->> 'parte') from ids, c, jsonb_array_elements(plataforma_mudancas_pedidas(gil, ipe)) x),
  '[false, true]', 'PI-20: todos veem que a parte foi pedida; abre o chamado só quem pode');
select is((select jsonb_array_length(plataforma_mudancas_pedidas(davi, jatoba)) from ids, c), 0, 'cada condomínio só vê os seus');

-- Decisão C: o resumo leva a parte e o valor de hoje ao Console e à Plataforma.
select is((select x ->> 'parte' || ' · ' || (x ->> 'hoje') from ids, jsonb_array_elements(console_chamados(sup, 'ABERTOS')) x, ch where x ->> 'id' = fuso::text),
  'FUSO · Horário de Brasília', 'PI-20: a fila do Console tem a parte e o valor de hoje');
select is((select plataforma_chamado(gil, ipe, fuso) ->> 'tipo' from ids, c, ch), 'MUDANCA', 'PI-20: quem pediu vê o chamado com o tipo novo');
select plataforma_abrir_chamado(ana, ipe, 'DUVIDA', 'COMUNICADOS', 'Como mudar o horário?', 'Quero mudar o horário sem envio.') from ids, c;
select ok(not ((select x from ids, c, jsonb_array_elements(plataforma_chamados(ana, ipe) -> 'itens') x where x ->> 'tipo' = 'DUVIDA' limit 1) ? 'parte'),
  'PI-20: os outros tipos seguem sem parte');

-- Resolvido, a parte pode ser pedida de novo.
select console_atualizar_chamado(sup, ipe, fuso, pg_temp.vch(fuso), 'RESOLVIDO', sup) from ids, c, ch;
select is((select jsonb_array_length(plataforma_mudancas_pedidas(ana, ipe)) from ids, c), 1, 'PI-04: resolvido, sai das mudanças pedidas');
select lives_ok($$ select plataforma_pedir_mudanca(ana, ipe, 'FUSO', 'Mudar: Fuso do condomínio', 'Horário de Manaus', 'Voltar para Brasília.') from ids, c $$,
  'PI-04: depois de resolvido, pede-se de novo');

-- Decisão D: a frase nova da linha do tempo.
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(ana, ipe, 'PESSOAS', null) -> 'eventos') e
                  where e ->> 'titulo' = 'Síndica Ana assume a sindicatura'), 'CT-03: a linha do tempo diz "assume a sindicatura"');

select * from finish();
rollback;

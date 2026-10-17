-- Passos 6 e 7 (F6.1, F6.2, F7.1, F7.2): o banco confere os prazos sozinho e avisa quem
-- precisa saber. Retorno vencido avisa o responsável, sobe para o síndico e depois para o
-- substituto (AT-08, AT-09); pedido sem responsável e pendência parada também avisam; ninguém
-- recebe o mesmo aviso duas vezes. O início do dia e os indicadores (TR-01, TR-03, TR-07)
-- saem do histórico. O relógio é adiantado com ajustar_relogio, a partir de T0.
begin;
select plan(73);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Carla') as carla,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['RESPONDER']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, carla, 'Carla', 'Conselho', array['ACOMPANHAR']) as v_carla,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Zelador', array['ATUALIZAR']) as v_edu
  from ids, c;

create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal
  from c;

create function pg_temp.v(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vc() returns integer language sql as $$
  select cc.versao from configuracao_condominio cc, c where cc.condominio_id = c.ipe $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.avisos(p_pedido uuid, p_tipo text) returns text[] language sql as $$
  select coalesce(array_agg(p.nome order by p.nome), '{}') from avisos a join pessoas p on p.id = a.pessoa_id
   where a.pedido_id = p_pedido and a.tipo = p_tipo $$;
-- O pg_cron chama a conferência numa transação nova, sem ninguém no contexto.
create function pg_temp.verificar() returns integer language sql as $$ select limpar_contexto(); select verificar_prazos() $$;

-- Regras de aviso (F6.2).
select is((select (plataforma_configuracoes(ana, ipe) -> 'avisos') - 'substitutosPossiveis'::text from ids, c),
  '{"sindicoHoras": 2, "substitutoHoras": 8, "substitutoId": null, "semResponsavelHoras": 4, "pendenciaDias": 3}'::jsonb,
  'as regras de aviso começam com os tempos sugeridos e sem substituto');
select is((select jsonb_path_query_array(plataforma_configuracoes(ana, ipe), '$.avisos.substitutosPossiveis[*].nome') from ids, c),
  '["Bruna", "Carla", "Edu"]'::jsonb, 'o substituto é escolhido entre as pessoas autorizadas');
select throws_ok($$ select plataforma_definir_avisos(carla, ipe, pg_temp.vc(), 2, 8, null, 4, 3) from ids, c $$, 'TC401', null,
  'quem não edita a configuração não muda as regras de aviso');
select is(pg_temp.campos($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 0, 8, null, 4, 3) from ids, c $$), '["sindicoHoras"]'::jsonb,
  'o síndico é avisado de 1 a 240 horas depois');
select is(pg_temp.campos($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 4, 4, null, 4, 3) from ids, c $$), '["substitutoHoras"]'::jsonb,
  'o substituto é avisado depois do síndico');
select is(pg_temp.campos($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 2, 8, null, 0, 3) from ids, c $$),
  '["semResponsavelHoras"]'::jsonb, 'pedido sem responsável: de 1 a 240 horas');
select is(pg_temp.campos($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 2, 8, null, 4, 61) from ids, c $$),
  '["pendenciaDias"]'::jsonb, 'pendência parada: de 1 a 60 dias');
select is(pg_temp.campos($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 2, 8, v_ana, 4, 3) from ids, c, vs $$), '["substitutoId"]'::jsonb,
  'o substituto é uma pessoa autorizada, não o síndico');
select throws_ok($$ select plataforma_definir_avisos(ana, ipe, pg_temp.vc() - 1, 2, 8, v_edu, 4, 3) from ids, c, vs $$, 'TC409', null,
  'AT-24: edição simultânea das regras não passa por cima');
select is((select plataforma_definir_avisos(ana, ipe, pg_temp.vc(), 2, 8, v_edu, 4, 3) from ids, c, vs), (select pg_temp.vc()),
  'a síndica escolhe o Edu como substituto');
select is((select plataforma_configuracoes(ana, ipe) -> 'avisos' ->> 'substitutoId' from ids, c), (select v_edu::text from vs),
  'o substituto aparece nas configurações');
select is((select dados from historico, c where condominio_id = ipe and acao = 'regras_aviso.alteradas'),
  '{"sindico_horas": 2, "substituto_horas": 8, "com_substituto": true, "sem_responsavel_horas": 4, "pendencia_dias": 3}'::jsonb,
  'a mudança vai para o histórico, sem nome');

-- T0: o pedido 2 nasce sem responsável. Uma hora depois, o pedido 1 vai para a Bruna.
create temp table p as select
  (plataforma_registrar_pedido(ana, ipe, null, null, 'Portão da garagem', manutencao, normal, 'Portão não fecha',
     'O portão da garagem ficou aberto.', 'OBSERVACAO', false, null) ->> 'id')::uuid as p2,
  null::uuid as p1, null::uuid as p3, app_now() as t0
  from ids, c, cfg;
select is((select responsavel_id from pedidos, p where id = p2), null, 'o pedido 2 nasce sem responsável: a fila ainda não tem quem atende');
select plataforma_definir_atendimento(ana, ipe, pg_temp.vc(),
         jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_bruna, 'disponivel', true)),
         v_bruna)
  from ids, c, vs;
select ajustar_relogio('1 hour');
update p set p1 = (plataforma_registrar_pedido(ana, ipe, null, null, 'Banheiro do salão', manutencao, normal, 'Vazamento no salão',
  'Pinga água da pia do salão.', 'OBSERVACAO', false, v_bruna) ->> 'id')::uuid from ids, c, cfg, vs;
select is((select proximo_retorno from pedidos, p where id = p1), (select t0 + interval '25 hours' from p), 'o pedido 1 promete retorno em T0+25h');

select is(pg_temp.verificar(), 0, 'nada vencido, nenhum aviso');

-- Sem responsável há 4 horas (F6.2): avisa a síndica, uma vez só.
select ajustar_relogio('5 hours');
select is(pg_temp.verificar(), 1, 'T0+5h: um aviso');
select is(pg_temp.avisos(p2, 'SEM_RESPONSAVEL'), array['Síndica Ana'], 'pedido sem responsável há 4 horas avisa a síndica') from p;
select is(pg_temp.verificar(), 0, 'conferir de novo não repete o aviso');
select is((select referencia from avisos, p where pedido_id = p2 and tipo = 'SEM_RESPONSAVEL'), (select t0 from p),
  'o aviso conta desde que o pedido ficou sem responsável');
select is((select count(*)::int from historico, p where entidade_id = p2::text and acao = 'pedido.aviso'
             and dados = '{"tipo": "SEM_RESPONSAVEL", "para": "SINDICO"}'), 1, 'o aviso vai para o histórico do pedido');

-- Retorno vencido (F6.1, AT-08): sem responsável, a síndica; com responsável, ele.
select ajustar_relogio('24 hours 30 minutes');
select is(pg_temp.verificar(), 1, 'T0+24h30: só o pedido 2 venceu');
select is(pg_temp.avisos(p2, 'RETORNO_VENCIDO'), array['Síndica Ana'], 'retorno vencido sem responsável avisa a síndica') from p;
select ajustar_relogio('25 hours 30 minutes');
select is(pg_temp.verificar(), 1, 'T0+25h30: o pedido 1 venceu');
select is(pg_temp.avisos(p1, 'RETORNO_VENCIDO'), array['Bruna'], 'retorno vencido avisa a responsável na hora') from p;
select is(pg_temp.avisos(p1, 'ESCALADO_SINDICO'), '{}'::text[], 'a síndica ainda não') from p;
select is((select dados from historico, p where entidade_id = p1::text and acao = 'pedido.retorno_venceu'),
  (select jsonb_build_object('de', t0 + interval '25 hours') from p), 'o vencimento vai para o histórico, com o retorno prometido');
select is((select autor_tipo::text from historico, p where entidade_id = p1::text and acao = 'pedido.retorno_venceu'), 'SISTEMA',
  'quem registra o vencimento é o sistema');
select is((select plataforma_pedido_prazo(ana, ipe, p1) - 'horas' from ids, c, p),
  (select jsonb_build_object('vencido', true, 'desde', t0 + interval '25 hours',
     'avisos', jsonb_build_array(jsonb_build_object('tipo', 'RETORNO_VENCIDO', 'em', t0 + interval '25 hours 30 minutes', 'nomes', '["Bruna"]'::jsonb)),
     'proximo', jsonb_build_object('tipo', 'ESCALADO_SINDICO', 'em', t0 + interval '27 hours')) from p),
  'AT-09: o pedido mostra desde quando venceu, quem já sabe e quando a síndica será avisada');
select is((select (plataforma_pedido_prazo(ana, ipe, p1) ->> 'horas')::numeric from ids, c, p), 0.5, 'vencido há meia hora');

-- O início do dia (F7.1).
create temp table ini as select plataforma_painel(ana, ipe) -> 'pedidos' as r from ids, c;
select is((select (r ->> 'retornoVencido')::int from ini), 2, 'dois retornos vencidos');
select is((select (r ->> 'vencidoMaisAntigo')::timestamptz from ini), (select t0 + interval '24 hours' from p), 'o vencido mais antigo é o do pedido 2');
select is((select r -> 'vencidoMaisAntigoEscalado' from ini), 'false'::jsonb, 'e ainda não subiu para a síndica');
select is((select r -> 'vencemHoje' from ini) is not null and (select r -> 'pendenciasParadas' from ini) = '0', true,
  'o início mostra o que vence hoje e as pendências paradas');
select is((select (plataforma_painel(ana, ipe) ->> 'avisosNaoVistos')::int from ids, c), 2, 'a síndica tem dois avisos sem ver');
select is((select (plataforma_painel(bruna, ipe) ->> 'avisosNaoVistos')::int from ids, c), 1, 'a Bruna tem um');
select ok((select plataforma_painel(ana, ipe) ? 'mesFechado' from ids, c), 'o início mostra o mês fechado');
select ok(not (select plataforma_painel(davi, jatoba) ? 'avisosNaoVistos' and (plataforma_painel(davi, jatoba) ->> 'avisosNaoVistos')::int > 0 from ids, c),
  'PT-01: o Jatobá não tem avisos do Ipê');

-- Sobe para a síndica 2 horas depois (AT-09).
select ajustar_relogio('27 hours 30 minutes');
select is(pg_temp.verificar(), 1, 'T0+27h30: sobe o pedido 1');
select is(pg_temp.avisos(p1, 'ESCALADO_SINDICO'), array['Síndica Ana'], 'continua vencido 2 horas depois: avisa a síndica') from p;
select is((select plataforma_painel(ana, ipe) -> 'pedidos' -> 'vencidoMaisAntigoEscalado' from ids, c), 'false'::jsonb,
  'o mais antigo (pedido 2) a síndica já recebeu direto, não por subida');
select is((select plataforma_pedido_prazo(ana, ipe, p1) -> 'proximo' from ids, c, p),
  (select jsonb_build_object('tipo', 'ESCALADO_SUBSTITUTO', 'em', t0 + interval '33 hours') from p), 'o próximo é o substituto');

-- E para o substituto 8 horas depois. Sem responsável, o pedido 2 vai da síndica para o substituto.
select ajustar_relogio('32 hours 30 minutes');
select is(pg_temp.verificar(), 1, 'T0+32h30: o pedido 2 chega ao substituto');
select is(pg_temp.avisos(p2, 'ESCALADO_SUBSTITUTO'), array['Edu'], 'pedido 2: o substituto é avisado') from p;
select is(pg_temp.avisos(p2, 'ESCALADO_SINDICO'), '{}'::text[], 'pedido 2: não repete para a síndica, que já sabia') from p;
select ajustar_relogio('33 hours 30 minutes');
select is(pg_temp.verificar(), 1, 'T0+33h30: o pedido 1 chega ao substituto');
select is(pg_temp.avisos(p1, 'ESCALADO_SUBSTITUTO'), array['Edu'], 'pedido 1: o substituto é avisado') from p;
select is(pg_temp.verificar(), 0, 'nada se repete');
select is((select plataforma_pedido_prazo(ana, ipe, p1) -> 'proximo' from ids, c, p), 'null'::jsonb, 'não há mais ninguém para avisar');
select is((select count(*)::int from avisos, c where condominio_id = jatoba), 0, 'PT-01: nenhum aviso no Jatobá');

-- Os avisos da pessoa (F6.1).
select is((select jsonb_path_query_array(plataforma_avisos(ana, ipe), '$.itens[*].tipo') from ids, c),
  '["ESCALADO_SINDICO", "RETORNO_VENCIDO", "SEM_RESPONSAVEL"]'::jsonb, 'a síndica vê os avisos dela, os mais novos primeiro');
select is((select plataforma_avisos(ana, ipe) -> 'itens' -> 0 ->> 'responsavel' from ids, c), 'Bruna', 'cada aviso diz o responsável');
select is((select plataforma_marcar_avisos(ana, ipe, array[(select id from avisos, p where pedido_id = p2 and tipo = 'SEM_RESPONSAVEL')]) from ids, c), 1,
  'marca um aviso como visto');
select is((select plataforma_avisos(ana, ipe) ->> 'naoVistos' from ids, c), '2', 'ficam dois sem ver');
select is((select plataforma_marcar_avisos(ana, ipe, array[(select id from avisos, p where pedido_id = p1 and tipo = 'RETORNO_VENCIDO')]) from ids, c), 0,
  'não marca o aviso de outra pessoa');
select is((select plataforma_marcar_avisos(ana, ipe, null) from ids, c), 2, 'marca todos');
select is((select jsonb_path_query_array(plataforma_avisos(ana, ipe), '$.itens[*].vistoEm') @? '$[*] ? (@ == null)' from ids, c), false,
  'todos vistos');
select ok((select retorno_vencido(x) from pedidos x, p where x.id = p1), 'ver o aviso não resolve o pedido');
select throws_ok($$ update avisos set visto_em = app_now() where visto_em is not null $$, 'TC422', null, 'o visto não muda de novo');
select throws_ok($$ delete from avisos $$, null, null, 'aviso não se apaga');

-- O retorno acaba com o vencimento (AT-08).
select lives_ok($$ select plataforma_registrar_retorno(bruna, ipe, p1, pg_temp.v(p1), 'TELEFONE', 'Avisei que o encanador vem amanhã.') from ids, c, p $$,
  'a Bruna dá o retorno');
select is((select plataforma_pedido_prazo(ana, ipe, p1) from ids, c, p), '{"vencido": false}'::jsonb, 'o pedido 1 deixa de estar vencido');
select lives_ok($$ select plataforma_registrar_retorno(ana, ipe, p2, pg_temp.v(p2), 'MENSAGEM', 'Já chamamos o técnico do portão.') from ids, c, p $$,
  'a síndica dá o retorno do pedido 2, também atrasado');
update p set p3 = (plataforma_registrar_pedido(ana, ipe, null, null, 'Hall', manutencao, normal, 'Lâmpada queimada',
  'A lâmpada do hall apagou.', 'OBSERVACAO', false, v_ana) ->> 'id')::uuid from ids, c, cfg, vs;
select lives_ok($$ select plataforma_registrar_retorno(ana, ipe, p3, pg_temp.v(p3), 'MENSAGEM', 'Trocamos hoje à tarde.') from ids, c, p $$,
  'e o do pedido 3, no prazo');

-- Indicadores (F7.2, TR-01, TR-03).
create temp table ind as select plataforma_indicadores(ana, ipe, 'TRES_MESES') -> 'atual' as r from ids, c;
select is((select r -> 'retornos' from ind), '{"total": 3, "noPrazo": 1, "porcentagem": 33}'::jsonb,
  'TR-01: um de três retornos no prazo; o vencido que teve retorno conta uma vez só');
select is((select (r ->> 'primeiroRetornoHoras')::numeric from ind), 22.0, 'TR-03: o primeiro retorno leva 22 horas em média');
select is((select (r ->> 'registrados')::int from ind), 3, 'três pedidos registrados');
select is((select jsonb_path_query_first(r, '$.porCategoria[*] ? (@.categoriaId == $id).retornos', jsonb_build_object('id', manutencao)) from ind, cfg),
  '3'::jsonb, 'por categoria');
select is((select plataforma_indicadores(davi, jatoba, 'MES_PASSADO') -> 'atual' -> 'retornos' -> 'porcentagem' from ids, c), 'null'::jsonb,
  'TR-07: sem nenhum caso, "sem dados", nunca zero');
select is(pg_temp.campos($$ select plataforma_indicadores(ana, ipe, 'SEMPRE') from ids, c $$), '["periodo"]'::jsonb, 'período conhecido');
select throws_ok($$ select plataforma_indicadores(davi, ipe, 'ESTE_MES') from ids, c $$, 'TC401', null, 'PT-01: outro síndico não vê os números do Ipê');

-- Pendência parada há 3 dias: avisa quem cuida dela.
select plataforma_abrir_pendencia(ana, ipe, p3, pg_temp.v(p3), 'MORADOR', 'Aguardando o morador liberar o acesso', v_bruna) from ids, c, p, vs;
select ajustar_relogio('106 hours 30 minutes');
select ok(pg_temp.verificar() >= 1, 'T0+106h30: há avisos');
select is(pg_temp.avisos(p3, 'PENDENCIA_PARADA'), array['Bruna'], 'pendência parada há 3 dias avisa quem cuida dela') from p;
select is((select plataforma_painel(ana, ipe) -> 'pedidos' -> 'pendenciasParadas' from ids, c), '1'::jsonb, 'o início conta a pendência parada');

select * from finish();
rollback;

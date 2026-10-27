-- Planos e cobrança dos clientes (peças C3 e C4; PI-03, CF-11, NG-01, PI-16, PI-19, NG-06,
-- PI-07, PI-08, NG-21): conjunto contratado e liberado em separado, teste com data, suspensão
-- que mantém a consulta, plano sem preço fixo, cobrança por competência, recebimento a conferir,
-- ajuste com motivo e atraso que só avisa.
begin;
select plan(73);

-- Aqui os condomínios nascem como cliente novo: só a base liberada.
select set_config('teste.conjuntos_so_base', 'on', true);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Sueli', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Goiânia', 'GO', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, fin, 'FINANCEIRO'),
       console_atribuir(adm, ipe, sup, 'SUPORTE'), teste.vincular(ana, ipe)
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje,
  date_trunc('month', (app_now() at time zone 'America/Sao_Paulo'))::date as mes;

create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcc(p_conjunto text) returns integer language sql as $$
  select versao from conjuntos_cliente where condominio_id = (select ipe from c) and conjunto = p_conjunto $$;
create function pg_temp.estado(p_conjunto text) returns text language sql as $$
  select estado from conjuntos_cliente where condominio_id = (select ipe from c) and conjunto = p_conjunto $$;
create function pg_temp.marcar(p_pessoa uuid) returns jsonb language sql as $$
  select plataforma_marcar_compromisso(p_pessoa, (select ipe from c), 'REUNIAO', 'Reunião do conselho', (select hoje + 1 from d),
         '19:00', '20:00', 'NENHUM', null, null, '{}', null, null, null, 'PLANEJADO', null, null, null, null, false) $$;
create function pg_temp.agenda(p_pessoa uuid) returns jsonb language sql as $$
  select plataforma_agenda(p_pessoa, (select ipe from c), (select hoje from d), (select hoje + 7 from d)) $$;

-- Cliente novo: só a Base Atendimento (NG-01).
select is((select count(*)::int from conjuntos_cliente where condominio_id = (select ipe from c) and estado = 'NAO_LIBERADO'), 4,
  'NG-01: cliente novo tem os quatro conjuntos fora do plano');
select is((select plataforma_conjuntos(ana, ipe) from ids, c),
  '{"ATENDIMENTO": "COMPLETO", "AGENDA": "FORA", "MANUTENCAO": "FORA", "VIDA": "FORA", "COMUNICACAO_AMPLIADA": "FORA"}'::jsonb,
  'NG-01: a base vem com todo plano; o resto fica fora');
select is(pg_temp.motivo($$ select pg_temp.agenda(ana) from ids $$), 'CONJUNTO_FORA_DO_PLANO',
  'PI-03: fora do plano, a agenda é recusada no banco, não só escondida');
select lives_ok($$ select plataforma_painel(ana, ipe) from ids, c $$, 'NG-01: o painel da base continua');
select is(pg_temp.motivo($$ select plataforma_definir_mural_email(ana, ipe,
            (select versao from configuracao_condominio where condominio_id = ipe), true, '{}', false, null, true, true) from ids, c $$),
  'CONJUNTO_FORA_DO_PLANO', 'PI-03: o mural online não liga sem a comunicação ampliada');
select ok((select 'CONJUNTO_A_LIBERAR' <> all (situacoes) from ids, console_carteira(adm) where nome = 'Residencial Ipê'),
  'nada contratado, nada a liberar na carteira');

-- Contratado e liberado são coisas separadas (CF-11, PI-03).
select is(pg_temp.motivo($$ select console_liberar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'CT-1', 'Começo da agenda') from ids, c $$),
  'NAO_CONTRATADO', 'CF-11: só se libera o que está contratado');
select throws_ok($$ select console_contratar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), true, 'CT-1', null) from ids, c $$,
  'TC401', null, 'PI-10: implantação não muda o contrato');
select is(pg_temp.motivo($$ select console_contratar_conjunto(adm, ipe, 'ATENDIMENTO', 1, true, 'CT-1', null) from ids, c $$),
  'CONJUNTO_BASE', 'a base não se contrata à parte');
select is((teste.erro($$ select console_contratar_conjunto(adm, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), true, ' ', null) from ids, c $$))
  -> 'detalhe' -> 'campos', '["referencia"]'::jsonb, 'CF-11: contratar pede o contrato ou aditivo');
select is((select console_contratar_conjunto(adm, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), true, 'Aditivo 2', null) ->> 'contratado' from ids, c),
  'true', 'CF-11: administração registra o contratado');
select is(pg_temp.estado('AGENDA'), 'NAO_LIBERADO', 'CF-11: contratar não libera');
select ok((select 'CONJUNTO_A_LIBERAR' = any (situacoes) from ids, console_carteira(impl) where nome = 'Residencial Ipê'),
  'contratado e não liberado aparece na carteira');
select is(pg_temp.motivo($$ select pg_temp.agenda(ana) from ids $$), 'CONJUNTO_FORA_DO_PLANO', 'contratado ainda não liberado continua fora');
select is((teste.erro($$ select console_liberar_conjunto(impl, ipe, 'AGENDA', 1, 'Aditivo 2', 'Começo') from ids, c $$)) ->> 'codigo',
  'TC409', 'AT-24: liberar com a versão velha é conflito');
select throws_ok($$ select console_liberar_conjunto(sup, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'Aditivo 2', 'Começo') from ids, c $$,
  'TC401', null, 'suporte não libera conjunto');
select is((teste.erro($$ select console_liberar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'Aditivo 2', '') from ids, c $$))
  -> 'detalhe' -> 'campos', '["motivo"]'::jsonb, 'PI-03: liberar pede o motivo');
select is((select console_liberar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'Aditivo 2', 'Começo da agenda') ->> 'estado' from ids, c),
  'LIBERADO', 'PI-03: implantação libera o contratado');
select ok((select liberado_por = (select impl from ids) and liberacao_referencia = 'Aditivo 2' and liberado_em is not null
             from conjuntos_cliente where condominio_id = (select ipe from c) and conjunto = 'AGENDA'),
  'PI-03: a liberação guarda quem, quando e a referência');
select is((select count(*)::int from historico where acao = 'conjunto.liberado' and autor_id = (select impl from ids)), 1,
  'PI-12: a liberação fica no histórico administrativo');
select lives_ok($$ select pg_temp.agenda(ana) from ids $$, 'PI-03: liberada, a síndica usa a agenda');
select lives_ok($$ select pg_temp.marcar(ana) from ids $$, 'liberada, a síndica marca compromisso');
select is(pg_temp.motivo($$ select console_liberar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'Aditivo 2', 'De novo') from ids, c $$),
  'JA_LIBERADO', 'liberar de novo é recusado');
select is((select (console_plano(impl, ipe) -> 'conjuntos' -> 1) ->> 'telas' from ids, c) is not null, true,
  'PI-19: a prévia diz as telas que o síndico passa a ter');

-- Suspender mantém a consulta (PI-16, decisão C).
select is((teste.erro($$ select console_suspender_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'X', 'Pedido do síndico') from ids, c $$))
  -> 'detalhe' -> 'campos', '["porque"]'::jsonb, 'suspender pede o porquê');
select is((select console_suspender_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'PEDIDO_CLIENTE', 'Pedido do síndico') ->> 'estado' from ids, c),
  'SUSPENSO', 'PI-16: implantação suspende');
select is((select plataforma_conjuntos(ana, ipe) ->> 'AGENDA' from ids, c), 'CONSULTA', 'PI-16: suspenso fica em consulta');
select lives_ok($$ select pg_temp.agenda(ana) from ids $$, 'PI-16: suspenso, o histórico continua consultável');
select is(pg_temp.motivo($$ select pg_temp.marcar(ana) from ids $$), 'CONJUNTO_SUSPENSO', 'PI-16: suspenso não cria nada novo');
select is((select count(*)::int from compromissos where condominio_id = (select ipe from c)), 1, 'PI-16: nada do que existia se perdeu');
select is((select console_liberar_conjunto(impl, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), 'Aditivo 2', 'Volta') ->> 'estado' from ids, c),
  'LIBERADO', 'liberar de novo volta tudo');

-- Tirar do contrato o que está liberado suspende, sem apagar (PI-16).
select is((select console_contratar_conjunto(adm, ipe, 'AGENDA', pg_temp.vcc('AGENDA'), false, null, 'Fim do aditivo') ->> 'estado' from ids, c),
  'SUSPENSO', 'PI-16: tirar do contrato suspende o que estava liberado');
select is((select suspensao_porque from conjuntos_cliente where condominio_id = (select ipe from c) and conjunto = 'AGENDA'),
  'CONTRATO_ENCERRADO', 'a suspensão diz o porquê');

-- Teste com data para acabar (NG-06, decisão B): sem contrato, até 30 dias.
select is((teste.erro($$ select console_testar_conjunto(impl, ipe, 'MANUTENCAO', pg_temp.vcc('MANUTENCAO'), hoje + 31, 'Mostrar') from ids, c, d $$))
  -> 'detalhe' -> 'campos', '["ate"]'::jsonb, 'NG-06: teste de mais de 30 dias é recusado');
select is((teste.erro($$ select console_testar_conjunto(impl, ipe, 'MANUTENCAO', pg_temp.vcc('MANUTENCAO'), hoje + 7, '') from ids, c, d $$))
  -> 'detalhe' -> 'campos', '["motivo"]'::jsonb, 'NG-06: teste pede o motivo');
select is((select console_testar_conjunto(impl, ipe, 'MANUTENCAO', pg_temp.vcc('MANUTENCAO'), hoje + 2, 'Mostrar ao conselho') ->> 'estado'
             from ids, c, d), 'TESTE', 'NG-06: liberado para teste sem contrato');
select is((select plataforma_conjuntos(ana, ipe) ->> 'MANUTENCAO' from ids, c), 'COMPLETO', 'NG-06: em teste a síndica usa tudo');
select ok((select 'TESTE_TERMINANDO' = any (situacoes) from ids, console_carteira(impl) where nome = 'Residencial Ipê'),
  'teste perto do fim aparece na carteira');
select ajustar_relogio('3 days');
select is((select plataforma_conjuntos(ana, ipe) ->> 'MANUTENCAO' from ids, c), 'CONSULTA',
  'NG-06: passou a data, o teste acaba sozinho e fica a consulta');
select ajustar_relogio('0');
select is((select console_suspender_conjunto(impl, ipe, 'MANUTENCAO', pg_temp.vcc('MANUTENCAO'), 'TESTE_ENCERRADO', 'Conselho não quis') ->> 'estado'
             from ids, c), 'SUSPENSO', 'encerrar o teste antes da data');

-- Plano sem preço fixo (NG-01; preços em decisão).
select throws_ok($$ select console_salvar_plano(impl, ipe, null, 'Fundador', 1, 40, null, 'MENSAL', 10, null, true, null, mes) from ids, c, d $$,
  'TC401', null, 'PI-10: implantação não mexe no plano');
select is((teste.erro($$ select console_salvar_plano(adm, ipe, null, 'Fundador', 50, 40, null, 'MENSAL', 10, null, true, null, mes) from ids, c, d $$))
  -> 'detalhe' -> 'campos', '["unidadesDe", "unidadesAte"]'::jsonb, 'faixa de unidades que não fecha é recusada');
select is((teste.erro($$ select console_salvar_plano(adm, ipe, null, 'Fundador', 1, 40, 0, 'MENSAL', 10, null, true, null, mes) from ids, c, d $$))
  -> 'detalhe' -> 'campos', '["valor"]'::jsonb, 'valor zero não existe: vazio é valor a definir');
select is((select console_salvar_plano(adm, ipe, null, 'Fundador', 1, 40, null, 'MENSAL', 10, null, true, null, mes) ->> 'valor' from ids, c, d),
  null, 'o plano nasce com valor a definir');
select ok((select 'PLANO_SEM_VALOR' = any (situacoes) from ids, console_carteira(fin) where nome = 'Residencial Ipê'),
  'plano sem valor aparece para o financeiro');
select ok((select 'PLANO_SEM_VALOR' <> all (situacoes) from ids, console_carteira(sup) where nome = 'Residencial Ipê'),
  'suporte não vê situação de pagamento');
select is((select console_plano(sup, ipe) -> 'plano' ? 'valor' from ids, c), false, 'suporte vê o plano sem o valor');
select ok((select console_plano(sup, ipe) -> 'cobrancas' from ids, c) is null, 'suporte não vê as cobranças');

-- Cobrança por competência aberta por botão (PI-07, decisão D).
create temp table comp as select console_abrir_competencia(fin, mes) as r from ids, d;
select is((select r from comp), '{"criadas": 1, "jaAbertas": 0, "semPlano": 0, "encerrados": 0}'::jsonb, 'PI-07: abrir a competência cria a cobrança do mês');
select is((select console_abrir_competencia(fin, mes) ->> 'jaAbertas' from ids, d), '1', 'PI-07: abrir de novo não duplica');
create temp table cb as select id as mensal from cobrancas where condominio_id = (select ipe from c) and tipo = 'MENSALIDADE';
select is((select console_cobranca(fin, ipe, mensal) ->> 'situacao' from ids, c, cb), 'A_DEFINIR', 'sem valor, a cobrança fica a definir');
select is(pg_temp.motivo($$ select console_ajustar_cobranca(fin, ipe, mensal, 'DESCONTO', 1000, 'Fundador') from ids, c, cb $$),
  'VALOR_A_DEFINIR', 'não se ajusta o que não tem valor');
select is((select console_definir_valor_cobranca(fin, ipe, mensal, 12900, 'Preço de fundador combinado') ->> 'devido' from ids, c, cb),
  '12900', 'o valor a definir passa a existir com motivo');
select is(pg_temp.motivo($$ select console_definir_valor_cobranca(fin, ipe, mensal, 20000, 'Outro') from ids, c, cb $$),
  'VALOR_DEFINIDO', 'PI-07: definido, o valor só muda por ajuste');
select throws_ok($$ update cobrancas set valor_centavos = 1 where id = (select mensal from cb) $$, null, null,
  'PI-07: nem direto no banco a cobrança é editada');

-- Recebimento a conferir, referência única, conferência separada (PI-07).
select throws_ok($$ select console_registrar_recebimento(sup, ipe, mensal, 12900, hoje, 'PIX', 'E1234-ABC') from ids, c, cb, d $$,
  'TC401', null, 'suporte não registra pagamento');
create temp table rc as select (console_registrar_recebimento(fin, ipe, mensal, 12000, hoje, 'PIX', 'E1234-ABC') ->> 'id')::uuid as r1
  from ids, c, cb, d;
select is((select estado from recebimentos, rc where id = r1), 'A_CONFERIR', 'PI-07: o que entrou fica a conferir');
select is((select console_cobranca(fin, ipe, mensal) ->> 'situacao' from ids, c, cb), 'ABERTA',
  'PI-07: a conferir ainda não conta como pago');
select is(pg_temp.motivo($$ select console_registrar_recebimento(fin, ipe, mensal, 12000, hoje, 'PIX', ' e1234-abc ') from ids, c, cb, d $$),
  'REFERENCIA_REPETIDA', 'PI-07: a mesma referência não entra duas vezes');
select is((teste.erro($$ select console_registrar_recebimento(fin, ipe, mensal, 12000, hoje + 1, 'PIX', 'E9') from ids, c, cb, d $$))
  -> 'detalhe' -> 'campos', '["recebidoEm"]'::jsonb, 'recebido no futuro é recusado');
select is((select console_conferir_recebimento(fin, ipe, r1, 1) -> 'cobranca' ->> 'situacao' from ids, c, rc), 'PARCIAL',
  'PI-07: conferido, conta; faltam 9 reais');
select is(pg_temp.motivo($$ select console_conferir_recebimento(fin, ipe, r1, 2) from ids, c, rc $$), 'JA_CONFIRMADO',
  'confirmar de novo é recusado');
select is((select console_ajustar_cobranca(fin, ipe, mensal, 'DESCONTO', 900, 'Arredondamento combinado') ->> 'situacao' from ids, c, cb),
  'QUITADA', 'PI-07: ajuste com motivo, no lugar de editar o valor');
select is((select count(*)::int from ajustes_cobranca), 1, 'o ajuste fica guardado');
select throws_ok($$ delete from ajustes_cobranca $$, null, null, 'ajuste não se apaga');

-- Recebimento sem cliente (Não identificados).
create temp table av as select (console_registrar_recebimento(fin, null, null, 5000, hoje, 'TRANSFERENCIA', 'TED-77') ->> 'id')::uuid as a1
  from ids, d;
select is((select jsonb_array_length(console_pagamentos(fin) -> 'naoIdentificados') from ids), 1, 'sem cliente, fica em não identificados');

-- Atraso só avisa (PI-08).
select console_salvar_plano(adm, ipe, (select versao from planos_cliente where condominio_id = ipe), 'Fundador', 1, 40, 12900, 'MENSAL', 10,
                            null, true, null, mes) from ids, c, d;
create temp table comp2 as select console_abrir_competencia(fin, (mes + interval '1 month')::date) as r from ids, d;
select ajustar_relogio('45 days');
select ok((select 'PAGAMENTO_EM_ATRASO' = any (situacoes) from ids, console_carteira(fin) where nome = 'Residencial Ipê'),
  'PI-08: a cobrança vencida aparece como atraso');
select lives_ok($$ select pg_temp.agenda(ana) from ids $$, 'PI-08: o atraso não bloqueia nada no condomínio');
select ajustar_relogio('0');

-- Meu plano (NG-21, decisão F): sem valores.
select ok((select not (plataforma_meu_plano(ana, ipe)::text ~ '12900|valor') from ids, c), 'NG-21: Meu plano não mostra valores');
select is((select plataforma_meu_plano(ana, ipe) -> 'plano' ->> 'nome' from ids, c), 'Fundador', 'NG-21: Meu plano mostra o nome');
select is((select plataforma_pedir_conjunto(ana, ipe, 'VIDA', 'TESTE', null) ? 'numero' from ids, c), true,
  'E.1: pedir para testar abre um chamado');
select is(pg_temp.estado('VIDA'), 'NAO_LIBERADO', 'E.1: pedir não libera nada sozinho');
select throws_ok($$ select console_pagamentos(ana) from ids $$, 'TC401', null, 'o síndico não vê Pagamentos');

select * from finish();
rollback;

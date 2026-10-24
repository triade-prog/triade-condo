-- Tabela de preços no Console (0295): semente das faixas, valor vazio nunca zero, quem vê e quem
-- edita, motivo e histórico só de inserção, a sugestão do plano (fundador só no mensal, anual
-- pela cheia, sob consulta, sem vaga) que não grava nada, a tabela que não mexe em plano
-- existente, as vagas de fundador, o Meu plano sem valores e as ações na sessão do Console.
begin;
select plan(78);

select set_config('teste.conjuntos_so_base', 'on', true);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Sueli', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Goiânia', 'GO', null) as jatoba,
  console_criar_condominio(adm, 'Torres do Cerrado', 'Brasília', 'DF', null) as cerrado,
  console_criar_condominio(adm, 'Condomínio Vazio', 'Palmas', 'TO', null) as vazio
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, fin, 'FINANCEIRO'),
       console_atribuir(adm, ipe, sup, 'SUPORTE'), teste.vincular(ana, ipe)
  from ids, c;
-- 32, 64 e 450 unidades ativas; o Vazio fica sem nenhuma.
insert into unidades (condominio_id, identificacao) select ipe, 'A' || g from c, generate_series(1, 32) g;
insert into unidades (condominio_id, identificacao) select jatoba, 'B' || g from c, generate_series(1, 64) g;
insert into unidades (condominio_id, identificacao) select cerrado, 'C' || g from c, generate_series(1, 450) g;
create temp table d as select date_trunc('month', (app_now() at time zone 'America/Sao_Paulo'))::date as mes;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.faixa(p_pessoa uuid, p_codigo text) returns jsonb language sql as $$
  select f from jsonb_array_elements(console_tabela_precos(p_pessoa) -> 'faixas') f where f ->> 'codigo' = p_codigo $$;
create function pg_temp.vf(p_codigo text) returns integer language sql as $$ select versao from faixas_preco where codigo = p_codigo $$;
create function pg_temp.vp() returns integer language sql as $$ select versao from parametros_preco $$;
create function pg_temp.sugestao(p_condominio uuid, p_ciclo text) returns jsonb language sql as $$
  select console_sugestao_plano((select adm from ids), p_condominio, p_ciclo, null) $$;
create function pg_temp.salvar(p_condominio uuid, p_tabela text, p_ciclo text, p_valor bigint) returns jsonb language sql as $$
  select console_salvar_plano_tabela((select adm from ids), p_condominio, (select versao from planos_cliente where condominio_id = p_condominio),
           'Fundador, até 40 unidades', 1, 40, p_valor, p_ciclo, 10, null, true, null, (select mes from d), p_tabela) $$;

-- Semente (decisões A, B e C).
select is((select jsonb_agg(jsonb_build_array(codigo, fundador_centavos, cheia_centavos, implantacao_centavos) order by ordem) from faixas_preco),
  '[["ATE_40", 12900, 19900, 60000], ["DE_41_A_100", 22900, 34900, 90000], ["DE_101_A_200", 34900, 54900, 140000],
    ["DE_201_A_400", 54900, 84900, 200000], ["ACIMA_DE_400", null, null, null]]'::jsonb,
  'as cinco faixas nascem com os preços aprovados; acima de 400 é sob consulta, sem valores');
select is((select jsonb_agg(jsonb_build_array(unidades_de, unidades_ate) order by ordem) from faixas_preco),
  '[[1, 40], [41, 100], [101, 200], [201, 400], [401, null]]'::jsonb, 'os limites das faixas');
select is((select array[meses_pagos_anual, parcelas_implantacao, vagas_fundador] from parametros_preco), array[11, 3, 5],
  'parâmetros: 11 meses no anual, 3 parcelas e 5 vagas de fundador');
select is((select tabela_em_uso from parametros_preco), 'FUNDADOR', 'a tabela em uso começa no fundador');
select is((select count(*)::int from vagas_fundador), 0, 'nenhum cliente atual ocupa vaga de fundador');
select is((select count(*)::int from precos_concorrentes where arquivado_em is null), 6, 'os seis preços de concorrentes conferidos');
select is((select faixas from precos_concorrentes where nome = 'SindIA'), '[{"ate": 50, "valor": 19700}, {"ate": 150, "valor": 39700}]'::jsonb,
  'concorrente por faixa guarda as faixas');
select is((select array[por_unidade_centavos, minimo_centavos]::bigint[] from precos_concorrentes where nome = 'HabitaOne' and plano = 'Profissional'),
  array[790, 29900]::bigint[], 'concorrente por unidade guarda o valor por unidade e o mínimo');
select is((select pg_temp.faixa(adm, 'ATE_40') ->> 'anual' from ids), '218900', 'o anual da cheia é 11 × o mensal');

-- Quem vê e quem edita (decisão G).
select lives_ok($$ select console_tabela_precos(fin) from ids $$, 'financeiro vê a tabela');
select is((select console_tabela_precos(adm) ->> 'podeEditar' from ids), 'true', 'administração edita a tabela');
select throws_ok($$ select console_tabela_precos(impl) from ids $$, 'TC401', null, 'implantação não vê os preços');
select throws_ok($$ select console_tabela_precos(sup) from ids $$, 'TC401', null, 'suporte não vê os preços');
select throws_ok($$ select console_tabela_precos(ana) from ids $$, 'TC401', null, 'o síndico nunca vê a tabela');
select throws_ok($$ select console_salvar_faixa_preco(impl, 'ATE_40', pg_temp.vf('ATE_40'), 12900, 19900, 60000, 'Reajuste') from ids $$,
  'TC401', null, 'implantação não edita os preços');
select throws_ok($$ select console_historico_precos(sup, null, 50) from ids $$, 'TC401', null, 'suporte não lê o histórico dos preços');
create temp table quem as select sup, fin from ids;
grant select on quem to dominio;
set local role dominio;
select tentar_definir_pessoa((select sup from quem));
create temp table rls_sup as select (select count(*)::int from faixas_preco) as faixas, (select count(*)::int from historico_precos) as historico;
select tentar_definir_pessoa((select fin from quem));
create temp table rls_fin as select (select count(*)::int from faixas_preco) as faixas;
reset role;
select limpar_contexto();
select is((select faixas + historico from rls_sup), 0, 'nem direto na tabela o suporte enxerga um preço ou o histórico');
select is((select faixas from rls_fin), 5, 'o financeiro enxerga as faixas');

-- Sugestão do plano (decisões D e E): não grava nada.
create temp table antes as select (select count(*) from planos_cliente) as planos, (select count(*) from vagas_fundador) as vagas,
  (select count(*) from historico) as eventos, (select count(*) from historico_precos) as precos;
create temp table s as select pg_temp.sugestao(ipe, 'MENSAL') as m32, pg_temp.sugestao(ipe, 'ANUAL') as a32,
  pg_temp.sugestao(jatoba, 'MENSAL') as m64, pg_temp.sugestao(cerrado, 'MENSAL') as m450, pg_temp.sugestao(vazio, 'MENSAL') as m0 from c;
select is((select m32 -> 'faixa' ->> 'codigo' from s), 'ATE_40', '32 unidades caem na faixa até 40');
select is((select (m32 -> 'plano') - 'inicioCompetencia' - 'fundadorAte' from s),
  '{"nome": "Fundador, até 40 unidades", "tabela": "FUNDADOR", "unidadesDe": 1, "unidadesAte": 40, "valor": 12900, "ciclo": "MENSAL",
    "diaVencimento": 10, "implantacaoSemCobranca": true}'::jsonb,
  'mensal com vaga: o fundador, sem implantação');
select is((select (m32 -> 'plano' ->> 'fundadorAte')::date from s), (select (mes + interval '11 months')::date from d),
  'o fundador vale 12 meses desde a competência em que o plano começa');
select is((select m32 -> 'conjuntos' from s), '["AGENDA", "MANUTENCAO", "VIDA", "COMUNICACAO_AMPLIADA"]'::jsonb,
  'a sugestão diz que os quatro conjuntos ficam contratados');
select is((select m32 -> 'vagasFundador' from s), '{"total": 5, "ocupadas": 0, "livres": 5, "esteClienteOcupa": false, "posicao": 1}'::jsonb,
  'a sugestão mostra as vagas de fundador e a posição que o cliente teria');
select is((select jsonb_build_array(a32 -> 'plano' ->> 'tabela', a32 -> 'plano' -> 'valor', a32 -> 'plano' -> 'valorMensal',
                                    a32 -> 'plano' -> 'mesesPagos', a32 -> 'plano' -> 'implantacaoSemCobranca', a32 -> 'avisos') from s),
  '["CHEIA", 218900, 19900, 11, true, ["FUNDADOR_SO_MENSAL"]]'::jsonb,
  'no anual vale a cheia: 11 × o mensal, implantação isenta');
select ok((select not (a32 -> 'plano' ? 'implantacaoValor') and not (a32 -> 'plano' ? 'fundadorAte') from s), 'o anual não tem implantação nem fundador');
select is((select jsonb_build_array(m64 -> 'faixa' ->> 'codigo', m64 -> 'plano' -> 'valor') from s), '["DE_41_A_100", 22900]'::jsonb,
  '64 unidades: fundador da faixa de 41 a 100');
select is((select jsonb_build_array(m450 -> 'faixa' ->> 'codigo', m450 -> 'plano' ->> 'tabela', m450 -> 'avisos') from s),
  '["ACIMA_DE_400", "MANUAL", ["SOB_CONSULTA"]]'::jsonb, '450 unidades: sob consulta, plano manual');
select ok((select not (m450 -> 'plano' ? 'valor') from s), 'sob consulta não sugere valor (fica "Valor a definir")');
select is((select m0 -> 'avisos' from s), '["SEM_UNIDADES"]'::jsonb, 'sem unidades, não há sugestão');
select ok((select not (m0 ? 'plano') from s), 'sem unidades, nenhum plano sugerido');
select is((select array[(select count(*) from planos_cliente), (select count(*) from vagas_fundador), (select count(*) from historico),
                        (select count(*) from historico_precos)]), (select array[planos, vagas, eventos, precos] from antes),
  'a sugestão não grava nada');
select throws_ok($$ select console_sugestao_plano(impl, ipe, 'MENSAL', null) from ids, c $$, 'TC401', null, 'implantação não vê a sugestão com preços');
select is(pg_temp.campos($$ select console_sugestao_plano(adm, ipe, 'SEMANAL', null) from ids, c $$), '["ciclo"]'::jsonb, 'ciclo que não existe');

-- Salvar o plano com a tabela (decisões D e F).
select is(pg_temp.motivo($$ select pg_temp.salvar(ipe, 'FUNDADOR', 'ANUAL', 218900) from c $$), 'FUNDADOR_SO_MENSAL',
  'plano de fundador no anual é recusado');
select throws_ok($$ select console_salvar_plano_tabela(impl, ipe, null, 'Fundador', 1, 40, 12900, 'MENSAL', 10, null, true, null, mes, 'FUNDADOR')
                    from ids, c, d $$, 'TC401', null, 'implantação não salva o plano');
select is(pg_temp.campos($$ select pg_temp.salvar(ipe, 'PROMOCAO', 'MENSAL', 12900) from c $$), '["tabela"]'::jsonb, 'tabela que não existe');
select is(pg_temp.motivo($$ select console_salvar_plano_tabela(adm, ipe, null, 'Fundador', 1, 40, 12900, 'MENSAL', 10, 60000, false, null, mes, 'FUNDADOR')
                            from ids, c, d $$), 'FUNDADOR_SEM_IMPLANTACAO', 'plano de fundador com implantação é recusado');
create temp table pl as select pg_temp.salvar(ipe, 'FUNDADOR', 'MENSAL', 12900) as r from c;
select is((select r ->> 'tabelaOrigem' from pl), 'FUNDADOR', 'o plano guarda que veio do fundador');
select is((select (r ->> 'fundadorAte')::date from pl), (select (mes + interval '11 months')::date from d), 'o plano diz até quando vale o fundador');
select is((select r ->> 'versao' from pl), '1', 'salvar com a tabela não gasta versão a mais');
select is((select count(*)::int from vagas_fundador where liberada_em is null), 1, 'o plano de fundador ocupa uma vaga');
select is((select count(*)::int from historico where acao = 'vaga_fundador.ocupada'), 1, 'a vaga ocupada fica no histórico interno');
select is((select pg_temp.sugestao(ipe, 'MENSAL') -> 'vagasFundador' from c), '{"total": 5, "ocupadas": 1, "livres": 4, "esteClienteOcupa": true, "posicao": 1}'::jsonb,
  'a sugestão sabe que o cliente já tem a vaga 1');
select is((select console_salvar_plano(adm, ipe, (select versao from planos_cliente where condominio_id = ipe), 'Fundador', 1, 40, 12900,
                                       'MENSAL', 10, null, true, null, mes) ->> 'tabelaOrigem' from ids, c, d),
  'MANUAL', 'salvar pela função antiga deixa o plano manual');
select is((select count(*)::int from vagas_fundador where liberada_em is null), 0, 'saindo do fundador, a vaga é liberada');
select is((select pg_temp.salvar(ipe, 'FUNDADOR', 'MENSAL', 12900) ->> 'tabelaOrigem' from c), 'FUNDADOR', 'volta ao fundador e ocupa a vaga de novo');

-- A sexta vaga é recusada (decisão H).
create temp table outros as select console_criar_condominio(adm, 'Fundador ' || g, 'Brasília', 'DF', null) as id
  from ids, generate_series(1, 4) g;
select pg_temp.salvar(id, 'FUNDADOR', 'MENSAL', 12900) from outros;
select is((select count(*)::int from vagas_fundador where liberada_em is null), 5, 'cinco clientes ocupam as cinco vagas');
select is(pg_temp.motivo($$ select pg_temp.salvar(jatoba, 'FUNDADOR', 'MENSAL', 22900) from c $$), 'SEM_VAGA_FUNDADOR', 'a sexta vaga é recusada');
select is((select jsonb_build_array(r -> 'plano' ->> 'tabela', r -> 'plano' -> 'valor', r -> 'plano' -> 'implantacaoValor', r -> 'avisos')
             from (select pg_temp.sugestao(jatoba, 'MENSAL') as r from c) x),
  '["CHEIA", 34900, 90000, ["SEM_VAGA_FUNDADOR"]]'::jsonb, 'sem vaga, a sugestão é a cheia com a implantação');
select is((select r -> 'plano' ->> 'implantacaoParcelas' from (select pg_temp.sugestao(jatoba, 'MENSAL') as r from c) x), '3',
  'a implantação diz as 3 parcelas (só informativo)');
select is((select pg_temp.salvar(jatoba, 'CHEIA', 'MENSAL', 34900) ->> 'tabelaOrigem' from c), 'CHEIA', 'a cheia salva sem vaga');

-- Escritas na tabela: zero recusado, motivo, versão e histórico (decisão G).
select is(pg_temp.campos($$ select console_salvar_faixa_preco(fin, 'ATE_40', pg_temp.vf('ATE_40'), 0, 19900, 60000, 'Reajuste') from ids $$),
  '["fundador"]'::jsonb, 'valor zero é recusado: vazio é "Valor a definir"');
select is(pg_temp.campos($$ select console_salvar_faixa_preco(fin, 'ATE_40', pg_temp.vf('ATE_40'), 12900, 19900, 60000, ' ') from ids $$),
  '["motivo"]'::jsonb, 'mudar o preço pede o motivo');
select is(pg_temp.motivo($$ select console_salvar_faixa_preco(fin, 'ACIMA_DE_400', pg_temp.vf('ACIMA_DE_400'), 99900, null, null, 'Teste') from ids $$),
  'FAIXA_SOB_CONSULTA', 'acima de 400 continua sob consulta');
select is((teste.erro($$ select console_salvar_faixa_preco(fin, 'ATE_40', 99, 15900, 19900, 60000, 'Reajuste') from ids $$)) ->> 'codigo',
  'TC409', 'AT-24: versão velha é conflito');
select is((select console_salvar_faixa_preco(fin, 'ATE_40', pg_temp.vf('ATE_40'), 15900, 21900, null, 'Reajuste de novembro') from ids)
             - 'alteradoEm' - 'versao' - 'ordem' - 'nome' - 'moeda',
  '{"codigo": "ATE_40", "unidadesDe": 1, "unidadesAte": 40, "sobConsulta": false, "fundador": 15900, "cheia": 21900, "anual": 240900,
    "alteradoPor": "Fábio"}'::jsonb, 'o financeiro muda os preços; implantação vazia fica a definir');
select is((select jsonb_build_array(entidade, entidade_id, antes -> 'fundador', depois -> 'fundador', depois ? 'implantacao', motivo)
             from historico_precos where entidade = 'FAIXA'),
  '["FAIXA", "ATE_40", 12900, 15900, false, "Reajuste de novembro"]'::jsonb, 'o histórico guarda antes, depois e o motivo');
select is((select autor_id from historico_precos where entidade = 'FAIXA'), (select fin from ids), 'o histórico guarda quem mudou');
select is((select count(*)::int from historico where acao = 'precos.faixa.alterada' and interno), 1, 'a mudança vai também para o histórico interno');
select is((select planos_cliente.valor_centavos::bigint from planos_cliente where condominio_id = (select ipe from c)), 12900::bigint,
  'mudar a tabela não mexe no plano que já existe');
select throws_ok($$ update historico_precos set motivo = 'Outro motivo' $$, 'TC010', null, 'o histórico dos preços não se edita');
select throws_ok($$ delete from historico_precos $$, 'TC010', null, 'o histórico dos preços não se apaga');
select throws_ok($$ update faixas_preco set unidades_ate = 50 where codigo = 'ATE_40' $$, 'TC422', null, 'os limites das faixas não mudam');
select is((select jsonb_array_length(console_historico_precos(adm, null, 50) -> 'eventos') from ids), 1, 'a administração lê o histórico');

-- Parâmetros e concorrentes.
select is(pg_temp.campos($$ select console_salvar_parametros_preco(fin, pg_temp.vp(), 13, 3, 5, 'FUNDADOR', 'Teste') from ids $$),
  '["mesesPagosAnual"]'::jsonb, 'o anual paga no máximo 12 meses');
select is(pg_temp.motivo($$ select console_salvar_parametros_preco(fin, pg_temp.vp(), 11, 3, 4, 'FUNDADOR', 'Menos vagas') from ids $$),
  'VAGAS_OCUPADAS', 'não se tira vaga de fundador que está ocupada');
select is((select console_salvar_parametros_preco(adm, pg_temp.vp(), 11, 3, 5, 'CHEIA', 'Fim da campanha de fundador') ->> 'tabelaEmUso' from ids),
  'CHEIA', 'a administração troca a tabela em uso');
select is((select (r -> 'plano' ->> 'tabela') || ' ' || (r -> 'avisos')::text from (select pg_temp.sugestao(ipe, 'MENSAL') as r from c) x),
  'CHEIA []', 'com a cheia em uso, a sugestão é a cheia');
select is((select jsonb_build_array(r -> 'plano' -> 'valor', r -> 'plano' ? 'implantacaoValor', r -> 'plano' -> 'implantacaoSemCobranca')
             from (select pg_temp.sugestao(ipe, 'MENSAL') as r from c) x),
  '[21900, false, false]'::jsonb, 'implantação vazia na tabela fica a definir na sugestão, nunca zero');
select is((select tabela_origem from planos_cliente where condominio_id = (select ipe from c)), 'FUNDADOR', 'trocar a tabela em uso não mexe no plano');
create temp table cc as select console_salvar_concorrente(fin, null, null, 'Condo Fácil', null, 'FIXO', 8900, false, null, null, null,
                                                          'Blog de terceiros', false, '2026-10-24', null, 'Novo concorrente') as r from ids;
select is((select r ->> 'conferido' from cc), 'false', 'preço de terceiros fica marcado como não conferido');
select is(pg_temp.campos($$ select console_salvar_concorrente(fin, null, null, 'X Síndico', null, 'FAIXA', null, false,
                              '[{"ate": 100, "valor": 100}, {"ate": 50, "valor": 200}]', null, null, 'Site oficial', true, '2026-10-24', null, 'Novo') from ids $$),
  '["faixas"]'::jsonb, 'faixas do concorrente fora de ordem são recusadas');
select is((select console_arquivar_concorrente(fin, (r ->> 'id')::uuid, 1, 'Saiu do mercado') ->> 'arquivado' from ids, cc), 'true',
  'o concorrente arquiva com motivo');
select is(pg_temp.motivo($$ select console_salvar_concorrente(fin, (r ->> 'id')::uuid, 2, 'Condo Fácil', null, 'FIXO', 9900, false, null, null, null,
                              'Site oficial', true, '2026-10-24', null, 'Reajuste') from ids, cc $$), 'CONCORRENTE_ARQUIVADO', 'arquivado não muda');
select throws_ok($$ delete from precos_concorrentes $$, 'TC010', null, 'concorrente não se apaga');

-- Meu plano sem valores e as ações na sessão (decisão I).
select ok((select not (plataforma_meu_plano(ana, ipe)::text ~ '12900|valor|tabela|fundador') from ids, c), 'NG-21: Meu plano não mostra valores nem a tabela');
select ok((select (console_sessao(fin) -> 'acoes') @> '["console.pagamentos.ver", "console.pagamentos.registrar", "console.precos.ver", "console.precos.editar"]'
             from ids), 'a sessão do financeiro traz Pagamentos e Tabela de preços');
select is((select console_sessao(sup) -> 'acoes' from ids), '[]'::jsonb, 'a sessão do suporte não traz pagamentos nem preços');

select * from finish();
rollback;

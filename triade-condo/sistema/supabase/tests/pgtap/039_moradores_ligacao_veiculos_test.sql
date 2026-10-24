-- Moradores e unidades com banco (0292; MU-02, MU-06, MU-10): as abas Proprietários, Inquilinos e
-- Moram na lista de pessoas (decisão B.1) e os veículos sem vaga em Garagens › Veículos (decisão B.2).
begin;
select plan(20);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Fábio') as fabio;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_MANUTENCAO']) as v_fabio
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102;
-- 101: a proprietária mora, com o filho. 102: o proprietário não mora; a inquilina mora.
select plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true),
       plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Paulo Souza', '+5561999990003', '{"mora": true, "ligacao": "FAMILIAR", "parentesco": "FILHO"}', true),
       plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "mora": false}', true),
       plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Joana Lima', '+5561988887777', '{"ligacao": "INQUILINO", "principal": true, "mora": true}', true)
  from ids, c, u;

create function pg_temp.lista(p_ligacao text, p_busca text default null, p_unidade uuid default null) returns jsonb language sql as $$
  select plataforma_moradores((select ana from ids), (select ipe from c), p_busca, null, 1, p_unidade, p_ligacao) $$;
create function pg_temp.nomes(p jsonb) returns text language sql as $$
  select string_agg(x ->> 'nome', ', ' order by x ->> 'nome') from jsonb_array_elements(p -> 'itens') x $$;

-- 1. As abas da lista de pessoas.
select is(pg_temp.lista(null) -> 'ligacoes', '{"todas": 4, "moram": 3, "inquilinos": 1, "proprietarios": 2}'::jsonb,
  'MU-02: a lista conta Todas, Proprietários, Inquilinos e Moram');
select is(pg_temp.nomes(pg_temp.lista('PROPRIETARIOS')), 'Marta Souza, Rui Lima', 'decisão B.1: Proprietários traz quem é proprietário, more ou não');
select is(pg_temp.nomes(pg_temp.lista('INQUILINOS')), 'Joana Lima', 'decisão B.1: Inquilinos traz quem tem a ligação de inquilino');
select is(pg_temp.nomes(pg_temp.lista('MORAM')), 'Joana Lima, Marta Souza, Paulo Souza', 'decisão B.1: Moram junta quem mora, seja qual for a ligação');
select is((pg_temp.lista('MORAM') ->> 'total')::integer, 3, 'MU-02: o total é o da aba escolhida');
select is(pg_temp.lista('MORAM') ->> 'ligacao', 'MORAM', 'MU-02: a lista diz qual aba está valendo');
select is((select (x ->> 'mora')::boolean from jsonb_array_elements(pg_temp.lista('PROPRIETARIOS') -> 'itens') x where x ->> 'nome' = 'Rui Lima'), false,
  'MU-02: cada linha diz se a pessoa mora');
select is((select (x ->> 'mora')::boolean from jsonb_array_elements(pg_temp.lista('PROPRIETARIOS') -> 'itens') x where x ->> 'nome' = 'Marta Souza'), true,
  'MU-02: e quem mora vem marcado');
select is(pg_temp.lista('MORAM', 'Lima') -> 'ligacoes', '{"todas": 2, "moram": 1, "inquilinos": 1, "proprietarios": 1}'::jsonb,
  'decisão B.1: o número de cada aba já conta com a busca');
select is(pg_temp.nomes(pg_temp.lista('MORAM', null, (select u102 from u))), 'Joana Lima', 'MU-10: a aba vale também na lista de uma unidade');
select is((select plataforma_moradores(ana, ipe, null, 'SEM_EMAIL', 1, null, 'PROPRIETARIOS') -> 'ligacoes' ->> 'proprietarios' from ids, c), '2',
  'decisão B.1: o número da aba conta com o atalho escolhido');
select is(pg_temp.campos($$ select plataforma_moradores(ana, ipe, null, null, 1, null, 'SINDICOS') from ids, c $$), '["ligacao"]',
  'MU-02: ligação desconhecida é recusada');
select is(pg_temp.nomes(pg_temp.lista(null, '101')), 'Marta Souza, Paulo Souza', 'MU-02: sem aba, a busca pela unidade continua como antes');

-- 2. Os veículos sem vaga em Garagens.
create temp table vg as select (plataforma_salvar_vaga(ana, ipe, null, null, '31', 'Subsolo 1', true, u101, null) ->> 'id')::uuid as v31 from ids, c, u;
select plataforma_salvar_veiculo(ana, ipe, null, null, u101, 'QMF2A41', 'CARRO', 'Onix prata', null, v31),
       plataforma_salvar_veiculo(ana, ipe, null, null, u101, 'BRA2E19', 'MOTO', 'CG 160', (select id from contatos where nome = 'Marta Souza'), null),
       plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'ABC1234', 'CARRO', 'HB20 branco', null, null)
  from ids, c, u, vg;
create temp table g as select plataforma_garagens(ana, ipe) as v from ids, c;
select is((select jsonb_array_length(v -> 'semVaga') from g), 2, 'MU-06: Garagens traz os veículos sem vaga');
select is((select string_agg(x ->> 'placa', ', ' order by n) from g, jsonb_array_elements(v -> 'semVaga') with ordinality t(x, n)), 'ABC-1234, BRA2E19',
  'decisão B.2: em ordem de placa, como aparece');
select is((select x ->> 'unidade' from g, jsonb_array_elements(v -> 'semVaga') x where x ->> 'placa' = 'BRA2E19'), 'Torre A · 101',
  'decisão B.2: cada um com a unidade');
select is((select x ->> 'contato' from g, jsonb_array_elements(v -> 'semVaga') x where x ->> 'placa' = 'BRA2E19'), 'Marta Souza',
  'decisão B.2: e de quem é, quando foi dito');
select ok(not exists (select 1 from g, jsonb_array_elements(v -> 'semVaga') x where x ? 'vagaId'), 'decisão B.2: nenhum deles tem vaga');
select is((select (v -> 'resumo' ->> 'semVaga')::integer from g), 2, 'MU-06: o resumo continua contando os sem vaga');
select throws_ok($$ select plataforma_garagens(adm, ipe) from ids, c $$, 'TC401', null, 'quem não entra no condomínio não vê as garagens');

select * from finish();
rollback;

-- Família, pets e aniversário no cadastro da unidade (F3.9; MU-06) e o histórico, os
-- aniversariantes e as etiquetas da lista de unidades (F3.10; MU-11). Migration 0287, desenho nos
-- quadros 201 a 215 do canvas do novo frontend. O relógio fica em 03/03/2027 (março).
begin;
select plan(55);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select teste.vincular(ana, ipe), teste.vincular(davi, jatoba),
       plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['CADASTRAR']),
       plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER'])
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103;

-- ---------------------------------------------------------------------------------------
-- Aniversário de quem tem vínculo (decisão B).

select is(pg_temp.campos($$ select plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Joana Lima', '+5561988887777',
  '{"proprietario": false, "principal": true, "mora": true, "ligacao": "INQUILINO"}', true, '{"nome": "Rui Prado", "telefone": "+5561977771212"}',
  '{"dia": 31, "mes": 4}') from ids, c, u $$), '["aniversario"]', 'MU-06: aniversário só com um dia que exista no mês (31 de abril não)');
select is((select count(*)::integer from contatos where nome = 'Joana Lima'), 0, 'MU-06: aniversário errado não deixa nada gravado');

select plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Joana Lima', '+5561988887777',
  '{"proprietario": false, "principal": true, "mora": true, "ligacao": "INQUILINO"}', true, '{"nome": "Rui Prado", "telefone": "+5561977771212"}',
  '{"dia": 3, "mes": 3}') from ids, c, u;
create temp table ct as select
  (select id from contatos where nome = 'Joana Lima') as joana,
  (select id from contatos where nome = 'Rui Prado') as rui;
select is((select (aniversario_dia, aniversario_mes)::text from contatos where id = joana), '(3,3)', 'MU-06: incluir pessoa grava o dia e o mês do aniversário') from ct;
select is((select aniversario_dia from contatos where id = rui), null, 'MU-06: o aniversário é opcional') from ct;
select ok(not exists (select 1 from information_schema.columns where table_name in ('contatos', 'familiares_unidade') and column_name ~ 'nascimento|ano'),
  'Decisão B: não há ano de nascimento em lugar nenhum');

create temp table v0 as select versao from contatos, ct where id = joana;
select is((plataforma_alterar_contato(ana, ipe, joana, v0.versao, 'Joana Lima', '+5561988887777', '{"dia": 29, "mes": 2}') ->> 'versao')::integer,
  v0.versao + 2, 'MU-06: editar o aniversário sobe a versão (o nome e o telefone, depois o aniversário)') from ids, c, ct, v0;
select is((select (aniversario_dia, aniversario_mes)::text from contatos where id = joana), '(29,2)', 'MU-06: 29 de fevereiro vale') from ct;
update v0 set versao = (select versao from contatos, ct where id = joana);
select is((plataforma_alterar_contato(ana, ipe, joana, v0.versao, 'Joana Lima', '+5561988887777') ->> 'versao')::integer,
  v0.versao + 1, 'MU-06: editar sem mandar o aniversário sobe a versão só uma vez') from ids, c, ct, v0;
select is((select aniversario_mes from contatos where id = joana), 2::smallint, 'MU-06: e o aniversário fica como estava') from ct;
select plataforma_alterar_contato(ana, ipe, joana, (select versao from contatos where id = joana), 'Joana Lima', '+5561988887777', '{"dia": 3, "mes": 3}') from ids, c, ct;
select is(pg_temp.codigo($$ select plataforma_alterar_contato(ana, ipe, joana, 1, 'Joana Lima', '+5561988887777', '{"dia": 4, "mes": 3}') from ids, c, ct $$),
  'TC409', 'AT-24: aniversário com versão antiga dá conflito');
select is((select h.dados -> 'campos' from historico h where h.entidade = 'contato' and h.entidade_id = joana::text and h.dados -> 'campos' ? 'aniversario'
            order by h.id desc limit 1), '["aniversario"]', 'PT-03: o histórico diz que o aniversário mudou, sem a data') from ct;

-- ---------------------------------------------------------------------------------------
-- Família (MU-06, decisão D).

select is(pg_temp.campos($$ select plataforma_salvar_familiar(ana, ipe, null, null, u101, ' ', 'FILHO', true, '{}') from ids, c, u $$),
  '["nome"]', 'MU-06: familiar precisa de nome');
select is(pg_temp.campos($$ select plataforma_salvar_familiar(ana, ipe, null, null, u101, 'Lucas', 'IRMAO', true, '{}') from ids, c, u $$),
  '["parentesco"]', 'MU-06: o parentesco é um dos da lista');
select is(pg_temp.campos($$ select plataforma_salvar_familiar(ana, ipe, null, null, u101, 'Lucas', 'FILHO', true, '{"dia": 30, "mes": 2}') from ids, c, u $$),
  '["aniversario"]', 'MU-06: aniversário do familiar também é conferido');
select is(pg_temp.codigo($$ select plataforma_salvar_familiar(gil, ipe, null, null, u101, 'Lucas', 'FILHO', true, '{}') from ids, c, u $$),
  'TC401', 'PT-02: quem não cuida dos moradores não inclui familiar');
select is(pg_temp.campos($$ select plataforma_salvar_familiar(davi, jatoba, null, null, u101, 'Lucas', 'FILHO', true, '{}') from ids, c, u $$),
  '["unidadeId"]', 'PT-01: não inclui familiar em unidade de outro condomínio');
select ok(not exists (select 1 from information_schema.columns where table_name = 'familiares_unidade' and column_name in ('telefone', 'email')),
  'Decisão D: familiar não tem telefone nem e-mail');

create temp table fm as select
  (plataforma_salvar_familiar(ana, ipe, null, null, u101, 'Lucas Lima', 'FILHO', true, '{"dia": 14, "mes": 3}') ->> 'id')::uuid as lucas,
  (plataforma_salvar_familiar(bruna, ipe, null, null, u101, 'Sofia Lima', 'FILHO', true, '{}') ->> 'id')::uuid as sofia,
  (plataforma_salvar_familiar(ana, ipe, null, null, u102, 'Dona Cida', 'TRABALHA_NA_CASA', false, null) ->> 'id')::uuid as cida
  from ids, c, u;
select is((select count(*)::integer from familiares_unidade where unidade_id = u101 and saiu_em is null), 2, 'MU-06: quem cadastra moradores também inclui familiar') from u;
select is((plataforma_salvar_familiar(ana, ipe, lucas, 1, null, 'Lucas Lima', 'FILHO', true, '{"dia": 15, "mes": 3}') ->> 'versao')::integer, 2,
  'MU-06: editar o familiar sobe a versão') from ids, c, fm;
select is(pg_temp.codigo($$ select plataforma_salvar_familiar(ana, ipe, lucas, 1, null, 'Lucas', 'FILHO', true, '{}') from ids, c, fm $$),
  'TC409', 'AT-24: familiar com versão antiga dá conflito');

-- ---------------------------------------------------------------------------------------
-- Pets.

select is(pg_temp.campos($$ select plataforma_salvar_pet(ana, ipe, null, null, u101, 'Thor', 'PEIXE', null, null, null) from ids, c, u $$),
  '["especie"]', 'MU-06: espécie cão, gato ou outro');
select is(pg_temp.campos($$ select plataforma_salvar_pet(ana, ipe, null, null, u101, 'Thor', 'CAO', 'ENORME', null, null) from ids, c, u $$),
  '["porte"]', 'MU-06: porte pequeno, médio ou grande');
create temp table pt as select
  (plataforma_salvar_pet(ana, ipe, null, null, u101, 'Thor', 'CAO', 'MEDIO', 'Vira-lata', 'Late com o interfone.') ->> 'id')::uuid as thor,
  (plataforma_salvar_pet(ana, ipe, null, null, u101, 'Mimi', 'GATO', null, '  ', null) ->> 'id')::uuid as mimi
  from ids, c, u;
select is((select raca from pets_unidade where id = mimi), null, 'MU-06: raça em branco fica sem raça') from pt;

-- ---------------------------------------------------------------------------------------
-- A ficha da unidade.

create temp table f as select plataforma_unidade(ana, ipe, u101) as j from ids, c, u;
select is(jsonb_array_length(j -> 'familia'), 2, 'MU-06: a ficha traz a família') from f;
select is((select x -> 'aniversario' from f, jsonb_array_elements(j -> 'familia') x where x ->> 'nome' = 'Lucas Lima'), '{"dia": 15, "mes": 3}',
  'Decisão B: o aniversário do familiar vem como dia e mês');
select is((select x -> 'aniversario' from f, jsonb_array_elements(j -> 'contatos') x where x ->> 'nome' = 'Joana Lima'), '{"dia": 3, "mes": 3}',
  'Decisão B: o aniversário da pessoa com vínculo também');
select is(jsonb_array_length(j -> 'pets'), 2, 'MU-06: a ficha traz os pets') from f;
select is(jsonb_array_length(j -> 'historico'), 3, 'MU-11: a ficha traz as três últimas mudanças') from f;
select is(j -> 'historico' -> 0 ->> 'titulo', 'Mimi incluído', 'MU-11: a mais nova primeiro') from f;

-- ---------------------------------------------------------------------------------------
-- Retirar (regra 1).

select is(pg_temp.campos($$ select plataforma_retirar_familia_pet(ana, ipe, 'PET', thor, 1, 'FUGIU') from ids, c, pt $$),
  '["motivo"]', 'MU-06: retirar diz se saiu ou se foi engano');
select plataforma_retirar_familia_pet(ana, ipe, 'PET', thor, 1, 'SAIU') from ids, c, pt;
select ok((select saiu_em is not null from pets_unidade where id = thor), 'MU-06: o pet que saiu fica guardado com a data') from pt;
select is(pg_temp.motivo($$ select plataforma_salvar_pet(ana, ipe, thor, 2, null, 'Thor', 'CAO', null, null, null) from ids, c, pt $$),
  'JA_SAIU', 'MU-06: quem saiu não muda');
select plataforma_retirar_familia_pet(ana, ipe, 'FAMILIAR', sofia, 1, 'ENGANO') from ids, c, fm;
select ok(not exists (select 1 from familiares_unidade f, fm where f.id = fm.sofia), 'PT-11: cadastrado por engano apaga os dados');
select ok(not exists (select 1 from historico h, fm where h.dados::text like '%' || fm.sofia::text || '%' and h.acao = 'unidade.familiar_apagado'),
  'PT-11: o histórico guarda só que um familiar foi retirado');
select is(pg_temp.motivo($$ select plataforma_alterar_unidade(ana, ipe, u102, (select versao from unidades where id = u102), '102', ba, null, false) from ids, c, u, bl $$),
  'UNIDADE_COM_FAMILIA', 'Regra 4: unidade com família ou pet não é desativada');

-- ---------------------------------------------------------------------------------------
-- Histórico da unidade (regra 3).

select plataforma_marcar_unidade(ana, ipe, u101, (select versao from unidades where id = u101), false, true) from ids, c, u;
create temp table h as select plataforma_historico_unidade(ana, ipe, u101, null, null) as j from ids, c, u;
select is(j ->> 'unidade', 'Torre A · 101', 'MU-11: o histórico diz de qual unidade é') from h;
select is(j -> 'itens' -> 0 ->> 'titulo', 'Marcada para alugar', 'MU-11: as marcas entram no histórico') from h;
select is(j -> 'itens' -> 0 ->> 'autor', 'por Síndica Ana', 'MU-11: diz quem fez') from h;
select ok(exists (select 1 from h, jsonb_array_elements(j -> 'itens') x where x ->> 'titulo' = 'Joana Lima incluído' and x ->> 'detalhe' = 'Inquilino'),
  'MU-11: a inclusão da pessoa entra com o papel');
select ok(exists (select 1 from h, jsonb_array_elements(j -> 'itens') x where x ->> 'titulo' = 'Thor saiu'), 'MU-11: o pet que saiu entra pelo nome');
select ok(exists (select 1 from h, jsonb_array_elements(j -> 'itens') x where x ->> 'titulo' = 'Familiar retirado'
                    and x ->> 'detalhe' like 'cadastrado por engano%'), 'MU-11: o apagado por engano entra sem o nome');
select ok(not exists (select 1 from h, jsonb_array_elements(j -> 'itens') x where x::text ~ '5561|98888'), 'Regra 3: telefone nunca aparece no histórico');
select is((select count(*)::integer from h, jsonb_array_elements(j -> 'itens') x where x ->> 'categoria' = 'FAMILIA_PETS'),
  (plataforma_historico_unidade(ana, ipe, u101, 'FAMILIA_PETS', null) ->> 'total')::integer, 'MU-11: o filtro Família e pets conta o mesmo') from ids, c, u;
select is(pg_temp.campos($$ select plataforma_historico_unidade(ana, ipe, u101, 'OUTRA', null) from ids, c, u $$), '["categoria"]',
  'MU-11: categoria fora da lista é recusada');
select is(pg_temp.codigo($$ select plataforma_historico_unidade(gil, ipe, u101, null, null) from ids, c, u $$), 'TC401',
  'PT-02: quem não vê os moradores não vê o histórico');

-- A pessoa que teve os dados removidos aparece como pessoa removida.
select plataforma_encerrar_vinculo_unidade(ana, ipe, cu.id, cu.versao, 'CORRECAO', null)
  from ids, c, ct, contatos_unidade cu where cu.contato_id = ct.rui;
select plataforma_remover_dados_contato(ana, ipe, rui, (select versao from contatos where id = rui)) from ids, c, ct;
select ok(exists (select 1 from jsonb_array_elements(plataforma_historico_unidade(ana, ipe, u101, 'PESSOAS', null) -> 'itens') x
                   where x ->> 'titulo' = 'Pessoa removida saiu') and not exists (
            select 1 from jsonb_array_elements(plataforma_historico_unidade(ana, ipe, u101, null, null) -> 'itens') x where x::text like '%Rui%'),
  'PT-11: quem teve os dados removidos aparece sem o nome') from ids, c, u;

-- Remover os dados apaga o aniversário (regra 2).
select plataforma_alterar_contato(ana, ipe, joana, (select versao from contatos where id = joana), 'Joana Lima', '+5561988887777', '{"dia": 3, "mes": 3}') from ids, c, ct;
select plataforma_encerrar_vinculo_unidade(ana, ipe, cu.id, cu.versao, 'CORRECAO', null)
  from ids, c, ct, contatos_unidade cu where cu.contato_id = ct.joana and cu.estado <> 'ENCERRADO';
create temp table jo as select joana as id from ct;
select plataforma_remover_dados_contato(ana, ipe, jo.id, (select versao from contatos where id = jo.id)) from ids, c, jo;
select is((select aniversario_dia from contatos, jo where contatos.id = jo.id), null, 'Regra 2: remover os dados apaga o aniversário');

-- ---------------------------------------------------------------------------------------
-- Lista de unidades, aniversariantes e busca.

select plataforma_incluir_pessoa_unidade(ana, ipe, u103, null, 'Marina Souza', '+5561999990001',
  '{"proprietario": true, "principal": true, "mora": true}', true, null, '{"dia": 28, "mes": 3}') from ids, c, u;
create temp table l as select plataforma_unidades(ana, ipe) as j from ids, c;
select is(j ->> 'mes', '3', 'Decisão C: a lista diz o mês de hoje no condomínio') from l;
select is((select (x ->> 'pets')::integer from l, jsonb_array_elements(j -> 'unidades') x, u where (x ->> 'id')::uuid = u101), 1,
  'Decisão C: a etiqueta Com pet conta só os pets que estão na unidade');
select is((select (x ->> 'aniversariantesMes')::integer from l, jsonb_array_elements(j -> 'unidades') x, u where (x ->> 'id')::uuid = u101), 1,
  'Decisão C: aniversariante do mês conta a família (Lucas) e não quem saiu (Joana)');

create temp table a as select plataforma_aniversariantes(ana, ipe, null, null) as j from ids, c;
select is((select jsonb_agg(x ->> 'nome') from a, jsonb_array_elements(j -> 'itens') x), '["Lucas Lima", "Marina Souza"]',
  'MU-11: os aniversariantes do mês, por dia, juntando pessoas e família');
select is((select x ->> 'descricao' from a, jsonb_array_elements(j -> 'itens') x where x ->> 'nome' = 'Lucas Lima'), 'Família · filho ou filha',
  'MU-11: a família vem marcada');
select is(jsonb_array_length(plataforma_aniversariantes(ana, ipe, 3, u103) -> 'itens'), 1, 'MU-11: o filtro da unidade') from ids, c, u;
select is(pg_temp.campos($$ select plataforma_aniversariantes(ana, ipe, 13, null) from ids, c $$), '["mes"]', 'MU-11: mês de 1 a 12');

select is((select x ->> 'tipo' from jsonb_array_elements(plataforma_buscar_unidades(ana, ipe, 'lucas')) x), 'FAMILIA',
  'MU-11: a busca acha pelo nome de quem é da família') from ids, c;

select * from finish();
rollback;

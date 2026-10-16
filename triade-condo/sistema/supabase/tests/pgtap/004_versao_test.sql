-- T4 (AT-24): duas alterações no mesmo registro a partir da mesma versão: uma grava, a outra
-- recebe o conflito com a versão nova, para a tela mostrar sem perder o que foi escrito.
-- (O mesmo com duas conexões de verdade está em concorrencia/edicao-simultanea.sh.)
begin;
select plan(9);

call teste.criar_exemplos();
select teste.permitir('SINDICO', 'exemplos.ver', 'exemplos.criar', 'exemplos.alterar');
create temp table ids as select teste.condominio('Residencial Aurora') as a, teste.pessoa('Síndica') as pa, teste.pessoa('Subsíndico') as ps;
select teste.vincular(pa, a), teste.vincular(ps, a) from ids;
create temp table ex as select exemplo_criar(pa, a, 'Original') as e from ids;

-- As duas pessoas abriram a versão 1.
select is((select exemplo_alterar(pa, a, e, 1, 'Texto da síndica') from ids, ex), 2, 'a primeira grava e a versão sobe para 2');
select is(
  (select teste.erro(format('select exemplo_alterar(%L, %L, %L, 1, %L)', ps, a, e, 'Texto do subsíndico')) ->> 'codigo' from ids, ex),
  'TC409', 'T4: a segunda recebe conflito de versão');
select is(
  (select teste.erro(format('select exemplo_alterar(%L, %L, %L, 1, %L)', ps, a, e, 'Texto do subsíndico')) -> 'detalhe' -> 'versao' from ids, ex),
  '2'::jsonb, 'o conflito traz a versão nova');
select is(
  (select teste.erro(format('select exemplo_alterar(%L, %L, %L, 1, %L)', ps, a, e, 'Texto do subsíndico')) -> 'detalhe' -> 'atual' ->> 'titulo' from ids, ex),
  'Texto da síndica', 'o conflito traz o conteúdo atual para mostrar na tela');
select results_eq($$ select exemplo_listar(pa, a) from ids $$, array['Texto da síndica'], 'nada foi sobrescrito sem aviso');
select is((select count(*)::int from historico where acao = 'exemplo.alterado'), 1, 'dados e histórico gravados juntos: a recusada não deixa rastro pela metade');
select is((select exemplo_alterar(ps, a, e, 2, 'Texto do subsíndico') from ids, ex), 3, 'com a versão nova, a segunda grava');

select throws_ok($$ update exemplos set versao = 99 $$, 'TC422', null, 'ninguém muda a versão na mão');
select throws_ok($$ select exemplo_alterar(pa, a, gen_random_uuid(), 1, 'x') from ids $$, 'TC404', null, 'registro que não existe não é conflito');

select * from finish();
rollback;

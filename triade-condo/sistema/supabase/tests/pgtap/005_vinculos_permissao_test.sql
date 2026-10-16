-- F0.7 e T5 (CF-04): pessoa + função + condomínio + ação, negar por padrão; vínculo revogado
-- não age mais e a autoria antiga continua no histórico.
begin;
select plan(15);

call teste.criar_exemplos();
insert into funcoes (codigo, nome, sistema) values ('ZELADOR', 'Zelador', 'PLATAFORMA');
select teste.permitir('SINDICO', 'exemplos.ver', 'exemplos.criar', 'exemplos.alterar', 'vinculos.revogar');
select teste.permitir('ZELADOR', 'exemplos.ver', 'exemplos.alterar');
create temp table ids as select teste.condominio('Residencial Aurora') as a, teste.condominio('Edifício Bela Vista') as b,
  teste.pessoa('Síndica') as pa, teste.pessoa('Zelador') as pz, gen_random_uuid() as sessao_z;
create temp table vs as select teste.vincular(pz, a, 'ZELADOR') as vz, teste.vincular(pa, a) as va from ids;
create temp table ex as select exemplo_criar(pa, a, 'Lâmpada do hall') as e from ids;

-- Antes: o zelador age no condomínio em que tem vínculo, só no que a função dele permite.
select is((select exemplo_alterar(pz, a, e, 1, 'Lâmpada trocada') from ids, ex), 2, 'zelador altera o que a função permite');
select throws_ok($$ select exemplo_criar(pz, a, 'x') from ids $$, 'TC401', null, 'negar por padrão: zelador não cria');
select throws_ok($$ select exemplo_listar(pz, b) from ids $$, 'TC401', null, 'nem age em condomínio sem vínculo');
select lives_ok($$ select escolher_condominio(pz, sessao_z, a) from ids $$, 'zelador escolhe o condomínio na sessão');

select throws_ok($$ select revogar_vinculo(pz, a, va, 1) from ids, vs $$, 'TC401', null, 'zelador não revoga ninguém');
select throws_ok($$ select revogar_vinculo(pa, a, vz, 7) from ids, vs $$, 'TC409', null, 'revogar com versão velha é conflito');
select is((select revogar_vinculo(pa, a, vz, 1) from ids, vs), 2, 'a síndica revoga o vínculo do zelador');

-- Depois: o revogado não age em lugar nenhum.
select throws_ok($$ select exemplo_listar(pz, a) from ids $$, 'TC401', null, 'T5: vínculo revogado não age mais');
select is((select condominio_da_sessao(pz, sessao_z) from ids), null, 'a sessão escolhida para de valer');
select is((select count(*)::int from ids, meus_condominios(pz)), 0, 'o condomínio sai da lista dele');
select ok(not (select acesso_plataforma(pz) from ids), 'sem vínculo ativo, não entra na Plataforma');
select is(
  (select count(*)::int from historico where autor_id = (select pz from ids) and acao = 'exemplo.alterado'),
  1, 'T5: a autoria antiga continua no histórico');
select is((select count(*)::int from historico where acao = 'vinculo.revogado' and autor_id = (select pa from ids)), 1, 'a revogação fica no histórico com a autora');

select set_config('app.condominio_id', (select a::text from ids), true);
select throws_ok($$ update vinculos set revogado_em = null, revogado_por = null where id = (select vz from vs) $$, 'TC422', null, 'revogado não volta');
select throws_ok($$ select teste.vincular(pa, a) from ids $$, '23505', null, 'a mesma função ativa duas vezes no mesmo condomínio não');

select * from finish();
rollback;

-- F0.5 (relógio da aplicação), limites de tentativas (PT-08) e F0.10 (dinheiro exato, PT-09).
begin;
select plan(15);

select ok(abs(extract(epoch from app_now() - now())) < 1, 'sem ajuste, app_now() é a hora do banco');
select ok(abs(extract(epoch from ajustar_relogio('2 hours') - (now() + interval '2 hours'))) < 1, 'o teste adianta o relógio');
select is(app_now(), now() + interval '2 hours', 'app_now() segue o adiantamento');
update configuracoes set valor = '"producao"' where chave = 'ambiente';
select throws_ok($$ select ajustar_relogio('1 day') $$, 'TC003', null, 'em produção o relógio não se mexe');
update configuracoes set valor = '"desenvolvimento"' where chave = 'ambiente';
select ajustar_relogio('0');

select results_eq($$ select contar_uso('login:abc', '15 minutes', 2) from generate_series(1, 3) $$,
  array[true, true, false], 'a terceira tentativa passa do limite');
select ok(not dentro_do_limite('login:abc', '15 minutes', 2), 'antes de conferir a senha, já sabe que passou');
select ajustar_relogio('16 minutes');
select ok(contar_uso('login:abc', '15 minutes', 2), 'passada a janela, volta a aceitar');
select throws_ok($$ select contar_uso('x', '0', 1) $$, 'TC422', null, 'limite sem janela é recusado');
select results_eq($$ select limite_contar('login', 'h1') from generate_series(1, 6) $$,
  array[true, true, true, true, true, false], 'login: a sexta senha errada passa do limite configurado (5)');
select ok(not limite_ok('login', 'h1') and limite_ok('login', 'h2'), 'o limite é por chave (e-mail + IP em hash)');
select throws_ok($$ select configuracao_int('nao_existe') $$, 'TC002', null, 'configuração ausente não vira zero escondido');

select is('11999'::centavos::bigint, 11999::bigint, 'centavos é inteiro');
select throws_ok($$ select '119.99'::centavos $$, '22P02', null, 'fração de centavo é recusada');
select lives_ok($$ select 'BRL'::moeda $$, 'real é aceito');
select throws_ok($$ select 'USD'::moeda $$, '23514', null, 'outra moeda é recusada');

select * from finish();
rollback;

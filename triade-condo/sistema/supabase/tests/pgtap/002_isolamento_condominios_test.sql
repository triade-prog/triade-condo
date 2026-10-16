-- T2 (PT-01) e F0.3: usuário do condomínio A não lista, lê, busca nem altera nada do B.
-- O condomínio vem do contexto que a sessão validou; o RLS separa mesmo se a função esquecer o filtro.
begin;
select plan(30);

call teste.criar_exemplos();
select teste.permitir('SINDICO', 'exemplos.ver', 'exemplos.criar', 'exemplos.alterar');

create temp table ids as select
  teste.condominio('Residencial Aurora') as a,
  teste.condominio('Edifício Bela Vista') as b,
  teste.pessoa('Síndica Aurora') as pa,
  teste.pessoa('Síndico Bela Vista') as pb,
  teste.pessoa('Síndico profissional') as pmulti,
  teste.pessoa('Sem vínculo') as psem,
  gen_random_uuid() as sessao;
select teste.vincular(pa, a), teste.vincular(pb, b), teste.vincular(pmulti, a), teste.vincular(pmulti, b) from ids;

create temp table ex as select
  exemplo_criar(pa, a, 'Vazamento na garagem') as ea,
  exemplo_criar(pb, b, 'Portão do Bela Vista') as eb
from ids;
grant select on ids, ex to dominio;

select results_eq($$ select exemplo_listar(pa, a) from ids $$, array['Vazamento na garagem'], 'lista só o do próprio condomínio');
select throws_ok($$ select exemplo_listar(pa, b) from ids $$, 'TC401', null, 'não lista o condomínio B');
select throws_ok($$ select exemplo_ler(pa, a, eb) from ids, ex $$, 'TC404', null, 'não lê registro do B nem pelo id');
select is((select count(*)::int from ids, exemplo_buscar(pa, a, 'Portão')), 0, 'busca não encontra nada do B');
select throws_ok($$ select exemplo_alterar(pa, a, eb, 1, 'invadido') from ids, ex $$, 'TC404', null, 'não altera registro do B');
select results_eq($$ select exemplo_listar(pb, b) from ids $$, array['Portão do Bela Vista'], 'registro do B continua intacto');
select throws_ok($$ select exemplo_listar(psem, a) from ids $$, 'TC401', null, 'pessoa sem vínculo não entra');
select throws_ok($$ select exemplo_listar(pa, gen_random_uuid()) from ids $$, 'TC401', null,
  'condomínio que não existe responde igual a sem permissão');
select throws_ok($$ select exemplo_listar(gen_random_uuid(), a) from ids $$, 'TC401', null, 'pessoa que não existe não entra');

-- Uma pessoa em dois condomínios (MU-04): cada entrada vê só o condomínio escolhido.
select results_eq($$ select exemplo_listar(pmulti, a) from ids $$, array['Vazamento na garagem'], 'síndico profissional no A vê só o A');
select results_eq($$ select exemplo_listar(pmulti, b) from ids $$, array['Portão do Bela Vista'], 'síndico profissional no B vê só o B');
select results_eq($$ select nome from ids, meus_condominios(pmulti) $$, array['Edifício Bela Vista', 'Residencial Aurora'], 'lista os dois condomínios dele');
select results_eq($$ select nome from ids, meus_condominios(pa) $$, array['Residencial Aurora'], 'a síndica do A só vê o A');
select ok((select acesso_plataforma(pa) from ids), 'quem tem vínculo entra na Plataforma');
select ok(not (select acesso_plataforma(psem) from ids), 'quem não tem vínculo não entra');

-- O RLS direto, como o papel dono das tabelas, sem nenhuma função no caminho.
select set_config('app.pessoa_id', (select pa::text from ids), true), set_config('app.condominio_id', (select a::text from ids), true);
set local role dominio;
select is((select count(*)::int from exemplos where condominio_id = (select b from ids)), 0, 'RLS: filtrar pelo B não traz nada');
select is((select count(*)::int from exemplos), 1, 'RLS: sem filtro, só o A');
select set_config('app.transicao_evento', 'CRIADO', true);
select throws_ok($$ insert into exemplos (condominio_id, titulo) select b, 'x' from ids $$, '42501', null, 'RLS: não grava no B');
select is((select count(*)::int from historico where condominio_id = (select b from ids)), 0, 'RLS: histórico do B não aparece');
select is((select array_agg(nome) from condominios), array['Residencial Aurora'], 'RLS: só o próprio condomínio');
select is((select count(*)::int from pessoas where id = (select pb from ids)), 0, 'RLS: pessoas do B não aparecem');
select is((select count(*)::int from vinculos where condominio_id = (select b from ids)), 0, 'RLS: vínculos do B não aparecem');
select set_config('app.condominio_id', '', true), set_config('app.pessoa_id', '', true);
select is((select count(*)::int from exemplos), 0, 'RLS: sem contexto, nada aparece');
reset role;

-- O condomínio vem da sessão (servidor), nunca do navegador.
select throws_ok($$ select escolher_condominio(pa, sessao, b) from ids $$, 'TC401', null, 'não escolhe condomínio sem vínculo');
select lives_ok($$ select escolher_condominio(pa, sessao, a) from ids $$, 'escolhe o condomínio em que tem vínculo');
select is((select condominio_da_sessao(pa, sessao) from ids), (select a from ids), 'a sessão guarda o condomínio escolhido');
select is((select condominio_da_sessao(pb, sessao) from ids), null, 'a sessão de uma pessoa não serve para outra');
select throws_ok($$ select escolher_condominio(pb, sessao, b) from ids $$, null, 'não toma a sessão de outra pessoa');

-- Negar por padrão (PT-02): ação sem permissão cadastrada não passa.
select throws_ok($$ select entrar_condominio(pa, a, 'exemplos.apagar') from ids $$, 'TC401', null, 'ação não cadastrada é negada');

-- Só quatro funções gravam o contexto da transação (pessoa, equipe e condomínio). A quarta,
-- abrir_condominio_novo, é o cadastro de condomínio no Console (passo 1).
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ 'app\.(pessoa_id|condominio_id|equipe)'
      and p.prosrc ~ 'set_config'),
  array['abrir_condominio_novo', 'entrar_condominio', 'limpar_contexto', 'tentar_definir_pessoa'],
  'só limpar_contexto, tentar_definir_pessoa, entrar_condominio e abrir_condominio_novo gravam o contexto');

select * from finish();
rollback;

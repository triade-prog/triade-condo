-- T1 (PT-06) e F0.2: RLS ligado e forçado em tudo, privilégios fechados, só o servidor acessa.
begin;
select plan(20);

-- A consulta que o teste usa para achar tabela sem RLS (forçado) no esquema public.
create temp view sem_rls as
  select c.relname::text as tabela from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not (c.relrowsecurity and c.relforcerowsecurity);

select is((select array_agg(tabela order by tabela) from sem_rls), null, 'T1: toda tabela do public tem RLS ligado e forçado');

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  null, 'toda tabela tem ao menos uma política (sem política, nada aparece)');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')),
  0, 'anon, authenticated e até o service_role sem privilégio nas tabelas');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'anon e authenticated não executam nenhuma função');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('service_role', p.oid, 'execute') and not p.prosecdef),
  null, 'o service_role só executa as funções da API (security definer)');

-- F0.3: tabela de dado de condomínio usa a política padrão; as outras dizem o porquê.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'isolamento_condominio')
      and not exists (select 1 from tabelas_sem_condominio t where t.tabela = c.relname)),
  null, 'F0.3: toda tabela separa por condomínio ou tem o motivo registrado');
select is(
  (select array_agg(t.tabela order by t.tabela) from tabelas_sem_condominio t
    where not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = t.tabela)),
  null, 'a lista de exceções não guarda tabela que não existe');
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'versao' and not a.attisdropped
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'controle_versao')),
  null, 'AT-24: toda tabela com versão tem o controle de versão');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null, 'toda função e procedimento tem o caminho de busca fixo');
select ok(has_function_privilege('service_role', 'meus_condominios(uuid, text)', 'execute'), 'o servidor chama as funções da API');
select ok(not has_function_privilege('service_role', 'entrar_condominio(uuid, uuid, text)', 'execute'), 'o servidor não grava o contexto direto');

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and pg_get_userbyid(c.relowner) <> 'dominio'),
  null, 'tabelas pertencem ao papel dominio');
select ok((select not rolbypassrls and not rolsuper and not rolcanlogin from pg_roles where rolname = 'dominio'),
  'o dominio não ignora o RLS e não faz login');

-- Tabela nova esquecida sem RLS: a consulta do T1 a encontra, então o teste falharia.
create table tabela_nova (id int);
select is((select array_agg(tabela) from sem_rls), array['tabela_nova'], 'T1: tabela nova sem RLS é encontrada');
call fechar_acesso();
select is((select array_agg(tabela) from sem_rls), null, 'fechar_acesso liga e força o RLS da tabela nova');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_name = 'tabela_nova' and grantee in ('anon', 'authenticated', 'service_role')),
  0, 'tabela nova não fica com privilégio para a API');

set local role anon;
select throws_ok($$ select * from configuracoes $$, '42501', null, 'anon não lê configurações');
select throws_ok($$ select app_now() $$, '42501', null, 'anon não chama funções');
reset role;
set local role service_role;
select throws_ok($$ select * from condominios $$, '42501', null, 'nem a chave de serviço lê as tabelas direto');
reset role;
set local role dominio;
select is((select count(*)::int from condominios), 0, 'sem contexto, o próprio domínio não vê condomínio nenhum');
reset role;

select * from finish();
rollback;

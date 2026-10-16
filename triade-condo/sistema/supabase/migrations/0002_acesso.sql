-- 0002 · Quem acessa o banco e como cada condomínio fica separado (F0.2, F0.3; PT-01, PT-06)
--
-- Regras desta base:
-- 1. Os apps e o navegador nunca falam com as tabelas. Só as Edge Functions falam com o banco,
--    e só chamando funções (security definer). anon, authenticated e até o service_role ficam
--    sem privilégio nenhum nas tabelas.
-- 2. Tabelas e funções pertencem ao papel "dominio", que não ignora o RLS. Todas as tabelas
--    têm RLS ligado e forçado: mesmo as funções do domínio só enxergam o que a política deixa.
-- 3. Toda tabela de dado de condomínio tem condominio_id e a política isolamento_condominio:
--    só aparece a linha do condomínio que está no contexto da transação. Sem contexto, nada.
-- 4. O contexto (pessoa e condomínio) é gravado por definir_pessoa e entrar_condominio (0010),
--    que conferem o vínculo antes. O condomínio vem da sessão no servidor, nunca do navegador.
-- 5. Tabela sem condominio_id só com o motivo registrado em tabelas_sem_condominio.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dominio') then
    create role dominio nologin noinherit nobypassrls;
  end if;
end
$$;
-- Quem roda as migrations precisa ser membro para passar a posse das tabelas e funções.
grant dominio to current_user;
grant usage, create on schema public to dominio;
grant usage on schema extensions to dominio;

-- Contexto da transação. Só leitura aqui; quem grava são as funções de 0010.
create function contexto_pessoa() returns uuid
language sql stable
set search_path = public
as $$ select nullif(current_setting('app.pessoa_id', true), '')::uuid $$;

create function contexto_condominio() returns uuid
language sql stable
set search_path = public
as $$ select nullif(current_setting('app.condominio_id', true), '')::uuid $$;

-- Tabelas que não seguem a política padrão de condomínio, cada uma com o motivo.
create table tabelas_sem_condominio (
  tabela text primary key check (tabela ~ '^[a-z][a-z0-9_]*$'),
  motivo text not null check (length(btrim(motivo)) between 10 and 300)
);

-- Tabela global (configuração, relógio, cadastros de referência): RLS forçado e política
-- aberta ao papel do domínio, com o motivo registrado.
create procedure proteger_tabela_global(p_tabela regclass, p_motivo text)
language plpgsql
set search_path = public
as $$
begin
  execute format('alter table %s enable row level security', p_tabela);
  execute format('alter table %s force row level security', p_tabela);
  if not exists (select 1 from pg_policy where polrelid = p_tabela and polname = 'global') then
    execute format('create policy global on %s using (true) with check (true)', p_tabela);
  end if;
  insert into tabelas_sem_condominio (tabela, motivo) values (p_tabela::text, p_motivo)
  on conflict (tabela) do update set motivo = excluded.motivo;
end $$;

-- Controle de edição simultânea (AT-24): a versão sobe sozinha a cada alteração e ninguém a
-- muda na mão. Quem altera filtra pela versão que leu; se nada mudou, chama conflito_versao.
create function controle_versao() returns trigger
language plpgsql
as $$
begin
  if new.versao is distinct from old.versao then
    raise exception 'A versão é controlada pelo banco' using errcode = 'TC422';
  end if;
  new.versao := old.versao + 1;
  return new;
end $$;

-- Alteração que não achou a versão lida: devolve a versão atual inteira no detalhe, para a
-- tela mostrar o que mudou sem perder o que a pessoa escreveu.
create function conflito_versao(p_tabela regclass, p_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_atual jsonb;
begin
  execute format('select to_jsonb(t) from %s t where id = $1', p_tabela) into v_atual using p_id;
  if v_atual is null then
    raise exception 'Registro não encontrado' using errcode = 'TC404';
  end if;
  raise exception 'Outra pessoa alterou este registro'
    using errcode = 'TC409', detail = jsonb_build_object('versao', v_atual -> 'versao', 'atual', v_atual)::text;
end $$;

-- Tabela de dado de condomínio: confere condominio_id, liga e força o RLS, cria a política
-- de isolamento e, se a tabela tiver versao, o controle de versão.
create procedure proteger_tabela_condominio(p_tabela regclass)
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from pg_attribute
     where attrelid = p_tabela and attname = 'condominio_id' and atttypid = 'uuid'::regtype
       and attnotnull and not attisdropped
  ) then
    raise exception 'A tabela % precisa de condominio_id uuid not null', p_tabela;
  end if;
  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = p_tabela and c.contype = 'f' and c.confrelid = 'public.condominios'::regclass
       and c.conkey = array[(select attnum from pg_attribute where attrelid = p_tabela and attname = 'condominio_id')]
  ) then
    raise exception 'O condominio_id de % precisa referenciar condominios', p_tabela;
  end if;

  execute format('alter table %s enable row level security', p_tabela);
  execute format('alter table %s force row level security', p_tabela);
  if not exists (select 1 from pg_policy where polrelid = p_tabela and polname = 'isolamento_condominio') then
    execute format(
      'create policy isolamento_condominio on %s using (condominio_id = contexto_condominio()) with check (condominio_id = contexto_condominio())',
      p_tabela);
  end if;

  if exists (select 1 from pg_attribute where attrelid = p_tabela and attname = 'versao' and not attisdropped)
     and not exists (select 1 from pg_trigger where tgrelid = p_tabela and tgname = 'controle_versao') then
    execute format('create trigger controle_versao before update on %s for each row execute function controle_versao()', p_tabela);
  end if;
end $$;

-- Fecha o acesso depois de cada migration (todas terminam com call fechar_acesso()):
-- posse para o domínio, RLS forçado em tudo, nenhum privilégio para a API nas tabelas e,
-- nas funções, EXECUTE para o service_role só nas que são security definer (as da API).
create procedure fechar_acesso()
language plpgsql
set search_path = public
as $$
declare
  r record;
  papel text;
begin
  for r in select c.oid::regclass as tabela from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('alter table %s owner to dominio', r.tabela);
    execute format('alter table %s enable row level security', r.tabela);
    execute format('alter table %s force row level security', r.tabela);
  end loop;

  for r in select p.oid::regprocedure as funcao, p.prosecdef
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f'
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('alter function %s owner to dominio', r.funcao);
    execute format('revoke all on function %s from public', r.funcao);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      if r.prosecdef then
        execute format('grant execute on function %s to service_role', r.funcao);
      else
        execute format('revoke all on function %s from service_role', r.funcao);
      end if;
    end if;
  end loop;

  for r in select p.oid::regprocedure as funcao from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'p' loop
    execute format('revoke all on procedure %s from public', r.funcao);
    foreach papel in array array['anon', 'authenticated', 'service_role'] loop
      if exists (select 1 from pg_roles where rolname = papel) then
        execute format('revoke all on procedure %s from %I', r.funcao, papel);
      end if;
    end loop;
  end loop;

  foreach papel in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on all tables in schema public from %I', papel);
      execute format('revoke all on all sequences in schema public from %I', papel);
      if papel <> 'service_role' then
        execute format('revoke all on all functions in schema public from %I', papel);
      end if;
      execute format('alter default privileges in schema public revoke all on tables from %I', papel);
      execute format('alter default privileges in schema public revoke all on sequences from %I', papel);
      execute format('alter default privileges in schema public revoke all on functions from %I', papel);
    end if;
  end loop;
  revoke all on all tables in schema public from public;
  -- O EXECUTE para PUBLIC vem do padrão global do Postgres, que o padrão por esquema não tira.
  alter default privileges revoke execute on functions from public;
end $$;

call proteger_tabela_global('tabelas_sem_condominio', 'Lista das próprias tabelas sem condomínio; só a migration escreve');
call fechar_acesso();

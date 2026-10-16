-- 0001 · Extensões
-- pgcrypto: hashes (limites de uso). pg_cron e pg_net: rotinas e chamada do worker, que
-- chegam com a fila de mensagens. No Supabase as duas existem; no banco local de testes
-- podem faltar e são puladas.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and current_setting('shared_preload_libraries', true) like '%pg_cron%' then
    create extension if not exists pg_cron;
  end if;
end
$$;

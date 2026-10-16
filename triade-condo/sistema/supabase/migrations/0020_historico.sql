-- 0020 · Histórico só de inserção (F0.4; PT-03, PT-13)
-- Nada é apagado em silêncio: nenhuma alteração, exclusão ou TRUNCATE passa. O autor vem do
-- contexto da transação (a pessoa que a sessão validou), nunca de um parâmetro. Senha, token
-- e dado pessoal não entram nos dados: a pessoa aparece só pelo id.

create table historico (
  id            bigint generated always as identity primary key,
  ocorrido_em   timestamptz not null default app_now(),
  -- Vazio só em evento sem condomínio (ex.: login).
  condominio_id uuid references condominios (id) on delete restrict,
  autor_tipo    tipo_autor not null,
  autor_id      uuid references pessoas (id) on delete restrict,
  acao          text not null check (acao ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(acao) <= 80),
  entidade      text not null check (entidade ~ '^[a-z][a-z0-9_]*$' and length(entidade) <= 40),
  entidade_id   text check (length(entidade_id) <= 80),
  dados         jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  check ((autor_tipo = 'PESSOA') = (autor_id is not null))
);

create index historico_condominio_idx on historico (condominio_id, ocorrido_em);
create index historico_entidade_idx on historico (entidade, entidade_id, ocorrido_em);

create function historico_somente_insercao() returns trigger
language plpgsql
as $$
begin
  raise exception 'O histórico é só de inserção (% bloqueado)', tg_op using errcode = 'TC010';
end $$;

create trigger historico_sem_alteracao before update or delete on historico
  for each row execute function historico_somente_insercao();
create trigger historico_sem_truncate before truncate on historico
  for each statement execute function historico_somente_insercao();

alter table historico enable row level security;
alter table historico force row level security;
-- Lê o histórico do condomínio do contexto; o evento sem condomínio, só quem o causou
-- (a própria pessoa, ou o sistema quando não há pessoa).
create policy historico_leitura on historico for select
  using (condominio_id = contexto_condominio() or (condominio_id is null and autor_id is not distinct from contexto_pessoa()));
create policy historico_insercao on historico for insert
  with check (condominio_id is null or condominio_id = contexto_condominio());
insert into tabelas_sem_condominio (tabela, motivo) values
  ('historico', 'Guarda também eventos sem condomínio (login); os do condomínio seguem o contexto');

-- Chaves que nunca entram nos dados, em qualquer nível.
create function historico_tem_dado_proibido(p_dados jsonb) returns boolean
language sql immutable
as $$
  with recursive nos(valor) as (
    select p_dados
    union all
    select filho.value
    from nos
    cross join lateral (
      select e.value from jsonb_each(case when jsonb_typeof(nos.valor) = 'object' then nos.valor else '{}'::jsonb end) e
      union all
      select a.value from jsonb_array_elements(case when jsonb_typeof(nos.valor) = 'array' then nos.valor else '[]'::jsonb end) a
    ) filho
  )
  select exists (
    select 1 from nos, jsonb_object_keys(case when jsonb_typeof(nos.valor) = 'object' then nos.valor else '{}'::jsonb end) k
    where lower(k) in ('senha', 'password', 'token', 'access_token', 'refresh_token', 'token_hash', 'codigo_autenticador',
                       'segredo', 'secret', 'email', 'telefone', 'phone', 'cpf', 'nome', 'name', 'endereco', 'ip')
       or lower(k) like '%token' or lower(k) like '%senha'
  )
$$;

-- Registra um evento no condomínio do contexto, com a pessoa do contexto como autora
-- (ou o sistema, quando não há pessoa).
create function registrar_historico(p_acao text, p_entidade text, p_entidade_id text, p_dados jsonb default '{}'::jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_pessoa uuid := contexto_pessoa();
begin
  if historico_tem_dado_proibido(coalesce(p_dados, '{}'::jsonb)) then
    raise exception 'O histórico não guarda senha, token nem dado pessoal (use o id)' using errcode = 'TC011';
  end if;
  insert into historico (ocorrido_em, condominio_id, autor_tipo, autor_id, acao, entidade, entidade_id, dados)
  values (app_now(), contexto_condominio(), case when v_pessoa is null then 'SISTEMA' else 'PESSOA' end::tipo_autor,
          v_pessoa, p_acao, p_entidade, p_entidade_id, coalesce(p_dados, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- Eventos de acesso chamados pela API (login, saída, recuperação). Sem condomínio.
create function registrar_acesso(p_pessoa uuid, p_acao text, p_dados jsonb default '{}'::jsonb) returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_acao !~ '^acesso\.' then
    raise exception 'Evento de acesso começa com acesso.' using errcode = 'TC422';
  end if;
  perform limpar_contexto();
  if p_pessoa is not null then
    perform definir_pessoa(p_pessoa);
  end if;
  return registrar_historico(p_acao, 'acesso', p_pessoa::text, p_dados);
end $$;

call fechar_acesso();

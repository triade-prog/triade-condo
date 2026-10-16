-- 0010 · Condomínios, pessoas, vínculos e permissão (F0.3, F0.7; PT-01, PT-02, MU-04, CF-04)
--
-- O cliente é o condomínio (DC2): toda informação pertence a um condomínio.
-- Permissão = pessoa + função + condomínio + ação, negando por padrão (PT-02): a pessoa só
-- age num condomínio se tiver lá um vínculo ativo com uma função que permite a ação. A tabela
-- de quem pode o quê (funcao_acoes) só ganha linhas quando a funcionalidade existir (DC8).

create table condominios (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 2 and 120),
  criado_em timestamptz not null default app_now(),
  versao    integer not null default 1
);

-- A pessoa com login. O id é o do Supabase Auth; e-mail e senha ficam só lá (PT-08).
-- Pessoa nunca é apagada: a autoria do histórico aponta para cá.
create table pessoas (
  id        uuid primary key references auth.users (id) on delete restrict,
  nome      text not null check (length(btrim(nome)) between 1 and 120),
  criado_em timestamptz not null default app_now()
);

-- Equipe TRÍADE: entra no Console, sempre com o autenticador (PT-08). Quais condomínios
-- cada pessoa da equipe atende vem dos vínculos, como para todo mundo (PI-10, passo 1).
create table equipe_triade (
  pessoa_id     uuid primary key references pessoas (id) on delete restrict,
  ativa         boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  desativada_em timestamptz
);

-- Funções de um vínculo (síndico, zelador, implantação da TRÍADE...). Cada uma entra com a
-- funcionalidade que a usa; aqui só o síndico, que o passo 1 convida.
create table funcoes (
  codigo  text primary key check (codigo ~ '^[A-Z][A-Z_]{1,39}$'),
  nome    text not null,
  sistema text not null check (sistema in ('PLATAFORMA', 'CONSOLE'))
);
insert into funcoes (codigo, nome, sistema) values ('SINDICO', 'Síndico', 'PLATAFORMA');

-- O que cada função pode fazer. Ação no formato recurso.verbo (ex.: pedidos.responder).
create table funcao_acoes (
  funcao text not null references funcoes (codigo),
  acao   text not null check (acao ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$' and length(acao) <= 80),
  primary key (funcao, acao)
);

create table vinculos (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references pessoas (id) on delete restrict,
  condominio_id uuid not null references condominios (id) on delete restrict,
  funcao        text not null references funcoes (codigo),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  revogado_em   timestamptz,
  revogado_por  uuid references pessoas (id),
  versao        integer not null default 1,
  check ((revogado_em is null) = (revogado_por is null))
);
-- Uma pessoa pode ter vínculo em vários condomínios (MU-04) e mais de uma função em cada um,
-- mas não a mesma função ativa duas vezes no mesmo condomínio.
create unique index vinculos_ativo_unico on vinculos (pessoa_id, condominio_id, funcao) where revogado_em is null;
create index vinculos_pessoa_idx on vinculos (pessoa_id) where revogado_em is null;
create index vinculos_condominio_idx on vinculos (condominio_id);

-- Vínculo não se apaga: revogado, deixa de agir, e a autoria antiga continua (CF-04).
create function vinculos_sem_exclusao() returns trigger
language plpgsql
as $$
begin
  raise exception 'Vínculo não se apaga: revogue' using errcode = 'TC010';
end $$;
create trigger vinculos_sem_exclusao before delete on vinculos
  for each row execute function vinculos_sem_exclusao();

-- Revogado é para sempre: um vínculo novo nasce se a pessoa voltar.
create function vinculos_revogacao_definitiva() returns trigger
language plpgsql
as $$
begin
  if old.revogado_em is not null then
    raise exception 'Vínculo revogado não volta: crie um novo' using errcode = 'TC422';
  end if;
  if (new.pessoa_id, new.condominio_id, new.funcao, new.criado_em, new.criado_por)
     is distinct from (old.pessoa_id, old.condominio_id, old.funcao, old.criado_em, old.criado_por) then
    raise exception 'Vínculo só muda para revogado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger vinculos_revogacao_definitiva before update on vinculos
  for each row execute function vinculos_revogacao_definitiva();

-- Condomínio escolhido em cada sessão do Supabase Auth (claim session_id). O navegador nunca
-- manda o condomínio nas chamadas: ele vem daqui, e o vínculo é conferido de novo a cada uso.
create table sessoes_condominio (
  sessao_id     uuid primary key,
  pessoa_id     uuid not null references pessoas (id) on delete restrict,
  condominio_id uuid not null references condominios (id) on delete restrict,
  escolhido_em  timestamptz not null default app_now()
);

-- Políticas próprias (as demais tabelas de condomínio usam proteger_tabela_condominio).
alter table condominios enable row level security;
alter table condominios force row level security;
create policy condominio_do_contexto on condominios
  using (id = contexto_condominio()
         or exists (select 1 from vinculos v
                     where v.condominio_id = condominios.id and v.pessoa_id = contexto_pessoa() and v.revogado_em is null))
  with check (id = contexto_condominio());

alter table pessoas enable row level security;
alter table pessoas force row level security;
create policy pessoa_visivel on pessoas
  using (id = contexto_pessoa()
         or exists (select 1 from vinculos v where v.pessoa_id = pessoas.id and v.condominio_id = contexto_condominio()))
  with check (true);

alter table vinculos enable row level security;
alter table vinculos force row level security;
create policy vinculo_visivel on vinculos
  using (condominio_id = contexto_condominio() or pessoa_id = contexto_pessoa())
  with check (condominio_id = contexto_condominio());
create trigger controle_versao before update on vinculos for each row execute function controle_versao();
create trigger controle_versao before update on condominios for each row execute function controle_versao();

alter table equipe_triade enable row level security;
alter table equipe_triade force row level security;
create policy equipe_propria on equipe_triade using (pessoa_id = contexto_pessoa()) with check (pessoa_id = contexto_pessoa());

alter table sessoes_condominio enable row level security;
alter table sessoes_condominio force row level security;
create policy sessao_propria on sessoes_condominio using (pessoa_id = contexto_pessoa()) with check (pessoa_id = contexto_pessoa());

insert into tabelas_sem_condominio (tabela, motivo) values
  ('condominios', 'É o próprio condomínio: aparece o do contexto e os que a pessoa tem vínculo ativo'),
  ('pessoas', 'Uma pessoa pode ter vínculo com vários condomínios (MU-04); aparece a própria e as do condomínio do contexto'),
  ('vinculos', 'Liga a pessoa ao condomínio; aparecem os do condomínio do contexto e os da própria pessoa'),
  ('equipe_triade', 'Equipe interna da TRÍADE; os condomínios que cada um atende vêm dos vínculos'),
  ('sessoes_condominio', 'Escolha do condomínio por sessão; cada pessoa vê só as próprias');
call proteger_tabela_global('funcoes', 'Lista de funções, igual para todos os condomínios');
call proteger_tabela_global('funcao_acoes', 'O que cada função pode fazer, igual para todos os condomínios');

-- ---------------------------------------------------------------------------------------
-- Contexto e permissão. Só limpar_contexto, tentar_definir_pessoa e entrar_condominio
-- gravam o contexto da transação; um teste garante que nenhuma outra grava.

-- Limpa o contexto: pessoa, condomínio e transição informada. Toda chamada começa limpa.
create function limpar_contexto() returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('app.pessoa_id', '', true);
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.transicao_evento', '', true);
  perform set_config('app.transicao_motivo', '', true);
  perform set_config('app.transicao_sistema', '', true);
end $$;

-- Grava a pessoa que a sessão validou, se ela existir. Diz se deu certo.
create function tentar_definir_pessoa(p_pessoa uuid) returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform limpar_contexto();
  if p_pessoa is null then return false; end if;
  perform set_config('app.pessoa_id', p_pessoa::text, true);
  if not exists (select 1 from pessoas where id = p_pessoa) then
    perform set_config('app.pessoa_id', '', true);
    return false;
  end if;
  return true;
end $$;

-- Começa toda chamada da API: a pessoa que a sessão validou.
create function definir_pessoa(p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if not tentar_definir_pessoa(p_pessoa) then
    raise exception 'Pessoa sem acesso' using errcode = 'TC401';
  end if;
end $$;

-- Negar por padrão: sem vínculo ativo com uma função que permite a ação, não pode.
-- Só enxerga os vínculos da pessoa do contexto (RLS), então chame depois de definir_pessoa.
create function pode(p_pessoa uuid, p_condominio uuid, p_acao text) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from vinculos v join funcao_acoes fa on fa.funcao = v.funcao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio
       and v.revogado_em is null and fa.acao = p_acao)
$$;

-- Entra no condomínio para uma ação. Condomínio que não existe e condomínio sem permissão
-- respondem igual, para não revelar o que existe.
create function entrar_condominio(p_pessoa uuid, p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  if p_condominio is null or not pode(p_pessoa, p_condominio, p_acao) then
    raise exception 'Sem permissão para % neste condomínio', p_acao using errcode = 'TC401';
  end if;
  perform set_config('app.condominio_id', p_condominio::text, true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API (security definer).

-- A pessoa existe e pode entrar na Plataforma: tem ao menos um vínculo ativo de função da Plataforma.
create function acesso_plataforma(p_pessoa uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not tentar_definir_pessoa(p_pessoa) then return false; end if;
  return exists (select 1 from vinculos v join funcoes f on f.codigo = v.funcao
                  where v.pessoa_id = p_pessoa and v.revogado_em is null and f.sistema = 'PLATAFORMA');
end $$;

-- A pessoa é da equipe TRÍADE e está ativa: pode entrar no Console (sempre com autenticador).
create function acesso_console(p_pessoa uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not tentar_definir_pessoa(p_pessoa) then return false; end if;
  return exists (select 1 from equipe_triade where pessoa_id = p_pessoa and ativa);
end $$;

-- Condomínios em que a pessoa tem vínculo ativo, com as funções (síndico profissional, MU-04).
create function meus_condominios(p_pessoa uuid, p_sistema text default 'PLATAFORMA')
returns table (condominio_id uuid, nome text, funcoes text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  return query
    select c.id, c.nome, array_agg(v.funcao order by v.funcao)
      from vinculos v
      join condominios c on c.id = v.condominio_id
      join funcoes f on f.codigo = v.funcao
     where v.pessoa_id = p_pessoa and v.revogado_em is null and f.sistema = p_sistema
     group by c.id, c.nome
     order by c.nome;
end $$;

-- Grava o condomínio escolhido na sessão, se a pessoa tem vínculo ativo lá.
create function escolher_condominio(p_pessoa uuid, p_sessao uuid, p_condominio uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  if p_sessao is null or not exists (
    select 1 from vinculos where pessoa_id = p_pessoa and condominio_id = p_condominio and revogado_em is null
  ) then
    raise exception 'Sem acesso a este condomínio' using errcode = 'TC401';
  end if;
  insert into sessoes_condominio as s (sessao_id, pessoa_id, condominio_id, escolhido_em)
  values (p_sessao, p_pessoa, p_condominio, app_now())
  on conflict (sessao_id) do update set condominio_id = excluded.condominio_id, escolhido_em = excluded.escolhido_em
    where s.pessoa_id = excluded.pessoa_id;
  if not found then
    raise exception 'Sessão de outra pessoa' using errcode = 'TC401';
  end if;
end $$;

-- O condomínio da sessão, só se o vínculo ainda estiver ativo (revogado não age, CF-04).
create function condominio_da_sessao(p_pessoa uuid, p_sessao uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_condominio uuid;
begin
  perform definir_pessoa(p_pessoa);
  select s.condominio_id into v_condominio
    from sessoes_condominio s
   where s.sessao_id = p_sessao and s.pessoa_id = p_pessoa
     and exists (select 1 from vinculos v where v.pessoa_id = p_pessoa and v.condominio_id = s.condominio_id and v.revogado_em is null);
  return v_condominio;
end $$;

call fechar_acesso();

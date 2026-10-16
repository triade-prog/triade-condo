-- 0003 · Configurações, relógio da aplicação e limites de uso (F0.5)
-- Prazos e limites moram em configuracoes, não no código. Toda função lê a hora por
-- app_now(), que os testes adiantam para conferir prazos sem esperar o tempo passar.

create table configuracoes (
  chave      text primary key check (chave ~ '^[a-z][a-z0-9_]*$'),
  valor      jsonb not null,
  descricao  text not null,
  alterada_em timestamptz not null default now()
);

insert into configuracoes (chave, valor, descricao) values
  ('ambiente', '"desenvolvimento"', 'desenvolvimento, teste ou producao; em producao o relógio não pode ser adiantado'),
  ('limite_login_max',                 '5',  'Senhas erradas pelo mesmo e-mail e IP dentro da janela, antes de bloquear'),
  ('limite_login_janela_minutos',      '15', 'Janela e duração do bloqueio do login'),
  ('limite_recuperacao_max',           '3',  'Pedidos de recuperação de senha pelo mesmo e-mail dentro da janela'),
  ('limite_recuperacao_janela_minutos','60', 'Janela dos pedidos de recuperação de senha'),
  ('limite_autenticador_max',          '10', 'Códigos do autenticador por pessoa dentro da janela'),
  ('limite_autenticador_janela_minutos','15', 'Janela dos códigos do autenticador');

create function configuracao(p_chave text) returns jsonb
language sql stable
set search_path = public
as $$ select valor from configuracoes where chave = p_chave $$;

create function configuracao_int(p_chave text) returns integer
language plpgsql stable
set search_path = public
as $$
declare v jsonb := configuracao(p_chave);
begin
  if v is null or jsonb_typeof(v) <> 'number' then
    raise exception 'Configuração % ausente ou não numérica', p_chave using errcode = 'TC002';
  end if;
  return v::integer;
end $$;

-- Relógio: uma linha só, com o quanto o relógio está adiantado (zero fora dos testes).
create table app_relogio (
  id      boolean primary key default true check (id),
  adiantamento interval not null default '0'
);
insert into app_relogio default values;

create function app_now() returns timestamptz
language sql stable
set search_path = public
as $$ select now() + coalesce((select adiantamento from app_relogio), interval '0') $$;

create function ajustar_relogio(p_adiantamento interval) returns timestamptz
language plpgsql
set search_path = public
as $$
begin
  if configuracao('ambiente') = '"producao"' then
    raise exception 'O relógio não pode ser adiantado em produção' using errcode = 'TC003';
  end if;
  update app_relogio set adiantamento = p_adiantamento;
  return app_now();
end $$;

-- Limites de uso (PT-08): contador por chave e janela. A chave nunca leva e-mail nem IP em
-- claro: quem chama manda o sha256.
create table limites_uso (
  chave        text not null check (length(chave) between 1 and 200),
  inicio_janela timestamptz not null,
  usos         integer not null check (usos > 0),
  primary key (chave, inicio_janela)
);

-- Registra um uso e diz se ainda está dentro do limite (true) ou passou (false).
create function contar_uso(p_chave text, p_janela interval, p_max integer) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_usos integer;
begin
  if p_max < 1 or p_janela <= interval '0' then
    raise exception 'Limite inválido' using errcode = 'TC422';
  end if;
  v_inicio := date_bin(p_janela, app_now(), timestamptz '2000-01-01 00:00:00+00');
  insert into limites_uso as l (chave, inicio_janela, usos) values (p_chave, v_inicio, 1)
  on conflict (chave, inicio_janela) do update set usos = l.usos + 1
  returning usos into v_usos;
  return v_usos <= p_max;
end $$;

-- Quanto ainda cabe, sem contar um uso (o login pergunta antes de conferir a senha).
create function dentro_do_limite(p_chave text, p_janela interval, p_max integer) returns boolean
language sql stable
security definer
set search_path = public
as $$
  select coalesce((select usos from limites_uso
                    where chave = p_chave
                      and inicio_janela = date_bin(p_janela, app_now(), timestamptz '2000-01-01 00:00:00+00')), 0) < p_max
$$;

-- Os mesmos limites, pelo tipo cadastrado em configuracoes (limite_<tipo>_max e
-- limite_<tipo>_janela_minutos): login, recuperacao, autenticador.
create function limite_ok(p_tipo text, p_chave text) returns boolean
language sql stable
security definer
set search_path = public
as $$
  select dentro_do_limite(p_tipo || ':' || p_chave,
                          make_interval(mins => configuracao_int('limite_' || p_tipo || '_janela_minutos')),
                          configuracao_int('limite_' || p_tipo || '_max'))
$$;

create function limite_contar(p_tipo text, p_chave text) returns boolean
language sql
security definer
set search_path = public
as $$
  select contar_uso(p_tipo || ':' || p_chave,
                    make_interval(mins => configuracao_int('limite_' || p_tipo || '_janela_minutos')),
                    configuracao_int('limite_' || p_tipo || '_max'))
$$;

create function limpar_limites_uso() returns integer
language sql
security definer
set search_path = public
as $$
  with apagadas as (delete from limites_uso where inicio_janela < app_now() - interval '1 day' returning 1)
  select count(*)::integer from apagadas
$$;

call proteger_tabela_global('configuracoes', 'Prazos e limites do sistema inteiro; o condomínio terá a ficha própria');
call proteger_tabela_global('app_relogio', 'Relógio da aplicação, um só para o banco');
call proteger_tabela_global('limites_uso', 'Contagem de tentativas de login antes de saber a pessoa ou o condomínio');
call fechar_acesso();

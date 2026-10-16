-- 0070 · Configurações do condomínio na Plataforma do síndico (passo 2; V-08, V-09, CF-03,
-- CF-04, CF-05, CF-06, CF-08, CF-09, CF-10, CF-12, AT-04, AT-05, AT-10, AT-25)
--
-- Regras desta parte:
-- 1. O síndico configura o próprio condomínio sem operador TRÍADE (V-08). Tudo começa pronto
--    (modelo do cenário) e só ajusta o que existe (CF-12): nada aqui é obrigatório.
-- 2. Pessoa autorizada (secretária, delegado, conselheiro...) tem vínculo AUTORIZADO, que só
--    deixa ver o painel e as configurações. O resto vem de permissões individuais, dadas pelo
--    síndico (CF-03). O cargo é só um rótulo: não concede nada. Permissão só pode ser dada
--    quando o recurso dela existe (permissao_acoes tem a ação); as outras chegam com os passos.
-- 3. Identificador estável (CF-09): categoria, prioridade, etapa e modelo não se apagam; mudam
--    de nome ou são desativados, e o id continua o mesmo para o histórico.
-- 4. Prazo conta só as horas de atendimento, em fuso do condomínio, pulando feriados (AT-10).
--    Sem horário de atendimento, conta em horas corridas, e o painel avisa.
-- 5. Feriado é data, sem hora: sai como foi escrito ("2026-11-20"), sem conversão de fuso (CF-10).

-- ---------------------------------------------------------------------------------------
-- Pessoas autorizadas e permissões individuais (V-09, CF-03, CF-04).

insert into funcoes (codigo, nome, sistema) values ('AUTORIZADO', 'Pessoa autorizada', 'PLATAFORMA');

-- Cargo é rótulo (Secretária, Subsíndico, Conselho...): não dá permissão nenhuma.
alter table vinculos add column cargo text check (length(btrim(cargo)) between 1 and 60);
-- Permite referência composta (id e condomínio): o que aponta para um vínculo fica no mesmo condomínio.
alter table vinculos add constraint vinculos_id_condominio unique (id, condominio_id);

-- As permissões do CF-03. Aprovar despesas e decisões só passa a um delegado se o síndico der.
create table permissoes (
  codigo    text primary key check (codigo ~ '^[A-Z][A-Z_]{1,39}$'),
  nome      text not null,
  descricao text not null,
  ordem     smallint not null unique
);
insert into permissoes (codigo, nome, descricao, ordem) values
  ('ACOMPANHAR', 'Acompanhar', 'Ver os pedidos e o andamento de cada um.', 1),
  ('RESPONDER', 'Responder', 'Responder aos moradores em nome do condomínio.', 2),
  ('ATUALIZAR', 'Atualizar', 'Mudar a etapa, a categoria e a prioridade dos pedidos.', 3),
  ('CONCLUIR', 'Concluir', 'Encerrar pedidos.', 4),
  ('PUBLICAR', 'Publicar', 'Publicar avisos e comunicados para os moradores.', 5),
  ('CONFIGURAR', 'Configurar', 'Mudar horários, feriados, categorias, prioridades, etapas, modelos de resposta e prazos.', 6),
  ('APROVAR', 'Aprovar', 'Aprovar despesas e decisões. Fica com o síndico, salvo se ele der esta permissão.', 7);
call proteger_tabela_global('permissoes', 'Lista das permissões individuais, igual para todos os condomínios');

-- O que cada permissão deixa fazer. Só ganha linha quando o recurso existe (DC8).
create table permissao_acoes (
  permissao text not null references permissoes (codigo),
  acao      text not null check (acao ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$' and length(acao) <= 80),
  primary key (permissao, acao)
);
call proteger_tabela_global('permissao_acoes', 'O que cada permissão individual deixa fazer, igual para todos os condomínios');

-- Permissões dadas a cada pessoa autorizada. Retirada fica registrada (não se apaga, CF-04).
create table vinculo_permissoes (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  vinculo_id    uuid not null,
  permissao     text not null references permissoes (codigo),
  concedida_em  timestamptz not null default app_now(),
  concedida_por uuid references pessoas (id),
  retirada_em   timestamptz,
  retirada_por  uuid references pessoas (id),
  foreign key (vinculo_id, condominio_id) references vinculos (id, condominio_id),
  check ((retirada_em is null) = (retirada_por is null))
);
create unique index vinculo_permissoes_ativa_unica on vinculo_permissoes (vinculo_id, permissao) where retirada_em is null;

create function vinculo_permissoes_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from vinculos where id = new.vinculo_id and funcao = 'AUTORIZADO' and revogado_em is null) then
      raise exception 'Permissão individual só para pessoa autorizada com vínculo ativo' using errcode = 'TC422';
    end if;
  elsif old.retirada_em is not null
     or (new.condominio_id, new.vinculo_id, new.permissao, new.concedida_em, new.concedida_por)
        is distinct from (old.condominio_id, old.vinculo_id, old.permissao, old.concedida_em, old.concedida_por) then
    raise exception 'Permissão só muda para retirada' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger vinculo_permissoes_regras before insert or update on vinculo_permissoes
  for each row execute function vinculo_permissoes_regras();
create trigger vinculo_permissoes_sem_exclusao before delete on vinculo_permissoes
  for each row execute function somente_insercao();

-- Como os vínculos: aparecem as do condomínio do contexto e as da própria pessoa (pode()
-- confere antes de o condomínio entrar no contexto).
alter table vinculo_permissoes enable row level security;
alter table vinculo_permissoes force row level security;
create policy vinculo_permissao_visivel on vinculo_permissoes
  using (condominio_id = contexto_condominio()
         or exists (select 1 from vinculos v where v.id = vinculo_permissoes.vinculo_id and v.pessoa_id = contexto_pessoa()))
  with check (condominio_id = contexto_condominio());
insert into tabelas_sem_condominio (tabela, motivo) values
  ('vinculo_permissoes', 'Permissões de cada vínculo; aparecem as do condomínio do contexto e as da própria pessoa, como os vínculos');

-- Negar por padrão, agora também com as permissões individuais da pessoa autorizada.
create or replace function pode(p_pessoa uuid, p_condominio uuid, p_acao text) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from vinculos v
      join funcao_acoes fa on fa.funcao = v.funcao
      join funcoes f on f.codigo = v.funcao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio
       and v.revogado_em is null and fa.acao = p_acao
       and (f.sistema = 'PLATAFORMA'
            or (p_pessoa = contexto_pessoa() and v.funcao = any (contexto_equipe_funcoes()))))
  or exists (
    select 1 from vinculos v
      join vinculo_permissoes vp on vp.vinculo_id = v.id and vp.retirada_em is null
      join permissao_acoes pa on pa.permissao = vp.permissao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio
       and v.revogado_em is null and v.funcao = 'AUTORIZADO' and pa.acao = p_acao)
$$;

-- O que a pessoa pode fazer no condomínio agora (para a tela mostrar só o que vale, PI-10).
create function acoes_da_pessoa(p_pessoa uuid, p_condominio uuid) returns text[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct a order by a), '{}') from (
    select fa.acao as a from vinculos v join funcao_acoes fa on fa.funcao = v.funcao join funcoes f on f.codigo = v.funcao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio and v.revogado_em is null and f.sistema = 'PLATAFORMA'
    union
    select pa.acao from vinculos v
      join vinculo_permissoes vp on vp.vinculo_id = v.id and vp.retirada_em is null
      join permissao_acoes pa on pa.permissao = vp.permissao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio and v.revogado_em is null and v.funcao = 'AUTORIZADO') x
$$;

-- O síndico faz tudo do passo 2. A pessoa autorizada vê o painel e as configurações; mudar
-- as configurações vem da permissão Configurar. Autorizar pessoas e escolher os responsáveis
-- pelo atendimento ficam só com o síndico.
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'plataforma.painel.ver'),
  ('SINDICO', 'config.ver'),
  ('SINDICO', 'config.editar'),
  ('SINDICO', 'pessoas.ver'),
  ('SINDICO', 'pessoas.autorizar'),
  ('SINDICO', 'atendimento.responsaveis'),
  ('AUTORIZADO', 'plataforma.painel.ver'),
  ('AUTORIZADO', 'config.ver');
insert into permissao_acoes (permissao, acao) values ('CONFIGURAR', 'config.editar');

-- ---------------------------------------------------------------------------------------
-- Fuso, horários e feriados (CF-06, CF-10).

-- Os quatro fusos do Brasil, sem horário de verão.
create function fuso_valido(p text) returns boolean
language sql immutable
set search_path = public
as $$ select p in ('America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha') $$;

create function fuso_da_uf(p_uf text) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_uf = 'AC' then 'America/Rio_Branco'
    when p_uf in ('AM', 'RR', 'RO', 'MT', 'MS') then 'America/Manaus'
    else 'America/Sao_Paulo' end
$$;

-- Uma linha por condomínio: fuso e responsável padrão da fila (CF-05).
create table configuracao_condominio (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null unique references condominios (id) on delete restrict,
  fuso               text not null default 'America/Sao_Paulo' check (fuso_valido(fuso)),
  responsavel_padrao uuid,
  versao             integer not null default 1,
  foreign key (responsavel_padrao, condominio_id) references vinculos (id, condominio_id)
);
call proteger_tabela_condominio('configuracao_condominio');

-- Intervalos da semana: [{"dia":1,"inicio":"08:00","fim":"12:00"}, ...]. Dia 0 é domingo;
-- fim pode ser 24:00; sem sobreposição no mesmo dia. Madrugada vira dois intervalos.
create function intervalos_validos(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  -- CASE garante a ordem: só converte para hora o que já passou pelo formato.
  select case
    when jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 70 then false
    when exists (
      select 1 from jsonb_array_elements(p) i
       where case
         when jsonb_typeof(i) <> 'object' then true
         when (select array_agg(k order by k) from jsonb_object_keys(i) k) is distinct from array['dia', 'fim', 'inicio'] then true
         when jsonb_typeof(i -> 'dia') <> 'number' or (i ->> 'dia') !~ '^[0-6]$' then true
         when jsonb_typeof(i -> 'inicio') <> 'string' or (i ->> 'inicio') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then true
         when jsonb_typeof(i -> 'fim') <> 'string' or (i ->> 'fim') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then true
         else (i ->> 'inicio')::time >= (i ->> 'fim')::time end) then false
    else not exists (
      select 1 from jsonb_array_elements(p) with ordinality a(v, n), jsonb_array_elements(p) with ordinality b(v, m)
       where a.n < b.m and a.v ->> 'dia' = b.v ->> 'dia'
         and (a.v ->> 'inicio')::time < (b.v ->> 'fim')::time and (b.v ->> 'inicio')::time < (a.v ->> 'fim')::time)
  end
$$;

-- Funcionamento (quando o condomínio funciona) e atendimento (quando os pedidos são tratados).
create table horarios (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  tipo          text not null check (tipo in ('FUNCIONAMENTO', 'ATENDIMENTO')),
  intervalos    jsonb not null default '[]'::jsonb check (intervalos_validos(intervalos)),
  versao        integer not null default 1,
  unique (condominio_id, tipo)
);
call proteger_tabela_condominio('horarios');

create table feriados (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  descricao     text not null check (length(btrim(descricao)) between 2 and 80),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  unique (condominio_id, data)
);
call proteger_tabela_condominio('feriados');

-- ---------------------------------------------------------------------------------------
-- Categorias, prioridades, etapas e modelos de resposta (CF-08, CF-09, AT-04, AT-05, AT-25).
-- "modelo" guarda o código do item que veio pronto do cenário, para não duplicar.

create table categorias (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 2 and 60),
  ativa         boolean not null default true,
  modelo        text check (modelo ~ '^[A-Z][A-Z_]{1,39}$'),
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, modelo)
);
create unique index categorias_nome_ativo on categorias (condominio_id, lower(nome)) where ativa;
call proteger_tabela_condominio('categorias');

-- Prioridade com significado explícito (AT-04); nível 1 é a mais baixa.
create table prioridades (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 2 and 40),
  significado   text not null check (length(btrim(significado)) between 3 and 200),
  nivel         smallint not null check (nivel between 1 and 20),
  ativa         boolean not null default true,
  modelo        text check (modelo ~ '^[A-Z][A-Z_]{1,39}$'),
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, nivel),
  unique (condominio_id, modelo)
);
create unique index prioridades_nome_ativo on prioridades (condominio_id, lower(nome)) where ativa;
call proteger_tabela_condominio('prioridades');

-- Etapa sempre ligada a aberto, em andamento ou encerrado (AT-05); sem categoria vale para
-- todos os pedidos. Situação e categoria não mudam depois (CF-09): para outra, crie outra
-- etapa. "pausa_prazo": enquanto o pedido estiver nela, o prazo para (ex.: aguardando o morador).
create table etapas (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 2 and 40),
  situacao      text not null check (situacao in ('ABERTO', 'EM_ANDAMENTO', 'ENCERRADO')),
  categoria_id  uuid,
  pausa_prazo   boolean not null default false,
  ordem         smallint not null check (ordem between 1 and 100),
  ativa         boolean not null default true,
  modelo        text check (modelo ~ '^[A-Z][A-Z_]{1,39}$'),
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  foreign key (categoria_id, condominio_id) references categorias (id, condominio_id),
  unique (condominio_id, modelo),
  check (not (pausa_prazo and situacao = 'ENCERRADO'))
);
create unique index etapas_nome_ativo on etapas (condominio_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome)) where ativa;
call proteger_tabela_condominio('etapas');

create function etapas_identidade_fixa() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.situacao, new.categoria_id, new.condominio_id) is distinct from (old.situacao, old.categoria_id, old.condominio_id) then
    raise exception 'A situação e a categoria da etapa não mudam: crie outra etapa'
      using errcode = 'TC422', detail = '{"motivo":"ETAPA_IDENTIDADE_FIXA"}';
  end if;
  return new;
end $$;
create trigger etapas_identidade_fixa before update on etapas for each row execute function etapas_identidade_fixa();

create table modelos_resposta (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  titulo        text not null check (length(btrim(titulo)) between 2 and 60),
  texto         text not null check (length(btrim(texto)) between 1 and 2000),
  categoria_id  uuid,
  ativo         boolean not null default true,
  modelo        text check (modelo ~ '^[A-Z][A-Z_]{1,39}$'),
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  foreign key (categoria_id, condominio_id) references categorias (id, condominio_id),
  unique (condominio_id, modelo)
);
call proteger_tabela_condominio('modelos_resposta');

-- Nada disso se apaga (CF-09): desativa.
create trigger categorias_sem_exclusao before delete on categorias for each row execute function somente_insercao();
create trigger prioridades_sem_exclusao before delete on prioridades for each row execute function somente_insercao();
create trigger etapas_sem_exclusao before delete on etapas for each row execute function somente_insercao();
create trigger modelos_resposta_sem_exclusao before delete on modelos_resposta for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Prazo-padrão de retorno (AT-10): a regra geral (sem categoria nem prioridade) e exceções
-- por categoria, por prioridade ou pelas duas. Vale a mais específica.

create table prazos (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  categoria_id  uuid,
  prioridade_id uuid,
  horas         integer not null check (horas between 1 and 720),
  versao        integer not null default 1,
  foreign key (categoria_id, condominio_id) references categorias (id, condominio_id),
  foreign key (prioridade_id, condominio_id) references prioridades (id, condominio_id),
  unique nulls not distinct (condominio_id, categoria_id, prioridade_id)
);
call proteger_tabela_condominio('prazos');

create function prazos_alvo_fixo() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.categoria_id, new.prioridade_id, new.condominio_id) is distinct from (old.categoria_id, old.prioridade_id, old.condominio_id) then
    raise exception 'Prazo não muda de categoria nem de prioridade: tire e crie outro' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger prazos_alvo_fixo before update on prazos for each row execute function prazos_alvo_fixo();

-- Horas do prazo para uma categoria e prioridade: as duas > só a prioridade > só a
-- categoria > a regra geral.
create function horas_de_prazo(p_condominio uuid, p_categoria uuid, p_prioridade uuid) returns integer
language sql stable
set search_path = public
as $$
  select horas from prazos
   where condominio_id = p_condominio
     and (categoria_id is null or categoria_id = p_categoria)
     and (prioridade_id is null or prioridade_id = p_prioridade)
   order by (prioridade_id is not null) desc, (categoria_id is not null) desc
   limit 1
$$;

-- Quando vence um prazo de p_horas aberto em p_inicio (AT-10): conta só as horas de
-- atendimento no fuso do condomínio e pula os feriados. Sem horário de atendimento, horas
-- corridas. Chame com o condomínio no contexto.
create function vencimento_do_prazo(p_condominio uuid, p_inicio timestamptz, p_horas integer) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso      text;
  v_intervalos jsonb;
  v_local     timestamp;
  v_restante  interval := make_interval(hours => p_horas);
  v_dia       date;
  v_ini       timestamp;
  v_fim       timestamp;
  v_livre     interval;
  i           record;
begin
  if p_horas is null or p_horas < 1 then
    raise exception 'Prazo inválido' using errcode = 'TC422';
  end if;
  select c.fuso, h.intervalos into v_fuso, v_intervalos
    from configuracao_condominio c join horarios h on h.condominio_id = c.condominio_id and h.tipo = 'ATENDIMENTO'
   where c.condominio_id = p_condominio;
  if v_fuso is null then
    raise exception 'Condomínio sem configuração' using errcode = 'TC404';
  end if;
  if jsonb_array_length(v_intervalos) = 0 then
    return p_inicio + v_restante;
  end if;
  v_local := p_inicio at time zone v_fuso;
  -- Mais de um ano sem atendimento só se todos os dias forem feriado: não acontece.
  for d in 0..400 loop
    v_dia := v_local::date + d;
    continue when exists (select 1 from feriados where condominio_id = p_condominio and data = v_dia);
    for i in select (x ->> 'inicio')::time as inicio, (x ->> 'fim')::time as fim
               from jsonb_array_elements(v_intervalos) x
              where (x ->> 'dia')::int = extract(dow from v_dia)::int
              order by 1 loop
      v_ini := greatest(v_dia + i.inicio, v_local);
      v_fim := v_dia + i.fim;
      continue when v_ini >= v_fim;
      v_livre := v_fim - v_ini;
      if v_livre >= v_restante then
        return (v_ini + v_restante) at time zone v_fuso;
      end if;
      v_restante := v_restante - v_livre;
    end loop;
  end loop;
  raise exception 'Não foi possível calcular o prazo' using errcode = 'TC422';
end $$;

-- ---------------------------------------------------------------------------------------
-- Responsáveis pelo atendimento (CF-05): o síndico ou pessoas autorizadas, cada um marcado
-- como disponível ou não. O responsável padrão da fila precisa estar na lista e disponível.

create table responsaveis_atendimento (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  vinculo_id    uuid not null,
  disponivel    boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  retirado_em   timestamptz,
  retirado_por  uuid references pessoas (id),
  foreign key (vinculo_id, condominio_id) references vinculos (id, condominio_id),
  check ((retirado_em is null) = (retirado_por is null))
);
create unique index responsaveis_atendimento_ativo on responsaveis_atendimento (vinculo_id) where retirado_em is null;
call proteger_tabela_condominio('responsaveis_atendimento');

create function responsaveis_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from vinculos where id = new.vinculo_id and funcao in ('SINDICO', 'AUTORIZADO') and revogado_em is null) then
      raise exception 'Responsável é o síndico ou uma pessoa autorizada, com vínculo ativo'
        using errcode = 'TC422', detail = '{"motivo":"RESPONSAVEL_INVALIDO"}';
    end if;
  elsif old.retirado_em is not null
     or (new.condominio_id, new.vinculo_id, new.criado_em, new.criado_por)
        is distinct from (old.condominio_id, old.vinculo_id, old.criado_em, old.criado_por) then
    raise exception 'Responsável só muda a disponibilidade ou é retirado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger responsaveis_regras before insert or update on responsaveis_atendimento
  for each row execute function responsaveis_regras();
create trigger responsaveis_sem_exclusao before delete on responsaveis_atendimento
  for each row execute function somente_insercao();

-- O que falta configurar (painel do síndico). Nada é obrigatório; o painel só avisa.
create function pendencias_configuracao(p_condominio uuid) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when not exists (select 1 from horarios h where h.condominio_id = p_condominio and h.tipo = 'ATENDIMENTO'
                                                  and jsonb_array_length(h.intervalos) > 0)
         then 'SEM_HORARIO_ATENDIMENTO' end,
    case when not exists (select 1 from responsaveis_atendimento r where r.condominio_id = p_condominio and r.retirado_em is null)
         then 'SEM_RESPONSAVEL'
         when not exists (select 1 from configuracao_condominio c
                            join responsaveis_atendimento r on r.vinculo_id = c.responsavel_padrao and r.retirado_em is null and r.disponivel
                            join vinculos v on v.id = c.responsavel_padrao and v.revogado_em is null
                           where c.condominio_id = p_condominio)
         then 'SEM_RESPONSAVEL_PADRAO' end
  ], null)
$$;

-- ---------------------------------------------------------------------------------------
-- Modelo pronto do cenário (CF-12, V-04 a V-06). Todo condomínio nasce com a configuração
-- básica; escolher ou trocar o cenário só acrescenta o que falta, nunca apaga.

create function aplicar_modelo_configuracao(p_condominio uuid, p_uf text, p_cenario text) returns void
language plpgsql
set search_path = public
as $$
begin
  insert into configuracao_condominio (condominio_id, fuso)
  select p_condominio, fuso_da_uf(p_uf)
   where not exists (select 1 from configuracao_condominio where condominio_id = p_condominio);

  insert into horarios (condominio_id, tipo)
  select p_condominio, t from unnest(array['FUNCIONAMENTO', 'ATENDIMENTO']) t
   where not exists (select 1 from horarios where condominio_id = p_condominio and tipo = t);

  insert into categorias (condominio_id, nome, modelo)
  select p_condominio, m.nome, m.codigo
    from (values ('MANUTENCAO', 'Manutenção', null), ('LIMPEZA', 'Limpeza', null),
                 ('CONVIVENCIA', 'Barulho e convivência', null), ('SEGURANCA', 'Segurança', null),
                 ('AREAS_COMUNS', 'Áreas comuns e reservas', null), ('FINANCEIRO', 'Boletos e cobrança', null),
                 ('PORTARIA', 'Portaria e acesso', 'PORTARIA'), ('OUTROS', 'Outros assuntos', null)) m(codigo, nome, so_portaria)
   where (m.so_portaria is null or p_cenario in ('PORTARIA_REMOTA', 'PORTARIA_PRESENCIAL'))
     and not exists (select 1 from categorias c where c.condominio_id = p_condominio and c.modelo = m.codigo)
     and not exists (select 1 from categorias c where c.condominio_id = p_condominio and c.ativa and lower(c.nome) = lower(m.nome));

  insert into prioridades (condominio_id, nome, significado, nivel, modelo)
  select p_condominio, m.nome, m.significado, m.nivel, m.codigo
    from (values
      ('BAIXA', 'Baixa', 'Pode esperar a rotina: não afeta a segurança nem o uso do prédio.', 1),
      ('NORMAL', 'Normal', 'Precisa de retorno no prazo de costume: incomoda, mas não impede o uso.', 2),
      ('ALTA', 'Alta', 'Afeta várias unidades ou uma área comum importante: vem antes das normais.', 3),
      ('URGENTE', 'Urgente', 'Risco à segurança ou à saúde, ou dano acontecendo agora (vazamento, pane elétrica). Em emergência, ligue também para os serviços públicos.', 4)
    ) m(codigo, nome, significado, nivel)
   where not exists (select 1 from prioridades p where p.condominio_id = p_condominio and (p.modelo = m.codigo or p.nivel = m.nivel));

  insert into etapas (condominio_id, nome, situacao, pausa_prazo, ordem, modelo)
  select p_condominio, m.nome, m.situacao, m.pausa, m.ordem, m.codigo
    from (values
      ('RECEBIDO', 'Recebido', 'ABERTO', false, 1),
      ('EM_ANALISE', 'Em análise', 'EM_ANDAMENTO', false, 1),
      ('AGUARDANDO_MORADOR', 'Aguardando o morador', 'EM_ANDAMENTO', true, 2),
      ('AGUARDANDO_PRESTADOR', 'Aguardando prestador', 'EM_ANDAMENTO', false, 3),
      ('CONCLUIDO', 'Concluído', 'ENCERRADO', false, 1),
      ('NAO_PROCEDE', 'Não procede', 'ENCERRADO', false, 2)
    ) m(codigo, nome, situacao, pausa, ordem)
   where not exists (select 1 from etapas e where e.condominio_id = p_condominio and e.modelo = m.codigo);

  insert into modelos_resposta (condominio_id, titulo, texto, modelo)
  select p_condominio, m.titulo, m.texto, m.codigo
    from (values
      ('RECEBIDO', 'Recebemos seu pedido', 'Olá! Recebemos seu pedido e vamos dar retorno dentro do prazo informado.'),
      ('CONCLUIDO', 'Pedido concluído', 'Seu pedido foi concluído. Se algo não ficou certo, responda esta mensagem.')
    ) m(codigo, titulo, texto)
   where not exists (select 1 from modelos_resposta r where r.condominio_id = p_condominio and r.modelo = m.codigo);

  -- Prazos só na primeira vez (tirar uma exceção não a faz voltar): regra geral de 24 horas
  -- de atendimento; urgente, 4.
  if not exists (select 1 from prazos where condominio_id = p_condominio) then
    insert into prazos (condominio_id, horas) values (p_condominio, 24);
    insert into prazos (condominio_id, prioridade_id, horas)
    select p_condominio, p.id, 4 from prioridades p where p.condominio_id = p_condominio and p.modelo = 'URGENTE';
  end if;
end $$;

create function condominios_modelo_configuracao() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.cenario is distinct from old.cenario then
    perform aplicar_modelo_configuracao(new.id, new.uf, new.cenario);
  end if;
  return null;
end $$;
create trigger condominios_modelo_configuracao after insert or update of cenario on condominios
  for each row execute function condominios_modelo_configuracao();

-- Condomínios que já existiam ganham a configuração básica.
do $$
declare r record;
begin
  for r in select id, uf, cenario from condominios loop
    perform set_config('app.condominio_id', r.id::text, true);
    perform aplicar_modelo_configuracao(r.id, r.uf, r.cenario);
  end loop;
  perform set_config('app.condominio_id', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Ajudantes das funções da API.

-- Pessoa autorizada ativa deste condomínio (o contexto já é o condomínio).
create function exigir_autorizado(p_vinculo uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from vinculos where id = p_vinculo and condominio_id = contexto_condominio()
                                         and funcao = 'AUTORIZADO' and revogado_em is null) then
    raise exception 'Pessoa autorizada não encontrada' using errcode = 'TC404';
  end if;
end $$;

-- Só permissões que existem e cujo recurso já existe (as outras chegam com os passos).
create function exigir_permissoes_disponiveis(p_permissoes text[]) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_permissoes is null or exists (select 1 from unnest(p_permissoes) x
                                      where not exists (select 1 from permissao_acoes pa where pa.permissao = x)) then
    perform recusar_campos('Permissão desconhecida ou ainda sem recurso', 'permissoes');
  end if;
end $$;

-- Grava as permissões da pessoa autorizada: retira as que saíram e acrescenta as novas.
create function gravar_permissoes(p_vinculo uuid, p_permissoes text[], p_autor uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  update vinculo_permissoes set retirada_em = app_now(), retirada_por = p_autor
   where vinculo_id = p_vinculo and retirada_em is null and permissao <> all (p_permissoes);
  insert into vinculo_permissoes (condominio_id, vinculo_id, permissao, concedida_por)
  select contexto_condominio(), p_vinculo, x, p_autor from (select distinct unnest(p_permissoes) as x) n
   where not exists (select 1 from vinculo_permissoes where vinculo_id = p_vinculo and permissao = n.x and retirada_em is null);
end $$;

create function permissoes_do_vinculo(p_vinculo uuid) returns text[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(vp.permissao order by p.ordem), '{}')
    from vinculo_permissoes vp join permissoes p on p.codigo = vp.permissao
   where vp.vinculo_id = p_vinculo and vp.retirada_em is null
$$;

-- Ordena os intervalos (dia, início) para guardar sempre do mesmo jeito.
create function ordenar_intervalos(p jsonb) returns jsonb
language sql immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('dia', (x ->> 'dia')::int, 'inicio', x ->> 'inicio', 'fim', x ->> 'fim')
                            order by (x ->> 'dia')::int, x ->> 'inicio'), '[]'::jsonb)
    from jsonb_array_elements(p) x
$$;

-- Toda etapa geral ativa cobre o começo e o fim do pedido: sobra ao menos uma aberta e uma encerrada.
create function exigir_etapas_essenciais() returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from etapas where categoria_id is null and ativa and situacao = 'ABERTO')
     or not exists (select 1 from etapas where categoria_id is null and ativa and situacao = 'ENCERRADO') then
    perform recusar_motivo('Mantenha ao menos uma etapa geral ativa de aberto e uma de encerrado', 'ETAPA_ESSENCIAL');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções da API da Plataforma (security definer). Todas recebem a pessoa e o condomínio que
-- a sessão validou no servidor; o navegador nunca escolhe o condomínio (F0.3).

-- Painel: o condomínio, o que a pessoa pode fazer e o que falta configurar (V-08).
create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select jsonb_build_object(
    'condominio', jsonb_build_object('id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'cenario', c.cenario),
    'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome),
    'funcoes', coalesce((select jsonb_agg(distinct v.funcao order by v.funcao) from vinculos v join funcoes f on f.codigo = v.funcao
                          where v.pessoa_id = p_pessoa and v.condominio_id = c.id and v.revogado_em is null and f.sistema = 'PLATAFORMA'), '[]'::jsonb),
    'acoes', to_jsonb(acoes_da_pessoa(p_pessoa, c.id)),
    'pendencias', to_jsonb(pendencias_configuracao(c.id)))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

-- Todas as configurações de uma vez (CF-06, CF-08, CF-10, AT-10).
create function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  select jsonb_build_object(
    'fuso', c.fuso,
    'versao', c.versao,
    'horarios', (select jsonb_object_agg(h.tipo, jsonb_build_object('intervalos', h.intervalos, 'versao', h.versao)) from horarios h),
    'feriados', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'data', to_char(f.data, 'YYYY-MM-DD'), 'descricao', f.descricao)
                                           order by f.data) from feriados f), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'ativa', x.ativa, 'versao', x.versao)
                                             order by x.ativa desc, lower(x.nome)) from categorias x), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'significado', x.significado,
                                                                 'nivel', x.nivel, 'ativa', x.ativa, 'versao', x.versao)
                                              order by x.nivel) from prioridades x), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'situacao', x.situacao,
                                                            'categoriaId', x.categoria_id, 'pausaPrazo', x.pausa_prazo,
                                                            'ordem', x.ordem, 'ativa', x.ativa, 'versao', x.versao)
                                         order by array_position(array['ABERTO', 'EM_ANDAMENTO', 'ENCERRADO'], x.situacao), x.ordem, lower(x.nome))
                         from etapas x), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'texto', x.texto,
                                                             'categoriaId', x.categoria_id, 'ativo', x.ativo, 'versao', x.versao)
                                          order by x.ativo desc, lower(x.titulo)) from modelos_resposta x), '[]'::jsonb),
    'prazos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'categoriaId', x.categoria_id, 'prioridadeId', x.prioridade_id,
                                                            'horas', x.horas, 'versao', x.versao)
                                         order by (x.categoria_id is not null), (x.prioridade_id is not null), x.id) from prazos x), '[]'::jsonb),
    'pendencias', to_jsonb(pendencias_configuracao(c.condominio_id)),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar'))
    into v
    from configuracao_condominio c;
  return v;
end $$;

create function plataforma_definir_fuso(p_pessoa uuid, p_condominio uuid, p_versao integer, p_fuso text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if not fuso_valido(p_fuso) then perform recusar_campos('Fuso desconhecido', 'fuso'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set fuso = p_fuso where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('fuso.alterado', 'configuracao_condominio', v_antes.id::text,
                              jsonb_build_object('de', v_antes.fuso, 'para', p_fuso));
  return v_versao;
end $$;

create function plataforma_definir_horarios(p_pessoa uuid, p_condominio uuid, p_tipo text, p_versao integer, p_intervalos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes horarios;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_tipo not in ('FUNCIONAMENTO', 'ATENDIMENTO') then perform recusar_campos('Tipo de horário desconhecido', 'tipo'); end if;
  if p_intervalos is null or not intervalos_validos(p_intervalos) then
    perform recusar_campos('Intervalos inválidos ou sobrepostos', 'intervalos');
  end if;
  select * into v_antes from horarios where tipo = p_tipo;
  update horarios set intervalos = ordenar_intervalos(p_intervalos)
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('horarios', v_antes.id); end if;
  perform registrar_historico('horarios.alterados', 'horarios', v_antes.id::text,
    jsonb_build_object('tipo', p_tipo, 'antes', v_antes.intervalos, 'depois', ordenar_intervalos(p_intervalos)));
  return v_versao;
end $$;

create function plataforma_incluir_feriado(p_pessoa uuid, p_condominio uuid, p_data date, p_descricao text) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    insert into feriados (condominio_id, data, descricao, criado_por) values (p_condominio, p_data, btrim(p_descricao), p_pessoa)
    returning id into v_id;
  exception
    when unique_violation then perform recusar_motivo('Já existe um feriado nesta data', 'FERIADO_REPETIDO');
    when check_violation or not_null_violation then perform recusar_campos('Data ou descrição inválida', 'data', 'descricao');
  end;
  perform registrar_historico('feriado.incluido', 'feriado', v_id::text, jsonb_build_object('data', to_char(p_data, 'YYYY-MM-DD')));
  return v_id;
end $$;

-- Feriado é calendário: tirar um feriado errado não perde autoria, porque o histórico guarda.
create function plataforma_remover_feriado(p_pessoa uuid, p_condominio uuid, p_feriado uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_data date;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  delete from feriados where id = p_feriado returning data into v_data;
  if v_data is null then raise exception 'Feriado não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico('feriado.removido', 'feriado', p_feriado::text, jsonb_build_object('data', to_char(v_data, 'YYYY-MM-DD')));
end $$;

-- Categoria (CF-08, CF-09): sem id cria; com id renomeia ou ativa/desativa, seguindo a versão.
create function plataforma_salvar_categoria(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes categorias;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    if p_id is null then
      insert into categorias (condominio_id, nome) values (p_condominio, btrim(p_nome)) returning id, versao into v_id, v_versao;
      perform registrar_historico('categoria.criada', 'categoria', v_id::text, '{}'::jsonb);
    else
      select * into v_antes from categorias where id = p_id;
      if not found then raise exception 'Categoria não encontrada' using errcode = 'TC404'; end if;
      update categorias set nome = btrim(p_nome), ativa = coalesce(p_ativa, ativa)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('categorias', p_id); end if;
      perform registrar_historico('categoria.alterada', 'categoria', v_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.nome is distinct from btrim(p_nome) then 'nome' end,
        case when v_antes.ativa is distinct from coalesce(p_ativa, v_antes.ativa) then 'ativa' end], null))));
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe uma categoria ativa com este nome', 'NOME_REPETIDO');
    when check_violation or not_null_violation then perform recusar_campos('Nome entre 2 e 60 caracteres', 'nome');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Prioridade (AT-04): sempre com o significado escrito. Nova entra no nível mais alto.
create function plataforma_salvar_prioridade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                             p_significado text, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes prioridades;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    if p_id is null then
      insert into prioridades (condominio_id, nome, significado, nivel)
      values (p_condominio, btrim(p_nome), btrim(p_significado), (select coalesce(max(nivel), 0) + 1 from prioridades))
      returning id, versao into v_id, v_versao;
      perform registrar_historico('prioridade.criada', 'prioridade', v_id::text, '{}'::jsonb);
    else
      select * into v_antes from prioridades where id = p_id;
      if not found then raise exception 'Prioridade não encontrada' using errcode = 'TC404'; end if;
      update prioridades set nome = btrim(p_nome), significado = btrim(p_significado), ativa = coalesce(p_ativa, ativa)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('prioridades', p_id); end if;
      if not exists (select 1 from prioridades where ativa) then
        perform recusar_motivo('Mantenha ao menos uma prioridade ativa', 'PRIORIDADE_ESSENCIAL');
      end if;
      perform registrar_historico('prioridade.alterada', 'prioridade', v_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.nome is distinct from btrim(p_nome) then 'nome' end,
        case when v_antes.significado is distinct from btrim(p_significado) then 'significado' end,
        case when v_antes.ativa is distinct from coalesce(p_ativa, v_antes.ativa) then 'ativa' end], null))));
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe uma prioridade ativa com este nome', 'NOME_REPETIDO');
    when check_violation or not_null_violation then perform recusar_campos('Confira o nome e o significado', 'nome', 'significado');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Etapa (AT-05, CF-09). Criar escolhe a situação e, se quiser, a categoria; depois só muda o
-- nome, a pausa do prazo e se está ativa. Mover pedidos de uma etapa desativada chega com os
-- pedidos (passo 4).
create function plataforma_salvar_etapa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                        p_situacao text, p_categoria uuid, p_pausa_prazo boolean, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes etapas;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    if p_id is null then
      if p_situacao is null or p_situacao not in ('ABERTO', 'EM_ANDAMENTO', 'ENCERRADO') then
        perform recusar_campos('Escolha a situação da etapa', 'situacao');
      end if;
      insert into etapas (condominio_id, nome, situacao, categoria_id, pausa_prazo, ordem)
      values (p_condominio, btrim(p_nome), p_situacao, p_categoria, coalesce(p_pausa_prazo, false),
              (select coalesce(max(ordem), 0) + 1 from etapas where situacao = p_situacao))
      returning id, versao into v_id, v_versao;
      perform registrar_historico('etapa.criada', 'etapa', v_id::text, jsonb_build_object('situacao', p_situacao));
    else
      select * into v_antes from etapas where id = p_id;
      if not found then raise exception 'Etapa não encontrada' using errcode = 'TC404'; end if;
      update etapas set nome = btrim(p_nome), pausa_prazo = coalesce(p_pausa_prazo, pausa_prazo), ativa = coalesce(p_ativa, ativa)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('etapas', p_id); end if;
      perform exigir_etapas_essenciais();
      perform registrar_historico('etapa.alterada', 'etapa', v_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.nome is distinct from btrim(p_nome) then 'nome' end,
        case when v_antes.pausa_prazo is distinct from coalesce(p_pausa_prazo, v_antes.pausa_prazo) then 'pausaPrazo' end,
        case when v_antes.ativa is distinct from coalesce(p_ativa, v_antes.ativa) then 'ativa' end], null))));
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe uma etapa ativa com este nome', 'NOME_REPETIDO');
    when foreign_key_violation then perform recusar_campos('Categoria não encontrada', 'categoriaId');
    when check_violation or not_null_violation then perform recusar_campos('Confira o nome e a pausa do prazo', 'nome', 'pausaPrazo');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Modelo de resposta (AT-25), opcionalmente de uma categoria.
create function plataforma_salvar_modelo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                         p_texto text, p_categoria uuid, p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes modelos_resposta;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    if p_id is null then
      insert into modelos_resposta (condominio_id, titulo, texto, categoria_id)
      values (p_condominio, btrim(p_titulo), btrim(p_texto), p_categoria)
      returning id, versao into v_id, v_versao;
      perform registrar_historico('modelo.criado', 'modelo_resposta', v_id::text, '{}'::jsonb);
    else
      select * into v_antes from modelos_resposta where id = p_id;
      if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
      update modelos_resposta set titulo = btrim(p_titulo), texto = btrim(p_texto), categoria_id = p_categoria, ativo = coalesce(p_ativo, ativo)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('modelos_resposta', p_id); end if;
      perform registrar_historico('modelo.alterado', 'modelo_resposta', v_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.titulo is distinct from btrim(p_titulo) then 'titulo' end,
        case when v_antes.texto is distinct from btrim(p_texto) then 'texto' end,
        case when v_antes.categoria_id is distinct from p_categoria then 'categoria' end,
        case when v_antes.ativo is distinct from coalesce(p_ativo, v_antes.ativo) then 'ativo' end], null))));
    end if;
  exception
    when foreign_key_violation then perform recusar_campos('Categoria não encontrada', 'categoriaId');
    when check_violation or not_null_violation then perform recusar_campos('Confira o título e o texto', 'titulo', 'texto');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Prazo (AT-10): sem id cria uma exceção; com id muda as horas.
create function plataforma_salvar_prazo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_categoria uuid,
                                        p_prioridade uuid, p_horas integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes integer;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  begin
    if p_id is null then
      if p_categoria is null and p_prioridade is null then
        perform recusar_motivo('A regra geral já existe: mude as horas dela', 'PRAZO_REPETIDO');
      end if;
      insert into prazos (condominio_id, categoria_id, prioridade_id, horas) values (p_condominio, p_categoria, p_prioridade, p_horas)
      returning id, versao into v_id, v_versao;
      perform registrar_historico('prazo.criado', 'prazo', v_id::text,
        jsonb_strip_nulls(jsonb_build_object('categoria_id', p_categoria, 'prioridade_id', p_prioridade, 'horas', p_horas)));
    else
      select horas into v_antes from prazos where id = p_id;
      if v_antes is null then raise exception 'Prazo não encontrado' using errcode = 'TC404'; end if;
      update prazos set horas = p_horas where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('prazos', p_id); end if;
      perform registrar_historico('prazo.alterado', 'prazo', v_id::text, jsonb_build_object('de', v_antes, 'para', p_horas));
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe um prazo para esta combinação', 'PRAZO_REPETIDO');
    when foreign_key_violation then perform recusar_campos('Categoria ou prioridade não encontrada', 'categoriaId', 'prioridadeId');
    when check_violation or not_null_violation then perform recusar_campos('Prazo entre 1 e 720 horas', 'horas');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Tirar uma exceção de prazo. A regra geral não sai: muda as horas.
create function plataforma_remover_prazo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v prazos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  select * into v from prazos where id = p_id;
  if not found then raise exception 'Prazo não encontrado' using errcode = 'TC404'; end if;
  if v.categoria_id is null and v.prioridade_id is null then
    perform recusar_motivo('A regra geral não sai: mude as horas dela', 'PRAZO_GERAL');
  end if;
  delete from prazos where id = p_id and versao = p_versao;
  if not found then perform conflito_versao('prazos', p_id); end if;
  perform registrar_historico('prazo.removido', 'prazo', p_id::text, jsonb_build_object('horas', v.horas));
end $$;

-- Pessoas do condomínio na Plataforma: síndicos (vêm do Console) e pessoas autorizadas, com
-- cargo, permissões e quem atende (CF-02, CF-03, CF-05).
create function plataforma_pessoas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.ver');
  select jsonb_build_object(
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'funcao', v.funcao, 'cargo', v.cargo,
               'permissoes', to_jsonb(permissoes_do_vinculo(v.id)), 'desde', v.criado_em, 'versao', v.versao,
               'responsavel', r.id is not null, 'disponivel', coalesce(r.disponivel, false))
             order by v.funcao = 'AUTORIZADO', p.nome)
        from vinculos v join pessoas p on p.id = v.pessoa_id
        left join responsaveis_atendimento r on r.vinculo_id = v.id and r.retirado_em is null
       where v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null), '[]'::jsonb),
    'responsavelPadrao', c.responsavel_padrao,
    'versao', c.versao,
    'permissoesDisponiveis', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome, 'descricao', x.descricao) order by x.ordem)
        from permissoes x where exists (select 1 from permissao_acoes pa where pa.permissao = x.codigo)), '[]'::jsonb),
    'pendencias', to_jsonb(pendencias_configuracao(p_condominio)))
    into v
    from configuracao_condominio c;
  return v;
end $$;

-- Autorizar uma pessoa (V-09, CF-02, CF-03). A conta no Auth vem antes (a Edge Function
-- convida ou acha pelo e-mail); aqui nasce a pessoa, o vínculo e as permissões.
create function plataforma_autorizar_pessoa(p_pessoa uuid, p_condominio uuid, p_convidado uuid, p_nome text, p_cargo text,
                                            p_permissoes text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.autorizar');
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then perform recusar_campos('Nome inválido', 'nome'); end if;
  perform exigir_permissoes_disponiveis(p_permissoes);
  perform garantir_pessoa(p_convidado, p_nome);
  if exists (select 1 from vinculos where pessoa_id = p_convidado and condominio_id = p_condominio
                                    and funcao in ('SINDICO', 'AUTORIZADO') and revogado_em is null) then
    perform recusar_motivo('Esta pessoa já tem acesso a este condomínio', 'JA_TEM_ACESSO');
  end if;
  begin
    insert into vinculos (pessoa_id, condominio_id, funcao, cargo, criado_por)
    values (p_convidado, p_condominio, 'AUTORIZADO', nullif(btrim(p_cargo), ''), p_pessoa)
    returning id into v_id;
  exception when check_violation then perform recusar_campos('Cargo até 60 caracteres', 'cargo');
  end;
  perform gravar_permissoes(v_id, p_permissoes, p_pessoa);
  perform registrar_historico('pessoa.autorizada', 'vinculo', v_id::text,
    jsonb_build_object('pessoa_id', p_convidado, 'permissoes', to_jsonb(permissoes_do_vinculo(v_id))));
  return v_id;
end $$;

-- Mudar cargo e permissões, seguindo a versão do vínculo (AT-24).
create function plataforma_alterar_pessoa(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer, p_cargo text,
                                          p_permissoes text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes text[];
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.autorizar');
  perform exigir_autorizado(p_vinculo);
  perform exigir_permissoes_disponiveis(p_permissoes);
  v_antes := permissoes_do_vinculo(p_vinculo);
  begin
    update vinculos set cargo = nullif(btrim(p_cargo), '') where id = p_vinculo and versao = p_versao returning versao into v_versao;
  exception when check_violation then perform recusar_campos('Cargo até 60 caracteres', 'cargo');
  end;
  if v_versao is null then perform conflito_versao('vinculos', p_vinculo); end if;
  perform gravar_permissoes(p_vinculo, p_permissoes, p_pessoa);
  perform registrar_historico('pessoa.alterada', 'vinculo', p_vinculo::text,
    jsonb_build_object('antes', to_jsonb(v_antes), 'depois', to_jsonb(permissoes_do_vinculo(p_vinculo))));
  return v_versao;
end $$;

-- Revogar a pessoa autorizada (CF-04, CF-05): para de agir na hora; a autoria fica. Se ela
-- é a responsável padrão da fila, escolha quem assume ou deixe a pendência explícita.
create function plataforma_revogar_pessoa(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer,
                                          p_substituto uuid, p_deixar_pendente boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.autorizar');
  perform exigir_autorizado(p_vinculo);
  select * into v_config from configuracao_condominio;
  if v_config.responsavel_padrao = p_vinculo then
    if p_substituto is not null then
      if p_substituto = p_vinculo or not exists (
        select 1 from responsaveis_atendimento r join vinculos v on v.id = r.vinculo_id and v.revogado_em is null
         where r.vinculo_id = p_substituto and r.retirado_em is null and r.disponivel) then
        perform recusar_motivo('O substituto precisa ser um responsável disponível', 'SUBSTITUTO_INVALIDO');
      end if;
      update configuracao_condominio set responsavel_padrao = p_substituto where id = v_config.id;
    elsif coalesce(p_deixar_pendente, false) then
      update configuracao_condominio set responsavel_padrao = null where id = v_config.id;
    else
      perform recusar_motivo('Esta pessoa é a responsável padrão: escolha quem assume ou deixe pendente', 'SUBSTITUTO_NECESSARIO');
    end if;
  end if;
  update vinculo_permissoes set retirada_em = app_now(), retirada_por = p_pessoa where vinculo_id = p_vinculo and retirada_em is null;
  update responsaveis_atendimento set retirado_em = app_now(), retirado_por = p_pessoa where vinculo_id = p_vinculo and retirado_em is null;
  update vinculos set revogado_em = app_now(), revogado_por = p_pessoa
   where id = p_vinculo and versao = p_versao and revogado_em is null returning versao into v_versao;
  if v_versao is null then perform conflito_versao('vinculos', p_vinculo); end if;
  perform registrar_historico('pessoa.revogada', 'vinculo', p_vinculo::text,
    jsonb_strip_nulls(jsonb_build_object('substituto', p_substituto,
      'pendente', case when v_config.responsavel_padrao = p_vinculo and p_substituto is null then true end)));
end $$;

-- Quem atende (CF-05): a lista inteira de uma vez, com a disponibilidade de cada um, e o
-- responsável padrão da fila, que precisa estar na lista e disponível.
-- p_responsaveis: [{"vinculoId": "...", "disponivel": true}, ...]
create function plataforma_definir_atendimento(p_pessoa uuid, p_condominio uuid, p_versao integer, p_responsaveis jsonb,
                                               p_padrao uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config configuracao_condominio;
  v_versao integer;
  r record;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'atendimento.responsaveis');
  if p_responsaveis is null or jsonb_typeof(p_responsaveis) <> 'array' or jsonb_array_length(p_responsaveis) > 50
     or exists (select 1 from jsonb_array_elements(p_responsaveis) x
                 where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'disponivel') <> 'boolean'
                    or coalesce(x ->> 'vinculoId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     or (select count(distinct x ->> 'vinculoId') from jsonb_array_elements(p_responsaveis) x) <> jsonb_array_length(p_responsaveis) then
    perform recusar_campos('Lista de responsáveis inválida', 'responsaveis');
  end if;
  if exists (select 1 from jsonb_array_elements(p_responsaveis) x
              where not exists (select 1 from vinculos v where v.id = (x ->> 'vinculoId')::uuid and v.condominio_id = p_condominio
                                                         and v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null)) then
    perform recusar_motivo('Responsável é o síndico ou uma pessoa autorizada, com acesso ativo', 'RESPONSAVEL_INVALIDO');
  end if;
  if jsonb_array_length(p_responsaveis) > 0 and p_padrao is null then
    perform recusar_motivo('Escolha o responsável padrão da fila', 'PADRAO_NECESSARIO');
  end if;
  if p_padrao is not null and not exists (select 1 from jsonb_array_elements(p_responsaveis) x
                                           where (x ->> 'vinculoId')::uuid = p_padrao and (x -> 'disponivel')::boolean) then
    perform recusar_motivo('O responsável padrão precisa estar na lista e disponível', 'PADRAO_INDISPONIVEL');
  end if;

  select * into v_config from configuracao_condominio;
  update configuracao_condominio set responsavel_padrao = p_padrao where id = v_config.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_config.id); end if;

  update responsaveis_atendimento set retirado_em = app_now(), retirado_por = p_pessoa
   where retirado_em is null
     and vinculo_id not in (select (x ->> 'vinculoId')::uuid from jsonb_array_elements(p_responsaveis) x);
  for r in select (x ->> 'vinculoId')::uuid as vinculo, (x -> 'disponivel')::boolean as disponivel from jsonb_array_elements(p_responsaveis) x loop
    update responsaveis_atendimento set disponivel = r.disponivel
     where vinculo_id = r.vinculo and retirado_em is null and disponivel is distinct from r.disponivel;
    insert into responsaveis_atendimento (condominio_id, vinculo_id, disponivel, criado_por)
    select p_condominio, r.vinculo, r.disponivel, p_pessoa
     where not exists (select 1 from responsaveis_atendimento where vinculo_id = r.vinculo and retirado_em is null);
  end loop;
  perform registrar_historico('atendimento.alterado', 'configuracao_condominio', v_config.id::text,
    jsonb_build_object('responsaveis', jsonb_array_length(p_responsaveis), 'padrao', p_padrao));
  return v_versao;
end $$;

call fechar_acesso();

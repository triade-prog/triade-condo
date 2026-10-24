-- 0295 · Tabela de preços no Console (plano técnico de 24/10/2026, aprovado pela Carolina em
-- 24/10/2026). Muda a regra 3 da 0291: agora os preços ficam no sistema, numa tabela que só a
-- equipe vê, e o plano de cada cliente pode nascer dela com "Usar a tabela".
--
-- Decisões fechadas (24/10/2026):
-- A. Faixas fixas: até 40, 41 a 100, 101 a 200, 201 a 400 e acima de 400 (sob consulta, sem
--    valores). Os limites não mudam; só os valores, sempre com motivo.
-- B. Três preços por faixa: fundador, cheia e a implantação da cheia. O fundador não tem
--    implantação. Valor vazio é "Valor a definir", nunca zero (PI-07).
-- C. Parâmetros: meses pagos no anual (11), parcelas da implantação (3, só informativo: a
--    cobrança da implantação da 0291 continua uma só), vagas de fundador (5) e a tabela em uso.
-- D. Fundador é só no ciclo mensal e vale 12 meses desde a competência em que o plano começa.
--    No anual vale a tabela cheia (11 × mensal, implantação isenta). Sem vaga, vale a cheia.
-- E. A sugestão ("Usar a tabela") não grava nada: devolve o plano e os quatro conjuntos
--    contratados (um plano por faixa). A gravação continua pelas rotas que já existem.
-- F. Mudar a tabela nunca mexe em plano existente: o plano guarda os valores e só a origem
--    (FUNDADOR, CHEIA ou manual).
-- G. Toda escrita na tabela pede motivo e vai para historico_precos (só inserção) e para o
--    histórico interno. Administração e Financeiro veem e editam; Implantação e Suporte não
--    veem os preços nem o histórico deles (o histórico traz os valores). O síndico nunca vê.
-- H. As vagas de fundador ficam numa tabela global (vagas_fundador): a contagem entre clientes
--    não sai de planos_cliente, que é separado por condomínio. Nenhum cliente atual ocupa vaga.
-- I. Corrige console_sessao (0060), que não devolvia console.pagamentos.ver e .registrar.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos): o
-- salvar com a tabela é uma função nova que envolve console_salvar_plano.

-- ---------------------------------------------------------------------------------------
-- Quem vê e quem edita (PI-10). O plano do cliente continua só da Administração.

insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'console.precos.ver'),
  ('ADMINISTRACAO', 'console.precos.editar'),
  ('FINANCEIRO', 'console.precos.ver'),
  ('FINANCEIRO', 'console.precos.editar');

-- Tabela de preços: global, só para quem é da equipe e pode ver; para gravar, quem pode editar.
create procedure proteger_tabela_precos(p_tabela regclass, p_motivo text)
language plpgsql
set search_path = public
as $$
begin
  execute format('alter table %s enable row level security', p_tabela);
  execute format('alter table %s force row level security', p_tabela);
  if not exists (select 1 from pg_policy where polrelid = p_tabela and polname = 'so_precos') then
    execute format('create policy so_precos on %s using (contexto_equipe() and pode_global(''console.precos.ver'')) '
                   'with check (contexto_equipe() and pode_global(''console.precos.editar''))', p_tabela);
  end if;
  if exists (select 1 from pg_attribute where attrelid = p_tabela and attname = 'versao' and not attisdropped)
     and not exists (select 1 from pg_trigger where tgrelid = p_tabela and tgname = 'controle_versao') then
    execute format('create trigger controle_versao before update on %s for each row execute function controle_versao()', p_tabela);
  end if;
  insert into tabelas_sem_condominio (tabela, motivo) values (p_tabela::text, p_motivo)
  on conflict (tabela) do update set motivo = excluded.motivo;
end $$;

-- ---------------------------------------------------------------------------------------
-- Faixas (decisões A e B). A semente entra antes de a política ligar.

create table faixas_preco (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique check (codigo in ('ATE_40', 'DE_41_A_100', 'DE_101_A_200', 'DE_201_A_400', 'ACIMA_DE_400')),
  ordem                integer not null unique,
  nome                 text not null check (length(btrim(nome)) between 3 and 40),
  unidades_de          integer not null check (unidades_de >= 1),
  unidades_ate         integer check (unidades_ate >= unidades_de),
  sob_consulta         boolean not null default false,
  fundador_centavos    centavos check (fundador_centavos > 0),
  cheia_centavos       centavos check (cheia_centavos > 0),
  implantacao_centavos centavos check (implantacao_centavos > 0),
  moeda                moeda not null default 'BRL',
  alterado_em          timestamptz,
  alterado_por         uuid references pessoas (id),
  versao               integer not null default 1,
  check (not sob_consulta or (fundador_centavos is null and cheia_centavos is null and implantacao_centavos is null)),
  check ((unidades_ate is null) = sob_consulta)
);

insert into faixas_preco (codigo, ordem, nome, unidades_de, unidades_ate, sob_consulta, fundador_centavos, cheia_centavos, implantacao_centavos) values
  ('ATE_40', 1, 'Até 40 unidades', 1, 40, false, 12900, 19900, 60000),
  ('DE_41_A_100', 2, '41 a 100 unidades', 41, 100, false, 22900, 34900, 90000),
  ('DE_101_A_200', 3, '101 a 200 unidades', 101, 200, false, 34900, 54900, 140000),
  ('DE_201_A_400', 4, '201 a 400 unidades', 201, 400, false, 54900, 84900, 200000),
  ('ACIMA_DE_400', 5, 'Acima de 400 unidades', 401, null, true, null, null, null);
call proteger_tabela_precos('faixas_preco', 'Tabela de preços da TRÍADE por faixa de unidades; só Administração e Financeiro veem');

-- Os limites das faixas não mudam; só os valores. Faixa não se apaga.
create function faixas_preco_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.codigo, new.ordem, new.nome, new.unidades_de, new.unidades_ate, new.sob_consulta, new.moeda)
     is distinct from (old.id, old.codigo, old.ordem, old.nome, old.unidades_de, old.unidades_ate, old.sob_consulta, old.moeda) then
    raise exception 'As faixas são fixas; mude só os valores' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger faixas_preco_regras before update on faixas_preco for each row execute function faixas_preco_regras();
create trigger faixas_preco_sem_exclusao before delete on faixas_preco for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Parâmetros (decisão C): uma linha só.

create table parametros_preco (
  id                   uuid primary key default gen_random_uuid(),
  unica                boolean not null default true unique check (unica),
  meses_pagos_anual    integer not null check (meses_pagos_anual between 1 and 12),
  parcelas_implantacao integer not null check (parcelas_implantacao between 1 and 12),
  vagas_fundador       integer not null check (vagas_fundador between 0 and 1000),
  tabela_em_uso        text not null check (tabela_em_uso in ('FUNDADOR', 'CHEIA')),
  alterado_em          timestamptz,
  alterado_por         uuid references pessoas (id),
  versao               integer not null default 1
);
insert into parametros_preco (meses_pagos_anual, parcelas_implantacao, vagas_fundador, tabela_em_uso) values (11, 3, 5, 'FUNDADOR');
call proteger_tabela_precos('parametros_preco', 'Parâmetros da tabela de preços (anual, parcelas, vagas de fundador e tabela em uso); uma linha só');
create trigger parametros_preco_sem_exclusao before delete on parametros_preco for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Concorrentes (para o simulador do Console). Não se apagam: arquivam com motivo.

-- Faixas de um concorrente: até 10, cada uma com "ate" (unidades) e "valor" (centavos), em ordem.
create function faixas_concorrente_validas(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 10
     and not exists (
       select 1 from jsonb_array_elements(p) with ordinality e(f, i)
        where jsonb_typeof(f) <> 'object'
           or exists (select 1 from jsonb_object_keys(f) k where k not in ('ate', 'valor'))
           or case when jsonb_typeof(f -> 'ate') = 'number' and jsonb_typeof(f -> 'valor') = 'number'
                        and (f ->> 'ate') ~ '^[1-9][0-9]{0,8}$' and (f ->> 'valor') ~ '^[1-9][0-9]{0,11}$'
                   then i > 1 and (p -> (i::int - 2) ->> 'ate') ~ '^[0-9]{1,9}$'
                        and (f ->> 'ate')::integer <= (p -> (i::int - 2) ->> 'ate')::integer
                   else true end)
$$;

create table precos_concorrentes (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null check (length(btrim(nome)) between 2 and 80),
  plano                text check (length(btrim(plano)) between 1 and 80),
  modelo               text not null check (modelo in ('FIXO', 'FAIXA', 'POR_UNIDADE')),
  -- FIXO: o valor do mês (a_partir_de quando o site diz "a partir de").
  valor_centavos       centavos check (valor_centavos > 0),
  a_partir_de          boolean not null default false,
  -- FAIXA: [{"ate": 50, "valor": 19700}, ...].
  faixas               jsonb check (faixas is null or faixas_concorrente_validas(faixas)),
  -- POR_UNIDADE: o valor por unidade e o mínimo do mês.
  por_unidade_centavos centavos check (por_unidade_centavos > 0),
  minimo_centavos      centavos check (minimo_centavos > 0),
  moeda                moeda not null default 'BRL',
  fonte                text not null check (length(btrim(fonte)) between 3 and 300),
  -- Visto na fonte oficial; sem conferência é preço de terceiros (o simulador avisa).
  conferido            boolean not null default true,
  lido_em              date not null,
  observacao           text check (length(btrim(observacao)) between 1 and 500),
  criado_em            timestamptz not null default app_now(),
  criado_por           uuid references pessoas (id),
  alterado_em          timestamptz,
  alterado_por         uuid references pessoas (id),
  arquivado_em         timestamptz,
  arquivado_por        uuid references pessoas (id),
  arquivado_motivo     text check (length(btrim(arquivado_motivo)) between 3 and 500),
  versao               integer not null default 1,
  check (modelo <> 'FIXO' or (valor_centavos is not null and faixas is null and por_unidade_centavos is null and minimo_centavos is null)),
  check (modelo <> 'FAIXA' or (faixas is not null and valor_centavos is null and por_unidade_centavos is null and minimo_centavos is null and not a_partir_de)),
  check (modelo <> 'POR_UNIDADE' or (por_unidade_centavos is not null and valor_centavos is null and faixas is null and not a_partir_de)),
  check ((arquivado_em is null) = (arquivado_motivo is null))
);

-- Preços conferidos nos sites oficiais em 24/10/2026.
insert into precos_concorrentes (nome, plano, modelo, valor_centavos, a_partir_de, faixas, por_unidade_centavos, minimo_centavos, fonte, lido_em) values
  ('iSindi', null, 'FIXO', 2490, false, null, null, null, 'Site oficial', '2026-10-24'),
  ('Seu Síndico IA', null, 'FIXO', 9999, false, null, null, null, 'Site oficial', '2026-10-24'),
  ('MeuVizy', null, 'FIXO', 14900, true, null, null, null, 'Site oficial', '2026-10-24'),
  ('SindIA', null, 'FAIXA', null, false, '[{"ate": 50, "valor": 19700}, {"ate": 150, "valor": 39700}]', null, null, 'Site oficial', '2026-10-24'),
  ('HabitaOne', 'Essencial', 'POR_UNIDADE', null, false, null, 490, 14900, 'Site oficial', '2026-10-24'),
  ('HabitaOne', 'Profissional', 'POR_UNIDADE', null, false, null, 790, 29900, 'Site oficial', '2026-10-24');
call proteger_tabela_precos('precos_concorrentes', 'Preços dos concorrentes para o simulador do Console; só Administração e Financeiro veem');

create function precos_concorrentes_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.arquivado_em is not null then
    raise exception 'Concorrente arquivado não muda' using errcode = 'TC422', detail = '{"motivo":"CONCORRENTE_ARQUIVADO"}';
  end if;
  if (new.id, new.criado_em, new.criado_por) is distinct from (old.id, old.criado_em, old.criado_por) then
    raise exception 'A origem do registro não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger precos_concorrentes_regras before update on precos_concorrentes for each row execute function precos_concorrentes_regras();
create trigger precos_concorrentes_sem_exclusao before delete on precos_concorrentes for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Histórico da tabela (decisão G): só inserção, com antes, depois, motivo, quem e quando.

create table historico_precos (
  id          bigint generated always as identity primary key,
  entidade    text not null check (entidade in ('FAIXA', 'PARAMETROS', 'CONCORRENTE')),
  entidade_id text not null check (length(entidade_id) between 1 and 60),
  acao        text not null check (acao in ('ALTERADA', 'CRIADO', 'ALTERADO', 'ARQUIVADO')),
  antes       jsonb,
  depois      jsonb not null,
  motivo      text not null check (length(btrim(motivo)) between 3 and 500),
  autor_id    uuid not null references pessoas (id),
  criado_em   timestamptz not null default app_now()
);
create index historico_precos_entidade_idx on historico_precos (entidade, entidade_id);
call proteger_tabela_precos('historico_precos', 'Histórico da tabela de preços, só de inserção; traz valores, então só Administração e Financeiro leem');
create trigger historico_precos_somente_insercao before update or delete on historico_precos
  for each row execute function somente_insercao();

-- O evento interno da tabela de preços não tem condomínio: quem vê os preços também o lê (sem
-- isso, o Financeiro não grava o evento, que só a Administração leria). O resto fica como na 0060.
alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver')));

-- ---------------------------------------------------------------------------------------
-- Vagas de fundador (decisão H). Ocupar é inserir; liberar é update; nada se apaga.

create table vagas_fundador (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  ocupada_em      timestamptz not null default app_now(),
  ocupada_por     uuid references pessoas (id),
  liberada_em     timestamptz,
  liberada_por    uuid references pessoas (id),
  liberada_motivo text check (length(btrim(liberada_motivo)) between 3 and 500),
  check ((liberada_em is null) = (liberada_motivo is null))
);
create unique index vagas_fundador_ocupada_unica on vagas_fundador (condominio_id) where liberada_em is null;
alter table vagas_fundador enable row level security;
alter table vagas_fundador force row level security;
create policy so_equipe on vagas_fundador using (contexto_equipe()) with check (contexto_equipe());
insert into tabelas_sem_condominio (tabela, motivo) values
  ('vagas_fundador', 'Vagas de fundador ocupadas entre todos os clientes; a contagem é global e só a equipe vê');

create function vagas_fundador_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.liberada_em is not null
     or (new.id, new.condominio_id, new.ocupada_em, new.ocupada_por) is distinct from (old.id, old.condominio_id, old.ocupada_em, old.ocupada_por)
     or new.liberada_em is null then
    raise exception 'A vaga de fundador só muda para liberada' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger vagas_fundador_regras before update on vagas_fundador for each row execute function vagas_fundador_regras();
create trigger vagas_fundador_sem_exclusao before delete on vagas_fundador for each row execute function somente_insercao();

create function vagas_fundador_ocupadas() returns integer
language sql stable
set search_path = public
as $$ select count(*)::integer from vagas_fundador where liberada_em is null $$;

-- ---------------------------------------------------------------------------------------
-- O plano guarda de onde veio (decisão F). Fundador só no mensal (decisão D).

alter table planos_cliente
  add column tabela_origem text check (tabela_origem in ('FUNDADOR', 'CHEIA')),
  add constraint planos_cliente_fundador_mensal check (tabela_origem is distinct from 'FUNDADOR' or ciclo = 'MENSAL');

-- A origem vem de console_salvar_plano_tabela (app.plano_tabela); salvar sem ela é manual.
create function planos_cliente_tabela_origem() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tabela_origem := nullif(current_setting('app.plano_tabela', true), '');
  return new;
end $$;
create trigger planos_cliente_tabela_origem before insert or update on planos_cliente
  for each row execute function planos_cliente_tabela_origem();

-- Plano de fundador ocupa uma vaga (a sexta é recusada); saindo do fundador, a vaga é liberada.
create function planos_cliente_vaga_fundador() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_vaga uuid;
  v_total integer;
begin
  select id into v_vaga from vagas_fundador where condominio_id = new.condominio_id and liberada_em is null;
  if new.tabela_origem = 'FUNDADOR' and v_vaga is null then
    perform pg_advisory_xact_lock(hashtext('vagas_fundador'));
    select vagas_fundador into v_total from parametros_preco;
    if vagas_fundador_ocupadas() >= coalesce(v_total, 0) then
      perform recusar_motivo('As vagas de fundador acabaram; use a tabela cheia', 'SEM_VAGA_FUNDADOR');
    end if;
    insert into vagas_fundador (condominio_id, ocupada_por) values (new.condominio_id, contexto_pessoa()) returning id into v_vaga;
    perform registrar_historico_interno('vaga_fundador.ocupada', 'vaga_fundador', v_vaga::text, '{}'::jsonb);
  elsif new.tabela_origem is distinct from 'FUNDADOR' and v_vaga is not null then
    update vagas_fundador set liberada_em = app_now(), liberada_por = contexto_pessoa(), liberada_motivo = 'O plano saiu da tabela de fundador'
     where id = v_vaga;
    perform registrar_historico_interno('vaga_fundador.liberada', 'vaga_fundador', v_vaga::text, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger planos_cliente_vaga_fundador after insert or update on planos_cliente
  for each row execute function planos_cliente_vaga_fundador();

-- O plano com a origem; o fundador diz até qual competência vale (12 meses).
create or replace function plano_json(pl planos_cliente) returns jsonb
language sql stable
set search_path = public
as $$
  select case when pl.id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'nome', pl.nome, 'unidadesDe', pl.unidades_de, 'unidadesAte', pl.unidades_ate,
    'valor', pl.valor_centavos, 'moeda', pl.moeda, 'ciclo', pl.ciclo, 'diaVencimento', pl.dia_vencimento,
    'implantacaoValor', pl.implantacao_centavos, 'implantacaoSemCobranca', pl.implantacao_sem_cobranca,
    'implantacaoReferencia', pl.implantacao_referencia, 'inicioCompetencia', pl.inicio_competencia,
    'tabelaOrigem', coalesce(pl.tabela_origem, 'MANUAL'),
    'fundadorAte', case when pl.tabela_origem = 'FUNDADOR' then (pl.inicio_competencia + interval '11 months')::date end,
    'desde', pl.criado_em, 'versao', pl.versao)) end
$$;

-- ---------------------------------------------------------------------------------------
-- Leituras.

create function faixa_preco_json(f faixas_preco, p parametros_preco) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'codigo', f.codigo, 'nome', f.nome, 'ordem', f.ordem, 'unidadesDe', f.unidades_de, 'unidadesAte', f.unidades_ate,
    'sobConsulta', f.sob_consulta, 'fundador', f.fundador_centavos, 'cheia', f.cheia_centavos,
    'implantacao', f.implantacao_centavos, 'anual', f.cheia_centavos * p.meses_pagos_anual,
    'moeda', f.moeda, 'alteradoEm', f.alterado_em, 'alteradoPor', (select nome from pessoas where id = f.alterado_por),
    'versao', f.versao))
$$;

create function parametros_preco_json(p parametros_preco) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'mesesPagosAnual', p.meses_pagos_anual, 'parcelasImplantacao', p.parcelas_implantacao, 'vagasFundador', p.vagas_fundador,
    'tabelaEmUso', p.tabela_em_uso, 'alteradoEm', p.alterado_em, 'alteradoPor', (select nome from pessoas where id = p.alterado_por),
    'versao', p.versao))
$$;

create function concorrente_json(c precos_concorrentes) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'plano', c.plano, 'modelo', c.modelo, 'valor', c.valor_centavos, 'aPartirDe', c.a_partir_de,
    'faixas', c.faixas, 'porUnidade', c.por_unidade_centavos, 'minimo', c.minimo_centavos, 'moeda', c.moeda,
    'fonte', c.fonte, 'conferido', c.conferido, 'lidoEm', c.lido_em, 'observacao', c.observacao, 'arquivado', c.arquivado_em is not null,
    'arquivadoEm', c.arquivado_em, 'arquivadoMotivo', c.arquivado_motivo, 'versao', c.versao))
$$;

create function vagas_fundador_json() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('total', p.vagas_fundador, 'ocupadas', vagas_fundador_ocupadas(),
                            'livres', greatest(p.vagas_fundador - vagas_fundador_ocupadas(), 0))
    from parametros_preco p
$$;

-- A tabela inteira: faixas, parâmetros, vagas e concorrentes (os arquivados no fim).
create function console_tabela_precos(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare p parametros_preco;
begin
  perform entrar_console(p_pessoa, 'console.precos.ver');
  select * into p from parametros_preco;
  return jsonb_build_object(
    'faixas', coalesce((select jsonb_agg(faixa_preco_json(f, p) order by f.ordem) from faixas_preco f), '[]'::jsonb),
    'parametros', parametros_preco_json(p),
    'vagasFundador', vagas_fundador_json(),
    'concorrentes', coalesce((select jsonb_agg(concorrente_json(c) order by c.arquivado_em nulls first, c.nome, c.plano nulls first)
                                from precos_concorrentes c), '[]'::jsonb),
    'podeEditar', pode_global('console.precos.editar'));
end $$;

-- O histórico da tabela, do mais novo para o mais velho, em páginas.
create function console_historico_precos(p_pessoa uuid, p_antes bigint, p_limite integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.precos.ver');
  return jsonb_build_object('eventos', coalesce((
    select jsonb_agg(e order by (e ->> 'id')::bigint desc) from (
      select jsonb_strip_nulls(jsonb_build_object(
               'id', h.id, 'em', h.criado_em, 'entidade', h.entidade, 'entidadeId', h.entidade_id, 'acao', h.acao,
               'antes', h.antes, 'depois', h.depois, 'motivo', h.motivo,
               'autor', (select nome from pessoas where id = h.autor_id))) as e
        from historico_precos h
       where p_antes is null or h.id < p_antes
       order by h.id desc
       limit least(greatest(coalesce(p_limite, 50), 1), 200)) x), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------
-- Escritas na tabela (decisão G): sempre com motivo; nunca mexem em plano existente (F).

create function exigir_motivo_preco(p_motivo text) returns void
language plpgsql
set search_path = public
as $$
begin
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
end $$;

create function registrar_historico_preco(p_entidade text, p_entidade_id text, p_acao text, p_antes jsonb, p_depois jsonb, p_motivo text)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into historico_precos (entidade, entidade_id, acao, antes, depois, motivo, autor_id)
  values (p_entidade, p_entidade_id, p_acao, p_antes, p_depois, btrim(p_motivo), contexto_pessoa());
  perform registrar_historico_interno('precos.' || lower(p_entidade) || '.' || lower(p_acao), 'precos', p_entidade_id,
                                      jsonb_build_object('entidade', p_entidade));
end $$;

create function console_salvar_faixa_preco(p_pessoa uuid, p_codigo text, p_versao integer, p_fundador bigint, p_cheia bigint,
                                           p_implantacao bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f faixas_preco;
  p parametros_preco;
  v_antes jsonb;
begin
  perform entrar_console(p_pessoa, 'console.precos.editar');
  select * into f from faixas_preco where codigo = p_codigo for update;
  if not found then raise exception 'Faixa não encontrada' using errcode = 'TC404'; end if;
  if p_versao is distinct from f.versao then perform conflito_versao('faixas_preco', f.id); end if;
  if f.sob_consulta and (p_fundador is not null or p_cheia is not null or p_implantacao is not null) then
    perform recusar_motivo('Acima de 400 unidades é sob consulta, sem valores na tabela', 'FAIXA_SOB_CONSULTA');
  end if;
  -- Vazio é "Valor a definir", nunca zero (decisão B).
  if p_fundador <= 0 then perform recusar_campos('Deixe vazio para "Valor a definir"', 'fundador'); end if;
  if p_cheia <= 0 then perform recusar_campos('Deixe vazio para "Valor a definir"', 'cheia'); end if;
  if p_implantacao <= 0 then perform recusar_campos('Deixe vazio para "Valor a definir"', 'implantacao'); end if;
  perform exigir_motivo_preco(p_motivo);
  select * into p from parametros_preco;
  v_antes := faixa_preco_json(f, p) - 'alteradoEm' - 'alteradoPor' - 'versao';
  update faixas_preco
     set fundador_centavos = p_fundador, cheia_centavos = p_cheia, implantacao_centavos = p_implantacao,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = f.id
  returning * into f;
  perform registrar_historico_preco('FAIXA', f.codigo, 'ALTERADA', v_antes,
                                    faixa_preco_json(f, p) - 'alteradoEm' - 'alteradoPor' - 'versao', p_motivo);
  return faixa_preco_json(f, p);
end $$;

create function console_salvar_parametros_preco(p_pessoa uuid, p_versao integer, p_meses_pagos_anual integer,
                                                p_parcelas_implantacao integer, p_vagas_fundador integer, p_tabela_em_uso text,
                                                p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p parametros_preco;
  v_antes jsonb;
begin
  perform entrar_console(p_pessoa, 'console.precos.editar');
  select * into p from parametros_preco for update;
  if p_versao is distinct from p.versao then perform conflito_versao('parametros_preco', p.id); end if;
  if p_meses_pagos_anual is null or p_meses_pagos_anual not between 1 and 12 then
    perform recusar_campos('O anual paga de 1 a 12 meses', 'mesesPagosAnual');
  end if;
  if p_parcelas_implantacao is null or p_parcelas_implantacao not between 1 and 12 then
    perform recusar_campos('A implantação vai de 1 a 12 parcelas', 'parcelasImplantacao');
  end if;
  if p_vagas_fundador is null or p_vagas_fundador not between 0 and 1000 then
    perform recusar_campos('Diga quantas vagas de fundador', 'vagasFundador');
  end if;
  if p_tabela_em_uso is null or p_tabela_em_uso not in ('FUNDADOR', 'CHEIA') then
    perform recusar_campos('Escolha a tabela em uso', 'tabelaEmUso');
  end if;
  perform exigir_motivo_preco(p_motivo);
  -- A mesma trava do gatilho que ocupa a vaga: sem ela, diminuir as vagas e ocupar uma ao mesmo
  -- tempo passaria do total configurado.
  perform pg_advisory_xact_lock(hashtext('vagas_fundador'));
  if p_vagas_fundador < vagas_fundador_ocupadas() then
    perform recusar_motivo(format('Já há %s vagas de fundador ocupadas', vagas_fundador_ocupadas()), 'VAGAS_OCUPADAS');
  end if;
  v_antes := parametros_preco_json(p) - 'alteradoEm' - 'alteradoPor' - 'versao';
  update parametros_preco
     set meses_pagos_anual = p_meses_pagos_anual, parcelas_implantacao = p_parcelas_implantacao, vagas_fundador = p_vagas_fundador,
         tabela_em_uso = p_tabela_em_uso, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p.id
  returning * into p;
  perform registrar_historico_preco('PARAMETROS', 'PARAMETROS', 'ALTERADA', v_antes,
                                    parametros_preco_json(p) - 'alteradoEm' - 'alteradoPor' - 'versao', p_motivo);
  return parametros_preco_json(p);
end $$;

-- Concorrente novo (p_id nulo) ou alterado (com a versão lida).
create function console_salvar_concorrente(p_pessoa uuid, p_id uuid, p_versao integer, p_nome text, p_plano text, p_modelo text,
                                           p_valor bigint, p_a_partir_de boolean, p_faixas jsonb, p_por_unidade bigint,
                                           p_minimo bigint, p_fonte text, p_conferido boolean, p_lido_em date, p_observacao text,
                                           p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c precos_concorrentes;
  v_antes jsonb;
begin
  perform entrar_console(p_pessoa, 'console.precos.editar');
  if p_id is not null then
    select * into c from precos_concorrentes where id = p_id for update;
    if not found then raise exception 'Concorrente não encontrado' using errcode = 'TC404'; end if;
    if c.arquivado_em is not null then perform recusar_motivo('Concorrente arquivado não muda', 'CONCORRENTE_ARQUIVADO'); end if;
    if p_versao is distinct from c.versao then perform conflito_versao('precos_concorrentes', c.id); end if;
  end if;
  if coalesce(length(btrim(p_nome)), 0) not between 2 and 80 then perform recusar_campos('Diga o nome', 'nome'); end if;
  if length(btrim(p_plano)) > 80 then perform recusar_campos('Nome do plano longo demais', 'plano'); end if;
  if p_modelo is null or p_modelo not in ('FIXO', 'FAIXA', 'POR_UNIDADE') then perform recusar_campos('Escolha o modelo', 'modelo'); end if;
  if p_modelo = 'FIXO' and (p_valor is null or p_valor <= 0) then perform recusar_campos('Diga o valor', 'valor'); end if;
  if p_modelo = 'FAIXA' and (p_faixas is null or not faixas_concorrente_validas(p_faixas)) then
    perform recusar_campos('Diga as faixas em ordem, cada uma com até quantas unidades e o valor', 'faixas');
  end if;
  if p_modelo = 'POR_UNIDADE' and (p_por_unidade is null or p_por_unidade <= 0) then perform recusar_campos('Diga o valor por unidade', 'porUnidade'); end if;
  if p_minimo <= 0 then perform recusar_campos('Deixe vazio quando não houver mínimo', 'minimo'); end if;
  if coalesce(length(btrim(p_fonte)), 0) not between 3 and 300 then perform recusar_campos('Diga a fonte', 'fonte'); end if;
  if p_lido_em is null or p_lido_em > (app_now() at time zone 'America/Sao_Paulo')::date then
    perform recusar_campos('Diga quando o preço foi lido (até hoje)', 'lidoEm');
  end if;
  if length(btrim(p_observacao)) > 500 then perform recusar_campos('Observação longa demais', 'observacao'); end if;
  perform exigir_motivo_preco(p_motivo);
  if p_id is null then
    insert into precos_concorrentes (nome, plano, modelo, valor_centavos, a_partir_de, faixas, por_unidade_centavos, minimo_centavos,
                                     fonte, conferido, lido_em, observacao, criado_por)
    values (btrim(p_nome), nullif(btrim(p_plano), ''), p_modelo,
            case when p_modelo = 'FIXO' then p_valor end, p_modelo = 'FIXO' and coalesce(p_a_partir_de, false),
            case when p_modelo = 'FAIXA' then p_faixas end,
            case when p_modelo = 'POR_UNIDADE' then p_por_unidade end, case when p_modelo = 'POR_UNIDADE' then p_minimo end,
            btrim(p_fonte), coalesce(p_conferido, true), p_lido_em, nullif(btrim(p_observacao), ''), p_pessoa)
    returning * into c;
    perform registrar_historico_preco('CONCORRENTE', c.id::text, 'CRIADO', null, concorrente_json(c) - 'versao', p_motivo);
  else
    v_antes := concorrente_json(c) - 'versao';
    update precos_concorrentes
       set nome = btrim(p_nome), plano = nullif(btrim(p_plano), ''), modelo = p_modelo,
           valor_centavos = case when p_modelo = 'FIXO' then p_valor end, a_partir_de = p_modelo = 'FIXO' and coalesce(p_a_partir_de, false),
           faixas = case when p_modelo = 'FAIXA' then p_faixas end,
           por_unidade_centavos = case when p_modelo = 'POR_UNIDADE' then p_por_unidade end,
           minimo_centavos = case when p_modelo = 'POR_UNIDADE' then p_minimo end,
           fonte = btrim(p_fonte), conferido = coalesce(p_conferido, true), lido_em = p_lido_em, observacao = nullif(btrim(p_observacao), ''),
           alterado_em = app_now(), alterado_por = p_pessoa
     where id = c.id
    returning * into c;
    perform registrar_historico_preco('CONCORRENTE', c.id::text, 'ALTERADO', v_antes, concorrente_json(c) - 'versao', p_motivo);
  end if;
  return concorrente_json(c);
end $$;

create function console_arquivar_concorrente(p_pessoa uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c precos_concorrentes;
  v_antes jsonb;
begin
  perform entrar_console(p_pessoa, 'console.precos.editar');
  select * into c from precos_concorrentes where id = p_id for update;
  if not found then raise exception 'Concorrente não encontrado' using errcode = 'TC404'; end if;
  if c.arquivado_em is not null then perform recusar_motivo('Este concorrente já está arquivado', 'CONCORRENTE_ARQUIVADO'); end if;
  if p_versao is distinct from c.versao then perform conflito_versao('precos_concorrentes', c.id); end if;
  perform exigir_motivo_preco(p_motivo);
  v_antes := concorrente_json(c) - 'versao';
  update precos_concorrentes set arquivado_em = app_now(), arquivado_por = p_pessoa, arquivado_motivo = btrim(p_motivo)
   where id = c.id
  returning * into c;
  perform registrar_historico_preco('CONCORRENTE', c.id::text, 'ARQUIVADO', v_antes, concorrente_json(c) - 'versao', p_motivo);
  return concorrente_json(c);
end $$;

-- ---------------------------------------------------------------------------------------
-- Sugestão do plano ("Usar a tabela", decisões D e E). Não grava nada.

create function console_sugestao_plano(p_pessoa uuid, p_condominio uuid, p_ciclo text, p_inicio date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pl planos_cliente;
  p parametros_preco;
  f faixas_preco;
  v_unidades integer;
  v_ciclo text := coalesce(p_ciclo, 'MENSAL');
  v_inicio date;
  v_tabela text;
  v_tem_vaga boolean;
  v_livres integer;
  v_avisos text[] := '{}';
  v_valor bigint;
  v_implantacao bigint;
  v_sem_cobranca boolean;
  v_posicao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  if not pode_global('console.precos.ver') then
    raise exception 'Sem permissão para console.precos.ver' using errcode = 'TC401';
  end if;
  if v_ciclo not in ('MENSAL', 'ANUAL') then perform recusar_campos('Escolha o ciclo', 'ciclo'); end if;
  select * into pl from planos_cliente where condominio_id = p_condominio;
  select * into p from parametros_preco;
  v_unidades := unidades_ativas();
  v_inicio := date_trunc('month', coalesce(p_inicio, pl.inicio_competencia, hoje_no_condominio()))::date;
  v_tem_vaga := exists (select 1 from vagas_fundador where condominio_id = p_condominio and liberada_em is null);
  v_livres := greatest(p.vagas_fundador - vagas_fundador_ocupadas(), 0);

  if v_unidades = 0 then
    return jsonb_build_object('unidades', 0, 'ciclo', v_ciclo, 'tabelaEmUso', p.tabela_em_uso, 'vagasFundador', vagas_fundador_json(),
                              'avisos', jsonb_build_array('SEM_UNIDADES'));
  end if;
  select * into f from faixas_preco
   where v_unidades >= unidades_de and (unidades_ate is null or v_unidades <= unidades_ate)
   order by ordem limit 1;

  -- Qual tabela vale: a em uso; fundador só no mensal e com vaga; sob consulta é manual.
  v_tabela := p.tabela_em_uso;
  if f.sob_consulta then
    v_tabela := 'MANUAL';
    v_avisos := array_append(v_avisos, 'SOB_CONSULTA');
  elsif v_tabela = 'FUNDADOR' and v_ciclo = 'ANUAL' then
    v_tabela := 'CHEIA';
    v_avisos := array_append(v_avisos, 'FUNDADOR_SO_MENSAL');
  elsif v_tabela = 'FUNDADOR' and not v_tem_vaga and v_livres = 0 then
    v_tabela := 'CHEIA';
    v_avisos := array_append(v_avisos, 'SEM_VAGA_FUNDADOR');
  end if;

  if v_tabela = 'FUNDADOR' then
    v_valor := f.fundador_centavos;
    v_implantacao := null;
    v_sem_cobranca := true;
  elsif v_tabela = 'CHEIA' and v_ciclo = 'ANUAL' then
    v_valor := f.cheia_centavos * p.meses_pagos_anual;
    v_implantacao := null;
    v_sem_cobranca := true;
  elsif v_tabela = 'CHEIA' then
    v_valor := f.cheia_centavos;
    v_implantacao := f.implantacao_centavos;
    v_sem_cobranca := false;
  else
    v_valor := null;
    v_implantacao := null;
    v_sem_cobranca := false;
  end if;
  -- No fundador, a posição do cliente entre as vagas (a dele, se já ocupa; senão a próxima).
  if v_tabela = 'FUNDADOR' then
    v_posicao := case when v_tem_vaga
                      then (select count(*)::integer from vagas_fundador o, vagas_fundador e
                             where e.condominio_id = p_condominio and e.liberada_em is null and o.liberada_em is null
                               and (o.ocupada_em, o.id) <= (e.ocupada_em, e.id))
                      else vagas_fundador_ocupadas() + 1 end;
  end if;
  if v_valor is null and v_tabela <> 'MANUAL' then v_avisos := array_append(v_avisos, 'VALOR_A_DEFINIR'); end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'unidades', v_unidades,
    'ciclo', v_ciclo,
    'tabelaEmUso', p.tabela_em_uso,
    'vagasFundador', jsonb_strip_nulls(vagas_fundador_json() || jsonb_build_object('esteClienteOcupa', v_tem_vaga, 'posicao', v_posicao)),
    'faixa', jsonb_strip_nulls(jsonb_build_object('codigo', f.codigo, 'nome', f.nome, 'unidadesDe', f.unidades_de,
                                                  'unidadesAte', f.unidades_ate, 'sobConsulta', f.sob_consulta)),
    'plano', jsonb_strip_nulls(jsonb_build_object(
      'nome', case v_tabela when 'FUNDADOR' then 'Fundador, ' when 'CHEIA' then 'Tabela cheia, ' else 'Sob consulta, ' end || lower(f.nome),
      'tabela', v_tabela,
      'unidadesDe', f.unidades_de, 'unidadesAte', f.unidades_ate,
      'valor', v_valor, 'ciclo', v_ciclo,
      'valorMensal', case when v_ciclo = 'ANUAL' and v_tabela = 'CHEIA' then f.cheia_centavos end,
      'mesesPagos', case when v_ciclo = 'ANUAL' and v_tabela = 'CHEIA' then p.meses_pagos_anual end,
      'diaVencimento', coalesce(pl.dia_vencimento, 10),
      'implantacaoValor', v_implantacao, 'implantacaoSemCobranca', v_sem_cobranca,
      'implantacaoParcelas', case when v_implantacao is not null then p.parcelas_implantacao end,
      'inicioCompetencia', v_inicio,
      'fundadorAte', case when v_tabela = 'FUNDADOR' then (v_inicio + interval '11 months')::date end)),
    'conjuntos', (select jsonb_agg(c.codigo order by c.ordem) from conjuntos c where not c.base),
    'avisos', to_jsonb(v_avisos)));
end $$;

-- Salvar o plano dizendo de qual tabela veio (FUNDADOR, CHEIA ou MANUAL). Envolve
-- console_salvar_plano: a origem chega pelo contexto da transação; a vaga é do gatilho.
create function console_salvar_plano_tabela(p_pessoa uuid, p_condominio uuid, p_versao integer, p_nome text, p_unidades_de integer,
                                            p_unidades_ate integer, p_valor bigint, p_ciclo text, p_dia_vencimento integer,
                                            p_implantacao_valor bigint, p_implantacao_sem_cobranca boolean, p_implantacao_referencia text,
                                            p_inicio_competencia date, p_tabela text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabela text := nullif(p_tabela, 'MANUAL');
  v_plano jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.contrato.editar');
  if v_tabela is not null and v_tabela not in ('FUNDADOR', 'CHEIA') then perform recusar_campos('Escolha a tabela', 'tabela'); end if;
  if v_tabela = 'FUNDADOR' and coalesce(p_ciclo, 'MENSAL') <> 'MENSAL' then
    perform recusar_motivo('O preço de fundador é só no ciclo mensal; no anual vale a tabela cheia', 'FUNDADOR_SO_MENSAL');
  end if;
  -- O fundador não tem implantação (decisão B): sem isso, console_salvar_plano criaria a cobrança.
  if v_tabela = 'FUNDADOR' and (p_implantacao_valor is not null or not coalesce(p_implantacao_sem_cobranca, false)) then
    perform recusar_motivo('O preço de fundador não tem implantação', 'FUNDADOR_SEM_IMPLANTACAO');
  end if;
  perform set_config('app.plano_tabela', coalesce(v_tabela, ''), true);
  v_plano := console_salvar_plano(p_pessoa, p_condominio, p_versao, p_nome, p_unidades_de, p_unidades_ate, p_valor, p_ciclo,
                                  p_dia_vencimento, p_implantacao_valor, p_implantacao_sem_cobranca, p_implantacao_referencia,
                                  p_inicio_competencia);
  perform set_config('app.plano_tabela', '', true);
  perform registrar_historico_interno('plano.tabela', 'plano', (select id::text from planos_cliente where condominio_id = p_condominio),
                                      jsonb_build_object('tabela', coalesce(v_tabela, 'MANUAL')));
  return v_plano;
end $$;

-- ---------------------------------------------------------------------------------------
-- Quem está no Console (decisão I): agora com Pagamentos e Tabela de preços no menu.

create or replace function console_sessao(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then
    raise exception 'Só a equipe TRÍADE' using errcode = 'TC401';
  end if;
  select jsonb_build_object(
    'pessoaId', p.id,
    'nome', p.nome,
    'funcoes', to_jsonb(contexto_equipe_funcoes()),
    'acoes', coalesce((select jsonb_agg(distinct fa.acao order by fa.acao) from funcao_acoes fa
                        where fa.funcao = any (contexto_equipe_funcoes())
                          and fa.acao in ('console.condominios.criar', 'console.equipe.gerenciar', 'console.historico.equipe',
                                          'console.pagamentos.ver', 'console.pagamentos.registrar',
                                          'console.precos.ver', 'console.precos.editar')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

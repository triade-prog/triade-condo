-- 0291 · Planos e cobrança dos clientes no Console (peças C3 e C4; PI-03, PI-07, PI-08, PI-16,
-- PI-19, CF-11, NG-01, NG-21). Desenho nos quadros 241 a 255 do canvas do novo frontend,
-- aprovado pela Carolina em 23/10/2026.
--
-- Decisões (todas a opção 1, 23/10/2026):
-- A. A ficha do cliente no Console ganha a parte "Plano e pagamentos".
-- B. O teste de um conjunto tem data para acabar (até 30 dias) e motivo; acaba sozinho.
-- C. Conjunto suspenso continua aberto para consultar e exportar, sem criar nada novo.
-- D. A cobrança do mês é aberta por um botão no Console; nada é criado sozinho.
-- E. O que está fora do plano continua no menu da Plataforma, com cadeado e uma tela que explica.
-- F. O "Meu plano" do síndico mostra o plano e os conjuntos, sem valores nem pagamentos.
--
-- Regras desta parte:
-- 1. Base de atendimento sempre incluída e quatro conjuntos (NG-01). Libera-se o conjunto inteiro,
--    nunca uma tela solta. Um conjunto só vale contratado E liberado (PI-03); o teste é a única
--    exceção, com data e motivo. Cada mudança guarda quem, quando, a referência e o motivo.
-- 2. O banco recusa o que o conjunto não deixa: entrar_condominio confere a ação (agenda.*,
--    manutencao.*, reservas.*...) contra o conjunto. Suspenso ou teste vencido deixa só ver.
-- 3. Nenhum preço fica no sistema: o valor do plano é opcional e, vazio, a cobrança fica
--    "Valor a definir", nunca zero (PI-07).
-- 4. Pagamentos são internos (PI-06): cobrança por competência, recebimento A conferir que só
--    vale depois da conferência, referência que não se repete, ajuste com motivo no lugar de
--    editar e recebimento sem cliente guardado à parte até alguém dizer de quem é. Nada é
--    cobrado nem enviado ao cliente, e nenhum dado bancário é guardado.
-- 5. Atraso não bloqueia nada (PI-08): só aparece como situação a tratar na carteira.

-- ---------------------------------------------------------------------------------------
-- Conjuntos (NG-01): o catálogo, igual para todos.

create table conjuntos (
  codigo text primary key check (codigo ~ '^[A-Z][A-Z_]{1,39}$'),
  nome   text not null check (length(btrim(nome)) between 2 and 60),
  base   boolean not null default false,
  ordem  integer not null unique,
  resumo text not null check (length(btrim(resumo)) between 10 and 300),
  telas  text[] not null,
  -- Prefixos das ações que pertencem ao conjunto (agenda. vale para agenda.ver e agenda.editar).
  acoes  text[] not null default '{}'
);
call proteger_tabela_global('conjuntos', 'Catálogo dos conjuntos de recursos (NG-01), igual para todos os condomínios');

insert into conjuntos (codigo, nome, base, ordem, resumo, telas, acoes) values
  ('ATENDIMENTO', 'Atendimento', true, 1,
   'Pedidos, Decisões, WhatsApp, Comunicados, Documentos, Moradores e unidades, Indicadores e Configurações',
   array['Início', 'Pedidos', 'Decisões', 'WhatsApp', 'Comunicados', 'Documentos', 'Moradores e unidades', 'Indicadores', 'Configurações', 'Pessoas e acesso', 'Ajuda e suporte'],
   '{}'),
  ('AGENDA', 'Agenda', false, 2, 'Agenda com compromissos, feriados e as datas que vêm das outras telas',
   array['Agenda no menu, em Dia a dia', 'Compromissos e feriados', 'As datas de pedidos, manutenção e reservas na mesma agenda'],
   array['agenda.']),
  ('MANUTENCAO', 'Manutenção', false, 3, 'Fichas, preventivas, prestadores, vistoria e o link do prestador',
   array['Manutenção no menu, em Dia a dia', 'Fichas de manutenção, Preventivas e Prestadores', 'Vistoria e o link do prestador'],
   array['manutencao.']),
  ('VIDA', 'Vida em condomínio', false, 4, 'Reservas, enquetes, assembleias e classificados',
   array['Vida em condomínio no menu, em Comunicação', 'Reservas das áreas comuns', 'Enquetes e assembleias', 'Classificados'],
   array['reservas.', 'enquetes.', 'assembleias.', 'classificados.']),
  ('COMUNICACAO_AMPLIADA', 'Comunicação ampliada', false, 5, 'Mural online e e-mail, comunicado pelo WhatsApp e memória do prédio',
   array['Mural online e e-mail dos comunicados', 'Comunicado pelo WhatsApp', 'Dossiê e exportação da memória do prédio'],
   array['memoria.']);

-- O conjunto de cada cliente: contratado (contrato) e liberado (operação) são coisas separadas.
create table conjuntos_cliente (
  id                    uuid primary key default gen_random_uuid(),
  condominio_id         uuid not null references condominios (id) on delete restrict,
  conjunto              text not null references conjuntos (codigo),
  estado                text not null default 'NAO_LIBERADO',
  contratado            boolean not null default false,
  contrato_referencia   text check (length(btrim(contrato_referencia)) between 1 and 120),
  contratado_em         timestamptz,
  contratado_por        uuid references pessoas (id),
  liberado_em           timestamptz,
  liberado_por          uuid references pessoas (id),
  liberacao_referencia  text check (length(btrim(liberacao_referencia)) between 1 and 120),
  liberacao_motivo      text check (length(btrim(liberacao_motivo)) between 3 and 500),
  teste_ate             date,
  teste_motivo          text check (length(btrim(teste_motivo)) between 3 and 500),
  suspenso_em           timestamptz,
  suspenso_por          uuid references pessoas (id),
  suspensao_porque      text check (suspensao_porque in ('CONTRATO_ENCERRADO', 'PEDIDO_CLIENTE', 'TESTE_ENCERRADO', 'OUTRO')),
  suspensao_motivo      text check (length(btrim(suspensao_motivo)) between 3 and 500),
  -- Já esteve liberado alguma vez: o que foi criado continua para consultar (PI-16).
  ja_liberado           boolean not null default false,
  versao                integer not null default 1,
  unique (condominio_id, conjunto),
  check (estado <> 'TESTE' or (teste_ate is not null and teste_motivo is not null)),
  check (estado <> 'LIBERADO' or contratado)
);
call proteger_tabela_condominio('conjuntos_cliente');
call ligar_guardiao('conjuntos_cliente');
insert into estados_iniciais (tabela, estado) values ('conjuntos_cliente', 'NAO_LIBERADO'), ('conjuntos_cliente', 'LIBERADO');
insert into transicoes_permitidas (tabela, de, para) values
  ('conjuntos_cliente', 'NAO_LIBERADO', 'LIBERADO'),
  ('conjuntos_cliente', 'NAO_LIBERADO', 'TESTE'),
  ('conjuntos_cliente', 'TESTE', 'LIBERADO'),
  ('conjuntos_cliente', 'TESTE', 'SUSPENSO'),
  ('conjuntos_cliente', 'LIBERADO', 'SUSPENSO'),
  ('conjuntos_cliente', 'SUSPENSO', 'LIBERADO'),
  ('conjuntos_cliente', 'SUSPENSO', 'TESTE');

-- O conjunto conta para a pessoa usar? COMPLETO, CONSULTA (suspenso ou teste vencido: o que existe
-- continua para ver e exportar) ou FORA. A base é sempre completa.
create function conjunto_modo(p_condominio uuid, p_conjunto text) returns text
language sql stable
set search_path = public
as $$
  select case
    when (select base from conjuntos where codigo = p_conjunto) then 'COMPLETO'
    when cc.id is null then 'FORA'
    when cc.estado = 'LIBERADO' and cc.contratado then 'COMPLETO'
    when cc.estado = 'TESTE' and cc.teste_ate >= hoje_no_condominio() then 'COMPLETO'
    when cc.estado = 'NAO_LIBERADO' and not cc.ja_liberado then 'FORA'
    else 'CONSULTA' end
  from (select 1) x
  left join conjuntos_cliente cc on cc.condominio_id = p_condominio and cc.conjunto = p_conjunto
$$;

create function conjunto_da_acao(p_acao text) returns text
language sql stable
set search_path = public
as $$
  select c.codigo from conjuntos c
   where exists (select 1 from unnest(c.acoes) a where p_acao like a || '%')
   limit 1
$$;

-- O que o plano deixa (regra 2). Ação de ver (e a exportação) passa com o conjunto em consulta.
create function exigir_conjunto(p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_conjunto text := conjunto_da_acao(p_acao);
  v_modo text;
begin
  if v_conjunto is null then return; end if;
  v_modo := conjunto_modo(p_condominio, v_conjunto);
  if v_modo = 'COMPLETO' or (v_modo = 'CONSULTA' and (p_acao like '%.ver' or p_acao = 'memoria.exportar')) then
    return;
  end if;
  perform recusar_motivo(format('%s não está no plano deste condomínio', (select nome from conjuntos where codigo = v_conjunto)),
                         case v_modo when 'CONSULTA' then 'CONJUNTO_SUSPENSO' else 'CONJUNTO_FORA_DO_PLANO' end);
end $$;

-- Entra no condomínio para uma ação, agora também conferindo o conjunto (PI-03).
create or replace function entrar_condominio(p_pessoa uuid, p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  if p_condominio is null or not pode(p_pessoa, p_condominio, p_acao) then
    raise exception 'Sem permissão para % neste condomínio', p_acao using errcode = 'TC401';
  end if;
  perform set_config('app.condominio_id', p_condominio::text, true);
  perform exigir_conjunto(p_condominio, p_acao);
end $$;

-- Mural, e-mail e comunicado pelo WhatsApp são da Comunicação ampliada: só se ligam com ela no
-- plano. Desligar sempre pode.
create function configuracao_exige_comunicacao_ampliada() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if ((new.mural_ligado and not old.mural_ligado) or (new.email_ligado and not old.email_ligado)
      or (new.comunicados_whatsapp and not old.comunicados_whatsapp))
     and conjunto_modo(new.condominio_id, 'COMUNICACAO_AMPLIADA') <> 'COMPLETO' then
    perform recusar_motivo('Comunicação ampliada não está no plano deste condomínio', 'CONJUNTO_FORA_DO_PLANO');
  end if;
  return new;
end $$;
create trigger configuracao_exige_comunicacao_ampliada before update on configuracao_condominio
  for each row execute function configuracao_exige_comunicacao_ampliada();

-- O link do mural e o do prestador só valem com o conjunto no plano.
create or replace function link_vale(l links_publicos) returns boolean
language sql stable
set search_path = public
as $$
  select l.revogado_em is null and (l.expira_em is null or l.expira_em > app_now())
     and (l.tipo <> 'MURAL' or conjunto_modo(l.condominio_id, 'COMUNICACAO_AMPLIADA') = 'COMPLETO')
$$;

create or replace function link_prestador_vale(l links_prestador) returns boolean
language sql stable
set search_path = public
as $$
  select l.revogado_em is null and l.expira_em > app_now()
     and exists (select 1 from manutencoes m where m.id = l.manutencao_id and m.estado not in ('CONCLUIDA', 'CANCELADA'))
     and conjunto_modo(l.condominio_id, 'MANUTENCAO') = 'COMPLETO'
$$;

-- Cliente novo nasce só com a base: cada conjunto fora do plano até ser contratado e liberado.
create function clientes_criar_conjuntos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into conjuntos_cliente (condominio_id, conjunto)
  select new.condominio_id, c.codigo from conjuntos c where not c.base
  on conflict (condominio_id, conjunto) do nothing;
  return new;
end $$;
create trigger clientes_criar_conjuntos after insert on clientes
  for each row execute function clientes_criar_conjuntos();

-- Os clientes de hoje já usam tudo: ficam com todos os conjuntos contratados e liberados, com o
-- motivo registrado (regra explícita, nunca em silêncio).
do $$
declare r record;
begin
  for r in select id from condominios loop
    perform entrar_como_sistema(r.id);
    perform definir_transicao('PLANOS_CRIADOS', 'Cliente anterior aos planos: todos os conjuntos liberados', true);
    insert into conjuntos_cliente (condominio_id, conjunto, estado, contratado, contrato_referencia, contratado_em,
                                   liberado_em, liberacao_referencia, liberacao_motivo, ja_liberado)
    select r.id, c.codigo, 'LIBERADO', true, 'Anterior aos planos', app_now(), app_now(), 'Migration 0291',
           'Cliente anterior aos planos: já usava todos os conjuntos', true
      from conjuntos c where not c.base
    on conflict (condominio_id, conjunto) do nothing;
  end loop;
  perform limpar_contexto();
end $$;

-- ---------------------------------------------------------------------------------------
-- Plano do cliente. O síndico vê o nome, a faixa e os conjuntos (Meu plano); o valor só a equipe.

create table planos_cliente (
  id                       uuid primary key default gen_random_uuid(),
  condominio_id            uuid not null unique references condominios (id) on delete restrict,
  nome                     text not null check (length(btrim(nome)) between 2 and 60),
  unidades_de              integer check (unidades_de >= 0),
  unidades_ate             integer check (unidades_ate >= 1),
  valor_centavos           centavos check (valor_centavos > 0),
  moeda                    moeda not null default 'BRL',
  ciclo                    text not null default 'MENSAL' check (ciclo in ('MENSAL', 'ANUAL')),
  dia_vencimento           integer not null default 10 check (dia_vencimento between 1 and 28),
  implantacao_centavos     centavos check (implantacao_centavos > 0),
  implantacao_sem_cobranca boolean not null default false,
  implantacao_referencia   text check (length(btrim(implantacao_referencia)) between 1 and 120),
  inicio_competencia       date not null check (extract(day from inicio_competencia) = 1),
  criado_em                timestamptz not null default app_now(),
  versao                   integer not null default 1,
  check (unidades_ate is null or unidades_de is null or unidades_ate >= unidades_de),
  check (not (implantacao_sem_cobranca and implantacao_centavos is not null))
);
call proteger_tabela_condominio('planos_cliente');

-- ---------------------------------------------------------------------------------------
-- Pagamentos dos clientes à TRÍADE (PI-07). Internos: o cliente nunca vê (PI-06).

create table cobrancas (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  tipo               text not null check (tipo in ('MENSALIDADE', 'IMPLANTACAO')),
  competencia        date check (extract(day from competencia) = 1),
  referencia         text check (length(btrim(referencia)) between 1 and 120),
  -- Valor desconhecido fica nulo: "Valor a definir", nunca zero.
  valor_centavos     centavos check (valor_centavos > 0),
  moeda              moeda not null default 'BRL',
  vence_em           date not null,
  criada_em          timestamptz not null default app_now(),
  criada_por         uuid references pessoas (id),
  valor_definido_em  timestamptz,
  valor_definido_por uuid references pessoas (id),
  versao             integer not null default 1,
  check ((tipo = 'MENSALIDADE') = (competencia is not null))
);
create unique index cobrancas_mensalidade_unica on cobrancas (condominio_id, competencia) where tipo = 'MENSALIDADE';
create unique index cobrancas_implantacao_unica on cobrancas (condominio_id) where tipo = 'IMPLANTACAO';
call proteger_tabela_interna('cobrancas', 'Cobranças da TRÍADE ao cliente por competência; o cliente não vê (PI-06, PI-07)');

-- A cobrança não se edita: só o valor desconhecido pode ser definido uma vez. O resto é ajuste.
create function cobrancas_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.tipo, new.competencia, new.referencia, new.vence_em, new.criada_em, new.criada_por)
     is distinct from (old.condominio_id, old.tipo, old.competencia, old.referencia, old.vence_em, old.criada_em, old.criada_por)
     or (old.valor_centavos is not null and new.valor_centavos is distinct from old.valor_centavos) then
    raise exception 'A cobrança não se edita; corrija por ajuste, com motivo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger cobrancas_regras before update on cobrancas for each row execute function cobrancas_regras();
create trigger cobrancas_sem_exclusao before delete on cobrancas for each row execute function somente_insercao();

create table ajustes_cobranca (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  cobranca_id    uuid not null references cobrancas (id) on delete restrict,
  tipo           text not null check (tipo in ('DESCONTO', 'ACRESCIMO', 'CORRECAO')),
  valor_centavos bigint not null check (valor_centavos <> 0),
  motivo         text not null check (length(btrim(motivo)) between 3 and 500),
  autor_id       uuid not null references pessoas (id),
  criado_em      timestamptz not null default app_now(),
  check (tipo <> 'DESCONTO' or valor_centavos < 0),
  check (tipo <> 'ACRESCIMO' or valor_centavos > 0)
);
create index ajustes_cobranca_cobranca_idx on ajustes_cobranca (cobranca_id);
call proteger_tabela_interna('ajustes_cobranca', 'Ajustes das cobranças da TRÍADE, com motivo; o cliente não vê (PI-06, PI-07)');
create trigger ajustes_cobranca_somente_insercao before update or delete on ajustes_cobranca
  for each row execute function somente_insercao();

-- Referências de comprovante já usadas, de todos os clientes: a mesma não entra duas vezes. Guarda
-- só o hash da referência.
create table referencias_recebimento (
  hash      bytea primary key check (length(hash) = 32),
  criado_em timestamptz not null default app_now()
);
call proteger_tabela_global('referencias_recebimento', 'Hash das referências de comprovante usadas, para bloquear a repetida entre clientes (PI-07)');

create function hash_referencia(p text) returns bytea
language sql immutable
set search_path = public, extensions
as $$ select extensions.digest(lower(regexp_replace(btrim(p), '\s+', '', 'g')), 'sha256') $$;

create function reservar_referencia(p_referencia text) returns void
language plpgsql
set search_path = public
as $$
begin
  insert into referencias_recebimento (hash) values (hash_referencia(p_referencia));
exception when unique_violation then
  perform recusar_motivo('Esta referência já foi registrada em outro recebimento', 'REFERENCIA_REPETIDA');
end $$;

create table recebimentos (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  cobranca_id      uuid not null references cobrancas (id) on delete restrict,
  estado           text not null default 'A_CONFERIR',
  valor_centavos   centavos not null check (valor_centavos > 0),
  moeda            moeda not null default 'BRL',
  recebido_em      date not null,
  forma            text not null check (forma in ('PIX', 'BOLETO', 'TRANSFERENCIA', 'OUTRO')),
  referencia       text not null check (length(btrim(referencia)) between 3 and 120),
  registrado_por   uuid not null references pessoas (id),
  registrado_em    timestamptz not null default app_now(),
  conferido_por    uuid references pessoas (id),
  conferido_em     timestamptz,
  devolvido_por    uuid references pessoas (id),
  devolvido_em     timestamptz,
  devolvido_motivo text check (length(btrim(devolvido_motivo)) between 3 and 500),
  versao           integer not null default 1,
  check ((estado = 'CONFERIDO') = (conferido_em is not null)),
  check ((estado = 'DEVOLVIDO') = (devolvido_em is not null))
);
create index recebimentos_cobranca_idx on recebimentos (cobranca_id);
call proteger_tabela_interna('recebimentos', 'Recebimentos da TRÍADE, confirmados só depois da conferência; o cliente não vê (PI-06, PI-07)');
call ligar_guardiao('recebimentos');
insert into estados_iniciais (tabela, estado) values ('recebimentos', 'A_CONFERIR');
insert into transicoes_permitidas (tabela, de, para) values
  ('recebimentos', 'A_CONFERIR', 'CONFERIDO'),
  ('recebimentos', 'A_CONFERIR', 'DEVOLVIDO');

-- Recebimento sem cliente (não identificado): fica pendente até alguém dizer de quem é.
create table recebimentos_avulsos (
  id               uuid primary key default gen_random_uuid(),
  estado           text not null default 'PENDENTE' check (estado in ('PENDENTE', 'IDENTIFICADO', 'DEVOLVIDO')),
  valor_centavos   centavos not null check (valor_centavos > 0),
  moeda            moeda not null default 'BRL',
  recebido_em      date not null,
  forma            text not null check (forma in ('PIX', 'BOLETO', 'TRANSFERENCIA', 'OUTRO')),
  referencia       text not null check (length(btrim(referencia)) between 3 and 120),
  registrado_por   uuid not null references pessoas (id),
  registrado_em    timestamptz not null default app_now(),
  recebimento_id   uuid references recebimentos (id),
  resolvido_por    uuid references pessoas (id),
  resolvido_em     timestamptz,
  devolvido_motivo text check (length(btrim(devolvido_motivo)) between 3 and 500),
  check ((estado = 'PENDENTE') = (resolvido_em is null)),
  check ((estado = 'IDENTIFICADO') = (recebimento_id is not null))
);
alter table recebimentos_avulsos enable row level security;
alter table recebimentos_avulsos force row level security;
create policy so_financeiro on recebimentos_avulsos
  using (contexto_equipe() and pode_global('console.pagamentos.ver'))
  with check (contexto_equipe() and pode_global('console.pagamentos.registrar'));
insert into tabelas_sem_condominio (tabela, motivo) values
  ('recebimentos_avulsos', 'Recebimento da TRÍADE que ainda não se sabe de qual cliente é; só o financeiro vê (PI-07)');

-- O que cada função interna faz aqui (PI-10). Implantação libera o que está contratado, mas não
-- muda contrato nem plano e não vê pagamentos; o financeiro cuida dos pagamentos.
insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'console.conjuntos.liberar'),
  ('IMPLANTACAO', 'console.conjuntos.liberar'),
  ('ADMINISTRACAO', 'console.pagamentos.ver'),
  ('ADMINISTRACAO', 'console.pagamentos.registrar'),
  ('ADMINISTRACAO', 'console.pagamentos.conferir'),
  ('ADMINISTRACAO', 'console.pagamentos.ajustar'),
  ('FINANCEIRO', 'console.pagamentos.ver'),
  ('FINANCEIRO', 'console.pagamentos.registrar'),
  ('FINANCEIRO', 'console.pagamentos.conferir'),
  ('FINANCEIRO', 'console.pagamentos.ajustar');

-- ---------------------------------------------------------------------------------------
-- Leituras.

create function unidades_ativas() returns integer
language sql stable
set search_path = public
as $$ select count(*)::integer from unidades where condominio_id = contexto_condominio() and ativa $$;

create function conjunto_cliente_json(c conjuntos, cc conjuntos_cliente) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'codigo', c.codigo, 'nome', c.nome, 'base', c.base, 'resumo', c.resumo, 'telas', to_jsonb(c.telas),
    'modo', conjunto_modo(contexto_condominio(), c.codigo),
    'estado', case when c.base then 'BASE' else coalesce(cc.estado, 'NAO_LIBERADO') end,
    'contratado', case when c.base then true else coalesce(cc.contratado, false) end,
    'contratoReferencia', cc.contrato_referencia, 'contratadoEm', cc.contratado_em,
    'liberadoEm', cc.liberado_em, 'liberadoPor', (select nome from pessoas where id = cc.liberado_por),
    'liberacaoReferencia', cc.liberacao_referencia, 'liberacaoMotivo', cc.liberacao_motivo,
    'testeAte', cc.teste_ate, 'testeMotivo', cc.teste_motivo,
    'suspensoEm', cc.suspenso_em, 'suspensaoPorque', cc.suspensao_porque, 'suspensaoMotivo', cc.suspensao_motivo,
    'versao', cc.versao))
$$;

create function plano_json(pl planos_cliente) returns jsonb
language sql stable
set search_path = public
as $$
  select case when pl.id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'nome', pl.nome, 'unidadesDe', pl.unidades_de, 'unidadesAte', pl.unidades_ate,
    'valor', pl.valor_centavos, 'moeda', pl.moeda, 'ciclo', pl.ciclo, 'diaVencimento', pl.dia_vencimento,
    'implantacaoValor', pl.implantacao_centavos, 'implantacaoSemCobranca', pl.implantacao_sem_cobranca,
    'implantacaoReferencia', pl.implantacao_referencia, 'inicioCompetencia', pl.inicio_competencia,
    'desde', pl.criado_em, 'versao', pl.versao)) end
$$;

-- Os números de uma cobrança: devido = valor + ajustes; falta conta só o conferido.
create function cobranca_json(c cobrancas) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_ajustes bigint;
  v_conferido bigint;
  v_a_conferir bigint;
  v_devido bigint;
  v_situacao text;
begin
  select coalesce(sum(valor_centavos), 0) into v_ajustes from ajustes_cobranca where cobranca_id = c.id;
  select coalesce(sum(valor_centavos) filter (where estado = 'CONFERIDO'), 0),
         coalesce(sum(valor_centavos) filter (where estado = 'A_CONFERIR'), 0)
    into v_conferido, v_a_conferir from recebimentos where cobranca_id = c.id;
  v_devido := case when c.valor_centavos is null then null else greatest(c.valor_centavos + v_ajustes, 0) end;
  v_situacao := case
    when v_devido is null then 'A_DEFINIR'
    when v_conferido >= v_devido then 'QUITADA'
    when v_conferido > 0 then 'PARCIAL'
    else 'ABERTA' end;
  return jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'condominioId', c.condominio_id, 'cliente', (select nome from condominios where id = c.condominio_id),
    'tipo', c.tipo, 'competencia', c.competencia, 'referencia', c.referencia, 'valor', c.valor_centavos,
    'ajustes', v_ajustes, 'devido', v_devido, 'conferido', v_conferido, 'aConferir', v_a_conferir,
    'falta', case when v_devido is null then null else greatest(v_devido - v_conferido, 0) end,
    'venceEm', c.vence_em, 'situacao', v_situacao,
    'emAtraso', v_situacao in ('ABERTA', 'PARCIAL') and c.vence_em < hoje_no_condominio(),
    'diasDeAtraso', case when v_situacao in ('ABERTA', 'PARCIAL') and c.vence_em < hoje_no_condominio()
                         then hoje_no_condominio() - c.vence_em end,
    'versao', c.versao));
end $$;

create function recebimento_json(r recebimentos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'cobrancaId', r.cobranca_id, 'estado', r.estado, 'valor', r.valor_centavos, 'recebidoEm', r.recebido_em,
    'forma', r.forma, 'referencia', r.referencia,
    'registradoPor', (select nome from pessoas where id = r.registrado_por), 'registradoEm', r.registrado_em,
    'conferidoPor', (select nome from pessoas where id = r.conferido_por), 'conferidoEm', r.conferido_em,
    'devolvidoEm', r.devolvido_em, 'devolvidoMotivo', r.devolvido_motivo, 'versao', r.versao))
$$;

-- Situações a tratar (PI-01), agora com o plano e os pagamentos. O selo de pagamento e o do plano
-- sem valor só aparecem para quem vê os pagamentos (PI-10).
create or replace function situacoes_cliente(p_condominio uuid) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when not exists (select 1 from vinculos v where v.condominio_id = c.id and v.funcao = 'SINDICO' and v.revogado_em is null)
         then 'SEM_SINDICO' end,
    case when c.cenario is null then 'SEM_CENARIO' end,
    case when c.numero_whatsapp is null then 'SEM_NUMERO_WHATSAPP' end,
    case when jsonb_array_length(c.contatos) = 0 then 'SEM_CONTATO' end,
    case when cl.referencia_contrato is null then 'SEM_CONTRATO' end,
    case when exists (select 1 from pendencias_implantacao p join implantacoes i on i.id = p.implantacao_id
                       where p.condominio_id = c.id and i.entregue_em is null and p.resolvida_em is null
                         and p.proximo_retorno < hoje_no_condominio())
         then 'PENDENCIA_VENCIDA' end,
    case when exists (select 1 from conjuntos_cliente cc where cc.condominio_id = c.id and cc.contratado and cc.estado = 'NAO_LIBERADO')
         then 'CONJUNTO_A_LIBERAR' end,
    case when exists (select 1 from conjuntos_cliente cc where cc.condominio_id = c.id and cc.estado = 'TESTE'
                       and cc.teste_ate between hoje_no_condominio() and hoje_no_condominio() + 3)
         then 'TESTE_TERMINANDO' end,
    case when pode(contexto_pessoa(), c.id, 'console.pagamentos.ver')
              and exists (select 1 from planos_cliente pl where pl.condominio_id = c.id and pl.valor_centavos is null)
         then 'PLANO_SEM_VALOR' end,
    case when pode(contexto_pessoa(), c.id, 'console.pagamentos.ver')
              and exists (select 1 from cobrancas cb where cb.condominio_id = c.id and cb.vence_em < hoje_no_condominio()
                            and (cobranca_json(cb) ->> 'emAtraso')::boolean)
         then 'PAGAMENTO_EM_ATRASO' end
  ], null)
  from condominios c left join clientes cl on cl.condominio_id = c.id
  where c.id = p_condominio
$$;

-- A parte "Plano e pagamentos" da ficha (decisão A).
create function console_plano(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pl planos_cliente;
  v_pagamentos boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  select * into pl from planos_cliente where condominio_id = p_condominio;
  v_pagamentos := pode(p_pessoa, p_condominio, 'console.pagamentos.ver');
  return jsonb_strip_nulls(jsonb_build_object(
    'plano', case when v_pagamentos or pode(p_pessoa, p_condominio, 'console.contrato.editar') then plano_json(pl)
                  when pl.id is not null then jsonb_build_object('nome', pl.nome, 'unidadesDe', pl.unidades_de,
                                                                  'unidadesAte', pl.unidades_ate, 'desde', pl.criado_em) end,
    'unidadesAtivas', unidades_ativas(),
    'conjuntos', (select jsonb_agg(conjunto_cliente_json(c, cc) order by c.ordem)
                    from conjuntos c left join conjuntos_cliente cc on cc.condominio_id = p_condominio and cc.conjunto = c.codigo),
    'cobrancas', case when v_pagamentos then coalesce((select jsonb_agg(cobranca_json(cb) order by cb.vence_em desc)
                                                         from cobrancas cb where cb.condominio_id = p_condominio), '[]'::jsonb) end,
    'permissoes', coalesce((
      select jsonb_agg(distinct fa.acao order by fa.acao)
        from vinculos v join funcao_acoes fa on fa.funcao = v.funcao
       where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio and v.revogado_em is null
         and v.funcao = any (contexto_equipe_funcoes())), '[]'::jsonb)));
end $$;

-- ---------------------------------------------------------------------------------------
-- Plano e conjuntos (escritas).

-- O plano do cliente (só administração: implantação não muda contrato, PI-10). Mudar vale para as
-- competências que ainda não foram abertas.
create function console_salvar_plano(p_pessoa uuid, p_condominio uuid, p_versao integer, p_nome text, p_unidades_de integer,
                                     p_unidades_ate integer, p_valor bigint, p_ciclo text, p_dia_vencimento integer,
                                     p_implantacao_valor bigint, p_implantacao_sem_cobranca boolean, p_implantacao_referencia text,
                                     p_inicio_competencia date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pl planos_cliente;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.contrato.editar');
  if p_inicio_competencia is null then perform recusar_campos('Diga a competência em que o plano começa', 'inicioCompetencia'); end if;
  if coalesce(length(btrim(p_nome)), 0) not between 2 and 60 then perform recusar_campos('Diga o nome do plano', 'nome'); end if;
  if p_unidades_de < 0 or p_unidades_ate < 1 or p_unidades_de > p_unidades_ate then
    perform recusar_campos('A faixa de unidades não fecha', 'unidadesDe', 'unidadesAte');
  end if;
  -- Sem valor é "Valor a definir", nunca zero (os preços ainda estão em decisão).
  if p_valor <= 0 then perform recusar_campos('Deixe vazio para "Valor a definir"', 'valor'); end if;
  if p_ciclo is not null and p_ciclo not in ('MENSAL', 'ANUAL') then perform recusar_campos('Escolha o ciclo', 'ciclo'); end if;
  if p_dia_vencimento not between 1 and 28 then perform recusar_campos('O vencimento vai do dia 1 ao 28', 'diaVencimento'); end if;
  if p_implantacao_valor <= 0 then perform recusar_campos('Deixe vazio quando não houver valor', 'implantacaoValor'); end if;
  select * into pl from planos_cliente where condominio_id = p_condominio;
    if pl.id is null then
      insert into planos_cliente (condominio_id, nome, unidades_de, unidades_ate, valor_centavos, ciclo, dia_vencimento,
                                  implantacao_centavos, implantacao_sem_cobranca, implantacao_referencia, inicio_competencia)
      values (p_condominio, btrim(p_nome), p_unidades_de, p_unidades_ate, p_valor, coalesce(p_ciclo, 'MENSAL'), coalesce(p_dia_vencimento, 10),
              p_implantacao_valor, coalesce(p_implantacao_sem_cobranca, false), nullif(btrim(p_implantacao_referencia), ''),
              date_trunc('month', p_inicio_competencia)::date)
      returning * into pl;
    else
      update planos_cliente
         set nome = btrim(p_nome), unidades_de = p_unidades_de, unidades_ate = p_unidades_ate, valor_centavos = p_valor,
             ciclo = coalesce(p_ciclo, 'MENSAL'), dia_vencimento = coalesce(p_dia_vencimento, 10), implantacao_centavos = p_implantacao_valor,
             implantacao_sem_cobranca = coalesce(p_implantacao_sem_cobranca, false),
             implantacao_referencia = nullif(btrim(p_implantacao_referencia), ''),
             inicio_competencia = date_trunc('month', p_inicio_competencia)::date
       where id = pl.id and versao = p_versao
      returning versao into v_versao;
      if v_versao is null then perform conflito_versao('planos_cliente', pl.id); end if;
      select * into pl from planos_cliente where id = pl.id;
    end if;
  -- A implantação com valor vira a sua cobrança, com a referência do serviço (PI-07).
  if pl.implantacao_centavos is not null and not exists (select 1 from cobrancas where condominio_id = p_condominio and tipo = 'IMPLANTACAO') then
    insert into cobrancas (condominio_id, tipo, referencia, valor_centavos, vence_em, criada_por)
    values (p_condominio, 'IMPLANTACAO', coalesce(pl.implantacao_referencia, 'Implantação'), pl.implantacao_centavos,
            (pl.inicio_competencia + (pl.dia_vencimento - 1)), p_pessoa);
  end if;
  perform registrar_historico_interno('plano.salvo', 'plano', pl.id::text,
                                      jsonb_build_object('ciclo', pl.ciclo, 'comValor', pl.valor_centavos is not null));
  return plano_json(pl);
end $$;

create function exigir_conjunto_cliente(p_conjunto text, p_versao integer) returns conjuntos_cliente
language plpgsql
set search_path = public
as $$
declare cc conjuntos_cliente;
begin
  if exists (select 1 from conjuntos where codigo = p_conjunto and base) then
    perform recusar_motivo('A base de atendimento vem com todo plano', 'CONJUNTO_BASE');
  end if;
  select * into cc from conjuntos_cliente where condominio_id = contexto_condominio() and conjunto = p_conjunto for update;
  if not found then raise exception 'Conjunto não encontrado' using errcode = 'TC404'; end if;
  if p_versao is distinct from cc.versao then perform conflito_versao('conjuntos_cliente', cc.id); end if;
  return cc;
end $$;

create function conjunto_resposta(p_conjunto text) returns jsonb
language sql stable
set search_path = public
as $$
  select conjunto_cliente_json(c, cc) from conjuntos c
    left join conjuntos_cliente cc on cc.condominio_id = contexto_condominio() and cc.conjunto = c.codigo
   where c.codigo = p_conjunto
$$;

-- Contratado ou não (o contrato; só administração). Tirar do contrato o que está liberado suspende,
-- sem perder nada (PI-16).
create function console_contratar_conjunto(p_pessoa uuid, p_condominio uuid, p_conjunto text, p_versao integer,
                                           p_contratado boolean, p_referencia text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cc conjuntos_cliente;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.contrato.editar');
  cc := exigir_conjunto_cliente(p_conjunto, p_versao);
  if p_contratado is null then perform recusar_campos('Diga se está contratado', 'contratado'); end if;
  if p_contratado and coalesce(length(btrim(p_referencia)), 0) not between 1 and 120 then
    perform recusar_campos('Diga o contrato ou aditivo', 'referencia');
  end if;
  if not p_contratado and coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then
    perform recusar_campos('Diga o motivo', 'motivo');
  end if;
  if not p_contratado and cc.estado in ('LIBERADO', 'TESTE') then
    perform definir_transicao('CONTRATO_ENCERRADO', btrim(p_motivo));
    update conjuntos_cliente
       set estado = 'SUSPENSO', suspenso_em = app_now(), suspenso_por = p_pessoa, suspensao_porque = 'CONTRATO_ENCERRADO',
           suspensao_motivo = btrim(p_motivo), contratado = false
     where id = cc.id;
  else
    update conjuntos_cliente
       set contratado = p_contratado,
           contrato_referencia = case when p_contratado then btrim(p_referencia) else contrato_referencia end,
           contratado_em = case when p_contratado then app_now() else contratado_em end,
           contratado_por = case when p_contratado then p_pessoa else contratado_por end
     where id = cc.id;
  end if;
  perform registrar_historico_interno(case when p_contratado then 'conjunto.contratado' else 'conjunto.descontratado' end,
                                      'conjunto', cc.id::text, jsonb_build_object('conjunto', p_conjunto));
  return conjunto_resposta(p_conjunto);
end $$;

-- Liberar (PI-03): só o que está contratado, com referência e motivo. A prévia do que o síndico
-- passa a ter vem do catálogo (PI-19).
create function console_liberar_conjunto(p_pessoa uuid, p_condominio uuid, p_conjunto text, p_versao integer,
                                         p_referencia text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cc conjuntos_cliente;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.conjuntos.liberar');
  cc := exigir_conjunto_cliente(p_conjunto, p_versao);
  if not cc.contratado then
    perform recusar_motivo('Só se libera o que está contratado; para mostrar antes, libere para teste', 'NAO_CONTRATADO');
  end if;
  if cc.estado = 'LIBERADO' then perform recusar_motivo('O conjunto já está liberado', 'JA_LIBERADO'); end if;
  if coalesce(length(btrim(p_referencia)), 0) not between 1 and 120 then perform recusar_campos('Diga o contrato ou aditivo', 'referencia'); end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  perform definir_transicao('CONJUNTO_LIBERADO', btrim(p_motivo));
  update conjuntos_cliente
     set estado = 'LIBERADO', liberado_em = app_now(), liberado_por = p_pessoa, liberacao_referencia = btrim(p_referencia),
         liberacao_motivo = btrim(p_motivo), ja_liberado = true, teste_ate = null, teste_motivo = null
   where id = cc.id;
  perform registrar_historico_interno('conjunto.liberado', 'conjunto', cc.id::text,
                                      jsonb_build_object('conjunto', p_conjunto, 'referencia', btrim(p_referencia)));
  return conjunto_resposta(p_conjunto);
end $$;

-- Teste (decisão B): até 30 dias, com motivo; acaba sozinho na data (conjunto_modo).
create function console_testar_conjunto(p_pessoa uuid, p_condominio uuid, p_conjunto text, p_versao integer,
                                        p_ate date, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cc conjuntos_cliente;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.conjuntos.liberar');
  cc := exigir_conjunto_cliente(p_conjunto, p_versao);
  if cc.estado = 'LIBERADO' then perform recusar_motivo('O conjunto já está liberado', 'JA_LIBERADO'); end if;
  if cc.estado = 'TESTE' and cc.teste_ate >= hoje_no_condominio() then perform recusar_motivo('O conjunto já está em teste', 'JA_EM_TESTE'); end if;
  if p_ate is null or p_ate <= hoje_no_condominio() or p_ate > hoje_no_condominio() + 30 then
    perform recusar_campos('O teste termina entre amanhã e 30 dias', 'ate');
  end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  if cc.estado = 'TESTE' then
    -- Teste vencido: passa por suspenso para recomeçar, as duas mudanças no histórico.
    perform definir_transicao('TESTE_ENCERRADO', 'Fim do teste anterior', true);
    update conjuntos_cliente set estado = 'SUSPENSO', suspenso_em = app_now(), suspensao_porque = 'TESTE_ENCERRADO' where id = cc.id;
  end if;
  perform definir_transicao('TESTE_LIBERADO', btrim(p_motivo));
  update conjuntos_cliente
     set estado = 'TESTE', teste_ate = p_ate, teste_motivo = btrim(p_motivo), ja_liberado = true,
         liberado_em = app_now(), liberado_por = p_pessoa
   where id = cc.id;
  perform registrar_historico_interno('conjunto.teste', 'conjunto', cc.id::text, jsonb_build_object('conjunto', p_conjunto, 'ate', p_ate));
  return conjunto_resposta(p_conjunto);
end $$;

-- Suspender ou encerrar o teste (decisão C, PI-16): o histórico continua consultável e exportável.
create function console_suspender_conjunto(p_pessoa uuid, p_condominio uuid, p_conjunto text, p_versao integer,
                                           p_porque text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cc conjuntos_cliente;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.conjuntos.liberar');
  cc := exigir_conjunto_cliente(p_conjunto, p_versao);
  if cc.estado not in ('LIBERADO', 'TESTE') then perform recusar_motivo('O conjunto não está liberado', 'NAO_LIBERADO'); end if;
  if p_porque is null or p_porque not in ('CONTRATO_ENCERRADO', 'PEDIDO_CLIENTE', 'TESTE_ENCERRADO', 'OUTRO') then
    perform recusar_campos('Diga por quê', 'porque');
  end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  perform definir_transicao(case when p_porque = 'TESTE_ENCERRADO' then 'TESTE_ENCERRADO' else 'CONJUNTO_SUSPENSO' end, btrim(p_motivo));
  update conjuntos_cliente
     set estado = 'SUSPENSO', suspenso_em = app_now(), suspenso_por = p_pessoa, suspensao_porque = p_porque,
         suspensao_motivo = btrim(p_motivo)
   where id = cc.id;
  perform registrar_historico_interno('conjunto.suspenso', 'conjunto', cc.id::text, jsonb_build_object('conjunto', p_conjunto, 'porque', p_porque));
  return conjunto_resposta(p_conjunto);
end $$;

-- ---------------------------------------------------------------------------------------
-- Pagamentos (escritas e leituras do Console).

create function exigir_cobranca(p_id uuid) returns cobrancas
language plpgsql
set search_path = public
as $$
declare c cobrancas;
begin
  select * into c from cobrancas where id = p_id;
  if not found then raise exception 'Cobrança não encontrada' using errcode = 'TC404'; end if;
  return c;
end $$;

-- A lista de Pagamentos: as cobranças dos clientes atribuídos à pessoa e, para quem vê os
-- pagamentos de todos, os recebimentos sem cliente.
create function console_pagamentos(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_cobrancas jsonb := '[]'::jsonb;
  v_recebimentos jsonb := '[]'::jsonb;
  v_avulsos jsonb := '[]'::jsonb;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select (x #>> '{}')::uuid as id from jsonb_array_elements(v_lista) x loop
    if pode(p_pessoa, r.id, 'console.pagamentos.ver') then
      perform entrar_condominio(p_pessoa, r.id, 'console.pagamentos.ver');
      select v_cobrancas || coalesce(jsonb_agg(cobranca_json(c) order by c.vence_em desc), '[]'::jsonb) into v_cobrancas
        from cobrancas c where c.condominio_id = r.id;
      select v_recebimentos || coalesce(jsonb_agg(recebimento_json(rc) || jsonb_build_object('condominioId', rc.condominio_id,
                                                  'cliente', (select nome from condominios where id = rc.condominio_id))
                                                  order by rc.registrado_em), '[]'::jsonb) into v_recebimentos
        from recebimentos rc where rc.condominio_id = r.id and rc.estado = 'A_CONFERIR';
    end if;
  end loop;
  perform definir_pessoa(p_pessoa);
  if pode_global('console.pagamentos.ver') then
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'valor', a.valor_centavos, 'recebidoEm', a.recebido_em, 'forma', a.forma,
                                                 'referencia', a.referencia, 'registradoEm', a.registrado_em,
                                                 'registradoPor', (select nome from pessoas where id = a.registrado_por))
                              order by a.registrado_em), '[]'::jsonb)
      into v_avulsos from recebimentos_avulsos a where a.estado = 'PENDENTE';
  end if;
  return jsonb_build_object('cobrancas', v_cobrancas, 'aConferir', v_recebimentos, 'naoIdentificados', v_avulsos,
                            'podeRegistrar', pode_global('console.pagamentos.registrar'));
end $$;

-- Abrir a competência (decisão D): uma cobrança por cliente com plano, com o valor do plano ou a
-- definir. O que já existe fica como está.
create function console_abrir_competencia(p_pessoa uuid, p_competencia date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_comp date := date_trunc('month', p_competencia)::date;
  pl planos_cliente;
  v_criadas integer := 0;
  v_ja integer := 0;
  v_sem_plano integer := 0;
  v_cobranca uuid;
begin
  perform entrar_console(p_pessoa, 'console.pagamentos.registrar');
  if p_competencia is null then perform recusar_campos('Diga a competência', 'competencia'); end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select (x #>> '{}')::uuid as id from jsonb_array_elements(v_lista) x loop
    if pode(p_pessoa, r.id, 'console.pagamentos.registrar') then
      perform entrar_condominio(p_pessoa, r.id, 'console.pagamentos.registrar');
      select * into pl from planos_cliente where condominio_id = r.id;
      if pl.id is null or pl.inicio_competencia > v_comp
         or (pl.ciclo = 'ANUAL' and extract(month from pl.inicio_competencia) <> extract(month from v_comp)) then
        v_sem_plano := v_sem_plano + 1;
      elsif exists (select 1 from cobrancas where condominio_id = r.id and tipo = 'MENSALIDADE' and competencia = v_comp) then
        v_ja := v_ja + 1;
      else
        insert into cobrancas (condominio_id, tipo, competencia, valor_centavos, vence_em, criada_por)
        values (r.id, 'MENSALIDADE', v_comp, pl.valor_centavos, v_comp + (pl.dia_vencimento - 1), p_pessoa)
        returning id into v_cobranca;
        perform registrar_historico_interno('cobranca.aberta', 'cobranca', v_cobranca::text, jsonb_build_object('competencia', v_comp));
        v_criadas := v_criadas + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('criadas', v_criadas, 'jaAbertas', v_ja, 'semPlano', v_sem_plano);
end $$;

create function validar_recebimento(p_valor bigint, p_recebido_em date, p_forma text, p_referencia text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_valor is null or p_valor <= 0 then perform recusar_campos('Diga o valor recebido', 'valor'); end if;
  if p_recebido_em is null or p_recebido_em > (app_now() at time zone 'America/Sao_Paulo')::date then
    perform recusar_campos('Diga quando entrou (até hoje)', 'recebidoEm');
  end if;
  if p_forma is null or p_forma not in ('PIX', 'BOLETO', 'TRANSFERENCIA', 'OUTRO') then perform recusar_campos('Diga como chegou', 'forma'); end if;
  if coalesce(length(btrim(p_referencia)), 0) not between 3 and 120 then
    perform recusar_campos('Diga a referência do comprovante', 'referencia');
  end if;
end $$;

-- Registrar o que entrou (PI-07): de um cliente, entra A conferir; sem cliente, fica em Não
-- identificados. A referência não se repete; nenhum dado bancário é pedido.
create function console_registrar_recebimento(p_pessoa uuid, p_condominio uuid, p_cobranca uuid, p_valor bigint,
                                              p_recebido_em date, p_forma text, p_referencia text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c cobrancas;
  v_id uuid;
begin
  if p_condominio is null then
    perform entrar_console(p_pessoa, 'console.pagamentos.registrar');
    perform validar_recebimento(p_valor, p_recebido_em, p_forma, p_referencia);
    perform reservar_referencia(p_referencia);
    insert into recebimentos_avulsos (valor_centavos, recebido_em, forma, referencia, registrado_por)
    values (p_valor, p_recebido_em, p_forma, btrim(p_referencia), p_pessoa) returning id into v_id;
    -- Sem condomínio, o evento fica com o autor (o histórico interno sem condomínio é só o da equipe).
    perform registrar_historico('recebimento.nao_identificado', 'recebimento_avulso', v_id::text, '{}'::jsonb);
    return jsonb_build_object('id', v_id, 'naoIdentificado', true);
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.registrar');
  perform validar_recebimento(p_valor, p_recebido_em, p_forma, p_referencia);
  if p_cobranca is null then perform recusar_campos('Escolha a cobrança', 'cobranca'); end if;
  c := exigir_cobranca(p_cobranca);
  perform reservar_referencia(p_referencia);
  perform definir_transicao('RECEBIMENTO_REGISTRADO');
  insert into recebimentos (condominio_id, cobranca_id, valor_centavos, recebido_em, forma, referencia, registrado_por)
  values (p_condominio, c.id, p_valor, p_recebido_em, p_forma, btrim(p_referencia), p_pessoa) returning id into v_id;
  perform registrar_historico_interno('recebimento.registrado', 'cobranca', c.id::text, jsonb_build_object('recebimento', v_id));
  return jsonb_build_object('id', v_id, 'cobranca', cobranca_json(exigir_cobranca(c.id)));
end $$;

-- Dizer de qual cliente é um recebimento sem cliente: vira recebimento A conferir daquela cobrança.
create function console_identificar_recebimento(p_pessoa uuid, p_avulso uuid, p_condominio uuid, p_cobranca uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a recebimentos_avulsos;
  c cobrancas;
  v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.pagamentos.registrar');
  select * into a from recebimentos_avulsos where id = p_avulso for update;
  if not found then raise exception 'Recebimento não encontrado' using errcode = 'TC404'; end if;
  if a.estado <> 'PENDENTE' then perform recusar_motivo('Este recebimento já foi resolvido', 'JA_RESOLVIDO'); end if;
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.registrar');
  c := exigir_cobranca(p_cobranca);
  perform definir_transicao('RECEBIMENTO_IDENTIFICADO');
  insert into recebimentos (condominio_id, cobranca_id, valor_centavos, recebido_em, forma, referencia, registrado_por)
  values (p_condominio, c.id, a.valor_centavos, a.recebido_em, a.forma, a.referencia, p_pessoa) returning id into v_id;
  perform definir_pessoa(p_pessoa);
  update recebimentos_avulsos set estado = 'IDENTIFICADO', recebimento_id = v_id, resolvido_por = p_pessoa, resolvido_em = app_now()
   where id = a.id;
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.registrar');
  perform registrar_historico_interno('recebimento.identificado', 'cobranca', c.id::text, jsonb_build_object('recebimento', v_id));
  return jsonb_build_object('id', v_id, 'cobranca', cobranca_json(c));
end $$;

-- Conferir (PI-07): só quem pode conferir confirma; confirmar de novo é recusado.
create function console_conferir_recebimento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r recebimentos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.conferir');
  select * into r from recebimentos where id = p_id for update;
  if not found then raise exception 'Recebimento não encontrado' using errcode = 'TC404'; end if;
  if r.estado = 'CONFERIDO' then perform recusar_motivo('Este recebimento já foi confirmado', 'JA_CONFIRMADO'); end if;
  if r.estado <> 'A_CONFERIR' then perform recusar_motivo('Este recebimento foi devolvido', 'DEVOLVIDO'); end if;
  if p_versao is distinct from r.versao then perform conflito_versao('recebimentos', r.id); end if;
  perform definir_transicao('RECEBIMENTO_CONFERIDO');
  update recebimentos set estado = 'CONFERIDO', conferido_por = p_pessoa, conferido_em = app_now() where id = r.id returning * into r;
  perform registrar_historico_interno('recebimento.conferido', 'cobranca', r.cobranca_id::text, jsonb_build_object('recebimento', r.id));
  return jsonb_build_object('recebimento', recebimento_json(r), 'cobranca', cobranca_json(exigir_cobranca(r.cobranca_id)));
end $$;

-- Devolver (não bate com o extrato): sai da conta, a referência pode ser usada de novo.
create function console_devolver_recebimento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r recebimentos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.conferir');
  select * into r from recebimentos where id = p_id for update;
  if not found then raise exception 'Recebimento não encontrado' using errcode = 'TC404'; end if;
  if r.estado <> 'A_CONFERIR' then perform recusar_motivo('Só se devolve o que está a conferir', 'NAO_A_CONFERIR'); end if;
  if p_versao is distinct from r.versao then perform conflito_versao('recebimentos', r.id); end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  perform definir_transicao('RECEBIMENTO_DEVOLVIDO', btrim(p_motivo));
  update recebimentos set estado = 'DEVOLVIDO', devolvido_por = p_pessoa, devolvido_em = app_now(), devolvido_motivo = btrim(p_motivo)
   where id = r.id returning * into r;
  delete from referencias_recebimento where hash = hash_referencia(r.referencia);
  perform registrar_historico_interno('recebimento.devolvido', 'cobranca', r.cobranca_id::text, jsonb_build_object('recebimento', r.id));
  return jsonb_build_object('recebimento', recebimento_json(r), 'cobranca', cobranca_json(exigir_cobranca(r.cobranca_id)));
end $$;

-- A cobrança aberta, com ajustes, recebimentos e o histórico.
create function console_cobranca(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c cobrancas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.ver');
  c := exigir_cobranca(p_id);
  return cobranca_json(c) || jsonb_build_object(
    'plano', (select nome from planos_cliente where condominio_id = p_condominio),
    'ajustes', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'valor', a.valor_centavos, 'motivo', a.motivo,
                                                             'autor', (select nome from pessoas where id = a.autor_id), 'em', a.criado_em)
                                          order by a.criado_em) from ajustes_cobranca a where a.cobranca_id = c.id), '[]'::jsonb),
    'recebimentos', coalesce((select jsonb_agg(recebimento_json(r) order by r.registrado_em) from recebimentos r where r.cobranca_id = c.id), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                                               'dados', h.dados) order by h.ocorrido_em desc)
                             from historico h where h.entidade = 'cobranca' and h.entidade_id = c.id::text), '[]'::jsonb),
    'permissoes', jsonb_build_object('registrar', pode(p_pessoa, p_condominio, 'console.pagamentos.registrar'),
                                     'conferir', pode(p_pessoa, p_condominio, 'console.pagamentos.conferir'),
                                     'ajustar', pode(p_pessoa, p_condominio, 'console.pagamentos.ajustar')));
end $$;

-- Ajuste com motivo, no lugar de editar o valor (PI-07).
create function console_ajustar_cobranca(p_pessoa uuid, p_condominio uuid, p_id uuid, p_tipo text, p_valor bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c cobrancas;
  v_valor bigint;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.ajustar');
  c := exigir_cobranca(p_id);
  if c.valor_centavos is null then perform recusar_motivo('Defina o valor antes de ajustar', 'VALOR_A_DEFINIR'); end if;
  if p_tipo is null or p_tipo not in ('DESCONTO', 'ACRESCIMO', 'CORRECAO') then perform recusar_campos('Escolha o tipo', 'tipo'); end if;
  if p_valor is null or p_valor = 0 or (p_tipo <> 'CORRECAO' and p_valor < 0) then perform recusar_campos('Diga o valor', 'valor'); end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  v_valor := case p_tipo when 'DESCONTO' then -p_valor else p_valor end;
  insert into ajustes_cobranca (condominio_id, cobranca_id, tipo, valor_centavos, motivo, autor_id)
  values (p_condominio, c.id, p_tipo, v_valor, btrim(p_motivo), p_pessoa);
  perform registrar_historico_interno('cobranca.ajustada', 'cobranca', c.id::text, jsonb_build_object('tipo', p_tipo, 'valor', v_valor));
  return cobranca_json(c);
end $$;

-- O valor que estava a definir passa a existir, uma vez, com motivo.
create function console_definir_valor_cobranca(p_pessoa uuid, p_condominio uuid, p_id uuid, p_valor bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c cobrancas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.pagamentos.ajustar');
  c := exigir_cobranca(p_id);
  if c.valor_centavos is not null then perform recusar_motivo('O valor já está definido; corrija por ajuste', 'VALOR_DEFINIDO'); end if;
  if p_valor is null or p_valor <= 0 then perform recusar_campos('Diga o valor', 'valor'); end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo', 'motivo'); end if;
  update cobrancas set valor_centavos = p_valor, valor_definido_em = app_now(), valor_definido_por = p_pessoa where id = c.id returning * into c;
  perform registrar_historico_interno('cobranca.valor_definido', 'cobranca', c.id::text, jsonb_build_object('valor', p_valor, 'motivo', btrim(p_motivo)));
  return cobranca_json(c);
end $$;

-- ---------------------------------------------------------------------------------------
-- Plataforma: Meu plano (NG-21, decisões E e F) e o que o menu precisa saber.

-- Para o menu: o modo de cada conjunto. Toda pessoa com acesso ao painel lê.
create function plataforma_conjuntos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  return (select jsonb_object_agg(c.codigo, conjunto_modo(p_condominio, c.codigo)) from conjuntos c);
end $$;

-- Meu plano: o nome, a faixa e os conjuntos com as telas, sem valores nem pagamentos (F.1).
create function plataforma_meu_plano(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pl planos_cliente;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  select * into pl from planos_cliente where condominio_id = p_condominio;
  return jsonb_strip_nulls(jsonb_build_object(
    'plano', case when pl.id is not null then jsonb_strip_nulls(jsonb_build_object('nome', pl.nome, 'unidadesDe', pl.unidades_de,
                                                                                   'unidadesAte', pl.unidades_ate, 'desde', pl.criado_em)) end,
    'unidadesAtivas', unidades_ativas(),
    'conjuntos', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'codigo', c.codigo, 'nome', c.nome, 'base', c.base, 'resumo', c.resumo, 'telas', to_jsonb(c.telas),
                    'modo', conjunto_modo(p_condominio, c.codigo),
                    'situacao', case when c.base then 'BASE'
                                     when conjunto_modo(p_condominio, c.codigo) = 'COMPLETO' and cc.estado = 'TESTE' then 'TESTE'
                                     when conjunto_modo(p_condominio, c.codigo) = 'COMPLETO' then 'LIBERADO'
                                     when cc.estado = 'SUSPENSO' or (cc.estado = 'TESTE') then 'SUSPENSO'
                                     when cc.contratado then 'LIBERANDO'
                                     else 'FORA' end,
                    'testeAte', case when cc.estado = 'TESTE' then cc.teste_ate end,
                    'suspensoEm', case when cc.estado = 'SUSPENSO' then cc.suspenso_em end)) order by c.ordem)
                    from conjuntos c left join conjuntos_cliente cc on cc.condominio_id = p_condominio and cc.conjunto = c.codigo),
    'podePedir', pode(p_pessoa, p_condominio, 'suporte.chamados')));
end $$;

-- Pedir para testar ou contratar (E.1): abre um chamado para a TRÍADE, já preenchido. Nada é
-- liberado sozinho.
create function plataforma_pedir_conjunto(p_pessoa uuid, p_condominio uuid, p_conjunto text, p_pedido text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c conjuntos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  select * into c from conjuntos where codigo = p_conjunto and not base;
  if not found then perform recusar_campos('Escolha o conjunto', 'conjunto'); end if;
  if p_pedido is null or p_pedido not in ('TESTE', 'CONTRATAR') then perform recusar_campos('Diga o que quer', 'pedido'); end if;
  if conjunto_modo(p_condominio, p_conjunto) = 'COMPLETO' then perform recusar_motivo('Este conjunto já está no plano', 'JA_NO_PLANO'); end if;
  return plataforma_abrir_chamado(p_pessoa, p_condominio, 'SUGESTAO', 'OUTRO',
           case p_pedido when 'TESTE' then 'Quero testar: ' else 'Quero contratar: ' end || c.nome,
           coalesce(nullif(btrim(p_texto), ''),
                    case p_pedido when 'TESTE' then 'Gostaria de testar ' || c.nome || ' no condomínio.'
                                  else 'Gostaria de contratar ' || c.nome || ' para o condomínio.' end));
end $$;

call fechar_acesso();

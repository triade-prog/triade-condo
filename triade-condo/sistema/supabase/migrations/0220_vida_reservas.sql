-- 0220 · Vida em condomínio: áreas comuns e reservas (peça R12; AC-01, AC-06, AC-07, AG-09,
-- W-20, W-22). Telas e decisões aprovadas pela Carolina em 19/10/2026 (docs/telas/vida.html).
--
-- Regras desta parte:
-- 1. Áreas comuns já cadastradas (AC-07): salão de festas, churrasqueira, quadra, academia e
--    espaço gourmet nascem inativos em todo condomínio, com regras sugeridas. O síndico ajusta,
--    ativa e cria outras áreas com os mesmos campos. Área não se apaga: fica inativa, e só
--    quando não tem reserva marcada daqui para a frente. Área inativa não aparece para ninguém.
-- 2. Cada área diz como a reserva é confirmada: o síndico aprova, confirma na hora se a data
--    estiver livre (automática) ou é de uso livre, sem reserva. Diz também a antecedência (de X
--    a Y dias), o horário de uso, se reserva o período inteiro ou em blocos de horas, a
--    capacidade, o valor de uso (só informativo: a cobrança vem com o Dinheiro do prédio, R9),
--    o documento com as regras de uso e quem pode reservar (proprietário que mora, inquilino,
--    proprietário que não mora). Só reserva quem tem vínculo confirmado com a unidade (MU-02).
-- 3. Limite por unidade (AC-06): N reservas por semana ou por mês, por área, contando as
--    confirmadas e as que esperam aprovação. A tolerância deixa pedir mais uma quando faltam
--    até X dias para a data e ela está livre. O morador vê o limite antes de pedir, com a
--    próxima data possível.
-- 4. Data ocupada: uma reserva confirmada, ou um compromisso da Agenda na área (mesmo nome), no
--    mesmo horário. Vários pedidos podem esperar aprovação para a mesma data; aprovar um recusa
--    os outros, com motivo, que vai ao morador. Recusar e cancelar pedem motivo.
-- 5. WhatsApp (W-22): RESERVAR e CANCELAR entram ao lado de PARAR e REVISAR. A Nina pergunta a
--    área, a unidade (quando há mais de uma), o dia e, nas áreas em blocos, o horário, sempre
--    com números e datas; SAIR desiste. "RESERVAR <área>" (o botão da etiqueta) já escolhe a
--    área. Cancelar depois do prazo da área avisa quem cuida das reservas.
-- 6. A decisão vai ao morador com o nome de quem decidiu. Dentro da janela de 24h, texto livre;
--    fora, pelo modelo aprovado reserva_decidida (W-20), respeitando PARAR.
-- 7. Agenda (AG-09): as reservas confirmadas aparecem na agenda de quem vê reservas, e entram
--    como conflito ao marcar compromisso no mesmo lugar. O cadastro das áreas vira sugestão
--    de lugar na Agenda.
-- 8. Permissões (CF-03): Ver as reservas e Cuidar das reservas, dadas pelo síndico. As áreas
--    ficam em Configurações (ver e configurar).

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_RESERVAS', 'Ver as reservas', 'Ver as reservas das áreas comuns.', 15),
  ('RESERVAS', 'Cuidar das reservas', 'Registrar, aprovar, recusar e cancelar reservas das áreas comuns.', 16);
insert into permissao_acoes (permissao, acao) values
  ('VER_RESERVAS', 'reservas.ver'),
  ('RESERVAS', 'reservas.ver'),
  ('RESERVAS', 'reservas.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'reservas.ver'),
  ('SINDICO', 'reservas.editar');

-- ---------------------------------------------------------------------------------------
-- Áreas comuns (AC-07).

create table areas_comuns (
  id                       uuid primary key default gen_random_uuid(),
  condominio_id            uuid not null references condominios (id) on delete restrict,
  -- Tipo pronto de onde a área veio; as criadas pelo síndico não têm.
  modelo                   text check (modelo in ('SALAO', 'CHURRASQUEIRA', 'QUADRA', 'ACADEMIA', 'GOURMET')),
  nome                     text not null check (length(btrim(nome)) between 2 and 60),
  ativa                    boolean not null default false,
  reserva                  text not null check (reserva in ('SINDICO', 'AUTOMATICA', 'SEM_RESERVA')),
  antecedencia_min         smallint not null default 1 check (antecedencia_min between 0 and 365),
  antecedencia_max         smallint not null default 60 check (antecedencia_max between 1 and 730),
  hora_inicio              time not null,
  hora_fim                 time not null,
  modo                     text not null default 'PERIODO' check (modo in ('PERIODO', 'BLOCOS')),
  bloco_minutos            smallint check (bloco_minutos in (30, 60, 90, 120, 180, 240)),
  capacidade               smallint check (capacidade between 1 and 2000),
  limite_quantidade        smallint check (limite_quantidade between 1 and 31),
  limite_periodo           text check (limite_periodo in ('SEMANA', 'MES')),
  tolerancia_dias          smallint check (tolerancia_dias between 1 and 60),
  cancelar_sem_aviso_dias  smallint not null default 3 check (cancelar_sem_aviso_dias between 0 and 60),
  valor_centavos           integer check (valor_centavos between 0 and 10000000),
  regras_documento_id      uuid,
  pode_proprietario_morador boolean not null default true,
  pode_inquilino           boolean not null default true,
  pode_proprietario_ausente boolean not null default false,
  criado_em                timestamptz not null default app_now(),
  criado_por               uuid references pessoas (id),
  atualizado_em            timestamptz not null default app_now(),
  versao                   integer not null default 1,
  unique (id, condominio_id),
  foreign key (regras_documento_id, condominio_id) references documentos (id, condominio_id),
  check (antecedencia_min <= antecedencia_max),
  check (hora_fim > hora_inicio),
  check ((modo = 'BLOCOS') = (bloco_minutos is not null)),
  check ((limite_quantidade is null) = (limite_periodo is null)),
  check (tolerancia_dias is null or limite_quantidade is not null)
);
create unique index areas_comuns_nome on areas_comuns (condominio_id, lower(btrim(nome)));
create unique index areas_comuns_modelo on areas_comuns (condominio_id, modelo) where modelo is not null;
call proteger_tabela_condominio('areas_comuns');
create trigger areas_comuns_sem_exclusao before delete on areas_comuns for each row execute function somente_insercao();

create function areas_comuns_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.modelo, new.criado_em, new.criado_por) is distinct from (old.modelo, old.criado_em, old.criado_por) then
    raise exception 'A origem da área não muda' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger areas_comuns_regras before update on areas_comuns for each row execute function areas_comuns_regras();

-- As áreas prontas, inativas, com as regras sugeridas do desenho.
create function aplicar_areas_prontas(p_condominio uuid) returns void
language sql
set search_path = public
as $$
  insert into areas_comuns (condominio_id, modelo, nome, reserva, antecedencia_min, antecedencia_max, hora_inicio, hora_fim,
                            modo, bloco_minutos, capacidade, limite_quantidade, limite_periodo, tolerancia_dias)
  select p_condominio, m.* from (values
    ('SALAO', 'Salão de festas', 'SINDICO', 2, 60, time '10:00', time '23:00', 'PERIODO', null::smallint, 80, 1, 'MES', null::smallint),
    ('CHURRASQUEIRA', 'Churrasqueira', 'AUTOMATICA', 1, 30, time '11:00', time '22:00', 'PERIODO', null, 30, 2, 'MES', 7),
    ('QUADRA', 'Quadra', 'AUTOMATICA', 0, 7, time '07:00', time '22:00', 'BLOCOS', 60, null, 3, 'SEMANA', null),
    ('ACADEMIA', 'Academia', 'SEM_RESERVA', 0, 1, time '06:00', time '23:00', 'PERIODO', null, null, null, null, null),
    ('GOURMET', 'Espaço gourmet', 'SINDICO', 1, 30, time '11:00', time '23:00', 'PERIODO', null, 20, 1, 'MES', null))
    m(modelo, nome, reserva, ant_min, ant_max, ini, fim, modo, bloco, cap, lim, periodo, tol)
   where not exists (select 1 from areas_comuns a where a.condominio_id = p_condominio and a.modelo = m.modelo)
     and not exists (select 1 from areas_comuns a where a.condominio_id = p_condominio and lower(btrim(a.nome)) = lower(m.nome))
$$;

create function condominios_areas_prontas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform aplicar_areas_prontas(new.id);
  return null;
end $$;
create trigger condominios_areas_prontas after insert on condominios for each row execute function condominios_areas_prontas();

do $$
declare r record;
begin
  for r in select id from condominios loop
    perform set_config('app.condominio_id', r.id::text, true);
    perform aplicar_areas_prontas(r.id);
  end loop;
  perform set_config('app.condominio_id', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Reservas (AC-01, AC-06).

-- Numeração das reservas por condomínio e ano ("2026-R014").
create table numeracao_reservas (
  condominio_id uuid not null references condominios (id) on delete restrict,
  ano           smallint not null check (ano between 2000 and 2100),
  ultimo        integer not null check (ultimo >= 1),
  primary key (condominio_id, ano)
);
call proteger_tabela_condominio('numeracao_reservas');

create table reservas (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  protocolo     text not null check (protocolo ~ '^[0-9]{4}-R[0-9]{3,6}$'),
  area_id       uuid not null,
  unidade_id    uuid not null,
  contato_id    uuid,
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  hora_inicio   time not null,
  hora_fim      time not null,
  estado        text not null check (estado in ('A_APROVAR', 'CONFIRMADA', 'RECUSADA', 'CANCELADA')),
  origem        text not null check (origem in ('WHATSAPP', 'PAINEL')),
  -- Passou do limite pela tolerância (AC-06).
  tolerancia    boolean not null default false,
  observacao    text check (length(btrim(observacao)) between 1 and 300),
  decidido_em   timestamptz,
  decidido_por  uuid references pessoas (id),
  motivo        text check (length(btrim(motivo)) between 3 and 500),
  cancelada_pelo_morador boolean not null default false,
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  atualizado_em timestamptz not null default app_now(),
  versao        integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, protocolo),
  foreign key (area_id, condominio_id) references areas_comuns (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  check (hora_fim > hora_inicio),
  check (origem <> 'PAINEL' or criado_por is not null),
  check (estado in ('A_APROVAR', 'CONFIRMADA') or motivo is not null),
  check (not cancelada_pelo_morador or estado = 'CANCELADA')
);
create index reservas_area_data on reservas (area_id, data) where estado in ('A_APROVAR', 'CONFIRMADA');
create index reservas_condominio_data on reservas (condominio_id, data);
create index reservas_unidade on reservas (unidade_id, area_id, data) where estado in ('A_APROVAR', 'CONFIRMADA');
-- Rede de segurança: a mesma área não tem duas reservas confirmadas começando na mesma hora.
create unique index reservas_confirmada_unica on reservas (area_id, data, hora_inicio) where estado = 'CONFIRMADA';
call proteger_tabela_condominio('reservas');
call ligar_guardiao('reservas');
insert into estados_iniciais (tabela, estado) values ('reservas', 'A_APROVAR'), ('reservas', 'CONFIRMADA');
insert into transicoes_permitidas (tabela, de, para) values
  ('reservas', 'A_APROVAR', 'CONFIRMADA'),
  ('reservas', 'A_APROVAR', 'RECUSADA'),
  ('reservas', 'A_APROVAR', 'CANCELADA'),
  ('reservas', 'CONFIRMADA', 'CANCELADA');
create trigger reservas_sem_exclusao before delete on reservas for each row execute function somente_insercao();

-- Recusada e cancelada não mudam mais; o que foi pedido (área, unidade, data) não muda.
create function reservas_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado in ('RECUSADA', 'CANCELADA') then
    raise exception 'Reserva recusada ou cancelada não muda' using errcode = 'TC422';
  end if;
  if (new.protocolo, new.area_id, new.unidade_id, new.data, new.hora_inicio, new.hora_fim, new.origem, new.criado_em, new.criado_por)
     is distinct from (old.protocolo, old.area_id, old.unidade_id, old.data, old.hora_inicio, old.hora_fim, old.origem, old.criado_em, old.criado_por) then
    raise exception 'O pedido de reserva não muda: cancele e peça outro' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger reservas_regras before update on reservas for each row execute function reservas_regras();

-- Avisos no sino sobre reservas: pedido a aprovar e cancelamento fora do prazo.
create table avisos_vida (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  tipo          text not null check (tipo in ('RESERVA_A_APROVAR', 'RESERVA_CANCELADA')),
  reserva_id    uuid,
  referencia    text not null check (length(referencia) between 1 and 100),
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (reserva_id, condominio_id) references reservas (id, condominio_id),
  unique (pessoa_id, tipo, referencia)
);
create index avisos_vida_pessoa on avisos_vida (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_vida');
create trigger avisos_vida_sem_exclusao before delete on avisos_vida for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- WhatsApp: etapas da reserva, finalidade e modelo novos (W-20, W-22).

alter table conversas_whatsapp drop constraint conversas_whatsapp_etapa_check;
alter table conversas_whatsapp add constraint conversas_whatsapp_etapa_check
  check (etapa in ('INICIO', 'MENU', 'UNIDADE', 'ANEXANDO', 'CONSULTA',
                   'RESERVA_AREA', 'RESERVA_UNIDADE', 'RESERVA_DIA', 'RESERVA_HORARIO', 'RESERVA_CONFIRMAR'));
-- O que a conversa da reserva já escolheu (área, unidade, contato, dia, horário).
alter table conversas_whatsapp add column vida jsonb check (jsonb_typeof(vida) = 'object');

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA'));
alter table envios_whatsapp add column reserva_id uuid;
alter table envios_whatsapp add constraint envios_whatsapp_reserva foreign key (reserva_id, condominio_id) references reservas (id, condominio_id);

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida'));

insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('reserva_decidida', 1, 'Reserva decidida', 'MORADOR', 'Aprovação, recusa ou cancelamento de reserva, com a conversa fechada',
   '["protocolo", "condomínio", "decisão e detalhes", "quem decidiu"]',
   E'Sobre a sua reserva {{1}} no {{2}}: {{3}}\n\n{{4}}, do condomínio\n\nPara responder, é só mandar mensagem aqui.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave = 'reserva_decidida';

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- "Salão de festas" no meio da frase: "salão de festas".
create function nome_na_frase(p text) returns text
language sql immutable
set search_path = public
as $$ select lower(left(p, 1)) || substr(p, 2) $$;

-- "sábado, 25/10".
create function dia_por_extenso(p date) returns text
language sql immutable
set search_path = public
as $$
  select (array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])[extract(dow from p)::integer + 1]
      || ', ' || to_char(p, 'DD/MM')
$$;

-- "das 10h às 23h".
create function horas_por_extenso(p_ini time, p_fim time) returns text
language sql immutable
set search_path = public
as $$ select 'das ' || hora_curta(to_char(p_ini, 'HH24:MI')) || ' às ' || hora_curta(case when p_fim = time '24:00' then '24:00' else to_char(p_fim, 'HH24:MI') end) $$;

-- Data escrita pelo morador: "25/10", "25/10/2026", "5/1". Sem ano, a próxima ocorrência.
create function data_do_whatsapp(p text, p_hoje date) returns date
language plpgsql immutable
set search_path = public
as $$
declare
  m text[] := regexp_match(btrim(coalesce(p, '')), '^([0-9]{1,2})[/.-]([0-9]{1,2})(?:[/.-]([0-9]{2}|[0-9]{4}))?$');
  v_ano integer;
  v date;
begin
  if m is null then return null; end if;
  v_ano := case when m[3] is null then extract(year from p_hoje)::integer
                when length(m[3]) = 2 then 2000 + m[3]::integer else m[3]::integer end;
  begin
    v := make_date(v_ano, m[2]::integer, m[1]::integer);
  exception when others then return null;
  end;
  if m[3] is null and v < p_hoje then v := (v + interval '1 year')::date; end if;
  return v;
end $$;

-- O período do limite em que uma data cai: a semana (domingo a sábado) ou o mês.
create function periodo_do_limite(p_periodo text, p_data date) returns daterange
language sql immutable
set search_path = public
as $$
  select case p_periodo
    when 'SEMANA' then daterange(p_data - extract(dow from p_data)::integer, p_data - extract(dow from p_data)::integer + 7)
    else daterange(date_trunc('month', p_data)::date, (date_trunc('month', p_data) + interval '1 month')::date) end
$$;

-- "em outubro" ou "nesta semana" / "na semana de 19/10".
create function periodo_por_extenso(p_periodo text, p_data date) returns text
language sql stable
set search_path = public
as $$
  select case p_periodo
    when 'SEMANA' then 'na semana de ' || to_char(lower(periodo_do_limite('SEMANA', p_data)), 'DD/MM')
    else 'em ' || (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
                         'novembro', 'dezembro'])[extract(month from p_data)::integer] end
$$;

-- Quantas reservas a unidade já tem na área, no período da data (confirmadas e a aprovar).
create function reservas_no_periodo(a areas_comuns, p_unidade uuid, p_data date, p_ignorar uuid) returns integer
language sql stable
set search_path = public
as $$
  select count(*)::integer from reservas r
   where r.area_id = a.id and r.unidade_id = p_unidade and r.estado in ('A_APROVAR', 'CONFIRMADA')
     and r.data <@ periodo_do_limite(a.limite_periodo, p_data) and r.id is distinct from p_ignorar
$$;

-- O limite para uma data (AC-06): null cabe; TOLERANCIA passa pela tolerância; LIMITE não cabe.
create function situacao_limite(a areas_comuns, p_unidade uuid, p_data date, p_ignorar uuid) returns text
language plpgsql stable
set search_path = public
as $$
declare v_n integer;
begin
  if a.limite_quantidade is null then return null; end if;
  v_n := reservas_no_periodo(a, p_unidade, p_data, p_ignorar);
  if v_n < a.limite_quantidade then return null; end if;
  if a.tolerancia_dias is not null and v_n < a.limite_quantidade + 1 and p_data - hoje_no_condominio() <= a.tolerancia_dias then
    return 'TOLERANCIA';
  end if;
  return 'LIMITE';
end $$;

-- O que ocupa a área num horário: uma reserva confirmada ou um compromisso da Agenda no mesmo
-- lugar (pelo nome da área). Devolve o motivo e o título, ou nada.
create function ocupacao_da_area(a areas_comuns, p_data date, p_ini time, p_fim time, p_ignorar uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('motivo', 'RESERVA', 'id', r.id, 'titulo', 'Reserva ' || r.protocolo || ' · ' || rotulo_unidade(r.unidade_id))
       from reservas r
      where r.area_id = a.id and r.data = p_data and r.estado = 'CONFIRMADA' and r.id is distinct from p_ignorar
        and r.hora_inicio < p_fim and p_ini < r.hora_fim
      order by r.hora_inicio limit 1),
    (select jsonb_build_object('motivo', 'AGENDA', 'id', c.id, 'titulo', c.titulo)
       from compromissos c
      where c.data = p_data and c.onde = 'AREA_COMUM' and lower(btrim(c.local)) = lower(btrim(a.nome))
        and c.estado not in ('REALIZADO', 'CANCELADO') and compromissos_se_sobrepoem(c.hora_inicio, c.hora_fim, p_ini, p_fim)
      order by c.hora_inicio nulls first limit 1))
$$;

-- Horas em minutos e de volta ("24:00" é o fim do dia).
create function minutos_do_dia(p time) returns integer
language sql immutable
set search_path = public
as $$ select (extract(epoch from p) / 60)::integer $$;

create function hora_dos_minutos(p integer) returns time
language sql immutable
set search_path = public
as $$ select case when p >= 1440 then time '24:00' else make_time(p / 60, p % 60, 0) end $$;

-- O fim de um bloco que começa numa hora.
create function fim_do_bloco(a areas_comuns, p_ini time) returns time
language sql immutable
set search_path = public
as $$ select hora_dos_minutos(minutos_do_dia(p_ini) + a.bloco_minutos) $$;

-- Inícios dos blocos de horas da área num dia: todos ou só os livres.
create function blocos_da_area(a areas_comuns, p_data date, p_so_livres boolean) returns time[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(t order by t), '{}') from (
    select hora_dos_minutos(s) as t
      from generate_series(minutos_do_dia(a.hora_inicio), minutos_do_dia(a.hora_fim) - coalesce(a.bloco_minutos, 1440),
                           greatest(coalesce(a.bloco_minutos, 1440), 1)) s
     where a.modo = 'BLOCOS') b
   where not p_so_livres or ocupacao_da_area(a, p_data, t, fim_do_bloco(a, t), null) is null
$$;

-- A área tem horário livre no dia (o período inteiro ou algum bloco).
create function area_livre_no_dia(a areas_comuns, p_data date) returns boolean
language sql stable
set search_path = public
as $$
  select case when a.modo = 'BLOCOS' then cardinality(blocos_da_area(a, p_data, true)) > 0
              else ocupacao_da_area(a, p_data, a.hora_inicio, a.hora_fim, null) is null end
$$;

-- As primeiras datas livres da área a partir de uma data, dentro da antecedência.
create function datas_livres(a areas_comuns, p_de date, p_n integer) returns date[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(d order by d), '{}') from (
    select d::date from generate_series(greatest(p_de, hoje_no_condominio() + a.antecedencia_min),
                                        hoje_no_condominio() + a.antecedencia_max, interval '1 day') d
     where area_livre_no_dia(a, d::date)
     order by d limit p_n) x
$$;

-- A próxima data que a unidade pode pedir: livre e dentro do limite (com a tolerância).
create function proxima_data_reserva(a areas_comuns, p_unidade uuid) returns date
language sql stable
set search_path = public
as $$
  select d::date from generate_series(hoje_no_condominio() + a.antecedencia_min, hoje_no_condominio() + a.antecedencia_max,
                                      interval '1 day') d
   where coalesce(situacao_limite(a, p_unidade, d::date, null), '') <> 'LIMITE' and area_livre_no_dia(a, d::date)
   order by d limit 1
$$;

-- Quem cuida das reservas: o síndico e quem tem Cuidar das reservas.
create function quem_cuida_das_reservas() returns uuid[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct v.pessoa_id), '{}') from vinculos v
   where v.condominio_id = contexto_condominio() and v.revogado_em is null and v.funcao in ('SINDICO', 'AUTORIZADO')
     and (v.funcao = 'SINDICO' or pode(v.pessoa_id, v.condominio_id, 'reservas.editar'))
$$;

create function avisar_vida(p_pessoas uuid[], p_tipo text, p_reserva uuid, p_referencia text) returns integer
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  insert into avisos_vida (condominio_id, pessoa_id, tipo, reserva_id, referencia)
  select contexto_condominio(), x, p_tipo, p_reserva, p_referencia from unnest(p_pessoas) x where x is not null
  on conflict (pessoa_id, tipo, referencia) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- O vínculo deixa reservar a área (decisão 5): vínculo confirmado e a marcação que a área aceita.
create function vinculo_pode_reservar(a areas_comuns, cu contatos_unidade) returns boolean
language sql stable
set search_path = public
as $$
  select cu.estado = 'CONFIRMADO'
     and ((cu.proprietario and cu.mora and a.pode_proprietario_morador)
          or (cu.proprietario and not cu.mora and a.pode_proprietario_ausente)
          or (cu.ligacao = 'INQUILINO' and a.pode_inquilino))
$$;

-- Unidades em que os contatos do telefone podem reservar a área, em ordem estável.
create function unidades_para_reservar(a areas_comuns, p_contatos uuid[]) returns table (unidade_id uuid, contato_id uuid, rotulo text)
language sql stable
set search_path = public
as $$
  select x.unidade_id, x.contato_id, x.rotulo from (
    select distinct on (cu.unidade_id) cu.unidade_id, cu.contato_id, rotulo_unidade(cu.unidade_id) as rotulo
      from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa
     where cu.contato_id = any (p_contatos) and vinculo_pode_reservar(a, cu)
     order by cu.unidade_id, cu.principal desc, cu.criado_em) x
   order by x.rotulo, x.unidade_id
$$;

-- Áreas que os contatos podem reservar agora, em ordem de nome.
create function areas_para_reservar(p_contatos uuid[]) returns setof areas_comuns
language sql stable
set search_path = public
as $$
  select a.* from areas_comuns a
   where a.ativa and a.reserva <> 'SEM_RESERVA' and exists (select 1 from unidades_para_reservar(a, p_contatos))
   order by lower(a.nome)
$$;

-- Confere um pedido de reserva. Devolve o horário e, quando não cabe, o motivo:
-- FORA_DO_PRAZO, HORARIO, OCUPADA (com o que ocupa) ou LIMITE; com a tolerância, tolerancia.
create function conferir_reserva(a areas_comuns, p_unidade uuid, p_data date, p_inicio time, p_ignorar uuid) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_ini time;
  v_fim time;
  v_ocupa jsonb;
  v_limite text;
begin
  if p_data is null or p_data < hoje_no_condominio() + a.antecedencia_min or p_data > hoje_no_condominio() + a.antecedencia_max then
    return jsonb_build_object('erro', 'FORA_DO_PRAZO');
  end if;
  if a.modo = 'BLOCOS' then
    if p_inicio is null or not (p_inicio = any (blocos_da_area(a, p_data, false))) then
      return jsonb_build_object('erro', 'HORARIO');
    end if;
    v_ini := p_inicio;
    v_fim := fim_do_bloco(a, p_inicio);
  else
    v_ini := a.hora_inicio;
    v_fim := a.hora_fim;
  end if;
  v_ocupa := ocupacao_da_area(a, p_data, v_ini, v_fim, p_ignorar);
  if v_ocupa is not null then return jsonb_build_object('erro', 'OCUPADA', 'ocupacao', v_ocupa, 'inicio', v_ini, 'fim', v_fim); end if;
  v_limite := situacao_limite(a, p_unidade, p_data, p_ignorar);
  if v_limite = 'LIMITE' then return jsonb_build_object('erro', 'LIMITE', 'inicio', v_ini, 'fim', v_fim); end if;
  return jsonb_build_object('inicio', v_ini, 'fim', v_fim, 'tolerancia', v_limite = 'TOLERANCIA');
end $$;

-- O protocolo curto ("R014") e o completo ("2026-R014").
create function protocolo_curto(p text) returns text
language sql immutable
set search_path = public
as $$ select split_part(p, '-', 2) $$;

-- Grava a reserva: confere de novo com a área travada, numera, nasce a aprovar ou confirmada
-- e avisa quem cuida quando espera aprovação.
create function gravar_reserva(a areas_comuns, p_unidade uuid, p_contato uuid, p_data date, p_inicio time, p_origem text,
                               p_observacao text) returns reservas
language plpgsql
set search_path = public
as $$
declare
  v_conf jsonb;
  v_ano integer := extract(year from hoje_no_condominio())::integer;
  v_numero integer;
  r reservas;
begin
  perform pg_advisory_xact_lock(hashtextextended('reservas:' || a.id::text, 0));
  if a.reserva = 'SEM_RESERVA' or not a.ativa then perform recusar_motivo('Esta área não aceita reserva', 'AREA_SEM_RESERVA'); end if;
  v_conf := conferir_reserva(a, p_unidade, p_data, p_inicio, null);
  if v_conf ? 'erro' then
    raise exception 'A reserva não cabe' using errcode = 'TC422', detail = jsonb_build_object('motivo', 'RESERVA_' || (v_conf ->> 'erro'),
      'ocupacao', v_conf -> 'ocupacao')::text;
  end if;
  insert into numeracao_reservas as x (condominio_id, ano, ultimo) values (contexto_condominio(), v_ano, 1)
  on conflict (condominio_id, ano) do update set ultimo = x.ultimo + 1
  returning ultimo into v_numero;
  perform definir_transicao(case when a.reserva = 'AUTOMATICA' then 'CONFIRMADA' else 'PEDIDA' end, null, contexto_pessoa() is null);
  insert into reservas (condominio_id, protocolo, area_id, unidade_id, contato_id, data, hora_inicio, hora_fim, estado, origem,
                        tolerancia, observacao, decidido_em, criado_por)
  values (contexto_condominio(), v_ano || '-R' || lpad(v_numero::text, 3, '0'), a.id, p_unidade, p_contato, p_data,
          (v_conf ->> 'inicio')::time, (v_conf ->> 'fim')::time,
          case when a.reserva = 'AUTOMATICA' then 'CONFIRMADA' else 'A_APROVAR' end, p_origem,
          coalesce((v_conf ->> 'tolerancia')::boolean, false), nullif(btrim(coalesce(p_observacao, '')), ''),
          case when a.reserva = 'AUTOMATICA' then app_now() end, contexto_pessoa())
  returning * into r;
  perform registrar_historico('reserva.registrada', 'reservas', r.id::text, jsonb_strip_nulls(jsonb_build_object(
    'protocolo', r.protocolo, 'area', a.id, 'unidade', r.unidade_id, 'data', to_char(r.data, 'YYYY-MM-DD'), 'origem', r.origem,
    'tolerancia', case when r.tolerancia then true end, 'automatica', case when a.reserva = 'AUTOMATICA' then true end)));
  if r.estado = 'A_APROVAR' then
    perform avisar_vida(quem_cuida_das_reservas(), 'RESERVA_A_APROVAR', r.id, r.id::text);
  end if;
  return r;
end $$;

-- A decisão vai ao morador (decisão 4 e 15): dentro da janela, texto livre; fora, pelo modelo.
create function avisar_morador_reserva(r reservas, p_decisao text, p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  ct contatos;
  v_envio uuid;
  v_quem text := nome_curto(nome_pessoa(p_pessoa));
begin
  if r.contato_id is null then return; end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then return; end if;
  select * into ct from contatos where id = r.contato_id;
  if ct.id is null or ct.telefone is null or ct.dados_removidos_em is not null then return; end if;
  v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, null, null, 'RESERVA',
    'Sobre a reserva ' || r.protocolo || ': ' || p_decisao || E'\n\n' || v_quem || ', do condomínio', p_pessoa, p_pessoa);
  update envios_whatsapp set reserva_id = r.id, modelo_chave = 'reserva_decidida',
                             modelo_parametros = jsonb_build_array(r.protocolo, nome_do_condominio(), left(p_decisao, 700), v_quem)
   where id = v_envio;
end $$;

-- "salão de festas, sábado, 25/10, das 10h às 23h, para a Torre A · 302".
create function descrever_reserva(r reservas) returns text
language sql stable
set search_path = public
as $$
  select nome_na_frase(a.nome) || ', ' || dia_por_extenso(r.data) || ', ' || horas_por_extenso(r.hora_inicio, r.hora_fim)
      || ', para a ' || rotulo_unidade(r.unidade_id)
    from areas_comuns a where a.id = r.area_id
$$;

-- "R$ 1.150,00".
create function reais(p_centavos integer) returns text
language sql immutable
set search_path = public
as $$ select 'R$ ' || replace(to_char(p_centavos / 100, 'FM999,999,990'), ',', '.') || ',' || lpad((p_centavos % 100)::text, 2, '0') $$;

create function assinatura_nina() returns text
language sql stable
set search_path = public
as $$ select E'\n\nNina, assistente virtual do ' || nome_do_condominio() $$;

-- ---------------------------------------------------------------------------------------
-- Reserva pelo WhatsApp (decisão 6; W-22).

create function resposta_vida(m mensagens_whatsapp, p_texto text) returns void
language sql
set search_path = public
as $$ select responder_whatsapp(m.telefone, m.contato_id, null, p_texto) $$;

create function sair_da_reserva(c conversas_whatsapp) returns void
language sql
set search_path = public
as $$ update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, vida = null where id = c.id $$;

-- Mostra as datas da área e pergunta o dia; com a unidade no limite, diz antes e dá a próxima data.
create function perguntar_dia_reserva(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns, p_unidade uuid, p_contato uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_hoje date := hoje_no_condominio();
  v_prox date := proxima_data_reserva(a, p_unidade);
  v_primeira date := v_hoje + a.antecedencia_min;
  v_texto text;
begin
  if v_prox is null then
    perform sair_da_reserva(c);
    perform resposta_vida(m, 'Não há data livre para reservar ' || nome_na_frase(a.nome) || ' até ' || to_char(v_hoje + a.antecedencia_max, 'DD/MM')
      || ' para a ' || rotulo_unidade(p_unidade) || '. Se precisar, fale com o condomínio.');
    return;
  end if;
  update conversas_whatsapp set etapa = 'RESERVA_DIA', etapa_ate = app_now() + interval '30 minutes',
         vida = jsonb_build_object('area', a.id, 'unidade', p_unidade, 'contato', p_contato)
   where id = c.id;
  if a.limite_quantidade is not null and situacao_limite(a, p_unidade, v_primeira, null) is not null then
    v_texto := 'A ' || rotulo_unidade(p_unidade) || ' já chegou ao limite de ' || a.limite_quantidade
      || case when a.limite_quantidade = 1 then ' reserva' else ' reservas' end || ' de ' || nome_na_frase(a.nome) || ' '
      || periodo_por_extenso(a.limite_periodo, v_primeira) || '.'
      || case when a.tolerancia_dias is not null
              then E'\nSe a data ainda estiver livre ' || a.tolerancia_dias || ' dias antes, dá para pedir mais uma.' else '' end
      || E'\nHoje dá para reservar ' || dia_por_extenso(v_prox) || '.'
      || E'\n\nResponda com o dia, por exemplo ' || to_char(v_prox, 'DD/MM') || ', ou SAIR.';
  else
    v_texto := a.nome || coalesce(', para até ' || a.capacidade || ' pessoas', '') || ', '
      || case when a.modo = 'BLOCOS' then 'em blocos de ' || case when a.bloco_minutos % 60 = 0
                                                             then (a.bloco_minutos / 60) || case when a.bloco_minutos = 60 then ' hora' else ' horas' end
                                                             else a.bloco_minutos || ' minutos' end || ', '
              else '' end
      || horas_por_extenso(a.hora_inicio, a.hora_fim) || '. Pode ser de ' || to_char(v_primeira, 'DD/MM') || ' a '
      || to_char(v_hoje + a.antecedencia_max, 'DD/MM') || '. Qual dia? Responda, por exemplo, ' || to_char(v_prox, 'DD/MM') || '.';
  end if;
  perform resposta_vida(m, v_texto);
end $$;

-- Pergunta o horário nas áreas em blocos.
create function perguntar_horario_reserva(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns, p_data date) returns void
language plpgsql
set search_path = public
as $$
declare v_blocos time[] := blocos_da_area(a, p_data, true);
begin
  update conversas_whatsapp set etapa = 'RESERVA_HORARIO', etapa_ate = app_now() + interval '30 minutes',
         vida = vida || jsonb_build_object('data', p_data)
   where id = c.id;
  perform resposta_vida(m, 'Horários livres ' || case when extract(dow from p_data) in (0, 6) then 'no ' else 'na ' end
    || dia_por_extenso(p_data) || E'. Responda com o número:\n'
    || (select string_agg(i || ' · ' || horas_por_extenso(t, fim_do_bloco(a, t)), E'\n' order by i)
          from unnest(v_blocos) with ordinality x(t, i)));
end $$;

-- Mostra o resumo e pede o SIM.
create function pedir_sim_reserva(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns, p_data date, p_inicio time, p_fim time)
returns void
language plpgsql
set search_path = public
as $$
declare v_doc text;
begin
  select titulo into v_doc from documentos where id = a.regras_documento_id and arquivado_em is null;
  update conversas_whatsapp set etapa = 'RESERVA_CONFIRMAR', etapa_ate = app_now() + interval '30 minutes',
         vida = vida || jsonb_build_object('data', p_data, 'inicio', to_char(p_inicio, 'HH24:MI'))
   where id = c.id;
  perform resposta_vida(m, a.nome || ' está livre ' || case when extract(dow from p_data) in (0, 6) then 'no ' else 'na ' end
    || dia_por_extenso(p_data) || ', ' || horas_por_extenso(p_inicio, p_fim) || '.'
    || case when a.valor_centavos is not null and a.valor_centavos > 0
            then ' O valor de uso é ' || reais(a.valor_centavos) || '.' else '' end
    || case when v_doc is not null then ' As regras de uso estão no documento ' || v_doc || '.' else '' end
    || E'\nResponda SIM para ' || case when a.reserva = 'SINDICO' then 'pedir a reserva' else 'reservar' end
    || ', outro dia para trocar, ou SAIR.');
end $$;

-- Recebe o dia escrito pelo morador e decide o próximo passo.
create function receber_dia_reserva(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns, p_texto text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_unidade uuid := (c.vida ->> 'unidade')::uuid;
  v_data date := data_do_whatsapp(p_texto, hoje_no_condominio());
  v_conf jsonb;
  v_livres date[];
begin
  if v_data is null then
    perform resposta_vida(m, 'Responda só com o dia, por exemplo ' || to_char(coalesce(proxima_data_reserva(a, v_unidade), hoje_no_condominio()), 'DD/MM')
      || ', ou SAIR.');
    return;
  end if;
  if a.modo = 'BLOCOS' then
    v_conf := conferir_reserva(a, v_unidade, v_data, (blocos_da_area(a, v_data, true))[1], null);
    if (v_conf ->> 'erro') = 'HORARIO' then v_conf := jsonb_build_object('erro', 'OCUPADA'); end if;
  else
    v_conf := conferir_reserva(a, v_unidade, v_data, null, null);
  end if;
  if (v_conf ->> 'erro') = 'FORA_DO_PRAZO' then
    perform resposta_vida(m, 'Essa data fica fora do prazo de ' || nome_na_frase(a.nome) || ': pode ser de '
      || to_char(hoje_no_condominio() + a.antecedencia_min, 'DD/MM') || ' a ' || to_char(hoje_no_condominio() + a.antecedencia_max, 'DD/MM')
      || '. Responda com outro dia ou SAIR.');
  elsif (v_conf ->> 'erro') = 'OCUPADA' then
    v_livres := datas_livres(a, v_data + 1, 2);
    perform resposta_vida(m, a.nome || ' não está livre ' || case when extract(dow from v_data) in (0, 6) then 'no ' else 'na ' end
      || dia_por_extenso(v_data) || '.'
      || case when cardinality(v_livres) > 0
              then ' Livre ' || (select string_agg(dia_por_extenso(d), ' e ' order by d) from unnest(v_livres) d) || '.' else '' end
      || ' Responda com outro dia ou SAIR.');
  elsif (v_conf ->> 'erro') = 'LIMITE' then
    perform resposta_vida(m, 'A ' || rotulo_unidade(v_unidade) || ' já chegou ao limite de ' || a.limite_quantidade
      || case when a.limite_quantidade = 1 then ' reserva' else ' reservas' end || ' de ' || nome_na_frase(a.nome) || ' '
      || periodo_por_extenso(a.limite_periodo, v_data) || '.'
      || coalesce(' Dá para reservar ' || dia_por_extenso(proxima_data_reserva(a, v_unidade)) || '.', '')
      || ' Responda com outro dia ou SAIR.');
  elsif a.modo = 'BLOCOS' then
    perform perguntar_horario_reserva(m, c, a, v_data);
  else
    perform pedir_sim_reserva(m, c, a, v_data, (v_conf ->> 'inicio')::time, (v_conf ->> 'fim')::time);
  end if;
end $$;

-- Escolhida a área: a unidade (quando há mais de uma) ou já o dia.
create function escolher_area_reserva(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns, p_contatos uuid[]) returns void
language plpgsql
set search_path = public
as $$
declare
  v_n integer;
  u record;
begin
  select count(*) into v_n from unidades_para_reservar(a, p_contatos);
  if v_n > 1 then
    update conversas_whatsapp set etapa = 'RESERVA_UNIDADE', etapa_ate = app_now() + interval '30 minutes',
           vida = jsonb_build_object('area', a.id)
     where id = c.id;
    perform resposta_vida(m, E'A reserva é para qual unidade? Responda com o número:\n'
      || (select string_agg(i || ' · ' || rotulo, E'\n' order by i)
            from (select rotulo, row_number() over () as i from unidades_para_reservar(a, p_contatos)) x));
    return;
  end if;
  select * into u from unidades_para_reservar(a, p_contatos) limit 1;
  perform perguntar_dia_reserva(m, c, a, u.unidade_id, u.contato_id);
end $$;

-- RESERVAR, ou RESERVAR com o nome da área (o botão da etiqueta).
create function iniciar_reserva_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[], p_resto text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_nome text := (select nome from contatos where id = m.contato_id);
  v_areas uuid[];
  a areas_comuns;
  v_resto text := lower(btrim(coalesce(p_resto, '')));
begin
  select coalesce(array_agg(id order by lower(nome)), '{}') into v_areas from areas_para_reservar(p_contatos);
  if cardinality(v_areas) = 0 then
    perform sair_da_reserva(c);
    if exists (select 1 from areas_comuns where ativa and reserva <> 'SEM_RESERVA') then
      perform resposta_vida(m, 'Pelo cadastro do condomínio, as reservas são feitas por quem mora na unidade como proprietário ou inquilino. '
        || 'Se o seu cadastro está diferente, fale com o condomínio.');
    else
      perform resposta_vida(m, 'O ' || nome_do_condominio() || ' ainda não tem área para reservar por aqui.');
    end if;
    return;
  end if;
  if v_resto <> '' then
    select * into a from areas_comuns where id = any (v_areas) and lower(btrim(nome)) = v_resto;
    if a.id is not null then
      perform escolher_area_reserva(m, c, a, p_contatos);
      return;
    end if;
  end if;
  if cardinality(v_areas) = 1 then
    select * into a from areas_comuns where id = v_areas[1];
    perform escolher_area_reserva(m, c, a, p_contatos);
    return;
  end if;
  update conversas_whatsapp set etapa = 'RESERVA_AREA', etapa_ate = app_now() + interval '30 minutes',
         vida = jsonb_build_object('areas', to_jsonb(v_areas))
   where id = c.id;
  perform resposta_vida(m, 'Olá, ' || nome_curto(v_nome) || E'. Qual área você quer reservar? Responda com o número:\n'
    || (select string_agg(i || '. ' || x.nome, E'\n' order by i)
          from unnest(v_areas) with ordinality v(id, i) join areas_comuns x on x.id = v.id));
end $$;

-- Grava o pedido do morador depois do SIM.
create function concluir_reserva_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, a areas_comuns) returns void
language plpgsql
set search_path = public
as $$
declare
  r reservas;
  v_conf jsonb;
  v_data date := (c.vida ->> 'data')::date;
  v_unidade uuid := (c.vida ->> 'unidade')::uuid;
begin
  -- Confere de novo: alguém pode ter reservado enquanto o morador respondia.
  v_conf := conferir_reserva(a, v_unidade, v_data, (c.vida ->> 'inicio')::time, null);
  if v_conf ? 'erro' or not a.ativa or a.reserva = 'SEM_RESERVA' then
    perform receber_dia_reserva(m, c, a, to_char(v_data, 'DD/MM/YYYY'));
    return;
  end if;
  r := gravar_reserva(a, v_unidade, (c.vida ->> 'contato')::uuid, v_data, (c.vida ->> 'inicio')::time, 'WHATSAPP', null);
  perform sair_da_reserva(c);
  if r.estado = 'CONFIRMADA' then
    perform resposta_vida(m, 'Reserva ' || r.protocolo || ' confirmada: ' || descrever_reserva(r) || '.'
      || ' Para cancelar, responda CANCELAR ' || protocolo_curto(r.protocolo)
      || case when r.data - a.cancelar_sem_aviso_dias > hoje_no_condominio() then ' até ' || to_char(r.data - a.cancelar_sem_aviso_dias, 'DD/MM') else '' end
      || '.' || assinatura_nina());
  else
    perform resposta_vida(m, 'Pedido de reserva ' || r.protocolo || ' registrado: ' || descrever_reserva(r) || '.'
      || ' Quem cuida do condomínio aprova, e eu aviso aqui.' || assinatura_nina());
  end if;
end $$;

-- CANCELAR R015: o morador cancela a reserva de uma unidade dele. Depois do prazo da área,
-- quem cuida das reservas é avisado.
create function cancelar_reserva_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[], p_resto text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cod text := upper(regexp_replace(btrim(coalesce(p_resto, '')), '\s+', '', 'g'));
  v_num integer := (substring(v_cod from '^(?:[0-9]{4}-)?R([0-9]{1,6})$'))::integer;
  v_ano text := substring(v_cod from '^([0-9]{4})-');
  r reservas;
  a areas_comuns;
  v_lista text;
begin
  perform sair_da_reserva(c);
  if v_num is not null then
    select x.* into r from reservas x
     where x.estado in ('A_APROVAR', 'CONFIRMADA') and x.data >= hoje_no_condominio()
       and x.unidade_id in (select unidade_id from unidades_dos_contatos(p_contatos))
       and substr(protocolo_curto(x.protocolo), 2)::integer = v_num and (v_ano is null or split_part(x.protocolo, '-', 1) = v_ano)
     order by x.data limit 1;
  end if;
  if r.id is null then
    select string_agg('CANCELAR ' || protocolo_curto(x.protocolo) || ' · ' || nome_na_frase(a2.nome) || ', ' || dia_por_extenso(x.data), E'\n' order by x.data)
      into v_lista
      from reservas x join areas_comuns a2 on a2.id = x.area_id
     where x.estado in ('A_APROVAR', 'CONFIRMADA') and x.data >= hoje_no_condominio()
       and x.unidade_id in (select unidade_id from unidades_dos_contatos(p_contatos));
    perform resposta_vida(m, case when v_lista is null then 'Não encontrei reserva marcada para as suas unidades.'
      else case when v_cod = '' then 'Qual reserva você quer cancelar? Responda com a linha da reserva:' else 'Não encontrei essa reserva. As suas são:' end
           || E'\n' || v_lista end);
    return;
  end if;
  select * into a from areas_comuns where id = r.area_id;
  perform definir_transicao('CANCELADA_PELO_MORADOR', 'Cancelada pelo morador pelo WhatsApp', true);
  update reservas set estado = 'CANCELADA', motivo = 'Cancelada pelo morador pelo WhatsApp', cancelada_pelo_morador = true,
                      decidido_em = app_now(), decidido_por = null
   where id = r.id;
  if r.estado = 'CONFIRMADA' and r.data - hoje_no_condominio() < a.cancelar_sem_aviso_dias then
    perform avisar_vida(quem_cuida_das_reservas(), 'RESERVA_CANCELADA', r.id, r.id::text);
  end if;
  perform resposta_vida(m, 'Reserva ' || r.protocolo || ' cancelada: ' || nome_na_frase(a.nome) || ', ' || dia_por_extenso(r.data) || '.'
    || assinatura_nina());
end $$;

-- As etapas da conversa da reserva.
create function continuar_reserva_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[]) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
  v_n integer := case when btrim(coalesce(m.texto, '')) ~ '^[0-9]{1,2}$' then btrim(m.texto)::integer end;
  a areas_comuns;
  u record;
  v_blocos time[];
  v_data date;
begin
  if v_cmd in ('SAIR', 'SAI', 'CANCELA') then
    perform sair_da_reserva(c);
    perform resposta_vida(m, 'Tudo bem, a reserva não foi feita. Para começar de novo, mande RESERVAR.');
    return;
  end if;
  if c.etapa = 'RESERVA_AREA' then
    if v_n between 1 and jsonb_array_length(c.vida -> 'areas') then
      select * into a from areas_comuns where id = (c.vida -> 'areas' ->> (v_n - 1))::uuid and ativa and reserva <> 'SEM_RESERVA';
    end if;
    if a.id is null then
      perform resposta_vida(m, 'Responda só com o número da área, de 1 a ' || jsonb_array_length(c.vida -> 'areas') || ', ou SAIR.');
      return;
    end if;
    perform escolher_area_reserva(m, c, a, p_contatos);
    return;
  end if;
  select * into a from areas_comuns where id = (c.vida ->> 'area')::uuid;
  if a.id is null or not a.ativa or a.reserva = 'SEM_RESERVA' then
    perform sair_da_reserva(c);
    perform resposta_vida(m, 'Esta área não está aceitando reservas agora. Para começar de novo, mande RESERVAR.');
    return;
  end if;
  if c.etapa = 'RESERVA_UNIDADE' then
    v_n := case when btrim(coalesce(m.texto, '')) ~ '^[0-9]{1,2}$' then btrim(m.texto)::integer end;
    select * into u from unidades_para_reservar(a, p_contatos) offset greatest(coalesce(v_n, 0) - 1, 0) limit 1;
    if v_n is null or v_n < 1 or v_n > (select count(*) from unidades_para_reservar(a, p_contatos)) then
      perform resposta_vida(m, 'Responda só com o número da unidade, ou SAIR.');
      return;
    end if;
    perform perguntar_dia_reserva(m, c, a, u.unidade_id, u.contato_id);
    return;
  end if;
  if c.etapa = 'RESERVA_DIA' then
    perform receber_dia_reserva(m, c, a, m.texto);
    return;
  end if;
  if c.etapa = 'RESERVA_HORARIO' then
    v_data := (c.vida ->> 'data')::date;
    v_blocos := blocos_da_area(a, v_data, true);
    if data_do_whatsapp(m.texto, hoje_no_condominio()) is not null then
      perform receber_dia_reserva(m, c, a, m.texto);
    elsif v_n between 1 and cardinality(v_blocos) then
      perform pedir_sim_reserva(m, c, a, v_data, v_blocos[v_n], fim_do_bloco(a, v_blocos[v_n]));
    else
      perform resposta_vida(m, 'Responda só com o número do horário, de 1 a ' || cardinality(v_blocos) || ', outro dia ou SAIR.');
    end if;
    return;
  end if;
  -- RESERVA_CONFIRMAR
  if v_cmd in ('SIM', 'S', 'SIM.') then
    perform concluir_reserva_whatsapp(m, c, a);
  elsif data_do_whatsapp(m.texto, hoje_no_condominio()) is not null then
    perform receber_dia_reserva(m, c, a, m.texto);
  else
    perform resposta_vida(m, 'Responda SIM para ' || case when a.reserva = 'SINDICO' then 'pedir a reserva' else 'reservar' end
      || ', outro dia para trocar, ou SAIR.');
  end if;
end $$;

-- O processamento de antes continua igual; as palavras da Vida em condomínio passam antes.
alter function processar_mensagem_whatsapp(mensagens_whatsapp) rename to processar_mensagem_atendimento;

create function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  c conversas_whatsapp;
  v_contatos uuid[];
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
begin
  v_contatos := contatos_do_telefone(m.telefone);
  if cardinality(v_contatos) = 0 then
    perform processar_mensagem_atendimento(m);
    return;
  end if;
  select * into c from conversas_whatsapp where telefone = m.telefone;
  -- Etapa da reserva vencida: volta ao começo antes de tudo.
  if c.id is not null and c.etapa like 'RESERVA\_%' and (c.etapa_ate is null or c.etapa_ate < app_now()) then
    update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, vida = null where id = c.id returning * into c;
  end if;
  if v_cmd !~ '^(RESERVAR|CANCELAR)\M' and (c.id is null or c.etapa not like 'RESERVA\_%' or v_cmd in ('PARAR', 'VOLTAR') or v_cmd ~ '^REVISAR\M') then
    perform processar_mensagem_atendimento(m);
    return;
  end if;
  if c.id is null then
    insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone) returning * into c;
  end if;
  update conversas_whatsapp set atualizada_em = app_now(), texto_pendente = null, pedido_id = null where id = c.id returning * into c;
  update mensagens_whatsapp set contato_id = v_contatos[1] where id = m.id;
  m.contato_id := v_contatos[1];
  if v_cmd ~ '^RESERVAR\M' then
    perform iniciar_reserva_whatsapp(m, c, v_contatos, substr(btrim(m.texto), 9));
  elsif v_cmd ~ '^CANCELAR\M' then
    perform cancelar_reserva_whatsapp(m, c, v_contatos, substr(btrim(m.texto), 9));
  elsif m.tipo <> 'TEXTO' then
    perform resposta_vida(m, 'Na reserva, responda só com texto: o número, o dia ou SIM. Para desistir, SAIR.');
  else
    perform continuar_reserva_whatsapp(m, c, v_contatos);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Telas: a reserva como a tela recebe.

create function reserva_json(r reservas) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'protocolo', r.protocolo,
    'area', jsonb_build_object('id', a.id, 'nome', a.nome, 'reserva', a.reserva),
    'unidade', jsonb_build_object('id', r.unidade_id, 'nome', rotulo_unidade(r.unidade_id)),
    'contato', (select jsonb_build_object('id', ct.id, 'nome', ct.nome) from contatos ct where ct.id = r.contato_id and ct.dados_removidos_em is null),
    'data', to_char(r.data, 'YYYY-MM-DD'), 'horaInicio', to_char(r.hora_inicio, 'HH24:MI'),
    'horaFim', case when r.hora_fim = time '24:00' then '24:00' else to_char(r.hora_fim, 'HH24:MI') end,
    'estado', r.estado, 'origem', r.origem, 'tolerancia', r.tolerancia, 'observacao', r.observacao,
    'criadoEm', r.criado_em, 'registradoPor', nome_pessoa(r.criado_por),
    'decisao', case when r.decidido_em is not null and (r.estado <> 'CONFIRMADA' or a.reserva <> 'AUTOMATICA' or r.decidido_por is not null)
                    then jsonb_build_object('em', r.decidido_em, 'por', nome_pessoa(r.decidido_por), 'motivo', r.motivo,
                                            'peloMorador', r.cancelada_pelo_morador) end,
    'versao', r.versao,
    -- O que pesa no pedido (decisão 3 e 4): outro pedido na mesma data, o que ocupa a área e a conta do limite.
    'outrosPedidos', case when r.estado = 'A_APROVAR' then (
       select count(*) from reservas x where x.area_id = r.area_id and x.data = r.data and x.estado = 'A_APROVAR' and x.id <> r.id
                                       and x.hora_inicio < r.hora_fim and r.hora_inicio < x.hora_fim) end,
    'ocupacao', case when r.estado = 'A_APROVAR' then ocupacao_da_area(a, r.data, r.hora_inicio, r.hora_fim, r.id) end,
    'limite', case when r.estado in ('A_APROVAR', 'CONFIRMADA') and a.limite_quantidade is not null then jsonb_build_object(
       'n', (select count(*) from reservas x where x.area_id = r.area_id and x.unidade_id = r.unidade_id
                and x.estado in ('A_APROVAR', 'CONFIRMADA') and x.data <@ periodo_do_limite(a.limite_periodo, r.data)
                and (x.criado_em, substr(protocolo_curto(x.protocolo), 2)::integer)
                    <= (r.criado_em, substr(protocolo_curto(r.protocolo), 2)::integer)),
       'quantidade', a.limite_quantidade, 'periodo', a.limite_periodo) end))
    from areas_comuns a where a.id = r.area_id
$$;

create function area_json(a areas_comuns) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'modelo', a.modelo, 'criadaPeloSindico', a.modelo is null, 'nome', a.nome, 'ativa', a.ativa, 'reserva', a.reserva,
    'antecedenciaMin', a.antecedencia_min, 'antecedenciaMax', a.antecedencia_max,
    'horaInicio', to_char(a.hora_inicio, 'HH24:MI'), 'horaFim', case when a.hora_fim = time '24:00' then '24:00' else to_char(a.hora_fim, 'HH24:MI') end,
    'modo', a.modo, 'blocoMinutos', a.bloco_minutos, 'capacidade', a.capacidade,
    'limiteQuantidade', a.limite_quantidade, 'limitePeriodo', a.limite_periodo, 'toleranciaDias', a.tolerancia_dias,
    'cancelarSemAvisoDias', a.cancelar_sem_aviso_dias, 'valorCentavos', a.valor_centavos,
    'regras', (select jsonb_build_object('id', d.id, 'titulo', d.titulo) from documentos d where d.id = a.regras_documento_id),
    'podeProprietarioMorador', a.pode_proprietario_morador, 'podeInquilino', a.pode_inquilino,
    'podeProprietarioAusente', a.pode_proprietario_ausente, 'versao', a.versao))
$$;

create function exigir_reserva(p_id uuid) returns reservas
language plpgsql
set search_path = public
as $$
declare v reservas;
begin
  select * into v from reservas where id = p_id;
  if not found then raise exception 'Reserva não encontrada' using errcode = 'TC404'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API: áreas comuns (Configurações).

create function plataforma_areas_comuns(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return jsonb_build_object(
    'areas', coalesce((select jsonb_agg(area_json(a) order by a.modelo is null, a.criado_em, lower(a.nome)) from areas_comuns a), '[]'::jsonb),
    'documentos', case when pode(p_pessoa, p_condominio, 'config.editar') then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo) order by lower(d.titulo))
        from documentos d where d.arquivado_em is null and not d.restrito), '[]'::jsonb) else '[]'::jsonb end,
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar')));
end $$;

-- Confere os campos de uma área (p jsonb, como a tela manda). Devolve a área pronta para gravar.
create function ler_area(p jsonb) returns areas_comuns
language plpgsql
set search_path = public
as $$
declare
  a areas_comuns;
  v_campos text[] := '{}';
  v_hora_fim text := p ->> 'horaFim';
begin
  a.nome := btrim(coalesce(p ->> 'nome', ''));
  if length(a.nome) not between 2 and 60 then v_campos := v_campos || 'nome'::text; end if;
  a.reserva := p ->> 'reserva';
  if a.reserva is null or a.reserva not in ('SINDICO', 'AUTOMATICA', 'SEM_RESERVA') then v_campos := v_campos || 'reserva'::text; end if;
  begin
    a.antecedencia_min := coalesce((p ->> 'antecedenciaMin')::smallint, 0);
    a.antecedencia_max := coalesce((p ->> 'antecedenciaMax')::smallint, 30);
    a.hora_inicio := (p ->> 'horaInicio')::time;
    a.hora_fim := case when v_hora_fim = '24:00' then time '24:00' else v_hora_fim::time end;
    a.bloco_minutos := (p ->> 'blocoMinutos')::smallint;
    a.capacidade := (p ->> 'capacidade')::smallint;
    a.limite_quantidade := (p ->> 'limiteQuantidade')::smallint;
    a.tolerancia_dias := (p ->> 'toleranciaDias')::smallint;
    a.cancelar_sem_aviso_dias := coalesce((p ->> 'cancelarSemAvisoDias')::smallint, 3);
    a.valor_centavos := (p ->> 'valorCentavos')::integer;
    a.regras_documento_id := (p ->> 'regrasDocumentoId')::uuid;
  exception when others then
    perform recusar_campos('Confira os números e horários da área', 'antecedenciaMin', 'antecedenciaMax', 'horaInicio', 'horaFim');
  end;
  if a.antecedencia_min not between 0 and 365 or a.antecedencia_max not between 1 and 730 or a.antecedencia_min > a.antecedencia_max then
    v_campos := v_campos || 'antecedenciaMax'::text;
  end if;
  if a.hora_inicio is null or a.hora_fim is null or a.hora_fim <= a.hora_inicio then v_campos := v_campos || 'horaFim'::text; end if;
  a.modo := coalesce(p ->> 'modo', 'PERIODO');
  if a.modo not in ('PERIODO', 'BLOCOS') then v_campos := v_campos || 'modo'::text; end if;
  if a.modo = 'PERIODO' then a.bloco_minutos := null;
  elsif a.bloco_minutos is null or a.bloco_minutos not in (30, 60, 90, 120, 180, 240)
        or (a.hora_inicio is not null and a.hora_fim is not null and minutos_do_dia(a.hora_fim) - minutos_do_dia(a.hora_inicio) < a.bloco_minutos) then
    v_campos := v_campos || 'blocoMinutos'::text;
  end if;
  if a.capacidade is not null and a.capacidade not between 1 and 2000 then v_campos := v_campos || 'capacidade'::text; end if;
  a.limite_periodo := p ->> 'limitePeriodo';
  if a.limite_quantidade is null then
    a.limite_periodo := null;
    a.tolerancia_dias := null;
  elsif a.limite_quantidade not between 1 and 31 or a.limite_periodo is null or a.limite_periodo not in ('SEMANA', 'MES') then
    v_campos := v_campos || 'limiteQuantidade'::text;
  end if;
  if a.tolerancia_dias is not null and a.tolerancia_dias not between 1 and 60 then v_campos := v_campos || 'toleranciaDias'::text; end if;
  if a.cancelar_sem_aviso_dias not between 0 and 60 then v_campos := v_campos || 'cancelarSemAvisoDias'::text; end if;
  if a.valor_centavos is not null and a.valor_centavos not between 0 and 10000000 then v_campos := v_campos || 'valorCentavos'::text; end if;
  if a.regras_documento_id is not null
     and not exists (select 1 from documentos where id = a.regras_documento_id and arquivado_em is null and not restrito) then
    v_campos := v_campos || 'regrasDocumentoId'::text;
  end if;
  a.pode_proprietario_morador := coalesce((p ->> 'podeProprietarioMorador')::boolean, true);
  a.pode_inquilino := coalesce((p ->> 'podeInquilino')::boolean, true);
  a.pode_proprietario_ausente := coalesce((p ->> 'podeProprietarioAusente')::boolean, false);
  a.ativa := coalesce((p ->> 'ativa')::boolean, false);
  if a.ativa and a.reserva <> 'SEM_RESERVA' and not (a.pode_proprietario_morador or a.pode_inquilino or a.pode_proprietario_ausente) then
    v_campos := v_campos || 'podeProprietarioMorador'::text;
  end if;
  if cardinality(v_campos) > 0 then
    perform recusar_campos('Confira os campos da área', variadic v_campos);
  end if;
  return a;
end $$;

-- Criar (sem id) ou ajustar uma área (AC-07). Desativar pede que não haja reserva marcada.
create function plataforma_salvar_area(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a areas_comuns;
  v areas_comuns;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  a := ler_area(p_dados);
  if exists (select 1 from areas_comuns where lower(btrim(nome)) = lower(a.nome) and id is distinct from p_id) then
    perform recusar_campos('Já existe uma área com este nome', 'nome');
  end if;
  if p_id is null then
    insert into areas_comuns (condominio_id, nome, ativa, reserva, antecedencia_min, antecedencia_max, hora_inicio, hora_fim, modo,
                              bloco_minutos, capacidade, limite_quantidade, limite_periodo, tolerancia_dias, cancelar_sem_aviso_dias,
                              valor_centavos, regras_documento_id, pode_proprietario_morador, pode_inquilino, pode_proprietario_ausente,
                              criado_por)
    values (p_condominio, a.nome, a.ativa, a.reserva, a.antecedencia_min, a.antecedencia_max, a.hora_inicio, a.hora_fim, a.modo,
            a.bloco_minutos, a.capacidade, a.limite_quantidade, a.limite_periodo, a.tolerancia_dias, a.cancelar_sem_aviso_dias,
            a.valor_centavos, a.regras_documento_id, a.pode_proprietario_morador, a.pode_inquilino, a.pode_proprietario_ausente, p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico('area.criada', 'areas_comuns', v_id::text, jsonb_build_object('ativa', a.ativa, 'reserva', a.reserva));
    return jsonb_build_object('id', v_id, 'versao', v_versao);
  end if;
  select * into v from areas_comuns where id = p_id;
  if not found then raise exception 'Área não encontrada' using errcode = 'TC404'; end if;
  if v.versao <> p_versao then perform conflito_versao('areas_comuns', p_id); end if;
  if v.ativa and (not a.ativa or a.reserva = 'SEM_RESERVA') and exists (
       select 1 from reservas where area_id = p_id and estado in ('A_APROVAR', 'CONFIRMADA') and data >= hoje_no_condominio()) then
    perform recusar_motivo('Há reservas marcadas nesta área: cancele antes de desativar ou deixar sem reserva', 'AREA_COM_RESERVAS');
  end if;
  update areas_comuns set nome = a.nome, ativa = a.ativa, reserva = a.reserva, antecedencia_min = a.antecedencia_min,
         antecedencia_max = a.antecedencia_max, hora_inicio = a.hora_inicio, hora_fim = a.hora_fim, modo = a.modo,
         bloco_minutos = a.bloco_minutos, capacidade = a.capacidade, limite_quantidade = a.limite_quantidade,
         limite_periodo = a.limite_periodo, tolerancia_dias = a.tolerancia_dias, cancelar_sem_aviso_dias = a.cancelar_sem_aviso_dias,
         valor_centavos = a.valor_centavos, regras_documento_id = a.regras_documento_id,
         pode_proprietario_morador = a.pode_proprietario_morador, pode_inquilino = a.pode_inquilino,
         pode_proprietario_ausente = a.pode_proprietario_ausente
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('areas_comuns', p_id); end if;
  perform registrar_historico(case when a.ativa and not v.ativa then 'area.ativada' when v.ativa and not a.ativa then 'area.desativada'
                                   else 'area.alterada' end, 'areas_comuns', p_id::text,
    jsonb_build_object('ativa', a.ativa, 'reserva', a.reserva));
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API: reservas (Vida em condomínio › Reservas).

-- A lista (decisão 1): a aprovar primeiro, as próximas ou todas, por área.
create function plataforma_reservas(p_pessoa uuid, p_condominio uuid, p_filtro text, p_area uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_hoje date := hoje_no_condominio();
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.ver');
  if coalesce(p_filtro, 'A_APROVAR') not in ('A_APROVAR', 'PROXIMAS', 'TODAS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  return jsonb_build_object(
    'reservas', coalesce((
      select jsonb_agg(reserva_json(r) order by case when coalesce(p_filtro, 'A_APROVAR') = 'TODAS' then -(r.data - date '2000-01-01') else r.data - date '2000-01-01' end,
                                                r.hora_inicio, r.criado_em)
        from (select * from reservas x
               where (p_area is null or x.area_id = p_area)
                 and case coalesce(p_filtro, 'A_APROVAR')
                       when 'A_APROVAR' then x.estado = 'A_APROVAR'
                       when 'PROXIMAS' then x.estado in ('A_APROVAR', 'CONFIRMADA') and x.data >= v_hoje
                       else true end
               order by x.data desc limit 300) r), '[]'::jsonb),
    'aAprovar', (select count(*) from reservas where estado = 'A_APROVAR'),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'ativa', a.ativa, 'reserva', a.reserva, 'modo', a.modo)
                                        order by lower(a.nome))
                         from areas_comuns a where a.ativa and a.reserva <> 'SEM_RESERVA'), '[]'::jsonb),
    'hoje', to_char(v_hoje, 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'reservas.editar')));
end $$;

-- A semana de uma área: reservas e o que a Agenda bloqueia (decisão 1 e AG-09).
create function plataforma_semana_area(p_pessoa uuid, p_condominio uuid, p_area uuid, p_de date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a areas_comuns;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.ver');
  select * into a from areas_comuns where id = p_area;
  if not found then raise exception 'Área não encontrada' using errcode = 'TC404'; end if;
  if p_de is null then perform recusar_campos('Escolha a semana', 'de'); end if;
  return jsonb_build_object(
    'area', area_json(a),
    'dias', (select jsonb_agg(jsonb_build_object(
               'data', to_char(d, 'YYYY-MM-DD'),
               'reservas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'protocolo', r.protocolo, 'estado', r.estado,
                                                                         'unidade', rotulo_unidade(r.unidade_id),
                                                                         'horaInicio', to_char(r.hora_inicio, 'HH24:MI'))
                                                      order by r.hora_inicio, r.criado_em)
                                       from reservas r where r.area_id = a.id and r.data = d::date and r.estado in ('A_APROVAR', 'CONFIRMADA')), '[]'::jsonb),
               'bloqueios', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo,
                                                                          'horaInicio', to_char(c.hora_inicio, 'HH24:MI'),
                                                                          'horaFim', to_char(c.hora_fim, 'HH24:MI'))
                                                       order by c.hora_inicio nulls first)
                                        from compromissos c
                                       where c.data = d::date and c.onde = 'AREA_COMUM' and lower(btrim(c.local)) = lower(btrim(a.nome))
                                         and c.estado not in ('REALIZADO', 'CANCELADO')), '[]'::jsonb))
               order by d)
               from generate_series(p_de, p_de + 6, interval '1 day') d),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- Uma reserva, com o histórico e as mensagens ao morador.
create function plataforma_reserva(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r reservas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.ver');
  r := exigir_reserva(p_id);
  return jsonb_build_object(
    'reserva', reserva_json(r),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', nome_pessoa(h.autor_id), 'dados', h.dados)
                       order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'reservas' and h.entidade_id = r.id::text), '[]'::jsonb),
    'mensagens', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'estado', e.estado, 'em', e.criado_em, 'motivo', e.motivo) order by e.criado_em)
        from envios_whatsapp e where e.reserva_id = r.id), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'reservas.editar') and r.estado in ('A_APROVAR', 'CONFIRMADA')));
end $$;

-- O que a tela precisa para registrar uma reserva pedida por telefone.
create function plataforma_reserva_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  return jsonb_build_object(
    'areas', coalesce((select jsonb_agg(area_json(a) order by lower(a.nome)) from areas_comuns a where a.ativa and a.reserva <> 'SEM_RESERVA'), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', nome_da_unidade(b.nome, u.andar, u.identificacao),
               'contatos', coalesce((select jsonb_agg(jsonb_build_object('id', ct.id, 'nome', ct.nome) order by cu.principal desc, ct.nome)
                                       from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                                      where cu.unidade_id = u.id and cu.estado = 'CONFIRMADO' and ct.dados_removidos_em is null), '[]'::jsonb))
             order by b.ordem nulls first, lower(b.nome) nulls first, chave_andar(u.andar), chave_unidade(u.identificacao))
        from unidades u left join blocos b on b.id = u.bloco_id where u.ativa), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- Confere um dia para a tela: o que cabe, os blocos livres e a conta do limite.
create function plataforma_conferir_reserva(p_pessoa uuid, p_condominio uuid, p_area uuid, p_unidade uuid, p_data date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a areas_comuns;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  select * into a from areas_comuns where id = p_area and ativa and reserva <> 'SEM_RESERVA';
  if not found then perform recusar_campos('Escolha a área', 'areaId'); end if;
  if p_data is null then perform recusar_campos('Escolha o dia', 'data'); end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'blocos', case when a.modo = 'BLOCOS' then (select jsonb_agg(to_char(t, 'HH24:MI') order by t) from unnest(blocos_da_area(a, p_data, true)) t) end,
    'conferencia', case when a.modo = 'PERIODO' then conferir_reserva(a, p_unidade, p_data, null, null)
                        else conferir_reserva(a, p_unidade, p_data, (blocos_da_area(a, p_data, true))[1], null) end,
    'noPeriodo', case when p_unidade is not null and a.limite_quantidade is not null then reservas_no_periodo(a, p_unidade, p_data, null) end,
    'proxima', case when p_unidade is not null then to_char(proxima_data_reserva(a, p_unidade), 'YYYY-MM-DD') end));
end $$;

-- Registrar a reserva pedida por telefone (decisão 1): segue a regra da área.
create function plataforma_registrar_reserva(p_pessoa uuid, p_condominio uuid, p_area uuid, p_unidade uuid, p_contato uuid,
                                             p_data date, p_inicio time, p_observacao text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a areas_comuns;
  r reservas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  select * into a from areas_comuns where id = p_area and ativa and reserva <> 'SEM_RESERVA';
  if not found then perform recusar_campos('Escolha a área', 'areaId'); end if;
  if p_unidade is null or not exists (select 1 from unidades where id = p_unidade and ativa) then
    perform recusar_campos('Escolha a unidade', 'unidadeId');
  end if;
  if p_contato is not null and not exists (select 1 from contatos_unidade where unidade_id = p_unidade and contato_id = p_contato
                                                                              and estado = 'CONFIRMADO') then
    perform recusar_campos('Quem pediu precisa ter vínculo confirmado com a unidade', 'contatoId');
  end if;
  if p_data is null then perform recusar_campos('Escolha o dia', 'data'); end if;
  if length(btrim(coalesce(p_observacao, ''))) > 300 then perform recusar_campos('Observação até 300 caracteres', 'observacao'); end if;
  r := gravar_reserva(a, p_unidade, p_contato, p_data, p_inicio, 'PAINEL', p_observacao);
  return jsonb_build_object('id', r.id, 'protocolo', r.protocolo, 'estado', r.estado);
end $$;

-- Aprovar (decisão 4): a data fica com este pedido e os outros da mesma data são recusados,
-- com motivo. A decisão vai ao morador com o nome de quem aprovou.
create function plataforma_aprovar_reserva(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_recado text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r reservas;
  x reservas;
  a areas_comuns;
  v_recado text := nullif(btrim(coalesce(p_recado, '')), '');
  v_versao integer;
  v_recusadas integer := 0;
  v_ocupa jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  r := exigir_reserva(p_id);
  perform pg_advisory_xact_lock(hashtextextended('reservas:' || r.area_id::text, 0));
  r := exigir_reserva(p_id);
  if r.estado <> 'A_APROVAR' then perform recusar_motivo('Esta reserva já foi decidida', 'RESERVA_DECIDIDA'); end if;
  if r.versao <> p_versao then perform conflito_versao('reservas', p_id); end if;
  if length(v_recado) > 300 then perform recusar_campos('Recado até 300 caracteres', 'recado'); end if;
  select * into a from areas_comuns where id = r.area_id;
  v_ocupa := ocupacao_da_area(a, r.data, r.hora_inicio, r.hora_fim, r.id);
  if v_ocupa is not null then
    raise exception 'A área já está ocupada nesse horário' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'RESERVA_OCUPADA', 'ocupacao', v_ocupa)::text;
  end if;
  perform definir_transicao('APROVADA');
  update reservas set estado = 'CONFIRMADA', decidido_em = app_now(), decidido_por = p_pessoa
   where id = p_id and versao = p_versao returning * into r;
  if r.id is null then perform conflito_versao('reservas', p_id); end if;
  perform avisar_morador_reserva(r, 'aprovada. ' || upper(left(descrever_reserva(r), 1)) || substr(descrever_reserva(r), 2) || '.'
    || coalesce(' ' || v_recado, ''), p_pessoa);
  for x in select * from reservas where area_id = r.area_id and data = r.data and estado = 'A_APROVAR' and id <> r.id
                                    and hora_inicio < r.hora_fim and r.hora_inicio < hora_fim loop
    perform definir_transicao('RECUSADA', 'A data ficou com outro pedido de reserva');
    update reservas set estado = 'RECUSADA', motivo = 'A data ficou com outro pedido de reserva', decidido_em = app_now(),
                        decidido_por = p_pessoa
     where id = x.id returning * into x;
    perform avisar_morador_reserva(x, 'recusada. ' || upper(left(descrever_reserva(x), 1)) || substr(descrever_reserva(x), 2)
      || '. Motivo: a data ficou com outro pedido de reserva.', p_pessoa);
    v_recusadas := v_recusadas + 1;
  end loop;
  return jsonb_build_object('versao', r.versao, 'recusadas', v_recusadas);
end $$;

-- Recusar e cancelar pedem motivo, que vai ao morador (decisão 4).
create function decidir_reserva(p_pessoa uuid, p_id uuid, p_versao integer, p_motivo text, p_estado text) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r reservas;
  v_motivo text;
begin
  r := exigir_reserva(p_id);
  if (p_estado = 'RECUSADA' and r.estado <> 'A_APROVAR') or (p_estado = 'CANCELADA' and r.estado not in ('A_APROVAR', 'CONFIRMADA')) then
    perform recusar_motivo('Esta reserva já foi decidida', 'RESERVA_DECIDIDA');
  end if;
  if r.versao <> p_versao then perform conflito_versao('reservas', p_id); end if;
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao(p_estado, v_motivo);
  update reservas set estado = p_estado, motivo = v_motivo, decidido_em = app_now(), decidido_por = p_pessoa
   where id = p_id and versao = p_versao returning * into r;
  if r.id is null then perform conflito_versao('reservas', p_id); end if;
  perform avisar_morador_reserva(r, case when p_estado = 'RECUSADA' then 'recusada. ' else 'cancelada pelo condomínio. ' end
    || upper(left(descrever_reserva(r), 1)) || substr(descrever_reserva(r), 2) || '. Motivo: ' || v_motivo, p_pessoa);
  return jsonb_build_object('versao', r.versao);
end $$;

create function plataforma_recusar_reserva(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  return decidir_reserva(p_pessoa, p_id, p_versao, p_motivo, 'RECUSADA');
end $$;

create function plataforma_cancelar_reserva(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'reservas.editar');
  return decidir_reserva(p_pessoa, p_id, p_versao, p_motivo, 'CANCELADA');
end $$;

-- ---------------------------------------------------------------------------------------
-- Agenda (AG-09): reservas confirmadas na agenda e nos conflitos; as áreas viram sugestão de lugar.

alter function conflitos_compromisso(uuid[], date, time, time, text, uuid, text, uuid[]) rename to conflitos_entre_compromissos;

-- Conflitos de um compromisso (AG-04), agora com as reservas confirmadas da área de mesmo nome
-- (AG-09): avisam como o mesmo lugar, sem impedir.
create or replace function conflitos_compromisso(p_ignorar uuid[], p_data date, p_inicio time, p_fim time, p_onde text, p_unidade uuid,
                                                 p_local text, p_participantes uuid[]) returns jsonb
language sql stable
set search_path = public
as $$
  select conflitos_entre_compromissos(p_ignorar, p_data, p_inicio, p_fim, p_onde, p_unidade, p_local, p_participantes)
      || coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', r.id, 'titulo', 'Reserva ' || r.protocolo || ' · ' || rotulo_unidade(r.unidade_id), 'data', to_char(r.data, 'YYYY-MM-DD'),
                  'horaInicio', to_char(r.hora_inicio, 'HH24:MI'), 'horaFim', to_char(r.hora_fim, 'HH24:MI'), 'motivo', 'LUGAR', 'reserva', true)
                order by r.hora_inicio)
           from reservas r join areas_comuns a on a.id = r.area_id
          where p_onde = 'AREA_COMUM' and r.data = p_data and r.estado = 'CONFIRMADA'
            and lower(btrim(a.nome)) = lower(btrim(p_local))
            and compromissos_se_sobrepoem(r.hora_inicio, r.hora_fim, p_inicio, p_fim)), '[]'::jsonb)
$$;

create or replace function plataforma_agenda_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.ver');
  return jsonb_build_object(
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'eu', v.pessoa_id = p_pessoa) order by p.nome)
        from vinculos v join pessoas p on p.id = v.pessoa_id
       where v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', nome_da_unidade(b.nome, u.andar, u.identificacao))
                       order by b.ordem nulls first, lower(b.nome) nulls first, chave_andar(u.andar), chave_unidade(u.identificacao))
        from unidades u left join blocos b on b.id = u.bloco_id where u.ativa), '[]'::jsonb),
    'pedidos', case when pode(p_pessoa, p_condominio, 'pedidos.ver') then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'protocolo', x.protocolo, 'assunto', x.assunto, 'unidadeId', x.unidade_id,
                                          'responsavelId', x.responsavel_id)
                       order by x.criado_em desc)
        from (select * from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and pedido_visivel(p_pessoa, p)
               order by p.criado_em desc limit 300) x), '[]'::jsonb) else '[]'::jsonb end,
    'areas', coalesce((select jsonb_agg(a.nome order by lower(a.nome)) from areas_comuns a where a.ativa), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

create or replace function plataforma_agenda(p_pessoa uuid, p_condominio uuid, p_de date, p_ate date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.ver');
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then
    perform recusar_campos('Período de até 93 dias', 'de', 'ate');
  end if;
  return jsonb_build_object(
    'compromissos', coalesce((
      select jsonb_agg(compromisso_json(c, p_pessoa) order by c.data, c.hora_inicio nulls first, c.titulo)
        from compromissos c where c.data between p_de and p_ate), '[]'::jsonb),
    'datas', coalesce((
      select jsonb_agg(x.d order by x.data, x.titulo)
        from (
          select f.data, f.descricao as titulo,
                 jsonb_build_object('data', to_char(f.data, 'YYYY-MM-DD'), 'titulo', f.descricao, 'fonte', 'FERIADO') as d
            from feriados f where f.data between p_de and p_ate and pode(p_pessoa, p_condominio, 'config.ver')
          union all
          select p.proxima_data, p.atividade,
                 jsonb_build_object('data', to_char(p.proxima_data, 'YYYY-MM-DD'), 'titulo', p.atividade, 'fonte', 'PREVENTIVA',
                                    'id', p.id)
            from preventivas p where p.ativa and p.proxima_data between p_de and p_ate and pode(p_pessoa, p_condominio, 'manutencao.ver')
          union all
          select r.data, a.nome,
                 jsonb_build_object('data', to_char(r.data, 'YYYY-MM-DD'), 'titulo', a.nome || ' · ' || rotulo_unidade(r.unidade_id),
                                    'fonte', 'RESERVA', 'id', r.id, 'horaInicio', to_char(r.hora_inicio, 'HH24:MI'),
                                    'horaFim', to_char(r.hora_fim, 'HH24:MI'),
                                    'quem', (select ct.nome from contatos ct where ct.id = r.contato_id and ct.dados_removidos_em is null))
            from reservas r join areas_comuns a on a.id = r.area_id
           where r.estado = 'CONFIRMADA' and r.data between p_de and p_ate and pode(p_pessoa, p_condominio, 'reservas.ver')
        ) x), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')));
end $$;

-- ---------------------------------------------------------------------------------------
-- Etiqueta da área (decisão 6): o botão abre o WhatsApp do condomínio com RESERVAR e a área.

create or replace function publico_etiqueta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l codigos_sem_conta;
  e etiquetas;
  a areas_comuns;
  v_nome text;
  v_livres date[];
begin
  l := entrar_por_codigo(upper(p_codigo), 'ETIQUETA');
  select nome into v_nome from condominios where id = l.condominio_id;
  select * into e from etiquetas where id = l.alvo_id;
  if l.revogado_em is not null or not e.ativa or e.codigo is distinct from upper(p_codigo) then
    return jsonb_build_object('condominio', v_nome, 'foraDeUso', true);
  end if;
  insert into etiqueta_aberturas (condominio_id, etiqueta_id, dia) values (l.condominio_id, e.id, hoje_no_condominio())
  on conflict (etiqueta_id, dia) do update set vezes = etiqueta_aberturas.vezes + 1;
  select * into a from areas_comuns x where x.ativa and x.reserva <> 'SEM_RESERVA' and lower(btrim(x.nome)) = lower(btrim(e.local));
  if a.id is not null then v_livres := datas_livres(a, hoje_no_condominio(), 2); end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'condominio', v_nome, 'local', e.local, 'rotulo', etiqueta_rotulo(e.numero),
    'recado', case when recado_vale(e) then e.recado end,
    'recadoEm', case when recado_vale(e) then e.recado_em end,
    'whatsapp', ltrim(numero_whatsapp_condominio(), '+'),
    'reserva', case when a.id is not null and numero_whatsapp_condominio() is not null then jsonb_strip_nulls(jsonb_build_object(
                 'area', a.nome, 'capacidade', a.capacidade,
                 'horario', horas_por_extenso(a.hora_inicio, a.hora_fim),
                 'livres', (select jsonb_agg(to_char(d, 'YYYY-MM-DD') order by d) from unnest(v_livres) d),
                 'texto', 'RESERVAR ' || a.nome)) end));
end $$;

-- ---------------------------------------------------------------------------------------
-- Início (decisão 10) e sino.

-- O cartão Vida em condomínio: só quando há reserva a aprovar.
create function resumo_vida() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'reservasAAprovar', (select count(*) from reservas where estado = 'A_APROVAR'),
    'proximasAAprovar', coalesce((
      select jsonb_agg(jsonb_build_object('data', to_char(x.data, 'YYYY-MM-DD'), 'area', x.nome, 'pedidos', x.n) order by x.data, x.nome)
        from (select r.data, a.nome, count(*) as n from reservas r join areas_comuns a on a.id = r.area_id
               where r.estado = 'A_APROVAR' group by r.data, a.nome order by r.data limit 3) x), '[]'::jsonb))
$$;

create or replace function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select jsonb_strip_nulls(jsonb_build_object(
    'condominio', jsonb_build_object('id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'cenario', c.cenario),
    'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome),
    'funcoes', coalesce((select jsonb_agg(distinct v.funcao order by v.funcao) from vinculos v join funcoes f on f.codigo = v.funcao
                          where v.pessoa_id = p_pessoa and v.condominio_id = c.id and v.revogado_em is null and f.sistema = 'PLATAFORMA'), '[]'::jsonb),
    'acoes', to_jsonb(acoes_da_pessoa(p_pessoa, c.id)),
    'pendencias', to_jsonb(pendencias_configuracao(c.id)),
    'moradores', case when pode(p_pessoa, c.id, 'moradores.ver') then resumo_moradores(c.id) end,
    'pedidos', case when pode(p_pessoa, c.id, 'pedidos.ver') then resumo_pedidos(p_pessoa) end,
    'mesFechado', case when pode(p_pessoa, c.id, 'pedidos.ver') then mes_fechado() end,
    'manutencao', case when pode(p_pessoa, c.id, 'manutencao.ver') then resumo_manutencao() end,
    'comunicados', case when pode(p_pessoa, c.id, 'comunicados.ver') or pode(p_pessoa, c.id, 'documentos.ver')
                        then resumo_comunicados(p_pessoa) end,
    'memoria', case when pode(p_pessoa, c.id, 'documentos.ver') then jsonb_build_object('prontuario', resumo_prontuario()) end,
    'acessosExcepcionais', case when pode(p_pessoa, c.id, 'acesso_excepcional.aprovar') then (
      select jsonb_build_object(
        'pedidos', coalesce(jsonb_agg(resumo_acesso_excepcional(a) order by a.criado_em) filter (where a.situacao = 'PEDIDO'), '[]'::jsonb),
        'valendo', count(*) filter (where a.situacao = 'APROVADO' and a.valido_ate > app_now()))
        from acessos_excepcionais a
       where a.condominio_id = c.id and (a.situacao = 'PEDIDO' or (a.situacao = 'APROVADO' and a.valido_ate > app_now()))) end,
    'vida', case when pode(p_pessoa, c.id, 'reservas.ver') then resumo_vida() end,
    'whatsapp', case when pode(p_pessoa, c.id, 'pedidos.responder') or pode(p_pessoa, c.id, 'pedidos.atualizar') then resumo_whatsapp() end,
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_email a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_prestador a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_memoria a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_triade a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_whatsapp a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_vida a where a.pessoa_id = p_pessoa and a.visto_em is null)))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

create or replace function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(x.item order by x.visto, x.criado desc)
        from (
          select a.visto_em is not null as visto, a.criado_em as criado, jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'pedidoId', p.id, 'protocolo', p.protocolo,
                   'assunto', case when pedido_visivel(p_pessoa, p) then p.assunto end,
                   'responsavel', nome_do_vinculo(p.responsavel_id),
                   'referencia', a.referencia, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em) as item
            from avisos a join pedidos p on p.id = a.pedido_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'MANUTENCAO_RETORNO_VENCIDO', 'manutencaoId', m.id, 'titulo', m.titulo,
                   'responsavel', nome_do_vinculo(m.responsavel_id),
                   'referencia', a.referencia, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_manutencao a join manutencoes m on m.id = a.manutencao_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'DOCUMENTO_VENCENDO', 'documentoId', d.id, 'titulo', d.titulo,
                   'referencia', to_char(a.referencia, 'YYYY-MM-DD'), 'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_documento a join documentos d on d.id = a.documento_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'DOCUMENTO_PEDIDO', 'documentoId', d.id, 'titulo', d.titulo,
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_pedido_documento a join pedidos_documento p on p.id = a.pedido_id join documentos d on d.id = p.documento_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', case a.tipo when 'SPAM' then 'EMAIL_SPAM' else 'EMAIL_DEVOLVIDO' end,
                   'contatoId', e.contato_id, 'nome', (select nome from contatos where id = e.contato_id),
                   'unidades', unidades_do_contato(e.contato_id), 'comunicadoId', e.comunicado_id, 'documentoId', e.documento_id,
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_email a join envios_email e on e.id = a.envio_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'PRESTADOR_' || r.tipo, 'manutencaoId', m.id, 'titulo', m.titulo,
                   'nome', (select l.para from links_prestador l where l.id = r.link_id),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_prestador a join registros_prestador r on r.id = a.registro_id join manutencoes m on m.id = r.manutencao_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'itemId', a.item_id, 'titulo', (select i.nome from itens_prontuario i where i.id = a.item_id),
                   'exportacaoId', a.exportacao_id, 'referencia', to_char(a.referencia, 'YYYY-MM-DD'),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_memoria a
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'texto', a.texto, 'chamadoId', a.chamado_id,
                   'numero', (select ch.numero from chamados ch where ch.id = a.chamado_id),
                   'titulo', (select ch.titulo from chamados ch where ch.id = a.chamado_id),
                   'acessoId', a.acesso_id, 'nome', (select nome_pessoa(x.pedido_por) from acessos_excepcionais x where x.id = a.acesso_id),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_triade a
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', 'WHATSAPP_' || a.tipo, 'pedidoId', p.id, 'protocolo', p.protocolo,
                   'assunto', case when pedido_visivel(p_pessoa, p) then p.assunto end,
                   'envioId', a.envio_id, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_whatsapp a left join pedidos p on p.id = a.pedido_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'reservaId', r.id, 'protocolo', r.protocolo,
                   'titulo', (select x.nome from areas_comuns x where x.id = r.area_id) || ' · ' || dia_por_extenso(r.data)
                             || ' · ' || rotulo_unidade(r.unidade_id),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_vida a join reservas r on r.id = a.reserva_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_prestador where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_memoria where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_triade where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_whatsapp where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_vida where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer; v_r integer; v_x integer; v_t integer; v_w integer; v_v integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  update avisos set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  update avisos_manutencao set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_m = row_count;
  update avisos_documento set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_d = row_count;
  update avisos_email set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_e = row_count;
  update avisos_pedido_documento set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_p = row_count;
  update avisos_prestador set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  update avisos_memoria set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_x = row_count;
  update avisos_triade set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_t = row_count;
  update avisos_whatsapp set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_w = row_count;
  update avisos_vida set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_v = row_count;
  return v_n + v_m + v_d + v_e + v_p + v_r + v_x + v_t + v_w + v_v;
end $$;

call fechar_acesso();

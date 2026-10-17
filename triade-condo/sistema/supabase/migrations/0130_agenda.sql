-- 0130 · Agenda do condomínio (peça R7; AG-01, AG-02, AG-03, AG-04, AG-05, AG-07, AG-08,
-- AG-09, MP-04). Telas e decisões aprovadas pela Carolina em 17/10/2026 (docs/telas/agenda.html).
--
-- Regras desta parte:
-- 1. Compromissos: reunião, visita técnica, atividade programada e lembrete administrativo
--    (AG-01), com data, horário ou dia todo, onde (unidade, área comum ou outro lugar), quem
--    participa (pessoas autorizadas e, por escrito, quem é de fora), pedido ligado opcional e
--    observação.
-- 2. Situações (AG-02): planejado, a confirmar, confirmado, realizado e cancelado. Realizado e
--    cancelado não voltam nem mudam; para refazer, marca-se outro. Cancelar e reagendar pedem
--    motivo, e o reagendamento guarda a data anterior no histórico.
-- 3. Repetição simples (AG-05): toda semana, a cada 2 semanas, todo mês ou a cada N meses, até
--    uma data ou por um número de vezes, no máximo 2 anos. Cada data é um compromisso; mudar uma
--    mexe só nela, e "esta e as próximas" separa a série. Datas que já passaram nunca mudam.
-- 4. Conflito (AG-04): horário que se sobrepõe no mesmo lugar ou com a mesma pessoa autorizada.
--    Avisa e não impede: quem salva vê o conflito e confirma. Quem é de fora não entra na conta.
-- 5. Separada do atendimento (AG-08, MP-04): marcar, mudar ou cancelar um compromisso não mexe no
--    próximo retorno nem na previsão do pedido, e o pedido não mexe na agenda. O pedido mostra a
--    agenda ligada e avisa quando a visita cai depois da previsão de solução.
-- 6. Datas de outras telas (AG-09): os feriados das Configurações, para quem vê as configurações.
--    Reservas, votações e vencimentos entram quando essas partes existirem.
-- 7. Tudo no fuso do condomínio: a data e as horas são as de lá, guardadas como foram escritas
--    (CF-10). Dia todo é data sem hora.
-- 8. Permissões (CF-03): Ver a agenda e Cuidar da agenda, dadas pelo síndico. O morador não vê a
--    agenda geral (AG-07); os lembretes pelo WhatsApp chegam com o passo 5 (AG-06).

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_AGENDA', 'Ver a agenda', 'Ver os compromissos da agenda do condomínio.', 9),
  ('AGENDA', 'Cuidar da agenda', 'Marcar, mudar, confirmar, reagendar e cancelar compromissos da agenda.', 10);
insert into permissao_acoes (permissao, acao) values
  ('VER_AGENDA', 'agenda.ver'),
  ('AGENDA', 'agenda.ver'),
  ('AGENDA', 'agenda.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'agenda.ver'),
  ('SINDICO', 'agenda.editar');

-- ---------------------------------------------------------------------------------------
-- Séries de repetição e compromissos.

create table series_compromisso (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  frequencia    text not null check (frequencia in ('SEMANAL', 'QUINZENAL', 'MENSAL')),
  -- Para MENSAL, de quantos em quantos meses (1 a 12); nas outras, sempre 1.
  intervalo     smallint not null default 1 check (intervalo between 1 and 12),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid not null references pessoas (id),
  unique (id, condominio_id),
  check (frequencia = 'MENSAL' or intervalo = 1)
);
call proteger_tabela_condominio('series_compromisso');
create trigger series_compromisso_sem_exclusao before delete on series_compromisso
  for each row execute function somente_insercao();

create table compromissos (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  serie_id            uuid,
  tipo                text not null check (tipo in ('REUNIAO', 'VISITA', 'ATIVIDADE', 'LEMBRETE')),
  titulo              text not null check (length(btrim(titulo)) between 3 and 120),
  data                date not null check (data between date '2000-01-01' and date '2100-12-31'),
  -- Sem hora de início: dia todo. Sem hora de fim: um momento só (um lembrete às 10h).
  hora_inicio         time,
  hora_fim            time,
  onde                text not null default 'NENHUM' check (onde in ('NENHUM', 'UNIDADE', 'AREA_COMUM', 'OUTRO')),
  unidade_id          uuid,
  local               text check (length(btrim(local)) between 2 and 120),
  -- Pessoas autorizadas (vínculos ativos de síndico ou autorizado) que participam.
  participantes       uuid[] not null default '{}',
  -- Quem é de fora (prestador, conselheiro sem acesso), por escrito.
  de_fora             text check (length(btrim(de_fora)) between 2 and 200),
  pedido_id           uuid,
  observacao          text check (length(btrim(observacao)) between 1 and 1000),
  estado              text not null check (estado in ('PLANEJADO', 'A_CONFIRMAR', 'CONFIRMADO', 'REALIZADO', 'CANCELADO')),
  realizado_em        timestamptz,
  cancelado_em        timestamptz,
  cancelado_por       uuid references pessoas (id),
  motivo_cancelamento text check (length(btrim(motivo_cancelamento)) between 3 and 500),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid not null references pessoas (id),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  foreign key (serie_id, condominio_id) references series_compromisso (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  unique (id, condominio_id),
  check (hora_fim is null or (hora_inicio is not null and hora_fim > hora_inicio)),
  check ((onde = 'UNIDADE') = (unidade_id is not null)),
  check ((onde in ('AREA_COMUM', 'OUTRO')) = (local is not null)),
  check (cardinality(participantes) <= 30),
  check ((estado = 'REALIZADO') = (realizado_em is not null)),
  check ((estado = 'CANCELADO') = (cancelado_em is not null)),
  check ((cancelado_em is null) = (cancelado_por is null) and (cancelado_em is null) = (motivo_cancelamento is null))
);
create index compromissos_data on compromissos (condominio_id, data);
create index compromissos_serie on compromissos (serie_id, data) where serie_id is not null;
create index compromissos_pedido on compromissos (pedido_id) where pedido_id is not null;
call proteger_tabela_condominio('compromissos');
call ligar_guardiao('compromissos');
insert into estados_iniciais (tabela, estado) values
  ('compromissos', 'PLANEJADO'), ('compromissos', 'A_CONFIRMAR'), ('compromissos', 'CONFIRMADO');
insert into transicoes_permitidas (tabela, de, para) values
  ('compromissos', 'PLANEJADO', 'A_CONFIRMAR'),
  ('compromissos', 'PLANEJADO', 'CONFIRMADO'),
  ('compromissos', 'A_CONFIRMAR', 'PLANEJADO'),
  ('compromissos', 'A_CONFIRMAR', 'CONFIRMADO'),
  ('compromissos', 'CONFIRMADO', 'PLANEJADO'),
  ('compromissos', 'CONFIRMADO', 'A_CONFIRMAR'),
  ('compromissos', 'PLANEJADO', 'REALIZADO'),
  ('compromissos', 'A_CONFIRMAR', 'REALIZADO'),
  ('compromissos', 'CONFIRMADO', 'REALIZADO'),
  ('compromissos', 'PLANEJADO', 'CANCELADO'),
  ('compromissos', 'A_CONFIRMAR', 'CANCELADO'),
  ('compromissos', 'CONFIRMADO', 'CANCELADO');
create trigger compromissos_sem_exclusao before delete on compromissos for each row execute function somente_insercao();

-- Realizado e cancelado não mudam mais (AG-02). Os participantes são pessoas do próprio
-- condomínio, com acesso, quando entram no compromisso.
create function compromissos_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.estado in ('REALIZADO', 'CANCELADO') then
    raise exception 'Compromisso realizado ou cancelado não muda' using errcode = 'TC422';
  end if;
  if tg_op = 'INSERT' or new.participantes is distinct from old.participantes then
    if exists (select 1 from unnest(new.participantes) p
                where not exists (select 1 from vinculos v where v.id = p and v.condominio_id = new.condominio_id
                                                         and v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null))
       or cardinality(new.participantes) <> (select count(distinct p) from unnest(new.participantes) p) then
      raise exception 'Participante precisa ser pessoa com acesso ao condomínio' using errcode = 'TC422';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.atualizado_em := app_now(); end if;
  return new;
end $$;
create trigger compromissos_regras before insert or update on compromissos
  for each row execute function compromissos_regras();

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- Fim efetivo para conferir sobreposição: sem hora de fim, o compromisso é um momento.
create function compromissos_se_sobrepoem(p_ini1 time, p_fim1 time, p_ini2 time, p_fim2 time) returns boolean
language sql immutable
set search_path = public
as $$
  select case
    when p_ini1 is null or p_ini2 is null then true
    else p_ini1 < coalesce(p_fim2, p_ini2) and p_ini2 < coalesce(p_fim1, p_ini1)
         or (p_fim1 is null and p_fim2 is null and p_ini1 = p_ini2)
  end
$$;

-- Conflitos de um compromisso (AG-04): mesmo dia, horário que se sobrepõe, e o mesmo lugar ou
-- uma mesma pessoa autorizada. Cancelados e realizados não contam. Avisa; não impede.
create function conflitos_compromisso(p_ignorar uuid[], p_data date, p_inicio time, p_fim time, p_onde text, p_unidade uuid,
                                      p_local text, p_participantes uuid[]) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', c.id, 'titulo', c.titulo, 'data', to_char(c.data, 'YYYY-MM-DD'),
           'horaInicio', to_char(c.hora_inicio, 'HH24:MI'), 'horaFim', to_char(c.hora_fim, 'HH24:MI'),
           'motivo', case when mesmo_lugar then 'LUGAR' else 'PESSOA' end,
           'pessoas', case when not mesmo_lugar then (
              select jsonb_agg(nome_do_vinculo(x) order by nome_do_vinculo(x))
                from unnest(c.participantes) x where x = any (p_participantes)) end))
         order by c.data, c.hora_inicio nulls first), '[]'::jsonb)
    from (select c.*, (p_onde = 'UNIDADE' and c.unidade_id = p_unidade)
                   or (p_onde in ('AREA_COMUM', 'OUTRO') and c.onde in ('AREA_COMUM', 'OUTRO')
                       and lower(btrim(c.local)) = lower(btrim(p_local))) as mesmo_lugar
            from compromissos c
           where c.data = p_data and c.estado not in ('REALIZADO', 'CANCELADO')
             and not (c.id = any (coalesce(p_ignorar, '{}')))
             and compromissos_se_sobrepoem(c.hora_inicio, c.hora_fim, p_inicio, p_fim)) c
   where c.mesmo_lugar or c.participantes && coalesce(p_participantes, '{}')
$$;

-- Recusa por conflito, com a lista para a tela mostrar e pedir a confirmação.
create function recusar_conflito(p_conflitos jsonb) returns void
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Conflita com outro compromisso' using errcode = 'TC422',
    detail = jsonb_build_object('motivo', 'CONFLITO_HORARIO', 'conflitos', p_conflitos)::text;
end $$;

-- Confere e limpa os campos de um compromisso. Devolve os campos prontos para gravar.
create function ler_compromisso(p_pessoa uuid, p_tipo text, p_titulo text, p_data date, p_inicio time, p_fim time,
                                p_onde text, p_unidade uuid, p_local text, p_participantes uuid[], p_de_fora text,
                                p_pedido uuid, p_observacao text) returns compromissos
language plpgsql
set search_path = public
as $$
declare
  c compromissos;
  v_pedido pedidos;
begin
  if p_tipo is null or p_tipo not in ('REUNIAO', 'VISITA', 'ATIVIDADE', 'LEMBRETE') then
    perform recusar_campos('Escolha o tipo do compromisso', 'tipo');
  end if;
  c.tipo := p_tipo;
  c.titulo := btrim(coalesce(p_titulo, ''));
  if length(c.titulo) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if p_data is null or p_data < hoje_no_condominio() - 366 or p_data > hoje_no_condominio() + 731 then
    perform recusar_campos('A data fica entre um ano atrás e dois anos à frente', 'data');
  end if;
  c.data := p_data;
  if p_fim is not null and (p_inicio is null or p_fim <= p_inicio) then
    perform recusar_campos('O fim vem depois do início', 'horaFim');
  end if;
  c.hora_inicio := p_inicio;
  c.hora_fim := p_fim;
  c.onde := coalesce(p_onde, 'NENHUM');
  case c.onde
    when 'NENHUM' then null;
    when 'UNIDADE' then
      if p_unidade is null or not exists (select 1 from unidades where id = p_unidade and ativa) then
        perform recusar_campos('Escolha a unidade', 'unidadeId');
      end if;
      c.unidade_id := p_unidade;
    when 'AREA_COMUM', 'OUTRO' then
      c.local := btrim(coalesce(p_local, ''));
      if length(c.local) not between 2 and 120 then perform recusar_campos('Diga onde, de 2 a 120 caracteres', 'local'); end if;
    else perform recusar_campos('Onde: unidade, área comum ou outro lugar', 'onde');
  end case;
  c.participantes := coalesce((select array_agg(distinct x) from unnest(p_participantes) x where x is not null), '{}');
  if cardinality(c.participantes) > 30 or exists (
       select 1 from unnest(c.participantes) x
        where not exists (select 1 from vinculos v where v.id = x and v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null)) then
    perform recusar_campos('Participantes: pessoas com acesso ao condomínio, até 30', 'participantes');
  end if;
  c.de_fora := nullif(btrim(coalesce(p_de_fora, '')), '');
  if length(c.de_fora) not between 2 and 200 then perform recusar_campos('Quem é de fora: de 2 a 200 caracteres', 'deFora'); end if;
  c.observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  if length(c.observacao) > 1000 then perform recusar_campos('Observação até 1000 caracteres', 'observacao'); end if;
  if p_pedido is not null then
    -- Só se liga um pedido que a pessoa enxerga (o privado de outros não aparece).
    select * into v_pedido from pedidos where id = p_pedido;
    if not found or not pode(p_pessoa, contexto_condominio(), 'pedidos.ver') or not pedido_visivel(p_pessoa, v_pedido) then
      perform recusar_campos('Pedido não encontrado', 'pedidoId');
    end if;
    c.pedido_id := p_pedido;
  end if;
  return c;
end $$;

-- Datas de uma repetição (AG-05), a partir da primeira, até a data final ou o número de vezes,
-- no máximo 2 anos. No mês sem o dia (31), fica o último dia do mês.
create function datas_da_repeticao(p_inicio date, p_frequencia text, p_intervalo integer, p_ate date, p_vezes integer)
returns date[]
language plpgsql immutable
set search_path = public
as $$
declare
  v_limite date := (p_inicio + interval '2 years')::date;
  v_datas date[] := array[p_inicio];
  v_k integer := 1;
  v_d date;
begin
  loop
    v_d := case p_frequencia
             when 'SEMANAL' then p_inicio + 7 * v_k
             when 'QUINZENAL' then p_inicio + 14 * v_k
             else (p_inicio + make_interval(months => v_k * p_intervalo))::date end;
    exit when v_d > v_limite or (p_ate is not null and v_d > p_ate) or (p_vezes is not null and v_k >= p_vezes);
    v_datas := v_datas || v_d;
    v_k := v_k + 1;
  end loop;
  return v_datas;
end $$;

create function nome_do_lugar(c compromissos) returns text
language sql stable
set search_path = public
as $$
  select case c.onde
    when 'UNIDADE' then (select nome_da_unidade(b.nome, u.andar, u.identificacao) from unidades u left join blocos b on b.id = u.bloco_id
                          where u.id = c.unidade_id)
    when 'AREA_COMUM' then c.local
    when 'OUTRO' then c.local end
$$;

-- O compromisso como a tela recebe. O pedido ligado só aparece a quem pode vê-lo.
create function compromisso_json(c compromissos, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'data', to_char(c.data, 'YYYY-MM-DD'),
    'horaInicio', to_char(c.hora_inicio, 'HH24:MI'), 'horaFim', to_char(c.hora_fim, 'HH24:MI'),
    'diaTodo', c.hora_inicio is null, 'onde', c.onde, 'unidadeId', c.unidade_id, 'local', c.local,
    'lugar', nome_do_lugar(c),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object('vinculoId', x, 'nome', nome_do_vinculo(x)) order by nome_do_vinculo(x))
                                 from unnest(c.participantes) x), '[]'::jsonb),
    'deFora', c.de_fora, 'observacao', c.observacao, 'estado', c.estado, 'versao', c.versao,
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto)
                 from pedidos p where p.id = c.pedido_id
                  and pode(p_pessoa, c.condominio_id, 'pedidos.ver') and pedido_visivel(p_pessoa, p)),
    'pedidoOculto', case when c.pedido_id is not null and not exists (
                      select 1 from pedidos p where p.id = c.pedido_id and pode(p_pessoa, c.condominio_id, 'pedidos.ver')
                                                and pedido_visivel(p_pessoa, p)) then true end,
    'serie', case when c.serie_id is not null then (
               select jsonb_build_object('id', s.id, 'frequencia', s.frequencia, 'intervalo', s.intervalo,
                        'ate', (select to_char(max(x.data), 'YYYY-MM-DD') from compromissos x where x.serie_id = s.id),
                        'total', (select count(*) from compromissos x where x.serie_id = s.id))
                 from series_compromisso s where s.id = c.serie_id) end,
    'cancelamento', case when c.cancelado_em is not null then jsonb_build_object('em', c.cancelado_em, 'motivo', c.motivo_cancelamento,
                      'por', (select nome from pessoas where id = c.cancelado_por)) end,
    'realizadoEm', c.realizado_em))
$$;

create function exigir_compromisso(p_id uuid) returns compromissos
language plpgsql
set search_path = public
as $$
declare v compromissos;
begin
  select * into v from compromissos where id = p_id;
  if not found then raise exception 'Compromisso não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function exigir_compromisso_ativo(p_c compromissos) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_c.estado in ('REALIZADO', 'CANCELADO') then
    perform recusar_motivo('Compromisso realizado ou cancelado não muda: marque outro', 'COMPROMISSO_ENCERRADO');
  end if;
end $$;

-- As datas da série que a mudança alcança: esta, ou esta e as próximas ainda em aberto. As que
-- já passaram nunca mudam (AG-05).
create function alcance_do_compromisso(p_c compromissos, p_escopo text) returns uuid[]
language plpgsql
set search_path = public
as $$
begin
  if coalesce(p_escopo, 'ESTA') = 'ESTA' or p_c.serie_id is null then return array[p_c.id]; end if;
  if p_escopo <> 'PROXIMAS' then perform recusar_campos('Escolha: só esta data ou esta e as próximas', 'escopo'); end if;
  return array(select id from compromissos
                where serie_id = p_c.serie_id and estado not in ('REALIZADO', 'CANCELADO')
                  and (id = p_c.id or (data > p_c.data and data >= hoje_no_condominio()))
                order by data);
end $$;

-- "Esta e as próximas" num pedaço da série: as datas alcançadas ganham uma série nova, e as
-- anteriores ficam na antiga, sem mudar.
create function separar_serie(p_ids uuid[], p_serie uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_nova uuid;
begin
  if p_serie is null or cardinality(p_ids) < 2
     or not exists (select 1 from compromissos where serie_id = p_serie and not (id = any (p_ids))) then
    return;
  end if;
  insert into series_compromisso (condominio_id, frequencia, intervalo, criado_por)
  select condominio_id, frequencia, intervalo, contexto_pessoa() from series_compromisso where id = p_serie
  returning id into v_nova;
  update compromissos set serie_id = v_nova where id = any (p_ids);
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API.

-- O que a tela precisa para marcar um compromisso.
create function plataforma_agenda_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
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
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- A agenda de um período (AG-03), com as datas de outras telas (AG-09): os feriados, para quem
-- vê as configurações.
create function plataforma_agenda(p_pessoa uuid, p_condominio uuid, p_de date, p_ate date) returns jsonb
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
    'datas', case when pode(p_pessoa, p_condominio, 'config.ver') then coalesce((
      select jsonb_agg(jsonb_build_object('data', to_char(f.data, 'YYYY-MM-DD'), 'titulo', f.descricao, 'fonte', 'FERIADO')
                       order by f.data)
        from feriados f where f.data between p_de and p_ate), '[]'::jsonb) else '[]'::jsonb end,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')));
end $$;

-- Um compromisso, com o histórico e os conflitos de agora.
create function plataforma_compromisso(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v compromissos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.ver');
  v := exigir_compromisso(p_id);
  return jsonb_build_object(
    'compromisso', compromisso_json(v, p_pessoa) || jsonb_build_object(
      'registradoPor', (select nome from pessoas where id = v.criado_por), 'registradoEm', v.criado_em),
    'conflitos', case when v.estado in ('REALIZADO', 'CANCELADO') then '[]'::jsonb
                 else conflitos_compromisso(array[v.id], v.data, v.hora_inicio, v.hora_fim, v.onde, v.unidade_id, v.local, v.participantes) end,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                          'dados', h.dados) order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'compromissos' and h.entidade_id = v.id::text), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar') and v.estado not in ('REALIZADO', 'CANCELADO')));
end $$;

-- Marcar um compromisso (AG-01), com repetição opcional (AG-05). Conflito avisa (AG-04): sem
-- p_aceitar_conflito, a gravação para e devolve a lista.
create function plataforma_marcar_compromisso(p_pessoa uuid, p_condominio uuid, p_tipo text, p_titulo text, p_data date,
                                              p_inicio time, p_fim time, p_onde text, p_unidade uuid, p_local text,
                                              p_participantes uuid[], p_de_fora text, p_pedido uuid, p_observacao text,
                                              p_estado text, p_repetir text, p_intervalo integer, p_ate date, p_vezes integer,
                                              p_aceitar_conflito boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c compromissos;
  v_datas date[];
  v_serie uuid;
  v_conflitos jsonb := '[]'::jsonb;
  v_d date;
  v_id uuid;
  v_primeiro uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.editar');
  c := ler_compromisso(p_pessoa, p_tipo, p_titulo, p_data, p_inicio, p_fim, p_onde, p_unidade, p_local, p_participantes,
                       p_de_fora, p_pedido, p_observacao);
  if coalesce(p_estado, 'PLANEJADO') not in ('PLANEJADO', 'A_CONFIRMAR', 'CONFIRMADO') then
    perform recusar_campos('Situação inicial: planejado, a confirmar ou confirmado', 'estado');
  end if;
  if p_repetir is null then
    v_datas := array[c.data];
  else
    if p_repetir not in ('SEMANAL', 'QUINZENAL', 'MENSAL') then perform recusar_campos('Repetição desconhecida', 'repetir'); end if;
    if p_repetir = 'MENSAL' and coalesce(p_intervalo, 1) not between 1 and 12 then
      perform recusar_campos('A cada 1 a 12 meses', 'intervalo');
    end if;
    if (p_ate is null) = (p_vezes is null) then
      perform recusar_campos('Repete até uma data ou por um número de vezes', 'ate', 'vezes');
    end if;
    if p_ate is not null and (p_ate <= c.data or p_ate > (c.data + interval '2 years')::date) then
      perform recusar_campos('A repetição termina depois da primeira data e em até 2 anos', 'ate');
    end if;
    if p_vezes is not null and p_vezes not between 2 and 104 then
      perform recusar_campos('De 2 a 104 vezes', 'vezes');
    end if;
    v_datas := datas_da_repeticao(c.data, p_repetir, case when p_repetir = 'MENSAL' then coalesce(p_intervalo, 1) else 1 end,
                                  p_ate, p_vezes);
    if cardinality(v_datas) < 2 then perform recusar_campos('A repetição precisa de pelo menos duas datas', 'ate', 'vezes'); end if;
  end if;
  foreach v_d in array v_datas loop
    v_conflitos := v_conflitos || conflitos_compromisso(null, v_d, c.hora_inicio, c.hora_fim, c.onde, c.unidade_id, c.local, c.participantes);
  end loop;
  if jsonb_array_length(v_conflitos) > 0 and not coalesce(p_aceitar_conflito, false) then
    perform recusar_conflito(v_conflitos);
  end if;
  if cardinality(v_datas) > 1 then
    insert into series_compromisso (condominio_id, frequencia, intervalo, criado_por)
    values (p_condominio, p_repetir, case when p_repetir = 'MENSAL' then coalesce(p_intervalo, 1) else 1 end, p_pessoa)
    returning id into v_serie;
  end if;
  perform definir_transicao('MARCADO');
  foreach v_d in array v_datas loop
    insert into compromissos (condominio_id, serie_id, tipo, titulo, data, hora_inicio, hora_fim, onde, unidade_id, local,
                              participantes, de_fora, pedido_id, observacao, estado, criado_por)
    values (p_condominio, v_serie, c.tipo, c.titulo, v_d, c.hora_inicio, c.hora_fim, c.onde, c.unidade_id, c.local,
            c.participantes, c.de_fora, c.pedido_id, c.observacao, coalesce(p_estado, 'PLANEJADO'), p_pessoa)
    returning id into v_id;
    v_primeiro := coalesce(v_primeiro, v_id);
    perform registrar_historico('compromisso.marcado', 'compromissos', v_id::text, jsonb_strip_nulls(jsonb_build_object(
      'tipo', c.tipo, 'data', to_char(v_d, 'YYYY-MM-DD'), 'estado', coalesce(p_estado, 'PLANEJADO'),
      'repeticao', case when v_serie is not null then p_repetir end, 'pedido', c.pedido_id,
      'conflitos', case when jsonb_array_length(v_conflitos) > 0 then jsonb_array_length(v_conflitos) end)));
  end loop;
  return jsonb_build_object('id', v_primeiro, 'datas', cardinality(v_datas), 'conflitos', v_conflitos);
end $$;

-- Mudar o que foi combinado, menos a data (para isso, reagendar). Num compromisso que se
-- repete: só esta data ou esta e as próximas (AG-05).
create function plataforma_alterar_compromisso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_tipo text,
                                               p_titulo text, p_inicio time, p_fim time, p_onde text, p_unidade uuid,
                                               p_local text, p_participantes uuid[], p_de_fora text, p_pedido uuid,
                                               p_observacao text, p_escopo text, p_aceitar_conflito boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v compromissos;
  c compromissos;
  x compromissos;
  v_ids uuid[];
  v_conflitos jsonb := '[]'::jsonb;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.editar');
  v := exigir_compromisso(p_id);
  perform exigir_compromisso_ativo(v);
  if v.versao <> p_versao then perform conflito_versao('compromissos', p_id); end if;
  c := ler_compromisso(p_pessoa, p_tipo, p_titulo, v.data, p_inicio, p_fim, p_onde, p_unidade, p_local, p_participantes,
                       p_de_fora, p_pedido, p_observacao);
  v_ids := alcance_do_compromisso(v, p_escopo);
  for x in select * from compromissos where id = any (v_ids) order by data loop
    v_conflitos := v_conflitos || conflitos_compromisso(v_ids, x.data, c.hora_inicio, c.hora_fim, c.onde, c.unidade_id, c.local, c.participantes);
  end loop;
  if jsonb_array_length(v_conflitos) > 0 and not coalesce(p_aceitar_conflito, false) then
    perform recusar_conflito(v_conflitos);
  end if;
  for x in select * from compromissos where id = any (v_ids) loop
    update compromissos set tipo = c.tipo, titulo = c.titulo, hora_inicio = c.hora_inicio, hora_fim = c.hora_fim,
                            onde = c.onde, unidade_id = c.unidade_id, local = c.local, participantes = c.participantes,
                            de_fora = c.de_fora, pedido_id = c.pedido_id, observacao = c.observacao
     where id = x.id and (x.id <> p_id or versao = p_versao)
    returning versao into v_versao;
    if x.id = p_id and v_versao is null then perform conflito_versao('compromissos', p_id); end if;
    perform registrar_historico('compromisso.alterado', 'compromissos', x.id::text, jsonb_strip_nulls(jsonb_build_object(
      'escopo', case when cardinality(v_ids) > 1 then 'PROXIMAS' end,
      'campos', (select jsonb_agg(k) from (values
          ('tipo', x.tipo is distinct from c.tipo), ('titulo', x.titulo is distinct from c.titulo),
          ('horario', (x.hora_inicio, x.hora_fim) is distinct from (c.hora_inicio, c.hora_fim)),
          ('lugar', (x.onde, x.unidade_id, x.local) is distinct from (c.onde, c.unidade_id, c.local)),
          ('participantes', x.participantes is distinct from c.participantes or x.de_fora is distinct from c.de_fora),
          ('pedido', x.pedido_id is distinct from c.pedido_id), ('observacao', x.observacao is distinct from c.observacao)) t(k, mudou)
         where mudou))));
  end loop;
  -- Depois de gravar (a versão lida vale para a gravação): as datas alcançadas ganham a série nova.
  perform separar_serie(v_ids, v.serie_id);
  return jsonb_build_object('versao', (select versao from compromissos where id = p_id), 'alterados', cardinality(v_ids),
                            'conflitos', v_conflitos);
end $$;

-- Reagendar (AG-02): pede motivo e guarda a data anterior no histórico. "Esta e as próximas"
-- leva as datas seguintes da série pelo mesmo número de dias.
create function plataforma_reagendar_compromisso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date,
                                                 p_inicio time, p_fim time, p_motivo text, p_escopo text,
                                                 p_aceitar_conflito boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v compromissos;
  x compromissos;
  v_ids uuid[];
  v_motivo text;
  v_dias integer;
  v_conflitos jsonb := '[]'::jsonb;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.editar');
  v := exigir_compromisso(p_id);
  perform exigir_compromisso_ativo(v);
  if v.versao <> p_versao then perform conflito_versao('compromissos', p_id); end if;
  v_motivo := exigir_motivo(p_motivo);
  if p_data is null or p_data < hoje_no_condominio() or p_data > hoje_no_condominio() + 731 then
    perform recusar_campos('A nova data fica entre hoje e dois anos à frente', 'data');
  end if;
  if p_fim is not null and (p_inicio is null or p_fim <= p_inicio) then
    perform recusar_campos('O fim vem depois do início', 'horaFim');
  end if;
  if (p_data, p_inicio, p_fim) is not distinct from (v.data, v.hora_inicio, v.hora_fim) then
    perform recusar_campos('Escolha outra data ou outro horário', 'data');
  end if;
  v_dias := p_data - v.data;
  v_ids := alcance_do_compromisso(v, p_escopo);
  for x in select * from compromissos where id = any (v_ids) order by data loop
    v_conflitos := v_conflitos || conflitos_compromisso(v_ids, x.data + v_dias, p_inicio, p_fim, x.onde, x.unidade_id, x.local, x.participantes);
  end loop;
  if jsonb_array_length(v_conflitos) > 0 and not coalesce(p_aceitar_conflito, false) then
    perform recusar_conflito(v_conflitos);
  end if;
  for x in select * from compromissos where id = any (v_ids) loop
    update compromissos set data = x.data + v_dias, hora_inicio = p_inicio, hora_fim = p_fim
     where id = x.id and (x.id <> p_id or versao = p_versao)
    returning versao into v_versao;
    if x.id = p_id and v_versao is null then perform conflito_versao('compromissos', p_id); end if;
    perform registrar_historico('compromisso.reagendado', 'compromissos', x.id::text, jsonb_strip_nulls(jsonb_build_object(
      'de', to_char(x.data, 'YYYY-MM-DD'), 'deHora', to_char(x.hora_inicio, 'HH24:MI'),
      'para', to_char(x.data + v_dias, 'YYYY-MM-DD'), 'paraHora', to_char(p_inicio, 'HH24:MI'),
      'motivo', v_motivo, 'escopo', case when cardinality(v_ids) > 1 then 'PROXIMAS' end)));
  end loop;
  -- Depois de gravar (a versão lida vale para a gravação): as datas alcançadas ganham a série nova.
  perform separar_serie(v_ids, v.serie_id);
  return jsonb_build_object('versao', (select versao from compromissos where id = p_id), 'alterados', cardinality(v_ids),
                            'conflitos', v_conflitos);
end $$;

-- Planejado, a confirmar, confirmado ou realizado (AG-02). Realizado só no dia ou depois.
create function plataforma_situacao_compromisso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v compromissos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.editar');
  v := exigir_compromisso(p_id);
  perform exigir_compromisso_ativo(v);
  if p_estado is null or p_estado not in ('PLANEJADO', 'A_CONFIRMAR', 'CONFIRMADO', 'REALIZADO') then
    perform recusar_campos('Situação desconhecida', 'estado');
  end if;
  if p_estado = v.estado then return jsonb_build_object('versao', v.versao); end if;
  if p_estado = 'REALIZADO' and v.data > hoje_no_condominio() then
    perform recusar_motivo('Só dá para marcar como realizado no dia ou depois', 'AINDA_NAO_ACONTECEU');
  end if;
  -- O guardião registra a mudança de situação no histórico (estado.mudou).
  perform definir_transicao(case p_estado when 'REALIZADO' then 'REALIZADO' when 'CONFIRMADO' then 'CONFIRMADO' else 'SITUACAO' end);
  update compromissos set estado = p_estado, realizado_em = case when p_estado = 'REALIZADO' then app_now() end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('compromissos', p_id); end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Cancelar (AG-02): pede motivo; o compromisso cancelado continua na agenda e no histórico.
create function plataforma_cancelar_compromisso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text,
                                                p_escopo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v compromissos;
  v_ids uuid[];
  v_motivo text;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.editar');
  v := exigir_compromisso(p_id);
  perform exigir_compromisso_ativo(v);
  if v.versao <> p_versao then perform conflito_versao('compromissos', p_id); end if;
  v_motivo := exigir_motivo(p_motivo);
  v_ids := alcance_do_compromisso(v, p_escopo);
  -- O guardião registra o cancelamento com o motivo (estado.mudou).
  perform definir_transicao('CANCELADO', v_motivo);
  foreach v_id in array v_ids loop
    update compromissos set estado = 'CANCELADO', cancelado_em = app_now(), cancelado_por = p_pessoa, motivo_cancelamento = v_motivo
     where id = v_id and (v_id <> p_id or versao = p_versao)
    returning versao into v_versao;
    if v_id = p_id and v_versao is null then perform conflito_versao('compromissos', p_id); end if;
  end loop;
  return jsonb_build_object('cancelados', cardinality(v_ids));
end $$;

-- A agenda dentro do pedido (AG-08, MP-04): os compromissos ligados e o aviso quando a visita
-- cai depois da previsão de solução. Nada muda sozinho.
create function plataforma_agenda_do_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if not pode(p_pessoa, p_condominio, 'agenda.ver') then
    return jsonb_build_object('podeVer', false, 'podeMarcar', false, 'compromissos', '[]'::jsonb, 'divergencia', null);
  end if;
  return jsonb_build_object(
    'podeVer', true,
    'podeMarcar', pode(p_pessoa, p_condominio, 'agenda.editar'),
    'compromissos', coalesce((
      select jsonb_agg(compromisso_json(c, p_pessoa) order by c.data, c.hora_inicio nulls first)
        from compromissos c where c.pedido_id = v.id and c.estado <> 'CANCELADO'), '[]'::jsonb),
    'divergencia', (
      select jsonb_build_object('previsao', to_char(v.previsao, 'YYYY-MM-DD'), 'compromissoId', c.id,
                                'titulo', c.titulo, 'data', to_char(c.data, 'YYYY-MM-DD'))
        from compromissos c
       where c.pedido_id = v.id and v.previsao is not null and c.estado in ('PLANEJADO', 'A_CONFIRMAR', 'CONFIRMADO')
         and c.tipo = 'VISITA' and c.data > v.previsao and v.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')
       order by c.data limit 1));
end $$;

call fechar_acesso();

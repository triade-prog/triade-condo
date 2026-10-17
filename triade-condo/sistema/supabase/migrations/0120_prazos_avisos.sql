-- 0120 · Prazos, avisos e o início do dia (passos 6 e 7, sem WhatsApp; F6.1, F6.2, F7.1,
-- F7.2; AT-08, AT-09, AT-10, TR-01, TR-03, TR-07, TR-11). Telas aprovadas pela Carolina em
-- 17/10/2026.
--
-- Regras desta parte:
-- 1. O banco confere os prazos sozinho a cada 5 minutos (verificar_prazos, agendado pelo
--    pg_cron do Supabase). As horas contam só o horário de atendimento e pulam feriados,
--    igual ao prazo (AT-10); etapa que pausa o prazo também pausa o aviso.
-- 2. Retorno vencido avisa o responsável na hora (sem responsável, o síndico). Se continuar
--    vencido, o aviso sobe para o síndico e, depois, para o substituto escolhido (uma pessoa
--    autorizada). Os tempos são do condomínio; sem substituto, o aviso para no síndico (AT-09).
-- 3. Outros avisos: pedido sem responsável há algumas horas de atendimento (para o síndico) e
--    pendência parada há alguns dias (para o responsável da pendência).
-- 4. Ninguém recebe o mesmo aviso duas vezes para o mesmo vencimento. Ver o aviso não resolve
--    o pedido: o vencimento só acaba com o retorno ao morador. Cada aviso vai para o histórico
--    do pedido, sem nome do morador nem telefone.
-- 5. Os avisos ficam dentro do painel até o WhatsApp chegar (passo 5, W-11).
-- 6. Indicadores (TR-01, TR-03): a métrica principal é a porcentagem de retornos no prazo.
--    Um retorno está no prazo quando é registrado antes do próximo retorno combinado vencer;
--    um compromisso que venceu e não teve retorno conta como fora do prazo. Nota interna não
--    conta. Tudo sai do histórico, que não muda: o mês fechado fica fixo. Sem nenhum caso no
--    período, o número é "sem dados" (null), nunca zero (TR-07).

-- ---------------------------------------------------------------------------------------
-- Regras de aviso do condomínio.

alter table configuracao_condominio
  add column aviso_sindico_horas         smallint not null default 2 check (aviso_sindico_horas between 1 and 240),
  add column aviso_substituto_horas      smallint not null default 8 check (aviso_substituto_horas between 1 and 240),
  add column aviso_substituto            uuid,
  add column aviso_sem_responsavel_horas smallint not null default 4 check (aviso_sem_responsavel_horas between 1 and 240),
  add column aviso_pendencia_dias        smallint not null default 3 check (aviso_pendencia_dias between 1 and 60),
  add constraint configuracao_aviso_substituto foreign key (aviso_substituto, condominio_id) references vinculos (id, condominio_id),
  add constraint configuracao_aviso_ordem check (aviso_substituto_horas > aviso_sindico_horas);

-- ---------------------------------------------------------------------------------------
-- Avisos dentro do painel.

create table avisos (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  pedido_id     uuid not null,
  tipo          text not null check (tipo in ('RETORNO_VENCIDO', 'ESCALADO_SINDICO', 'ESCALADO_SUBSTITUTO', 'SEM_RESPONSAVEL', 'PENDENCIA_PARADA')),
  -- O vencimento (ou o início da situação) a que o aviso se refere: evita repetir.
  referencia    timestamptz not null,
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  unique (pessoa_id, pedido_id, tipo, referencia)
);
create index avisos_pessoa on avisos (pessoa_id, criado_em desc);
create index avisos_pedido on avisos (pedido_id, referencia);
call proteger_tabela_condominio('avisos');
create trigger avisos_sem_exclusao before delete on avisos for each row execute function somente_insercao();

-- Do aviso só muda o "visto", uma vez.
create function avisos_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.pedido_id, new.tipo, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.pedido_id, old.tipo, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_regras before update on avisos for each row execute function avisos_regras();

-- O verificador percorre todos os condomínios: só ele, durante a conferência, enxerga a
-- lista inteira. Dentro de cada condomínio valem as regras de sempre.
create policy verificador_prazos on condominios for select using (current_setting('app.verificador', true) = 'on');

-- ---------------------------------------------------------------------------------------
-- Horas de atendimento entre dois momentos (o contrário de vencimento_do_prazo): só o
-- horário de atendimento, no fuso do condomínio, sem feriados. Sem horário, horas corridas.
create function horas_atendimento_entre(p_condominio uuid, p_de timestamptz, p_ate timestamptz) returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso       text;
  v_intervalos jsonb;
  v_a          timestamp;
  v_b          timestamp;
  v_dia        date;
  v_ini        timestamp;
  v_fim        timestamp;
  v_total      interval := interval '0';
  i            record;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then return 0; end if;
  select c.fuso, h.intervalos into v_fuso, v_intervalos
    from configuracao_condominio c join horarios h on h.condominio_id = c.condominio_id and h.tipo = 'ATENDIMENTO'
   where c.condominio_id = p_condominio;
  if v_fuso is null then raise exception 'Condomínio sem configuração' using errcode = 'TC404'; end if;
  if jsonb_array_length(v_intervalos) = 0 then
    return round((extract(epoch from p_ate - p_de) / 3600)::numeric, 1);
  end if;
  v_a := p_de at time zone v_fuso;
  v_b := p_ate at time zone v_fuso;
  for d in 0..least(400, v_b::date - v_a::date) loop
    v_dia := v_a::date + d;
    continue when exists (select 1 from feriados where condominio_id = p_condominio and data = v_dia);
    for i in select (x ->> 'inicio')::time as inicio, (x ->> 'fim')::time as fim
               from jsonb_array_elements(v_intervalos) x
              where (x ->> 'dia')::int = extract(dow from v_dia)::int loop
      v_ini := greatest(v_dia + i.inicio, v_a);
      v_fim := least(v_dia + i.fim, v_b);
      if v_fim > v_ini then v_total := v_total + (v_fim - v_ini); end if;
    end loop;
  end loop;
  return round((extract(epoch from v_total) / 3600)::numeric, 1);
end $$;

-- ---------------------------------------------------------------------------------------
-- Verificador de prazos (F6.1, F6.2).

-- Pessoa do vínculo, se ele está ativo.
create function pessoa_do_vinculo(p_vinculo uuid) returns uuid
language sql stable
set search_path = public
as $$ select pessoa_id from vinculos where id = p_vinculo and revogado_em is null $$;

create function sindicos_do_condominio() returns uuid[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct pessoa_id), '{}') from vinculos
   where condominio_id = contexto_condominio() and funcao = 'SINDICO' and revogado_em is null
$$;

-- Avisa cada pessoa uma vez (por tipo e vencimento). Devolve quantas foram avisadas agora.
create function avisar(p_pessoas uuid[], p_pedido uuid, p_tipo text, p_referencia timestamptz) returns integer
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  insert into avisos (condominio_id, pessoa_id, pedido_id, tipo, referencia)
  select contexto_condominio(), x, p_pedido, p_tipo, p_referencia from unnest(p_pessoas) x where x is not null
  on conflict (pessoa_id, pedido_id, tipo, referencia) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Confere os prazos do condomínio do contexto; devolve quantos avisos saíram.
create function verificar_prazos_condominio(p_agora timestamptz) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_cfg configuracao_condominio;
  v_sindicos uuid[] := sindicos_do_condominio();
  v_substituto uuid;
  v_resp uuid;
  v_ref timestamptz;
  v_total integer := 0;
  v_n integer;
  p pedidos;
  pp record;
begin
  select * into v_cfg from configuracao_condominio;
  v_substituto := pessoa_do_vinculo(v_cfg.aviso_substituto);

  -- Retorno vencido: responsável na hora, depois síndico, depois substituto.
  for p in select * from pedidos x where x.estado in ('ABERTO', 'EM_ANDAMENTO') and retorno_vencido(x) loop
    v_ref := p.proximo_retorno;
    v_resp := pessoa_do_vinculo(p.responsavel_id);
    v_n := avisar(case when v_resp is null then v_sindicos else array[v_resp] end, p.id, 'RETORNO_VENCIDO', v_ref);
    if v_n > 0 then
      perform registrar_historico('pedido.retorno_venceu', 'pedidos', p.id::text, jsonb_build_object('de', v_ref));
      perform registrar_historico('pedido.aviso', 'pedidos', p.id::text,
        jsonb_build_object('tipo', 'RETORNO_VENCIDO', 'para', case when v_resp is null then 'SINDICO' else 'RESPONSAVEL' end));
      v_total := v_total + v_n;
    end if;
    if v_resp is not null and vencimento_do_prazo(p.condominio_id, v_ref, v_cfg.aviso_sindico_horas) <= p_agora then
      v_n := avisar(array(select x from unnest(v_sindicos) x where x <> v_resp), p.id, 'ESCALADO_SINDICO', v_ref);
      if v_n > 0 then
        perform registrar_historico('pedido.aviso', 'pedidos', p.id::text, jsonb_build_object('tipo', 'ESCALADO_SINDICO', 'para', 'SINDICO'));
        v_total := v_total + v_n;
      end if;
    end if;
    if v_substituto is not null and v_substituto <> coalesce(v_resp, '00000000-0000-0000-0000-000000000000'::uuid)
       and not v_substituto = any (v_sindicos)
       and vencimento_do_prazo(p.condominio_id, v_ref, v_cfg.aviso_substituto_horas) <= p_agora then
      v_n := avisar(array[v_substituto], p.id, 'ESCALADO_SUBSTITUTO', v_ref);
      if v_n > 0 then
        perform registrar_historico('pedido.aviso', 'pedidos', p.id::text, jsonb_build_object('tipo', 'ESCALADO_SUBSTITUTO', 'para', 'SUBSTITUTO'));
        v_total := v_total + v_n;
      end if;
    end if;
  end loop;

  -- Pedido sem responsável há algumas horas de atendimento: avisa o síndico.
  for p in select * from pedidos x where x.estado in ('ABERTO', 'EM_ANDAMENTO') and x.responsavel_id is null loop
    v_ref := coalesce((select max(h.ocorrido_em) from historico h
                        where h.entidade = 'pedidos' and h.entidade_id = p.id::text and h.acao = 'pedido.responsavel'), p.criado_em);
    if vencimento_do_prazo(p.condominio_id, v_ref, v_cfg.aviso_sem_responsavel_horas) <= p_agora then
      v_n := avisar(v_sindicos, p.id, 'SEM_RESPONSAVEL', v_ref);
      if v_n > 0 then
        perform registrar_historico('pedido.aviso', 'pedidos', p.id::text, jsonb_build_object('tipo', 'SEM_RESPONSAVEL', 'para', 'SINDICO'));
        v_total := v_total + v_n;
      end if;
    end if;
  end loop;

  -- Pendência parada há alguns dias: avisa o responsável da pendência.
  for pp in select x.id, x.pedido_id, x.aberta_em, x.responsavel_id from pendencias_pedido x join pedidos y on y.id = x.pedido_id
             where x.resolvida_em is null and y.estado in ('ABERTO', 'EM_ANDAMENTO')
               and x.aberta_em + make_interval(days => v_cfg.aviso_pendencia_dias) <= p_agora loop
    v_n := avisar(array[pessoa_do_vinculo(pp.responsavel_id)], pp.pedido_id, 'PENDENCIA_PARADA', pp.aberta_em);
    if v_n > 0 then
      perform registrar_historico('pedido.aviso', 'pedidos', pp.pedido_id::text, jsonb_build_object('tipo', 'PENDENCIA_PARADA', 'para', 'RESPONSAVEL'));
      v_total := v_total + v_n;
    end if;
  end loop;
  return v_total;
end $$;

-- Confere todos os condomínios. Um condomínio com problema não impede os outros.
create function verificar_prazos() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
  v_agora timestamptz := app_now();
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    begin
      v_total := v_total + verificar_prazos_condominio(v_agora);
    exception when others then
      raise warning 'Prazos do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------
-- Indicadores do atendimento (F7.2, TR-01, TR-03, TR-07), do condomínio do contexto.

create function indicadores_atendimento(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_cond uuid := contexto_condominio();
  v_fuso text := (select fuso from configuracao_condominio);
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
  v jsonb;
begin
  with retornos as (
    -- Retornos dados com compromisso: no prazo se registrados até o próximo retorno combinado.
    select h.entidade_id::uuid as pedido_id, h.ocorrido_em <= (h.dados ->> 'de')::timestamptz as no_prazo
      from historico h
     where h.condominio_id = v_cond and h.entidade = 'pedidos' and h.acao = 'pedido.retorno_registrado'
       and h.ocorrido_em >= v_ini and h.ocorrido_em < v_fim and jsonb_typeof(h.dados -> 'de') = 'string'
    union all
    -- Compromissos que venceram e não tiveram retorno: fora do prazo.
    select h.entidade_id::uuid, false
      from historico h
     where h.condominio_id = v_cond and h.entidade = 'pedidos' and h.acao = 'pedido.retorno_venceu'
       and h.ocorrido_em >= v_ini and h.ocorrido_em < v_fim
       and not exists (select 1 from historico r
                        where r.condominio_id = v_cond and r.entidade = 'pedidos' and r.entidade_id = h.entidade_id
                          and r.acao = 'pedido.retorno_registrado' and r.dados ->> 'de' = h.dados ->> 'de')
  ), mudancas as (
    select h.entidade_id::uuid as pedido_id, h.dados ->> 'de' as de, h.dados ->> 'para' as para
      from historico h
     where h.condominio_id = v_cond and h.entidade = 'pedidos' and h.acao = 'estado.mudou'
       and h.ocorrido_em >= v_ini and h.ocorrido_em < v_fim
  ), primeiros as (
    select p.id, p.categoria_id, horas_atendimento_entre(v_cond, p.criado_em, min(a.criado_em)) as horas
      from pedidos p join andamentos_pedido a on a.pedido_id = p.id and a.tipo = 'RETORNO'
     where p.criado_em >= v_ini and p.criado_em < v_fim
     group by p.id, p.categoria_id, p.criado_em
  )
  select jsonb_build_object(
    'de', to_char(p_de, 'YYYY-MM-DD'),
    'ate', to_char(p_ate, 'YYYY-MM-DD'),
    'retornos', jsonb_build_object(
      'total', (select count(*) from retornos),
      'noPrazo', (select count(*) from retornos where no_prazo),
      'porcentagem', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where no_prazo) / count(*)) end from retornos)),
    'primeiroRetornoHoras', (select round(avg(horas), 1) from primeiros),
    'registrados', (select count(*) from pedidos where criado_em >= v_ini and criado_em < v_fim),
    'concluidos', (select count(*) from mudancas where para = 'ENCERRADO'),
    'reabertos', (select count(*) from mudancas where de = 'ENCERRADO' and para in ('ABERTO', 'EM_ANDAMENTO')),
    'porCategoria', coalesce((
      select jsonb_agg(jsonb_build_object('categoriaId', c.id, 'nome', c.nome, 'retornos', r.total, 'noPrazo', r.no_prazo,
                                          'porcentagem', case when coalesce(r.total, 0) = 0 then null else round(100.0 * r.no_prazo / r.total) end,
                                          'concluidos', coalesce(m.concluidos, 0))
                       order by lower(c.nome))
        from categorias c
        left join (select p.categoria_id, count(*) as total, count(*) filter (where x.no_prazo) as no_prazo
                     from retornos x join pedidos p on p.id = x.pedido_id group by p.categoria_id) r on r.categoria_id = c.id
        left join (select p.categoria_id, count(*) as concluidos
                     from mudancas x join pedidos p on p.id = x.pedido_id where x.para = 'ENCERRADO' group by p.categoria_id) m on m.categoria_id = c.id
       where c.ativa or r.total is not null or m.concluidos is not null), '[]'::jsonb))
    into v;
  return v;
end $$;

-- O mês fechado (o anterior ao de hoje) e a porcentagem do mês antes dele, para o início.
create function mes_fechado() returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_mes date := (date_trunc('month', hoje_no_condominio()) - interval '1 month')::date;
  v jsonb;
begin
  v := indicadores_atendimento(v_mes, (v_mes + interval '1 month' - interval '1 day')::date);
  return (v - 'porCategoria') || jsonb_build_object('mes', to_char(v_mes, 'YYYY-MM'),
    'porcentagemAnterior', indicadores_atendimento((v_mes - interval '1 month')::date, (v_mes - interval '1 day')::date) -> 'retornos' -> 'porcentagem');
end $$;

-- ---------------------------------------------------------------------------------------
-- O início do dia (F7.1): o resumo dos pedidos ganha o que vence hoje, o vencido mais antigo
-- e as pendências paradas.

create or replace function resumo_pedidos(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with visiveis as (
    select p.*, retorno_vencido(p) as vencido, eh_responsavel(p_pessoa, p) as meu
      from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and pedido_visivel(p_pessoa, p)),
  hoje as (
    select * from visiveis where not vencido and proximo_retorno is not null
       and (proximo_retorno at time zone (select fuso from configuracao_condominio))::date = hoje_no_condominio()),
  antigo as (
    select v.id, v.proximo_retorno from visiveis v where v.vencido order by v.proximo_retorno limit 1)
  select jsonb_build_object(
    'ativos', (select count(*) from visiveis),
    'semResponsavel', (select count(*) from visiveis where responsavel_id is null),
    'aguardandoAceite', (select count(*) from visiveis where responsavel_id is not null and aceito_em is null),
    'meusParaAceitar', (select count(*) from visiveis where meu and aceito_em is null),
    'retornoVencido', (select count(*) from visiveis where vencido),
    'emRevisao', (select count(*) from visiveis where estado = 'EM_REVISAO'),
    'comPendencia', (select count(*) from visiveis v where exists (select 1 from pendencias_pedido pp where pp.pedido_id = v.id and pp.resolvida_em is null)),
    'meus', (select count(*) from visiveis where meu),
    'vencemHoje', (select count(*) from hoje),
    'proximoHoje', (select min(proximo_retorno) from hoje),
    'vencidoMaisAntigo', (select proximo_retorno from antigo),
    'vencidoMaisAntigoEscalado', coalesce((select exists (select 1 from avisos a where a.pedido_id = antigo.id and a.referencia = antigo.proximo_retorno
                                                           and a.tipo = 'ESCALADO_SINDICO') from antigo), false),
    'pendenciasParadas', (select count(*) from pendencias_pedido pp join visiveis v on v.id = pp.pedido_id
                           where pp.resolvida_em is null
                             and pp.aberta_em + make_interval(days => (select aviso_pendencia_dias from configuracao_condominio)) <= app_now()))
$$;

-- ---------------------------------------------------------------------------------------
-- Funções da API da Plataforma (security definer). Pessoa e condomínio vêm da sessão.

-- O painel ganha os avisos sem ver e o mês fechado.
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
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

-- As configurações ganham as regras de aviso e quem pode ser o substituto.
create or replace function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
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
    'regrasPedidos', jsonb_build_object('revisao', c.revisao_conclusao, 'reabertura', c.reabertura),
    'avisos', jsonb_build_object(
      'sindicoHoras', c.aviso_sindico_horas, 'substitutoHoras', c.aviso_substituto_horas,
      'substitutoId', case when pessoa_do_vinculo(c.aviso_substituto) is not null then c.aviso_substituto end,
      'semResponsavelHoras', c.aviso_sem_responsavel_horas, 'pendenciaDias', c.aviso_pendencia_dias,
      'substitutosPossiveis', coalesce((select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'cargo', v.cargo) order by lower(p.nome))
                                          from vinculos v join pessoas p on p.id = v.pessoa_id
                                         where v.funcao = 'AUTORIZADO' and v.revogado_em is null), '[]'::jsonb)),
    'pendencias', to_jsonb(pendencias_configuracao(c.condominio_id)),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar'))
    into v
    from configuracao_condominio c;
  return v;
end $$;

-- Regras de aviso (F6.2): quando o aviso sobe para o síndico e para o substituto, e os
-- outros avisos. O substituto é uma pessoa autorizada com vínculo ativo, ou ninguém.
create function plataforma_definir_avisos(p_pessoa uuid, p_condominio uuid, p_versao integer, p_sindico_horas integer,
                                          p_substituto_horas integer, p_substituto uuid, p_sem_responsavel_horas integer,
                                          p_pendencia_dias integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_sindico_horas is null or p_sindico_horas not between 1 and 240 then perform recusar_campos('De 1 a 240 horas', 'sindicoHoras'); end if;
  if p_substituto_horas is null or p_substituto_horas not between 1 and 240 then perform recusar_campos('De 1 a 240 horas', 'substitutoHoras'); end if;
  if p_substituto_horas <= p_sindico_horas then
    perform recusar_campos('O substituto é avisado depois do síndico', 'substitutoHoras');
  end if;
  if p_sem_responsavel_horas is null or p_sem_responsavel_horas not between 1 and 240 then
    perform recusar_campos('De 1 a 240 horas', 'semResponsavelHoras');
  end if;
  if p_pendencia_dias is null or p_pendencia_dias not between 1 and 60 then perform recusar_campos('De 1 a 60 dias', 'pendenciaDias'); end if;
  if p_substituto is not null and not exists (select 1 from vinculos where id = p_substituto and funcao = 'AUTORIZADO' and revogado_em is null) then
    perform recusar_campos('Escolha uma pessoa autorizada', 'substitutoId');
  end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio
     set aviso_sindico_horas = p_sindico_horas, aviso_substituto_horas = p_substituto_horas, aviso_substituto = p_substituto,
         aviso_sem_responsavel_horas = p_sem_responsavel_horas, aviso_pendencia_dias = p_pendencia_dias
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('regras_aviso.alteradas', 'configuracao_condominio', v_antes.id::text, jsonb_build_object(
    'sindico_horas', p_sindico_horas, 'substituto_horas', p_substituto_horas, 'com_substituto', p_substituto is not null,
    'sem_responsavel_horas', p_sem_responsavel_horas, 'pendencia_dias', p_pendencia_dias));
  return v_versao;
end $$;

-- Os avisos da pessoa nos últimos 30 dias. Pedido privado que ela não vê aparece sem assunto.
create function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'tipo', a.tipo, 'pedidoId', p.id, 'protocolo', p.protocolo,
               'assunto', case when pedido_visivel(p_pessoa, p) then p.assunto end,
               'responsavel', nome_do_vinculo(p.responsavel_id),
               'referencia', a.referencia, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
             order by a.visto_em is not null, a.criado_em desc)
        from avisos a join pedidos p on p.id = a.pedido_id
       where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null));
end $$;

-- Marcar avisos como vistos: os escolhidos ou todos. Não resolve nenhum pedido.
create function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  update avisos set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- O aviso no pedido (AT-08, AT-09): desde quando o retorno está vencido, quem já foi
-- avisado e quando o próximo nível será avisado se nada mudar.
create function plataforma_pedido_prazo(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_cfg configuracao_condominio;
  v_resp uuid;
  v_proximo jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if not retorno_vencido(v) then return jsonb_build_object('vencido', false); end if;
  select * into v_cfg from configuracao_condominio;
  v_resp := pessoa_do_vinculo(v.responsavel_id);
  if not exists (select 1 from avisos where pedido_id = v.id and referencia = v.proximo_retorno and tipo = 'ESCALADO_SINDICO')
     and v_resp is not null then
    v_proximo := jsonb_build_object('tipo', 'ESCALADO_SINDICO', 'em', vencimento_do_prazo(p_condominio, v.proximo_retorno, v_cfg.aviso_sindico_horas));
  elsif pessoa_do_vinculo(v_cfg.aviso_substituto) is not null
     and not exists (select 1 from avisos where pedido_id = v.id and referencia = v.proximo_retorno and tipo = 'ESCALADO_SUBSTITUTO') then
    v_proximo := jsonb_build_object('tipo', 'ESCALADO_SUBSTITUTO', 'em', vencimento_do_prazo(p_condominio, v.proximo_retorno, v_cfg.aviso_substituto_horas));
  end if;
  return jsonb_build_object(
    'vencido', true,
    'desde', v.proximo_retorno,
    'horas', horas_atendimento_entre(p_condominio, v.proximo_retorno, app_now()),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'em', x.em, 'nomes', x.nomes) order by x.em)
        from (select a.tipo, min(a.criado_em) as em, jsonb_agg(distinct p.nome) as nomes
                from avisos a join pessoas p on p.id = a.pessoa_id
               where a.pedido_id = v.id and a.referencia = v.proximo_retorno
                 and a.tipo in ('RETORNO_VENCIDO', 'ESCALADO_SINDICO', 'ESCALADO_SUBSTITUTO')
               group by a.tipo) x), '[]'::jsonb),
    'proximo', v_proximo);
end $$;

-- Indicadores do atendimento (F7.2): este mês, o mês passado ou os últimos 3 meses, com a
-- porcentagem do período anterior de mesmo tamanho para comparar.
create function plataforma_indicadores(p_pessoa uuid, p_condominio uuid, p_periodo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date;
  v_mes date;
  v_de date;
  v_ate date;
  v_meses integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v_hoje := hoje_no_condominio();
  v_mes := date_trunc('month', v_hoje)::date;
  case coalesce(p_periodo, 'ESTE_MES')
    when 'ESTE_MES' then v_de := v_mes; v_ate := v_hoje; v_meses := 1;
    when 'MES_PASSADO' then v_de := (v_mes - interval '1 month')::date; v_ate := v_mes - 1; v_meses := 1;
    when 'TRES_MESES' then v_de := (v_mes - interval '2 months')::date; v_ate := v_hoje; v_meses := 3;
    else perform recusar_campos('Período desconhecido', 'periodo');
  end case;
  return jsonb_build_object(
    'periodo', coalesce(p_periodo, 'ESTE_MES'),
    'atual', indicadores_atendimento(v_de, v_ate),
    'porcentagemAnterior', indicadores_atendimento((v_de - make_interval(months => v_meses))::date, v_de - 1) -> 'retornos' -> 'porcentagem');
end $$;

-- ---------------------------------------------------------------------------------------
-- Agenda do verificador: a cada 5 minutos, pelo pg_cron do Supabase. Onde o pg_cron não
-- existe (o banco dos testes), a conferência é chamada direto.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-prazos', '*/5 * * * *', 'select public.verificar_prazos()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_prazos() de outro jeito (%).', sqlerrm;
end $$;

call fechar_acesso();

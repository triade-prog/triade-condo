-- 0309 · Painel do Comercial, janelas do condomínio e o cartão do Comercial no Início do Console
-- (R17.5; IDEIAS CM-10, CM-18 e o resto da CM-04; plano em comercial/r17-5/plano-0309.md; quadros
-- 334 (painel, pag332 do gerador), 335 (cartão no Início) e 336 (estados), aprovados em 24/10/2026).
--
-- Decisões já tomadas (plano):
-- K.1  Previsão de MRR = valor × chance da etapa (parametros_etapa_comercial, 0296). Meta interna de
--      primeiro retorno em 1 hora útil, contada no painel; a promessa do site (até o fim do próximo
--      dia útil) continua e também é contada.
-- 1.   Meta mensal de novo MRR, total e por pessoa, que só a Administração muda
--      (console.comercial.meta, ação nova).
-- 2.   O painel só lê; grava só a meta. Os números saem do funil (0296), das propostas (0304), dos
--      contratos e clientes (0308) e da Tabela de preços (0295, as vagas de fundador).
-- 3.   Janelas (CM-18): assembleia ordinária (aviso de 60 a 30 dias antes, para entrar no
--      orçamento), fim do mandato do síndico e fim da fidelidade do sistema atual (janela de troca).
--      As datas já estão na ficha do prédio (0296: assembleia_ordinaria, mandato_ate, fidelidade_ate);
--      nenhum campo novo foi preciso. O interessado Perdido volta a ser lembrado quando o síndico
--      troca: é por evento (alguém da equipe registra o síndico novo), não pelo calendário do mandato.
-- 4.   Início do Console: atrasados (próximo passo vencido), primeiro retorno fora da meta de 1 hora
--      útil, parados e as janelas que se aproximam. As renovações (CM-30) ainda não existem: ficam
--      para a R17.7.
-- 5.   LGPD: o painel só mostra números; o nome do condomínio aparece só nas propostas vencendo (a
--      lista de propostas já mostra) e o cartão do Início, como o Meu dia, mostra condomínio, etapa e
--      responsável, nunca a pessoa de contato.
--
-- Decisões desta rodada, onde o plano não dizia:
-- a. O MRR de um interessado é a mensalidade da versão aceita da proposta ou, sem aceite, da última
--    versão em andamento (rascunho, aguardando aprovação, pronta ou enviada dentro da validade) que
--    tem valor; no anual, o valor do ano dividido por 12. Sem proposta, conta como "sem valor".
-- b. O mês do painel é o do horário de Brasília. Os novos são os que entraram no mês; o funil e a
--    conversão por origem são desses novos ("até onde cada um chegou", contando a etapa mais alta a
--    que chegaram, mesmo que depois tenham sido perdidos). Ganhos, perdas, sem resposta, atividades
--    e o novo MRR são do que aconteceu no mês. Previsão, abertos por etapa, parados, propostas
--    vencendo e vagas de fundador são de agora, qualquer que seja o mês escolhido.
-- c. Ganho do mês = mudou para Ganho no mês e continua em Ganho. O novo MRR por pessoa vai para o
--    responsável do interessado. O ciclo médio é do primeiro contato (entrada) ao Ganho, em dias.
-- d. Atividades = conversas registradas por alguém da equipe, sem a entrada e sem a nota interna.
-- e. Contra cada concorrente: os interessados fechados (Ganho ou Perdido) até o fim do mês que
--    tinham o concorrente na disputa, cada interessado uma vez (o nome escrito de dois jeitos junta);
--    "ganhamos" é Ganho; "perdemos para ele" é o vencedor marcado num Perdido (perdido, reaberto e
--    ganho não conta contra).
-- f. A meta vale do mês em que foi posta em diante, até alguém pôr outra ("herdada" nos meses
--    seguintes). Só se muda a meta do mês atual ou dos 12 seguintes: o resultado de um mês que já
--    passou não ganha meta nova (META_MES_PASSADO).
-- g. Janela do mandato e da fidelidade: abre 60 dias antes da data e fecha na data. Os dias ficam em
--    configuracoes, como os outros parâmetros. Interessado aberto tem as três janelas; Perdido ou Sem
--    resposta tem a fidelidade (a janela de troca), o "voltar a falar em" que a equipe marcou e o
--    síndico novo. Quem virou cliente, foi anonimizado ou está no não contatar não é lembrado.
-- h. "Tratar" uma janela tira o aviso daquela data (a janela da mesma data não volta); mudar a data
--    na ficha abre uma janela nova. O síndico novo vira uma nota nas conversas, pode trazer o fim do
--    mandato novo e, no Perdido ou Sem resposta, um aviso até alguém tratar ou reabrir.
-- i. O cartão do Início é da equipe toda (quem tem o Comercial ou a Administração), com o que é da
--    pessoa primeiro dentro de cada motivo; mostra até comercial_inicio_max (8) linhas e o total.
-- j. As tabelas novas (metas e janelas) não guardam dado de pessoa: nada entra no catálogo de
--    retenção, e a anonimização não precisa mexer nelas.
--
-- Revisão do dfff721 (antes de aplicar):
-- k. Meta de 1 hora útil (K.1) medida em minutos úteis da entrada à primeira resposta. A cotação tem
--    prazo próprio de 24 horas: fica fora da meta e conta à parte (cotacoes). Total, mediana e prazo
--    só de quem tem prazo de primeiro retorno; quem ainda não foi respondido e está dentro do prazo
--    fica em "aguardando", fora do total (na meta, na cotação e na promessa do site).
-- l. O Início não mostra quem está no não contatar, por motivo nenhum (LGPD).
-- m. Desempenho: com 10 mil interessados, o Início e o painel levavam de 2 a 22 segundos. A regra de
--    leitura das tabelas do Comercial passa a avaliar o contexto uma vez por consulta, a tarefa e as
--    janelas recebem o que já foi lido, os fechados sem data de janela nem entram, os minutos úteis
--    saem sem laço e as conversas, as etapas e os interessados ganham índice pela data. Teste de
--    carga em 055.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê e os parâmetros.

insert into funcao_acoes (funcao, acao) values ('ADMINISTRACAO', 'console.comercial.meta');

insert into configuracoes (chave, valor, descricao) values
  ('comercial_janela_assembleia_de_dias', '60', 'Dias antes da assembleia ordinária em que o aviso do Comercial começa (CM-18, entrar no orçamento)'),
  ('comercial_janela_assembleia_ate_dias', '30', 'Dias antes da assembleia ordinária em que o aviso do Comercial termina'),
  ('comercial_janela_mandato_dias', '60', 'Dias antes do fim do mandato do síndico em que o aviso do Comercial começa'),
  ('comercial_janela_fidelidade_dias', '60', 'Dias antes do fim da fidelidade do sistema atual em que a janela de troca abre'),
  ('comercial_propostas_vencendo_dias', '7', 'Dias à frente em que o painel comercial mostra as propostas vencendo'),
  ('comercial_inicio_max', '8', 'Interessados que o cartão do Comercial no Início do Console mostra');

-- A regra de leitura das tabelas do Comercial (0296) chamava as funções do contexto para cada linha;
-- com milhares de interessados, só isso levava segundos. Em subconsulta, o Postgres as avalia uma vez
-- por consulta. A regra é a mesma; a escrita (with check) não muda.
create or replace procedure proteger_tabela_comercial(p_tabela regclass, p_escrita text, p_motivo text)
language plpgsql
set search_path = public
as $$
begin
  execute format('alter table %s enable row level security', p_tabela);
  execute format('alter table %s force row level security', p_tabela);
  if not exists (select 1 from pg_policy where polrelid = p_tabela and polname = 'so_comercial') then
    execute format('create policy so_comercial on %s using ((select comercial_sistema()) or ((select contexto_equipe()) and (select pode_global(''console.comercial.ver'')))) '
                   'with check (comercial_sistema() or (contexto_equipe() and pode_global(%L)))', p_tabela, p_escrita);
  end if;
  if exists (select 1 from pg_attribute where attrelid = p_tabela and attname = 'versao' and not attisdropped)
     and not exists (select 1 from pg_trigger where tgrelid = p_tabela and tgname = 'controle_versao') then
    execute format('create trigger controle_versao before update on %s for each row execute function controle_versao()', p_tabela);
  end if;
  insert into tabelas_sem_condominio (tabela, motivo) values (p_tabela::text, p_motivo)
  on conflict (tabela) do update set motivo = excluded.motivo;
end $$;

do $$
declare r record;
begin
  for r in select polrelid::regclass as tabela from pg_policy where polname = 'so_comercial' loop
    execute format('alter policy so_comercial on %s using ((select comercial_sistema()) or ((select contexto_equipe()) and (select pode_global(''console.comercial.ver''))))', r.tabela);
  end loop;
end $$;

-- A tarefa da vez (0296) sem consulta dentro: quem lê muitos interessados (o Início e o painel) passa
-- o limite da etapa e os passos da cadência já lidos. Só para interessado aberto e não anonimizado.
-- A comercial_tarefa continua igual e passa a chamar esta.
create function comercial_tarefa_de(i interessados, p_lim integer, p_passos jsonb, p_agora timestamptz) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_hoje   date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz;
  v_tipo   text;
  v_texto  text;
  v_canal  text;
  v_c      timestamptz;
  v_passo  jsonb;
  v_ref    timestamptz;
  v_parado integer;
begin
  if i.primeira_resposta_em is null and i.primeiro_retorno_ate is not null then
    v_quando := i.primeiro_retorno_ate; v_tipo := 'PRIMEIRO_RETORNO'; v_texto := 'Primeiro retorno';
  end if;
  if i.proximo_passo is not null then
    v_c := (i.proximo_passo_data + coalesce(i.proximo_passo_hora, time '23:59:59')) at time zone 'America/Sao_Paulo';
    if v_quando is null or v_c < v_quando then v_quando := v_c; v_tipo := 'PROXIMO_PASSO'; v_texto := i.proximo_passo; v_canal := null; end if;
  end if;
  if i.cadencia_id is not null and i.cadencia_fim_em is null then
    v_passo := p_passos -> i.cadencia_feitos;
    if v_passo is not null then
      v_c := ((i.cadencia_inicio + (v_passo ->> 'dia')::integer) + time '23:59:59') at time zone 'America/Sao_Paulo';
      if v_quando is null or v_c < v_quando then
        v_quando := v_c; v_tipo := 'CADENCIA'; v_texto := v_passo ->> 'texto'; v_canal := v_passo ->> 'canal';
      end if;
    end if;
  end if;
  v_ref := coalesce(i.ultima_conversa_em, i.criado_em);
  if p_lim is not null and p_agora - v_ref > make_interval(days => p_lim) then
    v_parado := v_hoje - (v_ref at time zone 'America/Sao_Paulo')::date;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'situacao', case when v_quando is null then 'SEM_PASSO'
                     when v_quando < p_agora then 'ATRASADO'
                     when (v_quando at time zone 'America/Sao_Paulo')::date = v_hoje then 'HOJE'
                     else 'FUTURO' end,
    'tarefa', v_tipo,
    'texto', v_texto,
    'canal', v_canal,
    'quando', v_quando,
    'passo', case when v_tipo = 'CADENCIA' then i.cadencia_feitos + 1 end,
    'passos', case when v_tipo = 'CADENCIA' then jsonb_array_length(p_passos) end,
    'diasParado', v_parado));
end $$;

create or replace function comercial_tarefa(i interessados) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_aberta boolean;
  v_lim    integer;
  v_passos jsonb;
begin
  select aberta, limite_dias into v_aberta, v_lim from parametros_etapa_comercial where etapa = i.etapa;
  if not coalesce(v_aberta, false) or i.anonimizado_em is not null then
    return jsonb_build_object('situacao', 'FECHADO');
  end if;
  if i.cadencia_id is not null and i.cadencia_fim_em is null then
    select passos into v_passos from cadencias_comercial where id = i.cadencia_id;
  end if;
  return comercial_tarefa_de(i, v_lim, v_passos, app_now());
end $$;

-- O histórico das metas e das janelas é do Comercial, como o dos interessados.
alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial', 'proposta', 'resposta_comercial',
                                                                'referencia_comercial', 'fato_comparativo', 'modelo_contrato',
                                                                'documento_aceite', 'contrato_comercial', 'piloto_comercial', 'troca_sistema',
                                                                'meta_comercial')
             and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- Meta mensal de novo MRR (CM-10): total e por pessoa. Uma linha por mês; vale até a próxima.

create function metas_por_pessoa_validas(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 30
     and not exists (
       select 1 from jsonb_array_elements(p) x
        where jsonb_typeof(x) <> 'object'
           or exists (select 1 from jsonb_object_keys(x) k where k not in ('pessoaId', 'centavos'))
           or coalesce(x ->> 'pessoaId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or coalesce(x ->> 'centavos', '') !~ '^[1-9][0-9]{0,10}$')
     and (select count(*) from jsonb_array_elements(p)) = (select count(distinct x ->> 'pessoaId') from jsonb_array_elements(p) x)
$$;

create table metas_comercial (
  id             uuid primary key default gen_random_uuid(),
  mes            date not null unique check (extract(day from mes) = 1),
  total_centavos centavos not null check (total_centavos > 0 and total_centavos <= 100000000000),
  por_pessoa     jsonb not null default '[]' check (metas_por_pessoa_validas(por_pessoa)),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1
);
call proteger_tabela_comercial('metas_comercial', 'console.comercial.meta',
  'Meta mensal de novo MRR do Comercial, total e por pessoa; só a Administração muda (CM-10)');
create trigger metas_comercial_sem_exclusao before delete on metas_comercial for each row execute function somente_insercao();

create function metas_comercial_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.mes, new.criado_em, new.criado_por) is distinct from (old.id, old.mes, old.criado_em, old.criado_por) then
    raise exception 'A meta não muda de mês' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger metas_comercial_fixas before update on metas_comercial for each row execute function metas_comercial_fixas();

-- ---------------------------------------------------------------------------------------
-- Janelas do condomínio (CM-18). As de calendário saem das datas da ficha e só ganham linha
-- quando alguém trata o aviso; o síndico novo é um evento e nasce aqui, até alguém tratar.

create table janelas_comercial (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  tipo           text not null check (tipo in ('ASSEMBLEIA', 'MANDATO', 'FIDELIDADE', 'RETOMAR', 'SINDICO_NOVO')),
  data_ref       date not null,
  tratada_em     timestamptz,
  tratada_por    uuid references pessoas (id),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  unique (interessado_id, tipo, data_ref),
  check (tipo = 'SINDICO_NOVO' or tratada_em is not null),
  check (tratada_em is not null or tratada_por is null)
);
call proteger_tabela_comercial('janelas_comercial', 'console.comercial.editar',
  'Janelas do condomínio no Comercial (assembleia, mandato, fidelidade, voltar a falar e síndico novo); só datas, sem dado de pessoa (CM-18)');
create trigger janelas_comercial_sem_exclusao before delete on janelas_comercial for each row execute function somente_insercao();

-- Só se trata o aviso, uma vez; nada mais muda.
create function janelas_comercial_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.tratada_em is not null or new.tratada_em is null
     or (new.id, new.interessado_id, new.tipo, new.data_ref, new.criado_em, new.criado_por)
        is distinct from (old.id, old.interessado_id, old.tipo, old.data_ref, old.criado_em, old.criado_por) then
    raise exception 'A janela só muda para tratada' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger janelas_comercial_fixas before update on janelas_comercial for each row execute function janelas_comercial_fixas();

-- ---------------------------------------------------------------------------------------
-- Índices para o painel e o Início lerem por mês e por etapa sem varrer as tabelas.

create index conversas_comercial_criado_em on conversas_comercial (criado_em);
create index etapas_interessado_para on etapas_interessado (para, criado_em);
create index interessados_criado_em on interessados (criado_em);
create index nao_contatar_cnpj on nao_contatar (cnpj) where cnpj is not null;

-- ---------------------------------------------------------------------------------------
-- Ajudantes do painel.

-- Minutos úteis entre dois instantes (K.1): de segunda a sexta, das 9h às 18h de Brasília, como
-- comercial_hora_util. Feriado não entra na conta. Sem laço (o painel chama para cada novo do
-- mês): os minutos úteis desde uma segunda-feira de referência (01/01/2001) até cada instante, e a
-- diferença.
create function comercial_minutos_uteis(p_de timestamptz, p_ate timestamptz) returns integer
language plpgsql stable
set search_path = public
as $$
declare
  a timestamp;
  b timestamp;
  m numeric[];
  d date;
  t timestamp;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then return 0; end if;
  a := p_de at time zone 'America/Sao_Paulo';
  b := p_ate at time zone 'America/Sao_Paulo';
  foreach t in array array[a, b] loop
    d := t::date;
    m := m || (((d - date '2001-01-01') / 7 * 5 + least((d - date '2001-01-01') % 7, 5)) * 540
               + case when extract(isodow from d) < 6 then least(greatest(extract(epoch from t::time - time '09:00') / 60, 0), 540) else 0 end);
  end loop;
  return round(m[2] - m[1])::integer;
end $$;

-- A promessa do site (CM-04): até o fim do próximo dia útil depois da entrada, em Brasília.
create function comercial_promessa_site(p_de timestamptz) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare d date := (p_de at time zone 'America/Sao_Paulo')::date + 1;
begin
  while extract(isodow from d) >= 6 loop d := d + 1; end loop;
  return (d + 1)::timestamp at time zone 'America/Sao_Paulo';
end $$;

-- O MRR do interessado (decisão a): a versão aceita ou, sem aceite, a última em andamento com
-- valor; no anual, o ano dividido por 12.
create function comercial_mrr(p_interessado uuid) returns bigint
language sql stable
set search_path = public
as $$
  select case when v.ciclo = 'ANUAL' and v.anual_centavos is not null then round(v.anual_centavos / 12.0)::bigint else v.mensal_centavos::bigint end
    from propostas_comercial p join versoes_proposta v on v.proposta_id = p.id
   where p.interessado_id = p_interessado and v.mensal_centavos is not null
     and (v.situacao = 'ACEITA' or (v.situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA') and proposta_situacao(v) <> 'VENCIDA'))
   order by (v.situacao = 'ACEITA') desc, v.numero desc
   limit 1
$$;

-- "2026-10" a partir do primeiro dia do mês.
create function comercial_mes_texto(p date) returns text
language sql immutable
set search_path = public
as $$ select to_char(p, 'YYYY-MM') $$;

-- A meta que vale no mês: a do próprio mês ou a última antes dele (herdada).
create function comercial_meta_do_mes(p_mes date) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'mes', comercial_mes_texto(m.mes), 'herdada', m.mes <> p_mes, 'versao', case when m.mes = p_mes then m.versao end,
    'total', m.total_centavos,
    'porPessoa', coalesce((select jsonb_agg(jsonb_build_object('pessoa', jsonb_build_object('id', x ->> 'pessoaId', 'nome', comercial_nome((x ->> 'pessoaId')::uuid)),
                                                                'centavos', (x ->> 'centavos')::bigint)
                                            order by comercial_nome((x ->> 'pessoaId')::uuid))
                             from jsonb_array_elements(m.por_pessoa) x), '[]'::jsonb),
    'alteradoEm', coalesce(m.alterado_em, m.criado_em),
    'alteradoPor', (select jsonb_build_object('id', p.id, 'nome', p.nome) from pessoas p where p.id = coalesce(m.alterado_por, m.criado_por))))
    from metas_comercial m
   where m.mes <= p_mes
   order by m.mes desc
   limit 1
$$;

-- ---------------------------------------------------------------------------------------
-- O painel comercial (CM-10, quadro 334). Só lê.

create function comercial_painel(p_pessoa uuid, p_mes date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje  date := comercial_hoje();
  v_mes   date := date_trunc('month', coalesce(p_mes, v_hoje))::date;
  v_ini   timestamptz := v_mes::timestamp at time zone 'America/Sao_Paulo';
  v_fim   timestamptz := (v_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  v_agora timestamptz := app_now();
  v_vencendo integer := configuracao_int('comercial_propostas_vencendo_dias');
  v_meta  jsonb;
  v_mesj  jsonb;
  v_agoraj jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  v_meta := comercial_meta_do_mes(v_mes);

  -- O que aconteceu no mês (decisões b a e).
  with coorte as materialized (
    select i.id, i.origem, i.criado_em, i.primeiro_retorno_ate, i.primeira_resposta_em,
           greatest(
             coalesce((select max(p.ordem) from etapas_interessado e join parametros_etapa_comercial p on p.etapa = e.para
                        where e.interessado_id = i.id and p.ordem <= 8), 0),
             coalesce((select p.ordem from parametros_etapa_comercial p where p.etapa = i.etapa and p.ordem <= 8), 0)) as chegou
      from interessados i
     where i.criado_em >= v_ini and i.criado_em < v_fim
  ),
  ganhos as materialized (
    select i.id, i.responsavel_id, i.criado_em, max(e.criado_em) as em, comercial_mrr(i.id) as mrr
      from etapas_interessado e join interessados i on i.id = e.interessado_id
     where e.para = 'GANHO' and e.criado_em >= v_ini and e.criado_em < v_fim and i.etapa = 'GANHO'
     group by i.id
  ),
  perdas as materialized (
    select distinct on (e.interessado_id) e.interessado_id, coalesce(e.motivo_perda, i.motivo_perda, 'OUTRO') as motivo
      from etapas_interessado e join interessados i on i.id = e.interessado_id
     where e.para = 'PERDIDO' and e.criado_em >= v_ini and e.criado_em < v_fim
     order by e.interessado_id, e.criado_em desc
  ),
  atividades as (
    select c.criado_por as pessoa, count(*)::integer as n
      from conversas_comercial c
     where c.criado_em >= v_ini and c.criado_em < v_fim and c.criado_por is not null and c.canal not in ('ENTRADA', 'NOTA')
     group by c.criado_por
  ),
  mrr_pessoa as (
    select g.responsavel_id as pessoa, coalesce(sum(g.mrr), 0)::bigint as v, count(*)::integer as ganhos
      from ganhos g where g.responsavel_id is not null group by g.responsavel_id
  ),
  meta_pessoa as (
    select (x -> 'pessoa' ->> 'id')::uuid as pessoa, (x ->> 'centavos')::bigint as c
      from jsonb_array_elements(coalesce(v_meta -> 'porPessoa', '[]'::jsonb)) x
  ),
  gente as (
    select pessoa from atividades union select pessoa from mrr_pessoa union select pessoa from meta_pessoa
  ),
  -- Um concorrente por interessado (o mesmo nome escrito de dois jeitos conta uma vez). "Perdemos
  -- para ele" só no Perdido: quem foi perdido, reaberto e ganho não conta contra a TRÍADE.
  disputas as materialized (
    select i.id, comercial_normalizar(x ->> 'nome') as chave, min(btrim(x ->> 'nome')) as nome, i.etapa,
           i.etapa = 'PERDIDO' and bool_or(coalesce((x ->> 'venceu')::boolean, false)) as venceu
      from interessados i, jsonb_array_elements(i.concorrentes) x
     where i.etapa in ('GANHO', 'PERDIDO') and i.etapa_desde < v_fim and comercial_normalizar(x ->> 'nome') is not null
       and i.concorrentes <> '[]'::jsonb
     group by i.id, i.etapa, comercial_normalizar(x ->> 'nome')
  )
  select jsonb_build_object(
    'novos', (select count(*)::integer from coorte),
    'funil', coalesce((select jsonb_agg(jsonb_build_object('etapa', p.etapa, 'chegaram', (select count(*)::integer from coorte c where c.chegou >= p.ordem)) order by p.ordem)
                         from parametros_etapa_comercial p where p.ordem <= 8), '[]'::jsonb),
    'porOrigem', coalesce((select jsonb_agg(jsonb_build_object('origem', o.origem, 'novos', o.novos, 'ganhos', o.ganhos) order by o.novos desc, o.origem)
                             from (select c.origem, count(*)::integer as novos, count(*) filter (where c.chegou >= 8)::integer as ganhos
                                     from coorte c group by c.origem) o), '[]'::jsonb),
    -- K.1: a meta interna de 1 hora útil, medida da entrada à primeira resposta. A cotação tem prazo
    -- próprio (24 horas) e fica fora da meta, contada à parte. Quem ainda não foi respondido e está
    -- dentro do prazo fica em "aguardando", fora do total.
    'primeiroRetorno', (select jsonb_strip_nulls(jsonb_build_object(
        'total', count(*) filter (where c.k1 and (c.primeira_resposta_em is not null or c.min_ate_agora > 60))::integer,
        'noPrazo', count(*) filter (where c.k1 and c.min_resposta <= 60)::integer,
        'foraDoPrazo', count(*) filter (where c.k1 and (c.min_resposta > 60 or (c.primeira_resposta_em is null and c.min_ate_agora > 60)))::integer,
        'aguardando', count(*) filter (where c.k1 and c.primeira_resposta_em is null and c.min_ate_agora <= 60)::integer,
        'medianaMinutosUteis', round((percentile_cont(0.5) within group (order by c.min_resposta::double precision)
                                        filter (where c.k1 and c.primeira_resposta_em is not null))::numeric),
        'cotacoes', jsonb_build_object(
          'total', count(*) filter (where c.origem = 'COTACAO' and c.primeiro_retorno_ate is not null
                                      and (c.primeira_resposta_em is not null or c.primeiro_retorno_ate < v_agora))::integer,
          'noPrazo', count(*) filter (where c.origem = 'COTACAO' and c.primeira_resposta_em <= c.primeiro_retorno_ate)::integer,
          'aguardando', count(*) filter (where c.origem = 'COTACAO' and c.primeira_resposta_em is null and c.primeiro_retorno_ate >= v_agora)::integer),
        'site', jsonb_build_object(
          'total', count(*) filter (where c.origem = 'SITE' and c.primeiro_retorno_ate is not null
                                      and (c.primeira_resposta_em is not null or c.promessa < v_agora))::integer,
          'noPrazo', count(*) filter (where c.origem = 'SITE' and c.primeiro_retorno_ate is not null and c.primeira_resposta_em < c.promessa)::integer,
          'aguardando', count(*) filter (where c.origem = 'SITE' and c.primeiro_retorno_ate is not null and c.primeira_resposta_em is null
                                           and c.promessa >= v_agora)::integer)))
      from (select c.*, c.primeiro_retorno_ate is not null and c.origem is distinct from 'COTACAO' as k1,
                   case when c.primeira_resposta_em is not null then comercial_minutos_uteis(c.criado_em, c.primeira_resposta_em) end as min_resposta,
                   case when c.primeira_resposta_em is null then comercial_minutos_uteis(c.criado_em, v_agora) end as min_ate_agora,
                   case when c.origem = 'SITE' then comercial_promessa_site(c.criado_em) end as promessa
              from coorte c) c),
    'ganhos', (select jsonb_strip_nulls(jsonb_build_object(
        'quantos', count(*)::integer, 'novoMrr', coalesce(sum(g.mrr), 0)::bigint, 'semValor', count(*) filter (where g.mrr is null)::integer,
        'cicloMedioDias', round(avg(extract(epoch from g.em - g.criado_em) / 86400)::numeric)))
      from ganhos g),
    'perdas', jsonb_build_object(
      'quantos', (select count(*)::integer from perdas),
      'motivos', coalesce((select jsonb_agg(jsonb_build_object('motivo', m.motivo, 'quantos', m.n) order by m.n desc, m.motivo)
                             from (select motivo, count(*)::integer as n from perdas group by motivo) m), '[]'::jsonb)),
    'semResposta', (select count(distinct e.interessado_id)::integer from etapas_interessado e
                     where e.para = 'SEM_RESPOSTA' and e.criado_em >= v_ini and e.criado_em < v_fim),
    'porPessoa', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                             'pessoa', jsonb_build_object('id', g.pessoa, 'nome', comercial_nome(g.pessoa)),
                             'atividades', coalesce(a.n, 0), 'ganhos', coalesce(m.ganhos, 0), 'novoMrr', coalesce(m.v, 0), 'meta', mp.c))
                             order by comercial_nome(g.pessoa))
                             from gente g left join atividades a on a.pessoa = g.pessoa left join mrr_pessoa m on m.pessoa = g.pessoa
                             left join meta_pessoa mp on mp.pessoa = g.pessoa), '[]'::jsonb),
    'concorrentes', coalesce((select jsonb_agg(jsonb_build_object('nome', s.nome, 'disputas', s.d, 'ganhamos', s.g, 'perdemosParaEle', s.pe) order by s.d desc, s.nome)
                                from (select min(nome) as nome, count(distinct id)::integer as d,
                                             count(distinct id) filter (where etapa = 'GANHO')::integer as g,
                                             count(distinct id) filter (where venceu)::integer as pe
                                        from disputas group by chave) s), '[]'::jsonb))
  into v_mesj;

  -- O que está assim agora (decisão b).
  with abertos as materialized (
    select i.id, i.etapa, comercial_tarefa_de(i, p.limite_dias, cd.passos, v_agora) as t, p.probabilidade, m.mrr
      from interessados i join parametros_etapa_comercial p on p.etapa = i.etapa
      left join cadencias_comercial cd on cd.id = i.cadencia_id and i.cadencia_fim_em is null
      -- o mesmo que comercial_mrr(i.id), sem uma chamada por linha
      left join lateral (
        select case when v.ciclo = 'ANUAL' and v.anual_centavos is not null then round(v.anual_centavos / 12.0)::bigint else v.mensal_centavos::bigint end as mrr
          from propostas_comercial pr join versoes_proposta v on v.proposta_id = pr.id
         where pr.interessado_id = i.id and v.mensal_centavos is not null
           and (v.situacao = 'ACEITA' or (v.situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA')
                                          and not (v.situacao = 'ENVIADA' and v.valido_ate < v_hoje)))
         order by (v.situacao = 'ACEITA') desc, v.numero desc
         limit 1) m on true
     where i.anonimizado_em is null and p.aberta
  )
  select jsonb_build_object(
    'abertos', (select count(*)::integer from abertos),
    'porEtapa', coalesce((select jsonb_agg(jsonb_build_object('etapa', p.etapa, 'quantos', (select count(*)::integer from abertos a where a.etapa = p.etapa),
                                                              'probabilidade', p.probabilidade) order by p.ordem)
                            from parametros_etapa_comercial p where p.aberta), '[]'::jsonb),
    'previsao', (select jsonb_build_object('centavos', coalesce(round(sum(a.mrr * a.probabilidade / 100.0)), 0)::bigint,
                                           'comValor', count(*) filter (where a.mrr is not null)::integer,
                                           'semValor', count(*) filter (where a.mrr is null)::integer)
                   from abertos a),
    'parados', (select count(*)::integer from abertos a where a.t ? 'diasParado'),
    'atrasados', (select count(*)::integer from abertos a where a.t ->> 'situacao' = 'ATRASADO'),
    'propostasVencendo', coalesce((select jsonb_agg(jsonb_build_object('propostaId', p.id, 'interessadoId', i.id, 'condominio', v.condominio, 'numero', v.numero,
                                                                       'validoAte', v.valido_ate) order by v.valido_ate, v.condominio)
                                     from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id join interessados i on i.id = p.interessado_id
                                    where v.situacao = 'ENVIADA' and v.valido_ate between v_hoje and v_hoje + v_vencendo
                                      and i.anonimizado_em is null and comercial_aberta(i.etapa)), '[]'::jsonb),
    'vencendoDias', v_vencendo,
    'vagasFundador', vagas_fundador_json())
  into v_agoraj;

  return jsonb_strip_nulls(jsonb_build_object(
    'mes', comercial_mes_texto(v_mes),
    'mesAtual', v_mes = date_trunc('month', v_hoje)::date,
    'meta', v_meta,
    'podeMudarMeta', pode_global('console.comercial.meta') and v_mes >= date_trunc('month', v_hoje)::date,
    'equipe', comercial_equipe_json())
    || v_mesj || jsonb_build_object('agora', v_agoraj));
end $$;

-- Mudar a meta do mês (só a Administração). Sem linha no mês, a versão vem nula e cria uma.
create function comercial_salvar_meta(p_pessoa uuid, p_mes date, p_versao integer, p_total bigint, p_por_pessoa jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := comercial_hoje();
  v_mes  date := date_trunc('month', p_mes)::date;
  v_por  jsonb := coalesce(p_por_pessoa, '[]'::jsonb);
  m      metas_comercial;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.meta');
  if v_mes is null then perform recusar_campos('Escolha o mês', 'mes'); end if;
  if v_mes < date_trunc('month', v_hoje)::date then
    perform recusar_motivo('A meta de um mês que já passou não muda', 'META_MES_PASSADO');
  end if;
  if v_mes > (date_trunc('month', v_hoje) + interval '12 months')::date then perform recusar_campos('Escolha um mês dos próximos 12', 'mes'); end if;
  if p_total is null or p_total <= 0 or p_total > 100000000000 then perform recusar_campos('Informe a meta do mês', 'total'); end if;
  if not metas_por_pessoa_validas(v_por) then perform recusar_campos('Confira a meta de cada pessoa', 'porPessoa'); end if;
  if exists (select 1 from jsonb_array_elements(v_por) x
              where not exists (select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
                                 where e.pessoa_id = (x ->> 'pessoaId')::uuid and e.ativa and ef.retirada_em is null
                                   and ef.funcao in ('COMERCIAL', 'ADMINISTRACAO'))) then
    perform recusar_campos('A meta por pessoa é de quem está na equipe, com o Comercial ou a Administração', 'porPessoa');
  end if;
  select * into m from metas_comercial where mes = v_mes;
  if m.id is null then
    if p_versao is not null then raise exception 'Registro não encontrado' using errcode = 'TC404'; end if;
    insert into metas_comercial (mes, total_centavos, por_pessoa, criado_por) values (v_mes, p_total, v_por, p_pessoa)
    on conflict (mes) do nothing
    returning versao into v_versao;
    if v_versao is null then
      select * into m from metas_comercial where mes = v_mes;
      perform conflito_versao('metas_comercial', m.id);
    end if;
  else
    update metas_comercial set total_centavos = p_total, por_pessoa = v_por, alterado_em = app_now(), alterado_por = p_pessoa
     where id = m.id and versao = p_versao
    returning versao into v_versao;
    if v_versao is null then perform conflito_versao('metas_comercial', m.id); end if;
  end if;
  perform registrar_historico_interno('comercial.meta', 'meta_comercial', comercial_mes_texto(v_mes),
    jsonb_build_object('total', p_total, 'pessoas', jsonb_array_length(v_por)));
  return jsonb_build_object('mes', comercial_mes_texto(v_mes), 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Janelas do condomínio (CM-18).

-- Os dias das janelas, lidos uma vez: assembleia de, assembleia até, mandato e fidelidade.
create function comercial_dias_janela() returns integer[]
language sql stable
set search_path = public
as $$
  select array[configuracao_int('comercial_janela_assembleia_de_dias'), configuracao_int('comercial_janela_assembleia_ate_dias'),
               configuracao_int('comercial_janela_mandato_dias'), configuracao_int('comercial_janela_fidelidade_dias')]
$$;

-- As janelas de um interessado (decisão g), com a situação do dia. pedeAtencao: aberta, não
-- tratada e com quem se pode falar. Quem chama para muitos interessados (o Início) passa o dia,
-- os dias e o não contatar já lidos.
create function comercial_janelas_de(i interessados, p_aberto boolean, p_hoje date, p_dias integer[], p_pode boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fechado boolean := i.etapa in ('PERDIDO', 'SEM_RESPOSTA');
begin
  if i.anonimizado_em is not null or i.virou_cliente_em is not null or not (p_aberto or v_fechado) then return '[]'::jsonb; end if;
  return coalesce((
    with c (tipo, data_ref, de, ate) as (
      select 'ASSEMBLEIA', i.assembleia_ordinaria, i.assembleia_ordinaria - p_dias[1], i.assembleia_ordinaria - p_dias[2]
       where p_aberto and i.assembleia_ordinaria is not null
      union all
      select 'MANDATO', i.mandato_ate, i.mandato_ate - p_dias[3], i.mandato_ate where p_aberto and i.mandato_ate is not null
      union all
      select 'FIDELIDADE', i.fidelidade_ate, i.fidelidade_ate - p_dias[4], i.fidelidade_ate where i.fidelidade_ate is not null
      union all
      select 'RETOMAR', i.retomar_em, i.retomar_em, null::date where v_fechado and i.retomar_em is not null
      union all
      select 'SINDICO_NOVO', j.data_ref, (j.criado_em at time zone 'America/Sao_Paulo')::date, null::date
        from janelas_comercial j
       where v_fechado and j.interessado_id = i.id and j.tipo = 'SINDICO_NOVO' and j.criado_em >= i.etapa_desde
    ), s as (
      select c.*, t.tratada_em, t.tratada_por,
             case when c.de > p_hoje then 'PROXIMA' when c.ate is not null and c.ate < p_hoje then 'PASSOU' else 'ABERTA' end as situacao
        from c left join janelas_comercial t on t.interessado_id = i.id and t.tipo = c.tipo and t.data_ref = c.data_ref and t.tratada_em is not null
    )
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'tipo', s.tipo, 'data', s.data_ref, 'de', s.de, 'ate', s.ate, 'situacao', s.situacao,
             'tratada', s.tratada_em is not null, 'tratadaEm', s.tratada_em,
             'tratadaPor', case when s.tratada_por is not null then jsonb_build_object('id', s.tratada_por, 'nome', comercial_nome(s.tratada_por)) end,
             'pedeAtencao', s.situacao = 'ABERTA' and s.tratada_em is null and p_pode))
           order by s.de, s.tipo)
      from s), '[]'::jsonb);
end $$;

-- As janelas de um interessado, lendo o dia, os dias e o não contatar (a ficha e o tratar).
create function comercial_janelas(i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select comercial_janelas_de(i, comercial_aberta(i.etapa), comercial_hoje(), comercial_dias_janela(),
                              not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj))
$$;

-- As janelas na ficha do interessado.
create function comercial_janelas_ficha(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_id);
  return jsonb_strip_nulls(jsonb_build_object(
    'id', i.id, 'versao', i.versao, 'etapa', i.etapa,
    'janelas', comercial_janelas(i),
    'sindicoNovo', (select jsonb_strip_nulls(jsonb_build_object('desde', j.data_ref, 'registradoEm', j.criado_em,
                                                                'registradoPor', case when j.criado_por is not null then jsonb_build_object('id', j.criado_por, 'nome', comercial_nome(j.criado_por)) end,
                                                                'tratadaEm', j.tratada_em))
                      from janelas_comercial j where j.interessado_id = i.id and j.tipo = 'SINDICO_NOVO' order by j.criado_em desc, j.data_ref desc limit 1),
    'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
    'dias', jsonb_build_object('assembleiaDe', configuracao_int('comercial_janela_assembleia_de_dias'),
                               'assembleiaAte', configuracao_int('comercial_janela_assembleia_ate_dias'),
                               'mandato', configuracao_int('comercial_janela_mandato_dias'),
                               'fidelidade', configuracao_int('comercial_janela_fidelidade_dias')),
    'podeEditar', pode_global('console.comercial.editar') and i.anonimizado_em is null and i.virou_cliente_em is null));
end $$;

-- Síndico novo (decisão h): um evento. Fica como nota nas conversas, pode trazer o fim do mandato
-- novo e, no Perdido ou Sem resposta, vira aviso até alguém tratar ou reabrir.
create function comercial_sindico_novo(p_pessoa uuid, p_id uuid, p_versao integer, p_desde date, p_mandato_ate date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_hoje date := comercial_hoje();
  v_desde date := coalesce(p_desde, comercial_hoje());
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if i.virou_cliente_em is not null then perform recusar_motivo('Este interessado já virou cliente', 'VIROU_CLIENTE'); end if;
  if v_desde < v_hoje - 365 or v_desde > v_hoje + 90 then perform recusar_campos('A data vai de um ano atrás a 90 dias à frente', 'desde'); end if;
  if p_mandato_ate is not null and p_mandato_ate <= v_desde then perform recusar_campos('O mandato novo acaba depois do começo', 'mandatoAte'); end if;
  update interessados set mandato_ate = coalesce(p_mandato_ate, mandato_ate), alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  insert into janelas_comercial (interessado_id, tipo, data_ref, criado_por) values (p_id, 'SINDICO_NOVO', v_desde, p_pessoa)
  on conflict (interessado_id, tipo, data_ref) do nothing;
  perform comercial_inserir_conversa(p_id, 'NOTA',
    'Síndico novo desde ' || to_char(v_desde, 'DD/MM/YYYY') || coalesce(', com mandato até ' || to_char(p_mandato_ate, 'DD/MM/YYYY'), '') || '.',
    false, null, null);
  perform registrar_historico_interno('comercial.sindico_novo', 'interessado', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('desde', v_desde, 'mandatoAte', p_mandato_ate)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'lembrar', i.etapa in ('PERDIDO', 'SEM_RESPOSTA'));
end $$;

-- Tratar o aviso de uma janela (decisão h).
create function comercial_tratar_janela(p_pessoa uuid, p_id uuid, p_tipo text, p_data date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if p_tipo is null or p_tipo not in ('ASSEMBLEIA', 'MANDATO', 'FIDELIDADE', 'RETOMAR', 'SINDICO_NOVO') then perform recusar_campos('Janela inválida', 'tipo'); end if;
  if p_data is null then perform recusar_campos('Informe a data da janela', 'data'); end if;
  if exists (select 1 from janelas_comercial where interessado_id = p_id and tipo = p_tipo and data_ref = p_data and tratada_em is not null) then
    return jsonb_build_object('id', p_id, 'tipo', p_tipo, 'data', p_data, 'tratada', true);
  end if;
  if not exists (select 1 from jsonb_array_elements(comercial_janelas(i)) x
                  where x ->> 'tipo' = p_tipo and (x ->> 'data')::date = p_data and x ->> 'situacao' = 'ABERTA') then
    raise exception 'Janela não encontrada' using errcode = 'TC404';
  end if;
  if p_tipo = 'SINDICO_NOVO' then
    update janelas_comercial set tratada_em = app_now(), tratada_por = p_pessoa
     where interessado_id = p_id and tipo = p_tipo and data_ref = p_data and tratada_em is null;
  else
    insert into janelas_comercial (interessado_id, tipo, data_ref, tratada_em, tratada_por, criado_por)
    values (p_id, p_tipo, p_data, app_now(), p_pessoa, p_pessoa)
    on conflict (interessado_id, tipo, data_ref) do nothing;
  end if;
  perform registrar_historico_interno('comercial.janela_tratada', 'interessado', p_id::text, jsonb_build_object('tipo', p_tipo, 'data', p_data));
  return jsonb_build_object('id', p_id, 'tipo', p_tipo, 'data', p_data, 'tratada', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- O cartão do Comercial no Início do Console (CM-04, CM-18; quadro 335).

create function comercial_inicio(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := app_now();
  v_hoje  date := comercial_hoje();
  v_dias  integer[] := comercial_dias_janela();
  v_max   integer := configuracao_int('comercial_inicio_max');
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  -- Os candidatos numa leitura só: os abertos e, dos fechados, só os que podem ter janela (fidelidade,
  -- voltar a falar ou síndico novo sem tratar). Quem está no não contatar não aparece (LGPD).
  with cand as materialized (
    select i as r, p.aberta as aberto, p.limite_dias as lim, cd.passos
      from interessados i join parametros_etapa_comercial p on p.etapa = i.etapa
      left join cadencias_comercial cd on cd.id = i.cadencia_id and i.cadencia_fim_em is null
     where i.anonimizado_em is null and i.virou_cliente_em is null
       and (p.aberta
            or (i.etapa in ('PERDIDO', 'SEM_RESPOSTA')
                and (i.fidelidade_ate between v_hoje and v_hoje + v_dias[4] or i.retomar_em <= v_hoje
                     or exists (select 1 from janelas_comercial s where s.interessado_id = i.id and s.tipo = 'SINDICO_NOVO'
                                   and s.tratada_em is null and s.criado_em >= i.etapa_desde))))
       -- a regra de comercial_nao_contatar_tem, em junção (uma chamada por linha levava segundos)
       and not exists (select 1 from nao_contatar n where n.whatsapp = i.whatsapp)
       and not exists (select 1 from nao_contatar n where n.email = lower(i.email))
       and not exists (select 1 from nao_contatar n where n.cnpj = i.cnpj)
  ), base as materialized (
    select (c.r).id, (c.r).condominio, (c.r).etapa, (c.r).responsavel_id, (c.r).primeiro_retorno_ate,
           c.aberto and (c.r).primeira_resposta_em is null and (c.r).primeiro_retorno_ate < v_agora as sem_retorno,
           case when c.aberto then comercial_tarefa_de(c.r, c.lim, c.passos, v_agora) end as t,
           -- Só calcula as janelas de quem tem alguma data dentro do aviso.
           case when (c.aberto and ((c.r).assembleia_ordinaria between v_hoje + v_dias[2] and v_hoje + v_dias[1]
                                     or (c.r).mandato_ate between v_hoje and v_hoje + v_dias[3]))
                     or (c.r).fidelidade_ate between v_hoje and v_hoje + v_dias[4]
                     or not c.aberto
                then (select jsonb_agg(x order by x ->> 'de') from jsonb_array_elements(comercial_janelas_de(c.r, c.aberto, v_hoje, v_dias, true)) x
                       where (x ->> 'pedeAtencao')::boolean) end as j
      from cand c
  ), itens as materialized (
    select b.*,
           case when b.sem_retorno then 'PRIMEIRO_RETORNO'
                when b.t ->> 'situacao' = 'ATRASADO' then 'ATRASADO'
                when b.t ? 'diasParado' then 'PARADO'
                when b.j is not null then 'JANELA' end as motivo,
           (case when b.sem_retorno then 1 else 0 end) + (case when not b.sem_retorno and b.t ->> 'situacao' = 'ATRASADO' then 1 else 0 end)
             + (case when b.t ? 'diasParado' then 1 else 0 end) + coalesce(jsonb_array_length(b.j), 0) as razoes
      from base b
  ), ordenados as materialized (
    select it.*,
           case it.motivo when 'PRIMEIRO_RETORNO' then 1 when 'ATRASADO' then 2 when 'PARADO' then 3 else 4 end as prioridade,
           case it.motivo when 'PRIMEIRO_RETORNO' then it.primeiro_retorno_ate
                          when 'ATRASADO' then (it.t ->> 'quando')::timestamptz
                          when 'JANELA' then ((it.j -> 0 ->> 'de')::date)::timestamp at time zone 'America/Sao_Paulo' end as quando
      from itens it where it.motivo is not null
  )
  select jsonb_build_object(
    'total', (select count(*)::integer from ordenados),
    'contagens', jsonb_build_object(
      'primeiroRetorno', (select count(*)::integer from itens where sem_retorno),
      'atrasados', (select count(*)::integer from itens where not sem_retorno and t ->> 'situacao' = 'ATRASADO'),
      'parados', (select count(*)::integer from itens where t ? 'diasParado'),
      'janelas', (select count(*)::integer from itens where j is not null)),
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'id', o.id, 'condominio', o.condominio, 'etapa', o.etapa, 'motivo', o.motivo,
                         'responsavel', case when o.responsavel_id is not null then jsonb_build_object('id', o.responsavel_id, 'nome', comercial_nome(o.responsavel_id)) end,
                         'meu', o.responsavel_id is not distinct from p_pessoa,
                         'quando', case when o.motivo in ('PRIMEIRO_RETORNO', 'ATRASADO') then o.quando end,
                         'tarefa', case when o.motivo = 'ATRASADO' then o.t ->> 'tarefa' end,
                         'diasParado', (o.t ->> 'diasParado')::integer,
                         'janela', case when o.motivo = 'JANELA' then o.j -> 0 end,
                         'outros', greatest(o.razoes - 1, 0)))
                         order by o.prioridade, (o.responsavel_id is not distinct from p_pessoa) desc, o.quando nulls last, o.condominio)
                         from (select * from ordenados order by prioridade, (responsavel_id is not distinct from p_pessoa) desc, quando nulls last, condominio
                               limit v_max) o), '[]'::jsonb),
    'max', v_max,
    'podeEditar', pode_global('console.comercial.editar'))
  into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Quem está no Console: as ações do menu, agora com a meta do Comercial. A lista leva as da
-- 0295, 0296, 0301, 0304 e 0308, para nenhuma frente apagar a da outra.

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
                                          'console.precos.ver', 'console.precos.editar',
                                          'console.retencao.ver', 'console.retencao.ligar',
                                          'console.comercial.ver', 'console.comercial.editar', 'console.comercial.modelos',
                                          'console.comercial.exportar', 'console.comercial.excluir', 'console.comercial.desconto',
                                          'console.comercial.assinar', 'console.comercial.cliente', 'console.comercial.meta')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

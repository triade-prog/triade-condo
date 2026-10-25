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
--    tinham o concorrente na disputa; "ganhamos" é Ganho; "perdemos para ele" é o vencedor marcado.
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
-- Ajudantes do painel.

-- Minutos úteis entre dois instantes (K.1): de segunda a sexta, das 9h às 18h de Brasília, como
-- comercial_hora_util. Feriado não entra na conta.
create function comercial_minutos_uteis(p_de timestamptz, p_ate timestamptz) returns integer
language plpgsql stable
set search_path = public
as $$
declare
  a timestamp := p_de at time zone 'America/Sao_Paulo';
  b timestamp := p_ate at time zone 'America/Sao_Paulo';
  d date;
  v_total numeric := 0;
  v_ini timestamp;
  v_fim timestamp;
begin
  if p_de is null or p_ate is null or p_ate <= p_de then return 0; end if;
  d := a::date;
  while d <= b::date and d - a::date <= 400 loop
    if extract(isodow from d) < 6 then
      v_ini := greatest(a, d + time '09:00');
      v_fim := least(b, d + time '18:00');
      if v_fim > v_ini then v_total := v_total + extract(epoch from v_fim - v_ini) / 60; end if;
    end if;
    d := d + 1;
  end loop;
  return round(v_total)::integer;
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
  with coorte as (
    select i.id, i.origem, i.criado_em, i.primeiro_retorno_ate, i.primeira_resposta_em,
           greatest(
             coalesce((select max(p.ordem) from etapas_interessado e join parametros_etapa_comercial p on p.etapa = e.para
                        where e.interessado_id = i.id and p.ordem <= 8), 0),
             coalesce((select p.ordem from parametros_etapa_comercial p where p.etapa = i.etapa and p.ordem <= 8), 0)) as chegou
      from interessados i
     where i.criado_em >= v_ini and i.criado_em < v_fim
  ),
  ganhos as (
    select i.id, i.responsavel_id, i.criado_em, max(e.criado_em) as em, comercial_mrr(i.id) as mrr
      from etapas_interessado e join interessados i on i.id = e.interessado_id
     where e.para = 'GANHO' and e.criado_em >= v_ini and e.criado_em < v_fim and i.etapa = 'GANHO'
     group by i.id
  ),
  perdas as (
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
  disputas as (
    select distinct i.id, comercial_normalizar(x ->> 'nome') as chave, btrim(x ->> 'nome') as nome, i.etapa,
           coalesce((x ->> 'venceu')::boolean, false) as venceu
      from interessados i, jsonb_array_elements(i.concorrentes) x
     where i.etapa in ('GANHO', 'PERDIDO') and i.etapa_desde < v_fim and comercial_normalizar(x ->> 'nome') is not null
  )
  select jsonb_build_object(
    'novos', (select count(*)::integer from coorte),
    'funil', coalesce((select jsonb_agg(jsonb_build_object('etapa', p.etapa, 'chegaram', (select count(*)::integer from coorte c where c.chegou >= p.ordem)) order by p.ordem)
                         from parametros_etapa_comercial p where p.ordem <= 8), '[]'::jsonb),
    'porOrigem', coalesce((select jsonb_agg(jsonb_build_object('origem', o.origem, 'novos', o.novos, 'ganhos', o.ganhos) order by o.novos desc, o.origem)
                             from (select c.origem, count(*)::integer as novos, count(*) filter (where c.chegou >= 8)::integer as ganhos
                                     from coorte c group by c.origem) o), '[]'::jsonb),
    'primeiroRetorno', (select jsonb_strip_nulls(jsonb_build_object(
        'total', count(*) filter (where c.primeiro_retorno_ate is not null),
        'noPrazo', count(*) filter (where c.primeira_resposta_em is not null and c.primeira_resposta_em <= c.primeiro_retorno_ate),
        'foraDoPrazo', count(*) filter (where c.primeiro_retorno_ate is not null
                                          and (c.primeira_resposta_em > c.primeiro_retorno_ate or (c.primeira_resposta_em is null and c.primeiro_retorno_ate < v_agora))),
        'aguardando', count(*) filter (where c.primeiro_retorno_ate is not null and c.primeira_resposta_em is null and c.primeiro_retorno_ate >= v_agora),
        'medianaMinutosUteis', round((percentile_cont(0.5) within group (order by comercial_minutos_uteis(c.criado_em, c.primeira_resposta_em)::double precision)
                                        filter (where c.primeira_resposta_em is not null))::numeric),
        'site', jsonb_build_object(
          'total', count(*) filter (where c.origem = 'SITE'),
          'noPrazo', count(*) filter (where c.origem = 'SITE' and c.primeira_resposta_em is not null and c.primeira_resposta_em < comercial_promessa_site(c.criado_em)))))
      from coorte c),
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
                                from (select min(nome) as nome, count(*)::integer as d, count(*) filter (where etapa = 'GANHO')::integer as g,
                                             count(*) filter (where venceu)::integer as pe
                                        from disputas group by chave) s), '[]'::jsonb))
  into v_mesj;

  -- O que está assim agora (decisão b).
  with abertos as (
    select i.id, i.etapa, comercial_tarefa(i) as t, p.probabilidade, comercial_mrr(i.id) as mrr
      from interessados i join parametros_etapa_comercial p on p.etapa = i.etapa
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

-- As janelas de um interessado (decisão g), com a situação de hoje. pedeAtencao: aberta, não
-- tratada e com quem se pode falar.
create function comercial_janelas(i interessados) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_hoje    date := comercial_hoje();
  v_aberto  boolean := comercial_aberta(i.etapa);
  v_fechado boolean := i.etapa in ('PERDIDO', 'SEM_RESPOSTA');
  v_ass_de  integer := configuracao_int('comercial_janela_assembleia_de_dias');
  v_ass_ate integer := configuracao_int('comercial_janela_assembleia_ate_dias');
  v_mand    integer := configuracao_int('comercial_janela_mandato_dias');
  v_fid     integer := configuracao_int('comercial_janela_fidelidade_dias');
  v_pode    boolean := not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj);
begin
  if i.anonimizado_em is not null or i.virou_cliente_em is not null or not (v_aberto or v_fechado) then return '[]'::jsonb; end if;
  return coalesce((
    with c (tipo, data_ref, de, ate) as (
      select 'ASSEMBLEIA', i.assembleia_ordinaria, i.assembleia_ordinaria - v_ass_de, i.assembleia_ordinaria - v_ass_ate
       where v_aberto and i.assembleia_ordinaria is not null
      union all
      select 'MANDATO', i.mandato_ate, i.mandato_ate - v_mand, i.mandato_ate where v_aberto and i.mandato_ate is not null
      union all
      select 'FIDELIDADE', i.fidelidade_ate, i.fidelidade_ate - v_fid, i.fidelidade_ate where i.fidelidade_ate is not null
      union all
      select 'RETOMAR', i.retomar_em, i.retomar_em, null::date where v_fechado and i.retomar_em is not null
      union all
      select 'SINDICO_NOVO', j.data_ref, (j.criado_em at time zone 'America/Sao_Paulo')::date, null::date
        from janelas_comercial j
       where v_fechado and j.interessado_id = i.id and j.tipo = 'SINDICO_NOVO' and j.criado_em >= i.etapa_desde
    ), s as (
      select c.*, t.tratada_em, t.tratada_por,
             case when c.de > v_hoje then 'PROXIMA' when c.ate is not null and c.ate < v_hoje then 'PASSOU' else 'ABERTA' end as situacao
        from c left join janelas_comercial t on t.interessado_id = i.id and t.tipo = c.tipo and t.data_ref = c.data_ref and t.tratada_em is not null
    )
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'tipo', s.tipo, 'data', s.data_ref, 'de', s.de, 'ate', s.ate, 'situacao', s.situacao,
             'tratada', s.tratada_em is not null, 'tratadaEm', s.tratada_em,
             'tratadaPor', case when s.tratada_por is not null then jsonb_build_object('id', s.tratada_por, 'nome', comercial_nome(s.tratada_por)) end,
             'pedeAtencao', s.situacao = 'ABERTA' and s.tratada_em is null and v_pode))
           order by s.de, s.tipo)
      from s), '[]'::jsonb);
end $$;

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
  v_max   integer := configuracao_int('comercial_inicio_max');
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  with base as (
    select i.id, i.condominio, i.etapa, i.responsavel_id, i.primeiro_retorno_ate,
           comercial_aberta(i.etapa) as aberto,
           comercial_aberta(i.etapa) and i.primeira_resposta_em is null and i.primeiro_retorno_ate < v_agora as sem_retorno,
           case when comercial_aberta(i.etapa) then comercial_tarefa(i) end as t,
           (select jsonb_agg(x order by x ->> 'de') from jsonb_array_elements(comercial_janelas(i)) x where (x ->> 'pedeAtencao')::boolean) as j
      from interessados i
     where i.anonimizado_em is null and i.virou_cliente_em is null
       and (comercial_aberta(i.etapa) or i.etapa in ('PERDIDO', 'SEM_RESPOSTA'))
  ), itens as (
    select b.*,
           case when b.sem_retorno then 'PRIMEIRO_RETORNO'
                when b.t ->> 'situacao' = 'ATRASADO' then 'ATRASADO'
                when b.t ? 'diasParado' then 'PARADO'
                when b.j is not null then 'JANELA' end as motivo,
           (case when b.sem_retorno then 1 else 0 end) + (case when not b.sem_retorno and b.t ->> 'situacao' = 'ATRASADO' then 1 else 0 end)
             + (case when b.t ? 'diasParado' then 1 else 0 end) + coalesce(jsonb_array_length(b.j), 0) as razoes
      from base b
  ), ordenados as (
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

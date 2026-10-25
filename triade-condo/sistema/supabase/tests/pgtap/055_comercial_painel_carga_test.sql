-- Carga do painel comercial e do cartão do Início (0309, R17.5; revisão do dfff721): com 10 mil
-- interessados (3 mil abertos e 7 mil fechados), 20 mil mudanças de etapa e 30 mil conversas, o
-- Início e o painel do mês respondem em menos de 1 segundo cada (antes da revisão: 22 s, 2,2 s e 2 s).
begin;
select plan(8);

create temp table ids as select teste.equipe('Carolina', 'ADMINISTRACAO') as adm, teste.equipe('Bianca', 'COMERCIAL') as com;
grant select on ids to dominio;
create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.ms(p_sql text) returns numeric language plpgsql as $$
declare t timestamptz := clock_timestamp();
begin
  execute p_sql;
  return round(extract(epoch from clock_timestamp() - t) * 1000);
end $$;

select pg_temp.em('2026-10-20 10:00:00-03');
-- 10 mil interessados: n de 1 a 3000 abertos, o resto fechados (Perdido, Sem resposta e Ganho).
insert into interessados (condominio, origem, base_legal, base_legal_texto, whatsapp, etapa, etapa_desde, motivo_perda, responsavel_id, criado_em,
                          primeiro_retorno_ate, primeira_resposta_em, ultima_conversa_em, proximo_passo, proximo_passo_data,
                          assembleia_ordinaria, mandato_ate, fidelidade_ate, retomar_em, concorrentes)
select 'Edifício ' || n,
       (array['SITE', 'INDICACAO', 'INSTAGRAM', 'COTACAO', 'WHATSAPP_COMERCIAL'])[1 + n % 5],
       'LEGITIMO_INTERESSE', 'A pessoa procurou a TRÍADE ou aceitou o contato.',
       '5561' || lpad(n::text, 9, '0'),
       e.etapa, c.em + interval '3 days',
       case when e.etapa = 'PERDIDO' then (array['PRECO', 'OUTRO_SISTEMA', 'FICOU_PARA_DEPOIS'])[1 + n % 3] end,
       (select com from ids),
       c.em, c.em + interval '1 hour',
       case when n % 4 <> 0 then c.em + make_interval(mins => 20 + n % 300) end,
       c.em + make_interval(days => n % 12),
       case when n <= 3000 and n % 7 = 0 then 'Ligar' end, case when n <= 3000 and n % 7 = 0 then date '2026-10-15' + n % 10 end,
       case when n % 3 = 0 then date '2026-10-20' + n % 120 end,
       case when n % 5 = 0 then date '2026-10-20' + n % 200 end,
       case when n % 4 = 0 then date '2026-10-20' + n % 90 - 30 end,
       case when n > 3000 and n % 6 = 0 then date '2026-10-20' - n % 40 + 20 end,
       case when n % 10 = 0 then jsonb_build_array(jsonb_build_object('nome', (array['Condomob', 'Superlógica', 'App X'])[1 + n % 3], 'venceu', n % 20 = 0)) else '[]' end
  from generate_series(1, 10000) n
  cross join lateral (select case when n <= 3000 then (array['NOVO', 'EM_CONTATO', 'DEMO_MARCADA', 'DEMO_FEITA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'APROVACAO'])[1 + n % 7]
                                  else (array['PERDIDO', 'SEM_RESPOSTA', 'GANHO', 'PERDIDO'])[1 + n % 4] end as etapa) e
  cross join lateral (select timestamptz '2026-04-01 10:00-03' + make_interval(hours => (n * 37) % (24 * 200)) as em) c;
insert into etapas_interessado (interessado_id, de, para, motivo_perda, criado_em, criado_por)
select i.id, null, 'NOVO', null, i.criado_em, null from interessados i
union all
select i.id, 'NOVO', i.etapa, i.motivo_perda, i.etapa_desde, (select com from ids) from interessados i where i.etapa <> 'NOVO';
insert into conversas_comercial (interessado_id, canal, resumo, respondeu, criado_por, criado_em)
select i.id, (array['WHATSAPP', 'LIGACAO', 'NOTA'])[1 + k], 'Conversa ' || k, false, (select com from ids), i.criado_em + make_interval(hours => 5 * k)
  from interessados i, generate_series(0, 2) k;
insert into nao_contatar (whatsapp, motivo, criado_por)
select '5561' || lpad(n::text, 9, '0'), 'PEDIU', (select adm from ids) from generate_series(1, 10000, 97) n;
analyze interessados; analyze etapas_interessado; analyze conversas_comercial; analyze nao_contatar;

select has_index('public', 'conversas_comercial', 'conversas_comercial_criado_em', array['criado_em'], 'as conversas têm índice pela data');
select has_index('public', 'etapas_interessado', 'etapas_interessado_para', array['para', 'criado_em'], 'as mudanças de etapa têm índice pela etapa e a data');
select is((select count(*)::int from interessados), 10000, '10 mil interessados');
select is((select count(*)::int from interessados i join parametros_etapa_comercial p on p.etapa = i.etapa where p.aberta), 3000, '3 mil abertos');

create temp table t as select pg_temp.ms($$ select comercial_inicio((select com from ids)) $$) as inicio,
                              pg_temp.ms($$ select comercial_painel((select com from ids), null) $$) as painel,
                              pg_temp.ms($$ select comercial_painel((select com from ids), '2026-06-01') $$) as junho;
select diag('Início ' || inicio || ' ms, painel ' || painel || ' ms, junho ' || junho || ' ms') from t;
select cmp_ok((select inicio from t), '<', 1000::numeric, 'o cartão do Início responde em menos de 1 s');
select cmp_ok((select painel from t), '<', 1000::numeric, 'o painel do mês atual responde em menos de 1 s');
select cmp_ok((select junho from t), '<', 1000::numeric, 'o painel de um mês cheio responde em menos de 1 s');
select ok((select (comercial_inicio(com) ->> 'total')::int > 0 from ids), 'e o Início tem o que mostrar');

select * from finish();
rollback;

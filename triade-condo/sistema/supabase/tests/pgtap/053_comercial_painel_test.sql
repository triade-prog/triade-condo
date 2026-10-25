-- Painel comercial (0309, R17.5; CM-10, K.1): o painel vazio, quem vê e quem muda a meta, os
-- números do mês (novos, funil "até onde chegou", origem, primeiro retorno em hora útil e a
-- promessa do site, ganhos com o novo MRR e o ciclo, perdas, sem resposta, atividades e novo MRR
-- por pessoa, cada concorrente), o retrato de agora (previsão = valor × chance da etapa, parados,
-- atrasados, propostas vencendo, vagas de fundador), a meta herdada e nenhum dado de pessoa.
begin;
select plan(63);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Davi', 'COMERCIAL') as com2,
  teste.equipe('Iara', 'IMPLANTACAO') as imp;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.novo(p_condominio text, p_whatsapp text, p_origem text, p_resp uuid) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', p_origem,
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp, 'papel', 'SINDICO',
                                                                 'responsavelId', p_resp)) ->> 'id')::uuid;
  update interessados set unidades = 72, faixa = 'DE_41_A_100', cidade = 'Brasília', uf = 'DF' where id = v;
  return v;
end $$;
-- Muda a etapa direto, numa data, como o funil gravaria.
create function pg_temp.para(p_id uuid, p_etapa text, p_em timestamptz, p_motivo text default null) returns void language plpgsql as $$
begin
  insert into etapas_interessado (interessado_id, de, para, motivo_perda, criado_em, criado_por)
  select id, etapa, p_etapa, p_motivo, p_em, (select com from ids) from interessados where id = p_id;
  update interessados set etapa = p_etapa, etapa_desde = p_em, motivo_perda = p_motivo where id = p_id;
end $$;
create function pg_temp.enviar(p_id uuid, p_dados jsonb) returns text language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_id, p_dados);
  e := comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  return e -> 'link' ->> 'codigo';
end $$;
create function pg_temp.painel(p_pessoa uuid, p_mes date default null) returns jsonb language sql as $$ select comercial_painel(p_pessoa, p_mes) $$;

-- 1. Sem nenhum interessado.
select pg_temp.em('2026-10-01 09:00:00-03');
create temp table p0 as select pg_temp.painel(com) as p from ids;
select is((select p ->> 'mes' from p0), '2026-10', 'o mês do painel é o de Brasília');
select is((select (p -> 'novos')::int + jsonb_array_length(p -> 'porOrigem') + jsonb_array_length(p -> 'porPessoa') + jsonb_array_length(p -> 'concorrentes')
             + (p -> 'perdas' -> 'quantos')::int + (p -> 'semResposta')::int from p0), 0, 'sem dados: nenhum novo, origem, pessoa, concorrente, perda ou sem resposta');
select is((select array_agg(x ->> 'etapa' || ' ' || (x ->> 'chegaram') order by n) from p0, jsonb_array_elements(p -> 'funil') with ordinality f(x, n)),
  array['NOVO 0', 'EM_CONTATO 0', 'DEMO_MARCADA 0', 'DEMO_FEITA 0', 'PROPOSTA_ENVIADA 0', 'NEGOCIACAO 0', 'APROVACAO 0', 'GANHO 0'],
  'o funil vazio tem as oito etapas até o Ganho, todas com zero');
select is((select p -> 'ganhos' from p0), '{"quantos": 0, "novoMrr": 0, "semValor": 0}'::jsonb, 'sem ganho, o novo MRR é zero e não há ciclo médio');
select is((select p -> 'primeiroRetorno' from p0),
  '{"total": 0, "noPrazo": 0, "foraDoPrazo": 0, "aguardando": 0, "cotacoes": {"total": 0, "noPrazo": 0, "aguardando": 0}, "site": {"total": 0, "noPrazo": 0, "aguardando": 0}}'::jsonb,
  'sem novos, o primeiro retorno é zero, sem mediana');
select is((select (p -> 'agora') - 'porEtapa' - 'vagasFundador' from p0),
  '{"abertos": 0, "previsao": {"centavos": 0, "comValor": 0, "semValor": 0}, "parados": 0, "atrasados": 0, "propostasVencendo": [], "vencendoDias": 7}'::jsonb,
  'o retrato de agora vazio: previsão zero, nada parado nem vencendo');
select is((select p -> 'agora' -> 'vagasFundador' from p0), vagas_fundador_json(), 'as vagas de fundador vêm da Tabela de preços');
select ok((select not (p ? 'meta') and p ->> 'podeMudarMeta' = 'false' from p0), 'sem meta posta, e o Comercial não muda a meta');
select is((select pg_temp.painel(adm) ->> 'podeMudarMeta' from ids), 'true', 'a Administração muda a meta do mês');

-- 2. Quem vê e quem muda.
select throws_ok($$ select comercial_painel(imp) from ids $$, 'TC401', null, 'a Implantação não vê o painel comercial');
select throws_ok($$ select comercial_salvar_meta(com, '2026-10-01', null, 500000, '[]') from ids $$, 'TC401', null, 'o Comercial não muda a meta');
select ok((select console_sessao(adm) -> 'acoes' ? 'console.comercial.meta' from ids), 'a sessão da Administração traz a meta do Comercial');
select ok((select not (console_sessao(com) -> 'acoes' ? 'console.comercial.meta') from ids), 'a do Comercial não');

-- 3. O mês. Setembro: o Cedro entra e vai à negociação (fica parado e sem valor).
select pg_temp.em('2026-09-10 10:00:00-03');
create temp table i as select pg_temp.novo('Edifício Cedro', '5561999990701', 'INDICACAO', com2) as cedro from ids;
select comercial_registrar_conversa(com2, cedro, 'LIGACAO', 'Falou com o síndico.') from ids, i;
select pg_temp.para(cedro, 'NEGOCIACAO', '2026-09-15 10:00-03') from i;
update interessados set concorrentes = '[{"nome": "Condomob"}]' where id = (select cedro from i);

-- Outubro: segunda, 5, às 10h, chegam cinco.
select pg_temp.em('2026-10-05 10:00:00-03');
alter table i add column aroeira uuid, add column bambu uuid, add column caju uuid, add column ipe uuid, add column jatoba uuid;
update i set aroeira = pg_temp.novo('Edifício Aroeira', '5561999990702', 'INDICACAO', (select com from ids)),
             caju = pg_temp.novo('Edifício Caju', '5561999990704', 'INSTAGRAM', (select com2 from ids)),
             ipe = pg_temp.novo('Edifício Ipê', '5561999990705', 'INDICACAO', (select com from ids)),
             jatoba = pg_temp.novo('Edifício Jatobá', '5561999990706', 'INSTAGRAM', (select com from ids));
update i set bambu = (comercial_entrada_site(jsonb_build_object('nome', 'Renata Moura', 'whatsapp', '5561999990703', 'condominio', 'Edifício Bambu',
                                                                'faixa', 'DE_41_A_100', 'consentimento', true, 'pagina', '/demonstracao')) ->> 'id')::uuid;
update interessados set responsavel_id = (select com from ids), unidades = 72, cidade = 'Brasília', uf = 'DF' where id = (select bambu from i);
select pg_temp.em('2026-10-05 10:30:00-03');
select comercial_registrar_conversa(com, aroeira, 'WHATSAPP', 'Primeiro retorno.') from ids, i;
select comercial_registrar_conversa(com, caju, 'NOTA', 'Tentar de novo amanhã.') from ids, i;
select is((select pg_temp.painel(com) -> 'primeiroRetorno' from ids),
  '{"total": 1, "noPrazo": 1, "foraDoPrazo": 0, "aguardando": 4, "cotacoes": {"total": 0, "noPrazo": 0, "aguardando": 0},
    "site": {"total": 0, "noPrazo": 0, "aguardando": 1}, "medianaMinutosUteis": 30}'::jsonb,
  'às 10:30, um respondeu em 30 minutos úteis e quatro aguardam dentro da hora útil, fora do total; o site também aguarda; a nota interna não conta');
select pg_temp.em('2026-10-05 13:00:00-03');
select comercial_registrar_conversa(com, bambu, 'LIGACAO', 'Ligou de volta.') from ids, i;
select pg_temp.em('2026-10-06 10:00:00-03');
select comercial_registrar_conversa(com2, ipe, 'EMAIL', 'Respondeu por e-mail.') from ids, i;
select pg_temp.para(aroeira, 'EM_CONTATO', '2026-10-06 10:00-03') from i;
select pg_temp.para(bambu, 'EM_CONTATO', '2026-10-06 10:00-03') from i;
select pg_temp.para(caju, 'EM_CONTATO', '2026-10-06 10:00-03') from i;
-- A Aroeira recebe a proposta no dia 8 e aceita; ganha no dia 20. Disputou com o Condomob e a Superlógica.
select pg_temp.em('2026-10-08 10:00:00-03');
select pg_temp.para(aroeira, 'PROPOSTA_ENVIADA', app_now()) from i;
create temp table cod as select pg_temp.enviar(aroeira, '{}') as aroeira from i;
select publico_aceitar_proposta(aroeira, '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', '200.1.2.3', null) from cod;
update interessados set concorrentes = '[{"nome": "Condomob", "preco": 19900}, {"nome": "Superlógica"}]' where id = (select aroeira from i);
-- O Caju perde por preço para o "condomob" (o mesmo, escrito de outro jeito).
select pg_temp.em('2026-10-12 10:00:00-03');
update interessados set concorrentes = '[{"nome": "condomob ", "venceu": true}]' where id = (select caju from i);
select pg_temp.para(caju, 'PERDIDO', app_now(), 'PRECO') from i;
-- O Bambu recebe a proposta anual no dia 15, válida por 5 dias.
select pg_temp.em('2026-10-15 10:00:00-03');
select pg_temp.para(bambu, 'PROPOSTA_ENVIADA', app_now()) from i;
select pg_temp.enviar(bambu, '{"ciclo": "ANUAL", "validadeDias": 5}') from i;
select pg_temp.em('2026-10-16 10:00:00-03');
select pg_temp.para(ipe, 'SEM_RESPOSTA', app_now()) from i;
select pg_temp.em('2026-10-20 10:00:00-03');
select pg_temp.para(aroeira, 'GANHO', app_now()) from i;

-- 4. A meta (só a Administração; do mês atual aos 12 seguintes).
select is(pg_temp.motivo($$ select comercial_salvar_meta(adm, '2026-09-01', null, 500000, '[]') from ids $$), 'META_MES_PASSADO',
  'a meta de um mês que já passou não muda');
select is(pg_temp.campos($$ select comercial_salvar_meta(adm, '2027-11-01', null, 500000, '[]') from ids $$), '["mes"]'::jsonb,
  'nem a de mais de 12 meses à frente');
select is(pg_temp.campos($$ select comercial_salvar_meta(adm, '2026-10-01', null, 0, '[]') from ids $$), '["total"]'::jsonb, 'a meta é maior que zero');
select is(pg_temp.campos($$ select comercial_salvar_meta(adm, '2026-10-01', null, 500000, jsonb_build_array(jsonb_build_object('pessoaId', imp, 'centavos', 100000))) from ids $$),
  '["porPessoa"]'::jsonb, 'a meta por pessoa é de quem tem o Comercial ou a Administração');
select is(pg_temp.campos($$ select comercial_salvar_meta(adm, '2026-10-01', null, 500000,
                              jsonb_build_array(jsonb_build_object('pessoaId', com, 'centavos', 1), jsonb_build_object('pessoaId', com, 'centavos', 2))) from ids $$),
  '["porPessoa"]'::jsonb, 'cada pessoa aparece uma vez');
select is((select comercial_salvar_meta(adm, '2026-10-15', null, 400000, jsonb_build_array(jsonb_build_object('pessoaId', com, 'centavos', 300000))) from ids),
  '{"mes": "2026-10", "versao": 1}'::jsonb, 'a Administração põe a meta de outubro');
select throws_ok($$ select comercial_salvar_meta(adm, '2026-10-01', null, 500000, '[]') from ids $$, 'TC409', null,
  'pôr de novo, sem a versão, dá conflito');
select throws_ok($$ select comercial_salvar_meta(adm, '2026-11-01', 1, 500000, '[]') from ids $$, 'TC404', null, 'com versão num mês sem meta, não acha');
select is((select comercial_salvar_meta(adm, '2026-10-01', 1, 500000, jsonb_build_array(jsonb_build_object('pessoaId', com, 'centavos', 300000))) ->> 'versao' from ids),
  '2', 'e muda com a versão');
select is((select count(*)::int from historico where acao = 'comercial.meta' and entidade = 'meta_comercial' and entidade_id = '2026-10' and interno), 2,
  'cada mudança da meta fica no histórico interno');
select throws_ok($$ update metas_comercial set mes = '2026-11-01' $$, 'TC422', null, 'a meta não muda de mês');
select throws_ok($$ delete from metas_comercial $$, null, null, 'a meta não se apaga');

-- 5. Os números de outubro, no dia 20.
create temp table p as select pg_temp.painel(com) as p from ids;
create temp table v as select
  (select mensal_centavos from versoes_proposta v join propostas_comercial pr on pr.id = v.proposta_id where pr.interessado_id = (select aroeira from i)) as aroeira,
  (select anual_centavos from versoes_proposta v join propostas_comercial pr on pr.id = v.proposta_id where pr.interessado_id = (select bambu from i)) as bambu_anual;
select is((select situacao from versoes_proposta v join propostas_comercial pr on pr.id = v.proposta_id where pr.interessado_id = (select aroeira from i)),
  'ACEITA', 'a proposta da Aroeira foi aceita');
select ok((select aroeira > 0 and bambu_anual > 0 from v), 'as duas propostas têm valor');
select is((select (p -> 'novos')::int from p), 5, 'cinco novos em outubro (o Cedro entrou em setembro)');
select is((select array_agg((x ->> 'chegaram')::int order by n) from p, jsonb_array_elements(p -> 'funil') with ordinality f(x, n)),
  array[5, 3, 2, 2, 2, 1, 1, 1],
  'até onde cada um chegou: a Aroeira até o Ganho, o Bambu até a proposta, o Caju (perdido) até o contato');
select is((select p -> 'porOrigem' from p),
  '[{"origem": "INDICACAO", "novos": 2, "ganhos": 1}, {"origem": "INSTAGRAM", "novos": 2, "ganhos": 0}, {"origem": "SITE", "novos": 1, "ganhos": 0}]'::jsonb,
  'conversão por origem dos novos do mês');
select is((select p -> 'primeiroRetorno' from p),
  '{"total": 5, "noPrazo": 1, "foraDoPrazo": 4, "aguardando": 0, "cotacoes": {"total": 0, "noPrazo": 0, "aguardando": 0},
    "site": {"total": 1, "noPrazo": 1, "aguardando": 0}, "medianaMinutosUteis": 180}'::jsonb,
  'primeiro retorno: um em 1 hora útil, quatro fora (dois responderam tarde, dois nunca); mediana de 30, 180 e 540 minutos úteis; o site, dentro do próximo dia útil');
select is(comercial_minutos_uteis('2026-10-05 10:00-03', '2026-10-06 10:00-03'), 540, 'de segunda 10h a terça 10h são 540 minutos úteis');
select is(comercial_minutos_uteis('2026-10-09 17:00-03', '2026-10-12 09:30-03'), 90, 'o fim de semana não conta');
select is(array[comercial_minutos_uteis('2026-10-10 12:00-03', '2026-10-12 10:00-03'), comercial_minutos_uteis('2026-10-05 07:00-03', '2026-10-05 19:00-03'),
                comercial_minutos_uteis('2026-10-05 09:00-03', '2026-10-19 09:00-03'), comercial_minutos_uteis('2026-10-05 19:00-03', '2026-10-06 08:00-03'),
                comercial_minutos_uteis('2026-10-06 10:00-03', '2026-10-05 10:00-03')],
  array[60, 540, 5400, 0, 0], 'sem laço: do sábado à segunda, fora do horário, duas semanas, de noite e de trás para a frente');
select is(comercial_promessa_site('2026-10-09 10:00-03'), '2026-10-13 00:00-03'::timestamptz, 'pedido na sexta: a promessa do site vai até o fim de segunda');
select is((select p -> 'ganhos' from p), jsonb_build_object('quantos', 1, 'novoMrr', (select aroeira from v), 'semValor', 0, 'cicloMedioDias', 15),
  'um ganho: o novo MRR é a mensalidade aceita e o ciclo, 15 dias da entrada ao Ganho');
select is((select p -> 'perdas' from p), '{"quantos": 1, "motivos": [{"motivo": "PRECO", "quantos": 1}]}'::jsonb, 'por que não fechou');
select is((select (p -> 'semResposta')::int from p), 1, 'um foi para sem resposta no mês');
select is((select jsonb_agg((x - 'pessoa') || jsonb_build_object('nome', x -> 'pessoa' ->> 'nome') order by x -> 'pessoa' ->> 'nome') from p, jsonb_array_elements(p -> 'porPessoa') x),
  jsonb_build_array(jsonb_build_object('nome', 'Bianca', 'atividades', 4, 'ganhos', 1, 'novoMrr', (select aroeira from v), 'meta', 300000),
                    jsonb_build_object('nome', 'Davi', 'atividades', 1, 'ganhos', 0, 'novoMrr', 0)),
  'por pessoa: atividades do mês (sem a entrada e a nota; as propostas enviadas contam), novo MRR do que é dela e a meta');
select is((select p -> 'concorrentes' from p), '[{"nome": "Condomob", "disputas": 2, "ganhamos": 1, "perdemosParaEle": 1}, {"nome": "Superlógica", "disputas": 1, "ganhamos": 1, "perdemosParaEle": 0}]'::jsonb,
  'contra cada concorrente, dos fechados: o nome escrito de outro jeito junta; o aberto (Cedro) não conta');
select is((select (p -> 'meta') - 'alteradoEm' - 'porPessoa' from p),
  jsonb_build_object('mes', '2026-10', 'herdada', false, 'versao', 2, 'total', 500000, 'alteradoPor', jsonb_build_object('id', (select adm from ids), 'nome', 'Carolina')),
  'a meta do mês, com quem mudou');

-- O retrato de agora.
select is((select p -> 'agora' -> 'previsao' from p), jsonb_build_object('centavos', round((select bambu_anual from v) / 12.0 * 0.5)::bigint, 'comValor', 1, 'semValor', 2),
  'previsão: o Bambu (anual ÷ 12) × 50% da proposta enviada; o Cedro e o Jatobá sem valor');
select is((select (p -> 'agora' ->> 'abertos')::int from p), 3, 'três abertos agora');
select is((select array_agg((x ->> 'quantos')::int order by n) from p, jsonb_array_elements(p -> 'agora' -> 'porEtapa') with ordinality f(x, n)),
  array[1, 0, 0, 0, 1, 1, 0], 'abertos por etapa');
select is((select (p -> 'agora' ->> 'parados')::int from p), 2, 'o Cedro e o Jatobá estão parados');
select is((select (p -> 'agora' ->> 'atrasados')::int from p), 2, 'atrasados: o Jatobá, sem o primeiro retorno, e o Bambu, com o passo da cadência do site vencido');
select is((select jsonb_agg(x - 'propostaId' - 'interessadoId') from p, jsonb_array_elements(p -> 'agora' -> 'propostasVencendo') x),
  '[{"condominio": "Edifício Bambu", "numero": 1, "validoAte": "2026-10-20"}]'::jsonb, 'a proposta do Bambu vence hoje');
select pg_temp.em('2026-10-21 10:00:00-03');
select is((select jsonb_array_length(pg_temp.painel(com) -> 'agora' -> 'propostasVencendo') from ids), 0, 'vencida, sai da lista');
select is((select pg_temp.painel(com) -> 'agora' -> 'previsao' ->> 'comValor' from ids), '0', 'e a proposta vencida deixa de ter valor na previsão');

-- 6. Outros meses.
create temp table set_ as select pg_temp.painel(com, '2026-09-01') as p from ids;
select is((select array[(p -> 'novos')::int, (p -> 'funil' -> 5 ->> 'chegaram')::int, (p -> 'ganhos' ->> 'quantos')::int, jsonb_array_length(p -> 'concorrentes')] from set_),
  array[1, 1, 0, 0], 'setembro: o Cedro entrou e chegou à negociação; ninguém fechado até o fim de setembro');
select is((select p -> 'porPessoa' -> 0 ->> 'atividades' from set_), '1', 'a ligação de setembro conta em setembro');
select ok((select p ->> 'mesAtual' = 'false' and not (p ? 'meta') from set_), 'setembro não é o mês atual e não tem meta');
select is((select pg_temp.painel(adm, '2026-09-01') ->> 'podeMudarMeta' from ids), 'false', 'nem a Administração muda a meta de setembro');
create temp table nov as select pg_temp.painel(adm, '2026-11-01') as p from ids;
select is((select p -> 'meta' -> 'herdada' from nov), 'true', 'novembro herda a meta de outubro');
select ok((select (p -> 'meta' ->> 'total')::int = 500000 and not (p -> 'meta' ? 'versao') and p ->> 'podeMudarMeta' = 'true' from nov),
  'com o mesmo total; para mudar, cria a de novembro');
select is((select (p -> 'novos')::int from nov), 0, 'novembro ainda não tem novos');

-- 7. LGPD: só números; o nome do condomínio só nas propostas vencendo.
select pg_temp.em('2026-10-20 10:00:00-03');
select ok((select position('Lúcia' in p::text) = 0 and position('Renata' in p::text) = 0 and position('5561' in p::text) = 0 from p),
  'o painel não mostra a pessoa de contato nem o telefone');
select ok((select position('Aroeira' in p::text) = 0 and position('Caju' in p::text) = 0 from p), 'nem o nome dos condomínios fora das propostas vencendo');
select ok((select (p -> 'novos')::int = 5 from (select pg_temp.painel(com) as p from ids) x), 'o painel conta as mesmas coisas lido de novo');

-- 8. Revisão do dfff721. Segunda, 9 de novembro, às 10h: uma cotação (prazo de 24 horas), um pedido
-- pelo site, uma indicação e o Ingá, sem prazo de primeiro retorno.
select pg_temp.em('2026-11-09 10:00:00-03');
alter table i add column dende uuid, add column embauba uuid, add column freijo uuid, add column inga uuid, add column gameleira uuid, add column hortensia uuid;
update i set dende = pg_temp.novo('Edifício Dendê', '5561999990710', 'COTACAO', (select com from ids)),
             freijo = pg_temp.novo('Edifício Freijó', '5561999990711', 'INDICACAO', (select com from ids)),
             inga = pg_temp.novo('Edifício Ingá', '5561999990712', 'INDICACAO', (select com from ids)),
             gameleira = pg_temp.novo('Edifício Gameleira', '5561999990713', 'INDICACAO', (select com from ids)),
             hortensia = pg_temp.novo('Edifício Hortênsia', '5561999990714', 'INDICACAO', (select com from ids));
update i set embauba = (comercial_entrada_site(jsonb_build_object('nome', 'Renata Moura', 'whatsapp', '5561999990715', 'condominio', 'Edifício Embaúba',
                                                                  'faixa', 'DE_41_A_100', 'consentimento', true, 'pagina', '/demonstracao')) ->> 'id')::uuid;
update interessados set primeiro_retorno_ate = null where id in (select inga from i union all select gameleira from i union all select hortensia from i);
select pg_temp.em('2026-11-09 10:20:00-03');
select comercial_registrar_conversa(com, freijo, 'WHATSAPP', 'Primeiro retorno.') from ids, i;
-- A Gameleira perde para o App X, é reaberta e ganha; a Hortênsia perde para a Uau Síndico, escrita de dois jeitos.
update interessados set concorrentes = '[{"nome": "App X", "venceu": true}]' where id = (select gameleira from i);
update interessados set concorrentes = '[{"nome": "Uau Síndico"}, {"nome": "uau sindico", "venceu": true}]' where id = (select hortensia from i);
select pg_temp.para(gameleira, 'PERDIDO', '2026-11-09 11:00-03', 'OUTRO_SISTEMA') from i;
select pg_temp.para(gameleira, 'NEGOCIACAO', '2026-11-09 12:00-03') from i;
select pg_temp.para(gameleira, 'GANHO', '2026-11-09 14:00-03') from i;
select pg_temp.para(hortensia, 'PERDIDO', '2026-11-09 11:00-03', 'OUTRO_SISTEMA') from i;
select pg_temp.em('2026-11-09 15:00:00-03');
select comercial_registrar_conversa(com, dende, 'WHATSAPP', 'Mandou a cotação.') from ids, i;
select comercial_registrar_conversa(com, inga, 'WHATSAPP', 'Retorno.') from ids, i;
create temp table pn as select pg_temp.painel(com) as p from ids;
select is((select p -> 'primeiroRetorno' from pn),
  '{"total": 2, "noPrazo": 1, "foraDoPrazo": 1, "aguardando": 0, "cotacoes": {"total": 1, "noPrazo": 1, "aguardando": 0},
    "site": {"total": 0, "noPrazo": 0, "aguardando": 1}, "medianaMinutosUteis": 20}'::jsonb,
  'K.1 pelos minutos úteis da entrada à resposta: a cotação (5 horas úteis, dentro das 24) fica fora da meta e conta à parte; a mediana é só de quem tem prazo; o site ainda dentro da promessa aguarda, fora do total');
select is((select x - 'nome' from pn, jsonb_array_elements(p -> 'concorrentes') x where x ->> 'nome' = 'App X'),
  '{"disputas": 1, "ganhamos": 1, "perdemosParaEle": 0}'::jsonb, 'perdido para o App X, reaberto e ganho: ganhamos, e não conta como perdido para ele');
select is((select jsonb_agg(x - 'nome') from pn, jsonb_array_elements(p -> 'concorrentes') x where comercial_normalizar(x ->> 'nome') = 'uausindico'),
  '[{"disputas": 1, "ganhamos": 0, "perdemosParaEle": 1}]'::jsonb, 'o mesmo concorrente escrito de dois jeitos no mesmo interessado conta uma disputa');

select * from finish();
rollback;

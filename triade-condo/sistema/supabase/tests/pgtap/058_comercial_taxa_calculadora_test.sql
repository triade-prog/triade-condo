-- Calculadora do site e taxa média de condomínio (0310, R17.6 e R17.3c; CM-19, CM-20 e CM-33; DC17):
-- a rota da calculadora só devolve o necessário (nunca a tabela inteira, a implantação ou as vagas),
-- o pedido de proposta com a faixa e a taxa preenchidas, a taxa na ficha, nas premissas da versão
-- (a enviada não muda), no link e no kit, a correção da taxa pelo kit e a anonimização que não quebra.
begin;
select plan(49);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Fábio', 'FINANCEIRO') as fin;
grant select on ids to dominio;

create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.pp(p uuid) returns integer language sql as $$ select versao from propostas_comercial where id = p $$;
create function pg_temp.site(p jsonb) returns jsonb language sql as $$
  select comercial_entrada_site(jsonb_build_object('nome', 'Paulo Dias', 'condominio', 'Edifício Aroeira', 'consentimento', true) || p) $$;
create function pg_temp.ficha(p uuid) returns jsonb language sql as $$ select comercial_ficha((select com from ids), p) $$;
create function pg_temp.premissas(p uuid) returns jsonb language sql as $$ select premissas from versoes_proposta where id = p $$;

select ajustar_relogio('2026-10-26 10:00:00-03'::timestamptz - now());

-- 1. A calculadora (quadros 348, 448 e 449).
select is(comercial_calculadora_site(64),
  '{"unidades": 64, "faixa": {"codigo": "DE_41_A_100", "nome": "41 a 100 unidades", "sobConsulta": false}, "tabela": "FUNDADOR",
    "mensal": 22900, "porApartamento": 358, "depoisFundador": 34900, "fundadorMeses": 12}'::jsonb,
  'com 64 unidades: a faixa, o preço de fundador e R$ 3,58 por apartamento');
select is(array[comercial_calculadora_site(20) ->> 'mensal', comercial_calculadora_site(20) ->> 'porApartamento', comercial_calculadora_site(20) -> 'faixa' ->> 'nome'],
  array['12900', '645', 'Até 40 unidades'], 'com 20 unidades: R$ 129,00 e R$ 6,45 por apartamento');
select is((select array_agg(k order by k) from jsonb_object_keys(comercial_calculadora_site(150)) k),
  array['depoisFundador', 'faixa', 'fundadorMeses', 'mensal', 'porApartamento', 'tabela', 'unidades'],
  'a rota só devolve o necessário: nada de implantação, vagas ou a tabela inteira');
select is((select array[r -> 'faixa' ->> 'sobConsulta', (r ? 'mensal')::text, (r ? 'porApartamento')::text] from (select comercial_calculadora_site(450) r) x),
  array['true', 'false', 'false'], 'acima de 400 unidades: sob consulta, sem valor');
select is(pg_temp.campos($$ select comercial_calculadora_site(0) $$), '["unidades"]'::jsonb, 'zero unidades é recusado');
select is(pg_temp.campos($$ select comercial_calculadora_site(null) $$), '["unidades"]'::jsonb, 'sem unidades é recusado');
select is(current_setting('app.comercial_sistema', true), '', 'a calculadora não deixa o contexto do sistema ligado');

-- 2. O pedido de proposta pela calculadora, com e sem a taxa.
create temp table s as select
  (pg_temp.site('{"whatsapp": "5561999990401", "pedido": "PROPOSTA", "unidades": 64, "taxaCondominio": "650"}') ->> 'id')::uuid as aroeira,
  (pg_temp.site('{"whatsapp": "5561999990402", "pedido": "PROPOSTA", "unidades": 20, "condominio": "Edifício Buriti"}') ->> 'id')::uuid as buriti;
select is((select array[faixa, unidades::text, taxa_condominio_media::text, origem, etapa] from interessados where id = (select aroeira from s)),
  array['DE_41_A_100', '64', '650.00', 'SITE', 'NOVO'], 'com a taxa: vira interessado com a faixa, as unidades e a taxa preenchidas');
select is((select resumo from conversas_comercial where interessado_id = (select aroeira from s)),
  'Pedido de proposta pela calculadora do site: Edifício Aroeira (64 unidades), taxa média de condomínio de R$ 650,00.',
  'a conversa de entrada diz o pedido, as unidades e a taxa');
select is((select array[faixa, unidades::text, coalesce(taxa_condominio_media::text, 'sem taxa')] from interessados where id = (select buriti from s)),
  array['ATE_40', '20', 'sem taxa'], 'sem a taxa: a faixa e as unidades, a taxa fica vazia');
select is((select resumo from conversas_comercial where interessado_id = (select buriti from s)),
  'Pedido de proposta pela calculadora do site: Edifício Buriti (20 unidades).', 'e a conversa sem a taxa');
select is(pg_temp.campos($$ select pg_temp.site('{"whatsapp": "5561999990403", "pedido": "PROPOSTA", "taxaCondominio": "0"}') $$), '["taxaCondominio"]'::jsonb,
  'taxa zero é recusada');
select is(pg_temp.campos($$ select pg_temp.site('{"whatsapp": "5561999990403", "pedido": "PROPOSTA", "taxaCondominio": "20000.01"}') $$), '["taxaCondominio"]'::jsonb,
  'taxa acima de R$ 20.000 é recusada');
select is(pg_temp.campos($$ select pg_temp.site('{"whatsapp": "5561999990403", "pedido": "PROPOSTA", "taxaCondominio": "650.123"}') $$), '["taxaCondominio"]'::jsonb,
  'taxa com mais de 2 casas é recusada');
select is(pg_temp.campos($$ select pg_temp.site('{"whatsapp": "5561999990403", "pedido": "ORCAMENTO"}') $$), '["pedido"]'::jsonb, 'pedido fora da lista é recusado');
select is(pg_temp.campos($$ select pg_temp.site('{"whatsapp": "5561999990403", "pedido": "PROPOSTA", "unidades": 0}') $$), '["unidades"]'::jsonb,
  'zero unidades é recusado');
select is(pg_temp.site('{"whatsapp": "5561999990402", "pedido": "PROPOSTA", "unidades": 20, "taxaCondominio": 480.5}') ->> 'juntado', 'true',
  'o mesmo WhatsApp junta no interessado que já existe');
select is((select taxa_condominio_media from interessados where id = (select buriti from s)), 480.50::numeric, 'e a taxa informada completa a ficha');
select is((select count(*)::int from interessados where whatsapp = '5561999990403'), 0, 'pedido recusado não cria interessado');

-- 3. A taxa na ficha.
select is((select pg_temp.ficha(aroeira) -> 'predio' ->> 'taxaCondominioMedia' from s), '650.00', 'a ficha mostra a taxa informada');
create function pg_temp.salvar(p uuid, p_extra jsonb) returns jsonb language sql as $$
  select comercial_salvar((select com from ids), p, pg_temp.iv(p), jsonb_build_object('condominio', 'Edifício Aroeira', 'pessoa', 'Paulo Dias',
    'whatsapp', '5561999990401', 'unidades', 64, 'faixa', 'DE_41_A_100') || p_extra) $$;
select pg_temp.salvar(aroeira, '{}') from s;
select is((select taxa_condominio_media from interessados where id = (select aroeira from s)), 650.00::numeric, 'salvar a ficha sem o campo não apaga a taxa');
select pg_temp.salvar(aroeira, '{"taxaCondominioMedia": 680.5}') from s;
select is((select taxa_condominio_media from interessados where id = (select aroeira from s)), 680.50::numeric, 'a ficha corrige a taxa');
select is((select pg_temp.campos(format('select pg_temp.salvar(%L, ''{"taxaCondominioMedia": 0}'')', aroeira)) from s), '["taxaCondominioMedia"]'::jsonb,
  'a ficha recusa taxa zero');
select is((select pg_temp.campos(format('select pg_temp.salvar(%L, ''{"taxaCondominioMedia": "650"}'')', aroeira)) from s), '["taxaCondominioMedia"]'::jsonb,
  'a ficha só aceita número');
select pg_temp.salvar(aroeira, '{"taxaCondominioMedia": null}') from s;
select is((select taxa_condominio_media from interessados where id = (select aroeira from s)), null, 'mandar vazio tira a taxa');
select pg_temp.salvar(aroeira, '{"taxaCondominioMedia": 650}') from s;

-- 4. A taxa nas premissas da versão (quadro 445).
select is((select comercial_sugestao_proposta(com, aroeira) -> 'interessado' ->> 'taxaCondominioMedia' from ids, s), '650.00',
  'a nova proposta já vem com a taxa da ficha');
create temp table p as select comercial_criar_proposta((select com from ids), (select aroeira from s), '{}') as a,
                              comercial_criar_proposta((select com from ids), (select buriti from s), '{"taxaCondominio": null}') as b;
select is((select pg_temp.premissas((a ->> 'versaoId')::uuid) ->> 'taxaCondominio' from p), '650.00', 'sem mexer no campo, a versão guarda a taxa da ficha');
select is((select pg_temp.premissas((a ->> 'versaoId')::uuid) ->> 'texto' from p),
  'Estimativa: R$ 229,00 por mês divididos por 64 unidades dá R$ 3,58 por apartamento por mês. A implantação é à parte. Não é cálculo de retorno. '
  || 'Taxa média de condomínio informada: R$ 650,00 por mês.', 'e o texto das premissas diz a taxa, sem prometer retorno');
select is((select array[pg_temp.premissas((b ->> 'versaoId')::uuid) ? 'taxaCondominio', (select taxa_condominio_media is null from interessados where id = (select buriti from s))]
             from p), array[false, true], 'apagar a taxa na versão: a versão fica sem a taxa e a ficha também');
select is((select pg_temp.campos(format('select comercial_nova_versao(%L, %L, %s, ''{"taxaCondominio": 0}'')', com, (a ->> 'id')::uuid, pg_temp.pp((a ->> 'id')::uuid)))
             from ids, p), '["taxaCondominio"]'::jsonb, 'a versão recusa taxa zero');
select is((select pg_temp.campos(format('select comercial_nova_versao(%L, %L, %s, ''{"taxaCondominio": 20001}'')', com, (a ->> 'id')::uuid, pg_temp.pp((a ->> 'id')::uuid)))
             from ids, p), '["taxaCondominio"]'::jsonb, 'e taxa acima de R$ 20.000');
create temp table v2 as select comercial_nova_versao((select com from ids), (a ->> 'id')::uuid, pg_temp.pp((a ->> 'id')::uuid), '{"taxaCondominio": 700}') as r from p;
select is((select pg_temp.premissas((r ->> 'versaoId')::uuid) ->> 'taxaCondominio' from v2), '700', 'a taxa digitada na versão fica na versão');
select is((select taxa_condominio_media from interessados where id = (select aroeira from s)), 700.00::numeric, 'e passa a ser a da ficha');
create temp table env as select comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid,
                                                          (select versao from versoes_proposta where id = (r ->> 'versaoId')::uuid)) as e,
                                (r ->> 'id')::uuid as proposta, (r ->> 'versaoId')::uuid as versao from v2;

-- 5. O link e o kit (quadros 446 e 447).
select is((select publico_proposta(e -> 'link' ->> 'codigo', null) -> 'premissas' ->> 'taxaCondominio' from env), '700', 'o link mostra a taxa da versão enviada');
select is((select publico_proposta(e -> 'link' ->> 'codigo', null) ->> 'porApartamento' from env), '358', 'com o valor por apartamento');
select is((select comercial_kit(com, proposta) ->> 'taxaCondominio' from ids, env), '700.00', 'o kit usa a taxa da ficha');
select is((select comercial_salvar_taxa(com, aroeira, pg_temp.iv(aroeira), 650) ->> 'taxaCondominio' from ids, s), '650', 'o kit corrige a taxa');
select is((select comercial_kit(com, proposta) ->> 'taxaCondominio' from ids, env), '650.00', 'o kit passa a mostrar a taxa corrigida');
select is((select publico_kit_proposta(e -> 'link' ->> 'codigo') ->> 'taxaCondominio' from env), '650.00', 'e o kit pelo link também');
select is((select array[v.premissas ->> 'taxaCondominio', (v.hash = comercial_hash(proposta_conteudo(v)))::text]
             from env join versoes_proposta v on v.id = env.versao), array['700', 'true'], 'a versão enviada não muda');
select is((select pg_temp.erro(format('select comercial_salvar_taxa(%L, %L, 1, 600)', com, aroeira)) ->> 'codigo' from ids, s), 'TC409',
  'com a versão velha da ficha, conflito');
select throws_ok($$ select comercial_salvar_taxa(fin, aroeira, pg_temp.iv(aroeira), 600) from ids, s $$, 'TC401', null, 'sem o Comercial, não corrige a taxa');
select is((select pg_temp.campos(format('select comercial_salvar_taxa(%L, %L, %s, 20000.5)', com, aroeira, pg_temp.iv(aroeira))) from ids, s), '["taxaCondominio"]'::jsonb,
  'o kit recusa taxa acima de R$ 20.000');
select ok(exists (select 1 from historico where acao = 'comercial.taxa_condominio' and interno and entidade_id = (select aroeira::text from s)),
  'a correção fica no histórico interno');
select comercial_salvar_taxa(com, aroeira, pg_temp.iv(aroeira), null) from ids, s;
select is((select comercial_kit(com, proposta) ->> 'taxaCondominio' from ids, env), '700', 'sem a taxa na ficha, o kit usa a da versão enviada');
select comercial_salvar_taxa(com, aroeira, pg_temp.iv(aroeira), 650) from ids, s;
create temp table v3 as select comercial_nova_versao((select com from ids), proposta, pg_temp.pp(proposta), '{}') as r from env;
select is((select pg_temp.premissas((r ->> 'versaoId')::uuid) ->> 'taxaCondominio' from v3), '650.00', 'a próxima versão já vem com a taxa corrigida');

-- 6. A anonimização (a taxa não é dado pessoal): nada quebra.
select comercial_excluir(adm, aroeira) from ids, s;
select is((select array[(anonimizado_em is not null)::text, taxa_condominio_media::text] from interessados where id = (select aroeira from s)),
  array['true', '650.00'], 'o interessado é anonimizado e a taxa do prédio fica');
select is((select pg_temp.ficha(aroeira) -> 'predio' ->> 'taxaCondominioMedia' from s), '650.00', 'a ficha anonimizada abre, com a taxa');
select is((select pg_temp.erro(format('select comercial_salvar_taxa(%L, %L, %s, 600)', com, aroeira, pg_temp.iv(aroeira))) -> 'detalhe' ->> 'motivo' from ids, s),
  'ANONIMIZADO', 'anonimizado não muda a taxa');

select * from finish();
rollback;

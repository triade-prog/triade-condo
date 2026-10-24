-- Área E da rodada com banco (0297): quem assume os pedidos e as manutenções de quem tem o acesso
-- revogado (CF-04, CF-05, MP-01, MP-03); a imagem dentro da mensagem do chamado (PI-20); o Pronto
-- do link do prestador, com tudo o que ele mandou e as fotos (V-11, MP-08).
begin;
select plan(75);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Caio') as caio,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba from ids;
create temp table vj as select teste.vincular(davi, jatoba) as v_davi from ids, c;
select console_atribuir(adm, ipe, sup, 'SUPORTE') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, caio, 'Caio', 'Portaria', array['RESPONDER']) as v_caio,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administradora', array['RESPONDER', 'VER_MANUTENCAO']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Administradora', array['RESPONDER']) as v_lia
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v from c, vs, unnest(array[v_ana, v_caio, v_gil, v_lia]) v;
update configuracao_condominio set responsavel_padrao = (select v_ana from vs) where condominio_id = (select ipe from c);
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');
select ajustar_relogio(timestamptz '2027-03-03 10:00:00-03' - now());
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from prioridades where condominio_id = ipe and modelo = 'ALTA') as alta
  from c;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.pedido(p_assunto text, p_responsavel uuid) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), null, null, 'Garagem', (select manutencao from cfg),
                                      (select normal from cfg), p_assunto, 'O portão está travando.', 'TELEFONE', false, p_responsavel) ->> 'id')::uuid $$;
create function pg_temp.vv(p uuid) returns integer language sql as $$ select versao from vinculos where id = p $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from manutencoes where id = p $$;
create function pg_temp.pessoa(p_vinculo uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements(plataforma_pessoas((select ana from ids), (select ipe from c)) -> 'pessoas') x
   where x ->> 'vinculoId' = p_vinculo::text $$;

-- ---------------------------------------------------------------------------------------
-- 1. Revogar e quem assume (CF-04, CF-05, MP-01, MP-03).

create temp table pe as select
  pg_temp.pedido('Portão travando', v_gil) as p1,
  pg_temp.pedido('Portão rangendo', v_gil) as p2,
  pg_temp.pedido('Interfone mudo', v_caio) as p3
  from vs;
update pedidos set aceito_em = app_now() where id = (select p1 from pe);
create temp table mt as select
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba com ruído', 'Casa de bombas', null, alta, v_gil,
     null, null, null, null, null, null, null) ->> 'id')::uuid as m1,
  (plataforma_salvar_preventiva(ana, ipe, null, null, 'Limpeza da caixa-d''água', 'Caixas-d''água', 'MES', 6, hoje + 60, 15, v_gil,
     null, null, null, null, true) ->> 'id')::uuid as pv1,
  (plataforma_salvar_preventiva(ana, ipe, null, null, 'Recarga dos extintores', 'Todos os andares', 'ANO', 1, hoje + 90, 15, v_gil,
     null, null, null, null, false) ->> 'id')::uuid as pv2
  from ids, c, vs, cfg, d;

select is(pg_temp.pessoa(v_gil) -> 'emAberto', '{"pedidos": 2, "manutencoes": 2}'::jsonb,
  'CF-05: a lista de Pessoas conta os pedidos em aberto e as manutenções e preventivas ativas da pessoa') from vs;
select is(pg_temp.pessoa(v_lia) -> 'emAberto', '{"pedidos": 0, "manutencoes": 0}'::jsonb, 'CF-05: sem nada em aberto, a contagem é zero') from vs;
select ok((pg_temp.pessoa(v_bruna) ->> 'cuidaManutencao')::boolean and not (pg_temp.pessoa(v_lia) ->> 'cuidaManutencao')::boolean,
  'MP-01: a lista diz quem pode cuidar da manutenção') from vs;

select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_lia)) from ids, c, vs $$),
  'MANUTENCOES_SEM_RESPONSAVEL', 'MP-01: quem cuida de manutenção só sai com alguém assumindo');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false, null) from ids, c, vs $$),
  'MANUTENCOES_SEM_RESPONSAVEL', 'MP-01: sem dizer quem assume, também não sai');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_lia, 'manutencoes', v_lia)) from ids, c, vs $$),
  'ASSUME_MANUTENCOES_INVALIDO', 'MP-01: quem assume as manutenções precisa ver a manutenção');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_lia, 'manutencoes', v_gil)) from ids, c, vs $$),
  'ASSUME_MANUTENCOES_INVALIDO', 'MP-01: quem sai não assume as próprias manutenções');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_bruna, 'manutencoes', v_bruna)) from ids, c, vs $$),
  'ASSUME_PEDIDOS_INVALIDO', 'CF-05: só quem atende assume os pedidos');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_gil, 'manutencoes', v_bruna)) from ids, c, vs $$),
  'ASSUME_PEDIDOS_INVALIDO', 'CF-05: quem sai não assume os próprios pedidos');
update responsaveis_atendimento set disponivel = false where vinculo_id = (select v_lia from vs);
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_lia, 'manutencoes', v_bruna)) from ids, c, vs $$),
  'ASSUME_PEDIDOS_INVALIDO', 'CF-05: quem assume os pedidos está disponível');
update responsaveis_atendimento set disponivel = true where vinculo_id = (select v_lia from vs);
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_davi, 'manutencoes', v_bruna)) from ids, c, vs, vj $$),
  'ASSUME_PEDIDOS_INVALIDO', 'CF-05: quem assume os pedidos é deste condomínio');
select is(pg_temp.motivo($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                                   jsonb_build_object('pedidos', v_lia, 'manutencoes', v_davi)) from ids, c, vs, vj $$),
  'ASSUME_MANUTENCOES_INVALIDO', 'MP-01: quem assume as manutenções é deste condomínio');
select is((select count(*)::integer from pedidos, vs where responsavel_id = v_gil), 2, 'CF-04: a recusa não mexe em nada');
select ok((select m.responsavel_id = v_gil and p1.responsavel_id = v_gil and p2.responsavel_id = v_gil and v.revogado_em is null
             from mt, vs, manutencoes m, preventivas p1, preventivas p2, vinculos v
            where m.id = mt.m1 and p1.id = mt.pv1 and p2.id = mt.pv2 and v.id = v_gil),
  'MP-01: nem as manutenções, nem as preventivas, nem o acesso');
select ok(not exists (select 1 from historico where acao = 'pessoa.repasse'), 'CF-04: a recusa não deixa repasse no histórico');

select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                          jsonb_build_object('pedidos', v_lia, 'manutencoes', v_bruna)) from ids, c, vs $$,
  'CF-04: revogar dizendo quem assume os pedidos e as manutenções');
select is((select array_agg(distinct responsavel_id) from pedidos, pe where id in (p1, p2)), (select array[v_lia] from vs),
  'CF-05: os pedidos em aberto vão para quem a síndica escolheu (não para a padrão)');
select ok((select bool_and(aceito_em is null and responsavel_desde = app_now()) from pedidos, pe where id in (p1, p2)),
  'CF-05: quem assume confirma o aceite');
select is((select count(*)::integer from historico, pe where acao = 'pedido.responsavel' and entidade_id in (p1::text, p2::text)
            and dados ->> 'motivo' = 'Acesso revogado' and dados ->> 'para' = (select v_lia::text from vs)), 2,
  'CF-05: cada pedido guarda no histórico quem assumiu e por quê');
select is((select responsavel_id from manutencoes, mt where id = m1), (select v_bruna from vs), 'MP-01: a manutenção em aberto passa para quem assume');
select is((select responsavel_id from preventivas, mt where id = pv1), (select v_bruna from vs), 'MP-03: a preventiva ativa também passa');
select is((select responsavel_id from preventivas, mt where id = pv2), (select v_gil from vs), 'MP-03: a preventiva desligada fica como estava');
select ok(exists (select 1 from historico, mt where acao = 'manutencao.alterada' and entidade_id = m1::text
                   and dados -> 'campos' = '["responsavel"]' and dados ->> 'motivo' = 'Acesso revogado'),
  'MP-01: a troca do responsável fica no histórico da manutenção');
select ok(exists (select 1 from historico, mt where acao = 'preventiva.alterada' and entidade_id = pv1::text and dados ->> 'motivo' = 'Acesso revogado'),
  'MP-03: e no da preventiva');
select ok((select revogado_em is not null from vinculos, vs where id = v_gil), 'CF-04: o acesso foi revogado');
select is((select dados from historico, vs where acao = 'pessoa.repasse' and entidade_id = v_gil::text),
  (select jsonb_build_object('pedidos', jsonb_build_object('para', v_lia, 'quantidade', 2),
                             'manutencoes', jsonb_build_object('para', v_bruna, 'quantidade', 1, 'preventivas', 1)) from vs),
  'CF-04: o histórico da revogação diz quem assumiu os pedidos e as manutenções, e quantos');
select ok((select r.id > v.id from historico r, historico v, vs where r.acao = 'pessoa.repasse' and v.acao = 'pessoa.revogada'
            and r.entidade_id = v_gil::text and v.entidade_id = v_gil::text), 'CF-04: o repasse vem logo depois da revogação');
select is(pg_temp.pessoa(v_lia) -> 'emAberto', '{"pedidos": 2, "manutencoes": 0}'::jsonb, 'CF-05: a contagem acompanha quem assumiu') from vs;

select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_lia, pg_temp.vv(v_lia), null, false, '{"pedidos": null}'::jsonb) from ids, c, vs $$,
  'CF-05: revogar deixando os pedidos na fila sem responsável');
select ok((select bool_and(responsavel_id is null and responsavel_desde is null) from pedidos, pe where id in (p1, p2)),
  'CF-05: os pedidos ficam na fila sem responsável, à vista');
select is((select dados from historico, vs where acao = 'pessoa.repasse' and entidade_id = v_lia::text),
  '{"pedidos": {"para": null, "quantidade": 2}}'::jsonb, 'CF-05: o histórico diz que os pedidos ficaram sem responsável');

select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_caio, pg_temp.vv(v_caio), null, false) from ids, c, vs $$,
  'CF-05: sem dizer quem assume os pedidos, vale o de antes');
select is((select responsavel_id from pedidos, pe where id = p3), (select v_ana from vs), 'CF-05: o pedido vai para o responsável padrão');
select ok(not exists (select 1 from historico, vs where acao = 'pessoa.repasse' and entidade_id = v_caio::text),
  'CF-05: sem escolha, não há repasse a registrar (cada pedido já registra a troca)');

-- ---------------------------------------------------------------------------------------
-- 2. A imagem dentro da mensagem do chamado (PI-20).

select ajustar_relogio(timestamptz '2027-03-04 09:00:00-03' - now());
create temp table au as select
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administradora', array['RESPONDER']) as v_gil2 from ids, c;
create temp table ch as select
  plataforma_abrir_chamado(gil, ipe, 'PROBLEMA', 'PEDIDOS', 'Fila some depois de filtrar', 'Escolho Limpeza e a lista fica vazia.') as r1,
  plataforma_abrir_chamado(ana, ipe, 'DUVIDA', 'COMUNICADOS', 'Como mudar o horário?', 'Quero mudar o horário sem envio.') as r2
  from ids, c;
create temp table chi as select (r1 ->> 'id')::uuid as ch1, (r1 ->> 'mensagemId')::uuid as m1, (r2 ->> 'id')::uuid as ch2,
  (r2 ->> 'mensagemId')::uuid as m_ch2 from ch;
select is((select id from mensagens_chamado, chi where chamado_id = ch1), (select m1 from chi),
  'PI-20: abrir o chamado devolve a mensagem, para subir as imagens nela');
select ok((select r2 ? 'numero' and r2 ? 'mensagemId' from ch), 'PI-20: a resposta de abrir continua com o número');
create temp table mu as select plataforma_pedir_mudanca(ana, ipe, 'FUSO', 'Mudar: Fuso do condomínio', 'America/Sao_Paulo',
  'Precisamos do fuso do Acre.') as r from ids, c;
select is((select r ->> 'mensagemId' from mu), (select m.id::text from mensagens_chamado m, mu where m.chamado_id = (mu.r ->> 'id')::uuid),
  'PI-20: pedir mudança também devolve a mensagem');

select ajustar_relogio(timestamptz '2027-03-04 09:01:00-03' - now());
select console_responder_chamado(sup, ipe, ch1, 'Pode mandar o print da tela?', false) from ids, c, chi;
create temp table mt2 as select (select id from mensagens_chamado, chi where chamado_id = ch1 and lado = 'TRIADE') as m_triade;
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m_triade, 'p.png', 'image/png', 1000) from ids, c, chi, mt2 $$),
  'MENSAGEM_DE_OUTRO', 'PI-20: imagem não vai na mensagem da TRÍADE');
select ajustar_relogio(timestamptz '2027-03-04 09:02:00-03' - now());
create temp table ma as select (plataforma_responder_chamado(ana, ipe, ch1, 'Também vejo isso aqui.') ->> 'mensagemId')::uuid as m_ana
  from ids, c, chi;
select is((select autor_id from mensagens_chamado, ma where id = m_ana), (select ana from ids), 'PI-20: responder devolve a mensagem nova');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m_ana, 'p.png', 'image/png', 1000) from ids, c, chi, ma $$),
  'MENSAGEM_DE_OUTRO', 'PI-20: imagem só na própria mensagem');
select throws_ok($$ select plataforma_iniciar_arquivo_chamado(ana, ipe, ch2, m1, 'p.png', 'image/png', 1000) from ids, c, chi $$, 'TC404', null,
  'PI-20: mensagem de outro chamado é recusada');
create temp table im as select
  (plataforma_iniciar_arquivo_chamado(ana, ipe, ch1, m_ana, 'da-sindica.png', 'image/png', 1000) ->> 'arquivoId')::uuid as a_ana,
  (plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m1, 'g1.png', 'image/png', 1000) ->> 'arquivoId')::uuid as g1,
  (plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m1, 'g2.png', 'image/png', 1000) ->> 'arquivoId')::uuid as g2,
  (plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m1, 'g3.png', 'image/png', 1000) ->> 'arquivoId')::uuid as g3
  from ids, c, chi, ma;
select ok((select count(*) = 4 from arquivos_chamado, chi where chamado_id = ch1),
  'PI-20: quem vê o chamado (a síndica também) junta imagem na própria mensagem');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m1, 'g4.png', 'image/png', 1000) from ids, c, chi $$),
  'LIMITE_IMAGENS_MENSAGEM', 'PI-20: até 3 imagens por mensagem');
select plataforma_verificar_arquivo_chamado(gil, ipe, ch1, g1, false, null, 'Arquivo corrompido') from ids, c, chi, im;
select lives_ok($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m1, 'g4.png', 'image/png', 1000) from ids, c, chi $$,
  'PI-20: a imagem recusada não conta no limite');
select plataforma_verificar_arquivo_chamado(gil, ipe, ch1, g2, true, 900, null), plataforma_verificar_arquivo_chamado(ana, ipe, ch1, a_ana, true, 900, null)
  from ids, c, chi, im;

create temp table cp as select plataforma_chamado(gil, ipe, ch1) as v from ids, c, chi;
select is((select jsonb_agg(x -> 'imagens') from cp, jsonb_array_elements(v -> 'mensagens') x),
  (select jsonb_build_array(jsonb_build_array(jsonb_build_object('id', g2, 'nome', 'g2.png', 'tipo', 'image/png')), '[]'::jsonb,
                            jsonb_build_array(jsonb_build_object('id', a_ana, 'nome', 'da-sindica.png', 'tipo', 'image/png'))) from im),
  'PI-20: cada mensagem traz as próprias imagens liberadas (a enviando e a recusada não aparecem)');
select is((select x ->> 'mensagemId' from cp, jsonb_array_elements(v -> 'arquivos') x where x ->> 'id' = (select g1::text from im)),
  (select m1::text from chi), 'PI-20: a lista de imagens diz de que mensagem é cada uma');
select is((v ->> 'imagensRestantes')::integer, 6, 'PI-20: cabem 10 por chamado; a recusada não conta') from cp;
select is((select jsonb_agg(jsonb_array_length(x -> 'imagens')) from jsonb_array_elements(console_chamado(sup, ipe, ch1) -> 'mensagens') x),
  '[1, 0, 1]'::jsonb, 'PI-20: o Console vê as imagens em cada mensagem') from ids, c, chi;

create temp table mais as select
  (plataforma_responder_chamado(gil, ipe, ch1, 'Mais prints da tela.') ->> 'mensagemId')::uuid as m2 from ids, c, chi;
select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m2, 'h' || n || '.png', 'image/png', 1000) from ids, c, chi, mais, generate_series(1, 3) n;
update mais set m2 = (plataforma_responder_chamado(gil, ipe, ch1, 'E outros prints.') ->> 'mensagemId')::uuid from ids, c, chi;
select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m2, 'k' || n || '.png', 'image/png', 1000) from ids, c, chi, mais, generate_series(1, 2) n;
update mais set m2 = (plataforma_responder_chamado(gil, ipe, ch1, 'Último print.') ->> 'mensagemId')::uuid from ids, c, chi;
select lives_ok($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m2, 'z1.png', 'image/png', 1000) from ids, c, chi, mais $$,
  'PI-20: a décima imagem do chamado entra');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch1, m2, 'z2.png', 'image/png', 1000) from ids, c, chi, mais $$),
  'LIMITE_IMAGENS', 'PI-20: até 10 imagens por chamado');
select is((select jsonb_build_object('restantes', v -> 'imagensRestantes', 'pode', v -> 'pode' -> 'enviarImagem')
             from (select plataforma_chamado(gil, ipe, ch1) as v from ids, c, chi) x),
  '{"restantes": 0, "pode": false}'::jsonb, 'PI-20: cheio, a tela não oferece mais imagem');

select ajustar_relogio(timestamptz '2027-03-04 09:16:00-03' - now());
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(ana, ipe, ch2, m_ch2, 'p.png', 'image/png', 1000) from ids, c, chi $$),
  'MENSAGEM_ANTIGA', 'PI-20: só na mensagem recém-enviada (15 minutos)');
select ok((select (v -> 'pode' ->> 'enviarImagem')::boolean from (select plataforma_chamado(ana, ipe, ch2) as v from ids, c, chi) x),
  'PI-20: com espaço, a tela oferece imagem ao responder');

-- As imagens de antes da 0297, ainda sem mensagem, vão para a mensagem anterior mais próxima de
-- quem enviou (ou para a primeira do chamado). Aqui se tira o "not null" só para refazer o caso.
select ajustar_relogio(timestamptz '2027-03-05 09:00:00-03' - now());
create temp table ch3 as select (plataforma_abrir_chamado(gil, ipe, 'PROBLEMA', 'AGENDA', 'Agenda não abre', 'A agenda fica em branco.') ->> 'id')::uuid as c3
  from ids, c;
select ajustar_relogio(timestamptz '2027-03-05 09:05:00-03' - now());
select console_responder_chamado(sup, ipe, c3, 'Qual navegador?', false) from ids, c, ch3;
select ajustar_relogio(timestamptz '2027-03-05 09:10:00-03' - now());
create temp table ch3m as select (plataforma_responder_chamado(gil, ipe, c3, 'Chrome no celular.') ->> 'mensagemId')::uuid as g_resp from ids, c, ch3;
select ajustar_relogio(timestamptz '2027-03-05 09:20:00-03' - now());
alter table arquivos_chamado alter column mensagem_id drop not null;
insert into arquivos_chamado (id, condominio_id, chamado_id, nome, tipo, tamanho_declarado, tamanho, caminho, situacao, enviado_em, enviado_por, verificado_em)
select x.id, ipe, c3, x.nome, 'image/png', 1000, x.tamanho, 'antiga/' || x.nome, x.situacao, x.em,
       case x.quem when 'GIL' then gil else ana end, x.verificado
  from c, ch3, ids, (values
    ('00000000-0000-4000-8000-0000000000a1'::uuid, 'antes.png', timestamptz '2027-03-05 09:01:00-03', 'GIL', 1000, 'LIBERADO', timestamptz '2027-03-05 09:01:00-03'),
    ('00000000-0000-4000-8000-0000000000a2'::uuid, 'depois.png', timestamptz '2027-03-05 09:12:00-03', 'GIL', null, 'ENVIANDO', null),
    ('00000000-0000-4000-8000-0000000000a3'::uuid, 'da-sindica.png', timestamptz '2027-03-05 09:15:00-03', 'ANA', 1000, 'LIBERADO', timestamptz '2027-03-05 09:15:00-03'))
    as x(id, nome, em, quem, tamanho, situacao, verificado);
select is(ligar_imagens_antigas_chamado(), 3, 'PI-20: as imagens antigas ganham mensagem');
select is((select jsonb_object_agg(a.nome, case when a.mensagem_id = g_resp then 'resposta' when m.lado = 'CLIENTE' and m.autor_id = gil then 'abertura' else '?' end)
             from arquivos_chamado a join mensagens_chamado m on m.id = a.mensagem_id, ch3, ch3m, ids where a.chamado_id = c3),
  '{"antes.png": "abertura", "depois.png": "resposta", "da-sindica.png": "abertura"}'::jsonb,
  'PI-20: cada antiga vai para a mensagem anterior mais próxima de quem enviou; sem ela, para a primeira do chamado');
select throws_ok($$ update arquivos_chamado set mensagem_id = (select g_resp from ch3m) where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'TC422', null, 'PI-20: depois de ligada, a mensagem da imagem não muda');
alter table arquivos_chamado alter column mensagem_id set not null;

-- ---------------------------------------------------------------------------------------
-- 3. O Pronto do link do prestador (V-11, MP-08).

create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'HidroPress Bombas', 'Bombas', 'Márcio', '+5561933441200', null, null,
                               'CHAMADO', null, null, null, null) ->> 'id')::uuid as hidro
  from ids, c;
create temp table mp as select
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba de recalque com ruído', 'Casa de bombas', null, alta, v_bruna,
     hidro, null, null, null, null, null, null) ->> 'id')::uuid as mp1,
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba do poço', 'Poço', null, alta, v_bruna,
     hidro, null, null, null, null, null, null) ->> 'id')::uuid as mp2
  from ids, c, vs, pr, cfg;
create temp table lk as select
  (plataforma_criar_link_prestador(ana, ipe, mp1, pg_temp.vm(mp1), 'Trocar o rolamento da bomba 2.', 'Hoje, 14h', 'Portaria.', hoje + 14, null)
     ->> 'codigo') as k1,
  (plataforma_criar_link_prestador(ana, ipe, mp2, pg_temp.vm(mp2), 'Olhar a bomba do poço.', 'Amanhã', 'Portaria.', hoje + 14, null)
     ->> 'codigo') as k2
  from ids, c, mp, d;
select is(publico_prestador(k1) -> 'registros', '[]'::jsonb, 'V-11: sem nada mandado, a lista vem vazia') from lk;
select ok(not (publico_prestador(k1) ? 'respondidoEm'), 'V-11: sem resposta, não há hora de resposta') from lk;

select ajustar_relogio(timestamptz '2027-03-05 14:00:00-03' - now());
select publico_prestador_chegada(k1, null) from lk;
select ajustar_relogio(timestamptz '2027-03-05 14:30:00-03' - now());
create temp table ft as select
  (publico_prestador_iniciar_foto(k1, 'antes.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f1,
  (publico_prestador_iniciar_foto(k1, 'depois.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f2,
  (publico_prestador_iniciar_foto(k1, 'chegando.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f3,
  (publico_prestador_iniciar_foto(k1, 'solta.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f4,
  (publico_prestador_iniciar_foto(k1, 'ruim.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f5,
  (publico_prestador_iniciar_foto(k2, 'poco.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f_outro
  from lk;
select publico_prestador_verificar_foto(k1, f1, true, 900, null), publico_prestador_verificar_foto(k1, f2, true, 900, null),
       publico_prestador_verificar_foto(k1, f4, true, 900, null), publico_prestador_verificar_foto(k1, f5, false, null, 'Não é uma foto'),
       publico_prestador_verificar_foto(k2, f_outro, true, 900, null)
  from lk, ft;
select publico_prestador_impedimento(k2, 'SEM_ACESSO', 'Ninguém com a chave do poço.', array[f_outro]) from lk, ft;

-- O link de outro condomínio, com a foto já enviada num registro.
create temp table lkj as
  with pj as (select (plataforma_salvar_prestador(davi, jatoba, null, null, 'Poços Acre', 'Bombas', null, '+5568933331111', null, null,
                                                  'CHAMADO', null, null, null, null) ->> 'id')::uuid as pr from ids, c),
       mj as (select (plataforma_registrar_manutencao(davi, jatoba, 'CORRETIVA', 'Bomba do hall', 'Hall', null,
                        (select id from prioridades where condominio_id = jatoba and modelo = 'ALTA'), v_davi, pr,
                        null, null, null, null, null, null) ->> 'id')::uuid as mm from ids, c, vj, pj)
  select (plataforma_criar_link_prestador(davi, jatoba, mm, pg_temp.vm(mm), 'Olhar a bomba do hall.', null, null, hoje + 14, null)
            ->> 'codigo') as kj
    from ids, c, mj, d;
create temp table ftj as select (publico_prestador_iniciar_foto(kj, 'hall.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as fj from lkj;
select publico_prestador_verificar_foto(kj, fj, true, 900, null) from lkj, ftj;
select publico_prestador_impedimento(kj, 'SEM_ACESSO', 'Hall fechado.', array[fj]) from lkj, ftj;
select publico_prestador_impedimento(k1, 'FALTA_PECA', 'Falta o rolamento 6204.', array[f1]) from lk, ft;
select ajustar_relogio(timestamptz '2027-03-05 16:00:00-03' - now());
select publico_prestador_terminei(k1, 'Troquei o rolamento e testei.', true, 'Pintar a base da bomba.', 'Márcio', array[f2]) from lk, ft;

create temp table pp as select publico_prestador(k1) as v from lk;
select is((select jsonb_agg(x - 'id' - 'fotos' - 'em') from pp, jsonb_array_elements(v -> 'registros') x),
  '[{"tipo": "TERMINOU", "texto": "Troquei o rolamento e testei.", "quemFez": "Márcio", "ficouPendente": true,
     "pendenteTexto": "Pintar a base da bomba."},
    {"tipo": "IMPEDIMENTO", "impedimento": "FALTA_PECA", "texto": "Falta o rolamento 6204."},
    {"tipo": "CHEGOU", "confirmado": false}]'::jsonb,
  'V-11: a página mostra tudo o que o prestador mandou, do mais novo ao mais antigo');
select is((select array_agg((x ->> 'em')::timestamptz) from pp, jsonb_array_elements(v -> 'registros') x),
  array[timestamptz '2027-03-05 16:00:00-03', timestamptz '2027-03-05 14:30:00-03', timestamptz '2027-03-05 14:00:00-03'],
  'V-11: com a hora de cada envio');
select ok((select bool_and(x ? 'id') from pp, jsonb_array_elements(v -> 'registros') x), 'V-11: cada registro tem o seu id');
select is((select jsonb_agg(x -> 'fotos') from pp, jsonb_array_elements(v -> 'registros') x),
  (select jsonb_build_array(jsonb_build_array(jsonb_build_object('id', f2, 'nome', 'depois.jpg', 'tipo', 'image/jpeg')),
                            jsonb_build_array(jsonb_build_object('id', f1, 'nome', 'antes.jpg', 'tipo', 'image/jpeg')),
                            '[]'::jsonb) from ft),
  'V-11: cada registro traz as fotos que foram com ele');
select is((v ->> 'respondidoEm')::timestamptz, timestamptz '2027-03-05 14:00:00-03', 'V-11: a página diz quando o prestador respondeu') from pp;

select is(publico_prestador_foto(k1, f1) - 'caminho', '{"nome": "antes.jpg", "tipo": "image/jpeg"}'::jsonb,
  'V-11: a foto do próprio link abre pela página') from lk, ft;
select is(publico_prestador_foto(k1, f1) ->> 'caminho', (select caminho from arquivos_prestador, ft where id = f1),
  'V-11: com o caminho no armazenamento da manutenção') from lk, ft;
select throws_ok($$ select publico_prestador_foto(k1, f_outro) from lk, ft $$, 'TC404', null, 'V-11: a foto de outro link é recusada');
select throws_ok($$ select publico_prestador_foto(k1, f3) from lk, ft $$, 'TC404', null, 'V-11: a foto ainda não liberada não abre');
select throws_ok($$ select publico_prestador_foto(k1, f5) from lk, ft $$, 'TC404', null, 'V-11: a foto recusada na conferência não abre');
select throws_ok($$ select publico_prestador_foto(k1, fj) from lk, ftj $$, 'TC404', null, 'V-11: a foto do link de outro condomínio é recusada');
-- Decisão: abre só a foto que foi junto de um registro, porque a página só mostra essas. A foto
-- liberada e ainda solta (não foi com um "não consegui fazer" nem com um "terminei") não abre.
select throws_ok($$ select publico_prestador_foto(k1, f4) from lk, ft $$, 'TC404', null, 'V-11: a foto liberada que nunca foi enviada num registro não abre');
select lives_ok($$ select publico_prestador_foto(kj, fj) from lkj, ftj $$, 'V-11: no próprio link, a foto do outro condomínio abre');

select plataforma_tirar_foto_prestador(ana, ipe, mp1, f2, 'Foto de outro serviço') from ids, c, mp, ft;
select is((select jsonb_agg(jsonb_array_length(x -> 'fotos')) from jsonb_array_elements(publico_prestador((select k1 from lk)) -> 'registros') x),
  '[0, 1, 0]'::jsonb, 'V-11: a foto retirada pela síndica some da página');
select throws_ok($$ select publico_prestador_foto(k1, f2) from lk, ft $$, 'TC404', null, 'V-11: e não abre mais');

select plataforma_concluir_manutencao(ana, ipe, mp1, pg_temp.vm(mp1), 'Rolamento trocado e bomba testada pelo prestador.', (app_now() at time zone 'America/Sao_Paulo')::date, true) from ids, c, mp;
select is(publico_prestador(k1) - 'condominio', '{"encerrado": true, "motivo": "CONCLUIDA"}'::jsonb,
  'V-11: com o link encerrado, a página diz só que encerrou') from lk;
select is(pg_temp.motivo($$ select publico_prestador_foto(k1, f1) from lk, ft $$), 'LINK_ENCERRADO', 'V-11: e as fotos não abrem mais');

select * from finish();
rollback;

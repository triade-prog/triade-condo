-- Motor de IA com freio (0298; IA-20, IA-17, IA-15, IA-16, IA-11 triagem, W-06, NG-13, NG-15, PT-01):
-- a chave da TRÍADE, o limite do mês, o registro de cada chamada, a sugestão que nunca se aplica
-- sozinha e a transcrição do áudio só no painel.
begin;
select plan(61);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Sueli', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndica Bia') as bia;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Residencial Cedro', 'Brasília', 'DF', null) as cedro
  from ids;
select teste.vincular(ana, ipe), teste.vincular(bia, cedro), console_atribuir(adm, ipe, sup, 'SUPORTE'),
       plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Conselho', array['ACOMPANHAR'])
  from ids, c;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create temp table cfg as select
  (select id from categorias, c where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from categorias, c where condominio_id = ipe and modelo = 'LIMPEZA') as limpeza,
  (select id from prioridades, c where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from prioridades, c where condominio_id = ipe and modelo = 'URGENTE') as urgente;

create function pg_temp.registrar(p_assunto text) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), null, null, 'Casa de bombas', (select limpeza from cfg),
            (select normal from cfg), p_assunto, 'Vazamento forte no banheiro social, a água está descendo pela parede.', 'TELEFONE', false, null) ->> 'id')::uuid $$;
create function pg_temp.pedir(p_pedido uuid) returns jsonb language sql as $$
  select plataforma_pedir_sugestao_pedido((select ana from ids), (select ipe from c), p_pedido, array['TESTE']) $$;
create function pg_temp.responder(p_sugestao uuid, p_confianca text, p_cat uuid) returns jsonb language sql as $$
  select plataforma_resultado_sugestao((select ana from ids), (select ipe from c), p_sugestao, jsonb_build_object(
    'ok', true, 'provedor', 'TESTE', 'modelo', 'teste-1', 'tokensEntrada', 900, 'tokensSaida', 80, 'custoMicros', 130, 'moeda', 'USD',
    'categoriaId', p_cat, 'prioridadeId', (select urgente from cfg), 'local', 'Banheiro social', 'porque', 'Fala em vazamento.',
    'confianca', p_confianca)) $$;
create function pg_temp.versao_ia() returns integer language sql as $$
  select (console_ia_cliente((select adm from ids), (select ipe from c)) ->> 'versao')::integer $$;

-- 1. A chave da TRÍADE nasce desligada e só a Administração muda (IA-20).
create temp table p as select pg_temp.registrar('Antes de ligar') as p0;
select is((select plataforma_ajuda_ia(ana, ipe) ->> 'ligadaTriade' from ids, c), 'false', 'IA-20: a IA do condomínio nasce desligada pela TRÍADE');
select is((select pg_temp.pedir(p0) ->> 'indisponivel' from p), 'true', 'IA-20: desligada, não há sugestão e o pedido segue como sempre');
select is((select count(*)::integer from sugestoes_ia), 0, 'IA-20: desligada, nada fica guardado');
select is(pg_temp.motivo($$ select plataforma_definir_ajuda_ia(ana, ipe, 1, true, true) from ids, c $$), 'IA_DESLIGADA_TRIADE',
  'IA-20: com a chave da TRÍADE desligada, o síndico não liga as funções');
select is((select console_ia_cliente(sup, ipe) -> 'pode' ->> 'chave' from ids, c), 'false', 'IA-20: o Suporte vê o cartão, com a chave travada');
select throws_ok($$ select console_ia_chave(sup, ipe, 1, true, null) from ids, c $$, 'TC401', null, 'IA-20: só a Administração liga a IA');
select throws_ok($$ select console_ia_ajustar(sup, ipe, 1, 10, null, null, null, null) from ids, c $$, 'TC401', null,
  'IA-20: só a Administração muda o limite');
select throws_ok($$ select console_ia_cliente(ana, ipe) from ids, c $$, 'TC401', null, 'IA-20: o síndico não vê o cartão de custo');
select is((select (console_ia_cliente(adm, ipe) -> 'sugerir' ->> 'limite')::integer from ids, c), 250, 'IA-20: 250 sugestões por mês');
select is((select (console_ia_cliente(adm, ipe) -> 'transcrever' ->> 'limite')::integer from ids, c), 60, 'IA-20: 60 minutos de transcrição por mês');

select ajustar_relogio('1 minute');
select lives_ok($$ select console_ia_ajustar(adm, ipe, pg_temp.versao_ia(), null, null, 'TESTE', 'teste-1', 'TESTE') from ids, c $$,
  'IA-20: o conector troca de provedor e modelo sem chave no banco');
select lives_ok($$ select console_ia_chave(adm, ipe, pg_temp.versao_ia(), true, null) from ids, c $$, 'IA-20: a Administração liga a IA');
select is((select count(*)::integer from historico where condominio_id is null and interno and acao = 'ia.chave'), 1,
  'IA-20: a chave fica no histórico da equipe');
select is((select dados ->> 'ligada' from historico, c where condominio_id = ipe and interno and acao = 'ia.chave'), 'true',
  'IA-20: e no histórico interno do cliente');
select is((select pg_temp.pedir(p0) ->> 'indisponivel' from p), 'true', 'IA-20: o pedido de antes de ligar não recebe sugestão');

-- 2. A sugestão nunca muda o pedido sozinha (IA-15, IA-17, IA-11).
alter table p add column p1 uuid, add column p2 uuid, add column p3 uuid, add column s1 uuid, add column s2 uuid;
update p set p1 = pg_temp.registrar('Vazamento no banheiro'), p2 = pg_temp.registrar('Vazamento na cozinha'), p3 = pg_temp.registrar('Infiltração');
select is((select pg_temp.pedir(p1) -> 'sugestao' ->> 'estado' from p), 'PREPARANDO', 'IA-17: pedir a sugestão começa a preparar');
select is((select pg_temp.pedir(p1) -> 'entrada' ->> 'modelo' from p), null, 'IA-17: o mesmo pedido não pede duas vezes enquanto prepara');
select ok((select pg_temp.pedir(p2) -> 'entrada' ->> 'texto' from p) ~ 'Vazamento forte', 'IA-17: a entrada leva o relato');
select is((select jsonb_array_length(pg_temp.pedir(p3) -> 'entrada' -> 'categorias') from p),
          (select count(*)::integer from categorias, c where condominio_id = ipe and ativa), 'IA-17: a entrada leva só as categorias em uso');
update p set s1 = (select id from sugestoes_ia where pedido_id = p1), s2 = (select id from sugestoes_ia where pedido_id = p2);
select is((select pg_temp.responder(s1, 'ALTA', manutencao) -> 'sugestao' ->> 'estado' from p, cfg), 'PRONTA', 'IA-17: a sugestão fica pronta');
select is((select categoria_id from pedidos, p where id = p1), (select limpeza from cfg), 'IA-15: a sugestão pronta não muda a categoria do pedido');
select is((select prioridade_id from pedidos, p where id = p1), (select normal from cfg), 'IA-15: nem a prioridade');
select is((select count(*)::integer from historico, p where entidade_id = p1::text and acao = 'pedido.sugestao_pronta'), 1,
  'IA-17: o histórico diz que a sugestão está pronta');
select is((select count(*)::integer from historico, p where entidade_id = p1::text and acao = 'pedido.alterado'), 0,
  'IA-15: nenhum campo do pedido mudou sozinho');
select is((select chamada_id is not null from sugestoes_ia, p where id = s1), true, 'NG-13: a sugestão aponta a chamada registrada');
select is((select modelo || ' · ' || tokens_entrada || ' · ' || tokens_saida || ' · ' || custo_micros || ' ' || moeda from chamadas_ia where funcao = 'SUGERIR'),
  'teste-1 · 900 · 80 · 130 USD', 'NG-13: cada chamada guarda modelo, tamanho e custo');
select throws_ok($$ update chamadas_ia set custo_micros = 0 $$, null, null, 'NG-13: o registro da chamada não se altera');

select is((select pg_temp.responder(s2, 'BAIXA', manutencao) -> 'sugestao' ->> 'estado' from p, cfg), 'SEM_SUGESTAO',
  'IA-17: sem confiança, não há cartão');
select is((select resultado from chamadas_ia, p where id = (select chamada_id from sugestoes_ia where id = s2)), 'SEM_CONFIANCA',
  'NG-13: a chamada sem confiança fica registrada e conta no uso');
update categorias set ativa = false where id = (select manutencao from cfg);
select is((select pg_temp.responder((select id from sugestoes_ia where pedido_id = p3), 'ALTA', manutencao) -> 'sugestao' ->> 'estado' from p, cfg),
  'SEM_SUGESTAO', 'IA-17: categoria fora de uso não vira sugestão');
update categorias set ativa = true where id = (select manutencao from cfg);

-- Usar a sugestão preenche os três campos, pelo caminho de sempre, com o nome de quem usou.
select throws_ok($$ select plataforma_decidir_sugestao(gil, ipe, p1, 1, true, null, null, null) from ids, c, p $$, 'TC401', null,
  'IA-15: quem só acompanha não usa a sugestão');
select lives_ok($$ select plataforma_decidir_sugestao(ana, ipe, p1, (select versao from pedidos where id = p1), true, null, null, null) from ids, c, p $$,
  'IA-15: quem atende usa a sugestão com um toque');
select is((select categoria_id::text || prioridade_id::text || local from pedidos, p where id = p1),
          (select manutencao::text || urgente::text || 'Banheiro social' from cfg), 'IA-15: usar preenche categoria, prioridade e local');
select is((select autor_id from historico, p where entidade_id = p1::text and acao = 'pedido.sugestao_usada'), (select ana from ids),
  'IA-15: o histórico guarda quem usou a sugestão');
select is((select estado from sugestoes_ia, p where id = s1), 'USADA', 'IA-15: a sugestão fica como usada');
select is(pg_temp.motivo($$ select plataforma_decidir_sugestao(ana, ipe, p1, 9, true, null, null, null) from ids, c, p $$), 'SUGESTAO_DECIDIDA',
  'IA-15: a sugestão decidida não se usa de novo');

-- Escolher outra coisa: o histórico guarda o que a IA tinha sugerido.
create temp table p4 as select pg_temp.registrar('Pia entupida') as id;
select pg_temp.pedir(id) from p4;
select pg_temp.responder((select id from sugestoes_ia where pedido_id = p4.id), 'MEDIA', manutencao) from p4, cfg;
select lives_ok($$ select plataforma_decidir_sugestao(ana, ipe, p4.id, (select versao from pedidos where id = p4.id), false, limpeza, null, null)
                     from ids, c, p4, cfg $$, 'IA-15: quem atende escolhe outra categoria');
select is((select dados ->> 'categoria' || ' → ' || (dados -> 'escolhida' ->> 'categoria') from historico, p4
            where entidade_id = p4.id::text and acao = 'pedido.sugestao_recusada'), 'Manutenção → Limpeza',
  'IA-15: o histórico guarda o que a IA sugeriu quando a pessoa escolhe outra coisa');

-- 3. O limite do mês: chegou nele, a função para e o pedido segue normal.
select console_ia_ajustar(adm, ipe, pg_temp.versao_ia(), 4, null, null, null, null) from ids, c;
create temp table p5 as select pg_temp.registrar('Lâmpada queimada') as id;
select is((select pg_temp.pedir(id) -> 'sugestao' ->> 'estado' from p5), 'LIMITE', 'IA-20: no limite do mês, a sugestão para');
select ok((select pg_temp.pedir(id) -> 'sugestao' ->> 'renovaEm' from p5) is not null, 'IA-20: e diz quando renova');
select is((select plataforma_ajuda_ia(ana, ipe) -> 'uso' -> 'sugestoes' ->> 'usadas' from ids, c), '4',
  'IA-20: o síndico vê o uso do mês, sem valores');
select ok(not (select plataforma_ajuda_ia(ana, ipe)::text ~ 'custo' from ids, c), 'NG-15: o cliente não vê valores');
select is((select (console_ia_cliente(adm, ipe) -> 'sugerir' ->> 'custoMicros')::integer from ids, c), 520, 'NG-15: o Console soma o custo do mês');

-- 4. O síndico desliga uma função; a TRÍADE desliga tudo.
select lives_ok($$ select plataforma_definir_ajuda_ia(ana, ipe, pg_temp.versao_ia(), false, true) from ids, c $$,
  'IA-20: o síndico desliga a sugestão em Configurações › Ajuda da IA');
select is((select plataforma_ajuda_ia(ana, ipe) -> 'sugerir' ->> 'situacao' from ids, c), 'DESLIGADA', 'IA-20: a sugestão fica desligada');
select lives_ok($$ select console_ia_chave(adm, ipe, pg_temp.versao_ia(), false, 'Contrato com o provedor em revisão') from ids, c $$,
  'IA-20: a Administração desliga a IA do condomínio, com motivo');
select is((select plataforma_ajuda_ia(ana, ipe) ->> 'motivoTriade' from ids, c), 'Contrato com o provedor em revisão',
  'IA-20: o síndico vê o motivo em Ajuda da IA');
select is(pg_temp.campos($$ select console_ia_chave(adm, ipe, pg_temp.versao_ia(), false, null) from ids, c $$), '["motivo"]',
  'IA-20: desligar pede o motivo');
select console_ia_chave(adm, ipe, pg_temp.versao_ia(), true, null) from ids, c;

-- 5. Transcrição do áudio (W-06): só no painel, com limite em minutos e falha que não conta.
select plataforma_definir_ajuda_ia(ana, ipe, pg_temp.versao_ia(), true, true) from ids, c;
select ajustar_relogio('2 minutes');
insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, tipo, pedido_id, enviada_em, midia_tipo, midia_situacao, midia_caminho, midia_tamanho)
select ipe, 'A' || n, '+5561955554444', 'AUDIO', p1, app_now(), 'audio/ogg', 'LIBERADA', 'whatsapp/' || ipe || '/a' || n, 1000
  from c, p, generate_series(1, 3) n;
create temp table t1 as select whatsapp_iniciar_transcricao(ipe, (select id from mensagens_whatsapp where provedor_id = 'A1'), array['TESTE'], 30) as r from c;
select is((select r -> 'transcricao' ->> 'estado' from t1), 'TRANSCREVENDO', 'W-06: o áudio guardado começa a transcrever');
select is((select whatsapp_resultado_transcricao(ipe, (r ->> 'id')::uuid, '{"ok": true, "provedor": "TESTE", "modelo": "teste-1", "segundos": 30, "custoMicros": 2250, "texto": "A pia está pingando."}')
                 -> 'transcricao' ->> 'texto' from c, t1), 'A pia está pingando.', 'W-06: a transcrição fica guardada');
select is((select count(*)::integer from historico, p where entidade_id = p1::text and acao = 'pedido.audio_transcrito'), 1,
  'W-06: o histórico do pedido marca o áudio transcrito');
select console_ia_ajustar(adm, ipe, pg_temp.versao_ia(), null, 1, null, null, null) from ids, c;
select is((select whatsapp_iniciar_transcricao(ipe, (select id from mensagens_whatsapp where provedor_id = 'A2'), array['TESTE'], 40) -> 'transcricao' ->> 'estado' from c),
  'LIMITE', 'W-06: o áudio que passaria dos minutos do mês fica só com o som');
select console_ia_ajustar(adm, ipe, pg_temp.versao_ia(), null, 60, null, null, null) from ids, c;
create temp table t3 as select whatsapp_iniciar_transcricao(ipe, (select id from mensagens_whatsapp where provedor_id = 'A3'), array['TESTE'], 20) as r from c;
select whatsapp_resultado_transcricao(ipe, (r ->> 'id')::uuid, '{"ok": false, "provedor": "TESTE", "modelo": "teste-1"}') from c, t3;
select is((select plataforma_ajuda_ia(ana, ipe) -> 'uso' -> 'transcricao' ->> 'segundos' from ids, c), '30', 'W-06: a falha não conta no limite');
select is((select plataforma_tentar_transcricao(ana, ipe, (select id from mensagens_whatsapp where provedor_id = 'A3'), array['TESTE'], 20)
                 -> 'transcricao' ->> 'estado' from ids, c), 'TRANSCREVENDO', 'W-06: o painel tenta de novo o áudio que falhou');

-- 5b. No registro, antes de o pedido existir: nada é preenchido sozinho; o que foi registrado
-- fica ligado à sugestão mostrada.
select console_ia_ajustar(adm, ipe, pg_temp.versao_ia(), 250, null, null, null, null) from ids, c;
select is(pg_temp.campos($$ select plataforma_pedir_sugestao_registro(ana, ipe, null, 'curto', null, null, array['TESTE']) from ids, c $$), '["relato"]',
  'IA-17: no registro, a sugestão espera o relato');
create temp table r as select (plataforma_pedir_sugestao_registro(ana, ipe, 'Portão', 'O portão da garagem travou aberto agora.', null, null, array['TESTE'])
                                 -> 'sugestao' ->> 'id')::uuid as s from ids, c;
select pg_temp.responder(s, 'ALTA', manutencao) from r, cfg;
select is((select plataforma_pedir_sugestao_registro(ana, ipe, 'Portão', 'O portão da garagem travou aberto agora.', null, null, array['TESTE'])
                 -> 'sugestao' ->> 'id' from ids, c), (select s::text from r), 'IA-17: o mesmo relato não pede de novo');
alter table r add column pedido uuid;
update r set pedido = pg_temp.registrar('Portão travado');
select is((select plataforma_sugestao_no_registro(ana, ipe, s, pedido) ->> 'estado' from ids, c, r), 'RECUSADA',
  'IA-15: registrado com outra categoria, o histórico guarda o que a IA sugeriu');
select is((select dados ->> 'categoria' from historico, r where entidade_id = pedido::text and acao = 'pedido.sugestao_recusada'), 'Manutenção',
  'IA-15: a sugestão do registro fica no histórico do pedido');

-- 6. Isolamento entre condomínios (PT-01).
select throws_ok($$ select plataforma_ia_do_pedido(bia, ipe, p1) from ids, c, p $$, 'TC401', null, 'PT-01: a síndica de outro condomínio não entra');
select throws_ok($$ select plataforma_ia_do_pedido(bia, cedro, p1) from ids, c, p $$, 'TC404', null, 'PT-01: o pedido de outro condomínio não aparece');
select is((select plataforma_ajuda_ia(bia, cedro) -> 'uso' -> 'sugestoes' ->> 'usadas' from ids, c), '0', 'PT-01: o uso de um condomínio não conta no outro');

select * from finish();
rollback;

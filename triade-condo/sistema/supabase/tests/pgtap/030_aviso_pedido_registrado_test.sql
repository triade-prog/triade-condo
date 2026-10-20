-- Aviso de pedido registrado (F6.4; AT-26): ao registrar, quem pediu recebe o protocolo (W-08,
-- W-20), o responsável e, pela regra, o síndico ficam sabendo (W-11), o prestador recebe só o
-- que quem registrou viu e os moradores afetados recebem um comunicado (CD-02). Tudo na mesma
-- transação (PT-04), sem repetir, sem dado de morador para fora (PT-11) e com histórico. O
-- protocolo não é retorno (AT-06, TR-01).
begin;
select plan(90);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Caio') as caio;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Portaria', array['ATUALIZAR']) as v_edu,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Conselho', array['ACOMPANHAR']) as v_lia,
  plataforma_autorizar_pessoa(ana, ipe, caio, 'Caio', 'Administradora', array['CONFIGURAR']) as v_caio
  from ids, c;
create function pg_temp.vc() returns integer language sql as $$
  select cc.versao from configuracao_condominio cc, c where cc.condominio_id = c.ipe $$;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v from c, vs, unnest(array[v_ana, v_gil]) v;
-- Atendimento o dia todo, todos os dias: os envios não dependem da hora em que o teste roda.
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create temp table bl as select
  (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba,
  (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre B', 2, true) ->> 'id')::uuid as bb
  from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]'),
       plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui,
  plataforma_incluir_pessoa_unidade(ana, ipe, u201, null, 'Sara Dias', '+5561955556666', '{"proprietario": true, "principal": true, "mora": true}', true) as sara
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui,
  (select contato_id from contatos_unidade where id = (sara ->> 'vinculoId')::uuid) as c_sara
  from vin;
-- O Rui parou o WhatsApp e confirmou o e-mail; a Sara parou o WhatsApp e não tem e-mail.
update contatos set whatsapp_parou_em = app_now(), email = 'rui@exemplo.com.br', email_situacao = 'CONFIRMADO', email_confirmado_em = app_now()
 where id = (select c_rui from ct);
update contatos set whatsapp_parou_em = app_now() where id = (select c_sara from ct);
update configuracao_condominio set email_ligado = true, email_responder_para = 'sindica@ipe.com.br' where condominio_id = (select ipe from c);

create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from prioridades where condominio_id = ipe and modelo = 'URGENTE') as urgente
  from c;
create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Elevadores Sobe', 'Elevadores', null, '+5561933334444', null, null, 'CONTRATO',
                               null, null, null, null) ->> 'id')::uuid as sobe,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Hidráulica Lima', 'Encanador', null, null, 'contato@hidraulica.com.br', null, 'CHAMADO',
                               null, null, null, null) ->> 'id')::uuid as hidraulica,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Seu Zé', 'Jardim', null, null, null, null, 'CHAMADO',
                               null, null, null, null) ->> 'id')::uuid as ze
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.avisos(p_pedido uuid) returns text[] language sql as $$
  select coalesce(array_agg(a.destino || ' ' || a.meio || coalesce(' ' || coalesce(nome_pessoa(a.pessoa_id), ct.nome, r.nome), '')
                            order by a.destino, a.meio, coalesce(nome_pessoa(a.pessoa_id), ct.nome, r.nome)), '{}')
    from avisos_registro_pedido a left join contatos ct on ct.id = a.contato_id left join prestadores r on r.id = a.prestador_id
   where a.pedido_id = p_pedido $$;
create function pg_temp.sino(p_pedido uuid) returns text[] language sql as $$
  select coalesce(array_agg(nome_pessoa(pessoa_id) order by nome_pessoa(pessoa_id)), '{}') from avisos_whatsapp
   where tipo = 'PEDIDO_NOVO' and pedido_id = p_pedido $$;
create function pg_temp.registrar(p_pessoa uuid, p_unidade uuid, p_contato uuid, p_local text, p_prioridade uuid, p_assunto text,
                                  p_descricao text, p_privado boolean, p_responsavel uuid, p_avisar jsonb) returns jsonb language sql as $$
  select plataforma_registrar_pedido(p_pessoa, (select ipe from c), p_unidade, p_contato, p_local, (select manutencao from cfg), p_prioridade,
                                     p_assunto, p_descricao, 'TELEFONE', p_privado, p_responsavel, p_avisar) $$;

-- O Gil quer o aviso de pedido novo também no WhatsApp dele (F6.3).
select plataforma_meus_avisos_whatsapp(gil, ipe, null, '+5561944445555', array['PEDIDO_NOVO'], true) from ids, c;

-- Configurações › Prazos e avisos: o cartão Pedido novo.
select is((select plataforma_configuracoes(ana, ipe) -> 'avisoNovo' from ids, c),
  '{"sindico": "SEM_RESPONSAVEL_OU_URGENTE", "protocolo": true, "podeMudar": true}'::jsonb,
  'AT-26: o síndico começa avisado só sem responsável ou urgente, e o protocolo vai a quem pediu');
select throws_ok($$ select plataforma_definir_aviso_novo(lia, ipe, pg_temp.vc(), 'TODOS', true) from ids, c $$, 'TC401', null,
  'AT-26: quem não edita a configuração não muda a regra');
select throws_ok($$ select plataforma_definir_aviso_novo(caio, ipe, pg_temp.vc(), 'TODOS', true) from ids, c $$, 'TC401', null,
  'AT-26: quem configura, mas não é síndico, também não: a regra é do síndico');
select is((select plataforma_configuracoes(caio, ipe) -> 'avisoNovo' -> 'podeMudar' from ids, c), 'false'::jsonb, 'AT-26: e a tela mostra só a leitura');
select is(pg_temp.campos($$ select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc(), 'SEMPRE', true) from ids, c $$), '["sindico"]'::jsonb,
  'AT-26: a regra do síndico é nunca, sem responsável ou urgente, ou todos');
select throws_ok($$ select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc() - 1, 'TODOS', true) from ids, c $$, 'TC409', null,
  'AT-24: edição simultânea da regra não passa por cima');

-- O bloco Quem avisar, antes de gravar.
create function pg_temp.previa(p_pessoa uuid, p_dados jsonb) returns jsonb language sql as $$
  select plataforma_quem_avisar(p_pessoa, (select ipe from c), p_dados) $$;
select throws_ok($$ select pg_temp.previa(lia, '{}') from ids $$, 'TC401', null, 'AT-26: quem não registra pedido não vê a prévia');
create temp table pv1 as select pg_temp.previa(edu, jsonb_build_object('unidadeId', u101, 'contatoId', c_marta, 'prioridadeId', normal,
  'responsavelId', v_gil, 'local', null, 'assunto', 'Infiltração no teto do banheiro', 'descricao', 'Mancha crescendo desde ontem.')) as r
  from ids, u, ct, cfg, vs;
select is((select r -> 'quemPediu' from pv1), (select jsonb_build_object('contatoId', c_marta, 'nome', 'Marta Souza', 'marcado', false, 'motivo', 'SEM_MEIO') from ct),
  'W-08: com o WhatsApp do condomínio desconectado e sem e-mail, não há por onde mandar o protocolo');
select is((select jsonb_path_query_array(r, '$.responsavel.pessoas[*].nome') from pv1), '["Gil"]'::jsonb, 'AT-26: o responsável escolhido');
select is((select r -> 'sindico' -> 'pelaRegra' from pv1), 'false'::jsonb, 'AT-26: com responsável e prioridade normal, o síndico não entra pela regra');
select is((select jsonb_path_query_array(r, '$.sindico.pessoas[*].nome') from pv1), '["Síndica Ana"]'::jsonb, 'AT-26: mas pode ser avisado a mais');
select is((select r -> 'prestador' ->> 'rascunho' from pv1),
  E'Numa unidade do condomínio: Infiltração no teto do banheiro.\n\nMancha crescendo desde ontem.\n\nPara combinar, fale com Edu, do condomínio.',
  'PT-11: o rascunho do prestador não leva a unidade nem quem pediu');
select is((select r -> 'moradores' ->> 'publico' from pv1), 'BLOCOS', 'CD-02: os moradores afetados começam pelo bloco da unidade');
select is((select r -> 'moradores' -> 'blocos' from pv1), (select jsonb_build_array(ba) from bl), 'CD-02: o bloco da unidade');
select is((select r -> 'moradores' ->> 'motivo' from pv1), 'SEM_PERMISSAO', 'AT-26: quem não publica comunicado não avisa os moradores');
select is((select jsonb_path_query_array(r, '$.prestadores[*].nome') from pv1), '["Elevadores Sobe", "Hidráulica Lima", "Seu Zé"]'::jsonb,
  'AT-26: o prestador sai do cadastro');
select is((select jsonb_path_query_array(r, '$.prestadores[*].meio') from pv1), '["EMAIL"]'::jsonb,
  'AT-26: sem o WhatsApp conectado, só quem tem e-mail recebe; sem meio, não aparece meio');

-- O WhatsApp do condomínio conectado (piloto, W-01).
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;

create temp table pv2 as select pg_temp.previa(edu, jsonb_build_object('unidadeId', u101, 'contatoId', c_marta, 'prioridadeId', urgente,
  'responsavelId', v_gil, 'assunto', 'Infiltração', 'descricao', 'Pingando.',
  'textoPrestador', 'Ligue para a moradora no (61) 99999-0001.', 'textoMoradores', 'A Marta Souza avisou.')) as r
  from ids, u, ct, cfg, vs;
select is((select r -> 'quemPediu' ->> 'meio' from pv2), 'WHATSAPP', 'W-08: conectado, o protocolo vai pelo WhatsApp do condomínio');
select is((select r -> 'sindico' -> 'pelaRegra' from pv2), 'true'::jsonb, 'AT-26: prioridade urgente avisa o síndico pela regra');
select is((select jsonb_path_query_array(r, '$.prestadores[*].meio') from pv2), '["WHATSAPP", "EMAIL"]'::jsonb,
  'AT-26: com o WhatsApp conectado, o prestador com celular recebe por ele');
select is((select r -> 'quemPediu' ->> 'mensagem' from pv2),
  E'Olá, Marta. Registramos seu pedido [nº do protocolo] (Torre A · 101): Infiltração.\n\nChegou ao condomínio. Para acompanhar, responda aqui com 2 · Ver meus pedidos.\n\n'
  || 'O que acontece agora: o condomínio confere os pedidos ' || descrever_atendimento() || E' e dá notícia por aqui. Em emergência, ligue 193.\n\n'
  || aviso_golpe_whatsapp(), 'W-08: a prévia mostra a mensagem do protocolo como vai sair');
select is((select jsonb_path_query_array(r, '$.prestadores[*].para') from pv2), '["+55 61 9••••-4444", "contato@hidraulica.com.br"]'::jsonb,
  'AT-26: por onde vai cada prestador, com o celular mascarado');
select is((select jsonb_path_query_array(r, '$.blocos[*].unidades') from pv2), '[2, 1]'::jsonb, 'CD-02: quantas unidades cada bloco tem');
select is((select r -> 'prestador' -> 'textoComDadoDeMorador' from pv2), 'true'::jsonb, 'PT-11: telefone de morador no texto, com separadores, é apontado');
select is((select r -> 'moradores' -> 'textoComDadoDeMorador' from pv2), 'true'::jsonb, 'PT-11: o nome de quem pediu também');
select is((select pg_temp.previa(edu, jsonb_build_object('textoPrestador', 'Fale com o zelador no (61) 3333-0101.')) -> 'prestador' -> 'textoComDadoDeMorador' from ids),
  'false'::jsonb, 'PT-11: o telefone do condomínio pode ir');
select is((select pg_temp.previa(edu, jsonb_build_object('unidadeId', u201, 'contatoId', c_sara)) -> 'quemPediu' from ids, u, ct),
  (select jsonb_build_object('contatoId', c_sara, 'nome', 'Sara Dias', 'marcado', false, 'motivo', 'SEM_MEIO') from ct),
  'W-08: sem WhatsApp nem e-mail confirmado, não há por onde mandar o protocolo');
select is((select pg_temp.previa(edu, jsonb_build_object('unidadeId', u102, 'contatoId', c_rui)) -> 'quemPediu' ->> 'meio' from ids, u, ct),
  'EMAIL', 'W-08: quem parou o WhatsApp recebe por e-mail confirmado');
create temp table pv3 as select pg_temp.previa(ana, jsonb_build_object('local', 'Piscina', 'privado', true)) as r from ids;
select is((select r -> 'prestador' ->> 'motivo' from pv3) || ' ' || (select r -> 'moradores' ->> 'motivo' from pv3), 'PRIVADO PRIVADO',
  'PT-11: pedido privado não oferece prestador nem moradores');
select is((select r -> 'responsavel' -> 'semResponsavel' from pv3), 'true'::jsonb, 'AT-26: sem responsável...');
select is((select jsonb_path_query_array(r, '$.responsavel.pessoas[*].nome') from pv3), '["Edu", "Síndica Ana"]'::jsonb,
  'AT-26: ...vão os que cuidam dos pedidos, e quem registra por último');

-- 1. A síndica registra, por telefone, o pedido da Marta para o Gil.
create temp table p1 as select pg_temp.registrar(ana, u101, c_marta, null, normal, 'Infiltração no teto do banheiro', 'Mancha crescendo desde ontem.',
  false, v_gil, null) as r from ids, u, ct, cfg, vs;
create temp table x1 as select * from pedidos where id = (select (r ->> 'id')::uuid from p1);
select is((select r ->> 'versao' from p1)::int, (select versao from x1), 'o registro devolve a versão de verdade');
select is(pg_temp.avisos((select id from x1)), array['QUEM_PEDIU WHATSAPP Marta Souza', 'RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil'],
  'AT-26: registrou, avisou quem pediu e o responsável; a síndica, que registrou, não');
select is((select jsonb_path_query_array(r, '$.avisos[*].destino') from p1), '["QUEM_PEDIU", "RESPONSAVEL", "RESPONSAVEL"]'::jsonb,
  'AT-26: a confirmação mostra o que saiu');
create temp table e1 as select * from envios_whatsapp where pedido_id = (select id from x1) and finalidade = 'PROTOCOLO';
select is((select texto from e1),
  'Olá, Marta. Registramos seu pedido ' || (select protocolo from x1) || E' (Torre A · 101): Infiltração no teto do banheiro.\n\n'
  || E'Chegou por telefone. Para acompanhar, responda aqui com 2 · Ver meus pedidos.\n\n'
  || 'O que acontece agora: o condomínio confere os pedidos ' || descrever_atendimento() || E' e dá notícia por aqui. Em emergência, ligue 193.\n\n'
  || aviso_golpe_whatsapp(), 'W-08: o protocolo, como chegou, o que acontece agora, o 193 e o aviso contra golpes');
select is((select para || ' ' || modelo_chave || ' ' || estado from e1), '+5561999990001 protocolo_pedido NA_FILA',
  'W-20: fora da conversa, sai com o modelo do protocolo');
select is((select modelo_parametros from e1), (select jsonb_build_array('Marta', protocolo, 'Torre A · 101', 'Infiltração no teto do banheiro', 'por telefone',
                                                                        descrever_atendimento()) from x1), 'W-20: as variáveis do modelo');
select is((select enviar_apos <= app_now() from e1), true, 'AT-26: quem pediu recebe na hora');
select is((select count(*)::int from andamentos_pedido where pedido_id = (select id from x1)), 0, 'AT-06: o protocolo não é retorno');
select is((select proximo_retorno from pedidos where id = (select id from x1)), (select proximo_retorno from x1), 'TR-01: nem mexe no próximo retorno');
select is(pg_temp.sino((select id from x1)), array['Gil'], 'W-11: o Gil fica sabendo no sino');
select is((select texto from envios_whatsapp where pedido_id = (select id from x1) and finalidade = 'AVISO' and pessoa_id = (select gil from ids)),
  E'Residencial Ipê · pedido novo\n' || (select protocolo from x1) || ' · Infiltração no teto do banheiro (Torre A · 101)',
  'W-11: e no WhatsApp dele, sem dado de quem pediu');
select is((select count(*)::int from historico where acao = 'pedido.avisado' and entidade_id = (select id::text from x1)), 2,
  'AT-26: cada aviso vai para o histórico do pedido');
select ok(not exists (select 1 from historico where acao = 'pedido.avisado' and dados::text ~* '(marta|souza|9999|"nome")'),
  'PT-11: no histórico só identificadores');
select avisar_registro(p, (select ana from ids), null) from pedidos p where p.id = (select id from x1);
select is((select count(*)::int from avisos_registro_pedido where pedido_id = (select id from x1)), 3, 'AT-26: avisar de novo não repete');

-- 2. Desmarcar o protocolo.
create temp table x2 as select (pg_temp.registrar(ana, u101, c_marta, null, normal, 'Lâmpada do corredor', 'Queimada.', false, v_gil,
  '{"quemPediu": false}') ->> 'id')::uuid as id from ids, u, ct, cfg, vs;
select is((select count(*)::int from envios_whatsapp where pedido_id = (select id from x2) and finalidade = 'PROTOCOLO'), 0,
  'AT-26: desmarcado, o protocolo não sai');

-- 3. O Rui recebe por e-mail.
create temp table x3 as select (pg_temp.registrar(ana, u102, c_rui, null, normal, 'Interfone mudo', 'Não toca.', false, v_gil, null) ->> 'id')::uuid as id
  from ids, u, ct, cfg, vs;
create temp table m3 as select * from envios_email where pedido_atendimento_id = (select id from x3);
select is((select tipo || ' ' || para from m3), 'PROTOCOLO rui@exemplo.com.br', 'W-08: sem WhatsApp, o protocolo vai ao e-mail confirmado');
create temp table mm3 as select montar_email(e) as r from envios_email e where e.id = (select id from m3);
select is((select r -> 'pedido' from mm3), (select jsonb_build_object('protocolo', protocolo, 'prioridade', 'normal', 'assunto', 'Interfone mudo',
  'unidade', 'Torre A · 102', 'canal', 'por telefone', 'atendimento', descrever_atendimento()) from pedidos where id = (select id from x3)),
  'W-08: o e-mail traz o protocolo, a unidade, como chegou e o atendimento');
select ok((select r -> 'codigos' ? 'parar' from mm3), 'CD-13: e o link para parar de receber');
select throws_ok($$ update envios_email set corpo = 'outro texto' where id = (select id from m3) $$, 'TC422', null,
  'W-14: o envio na fila não muda de conteúdo');

-- 4. O Edu registra um urgente para o Gil: a síndica entra pela regra.
create temp table x4 as select (pg_temp.registrar(edu, u101, c_marta, null, urgente, 'Vazamento forte', 'Água descendo pela parede.', false, v_gil,
  '{"quemPediu": false}') ->> 'id')::uuid as id from ids, u, ct, cfg, vs;
select is(pg_temp.avisos((select id from x4)), array['RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil', 'SINDICO SINO Síndica Ana'],
  'AT-26: urgente avisa o síndico');
select is((select pela_regra from avisos_registro_pedido where pedido_id = (select id from x4) and destino = 'SINDICO'), true, 'AT-26: pela regra');
select is((select envio_whatsapp_id is null from avisos_registro_pedido where pedido_id = (select id from x4) and destino = 'SINDICO'), true,
  'W-11: a síndica não ligou o WhatsApp dela: só o sino');

-- 5. Normal, com responsável: a síndica só se quem registra marcar.
create temp table x5 as select (pg_temp.registrar(edu, u101, c_marta, null, normal, 'Barulho no telhado', 'À noite.', false, v_gil,
  '{"quemPediu": false}') ->> 'id')::uuid as id,
  (pg_temp.registrar(edu, u101, c_marta, null, normal, 'Barulho na garagem', 'À noite.', false, v_gil,
  '{"quemPediu": false, "sindico": true}') ->> 'id')::uuid as id2 from ids, u, ct, cfg, vs;
select is(pg_temp.avisos((select id from x5)), array['RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil'], 'AT-26: normal, com responsável: sem o síndico');
select is((select pela_regra from avisos_registro_pedido where pedido_id = (select id2 from x5) and destino = 'SINDICO'), false,
  'AT-26: marcado por quem registrou, avisa e diz que não foi pela regra');

-- 6. A regra muda: nunca e todos.
select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc(), 'NUNCA', true) from ids, c;
create temp table x6 as select (pg_temp.registrar(edu, u101, c_marta, null, urgente, 'Fumaça no quadro', 'Cheiro de queimado.', false, v_gil,
  '{"quemPediu": false}') ->> 'id')::uuid as id from ids, u, ct, cfg, vs;
select is((select count(*)::int from avisos_registro_pedido where pedido_id = (select id from x6) and destino = 'SINDICO'), 0, 'AT-26: nunca: nem urgente');
select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc(), 'TODOS', false) from ids, c;
create temp table x7 as select (pg_temp.registrar(edu, u101, c_marta, null, normal, 'Portão rangendo', 'Precisa de óleo.', false, v_gil, null) ->> 'id')::uuid as id
  from ids, u, ct, cfg, vs;
select is(pg_temp.avisos((select id from x7)), array['RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil', 'SINDICO SINO Síndica Ana'],
  'AT-26: todos: o síndico sempre; e sem o protocolo, que ficou desmarcado por padrão');
select is((select dados from historico where acao = 'regras_aviso.pedido_novo' order by id desc limit 1), '{"sindico": "TODOS", "protocolo": false}'::jsonb,
  'AT-26: a mudança da regra vai para o histórico');
select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc(), 'SEM_RESPONSAVEL_OU_URGENTE', true) from ids, c;

-- 7. O prestador (decisões 1 e 9).
create temp table n0 as select count(*)::int as n from pedidos;
select is(pg_temp.motivo($$ select pg_temp.registrar(ana, null, null, 'Elevador social da Torre B', urgente, 'Elevador parado',
  'Entre o 3º e o 4º andar.', false, v_gil, jsonb_build_object('prestador', jsonb_build_object('id', sobe,
  'texto', 'Elevador parado. Fale com a Marta no 61 99999 0001.'))) from ids, cfg, vs, pr $$), 'DADO_DE_MORADOR',
  'PT-11: telefone de morador no texto do prestador é recusado');
select is((select count(*)::int from pedidos), (select n from n0), 'PT-04: recusado o aviso, o pedido também não grava');
select is(pg_temp.motivo($$ select pg_temp.registrar(ana, null, null, 'Jardim', normal, 'Grama alta', 'Passou do ponto.', false, v_gil,
  jsonb_build_object('prestador', jsonb_build_object('id', ze, 'texto', 'Grama alta no jardim.'))) from ids, cfg, vs, pr $$), 'PRESTADOR_SEM_MEIO',
  'AT-26: prestador sem celular nem e-mail não recebe');
select is(pg_temp.motivo($$ select pg_temp.registrar(ana, null, null, 'Jardim', normal, 'Grama alta', 'Passou do ponto.', true, v_gil,
  jsonb_build_object('prestador', jsonb_build_object('id', sobe, 'texto', 'Grama alta no jardim.'))) from ids, cfg, vs, pr $$), 'PEDIDO_PRIVADO',
  'PT-11: pedido privado não vai para o prestador');
select is(pg_temp.campos($$ select pg_temp.registrar(ana, null, null, 'Jardim', normal, 'Grama alta', 'Passou do ponto.', false, v_gil,
  jsonb_build_object('prestador', jsonb_build_object('id', sobe, 'texto', 'Oi'))) from ids, cfg, vs, pr $$), '["textoPrestador"]'::jsonb,
  'AT-26: a mensagem ao prestador tem de 3 a 1500 caracteres');
create temp table x8 as select (pg_temp.registrar(ana, null, null, 'Elevador social da Torre B', urgente, 'Elevador parado', 'Entre o 3º e o 4º andar.',
  false, v_gil, jsonb_build_object('quemPediu', false, 'prestador', jsonb_build_object('id', sobe,
  'texto', E'Elevador social da Torre B: Elevador parado entre o 3º e o 4º andar.\n\nNinguém preso.\n\nPara combinar, fale com o Gil, zelador, pelo (61) 3333-0101.')))
  ->> 'id')::uuid as id from ids, cfg, vs, pr;
create temp table e8 as select * from envios_whatsapp where pedido_id = (select id from x8) and finalidade = 'AVISO_PRESTADOR';
select is((select texto from e8), E'Residencial Ipê · pedido ' || (select protocolo from pedidos where id = (select id from x8))
  || E' (urgente)\nElevador social da Torre B: Elevador parado entre o 3º e o 4º andar.\n\nNinguém preso.\n\nPara combinar, fale com o Gil, zelador, pelo (61) 3333-0101.'
  || E'\n\nO condomínio nunca pede pagamento por mensagem.', 'AT-26: o prestador recebe o texto que quem registrou viu');
select is((select para || ' ' || modelo_chave || ' ' || (enviar_apos <= app_now())::text from e8), '+5561933334444 aviso_prestador true',
  'W-20: com o modelo do prestador, na hora');
select is((select prestador_id from pedidos where id = (select id from x8)), (select sobe from pr), 'AT-26: o prestador fica ligado ao pedido');
select is((select editado from avisos_registro_pedido where pedido_id = (select id from x8) and destino = 'PRESTADOR'), true,
  'AT-26: o texto foi editado, e isso fica guardado');
select is((select dados ->> 'editado' from historico where acao = 'pedido.avisado' and entidade_id = (select id::text from x8) and dados ->> 'destino' = 'PRESTADOR'),
  'true', 'AT-26: e no histórico');
create temp table x9 as select (pg_temp.registrar(ana, null, null, 'Casa de bombas', normal, 'Bomba vazando', 'Poça embaixo da bomba 2.',
  false, v_gil, jsonb_build_object('quemPediu', false, 'prestador', jsonb_build_object('id', hidraulica,
  'texto', rascunho_prestador('Casa de bombas', 'Bomba vazando', 'Poça embaixo da bomba 2.', ana)))) ->> 'id')::uuid as id from ids, cfg, vs, pr;
create temp table m9 as select * from envios_email where pedido_atendimento_id = (select id from x9);
select is((select tipo || ' ' || para from m9), 'PRESTADOR contato@hidraulica.com.br', 'AT-26: o prestador sem celular recebe por e-mail');
select is((select montar_email(e) -> 'pedido' ->> 'texto' from envios_email e where e.id = (select id from m9)),
  E'Casa de bombas: Bomba vazando.\n\nPoça embaixo da bomba 2.\n\nPara combinar, fale com Síndica, do condomínio.', 'AT-26: com o texto da prévia');
select is((select editado from avisos_registro_pedido where pedido_id = (select id from x9) and destino = 'PRESTADOR'), false, 'AT-26: sem editar');

-- 8. Os moradores afetados (decisão 13).
select is(pg_temp.motivo($$ select pg_temp.registrar(edu, u201, c_sara, null, normal, 'Elevador da Torre B', 'Parado.', false, v_gil,
  jsonb_build_object('moradores', jsonb_build_object('publico', 'BLOCOS', 'blocos', jsonb_build_array(bb), 'titulo', 'Elevador parado',
  'texto', 'O elevador da Torre B está parado.'))) from ids, u, ct, cfg, vs, bl $$), 'SEM_PERMISSAO_COMUNICADOS',
  'AT-26: avisar os moradores pede a permissão de comunicados');
select is(pg_temp.motivo($$ select pg_temp.registrar(ana, u201, c_sara, null, normal, 'Elevador da Torre B', 'Parado.', false, v_gil,
  jsonb_build_object('moradores', jsonb_build_object('publico', 'BLOCOS', 'blocos', jsonb_build_array(bb), 'titulo', 'Elevador parado',
  'texto', 'A Sara Dias ficou presa no elevador.'))) from ids, u, ct, cfg, vs, bl $$), 'DADO_DE_MORADOR',
  'PT-11: o nome de quem pediu não vai no comunicado');
create temp table x10 as select (pg_temp.registrar(ana, u201, c_sara, null, normal, 'Elevador da Torre B', 'Parado.', false, v_gil,
  jsonb_build_object('moradores', jsonb_build_object('publico', 'BLOCOS', 'blocos', jsonb_build_array(bb), 'titulo', 'Elevador da Torre B parado',
  'texto', 'O elevador social da Torre B está parado. Use o de serviço enquanto isso.'))) ->> 'id')::uuid as id from ids, u, ct, cfg, vs, bl;
create temp table cm10 as select c.* from comunicados c join avisos_registro_pedido a on a.comunicado_id = c.id where a.pedido_id = (select id from x10);
select is((select estado || ' ' || publico || ' ' || assunto from cm10), 'PUBLICADO BLOCOS AVISO', 'CD-02: o comunicado sai publicado, para o bloco');
select is((select pedido_id from cm10), (select id from x10), 'AT-26: ligado ao pedido');
select is((select blocos from cm10), (select array[bb] from bl), 'CD-02: só a Torre B');
select is((select count(*)::int from historico where acao = 'pedido.comunicado_ligado' and entidade_id = (select id::text from x10)), 1,
  'AT-26: a ligação fica no histórico do pedido, como nos comunicados');
select is(pg_temp.avisos((select id from x10)), array['MORADORES COMUNICADO', 'RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil'],
  'AT-26: a Sara, sem meio, não recebe protocolo; os moradores, o comunicado');

-- 9. O cartão do pedido.
create temp table d8 as select plataforma_pedido(ana, ipe, (select id from x8)) as r from ids, c;
select is((select r -> 'pedido' -> 'prestador' ->> 'nome' from d8), 'Elevadores Sobe', 'AT-26: o pedido mostra o prestador');
select is((select jsonb_path_query_array(r, '$.avisosRegistro[*].nome') from d8), '["Gil", "Gil", "Elevadores Sobe"]'::jsonb,
  'AT-26: o cartão mostra quem soube...');
select is((select jsonb_path_query_array(r, '$.avisosRegistro[*].situacao') from d8), '["NO_SINO", "NA_FILA", "NA_FILA"]'::jsonb,
  'W-13: ...e em que pé está cada envio');
select is((select jsonb_path_query_array(r, '$.historico[*] ? (@.acao == "pedido.avisado").dados.quem') from d8), '["Gil", "Elevadores Sobe"]'::jsonb,
  'AT-26: o histórico mostra o nome, lido na hora');
select is((select jsonb_path_query_array(plataforma_pedido(ana, ipe, (select id from x10)), '$.avisosRegistro[*] ? (@.meio == "COMUNICADO").nome') from ids, c),
  '["Torre B"]'::jsonb, 'CD-02: o comunicado mostra para quem foi');
-- A falha do prestador foi reenviada (W-14): o cartão mostra o reenvio.
update envios_whatsapp set estado = 'FALHOU', motivo = 'Número não tem WhatsApp' where id = (select id from e8);
select is((select jsonb_path_query_array(plataforma_pedido(ana, ipe, (select id from x8)), '$.avisosRegistro[*] ? (@.destino == "PRESTADOR").motivo') from ids, c),
  '["Número não tem WhatsApp"]'::jsonb, 'W-14: a falha aparece no cartão do pedido, com o motivo');
select plataforma_reenviar_whatsapp(ana, ipe, (select id from e8), 'Número corrigido no cadastro') from ids, c;
select is((select jsonb_path_query_array(plataforma_pedido(ana, ipe, (select id from x8)), '$.avisosRegistro[*] ? (@.destino == "PRESTADOR").situacao') from ids, c),
  '["NA_FILA"]'::jsonb, 'W-14: reenviada, o cartão mostra o reenvio');
select throws_ok($$ update avisos_registro_pedido set editado = true where pedido_id = (select id from x10) $$, 'TC010', null,
  'AT-26: o registro dos avisos não muda');

-- 10. Pedido pelo WhatsApp (decisão 4): a conversa segue igual; a regra do síndico passa a valer.
update configuracao_condominio set responsavel_padrao = (select v_gil from vs) where condominio_id = (select ipe from c);
select plataforma_definir_aviso_novo(ana, ipe, pg_temp.vc(), 'TODOS', true) from ids, c;
select whatsapp_receber((select segredo from g), 'ipe-inst', jsonb_build_object('id', 'M1', 'telefone', '+5561999990001', 'tipo', 'TEXTO',
  'texto', 'A luz da escada apagou', 'enviadaEm', app_now()));
select whatsapp_receber((select segredo from g), 'ipe-inst', jsonb_build_object('id', 'M2', 'telefone', '+5561999990001', 'tipo', 'TEXTO',
  'texto', '1', 'enviadaEm', app_now()));
create temp table xw as select * from pedidos where canal = 'WHATSAPP';
select is((select count(*)::int from xw), 1, 'W-05: o pedido pelo WhatsApp é registrado');
select is(pg_temp.avisos((select id from xw)), array['QUEM_PEDIU CONVERSA Marta Souza', 'RESPONSAVEL SINO Gil', 'RESPONSAVEL WHATSAPP Gil', 'SINDICO SINO Síndica Ana'],
  'AT-26: o cartão mostra a conversa, o responsável e a síndica, pela regra');
select is((select count(*)::int from envios_whatsapp where pedido_id = (select id from xw) and finalidade = 'PROTOCOLO'), 0,
  'W-08: no WhatsApp o protocolo já vai na conversa, sem mensagem a mais');
select is((select a.situacao from ids, c, jsonb_to_recordset(plataforma_pedido(ana, ipe, (select id from xw)) -> 'avisosRegistro') as a(meio text, situacao text)
            where a.meio = 'CONVERSA'), 'NA_FILA', 'W-13: a resposta da conversa mostra o estado do envio');

select * from finish();
rollback;

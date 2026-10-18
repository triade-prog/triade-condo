-- Mural online e e-mail dos comunicados e documentos (CD-12, CD-13, CD-14): mural sem conta só
-- com o que é de todos, troca do link, e-mail confirmado pela própria pessoa, fila de e-mails,
-- devolução e spam, link pessoal, parar de receber, documento por e-mail e pedido pelo mural.
begin;
select plan(83);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select teste.vincular(ana, ipe), teste.vincular(davi, jatoba),
       plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Administração', array['PUBLICAR']),
       plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_COMUNICADOS'])
  from ids, c;
-- Sem horário sem envio, para a fila sair na hora nos testes.
update configuracao_condominio set comunicados_silencio_inicio = '00:00', comunicados_silencio_fim = '00:00';

create temp table bl as select
  (plataforma_salvar_bloco(ana, ipe, null, null, 'A', 1, true) ->> 'id')::uuid as ba,
  (plataforma_salvar_bloco(ana, ipe, null, null, 'B', 2, true) ->> 'id')::uuid as bb
  from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]'),
       plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marina Souza', '+5561999990001',
    '{"proprietario": true, "principal": true, "mora": true}', true) as marina,
  plataforma_incluir_pessoa_unidade(ana, ipe, u201, null, 'Teresa Alves', '+5561966665555',
    '{"proprietario": true, "principal": true, "mora": true}', true) as teresa,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Roberto Dias', '+5561977771212',
    '{"proprietario": true, "principal": true, "mora": true}', true) as roberto
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marina ->> 'vinculoId')::uuid) as c_marina,
  (select contato_id from contatos_unidade where id = (teresa ->> 'vinculoId')::uuid) as c_teresa,
  (select contato_id from contatos_unidade where id = (roberto ->> 'vinculoId')::uuid) as c_roberto
  from vin;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from comunicados where id = p $$;
create function pg_temp.vct(p uuid) returns integer language sql as $$ select versao from contatos where id = p $$;
create function pg_temp.escrever(p_titulo text, p_acao text default 'PUBLICAR', p_assunto text default 'OBRAS', p_publico text default 'TODOS',
                                 p_no_mural boolean default null) returns uuid
language sql as $$
  select (plataforma_salvar_comunicado((select ana from ids), (select ipe from c), null, null, p_assunto, p_titulo,
          'A água será desligada das 9h às 13h para a troca da bomba.', p_publico,
          case when p_publico = 'BLOCOS' then array[(select bb from bl)] else '{}' end, '{}', '{}', null, null, p_acao, null,
          p_no_mural, null) ->> 'id')::uuid $$;
create function pg_temp.mural_email(p_mural boolean, p_email boolean, p_docs boolean default true, p_auto boolean default true) returns jsonb
language sql as $$
  select plataforma_definir_mural_email((select ana from ids), (select ipe from c), pg_temp.vcfg(), p_mural,
           array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], p_email, 'sindica.ipe@exemplo.invalid', p_docs, p_auto) $$;
-- A fila, como a api-plataforma: pega o lote e diz que o provedor aceitou tudo.
create temp table lotes (n serial, msg jsonb);
create function pg_temp.enviar() returns integer
language plpgsql as $$
declare m jsonb; v_n integer := 0;
begin
  for m in select jsonb_array_elements(email_pegar_lote(100)) loop
    insert into lotes (msg) values (m);
    perform email_resultado((m ->> 'condominio')::uuid, (m ->> 'envio')::uuid, 'prov-' || (m ->> 'envio'), null, false);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
create function pg_temp.ultimo(p_tipo text, p_para text) returns jsonb language sql as $$
  select msg from lotes where msg ->> 'tipo' = p_tipo and msg ->> 'para' = p_para order by n desc limit 1 $$;

-- Mural (CD-12).
select is((select plataforma_plano_comunicacao(ana, ipe) -> 'mural' ->> 'ligado' from ids, c), 'false', 'CD-12: o mural começa desligado');
select throws_ok($$ select plataforma_definir_mural_email(fabio, ipe, pg_temp.vcfg(), true, '{}', false, null, true, true) from ids, c $$,
  'TC401', null, 'CF-03: só quem configura liga o mural');
create temp table m as select pg_temp.mural_email(true, false) ->> 'codigo' as cod1;
select matches((select cod1 from m), '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$',
  'CD-12: o link do mural tem 12 caracteres aleatórios, sem os que se confundem');
select is((select publico_mural(cod1) ->> 'condominio' from m), 'Residencial Ipê', 'CD-12: o link abre o mural do condomínio, sem conta');
select is((select publico_mural(lower(cod1)) ->> 'condominio' from m), 'Residencial Ipê', 'CD-12: o código vale em minúsculas também');
select throws_ok($$ select publico_mural('AAAA-BBBB-CCCC') $$, 'TC404', null, 'CD-12: código desconhecido não abre nada');

create temp table cm as select
  pg_temp.escrever('Falta de água na quinta') as agua,
  pg_temp.escrever('Portão da garagem com defeito', 'PUBLICAR', 'SEGURANCA') as portao,
  pg_temp.escrever('Pintura do bloco B', 'PUBLICAR', 'OBRAS', 'BLOCOS', true) as pintura,
  pg_temp.escrever('Rascunho da assembleia', 'RASCUNHO', 'ASSEMBLEIA') as rascunho;
select is((select no_mural from comunicados, cm where id = agua), true, 'CD-12: sem escolha, segue os assuntos do mural');
select is((select no_mural from comunicados, cm where id = portao), false, 'CD-12: segurança começa fora do mural');
select is((select no_mural from comunicados, cm where id = pintura), false, 'CD-12: comunicado de bloco não vai ao mural do prédio');
select is((select jsonb_path_query_array(publico_mural(cod1), '$.comunicados[*].titulo') from m), '["Falta de água na quinta"]'::jsonb,
  'CD-12: o mural mostra só os publicados para todo o condomínio e marcados no mural');
select ok((select not (publico_mural(cod1) -> 'comunicados' -> 0 ?| array['autor', 'publicadoPor', 'destinatarios', 'publico', 'pedido'])
             from m),
  'CD-12: o mural não mostra autor, público nem nada da gestão');
select is(pg_temp.motivo($$ select plataforma_mural_comunicado(ana, ipe, pintura, pg_temp.vc(pintura), true) from ids, c, cm $$),
  'MURAL_SO_PARA_TODOS', 'CD-12: só comunicado para todo o condomínio vai ao mural');
select throws_ok($$ select plataforma_mural_comunicado(fabio, ipe, agua, pg_temp.vc(agua), false) from ids, c, cm $$, 'TC401', null,
  'CD-12: só quem publica tira do mural');
select plataforma_mural_comunicado(ana, ipe, agua, pg_temp.vc(agua), false) from ids, c, cm;
select is((select jsonb_array_length(publico_mural(cod1) -> 'comunicados') from m), 0, 'CD-12: tirado do mural, some do link na hora');
select plataforma_mural_comunicado(ana, ipe, agua, pg_temp.vc(agua), true) from ids, c, cm;
select ok((select (plataforma_plano_comunicacao(ana, ipe) -> 'mural' ->> 'aberturas')::int >= 5 from ids, c),
  'CD-12: conta quantas vezes o mural foi aberto, sem saber quem');
select is(pg_temp.campos($$ select plataforma_trocar_link_mural(ana, ipe, pg_temp.vcfg(), '') from ids, c $$), '["motivo"]'::jsonb,
  'CD-12: trocar o link pede motivo');
create temp table m2 as select plataforma_trocar_link_mural(ana, ipe, pg_temp.vcfg(), 'O link foi parar num grupo de vendas') ->> 'codigo' as cod2
  from ids, c;
select is((select publico_mural(cod1) ->> 'trocado' from m), 'true', 'CD-12: o link antigo para na hora e diz que mudou');
select is((select jsonb_array_length(publico_mural(cod2) -> 'comunicados') from m2), 1, 'CD-12: o link novo mostra o mural');
select pg_temp.mural_email(false, false);
select is((select publico_mural(cod2) ->> 'foraDoAr' from m2), 'true', 'CD-12: desligado, o link diz que o mural está fora do ar');
select throws_ok($$ select plataforma_plano_comunicacao(davi, ipe) from ids, c $$, 'TC401', null,
  'PT-01: o síndico de outro condomínio não vê o mural deste');

-- E-mail do contato (CD-13).
select is(pg_temp.campos($$ select plataforma_email_contato(ana, ipe, c_marina, pg_temp.vct(c_marina), 'marina@', true) from ids, c, ct $$),
  '["email"]'::jsonb, 'CD-13: e-mail inválido é recusado');
select throws_ok($$ select plataforma_email_contato(fabio, ipe, c_marina, pg_temp.vct(c_marina), 'marina@exemplo.invalid', true) from ids, c, ct $$,
  'TC401', null, 'CD-13: só quem cuida dos moradores grava o e-mail');
select is((select plataforma_email_contato(ana, ipe, c_marina, pg_temp.vct(c_marina), 'marina@exemplo.invalid', true) ->> 'situacao'
             from ids, c, ct), 'PENDENTE', 'CD-13: e-mail novo espera a pessoa confirmar');
select plataforma_email_contato(ana, ipe, c_teresa, pg_temp.vct(c_teresa), 'teresa@exemplo.invalid', true) from ids, c, ct;
select is((select count(*)::int from envios_email), 0, 'CD-13: com o e-mail desligado, nada vai para a fila');
select is(pg_temp.motivo($$ select plataforma_reenviar_confirmacao(ana, ipe, c_marina) from ids, c, ct $$), 'EMAIL_DESLIGADO',
  'CD-13: não manda confirmação com o e-mail desligado');
select pg_temp.mural_email(true, true);
create temp table m3 as select plataforma_plano_comunicacao(ana, ipe) -> 'mural' ->> 'codigo' as cod from ids, c;
select is((select count(*)::int from envios_email where tipo = 'CONFIRMACAO'), 2,
  'CD-13: ao ligar o e-mail, quem espera confirmação recebe o pedido');
select is(pg_temp.enviar(), 2, 'CD-13: a fila entrega os pedidos de confirmação ao provedor');
select ok((select msg -> 'codigos' ? 'confirmar' and not (msg ? 'telefone') from lotes where msg ->> 'para' = 'marina@exemplo.invalid'),
  'CD-13: a mensagem leva o link de confirmação e nada além do necessário');
select is((select string_agg(estado, ',') from envios_email where tipo = 'CONFIRMACAO'), 'ENVIADO,ENVIADO',
  'CD-13: o envio aceito pelo provedor fica como enviado');
select is((select publico_confirmar_email(pg_temp.ultimo('CONFIRMACAO', 'marina@exemplo.invalid') -> 'codigos' ->> 'confirmar') ->> 'nome'),
  'Marina Souza', 'CD-13: a própria pessoa confirma pelo link');
select is((select email_situacao from contatos, ct where id = c_marina), 'CONFIRMADO', 'CD-13: confirmado, passa a receber');
select publico_confirmar_email(pg_temp.ultimo('CONFIRMACAO', 'teresa@exemplo.invalid') -> 'codigos' ->> 'confirmar');
select throws_ok($$ select publico_confirmar_email('codigo-que-nao-existe-de-jeito-nenhum') $$, 'TC404', null,
  'CD-13: link de confirmação desconhecido não confirma nada');

-- Comunicado por e-mail (CD-13).
create temp table cm2 as select pg_temp.escrever('Limpeza da caixa d''água no sábado') as caixa;
select is((select count(*)::int from envios_email, cm2 where comunicado_id = caixa), 2,
  'CD-13: publicar põe na fila quem recebe e tem e-mail confirmado');
select is((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'TODOS', null, null, null) ->> 'comEmail' from ids, c), '2',
  'CD-13: antes de publicar, a tela sabe quantos recebem por e-mail');
select is(pg_temp.enviar(), 2, 'CD-13: a fila manda os dois e-mails');
select is((select msg -> 'comunicado' ->> 'titulo' from lotes where msg ->> 'tipo' = 'COMUNICADO' order by n desc limit 1),
  'Limpeza da caixa d''água no sábado', 'CD-13: o e-mail leva o texto do comunicado');
select ok((select bool_and(msg -> 'codigos' ?& array['ver', 'parar']) from lotes where msg ->> 'tipo' = 'COMUNICADO'),
  'CD-13: cada e-mail leva o link pessoal e o parar de receber');
select is((select plataforma_comunicado(ana, ipe, caixa) -> 'email' ->> 'enviados' from ids, c, cm2), '2',
  'CD-13: o comunicado mostra quantos e-mails saíram');
select email_evento(ipe, e.id, e.provedor_id, 'ENTREGUE', null) from c, envios_email e, cm2
 where e.comunicado_id = caixa and e.para = 'marina@exemplo.invalid';
select is((select plataforma_comunicado(ana, ipe, caixa) -> 'email' ->> 'entregues' from ids, c, cm2), '1',
  'CD-13: o provedor conta o que foi entregue');
create temp table lk as select
  (select msg -> 'codigos' ->> 'ver' from lotes where msg ->> 'tipo' = 'COMUNICADO' and msg ->> 'para' = 'marina@exemplo.invalid') as ver_marina,
  (select msg -> 'codigos' ->> 'parar' from lotes where msg ->> 'tipo' = 'COMUNICADO' and msg ->> 'para' = 'marina@exemplo.invalid') as parar_marina,
  (select msg -> 'codigos' ->> 'ver' from lotes where msg ->> 'tipo' = 'COMUNICADO' and msg ->> 'para' = 'teresa@exemplo.invalid') as ver_teresa;
select is((select publico_comunicado(ver_marina) -> 'comunicado' ->> 'titulo' from lk), 'Limpeza da caixa d''água no sábado',
  'CD-13: o link pessoal abre o comunicado, sem login');
select is((select plataforma_comunicado(ana, ipe, caixa) -> 'email' ->> 'abertos' from ids, c, cm2), '1',
  'CD-08: conta quem abriu o link pessoal, sem rastreio escondido');
create temp table cm3 as select (plataforma_corrigir_comunicado(ana, ipe, caixa, pg_temp.vc(caixa), 'Limpeza da caixa d''água no domingo',
  'A limpeza passou para domingo.', 'O dia mudou para domingo') ->> 'id')::uuid as caixa2 from ids, c, cm2;
select is((select count(*)::int from envios_email, cm3 where comunicado_id = caixa2), 0, 'CD-13: corrigir não reenvia sozinho');
select is((select publico_comunicado(ver_marina) -> 'comunicado' ->> 'titulo' from lk), 'Limpeza da caixa d''água no domingo',
  'CD-13: o link pessoal mostra a versão mais nova');
select is((select no_mural from comunicados, cm3 where id = caixa2), true, 'CD-12: a versão nova fica no mural no lugar da antiga');
create temp table cm4 as select (plataforma_corrigir_comunicado(ana, ipe, caixa2, pg_temp.vc(caixa2), 'Limpeza da caixa d''água no domingo, às 8h',
  'A limpeza passou para domingo, às 8h.', 'Incluído o horário', true) ->> 'id')::uuid as caixa3 from ids, c, cm3;
select is(pg_temp.enviar(), 2, 'CD-13: corrigir com "avisar por e-mail" reenvia');
select is((select msg -> 'comunicado' ->> 'correcao' from lotes order by n desc limit 1), 'Incluído o horário',
  'CD-13: o e-mail da correção começa com o que mudou');

-- Devolução, spam e parar de receber (CD-13).
select email_evento(ipe, e.id, e.provedor_id, 'DEVOLVIDO', 'Endereço não existe') from c, envios_email e, cm4
 where e.comunicado_id = caixa3 and e.para = 'teresa@exemplo.invalid';
select is((select email_situacao from contatos, ct where id = c_teresa), 'DEVOLVIDO', 'CD-13: e-mail que voltou é desligado');
select is((select jsonb_path_query_array(plataforma_avisos(ana, ipe), '$.itens[*] ? (@.tipo == "EMAIL_DEVOLVIDO").nome') from ids, c),
  '["Teresa Alves"]'::jsonb, 'CD-13: e aparece no sino de quem cuida dos moradores');
select is((select plataforma_comunicado(ana, ipe, caixa3) -> 'problemas' -> 0 ->> 'nome' from ids, c, cm4), 'Teresa Alves',
  'CD-13: o comunicado lista os e-mails que voltaram');
select is((select publico_parar_email(parar_marina) ->> 'parou' from lk), 'true', 'CD-13: parar de receber com um toque, sem login');
create temp table cm5 as select pg_temp.escrever('Reunião do conselho') as reuniao;
select is((select count(*)::int from envios_email, cm5 where comunicado_id = reuniao), 0,
  'CD-13: quem parou ou teve o e-mail devolvido não recebe');
select is((select publico_voltar_email(parar_marina) ->> 'parou' from lk), 'false', 'CD-13: só a própria pessoa volta a receber');
select email_evento(ipe, e.id, e.provedor_id, 'SPAM', null) from c, envios_email e, cm4
 where e.comunicado_id = caixa3 and e.para = 'marina@exemplo.invalid';
select is((select email_situacao || '/' || email_parou_motivo from contatos, ct where id = c_marina), 'PAROU/SPAM',
  'CD-13: marcado como spam, não recebe mais por e-mail');
select is((select publico_voltar_email(parar_marina) ->> 'parou' from lk), 'true',
  'CD-13: quem marcou spam não volta pelo link de parar');

-- A fila (CD-13).
update contatos set email_situacao = 'CONFIRMADO', email_parou_motivo = null where id = (select c_marina from ct);
create temp table cm6 as select pg_temp.escrever('Coleta seletiva às terças') as coleta;
select pg_temp.mural_email(true, false);
select is((select jsonb_array_length(email_pegar_lote(100))), 0, 'CD-13: desligado o e-mail, a fila não manda nada');
select is((select estado || ': ' || motivo from envios_email, cm6 where comunicado_id = coleta), 'CANCELADO: O envio por e-mail foi desligado',
  'CD-13: e o que esperava é cancelado com o motivo');
select pg_temp.mural_email(true, true);
create temp table cm7 as select pg_temp.escrever('Dedetização na segunda') as dedet;
select email_resultado(ipe, (m ->> 'envio')::uuid, null, 'Resend respondeu 503', true) from c, jsonb_array_elements(email_pegar_lote(100)) m;
select ok((select estado = 'NA_FILA' and enviar_apos > app_now() from envios_email, cm7 where comunicado_id = dedet),
  'CD-13: falha passageira volta para a fila, mais tarde');
select ajustar_relogio('1 hour');
select email_resultado(ipe, (m ->> 'envio')::uuid, null, 'Endereço recusado', false) from c, jsonb_array_elements(email_pegar_lote(100)) m;
select is((select estado from envios_email, cm7 where comunicado_id = dedet), 'FALHOU', 'CD-13: recusa definitiva fica como falhou');
select ajustar_relogio('0');

-- Documento por e-mail (CD-14).
create temp table dc as select
  (plataforma_salvar_documento(ana, ipe, null, null, 'REGIMENTO', 'Regimento interno', null, false, true, null) ->> 'id')::uuid as regimento,
  (plataforma_salvar_documento(ana, ipe, null, null, 'LAUDO', 'AVCB', null, true, false, null) ->> 'id')::uuid as avcb
  from ids, c;
create temp table vr as select
  (plataforma_iniciar_versao_documento(ana, ipe, regimento, 'regimento.pdf', 'application/pdf', 2000, null, '2025-04-12', 'AGE de 05/04/2025')
    ->> 'versaoId')::uuid as ver1,
  (plataforma_iniciar_versao_documento(ana, ipe, avcb, 'avcb.pdf', 'application/pdf', 2000, null, '2025-04-12', 'Corpo de Bombeiros')
    ->> 'versaoId')::uuid as ver_avcb
  from ids, c, dc;
select plataforma_verificar_versao_documento(ana, ipe, regimento, ver1, true, 1990, null),
       plataforma_verificar_versao_documento(ana, ipe, avcb, ver_avcb, true, 1990, null) from ids, c, dc, vr;
select is((select jsonb_path_query_array(publico_mural(cod), '$.documentos[*].titulo') from m3), '["Regimento interno"]'::jsonb,
  'CD-14: o mural lista só os documentos que podem ir ao morador');
select is(pg_temp.campos($$ select publico_pedir_documento(cod, regimento, 'sem-arroba') from m3, dc $$), '["email"]'::jsonb,
  'CD-14: o pedido pede um e-mail válido');
select is((select publico_pedir_documento(cod, avcb, 'curioso@exemplo.invalid') ->> 'ok' from m3, dc), 'true',
  'CD-14: pedido de documento restrito tem a mesma resposta');
select is((select count(*)::int from pedidos_documento), 0, 'CD-14: e não vira pedido');
select is((select publico_pedir_documento(cod, regimento, 'imobiliaria@exemplo.invalid') ->> 'ok' from m3, dc), 'true',
  'CD-14: a resposta é sempre neutra');
select publico_pedir_documento(cod, regimento, 'imobiliaria@exemplo.invalid') from m3, dc;
select is((select string_agg(estado, ',') from pedidos_documento), 'ESPERANDO', 'CD-14: e-mail que não é de contato espera o síndico, sem repetir');
select is((select jsonb_path_query_array(plataforma_avisos(ana, ipe), '$.itens[*] ? (@.tipo == "DOCUMENTO_PEDIDO").titulo') from ids, c),
  '["Regimento interno"]'::jsonb, 'CD-14: o pedido avisa no sino de quem cuida dos documentos');
select publico_pedir_documento(cod, regimento, 'MARINA@exemplo.invalid') from m3, dc;
select is((select estado || '/' || automatico from pedidos_documento where contato_id = (select c_marina from ct)), 'ENVIADO/true',
  'CD-14: contato confirmado recebe na hora');
select is(pg_temp.campos($$ select plataforma_decidir_pedido_documento(ana, ipe, (select id from pedidos_documento where estado = 'ESPERANDO'),
  false, '') from ids, c $$), '["motivo"]'::jsonb, 'CD-14: recusar pede motivo');
select plataforma_decidir_pedido_documento(ana, ipe, (select id from pedidos_documento where estado = 'ESPERANDO'), true, null) from ids, c;
select is((select count(*)::int from envios_email where tipo = 'DOCUMENTO'), 2, 'CD-14: aprovado, o documento vai para a fila');
select is(pg_temp.motivo($$ select plataforma_enviar_documento(ana, ipe, avcb, null, array['x@exemplo.invalid'], null) from ids, c, dc $$),
  'DOCUMENTO_NAO_VAI_POR_EMAIL', 'CD-14: documento restrito não vai por e-mail');
select is((select plataforma_enviar_documento(ana, ipe, regimento, array[c_marina], array['advogado@exemplo.invalid'], 'Segue o regimento')
             ->> 'enviados' from ids, c, dc, ct), '2', 'CD-14: o síndico envia pela tela do documento');
select pg_temp.enviar();
create temp table ld as select
  (select msg -> 'codigos' ->> 'abrir' from lotes where msg ->> 'tipo' = 'DOCUMENTO' and msg ->> 'para' = 'advogado@exemplo.invalid') as abrir_adv,
  (select msg -> 'codigos' ->> 'abrir' from lotes where msg ->> 'tipo' = 'DOCUMENTO' and msg ->> 'para' = 'imobiliaria@exemplo.invalid') as abrir_imob;
select is((select publico_documento(abrir_adv) ->> 'titulo' from ld), 'Regimento interno', 'CD-14: o link do e-mail abre a versão em vigor');
select ok((select exists (select 1 from historico h, dc where h.entidade = 'documentos' and h.entidade_id = regimento::text
                          and h.acao = 'documento.aberto_por_email')), 'CD-14: cada abertura fica no histórico do documento');
select plataforma_cancelar_envio_documento(ana, ipe, regimento, (select id from envios_email where para = 'advogado@exemplo.invalid'))
  from ids, c, dc;
select is(pg_temp.motivo($$ select publico_documento(abrir_adv) from ld $$), 'LINK_VENCIDO', 'CD-04: link cancelado para na hora');
select ajustar_relogio('8 days');
select is(pg_temp.motivo($$ select publico_documento(abrir_imob) from ld $$), 'LINK_VENCIDO', 'CD-14: o link do documento vale 7 dias');
select ajustar_relogio('0');

-- Cadastro, importação e privacidade.
select is((select plataforma_moradores(ana, ipe, null, 'SEM_EMAIL', 1) ->> 'total' from ids, c), '2',
  'CD-13: a lista de moradores filtra quem não tem e-mail confirmado');
select is((select plataforma_unidade(ana, ipe, u101) -> 'contatos' -> 0 ->> 'emailSituacao' from ids, c, u), 'CONFIRMADO',
  'CD-13: a unidade mostra a situação do e-mail de cada contato');
select is(pg_temp.motivo($$ select plataforma_importar_moradores(ana, ipe, '[{"bloco": null, "unidade": "301", "nome": "Paulo", "telefone": "+5561911112222", "email": "paulo"}]') from ids, c $$),
  'LINHA_INVALIDA', 'MU-01: a planilha recusa e-mail inválido');
select is((select plataforma_importar_moradores(ana, ipe, '[{"bloco": null, "unidade": "301", "nome": "Paulo Reis", "telefone": "+5561911112222", "email": "paulo@exemplo.invalid"}]') ->> 'emails'
             from ids, c), '1', 'MU-01: a planilha traz o e-mail, esperando confirmação');
select plataforma_encerrar_vinculo_unidade(ana, ipe, (marina ->> 'vinculoId')::uuid,
  (select versao from contatos_unidade where id = (marina ->> 'vinculoId')::uuid), 'MUDANCA', null) from ids, c, vin;
select is(pg_temp.motivo($$ select publico_comunicado(ver_marina) from lk $$), 'LINK_VENCIDO',
  'CD-13: quem saiu da unidade perde o link pessoal');
select plataforma_remover_dados_contato(ana, ipe, c_marina, pg_temp.vct(c_marina)) from ids, c, ct;
select is((select coalesce(email, 'sem e-mail') from contatos, ct where id = c_marina), 'sem e-mail', 'PT-11: remover os dados leva o e-mail junto');
select is((select count(*)::int from historico where dados::text like '%@%'), 0, 'PT-11: o histórico não guarda e-mail');
select throws_ok($$ delete from envios_email $$, 'TC010', null, 'CD-13: envio não se apaga');
select throws_ok($$ select plataforma_pedidos_documento(davi, ipe) from ids, c $$, 'TC401', null,
  'PT-01: o síndico de outro condomínio não vê os pedidos deste');

select * from finish();
rollback;

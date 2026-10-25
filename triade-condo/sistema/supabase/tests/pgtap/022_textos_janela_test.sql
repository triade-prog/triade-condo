-- Textos do WhatsApp e janela de 24h (D3, F5.4; W-08, W-11, W-12, W-13, W-14, W-16, W-17, W-20,
-- W-22, AT-13): a Nina se apresenta; o horário cadastrado vira texto; mensagem atrasada vai para
-- A identificar; dentro de 24 horas, texto livre; fora, só com modelo aprovado; sem modelo, falha
-- com responsável; PARAR barra o que o condomínio inicia; a conclusão vai ao morador do pedido
-- que nasceu no WhatsApp; os modelos têm versão, situação e histórico.
begin;
select plan(61);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, sup, 'SUPORTE'),
       console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]'),
       console_editar_ficha(impl, jatoba, (select versao from condominios where id = jatoba), 'Edifício Jatobá', 'Rio Branco', 'AC', null,
                            '+5568999990000', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Conselho', array['ACOMPANHAR']) as v_lia
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_ana from c, vs;
-- Atendimento o dia todo, todos os dias: as respostas não dependem da hora em que o teste roda.
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui
  from vin;
select plataforma_incluir_pessoa_unidade(ana, ipe, u201, c_rui, null, null, '{"proprietario": true, "principal": true, "mora": false}', true)
  from ids, c, u, ct;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.vcx(p uuid) returns integer language sql as $$ select versao from conexoes_whatsapp where condominio_id = p $$;
-- Credenciais já cifradas (a API cifra; aqui só bytes).
create function pg_temp.cred() returns bytea language sql as $$ select decode(repeat('ab', 40), 'hex') $$;
create temp table seq (n integer);
insert into seq values (0);
-- Mensagem recebida no Ipê (ou no gancho dado), com id novo a cada chamada.
create function pg_temp.msg(p_tel text, p_texto text, p_segredo text default null, p_inst text default 'ipe-inst', p_extra jsonb default '{}')
returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber(coalesce(p_segredo, (select segredo from g)), p_inst,
    jsonb_build_object('id', 'M' || v_n, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', p_texto, 'enviadaEm', app_now()) || p_extra);
end $$;
-- Respostas para um telefone que ainda não foram vistas (o relógio não anda dentro do teste:
-- a ordem vem desta lista). Mais de uma sai junto, separada por " | ".
create temp table vistos (id uuid primary key);
create temp table ult (tel text primary key, texto text);
create function pg_temp.ultima(p_tel text) returns text language plpgsql as $$
declare v text;
begin
  select string_agg(texto, ' | ') into v from envios_whatsapp e where para = p_tel and not exists (select 1 from vistos where id = e.id);
  insert into vistos select id from envios_whatsapp e where para = p_tel on conflict do nothing;
  if v is not null then insert into ult values (p_tel, v) on conflict (tel) do update set texto = excluded.texto; end if;
  return (select texto from ult where tel = p_tel);
end $$;
create function pg_temp.respostas(p_tel text) returns bigint language sql as $$
  select count(*) from envios_whatsapp where para = p_tel $$;

-- Conectado, com o termo aceito.
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', pg_temp.cred()) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
-- A fila só com o que o teste olha.
create function pg_temp.limpar_fila() returns void language sql as $$
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'teste' where estado = 'NA_FILA' $$;
create function pg_temp.no_condominio(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform entrar_como_sistema((select ipe from c));
  set local role dominio;
  execute p_sql into v;
  reset role;
  perform entrar_como_sistema(null);
  return v;
end $$;
create function pg_temp.lote() returns jsonb language sql as $$
  select coalesce((select x -> 'envios' from jsonb_array_elements(whatsapp_pegar_lote(50)) x limit 1), '[]'::jsonb) $$;

-- A Nina se apresenta (W-22).
select pg_temp.msg('+5561999990001', 'Oi');
select ok(pg_temp.ultima('+5561999990001') ~ '^Olá, Marta\. Sou a Nina, assistente virtual do Residencial Ipê\.\nResponda com o número:\n1 · Registrar um pedido novo',
  'W-22: a Nina se apresenta e diz qual condomínio');
select pg_temp.msg('+5561988771234', 'Oi, sou nova');
select ok(pg_temp.ultima('+5561988771234') ~ '^Olá\. Sou a Nina, assistente virtual do Residencial Ipê\. Recebi sua mensagem',
  'W-22: também para número fora do cadastro');

-- O horário de atendimento em palavras (W-08, W-12).
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '08:00', 'fim', '18:00')) from generate_series(1, 5) d)
 where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select descrever_atendimento()'), 'em dias úteis, das 8h às 18h', 'W-08: dias úteis');
update horarios set intervalos = (select jsonb_agg(x) from (
  select jsonb_build_object('dia', d, 'inicio', '08:00', 'fim', '12:00') x from generate_series(1, 6) d
  union all select jsonb_build_object('dia', d, 'inicio', '13:30', 'fim', '18:00') from generate_series(1, 6) d) y) where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select descrever_atendimento()'), 'de segunda a sábado, das 8h às 12h e das 13h30 às 18h', 'W-08: dois turnos');
update horarios set intervalos = '[{"dia": 1, "inicio": "09:00", "fim": "17:00"}, {"dia": 3, "inicio": "09:00", "fim": "17:00"},
                                   {"dia": 5, "inicio": "09:00", "fim": "17:00"}]' where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select descrever_atendimento()'), 'de segunda, quarta e sexta, das 9h às 17h', 'W-08: dias escolhidos');
update horarios set intervalos = '[{"dia": 1, "inicio": "09:00", "fim": "17:00"}, {"dia": 2, "inicio": "09:00", "fim": "12:00"}]'
 where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select descrever_atendimento()'), 'no horário de atendimento', 'W-08: horários diferentes ficam no genérico');
update horarios set intervalos = '[]' where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select descrever_atendimento()'), 'no horário de atendimento', 'W-08: sem horário, o genérico');
select is(pg_temp.no_condominio('select texto_proximo_atendimento()'), null, 'W-12: sem horário, não diz o próximo');
-- Só daqui a dois dias, às 7h30: o próximo é aquele dia da semana.
update horarios set intervalos = jsonb_build_array(jsonb_build_object(
  'dia', (extract(dow from (app_now() at time zone 'America/Sao_Paulo'))::integer + 2) % 7, 'inicio', '07:30', 'fim', '08:00'))
 where tipo = 'ATENDIMENTO';
select is(pg_temp.no_condominio('select texto_proximo_atendimento()'),
  'Próximo horário de atendimento: ' || (array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])
    [(extract(dow from (app_now() at time zone 'America/Sao_Paulo'))::integer + 2) % 7 + 1] || ', a partir das 7h30.',
  'W-12: diz o dia e a hora do próximo atendimento');
select pg_temp.msg('+5561977771212', 'O interfone não toca');
select ok(pg_temp.ultima('+5561977771212') ~ 'a partir das 7h30\.$', 'W-12: o fora do horário diz quando é o próximo');
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo = 'ATENDIMENTO';

-- Abrir pedido: a voz da Nina e o horário de verdade.
select pg_temp.msg('+5561999990001', '1');
select pg_temp.msg('+5561999990001', 'A luz da garagem está piscando');
create temp table pm as select * from pedidos where canal = 'WHATSAPP' order by criado_em desc limit 1;
select ok(pg_temp.ultima('+5561999990001') ~ ('^Registrei o pedido ' || (select protocolo from pm) || ' \(Torre A · 101\)')
          and pg_temp.ultima('+5561999990001') ~ 'o condomínio confere os pedidos todos os dias, das 0h às 24h e dá notícia',
  'W-08: "Registrei", com o horário cadastrado');

-- A janela de 24h (W-20).
select ok(pg_temp.no_condominio($$ select janela_aberta('+5561999990001')::text $$)::boolean, 'W-20: quem acabou de escrever tem a conversa aberta');
select ok(pg_temp.no_condominio($$ select janela_aberta('+556199990001')::text $$)::boolean, 'W-20: vale com ou sem o 9 da frente');
select ok(not pg_temp.no_condominio($$ select janela_aberta('+5561991002233')::text $$)::boolean, 'W-20: quem nunca escreveu, não');
select is((select plataforma_pedido_whatsapp(ana, ipe, id) -> 'janela' ->> 'limite' from ids, c, pm), '2000', 'W-20: aberta, até 2000 caracteres');

-- Retorno com a conversa aberta: protocolo no começo, quem escreveu no fim.
select pg_temp.limpar_fila();
create temp table r1 as select plataforma_responder_whatsapp(ana, ipe, id, versao, 'O eletricista vem amanhã.') as r from ids, c, pedidos
 where id = (select id from pm);
select is((select texto from envios_whatsapp where id = (select (r ->> 'envio')::uuid from r1)),
  E'Sobre o pedido ' || (select protocolo from pm) || E':\nO eletricista vem amanhã.\n\nSíndica, do condomínio',
  'W-13: o retorno leva o pedido e quem escreveu');
create temp table l1 as select pg_temp.lote() as l;
select is((select l -> 0 ->> 'texto' from l1), (select texto from envios_whatsapp where id = (select (r ->> 'envio')::uuid from r1)),
  'W-20: com a conversa aberta, vai o texto livre');
select ok((select not (l -> 0 ? 'modelo') from l1), 'W-20: sem modelo');

-- Mensagem que chega com mais de 24 horas (número desconectado): A identificar, sem resposta.
select pg_temp.msg('+5561977771212', 'Mandei ontem: o portão travou', null, 'ipe-inst',
                   jsonb_build_object('enviadaEm', app_now() - interval '30 hours'));
select is((select triagem || '/' || chegou_atrasada from mensagens_whatsapp where texto = 'Mandei ontem: o portão travou'), 'A_IDENTIFICAR/true',
  'W-17: a mensagem atrasada vai para A identificar');
select is((select count(*) from envios_whatsapp where para = '+5561977771212' and criado_em = app_now() and texto ~ 'portão'), 0::bigint,
  'W-20: e não recebe resposta automática');
select ok((select bool_or((x ->> 'atrasada')::boolean) from ids, c, jsonb_array_elements(plataforma_whatsapp(ana, ipe) -> 'aIdentificar') x),
  'W-17: a tela mostra que chegou atrasada');

-- Passam 25 horas: a conversa fecha.
select ajustar_relogio(interval '25 hours');
select pg_temp.limpar_fila();
select ok(not pg_temp.no_condominio($$ select janela_aberta('+5561999990001')::text $$)::boolean, 'W-20: 24 horas depois, fecha');
create temp table jf as select plataforma_pedido_whatsapp(ana, ipe, id) -> 'janela' as j from ids, c, pm;
select is((select j ->> 'aberta' || '/' || (j ->> 'limite') from jf), 'false/800', 'W-20: fechada, até 800 caracteres');
select ok((select j -> 'modelo' ->> 'previa' ~ ('^Notícia do seu pedido ' || (select protocolo from pm) || E' no Residencial Ipê:\n\n\\{\\{texto\\}\\}\n\nSíndica, do condomínio')
              and j -> 'modelo' ->> 'previa' ~ 'responda PARAR\.$' from jf),
  'W-20: a tela mostra como chega, pelo modelo');
select is(pg_temp.motivo($$ select plataforma_responder_whatsapp(ana, ipe, id, versao, repeat('a', 801)) from ids, c, pedidos where id = (select id from pm) $$),
  'LONGO_FORA_DA_JANELA', 'W-20: fora da janela, até 800 caracteres');
-- Resposta automática atrasada é cancelada.
select pg_temp.no_condominio($$ select responder_whatsapp('+5561999990001', null, null, 'Resposta automática atrasada')::text $$);
create temp table r2 as select plataforma_responder_whatsapp(ana, ipe, id, versao, E'O eletricista trocou o reator.\nSe voltar, avise.') as r
  from ids, c, pedidos where id = (select id from pm);
select ok((select not (r ? 'aviso') from r2), 'W-20: com modelo aprovado, não há aviso');
create temp table l2 as select pg_temp.lote() as l;
select is((select estado || '/' || motivo from envios_whatsapp where texto = 'Resposta automática atrasada'), 'CANCELADA/A conversa no WhatsApp passou de 24 horas',
  'W-20: a resposta automática atrasada é cancelada');
select is((select l -> 0 ->> 'texto' from l2),
  'Notícia do seu pedido ' || (select protocolo from pm) || E' no Residencial Ipê:\n\nO eletricista trocou o reator. Se voltar, avise.\n\nSíndica, do condomínio\n\n'
  || E'Para responder, é só mandar mensagem aqui.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: o retorno vai pelo modelo, em parágrafo único');
select is((select l -> 0 -> 'modelo' ->> 'chave' from l2), 'noticia_pedido', 'W-20: a API sabe qual modelo foi usado');
select ok((select modelo_id is not null and texto_enviado ~ '^Notícia' from envios_whatsapp where id = (select (r ->> 'envio')::uuid from r2)),
  'W-20: o envio guarda o modelo e o texto que saiu');
select ok((select bool_or(x ->> 'texto' ~ '^Notícia' and (x ->> 'modelo')::boolean) from ids, c, pm,
                  jsonb_array_elements(plataforma_pedido_whatsapp(ana, ipe, pm.id) -> 'mensagens') x),
  'W-20: a conversa mostra o texto que saiu, marcado como modelo');

-- Modelos no Console (W-20).
select is((select jsonb_array_length(console_modelos_whatsapp(sup) -> 'modelos') from ids), 20, 'W-20: vinte modelos (seis do atendimento, o da reserva, os dois da enquete, os dois da assembleia, o do anúncio, o do prestador reserva, os dois do pedido registrado, o do comunicado, o da encomenda guardada e os três do link do conselho)');
select is((select console_modelos_whatsapp(sup) -> 'pode' ->> 'editar' from ids), 'false', 'W-20: suporte só vê');
select throws_ok($$ select console_salvar_modelo_whatsapp(impl, 'noticia_pedido', null, null, 'x') from ids $$, 'TC401', null,
  'W-20: só a administração escreve modelo');
select is(pg_temp.campos($$ select console_salvar_modelo_whatsapp(adm, 'noticia_pedido', null, null, '{{1}}: notícia {{2}} {{3}} {{4}} aqui.') from ids $$),
  '["corpo"]', 'W-20: o texto não começa com variável');
select is(pg_temp.campos($$ select console_salvar_modelo_whatsapp(adm, 'noticia_pedido', null, null, 'Notícia do pedido {{1}} no {{2}}: {{3}}.') from ids $$),
  '["corpo"]', 'W-20: todas as variáveis entram');
create temp table v2 as select console_salvar_modelo_whatsapp(adm, 'noticia_pedido', null, null,
  E'Notícia do seu pedido {{1}} ({{2}}):\n\n{{3}}\n\n{{4}}, do condomínio. Responda por aqui.') as r from ids;
select is((select r ->> 'numero' from v2), '2', 'W-20: mudar cria a versão 2');
select is((select situacao from modelos_whatsapp where chave = 'noticia_pedido' and numero = 2), 'RASCUNHO', 'W-20: em rascunho');
select is(pg_temp.motivo($$ select console_salvar_modelo_whatsapp(adm, 'noticia_pedido', null, null,
  'Notícia do seu pedido {{1}} no {{2}}: {{3}} · {{4}}, do condomínio.') from ids $$), 'MODELO_PENDENTE', 'W-20: uma versão pendente por vez');
select is((select (console_modelo_whatsapp(sup, 'noticia_pedido') ->> 'emUsoPiloto')::int from ids), 1, 'W-20: a anterior segue em uso');
select is(pg_temp.campos($$ select console_decidir_modelo_whatsapp(adm, 'noticia_pedido', 2, (select versao from modelos_whatsapp
  where chave = 'noticia_pedido' and numero = 2), 'RECUSADO', null) from ids $$), '["motivo"]', 'W-20: recusar pede motivo');
select is(pg_temp.motivo($$ select console_decidir_modelo_whatsapp(adm, 'noticia_pedido', 2, (select versao from modelos_whatsapp
  where chave = 'noticia_pedido' and numero = 2), 'APROVADO', null) from ids $$), 'SITUACAO_MODELO', 'W-20: rascunho não vira aprovado pela Meta direto');
select console_decidir_modelo_whatsapp(adm, 'noticia_pedido', 2, versao, 'APROVADO_PILOTO', null) from ids, modelos_whatsapp
 where chave = 'noticia_pedido' and numero = 2;
select is((select (console_modelo_whatsapp(sup, 'noticia_pedido') ->> 'emUsoPiloto')::int from ids), 2, 'W-20: aprovada, a versão 2 passa a valer');
select is((select console_modelo_whatsapp(sup, 'noticia_pedido') ->> 'emUsoOficial' from ids), null, 'W-20: no oficial, só o aprovado pela Meta');
select is(pg_temp.motivo($$ select console_salvar_modelo_whatsapp(adm, 'noticia_pedido', 2, (select versao from modelos_whatsapp
  where chave = 'noticia_pedido' and numero = 2), 'Notícia do seu pedido {{1}} no {{2}}: {{3}} · {{4}}, do condomínio.') from ids $$),
  'MODELO_FECHADO', 'W-20: aprovado não se edita');
select is((select count(*) from modelos_whatsapp_eventos e join modelos_whatsapp m on m.id = e.modelo_id where m.chave = 'noticia_pedido'), 3::bigint,
  'W-20: cada decisão fica registrada');

-- Sem modelo aprovado: o retorno fica registrado e o envio vira falha (W-14).
select console_decidir_modelo_whatsapp(adm, 'noticia_pedido', numero, versao, 'DESATIVADO', null) from ids, modelos_whatsapp
 where chave = 'noticia_pedido' and situacao = 'APROVADO_PILOTO';
select pg_temp.limpar_fila();
create temp table r3 as select plataforma_responder_whatsapp(ana, ipe, id, versao, 'O reator chega amanhã.') as r from ids, c, pedidos
 where id = (select id from pm);
select is((select r ->> 'aviso' from r3), 'SEM_MODELO', 'W-20: a tela avisa que não há modelo');
select pg_temp.lote();
select is((select estado || '/' || motivo from envios_whatsapp where id = (select (r ->> 'envio')::uuid from r3)),
  'FALHOU/Sem modelo aprovado para este envio', 'W-14: sem modelo, o envio falha com o motivo');
select ok(exists (select 1 from avisos_whatsapp where tipo = 'FALHA_ENVIO' and envio_id = (select (r ->> 'envio')::uuid from r3)),
  'W-14: e alguém é avisado');
select is((select count(*) from andamentos_pedido where pedido_id = (select id from pm) and texto = 'O reator chega amanhã.'), 1::bigint,
  'AT-06: o retorno continua registrado');
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, decidido_em)
select chave, 3, titulo, para, uso, variaveis, corpo, rodape, 'APROVADO_PILOTO', app_now() from modelos_whatsapp where chave = 'noticia_pedido' and numero = 1;

-- PARAR barra o que o condomínio inicia fora da janela (W-16).
select pg_temp.msg('+5561999990001', 'PARAR');
select ok(pg_temp.ultima('+5561999990001') ~ 'respondemos enquanto a conversa estiver aberta', 'W-16: o PARAR explica a conversa aberta');
select ajustar_relogio(interval '50 hours');
select pg_temp.limpar_fila();
create temp table r4 as select plataforma_responder_whatsapp(ana, ipe, id, versao, 'O reator chegou.') as r from ids, c, pedidos
 where id = (select id from pm);
select is((select r ->> 'aviso' from r4), 'PAROU', 'W-16: a tela avisa que a pessoa pediu para parar');
select pg_temp.lote();
select is((select estado || '/' || motivo from envios_whatsapp where id = (select (r ->> 'envio')::uuid from r4)),
  'FALHOU/A pessoa pediu para parar de receber avisos', 'W-16: fora da janela, não vai');

-- A conclusão vai ao morador do pedido que nasceu no WhatsApp (AT-13).
select pg_temp.msg('+5561999990001', 'VOLTAR');
select pg_temp.limpar_fila();
select plataforma_concluir_pedido(ana, ipe, id, versao, (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO'),
                                  'Trocamos o reator da luminária.', null) from ids, c, pedidos where id = (select id from pm);
create temp table cc as select * from envios_whatsapp where pedido_id = (select id from pm) and finalidade = 'CONCLUSAO';
select ok((select texto ~ ('^Pedido ' || (select protocolo from pm) || E' concluído\.\nO que foi feito: Trocamos o reator da luminária\.\n\nSíndica, do condomínio\n\n'
                           || 'Se não resolveu, responda REVISAR e conte o que continua acontecendo, até [0-9]{2}/[0-9]{2}\.$') from cc),
  'AT-13: a conclusão vai com o que foi feito, quem concluiu e o prazo da revisão');
select is((select modelo_chave || '/' || jsonb_array_length(modelo_parametros) from cc), 'pedido_concluido/5', 'AT-13: fora da janela, pelo modelo');
create temp table pp as select (plataforma_registrar_pedido(ana, ipe, u101, c_marta, null, (select id from categorias where ativa limit 1),
  (select id from prioridades where ativa limit 1), 'Portão do prédio', 'Pedido por telefone.', 'TELEFONE', false, v_ana) ->> 'id')::uuid as id
  from ids, c, u, ct, vs;
select plataforma_concluir_pedido(ana, ipe, id, versao, (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO'),
                                  'Portão regulado pela empresa.', null) from ids, c, pedidos where id = (select id from pp);
select is((select count(*) from envios_whatsapp where pedido_id = (select id from pp) and finalidade = 'CONCLUSAO'), 0::bigint,
  'AT-13: pedido aberto por telefone não manda nada sozinho');

-- Revisão respondida: com quem respondeu e pelo modelo próprio.
select pg_temp.msg('+5561999990001', 'REVISAR continua piscando');
select plataforma_manter_revisao_whatsapp(ana, ipe, id, 'Já trocamos o reator; se voltar, abra um pedido novo.') from ids, c, revisoes_whatsapp
 where decidida_em is null;
select is((select modelo_chave from envios_whatsapp where finalidade = 'RESPOSTA' and texto ~ 'Já trocamos o reator' ), 'revisao_respondida',
  'W-10: a resposta à revisão tem modelo próprio');

-- Aviso à equipe (W-11): fora da janela, o modelo; o retorno vencido diz quando venceu.
select plataforma_meus_avisos_whatsapp(ana, ipe, null, '+5561991002233', array['PEDIDO_NOVO'], true) from ids, c;
select pg_temp.limpar_fila();
select pg_temp.msg('+5561999990001', 'Barulho de obra no 102');
select pg_temp.msg('+5561999990001', '1');
create temp table la as select x from jsonb_array_elements(pg_temp.lote()) x where x ->> 'para' = '+5561991002233';
select ok((select x ->> 'texto' ~ E'^Pedido novo no Residencial Ipê\\.\n[0-9]{4}-[0-9]{4} · Barulho de obra no 102 \\(Torre A · 101\\)\n\nAbrir no painel: \\{\\{painel\\}\\}'
              and x -> 'modelo' ->> 'chave' = 'aviso_pedido_novo' from la),
  'W-11 e W-20: a síndica nunca escreveu ao número, então o aviso vai pelo modelo');

select is(pg_temp.no_condominio(format($$ select texto_aviso_whatsapp('RETORNO_VENCIDO', p) from pedidos p where id = %L $$, (select id from pedidos where assunto ~ 'Barulho de obra')))
            ~ E'\nVenceu (às|em) ', true, 'W-11: o retorno vencido diz quando venceu');
select is(pg_temp.no_condominio(format($$ select jsonb_array_length(parametros_aviso('RETORNO_VENCIDO', p))::text || '/' || (parametros_aviso('RETORNO_VENCIDO', p) ->> 5)
                                     from pedidos p where id = %L $$, (select id from pedidos where assunto ~ 'Barulho de obra'))), '6/{{painel}}', 'W-11: o link do painel a API completa');

-- Regras do modelo.
select ok(modelo_corpo_valido('Olá {{1}}, pedido {{2}}.', 2) and not modelo_corpo_valido('{{1}} pedido {{2}}.', 2)
          and not modelo_corpo_valido('Pedido {{1}}', 1) and not modelo_corpo_valido('Pedido {{1}} {{3}} ok', 2)
          and not modelo_corpo_valido('Pedido {{1}} {x} ok', 1), 'W-20: variáveis em ordem, sem começar nem terminar com uma');

select * from finish();
rollback;

-- A entrada sem pessoa depois do último dia (0318, R17.7c; CM-31; F1 a F4; quadros 489 e 490):
-- todo link público recusa com CONTRATO_ENCERRADO (o nome e desde quando), menos o parar de
-- receber e-mail; o WhatsApp recebido não grava nem responde; as filas cancelam o que estava
-- esperando; as rotinas pulam o condomínio. Antes do último dia e com o encerramento revogado,
-- tudo abre de novo.
begin;
select plan(67);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
grant select on ids, c to dominio;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]') from ids, c;
select teste.vincular(ana, ipe) from ids, c;
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
-- O último dia, gravado como a confirmação grava (o cancelamento em si é o teste 068).
create function pg_temp.encerrar(p_condominio uuid, p_dia date) returns uuid language plpgsql as $$
declare v uuid; k uuid := gen_random_uuid();
begin
  perform set_config('session_replication_role', 'replica', true);
  insert into cancelamentos_cliente (id, interessado_id, condominio_id, pedido_por, pedido_em, aviso_dias, ultimo_dia)
  values (k, gen_random_uuid(), p_condominio, 'Síndica', ((p_dia - 30) + time '12:00') at time zone 'America/Sao_Paulo', 30, p_dia);
  insert into encerramentos_contrato (condominio_id, cancelamento_id, ultimo_dia) values (p_condominio, k, p_dia) returning id into v;
  perform set_config('session_replication_role', 'origin', true);
  return v;
end $$;
-- As rotinas: o que cada uma chama por condomínio anota o condomínio em que entrou.
create table pg_temp.visitas (rotina text, condominio uuid);
grant insert, select on pg_temp.visitas to dominio;
create function pg_temp.anotar(p text) returns integer language sql security definer as $$
  insert into pg_temp.visitas values (p, nullif(current_setting('app.condominio_id', true), '')::uuid) returning 0 $$;
grant execute on function pg_temp.anotar(text) to dominio;

select pg_temp.em('2027-03-10 10:00:00-03');
create temp table enc as select pg_temp.encerrar(ipe, date '2027-03-15') as e1 from c;

-- 1. A função (A1): o último dia que vale e o contrato encerrado.
select is((select contrato_encerrado(ipe) from c), false, 'antes do último dia o contrato vale');
select is((select ultimo_dia from encerramentos_contrato where condominio_id = (select ipe from c)), date '2027-03-15', 'o último dia está gravado');

-- Os links e os códigos de cada família, como as funções da Plataforma criam (só o hash fica).
insert into contatos (id, condominio_id, nome, telefone, email, email_situacao, email_parou_motivo)
select '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', ipe, 'Marina', '+5561999990001', 'marina@exemplo.invalid', 'PAROU', 'PEDIDO' from c;
select entrar_como_sistema(ipe) from c;
create temp table lk as select
  criar_link('COMUNICADO', gen_random_uuid(), '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', null, null, null) as comunicado,
  criar_link('DOCUMENTO', gen_random_uuid(), null, null, null, null) as documento,
  criar_link('CONFIRMAR_EMAIL', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', null, 'marina@exemplo.invalid', null) as confirmar,
  criar_link('PARAR_EMAIL', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', null, 'marina@exemplo.invalid', null) as parar;
-- O código do mural é em maiúsculas (novo_codigo_mural).
alter table lk add column mural text default 'MURALIPE0000001';
insert into links_publicos (hash, condominio_id, tipo) select hash_codigo('MURALIPE0000001'), ipe, 'MURAL' from c;
select limpar_contexto();
insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id)
select hash_codigo(x.cod), ipe, x.tipo, gen_random_uuid()
  from c, (values ('ETIQUETAIPE00001', 'ETIQUETA'), ('PRESTADORIPE0001', 'PRESTADOR'), ('ENQUETEIPE000001', 'ENQUETE'),
                  ('ASSEMBLEIAIPE001', 'ASSEMBLEIA'), ('CADASTROIPE00001', 'CADASTRO'), ('CONSELHOIPE00001', 'CONSELHO'),
                  ('ORCAMENTOIPE0001', 'ORCAMENTO')) x(cod, tipo);

-- 2. Antes do último dia, as portas de entrada abrem (e voltar a receber e-mail funciona).
select lives_ok(format('select entrar_por_link(%L, array[%L])', (select mural from lk), 'MURAL'), 'antes do último dia o mural abre');
select lives_ok(format('select entrar_por_link(%L, array[%L])', (select comunicado from lk), 'COMUNICADO'), 'o comunicado /c abre');
select lives_ok(format('select entrar_por_link(%L, array[%L])', (select documento from lk), 'DOCUMENTO'), 'o documento /d abre');
select lives_ok($$ select entrar_por_codigo('ETIQUETAIPE00001', 'ETIQUETA') $$, 'a etiqueta abre');
select lives_ok($$ select entrar_por_codigo('PRESTADORIPE0001', 'PRESTADOR') $$, 'o link do prestador abre');
select lives_ok($$ select entrar_por_codigo('ORCAMENTOIPE0001', 'ORCAMENTO') $$, 'o orçamento abre');
select is((select publico_voltar_email(voltar.parar) ->> 'parou' from lk voltar), 'false', 'voltar a receber e-mail funciona antes do último dia');
select publico_parar_email(parar) from lk;

-- O WhatsApp e as filas, antes.
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo
  from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;
create function pg_temp.msg(p_id text, p_tel text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_build_object('id', p_id, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', 'Oi, sou do 504', 'enviadaEm', app_now()) || p_extra) $$;
select is(pg_temp.msg('M1', '+5561988771234') ->> 'repetida', 'false', 'antes do último dia a mensagem entra');
select is((select count(*)::integer from mensagens_whatsapp where condominio_id = (select ipe from c)), 1, 'e é gravada');
select ok((select count(*) from envios_whatsapp where para = '+5561988771234') >= 1, 'e a Nina responde');

-- 3. Depois do último dia.
select pg_temp.em('2027-03-16 08:00:00-03');
select is((select contrato_encerrado(ipe) from c), true, 'A1: depois do último dia o contrato está encerrado');
select is((select contrato_encerrado(jatoba) from c), false, 'o outro condomínio continua');
select is((select conjunto_modo(ipe, 'COMUNICACAO_AMPLIADA') from c), 'CONSULTA', 'conjunto_modo usa a mesma função');
select is(pg_temp.erro(format('select exigir_contrato_vigente(%L)', (select ipe from c))) -> 'detalhe',
  '{"motivo": "CONTRATO_ENCERRADO", "condominio": "Residencial Ipê", "desde": "2027-03-16"}'::jsonb,
  'quadro 489: a recusa traz o nome do condomínio e o dia seguinte ao último');

-- Os links (A4): a mesma recusa em todas as famílias.
select is(pg_temp.motivo(format('select publico_mural(%L)', (select mural from lk))), 'CONTRATO_ENCERRADO', 'o mural recusa');
select is(pg_temp.motivo(format('select publico_mural_arquivo(%L, %L, %L)', (select mural from lk), gen_random_uuid(), gen_random_uuid())),
  'CONTRATO_ENCERRADO', 'os arquivos do mural recusam');
select is(pg_temp.motivo(format('select publico_mural_agenda(%L, %L)', (select mural from lk), gen_random_uuid())), 'CONTRATO_ENCERRADO',
  'a agenda do mural recusa');
select is(pg_temp.motivo(format('select publico_mural_classificado_foto(%L, %L)', (select mural from lk), gen_random_uuid())), 'CONTRATO_ENCERRADO',
  'a foto do classificado recusa');
select is(pg_temp.motivo(format('select publico_pedir_documento(%L, %L, %L)', (select mural from lk), gen_random_uuid(), 'marina@exemplo.invalid')),
  'CONTRATO_ENCERRADO', 'pedir documento pelo mural recusa');
select is(pg_temp.motivo(format('select publico_comunicado(%L)', (select comunicado from lk))), 'CONTRATO_ENCERRADO', 'o comunicado /c recusa');
select is(pg_temp.motivo(format('select publico_documento(%L)', (select documento from lk))), 'CONTRATO_ENCERRADO', 'o documento /d recusa');
select is(pg_temp.motivo(format('select publico_confirmar_email(%L)', (select confirmar from lk))), 'CONTRATO_ENCERRADO', 'confirmar o e-mail recusa');
select is(pg_temp.motivo(format('select publico_voltar_email(%L)', (select parar from lk))), 'CONTRATO_ENCERRADO', 'voltar a receber e-mail recusa');
select is((select publico_parar_email(parar) ->> 'parou' from lk), 'true', 'parar de receber e-mail continua');
select lives_ok(format('select entrar_por_link(%L, array[%L])', (select parar from lk), 'PARAR_EMAIL'), 'a porta do parar fica aberta');
select is(pg_temp.motivo($$ select publico_etiqueta('ETIQUETAIPE00001') $$), 'CONTRATO_ENCERRADO', 'a etiqueta recusa');
select is(pg_temp.motivo($$ select publico_etiqueta('etiquetaipe00001') $$), 'CONTRATO_ENCERRADO', 'também digitada em minúsculas');
select is(pg_temp.motivo($$ select publico_prestador('PRESTADORIPE0001') $$), 'CONTRATO_ENCERRADO', 'o prestador recusa com CONTRATO_ENCERRADO (não VALE)');
select is(pg_temp.motivo($$ select publico_prestador_chegada('PRESTADORIPE0001', null) $$), 'CONTRATO_ENCERRADO', 'e as ações dele também');
select is(pg_temp.motivo($$ select publico_enquete('ENQUETEIPE000001') $$), 'CONTRATO_ENCERRADO', 'a enquete /v recusa');
select is(pg_temp.motivo($$ select publico_assembleia('ASSEMBLEIAIPE001') $$), 'CONTRATO_ENCERRADO', 'a assembleia /a recusa');
select is(pg_temp.motivo($$ select publico_cadastro('CADASTROIPE00001', null) $$), 'CONTRATO_ENCERRADO', 'o link de cadastro recusa');
select is(pg_temp.motivo($$ select publico_conselho('CONSELHOIPE00001') $$), 'CONTRATO_ENCERRADO', 'o link do conselho recusa');
select is(pg_temp.motivo($$ select publico_orcamento('ORCAMENTOIPE0001') $$), 'CONTRATO_ENCERRADO', 'o orçamento recusa');
select is(pg_temp.erro($$ select publico_orcamento('ORCAMENTOIPE0001') $$) -> 'detalhe' ->> 'condominio', 'Residencial Ipê',
  'com o nome do condomínio para a página');
select is(pg_temp.erro($$ select entrar_por_codigo('NAOEXISTE0000001', 'ETIQUETA') $$) ->> 'codigo', 'TC404', 'código desconhecido segue não encontrado');

-- O WhatsApp recebido (A2): não grava, não responde, não baixa mídia.
select is(pg_temp.msg('M2', '+5561988771234', '{"tipo": "IMAGEM", "midiaUrl": "https://exemplo.invalid/a.jpg"}'),
  '{"repetida": true, "midias": []}'::jsonb, 'A2: volta como repetida e sem mídias');
select is((select count(*)::integer from mensagens_whatsapp where condominio_id = (select ipe from c)), 1, 'nada é gravado');
select is((select count(*)::integer from envios_whatsapp where para = '+5561988771234' and criado_em >= app_now() - interval '1 minute'), 0,
  'e ninguém responde');
select is(pg_temp.erro($$ select whatsapp_receber('segredo-que-nao-existe-de-jeito-nenhum-123', 'ipe-inst', '{"id": "M3"}') $$) ->> 'codigo', 'TC403',
  'o segredo errado continua recusado');
select is((select current_setting('app.condominio_id', true)), '', 'o contexto do condomínio não fica aberto');
update mensagens_whatsapp set midia_situacao = 'BAIXAR', midia_url = 'https://exemplo.invalid/b.jpg', midia_tipo = 'image/jpeg'
 where condominio_id = (select ipe from c);
select is(jsonb_array_length(whatsapp_midias_pendentes()), 0, 'as mídias pendentes do condomínio encerrado não baixam');
select is((select whatsapp_iniciar_transcricao(ipe, (select id from mensagens_whatsapp where condominio_id = ipe), array['OPENAI'], 30) from c),
  '{"indisponivel": true}'::jsonb, 'nem a transcrição (paga) começa');

-- As filas (A3): o que esperava é cancelado com o motivo e não sai.
insert into envios_whatsapp (condominio_id, para, finalidade, texto, pessoa_id)
select ipe, '+5561988775555', 'AVISO', 'Aviso que ficou na fila', ana from c, ids
union all select jatoba, '+5568988775555', 'AVISO', 'Aviso de outro condomínio', ana from c, ids;
insert into envios_email (condominio_id, tipo, contato_id, para)
select ipe, 'CONFIRMACAO', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', 'marina@exemplo.invalid' from c;
insert into envios_email (condominio_id, tipo, contato_id, para, estado, enviar_apos)
select ipe, 'CONFIRMACAO', '7b0c4a52-2f0e-4c39-8f5e-2a1e9d3c5b11', 'marina@exemplo.invalid', 'ENVIANDO', app_now() - interval '1 hour' from c;
select ok(not exists (select 1 from jsonb_array_elements(whatsapp_pegar_lote(50)) l where (l ->> 'condominio')::uuid = (select ipe from c)),
  'A3: o lote do WhatsApp não traz o condomínio encerrado');
select is((select estado || ' · ' || motivo from envios_whatsapp where para = '+5561988775555'), 'CANCELADA · O contrato do condomínio terminou',
  'o que estava na fila do WhatsApp é cancelado com o motivo');
select isnt((select estado from envios_whatsapp where para = '+5568988775555'), 'CANCELADA', 'a fila do outro condomínio segue');
select ok(not exists (select 1 from jsonb_array_elements(email_pegar_lote(50)) l where l ->> 'para' = 'marina@exemplo.invalid'),
  'o lote de e-mail não traz o condomínio encerrado');
select is((select array_agg(distinct estado || ' · ' || motivo) from envios_email where condominio_id = (select ipe from c)),
  array['CANCELADO · O contrato do condomínio terminou'], 'o e-mail na fila (e o que travou no meio) é cancelado com o motivo');

-- As rotinas (A4/F4): pulam o condomínio encerrado.
create or replace function publicar_programados() returns integer language sql as $$ select pg_temp.anotar('comunicados') $$;
create or replace function verificar_prazos_condominio(p_agora timestamptz) returns integer language sql as $$ select pg_temp.anotar('prazos') $$;
create or replace function abrir_preventivas() returns integer language sql as $$ select pg_temp.anotar('manutencao') $$;
create or replace function lembrar_encomendas() returns integer language sql as $$ select pg_temp.anotar('encomendas') $$;
create or replace function verificar_aprovacoes() returns integer language sql as $$ select pg_temp.anotar('decisoes') $$;
create or replace function dentro_do_horario(p_tipo text, p_quando timestamptz) returns boolean language sql as $$ select pg_temp.anotar('reservas') = 1 $$;
select verificar_comunicados(), verificar_prazos(), verificar_manutencao(), verificar_encomendas(), verificar_decisoes(), verificar_reservas();
select is((select array_agg(distinct rotina order by rotina) from pg_temp.visitas where condominio = (select jatoba from c)),
  array['comunicados', 'decisoes', 'encomendas', 'manutencao', 'prazos', 'reservas'], 'as rotinas passam pelo condomínio que segue');
select is((select count(*)::integer from pg_temp.visitas where condominio = (select ipe from c)), 0, 'e pulam o condomínio encerrado');
select entrar_como_sistema(ipe) from c;
insert into enquetes (condominio_id, pergunta, opcoes, por, secreta, aberta_ate, canais, criado_por, criado_em)
select ipe, 'Pintar a fachada?', array['Sim', 'Não'], 'UNIDADE', false, app_now() - interval '1 day', array['MURAL'], ana, app_now() - interval '8 days'
  from c, ids;
select is(verificar_enquetes(), 0, 'a enquete vencida do condomínio encerrado não fecha');
select ok((select encerrada_em is null from enquetes where pergunta = 'Pintar a fachada?'), 'fica como estava, para consulta');
select is(verificar_assembleias(), 0, 'e a assembleia não manda lembrete');
select limpar_contexto();

-- Com login, depois do último dia: só consulta (0311), agora pela mesma função.
select is(pg_temp.motivo(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select ipe from c), 'pedidos.atualizar')),
  'CONTRATO_ENCERRADO', 'a síndica só consulta');

-- 4. O encerramento revogado (B1): o registro fica e tudo volta sozinho.
select is(pg_temp.motivo(format('update encerramentos_contrato set ultimo_dia = %L where id = %L', date '2027-04-01', (select e1 from enc))),
  'SO_INSERCAO', 'o último dia não muda');
select is(pg_temp.erro(format('delete from encerramentos_contrato where id = %L', (select e1 from enc))) ->> 'codigo', 'TC010', 'nem se apaga');
select throws_ok(format('update encerramentos_contrato set revogado_em = now(), revogado_por = %L where id = %L', (select adm from ids),
  (select e1 from enc)), '23514', null, 'a revogação vem com os três campos');
update encerramentos_contrato set revogado_em = now(), revogado_por = (select adm from ids), revogado_motivo = 'Cancelamento desfeito: teste'
 where id = (select e1 from enc);
select is(pg_temp.motivo(format('update encerramentos_contrato set revogado_motivo = %L where id = %L', 'Outro motivo', (select e1 from enc))),
  'SO_INSERCAO', 'revogado uma vez, não muda mais');
select is((select contrato_encerrado(ipe) from c), false, 'com o encerramento revogado, o contrato vale');
select is((select contrato_ultimo_dia(ipe) from c), null::date, 'e não há último dia');
select lives_ok(format('select entrar_por_link(%L, array[%L])', (select mural from lk), 'MURAL'), 'os links abrem de novo');
select is(pg_temp.msg('M4', '+5561988771234') ->> 'repetida', 'false', 'o WhatsApp volta a receber');
select is(jsonb_array_length(whatsapp_midias_pendentes()), 1, 'e a mídia que esperava volta a baixar');
select lives_ok(format('select pg_temp.encerrar(%L, %L)', (select ipe from c), date '2027-05-31'),
  'o índice único deixa um encerramento novo depois do revogado');
select throws_ok(format('select pg_temp.encerrar(%L, %L)', (select ipe from c), date '2027-06-30'), '23505', null,
  'mas só um encerramento valendo por condomínio');

select * from finish();
rollback;

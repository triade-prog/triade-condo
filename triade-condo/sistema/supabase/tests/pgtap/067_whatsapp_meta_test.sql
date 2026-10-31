-- WhatsApp oficial pela Meta, modelo de parceiro (0315; W-01, W-13 a W-15, W-17, W-20, DC4):
-- a conta chega da Meta sem dono, a equipe liga ao cliente certo, o aviso da Meta acha o
-- condomínio pelo número, os modelos valem só quando aprovados na conta do condomínio, a
-- falta de cartão e a suspensão aparecem, e o piloto não é trocado sem querer.
begin;
select plan(48);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, sup, 'SUPORTE'),
       console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_ana from c, vs;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.cred() returns bytea language sql as $$ select decode(repeat('cd', 40), 'hex') $$;
-- Lê a conexão de um condomínio como o sistema (o RLS isola por condomínio).
create function pg_temp.cx(p uuid) returns conexoes_whatsapp language plpgsql as $$
declare v conexoes_whatsapp;
begin
  perform entrar_como_sistema(p);
  select * into v from conexoes_whatsapp;
  perform entrar_como_sistema(null);
  return v;
end $$;

-- 1. A conta chega da Meta (PARTNER_ADDED) e fica esperando cliente.
select ok(whatsapp_conta_meta_recebida('1029384756', '8877665544', '{"evento": "PARTNER_ADDED"}'), 'a conta da Meta chega');
select ok(whatsapp_conta_meta_recebida('1029384756', null, '{"outro": 1}'), 'a mesma conta de novo só atualiza');
select is((select empresa_meta_id from contas_meta_recebidas where waba_id = '1029384756'), '8877665544', 'a empresa não se perde no aviso repetido');
select is(pg_temp.codigo($$select whatsapp_conta_meta_recebida('abc', null, '{}')$$), 'TC422', 'conta com id estranho é recusada');
select is((select jsonb_array_length(console_contas_meta(impl) -> 'esperando') from ids), 1, 'a implantação vê a conta esperando');

-- 2. O síndico diz que terminou o cadastro na Meta; só o síndico.
select is(pg_temp.codigo(format('select plataforma_whatsapp_meta_terminei(%L, %L)', gil, ipe)), 'TC401', 'quem não é síndico não marca') from ids, c;
select ok(plataforma_whatsapp_meta_terminei(ana, ipe) ? 'cadastroMetaEm', 'o síndico marca que terminou') from ids, c;
select is((select console_contas_meta(impl) -> 'terminaram' -> 0 ->> 'nome' from ids), 'Residencial Ipê', 'a equipe vê quem terminou, para reconhecer a conta');

-- 3. Preparar: conta que não existe, piloto conectado e quem não pode.
select is(pg_temp.codigo(format('select console_meta_preparar(%L, %L, %L)', impl, ipe, '5555555555')), 'TC404', 'conta desconhecida') from ids, c;
select is(pg_temp.codigo(format('select console_meta_preparar(%L, %L, %L)', sup, ipe, '1029384756')), 'TC401', 'o suporte não liga contas') from ids, c;
select pg_temp.cx(ipe) from c;
select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', pg_temp.cred()) from ids, c;
do $$ begin
  perform entrar_como_sistema((select ipe from c));
  update conexoes_whatsapp set situacao = 'CONECTADO', aparelho = '+5561998124400', conectado_em = app_now();
  perform entrar_como_sistema(null);
end $$;
select is(pg_temp.motivo(format('select console_meta_preparar(%L, %L, %L)', impl, ipe, '1029384756')), 'PILOTO_CONECTADO',
          'com o piloto conectado, não liga o oficial') from ids, c;
do $$ begin
  perform entrar_como_sistema((select ipe from c));
  update conexoes_whatsapp set situacao = 'DESCONECTADO', desconectado_em = app_now();
  perform entrar_como_sistema(null);
end $$;
select is(console_meta_preparar(impl, ipe, '1029384756') ->> 'empresaId', '8877665544', 'pronto para falar com a Meta') from ids, c;

-- 4. Ligar a conta ao cliente.
select is(pg_temp.codigo(format('select console_ligar_conta_meta(%L, %L, %L, null, null, %L, %L, null, null, null, %L)',
                                impl, ipe, '1029384756', 'x', '+556133330101', pg_temp.cred())), 'TC422', 'número da Meta inválido') from ids, c;
select is(console_ligar_conta_meta(impl, ipe, '1029384756', '8877665544', 'Condomínio Residencial Ipê', '1403308709535370', '+556133330101',
                                   'Residencial Ipê', 'VERDE', 1000, pg_temp.cred()) ->> 'situacao', 'CONECTADO', 'ligada e conectada') from ids, c;
select is((pg_temp.cx(ipe)).provedor, 'META', 'o provedor passa a ser a Meta') from c;
select ok((pg_temp.cx(ipe)).oficial, 'é oficial') from c;
select is((pg_temp.cx(ipe)).instancia, null, 'a instância do Wafly sai') from c;
select is((select count(*)::integer from ganchos_whatsapp where condominio_id = ipe and revogado_em is null), 0, 'o endereço do Wafly deixa de valer') from c;
select is((select condominio_id from contas_meta_recebidas where waba_id = '1029384756'), ipe, 'a conta sabe de quem é') from c;
select is(pg_temp.motivo(format('select console_meta_preparar(%L, %L, %L)', impl, ipe, '1029384756')), 'CONTA_LIGADA', 'não liga duas vezes') from ids, c;
select whatsapp_conta_meta_recebida('2029384756', null, '{}');
select is(pg_temp.motivo(format('select console_ligar_conta_meta(%L, %L, %L, null, null, %L, %L, null, null, null, %L)',
                                impl, jatoba, '2029384756', '1403308709535370', '+556133330101', pg_temp.cred())), 'NUMERO_LIGADO',
          'o mesmo número não vai para outro cliente') from ids, c;
select is(jsonb_array_length(console_contas_meta(impl) -> 'ligadas'), 1, 'aparece nas ligadas') from ids;
select is(pg_temp.motivo(format('select plataforma_whatsapp_meta_terminei(%L, %L)', ana, ipe)), 'JA_LIGADO', 'depois de ligado, não marca de novo') from ids, c;

-- 5. Recebida pela Meta: o condomínio sai do número.
select is((whatsapp_receber_meta('1403308709535370', jsonb_build_object('id', 'wamid.A1', 'telefone', '+5561999990001', 'tipo', 'TEXTO',
                                                                         'texto', 'Oi', 'enviadaEm', app_now())) ->> 'condominio')::uuid,
          ipe, 'a mensagem cai no condomínio do número') from c;
select ok((whatsapp_receber_meta('9999999999', jsonb_build_object('id', 'wamid.A2', 'telefone', '+5561999990001', 'tipo', 'TEXTO',
                                                                   'texto', 'Oi')) ->> 'ignorada')::boolean, 'número desconhecido é ignorado');
select is((select count(*)::integer from mensagens_whatsapp where provedor_id = 'wamid.A2'), 0, 'e nada é gravado');
select is(pg_temp.codigo($$select whatsapp_receber(null, null, '{"id": "x", "telefone": "+5561999990001", "tipo": "TEXTO", "texto": "a"}')$$),
          'TC403', 'sem segredo e sem número da Meta, recusado');

-- 6. Modelos por condomínio.
select ok(jsonb_array_length(console_modelos_meta_faltando(impl, ipe)) > 0, 'há modelos para mandar à conta do cliente') from ids, c;
create temp table mod as select id, chave, numero from modelos_whatsapp where id = (
  select (x ->> 'modeloId')::uuid from jsonb_array_elements(console_modelos_meta_faltando((select impl from ids), (select ipe from c))) x
   where x ->> 'chave' = 'noticia_pedido');
select is(console_modelos_meta_enviados(impl, ipe, jsonb_build_array(jsonb_build_object('modeloId', id, 'metaId', '777', 'situacao', 'PENDING')))
          ->> 'enviados', '1', 'a resposta da Meta é guardada') from ids, c, mod;
select ok(not exists (select 1 from jsonb_array_elements(console_modelos_meta_faltando((select impl from ids), (select ipe from c))) x
                       where x ->> 'modeloId' = (select id::text from mod)), 'o modelo mandado sai da lista do que falta');
do $$ begin perform entrar_como_sistema((select ipe from c)); end $$;
select is((modelo_em_uso('noticia_pedido', true)).id, null, 'em análise na Meta: ainda não vale');
do $$ begin perform entrar_como_sistema(null); end $$;
select ok(whatsapp_modelo_meta('1029384756', (select chave || '_' || numero from mod), '777', 'APPROVED', null), 'a Meta aprova');
do $$ begin perform entrar_como_sistema((select ipe from c)); end $$;
select is((modelo_em_uso('noticia_pedido', true)).id, (select id from mod), 'aprovado na conta do condomínio: vale');
do $$ begin perform entrar_como_sistema((select jatoba from c)); end $$;
select is((modelo_em_uso('noticia_pedido', false)).chave, 'noticia_pedido', 'no piloto, nada muda');
do $$ begin perform entrar_como_sistema(null); end $$;
select ok(not whatsapp_modelo_meta('5555555555', 'noticia_pedido_1', null, 'APPROVED', null), 'conta desconhecida não muda nada');

-- 7. O lote leva o número e o nome do modelo; a falta de cartão aparece e some.
do $$
declare v uuid;
begin
  perform entrar_como_sistema((select ipe from c));
  v := enfileirar_whatsapp('+5561988887777', null, null, null, null, 'RESPOSTA', 'Teste', (select ana from ids), (select ana from ids));
  update envios_whatsapp set modelo_chave = 'noticia_pedido', modelo_parametros = '["P-1", "Ipê", "texto", "Ana"]' where id = v;
  perform entrar_como_sistema(null);
end $$;
create temp table lote as select x from jsonb_array_elements(whatsapp_pegar_lote(20)) x where x ->> 'provedor' = 'META';
-- O envio do modelo (a conversa com este telefone está fechada); a resposta automática ao "Oi" vai junto.
create temp table env as select e from lote, jsonb_array_elements(x -> 'envios') e where e ->> 'para' = '+5561988887777';
select is((select x ->> 'numeroId' from lote), '1403308709535370', 'o lote leva o id do número');
select is((select e -> 'modelo' ->> 'nome' from env), (select chave || '_' || numero from mod), 'e o nome do modelo na Meta');
select whatsapp_resultado(ipe, ((select e ->> 'envio' from env))::uuid, 'wamid.E1', null, null) from c;
select ok(whatsapp_evento_meta('1403308709535370', 'FALHOU', 'wamid.E1', 131042, 'payment'), 'a Meta diz que falhou');
select ok((pg_temp.cx(ipe)).falta_cartao_em is not null, 'falta o cartão') from c;
do $$ begin perform entrar_como_sistema((select ipe from c)); end $$;
select is((select motivo from envios_whatsapp where provedor_id = 'wamid.E1'), 'A conta do condomínio na Meta está sem cartão', 'a falha diz o motivo');
do $$ begin
  update envios_whatsapp set estado = 'ENVIADA' where provedor_id = 'wamid.E1';
  perform entrar_como_sistema(null);
end $$;
select ok(whatsapp_evento_meta('1403308709535370', 'ENTREGUE', 'wamid.E1', null, null), 'depois, um modelo é entregue');
select is((pg_temp.cx(ipe)).falta_cartao_em, null, 'e o cartão volta a valer') from c;

-- 8. Qualidade e suspensão.
select ok(whatsapp_conta_meta_evento('1029384756', 'QUALIDADE', 'AMARELO', 250, null), 'qualidade muda');
select is((pg_temp.cx(ipe)).limite_diario, 250, 'com o limite novo') from c;
select ok(whatsapp_conta_meta_evento('1029384756', 'SUSPENSO', null, null, 'qualidade baixa'), 'a Meta suspende');
select ok((pg_temp.cx(ipe)).suspenso_em is not null, 'fica suspenso até liberar') from c;

-- 9. Credenciais para baixar a mídia: só do número oficial.
select ok(whatsapp_credenciais_meta(ipe) ->> 'credenciais' is not null, 'a função pega as credenciais do número oficial') from c;
select is(whatsapp_credenciais_meta(gen_random_uuid()) ->> 'credenciais', null, 'condomínio sem número oficial não tem');

select * from finish();
rollback;

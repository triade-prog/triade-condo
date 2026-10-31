-- WhatsApp oficial pela janela da Meta (0319; F5.12; W-01, W-15, W-17, DC4; quadros 466 a 469):
-- só o síndico liga pela janela, no condomínio da sessão; a conta e o número de outro condomínio
-- são recusados; o número que espera o código fica pendente sem mostrar segredo; a equipe confere
-- a conta na Meta e desliga o número com motivo, o síndico fica sabendo e pode ligar de novo.
begin;
select plan(36);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Rui') as rui;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, sup, 'SUPORTE'),
       console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select teste.vincular(ana, ipe) as v_ana, teste.vincular(rui, jatoba) as v_rui,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_ana from c, vs;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.cred() returns bytea language sql as $$ select decode(repeat('cd', 40), 'hex') $$;
create function pg_temp.cx(p uuid) returns conexoes_whatsapp language plpgsql as $$
declare v conexoes_whatsapp;
begin
  perform entrar_como_sistema(p);
  select * into v from conexoes_whatsapp;
  perform entrar_como_sistema(null);
  return v;
end $$;
create function pg_temp.ligar(p_pessoa uuid, p_condominio uuid, p_waba text, p_numero_id text, p_numero text, p_falta boolean)
returns jsonb language sql as $$
  select plataforma_ligar_conta_meta(p_pessoa, p_condominio, p_waba, '8877665544', 'Condomínio Residencial Ipê', p_numero_id, p_numero,
                                     'Residencial Ipê', 'VERDE', 250, pg_temp.cred(), p_falta) $$;

-- 1. Quem pode abrir a janela: só o síndico, no app.
select is((config_whatsapp_r5(ana, ipe) -> 'pode' ->> 'cadastrarMeta')::boolean, true, 'a síndica pode abrir a janela da Meta') from ids, c;
select is((config_whatsapp_r5(gil, ipe) -> 'pode' ->> 'cadastrarMeta')::boolean, false, 'o zelador não pode') from ids, c;
select is(pg_temp.codigo(format('select plataforma_meta_preparar(%L, %L, %L, null, %L)', gil, ipe, '1029384756', '1403308709535370')),
          'TC401', 'o zelador não prepara o cadastro') from ids, c;
select is(pg_temp.codigo(format('select plataforma_meta_preparar(%L, %L, %L, null, %L)', ana, ipe, 'abc', '1403308709535370')),
          'TC422', 'conta da Meta com letras é recusada') from ids, c;

-- 2. O número espera o código: o pendente fica guardado e a tela vê só o número.
select is(plataforma_meta_guardar_pendente(ana, ipe, '1029384756', '8877665544', '1403308709535370', '+5561 3333-0101', pg_temp.cred()) ->> 'numero',
          '+556133330101', 'o pendente guarda o número normalizado') from ids, c;
select is((config_whatsapp_r5(ana, ipe) -> 'conexao' -> 'cadastroPendente' ->> 'numero'), '+556133330101',
          'a tela abre direto a janela do código') from ids, c;
select ok(config_whatsapp_r5(ana, ipe)::text !~ 'credenciais', 'a tela não recebe o token pendente') from ids, c;
select is(plataforma_meta_pendente(ana, ipe) ->> 'numeroId', '1403308709535370', 'a API acha o pendente para pedir o código') from ids, c;
select ok(plataforma_meta_pendente(ana, ipe) ->> 'credenciais' is not null, 'e as credenciais cifradas') from ids, c;
select is(pg_temp.codigo(format('select plataforma_meta_pendente(%L, %L)', gil, ipe)), 'TC401', 'o zelador não lê o pendente') from ids, c;
select is(pg_temp.motivo(format('select plataforma_meta_pendente(%L, %L)', rui, jatoba)), 'SEM_CADASTRO', 'sem janela, não há código para pedir') from ids, c;
select is((select condominio_id from contas_meta_recebidas where waba_id = '1029384756'), null, 'a conta ainda não é de ninguém');

-- 3. O código confere: a conta liga ao condomínio da sessão, sem a equipe.
select is(pg_temp.ligar(ana, ipe, '1029384756', '1403308709535370', '+556133330101', true) ->> 'situacao', 'CONECTADO',
          'a síndica liga o número oficial') from ids, c;
select is((select (condominio_id, ligada_pelo_sindico)::text from contas_meta_recebidas where waba_id = '1029384756'),
          (select (ipe, true)::text from c), 'a conta fica do Ipê, ligada pela síndica');
select is((pg_temp.cx(ipe)).meta_pendente, null, 'o pendente sai') from c;
select is((pg_temp.cx(ipe)).saude, 'FALTA_CARTAO', 'falta o cartão antes do primeiro aviso') from c;
select ok((pg_temp.cx(ipe)).falta_cartao_em is not null, 'e a tela mostra desde quando') from c;
select is(pg_temp.motivo(format('select plataforma_meta_preparar(%L, %L, %L, null, %L)', ana, ipe, '1029384756', '1403308709535370')),
          'JA_LIGADO', 'ligar de novo é recusado') from ids, c;

-- 4. Outro condomínio não pega a conta nem o número do Ipê.
select is(pg_temp.motivo(format('select plataforma_meta_preparar(%L, %L, %L, null, %L)', rui, jatoba, '1029384756', '5550001112223')),
          'CONTA_LIGADA', 'a conta do Ipê é recusada no Jatobá') from ids, c;
select is(pg_temp.motivo(format('select plataforma_meta_preparar(%L, %L, %L, null, %L)', rui, jatoba, '5566778899', '1403308709535370')),
          'NUMERO_LIGADO', 'o número do Ipê é recusado no Jatobá') from ids, c;

-- 5. Os modelos que faltam mandar, pelo síndico.
select ok(jsonb_typeof(plataforma_modelos_meta_faltando(ana, ipe)) = 'array', 'a síndica vê os modelos que faltam') from ids, c;
select is(pg_temp.motivo(format('select plataforma_modelos_meta_faltando(%L, %L)', rui, jatoba)), 'SEM_META', 'sem número oficial, não há modelos') from ids, c;

-- 6. A equipe confere a conta na Meta (quadro 469).
select is(console_meta_conferido(sup, ipe, 'FALTA_CARTAO', 'VERDE', 'Residencial Ipê', 250) ->> 'mudou', 'false',
          'conferir sem mudança diz que nada mudou') from ids, c;
select is(console_meta_conferido(sup, ipe, 'OK', 'AMARELO', null, null) ->> 'mudou', 'true', 'o cartão entrou e a qualidade caiu') from ids, c;
select is((pg_temp.cx(ipe)).falta_cartao_em, null, 'o aviso de cartão some') from c;
select ok(console_meta_conferir_acesso(sup, ipe) ->> 'credenciais' is not null, 'o suporte confere com as credenciais do cliente') from ids, c;
select is((console_whatsapp_meta(sup, ipe) ->> 'saude'), 'OK', 'a ficha mostra a conta em dia') from ids, c;
select is((console_whatsapp_meta(sup, ipe) ->> 'ligadaPeloSindico')::boolean, true, 'a ficha diz que a síndica ligou') from ids, c;
select is(pg_temp.codigo(format('select console_meta_conferido(%L, %L, %L, null, null, null)', sup, ipe, 'TALVEZ')), 'TC422',
          'situação desconhecida é recusada') from ids, c;

-- 7. A equipe desliga com motivo; o síndico é avisado e pode ligar de novo.
select is(pg_temp.codigo(format('select console_meta_desligar(%L, %L, %L)', sup, ipe, 'Pedido da síndica')), 'TC401',
          'o suporte confere, mas não desliga') from ids, c;
select is(pg_temp.codigo(format('select console_meta_desligar(%L, %L, %L)', impl, ipe, 'ok')), 'TC422', 'desligar exige motivo') from ids, c;
select ok(console_meta_desligar(impl, ipe, 'Pedido da síndica por telefone') ->> 'desligadoEm' is not null, 'a equipe desliga o número') from ids, c;
select is((config_whatsapp_r5(ana, ipe) -> 'conexao' ->> 'motivoDesligado'), 'Pedido da síndica por telefone',
          'a síndica vê por que desligou') from ids, c;
select is((console_whatsapp_meta(sup, ipe) ->> 'desligadoPor'), 'Inês', 'a ficha diz quem desligou') from ids, c;
select is((console_contas_meta(impl) -> 'esperando')::text, '[]', 'a conta desligada não volta para a espera') from ids;
select is(pg_temp.ligar(ana, ipe, '1029384756', '1403308709535370', '+556133330101', false) ->> 'situacao', 'CONECTADO',
          'a síndica liga de novo pela janela') from ids, c;

select * from finish();
rollback;

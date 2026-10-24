-- Pedidos e WhatsApp com banco (0289; AT-01, AT-02, W-05, MU-02): a ordem da lista guardada na
-- pessoa (decisão A.1) e o pedido registrado a partir das mensagens com o canal WhatsApp do
-- condomínio, registrado e juntado na mesma transação (decisão A.2).
begin;
select plan(22);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Conselho', array['ACOMPANHAR']) as v_lia
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create temp table cfg as select
  (select id from categorias, c where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades, c where condominio_id = ipe and modelo = 'NORMAL') as normal;

-- Três pedidos, registrados nesta ordem; o do meio com o retorno vencido.
create function pg_temp.registrar(p_assunto text) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), null, null, 'Casa de bombas', (select manutencao from cfg),
            (select normal from cfg), p_assunto, 'Relato do pedido.', 'TELEFONE', false, null) ->> 'id')::uuid $$;
create temp table p as select pg_temp.registrar('Primeiro registrado') as p1;
set local session_replication_role = replica;
update pedidos set criado_em = criado_em - interval '2 days' where id = (select p1 from p);
alter table p add column p2 uuid, add column p3 uuid;
set local session_replication_role = origin;
update p set p2 = pg_temp.registrar('Segundo registrado');
set local session_replication_role = replica;
update pedidos set criado_em = criado_em - interval '1 day', proximo_retorno = app_now() - interval '1 hour' where id = (select p2 from p);
set local session_replication_role = origin;
update p set p3 = pg_temp.registrar('Terceiro registrado');

create function pg_temp.lista(p_pessoa uuid) returns text language sql as $$
  select string_agg(x ->> 'assunto', ' · ' order by n)
    from jsonb_array_elements(plataforma_pedidos(p_pessoa, (select ipe from c), null, null, null, null, null, null, 1) -> 'itens')
         with ordinality as t(x, n) $$;

-- 1. A ordem da lista.
select is((select plataforma_pedidos(ana, ipe, null, null, null, null, null, null, 1) ->> 'ordem' from ids, c), 'ATENCAO',
  'AT-02: sem escolha, a ordem é Pede atenção primeiro');
select is(pg_temp.lista((select ana from ids)), 'Segundo registrado · Primeiro registrado · Terceiro registrado',
  'AT-02: Pede atenção primeiro põe o retorno vencido no alto');
select is((select plataforma_ordem_pedidos(ana, ipe, 'RECENTES') ->> 'ordem' from ids, c), 'RECENTES', 'AT-02: a pessoa escolhe Mais recentes');
select is(pg_temp.lista((select ana from ids)), 'Terceiro registrado · Segundo registrado · Primeiro registrado',
  'AT-02: Mais recentes põe o último registrado no alto');
select is((select plataforma_pedidos(ana, ipe, null, null, null, null, null, null, 1) ->> 'ordem' from ids, c), 'RECENTES',
  'decisão A.1: a escolha fica guardada na pessoa');
select is(pg_temp.lista((select gil from ids)), 'Segundo registrado · Primeiro registrado · Terceiro registrado',
  'decisão A.1: a escolha de uma pessoa não muda a lista das outras');
select plataforma_ordem_pedidos(gil, ipe, 'ANTIGOS') from ids, c;
select is(pg_temp.lista((select gil from ids)), 'Primeiro registrado · Segundo registrado · Terceiro registrado',
  'AT-02: Mais antigos põe o que espera há mais tempo no alto');
select is(pg_temp.campos($$ select plataforma_ordem_pedidos(ana, ipe, 'ALFABETICA') from ids, c $$), '["ordem"]',
  'AT-02: ordem desconhecida é recusada');
select throws_ok($$ select plataforma_ordem_pedidos(adm, ipe, 'RECENTES') from ids, c $$, 'TC401', null,
  'quem não entra no condomínio não guarda ordem');

-- 2. O canal WhatsApp do condomínio só vem com a mensagem.
select is(pg_temp.campos($$ select plataforma_registrar_pedido(ana, ipe, null, null, 'Portão', manutencao, normal, 'Portão travado',
                                   'O portão travou.', 'WHATSAPP', false, null) from ids, c, cfg $$), '["canal"]',
  'W-05: na mão, o canal WhatsApp do condomínio não se escolhe');

insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, tipo, texto, enviada_em, triagem)
select ipe, 'M' || n, '+5561955554444', 'TEXTO', t, app_now(), 'A_IDENTIFICAR'
  from c, (values (1, 'O portão da garagem travou aberto.'), (2, 'Alguém pode olhar?')) v(n, t);
create temp table m as select (select id from mensagens_whatsapp where provedor_id = 'M1') as m1;

create function pg_temp.reg_wa(p_pessoa uuid, p_msg uuid) returns jsonb language sql as $$
  select plataforma_registrar_pedido_whatsapp(p_pessoa, (select ipe from c), p_msg, null, null, 'Portão da garagem',
           (select manutencao from cfg), (select normal from cfg), 'Portão da garagem travado aberto',
           'O portão da garagem travou aberto. Alguém pode olhar?', false, null) $$;

select throws_ok($$ select pg_temp.reg_wa(lia, m1) from ids, m $$, 'TC401', null, 'quem só acompanha não registra pelo WhatsApp');
select is(pg_temp.codigo($$ select pg_temp.reg_wa(ana, gen_random_uuid()) from ids $$), 'TC404', 'mensagem que não existe é recusada');

create temp table r as select pg_temp.reg_wa(ana, m1) as v from ids, m;
select is((select canal from pedidos, r where id = (v ->> 'id')::uuid), 'WHATSAPP', 'W-05: o pedido nasce pelo WhatsApp do condomínio');
select is((select (v ->> 'juntou')::boolean from r), true, 'decisão A.2: registrou e juntou');
select is((select count(*) from mensagens_whatsapp, r where pedido_id = (v ->> 'id')::uuid and triagem = 'TRATADA'), 2::bigint,
  'MU-02: as mensagens do número vão para o pedido e saem de A identificar');
select ok(exists (select 1 from historico h, r where h.entidade_id = v ->> 'id' and h.acao = 'pedido.registrado' and h.dados ->> 'canal' = 'WHATSAPP'),
  'AT-01: o histórico do registro diz o canal');
select is(canal_na_frase('WHATSAPP'), 'pelo WhatsApp do condomínio', 'W-08: a frase do protocolo diz o canal');
select is(current_setting('triade.registro_whatsapp', true), '', 'a marca do registro pelo WhatsApp não fica valendo depois');

-- 3. Se a junção falha, o registro também não fica.
create temp table antes as select count(*) as n from pedidos;
select is(pg_temp.codigo($$ select pg_temp.reg_wa(ana, m1) from ids, m $$), 'TC404',
  'decisão A.2: mensagem já tratada não junta de novo');
select is((select count(*) from pedidos), (select n from antes), 'decisão A.2: e nenhum pedido fica registrado');
insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, tipo, texto, enviada_em, triagem)
select ipe, 'M3', '+5561933332222', 'TEXTO', 'A lâmpada do hall queimou.', app_now(), 'A_IDENTIFICAR' from c;
create function teste.falhar_juntar() returns trigger language plpgsql as $$
begin raise exception 'falha ao juntar' using errcode = 'TC422'; end $$;
create trigger falhar_juntar before update on mensagens_whatsapp for each row execute function teste.falhar_juntar();
select is(pg_temp.codigo($$ select pg_temp.reg_wa(ana, (select id from mensagens_whatsapp where provedor_id = 'M3')) from ids $$), 'TC422',
  'decisão A.2: a junção falha depois do registro');
select is((select count(*) from pedidos), (select n from antes), 'decisão A.2: e o registro volta junto');
drop trigger falhar_juntar on mensagens_whatsapp;

select * from finish();
rollback;

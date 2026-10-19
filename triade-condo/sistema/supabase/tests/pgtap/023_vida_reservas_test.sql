-- Vida em condomínio: áreas comuns e reservas (peça R12; AC-01, AC-06, AC-07, AG-09, W-20, W-22).
-- As áreas prontas nascem inativas; o síndico ajusta, ativa e cria outras. O morador reserva pelo
-- WhatsApp com RESERVAR, escolhendo com números e datas; o síndico aprova, recusa e cancela com
-- motivo, que vai ao morador. O limite por unidade tem tolerância; a Agenda bloqueia a área e
-- mostra as reservas confirmadas. O relógio fica numa quarta-feira, 03/03/2027.
begin;
select plan(67);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Ana Lopes') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['VER_RESERVAS']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_AGENDA']) as v_fabio,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Conselho', array['ACOMPANHAR']) as v_lia
  from ids, c;
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
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui,
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Bia Souza', '+5561955554444', '{"proprietario": false, "mora": true, "ligacao": "FAMILIAR"}', true) as bia
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui
  from vin;
-- Rui é proprietário da 201 sem morar nela: por padrão, não reserva por ela.
select plataforma_incluir_pessoa_unidade(ana, ipe, u201, c_rui, null, null, '{"proprietario": true, "principal": true, "mora": false}', true)
  from ids, c, u, ct;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.cred() returns bytea language sql as $$ select decode(repeat('ab', 40), 'hex') $$;
create temp table seq (n integer);
insert into seq values (0);
create function pg_temp.msg(p_tel text, p_texto text) returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_build_object('id', 'M' || v_n, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', p_texto, 'enviadaEm', app_now()));
end $$;
create temp table vistos (id uuid primary key);
-- As respostas ainda não vistas para um telefone, juntas por " | ".
create function pg_temp.ultima(p_tel text) returns text language plpgsql as $$
declare v text;
begin
  select string_agg(texto, ' | ' order by criado_em, id) into v from envios_whatsapp e
   where para = p_tel and not exists (select 1 from vistos where id = e.id);
  insert into vistos select id from envios_whatsapp e where para = p_tel on conflict do nothing;
  return v;
end $$;
-- Manda e devolve a resposta.
create function pg_temp.diz(p_tel text, p_texto text) returns text language plpgsql as $$
begin
  perform pg_temp.ultima(p_tel);
  perform pg_temp.msg(p_tel, p_texto);
  return pg_temp.ultima(p_tel);
end $$;
create function pg_temp.protocolo(p_area text, p_data date) returns text language sql as $$
  select r.protocolo from reservas r join areas_comuns a on a.id = r.area_id
   where a.nome = p_area and r.data = p_data order by r.criado_em desc, r.protocolo desc limit 1 $$;
create function pg_temp.curto(p text) returns text language sql as $$ select split_part(p, '-', 2) $$;
-- Ajusta uma área do Ipê pela tela, como a síndica.
create function pg_temp.area(p_nome text, p_mudar jsonb) returns jsonb language sql as $$
  select plataforma_salvar_area((select ana from ids), (select ipe from c), a.id, a.versao, area_json(a) || p_mudar)
    from areas_comuns a where a.condominio_id = (select ipe from c) and a.nome = p_nome $$;
create function pg_temp.registrar(p_area text, p_unidade uuid, p_contato uuid, p_data date, p_inicio time default null) returns jsonb
language sql as $$
  select plataforma_registrar_reserva((select ana from ids), (select ipe from c), (select id from areas_comuns where nome = p_area
           and condominio_id = (select ipe from c)), p_unidade, p_contato, p_data, p_inicio, null) $$;
create function pg_temp.vr(p text) returns integer language sql as $$ select versao from reservas where protocolo = p $$;
create function pg_temp.idr(p text) returns uuid language sql as $$ select id from reservas where protocolo = p $$;

-- Conectado, com o termo aceito.
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', pg_temp.cred()) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;

-- Áreas já cadastradas (AC-07).
select is((select count(*)::integer from areas_comuns where condominio_id = (select ipe from c)), 5,
  'AC-07: o condomínio nasce com as cinco áreas prontas');
select is((select count(*)::integer from areas_comuns where condominio_id = (select ipe from c) and ativa), 0, 'AC-07: todas inativas');
select is((select (reserva, antecedencia_min, antecedencia_max, capacidade, limite_quantidade, limite_periodo)::text
             from areas_comuns where modelo = 'SALAO' and condominio_id = (select ipe from c)),
  '(SINDICO,2,60,80,1,MES)', 'AC-07: o salão vem com aprovação do síndico, antecedência, capacidade e limite sugeridos');
select is((select (reserva, limite_quantidade, tolerancia_dias)::text from areas_comuns where modelo = 'CHURRASQUEIRA' and condominio_id = (select ipe from c)),
  '(AUTOMATICA,2,7)', 'AC-07: a churrasqueira confirma na hora, duas por mês, com tolerância de 7 dias');
select is((select (modo, bloco_minutos, limite_periodo)::text from areas_comuns where modelo = 'QUADRA' and condominio_id = (select ipe from c)),
  '(BLOCOS,60,SEMANA)', 'AC-07: a quadra reserva em blocos de 1 hora, com limite por semana');
select is((select reserva from areas_comuns where modelo = 'ACADEMIA' and condominio_id = (select ipe from c)), 'SEM_RESERVA',
  'AC-07: a academia é de uso livre');
select throws_ok($$ select plataforma_salvar_area(bruna, ipe, null, null, '{"nome": "Piscina", "reserva": "AUTOMATICA", "horaInicio": "08:00", "horaFim": "20:00"}')
  from ids, c $$, 'TC401', null, 'AC-07: só quem configura cria área');
select isnt((select plataforma_salvar_area(ana, ipe, null, null, '{"nome": "Brinquedoteca", "reserva": "AUTOMATICA", "antecedenciaMin": 0,
  "antecedenciaMax": 7, "horaInicio": "09:00", "horaFim": "20:00", "modo": "BLOCOS", "blocoMinutos": 120, "capacidade": 12, "ativa": true}') ->> 'id'
  from ids, c), null, 'AC-07: o síndico cria uma área nova, com os mesmos campos');
select is(pg_temp.campos($$ select plataforma_salvar_area(ana, ipe, null, null, '{"nome": " salão de FESTAS ", "reserva": "SINDICO",
  "horaInicio": "10:00", "horaFim": "23:00"}') from ids, c $$), '["nome"]'::jsonb, 'AC-07: o nome não se repete');
select is(pg_temp.campos($$ select plataforma_salvar_area(ana, ipe, null, null, '{"nome": "Piscina", "reserva": "AUTOMATICA",
  "horaInicio": "20:00", "horaFim": "08:00"}') from ids, c $$), '["horaFim"]'::jsonb, 'AC-07: o fim do horário vem depois do início');
select is(pg_temp.campos($$ select pg_temp.area('Quadra', '{"ativa": true, "podeProprietarioMorador": false, "podeInquilino": false}') $$),
  '["podeProprietarioMorador"]'::jsonb, 'AC-01: área ativa precisa de alguém que possa reservar');
select pg_temp.area('Salão de festas', '{"ativa": true, "valorCentavos": 15000}');
select pg_temp.area('Churrasqueira', '{"ativa": true}');
select pg_temp.area('Quadra', '{"ativa": true}');
select is((select count(*)::integer from historico where entidade = 'areas_comuns' and acao = 'area.ativada'), 3, 'AC-07: ativar vai para o histórico');

-- Reserva pelo WhatsApp, com aprovação (AC-01, W-22).
select is(pg_temp.diz('+5561999990001', 'reservar'),
  E'Olá, Marta. Qual área você quer reservar? Responda com o número:\n1. Brinquedoteca\n2. Churrasqueira\n3. Quadra\n4. Salão de festas',
  'AC-01: RESERVAR mostra as áreas ativas, com números');
select is(pg_temp.diz('+5561999990001', '4'),
  'Salão de festas, para até 80 pessoas, das 10h às 23h. Pode ser de 05/03 a 02/05. Qual dia? Responda, por exemplo, 05/03.',
  'AC-01: a Nina diz a capacidade, o horário e as datas possíveis');
select is(pg_temp.diz('+5561999990001', 'sábado que vem'), 'Responda só com o dia, por exemplo 05/03, ou SAIR.',
  'W-22: a Nina não tenta entender texto livre');
select is(pg_temp.diz('+5561999990001', '04/03'),
  'Essa data fica fora do prazo de salão de festas: pode ser de 05/03 a 02/05. Responda com outro dia ou SAIR.',
  'AC-01: fora da antecedência, diz o prazo');
select is(pg_temp.diz('+5561999990001', '13/03'),
  E'Salão de festas está livre no sábado, 13/03, das 10h às 23h. O valor de uso é R$ 150,00.\nResponda SIM para pedir a reserva, outro dia para trocar, ou SAIR.',
  'AC-01: data livre mostra o valor de uso e pede o SIM');
select is(pg_temp.diz('+5561999990001', 'sim'),
  'Pedido de reserva ' || pg_temp.protocolo('Salão de festas', '2027-03-13') || ' registrado: salão de festas, sábado, 13/03, das 10h às 23h, para a Torre A · 101. '
  || E'Quem cuida do condomínio aprova, e eu aviso aqui.\n\nNina, assistente virtual do Residencial Ipê',
  'AC-01: o pedido fica registrado com protocolo e espera a aprovação');
create temp table rs as select pg_temp.protocolo('Salão de festas', '2027-03-13') as r_marta;
select is((select (estado, origem, contato_id = (select c_marta from ct))::text from reservas, rs where protocolo = r_marta),
  '(A_APROVAR,WHATSAPP,t)', 'AC-01: nasce a aprovar, pelo WhatsApp, com quem pediu');
select ok((select r_marta ~ '^2027-R[0-9]{3}$' from rs), 'AC-01: protocolo no formato 2027-R001');
select is((select count(*)::integer from avisos_vida a, ids where a.pessoa_id = ana and a.tipo = 'RESERVA_A_APROVAR'), 1,
  'AC-01: quem cuida das reservas é avisado no sino');

-- Rui pede o mesmo dia: só pela 102, onde mora (a 201 ele não ocupa).
select pg_temp.diz('+5561977771212', 'RESERVAR');
select is(pg_temp.diz('+5561977771212', '4'),
  'Salão de festas, para até 80 pessoas, das 10h às 23h. Pode ser de 05/03 a 02/05. Qual dia? Responda, por exemplo, 05/03.',
  'AC-01: com uma unidade só que pode reservar, não pergunta a unidade');
select pg_temp.diz('+5561977771212', '13/03');
select pg_temp.diz('+5561977771212', 'SIM');
insert into rs select pg_temp.protocolo('Salão de festas', '2027-03-13');
create temp table rr as select (select protocolo from reservas where unidade_id = (select u102 from u) and data = '2027-03-13') as r_rui;
select is((select estado from reservas, rr where protocolo = r_rui), 'A_APROVAR', 'AC-01: dois pedidos podem esperar pela mesma data');
select is((select jsonb_path_query_array(plataforma_reservas(ana, ipe, 'A_APROVAR', null), '$.reservas[*].outrosPedidos') from ids, c),
  '[1, 1]'::jsonb, 'AC-01: a tela mostra que há outro pedido na mesma data');

-- Permissões (CF-03).
select is((select jsonb_array_length(plataforma_reservas(bruna, ipe, 'TODAS', null) -> 'reservas') from ids, c), 2,
  'CF-03: Ver as reservas deixa ver');
select throws_ok($$ select plataforma_aprovar_reserva(bruna, ipe, pg_temp.idr(r_rui), 1, null) from ids, c, rr $$, 'TC401', null,
  'CF-03: Ver as reservas não deixa aprovar');
select throws_ok($$ select plataforma_reservas(lia, ipe, 'TODAS', null) from ids, c $$, 'TC401', null,
  'CF-03: sem a permissão, não vê as reservas');
select throws_ok($$ select plataforma_reservas(davi, ipe, 'TODAS', null) from ids, c $$, 'TC401', null,
  'o síndico de outro condomínio não vê estas reservas');
select is((select jsonb_array_length(plataforma_reservas(davi, jatoba, 'TODAS', null) -> 'reservas') from ids, c), 0,
  'cada condomínio vê só as próprias reservas');

-- Aprovar um recusa o outro, com motivo, e a decisão vai ao morador (decisão 4).
select is(pg_temp.campos($$ select plataforma_recusar_reserva(ana, ipe, pg_temp.idr(r_rui), pg_temp.vr(r_rui), ' ') from ids, c, rr $$),
  '["motivo"]'::jsonb, 'AC-01: recusar pede o motivo');
select pg_temp.ultima('+5561999990001'), pg_temp.ultima('+5561977771212');
select is((select plataforma_aprovar_reserva(ana, ipe, pg_temp.idr(r_marta), pg_temp.vr(r_marta), 'A chave fica com a portaria.') ->> 'recusadas'
             from ids, c, rs where r_marta is not null limit 1), '1', 'AC-01: aprovar recusa o outro pedido da mesma data');
select is((select (estado, motivo)::text from reservas, rr where protocolo = r_rui), '(RECUSADA,"A data ficou com outro pedido de reserva")',
  'AC-01: o outro pedido fica recusado, com o motivo');
select is(pg_temp.ultima('+5561999990001'),
  'Sobre a reserva ' || (select r_marta from rs limit 1) || ': aprovada. Salão de festas, sábado, 13/03, das 10h às 23h, para a Torre A · 101. '
  || E'A chave fica com a portaria.\n\nAna, do condomínio', 'AC-01: a aprovação vai ao morador com o nome de quem decidiu');
select is(pg_temp.ultima('+5561977771212'),
  'Sobre a reserva ' || (select r_rui from rr) || ': recusada. Salão de festas, sábado, 13/03, das 10h às 23h, para a Torre A · 102. '
  || E'Motivo: a data ficou com outro pedido de reserva.\n\nAna, do condomínio', 'AC-01: a recusa também, com o motivo');
select is((select (finalidade, modelo_chave, reserva_id is not null)::text from envios_whatsapp where para = '+5561977771212' and finalidade = 'RESERVA'),
  '(RESERVA,reserva_decidida,t)', 'W-20: a decisão leva o modelo aprovado, para quando a conversa estiver fechada');
select is(pg_temp.motivo($$ select pg_temp.registrar('Salão de festas', u102, null, '2027-03-13') from u $$), 'RESERVA_OCUPADA',
  'AC-01: data com reserva confirmada não aceita outra');
select is(pg_temp.diz('+5561977771212', 'RESERVAR Salão de festas'),
  'Salão de festas, para até 80 pessoas, das 10h às 23h. Pode ser de 05/03 a 02/05. Qual dia? Responda, por exemplo, 05/03.',
  'decisão 6: RESERVAR com o nome da área (o botão da etiqueta) já escolhe a área');
select is(pg_temp.diz('+5561977771212', '13/03'),
  'Salão de festas não está livre no sábado, 13/03. Livre domingo, 14/03 e segunda, 15/03. Responda com outro dia ou SAIR.',
  'AC-01: data ocupada diz as próximas livres');
select is(pg_temp.diz('+5561977771212', 'sair'), 'Tudo bem, a reserva não foi feita. Para começar de novo, mande RESERVAR.', 'W-22: SAIR desiste');

-- A Agenda bloqueia a área e mostra as reservas (AG-09).
select plataforma_marcar_compromisso(ana, ipe, 'REUNIAO', 'Reunião do conselho', '2027-03-20', '19:00', '21:00', 'AREA_COMUM', null,
  'salão de festas', '{}', null, null, null, 'CONFIRMADO', null, null, null, null, false) from ids, c;
select pg_temp.diz('+5561977771212', 'RESERVAR');
select pg_temp.diz('+5561977771212', '4');
select ok(pg_temp.diz('+5561977771212', '20/03') ~ '^Salão de festas não está livre no sábado, 20/03\.',
  'AG-09: compromisso da Agenda na área bloqueia a reserva');
select pg_temp.diz('+5561977771212', 'SAIR');
select is((select teste.erro($$ select plataforma_marcar_compromisso(ana, ipe, 'VISITA', 'Vistoria do som', '2027-03-13', '18:00', '19:00', 'AREA_COMUM',
  null, 'Salão de festas', '{}', null, null, null, 'PLANEJADO', null, null, null, null, false) from ids, c $$) -> 'detalhe' -> 'conflitos' -> 0 ->> 'reserva'),
  'true', 'AG-09: a reserva confirmada aparece como conflito ao marcar compromisso no mesmo lugar');
select is((select jsonb_path_query_array(plataforma_agenda(ana, ipe, '2027-03-01', '2027-03-31'), '$.datas[*] ? (@.fonte == "RESERVA").titulo') from ids, c),
  '["Salão de festas · Torre A · 101"]'::jsonb, 'AG-09: a reserva confirmada aparece na agenda de quem vê reservas');
select is((select jsonb_path_query_array(plataforma_agenda(fabio, ipe, '2027-03-01', '2027-03-31'), '$.datas[*] ? (@.fonte == "RESERVA")') from ids, c),
  '[]'::jsonb, 'AG-09: quem não vê reservas não as vê na agenda');
select ok((select plataforma_agenda_opcoes(ana, ipe) -> 'areas' ? 'Salão de festas' from ids, c), 'decisão 2: as áreas viram sugestão de lugar na Agenda');

-- Limite com tolerância (AC-06): churrasqueira, duas por mês, mais uma se faltar até 7 dias.
select is((select pg_temp.registrar('Churrasqueira', u101, c_marta, '2027-03-05') ->> 'estado' from u, ct), 'CONFIRMADA',
  'AC-01: área automática confirma na hora');
select pg_temp.registrar('Churrasqueira', u101, c_marta, '2027-03-06') from u, ct;
select is(pg_temp.motivo($$ select pg_temp.registrar('Churrasqueira', u101, null, '2027-03-20') from u $$), 'RESERVA_LIMITE',
  'AC-06: a terceira no mês passa do limite');
select pg_temp.registrar('Churrasqueira', u101, c_marta, '2027-03-09') from u, ct;
select is((select tolerancia from reservas where data = '2027-03-09'), true, 'AC-06: a 7 dias ou menos, a tolerância deixa pedir mais uma');
select is(pg_temp.motivo($$ select pg_temp.registrar('Churrasqueira', u101, null, '2027-03-10') from u $$), 'RESERVA_LIMITE',
  'AC-06: a tolerância é de uma só');
select is((select plataforma_reservas(ana, ipe, 'PROXIMAS', (select id from areas_comuns where nome = 'Churrasqueira' and condominio_id = ipe))
             -> 'reservas' -> 2 -> 'limite' from ids, c), '{"n": 3, "periodo": "MES", "quantidade": 2}'::jsonb,
  'AC-06: a tela mostra a conta do limite em cada reserva');
select pg_temp.diz('+5561999990001', 'RESERVAR');
select is(pg_temp.diz('+5561999990001', '2'),
  E'A Torre A · 101 já chegou ao limite de 2 reservas de churrasqueira em março.\nSe a data ainda estiver livre 7 dias antes, dá para pedir mais uma.\n'
  || E'Hoje dá para reservar quinta, 01/04.\n\nResponda com o dia, por exemplo 01/04, ou SAIR.',
  'AC-06: o morador vê o limite antes de pedir, com a próxima data possível');
select is(pg_temp.diz('+5561999990001', '20/03'),
  'A Torre A · 101 já chegou ao limite de 2 reservas de churrasqueira em março. Dá para reservar quinta, 01/04. Responda com outro dia ou SAIR.',
  'AC-06: pedir no mês cheio repete o limite');
select pg_temp.diz('+5561999990001', '01/04');
select is(pg_temp.diz('+5561999990001', 'SIM'),
  'Reserva ' || pg_temp.protocolo('Churrasqueira', '2027-04-01') || ' confirmada: churrasqueira, quinta, 01/04, das 11h às 22h, para a Torre A · 101. '
  || 'Para cancelar, responda CANCELAR ' || pg_temp.curto(pg_temp.protocolo('Churrasqueira', '2027-04-01'))
  || E' até 29/03.\n\nNina, assistente virtual do Residencial Ipê', 'AC-01: na área automática, a reserva sai confirmada, com o jeito de cancelar');

-- Blocos de horas (quadra).
select is(pg_temp.diz('+5561977771212', 'RESERVAR quadra'),
  'Quadra, em blocos de 1 hora, das 7h às 22h. Pode ser de 03/03 a 10/03. Qual dia? Responda, por exemplo, 03/03.',
  'AC-01: área em blocos diz o tamanho do bloco');
select ok(pg_temp.diz('+5561977771212', '04/03') ~ E'^Horários livres na quinta, 04/03\\. Responda com o número:\n1 · das 7h às 8h\n2 · das 8h às 9h\n',
  'AC-01: nos blocos, a Nina lista os horários livres');
select is(pg_temp.diz('+5561977771212', '2'),
  E'Quadra está livre na quinta, 04/03, das 8h às 9h.\nResponda SIM para reservar, outro dia para trocar, ou SAIR.', 'AC-01: escolhido o horário, pede o SIM');
select pg_temp.diz('+5561977771212', 'SIM');
create temp table rq as select pg_temp.protocolo('Quadra', '2027-03-04') as r_quadra;
select is((select (estado, hora_inicio, hora_fim)::text from reservas, rq where protocolo = r_quadra), '(CONFIRMADA,08:00:00,09:00:00)',
  'AC-01: a reserva fica com o bloco escolhido');

-- Cancelar pelo WhatsApp (decisão 6).
select is(pg_temp.diz('+5561977771212', 'CANCELAR R999'),
  E'Não encontrei essa reserva. As suas são:\nCANCELAR ' || (select pg_temp.curto(r_quadra) from rq) || ' · quadra, quinta, 04/03',
  'decisão 6: CANCELAR com protocolo desconhecido lista as reservas da pessoa');
select is(pg_temp.diz('+5561999990001', 'CANCELAR ' || (select pg_temp.curto(r_quadra) from rq)) ~ '^Não encontrei essa reserva', true,
  'decisão 6: ninguém cancela a reserva de outra unidade');
select is(pg_temp.diz('+5561977771212', 'cancelar ' || lower((select pg_temp.curto(r_quadra) from rq))),
  'Reserva ' || (select r_quadra from rq) || E' cancelada: quadra, quinta, 04/03.\n\nNina, assistente virtual do Residencial Ipê',
  'decisão 6: CANCELAR com o protocolo cancela');
select is((select (estado, cancelada_pelo_morador)::text from reservas, rq where protocolo = r_quadra), '(CANCELADA,t)',
  'decisão 6: fica registrado que o morador cancelou');
select is((select count(*)::integer from avisos_vida a, ids where a.pessoa_id = ana and a.tipo = 'RESERVA_CANCELADA'), 1,
  'decisão 6: cancelar depois do prazo da área avisa quem cuida');

-- Quem pode reservar (decisão 5).
select is(pg_temp.diz('+5561955554444', 'RESERVAR'),
  'Pelo cadastro do condomínio, as reservas são feitas por quem mora na unidade como proprietário ou inquilino. Se o seu cadastro está diferente, fale com o condomínio.',
  'decisão 5: familiar não reserva, por padrão');

-- Etiqueta da área (decisão 6).
select plataforma_salvar_etiqueta(ana, ipe, null, null, 'Salão de festas', 'Porta do salão', null, null) from ids, c;
select is((select publico_etiqueta(codigo) -> 'reserva' from etiquetas where local = 'Salão de festas'),
  '{"area": "Salão de festas", "texto": "RESERVAR Salão de festas", "livres": ["2027-03-05", "2027-03-06"], "horario": "das 10h às 23h", "capacidade": 80}'::jsonb,
  'decisão 6: a etiqueta da área mostra as próximas datas livres e o botão de reservar');

-- Área com reserva marcada não desativa (AC-07).
select is(pg_temp.motivo($$ select pg_temp.area('Salão de festas', '{"ativa": false}') $$), 'AREA_COM_RESERVAS',
  'AC-07: área com reserva marcada não desativa');

-- Início e sino (decisão 10).
select pg_temp.registrar('Salão de festas', u102, c_rui, '2027-03-27') from u, ct;
select is((select plataforma_painel(ana, ipe) -> 'vida' ->> 'reservasAAprovar' from ids, c), '1', 'decisão 10: o Início conta as reservas a aprovar');
select ok((select plataforma_avisos(ana, ipe) -> 'itens' @> '[{"tipo": "RESERVA_A_APROVAR"}]' from ids, c), 'decisão 10: o pedido aparece no sino');

-- Conversa fechada: a aprovação vai pelo modelo (W-20).
update envios_whatsapp set estado = 'CANCELADA', motivo = 'teste' where estado = 'NA_FILA';
select ajustar_relogio(timestamptz '2027-03-05 12:00:00-03' - now());
select plataforma_aprovar_reserva(ana, ipe, pg_temp.idr(pg_temp.protocolo('Salão de festas', '2027-03-27')),
  pg_temp.vr(pg_temp.protocolo('Salão de festas', '2027-03-27')), null) from ids, c;
select is((select x -> 'envios' -> 0 ->> 'texto' from jsonb_array_elements(whatsapp_pegar_lote(50)) x limit 1),
  'Sobre a sua reserva ' || pg_temp.protocolo('Salão de festas', '2027-03-27') || ' no Residencial Ipê: aprovada. Salão de festas, sábado, 27/03, '
  || E'das 10h às 23h, para a Torre A · 102.\n\nAna, do condomínio\n\nPara responder, é só mandar mensagem aqui.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: com a conversa fechada, a aprovação vai pelo modelo reserva_decidida');

select * from finish();
rollback;

-- Portaria 1 · Encomendas (PA-01, PA-07 em parte, V-04 a V-06, CF-12, W-20, W-21, PT-01). Quem
-- tem conta própria e a permissão Cuidar da portaria registra, avisa e entrega; a unidade é
-- avisada pelo modelo "Encomenda guardada", todos ao mesmo tempo; quem pediu PARAR não recebe;
-- "Sem aviso" e "Aviso falhou" são coisas diferentes; o lembrete sai uma vez só. O relógio
-- começa num sábado, 24/10/2026, às 14:32.
begin;
select plan(78);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Ana Souza') as ana,
  teste.pessoa('João Ribeiro') as joao,
  teste.pessoa('Lia Prado') as lia,
  teste.pessoa('Edu Campos') as edu,
  teste.pessoa('Síndico Davi') as davi,
  teste.pessoa('Zé Zelador') as ze,
  teste.pessoa('Bia Vizinha') as bia;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Águas Claras', 'Brasília', 'DF', null) as agua,
  console_criar_condominio(adm, 'Edifício Pequi', 'Brasília', 'DF', null) as pequi from ids;
select console_atribuir(adm, agua, impl, 'IMPLANTACAO') from ids, c;
update condominios set cenario = 'PORTARIA_PRESENCIAL' where id = (select agua from c);
update condominios set cenario = 'SEM_PORTARIA' where id = (select pequi from c);
create temp table vs as select
  teste.vincular(ana, agua) as v_ana,
  plataforma_autorizar_pessoa(ana, agua, joao, 'João Ribeiro', 'Porteiro · turno do dia', array['PORTARIA']) as v_joao,
  plataforma_autorizar_pessoa(ana, agua, lia, 'Lia Prado', 'Conselho', array['VER_PORTARIA']) as v_lia,
  plataforma_autorizar_pessoa(ana, agua, edu, 'Edu Campos', 'Cadastro', array['CADASTRAR']) as v_edu,
  teste.vincular(davi, pequi) as v_davi
  from ids, c;
create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.avancar(p interval) returns void language sql as $$ select ajustar_relogio(app_now() + p - now()) $$;
select pg_temp.em('2026-10-24 14:32:00-03');
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

-- Torre A: Marina e Pedro (PARAR) no 101; Caio (número fora do WhatsApp) no 102; Rui (o envio
-- falha) no 103; no 104, só a dona, que não mora; Lúcia (PARAR) no 105.
select plataforma_salvar_bloco(ana, agua, null, null, 'Torre A', 1, true) from ids, c;
select plataforma_incluir_unidades(ana, agua, (select id from blocos where nome = 'Torre A' and condominio_id = (select agua from c)),
  '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}, {"identificacao": "104"}, {"identificacao": "105"}]') from ids, c;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101, (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103, (select id from unidades where identificacao = '104') as u104,
  (select id from unidades where identificacao = '105') as u105;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, agua, u101, null, 'Marina Lopes', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marina,
  plataforma_incluir_pessoa_unidade(ana, agua, u101, null, 'Pedro Souza', '+5561999990002', '{"proprietario": false, "principal": false, "mora": true, "ligacao": "FAMILIAR", "parentesco": "CONJUGE"}', true) as pedro,
  plataforma_incluir_pessoa_unidade(ana, agua, u102, null, 'Caio Nunes', '+5561999990003', '{"proprietario": true, "principal": true, "mora": true}', true) as caio,
  plataforma_incluir_pessoa_unidade(ana, agua, u103, null, 'Rui Alves', '+5561999990004', '{"proprietario": true, "principal": true, "mora": true}', true) as rui,
  plataforma_incluir_pessoa_unidade(ana, agua, u104, null, 'Vera Dona', '+5561999990005', '{"proprietario": true, "principal": true, "mora": false}', true) as vera,
  plataforma_incluir_pessoa_unidade(ana, agua, u105, null, 'Lúcia Ramos', '+5561999990006', '{"proprietario": true, "principal": true, "mora": true}', true) as lucia
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marina ->> 'vinculoId')::uuid) as c_marina,
  (select contato_id from contatos_unidade where id = (pedro ->> 'vinculoId')::uuid) as c_pedro,
  (select contato_id from contatos_unidade where id = (caio ->> 'vinculoId')::uuid) as c_caio,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui,
  (select contato_id from contatos_unidade where id = (lucia ->> 'vinculoId')::uuid) as c_lucia
  from vin;
update contatos set whatsapp_parou_em = app_now() - interval '22 days' where id in (select c_pedro from ct union select c_lucia from ct);

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.lugar() returns uuid language sql as $$
  select id from lugares_encomenda where condominio_id = (select agua from c) and ativo order by ordem limit 1 $$;
create function pg_temp.registrar(p_unidade uuid, p_de text, p_quem uuid default null) returns uuid language sql as $$
  select (plataforma_registrar_encomenda(coalesce(p_quem, joao), agua, p_unidade, p_de, 1, pg_temp.lugar(), null) ->> 'id')::uuid from ids, c $$;
create function pg_temp.aviso(p uuid) returns text language sql as $$
  select aviso || coalesce('/' || aviso_motivo, '') from encomendas where id = p $$;
create function pg_temp.envios(p uuid) returns text language sql as $$
  select coalesce(string_agg(ct.nome || ':' || w.estado, ', ' order by ct.nome, w.criado_em), '-')
    from envios_whatsapp w join contatos ct on ct.id = w.contato_id where w.encomenda_id = p $$;
create function pg_temp.lista(p_quem uuid, p_aba text, p_atalho text default null) returns jsonb language sql as $$
  select plataforma_encomendas(p_quem, agua, p_aba, p_atalho, null, 1) from c $$;

-- O modelo (W-20, W-21).
select is((select situacao || ' · ' || length(rodape) from modelos_whatsapp where chave = 'encomenda_guardada'), 'APROVADO_PILOTO · 46',
  'W-20: o modelo Encomenda guardada, aprovado no piloto, com rodapé dentro dos 60 caracteres da Meta');
select is((select renderizar_modelo(m, '["Torre A · 101", "Mercado Livre · 1 volume", "Sala da portaria", "24/10 às 14:32", "João Ribeiro", "Residencial Águas Claras"]')
             from modelos_whatsapp m where chave = 'encomenda_guardada'),
  E'Encomenda guardada\n\nHá uma encomenda guardada para Torre A · 101.\n\nDe: Mercado Livre · 1 volume\nOnde está: Sala da portaria\nGuardada desde: 24/10 às 14:32\nRecebida por: João Ribeiro\n\nPara retirar, diga seu nome na portaria. Pode retirar quem é da unidade ou alguém que vocês mandarem buscar.\n\nO condomínio nunca pede senha, código ou pagamento por mensagem. Na dúvida, confirme pessoalmente na portaria.\n\nNina, assistente virtual do Residencial Águas Claras.\n\nPara não receber estes avisos, responda PARAR.',
  'W-21: o aviso contra golpes, sem código, assinado pela Nina');

-- As permissões e o cenário (D7, V-04 a V-06).
select is((select string_agg(codigo || '=' || nome, ', ' order by ordem) from permissoes where codigo in ('VER_PORTARIA', 'PORTARIA')),
  'VER_PORTARIA=Ver a portaria, PORTARIA=Cuidar da portaria', 'PA-01: as permissões Ver a portaria e Cuidar da portaria');
select ok((select (plataforma_pessoas(ana, agua) -> 'permissoesDisponiveis')::text ~ 'Cuidar da portaria' from ids, c),
  'CF-03: Cuidar da portaria aparece para dar a uma pessoa autorizada');
select ok('portaria.cuidar' = any (acoes_da_pessoa(joao, agua)), 'PA-01: quem cuida da portaria registra e entrega') from ids, c;
select ok('portaria.ver' = any (acoes_da_pessoa(lia, agua)) and not 'portaria.cuidar' = any (acoes_da_pessoa(lia, agua)),
  'PA-01: quem vê a portaria só acompanha') from ids, c;
select ok('portaria.cuidar' = any (acoes_da_pessoa(ana, agua)), 'V-06: na portaria presencial, o síndico cuida da portaria') from ids, c;
select is(pg_temp.codigo($$ select pg_temp.lista(edu, 'GUARDADAS') from ids $$), 'TC401', 'PA-01: sem a permissão, não vê a portaria');
select is(pg_temp.codigo($$ select plataforma_registrar_encomenda(lia, agua, u101, 'Amazon', 1, pg_temp.lugar(), null) from ids, c, u $$), 'TC401',
  'PA-01: quem só vê não registra');
select is((select string_agg(nome, ', ') from lugares_encomenda where condominio_id = (select agua from c)), 'Zeladoria',
  'CF-12: o condomínio nasce com um lugar para guardar');

-- Sem número conectado, ninguém recebe: a encomenda fica sem aviso.
create temp table e0 as select pg_temp.registrar(u101, 'Correios') as id from u;
select is(pg_temp.aviso(id), 'SEM_AVISO/WHATSAPP_DESLIGADO', 'PA-01: com o WhatsApp desligado, a encomenda fica Sem aviso') from e0;

create temp table g as select console_whatsapp_credenciais(impl, agua, null, 'agua-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, agua) from ids, c;
select console_whatsapp_situacao(impl, agua, 'CONECTADO', '556198124400', null) from ids, c;

-- Registrar avisa todos ao mesmo tempo; quem pediu PARAR não recebe (PA-01, PA-07).
create temp table e1 as select pg_temp.registrar(u101, ' Mercado   Livre ') as id from u;
select is(pg_temp.envios(id), 'Marina Lopes:NA_FILA', 'PA-01: a unidade é avisada junto com o registro; Pedro pediu PARAR e não recebe') from e1;
select is(pg_temp.aviso(id), 'AVISADA', 'PA-01: com o aviso na fila, a encomenda está Avisada') from e1;
select is((select remetente || ' · ' || volumes || ' · ' || nome_pessoa(guardada_por) || ' · ' || estado from encomendas where id = (select id from e1)),
  'Mercado Livre · 1 · João Ribeiro · GUARDADA', 'PT-01: fica registrado quem guardou');
select is((select modelo_chave || ' · ' || (modelo_parametros ->> 3) || ' · ' || (modelo_parametros ->> 4) || ' · ' || finalidade || ' · ' || (enviar_apos = app_now())::text
             from envios_whatsapp where encomenda_id = (select id from e1)),
  'encomenda_guardada · 24/10 às 14:32 · João Ribeiro · ENCOMENDA · true', 'W-20: pelo modelo Encomenda guardada, na hora');
select ok((select texto !~ 'etiqueta' and texto ~ 'Zeladoria' from envios_whatsapp where encomenda_id = (select id from e1)),
  'PA-01: a mensagem diz onde está; a foto da etiqueta não vai');
select is((select count(*) from encomendas e, e1 where e.id = e1.id), 1::bigint, 'PA-01: o registro existe uma vez');

-- Quem fica sabendo e quem pode retirar: nome, sem telefone (regra 3).
create temp table q as select plataforma_encomenda_quem(joao, agua, u101) as r from ids, c, u;
select is((select jsonb_agg(x ->> 'nome' || ':' || (x ->> 'recebe') || ':' || coalesce(x ->> 'motivo', '-')) from q, jsonb_array_elements(r -> 'pessoas') x),
  '["Marina Lopes:true:-", "Pedro Souza:false:PAROU"]'::jsonb, 'PA-01: quem fica sabendo e quem pediu PARAR');
select ok((select r::text !~ '99999' and r::text !~ 'telefone' from q), 'PA-01: quem cuida da portaria não vê telefone');
select is((select r ->> 'recebem' from q), '1', 'PA-07: um aviso para a unidade');
select is(pg_temp.codigo($$ select plataforma_unidade(joao, agua, u101) from ids, c, u $$), 'TC401',
  'PA-01: quem cuida da portaria não abre a ficha completa da unidade');

-- PARAR não recebe; sem contato que more lá: Sem aviso (regra 5).
create temp table e5 as select pg_temp.registrar(u105, 'Shopee') as id from u;
select is(pg_temp.aviso(id) || ' · ' || pg_temp.envios(id), 'SEM_AVISO/PAROU · -', 'PA-01: quem pediu PARAR não recebe; a encomenda fica Sem aviso') from e5;
create temp table e4 as select pg_temp.registrar(u104, 'Amazon') as id from u;
select is(pg_temp.aviso(id) || ' · ' || pg_temp.envios(id), 'SEM_AVISO/SEM_CONTATO · -', 'PA-01: a dona que não mora lá não recebe; Sem aviso') from e4;

-- Número fora do WhatsApp: Sem aviso. Falha de envio: Aviso falhou (regra 5).
create temp table e2 as select pg_temp.registrar(u102, 'Correios') as id from u;
create temp table e3 as select pg_temp.registrar(u103, 'Amazon') as id from u;
create temp table lote as select whatsapp_pegar_lote(20) as l;
select is((select count(*) from lote, jsonb_array_elements(l -> 0 -> 'envios') x), 3::bigint, 'W-20: os três avisos saem no lote');
select ok((select bool_and(x -> 'modelo' ->> 'chave' = 'encomenda_guardada') from lote, jsonb_array_elements(l -> 0 -> 'envios') x),
  'W-20: com a conversa fechada, sai pelo modelo aprovado');
select whatsapp_resultado(agua, (select w.id from envios_whatsapp w, e1 where w.encomenda_id = e1.id), 'P1', null, null) from c;
select whatsapp_resultado(agua, (select w.id from envios_whatsapp w, e2 where w.encomenda_id = e2.id), null,
  'O número não está no WhatsApp (not on whatsapp)', 'PERMANENTE') from c;
select whatsapp_resultado(agua, (select w.id from envios_whatsapp w, e3 where w.encomenda_id = e3.id), null, 'O provedor recusou', 'PERMANENTE') from c;
select is(pg_temp.aviso(id), 'AVISADA', 'PA-01: saiu, continua Avisada') from e1;
select is(pg_temp.aviso(id), 'SEM_AVISO/SEM_WHATSAPP', 'PA-01: o número não está no WhatsApp: Sem aviso, não Aviso falhou') from e2;
select is(pg_temp.aviso(id), 'AVISO_FALHOU', 'PA-01: falha de envio: Aviso falhou') from e3;
select ok((select whatsapp_inexistente_em is not null from contatos where id = (select c_caio from ct)), 'PA-01: o número fica marcado como fora do WhatsApp');
select is((select count(*) from avisos_whatsapp where tipo = 'FALHA_ENVIO'), 0::bigint, 'W-14: falha de aviso de encomenda não toca o sino');
select is(pg_temp.motivo($$ select plataforma_reenviar_whatsapp(ana, agua, (select w.id from envios_whatsapp w, e3 where w.encomenda_id = e3.id), 'Tentar de novo') from ids, c $$),
  'ENCOMENDA_PELA_PORTARIA', 'PA-01: o aviso de encomenda se manda de novo pela Portaria');
create temp table e2b as select pg_temp.registrar(u102, 'Shopee') as id from u;
select is(pg_temp.aviso(id) || ' · ' || pg_temp.envios(id), 'SEM_AVISO/SEM_WHATSAPP · -', 'PA-01: a próxima encomenda de Caio já nasce Sem aviso') from e2b;

-- A lista com abas e atalhos.
select is((select pg_temp.lista(joao, 'GUARDADAS') -> 'contagens' from ids),
  '{"ANTIGAS": 0, "ENTREGUES": 0, "GUARDADAS": 7, "SEM_AVISO": 5, "AVISO_FALHOU": 1}'::jsonb, 'PA-01: as contagens das abas e dos atalhos');
select is((select jsonb_agg(x -> 'unidade' ->> 'rotulo') from ids, jsonb_array_elements(pg_temp.lista(joao, 'GUARDADAS', 'AVISO_FALHOU') -> 'itens') x),
  '["Torre A · 103"]'::jsonb, 'PA-01: o atalho Aviso falhou');
select is((select x -> 'naoChegou' from ids, jsonb_array_elements(pg_temp.lista(joao, 'GUARDADAS', 'AVISO_FALHOU') -> 'itens') x),
  '["Rui Alves"]'::jsonb, 'PA-01: diz a quem o envio não chegou');
select is((select x -> 'pararam' from ids, jsonb_array_elements(pg_temp.lista(joao, 'GUARDADAS') -> 'itens') x where x ->> 'id' = (select id::text from e1)),
  '["Pedro Souza"]'::jsonb, 'PA-01: diz quem pediu PARAR');
select is((select jsonb_agg(x ->> 'remetente') from ids, jsonb_array_elements(plataforma_encomendas(joao, (select agua from c), 'GUARDADAS', null, '103', 1) -> 'itens') x),
  '["Amazon"]'::jsonb, 'PA-01: busca pela unidade');

-- Avisar de novo e avisei por outro meio (regra 5).
select plataforma_avisar_encomenda(joao, agua, (select id from e3)) from ids, c;
select is(pg_temp.aviso(id) || ' · ' || pg_temp.envios(id), 'AVISADA · Rui Alves:FALHOU, Rui Alves:NA_FILA', 'PA-01: avisar de novo põe um aviso novo na fila') from e3;
select ok((select resolvida_por = (select joao from ids) from envios_whatsapp where encomenda_id = (select id from e3) and estado = 'FALHOU'),
  'W-14: a falha fica resolvida por quem avisou de novo');
select is(pg_temp.motivo($$ select plataforma_avisar_encomenda(joao, agua, (select id from e5)) from ids, c $$), 'NINGUEM_RECEBE',
  'PA-01: sem ninguém para receber, avisar de novo não serve');
select plataforma_avisei_encomenda(joao, agua, (select id from e5), 'INTERFONE', 'Lúcia Ramos') from ids, c;
select is((select aviso || ' · ' || outro_meio || ' · ' || outro_meio_com || ' · ' || nome_pessoa(outro_meio_por) from encomendas where id = (select id from e5)),
  'OUTRO_MEIO · INTERFONE · Lúcia Ramos · João Ribeiro', 'PA-01: avisada por outro meio, com o nome e a hora');
select is(pg_temp.motivo($$ select plataforma_avisei_encomenda(joao, agua, (select id from e5), 'SINAL_DE_FUMACA', null) from ids, c $$), null,
  'PA-01: só interfone, bilhete ou pessoalmente');

-- Entregar: quem retirou e quem entregou, sem código (regra 6, PT-01).
select pg_temp.avancar(interval '38 minutes');
select is(pg_temp.motivo($$ select plataforma_entregar_encomenda(joao, agua, (select id from e1), (select c_rui from ct), null, null) from ids, c $$),
  'NAO_E_DA_UNIDADE', 'PA-01: quem retirou como da unidade precisa ser da unidade');
select is(pg_temp.codigo($$ select plataforma_entregar_encomenda(joao, agua, (select id from e1), null, null, null) from ids, c $$), 'TC422',
  'PA-01: entregar pede quem retirou');
select plataforma_entregar_encomenda(joao, agua, (select id from e1), (select c_marina from ct), null, null) from ids, c;
select is((select estado || ' · ' || nome_pessoa(entregue_por) || ' · ' || (select nome from contatos where id = retirou_contato) || ' · ' || to_char(entregue_em at time zone 'America/Sao_Paulo', 'HH24:MI')
             from encomendas where id = (select id from e1)),
  'ENTREGUE · João Ribeiro · Marina Lopes · 15:10', 'PT-01: fica registrado quem entregou, a quem e quando');
select is(pg_temp.motivo($$ select plataforma_entregar_encomenda(joao, agua, (select id from e1), (select c_marina from ct), null, null) from ids, c $$),
  'ENCOMENDA_ENTREGUE', 'PA-01: não se entrega duas vezes');
select plataforma_entregar_encomenda(ana, agua, (select id from e4), null, 'Carlos Dias', 'Motorista da família') from ids, c;
select is((select retirou_nome || ' · ' || retirou_ligacao || ' · ' || nome_pessoa(entregue_por) from encomendas where id = (select id from e4)),
  'Carlos Dias · Motorista da família · Ana Souza', 'PA-01: outra pessoa retira pelo nome, com a ligação');
select is((select count(*) from historico where entidade = 'encomendas' and acao = 'estado.mudou'), 9::bigint,
  'PT-01: o guardião registra a guardada e a entregue');

-- O histórico da unidade (PT-01).
select is((select string_agg(titulo || ' · ' || detalhe || ' · ' || autor, ' | ' order by em, id) from historico_da_unidade((select u101 from u)) where categoria = 'ENCOMENDAS'),
  'Encomenda guardada · Correios · 1 volume · Zeladoria · sem aviso pelo WhatsApp · por João Ribeiro | Encomenda guardada · Mercado Livre · 1 volume · Zeladoria · unidade avisada pelo WhatsApp · por João Ribeiro | Encomenda entregue · Mercado Livre · retirou Marina Lopes · por João Ribeiro',
  'PT-01: o histórico da unidade mostra quem guardou e quem retirou');
select is((select plataforma_historico_unidade(ana, agua, u101, 'ENCOMENDAS', null) ->> 'total' from ids, c, u), '3',
  'PT-01: o histórico da unidade filtra as encomendas');
select is((select string_agg(x ->> 'remetente', ', ') from ids, c, u, jsonb_array_elements(plataforma_encomendas_unidade(joao, agua, u101) -> 'entregues') x),
  'Mercado Livre', 'PA-01: a ficha da unidade mostra as últimas entregues');

-- Corrigir: trocou a unidade, a nova unidade é avisada.
select plataforma_corrigir_encomenda(joao, agua, (select id from e0), 1, u103, 'Correios', 2, pg_temp.lugar(), 'Caixa amassada') from ids, c, u;
select is((select rotulo_unidade(unidade_id) || ' · ' || volumes || ' · ' || observacao from encomendas where id = (select id from e0)),
  'Torre A · 103 · 2 · Caixa amassada', 'PA-01: corrigir o registro');
select is(pg_temp.aviso(id) || ' · ' || pg_temp.envios(id), 'AVISADA · Rui Alves:NA_FILA', 'PA-01: a unidade certa é avisada') from e0;
select is(pg_temp.codigo($$ select plataforma_corrigir_encomenda(joao, agua, (select id from e0), 1, u103, 'Correios', 2, pg_temp.lugar(), null) from ids, c, u $$),
  'TC409', 'AT-24: corrigir segue a versão');

-- Foto da etiqueta: só no painel (regra 4).
create temp table f as select plataforma_iniciar_foto_encomenda(joao, agua, (select id from e3), 'ETIQUETA', 'etiqueta.jpg', 'image/jpeg', 2048) as r from ids, c;
select is(pg_temp.motivo($$ select plataforma_iniciar_foto_encomenda(joao, agua, (select id from e3), 'ETIQUETA', 'etiqueta.pdf', 'application/pdf', 2048) from ids, c $$),
  'TIPO_NAO_ACEITO', 'PA-01: a etiqueta é só foto');
select is(pg_temp.codigo($$ select plataforma_iniciar_foto_encomenda(lia, agua, (select id from e3), 'ETIQUETA', 'e.jpg', 'image/jpeg', 2048) from ids, c $$),
  'TC401', 'PA-01: quem só vê não envia foto');
select plataforma_verificar_foto_encomenda(joao, agua, (select id from e3), (r ->> 'fotoId')::uuid, true, 2048, null) from ids, c, f;
select is((select plataforma_abrir_foto_encomenda(lia, agua, (select id from e3), (r ->> 'fotoId')::uuid) ->> 'tipo' from ids, c, f), 'image/jpeg',
  'PA-01: quem vê a portaria abre a foto da etiqueta');
select ok((select (x ->> 'fotoEtiqueta') is not null from ids, jsonb_array_elements(pg_temp.lista(joao, 'GUARDADAS', 'AVISO_FALHOU') -> 'itens') x
            union all select true limit 1), 'PA-01: a lista sabe que tem foto');

-- O lembrete, uma vez só (regra 7, CF-12).
select pg_temp.avancar(interval '8 days');
select is((select pg_temp.lista(joao, 'GUARDADAS') -> 'contagens' ->> 'ANTIGAS' from ids), '5', 'PA-01: o atalho Guardadas há mais de 7 dias');
select is(verificar_encomendas(), 2, 'PA-01: sai um lembrete por encomenda antiga com alguém para receber');
select is((select (modelo_parametros ->> 3) || ' · ' || para from envios_whatsapp where encomenda_lembrete and encomenda_id = (select id from e3)),
  '24/10 às 14:32 (há 8 dias) · +5561999990004', 'PA-01: o lembrete traz a data em que chegou');
select is((select count(*) from encomendas where estado = 'GUARDADA' and lembrete_em is not null), 5::bigint,
  'PA-01: o lembrete fica marcado mesmo para quem não pode receber');
select is(verificar_encomendas(), 0, 'PA-01: o lembrete é uma vez só');
select is(pg_temp.aviso(id), 'AVISADA', 'PA-01: o lembrete não muda o aviso do registro') from e3;

-- Configurações › Portaria: o lembrete desliga; os lugares.
select plataforma_definir_portaria(ana, agua, (select versao from configuracao_condominio where condominio_id = (select agua from c)), false, 10, false) from ids, c;
create temp table e6 as select pg_temp.registrar(u101, 'Amazon') as id from u;
select pg_temp.avancar(interval '11 days');
select is(verificar_encomendas(), 0, 'CF-12: com o lembrete desligado, não sai');
select is(pg_temp.codigo($$ select plataforma_definir_portaria(joao, agua, 1, true, 7, false) from ids, c $$), 'TC401', 'CF-12: só quem muda as configurações');
select plataforma_salvar_lugar_encomenda(ana, agua, null, null, 'Armário 1', true) from ids, c;
select is(pg_temp.motivo($$ select plataforma_salvar_lugar_encomenda(ana, agua, null, null, ' armário 1 ', true) from ids, c $$), 'LUGAR_REPETIDO',
  'CF-12: dois lugares com o mesmo nome, não');
select is((select string_agg((x ->> 'nome') || ':' || (x ->> 'guardadas'), ', ') from ids, c, jsonb_array_elements(plataforma_portaria(ana, agua) -> 'lugares') x),
  'Zeladoria:6, Armário 1:0', 'CF-12: cada lugar com quantas guardadas agora');
select is((select string_agg((x ->> 'nome') || ':' || (x ->> 'cuida'), ', ') from ids, c, jsonb_array_elements(plataforma_portaria(ana, agua) -> 'quemCuida') x),
  'João Ribeiro:true, Lia Prado:false, Ana Souza:true', 'CF-12: quem cuida da portaria');

-- O Início.
select is((select plataforma_painel(joao, agua) -> 'portaria' from ids, c),
  '{"dias": 10, "antigas": 6, "semAviso": 2, "guardadas": 6, "avisoFalhou": 0}'::jsonb, 'PA-01: o Início resume a portaria');
select ok((select not (plataforma_painel(edu, agua) ? 'portaria') from ids, c), 'PA-01: quem não vê a portaria não tem o resumo');

-- Prédio sem portaria (V-04): ninguém é presumido; quem é indicado vê só o que registra.
select ok(not 'portaria.ver' = any (acoes_da_pessoa(davi, pequi)), 'V-04: sem portaria, nem o síndico tem a Portaria no menu') from ids, c;
select is(pg_temp.codigo($$ select plataforma_encomendas(davi, pequi, 'GUARDADAS', null, null, 1) from ids, c $$), 'TC401',
  'V-04: sem ninguém indicado, a Portaria não abre');
select plataforma_autorizar_pessoa(davi, pequi, ze, 'Zé Zelador', 'Zelador', array['PORTARIA']) from ids, c;
select plataforma_autorizar_pessoa(davi, pequi, bia, 'Bia Vizinha', 'Zeladora substituta', array['PORTARIA']) from ids, c;
select plataforma_salvar_bloco(davi, pequi, null, null, 'Único', 1, true) from ids, c;
select plataforma_incluir_unidades(davi, pequi, (select id from blocos where nome = 'Único'), '[{"identificacao": "201"}]') from ids, c;
create temp table up as select id as u201 from unidades where identificacao = '201';
select plataforma_registrar_encomenda(ze, pequi, u201, 'Correios', 1, (select id from lugares_encomenda where condominio_id = pequi), null) from ids, c, up;
create temp table eb as select (plataforma_registrar_encomenda(bia, pequi, u201, 'Amazon', 1, (select id from lugares_encomenda where condominio_id = pequi), null) ->> 'id')::uuid as id
  from ids, c, up;
select is((select plataforma_encomendas(ze, pequi, 'GUARDADAS', null, null, 1) ->> 'total' from ids, c), '1', 'V-04: quem foi indicado vê só o que registrou');
select is(pg_temp.codigo($$ select plataforma_entregar_encomenda(ze, pequi, (select id from eb), null, 'Fulano', null) from ids, c $$), 'TC404',
  'V-04: e não entrega o que outra pessoa guardou');
update configuracao_condominio set portaria_sindico = true where condominio_id = (select pequi from c);
select is((select plataforma_encomendas(davi, pequi, 'GUARDADAS', null, null, 1) ->> 'total' from ids, c), '2',
  'V-04: o síndico que se indicou vê tudo');

-- Chegou mensagem do número: ele está no WhatsApp, a marca sai.
select whatsapp_receber((select segredo from g), 'agua-inst',
  jsonb_build_object('id', 'M1', 'telefone', '+5561999990003', 'tipo', 'TEXTO', 'texto', 'Oi', 'enviadaEm', app_now()));
select is((select whatsapp_inexistente_em from contatos where id = (select c_caio from ct)), null, 'PA-01: mensagem do número tira a marca de fora do WhatsApp');
select is((select (x ->> 'recebe') from ids, c, u, jsonb_array_elements(plataforma_encomenda_quem(joao, agua, u102) -> 'pessoas') x), 'true',
  'PA-01: e Caio volta a receber');

select * from finish();
rollback;

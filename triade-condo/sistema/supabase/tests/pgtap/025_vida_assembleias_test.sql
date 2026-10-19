-- Vida em condomínio: assembleias (peça R12; AC-02, CD-07, AT-17, W-20).
-- A síndica monta a assembleia e a pauta, confere a antecedência e as frações ideais e convoca:
-- o edital vira comunicado e cada unidade recebe um link pessoal. Pelo link, a Lia (201) passa o
-- voto ao Rui (102); a síndica aceita a procuração. Na hora, o link do Rui marca presença e vota
-- pelas duas unidades; a Marta (101) está no salão e a síndica registra o voto dela. O resultado
-- pesa pela fração ideal, fica guardado ao fechar o item e vai para o rascunho da ata.
-- O relógio começa numa quarta-feira, 03/03/2027.
begin;
select plan(73);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Ana Lopes') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['VER_ASSEMBLEIAS']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_AGENDA']) as v_fabio
  from ids, c;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui,
  plataforma_incluir_pessoa_unidade(ana, ipe, u201, null, 'Lia Matos', '+5561966663333', '{"proprietario": true, "principal": true, "mora": false}', true) as lia,
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Bia Souza', '+5561955554444', '{"proprietario": false, "mora": true, "ligacao": "FAMILIAR"}', true) as bia
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta
  from vin;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vct(p uuid) returns integer language sql as $$ select versao from contatos where id = p $$;
create function pg_temp.va(p uuid) returns integer language sql as $$ select versao from assembleias where id = p $$;
create function pg_temp.salvar(p_id uuid, p_dados jsonb) returns jsonb language sql as $$
  select plataforma_salvar_assembleia((select ana from ids), (select ipe from c), p_id, pg_temp.va(p_id), p_dados) $$;
create function pg_temp.convite(p_unidade uuid) returns uuid language sql as $$ select id from convites_assembleia where unidade_id = p_unidade $$;
create function pg_temp.item(p_ordem integer) returns uuid language plpgsql as $$
begin return (select id from itens_assembleia where ordem = p_ordem and assembleia_id = (select ag from aa)); end $$;
create temp table lotes (n serial, msg jsonb);
create function pg_temp.emails() returns integer language plpgsql as $$
declare m jsonb; v_n integer := 0;
begin
  for m in select jsonb_array_elements(email_pegar_lote(100)) loop
    insert into lotes (msg) values (m);
    perform email_resultado((m ->> 'condominio')::uuid, (m ->> 'envio')::uuid, 'prov-' || (m ->> 'envio'), null, false);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
create temp table whats (n serial, envio jsonb);
create function pg_temp.whats() returns integer language plpgsql as $$
declare l jsonb; x jsonb; v_n integer := 0;
begin
  for l in select jsonb_array_elements(whatsapp_pegar_lote(50)) loop
    for x in select jsonb_array_elements(l -> 'envios') loop
      insert into whats (envio) values (x);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
create function pg_temp.link(p_para text) returns text language sql as $$
  select envio ->> 'link' from whats where envio ->> 'para' = p_para order by n desc limit 1 $$;

-- WhatsApp conectado, mural e e-mail ligados, e-mail da Marta confirmado.
select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], true,
                                      'sindica.ipe@exemplo.invalid', true, true) from ids, c;
select plataforma_email_contato(ana, ipe, c_marta, pg_temp.vct(c_marta), 'marta@exemplo.invalid', true) from ids, c, ct;
select pg_temp.emails();
select publico_confirmar_email((select msg -> 'codigos' ->> 'confirmar' from lotes where msg ->> 'tipo' = 'CONFIRMACAO'));

-- Permissões (CF-03).
select throws_ok($$ select plataforma_assembleias(fabio, ipe) from ids, c $$, 'TC401', null, 'AC-02: sem a permissão, não vê as assembleias');
select throws_ok($$ select plataforma_assembleias(davi, ipe) from ids, c $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não vê');
select throws_ok($$ select plataforma_salvar_assembleia(bruna, ipe, null, null, '{}') from ids, c $$, 'TC401', null, 'AC-02: quem só vê não monta');
select is((select plataforma_assembleias(bruna, ipe) -> 'pode' ->> 'editar' from ids, c), 'false', 'AC-02: quem só vê vê a lista');
select is((select plataforma_assembleias(ana, ipe) -> 'regras' from ids, c) - 'versao', '{"antecedencia": 10, "peso": "FRACAO"}'::jsonb,
  'AC-02: a convenção começa com 10 dias de antecedência e voto pela fração ideal');

-- Conferência dos campos.
select is(pg_temp.campos($$ select pg_temp.salvar(null, '{"titulo": "AG", "tipo": "GERAL", "forma": "ZOOM", "primeiraChamada": "2027-03-01T19:00:00-03:00",
  "segundaChamada": "2027-02-28T19:00:00-03:00", "linkVideo": "http://x"}') $$),
  '["titulo", "tipo", "forma", "primeiraChamada", "segundaChamada", "linkVideo"]'::jsonb,
  'AC-02: título, tipo, forma, chamadas no futuro e em ordem e link https são conferidos');
select is(pg_temp.campos($$ select pg_temp.salvar(null, '{"titulo": "AGO 2027", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
  "primeiraChamada": "2027-03-20T19:00:00-03:00", "segundaChamada": "2027-03-20T19:30:00-03:00",
  "itens": [{"titulo": "Contas", "tipo": "ESCOLHA", "opcoes": ["Sim"], "quorum": "MAIORIA_PRESENTES"}, {"titulo": "X", "quorum": "TUDO"}]}') $$),
  '["itens.1.opcoes", "itens.2.titulo", "itens.2.quorum"]'::jsonb, 'AC-02: cada item da pauta é conferido');
select is(pg_temp.campos($$ select pg_temp.salvar(null, '{"titulo": "AGO 2027", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
  "primeiraChamada": "2027-03-20T19:00:00-03:00", "segundaChamada": "2027-03-20T19:30:00-03:00", "itens": []}') $$),
  '["itens"]'::jsonb, 'AC-02: a pauta tem pelo menos um item');

-- O rascunho.
create temp table aa as select (pg_temp.salvar(null, '{"titulo": "Assembleia de março", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
  "primeiraChamada": "2027-03-20T19:00:00-03:00", "segundaChamada": "2027-03-20T19:30:00-03:00", "local": "Salão de festas",
  "itens": [{"titulo": "Aprovar as contas de 2026", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as ag;
select is((select estado || ' ' || versao from assembleias, aa where id = ag), 'RASCUNHO 1', 'AC-02: a assembleia nasce em rascunho');
select pg_temp.salvar(ag, '{"titulo": "AGO de março", "tipo": "ORDINARIA", "forma": "HIBRIDA",
  "primeiraChamada": "2027-03-20T19:00:00-03:00", "segundaChamada": "2027-03-20T19:30:00-03:00", "local": "Salão de festas",
  "linkVideo": "https://meet.exemplo.invalid/ipe-ago",
  "itens": [{"titulo": "Aprovar as contas de 2026", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"},
            {"titulo": "Eleger o síndico", "descricao": "Mandato de dois anos", "tipo": "ESCOLHA", "opcoes": ["Ana Lopes", "Rui Lima"], "quorum": "MAIORIA_PRESENTES"},
            {"titulo": "Trocar o portão da garagem", "tipo": "APROVACAO", "quorum": "DOIS_TERCOS_TODAS"}]}') from aa;
select is((select titulo || ' ' || forma || ' ' || versao from assembleias, aa where id = ag), 'AGO de março HIBRIDA 2', 'AC-02: o rascunho muda');
select is((select array_agg(ordem || ':' || array_to_string(opcoes, '/') order by ordem) from itens_assembleia, aa where assembleia_id = ag),
  array['1:Sim/Não/Abstenção', '2:Ana Lopes/Rui Lima/Em branco', '3:Sim/Não/Abstenção'],
  'AC-02: aprovação tem Sim, Não e Abstenção; escolha ganha Em branco no fim');

-- Convocar: antecedência e frações (decisões 9 e 11).
select is(pg_temp.motivo($$ select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) from ids, c, aa $$), 'SEM_FRACAO_IDEAL',
  'AC-02: com voto pela fração ideal, toda unidade precisa da fração');
select is((select plataforma_assembleias(ana, ipe) ->> 'semFracao' from ids, c), '3', 'AC-02: a aba diz quantas unidades estão sem fração');
select is(pg_temp.campos($$ select plataforma_salvar_fracoes(ana, ipe, jsonb_build_array(jsonb_build_object('unidadeId', u101, 'fracao', 120, 'versao', 1)))
  from ids, c, u $$), '["fracoes"]'::jsonb, 'AC-02: a fração vai de 0 a 100%');
select throws_ok($$ select plataforma_salvar_fracoes(bruna, ipe, '[]') from ids, c $$, 'TC401', null, 'AC-02: só quem cuida dos moradores muda a fração');
select is((select plataforma_salvar_fracoes(ana, ipe, jsonb_build_array(
    jsonb_build_object('unidadeId', u101, 'fracao', 40, 'versao', (select versao from unidades where id = u101)),
    jsonb_build_object('unidadeId', u102, 'fracao', 35, 'versao', (select versao from unidades where id = u102)),
    jsonb_build_object('unidadeId', u201, 'fracao', 25, 'versao', (select versao from unidades where id = u201)))) from ids, c, u),
  '{"soma": 100.000000, "alteradas": 3}'::jsonb, 'AC-02: as frações das unidades de uma vez, com a soma');
select plataforma_regras_assembleia(ana, ipe, pg_temp.vcfg(), 20, 'FRACAO') from ids, c;
select is(pg_temp.motivo($$ select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) from ids, c, aa $$), 'ASSEMBLEIA_ANTECEDENCIA',
  'AC-02: a convocação respeita a antecedência da convenção');
select is(pg_temp.campos($$ select plataforma_regras_assembleia(ana, ipe, pg_temp.vcfg(), 0, 'METRO') from ids, c $$), '["antecedencia"]'::jsonb,
  'AC-02: a antecedência vai de 1 a 60 dias');
select plataforma_regras_assembleia(ana, ipe, pg_temp.vcfg(), 10, 'FRACAO') from ids, c;

create temp table conv as select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) as r from ids, c, aa;
select is((select (r ->> 'unidades')::integer || ' ' || (r ->> 'envios')::integer from conv), '3 4',
  'AC-02: um convite por unidade; WhatsApp para os três proprietários e e-mail para a Marta (a Bia não é proprietária)');
select is((select estado || ' ' || peso || ' ' || antecedencia from assembleias, aa where id = ag), 'CONVOCADA FRACAO 10',
  'AC-02: convocada, guarda o peso e a antecedência da época');
select is((select array_agg(peso order by peso) from convites_assembleia, aa where assembleia_id = ag), array[25, 35, 40]::numeric[],
  'AC-02: cada unidade pesa a sua fração ideal');
select is((select assunto || ' ' || estado from comunicados, conv where id = (r ->> 'comunicadoId')::uuid), 'ASSEMBLEIA PUBLICADO',
  'AC-02: o edital vai como comunicado publicado');
select ok((select texto like E'%Pauta:\n1. Aprovar as contas de 2026\n2. Eleger o síndico\n3. Trocar o portão da garagem%'
                  and texto like '%2ª chamada: sábado, 20/03, às 19:30%' and texto like '%fração ideal%' and texto not like '%meet.exemplo%'
             from comunicados, conv where id = (r ->> 'comunicadoId')::uuid),
  'AC-02: o edital traz chamadas, pauta e como votar; o endereço da videochamada fica só nos links pessoais');
select is(pg_temp.motivo($$ select pg_temp.salvar(ag, '{}') from aa $$), 'ASSEMBLEIA_CONVOCADA', 'AC-02: convocada, não muda mais');
select is((select plataforma_painel(ana, ipe) -> 'vida' -> 'assembleia' ->> 'titulo' from ids, c), 'AGO de março',
  'AC-02: o painel mostra a próxima assembleia');
select ok((select not coalesce(plataforma_painel(fabio, ipe) -> 'vida' ? 'assembleia', false) from ids, c), 'AC-02: só para quem vê as assembleias');

-- O convite com o link pessoal (W-20).
select is(pg_temp.whats(), 3, 'W-20: a fila de WhatsApp entrega os três convites');
select ok((select bool_and(envio ->> 'link' ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' and envio ->> 'rota' = 'a') from whats),
  'AC-02: cada convite sai com o seu código e a rota do link da assembleia');
select is((select envio ->> 'texto' from whats where envio ->> 'para' = '+5561977771212'),
  E'O Residencial Ipê convoca a assembleia geral ordinária, com 1ª chamada em sábado, 20/03, às 19:00. O edital está no mural.\n\n'
  || E'Pelo link, que é só da Torre A · 102, dá para indicar procurador, registrar presença e votar online:\n[link]'
  || E'\n\nNina, assistente virtual do Residencial Ipê.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: fora das 24 horas, sai o modelo aprovado de convocação com o lugar do link');
select is(pg_temp.emails(), 2, 'AC-02: o e-mail leva o edital e o convite pessoal da Marta');
select ok((select msg -> 'assembleia' ->> 'dono' = 'da Torre A · 101' and msg -> 'codigos' ->> 'votar' is not null
             from lotes where msg ->> 'tipo' = 'ASSEMBLEIA'), 'AC-02: o e-mail do convite tem o link de votar e o de parar');

select is((select publico_assembleia(pg_temp.link('+5561977771212')) ->> 'unidade'), 'Torre A · 102', 'AC-02: o link abre a assembleia da unidade, sem conta');
select ok((select x ->> 'linkVideo' = 'https://meet.exemplo.invalid/ipe-ago' and not x ? 'presenteEm'
             from (select publico_assembleia(pg_temp.link('+5561977771212')) x) t),
  'AC-02: o link mostra a videochamada e, antes de começar, não marca presença');
select throws_ok($$ select publico_assembleia('AAAA-BBBB-CCCC') $$, 'TC404', null, 'AC-02: código que não existe não abre');
select is(pg_temp.motivo($$ select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(1), 1) $$), 'ASSEMBLEIA_FORA_DE_HORA',
  'AC-02: antes de começar não se vota');

-- Procuração (decisão 10).
select is(pg_temp.campos($$ select publico_procuracao_assembleia(pg_temp.link('+5561966663333'), 'Rui Lima', pg_temp.convite(u201)) from u $$),
  '["unidadeId"]'::jsonb, 'AC-02: o procurador é de outra unidade');
select is((select publico_procuracao_assembleia(pg_temp.link('+5561966663333'), 'Rui Lima', pg_temp.convite(u102)) -> 'procuracao' ->> 'estado' from u),
  'PENDENTE', 'AC-02: a Lia indica o Rui pelo link e a procuração espera a síndica');
select is((select plataforma_assembleias(ana, ipe) -> 'assembleias' -> 0 ->> 'procuracoesPendentes' from ids, c), '1',
  'AC-02: a aba mostra a procuração a conferir');
select is(pg_temp.campos($$ select plataforma_procuracao(ana, ipe, ag, pg_temp.convite(u201), false, '') from ids, c, aa, u $$), '["motivo"]'::jsonb,
  'AC-02: recusar pede o motivo');
select plataforma_procuracao(ana, ipe, ag, pg_temp.convite(u201), true, null) from ids, c, aa, u;
select is(pg_temp.motivo($$ select publico_procuracao_assembleia(pg_temp.link('+5561966663333'), null, null) $$), 'PROCURACAO_DECIDIDA',
  'AC-02: aceita pela síndica, a procuração não muda pelo link');
select is((select publico_assembleia(pg_temp.link('+5561977771212')) -> 'representa'), '["Torre A · 201"]'::jsonb,
  'AC-02: o link do Rui passa a valer também pela 201');

-- Sem direito a voto (decisão 11).
select is(pg_temp.campos($$ select plataforma_direito_voto(ana, ipe, ag, pg_temp.convite(u101), true, null) from ids, c, aa, u $$), '["motivo"]'::jsonb,
  'AC-02: tirar o direito a voto pede o motivo');
select plataforma_direito_voto(ana, ipe, ag, pg_temp.convite(u101), true, 'Fora da convenção para teste') from ids, c, aa, u;
select ok((select publico_assembleia(pg_temp.link('+5561999990001')) ->> 'semDireito' = 'true'), 'AC-02: o link da unidade mostra que está sem direito');
select plataforma_direito_voto(ana, ipe, ag, pg_temp.convite(u101), false, null) from ids, c, aa, u;

-- O lembrete na véspera.
select ajustar_relogio(timestamptz '2027-03-19 19:05:00-03' - now());
select verificar_comunicados();
select is((select count(*)::integer from envios_whatsapp where modelo_chave = 'assembleia_lembrete'), 3, 'AC-02: o lembrete vai na véspera');
select verificar_comunicados();
select is((select count(*)::integer from envios_whatsapp where modelo_chave = 'assembleia_lembrete'), 3, 'AC-02: e vai uma vez só');
select pg_temp.whats();

-- Na hora.
select ajustar_relogio(timestamptz '2027-03-20 18:00:00-03' - now());
select is(pg_temp.motivo($$ select plataforma_iniciar_assembleia(ana, ipe, ag, pg_temp.va(ag)) from ids, c, aa $$), 'ASSEMBLEIA_CEDO',
  'AC-02: começa a partir de meia hora antes da 1ª chamada');
select ajustar_relogio(timestamptz '2027-03-20 18:45:00-03' - now());
select plataforma_iniciar_assembleia(ana, ipe, ag, pg_temp.va(ag)) from ids, c, aa;
select is((select publico_assembleia(pg_temp.link('+5561977771212')) ->> 'estado'), 'EM_ANDAMENTO', 'AC-02: a assembleia começou');
select is((select array_agg(presenca_forma order by peso) from convites_assembleia, aa where assembleia_id = ag and presente_em is not null),
  array['ONLINE', 'ONLINE'], 'AC-02: abrir o link marca presença online da 102 e da 201, que o Rui representa');
select is((select plataforma_assembleia(ana, ipe, ag) -> 'assembleia' -> 'itens' -> 2 -> 'resultado' ->> 'alcancavel' from ids, c, aa), 'false',
  'AC-02: com 60% das frações presentes, o item de dois terços de todas avisa que não é alcançável');

select is((select plataforma_abrir_item(ana, ipe, ag, pg_temp.item(1)) ->> 'estado' from ids, c, aa), 'ABERTO', 'AC-02: a síndica abre o item 1');
select is(pg_temp.motivo($$ select plataforma_abrir_item(ana, ipe, ag, pg_temp.item(2)) from ids, c, aa $$), 'OUTRO_ITEM_ABERTO',
  'AC-02: um item em votação por vez');
select is(pg_temp.motivo($$ select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(2), 1) $$), 'ITEM_FECHADO',
  'AC-02: só o item aberto recebe voto');
select is(pg_temp.campos($$ select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(1), 4) $$), '["opcao"]'::jsonb,
  'AC-02: só as opções do item');
select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(1), 2);
select is((select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(1), 1) -> 'itens' -> 0 ->> 'meuVoto'), '1',
  'AC-02: o voto pode ser trocado enquanto o item está aberto');
select is((select array_agg(opcao || '/' || trocas || '/' || peso order by peso) from votos_assembleia where item_id = pg_temp.item(1)),
  array['1/1/25.000000', '1/1/35.000000'], 'AC-02: o voto do Rui vale pela 102 e pela 201, cada uma com a sua fração');
select is(pg_temp.motivo($$ select publico_votar_assembleia(pg_temp.link('+5561966663333'), pg_temp.item(1), 2) $$), 'SEM_DIREITO_A_VOTO',
  'AC-02: com a procuração aceita, o link da Lia não vota');
select plataforma_registrar_voto(ana, ipe, ag, pg_temp.convite(u101), pg_temp.item(1), 2) from ids, c, aa, u;
select is((select presenca_forma from convites_assembleia, u where id = pg_temp.convite(u101)), 'SALAO',
  'AC-02: o voto registrado pela síndica marca a Marta presente no salão');
select is(pg_temp.motivo($$ select plataforma_presenca_assembleia(ana, ipe, ag, pg_temp.convite(u101), false) from ids, c, aa, u $$), 'JA_VOTOU',
  'AC-02: quem já votou não perde a presença');

create temp table r1 as select plataforma_encerrar_item(ana, ipe, ag, pg_temp.item(1)) -> 'resultado' as r from ids, c, aa;
select is((select r ->> 'situacao' from r1), 'APROVADO', 'AC-02: maioria dos presentes: Sim 60% contra Não 40%, aprovado');
select is((select jsonb_path_query_array(r, '$.opcoes[*].porcentagem') from r1), '[60.0, 40.0, 0]'::jsonb, 'AC-02: o resultado pesa pela fração ideal');
select throws_ok($$ update itens_assembleia set titulo = 'Outro' where id = pg_temp.item(1) $$, 'TC422', null,
  'AC-02: os números do item fechado não mudam');
select is(pg_temp.motivo($$ select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(1), 2) $$), 'ITEM_FECHADO',
  'AC-02: fechado o item, não há mais voto');

select plataforma_abrir_item(ana, ipe, ag, pg_temp.item(2)) from ids, c, aa;
select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(2), 2);
select plataforma_registrar_voto(ana, ipe, ag, pg_temp.convite(u101), pg_temp.item(2), 1) from ids, c, aa, u;
select is((select plataforma_assembleia(ana, ipe, ag) -> 'assembleia' -> 'itens' -> 1 -> 'resultado' ->> 'vencedor' from ids, c, aa), 'Rui Lima',
  'AC-02: o resultado aparece enquanto o item está aberto');

-- Encerrar e a ata (decisão 13).
select plataforma_encerrar_assembleia(ana, ipe, ag, pg_temp.va(ag)) from ids, c, aa;
select is((select array_agg(estado order by ordem) from itens_assembleia, aa where assembleia_id = ag), array['ENCERRADO', 'ENCERRADO', 'AGUARDANDO'],
  'AC-02: encerrar fecha o item que estava aberto');
select ok((select ata_texto like E'%Presentes: 3 de 3 unidades (2 online, 1 no salão, 1 por procuração), 100,0% das frações ideais.%'
                  and ata_texto like E'%1. Aprovar as contas de 2026: aprovado (Sim 2, Não 1, Abstenção 0)\n2. Eleger o síndico: escolhida a opção Rui Lima (Ana Lopes 1, Rui Lima 2, Em branco 0)\n3. Trocar o portão da garagem: não votado%'
             from assembleias, aa where id = ag), 'AC-02: o rascunho da ata vem com a presença e o resultado de cada item');
select is(pg_temp.motivo($$ select publico_votar_assembleia(pg_temp.link('+5561977771212'), pg_temp.item(3), 1) $$), 'ASSEMBLEIA_FORA_DE_HORA',
  'AC-02: encerrada, não se vota mais');
create temp table doc as select
  (plataforma_salvar_documento(ana, ipe, null, null, 'ATA', 'Ata da AGO de março', null, false, true, null) ->> 'id')::uuid as ata,
  (plataforma_salvar_documento(ana, ipe, null, null, 'REGIMENTO', 'Regimento interno', null, false, true, null) ->> 'id')::uuid as reg
  from ids, c;
select is(pg_temp.campos($$ select plataforma_ata_assembleia(ana, ipe, ag, pg_temp.va(ag), null, reg) from ids, c, aa, doc $$), '["documentoId"]'::jsonb,
  'AC-02: só uma ata de Documentos se liga à assembleia');
select plataforma_ata_assembleia(ana, ipe, ag, pg_temp.va(ag), 'Presidente: Ana Lopes', ata) from ids, c, aa, doc;
select is((select plataforma_assembleia(ana, ipe, ag) -> 'assembleia' -> 'ataDocumento' ->> 'titulo' from ids, c, aa), 'Ata da AGO de março',
  'AC-02: a ata assinada fica ligada à assembleia');
select ok((select plataforma_linha_do_tempo(ana, ipe, 'COMUNICADOS', null)::text like '%Assembleia realizada: AGO de março%' from ids, c),
  'CD-07: a assembleia realizada entra na linha do tempo da Memória');
select ok((select plataforma_assembleia(ana, ipe, ag) -> 'historico' @> '[{"acao": "assembleia.procuracao_aceita"}, {"acao": "assembleia.encerrada"}]' from ids, c, aa),
  'AT-17: cada passo fica no histórico da assembleia');
select throws_ok($$ select plataforma_assembleia(davi, jatoba, ag) from ids, c, aa $$, 'TC404', null, 'PT-01: outro condomínio não acha a assembleia');

-- Cancelar uma assembleia convocada tira da fila os avisos que não saíram.
select ajustar_relogio(timestamptz '2027-03-22 10:00:00-03' - now());
create temp table ae as select (pg_temp.salvar(null, '{"titulo": "AGE da fachada", "tipo": "EXTRAORDINARIA", "forma": "ONLINE",
  "primeiraChamada": "2027-04-10T19:00:00-03:00", "segundaChamada": "2027-04-10T19:30:00-03:00", "linkVideo": "https://meet.exemplo.invalid/age",
  "itens": [{"titulo": "Pintar a fachada", "tipo": "APROVACAO", "quorum": "MAIORIA_TODAS"}]}') ->> 'id')::uuid as age;
select plataforma_convocar_assembleia(ana, ipe, age, pg_temp.va(age)) from ids, c, ae;
select is(pg_temp.campos($$ select plataforma_cancelar_assembleia(ana, ipe, age, pg_temp.va(age), '') from ids, c, ae $$), '["motivo"]'::jsonb,
  'AC-02: cancelar pede o motivo');
select plataforma_cancelar_assembleia(ana, ipe, age, pg_temp.va(age), 'Orçamento ainda não chegou') from ids, c, ae;
select is((select count(*)::integer from envios_whatsapp w join convites_assembleia x on x.id = w.convite_assembleia_id, ae
            where x.assembleia_id = age and w.estado = 'CANCELADA' and w.motivo = 'A assembleia foi cancelada'), 3,
  'AC-02: os convites que não saíram são cancelados');

select * from finish();
rollback;

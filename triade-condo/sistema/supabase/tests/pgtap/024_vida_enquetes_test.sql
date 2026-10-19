-- Vida em condomínio: enquetes e o link pessoal (peça R12; AC-03, W-20).
-- A síndica cria a enquete; cada unidade recebe pelo WhatsApp e pelo e-mail um link só dela, com
-- código novo a cada envio. A resposta pode ser trocada até o prazo; na secreta, ninguém liga a
-- escolha à unidade depois que fecha. O lembrete vai uma vez, só para quem falta. O resultado
-- vira comunicado em rascunho. O relógio fica numa quarta-feira, 03/03/2027.
begin;
select plan(53);

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
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['VER_ENQUETES']) as v_bruna,
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
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Bia Souza', '+5561955554444', '{"proprietario": false, "mora": true, "ligacao": "FAMILIAR"}', true) as bia
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui,
  (select contato_id from contatos_unidade where id = (bia ->> 'vinculoId')::uuid) as c_bia
  from vin;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vct(p uuid) returns integer language sql as $$ select versao from contatos where id = p $$;
create function pg_temp.ve(p uuid) returns integer language sql as $$ select versao from enquetes where id = p $$;
create function pg_temp.criar(p_dados jsonb) returns jsonb language sql as $$
  select plataforma_criar_enquete((select ana from ids), (select ipe from c), p_dados) $$;
-- A fila de e-mail e a de WhatsApp, como a api-plataforma: pega o lote e diz que saiu.
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
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo
  from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], true,
                                      'sindica.ipe@exemplo.invalid', true, true) from ids, c;
select plataforma_email_contato(ana, ipe, c_marta, pg_temp.vct(c_marta), 'marta@exemplo.invalid', true) from ids, c, ct;
select pg_temp.emails();
select publico_confirmar_email((select msg -> 'codigos' ->> 'confirmar' from lotes where msg ->> 'tipo' = 'CONFIRMACAO'));

-- Permissões (CF-03).
select throws_ok($$ select plataforma_enquetes(fabio, ipe) from ids, c $$, 'TC401', null, 'AC-03: sem a permissão, não vê as enquetes');
select throws_ok($$ select plataforma_enquetes(davi, ipe) from ids, c $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não vê');
select throws_ok($$ select plataforma_criar_enquete(bruna, ipe, '{}') from ids, c $$, 'TC401', null, 'AC-03: quem só vê não cria');
select is((select plataforma_enquetes(bruna, ipe) -> 'pode' ->> 'editar' from ids, c), 'false', 'AC-03: quem só vê vê as enquetes');

-- Conferência dos campos.
select is(pg_temp.campos($$ select pg_temp.criar('{"pergunta": "Oi", "opcoes": ["Sim", " sim "], "por": "CASA", "abertaAte": "2027-07-01T12:00:00-03:00",
  "canais": ["SMS"]}') $$), '["pergunta", "opcoes", "por", "secreta", "abertaAte", "canais"]'::jsonb,
  'AC-03: pergunta, opções distintas, quem responde, sigilo, prazo de até 90 dias e canais são conferidos');
select is(pg_temp.campos($$ select pg_temp.criar('{"pergunta": "Pintamos o hall?", "opcoes": ["Sim"], "por": "UNIDADE", "secreta": true,
  "abertaAte": "2027-03-03T12:30:00-03:00", "canais": ["MURAL"]}') $$), '["opcoes", "abertaAte"]'::jsonb,
  'AC-03: pelo menos duas opções e prazo de pelo menos uma hora');

-- A enquete secreta, por unidade.
create temp table q as select pg_temp.criar('{"pergunta": "Qual cor para a fachada?", "opcoes": ["Cinza", "Areia", "Branca"], "por": "UNIDADE",
  "secreta": true, "abertaAte": "2027-03-08T20:00:00-03:00", "canais": ["WHATSAPP", "MURAL", "EMAIL"]}') as r;
create temp table qi as select (r ->> 'id')::uuid as cor from q;
select is((select (r ->> 'convites')::integer from q), 3, 'AC-03: um convite por unidade ativa');
select is((select (r ->> 'envios')::integer from q), 4, 'AC-03: WhatsApp para os três contatos e e-mail para a Marta');
select is((select lembrete_em from enquetes, qi where id = cor), timestamptz '2027-03-06 20:00:00-03', 'AC-03: o lembrete fica para dois dias antes do fim');
select ok((select bool_and(texto like '%[link]%' and modelo_chave = 'enquete_convite' and convite_enquete_id is not null)
             from envios_whatsapp where finalidade = 'ENQUETE'),
  'W-20: o texto guardado tem só o lugar do link, e vai pelo modelo aprovado');
select is((select texto from envios_whatsapp where finalidade = 'ENQUETE' and para = '+5561977771212'),
  E'Enquete do Residencial Ipê: Qual cor para a fachada?\n\nResponda até 08/03, às 20:00 pelo link, que é só da Torre A · 102:\n[link]'
  || E'\n\nNina, assistente virtual do Residencial Ipê', 'AC-03: o convite diz a pergunta, o prazo e de quem é o link');

select is(pg_temp.whats(), 3, 'W-20: a fila de WhatsApp entrega os três convites');
select ok((select bool_and(envio ->> 'link' ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$') from whats),
  'AC-03: cada convite sai com o seu código, que a API põe no lugar de [link]');
select is((select envio ->> 'texto' from whats where envio ->> 'para' = '+5561977771212'),
  E'Enquete do Residencial Ipê: Qual cor para a fachada?\n\nResponda até 08/03, às 20:00 pelo link, que é só da Torre A · 102:\n[link]'
  || E'\n\nNina, assistente virtual do Residencial Ipê.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: fora das 24 horas, sai o modelo aprovado com o lugar do link');
select ok((select not exists (select 1 from codigos_sem_conta s where s.tipo = 'ENQUETE'
                                 and exists (select 1 from envios_whatsapp w where w.texto like '%' || pg_temp.link('+5561977771212') || '%'))),
  'AC-03: o código não fica guardado no texto, só o hash');

select is((select publico_enquete(pg_temp.link('+5561999990001')) ->> 'para'), 'Torre A · 101', 'AC-03: o link abre a enquete da unidade, sem conta');
select ok((select publico_enquete(pg_temp.link('+5561955554444')) ->> 'para' = 'Torre A · 101'), 'AC-03: a Bia, da mesma unidade, abre o mesmo convite');
select throws_ok($$ select publico_enquete('AAAA-BBBB-CCCC') $$, 'TC404', null, 'AC-03: código que não existe não abre');
select is(pg_temp.campos($$ select publico_responder_enquete(pg_temp.link('+5561999990001'), 4) $$), '["opcao"]'::jsonb,
  'AC-03: só as opções da enquete');

select is((select publico_responder_enquete(pg_temp.link('+5561999990001'), 2) ->> 'escolha'), '2', 'AC-03: a Marta responde Areia');
select is((select publico_responder_enquete(pg_temp.link('+5561955554444'), 1) ->> 'escolha'), '1',
  'AC-03: a resposta pode ser trocada até o prazo (a Bia troca para Cinza)');
select is((select (count(*), max(opcao))::text from respostas_secretas), '(1,1)', 'AC-03: uma resposta por unidade, a última vale');
select ok((select opcao is null and respondeu_em is not null and trocas = 1 from convites_enquete where unidade_id = (select u101 from u)),
  'AC-03: na secreta, o convite guarda só que respondeu');
select ok((select not (publico_enquete(pg_temp.link('+5561999990001')) ? 'resultado')), 'AC-03: o resultado não aparece no link enquanto corre');

create temp table d as select plataforma_enquete(ana, ipe, cor) as v from ids, c, qi;
select is((select v -> 'enquete' -> 'resultado' from d),
  '{"total": 3, "opcoes": [{"votos": 1, "texto": "Cinza"}, {"votos": 0, "texto": "Areia"}, {"votos": 0, "texto": "Branca"}], "responderam": 1}'::jsonb,
  'AC-03: o síndico vê o resultado parcial e quantos faltam');
select is((select jsonb_agg(x ->> 'nome' order by x ->> 'nome') from d, jsonb_array_elements(v -> 'convites') x where x ? 'respondeuEm'),
  '["Torre A · 101"]'::jsonb, 'AC-03: vê quem respondeu');
select ok((select not exists (select 1 from d, jsonb_array_elements(v -> 'convites') x where x ? 'opcao')), 'AC-03: na secreta, não vê o que cada um respondeu');
select is((select x ->> 'semContato' from d, jsonb_array_elements(v -> 'convites') x where x ->> 'nome' = 'Torre A · 201'), 'true',
  'AC-03: aponta a unidade sem contato para receber');

-- O link copiado pelo síndico, para a unidade sem contato.
create temp table lk as select plataforma_link_enquete(ana, ipe, cor, (select id from convites_enquete where unidade_id = u201)) ->> 'codigo' as cod
  from ids, c, qi, u;
select is((select publico_enquete(cod) ->> 'para' from lk), 'Torre A · 201', 'AC-03: o síndico copia um link para mandar por outro meio');

-- E-mail.
select is(pg_temp.emails(), 1, 'AC-03: o convite por e-mail vai para a fila');
select ok((select msg -> 'enquete' ->> 'pergunta' = 'Qual cor para a fachada?' and msg -> 'codigos' ? 'parar'
             and publico_enquete(msg -> 'codigos' ->> 'responder') ->> 'para' = 'Torre A · 101'
             from lotes where msg ->> 'tipo' = 'ENQUETE'), 'AC-03: o e-mail leva a pergunta, o link pessoal e o de parar');

-- Mural, painel.
select is((select jsonb_array_length(publico_mural(mural_codigo) -> 'enquetes') from configuracao_condominio where condominio_id = (select ipe from c)), 1,
  'AC-03: a enquete aberta aparece no mural');
select is((select plataforma_painel(ana, ipe) -> 'vida' -> 'enquetesAbertas' -> 0 ->> 'responderam' from ids, c), '1',
  'AC-03: o início mostra a enquete aberta e quantos responderam');
select ok((select not coalesce(plataforma_painel(fabio, ipe) -> 'vida' ? 'enquetesAbertas', false) from ids, c), 'AC-03: só para quem vê as enquetes');

-- Rui pede PARAR: não recebe o lembrete pelo WhatsApp.
select whatsapp_receber((select segredo from g), 'ipe-inst',
  jsonb_build_object('id', 'M1', 'telefone', '+5561977771212', 'tipo', 'TEXTO', 'texto', 'PARAR', 'enviadaEm', app_now()));

-- O lembrete, dois dias antes, só para quem falta.
select ajustar_relogio(timestamptz '2027-03-06 20:05:00-03' - now());
select verificar_comunicados();
select is((select count(*)::integer from envios_whatsapp where modelo_chave = 'enquete_lembrete'), 0,
  'AC-03: o lembrete não vai para quem respondeu nem para quem pediu PARAR');
select ok((select lembrete_enviado_em is not null from enquetes, qi where id = cor), 'AC-03: o lembrete fica marcado como enviado');
select verificar_comunicados();
select is((select count(*)::integer from historico where acao = 'enquete.lembrete'), 1, 'AC-03: o lembrete vai uma vez só');

-- O prazo passa: fecha sozinha e o sal some.
select publico_responder_enquete((select cod from lk), 3);
select ajustar_relogio(timestamptz '2027-03-08 20:01:00-03' - now());
select verificar_comunicados();
select ok((select encerrada_em = aberta_ate and sal is null from enquetes, qi where id = cor), 'AC-03: no prazo, fecha e apaga o sal');
select is(pg_temp.motivo($$ select publico_responder_enquete(pg_temp.link('+5561999990001'), 3) $$), 'ENQUETE_FECHADA',
  'AC-03: depois do prazo, o link não aceita resposta');
select ok((select x ->> 'aberta' = 'false' and not (x ? 'escolha') and x -> 'resultado' ->> 'responderam' = '2'
             from (select publico_enquete(pg_temp.link('+5561999990001')) as x) y),
  'AC-03: fechada, o link mostra o resultado, e nem a própria unidade vê mais a escolha secreta');

-- O resultado vira comunicado em rascunho.
create temp table pub as select plataforma_publicar_enquete(ana, ipe, cor, pg_temp.ve(cor)) ->> 'comunicadoId' as cm from ids, c, qi;
select is((select estado || ' · ' || titulo from comunicados, pub where id = cm::uuid), 'RASCUNHO · Resultado da enquete: Qual cor para a fachada?',
  'AC-03: publicar o resultado cria um comunicado em rascunho');
select is((select texto from comunicados, pub where id = cm::uuid),
  E'Pergunta: Qual cor para a fachada?\n\nCinza: 1 (50%)\nAreia: 0 (0%)\nBranca: 1 (50%)\n\nResponderam 2 de 3 unidades, com respostas secretas.'
  || E'\n\nA enquete é uma consulta e não tem valor de decisão de assembleia.', 'AC-03: com as contagens e quantos responderam');
select is((select plataforma_publicar_enquete(ana, ipe, cor, pg_temp.ve(cor)) ->> 'comunicadoId' from ids, c, qi), (select cm from pub),
  'AC-03: publicar de novo abre o mesmo comunicado');

-- A enquete aberta, por pessoa, encerrada antes do prazo.
create temp table q2 as select (pg_temp.criar('{"pergunta": "Pode ter festa junina no salão?", "opcoes": ["Sim", "Não"], "por": "PESSOA",
  "secreta": false, "abertaAte": "2027-03-20T12:00:00-03:00", "canais": ["WHATSAPP"]}') ->> 'id')::uuid as junina;
select is((select count(*)::integer from convites_enquete, q2 where enquete_id = junina), 3, 'AC-03: por pessoa, um convite por pessoa confirmada');
select is((select lembrete_em from enquetes, q2 where id = junina), timestamptz '2027-03-18 12:00:00-03', 'AC-03: o lembrete fica para dois dias antes');
select is((select count(*)::integer from envios_whatsapp w, convites_enquete ce, q2 where ce.id = w.convite_enquete_id and ce.enquete_id = junina), 2,
  'AC-03: quem pediu PARAR não recebe o convite');
select pg_temp.whats();
select publico_responder_enquete(pg_temp.link('+5561955554444'), 2);
select is((select x ->> 'opcao' from ids, c, q2, jsonb_array_elements(plataforma_enquete(ana, ipe, junina) -> 'convites') x where x ->> 'nome' = 'Bia Souza'),
  '2', 'AC-03: na enquete aberta, o síndico vê o que cada pessoa respondeu');
select is(pg_temp.motivo($$ select plataforma_publicar_enquete(ana, ipe, junina, pg_temp.ve(junina)) from ids, c, q2 $$), 'ENQUETE_ABERTA',
  'AC-03: o resultado só se publica depois de fechar');
select throws_ok($$ select plataforma_encerrar_enquete(ana, ipe, junina, 99) from ids, c, q2 $$, 'TC409', null, 'AC-03: encerrar confere a versão');
select plataforma_encerrar_enquete(ana, ipe, junina, pg_temp.ve(junina)) from ids, c, q2;
select is((select encerrada_por from enquetes, q2 where id = junina), (select ana from ids), 'AC-03: o síndico encerra antes do prazo');
select is(pg_temp.motivo($$ select plataforma_encerrar_enquete(ana, ipe, junina, pg_temp.ve(junina)) from ids, c, q2 $$), 'ENQUETE_FECHADA',
  'AC-03: encerrada não encerra de novo');

-- O convite que ficou na fila de uma enquete que já fechou não sai.
create temp table q3 as select (pg_temp.criar('{"pergunta": "Mudamos a coleta para as 19h?", "opcoes": ["Sim", "Não"], "por": "UNIDADE",
  "secreta": false, "abertaAte": "2027-03-08T23:00:00-03:00", "canais": ["WHATSAPP"]}') ->> 'id')::uuid as coleta;
select ajustar_relogio(timestamptz '2027-03-08 23:30:00-03' - now());
select limpar_contexto(); -- como a api-plataforma, sem condomínio na sessão
select is(pg_temp.whats(), 0, 'AC-03: com a enquete fechada, o convite parado na fila não sai');
select is((select string_agg(distinct estado || ': ' || motivo, ', ') from envios_whatsapp w, convites_enquete ce, q3
            where ce.id = w.convite_enquete_id and ce.enquete_id = coleta), 'CANCELADA: A enquete fechou', 'AC-03: e fica cancelado com o motivo');

select * from finish();
rollback;

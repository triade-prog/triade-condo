-- Comunicado pelo WhatsApp do condomínio (F6.6; CD-02, W-20, W-16, CD-11, CD-08, CD-01). Só
-- recebe quem aceitou, do próprio celular; vão o título e o link pessoal pelo modelo
-- comunicado_publicado, uma mensagem por telefone, 10 por minuto, fora do horário sem envio. O
-- relógio começa numa quarta-feira, 03/03/2027, às 10:00.
begin;
select plan(66);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Edu') as edu;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
update condominios set numero_whatsapp = '+556198124400' where id = (select ipe from c);
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Portaria', array['ATUALIZAR']) as v_edu
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_ana from c, vs;
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');
create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.avancar(p interval) returns void language sql as $$ select ajustar_relogio(app_now() + p - now()) $$;
select pg_temp.em('2027-03-03 10:00:00-03');

-- Torre A: Marta no 101; Jorge no 102 e Rita no 103 com o mesmo celular; Paulo e Clara no 104.
select plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) from ids, c;
select plataforma_incluir_unidades(ana, ipe, (select id from blocos where nome = 'Torre A'),
  '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}, {"identificacao": "104"}]') from ids, c;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101, (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103, (select id from unidades where identificacao = '104') as u104;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Jorge Lima', '+5561999990002', '{"proprietario": true, "principal": true, "mora": true}', true) as jorge,
  plataforma_incluir_pessoa_unidade(ana, ipe, u103, null, 'Rita Lima', '+5561999990002', '{"proprietario": true, "principal": true, "mora": true}', true) as rita,
  plataforma_incluir_pessoa_unidade(ana, ipe, u104, null, 'Paulo Reis', '+5561999990004', '{"proprietario": true, "principal": true, "mora": true}', true) as paulo,
  plataforma_incluir_pessoa_unidade(ana, ipe, u104, null, 'Clara Reis', '+5561999990005', '{"proprietario": false, "principal": false, "mora": true, "ligacao": "FAMILIAR", "parentesco": "CONJUGE"}', true) as clara
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (jorge ->> 'vinculoId')::uuid) as c_jorge,
  (select contato_id from contatos_unidade where id = (rita ->> 'vinculoId')::uuid) as c_rita,
  (select contato_id from contatos_unidade where id = (paulo ->> 'vinculoId')::uuid) as c_paulo,
  (select contato_id from contatos_unidade where id = (clara ->> 'vinculoId')::uuid) as c_clara
  from vin;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.config() returns jsonb language sql as $$ select plataforma_comunicados_whatsapp(ana, ipe) from ids, c $$;
create function pg_temp.ligar(p boolean) returns jsonb language sql as $$
  select plataforma_definir_comunicados_whatsapp(ana, ipe, pg_temp.vcfg(), p) from ids, c $$;
create temp table seq (n integer);
insert into seq values (0);
create function pg_temp.msg(p_tel text, p_texto text) returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_build_object('id', 'M' || v_n, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', p_texto, 'enviadaEm', app_now()));
end $$;
-- As respostas ainda não vistas para um telefone, juntas por " | ".
create temp table vistos (id uuid primary key);
create function pg_temp.ultima(p_tel text) returns text language plpgsql as $$
declare v text;
begin
  select string_agg(texto, ' | ' order by enviar_apos, criado_em) into v from envios_whatsapp e
   where para = p_tel and finalidade = 'RESPOSTA' and not exists (select 1 from vistos where id = e.id);
  insert into vistos select id from envios_whatsapp e where para = p_tel on conflict do nothing;
  return v;
end $$;
create function pg_temp.sit(p uuid) returns text language sql as $$
  select coalesce(comunicados_whatsapp, '-') || '/' || coalesce(comunicados_whatsapp_origem, '-') from contatos where id = p $$;
create function pg_temp.publicar(p_titulo text, p_whatsapp boolean default true) returns uuid language sql as $$
  select (plataforma_salvar_comunicado(ana, ipe, null, null, 'AVISO', p_titulo, 'O fornecimento volta às 13h. Deixe as torneiras fechadas.',
                                       'TODOS', null, null, null, null, null, 'PUBLICAR', null, null, null, p_whatsapp) ->> 'id')::uuid
    from ids, c $$;
create function pg_temp.fila(p uuid) returns bigint language sql as $$
  select count(*) from envios_whatsapp where comunicado_id = p and estado = 'NA_FILA' $$;
create temp table lotes (n serial, l jsonb);
create function pg_temp.lote() returns jsonb language sql as $$
  insert into lotes (l) select whatsapp_pegar_lote(20) returning l $$;
create function pg_temp.saiu(p_n integer) returns jsonb language sql as $$
  select coalesce(jsonb_agg(x), '[]') from lotes, jsonb_array_elements(l -> 0 -> 'envios') x where n = p_n and x ->> 'rota' = 'c' $$;

-- O modelo (decisão 3).
select is((select situacao || ' · ' || length(rodape) from modelos_whatsapp where chave = 'comunicado_publicado'), 'APROVADO_PILOTO · 54',
  'W-20: o modelo do comunicado, aprovado no piloto, com rodapé dentro dos 60 caracteres da Meta');
select is((select renderizar_modelo(m, '["Residencial Ipê", "Falta de água", "[link]"]') from modelos_whatsapp m where chave = 'comunicado_publicado'),
  E'Comunicado do Residencial Ipê: Falta de água\n\nLeia o comunicado inteiro no link, que é só seu:\n[link]\n\nNina, assistente virtual do Residencial Ipê.\n\nPara parar os comunicados, responda PARAR COMUNICADOS.',
  'W-20: título e link pessoal, com o jeito de parar em toda mensagem');

-- Ligar no condomínio (decisão 9).
select is((select pg_temp.config() ->> 'ligado'), 'false', 'CF-11: cada condomínio começa com os comunicados pelo WhatsApp desligados');
select is(pg_temp.motivo($$ select pg_temp.ligar(true) $$), 'WHATSAPP_DESCONECTADO', 'W-20: sem número conectado, não liga');
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;
select is(pg_temp.codigo($$ select plataforma_definir_comunicados_whatsapp(edu, ipe, pg_temp.vcfg(), true) from ids, c $$), 'TC401',
  'CF-11: só quem muda as configurações liga');

-- Com tudo desligado, a Nina não pergunta.
select pg_temp.msg('+5561999990004', 'Oi');
select pg_temp.msg('+5561999990004', '3');
select is(pg_temp.ultima('+5561999990004'), 'Olá, Paulo. Sou a Nina, assistente virtual do Residencial Ipê.
Responda com o número:
1 · Registrar um pedido novo
2 · Ver meus pedidos
3 · É só um recado | Anotei o recado. Quem cuida do condomínio vai ler.', 'W-20: desligado, a Nina não pergunta');

select pg_temp.ligar(true);
select is((select (pg_temp.config() - 'versao' - 'mudadoEm' - 'contagens' - 'silencio') ), jsonb_build_object(
  'ligado', true, 'mudadoPor', 'Síndica Ana', 'conectado', true, 'numero', '556198124400', 'porMinuto', 10,
  'convite', 'Quer receber os comunicados do Residencial Ipê no WhatsApp? Toque no link e envie a mensagem que aparece: https://wa.me/556198124400?text=COMUNICADOS',
  'pode', jsonb_build_object('editar', true)), 'CD-11: ligado, com o convite pronto para o grupo do prédio');
select is((select count(*) from historico where acao = 'whatsapp.comunicados_ligados'), 1::bigint, 'CF-11: ligar fica no histórico');

-- O aceite pela pergunta da Nina, uma vez, depois de um atendimento (decisão 6).
select pg_temp.msg('+5561999990001', 'Oi, boa tarde');
select is(pg_temp.ultima('+5561999990001'), 'Olá, Marta. Sou a Nina, assistente virtual do Residencial Ipê.
Responda com o número:
1 · Registrar um pedido novo
2 · Ver meus pedidos
3 · É só um recado', 'W-22: no meio do atendimento, nada de pergunta');
select pg_temp.msg('+5561999990001', '3');
select is(pg_temp.ultima('+5561999990001'), 'Anotei o recado. Quem cuida do condomínio vai ler. | Mais uma coisa, Marta: quer receber os comunicados do condomínio também por aqui? São avisos como falta de água, obras e assembleias, com um link para ler.

Responda SIM ou NÃO. Dá para mudar quando quiser.', 'W-20: terminado o recado, a Nina pergunta, depois da resposta');
select is((select enviar_apos - app_now() from envios_whatsapp where para = '+5561999990001' and texto like 'Mais uma coisa%'), interval '5 seconds',
  'W-22: a pergunta sai depois da resposta do atendimento');
select pg_temp.msg('+5561999990001', 'Sim!');
select is(pg_temp.sit(c_marta), 'ACEITOU/PERGUNTA', 'W-20: SIM liga, do próprio celular') from ct;
select is(pg_temp.ultima('+5561999990001'), 'Pronto, Marta: você vai receber os comunicados do Residencial Ipê por aqui. Para parar, mande PARAR COMUNICADOS.',
  'W-16: a confirmação diz como parar');
select pg_temp.msg('+5561999990001', 'Oi');
select pg_temp.msg('+5561999990001', '3');
select ok(pg_temp.ultima('+5561999990001') !~ 'Mais uma coisa', 'W-20: quem já respondeu não é perguntado de novo');

-- Paulo diz não; Jorge manda COMUNICADOS e vale para a Rita, do mesmo celular (decisões 6 e 8).
select pg_temp.msg('+5561999990004', 'Oi');
select pg_temp.msg('+5561999990004', '2');
select ok(pg_temp.ultima('+5561999990004') ~ 'Mais uma coisa, Paulo', 'W-20: a consulta também termina um atendimento');
select pg_temp.msg('+5561999990004', 'não');
select is(pg_temp.sit(c_paulo), 'RECUSOU/PERGUNTA', 'W-20: NÃO fica anotado') from ct;
select is(pg_temp.ultima('+5561999990004'), 'Tudo bem: você não vai receber os comunicados por aqui. Se mudar de ideia, mande COMUNICADOS.',
  'W-20: e a Nina não insiste');
select pg_temp.msg('+5561999990004', 'sim');
select is(pg_temp.sit(c_paulo), 'RECUSOU/PERGUNTA', 'W-20: SIM sem pergunta esperando não liga nada') from ct;
select pg_temp.msg('+5561999990002', 'comunicados');
select pg_temp.ultima('+5561999990002');
select is((select pg_temp.sit(c_jorge) || ' ' || pg_temp.sit(c_rita) from ct), 'ACEITOU/COMANDO ACEITOU/COMANDO',
  'MU-02: o aceite é do número: vale para os dois contatos do mesmo celular');
select pg_temp.msg('+5561988887777', 'COMUNICADOS');
select is((select triagem from mensagens_whatsapp where telefone = '+5561988887777'), 'A_IDENTIFICAR',
  'MU-02: número fora do cadastro recebe a resposta neutra e nada é ligado');
select is((select pg_temp.config() -> 'contagens'), '{"aceitaram": 2, "recusaram": 1, "pararam": 0, "semResposta": 1}'::jsonb,
  'CD-11: o cartão conta por telefone quem aceitou, disse não, parou e ainda não respondeu');

-- Escrever: quantos recebem por onde (decisão 10).
create temp table pub as select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'TODOS', null, null, null) as r from ids, c;
select is((select (r ->> 'contatos') || ' ' || (r ->> 'comWhatsapp') || ' ' || (r ->> 'pelosDois') from pub), '5 3 0',
  'CD-02: o público diz quantos recebem pelo WhatsApp e pelos dois');
select is((select jsonb_path_query_array(r, '$.quem[*] ? (@.whatsapp == true).nome') from pub), '["Jorge Lima", "Marta Souza", "Rita Lima"]'::jsonb,
  'CD-02: e quem são');
select is((select plataforma_comunicado_opcoes(ana, ipe) -> 'canais' ->> 'whatsappLigado' from ids, c), 'true', 'CD-02: a opção aparece ao escrever');

-- Publicar: um envio por telefone, 10 por minuto (decisões 1, 5 e 10).
create temp table k1 as select pg_temp.publicar('Falta de água na Torre A na quinta, das 9h às 13h') as id;
select is((select count(*) from envios_whatsapp where comunicado_id = (select id from k1)), 2::bigint,
  'CD-02: Marta e o celular do Jorge e da Rita: duas mensagens');
select is((select array_agg(enviar_apos - app_now() order by enviar_apos) from envios_whatsapp where comunicado_id = (select id from k1)),
  array[interval '0', interval '6 seconds'], 'W-14: uma a cada 6 segundos (10 por minuto)');
select is((select dados ->> 'quantos' from historico where acao = 'comunicado.whatsapp_na_fila'), '2', 'CD-02: a fila fica no histórico do comunicado');
select is((select count(*) from envios_whatsapp where finalidade = 'COMUNICADO' and texto ~ 'O fornecimento volta'), 0::bigint,
  'W-20: o texto do comunicado não vai na mensagem');

-- A primeira sai; o link nasce na hora (decisão 3).
select pg_temp.lote();
select is((select jsonb_array_length(pg_temp.saiu(1))), 1, 'W-14: só a que já pode sair');
select is((select x ->> 'texto' from jsonb_array_elements(pg_temp.saiu(1)) x),
  E'Comunicado do Residencial Ipê: Falta de água na Torre A na quinta, das 9h às 13h\n\nLeia o comunicado inteiro no link, que é só seu:\n[link]\n\nNina, assistente virtual do Residencial Ipê.\n\nPara parar os comunicados, responda PARAR COMUNICADOS.',
  'W-20: sai o texto do modelo, mesmo com a conversa aberta');
select is((select (x ->> 'rota') || ' ' || (x ->> 'para') from jsonb_array_elements(pg_temp.saiu(1)) x), 'c +5561999990001',
  'CD-04: o link pessoal do comunicado (/c), para a Marta');
create temp table l1 as select (select x ->> 'link' from jsonb_array_elements(pg_temp.saiu(1)) x) as codigo,
  (select (x ->> 'envio')::uuid from jsonb_array_elements(pg_temp.saiu(1)) x) as envio;
select is((select tipo || ' ' || (contato_id = (select c_marta from ct)) || ' ' || (expira_em - app_now()) from links_publicos where envio_id = (select envio from l1)),
  'COMUNICADO true 90 days', 'CD-04: o link é da Marta, vale 90 dias e nasce só no envio');
select is((select publico_comunicado(codigo) -> 'comunicado' ->> 'titulo' from l1), 'Falta de água na Torre A na quinta, das 9h às 13h',
  'CD-04: o link abre o comunicado');
select ok((select link_aberto_em is not null from envios_whatsapp where id = (select envio from l1)), 'CD-08: e conta quem abriu');
select ok(not (select publico_comunicado(codigo) ? 'comunicadosWhatsapp' from l1), 'CD-12: quem já recebe não vê o botão');
select whatsapp_resultado(ipe, envio, 'K1', null, null) from c, l1;
select whatsapp_evento((select segredo from g), 'ipe-inst', 'LIDA', 'K1', null);

-- Um minuto depois sai a segunda; o número não tem WhatsApp: sem sino e sem reenvio (decisão 12).
select pg_temp.avancar(interval '1 minute');
select pg_temp.lote();
create temp table l2 as select (select (x ->> 'envio')::uuid from jsonb_array_elements(pg_temp.saiu(2)) x) as envio;
select is((select para from envios_whatsapp where id = (select envio from l2)), '+5561999990002', 'W-14: no minuto seguinte, a do Jorge e da Rita');
select whatsapp_resultado(ipe, envio, null, 'Número sem WhatsApp', 'PERMANENTE') from c, l2;
select is((select count(*) from avisos_whatsapp where tipo = 'FALHA_ENVIO'), 0::bigint, 'W-14: falha de comunicado não toca o sino');
select is(pg_temp.motivo($$ select plataforma_reenviar_whatsapp(ana, ipe, envio, 'Tentar de novo') from ids, c, l2 $$), 'COMUNICADO_SEM_REENVIO',
  'W-14: e não tem reenvio');
create temp table d1 as select plataforma_comunicado(ana, ipe, id) as r from ids, c, k1;
select is((select r -> 'whatsapp' from d1), '{"total": 2, "naFila": 0, "enviadas": 1, "entregues": 1, "lidas": 1, "falharam": 1, "canceladas": 0, "abertos": 1}'::jsonb,
  'CD-08: como chegou: enviadas, entregues, lidas, falhas e links abertos');
select is((select jsonb_path_query_array(r, '$.problemas[*] ? (@.canal == "WHATSAPP")') -> 0 ->> 'motivo' from d1), 'Número sem WhatsApp',
  'CD-08: a mensagem que não chegou fica no comunicado');
select is((select r -> 'pode' ->> 'avisarWhatsapp' from d1), 'true', 'CD-01: dá para avisar de novo ao corrigir');

-- PARAR COMUNICADOS para só os comunicados (decisão 7).
select pg_temp.msg('+5561999990002', 'Parar comunicados');
select is((select pg_temp.sit(c_jorge) || ' ' || pg_temp.sit(c_rita) from ct), 'PAROU/COMANDO PAROU/COMANDO', 'W-16: PARAR COMUNICADOS desliga os comunicados');
select is(pg_temp.ultima('+5561999990002'), 'Pronto: você não recebe mais os comunicados do Residencial Ipê por aqui. As respostas aos seus pedidos continuam. Para voltar, mande COMUNICADOS.',
  'W-16: e diz o que continua');
select is((select whatsapp_parou_em from contatos where id = (select c_jorge from ct)), null, 'W-16: os outros avisos continuam');

-- Corrigir avisando de novo: só quem recebeu, com "Corrigido:" (decisão 13).
create temp table k2 as select (plataforma_corrigir_comunicado(ana, ipe, id, (select versao from comunicados where id = k1.id), 'Falta de água na Torre A na quinta, das 10h às 14h',
  'O fornecimento volta às 14h. Deixe as torneiras fechadas.', 'A empresa mudou o horário.', false, true) ->> 'id')::uuid as id from ids, c, k1;
select is((select array_agg(para) from envios_whatsapp where comunicado_id = (select id from k2)), array['+5561999990001'],
  'CD-01: avisa de novo só quem recebeu a versão anterior');
select pg_temp.avancar(interval '1 minute');
select pg_temp.lote();
select ok((select x ->> 'texto' from jsonb_array_elements(pg_temp.saiu(3)) x) ~ '^Comunicado do Residencial Ipê: Corrigido: Falta de água na Torre A na quinta, das 10h às 14h',
  'CD-01: a mensagem começa com Corrigido');

-- Corrigido antes de sair, vai o título em uso; arquivado, cancela (decisão 11).
update contatos set comunicados_whatsapp = 'ACEITOU', comunicados_whatsapp_em = app_now(), comunicados_whatsapp_origem = 'COMANDO'
 where id = (select c_paulo from ct);
create temp table k3 as select pg_temp.publicar('Pintura da fachada') as id;
create temp table k4 as select (plataforma_corrigir_comunicado(ana, ipe, id, (select versao from comunicados where id = k3.id), 'Pintura da fachada começa segunda',
  'Começa segunda, às 8h.', 'A data mudou.') ->> 'id')::uuid as id from ids, c, k3;
select pg_temp.avancar(interval '1 minute');
select pg_temp.lote();
select is((select (x ->> 'texto') ~ 'Comunicado do Residencial Ipê: Pintura da fachada começa segunda\n' from jsonb_array_elements(pg_temp.saiu(4)) x where x ->> 'para' = '+5561999990001'),
  true, 'CD-01: corrigido antes de sair, vai o título da versão em uso, sem "Corrigido"');
create temp table k5 as select pg_temp.publicar('Reunião do conselho') as id;
select plataforma_arquivar_comunicado(ana, ipe, x.id, x.versao, 'Publicado por engano') from ids, c, k5 join comunicados x on x.id = k5.id;
select is((select string_agg(distinct estado || ': ' || motivo, ', ') from envios_whatsapp where comunicado_id = (select id from k5)),
  'CANCELADA: O comunicado foi arquivado', 'CD-01: arquivar cancela o que está na fila');

-- Só quem recebe na hora do envio; PARAR barra e VOLTAR mantém a escolha (decisões 7 e 10).
create temp table k6 as select pg_temp.publicar('Coleta de recicláveis') as id;
select pg_temp.msg('+5561999990004', 'PARAR');
select pg_temp.avancar(interval '1 minute');
select pg_temp.lote();
select is((select estado || ': ' || motivo from envios_whatsapp where comunicado_id = (select id from k6) and para = '+5561999990004'),
  'CANCELADA: A pessoa não recebe mais comunicados por aqui', 'W-16: quem mandou PARAR depois de publicar não recebe');
select pg_temp.msg('+5561999990004', 'VOLTAR');
select is(pg_temp.sit(c_paulo), 'ACEITOU/COMANDO', 'W-16: VOLTAR mantém a escolha dos comunicados') from ct;

-- O horário sem envio vale para o WhatsApp (decisão 4).
select pg_temp.em('2027-03-03 22:00:00-03');
create temp table k7 as select pg_temp.publicar('Portão da garagem em manutenção') as id;
select is((select min(enviar_apos) from envios_whatsapp where comunicado_id = (select id from k7)), timestamptz '2027-03-04 08:00:00-03',
  'CD-11: publicado às 22h, o WhatsApp espera as 08:00');
select is((select r -> 'whatsapp' ->> 'saiAte' from (select plataforma_comunicado(ana, ipe, id) as r from ids, c, k7) x),
  to_jsonb(timestamptz '2027-03-04 08:00:06-03') #>> '{}', 'CD-08: a tela diz até quando sai');

-- Desligar cancela a fila; os aceites ficam (decisão 9).
select pg_temp.ligar(false);
select is((select string_agg(distinct estado || ': ' || motivo, ', ') from envios_whatsapp where comunicado_id = (select id from k7)),
  'CANCELADA: Os comunicados pelo WhatsApp foram desligados', 'CF-11: desligar cancela o que está na fila');
select is(pg_temp.sit(c_marta), 'ACEITOU/PERGUNTA', 'CF-11: os aceites ficam guardados') from ct;
create temp table k8 as select pg_temp.publicar('Limpeza da caixa d''água') as id;
select is(pg_temp.fila((select id from k8)), 0::bigint, 'CF-11: desligado, nada entra na fila');
select pg_temp.msg('+5561999990005', 'COMUNICADOS');
select is(pg_temp.ultima('+5561999990005'), 'Anotei, Clara: quando o Residencial Ipê começar a mandar os comunicados por aqui, você recebe. Para parar, mande PARAR COMUNICADOS.',
  'W-20: desligado, COMUNICADOS fica anotado para quando ligar');
select pg_temp.ligar(true);

-- A fila espera até 24 horas com o número desconectado (decisão 11).
select pg_temp.em('2027-03-04 09:00:00-03');
select console_whatsapp_situacao(impl, ipe, 'DESCONECTADO', null, null) from ids, c;
create temp table k9 as select pg_temp.publicar('Dedetização na sexta') as id;
select pg_temp.avancar(interval '25 hours');
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;
select pg_temp.lote();
select is((select string_agg(distinct estado || ': ' || motivo, ', ') from envios_whatsapp where comunicado_id = (select id from k9)),
  'CANCELADA: Passou de 24 horas sem sair', 'W-14: depois de 24 horas sem sair, cancela');
select is((select jsonb_array_length(plataforma_comunicado(ana, ipe, id) -> 'problemas') from ids, c, k9), 3,
  'CD-08: e aparece no comunicado, entre as que não chegaram');

-- O aceite é do número (decisão 8).
update contatos set telefone = '+5561999990009' where id = (select c_marta from ct);
select is((select coalesce(comunicados_whatsapp, '-') || ' ' || coalesce(comunicados_whatsapp_perguntado_em::text, '-') from contatos where id = (select c_marta from ct)),
  '- -', 'MU-02: trocou o telefone, o aceite e a pergunta não passam para o número novo');

-- Cadastro, registro do pedido, mural e link (6 · No cadastro).
select is((select jsonb_agg(x ->> 'comunicadosWhatsapp' order by x ->> 'nome') from ids, c, u, jsonb_array_elements(plataforma_unidade(ana, ipe, u104) -> 'contatos') x),
  '["ACEITOU", "ACEITOU"]'::jsonb, 'MU-01: a ficha da unidade mostra a situação de cada contato');
select is((select x ->> 'comunicadosWhatsappOrigem' from ids, c, u, jsonb_array_elements(plataforma_unidade(ana, ipe, u101) -> 'contatos') x), null,
  'MU-01: sem aceite, sem origem');
select is((select plataforma_moradores(ana, ipe, null, 'SEM_WHATSAPP', 1) ->> 'total' from ids, c), '3',
  'MU-01: o filtro "sem WhatsApp para comunicados"');
select is((select plataforma_quem_avisar(ana, ipe, '{}') -> 'moradores' ->> 'whatsapp' from ids, c), 'true',
  'AT-26: no registro, a linha dos moradores conta o WhatsApp');
select is((select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO'], false, null, true, true) ? 'codigo' from ids, c), true,
  'CD-12: o mural ligado');
select is((select publico_mural(mural_codigo) ->> 'comunicadosWhatsapp' from configuracao_condominio where condominio_id = (select ipe from c)),
  '556198124400', 'CD-12: o mural mostra o botão Receber pelo WhatsApp');
select is((select count(*) from historico where acao = 'contato.comunicados_whatsapp'), 7::bigint,
  'W-20: cada escolha fica no histórico do contato');

select * from finish();
rollback;

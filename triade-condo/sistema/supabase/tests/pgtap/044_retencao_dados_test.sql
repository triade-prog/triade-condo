-- Inventário de dados, retenção e exclusão (F0.11; PT-11, PT-03, EM-08). O catálogo tem os 32
-- tipos; a rotina nasce contando e só apaga depois que a Administração liga; apaga o dado e
-- mantém a linha; o que está guardado por obrigação legal fica; o síndico acha, baixa e remove
-- os dados de uma pessoa, com as travas; nada some em silêncio (o histórico conta, sem dado
-- pessoal). O relógio começa em 10/01/2026 e pula para 24/10/2026.
begin;
select plan(74);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndico Davi') as davi,
  teste.pessoa('Zé Zelador') as ze,
  teste.pessoa('Síndica Bia') as bia;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Águas Claras', 'Brasília', 'DF', null) as agua,
  console_criar_condominio(adm, 'Edifício Pequi', 'Brasília', 'DF', null) as pequi from ids;
create temp table vs as select
  teste.vincular(davi, agua) as v_davi,
  plataforma_autorizar_pessoa(davi, agua, ze, 'Zé Zelador', 'Zeladoria', array['CADASTRAR']) as v_ze,
  teste.vincular(bia, pequi) as v_bia
  from ids, c;
create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
select pg_temp.em('2026-01-10 10:00:00-03');

select plataforma_salvar_bloco(davi, agua, null, null, 'Torre A', 1, true) from ids, c;
select plataforma_incluir_unidades(davi, agua, (select id from blocos where nome = 'Torre A' and condominio_id = (select agua from c)),
  '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}, {"identificacao": "104"}]') from ids, c;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101, (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103, (select id from unidades where identificacao = '104') as u104;
-- Marina sai do 101; Pedro fica no 102; Caio sai do 103 com pedido aberto; Lia sai do 104 e é guardada.
create temp table vin as select
  plataforma_incluir_pessoa_unidade(davi, agua, u101, null, 'Marina Lopes', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marina,
  plataforma_incluir_pessoa_unidade(davi, agua, u102, null, 'Pedro Souza', '+5561999990002', '{"proprietario": true, "principal": true, "mora": true}', true) as pedro,
  plataforma_incluir_pessoa_unidade(davi, agua, u103, null, 'Caio Nunes', '+5561999990003', '{"proprietario": true, "principal": true, "mora": true}', true) as caio,
  plataforma_incluir_pessoa_unidade(davi, agua, u104, null, 'Lia Prado', '+5561999990004', '{"proprietario": true, "principal": true, "mora": true}', true) as lia
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marina ->> 'vinculoId')::uuid) as c_marina,
  (select contato_id from contatos_unidade where id = (pedro ->> 'vinculoId')::uuid) as c_pedro,
  (select contato_id from contatos_unidade where id = (caio ->> 'vinculoId')::uuid) as c_caio,
  (select contato_id from contatos_unidade where id = (lia ->> 'vinculoId')::uuid) as c_lia
  from vin;
update contatos set email = 'pedro@exemplo.com.br', email_situacao = 'CONFIRMADO' where id = (select c_pedro from ct);
select plataforma_registrar_pedido(davi, agua, u103, c_caio, null,
  (select id from categorias where condominio_id = agua and modelo = 'MANUTENCAO'), (select id from prioridades where condominio_id = agua and modelo = 'NORMAL'),
  'Torneira pingando', 'A torneira da área de serviço pinga.', 'TELEFONE', false, null)
  from ids, c, u, ct;
select plataforma_encerrar_vinculo_unidade(davi, agua, cu.id, cu.versao, 'MUDANCA', null)
  from ids, c, contatos_unidade cu where cu.contato_id in (select c_marina from ct union all select c_caio from ct union all select c_lia from ct);

-- O que sobra de quem saiu, guardado direto nas tabelas.
insert into familiares_unidade (condominio_id, unidade_id, nome, parentesco, aniversario_dia, aniversario_mes, saiu_em, saiu_por, criado_por)
select agua, u101, 'Tito Lopes', 'FILHO', 3, 4, app_now(), davi, davi from c, u, ids;
insert into familiares_unidade (condominio_id, unidade_id, nome, parentesco, criado_por)
select agua, u102, 'Rosa Souza', 'CONJUGE', davi from c, u, ids;
insert into pets_unidade (condominio_id, unidade_id, nome, especie, raca, saiu_em, saiu_por, criado_por)
select agua, u101, 'Bolinha', 'CAO', 'Vira-lata', app_now(), davi, davi from c, u, ids;
insert into veiculos (condominio_id, unidade_id, placa, tipo, modelo, retirado_em, retirado_por, motivo_retirada, criado_por)
select agua, u101, 'ABC1D23', 'CARRO', 'Gol prata', app_now(), davi, 'SAIU', davi from c, u, ids;
insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, contato_id, tipo, texto, enviada_em, triagem)
select agua, 'M1', '+5561999990001', c_marina, 'TEXTO', 'Bom dia, alguém achou uma chave?', app_now(), 'A_IDENTIFICAR' from c, ct;
insert into conversas_whatsapp (condominio_id, telefone, etapa) select agua, '+5561977770000', 'MENU' from c;
insert into exportacoes (condominio_id, situacao, pedida_por, pronta_em, expira_em)
select agua, 'PRONTA', davi, app_now(), app_now() + interval '7 days' from c, ids;
insert into partes_exportacao (condominio_id, exportacao_id, numero, tipo, situacao, caminho, tamanho, pronta_em)
select agua, id, 1, 'DADOS', 'PRONTA', agua || '/' || id || '/dados.zip', 1000, app_now() from exportacoes, c where condominio_id = agua;

-- O catálogo (regra 1).
select is((select count(*)::integer from retencao_tipos), 38, 'PT-11: o catálogo tem os 38 tipos de dado do inventário (32 da F0.11, 2 da R5, 2 da R17.4 e 2 da R17.6)');
select is((select string_agg(sistema || ':' || n, ', ' order by sistema) from (select sistema, count(*) n from retencao_tipos group by sistema) x),
  'CONSOLE:8, PLATAFORMA:30', 'PT-11: 30 tipos na Plataforma e 8 no Console');
select is((select array_agg(numero order by numero) from retencao_tipos), (select array_agg(n) from generate_series(1, 38) n),
  'PT-11: numerados de 1 a 38, sem buraco');
select is((select count(*)::integer from retencao_tipos where situacao = 'NA_ROTINA'), 18, 'PT-11: 18 tipos já com a rotina aplicando o prazo (o conselho entrou na 0305)');
select is((select count(*)::integer from retencao_tipos t
            where t.situacao = 'NA_ROTINA' and t.codigo <> 'TRANSCRICAO'
              and position('''' || t.codigo || '''' in pg_get_functiondef('retencao_candidatos'::regproc)) = 0), 0,
  'PT-11: todo tipo NA_ROTINA tem regra na rotina (a transcrição segue a mensagem)');
select throws_ok($$ delete from retencao_tipos where codigo = 'CONTATO' $$, 'TC010', null, 'O catálogo não perde tipo por exclusão');

-- O modo nasce contando (regra 3).
select is((select modo from retencao_estado), 'CONTANDO', 'A rotina nasce só contando');
select is(retencao_ativa(), false, 'Fora da rotina, as travas de cada tabela valem');
select throws_ok($$ update familiares_unidade set nome = null, dados_apagados_em = app_now() where nome = 'Tito Lopes' $$,
  'TC422', null, 'Regra 7: fora da rotina, a família que saiu não muda');

-- 24/10/2026: 287 dias depois.
select pg_temp.em('2026-10-24 14:00:00-03');
insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, contato_id, tipo, texto, enviada_em, triagem)
select agua, 'M2', '+5561999990002', c_pedro, 'TEXTO', 'Obrigado!', app_now(), 'A_IDENTIFICAR' from c, ct;

-- Privacidade e dados (quadro 350).
create temp table p1 as select plataforma_privacidade(davi, agua) as r from ids, c;
select is((select r ->> 'modo' from p1), 'CONTANDO', 'A tela mostra o modo');
select is((select (r ->> 'vencidos')::integer from p1), 8,
  'Passaram do prazo: Marina, Lia, família, pet, veículo, mensagem, conversa e exportação (Caio tem pedido aberto)');
select is((select jsonb_array_length(r -> 'tipos') from p1), 30, 'O síndico vê só os tipos da Plataforma');
select is((select (r ->> 'podeCuidar')::boolean from p1), true, 'O síndico pode cuidar');
select is(pg_temp.codigo($$ select plataforma_privacidade(ze, agua) from ids, c $$), 'TC401', 'Quem não tem privacidade.ver não abre');

-- Guardar por obrigação legal (quadro 355).
select is(pg_temp.codigo($$ select plataforma_guardar(davi, agua, 'CONTATO', c_lia, 'OUTRO', null) from ids, c, ct $$), 'TC422',
  'Motivo OUTRO pede detalhe');
create temp table g as select plataforma_guardar(davi, agua, 'CONTATO', c_lia, 'PROCESSO', 'Ação de cobrança 0001234-56') as r from ids, c, ct;
select is((select r ->> 'titulo' from g), 'Lia Prado', 'A guarda mostra quem foi guardado');
select is(pg_temp.motivo($$ select plataforma_guardar(davi, agua, 'CONTATO', c_lia, 'PROCESSO', null) from ids, c, ct $$), 'JA_GUARDADO',
  'Não guarda duas vezes');
select is(pg_temp.codigo($$ select plataforma_guardar(bia, pequi, 'CONTATO', c_lia, 'PROCESSO', null) from ids, c, ct $$), 'TC404',
  'Outro condomínio não acha a pessoa');
select is((select jsonb_array_length(plataforma_privacidade(bia, pequi) -> 'guardados') from ids, c), 0, 'Outro condomínio não vê a guarda');
select is((select (plataforma_privacidade(davi, agua) ->> 'vencidos')::integer from ids, c), 7, 'Lia guardada não entra na conta');
select is((select plataforma_guarda(davi, agua, 'CONTATO', c_lia) ->> 'motivo' from ids, c, ct), 'PROCESSO', 'O selo da ficha acha a guarda');

-- Primeira rodada, contando (regra 3).
create temp table r1 as select aplicar_retencao() as id;
select is((select modo || ' · ' || total || ' · ' || erros from retencao_rodadas where id = (select id from r1)), 'CONTANDO · 7 · 0',
  'A rodada contando registra os totais');
select is((select nome from contatos where id = (select c_marina from ct)), 'Marina Lopes', 'Contando, nada é apagado');
select is((select count(*)::integer from arquivos_a_apagar), 0, 'Contando, nenhum arquivo vai para a fila');
select is((select h.dados ->> 'modo' || ' · ' || (h.dados -> 'itens' ->> 'CONTATO') from historico h
            where h.acao = 'retencao.rodada' and h.condominio_id = (select agua from c)), 'CONTANDO · 1',
  'PT-03: o histórico do condomínio conta por tipo');
select is((select count(*)::integer from historico h where h.acao = 'retencao.rodada' and h.condominio_id = (select pequi from c)), 0,
  'Condomínio sem nada vencido não ganha linha no histórico');

-- Ligar a exclusão (quadro 356).
select is(pg_temp.codigo($$ select console_retencao_modo(impl, 'APAGANDO', 1) from ids $$), 'TC401', 'Só a Administração liga a exclusão');
select is((select console_retencao_modo(adm, 'APAGANDO', 1) ->> 'modo' from ids), 'APAGANDO', 'A Administração liga a exclusão');
select is(pg_temp.codigo($$ select console_retencao_modo(adm, 'CONTANDO', 1) from ids $$), 'TC409', 'Versão velha não muda o modo');

-- Segunda rodada, apagando.
create temp table r2 as select aplicar_retencao() as id;
select is((select modo || ' · ' || total || ' · ' || arquivos || ' · ' || erros from retencao_rodadas where id = (select id from r2)),
  'APAGANDO · 7 · 1 · 0', 'A rodada apagando registra os totais e o arquivo da exportação');
select is((select coalesce(nome, '-') || ' · ' || coalesce(telefone, '-') || ' · ' || dados_removidos_motivo || ' · ' || coalesce(dados_removidos_por::text, 'rotina')
             from contatos where id = (select c_marina from ct)), '- · - · PRAZO · rotina', 'Marina, 180 dias depois de sair: dados apagados pelo prazo');
select is((select nome from contatos where id = (select c_caio from ct)), 'Caio Nunes', 'Caio, com pedido aberto, fica');
select is((select nome from contatos where id = (select c_lia from ct)), 'Lia Prado', 'Lia, guardada, fica');
select is((select nome from contatos where id = (select c_pedro from ct)), 'Pedro Souza', 'Pedro, que mora, fica');
select is((select coalesce(nome, '-') || ' · ' || coalesce(aniversario_dia::text, '-') || ' · ' || (dados_apagados_em is not null)
             from familiares_unidade where parentesco = 'FILHO'), '- · - · true', 'A família que saiu perde nome e aniversário');
select is((select nome from familiares_unidade where parentesco = 'CONJUGE'), 'Rosa Souza', 'A família que mora fica');
select is((select coalesce(nome, '-') || ' · ' || coalesce(raca, '-') from pets_unidade), '- · -', 'O pet que saiu perde nome e raça');
select is((select coalesce(placa, '-') || ' · ' || coalesce(modelo, '-') from veiculos), '- · -', 'O veículo retirado perde placa e modelo');
select is((select coalesce(texto, '-') || ' · ' || coalesce(telefone, '-') || ' · ' || triagem || ' · ' || (apagada_em is not null)
             from mensagens_whatsapp where provedor_id = 'M1'), '- · - · ARQUIVADA · true', 'A mensagem sem pedido sai da triagem sem texto nem número');
select is((select count(*)::integer from conversas_whatsapp), 0, 'A conversa parada some');
select is((select bucket || ':' || origem from arquivos_a_apagar), 'exportacoes:EXPORTACAO', 'O arquivo da exportação vencida vai para a fila');
select is((select h.dados ->> 'modo' || ' · ' || (h.dados ->> 'total') from historico h
            where h.acao = 'retencao.rodada' and h.condominio_id = (select agua from c) order by h.ocorrido_em desc, h.id desc limit 1),
  'APAGANDO · 7', 'PT-03: a exclusão fica no histórico do condomínio');
create temp table r3 as select aplicar_retencao() as id;
select is((select total from retencao_rodadas where id = (select id from r3)), 0, 'A rodada seguinte não acha mais nada');

-- A fila de arquivos (regra 4).
create temp table fila as select (retencao_arquivos_pendentes(10) -> 0 ->> 'id')::bigint as id;
select retencao_arquivo_resultado(id, 'Falhou a conexão') from fila;
select is((select tentativas || ' · ' || erro || ' · ' || (apagado_em is null) from arquivos_a_apagar), '1 · Falhou a conexão · true',
  'Falha conta a tentativa e o arquivo continua na fila');
select retencao_arquivo_resultado(id, null) from fila;
select is((select (apagado_em is not null) || ' · ' || coalesce(erro, '-') from arquivos_a_apagar), 'true · -', 'Apagado do armazenamento');
select is(jsonb_array_length(retencao_arquivos_pendentes(10)), 0, 'A fila esvazia');

-- Dados de uma pessoa (quadros 352 a 354).
select is(pg_temp.codigo($$ select plataforma_dados_pessoa(davi, agua, 'Pedro') from ids, c $$), 'TC422', 'Busca só por telefone ou e-mail');
create temp table busca as select plataforma_dados_pessoa(davi, agua, '+556199990002') as r from ids, c;
select is((select r -> 'pessoas' -> 0 -> 'contato' ->> 'nome' from busca), 'Pedro Souza', 'Acha pelo telefone sem o nono dígito');
select is((select (r -> 'pessoas' -> 0 -> 'situacao' ->> 'mora')::boolean from busca), true, 'Mostra que mora');
select is((select jsonb_array_length(plataforma_dados_pessoa(davi, agua, 'PEDRO@exemplo.com.br') -> 'pessoas') from ids, c), 1, 'Acha pelo e-mail');
select is((select jsonb_array_length(plataforma_dados_pessoa(bia, pequi, '+5561999990002') -> 'pessoas') from ids, c), 0,
  'Outro condomínio não acha');
select is((select count(*)::integer from historico h where h.acao = 'privacidade.busca' and h.condominio_id = (select agua from c)
            and h.dados::text not like '%9999%' and h.dados::text not like '%pedro%'), 2, 'A busca fica no histórico sem o telefone nem o e-mail');
select is((select count(*)::integer from ids, c, ct, jsonb_array_elements(plataforma_dados_pessoa_exportar(davi, agua, c_pedro) -> 'linhas') l
            where l ->> 'parte' in ('Cadastro', 'Unidade', 'Mensagem de WhatsApp')), 3,
  'Baixar tudo traz o cadastro, a unidade e a mensagem');

select is(pg_temp.motivo($$ select plataforma_remover_dados_pessoa(davi, agua, c_pedro, (select versao from contatos where id = c_pedro), 'PEDIDO') from ids, c, ct $$),
  'CONTATO_COM_UNIDADE', 'Quem mora não tem os dados removidos');
select is(pg_temp.motivo($$ select plataforma_remover_dados_pessoa(davi, agua, c_caio, (select versao from contatos where id = c_caio), 'PEDIDO') from ids, c, ct $$),
  'CONTATO_COM_PEDIDO_ABERTO', 'Quem tem pedido aberto não tem os dados removidos');
select is(pg_temp.motivo($$ select plataforma_remover_dados_pessoa(davi, agua, c_lia, (select versao from contatos where id = c_lia), 'PEDIDO') from ids, c, ct $$),
  'CONTATO_GUARDADO', 'Quem está guardado não tem os dados removidos');
select plataforma_tirar_guarda(davi, agua, (r ->> 'id')::uuid, 1, 'O processo terminou') from ids, c, g;
select plataforma_remover_dados_pessoa(davi, agua, c_lia, (select versao from contatos where id = c_lia), 'PEDIDO') from ids, c, ct;
select is((select coalesce(nome, '-') || ' · ' || dados_removidos_motivo || ' · ' || (dados_removidos_por = (select davi from ids))
             from contatos where id = (select c_lia from ct)), '- · PEDIDO · true', 'LGPD art. 18: removido a pedido, por quem removeu');

-- Console (quadros 356 a 358).
create temp table cr as select console_retencao(adm) as r from ids;
select is((select jsonb_array_length(r -> 'rodadas') from cr), 3, 'O Console lista as rodadas');
select is((select r -> 'rodadas' -> 1 -> 'clientes' -> 0 ->> 'nome' from cr), 'Residencial Águas Claras',
  'A rodada mostra o cliente pelo nome, só os que tiveram algo');
select is(pg_temp.codigo($$ select console_retencao(impl) from ids $$), 'TC401', 'Só a Administração vê a retenção');
select ok((select console_sessao(adm) -> 'acoes' ? 'console.retencao.ligar' from ids), 'O menu do Console mostra a Retenção para a Administração');
select ok((select not (console_sessao(impl) -> 'acoes' ? 'console.retencao.ver') from ids), 'e não para a Implantação');

-- Os outros prazos: o que nasce hoje e é olhado em 01/11/2028.
select set_config('app.transicao_evento', 'TESTE', true), set_config('app.transicao_sistema', 'on', true);
update condominios set cenario = 'PORTARIA_PRESENCIAL' where id = (select agua from c);
insert into envios_whatsapp (condominio_id, para, contato_id, finalidade, texto, estado, motivo, texto_enviado, modelo_chave, modelo_parametros)
select agua, '+5561999990002', c_pedro, 'RESPOSTA', 'Seu pedido foi registrado.', 'FALHOU', 'Falhou', 'Seu pedido foi registrado.', 'noticia_pedido', '["Pedro"]'
  from c, ct;
insert into envios_whatsapp (condominio_id, para, contato_id, finalidade, texto, estado)
select agua, '+5561999990002', c_pedro, 'RESPOSTA', 'Ainda na fila.', 'NA_FILA' from c, ct;
insert into envios_email (condominio_id, tipo, contato_id, para, estado, motivo)
select agua, 'CONFIRMACAO', c_pedro, 'pedro@exemplo.com.br', 'FALHOU', 'Falhou' from c, ct;
insert into avisos_vida (condominio_id, pessoa_id, tipo, referencia, visto_em) select agua, davi, 'RESERVA_CANCELADA', 'R1', app_now() from c, ids;
insert into avisos_vida (condominio_id, pessoa_id, tipo, referencia) select agua, davi, 'RESERVA_CANCELADA', 'R2' from c, ids;
insert into classificados (condominio_id, contato_id, unidade_id, tipo, texto, mostrar_telefone, estado, motivo, decidido_em, decidido_por)
select agua, c_pedro, u102, 'VENDO', 'Vendo bicicleta aro 29, pouco uso.', true, 'RECUSADO', 'Fora das regras do mural', app_now(), davi from c, ct, u, ids;
insert into encomendas (condominio_id, unidade_id, remetente, lugar_id, estado, aviso, aviso_motivo, guardada_por, observacao)
select agua, u102, 'Loja Exemplo', (select id from lugares_encomenda where condominio_id = agua order by ordem limit 1), 'GUARDADA', 'SEM_AVISO', 'SEM_CONTATO',
       davi, 'Caixa amassada' from c, u, ids;
select plataforma_entregar_encomenda(davi, agua, e.id, null, 'Rosa Souza', 'Esposa') from ids, c, encomendas e where e.condominio_id = agua;
insert into fotos_encomenda (condominio_id, encomenda_id, tipo, nome, mime, tamanho_declarado, tamanho, caminho, situacao, verificado_em, enviado_por)
select agua, e.id, 'ETIQUETA', 'etiqueta.jpg', 'image/jpeg', 1000, 1000, agua || '/encomendas/' || e.id || '/etiqueta.jpg', 'LIBERADO', app_now(), davi
  from c, ids, encomendas e where e.condominio_id = agua;
insert into links_publicos (hash, condominio_id, tipo, expira_em) select sha256('mural'::bytea), agua, 'MURAL', app_now() from c;
insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id, revogado_em) select sha256('etiqueta'::bytea), agua, 'ETIQUETA', gen_random_uuid(), app_now() from c;

insert into reservas (condominio_id, protocolo, area_id, unidade_id, contato_id, data, hora_inicio, hora_fim, estado, origem, observacao, criado_por)
select agua, '2026-R001', (select id from areas_comuns where condominio_id = agua order by nome limit 1), u102, c_pedro, '2026-10-30', '10:00', '14:00', 'CONFIRMADA', 'PAINEL', 'Aniversário', davi
  from c, u, ct, ids;

insert into envios_whatsapp (condominio_id, para, contato_id, pedido_id, finalidade, texto, estado, motivo)
select agua, '+5561999990003', c_caio, (select id from pedidos where contato_id = c_caio), 'RESPOSTA', 'Recebemos o seu pedido.', 'FALHOU', 'Falhou' from c, ct;
select plataforma_guardar(davi, agua, 'PEDIDO', (select id from pedidos where contato_id = c_caio), 'SINISTRO', null) from ids, c, ct;
insert into links_publicos (hash, condominio_id, tipo, expira_em) select sha256('mural-pequi'::bytea), pequi, 'MURAL', app_now() from c;
select pg_temp.em('2028-11-01 14:00:00-03');
select aplicar_retencao();
select is((select string_agg(coalesce(para, '-') || ':' || coalesce(texto, '-') || ':' || coalesce(texto_enviado, '-') || ':' || coalesce(modelo_parametros::text, '-'), ' | ' order by estado)
             from envios_whatsapp where contato_id = (select c_pedro from ct)),
  '-:-:-:[] | +5561999990002:Ainda na fila.:-:-', 'Envio de 12 meses perde número e texto; o da fila fica');
select is((select coalesce(para, '-') || ' · ' || (dados_apagados_em is not null) from envios_email), '- · true', 'E-mail de 12 meses perde o endereço');
select is((select string_agg(referencia, ',') from avisos_vida), 'R2', 'Aviso visto há 12 meses sai; o que não foi visto fica');
select is((select coalesce(texto, '-') || ' · ' || mostrar_telefone || ' · ' || (apagado_em is not null) from classificados), '- · false · true',
  'Classificado recusado há 90 dias perde o texto');
select is((select coalesce(retirou_nome, '-') || ' · ' || coalesce(observacao, '-') || ' · ' || remetente from encomendas), '- · - · Loja Exemplo',
  'Encomenda de 12 meses perde quem retirou');
select is((select situacao || ' · ' || motivo_recusa || ' · ' || (apagada_em is not null) from fotos_encomenda), 'NAO_LIBERADO · Apagada pelo prazo · true',
  'A foto da etiqueta deixa de ser servida');
select is((select count(*)::integer from arquivos_a_apagar where bucket = 'portaria'), 1, 'e vai para a fila do armazenamento');
select is((select count(*)::integer from links_publicos) + (select count(*)::integer from codigos_sem_conta), 0, 'Links e códigos vencidos há 90 dias somem');
select is((select coalesce(contato_id::text, '-') || ' · ' || coalesce(observacao, '-') || ' · ' || estado from reservas), '- · - · CONFIRMADA',
  'Reserva de 24 meses fica só com a unidade e a data');
select is((select count(*)::integer from retencao_rodadas where erros > 0), 0, 'Nenhuma rodada teve erro');
select is((select texto from envios_whatsapp where contato_id = (select c_caio from ct)), 'Recebemos o seu pedido.',
  'O envio de um pedido guardado fica');
select is((select (h.dados -> 'itens' ->> 'LINK') from historico h where h.acao = 'retencao.rodada' and h.condominio_id = (select pequi from c)
            order by h.ocorrido_em desc limit 1), '1', 'Cada condomínio conta e apaga só os seus links');

select * from finish();
rollback;

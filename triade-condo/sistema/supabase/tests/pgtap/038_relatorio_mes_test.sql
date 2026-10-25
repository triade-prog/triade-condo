-- Relatório do mês para a assembleia (TR-02, TR-05, TR-08, TR-10). Em fevereiro de 2027 o
-- Residencial Ipê tem a Torre A e a Torre B. Quatro pedidos: dois de manutenção (um em cada
-- torre), uma limpeza no hall que é concluída e reaberta, e uma limpeza na Torre B que fica
-- aberta. Duas decisões são pedidas ao conselheiro e uma é respondida em fevereiro. Em março a
-- síndica e o secretário, que só acompanha, montam o relatório de fevereiro.
begin;
select plan(48);

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
select pg_temp.em('2027-02-01 09:00:00-03');

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruno') as bruno,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi,
  teste.pessoa('Zé') as ze;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruno, 'Bruno', 'Secretário', array['ACOMPANHAR']) as v_bruno,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Conselho', array['APROVAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, ze, 'Zé', 'Porteiro', array['VER_AGENDA']) as v_ze
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;

create temp table bl as select
  (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ta,
  (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre B', 2, true) ->> 'id')::uuid as tb
  from ids, c;
select plataforma_incluir_unidades(ana, ipe, ta, '[{"identificacao": "101"}]') from ids, c, bl;
select plataforma_incluir_unidades(ana, ipe, tb, '[{"identificacao": "201"}]') from ids, c, bl;
create temp table u as select (select id from unidades where identificacao = '101') as u101, (select id from unidades where identificacao = '201') as u201;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from categorias where condominio_id = ipe and modelo = 'LIMPEZA') as limpeza,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO') as concluido
  from c;
create function pg_temp.pedido(p_assunto text, p_local text, p_categoria uuid, p_unidade uuid) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), p_unidade, null, p_local, p_categoria,
          (select normal from cfg), p_assunto, 'Descrição do problema no prédio.', 'OBSERVACAO', false, null) ->> 'id')::uuid $$;
create function pg_temp.concluir(p uuid) returns jsonb language sql as $$
  select plataforma_concluir_pedido((select ana from ids), (select ipe from c), p, pg_temp.vp(p), (select concluido from cfg),
                                    'Resolvido pela equipe do prédio.', null) $$;

select plataforma_definir_atendimento(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe),
         jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true)), v_ana)
  from ids, c, vs;

-- Fevereiro.
create temp table p as select
  pg_temp.pedido('Vazamento na cozinha', null, manutencao, u101) as pa,
  pg_temp.pedido('Bomba da Torre B', null, manutencao, u201) as pb,
  pg_temp.pedido('Hall sujo', 'Hall de entrada', limpeza, null) as pc,
  pg_temp.pedido('Lixeira da Torre B', null, limpeza, u201) as pd
  from cfg, u;
select pg_temp.em('2027-02-01 10:00:00-03');
select plataforma_registrar_retorno(ana, ipe, pa, pg_temp.vp(pa), 'TELEFONE', 'O encanador vem amanhã cedo.') from ids, c, p;
select pg_temp.em('2027-02-01 15:00:00-03');
select pg_temp.concluir(pc) from p;
select pg_temp.em('2027-02-02 09:00:00-03');
select pg_temp.concluir(pa) from p;
select plataforma_reabrir_pedido(ana, ipe, pc, pg_temp.vp(pc), 'O hall sujou de novo.', v_ana) from ids, c, p, vs;
select pg_temp.em('2027-02-03 09:00:00-03');
select pg_temp.concluir(pb) from p;
create temp table d as select
  (plataforma_pedir_decisao(ana, ipe, pd, pg_temp.vp(pd), 'Trocar a lixeira por uma maior', null, '2027-02-10', v_gil,
     '[{"descricao": "Lixeira de 240 litros"}, {"descricao": "Duas de 120 litros"}]') ->> 'id')::uuid as d1,
  (plataforma_pedir_decisao(ana, ipe, pc, pg_temp.vp(pc), 'Contratar limpeza extra no hall', null, '2027-02-26', v_gil,
     '[{"descricao": "Sábados"}, {"descricao": "Diária"}]') ->> 'id')::uuid as d2
  from ids, c, p, vs;
select pg_temp.em('2027-02-04 09:00:00-03');
select plataforma_responder_decisao(gil, ipe, d1, (select versao from decisoes_pedido where id = d1), true, 1, 'Cabe no abrigo.') from ids, c, d;

-- Março: o relatório de fevereiro.
select pg_temp.em('2027-03-05 09:00:00-03');

create temp table rel as select plataforma_relatorios(ana, ipe) as r from ids, c;
select is((select r ->> 'mesFechado' from rel), '2027-02', 'TR-11: o mês para montar é o último fechado');
select is((select r -> 'meses' from rel), '["2027-02"]'::jsonb, 'TR-10: só os meses fechados desde a implantação');
select is((select r -> 'modelo' -> 'partes' from rel), '["RESUMO", "ATENDIMENTO", "CATEGORIA", "TORRE", "DECISOES", "PALAVRA"]'::jsonb,
  'TR-10: sem modelo guardado, vêm marcadas todas as partes menos a reincidência');
select is((select r -> 'pode' from rel), '{"decisoes": true, "documentos": true}'::jsonb, 'C.1: a síndica vê decisões e documentos');
select is((select plataforma_relatorios(bruno, ipe) -> 'pode' from ids, c), '{"decisoes": false, "documentos": false}'::jsonb,
  'TR-08: quem só acompanha não vê decisões nem documentos');
select throws_ok($$ select plataforma_relatorios(ze, ipe) from ids, c $$, 'TC401', null, 'TR-08: sem ver os pedidos, sem relatório');
select throws_ok($$ select plataforma_relatorios(davi, ipe) from ids, c $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não vê');

-- Prévia: os números do mês.
create temp table pv as select plataforma_previa_relatorio(ana, ipe, '2027-02') as r from ids, c;
select is((select r -> 'atendimento' -> 'atual' -> 'registrados' from pv), '4', 'TR-02: 4 pedidos registrados em fevereiro');
select is((select r -> 'atendimento' -> 'atual' -> 'concluidos' from pv), '3', 'TR-02: 3 conclusões em fevereiro, contando a que foi reaberta');
select is((select r -> 'atendimento' -> 'atual' -> 'reabertos' from pv), '1', 'TR-02: 1 reaberto');
select is((select r -> 'atendimento' -> 'atual' -> 'retornos' from pv),
  (select plataforma_indicadores(ana, ipe, 'MES_PASSADO') -> 'atual' -> 'retornos' from ids, c),
  'TR-02: retornos no prazo pela mesma conta dos indicadores');
select is((select r -> 'atendimento' -> 'anterior' -> 'registrados' from pv), '0', 'TR-02: o mês anterior ao lado, com zero pedidos');
select is((select r -> 'atendimento' -> 'anterior' -> 'retornos' ->> 'porcentagem' from pv), null, 'TR-07: sem retorno no mês anterior, sem dados');
select is((select jsonb_path_query_first(r, '$.categorias[*] ? (@.nome == "Manutenção")') - 'chave' - 'retornos' - 'noPrazo' - 'porcentagem' from pv),
  '{"nome": "Manutenção", "registrados": 2, "concluidos": 2, "tempoMedioHoras": 36.0}'::jsonb,
  'TR-05: por categoria, com o tempo médio de fechamento (24 h e 48 h)');
select is((select jsonb_path_query_first(r, '$.categorias[*] ? (@.nome == "Limpeza")') -> 'tempoMedioHoras' from pv), 'null'::jsonb,
  'TR-07: a limpeza reaberta não tem fechamento: sem dados, não zero');
select is((select array_agg(x ->> 'nome' || ' ' || (x ->> 'registrados') || ' ' || (x ->> 'concluidos') || ' ' || coalesce(x ->> 'tempoMedioHoras', 'sem dados') order by n)
             from pv, jsonb_array_elements(r -> 'torres') with ordinality t(x, n)),
  array['Torre A 1 1 24.0', 'Torre B 2 1 48.0', 'Áreas comuns e sem unidade 1 1 sem dados'],
  'TR-05: por torre na ordem dos blocos, com as áreas comuns no fim');
select is((select (select sum((x ->> 'retornos')::int) from jsonb_array_elements(r -> 'torres') x) = (r -> 'atendimento' -> 'atual' -> 'retornos' ->> 'total')::int from pv),
  true, 'TR-05: os retornos das torres somam os do mês');
select is((select (r -> 'decisoes') - 'medianaHoras' - 'despesas' from pv),
  '{"pedidas": 2, "decididas": 1, "aprovadas": 1, "devolvidas": 0, "aguardandoNoFim": 1, "peloConselho": 0}'::jsonb,
  'TR-01: decisões pedidas, decididas e as que esperavam no fim do mês');
select is((select plataforma_previa_relatorio(bruno, ipe, '2027-02') -> 'foraPorPermissao' from ids, c), '["DECISOES"]'::jsonb,
  'TR-08: a prévia de quem não aprova vem sem as decisões');
select is((select plataforma_previa_relatorio(bruno, ipe, '2027-02') ? 'decisoes' from ids, c), false, 'TR-08: e os números das decisões não vêm');
select is(pg_temp.motivo($$ select plataforma_previa_relatorio(ana, ipe, '2027-03') from ids, c $$), 'MES_EM_ANDAMENTO', 'TR-11: o mês em andamento não tem relatório');
select is(pg_temp.campos($$ select plataforma_previa_relatorio(ana, ipe, 'fevereiro') from ids, c $$), '["mes"]'::jsonb, 'TR-10: o mês vem como 2027-02');
select is(pg_temp.motivo($$ select plataforma_previa_relatorio(ana, ipe, '2024-12') from ids, c $$), 'MES_ANTIGO', 'TR-10: só os últimos 24 meses');

-- Anexos: o arquivo enviado, depois de verificado.
create temp table ax as select
  (plataforma_iniciar_anexo_relatorio(bruno, ipe, 'Bomba nova.jpg', 'image/jpeg', 2000) ->> 'arquivoId')::uuid as foto,
  (plataforma_iniciar_anexo_relatorio(ana, ipe, 'Orçamento.pdf', 'application/pdf', 3000) ->> 'arquivoId')::uuid as orc
  from ids, c;
select is(pg_temp.motivo($$ select plataforma_iniciar_anexo_relatorio(ana, ipe, 'Planta.webp', 'image/webp', 100) from ids, c $$), 'TIPO_NAO_ACEITO_RELATORIO',
  'TR-10: só JPG, PNG e PDF entram no PDF do relatório');
select is(pg_temp.motivo($$ select plataforma_iniciar_anexo_relatorio(ana, ipe, 'Grande.pdf', 'application/pdf', 10485761) from ids, c $$), 'ARQUIVO_GRANDE',
  'TR-10: até 10 MB cada');
select is(pg_temp.motivo($$ select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['ATENDIMENTO'], null, null,
                              jsonb_build_array(jsonb_build_object('arquivoId', foto)), false) from ids, c, ax $$), 'ARQUIVO_NAO_LIBERADO',
  'PT-07: o anexo só entra depois de verificado');
select plataforma_verificar_anexo_relatorio(bruno, ipe, foto, true, 1900, null) from ids, c, ax;
select plataforma_verificar_anexo_relatorio(ana, ipe, orc, true, 2900, null) from ids, c, ax;
select throws_ok($$ select plataforma_verificar_anexo_relatorio(ana, ipe, foto, true, 1900, null) from ids, c, ax $$, 'TC404', null,
  'PT-07: só quem enviou verifica o próprio arquivo');

-- O secretário gera: as decisões ficam de fora (C.1, TR-08).
select is(pg_temp.campos($$ select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['RESUMO', 'ATENDIMENTO'], '', null, '[]', false) from ids, c $$),
  '["resumo"]'::jsonb, 'TR-10: o resumo marcado precisa de texto');
select is(pg_temp.campos($$ select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['ATENDIMENTO', 'OUTRA'], null, null, '[]', false) from ids, c $$),
  '["partes"]'::jsonb, 'TR-10: só as partes conhecidas');
select throws_ok($$ select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['ATENDIMENTO'], null, null,
                     jsonb_build_array(jsonb_build_object('arquivoId', orc)), false) from ids, c, ax $$, 'TC404', null,
  'TR-08: o arquivo que outra pessoa enviou e ainda não entrou num relatório não aparece');
create temp table g1 as select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['PALAVRA', 'DECISOES', 'ATENDIMENTO', 'RESUMO'],
  'Fevereiro com 4 pedidos.', 'A bomba da Torre B foi trocada.', jsonb_build_array(jsonb_build_object('arquivoId', foto)), false) as r
  from ids, c, ax;
select is((select r ->> 'numero' from g1), '1', 'TR-10: o primeiro relatório de fevereiro');
create temp table r1 as select plataforma_relatorio(ana, ipe, (r ->> 'id')::uuid) as r from ids, c, g1;
select is((select r -> 'partes' from r1), '["RESUMO", "ATENDIMENTO", "PALAVRA"]'::jsonb,
  'TR-08: as partes na ordem do relatório, sem a que a pessoa não pode ver');
select is((select r -> 'conteudo' -> 'foraPorPermissao' from r1), '["DECISOES"]'::jsonb, 'TR-08: o relatório diz o que ficou de fora');
select is((select r -> 'conteudo' -> 'autor' from r1), '{"nome": "Bruno", "cargo": "Secretário", "sindico": false}'::jsonb, 'TR-10: quem gerou, com o cargo');
select is((select r -> 'anexos' from r1),
  (select jsonb_build_array(jsonb_build_object('ordem', 1, 'titulo', 'Bomba nova', 'tipo', 'image/jpeg', 'arquivoId', foto, 'tamanho', 1900, 'origem', 'ENVIADO')) from ax),
  'TR-10: o anexo com o nome sem a extensão');

-- A síndica gera de novo, com o documento e o modelo. Antes, o vazamento é reaberto em março.
create temp table dc as select
  (plataforma_salvar_documento(ana, ipe, null, null, 'CONTRATO', 'Contrato da administradora', null, true, false, null) ->> 'id')::uuid as contrato,
  (plataforma_salvar_documento(ana, ipe, null, null, 'LAUDO', 'Planta do térreo', null, false, false, null) ->> 'id')::uuid as planta
  from ids, c;
create temp table dv as select
  (plataforma_iniciar_versao_documento(ana, ipe, contrato, 'contrato.pdf', 'application/pdf', 5000, null, '2027-01-01', 'Assembleia de 2026') ->> 'versaoId')::uuid as vc,
  (plataforma_iniciar_versao_documento(ana, ipe, planta, 'planta.webp', 'image/webp', 5000, null, '2027-01-01', 'Assembleia de 2026') ->> 'versaoId')::uuid as vp
  from ids, c, dc;
select plataforma_verificar_versao_documento(ana, ipe, contrato, vc, true, 5000, null) from ids, c, dc, dv;
select plataforma_verificar_versao_documento(ana, ipe, planta, vp, true, 5000, null) from ids, c, dc, dv;
select plataforma_reabrir_pedido(ana, ipe, pa, pg_temp.vp(pa), 'Pingou de novo.', v_ana) from ids, c, p, vs;

select is(pg_temp.motivo($$ select plataforma_gerar_relatorio(ana, ipe, '2027-02', array['ATENDIMENTO'], null, null,
                              jsonb_build_array(jsonb_build_object('documentoId', planta)), false) from ids, c, dc $$), 'TIPO_NAO_ACEITO_RELATORIO',
  'TR-10: documento em WEBP não entra no PDF');
select throws_ok($$ select plataforma_gerar_relatorio(bruno, ipe, '2027-02', array['ATENDIMENTO'], null, null,
                     jsonb_build_array(jsonb_build_object('documentoId', contrato)), false) from ids, c, dc $$, 'TC404', null,
  'TR-08: quem não vê o documento não o anexa');
create temp table g2 as select plataforma_gerar_relatorio(ana, ipe, '2027-02', array['RESUMO', 'ATENDIMENTO', 'CATEGORIA', 'TORRE', 'DECISOES'],
  'Fevereiro com 4 pedidos.', null,
  jsonb_build_array(jsonb_build_object('documentoId', contrato), jsonb_build_object('arquivoId', foto)), true) as r
  from ids, c, dc, ax;
select is((select r ->> 'numero' from g2), '2', 'B.1: gerar de novo cria o número seguinte do mês');
create temp table r2 as select plataforma_relatorio(ana, ipe, (r ->> 'id')::uuid) as r from ids, c, g2;
select is((select array_agg(x ->> 'origem' || ' ' || (x ->> 'titulo') order by (x ->> 'ordem')::int) from r2, jsonb_array_elements(r -> 'anexos') x),
  array['DOCUMENTO Contrato da administradora', 'ENVIADO Bomba nova'],
  'TR-10: o documento restrito da síndica e o arquivo que já estava no relatório anterior, na ordem dada');
select is((select jsonb_path_query_first(r -> 'conteudo', '$.categorias[*] ? (@.nome == "Manutenção")') -> 'tempoMedioHoras' from r2), '48.0'::jsonb,
  'TR-05: o relatório novo usa os números de agora (o vazamento reaberto saiu do tempo médio)');
select is((select jsonb_path_query_first(plataforma_relatorio(ana, ipe, (g1.r ->> 'id')::uuid) -> 'conteudo', '$.atendimento.atual.concluidos') from ids, c, g1),
  '3'::jsonb, 'B.1: o relatório 1 continua com os números do dia em que foi gerado');
select is((select plataforma_relatorios(ana, ipe) -> 'modelo' -> 'partes' from ids, c), '["RESUMO", "ATENDIMENTO", "CATEGORIA", "TORRE", "DECISOES"]'::jsonb,
  'TR-10: as escolhas ficam como o modelo dos próximos meses');
select is((select array_agg(x ->> 'numero' || ' ' || (x ->> 'ultimo') order by n) from ids, c,
                  jsonb_array_elements(plataforma_relatorios(ana, ipe) -> 'gerados') with ordinality t(x, n)),
  array['2 true', '1 false'], 'B.1: os dois ficam na lista, o mais novo primeiro');

-- Abrir os anexos, baixar e o histórico.
select is((select plataforma_abrir_anexo_relatorio(bruno, ipe, (g2.r ->> 'id')::uuid, 1) ->> 'armazenamento' from ids, c, g2), 'documentos',
  'TR-08: quem abre o relatório gerado abre o que foi gerado');
select is((select plataforma_abrir_anexo_relatorio(ana, ipe, (g2.r ->> 'id')::uuid, 2) - 'caminho' from ids, c, g2),
  '{"armazenamento": "relatorios", "nome": "Bomba nova.jpg", "tipo": "image/jpeg"}'::jsonb, 'TR-10: o arquivo enviado sai do armazenamento dos relatórios');
select plataforma_relatorio_baixado(ana, ipe, (r ->> 'id')::uuid, 'PDF') from ids, c, g2;
select is((select array_agg(acao || ' ' || coalesce(dados ->> 'formato', dados ->> 'numero', '') order by acao, dados ->> 'numero') from historico
            where entidade in ('relatorios_mes', 'modelos_relatorio')),
  array['relatorio.baixado PDF', 'relatorio.gerado 1', 'relatorio.gerado 2', 'relatorio.modelo_guardado '],
  'TR-08: gerar, guardar o modelo e baixar ficam no histórico');
select throws_ok($$ select plataforma_relatorio(davi, jatoba, (r ->> 'id')::uuid) from ids, c, g2 $$, 'TC404', null,
  'PT-01: o relatório do Ipê não existe no Jatobá');
select throws_ok($$ update relatorios_mes set resumo = 'Outro texto' $$, null, null, 'B.1: o relatório gerado não muda');

select * from finish();
rollback;

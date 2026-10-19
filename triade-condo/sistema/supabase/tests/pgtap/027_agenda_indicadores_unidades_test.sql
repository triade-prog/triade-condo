-- Datas de outras telas na Agenda, dois indicadores novos e unidades à venda ou para alugar
-- (AG-09, TR-01, MU-11). A Agenda mostra o vencimento do contrato dos elevadores, a validade do
-- AVCB e da apólice (restrita) e a assembleia convocada, cada uma só para quem vê a tela de
-- origem. Os indicadores mostram as pendências de cada responsável agora e o tempo típico de
-- solução de cada categoria no período. A síndica marca a 101 à venda e depois para alugar.
-- O relógio começa numa segunda-feira, 01/03/2027, às 09:00.
begin;
select plan(30);

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
select pg_temp.em('2027-03-01 09:00:00-03');

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Portaria', array['VER_AGENDA']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Conselho', array['VER_AGENDA', 'VER_COMUNICADOS']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Administradora', array['VER_AGENDA', 'DOCUMENTOS']) as v_lia,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Zelador', array['VER_AGENDA', 'VER_MANUTENCAO', 'VER_ASSEMBLEIAS']) as v_fabio,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Secretário', array['RESPONDER']) as v_edu
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.va(p uuid) returns integer language sql as $$ select versao from assembleias where id = p $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vu(p uuid) returns integer language sql as $$ select versao from unidades where id = p $$;
-- As datas de outras telas que esta parte trouxe, para a pessoa, em março.
create function pg_temp.datas(p_pessoa uuid) returns jsonb language sql as $$
  select coalesce(jsonb_agg(d order by d ->> 'data', d ->> 'fonte', d ->> 'titulo'), '[]'::jsonb)
    from jsonb_array_elements(plataforma_agenda(p_pessoa, (select ipe from c), '2027-03-01', '2027-03-31') -> 'datas') d
   where d ->> 'fonte' in ('CONTRATO', 'DOCUMENTO', 'ASSEMBLEIA') $$;
create function pg_temp.resumo(p_pessoa uuid) returns text[] language sql as $$
  select coalesce(array_agg((d ->> 'data') || ' ' || (d ->> 'fonte') || ' ' || (d ->> 'titulo') order by d ->> 'data', d ->> 'fonte', d ->> 'titulo'), '{}')
    from jsonb_array_elements(pg_temp.datas(p_pessoa)) d $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;

-- ---------------------------------------------------------------------------------------
-- Agenda (AG-09).

create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Elevadores Atlas', 'Elevadores', null, null, null, null, 'CONTRATO', '2027-03-10', null, null, null)
     ->> 'id')::uuid as atlas,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Vidraçaria Sol', 'Vidros', null, null, null, null, 'CHAMADO', null, null, null, null)
     ->> 'id')::uuid as sol
  from ids, c;
create temp table dc as select
  (plataforma_salvar_documento(ana, ipe, null, null, 'LAUDO', 'AVCB', null, false, false, '2027-03-12') ->> 'id')::uuid as avcb,
  (plataforma_salvar_documento(ana, ipe, null, null, 'CONTRATO', 'Apólice do seguro', null, true, false, '2027-03-12') ->> 'id')::uuid as apolice,
  (plataforma_salvar_documento(ana, ipe, null, null, 'LAUDO', 'Laudo antigo das bombas', null, false, false, '2027-03-11') ->> 'id')::uuid as antigo
  from ids, c;
select plataforma_arquivar_documento(ana, ipe, antigo, (select versao from documentos where id = antigo), 'Substituído pelo novo') from ids, c, dc;

-- Assembleias: uma convocada, uma convocada tarde da noite e um rascunho.
select plataforma_regras_assembleia(ana, ipe, pg_temp.vcfg(), 10, 'UNIDADE') from ids, c;
create temp table aa as select
  (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "Assembleia geral de março", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
     "primeiraChamada": "2027-03-20T19:00:00-03:00", "segundaChamada": "2027-03-20T19:30:00-03:00", "local": "Salão de festas",
     "itens": [{"titulo": "Aprovar as contas", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as ago,
  (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "Extraordinária da fachada", "tipo": "EXTRAORDINARIA", "forma": "PRESENCIAL",
     "primeiraChamada": "2027-03-31T22:30:00-03:00", "segundaChamada": "2027-03-31T23:00:00-03:00", "local": "Salão de festas",
     "itens": [{"titulo": "Pintar a fachada", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as age,
  (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "Rascunho da piscina", "tipo": "EXTRAORDINARIA", "forma": "PRESENCIAL",
     "primeiraChamada": "2027-03-25T19:00:00-03:00", "segundaChamada": "2027-03-25T19:30:00-03:00", "local": "Salão de festas",
     "itens": [{"titulo": "Reformar a piscina", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as rascunho
  from ids, c;
select plataforma_convocar_assembleia(ana, ipe, ago, pg_temp.va(ago)) from ids, c, aa;
select plataforma_convocar_assembleia(ana, ipe, age, pg_temp.va(age)) from ids, c, aa;

select is((select pg_temp.resumo(ana) from ids), array[
    '2027-03-10 CONTRATO Elevadores Atlas', '2027-03-12 DOCUMENTO AVCB', '2027-03-12 DOCUMENTO Apólice do seguro',
    '2027-03-20 ASSEMBLEIA Assembleia geral de março', '2027-03-31 ASSEMBLEIA Extraordinária da fachada'],
  'AG-09: a síndica vê o contrato, os documentos e as assembleias convocadas; arquivado e rascunho não entram');
select is((select d from ids, jsonb_array_elements(pg_temp.datas(ana)) d where d ->> 'fonte' = 'CONTRATO'),
  (select jsonb_build_object('data', '2027-03-10', 'titulo', 'Elevadores Atlas', 'fonte', 'CONTRATO', 'id', atlas) from pr),
  'AG-09: o contrato vence no dia, sem horário, e leva ao prestador');
select is((select d from ids, jsonb_array_elements(pg_temp.datas(ana)) d where d ->> 'titulo' = 'Apólice do seguro'),
  (select jsonb_build_object('data', '2027-03-12', 'titulo', 'Apólice do seguro', 'fonte', 'DOCUMENTO', 'id', apolice, 'restrito', true) from dc),
  'AG-09: o documento vence na validade e diz se é restrito');
select is((select d from ids, jsonb_array_elements(pg_temp.datas(ana)) d where d ->> 'titulo' = 'Assembleia geral de março'),
  (select jsonb_build_object('data', '2027-03-20', 'titulo', 'Assembleia geral de março', 'fonte', 'ASSEMBLEIA', 'id', ago,
                             'horaInicio', '19:00', 'segundaChamada', '19:30', 'local', 'Salão de festas', 'estado', 'CONVOCADA') from aa),
  'AC-02: a assembleia entra no horário da 1ª chamada, com a 2ª ao lado');
select is((select d ->> 'data' || ' ' || (d ->> 'horaInicio') from ids, jsonb_array_elements(pg_temp.datas(ana)) d where d ->> 'titulo' = 'Extraordinária da fachada'),
  '2027-03-31 22:30', 'AG-09: o dia da assembleia é o do fuso do condomínio, não o de Greenwich');
select is((select pg_temp.resumo(bruna) from ids), '{}'::text[], 'AG-09: quem só vê a agenda não vê contratos, documentos nem assembleias');
select is((select pg_temp.resumo(gil) from ids), array['2027-03-12 DOCUMENTO AVCB'], 'CF-03: quem vê os documentos não vê o restrito');
select is((select pg_temp.resumo(lia) from ids), array['2027-03-12 DOCUMENTO AVCB', '2027-03-12 DOCUMENTO Apólice do seguro'],
  'CF-03: quem cuida dos documentos vê o restrito');
select is((select pg_temp.resumo(fabio) from ids), array['2027-03-10 CONTRATO Elevadores Atlas', '2027-03-20 ASSEMBLEIA Assembleia geral de março',
  '2027-03-31 ASSEMBLEIA Extraordinária da fachada'], 'CF-03: quem vê a manutenção e as assembleias vê os contratos e as assembleias');
select is((select jsonb_array_length(plataforma_agenda(ana, ipe, '2027-04-01', '2027-04-30') -> 'datas') from ids, c), 0,
  'AG-09: fora do período, nada');
select plataforma_cancelar_assembleia(ana, ipe, age, pg_temp.va(age), 'A fachada fica para o ano que vem') from ids, c, aa;
select is((select pg_temp.resumo(ana) from ids)[5], null, 'AG-09: a assembleia cancelada sai da Agenda');

-- ---------------------------------------------------------------------------------------
-- Indicadores (TR-01).

create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from categorias where condominio_id = ipe and modelo = 'LIMPEZA') as limpeza,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO') as concluido
  from c;
create function pg_temp.pedido(p_assunto text, p_responsavel uuid) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), null, null, 'Casa de bombas', (select manutencao from cfg),
          (select normal from cfg), p_assunto, 'Descrição do problema no prédio.', 'OBSERVACAO', false, p_responsavel) ->> 'id')::uuid $$;
create function pg_temp.concluir(p uuid) returns jsonb language sql as $$
  select plataforma_concluir_pedido((select ana from ids), (select ipe from c), p, pg_temp.vp(p), (select concluido from cfg),
                                    'Resolvido pela equipe do prédio.', null) $$;

-- O primeiro pedido chega antes de alguém atender: fica sem responsável.
create temp table p0 as select pg_temp.pedido('Luz da escada', null) as pe;
select plataforma_definir_atendimento(ana, ipe, pg_temp.vcfg(),
         jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_edu, 'disponivel', true)),
         v_ana)
  from ids, c, vs;
create temp table p as select
  pg_temp.pedido('Bomba parada', v_ana) as pa,
  pg_temp.pedido('Torneira pingando', v_ana) as pb,
  pg_temp.pedido('Portão rangendo', v_ana) as pc,
  pg_temp.pedido('Interfone mudo', v_edu) as pd
  from vs;
select pg_temp.em('2027-03-01 13:00:00-03');
select pg_temp.concluir(pb) from p;
select pg_temp.em('2027-03-01 19:00:00-03');
select pg_temp.concluir(pc) from p;
select pg_temp.em('2027-03-02 09:00:00-03');
select plataforma_reabrir_pedido(ana, ipe, pc, pg_temp.vp(pc), 'O portão voltou a ranger.', null) from ids, c, p;
select pg_temp.em('2027-03-03 13:00:00-03');
select pg_temp.concluir(pa) from p;
select pg_temp.em('2027-03-07 09:00:00-03');
select pg_temp.concluir(pc) from p;
select pg_temp.em('2027-03-08 09:00:00-03');
create temp table pf as select pg_temp.pedido('Lâmpada da garagem', v_ana) as pf from vs;

create temp table ind as select plataforma_indicadores(ana, ipe, 'ESTE_MES') as r from ids, c;
select is((select jsonb_path_query_first(r, '$.solucao[*] ? (@.nome == "Manutenção")') - 'categoriaId' from ind),
  '{"nome": "Manutenção", "concluidos": 3, "medianaHoras": 52.0, "maisDemoradoHoras": 144.0}'::jsonb,
  'TR-01: tempo típico pela mediana (4 h, 52 h e 144 h), com o mais demorado ao lado');
select is((select jsonb_path_query_first(r, '$.solucao[*] ? (@.nome == "Limpeza")') - 'categoriaId' from ind),
  '{"nome": "Limpeza", "concluidos": 0, "medianaHoras": null, "maisDemoradoHoras": null}'::jsonb,
  'TR-01: categoria sem pedido concluído vem sem número, nunca zero');
select is((select r -> 'pendencias' from ind), (select jsonb_build_array(
    jsonb_build_object('responsavelId', v_edu, 'nome', 'Edu', 'abertos', 1, 'retornoVencido', 1, 'maisAntigoDias', 7),
    jsonb_build_object('responsavelId', v_ana, 'nome', 'Síndica Ana', 'abertos', 1, 'retornoVencido', 0, 'maisAntigoDias', 0),
    jsonb_build_object('responsavelId', null, 'nome', null, 'abertos', 1, 'retornoVencido', 1, 'maisAntigoDias', 7)) from vs),
  'TR-01: pendências de agora por responsável, com o retorno vencido e a idade do mais antigo; sem responsável no fim');
select is((select plataforma_indicadores(ana, ipe, 'MES_PASSADO') -> 'solucao' @? '$[*] ? (@.concluidos > 0)' from ids, c), false,
  'TR-01: o tempo de solução segue o período escolhido');
select is((select plataforma_indicadores(ana, ipe, 'MES_PASSADO') -> 'pendencias' from ids, c), (select r -> 'pendencias' from ind),
  'TR-01: as pendências não mudam com o período');
select is((select plataforma_indicadores(davi, jatoba, 'ESTE_MES') -> 'pendencias' from ids, c), '[]'::jsonb,
  'PT-01: o outro condomínio não vê as pendências do Ipê');

-- ---------------------------------------------------------------------------------------
-- Unidades à venda e para alugar (MU-11).

select throws_ok($$ select plataforma_marcar_unidade(bruna, ipe, u101, 1, true, false) from ids, c, u $$, 'TC401', null,
  'MU-11: só quem cuida dos moradores marca');
select is(pg_temp.campos($$ select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101), null, false) from ids, c, u $$),
  '["aVenda", "paraAlugar"]'::jsonb, 'MU-11: as duas marcas vêm sempre');
select throws_ok($$ select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101) - 1, true, false) from ids, c, u $$, 'TC409', null,
  'AT-24: edição simultânea não passa por cima');
select is((select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101), true, false) from ids, c, u), (select pg_temp.vu(u101) from u),
  'MU-11: a síndica marca a 101 à venda');
select is((select plataforma_unidade(ana, ipe, u101) -> 'unidade' ->> 'aVendaDesde' from ids, c, u), '2027-03-08', 'MU-11: à venda desde hoje');
select is((select (x ->> 'aVenda') || ' ' || (x ->> 'paraAlugar') from ids, c, u, jsonb_array_elements(plataforma_unidades(ana, ipe) -> 'unidades') x
            where x ->> 'id' = u101::text), 'true false', 'MU-11: a marca aparece na lista');
select is((select (plataforma_unidades(ana, ipe) -> 'ocupacao') - array['comMorador', 'alugadas', 'proprietarioNaoMora', 'semResponsavel'] from ids, c),
  '{"aVenda": 1, "paraAlugar": 0}'::jsonb, 'MU-11: os contadores do topo');
select is((select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101), true, false) from ids, c, u), (select pg_temp.vu(u101) from u),
  'MU-11: marcar de novo não muda nada');
select pg_temp.em('2027-03-10 09:00:00-03');
select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101), true, true) from ids, c, u;
select is((select (plataforma_unidade(ana, ipe, u101) -> 'unidade') ->> 'aVendaDesde' || ' ' || ((plataforma_unidade(ana, ipe, u101) -> 'unidade') ->> 'paraAlugarDesde')
             from ids, c, u), '2027-03-08 2027-03-10', 'MU-11: a data de quando foi marcada fica até desmarcar');
select plataforma_marcar_unidade(ana, ipe, u101, pg_temp.vu(u101), false, true) from ids, c, u;
select is((select plataforma_unidade(ana, ipe, u101) -> 'unidade' -> 'aVendaDesde' from ids, c, u), 'null'::jsonb, 'MU-11: desmarcar tira a data');
select is((select array_agg(dados order by id) from historico, u where entidade = 'unidade' and entidade_id = u101::text and acao = 'unidade.situacao_mudou'),
  array['{"aVenda": true, "paraAlugar": false}', '{"aVenda": true, "paraAlugar": true}', '{"aVenda": false, "paraAlugar": true}']::jsonb[],
  'MU-11: cada mudança fica no histórico da unidade');
select plataforma_alterar_unidade(ana, ipe, u102, pg_temp.vu(u102), '102', ba, null, false) from ids, c, u, bl;
select is(pg_temp.motivo($$ select plataforma_marcar_unidade(ana, ipe, u102, pg_temp.vu(u102), true, false) from ids, c, u $$), 'UNIDADE_INATIVA',
  'MU-11: unidade desativada não se marca');
select is((select count(*)::int from pg_proc where proname like 'publico%' and (prosrc like '%a_venda%' or prosrc like '%para_alugar%')), 0,
  'MU-11: a marca não vai ao mural nem ao morador');

select * from finish();
rollback;

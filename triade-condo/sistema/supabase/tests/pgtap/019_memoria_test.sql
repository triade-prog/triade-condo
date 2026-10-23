-- Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04): prontuário que aponta para
-- Documentos, com situação de cada item e aviso no sino; linha do tempo com anotações que não se
-- apagam; manual do prédio com as seções do mural; dossiê de passagem de bastão; exportação de
-- tudo, montada em pacotes. Cada condomínio só vê o que é seu.
begin;
select plan(80);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administração', array['DOCUMENTOS']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_COMUNICADOS']) as v_fabio,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO']) as v_bruna
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vi(p uuid) returns integer language sql as $$ select versao from itens_prontuario where id = p $$;
create function pg_temp.va(p uuid) returns integer language sql as $$ select versao from anotacoes_memoria where id = p $$;
create function pg_temp.vs(p uuid) returns integer language sql as $$ select versao from secoes_manual where id = p $$;
create function pg_temp.item(p_chave text) returns jsonb language sql as $$
  select x from jsonb_array_elements(plataforma_prontuario((select ana from ids), (select ipe from c)) -> 'itens') x where x ->> 'chave' = p_chave $$;
-- Documento com a primeira versão já liberada.
create function pg_temp.documento(p_tipo text, p_titulo text, p_vale date, p_restrito boolean default false) returns uuid
language plpgsql as $$
declare v_doc uuid; v_ver uuid;
begin
  v_doc := (plataforma_salvar_documento((select ana from ids), (select ipe from c), null, null, p_tipo, p_titulo, null, p_restrito, false, p_vale) ->> 'id')::uuid;
  v_ver := (plataforma_iniciar_versao_documento((select ana from ids), (select ipe from c), v_doc, 'arquivo.pdf', 'application/pdf', 2000, null,
            '2025-04-12', null) ->> 'versaoId')::uuid;
  perform plataforma_verificar_versao_documento((select ana from ids), (select ipe from c), v_doc, v_ver, true, 1990, null);
  return v_doc;
end $$;

-- Prontuário (MP-12).
select is((select jsonb_array_length(plataforma_prontuario(fabio, ipe) -> 'itens') from ids, c), 14,
  'MP-12: o prontuário começa com a lista sugerida');
select is((select plataforma_prontuario(fabio, ipe) -> 'resumo' ->> 'falta' from ids, c), '14',
  'MP-12: sem documento ligado, todos os itens faltam');
select ok(not (select (plataforma_prontuario(fabio, ipe) ->> 'podeEditar')::boolean from ids, c),
  'CF-03: quem só vê os documentos não mexe no prontuário');
select throws_ok($$ select plataforma_prontuario(bruna, ipe) from ids, c $$, 'TC401', null,
  'CF-03: quem não vê os documentos não vê a memória');
select ok(not exists (select 1 from itens_prontuario), 'MP-12: a lista sugerida não ocupa linha enquanto ninguém mexe');

create temp table dc as select
  pg_temp.documento('CONVENCAO', 'Convenção', null) as convencao,
  pg_temp.documento('LAUDO', 'AVCB 2025', hoje - 16) as avcb,
  pg_temp.documento('OUTRO', 'Apólice Porto Seguro', hoje + 43) as seguro,
  pg_temp.documento('LAUDO', 'Laudo dos elevadores', hoje + 115) as elevador,
  pg_temp.documento('LAUDO', 'Laudo SPDA restrito', hoje + 300, true) as spda,
  (plataforma_salvar_documento(ana, ipe, null, null, 'OUTRO', 'Planta sem arquivo', null, false, false, null) ->> 'id')::uuid as planta
  from d, ids, c;

select throws_ok($$ select plataforma_item_prontuario(fabio, ipe, null, 'CONVENCAO', null, 'LIGAR', null, null, convencao, null, null) from ids, c, dc $$,
  'TC401', null, 'CF-03: só quem cuida dos documentos liga documento');
create temp table it as select
  (plataforma_item_prontuario(gil, ipe, null, 'CONVENCAO', null, 'LIGAR', null, null, convencao, null, null) ->> 'id')::uuid as i_conv
  from ids, c, dc;
select is(pg_temp.item('CONVENCAO') ->> 'situacao', 'EM_DIA', 'MP-12: documento sem validade e com arquivo deixa o item em dia');
select is(pg_temp.item('CONVENCAO') -> 'documento' ->> 'titulo', 'Convenção', 'MP-12: o item mostra o documento ligado, sem cópia');
select is((select chave from itens_prontuario where id = (select i_conv from it)), 'CONVENCAO', 'MP-12: o item sugerido ganha linha na primeira vez');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'AVCB', null, 'LIGAR', null, null, avcb, null, null) from ids, c, dc $$,
  'MP-12: liga o AVCB');
select is(pg_temp.item('AVCB') ->> 'situacao', 'VENCEU', 'MP-12: documento com validade passada deixa o item vencido');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'SEGURO', null, 'LIGAR', null, null, seguro, null, null) from ids, c, dc $$,
  'MP-12: liga a apólice');
select is(pg_temp.item('SEGURO') ->> 'situacao', 'VENCE', 'MP-12: dentro dos 60 dias, o item vence');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'ELEVADORES', null, 'LIGAR', null, null, elevador, null, null) from ids, c, dc $$,
  'MP-12: liga o laudo dos elevadores');
select is(pg_temp.item('ELEVADORES') ->> 'situacao', 'EM_DIA', 'MP-12: a 115 dias, com aviso padrão de 60, está em dia');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, (pg_temp.item('ELEVADORES') ->> 'id')::uuid, null,
                   (pg_temp.item('ELEVADORES') ->> 'versao')::integer, 'LIGAR', null, null, elevador, 120, null) from ids, c, dc $$,
  'MP-12: o prazo de aviso muda por item');
select is(pg_temp.item('ELEVADORES') ->> 'situacao', 'VENCE', 'MP-12: com aviso de 120 dias, o mesmo laudo já vence');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'PLANTAS', null, 'LIGAR', null, null, planta, null, null) from ids, c, dc $$,
  'MP-12: liga documento ainda sem arquivo');
select is(pg_temp.item('PLANTAS') ->> 'situacao', 'FALTA', 'MP-12: documento sem arquivo liberado não conta: o item falta');
select is(pg_temp.campos($$ select plataforma_item_prontuario(ana, ipe, null, 'SPDA', null, 'LIGAR', null, null, gen_random_uuid(), null, null) from ids, c $$),
  '["documentoId"]', 'MP-12: só liga documento guardado em Documentos');
select is(pg_temp.campos($$ select plataforma_item_prontuario(ana, ipe, null, 'AGUA', null, 'NAO_SE_APLICA', null, null, null, null, ' ') from ids, c $$),
  '["motivo"]', 'MP-12: não se aplica pede motivo');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'AGUA', null, 'NAO_SE_APLICA', null, null, null, null,
                   'Prédio sem poço; a água vem da Caesb') from ids, c $$, 'MP-12: não se aplica com motivo');
select is(pg_temp.item('AGUA') ->> 'situacao', 'NAO_SE_APLICA', 'MP-12: o item sai da conta e fica na lista com o motivo');
select is(pg_temp.item('AGUA') ->> 'motivo', 'Prédio sem poço; a água vem da Caesb', 'MP-12: o motivo aparece');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, (pg_temp.item('AGUA') ->> 'id')::uuid, null, (pg_temp.item('AGUA') ->> 'versao')::integer,
                   'VALE', null, null, null, null, null) from ids, c $$, 'MP-12: o item pode voltar a valer');
select is(pg_temp.item('AGUA') ->> 'situacao', 'FALTA', 'MP-12: e volta a faltar');
select is(pg_temp.motivo($$ select plataforma_item_prontuario(ana, ipe, null, null, null, 'CRIAR', 'Convenção', 'CONSTITUICAO', null, null, null) from ids, c $$),
  'ITEM_REPETIDO', 'MP-12: item próprio não repete nome de outro item');
create temp table it2 as select (plataforma_item_prontuario(ana, ipe, null, null, null, 'CRIAR', 'Licença do gerador', 'LAUDOS', null, null, null) ->> 'id')::uuid
  as gerador from ids, c;
select is((select jsonb_array_length(plataforma_prontuario(fabio, ipe) -> 'itens') from ids, c), 15, 'MP-12: o síndico cria item próprio');
select is((select x -> 'documento' from ids, c, jsonb_array_elements(plataforma_prontuario(gil, ipe) -> 'itens') x where x ->> 'chave' = 'SPDA'), null,
  'MP-12: item sem documento não mostra documento');
select lives_ok($$ select plataforma_item_prontuario(ana, ipe, null, 'SPDA', null, 'LIGAR', null, null, spda, null, null) from ids, c, dc $$,
  'MP-12: o síndico liga um documento restrito');
select is((select x -> 'documento' from ids, c, jsonb_array_elements(plataforma_prontuario(fabio, ipe) -> 'itens') x where x ->> 'chave' = 'SPDA'),
  '{"restrito": true}'::jsonb, 'CD-04: quem não vê os restritos não vê o título do documento ligado');
select ok(exists (select 1 from historico where entidade = 'itens_prontuario' and acao = 'prontuario.nao_se_aplica'
                  and dados ->> 'motivo' = 'Prédio sem poço; a água vem da Caesb'), 'MP-12: o que se faz no prontuário fica no histórico');
select is((select plataforma_painel(fabio, ipe) -> 'memoria' -> 'prontuario' ->> 'venceu' from ids, c), '1',
  'MP-12: o Início mostra o prontuário vencido');

-- Sino (MP-12).
select verificar_comunicados();
select is((select array_agg(tipo order by tipo) from avisos_memoria where pessoa_id = (select gil from ids)),
  array['PRONTUARIO_VENCE', 'PRONTUARIO_VENCEU'], 'MP-12: quem cuida dos documentos é avisado do vencido e do que vence antes do aviso do documento');
select is((select count(*) from avisos_memoria where pessoa_id = (select fabio from ids)), 0::bigint, 'MP-12: quem só vê não é avisado');
select verificar_comunicados();
select is((select count(*) from avisos_memoria where pessoa_id = (select gil from ids)), 2::bigint, 'MP-12: um aviso por data');
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x
                  where x ->> 'tipo' = 'PRONTUARIO_VENCEU' and x ->> 'titulo' = 'AVCB (Corpo de Bombeiros)'), 'MP-12: o aviso aparece no sino');

-- Linha do tempo e anotações (CT-03).
create temp table mn as select
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Troca da bomba de recalque', 'Casa de bombas', null,
     (select id from prioridades where condominio_id = ipe and modelo = 'ALTA'), v_bruna, null, null, 'HidroPress', null, null, null, null) ->> 'id')::uuid as m1
  from ids, c, vs;
select plataforma_concluir_manutencao(ana, ipe, m1, (select versao from manutencoes where id = m1), 'Bomba trocada e testada pela HidroPress', hoje, true)
  from ids, c, mn, d;
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(ana, ipe, 'MANUTENCAO', null) -> 'eventos') e
                  where e ->> 'titulo' = 'Manutenção concluída: Troca da bomba de recalque'), 'CT-03: manutenção concluída entra sozinha');
select ok(not exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'TUDO', null) -> 'eventos') e
                      where e ->> 'fonte' = 'MANUTENCAO'), 'PT-02: quem não vê a manutenção não a vê na linha do tempo');
create temp table an as select
  (plataforma_salvar_anotacao(ana, ipe, null, null, 'COMBINADO', 'Vizinho do lote 12 divide o muro', 'Cada lado paga metade da pintura.',
     hoje - 8, convencao, null, null) ->> 'id')::uuid as a1
  from ids, c, d, dc;
select throws_ok($$ select plataforma_salvar_anotacao(fabio, ipe, null, null, 'OUTRO', 'Teste', 'Texto de teste', hoje, null, null, null) from ids, c, d $$,
  'TC401', null, 'CF-03: só quem cuida dos documentos anota na memória');
select is(pg_temp.campos($$ select plataforma_salvar_anotacao(ana, ipe, null, null, 'OBRA', 'Pintura', 'Pintura da fachada', hoje + 1, null, null, null)
  from ids, c, d $$), '["aconteceuEm"]', 'CT-03: anota o que já aconteceu');
select is(pg_temp.campos($$ select plataforma_salvar_anotacao(ana, ipe, null, null, 'OBRA', 'Pintura', 'Pintura da fachada', hoje, convencao,
  null, m1) from ids, c, d, dc, mn $$), '["ligacao"]', 'CT-03: liga a uma coisa só');
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'TUDO', null) -> 'eventos') e
                  where e ->> 'fonte' = 'ANOTADO' and e ->> 'titulo' = 'Vizinho do lote 12 divide o muro'), 'CT-03: a anotação entra na linha do tempo')
  from ids, c;
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'DOCUMENTOS', null) -> 'eventos') e
                  where e ->> 'titulo' = 'Documento guardado: Convenção'), 'CT-03: versão de documento entra sozinha');
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'DOCUMENTOS', null) -> 'eventos') e
                  where e ->> 'titulo' = 'AVCB (Corpo de Bombeiros) venceu'), 'CT-03: item do prontuário vencido entra sozinho');
select ok(not exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'TUDO', null) -> 'eventos') e
                      where e ->> 'titulo' like '%SPDA restrito%'), 'PT-02: o documento restrito não aparece a quem não vê os restritos');
select ok(exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'PESSOAS', null) -> 'eventos') e
                  where e ->> 'titulo' = 'Síndica Ana assume a sindicatura'), 'CT-03: a entrada do síndico entra sozinha');
select is((select jsonb_agg(distinct e ->> 'categoria') from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'ANOTADO', null) -> 'eventos') e),
  '["ANOTADO"]'::jsonb, 'CT-03: o filtro mostra só o escolhido');

select lives_ok($$ select plataforma_salvar_anotacao(ana, ipe, a1, pg_temp.va(a1), 'COMBINADO', 'Vizinho do lote 12 divide o muro',
                   'Cada lado paga metade da pintura e dos reparos.', hoje - 8, convencao, null, null) from ids, c, d, dc, an $$,
  'CT-03: corrigir a anotação');
select is((select texto from versoes_anotacao where anotacao_id = (select a1 from an)), 'Cada lado paga metade da pintura.',
  'CT-03: corrigir guarda como estava');
select is((select jsonb_array_length(plataforma_anotacao(fabio, ipe, a1) -> 'versoes') from ids, c, an), 1, 'CT-03: e mostra a versão anterior');
select is(pg_temp.campos($$ select plataforma_retirar_anotacao(ana, ipe, a1, pg_temp.va(a1), '') from ids, c, an $$), '["motivo"]',
  'CT-03: tirar da linha do tempo pede motivo');
select lives_ok($$ select plataforma_retirar_anotacao(ana, ipe, a1, pg_temp.va(a1), 'Anotado em duplicidade') from ids, c, an $$,
  'CT-03: tirar com motivo');
select ok(not exists (select 1 from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(fabio, ipe, 'ANOTADO', null) -> 'eventos') e
                      where (e ->> 'id')::uuid = (select a1 from an)), 'CT-03: a anotação tirada sai da linha do tempo');
select throws_ok($$ delete from anotacoes_memoria $$, 'TC010', null, 'CT-03: anotação não se apaga');
select throws_ok($$ select plataforma_anotacao(davi, jatoba, a1) from ids, c, an $$, 'TC404', null, 'PT-01: um condomínio não vê a memória do outro');

-- Manual do prédio (MP-14).
create temp table sm as select
  (plataforma_salvar_secao_manual(gil, ipe, null, null, 'Água e gás', 'Registros e vazamentos',
     'O registro geral fica na casa de bombas.', true) ->> 'id')::uuid as s1,
  (plataforma_salvar_secao_manual(gil, ipe, null, null, 'Casa de máquinas', null, 'A chave fica com a zeladoria.', null) ->> 'id')::uuid as s2
  from ids, c;
select is((select no_mural from secoes_manual where id = (select s2 from sm)), false, 'MP-14: seção nova começa só para a gestão');
select is(pg_temp.motivo($$ select plataforma_salvar_secao_manual(gil, ipe, null, null, ' água E GÁS ', null, 'Outro texto', null) from ids, c $$),
  'SECAO_REPETIDA', 'MP-14: duas seções não têm o mesmo título');
select lives_ok($$ select plataforma_salvar_secao_manual(ana, ipe, s1, pg_temp.vs(s1), 'Água e gás', 'Registros e vazamentos',
                   'O registro geral fica na casa de bombas, atrás do portão.', true) from ids, c, sm $$, 'MP-14: mudar o texto');
select is((select texto from versoes_secao_manual where secao_id = (select s1 from sm)), 'O registro geral fica na casa de bombas.',
  'MP-14: mudar guarda a versão anterior');
select lives_ok($$ select plataforma_ordem_manual(ana, ipe, array[s2, s1]) from ids, c, sm $$, 'MP-14: mudar a ordem das seções');
select is((select array_agg(titulo order by ordem) from secoes_manual where condominio_id = (select ipe from c)), array['Casa de máquinas', 'Água e gás'],
  'MP-14: a ordem fica como escolhida');
select plataforma_definir_mural_email(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe), true,
  array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], false, null, false, false) from ids, c;
select is((select jsonb_agg(x ->> 'titulo') from configuracao_condominio cfg, jsonb_array_elements(publico_mural(cfg.mural_codigo) -> 'manual') x
            where cfg.condominio_id = (select ipe from c)), '["Água e gás"]'::jsonb,
  'MP-14: o mural mostra só as seções marcadas, sem conta');

-- Dossiê (CT-02).
select throws_ok($$ select plataforma_gerar_dossie(gil, ipe) from ids, c $$, 'TC401', null, 'CT-02: só o síndico gera o dossiê');
create temp table ds as select (plataforma_gerar_dossie(ana, ipe) ->> 'id')::uuid as d1 from ids, c;
select is((select jsonb_array_length(plataforma_dossie(ana, ipe, d1) -> 'conteudo' -> 'acesso') from ids, c, ds), 4,
  'CT-02: o dossiê mostra quem tem acesso hoje');
select ok((select (plataforma_dossie(ana, ipe, d1) -> 'conteudo' -> 'pendencias' -> 'prontuario') @> '[{"item": "AVCB (Corpo de Bombeiros)", "situacao": "VENCEU"}]'
             from ids, c, ds), 'CT-02: o dossiê traz o que falta e o que venceu no prontuário');
select ok(exists (select 1 from historico where acao = 'memoria.dossie_gerado'), 'CT-02: gerar o dossiê fica no histórico');
select throws_ok($$ update dossies set conteudo = '{}' $$, 'TC010', null, 'CT-02: o dossiê fica como foi gerado');

-- Exportação (CT-04).
select throws_ok($$ select plataforma_pedir_exportacao(gil, ipe) from ids, c $$, 'TC401', null, 'CT-04: só o síndico exporta');
create temp table ex as select (plataforma_pedir_exportacao(ana, ipe) ->> 'id')::uuid as e1 from ids, c;
select is((select array_agg(tipo order by numero) from partes_exportacao where exportacao_id = (select e1 from ex)), array['DADOS', 'ARQUIVOS'],
  'CT-04: um pacote de dados e os pacotes de arquivos');
select is(pg_temp.motivo($$ select plataforma_pedir_exportacao(ana, ipe) from ids, c $$), 'EXPORTACAO_MONTANDO', 'CT-04: uma exportação por vez');

-- A api-plataforma monta os pacotes.
create temp table p1 as select exportacao_pegar_parte() as parte;
select is((select parte ->> 'tipo' from p1), 'DADOS', 'CT-04: o primeiro pacote é o dos dados');
select ok((select exportacao_dados((parte ->> 'condominio')::uuid, (parte ->> 'parte')::uuid) -> 'tabelas' ? 'anotacoes_memoria' from p1),
  'CT-04: os dados levam as tabelas do condomínio');
select ok(not (select exportacao_dados((parte ->> 'condominio')::uuid, (parte ->> 'parte')::uuid) -> 'tabelas' ? 'clientes' from p1),
  'CT-04: o que é só da TRÍADE fica fora');
select exportacao_parte_pronta((parte ->> 'condominio')::uuid, (parte ->> 'parte')::uuid, 2400, null) from p1;
create temp table p2 as select exportacao_pegar_parte() as parte;
select exportacao_parte_pronta((parte ->> 'condominio')::uuid, (parte ->> 'parte')::uuid, 9000, null) from p2;
select is((select situacao from exportacoes where id = (select e1 from ex)), 'PRONTA', 'CT-04: com todos os pacotes prontos, a exportação fica pronta');
select ok(exists (select 1 from avisos_memoria where tipo = 'EXPORTACAO_PRONTA' and pessoa_id = (select ana from ids)), 'CT-04: quem pediu é avisado no sino');
select ok((select plataforma_baixar_exportacao(ana, ipe, e1, 1) ->> 'arquivo' like 'triade-%-dados.zip' from ids, c, ex), 'CT-04: baixar o pacote dos dados');
select is(pg_temp.motivo($$ select plataforma_pedir_exportacao(ana, ipe) from ids, c $$), 'EXPORTACAO_RECENTE', 'CT-04: no máximo uma por dia');
select ajustar_relogio('8 days');
select is(pg_temp.motivo($$ select plataforma_baixar_exportacao(ana, ipe, e1, 1) from ids, c, ex $$), 'EXPORTACAO_INDISPONIVEL', 'CT-04: os links valem 7 dias');
select ajustar_relogio('0');
select is((select jsonb_array_length(console_ficha(adm, ipe) -> 'exportacoes') from ids, c), 1, 'CT-04: a TRÍADE vê no Console que houve exportação');

select * from finish();
rollback;

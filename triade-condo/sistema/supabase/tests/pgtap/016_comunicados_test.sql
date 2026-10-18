-- Comunicados e documentos (peça R1; CD-01, CD-02, CD-04, CD-05, CD-06, CD-07, CD-09, CD-11,
-- MP-12): permissões, ciclo do comunicado com versões, público calculado, programar, ligar a
-- pedido e manutenção, plano de comunicação, documentos com versões, restritos, validade e
-- avisos. Cada condomínio só vê os próprios.
begin;
select plan(63);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Carla') as carla,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Administração', array['PUBLICAR', 'ACOMPANHAR']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, carla, 'Carla', 'Conselho', array['ACOMPANHAR']) as v_carla,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_COMUNICADOS']) as v_fabio,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administração', array['DOCUMENTOS']) as v_gil
  from ids, c;

-- Dois blocos, quatro unidades e os contatos.
create temp table bl as select
  (plataforma_salvar_bloco(ana, ipe, null, null, 'A', 1, true) ->> 'id')::uuid as ba,
  (plataforma_salvar_bloco(ana, ipe, null, null, 'B', 2, true) ->> 'id')::uuid as bb
  from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]'),
       plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "201"}, {"identificacao": "202"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201,
  (select id from unidades where identificacao = '202') as u202;
create temp table ct0 as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marina Souza', '+5561999990001',
    '{"proprietario": true, "principal": true, "mora": true}', true) as marina,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Roberto Dias', '+5561977771212',
    '{"proprietario": true, "mora": false}', false) as roberto,
  plataforma_incluir_pessoa_unidade(ana, ipe, u201, null, 'Teresa Alves', '+5561966665555',
    '{"proprietario": true, "principal": true, "mora": true}', true) as teresa
  from ids, c, u;
create temp table ct as select ct0.*,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Joana Lima', '+5561988887777',
    '{"principal": true, "mora": true, "ligacao": "INQUILINO"}', true) as joana
  from ct0, ids, c, u;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from comunicados where id = p $$;
create function pg_temp.vd(p uuid) returns integer language sql as $$ select versao from documentos where id = p $$;
create function pg_temp.escrever(p_pessoa uuid, p_titulo text, p_acao text default 'RASCUNHO', p_publico text default 'TODOS',
                                 p_blocos uuid[] default '{}', p_quando timestamptz default null, p_pedido uuid default null,
                                 p_assunto text default 'OBRAS') returns uuid
language sql as $$
  select (plataforma_salvar_comunicado(p_pessoa, (select ipe from c), null, null, p_assunto, p_titulo,
          'A água será desligada das 9h às 13h para a troca da bomba.', p_publico, p_blocos, '{}', '{}', p_pedido, null,
          p_acao, p_quando) ->> 'id')::uuid $$;

-- Permissões (CF-03).
select throws_ok($$ select plataforma_comunicados(carla, ipe, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'CD-01: quem não tem a permissão de ver comunicados não os vê');
select lives_ok($$ select plataforma_comunicados(fabio, ipe, null, null, null, null, 1) from ids, c $$,
  'CD-01: Ver comunicados e documentos deixa ver');
select throws_ok($$ select pg_temp.escrever(fabio, 'Falta de água') from ids $$, 'TC401', null,
  'CD-01: só quem pode publicar escreve comunicados');
select throws_ok($$ select plataforma_comunicados(davi, ipe, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'PT-01: o síndico de outro condomínio não vê estes comunicados');

-- Para quem (CD-02).
select is((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'TODOS', null, null, null) ->> 'contatos' from ids, c), '3',
  'CD-02: recebe quem tem vínculo e "recebe comunicados" ligado');
select is((select plataforma_publico_comunicado(ana, ipe, 'ASSEMBLEIA', 'TODOS', null, null, null) ->> 'contatos' from ids, c), '4',
  'CD-02: assembleia e convocação chega também ao proprietário que não recebe o dia a dia');
select is((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'BLOCOS', array[bb], null, null) ->> 'contatos' from ids, c, bl), '1',
  'CD-02: por bloco, só quem é do bloco');
select is((select jsonb_path_query_array(plataforma_publico_comunicado(ana, ipe, 'AVISO', 'BLOCOS', array[bb], null, null),
            '$.semNinguem[*].nome') from ids, c, bl), '["B · 202"]'::jsonb,
  'CD-02: mostra as unidades que ficam sem ninguém');
select is((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'UNIDADES', null, array[u102], null) ->> 'contatos' from ids, c, u), '1',
  'CD-02: por unidade');
select is((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'CONTATOS', null, null,
            array[(select contato_id from contatos_unidade where id = (joana ->> 'vinculoId')::uuid)]) ->> 'contatos' from ids, c, ct), '1',
  'CD-02: por contatos escolhidos');
select ok((select plataforma_publico_comunicado(ana, ipe, 'AVISO', 'TODOS', null, null, null) ? 'quem' from ids, c),
  'CD-02: quem vê os moradores vê os nomes de quem recebe');
select ok((select not (plataforma_publico_comunicado(fabio, ipe, 'AVISO', 'TODOS', null, null, null) ? 'quem') from ids, c),
  'PT-13: quem não vê os moradores vê só a conta');

-- Escrever e publicar (CD-01).
select is(pg_temp.campos($$ select pg_temp.escrever(ana, 'Fa') from ids $$), '["titulo"]'::jsonb, 'CD-01: título de 3 a 120 caracteres');
select is(pg_temp.campos($$ select pg_temp.escrever(ana, 'Falta de água', 'RASCUNHO', 'BLOCOS') from ids $$), '["blocos"]'::jsonb,
  'CD-02: por bloco pede os blocos');
select is(pg_temp.campos($$ select plataforma_salvar_comunicado(davi, jatoba, null, null, 'AVISO', 'Aviso', 'Texto do aviso', 'BLOCOS',
  array[ba], '{}', '{}', null, null, 'RASCUNHO', null) from ids, c, bl $$), '["blocos"]'::jsonb,
  'PT-01: só blocos do mesmo condomínio');
create temp table cm as select pg_temp.escrever(bruna, 'Falta de água na quinta') as agua from ids;
select is((select estado || '/' || numero from comunicados, cm where id = agua), 'RASCUNHO/1', 'CD-01: nasce rascunho, versão 1');
select plataforma_salvar_comunicado(bruna, ipe, agua, pg_temp.vc(agua), 'OBRAS', 'Falta de água na quinta, das 9h às 12h',
  'A água será desligada das 9h às 12h para a troca da bomba.', 'TODOS', '{}', '{}', '{}', null, null, 'PUBLICAR', null) from ids, c, cm;
select is((select estado || '/' || destinatarios || '/' || (publicado_por = bruna) from comunicados, cm, ids where id = agua),
  'PUBLICADO/3/true', 'CD-01: publicado guarda quem publicou e quantos recebiam');
select is(pg_temp.motivo($$ select plataforma_salvar_comunicado(bruna, ipe, agua, pg_temp.vc(agua), 'OBRAS', 'Outro título', 'Outro texto',
  'TODOS', '{}', '{}', '{}', null, null, 'RASCUNHO', null) from ids, c, cm $$), 'COMUNICADO_PUBLICADO',
  'CD-01: publicado não se edita pela tela');
select throws_ok($$ update comunicados set texto = 'Mudado por fora' from cm where id = agua $$, 'TC422', null,
  'CD-01: publicado não se edita nem por fora');
select throws_ok($$ delete from comunicados $$, 'TC010', null, 'CD-01: comunicado não se apaga');

-- Corrigir (CD-01).
select is(pg_temp.campos($$ select plataforma_corrigir_comunicado(bruna, ipe, agua, pg_temp.vc(agua), 'Falta de água na quinta, das 9h às 13h',
  'A água será desligada das 9h às 13h.', '') from ids, c, cm $$), '["mudanca"]'::jsonb, 'CD-01: corrigir pede o que mudou');
create temp table cm2 as select (plataforma_corrigir_comunicado(bruna, ipe, agua, pg_temp.vc(agua), 'Falta de água na quinta, das 9h às 13h',
  'A água será desligada das 9h às 13h.', 'Corrigido o horário: termina às 13h') ->> 'id')::uuid as agua2 from ids, c, cm;
select is((select estado from comunicados, cm where id = agua), 'SUBSTITUIDO', 'CD-01: a versão anterior fica como substituída');
select is((select texto from comunicados, cm where id = agua), 'A água será desligada das 9h às 12h para a troca da bomba.',
  'CD-01: com o texto guardado');
select is((select estado || '/' || numero || '/' || (familia_id = agua) from comunicados, cm, cm2 where id = agua2), 'PUBLICADO/2/true',
  'CD-01: a correção é a versão 2, já publicada');
select is((select jsonb_array_length(plataforma_comunicado(fabio, ipe, agua2) -> 'versoes') from ids, c, cm2), 2,
  'CD-01: o comunicado mostra as versões');
select is((select (plataforma_comunicados(fabio, ipe, null, null, null, null, 1) ->> 'total')::integer from ids, c), 1,
  'CD-01: em uso, só a versão em vigor');

-- Como chega ao morador agora.
select plataforma_uso_comunicado(fabio, ipe, agua2, 'COPIADO') from ids, c, cm2;
select is((select count(*)::integer from historico, cm where entidade = 'comunicados' and entidade_id = agua::text and acao = 'comunicado.copiado'), 1,
  'CD-01: copiar o texto fica no histórico');
select is(pg_temp.motivo($$ select plataforma_uso_comunicado(fabio, ipe, agua, 'MURAL') from ids, c, cm $$), 'COMUNICADO_NAO_PUBLICADO',
  'CD-01: a versão substituída não vai mais para o mural');

-- Arquivar (CD-01).
select is(pg_temp.campos($$ select plataforma_arquivar_comunicado(bruna, ipe, agua2, pg_temp.vc(agua2), '') from ids, c, cm2 $$),
  '["motivo"]'::jsonb, 'CD-01: arquivar pede motivo');
select plataforma_arquivar_comunicado(bruna, ipe, agua2, pg_temp.vc(agua2), 'Obra já feita') from ids, c, cm2;
select is((select estado from comunicados, cm2 where id = agua2), 'ARQUIVADO', 'CD-01: arquivado sai da lista em uso');
select is(pg_temp.motivo($$ select plataforma_arquivar_comunicado(bruna, ipe, agua2, pg_temp.vc(agua2), 'De novo') from ids, c, cm2 $$),
  'COMUNICADO_FORA_DE_USO', 'CD-01: arquivado não volta');

-- Programar (CD-06).
select is(pg_temp.campos($$ select pg_temp.escrever(bruna, 'Lavagem da garagem', 'PROGRAMAR', 'TODOS', '{}', app_now() - interval '1 hour') from ids $$),
  '["programadoPara"]'::jsonb, 'CD-06: não se programa para o passado');
create temp table pg as select pg_temp.escrever(bruna, 'Lavagem da garagem', 'PROGRAMAR', 'BLOCOS', array[bb], app_now() + interval '10 minutes')
  as lavagem from ids, bl;
select is((select (plataforma_painel(ana, ipe) -> 'comunicados' ->> 'programadosHoje')::integer from ids, c), 1,
  'CD-06: o início mostra o programado para hoje');
select limpar_contexto();
select verificar_comunicados();
select is((select estado from comunicados, pg where id = lavagem), 'PROGRAMADO', 'CD-06: antes da hora, continua programado');
select ajustar_relogio('15 minutes');
select limpar_contexto();
select ok(verificar_comunicados() >= 1, 'CD-06: a rotina publica na hora marcada');
select is((select estado || '/' || (publicado_por = bruna) || '/' || destinatarios from comunicados, pg, ids where id = lavagem),
  'PUBLICADO/true/1', 'CD-06: publicado em nome de quem programou, com a conta do bloco');

-- Ligar a pedido (CD-05).
select plataforma_registrar_pedido(ana, ipe, null, null, 'Casa de bombas', (select id from categorias where condominio_id = ipe limit 1),
  (select id from prioridades where condominio_id = ipe and modelo = 'ALTA'), 'Sem água no 102', 'Torneira seca', 'TELEFONE', false, null)
  from ids, c;
create temp table ped as select (select id from pedidos where condominio_id = ipe) as pedido from c;
select is(pg_temp.campos($$ select plataforma_salvar_comunicado(davi, jatoba, null, null, 'AVISO', 'Aviso', 'Texto do aviso', 'TODOS',
  '{}', '{}', '{}', pedido, null, 'RASCUNHO', null) from ids, c, ped $$), '["pedidoId"]'::jsonb, 'CD-05: só pedido do mesmo condomínio');
create temp table lig as select pg_temp.escrever(ana, 'Água volta às 13h', 'PUBLICAR', 'TODOS', '{}', null, pedido) as aviso from ids, ped;
select is((select plataforma_comunicados_ligados(bruna, ipe, pedido, null) -> 'comunicados' -> 0 ->> 'id' from ids, c, ped), (select aviso::text from lig),
  'CD-05: o pedido mostra o comunicado ligado');
select is((select count(*)::integer from historico, ped where entidade = 'pedidos' and entidade_id = pedido::text and acao = 'pedido.comunicado_ligado'), 1,
  'CD-05: o pedido registra a ligação no histórico');
select is((select count(*)::integer from historico, ped where entidade = 'pedidos' and entidade_id = pedido::text and acao like 'pedido.retorno%'), 0,
  'AT-06: comunicar o prédio não conta como retorno ao morador do pedido');

-- Fotos e PDF (CD-09).
create temp table rs as select pg_temp.escrever(ana, 'Dedetização das áreas comuns') as dedet from ids;
select plataforma_iniciar_arquivo_comunicado(ana, ipe, dedet, 'foto' || n || '.jpg', 'image/jpeg', 1000) from ids, c, rs, generate_series(1, 4) n;
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_comunicado(ana, ipe, dedet, 'foto5.jpg', 'image/jpeg', 1000) from ids, c, rs $$),
  'LIMITE_ARQUIVOS_COMUNICADO', 'CD-09: até 4 arquivos por comunicado');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_comunicado(ana, ipe, aviso, 'foto.jpg', 'image/jpeg', 1000) from ids, c, lig $$),
  'COMUNICADO_PUBLICADO', 'CD-09: fotos entram antes de publicar');

-- Plano de comunicação (CD-11).
select is(pg_temp.campos($$ select plataforma_definir_plano_comunicacao(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe),
  '{}', null, 'Ana, síndica', '21:00', '08:00') from ids, c $$), '["assuntos"]'::jsonb, 'CD-11: pelo menos um assunto em uso');
select throws_ok($$ select plataforma_definir_plano_comunicacao(bruna, ipe, 1, array['AVISO'], null, 'Bruna', '21:00', '08:00') from ids, c $$,
  'TC401', null, 'CD-11: o plano fica com quem configura');
select plataforma_definir_plano_comunicacao(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe),
  array['AVISO', 'OBRAS', 'ASSEMBLEIA'], 'Avisos de obra com 2 dias de antecedência.', 'Ana, síndica do Residencial Ipê', '21:00', '08:00')
  from ids, c;
select is(pg_temp.campos($$ select pg_temp.escrever(ana, 'Portaria nova', 'RASCUNHO', 'TODOS', '{}', null, null, 'SEGURANCA') from ids $$),
  '["assunto"]'::jsonb, 'CD-11: só assuntos em uso');
create temp table ass as select pg_temp.escrever(ana, 'Reunião do conselho', 'PUBLICAR', 'TODOS', '{}', null, null, 'AVISO') as reuniao from ids;
select is((select assinatura from comunicados, ass where id = reuniao), 'Ana, síndica do Residencial Ipê',
  'CD-11: o publicado guarda a assinatura padrão');

-- Documentos (CD-07, CD-04).
create temp table dc as select
  (plataforma_salvar_documento(ana, ipe, null, null, 'REGIMENTO', 'Regimento interno', null, false, true, null) ->> 'id')::uuid as regimento,
  (plataforma_salvar_documento(gil, ipe, null, null, 'LAUDO', 'AVCB', 'Auto de vistoria do Corpo de Bombeiros', true, false,
     (app_now() at time zone 'America/Sao_Paulo')::date + 40) ->> 'id')::uuid as avcb
  from ids, c;
select throws_ok($$ select plataforma_salvar_documento(fabio, ipe, null, null, 'ATA', 'Ata da AGO', null, false, true, null) from ids, c $$,
  'TC401', null, 'CD-07: só quem cuida dos documentos guarda documento');
select is(pg_temp.campos($$ select plataforma_salvar_documento(ana, ipe, null, null, 'CONTRATO', 'Contrato do elevador', null, true, true, null)
  from ids, c $$), '["aoMorador"]'::jsonb, 'CD-04: documento só da gestão não vai ao morador');
select throws_ok($$ select plataforma_documento(fabio, ipe, avcb) from ids, c, dc $$, 'TC404', null,
  'CD-04: o documento restrito não aparece a quem só vê');
select is((select jsonb_array_length(plataforma_documentos(fabio, ipe, null, null) -> 'itens') from ids, c), 1,
  'CD-04: nem na lista');
select lives_ok($$ select plataforma_documento(gil, ipe, avcb) from ids, c, dc $$, 'CD-04: quem cuida dos documentos vê o restrito');
select throws_ok($$ select plataforma_documento(davi, jatoba, regimento) from ids, c, dc $$, 'TC404', null,
  'PT-01: o documento de outro condomínio não existe para o Davi');

-- Versões (CD-07).
create temp table v1 as select (plataforma_iniciar_versao_documento(ana, ipe, regimento, 'regimento-v1.pdf', 'application/pdf', 2000, null,
  '2025-04-12', 'AGE de 05/04/2025') ->> 'versaoId')::uuid as ver1 from ids, c, dc;
select plataforma_verificar_versao_documento(ana, ipe, regimento, ver1, true, 1990, null) from ids, c, dc, v1;
select is((select plataforma_documento(fabio, ipe, regimento) -> 'documento' -> 'emVigor' ->> 'numero' from ids, c, dc), '1',
  'CD-07: a primeira versão liberada fica em vigor');
select is(pg_temp.campos($$ select plataforma_iniciar_versao_documento(ana, ipe, regimento, 'regimento-v2.pdf', 'application/pdf', 2000, null,
  (app_now() at time zone 'America/Sao_Paulo')::date + 10, null) from ids, c, dc $$), '["mudanca"]'::jsonb,
  'CD-07: a versão seguinte diz o que mudou');
select is(pg_temp.motivo($$ select plataforma_iniciar_versao_documento(ana, ipe, regimento, 'grande.pdf', 'application/pdf', 20971521, 'Tudo',
  '2026-01-01', null) from ids, c, dc $$), 'DOCUMENTO_GRANDE', 'CD-07: até 20 MB');
create temp table v2 as select (plataforma_iniciar_versao_documento(ana, ipe, regimento, 'regimento-v2.pdf', 'application/pdf', 2000,
  'Regras para carregadores de carro elétrico', (app_now() at time zone 'America/Sao_Paulo')::date + 10, 'AGE de 18/10/2026') ->> 'versaoId')::uuid
  as ver2 from ids, c, dc;
select plataforma_verificar_versao_documento(ana, ipe, regimento, ver2, true, 1990, null) from ids, c, dc, v2;
select is((select plataforma_documento(fabio, ipe, regimento) -> 'documento' -> 'emVigor' ->> 'numero' from ids, c, dc), '1',
  'CD-07: a versão nova só vale na data dela; até lá, a anterior continua em vigor');
select is((select plataforma_documento(fabio, ipe, regimento) -> 'documento' -> 'proxima' ->> 'numero' from ids, c, dc), '2',
  'CD-07: e a próxima aparece');
select throws_ok($$ update versoes_documento set mudanca = 'Outra coisa' from v2 where id = ver2 $$, 'TC422', null,
  'CD-07: a versão guardada não muda');
select plataforma_abrir_versao_documento(fabio, ipe, regimento, ver1, true) from ids, c, dc, v1;
select is((select count(*)::integer from historico, dc where entidade = 'documentos' and entidade_id = regimento::text and acao = 'documento.baixado'), 1,
  'CD-04: cada download fica no histórico do documento');

-- Validade (MP-12).
select limpar_contexto();
select verificar_comunicados();
select is((select array_agg(p.nome order by p.nome) from avisos_documento a join pessoas p on p.id = a.pessoa_id, dc where documento_id = avcb),
  array['Gil', 'Síndica Ana'], 'MP-12: a 60 dias do fim, avisa quem cuida dos documentos');
select limpar_contexto();
select verificar_comunicados();
select is((select count(*)::integer from avisos_documento, dc where documento_id = avcb), 2, 'MP-12: uma vez só');
select is((select (plataforma_avisos(gil, ipe) -> 'itens' -> 0 ->> 'tipo') from ids, c), 'DOCUMENTO_VENCENDO', 'MP-12: o aviso aparece no sino');
select is((select (plataforma_painel(fabio, ipe) -> 'comunicados' ->> 'documentosVencendo')::integer from ids, c), 0,
  'MP-12: o início de quem não vê o restrito não o conta');

select * from finish();
rollback;

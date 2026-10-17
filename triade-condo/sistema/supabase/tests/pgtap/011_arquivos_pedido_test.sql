-- Passo 4b (F4.8): fotos e documentos dos pedidos. Quem envia e quem vê (CF-03, AT-32,
-- PT-01), tipo e tamanho conferidos antes do envio (PT-07), arquivo só abre depois de
-- verificado, limite por pedido, arquivos da conclusão (AT-13) e tirar do pedido sem apagar,
-- com histórico (AT-17, PT-11).
begin;
select plan(37);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as sindica,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Carla') as carla,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(sindica, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(sindica, ipe, bruna, 'Bruna', 'Secretária', array['RESPONDER']) as v_bruna,
  plataforma_autorizar_pessoa(sindica, ipe, carla, 'Carla', 'Conselho', array['ACOMPANHAR']) as v_carla,
  plataforma_autorizar_pessoa(sindica, ipe, edu, 'Edu', 'Zelador', array['ATUALIZAR']) as v_edu
  from ids, c;
select plataforma_definir_atendimento(sindica, ipe, cc.versao,
         jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_bruna, 'disponivel', true)),
         v_bruna)
  from ids, c, vs, configuracao_condominio cc where cc.condominio_id = ipe;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO') as concluido
  from c;
create temp table p as select
  (plataforma_registrar_pedido(sindica, ipe, null, null, 'Banheiro do salão', manutencao, normal, 'Vazamento no banheiro',
     'Mancha de água no teto do banheiro do salão.', 'OBSERVACAO', false, null) ->> 'id')::uuid as p1,
  (plataforma_registrar_pedido(sindica, ipe, null, null, 'Portão da garagem', manutencao, normal, 'Portão não fecha',
     'O portão da garagem ficou aberto.', 'OBSERVACAO', false, v_ana) ->> 'id')::uuid as p2,
  (plataforma_registrar_pedido(sindica, ipe, null, null, 'Sala da administração', manutencao, normal, 'Reclamação reservada',
     'Assunto reservado à síndica.', 'PRESENCIAL', true, v_ana) ->> 'id')::uuid as p3
  from ids, c, cfg, vs;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.v(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;

-- Quem envia (CF-03) e o que é conferido antes do envio (PT-07).
create temp table a as select
  plataforma_iniciar_arquivo(bruna, ipe, p1, 'RELATO', 'teto-banheiro.jpg', 'Mancha no teto', 'image/jpeg', 2100000) as r1
  from ids, c, p;
alter table a add column a1 uuid;
update a set a1 = (r1 ->> 'arquivoId')::uuid;
select is((select r1 ->> 'caminho' from a), (select ipe || '/' || p1 || '/' || a1 from c, p, a),
  'PT-07: o caminho é condomínio/pedido/arquivo, sem o nome dado pela pessoa');
select is((select situacao from arquivos_pedido, a where id = a1), 'ENVIANDO', 'o arquivo nasce esperando a verificação');
select throws_ok($$ select plataforma_iniciar_arquivo(carla, ipe, p1, 'RELATO', 'x.jpg', null, 'image/jpeg', 100) from ids, c, p $$,
  'TC401', null, 'CF-03: quem só acompanha não envia');
select throws_ok($$ select plataforma_iniciar_arquivo(davi, ipe, p1, 'RELATO', 'x.jpg', null, 'image/jpeg', 100) from ids, c, p $$,
  'TC401', null, 'PT-01: síndico de outro condomínio não envia');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo(bruna, ipe, p1, 'RELATO', 'video.mov', null, 'video/quicktime', 100) from ids, c, p $$),
  'TIPO_NAO_ACEITO', 'PT-07: só fotos e PDF');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo(bruna, ipe, p1, 'RELATO', 'planta.pdf', null, 'application/pdf', 14200000) from ids, c, p $$),
  'ARQUIVO_GRANDE', 'PT-07: até 10 MB');
select is(pg_temp.campos($$ select plataforma_iniciar_arquivo(bruna, ipe, p1, 'OUTRA', 'x.jpg', null, 'image/jpeg', 100) from ids, c, p $$),
  '["parte"]', 'a parte do pedido é conferida');
select is(pg_temp.campos($$ select plataforma_iniciar_arquivo(bruna, ipe, p1, 'RELATO', '  ', null, 'image/jpeg', 100) from ids, c, p $$),
  '["nome"]', 'o nome é obrigatório');

-- Quem vê: a lista segue o pedido, e o arquivo só abre depois de verificado.
select is((select jsonb_array_length(plataforma_arquivos_pedido(carla, ipe, p1) -> 'arquivos') from ids, c, p), 1,
  'quem acompanha vê os arquivos do pedido');
select is((select plataforma_arquivos_pedido(carla, ipe, p1) #>> '{arquivos,0,situacao}' from ids, c, p), 'ENVIANDO',
  'e vê que ainda está sendo verificado');
select is((select plataforma_arquivos_pedido(carla, ipe, p1) -> 'pode' ->> 'enviar' from ids, c, p), 'false',
  'quem só acompanha não tem o botão de enviar');
select is((select plataforma_arquivos_pedido(bruna, ipe, p1) -> 'pode' ->> 'enviar' from ids, c, p), 'true',
  'quem dá retorno tem');
select is(pg_temp.motivo($$ select plataforma_abrir_arquivo(carla, ipe, p1, a1) from ids, c, p, a $$),
  'ARQUIVO_NAO_LIBERADO', 'PT-07: arquivo não verificado não abre');
select throws_ok($$ select plataforma_verificar_arquivo(sindica, ipe, p1, a1, true, 1500000, null) from ids, c, p, a $$,
  'TC404', null, 'só quem enviou fecha a verificação do próprio envio');
select throws_ok($$ select plataforma_arquivos_pedido(davi, ipe, p1) from ids, c, p $$, 'TC401', null,
  'PT-01: outro condomínio não vê os arquivos');
select throws_ok($$ select plataforma_arquivos_pedido(carla, ipe, p3) from ids, c, p $$, 'TC404', null,
  'AT-32: arquivo de pedido privado segue o pedido');

-- Verificação.
select is((select plataforma_arquivo_a_verificar(bruna, ipe, p1, a1) ->> 'tipo' from ids, c, p, a), 'image/jpeg',
  'a API recebe o que precisa para verificar');
select is((select plataforma_verificar_arquivo(bruna, ipe, p1, a1, true, 1500000, null) ->> 'situacao' from ids, c, p, a), 'LIBERADO',
  'verificado, o arquivo é liberado');
select is((select tamanho from arquivos_pedido, a where id = a1), 1500000, 'com o tamanho que ficou depois de tirar a localização');
select is(pg_temp.motivo($$ select plataforma_verificar_arquivo(bruna, ipe, p1, a1, false, null, 'Outro') from ids, c, p, a $$),
  'JA_VERIFICADO', 'a verificação não se refaz');
select is((select plataforma_abrir_arquivo(carla, ipe, p1, a1) ->> 'caminho' from ids, c, p, a), (select r1 ->> 'caminho' from a),
  'PT-07: liberado, abre para quem vê o pedido');
select is((select h.dados ->> 'arquivoNome' from historico h, p where h.entidade_id = p1::text and h.acao = 'pedido.arquivo_enviado'),
  'teto-banheiro.jpg', 'AT-17: o envio vai para o histórico');

alter table a add column a2 uuid;
update a set a2 = (plataforma_iniciar_arquivo(bruna, ipe, p1, 'ANDAMENTO', 'fatura.pdf', null, 'application/pdf', 5000) ->> 'arquivoId')::uuid
  from ids, c, p;
select plataforma_verificar_arquivo(bruna, ipe, p1, a2, false, null, 'O conteúdo não é um PDF de verdade') from ids, c, p, a;
select is((select situacao || ' · ' || motivo_recusa from arquivos_pedido, a where id = a2),
  'NAO_LIBERADO · O conteúdo não é um PDF de verdade', 'PT-07: o que não passa fica não liberado, com o motivo');
select is((select count(*)::int from historico h, p where h.entidade_id = p1::text and h.acao = 'pedido.arquivo_recusado'), 1,
  'a recusa vai para o histórico');

-- Tirar do pedido (AT-17, PT-11).
select throws_ok($$ select plataforma_tirar_arquivo(carla, ipe, p1, a2, 'Arquivo errado') from ids, c, p, a $$, 'TC401', null,
  'quem só acompanha não tira arquivo');
select is((select plataforma_arquivos_pedido(edu, ipe, p1) #>> '{arquivos,1,podeTirar}' from ids, c, p), 'true',
  'quem atualiza pode tirar qualquer arquivo');
select is(pg_temp.campos($$ select plataforma_tirar_arquivo(bruna, ipe, p1, a2, ' ') from ids, c, p, a $$), '["motivo"]',
  'tirar pede motivo');
select lives_ok($$ select plataforma_tirar_arquivo(bruna, ipe, p1, a2, 'Arquivo errado') from ids, c, p, a $$,
  'quem enviou tira o próprio arquivo');
select is((select jsonb_array_length(plataforma_arquivos_pedido(sindica, ipe, p1) -> 'arquivos') from ids, c, p), 1,
  'o arquivo tirado sai da lista de todos');
select is((select motivo_retirada from arquivos_pedido, a where id = a2), 'Arquivo errado', 'PT-11: e não é apagado');
select is((select h.dados ->> 'motivo' from historico h, p where h.entidade_id = p1::text and h.acao = 'pedido.arquivo_tirado'),
  'Arquivo errado', 'AT-17: tirar vai para o histórico, com o motivo');
select throws_ok($$ delete from arquivos_pedido $$, null, null, 'nada se apaga');
select throws_ok($$ update arquivos_pedido set nome = 'outro.jpg' from a where id = a1 $$, 'TC422', null,
  'o arquivo não muda depois de enviado');

-- Limite por pedido.
select plataforma_iniciar_arquivo(sindica, ipe, p1, 'ANDAMENTO', 'foto-' || n || '.jpg', null, 'image/jpeg', 1000)
  from ids, c, p, generate_series(1, 29) n;
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo(sindica, ipe, p1, 'ANDAMENTO', 'mais.jpg', null, 'image/jpeg', 1000) from ids, c, p $$),
  'LIMITE_ARQUIVOS', 'até 30 arquivos por pedido');

-- Conclusão (AT-13): quem concluiu junta arquivos à própria conclusão.
select plataforma_concluir_pedido(sindica, ipe, p2, pg_temp.v(p2), concluido, 'Trocamos o motor do portão.', null) from ids, c, p, cfg;
alter table a add column a3 uuid;
update a set a3 = (plataforma_iniciar_arquivo(sindica, ipe, p2, 'CONCLUSAO', 'depois-portao.jpg', null, 'image/jpeg', 900) ->> 'arquivoId')::uuid
  from ids, c, p;
select is((select conclusao_id from arquivos_pedido, a where id = a3), (select id from conclusoes_pedido, p where pedido_id = p2),
  'AT-13: o arquivo fica ligado à conclusão');
select throws_ok($$ select plataforma_iniciar_arquivo(edu, ipe, p2, 'CONCLUSAO', 'x.jpg', null, 'image/jpeg', 900) from ids, c, p $$,
  'TC401', null, 'só quem concluiu junta arquivos à conclusão');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo(sindica, ipe, p2, 'ANDAMENTO', 'x.jpg', null, 'image/jpeg', 900) from ids, c, p $$),
  'PEDIDO_ENCERRADO', 'pedido encerrado não recebe arquivo de andamento');

select * from finish();
rollback;

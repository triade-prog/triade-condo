-- Passo 4 (F4): pedidos no painel da Plataforma do síndico. Registro com protocolo (AT-01),
-- fila com filtros (AT-02), responsável que aceita (AT-03, AT-12), próximo retorno e previsão
-- (AT-06, AT-07), pendências (AT-11), conclusão, revisão, reabertura e cancelamento (AT-13,
-- AT-14, AT-15, AT-31), histórico e pedido privado (AT-17, AT-32), edição simultânea (AT-24)
-- e o responsável que sai da lista de quem atende (CF-05).
begin;
select plan(107);

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
  plataforma_autorizar_pessoa(sindica, ipe, edu, 'Edu', 'Zelador', array['ATUALIZAR', 'CONCLUIR']) as v_edu
  from ids, c;
select plataforma_definir_atendimento(sindica, ipe, cc.versao,
         jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_bruna, 'disponivel', true)),
         v_bruna)
  from ids, c, vs, configuracao_condominio cc where cc.condominio_id = ipe;

-- Unidades e contato confirmado.
select plataforma_incluir_unidades(sindica, ipe, null, '[{"identificacao": "101"}, {"identificacao": "102"}]') from ids, c;
create temp table un as select
  (select id from unidades where condominio_id = ipe and identificacao = '101') as u101,
  (select id from unidades where condominio_id = ipe and identificacao = '102') as u102
  from c;
create temp table ct as select
  (plataforma_incluir_contato(sindica, ipe, u101, null, 'Marta', '+5561999990001', 'MORADOR', true, true) ->> 'contatoId')::uuid as marta
  from ids, c, un;

-- Configuração que veio do cenário.
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from categorias where condominio_id = ipe and modelo = 'LIMPEZA') as limpeza,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from prioridades where condominio_id = ipe and modelo = 'URGENTE') as urgente,
  (select id from etapas where condominio_id = ipe and modelo = 'RECEBIDO') as recebido,
  (select id from etapas where condominio_id = ipe and modelo = 'EM_ANALISE') as em_analise,
  (select id from etapas where condominio_id = ipe and modelo = 'AGUARDANDO_MORADOR') as aguardando_morador,
  (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO') as concluido,
  (select id from etapas where condominio_id = ipe and modelo = 'NAO_PROCEDE') as nao_procede
  from c;

create function pg_temp.hoje() returns date language sql as $$ select (app_now() at time zone 'America/Sao_Paulo')::date $$;
create function pg_temp.v(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;

-- Permissão (PT-02, CF-03).
select ok((select plataforma_painel(sindica, ipe) -> 'acoes'
             ?& array['pedidos.ver', 'pedidos.responder', 'pedidos.atualizar', 'pedidos.concluir', 'pedidos.revisar'] from ids, c),
  'o síndico cuida dos pedidos');
select ok((select (plataforma_pessoas(sindica, ipe) -> 'permissoesDisponiveis') @> '[{"codigo": "ACOMPANHAR"}, {"codigo": "RESPONDER"}, {"codigo": "ATUALIZAR"}, {"codigo": "CONCLUIR"}]'
             from ids, c), 'CF-03: as permissões dos pedidos passam a poder ser dadas');
select lives_ok($$ select plataforma_pedidos(carla, ipe, null, null, null, null, null, null, null) from ids, c $$,
  'CF-03: quem acompanha vê a fila');
select throws_ok($$ select plataforma_registrar_pedido(carla, ipe, u101, null, null, manutencao, normal, 'Teste', 'Teste', 'TELEFONE', false, null)
                    from ids, c, un, cfg $$, 'TC401', null, 'CF-03: acompanhar não registra');
select throws_ok($$ select plataforma_pedidos(davi, ipe, null, null, null, null, null, null, null) from ids, c $$, 'TC401', null,
  'PT-01: síndico de outro condomínio não vê a fila');

-- Registro (AT-01).
create temp table p as select
  plataforma_registrar_pedido(sindica, ipe, u101, marta, null, manutencao, normal, 'Vazamento no banheiro',
    'A moradora ligou: mancha de água no teto do banheiro.', 'TELEFONE', false, null) as r1
  from ids, c, un, ct, cfg;
alter table p add column p1 uuid;
update p set p1 = (r1 ->> 'id')::uuid;
select is((select r1 ->> 'protocolo' from p),
  to_char((select app_now() at time zone 'America/Sao_Paulo'), 'YYYY') || '-0001', 'AT-01: protocolo do condomínio por ano');
select is((select estado from pedidos, p where id = p1), 'ABERTO', 'o pedido nasce aberto');
select is((select etapa_id from pedidos, p where id = p1), (select recebido from cfg), 'na primeira etapa de aberto');
select is((select responsavel_id from pedidos, p where id = p1), (select v_bruna from vs), 'AT-03: vai para o responsável padrão da fila');
select is((select aceito_em from pedidos, p where id = p1), null, 'AT-03: e espera o aceite dela');
select is((select proximo_retorno from pedidos, p where id = p1), app_now() + interval '24 hours',
  'AT-06: o próximo retorno segue o prazo (sem horário de atendimento, horas corridas)');
select is((select previsao from pedidos, p where id = p1), null, 'AT-07: sem previsão inventada');

alter table p add column p2 uuid, add column p3 uuid;
update p set p2 = (plataforma_registrar_pedido(sindica, ipe, null, null, 'Portão da garagem', manutencao, urgente, 'Portão não fecha',
  'O portão da garagem ficou aberto.', 'OBSERVACAO', false, v_ana) ->> 'id')::uuid from ids, c, cfg, vs;
update p set p3 = (plataforma_registrar_pedido(edu, ipe, u102, null, null, limpeza, normal, 'Lixo no corredor',
  'Sacos de lixo no corredor do 1º andar.', 'PRESENCIAL', false, null) ->> 'id')::uuid from ids, c, cfg, un;
select is((select protocolo from pedidos, p where id = p2),
  to_char((select app_now() at time zone 'America/Sao_Paulo'), 'YYYY') || '-0002', 'o protocolo segue sem buracos');
select is((select proximo_retorno from pedidos, p where id = p2), app_now() + interval '4 hours', 'AT-10: urgente tem prazo menor');
select isnt((select aceito_em from pedidos, p where id = p2), null, 'AT-03: quem registra para si mesma já aceita');
select is((select criado_por from pedidos, p where id = p3), (select edu from ids), 'CF-03: quem atualiza pedidos registra');
select is(pg_temp.campos($$ select plataforma_registrar_pedido(sindica, ipe, null, null, ' ', manutencao, normal, 'Sem lugar', 'Sem lugar', 'TELEFONE', false, null)
                           from ids, c, cfg $$), '["unidadeId", "local"]'::jsonb, 'AT-01: unidade ou local');
select is(pg_temp.motivo($$ select plataforma_registrar_pedido(sindica, ipe, u102, marta, null, manutencao, normal, 'Outro', 'Outro', 'TELEFONE', false, null)
                           from ids, c, un, ct, cfg $$), 'CONTATO_NAO_CONFIRMADO', 'MU-02: só contato confirmado daquela unidade');
select is(pg_temp.motivo($$ select plataforma_registrar_pedido(sindica, ipe, u101, null, null, manutencao, normal, 'Outro', 'Outro', 'TELEFONE', false, v_edu)
                           from ids, c, un, cfg, vs $$), 'RESPONSAVEL_INDISPONIVEL', 'AT-12: responsável só de quem atende, nunca inventado');
select is(pg_temp.campos($$ select plataforma_registrar_pedido(sindica, ipe, u101, null, null, manutencao, normal, 'Outro', 'Outro', 'CARTA', false, null)
                           from ids, c, un, cfg $$), '["canal"]'::jsonb, 'diz como o pedido chegou');
select is(pg_temp.campos($$ select plataforma_registrar_pedido(sindica, ipe, u101, null, null, manutencao, normal, 'Ok', 'Descrição', 'TELEFONE', false, null)
                           from ids, c, un, cfg $$), '["assunto", "descricao", "local"]'::jsonb, 'assunto de ao menos 3 caracteres');
select is((select dados ->> 'protocolo' from historico, p where entidade = 'pedidos' and entidade_id = p1::text and acao = 'pedido.registrado'),
  (select r1 ->> 'protocolo' from p), 'AT-17: o registro vai para o histórico');
select is((select autor_id from historico, p where entidade = 'pedidos' and entidade_id = p1::text and acao = 'estado.mudou'), (select sindica from ids),
  'o guardião registra quem abriu');

-- Fila (AT-02).
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, null, null, null, null) ->> 'total')::int from ids, c), 3, 'a fila mostra os ativos');
select is((select jsonb_path_query_array(plataforma_pedidos(sindica, ipe, null, null, null, null, null, null, null), '$.itens[*].assunto') -> 0 from ids, c),
  '"Portão não fecha"', 'o urgente vem primeiro');
select is((select (plataforma_pedidos(sindica, ipe, null, v_bruna::text, null, null, null, null, null) ->> 'total')::int from ids, c, vs), 2,
  'filtro por responsável');
select is((select (plataforma_pedidos(sindica, ipe, null, null, urgente, null, null, null, null) ->> 'total')::int from ids, c, cfg), 1, 'filtro por prioridade');
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, limpeza, null, null, null) ->> 'total')::int from ids, c, cfg), 1, 'filtro por categoria');
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, null, 'AGUARDANDO_ACEITE', null, null) ->> 'total')::int from ids, c), 2,
  'filtro dos que esperam aceite');
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, null, null, '0001', null) -> 'itens' -> 0 ->> 'id')::uuid from ids, c), (select p1 from p),
  'busca pelo número do protocolo');
select ok((select (plataforma_pedidos(sindica, ipe, null, null, null, null, null, null, null) -> 'itens' -> 0) ?& array['abertoEm', 'proximoRetorno', 'responsavel']
             from ids, c), 'cada pedido mostra há quanto tempo está aberto, o próximo retorno e o responsável');
select is((select (plataforma_pedidos(davi, jatoba, null, null, null, null, null, null, null) ->> 'total')::int from ids, c), 0,
  'PT-01: outro condomínio não vê os pedidos do Ipê');

-- Aceite e repasse (AT-03).
select is(pg_temp.motivo($$ select plataforma_aceitar_pedido(carla, ipe, p1, 1) from ids, c, p $$), 'NAO_RESPONSAVEL', 'só o responsável aceita');
select lives_ok($$ select plataforma_aceitar_pedido(bruna, ipe, p1, pg_temp.v(p1)) from ids, c, p $$, 'a responsável aceita');
select isnt((select aceito_em from pedidos, p where id = p1), null, 'e o aceite fica registrado');
select throws_ok($$ select plataforma_atribuir_pedido(carla, ipe, p1, pg_temp.v(p1), v_ana, null) from ids, c, p, vs $$, 'TC401', null,
  'quem só acompanha não repassa');
select is(pg_temp.motivo($$ select plataforma_atribuir_pedido(sindica, ipe, p1, pg_temp.v(p1), v_edu, null) from ids, c, p, vs $$),
  'RESPONSAVEL_INDISPONIVEL', 'repasse só para quem atende');
select lives_ok($$ select plataforma_atribuir_pedido(bruna, ipe, p1, pg_temp.v(p1), v_ana, 'Fim do meu turno') from ids, c, p, vs $$,
  'AT-03: a responsável repassa no fim do turno, mesmo sem a permissão Atualizar');
select is((select aceito_em from pedidos, p where id = p1), null, 'AT-03: quem recebe confirma o aceite de novo');
select is((select dados from historico, p where entidade_id = p1::text and acao = 'pedido.responsavel'),
  (select jsonb_build_object('de', v_bruna, 'para', v_ana, 'motivo', 'Fim do meu turno') from vs), 'AT-17: o repasse fica no histórico, antes e depois');
select lives_ok($$ select plataforma_aceitar_pedido(sindica, ipe, p1, pg_temp.v(p1)) from ids, c, p $$, 'a síndica aceita');

-- Próximo retorno e previsão (AT-06, AT-07).
select ajustar_relogio('30 hours');
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, null, 'RETORNO_VENCIDO', null, null) ->> 'total')::int from ids, c), 3,
  'AT-08: o retorno vencido aparece na fila');
select throws_ok($$ select plataforma_registrar_retorno(carla, ipe, p1, pg_temp.v(p1), 'TELEFONE', 'Liguei para a moradora') from ids, c, p $$, 'TC401', null,
  'acompanhar não dá retorno');
update p set p1 = p1;
select lives_ok($$ select plataforma_definir_previsao(sindica, ipe, p1, pg_temp.v(p1), pg_temp.hoje() + 5, null) from ids, c, p $$,
  'AT-07: a previsão entra quando é conhecida, sem motivo na primeira vez');
select lives_ok($$ select plataforma_registrar_retorno(bruna, ipe, p1, pg_temp.v(p1), 'TELEFONE', 'Avisei que o encanador vem na quinta.') from ids, c, p $$,
  'quem responde registra o retorno ao morador');
select is((select proximo_retorno from pedidos, p where id = p1), app_now() + interval '24 hours', 'AT-06: o retorno recalcula o próximo retorno');
select is((select previsao from pedidos, p where id = p1), (select pg_temp.hoje() + 5), 'AT-06: e não mexe na previsão');
select is((select count(*)::int from andamentos_pedido, p where pedido_id = p1 and tipo = 'RETORNO'), 1, 'o retorno fica no andamento');
select lives_ok($$ select plataforma_anotar_pedido(sindica, ipe, p1, pg_temp.v(p1), 'Cobrei o encanador por mensagem.') from ids, c, p $$,
  'nota interna');
select is((select proximo_retorno from pedidos, p where id = p1), app_now() + interval '24 hours', 'AT-06: cobrar fornecedor não conta como retorno');
select is(pg_temp.campos($$ select plataforma_mudar_retorno(sindica, ipe, p1, pg_temp.v(p1), app_now() + interval '2 days', '') from ids, c, p $$),
  '["motivo"]'::jsonb, 'AT-06: mudar o próximo retorno pede motivo');
select lives_ok($$ select plataforma_mudar_retorno(sindica, ipe, p1, pg_temp.v(p1), app_now() + interval '2 days', 'A moradora viaja amanhã') from ids, c, p $$,
  'com motivo, muda');
select is((select dados ->> 'motivo' from historico, p where entidade_id = p1::text and acao = 'pedido.retorno_mudou'), 'A moradora viaja amanhã',
  'AT-06: o motivo vai para o histórico');
select is(pg_temp.campos($$ select plataforma_definir_previsao(sindica, ipe, p1, pg_temp.v(p1), pg_temp.hoje() + 9, null) from ids, c, p $$),
  '["motivo"]'::jsonb, 'AT-07: mudar a previsão pede justificativa');
select lives_ok($$ select plataforma_definir_previsao(sindica, ipe, p1, pg_temp.v(p1), pg_temp.hoje() + 9, 'A peça atrasou') from ids, c, p $$,
  'com justificativa, muda');
select is((select dados - 'motivo' from historico, p where entidade_id = p1::text and acao = 'pedido.previsao_mudou' and dados ? 'de'),
  (select jsonb_build_object('de', to_char(pg_temp.hoje() + 5, 'YYYY-MM-DD'), 'para', to_char(pg_temp.hoje() + 9, 'YYYY-MM-DD'))),
  'AT-17: antes e depois da previsão');
select is(pg_temp.campos($$ select plataforma_definir_previsao(sindica, ipe, p1, pg_temp.v(p1), pg_temp.hoje() - 1, 'Erro') from ids, c, p $$),
  '["data"]'::jsonb, 'previsão no passado não');

-- Edição simultânea (AT-24).
select is(pg_temp.codigo($$ select plataforma_anotar_pedido(sindica, ipe, p1, 1, 'Versão velha') from ids, c, p $$), 'TC409',
  'AT-24: quem leu uma versão antiga recebe conflito');

-- Etapas (AT-05).
select lives_ok($$ select plataforma_mover_pedido(sindica, ipe, p1, pg_temp.v(p1), em_analise) from ids, c, p, cfg $$, 'mover para em análise');
select is((select estado from pedidos, p where id = p1), 'EM_ANDAMENTO', 'a situação acompanha a etapa');
select is((select dados ->> 'evento' from historico, p where entidade_id = p1::text and acao = 'estado.mudou' and dados ->> 'para' = 'EM_ANDAMENTO'),
  'ETAPA_MUDOU', 'o guardião registra a mudança de situação');
select is(pg_temp.motivo($$ select plataforma_mover_pedido(sindica, ipe, p1, pg_temp.v(p1), concluido) from ids, c, p, cfg $$), 'CONCLUIR_PARA_ENCERRAR',
  'encerrar só concluindo');
select lives_ok($$ select plataforma_mover_pedido(sindica, ipe, p3, pg_temp.v(p3), aguardando_morador) from ids, c, p, cfg $$,
  'etapa que pausa o prazo');
select is((select (plataforma_pedido(sindica, ipe, p3) -> 'pedido' ->> 'retornoVencido')::boolean from ids, c, p), false,
  'AT-10: com o prazo pausado, o retorno não vence');

-- Pendências (AT-11, AT-12).
select is(pg_temp.campos($$ select plataforma_abrir_pendencia(sindica, ipe, p1, pg_temp.v(p1), 'SEM_EXECUTOR', '', v_bruna) from ids, c, p, vs $$),
  '["motivo"]'::jsonb, 'AT-11: pendência tem motivo');
create temp table pe as select (plataforma_abrir_pendencia(sindica, ipe, p1, pg_temp.v(p1), 'SEM_EXECUTOR',
  'Nenhum encanador disponível esta semana', v_bruna) ->> 'id')::uuid as pend from ids, c, p, vs;
select is((select (plataforma_pedidos(sindica, ipe, null, null, null, null, 'COM_PENDENCIA', null, null) ->> 'total')::int from ids, c), 1,
  'AT-12: sem executor vira pendência real, à vista na fila');
select is(pg_temp.motivo($$ select plataforma_concluir_pedido(sindica, ipe, p1, pg_temp.v(p1), concluido, 'Trocamos o cano do banheiro.', null)
                           from ids, c, p, cfg $$), 'PENDENCIA_ABERTA', 'não conclui com pendência aberta');
select lives_ok($$ select plataforma_resolver_pendencia(bruna, ipe, p1, pg_temp.v(p1), pend, 'Encanador confirmado para quinta') from ids, c, p, pe $$,
  'quem cuida da pendência resolve');
select is(pg_temp.motivo($$ select plataforma_resolver_pendencia(sindica, ipe, p1, pg_temp.v(p1), pend, 'De novo') from ids, c, p, pe $$),
  'PENDENCIA_RESOLVIDA', 'pendência resolvida fica como está');

-- Conclusão e reabertura (AT-13, AT-15).
select throws_ok($$ select plataforma_concluir_pedido(bruna, ipe, p1, pg_temp.v(p1), concluido, 'Trocamos o cano do banheiro.', null) from ids, c, p, cfg $$,
  'TC401', null, 'responder não conclui');
select is(pg_temp.campos($$ select plataforma_concluir_pedido(sindica, ipe, p1, pg_temp.v(p1), concluido, 'Feito.', null) from ids, c, p, cfg $$),
  '["explicacao"]'::jsonb, 'AT-13: conclusão explica ao morador');
select is((select plataforma_concluir_pedido(sindica, ipe, p1, pg_temp.v(p1), concluido, 'Trocamos o cano do banheiro e secamos o teto.', null)
             ->> 'estado' from ids, c, p, cfg), 'ENCERRADO', 'AT-13: concluída sem foto e sem revisão (desligada)');
select is((select proximo_retorno from pedidos, p where id = p1), null, 'encerrado não tem próximo retorno');
select is(pg_temp.motivo($$ select plataforma_registrar_retorno(sindica, ipe, p1, pg_temp.v(p1), 'TELEFONE', 'Mais um') from ids, c, p $$),
  'PEDIDO_ENCERRADO', 'pedido encerrado não muda');
select is(pg_temp.campos($$ select plataforma_reabrir_pedido(sindica, ipe, p1, pg_temp.v(p1), '', null) from ids, c, p $$), '["motivo"]'::jsonb,
  'AT-15: reabrir pede motivo');
select lives_ok($$ select plataforma_reabrir_pedido(edu, ipe, p1, pg_temp.v(p1), 'A mancha voltou', null) from ids, c, p $$, 'quem conclui reabre');
select is((select estado || ' ' || (responsavel_id = v_ana) || ' ' || (proximo_retorno = app_now() + interval '24 hours') from pedidos, p, vs where id = p1),
  'EM_ANDAMENTO true true', 'AT-15: reaberto ganha responsável e próximo retorno');
select is((select motivo_reabertura || ' ' || explicacao from conclusoes_pedido, p where pedido_id = p1),
  'A mancha voltou Trocamos o cano do banheiro e secamos o teto.', 'AT-15: a conclusão anterior fica preservada');

-- Revisão (AT-14).
select lives_ok($$ select plataforma_definir_regras_pedidos(sindica, ipe, versao, true, true) from ids, c, configuracao_condominio where condominio_id = ipe $$,
  'o síndico liga a revisão');
select is((select plataforma_concluir_pedido(edu, ipe, p3, pg_temp.v(p3), concluido, 'Recolhemos o lixo do corredor.', 'Foto no grupo da limpeza')
             ->> 'estado' from ids, c, p, cfg), 'EM_REVISAO', 'AT-14: quem não é síndico deixa em revisão');
select is(pg_temp.motivo($$ select plataforma_mover_pedido(edu, ipe, p3, pg_temp.v(p3), em_analise) from ids, c, p, cfg $$), 'PEDIDO_EM_REVISAO',
  'em revisão não se mexe');
select throws_ok($$ select plataforma_revisar_pedido(edu, ipe, p3, pg_temp.v(p3), true, null) from ids, c, p $$, 'TC401', null, 'revisar fica com o síndico');
select lives_ok($$ select plataforma_revisar_pedido(sindica, ipe, p3, pg_temp.v(p3), false, 'Ainda tem saco no 2º andar') from ids, c, p $$,
  'o síndico devolve com motivo');
select is((select estado || ' ' || (etapa_id = aguardando_morador) from pedidos, p, cfg where id = p3), 'EM_ANDAMENTO true',
  'AT-14: devolvido volta para a etapa em que estava');
select lives_ok($$ select plataforma_concluir_pedido(edu, ipe, p3, pg_temp.v(p3), concluido, 'Recolhemos também o do 2º andar.', null) from ids, c, p, cfg $$,
  'conclui de novo');
select lives_ok($$ select plataforma_revisar_pedido(sindica, ipe, p3, pg_temp.v(p3), true, null) from ids, c, p $$, 'o síndico aprova');
select is((select string_agg(revisao, ',' order by concluida_em, revisao) from conclusoes_pedido, p where pedido_id = p3), 'APROVADA,DEVOLVIDA',
  'AT-14: as duas conclusões ficam, a devolvida e a aprovada');
select is((select plataforma_concluir_pedido(sindica, ipe, p2, pg_temp.v(p2), nao_procede, 'O portão estava só travado; destravamos.', null)
             ->> 'estado' from ids, c, p, cfg), 'ENCERRADO', 'AT-14: o síndico que conclui já revisa');
select lives_ok($$ select plataforma_definir_regras_pedidos(sindica, ipe, versao, true, false) from ids, c, configuracao_condominio where condominio_id = ipe $$,
  'o síndico desliga a reabertura');
select is(pg_temp.motivo($$ select plataforma_reabrir_pedido(sindica, ipe, p2, pg_temp.v(p2), 'Travou de novo', null) from ids, c, p $$),
  'REABERTURA_DESLIGADA', 'AT-15: reabertura configurável por condomínio');
select is((select plataforma_configuracoes(sindica, ipe) -> 'regrasPedidos' from ids, c), '{"revisao": true, "reabertura": false}'::jsonb,
  'as regras aparecem nas configurações');

-- Cancelamento (AT-31).
alter table p add column p4 uuid;
update p set p4 = (plataforma_registrar_pedido(sindica, ipe, u101, marta, null, manutencao, normal, 'Interfone mudo',
  'O interfone da 101 não toca.', 'TELEFONE', false, null) ->> 'id')::uuid from ids, c, cfg, un, ct;
select plataforma_abrir_pendencia(sindica, ipe, p4, pg_temp.v(p4), 'MORADOR', 'Aguardando a moradora dizer o horário', v_ana) from ids, c, p, vs;
select is(pg_temp.campos($$ select plataforma_cancelar_pedido(edu, ipe, p4, pg_temp.v(p4), '') from ids, c, p $$), '["motivo"]'::jsonb,
  'AT-31: cancelar pede motivo');
select lives_ok($$ select plataforma_cancelar_pedido(edu, ipe, p4, pg_temp.v(p4), 'A moradora resolveu com a operadora') from ids, c, p $$, 'cancelado');
select is((select estado || ' ' || (cancelado_por = edu) from pedidos, p, ids where id = p4), 'CANCELADO true', 'AT-31: com autor');
select is((select resolucao from pendencias_pedido, p where pedido_id = p4), 'Pedido cancelado', 'as pendências abertas são encerradas junto');
select is((select (plataforma_pedidos(sindica, ipe, 'CANCELADO', null, null, null, null, null, null) ->> 'total')::int from ids, c), 1,
  'AT-31: o cancelado continua visível');
select is(pg_temp.motivo($$ select plataforma_reabrir_pedido(sindica, ipe, p4, pg_temp.v(p4), 'Volta', null) from ids, c, p $$), 'NAO_ENCERRADO',
  'cancelado não reabre');

-- Pedido privado (AT-32).
alter table p add column p5 uuid;
update p set p5 = (plataforma_registrar_pedido(edu, ipe, u102, null, null, manutencao, normal, 'Reclamação de barulho',
  'Reclamação sobre a unidade vizinha.', 'PRESENCIAL', true, v_ana) ->> 'id')::uuid from ids, c, cfg, un, vs;
select is((select count(*)::int from ids, c, p, jsonb_array_elements(plataforma_pedidos(carla, ipe, 'TODOS', null, null, null, null, null, null) -> 'itens') x
            where x ->> 'id' = p5::text), 0, 'AT-32: quem só acompanha não vê o privado na fila');
select throws_ok($$ select plataforma_pedido(carla, ipe, p5) from ids, c, p $$, 'TC404', null, 'AT-32: nem abrindo direto');
select lives_ok($$ select plataforma_pedido(edu, ipe, p5) from ids, c, p $$, 'AT-32: quem registrou vê');
select lives_ok($$ select plataforma_pedido(sindica, ipe, p5) from ids, c, p $$, 'AT-32: o síndico vê');

-- Responsável que sai da lista de quem atende (CF-05).
alter table p add column p6 uuid;
update p set p6 = (plataforma_registrar_pedido(sindica, ipe, null, null, 'Hall de entrada', limpeza, normal, 'Vidro sujo',
  'Vidro da porta do hall.', 'OBSERVACAO', false, v_bruna) ->> 'id')::uuid from ids, c, cfg, vs;
select plataforma_definir_atendimento(sindica, ipe, cc.versao, jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true)), v_ana)
  from ids, c, vs, configuracao_condominio cc where cc.condominio_id = ipe;
select is((select (responsavel_id = v_ana) || ' ' || (aceito_em is null) from pedidos, p, vs where id = p6), 'true true',
  'CF-05: os pedidos de quem saiu passam ao padrão, que confirma o aceite');

-- Histórico e nada se apaga (AT-17).
select ok((select jsonb_path_query_array(plataforma_pedido(sindica, ipe, p1) -> 'historico', '$[*].acao')
             @> '["pedido.registrado", "pedido.responsavel", "pedido.aceito", "pedido.retorno_registrado", "pedido.nota", "pedido.retorno_mudou", "pedido.previsao_mudou", "pedido.pendencia_aberta", "pedido.pendencia_resolvida", "estado.mudou"]'
             from ids, c, p), 'AT-17: o histórico do pedido tem tudo, com autor e data');
select is((select plataforma_pedido(sindica, ipe, p1) -> 'historico' -> 0 ->> 'autor' from ids, c, p), 'Síndica Ana', 'com o nome do autor');
select throws_ok($$ delete from pedidos where id = (select p1 from p) $$, 'TC010', null, 'AT-17: pedido não se apaga');
select throws_ok($$ update andamentos_pedido set texto = 'Outro texto' $$, 'TC010', null, 'AT-17: retorno e nota não mudam');
select ok((select plataforma_painel(carla, ipe) -> 'pedidos' ? 'retornoVencido' from ids, c), 'o Início mostra o resumo dos pedidos a quem acompanha');

select * from finish();
rollback;

-- Implantação e suporte (peça R4; PI-04, PI-05, CT-01, PI-09, PI-11, PI-17, PI-20, SH-01):
-- roteiro de implantação com versão, pendências e entrega; troca de síndico conferida; suporte
-- de acesso sem ninguém ver senha; acesso excepcional aprovado pelo síndico; chamados de
-- suporte técnico com nota interna que o cliente nunca vê.
begin;
select plan(138);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Sueli', 'SUPORTE') as sup2,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table at as select
  console_atribuir(adm, ipe, impl, 'IMPLANTACAO') as a_impl,
  console_atribuir(adm, ipe, sup, 'SUPORTE') as a_sup,
  console_atribuir(adm, ipe, fin, 'FINANCEIRO') as a_fin
  from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.ve(p_numero integer) returns integer language sql as $$
  select e.versao from etapas_implantacao e join implantacoes i on i.id = e.implantacao_id
   where i.condominio_id = (select ipe from c) and e.numero = p_numero $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pendencias_implantacao where id = p $$;
create function pg_temp.vsa(p uuid) returns integer language sql as $$ select versao from pedidos_suporte_acesso where id = p $$;
create function pg_temp.vch(p uuid) returns integer language sql as $$ select versao from chamados where id = p $$;
create function pg_temp.impl() returns jsonb language sql as $$ select console_implantacao((select impl from ids), (select ipe from c)) $$;

-- Implantação (PI-04): o roteiro nasce na primeira abertura, com a versão atual.
select is((select jsonb_array_length(console_implantacao(sup, ipe) -> 'etapas') from ids, c), 8,
  'PI-04: o roteiro tem 8 etapas');
select is((select roteiro_versao from implantacoes, c where condominio_id = ipe), 1::smallint, 'PI-04: a implantação segue a versão 1 do roteiro');
select is((select console_implantacao(sup, ipe) -> 'etapas' -> 1 ->> 'titulo' from ids, c), 'Como o condomínio já se organiza',
  'PI-04: a etapa 2 parte de como o condomínio já se organiza');
select ok(not (select (console_implantacao(sup, ipe) -> 'pode' ->> 'editar')::boolean from ids, c), 'PI-10: suporte só vê o roteiro');
select throws_ok($$ select console_implantacao(fin, ipe) from ids, c $$, 'TC401', null, 'PI-10: financeiro não entra na implantação');
select throws_ok($$ select console_implantacao(sup2, ipe) from ids, c $$, 'TC401', null, 'PI-10: só cliente atribuído');
select throws_ok($$ select console_salvar_etapa(sup, ipe, 1, 1, 'REALIZADA', null, null, 'Ficha completa.', null, null, null) from ids, c $$,
  'TC401', null, 'PI-10: suporte não mexe no roteiro');
select throws_ok($$ insert into roteiros_implantacao (numero, etapas) select 1, etapas from roteiros_implantacao $$, '23505', null,
  'PI-04: versão do roteiro não se repete');
select throws_ok($$ update roteiros_implantacao set etapas = etapas where numero = 1 $$, 'TC010', null,
  'PI-04: mudar o roteiro é criar versão nova, nunca alterar a antiga');

-- Situação de cada etapa.
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 1, 1, 'REALIZADA', impl, null, '  ', null, null, null) from ids, c $$),
  '["feito"]', 'PI-04: só fica realizada com o que foi feito escrito');
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 1, 1, 'PENDENTE', sup2, null, null, null, null, null) from ids, c $$),
  '["responsavel"]', 'PI-10: responsável só da equipe atribuída');
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 1, 1, 'PENDENTE', impl, impl, null, null, null, null) from ids, c $$),
  '["substituto"]', 'PI-04: substituto diferente do responsável');
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 3, 1, 'NAO_SE_APLICA', null, null, null, null, null, null) from ids, c $$),
  '["motivo"]', 'PI-04: não se aplica pede motivo');
select is(pg_temp.motivo($$ select console_salvar_etapa(impl, ipe, 7, 1, 'NAO_SE_APLICA', null, null, null, 'Não deu tempo', null, null) from ids, c $$),
  'PEDIDO_TESTE_OBRIGATORIO', 'PI-04: o pedido de teste sempre se aplica');
select is(pg_temp.motivo($$ select console_salvar_etapa(impl, ipe, 8, 1, 'REALIZADA', null, null, 'Entregue.', null, null, null) from ids, c $$),
  'ETAPA_ENTREGA', 'PI-04: a entrega não se marca como etapa comum');
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 5, 1, 'REALIZADA', impl, null, 'Apresentado ao conselho.', null, null, null) from ids, c $$),
  '["modalidade"]', 'SH-01: a apresentação realizada diz se foi presencial ou por vídeo');
select is(pg_temp.campos($$ select console_salvar_etapa(impl, ipe, 4, 1, 'PREPARADA', null, null, null, null, 'VIDEO', null) from ids, c $$),
  '["modalidade"]', 'SH-01: modalidade é só da apresentação');
select is((select console_salvar_etapa(impl, ipe, 1, 1, 'REALIZADA', impl, sup, 'Ficha com contatos e contrato.', null, null, null) from ids, c), 2,
  'PI-04: implantação marca a etapa realizada com o que foi feito');
select is((teste.erro($$ select console_salvar_etapa(impl, ipe, 1, 1, 'PENDENTE', impl, null, null, null, null, null) from ids, c $$)) ->> 'codigo',
  'TC409', 'AT-24: salvar a etapa com a versão velha é conflito');
select is((select console_salvar_etapa(impl, ipe, 5, 1, 'REALIZADA', impl, null, 'Apresentado à síndica e ao conselho.', null, 'PRESENCIAL', hoje)
             from ids, c, d), 2, 'SH-01: apresentação presencial registrada com a data');
select is(pg_temp.impl() -> 'etapas' -> 4 ->> 'modalidade', 'PRESENCIAL', 'SH-01: a etapa mostra a modalidade');
select is((select interno from historico where acao = 'implantacao.etapa' limit 1), true, 'PI-06: a etapa entra no histórico interno');
select is(pg_temp.impl() -> 'etapas' -> 0 ->> 'substituto', 'Diego', 'PI-04: a etapa mostra responsável e substituto');

-- Pendências (PI-05).
select is(pg_temp.campos($$ select console_salvar_pendencia(impl, ipe, null, null, 6, 'Síndica enviar a planilha', 'CLIENTE', null, hoje) from ids, c, d $$),
  '["responsavel"]', 'PI-05: a pendência tem responsável');
select is(pg_temp.campos($$ select console_salvar_pendencia(impl, ipe, null, null, 6, 'Síndica enviar a planilha', 'NINGUEM', impl, hoje) from ids, c, d $$),
  '["comQuem"]', 'PI-05: a pendência diz quem precisa agir');
create temp table pe as select
  (console_salvar_pendencia(impl, ipe, null, null, 6, 'Síndica enviar a planilha de moradores', 'CLIENTE', impl, hoje - 1) ->> 'id')::uuid as p_planilha,
  (console_salvar_pendencia(impl, ipe, null, null, 3, 'Pedir o AVCB à administradora', 'EQUIPE', impl, hoje + 10) ->> 'id')::uuid as p_avcb
  from ids, c, d;
select ok((select (x ->> 'vencida')::boolean from jsonb_array_elements(pg_temp.impl() -> 'pendencias') x, pe where x ->> 'id' = p_planilha::text),
  'PI-05: pendência com retorno passado aparece vencida');
select ok((select 'PENDENCIA_VENCIDA' = any (situacoes) from ids, console_carteira(adm) where nome = 'Residencial Ipê'),
  'PI-05: a Carteira mostra quem está atrasado');
select is((select x ->> 'vencidas' from ids, jsonb_array_elements(console_implantacoes(impl)) x where x ->> 'nome' = 'Residencial Ipê'), '1',
  'PI-05: Implantações mostra as vencidas');
select is((select jsonb_array_length(console_implantacoes(impl)) from ids), 1, 'PI-10: Implantações só dos clientes atribuídos');
select is((select (console_salvar_pendencia(impl, ipe, p_planilha, 1, 6, 'Síndica enviar a planilha de moradores', 'CLIENTE', impl, hoje + 2) ->> 'versao')
             from ids, c, d, pe), '2', 'PI-05: a pendência ganha novo retorno');
select is((select console_resolver_pendencia(impl, ipe, p_avcb, 1, 'AVCB guardado em Documentos') from ids, c, pe), 2,
  'PI-05: pendência resolvida com o que se fez');
select is(pg_temp.motivo($$ select console_resolver_pendencia(impl, ipe, p_avcb, 2, 'De novo') from ids, c, pe $$), 'JA_RESOLVIDA',
  'PI-05: pendência resolvida não volta');

-- Entrega (PI-04).
select is(pg_temp.impl() -> 'entrega' -> 'faltando', '["ETAPAS_ABERTAS", "SEM_PEDIDO_TESTE"]',
  'PI-04: a entrega mostra o que falta');
select is(pg_temp.motivo($$ select console_entregar_implantacao(impl, ipe, 1, 'Pronto.') from ids, c $$), 'ETAPAS_ABERTAS',
  'PI-04: não entrega com etapa aberta');
select is(pg_temp.motivo($$ select console_mudar_estagio(adm, ipe, 1, 'ATIVO', null) from ids, c $$), 'USE_ENTREGA',
  'PI-04: com roteiro em andamento, o cliente só fica ativo pela entrega');
select lives_ok($$
  select console_salvar_etapa(impl, ipe, 2, pg_temp.ve(2), 'REALIZADA', impl, null, 'Atas, regimento e quem responde hoje.', null, null, null),
         console_salvar_etapa(impl, ipe, 3, pg_temp.ve(3), 'NAO_SE_APLICA', null, null, null, 'Documentos já estavam guardados.', null, null),
         console_salvar_etapa(impl, ipe, 4, pg_temp.ve(4), 'REALIZADA', impl, null, 'Horários, categorias e prazos.', null, null, null),
         console_salvar_etapa(impl, ipe, 6, pg_temp.ve(6), 'REALIZADA', impl, null, 'Planilha importada.', null, null, null),
         console_salvar_etapa(impl, ipe, 7, pg_temp.ve(7), 'REALIZADA', impl, null, 'A síndica fez o pedido sozinha.', null, null, null)
    from ids, c $$, 'PI-04: implantação completa as etapas 1 a 7');
select is(pg_temp.impl() -> 'entrega' -> 'faltando', '["SEM_PEDIDO_TESTE"]', 'PI-04: falta o pedido de teste concluído pelo síndico');
create temp table pt as select
  (plataforma_registrar_pedido(ana, ipe, null, null, 'Hall', (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO'),
     (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL'), 'Pedido de teste', 'Lâmpada do hall queimada.', 'OBSERVACAO',
     false, null) ->> 'id')::uuid as p_teste
  from ids, c;
select lives_ok($$ select plataforma_concluir_pedido(ana, ipe, p_teste, (select versao from pedidos where id = p_teste),
                     (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO'), 'Trocamos a lâmpada do hall.', null)
                    from ids, c, pt $$, 'a síndica conclui o pedido de teste');
select is(pg_temp.impl() -> 'entrega' -> 'faltando', '[]', 'PI-04: com o pedido de teste, a entrega fica pronta');
select throws_ok($$ select console_entregar_implantacao(sup, ipe, 1, 'Pronto.') from ids, c $$, 'TC401', null, 'PI-10: suporte não entrega');
select is(pg_temp.campos($$ select console_entregar_implantacao(impl, ipe, 1, '') from ids, c $$), '["recado"]', 'PI-04: a entrega leva recado');
select is((select console_entregar_implantacao(impl, ipe, 1, 'O Residencial Ipê está pronto. Use Ajuda e suporte.') from ids, c), 2,
  'PI-04: implantação entrega o cliente');
select is((select estado from clientes, c where condominio_id = ipe), 'ATIVO', 'PI-04: entregar passa o cliente a ativo');
select is((select dados ->> 'evento' from historico, c where acao = 'estado.mudou' and entidade = 'clientes' and condominio_id = ipe
                                                       and dados ->> 'para' = 'ATIVO'),
  'IMPLANTACAO_CONCLUIDA', 'PI-04: a mudança passa pelo guardião');
select is((select x ->> 'texto' from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'tipo' = 'ENTREGA'),
  'O Residencial Ipê está pronto. Use Ajuda e suporte.', 'PI-04: o síndico recebe o recado no sino');
select is(pg_temp.impl() -> 'etapas' -> 7 ->> 'situacao', 'REALIZADA', 'PI-04: a etapa 8 fica realizada pela entrega');
select is(pg_temp.motivo($$ select console_entregar_implantacao(impl, ipe, 2, 'De novo.') from ids, c $$), 'JA_ENTREGUE',
  'PI-04: a entrega não se repete');
select is(pg_temp.motivo($$ select console_salvar_etapa(impl, ipe, 4, pg_temp.ve(4), 'PENDENTE', impl, null, null, null, null, null) from ids, c $$),
  'JA_ENTREGUE', 'PI-04: depois da entrega o roteiro não muda');
select ok(not (select 'PENDENCIA_VENCIDA' = any (situacoes) from ids, console_carteira(adm) where nome = 'Residencial Ipê'),
  'PI-05: cliente entregue sai da conta de atrasados');
select lives_ok($$ select console_mudar_estagio(adm, jatoba, 1, 'ATIVO', 'Cliente antigo') from ids, c $$,
  'cliente sem roteiro aberto ainda conclui pelo estágio');
select ok((select (console_implantacao(adm, jatoba) ->> 'legado')::boolean from ids, c), 'PI-04: cliente ativo antes do roteiro não ganha roteiro');

-- Suporte de acesso (PI-09).
select throws_ok($$ select console_abrir_suporte_acesso(impl, ipe, gil, 'SENHA', 'WHATSAPP', 'Esqueceu a senha') from ids, c $$,
  'TC401', null, 'PI-10: suporte de acesso é do suporte e da administração');
select is(pg_temp.motivo($$ select console_abrir_suporte_acesso(sup, ipe, davi, 'SENHA', 'WHATSAPP', 'Esqueceu a senha') from ids, c $$),
  'SEM_VINCULO', 'PI-09: só quem tem vínculo ativo no condomínio');
create temp table sa as select console_abrir_suporte_acesso(sup, ipe, gil, 'SENHA', 'WHATSAPP', 'Esqueceu a senha') as s_gil from ids, c;
select is(pg_temp.motivo($$ select console_abrir_suporte_acesso(sup, ipe, gil, 'OUTRO', 'EMAIL', 'De novo') from ids, c $$),
  'PEDIDO_ABERTO', 'PI-09: um pedido por vez para a mesma pessoa');
select is((select jsonb_array_length(console_pessoas_plataforma(sup, ipe)) from ids, c), 2, 'PI-09: lista quem tem conta na Plataforma');
select is(pg_temp.motivo($$ select console_decidir_suporte_acesso(sup, ipe, s_gil, 1, 'ENVIAR', null) from ids, c, sa $$),
  'VERIFICACAO_INCOMPLETA', 'PI-09: o link só sai depois da verificação');
select is((select console_verificar_suporte_acesso(sup, ipe, s_gil, 1, 'SENHA', true, true) from ids, c, sa), 2,
  'PI-09: dados confirmados e canal já conhecido');
select is((select console_suporte_acesso(sup, ipe, s_gil) -> 'vinculo' -> 'funcoes' from ids, c, sa), '["AUTORIZADO"]',
  'PI-09: a verificação mostra o vínculo ativo');
select is((select console_decidir_suporte_acesso(sup, ipe, s_gil, 2, 'ENVIAR', null) ->> 'situacao' from ids, c, sa), 'ENVIADO',
  'PI-09: suporte manda o link de senha nova');
select is(pg_temp.motivo($$ select console_decidir_suporte_acesso(sup, ipe, s_gil, 3, 'RECUSAR', 'De novo') from ids, c, sa $$),
  'JA_DECIDIDO', 'PI-09: decidido não muda');
select lives_ok($$ select console_falha_suporte_acesso(sup, ipe, s_gil) from ids, c, sa $$, 'PI-09: envio que falhou volta o pedido para aberto');
select is((select situacao from pedidos_suporte_acesso, sa where id = s_gil), 'ABERTO', 'PI-09: aberto de novo, com o registro');
select is(pg_temp.campos($$ select console_decidir_suporte_acesso(sup, ipe, s_gil, pg_temp.vsa(s_gil), 'DUVIDOSO', null) from ids, c, sa $$),
  '["motivo"]', 'PI-09: caso duvidoso diz o porquê');
select is((select console_decidir_suporte_acesso(sup, ipe, s_gil, pg_temp.vsa(s_gil), 'DUVIDOSO', 'O pedido veio de número novo') ->> 'situacao'
             from ids, c, sa), 'DUVIDOSO', 'PI-09: caso duvidoso passa à administração');
select throws_ok($$ select console_decidir_suporte_acesso(sup, ipe, s_gil, pg_temp.vsa(s_gil), 'RECUSAR', 'Não confere') from ids, c, sa $$,
  'TC401', null, 'PI-09: só a administração decide caso duvidoso');
select is((select console_decidir_suporte_acesso(adm, ipe, s_gil, pg_temp.vsa(s_gil), 'RECUSAR', 'Não confere com o cadastro') ->> 'situacao'
             from ids, c, sa), 'RECUSADO', 'PI-09: a administração recusa com motivo');
update sa set s_gil = (select console_abrir_suporte_acesso(sup, ipe, ana, 'AUTENTICADOR', 'TELEFONE', 'Perdeu o celular') from ids, c);
select console_verificar_suporte_acesso(sup, ipe, s_gil, 1, 'AUTENTICADOR', true, true) from ids, c, sa;
select throws_ok($$ select console_decidir_suporte_acesso(sup, ipe, s_gil, 2, 'TIRAR_AUTENTICADOR', null) from ids, c, sa $$,
  'TC401', null, 'PI-09: autenticador perdido só sai com a administração');
select is((select console_decidir_suporte_acesso(adm, ipe, s_gil, 2, 'TIRAR_AUTENTICADOR', null) ->> 'pessoaId' from ids, c, sa),
  (select ana::text from ids), 'PI-09: a administração tira o autenticador da própria pessoa');
select is((select interno from historico where acao = 'acesso.autenticador_tirado_suporte'), false,
  'PI-09: o condomínio vê no histórico que o autenticador foi tirado');
select ok(not exists (select 1 from historico where acao like 'suporte_acesso.%' and not interno), 'PI-06: o pedido fica no histórico interno');
select is((select jsonb_array_length(console_suportes_acesso(sup)) from ids), 2, 'PI-09: a fila mostra os pedidos do mês');

-- Acesso excepcional (PI-11).
select throws_ok($$ select plataforma_pedidos(sup, ipe, null, null, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'PI-11: sem aprovação, a TRÍADE não vê os pedidos');
select throws_ok($$ select console_pedir_acesso_excepcional(impl, ipe, 'Preciso ver a fila de pedidos', array['PEDIDOS'], 24, null) from ids, c $$,
  'TC401', null, 'PI-10: implantação não pede acesso excepcional');
select throws_ok($$ select console_pedir_acesso_excepcional(sup2, ipe, 'Preciso ver a fila de pedidos', array['PEDIDOS'], 24, null) from ids, c $$,
  'TC401', null, 'PI-11: só para cliente atribuído');
select is(pg_temp.campos($$ select console_pedir_acesso_excepcional(sup, ipe, 'Preciso ver a fila de pedidos', array['PEDIDOS'], 73, null) from ids, c $$),
  '["horas"]', 'PI-11: prazo de até 72 horas');
select is(pg_temp.campos($$ select console_pedir_acesso_excepcional(sup, ipe, 'Preciso ver a fila de pedidos', array['FINANCEIRO'], 24, null) from ids, c $$),
  '["areas"]', 'PI-11: só as áreas previstas');
select is(pg_temp.campos($$ select console_pedir_acesso_excepcional(sup, ipe, 'Ver', array['PEDIDOS'], 24, null) from ids, c $$),
  '["motivo"]', 'PI-11: com motivo');
create temp table ae as select
  console_pedir_acesso_excepcional(sup, ipe, 'A fila some depois de filtrar por categoria', array['PEDIDOS'], 24, null) as a1
  from ids, c;
select is(pg_temp.motivo($$ select console_pedir_acesso_excepcional(sup, ipe, 'Outro motivo qualquer', array['MORADORES'], 2, null) from ids, c $$),
  'JA_PEDIDO', 'PI-11: um pedido por vez');
select is((select jsonb_array_length(plataforma_painel(ana, ipe) -> 'acessosExcepcionais' -> 'pedidos') from ids, c), 1,
  'PI-11: o pedido aparece no Início do síndico');
select ok(exists (select 1 from avisos_triade a, ids, ae where a.pessoa_id = ana and a.acesso_id = a1 and a.tipo = 'ACESSO_PEDIDO'),
  'PI-11: o síndico é avisado no sino');
select throws_ok($$ select console_ler_excepcional(sup, ipe, 'PEDIDOS') from ids, c $$, 'TC401', null, 'PI-11: antes da aprovação não lê');
select throws_ok($$ select plataforma_decidir_acesso_excepcional(gil, ipe, a1, true, null) from ids, c, ae $$, 'TC401', null,
  'PI-11: só o síndico aprova');
select is(pg_temp.campos($$ select plataforma_decidir_acesso_excepcional(ana, ipe, a1, false, null) from ids, c, ae $$), '["motivo"]',
  'PI-11: recusa pede motivo');
select is((select plataforma_decidir_acesso_excepcional(ana, ipe, a1, true, null) ->> 'situacao' from ids, c, ae), 'APROVADO',
  'PI-11: o síndico aprova');
select is((select console_ler_excepcional(sup, ipe, 'PEDIDOS') ->> 'acessoId' from ids, c), (select a1::text from ae),
  'PI-11: aprovado, a pessoa abre a área');
select lives_ok($$ select plataforma_pedidos(sup, ipe, null, null, null, null, null, null, 1) from ids, c $$,
  'PI-11: e lê os pedidos do condomínio');
select is((select count(*)::int from historico, ae where acao = 'acesso_excepcional.leitura' and entidade_id = a1::text and not interno), 1,
  'PI-11: cada abertura fica no histórico que o síndico vê');
select throws_ok($$ select plataforma_moradores(sup, ipe, null, null, 1) from ids, c $$, 'TC401', null, 'PI-11: só as áreas aprovadas');
select throws_ok($$ select plataforma_registrar_pedido(sup, ipe, null, null, 'Hall', (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO'),
                     (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL'), 'Teste', 'Teste da TRÍADE.', 'OBSERVACAO', false, null)
                     from ids, c $$, 'TC401', null, 'PI-11: só leitura');
select throws_ok($$ select plataforma_pedidos(sup2, ipe, null, null, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'PI-11: a aprovação vale só para quem pediu');
select is((select plataforma_encerrar_acesso_excepcional(ana, ipe, a1) ->> 'situacao' from ids, c, ae), 'ENCERRADO',
  'PI-11: o síndico encerra antes do prazo');
select throws_ok($$ select plataforma_pedidos(sup, ipe, null, null, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'PI-11: encerrado, acabou a leitura');
update ae set a1 = (select console_pedir_acesso_excepcional(sup, ipe, 'Investigar a lista de moradores', array['MORADORES', 'COMUNICADOS', 'MANUTENCAO'], 2, null) from ids, c);
select plataforma_decidir_acesso_excepcional(ana, ipe, a1, true, null) from ids, c, ae;
select lives_ok($$ select plataforma_moradores(sup, ipe, null, null, 1) from ids, c $$, 'PI-11: a nova aprovação vale');
select lives_ok($$ select plataforma_comunicados(sup, ipe, null, null, null, null, 1) from ids, c $$, 'PI-11: comunicados só leitura');
select lives_ok($$ select plataforma_documentos(sup, ipe, null, null) from ids, c $$, 'PI-11: documentos junto com os comunicados');
select lives_ok($$ select plataforma_manutencoes(sup, ipe, null, null, null, null, null, 1) from ids, c $$, 'PI-11: manutenção só leitura');
select ajustar_relogio('3 hours');
select throws_ok($$ select plataforma_moradores(sup, ipe, null, null, 1) from ids, c $$, 'TC401', null, 'PI-11: o acesso acaba sozinho no prazo');
select is((select x ->> 'situacao' from ids, c, ae, jsonb_array_elements(console_acessos_excepcionais(sup, ipe) -> 'itens') x where x ->> 'id' = a1::text),
  'EXPIRADO', 'PI-11: o Console mostra que expirou');

-- Chamados (PI-17, PI-20).
select is(pg_temp.campos($$ select plataforma_abrir_chamado(gil, ipe, 'RECLAMACAO', 'PEDIDOS', 'Fila some', 'Escolho a categoria e some.') from ids, c $$),
  '["tipo"]', 'PI-20: o chamado tem tipo');
create temp table ch as select
  (plataforma_abrir_chamado(gil, ipe, 'PROBLEMA', 'PEDIDOS', 'Fila some depois de filtrar', 'Escolho Limpeza e a lista fica vazia.') ->> 'id')::uuid as ch_gil,
  (plataforma_abrir_chamado(ana, ipe, 'DUVIDA', 'COMUNICADOS', 'Como mudar o horário?', 'Quero mudar o horário sem envio.') ->> 'id')::uuid as ch_ana
  from ids, c;
select is((select numero from chamados, ch where id = ch_ana), 2, 'PI-20: chamados numerados por condomínio');
select is((select jsonb_array_length(plataforma_chamados(gil, ipe) -> 'itens') from ids, c), 1, 'PI-20: quem abriu vê os seus');
select is((select jsonb_array_length(plataforma_chamados(ana, ipe) -> 'itens') from ids, c), 2, 'PI-20: o síndico vê os do condomínio');
select throws_ok($$ select plataforma_chamado(gil, ipe, ch_ana) from ids, c, ch $$, 'TC404', null, 'PI-20: a pessoa autorizada não vê o chamado da síndica');
select throws_ok($$ select plataforma_chamado(davi, ipe, ch_gil) from ids, c, ch $$, 'TC401', null, 'cada condomínio só vê os seus');
select throws_ok($$ select console_chamado(fin, ipe, ch_gil) from ids, c, ch $$, 'TC401', null, 'PI-10: financeiro não entra nos chamados');
select is((select jsonb_array_length(console_chamados(sup, 'ABERTOS')) from ids), 2, 'PI-20: a fila da equipe mostra os chamados dos atribuídos');
select lives_ok($$ select console_responder_chamado(sup, ipe, ch_gil, 'Obrigado, reproduzi aqui.', false),
                          console_responder_chamado(sup, ipe, ch_gil, 'Filtro ignora pedidos privados.', true) from ids, c, ch $$,
  'PI-20: a equipe responde e escreve nota interna');
select is((select situacao || ' ' || nome_pessoa(responsavel_id) from chamados, ch where id = ch_gil), 'ANDAMENTO Diego',
  'PI-20: a resposta põe o chamado em andamento com quem respondeu');
select is((select jsonb_array_length(plataforma_chamado(gil, ipe, ch_gil) -> 'mensagens') from ids, c, ch), 2,
  'PI-06: a nota interna nunca vai ao cliente');
select is((select jsonb_array_length(console_chamado(sup, ipe, ch_gil) -> 'mensagens') from ids, c, ch), 3, 'PI-06: a equipe vê a nota interna');
select ok(exists (select 1 from avisos_triade a, ids, ch where a.pessoa_id = gil and a.chamado_id = ch_gil and a.tipo = 'CHAMADO_RESPOSTA'),
  'PI-20: a resposta avisa no sino de quem abriu');
select is(pg_temp.campos($$ select console_atualizar_chamado(sup, ipe, ch_gil, pg_temp.vch(ch_gil), 'ANDAMENTO', sup2) from ids, c, ch $$),
  '["responsavel"]', 'PI-10: o responsável é da equipe atribuída');
select lives_ok($$ select console_atualizar_chamado(sup, ipe, ch_gil, pg_temp.vch(ch_gil), 'RESOLVIDO', sup) from ids, c, ch $$,
  'PI-20: a equipe marca resolvido');
select is(pg_temp.motivo($$ select console_responder_chamado(sup, ipe, ch_gil, 'Mais uma coisa.', false) from ids, c, ch $$), 'JA_RESOLVIDO',
  'PI-20: resolvido, só o cliente reabre');
select ok((select (plataforma_responder_chamado(gil, ipe, ch_gil, 'Voltou a acontecer.') ->> 'reaberto')::boolean from ids, c, ch),
  'PI-20: resposta do cliente em até 7 dias reabre');
select lives_ok($$ select plataforma_resolver_chamado(gil, ipe, ch_gil) from ids, c, ch $$, 'PI-20: quem abriu diz que resolveu');
select ajustar_relogio('8 days');
select is(pg_temp.motivo($$ select plataforma_responder_chamado(gil, ipe, ch_gil, 'Voltou de novo.') from ids, c, ch $$), 'CHAMADO_FECHADO',
  'PI-20: depois de 7 dias, abre-se outro');

-- Imagens do chamado (PT-07): só quem abriu, até 3.
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'erro.pdf', 'application/pdf', 1000) from ids, c, ch $$),
  'SO_IMAGEM', 'PI-20: só imagens');
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'print.png', 'image/png', 10485761) from ids, c, ch $$),
  'ARQUIVO_GRANDE', 'PT-07: até 10 MB');
create temp table ar as select
  (plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'print1.png', 'image/png', 1000) ->> 'arquivoId')::uuid as ar1,
  (plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'print2.png', 'image/png', 1000) ->> 'arquivoId')::uuid as ar2,
  (plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'print3.png', 'image/png', 1000) ->> 'arquivoId')::uuid as ar3
  from ids, c, ch;
select is(pg_temp.motivo($$ select plataforma_iniciar_arquivo_chamado(ana, ipe, ch_ana, 'print4.png', 'image/png', 1000) from ids, c, ch $$),
  'LIMITE_IMAGENS', 'PI-20: até 3 imagens');
select is((select caminho from arquivos_chamado, ar where id = ar1), (select ipe || '/' || ch_ana || '/' || ar1 from c, ch, ar),
  'o caminho no armazenamento começa pelo condomínio');
select is(pg_temp.motivo($$ select plataforma_abrir_arquivo_chamado(ana, ipe, ch_ana, ar1) from ids, c, ch, ar $$), 'ARQUIVO_NAO_LIBERADO',
  'PT-07: só abre depois de verificada');
select plataforma_verificar_arquivo_chamado(ana, ipe, ch_ana, ar1, true, 990, null) from ids, c, ch, ar;
select is((select console_abrir_arquivo_chamado(sup, ipe, ch_ana, ar1) ->> 'nome' from ids, c, ch, ar), 'print1.png',
  'PI-20: a equipe abre a imagem do chamado');
select throws_ok($$ select plataforma_iniciar_arquivo_chamado(gil, ipe, ch_ana, 'x.png', 'image/png', 10) from ids, c, ch $$, 'TC404', null,
  'PI-20: só quem abriu junta imagem');

-- Troca de síndico (CT-01).
insert into auth.users (id, email) select gen_random_uuid(), 'marcos@exemplo.invalid';
create temp table nv as select id as marcos from auth.users where email = 'marcos@exemplo.invalid';
select throws_ok($$ select console_trocar_sindico(sup, ipe, v_ana, 1, marcos, 'Marcos Lima', 'Conselho', 'EMAIL', array['Ata da AGE']) from ids, c, vs, nv $$,
  'TC401', null, 'CT-01: suporte não troca síndico');
select is(pg_temp.campos($$ select console_trocar_sindico(impl, ipe, v_ana, 1, marcos, 'Marcos Lima', 'Conselho', 'EMAIL', array[' ']) from ids, c, vs, nv $$),
  '["conferido"]', 'CT-01: a troca registra o que foi conferido');
select is(pg_temp.motivo($$ select console_trocar_sindico(impl, ipe, v_ana, 1, ana, 'Ana', 'Conselho', 'EMAIL', array['Ata da AGE']) from ids, c, vs $$),
  'MESMO_SINDICO', 'CT-01: o acesso do síndico nunca é passado adiante');
create temp table tr as select
  console_trocar_sindico(impl, ipe, v_ana, (select versao from vinculos where id = v_ana), marcos, 'Marcos Lima', 'Conselheira Rita', 'WHATSAPP',
                         array['Ata da AGE de 12/10/2026', 'Identidade conferida por vídeo']) as r
  from ids, c, vs, nv;
select is((select r -> 'autorizados' -> 0 ->> 'nome' from tr), 'Gil', 'CT-01: as pessoas autorizadas pelo anterior vêm para revisão');
select ok((select revogado_em is not null from vinculos, vs where id = v_ana), 'CT-01: o vínculo do anterior acaba na hora');
select ok(not (select pode(ana, ipe, 'plataforma.painel.ver') from ids, c), 'CT-01: o anterior não entra mais');
select ok((select pode(marcos, ipe, 'plataforma.painel.ver') from nv, c), 'CT-01: o novo síndico entra com conta própria');
select ok((select pode(gil, ipe, 'plataforma.painel.ver') from ids, c), 'CT-01: as autorizadas não saem sozinhas');
select is((select count(*)::int from historico where autor_id = (select ana from ids) and acao = 'chamado.aberto'), 1,
  'CT-01: a autoria antiga continua');
select is((select canal || ' ' || cardinality(conferido) from trocas_sindico), 'WHATSAPP 2', 'CT-01: a troca guarda canal e conferência');
select is((select interno from historico where acao = 'sindico.trocado'), false, 'CT-01: a troca fica no histórico do condomínio');
select is((select jsonb_array_length(console_trocas(adm, ipe)) from ids, c), 1, 'CT-01: a ficha lista as trocas');

-- Menu do Console e sino.
select is((select console_contagens(sup) from ids), '{"carteira": 1, "chamados": 1, "whatsapp": 0, "implantacoes": 0, "suporteAcesso": 0}'::jsonb,
  'os números do menu contam só os atribuídos');
select ok((select plataforma_marcar_avisos(gil, ipe, null) from ids, c) >= 1, 'o sino marca os avisos da TRÍADE como vistos');

select * from finish();
rollback;

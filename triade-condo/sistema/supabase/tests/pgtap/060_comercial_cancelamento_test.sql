-- Cancelamento e retenção (0311, R17.7; CM-31; quadro 347): o pedido com quem pediu e quando, o
-- último dia pela data do pedido mais 30 dias (N.1), o motivo da lista própria, uma tentativa de
-- retenção, a decisão do síndico registrada (ficou ou confirmado, este pela Administração), a
-- exportação completa para o síndico, o acesso até o último dia (depois, só consulta e exportação),
-- a cobrança que para, a comissão do parceiro que acaba, a anonimização e a retenção dos textos.
begin;
select plan(46);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Iara', 'IMPLANTACAO') as imp,
  teste.pessoa('Ana Ribeiro') as ana;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.kv(p uuid) returns integer language sql as $$ select versao from cancelamentos_cliente where id = p $$;
create function pg_temp.aceita(p_interessado uuid) returns text language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_interessado, '{}');
  e := comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  perform publico_aceitar_proposta(e -> 'link' ->> 'codigo', '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}',
                                   '200.1.2.3', null);
  return e -> 'link' ->> 'codigo';
end $$;
create function pg_temp.doc(p_codigo text, p_dados jsonb) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (publico_iniciar_documento(p_codigo, p_dados || '{"nome": "doc.pdf", "tamanho": 2048}', '200.1.2.3') ->> 'documentoId')::uuid;
  perform publico_verificar_documento(p_codigo, v, true, 2048, pg_temp.sha(v::text), null);
  return v;
end $$;
create function pg_temp.cliente(p_interessado uuid) returns uuid language plpgsql as $$
declare cod text; c uuid; e uuid; t uuid;
begin
  update interessados set unidades = 72, faixa = 'DE_41_A_100', cidade = 'Brasília', uf = 'DF' where id = p_interessado;
  cod := pg_temp.aceita(p_interessado);
  perform pg_temp.doc(cod, '{"tipo": "CNPJ", "cnpj": "11222333000181"}');
  perform pg_temp.doc(cod, '{"tipo": "ATA_ELEICAO", "mandatoAte": "2027-12-31"}');
  c := (comercial_gerar_contrato((select com from ids), p_interessado, date '2026-11-01', null) ->> 'contratoId')::uuid;
  perform comercial_contrato_pronto((select com from ids), c, pg_temp.sha(c::text), 5000);
  e := (publico_iniciar_envio(cod, '{"nome": "a.pdf", "tamanho": 5500}', null) ->> 'envioId')::uuid;
  perform publico_verificar_envio(cod, e, jsonb_build_object('valido', true, 'sha256', pg_temp.sha(e::text), 'tamanho', 5500, 'assinaturas', 1,
                                                             'prefixoSha256', pg_temp.sha(c::text), 'assinaturaNova', true, 'soAssinatura', true));
  perform comercial_conferir_envio((select com from ids), e, 2, '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}');
  t := (comercial_iniciar_envio((select adm from ids), c, '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 6000}') ->> 'envioId')::uuid;
  perform comercial_verificar_envio((select adm from ids), t, jsonb_build_object('valido', true, 'sha256', pg_temp.sha(t::text), 'tamanho', 6000,
                                                                                'assinaturas', 2, 'prefixoSha256', pg_temp.sha(e::text), 'assinaturaNova', true, 'soAssinatura', true));
  perform comercial_conferir_envio((select com from ids), t, 2, '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "cpf": "11144477735"}');
  update interessados set decisor = 'Assembleia de 10/11', decisao_em = '2026-11-10' where id = p_interessado;
  return (comercial_virar_cliente((select adm from ids), p_interessado, pg_temp.iv(p_interessado),
                                  jsonb_build_object('responsavelImplantacaoId', (select imp from ids))) ->> 'condominioId')::uuid;
end $$;
create function pg_temp.lista(p_pessoa uuid) returns jsonb language sql as $$ select comercial_renovacoes(p_pessoa, null) $$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajuste pelo «indice_reajuste».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
        '2026-10-20', 'EM_USO', app_now());
create temp table i as select
  (comercial_criar(com, '{"condominio": "Edifício Ipiranga", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990801"}') ->> 'id')::uuid as ipiranga,
  (comercial_criar(com, '{"condominio": "Residencial Pequi", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990802"}') ->> 'id')::uuid as pequi
  from ids;
create temp table cc as select pg_temp.cliente(ipiranga) as c_ipiranga, pg_temp.cliente(pequi) as c_pequi from i;
create temp table vin as select teste.vincular(ana, c_ipiranga, 'SINDICO') as v from ids, cc;
-- A comissão de um parceiro sobre o Ipiranga (0310), como se ele tivesse sido indicado.
insert into parceiros_comercial (id, tipo, nome) values ('6f1d7a52-1c1f-4f7e-9f3a-2b8b5c0c9a11', 'SINDICO_PROFISSIONAL', 'Marta Lins');
insert into comissoes_parceiro (parceiro_id, interessado_id, condominio_id, condominio, percentual, inicio, mensal_centavos)
select '6f1d7a52-1c1f-4f7e-9f3a-2b8b5c0c9a11', ipiranga, c_ipiranga, 'Edifício Ipiranga', 10, '2026-11-01', 22900 from i, cc;

-- 1. O pedido: quem pediu e quando; o último dia é o pedido mais 30 dias.
select pg_temp.em('2027-01-24 11:20:00-03');
select is(pg_temp.campos(format('select comercial_pedir_cancelamento(%L, %L, %L)', (select com from ids), (select ipiranga from i), '{"pedidoPor": ""}')),
  '["pedidoPor"]'::jsonb, 'o pedido diz quem pediu');
select is(pg_temp.campos(format('select comercial_pedir_cancelamento(%L, %L, %L)', (select com from ids), (select ipiranga from i),
  '{"pedidoPor": "Ana Ribeiro", "pedidoEm": "2027-01-30T10:00:00-03:00"}')), '["pedidoEm"]'::jsonb, 'o pedido não é do futuro');
select throws_ok($$ select comercial_pedir_cancelamento(imp, ipiranga, '{"pedidoPor": "Ana"}') from ids, i $$, 'TC401', null,
  'quem não é do Comercial não registra o pedido');
select throws_ok(format('select comercial_pedir_cancelamento(%L, %L, %L)', (select com from ids), gen_random_uuid(), '{"pedidoPor": "Ana"}'), 'TC404', null,
  'só de cliente');
create temp table k as select (comercial_pedir_cancelamento(com, ipiranga, '{"pedidoPor": "Ana Ribeiro, síndica eleita em 15/01"}') ->> 'id')::uuid as k1
  from ids, i;
select is((select ultimo_dia from cancelamentos_cliente where id = (select k1 from k)), date '2027-02-23', 'N.1: 30 dias de aviso, 24/01 dá 23/02');
select is(pg_temp.motivo(format('select comercial_pedir_cancelamento(%L, %L, %L)', (select com from ids), (select ipiranga from i), '{"pedidoPor": "Ana"}')),
  'CANCELAMENTO_ABERTO', 'um pedido aberto por cliente');
select is((select pg_temp.lista(com) -> 'contagens' ->> 'cancelamentos' from ids), '1', 'a aba conta o pedido aberto');
select is((select x ->> 'situacao' from jsonb_array_elements((select pg_temp.lista(com) -> 'cancelamentos' from ids)) x), 'PEDIDO', 'e o mostra');

-- 2. A tentativa de retenção: uma, com o motivo da lista.
select is(pg_temp.campos(format('select comercial_tentar_retencao(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  '{"motivo": "CARO", "retencao": "Oferecer acompanhamento"}')), '["motivo"]'::jsonb, 'o motivo vem da lista própria do cancelamento');
select is(pg_temp.campos(format('select comercial_tentar_retencao(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  '{"motivo": "OUTRO", "retencao": "Oferecer acompanhamento"}')), '["motivoTexto"]'::jsonb, 'outro motivo pede o texto');
select is(pg_temp.campos(format('select comercial_tentar_retencao(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  '{"motivo": "SINDICO_NOVO"}')), '["retencao"]'::jsonb, 'a tentativa diz o que foi oferecido');
select is(pg_temp.codigo(format('select comercial_tentar_retencao(%L, %L, 9, %L)', (select com from ids), (select k1 from k),
  '{"motivo": "SINDICO_NOVO", "retencao": "Apresentar à síndica nova"}')), 'TC409', 'com a versão velha é conflito');
select is((select comercial_tentar_retencao(com, k1, pg_temp.kv(k1), '{"motivo": "SINDICO_NOVO",
  "retencao": "Apresentar à síndica nova em 28/01; oferecer 2 meses de acompanhamento"}') ->> 'situacao' from ids, k), 'EM_RETENCAO',
  'quadro 347: registrar a tentativa e esperar');
select is(pg_temp.motivo(format('select comercial_tentar_retencao(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  '{"motivo": "PRECO", "retencao": "Outra tentativa"}')), 'RETENCAO_REGISTRADA', 'uma tentativa só');

-- 3. Confirmar é da Administração; antes do último dia, tudo continua.
select throws_ok(format('select comercial_confirmar_cancelamento(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)), '{}'),
  'TC401', null, 'o Comercial não confirma o cancelamento');
select is(pg_temp.campos(format('select comercial_confirmar_cancelamento(%L, %L, %s, %L)', (select adm from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  '{"lembrarEm": "2027-02-01"}')), '["lembrarEm"]'::jsonb, 'lembrar de reconquistar é depois do último dia');
create temp table conf as select comercial_confirmar_cancelamento(adm, k1, pg_temp.kv(k1), '{"lembrarEm": "2028-03-01"}') as r from ids, k;
select is((select r ->> 'situacao' from conf), 'CONFIRMADO', 'a decisão da síndica fica registrada');
select is((select motivo from cancelamentos_cliente where id = (select k1 from k)), 'SINDICO_NOVO', 'com o motivo da tentativa');
select is((select ultimo_dia from encerramentos_contrato where condominio_id = (select c_ipiranga from cc)), date '2027-02-23',
  'o condomínio guarda o último dia');
select is((select situacao || ' · ' || (pedida_por = (select ana from ids))::text from exportacoes where condominio_id = (select c_ipiranga from cc)),
  'MONTANDO · true', 'a exportação completa é pedida para a síndica');
select ok((select count(*) >= 1 from partes_exportacao p join exportacoes e on e.id = p.exportacao_id where e.condominio_id = (select c_ipiranga from cc)),
  'com os pacotes da exportação da Plataforma');
select is((select array_agg(acao || ' · ' || autor_tipo || ' · ' || interno::text order by acao) from historico
            where condominio_id = (select c_ipiranga from cc) and acao in ('contrato.encerramento_marcado', 'memoria.exportacao_pedida')),
  array['contrato.encerramento_marcado · SISTEMA · false', 'memoria.exportacao_pedida · SISTEMA · false'],
  'o histórico do condomínio (o síndico vê) mostra o último dia e a exportação, escritos pelo sistema');
select is((select sem_comissao_desde from comissoes_parceiro where interessado_id = (select ipiranga from i)), date '2027-03-01',
  'a comissão do parceiro acaba no último dia (sem comissão desde o mês seguinte)');
select is((select encerrada_motivo from comissoes_parceiro where interessado_id = (select ipiranga from i)), 'Cancelamento: último dia 23/02/2027',
  'encerrada pelo cancelamento');
select is(pg_temp.motivo(format('select comercial_cliente_ficou(%L, %L, %s, null)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)))),
  'CANCELAMENTO_DECIDIDO', 'confirmado não volta');
select is(pg_temp.motivo(format('update cancelamentos_cliente set pedido_por = %L where id = %L', 'Outra', (select k1 from k))), 'CANCELAMENTO_DECIDIDO',
  'o pedido decidido não muda');
select lives_ok(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'pedidos.atualizar'),
  'até o último dia, o acesso continua');
select is(pg_temp.motivo(format('select comercial_registrar_aviso(%L, %L, %L, %L)', (select com from ids), (select ipiranga from i), date '2027-11-01',
  '{"canal": "EMAIL", "para": "Ana", "texto": "Aviso de reajuste do contrato."}')), 'CLIENTE_CANCELADO', 'quem cancelou não tem mais renovação');

-- 4. Depois do último dia: a cobrança para e a Plataforma fica para ver e exportar.
select pg_temp.em('2027-02-24 09:00:00-03');
select is((select console_abrir_competencia(adm, date '2027-02-01') ->> 'criadas' from ids), '2', 'a competência do último dia ainda é cobrada');
select pg_temp.em('2027-03-02 09:00:00-03');
select is((select console_abrir_competencia(adm, date '2027-03-01') - 'jaAbertas' from ids), '{"criadas": 1, "semPlano": 0, "encerrados": 1}'::jsonb,
  'a cobrança para depois do último dia');
select ok(not exists (select 1 from cobrancas where condominio_id = (select c_ipiranga from cc) and competencia = '2027-03-01'), 'sem mensalidade de março');
select is(pg_temp.motivo(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'pedidos.atualizar')),
  'CONTRATO_ENCERRADO', 'depois do último dia, mudar não pode');
select lives_ok(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'pedidos.ver'), 'ver continua');
select lives_ok(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'memoria.exportar'), 'exportar continua');
select lives_ok(format('select entrar_condominio(%L, %L, %L)', (select adm from ids), (select c_ipiranga from cc), 'console.contrato.editar'),
  'a equipe continua no Console');
select is((select x ->> 'situacao' from jsonb_array_elements((select pg_temp.lista(com) -> 'cancelamentos' from ids)) x), 'ENCERRADO',
  'a aba mostra o encerrado');
select is((select x ->> 'situacao' from jsonb_array_elements((select pg_temp.lista(com) -> 'clientes' from ids)) x
            where x ->> 'condominio' = 'Edifício Ipiranga'), 'ENCERRADO', 'e o cliente encerrado');

-- 5. Ela decidiu ficar: o pedido fecha e um novo pode vir depois.
create temp table k2 as select (comercial_pedir_cancelamento(com, pequi, '{"pedidoPor": "Rui, síndico"}') ->> 'id')::uuid as k from ids, i;
select is((select comercial_cliente_ficou(com, k, pg_temp.kv(k), 'Ficou com o acompanhamento') ->> 'situacao' from ids, k2), 'FICOU',
  'a síndica decidiu ficar');
select ok(not exists (select 1 from encerramentos_contrato where condominio_id = (select c_pequi from cc)), 'nada muda no contrato');
select lives_ok($$ select comercial_pedir_cancelamento(com, pequi, '{"pedidoPor": "Rui, síndico"}') from ids, i $$, 'um pedido novo pode vir depois');

-- 6. LGPD: a rotina apaga os textos 12 meses depois do último dia; a anonimização, na hora.
select pg_temp.em('2028-02-25 09:00:00-03');
select ok(comercial_rotina_renovacoes() >= 1, 'a rotina diária roda');
select ok((select pedido_por is null and retencao is null and textos_apagados_em is not null and motivo = 'SINDICO_NOVO'
             from cancelamentos_cliente where id = (select k1 from k)), 'quem pediu e a tentativa saem; o motivo da lista fica');
select ok((select pedido_por is not null from cancelamentos_cliente where interessado_id = (select pequi from i) and situacao = 'PEDIDO'),
  'o pedido aberto fica');
select lives_ok($$ select comercial_anonimizar(pequi, 'Dado apagado (LGPD)') from i $$, 'a anonimização roda');
select ok((select bool_and(pedido_por is null and textos_apagados_em is not null) from cancelamentos_cliente where interessado_id = (select pequi from i)),
  'e apaga quem pediu');
select is((select count(*)::integer from historico where entidade = 'cancelamento_cliente'), 6, 'cada passo fica no histórico do Comercial');

select * from finish();
rollback;

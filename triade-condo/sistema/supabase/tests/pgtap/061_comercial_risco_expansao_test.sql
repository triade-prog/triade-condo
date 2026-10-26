-- Sinais de risco e expansão (0311, R17.7; CM-31 e CM-32; quadros 346 e 335): o síndico novo pela troca
-- de síndico do Console e marcado à mão, a troca de sistema na pauta, o uso caindo pela queda dos
-- pedidos (sem a medida de adoção, PI-13), o "já vi", o cartão do Início, a mudança de faixa sugerida,
-- o mais um prédio pela oportunidade nova do mesmo contato (CM-09), a reconquista de quem saiu e a LGPD.
begin;
select plan(46);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Iara', 'IMPLANTACAO') as imp,
  teste.pessoa('Ana Ribeiro') as ana,
  teste.pessoa('Rui Costa') as rui;
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
  (comercial_criar(com, '{"condominio": "Edifício Ipiranga", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990901"}') ->> 'id')::uuid as ipiranga,
  (comercial_criar(com, '{"condominio": "Residencial Pequi", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990902"}') ->> 'id')::uuid as pequi
  from ids;
create temp table cc as select pg_temp.cliente(ipiranga) as c_ipiranga, pg_temp.cliente(pequi) as c_pequi from i;
create temp table vin as select teste.vincular(ana, c_ipiranga, 'SINDICO') as v1, teste.vincular(rui, c_ipiranga, 'SINDICO') as v2 from ids, cc;
create function pg_temp.sinais(p_interessado uuid) returns jsonb language sql as $$
  select coalesce((select x -> 'sinais' from jsonb_array_elements(comercial_renovacoes((select com from ids), null) -> 'riscos') x
                    where x ->> 'interessadoId' = p_interessado::text), '[]'::jsonb)
$$;
create function pg_temp.sugestao(p_tipo text) returns jsonb language sql as $$
  select x from jsonb_array_elements(comercial_renovacoes((select com from ids), null) -> 'sugestoes') x where x ->> 'tipo' = p_tipo
$$;
create function pg_temp.ev(p uuid) returns integer language sql as $$ select versao from expansoes_cliente where id = p $$;

-- 1. Síndico novo pela troca de síndico registrada no Console (0190).
select pg_temp.em('2027-01-10 10:00:00-03');
insert into trocas_sindico (condominio_id, anterior_vinculo, novo_vinculo, pedido_por, canal, conferido, feita_por)
select c_ipiranga, v1, v2, 'Rui, síndico eleito', 'EMAIL', array['ATA'], (select imp from ids) from cc, vin;
select is((select pg_temp.sinais(ipiranga) -> 0 ->> 'tipo' || ' · ' || (pg_temp.sinais(ipiranga) -> 0 ->> 'origem') from i), 'SINDICO_NOVO · TROCA_SINDICO',
  'a troca de síndico vira sinal de risco para o Comercial');
select ok((select comercial_renovacoes(com, null)::text not like '%Rui%' from ids), 'CM-11: sem o nome de quem pediu a troca');

-- 2. Marcar à mão: troca de sistema na pauta.
select is(pg_temp.campos(format('select comercial_marcar_risco(%L, %L, %L)', (select com from ids), (select pequi from i), '{"tipo": "USO_CAINDO", "data": "2027-02-01"}')),
  '["tipo"]'::jsonb, 'uso caindo não se marca à mão');
select is(pg_temp.campos(format('select comercial_marcar_risco(%L, %L, %L)', (select com from ids), (select pequi from i), '{"tipo": "TROCA_NA_PAUTA"}')),
  '["data"]'::jsonb, 'a troca na pauta pede a data da assembleia');
create temp table s as select (comercial_marcar_risco(com, pequi, '{"tipo": "TROCA_NA_PAUTA", "data": "2027-02-12", "detalhe": "Pauta da AGO"}') ->> 'id')::uuid as pauta
  from ids, i;
select is(pg_temp.motivo(format('select comercial_marcar_risco(%L, %L, %L)', (select com from ids), (select pequi from i), '{"tipo": "TROCA_NA_PAUTA", "data": "2027-02-12"}')),
  'SINAL_REGISTRADO', 'o mesmo sinal não entra duas vezes');
select is((select pg_temp.sinais(pequi) -> 0 ->> 'data' from i), '2027-02-12', 'a aba Risco mostra a troca de sistema na pauta');
select is((select comercial_inicio(com) -> 'contagens' ->> 'riscos' from ids), '2', 'quadro 335: os clientes com sinal contam no Início');
select is((select x -> 'risco' ->> 'tipo' from jsonb_array_elements(comercial_inicio((select com from ids)) -> 'itens') x
            where x ->> 'id' = (select pequi::text from i)), 'TROCA_NA_PAUTA', 'e aparecem com o sinal');

-- 3. Já vi: o sinal sai da lista.
select is(pg_temp.codigo(format('select comercial_tratar_risco(%L, %L, 9, null)', (select com from ids), (select pauta from s))), 'TC409',
  'tratar com a versão velha é conflito');
select is((select comercial_tratar_risco(com, pauta, 1, 'Conversei com o síndico') ->> 'tratado' from ids, s), 'true', 'já vi');
select is((select jsonb_array_length(pg_temp.sinais(pequi)) from i), 0, 'o sinal tratado sai da aba');
select is(pg_temp.motivo(format('select comercial_tratar_risco(%L, %L, 2, null)', (select com from ids), (select pauta from s))), 'SINAL_TRATADO',
  'tratar de novo não muda');

-- 4. Uso caindo: os pedidos dos últimos 30 dias contra os 30 anteriores, pela rotina diária.
create temp table inc as select plataforma_incluir_unidades(ana, c_ipiranga, null, (select jsonb_agg(jsonb_build_object('identificacao', n::text)) from generate_series(1, 101) n))
  from ids, cc;
create temp table pc as select
  (select id from unidades where condominio_id = c_ipiranga and identificacao = '1') as u1,
  (select id from categorias where condominio_id = c_ipiranga and modelo = 'MANUTENCAO') as cat,
  (select id from prioridades where condominio_id = c_ipiranga and modelo = 'NORMAL') as pri
  from cc;
select pg_temp.em('2027-01-11 10:00:00-03');
create temp table ped as select count(plataforma_registrar_pedido(ana, c_ipiranga, u1, null, null, cat, pri, 'Pedido ' || n, 'Descrição do pedido ' || n, 'TELEFONE', false, null))
  from ids, cc, pc, generate_series(1, 12) n;
select pg_temp.em('2027-02-25 10:00:00-03');
select ok(comercial_rotina_renovacoes() >= 1, 'a rotina diária roda');
select is((select x ->> 'detalhe' from jsonb_array_elements((select pg_temp.sinais(ipiranga) from i)) x where x ->> 'tipo' = 'USO_CAINDO'),
  'Uso caiu 100% em 30 dias', 'sem a medida de adoção (PI-13), a queda dos pedidos vira sinal');
select is(comercial_rotina_renovacoes(), 0, 'uma vez por mês');

-- 5. Expansão: mudar de faixa aparece como sugestão e entra no funil.
select is((select pg_temp.sugestao('MUDAR_FAIXA') ->> 'motivo'), 'Passou de 100 unidades ativas', 'unidades ativas acima do limite da faixa do plano');
select is(pg_temp.campos(format('select comercial_salvar_expansao(%L, null, null, %L)', (select com from ids),
  jsonb_build_object('interessadoId', (select ipiranga from i), 'tipo', 'MUDAR_FAIXA', 'motivo', 'Passou de 100 unidades ativas', 'proximoPasso', 'Ligar'))),
  '["responsavelId"]'::jsonb, 'a expansão tem responsável');
select is(pg_temp.campos(format('select comercial_salvar_expansao(%L, null, null, %L)', (select com from ids),
  jsonb_build_object('interessadoId', (select ipiranga from i), 'tipo', 'MUDAR_FAIXA', 'motivo', 'Passou de 100', 'responsavelId', (select com from ids)))),
  '["proximoPasso"]'::jsonb, 'e próximo passo');
create temp table e as select (comercial_salvar_expansao(com, null, null, jsonb_build_object('interessadoId', ipiranga, 'tipo', 'MUDAR_FAIXA',
  'motivo', 'Passou de 100 unidades ativas', 'responsavelId', com, 'proximoPasso', 'Mostrar a faixa nova ao síndico', 'proximoPassoData', '2027-03-01')) ->> 'id')::uuid as faixa
  from ids, i;
select is((select etapa from expansoes_cliente where id = (select faixa from e)), 'ABERTA', 'a mudança de faixa entra no funil de expansão');
select ok(pg_temp.sugestao('MUDAR_FAIXA') is null, 'e sai das sugestões');
select is(pg_temp.motivo(format('select comercial_salvar_expansao(%L, null, null, %L)', (select com from ids),
  jsonb_build_object('interessadoId', (select ipiranga from i), 'tipo', 'MUDAR_FAIXA', 'motivo', 'De novo', 'responsavelId', (select com from ids), 'proximoPasso', 'Ligar'))),
  'EXPANSAO_ABERTA', 'uma aberta de cada tipo por cliente');
select is(pg_temp.motivo(format('select comercial_salvar_expansao(%L, null, null, %L)', (select com from ids),
  jsonb_build_object('interessadoId', (select ipiranga from i), 'tipo', 'RECONQUISTA', 'motivo', 'Voltar', 'responsavelId', (select com from ids), 'proximoPasso', 'Ligar'))),
  'NAO_SAIU', 'reconquista é de quem saiu');
select is((select comercial_salvar_expansao(com, faixa, pg_temp.ev(faixa), jsonb_build_object('etapa', 'PROPOSTA', 'motivo', 'Passou de 100 unidades ativas',
  'responsavelId', com, 'proximoPasso', 'Mandar a proposta da faixa nova')) ->> 'etapa' from ids, e), 'PROPOSTA', 'a expansão anda no funil');
select is(pg_temp.campos(format('select comercial_encerrar_expansao(%L, %L, %s, %L, null)', (select com from ids), (select faixa from e), pg_temp.ev((select faixa from e)), 'PERDIDA')),
  '["resultado"]'::jsonb, 'perder pede o que aconteceu');
select is((select comercial_encerrar_expansao(com, faixa, pg_temp.ev(faixa), 'GANHA', null) ->> 'etapa' from ids, e), 'GANHA', 'ganhou');
select is((select valor_centavos::bigint from planos_cliente where condominio_id = (select c_ipiranga from cc)), 22900::bigint,
  'ganhar a mudança de faixa não muda o plano sozinho');
select ok(pg_temp.sugestao('MUDAR_FAIXA') is null, 'r12: encerrada há pouco, a sugestão de mudar de faixa não volta');
select is(pg_temp.motivo(format('select comercial_salvar_expansao(%L, %L, %s, %L)', (select com from ids), (select faixa from e), pg_temp.ev((select faixa from e)),
  jsonb_build_object('etapa', 'ABERTA', 'motivo', 'Reabrir', 'responsavelId', (select com from ids), 'proximoPasso', 'Ligar'))), 'EXPANSAO_ENCERRADA',
  'encerrada não reabre');

-- 6. Mais um prédio da mesma pessoa (CM-09): a oportunidade nova pela 0308.
create temp table e2 as select comercial_salvar_expansao(com, null, null, jsonb_build_object('interessadoId', ipiranga, 'tipo', 'MAIS_UM_PREDIO',
  'motivo', 'Síndica profissional de 3 prédios; 2 já são clientes', 'responsavelId', com, 'proximoPasso', 'Marcar a visita',
  'oportunidade', jsonb_build_object('condominio', 'Edifício Mangaba', 'cidade', 'Brasília', 'uf', 'DF'))) as r from ids, i;
select is((select o.condominio || ' · ' || o.etapa || ' · ' || (o.contato_de = (select ipiranga from i))::text
             from interessados o where o.id = (select (r -> 'oportunidade' ->> 'id')::uuid from e2)), 'Edifício Mangaba · NOVO · true',
  'a oportunidade nova nasce do mesmo contato, no funil');
select is((select r ->> 'tipo' from e2), 'MAIS_UM_PREDIO', 'e fica na expansão do cliente');

-- 7. Reconquista: o cliente que saiu, lembrado quando há síndico novo.
create temp table k as select (comercial_pedir_cancelamento(com, pequi, '{"pedidoPor": "Síndico do Pequi"}') ->> 'id')::uuid as k1 from ids, i;
create temp table conf as select comercial_confirmar_cancelamento(adm, k1, (select versao from cancelamentos_cliente where id = k1), '{"motivo": "PRECO"}') as r from ids, k;
select is(pg_temp.motivo(format('select comercial_marcar_risco(%L, %L, %L)', (select com from ids), (select pequi from i), '{"tipo": "TROCA_NA_PAUTA", "data": "2027-04-12"}')),
  'CLIENTE_CANCELADO', 'troca na pauta não vale para quem cancelou');
select pg_temp.em('2027-04-10 10:00:00-03');
select ok(pg_temp.sugestao('RECONQUISTA') is null, 'sem síndico novo nem data combinada, não lembra');
select lives_ok($$ select comercial_marcar_risco(com, pequi, '{"tipo": "SINDICO_NOVO", "data": "2027-04-05"}') from ids, i $$,
  'o síndico novo de quem saiu é marcado à mão');
select is((select pg_temp.sugestao('RECONQUISTA') ->> 'motivo'), 'Saiu em 03/2027; síndico novo em 04/2027', 'e vira lembrete de reconquista');
select ok((select jsonb_array_length(pg_temp.sinais(pequi)) = 0 from i), 'quem saiu não aparece em Risco');
create temp table rq as select comercial_salvar_expansao(com, null, null, jsonb_build_object('interessadoId', pequi, 'tipo', 'RECONQUISTA',
  'motivo', 'Saiu em 03/2027; síndico novo em 04/2027', 'responsavelId', com, 'proximoPasso', 'Apresentar ao síndico novo')) as r from ids, i;
select is((select r ->> 'tipo' from rq), 'RECONQUISTA', 'a reconquista entra no funil de expansão');
select is((select comercial_encerrar_expansao(com, (r ->> 'id')::uuid, (r ->> 'versao')::integer, 'PERDIDA', 'O síndico novo ficou com outro sistema') ->> 'etapa'
             from ids, rq), 'PERDIDA', 'a reconquista é perdida');
select ok(pg_temp.sugestao('RECONQUISTA') is null, 'r12: perdida, o mesmo síndico novo não vira lembrete de novo');

-- 8. LGPD: a anonimização fecha a expansão e apaga os textos; a rotina apaga o detalhe dos sinais tratados.
select lives_ok($$ select comercial_anonimizar(pequi, 'Dado apagado (LGPD)') from i $$, 'a anonimização roda');
select ok((select bool_and(etapa = 'PERDIDA' and motivo = 'Dado apagado (LGPD)' and proximo_passo is null) from expansoes_cliente
            where interessado_id = (select pequi from i)), 'a expansão fecha sem os textos');
select ok((select bool_and(detalhe is null and tratado_nota is null) from riscos_cliente where interessado_id = (select pequi from i)),
  'e os sinais ficam sem detalhe');
select ok((select bool_and(resultado = 'Dado apagado (LGPD)') from expansoes_cliente where interessado_id = (select pequi from i)),
  'r8: e o resultado da expansão encerrada também sai');
-- A nota de um sinal automático tratado e os textos da expansão encerrada saem 12 meses depois.
select is((select comercial_tratar_risco(com, s.id, s.versao, 'Falei com o Rui, síndico novo') ->> 'tratado' from ids, riscos_cliente s
            where s.interessado_id = (select ipiranga from i) and s.origem = 'TROCA_SINDICO'), 'true', 'o sinal da troca é tratado com uma nota');
select pg_temp.em('2028-05-01 10:00:00-03');
select ok(comercial_rotina_renovacoes() >= 0, 'a rotina roda um ano depois');
select ok((select tratado_nota is null and detalhe = 'Troca de síndico registrada no Console' from riscos_cliente
            where interessado_id = (select ipiranga from i) and origem = 'TROCA_SINDICO'), 'r8: a nota sai; o detalhe automático, sem pessoa, fica');
select ok((select motivo = 'Dado apagado (LGPD)' and proximo_passo is null from expansoes_cliente where id = (select faixa from e)),
  'r8: a expansão encerrada perde os textos');

select * from finish();
rollback;

-- Desfazer o cancelamento e reativar quem voltou (0318, R17.7c; CM-31, CM-32, CM-13 e CM-30;
-- quadros 487, 488 e 491): desfazer antes do último dia (Administração, com nota; o último dia
-- revogado e a comissão reaberta); Modelos › Aditivo com as partes Reajuste e Retorno; o aditivo de
-- retorno pela tabela cheia do dia (sob consulta acima de 400); as assinaturas pelo gov.br como no
-- contrato; reativar só com as duas conferidas (plano novo, reconquista ganha, aniversário da
-- reativação); o pedido novo depois; a retenção e a anonimização.
begin;
select plan(131);

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
create function pg_temp.mv(p uuid) returns integer language sql as $$ select versao from modelos_aditivo where id = p $$;
create function pg_temp.ev(p uuid) returns integer language sql as $$ select versao from envios_aditivo where id = p $$;
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
-- O cliente com contrato assinado pelos dois (como no 060).
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
-- O cancelamento confirmado com o pedido em 24/01/2027 (último dia 23/02/2027).
create function pg_temp.confirmado(p_interessado uuid, p_dados jsonb default '{}') returns uuid language plpgsql as $$
declare k uuid;
begin
  k := (comercial_pedir_cancelamento((select com from ids), p_interessado, '{"pedidoPor": "Lúcia Prado, síndica"}') ->> 'id')::uuid;
  perform comercial_tentar_retencao((select com from ids), k, pg_temp.kv(k), '{"motivo": "PRECO", "retencao": "Oferecer dois meses de acompanhamento"}');
  perform comercial_confirmar_cancelamento((select adm from ids), k, pg_temp.kv(k), p_dados);
  return k;
end $$;
-- O PDF assinado de uma parte, conferido pela conferência automática (a API) e pela equipe.
create function pg_temp.assinar(p_aditivo uuid, p_parte text, p_base text, p_assinaturas integer, p_conferir jsonb) returns uuid language plpgsql as $$
declare e uuid;
begin
  e := (comercial_iniciar_envio_aditivo(case p_parte when 'TRIADE' then (select adm from ids) else (select com from ids) end, p_aditivo,
                                        jsonb_build_object('parte', p_parte, 'nome', lower(p_parte) || '.pdf', 'tamanho', 4000 + p_assinaturas * 500))
        ->> 'envioId')::uuid;
  perform comercial_verificar_envio_aditivo((select com from ids), e, jsonb_build_object('valido', true, 'sha256', pg_temp.sha(e::text),
    'tamanho', 4000 + p_assinaturas * 500, 'assinaturas', p_assinaturas, 'prefixoSha256', p_base, 'assinaturaNova', true, 'soAssinatura', true));
  if p_conferir is not null then
    perform comercial_conferir_envio_aditivo((select com from ids), e, pg_temp.ev(e),
      '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}'::jsonb || p_conferir);
  end if;
  return e;
end $$;
create function pg_temp.lista(p_pessoa uuid) returns jsonb language sql as $$ select comercial_renovacoes(p_pessoa, null) $$;
create function pg_temp.canc(p_id uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements((select pg_temp.lista(adm) -> 'cancelamentos' from ids)) x where x ->> 'id' = p_id::text $$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajuste pelo «indice_reajuste».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
        '2026-10-20', 'EM_USO', app_now());
create temp table i as select
  (comercial_criar(com, '{"condominio": "Edifício Ipiranga", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990801"}') ->> 'id')::uuid as ipiranga,
  (comercial_criar(com, '{"condominio": "Residencial Pequi", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990802"}') ->> 'id')::uuid as pequi,
  (comercial_criar(com, '{"condominio": "Condomínio Cerrado", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990803"}') ->> 'id')::uuid as cerrado
  from ids;
create temp table cc as select pg_temp.cliente(ipiranga) as c_ipiranga, pg_temp.cliente(pequi) as c_pequi, pg_temp.cliente(cerrado) as c_cerrado from i;
select teste.vincular(ana, c_ipiranga, 'SINDICO') from ids, cc;
insert into parceiros_comercial (id, tipo, nome) values ('6f1d7a52-1c1f-4f7e-9f3a-2b8b5c0c9a11', 'SINDICO_PROFISSIONAL', 'Marta Lins');
insert into comissoes_parceiro (parceiro_id, interessado_id, condominio_id, condominio, percentual, inicio, mensal_centavos)
select '6f1d7a52-1c1f-4f7e-9f3a-2b8b5c0c9a11', ipiranga, c_ipiranga, 'Edifício Ipiranga', 10, '2026-11-01', 22900 from i, cc;

-- 1. Modelos › Aditivo com duas partes (C1).
create temp table mod as select
  comercial_salvar_modelo_aditivo(adm, null, null, jsonb_build_object('titulo', 'Aditivo de reajuste',
    'texto', 'O contrato «contrato» do «condominio» passa de «valor_atual» para «valor_novo» a partir de «vale_desde».')) as reajuste
  from ids;
select is(pg_temp.campos(format('select comercial_salvar_modelo_aditivo(%L, null, null, %L)', (select adm from ids),
  '{"tipo": "OUTRO", "titulo": "Aditivo", "texto": "Texto qualquer com mais de cinquenta letras para passar no tamanho."}')), '["tipo"]'::jsonb,
  'o tipo é Reajuste ou Retorno');
select is((select teste.erro(format('select comercial_salvar_modelo_aditivo(%L, null, null, %L)', (select adm from ids),
  '{"tipo": "RETORNO", "titulo": "Aditivo de retorno", "texto": "O «condominio» volta pelo contrato «contrato» a partir de «vale_desde», com reajuste em «aniversario»."}'))
  -> 'detalhe' -> 'camposErrados'), '["«aniversario»"]'::jsonb, 'cada parte tem os seus campos: o retorno não tem aniversário');
create temp table modr as select comercial_salvar_modelo_aditivo(adm, null, null, jsonb_build_object('tipo', 'RETORNO', 'titulo', 'Aditivo de retorno',
  'texto', 'O «condominio» (CNPJ «cnpj»), por «representante» (CPF «cpf_representante»), volta ao contrato «contrato» de «data_contrato», '
        || 'encerrado em «ultimo_dia», no plano «plano», por «valor_mensal», a partir da «vale_desde».')) as r from ids;
select is((select r ->> 'tipo' || ' v' || (r ->> 'numero') from modr), 'RETORNO v1', 'a parte Retorno numera as suas versões');
select is((select (reajuste ->> 'tipo') || ' v' || (reajuste ->> 'numero') from mod), 'REAJUSTE v1',
  'e a parte Reajuste as dela (o tipo padrão é Reajuste)');
select throws_ok($$ select comercial_salvar_modelo_aditivo(com, null, null, '{"tipo": "RETORNO", "titulo": "X", "texto": "Y"}') from ids $$, 'TC401', null,
  'o Comercial não cadastra modelo');
select is(pg_temp.campos(format('select comercial_salvar_modelo_aditivo(%L, %L, %s, %L)', (select adm from ids), (select r ->> 'id' from modr),
  (select r ->> 'versao' from modr), jsonb_build_object('tipo', 'REAJUSTE', 'titulo', 'Aditivo de retorno', 'texto', (select r ->> 'texto' from modr)))),
  '["tipo"]'::jsonb, 'o modelo não troca de tipo');
select comercial_usar_modelo_aditivo(adm, (reajuste ->> 'id')::uuid, (reajuste ->> 'versao')::integer) from ids, mod;
select is((select comercial_modelos_aditivo(com) -> 'campos' -> 'RETORNO' from ids),
  '["condominio", "cnpj", "representante", "cpf_representante", "contrato", "data_contrato", "ultimo_dia", "plano", "valor_mensal", "vale_desde"]'::jsonb,
  'Modelos › Aditivo mostra os campos do Retorno');
select is((select comercial_modelos_aditivo(com) -> 'campos' -> 'REAJUSTE' from ids), (select to_jsonb(aditivo_campos())),
  'e os do Reajuste, os de antes');
select is((select array_agg((x ->> 'tipo') || ' v' || (x ->> 'numero') || ' ' || (x ->> 'situacao'))
             from jsonb_array_elements((select comercial_modelos_aditivo(com) -> 'versoes' from ids)) x),
  array['REAJUSTE v1 EM_USO', 'RETORNO v1 RASCUNHO'], 'as versões das duas partes, cada uma com o seu tipo');
select is((select comercial_modelos_aditivo(com) -> 'emUso' ->> 'tipo' from ids), 'REAJUSTE', 'a versão em uso de antes é a do Reajuste');

-- 2. Desfazer antes do último dia (F5, quadro 487).
select pg_temp.em('2027-01-24 11:20:00-03');
create temp table k as select pg_temp.confirmado(ipiranga) as k1, pg_temp.confirmado(pequi, '{"lembrarEm": "2027-06-01"}') as k2,
  pg_temp.confirmado(cerrado) as k3 from i;
select is((select encerrada_motivo from comissoes_parceiro where interessado_id = (select ipiranga from i)), 'Cancelamento: último dia 23/02/2027',
  'a confirmação encerrou a comissão do parceiro');
select is((select pg_temp.canc(k1) -> 'comissao' from k), '{"parceiro": "Marta Lins", "semComissaoDesde": "2027-03-01"}'::jsonb,
  'o cancelamento mostra a linha Comissão (quadro 487)');
select ok((select pg_temp.canc(k2) -> 'comissao' is null and pg_temp.canc(k2) -> 'retornoPlano' is null from k),
  'sem parceiro, sem a linha; antes do último dia, sem a prévia do plano da volta');
select throws_ok(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  'A síndica desistiu'), 'TC401', null, 'só a Administração desfaz');
select is(pg_temp.campos(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', (select adm from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  ' ')), '["nota"]'::jsonb, 'a nota é obrigatória');
select is(pg_temp.codigo(format('select comercial_desfazer_cancelamento(%L, %L, 1, %L)', (select adm from ids), (select k1 from k), 'A síndica desistiu')),
  'TC409', 'com a versão velha é conflito');
select is(pg_temp.motivo(format('select comercial_gerar_aditivo_retorno(%L, %L, %L)', (select adm from ids), (select k1 from k), '{}')),
  'ANTES_DO_ULTIMO_DIA', 'antes do último dia não há aditivo de retorno (é desfazer)');
select is(pg_temp.motivo(format('select comercial_reativar_cliente(%L, %L, %s, %L)', (select adm from ids), (select k1 from k), pg_temp.kv((select k1 from k)), '{}')),
  'ANTES_DO_ULTIMO_DIA', 'nem reativar');
select is(pg_temp.motivo(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', (select adm from ids), (select ipiranga from i), 1, 'Nota')), null,
  'quem não é cancelamento não existe') ;
create temp table des as select comercial_desfazer_cancelamento(adm, k1, pg_temp.kv(k1), 'Lúcia ligou em 26/01: a assembleia decidiu ficar') as r
  from ids, k;
select is((select r -> 'cancelamento' ->> 'situacao' from des), 'DESFEITO', 'o cancelamento fica desfeito');
select is((select r -> 'cancelamento' ->> 'desfeitoNota' from des), 'Lúcia ligou em 26/01: a assembleia decidiu ficar', 'com a nota');
select is((select r -> 'cancelamento' -> 'desfeitoPor' ->> 'nome' from des), 'Carolina', 'e quem desfez');
select ok((select (r -> 'cancelamento' ->> 'desfeitoEm') is not null from des), 'e quando');
select is((select revogado_motivo from encerramentos_contrato where cancelamento_id = (select k1 from k)),
  'Cancelamento desfeito: Lúcia ligou em 26/01: a assembleia decidiu ficar', 'o último dia é revogado, e o registro fica');
select ok((select revogado_em is not null and revogado_por = (select adm from ids) from encerramentos_contrato where cancelamento_id = (select k1 from k)),
  'com quem e quando');
select is((select num_nonnulls(sem_comissao_desde, encerrada_motivo, encerrada_em, encerrada_por) from comissoes_parceiro
            where interessado_id = (select ipiranga from i)), 0, 'a comissão do parceiro reabre');
select is((select pg_temp.canc(k1) -> 'comissao' from k), '{"parceiro": "Marta Lins"}'::jsonb, 'e a linha Comissão fica sem a data de fim');
select is((select array_agg(acao || ' · ' || autor_tipo || ' · ' || interno::text order by acao) from historico
            where condominio_id = (select c_ipiranga from cc) and acao like 'contrato.%'),
  array['contrato.encerramento_marcado · SISTEMA · false', 'contrato.encerramento_revogado · SISTEMA · false'],
  'o histórico do condomínio mostra o último dia e a revogação');
select is((select count(*)::integer from historico where acao in ('comercial.cancelamento_desfeito', 'comercial.comissao_reaberta')), 2,
  'e o do Comercial, o desfazer e a comissão reaberta');
select ok(exists (select 1 from conversas_comercial where interessado_id = (select ipiranga from i)
                   and resumo = 'Cancelamento desfeito: Lúcia ligou em 26/01: a assembleia decidiu ficar'), 'a nota fica na conversa');
select ok((select exportacao_id is not null from cancelamentos_cliente where id = (select k1 from k))
          and exists (select 1 from exportacoes where id = (select exportacao_id from cancelamentos_cliente where id = (select k1 from k))),
  'a exportação já pedida continua');
select is(pg_temp.motivo(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', (select adm from ids), (select k1 from k), pg_temp.kv((select k1 from k)),
  'De novo')), 'CANCELAMENTO_DECIDIDO', 'desfeito uma vez só');
select is(pg_temp.motivo(format('update cancelamentos_cliente set desfeito_nota = %L where id = %L', 'Outra nota', (select k1 from k))),
  'CANCELAMENTO_DECIDIDO', 'e não muda mais');
select is(pg_temp.motivo(format('select comercial_cliente_ficou(%L, %L, %s, null)', (select com from ids), (select k1 from k), pg_temp.kv((select k1 from k)))),
  'CANCELAMENTO_DECIDIDO', 'nem volta a ser decidido');
select is((select x ->> 'situacao' from jsonb_array_elements((select pg_temp.lista(com) -> 'clientes' from ids)) x where x ->> 'condominio' = 'Edifício Ipiranga'),
  'ATIVO', 'B4: o cliente com o cancelamento desfeito é cliente ativo');
select is((select pg_temp.canc(k1) ->> 'situacao' from k), 'DESFEITO', 'e o desfeito aparece na aba');
select is((select pg_temp.lista(adm) -> 'pode' ->> 'desfazer' from ids), 'true', 'a Administração pode desfazer');
select lives_ok(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'pedidos.atualizar'),
  'a síndica segue com tudo');

-- 3. Depois do último dia, desfazer não serve: é o aditivo de retorno (F6, quadro 488).
select pg_temp.em('2027-02-24 09:00:00-03');
select is(pg_temp.motivo(format('select entrar_condominio(%L, %L, %L)', (select ana from ids), (select c_ipiranga from cc), 'pedidos.atualizar')), null,
  'o desfeito não fecha no dia seguinte ao último');
select is(pg_temp.motivo(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', (select adm from ids), (select k2 from k), pg_temp.kv((select k2 from k)),
  'Tarde demais')), 'ULTIMO_DIA_PASSOU', 'depois do último dia não se desfaz');
select is((select contrato_encerrado(c_pequi) from cc), true, 'o Pequi está encerrado');
create temp table rq as select (comercial_salvar_expansao(com, null, null, jsonb_build_object('interessadoId', pequi, 'tipo', 'RECONQUISTA',
  'motivo', 'Lembrar em junho', 'responsavelId', com, 'proximoPasso', 'Ligar para a síndica')) ->> 'id')::uuid as e from ids, i;
select throws_ok(format('select comercial_gerar_aditivo_retorno(%L, %L, %L)', (select com from ids), (select k2 from k), '{}'), 'TC401', null,
  'o aditivo de retorno é da Administração');
select is(pg_temp.motivo(format('select comercial_gerar_aditivo_retorno(%L, %L, %L)', (select adm from ids), (select k2 from k), '{}')),
  'SEM_MODELO_RETORNO', 'sem modelo de retorno em uso, não gera');
select comercial_usar_modelo_aditivo(adm, (r ->> 'id')::uuid, (r ->> 'versao')::integer) from ids, modr;
select is((select count(*)::integer from modelos_aditivo where situacao = 'EM_USO'), 2, 'uma versão em uso de cada parte');
create function pg_temp.gerar(p_k uuid, p_dados jsonb) returns jsonb language sql as $$
  select comercial_gerar_aditivo_retorno((select adm from ids), p_k, p_dados) $$;
select is(pg_temp.motivo(format('select pg_temp.gerar(%L, %L)', (select k2 from k),
  '{"representante": "Lúcia Prado", "cpf": "52998224725", "competencia": "2027-03-01", "ciclo": "MENSAL"}')), 'SEM_UNIDADES_ATIVAS',
  'a faixa vem das unidades ativas');
insert into unidades (condominio_id, identificacao) select c_pequi, 'P' || g from cc, generate_series(1, 72) g;
insert into unidades (condominio_id, identificacao) select c_cerrado, 'C' || g from cc, generate_series(1, 450) g;
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k2 from k), '{"cpf": "52998224725", "competencia": "2027-03-01", "ciclo": "MENSAL"}')),
  '["representante"]'::jsonb, 'diz quem assina pelo condomínio');
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k2 from k),
  '{"representante": "Lúcia Prado", "cpf": "52998224700", "competencia": "2027-03-01", "ciclo": "MENSAL"}')), '["cpf"]'::jsonb, 'com CPF válido');
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k2 from k),
  '{"representante": "Lúcia Prado", "cpf": "52998224725", "competencia": "2027-01-01", "ciclo": "MENSAL"}')), '["competencia"]'::jsonb,
  'a competência vai de hoje a seis meses');
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k2 from k),
  '{"representante": "Lúcia Prado", "cpf": "52998224725", "competencia": "2027-03-01", "ciclo": "MENSAL", "valorCentavos": 1000}')),
  '["valorCentavos"]'::jsonb, 'o valor vem da tabela (só a faixa sob consulta recebe valor)');
select is((select pg_temp.canc(k2) -> 'retornoPlano' from k), '{"unidades": 72, "faixa": "DE_41_A_100", "valor": 34900, "sobConsulta": false}'::jsonb,
  'o encerrado traz a prévia do plano da volta pela tabela do dia');
select is((select pg_temp.canc(k3) -> 'retornoPlano' from k), '{"unidades": 450, "faixa": "ACIMA_DE_400", "sobConsulta": true}'::jsonb,
  'acima de 400, sob consulta e sem valor');
create temp table ad1 as select pg_temp.gerar(k2, '{"representante": "Lúcia Prado", "cpf": "529.982.247-25", "competencia": "2027-03-01", "ciclo": "MENSAL"}') as r
  from k;
select is((select r -> 'dados' -> 'retorno' from ad1),
  '{"competencia": "2027-03-01", "ciclo": "MENSAL", "valor": 34900, "valorMensal": 34900, "tabela": "CHEIA", "faixa": "DE_41_A_100",
    "nome": "Tabela cheia, 41 a 100 unidades", "unidadesDe": 41, "unidadesAte": 100, "unidades": 72}'::jsonb,
  'C3: o plano é a tabela cheia do dia pela faixa das unidades ativas');
select is((select r -> 'dados' -> 'campos' from ad1),
  '{"condominio": "Residencial Pequi", "cnpj": "11.222.333/0001-81", "representante": "Lúcia Prado", "cpf_representante": "529.982.247-25",
    "contrato": "nº 1", "data_contrato": "01/11/2026", "ultimo_dia": "23/02/2027", "plano": "Tabela cheia, 41 a 100 unidades (ciclo mensal)",
    "valor_mensal": "R$ 349,00 por mês", "vale_desde": "competência de 03/2027"}'::jsonb, 'com os campos do aditivo de retorno');
select ok((select r -> 'dados' ->> 'texto' !~ '[«»]' and r -> 'dados' ->> 'texto' ~ 'por Lúcia Prado \(CPF 529.982.247-25\)' from ad1),
  'o texto sai com os campos preenchidos');
select is((select r ->> 'hash' from ad1), (select comercial_hash(r -> 'dados') from ad1), 'o retrato tem a impressão digital');
select is((select tipo || ' · ' || situacao || ' · ' || numero from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad1)),
  'RETORNO · GERANDO · 1', 'o aditivo de retorno fica montando');
select is((select comercial_aditivo_a_montar(adm, (r ->> 'aditivoId')::uuid) ->> 'hash' from ids, ad1), (select r ->> 'hash' from ad1),
  'se a API cair no meio, monta o mesmo retrato');
select is(pg_temp.motivo(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select com from ids), (select r ->> 'aditivoId' from ad1),
  '{"parte": "CONDOMINIO", "nome": "a.pdf", "tamanho": 4500}')), 'ADITIVO_GERANDO', 'não recebe assinatura antes de montar');
select is((select comercial_aditivo_pronto(adm, (r ->> 'aditivoId')::uuid, pg_temp.sha('ad1'), 4000) ->> 'situacao' from ids, ad1), 'PRONTO',
  'a volta do aditivo_pronto é a mesma');
select is(pg_temp.motivo(format('select comercial_reativar_cliente(%L, %L, %s, %L)', (select adm from ids), (select k2 from k), pg_temp.kv((select k2 from k)), '{}')),
  'ADITIVO_SEM_ASSINATURAS', 'sem as duas assinaturas não reativa');

-- 4. As assinaturas pelo gov.br (C4): o condomínio e depois a TRÍADE, conferidos como no contrato.
select is(pg_temp.motivo(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select adm from ids), (select r ->> 'aditivoId' from ad1),
  '{"parte": "TRIADE", "nome": "t.pdf", "tamanho": 4500}')), 'ORDEM_DAS_ASSINATURAS', 'primeiro o condomínio');
select throws_ok(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select com from ids), (select r ->> 'aditivoId' from ad1),
  '{"parte": "TRIADE", "nome": "t.pdf", "tamanho": 4500}'), 'TC401', null, 'quem assina pela TRÍADE é quem pode assinar');
create temp table en as select pg_temp.assinar((r ->> 'aditivoId')::uuid, 'CONDOMINIO', pg_temp.sha('ad1'), 1, null) as e1 from ad1;
select is((select situacao from envios_aditivo where id = (select e1 from en)), 'A_CONFERIR', 'o PDF do síndico passou na conferência automática');
select is(pg_temp.motivo(format('select comercial_conferir_envio_aditivo(%L, %L, %s, %L)', (select com from ids), (select e1 from en),
  pg_temp.ev((select e1 from en)), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "cpf": "11144477735"}')),
  'CPF_NAO_CONFERE_ADITIVO', 'o CPF do validador é o do representante do aditivo');
select is(pg_temp.campos(format('select comercial_conferir_envio_aditivo(%L, %L, %s, %L)', (select com from ids), (select e1 from en),
  pg_temp.ev((select e1 from en)), '{"assinaturaValida": true}')), '["pessoaConfere", "dataConfere"]'::jsonb, 'as três marcas do validador');
select is((select comercial_conferir_envio_aditivo(com, e1, pg_temp.ev(e1), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}')
            -> 'aditivo' -> 'assinaturas' -> 'condominio' ->> 'situacao' from ids, en), 'CONFERIDA', 'conferida, com o CPF do representante');
select is((select assinante_nome || ' · ' || cpf_mascarado from envios_aditivo where id = (select e1 from en)), 'Lúcia Prado · ***.982.247-**',
  'guarda o nome e o CPF mascarado');
select is(pg_temp.motivo(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select com from ids), (select r ->> 'aditivoId' from ad1),
  '{"parte": "CONDOMINIO", "nome": "a.pdf", "tamanho": 4500}')), 'CONDOMINIO_JA_CONFERIDO', 'o condomínio assina uma vez');
-- A TRÍADE assina outro arquivo: não é o gerado, a equipe recusa.
create temp table en2 as select pg_temp.assinar((r ->> 'aditivoId')::uuid, 'TRIADE', pg_temp.sha('outro'), 2, null) as e2 from ad1;
select is((select situacao from envios_aditivo where id = (select e2 from en2)), 'NAO_E_O_GERADO', 'o PDF que não é o assinado pelo condomínio não conta');
select is((select comercial_recusar_envio_aditivo(com, e2, pg_temp.ev(e2), 'Assinou o arquivo errado') ->> 'situacao' from ids, en2), 'RECUSADO',
  'e a equipe recusa com o motivo');
select is((select r -> 'retorno' -> 'assinaturas' -> 'triade' ->> 'situacao' from (select pg_temp.canc(k2) as r from k) x), 'RECUSADA',
  'C6: o cancelamento traz o aditivo vigente com o cartão das assinaturas');

-- Gerar de novo: substitui e zera as assinaturas.
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k2 from k),
  '{"representante": "Lúcia Prado", "cpf": "52998224725", "competencia": "2027-03-01", "ciclo": "ANUAL"}')), '["motivo"]'::jsonb,
  'gerar de novo pede o motivo');
create temp table ad2 as select pg_temp.gerar(k2, '{"representante": "Lúcia Prado", "cpf": "52998224725", "competencia": "2027-03-01", "ciclo": "ANUAL",
  "motivo": "A síndica prefere o anual"}') as r from k;
select is((select r -> 'dados' -> 'retorno' ->> 'valor' from ad2), '383900', 'no anual, o mensal vezes os meses pagos (11)');
select is((select r -> 'dados' -> 'campos' ->> 'valor_mensal' from ad2), 'R$ 349,00 por mês (R$ 3.839,00 por ano, 11 meses pagos)', 'e o texto diz os dois');
select is((select situacao || ' · ' || substituido_motivo from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad1)),
  'SUBSTITUIDO · A síndica prefere o anual', 'o anterior fica substituído, com o motivo');
select is((select array_agg(situacao order by parte) from envios_aditivo where aditivo_id = (select (r ->> 'aditivoId')::uuid from ad1)),
  array['SUBSTITUIDO', 'RECUSADO'], 'e as assinaturas dele não contam mais');
select is((select numero from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad2)), 2, 'o novo tem o número seguinte');
select is((select pg_temp.canc(k2) -> 'retorno' -> 'assinaturas' -> 'condominio' ->> 'situacao' from k), 'AGUARDANDO', 'as assinaturas começam do zero');
select is(pg_temp.motivo(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select com from ids), (select r ->> 'aditivoId' from ad1),
  '{"parte": "CONDOMINIO", "nome": "a.pdf", "tamanho": 4500}')), 'ADITIVO_SUBSTITUIDO', 'o substituído não recebe envio');
select comercial_aditivo_pronto(adm, (r ->> 'aditivoId')::uuid, pg_temp.sha('ad2'), 4000) from ids, ad2;
create temp table en3 as select pg_temp.assinar((r ->> 'aditivoId')::uuid, 'CONDOMINIO', pg_temp.sha('ad2'), 1, '{}') as e3 from ad2;
select is(pg_temp.motivo(format('select comercial_reativar_cliente(%L, %L, %s, %L)', (select adm from ids), (select k2 from k), pg_temp.kv((select k2 from k)), '{}')),
  'ADITIVO_SEM_ASSINATURAS', 'com uma assinatura só, ainda não reativa');
select is(pg_temp.campos(format('select pg_temp.assinar(%L, %L, %L, 2, %L)', (select r ->> 'aditivoId' from ad2), 'TRIADE', (select pg_temp.sha(e3::text) from en3),
  '{"cpf": "123"}')), '["cpf"]'::jsonb, 'a TRÍADE diz o CPF que o validador mostra');
create temp table en4 as select pg_temp.assinar((r ->> 'aditivoId')::uuid, 'TRIADE', pg_temp.sha(e3::text), 2, '{"cpf": "11144477735"}') as e4 from ad2, en3;
select is((select assinante_nome || ' · ' || situacao from envios_aditivo where id = (select e4 from en4)), 'Carolina · CONFERIDO',
  'a TRÍADE assina sobre o arquivo do condomínio');
select is(pg_temp.motivo(format('select comercial_iniciar_envio_aditivo(%L, %L, %L)', (select adm from ids), (select r ->> 'aditivoId' from ad2),
  '{"parte": "TRIADE", "nome": "t.pdf", "tamanho": 4500}')), 'ADITIVO_ASSINADO', 'assinado pelos dois, não recebe mais');
select is((select comercial_abrir_aditivo_arquivo(com, (r ->> 'aditivoId')::uuid, null, null) ->> 'caminho' from ids, ad2),
  (select caminho from envios_aditivo where id = (select e4 from en4)), 'baixar traz o assinado mais recente (o da TRÍADE)');
select is((select comercial_abrir_aditivo_arquivo(com, (r ->> 'aditivoId')::uuid, null, true) ->> 'nome' from ids, ad2), 'aditivo-2.pdf', 'ou o gerado');
select is((select comercial_abrir_aditivo_arquivo(com, (r ->> 'aditivoId')::uuid, e3, null) ->> 'nome' from ids, ad2, en3), 'condominio.pdf', 'ou um envio');

-- 5. Reativar (C5).
select throws_ok(format('select comercial_reativar_cliente(%L, %L, %s, %L)', (select com from ids), (select k2 from k), pg_temp.kv((select k2 from k)), '{}'),
  'TC401', null, 'reativar é da Administração');
select is(pg_temp.codigo(format('select comercial_reativar_cliente(%L, %L, 1, %L)', (select adm from ids), (select k2 from k), '{}')), 'TC409',
  'com a versão velha é conflito');
create temp table rea as select comercial_reativar_cliente(adm, k2, pg_temp.kv(k2), '{}') as r from ids, k;
select is((select r -> 'cancelamento' ->> 'situacao' from rea), 'REATIVADO', 'o cliente é reativado');
select is((select r -> 'cancelamento' -> 'reativadoPor' ->> 'nome' from rea), 'Carolina', 'por quem');
select is((select reativado_aditivo_id from cancelamentos_cliente where id = (select k2 from k)), (select (r ->> 'aditivoId')::uuid from ad2), 'e por qual aditivo');
select is((select revogado_motivo from encerramentos_contrato where cancelamento_id = (select k2 from k)), 'Reativado pelo aditivo nº 2',
  'o último dia é revogado e fica no histórico');
select is((select contrato_encerrado(c_pequi) from cc), false, 'o contrato volta a valer');
select is((select nome || ' · ' || valor_centavos || ' · ' || ciclo || ' · ' || tabela_origem || ' · ' || inicio_competencia
             from planos_cliente where condominio_id = (select c_pequi from cc)),
  'Tabela cheia, 41 a 100 unidades · 383900 · ANUAL · CHEIA · 2027-03-01', 'o plano é o do aditivo, na tabela cheia');
select ok(not exists (select 1 from vagas_fundador where condominio_id = (select c_pequi from cc) and liberada_em is null), 'sem vaga de fundador');
select ok(exists (select 1 from historico where acao = 'plano.salvo' and entidade_id = (select id::text from planos_cliente where condominio_id = (select c_pequi from cc))),
  'o plano passa pelo guardião de sempre (com histórico)');
select is((select etapa || ' · ' || resultado from expansoes_cliente where id = (select e from rq)), 'GANHA · Reativado pelo aditivo nº 2',
  'a reconquista aberta fica ganha');
select is((select array_agg(acao order by acao) from historico where condominio_id = (select c_pequi from cc) and acao like 'contrato.%'),
  array['contrato.encerramento_marcado', 'contrato.reativado'], 'o síndico vê o último dia e a reativação');
select ok(exists (select 1 from historico where acao = 'comercial.cliente_reativado' and entidade_id = (select k2::text from k)), 'e o Comercial também');
select is(pg_temp.motivo(format('select comercial_reativar_cliente(%L, %L, %s, %L)', (select adm from ids), (select k2 from k), pg_temp.kv((select k2 from k)), '{}')),
  'CANCELAMENTO_DECIDIDO', 'reativado uma vez');
select is((select console_abrir_competencia(adm, '2027-03-01') ->> 'criadas' from ids)::integer >= 1, true, 'a cobrança volta na competência do aditivo');
select is((select valor_centavos::bigint from cobrancas where condominio_id = (select c_pequi from cc) and competencia = '2027-03-01' and tipo = 'MENSALIDADE'),
  383900::bigint, 'com o valor do aditivo');
select is((select comercial_proximo_aniversario(pequi, '2026-11-01', comercial_hoje(), 30) from i), date '2028-02-24',
  'o aniversário conta da reativação');
select is((select x ->> 'situacao' from jsonb_array_elements((select pg_temp.lista(com) -> 'clientes' from ids)) x where x ->> 'condominio' = 'Residencial Pequi'),
  'ATIVO', 'o reativado é cliente ativo nas renovações');
select comercial_marcar_risco(com, pequi, '{"tipo": "TROCA_NA_PAUTA", "data": "2027-03-10", "detalhe": "Pauta da AGO depois da volta"}') from ids, i;
select ok(exists (select 1 from jsonb_array_elements((select comercial_inicio(com) -> 'itens' from ids)) x
                   where x ->> 'id' = (select pequi::text from i) and x ->> 'motivo' = 'RISCO'), 'e no Início');
select is((select pg_temp.canc(k2) ->> 'situacao' from k), 'REATIVADO', 'o reativado aparece na aba');
select is((select r -> 'cancelamento' ->> 'situacao' || ' · ' || (r -> 'pode' ->> 'assinar') || ' · ' || (r -> 'cancelamento' -> 'retorno' ->> 'numero')
             from (select comercial_cancelamento(adm, k2) as r from ids, k) x), 'REATIVADO · true · 2',
  'o cancelamento abre sozinho, com o aditivo e o que a equipe pode');
select is((select comercial_cancelamento(com, k2) -> 'pode' ->> 'assinar' from ids, k), 'false', 'só quem assina pela TRÍADE tem o assinar');
select throws_ok($$ select comercial_cancelamento(imp, k2) from ids, k $$, 'TC401', null, 'quem não é do Comercial não abre');
select is(pg_temp.codigo(format('select comercial_cancelamento(%L, %L)', (select adm from ids), gen_random_uuid())), 'TC404', 'o que não existe não abre');
create temp table k4 as select (comercial_pedir_cancelamento(com, pequi, '{"pedidoPor": "Lúcia Prado"}') ->> 'situacao') as s from ids, i;
select is((select s from k4), 'PEDIDO', 'F7: o reativado pode pedir cancelamento de novo');

-- Sob consulta (acima de 400): o valor combinado, sem tabela.
select is(pg_temp.campos(format('select pg_temp.gerar(%L, %L)', (select k3 from k),
  '{"representante": "Teo Lima", "cpf": "11144477735", "competencia": "2027-04-01", "ciclo": "MENSAL"}')), '["valorCentavos"]'::jsonb,
  'acima de 400 unidades, diz o valor combinado');
create temp table ad3 as select pg_temp.gerar(k3, '{"representante": "Teo Lima", "cpf": "11144477735", "competencia": "2027-04-01", "ciclo": "MENSAL",
  "valorCentavos": 159900}') as r from k;
select is((select (r -> 'dados' -> 'retorno' ->> 'tabela') || ' · ' || (r -> 'dados' -> 'retorno' ->> 'valor') || ' · ' || (r -> 'dados' -> 'retorno' ->> 'nome') from ad3),
  'SOB_CONSULTA · 159900 · Sob consulta, acima de 400 unidades', 'com o valor combinado');
select comercial_aditivo_pronto(adm, (r ->> 'aditivoId')::uuid, pg_temp.sha('ad3'), 4000) from ids, ad3;
create temp table en5 as select pg_temp.assinar((r ->> 'aditivoId')::uuid, 'CONDOMINIO', pg_temp.sha('ad3'), 1, '{}') as e5 from ad3;

-- 6. O aditivo de reajuste também recebe as assinaturas (a parte de software da R17.7b).
select pg_temp.em('2027-09-20 10:00:00-03');
create temp table av as select comercial_registrar_aviso(com, ipiranga, '2027-11-01', jsonb_build_object('canal', 'WHATSAPP', 'para', 'Lúcia Prado',
  'texto', 'Aviso do reajuste anual pelo IPCA a partir de novembro.')) as r from ids, i;
select is((select tipo || ' · ' || situacao from aditivos_comercial where id = (select (r -> 'aditivo' ->> 'aditivoId')::uuid from av)), 'REAJUSTE · GERANDO',
  'o aviso usa o modelo de reajuste em uso (há um de cada parte)');
select comercial_aditivo_pronto(com, (r -> 'aditivo' ->> 'aditivoId')::uuid, pg_temp.sha('reaj'), 4000) from ids, av;
create temp table en6 as select pg_temp.assinar((r -> 'aditivo' ->> 'aditivoId')::uuid, 'CONDOMINIO', pg_temp.sha('reaj'), 1, null) as e6 from av;
select is(pg_temp.campos(format('select comercial_conferir_envio_aditivo(%L, %L, %s, %L)', (select com from ids), (select e6 from en6),
  pg_temp.ev((select e6 from en6)), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "cpf": "52998224725"}')),
  '["assinanteNome"]'::jsonb, 'no reajuste, a equipe diz o nome e o CPF de quem assinou pelo condomínio');
select is((select comercial_conferir_envio_aditivo(com, e6, pg_temp.ev(e6), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true,
  "cpf": "52998224725", "assinanteNome": "Lúcia Prado"}') ->> 'situacao' from ids, en6), 'CONFERIDO', 'e a assinatura fica registrada');
select is((select r -> 'renovacao' ->> 'situacao' from av), 'AVISO_ENVIADO', 'o reajuste continua valendo pelo aviso');

-- 7. LGPD (C7): a retenção do cancelamento e a anonimização.
select is((select o_que from retencao_tipos where codigo = 'CANCELAMENTO'),
  'Quem pediu, retenção, notas (e a de desfazer), motivo da revogação e o representante do retorno que não reativou', 'o catálogo diz o que entra');
select pg_temp.em('2028-03-01 10:00:00-03');
select ok(comercial_rotina_renovacoes() > 0, 'a rotina do Comercial roda');
select is((select desfeito_nota from cancelamentos_cliente where id = (select k1 from k)), null, 'a nota de desfazer sai em 12 meses');
select is((select revogado_motivo from encerramentos_contrato where cancelamento_id = (select k1 from k)), 'Dado apagado (LGPD)', 'e o motivo da revogação');
select is((select dados from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad1)), '{"tipo": "RETORNO", "numero": 1, "apagado": true}'::jsonb,
  'o aditivo de retorno que não reativou perde o representante');
select ok((select dados -> 'representante' ->> 'nome' = 'Lúcia Prado' from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad2)),
  'o que reativou fica, como o contrato assinado');
select ok(exists (select 1 from arquivos_a_apagar where caminho = (select caminho from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad1))),
  'o PDF dele vai para a fila de apagar');
select is((select count(*)::integer from envios_aditivo where aditivo_id = (select (r ->> 'aditivoId')::uuid from ad1) and apagado_em is null), 0,
  'com os envios');
select is((select count(*)::integer from envios_aditivo where aditivo_id = (select (r ->> 'aditivoId')::uuid from ad2) and assinante_nome is not null), 2,
  'os conferidos do que reativou ficam');
select lives_ok($$ select comercial_anonimizar(cerrado, 'Dado apagado (LGPD)') from i $$, 'a anonimização roda');
select is((select dados ->> 'apagado' from aditivos_comercial where id = (select (r ->> 'aditivoId')::uuid from ad3)), 'true',
  'o aditivo de retorno do anonimizado perde o retrato');
select is((select num_nonnulls(nome, assinante_nome, cpf_mascarado) from envios_aditivo where id = (select e5 from en5)), 0,
  'e o envio, o nome e o CPF de quem assinou');
select ok(exists (select 1 from arquivos_a_apagar where caminho = (select caminho from envios_aditivo where id = (select e5 from en5))
                   and origem = 'COMERCIAL_ANONIMIZADO'), 'com o arquivo na fila de apagar');
select is(pg_temp.codigo(format('select comercial_abrir_aditivo_arquivo(%L, %L, null, true)', (select com from ids), (select r ->> 'aditivoId' from ad3))),
  'TC404', 'e o aditivo apagado não abre mais');

select * from finish();
rollback;

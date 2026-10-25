-- Virar cliente, piloto, troca de sistema, vários condomínios e LGPD (0308, R17.4; CM-08, CM-09,
-- CM-20, CM-21, CM-29 e CM-12; quadros 331, 333, 338 e 345): virar cliente só com as duas
-- assinaturas conferidas e tudo de uma vez (carteira, ficha, plano, vaga de fundador, implantação
-- com responsável, promessas e troca de sistema), o piloto com meta e prazo que vira proposta,
-- perdido ou cliente, a carta e a linha do tempo da troca, a oportunidade nova do mesmo contato, a
-- anonimização que apaga os arquivos de quem não virou cliente e guarda o contrato de quem virou,
-- o catálogo de retenção e as ações novas na sessão do Console.
begin;
select plan(73);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Iara', 'IMPLANTACAO') as imp;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp, 'papel', 'SINDICO',
                                                                 'email', 'lucia' || right(p_whatsapp, 3) || '@exemplo.com.br')) ->> 'id')::uuid;
  update interessados set unidades = 72, faixa = 'DE_41_A_100', cidade = 'Brasília', uf = 'DF' where id = v;
  return v;
end $$;
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
-- Documentos e contrato gerado e montado; devolve o id do contrato.
create function pg_temp.gerado(p_interessado uuid, p_codigo text) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.doc(p_codigo, '{"tipo": "CNPJ", "cnpj": "11222333000181"}');
  perform pg_temp.doc(p_codigo, '{"tipo": "ATA_ELEICAO", "mandatoAte": "2027-12-31"}');
  c := (comercial_gerar_contrato((select com from ids), p_interessado, date '2026-11-01', null) ->> 'contratoId')::uuid;
  perform comercial_contrato_pronto((select com from ids), c, pg_temp.sha(c::text), 5000);
  return c;
end $$;
-- As duas assinaturas, conferidas.
create function pg_temp.assinado(p_interessado uuid, p_codigo text) returns uuid language plpgsql as $$
declare c uuid; e uuid; t uuid;
begin
  c := pg_temp.gerado(p_interessado, p_codigo);
  e := (publico_iniciar_envio(p_codigo, '{"nome": "a.pdf", "tamanho": 5500}', null) ->> 'envioId')::uuid;
  perform publico_verificar_envio(p_codigo, e, jsonb_build_object('valido', true, 'sha256', pg_temp.sha(e::text), 'tamanho', 5500, 'assinaturas', 1,
                                                                 'prefixoSha256', pg_temp.sha(c::text)));
  perform comercial_conferir_envio((select com from ids), e, 2, '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}');
  t := (comercial_iniciar_envio((select adm from ids), c, '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 6000}') ->> 'envioId')::uuid;
  perform comercial_verificar_envio((select adm from ids), t, jsonb_build_object('valido', true, 'sha256', pg_temp.sha(t::text), 'tamanho', 6000,
                                                                                'assinaturas', 2, 'prefixoSha256', pg_temp.sha(e::text)));
  perform comercial_conferir_envio((select com from ids), t, 2, '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "cpf": "11144477735"}');
  return c;
end $$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajuste pelo «indice_reajuste».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
        '2026-10-20', 'EM_USO', app_now());
create temp table i as select pg_temp.interessado('Edifício Aroeira', '5561999990501') as aroeira, pg_temp.interessado('Edifício Buriti', '5561999990502') as buriti,
                              pg_temp.interessado('Edifício Cedro', '5561999990503') as cedro;
create temp table cod as select pg_temp.aceita(aroeira) as aroeira, pg_temp.aceita(buriti) as buriti from i;

-- 1. Troca de sistema (CM-29, quadro 345): carta-modelo, o que falta e a linha do tempo.
select is(pg_temp.campos($$ select comercial_salvar_troca((select com from ids), (select aroeira from i), null, '{"empresaAnterior": "X", "dataTroca": "2026-12-01"}') $$),
  '["empresaAnterior"]'::jsonb, 'a troca pede a empresa de antes');
select is(pg_temp.campos($$ select comercial_salvar_troca((select com from ids), (select aroeira from i), null, '{"empresaAnterior": "Contábil Norte", "dataTroca": "2028-01-01"}') $$),
  '["dataTroca"]'::jsonb, 'e a data da troca (até um ano)');
create temp table tr as select comercial_salvar_troca(com, aroeira, null, '{"empresaAnterior": "Contábil Norte", "dataTroca": "2026-12-01",
  "itens": [{"texto": "Lista de unidades e moradores", "recebido": true}, {"texto": "Contratos e prestadores"}, {"texto": "Atas e convenção", "recebido": false}]}') as r from ids, i;
select is((select r ->> 'faltam' from tr), '2', 'a lista diz o que falta receber');
select ok((select r ->> 'carta' from tr) ~ '^À Contábil Norte,' and strpos((select r ->> 'carta' from tr), 'Lúcia Prado') > 0
          and strpos((select r ->> 'carta' from tr), '- Contratos e prestadores') > 0 and strpos((select r ->> 'carta' from tr), 'Lista de unidades') = 0,
  'a carta-modelo sai em nome de quem aceitou, com o que falta e sem o que já chegou');
select is((select jsonb_agg(jsonb_build_array(x ->> 'chave', x ->> 'data')) from tr, jsonb_array_elements(r -> 'linhaDoTempo') x),
  '[["CARTA", "2026-11-01"], ["PLANILHA", "2026-11-16"], ["TROCA", "2026-12-01"], ["PRIMEIRA_SEMANA", "2026-12-08"], ["ACOMPANHAMENTO", "2027-01-15"]]'::jsonb,
  'a linha do tempo: 30 e 15 dias antes, o dia, a primeira semana e 45 dias depois');
select is((select comercial_carta_troca_enviada(com, aroeira, (r ->> 'versao')::integer) -> 'linhaDoTempo' -> 0 ->> 'situacao' from ids, i, tr), 'FEITO',
  'mandar a carta para a síndica fica registrado');
select is(pg_temp.campos($$ select comercial_salvar_troca((select com from ids), (select aroeira from i), (select versao from trocas_sistema limit 1),
  '{"empresaAnterior": "Contábil Norte", "dataTroca": "2026-12-01", "itens": []}') $$), '["itens"]'::jsonb, 'a lista tem de 1 a 20 itens');

-- 2. Virar cliente (CM-08, quadro 333): só com as duas assinaturas conferidas.
create temp table c as select pg_temp.gerado(buriti, (select buriti from cod)) as buriti from i;
select is(pg_temp.motivo(format('select comercial_virar_cliente(%L, %L, %s, %L)', (select adm from ids), (select buriti from i), pg_temp.iv((select buriti from i)),
             jsonb_build_object('responsavelImplantacaoId', (select imp from ids)))), 'CONTRATO_SEM_ASSINATURAS', 'sem as duas assinaturas, não vira cliente');
create temp table ca as select pg_temp.assinado(aroeira, (select aroeira from cod)) as aroeira from i;
select is((select situacao from contratos_comercial where id = (select aroeira from ca)), 'ASSINADO', 'o contrato da Aroeira está assinado pelos dois');
select throws_ok(format('select comercial_virar_cliente(%L, %L, %s, %L)', (select com from ids), (select aroeira from i), pg_temp.iv((select aroeira from i)),
                        jsonb_build_object('responsavelImplantacaoId', (select imp from ids))), 'TC401', null, 'o Comercial não vira cliente');
select is(pg_temp.campos(format('select comercial_virar_cliente(%L, %L, %s, ''{}'')', (select adm from ids), (select aroeira from i), pg_temp.iv((select aroeira from i)))),
  '["responsavelImplantacaoId"]'::jsonb, 'virar cliente pede quem cuida da implantação');
select is(pg_temp.campos(format('select comercial_virar_cliente(%L, %L, %s, %L)', (select adm from ids), (select aroeira from i), pg_temp.iv((select aroeira from i)),
             jsonb_build_object('responsavelImplantacaoId', (select com from ids)))), '["responsavelImplantacaoId"]'::jsonb, 'da equipe, com a função Implantação');
select is((select teste.erro(format('select comercial_virar_cliente(%L, %L, %s, %L)', adm, aroeira, pg_temp.iv(aroeira), jsonb_build_object('responsavelImplantacaoId', imp)))
             -> 'detalhe' from ids, i), '{"motivo": "FALTA_PARA_ETAPA", "campos": ["decisor", "decisaoEm"]}'::jsonb, 'Ganho pede quem decide e quando');
update interessados set decisor = 'Assembleia de 10/11, com o conselho', decisao_em = '2026-11-10', problema = 'Ninguém sabe dos pedidos' where id = (select aroeira from i);
create temp table vc as select comercial_virar_cliente(adm, aroeira, pg_temp.iv(aroeira), jsonb_build_object('responsavelImplantacaoId', imp)) as r from ids, i;
create temp table cl as select (r ->> 'condominioId')::uuid as id, (r ->> 'implantacaoId')::uuid as imp from vc;
select is((select estado || ' · ' || left(referencia_contrato, 32) from clientes where condominio_id = (select id from cl)), 'IMPLANTACAO · Contrato TRÍADE nº 1 · modelo v1',
  'o cliente entra na carteira em implantação, com a referência do contrato');
select is((select jsonb_build_array(nome, cidade, uf, cnpj) from condominios where id = (select id from cl)),
  '["Edifício Aroeira", "Brasília", "DF", "11222333000181"]'::jsonb, 'a ficha tem o nome, a cidade, a UF e o CNPJ do cartão');
select is((select contatos from condominios where id = (select id from cl)),
  '[{"nome": "Lúcia Prado", "papel": "Síndico(a)", "telefone": "+5561999990501", "email": "lucia501@exemplo.com.br"}]'::jsonb, 'e o contato do Comercial');
select is((select jsonb_build_array(ciclo, inicio_competencia) from planos_cliente where condominio_id = (select id from cl)), '["MENSAL", "2026-11-01"]'::jsonb,
  'o plano sai da versão aceita e começa na competência do início do contrato');
select is((select valor_centavos::bigint from planos_cliente where condominio_id = (select id from cl)),
  (select v.mensal_centavos::bigint from versoes_proposta v join contratos_comercial k on k.versao_id = v.id where k.id = (select aroeira from ca)), 'com o valor aceito');
select is((select count(*)::integer from vagas_fundador where condominio_id = (select id from cl) and liberada_em is null),
  (select case when v.tabela = 'FUNDADOR' then 1 else 0 end from versoes_proposta v join contratos_comercial k on k.versao_id = v.id where k.id = (select aroeira from ca)),
  'no preço de fundador, a vaga vem junto');
select is((select count(*)::integer from etapas_implantacao where implantacao_id = (select imp from cl) and responsavel_id = (select imp from ids)), 8,
  'a implantação abre as 8 etapas com quem cuida dela');
select is((select array_agg(funcao order by funcao) from vinculos where condominio_id = (select id from cl) and revogado_em is null),
  array['ADMINISTRACAO', 'IMPLANTACAO'], 'a Administração e quem implanta atendem o cliente');
select ok((select texto from notas_internas where condominio_id = (select id from cl)) ~ 'Quem decide: Assembleia de 10/11' , 'as promessas e quem decide ficam na nota interna');
select is((select array_agg(com_quem || ' ' || left(texto, 40) order by etapa nulls last, texto) from pendencias_implantacao where condominio_id = (select id from cl)),
  array['CLIENTE Receber da empresa anterior: Atas e conv', 'CLIENTE Receber da empresa anterior: Contratos e', 'EQUIPE Dia da troca: comunicado aos moradores e',
        'EQUIPE Conversa de acompanhamento com o síndico'], 'a troca de sistema vira pendências da implantação (a carta já foi mandada)');
select is((select r ->> 'pendencias' from vc), '4', 'e a resposta conta as pendências');
select is((select etapa || ' ' || (virou_cliente_em is not null) || ' ' || (condominio_id = (select id from cl)) from interessados where id = (select aroeira from i)),
  'GANHO true true', 'o interessado vai para Ganho, ligado ao cliente');
select is((select condominio_id from contratos_comercial where id = (select aroeira from ca)), (select id from cl), 'o contrato assinado fica ligado ao cliente');
select is(pg_temp.motivo(format('select comercial_virar_cliente(%L, %L, %s, %L)', (select adm from ids), (select aroeira from i), pg_temp.iv((select aroeira from i)),
             jsonb_build_object('responsavelImplantacaoId', (select imp from ids)))), 'VIROU_CLIENTE', 'não vira cliente duas vezes');
select is((select publico_contrato(aroeira) -> 'contrato' ->> 'finalDisponivel' from cod), 'true', 'em Ganho, o link da versão aceita continua para o PDF final');
select is(pg_temp.motivo(format('select comercial_abrir_contrato(%L, %L, null)', (select com from ids), (select aroeira from ca))), 'VIROU_CLIENTE',
  'o Comercial deixa de baixar os arquivos do cliente (CM-11)');
select is((select console_contrato_cliente(adm, id) -> 'contrato' ->> 'numero' from ids, cl), '1', 'o contrato assinado aparece na ficha do cliente');
select is((select jsonb_agg(x ->> 'cpfMascarado' order by x ->> 'parte') from ids, cl, jsonb_array_elements(console_contrato_cliente(adm, cl.id) -> 'contrato' -> 'assinaturas') x),
  '["***.982.247-**", "***.444.777-**"]'::jsonb, 'com quem assinou, o CPF só mascarado');
select is((select console_troca_sistema(ids.imp, cl.id) -> 'troca' ->> 'empresaAnterior' from ids, cl), 'Contábil Norte', 'quem implanta vê a troca de sistema');
select throws_ok(format('select console_contrato_cliente(%L, %L)', (select fin from ids), (select id from cl)), 'TC401', null, 'quem não atende o cliente não vê o contrato');

-- 3. Piloto (CM-21, quadro 338).
select throws_ok(format('select comercial_iniciar_piloto(%L, %L, %s, ''{}'')', (select com from ids), (select cedro from i), pg_temp.iv((select cedro from i))), 'TC401', null,
  'o Comercial não começa piloto (cria cliente na carteira)');
select is(pg_temp.campos(format('select comercial_iniciar_piloto(%L, %L, %s, %L)', (select adm from ids), (select cedro from i), pg_temp.iv((select cedro from i)),
             jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26', 'metaPercentual', 80, 'combinadoCom', 'Lúcia, síndica', 'responsavelImplantacaoId', (select imp from ids)))),
  '["meta"]'::jsonb, 'piloto sem meta é recusado');
select is(pg_temp.campos(format('select comercial_iniciar_piloto(%L, %L, %s, %L)', (select adm from ids), (select cedro from i), pg_temp.iv((select cedro from i)),
             jsonb_build_object('prazoDias', 20, 'comecaEm', '2026-10-26', 'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'combinadoCom', 'Lúcia, síndica',
                                'responsavelImplantacaoId', (select imp from ids)))), '["prazoDias"]'::jsonb, 'o prazo é de 30, 45 ou 60 dias');
select is(pg_temp.campos(format('select comercial_iniciar_piloto(%L, %L, %s, %L)', (select adm from ids), (select cedro from i), pg_temp.iv((select cedro from i)),
             jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26', 'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'responsavelImplantacaoId', (select imp from ids)))),
  '["combinadoCom"]'::jsonb, 'fica com quem foi combinado');
create temp table pl as select comercial_iniciar_piloto(adm, cedro, pg_temp.iv(cedro), jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26',
  'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'combinadoCom', 'Lúcia, síndica', 'responsavelImplantacaoId', imp)) as r from ids, i;
select is((select r ->> 'terminaEm' from pl), '2026-11-25', 'o piloto termina no prazo');
select is((select estado from clientes where condominio_id = (select (r ->> 'condominioId')::uuid from pl)), 'PILOTO', 'o condomínio entra na carteira como Em piloto');
select ok(not exists (select 1 from planos_cliente where condominio_id = (select (r ->> 'condominioId')::uuid from pl)), 'sem plano, sem cobrança');
select is((select array_agg(numero order by numero) from etapas_implantacao where condominio_id = (select (r ->> 'condominioId')::uuid from pl) and situacao = 'NAO_SE_APLICA'),
  array[2, 3, 5]::smallint[], 'a implantação mínima: organização, documentos e apresentação ficam para depois');
select is(pg_temp.motivo(format('select comercial_iniciar_piloto(%L, %L, %s, %L)', (select adm from ids), (select cedro from i), pg_temp.iv((select cedro from i)),
             jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26', 'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'combinadoCom', 'Lúcia',
                                'responsavelImplantacaoId', (select imp from ids)))), 'PILOTO_EXISTE', 'um piloto por vez');
select is(pg_temp.motivo(format($$ select definir_pessoa(%L), definir_transicao('ESTAGIO_MUDADO'); update clientes set estado = 'IMPLANTACAO' where condominio_id = %L $$,
             (select adm from ids), (select r ->> 'condominioId' from pl))), 'PILOTO_PELO_COMERCIAL', 'Mudar estágio não tira o cliente do piloto');
select pg_temp.em('2026-10-30 10:00:00-03');
select is((select comercial_piloto(com, cedro) -> 'piloto' -> 'medida' ->> 'medido' from ids, i), 'true', 'a meta de retornos no prazo é medida pela Plataforma');
create temp table pkit as select comercial_criar_proposta(com, cedro, '{}') as r from ids, i;
create temp table cod2 as select comercial_enviar_proposta(com, (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer) -> 'link' ->> 'codigo' as codigo from ids, pkit;
select is((select (comercial_kit(com, (r ->> 'id')::uuid) -> 'piloto') - 'id' from ids, pkit),
  '{"prazoDias": 30, "comecaEm": "2026-10-26", "terminaEm": "2026-11-25", "meta": "RETORNOS_NO_PRAZO", "metaPercentual": 80, "situacao": "EM_ANDAMENTO"}'::jsonb,
  'o kit mostra o piloto, sem com quem foi combinado (CM-20)');
select is((select comercial_ficha(com, cedro) -> 'piloto' ->> 'combinadoCom' from ids, i), 'Lúcia, síndica', 'a ficha mostra com quem foi combinado');
-- Termina como proposta e depois vira cliente: o condomínio do piloto é o mesmo.
select is((select comercial_encerrar_piloto(com, (r ->> 'id')::uuid, (r ->> 'versao')::integer, '{"resultado": "PROPOSTA"}') ->> 'situacao' from ids, pl), 'VIROU_PROPOSTA',
  'o piloto termina como proposta');
select is((select estado from clientes where condominio_id = (select (r ->> 'condominioId')::uuid from pl)), 'PILOTO', 'e o condomínio fica em piloto até virar cliente');
select publico_aceitar_proposta(codigo, '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', null, null) from cod2;
select pg_temp.assinado(cedro, (select codigo from cod2)) from i;
update interessados set decisor = 'Síndica, com o conselho', decisao_em = '2026-11-10' where id = (select cedro from i);
create temp table vc2 as select comercial_virar_cliente(adm, cedro, pg_temp.iv(cedro), jsonb_build_object('responsavelImplantacaoId', imp)) as r from ids, i;
select is((select jsonb_build_array(r ->> 'doPiloto', (r ->> 'condominioId') = (select r ->> 'condominioId' from pl)) from vc2), '["true", true]'::jsonb,
  'virar cliente depois do piloto usa o mesmo condomínio');
select is((select estado from clientes where condominio_id = (select (r ->> 'condominioId')::uuid from pl)), 'IMPLANTACAO', 'que sai do piloto para a implantação');
select is((select count(*)::integer from etapas_implantacao where condominio_id = (select (r ->> 'condominioId')::uuid from pl) and situacao = 'NAO_SE_APLICA'), 0,
  'e as etapas que ficaram para depois voltam');
select is((select situacao from pilotos_comercial where id = (select (r ->> 'id')::uuid from pl)), 'VIROU_CLIENTE', 'o piloto fica como virou cliente');
-- Piloto perdido: o interessado vai a Perdido e o condomínio a Piloto encerrado.
create temp table d as select pg_temp.interessado('Edifício Damasco', '5561999990504') as damasco;
create temp table pl2 as select comercial_iniciar_piloto(adm, damasco, pg_temp.iv(damasco), jsonb_build_object('prazoDias', 45, 'comecaEm', '2026-10-30',
  'meta', 'MORADORES_WHATSAPP', 'metaPercentual', 50, 'combinadoCom', 'Conselho', 'responsavelImplantacaoId', imp)) as r from ids, d;
select is((select comercial_piloto(com, damasco) -> 'piloto' -> 'medida' from ids, d), '{"medido": false, "ondeVer": "INDICADORES_PLATAFORMA"}'::jsonb,
  'as outras metas a Plataforma mostra em Indicadores');
select throws_ok(format('select comercial_encerrar_piloto(%L, %L, %s, ''{"resultado": "PERDIDO", "motivoPerda": "PRECO"}'')', (select com from ids),
                        (select r ->> 'id' from pl2), (select r ->> 'versao' from pl2)), 'TC401', null, 'piloto perdido só pela Administração');
select is(pg_temp.campos(format('select comercial_encerrar_piloto(%L, %L, %s, ''{"resultado": "PERDIDO"}'')', (select adm from ids), (select r ->> 'id' from pl2), (select r ->> 'versao' from pl2))),
  '["motivoPerda"]'::jsonb, 'perdido pede o motivo');
select comercial_encerrar_piloto(adm, (r ->> 'id')::uuid, (r ->> 'versao')::integer, '{"resultado": "PERDIDO", "motivoPerda": "FICOU_PARA_DEPOIS"}') from ids, pl2;
select is((select etapa || ' ' || motivo_perda from interessados where id = (select damasco from d)), 'PERDIDO FICOU_PARA_DEPOIS', 'o interessado vai a Perdido com o motivo');
select is((select estado from clientes where condominio_id = (select (r ->> 'condominioId')::uuid from pl2)), 'PILOTO_ENCERRADO', 'e o condomínio a Piloto encerrado');

-- 4. Vários condomínios do mesmo contato (CM-09).
create temp table op as select comercial_nova_oportunidade(com, aroeira, '{"condominio": "Edifício Aroeira II", "unidades": 30, "faixa": "ATE_40"}') as r from ids, i;
select is((select r ->> 'contatoDe' from op), (select aroeira::text from i), 'a oportunidade nova é do mesmo contato');
select is((select jsonb_build_array(nome_contato, whatsapp, etapa, cadencia_id is null) from interessados where id = (select (r ->> 'id')::uuid from op)),
  '["Lúcia Prado", "5561999990501", "NOVO", true]'::jsonb, 'com o contato copiado, a sua etapa e sem cadência');
select is(pg_temp.motivo($$ select comercial_nova_oportunidade((select com from ids), (select aroeira from i), '{"condominio": "edificio aroeira ii"}') $$), 'DUPLICADO',
  'o mesmo condomínio duas vezes é recusado');
select is((select count(*)::integer from comercial_parecido('5561999990501', null, null, null, (select (r ->> 'id')::uuid from op))), 0,
  'o mesmo WhatsApp do mesmo contato não é duplicado');
select is((select jsonb_agg(x ->> 'condominio') from ids, i, jsonb_array_elements(comercial_ficha(com, aroeira) -> 'oportunidades') x), '["Edifício Aroeira II"]'::jsonb,
  'a ficha mostra as outras oportunidades do contato');

-- 5. LGPD (CM-12): quem não virou cliente perde os arquivos; de quem virou fica o contrato.
create temp table antes as select count(*)::integer as n from arquivos_a_apagar where bucket = 'comercial';
select comercial_excluir(adm, buriti) from ids, i;
select is((select dados from contratos_comercial where id = (select buriti from c)), '{"anonimizado": true, "numero": 1}'::jsonb, 'o contrato de quem não virou cliente perde o retrato');
select is((select array_agg(distinct situacao) from documentos_aceite where interessado_id = (select buriti from i)), array['APAGADO'], 'os documentos ficam apagados');
select is((select count(*)::integer from arquivos_a_apagar where bucket = 'comercial') - (select n from antes), 3, 'e os três arquivos vão para a fila de apagar');
select is((select teste.erro($$ select publico_contrato((select buriti from cod)) $$) ->> 'codigo'), 'TC404', 'o link fecha');
select is((select comercial_excluir(adm, aroeira) ->> 'oportunidades' from ids, i), '2', 'excluir a pedido apaga as oportunidades do mesmo contato');
select is((select dados ->> 'numero' || ' ' || (dados ? 'texto') from contratos_comercial where id = (select aroeira from ca)), '1 true',
  'de quem virou cliente, o contrato assinado fica (prazo legal)');
select is((select count(*)::integer from envios_contrato where contrato_id = (select aroeira from ca) and situacao = 'CONFERIDO' and apagado_em is null and cpf_mascarado is not null), 2,
  'com as duas assinaturas conferidas');
select is((select nome from aceites_proposta where id = (select aceite_id from contratos_comercial where id = (select aroeira from ca))), 'Lúcia Prado',
  'e o aceite que prova quem assinou');
select is((select carta from trocas_sistema where interessado_id = (select aroeira from i)), 'Carta apagada (LGPD).', 'a carta com o nome some');

-- 6. Retenção e sessão.
select is((select array_agg(codigo || ':' || situacao order by numero) from retencao_tipos where numero > 34), array['COMERCIAL_ARQUIVO:A_FAZER', 'CONTRATO_ASSINADO:A_FAZER'],
  'documentos e contratos entram no catálogo de retenção');
select ok((select console_sessao(adm) -> 'acoes' ? 'console.comercial.assinar' and console_sessao(adm) -> 'acoes' ? 'console.comercial.cliente' from ids),
  'a sessão do Console leva as ações novas');

select * from finish();
rollback;

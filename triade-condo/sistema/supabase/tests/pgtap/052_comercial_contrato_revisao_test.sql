-- Revisão independente do contrato e do virar cliente (0308, R17.4a; CM-08, CM-11, CM-12, CM-13,
-- CM-21): a conferência automática que exige uma assinatura nova e só a assinatura na parte
-- acrescentada, a base que a API compara, o CPF mascarado na leitura, a anonimização que apaga os
-- envios conferidos de quem não virou cliente e manda todos os arquivos para a fila, o documento
-- que chega tarde, o teto de envios em aberto e a rotina dos abandonados, o piloto que termina
-- quando o interessado fecha, o interessado retomado depois do piloto perdido, a cobrança da
-- implantação nas parcelas do contrato e o que o Comercial deixa de ver depois de virar cliente.
begin;
select plan(56);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Iara', 'IMPLANTACAO') as imp;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.ev(p uuid) returns integer language sql as $$ select versao from envios_contrato where id = p $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp, 'papel', 'SINDICO',
                                                                 'email', 'lucia' || right(p_whatsapp, 3) || '@exemplo.com.br')) ->> 'id')::uuid;
  update interessados set unidades = 72, faixa = 'DE_41_A_100', cidade = 'Brasília', uf = 'DF' where id = v;
  return v;
end $$;
create function pg_temp.aceita(p_interessado uuid, p_dados jsonb default '{}') returns text language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_interessado, p_dados);
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
create function pg_temp.gerado(p_interessado uuid, p_codigo text, p_inicio date default date '2026-11-01') returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.doc(p_codigo, '{"tipo": "CNPJ", "cnpj": "11222333000181"}');
  perform pg_temp.doc(p_codigo, '{"tipo": "ATA_ELEICAO", "mandatoAte": "2027-12-31"}');
  c := (comercial_gerar_contrato((select com from ids), p_interessado, p_inicio, null) ->> 'contratoId')::uuid;
  perform comercial_contrato_pronto((select com from ids), c, pg_temp.sha(c::text), 5000);
  return c;
end $$;
create function pg_temp.res(p_sha text, p_tamanho integer, p_assinaturas integer, p_prefixo text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('valido', true, 'sha256', p_sha, 'tamanho', p_tamanho, 'assinaturas', p_assinaturas, 'prefixoSha256', p_prefixo,
                            'assinaturaNova', true, 'soAssinatura', true) || p_extra $$;
create function pg_temp.envio_link(p_codigo text, p_res jsonb) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.em(app_now() + interval '1 minute');
  v := (publico_iniciar_envio(p_codigo, '{"nome": "a.pdf", "tamanho": 5500}', '200.1.2.3') ->> 'envioId')::uuid;
  perform publico_verificar_envio(p_codigo, v, p_res);
  return v;
end $$;
-- As duas assinaturas sobre um contrato montado, conferidas.
create function pg_temp.assinar(c uuid, p_codigo text) returns uuid language plpgsql as $$
declare e uuid; t uuid;
begin
  e := pg_temp.envio_link(p_codigo, pg_temp.res(pg_temp.sha('e' || c::text), 5500, 1, pg_temp.sha(c::text)));
  perform comercial_conferir_envio((select com from ids), e, pg_temp.ev(e), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}');
  t := (comercial_iniciar_envio((select adm from ids), c, '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 6000}') ->> 'envioId')::uuid;
  perform comercial_verificar_envio((select adm from ids), t, pg_temp.res(pg_temp.sha('t' || c::text), 6000, 2, pg_temp.sha('e' || c::text)));
  perform comercial_conferir_envio((select com from ids), t, pg_temp.ev(t), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "cpf": "11144477735"}');
  return c;
end $$;
create function pg_temp.piloto(p_interessado uuid) returns jsonb language sql as $$
  select comercial_iniciar_piloto(adm, p_interessado, pg_temp.iv(p_interessado), jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26',
    'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'combinadoCom', 'Lúcia, síndica', 'responsavelImplantacaoId', imp)) from ids $$;
create function pg_temp.na_fila(p_caminho text) returns boolean language sql as $$
  select exists (select 1 from arquivos_a_apagar where bucket = 'comercial' and caminho = p_caminho) $$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», representado por «representante», CPF «cpf_representante», a partir de «data_inicio».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345', '2026-10-20', 'EM_USO', app_now());
create temp table i as select pg_temp.interessado('Edifício Ipê', '5561999990601') as ipe, pg_temp.interessado('Edifício Jatobá', '5561999990602') as jatoba,
  pg_temp.interessado('Edifício Louro', '5561999990603') as louro, pg_temp.interessado('Edifício Mogno', '5561999990604') as mogno,
  pg_temp.interessado('Edifício Pequi', '5561999990605') as pequi, pg_temp.interessado('Edifício Umbu', '5561999990606') as umbu,
  pg_temp.interessado('Edifício Caju', '5561999990607') as caju;
update interessados set cnpj = '11444777000161' where id = (select caju from i);
create temp table cod as select pg_temp.aceita(ipe) as ipe, pg_temp.aceita(jatoba) as jatoba, pg_temp.aceita(louro) as louro, pg_temp.aceita(mogno) as mogno from i;

-- 1. A conferência automática: a base que a API compara e o resultado que ela devolve.
create temp table c as select pg_temp.gerado(ipe, (select ipe from cod)) as ipe from i;
create temp table e as select (publico_iniciar_envio((select ipe from cod), '{"nome": "a.pdf", "tamanho": 5500}', null) ->> 'envioId')::uuid as base;
select is((select publico_envio_a_verificar((select ipe from cod), base) - 'caminho' - 'tipo' from e),
  jsonb_build_object('baseCaminho', (select caminho from contratos_comercial where id = (select ipe from c)), 'baseSha256', (select pg_temp.sha(ipe::text) from c),
                     'baseTamanho', 5000), 'a API recebe o PDF gerado como base para comparar com o enviado');
select publico_verificar_envio((select ipe from cod), base, pg_temp.res(pg_temp.sha('x1'), 5500, 1, (select pg_temp.sha(ipe::text) from c), '{"assinaturaNova": false}')) from e;
select is((select situacao || ' ' || motivo_auto from envios_contrato where id = (select base from e)), 'RECUSADO_NA_HORA SEM_ASSINATURA',
  'sem um /Sig de verdade acrescentado (o /ByteRange num comentário), é recusado na hora como sem assinatura');
create temp table e2 as select pg_temp.envio_link(ipe, pg_temp.res(pg_temp.sha('x2'), 5500, 1, (select pg_temp.sha(ipe::text) from c), '{"soAssinatura": false}')) as id from cod;
select is((select situacao || ' ' || e_o_gerado from envios_contrato where id = (select id from e2)), 'NAO_E_O_GERADO false',
  'com a parte acrescentada trazendo mais que a assinatura (a página redefinida), não é o contrato gerado');
create temp table e3 as select pg_temp.envio_link(ipe, pg_temp.res(pg_temp.sha('x3'), 5500, 1, (select pg_temp.sha(ipe::text) from c)) - 'soAssinatura') as id from cod;
select is((select situacao from envios_contrato where id = (select id from e3)), 'NAO_E_O_GERADO', 'sem a resposta de só assinatura, também não conta');
create temp table e4 as select pg_temp.envio_link(ipe, pg_temp.res(pg_temp.sha('e' || (select ipe from c)::text), 5500, 1, (select pg_temp.sha(ipe::text) from c))) as id from cod;
select is((select array_agg(situacao order by enviado_em) from envios_contrato where contrato_id = (select ipe from c)),
  array['RECUSADO_NA_HORA', 'SUBSTITUIDO', 'SUBSTITUIDO', 'A_CONFERIR'], 'o envio certo fica para a equipe e substitui os que não contam');
select comercial_conferir_envio(com, (select id from e4), pg_temp.ev((select id from e4)), '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}') from ids;
create temp table t as select (comercial_iniciar_envio(adm, (select ipe from c), '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 6000}') ->> 'envioId')::uuid as id from ids;
select is((select comercial_envio_a_verificar(adm, id) ->> 'baseCaminho' from ids, t), (select caminho from envios_contrato where id = (select id from e4)),
  'para a TRÍADE, a base é o arquivo conferido do condomínio');
-- O CPF de quem representa: inteiro no retrato que monta o PDF, mascarado na leitura.
select is((select dados -> 'campos' ->> 'cpf_representante' from contratos_comercial where id = (select ipe from c)), '529.982.247-25',
  'o retrato do PDF leva o CPF inteiro');
select is((select comercial_contrato(com, ipe) -> 'contrato' -> 'campos' ->> 'cpf_representante' from ids, i), '***.982.247-**',
  'a tela do contrato mostra o CPF mascarado');

-- 2. Anonimizar com o contrato aguardando a TRÍADE: o envio conferido do condomínio também some.
select is((select situacao from contratos_comercial where id = (select ipe from c)), 'AGUARDA_TRIADE', 'o contrato do Ipê aguarda a TRÍADE');
select comercial_excluir(adm, ipe) from ids, i;
select is((select count(*)::integer from envios_contrato where interessado_id = (select ipe from i)
             and (apagado_em is null or cpf_mascarado is not null or nome is not null or ip is not null)), 0,
  'nenhum envio de quem não virou cliente fica com arquivo ou com quem enviou, nem o conferido');
select is((select count(*)::integer from envios_contrato where interessado_id = (select ipe from i) and not pg_temp.na_fila(caminho)), 0,
  'todos os arquivos dos envios vão para a fila, também o recusado na hora que já estava apagado');
select is((select count(*)::integer from documentos_aceite where interessado_id = (select ipe from i) and not pg_temp.na_fila(caminho))
          + (select count(*)::integer from contratos_comercial where interessado_id = (select ipe from i) and not pg_temp.na_fila(caminho)), 0,
  'e os documentos e o PDF do contrato');

-- 3. Anonimizar com o contrato assinado por quem não virou cliente.
create temp table cj as select pg_temp.assinar(pg_temp.gerado(jatoba, (select jatoba from cod)), (select jatoba from cod)) as id from i;
select is((select situacao from contratos_comercial where id = (select id from cj)), 'ASSINADO', 'o contrato do Jatobá está assinado');
select comercial_excluir(adm, jatoba) from ids, i;
select is((select dados from contratos_comercial where id = (select id from cj)), '{"anonimizado": true, "numero": 1}'::jsonb,
  'sem virar cliente, o contrato assinado perde o retrato');
select is((select count(*)::integer from envios_contrato where contrato_id = (select id from cj) and situacao = 'CONFERIDO'
             and apagado_em is not null and cpf_mascarado is null and assinante_nome is null and pg_temp.na_fila(caminho)), 2,
  'e os dois envios conferidos perdem o arquivo e quem assinou');

-- 4. Documento que chega tarde e um só recebido de cada tipo.
create temp table cl as select pg_temp.gerado(louro, (select louro from cod)) as id from i;
create temp table dt as select (publico_iniciar_documento((select louro from cod), '{"tipo": "ATA_APROVACAO", "nome": "ata.pdf", "tamanho": 900}', null) ->> 'documentoId')::uuid as id;
select pg_temp.assinar((select id from cl), (select louro from cod));
select is((select publico_verificar_documento((select louro from cod), id, true, 900, pg_temp.sha('ata'), null) ->> 'situacao' from dt), 'RECUSADO',
  'o documento conferido depois das duas assinaturas não é guardado');
select is((select motivo_recusa from documentos_aceite where id = (select id from dt)), 'O contrato já foi assinado pelos dois; o documento não foi guardado.',
  'com o motivo');
select ok((select pg_temp.na_fila(caminho) from documentos_aceite where id = (select id from dt)), 'e o arquivo vai para a fila');
select is(pg_temp.motivo($$ select publico_iniciar_documento((select louro from cod), '{"tipo": "ATA_APROVACAO", "nome": "a.pdf", "tamanho": 900}', null) $$),
  'CONTRATO_ASSINADO', 'e depois das duas assinaturas o link não começa outro');
create temp table d2 as select
  (publico_iniciar_documento((select mogno from cod), '{"tipo": "CNPJ", "nome": "c1.pdf", "tamanho": 900, "cnpj": "11222333000181"}', null) ->> 'documentoId')::uuid as um,
  (publico_iniciar_documento((select mogno from cod), '{"tipo": "CNPJ", "nome": "c2.pdf", "tamanho": 900, "cnpj": "11222333000181"}', null) ->> 'documentoId')::uuid as outro;
select publico_verificar_documento((select mogno from cod), um, true, 900, pg_temp.sha('um'), null) from d2;
select throws_ok(format($$ update documentos_aceite set situacao = 'RECEBIDO', recebido_em = app_now(), sha256 = %L where id = %L $$, pg_temp.sha('d2'), (select outro from d2)),
  '23505', null, 'dois cartões do CNPJ recebidos ao mesmo tempo esbarram no índice único');

-- 5. Teto de envios em aberto por interessado.
select publico_iniciar_documento((select mogno from cod), jsonb_build_object('tipo', 'CNPJ', 'nome', 'c' || n || '.pdf', 'tamanho', 900, 'cnpj', '11222333000181'), null)
  from generate_series(3, 4) n;
select is(pg_temp.motivo($$ select publico_iniciar_documento((select mogno from cod), '{"tipo": "CNPJ", "nome": "c4.pdf", "tamanho": 900, "cnpj": "11222333000181"}', null) $$),
  'ENVIOS_EM_ABERTO', 'com três envios em aberto, o quarto espera');
select is(pg_temp.motivo($$ select comercial_iniciar_documento((select com from ids), (select mogno from i), '{"tipo": "ATA_ELEICAO", "nome": "a.pdf", "tamanho": 900, "mandatoAte": "2027-12-31"}') $$),
  'ENVIOS_EM_ABERTO', 'também pela equipe');
select is((select configuracao_int('contrato_envios_abertos_max')), 3, 'o teto fica na configuração');

-- 6. O interessado fecha com o piloto aberto: o piloto termina e o condomínio vai a Piloto encerrado.
create temp table pp as select pg_temp.piloto(pequi) as pequi, pg_temp.piloto(umbu) as umbu, pg_temp.piloto(caju) as caju from i;
select comercial_mudar_etapa(com, pequi, pg_temp.iv(pequi), 'PERDIDO', 'PRECO') from ids, i;
select is((select situacao || ' ' || motivo_perda from pilotos_comercial where id = (select (pequi ->> 'id')::uuid from pp)), 'PERDIDO PRECO',
  'Perdido com o piloto em andamento: o piloto termina perdido, com o motivo do interessado');
select is((select estado from clientes where condominio_id = (select (pequi ->> 'condominioId')::uuid from pp)), 'PILOTO_ENCERRADO',
  'e o condomínio sai de Em piloto para Piloto encerrado');
select comercial_encerrar_piloto(com, (umbu ->> 'id')::uuid, (umbu ->> 'versao')::integer, '{"resultado": "PROPOSTA"}') from ids, pp;
select comercial_mudar_etapa(com, umbu, pg_temp.iv(umbu), 'SEM_RESPOSTA') from ids, i;
select is((select situacao || ' ' || motivo_perda from pilotos_comercial where id = (select (umbu ->> 'id')::uuid from pp)), 'PERDIDO NAO_RESPONDEU',
  'o piloto que virou proposta também termina quando o interessado fica sem resposta');
select is((select estado from clientes where condominio_id = (select (umbu ->> 'condominioId')::uuid from pp)), 'PILOTO_ENCERRADO', 'e o condomínio a Piloto encerrado');
select ok((select contatos <> '[]'::jsonb and cnpj is not null from condominios where id = (select (caju ->> 'condominioId')::uuid from pp)),
  'o condomínio do piloto do Caju tem os contatos e o CNPJ do interessado');
select comercial_excluir(adm, caju) from ids, i;
select is((select situacao from pilotos_comercial where id = (select (caju ->> 'id')::uuid from pp)), 'PERDIDO', 'anonimizar encerra o piloto');
select is((select estado from clientes where condominio_id = (select (caju ->> 'condominioId')::uuid from pp)), 'PILOTO_ENCERRADO', 'o condomínio vai a Piloto encerrado');
select is((select jsonb_build_array(contatos, cnpj) from condominios where id = (select (caju ->> 'condominioId')::uuid from pp)), '[[], null]'::jsonb,
  'e perde os contatos e o CNPJ (fica o nome na carteira)');

-- 7. Piloto perdido e interessado retomado: virar cliente usa o condomínio do piloto.
select comercial_mudar_etapa(com, pequi, pg_temp.iv(pequi), 'EM_CONTATO') from ids, i;
select is(pg_temp.motivo(format('select comercial_iniciar_piloto(%L, %L, %s, %L)', (select adm from ids), (select pequi from i), pg_temp.iv((select pequi from i)),
             jsonb_build_object('prazoDias', 30, 'comecaEm', '2026-10-26', 'meta', 'RETORNOS_NO_PRAZO', 'metaPercentual', 80, 'combinadoCom', 'Lúcia',
                                'responsavelImplantacaoId', (select imp from ids)))), 'PILOTO_JA_FEITO', 'um segundo piloto é recusado com motivo claro');
select is((select comercial_piloto(com, pequi) ->> 'podeComecar' from ids, i), 'false', 'e a tela não oferece começar');
create temp table cp as select pg_temp.aceita(pequi, '{"tabela": "CHEIA"}') as codigo from i;
create temp table kp as select pg_temp.assinar(pg_temp.gerado(pequi, (select codigo from cp), date '2026-11-15'), (select codigo from cp)) as id from i;
select is((select dados ->> 'implantacaoParcelas' from contratos_comercial where id = (select id from kp)), '3', 'o contrato guarda as parcelas da implantação');
update interessados set decisor = 'Síndica, com o conselho', decisao_em = '2026-11-10' where id = (select pequi from i);
create temp table vc as select comercial_virar_cliente(adm, pequi, pg_temp.iv(pequi), jsonb_build_object('responsavelImplantacaoId', imp)) as r from ids, i;
select is((select jsonb_build_array(r ->> 'doPiloto', (r ->> 'condominioId') = (select pequi ->> 'condominioId' from pp)) from vc), '["true", true]'::jsonb,
  'virar cliente depois do piloto perdido usa o mesmo condomínio');
select is((select estado from clientes where condominio_id = (select (r ->> 'condominioId')::uuid from vc)), 'IMPLANTACAO', 'que sai de Piloto encerrado para a implantação');

-- 8. A primeira cobrança segue o contrato: as parcelas da implantação, a partir do início.
select is((select inicio_competencia from planos_cliente where condominio_id = (select (r ->> 'condominioId')::uuid from vc)), date '2026-12-01',
  'com início em 15/11, a primeira competência é a de dezembro (o vencimento de novembro seria antes do início)');
select is((select array_agg(jsonb_build_array(parcela, valor_centavos::bigint, vence_em, referencia) order by parcela) from cobrancas
            where condominio_id = (select (r ->> 'condominioId')::uuid from vc) and tipo = 'IMPLANTACAO'),
  array['[1, 30000, "2026-12-10", "Implantação · contrato nº 1 (1/3)"]', '[2, 30000, "2027-01-10", "Implantação · contrato nº 1 (2/3)"]',
        '[3, 30000, "2027-02-10", "Implantação · contrato nº 1 (3/3)"]']::jsonb[], 'a implantação sai nas 3 parcelas do contrato, mês a mês');
select is((select min(vence_em) >= date '2026-11-15' from cobrancas where condominio_id = (select (r ->> 'condominioId')::uuid from vc)), true,
  'nenhum vencimento antes do início do contrato');
select throws_ok(format($$ update cobrancas set parcela = 5 where condominio_id = %L and parcela = 3 $$, (select r ->> 'condominioId' from vc)), 'TC422', null,
  'a parcela não se edita');
-- A divisão que não fecha vai para a última parcela; sem o pedido de parcelas, uma só, como antes.
create temp table cd as select console_criar_condominio(adm, 'Residencial Aroeira', 'Brasília', 'DF', null) as um,
                               console_criar_condominio(adm, 'Residencial Buriti', 'Brasília', 'DF', null) as outro from ids;
select set_config('app.implantacao_parcelas', '3', true);
select console_salvar_plano(adm, um, null, 'Tabela cheia', 1, 40, 19900, 'MENSAL', 10, 100000, false, 'Implantação', date '2026-12-01') from ids, cd;
select set_config('app.implantacao_parcelas', '', true);
select console_salvar_plano(adm, outro, null, 'Tabela cheia', 1, 40, 19900, 'MENSAL', 10, 100000, false, 'Implantação', date '2026-12-01') from ids, cd;
select is((select array_agg(valor_centavos::bigint order by parcela) from cobrancas where condominio_id = (select um from cd)), array[33333, 33333, 33334]::bigint[],
  'o resto da divisão fica na última parcela');
select is((select array_agg(referencia || ' ' || vence_em) from cobrancas where condominio_id = (select outro from cd)), array['Implantação 2026-12-10'],
  'sem o pedido de parcelas, a implantação é uma cobrança só');

-- 9. Depois de virar cliente, o Comercial deixa de ver os dados do condomínio; a Administração vê.
select is((select comercial_contrato(com, pequi) ->> 'restrito' from ids, i), 'true', 'o contrato fica restrito para o Comercial');
select ok((select not (comercial_contrato(com, pequi) ? 'aceite') and not (comercial_contrato(com, pequi) -> 'contrato' ? 'campos') from ids, i),
  'sem o aceite e sem os campos do contrato');
select is((select comercial_contrato(adm, pequi) -> 'contrato' -> 'campos' ->> 'cpf_representante' from ids, i), '***.982.247-**',
  'a Administração continua vendo, com o CPF mascarado');
select is((select comercial_piloto(com, pequi) ->> 'restrito' from ids, i), 'true', 'o piloto também fica restrito');
select ok((select not (comercial_piloto(com, pequi) -> 'piloto' ? 'resultado') and not (comercial_ficha(com, pequi) -> 'piloto' ? 'resultado') from ids, i),
  'sem o resultado do piloto, na tela e na ficha');
select is((select comercial_troca(com, pequi) ->> 'restrito' from ids, i), 'true', 'e a troca de sistema');
select ok((select comercial_troca(adm, pequi) ->> 'restrito' is null from ids, i), 'que a Administração vê inteira');
select is(pg_temp.motivo($$ select publico_iniciar_documento((select codigo from cp), '{"tipo": "ATA_APROVACAO", "nome": "a.pdf", "tamanho": 900}', null) $$),
  'VIROU_CLIENTE', 'depois de virar cliente, o link não recebe documento');

-- 10. A rotina dos envios abandonados: passado um dia, o pedido é recusado e o arquivo vai para a fila.
select pg_temp.em(app_now() + interval '3 hours');
select ok((select publico_iniciar_documento((select mogno from cod), '{"tipo": "CNPJ", "nome": "c4.pdf", "tamanho": 900, "cnpj": "11222333000181"}', null) ? 'documentoId'),
  'passadas duas horas (o link de envio venceu), o envio novo vale');
select pg_temp.em(app_now() + interval '1 day 1 hour');
create temp table lim as select comercial_limpar_envios_abertos() as n;
select ok((select n >= 5 from lim), 'a rotina recusa os envios abertos há mais de um dia');
select is((select array_agg(situacao || ' ' || coalesce(motivo_recusa, '-') order by enviado_em, nome) from documentos_aceite where interessado_id = (select mogno from i)),
  array['RECEBIDO -', 'RECUSADO O arquivo não foi conferido a tempo; envie de novo.', 'RECUSADO O arquivo não foi conferido a tempo; envie de novo.',
        'RECUSADO O arquivo não foi conferido a tempo; envie de novo.', 'RECUSADO O arquivo não foi conferido a tempo; envie de novo.'],
  'os documentos que nunca foram conferidos ficam recusados; o recebido fica');
select is((select count(*)::integer from arquivos_a_apagar a join documentos_aceite d on d.caminho = a.caminho
            where d.interessado_id = (select mogno from i) and a.origem = 'COMERCIAL_ABANDONADO'), 4, 'e os arquivos vão para a fila');
select is((select situacao || ' ' || motivo_auto from envios_contrato where id = (select id from t)), 'RECUSADO_NA_HORA ARQUIVO_INVALIDO',
  'o envio da TRÍADE que nunca foi conferido também');
select is((select comercial_limpar_envios_abertos()), 0, 'rodar de novo não acha mais nada');
select * from finish();
rollback;

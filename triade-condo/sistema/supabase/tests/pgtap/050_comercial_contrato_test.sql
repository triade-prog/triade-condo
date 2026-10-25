-- Contrato pelo gov.br (0308, R17.4; CM-13, quadros 440 a 444): Modelos › Contrato com a revisão
-- do advogado e os campos «...» conferidos, a versão em uso que não se edita, os documentos do
-- aceite pelo link e pela equipe, o contrato gerado com o retrato e o sha256, gerar de novo que
-- substitui e zera as assinaturas, a ordem fixa das assinaturas (condomínio e depois a TRÍADE
-- sobre o arquivo conferido), a conferência automática (sem assinatura, outro conteúdo) e a da
-- equipe com as três marcas, a recusa com motivo e o link que vale depois do aceite.
begin;
select plan(87);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Fábio', 'FINANCEIRO') as fin;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp)) ->> 'id')::uuid;
  update interessados set unidades = 72, faixa = 'DE_41_A_100' where id = v;
  return v;
end $$;
-- Proposta enviada e aceita pelo link; devolve o código do link.
create function pg_temp.aceita(p_interessado uuid) returns text language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_interessado, '{}');
  e := comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  perform publico_aceitar_proposta(e -> 'link' ->> 'codigo', '{"nome": "Lúcia Prado", "cpf": "529.982.247-25", "cargo": "Síndica", "concordo": true}',
                                   '200.1.2.3', null);
  return e -> 'link' ->> 'codigo';
end $$;
-- Documento pelo link, já conferido pela API.
create function pg_temp.doc(p_codigo text, p_dados jsonb) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (publico_iniciar_documento(p_codigo, p_dados || '{"nome": "doc.pdf", "tamanho": 2048}', '200.1.2.3') ->> 'documentoId')::uuid;
  perform publico_verificar_documento(p_codigo, v, true, 2048, pg_temp.sha(v::text), null);
  return v;
end $$;
-- Envio do PDF assinado pelo link, com o resultado da conferência automática.
create function pg_temp.envio_link(p_codigo text, p_res jsonb) returns jsonb language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.em(app_now() + interval '1 minute');
  v := (publico_iniciar_envio(p_codigo, '{"nome": "contrato-assinado.pdf", "tamanho": 3000}', '200.1.2.3') ->> 'envioId')::uuid;
  return publico_verificar_envio(p_codigo, v, p_res) || jsonb_build_object('envioId', v);
end $$;
create function pg_temp.envio_triade(p_contrato uuid, p_res jsonb) returns jsonb language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.em(app_now() + interval '1 minute');
  v := (comercial_iniciar_envio((select adm from ids), p_contrato, '{"parte": "TRIADE", "nome": "contrato-final.pdf", "tamanho": 4000}') ->> 'envioId')::uuid;
  return comercial_verificar_envio((select adm from ids), v, p_res) || jsonb_build_object('envioId', v);
end $$;
create function pg_temp.ev(p uuid) returns integer language sql as $$ select versao from envios_contrato where id = p $$;
create function pg_temp.res(p_sha text, p_tamanho integer, p_assinaturas integer, p_prefixo text) returns jsonb language sql as $$
  select jsonb_build_object('valido', true, 'sha256', p_sha, 'tamanho', p_tamanho, 'assinaturas', p_assinaturas, 'prefixoSha256', p_prefixo) $$;
create function pg_temp.marcas(p_cpf text default null) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('assinaturaValida', true, 'pessoaConfere', true, 'dataConfere', true, 'cpf', p_cpf)) $$;

select pg_temp.em('2026-10-24 10:00:00-03');
create temp table i as select pg_temp.interessado('Edifício Aroeira', '5561999990401') as aroeira, pg_temp.interessado('Edifício Buriti', '5561999990402') as buriti;
create temp table cod as select pg_temp.aceita(aroeira) as aroeira from i;

-- 1. Sem versão do modelo em uso, Gerar contrato fica desligado (quadro 336).
select is((select comercial_contrato(com, aroeira) ->> 'motivoSemGerar' from ids, i), 'SEM_MODELO_CONTRATO', 'sem modelo em uso, o contrato diz por que não gera');
select is(pg_temp.motivo($$ select comercial_gerar_contrato((select com from ids), (select aroeira from i), date '2026-11-01', null) $$),
  'SEM_MODELO_CONTRATO', 'sem modelo em uso, gerar é recusado');
select is((select comercial_contrato(com, buriti) ->> 'motivoSemGerar' from ids, i), 'SEM_ACEITE', 'sem aceite, não há contrato');

-- 2. Modelos › Contrato (quadro 443): só a Administração; campos da lista; revisão para usar.
create temp table texto as select
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS. Contratante: «condominio», CNPJ «cnpj», representado por «representante», CPF «cpf_representante», '
  || 'mandato até «mandato_ate». Plano: «plano». Mensalidade: «valor_mensal». Anual: «valor_anual». Implantação: «implantacao». '
  || 'Desconto: «desconto». Início: «data_inicio». Reajuste anual pelo «indice_reajuste».' as t,
  'TERMO DE TRATAMENTO DE DADOS. A TRÍADE trata os dados dos moradores do «condominio» só para prestar o serviço contratado.' as termo;
select throws_ok($$ select comercial_salvar_modelo_contrato((select com from ids), null, null, jsonb_build_object('titulo', 'Contrato', 'texto', (select t from texto))) $$,
  'TC401', null, 'o Comercial não muda o modelo de contrato');
select is((select pg_temp.erro(format('select comercial_salvar_modelo_contrato(%L, null, null, %L)', adm,
             jsonb_build_object('titulo', 'Contrato padrão', 'texto', t || ' Multa: «multa». Foro «cidade.', 'termo', termo))) -> 'detalhe' from ids, texto),
  '{"motivo": "CAMPO_ERRADO", "campos": ["texto"], "camposErrados": ["«", "«multa»"]}'::jsonb,
  'campo fora da lista ou « sobrando impede salvar e a tela mostra quais');
create temp table m as select comercial_salvar_modelo_contrato(adm, null, null, jsonb_build_object('titulo', 'Contrato padrão', 'texto', t)) as r from ids, texto;
select is((select r -> 'falta' from m), '["revisao", "termo", "indiceReajuste"]'::jsonb, 'o rascunho diz o que falta para usar');
select is((select pg_temp.erro(format('select comercial_usar_modelo_contrato(%L, %L, %s)', adm, r ->> 'id', r ->> 'versao')) -> 'detalhe' from ids, m),
  '{"motivo": "MODELO_SEM_REVISAO", "campos": ["advogadoNome", "advogadoOab", "revisadoEm", "termo", "indiceReajuste"]}'::jsonb,
  'sem a revisão do advogado (nome, OAB e data), o termo e o índice, a versão não é usada');
select is(pg_temp.campos(format('select comercial_salvar_modelo_contrato(%L, %L, %s, %L)', (select adm from ids), (select r ->> 'id' from m), (select r ->> 'versao' from m),
             jsonb_build_object('titulo', 'Contrato padrão', 'texto', (select t from texto), 'advogadoNome', 'Rui Barros', 'advogadoOab', 'DF', 'revisadoEm', '2026-10-20'))),
  '["advogadoOab"]'::jsonb, 'OAB sem número é recusada');
select is(pg_temp.campos(format('select comercial_salvar_modelo_contrato(%L, %L, %s, %L)', (select adm from ids), (select r ->> 'id' from m), (select r ->> 'versao' from m),
             jsonb_build_object('titulo', 'Contrato padrão', 'texto', (select t from texto), 'advogadoNome', 'Rui Barros', 'advogadoOab', 'DF 12345', 'revisadoEm', '2026-10-30'))),
  '["revisadoEm"]'::jsonb, 'a revisão é de hoje para trás');
update m set r = (select comercial_salvar_modelo_contrato(adm, (m.r ->> 'id')::uuid, (m.r ->> 'versao')::integer,
  jsonb_build_object('titulo', 'Contrato padrão', 'texto', t, 'termo', termo, 'indiceReajuste', 'IPCA', 'advogadoNome', 'Rui Barros',
                     'advogadoOab', 'OAB/df 12.345', 'revisadoEm', '2026-10-20')) from ids, texto);
select is((select r -> 'revisao' from m), '{"advogado": "Rui Barros", "oab": "DF 12345", "em": "2026-10-20"}'::jsonb, 'a OAB fica como DF 12345');
update m set r = (select comercial_usar_modelo_contrato(adm, (m.r ->> 'id')::uuid, (m.r ->> 'versao')::integer) from ids);
select is((select r ->> 'situacao' from m), 'EM_USO', 'com a revisão, a versão vai para uso');
select is(pg_temp.motivo(format('select comercial_salvar_modelo_contrato(%L, %L, %s, %L)', (select adm from ids), (select r ->> 'id' from m), (select r ->> 'versao' from m),
             jsonb_build_object('titulo', 'Outro', 'texto', (select t from texto)))), 'MODELO_EM_USO', 'a versão em uso não se edita pela função');
select is(pg_temp.motivo($$ update modelos_contrato set texto = texto || ' Cláusula nova.' where situacao = 'EM_USO' $$), 'MODELO_EM_USO',
  'nem direto na tabela');
select is((select comercial_modelos_contrato(com) -> 'emUso' ->> 'numero' from ids), '1', 'o Comercial vê qual versão está em uso');
select is((select comercial_modelos_contrato(com) ->> 'podeEditar' from ids), 'false', 'mas não edita');
-- A versão 2 em uso substitui a 1.
create temp table m2 as select comercial_salvar_modelo_contrato(adm, null, null, jsonb_build_object('titulo', 'Contrato padrão', 'texto', t, 'termo', termo,
  'indiceReajuste', 'IPCA', 'advogadoNome', 'Rui Barros', 'advogadoOab', 'DF 12345', 'revisadoEm', '2026-10-21')) as r from ids, texto;
update m2 set r = (select comercial_usar_modelo_contrato(adm, (m2.r ->> 'id')::uuid, (m2.r ->> 'versao')::integer) from ids);
select is((select array_agg(situacao order by numero) from modelos_contrato), array['SUBSTITUIDA', 'EM_USO'], 'uma só versão em uso; a anterior fica substituída');

-- 3. Documentos do aceite (quadro 441): pelo link e pela equipe; só PDF até 10 MB.
select is((select comercial_contrato(com, aroeira) ->> 'motivoSemGerar' from ids, i), 'FALTA_DOCUMENTO', 'com modelo, falta o CNPJ e a ata');
select is((select pg_temp.erro(format('select comercial_gerar_contrato(%L, %L, date ''2026-11-01'', null)', com, aroeira)) -> 'detalhe' from ids, i),
  '{"motivo": "FALTA_DOCUMENTO", "faltam": ["CNPJ", "ATA_ELEICAO"]}'::jsonb, 'gerar diz o que falta');
select is(pg_temp.campos($$ select publico_iniciar_documento((select aroeira from cod), '{"tipo": "CNPJ", "nome": "cnpj.pdf", "tamanho": 100, "cnpj": "11.222.333/0001-82"}', null) $$),
  '["cnpj"]'::jsonb, 'CNPJ com dígito errado é recusado');
select is(pg_temp.campos($$ select publico_iniciar_documento((select aroeira from cod), '{"tipo": "CNPJ", "nome": "cnpj.pdf", "tamanho": 10485761, "cnpj": "11222333000181"}', null) $$),
  '["tamanho"]'::jsonb, 'mais de 10 MB é recusado');
select is(pg_temp.campos($$ select publico_iniciar_documento((select aroeira from cod), '{"tipo": "ATA_ELEICAO", "nome": "ata.pdf", "tamanho": 100, "mandatoAte": "2026-10-01"}', null) $$),
  '["mandatoAte"]'::jsonb, 'ata com o mandato já acabado é recusada');
select is(pg_temp.campos($$ select publico_iniciar_documento((select aroeira from cod), '{"tipo": "ATA_ELEICAO", "nome": "ata.pdf", "tamanho": 100}', null) $$),
  '["mandatoAte"]'::jsonb, 'ata sem o fim do mandato é recusada');
create temp table d as select pg_temp.doc(aroeira, '{"tipo": "CNPJ", "cnpj": "11.222.333/0001-81"}') as cnpj1 from cod;
select is((select situacao || ' ' || cnpj || ' ' || pelo_link from documentos_aceite where id = (select cnpj1 from d)), 'RECEBIDO 11222333000181 true',
  'o cartão do CNPJ chega pelo link, conferido');
-- Pela equipe, a ata (o síndico mandou pelo WhatsApp).
create temp table da as select comercial_iniciar_documento(com, aroeira, '{"tipo": "ATA_ELEICAO", "nome": "ata.pdf", "tamanho": 900, "mandatoAte": "2027-12-31"}') as r from ids, i;
select is((select comercial_documento_a_verificar(com, (r ->> 'documentoId')::uuid) ->> 'caminho' from ids, da), (select r ->> 'caminho' from da),
  'a API acha o arquivo para conferir');
select is((select comercial_verificar_documento(com, (r ->> 'documentoId')::uuid, false, null, null, 'O arquivo não é um PDF.') ->> 'situacao' from ids, da),
  'RECUSADO', 'arquivo que não passa na conferência é recusado com o motivo');
select is(pg_temp.motivo(format('select comercial_verificar_documento(%L, %L, true, 900, %L, null)', (select com from ids), (select r ->> 'documentoId' from da), pg_temp.sha('x'))),
  'ENVIO_CONFERIDO', 'o envio conferido não volta');
delete from da;
insert into da select comercial_iniciar_documento(com, aroeira, '{"tipo": "ATA_ELEICAO", "nome": "ata.pdf", "tamanho": 900, "mandatoAte": "2027-12-31"}') from ids, i;
select is((select comercial_verificar_documento(com, (r ->> 'documentoId')::uuid, true, 900, pg_temp.sha('ata'), null) ->> 'situacao' from ids, da),
  'RECEBIDO', 'a ata pela equipe é recebida');
select is((select comercial_contrato(com, aroeira) -> 'faltam' from ids, i), '[]'::jsonb, 'não falta documento');
-- Um CNPJ novo substitui o anterior, e o arquivo dele vai para a fila de apagar.
create temp table d2 as select pg_temp.doc(aroeira, '{"tipo": "CNPJ", "cnpj": "11222333000181"}') as cnpj2 from cod;
select is((select situacao from documentos_aceite where id = (select cnpj1 from d)), 'SUBSTITUIDO', 'o CNPJ anterior fica substituído');
select ok(exists (select 1 from arquivos_a_apagar a join documentos_aceite x on x.caminho = a.caminho where x.id = (select cnpj1 from d) and a.bucket = 'comercial'),
  'e o arquivo dele vai para a fila da retenção no bucket comercial');
select throws_ok($$ select comercial_iniciar_documento((select fin from ids), (select aroeira from i), '{"tipo": "CNPJ"}') $$, 'TC401', null,
  'sem o Comercial, não manda documento');
select is(pg_temp.motivo($$ select comercial_iniciar_documento((select com from ids), (select buriti from i), '{"tipo": "CNPJ", "nome": "c.pdf", "tamanho": 1, "cnpj": "11222333000181"}') $$),
  'SEM_ACEITE', 'documento só depois do aceite');

-- 4. Gerar contrato (quadro 440): o retrato, o hash e o PDF.
select is(pg_temp.campos($$ select comercial_gerar_contrato((select com from ids), (select aroeira from i), date '2026-10-01', null) $$), '["dataInicio"]'::jsonb,
  'a data de início não fica no passado');
select is(pg_temp.campos($$ select comercial_gerar_contrato((select com from ids), (select aroeira from i), date '2027-06-01', null) $$), '["dataInicio"]'::jsonb,
  'nem a mais de 180 dias');
select throws_ok($$ select comercial_gerar_contrato((select fin from ids), (select aroeira from i), date '2026-11-01', null) $$, 'TC401', null, 'sem o Comercial, não gera');
create temp table c1 as select comercial_gerar_contrato(com, aroeira, date '2026-11-01', null) as r from ids, i;
select is((select (r -> 'dados' -> 'campos') - array['plano', 'valor_mensal', 'implantacao', 'desconto', 'valor_anual'] from c1),
  '{"condominio": "Edifício Aroeira", "cnpj": "11.222.333/0001-81", "representante": "Lúcia Prado", "cpf_representante": "529.982.247-25",
    "mandato_ate": "31/12/2027", "data_inicio": "01/11/2026", "indice_reajuste": "IPCA"}'::jsonb,
  'os campos do contrato saem do aceite, dos documentos e do modelo');
select ok((select r -> 'dados' -> 'campos' ->> 'valor_mensal' from c1) ~ '^R\$ [0-9.]+,[0-9]{2} por mês$', 'a mensalidade em reais');
select is((select r -> 'dados' -> 'campos' ->> 'valor_anual' from c1), 'Não se aplica (ciclo mensal)', 'no mensal, o anual não se aplica');
select is((select strpos(r -> 'dados' ->> 'texto', '«') + strpos(r -> 'dados' ->> 'texto', '»') from c1), 0, 'o texto sai sem nenhum campo «...» por preencher');
select ok((select strpos(r -> 'dados' ->> 'termo', 'Edifício Aroeira') > 0 from c1), 'o termo de tratamento de dados vem junto, preenchido');
select is((select r ->> 'hash' from c1), (select comercial_hash(r -> 'dados') from c1), 'a impressão digital é o sha256 do retrato');
select is((select (r -> 'dados' -> 'modelo') - 'revisadoEm' from c1), '{"numero": 2, "advogado": "Rui Barros", "oab": "DF 12345"}'::jsonb,
  'o retrato guarda a versão do modelo e a revisão');
select is((select r -> 'dados' ->> 'geradoEm' from c1), '2026-10-24T10:00:00-03:00', 'a data da geração fica fixa no retrato (o PDF sai sempre igual)');
select is((select publico_contrato(aroeira) ? 'contrato' from cod), false, 'enquanto o PDF é montado, o link ainda não mostra o contrato');
select is((select comercial_contrato_pronto(com, (r ->> 'contratoId')::uuid, pg_temp.sha('pdf1'), 5000) ->> 'situacao' from ids, c1), 'AGUARDA_CONDOMINIO',
  'com o PDF guardado, o contrato aguarda o condomínio');
select is(pg_temp.motivo($$ select comercial_contrato_pronto((select com from ids), (select (r ->> 'contratoId')::uuid from c1), pg_temp.sha('pdf2'), 5000) $$),
  'CONTRATO_PRONTO', 'o PDF é gravado uma vez');
select is(pg_temp.motivo($$ update contratos_comercial set hash = repeat('0', 64) where id = (select (r ->> 'contratoId')::uuid from c1) $$), 'CONTRATO_FIXO',
  'o contrato gerado não muda');
select is((select publico_contrato(aroeira) -> 'contrato' -> 'assinaturas' from cod),
  '{"condominio": {"situacao": "AGUARDANDO"}, "triade": {"situacao": "ESPERA_CONDOMINIO"}}'::jsonb, 'o link mostra a ordem: o condomínio assina primeiro');
select is((select publico_abrir_contrato(aroeira, false) ->> 'caminho' from cod), (select r ->> 'caminho' from c1), 'o síndico baixa o contrato gerado pelo link');
select is(pg_temp.motivo($$ select publico_abrir_contrato((select aroeira from cod), true) $$), 'SEM_PDF_FINAL', 'o PDF final só depois das duas assinaturas');

-- 5. A ordem das assinaturas e a conferência automática (quadros 441 e 444).
select is(pg_temp.motivo($$ select comercial_iniciar_envio((select adm from ids), (select (r ->> 'contratoId')::uuid from c1), '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 10}') $$),
  'ORDEM_DAS_ASSINATURAS', 'a TRÍADE não assina antes do condomínio');
select throws_ok($$ select comercial_iniciar_envio((select com from ids), (select (r ->> 'contratoId')::uuid from c1), '{"parte": "TRIADE", "nome": "f.pdf", "tamanho": 10}') $$,
  'TC401', null, 'só quem assina pela TRÍADE manda o PDF dela');
create temp table e1 as select pg_temp.envio_link(aroeira, pg_temp.res(pg_temp.sha('s0'), 5200, 0, pg_temp.sha('pdf1'))) as r from cod;
select is((select jsonb_build_array(r ->> 'situacao', r ->> 'motivo', r ->> 'apagarArquivo') from e1), '["RECUSADO_NA_HORA", "SEM_ASSINATURA", "true"]'::jsonb,
  'PDF sem assinatura é recusado na hora e o arquivo é apagado');
insert into e1 select pg_temp.envio_link(aroeira, '{"valido": false, "motivo": "O arquivo não é PDF."}') from cod;
select is((select r ->> 'motivo' from e1 where r ->> 'motivoTexto' = 'O arquivo não é PDF.'), 'ARQUIVO_INVALIDO', 'arquivo inválido também');
insert into e1 select pg_temp.envio_link(aroeira, pg_temp.res(pg_temp.sha('s1'), 5300, 1, pg_temp.sha('outro'))) from cod;
select is((select jsonb_build_array(r ->> 'situacao', r ->> 'apagarArquivo') from e1 where r ->> 'situacao' = 'NAO_E_O_GERADO'), '["NAO_E_O_GERADO", "false"]'::jsonb,
  'assinado sobre outro conteúdo: guardado, não conta');
select is((select publico_contrato(aroeira) -> 'contrato' -> 'assinaturas' -> 'condominio' ->> 'situacao' from cod), 'NAO_E_O_GERADO',
  'o link pede de novo, com o motivo');
insert into e1 select pg_temp.envio_link(aroeira, pg_temp.res(pg_temp.sha('s2'), 5400, 1, pg_temp.sha('pdf1'))) from cod;
create temp table ok1 as select (r ->> 'envioId')::uuid as id from e1 where r ->> 'situacao' = 'A_CONFERIR';
select is((select count(*)::integer from ok1), 1, 'com assinatura sobre o PDF gerado, fica para a equipe conferir');
select is((select situacao from envios_contrato where id = (select (r ->> 'envioId')::uuid from e1 where r ->> 'situacao' = 'NAO_E_O_GERADO')), 'SUBSTITUIDO',
  'o envio que não contava fica substituído pelo novo');
select is((select comercial_contrato(com, aroeira) -> 'envios' -> 0 -> 'automatica' from ids, i) - 'em',
  '{"temAssinatura": true, "assinaturas": 1, "eOGerado": true}'::jsonb, 'a equipe vê a conferência automática');

-- 6. A conferência da equipe no validador (quadro 442): as três marcas.
select is(pg_temp.campos(format('select comercial_conferir_envio(%L, %L, %s, %L)', (select com from ids), (select id from ok1), pg_temp.ev((select id from ok1)),
             '{"assinaturaValida": true}')), '["pessoaConfere", "dataConfere"]'::jsonb, 'sem as três marcas, não confere');
select is(pg_temp.motivo(format('select comercial_conferir_envio(%L, %L, %s, %L)', (select com from ids), (select id from ok1), pg_temp.ev((select id from ok1)),
             pg_temp.marcas('111.444.777-35'))), 'CPF_NAO_CONFERE', 'CPF diferente do aceite não confere');
select is(pg_temp.erro(format('select comercial_conferir_envio(%L, %L, 1000, %L)', (select com from ids), (select id from ok1), pg_temp.marcas())) ->> 'codigo',
  'TC409', 'com a versão velha, conflito');
create temp table cf as select comercial_conferir_envio(com, (select id from ok1), pg_temp.ev((select id from ok1)), pg_temp.marcas('529.982.247-25')) as r from ids;
select is((select (r -> 'conferencia') - array['por', 'em'] from cf),
  '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true, "assinanteNome": "Lúcia Prado", "cpfMascarado": "***.982.247-**"}'::jsonb,
  'fica quem assinou, com o CPF só mascarado');
select is((select r -> 'contrato' ->> 'situacao' from cf), 'AGUARDA_TRIADE', 'conferido o condomínio, aguarda a TRÍADE');
select is(pg_temp.motivo($$ select pg_temp.envio_link((select aroeira from cod), pg_temp.res(pg_temp.sha('s3'), 5500, 1, pg_temp.sha('pdf1'))) $$),
  'CONDOMINIO_JA_CONFERIDO', 'o condomínio não manda de novo depois de conferido');

-- 7. Gerar de novo substitui e zera as assinaturas.
select is(pg_temp.campos($$ select comercial_gerar_contrato((select com from ids), (select aroeira from i), date '2026-11-01', null) $$), '["motivo"]'::jsonb,
  'gerar de novo pede o motivo');
create temp table c2 as select comercial_gerar_contrato(com, aroeira, date '2026-12-01', 'Data de início mudou') as r from ids, i;
select is((select r ->> 'numero' from c2), '2', 'o contrato novo é o nº 2');
select is((select situacao || ' ' || substituido_motivo from contratos_comercial where id = (select (r ->> 'contratoId')::uuid from c1)), 'SUBSTITUIDO Data de início mudou',
  'o anterior fica substituído, com o motivo');
select is((select array_agg(distinct situacao) from envios_contrato where contrato_id = (select (r ->> 'contratoId')::uuid from c1) and situacao in ('CONFERIDO', 'A_CONFERIR')),
  null, 'as assinaturas do anterior não contam mais');
select is((select comercial_contrato(com, aroeira) -> 'anteriores' -> 0 ->> 'numero' from ids, i), '1', 'a tela lista o contrato anterior');
select comercial_contrato_pronto(com, (r ->> 'contratoId')::uuid, pg_temp.sha('pdf2'), 5000) from ids, c2;
delete from ok1;
insert into ok1 select (pg_temp.envio_link(aroeira, pg_temp.res(pg_temp.sha('t1'), 5400, 1, pg_temp.sha('pdf2'))) ->> 'envioId')::uuid from cod;
select comercial_conferir_envio(com, (select id from ok1), pg_temp.ev((select id from ok1)), pg_temp.marcas()) from ids;

-- 8. A TRÍADE assina sobre o arquivo conferido do condomínio.
create temp table t1 as select pg_temp.envio_triade((select (r ->> 'contratoId')::uuid from c2), pg_temp.res(pg_temp.sha('u1'), 6000, 2, pg_temp.sha('pdf2'))) as r;
select is((select r ->> 'situacao' from t1), 'NAO_E_O_GERADO', 'a TRÍADE assinando o PDF gerado (sem a assinatura do condomínio) não conta');
select is((select base_sha256 = pg_temp.sha('t1') and base_assinaturas = 1 from envios_contrato where id = (select (r ->> 'envioId')::uuid from t1)), true,
  'a base da TRÍADE é o arquivo conferido do condomínio, com uma assinatura');
create temp table t2 as select pg_temp.envio_triade((select (r ->> 'contratoId')::uuid from c2), pg_temp.res(pg_temp.sha('u2'), 6000, 1, pg_temp.sha('t1'))) as r;
select is((select r ->> 'motivo' from t2), 'SEM_ASSINATURA', 'sem uma assinatura a mais que a base, recusado na hora');
create temp table t3 as select pg_temp.envio_triade((select (r ->> 'contratoId')::uuid from c2), pg_temp.res(pg_temp.sha('u3'), 6000, 2, pg_temp.sha('t1'))) as r;
select is((select r ->> 'situacao' from t3), 'A_CONFERIR', 'com a segunda assinatura sobre o arquivo do condomínio, fica para conferir');
select is(pg_temp.campos(format('select comercial_recusar_envio(%L, %L, %s, ''x'')', (select com from ids), (select r ->> 'envioId' from t3), pg_temp.ev((select (r ->> 'envioId')::uuid from t3)))),
  '["motivo"]'::jsonb, 'recusar pede o motivo');
select is((select comercial_recusar_envio(com, (r ->> 'envioId')::uuid, pg_temp.ev((r ->> 'envioId')::uuid), 'Assinou com o certificado errado') -> 'recusa' ->> 'motivo' from ids, t3),
  'Assinou com o certificado errado', 'a recusa fica com o motivo');
create temp table t4 as select pg_temp.envio_triade((select (r ->> 'contratoId')::uuid from c2), pg_temp.res(pg_temp.sha('u4'), 6100, 2, pg_temp.sha('t1'))) as r;
select is(pg_temp.campos(format('select comercial_conferir_envio(%L, %L, %s, %L)', (select com from ids), (select r ->> 'envioId' from t4), pg_temp.ev((select (r ->> 'envioId')::uuid from t4)),
             pg_temp.marcas())), '["cpf"]'::jsonb, 'da TRÍADE, o CPF que o validador mostra é obrigatório');
select is((select comercial_conferir_envio(com, (r ->> 'envioId')::uuid, pg_temp.ev((r ->> 'envioId')::uuid), pg_temp.marcas('111.444.777-35')) -> 'contrato' ->> 'situacao' from ids, t4),
  'ASSINADO', 'conferidas as duas, o contrato está assinado');
select is((select publico_abrir_contrato(aroeira, true) ->> 'caminho' from cod), (select caminho from envios_contrato where id = (select (r ->> 'envioId')::uuid from t4)),
  'o PDF final é o da TRÍADE, com as duas assinaturas');
select is(pg_temp.motivo($$ select comercial_gerar_contrato((select com from ids), (select aroeira from i), date '2026-12-01', 'Mudou de novo') $$), 'CONTRATO_ASSINADO',
  'assinado pelos dois, não se gera mais (mudança é aditivo)');
select is(pg_temp.motivo($$ select pg_temp.doc((select aroeira from cod), '{"tipo": "CNPJ", "cnpj": "11222333000181"}') $$), 'CONTRATO_ASSINADO',
  'nem se mandam documentos');
select is((select comercial_contrato(adm, aroeira) ->> 'podeVirarCliente' from ids, i), 'true', 'a Administração pode virar cliente');
select is((select comercial_contrato(com, aroeira) ->> 'podeVirarCliente' from ids, i), 'false', 'o Comercial não');

-- 9. O link vale até 60 dias depois do aceite.
select pg_temp.em('2026-12-24 11:00:00-03');
select is(pg_temp.motivo($$ select publico_contrato((select aroeira from cod)) $$), 'LINK_CONTRATO_VENCIDO', 'passados 60 dias do aceite, o link do contrato vence');
select is((select r ->> 'codigo' from (select teste.erro($$ select publico_contrato('codigo-que-nao-existe') $$) r) x), 'TC404', 'código desconhecido não existe');

-- 10. Histórico: sem dado pessoal, com o Comercial.
select ok(not exists (select 1 from historico where entidade in ('contrato_comercial', 'documento_aceite', 'modelo_contrato')
                                                 and (dados::text ~* '52998224725|Lúcia|200\.1\.2\.3')), 'o histórico não guarda CPF, nome nem IP');
select ok((select count(*) from historico where entidade = 'contrato_comercial' and condominio_id is null) >= 5, 'os eventos do contrato ficam no histórico do Comercial');

select * from finish();
rollback;

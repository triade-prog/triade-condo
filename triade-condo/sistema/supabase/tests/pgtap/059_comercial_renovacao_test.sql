-- Renovação e reajuste (0311, R17.7; CM-30; quadro 346): o aniversário que conta da data de início
-- do contrato assinado, o índice da Administração (sem ele, nada calculado), o fim do fundador pela
-- tabela cheia do dia, o aviso registrado (data, canal e texto) antes de qualquer mudança, o valor
-- novo na competência seguinte ao prazo, o aditivo do modelo em uso com a impressão digital, renovar
-- sem reajuste, o cartão do Início e a retenção do texto do aviso. Da revisão: o valor que a tela mostrou
-- (r4), o aviso seguinte que espera o anterior e o aviso cedo demais (r2), o reajuste superado quando o
-- plano mudou (r1), renovar sem reajuste só pela Administração e com o valor do plano (r6, r9).
begin;
select plan(70);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Iara', 'IMPLANTACAO') as imp;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
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
-- Documentos, contrato (início em 01/11/2026) e as duas assinaturas conferidas; vira cliente.
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
create function pg_temp.ren(p_pessoa uuid, p_interessado uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements(comercial_renovacoes(p_pessoa, null) -> 'renovacoes') x where x ->> 'interessadoId' = p_interessado::text
$$;
create function pg_temp.aviso(p_interessado uuid, p_aniversario date) returns jsonb language sql as $$
  select comercial_registrar_aviso((select com from ids), p_interessado, p_aniversario,
    '{"canal": "WHATSAPP", "para": "Lúcia Prado, síndica", "texto": "Olá, Lúcia. O contrato faz aniversário e a mensalidade muda na competência seguinte."}')
$$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajuste pelo «indice_reajuste».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
        '2026-10-20', 'EM_USO', app_now());
create temp table i as select
  (comercial_criar(com, '{"condominio": "Edifício Ipiranga", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990701"}') ->> 'id')::uuid as ipiranga,
  (comercial_criar(com, '{"condominio": "Residencial Pequi", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990702"}') ->> 'id')::uuid as pequi
  from ids;
create temp table cc as select pg_temp.cliente(ipiranga) as c_ipiranga, pg_temp.cliente(pequi) as c_pequi from i;
-- O Pequi está na tabela cheia (a origem vem pelo contexto, como em console_salvar_plano_tabela).
do $$
begin
  perform set_config('app.plano_tabela', 'CHEIA', true);
  update planos_cliente set nome = 'Tabela cheia, 41 a 100 unidades', valor_centavos = 22900 where condominio_id = (select c_pequi from cc);
  perform set_config('app.plano_tabela', '', true);
end $$;

-- 1. O catálogo e quem pode o quê.
select is((select array_agg(codigo || ':' || sistema || ':' || situacao order by numero) from retencao_tipos where numero between 39 and 40),
  array['AVISO_REAJUSTE:CONSOLE:A_FAZER', 'CANCELAMENTO:CONSOLE:A_FAZER'], 'LGPD: o aviso e o cancelamento entram no catálogo de retenção');
select ok((select comercial_renovacoes(com, null) -> 'pode' = '{"editar": true, "regra": false, "confirmar": false, "desfazer": false, "reativar": false, "assinar": false}'::jsonb
              and comercial_renovacoes(adm, null) -> 'pode' = '{"editar": true, "regra": true, "confirmar": true, "desfazer": true, "reativar": true, "assinar": true}'::jsonb from ids),
  'o Comercial avisa; a regra e a confirmação do cancelamento são da Administração');
select throws_ok($$ select comercial_renovacoes(imp, null) from ids $$, 'TC401', null, 'quem não é do Comercial não vê Renovações');

-- 2. O aniversário conta da data de início do contrato; longe dele, não aparece.
select is(jsonb_array_length(comercial_renovacoes(com, null) -> 'renovacoes'), 0, 'um ano antes do aniversário, nada aparece')
  from ids;
select pg_temp.em('2027-10-01 10:00:00-03');
select is((select pg_temp.ren(com, ipiranga) ->> 'aniversario' from ids, i), '2027-11-01', 'o aniversário é a data de início mais um ano');
select is((select pg_temp.ren(com, ipiranga) ->> 'avisarAte' from ids, i), '2027-10-02', 'avisar até é o aniversário menos o prazo (30 dias)');
select is((select pg_temp.ren(com, ipiranga) ->> 'tipo' from ids, i), 'FIM_FUNDADOR', 'o fundador entra na mesma lista');
select is((select pg_temp.ren(com, ipiranga) -> 'novo' from ids, i), '{"valor": 34900, "tabela": "CHEIA"}'::jsonb,
  'o fim do fundador vai para a tabela cheia da faixa do dia');
select is((select pg_temp.ren(com, pequi) ->> 'tipo' from ids, i), 'REAJUSTE', 'na tabela cheia, é reajuste');
select ok((select not (pg_temp.ren(com, pequi) ? 'novo') from ids, i), 'sem índice, o reajuste não calcula valor nenhum');
select is((select comercial_renovacoes(com, null) -> 'regra' ->> 'definida' from ids), 'false', 'a regra diz que o índice não foi definido');
select is(pg_temp.motivo(format('select pg_temp.aviso(%L, %L)', (select pequi from i), date '2027-11-01')), 'REAJUSTE_A_DEFINIR',
  'sem índice, o aviso do reajuste não sai');
select ok((select comercial_renovacoes(com, null)::text not like '%unidadesAtivas%' from ids), 'CM-11: a tela não leva a contagem de unidades');

-- 3. A regra do reajuste (Administração).
select throws_ok($$ select comercial_salvar_regra_reajuste(com, 1, 'IPCA', 4.8, null, 30) from ids $$, 'TC401', null,
  'o Comercial não muda o índice');
select is(pg_temp.campos(format('select comercial_salvar_regra_reajuste(%L, 1, %L, null, null, 30)', (select adm from ids), 'IPCA')),
  '["indice", "percentual"]'::jsonb, 'o índice e o percentual vêm juntos');
select is(pg_temp.campos(format('select comercial_salvar_regra_reajuste(%L, 1, %L, 4.8, null, 15)', (select adm from ids), 'IPCA')),
  '["prazoAvisoDias"]'::jsonb, 'o prazo do aviso não é menor que 30 dias');
select is((select comercial_salvar_regra_reajuste(adm, 1, 'IPCA', 4.8, '12 meses até setembro de 2027', 30) ->> 'percentual' from ids), '4.80',
  'a Administração define o índice e o percentual');
select is(pg_temp.codigo(format('select comercial_salvar_regra_reajuste(%L, 1, %L, 5, null, 30)', (select adm from ids), 'IPCA')), 'TC409',
  'mudar a regra com a versão velha é conflito');
select is((select pg_temp.ren(com, pequi) -> 'novo' from ids, i),
  '{"valor": 23999, "indice": "IPCA", "percentual": 4.80, "referencia": "12 meses até setembro de 2027"}'::jsonb,
  'com o índice, o valor novo é o de hoje mais o percentual, arredondado ao centavo');

-- 4. O aviso: nada muda sem ele; com ele, o valor novo vale na competência seguinte ao prazo.
select is(pg_temp.campos(format('select pg_temp.aviso(%L, %L)', (select pequi from i), date '2028-11-01')), '["aniversario"]'::jsonb,
  'só o aniversário da vez');
select is(pg_temp.campos(format('select comercial_registrar_aviso(%L, %L, %L, %L)', (select com from ids), (select pequi from i), date '2027-11-01',
  '{"canal": "FAX", "para": "L", "texto": "curto"}')), '["canal"]'::jsonb, 'o canal vem da lista');
select is(pg_temp.campos(format('select comercial_registrar_aviso(%L, %L, %L, %L)', (select com from ids), (select pequi from i), date '2027-11-01',
  '{"canal": "EMAIL", "para": "Lúcia", "texto": "curto"}')), '["texto"]'::jsonb, 'o texto do aviso é guardado');
select is(pg_temp.campos(format('select comercial_registrar_aviso(%L, %L, %L, %L)', (select com from ids), (select pequi from i), date '2027-11-01',
  '{"avisoEm": "2027-10-05", "canal": "EMAIL", "para": "Lúcia", "texto": "O contrato faz aniversário."}')), '["avisoEm"]'::jsonb,
  'o aviso não é registrado no futuro');
select is((select count(*)::integer from reajustes_plano), 0, 'antes do aviso, nada muda no plano');
select is((select teste.erro(format('select comercial_registrar_aviso(%L, %L, %L, %L)', com, pequi, date '2027-11-01',
  '{"valorNovo": 23500, "canal": "WHATSAPP", "para": "Lúcia", "texto": "O contrato faz aniversário e muda."}')) -> 'detalhe' from ids, i),
  '{"motivo": "REGRA_MUDOU", "valorNovo": 23999}'::jsonb, 'r4: se o valor mudou desde que a tela abriu, o aviso é recusado com o valor de agora');
create temp table a1 as select pg_temp.aviso(pequi, date '2027-11-01') as r from i;
select is((select r -> 'renovacao' ->> 'situacao' from a1), 'AVISO_ENVIADO', 'o aviso fica registrado');
select is((select r -> 'renovacao' ->> 'valeDesde' from a1), '2027-11-01',
  'avisado em 01/10 com 30 dias, o valor novo vale na competência do aniversário (vence em 10/11)');
select is((select r -> 'renovacao' -> 'aviso' ->> 'canal' from a1), 'WHATSAPP', 'com o canal');
select ok((select r -> 'aditivo' = 'null'::jsonb from a1), 'sem modelo de aditivo em uso, o reajuste vale só pelo aviso');
select is((select valor_centavos::bigint from reajustes_plano where condominio_id = (select c_pequi from cc)), 23999::bigint,
  'o valor novo espera a competência, no condomínio');
select is((select valor_centavos::bigint from planos_cliente where condominio_id = (select c_pequi from cc)), 22900::bigint, 'o plano ainda não mudou');
select is(pg_temp.motivo(format('select pg_temp.aviso(%L, %L)', (select pequi from i), date '2027-11-01')), 'RENOVACAO_REGISTRADA',
  'o mesmo aniversário não é avisado duas vezes');
select is((select pg_temp.ren(com, pequi) ->> 'situacao' from ids, i), 'AVISO_ENVIADO', 'a lista mostra o aviso enviado');
select is(pg_temp.motivo(format('select pg_temp.aviso(%L, %L)', (select pequi from i), date '2028-11-01')), 'RENOVACAO_PENDENTE',
  'r2: com o aviso anterior ainda fora do plano, o aniversário seguinte espera');
select ok((select count(*) = 1 from conversas_comercial where interessado_id = (select pequi from i) and resumo like 'Aviso de reajuste registrado%'),
  'a ficha guarda uma nota do aviso, sem o texto');
select is(pg_temp.motivo(format('update renovacoes_cliente set valor_novo = 1 where interessado_id = %L', (select pequi from i))), 'SO_INSERCAO',
  'o aviso registrado não se altera');

-- 5. O modelo de aditivo (Modelos › Contrato) e o aditivo do aviso.
select throws_ok($$ select comercial_salvar_modelo_aditivo(com, null, null, '{"titulo": "Aditivo", "texto": "x"}') from ids $$, 'TC401', null,
  'o Comercial não cadastra o modelo de aditivo');
select is(pg_temp.motivo(format('select comercial_salvar_modelo_aditivo(%L, null, null, %L)', (select adm from ids),
  '{"titulo": "Aditivo de reajuste", "texto": "O «condominio» e a TRÍADE combinam o reajuste do contrato «contrato», «cidade»."}')), 'CAMPO_ERRADO',
  'campo que não existe impede salvar');
create temp table m as select comercial_salvar_modelo_aditivo(adm, null, null, '{"titulo": "Aditivo de reajuste",
  "texto": "O «condominio» e a TRÍADE combinam, no contrato «contrato» de «data_contrato», que a mensalidade passa de «valor_atual» para «valor_novo» a partir da «vale_desde», por «motivo_reajuste». Aviso enviado em «aviso_em»."}') as r from ids;
select is((select comercial_usar_modelo_aditivo(adm, (r ->> 'id')::uuid, (r ->> 'versao')::integer) ->> 'situacao' from ids, m), 'EM_USO',
  'a Administração põe o modelo em uso');
select is(pg_temp.motivo(format('select comercial_salvar_modelo_aditivo(%L, %L, 2, %L)', (select adm from ids), (select r ->> 'id' from m),
  '{"titulo": "Outro", "texto": "O «condominio» e a TRÍADE combinam outro texto que é bem maior que cinquenta letras."}')), 'MODELO_EM_USO',
  'a versão em uso não se edita');
create temp table a2 as select pg_temp.aviso(ipiranga, date '2027-11-01') as r from i;
select is((select r -> 'aditivo' ->> 'hash' from a2), (select comercial_hash(r -> 'aditivo' -> 'dados') from a2),
  'CM-13: o aditivo leva a impressão digital do retrato');
select is((select r -> 'aditivo' -> 'dados' ->> 'texto' from a2),
  'O Edifício Ipiranga e a TRÍADE combinam, no contrato nº 1 de 01/11/2026, que a mensalidade passa de R$ 229,00 por mês para R$ 349,00 por mês a partir da competência de 11/2027, por fim do preço de fundador (12 meses), pela tabela cheia do dia do aviso. Aviso enviado em 01/10/2027.',
  'o texto do aditivo sai do modelo com os campos do aviso');
select is(pg_temp.motivo(format('select comercial_abrir_aditivo(%L, %L)', (select com from ids), (select r -> 'renovacao' ->> 'id' from a2))), 'ADITIVO_GERANDO',
  'o aditivo só abre depois de montado');
select is((select comercial_aditivo_pronto(com, (r -> 'aditivo' ->> 'aditivoId')::uuid, pg_temp.sha('pdf'), 4000) ->> 'situacao' from ids, a2), 'PRONTO',
  'a API devolve o PDF montado');
select is((select comercial_abrir_aditivo(com, (r -> 'renovacao' ->> 'id')::uuid) ->> 'nome' from ids, a2), 'aditivo-1.pdf', 'e o aditivo abre');
select is(pg_temp.motivo(format('select comercial_aditivo_pronto(%L, %L, %L, 4000)', (select com from ids), (select r -> 'aditivo' ->> 'aditivoId' from a2),
  pg_temp.sha('outro'))), 'ADITIVO_PRONTO', 'o aditivo montado não muda');

-- 6. A competência: o valor novo entra quando a competência abre; o fundador vai para a cheia.
select pg_temp.em('2027-10-05 10:00:00-03');
select is((select console_abrir_competencia(adm, date '2027-10-01') ->> 'criadas' from ids), '2', 'a competência de outubro abre');
select is((select valor_centavos::bigint from cobrancas where condominio_id = (select c_pequi from cc) and competencia = '2027-10-01'), 22900::bigint,
  'antes do vale desde, cobra o valor de hoje');
select pg_temp.em('2027-11-02 10:00:00-03');
select is((select console_abrir_competencia(adm, date '2027-11-01') ->> 'criadas' from ids), '2', 'a competência de novembro abre');
select is((select valor_centavos::bigint from cobrancas where condominio_id = (select c_pequi from cc) and competencia = '2027-11-01'), 23999::bigint,
  'na competência do vale desde, cobra o valor com reajuste');
select is((select nome || ' · ' || valor_centavos || ' · ' || tabela_origem from planos_cliente where condominio_id = (select c_ipiranga from cc)),
  'Tabela cheia, 41 a 100 unidades · 34900 · CHEIA', 'o fundador passa à tabela cheia');
select ok((select liberada_em is not null from vagas_fundador where condominio_id = (select c_ipiranga from cc)), 'e a vaga de fundador é liberada');
select is((select array_agg(situacao order by aniversario, interessado_id) from renovacoes_cliente), array['APLICADO', 'APLICADO'],
  'a renovação fica aplicada');

-- 7. Renovar sem reajuste e o aniversário seguinte.
select pg_temp.em('2028-10-01 10:00:00-03');
select throws_ok($$ select comercial_dispensar_renovacao(com, pequi, date '2028-11-01', 'Combinado com a síndica') from ids, i $$, 'TC401', null,
  'r6: o Comercial não segura o valor; renovar sem reajuste é da Administração');
select is(pg_temp.campos(format('select comercial_dispensar_renovacao(%L, %L, %L, %L)', (select adm from ids), (select pequi from i), date '2028-11-01', '')),
  '["motivo"]'::jsonb, 'renovar sem reajuste pede o motivo');
do $$
begin
  perform set_config('app.plano_tabela', 'CHEIA', true);
  update planos_cliente set valor_centavos = null where condominio_id = (select c_ipiranga from cc);
  perform set_config('app.plano_tabela', '', true);
end $$;
select is(pg_temp.motivo(format('select comercial_dispensar_renovacao(%L, %L, %L, %L)', (select adm from ids), (select ipiranga from i), date '2028-11-01',
  'Combinado')), 'PLANO_SEM_VALOR', 'r9: com o valor do plano a definir, não renova sem reajuste');
do $$
begin
  perform set_config('app.plano_tabela', 'CHEIA', true);
  update planos_cliente set valor_centavos = 34900 where condominio_id = (select c_ipiranga from cc);
  perform set_config('app.plano_tabela', '', true);
end $$;
select is((select comercial_dispensar_renovacao(adm, pequi, date '2028-11-01', 'Combinado com a síndica na renovação') ->> 'situacao' from ids, i),
  'DISPENSADO', 'renova sem reajuste');
select is((select teste.erro(format('select pg_temp.aviso(%L, %L)', pequi, date '2029-11-01')) -> 'detalhe' from i),
  '{"motivo": "AVISO_CEDO", "desde": "2029-07-04"}'::jsonb, 'r2: o aviso só se registra a partir de 90 dias antes do avisar até');
select is((select pg_temp.ren(com, pequi) ->> 'situacao' from ids, i), 'DISPENSADO', 'a lista mostra a renovação sem reajuste');

-- 8. O cartão do Início: a renovação perto do "avisar até".
select is((select x -> 'renovacao' ->> 'avisarAte' from jsonb_array_elements(comercial_inicio((select com from ids)) -> 'itens') x
            where x ->> 'id' = (select ipiranga::text from i)), '2028-10-02', 'quadro 335: a renovação que pede aviso aparece no Início');
select is((select comercial_inicio(com) -> 'contagens' ->> 'renovacoes' from ids), '1', 'e conta no cartão');

-- 8b. r1: a Administração mudou o plano depois do aviso; o reajuste avisado fica superado.
create temp table a3 as select pg_temp.aviso(ipiranga, date '2028-11-01') as r from i;
select is((select r -> 'renovacao' -> 'novo' ->> 'valor' from a3), '36575', 'o aviso do Ipiranga, com o IPCA sobre a tabela cheia');
do $$
begin
  perform set_config('app.plano_tabela', 'CHEIA', true);
  update planos_cliente set nome = 'Tabela cheia, 101 a 200 unidades', valor_centavos = 54900 where condominio_id = (select c_ipiranga from cc);
  perform set_config('app.plano_tabela', '', true);
end $$;
select pg_temp.em('2028-11-02 10:00:00-03');
select lives_ok($$ select console_abrir_competencia(adm, date '2028-11-01') from ids $$, 'a competência de novembro de 2028 abre');
select is((select valor_centavos::bigint from cobrancas where condominio_id = (select c_ipiranga from cc) and competencia = '2028-11-01'), 54900::bigint,
  'cobra o plano novo, não o valor avisado sobre o antigo');
select is((select situacao from renovacoes_cliente where id = (select (r -> 'renovacao' ->> 'id')::uuid from a3)), 'SUPERADO', 'e a renovação fica superada');
select ok((select superado and aplicado_em is not null from reajustes_plano where renovacao_id = (select (r -> 'renovacao' ->> 'id')::uuid from a3)),
  'o reajuste guardado diz que foi superado');
select ok(exists (select 1 from historico where acao = 'plano.reajuste_superado'), 'com o registro no histórico');

-- 9. Retenção: o texto do aviso e quem recebeu saem 5 anos depois.
select pg_temp.em('2033-10-02 10:00:00-03');
select ok(comercial_rotina_renovacoes() >= 1, 'a rotina diária roda');
select ok((select bool_and(aviso_texto is null and aviso_para is null and textos_apagados_em is not null and valor_novo is not null)
             from renovacoes_cliente where aviso_em is not null), 'LGPD: o texto e o nome saem; ficam o valor e as datas');
select ok((select dispensa_motivo is null and textos_apagados_em is not null from renovacoes_cliente where situacao = 'DISPENSADO'),
  'r8: o motivo de renovar sem reajuste também sai');

select * from finish();
rollback;

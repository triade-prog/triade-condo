-- Parceiros e comissão (0310, R17.6; CM-22; quadro 339): o cadastro do parceiro, a indicação com a
-- origem Parceiro e o nome dele, a regra da comissão só da Administração, a comissão que nasce
-- quando o prédio indicado vira cliente (com a regra e o plano do dia, o fundador que passa à cheia
-- e o prazo), o extrato do mês, o pagamento registrado fora do sistema, o prédio que deixou de ser
-- cliente, o apagar a pedido e a retenção do contato do parceiro (LGPD). Na revisão: o nome do
-- parceiro não entra nas conversas do indicado e sai das que o citam, com a observação do pagamento
-- (r4); o motivo de o prédio ter saído só para quem tem a comissão (r11).
begin;
select plan(59);

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
create function pg_temp.pv(p uuid) returns integer language sql as $$ select versao from parceiros_comercial where id = p $$;
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
-- Documentos, contrato e as duas assinaturas conferidas; o interessado vira cliente.
create function pg_temp.cliente(p_interessado uuid) returns jsonb language plpgsql as $$
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
  return comercial_virar_cliente((select adm from ids), p_interessado, pg_temp.iv(p_interessado), jsonb_build_object('responsavelImplantacaoId', (select imp from ids)));
end $$;

select pg_temp.em('2026-10-24 10:00:00-03');
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
values (1, 'Contrato padrão', 'Contrato entre a TRÍADE e o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajuste pelo «indice_reajuste».',
        'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
        '2026-10-20', 'EM_USO', app_now());

-- 1. Quem pode o quê.
select ok(exists (select 1 from funcao_acoes where funcao = 'ADMINISTRACAO' and acao = 'console.comercial.comissao')
          and not exists (select 1 from funcao_acoes where funcao = 'COMERCIAL' and acao = 'console.comercial.comissao'),
  'O.1: a comissão (regra e pagamento) é só da Administração');
select ok((select console_sessao(adm) -> 'acoes' ? 'console.comercial.comissao' and not (console_sessao(com) -> 'acoes' ? 'console.comercial.comissao')
             and console_sessao(adm) -> 'acoes' ? 'console.comercial.meta' and console_sessao(adm) -> 'acoes' ? 'console.comercial.cliente' from ids),
  'a sessão do Console leva a ação nova sem perder as anteriores');

-- 2. O cadastro do parceiro.
create temp table p as select (comercial_salvar_parceiro(com, null, null, '{"tipo": "SINDICO_PROFISSIONAL", "nome": "Marta Lins",
  "whatsapp": "5561999990601", "email": "marta@exemplo.com.br", "observacao": "Cuida de 6 prédios na Asa Norte"}') ->> 'id')::uuid as marta from ids;
select is((select tipo || ' · ' || nome || ' · ' || versao from parceiros_comercial where id = (select marta from p)), 'SINDICO_PROFISSIONAL · Marta Lins · 1',
  'o Comercial cadastra o parceiro');
select is(pg_temp.motivo(format('select comercial_salvar_parceiro(%L, null, null, %L)', (select com from ids),
  '{"tipo": "ADMINISTRADORA", "nome": "Outra", "whatsapp": "5561999990601"}')), 'DUPLICADO', 'o mesmo WhatsApp não vira dois parceiros');
select is(pg_temp.campos(format('select comercial_salvar_parceiro(%L, null, null, %L)', (select com from ids), '{"tipo": "AMIGO", "nome": "Rui"}')),
  '["tipo"]'::jsonb, 'o tipo vem da lista (síndico profissional, administradora, construtora ou cliente)');
select is(pg_temp.campos(format('select comercial_salvar_parceiro(%L, null, null, %L)', (select com from ids), '{"tipo": "CLIENTE", "nome": "Rui", "cnpj": "123"}')),
  '["whatsapp", "email", "cnpj", "observacao"]'::jsonb, 'contato inválido volta com os campos');
select throws_ok(format('select comercial_salvar_parceiro(%L, null, null, %L)', (select fin from ids), '{"tipo": "CLIENTE", "nome": "Rui"}'),
  'TC401', null, 'quem não é do Comercial não cadastra parceiro');
select is(pg_temp.codigo(format('select comercial_salvar_parceiro(%L, %L, 9, %L)', (select com from ids), (select marta from p),
  '{"tipo": "SINDICO_PROFISSIONAL", "nome": "Marta Lins"}')), 'TC409', 'mudar com a versão velha é conflito');

-- 3. A indicação: origem Parceiro com o nome dele, e o vínculo que não muda.
create temp table ind as select comercial_indicar(com, marta, '{"condominio": "Edifício Ipê", "pessoa": "Lúcia Prado", "papel": "SINDICO",
  "contatoAceito": true, "whatsapp": "5561999990611", "email": "lucia@exemplo.com.br"}') as r from ids, p;
create temp table i as select (r ->> 'id')::uuid as ipe from ind;
select is((select origem || ' · ' || origem_detalhe || ' · ' || (parceiro_id = (select marta from p))::text from interessados where id = (select ipe from i)),
  'PARCEIRO · Marta Lins · true', 'CM-22: o indicado entra com a origem Parceiro e o nome dele');
select is((select comercial_ficha(com, ipe) -> 'parceiro' ->> 'nome' from ids, i), 'Marta Lins', 'a ficha mostra o parceiro');
select ok((select count(*) > 0 and bool_and(resumo not like '%Marta%') from conversas_comercial where interessado_id = (select ipe from i)),
  'o nome do parceiro não vai para as conversas do indicado (r4)');
select ok((select (comercial_indicar(com, marta, '{"condominio": "Edifício Ipê", "contatoAceito": true, "whatsapp": "5561999990611"}') ->> 'juntado')::boolean
             from ids, p), 'o contato que já estava no Comercial é juntado');
select is((select count(*)::integer from interessados where parceiro_id = (select marta from p)), 1, 'e não vira outra indicação');
select is(pg_temp.motivo(format('update interessados set parceiro_id = null where id = %L', (select ipe from i))), 'ORIGEM_FIXA',
  'o parceiro do interessado não muda');
create temp table outro as select (comercial_criar(com, '{"condominio": "Edifício Jatobá", "origem": "INDICACAO", "contatoAceito": true,
  "whatsapp": "5561999990612"}') ->> 'id')::uuid as jatoba from ids;
select throws_ok(format('update interessados set parceiro_id = %L where id = %L', (select marta from p), (select jatoba from outro)), '23514', null,
  'só o interessado com a origem Parceiro tem parceiro');

-- 4. A regra da comissão (só a Administração).
select is((select comercial_parceiros(com) -> 'regra' ->> 'percentual' from ids), '10', 'a regra começa em 10% da mensalidade');
select throws_ok(format('select comercial_salvar_regra_comissao(%L, 1, 12, null)', (select com from ids)), 'TC401', null, 'o Comercial não muda a regra');
select is(pg_temp.campos(format('select comercial_salvar_regra_comissao(%L, 1, 0, null)', (select adm from ids))), '["percentual"]'::jsonb,
  'o percentual vai de 0,01% a 100%');
select is(pg_temp.campos(format('select comercial_salvar_regra_comissao(%L, 1, 10, 200)', (select adm from ids))), '["prazoMeses"]'::jsonb,
  'o prazo vai de 1 a 120 meses');
select is((select comercial_salvar_regra_comissao(adm, 1, 12.5, 24) ->> 'percentual' from ids), '12.5', 'a Administração muda a regra');
select is(pg_temp.codigo(format('select comercial_salvar_regra_comissao(%L, 1, 10, null)', (select adm from ids))), 'TC409', 'a regra tem versão');
select is((select count(*)::integer from historico where acao = 'comercial.regra_comissao'), 1, 'a mudança da regra vai para o histórico');

-- 5. A comissão nasce quando o prédio indicado vira cliente, com a regra e o plano do dia.
select is((select count(*)::integer from comissoes_parceiro), 0, 'antes de virar cliente, não há comissão');
create temp table vc as select pg_temp.cliente(ipe) as r from i;
select comercial_salvar_regra_comissao(adm, 2, 10, null) from ids;
create temp table c as select * from comissoes_parceiro where interessado_id = (select ipe from i);
select is((select format('%s · %s · %s · %s/%s · %s', trim_scale(percentual), prazo_meses, inicio, mensal_centavos, depois_centavos, fundador_meses) from c),
  '12.5 · 24 · 2026-11-01 · 22900/34900 · 12', 'a comissão guarda a regra do dia (12,5% por 24 meses) e o fundador com a cheia depois');
select is((select condominio_id from c), (select (r ->> 'condominioId')::uuid from vc), 'e o condomínio da carteira');
select is((select comercial_comissao_mes(x, '2026-10-01') from comissoes_parceiro x where x.id = (select id from c)), null, 'antes do início do plano, sem comissão');
select is((select comercial_comissao_mes(x, '2026-11-01') from comissoes_parceiro x where x.id = (select id from c)), 2863::bigint, '12,5% de R$ 229,00 no primeiro mês (fundador)');
select is((select comercial_comissao_mes(x, '2027-11-01') from comissoes_parceiro x where x.id = (select id from c)), 4363::bigint, 'depois de 12 meses, sobre a tabela cheia (R$ 349,00)');
select is((select comercial_comissao_situacao(x, '2028-11-01') || ' · ' || coalesce(comercial_comissao_mes(x, '2028-11-01')::text, '—') from comissoes_parceiro x where x.id = (select id from c)),
  'PRAZO_ACABOU · —', 'depois do prazo de 24 meses, acaba');
select is((select percentual from regra_comissao), 10.00, 'a regra mudou depois');
select is((select trim_scale(percentual) from comissoes_parceiro where id = (select id from c)), 12.5, 'mas a comissão que já nasceu não muda');
select is(pg_temp.motivo(format('update comissoes_parceiro set mensal_centavos = 1 where id = %L', (select id from c))), 'SO_INSERCAO',
  'o valor da comissão não muda');

-- 6. O extrato e o pagamento fora do sistema.
create temp table ex as select comercial_extrato_parceiro(com, marta, '2026-11-01') as r from ids, p;
select is((select r -> 'linhas' -> 0 ->> 'condominio' || ' · ' || (r -> 'linhas' -> 0 ->> 'comissao') || ' · ' || (r ->> 'total') from ex),
  'Edifício Ipê · 2863 · 2863', 'o extrato do mês: prédio, comissão e total');
select is((select r -> 'linhas' -> 0 ->> 'mensalidade' from ex), '22900', 'com a mensalidade do mês');
select throws_ok(format('select comercial_registrar_pagamento(%L, %L, ''2026-11-01'', 2863, ''2026-12-05'', null)', (select com from ids), (select marta from p)),
  'TC401', null, 'o Comercial não registra pagamento');
select is(pg_temp.campos(format('select comercial_registrar_pagamento(%L, %L, ''2026-11-01'', 2863, ''2026-10-24'', null)', (select adm from ids), (select marta from p))),
  '["mes"]'::jsonb, 'mês que ainda não começou não tem pagamento');
select pg_temp.em('2026-12-05 10:00:00-03');
select is((select comercial_registrar_pagamento(adm, marta, '2026-11-01', 2800, '2026-12-05', 'PIX 05/12') ->> 'diferenca' from ids, p), '63',
  'a Administração registra o que pagou e vê a diferença');
select is(pg_temp.motivo(format('select comercial_registrar_pagamento(%L, %L, ''2026-11-01'', 2863, ''2026-12-05'', null)', (select adm from ids), (select marta from p))),
  'PAGAMENTO_REGISTRADO', 'um pagamento por parceiro e mês');
select throws_ok(format('update pagamentos_comissao set valor_centavos = 2863 where parceiro_id = %L', (select marta from p)), null, null,
  'o pagamento registrado não muda');
select is((select r -> 'pago' ->> 'registradoPor' || ' · ' || (r ->> 'diferenca') from (select comercial_extrato_parceiro(com, marta, '2026-11-01') as r from ids, p) x),
  'Carolina · 63', 'o extrato guarda quem registrou e a diferença');
select is((select comercial_parceiros(adm, '2026-11-01') -> 'parceiros' -> 0 ->> 'comissaoMes' from ids), '2863', 'a lista mostra a comissão do mês');
select is((select (comercial_parceiros(adm, '2026-11-01') -> 'parceiros' -> 0 ->> 'prediosAtivos') || ' · ' ||
                  (comercial_parceiros(adm, '2026-11-01') -> 'parceiros' -> 0 -> 'pagoMes' ->> 'valor') from ids), '1 · 2800',
  'os prédios ativos e o que foi pago no mês');

-- 7. O prédio que deixou de ser cliente (marcado à mão até a R17.7).
select throws_ok(format('select comercial_encerrar_comissao(%L, %L, 1, ''2027-03-01'', ''Cancelou'')', (select com from ids), (select id from c)),
  'TC401', null, 'o Comercial não encerra a comissão');
select is((select comercial_encerrar_comissao(adm, id, 1, '2027-03-15', 'O condomínio cancelou o contrato') ->> 'versao' from ids, c), '2',
  'a Administração marca desde quando o prédio não é mais cliente');
select is((select comercial_comissao_situacao(x, '2027-03-01') || ' · ' || coalesce(comercial_comissao_mes(x, '2027-03-01')::text, '—') || ' · ' ||
                  comercial_comissao_mes(x, '2027-02-01') from comissoes_parceiro x where x.id = (select id from c)),
  'ENCERRADA · — · 2863', 'do mês marcado em diante, sem comissão (o extrato mostra "—")');
select is(pg_temp.motivo(format('select comercial_encerrar_comissao(%L, %L, 2, ''2027-04-01'', ''De novo'')', (select adm from ids), (select id from c))),
  'COMISSAO_ENCERRADA', 'encerra uma vez só');
select is((select array[(comercial_extrato_parceiro(com, marta, '2027-03-01') -> 'linhas' -> 0 ? 'motivo')::text,
                        comercial_extrato_parceiro(adm, marta, '2027-03-01') -> 'linhas' -> 0 ->> 'motivo'] from ids, p),
  array['false', 'O condomínio cancelou o contrato'], 'o motivo de o prédio ter saído só aparece para quem tem a comissão (r11)');

-- 8. Parceiro inativo não indica; sem indicação há 90 dias.
create temp table p2 as select (comercial_salvar_parceiro(com, null, null, '{"tipo": "ADMINISTRADORA", "nome": "Administradora Planalto",
  "email": "contato@planalto.com.br", "cnpj": "11222333000181"}') ->> 'id')::uuid as planalto from ids;
select comercial_salvar_parceiro(com, planalto, 1, '{"tipo": "ADMINISTRADORA", "nome": "Administradora Planalto", "email": "contato@planalto.com.br",
  "cnpj": "11222333000181", "ativo": false}') from ids, p2;
select is(pg_temp.motivo(format('select comercial_indicar(%L, %L, %L)', (select com from ids), (select planalto from p2),
  '{"condominio": "Edifício Pequi", "contatoAceito": true, "whatsapp": "5561999990613"}')), 'PARCEIRO_INATIVO', 'parceiro inativo não indica');
select pg_temp.em('2027-03-20 10:00:00-03');
select ok((select (x ->> 'semIndicacao90')::boolean from ids, p, jsonb_array_elements(comercial_parceiros(com) -> 'parceiros') x where x ->> 'id' = marta::text),
  'o parceiro ativo sem indicação há 90 dias aparece na aba');

-- 9. LGPD: apagar a pedido e a rotina.
select throws_ok(format('select comercial_apagar_parceiro(%L, %L)', (select com from ids), (select marta from p)), 'TC401', null,
  'só a Administração apaga o parceiro a pedido');
select comercial_inserir_conversa(ipe, 'NOTA', 'A Marta Lins ligou e pediu retorno sobre a indicação.', false, null, null) from i;
select comercial_apagar_parceiro(adm, marta) from ids, p;
select is((select nome || ' · ' || coalesce(whatsapp, '-') || coalesce(email, '-') || ' · ' || ativo from parceiros_comercial where id = (select marta from p)),
  'Parceiro apagado (LGPD) · -- · false', 'o contato some; o parceiro fica inativo');
select is((select origem_detalhe from interessados where id = (select ipe from i)), 'Parceiro (dado apagado)', 'o nome sai da origem do indicado');
select ok((select bool_and(resumo not like '%Marta%') from conversas_comercial where interessado_id = (select ipe from i))
          and exists (select 1 from conversas_comercial where interessado_id = (select ipe from i)
                       and resumo = 'A Parceiro (dado apagado) ligou e pediu retorno sobre a indicação.'),
  'e das conversas do indicado que o citam (r4)');
select is((select count(*)::integer from pagamentos_comissao where parceiro_id = (select marta from p) and observacao is not null)
          || '/' || (select count(*)::integer from pagamentos_comissao where parceiro_id = (select marta from p)), '0/1',
  'a observação do pagamento sai; o pagamento fica');
select is((select count(*)::integer from comissoes_parceiro where parceiro_id = (select marta from p)), 1, 'os valores da comissão ficam');
select is(pg_temp.motivo(format('select comercial_salvar_parceiro(%L, %L, %s, %L)', (select com from ids), (select marta from p), pg_temp.pv((select marta from p)),
  '{"tipo": "CLIENTE", "nome": "Marta"}')), 'ANONIMIZADO', 'parceiro apagado não muda');
select pg_temp.em('2028-04-01 10:00:00-03');
select ok((select comercial_retencao_parceiros_agenda() >= 1), 'a rotina diária roda');
select is((select nome from parceiros_comercial where id = (select planalto from p2)), 'Parceiro apagado (LGPD)',
  'sem comissão, o contato do parceiro inativo some 12 meses depois');
select is((select array_agg(codigo || ':' || sistema || ':' || situacao order by numero) from retencao_tipos where numero > 36),
  array['PARCEIRO:CONSOLE:A_FAZER', 'AGENDAMENTO:CONSOLE:A_FAZER'], 'o parceiro e o agendamento entram no catálogo de retenção');

select * from finish();
rollback;

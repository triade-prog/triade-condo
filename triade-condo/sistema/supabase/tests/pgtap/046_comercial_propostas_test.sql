-- Propostas do Comercial (0304, R17.3): a sugestão pela Tabela de preços sem gravar, o rascunho,
-- o desconto pedido pelo Comercial e respondido só pela Administração, o envio que trava sem
-- aprovação, a versão enviada que não muda, o link com só o resumo do código, a validade, a
-- revogação, as aberturas anônimas, o aceite com CPF validado que vira conversa e move o
-- interessado, a vencida que não aceita, as respostas prontas, as referências com autorização
-- revogável, o kit e as notas internas que nunca vão na proposta. O relógio começa em
-- 24/10/2026 10:00 de Brasília.
begin;
select plan(117);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Sueli', 'SUPORTE') as sup;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text) returns uuid language sql as $$
  select (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                    'contatoAceito', true, 'whatsapp', p_whatsapp)) ->> 'id')::uuid $$;
create function pg_temp.pv(p_versao uuid) returns integer language sql as $$ select versao from versoes_proposta where id = p_versao $$;
create function pg_temp.pp(p_proposta uuid) returns integer language sql as $$ select versao from propostas_comercial where id = p_proposta $$;
create function pg_temp.atual(p_proposta uuid) returns uuid language sql as $$
  select id from versoes_proposta where proposta_id = p_proposta order by numero desc limit 1 $$;
-- Resumo anônimo do aparelho, como a api-console manda.
create function pg_temp.aparelho(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

select pg_temp.em('2026-10-24 10:00:00-03');

-- O Residencial Cerrado: 72 unidades, concorrentes na ficha e notas que nunca vão para fora.
create temp table i as select pg_temp.interessado('Residencial Cerrado', '5561999990087') as cerrado,
                              pg_temp.interessado('Edifício Aroeira', '5561999990003') as aroeira,
                              pg_temp.interessado('Edifício Buriti', '5561999990004') as buriti,
                              pg_temp.interessado('Edifício Sem Unidades', '5561999990005') as vazio;
update interessados set unidades = 72, sistema_atual = 'Planilha e WhatsApp', administradora = 'Contábil Norte',
       observacao = 'NOTA-DA-FICHA: síndica quer trocar o zelador', visita_nota = 'NOTA-DA-VISITA: portão quebrado',
       concorrentes = '[{"nome": "HabitaOne", "preco": 11111}, {"nome": "Sistema X", "preco": 24900}]'
 where id = (select cerrado from i);
update interessados set unidades = 64, decisor = 'Leva ao conselho', decisao_em = '2026-11-20' where id = (select aroeira from i);
update interessados set unidades = 30 where id = (select buriti from i);
select comercial_registrar_conversa(com, (select cerrado from i), 'NOTA', 'NOTA-DA-CONVERSA: não falar do preço antigo') from ids;

-- Quem pode o quê (CM-11, F.1).
select is((select array_agg(funcao order by funcao) from funcao_acoes where acao = 'console.comercial.desconto'), array['ADMINISTRACAO'],
  'F.1: só a Administração aprova desconto');
select is((select console_sessao(com) -> 'acoes' from ids), '["console.comercial.editar", "console.comercial.ver"]'::jsonb,
  'a sessão do Comercial continua só com ver e editar');
select ok((select (console_sessao(adm) -> 'acoes') @> '["console.comercial.desconto", "console.retencao.ver", "console.precos.ver", "console.comercial.modelos"]'
             from ids), 'a sessão da Administração traz a aprovação de desconto sem perder as da 0295, 0296 e 0301');
select throws_ok($$ select comercial_propostas(impl) from ids $$, 'TC401', null, 'a Implantação não vê propostas');
select throws_ok($$ select console_tabela_precos(com) from ids $$, 'TC401', null, 'o Comercial continua sem a tela da Tabela de preços');

-- CPF (CM-07).
select ok(cpf_valido('52998224725') and not cpf_valido('52998224724') and not cpf_valido('11111111111') and not cpf_valido('5299822472'),
  'CPF com os dígitos verificadores');

-- Sugestão pela tabela (CM-06, H.1): não grava nada.
create temp table s as select comercial_sugestao_proposta((select com from ids), (select cerrado from i)) as r;
select is((select array[r -> 'faixa' ->> 'codigo', r ->> 'tabela', r ->> 'mensal', r ->> 'depoisFundador', r ->> 'implantacaoSemCusto'] from s),
  array['DE_41_A_100', 'FUNDADOR', '22900', '34900', 'true'], 'as 72 unidades da ficha dão a faixa de 41 a 100, fundador por R$ 229,00, depois R$ 349,00');
select is((select (r ->> 'porApartamento')::int from s), 318, 'CM-19: R$ 229,00 / 72 = R$ 3,18 por apartamento');
select is((select r -> 'oferta' -> 'planejado' from s), '["WhatsApp oficial", "Inteligência artificial"]'::jsonb, 'EM-07: o planejado vem pronto');
select is((select r ->> 'validoAtePrevisto' from s), '2026-11-08', 'validade de 15 dias, da configuração');
create temp table s2 as select comercial_sugestao_proposta((select com from ids), (select cerrado from i), null, 'ANUAL') as r;
select is((select array[r ->> 'tabela', r ->> 'mensal', r ->> 'anual', r ->> 'implantacaoSemCusto', r -> 'avisos' ->> 0] from s2),
  array['CHEIA', '34900', '383900', 'true', 'FUNDADOR_SO_MENSAL'], 'no anual vale a cheia, 11 × R$ 349,00, implantação isenta (regra da 0295)');
select is((select array[r ->> 'implantacao', r ->> 'implantacaoParcelas'] from (select comercial_sugestao_proposta(com, (select cerrado from i), null, 'MENSAL', 'CHEIA') r from ids) x),
  array['90000', '3'], 'a cheia no mensal traz a implantação de R$ 900,00 em até 3 vezes');
select is((select array[r ->> 'tabela', r -> 'avisos' ->> 0] from (select comercial_sugestao_proposta(com, (select cerrado from i), 450) r from ids) x),
  array['MANUAL', 'SOB_CONSULTA'], 'acima de 400 unidades é sob consulta');
select is((select (r ->> 'mensal')::int from (select comercial_sugestao_proposta(com, (select cerrado from i), null, null, null, null, null, 10) r from ids) x),
  20610, 'o desconto de 10% vale na mensalidade: R$ 206,10');
update parametros_preco set vagas_fundador = 0;
select is((select r -> 'avisos' from (select comercial_sugestao_proposta(com, (select cerrado from i)) r from ids) x), '["SEM_VAGA_FUNDADOR"]'::jsonb,
  'sem vaga livre de fundador, vale a cheia');
update parametros_preco set vagas_fundador = 5;
select is((select comercial_sugestao_proposta(com, (select vazio from i)) -> 'avisos' from ids), '["SEM_UNIDADES"]'::jsonb, 'sem unidades na ficha, avisa');
select is((select count(*)::int from propostas_comercial) + (select count(*)::int from vagas_fundador), 0, 'a sugestão não grava nada nem ocupa vaga');

-- Respostas prontas (CM-27): só a Administração muda; só a revisada entra.
select is((select count(*)::int from respostas_comercial where revisada_em is null), 6, 'os seis temas do quadro 344 nascem a revisar');
create temp table rp as select (select id from respostas_comercial where tema = 'LGPD') as lgpd, (select id from respostas_comercial where tema = 'SUPORTE') as suporte;
select throws_ok($$ select comercial_salvar_resposta(com, (select lgpd from rp), 1, 'LGPD', 'LGPD', 'Texto do Comercial para a LGPD', true, true) from ids $$,
  'TC401', null, 'o Comercial não muda as respostas prontas');
select is(pg_temp.campos($$ select comercial_criar_proposta(com, (select cerrado from i), jsonb_build_object('respostas', jsonb_build_array((select lgpd from rp)))) from ids $$),
  '["respostas"]'::jsonb, 'resposta a revisar não entra na proposta');
select comercial_salvar_resposta(adm, (select lgpd from rp), 1, 'LGPD', 'LGPD',
  'Cada condomínio só vê os próprios dados. A TRÍADE trata os dados como operadora, com registro de acesso.', true, true) from ids;
select ok((select revisada_em is not null and revisada_por = (select adm from ids) from respostas_comercial where id = (select lgpd from rp)),
  'a Administração revisa a resposta');

-- Referências (CM-28): só com autorização registrada.
select is(pg_temp.campos($$ select comercial_salvar_referencia(adm, null, null, '{"sindico": "Paulo Dias", "condominio": "Edifício Ipê", "escopo": "CONTATO",
  "autorizadoEm": "2026-10-20", "autorizacaoTexto": "Autorizou por WhatsApp em 20/10"}') from ids $$), '["whatsapp", "email"]'::jsonb,
  'referência com contato pede o WhatsApp ou o e-mail');
select is(pg_temp.campos($$ select comercial_salvar_referencia(adm, null, null, '{"sindico": "Paulo Dias", "condominio": "Edifício Ipê", "escopo": "SO_NOME",
  "autorizadoEm": "2026-10-20", "autorizacaoTexto": "Autorizou por WhatsApp em 20/10", "casoTexto": "Pedidos resolvidos em metade do tempo",
  "casoUsoDesde": "2026-09-01", "casoMedidoEm": "2026-10-20"}') from ids $$), '["casoMedidoEm"]'::jsonb, 'caso só com número medido depois de 3 meses de uso');
select throws_ok($$ insert into referencias_comercial (sindico, condominio, escopo, autorizado_em) values ('Sem', 'Autorização', 'SO_NOME', '2026-10-20') $$,
  '23502', null, 'referência não entra sem o registro da autorização');
create temp table rf as select
  (comercial_salvar_referencia((select adm from ids), null, null, '{"sindico": "Paulo Dias", "condominio": "Edifício Ipê", "unidades": 64, "escopo": "CONTATO",
    "whatsapp": "5561988887777", "autorizadoEm": "2026-10-20", "autorizacaoTexto": "Autorizou por WhatsApp em 20/10"}') ->> 'id')::uuid as paulo,
  (comercial_salvar_referencia((select adm from ids), null, null, '{"sindico": "Rita Melo", "condominio": "Residencial Pequi", "escopo": "SO_NOME",
    "autorizadoEm": "2026-10-21", "autorizacaoTexto": "Só o nome e o prédio, por e-mail de 21/10"}') ->> 'id')::uuid as rita;
select throws_ok($$ select comercial_salvar_referencia(com, null, null, '{}') from ids $$, 'TC401', null, 'o Comercial não muda as referências');

-- Nova proposta (quadro 325).
select is(pg_temp.campos($$ select comercial_criar_proposta(com, (select vazio from i), '{}') from ids $$), '["unidades"]'::jsonb,
  'proposta pede as unidades');
select is(pg_temp.campos($$ select comercial_criar_proposta(com, (select cerrado from i), '{"desconto": 10}') from ids $$), '["descontoMotivo"]'::jsonb,
  'desconto pede o motivo');
select is(pg_temp.campos($$ select comercial_criar_proposta(com, (select cerrado from i), '{"unidades": 450}') from ids $$), '["valorManual"]'::jsonb,
  'sob consulta pede o valor digitado');
select is(pg_temp.campos($$ select comercial_criar_proposta(com, (select cerrado from i), '{"unidades": 450, "valorManual": 150000}') from ids $$),
  '["valorManualMotivo"]'::jsonb, 'e o motivo do valor sob consulta');
select throws_ok($$ select comercial_criar_proposta(impl, (select cerrado from i), '{}') from ids $$, 'TC401', null, 'a Implantação não faz proposta');
create temp table p1 as select comercial_criar_proposta((select com from ids), (select cerrado from i), jsonb_build_object(
  'desconto', 10, 'descontoMotivo', 'MOTIVO-DO-DESCONTO: conselho compara com o atual', 'notaInterna', 'NOTA-DA-VERSAO: só fecha com desconto',
  'respostas', jsonb_build_array((select lgpd from rp)), 'referencias', jsonb_build_array((select paulo from rf), (select rita from rf)))) as r;
create temp table cer as select (r ->> 'id')::uuid as p, (r ->> 'versaoId')::uuid as v from p1;
select is((select array[situacao, desconto_situacao, mensal_tabela_centavos::text, mensal_centavos::text, por_apartamento_centavos::text]
             from versoes_proposta where id = (select v from cer)),
  array['RASCUNHO', 'SEM', '22900', '20610', '286'], 'nasce rascunho v1, desconto ainda não pedido, R$ 206,10 e R$ 2,86 por apartamento');
select ok((select premissas ->> 'estimativa' = 'true' and premissas ->> 'texto' like 'Estimativa: R$ 206,10 por mês divididos por 72 unidades%'
             from versoes_proposta where id = (select v from cer)), 'L.1: as premissas do custo por apartamento ficam na versão, como estimativa');
select is((select incluido from versoes_proposta where id = (select v from cer)), comercial_oferta_incluido(), 'EM-07: o incluído é o texto pronto');
select is(pg_temp.motivo($$ select comercial_criar_proposta(com, (select cerrado from i), '{}') from ids $$), 'PROPOSTA_EXISTE', 'uma proposta por interessado');
select is((select count(*)::int from vagas_fundador), 0, 'a proposta de fundador não ocupa vaga (só ao virar cliente)');

-- Desconto (F.1).
select is(pg_temp.motivo($$ select comercial_enviar_proposta(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) from ids $$),
  'DESCONTO_SEM_APROVACAO', 'com desconto, não envia sem a aprovação');
select is((select comercial_pedir_desconto(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) ->> 'situacao' from ids),
  'AGUARDA_DESCONTO', 'o Comercial pede a aprovação');
select is(pg_temp.motivo($$ select comercial_enviar_proposta(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) from ids $$),
  'DESCONTO_SEM_APROVACAO', 'aguardando a resposta, ainda não envia');
select throws_ok($$ select comercial_responder_desconto(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), true, null) from ids $$,
  'TC401', null, 'o Comercial não aprova o próprio desconto');
select is(pg_temp.campos($$ select comercial_responder_desconto(adm, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), false, '') from ids $$),
  '["resposta"]'::jsonb, 'recusar pede a resposta para quem pediu');
select is((select comercial_responder_desconto(adm, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), false,
                                                'RESPOSTA-DA-ADM: só no anual') ->> 'situacao' from ids), 'RASCUNHO', 'recusado, volta a rascunho');
select is((select desconto_situacao from versoes_proposta where id = (select v from cer)), 'RECUSADO', 'e o desconto fica recusado');
select comercial_pedir_desconto(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) from ids;
select is((select comercial_responder_desconto(adm, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), true,
                                                'RESPOSTA-DA-ADM: aprovado') ->> 'situacao' from ids), 'PRONTA', 'aprovado pela Administração, fica pronta');
select is((select count(*)::int from conversas_comercial where interessado_id = (select cerrado from i) and canal = 'NOTA' and resumo like 'Desconto de 10%'),
  2, 'cada resposta fica no histórico do interessado, como nota interna');
select is((select comercial_salvar_versao(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), jsonb_build_object(
    'desconto', 10, 'descontoMotivo', 'MOTIVO-DO-DESCONTO: conselho compara com o atual', 'notaInterna', 'NOTA-DA-VERSAO: só fecha com desconto',
    'respostas', jsonb_build_array((select lgpd from rp)), 'referencias', jsonb_build_array((select paulo from rf), (select rita from rf)), 'validadeDias', 15))
    ->> 'situacao' from ids), 'PRONTA', 'mudar o que não é preço nem desconto mantém a aprovação');
select is((select comercial_salvar_versao(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), jsonb_build_object(
    'desconto', 15, 'descontoMotivo', 'MOTIVO-DO-DESCONTO: conselho compara com o atual')) ->> 'situacao' from ids), 'RASCUNHO',
  'mudar o desconto pede aprovação de novo');
select comercial_salvar_versao(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), jsonb_build_object(
    'desconto', 10, 'descontoMotivo', 'MOTIVO-DO-DESCONTO: conselho compara com o atual', 'notaInterna', 'NOTA-DA-VERSAO: só fecha com desconto',
    'respostas', jsonb_build_array((select lgpd from rp)), 'referencias', jsonb_build_array((select paulo from rf), (select rita from rf)))) from ids;
select comercial_pedir_desconto(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) from ids;
select comercial_responder_desconto(adm, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), true, 'RESPOSTA-DA-ADM: aprovado') from ids;

-- Lista com abas (quadro 326).
select is((select comercial_propostas(com) -> 'contagens' ->> 'EM_ABERTO' from ids), '1', 'aprovada e não enviada fica em aberto');
select is(pg_temp.campos($$ select comercial_propostas(com, 'TODAS') from ids $$), '["aba"]'::jsonb, 'aba fora da lista é recusada');

-- Envio (E.1, CM-07).
select throws_ok($$ select comercial_enviar_proposta(com, (select p from cer), (select v from cer), 1) from ids $$, 'TC409', null, 'versão velha dá conflito');
create temp table env as select comercial_enviar_proposta((select com from ids), (select p from cer), (select v from cer), pg_temp.pv((select v from cer))) as r;
create temp table cod as select r -> 'link' ->> 'codigo' as cerrado from env;
select is((select array[r ->> 'situacao', r ->> 'validoAte'] from env), array['ENVIADA', '2026-11-08'], 'enviada, vale 15 dias');
select ok((select length(cerrado) >= 40 from cod), 'o código do link é longo e aleatório');
select is((select count(*)::int from links_proposta where versao_id = (select v from cer) and hash = hash_codigo((select cerrado from cod))), 1,
  'o banco guarda só o resumo do código');
select is((select count(*)::int from links_proposta where octet_length(hash) <> 32), 0, 'o código em si não fica guardado, só os 32 bytes do resumo');
select is((select hash from versoes_proposta where id = (select v from cer)), (select comercial_hash(proposta_conteudo(v)) from versoes_proposta v where id = (select v from cer)),
  'o hash é a impressão digital do conteúdo enviado');
select is((select (expira_em at time zone 'America/Sao_Paulo')::text from links_proposta where versao_id = (select v from cer)), '2026-11-09 00:00:00',
  'o link vale até o fim do dia da validade');
select is((select etapa from interessados where id = (select cerrado from i)), 'PROPOSTA_ENVIADA', 'o interessado vai para Proposta enviada');
select ok(exists (select 1 from conversas_comercial where interessado_id = (select cerrado from i) and canal = 'PROPOSTA' and resumo like 'Proposta v1 enviada%'),
  'o envio vira conversa');
select ok(exists (select 1 from historico where acao = 'comercial.proposta_enviada' and interno and entidade_id = (select p::text from cer)
                  and not dados ? 'codigo'), 'e fica no histórico interno, sem o código');

-- A versão enviada não muda (CM-07).
select is(pg_temp.motivo($$ update versoes_proposta set mensal_centavos = 100 where id = (select v from cer) $$), 'VERSAO_ENVIADA',
  'nem direto na tabela a versão enviada muda');
select is(pg_temp.motivo($$ select comercial_salvar_versao(com, (select p from cer), (select v from cer), pg_temp.pv((select v from cer)), '{}') from ids $$),
  'VERSAO_ENVIADA', 'salvar a enviada pede versão nova');
select throws_ok($$ delete from versoes_proposta where id = (select v from cer) $$, null, null, 'versão não se apaga');
select is(pg_temp.motivo($$ update versoes_proposta set situacao = 'RASCUNHO' where id = (select v from cer) $$), 'VERSAO_ENVIADA', 'nem volta a rascunho');

-- O link (quadro 328) e as aberturas anônimas.
select is(pg_temp.codigo($$ select publico_proposta('codigo-que-nao-existe-de-jeito-nenhum', null) $$), 'TC404', 'código errado não abre');
create temp table pub as select publico_proposta((select cerrado from cod), pg_temp.aparelho('A')) as r;
select is((select array[r ->> 'mensal', r ->> 'desconto', r ->> 'situacao', r ->> 'podeAceitar', r ->> 'aosCuidados', r ->> 'porApartamento'] from pub),
  array['20610', '10', 'ENVIADA', 'true', 'Lúcia Prado', '286'], 'o link mostra o valor com o desconto aprovado, aos cuidados de quem negocia');
select is((select r ->> 'hash' from pub), (select hash from versoes_proposta where id = (select v from cer)), 'e a impressão digital');
select is((select array_agg(x) from pub, unnest(array['NOTA-DA-VERSAO', 'MOTIVO-DO-DESCONTO', 'RESPOSTA-DA-ADM', 'NOTA-DA-FICHA', 'NOTA-DA-VISITA', 'NOTA-DA-CONVERSA']) x
            where strpos(r::text, x) > 0), null, 'CM-12: nenhuma nota interna vai no link');
select is((select jsonb_agg(x ->> 'sindico' order by x ->> 'sindico') from pub, jsonb_array_elements(r -> 'referencias') x), '["Paulo Dias", "Rita Melo"]'::jsonb,
  'as referências escolhidas vão junto');
select is((select array[x ->> 'whatsapp', (x ? 'whatsapp')::text] from pub, jsonb_array_elements(r -> 'referencias') x where x ->> 'sindico' = 'Rita Melo'),
  array[null, 'false'], 'referência só com o nome não leva contato');
select publico_proposta((select cerrado from cod), pg_temp.aparelho('A'));
select publico_proposta((select cerrado from cod), pg_temp.aparelho('B'));
select is((select comercial_proposta(com, (select p from cer)) -> 'versoes' -> 0 -> 'aberturas' from ids),
  (select jsonb_build_object('total', 3, 'aparelhos', 2, 'ultima', app_now())), 'a equipe vê quantas vezes e em quantos aparelhos abriram');
select is((select count(*)::int from aberturas_proposta a where a.aparelho !~ '^[0-9a-f]{64}$'), 0, 'a abertura guarda só o resumo do aparelho');
select is((select r -> 'versoes' -> 0 ->> 'notaInterna' from (select comercial_proposta(com, (select p from cer)) r from ids) x),
  'NOTA-DA-VERSAO: só fecha com desconto', 'a nota interna fica para a equipe');

-- Retirar a autorização (CM-28): some do link e o contato é apagado; o hash não muda.
select comercial_retirar_referencia(adm, (select paulo from rf), (select versao from referencias_comercial where id = (select paulo from rf)), 'Pediu para sair por WhatsApp') from ids;
select is((select jsonb_agg(x ->> 'sindico') from jsonb_array_elements(publico_proposta((select cerrado from cod), null) -> 'referencias') x), '["Rita Melo"]'::jsonb,
  'a referência retirada some do link');
select ok((select whatsapp is null and retirada_em is not null from referencias_comercial where id = (select paulo from rf)), 'e o contato dela é apagado');
select is((select comercial_hash(proposta_conteudo(v)) from versoes_proposta v where id = (select v from cer)), (select hash from versoes_proposta where id = (select v from cer)),
  'a impressão digital continua a mesma');
select is(pg_temp.motivo($$ select comercial_salvar_referencia(adm, (select paulo from rf), (select versao from referencias_comercial where id = (select paulo from rf)),
  '{"sindico": "Paulo Dias", "condominio": "Edifício Ipê", "escopo": "SO_NOME", "autorizacaoTexto": "Autorizou de novo por WhatsApp"}') from ids $$),
  'REFERENCIA_RETIRADA', 'retirada não volta: autoriza-se outra');

-- Kit para o conselho (CM-20): só fatos confirmados, nada interno.
create temp table kit as select comercial_kit((select com from ids), (select p from cer)) as r;
select is((select jsonb_agg(jsonb_build_array(x ->> 'nome', x ->> 'confirmado', jsonb_array_length(x -> 'planos'))) from kit, jsonb_array_elements(r -> 'comparativo' -> 'concorrentes') x),
  '[["HabitaOne", "true", 2], ["Sistema X", "false", 0]]'::jsonb, 'os concorrentes da ficha, com preço só quando conferido na Tabela de preços');
select is((select (x ->> 'preco')::int from kit, jsonb_array_elements(r -> 'comparativo' -> 'concorrentes' -> 0 -> 'planos') x where x ->> 'plano' = 'Essencial'), 35280,
  'o preço do concorrente para as 72 unidades (R$ 4,90 por unidade)');
select is((select array_agg(x) from kit, unnest(array['11111', '24900', 'NOTA-DA-VERSAO', 'MOTIVO-DO-DESCONTO', 'RESPOSTA-DA-ADM', 'NOTA-DA-FICHA', 'NOTA-DA-VISITA',
                                                        'NOTA-DA-CONVERSA']) x where strpos(r::text, x) > 0), null,
  'o kit não leva preço não conferido nem nota interna');
select is((select array[r -> 'predio' ->> 'sistemaAtual', r -> 'comparativo' -> 'triade' ->> 'porApartamento', r -> 'respostas' -> 0 ->> 'tema'] from kit),
  array['Planilha e WhatsApp', '286', 'LGPD'], 'o kit traz o prédio, o custo por apartamento e as respostas prontas da versão');
select is((select publico_kit_proposta((select cerrado from cod)) -> 'proposta' ->> 'hash'), (select hash from versoes_proposta where id = (select v from cer)),
  'o síndico baixa o mesmo kit pelo link');
select is(pg_temp.motivo($$ select comercial_kit(com, (select p from cer)) from ids $$), null, 'o kit sai da versão enviada');

-- Aceite pelo link (quadro 329).
select is(pg_temp.campos($$ select publico_aceitar_proposta((select cerrado from cod), '{"nome": "Lúcia Prado", "cpf": "529.982.247-24", "cargo": "Síndica", "concordo": true}',
  '200.1.2.3', null) $$), '["cpf"]'::jsonb, 'CPF inválido não aceita');
select is(pg_temp.campos($$ select publico_aceitar_proposta((select cerrado from cod), '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica"}',
  '200.1.2.3', null) $$), '["concordo"]'::jsonb, 'aceitar pede a confirmação de que leu');
select is(pg_temp.campos($$ select publico_aceitar_proposta((select cerrado from cod), '{"cpf": "52998224725", "cargo": "Síndica", "concordo": true}', '200.1.2.3', null) $$),
  '["nome"]'::jsonb, 'aceitar pede o nome');
select pg_temp.em('2026-10-30 14:32:00-03');
create temp table ac as select publico_aceitar_proposta((select cerrado from cod),
  '{"nome": "Lúcia Prado", "cpf": "529.982.247-25", "cargo": "Síndica", "concordo": true}', '200.1.2.3', pg_temp.aparelho('A')) as r;
select is((select array[r ->> 'situacao', r ->> 'numero', r ->> 'nome'] from ac), array['ACEITA', '1', 'Lúcia Prado'], 'aceita a v1');
select is((select array[a.nome, a.cpf, a.cargo, a.ip, (a.hash_versao = v.hash)::text, (a.aceito_em = app_now())::text]
             from aceites_proposta a join versoes_proposta v on v.id = a.versao_id where v.id = (select v from cer)),
  array['Lúcia Prado', '52998224725', 'Síndica', '200.1.2.3', 'true', 'true'], 'o aceite guarda nome, CPF, cargo, IP, data e o hash da versão');
select is((select situacao from versoes_proposta where id = (select v from cer)), 'ACEITA', 'a versão fica aceita');
select ok(exists (select 1 from conversas_comercial where interessado_id = (select cerrado from i) and canal = 'PROPOSTA' and respondeu
                  and resumo = 'Proposta v1 aceita pelo link por Lúcia Prado (Síndica).'), 'o aceite vira conversa, como resposta da pessoa');
select is((select etapa from interessados where id = (select cerrado from i)), 'NEGOCIACAO', 'sem quem decide na ficha, o interessado vai para Negociação');
select is(pg_temp.motivo($$ select publico_aceitar_proposta((select cerrado from cod), '{"nome": "Outra", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}',
  null, null) $$), 'PROPOSTA_JA_ACEITA', 'não aceita duas vezes');
select is((select publico_proposta((select cerrado from cod), null) -> 'aceite' ->> 'nome'), 'Lúcia Prado', 'o link mostra o aceite registrado');
select is(pg_temp.motivo($$ update aceites_proposta set cargo = 'Outro' $$), 'ACEITE_FIXO', 'o aceite não se altera');
select is(pg_temp.motivo($$ select comercial_nova_versao(com, (select p from cer), pg_temp.pp((select p from cer)), '{}') from ids $$), 'PROPOSTA_ACEITA',
  'proposta aceita não ganha versão nova');
select is((select comercial_proposta(com, (select p from cer)) -> 'versoes' -> 0 -> 'aceite' ->> 'cpfMascarado' from ids), '•••.982.247-••',
  'a equipe vê o CPF mascarado');

-- Sem desconto envia direto; versão nova substitui e o link velho para (CM-07).
create temp table aro as select (r ->> 'id')::uuid as p, (r ->> 'versaoId')::uuid as v1
  from (select comercial_criar_proposta(com, (select aroeira from i), '{"tabela": "CHEIA"}') r from ids) x;
select is((select comercial_enviar_proposta(com, (select p from aro), (select v1 from aro), pg_temp.pv((select v1 from aro))) ->> 'situacao' from ids), 'ENVIADA',
  'sem desconto, o rascunho vai direto');
create temp table cod2 as select (select r -> 'link' ->> 'codigo' from (select comercial_novo_link(com, (select p from aro), (select v1 from aro)) r from ids) x) as v1;
select is((select count(*)::int from links_proposta where versao_id = (select v1 from aro) and revogado_em is null), 1, 'link novo revoga o anterior');
create temp table nv as select comercial_nova_versao((select com from ids), (select p from aro), pg_temp.pp((select p from aro)), '{"tabela": "FUNDADOR"}') as r;
select is((select array[(select situacao from versoes_proposta where id = (select v1 from aro)), r ->> 'numero', r ->> 'situacao'] from nv),
  array['SUBSTITUIDA', '2', 'RASCUNHO'], 'a versão nova substitui a enviada');
select is(pg_temp.codigo($$ select publico_proposta((select v1 from cod2), null) $$), 'TC404', 'e o link da substituída para de abrir');
create temp table aro2 as select (r ->> 'versaoId')::uuid as v from nv;
create temp table cod3 as select (select r -> 'link' ->> 'codigo' from (select comercial_enviar_proposta(com, (select p from aro), (select v from aro2),
  pg_temp.pv((select v from aro2))) r from ids) x) as c;
select is(pg_temp.campos($$ select comercial_revogar_link(com, (select p from aro), (select v from aro2), '') from ids $$), '["motivo"]'::jsonb, 'revogar pede o motivo');
select lives_ok($$ select comercial_revogar_link(com, (select p from aro), (select v from aro2), 'Mandado para o número errado') from ids $$, 'revoga o link');
select is(pg_temp.codigo($$ select publico_proposta((select c from cod3), null) $$), 'TC404', 'link revogado não abre');
select is(pg_temp.motivo($$ select comercial_revogar_link(com, (select p from aro), (select v from aro2), 'De novo') from ids $$), 'SEM_LINK', 'nada para revogar de novo');

-- Vencida não aceita: refazer com a tabela do dia (OC-04).
create temp table cod4 as select (select r -> 'link' ->> 'codigo' from (select comercial_novo_link(com, (select p from aro), (select v from aro2)) r from ids) x) as c;
select pg_temp.em('2026-11-16 10:00:00-03');
select is(pg_temp.motivo($$ select publico_proposta((select c from cod4), null) $$), 'PROPOSTA_VENCIDA', 'depois da validade o link avisa que venceu');
select is(pg_temp.motivo($$ select publico_aceitar_proposta((select c from cod4), '{"nome": "Paulo", "cpf": "52998224725", "cargo": "Síndico", "concordo": true}', null, null) $$),
  'PROPOSTA_VENCIDA', 'vencida não aceita');
select is((select comercial_propostas(com) -> 'contagens' ->> 'VENCIDAS' from ids), '1', 'aparece em Vencidas antes de a rotina gravar');
select is(comercial_vencer_propostas(), 1, 'a rotina grava a vencida');
select console_salvar_faixa_preco(adm, 'DE_41_A_100', (select versao from faixas_preco where codigo = 'DE_41_A_100'), 24900, 36900, 90000, 'Reajuste da tabela') from ids;
create temp table nv3 as select comercial_nova_versao((select com from ids), (select p from aro), pg_temp.pp((select p from aro)), '{"tabela": "FUNDADOR"}') as r;
select is((select array[(select situacao from versoes_proposta where id = (select v from aro2)), (select mensal_centavos::text from versoes_proposta where id = (select v from aro2)),
                        r ->> 'numero', (select mensal_centavos::text from versoes_proposta where id = (r ->> 'versaoId')::uuid)] from nv3),
  array['VENCIDA', '22900', '3', '24900'], 'a vencida guarda o preço dela; a versão nova sai da tabela do dia');
create temp table cod5 as select (select r -> 'link' ->> 'codigo' from (select comercial_enviar_proposta(com, (select p from aro), (r2 ->> 'versaoId')::uuid,
  pg_temp.pv((r2 ->> 'versaoId')::uuid)) r from ids, (select r as r2 from nv3) y) x) as c;
select publico_aceitar_proposta((select c from cod5), '{"nome": "Paulo Dias", "cpf": "52998224725", "cargo": "Síndico", "concordo": true}', '200.1.2.4', null);
select is((select etapa from interessados where id = (select aroeira from i)), 'APROVACAO',
  'com quem decide e a data na ficha, o aceite leva a Aprovação no condomínio');

-- Recusada pelo síndico.
create temp table bur as select (r ->> 'id')::uuid as p, (r ->> 'versaoId')::uuid as v
  from (select comercial_criar_proposta(com, (select buriti from i), '{}') r from ids) x;
create temp table cod6 as select (select r -> 'link' ->> 'codigo' from (select comercial_enviar_proposta(com, (select p from bur), (select v from bur), pg_temp.pv((select v from bur))) r
  from ids) x) as c;
select is((select comercial_recusar_proposta(com, (select p from bur), (select v from bur), pg_temp.pv((select v from bur)), 'Ficou com o sistema atual') ->> 'situacao' from ids),
  'RECUSADA', 'a equipe registra a recusa');
select is(pg_temp.codigo($$ select publico_proposta((select c from cod6), null) $$), 'TC404', 'e o link para');
select is((select comercial_propostas(com) -> 'contagens' from ids), '{"ACEITAS": 2, "VENCIDAS": 0, "EM_ABERTO": 0, "RECUSADAS": 1, "AGUARDANDO_APROVACAO": 0}'::jsonb,
  'as abas contam as propostas pela versão em vigor');
select is((select jsonb_array_length(comercial_propostas(com, null, (select buriti from i)) -> 'propostas') from ids), 1, 'a ficha do interessado acha a proposta dele');

-- LGPD (CM-12): apagar a pedido também apaga o nome, o CPF e o IP do aceite e a nota interna.
select comercial_excluir(adm, (select cerrado from i)) from ids;
select is((select array[coalesce(nome, '-'), coalesce(cpf, '-'), coalesce(ip, '-'), cargo] from aceites_proposta where versao_id = (select v from cer)),
  array['-', '-', '-', 'Síndica'], 'o aceite fica sem nome, CPF e IP');
select is((select nota_interna from versoes_proposta where id = (select v from cer)), null, 'a nota interna da versão é apagada');
select is((select hash from versoes_proposta where id = (select v from cer)) is not null and
          (select count(*) from links_proposta where versao_id = (select v from cer) and revogado_em is null) = 0, true,
  'a versão aceita continua com o hash e o link para de abrir');

-- RLS: nem direto na tabela o Suporte enxerga uma proposta.
set local role dominio;
select tentar_definir_pessoa((select sup from ids));
create temp table rls_sup as select (select count(*)::int from propostas_comercial) + (select count(*)::int from versoes_proposta)
                                  + (select count(*)::int from aceites_proposta) + (select count(*)::int from respostas_comercial) as n;
reset role;
select limpar_contexto();
select is((select n from rls_sup), 0, 'o Suporte não vê propostas, aceites nem respostas');
select ok((select count(*) from tabelas_sem_condominio where tabela in ('propostas_comercial', 'versoes_proposta', 'links_proposta', 'aberturas_proposta',
                                                                         'aceites_proposta', 'respostas_comercial', 'referencias_comercial')) = 7,
  'as tabelas novas dizem por que não têm condomínio');

select * from finish();
rollback;

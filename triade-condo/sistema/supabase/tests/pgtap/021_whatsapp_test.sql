-- WhatsApp do condomínio (passo 5; W-01, W-05, W-08 a W-16, W-21, AT-28, F6.3): conexão com
-- credenciais que não voltam e termo do piloto; recebimento pelo segredo do endereço, sem
-- duplicar e sem cair em outro condomínio; morador reconhecido só com vínculo confirmado;
-- pedido só com a escolha dele; consulta, revisão, parar de receber e fora do horário; fila
-- com estados, novas tentativas só em falha passageira e falha com responsável.
begin;
select plan(111);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO'), console_atribuir(adm, ipe, sup, 'SUPORTE'),
       console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]'),
       console_editar_ficha(impl, jatoba, (select versao from condominios where id = jatoba), 'Edifício Jatobá', 'Rio Branco', 'AC', null,
                            '+5568999990000', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Conselho', array['ACOMPANHAR']) as v_lia
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_ana from c, vs;
-- Atendimento o dia todo, todos os dias: as respostas não dependem da hora em que o teste roda.
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "201"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '201') as u201;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui
  from ids, c, u;
create temp table ct as select
  (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta,
  (select contato_id from contatos_unidade where id = (rui ->> 'vinculoId')::uuid) as c_rui
  from vin;
select plataforma_incluir_pessoa_unidade(ana, ipe, u201, c_rui, null, null, '{"proprietario": true, "principal": true, "mora": false}', true)
  from ids, c, u, ct;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.vcx(p uuid) returns integer language sql as $$ select versao from conexoes_whatsapp where condominio_id = p $$;
-- Credenciais já cifradas (a API cifra; aqui só bytes).
create function pg_temp.cred() returns bytea language sql as $$ select decode(repeat('ab', 40), 'hex') $$;
create temp table seq (n integer);
insert into seq values (0);
-- Mensagem recebida no Ipê (ou no gancho dado), com id novo a cada chamada.
create function pg_temp.msg(p_tel text, p_texto text, p_segredo text default null, p_inst text default 'ipe-inst', p_extra jsonb default '{}')
returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber(coalesce(p_segredo, (select segredo from g)), p_inst,
    jsonb_build_object('id', 'M' || v_n, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', p_texto, 'enviadaEm', app_now()) || p_extra);
end $$;
-- Respostas para um telefone que ainda não foram vistas (o relógio não anda dentro do teste:
-- a ordem vem desta lista). Mais de uma sai junto, separada por " | ".
create temp table vistos (id uuid primary key);
create temp table ult (tel text primary key, texto text);
create function pg_temp.ultima(p_tel text) returns text language plpgsql as $$
declare v text;
begin
  select string_agg(texto, ' | ') into v from envios_whatsapp e where para = p_tel and not exists (select 1 from vistos where id = e.id);
  insert into vistos select id from envios_whatsapp e where para = p_tel on conflict do nothing;
  if v is not null then insert into ult values (p_tel, v) on conflict (tel) do update set texto = excluded.texto; end if;
  return (select texto from ult where tel = p_tel);
end $$;
create function pg_temp.respostas(p_tel text) returns bigint language sql as $$
  select count(*) from envios_whatsapp where para = p_tel $$;

-- Conexão no Console (W-01).
select throws_ok($$ select console_whatsapp_credenciais(sup, ipe, null, 'ipe-inst', pg_temp.cred()) from ids, c $$, 'TC401', null,
  'W-01: suporte não guarda credenciais');
select is(pg_temp.campos($$ select console_whatsapp_credenciais(impl, ipe, null, 'ipe inst!', pg_temp.cred()) from ids, c $$),
  '["instancia"]', 'W-01: instância inválida é recusada');
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', pg_temp.cred()) ->> 'segredo' as segredo from ids, c;
create temp table gj as select console_whatsapp_credenciais(impl, jatoba, null, 'jat-inst', pg_temp.cred()) ->> 'segredo' as segredo from ids, c;
select ok((select length(segredo) between 32 and 64 from g), 'W-15: o endereço do aviso ganha um segredo próprio');
select is((select count(*) from ganchos_whatsapp, c where condominio_id = ipe and revogado_em is null and hash = hash_codigo((select segredo from g))),
  1::bigint, 'W-15: do segredo só o hash fica guardado');
select is((select situacao from conexoes_whatsapp, c where condominio_id = ipe), 'DESCONECTADO', 'W-01: com credenciais, falta conectar');
select ok(not (select console_whatsapp(sup, ipe)::text ~ 'abab' or console_whatsapp(sup, ipe) -> 'conexao' ? 'credenciais' from ids, c),
  'PT-08: as credenciais nunca voltam para a tela');
select is(pg_temp.motivo($$ select console_whatsapp_acesso(impl, ipe, 'CONECTAR') from ids, c $$), 'TERMO_PENDENTE',
  'DC14: conectar pede o termo do piloto aceito pelo síndico');
select throws_ok($$ select plataforma_aceitar_termo_whatsapp(gil, ipe) from ids, c $$, 'TC401', null, 'DC14: só o síndico aceita o termo');
select is((select plataforma_aceitar_termo_whatsapp(ana, ipe) ->> 'termoAceitoPor' from ids, c), 'Síndica Ana', 'DC14: a síndica aceita o termo');
select plataforma_aceitar_termo_whatsapp(davi, jatoba) from ids, c;
select is((select console_whatsapp_acesso(impl, ipe, 'CONECTAR') ->> 'instancia' from ids, c), 'ipe-inst',
  'W-01: a API recebe a instância para conectar');
select throws_ok($$ select console_whatsapp_acesso(sup, ipe, 'CONECTAR') from ids, c $$, 'TC401', null, 'W-01: suporte não conecta');
select ok((select (console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561911112222', null) ->> 'aparelhoDiferente')::boolean from ids, c),
  'W-01: aparelho que não é o número da ficha não conecta');
select is((select situacao from conexoes_whatsapp, c where condominio_id = ipe), 'DESCONECTADO', 'W-01: e a conexão fica desconectada');
select is((select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) ->> 'situacao' from ids, c), 'CONECTADO',
  'W-01: o número da ficha conecta, com ou sem o 9 da frente');
select console_whatsapp_situacao(impl, jatoba, 'CONECTADO', '5568999990000', null) from ids, c;
select is((select interno from historico, c where acao = 'whatsapp.conectado' and condominio_id = ipe limit 1), true,
  'PI-06: a conexão entra no histórico interno');

-- Recebimento (W-15, PT-01).
select is(pg_temp.codigo($$ select pg_temp.msg('+5561999990001', 'Oi', 'segredo-que-nao-existe-de-jeito-nenhum-123') $$), 'TC403',
  'W-15: aviso com segredo desconhecido é recusado');
select is(pg_temp.codigo($$ select pg_temp.msg('+5561999990001', 'Oi', null, 'outra-inst') $$), 'TC403',
  'W-15: aviso de outra instância é recusado');

-- Número sem cadastro (MU-02).
select is((pg_temp.msg('+5561988771234', 'Oi, sou nova no 504') ->> 'repetida'), 'false', 'W-05: a mensagem entra');
select is((select triagem from mensagens_whatsapp where telefone = '+5561988771234'), 'A_IDENTIFICAR', 'MU-02: número sem cadastro vai para A identificar');
select ok(pg_temp.ultima('+5561988771234') ~ 'ainda não está no cadastro' and pg_temp.ultima('+5561988771234') ~ 'nunca pedem senha',
  'MU-02 e W-21: resposta neutra, com o aviso contra golpes');
select is((select count(*) from avisos_whatsapp, ids where pessoa_id = ana and tipo = 'A_IDENTIFICAR'), 1::bigint,
  'MU-02: quem cuida dos pedidos é avisado no sino');
select pg_temp.msg('+5561988771234', 'Alguém aí?');
select is(pg_temp.respostas('+5561988771234'), 1::bigint, 'MU-02: a resposta neutra não se repete no mesmo dia');
select is((select count(*) from avisos_whatsapp, ids where pessoa_id = ana and tipo = 'A_IDENTIFICAR'), 1::bigint,
  'MU-02: nem o aviso no sino');

-- Mensagem repetida (W-15, T7).
select is((whatsapp_receber((select segredo from g), 'ipe-inst',
  jsonb_build_object('id', 'M1', 'telefone', '+5561988771234', 'tipo', 'TEXTO', 'texto', 'Oi, sou nova no 504')) ->> 'repetida'), 'true',
  'W-15: a mesma mensagem do provedor não entra duas vezes');
select is((select count(*) from mensagens_whatsapp where telefone = '+5561988771234'), 2::bigint, 'W-15: nada duplicado');

-- Morador reconhecido abre pedido (W-05, W-08).
select pg_temp.msg('5561999990001', E'A luz da garagem está piscando\nno subsolo 1, faz dois dias');
select ok(pg_temp.ultima('+5561999990001') ~ '^Olá, Marta\. Sou a Nina, assistente virtual do ' and pg_temp.ultima('+5561999990001') ~ '1 · Registrar um pedido novo',
  'W-08: o morador reconhecido recebe as opções');
select is((select count(*) from pedidos where canal = 'WHATSAPP'), 0::bigint, 'W-05: nada vira pedido sem a escolha do morador');
select is((select etapa from conversas_whatsapp where telefone = '+5561999990001'), 'MENU', 'a conversa espera a escolha');
select pg_temp.msg('+5561999990001', '1');
create temp table pm as select * from pedidos where canal = 'WHATSAPP' and contato_id = (select c_marta from ct);
select is((select count(*) from pm), 1::bigint, 'W-05: com 1, o pedido é registrado');
select is((select unidade_id from pm), (select u101 from u), 'W-05: na unidade do morador');
select is((select assunto from pm), 'A luz da garagem está piscando', 'W-05: o assunto é a primeira linha do que ele escreveu');
select is((select descricao from pm), E'A luz da garagem está piscando\nno subsolo 1, faz dois dias', 'W-05: o que ele escreveu vira a descrição');
select ok((select criado_por is null from pm), 'W-05: o pedido aberto pelo morador não tem pessoa da gestão como autora');
select is((select autor_tipo::text from historico where acao = 'pedido.registrado' and entidade_id = (select id::text from pm)), 'SISTEMA',
  'W-05: o registro fica no histórico, pelo sistema');
select ok(pg_temp.ultima('+5561999990001') ~ ('Registrei o pedido ' || (select protocolo from pm) || ' \(Torre A · 101\)')
          and pg_temp.ultima('+5561999990001') ~ 'ligue 193' and pg_temp.ultima('+5561999990001') ~ 'nunca pedem senha',
  'W-08: a confirmação traz o protocolo, o 193 e o aviso contra golpes');
select ok(pg_temp.ultima('+5561999990001') !~* '(imediat|já estamos|equipe TRÍADE)', 'W-08: sem prometer atendimento imediato');
select is((select count(*) from avisos_whatsapp, ids, pm where pessoa_id = ana and tipo = 'PEDIDO_NOVO' and pedido_id = pm.id), 1::bigint,
  'W-11: quem cuida dos pedidos é avisado do pedido novo');

-- Mídia nos minutos seguintes (W-05).
create temp table mi as select pg_temp.msg('+5561999990001', null, null, 'ipe-inst',
  '{"tipo": "IMAGEM", "midia": {"url": "https://provedor.invalid/f.jpg", "tipo": "image/jpeg"}}') as r;
select is((select r -> 'midias' -> 0 ->> 'caminho' from mi), 'whatsapp/' || (select ipe from c) || '/' || (select r ->> 'mensagem' from mi),
  'W-05: a mídia volta para a API baixar e conferir');
select is((select pedido_id from mensagens_whatsapp where id = (select (r ->> 'mensagem')::uuid from mi)), (select id from pm),
  'W-05: o que chega nos minutos seguintes entra no mesmo pedido');
select whatsapp_midia_resultado(ipe, (r ->> 'mensagem')::uuid, 2048, null) from c, mi;
select ok((select pelo_whatsapp and enviado_por is null and situacao = 'LIBERADO' from arquivos_pedido where pedido_id = (select id from pm)),
  'W-05: a foto conferida vira arquivo do pedido');
select is(pg_temp.ultima('+5561999990001'), 'Anexei a foto ao pedido ' || (select protocolo from pm) || '.', 'W-05: o morador fica sabendo');
create temp table mi2 as select pg_temp.msg('+5561999990001', null, null, 'ipe-inst',
  '{"tipo": "DOCUMENTO", "midia": {"url": "https://provedor.invalid/x.pdf", "tipo": "application/pdf"}}') as r;
select whatsapp_midia_resultado(ipe, (r ->> 'mensagem')::uuid, null, 'O PDF tem conteúdo ativo.') from c, mi2;
select is(pg_temp.ultima('+5561999990001'), 'Não consegui usar o arquivo: O PDF tem conteúdo ativo.', 'W-05: arquivo recusado diz o motivo');

-- T8: a mensagem que chega no número do Jatobá nunca cai no Ipê (PT-01).
select pg_temp.msg('+5561999990001', 'Oi', (select segredo from gj), 'jat-inst');
select is((select triagem from mensagens_whatsapp, c where condominio_id = jatoba), 'A_IDENTIFICAR',
  'PT-01: no Jatobá, a Marta do Ipê é um número sem cadastro');
select is((select count(*) from mensagens_whatsapp, c where condominio_id = ipe and telefone = '+5561999990001' and texto = 'Oi'), 0::bigint,
  'PT-01: e nada cai no Ipê');

-- Consulta (W-09, AT-28).
select pg_temp.msg('+5561999990001', '2');
select ok(pg_temp.ultima('+5561999990001') ~ ('Seus pedidos:.*' || (select protocolo from pm) || ' · A luz da garagem está piscando\nRecebido'),
  'W-09: o morador vê os pedidos dele com a situação combinada');
select pg_temp.msg('+5561999990001', split_part((select protocolo from pm), '-', 2));
select ok(pg_temp.ultima('+5561999990001') ~ ('^' || (select protocolo from pm) || ' · ') , 'W-09: pelo número, vê o pedido');

-- Duas unidades: pergunta qual (W-05).
select pg_temp.msg('+5561977771212', 'O portão da garagem não abre');
select pg_temp.msg('+5561977771212', '1');
select ok(pg_temp.ultima('+5561977771212') ~ E'O pedido é de qual unidade\\?\n1 · Torre A · 102\n2 · Torre A · 201', 'W-05: com duas unidades, pergunta qual');
select pg_temp.msg('+5561977771212', '2');
select is((select unidade_id from pedidos where canal = 'WHATSAPP' and contato_id = (select c_rui from ct)), (select u201 from u),
  'W-05: o pedido fica na unidade escolhida');
select pg_temp.msg('+5561977771212', '2');
select ok(pg_temp.ultima('+5561977771212') !~ (select protocolo from pm), 'W-09: o morador não vê o pedido de outra pessoa');

-- Contato com vínculo pendente (MU-02, T9).
select definir_transicao('IMPORTADO', null, true);
insert into contatos (condominio_id, nome, telefone) select ipe, 'Teo Alves', '+5561966665555' from c;
insert into contatos_unidade (condominio_id, contato_id, unidade_id, proprietario, estado, origem)
select ipe, (select id from contatos where nome = 'Teo Alves'), u101, true, 'PENDENTE', 'PLANILHA' from c, u;
select pg_temp.msg('+5561966665555', '2');
select is((select triagem from mensagens_whatsapp where telefone = '+5561966665555'), 'A_IDENTIFICAR', 'MU-02: vínculo pendente não é reconhecido');
select ok(pg_temp.ultima('+5561966665555') !~ 'Seus pedidos', 'T9: contato não confirmado não consulta pedido nenhum');
select ok((select (x ->> 'vinculoPendente')::boolean from ids, c, jsonb_array_elements(plataforma_whatsapp(ana, ipe) -> 'aIdentificar') x
            where x ->> 'telefone' = '+5561966665555'), 'MU-02: a tela mostra que o vínculo está pendente');

-- Parar de receber (W-16) e recado.
select pg_temp.msg('+5561999990001', 'parar');
select ok((select whatsapp_parou_em is not null from contatos, ct where id = c_marta), 'W-16: PARAR fica no contato');
select ok(pg_temp.ultima('+5561999990001') ~ 'não recebe mais avisos', 'W-16: o morador fica sabendo como voltar');
select pg_temp.msg('+5561999990001', 'VOLTAR');
select ok((select whatsapp_parou_em is null from contatos, ct where id = c_marta), 'W-16: VOLTAR religa');
select pg_temp.msg('+5561999990001', 'Obrigada pela ajuda!');
select pg_temp.msg('+5561999990001', '3');
select is((select triagem from mensagens_whatsapp where texto = 'Obrigada pela ajuda!'), 'RECADO', 'o recado vai para quem cuida ler');

-- Fora do horário (W-12): uma vez por período, sem prazo.
update horarios set intervalos = jsonb_build_array(jsonb_build_object('dia', (extract(dow from app_now() at time zone 'America/Sao_Paulo')::int + 1) % 7,
                                                                      'inicio', '08:00', 'fim', '18:00'))
 where tipo = 'ATENDIMENTO';
select pg_temp.msg('+5561977771212', 'A lixeira do térreo está transbordando');
select ok(position((select whatsapp_fora_horario from configuracao_condominio, c where condominio_id = ipe) in pg_temp.ultima('+5561977771212')) > 0,
  'W-12: fora do horário vai a mensagem do condomínio');
select ok(pg_temp.ultima('+5561977771212') !~* 'imediat', 'W-12: sem prometer prazo');
select pg_temp.msg('+5561977771212', '3');
select pg_temp.msg('+5561977771212', 'Outra coisa');
select is((select count(*) from envios_whatsapp, configuracao_condominio cfg where para = '+5561977771212' and texto like cfg.whatsapp_fora_horario || '%'
                                                                               and cfg.condominio_id = envios_whatsapp.condominio_id), 1::bigint,
  'W-12: uma vez por período');
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo = 'ATENDIMENTO';

-- Revisão (W-10, AT-15).
select pg_temp.msg('+5561999990001', 'REVISAR continua piscando');
select ok(pg_temp.ultima('+5561999990001') ~ 'Não há pedido seu concluído', 'W-10: só pedido concluído tem revisão');
select plataforma_concluir_pedido(ana, ipe, id, versao, (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO'),
                                  'Trocamos a lâmpada da vaga 31.', null) from ids, c, pedidos where id = (select id from pm);
select pg_temp.msg('+5561999990001', split_part((select protocolo from pm), '-', 2));
select ok(pg_temp.ultima('+5561999990001') ~ 'O que foi feito: Trocamos a lâmpada da vaga 31\..*REVISAR', 'AT-28: o concluído diz o que foi feito');
select pg_temp.msg('+5561999990001', 'REVISAR continua piscando no fim da tarde');
select is((select texto from revisoes_whatsapp where pedido_id = (select id from pm)), 'continua piscando no fim da tarde',
  'W-10: o pedido de revisão guarda o motivo');
select is((select estado from pedidos where id = (select id from pm)), 'ENCERRADO', 'AT-15: o pedido não reabre sozinho');
select is((select count(*) from avisos_whatsapp, ids where pessoa_id = ana and tipo = 'REVISAO'), 1::bigint, 'W-10: quem cuida é avisado');
select pg_temp.msg('+5561999990001', 'REVISAR de novo');
select ok(pg_temp.ultima('+5561999990001') ~ 'já está com um pedido de revisão', 'W-10: um pedido de revisão por vez');
select is(pg_temp.campos($$ select plataforma_manter_revisao_whatsapp(ana, ipe, id, '') from ids, c, revisoes_whatsapp $$),
  '["resposta"]', 'AT-15: manter concluído pede a resposta ao morador');
select plataforma_manter_revisao_whatsapp(ana, ipe, id, 'Trocamos o reator também; se voltar, avise.') from ids, c, revisoes_whatsapp;
select ok(pg_temp.ultima('+5561999990001') ~ E'^Sobre o pedido [0-9-]+:\nTrocamos o reator também; se voltar, avise\\.\n\n.+, do condomínio$',
  'AT-15: a resposta vai ao morador, com o pedido e quem respondeu');
select pg_temp.msg('+5561999990001', 'REVISAR voltou a piscar');
select plataforma_reabrir_pedido(ana, ipe, id, versao, 'Voltou a piscar.', v_ana) from ids, c, vs, pedidos where id = (select id from pm);
select is((select decisao from revisoes_whatsapp where decidida_por is not null and texto = 'voltou a piscar'), 'REABERTO',
  'AT-15: reabrir pelo caminho de sempre resolve a revisão');

-- Responder pelo pedido (AT-06, W-13).
select is(pg_temp.campos($$ select plataforma_responder_whatsapp(gil, ipe, id, versao, 'ok') from ids, c, pedidos where id = (select id from pm) $$),
  '["texto"]', 'AT-06: a resposta tem texto');
create temp table rr as select plataforma_responder_whatsapp(gil, ipe, id, versao, 'Marta, o eletricista vem segunda de manhã.') as r
  from ids, c, pedidos where id = (select id from pm);
select is((select meio from andamentos_pedido where pedido_id = (select id from pm) order by criado_em desc limit 1), 'WHATSAPP',
  'AT-06: responder pelo WhatsApp é retorno, com o meio');
select is((select estado || '/' || finalidade from envios_whatsapp where id = (select (r ->> 'envio')::uuid from rr)), 'NA_FILA/RETORNO',
  'PT-04: a mensagem vai para a fila junto com o retorno');
select throws_ok($$ select plataforma_responder_whatsapp(lia, ipe, id, versao, 'Oi, Marta.') from ids, c, pedidos where id = (select id from pm) $$,
  'TC401', null, 'quem só acompanha não responde');

-- A fila (W-13, W-14).
update envios_whatsapp set estado = 'CANCELADA', motivo = 'teste' where estado = 'NA_FILA' and id <> (select (r ->> 'envio')::uuid from rr)
   and condominio_id = (select ipe from c);
create temp table lote as select whatsapp_pegar_lote(20) as l;
select is((select jsonb_array_length(l -> 0 -> 'envios') from lote), 1, 'W-14: a API pega o lote do condomínio conectado');
select is((select l -> 0 ->> 'credenciais' from lote), encode(pg_temp.cred(), 'base64'), 'W-01: com as credenciais cifradas, só para a API');
select is((select estado from envios_whatsapp where id = (select (r ->> 'envio')::uuid from rr)), 'ENVIANDO', 'W-13: enviando');
select whatsapp_resultado(ipe, (r ->> 'envio')::uuid, 'ABC1', null, null) from c, rr;
select is((select estado from envios_whatsapp where id = (select (r ->> 'envio')::uuid from rr)), 'ENVIADA', 'W-13: o provedor aceitou');
select whatsapp_evento((select segredo from g), 'ipe-inst', 'ENTREGUE', 'ABC1', null);
select is((select estado from envios_whatsapp where id = (select (r ->> 'envio')::uuid from rr)), 'ENTREGUE', 'W-13: entregue');
select whatsapp_evento((select segredo from g), 'ipe-inst', 'LIDA', 'ABC1', null);
select is((select estado from envios_whatsapp where id = (select (r ->> 'envio')::uuid from rr)), 'LIDA', 'W-13: lida');

create temp table e3 as select
  (select id from envios_whatsapp limit 0) as x;
create function pg_temp.novo_envio() returns uuid language plpgsql as $$
declare v uuid;
begin
  perform entrar_como_sistema((select ipe from c));
  v := responder_whatsapp('+5561999990001', (select c_marta from ct), (select id from pm), 'Teste de fila');
  perform entrar_como_sistema(null);
  perform whatsapp_pegar_lote(20);
  return v;
end $$;
create temp table ef as select pg_temp.novo_envio() as passageira, pg_temp.novo_envio() as permanente, pg_temp.novo_envio() as tempo;
select whatsapp_resultado(ipe, passageira, null, 'Sem conexão', 'PASSAGEIRA'), whatsapp_resultado(ipe, permanente, null, 'Número sem WhatsApp', 'PERMANENTE'),
       whatsapp_resultado(ipe, tempo, null, null, 'TEMPO') from c, ef;
select is((select estado || '/' || tentativas from envios_whatsapp where id = (select passageira from ef)), 'NA_FILA/1',
  'W-14: falha passageira volta para a fila');
select ok((select enviar_apos > app_now() from envios_whatsapp where id = (select passageira from ef)), 'W-14: com intervalo');
select is((select estado from envios_whatsapp where id = (select permanente from ef)), 'FALHOU', 'W-14: erro permanente falha na hora');
select is((select estado from envios_whatsapp where id = (select tempo from ef)), 'DESCONHECIDO', 'W-14: tempo esgotado não repete sozinho');
select is((select count(*) from avisos_whatsapp where tipo = 'FALHA_ENVIO'), 2::bigint, 'W-14: a falha fica com um responsável, avisado no sino');
select is((select jsonb_array_length(plataforma_whatsapp(ana, ipe) -> 'falhas') from ids, c), 2, 'W-14: a tela mostra as falhas');
select is(pg_temp.campos($$ select plataforma_reenviar_whatsapp(ana, ipe, permanente, '') from ids, c, ef $$), '["motivo"]',
  'W-14: reenviar pede motivo');
select ok((select (plataforma_reenviar_whatsapp(ana, ipe, permanente, 'Marta trocou o número') ->> 'id') is not null from ids, c, ef),
  'W-14: reenviar cria um envio novo');
select ok((select resolvida_em is not null from envios_whatsapp where id = (select permanente from ef)), 'W-14: a falha antiga fica resolvida');
select plataforma_resolver_falha_whatsapp(ana, ipe, tempo, 'Liguei para a Marta.') from ids, c, ef;
select is((select jsonb_array_length(plataforma_whatsapp(ana, ipe) -> 'falhas') from ids, c), 0, 'W-14: resolvida sai da lista');
update envios_whatsapp set estado = 'ENVIANDO', enviar_apos = app_now() - interval '6 minutes' where id = (select passageira from ef);
select whatsapp_pegar_lote(20);
select is((select estado from envios_whatsapp where id = (select passageira from ef)), 'DESCONHECIDO', 'W-14: envio travado no meio fica desconhecido');

-- Tela do WhatsApp e triagem.
select throws_ok($$ select plataforma_whatsapp(lia, ipe) from ids, c $$, 'TC401', null, 'quem só acompanha não vê o WhatsApp');
select is(pg_temp.campos($$ select plataforma_triar_whatsapp(ana, ipe, id, 'ARQUIVAR', '', null, null) from ids, c, mensagens_whatsapp
                            where telefone = '+5561988771234' limit 1 $$), '["motivo"]', 'arquivar pede motivo');
select is((select (plataforma_triar_whatsapp(ana, ipe, id, 'CONTATO', null, null, (select c_rui from ct)) ->> 'tratadas')::int
             from ids, c, mensagens_whatsapp where telefone = '+5561988771234' limit 1), 2, 'MU-02: ligar o número a um contato trata a conversa');
select is((select telefone from contatos, ct where id = c_rui), '+5561988771234', 'o contato fica com o número');
select ok((select not (dados ? 'telefone') from historico where acao = 'contato.telefone_whatsapp'), 'o histórico não guarda o telefone');
select is((select (plataforma_triar_whatsapp(ana, ipe, m.id, 'PEDIDO', null, pm.id, null) ->> 'tratadas')::int
             from ids, c, pm, mensagens_whatsapp m where m.telefone = '+5561966665555' limit 1), 1, 'juntar a um pedido');

-- Configurações e avisos no WhatsApp de quem atende (W-11, W-12, F6.3).
select is(pg_temp.motivo($$ select plataforma_definir_whatsapp(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe),
  'Respondemos em até 2 horas, mesmo fora do horário de atendimento.', categoria_whatsapp(), prioridade_whatsapp()) from ids, c $$),
  'PROMESSA_DE_PRAZO', 'W-12: a mensagem de fora do horário não promete prazo');
select throws_ok($$ select plataforma_definir_whatsapp(gil, ipe, 1, 'Recebemos sua mensagem fora do horário.', null, null) from ids, c $$,
  'TC401', null, 'só quem configura muda');
select is(pg_temp.campos($$ select plataforma_meus_avisos_whatsapp(ana, ipe, null, '6199', array['PEDIDO_NOVO'], true) from ids, c $$),
  '["telefone"]', 'W-11: o celular de quem atende precisa ser válido');
select plataforma_meus_avisos_whatsapp(ana, ipe, null, '+5561991002233', array['PEDIDO_NOVO', 'RETORNO_VENCIDO', 'REVISAO'], true) from ids, c;
select pg_temp.msg('+5561988771234', 'Barulho no telhado à noite');
select pg_temp.msg('+5561988771234', '1');
select pg_temp.msg('+5561988771234', '1');
select ok(pg_temp.ultima('+5561991002233') ~ E'^Residencial Ipê · pedido novo\n[0-9]{4}-[0-9]{4} · Barulho no telhado à noite \\(Torre A · 102\\)$',
  'W-11: pedido novo no WhatsApp da síndica, sem dado do morador');
select ok(pg_temp.ultima('+5561991002233') !~ 'Rui', 'W-11: sem nome do morador');
select entrar_como_sistema((select ipe from c));
select avisar(array[(select ana from ids)], id, 'RETORNO_VENCIDO', app_now()) from pedidos where id = (select id from pm);
select entrar_como_sistema(null);
select ok(pg_temp.ultima('+5561991002233') ~ 'retorno vencido', 'F6.3: retorno vencido também vai ao WhatsApp de quem ligou');

-- Painel, sino e Console.
select is((select plataforma_painel(ana, ipe) -> 'whatsapp' ->> 'situacao' from ids, c), 'CONECTADO', 'o painel mostra o WhatsApp');
select ok((select bool_or(x ->> 'tipo' = 'WHATSAPP_PEDIDO_NOVO') from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x),
  'os avisos do WhatsApp entram no sino');
select ok((select plataforma_marcar_avisos(ana, ipe, null) > 0 from ids, c), 'e são marcados como vistos');
select whatsapp_evento((select segredo from g), 'ipe-inst', 'DESCONECTADO', null, null);
select is((select situacao from conexoes_whatsapp, c where condominio_id = ipe), 'DESCONECTADO', 'W-17: a queda do número fica registrada');
select is((select count(*) from avisos_whatsapp, ids where pessoa_id = ana and tipo = 'DESCONECTADO'), 1::bigint, 'W-17: e avisa quem cuida');
select is((select console_contagens(impl) ->> 'whatsapp' from ids), '1', 'o menu do Console conta os números desconectados');
select is((select console_whatsapp_lista(impl) -> 0 ->> 'nome' from ids), 'Residencial Ipê', 'desconectados primeiro');
select is((select jsonb_array_length(plataforma_pedido_whatsapp(ana, ipe, id) -> 'mensagens') > 5 from ids, c, pm), true,
  'a conversa aparece no pedido');
select throws_ok($$ update mensagens_whatsapp set texto = 'outro' where telefone = '+5561999990001' $$, 'TC422', null,
  'a mensagem recebida não muda');
-- Trocar as credenciais troca o segredo: o antigo para na hora.
select console_whatsapp_credenciais(impl, ipe, pg_temp.vcx(ipe), 'ipe-inst', pg_temp.cred()) from ids, c;
select is(pg_temp.codigo($$ select pg_temp.msg('+5561999990001', 'Oi') $$), 'TC403', 'W-15: o segredo antigo para na hora');

select * from finish();
rollback;

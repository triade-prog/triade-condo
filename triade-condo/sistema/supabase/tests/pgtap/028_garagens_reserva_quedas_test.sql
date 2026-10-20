-- Garagens e veículos (F3.8; MU-06 e MU-11 em parte), troca automática para o prestador reserva
-- (F5.9; MP-09) e queda do WhatsApp (F5.10; W-17). Desenho em docs/telas/garagens-reserva-quedas.html.
-- O relógio fica numa quarta-feira, 03/03/2027, ao meio-dia.
begin;
select plan(129);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO', 'CADASTRAR']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_MANUTENCAO']) as v_fabio,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administradora', array['RESPONDER']) as v_gil
  from ids, c;
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102;
select plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true),
       plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Paula Souza', '+5561999990003', '{"mora": true, "ligacao": "FAMILIAR", "parentesco": "FILHO"}', true),
       plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true)
  from ids, c, u;
create temp table ct as select
  (select id from contatos where nome = 'Marta Souza') as marta,
  (select id from contatos where nome = 'Paula Souza') as paula,
  (select id from contatos where nome = 'Rui Lima') as rui;

-- ---------------------------------------------------------------------------------------
-- Garagens e veículos (MU-06, MU-11).

select is(normalizar_placa(' qmf-2a41 '), 'QMF2A41', 'MU-06: a placa Mercosul é guardada em maiúsculas, sem hífen nem espaço');
select is(normalizar_placa('abc 1234'), 'ABC1234', 'MU-06: a placa antiga também');
select is(normalizar_placa('AB1234'), null, 'MU-06: fora dos dois formatos, não é placa');
select is(mostrar_placa('ABC1234'), 'ABC-1234', 'MU-06: a antiga aparece com hífen');
select is(mostrar_placa('QMF2A41'), 'QMF2A41', 'MU-06: a Mercosul aparece como é, sem hífen');

create temp table vg as select
  (plataforma_salvar_vaga(ana, ipe, null, null, '31', 'Subsolo 1', true, u101, null) ->> 'id')::uuid as v31,
  (plataforma_salvar_vaga(ana, ipe, null, null, '32', 'Subsolo 1', false, u102, null) ->> 'id')::uuid as v32,
  (plataforma_salvar_vaga(ana, ipe, null, null, 'V1', 'Térreo', false, null, null) ->> 'id')::uuid as visit
  from ids, c, u;
select is(pg_temp.campos($$ select plataforma_salvar_vaga(ana, ipe, null, null, ' 31 ', null, null, null, null) from ids, c $$),
  '["identificacao"]', 'MU-06: duas vagas em uso não têm a mesma identificação');
select is(pg_temp.campos($$ select plataforma_salvar_vaga(ana, ipe, null, null, '', null, null, null, null) from ids, c $$),
  '["identificacao"]', 'MU-06: a vaga precisa de identificação');
select throws_ok($$ select plataforma_salvar_vaga(fabio, ipe, null, null, '40', null, null, null, null) from ids, c $$, 'TC401', null,
  'MU-06: só quem cadastra moradores mexe nas vagas');
select ok(exists (select 1 from historico where acao = 'vaga.criada' and entidade_id = (select v31::text from vg)), 'MU-06: a vaga nova vai para o histórico');

create temp table vc as select
  (plataforma_salvar_veiculo(ana, ipe, null, null, u101, 'qmf-2a41', 'CARRO', 'Onix prata', marta, v31) ->> 'id')::uuid as onix,
  (plataforma_salvar_veiculo(bruna, ipe, null, null, u101, 'ABC-1234', 'MOTO', null, paula, null) ->> 'id')::uuid as moto
  from ids, c, u, ct, vg;
select is((select placa from veiculos where id = (select onix from vc)), 'QMF2A41', 'MU-06: o veículo guarda a placa normalizada');
select is(pg_temp.campos($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'QMF2A41', 'CARRO', null, null, null) from ids, c, u $$),
  '["placa"]', 'MU-06: a mesma placa não fica em uso em duas unidades');
select is(pg_temp.campos($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'XYZ', 'CARRO', null, null, null) from ids, c, u $$),
  '["placa"]', 'MU-06: placa fora do formato é recusada');
select is(pg_temp.campos($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'RUI2B22', 'CARRO', null, null, v31) from ids, c, u, vg $$),
  '["vagaId"]', 'MU-06: o veículo só fica numa vaga da própria unidade');
select is(pg_temp.campos($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'RUI2B22', 'CARRO', null, marta, null) from ids, c, u, ct $$),
  '["contatoId"]', 'MU-06: o dono do veículo é uma pessoa da unidade');
select is(pg_temp.campos($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'RUI2B22', 'CAMINHAO', null, null, null) from ids, c, u $$),
  '["tipo"]', 'MU-06: o tipo é carro, moto ou outro');
select throws_ok($$ select plataforma_salvar_veiculo(fabio, ipe, null, null, u102, 'RUI2B22', 'CARRO', null, null, null) from ids, c, u $$, 'TC401', null,
  'MU-06: só quem cadastra moradores inclui veículo');
select ok(exists (select 1 from historico where acao = 'unidade.veiculo_incluido' and entidade_id = (select u101::text from u))
          and not exists (select 1 from historico where dados::text ~* 'QMF|ABC1234|ABC-1234|Onix'),
  'MU-06: o veículo incluído vai para o histórico da unidade, sem a placa nem o modelo');

select is((select jsonb_agg(x ->> 'placa' order by x ->> 'placa') from ids, c, u, jsonb_array_elements(plataforma_unidade(ana, ipe, u101) -> 'veiculos') x),
  '["ABC-1234", "QMF2A41"]'::jsonb, 'MU-06: a ficha da unidade mostra os veículos em uso');
select is((select plataforma_unidade(ana, ipe, u101) -> 'vagas' -> 0 -> 'veiculos' -> 0 ->> 'placa' from ids, c, u), 'QMF2A41',
  'MU-06: a ficha mostra a vaga da unidade com o veículo nela');
select throws_ok($$ select plataforma_garagens(fabio, ipe) from ids, c $$, 'TC401', null, 'MU-11: sem ver moradores, sem garagens');
select is((select plataforma_garagens(ana, ipe) -> 'resumo' from ids, c),
  '{"vagas": 3, "deUnidades": 2, "doCondominio": 1, "veiculos": 2, "semVaga": 1}'::jsonb, 'MU-11: a aba Garagens conta vagas e veículos');
select is((select jsonb_array_length(plataforma_garagens(davi, jatoba) -> 'vagas') from ids, c), 0, 'MU-06: um condomínio não vê as vagas do outro');
select throws_ok($$ select plataforma_retirar_veiculo(davi, jatoba, onix, 1) from ids, c, vc $$, 'TC404', null,
  'MU-06: nem retira o veículo do outro');

-- Busca da lista de unidades (MU-11).
create function pg_temp.busca(p text) returns jsonb language sql as $$
  select plataforma_buscar_unidades((select ana from ids), (select ipe from c), p) $$;
select is(pg_temp.busca('qmf2a'), jsonb_build_array(jsonb_build_object('unidadeId', (select u101 from u), 'tipo', 'PLACA',
            'texto', 'placa QMF2A41 · Onix prata · vaga 31')), 'MU-11: a busca acha a unidade pela placa, com o veículo e a vaga');
select is(pg_temp.busca('abc-12') -> 0 ->> 'texto', 'placa ABC-1234 · sem vaga', 'MU-11: a placa acha com ou sem hífen');
select is(pg_temp.busca('Rui') -> 0 ->> 'tipo', 'NOME', 'MU-11: a busca acha pelo nome de quem mora');
select is(pg_temp.busca('7771') -> 0 ->> 'tipo', 'TELEFONE', 'MU-11: e pelo telefone');
select is((select jsonb_agg(x ->> 'tipo') from jsonb_array_elements(pg_temp.busca('101')) x), '["UNIDADE"]'::jsonb,
  'MU-11: e pela identificação da unidade, uma linha por unidade');
select is(pg_temp.campos($$ select pg_temp.busca('a') $$), '["busca"]', 'MU-11: a busca pede ao menos 2 caracteres');

-- Vaga com veículo não sai de uso; retirar o veículo libera a vaga e a placa.
select is(pg_temp.motivo($$ select plataforma_salvar_vaga(ana, ipe, v31, 1, '31', 'Subsolo 1', true, u101, false) from ids, c, vg, u $$),
  'VAGA_COM_VEICULO', 'MU-06: vaga com veículo não sai de uso');
select is(pg_temp.motivo($$ update unidades set ativa = false where id = (select u101 from u) $$), 'UNIDADE_COM_VEICULO',
  'MU-06: unidade com veículo em uso não é desativada');
select lives_ok($$ select plataforma_retirar_veiculo(ana, ipe, onix, 1) from ids, c, vc $$, 'MU-06: retirar o veículo');
select is(pg_temp.motivo($$ select plataforma_salvar_veiculo(ana, ipe, onix, 2, null, 'QMF2A41', 'CARRO', null, null, null) from ids, c, vc $$),
  'VEICULO_RETIRADO', 'MU-06: veículo retirado não muda');
select is(pg_temp.busca('QMF2A41'), '[]'::jsonb, 'MU-11: a busca só acha placa em uso');
select lives_ok($$ select plataforma_salvar_veiculo(ana, ipe, null, null, u102, 'QMF2A41', 'CARRO', null, rui, v32) from ids, c, u, ct, vg $$,
  'MU-06: a placa retirada pode entrar em outra unidade');
select is((plataforma_salvar_vaga(ana, ipe, v31, 1, '31', 'Subsolo 1', true, u101, false) ->> 'versao')::integer, 2,
  'MU-06: sem veículo, a vaga sai de uso') from ids, c, vg, u;
select ok(exists (select 1 from historico where acao = 'vaga.fora_de_uso' and entidade_id = (select v31::text from vg)),
  'MU-06: a vaga fora de uso vai para o histórico');

-- Quem sai leva o veículo; remover os dados apaga a placa (PT-11).
select plataforma_encerrar_vinculo_unidade(ana, ipe, cu.id, cu.versao, 'MUDANCA', null)
  from ids, c, ct, contatos_unidade cu where cu.contato_id = paula;
select is((select motivo_retirada from veiculos where id = (select moto from vc)), 'SAIU', 'MU-06: o veículo de quem saiu sai junto');
select ok(exists (select 1 from historico where acao = 'unidade.veiculo_retirado' and dados ->> 'motivo' = 'SAIU'),
  'MU-06: com registro no histórico da unidade');
select plataforma_remover_dados_contato(ana, ipe, paula, (select versao from contatos where id = paula)) from ids, c, ct;
select is((select placa from veiculos where id = (select moto from vc)), null, 'MU-06: remover os dados de quem saiu apaga a placa');

-- ---------------------------------------------------------------------------------------
-- Prestador reserva (MP-09).

create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo
  from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
select is((select count(*)::integer from quedas_whatsapp), 0, 'W-17: conectar pela primeira vez não abre queda');

create function pg_temp.prestador(p_nome text, p_tel text, p_reserva uuid) returns uuid language sql as $$
  select (plataforma_salvar_prestador((select ana from ids), (select ipe from c), null, null, p_nome, 'Bombas', null, p_tel, null, null,
                                      'CHAMADO', null, null, p_reserva, null) ->> 'id')::uuid $$;
create temp table pr as select pg_temp.prestador('AquaFix', '+5561933005500', null) as aqua;
alter table pr add column semtel uuid, add column hidro uuid, add column eletro uuid, add column solo uuid;
update pr set semtel = pg_temp.prestador('Faz Tudo', null, null);
update pr set hidro = pg_temp.prestador('HidroPress', '+5561933441200', aqua), eletro = pg_temp.prestador('Eletro Sul', '+5561933441201', semtel),
              solo = pg_temp.prestador('Sozinho', '+5561933441202', null);
create function pg_temp.manutencao(p_titulo text, p_prestador uuid) returns uuid language sql as $$
  select (plataforma_registrar_manutencao((select ana from ids), (select ipe from c), 'CORRETIVA', p_titulo, 'Casa de bombas', null,
            (select id from prioridades where condominio_id = (select ipe from c) and modelo = 'ALTA'), (select v_bruna from vs),
            p_prestador, null, null, null, null, null, null) ->> 'id')::uuid $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from manutencoes where id = p $$;
create function pg_temp.link(p_m uuid, p_horas integer) returns jsonb language sql as $$
  select plataforma_criar_link_prestador((select ana from ids), (select ipe from c), p_m, pg_temp.vm(p_m), 'Trocar o rolamento da bomba 2.',
           'Hoje, 14h às 17h', null, (app_now() at time zone 'America/Sao_Paulo')::date + 14, null, p_horas) $$;
create temp table m as select
  pg_temp.manutencao('Bomba de recalque com ruído', hidro) as m1,
  pg_temp.manutencao('Bomba de incêndio', hidro) as m2,
  pg_temp.manutencao('Quadro elétrico', eletro) as m3,
  pg_temp.manutencao('Bomba da piscina', hidro) as m4,
  pg_temp.manutencao('Filtro', solo) as m5
  from pr;

select is(pg_temp.campos($$ select pg_temp.link(m5, 24) from m $$), '["responderHoras"]',
  'MP-09: sem reserva no cadastro, não há troca automática');
select is(pg_temp.campos($$ select pg_temp.link(m1, 12) from m $$), '["responderHoras"]', 'MP-09: o prazo é de 4, 8, 24 ou 48 horas');
select lives_ok($$ select pg_temp.link(m5, null) from m $$, 'MP-09: sem prazo, o link sai como antes');
create temp table lk as select pg_temp.link(m1, 4) as l1 from m;
select is((select responder_ate from links_prestador where id = (l1 ->> 'id')::uuid), app_now() + interval '4 hours',
  'MP-09: o prazo conta em horas corridas desde o envio') from lk;
select ok(exists (select 1 from historico where acao = 'manutencao.reserva_programada' and dados ->> 'horas' = '4'),
  'MP-09: a troca programada vai para o histórico');
select is((select plataforma_link_prestador(ana, ipe, m1) -> 'link' -> 'reserva' ->> 'nome' from ids, c, m), 'AquaFix',
  'MP-09: o link mostra quem é a reserva');
select is((select plataforma_link_prestador(ana, ipe, m1) -> 'pode' ->> 'naoTrocar' from ids, c, m), 'true',
  'MP-09: e deixa desligar a troca');
select is((select plataforma_link_prestador(ana, ipe, m5) -> 'reservaDoCadastro' from ids, c, m), null,
  'MP-09: sem reserva no cadastro, a tela não oferece o prazo');
select is((publico_prestador(l1 ->> 'codigo') ->> 'responderAte')::timestamptz, app_now() + interval '4 hours',
  'MP-09: o prestador vê até quando responder') from lk;

-- Abrir não conta como resposta; no prazo, nada troca.
select is(verificar_reservas(), 0, 'MP-09: dentro do prazo, ninguém é trocado');
select ajustar_relogio(timestamptz '2027-03-03 16:05:00-03' - now());
-- Fora do horário de funcionamento, a troca espera (decisão 8).
update horarios set intervalos = '[{"dia": 3, "inicio": "08:00", "fim": "12:00"}]' where tipo = 'FUNCIONAMENTO';
select is(verificar_reservas(), 0, 'MP-09: fora do horário de funcionamento, a troca espera');
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo = 'FUNCIONAMENTO';
select is(verificar_reservas(), 1, 'MP-09: sem resposta no prazo, o serviço passa para a reserva');
select is((select prestador_id from manutencoes where id = (select m1 from m)), (select aqua from pr), 'MP-09: a reserva passa a executar');
select is(publico_prestador(l1 ->> 'codigo') - 'condominio', '{"encerrado": true, "motivo": "REPASSADO"}'::jsonb,
  'MP-09: o link do principal para e diz que o serviço foi repassado') from lk;
select ok(exists (select 1 from historico where acao = 'manutencao.reserva_assumiu' and entidade_id = (select m1::text from m)
                    and dados ->> 'motivo' = 'SEM_RESPOSTA' and dados ->> 'canal' = 'WHATSAPP'),
  'MP-09: a troca vai para o histórico, com o motivo e o canal');
create temp table ev as select * from envios_whatsapp where finalidade = 'PRESTADOR';
select is((select count(*)::integer from ev), 1, 'MP-09: o link da reserva entra na fila do WhatsApp');
select is((select para || ' · ' || modelo_chave from ev), '+5561933005500 · link_prestador', 'MP-09: para o celular da reserva, com o modelo');
select is((select texto from ev),
  E'O Residencial Ipê tem um serviço para AquaFix: Bomba de recalque com ruído (Casa de bombas).\n\nVeja o que fazer e confirme até 03/03, 20:05: [link]\n\nO link é só para este serviço e não precisa de conta.',
  'MP-09: o texto diz o serviço e até quando confirmar');
select is((select count(*)::integer from avisos_reserva a, ids where a.pessoa_id = bruna and a.tipo = 'TROCOU'), 1,
  'MP-09: o responsável pela manutenção é avisado da troca');
select ok((select bool_or(x ->> 'tipo' = 'TROCA_TROCOU' and x ->> 'titulo' = 'Bomba de recalque com ruído')
             from ids, c, jsonb_array_elements(plataforma_avisos(bruna, ipe) -> 'itens') x), 'MP-09: o aviso aparece no sino');
select plataforma_marcar_avisos(bruna, ipe, null) from ids, c;
select is((select count(*)::integer from avisos_reserva where visto_em is null), 0, 'MP-09: e é marcado como visto');
select is((select plataforma_link_prestador(ana, ipe, m1) -> 'link' -> 'trocaDe' ->> 'nome' from ids, c, m), 'HidroPress',
  'MP-09: o link novo mostra de quem veio');

-- O código do link da reserva nasce na hora de mandar.
create temp table lote as select x from jsonb_array_elements(whatsapp_pegar_lote(20)) l, jsonb_array_elements(l -> 'envios') x
  where x ->> 'envio' = (select id::text from ev);
select is((select x ->> 'rota' from lote), 'p', 'MP-09: a fila manda o link pela página do prestador');
select is((publico_prestador(x ->> 'link') ->> 'para'), 'AquaFix', 'MP-09: o link mandado abre o serviço para a reserva') from lote;
select is(verificar_reservas(), 0, 'MP-09: a troca acontece uma vez só');
select ajustar_relogio(timestamptz '2027-03-03 20:10:00-03' - now());
select is(verificar_reservas(), 0, 'MP-09: a reserva sem resposta não troca de novo');
select is((select count(*)::integer from avisos_reserva where tipo = 'RESERVA_SEM_RESPOSTA'), 1,
  'MP-09: mas o responsável é avisado de que a reserva também não respondeu');
select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

-- Recusar troca na hora; reserva sem celular, o responsável manda o link.
create temp table lk3 as select pg_temp.link(m3, 24) as l3 from m;
select is(pg_temp.campos($$ select publico_prestador_recusar(l3 ->> 'codigo', 'x') from lk3 $$), '["texto"]',
  'MP-09: o motivo da recusa, se vier, tem de 3 a 500 caracteres');
select is(publico_prestador_recusar(l3 ->> 'codigo', 'Equipe toda em outro serviço hoje') ->> 'resposta', 'RECUSOU',
  'MP-09: o prestador diz que não pode atender') from lk3;
select is((select prestador_id from manutencoes where id = (select m3 from m)), (select semtel from pr), 'MP-09: recusar passa para a reserva na hora');
select is((select count(*)::integer from avisos_reserva a, ids where a.pessoa_id = bruna and a.tipo = 'MANDAR_LINK'), 1,
  'MP-09: reserva sem celular, o responsável é avisado para mandar o link');
select ok(exists (select 1 from historico where acao = 'manutencao.reserva_assumiu' and dados ->> 'motivo' = 'RECUSOU' and not (dados ? 'canal')),
  'MP-09: a troca pela recusa vai para o histórico');
select ok(exists (select 1 from historico where acao = 'manutencao.prestador_recusou'), 'MP-09: e a recusa também');

-- Confirmar segura o principal; desligar a troca também.
create temp table lk2 as select pg_temp.link(m2, 4) as l2, pg_temp.link(m4, 4) as l4 from m;
select is(publico_prestador_confirmar(l2 ->> 'codigo') ->> 'resposta', 'CONFIRMOU', 'MP-09: o prestador confirma que vai fazer') from lk2;
select is(publico_prestador_confirmar(l2 ->> 'codigo') ->> 'resposta', 'CONFIRMOU', 'MP-09: confirmar de novo não muda nada') from lk2;
select is(pg_temp.motivo($$ select publico_prestador_recusar(l2 ->> 'codigo', null) from lk2 $$), 'JA_RESPONDIDO',
  'MP-09: quem já respondeu não recusa depois');
select throws_ok($$ select plataforma_desligar_troca(fabio, ipe, m4, (l4 ->> 'id')::uuid) from ids, c, m, lk2 $$, 'TC401', null,
  'MP-09: só quem cuida da manutenção desliga a troca');
select lives_ok($$ select plataforma_desligar_troca(ana, ipe, m4, (l4 ->> 'id')::uuid) from ids, c, m, lk2 $$, 'MP-09: desligar a troca deste link');
select is(pg_temp.motivo($$ select plataforma_desligar_troca(ana, ipe, m4, (l4 ->> 'id')::uuid) from ids, c, m, lk2 $$), 'SEM_TROCA',
  'MP-09: desligada, não desliga de novo');
select ajustar_relogio(timestamptz '2027-03-03 16:05:00-03' - now());
select is(verificar_reservas(), 0, 'MP-09: quem confirmou e o link com a troca desligada não são trocados');
select is((select array_agg(prestador_id) from manutencoes where id in ((select m2 from m), (select m4 from m))),
  (select array[hidro, hidro] from pr), 'MP-09: os dois continuam com o principal');
select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

-- ---------------------------------------------------------------------------------------
-- Queda do WhatsApp (W-17).

create temp table seq (n integer);
insert into seq values (0);
create function pg_temp.msg(p_tel text, p_texto text, p_em timestamptz default null) returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_build_object('id', 'Q' || v_n, 'telefone', p_tel, 'enviadaEm', coalesce(p_em, app_now()), 'texto', p_texto, 'tipo', 'TEXTO'));
end $$;
create function pg_temp.enfileirar(p_texto text, p_por uuid) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform entrar_como_sistema((select ipe from c));
  v := enfileirar_whatsapp('+5561999990001', (select marta from ct), null, null, null, 'RESPOSTA', p_texto, null, p_por);
  perform entrar_como_sistema(null);
  return v;
end $$;
create function pg_temp.q() returns quedas_whatsapp language sql as $$
  select * from quedas_whatsapp order by estado = 'ENCERRADA', inicio desc limit 1 $$;
create function pg_temp.wa(p uuid) returns jsonb language sql as $$ select plataforma_whatsapp(p, (select ipe from c)) $$;
select plataforma_definir_mural_email(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe), true,
                                      array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], false, null, false, false) from ids, c;
create temp table et as select (plataforma_salvar_etiqueta(ana, ipe, null, null, 'Portaria', null, null, null) ->> 'id')::uuid as e1 from ids, c;
create function pg_temp.etiqueta() returns jsonb language sql as $$ select publico_etiqueta(codigo) from etiquetas where id = (select e1 from et) $$;
create function pg_temp.mural() returns jsonb language sql as $$
  select publico_mural(mural_codigo) from configuracao_condominio where condominio_id = (select ipe from c) $$;
create temp table antes as select pg_temp.enfileirar('Já está na fila antes da queda', ana) as e0 from ids;

select whatsapp_evento((select segredo from g), 'ipe-inst', 'DESCONECTADO', null, null);
select is((select estado || ' · ' || origem from pg_temp.q()), 'FORA_DO_AR · PROVEDOR', 'W-17: o número desconectado abre a queda sozinho');
select is((select responsavel from pg_temp.q()), (select ana from ids), 'W-17: quem cuida, sem escolha nas configurações, é o síndico');
select ajustar_relogio(timestamptz '2027-03-03 12:40:00-03' - now());
select ok(exists (select 1 from historico where acao = 'whatsapp.queda_aberta' and dados ->> 'origem' = 'PROVEDOR'),
  'W-17: a queda vai para o histórico');
select ok((select bool_or(x ->> 'tipo' = 'WHATSAPP_QUEDA') from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x),
  'W-17: e para o sino de quem cuida');
select is((select enviar_apos from envios_whatsapp where id = (select e0 from antes)), 'infinity'::timestamptz,
  'W-17: o que estava na fila fica parado');
create temp table ef as select
  pg_temp.enfileirar('Resposta automática que perde o sentido', null) as auto,
  pg_temp.enfileirar('Retorno do síndico sobre o vazamento', ana) as manual,
  pg_temp.enfileirar('Aviso já dado pelo interfone', ana) as outro
  from ids;
select is((select count(*)::integer from envios_whatsapp where queda_id = (select id from pg_temp.q()) and enviar_apos = 'infinity'), 4,
  'W-17: o que entra na fila durante a queda também fica parado');
select is(pg_temp.motivo($$ select plataforma_abrir_queda(ana, ipe, null) from ids, c $$), 'QUEDA_ABERTA', 'W-17: uma queda por vez');
select throws_ok($$ select plataforma_editar_queda(bruna, ipe, (pg_temp.q()).id, 1, 'Portaria: (61) 3333-4444', null) from ids, c $$,
  'TC401', null, 'W-17: só quem responde pelo WhatsApp cuida da queda');
select is(pg_temp.campos($$ select plataforma_editar_queda(ana, ipe, (pg_temp.q()).id, 1, 'Tel', null) from ids, c $$), '["canalAlternativo"]',
  'W-17: o canal alternativo tem de 5 a 300 caracteres');
select is((plataforma_editar_queda(ana, ipe, (pg_temp.q()).id, 1, 'Portaria: (61) 3333-4444, das 7h às 22h', 'O celular do condomínio quebrou')
           ->> 'versao')::integer, 2, 'W-17: quem cuida diz o canal alternativo e o que aconteceu') from ids, c;
select is(pg_temp.etiqueta() ->> 'canalAlternativo', 'Portaria: (61) 3333-4444, das 7h às 22h', 'W-17: a etiqueta mostra o canal alternativo');
select is(pg_temp.mural() ->> 'canalAlternativo', 'Portaria: (61) 3333-4444, das 7h às 22h', 'W-17: o mural também');
select is((select plataforma_painel(ana, ipe) -> 'whatsapp' -> 'queda' ->> 'estado' from ids, c), 'FORA_DO_AR', 'W-17: o Início mostra a queda');
select is(pg_temp.motivo($$ select plataforma_conciliar_queda(ana, ipe, (pg_temp.q()).id, array[manual], 'MANDAR', null) from ids, c, ef $$),
  'QUEDA_NAO_CONFERINDO', 'W-17: só se decide o que ficou parado com o número de volta');
select is(pg_temp.motivo($$ select plataforma_queda_voltou(ana, ipe, (pg_temp.q()).id) from ids, c $$), 'NUMERO_DESCONECTADO',
  'W-17: a queda do provedor só volta quando o número reconecta');

-- O número volta: conferindo.
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
select is((select estado from pg_temp.q()), 'CONFERINDO', 'W-17: com o número de volta, a queda passa a conferindo');
select ok((select bool_or(x ->> 'tipo' = 'WHATSAPP_QUEDA_VOLTOU') from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x),
  'W-17: quem cuida é avisado de que o número voltou');
select is((select estado || ' · ' || conciliacao from envios_whatsapp where id = (select auto from ef)), 'CANCELADA · NAO_MANDAR',
  'W-17: a resposta automática que perdeu o sentido sai como não mandada');
select is((select count(*)::integer from envios_whatsapp e where envio_parado(e)), 3, 'W-17: o resto espera a decisão');
select is(whatsapp_pegar_lote(20), '[]'::jsonb, 'W-17: e não sai sozinho');
select ok(not (pg_temp.etiqueta() ? 'canalAlternativo'), 'W-17: com o número de volta, a etiqueta deixa de mostrar o canal alternativo');
select pg_temp.msg('+5561999990001', 'Mandei durante a queda', (pg_temp.q()).inicio + interval '1 minute');
select is((select (pg_temp.wa((select ana from ids)) -> 'queda' ->> 'atrasadas')::integer), 1, 'W-17: a conferência conta as mensagens que chegaram atrasadas');
select is((select jsonb_array_length(pg_temp.wa((select ana from ids)) -> 'queda' -> 'envios')), 4, 'W-17: e lista o que ficou parado');
select is(pg_temp.motivo($$ select plataforma_encerrar_queda(ana, ipe, (pg_temp.q()).id, (pg_temp.q()).versao, 'Tudo resolvido pela portaria.') from ids, c $$),
  'QUEDA_COM_PARADAS', 'W-17: não encerra com mensagem parada');
select is(pg_temp.campos($$ select plataforma_conciliar_queda(ana, ipe, (pg_temp.q()).id, array[outro], 'OUTRO_CANAL', null) from ids, c, ef $$),
  '["motivo"]', 'W-17: resolvido por outro canal pede por onde');
select is((plataforma_conciliar_queda(ana, ipe, (pg_temp.q()).id, array[outro], 'OUTRO_CANAL', 'Pelo interfone') ->> 'decididas')::integer, 1,
  'W-17: resolvido por outro canal') from ids, c, ef;
select is((select estado from envios_whatsapp where id = (select outro from ef)), 'CANCELADA', 'W-17: e não sai mais');
select is(pg_temp.motivo($$ select plataforma_conciliar_queda(ana, ipe, (pg_temp.q()).id, array[outro], 'MANDAR', null) from ids, c, ef $$),
  'JA_DECIDIDA', 'W-17: o que já foi decidido não se decide de novo');
select is((plataforma_conciliar_queda(ana, ipe, (pg_temp.q()).id, array[manual, e0], 'MANDAR', null) ->> 'decididas')::integer, 2,
  'W-17: mandar agora') from ids, c, ef, antes;
select ajustar_relogio(timestamptz '2027-03-03 12:41:00-03' - now());
select is((select count(*)::integer from jsonb_array_elements(whatsapp_pegar_lote(20)) l, jsonb_array_elements(l -> 'envios') x
            where x ->> 'envio' in ((select manual::text from ef), (select e0::text from antes))), 2, 'W-17: o que foi mandado agora sai pela fila');
select ok(exists (select 1 from historico where acao = 'whatsapp.queda_conciliada' and dados ->> 'decisao' = 'MANDAR' and dados ->> 'mensagens' = '2')
          and not exists (select 1 from historico where acao like 'whatsapp.queda%' and dados::text ~ 'vazamento|interfone'),
  'W-17: cada decisão vai para o histórico, sem o texto das mensagens');
select is(pg_temp.campos($$ select plataforma_encerrar_queda(ana, ipe, (pg_temp.q()).id, (pg_temp.q()).versao, 'curto') from ids, c $$),
  '["resumo"]', 'W-17: encerrar pede o que foi feito');
select is((plataforma_encerrar_queda(ana, ipe, (pg_temp.q()).id, (pg_temp.q()).versao,
           'Avisamos pela portaria; o celular foi trocado e as mensagens conferidas.') ->> 'versao')::integer, 4,
  'W-17: com nada parado e o resumo, a queda se encerra') from ids, c;
select is((select jsonb_array_length(pg_temp.wa((select ana from ids)) -> 'quedas')), 1, 'W-17: a queda encerrada fica na lista');
select ok(not (pg_temp.wa((select ana from ids)) ? 'queda'), 'W-17: e sai da tela principal');
select throws_ok($$ update quedas_whatsapp set resumo = 'Outro resumo qualquer' $$, 'TC422', null, 'W-17: queda encerrada não muda');
select ok((select bool_and(h ->> 'acao' like 'whatsapp.queda%') and count(*) >= 4 and bool_or(h ->> 'acao' = 'whatsapp.queda_encerrada')
             from ids, c, jsonb_array_elements(plataforma_queda(ana, ipe, (pg_temp.q()).id) -> 'historico') h),
  'W-17: a queda mostra o próprio histórico');
select throws_ok($$ select plataforma_queda(davi, jatoba, (pg_temp.q()).id) from ids, c $$, 'TC404', null, 'W-17: um condomínio não vê a queda do outro');

-- Abrir à mão, com quem cuida escolhido nas configurações.
select is(pg_temp.campos($$ select plataforma_quedas_responsavel(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe), bruna) from ids, c $$),
  '["pessoaId"]', 'W-17: quem cuida da queda precisa responder pelo WhatsApp');
select lives_ok($$ select plataforma_quedas_responsavel(ana, ipe, (select versao from configuracao_condominio where condominio_id = ipe), gil) from ids, c $$,
  'W-17: o síndico escolhe quem cuida das quedas');
select is((select plataforma_config_whatsapp(ana, ipe) -> 'quedas' ->> 'quemCuida' from ids, c), 'Gil', 'W-17: e a configuração mostra');
select throws_ok($$ select plataforma_quedas_responsavel(gil, ipe, (select versao from configuracao_condominio where condominio_id = ipe), null) from ids, c $$,
  'TC401', null, 'W-17: só quem configura escolhe');
select lives_ok($$ select plataforma_abrir_queda(gil, ipe, 'As mensagens pararam de chegar') from ids, c $$,
  'W-17: quem cuida abre a queda à mão quando as mensagens param');
select is((select origem || ' · ' || responsavel::text from pg_temp.q()), 'MANUAL · ' || (select gil::text from ids),
  'W-17: aberta à mão, com quem cuida');
create temp table em as select pg_temp.enfileirar('Durante a queda manual', ana) as e from ids;
select is((select enviar_apos from envios_whatsapp where id = (select e from em)), 'infinity'::timestamptz,
  'W-17: a fila também para na queda aberta à mão');
select lives_ok($$ select plataforma_queda_voltou(gil, ipe, (pg_temp.q()).id) from ids, c $$, 'W-17: e quem cuida diz que voltou');
select is((select estado from pg_temp.q()), 'CONFERINDO', 'W-17: e a queda passa a conferindo');

select * from finish();
rollback;

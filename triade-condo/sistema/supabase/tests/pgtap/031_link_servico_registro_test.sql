-- Link do serviço para o prestador avisado no registro (F6.7; MP-09, V-11): com o link, nasce a
-- manutenção corretiva ligada ao pedido e o prestador recebe o link (pelo modelo link_prestador ou
-- por e-mail), com o prazo para responder contado da saída da mensagem e a troca para a reserva.
-- Tudo na transação do registro (PT-04), sem dado de morador para fora (PT-11) e com histórico.
begin;
select plan(69);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['ATUALIZAR', 'MANUTENCAO']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Portaria', array['ATUALIZAR']) as v_edu,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administradora', array['RESPONDER', 'VER_MANUTENCAO']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Administradora', array['RESPONDER']) as v_lia
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v from c, vs, unnest(array[v_ana, v_gil, v_lia]) v;
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');
select ajustar_relogio(timestamptz '2027-03-03 10:00:00-03' - now());
update configuracao_condominio set email_ligado = true, email_responder_para = 'sindica@ipe.com.br' where condominio_id = (select ipe from c);

select plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) from ids, c;
select plataforma_incluir_unidades(ana, ipe, (select id from blocos where nome = 'Torre A'), '[{"identificacao": "101"}]') from ids, c;
create temp table u as select (select id from unidades where identificacao = '101') as u101;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta
  from ids, c, u;
create temp table ct as select (select contato_id from contatos_unidade where id = (marta ->> 'vinculoId')::uuid) as c_marta from vin;

create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from prioridades where condominio_id = ipe and modelo = 'URGENTE') as urgente
  from c;
create temp table pr0 as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Atlas Manutenção', 'Elevadores', null, null, 'contato@atlas.com.br', null, 'CHAMADO',
                               null, null, null, null) ->> 'id')::uuid as atlas
  from ids, c;
create temp table pr as select atlas,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Elevadores Sobe', 'Elevadores', null, '+5561933334444', null, null, 'CONTRATO',
                               null, null, atlas, null) ->> 'id')::uuid as sobe,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Hidráulica Lima', 'Encanador', null, null, 'contato@hidraulica.com.br', null, 'CHAMADO',
                               null, null, null, null) ->> 'id')::uuid as hidraulica
  from ids, c, pr0;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.registrar(p_pessoa uuid, p_local text, p_prioridade uuid, p_assunto text, p_privado boolean, p_responsavel uuid,
                                  p_avisar jsonb) returns jsonb language sql as $$
  select plataforma_registrar_pedido(p_pessoa, (select ipe from c), null, null, p_local, (select manutencao from cfg), p_prioridade,
                                     p_assunto, 'Entre o 3º e o 4º andar.', 'OBSERVACAO', p_privado, p_responsavel, p_avisar) $$;
create function pg_temp.link(p_prestador uuid, p_texto text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('quemPediu', false, 'prestador', jsonb_build_object('id', p_prestador, 'texto', p_texto,
    'link', jsonb_build_object('quando', 'Hoje, assim que possível', 'comoEntrar', 'Portaria da Torre B; procurar o zelador') || p_extra)) $$;
create function pg_temp.previa(p_pessoa uuid, p_dados jsonb) returns jsonb language sql as $$
  select plataforma_quem_avisar(p_pessoa, (select ipe from c), p_dados) $$;

-- O WhatsApp do condomínio conectado (piloto).
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;

-- O bloco Quem avisar com o link (decisões 1, 3 e 7).
create temp table pv1 as select pg_temp.previa(bruna, jsonb_build_object('prioridadeId', urgente, 'prestadorId', sobe,
  'local', 'Elevador social da Torre B', 'assunto', 'Elevador parado')) as r from ids, cfg, pr;
select is((select (r -> 'prestador' -> 'link') - 'mensagem' from pv1),
  jsonb_build_object('disponivel', true, 'valeAte', '2027-03-10', 'responderHoras', 4),
  'V-11: quem cuida da manutenção pode mandar o link; validade de 7 dias e, no urgente, 4 horas para responder');
select is((select r -> 'prestador' -> 'link' ->> 'mensagem' from pv1),
  E'O Residencial Ipê tem um serviço para [prestador]: Elevador parado (Elevador social da Torre B).\n\nVeja o que fazer e confirme até [prazo]: [link]\n\nO link é só para este serviço e não precisa de conta.',
  'V-11: a prévia mostra a mensagem do link');
select is((select r -> 'prestador' -> 'escolhido' ->> 'meioLink' from pv1), 'WHATSAPP', 'V-11: o link vai pelo WhatsApp do condomínio');
select is((select r -> 'prestador' -> 'escolhido' -> 'reserva' ->> 'nome' from pv1), 'Atlas Manutenção', 'MP-09: a reserva do cadastro vem junto');
select is((select jsonb_path_query_array(r, '$.prestadores[*].meioLink') from pv1), '["EMAIL", "WHATSAPP", "EMAIL"]'::jsonb,
  'V-11: por onde o link chega a cada prestador');
select is((select pg_temp.previa(bruna, jsonb_build_object('prioridadeId', normal)) -> 'prestador' -> 'link' ->> 'responderHoras' from ids, cfg), '24',
  'MP-09: nos outros pedidos, 24 horas');
select is((select pg_temp.previa(edu, '{}') -> 'prestador' -> 'link' ->> 'motivo' from ids), 'SEM_PERMISSAO',
  'V-11: quem não cuida da manutenção não manda o link');
select is((select pg_temp.previa(bruna, '{"privado": true}') -> 'prestador' -> 'link' ->> 'motivo' from ids), 'PRIVADO',
  'PT-11: pedido privado não tem link');

-- O que o registro recusa, sem gravar nada (decisão 9).
create temp table n0 as select (select count(*)::int from pedidos) as p, (select count(*)::int from manutencoes) as m;
select is(pg_temp.motivo($$ select pg_temp.registrar(edu, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado, ninguém preso.')) from ids, cfg, vs, pr $$), 'SEM_PERMISSAO_MANUTENCAO',
  'V-11: sem a permissão de editar manutenção, o link é recusado');
select is(pg_temp.campos($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Parado.')) from ids, cfg, vs, pr $$), '["textoPrestador"]'::jsonb, 'V-11: o que fazer tem de 10 a 1500 caracteres');
select is(pg_temp.campos($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado, ninguém preso.', '{"comoEntrar": "x"}')) from ids, cfg, vs, pr $$), '["comoEntrar"]'::jsonb,
  'V-11: como entrar é obrigatório, como no link da manutenção');
select is(pg_temp.campos($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado, ninguém preso.', '{"quando": ""}')) from ids, cfg, vs, pr $$), '["quando"]'::jsonb,
  'V-11: quando também');
select is(pg_temp.campos($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado, ninguém preso.', '{"valeAte": "2027-06-01"}')) from ids, cfg, vs, pr $$), '["valeAte"]'::jsonb,
  'V-11: o link vale até 60 dias');
select is(pg_temp.campos($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado, ninguém preso.', '{"responderHoras": 12}')) from ids, cfg, vs, pr $$), '["responderHoras"]'::jsonb,
  'MP-09: prazo de 4, 8, 24 ou 48 horas');
select is(pg_temp.motivo($$ select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, 'Elevador parado. Ligue para (61) 99999-0001.')) from ids, cfg, vs, pr $$), 'DADO_DE_MORADOR',
  'PT-11: o que fazer não leva telefone de morador');
select is(pg_temp.motivo($$ select pg_temp.registrar(bruna, 'Jardim', normal, 'Grama alta', true, v_gil,
  pg_temp.link(sobe, 'Grama alta no jardim da frente.')) from ids, cfg, vs, pr $$), 'PEDIDO_PRIVADO', 'PT-11: pedido privado não vai para o prestador');
select is((select count(*)::int from pedidos) || ' ' || (select count(*)::int from manutencoes), (select p || ' ' || m from n0),
  'PT-04: recusado, nem o pedido nem a manutenção gravam');

-- 1. A Bruna registra o elevador parado, urgente, para o Gil, com o link para a Elevadores Sobe.
create temp table x1 as select pg_temp.registrar(bruna, 'Elevador social da Torre B', urgente, 'Elevador parado', false, v_gil,
  pg_temp.link(sobe, E'Elevador parado entre o 3º e o 4º andar. Ninguém preso.\n\nAvaliar e religar com segurança.')) as r from ids, cfg, vs, pr;
create temp table p1 as select * from pedidos where id = (select (r ->> 'id')::uuid from x1);
create temp table m1 as select * from manutencoes where pedido_id = (select id from p1);
select is((select count(*)::int from m1), 1, 'V-11: nasce uma manutenção ligada ao pedido');
select is((select tipo || ' · ' || titulo || ' · ' || local || ' · ' || estado from m1), 'CORRETIVA · Elevador parado · Elevador social da Torre B · PLANEJADA',
  'V-11: corretiva, com o assunto e o local do pedido');
select is((select prioridade_id from m1), (select urgente from cfg), 'V-11: com a prioridade do pedido');
select is((select responsavel_id from m1), (select v_gil from vs), 'V-11: e o responsável do pedido, que vê a manutenção');
select is((select prestador_id from m1), (select sobe from pr), 'V-11: o prestador executa');
create temp table l1 as select * from links_prestador where manutencao_id = (select id from m1);
select is((select o_que_fazer || ' | ' || quando || ' | ' || como_entrar from l1),
  E'Elevador parado entre o 3º e o 4º andar. Ninguém preso.\n\nAvaliar e religar com segurança. | Hoje, assim que possível | Portaria da Torre B; procurar o zelador',
  'V-11: o link leva o que fazer, quando e como entrar');
select is((select expira_em from l1), timestamptz '2027-03-11 00:00:00-03', 'V-11: vale até o fim do 7º dia');
select is((select arquivos from l1), '{}'::uuid[], 'PT-11: sem arquivos do pedido');
select is((select prazo_no_envio || ' ' || (reserva_no_envio = (select atlas from pr))::text from l1), '4 true',
  'MP-09: 4 horas e a reserva, esperando a mensagem sair');
select is((select responder_ate from l1), null, 'MP-09: antes de sair, não há prazo correndo');
select ok(not exists (select 1 from codigos_sem_conta where alvo_id = (select id from l1) and revogado_em is null),
  'V-11: nenhum código vale antes do envio');
create temp table e1 as select * from envios_whatsapp where pedido_id = (select id from p1) and finalidade = 'PRESTADOR';
select is((select para || ' · ' || modelo_chave || ' · ' || estado from e1), '+5561933334444 · link_prestador · NA_FILA',
  'W-20: o link sai pelo modelo do link do prestador');
select is((select texto from e1),
  E'O Residencial Ipê tem um serviço para Elevadores Sobe: Elevador parado (Elevador social da Torre B).\n\nVeja o que fazer e confirme até [ate]: [link]\n\nO link é só para este serviço e não precisa de conta.',
  'V-11: a mensagem diz o serviço e o local; o texto do pedido fica no link');
select is((select count(*)::int from envios_whatsapp where pedido_id = (select id from p1) and finalidade = 'AVISO_PRESTADOR'), 0,
  'V-11: com o link, o aviso só com texto não sai');
select is((select prestador_id from p1), (select sobe from pr), 'AT-26: o prestador fica ligado ao pedido');
select is((select jsonb_path_query_array(r, '$.avisos[*] ? (@.destino == "PRESTADOR").link.situacao') from x1), '["ESPERANDO_ENVIO"]'::jsonb,
  'V-11: a confirmação mostra o link esperando sair');
select is((select jsonb_path_query_first(r, '$.avisos[*] ? (@.destino == "PRESTADOR").link') - 'manutencaoId' from x1),
  '{"titulo": "Elevador parado", "estadoManutencao": "PLANEJADA", "situacao": "ESPERANDO_ENVIO", "horas": 4, "reserva": {"nome": "Atlas Manutenção"}}'::jsonb,
  'V-11: com a manutenção, o prazo e a reserva');
select ok(exists (select 1 from historico where acao = 'pedido.avisado' and entidade_id = (select id::text from p1)
                    and dados ->> 'link' = 'true' and dados ->> 'manutencao' = (select id::text from m1)),
  'AT-17: o aviso com link vai para o histórico do pedido');
select ok(exists (select 1 from historico where acao = 'pedido.manutencao_ligada' and entidade_id = (select id::text from p1)),
  'AT-17: e a manutenção ligada também');
select ok(exists (select 1 from historico where acao = 'manutencao.link_no_registro' and entidade_id = (select id::text from m1)
                    and dados ->> 'canal' = 'WHATSAPP' and dados ->> 'horas' = '4'),
  'AT-17: a manutenção registra o link mandado no registro');
select is((select plataforma_link_prestador(ana, ipe, (select id from m1)) -> 'link' ->> 'prazoNoEnvio' from ids, c), '4',
  'MP-09: a manutenção mostra que o prazo começa no envio');
select is((select plataforma_link_prestador(ana, ipe, (select id from m1)) -> 'link' -> 'noRegistro' ->> 'protocolo' from ids, c),
  (select protocolo from p1), 'V-11: e de que pedido veio');

-- Nada troca enquanto a mensagem não sai (decisão 8).
select ajustar_relogio(timestamptz '2027-03-03 20:00:00-03' - now());
select is(verificar_reservas(), 0, 'MP-09: na fila, sem prazo, nada troca');

-- A mensagem sai: o código nasce e o prazo começa.
create temp table lote as select x from jsonb_array_elements(whatsapp_pegar_lote(20)) l, jsonb_array_elements(l -> 'envios') x
  where x ->> 'envio' = (select id::text from e1);
select is((select x ->> 'texto' from lote),
  E'O Residencial Ipê tem um serviço para Elevadores Sobe: Elevador parado (Elevador social da Torre B).\n\nVeja o que fazer e confirme até 04/03, 00:00: [link]\n\nO link é só para este serviço e não precisa de conta.\n\nMensagem automática do condomínio.',
  'MP-09: a hora de confirmar é a da saída mais o prazo');
select is((select responder_ate from links_prestador where id = (select id from l1)), timestamptz '2027-03-04 00:00:00-03',
  'MP-09: o prazo começou na saída');
select is((select reserva_id from links_prestador where id = (select id from l1)), (select atlas from pr), 'MP-09: com a reserva');
select is((select x ->> 'rota' from lote), 'p', 'V-11: o link abre a página do prestador');
create temp table pg1 as select publico_prestador(x ->> 'link') as r from lote;
select is((select r ->> 'pedido' from pg1), (select protocolo from p1), 'V-11: a página mostra o número do pedido');
select is((select r ->> 'local' from pg1), 'Elevador social da Torre B', 'V-11: e o local');
select is((select jsonb_path_query_first(plataforma_pedido(ana, ipe, (select id from p1)), '$.avisosRegistro[*] ? (@.destino == "PRESTADOR").link.situacao')
             from ids, c), '"ESPERANDO"'::jsonb, 'V-11: o cartão do pedido mostra que espera a resposta');

-- Confirmar segura o principal e aparece no pedido.
select is(publico_prestador_confirmar(x ->> 'link') ->> 'resposta', 'CONFIRMOU', 'V-11: o prestador confirma pelo link') from lote;
select is((select jsonb_path_query_first(plataforma_pedido(ana, ipe, (select id from p1)), '$.avisosRegistro[*] ? (@.destino == "PRESTADOR").link.situacao')
             from ids, c), '"CONFIRMOU"'::jsonb, 'V-11: e o cartão do pedido mostra a confirmação');
select ajustar_relogio(timestamptz '2027-03-04 01:00:00-03' - now());
select is(verificar_reservas(), 0, 'MP-09: quem confirmou não é trocado');

-- 2. Sem resposta no prazo contado da saída, passa para a reserva (como na 0270).
create temp table x2 as select pg_temp.registrar(ana, 'Elevador de serviço', normal, 'Elevador fazendo barulho', false, v_gil,
  pg_temp.link(sobe, 'Barulho forte ao subir; avaliar os cabos.', '{"responderHoras": 8}')) as r from ids, cfg, vs, pr;
create temp table l2 as select l.* from links_prestador l join manutencoes m on m.id = l.manutencao_id where m.pedido_id = (select (r ->> 'id')::uuid from x2);
select is((select count(*)::int from jsonb_array_elements(whatsapp_pegar_lote(20)) l, jsonb_array_elements(l -> 'envios') x
            where (select link_prestador_id from envios_whatsapp where id = (x ->> 'envio')::uuid) = (select id from l2)), 1, 'V-11: a mensagem sai');
select ajustar_relogio(timestamptz '2027-03-04 09:05:00-03' - now());
select is(verificar_reservas(), 1, 'MP-09: sem resposta em 8 horas, passa para a reserva');
select is((select prestador_id from manutencoes where id = (select manutencao_id from l2)), (select atlas from pr), 'MP-09: a reserva executa');
select is((select jsonb_path_query_first(plataforma_pedido(ana, ipe, (select (r ->> 'id')::uuid from x2)),
                                         '$.avisosRegistro[*] ? (@.destino == "PRESTADOR").link.situacao') from ids, c, x2),
  '"PASSOU_RESERVA"'::jsonb, 'MP-09: o cartão do pedido mostra que passou para a reserva');

-- 3. Sem reserva (troca desligada no registro): o prazo vencido avisa o responsável no sino.
create temp table x3 as select pg_temp.registrar(ana, 'Elevador social da Torre B', normal, 'Botão do 5º andar', false, v_gil,
  pg_temp.link(sobe, 'Botão do 5º andar não acende; trocar.', '{"reserva": false, "responderHoras": 4}')) as r from ids, cfg, vs, pr;
create temp table l3 as select l.* from links_prestador l join manutencoes m on m.id = l.manutencao_id where m.pedido_id = (select (r ->> 'id')::uuid from x3);
select is((select reserva_no_envio from l3), null, 'MP-09: troca desligada no registro, sem reserva');
select is((select count(*)::int from jsonb_array_elements(whatsapp_pegar_lote(20)) l, jsonb_array_elements(l -> 'envios') x
            where (select link_prestador_id from envios_whatsapp where id = (x ->> 'envio')::uuid) = (select id from l3)), 1, 'V-11: a mensagem sai');
select ajustar_relogio(timestamptz '2027-03-04 13:10:00-03' - now());
select is(verificar_reservas(), 0, 'MP-09: sem reserva, ninguém é trocado');
select is((select count(*)::int from avisos_reserva a, ids where a.pessoa_id = gil and a.tipo = 'SEM_RESPOSTA' and a.link_id = (select id from l3)), 1,
  'MP-09: o responsável é avisado de que o prazo venceu sem resposta');
select ok((select bool_or(x ->> 'tipo' = 'TROCA_SEM_RESPOSTA') from ids, c, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x),
  'MP-09: no sino');
select is(verificar_reservas(), 0, 'MP-09: e uma vez só');
select is((select count(*)::int from avisos_reserva a where a.link_id = (select id from l3)), 1, 'MP-09: sem repetir o aviso');

-- 4. Por e-mail: o responsável do pedido não vê a manutenção; o código nasce ao montar o e-mail.
create temp table x4 as select pg_temp.registrar(bruna, 'Casa de bombas', normal, 'Bomba vazando', false, v_lia,
  pg_temp.link(hidraulica, 'Poça embaixo da bomba 2; trocar a vedação.')) as r from ids, cfg, vs, pr;
create temp table m4 as select * from manutencoes where pedido_id = (select (r ->> 'id')::uuid from x4);
select is((select responsavel_id from m4), (select v_bruna from vs), 'V-11: o responsável do pedido não vê a manutenção: fica com quem registra');
create temp table em4 as select * from envios_email where pedido_atendimento_id = (select (r ->> 'id')::uuid from x4);
select is((select tipo || ' ' || para || ' ' || (link_prestador_id is not null)::text from em4), 'PRESTADOR contato@hidraulica.com.br true',
  'V-11: sem celular, o link vai por e-mail');
create temp table mm4 as select montar_email(e) as r from envios_email e where e.id = (select id from em4);
select is((select r -> 'pedido' ->> 'responderAte' from mm4), '05/03, 13:10', 'MP-09: o prazo começa quando o e-mail é montado');
select is((publico_prestador(r -> 'pedido' ->> 'link') ->> 'para'), 'Hidráulica Lima', 'V-11: o código do e-mail abre o serviço') from mm4;

-- 5. Reenviar a falha do link leva o mesmo link (W-14).
create temp table x5 as select pg_temp.registrar(ana, 'Elevador social da Torre B', normal, 'Porta do elevador', false, v_gil,
  pg_temp.link(sobe, 'A porta não fecha direito no térreo.')) as r from ids, cfg, vs, pr;
create temp table e5 as select * from envios_whatsapp where pedido_id = (select (r ->> 'id')::uuid from x5) and finalidade = 'PRESTADOR';
update envios_whatsapp set estado = 'FALHOU', motivo = 'Número não tem WhatsApp' where id = (select id from e5);
select lives_ok($$ select plataforma_reenviar_whatsapp(ana, ipe, (select id from e5), 'Número corrigido no cadastro') from ids, c $$,
  'W-14: a falha do link pode ser reenviada');
select is((select link_prestador_id from envios_whatsapp where reenvio_de = (select id from e5)), (select link_prestador_id from e5),
  'W-14: com o mesmo link');

-- 6. Desmarcado, como no F6.4: só o texto, sem manutenção.
create temp table x6 as select pg_temp.registrar(bruna, 'Elevador social da Torre B', normal, 'Luz do elevador', false, v_gil,
  jsonb_build_object('quemPediu', false, 'prestador', jsonb_build_object('id', sobe, 'texto', 'Luz do elevador piscando.'))) as r from ids, cfg, vs, pr;
select is((select count(*)::int from manutencoes where pedido_id = (select (r ->> 'id')::uuid from x6)), 0, 'V-11: sem o link, nenhuma manutenção nasce');
select is((select modelo_chave from envios_whatsapp where pedido_id = (select (r ->> 'id')::uuid from x6)
             and finalidade = 'AVISO_PRESTADOR'), 'aviso_prestador', 'AT-26: e o prestador recebe só o texto');

select * from finish();
rollback;

-- Agenda (peça R7; AG-01 a AG-05, AG-07 a AG-09, MP-04): compromissos com tipo, situação,
-- repetição e conflito que avisa sem impedir; a agenda fica separada do atendimento e mostra
-- os feriados das configurações. Cada condomínio só vê a própria agenda.
begin;
select plan(52);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Carla') as carla,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['AGENDA', 'ATUALIZAR']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, carla, 'Carla', 'Conselho', array['ACOMPANHAR']) as v_carla,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_AGENDA']) as v_fabio
  from ids, c;
select plataforma_incluir_unidades(ana, ipe, null, '[{"identificacao": "101"}, {"identificacao": "102"}]') from ids, c;
create temp table un as select
  (select id from unidades where condominio_id = ipe and identificacao = '101') as u101
  from c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from compromissos where id = p $$;
-- Marca um compromisso simples, das horas dadas, com os participantes dados.
create function pg_temp.marcar(p_pessoa uuid, p_titulo text, p_data date, p_ini time, p_fim time, p_part uuid[],
                               p_onde text default 'NENHUM', p_local text default null, p_aceitar boolean default false)
returns uuid language sql as $$
  select (plataforma_marcar_compromisso(p_pessoa, (select ipe from c), 'REUNIAO', p_titulo, p_data, p_ini, p_fim, p_onde, null,
          p_local, p_part, null, null, null, 'PLANEJADO', null, null, null, null, p_aceitar) ->> 'id')::uuid $$;

-- Permissões (CF-03, AG-07).
select throws_ok($$ select plataforma_agenda(carla, ipe, hoje, hoje + 30) from ids, c, d $$, 'TC401', null,
  'quem não tem a permissão de ver a agenda não a vê');
select lives_ok($$ select plataforma_agenda(fabio, ipe, hoje, hoje + 30) from ids, c, d $$, 'Ver a agenda deixa ver');
select throws_ok($$ select pg_temp.marcar(fabio, 'Reunião', hoje + 1, '19:00', '20:00', '{}') from ids, d $$, 'TC401', null,
  'Ver a agenda não deixa marcar');
select throws_ok($$ select plataforma_agenda(davi, ipe, hoje, hoje + 30) from ids, c, d $$, 'TC401', null,
  'o síndico de outro condomínio não vê esta agenda');
select is((select plataforma_agenda(ana, ipe, hoje, hoje + 1) -> 'pode' ->> 'editar' from ids, c, d), 'true', 'a síndica cuida da agenda');
select is((select plataforma_agenda(fabio, ipe, hoje, hoje + 1) -> 'pode' ->> 'editar' from ids, c, d), 'false',
  'a tela sabe que o Fábio só vê');

-- Campos (AG-01).
select is(pg_temp.campos($$ select plataforma_marcar_compromisso(ana, ipe, 'FESTA', 'Festa', hoje, null, null, 'NENHUM', null, null,
  '{}', null, null, null, null, null, null, null, null, false) from ids, c, d $$), '["tipo"]'::jsonb, 'tipo: reunião, visita, atividade ou lembrete');
select is(pg_temp.campos($$ select pg_temp.marcar(ana, 'R', hoje, null, null, '{}') from ids, d $$), '["titulo"]'::jsonb,
  'título de 3 a 120 caracteres');
select is(pg_temp.campos($$ select pg_temp.marcar(ana, 'Reunião', hoje, '20:00', '19:00', '{}') from ids, d $$), '["horaFim"]'::jsonb,
  'o fim vem depois do início');
select is(pg_temp.campos($$ select pg_temp.marcar(ana, 'Reunião', hoje + 800, null, null, '{}') from ids, d $$), '["data"]'::jsonb,
  'a data fica em até dois anos à frente');
select is(pg_temp.campos($$ select pg_temp.marcar(ana, 'Reunião', hoje, null, null, array[v_davi]) from ids, d, vs $$), '["participantes"]'::jsonb,
  'participante é pessoa com acesso a este condomínio');
select is(pg_temp.campos($$ select pg_temp.marcar(ana, 'Reunião', hoje, null, null, '{}', 'AREA_COMUM') from ids, d $$), '["local"]'::jsonb,
  'área comum pede o nome do lugar');

-- Marcar e listar (AG-01, AG-02, AG-03).
create temp table k as select
  pg_temp.marcar(ana, 'Reunião do conselho', hoje + 2, '19:00', '21:00', array[v_ana, v_bruna], 'AREA_COMUM', 'Salão de festas') as conselho
  from ids, d, vs;
select is((select estado from compromissos, k where id = conselho), 'PLANEJADO', 'o compromisso nasce como planejado');
select is((select plataforma_agenda(fabio, ipe, hoje, hoje + 7) -> 'compromissos' -> 0 ->> 'lugar' from ids, c, d), 'Salão de festas',
  'aparece na agenda de quem vê, com o lugar');
select is((select jsonb_path_query_array(plataforma_agenda(fabio, ipe, hoje, hoje + 7), '$.compromissos[0].participantes[*].nome') from ids, c, d),
  '["Bruna", "Síndica Ana"]'::jsonb, 'com quem participa');
select is((select array_agg(acao order by acao) from historico, k where entidade = 'compromissos' and entidade_id = conselho::text),
  array['compromisso.marcado', 'estado.mudou'], 'marcar vai para o histórico, com a situação inicial');
select is(pg_temp.campos($$ select plataforma_agenda(ana, ipe, hoje, hoje + 120) from ids, c, d $$), '["de", "ate"]'::jsonb,
  'a agenda vem em períodos de até 93 dias');

-- Conflito avisa, não impede (AG-04).
select is((select pg_temp.erro($$ select pg_temp.marcar(bruna, 'Vistoria', (select hoje + 2 from d), '20:00', '20:30', array[(select v_bruna from vs)]) from ids $$)
   -> 'detalhe' ->> 'motivo'), 'CONFLITO_HORARIO', 'mesma pessoa no mesmo horário: avisa');
select is((select pg_temp.erro($$ select pg_temp.marcar(bruna, 'Vistoria', (select hoje + 2 from d), '20:00', '20:30', array[(select v_bruna from vs)]) from ids $$)
   -> 'detalhe' -> 'conflitos' -> 0 -> 'pessoas'), '["Bruna"]'::jsonb, 'e diz quem está nos dois');
select is((select pg_temp.erro($$ select pg_temp.marcar(ana, 'Ensaio', (select hoje + 2 from d), '18:00', '19:30', '{}', 'AREA_COMUM', ' salão de FESTAS ') from ids $$)
   -> 'detalhe' -> 'conflitos' -> 0 ->> 'motivo'), 'LUGAR', 'mesmo lugar no mesmo horário também avisa, sem ligar para maiúsculas');
select is((select pg_temp.erro($$ select pg_temp.marcar(ana, 'Ensaio', (select hoje + 2 from d), '21:00', '22:00', '{}', 'AREA_COMUM', 'Salão de festas') from ids $$)),
  null, 'um horário que só encosta no outro não conflita');
select is((select pg_temp.erro($$ select pg_temp.marcar(ana, 'Visita', (select hoje + 3 from d), '19:00', '20:00', array[(select v_bruna from vs)]) from ids $$)),
  null, 'outro dia não conflita');
select isnt((select pg_temp.marcar(bruna, 'Vistoria', hoje + 2, '20:00', '20:30', array[v_bruna], 'NENHUM', null, true) from ids, d, vs), null,
  'confirmando, salva mesmo com o conflito');
select is((select count(*)::integer from compromissos, d where data = hoje + 2), 3, 'com o conflito confirmado, os compromissos do dia ficam na agenda');

-- Repetição (AG-05).
create temp table r as select
  (plataforma_marcar_compromisso(ana, ipe, 'ATIVIDADE', 'Limpeza da caixa-d''água', hoje + 7, '08:00', '09:00', 'OUTRO', null, 'Cobertura',
     '{}', 'Hidro Serviços', null, null, 'PLANEJADO', 'SEMANAL', null, null, 4, false) ->> 'id')::uuid as caixa
  from ids, c, d;
select is((select count(*)::integer from compromissos where serie_id = (select serie_id from compromissos, r where id = caixa)), 4,
  'toda semana, 4 vezes: 4 datas na mesma série');
select is((select array_agg(to_char(x, 'MM-DD') order by x) from unnest(datas_da_repeticao('2027-01-31', 'MENSAL', 1, null, 3)) x),
  array['01-31', '02-28', '03-31'], 'todo mês: no mês sem o dia 31, fica o último dia');
select is((select cardinality(datas_da_repeticao('2027-01-04', 'SEMANAL', 1, '2030-01-01', null))), 105,
  'a repetição para em 2 anos');
select is(pg_temp.campos($$ select plataforma_marcar_compromisso(ana, ipe, 'ATIVIDADE', 'Jardim', hoje + 1, null, null, 'NENHUM', null, null,
  '{}', null, null, null, null, 'MENSAL', 6, (hoje + 1 + interval '3 years')::date, null, false) from ids, c, d $$), '["ate"]'::jsonb,
  'a data final fica em até 2 anos');
select is(pg_temp.campos($$ select plataforma_marcar_compromisso(ana, ipe, 'ATIVIDADE', 'Jardim', hoje + 1, null, null, 'NENHUM', null, null,
  '{}', null, null, null, null, 'SEMANAL', null, null, null, false) from ids, c, d $$), '["ate", "vezes"]'::jsonb,
  'repete até uma data ou por um número de vezes');

-- Mudar só esta data ou esta e as próximas (AG-05).
create temp table s as select
  (select id from compromissos, r where serie_id = (select serie_id from compromissos where id = caixa) order by data offset 1 limit 1) as segunda,
  (select id from compromissos, r where serie_id = (select serie_id from compromissos where id = caixa) order by data offset 2 limit 1) as terceira
  from r;
select plataforma_alterar_compromisso(ana, ipe, segunda, pg_temp.vc(segunda), 'ATIVIDADE', 'Limpeza com vistoria', '08:00', '10:00', 'OUTRO', null,
  'Cobertura', '{}', 'Hidro Serviços', null, null, 'ESTA', false) from ids, c, s;
select is((select array_agg(titulo order by data) from compromissos where serie_id = (select serie_id from compromissos, r where id = caixa)),
  array['Limpeza da caixa-d''água', 'Limpeza com vistoria', 'Limpeza da caixa-d''água', 'Limpeza da caixa-d''água'],
  'só esta data: as outras ficam como estavam');
select plataforma_alterar_compromisso(ana, ipe, terceira, pg_temp.vc(terceira), 'ATIVIDADE', 'Limpeza semestral', '08:00', '09:00', 'OUTRO', null,
  'Cobertura', '{}', 'Hidro Serviços', null, null, 'PROXIMAS', false) from ids, c, s;
select is((select array_agg(titulo order by data) from compromissos where serie_id = (select serie_id from compromissos, s where id = terceira)),
  array['Limpeza semestral', 'Limpeza semestral'], 'esta e as próximas ganham uma série nova');
select is((select count(*)::integer from compromissos where serie_id = (select serie_id from compromissos, r where id = caixa)), 2,
  'as datas anteriores ficam na série antiga, sem mudar');

-- Reagendar guarda a data anterior (AG-02).
select is(pg_temp.campos($$ select plataforma_reagendar_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), hoje + 5, '19:00', '21:00', '', 'ESTA', false)
  from ids, c, k, d $$), '["motivo"]'::jsonb, 'reagendar pede o motivo');
select plataforma_reagendar_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), hoje + 5, '19:00', '21:00', 'O salão estava reservado', 'ESTA', false)
  from ids, c, k, d;
select is((select data - (select hoje from d) from compromissos, k where id = conselho), 5, 'o compromisso vai para a nova data');
select is((select dados ->> 'de' from historico, k where entidade_id = conselho::text and acao = 'compromisso.reagendado'),
  (select to_char(hoje + 2, 'YYYY-MM-DD') from d), 'a data anterior fica no histórico');
select is((select dados ->> 'motivo' from historico, k where entidade_id = conselho::text and acao = 'compromisso.reagendado'),
  'O salão estava reservado', 'com o motivo');
select throws_ok($$ select plataforma_reagendar_compromisso(ana, ipe, conselho, pg_temp.vc(conselho) - 1, hoje + 6, '19:00', '21:00', 'Outra vez',
  'ESTA', false) from ids, c, k, d $$, 'TC409', null, 'AT-24: edição simultânea não passa por cima');
select plataforma_reagendar_compromisso(ana, ipe, terceira, pg_temp.vc(terceira), (select data + 7 from compromissos where id = terceira), '08:00', '09:00',
  'A empresa remarcou', 'PROXIMAS', false) from ids, c, s;
select is((select array_agg(data - (select hoje from d) order by data) from compromissos where serie_id = (select serie_id from compromissos, s where id = terceira)),
  array[28, 35], 'esta e as próximas andam juntas, os mesmos dias');

-- Situações (AG-02).
select is((select pg_temp.erro($$ select plataforma_situacao_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), 'REALIZADO') from ids, c, k $$)
   -> 'detalhe' ->> 'motivo'), 'AINDA_NAO_ACONTECEU', 'só é realizado no dia ou depois');
select plataforma_situacao_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), 'CONFIRMADO') from ids, c, k;
select is((select estado from compromissos, k where id = conselho), 'CONFIRMADO', 'a síndica confirma');
create temp table hj as select pg_temp.marcar(ana, 'Ronda do zelador', hoje, null, null, '{}') as ronda from ids, d;
select plataforma_situacao_compromisso(ana, ipe, ronda, pg_temp.vc(ronda), 'REALIZADO') from ids, c, hj;
select is((select pg_temp.erro($$ select plataforma_situacao_compromisso(ana, ipe, ronda, pg_temp.vc(ronda), 'PLANEJADO') from ids, c, hj $$)
   -> 'detalhe' ->> 'motivo'), 'COMPROMISSO_ENCERRADO', 'realizado não volta atrás');
select is(pg_temp.campos($$ select plataforma_cancelar_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), ' ', 'ESTA') from ids, c, k $$),
  '["motivo"]'::jsonb, 'cancelar pede o motivo');
select plataforma_cancelar_compromisso(ana, ipe, conselho, pg_temp.vc(conselho), 'O conselho adiou para o mês que vem', 'ESTA') from ids, c, k;
select is((select plataforma_agenda(ana, ipe, hoje, hoje + 7) -> 'compromissos' from ids, c, d) @> '[{"titulo": "Reunião do conselho", "estado": "CANCELADO"}]',
  true, 'o cancelado continua na agenda, marcado como cancelado');
select throws_ok($$ update compromissos set titulo = 'Outra' where id = (select ronda from hj) $$, 'TC422', null,
  'realizado e cancelado não mudam nem por baixo');
select throws_ok($$ delete from compromissos where id = (select ronda from hj) $$, 'TC010', null, 'nada se apaga');

-- Datas de outras telas (AG-09).
select plataforma_incluir_feriado(ana, ipe, hoje + 4, 'Feriado municipal') from ids, c, d;
-- Toda pessoa autorizada vê as configurações (0070); o feriado segue essa permissão.
select is((select plataforma_agenda(fabio, ipe, hoje, hoje + 7) -> 'datas' -> 0 ->> 'titulo' from ids, c, d), 'Feriado municipal',
  'o feriado das configurações aparece na agenda, com o nome');

-- Separada do atendimento (AG-08, MP-04).
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal
  from c;
create temp table p as select
  (plataforma_registrar_pedido(ana, ipe, u101, null, null, manutencao, normal, 'Vazamento no banheiro', 'Mancha de água no teto.',
     'TELEFONE', false, null) ->> 'id')::uuid as pedido
  from ids, c, cfg, un;
select plataforma_definir_previsao(ana, ipe, pedido, (select versao from pedidos where id = pedido), hoje + 3, null) from ids, c, p, d;
create temp table antes as select proximo_retorno, previsao, versao from pedidos, p where id = pedido;
select plataforma_marcar_compromisso(bruna, ipe, 'VISITA', 'Encanador no apto 101', hoje + 6, '14:00', '15:00', 'UNIDADE', u101, null,
  array[v_bruna], 'Hidro Serviços', pedido, null, 'CONFIRMADO', null, null, null, null, false) from ids, c, d, un, vs, p;
select is((select (proximo_retorno, previsao, versao)::text from pedidos, p where id = pedido), (select (proximo_retorno, previsao, versao)::text from antes),
  'marcar a visita não mexe no retorno nem na previsão do pedido');
select is((select plataforma_agenda_do_pedido(ana, ipe, pedido) -> 'divergencia' ->> 'previsao' from ids, c, p), (select to_char(hoje + 3, 'YYYY-MM-DD') from d),
  'a visita depois da previsão gera o aviso de datas diferentes');
select is((select jsonb_array_length(plataforma_agenda_do_pedido(ana, ipe, pedido) -> 'compromissos') from ids, c, p), 1,
  'o pedido mostra a visita ligada');
select is((select plataforma_agenda_do_pedido(carla, ipe, pedido) ->> 'podeVer' from ids, c, p), 'false',
  'quem vê o pedido mas não a agenda não vê os compromissos');
select is(pg_temp.campos($$ select plataforma_marcar_compromisso(ana, ipe, 'VISITA', 'Visita', hoje + 1, null, null, 'NENHUM', null, null,
  '{}', null, gen_random_uuid(), null, null, null, null, null, null, false) from ids, c, d $$), '["pedidoId"]'::jsonb,
  'só se liga um pedido que a pessoa enxerga');

-- Isolamento.
select throws_ok($$ select plataforma_compromisso(davi, jatoba, (select ronda from hj)) from ids, c $$, 'TC404', null,
  'outro condomínio não acha o compromisso');

select * from finish();
rollback;

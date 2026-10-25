-- Agenda da demonstração (0310, R17.6; CM-23; quadros 340 e 341): a disponibilidade e os bloqueios
-- da equipe, o link público com a grade de horários, o agendamento que cria ou junta o interessado
-- e o põe em Demonstração marcada, o horário que não aceita duas pessoas, o link da equipe, marcar
-- à mão, remarcar, a fila da confirmação e do lembrete (com e sem a chave), registrar como foi
-- (conversa e próximo passo), não compareceu, cancelar e a LGPD do agendamento.
begin;
select plan(74);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Daniel', 'COMERCIAL') as dan,
  teste.equipe('Fábio', 'FINANCEIRO') as fin;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.dv(p uuid) returns integer language sql as $$ select versao from demonstracoes_comercial where id = p $$;
-- O pedido do link, com o horário e o WhatsApp de cada teste.
create function pg_temp.pedido(p_inicio text, p_whatsapp text, p_email text default null) returns jsonb language sql as $$
  select jsonb_build_object('inicio', p_inicio, 'nome', 'Rita Dias', 'whatsapp', p_whatsapp,
                            'email', coalesce(p_email, 'rita' || right(p_whatsapp, 3) || '@exemplo.com.br'),
                            'condominio', 'Edifício Sucupira', 'faixa', 'DE_41_A_100', 'consentimento', true)
$$;
create function pg_temp.livre(p_codigo text, p_inicio timestamptz) returns boolean language sql as $$
  select (h ->> 'livre')::boolean from jsonb_array_elements(publico_agenda(p_codigo) -> 'dias') d, jsonb_array_elements(d -> 'horarios') h
   where (h ->> 'inicio')::timestamptz = p_inicio
$$;

-- Segunda-feira, 26/10/2026, 10h em Brasília.
select pg_temp.em('2026-10-26 10:00:00-03');

-- 1. A disponibilidade da equipe (quadro 341: 30 minutos, intervalo de 15, aviso de 1 dia útil).
select is(pg_temp.campos(format('select comercial_salvar_disponibilidade(%L, %L, null, %L)', (select com from ids), (select com from ids),
  '{"faixas": [{"dia": 2, "de": "12:00", "ate": "09:00"}]}')), '["faixas"]'::jsonb, 'a faixa começa antes de terminar');
select is(pg_temp.campos(format('select comercial_salvar_disponibilidade(%L, %L, null, %L)', (select com from ids), (select com from ids),
  '{"faixas": [], "salaUrl": "http://sala.exemplo.com"}')), '["faixas"]'::jsonb, 'o link da sala é https');
select throws_ok(format('select comercial_salvar_disponibilidade(%L, %L, null, ''{}'')', (select fin from ids), (select fin from ids)), 'TC401', null,
  'quem não é do Comercial não tem agenda');
select is(pg_temp.campos(format('select comercial_salvar_disponibilidade(%L, %L, null, ''{}'')', (select com from ids), (select fin from ids))),
  '["responsavelId"]'::jsonb, 'só quem tem o Comercial ou a Administração faz demonstração');
select is((select comercial_salvar_disponibilidade(com, com, null, '{"faixas": [{"dia": 1, "de": "09:00", "ate": "12:00"}, {"dia": 2, "de": "09:00", "ate": "12:00"},
  {"dia": 3, "de": "09:00", "ate": "12:00"}, {"dia": 4, "de": "09:00", "ate": "12:00"}, {"dia": 5, "de": "09:00", "ate": "12:00"},
  {"dia": 2, "de": "14:00", "ate": "16:00"}], "salaUrl": "https://meet.exemplo.com/triade-bianca"}') ->> 'versao' from ids), '1',
  'a Bianca cadastra os horários livres');
select is((select duracao_minutos || '/' || intervalo_minutos || '/' || aviso_dias_uteis || '/' || horizonte_dias from disponibilidade_comercial
            where pessoa_id = (select com from ids)), '30/15/1/14', 'com a duração, o intervalo, o aviso e o horizonte do quadro');
select is((teste.erro(format('select comercial_salvar_disponibilidade(%L, %L, null, ''{}'')', (select com from ids), (select com from ids))) ->> 'codigo'),
  'TC409', 'quem já tem agenda muda com a versão');

-- 2. O link: o mesmo ao copiar de novo; trocar revoga o anterior.
create temp table l as select comercial_link_agenda(com, com) ->> 'codigo' as bianca from ids;
select matches((select bianca from l), '^[a-z2-9]{12}$', 'o código do link tem 12 letras e números, sem os que se confundem');
select is((select comercial_link_agenda(com, com) ->> 'codigo' from ids), (select bianca from l), 'copiar de novo devolve o mesmo link');
create temp table l2 as select comercial_link_agenda(com, com, true) ->> 'codigo' as novo from ids;
select throws_ok(format('select publico_agenda(%L)', (select bianca from l)), 'TC404', null, 'o link trocado deixa de abrir');
update l set bianca = (select novo from l2);

-- 3. A página pública: os dias a partir do aviso, os horários e nada de quem está do outro lado.
create temp table ag as select publico_agenda(bianca) as r from l;
select is((select r -> 'dias' -> 0 ->> 'data' from ag), '2026-10-27', 'com aviso de 1 dia útil, a segunda mostra a partir da terça');
select is((select jsonb_agg(h ->> 'hora') from ag, jsonb_array_elements(r -> 'dias' -> 0 -> 'horarios') h),
  '["09:00", "09:45", "10:30", "11:15", "14:00", "14:45", "15:30"]'::jsonb, 'os horários de 30 minutos com 15 de intervalo');
select is((select r -> 'dias' -> -1 ->> 'data' from ag), '2026-11-09', 'até 14 dias à frente');
select ok((select r::text not like '%Bianca%' and r::text not like '%meet.exemplo%' from ag), 'a página não mostra quem atende nem o link da sala');
select is((select jsonb_array_length(r -> 'faixas') from ag), 5, 'as faixas de unidades vêm da Tabela');

-- 4. Bloqueio na agenda.
select comercial_bloquear_agenda(com, com, '2026-10-27 09:00-03', '2026-10-27 10:00-03', 'Reunião de equipe') from ids;
select is(array[pg_temp.livre(bianca, '2026-10-27 09:00-03'), pg_temp.livre(bianca, '2026-10-27 09:45-03'), pg_temp.livre(bianca, '2026-10-27 10:30-03')],
  array[false, false, true], 'o bloqueio risca os horários que encosta') from l;
select is(pg_temp.campos(format('select comercial_bloquear_agenda(%L, %L, ''2026-10-27 10:00-03'', ''2026-10-27 09:00-03'', null)', (select com from ids), (select com from ids))),
  '["de", "ate"]'::jsonb, 'o bloqueio vai de um horário a outro');

-- 5. Agendar pelo link: interessado novo em Demonstração marcada.
select is(pg_temp.campos(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-27 14:00-03', '5561999990701') - 'consentimento')),
  '["consentimento"]'::jsonb, 'agendar pede a autorização');
select is(pg_temp.campos(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-27 14:00-03', '5561999990701', 'sem-arroba'))),
  '["email"]'::jsonb, 'e um e-mail para a confirmação');
select is(pg_temp.motivo(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-27 14:10-03', '5561999990701'))),
  'HORARIO_OCUPADO', 'horário fora da grade não é marcado');
create temp table a1 as select publico_agendar(bianca, pg_temp.pedido('2026-10-27 14:00-03', '5561999990701')) as r from l;
select is((select r ->> 'quando' || ' · ' || (r ->> 'duracaoMinutos') from a1), 'terça, 27/10, 14:00 · 30', 'a confirmação na tela: dia, hora e duração');
create temp table d1 as select d.id, d.interessado_id as i from demonstracoes_comercial d where d.id = (select (r ->> 'id')::uuid from a1);
select is((select origem || ' · ' || origem_detalhe || ' · ' || etapa || ' · ' || (responsavel_id = (select com from ids))::text from interessados where id = (select i from d1)),
  'SITE · Agendamento pelo link · DEMO_MARCADA · true', 'o interessado novo entra com a origem e direto em Demonstração marcada, com a Bianca');
select is((select demonstracao_em || ' · ' || proximo_passo from interessados where id = (select i from d1)),
  '2026-10-27 17:00:00+00 · Demonstração · terça, 27/10, 14:00', 'com a data da demonstração e o próximo passo');
select is((select array_agg(coalesce(de, '-') || '>' || para order by criado_em, para desc) from etapas_interessado where interessado_id = (select i from d1)),
  array['->NOVO', 'NOVO>DEMO_MARCADA'], 'a mudança de etapa fica registrada');
select is((select cardinality(comercial_falta(x, 'DEMO_MARCADA')) from interessados x where x.id = (select i from d1)), 0, 'nada falta para a etapa');
select is((select base_legal || ' · ' || (optin_em is null)::text from interessados where id = (select i from d1)), 'CONSENTIMENTO · true',
  'a base é o consentimento; o WhatsApp continua sem opt-in');
select is((select array_agg(tipo || ' ' || to_char(enviar_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') order by enviar_em) from emails_comercial
            where demonstracao_id = (select id from d1)), array['CONFIRMACAO 26/10 10:00', 'LEMBRETE 27/10 08:00'],
  'a confirmação sai agora e o lembrete às 8h do dia');
select is(array[pg_temp.livre(bianca, '2026-10-27 14:00-03'), pg_temp.livre(bianca, '2026-10-27 14:45-03')], array[false, true],
  'o horário marcado fica riscado; o seguinte, depois do intervalo, continua livre') from l;
select is(pg_temp.motivo(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-27 14:00-03', '5561999990702'))),
  'HORARIO_OCUPADO', 'o mesmo horário não aceita outra pessoa');
select is(pg_temp.motivo(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-27 15:30-03', '5561999990701'))),
  'DEMONSTRACAO_MARCADA', 'quem já tem demonstração marcada não marca outra');
select throws_ok(format('insert into demonstracoes_comercial (interessado_id, pessoa_id, inicio, fim, origem) values (%L, %L, ''2026-10-27 14:15-03'', ''2026-10-27 14:45-03'', ''MAO'')',
  (select i from d1), (select com from ids)), '23P01', null, 'o banco não deixa duas demonstrações da mesma pessoa se sobreporem');

-- 6. Juntar no interessado que já existe.
create temp table j as select
  (comercial_criar(com, '{"condominio": "Edifício Angico", "pessoa": "Rui Lima", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990710"}') ->> 'id')::uuid as aberto,
  (comercial_criar(com, '{"condominio": "Edifício Baru", "pessoa": "Rui Lima", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990711"}') ->> 'id')::uuid as perdido,
  (comercial_criar(com, '{"condominio": "Edifício Caju", "pessoa": "Rui Lima", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990712"}') ->> 'id')::uuid as negociacao,
  (comercial_criar(com, '{"condominio": "Edifício Dendê", "pessoa": "Rui Lima", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990713"}') ->> 'id')::uuid as ganho
  from ids;
select comercial_mudar_etapa(com, perdido, (select versao from interessados where id = perdido), 'PERDIDO', 'FICOU_PARA_DEPOIS') from ids, j;
update interessados set etapa = 'NEGOCIACAO', faixa = 'DE_41_A_100' where id = (select negociacao from j);
update interessados set etapa = 'GANHO', faixa = 'DE_41_A_100', decisor = 'Conselho', decisao_em = '2026-10-01' where id = (select ganho from j);
create temp table aj as select
  (publico_agendar(bianca, pg_temp.pedido('2026-10-28 09:00-03', '5561999990710')) ->> 'id')::uuid as aberto,
  (publico_agendar(bianca, pg_temp.pedido('2026-10-28 09:45-03', '5561999990711')) ->> 'id')::uuid as perdido,
  (publico_agendar(bianca, pg_temp.pedido('2026-10-28 10:30-03', '5561999990712')) ->> 'id')::uuid as negociacao,
  (publico_agendar(bianca, pg_temp.pedido('2026-10-28 11:15-03', '5561999990713')) ->> 'id')::uuid as ganho
  from l;
select is((select x.etapa || ' · ' || coalesce(x.email, '-') from demonstracoes_comercial d join interessados x on x.id = d.interessado_id where d.id = (select aberto from aj)),
  'DEMO_MARCADA · rita710@exemplo.com.br', 'o aberto avança para Demonstração marcada e ganha o e-mail');
select is((select interessado_id from demonstracoes_comercial where id = (select aberto from aj)), (select aberto from j), 'no mesmo interessado (mesmo WhatsApp)');
select is((select c.resumo || ' · ' || c.respondeu from conversas_comercial c
            where c.interessado_id = (select aberto from j) and c.canal = 'ENTRADA' order by c.criado_em desc, c.resumo limit 1),
  'Agendou a demonstração pelo link: quarta, 28/10, 09:00 (Edifício Sucupira). · true', 'o agendamento vira conversa');
select is((select etapa || ' · ' || coalesce(motivo_perda, '-') from interessados where id = (select perdido from j)), 'DEMO_MARCADA · -',
  'o Perdido reabre em Demonstração marcada');
select is((select etapa from interessados where id = (select negociacao from j)), 'NEGOCIACAO', 'quem já passou da demonstração não volta de etapa');
select ok((select interessado_id <> (select ganho from j) from demonstracoes_comercial where id = (select ganho from aj)), 'o Ganho vira interessado novo');
select comercial_nao_contatar(com, '5561999990720', null, null, 'Pediu para não ligar') from ids;
select is(pg_temp.motivo(format('select publico_agendar(%L, %L)', (select bianca from l), pg_temp.pedido('2026-10-29 09:00-03', '5561999990720'))),
  'NAO_CONTATAR', 'quem está no não contatar não agenda');

-- 7. O link da equipe: o horário vai para quem está livre.
select comercial_salvar_disponibilidade(com, dan, null, '{"faixas": [{"dia": 2, "de": "14:00", "ate": "16:00"}]}') from ids;
create temp table le as select comercial_link_agenda(com, null) ->> 'codigo' as equipe from ids;
select ok(pg_temp.livre(equipe, '2026-10-27 14:00-03'), 'no link da equipe, o horário ocupado da Bianca está livre com o Daniel') from le;
create temp table ae as select publico_agendar(equipe, pg_temp.pedido('2026-10-27 14:00-03', '5561999990730')) as r from le;
select is((select pessoa_id from demonstracoes_comercial where id = (select (r ->> 'id')::uuid from ae)), (select dan from ids), 'e vai para o Daniel');
select is(pg_temp.livre(equipe, '2026-10-27 14:00-03'), false, 'com os dois ocupados, o horário fica riscado') from le;

-- 8. Marcar à mão, remarcar.
create temp table sd as select
  (comercial_criar(com, '{"condominio": "Edifício Embaúba", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990740",
                         "email": "embauba@exemplo.com.br"}') ->> 'id')::uuid as embauba,
  (comercial_criar(com, '{"condominio": "Edifício Figueira", "origem": "INDICACAO", "contatoAceito": true, "whatsapp": "5561999990741"}') ->> 'id')::uuid as figueira
  from ids;
create temp table m as select comercial_marcar_demonstracao(com, embauba, '{"inicio": "2026-10-30 17:00-03"}') as r from ids, sd;
select is((select r ->> 'origem' || ' · ' || (r -> 'interessado' ->> 'etapa') from m), 'MAO · DEMO_MARCADA', 'marcar à mão põe o interessado em Demonstração marcada');
select is(pg_temp.motivo(format('select comercial_marcar_demonstracao(%L, %L, %L)', (select com from ids), (select embauba from sd), '{"inicio": "2026-10-30 18:00-03"}')),
  'DEMONSTRACAO_MARCADA', 'à mão também: uma marcada de cada vez');
select is(pg_temp.motivo(format('select comercial_marcar_demonstracao(%L, %L, %L)', (select com from ids), (select ganho from j), '{"inicio": "2026-10-30 17:00-03"}')),
  'INTERESSADO_FECHADO', 'interessado Ganho não marca demonstração');
select is(pg_temp.motivo(format('select comercial_marcar_demonstracao(%L, %L, %L)', (select com from ids), (select figueira from sd), '{"inicio": "2026-10-28 09:15-03"}')),
  'HORARIO_OCUPADO', 'à mão, a mesma pessoa não faz duas ao mesmo tempo');
create temp table mm as select (r ->> 'id')::uuid as id from (select comercial_marcar_demonstracao(com, figueira, '{"inicio": "2026-10-30 16:00-03", "duracaoMinutos": 45}') as r
  from ids, sd) x;
select is((select origem || ' · ' || (fim - inicio)::text from demonstracoes_comercial where id = (select id from mm)), 'MAO · 00:45:00', 'marcada à mão, fora da grade, com a duração dada');
select is((select count(*)::integer from emails_comercial where demonstracao_id = (select id from mm)), 0, 'sem e-mail do interessado, nada vai para a fila');
create temp table rm as select comercial_remarcar_demonstracao(com, id, pg_temp.dv(id), '{"inicio": "2026-10-29 10:30-03"}') as r from ids, d1;
select is((select r ->> 'quando' || ' · ' || (r ->> 'remarcacoes') from rm), 'quinta, 29/10, 10:30 · 1', 'remarcar muda o horário e conta a vez');
select is((select array_agg(tipo || ':' || situacao order by tipo, situacao) from emails_comercial where demonstracao_id = (select id from d1)),
  array['CONFIRMACAO:CANCELADO', 'CONFIRMACAO:NA_FILA', 'LEMBRETE:CANCELADO', 'LEMBRETE:NA_FILA'], 'a fila troca a confirmação e o lembrete');
select is((select proximo_passo from interessados where id = (select i from d1)), 'Demonstração · quinta, 29/10, 10:30', 'o próximo passo acompanha');

-- 9. A fila do e-mail: pegar, resultado e sem a chave.
create temp table f as select comercial_emails_pegar(100) as r;
select ok((select jsonb_array_length(r) >= 5 from f) and (select bool_and(e ->> 'tipo' = 'CONFIRMACAO') from f, jsonb_array_elements(r) e),
  'a fila entrega as confirmações vencidas');
select is((select e ->> 'quando' || ' · ' || (e ->> 'salaUrl') || ' · ' || (e ->> 'remarcada') from f, jsonb_array_elements(r) e
            where (e ->> 'id')::uuid in (select id from emails_comercial where demonstracao_id = (select id from d1) and situacao = 'ENVIANDO')),
  'quinta, 29/10, 10:30 · https://meet.exemplo.com/triade-bianca · true', 'com o horário, o link da sala e o aviso de remarcada');
select ok((select not (r::text like '%5561999990%') from f), 'o WhatsApp não vai para o e-mail');
select comercial_email_resultado((e ->> 'id')::uuid, 're_' || n, null, false) from f, jsonb_array_elements(r) with ordinality x(e, n) where n = 1;
select comercial_email_resultado((e ->> 'id')::uuid, null, 'Resend respondeu 503', true) from f, jsonb_array_elements(r) with ordinality x(e, n) where n = 2;
select is((select array_agg(situacao order by situacao) from emails_comercial where id in (select (e ->> 'id')::uuid from f, jsonb_array_elements(r) with ordinality x(e, n) where n <= 2)),
  array['ENVIADO', 'NA_FILA'], 'enviado fica enviado; a falha passageira volta para a fila');
select is((select jsonb_array_length(comercial_emails_pegar(100))), 0, 'o que está sendo enviado não sai duas vezes');
select pg_temp.em('2026-10-26 10:20:00-03');
select ok((select comercial_emails_sem_chave() >= 1), 'sem a chave do Resend, a fila registra e não falha');
select is((select situacao from emails_comercial where id = (select (e ->> 'id')::uuid from f, jsonb_array_elements(r) with ordinality x(e, n) where n = 2)),
  'SEM_CHAVE', 'e o e-mail fica como "sem chave"');

-- 10. Registrar como foi, não compareceu e cancelar.
select is(pg_temp.motivo(format('select comercial_demonstracao_feita(%L, %L, %s, %L)', (select com from ids), (select id from d1), pg_temp.dv((select id from d1)),
  '{"resumo": "Gostou", "proximoPasso": "Mandar proposta", "proximoPassoData": "2026-10-30"}')), 'DEMONSTRACAO_FUTURA', 'antes da hora, não se registra como foi');
select pg_temp.em('2026-10-29 11:30:00-03');
select is(pg_temp.campos(format('select comercial_demonstracao_feita(%L, %L, %s, %L)', (select com from ids), (select id from d1), pg_temp.dv((select id from d1)),
  '{"resumo": "Gostou do mural"}')), '["proximoPasso", "proximoPassoData"]'::jsonb, 'registrar como foi pede o próximo passo');
select is(pg_temp.campos(format('select comercial_demonstracao_feita(%L, %L, %s, %L)', (select com from ids), (select id from d1), pg_temp.dv((select id from d1)),
  '{"proximoPasso": "Mandar proposta", "proximoPassoData": "2026-10-30"}')), '["resumo"]'::jsonb, 'e o resumo da conversa');
create temp table fe as select comercial_demonstracao_feita(com, id, pg_temp.dv(id), '{"resumo": "Gostou do mural e dos pedidos; quer ver o preço com o conselho.",
  "proximoPasso": "Mandar a proposta", "proximoPassoData": "2026-10-30", "proximoPassoHora": "10:00"}') as r from ids, d1;
select is((select r ->> 'situacao' from fe), 'FEITA', 'a demonstração fica feita');
select is((select etapa || ' · ' || proximo_passo || ' · ' || proximo_passo_data || ' ' || to_char(proximo_passo_hora, 'HH24:MI') from interessados where id = (select i from d1)),
  'DEMO_FEITA · Mandar a proposta · 2026-10-30 10:00', 'o interessado vai para Demonstração feita com o próximo passo');
select is((select canal || ' · ' || respondeu from conversas_comercial where interessado_id = (select i from d1) order by criado_em desc limit 1), 'DEMONSTRACAO · true',
  'e a conversa da demonstração registrada');
select is(pg_temp.motivo(format('select comercial_encerrar_demonstracao(%L, %L, %s, ''CANCELADA'', ''Teste'', false)', (select com from ids), (select id from d1),
  pg_temp.dv((select id from d1)))), 'DEMONSTRACAO_ENCERRADA', 'demonstração feita não muda');
select is((select comercial_encerrar_demonstracao(com, (r ->> 'id')::uuid, pg_temp.dv((r ->> 'id')::uuid), 'NAO_COMPARECEU', null, false) ->> 'situacao' from ids, ae),
  'NAO_COMPARECEU', 'não compareceu');
select is(pg_temp.campos(format('select comercial_encerrar_demonstracao(%L, %L, %s, ''CANCELADA'', null, true)', (select com from ids), (select (r ->> 'id')::uuid from m),
  pg_temp.dv((select (r ->> 'id')::uuid from m)))), '["motivo"]'::jsonb, 'cancelar pede o motivo');
select comercial_encerrar_demonstracao(com, (r ->> 'id')::uuid, pg_temp.dv((r ->> 'id')::uuid), 'CANCELADA', 'O síndico viajou', true) from ids, m;
select is((select array_agg(tipo || ':' || situacao order by criado_em, tipo) from emails_comercial where demonstracao_id = (select (r ->> 'id')::uuid from m)
              and situacao <> 'CANCELADO' and tipo <> 'CONFIRMACAO'),
  array['CANCELAMENTO:NA_FILA'], 'o cancelamento avisa por e-mail e tira o lembrete da fila');

-- 11. A agenda da equipe e a LGPD.
create temp table ae2 as select comercial_agenda(com) as r from ids;
select is((select jsonb_array_length(r -> 'disponibilidades') from ae2), 3, 'os horários livres de cada um da equipe (configurados ou não)');
select is((select jsonb_array_length(r -> 'proximas') || '/' || jsonb_array_length(r -> 'aRegistrar') || '/' || jsonb_array_length(r -> 'recentes') from ae2), '1/4/3',
  'as próximas, as que passaram sem registro e as encerradas há pouco');
select is((select r -> 'proximas' -> 0 -> 'com' ->> 'nome' from ae2), 'Bianca', 'com quem faz cada uma');
select comercial_excluir(adm, (select interessado_id from demonstracoes_comercial where id = (select aberto from aj))) from ids;
select is((select situacao || ' · ' || motivo from demonstracoes_comercial where id = (select aberto from aj)), 'CANCELADA · Dados apagados (LGPD)',
  'o pedido de exclusão cancela a demonstração marcada');
select is((select count(*)::integer from emails_comercial where demonstracao_id = (select aberto from aj) and para is not null), 0, 'e tira o e-mail da fila');
select pg_temp.em('2027-02-10 10:00:00-03');
select comercial_retencao_parceiros_agenda();
select is((select count(*)::integer from emails_comercial e join demonstracoes_comercial d on d.id = e.demonstracao_id
            where e.para is not null and d.fim < app_now() - interval '90 days'), 0, 'o e-mail do agendamento sai 90 dias depois da demonstração');
select ok((select count(*) > 0 from demonstracoes_comercial where situacao = 'FEITA'), 'ficam o horário e a situação');

select * from finish();
rollback;

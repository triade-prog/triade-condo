-- Mural do morador no conceito Janela acesa (D4.40; CD-17, CD-18, CD-12): o aviso com evento guarda
-- dia, hora e local em campos próprios, conferidos ao salvar; o mural e a ficha mostram o evento;
-- a correção leva o evento à versão nova; o edital da assembleia nasce com a data da primeira
-- chamada, as duas chamadas e o local. O relógio fica numa quarta-feira, 03/03/2027.
begin;
select plan(21);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe
  from ids;
select teste.vincular(ana, ipe) from ids, c;
update configuracao_condominio set comunicados_silencio_inicio = '00:00', comunicados_silencio_fim = '00:00';

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from comunicados where id = p $$;
create function pg_temp.va(p uuid) returns integer language sql as $$ select versao from assembleias where id = p $$;
create function pg_temp.escrever(p_titulo text, p_evento jsonb, p_acao text default 'PUBLICAR', p_assunto text default 'OBRAS') returns uuid
language sql as $$
  select (plataforma_salvar_comunicado((select ana from ids), (select ipe from c), null, null, p_assunto, p_titulo,
          'A Caesb vai trocar o registro da rua. Encha as caixas na véspera.', 'TODOS', '{}', '{}', '{}', null, null, p_acao, null,
          true, null, null, p_evento) ->> 'id')::uuid $$;
create function pg_temp.evento(p uuid) returns text language sql as $$
  select concat_ws(' ', evento_dia::text, evento_inicio::text, evento_fim::text, evento_local) from comunicados where id = p $$;
create temp table m as select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'],
                                                             false, null, false, false) ->> 'codigo' as cod from ids, c;

-- Salvar com o evento (CD-17).
create temp table cm as select
  pg_temp.escrever('Falta de água na quarta, 10/03', '{"dia": "2027-03-10", "inicio": "08:00", "fim": "14:00", "local": " Portaria "}') as agua,
  pg_temp.escrever('Coleta de recicláveis às quartas', null, 'PUBLICAR', 'LEMBRETE') as coleta,
  pg_temp.escrever('Festa junina no salão', '{"dia": "2027-06-12"}', 'RASCUNHO', 'AVISO') as festa;
select is(pg_temp.evento(agua), '2027-03-10 08:00:00 14:00:00 Portaria', 'CD-17: o dia, as horas e o local ficam em campos próprios, sem espaço sobrando') from cm;
select is(pg_temp.evento(coleta), '', 'CD-17: sem evento, os campos ficam vazios') from cm;
select is(pg_temp.evento(festa), '2027-06-12', 'CD-17: só o dia é obrigatório') from cm;
select is((select estado from comunicados, cm where id = agua), 'PUBLICADO', 'CD-17: publicar com evento publica como antes');

-- O que não serve é recusado com o nome do campo.
select is(pg_temp.campos($$ select pg_temp.escrever('Sem dia', '{"local": "Salão"}', 'RASCUNHO') $$), '["evento.dia"]'::jsonb,
  'CD-17: o evento pede o dia');
select is(pg_temp.campos($$ select pg_temp.escrever('Dia errado', '{"dia": "10/03/2027"}', 'RASCUNHO') $$), '["evento.dia"]'::jsonb,
  'CD-17: o dia vai como AAAA-MM-DD');
select is(pg_temp.campos($$ select pg_temp.escrever('Hora errada', '{"dia": "2027-03-10", "inicio": "8h"}', 'RASCUNHO') $$), '["evento.inicio"]'::jsonb,
  'CD-17: a hora vai como HH:MM');
select is(pg_temp.campos($$ select pg_temp.escrever('Fim antes', '{"dia": "2027-03-10", "inicio": "14:00", "fim": "08:00"}', 'RASCUNHO') $$), '["evento.fim"]'::jsonb,
  'CD-17: o fim vem depois do início');
select is(pg_temp.campos($$ select pg_temp.escrever('Fim sem início', '{"dia": "2027-03-10", "fim": "14:00"}', 'RASCUNHO') $$), '["evento.fim"]'::jsonb,
  'CD-17: o fim pede o início');
select is(pg_temp.campos($$ select pg_temp.escrever('Local curto', '{"dia": "2027-03-10", "local": "S"}', 'RASCUNHO') $$), '["evento.local"]'::jsonb,
  'CD-17: o local tem de 2 a 120 letras');
select throws_ok($$ update comunicados set evento_fim = '07:00' where id = (select festa from cm) $$, '23514', null,
  'CD-17: o banco também recusa fim sem início (no publicado, o evento nem muda: 0314)');

-- O rascunho que perde o evento fica sem ele.
select plataforma_salvar_comunicado(ana, ipe, festa, pg_temp.vc(festa), 'AVISO', 'Festa junina no salão', 'Traga um prato.', 'TODOS', '{}', '{}', '{}',
                                    null, null, 'RASCUNHO', null, true, null, null, null) from ids, c, cm;
select is(pg_temp.evento(festa), '', 'CD-17: salvar sem evento tira o dia do rascunho') from cm;

-- O mural e a ficha mostram o evento (CD-12).
select is((select e -> 'evento' from m, jsonb_array_elements(publico_mural(cod) -> 'comunicados') e where e ->> 'id' = (select agua::text from cm)),
  '{"dia": "2027-03-10", "fim": "14:00", "local": "Portaria", "inicio": "08:00"}'::jsonb, 'CD-12: o mural leva o evento do aviso');
select ok((select not (e ? 'evento') from m, jsonb_array_elements(publico_mural(cod) -> 'comunicados') e where e ->> 'id' = (select coleta::text from cm)),
  'CD-12: o aviso sem evento não leva a chave');
select is((select plataforma_comunicado(ana, ipe, agua) -> 'comunicado' -> 'evento' ->> 'local' from ids, c, cm), 'Portaria',
  'CD-17: a ficha do painel mostra o evento');

-- Corrigir leva o evento à versão nova (CD-01).
create temp table v2 as select (plataforma_corrigir_comunicado(ana, ipe, agua, pg_temp.vc(agua), 'Falta de água na quarta, 10/03, das 8h às 15h',
  'A Caesb vai trocar o registro da rua. Agora até as 15h.', 'A hora do fim mudou') ->> 'id')::uuid as agua2 from ids, c, cm;
select is(pg_temp.evento(agua2), '2027-03-10 08:00:00 14:00:00 Portaria', 'CD-17: a versão corrigida herda o evento') from v2;
select is((select count(*)::integer from m, jsonb_array_elements(publico_mural(cod) -> 'comunicados') e where e ? 'evento'), 1,
  'CD-12: no mural só a versão em uso, com o evento');

-- O edital da assembleia nasce com a data, as chamadas e o local (AC-02, CD-17).
create temp table aa as select (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "AGO de abril", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
  "primeiraChamada": "2027-04-10T19:00:00-03:00", "segundaChamada": "2027-04-10T19:30:00-03:00", "local": "Salão de festas",
  "itens": [{"titulo": "Aprovar as contas de 2026", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as ag from ids, c;
create temp table conv as select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) as r from ids, c, aa;
select is((select assunto || ' ' || estado from comunicados, conv where id = (r ->> 'comunicadoId')::uuid), 'ASSEMBLEIA PUBLICADO',
  'AC-02: o edital continua saindo como comunicado publicado');
select is(pg_temp.evento((r ->> 'comunicadoId')::uuid), '2027-04-10 19:00:00 19:30:00 Salão de festas',
  'CD-17: o edital leva o dia, a 1ª e a 2ª chamada e o local no fuso do condomínio') from conv;
select is((select e -> 'evento' ->> 'inicio' from m, conv, jsonb_array_elements(publico_mural(cod) -> 'comunicados') e where e ->> 'id' = r ->> 'comunicadoId'),
  '19:00', 'CD-12: o mural mostra a hora da primeira chamada');

-- Online: sem local, o edital diz que é pelo link pessoal; a segunda chamada em outro dia não vira fim.
create temp table ao as select (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "AGE online", "tipo": "EXTRAORDINARIA", "forma": "ONLINE",
  "primeiraChamada": "2027-05-05T20:00:00-03:00", "segundaChamada": "2027-05-06T20:00:00-03:00", "linkVideo": "https://meet.exemplo.invalid/ipe",
  "itens": [{"titulo": "Trocar o portão", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as ag from ids, c;
create temp table convo as select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) as r from ids, c, ao;
select is(pg_temp.evento((r ->> 'comunicadoId')::uuid), '2027-05-05 20:00:00 Videochamada pelo link pessoal',
  'CD-17: online, o local é o link pessoal e a 2ª chamada de outro dia não vira fim') from convo;

select * from finish();
rollback;

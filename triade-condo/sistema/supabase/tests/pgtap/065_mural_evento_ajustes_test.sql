-- Ajustes do evento no aviso (D4.40; CD-17, CD-18), da 0314: a assembleia cancelada sai do
-- destaque e da agenda; o evento se corrige na versão nova e não muda no publicado fora dela; o
-- evento para a agenda sai pelo mural, pelo link pessoal e pelo painel, com o fuso, sem contar
-- abertura. O relógio fica numa quarta-feira, 03/03/2027.
begin;
select plan(18);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruno, de fora') as bruno;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe
  from ids;
select teste.vincular(ana, ipe) from ids, c;
update configuracao_condominio set comunicados_silencio_inicio = '00:00', comunicados_silencio_fim = '00:00';

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from comunicados where id = p $$;
create function pg_temp.va(p uuid) returns integer language sql as $$ select versao from assembleias where id = p $$;
create function pg_temp.escrever(p_titulo text, p_evento jsonb) returns uuid
language sql as $$
  select (plataforma_salvar_comunicado((select ana from ids), (select ipe from c), null, null, 'OBRAS', p_titulo,
          'A Caesb vai trocar o registro da rua. Encha as caixas na véspera.', 'TODOS', '{}', '{}', '{}', null, null, 'PUBLICAR', null,
          true, null, null, p_evento) ->> 'id')::uuid $$;
create function pg_temp.evento(p uuid) returns text language sql as $$
  select concat_ws(' ', evento_dia::text, evento_inicio::text, evento_fim::text, evento_local) from comunicados where id = p $$;
create function pg_temp.corrigir(p uuid, p_mudar boolean, p_evento jsonb) returns uuid language sql as $$
  select (plataforma_corrigir_comunicado((select ana from ids), (select ipe from c), p, pg_temp.vc(p), 'Falta de água, nova data',
          'A Caesb mudou a data. ' || md5(random()::text), 'A data mudou', false, false, p_mudar, p_evento) ->> 'id')::uuid $$;
create temp table m as select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'],
                                                             false, null, false, false) ->> 'codigo' as cod from ids, c;
create function pg_temp.no_mural(p uuid) returns jsonb language sql as $$
  select e from m, jsonb_array_elements(publico_mural(cod) -> 'comunicados') e where e ->> 'id' = p::text $$;

-- 2. O evento se corrige na versão nova (CD-01, CD-17).
create temp table cm as select pg_temp.escrever('Falta de água na quarta, 10/03', '{"dia": "2027-03-10", "inicio": "08:00", "fim": "14:00", "local": "Portaria"}') as agua;
select throws_ok($$ update comunicados set evento_dia = '2027-03-11' where id = (select agua from cm) $$, 'TC422', null,
  'CD-01: no publicado, o evento não muda fora da correção');
create temp table v2 as select pg_temp.corrigir(agua, false, null) as agua2 from cm;
select is(pg_temp.evento(agua2), '2027-03-10 08:00:00 14:00:00 Portaria', 'CD-17: corrigir sem mandar o evento herda o da versão anterior') from v2;
create temp table v3 as select pg_temp.corrigir(agua2, true, '{"dia": "2027-03-11", "inicio": "09:00", "local": "Portaria"}') as agua3 from v2;
select is(pg_temp.evento(agua3), '2027-03-11 09:00:00 Portaria', 'CD-17: corrigir com o evento novo muda o dia na versão nova') from v3;
select is(pg_temp.evento(agua2), '2027-03-10 08:00:00 14:00:00 Portaria', 'CD-01: a versão anterior fica como estava') from v2;
select is(pg_temp.no_mural(agua3) -> 'evento' ->> 'dia', '2027-03-11', 'CD-12: o mural mostra o dia corrigido') from v3;
create temp table v4 as select pg_temp.corrigir(agua3, true, null) as agua4 from v3;
select is(pg_temp.evento(agua4), '', 'CD-17: corrigir mandando nenhum evento tira o dia') from v4;
select is(pg_temp.campos($$ select pg_temp.corrigir((select agua4 from v4), true, '{"dia": "2027-03-11", "fim": "10:00"}') $$), '["evento.fim"]'::jsonb,
  'CD-17: na correção, o evento é conferido como ao escrever');
select is(pg_temp.evento(agua4), '', 'CD-17: a correção recusada não muda nada') from v4;

-- 3. O evento para a agenda (CD-18): mural, link pessoal e painel.
create temp table v5 as select pg_temp.corrigir(agua4, true, '{"dia": "2027-03-12", "inicio": "08:00", "fim": "12:00", "local": "Portaria"}') as agua5 from v4;
select is((select publico_mural_agenda(cod, agua5) - 'texto' from m, v5),
  jsonb_build_object('id', (select agua5 from v5), 'assunto', 'OBRAS', 'titulo', 'Falta de água, nova data', 'condominio', 'Residencial Ipê',
                     'fuso', 'America/Sao_Paulo', 'evento', '{"dia": "2027-03-12", "inicio": "08:00", "fim": "12:00", "local": "Portaria"}'::jsonb),
  'CD-18: pelo mural, o aviso, o evento, o condomínio e o fuso');
create temp table ab as select count(*)::integer as n from mural_aberturas;
select publico_mural_agenda(cod, agua5) from m, v5;
select is((select count(*)::integer from mural_aberturas), (select n from ab), 'CD-12: baixar a agenda não conta abertura do mural');
select is(teste.erro($$ select publico_mural_agenda((select cod from m), (select agua from cm)) $$) ->> 'codigo', 'TC404',
  'CD-18: a versão substituída não sai pelo mural');
select is((select plataforma_comunicado_agenda(ana, ipe, agua5) -> 'evento' ->> 'dia' from ids, c, v5), '2027-03-12',
  'CD-15: a prévia do painel também baixa a agenda');
select is(teste.erro($$ select plataforma_comunicado_agenda((select bruno from ids), (select ipe from c), (select agua5 from v5)) $$) ->> 'codigo', 'TC401',
  'CD-15: quem não é do condomínio não baixa pelo painel');
create temp table sem as select pg_temp.escrever('Coleta às quartas', null) as coleta;
select is(teste.erro($$ select publico_mural_agenda((select cod from m), (select coleta from sem)) $$) ->> 'codigo', 'TC404',
  'CD-18: o aviso sem evento não tem agenda');

-- 1. A assembleia cancelada sai do destaque e da agenda.
create temp table aa as select (plataforma_salvar_assembleia(ana, ipe, null, null, '{"titulo": "AGO de abril", "tipo": "ORDINARIA", "forma": "PRESENCIAL",
  "primeiraChamada": "2027-04-10T19:00:00-03:00", "segundaChamada": "2027-04-10T19:30:00-03:00", "local": "Salão de festas",
  "itens": [{"titulo": "Aprovar as contas de 2026", "tipo": "APROVACAO", "quorum": "MAIORIA_PRESENTES"}]}') ->> 'id')::uuid as ag from ids, c;
create temp table conv as select plataforma_convocar_assembleia(ana, ipe, ag, pg_temp.va(ag)) as r from ids, c, aa;
select is(pg_temp.evento((r ->> 'comunicadoId')::uuid), '2027-04-10 19:00:00 19:30:00 Salão de festas',
  'CD-17: o edital continua nascendo com o evento, mesmo com o publicado travado') from conv;
select is(pg_temp.campos($$ select pg_temp.corrigir((select (r ->> 'comunicadoId')::uuid from conv), true, '{"dia": "2027-04-11"}') $$), '["evento"]'::jsonb,
  'AC-02: o dia do edital muda só na própria assembleia');
select plataforma_cancelar_assembleia(ana, ipe, ag, pg_temp.va(ag), 'Falta de quórum previsto') from ids, c, aa;
select is((select pg_temp.no_mural((r ->> 'comunicadoId')::uuid) - 'texto' - 'arquivos' - 'publicadoEm' - 'id' from conv),
  jsonb_build_object('assunto', 'ASSEMBLEIA', 'titulo', 'Edital: AGO de abril', 'numero', 1, 'assembleiaCancelada', true),
  'CD-17: cancelada, o edital fica no mural sem o evento e avisa que foi cancelada');
select is(teste.erro($$ select publico_mural_agenda((select cod from m), (select (r ->> 'comunicadoId')::uuid from conv)) $$) ->> 'codigo', 'TC404',
  'CD-18: a assembleia cancelada não vai mais para a agenda');

select * from finish();
rollback;

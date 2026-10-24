-- Enquetes abertas na Agenda (R7.2; AG-09). A síndica abre três enquetes: uma secreta que fecha
-- em março, à noite, uma que fecha em maio, fora do mês, e uma que ela encerra antes do prazo. A
-- Agenda de março mostra a secreta no dia e na hora em que fecha, com quantos responderam; a faixa
-- das abertas traz as duas que seguem abertas. Só quem vê as enquetes vê alguma coisa.
-- O relógio começa numa segunda-feira, 01/03/2027, às 09:00.
begin;
select plan(14);

select ajustar_relogio(timestamptz '2027-03-01 09:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['VER_AGENDA', 'VER_ENQUETES']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Zelador', array['VER_AGENDA']) as v_fabio
  from ids, c;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "201"}]') from ids, c, bl;

create function pg_temp.criar(p_dados jsonb) returns uuid language sql as $$
  select (plataforma_criar_enquete((select ana from ids), (select ipe from c), p_dados) ->> 'id')::uuid $$;
create function pg_temp.agenda(p_pessoa uuid) returns jsonb language sql as $$
  select plataforma_agenda(p_pessoa, (select ipe from c), '2027-03-01', '2027-03-31') $$;
create function pg_temp.enquetes(p_pessoa uuid) returns jsonb language sql as $$
  select coalesce(jsonb_agg(d), '[]'::jsonb) from jsonb_array_elements(pg_temp.agenda(p_pessoa) -> 'datas') d where d ->> 'fonte' = 'ENQUETE' $$;

create temp table q as select
  pg_temp.criar('{"pergunta": "Qual horário para a academia aos domingos?", "opcoes": ["Das 8h às 20h", "Das 6h às 22h"], "por": "UNIDADE",
    "secreta": true, "abertaAte": "2027-03-08T22:30:00-03:00", "canais": ["MURAL"]}') as academia,
  pg_temp.criar('{"pergunta": "Que cor para a pintura da fachada?", "opcoes": ["Cinza", "Areia"], "por": "UNIDADE",
    "secreta": false, "abertaAte": "2027-05-20T23:59:00-03:00", "canais": ["MURAL"]}') as fachada,
  pg_temp.criar('{"pergunta": "Pode trocar o portão em março?", "opcoes": ["Sim", "Não"], "por": "UNIDADE",
    "secreta": false, "abertaAte": "2027-03-15T18:00:00-03:00", "canais": ["MURAL"]}') as portao;

-- Duas unidades respondem a secreta pelo link pessoal.
select publico_responder_enquete(plataforma_link_enquete(ana, ipe, academia, ce.id) ->> 'codigo', 1)
  from ids, c, q, convites_enquete ce join unidades u on u.id = ce.unidade_id
 where ce.enquete_id = academia and u.identificacao in ('101', '102');
select plataforma_encerrar_enquete(ana, ipe, portao, (select versao from enquetes where id = portao)) from ids, c, q;

-- No dia e na hora em que fecha (decisão A.1).
select is((select jsonb_array_length(pg_temp.enquetes(ana)) from ids), 1, 'R7.2: em março, só a enquete aberta que fecha em março');
select is((select (pg_temp.enquetes(ana) -> 0) - 'id' from ids),
  '{"data": "2027-03-08", "titulo": "Qual horário para a academia aos domingos?", "fonte": "ENQUETE", "horaInicio": "22:30",
    "por": "UNIDADE", "secreta": true, "responderam": 2, "total": 3}'::jsonb,
  'R7.2: a enquete entra no dia e na hora em que fecha, com quantos responderam de quantos');
select is((select pg_temp.enquetes(ana) -> 0 ->> 'id' from ids, q), (select academia::text from q), 'R7.2: a data leva à ficha da enquete');
select ok((select not (pg_temp.enquetes(ana) -> 0 ?| array['opcoes', 'resultado', 'escolha']) from ids),
  'R7.2: na secreta, a Agenda traz só a contagem, nunca o que se escolheu');

-- A faixa das abertas (decisão A.1).
select is((select jsonb_agg(x ->> 'titulo') from ids, jsonb_array_elements(pg_temp.agenda(ana) -> 'enquetesAbertas') x),
  '["Qual horário para a academia aos domingos?", "Que cor para a pintura da fachada?"]'::jsonb,
  'R7.2: a faixa traz todas as abertas, pela data em que fecham, mesmo a que fecha fora do período');
select is((select pg_temp.agenda(ana) -> 'enquetesAbertas' -> 1 ->> 'data' from ids), '2027-05-20', 'R7.2: com a data em que fecha');

-- Encerrada antes do prazo (decisão C.1).
select ok((select not exists (select 1 from ids, jsonb_array_elements(pg_temp.agenda(ana) -> 'enquetesAbertas') x where x ->> 'titulo' like 'Pode trocar%')),
  'R7.2: a encerrada antes do prazo sai da faixa');
select ok((select not exists (select 1 from ids, jsonb_array_elements(pg_temp.agenda(ana) -> 'datas') x where x ->> 'titulo' like 'Pode trocar%')),
  'R7.2: e do dia em que fecharia');

-- Permissões.
select is((select jsonb_array_length(pg_temp.enquetes(bruna)) from ids), 1, 'R7.2: quem vê as enquetes vê a data');
select is((select pg_temp.agenda(bruna) -> 'pode' ->> 'enquetes' from ids), 'true', 'R7.2: e a Agenda diz que pode ver as enquetes');
select is((select jsonb_array_length(pg_temp.enquetes(fabio)) from ids), 0, 'R7.2: quem só vê a agenda não vê a enquete');
select is((select pg_temp.agenda(fabio) -> 'enquetesAbertas' from ids), '[]'::jsonb, 'R7.2: nem a faixa');
select is((select pg_temp.agenda(fabio) -> 'pode' ->> 'enquetes' from ids), 'false', 'R7.2: e o filtro Enquetes não aparece');

-- Passado o prazo, ela fecha e sai.
select ajustar_relogio(timestamptz '2027-03-08 22:31:00-03' - now());
select is((select jsonb_array_length(pg_temp.enquetes(ana)) from ids), 0, 'R7.2: depois do prazo, a enquete sai da Agenda');

select * from finish();
rollback;

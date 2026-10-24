-- Comunicação e vida com banco (0293; CD-01, AC-03, AC-05): o período nos Filtros dos comunicados
-- (decisão C.1), quem fica sem o link da enquete (decisão C.2) e o tipo mudado ao revisar o anúncio.
-- O relógio anda por fevereiro e março de 2027.
begin;
select plan(19);

select ajustar_relogio(timestamptz '2027-02-01 10:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Fábio') as fabio;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_AGENDA']) as v_fabio
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103;
-- 101: Marta com WhatsApp e e-mail. 102: Rui só com e-mail (pediu para parar o WhatsApp). 103: ninguém.
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui
  from ids, c, u;
update contatos set email = 'marta@exemplo.com.br', email_situacao = 'CONFIRMADO', email_comunicados = true where nome = 'Marta Souza';
update contatos set email = 'rui@exemplo.com.br', email_situacao = 'CONFIRMADO', email_comunicados = true, whatsapp_parou_em = app_now()
 where nome = 'Rui Lima';

-- ---------------------------------------------------------------------------------------
-- 1. O período nos comunicados.
create function pg_temp.escrever(p_titulo text) returns uuid language sql as $$
  select (plataforma_salvar_comunicado((select ana from ids), (select ipe from c), null, null, 'AVISO', p_titulo,
          'A água será desligada das 9h às 13h para a troca da bomba.', 'TODOS', '{}', '{}', '{}', null, null, 'RASCUNHO', null) ->> 'id')::uuid $$;
create function pg_temp.lista(p_filtro text, p_de date, p_ate date) returns jsonb language sql as $$
  select plataforma_comunicados((select ana from ids), (select ipe from c), p_filtro, null, null, null, 1, p_de, p_ate) $$;
create function pg_temp.titulos(p jsonb) returns text language sql as $$
  select string_agg(x ->> 'titulo', ', ' order by x ->> 'titulo') from jsonb_array_elements(p -> 'itens') x $$;

select pg_temp.escrever('Limpeza da caixa d''água');
select ajustar_relogio(timestamptz '2027-02-20 10:00:00-03' - now());
select pg_temp.escrever('Pintura da fachada');
select ajustar_relogio(timestamptz '2027-03-03 23:30:00-03' - now());
select pg_temp.escrever('Troca da bomba');

select is(pg_temp.titulos(pg_temp.lista('RASCUNHO', null, null)), 'Limpeza da caixa d''água, Pintura da fachada, Troca da bomba',
  'CD-01: sem período, a aba traz tudo');
select is(pg_temp.titulos(pg_temp.lista('RASCUNHO', '2027-02-15', null)), 'Pintura da fachada, Troca da bomba',
  'decisão C.1: De deixa de fora o que veio antes');
select is(pg_temp.titulos(pg_temp.lista('RASCUNHO', '2027-02-01', '2027-02-28')), 'Limpeza da caixa d''água, Pintura da fachada',
  'decisão C.1: De e Até juntos fecham o período');
select is(pg_temp.titulos(pg_temp.lista('RASCUNHO', null, '2027-03-03')), 'Limpeza da caixa d''água, Pintura da fachada, Troca da bomba',
  'decisão C.1: o dia é o do condomínio (23h30 de 03/03 em Brasília ainda é 03/03)');
select is((pg_temp.lista('RASCUNHO', '2027-02-15', '2027-02-28') ->> 'total')::integer, 1, 'decisão C.1: o total conta com o período');
select is((pg_temp.lista('PROGRAMADO', '2027-02-01', '2027-02-28') ->> 'total')::integer, 0, 'decisão C.1: o período vale em todas as abas');
select is(pg_temp.campos($$ select pg_temp.lista('RASCUNHO', '2027-03-01', '2027-02-01') $$), '["ate"]',
  'decisão C.1: o fim do período não vem antes do começo');
select is((select plataforma_comunicados(ana, ipe, 'RASCUNHO', null, null, null, 1) ->> 'total' from ids, c)::integer, 3,
  'CD-01: quem chama sem o período continua como antes');

-- ---------------------------------------------------------------------------------------
-- 2. Quem fica sem o link da enquete.
create temp table eq as select plataforma_enquetes(ana, ipe) as v from ids, c;
select is((select (v ->> 'unidades')::integer from eq), 3, 'AC-03: a aba conta as unidades');
select is((select (v ->> 'pessoas')::integer from eq), 2, 'AC-03: e as pessoas com vínculo confirmado');
select is((select jsonb_agg(x - 'id') from eq, jsonb_array_elements(v -> 'semCanal' -> 'unidades') x),
  '[{"nome": "Torre A · 102", "email": true, "whatsapp": false}, {"nome": "Torre A · 103", "email": false, "whatsapp": false}]'::jsonb,
  'decisão C.2: a lista traz as unidades a que falta WhatsApp ou e-mail, com o que cada uma tem');
select ok((select bool_and(x ? 'id') from eq, jsonb_array_elements(v -> 'semCanal' -> 'unidades') x), 'decisão C.2: cada unidade vem com o id');
select is((select string_agg(x ->> 'nome', ', ' order by x ->> 'nome') from eq, jsonb_array_elements(v -> 'semCanal' -> 'pessoas') x
            where not (x ->> 'whatsapp')::boolean), 'Rui Lima', 'decisão C.2: por pessoa, quem não recebe pelo WhatsApp');
select throws_ok($$ select plataforma_enquetes(adm, ipe) from ids, c $$, 'TC401', null, 'quem não entra no condomínio não vê as enquetes');

-- ---------------------------------------------------------------------------------------
-- 3. O tipo do anúncio na revisão.
insert into classificados (condominio_id, contato_id, unidade_id, tipo, texto, mostrar_telefone)
select ipe, (select id from contatos where nome = 'Marta Souza'), u101, 'VENDO', 'Doo um berço em bom estado, é só buscar', false from c, u;
create temp table an as select id, versao from classificados;
select is((select plataforma_publicar_classificado(ana, ipe, an.id, an.versao, 'Doo berço', null, 'DOO') ->> 'tipo' from ids, c, an), 'DOO',
  'AC-05: ao publicar, o tipo pode mudar');
select is((select dados from historico where acao = 'classificado.publicado') ->> 'tipoAntes', 'VENDO', 'AC-05: e a troca fica no histórico');

insert into classificados (condominio_id, contato_id, unidade_id, tipo, texto, mostrar_telefone)
select ipe, (select id from contatos where nome = 'Rui Lima'), u102, 'PROCURO', 'Procuro quem passe roupa às terças', true from c, u;
select is(pg_temp.campos($$ select plataforma_publicar_classificado(ana, ipe, x.id, x.versao, 'Procuro passadeira', null, 'TROCO')
                              from ids, c, classificados x where x.tipo = 'PROCURO' $$), '["tipo"]', 'AC-05: tipo desconhecido é recusado');
select is((select plataforma_publicar_classificado(ana, ipe, x.id, x.versao, 'Procuro passadeira', null) ->> 'tipo'
             from ids, c, classificados x where x.tipo = 'PROCURO'), 'PROCURO', 'AC-05: sem o tipo, fica o que o morador escolheu');
select ok(not ((select dados from historico where acao = 'classificado.publicado' and dados ->> 'titulo' = 'Procuro passadeira') ? 'tipoAntes'),
  'AC-05: sem troca, o histórico não fala de tipo');

select * from finish();
rollback;

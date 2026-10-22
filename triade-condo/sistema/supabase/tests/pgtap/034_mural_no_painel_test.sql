-- Mural visto do painel (CD-15; CD-12): o mesmo mural do link, sem contar abertura, com o que
-- ficou de fora e o motivo, para quem vê comunicados.
begin;
select plan(16);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select teste.vincular(ana, ipe), teste.vincular(davi, jatoba),
       plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_COMUNICADOS']),
       plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Portaria', array['ATUALIZAR'])
  from ids, c;
update configuracao_condominio set comunicados_silencio_inicio = '00:00', comunicados_silencio_fim = '00:00';
create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'B', 1, true) ->> 'id')::uuid as bb from ids, c;

create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vc(p uuid) returns integer language sql as $$ select versao from comunicados where id = p $$;
create function pg_temp.escrever(p_titulo text, p_assunto text default 'OBRAS', p_publico text default 'TODOS') returns uuid
language sql as $$
  select (plataforma_salvar_comunicado((select ana from ids), (select ipe from c), null, null, p_assunto, p_titulo,
          'A água será desligada das 9h às 13h para a troca da bomba.', p_publico,
          case when p_publico = 'BLOCOS' then array[(select bb from bl)] else '{}' end, '{}', '{}', null, null, 'PUBLICAR', null,
          null, null) ->> 'id')::uuid $$;
create function pg_temp.painel(p uuid default null) returns jsonb language sql as $$
  select plataforma_mural(coalesce(p, (select ana from ids)), (select ipe from c)) $$;
create function pg_temp.aberturas() returns integer language sql as $$
  select coalesce(sum(vezes), 0)::integer from mural_aberturas where condominio_id = (select ipe from c) $$;

-- Desligado.
select is(pg_temp.painel() ->> 'ligado', 'false', 'CD-15: com o mural desligado, o painel diz que está desligado');
select ok(not (pg_temp.painel() ? 'mural'), 'CD-15: desligado, não há mural para mostrar');

-- Ligado, com um aviso no mural, um de segurança e um só para o bloco B.
select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], false, null, false, false)
  from ids, c;
create temp table cm as select
  pg_temp.escrever('Falta de água na quinta') as agua,
  pg_temp.escrever('Troca do código do portão', 'SEGURANCA') as portao,
  pg_temp.escrever('Vazamento na Torre B', 'OBRAS', 'BLOCOS') as vazamento;
select publico_mural(mural_codigo) from configuracao_condominio where condominio_id = (select ipe from c);
create temp table antes as select pg_temp.aberturas() as n;

select is(jsonb_path_query_array(pg_temp.painel() -> 'mural', '$.comunicados[*].titulo'), '["Falta de água na quinta"]'::jsonb,
  'CD-15: o painel mostra o mesmo mural do link');
select is((pg_temp.painel() -> 'mural') - 'atualizadoEm',
  (select publico_mural(mural_codigo) - 'atualizadoEm' from configuracao_condominio where condominio_id = (select ipe from c)),
  'CD-15: igual ao que o morador vê, campo a campo');
select pg_temp.painel(), pg_temp.painel(), pg_temp.painel();
select is(pg_temp.aberturas(), (select n from antes) + 1, 'CD-15: ver pelo painel não conta abertura; a do morador conta');
select is((pg_temp.painel() ->> 'aberturas')::integer, pg_temp.aberturas(), 'CD-15: o painel mostra as aberturas dos últimos 7 dias');
select is(current_setting('triade.mural_previa', true), '', 'CD-15: a marca da prévia não sobra para a transação');
select is((select (pg_temp.painel() -> 'versoes' ->> agua::text)::integer from cm), (select pg_temp.vc(agua) from cm),
  'CD-15: a versão de cada aviso no mural vai junto, para tirar dali mesmo');

select is((select jsonb_object_agg(x ->> 'titulo', x ->> 'motivo') from jsonb_array_elements(pg_temp.painel() -> 'fora') x),
  '{"Troca do código do portão": "ASSUNTO_FORA", "Vazamento na Torre B": "SO_PARA_ALGUNS"}'::jsonb,
  'CD-15: os publicados fora do mural vêm com o motivo');
select plataforma_mural_comunicado(ana, ipe, agua, pg_temp.vc(agua), false) from ids, c, cm;
select is((select x ->> 'motivo' from jsonb_array_elements(pg_temp.painel() -> 'fora') x where x ->> 'titulo' = 'Falta de água na quinta'),
  'TIRADO', 'CD-15: tirado do mural, o aviso passa para fora com o motivo');
select is(jsonb_array_length(pg_temp.painel() -> 'mural' -> 'comunicados'), 0, 'CD-15: e some da prévia na hora');

-- Quem vê.
select is((select pg_temp.painel(fabio) -> 'pode' from ids), '{"mural": false, "configurar": true, "classificados": false}'::jsonb,
  'CD-15: quem só vê comunicados vê o mural, sem pôr nem tirar');
select is((select pg_temp.painel(ana) -> 'pode' ->> 'mural' from ids), 'true', 'CD-15: quem publica põe e tira dali');
select throws_ok($$ select plataforma_mural(gil, ipe) from ids, c $$, 'TC401', null, 'CF-03: sem ver comunicados, não vê o mural');
select throws_ok($$ select plataforma_mural(davi, ipe) from ids, c $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não vê este mural');

-- O link trocado: o painel segue o código de agora.
select plataforma_trocar_link_mural(ana, ipe, pg_temp.vcfg(), 'O link foi parar num grupo de vendas') from ids, c;
select is(pg_temp.painel() ->> 'codigo', (select mural_codigo from configuracao_condominio where condominio_id = (select ipe from c)), 'CD-15: depois de trocar o link, o painel abre o novo');

select * from finish();
rollback;

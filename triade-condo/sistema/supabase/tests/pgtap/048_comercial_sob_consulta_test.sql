-- Sob consulta pede a aprovação da Administração (0306, parte 7): o valor digitado acima de 400
-- unidades segue o fluxo do desconto (pedir, aprovar ou recusar) e só sai aprovado; mudar o
-- valor ou a implantação digitada pede de novo; a janela de aprovação recebe o valor e o motivo.
begin;
select plan(16);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.pv(p_versao uuid) returns integer language sql as $$ select versao from versoes_proposta where id = p_versao $$;
create function pg_temp.versao(p_proposta uuid) returns jsonb language sql as $$
  select comercial_proposta((select com from ids), p_proposta) -> 'versoes' -> 0 $$;

select pg_temp.em('2026-10-24 10:00:00-03');

create temp table i as select
  (comercial_criar((select com from ids), '{"condominio": "Condomínio Parque Grande", "pessoa": "Lúcia Prado", "origem": "INDICACAO",
                                            "contatoAceito": true, "whatsapp": "5561999990201"}') ->> 'id')::uuid as grande,
  (comercial_criar((select com from ids), '{"condominio": "Edifício Pequeno", "pessoa": "Rui Lima", "origem": "INDICACAO",
                                            "contatoAceito": true, "whatsapp": "5561999990202"}') ->> 'id')::uuid as pequeno;
update interessados set unidades = 450 where id = (select grande from i);
update interessados set unidades = 30 where id = (select pequeno from i);
create temp table g as select comercial_criar_proposta((select com from ids), (select grande from i), jsonb_build_object(
  'valorManual', 150000, 'valorManualMotivo', 'MOTIVO-DO-VALOR: combinado com a administradora', 'implantacaoManual', 300000)) as r;
create temp table gv as select (r ->> 'id')::uuid as p, (r ->> 'versaoId')::uuid as v from g;

select is((select tabela from versoes_proposta where id = (select v from gv)), 'MANUAL', 'acima de 400 unidades a versão é sob consulta');
select is(pg_temp.motivo($$ select comercial_enviar_proposta(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) from ids $$),
  'SOB_CONSULTA_SEM_APROVACAO', 'sob consulta não sai sem a aprovação da Administração');
select is((select pg_temp.versao(p) ->> 'pedeAprovacao' from gv), 'true', 'a ficha diz que a versão pede aprovação');
select is((select comercial_pedir_desconto(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) ->> 'situacao' from ids),
  'AGUARDA_DESCONTO', 'o Comercial pede a aprovação do valor, sem desconto');
select is((select array[d ->> 'sobConsulta', d ->> 'valorManual', d ->> 'implantacaoManual', d ->> 'valorManualMotivo', d ->> 'situacao', (d ? 'percentual')::text]
             from (select pg_temp.versao(p) -> 'descontoPedido' d from gv) x),
  array['true', '150000', '300000', 'MOTIVO-DO-VALOR: combinado com a administradora', 'PEDIDO', 'false'],
  'a janela de aprovação recebe o valor digitado, a implantação e o motivo');
select throws_ok($$ select comercial_responder_desconto(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), true, null) from ids $$,
  'TC401', null, 'o Comercial não aprova o valor sob consulta');
select is((select comercial_responder_desconto(adm, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), false, 'Abaixo do custo') ->> 'situacao' from ids),
  'RASCUNHO', 'a Administração pode recusar, com a resposta');
select ok(exists (select 1 from conversas_comercial where interessado_id = (select grande from i) and canal = 'NOTA'
                    and resumo = 'Valor sob consulta de R$ 1.500,00 por mês na proposta v1 recusado pela Administração. Abaixo do custo'),
  'a recusa fica como nota interna do interessado, com o valor');
select comercial_salvar_versao(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), jsonb_build_object(
  'valorManual', 180000, 'valorManualMotivo', 'MOTIVO-DO-VALOR: combinado com a administradora', 'implantacaoManual', 300000)) from ids;
select comercial_pedir_desconto(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) from ids;
select is((select comercial_responder_desconto(adm, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), true, null) ->> 'situacao' from ids),
  'PRONTA', 'a Administração aprova o valor novo');
select is((select comercial_salvar_versao(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), jsonb_build_object(
  'valorManual', 180000, 'valorManualMotivo', 'MOTIVO-DO-VALOR: combinado com a administradora', 'implantacaoManual', 300000, 'notaInterna', 'Ligar sexta')) ->> 'situacao'
             from ids), 'PRONTA', 'salvar sem mudar o preço mantém a aprovação');
select is((select comercial_salvar_versao(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), jsonb_build_object(
  'valorManual', 170000, 'valorManualMotivo', 'MOTIVO-DO-VALOR: combinado com a administradora', 'implantacaoManual', 300000)) ->> 'situacao'
             from ids), 'RASCUNHO', 'mudar o valor digitado pede aprovação de novo');
select comercial_pedir_desconto(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) from ids;
select comercial_responder_desconto(adm, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), true, 'Ok') from ids;
create temp table env as select comercial_enviar_proposta((select com from ids), (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) as r;
select is((select r ->> 'situacao' from env), 'ENVIADA', 'aprovado, sai');
select is((select array[x ->> 'mensal', x ->> 'tabela'] from (select publico_proposta((select r -> 'link' ->> 'codigo' from env), null) x) y),
  array['170000', 'MANUAL'], 'o link mostra o valor aprovado');
select is((select strpos(publico_proposta((select r -> 'link' ->> 'codigo' from env), null)::text, 'MOTIVO-DO-VALOR')), 0,
  'CM-12: o motivo do valor sob consulta não vai no link');

-- Sem desconto e na tabela, continua indo direto; pedir aprovação sem nada para aprovar é recusado.
create temp table pq as select comercial_criar_proposta((select com from ids), (select pequeno from i), '{}') as r;
select is(pg_temp.motivo($$ select comercial_pedir_desconto(com, (select (r ->> 'id')::uuid from pq), (select (r ->> 'versaoId')::uuid from pq),
  (select (r ->> 'versao')::integer from pq)) from ids $$), 'SEM_DESCONTO', 'na tabela e sem desconto não há o que aprovar');
select is((select comercial_enviar_proposta(com, (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer) ->> 'situacao' from ids, pq),
  'ENVIADA', 'e sai direto');

select * from finish();
rollback;

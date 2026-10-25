-- Ajustes das propostas do Comercial (0306, R17.3): o link novo e o link público para quem foi
-- anonimizado ou pediu para não ser contatado, os links revogados ao fechar ou anonimizar o
-- interessado, o aceite só para interessado aberto, o comparativo do kit pelo link igual ao do
-- Console, o aparelho apagado na anonimização, o conflito de versão nas ações da versão, a
-- implantação digitada que derruba a aprovação e as premissas em centavos grandes.
begin;
select plan(30);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text, p_unidades integer) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp)) ->> 'id')::uuid;
  update interessados set unidades = p_unidades, concorrentes = '[{"nome": "HabitaOne"}, {"nome": "Sistema X"}]' where id = v;
  return v;
end $$;
create function pg_temp.pv(p_versao uuid) returns integer language sql as $$ select versao from versoes_proposta where id = p_versao $$;
-- Proposta sem desconto, enviada: devolve a proposta, a versão e o código do link.
create function pg_temp.enviada(p_interessado uuid) returns jsonb language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_interessado, '{}');
  e := comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  return jsonb_build_object('p', r ->> 'id', 'v', r ->> 'versaoId', 'codigo', e -> 'link' ->> 'codigo');
end $$;
create function pg_temp.aparelho(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;
create function pg_temp.links_abertos(p_interessado uuid) returns integer language sql as $$
  select count(*)::int from links_proposta l join versoes_proposta v on v.id = l.versao_id join propostas_comercial p on p.id = v.proposta_id
   where p.interessado_id = p_interessado and l.revogado_em is null $$;

select pg_temp.em('2026-10-24 10:00:00-03');

create temp table i as select
  pg_temp.interessado('Edifício Ipê', '5561999990101', 72) as ipe,
  pg_temp.interessado('Edifício Jatobá', '5561999990102', 72) as jatoba,
  pg_temp.interessado('Edifício Cedro', '5561999990103', 72) as cedro,
  pg_temp.interessado('Edifício Angico', '5561999990104', 72) as angico,
  pg_temp.interessado('Edifício Grande', '5561999990105', 450) as grande;
create temp table e as select pg_temp.enviada((select ipe from i)) as ipe, pg_temp.enviada((select jatoba from i)) as jatoba,
                              pg_temp.enviada((select cedro from i)) as cedro, pg_temp.enviada((select angico from i)) as angico;

-- 3. O kit pelo link traz o mesmo comparativo do Console (a Tabela de preços lida sem pessoa).
select is((select publico_kit_proposta(ipe ->> 'codigo') -> 'comparativo' from e),
          (select comercial_kit((select com from ids), (ipe ->> 'p')::uuid) -> 'comparativo' from e),
  'o comparativo do kit pelo link é igual ao do Console');
select is((select jsonb_agg(jsonb_build_array(x ->> 'nome', x ->> 'confirmado', jsonb_array_length(x -> 'planos')))
             from e, jsonb_array_elements(publico_kit_proposta(ipe ->> 'codigo') -> 'comparativo' -> 'concorrentes') x),
  '[["HabitaOne", "true", 2], ["Sistema X", "false", 0]]'::jsonb, 'com o concorrente conferido e os planos dele');
select is((select current_setting('app.comercial_sistema', true)), '', 'o link desliga o fluxo sem pessoa no fim');
select throws_ok($$ select comercial_kit(null, (select (ipe ->> 'p')::uuid from e)) $$, 'TC401', null, 'sem pessoa, o Console não lê o kit');

-- 1. Não contatar: o link novo é recusado e o link público some.
select comercial_nao_contatar(com, '5561999990101', null, null, 'Pediu por telefone') from ids;
select is(pg_temp.motivo($$ select comercial_novo_link(com, (select (ipe ->> 'p')::uuid from e), (select (ipe ->> 'v')::uuid from e)) from ids $$), 'NAO_CONTATAR',
  'LGPD: não gera link novo para quem está no não contatar');
select is(pg_temp.codigo($$ select publico_proposta((select ipe ->> 'codigo' from e), null) $$), 'TC404', 'o link de quem pediu para não ser contatado não abre');
select is(pg_temp.codigo($$ select publico_kit_proposta((select ipe ->> 'codigo' from e)) $$), 'TC404', 'nem o kit');
select is(pg_temp.codigo($$ select publico_aceitar_proposta((select ipe ->> 'codigo' from e),
  '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', '200.1.2.3', null) $$), 'TC404', 'nem aceita');
select is((select count(*)::int from aberturas_proposta where versao_id = (select (ipe ->> 'v')::uuid from e)), 0, 'e a tentativa não conta abertura');

-- 2. Fechar o interessado revoga os links; o aceite pede interessado aberto.
select publico_proposta(jatoba ->> 'codigo', pg_temp.aparelho('J')) from e;
select comercial_mudar_etapa(com, (select jatoba from i), (select versao from interessados where id = (select jatoba from i)), 'PERDIDO', 'PRECO') from ids;
select is(pg_temp.links_abertos((select jatoba from i)), 0, 'perdido: os links das propostas são revogados');
select is((select revogado_motivo from links_proposta where versao_id = (select (jatoba ->> 'v')::uuid from e)), 'Interessado fechado', 'com o motivo');
select is(pg_temp.codigo($$ select publico_proposta((select jatoba ->> 'codigo' from e), null) $$), 'TC404', 'o link do perdido não abre');
select is(pg_temp.codigo($$ select publico_aceitar_proposta((select jatoba ->> 'codigo' from e),
  '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', '200.1.2.3', null) $$), 'TC404', 'nem aceita');
select is(pg_temp.motivo($$ select comercial_novo_link(com, (select (jatoba ->> 'p')::uuid from e), (select (jatoba ->> 'v')::uuid from e)) from ids $$),
  'INTERESSADO_FECHADO', 'e não ganha link novo');
-- Um link que ficou aberto por fora (como os de antes da 0306): o aceite recusa.
alter table interessados disable trigger interessados_links_proposta;
select comercial_mudar_etapa(com, (select cedro from i), (select versao from interessados where id = (select cedro from i)), 'PERDIDO', 'PRECO') from ids;
alter table interessados enable trigger interessados_links_proposta;
select is(pg_temp.links_abertos((select cedro from i)), 1, 'link aberto de interessado fechado (como antes da 0306)');
select is(pg_temp.motivo($$ select publico_aceitar_proposta((select cedro ->> 'codigo' from e),
  '{"nome": "Lúcia Prado", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', '200.1.2.3', null) $$), 'PROPOSTA_INDISPONIVEL',
  'interessado fechado não aceita pelo link');
select is((select situacao from versoes_proposta where id = (select (cedro ->> 'v')::uuid from e)), 'ENVIADA', 'e a versão continua só enviada');
select is(comercial_revogar_links_interessado((select cedro from i), 'Interessado fechado', null), 1, 'a revogação da 0306 fecha o que ficou aberto');
select is(pg_temp.links_abertos((select cedro from i)), 0, 'e não sobra link');

-- Anonimizar revoga os links e apaga o resumo do aparelho das aberturas.
select publico_proposta(angico ->> 'codigo', pg_temp.aparelho('K')) from e;
select is(pg_temp.motivo($$ update aberturas_proposta set aparelho = null where versao_id = (select (angico ->> 'v')::uuid from e) $$), 'ABERTURA_FIXA',
  'a abertura não muda fora da anonimização');
select is(pg_temp.motivo($$ delete from aberturas_proposta where versao_id = (select (angico ->> 'v')::uuid from e) $$), 'ABERTURA_FIXA', 'nem se apaga');
select comercial_anonimizar((select angico from i), 'Dados apagados');
select is(pg_temp.links_abertos((select angico from i)), 0, 'anonimizado: os links são revogados');
select is((select count(*)::int from aberturas_proposta where versao_id = (select (angico ->> 'v')::uuid from e) and aparelho is not null), 0,
  'e as aberturas ficam sem o resumo do aparelho');
select is((select count(*)::int from aberturas_proposta where versao_id = (select (angico ->> 'v')::uuid from e)), 1, 'a contagem continua');
select is(pg_temp.codigo($$ select publico_kit_proposta((select angico ->> 'codigo' from e)) $$), 'TC404', 'o kit do anonimizado não abre');

-- 5. As ações da versão conferem a versão do registro depois de travar a linha.
create temp table g as select comercial_criar_proposta((select com from ids), (select grande from i), jsonb_build_object(
  'valorManual', 2500000000, 'valorManualMotivo', 'Combinado com a administradora', 'implantacaoManual', 500000,
  'desconto', 10, 'descontoMotivo', 'Rede com vários prédios')) as r;
create temp table gv as select (r ->> 'id')::uuid as p, (r ->> 'versaoId')::uuid as v from g;
select is((select premissas ->> 'texto' like 'Estimativa: R$ 22.500.000,00 por mês divididos por 450 unidades dá R$ 50.000,00 por apartamento%'
             from versoes_proposta where id = (select v from gv))::text, 'true', 'as premissas aguentam valores acima de integer (centavos em bigint)');
select comercial_pedir_desconto(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv))) from ids;
select is(pg_temp.codigo($$ select comercial_responder_desconto(adm, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)) - 1, true, null) from ids $$),
  'TC409', 'responder ao desconto com a versão velha dá conflito');
select comercial_responder_desconto(adm, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), true, null) from ids;
select is(pg_temp.codigo($$ select comercial_enviar_proposta(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)) - 1) from ids $$),
  'TC409', 'enviar com a versão velha dá conflito');

-- 7. Mudar a implantação digitada derruba a aprovação, como mudar o valor.
select is((select comercial_salvar_versao(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), jsonb_build_object(
  'valorManual', 2500000000, 'valorManualMotivo', 'Combinado com a administradora', 'implantacaoManual', 500000,
  'desconto', 10, 'descontoMotivo', 'Rede com vários prédios')) ->> 'situacao' from ids), 'PRONTA', 'salvar sem mudar o preço mantém a aprovação');
select is((select comercial_salvar_versao(com, (select p from gv), (select v from gv), pg_temp.pv((select v from gv)), jsonb_build_object(
  'valorManual', 2500000000, 'valorManualMotivo', 'Combinado com a administradora', 'implantacaoManual', 100000,
  'desconto', 10, 'descontoMotivo', 'Rede com vários prédios')) ->> 'situacao' from ids), 'RASCUNHO', 'mudar a implantação digitada pede aprovação de novo');

select * from finish();
rollback;

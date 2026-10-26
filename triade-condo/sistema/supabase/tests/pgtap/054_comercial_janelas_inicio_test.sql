-- Janelas do condomínio e o cartão do Comercial no Início (0309, R17.5; CM-18, CM-04): a
-- assembleia ordinária (de 60 a 30 dias antes), o fim do mandato e o da fidelidade, o "voltar a
-- falar em" e o síndico novo do Perdido, tratar o aviso, quem não é lembrado (ganho, anonimizado,
-- não contatar) e o Início com o primeiro retorno fora da meta, os atrasados, os parados e as
-- janelas, sem dado de pessoa.
begin;
select plan(50);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Davi', 'COMERCIAL') as com2,
  teste.equipe('Iara', 'IMPLANTACAO') as imp;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.novo(p_condominio text, p_whatsapp text, p_resp uuid, p_respondido boolean default true) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Lúcia Prado', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp, 'responsavelId', p_resp)) ->> 'id')::uuid;
  if p_respondido then perform comercial_registrar_conversa(p_resp, v, 'WHATSAPP', 'Primeiro retorno.'); end if;
  return v;
end $$;
create function pg_temp.para(p_id uuid, p_etapa text, p_em timestamptz, p_motivo text default null, p_retomar date default null) returns void language plpgsql as $$
begin
  insert into etapas_interessado (interessado_id, de, para, motivo_perda, criado_em, criado_por)
  select id, etapa, p_etapa, p_motivo, p_em, (select com from ids) from interessados where id = p_id;
  update interessados set etapa = p_etapa, etapa_desde = p_em, motivo_perda = p_motivo, retomar_em = p_retomar where id = p_id;
end $$;
create function pg_temp.janelas(p_id uuid) returns jsonb language sql as $$ select comercial_janelas(i) from interessados i where i.id = p_id $$;
create function pg_temp.resumo(p_id uuid) returns text[] language sql as $$
  select coalesce(array_agg(x ->> 'tipo' || ' ' || (x ->> 'situacao') || case when (x ->> 'pedeAtencao')::boolean then ' !' else '' end order by n), '{}')
    from jsonb_array_elements(pg_temp.janelas(p_id)) with ordinality j(x, n) $$;
create function pg_temp.inicio(p_pessoa uuid) returns jsonb language sql as $$ select comercial_inicio(p_pessoa) $$;
create function pg_temp.linhas(p_pessoa uuid) returns text[] language sql as $$
  select coalesce(array_agg((x ->> 'motivo') || ' ' || (x ->> 'condominio') order by n), '{}')
    from jsonb_array_elements(pg_temp.inicio(p_pessoa) -> 'itens') with ordinality j(x, n) $$;

-- 1. Sem nada.
select pg_temp.em('2026-10-01 10:00:00-03');
select is((select pg_temp.inicio(com) from ids),
  '{"total": 0, "contagens": {"primeiroRetorno": 0, "atrasados": 0, "parados": 0, "janelas": 0, "renovacoes": 0, "riscos": 0}, "itens": [], "max": 8, "podeEditar": true}'::jsonb,
  'sem interessados, o Início não tem o que pedir (o cartão some)');
select throws_ok($$ select comercial_inicio(imp) from ids $$, 'TC401', null, 'a Implantação não vê o cartão do Comercial');

-- 2. Os interessados.
create temp table i as select pg_temp.novo('Edifício Kiwi', '5561999990801', com2) as kiwi from ids;
select pg_temp.para(kiwi, 'NEGOCIACAO', app_now()) from i;
select pg_temp.em('2026-10-02 10:00:00-03');
alter table i add column caju uuid, add column aroeira uuid, add column figueira uuid, add column goiaba uuid, add column hortela uuid, add column zimbro uuid;
update i set caju = pg_temp.novo('Edifício Caju', '5561999990802', (select com from ids)),
             aroeira = pg_temp.novo('Edifício Aroeira', '5561999990803', (select com from ids));
select pg_temp.para(caju, 'PERDIDO', app_now(), 'FICOU_PARA_DEPOIS', '2026-10-13') from i;
select pg_temp.para(aroeira, 'GANHO', app_now()) from i;
update interessados set fidelidade_ate = '2027-06-01', assembleia_ordinaria = '2026-11-28' where id = (select caju from i);
update interessados set assembleia_ordinaria = '2026-11-28', mandato_ate = '2026-11-30', fidelidade_ate = '2026-11-30' where id = (select aroeira from i);
select pg_temp.em('2026-10-13 10:00:00-03');
update i set figueira = pg_temp.novo('Edifício Figueira', '5561999990804', (select com from ids)),
             goiaba = pg_temp.novo('Edifício Goiaba', '5561999990805', (select com2 from ids), false),
             hortela = pg_temp.novo('Edifício Hortelã', '5561999990806', (select com from ids)),
             zimbro = pg_temp.novo('Edifício Zimbro', '5561999990809', (select com from ids));
update interessados set assembleia_ordinaria = '2026-11-28', mandato_ate = '2027-01-12', fidelidade_ate = '2026-10-09' where id = (select figueira from i);
update interessados set assembleia_ordinaria = '2026-11-20' where id = (select hortela from i);
select comercial_proximo_passo(com, hortela, pg_temp.iv(hortela), 'Ligar para o síndico', '2026-10-13', '15:00', null) from ids, i;
select pg_temp.em('2026-10-14 10:00:00-03');

-- 3. As janelas.
select is((pg_temp.janelas((select figueira from i)) -> 1) - 'tratada',
  '{"tipo": "ASSEMBLEIA", "data": "2026-11-28", "de": "2026-09-29", "ate": "2026-10-29", "situacao": "ABERTA", "pedeAtencao": true}'::jsonb,
  'a assembleia de 28/11 abre o aviso 60 dias antes e fecha 30 dias antes, para entrar no orçamento');
select is(pg_temp.resumo((select figueira from i)), array['FIDELIDADE PASSOU', 'ASSEMBLEIA ABERTA !', 'MANDATO PROXIMA'],
  'a fidelidade que acabou passou; o mandato abre 60 dias antes do fim');
select is(pg_temp.janelas((select figueira from i)) -> 2 ->> 'de', '2026-11-13', 'a janela do mandato abre em 13/11');
select is(pg_temp.resumo((select caju from i)), array['RETOMAR ABERTA !', 'FIDELIDADE PROXIMA'],
  'no Perdido: o voltar a falar em e a fidelidade do sistema atual; a assembleia não');
select is(pg_temp.resumo((select aroeira from i)), '{}'::text[], 'quem ganhou não tem janela');
select is((select comercial_janelas_ficha(com, figueira) - 'id' - 'versao' - 'janelas' from ids, i),
  '{"etapa": "NOVO", "naoContatar": false, "dias": {"assembleiaDe": 60, "assembleiaAte": 30, "mandato": 60, "fidelidade": 60}, "podeEditar": true}'::jsonb,
  'a ficha mostra as janelas com os dias de aviso');
select throws_ok($$ select comercial_janelas_ficha(imp, figueira) from ids, i $$, 'TC401', null, 'a Implantação não vê as janelas');

-- 4. O Início.
select is(pg_temp.linhas((select com from ids)),
  array['PRIMEIRO_RETORNO Edifício Goiaba', 'ATRASADO Edifício Hortelã', 'PARADO Edifício Kiwi', 'JANELA Edifício Figueira', 'JANELA Edifício Caju'],
  'primeiro o retorno fora da meta, depois o atrasado, o parado e as janelas que se aproximam');
select is((select pg_temp.inicio(com) -> 'contagens' from ids), '{"primeiroRetorno": 1, "atrasados": 1, "parados": 1, "janelas": 3, "renovacoes": 0, "riscos": 0}'::jsonb,
  'as contagens: três janelas pedem atenção (a da Hortelã vai junto do atrasado)');
select is((select (pg_temp.inicio(com) ->> 'total')::int from ids), 5, 'cinco interessados pedem atenção');
select is((select (pg_temp.inicio(com) -> 'itens' -> 0) - 'id' from ids),
  jsonb_build_object('condominio', 'Edifício Goiaba', 'etapa', 'NOVO', 'motivo', 'PRIMEIRO_RETORNO', 'responsavel', jsonb_build_object('id', (select com2 from ids), 'nome', 'Davi'),
                     'meu', false, 'quando', '2026-10-13T14:00:00+00:00'::timestamptz, 'outros', 0),
  'o primeiro retorno mostra o prazo que passou e de quem é');
select is((select pg_temp.inicio(com) -> 'itens' -> 1 ->> 'outros' from ids), '1', 'o atrasado da Hortelã também tem a janela da assembleia');
select is((select (pg_temp.inicio(com) -> 'itens' -> 2 ->> 'diasParado')::int from ids), 13, 'o Kiwi está parado há 13 dias na negociação');
select is((select pg_temp.inicio(com) -> 'itens' -> 3 -> 'janela' ->> 'tipo' from ids), 'ASSEMBLEIA', 'a janela da Figueira é a assembleia');
select is((select pg_temp.inicio(com2) -> 'itens' -> 0 ->> 'meu' from ids), 'true', 'para o Davi, o Goiaba é dele');
select ok((select position('Lúcia' in pg_temp.inicio(com)::text) = 0 and position('5561' in pg_temp.inicio(com)::text) = 0 from ids),
  'o cartão não mostra a pessoa de contato nem o telefone');
update configuracoes set valor = '2' where chave = 'comercial_inicio_max';
select is((select array[jsonb_array_length(pg_temp.inicio(com) -> 'itens'), (pg_temp.inicio(com) ->> 'total')::int] from ids), array[2, 5],
  'mostra até o máximo e conta todos');
update configuracoes set valor = '8' where chave = 'comercial_inicio_max';

-- 5. Tratar o aviso.
select throws_ok($$ select comercial_tratar_janela(imp, figueira, 'ASSEMBLEIA', '2026-11-28') from ids, i $$, 'TC401', null, 'a Implantação não trata janela');
select is((select comercial_tratar_janela(com, figueira, 'ASSEMBLEIA', '2026-11-28') ->> 'tratada' from ids, i), 'true', 'a Bianca trata a assembleia da Figueira');
select is((select pg_temp.janelas(figueira) -> 1 -> 'tratadaPor' ->> 'nome' from i), 'Bianca', 'a janela mostra quem tratou');
select is(pg_temp.resumo((select figueira from i)), array['FIDELIDADE PASSOU', 'ASSEMBLEIA ABERTA', 'MANDATO PROXIMA'], 'e deixa de pedir atenção');
select is((select comercial_tratar_janela(com, figueira, 'ASSEMBLEIA', '2026-11-28') ->> 'tratada' from ids, i), 'true', 'tratar de novo não muda nada');
select is((select count(*)::int from janelas_comercial where interessado_id = (select figueira from i)), 1, 'uma linha só');
select throws_ok($$ select comercial_tratar_janela(com, figueira, 'MANDATO', '2027-01-12') from ids, i $$, 'TC404', null, 'a janela que ainda não abriu não se trata');
select throws_ok($$ select comercial_tratar_janela(com, figueira, 'FIDELIDADE', '2026-10-09') from ids, i $$, 'TC404', null, 'nem a que já passou');
select is(pg_temp.campos($$ select comercial_tratar_janela(com, figueira, 'OUTRA', '2026-10-09') from ids, i $$), '["tipo"]'::jsonb, 'o tipo é um dos cinco');
select is((select array_agg(x ->> 'condominio' order by n) from ids, jsonb_array_elements(pg_temp.inicio(com) -> 'itens') with ordinality j(x, n)
            where x ->> 'motivo' = 'JANELA'), array['Edifício Caju'], 'a Figueira sai do Início');
update interessados set assembleia_ordinaria = '2026-12-10' where id = (select figueira from i);
select is(pg_temp.resumo((select figueira from i)), array['FIDELIDADE PASSOU', 'ASSEMBLEIA ABERTA !', 'MANDATO PROXIMA'], 'com a data nova da assembleia, o aviso volta');
select throws_ok($$ update janelas_comercial set tratada_em = null $$, 'TC422', null, 'a janela tratada não volta atrás');
select throws_ok($$ delete from janelas_comercial $$, null, null, 'e não se apaga');

-- 6. Síndico novo (o Perdido volta a ser lembrado).
select throws_ok($$ select comercial_sindico_novo(imp, caju, 1, null, null) from ids, i $$, 'TC401', null, 'a Implantação não registra síndico novo');
select throws_ok($$ select comercial_sindico_novo(com, caju, 1, null, null) from ids, i $$, 'TC409', null, 'versão velha dá conflito');
select is(pg_temp.campos($$ select comercial_sindico_novo(com, caju, pg_temp.iv(caju), '2025-01-01', null) from ids, i $$), '["desde"]'::jsonb,
  'a data vai de um ano atrás a 90 dias à frente');
select is(pg_temp.campos($$ select comercial_sindico_novo(com, caju, pg_temp.iv(caju), '2026-10-10', '2026-10-01') from ids, i $$), '["mandatoAte"]'::jsonb,
  'o mandato novo acaba depois do começo');
select is((select comercial_sindico_novo(com, caju, pg_temp.iv(caju), '2026-10-10', '2028-10-09') ->> 'lembrar' from ids, i), 'true',
  'no Perdido, o síndico novo vira aviso');
select is(pg_temp.resumo((select caju from i)), array['RETOMAR ABERTA !', 'SINDICO_NOVO ABERTA !', 'FIDELIDADE PROXIMA'], 'o síndico novo pede atenção');
select is((select array[mandato_ate::text, (select resumo from conversas_comercial c where c.interessado_id = i.id and canal = 'NOTA' order by criado_em desc limit 1)]
             from interessados i where id = (select caju from i)),
  array['2028-10-09', 'Síndico novo desde 10/10/2026, com mandato até 09/10/2028.'], 'guarda o fim do mandato novo e deixa uma nota nas conversas');
select is((select comercial_janelas_ficha(com, caju) -> 'sindicoNovo' ->> 'desde' from ids, i), '2026-10-10', 'a ficha mostra desde quando');
select comercial_tratar_janela(com, caju, 'SINDICO_NOVO', '2026-10-10') from ids, i;
select is(pg_temp.resumo((select caju from i)), array['RETOMAR ABERTA !', 'SINDICO_NOVO ABERTA', 'FIDELIDADE PROXIMA'], 'tratado, o síndico novo deixa de pedir atenção');
select is((select comercial_sindico_novo(com, figueira, pg_temp.iv(figueira), null, '2027-03-01') ->> 'lembrar' from ids, i), 'false',
  'no aberto, o síndico novo só muda o fim do mandato');
select is((select pg_temp.janelas(figueira) -> 2 ->> 'data' from i), '2027-03-01', 'e a janela do mandato acompanha');
select is((select count(*)::int from historico where acao in ('comercial.sindico_novo', 'comercial.janela_tratada') and interno), 4,
  'o síndico novo e cada aviso tratado ficam no histórico interno');

-- 7. Quem não é lembrado.
select comercial_nao_contatar(com, '5561999990802', null, null, 'Pediu para não receber contato') from ids;
select is(pg_temp.resumo((select caju from i)), array['RETOMAR ABERTA', 'SINDICO_NOVO ABERTA', 'FIDELIDADE PROXIMA'],
  'no não contatar, as janelas aparecem mas não pedem atenção');
select is((select comercial_janelas_ficha(com, caju) ->> 'naoContatar' from ids, i), 'true', 'e a ficha avisa');
-- LGPD: quem está no não contatar sai do Início, qualquer que seja o motivo (pelo WhatsApp, pelo
-- e-mail ou pelo CNPJ).
select is(pg_temp.linhas((select com from ids)),
  array['PRIMEIRO_RETORNO Edifício Goiaba', 'ATRASADO Edifício Hortelã', 'PARADO Edifício Kiwi', 'JANELA Edifício Figueira'],
  'antes do não contatar, o Goiaba, a Hortelã e o Kiwi pedem atenção');
update interessados set email = 'sindico@hortela.com.br' where id = (select hortela from i);
update interessados set cnpj = '11222333000181' where id = (select kiwi from i);
select comercial_nao_contatar(com, '5561999990805', null, null, 'Pediu para não receber contato') from ids;
select comercial_nao_contatar(com, null, 'SINDICO@hortela.com.br', null, 'Pediu por e-mail') from ids;
select comercial_nao_contatar(com, null, null, '11222333000181', 'Pediu pelo CNPJ do condomínio') from ids;
select is(pg_temp.linhas((select com from ids)), array['JANELA Edifício Figueira'], 'fica só quem pode receber contato');
select is((select pg_temp.inicio(com) -> 'contagens' from ids), '{"primeiroRetorno": 0, "atrasados": 0, "parados": 0, "janelas": 1, "renovacoes": 0, "riscos": 0}'::jsonb,
  'no não contatar, o primeiro retorno, o atrasado e o parado saem do Início');
select comercial_anonimizar(zimbro, 'Teste') from i;
select is(pg_temp.motivo($$ select comercial_sindico_novo(com, zimbro, pg_temp.iv(zimbro), null, null) from ids, i $$), 'ANONIMIZADO',
  'anonimizado não ganha síndico novo');

select * from finish();
rollback;

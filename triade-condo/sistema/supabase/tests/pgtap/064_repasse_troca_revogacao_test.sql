-- D4.37 (0316): revogar sem deixar nada preso. Ao revogar uma pessoa autorizada, as pendências no
-- nome dela, quem executa e as decisões e despesas que esperavam por ela também passam adiante
-- (CF-04, CF-05, MP-01, MP-03, AT-11, AT-23); na troca de síndico no Console, tudo do anterior vai
-- para o novo, inclusive o lugar em quem atende, o responsável padrão e a ausência aberta (CT-01).
begin;
select plan(57);

-- A revogação crua (0040) não está em nenhuma função de produção; aqui a síndica ganha a ação.
select teste.permitir('SINDICO', 'vinculos.revogar');
create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Caio') as caio,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Lia') as lia;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO', 'RESPONDER']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, caio, 'Caio', 'Portaria', array['RESPONDER']) as v_caio,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Subsíndico', array['RESPONDER', 'VER_MANUTENCAO', 'APROVAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, lia, 'Lia', 'Administradora', array['RESPONDER']) as v_lia
  from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v from c, vs, unnest(array[v_ana, v_caio, v_gil, v_lia]) v;
update configuracao_condominio set responsavel_padrao = (select v_ana from vs) where condominio_id = (select ipe from c);
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');
select ajustar_relogio(timestamptz '2027-03-03 10:00:00-03' - now());
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal
  from c;

create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.pedido(p_assunto text, p_responsavel uuid) returns uuid language sql as $$
  select (plataforma_registrar_pedido((select ana from ids), (select ipe from c), null, null, 'Garagem', (select manutencao from cfg),
                                      (select normal from cfg), p_assunto, 'O portão está travando.', 'TELEFONE', false, p_responsavel) ->> 'id')::uuid $$;
create function pg_temp.vv(p uuid) returns integer language sql as $$ select versao from vinculos where id = p $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from manutencoes where id = p $$;
create function pg_temp.pendencia(p_pedido uuid, p_responsavel uuid) returns uuid language sql as $$
  select (plataforma_abrir_pendencia((select ana from ids), (select ipe from c), p_pedido, pg_temp.vp(p_pedido), 'FORNECEDOR',
                                     'Aguardando o orçamento', p_responsavel) ->> 'id')::uuid $$;
create function pg_temp.decisao(p_pedido uuid, p_decisor uuid) returns uuid language sql as $$
  select (plataforma_pedir_decisao((select ana from ids), (select ipe from c), p_pedido, pg_temp.vp(p_pedido), 'Trocar o motor do portão?',
                                   'Está travando', (select hoje + 10 from d), p_decisor, '[{"descricao": "Trocar o motor"}]') ->> 'id')::uuid $$;
create function pg_temp.despesa(p_descricao text, p_decisor uuid) returns uuid language sql as $$
  select (plataforma_criar_despesa((select ana from ids), (select ipe from c), p_descricao, 120000, null, 'Portões Brasília', null, null, null, null,
                                   'PESSOA', p_decisor, (select hoje + 10 from d)) ->> 'id')::uuid $$;
create function pg_temp.manutencao(p_titulo text, p_responsavel uuid, p_executor uuid) returns uuid language sql as $$
  select (plataforma_registrar_manutencao((select ana from ids), (select ipe from c), 'CORRETIVA', p_titulo, 'Casa de bombas', null,
                                          (select normal from cfg), p_responsavel, null, p_executor, null, null, null, null, null) ->> 'id')::uuid $$;
create function pg_temp.preventiva(p_atividade text, p_responsavel uuid, p_executor uuid) returns uuid language sql as $$
  select (plataforma_salvar_preventiva((select ana from ids), (select ipe from c), null, null, p_atividade, 'Caixas-d''água', 'MES', 6,
                                       (select hoje + 60 from d), 15, p_responsavel, null, p_executor, null, null, true) ->> 'id')::uuid $$;
create function pg_temp.repasse(p_vinculo uuid) returns jsonb language sql as $$
  select dados from historico where acao = 'pessoa.repasse' and entidade_id = p_vinculo::text $$;

-- ---------------------------------------------------------------------------------------
-- 1. Revogar pessoa autorizada: o que ficava preso (CF-04, AT-11, AT-23, MP-02).

-- Gil: um pedido, uma pendência no pedido de Caio, uma decisão e uma despesa esperando por ele,
-- e é quem executa a manutenção da Bruna, a preventiva dela e uma providência.
create temp table pe as select
  pg_temp.pedido('Portão travando', v_gil) as p1,
  pg_temp.pedido('Portão rangendo', v_caio) as p2,
  pg_temp.pedido('Interfone mudo', v_caio) as p3,
  pg_temp.pedido('Lâmpada queimada', v_lia) as p4
  from vs;
create temp table pd as select
  pg_temp.pendencia(p2, v_gil) as pend_gil,
  pg_temp.pendencia(p3, v_caio) as pend_caio
  from pe, vs;
create temp table dc as select pg_temp.decisao(p4, v_gil) as d1 from pe, vs;
create temp table dx as select pg_temp.despesa('Motor do portão', v_gil) as x1 from vs;
create temp table mt as select
  pg_temp.manutencao('Bomba com ruído', v_bruna, v_gil) as m1,
  pg_temp.manutencao('Portão da garagem', v_bruna, v_lia) as m2,
  pg_temp.preventiva('Limpeza da caixa-d''água', v_bruna, v_gil) as pv1
  from vs;
create temp table pr as select (plataforma_incluir_providencia(ana, ipe, m1, pg_temp.vm(m1), 'Isolar a bomba 2', null, v_gil, null) ->> 'id')::uuid as prov
  from ids, c, mt, vs;
select is((select count(*)::integer from decisoes_pedido, vs where decisor_id = v_gil and estado = 'AGUARDANDO'), 1, 'AT-23: a decisão espera por Gil');
select is((select count(*)::integer from pendencias_pedido, vs where responsavel_id = v_gil and resolvida_em is null), 2,
  'AT-11: a pendência do pedido de Caio e a da decisão estão no nome de Gil');

-- Fora do repasse, as regras de sempre valem.
select throws_ok($$ update pendencias_pedido set responsavel_id = (select v_lia from vs) where id = (select pend_gil from pd) $$, 'TC422', null,
  'AT-11: a pendência não muda de responsável por fora');
select throws_ok($$ update decisoes_pedido set decisor_id = (select v_ana from vs) where id = (select d1 from dc) $$, 'TC422', null,
  'AT-23: quem decide não muda por fora');
select throws_ok($$ update despesas_aprovacao set decisor_id = (select v_ana from vs) where id = (select x1 from dx) $$, 'TC422', null,
  'FC-10: quem aprova a despesa não muda por fora');
select is(pg_temp.motivo($$ select revogar_vinculo(ana, ipe, v_gil, pg_temp.vv(v_gil)) from ids, c, vs $$), 'TEM_ALGO_EM_ABERTO',
  'CF-04: a revogação crua não revoga quem tem algo em aberto');
select ok((select revogado_em is null from vinculos, vs where id = v_gil), 'CF-04: e não mexe no acesso');

select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_gil, pg_temp.vv(v_gil), null, false,
                          jsonb_build_object('pedidos', v_lia, 'manutencoes', v_bruna)) from ids, c, vs $$,
  'CF-04: revogar Gil dizendo que Lia assume os pedidos e Bruna as manutenções');
select ok((select revogado_em is not null from vinculos, vs where id = v_gil), 'CF-04: o acesso foi revogado');
select is((select responsavel_id from pedidos, pe where id = p1), (select v_lia from vs), 'CF-05: o pedido vai para quem assume os pedidos');
select is((select responsavel_id from pendencias_pedido, pd where id = pend_gil), (select v_lia from vs),
  'AT-11: a pendência no pedido de outro vai para quem assume os pedidos');
select is((select responsavel_id from pendencias_pedido, pd where id = pend_caio), (select v_caio from vs), 'AT-11: a pendência de Caio fica com Caio');
select is((select decisor_id from decisoes_pedido, dc where id = d1), (select v_ana from vs), 'AT-23: a decisão passa para a síndica');
select is((select estado from decisoes_pedido, dc where id = d1), 'AGUARDANDO', 'AT-23: e continua aguardando');
select is((select responsavel_id from pendencias_pedido p, dc where p.pedido_id = (select p4 from pe) and p.tipo = 'DECISAO'), (select v_ana from vs),
  'AT-23: a pendência da decisão vai junto para a síndica');
select is((select decisor_id from despesas_aprovacao, dx where id = x1), (select v_ana from vs), 'FC-10: a despesa passa para a síndica');
select ok(not exists (select 1 from avisos_decisao, dc, ids where decisao_id = d1 and pessoa_id = ana),
  'AT-23: quem revoga não recebe aviso do que passou para si mesma (o aviso a outra pessoa está na troca, abaixo)');
select ok(not exists (select 1 from avisos_aprovacao, dx, ids where despesa_id = x1 and pessoa_id = ana), 'FC-10: nem da despesa');
select is((select executor_vinculo from manutencoes, mt where id = m1), (select v_bruna from vs), 'MP-02: quem executa a manutenção passa para quem assume');
select is((select executor_vinculo from preventivas, mt where id = pv1), (select v_bruna from vs), 'MP-03: e na preventiva');
select is((select executor_vinculo from providencias_manutencao, pr where id = prov), (select v_bruna from vs), 'MP-02: e na providência não feita');
select is((select executor_vinculo from manutencoes, mt where id = m2), (select v_lia from vs), 'MP-02: a execução de Lia fica como estava');
select is(pg_temp.repasse(v_gil),
  jsonb_build_object('pedidos', jsonb_build_object('para', v_lia, 'quantidade', 1),
                     'decisoes', jsonb_build_object('para', v_ana, 'quantidade', 1, 'despesas', 1),
                     'pendencias', jsonb_build_object('para', v_lia, 'quantidade', 1),
                     'execucoes', jsonb_build_object('para', v_bruna, 'manutencoes', 1, 'preventivas', 1, 'providencias', 1)),
  'CF-04: o repasse no histórico conta tudo o que passou, e para quem') from vs;
select ok(exists (select 1 from historico, pe, vs where acao = 'pedido.pendencia_repassada' and entidade_id = p2::text
                   and dados ->> 'de' = v_gil::text and dados ->> 'para' = v_lia::text and dados ->> 'motivo' = 'Acesso revogado'),
  'AT-11: o pedido guarda a troca do responsável da pendência');
select ok(exists (select 1 from historico, pe where acao = 'pedido.decisao_repassada' and entidade_id = p4::text and dados ->> 'motivo' = 'Acesso revogado'),
  'AT-23: e a da decisão');
select ok(exists (select 1 from historico, dx where acao = 'despesa.repassada' and entidade_id = x1::text), 'FC-10: a despesa também');
select ok(exists (select 1 from historico, mt, vs where acao = 'manutencao.alterada' and entidade_id = m1::text
                   and dados -> 'campos' = '["executor"]' and dados ->> 'para' = v_bruna::text and dados ->> 'motivo' = 'Acesso revogado'),
  'MP-02: a manutenção guarda a troca de quem executa');
select ok(exists (select 1 from historico, mt, pr where acao = 'manutencao.alterada' and entidade_id = m1::text
                   and dados -> 'campos' = '["providencia"]' and dados ->> 'providencia' = prov::text),
  'MP-02: e a da providência');

-- Sem escolher quem assume os pedidos, as pendências vão para a síndica; sem quem assume as
-- manutenções, a manutenção fica sem quem executa.
create temp table pd2 as select pg_temp.pendencia(p1, v_caio) as pend_caio2 from pe, vs;
select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_caio, pg_temp.vv(v_caio), null, false) from ids, c, vs $$,
  'CF-05: revogar Caio sem dizer quem assume');
select is((select array_agg(distinct responsavel_id) from pendencias_pedido, pd, pd2 where id in (pend_caio, pend_caio2)), (select array[v_ana] from vs),
  'AT-11: as pendências de Caio vão para a síndica');
select is(pg_temp.repasse(v_caio), jsonb_build_object('pendencias', jsonb_build_object('para', v_ana, 'quantidade', 2)),
  'CF-04: o repasse diz que as pendências foram para a síndica') from vs;
select lives_ok($$ select plataforma_revogar_pessoa(ana, ipe, v_lia, pg_temp.vv(v_lia), null, false, '{"pedidos": null}'::jsonb) from ids, c, vs $$,
  'CF-05: revogar Lia, que só executa, deixando os pedidos na fila');
select ok((select executor_vinculo is null from manutencoes, mt where id = m2), 'MP-02: a manutenção fica sem quem executa');
select is((select array_agg(distinct responsavel_id) from pendencias_pedido, pd where id = pend_gil), (select array[v_ana] from vs),
  'AT-11: a pendência que Lia tinha assumido vai para a síndica');
select is(pg_temp.repasse(v_lia) -> 'execucoes', '{"para": null, "manutencoes": 1, "preventivas": 0, "providencias": 0}'::jsonb,
  'CF-04: o repasse diz que ficou sem quem executa') from vs;
select is((select count(*)::integer from pendencias_pedido p join vinculos v on v.id = p.responsavel_id where p.resolvida_em is null and v.revogado_em is not null), 0,
  'AT-11: nenhuma pendência aberta ficou com quem perdeu o acesso');

-- A revogação crua funciona para quem não tem nada em aberto.
create temp table au as select plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Subsíndico', array['APROVAR']) as v_gil2 from ids, c;
select lives_ok($$ select revogar_vinculo(ana, ipe, v_gil2, pg_temp.vv(v_gil2)) from ids, c, au $$, 'CF-04: sem nada em aberto, a revogação crua revoga');

-- ---------------------------------------------------------------------------------------
-- 2. Troca de síndico: o novo assume tudo do anterior (CT-01).

create temp table au2 as select plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Subsíndico', array['RESPONDER', 'APROVAR']) as v_gil3 from ids, c;
insert into responsaveis_atendimento (condominio_id, vinculo_id) select ipe, v_gil3 from c, au2;
select plataforma_incluir_membro(ana, ipe, gil, null, null, null, 'gil@exemplo.com', 'SUBSINDICO', '2027-01-01', '2027-12-31', 'EMAIL') from ids, c;
create temp table pe2 as select pg_temp.pedido('Vazamento no 101', v_ana) as p5, pg_temp.pedido('Elevador parado', v_gil3) as p6 from vs, au2;
create temp table pd3 as select pg_temp.pendencia(p6, v_ana) as pend_ana from pe2, vs;
update responsaveis_atendimento set disponivel = false where vinculo_id = (select v_ana from vs);
create temp table dc2 as select pg_temp.decisao(p6, v_ana) as d2 from pe2, vs;
create temp table dx2 as select pg_temp.despesa('Peça do elevador', v_ana) as x2 from vs;
create temp table mt2 as select
  pg_temp.manutencao('Elevador', v_ana, v_gil3) as m3,
  pg_temp.manutencao('Bomba 3', v_bruna, v_ana) as m4,
  pg_temp.preventiva('Recarga dos extintores', v_ana, null) as pv2
  from vs, au2;
create temp table aus as select (plataforma_marcar_ausencia(ana, ipe, hoje, hoje + 5, 'Viagem') ->> 'id')::uuid as au from ids, c, d;
insert into auth.users (id, email) select gen_random_uuid(), 'marcos@exemplo.invalid';
create temp table nv as select id as marcos from auth.users where email = 'marcos@exemplo.invalid';

create temp table tr as select
  console_trocar_sindico(impl, ipe, v_ana, pg_temp.vv(v_ana), marcos, 'Marcos Lima', 'Conselheira Rita', 'WHATSAPP',
                         array['Ata da AGE de 12/02/2027']) as r
  from ids, c, vs, nv;
create temp table nvv as select (r ->> 'vinculoId')::uuid as v_marcos from tr;
select ok((select revogado_em is not null from vinculos, vs where id = v_ana), 'CT-01: o vínculo da anterior acaba');
select is((select responsavel_id from pedidos, pe2 where id = p5), (select v_marcos from nvv), 'CT-01: o pedido da anterior vai para o novo síndico');
select ok((select aceito_em is null and responsavel_desde = app_now() from pedidos, pe2 where id = p5), 'CT-01: o novo confirma o aceite');
select is((select responsavel_id from pendencias_pedido, pd3 where id = pend_ana), (select v_marcos from nvv), 'CT-01: a pendência também');
select is((select responsavel_id from manutencoes, mt2 where id = m3), (select v_marcos from nvv), 'CT-01: a manutenção de que ela cuidava');
select is((select responsavel_id from preventivas, mt2 where id = pv2), (select v_marcos from nvv), 'CT-01: a preventiva ativa');
select is((select executor_vinculo from manutencoes, mt2 where id = m4), (select v_marcos from nvv), 'CT-01: e onde ela era quem executa');
select is((select executor_vinculo from manutencoes, mt2 where id = m3), (select v_gil3 from au2), 'CT-01: quem executa de outra pessoa fica');
select is((select decisor_id from decisoes_pedido, dc2 where id = d2), (select v_marcos from nvv), 'CT-01: a decisão que esperava por ela');
select is((select decisor_id from despesas_aprovacao, dx2 where id = x2), (select v_marcos from nvv), 'CT-01: e a despesa');
select ok(exists (select 1 from avisos_decisao, dc2, nv where decisao_id = d2 and pessoa_id = marcos), 'CT-01: o novo síndico é avisado da decisão');
select ok((select r.retirado_em is null and not r.disponivel from responsaveis_atendimento r, nvv where r.vinculo_id = v_marcos),
  'CF-05: o novo entra em quem atende no lugar da anterior, com a mesma disponibilidade');
select ok((select retirado_em is not null from responsaveis_atendimento, vs where vinculo_id = v_ana), 'CF-05: a anterior sai de quem atende');
select is((select responsavel_padrao from configuracao_condominio, c where condominio_id = ipe), (select v_marcos from nvv),
  'CF-05: o novo é o responsável padrão da fila');
select ok((select encerrada_em is not null from ausencias_sindico, aus where id = au), 'CT-01: a ausência aberta da anterior se encerra');
select is((select dados - 'ausencia' from historico, nvv where acao = 'sindico.repasse' and entidade_id = v_marcos::text),
  (select jsonb_build_object('atendimento', true, 'padrao', true,
                             'pedidos', jsonb_build_object('para', v_marcos, 'quantidade', 3),
                             'manutencoes', jsonb_build_object('para', v_marcos, 'quantidade', 1, 'preventivas', 1),
                             'decisoes', jsonb_build_object('para', v_marcos, 'quantidade', 2, 'despesas', 2),
                             'pendencias', jsonb_build_object('para', v_marcos, 'quantidade', 4),
                             'execucoes', jsonb_build_object('para', v_marcos, 'manutencoes', 1, 'preventivas', 0, 'providencias', 0)) from nvv),
  'CT-01: o histórico da troca conta o que passou para o novo (com o que a parte 1 deixou com a síndica)');
select is((select r -> 'repasse' ->> 'ausencia' from tr), 'true', 'CT-01: a resposta da troca traz o resumo do repasse');
select is((select r -> 'autorizados' -> 0 ->> 'nome' from tr), 'Bruna', 'CT-01: as pessoas autorizadas pela anterior continuam vindo para revisão');
select ok(not vinculo_com_algo_em_aberto((select v_ana from vs)), 'CT-01: nada ficou com a anterior');
select is((select count(*)::integer from pedidos p join vinculos v on v.id = p.responsavel_id
            where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and v.revogado_em is not null), 0,
  'CF-04: nenhum pedido em aberto está com quem perdeu o acesso');

select * from finish();
rollback;

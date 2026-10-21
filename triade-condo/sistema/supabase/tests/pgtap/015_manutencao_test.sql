-- Manutenção e prestadores (peça R6; MP-01, MP-02, MP-03, MP-04, MP-05, MP-07, MP-09, MP-13):
-- permissões, prestadores, manutenção separada do pedido, situações, providências, vistoria,
-- preventivas que abrem sozinhas, avisos de retorno vencido e a visita ligada na agenda. Cada
-- condomínio só vê a própria manutenção.
begin;
select plan(67);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Carla') as carla,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO', 'AGENDA', 'ATUALIZAR']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, carla, 'Carla', 'Conselho', array['ACOMPANHAR']) as v_carla,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_MANUTENCAO']) as v_fabio
  from ids, c;
create temp table pr as select
  (select id from prioridades where condominio_id = ipe and modelo = 'ALTA') as alta,
  (select id from prioridades where condominio_id = jatoba and modelo = 'ALTA') as alta_jatoba
  from c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from manutencoes where id = p $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from prestadores where id = p $$;
-- Registra uma corretiva simples.
create function pg_temp.registrar(p_pessoa uuid, p_titulo text, p_resp uuid, p_prestador uuid default null,
                                  p_pedido uuid default null, p_retorno timestamptz default null) returns uuid
language sql as $$
  select (plataforma_registrar_manutencao(p_pessoa, (select ipe from c), 'CORRETIVA', p_titulo, 'Casa de bombas', null,
          (select alta from pr), p_resp, p_prestador, null, null, p_retorno, null, p_pedido, null) ->> 'id')::uuid $$;
create function pg_temp.prestador(p_nome text, p_acordo text default 'CHAMADO', p_ate date default null, p_reserva uuid default null)
returns uuid language sql as $$
  select (plataforma_salvar_prestador((select ana from ids), (select ipe from c), null, null, p_nome, 'Bombas', 'Marcos',
          '+5513998124455', 'marcos@exemplo.invalid', null, p_acordo, p_ate, null, p_reserva, null) ->> 'id')::uuid $$;

-- Permissões (CF-03).
select throws_ok($$ select plataforma_manutencoes(carla, ipe, null, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'MP-01: quem não tem a permissão de ver a manutenção não a vê');
select lives_ok($$ select plataforma_manutencoes(fabio, ipe, null, null, null, null, null, 1) from ids, c $$,
  'MP-01: Ver a manutenção deixa ver');
select throws_ok($$ select pg_temp.registrar(fabio, 'Bomba com ruído', v_ana) from ids, vs $$, 'TC401', null,
  'MP-01: Ver a manutenção não deixa registrar');
select throws_ok($$ select plataforma_manutencoes(davi, ipe, null, null, null, null, null, 1) from ids, c $$, 'TC401', null,
  'PT-01: o síndico de outro condomínio não vê esta manutenção');
select throws_ok($$ select plataforma_prestadores(carla, ipe, false) from ids, c $$, 'TC401', null,
  'MP-05: o telefone dos prestadores só aparece a quem vê a manutenção');

-- Prestadores (MP-05, MP-09).
create temp table p as select pg_temp.prestador('Bombas Litoral') as litoral;
create temp table p2 as select litoral, pg_temp.prestador('HidroPress Bombas', 'CHAMADO', null, litoral) as hidro,
  pg_temp.prestador('Aqualimp', 'CONTRATO', (select hoje + 40 from d)) as aqua from p;
select is((select plataforma_prestadores(fabio, ipe, false) -> 'itens' -> 0 ->> 'nome' from ids, c), 'Aqualimp',
  'MP-05: os prestadores com contrato vêm primeiro');
select is((select (plataforma_prestador(ana, ipe, hidro) -> 'prestador' -> 'reserva' ->> 'nome') from ids, c, p2), 'Bombas Litoral',
  'MP-09: o prestador por chamado guarda a reserva indicada');
select is((select plataforma_prestador(ana, ipe, aqua) -> 'prestador' ->> 'contratoVence' from ids, c, p2), 'true',
  'MP-05: contrato a menos de 60 dias do fim aparece');
select is(pg_temp.campos($$ select pg_temp.prestador('hidropress bombas ') $$), '["nome"]'::jsonb,
  'MP-05: dois prestadores ativos não têm o mesmo nome');
select is(pg_temp.campos($$ select plataforma_salvar_prestador(ana, ipe, null, null, 'Elétrica Sol', 'Elétrica', null, null, null, null,
  'CHAMADO', hoje + 30, null, null, null) from ids, c, d $$), '["contratoAte"]'::jsonb, 'MP-05: vigência só de quem tem contrato');
select is(pg_temp.campos($$ select plataforma_salvar_prestador(ana, ipe, null, null, 'Elétrica Sol', 'Elétrica', null, '123', null, null,
  'CHAMADO', null, null, null, null) from ids, c $$), '["telefone"]'::jsonb, 'MP-05: telefone conferido');
select throws_ok($$ select plataforma_salvar_prestador(davi, jatoba, hidro, 1, 'Outro', 'Bombas', null, null, null, null,
  'CHAMADO', null, null, null, null) from ids, c, p2 $$, 'TC404', null, 'PT-01: o cadastro é de cada condomínio, nunca compartilhado');
select is((select count(*)::integer from historico h, p2 where h.entidade = 'prestadores' and h.entidade_id = hidro::text
            and historico_tem_dado_proibido(h.dados)), 0, 'PT-13: o histórico do prestador não guarda nome nem telefone');

-- Registrar (MP-01, MP-04).
select plataforma_registrar_pedido(ana, ipe, null, null, 'Casa de bombas', (select id from categorias where condominio_id = ipe limit 1),
  (select alta from pr), 'Barulho na casa de bombas', 'Ruído forte desde ontem', 'TELEFONE', false, null) from ids, c, pr;
create temp table ped as select (select id from pedidos where condominio_id = ipe) as pedido from c;
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bo', 'Casa de bombas', null, alta, v_ana,
  null, null, null, null, null, null, null) from ids, c, pr, vs $$), '["titulo"]'::jsonb, 'MP-01: diga o que precisa ser feito');
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba com ruído', 'Casa de bombas', null, alta,
  v_carla, null, null, null, null, null, null, null) from ids, c, pr, vs $$), '["responsavelId"]'::jsonb,
  'MP-01: o responsável precisa ver a manutenção');
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba com ruído', 'Casa de bombas', null, alta,
  v_ana, hidro, null, 'Zé', null, null, null, null) from ids, c, pr, vs, p2 $$), '["executor"]'::jsonb,
  'MP-07: quem executa é um só: prestador, alguém da equipe ou um nome');
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(ana, ipe, 'PREVENTIVA', 'Bomba com ruído', 'Casa de bombas', null, alta,
  v_ana, null, null, null, null, null, null, null) from ids, c, pr, vs $$), '["tipo"]'::jsonb,
  'MP-03: a preventiva nasce pela preventiva, não à mão');
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(davi, jatoba, 'CORRETIVA', 'Bomba com ruído', 'Casa de bombas', null,
  alta_jatoba, v_davi, null, null, null, null, null, pedido, null) from ids, c, pr, vs, ped $$), '["pedidoId"]'::jsonb,
  'MP-04: só se liga pedido do mesmo condomínio');
create temp table m as select pg_temp.registrar(ana, 'Bomba de recalque com ruído', v_bruna, hidro, pedido,
  app_now() + interval '2 hours') as bomba from ids, vs, p2, ped;
select is((select estado from manutencoes, m where id = bomba), 'PLANEJADA', 'MP-02: a manutenção nasce planejada');
select is((select plataforma_manutencao(fabio, ipe, bomba) -> 'manutencao' -> 'executor' ->> 'nome' from ids, c, m), 'HidroPress Bombas',
  'MP-01: mostra quem executa');
select is((select plataforma_manutencao(fabio, ipe, bomba) -> 'manutencao' -> 'pedido' from ids, c, m), null,
  'MP-04: o pedido ligado só aparece a quem vê pedidos');
select is((select plataforma_manutencao(bruna, ipe, bomba) -> 'manutencao' -> 'pedido' ->> 'protocolo' from ids, c, m),
  (select protocolo from pedidos, ped where id = pedido), 'MP-04: quem vê pedidos vê o pedido ligado');
select is((select plataforma_manutencoes_do_pedido(bruna, ipe, pedido) -> 'manutencoes' -> 0 ->> 'id' from ids, c, ped), (select bomba::text from m),
  'MP-04: o pedido mostra a manutenção ligada');
select is((select plataforma_manutencoes_do_pedido(carla, ipe, pedido) ->> 'podeVer' from ids, c, ped), 'false',
  'MP-04: quem não vê a manutenção não a vê pelo pedido');
select throws_ok($$ select plataforma_manutencao(davi, jatoba, bomba) from ids, c, m $$, 'TC404', null,
  'PT-01: a manutenção de outro condomínio não existe para o Davi');

-- Retorno, previsão e situação (MP-01, MP-02).
select is(pg_temp.campos($$ select plataforma_retorno_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), app_now() + interval '1 day', '')
  from ids, c, m $$), '["motivo"]'::jsonb, 'MP-01: mudar o próximo retorno pede motivo');
select plataforma_previsao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), hoje + 1, 'Informada pela HidroPress') from ids, c, m, d;
select is((select previsao - (select hoje from d) from manutencoes, m where id = bomba), 1, 'MP-01: a previsão é só da conclusão');
select is((select proximo_retorno > app_now() from manutencoes, m where id = bomba), true, 'MP-01: e não mexe no próximo retorno');
select is(pg_temp.campos($$ select plataforma_situacao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'PENDENTE', null, 'PECA', '')
  from ids, c, m $$), '["pendenciaMotivo"]'::jsonb, 'MP-02: pendente pede o motivo');
select plataforma_situacao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'PENDENTE', null, 'PECA', 'Rolamento encomendado') from ids, c, m;
select is((select pendencia_tipo from manutencoes, m where id = bomba), 'PECA', 'MP-02: a pendência fica com o tipo');
select is((select dados ->> 'para' from historico, m where entidade_id = bomba::text and acao = 'estado.mudou' order by id desc limit 1),
  'PENDENTE', 'MP-02: a mudança de situação vai para o histórico');
select console_salvar_etapa_manutencao(adm, ipe, null, null, 'Aguardando visita', 'EM_ANDAMENTO', null, null) from ids, c;
select is(pg_temp.campos($$ select plataforma_situacao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'PLANEJADA',
  (select id from etapas_manutencao where nome = 'Aguardando visita'), null, null) from ids, c, m $$), '["etapaId"]'::jsonb,
  'MP-02: a etapa combina com a situação');
select plataforma_situacao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'EM_ANDAMENTO',
  (select id from etapas_manutencao where nome = 'Aguardando visita'), null, null) from ids, c, m;
select is((select estado || '/' || (pendencia_tipo is null) from manutencoes, m where id = bomba), 'EM_ANDAMENTO/true',
  'MP-02: sair de pendente resolve a pendência');
select throws_ok($$ select console_salvar_etapa_manutencao(adm, ipe, (select id from etapas_manutencao where nome = 'Aguardando visita'), 1,
  'Aguardando visita', 'PENDENTE', null, null) from ids, c $$, 'TC422', null, 'MP-02: a situação da etapa não muda');

-- Providências (MP-02).
create temp table pv as select
  (plataforma_incluir_providencia(ana, ipe, bomba, pg_temp.vm(bomba), 'Isolar a bomba 2', null, v_bruna, null) ->> 'id')::uuid as isolar,
  null::uuid as trocar from ids, c, m, vs;
update pv set trocar = (plataforma_incluir_providencia(ana, ipe, bomba, pg_temp.vm(bomba), 'Trocar o rolamento', hidro, null, null) ->> 'id')::uuid
  from ids, c, m, p2;
select plataforma_fazer_providencia(ana, ipe, bomba, pg_temp.vm(bomba), isolar, 'Bomba 2 desligada no quadro') from ids, c, m, pv;
select is((select resultado from providencias_manutencao, pv where id = isolar), 'Bomba 2 desligada no quadro',
  'MP-02: a providência feita guarda o resultado');
select is((select pg_temp.erro($$ select plataforma_fazer_providencia(ana, ipe, bomba, pg_temp.vm(bomba), isolar, 'De novo') from ids, c, m, pv $$)
   -> 'detalhe' ->> 'motivo'), 'PROVIDENCIA_FEITA', 'MP-02: providência feita não volta');
select throws_ok($$ select plataforma_incluir_providencia(ana, ipe, bomba, 1, 'Outra coisa', null, null, null) from ids, c, m $$, 'TC409', null,
  'AT-24: providência com a versão antiga recebe o conflito');

-- Concluir não encerra o pedido (MP-04).
select is((select pg_temp.erro($$ select plataforma_concluir_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'Rolamento trocado e testado',
  hoje, false) from ids, c, m, d $$) -> 'detalhe' ->> 'motivo'), 'PROVIDENCIAS_ABERTAS', 'MP-02: concluir avisa das providências abertas');
select plataforma_concluir_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'Rolamento trocado e testado', hoje, true) from ids, c, m, d;
select is((select estado from manutencoes, m where id = bomba), 'CONCLUIDA', 'MP-02: concluída com o que foi feito');
select is((select feita_em is not null from providencias_manutencao, pv where id = trocar), true, 'MP-02: as providências abertas fecham juntas');
select is((select estado from pedidos, ped where id = pedido), 'ABERTO', 'MP-04: concluir a manutenção não encerra o pedido');
select is((select count(*)::integer from historico, ped where entidade = 'pedidos' and entidade_id = pedido::text
            and acao = 'pedido.manutencao_concluida'), 1, 'MP-04: o pedido fica sabendo que a manutenção terminou');
select is((select pg_temp.erro($$ select plataforma_situacao_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'EM_ANDAMENTO', null, null, null)
  from ids, c, m $$) -> 'detalhe' ->> 'motivo'), 'MANUTENCAO_ENCERRADA', 'MP-02: concluída não muda');
select plataforma_reabrir_manutencao(ana, ipe, bomba, pg_temp.vm(bomba), 'Voltou a fazer barulho') from ids, c, m;
select is((select estado || '/' || (conclusao is null) from manutencoes, m where id = bomba), 'EM_ANDAMENTO/true',
  'MP-02: reabrir com motivo volta em andamento');
select is((select dados ->> 'conclusao' from historico, m where entidade_id = bomba::text and acao = 'manutencao.conclusao_anterior'),
  'Rolamento trocado e testado', 'MP-02: a conclusão anterior fica no histórico');

-- Vistoria (MP-07).
create temp table vi as select (plataforma_registrar_manutencao(ana, ipe, 'VISTORIA', 'Vistoria da fachada', 'Fachada e calhas', null,
  alta, v_bruna, null, v_bruna, null, null, null, null, array['Calhas e rufos', 'Trincas na fachada leste', 'Calha norte']) ->> 'id')::uuid as fachada
  from ids, c, pr, vs;
select is((select count(*)::integer from itens_vistoria, vi where manutencao_id = fachada), 3, 'MP-07: a vistoria tem a lista feita para ela');
select is(pg_temp.campos($$ select plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba', 'Casa de bombas', null, alta, v_ana,
  null, null, null, null, null, null, array['Olhar']) from ids, c, pr, vs $$), '["itens"]'::jsonb, 'MP-07: sem lista única: só a vistoria tem itens');
create temp table it as select
  (select id from itens_vistoria where manutencao_id = fachada and texto like 'Trincas%') as trincas,
  (select id from itens_vistoria where manutencao_id = fachada and texto = 'Calha norte') as norte from vi;
select is(pg_temp.campos($$ select plataforma_responder_item(ana, ipe, fachada, pg_temp.vm(fachada), norte, 'NAO_DEU', null) from ids, c, vi, it $$),
  '["observacao"]'::jsonb, 'MP-07: não deu pede o porquê');
select plataforma_responder_item(ana, ipe, fachada, pg_temp.vm(fachada), trincas, 'PROBLEMA', 'Trinca de 40 cm no 7º andar') from ids, c, vi, it;
create temp table g as select (plataforma_item_virar_manutencao(ana, ipe, fachada, pg_temp.vm(fachada), trincas) ->> 'id')::uuid as nova
  from ids, c, vi, it;
select is((select tipo || '/' || (origem_id = (select fachada from vi)) || '/' || local from manutencoes, g where id = nova),
  'CORRETIVA/true/Fachada e calhas', 'MP-07: item com problema vira corretiva ligada à vistoria');
select is((select pg_temp.erro($$ select plataforma_item_virar_manutencao(ana, ipe, fachada, pg_temp.vm(fachada), trincas) from ids, c, vi, it $$)
   -> 'detalhe' ->> 'motivo'), 'ITEM_COM_MANUTENCAO', 'MP-07: um item abre uma manutenção só');
select is((select pg_temp.erro($$ select plataforma_itens_vistoria(ana, ipe, fachada, pg_temp.vm(fachada), null, array[trincas]) from ids, c, vi, it $$)
   -> 'detalhe' -> 'campos'), '["tirar"]'::jsonb, 'MP-07: item respondido não sai da lista');

-- Preventivas (MP-03, MP-13).
create temp table pre as select
  (plataforma_salvar_preventiva(ana, ipe, null, null, 'Limpeza da caixa-d''água', 'Caixas-d''água', 'MES', 6, hoje + 10, 15, v_bruna,
     null, null, 'Aqualimp', null, true) ->> 'id')::uuid as caixa,
  (plataforma_salvar_preventiva(ana, ipe, null, null, 'Recarga dos extintores', 'Todos os andares', 'ANO', 1, hoje + 60, 15, v_ana,
     null, null, null, null, true) ->> 'id')::uuid as extintores
  from ids, c, vs, d;
select is((select count(*)::integer from manutencoes, pre where preventiva_id = caixa), 1,
  'MP-03: dentro da antecedência, a manutenção da preventiva abre na hora');
select is((select count(*)::integer from manutencoes, pre where preventiva_id = extintores), 0,
  'MP-03: fora da antecedência, ainda não');
select is((select estado || '/' || (data_prevista - (select hoje from d)) from manutencoes, pre where preventiva_id = caixa),
  'PLANEJADA/10', 'MP-03: a manutenção nasce planejada para a data prevista');
select is(pg_temp.campos($$ select plataforma_salvar_preventiva(ana, ipe, null, null, 'Gerador', 'Casa de máquinas', 'SEMANA', 60, hoje + 3, 15,
  v_ana, null, null, null, null, true) from ids, c, vs, d $$), '["intervalo"]'::jsonb, 'MP-03: a cada 1 a 52 semanas');
select is((select proxima_da_preventiva('MES', 1, '2027-01-31', '2027-03-01')), '2027-03-31'::date,
  'MP-03: todo mês a partir do dia 31 não escorrega para o dia 28');
-- Concluída depois da data: a próxima conta da data prevista, sem escorregar.
create temp table mc as select (select id from manutencoes, pre where preventiva_id = caixa) as mcaixa from pre;
select ajustar_relogio('20 days');
select plataforma_concluir_manutencao(ana, ipe, mcaixa, pg_temp.vm(mcaixa), 'Caixas limpas e desinfetadas', (app_now() at time zone 'America/Sao_Paulo')::date,
  false) from ids, c, mc;
select is((select proxima_data from preventivas, pre where id = caixa), (select (hoje + 10 + interval '6 months')::date from d),
  'MP-03: a próxima data conta a partir da data prevista');
select is((select proximo_retorno is null from manutencoes, m where id = bomba), true, 'MP-01: a manutenção reaberta segue sem retorno marcado');

-- Retorno vencido avisa o responsável uma vez (MP-01).
create temp table m2 as select pg_temp.registrar(ana, 'Portão emperrado', v_bruna, null, null, app_now() + interval '1 hour') as portao from ids, vs;
select ajustar_relogio('20 days 3 hours');
select limpar_contexto();
select ok(verificar_manutencao() >= 1, 'MP-01: a rotina avisa o retorno vencido');
select is((select count(*)::integer from avisos_manutencao, m2, ids where manutencao_id = portao and pessoa_id = bruna), 1,
  'MP-01: o responsável recebe o aviso');
select limpar_contexto();
select verificar_manutencao();
select is((select count(*)::integer from avisos_manutencao, m2 where manutencao_id = portao), 1, 'MP-01: ninguém recebe o mesmo aviso duas vezes');
select is((select (plataforma_avisos(bruna, ipe) -> 'itens' -> 0 ->> 'tipo') from ids, c), 'MANUTENCAO_RETORNO_VENCIDO',
  'MP-01: o aviso aparece no sino');
select is((select (plataforma_painel(ana, ipe) -> 'manutencao' ->> 'retornoVencido')::integer from ids, c), 1,
  'MP-01: o início mostra o retorno vencido');
select is((select (plataforma_manutencoes(ana, ipe, null, null, null, 'RETORNO_VENCIDO', null, 1) ->> 'total')::integer from ids, c), 1,
  'MP-01: o atalho mostra só o retorno vencido');

-- Agenda (MP-04, AG-09).
create temp table vis as select (plataforma_marcar_visita_manutencao(bruna, ipe, portao, 'VISITA', 'Visita: portão', (app_now() at time zone 'America/Sao_Paulo')::date + 1,
  '14:00', '15:00', 'AREA_COMUM', null, 'Portão da garagem', '{}', 'Portões Rápidos', null, 'PLANEJADO', false) ->> 'id')::uuid as visita
  from ids, c, m2;
select is((select manutencao_id from compromissos, vis where id = visita), (select portao from m2), 'MP-04: a visita fica ligada à manutenção');
select plataforma_cancelar_compromisso(bruna, ipe, visita, (select versao from compromissos where id = visita), 'Prestador remarcou', 'ESTA')
  from ids, c, vis;
select is((select estado from manutencoes, m2 where id = portao), 'PLANEJADA', 'MP-04: cancelar a visita não apaga a manutenção');
select is((select jsonb_path_query_array(plataforma_agenda(ana, ipe, (app_now() at time zone 'America/Sao_Paulo')::date,
            (app_now() at time zone 'America/Sao_Paulo')::date + 92), '$.datas[*] ? (@.fonte == "PREVENTIVA").titulo') from ids, c),
  '["Recarga dos extintores"]'::jsonb, 'AG-09: as preventivas entram na agenda de quem vê a manutenção');

select * from finish();
rollback;

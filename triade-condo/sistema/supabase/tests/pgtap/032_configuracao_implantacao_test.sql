-- Configuração na implantação (PI-04, CF-01, CF-03, CF-09, CF-12, PI-10; desenho "Configuração na
-- implantação"): a TRÍADE monta pelo Console com as mesmas funções do app enquanto o cliente está em
-- implantação; os ajustes técnicos são só dela, com motivo e aviso depois da entrega; o que é só do
-- condomínio a TRÍADE nunca muda; cada parte é conferida e a etapa 4 pede as 11.
begin;
select plan(52);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.equipe('Fábio', 'FINANCEIRO') as fin,
  teste.equipe('Olga', 'IMPLANTACAO') as olga,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Hugo') as hugo;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table at as select
  console_atribuir(adm, ipe, impl, 'IMPLANTACAO') as a_impl,
  console_atribuir(adm, ipe, sup, 'SUPORTE') as a_sup,
  console_atribuir(adm, ipe, fin, 'FINANCEIRO') as a_fin
  from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administradora', array['CONFIGURAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, hugo, 'Hugo', 'Zelador', array['RESPONDER']) as v_hugo
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vcfg() returns integer language sql as $$
  select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.ve(p_numero integer) returns integer language sql as $$
  select e.versao from etapas_implantacao e join implantacoes i on i.id = e.implantacao_id
   where i.condominio_id = (select ipe from c) and e.numero = p_numero $$;
create function pg_temp.parte(p_quem uuid, p_parte text) returns jsonb language sql as $$
  select x from jsonb_array_elements(console_configuracao(p_quem, (select ipe from c)) -> 'partes') x where x ->> 'parte' = p_parte $$;
create temp table semana as select
  '[{"dia":1,"inicio":"08:00","fim":"12:00"},{"dia":1,"inicio":"13:00","fim":"18:00"},{"dia":6,"inicio":"08:00","fim":"12:00"}]'::jsonb as j;

-- ---------------------------------------------------------------------------------------
-- A aba Configuração (tela 1) e quem vê (decisão 6).

select is((select console_configuracao(impl, ipe) ->> 'emImplantacao' from ids, c), 'true', 'PI-04: o cliente novo está em implantação');
select is((select jsonb_agg(x ->> 'parte') from ids, c, jsonb_array_elements(console_configuracao(impl, ipe) -> 'partes') x),
  '["HORARIOS", "FERIADOS", "AREAS", "CATEGORIAS", "ETAPAS", "MODELOS", "PRAZOS", "MANUTENCAO", "COMUNICADOS", "ETIQUETAS", "WHATSAPP"]',
  'PI-04: as 11 partes, na ordem das abas do app');
select ok((select bool_and(not (x ->> 'conferida')::boolean) from ids, c, jsonb_array_elements(console_configuracao(impl, ipe) -> 'partes') x),
  'PI-04: nada começa conferido');
select is((select console_configuracao(sup, ipe) -> 'pode' from ids, c), '{"montar": false, "tecnica": false, "conferir": false}',
  'PI-10: o suporte só vê a configuração');
select is((select console_configuracao(fin, ipe) -> 'pode' from ids, c), '{"montar": false, "tecnica": false, "conferir": false}',
  'PI-10: o financeiro só vê a configuração');
select is((select console_configuracao(impl, ipe) -> 'pode' from ids, c), '{"montar": true, "tecnica": true, "conferir": true}',
  'PI-10: a implantação atribuída monta, ajusta e confere');
select throws_ok($$ select console_configuracao(olga, ipe) from ids, c $$, 'TC401', null, 'PI-10: quem não está atribuído não vê');
select throws_ok($$ select console_configuracao(ana, ipe) from ids, c $$, 'TC401', null, 'PI-06: o síndico nunca vê a aba');
select is((select console_configuracao(impl, ipe) -> 'sindico' from ids, c),
  '{"pessoas": 3, "revisao": false, "reabertura": true, "termoAceito": null, "avisosLigados": 0}',
  'CF-03: o que é só do condomínio aparece só com a situação');

-- ---------------------------------------------------------------------------------------
-- A TRÍADE monta com as funções do app (decisão 7) enquanto o cliente está em implantação.

select is((select plataforma_definir_horarios(impl, ipe, 'ATENDIMENTO', 1, j) from ids, c, semana), 2,
  'CF-01: a implantação monta os horários pela mesma função do app');
select is((select autor_id from historico, ids, c where acao = 'horarios.alterados' and condominio_id = ipe order by id desc limit 1),
  (select impl from ids), 'CF-01: o histórico do condomínio guarda quem da TRÍADE mudou');
select is((teste.erro($$ select plataforma_definir_horarios(impl, ipe, 'FUNCIONAMENTO', 1,
            '[{"dia":1,"inicio":"08:00","fim":"12:00"},{"dia":1,"inicio":"11:00","fim":"14:00"}]') from ids, c $$)) -> 'detalhe',
  '{"campos": ["intervalos"]}'::jsonb, 'CF-12: o que o app recusa o Console recusa, com a mesma frase');
select lives_ok($$ select plataforma_incluir_feriado(impl, ipe, date '2027-04-21', 'Aniversário de Brasília') from ids, c $$,
  'CF-01: a implantação inclui feriado');
select throws_ok($$ select plataforma_definir_horarios(sup, ipe, 'ATENDIMENTO', 2, '[]') from ids, c $$, 'TC401', null,
  'PI-10: o suporte não muda a configuração');
select lives_ok($$ select plataforma_configuracoes(sup, ipe) from ids, c $$, 'PI-10: o suporte lê as configurações');
select lives_ok($$ select plataforma_config_whatsapp(sup, ipe) from ids, c $$, 'PI-10: o suporte lê o WhatsApp das configurações');
select lives_ok($$ select plataforma_locais(impl, ipe) from ids, c $$, 'PI-10: a implantação lê os locais das etiquetas');
select is((select (plataforma_config_whatsapp(impl, ipe) -> 'pode') from ids, c), '{"editar": true, "tecnica": true, "aceitarTermo": false}',
  'CF-03: a TRÍADE nunca aceita o termo do piloto');
select is((select plataforma_definir_aviso_novo(impl, ipe, pg_temp.vcfg(), 'TODOS', true) from ids, c) > 0, true,
  'CF-01: a implantação deixa pronto quem é avisado de pedido novo');
select is((select plataforma_configuracoes(impl, ipe) -> 'avisoNovo' ->> 'podeMudar' from ids, c), 'true',
  'CF-01: Pedido novo mostra que a implantação muda');
select throws_ok($$ select plataforma_definir_aviso_novo(gil, ipe, pg_temp.vcfg(), 'NUNCA', true) from ids, c $$, 'TC401', null,
  'CF-03: pedido novo continua só do síndico no condomínio');

-- Só o condomínio decide (grupo 3).
select throws_ok($$ select plataforma_definir_regras_pedidos(impl, ipe, pg_temp.vcfg(), true, true) from ids, c $$, 'TC401', null,
  'CF-03: a TRÍADE não muda revisar nem reabrir');
select throws_ok($$ select plataforma_trocar_link_mural(impl, ipe, pg_temp.vcfg(), 'Link vazou no grupo') from ids, c $$, 'TC401', null,
  'CF-03: a TRÍADE não troca o link do mural');
select lives_ok($$ select plataforma_definir_regras_pedidos(ana, ipe, pg_temp.vcfg(), true, true) from ids, c $$,
  'CF-03: a síndica continua mudando revisar e reabrir');
select throws_ok($$ select plataforma_meus_avisos_whatsapp(impl, ipe, null, '+5561988887777', array['PEDIDO_NOVO'], true) from ids, c $$,
  'TC401', null, 'CF-03: a TRÍADE não liga avisos no WhatsApp de ninguém');

-- ---------------------------------------------------------------------------------------
-- Ajustes técnicos: só a TRÍADE (decisões 3, 5 e 10).

select is((select plataforma_configuracoes(ana, ipe) -> 'tecnica' from ids, c), '{"pode": false, "motivo": false}',
  'CF-09: o síndico vê os ajustes técnicos só em leitura');
select is((select console_definir_parecidos(impl, ipe, pg_temp.vcfg(), 60, null) from ids, c) > 0, true,
  'CF-09: na implantação, a TRÍADE muda a janela dos parecidos sem motivo');
select throws_ok($$ select console_definir_parecidos(ana, ipe, pg_temp.vcfg(), 30, null) from ids, c $$, 'TC401', null,
  'CF-09: o síndico não muda a janela dos parecidos');
select throws_ok($$ select console_definir_fuso(sup, ipe, pg_temp.vcfg(), 'America/Manaus', null) from ids, c $$, 'TC401', null,
  'PI-10: o suporte não faz ajuste técnico');
select is(pg_temp.campos($$ select console_definir_anexar(impl, ipe, pg_temp.vcfg(), 20, null) from ids, c $$), '["minutos"]',
  'CF-09: as mensagens seguintes entram por 15, 30 ou 60 minutos');
select lives_ok($$ select console_definir_anexar(impl, ipe, pg_temp.vcfg(), 15, null) from ids, c $$, 'CF-09: a TRÍADE muda as mensagens seguintes');
select is((select count(*)::int from avisos_triade, c where condominio_id = ipe and tipo = 'CONFIGURACAO'), 0,
  'PI-04: na implantação, o ajuste técnico não avisa o síndico');

-- ---------------------------------------------------------------------------------------
-- Conferir parte por parte (decisão 8) e a etapa 4.

select is((select console_conferir_parte(impl, ipe, 'HORARIOS', 'Ata de 03/2026: horário comercial') ->> 'conferidas' from ids, c), '1',
  'PI-04: a implantação confere uma parte');
select is((select pg_temp.parte(impl, 'HORARIOS') -> 'conferencia' ->> 'nota' from ids), 'Ata de 03/2026: horário comercial',
  'PI-06: de onde veio fica na conferência, só no Console');
select is(pg_temp.campos($$ select console_conferir_parte(impl, ipe, 'TERMO', null) from ids, c $$), '["parte"]',
  'PI-04: só as 11 partes se conferem');
select throws_ok($$ select console_conferir_parte(sup, ipe, 'FERIADOS', null) from ids, c $$, 'TC401', null, 'PI-10: o suporte não confere');
select ajustar_relogio('1 minute');
select lives_ok($$ select plataforma_definir_horarios(impl, ipe, 'ATENDIMENTO', 2, j) from ids, c, semana $$, 'mudar os horários depois');
select is((select pg_temp.parte(impl, 'HORARIOS') ->> 'conferida' from ids), 'false', 'PI-04: mudar a parte depois de conferida tira a marca');
select lives_ok($$ select console_definir_fuso(impl, ipe, pg_temp.vcfg(), 'America/Sao_Paulo', null) from ids, c $$, 'trocar o fuso');
select is((select pg_temp.parte(impl, 'HORARIOS') -> 'mudanca' ->> 'equipe' from ids), 'true', 'PI-04: a mudança mostra que veio da TRÍADE');
select is(pg_temp.motivo($$ select console_salvar_etapa(impl, ipe, 4, pg_temp.ve(4), 'REALIZADA', impl, null, 'Horários.', null, null, null)
  from ids, c $$), 'CONFIGURACAO_SEM_CONFERIR', 'PI-04: a etapa 4 só fica realizada com as 11 partes conferidas');
select is(pg_temp.motivo($$ select console_salvar_etapa(impl, ipe, 4, pg_temp.ve(4), 'NAO_SE_APLICA', null, null, null, 'Já veio pronto.', null, null)
  from ids, c $$), 'CONFIGURACAO_OBRIGATORIA', 'PI-04: a configuração sempre se aplica');
select is((select console_implantacao(impl, ipe) -> 'configuracao' ->> 'conferidas' from ids, c), '0',
  'PI-04: o roteiro mostra o andamento da configuração na etapa 4');
select lives_ok($$ select console_conferir_parte(impl, ipe, p, null) from ids, c, unnest(partes_da_configuracao()) p $$,
  'PI-04: conferir as 11 partes');
select is((select console_implantacao(impl, ipe) -> 'configuracao' from ids, c), '{"total": 11, "faltando": [], "conferidas": 11}',
  'PI-04: com as 11 conferidas, nada falta');
select lives_ok($$ select console_salvar_etapa(impl, ipe, 4, pg_temp.ve(4), 'REALIZADA', impl, null, 'Resumo: atendimento seg a sex.', null, null, null)
  from ids, c $$, 'PI-04: a etapa 4 fica realizada com o resumo');
select lives_ok($$ select plataforma_incluir_feriado(impl, ipe, date '2027-11-30', 'Dia do Evangélico') from ids, c $$,
  'mudar uma parte depois de realizada');
select is((select console_implantacao(impl, ipe) -> 'etapas' -> 3 ->> 'situacao' from ids, c), 'REALIZADA',
  'PI-04: mudar uma parte depois não desfaz a etapa realizada');

-- ---------------------------------------------------------------------------------------
-- Depois da entrega (decisões 9, 10 e 12): o grupo 2 é do síndico; o ajuste técnico pede motivo
-- e avisa no sino.

select definir_transicao('IMPLANTACAO_CONCLUIDA');
update clientes set estado = 'ATIVO' where condominio_id = (select ipe from c);
select throws_ok($$ select plataforma_incluir_feriado(impl, ipe, date '2027-12-08', 'Imaculada Conceição') from ids, c $$, 'TC401', null,
  'PI-04: com o cliente ativo, a TRÍADE não muda o que é do síndico');
select is(pg_temp.campos($$ select console_definir_parecidos(impl, ipe, pg_temp.vcfg(), 90, ' ') from ids, c $$), '["motivo"]',
  'PI-04: com o cliente ativo, ajuste técnico pede motivo');
select lives_ok($$ select console_definir_parecidos(impl, ipe, pg_temp.vcfg(), 90, 'A síndica pediu no chamado 2026-0031.') from ids, c $$,
  'PI-04: com motivo, a TRÍADE continua ajustando sem acesso excepcional');
select is((select array_agg(x ->> 'texto') from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'tipo' = 'CONFIGURACAO'),
  array['A TRÍADE mudou a janela dos pedidos parecidos para 90 dias. Motivo: A síndica pediu no chamado 2026-0031.'],
  'AT-17: o síndico recebe no sino o que mudou e por quê');

select * from finish();
rollback;

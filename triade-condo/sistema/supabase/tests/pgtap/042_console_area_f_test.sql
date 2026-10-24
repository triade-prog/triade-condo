-- Console, área F do novo frontend (D4.28; PI-04, PI-05, PI-12): a lista de Implantações traz a
-- pendência vencida mais antiga de cada cliente e as partes da configuração conferidas, sem mudar
-- a ordem nem deixar contexto para trás; o histórico da equipe traz o nome atual de quem o evento
-- fala, lido na hora.
begin;
select plan(26);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Sueli', 'IMPLANTACAO') as sueli,
  teste.equipe('Diego', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Olga') as olga;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba,
  console_criar_condominio(adm, 'Condomínio Cedro', 'Goiânia', 'GO', null) as cedro
  from ids;
create temp table at as select
  console_atribuir(adm, ipe, impl, 'IMPLANTACAO') as a1,
  console_atribuir(adm, jatoba, impl, 'IMPLANTACAO') as a2,
  console_atribuir(adm, cedro, impl, 'IMPLANTACAO') as a3,
  console_atribuir(adm, ipe, sup, 'SUPORTE') as a4
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje,
  (app_now() at time zone 'America/Rio_Branco')::date as hoje_ac;

-- Ipê e Jatobá com a implantação iniciada (nasce na primeira abertura); Cedro ainda não.
select lives_ok($$ select console_implantacao(impl, ipe), console_implantacao(impl, jatoba) from ids, c $$, 'implantações iniciadas');
create temp table pe as select
  (console_salvar_pendencia(impl, ipe, null, null, 3, 'Pedir o AVCB à administradora', 'EQUIPE', sup, hoje - 1) ->> 'id')::uuid as p_avcb,
  (console_salvar_pendencia(impl, ipe, null, null, 6, 'Síndica enviar a planilha de moradores', 'CLIENTE', impl, hoje - 3) ->> 'id')::uuid as p_planilha,
  (console_salvar_pendencia(impl, ipe, null, null, null, 'Combinar a apresentação', 'EQUIPE', impl, hoje + 5) ->> 'id')::uuid as p_futura,
  (console_salvar_pendencia(impl, jatoba, null, null, 2, 'Conversar com o zelador', 'EQUIPE', impl, hoje_ac) ->> 'id')::uuid as p_hoje
  from ids, c, d;
select lives_ok($$ select console_conferir_parte(impl, ipe, p, null) from ids, c, unnest(array['HORARIOS', 'FERIADOS']) p $$,
  'duas partes da configuração do Ipê conferidas');

create function pg_temp.item(p_quem uuid, p_cliente uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements(console_implantacoes(p_quem)) x where x ->> 'condominioId' = p_cliente::text $$;

-- A ordem e o que a lista já trazia não mudam: só entram os dois campos novos.
select is((select jsonb_agg(x - 'vencida' - 'configuracao' order by n)
             from ids, jsonb_array_elements(console_implantacoes(impl)) with ordinality y(x, n)),
          (select console_implantacoes_d428(impl) from ids),
  'D4.28: a lista é a mesma de antes, na mesma ordem, com os campos novos');
select is((select jsonb_agg(x ->> 'nome' order by n) from ids, jsonb_array_elements(console_implantacoes(impl)) with ordinality y(x, n)),
          '["Residencial Ipê", "Edifício Jatobá", "Condomínio Cedro"]'::jsonb,
  'D4.28: quem tem vencida vem primeiro, como antes');

-- A pendência vencida mais antiga.
select is((select pg_temp.item(impl, ipe) -> 'vencida' from ids, c),
          (select jsonb_build_object('id', p_planilha, 'texto', 'Síndica enviar a planilha de moradores', 'comQuem', 'CLIENTE',
                                     'responsavel', 'Inês', 'etapa', 6, 'proximoRetorno', hoje - 3) from pe, d),
  'PI-05: a vencida mais antiga, com o texto, com quem está, quem cuida, a etapa e o retorno');
select is((select pg_temp.item(impl, ipe) ->> 'vencidas' from ids, c), '2', 'PI-05: a contagem de vencidas segue a mesma');
select is((select console_resolver_pendencia(impl, ipe, p_planilha, 1, 'Planilha recebida') from ids, c, pe), 2, 'a mais antiga resolvida');
select is((select pg_temp.item(impl, ipe) -> 'vencida' ->> 'id' from ids, c), (select p_avcb::text from pe),
  'PI-05: resolvida a mais antiga, aparece a seguinte');
select is((select pg_temp.item(impl, ipe) -> 'vencida' ->> 'comQuem' from ids, c), 'EQUIPE', 'PI-05: com a equipe');
select is((select pg_temp.item(impl, ipe) -> 'vencida' ->> 'responsavel' from ids, c), 'Diego', 'PI-05: com o nome de quem cuida');
select is((select pg_temp.item(impl, jatoba) -> 'vencida' from ids, c), 'null'::jsonb,
  'PI-05: retorno marcado para hoje, no fuso do cliente (Acre), ainda não venceu');
select is((select pg_temp.item(impl, cedro) -> 'vencida' from ids, c), 'null'::jsonb, 'PI-05: sem implantação iniciada, sem vencida');
select is((select pg_temp.item(impl, ipe) -> 'vencida' ->> 'etapa' from ids, c), '3', 'PI-05: a etapa da pendência');

-- Partes da configuração conferidas, cada cliente com o seu contexto, só quando a próxima etapa é a configuração.
select is((select pg_temp.item(impl, ipe) -> 'configuracao' from ids, c), 'null'::jsonb,
  'PI-04: com a próxima etapa antes da configuração, sem as partes');
create function pg_temp.ate_configuracao(p_cliente uuid) returns void language sql as $$
  select console_salvar_etapa((select impl from ids), p_cliente, e.numero, e.versao, 'REALIZADA', (select impl from ids), null, 'Feito.', null, null, null)
    from etapas_implantacao e join implantacoes i on i.id = e.implantacao_id
   where i.condominio_id = p_cliente and e.numero < 4 order by e.numero $$;
select lives_ok($$ select pg_temp.ate_configuracao(ipe), pg_temp.ate_configuracao(jatoba) from c $$,
  'Ipê e Jatobá chegam à configuração');
select is((select pg_temp.item(impl, ipe) -> 'configuracao' from ids, c), '{"conferidas": 2, "total": 11}'::jsonb,
  'PI-04: 2 de 11 partes conferidas no Ipê');
select is((select pg_temp.item(impl, jatoba) -> 'configuracao' from ids, c), '{"conferidas": 0, "total": 11}'::jsonb,
  'PI-04: a conferência de um cliente não vaza para o outro');
select is((select pg_temp.item(impl, cedro) -> 'configuracao' from ids, c), 'null'::jsonb,
  'PI-04: implantação não iniciada não mostra a configuração');
select is((select console_implantacoes(impl) is not null from ids), true, 'a lista responde');
select is(contexto_condominio(), null, 'nenhum condomínio fica no contexto depois da lista');

-- Quem não tem acesso.
select is((select console_implantacoes(sueli) from ids), '[]'::jsonb, 'PI-10: implantação sem cliente atribuído não vê nada');
select throws_ok($$ select console_implantacoes(ana) from ids $$, 'TC401', null, 'PI-10: quem não é da equipe não vê a lista');

-- Histórico da equipe com o nome de quem o evento fala.
select lives_ok($$ select console_cadastrar_membro(adm, olga, 'Olga', array['IMPLANTACAO']),
                          console_definir_funcoes(adm, olga, array['IMPLANTACAO', 'SUPORTE']),
                          console_desativar_membro(adm, olga) from ids $$, 'Olga entra, tem as funções revistas e sai');
update pessoas set nome = 'Olga Lima' where id = (select olga from ids);
select is((select array_agg(acao || ':' || coalesce(alvo_nome, '-') order by h.id)
             from ids, console_historico_equipe(adm) h where entidade_id = olga::text),
          array['equipe.membro_cadastrado:Olga Lima', 'equipe.funcoes_alteradas:Olga Lima', 'equipe.membro_desativado:Olga Lima'],
  'PI-12: os três eventos trazem o nome atual de quem eles falam');
select is((select count(*)::int from historico where entidade_id = (select olga::text from ids) and dados::text like '%Olga%'), 0,
  'PI-12: o nome não fica gravado no histórico');
select throws_ok($$ select * from ids, console_historico_equipe(impl) $$, 'TC401', null,
  'PI-10: só quem pode ver o histórico da equipe');

select * from finish();
rollback;

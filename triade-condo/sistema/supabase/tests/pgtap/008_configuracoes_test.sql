-- Passo 2 (F2): configurações na Plataforma do síndico. Painel só do próprio condomínio
-- (V-08), modelo pronto do cenário (CF-12), horários, fuso e feriados (CF-06, CF-10),
-- categorias, prioridades, etapas e modelos com id estável (CF-08, CF-09, AT-04, AT-05, AT-25),
-- prazos com pausas e feriados (AT-10), pessoas autorizadas com permissões individuais
-- (V-09, CF-03, CF-04) e responsáveis pelo atendimento (CF-05).
begin;
select plan(82);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as sindica,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Caio') as caio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', 'PORTARIA_REMOTA') as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(sindica, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi
  from ids, c;

-- Modelo pronto (CF-12, V-04 a V-06): todo condomínio nasce configurado; o cenário só acrescenta.
select is((select count(*)::int from categorias, c where condominio_id = ipe), 8, 'CF-12: com portaria, nasce com 8 categorias (inclui Portaria)');
select is((select count(*)::int from categorias, c where condominio_id = jatoba), 7, 'CF-12: sem cenário, não presume portaria (V-06)');
select is((select fuso from configuracao_condominio, c where condominio_id = jatoba), 'America/Rio_Branco', 'CF-10: o fuso começa pela UF');
select is((select count(*)::int from prazos, c where condominio_id = ipe), 2, 'AT-10: nasce com a regra geral e a exceção do urgente');
select lives_ok($$ select console_escolher_cenario(adm, jatoba, 1, 'PORTARIA_PRESENCIAL') from ids, c $$, 'trocar o cenário');
select is((select count(*)::int from categorias, c where condominio_id = jatoba), 8, 'trocar o cenário acrescenta o que falta, não apaga');

-- Painel (V-08): só o próprio condomínio, sem operador TRÍADE.
select is((select plataforma_painel(sindica, ipe) -> 'condominio' ->> 'nome' from ids, c), 'Residencial Ipê', 'V-08: a síndica abre o painel');
select is((select plataforma_painel(sindica, ipe) -> 'pendencias' from ids, c), '["SEM_HORARIO_ATENDIMENTO", "SEM_RESPONSAVEL"]'::jsonb,
  'o painel diz o que falta configurar');
select ok((select plataforma_painel(sindica, ipe) -> 'acoes' ?& array['config.editar', 'pessoas.autorizar', 'atendimento.responsaveis'] from ids, c),
  'o síndico pode tudo do passo 2');
select throws_ok($$ select plataforma_painel(sindica, jatoba) from ids, c $$, 'TC401', null, 'V-08: não abre o condomínio dos outros');
select throws_ok($$ select plataforma_painel(adm, ipe) from ids, c $$, 'TC401', null, 'atribuição da equipe TRÍADE não abre o painel do síndico');
select is((select jsonb_array_length(plataforma_configuracoes(sindica, ipe) -> 'categorias') from ids, c), 8, 'as configurações vêm de uma vez');

-- Horários e fuso (CF-06, CF-10).
create temp table semana as select
  '[{"dia":2,"inicio":"13:00","fim":"18:00"},{"dia":1,"inicio":"08:00","fim":"12:00"},{"dia":1,"inicio":"13:00","fim":"18:00"},
    {"dia":2,"inicio":"08:00","fim":"12:00"},{"dia":3,"inicio":"08:00","fim":"12:00"},{"dia":3,"inicio":"13:00","fim":"18:00"},
    {"dia":4,"inicio":"08:00","fim":"12:00"},{"dia":4,"inicio":"13:00","fim":"18:00"},{"dia":5,"inicio":"08:00","fim":"12:00"},
    {"dia":5,"inicio":"13:00","fim":"18:00"}]'::jsonb as j;
select is((select plataforma_definir_horarios(sindica, ipe, 'ATENDIMENTO', 1, j) from ids, c, semana), 2, 'CF-10: vários intervalos por dia');
select is((select intervalos -> 0 from horarios, c where condominio_id = ipe and tipo = 'ATENDIMENTO'),
  '{"dia": 1, "fim": "12:00", "inicio": "08:00"}'::jsonb, 'os intervalos ficam em ordem de dia e hora');
select is((teste.erro($$ select plataforma_definir_horarios(sindica, ipe, 'FUNCIONAMENTO', 1,
            '[{"dia":1,"inicio":"08:00","fim":"12:00"},{"dia":1,"inicio":"11:00","fim":"14:00"}]') from ids, c $$)) -> 'detalhe',
  '{"campos": ["intervalos"]}'::jsonb, 'intervalos sobrepostos no mesmo dia são recusados');
select throws_ok($$ select plataforma_definir_horarios(sindica, ipe, 'FUNCIONAMENTO', 1, '[{"dia":1,"inicio":"18:00","fim":"08:00"}]') from ids, c $$,
  'TC422', null, 'início depois do fim é recusado (madrugada vira dois intervalos)');
select is((select plataforma_definir_horarios(sindica, ipe, 'FUNCIONAMENTO', 1, '[{"dia":6,"inicio":"22:00","fim":"24:00"},{"dia":0,"inicio":"00:00","fim":"06:00"}]')
            from ids, c), 2, 'fim às 24:00 vale');
select is((teste.erro($$ select plataforma_definir_horarios(sindica, ipe, 'ATENDIMENTO', 1, '[]') from ids, c $$)) ->> 'codigo',
  'TC409', 'AT-24: horário salvo com a versão velha é conflito');
select is((select dados ->> 'tipo' from historico, c where acao = 'horarios.alterados' and condominio_id = ipe order by id limit 1),
  'ATENDIMENTO', 'a mudança de horário vai para o histórico');
select is((select plataforma_definir_fuso(sindica, ipe, 1, 'America/Manaus') from ids, c), 2, 'CF-10: o síndico troca o fuso');
select throws_ok($$ select plataforma_definir_fuso(sindica, ipe, 2, 'Europe/Lisbon') from ids, c $$, 'TC422', null, 'só os fusos do Brasil');
select lives_ok($$ select plataforma_definir_fuso(sindica, ipe, 2, 'America/Sao_Paulo') from ids, c $$, 'volta para Brasília');
select is((select pendencias_configuracao(ipe) from c), array['SEM_RESPONSAVEL'], 'com horário de atendimento, sai a pendência');

-- Feriados (CF-10): data sem hora, sai como foi escrita.
create temp table fer as select plataforma_incluir_feriado(sindica, ipe, '2026-11-20', 'Consciência Negra') as f from ids, c;
select is((select plataforma_configuracoes(sindica, ipe) -> 'feriados' -> 0 ->> 'data' from ids, c), '2026-11-20',
  'CF-10: o feriado sai como foi escrito, sem fuso');
select is((teste.erro($$ select plataforma_incluir_feriado(sindica, ipe, '2026-11-20', 'Outro') from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'FERIADO_REPETIDO', 'um feriado por data');
select lives_ok($$ select plataforma_remover_feriado(sindica, ipe, plataforma_incluir_feriado(sindica, ipe, '2026-12-24', 'Véspera')) from ids, c $$,
  'feriado errado sai');
select is((select array_agg(acao order by id) from historico, c where condominio_id = ipe and entidade = 'feriado'),
  array['feriado.incluido', 'feriado.incluido', 'feriado.removido'], 'e o histórico guarda a entrada e a saída');

-- Categorias (CF-08, CF-09): id estável, desativa em vez de apagar.
create temp table cat as select (plataforma_salvar_categoria(sindica, ipe, null, null, 'Animais', null) ->> 'id')::uuid as pets from ids, c;
select is((teste.erro($$ select plataforma_salvar_categoria(sindica, ipe, null, null, 'animais', null) from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'NOME_REPETIDO', 'duas categorias ativas com o mesmo nome não');
select is((select plataforma_salvar_categoria(sindica, ipe, pets, 1, 'Animais de estimação', null) ->> 'id' from ids, c, cat),
  (select pets::text from cat), 'CF-09: renomear mantém o identificador');
select lives_ok($$ select plataforma_salvar_categoria(sindica, ipe, pets, 2, 'Animais de estimação', false) from ids, c, cat $$, 'desativar');
select is((select ativa from categorias, cat where id = pets), false, 'a categoria fica, desativada');
select throws_ok($$ delete from categorias where id = (select pets from cat) $$, 'TC010', null, 'CF-09: categoria não se apaga');
select is((select dados from historico, cat where acao = 'categoria.alterada' and entidade_id = pets::text order by id desc limit 1),
  '{"campos": ["ativa"]}'::jsonb, 'o histórico guarda o que mudou');
select is((select interno from historico, cat where acao = 'categoria.criada' and entidade_id = pets::text), false,
  'mudança de configuração não é interna: o síndico vê');

-- Prioridades (AT-04): significado explícito.
select throws_ok($$ select plataforma_salvar_prioridade(sindica, ipe, null, null, 'Crítica', '', null) from ids, c $$, 'TC422', null,
  'AT-04: prioridade sem significado não');
create temp table pr as select (plataforma_salvar_prioridade(sindica, ipe, null, null, 'Crítica', 'Para o prédio inteiro.', null) ->> 'id')::uuid as critica
  from ids, c;
select is((select nivel from prioridades, pr where id = critica), 5::smallint, 'nova prioridade entra no nível mais alto');
update prioridades set ativa = false where condominio_id = (select ipe from c) and nivel < 5;
select is((teste.erro($$ select plataforma_salvar_prioridade(sindica, ipe, p.id, p.versao, p.nome, p.significado, false)
                         from ids, c, prioridades p where p.condominio_id = ipe and p.nivel = 5 $$)) -> 'detalhe' ->> 'motivo',
  'PRIORIDADE_ESSENCIAL', 'sobra ao menos uma prioridade ativa');
update prioridades set ativa = true where condominio_id = (select ipe from c);

-- Etapas (AT-05, CF-09): sempre ligadas a aberto, em andamento ou encerrado.
create temp table et as select (plataforma_salvar_etapa(sindica, ipe, null, null, 'Orçamento', 'EM_ANDAMENTO', null, true, null) ->> 'id')::uuid as orc
  from ids, c;
select is((select ordem from etapas, et where id = orc), 4::smallint, 'a etapa nova entra no fim da situação');
select throws_ok($$ update etapas set situacao = 'ENCERRADO' where id = (select orc from et) $$, 'TC422', null,
  'CF-09: a situação da etapa não muda');
select throws_ok($$ select plataforma_salvar_etapa(sindica, ipe, null, null, 'Arquivado', 'ENCERRADO', null, true, null) from ids, c $$,
  'TC422', null, 'etapa encerrada não pausa prazo');
select is((teste.erro($$ select plataforma_salvar_etapa(sindica, ipe, null, null, 'Poda', 'EM_ANDAMENTO',
            (select id from categorias where condominio_id = jatoba limit 1), false, null) from ids, c $$)) -> 'detalhe',
  '{"campos": ["categoriaId"]}'::jsonb, 'etapa não usa categoria de outro condomínio');
select lives_ok($$ select plataforma_salvar_etapa(sindica, ipe, e.id, e.versao, e.nome, null, null, null, false)
                    from ids, c, etapas e where e.condominio_id = ipe and e.modelo = 'NAO_PROCEDE' $$, 'desativar uma etapa encerrada');
select is((teste.erro($$ select plataforma_salvar_etapa(sindica, ipe, e.id, e.versao, e.nome, null, null, null, false)
                         from ids, c, etapas e where e.condominio_id = ipe and e.modelo = 'CONCLUIDO' $$)) -> 'detalhe' ->> 'motivo',
  'ETAPA_ESSENCIAL', 'sobra ao menos uma etapa geral de aberto e uma de encerrado');

-- Modelos de resposta (AT-25).
create temp table mr as select (plataforma_salvar_modelo(sindica, ipe, null, null, 'Vazamento', 'Vamos mandar alguém olhar hoje.',
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO'), null) ->> 'id')::uuid as m from ids, c;
select is((select plataforma_salvar_modelo(sindica, ipe, m, 1, 'Vazamento', 'Vamos mandar alguém olhar ainda hoje.', null, null) ->> 'versao'
            from ids, c, mr), '2', 'AT-25: modelo editado segue a versão');
select is((select jsonb_array_length(plataforma_configuracoes(sindica, ipe) -> 'modelos') from ids, c), 3, 'modelos do cenário e o novo');

-- Prazos (AT-10): o mais específico vale.
create temp table pz as select
  (select id from categorias where condominio_id = (select ipe from c) and modelo = 'LIMPEZA') as limpeza,
  (select id from categorias where condominio_id = (select ipe from c) and modelo = 'SEGURANCA') as seguranca,
  (select id from prioridades where condominio_id = (select ipe from c) and modelo = 'URGENTE') as urgente,
  (select id from prioridades where condominio_id = (select ipe from c) and modelo = 'NORMAL') as normal;
select lives_ok($$ select plataforma_salvar_prazo(sindica, ipe, null, null, limpeza, null, 48) from ids, c, pz $$, 'exceção por categoria');
select is((teste.erro($$ select plataforma_salvar_prazo(sindica, ipe, null, null, limpeza, null, 12) from ids, c, pz $$)) -> 'detalhe' ->> 'motivo',
  'PRAZO_REPETIDO', 'uma regra por combinação');
select is((teste.erro($$ select plataforma_salvar_prazo(sindica, ipe, null, null, null, null, 12) from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'PRAZO_REPETIDO', 'a regra geral já existe');
select is((teste.erro($$ select plataforma_remover_prazo(sindica, ipe, z.id, z.versao) from ids, c, prazos z
                         where z.condominio_id = ipe and z.categoria_id is null and z.prioridade_id is null $$)) -> 'detalhe' ->> 'motivo',
  'PRAZO_GERAL', 'a regra geral não sai');
select throws_ok($$ select plataforma_salvar_prazo(sindica, ipe, null, null, seguranca, null, 0) from ids, c, pz $$, 'TC422', null,
  'prazo de zero horas não');
select is((select array[horas_de_prazo(ipe, limpeza, urgente), horas_de_prazo(ipe, limpeza, normal), horas_de_prazo(ipe, seguranca, normal)]
             from c, pz), array[4, 48, 24], 'AT-10: prioridade > categoria > regra geral');

-- Vencimento (AT-10): só horas de atendimento, pulando o feriado. Seg a sex, 8h–12h e 13h–18h, Brasília.
select is((select vencimento_do_prazo(ipe, '2026-11-19 17:00-03', 4) from c), '2026-11-23 11:00-03'::timestamptz,
  'AT-10: quinta 17h + 4h passa pelo feriado de sexta e pelo fim de semana');
select is((select vencimento_do_prazo(ipe, '2026-11-22 10:00-03', 2) from c), '2026-11-23 10:00-03'::timestamptz,
  'aberto no domingo, conta a partir da segunda');
select is((select vencimento_do_prazo(ipe, '2026-11-18 12:30-03', 1) from c), '2026-11-18 14:00-03'::timestamptz,
  'o almoço não conta');
select is((select vencimento_do_prazo(jatoba, '2026-11-19 17:00-05', 24) from c), '2026-11-20 17:00-05'::timestamptz,
  'sem horário de atendimento, horas corridas');

-- Pessoas autorizadas (V-09, CF-03): o cargo não dá permissão; a permissão é individual.
create temp table pa as select
  plataforma_autorizar_pessoa(sindica, ipe, bruna, 'Bruna', 'Secretária', array['CONFIGURAR']) as v_bruna,
  plataforma_autorizar_pessoa(sindica, ipe, caio, 'Caio', 'Subsíndico', '{}') as v_caio
  from ids, c;
select ok((select plataforma_painel(bruna, ipe) -> 'acoes' ? 'config.editar' from ids, c), 'CF-03: com a permissão, a secretária configura');
select is((select plataforma_painel(caio, ipe) -> 'acoes' from ids, c), '["config.ver", "plataforma.painel.ver"]'::jsonb,
  'CF-03: subsíndico sem permissão só vê');
select throws_ok($$ select plataforma_salvar_categoria(caio, ipe, null, null, 'Obras', null) from ids, c $$, 'TC401', null,
  'CF-03: o cargo não concede permissão');
select is((teste.erro($$ select plataforma_autorizar_pessoa(sindica, ipe, davi, 'Davi', null, array['PUBLICAR']) from ids, c $$)) -> 'detalhe',
  '{"campos": ["permissoes"]}'::jsonb, 'CF-12: permissão de recurso que ainda não existe não é dada');
select throws_ok($$ select plataforma_autorizar_pessoa(bruna, ipe, davi, 'Davi', null, '{}') from ids, c $$, 'TC401', null,
  'quem é autorizado não autoriza ninguém');
select is((teste.erro($$ select plataforma_autorizar_pessoa(sindica, ipe, sindica, 'Ana', null, '{}') from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'JA_TEM_ACESSO', 'quem já tem acesso não ganha outro vínculo');
select is((select plataforma_alterar_pessoa(sindica, ipe, v_bruna, 1, 'Secretária', '{}') from ids, c, pa), 2, 'tirar a permissão');
select ok((select not (plataforma_painel(bruna, ipe) -> 'acoes' ? 'config.editar') from ids, c), 'CF-04: perde na hora');
select is((select count(*)::int from vinculo_permissoes, pa where vinculo_id = v_bruna and retirada_em is not null), 1,
  'a permissão retirada fica registrada, não some');
select is((teste.erro($$ select plataforma_alterar_pessoa(sindica, ipe, v_bruna, 1, 'Secretária', '{}') from ids, c, pa $$)) ->> 'codigo',
  'TC409', 'AT-24: alterar com a versão velha é conflito');
select lives_ok($$ select plataforma_alterar_pessoa(sindica, ipe, v_bruna, 2, 'Secretária', array['CONFIGURAR']) from ids, c, pa $$,
  'devolver a permissão');

-- Responsáveis pelo atendimento (CF-05).
select throws_ok($$ select plataforma_definir_atendimento(bruna, ipe, 3, '[]', null) from ids, c $$, 'TC401', null,
  'quem atende é o síndico que escolhe');
select is((teste.erro(format($$ select plataforma_definir_atendimento(sindica, ipe, 3, '[{"vinculoId":"%s","disponivel":true}]', null) from ids, c $$,
            (select v_ana from vs)))) -> 'detalhe' ->> 'motivo', 'PADRAO_NECESSARIO', 'com responsáveis, escolha o padrão da fila');
select is((teste.erro(format($$ select plataforma_definir_atendimento(sindica, ipe, 3, '[{"vinculoId":"%s","disponivel":false}]', '%s') from ids, c $$,
            (select v_ana from vs), (select v_ana from vs)))) -> 'detalhe' ->> 'motivo', 'PADRAO_INDISPONIVEL', 'CF-05: o padrão está de fato disponível');
select is((teste.erro(format($$ select plataforma_definir_atendimento(sindica, ipe, 3, '[{"vinculoId":"%s","disponivel":true}]', '%s') from ids, c $$,
            (select v_davi from vs), (select v_davi from vs)))) -> 'detalhe' ->> 'motivo', 'RESPONSAVEL_INVALIDO', 'responsável de outro condomínio não');
select is((select plataforma_definir_atendimento(sindica, ipe, 3,
            jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_bruna, 'disponivel', true)),
            v_bruna) from ids, c, vs, pa), 4, 'CF-05: síndica e secretária atendem; a secretária é a padrão');
select is((select pendencias_configuracao(ipe) from c), '{}'::text[], 'nada mais pendente');

-- Revogar (CF-04, CF-05): para de agir na hora; o padrão da fila precisa de quem assuma.
select is((teste.erro($$ select plataforma_revogar_pessoa(sindica, ipe, v_bruna, 3, null, false) from ids, c, pa $$)) -> 'detalhe' ->> 'motivo',
  'SUBSTITUTO_NECESSARIO', 'CF-05: revogar a padrão exige substituto ou pendência explícita');
select lives_ok($$ select plataforma_revogar_pessoa(sindica, ipe, v_bruna, 3, v_ana, false) from ids, c, pa, vs $$, 'revogar com a síndica assumindo');
select is((select responsavel_padrao from configuracao_condominio, vs, c where condominio_id = ipe and responsavel_padrao = v_ana), (select v_ana from vs),
  'a síndica virou a padrão');
select ok((select not acesso_plataforma(bruna) from ids), 'CF-04: revogada, não entra mais');
select is((select autor_id from historico, pa where acao = 'pessoa.autorizada' and entidade_id = v_bruna::text), (select sindica from ids),
  'CF-04: a autoria antiga fica');
select lives_ok($$ select plataforma_definir_atendimento(sindica, ipe, c2.versao,
                    jsonb_build_array(jsonb_build_object('vinculoId', v_ana, 'disponivel', true), jsonb_build_object('vinculoId', v_caio, 'disponivel', true)), v_caio)
                    from ids, c, vs, pa, configuracao_condominio c2 where c2.condominio_id = ipe $$, 'o subsíndico vira o padrão');
select lives_ok($$ select plataforma_revogar_pessoa(sindica, ipe, v_caio, v.versao, null, true) from ids, c, pa, vinculos v where v.id = v_caio $$,
  'revogar deixando a pendência explícita');
select is((select pendencias_configuracao(ipe) from c), array['SEM_RESPONSAVEL_PADRAO'], 'e o painel mostra a pendência');
select throws_ok($$ select plataforma_revogar_pessoa(sindica, ipe, v_ana, 1, null, false) from ids, c, vs $$, 'TC404', null,
  'síndico não é revogado pela Plataforma (vem do Console)');

-- Isolamento: cada condomínio só vê o que é dele.
select ok((select not exists (select 1 from jsonb_array_elements(plataforma_configuracoes(davi, jatoba) -> 'categorias') x
                               where x ->> 'nome' like 'Animais%') from ids, c), 'o Jatobá não vê as categorias do Ipê');

select * from finish();
rollback;

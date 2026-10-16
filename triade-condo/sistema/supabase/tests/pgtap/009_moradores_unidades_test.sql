-- Passo 3 (F3): moradores e unidades na Plataforma do síndico. Blocos e unidades, cadastro
-- breve do contato (MU-01), vários contatos por unidade (MU-08), confirmação pelo síndico
-- (MU-02), telefone que não prova identidade (MU-03), mudança (MU-07), importação de planilha
-- e remoção dos dados pessoais (PT-11).
begin;
select plan(87);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as sindica,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', 'PORTARIA_REMOTA') as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(sindica, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(sindica, ipe, bruna, 'Bruna', 'Secretária', array['CONFIGURAR']) as v_bruna
  from ids, c;

-- Permissão (PT-02): moradores ficam com o síndico; a pessoa autorizada não vê.
select ok((select plataforma_painel(sindica, ipe) -> 'acoes' ?& array['moradores.ver', 'moradores.editar', 'moradores.confirmar'] from ids, c),
  'o síndico cuida dos moradores');
select is((select plataforma_painel(sindica, ipe) -> 'moradores' from ids, c), '{"unidades": 0, "aConfirmar": 0, "semContato": 0}'::jsonb,
  'o painel mostra o resumo de moradores');
select throws_ok($$ select plataforma_unidades(bruna, ipe) from ids, c $$, 'TC401', null, 'CF-03: pessoa autorizada sem permissão não vê moradores');
select is((select plataforma_painel(bruna, ipe) ? 'moradores' from ids, c), false, 'e o painel dela não traz o resumo');
select throws_ok($$ select plataforma_unidades(sindica, jatoba) from ids, c $$, 'TC401', null, 'PT-01: não abre as unidades de outro condomínio');

-- Lista de unidades sem andar, para os testes.
create function pg_temp.us(variadic p text[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('identificacao', x)) from unnest(p) x $$;

-- Estrutura do prédio: torre, bloco, quadra ou nada; com ou sem andar.
select is((select (plataforma_unidades(sindica, ipe) -> 'estrutura') - 'versao'::text from ids, c), '{"usaAndar": false, "agrupamento": "NENHUM"}'::jsonb,
  'o condomínio começa sem divisão e sem andar');
select is((teste.erro($$ select plataforma_incluir_unidades(sindica, ipe, null, '[{"identificacao": "1", "andar": "Térreo"}]') from ids, c $$))
  -> 'detalhe' ->> 'motivo', 'SEM_ANDAR', 'andar só quando o condomínio usa andar');
select lives_ok($$ select plataforma_definir_estrutura(sindica, ipe, (plataforma_unidades(sindica, ipe) -> 'estrutura' ->> 'versao')::int, 'TORRE', true)
                   from ids, c $$, 'o síndico diz que o prédio tem torres e andares');
select is((select nome_da_unidade('Torre A', '3', '302') || ' | ' || nome_da_unidade(null, 'Térreo', 'Loja 1') || ' | ' || nome_da_unidade(null, null, '7')),
  'Torre A · 3º andar · 302 | Térreo · Loja 1 | 7', 'o nome da unidade mostra só as partes que existem');

-- Blocos e unidades (F3.1).
create temp table bl as select
  (plataforma_salvar_bloco(sindica, ipe, null, null, 'Torre A', null, null) ->> 'id')::uuid as torre_a,
  (plataforma_salvar_bloco(sindica, ipe, null, null, 'Torre B', null, null) ->> 'id')::uuid as torre_b
  from ids, c;
select is((select ordem from blocos, bl where id = torre_b), 2::smallint, 'o bloco novo entra no fim');
select is((teste.erro($$ select plataforma_salvar_bloco(sindica, ipe, null, null, ' torre a ', null, null) from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'NOME_REPETIDO', 'dois blocos ativos com o mesmo nome não');
select is((select plataforma_incluir_unidades(sindica, ipe, torre_a, pg_temp.us('101', '102', '201', '202', '1001', '102 ')) from ids, c, bl),
  '{"criadas": 5, "jaExistiam": []}'::jsonb, 'várias unidades de uma vez, sem repetir');
select is((select plataforma_incluir_unidades(sindica, ipe, torre_a, pg_temp.us('101', '301')) from ids, c, bl),
  '{"criadas": 1, "jaExistiam": ["101"]}'::jsonb, 'a que já existe volta na resposta e não duplica');
select is((select plataforma_incluir_unidades(sindica, ipe, torre_b, pg_temp.us('101')) ->> 'criadas' from ids, c, bl), '1',
  'o mesmo número vale em outro bloco');
select is((select plataforma_incluir_unidades(sindica, ipe, null, pg_temp.us('Loja 2', 'Loja 10')) ->> 'criadas' from ids, c), '2',
  'unidade sem bloco');
select is((select array_agg(x ->> 'identificacao') from jsonb_array_elements((select plataforma_unidades(sindica, ipe) -> 'unidades' from ids, c)) x),
  array['Loja 2', 'Loja 10', '101', '102', '201', '202', '301', '1001', '101'], 'ordem natural: 2 antes de 10, bloco por bloco');
select throws_ok($$ select plataforma_incluir_unidades(sindica, ipe, null, pg_temp.us('')) from ids, c $$, 'TC422', null, 'identificação vazia não');
select throws_ok($$ select plataforma_incluir_unidades(sindica, jatoba, null, pg_temp.us('1')) from ids, c $$, 'TC401', null,
  'PT-01: não inclui unidade em outro condomínio');
-- Andar (unidade numerada por andar: o mesmo número em andares diferentes).
select is((select plataforma_incluir_unidades(sindica, ipe, torre_b, '[{"identificacao": "1", "andar": "10"}, {"identificacao": "1", "andar": "Térreo"},
            {"identificacao": "1", "andar": "2"}, {"identificacao": "2", "andar": "2"}]') ->> 'criadas' from ids, c, bl), '4',
  'o mesmo número vale em andares diferentes');
select is((select plataforma_incluir_unidades(sindica, ipe, torre_b, '[{"identificacao": "1", "andar": "2"}]') -> 'jaExistiam' from ids, c, bl),
  '["2º andar · 1"]'::jsonb, 'no mesmo andar, não repete');
select is((select array_agg(x ->> 'andar') from jsonb_array_elements((select plataforma_unidades(sindica, ipe) -> 'unidades' from ids, c)) x
            where x ->> 'blocoId' = (select torre_b::text from bl) and x ->> 'andar' is not null),
  array['Térreo', '2', '2', '10'], 'térreo primeiro, depois os andares em ordem');
select is((teste.erro($$ select plataforma_definir_estrutura(sindica, ipe, (plataforma_unidades(sindica, ipe) -> 'estrutura' ->> 'versao')::int, 'NENHUM', true)
            from ids, c $$)) -> 'detalhe' ->> 'motivo', 'ESTRUTURA_COM_BLOCOS', 'não tira a divisão com blocos ativos');
select is((teste.erro($$ select plataforma_definir_estrutura(sindica, ipe, (plataforma_unidades(sindica, ipe) -> 'estrutura' ->> 'versao')::int, 'TORRE', false)
            from ids, c $$)) -> 'detalhe' ->> 'motivo', 'ESTRUTURA_COM_ANDARES', 'não deixa de usar andar com unidades que têm andar');

create temp table un as select
  (select id from unidades, c where condominio_id = ipe and identificacao = '101' and bloco_id = (select torre_a from bl)) as a101,
  (select id from unidades, c where condominio_id = ipe and identificacao = '102') as a102,
  (select id from unidades, c where condominio_id = ipe and identificacao = '201') as a201,
  (select id from unidades, c where condominio_id = ipe and identificacao = 'Loja 2') as loja2;
select is((teste.erro($$ select plataforma_alterar_unidade(sindica, ipe, a102, 1, '101', (select torre_a from bl), null, null) from ids, c, un $$))
  -> 'detalhe' ->> 'motivo', 'UNIDADE_REPETIDA', 'renomear para uma que já existe no bloco não');
select is((select plataforma_alterar_unidade(sindica, ipe, loja2, 1, 'Loja 02', null, null, null) from ids, c, un), 2, 'renomear a unidade');
select throws_ok($$ delete from unidades where id = (select a201 from un) $$, 'TC010', null, 'unidade não se apaga');

-- Contato e vínculo (MU-01, MU-08): cadastro breve, vários por unidade, um principal.
create temp table ct as select
  plataforma_incluir_contato(sindica, ipe, a101, null, 'Marina Souza', '+5561999990001', 'PROPRIETARIO', true, true) as marina,
  plataforma_incluir_contato(sindica, ipe, a101, null, 'Pedro Souza', '+5561999990002', 'FAMILIAR', false, false) as pedro
  from ids, c, un;
select is((select estado from contatos_unidade, ct where id = (marina ->> 'vinculoId')::uuid), 'CONFIRMADO',
  'MU-02: o que o síndico inclui já nasce confirmado');
select is((select confirmado_por from contatos_unidade, ct where id = (marina ->> 'vinculoId')::uuid), (select sindica from ids),
  'e a confirmação tem autor');
select is((select jsonb_array_length(plataforma_unidade(sindica, ipe, a101) -> 'contatos') from ids, c, un), 2, 'MU-08: vários contatos na unidade');
select is((select x ->> 'nome' from jsonb_array_elements((select plataforma_unidade(sindica, ipe, a101) -> 'contatos' from ids, c, un)) x limit 1),
  'Marina Souza', 'o principal vem primeiro');
select is((select principal from contatos_unidade, ct where id = (pedro ->> 'vinculoId')::uuid), false, 'só um principal');
select lives_ok($$ select plataforma_alterar_vinculo_unidade(sindica, ipe, (pedro ->> 'vinculoId')::uuid, 1, 'FAMILIAR', true, false) from ids, c, ct $$,
  'trocar o principal');
select is((select count(*)::int from contatos_unidade, un where unidade_id = a101 and principal), 1, 'o principal anterior deixa de ser');
select is((select recebe_comunicados from contatos_unidade, ct where id = (pedro ->> 'vinculoId')::uuid), false, 'MU-08: preferência de comunicados');
select is((teste.erro($$ select plataforma_incluir_contato(sindica, ipe, a101, null, 'Ana', '61 99999', 'MORADOR', false, true) from ids, c, un $$))
  -> 'detalhe', '{"campos": ["telefone"]}'::jsonb, 'MU-01: telefone fora do formato é recusado');
select is((teste.erro($$ select plataforma_incluir_contato(sindica, ipe, a101, null, 'Ana', '+5561999990003', 'VIZINHO', false, true) from ids, c, un $$))
  -> 'detalhe', '{"campos": ["relacao"]}'::jsonb, 'relação desconhecida é recusada');
select is((teste.erro($$ select plataforma_incluir_contato(sindica, ipe, a101, (marina ->> 'contatoId')::uuid, null, null, 'MORADOR', false, true)
                         from ids, c, un, ct $$)) -> 'detalhe' ->> 'motivo', 'CONTATO_JA_NA_UNIDADE', 'o mesmo contato duas vezes na unidade não');
select lives_ok($$ select plataforma_incluir_contato(sindica, ipe, a201, (marina ->> 'contatoId')::uuid, null, null, 'PROPRIETARIO', true, true)
                   from ids, c, un, ct $$, 'MU-04: o mesmo contato em outra unidade');
select is((select x -> 'outrasUnidades' from jsonb_array_elements((select plataforma_unidade(sindica, ipe, a101) -> 'contatos' from ids, c, un)) x
            where x ->> 'nome' = 'Marina Souza'), '["Torre A · 201"]'::jsonb, 'a ficha mostra as outras unidades do contato');
select is((select count(*)::int from historico, c where condominio_id = ipe and dados::text ~* 'marina|5561'), 0,
  'PT-13: o histórico não guarda nome nem telefone');

-- Telefone não prova identidade (MU-02, MU-03).
create temp table tel as select plataforma_incluir_contato(sindica, ipe, a102, null, 'Joana Lima', '+5561999990001', 'INQUILINO', true, true) as joana
  from ids, c, un;
select is((select joana -> 'avisos' from tel), '["TELEFONE_COMPARTILHADO"]'::jsonb, 'MU-03: telefone já usado em outro contato só avisa');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561999990001')), 3,
  'MU-03: o telefone compartilhado leva a todas as unidades, para perguntar qual');
select is((select count(*)::int from unidades_do_telefone((select jatoba from c), '+5561999990001')), 0,
  'PT-01: o telefone não acha nada em outro condomínio');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561000000000')), 0, 'MU-02: número desconhecido não acha nada');
select is((select plataforma_alterar_contato(sindica, ipe, (joana ->> 'contatoId')::uuid, 1, 'Joana Lima', '+5561988887777') -> 'avisos' from ids, c, tel),
  '[]'::jsonb, 'corrigir o telefone do contato');
select is((select dados from historico, tel where acao = 'contato.alterado' and entidade_id = joana ->> 'contatoId'),
  '{"campos": ["numero"]}'::jsonb, 'o histórico diz o que mudou, sem o número');

-- Pendente e confirmação (MU-02).
create temp table imp as select plataforma_importar_moradores(sindica, ipe, '[
  {"bloco": "Torre A", "unidade": "202", "nome": "Rui Alves", "telefone": "+5561977770001", "relacao": "MORADOR"},
  {"bloco": "Torre C", "unidade": "11", "nome": "Lia Reis", "telefone": "+5561977770002", "relacao": "INQUILINO"},
  {"bloco": "torre c", "unidade": "12", "nome": "Lia Reis", "telefone": "+5561977770002"},
  {"bloco": null, "unidade": "Loja 9", "nome": "Padaria Sol", "telefone": "+556133330000", "relacao": "OUTRO"},
  {"bloco": "Torre A", "unidade": "101", "nome": "Marina Souza", "telefone": "+5561999990001", "relacao": "PROPRIETARIO"}
]') as r from ids, c;
select is((select r from imp), '{"linhas": 5, "blocos": 1, "contatos": 3, "unidades": 3, "vinculos": 4, "ignoradas": 1}'::jsonb,
  'F3.3: a planilha cria o que falta, reaproveita o contato e ignora o que já existe');
select is((select count(*)::int from contatos_unidade, c where condominio_id = ipe and origem = 'PLANILHA' and estado = 'PENDENTE'), 4,
  'MU-02: o que vem da planilha nasce pendente');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561977770001')), 0,
  'MU-02: vínculo pendente não dá acesso a nada');
select is((teste.erro($$ select plataforma_importar_moradores(sindica, ipe, '[{"unidade": "X9", "nome": "A", "telefone": "+5561977770009"},
            {"unidade": "", "nome": "B", "telefone": "123"}]') from ids, c $$)) -> 'detalhe',
  '{"campos": ["unidade", "telefone"], "linha": 2, "motivo": "LINHA_INVALIDA"}'::jsonb, 'a linha com erro é apontada');
select is((select count(*)::int from unidades, c where condominio_id = ipe and identificacao = 'X9'), 0, 'e nada da planilha com erro fica (tudo ou nada)');
select is((select plataforma_painel(sindica, ipe) -> 'moradores' ->> 'aConfirmar' from ids, c), '4', 'o painel conta os contatos a confirmar');
select is((select plataforma_importar_moradores(davi, jatoba, '[{"bloco": "Quadra 1", "andar": "1", "unidade": "Casa 3", "nome": "Lia Reis",
            "telefone": "+5561977770002"}]', 'QUADRA') ->> 'unidades' from ids, c), '1', 'a planilha traz o andar');
select is((select (agrupamento, usa_andar)::text from configuracao_condominio, c where condominio_id = jatoba), '(QUADRA,t)',
  'planilha com divisão e andar ajusta a estrutura, com o nome da coluna');
create temp table pend as select array_agg(jsonb_build_object('id', id, 'versao', versao)) as itens
  from contatos_unidade, c where condominio_id = ipe and estado = 'PENDENTE' and unidade_id <> (select id from unidades where identificacao = 'Loja 9');
select is((select plataforma_confirmar_contatos(sindica, ipe, to_jsonb(itens)) from ids, c, pend), 3, 'confirmar vários de uma vez');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561977770002')), 2, 'confirmado, o telefone passa a achar as unidades');
select is((teste.erro($$ select plataforma_confirmar_contatos(sindica, ipe, to_jsonb(itens)) from ids, c, pend $$)) ->> 'codigo', 'TC409',
  'AT-24: confirmar com a versão velha é conflito');
create temp table loja as select id, versao from contatos_unidade where unidade_id = (select id from unidades where identificacao = 'Loja 9');
select throws_ok($$ select plataforma_encerrar_vinculo_unidade(sindica, ipe, id, versao, 'MUDANCA', null) from ids, c, loja $$, 'TC422', null,
  'o pendente não sai por mudança: é recusado');
select lives_ok($$ select plataforma_encerrar_vinculo_unidade(sindica, ipe, id, versao, 'RECUSADO', null) from ids, c, loja $$,
  'MU-02: o síndico recusa o contato que não reconhece');
select is((select motivo_encerramento from contatos_unidade, loja where contatos_unidade.id = loja.id), 'RECUSADO', 'e fica recusado');
select is((select dados ->> 'evento' from historico, loja where acao = 'estado.mudou' and entidade_id = loja.id::text order by historico.id desc limit 1),
  'CONTATO_RECUSADO', 'a recusa vai para o histórico pelo guardião');

-- Mudança (MU-07).
create temp table mud as select
  (select jsonb_agg(jsonb_build_object('id', id, 'versao', versao)) from contatos_unidade, un where unidade_id = a101 and estado <> 'ENCERRADO') as saem
  from un;
select is((select plataforma_registrar_mudanca(sindica, ipe, a101, '2026-10-01', saem,
            '[{"nome": "Caio Nunes", "telefone": "+5561966660001", "relacao": "INQUILINO", "principal": true}]') from ids, c, un, mud),
  '{"saem": 2, "entram": 1}'::jsonb, 'MU-07: quem sai e quem entra numa só operação');
select is((select array_agg(distinct motivo_encerramento || ' ' || data_saida) from contatos_unidade, un where unidade_id = a101 and estado = 'ENCERRADO'),
  array['MUDANCA 2026-10-01'], 'a saída guarda o motivo e a data');
select is((select jsonb_array_length(plataforma_unidade(sindica, ipe, a101) -> 'anteriores') from ids, c, un), 2, 'quem saiu aparece em anteriores');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561999990002')), 0, 'MU-07: quem saiu não fala mais pela unidade');
select is((select count(*)::int from unidades_do_telefone((select ipe from c), '+5561999990001')), 1,
  'a proprietária continua só na outra unidade dela');
select throws_ok($$ update contatos_unidade set relacao = 'OUTRO' where id = (select (pedro ->> 'vinculoId')::uuid from ct) $$, 'TC422', null,
  'vínculo encerrado não muda');
select is((teste.erro($$ select plataforma_registrar_mudanca(sindica, ipe, a101, '2026-10-01', '[]', '[]') from ids, c, un $$)) -> 'detalhe' ->> 'motivo',
  'MUDANCA_VAZIA', 'mudança sem ninguém não');
select is((teste.erro($$ select plataforma_registrar_mudanca(sindica, ipe, a101, '2026-10-01', '[]',
            '[{"nome": "X", "telefone": "1", "relacao": "MORADOR"}]') from ids, c, un $$)) -> 'detalhe', '{"campos": ["telefone"]}'::jsonb,
  'quem entra com telefone inválido derruba a mudança inteira');

-- Desativar só sem nada ativo dentro.
select is((teste.erro($$ select plataforma_alterar_unidade(sindica, ipe, a101, 1, '101', (select torre_a from bl), null, false) from ids, c, un $$))
  -> 'detalhe' ->> 'motivo', 'UNIDADE_COM_CONTATOS', 'unidade com contato ativo não se desativa');
select is((teste.erro($$ select plataforma_salvar_bloco(sindica, ipe, torre_b, 1, 'Torre B', null, false) from ids, c, bl $$))
  -> 'detalhe' ->> 'motivo', 'BLOCO_COM_UNIDADES', 'bloco com unidade ativa não se desativa');

-- Remover dados pessoais (PT-11).
select is((teste.erro($$ select plataforma_remover_dados_contato(sindica, ipe, (marina ->> 'contatoId')::uuid, 1) from ids, c, ct $$))
  -> 'detalhe' ->> 'motivo', 'CONTATO_COM_UNIDADE', 'PT-11: contato ainda numa unidade não tem os dados removidos');
select lives_ok($$ select plataforma_remover_dados_contato(sindica, ipe, (pedro ->> 'contatoId')::uuid, 1) from ids, c, ct $$,
  'PT-11: quem saiu pode ter os dados removidos');
select is((select (nome, telefone)::text from contatos, ct where id = (pedro ->> 'contatoId')::uuid), '(,)', 'nome e telefone saem');
select is((select x ->> 'dadosRemovidos' from jsonb_array_elements((select plataforma_unidade(sindica, ipe, a101) -> 'anteriores' from ids, c, un)) x
            where x ->> 'contatoId' = (select pedro ->> 'contatoId' from ct)), 'true', 'e a unidade mostra que os dados foram removidos');
select is((teste.erro($$ select plataforma_incluir_contato(sindica, ipe, a102, (pedro ->> 'contatoId')::uuid, null, null, 'MORADOR', false, true)
                         from ids, c, un, ct $$)) -> 'detalhe' ->> 'motivo', 'CONTATO_REMOVIDO', 'contato removido não volta a uma unidade');

-- Permissão Cadastrar moradores (CF-03): a pessoa autorizada inclui, mas só o síndico confirma.
select lives_ok($$ select plataforma_alterar_pessoa(sindica, ipe, v_bruna, 1, 'Secretária', array['CONFIGURAR', 'CADASTRAR']) from ids, c, vs $$,
  'CF-03: o síndico dá a permissão Cadastrar moradores');
select ok((select plataforma_unidades(bruna, ipe) ->> 'podeEditar' = 'true' and plataforma_unidades(bruna, ipe) ->> 'podeConfirmar' = 'false' from ids, c),
  'ela vê e edita, mas não confirma');
create temp table br as select plataforma_incluir_contato(bruna, ipe, a201, null, 'Teo Dias', '+5561955550001', 'MORADOR', false, true) as teo
  from ids, c, un;
select is((select estado from contatos_unidade, br where id = (teo ->> 'vinculoId')::uuid), 'PENDENTE',
  'CF-03 e MU-02: o que a pessoa autorizada inclui nasce a confirmar');
select throws_ok($$ select plataforma_confirmar_contatos(bruna, ipe, jsonb_build_array(jsonb_build_object('id', teo ->> 'vinculoId', 'versao', 1)))
                    from ids, c, br $$, 'TC401', null, 'confirmar fica só com o síndico');
select throws_ok($$ select plataforma_encerrar_vinculo_unidade(bruna, ipe, (teo ->> 'vinculoId')::uuid, 1, 'RECUSADO', null) from ids, c, br $$,
  'TC401', null, 'recusar também');
select lives_ok($$ select plataforma_alterar_pessoa(sindica, ipe, v_bruna, 2, 'Secretária', array['CONFIGURAR']) from ids, c, vs $$,
  'a permissão é retirada');
select throws_ok($$ select plataforma_unidades(bruna, ipe) from ids, c $$, 'TC401', null, 'CF-04: retirada, para na hora');

-- Busca (PT-17): páginas, busca por nome, unidade e telefone, sem curinga do usuário.
select is((select plataforma_moradores(sindica, ipe, null, null, 1) ->> 'total' from ids, c), '7', 'a lista mostra os vínculos ativos');
select is((select plataforma_moradores(sindica, ipe, 'lia', null, 1) ->> 'total' from ids, c), '2', 'busca pelo nome');
select is((select plataforma_moradores(sindica, ipe, '7770001', null, 1) -> 'itens' -> 0 ->> 'unidade' from ids, c), '202', 'busca pelo telefone');
select is((select plataforma_moradores(sindica, ipe, '%', null, 1) ->> 'total' from ids, c), '0', 'o % digitado é texto, não curinga');

select * from finish();
rollback;

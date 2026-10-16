-- Passo 1 (F1): Console TRÍADE. Funções internas só nos clientes atribuídos (PI-10), carteira
-- com estágio (PI-01), ficha (PI-02, CF-01), cenário (V-04 a V-06, CF-12), convite do síndico
-- (CF-02), notas internas (PI-06) e histórico administrativo (PI-12).
begin;
select plan(56);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Fábio', 'FINANCEIRO', 'SUPORTE') as fin,
  teste.equipe('Sueli', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as sindica,
  gen_random_uuid() as sessao;
-- A conta do síndico convidado vem do Auth antes do vínculo.
insert into auth.users (id, email) select gen_random_uuid(), 'convidado@exemplo.invalid';
create temp table conta as select id as convidado from auth.users where email = 'convidado@exemplo.invalid';

-- Cadastrar (PI-10: só administração).
select throws_ok($$ select console_criar_condominio(impl, 'Residencial Ipê', 'Brasília', 'DF', null) from ids $$,
  'TC401', null, 'PI-10: implantação não cadastra condomínio');
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', 'SEM_PORTARIA') as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Goiânia', 'GO', null) as jatoba
  from ids;
select is((select array_agg(nome order by nome) from ids, console_carteira(adm)), array['Edifício Jatobá', 'Residencial Ipê'],
  'V-10: quem cadastrou vê os clientes na carteira');
select is((select estagio from ids, console_carteira(adm) where nome = 'Residencial Ipê'), 'IMPLANTACAO',
  'PI-01: o cliente nasce em implantação');
select is((select situacoes from ids, console_carteira(adm) where nome = 'Residencial Ipê'),
  array['SEM_SINDICO', 'SEM_NUMERO_WHATSAPP', 'SEM_CONTATO', 'SEM_CONTRATO'],
  'PI-01: situações a tratar calculadas da ficha');
select ok((select 'SEM_CENARIO' = any (situacoes) from ids, console_carteira(adm) where nome = 'Edifício Jatobá'),
  'PI-01: sem cenário escolhido também é situação a tratar');
select throws_ok($$ select console_criar_condominio(adm, 'X', 'Brasília', 'DF', null) from ids $$, 'TC422', null,
  'nome curto demais é recusado');
select throws_ok($$ select console_criar_condominio(adm, 'Residencial Y', 'Brasília', 'ZZ', null) from ids $$, 'TC422', null,
  'UF inexistente é recusada');

-- Só os clientes atribuídos (PI-10).
select is((select count(*)::int from ids, console_carteira(impl)), 0, 'PI-10: sem atribuição, a carteira vem vazia');
select throws_ok($$ select console_ficha(impl, ipe) from ids, c $$, 'TC401', null, 'PI-10: nem abre a ficha de cliente não atribuído');
select is((teste.erro($$ select console_atribuir(adm, ipe, impl, 'FINANCEIRO') from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'FUNCAO_NAO_ATRIBUIDA', 'PI-10: só atribui com uma função que a pessoa tem');
create temp table at as select
  console_atribuir(adm, ipe, impl, 'IMPLANTACAO') as a_impl,
  console_atribuir(adm, ipe, fin, 'FINANCEIRO') as a_fin
  from ids, c;
select throws_ok($$ select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c $$, 'TC422', null, 'a mesma atribuição duas vezes não');
select throws_ok($$ select console_atribuir(impl, ipe, sup, 'SUPORTE') from ids, c $$, 'TC401', null, 'implantação não atribui clientes');
select is((select array_agg(nome) from ids, console_carteira(impl)), array['Residencial Ipê'], 'PI-10: atribuída, vê só o cliente dela');

-- Ficha (PI-02, CF-01) com versão (AT-24).
select is((select console_ficha(impl, ipe) -> 'condominio' ->> 'versao' from ids, c), '1', 'implantação abre a ficha');
select is((select console_editar_ficha(impl, ipe, 1, 'Residencial Ipê', 'Brasília', 'DF', 'SQS 308 bloco C',
            '+5561999990001', '[{"nome":"Ana","papel":"Síndica","telefone":"+5561988880000"}]') from ids, c),
  2, 'CF-01: implantação preenche a ficha');
select is((teste.erro($$ select console_editar_ficha(impl, ipe, 1, 'Outro nome', 'Brasília', 'DF', null, null, '[]') from ids, c $$)) ->> 'codigo',
  'TC409', 'AT-24: editar com a versão velha é conflito');
select is((select dados from historico where acao = 'ficha.alterada' and entidade_id = (select ipe::text from c)),
  '{"campos": ["endereco", "numeroWhatsapp", "contatos"]}'::jsonb, 'o histórico guarda quais campos mudaram, não os contatos');
select is((teste.erro($$ select console_editar_ficha(adm, jatoba, 1, 'Edifício Jatobá', 'Goiânia', 'GO', null, '+5561999990001', '[]') from ids, c $$))
  -> 'detalhe', '{"campos": ["numeroWhatsapp"]}'::jsonb, 'W-01: cada número institucional é de um condomínio só');
select is((teste.erro($$ select console_editar_ficha(adm, jatoba, 1, 'Edifício Jatobá', 'Goiânia', 'GO', null, null,
            '[{"nome":"Zé","papel":"Zelador"}]') from ids, c $$)) ->> 'codigo', 'TC422', 'contato sem telefone nem e-mail é recusado');
select is((teste.erro($$ select console_editar_ficha(adm, jatoba, 1, 'Edifício Jatobá', 'Goiânia', 'GO', null, '61999990001', '[]') from ids, c $$)) ->> 'codigo',
  'TC422', 'número fora do formato internacional é recusado');
select throws_ok($$ select console_editar_ficha(fin, ipe, 2, 'Residencial Ipê', 'Brasília', 'DF', null, null, '[]') from ids, c $$,
  'TC401', null, 'PI-10: financeiro não edita a ficha');
select lives_ok($$ select console_ficha(fin, ipe) from ids, c $$, 'financeiro consulta a ficha');

-- Contrato: só administração (PI-10: implantação não muda contrato).
select throws_ok($$ select console_alterar_contrato(impl, ipe, 1, 'CT-2026-001') from ids, c $$, 'TC401', null,
  'PI-10: implantação não muda o contrato');
select is((select console_alterar_contrato(adm, ipe, 1, 'CT-2026-001') from ids, c), 2, 'PI-02: administração registra a referência do contrato');
select ok((select console_ficha(impl, ipe) -> 'permissoes' from ids, c) ? 'console.ficha.editar'
          and not ((select console_ficha(impl, ipe) -> 'permissoes' from ids, c) ? 'console.contrato.editar'),
  'a ficha diz o que a pessoa pode fazer nela');

-- Cenário (V-04, V-05, V-06, CF-12).
select is((select array_agg(codigo order by ordem) from cenarios), array['SEM_PORTARIA', 'PORTARIA_REMOTA', 'PORTARIA_PRESENCIAL'],
  'V-04 a V-06: os três cenários do prédio');
select is((select console_escolher_cenario(impl, ipe, 2, 'PORTARIA_REMOTA') from ids, c), 3, 'CF-12: o cenário troca depois');
select is((select dados from historico where acao = 'cenario.escolhido'), '{"de": "SEM_PORTARIA", "para": "PORTARIA_REMOTA"}'::jsonb,
  'a troca de cenário fica no histórico com antes e depois');
select is((teste.erro($$ select console_escolher_cenario(impl, ipe, 3, 'CASTELO') from ids, c $$)) ->> 'codigo', 'TC422', 'cenário desconhecido é recusado');
select is((select count(*)::int from vinculos v, c where v.condominio_id = c.ipe and v.funcao in ('SINDICO')), 0,
  'V-06: o cenário não cria síndico, porteiro nem equipe');

-- Estágio (PI-01): implantação conclui só com síndico.
select is((teste.erro($$ select console_mudar_estagio(impl, ipe, 2, 'ATIVO', null) from ids, c $$)) -> 'detalhe' ->> 'motivo',
  'SEM_SINDICO', 'PI-01: implantação não conclui sem síndico');

-- Convite do síndico (CF-02): conta própria, ligada ao condomínio.
create temp table vs as select console_vincular_sindico(impl, ipe, convidado, 'Ana Souza') as v_sindico from ids, c, conta;
select ok((select acesso_plataforma(convidado) from conta), 'CF-02: o síndico convidado entra na Plataforma');
select is((select array_agg(nome) from conta, meus_condominios(convidado)), array['Residencial Ipê'], 'CF-02: ligado só ao condomínio do convite');
select is((teste.erro($$ select console_vincular_sindico(impl, ipe, convidado, 'Ana Souza') from ids, c, conta $$)) -> 'detalhe' ->> 'motivo',
  'JA_SINDICO', 'o mesmo síndico não é convidado duas vezes');
select lives_ok($$ select console_vincular_sindico(adm, jatoba, convidado, 'Outro nome') from ids, c, conta $$,
  'MU-04: o mesmo síndico em outro condomínio (síndico profissional)');
select is((select nome from pessoas, conta where id = convidado), 'Ana Souza', 'quem já tem conta mantém o nome');
select is((select console_mudar_estagio(impl, ipe, 2, 'ATIVO', 'Síndica fez o primeiro acesso') from ids, c), 3,
  'PI-01: com síndico, a implantação conclui');
select is((select interno from historico where acao = 'estado.mudou' and entidade = 'clientes' and dados ->> 'para' = 'ATIVO'), true,
  'a mudança de estágio entra no histórico como interna');
select throws_ok($$ select console_mudar_estagio(adm, ipe, 3, 'IMPLANTACAO', null) from ids, c $$, 'TC023', null,
  'de ativo não volta para implantação');

-- Notas internas (PI-06).
select lives_ok($$ select console_escrever_nota(fin, ipe, 'Boleto de outubro combinado para o dia 10.') from ids, c $$,
  'PI-06: financeiro escreve nota interna');
select throws_ok($$ select * from ids, c, console_notas(sup, ipe) $$, 'TC401', null, 'suporte não atribuído não lê as notas');
select throws_ok($$ update notas_internas set texto = 'x' $$, 'TC010', null, 'nota interna não se altera nem se apaga');

-- O cliente nunca vê o que é interno (PI-06), mesmo com o contexto do próprio condomínio.
select set_config('teste.convidado', (select convidado::text from conta), true),
       set_config('teste.ipe', (select ipe::text from c), true);
set local role dominio;
select set_config('app.pessoa_id', current_setting('teste.convidado'), true),
       set_config('app.condominio_id', current_setting('teste.ipe'), true);
select is((select count(*)::int from clientes) + (select count(*)::int from notas_internas), 0,
  'PI-06: o síndico não lê carteira nem notas internas');
select is((select count(*)::int from historico where interno), 0, 'PI-06: nem os eventos internos do histórico');
select ok((select count(*)::int from historico where acao = 'ficha.alterada') > 0, 'mas vê as mudanças da ficha do condomínio');
reset role;
select throws_ok($$ select console_ficha(convidado, ipe) from conta, c $$, 'TC401', null, 'síndico não usa as funções do Console');
select throws_ok($$ select escolher_condominio(impl, sessao, ipe) from ids, c $$, 'TC401', null,
  'atribuição da equipe não abre o painel do síndico');

-- Histórico administrativo (PI-12).
select ok((select count(*)::int from ids, c, console_historico(impl, ipe) where interno) >= 3
          and (select count(*)::int from ids, c, console_historico(impl, ipe) where acao = 'ficha.alterada') = 1,
  'PI-12: a equipe vê o histórico do cliente, inclusive o interno');
select is((select autor_nome from ids, c, console_historico(impl, ipe) where acao = 'nota.escrita'), 'Fábio', 'com o nome de quem fez');

-- Rever funções e desativar (PI-10).
select lives_ok($$ select console_definir_funcoes(adm, impl, array['SUPORTE']) from ids $$, 'PI-10: administração revê as funções');
select is((select count(*)::int from ids, console_carteira(impl)), 0, 'PI-10: sem a função, a atribuição para na hora');
select is((teste.erro($$ select console_definir_funcoes(adm, adm, array['SUPORTE']) from ids $$)) -> 'detalhe' ->> 'motivo',
  'ULTIMA_ADMINISTRACAO', 'a equipe nunca fica sem administração');
select lives_ok($$ select console_desativar_membro(adm, fin) from ids $$, 'administração desativa alguém da equipe');
select ok(not (select acesso_console(fin) from ids), 'desativado não entra mais no Console');

-- Estrutura: toda tabela interna exige alguém da equipe no contexto; a primeira pessoa da
-- equipe só entra uma vez pelo SQL.
select is(
  (select array_agg(t.tabela order by t.tabela) from tabelas_internas t
    where not exists (select 1 from pg_policy p where p.polrelid = ('public.' || t.tabela)::regclass
                        and p.polname = 'isolamento_condominio' and pg_get_expr(p.polqual, p.polrelid) ~ 'contexto_equipe\(\)')),
  null, 'PI-06: toda tabela interna só aparece para a equipe');
select throws_ok($$ call iniciar_equipe(gen_random_uuid(), 'Outra pessoa') $$, 'P0001', null, 'a primeira administração só entra uma vez');

select * from finish();
rollback;

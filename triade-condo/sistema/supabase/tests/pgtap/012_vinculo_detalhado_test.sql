-- Passo 3b (F3.6): vínculo detalhado. Proprietário, responsável e mora na unidade
-- independentes, ligação e parentesco, período de ocupação, mudança com as datas, ocupação
-- da unidade e os contadores da lista (MU-10, MU-08, MU-07, MU-11, PT-11).
begin;
select plan(45);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as sindica,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', 'PORTARIA_REMOTA') as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select teste.vincular(sindica, ipe), teste.vincular(davi, jatoba) from ids, c;
create temp table un as select
  plataforma_incluir_unidades(sindica, ipe, null, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"},
                                                    {"identificacao": "104"}, {"identificacao": "105"}]') as r
  from ids, c;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103,
  (select id from unidades where identificacao = '104') as u104,
  (select id from unidades where identificacao = '105') as u105;

-- Marcações (MU-10).
create temp table p as select
  plataforma_incluir_pessoa_unidade(sindica, ipe, u102, null, 'Roberto Dias', '+5561977771212',
    '{"proprietario": true, "principal": false, "mora": false}', true) as roberto,
  plataforma_incluir_pessoa_unidade(sindica, ipe, u102, null, 'Joana Lima', '+5561988887777',
    '{"principal": true, "mora": true, "ligacao": "INQUILINO", "ocupaDesde": "2025-03-01"}', true) as joana,
  plataforma_incluir_pessoa_unidade(sindica, ipe, u102, null, 'Paulo Lima', '+5561988887778',
    '{"mora": true, "ligacao": "FAMILIAR", "parentesco": "CONJUGE", "ocupaDesde": "2025-03-01"}', false) as paulo,
  plataforma_incluir_pessoa_unidade(sindica, ipe, u101, null, 'Marina Souza', '+5561999990001',
    '{"proprietario": true, "principal": true, "mora": true}', true) as marina
  from ids, c, u;
select is((select (proprietario, principal, mora, ligacao, relacao)::text from contatos_unidade, p where id = (marina ->> 'vinculoId')::uuid),
  '(t,t,t,,PROPRIETARIO)', 'MU-10: a mesma pessoa é proprietária, responsável e mora');
select is((select (proprietario, mora, relacao)::text from contatos_unidade, p where id = (roberto ->> 'vinculoId')::uuid),
  '(t,f,PROPRIETARIO)', 'o proprietário pode não morar');
select is((select (ligacao, parentesco, ocupa_desde, relacao)::text from contatos_unidade, p where id = (paulo ->> 'vinculoId')::uuid),
  '(FAMILIAR,CONJUGE,2025-03-01,FAMILIAR)', 'familiar com parentesco e data de entrada');
select is((select relacao from contatos_unidade, p where id = (joana ->> 'vinculoId')::uuid), 'INQUILINO',
  'a relação de antes sai das marcações (pedidos e lista continuam iguais)');
select is((select p.joana ->> 'proprietarioId' from p), null, 'inquilina em unidade com proprietário não pede outro');

-- Recusas (MU-10).
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001', '{"mora": true}', true)
            from ids, c, u $$)) -> 'detalhe', '{"campos": ["ligacao"]}'::jsonb, 'quem não é proprietário diz a ligação');
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001',
            '{"proprietario": true, "ligacao": "INQUILINO"}', true) from ids, c, u $$)) -> 'detalhe', '{"campos": ["ligacao"]}'::jsonb,
  'proprietário não tem ligação');
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001',
            '{"ligacao": "OUTRO", "parentesco": "FILHO"}', true) from ids, c, u $$)) -> 'detalhe', '{"campos": ["parentesco"]}'::jsonb,
  'parentesco só para familiar');
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001',
            '{"mora": "sim", "ligacao": "VIZINHO", "parentesco": "PRIMO", "ocupaDesde": "2025-02-30"}', true) from ids, c, u $$)) -> 'detalhe',
  '{"campos": ["mora", "ligacao", "parentesco", "ocupaDesde"]}'::jsonb, 'cada campo errado é apontado');
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001',
            '{"ligacao": "OUTRO", "ocupaDesde": "1999-12-31"}', true) from ids, c, u $$)) -> 'detalhe', '{"campos": ["ocupaDesde"]}'::jsonb,
  'data de entrada fora do intervalo');
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Ana', '+5561900000001', null, true) from ids, c, u $$))
  -> 'detalhe', '{"campos": ["marcas"]}'::jsonb, 'sem marcações não');
select throws_ok($$ select plataforma_incluir_pessoa_unidade(sindica, jatoba, u103, null, 'Ana', '+5561900000001', '{"ligacao": "OUTRO"}', true)
                    from ids, c, u $$, 'TC401', null, 'PT-01: não inclui em outro condomínio');
select throws_ok($$ update contatos_unidade set ligacao = 'INQUILINO' where id = (select (marina ->> 'vinculoId')::uuid from p) $$, '23514', null,
  'o banco também não aceita proprietário com ligação');

-- Inquilino em unidade sem proprietário continua trazendo o dono do imóvel (MU-01).
select is((teste.erro($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Caio Nunes', '+5561966660001',
            '{"principal": true, "mora": true, "ligacao": "INQUILINO"}', true) from ids, c, u $$)) -> 'detalhe' ->> 'motivo', 'FALTA_PROPRIETARIO',
  'MU-01: inquilino sem proprietário no cadastro pede o proprietário');
create temp table q as select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Caio Nunes', '+5561966660001',
  '{"principal": true, "mora": true, "ligacao": "INQUILINO"}', true, '{"nome": "Sara Melo", "telefone": "+5561966660002"}') as caio
  from ids, c, u;
select is((select (proprietario, principal, mora, recebe_comunicados)::text from contatos_unidade, q where contato_id = (caio ->> 'proprietarioId')::uuid),
  '(t,f,f,f)', 'o dono do imóvel fica registrado sem morar, sem ser o responsável e sem os comunicados do dia a dia');
select lives_ok($$ select plataforma_incluir_pessoa_unidade(sindica, ipe, u103, null, 'Lia Nunes', '+5561966660003',
                   '{"mora": true, "ligacao": "FAMILIAR", "parentesco": "FILHO"}', true) from ids, c, u $$,
  'familiar do inquilino entra sem pedir proprietário de novo');

-- Ocupação da unidade e contadores (MU-10, MU-11).
select plataforma_incluir_pessoa_unidade(sindica, ipe, u104, null, 'Helena Rocha', '+5561955550001', '{"proprietario": true, "principal": true}', true)
  from ids, c, u;
select plataforma_incluir_pessoa_unidade(sindica, ipe, u105, null, 'Sílvio Prado', '+5561955550002', '{"mora": true, "ligacao": "OUTRO"}', true)
  from ids, c, u;
select is((select jsonb_object_agg(x ->> 'identificacao', x ->> 'ocupacao') from jsonb_array_elements((select plataforma_unidades(sindica, ipe) -> 'unidades' from ids, c)) x),
  '{"101": "PROPRIETARIO_MORA", "102": "ALUGADA", "103": "ALUGADA", "104": "VAZIA", "105": "CEDIDA"}'::jsonb,
  'MU-10: a ocupação de cada unidade');
select is((select plataforma_unidades(sindica, ipe) -> 'ocupacao' from ids, c),
  '{"aVenda": 0, "alugadas": 2, "comMorador": 4, "semResponsavel": 1, "proprietarioNaoMora": 3, "paraAlugar": 0}'::jsonb, 'MU-11: os contadores do topo');
select is((select (x ->> 'proprietarioNaoMora', x ->> 'proprietario', x ->> 'principal', x ->> 'principalRelacao')::text
             from jsonb_array_elements((select plataforma_unidades(sindica, ipe) -> 'unidades' from ids, c)) x where x ->> 'identificacao' = '102'),
  '(true,"Roberto Dias","Joana Lima",INQUILINO)', 'a lista diz o responsável e o proprietário que não mora');
select is((select (x ->> 'semResponsavel')::boolean from jsonb_array_elements((select plataforma_unidades(sindica, ipe) -> 'unidades' from ids, c)) x
            where x ->> 'identificacao' = '105'), true, 'unidade com gente e sem responsável aparece como pendência');
select is((select plataforma_unidade(sindica, ipe, u102) -> 'ocupacao' from ids, c, u),
  '{"moram": 2, "situacao": "ALUGADA", "proprietarioNaoMora": true}'::jsonb, 'a ficha traz a linha de ocupação');
select is((select x -> 'parentesco' from jsonb_array_elements((select plataforma_unidade(sindica, ipe, u102) -> 'contatos' from ids, c, u)) x
            where x ->> 'nome' = 'Paulo Lima'), '"CONJUGE"'::jsonb, 'e cada pessoa com as marcações');
select is((select x ->> 'nome' from jsonb_array_elements((select plataforma_unidade(sindica, ipe, u102) -> 'contatos' from ids, c, u)) x limit 1),
  'Joana Lima', 'o responsável vem primeiro');

-- Trocar o responsável e as marcações (MU-08, MU-10, AT-24).
select is((select plataforma_alterar_marcas_vinculo(sindica, ipe, (roberto ->> 'vinculoId')::uuid, 1,
            '{"proprietario": true, "principal": true, "mora": false}', true) from ids, c, p), 2, 'marcar outro responsável');
select is((select string_agg(ct.nome, ',') from contatos_unidade cu join contatos ct on ct.id = cu.contato_id, u
            where cu.unidade_id = u102 and cu.principal), 'Roberto Dias', 'quem era responsável deixa de ser, e continua morando');
select is((select mora from contatos_unidade, p where id = (joana ->> 'vinculoId')::uuid), true, 'Joana continua moradora');
select is((select dados from historico, p where acao = 'vinculo_unidade.alterado' and entidade_id = roberto ->> 'vinculoId'),
  '{"campos": ["responsavel"]}'::jsonb, 'o histórico diz o que mudou');
select is((teste.erro($$ select plataforma_alterar_marcas_vinculo(sindica, ipe, (roberto ->> 'vinculoId')::uuid, 1,
            '{"proprietario": true}', true) from ids, c, p $$)) ->> 'codigo', 'TC409', 'AT-24: versão velha é conflito');
select is((teste.erro($$ select plataforma_alterar_marcas_vinculo(sindica, ipe, (paulo ->> 'vinculoId')::uuid, 1,
            '{"mora": true, "ligacao": "OUTRO", "parentesco": "CONJUGE"}', false) from ids, c, p $$)) -> 'detalhe', '{"campos": ["parentesco"]}'::jsonb,
  'mudar a ligação sem tirar o parentesco não');
select lives_ok($$ select plataforma_alterar_vinculo_unidade(sindica, ipe, (paulo ->> 'vinculoId')::uuid, 1, 'FAMILIAR', false, true) from ids, c, p $$,
  'a chamada de antes, com a relação, ainda funciona');
select is((select (ligacao, parentesco, ocupa_desde, recebe_comunicados)::text from contatos_unidade, p where id = (paulo ->> 'vinculoId')::uuid),
  '(FAMILIAR,CONJUGE,2025-03-01,t)', 'e mantém o parentesco e a data de entrada');

-- Encerrar com a data de saída, em qualquer motivo menos a recusa (MU-07).
select is((teste.erro($$ select plataforma_encerrar_vinculo_unidade(sindica, ipe, (paulo ->> 'vinculoId')::uuid, 2, 'PEDIDO', '2025-01-10') from ids, c, p $$))
  -> 'detalhe', '{"campos": ["dataSaida"]}'::jsonb, 'a saída não fica antes da entrada');
select lives_ok($$ select plataforma_encerrar_vinculo_unidade(sindica, ipe, (paulo ->> 'vinculoId')::uuid, 2, 'PEDIDO', '2026-09-30') from ids, c, p $$,
  'encerrar a pedido, com a data');
select is((select x ->> 'ocupaDesde' || ' a ' || (x ->> 'dataSaida') from jsonb_array_elements((select plataforma_unidade(sindica, ipe, u102) -> 'anteriores' from ids, c, u)) x),
  '2025-03-01 a 2026-09-30', 'quem saiu fica com o período de ocupação inteiro');

-- Mudança com as datas (MU-07, MU-10).
create temp table m as select
  (select jsonb_agg(jsonb_build_object('id', cu.id, 'versao', cu.versao)) from contatos_unidade cu, u
    where cu.unidade_id = u102 and cu.estado <> 'ENCERRADO' and not cu.proprietario) as saem
  from u;
select is((select plataforma_registrar_mudanca(sindica, ipe, u102, '2026-10-01', saem,
            '[{"nome": "Ivo Reis", "telefone": "+5561944440001", "principal": false, "mora": true, "ligacao": "INQUILINO"},
              {"nome": "Bia Reis", "telefone": "+5561944440002", "mora": true, "ligacao": "FAMILIAR", "parentesco": "CONJUGE"}]') from ids, c, u, m),
  '{"saem": 1, "entram": 2}'::jsonb, 'mudança com as marcações de quem entra');
select is((select array_agg(distinct ocupa_desde::text) from contatos_unidade, u where unidade_id = u102 and estado <> 'ENCERRADO' and not proprietario),
  array['2026-10-01'], 'quem entra ocupa desde a data da mudança');
select is((select data_saida::text from contatos_unidade, p where id = (joana ->> 'vinculoId')::uuid), '2026-10-01', 'quem sai ocupou até a data da mudança');
select is((select principal from contatos_unidade, p where id = (roberto ->> 'vinculoId')::uuid), true, 'o proprietário que fica continua responsável');
select is((teste.erro($$ select plataforma_registrar_mudanca(sindica, ipe, u101, '2026-10-01', '[]',
            '[{"nome": "X", "telefone": "+5561944440009", "mora": true}]') from ids, c, u $$)) -> 'detalhe', '{"campos": ["ligacao"]}'::jsonb,
  'quem entra sem ligação derruba a mudança');
select is((teste.erro($$ select plataforma_registrar_mudanca(sindica, ipe, u101, '2026-10-01', '[]',
            '[{"nome": "X", "telefone": "+5561944440009", "ligacao": "OUTRO", "principal": true},
              {"nome": "Y", "telefone": "+5561944440008", "ligacao": "OUTRO", "principal": true}]') from ids, c, u $$)) -> 'detalhe',
  '{"campos": ["entram"]}'::jsonb, 'só um responsável entre quem entra');

-- Planilha com as colunas novas (PI-04, MU-10).
create temp table imp as select plataforma_importar_moradores(sindica, ipe, '[
  {"unidade": "201", "nome": "Rui Alves", "telefone": "+5561933330001", "relacao": "PROPRIETARIO"},
  {"unidade": "201", "nome": "Ari Alves", "telefone": "+5561933330002", "relacao": "INQUILINO", "responsavel": true},
  {"unidade": "202", "nome": "Ida Lopes", "telefone": "+5561933330003", "relacao": "PROPRIETARIO", "responsavel": true, "ocupaDesde": "2024-05-01"},
  {"unidade": "202", "nome": "Léo Lopes", "telefone": "+5561933330004", "relacao": "FAMILIAR", "parentesco": "FILHO", "responsavel": true},
  {"unidade": "203", "nome": "Eva Melo", "telefone": "+5561933330005", "relacao": "PROPRIETARIO", "mora": false}
]') as r from ids, c;
select is((select r ->> 'vinculos' from imp), '5', 'a planilha com as colunas novas');
select is((select string_agg(ct.nome || ':' || cu.mora, ',' order by ct.nome) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
            where cu.proprietario and cu.origem = 'PLANILHA'), 'Eva Melo:false,Ida Lopes:true,Rui Alves:false',
  'proprietário sem a coluna mora mora quando a unidade não tem inquilino');
select is((select string_agg(ct.nome, ',' order by ct.nome) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
            where cu.principal and cu.origem = 'PLANILHA'), 'Ari Alves,Ida Lopes', 'só um responsável por unidade vem da planilha');
select is((select (parentesco, ocupa_desde)::text from contatos_unidade cu join contatos ct on ct.id = cu.contato_id where ct.nome in ('Léo Lopes')),
  '(FILHO,)', 'parentesco da planilha');
select is((teste.erro($$ select plataforma_importar_moradores(sindica, ipe, '[{"unidade": "9", "nome": "A", "telefone": "+5561933330009",
            "relacao": "MORADOR", "parentesco": "FILHO"}]') from ids, c $$)) -> 'detalhe',
  '{"campos": ["parentesco"], "linha": 1, "motivo": "LINHA_INVALIDA"}'::jsonb, 'a linha com parentesco que não cabe é apontada');

select * from finish();
rollback;

-- Link de cadastro da unidade e a fila do que chega por ele (F3.10; MU-09). Migration 0288,
-- desenho nos quadros 216 a 223 do canvas do novo frontend. O relógio fica em 23/10/2027.
begin;
select plan(67);

select ajustar_relogio(timestamptz '2027-10-23 09:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select teste.vincular(ana, ipe), teste.vincular(davi, jatoba),
       plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['CADASTRAR']),
       plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Zelador', array['RESPONDER'])
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.codigo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) ->> 'codigo' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}, {"identificacao": "103"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102,
  (select id from unidades where identificacao = '103') as u103;

-- ---------------------------------------------------------------------------------------
-- Criar o link (regra 1).

select is(pg_temp.codigo($$ select plataforma_criar_link_cadastro(gil, ipe, u102, '{}', 7) from ids, c, u $$),
  'TC401', 'PT-02: quem não cuida dos moradores não cria link de cadastro');
select is(pg_temp.campos($$ select plataforma_criar_link_cadastro(ana, ipe, u102, '{}', 10) from ids, c, u $$),
  '["dias"]', 'MU-09: o link vale 1, 3, 7, 15 ou 30 dias');
select is(pg_temp.campos($$ select plataforma_criar_link_cadastro(ana, ipe, u102, '{SENHA}', 7) from ids, c, u $$),
  '["pede"]', 'MU-09: o link só pede o que está na lista');
select is(pg_temp.campos($$ select plataforma_criar_link_cadastro(davi, jatoba, u102, '{}', 7) from ids, c, u $$),
  '["unidadeId"]', 'PT-01: não cria link para unidade de outro condomínio');

create temp table lk as select
  plataforma_criar_link_cadastro(bruna, ipe, u102, '{LIGACAO,EMAIL,ANIVERSARIO,FAMILIA,PETS,VEICULOS}', 7) as unidade,
  plataforma_criar_link_cadastro(ana, ipe, null, '{FAMILIA}', 30) as predio
  from ids, c, u;
select ok((select unidade ->> 'codigo' ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' from lk),
  'MU-09: quem cadastra moradores cria o link e recebe o código uma vez');
select ok(not exists (select 1 from links_cadastro l, lk where to_jsonb(l)::text like '%' || (lk.unidade ->> 'codigo') || '%')
          and exists (select 1 from codigos_sem_conta k, lk where k.hash = hash_codigo(lk.unidade ->> 'codigo') and k.tipo = 'CADASTRO'),
  'PT-07: o banco guarda só o hash do código');
select is((select unidade ->> 'expiraEm' from lk)::timestamptz, timestamptz '2027-10-30 09:00:00-03', 'MU-09: 7 dias a partir de agora');
select is((select unidade -> 'pede' from lk), '["ANIVERSARIO", "EMAIL", "FAMILIA", "LIGACAO", "PETS", "VEICULOS"]', 'MU-09: o que o link pede fica guardado');
select is((select jsonb_array_length(plataforma_links_cadastro(ana, ipe, u102) -> 'itens') from ids, c, u), 1,
  'MU-09: a janela da unidade lista os links valendo');
select is((select plataforma_links_cadastro(ana, ipe, null) -> 'itens' -> 0 ->> 'criadoPor' from ids, c), 'Síndica Ana',
  'MU-09: os links do prédio todo ficam à parte, com quem criou');
select is((select h.acao from historico h, u where h.entidade = 'unidade' and h.entidade_id = u102::text order by h.id desc limit 1),
  'unidade.link_cadastro_criado', 'PT-03: criar o link fica no histórico da unidade');

-- ---------------------------------------------------------------------------------------
-- A página sem conta.

select is(pg_temp.codigo($$ select publico_cadastro('AAAA-BBBB-CCCC', null) $$), 'TC404', 'MU-09: código que não existe não abre');
create temp table pub as select publico_cadastro(lk.unidade ->> 'codigo', null) as v from lk;
select is((select v ->> 'condominio' from pub), 'Residencial Ipê', 'MU-09: a página mostra o condomínio');
select is((select v ->> 'unidade' from pub), 'Torre A · 102', 'MU-09: e a unidade do link');
select ok((select not v ? 'unidades' and not v ? 'envio' from pub), 'MU-09: link da unidade não lista outras unidades');
select is((select jsonb_array_length(publico_cadastro(lk.predio ->> 'codigo', null) -> 'unidades') from lk), 3,
  'MU-09: link do prédio todo lista as unidades para a pessoa escolher');

select is(pg_temp.campos($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', null, '{"nome": " ", "telefone": "+5561966664321", "ligacao": "PROPRIETARIO"}') from lk $$),
  '["nome"]', 'MU-09: nome é obrigatório');
select is(pg_temp.campos($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', null, '{"nome": "Roberto Prado", "telefone": "123", "ligacao": "PROPRIETARIO"}') from lk $$),
  '["telefone"]', 'MU-09: telefone é obrigatório e válido');
select is(pg_temp.campos($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', null, '{"nome": "Roberto Prado", "telefone": "+5561966664321"}') from lk $$),
  '["ligacao"]', 'MU-09: quando o link pede, a ligação com a unidade é obrigatória');
select is(pg_temp.campos($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', null, '{"nome": "Roberto Prado", "telefone": "+5561966664321", "ligacao": "PROPRIETARIO",
  "familia": [{"nome": "Clara", "parentesco": "VIZINHA"}]}') from lk $$),
  '["familia"]', 'MU-06: o familiar mandado pelo link é conferido como no painel');
select is(pg_temp.campos($$ select publico_enviar_cadastro(lk.predio ->> 'codigo', null, '{"nome": "Ana Dias", "telefone": "+5561955551111"}') from lk $$),
  '["unidadeId"]', 'MU-09: no link do prédio todo a pessoa escolhe a unidade');

create temp table env as select publico_enviar_cadastro(lk.unidade ->> 'codigo', null,
  '{"nome": "Roberto Prado", "telefone": "+5561966664321", "ligacao": "PROPRIETARIO", "email": "roberto.prado@email.com",
    "aniversario": {"dia": 3, "mes": 11},
    "familia": [{"nome": "Clara Prado", "parentesco": "CONJUGE", "mora": false}, {"nome": "Téo Prado", "parentesco": "FILHO", "aniversario": null}],
    "pets": [{"nome": "Bolota", "especie": "CAO", "porte": "PEQUENO"}],
    "veiculos": [{"placa": "abc1d23", "tipo": "CARRO", "modelo": "Onix prata"}]}') as v from lk;
select ok((select length(v ->> 'chave') >= 40 from env), 'MU-09: quem manda recebe uma chave só sua');
select ok(not exists (select 1 from cadastros_link x, env where to_jsonb(x)::text like '%' || (env.v ->> 'chave') || '%'),
  'PT-07: o banco guarda só o hash da chave');
select is((select v -> 'envio' ->> 'estado' from env), 'ENVIADO', 'MU-09: o cadastro chega como enviado');
select is((select v -> 'envio' -> 'veiculos' -> 0 ->> 'placa' from env), 'ABC1D23', 'MU-09: a placa chega no formato do condomínio');
select is((select v -> 'envio' -> 'familia' -> 0 ->> 'mora' from env), 'false', 'MU-06: diz se o familiar mora');
select ok(not exists (select 1 from contatos where nome = 'Roberto Prado'), 'MU-09: antes de o síndico aprovar, nada entra no cadastro');

create temp table env2 as select publico_enviar_cadastro(lk.predio ->> 'codigo', null,
  format('{"nome": "Ana Dias", "telefone": "+5561955551111", "unidadeId": "%s", "email": "ignorado@email.com", "familia": [{"nome": "Lia", "parentesco": "FILHO"}]}', u103)::jsonb) as v
  from lk, u;
select is((select v -> 'envio' ->> 'unidade' from env2), 'Torre A · 103', 'MU-09: no link do prédio, o cadastro vai para a unidade escolhida');
select ok((select not (v -> 'envio' ? 'email') and not (v -> 'envio' ? 'ligacao') from env2), 'MU-09: o que o link não pede não é guardado');

-- Corrigir pelo mesmo link, com a chave.
select is(pg_temp.codigo($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', 'chave-que-nao-existe-1234567890', '{"nome": "X", "telefone": "+5561966664321"}') from lk $$),
  'TC404', 'MU-09: chave errada não corrige nada');
select is((select publico_enviar_cadastro(lk.unidade ->> 'codigo', env.v ->> 'chave',
  '{"nome": "Roberto Prado Lima", "telefone": "+5561966664321", "ligacao": "PROPRIETARIO", "email": "roberto.prado@email.com",
    "familia": [{"nome": "Clara Prado", "parentesco": "CONJUGE", "mora": false}], "pets": [{"nome": "Bolota", "especie": "CAO"}],
    "veiculos": [{"placa": "ABC1D23", "tipo": "CARRO"}]}') -> 'envio' ->> 'nome' from lk, env), 'Roberto Prado Lima',
  'MU-09: com a chave, a pessoa corrige o que mandou enquanto o síndico não conferiu');
select ok((select not (v ? 'chave') from (select publico_cadastro(lk.unidade ->> 'codigo', env.v ->> 'chave') as v from lk, env) x),
  'MU-09: a chave volta só uma vez, no primeiro envio');
select is((select publico_cadastro(lk.unidade ->> 'codigo', env.v ->> 'chave') -> 'envio' -> 'aniversario' from lk, env), null,
  'MU-09: corrigir sem o aniversário tira o aniversário');

-- ---------------------------------------------------------------------------------------
-- A fila em "A confirmar" (regra 7).

select is((select jsonb_array_length(plataforma_cadastros_link(ana, ipe, null) -> 'itens') from ids, c), 2, 'MU-09: a fila tem os dois cadastros');
select is((select jsonb_array_length(plataforma_cadastros_link(ana, ipe, u102) -> 'itens') from ids, c, u), 1, 'MU-09: e filtra por unidade');
select is((select jsonb_array_length(plataforma_cadastros_link(davi, jatoba, null) -> 'itens') from ids, c), 0, 'PT-01: outro condomínio não vê a fila');
select is((select (resumo_moradores(ipe) ->> 'aConfirmar')::integer from c), 2, 'MU-09: o resumo conta o que chegou pelo link em A confirmar');
select is((select (x ->> 'pendentes')::integer from ids, c, u, jsonb_array_elements(plataforma_unidades(ana, ipe) -> 'unidades') x
            where (x ->> 'id')::uuid = u102), 1, 'MU-09: a unidade conta o cadastro pelo link nos pendentes');
select is((select (plataforma_moradores(ana, ipe, null, 'PENDENTE', 1, u102) -> 'unidade' ->> 'nome') from ids, c, u), 'Torre A · 102',
  'MU-09: a lista de pessoas filtra pela unidade (Pendentes do menu da linha)');

-- ---------------------------------------------------------------------------------------
-- Aprovar (regra 5).

create temp table cad as select
  (select id from cadastros_link where unidade_id = u102) as roberto,
  (select id from cadastros_link where unidade_id = u103) as ana_dias
  from u;
select is(pg_temp.codigo($$ select plataforma_aprovar_cadastro_link(bruna, ipe, roberto, 2, 'Roberto Prado', '+5561966664321', 'PROPRIETARIO', null, '[]', '[]', '[]')
  from ids, c, cad $$), 'TC401', 'MU-02: só o síndico aprova o que veio pelo link');
select is(pg_temp.codigo($$ select plataforma_aprovar_cadastro_link(davi, jatoba, roberto, 2, 'Roberto Prado', '+5561966664321', 'PROPRIETARIO', null, '[]', '[]', '[]')
  from ids, c, cad $$), 'TC404', 'PT-01: síndico de outro condomínio não aprova');
select is(pg_temp.codigo($$ select plataforma_aprovar_cadastro_link(ana, ipe, roberto, 1, 'Roberto Prado', '+5561966664321', 'PROPRIETARIO', null, '[]', '[]', '[]')
  from ids, c, cad $$), 'TC409', 'AT-24: aprovar com versão antiga dá conflito');
select is(pg_temp.campos($$ select plataforma_aprovar_cadastro_link(ana, ipe, roberto, 2, 'Roberto Prado', '+5561966664321', null, null, '[]', '[]', '[]')
  from ids, c, cad $$), '["ligacao"]', 'MU-09: aprovar pede a ligação com a unidade');

update configuracao_condominio set email_ligado = true where condominio_id = (select ipe from c);
create temp table apr as select plataforma_aprovar_cadastro_link(ana, ipe, cad.roberto, 2, 'Roberto Prado', '+5561966664321', 'PROPRIETARIO',
  'roberto.prado@email.com', x.familia, '[]', x.veiculos) as v
  from ids, c, cad, cadastros_link x where x.id = cad.roberto;
select is((select ct.nome from contatos ct, apr where ct.id = (apr.v ->> 'contatoId')::uuid), 'Roberto Prado', 'MU-09: o síndico corrige o nome antes de aprovar');
select is((select (cu.estado, cu.proprietario, cu.mora)::text from contatos_unidade cu, apr, u where cu.contato_id = (apr.v ->> 'contatoId')::uuid and cu.unidade_id = u102),
  '(CONFIRMADO,t,f)', 'MU-09: aprovado entra confirmado, com a ligação escolhida (proprietário que não mora)');
select is((select email_situacao from contatos ct, apr where ct.id = (apr.v ->> 'contatoId')::uuid), 'PENDENTE', 'CD-13: o e-mail espera a própria pessoa confirmar');
select ok((select (v ->> 'confirmacaoNaFila')::boolean from apr), 'CD-13: a confirmação do e-mail vai para a fila');
select is((select string_agg(nome || ':' || mora, ',' order by nome) from familiares_unidade, u where unidade_id = u102), 'Clara Prado:false',
  'MU-06: a família que veio junto entra na unidade');
select is((select count(*)::integer from pets_unidade, u where unidade_id = u102), 0, 'MU-09: o pet que o síndico tirou não entra');
select is((select v.placa || ':' || (v.contato_id = (apr.v ->> 'contatoId')::uuid) from veiculos v, apr, u where v.unidade_id = u102), 'ABC1D23:true',
  'MU-09: o veículo entra na unidade, ligado à pessoa');
select is((select estado from cadastros_link, cad where id = roberto), 'APROVADO', 'MU-09: o cadastro fica aprovado');
select is(pg_temp.motivo($$ select plataforma_aprovar_cadastro_link(ana, ipe, roberto, 3, 'Roberto Prado', '+5561966664321', 'PROPRIETARIO', null, '[]', '[]', '[]')
  from ids, c, cad $$), 'JA_CONFERIDO', 'MU-09: o mesmo cadastro não é aprovado duas vezes');
select is((select publico_cadastro(lk.unidade ->> 'codigo', env.v ->> 'chave') -> 'envio' ->> 'estado' from lk, env), 'APROVADO',
  'MU-09: a pessoa vê pelo link que foi aprovada');
select is(pg_temp.motivo($$ select publico_enviar_cadastro(lk.unidade ->> 'codigo', env.v ->> 'chave', '{"nome": "Roberto", "telefone": "+5561966664321", "ligacao": "PROPRIETARIO"}')
  from lk, env $$), 'JA_CONFERIDO', 'MU-09: depois de conferido, não dá mais para corrigir');
select ok(exists (select 1 from ids, c, u, jsonb_array_elements(plataforma_historico_unidade(ana, ipe, u102, 'PESSOAS', null) -> 'itens') i
                   where i ->> 'titulo' = 'Roberto Prado: cadastro pelo link aprovado' and i ->> 'detalhe' = '1 da família, 1 veículo'),
  'PT-03: o histórico da unidade diz quem foi aprovado e o que veio junto');

-- A mesma pessoa (telefone e nome) já no condomínio não vira outro contato.
select plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Ana Dias', '+5561955551111',
  '{"proprietario": true, "principal": true, "mora": true}', true) from ids, c, u;
select is(pg_temp.motivo($$ select plataforma_aprovar_cadastro_link(ana, ipe, ana_dias, 1, 'Ana Dias', '+5561955551111', 'INQUILINO', null, '[]', '[]', '[]')
  from ids, c, cad $$), 'FALTA_PROPRIETARIO', 'MU-01: inquilino em unidade sem proprietário no cadastro não é aprovado sozinho');
select plataforma_aprovar_cadastro_link(ana, ipe, ana_dias, 1, 'Ana Dias', '+5561955551111', 'PROPRIETARIO_MORA', null, x.familia, '[]', '[]')
  from ids, c, cad, cadastros_link x where x.id = cad.ana_dias;
select is((select count(*)::integer from contatos where telefone = '+5561955551111'), 1, 'MU-03: a mesma pessoa no condomínio não vira outro contato');

-- ---------------------------------------------------------------------------------------
-- Recusar (regra 6).

create temp table env3 as select publico_enviar_cadastro(lk.unidade ->> 'codigo', null,
  '{"nome": "Fulano Estranho", "telefone": "+5561944440000", "ligacao": "INQUILINO", "familia": [{"nome": "Beltrano", "parentesco": "FILHO"}]}') as v from lk;
create temp table cad3 as select id from cadastros_link where estado = 'ENVIADO';
select is(pg_temp.campos($$ select plataforma_recusar_cadastro_link(ana, ipe, id, 1, 'SUMIU', null) from ids, c, cad3 $$), '["motivo"]', 'MU-09: recusar pede o motivo');
select is(pg_temp.campos($$ select plataforma_recusar_cadastro_link(ana, ipe, id, 1, 'OUTRO', ' ') from ids, c, cad3 $$), '["explicacao"]',
  'MU-09: o motivo "outro" pede a explicação');
select plataforma_recusar_cadastro_link(ana, ipe, id, 1, 'NAO_E_DA_UNIDADE', 'O proprietário já está cadastrado com outro nome.') from ids, c, cad3;
select ok((select nome is null and telefone is null and familia = '[]' and estado = 'RECUSADO' from cadastros_link, cad3 where cadastros_link.id = cad3.id),
  'MU-09: recusar apaga os dados mandados');
select is((select publico_cadastro(lk.unidade ->> 'codigo', env3.v ->> 'chave') -> 'envio' ->> 'motivo' from lk, env3), 'NAO_E_DA_UNIDADE',
  'MU-09: a pessoa vê o motivo ao abrir o link de novo');
select ok(not exists (select 1 from historico h where h.dados::text ~ 'Fulano|Beltrano|5561944440000'),
  'PT-03: o histórico guarda só que foi recusado, sem os dados da pessoa');

-- ---------------------------------------------------------------------------------------
-- Encerrar e vencer.

select is((plataforma_encerrar_link_cadastro(ana, ipe, (lk.predio ->> 'id')::uuid, 1) ->> 'versao')::integer, 2, 'MU-09: dá para encerrar o link antes')
  from ids, c, lk;
select is(pg_temp.motivo($$ select publico_enviar_cadastro(lk.predio ->> 'codigo', null, format('{"nome": "Nova", "telefone": "+5561933332222", "unidadeId": "%s"}', u101)::jsonb)
  from lk, u $$), 'LINK_FECHADO', 'MU-09: link encerrado não aceita cadastro');
select ok((select not (publico_cadastro(lk.predio ->> 'codigo', null) ->> 'aberto')::boolean from lk), 'MU-09: e a página diz que fechou');
select ajustar_relogio(timestamptz '2027-10-31 09:00:00-03' - now());
select ok((select not (publico_cadastro(lk.unidade ->> 'codigo', null) ->> 'aberto')::boolean from lk), 'MU-09: depois do prazo o link não aceita mais');
select is((select jsonb_array_length(plataforma_links_cadastro(ana, ipe, u102) -> 'itens') from ids, c, u), 0, 'MU-09: link vencido sai da janela da unidade');

select * from finish();
rollback;

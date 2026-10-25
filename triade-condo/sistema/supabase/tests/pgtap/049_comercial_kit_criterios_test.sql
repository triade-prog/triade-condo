-- Kit para o conselho pelos critérios do síndico (0307, R17.3b; CM-16 e CM-20): os critérios e o
-- problema na ficha do prédio, a ficha que não apaga a escolha do kit, o comparativo com uma linha
-- por critério e o texto fixo da TRÍADE, os fatos confirmados pela equipe (do prédio, por padrão,
-- ou informação pública do concorrente; o do "outro" preso ao texto da ficha), o custo conferido na
-- Tabela de preços, o mesmo comparativo pelo link sem o que é interno (CM-12) e a anonimização
-- que apaga o problema, o outro critério e os fatos do prédio.
begin;
select plan(49);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Fábio', 'FINANCEIRO') as fin;
grant select on ids to dominio;

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.iv(p uuid) returns integer language sql as $$ select versao from interessados where id = p $$;
create function pg_temp.interessado(p_condominio text, p_whatsapp text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (comercial_criar((select com from ids), jsonb_build_object('condominio', p_condominio, 'pessoa', 'Paulo Dias', 'origem', 'INDICACAO',
                                                                 'contatoAceito', true, 'whatsapp', p_whatsapp)) ->> 'id')::uuid;
  update interessados set unidades = 72, sistema_atual = 'App da Contábil Norte',
                          concorrentes = '[{"nome": "HabitaOne"}, {"nome": "Sistema X"}, {"nome": "app da contabil norte"}]' where id = v;
  return v;
end $$;
create function pg_temp.enviada(p_interessado uuid) returns jsonb language plpgsql as $$
declare r jsonb; e jsonb;
begin
  r := comercial_criar_proposta((select com from ids), p_interessado, '{}');
  e := comercial_enviar_proposta((select com from ids), (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  return jsonb_build_object('p', r ->> 'id', 'codigo', e -> 'link' ->> 'codigo');
end $$;
create function pg_temp.kit(p jsonb) returns jsonb language sql as $$ select comercial_kit((select com from ids), (p ->> 'p')::uuid) $$;
-- A célula do comparativo: linha do critério, coluna do sistema.
create function pg_temp.celula(p_kit jsonb, p_criterio text, p_sistema text) returns jsonb language sql as $$
  select l -> 'valores' -> ((select n from jsonb_array_elements(p_kit -> 'comparativo' -> 'colunas') with ordinality x(c, n) where c ->> 'nome' = p_sistema) - 1)::int
    from jsonb_array_elements(p_kit -> 'comparativo' -> 'linhas') l where l ->> 'criterio' = p_criterio $$;

select pg_temp.em('2026-10-24 10:00:00-03');
create temp table i as select pg_temp.interessado('Edifício Aroeira', '5561999990301') as aroeira, pg_temp.interessado('Edifício Buriti', '5561999990302') as buriti;
create temp table e as select pg_temp.enviada((select aroeira from i)) as aroeira, pg_temp.enviada((select buriti from i)) as buriti;

-- 1. Os critérios e o problema na ficha do prédio (CM-16).
select is((select comercial_ficha(com, aroeira) -> 'predio' -> 'criterios' from ids, i), '[]'::jsonb, 'a ficha começa sem critérios');
select is((select comercial_salvar_criterios(com, aroeira, pg_temp.iv(aroeira), array['COMO_CANCELAR', 'OUTRO', 'PEDIDO_COM_PRAZO', 'CUSTO_APARTAMENTO'],
                                             '  Portaria registra encomendas  ', ' Portaria sem registro e 3 vazamentos repetidos ') ->> 'versao' from ids, i)::integer,
  (select pg_temp.iv(aroeira) from i), 'o Comercial escolhe os critérios, o outro e o problema');
select is((select jsonb_build_array(p -> 'criterios', p ->> 'criterioOutro', p ->> 'problema') from (select comercial_ficha(com, aroeira) -> 'predio' p from ids, i) x),
  '[["PEDIDO_COM_PRAZO", "CUSTO_APARTAMENTO", "COMO_CANCELAR", "OUTRO"], "Portaria registra encomendas", "Portaria sem registro e 3 vazamentos repetidos"]'::jsonb,
  'a ficha mostra os critérios na ordem da lista, com o texto do outro e o problema, sem espaços sobrando');
select is((select pg_temp.erro(format('select comercial_salvar_criterios(%L, %L, %s, array[''PRECO_BAIXO''], null, null)', com, aroeira, pg_temp.iv(aroeira)))
             -> 'detalhe' -> 'campos' from ids, i), '["criterios"]'::jsonb, 'critério fora da lista é recusado');
select is((select pg_temp.erro(format('select comercial_salvar_criterios(%L, %L, %s, array[''OUTRO''], '' '', null)', com, aroeira, pg_temp.iv(aroeira)))
             -> 'detalhe' -> 'campos' from ids, i), '["criterioOutro"]'::jsonb, 'outro sem o texto é recusado');
select is((select pg_temp.erro(format('select comercial_salvar_criterios(%L, %L, %s, array[''CUSTO_APARTAMENTO''], null, %L)', com, aroeira, pg_temp.iv(aroeira), repeat('x', 301)))
             -> 'detalhe' -> 'campos' from ids, i), '["problema"]'::jsonb, 'o problema do prédio é curto (até 300)');
select is((select pg_temp.erro(format('select comercial_salvar_criterios(%L, %L, 1, array[''CUSTO_APARTAMENTO''], null, null)', com, aroeira)) ->> 'codigo' from ids, i),
  'TC409', 'com a versão velha da ficha, conflito');
select throws_ok($$ select comercial_salvar_criterios(fin, aroeira, pg_temp.iv(aroeira), array['CUSTO_APARTAMENTO'], null, null) from ids, i $$,
  'TC401', null, 'sem o Comercial, não escolhe critérios');
-- Salvar a ficha sem os campos novos não apaga a escolha; com eles, troca.
select comercial_salvar(com, aroeira, pg_temp.iv(aroeira), jsonb_build_object('condominio', 'Edifício Aroeira', 'pessoa', 'Paulo Dias', 'whatsapp', '5561999990301',
  'unidades', 72, 'sistemaAtual', 'App da Contábil Norte', 'concorrentes', '[{"nome": "HabitaOne"}, {"nome": "Sistema X"}, {"nome": "app da contabil norte"}]'::jsonb))
  from ids, i;
select is((select comercial_ficha(com, aroeira) -> 'predio' ->> 'criterioOutro' from ids, i), 'Portaria registra encomendas',
  'salvar a ficha sem os critérios não apaga a escolha do kit');
select comercial_salvar(com, buriti, pg_temp.iv(buriti), jsonb_build_object('condominio', 'Edifício Buriti', 'pessoa', 'Paulo Dias', 'whatsapp', '5561999990302',
  'unidades', 72, 'sistemaAtual', 'App da Contábil Norte', 'concorrentes', '[{"nome": "HabitaOne"}]'::jsonb,
  'criterios', '["SEM_BAIXAR_APP", "CUSTO_APARTAMENTO"]'::jsonb, 'criterioOutro', 'some sem o outro', 'problema', 'Ninguém sabe dos pedidos'))
  from ids, i;
select is((select jsonb_build_array(p -> 'criterios', p ? 'criterioOutro', p ->> 'problema') from (select comercial_ficha(com, buriti) -> 'predio' p from ids, i) x),
  '[["SEM_BAIXAR_APP", "CUSTO_APARTAMENTO"], false, "Ninguém sabe dos pedidos"]'::jsonb, 'a ficha também escolhe; texto do outro sem o outro não fica');

-- 2. O comparativo: uma linha por critério, a TRÍADE com texto fixo, o resto a confirmar.
create temp table k as select pg_temp.kit(aroeira) as k from e;
select is((select jsonb_agg(c ->> 'nome') from k, jsonb_array_elements(k -> 'comparativo' -> 'colunas') c),
  '["App da Contábil Norte", "HabitaOne", "Sistema X"]'::jsonb, 'as colunas: o sistema atual e os concorrentes da ficha, sem repetir o nome');
select is((select jsonb_agg(l ->> 'titulo') from k, jsonb_array_elements(k -> 'comparativo' -> 'linhas') l),
  '["Todo pedido com responsável e prazo", "Custo por apartamento por mês", "Como cancelar", "Portaria registra encomendas"]'::jsonb,
  'uma linha por critério escolhido, na ordem da lista, com o outro pelo texto da ficha');
select is((select l ->> 'triade' from k, jsonb_array_elements(k -> 'comparativo' -> 'linhas') l where l ->> 'criterio' = 'PEDIDO_COM_PRAZO'),
  'Sim: todo pedido tem responsável, prazo e conclusão explicada', 'a coluna da TRÍADE tem o texto fixo do critério');
select is((select l ->> 'triade' from k, jsonb_array_elements(k -> 'comparativo' -> 'linhas') l where l ->> 'criterio' = 'CUSTO_APARTAMENTO'),
  'R$ 3,18 por apartamento por mês (estimativa), sem custo de implantação', 'o custo da TRÍADE sai da versão enviada, como estimativa');
select is((select pg_temp.celula(k, 'COMO_CANCELAR', 'Sistema X') from k), '{"confirmado": false}'::jsonb, 'o que a equipe não confirmou fica a confirmar');
select is((select pg_temp.celula(k, 'CUSTO_APARTAMENTO', 'HabitaOne') ->> 'texto' from k),
  'R$ 4,90 por apartamento (Essencial: R$ 352,80 por mês); R$ 7,90 por apartamento (Profissional: R$ 568,80 por mês)',
  'o custo do concorrente conferido na Tabela de preços entra sozinho');
select is((select pg_temp.celula(k, 'CUSTO_APARTAMENTO', 'Sistema X') from k), '{"confirmado": false}'::jsonb, 'concorrente sem preço conferido fica a confirmar');
select ok((select k -> 'comparativo' ->> 'linhas' !~* 'roi|retorno' and k -> 'comparativo' -> 'linhas' ->> 0 is not null from k), 'EM-07: nada de retorno prometido');

-- 3. Os fatos confirmados pela equipe. Por padrão, só do prédio em que foram registrados.
create temp table f as select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'App da Contábil Norte', 'criterio', 'COMO_CANCELAR',
  'interessadoId', aroeira, 'texto', 'Só junto com o contrato da administradora', 'fonte', 'FONTE-INTERNA: contrato que o síndico mostrou',
  'confirmadoEm', '2026-10-21')) as r from ids, i;
select is((select pg_temp.celula(pg_temp.kit(aroeira), 'COMO_CANCELAR', 'App da Contábil Norte') from e),
  '{"confirmado": true, "texto": "Só junto com o contrato da administradora"}'::jsonb, 'o fato confirmado aparece na célula');
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com, jsonb_build_object('sistema', 'app da contabil  NORTE',
             'criterio', 'COMO_CANCELAR', 'interessadoId', aroeira, 'texto', 'Outro texto', 'fonte', 'Site deles'))) -> 'detalhe' ->> 'motivo' from ids, i),
  'FATO_EXISTE', 'o mesmo prédio, sistema (sem acento nem espaço) e critério já tem fato: mude o que existe (também na corrida, pelo índice único)');
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com,
             '{"sistema": "Sistema X", "criterio": "COMO_CANCELAR", "texto": "Multa", "fonte": "Site deles"}')) -> 'detalhe' -> 'campos' from ids),
  '["interessadoId"]'::jsonb, 'o fato nasce no kit de um prédio: pede o interessado');

-- Dois prédios com o mesmo sistema atual e o mesmo critério: o contrato de um não vaza no outro (CM-12).
select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'App da Contábil Norte', 'criterio', 'CUSTO_APARTAMENTO', 'interessadoId', aroeira,
  'texto', 'CONTRATO-AROEIRA: R$ 2,00 por apartamento', 'fonte', 'Boleto do Aroeira')) from ids, i;
select is((select pg_temp.celula(pg_temp.kit(buriti), 'CUSTO_APARTAMENTO', 'App da Contábil Norte') from e), '{"confirmado": false}'::jsonb,
  'o fato do Aroeira não aparece no Buriti, com o mesmo sistema e critério');
select ok((select strpos(publico_kit_proposta(buriti ->> 'codigo')::text, 'CONTRATO-AROEIRA') = 0 and strpos(pg_temp.kit(buriti)::text, 'CONTRATO-AROEIRA') = 0 from e),
  'nem no link nem no Console do outro prédio');
select ok((select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'App da Contábil Norte', 'criterio', 'CUSTO_APARTAMENTO', 'interessadoId', buriti,
  'texto', 'R$ 3,50 por apartamento', 'fonte', 'Boleto do Buriti')) ? 'id' from ids, i), 'o Buriti registra o fato dele no mesmo sistema e critério');
select is((select jsonb_build_array(pg_temp.celula(pg_temp.kit(aroeira), 'CUSTO_APARTAMENTO', 'App da Contábil Norte') ->> 'texto',
                                    pg_temp.celula(pg_temp.kit(buriti), 'CUSTO_APARTAMENTO', 'App da Contábil Norte') ->> 'texto') from e),
  '["CONTRATO-AROEIRA: R$ 2,00 por apartamento", "R$ 3,50 por apartamento"]'::jsonb, 'cada prédio vê o seu');

-- O fato do prédio vale mais que o preço de tabela, só ali.
select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'HabitaOne', 'criterio', 'CUSTO_APARTAMENTO', 'interessadoId', aroeira,
  'texto', 'R$ 5,20 por apartamento no plano que eles ofereceram', 'fonte', 'Proposta deles ao síndico')) from ids, i;
select is((select jsonb_build_array(pg_temp.celula(pg_temp.kit(aroeira), 'CUSTO_APARTAMENTO', 'HabitaOne') ->> 'texto',
                                    left(pg_temp.celula(pg_temp.kit(buriti), 'CUSTO_APARTAMENTO', 'HabitaOne') ->> 'texto', 23)) from e),
  '["R$ 5,20 por apartamento no plano que eles ofereceram", "R$ 4,90 por apartamento"]'::jsonb, 'o fato do prédio vale mais que o preço de tabela, só naquele prédio');

-- Informação pública do concorrente: vale para todo prédio, só na coluna dos concorrentes.
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com, jsonb_build_object('sistema', 'App da Contábil Norte',
             'criterio', 'SEM_BAIXAR_APP', 'escopo', 'PUBLICO', 'interessadoId', aroeira, 'texto', 'Precisa do app', 'fonte', 'Site deles'))) -> 'detalhe' -> 'campos' from ids, i),
  '["escopo"]'::jsonb, 'o sistema atual do prédio nunca vira informação pública');
select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'HabitaOne', 'criterio', 'SEM_BAIXAR_APP', 'escopo', 'PUBLICO', 'interessadoId', aroeira,
  'texto', 'Só pelo app deles, na loja', 'fonte', 'Site deles, página de planos')) from ids, i;
select is((select pg_temp.celula(pg_temp.kit(buriti), 'SEM_BAIXAR_APP', 'HabitaOne') ->> 'texto' from e), 'Só pelo app deles, na loja',
  'o fato público vale em outro prédio que tem o concorrente');
update interessados set sistema_atual = 'HabitaOne' where id = (select buriti from i);
select is((select pg_temp.celula(pg_temp.kit(buriti), 'SEM_BAIXAR_APP', 'HabitaOne') from e), '{"confirmado": false}'::jsonb,
  'mas não na coluna do sistema atual, que é contrato do prédio');
update interessados set sistema_atual = 'App da Contábil Norte' where id = (select buriti from i);

-- O outro critério: só do prédio e só enquanto a ficha tiver o mesmo texto.
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com, jsonb_build_object('sistema', 'Sistema X',
             'criterio', 'OUTRO', 'escopo', 'PUBLICO', 'interessadoId', aroeira, 'texto', 'Não registra', 'fonte', 'Demonstração deles'))) -> 'detalhe' -> 'campos' from ids, i),
  '["escopo"]'::jsonb, 'o outro critério é só do prédio');
select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'Sistema X', 'criterio', 'OUTRO', 'interessadoId', aroeira, 'texto', 'Não registra encomendas',
  'fonte', 'Demonstração deles')) from ids, i;
select is((select pg_temp.celula(pg_temp.kit(aroeira), 'OUTRO', 'Sistema X') ->> 'texto' from e), 'Não registra encomendas', 'e aparece no outro critério daquele prédio');
select comercial_salvar_criterios(com, aroeira, pg_temp.iv(aroeira), array['COMO_CANCELAR', 'OUTRO', 'PEDIDO_COM_PRAZO', 'CUSTO_APARTAMENTO'],
  'Vaga de garagem por sorteio', 'Portaria sem registro e 3 vazamentos repetidos') from ids, i;
select is((select jsonb_build_array(pg_temp.celula(pg_temp.kit(aroeira), 'OUTRO', 'Sistema X'),
                                    (select count(*) from jsonb_array_elements(pg_temp.kit(aroeira) -> 'fatos') x where x ->> 'criterio' = 'OUTRO')) from e),
  '[{"confirmado": false}, 0]'::jsonb, 'outro texto no outro critério: o fato antigo não casa com a linha nova');
select comercial_salvar_criterios(com, aroeira, pg_temp.iv(aroeira), array['COMO_CANCELAR', 'OUTRO', 'PEDIDO_COM_PRAZO', 'CUSTO_APARTAMENTO'],
  'Portaria registra encomendas', 'Portaria sem registro e 3 vazamentos repetidos') from ids, i;
select is((select pg_temp.celula(pg_temp.kit(aroeira), 'OUTRO', 'Sistema X') ->> 'texto' from e), 'Não registra encomendas', 'o mesmo texto de volta, o fato volta');

select is((select jsonb_agg(x ->> 'fonte' || ' ' || (x ->> 'escopo') order by x ->> 'fonte') from e, jsonb_array_elements(pg_temp.kit(aroeira) -> 'fatos') x),
  '["Boleto do Aroeira PREDIO", "Demonstração deles PREDIO", "FONTE-INTERNA: contrato que o síndico mostrou PREDIO", "Proposta deles ao síndico PREDIO"]'::jsonb,
  'o kit do Console traz os fatos que valem nas células, com a fonte e o escopo, para a equipe');
select is((select comercial_salvar_fato(com, (r ->> 'id')::uuid, (r ->> 'versao')::integer, jsonb_build_object('texto', 'Só com a administradora, 60 dias de aviso',
  'fonte', 'FONTE-INTERNA: contrato que o síndico mostrou')) ->> 'versao' from ids, f), '2', 'a equipe muda o fato, com a versão');
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, %L, 1, %L::jsonb)', com, r ->> 'id', '{"texto": "Velho", "fonte": "Site deles"}')) ->> 'codigo' from ids, f),
  'TC409', 'com a versão velha do fato, conflito');
select throws_ok($$ select comercial_salvar_fato(fin, null, null, jsonb_build_object('sistema', 'Sistema X', 'criterio', 'COMO_CANCELAR', 'interessadoId', aroeira,
  'texto', 'Multa', 'fonte', 'Site deles')) from ids, i $$, 'TC401', null, 'sem o Comercial, não registra fato');

-- 4. O link mostra o mesmo comparativo, sem o que é interno (CM-12).
select is((select publico_kit_proposta(aroeira ->> 'codigo') -> 'comparativo' from e), (select pg_temp.kit(aroeira) -> 'comparativo' from e),
  'o comparativo pelo link é igual ao do Console');
select ok((select strpos(publico_kit_proposta(aroeira ->> 'codigo')::text, 'FONTE-INTERNA') = 0 and not (publico_kit_proposta(aroeira ->> 'codigo') ?| array['fatos', 'interessado'])
             from e), 'o link não leva a fonte, os fatos nem a versão da ficha');
select ok((select jsonb_path_query_array(publico_kit_proposta(aroeira ->> 'codigo'), 'strict $.comparativo.concorrentes[*].planos[*]') <> '[]'
              and not jsonb_path_exists(publico_kit_proposta(aroeira ->> 'codigo'), 'strict $.comparativo.concorrentes[*].planos[*] ? (exists(@.fonte) || exists(@.lidoEm))')
             from e), 'o preço conferido vai pelo link sem a fonte nem a data em que a equipe leu');
select is((select publico_kit_proposta(aroeira ->> 'codigo') -> 'predio' ->> 'problema' from e), 'Portaria sem registro e 3 vazamentos repetidos',
  'o problema do prédio vai para a apresentação curta do kit pelo link');

-- Retirar: volta a a confirmar; o retirado não muda.
select comercial_retirar_fato(com, (r ->> 'id')::uuid, 2) from ids, f;
select is((select pg_temp.celula(pg_temp.kit(aroeira), 'COMO_CANCELAR', 'App da Contábil Norte') from e), '{"confirmado": false}'::jsonb, 'fato retirado volta a a confirmar');
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, %L, 3, %L::jsonb)', com, r ->> 'id', '{"texto": "De novo", "fonte": "Site deles"}')) -> 'detalhe' ->> 'motivo' from ids, f),
  'FATO_RETIRADO', 'o retirado não muda: registre outro');
select is((select count(*)::int from historico where entidade = 'fato_comparativo'), 8, 'registrar, mudar e retirar ficam no histórico do Comercial');

-- LGPD: a anonimização apaga o problema e o texto do outro critério e apaga e retira os fatos do prédio.
select comercial_excluir(adm, aroeira) from ids, i;
select is((select array[problema, criterio_outro, array_to_string(criterios, ',')] from interessados where id = (select aroeira from i)),
  array[null, null, 'COMO_CANCELAR,CUSTO_APARTAMENTO,PEDIDO_COM_PRAZO'], 'anonimizado: o problema e o outro somem; os critérios da lista ficam');
select is((select jsonb_agg(distinct jsonb_build_array(texto, fonte, retirado_em is not null)) from fatos_comparativo where interessado_id = (select aroeira from i)),
  '[["Dado apagado (LGPD)", "Dado apagado (LGPD)", true]]'::jsonb, 'os fatos do prédio anonimizado têm o texto e a fonte apagados e saem do comparativo');
select is((select count(*)::int from fatos_comparativo where escopo = 'PUBLICO' and retirado_em is null and texto = 'Só pelo app deles, na loja'), 1,
  'a informação pública do concorrente fica');
select is((select pg_temp.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com, jsonb_build_object('sistema', 'Sistema X',
             'criterio', 'COMO_CANCELAR', 'interessadoId', aroeira, 'texto', 'Multa', 'fonte', 'Site deles'))) -> 'detalhe' ->> 'motivo' from ids, i),
  'ANONIMIZADO', 'não se registra fato em interessado anonimizado');
select is((select pg_temp.erro(format('select comercial_salvar_criterios(%L, %L, %s, array[''CUSTO_APARTAMENTO''], null, %L)', com, aroeira, pg_temp.iv(aroeira), 'Novo'))
             -> 'detalhe' ->> 'motivo' from ids, i), 'ANONIMIZADO', 'nem se escolhe critério nele');

select * from finish();
rollback;

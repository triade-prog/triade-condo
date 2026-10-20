-- Pedidos relacionados, pedido de decisão ao síndico e os dois indicadores que faltavam (F7.4;
-- TR-01, AT-18, AT-23). A infiltração da vaga 31 da garagem G2 é concluída e volta duas semanas
-- depois; no mesmo dia outro morador relata o mesmo problema. A zeladora liga os pedidos e pede à
-- síndica e ao conselheiro a decisão sobre o conserto. O relógio começa numa segunda-feira,
-- 01/03/2027, às 09:00.
begin;
select plan(61);

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
select pg_temp.em('2027-03-01 09:00:00-03');

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Edu') as edu,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['ATUALIZAR', 'RESPONDER']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Conselho', array['APROVAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Secretário', array['ACOMPANHAR']) as v_edu
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vd(p uuid) returns integer language sql as $$ select versao from decisoes_pedido where id = p $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre B', 1, true) ->> 'id')::uuid as bb from ids, c;
select plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "304"}]') from ids, c, bl;
create temp table u as select (select id from unidades where identificacao = '304') as u304;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from categorias where condominio_id = ipe and modelo = 'LIMPEZA') as limpeza,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal,
  (select id from etapas where condominio_id = ipe and modelo = 'CONCLUIDO') as concluido,
  (select id from etapas where condominio_id = ipe and modelo = 'NAO_PROCEDE') as nao_procede
  from c;
create function pg_temp.pedido(p_quem uuid, p_assunto text, p_local text, p_categoria uuid, p_unidade uuid default null) returns uuid language sql as $$
  select (plataforma_registrar_pedido(p_quem, (select ipe from c), p_unidade, null, p_local, p_categoria,
          (select normal from cfg), p_assunto, 'Descrição do problema no prédio.', 'OBSERVACAO', false, null) ->> 'id')::uuid $$;
create function pg_temp.parecidos(p_pessoa uuid, p uuid) returns text[] language sql as $$
  select coalesce(array_agg(x ->> 'protocolo' order by n), '{}')
    from jsonb_array_elements(plataforma_pedido(p_pessoa, (select ipe from c), p) -> 'relacionados' -> 'parecidos') with ordinality y(x, n) $$;
create function pg_temp.ligados(p_pessoa uuid, p uuid) returns text[] language sql as $$
  select coalesce(array_agg((x ->> 'tipo') || ' ' || (x ->> 'papel') || ' ' || (x -> 'pedido' ->> 'protocolo') order by x ->> 'em'), '{}')
    from jsonb_array_elements(plataforma_pedido(p_pessoa, (select ipe from c), p) -> 'relacionados' -> 'ligados') x $$;

-- A infiltração de março e a limpeza no mesmo lugar.
create temp table p1 as select
  pg_temp.pedido(ana, 'Infiltração no teto da G2', 'Garagem G2, vaga 31', manutencao) as p88,
  pg_temp.pedido(ana, 'Lixo acumulado na G2', 'Garagem G2, vaga 31', limpeza) as plixo
  from ids, cfg;
select pg_temp.em('2027-03-03 09:00:00-03');
select plataforma_concluir_pedido(ana, ipe, p88, pg_temp.vp(p88), concluido, 'Trocamos a manta no trecho da vaga 31.', null) from ids, c, p1, cfg;
-- Duas semanas depois a mancha volta, e no mesmo dia outro morador relata.
select pg_temp.em('2027-03-15 09:00:00-03');
create temp table p2 as select pg_temp.pedido(ana, 'Infiltração no teto da garagem G2', 'garagem g2,  VAGA 31', manutencao) as p142 from ids, cfg;
select pg_temp.em('2027-03-15 10:00:00-03');
create temp table p3 as select
  pg_temp.pedido(bruna, 'Água pingando na garagem', 'Garagem G2, vaga 31', manutencao) as p146,
  pg_temp.pedido(bruna, 'Goteira na G2', 'Garagem G2, vaga 31', manutencao) as pcanc,
  pg_temp.pedido(bruna, 'Vazamento no banheiro', null, manutencao, u304) as pu_a,
  pg_temp.pedido(bruna, 'Mancha no teto do banheiro', null, manutencao, u304) as pu_b
  from ids, cfg, u;
select plataforma_cancelar_pedido(ana, ipe, pcanc, pg_temp.vp(pcanc), 'Registrado em dobro pela portaria') from ids, c, p3;
select pg_temp.em('2027-03-15 12:00:00-03');

-- ---------------------------------------------------------------------------------------
-- Parecidos e ligações (AT-18).

select is((select pg_temp.parecidos(ana, p142) from ids, p2), array['2027-0004', '2027-0001'],
  'AT-18: parecidos são da mesma categoria e do mesmo local, sem maiúscula nem espaço sobrando, os mais próximos primeiro');
select is((select pg_temp.parecidos(ana, pu_a) from ids, p3), array['2027-0007'], 'AT-18: a mesma unidade também é o mesmo lugar');
select is((select x ->> 'podeReincidencia' from ids, p2, jsonb_array_elements(plataforma_pedido(ana, (select ipe from c), p142) -> 'relacionados' -> 'parecidos') x
            where x ->> 'protocolo' = '2027-0001'), 'true', 'AT-18: o concluído antes de o novo abrir pode ser reincidência');
select is((select pg_temp.parecidos(edu, p142) || array[(plataforma_pedido(edu, ipe, p142) -> 'pode' ->> 'ligar')] from ids, c, p2), array['false'],
  'CF-03: quem só acompanha não vê sugestões nem liga');
select throws_ok($$ select plataforma_ligar_pedidos(edu, ipe, p142, pg_temp.vp(p142), p88, 'REINCIDENCIA', 'Mesma mancha', false, null, null)
                     from ids, c, p1, p2 $$, 'TC401', null, 'CF-03: quem só acompanha não liga pedidos');
select is(pg_temp.motivo($$ select plataforma_ligar_pedidos(ana, ipe, p142, pg_temp.vp(p142), p146, 'REINCIDENCIA', 'Mesma mancha', false, null, null)
                            from ids, c, p2, p3 $$), 'NAO_E_REINCIDENCIA', 'AT-18: reincidência só de pedido concluído antes de o outro abrir');
select is(pg_temp.campos($$ select plataforma_ligar_pedidos(ana, ipe, p142, pg_temp.vp(p142), p88, 'REINCIDENCIA', '', false, null, null)
                            from ids, c, p1, p2 $$), '["motivo"]'::jsonb, 'AT-18: ligar pede o motivo');
select is(pg_temp.motivo($$ select plataforma_ligar_pedidos(ana, ipe, p142, pg_temp.vp(p142), pcanc, 'DUPLICADO', 'O mesmo relato', false, null, null)
                            from ids, c, p2, p3 $$), 'PEDIDO_CANCELADO', 'AT-18: pedido cancelado não se liga');
select throws_ok($$ select plataforma_ligar_pedidos(ana, ipe, p142, pg_temp.vp(p142) - 1, p88, 'REINCIDENCIA', 'Mesma mancha', false, null, null)
                     from ids, c, p1, p2 $$, 'TC409', null, 'AT-24: ligar leva a versão lida do pedido');
select throws_ok($$ select plataforma_ligar_pedidos(davi, ipe, p142, pg_temp.vp(p142), p88, 'REINCIDENCIA', 'Mesma mancha', false, null, null)
                     from ids, c, p1, p2 $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não liga pedidos do Ipê');

create temp table v0 as select pg_temp.vp(p142) as antes from p2;
select lives_ok($$ select plataforma_ligar_pedidos(bruna, ipe, p142, pg_temp.vp(p142), p88, 'REINCIDENCIA', 'Mesma mancha, perto do ralo', false, null, null)
                    from ids, c, p1, p2 $$, 'AT-18: a zeladora liga o pedido como reincidência do concluído');
select is((select pg_temp.vp(p142) from p2), (select antes + 1 from v0), 'AT-24: ligar sobe a versão do pedido aberto na tela');
select is((select pg_temp.ligados(ana, p142) from ids, p2), array['REINCIDENCIA NOVO 2027-0001'], 'AT-18: o novo é a reincidência do antigo');
select is((select pg_temp.ligados(ana, p88) from ids, p1), array['REINCIDENCIA ANTIGO 2027-0003'], 'AT-18: o antigo vê quem voltou');
select is((select array_agg(h.dados ->> 'papel' order by h.dados ->> 'papel') from historico h, p1, p2
            where h.acao = 'pedido.ligado' and h.entidade_id in (p88::text, p142::text)), array['ANTIGO', 'NOVO'],
  'AT-17: a ligação vai para o histórico dos dois pedidos');
select is((select pg_temp.parecidos(ana, p142) from ids, p2), array['2027-0004'], 'AT-18: o pedido ligado sai das sugestões');
select is((select (select estado from pedidos where id = p88) || ' ' || (select protocolo from pedidos where id = p142) from p1, p2), 'ENCERRADO 2027-0003',
  'AT-18: cada relato mantém o seu protocolo e a sua situação');
select is(pg_temp.motivo($$ select plataforma_ligar_pedidos(ana, ipe, p88, pg_temp.vp(p88), p142, 'REINCIDENCIA', 'De novo', false, null, null)
                            from ids, c, p1, p2 $$), 'JA_LIGADO', 'AT-18: um pedido fica ligado a um outro por vez');

-- Desfazer e ligar de novo.
select is(pg_temp.campos($$ select plataforma_desfazer_ligacao(ana, ipe, p142, pg_temp.vp(p142), (select id from ligacoes_pedido where pedido_id = p142), 'x')
                            from ids, c, p2 $$), '["motivo"]'::jsonb, 'AT-18: desfazer pede motivo');
create temp table l1 as select id from ligacoes_pedido, p2 where pedido_id = p142;
select plataforma_desfazer_ligacao(ana, ipe, p142, pg_temp.vp(p142), (select id from l1), 'Era outro ponto da laje') from ids, c, p2;
select is((select pg_temp.ligados(ana, p142) from ids, p2), '{}'::text[], 'AT-18: a ligação desfeita sai do pedido');
select is((select motivo_desfazer from ligacoes_pedido where id = (select id from l1)), 'Era outro ponto da laje', 'AT-18: o motivo de desfazer fica');
select is(pg_temp.motivo($$ select plataforma_desfazer_ligacao(ana, ipe, p142, pg_temp.vp(p142), (select id from l1), 'De novo, por engano')
                            from ids, c, p2 $$), 'LIGACAO_DESFEITA', 'AT-18: o que foi desfeito não se desfaz de novo');
select throws_ok($$ update ligacoes_pedido set tipo = 'DUPLICADO' where id = (select id from l1) $$, 'TC422', null,
  'AT-17: ligação desfeita não muda');
select plataforma_ligar_pedidos(bruna, ipe, p142, pg_temp.vp(p142), p88, 'REINCIDENCIA', 'Mesma mancha, perto do ralo', false, null, null)
  from ids, c, p1, p2;

-- Duplicado, encerrado com o texto ao morador.
select throws_ok($$ select plataforma_ligar_pedidos(bruna, ipe, p142, pg_temp.vp(p142), p146, 'DUPLICADO', 'O mesmo relato', true,
                       'O problema já está sendo tratado no outro protocolo.', pg_temp.vp(p146)) from ids, c, p2, p3 $$, 'TC401', null,
  'AT-18: só quem conclui encerra o duplicado');
select plataforma_ligar_pedidos(ana, ipe, p142, pg_temp.vp(p142), p146, 'DUPLICADO', 'O mesmo relato', true,
  'O problema já está sendo tratado no protocolo 2027-0003.', pg_temp.vp(p146)) from ids, c, p2, p3;
select is((select estado || ' ' || (select nome from etapas where id = etapa_id) from pedidos, p3 where id = p146), 'ENCERRADO Não procede',
  'AT-18: o duplicado encerra pela conclusão de sempre');
select is((select explicacao from conclusoes_pedido, p3 where pedido_id = p146), 'O problema já está sendo tratado no protocolo 2027-0003.',
  'AT-18: o morador recebe o texto escrito na ligação');
select is((select pg_temp.ligados(ana, p142) from ids, p2), array['REINCIDENCIA NOVO 2027-0001', 'DUPLICADO ANTIGO 2027-0004'],
  'AT-18: o pedido mostra os dois lados das ligações');

-- "Não é" e a janela dos parecidos.
select plataforma_descartar_parecido(bruna, ipe, pu_a, pu_b) from ids, c, p3;
select is((select pg_temp.parecidos(ana, pu_a) from ids, p3), '{}'::text[], 'AT-18: "Não é" tira a sugestão do par');
select is(pg_temp.campos($$ select plataforma_definir_parecidos(ana, ipe, pg_temp.vcfg(), 45) from ids, c $$), '["dias"]'::jsonb,
  'AT-18: a janela é de 30, 60, 90 ou 180 dias');
select plataforma_definir_parecidos(ana, ipe, pg_temp.vcfg(), 30) from ids, c;
select is((select plataforma_configuracoes(ana, ipe) ->> 'parecidosDias' from ids, c), '30', 'AT-18: a janela muda nas Configurações');

-- ---------------------------------------------------------------------------------------
-- Pedido de decisão ao síndico (AT-23).

create function pg_temp.pedir(p_quem uuid, p uuid, p_decisor uuid, p_prazo date, p_alts jsonb) returns uuid language sql as $$
  select (plataforma_pedir_decisao(p_quem, (select ipe from c), p, pg_temp.vp(p), 'Qual conserto fazer na laje da G2',
          'Chove na quinta', p_prazo, p_decisor, p_alts) ->> 'id')::uuid $$;

select is((select array_agg(x ->> 'nome' order by n) from ids, c, p2,
                  jsonb_array_elements(plataforma_pedido(bruna, ipe, p142) -> 'decisores') with ordinality y(x, n)),
  array['Síndica Ana', 'Gil'], 'AT-23: decide o síndico ou quem tem a permissão Aprovar');
select is((select array_agg((x ->> 'eu')::boolean order by n) from ids, c, p2,
                  jsonb_array_elements(plataforma_pedido(ana, ipe, p142) -> 'decisores') with ordinality y(x, n)),
  array[true, false], 'AT-23: a lista marca quem pede, que não recebe aviso de si mesmo');
select is(pg_temp.campos($$ select pg_temp.pedir(bruna, p142, v_ana, '2027-03-19', '[]') from ids, p2, vs $$), '["alternativas"]'::jsonb,
  'AT-23: ao menos uma alternativa');
select is(pg_temp.campos($$ select pg_temp.pedir(bruna, p142, v_ana, '2027-03-14', '[{"descricao": "Remendo"}]') from ids, p2, vs $$), '["prazo"]'::jsonb,
  'AT-23: o prazo não fica no passado');
select is(pg_temp.campos($$ select pg_temp.pedir(bruna, p142, v_bruna, '2027-03-19', '[{"descricao": "Remendo"}]') from ids, p2, vs $$), '["decisorId"]'::jsonb,
  'CF-03: quem não aprova não decide');
select is(pg_temp.campos($$ select pg_temp.pedir(bruna, p142, v_ana, '2027-03-19', '[{"descricao": "Remendo", "custo": 24.5}]') from ids, p2, vs $$),
  '["alternativas"]'::jsonb, 'PT-09: o custo vem em centavos inteiros');

create temp table d as select pg_temp.pedir(bruna, p142, v_ana, '2027-03-19',
  '[{"descricao": "Remendo no trecho rachado", "detalhe": "HidroPress, 2 dias", "custo": 240000},
    {"descricao": "Refazer a impermeabilização do bloco", "detalhe": "Impermax, 12 dias", "custo": 1890000}]') as d1
  from ids, p2, vs;
select is((select tipo || ' ' || nome_do_vinculo(responsavel_id) || ' ' || (resolvida_em is null) from pendencias_pedido, d
            where id = (select pendencia_id from decisoes_pedido where id = d1)), 'DECISAO Síndica Ana true',
  'AT-23: o pedido ganha uma pendência do tipo Decisão para quem decide');
select is((select x ->> 'tipo' from ids, c, d, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'decisaoId' = d1::text),
  'DECISAO_PEDIDA', 'AT-23: quem decide é avisado no sino');
select is(pg_temp.motivo($$ select plataforma_resolver_pendencia(ana, ipe, p142, pg_temp.vp(p142), (select pendencia_id from decisoes_pedido where id = d1), 'Resolvi')
                            from ids, c, p2, d $$), 'PENDENCIA_DE_DECISAO', 'AT-23: a pendência da decisão não se resolve à mão');
select is(pg_temp.motivo($$ select plataforma_concluir_pedido(ana, ipe, p142, pg_temp.vp(p142), concluido, 'Conserto feito na laje inteira.', null)
                            from ids, c, p2, cfg $$), 'PENDENCIA_ABERTA', 'AT-11: com decisão esperando, o pedido não conclui');
select throws_ok($$ update decisoes_pedido set prazo = '2027-04-30' where id = (select d1 from d) $$, 'TC422', null,
  'AT-23: o pedido de decisão enviado não muda');
select throws_ok($$ select plataforma_responder_decisao(bruna, ipe, d1, pg_temp.vd(d1), true, 1, 'Pode fazer') from ids, c, d $$, 'TC401', null,
  'CF-03: quem não aprova não responde');
select throws_ok($$ select plataforma_responder_decisao(gil, ipe, d1, pg_temp.vd(d1), true, 1, 'Pode fazer') from ids, c, d $$, 'TC401', null,
  'AT-23: responde quem foi escolhido ou o síndico');
select is(pg_temp.campos($$ select plataforma_responder_decisao(ana, ipe, d1, pg_temp.vd(d1), true, 2, '') from ids, c, d $$), '["justificativa"]'::jsonb,
  'AT-23: aprovar exige justificativa');
select is(pg_temp.campos($$ select plataforma_responder_decisao(ana, ipe, d1, pg_temp.vd(d1), true, 3, 'Pode fazer') from ids, c, d $$), '["alternativa"]'::jsonb,
  'AT-23: aprova-se uma das alternativas');

create temp table antes as select (select count(*) from manutencoes) as manutencoes, (select count(*) from links_prestador) as links;
select pg_temp.em('2027-03-16 09:00:00-03');
select plataforma_responder_decisao(ana, ipe, d1, pg_temp.vd(d1), true, 2,
  'O remendo já foi feito em março e voltou. Vou levar ao conselho a obra do bloco.') from ids, c, d;
select is((select estado || ' ' || alternativa_aprovada || ' ' || nome_pessoa(respondida_por) from decisoes_pedido, d where id = d1),
  'APROVADA 2 Síndica Ana', 'AT-23: a resposta fica com a alternativa e o nome de quem respondeu');
select is((select resolucao from pendencias_pedido where id = (select pendencia_id from decisoes_pedido, d where decisoes_pedido.id = d1)),
  'Aprovada a alternativa 2', 'AT-23: a pendência se resolve sozinha com a resposta');
select is((select (select count(*) from manutencoes) - manutencoes + (select count(*) from links_prestador) - links from antes), 0::bigint,
  'AT-23: aprovar não contrata nem paga nada');
select is((select x ->> 'tipo' from ids, c, d, jsonb_array_elements(plataforma_avisos(bruna, ipe) -> 'itens') x where x ->> 'decisaoId' = d1::text),
  'DECISAO_RESPONDIDA', 'AT-23: quem pediu é avisado da resposta');
select is(pg_temp.motivo($$ select plataforma_responder_decisao(ana, ipe, d1, pg_temp.vd(d1), false, null, 'Mudei de ideia') from ids, c, d $$),
  'DECISAO_FECHADA', 'AT-23: decisão respondida não se responde de novo');

-- O conselheiro deixa vencer, é avisado e devolve.
select pg_temp.em('2027-03-16 10:00:00-03');
create temp table d2 as select pg_temp.pedir(bruna, p142, v_gil, '2027-03-17', '[{"descricao": "Interditar as vagas 30 a 32"}]') as d2 from ids, p2, vs;
select pg_temp.em('2027-03-18 10:00:00-03');
select verificar_decisoes();
select is((select x ->> 'tipo' from ids, c, d2, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x
            where x ->> 'decisaoId' = d2::text order by x ->> 'criadoEm' desc limit 1), 'DECISAO_VENCIDA', 'AT-23: o prazo vencido avisa quem decide');
select is((select plataforma_painel(gil, ipe) -> 'decisoes' from ids, c), '{"aguardando": 1, "vencidas": 1, "maisAntigaDias": 2}'::jsonb,
  'AT-08: o Início de quem decide mostra o que espera e o que venceu');
select is((select plataforma_painel(bruna, ipe) ? 'decisoes' from ids, c), false, 'CF-03: a linha das decisões é só de quem aprova');
select pg_temp.em('2027-03-18 12:00:00-03');
select plataforma_responder_decisao(gil, ipe, d2, pg_temp.vd(d2), false, null, 'Antes, quero o laudo da laje.') from ids, c, d2;

-- A terceira espera; a quarta é retirada; a quinta cai com o pedido cancelado.
select pg_temp.em('2027-03-18 13:00:00-03');
create temp table d3 as select
  pg_temp.pedir(bruna, p142, v_ana, '2027-03-25', '[{"descricao": "Contratar o laudo da laje", "custo": 80000}]') as d3,
  pg_temp.pedir(bruna, pu_b, v_ana, '2027-03-25', '[{"descricao": "Abrir o forro do banheiro"}]') as d4,
  pg_temp.pedir(bruna, pu_a, v_ana, '2027-03-25', '[{"descricao": "Trocar o registro"}]') as d5
  from ids, p2, p3, vs;
select plataforma_retirar_decisao(bruna, ipe, d4, pg_temp.vd(d4), 'O morador resolveu por conta própria') from ids, c, d3;
select plataforma_cancelar_pedido(ana, ipe, pu_a, pg_temp.vp(pu_a), 'O vazamento era do vizinho de cima') from ids, c, p3;
select is((select array_agg(estado || ' ' || retirada_motivo order by retirada_motivo) from decisoes_pedido, d3 where id in (d4, d5)),
  array['RETIRADA O morador resolveu por conta própria', 'RETIRADA Pedido cancelado'],
  'AT-23: quem pediu retira com motivo, e cancelar o pedido retira a decisão');
select is((select array_agg(x -> 'pedido' ->> 'protocolo' order by n) from ids, c,
                  jsonb_array_elements(plataforma_decisoes(ana, ipe, 'AGUARDANDO') -> 'decisoes') with ordinality y(x, n)),
  array['2027-0003'], 'AT-23: a tela Decisões mostra o que espera a resposta da síndica');
select is((select jsonb_array_length(plataforma_decisoes(ana, ipe, 'DECIDIDAS') -> 'decisoes') from ids, c), 2,
  'AT-23: decididas são as aprovadas e as devolvidas');

-- ---------------------------------------------------------------------------------------
-- Os dois indicadores que faltavam (TR-01, TR-07).

select pg_temp.em('2027-03-20 09:00:00-03');
create temp table ind as select plataforma_indicadores(ana, ipe, 'ESTE_MES') as r from ids, c;
select is((select (r -> 'reincidencia') - 'ondeVolta' from ind), '{"pedidos": 5, "reincidencias": 1, "porcentagem": 20}'::jsonb,
  'TR-01: reincidência sobre os pedidos abertos no período, sem os cancelados; duplicado não conta');
select is((select r -> 'reincidencia' -> 'ondeVolta' from ind),
  '[{"onde": "garagem g2,  VAGA 31", "categoria": "Manutenção", "vezes": 1, "ultima": "2027-0003"}]'::jsonb,
  'TR-01: onde volta, com a categoria e o último pedido');
select is((select (plataforma_indicadores(ana, ipe, 'MES_PASSADO') -> 'reincidencia') - 'ondeVolta' from ids, c),
  '{"pedidos": 0, "reincidencias": 0, "porcentagem": null}'::jsonb, 'TR-07: sem pedido no período é "sem dados", não zero');
select is((select r -> 'decisoes' from ind),
  '{"aguardando": 1, "vencidas": 0, "maisAntigaDias": 2, "decididas": 2, "aprovadas": 1, "devolvidas": 1, "medianaHoras": 35.5}'::jsonb,
  'TR-01: decisões aguardando de agora; decididas e tempo típico (21 h e 50 h) do período');
select is((select plataforma_indicadores(davi, jatoba, 'ESTE_MES') -> 'decisoes' ->> 'aguardando' from ids, c), '0',
  'PT-01: o outro condomínio não conta as decisões do Ipê');

select * from finish();
rollback;

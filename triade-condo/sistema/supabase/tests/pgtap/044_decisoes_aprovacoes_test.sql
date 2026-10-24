-- Decisões e aprovações (R5: V-14, FC-10). O Residencial Ipê monta o conselho: Gil, subsíndico com
-- acesso ao painel; Lúcia, conselheira só com nome e e-mail; Marcos, conselheiro fiscal morador do
-- 304, pelo WhatsApp, com o mandato até 30/11; Rui, suplente. A zeladora pede decisões ao
-- conselho, o voto fecha sozinho, troca, empata e volta para a síndica; a síndica viaja e Gil
-- responde no lugar dela; as despesas vão para aprovar, com anexos, e são pagas fora do sistema.
-- O relógio começa numa segunda-feira, 26/10/2026, às 09:00.
begin;
select plan(171);

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
select pg_temp.em('2026-10-26 09:00:00-03');

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
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Subsíndico', array['APROVAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Secretário', array['ACOMPANHAR']) as v_edu
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vd(p uuid) returns integer language sql as $$ select versao from decisoes_pedido where id = p $$;
create function pg_temp.vx(p uuid) returns integer language sql as $$ select versao from despesas_aprovacao where id = p $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from conselho_membros where id = p $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre B', 1, true) ->> 'id')::uuid as bb from ids, c;
select plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "304"}]') from ids, c, bl;
create temp table u as select (select id from unidades where identificacao = '304') as u304;
create temp table mor as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u304, null, 'Marcos Lima', '+5561999990304', '{"proprietario": true, "principal": true, "mora": true}', true) as marcos
  from ids, c, u;
create temp table ct as select (select contato_id from contatos_unidade where id = (marcos ->> 'vinculoId')::uuid) as c_marcos from mor;
create temp table cfg as select
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO') as manutencao,
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL') as normal
  from c;
create temp table p as select (plataforma_registrar_pedido(bruna, ipe, null, null, 'Garagem G2', manutencao, normal, 'Infiltração na laje da G2',
  'A mancha voltou depois do conserto.', 'OBSERVACAO', false, null) ->> 'id')::uuid as p1 from ids, c, cfg;

-- Pedir ao conselho: a pergunta, duas alternativas e o prazo.
create function pg_temp.pedir(p_prazo date, p_alts jsonb default '[{"descricao": "Remendo no trecho rachado", "custo": 240000},
                                                                    {"descricao": "Refazer a impermeabilização", "custo": 1890000}]')
returns jsonb language sql as $$
  select plataforma_pedir_decisao((select bruna from ids), (select ipe from c), (select p1 from p), pg_temp.vp((select p1 from p)),
         'Qual conserto fazer na laje da G2', 'Chove na quinta', p_prazo, null, p_alts, 'CONSELHO') $$;
create function pg_temp.pedir_sindica(p_prazo date) returns uuid language sql as $$
  select (plataforma_pedir_decisao((select bruna from ids), (select ipe from c), (select p1 from p), pg_temp.vp((select p1 from p)),
          'Trocar a lâmpada da G2', 'Está escuro', p_prazo, (select v_ana from vs), '[{"descricao": "Trocar por LED"}]') ->> 'id')::uuid $$;

-- O link para copiar (WhatsApp): o código só volta para quem cuida do conselho.
create function pg_temp.link_de(p_decisao uuid, p_membro uuid) returns text language sql as $$
  select plataforma_reenviar_link_conselho((select ana from ids), (select ipe from c), p_decisao, null, p_membro) ->> 'codigo' $$;

create function pg_temp.dec(p_pessoa uuid, p_id uuid) returns jsonb language sql as $$
  select x from jsonb_array_elements(plataforma_decisoes(p_pessoa, (select ipe from c), 'TODAS') -> 'decisoes') x where x ->> 'id' = p_id::text $$;

-- Os e-mails da fila: o código do link sai na hora de montar.
create temp table emails (para text, finalidade text, titulo text, codigo text);
create function pg_temp.fila() returns void language sql as $$
  insert into emails select m ->> 'para', m -> 'conselho' ->> 'finalidade', m -> 'conselho' ->> 'titulo', m -> 'codigos' ->> 'abrir'
    from jsonb_array_elements(email_pegar_lote(100)) m where m ->> 'tipo' = 'CONSELHO' $$;
create function pg_temp.codigo_de(p_para text) returns text language sql as $$
  select codigo from emails where para = p_para order by ctid desc limit 1 $$;

-- ---------------------------------------------------------------------------------------
-- O conselho (V-14, quadros 410 e 411).

select throws_ok($$ select plataforma_conselho(bruna, ipe) from ids, c $$, 'TC401', null, 'V-14: quem só atualiza pedidos não vê o conselho');
select throws_ok($$ select plataforma_incluir_membro(gil, ipe, null, null, 'Lúcia Prado', null, 'lucia@exemplo.com', 'CONSELHEIRO',
                          '2026-01-01', '2027-12-31', 'EMAIL') from ids, c $$, 'TC401', null, 'V-14: quem aprova vê o conselho, mas não inclui');
select is(pg_temp.campos($$ select plataforma_incluir_membro(ana, ipe, null, null, 'Lúcia Prado', null, null, 'CONSELHEIRO',
                                   '2026-01-01', '2027-12-31', 'EMAIL') from ids, c $$), '["email"]'::jsonb,
  'V-14: pelo e-mail, falta o e-mail');
select is(pg_temp.campos($$ select plataforma_incluir_membro(ana, ipe, null, null, 'Lúcia Prado', null, 'lucia@exemplo.com', 'CONSELHEIRO',
                                   '2026-01-01', '2025-12-31', 'EMAIL') from ids, c $$), '["mandatoFim"]'::jsonb,
  'V-14: o fim do mandato vem depois do início');

create temp table m as select
  (plataforma_incluir_membro(ana, ipe, gil, null, null, null, 'gil@exemplo.com', 'SUBSINDICO', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_gil,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Lúcia Prado', null, 'Lucia@Exemplo.com', 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_lucia,
  (plataforma_incluir_membro(ana, ipe, null, c_marcos, null, null, null, 'CONSELHEIRO_FISCAL', '2025-12-01', '2026-11-30', 'WHATSAPP') ->> 'id')::uuid as m_marcos,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Rui Alves', '(61) 99999-0001', null, 'SUPLENTE', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_rui
  from ids, c, ct;
select is(pg_temp.motivo($$ select plataforma_incluir_membro(ana, ipe, null, null, 'Outro Sub', null, 'sub@exemplo.com', 'SUBSINDICO',
                                   '2026-01-01', '2027-12-31', 'EMAIL') from ids, c $$), 'JA_HA_SUBSINDICO', 'V-14: um subsíndico por vez');
select is(pg_temp.motivo($$ select plataforma_incluir_membro(ana, ipe, gil, null, null, null, 'gil@exemplo.com', 'CONSELHEIRO',
                                   '2026-01-01', '2027-12-31', 'EMAIL') from ids, c $$), 'JA_E_MEMBRO', 'V-14: a mesma pessoa não entra duas vezes');
select is((select nome || ' ' || celular || ' ' || coalesce(unidades_do_contato(contato_id), '') from conselho_membros, m where id = m_marcos),
  'Marcos Lima +5561999990304 Torre B · 304', 'V-14: o morador entra com o celular do cadastro');
select is((select email from conselho_membros, m where id = m_lucia), 'lucia@exemplo.com', 'V-14: o e-mail fica em minúsculas');
create temp table cs as select plataforma_conselho(ana, ipe) as r from ids, c;
select is((select array_agg(x ->> 'nome' order by n) from cs, jsonb_array_elements(r -> 'membros') with ordinality y(x, n)),
  array['Gil', 'Lúcia Prado', 'Marcos Lima', 'Rui Alves'], 'V-14: a lista vem pelo papel: subsíndico, conselheiros, suplente');
select is((select array_agg((x ->> 'vota')::boolean order by n) from cs, jsonb_array_elements(r -> 'membros') with ordinality y(x, n)),
  array[true, true, true, false], 'V-14: o suplente não vota');
select is((select (x ->> 'mandatoVencendo')::boolean from cs, jsonb_array_elements(r -> 'membros') x where x ->> 'nome' = 'Marcos Lima'), false,
  'V-14: o mandato de Marcos ainda não está perto do fim');
select is((select (r -> 'regras') - 'empate' - 'vencidaAvisa' - 'alcada' from cs), '{"quorum": "MAIORIA", "podePedir": true, "necessarios": 2, "titularesEmDia": 3}'::jsonb,
  'V-14: maioria de 3 titulares em dia é 2');
select is((select (plataforma_conselho(gil, ipe) -> 'membros' -> 1) ? 'email' from ids, c), false,
  'V-14: quem só vê o conselho não vê os contatos');
select is((select plataforma_conselho(gil, ipe) -> 'membros' -> 1 ->> 'emailMascarado' from ids, c), 'luc•••@exemplo.com',
  'V-14: vê o e-mail mascarado');
select is((select plataforma_pedido(bruna, ipe, p1) -> 'conselho' ->> 'necessarios' from ids, c, p), '2',
  'V-14: Pedir decisão mostra o conselho em Quem decide (quadro 413)');

-- ---------------------------------------------------------------------------------------
-- Votação: fecha quando uma alternativa chega aos votos necessários.

select is(pg_temp.campos($$ select plataforma_pedir_decisao(bruna, ipe, p1, pg_temp.vp(p1), 'Qual conserto', 'Chove na quinta', '2026-10-30', v_ana,
                                   '[{"descricao": "Remendo"}]', 'CONSELHO') from ids, c, p, vs $$), '["decisorId"]'::jsonb,
  'V-14: pedida ao conselho, não há uma pessoa que decide');
create temp table d1 as select pg_temp.pedir('2026-10-30') as r;
create temp table d as select (r ->> 'id')::uuid as d1 from d1;
select is((select (r ->> 'titulares') || '/' || (r ->> 'necessarios') from d1), '3/2', 'V-14: a decisão guarda o quórum na hora do pedido');
select is((select array_agg((x ->> 'nome') || ' ' || (x ->> 'envio') order by x ->> 'nome') from d1, jsonb_array_elements(r -> 'links') x),
  array['Gil EMAIL', 'Lúcia Prado EMAIL', 'Marcos Lima COPIAR'], 'V-14: cada titular ganha o link; pelo WhatsApp a tela mostra para copiar');
select is((select count(*)::int from votos_conselho, d where decisao_id = d1), 3, 'V-14: um voto pendente por titular, o suplente fora');
select is((select x ->> 'tipo' from ids, c, d, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x where x ->> 'decisaoId' = d1::text),
  'DECISAO_VOTO', 'V-14: quem tem painel é avisado no sino para votar');
select is((select tipo || ' ' || nome_do_vinculo(responsavel_id) from pendencias_pedido, d where id = (select pendencia_id from decisoes_pedido where id = d1)),
  'DECISAO Síndica Ana', 'V-14: a pendência da decisão fica com a síndica');
select is((select (r -> 'links' -> 2) - 'membroId' - 'decisaoId' from d1),
  '{"nome": "Marcos Lima", "canal": "WHATSAPP", "finalidade": "VOTO", "envio": "COPIAR", "aviso": "Peça o link ao síndico"}'::jsonb,
  'V-14: quem só pediu (Atualizar) não recebe o código do link de voto: pede ao síndico');
select is((select count(*)::int from codigos_sem_conta, links_conselho l, d, m where alvo_id = l.id and l.decisao_id = d1 and l.membro_id = m_marcos), 0,
  'V-14: e o código nem nasce');
create temp table marcos1 as select pg_temp.link_de(d1, m_marcos) as codigo from d, m;
select ok((select codigo is not null from marcos1), 'V-14: a síndica copia o link pelo Reenviar');
select pg_temp.fila();
select is((select count(*)::int from emails where finalidade = 'VOTO'), 2, 'V-14: o link vai pelo e-mail para Gil e Lúcia');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) ->> 'estado'), 'VOTAR', 'V-14: o link abre a votação, sem conta');
select ok((select aberto_em is not null from links_conselho, d, m where decisao_id = d1 and membro_id = m_lucia), 'V-14: a tela vê que o link foi aberto');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) -> 'item' ? 'pedido'), false,
  'V-14: o link não mostra o pedido nem quem o registrou');

select plataforma_votar_decisao(gil, ipe, d1, '1', null) from ids, c, d;
select is((select jsonb_array_length(plataforma_decisoes(gil, ipe, 'AGUARDANDO') -> 'decisoes') from ids, c), 1,
  'V-14: depois de votar, segue em Aguardando para trocar o voto até fechar');
select is((select plataforma_painel(gil, ipe) -> 'decisoes' -> 'votando' from ids, c), '1'::jsonb,
  'V-14: o resumo do painel conta a votação aberta de quem já votou, para Decisões seguir no menu');
select is((select (r -> 'conselho') - 'votos' - 'faltam' from (select pg_temp.dec((select ana from ids), d1) as r from d) y),
  '{"titulares": 3, "necessarios": 2, "votaram": 1, "contagem": {"1": 1}}'::jsonb, 'V-14: a gestão vê os votos na hora: 1 de 2');
select is((select r -> 'conselho' -> 'faltam' from (select pg_temp.dec((select ana from ids), d1) as r from d) y),
  '["Lúcia Prado", "Marcos Lima"]'::jsonb, 'V-14: e quem falta votar');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) -> 'conselho' -> 'votos'), '[]'::jsonb,
  'V-14: pelo link, os votos dos outros só depois de fechar');
select is(pg_temp.campos($$ select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '3', null) $$), '["escolha"]'::jsonb,
  'V-14: vota-se numa das alternativas');
select is((select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '1', null) ->> 'estado'), 'FECHADA',
  'V-14: o segundo voto igual fecha a votação');
select is((select estado || ' ' || alternativa_aprovada || ' · ' || justificativa from decisoes_pedido, d where id = d1),
  'APROVADA 1 · Aprovada por 2 de 3 titulares', 'V-14: aprovada pelo conselho, com o placar');
select ok((select resolvida_em is not null from pendencias_pedido where id = (select pendencia_id from decisoes_pedido, d where decisoes_pedido.id = d1)),
  'V-14: a pendência se resolve sozinha');
select is((select fechar_decisao_do_conselho(jsonb_populate_record(null::decisoes_pedido, to_jsonb(x) || '{"estado": "AGUARDANDO"}'))
             from decisoes_pedido x, d where x.id = d1), false, 'V-14: quem chega para fechar depois (a rotina, outro voto) não faz nada');
select is((select publico_conselho(codigo) ->> 'estado' from marcos1), 'FECHADA', 'V-14: o link de quem não votou mostra que fechou');
select is((select array_agg(x ->> 'nome' order by x ->> 'nome') from marcos1, jsonb_array_elements(publico_conselho(codigo) -> 'conselho' -> 'votos') x
            where x ? 'escolha'), array['Gil', 'Lúcia Prado'],
  'V-14: e, fechada, mostra os votos');
select is(pg_temp.motivo($$ select publico_votar_conselho(codigo, '2', null) from marcos1 $$), 'VOTACAO_FECHADA', 'V-14: fechada, não se vota mais');
select is((select x ->> 'tipo' from ids, c, d, jsonb_array_elements(plataforma_avisos(bruna, ipe) -> 'itens') x where x ->> 'decisaoId' = d1::text),
  'DECISAO_RESPONDIDA', 'V-14: quem pediu é avisado do resultado');
select is(pg_temp.motivo($$ select plataforma_responder_decisao(ana, ipe, d1, pg_temp.vd(d1), true, 1, 'Pode fazer') from ids, c, d $$),
  'DECISAO_FECHADA', 'V-14: a decisão do conselho não se responde à mão');

-- Troca de voto, link trocado, prazo que acaba e o empate que volta para a síndica.
create temp table d2r as select pg_temp.pedir('2026-10-30') as r;
create temp table d2 as select (r ->> 'id')::uuid as d2, pg_temp.link_de((r ->> 'id')::uuid, m_marcos) as marcos from d2r, m;
select pg_temp.fila();
select plataforma_votar_decisao(gil, ipe, d2, '2', null) from ids, c, d2;
select is((select plataforma_votar_decisao(gil, ipe, d2, '1', null) - 'estado' from ids, c, d2), '{"escolha": "1", "trocou": true}'::jsonb,
  'V-14: o voto troca até o prazo');
select is((select array_agg(dados ->> 'escolha' || coalesce('<' || (dados ->> 'antes'), '') order by id) from historico, d2
            where entidade = 'decisoes_pedido' and entidade_id = d2::text and acao = 'conselho.voto'),
  array['2', '1<2'], 'V-14: cada troca vai para o histórico');
select is(pg_temp.campos($$ select publico_votar_conselho(marcos, 'DEVOLVER', null) from d2 $$), '["justificativa"]'::jsonb,
  'V-14: devolver pede justificativa');
select throws_ok($$ select plataforma_votar_decisao(edu, ipe, d2, '1', null) from ids, c, d2 $$, 'TC401', null,
  'V-14: quem não é do conselho não vota');
select is((select plataforma_reenviar_link_conselho(bruna, ipe, d2, null, m_marcos) ->> 'aviso' from ids, c, d2, m), 'Peça o link ao síndico',
  'V-14: quem só pediu reenvia, mas não vê o código do WhatsApp');
select is((select publico_conselho(marcos) ->> 'estado' from d2), 'VOTAR', 'V-14: e o link que Marcos tem segue valendo');
create temp table novo as select plataforma_reenviar_link_conselho(ana, ipe, d2, null, m_marcos) as r from ids, c, d2, m;
select is((select r ->> 'envio' from novo), 'COPIAR', 'V-14: Reenviar o link gera outro para copiar');
select is((select publico_conselho(marcos) - 'condominio' from d2), '{"estado": "NAO_VALE", "membro": "Marcos Lima", "motivo": "LINK_TROCADO"}'::jsonb,
  'V-14: o link anterior para e não mostra mais nada');
select is(pg_temp.motivo($$ select publico_votar_conselho(marcos, '1', null) from d2 $$), 'LINK_TROCADO', 'V-14: e não vota');
select publico_votar_conselho(r ->> 'codigo', 'DEVOLVER', 'Falta o laudo do engenheiro.') from novo;
select is((select estado from decisoes_pedido, d2 where id = d2), 'AGUARDANDO', 'V-14: 1 a 1 com Lúcia por votar, segue aberta');

-- O fim do mandato chega perto: o sino da síndica avisa 30 dias antes.
select pg_temp.em('2026-10-31 08:00:00-03');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) ->> 'estado'), 'PRAZO_ACABOU', 'V-14: o link vale até o fim do dia do prazo');
select is(pg_temp.motivo($$ select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '1', null) $$), 'PRAZO_ACABOU',
  'V-14: depois do prazo, não se vota');
select verificar_decisoes();
select is((select estado || ' · ' || justificativa from decisoes_pedido, d2 where id = d2),
  'DEVOLVIDA · O conselho não chegou a 2 votos iguais até o prazo: voltou para o síndico decidir', 'V-14: sem quórum no prazo, volta para a síndica');
create temp table d2n as select id as d2n from decisoes_pedido where origem_id = (select d2 from d2);
select is((select modo || ' ' || nome_do_vinculo(decisor_id) || ' ' || estado || ' ' || prazo from decisoes_pedido, d2n where id = d2n),
  'PESSOA Síndica Ana AGUARDANDO 2026-11-07', 'V-14: uma decisão nova, para a síndica, com 7 dias');
select is((select array_agg(descricao order by numero) from alternativas_decisao, d2n where decisao_id = d2n),
  array['Remendo no trecho rachado', 'Refazer a impermeabilização'], 'V-14: com as mesmas alternativas');
select is((select pg_temp.dec((select ana from ids), d2n) -> 'origem' -> 'conselho' -> 'contagem' from d2n),
  '{"1": 1, "DEVOLVER": 1}'::jsonb, 'V-14: e com os votos do conselho à vista');
select is((select x ->> 'tipo' from ids, c, d2n, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'decisaoId' = d2n::text),
  'DECISAO_VOLTOU', 'V-14: a síndica é avisada de que voltou para ela');
select is((select x ->> 'titulo' from ids, c, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'tipo' = 'MANDATO_VENCENDO'),
  'Marcos Lima', 'V-14: o sino avisa o mandato que acaba em 30 dias');
select plataforma_responder_decisao(ana, ipe, d2n, pg_temp.vd(d2n), true, 1, 'Remendo agora, laudo depois.') from ids, c, d2n;

-- ---------------------------------------------------------------------------------------
-- Regras (quadro 421): Todos, mínimo e o empate que fica devolvido.

select pg_temp.em('2026-11-02 09:00:00-03');
select throws_ok($$ select plataforma_definir_regras_decisoes(bruna, ipe, pg_temp.vcfg(), 'TODOS', null, 'SINDICO', 'NINGUEM', null) from ids, c $$,
  'TC401', null, 'V-14: só quem configura muda as regras');
select is(pg_temp.campos($$ select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'MINIMO', 4, 'SINDICO', 'NINGUEM', null) from ids, c $$),
  '["minimo"]'::jsonb, 'V-14: o mínimo não passa dos titulares em dia');
select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'TODOS', null, 'SINDICO', 'NINGUEM', null) from ids, c;
create temp table d3 as select (pg_temp.pedir('2026-11-02') ->> 'id')::uuid as d3;
select is((select votos_necessarios from decisoes_pedido, d3 where id = d3), 3::smallint, 'V-14: Todos: 3 de 3');
select plataforma_votar_decisao(gil, ipe, d3, '1', null) from ids, c, d3;
select publico_votar_conselho(novo_codigo_conselho(l), 'DEVOLVER', 'Prefiro esperar o laudo.') from links_conselho l, d3, m
 where l.decisao_id = d3 and l.membro_id = m_lucia;
select is((select estado from decisoes_pedido, d3 where id = d3), 'AGUARDANDO', 'V-14: dividido, segue aberta: o voto ainda pode trocar até o prazo');

-- A despesa no mesmo impasse volta para a síndica, a mesma despesa.
create temp table x4 as select (plataforma_criar_despesa(bruna, ipe, 'Pintura da guarita', 120000, null, 'Tintas Cerrado', null, null, null, null,
                                                         'CONSELHO', null, '2026-11-02') ->> 'id')::uuid as x4 from ids, c;
select plataforma_votar_despesa(gil, ipe, x4, 'APROVAR', null) from ids, c, x4;
select publico_votar_conselho(novo_codigo_conselho(l), 'RECUSAR', 'Pintamos no ano passado.') from links_conselho l, x4, m
 where l.despesa_id = x4 and l.membro_id = m_lucia;

select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'MINIMO', 1, 'SINDICO', 'NINGUEM', null) from ids, c;
create temp table d4 as select (pg_temp.pedir('2026-11-06') ->> 'id')::uuid as d4;
select is((select votos_necessarios from decisoes_pedido, d4 where id = d4), 1::smallint, 'V-14: Mínimo de 1');
select plataforma_votar_decisao(gil, ipe, d4, '2', null) from ids, c, d4;
select is((select estado || ' ' || alternativa_aprovada from decisoes_pedido, d4 where id = d4), 'APROVADA 2', 'V-14: um voto decide');
select is((select votos_necessarios from decisoes_pedido, d3 where id = d3), 3::smallint, 'V-14: mudar a regra não muda o quórum do que já foi pedido');

-- No dia seguinte ao prazo, a rotina fecha o empate e devolve à síndica.
select pg_temp.em('2026-11-03 08:00:00-03');
select verificar_decisoes();
select is((select estado || ' · ' || justificativa from decisoes_pedido, d3 where id = d3),
  'DEVOLVIDA · O conselho não chegou a 3 votos iguais até o prazo: voltou para o síndico decidir', 'V-14: empate no prazo volta para a síndica');
select is((select count(*)::int from decisoes_pedido, d3 where origem_id = d3), 1, 'V-14: numa decisão nova');
select is((select estado || ' ' || modo || ' ' || nome_do_vinculo(decisor_id) || ' ' || (voltou_ao_sindico_em is not null) || ' ' || prazo
             from despesas_aprovacao, x4 where id = x4), 'AGUARDANDO PESSOA Síndica Ana true 2026-11-10',
  'FC-10: a despesa sem quórum passa para a síndica, a mesma despesa, com 7 dias');
select is(pg_temp.motivo($$ select publico_votar_conselho(novo_codigo_conselho(l), 'APROVAR', null) from links_conselho l, x4, m
                            where l.despesa_id = x4 and l.membro_id = m_marcos $$), 'VOLTOU_AO_SINDICO', 'FC-10: o voto que faltava não vale mais');
select is((select x ->> 'tipo' from ids, c, x4, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'despesaId' = x4::text),
  'DESPESA_VOLTOU', 'FC-10: a síndica é avisada');
select is((select plataforma_responder_despesa(ana, ipe, x4, pg_temp.vx(x4), true, 'Vale pela segurança.') ? 'versao' from ids, c, x4), true,
  'FC-10: e responde a que voltou');

-- Com a regra Fica devolvida, o empate não volta para ninguém (a rotina confere amanhã).
select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'TODOS', null, 'DEVOLVIDA', 'NINGUEM', null) from ids, c;
create temp table d5 as select (pg_temp.pedir('2026-11-03') ->> 'id')::uuid as d5;
select plataforma_votar_decisao(gil, ipe, d5, '1', null) from ids, c, d5;
select publico_votar_conselho(novo_codigo_conselho(l), '2', null) from links_conselho l, d5, m where l.decisao_id = d5 and l.membro_id = m_lucia;
select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'MAIORIA', null, 'DEVOLVIDA', 'NINGUEM', 500000) from ids, c;
select is((select plataforma_regras_decisoes(ana, ipe) - 'versao' - 'pode' from ids, c),
  '{"quorum": "MAIORIA", "podePedir": true, "necessarios": 2, "titularesEmDia": 3, "empate": "DEVOLVIDA", "vencidaAvisa": "NINGUEM", "alcada": 500000, "subsindico": "Gil", "sindico": "Síndica Ana"}'::jsonb,
  'V-14: as regras guardadas, com a alçada');
select is((select count(*)::int from historico where acao = 'regras_decisoes.alteradas'), 4, 'V-14: cada mudança das regras vai para o histórico');

-- ---------------------------------------------------------------------------------------
-- Despesa para aprovar, ponta a ponta (FC-10).

select pg_temp.em('2026-11-03 09:00:00-03');
select throws_ok($$ select plataforma_criar_despesa(edu, ipe, 'Bomba nova', 800000, null, 'HidroPress', null, null, null, null, 'CONSELHO', null, '2026-11-10')
                    from ids, c $$, 'TC401', null, 'FC-10: quem só acompanha não registra despesa');
select is(pg_temp.campos($$ select plataforma_criar_despesa(bruna, ipe, 'Bomba nova', 0, null, 'HidroPress', null, null, null, null, 'CONSELHO', null, '2026-11-10')
                           from ids, c $$), '["valor"]'::jsonb, 'FC-10: o valor é maior que zero');
select is(pg_temp.campos($$ select plataforma_criar_despesa(bruna, ipe, 'Bomba nova', 800000, null, null, null, null, null, null, 'CONSELHO', null, '2026-11-10')
                           from ids, c $$), '["fornecedor"]'::jsonb, 'FC-10: diga o fornecedor');
select is(pg_temp.campos($$ select plataforma_criar_despesa(bruna, ipe, 'Bomba nova', 800000, null, 'HidroPress', null, null, null, null, 'CONSELHO', null, '2027-03-01')
                           from ids, c $$), '["prazo"]'::jsonb, 'FC-10: o prazo vai de hoje a 90 dias');
select is(pg_temp.campos($$ select plataforma_criar_despesa(bruna, ipe, 'Bomba nova', 800000, null, 'HidroPress', null, null, null, null, 'PESSOA', v_bruna, '2026-11-10')
                           from ids, c, vs $$), '["decisorId"]'::jsonb, 'FC-10: aprova quem tem Aprovar');
create temp table mt as select (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba do poço', 'Casa de bombas', null, normal, v_ana,
                                                               null, null, null, null, null, null, null) ->> 'id')::uuid as mt from ids, c, cfg, vs;
select is(pg_temp.campos($$ select plataforma_criar_despesa(bruna, ipe, 'Bomba nova', 800000, null, 'HidroPress', null, null, mt, null, 'CONSELHO', null,
                                   '2026-11-10') from ids, c, mt $$), '["manutencaoId"]'::jsonb, 'FC-10: só se liga à manutenção que a pessoa vê');
create temp table x1r as select plataforma_criar_despesa(bruna, ipe, 'Bomba nova do poço', 800000, null, 'HidroPress', '2026-11-20', p1, null, null,
                                                         'CONSELHO', null, '2026-11-10') as r from ids, c, p;
create temp table x1 as select (r ->> 'id')::uuid as x1 from x1r;
select is((select (r ->> 'passaAlcada') || ' ' || (r ->> 'alcada') from x1r), 'true 500000', 'FC-10: passa da alçada: só avisa, não bloqueia');
select is((select plataforma_despesa(ana, ipe, x1) -> 'ligacao' ->> 'tipo' from ids, c, x1), 'PEDIDO',
  'FC-10: a despesa fica ligada ao pedido');

-- Os anexos: fatura e orçamento, no armazenamento privado dos pedidos.
select is(pg_temp.motivo($$ select plataforma_iniciar_anexo_aprovacao(bruna, ipe, null, x1, 'DOCUMENTO', 'fatura.docx', 'application/msword', 1000)
                            from ids, c, x1 $$), 'TIPO_NAO_ACEITO', 'FC-10: só fotos e PDF');
create temp table ax as select plataforma_iniciar_anexo_aprovacao(bruna, ipe, null, x1, 'DOCUMENTO', 'Orçamento HidroPress.pdf', 'application/pdf', 3000) as r
  from ids, c, x1;
select ok((select (r ->> 'caminho') = ipe || '/aprovacoes/' || x1 || '/' || (r ->> 'arquivoId') from ax, c, x1), 'FC-10: o caminho é do condomínio e da despesa');
select is(pg_temp.motivo($$ select plataforma_abrir_anexo_aprovacao(bruna, ipe, (r ->> 'arquivoId')::uuid) from ids, c, ax $$), 'ARQUIVO_NAO_LIBERADO',
  'FC-10: antes de verificado, não abre');
select plataforma_verificar_anexo_aprovacao(bruna, ipe, (r ->> 'arquivoId')::uuid, true, 2900, null) from ids, c, ax;
select is((select plataforma_abrir_anexo_aprovacao(gil, ipe, (r ->> 'arquivoId')::uuid) ->> 'nome' from ids, c, ax), 'Orçamento HidroPress.pdf',
  'FC-10: quem vota abre o anexo');
select is((select publico_conselho_anexo(novo_codigo_conselho(l), (r ->> 'arquivoId')::uuid) ->> 'tipo' from links_conselho l, x1, m, ax
            where l.despesa_id = x1 and l.membro_id = m_marcos), 'application/pdf', 'FC-10: e pelo link também');
select throws_ok($$ select plataforma_abrir_anexo_aprovacao(edu, ipe, (r ->> 'arquivoId')::uuid) from ids, c, ax $$, 'TC404', null,
  'FC-10: quem não cuida das despesas não abre');
select throws_ok($$ select plataforma_iniciar_anexo_aprovacao(bruna, ipe, null, x1, 'COMPROVANTE', 'pix.png', 'image/png', 1000) from ids, c, x1 $$,
  'TC401', null, 'FC-10: o comprovante só depois de aprovada');

select plataforma_votar_despesa(gil, ipe, x1, 'APROVAR', null) from ids, c, x1;
select is(pg_temp.motivo($$ select plataforma_alterar_despesa(bruna, ipe, x1, pg_temp.vx(x1), 'Bomba nova do poço', 750000, null, 'HidroPress', null, p1, null, null)
                            from ids, c, x1, p $$), 'DESPESA_COM_VOTO', 'FC-10: com voto dado, a despesa não muda');
create temp table luc as select novo_codigo_conselho(l) as codigo from links_conselho l, x1, m where l.despesa_id = x1 and l.membro_id = m_lucia;
select is((select (publico_conselho(codigo) -> 'item') - 'anexos' - 'pedidaEm' from luc),
  '{"tipo": "DESPESA", "descricao": "Bomba nova do poço", "valor": 800000, "moeda": "BRL", "fornecedor": "HidroPress", "vencimento": "2026-11-20", "pedidaPor": "Bruna"}'::jsonb,
  'FC-10: pelo link, o que é, o valor, o fornecedor e o vencimento');
select is(pg_temp.campos($$ select publico_votar_conselho(codigo, 'RECUSAR', null) from luc $$), '["justificativa"]'::jsonb, 'FC-10: recusar pede o porquê');
select is((select publico_votar_conselho(codigo, 'APROVAR', null) ->> 'estado' from luc), 'FECHADA', 'FC-10: dois votos aprovam');
select throws_ok($$ select publico_conselho_anexo(codigo, (r ->> 'arquivoId')::uuid) from luc, ax $$, 'TC404', null,
  'FC-10: fechada a votação, o link não entrega mais os anexos');
select is((select fechar_despesa_do_conselho(jsonb_populate_record(null::despesas_aprovacao, to_jsonb(x) || '{"estado": "AGUARDANDO"}'))
             from despesas_aprovacao x, x1 where x.id = x1), false, 'FC-10: fechar de novo, ao mesmo tempo, não faz nada');
select is((select estado || ' · ' || justificativa from despesas_aprovacao, x1 where id = x1), 'APROVADA · Aprovada por 2 de 3 titulares',
  'FC-10: aprovada pelo conselho');
select is((select x ->> 'tipo' from ids, c, x1, jsonb_array_elements(plataforma_avisos(bruna, ipe) -> 'itens') x where x ->> 'despesaId' = x1::text),
  'DESPESA_RESPONDIDA', 'FC-10: quem registrou é avisado');

-- Paga fora do sistema: só o registro, com a data e o comprovante.
create temp table cp as select (plataforma_iniciar_anexo_aprovacao(bruna, ipe, null, x1, 'COMPROVANTE', 'pix.png', 'image/png', 1000) ->> 'arquivoId')::uuid as cp
  from ids, c, x1;
select plataforma_verificar_anexo_aprovacao(bruna, ipe, cp, true, 900, null) from ids, c, cp;
select is((select plataforma_despesa(bruna, ipe, x1) -> 'pode' ->> 'anexarComprovante' from ids, c, x1), 'true',
  'FC-10: aprovada e sem pagamento, junta o comprovante');
select is(pg_temp.campos($$ select plataforma_pagar_despesa(bruna, ipe, x1, pg_temp.vx(x1), '2026-11-03', (r ->> 'arquivoId')::uuid) from ids, c, x1, ax $$),
  '["comprovanteId"]'::jsonb, 'FC-10: o orçamento não vale como comprovante');
select is(pg_temp.campos($$ select plataforma_pagar_despesa(bruna, ipe, x1, pg_temp.vx(x1), '2026-11-04', cp) from ids, c, x1, cp $$), '["pagaEm"]'::jsonb,
  'FC-10: pago até hoje');
select plataforma_pagar_despesa(bruna, ipe, x1, pg_temp.vx(x1), '2026-11-03', cp) from ids, c, x1, cp;
select is((select (plataforma_despesa(ana, ipe, x1) -> 'pagamento') - 'registradaEm' from ids, c, x1),
  (select jsonb_build_object('pagaEm', '2026-11-03', 'registradaPor', 'Bruna', 'comprovanteId', cp) from cp), 'FC-10: Paga fora do sistema, com o comprovante');
select is((select plataforma_despesa(bruna, ipe, x1) -> 'pode' ->> 'anexarComprovante' from ids, c, x1), 'false', 'FC-10: paga, não junta outro');
select is(pg_temp.motivo($$ select plataforma_tirar_anexo_aprovacao(bruna, ipe, cp, 'Errei o arquivo') from ids, c, cp $$), 'COMPROVANTE_EM_USO',
  'FC-10: o comprovante do pagamento não sai');
select plataforma_desfazer_pagamento(bruna, ipe, x1, pg_temp.vx(x1)) from ids, c, x1;
select is((select paga_em from despesas_aprovacao, x1 where id = x1), null::date, 'FC-10: o registro se desfaz');
select plataforma_pagar_despesa(bruna, ipe, x1, pg_temp.vx(x1), '2026-11-03', null) from ids, c, x1;
select is((select array_agg(acao order by id) from historico, x1 where entidade = 'despesas_aprovacao' and entidade_id = x1::text and acao like 'despesa.%'),
  array['despesa.pedida', 'despesa.respondida', 'despesa.paga_fora', 'despesa.pagamento_desfeito', 'despesa.paga_fora'],
  'FC-10: cada passo vai para o histórico');
select is((select plataforma_despesa(ana, ipe, x1) -> 'comunicado' ->> 'texto' from ids, c, x1),
  'Bomba nova do poço, de R$ 8.000,00, com HidroPress, foi aprovada em 03/11/2026 (Aprovada por 2 de 3 titulares).',
  'FC-10: o texto pronto para publicar como comunicado');

-- Pessoa aprova, recusa e retira.
create temp table x2 as select (plataforma_criar_despesa(bruna, ipe, 'Troca do interfone', 350000, null, 'Fala Fácil', null, null, null, null,
                                                         'PESSOA', v_ana, '2026-11-10') ->> 'id')::uuid as x2 from ids, c, vs;
select is((select x ->> 'tipo' from ids, c, x2, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x where x ->> 'despesaId' = x2::text),
  'DESPESA_PEDIDA', 'FC-10: quem aprova é avisado no sino');
select throws_ok($$ select plataforma_responder_despesa(bruna, ipe, x2, pg_temp.vx(x2), true, 'Pode') from ids, c, x2 $$, 'TC401', null,
  'FC-10: quem não aprova não responde');
select is(pg_temp.campos($$ select plataforma_responder_despesa(ana, ipe, x2, pg_temp.vx(x2), false, '') from ids, c, x2 $$), '["justificativa"]'::jsonb,
  'FC-10: a resposta tem justificativa');
select plataforma_responder_despesa(ana, ipe, x2, pg_temp.vx(x2), false, 'O interfone atual ainda tem garantia.') from ids, c, x2;
select is((select estado || ' ' || nome_pessoa(respondida_por) from despesas_aprovacao, x2 where id = x2), 'RECUSADA Síndica Ana', 'FC-10: recusada pela síndica');
select is(pg_temp.motivo($$ select plataforma_pagar_despesa(bruna, ipe, x2, pg_temp.vx(x2), '2026-11-03', null) from ids, c, x2 $$), 'DESPESA_NAO_APROVADA',
  'FC-10: só a aprovada se marca como paga');
create temp table x3 as select (plataforma_criar_despesa(bruna, ipe, 'Poda das árvores', 90000, null, 'Verde Vivo', null, null, null, null,
                                                         'CONSELHO', null, '2026-11-10') ->> 'id')::uuid as x3 from ids, c;
select plataforma_retirar_despesa(bruna, ipe, x3, pg_temp.vx(x3), 'A prefeitura vai podar') from ids, c, x3;
select is((select estado from despesas_aprovacao, x3 where id = x3), 'RETIRADA', 'FC-10: quem pediu retira, com motivo');
select is((select publico_conselho(novo_codigo_conselho(l)) ->> 'estado' from links_conselho l, x3, m where l.despesa_id = x3 and l.membro_id = m_lucia),
  'FECHADA', 'FC-10: o link da retirada mostra que fechou');
select is((select plataforma_despesas(ana, ipe, 'TODAS') -> 'contagem' from ids, c), '{"AGUARDANDO": 0, "APROVADAS": 2, "RECUSADAS": 1}'::jsonb,
  'FC-10: os filtros Aguardando, Aprovadas e Recusadas');
select is((select jsonb_array_length(plataforma_despesas(ana, ipe, 'TODAS') -> 'despesas') from ids, c), 4, 'FC-10: Todas inclui a retirada');
select is((select jsonb_array_length(plataforma_despesas(edu, ipe, 'TODAS') -> 'despesas') from ids, c), 0, 'FC-10: quem só acompanha não vê despesas');
select is((select count(*)::int from ids, c, jsonb_array_elements(plataforma_linha_do_tempo(ana, ipe, 'DOCUMENTOS', null) -> 'eventos') x
            where x ->> 'fonte' = 'DESPESA'), 3, 'FC-10: a decidida vai para a linha do tempo do prédio');
select is((select x ->> 'titulo' from ids, c, x2, jsonb_array_elements(plataforma_linha_do_tempo(ana, ipe, 'DOCUMENTOS', null) -> 'eventos') x
            where x ->> 'id' = x2::text), 'Despesa recusada: Troca do interfone', 'FC-10: com o resultado no título');

select pg_temp.em('2026-11-04 08:00:00-03');
select verificar_decisoes();
select is((select estado from decisoes_pedido, d5 where id = d5), 'DEVOLVIDA', 'V-14: empate com a regra Fica devolvida');
select is((select count(*)::int from decisoes_pedido, d5 where origem_id = d5), 0, 'V-14: e não volta para a síndica');

-- ---------------------------------------------------------------------------------------
-- Mandato vencido e a ausência da síndica (quadro 412).

select pg_temp.em('2026-11-25 09:00:00-03');
create temp table d6r as select pg_temp.pedir('2026-12-04') as r;
create temp table d6 as select (r ->> 'id')::uuid as d6, pg_temp.link_de((r ->> 'id')::uuid, m_marcos) as marcos from d6r, m;
select pg_temp.fila();
select is(pg_temp.motivo($$ select plataforma_alterar_membro(ana, ipe, m_marcos, pg_temp.vm(m_marcos), 'SUPLENTE', '2025-12-01', '2026-11-30', 'WHATSAPP',
                                   '+5561999990304', null) from ids, c, m $$),
  'VOTO_PENDENTE', 'V-14: quem tem voto a dar numa votação aberta não passa a suplente');
select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '1', null);
select plataforma_alterar_membro(ana, ipe, m_lucia, pg_temp.vm(m_lucia), 'SUPLENTE', '2026-01-01', '2027-12-31', 'EMAIL', null, 'lucia@exemplo.com')
  from ids, c, m;
select is((select pg_temp.dec((select ana from ids), d6) -> 'conselho' -> 'contagem' from d6), '{"1": 1}'::jsonb,
  'V-14: quem votou e passou a suplente: o voto fica');
select is((select pg_temp.dec((select ana from ids), d6) -> 'conselho' -> 'faltam' from d6), '["Gil", "Marcos Lima"]'::jsonb,
  'V-14: falta quem vota hoje');
select is(pg_temp.motivo($$ select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '2', null) $$), 'SUPLENTE_NAO_VOTA',
  'V-14: suplente não troca o voto');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) - 'condominio'),
  '{"estado": "NAO_VALE", "motivo": "SUPLENTE_NAO_VOTA", "membro": "Lúcia Prado"}'::jsonb, 'V-14: o link dela não vale e não mostra o item');
select plataforma_alterar_membro(ana, ipe, m_lucia, pg_temp.vm(m_lucia), 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'EMAIL', null, 'lucia@exemplo.com')
  from ids, c, m;
select is((select publico_conselho(codigo) - 'condominio' from marcos1), '{"estado": "LINK_VENCIDO", "membro": "Marcos Lima"}'::jsonb,
  'V-14: 7 dias depois do prazo, o link venceu e não mostra mais nada');
select pg_temp.em('2026-12-01 09:00:00-03');
select is((select publico_conselho(marcos) ->> 'estado' || ' ' || (publico_conselho(marcos) ->> 'motivo') from d6), 'NAO_VALE MANDATO_VENCIDO',
  'V-14: com o mandato vencido, o link não vale');
select is(pg_temp.motivo($$ select publico_votar_conselho(marcos, '1', null) from d6 $$), 'MANDATO_VENCIDO', 'V-14: mandato vencido não vota');
select is((select publico_conselho(marcos) ? 'item' from d6), false, 'V-14: e o link não mostra o item');
select is((select plataforma_conselho(ana, ipe) -> 'regras' ->> 'titularesEmDia' from ids, c), '2', 'V-14: os titulares em dia agora são 2');

select is(pg_temp.campos($$ select plataforma_marcar_ausencia(ana, ipe, '2026-12-01', '2027-02-15', 'Viagem') from ids, c $$), '["ate"]'::jsonb,
  'V-14: a ausência vai até 60 dias');
create temp table au as select (plataforma_marcar_ausencia(ana, ipe, '2026-12-01', '2026-12-10', 'Viagem de família') ->> 'id')::uuid as au from ids, c;
select is(pg_temp.motivo($$ select plataforma_marcar_ausencia(ana, ipe, '2026-12-05', '2026-12-08', 'Outra') from ids, c $$), 'JA_HA_AUSENCIA',
  'V-14: uma ausência por vez');
select throws_ok($$ insert into ausencias_sindico (condominio_id, sindico_id, substituto_id, de, ate, motivo, criada_por)
                    select condominio_id, sindico_id, substituto_id, de, ate, 'Outra', criada_por from ausencias_sindico, au where id = au $$,
  '23505', null, 'V-14: o banco garante uma ausência aberta por vez, também com dois pedidos ao mesmo tempo');
select is((select x ->> 'tipo' from ids, c, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x where x ->> 'tipo' = 'AUSENCIA_INICIO'),
  'AUSENCIA_INICIO', 'V-14: o subsíndico é avisado de que responde no lugar da síndica');
create temp table d7 as select pg_temp.pedir_sindica('2026-12-04') as d7;
select is((select (pg_temp.dec((select gil from ids), d7) -> 'pode' ->> 'responder')::boolean from d7), true,
  'V-14: durante a ausência, o subsíndico responde o que foi pedido à síndica');
select is((select plataforma_decisoes(gil, ipe, 'AGUARDANDO') ->> 'aguardandoEu' from ids, c), '3', 'V-14: e vê na fila dele: o voto e as duas pedidas à síndica');
select plataforma_responder_decisao(gil, ipe, d7, pg_temp.vd(d7), true, 1, 'Pode trocar.') from ids, c, d7;
select is((select estado || ' ' || nome_pessoa(respondida_por) from decisoes_pedido, d7 where id = d7), 'APROVADA Gil', 'V-14: respondida pelo substituto');
select is((select array_agg(x ->> 'tipo' order by x ->> 'tipo') from ids, c, d7, jsonb_array_elements(plataforma_avisos(ana, ipe) -> 'itens') x
            where x ->> 'decisaoId' = d7::text), array['DECISAO_PEDIDA', 'DECISAO_RESPONDIDA'], 'V-14: a síndica fica sabendo');
create temp table x5 as select (plataforma_criar_despesa(bruna, ipe, 'Lâmpadas LED', 45000, null, 'Elétrica Sol', null, null, null, null,
                                                         'PESSOA', v_ana, '2026-12-04') ->> 'id')::uuid as x5 from ids, c, vs;
select plataforma_responder_despesa(gil, ipe, x5, pg_temp.vx(x5), true, 'Pode comprar.') from ids, c, x5;
select is((select estado || ' ' || nome_pessoa(respondida_por) from despesas_aprovacao, x5 where id = x5), 'APROVADA Gil', 'FC-10: a despesa também');
select plataforma_encerrar_ausencia(ana, ipe, au, (select versao from ausencias_sindico where id = au)) from ids, c, au;
create temp table d8 as select pg_temp.pedir_sindica('2026-12-04') as d8;
select throws_ok($$ select plataforma_responder_decisao(gil, ipe, d8, pg_temp.vd(d8), true, 1, 'Pode') from ids, c, d8 $$, 'TC401', null,
  'V-14: encerrada a ausência, a síndica volta a responder');

-- A vencida avisa também o conselho, pela regra: pelo sino de quem tem painel e pelo link de quem
-- não tem, só para ver.
select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'MAIORIA', null, 'SINDICO', 'CONSELHO', 500000) from ids, c;
select pg_temp.em('2026-12-05 09:00:00-03');
select verificar_decisoes();
select is((select x ->> 'tipo' from ids, c, d8, jsonb_array_elements(plataforma_avisos(gil, ipe) -> 'itens') x
            where x ->> 'decisaoId' = d8::text and x ->> 'tipo' = 'DECISAO_ESCALADA'), 'DECISAO_ESCALADA', 'V-14: o subsíndico é avisado no sino');
select pg_temp.fila();
select is((select finalidade from emails where para = 'lucia@exemplo.com' order by ctid desc limit 1), 'AVISO', 'V-14: Lúcia recebe o link para ver');
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) ->> 'estado'), 'AGUARDANDO', 'V-14: só para ver, sem votar');
select is(pg_temp.motivo($$ select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), '1', null) $$), 'NAO_VOTA', 'V-14: e não vota');
select is((select plataforma_reenviar_link_conselho(ana, ipe, d8, null, m_lucia, 'AVISO') ->> 'finalidade' from ids, c, d8, m), 'AVISO',
  'V-14: o link do aviso também se manda de novo');
select pg_temp.fila();
create temp table av as select pg_temp.codigo_de('lucia@exemplo.com') as a1,
  (select envio_email_id from codigos_sem_conta, links_conselho l, d8, m
    where alvo_id = l.id and l.decisao_id = d8 and l.membro_id = m_lucia and l.finalidade = 'AVISO' and codigos_sem_conta.revogado_em is null) as envio;
update envios_email set estado = 'NA_FILA' where id = (select envio from av);
select pg_temp.fila();
select is((select publico_conselho(a1) ->> 'estado' from av), 'AGUARDANDO', 'V-14: a nova tentativa do e-mail não para o código da que pode ter chegado');
select email_resultado(ipe, envio, null, 'Caixa não existe', false) from c, av;
select is((select publico_conselho(a1) ->> 'motivo' || ' ' || (publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) ->> 'motivo') from av),
  'LINK_TROCADO LINK_TROCADO', 'V-14: o e-mail que falhou de vez para os códigos que levava');

select is(pg_temp.campos($$ select plataforma_retirar_membro(ana, ipe, m_gil, pg_temp.vm(m_gil), '') from ids, c, m $$), '["motivo"]'::jsonb,
  'V-14: retirar pede motivo');
select plataforma_retirar_membro(ana, ipe, m_lucia, pg_temp.vm(m_lucia), 'Mudou-se do prédio') from ids, c, m;
select is((select publico_conselho(pg_temp.codigo_de('lucia@exemplo.com')) - 'condominio'),
  '{"estado": "NAO_VALE", "motivo": "SAIU_DO_CONSELHO", "membro": "Lúcia Prado"}'::jsonb, 'V-14: os links de quem sai param e não mostram nada');
select is((select count(*)::int from conselho_membros), 4, 'V-14: retirar não apaga');

-- O subsíndico sem painel responde no lugar da síndica pelo link (quadro 416).
select plataforma_retirar_membro(ana, ipe, m_gil, pg_temp.vm(m_gil), 'Deixou o cargo') from ids, c, m;
select plataforma_alterar_membro(ana, ipe, m_rui, pg_temp.vm(m_rui), 'SUBSINDICO', '2026-01-01', '2027-12-31', 'WHATSAPP', '61999990001', null) from ids, c, m;
create temp table au2 as select plataforma_marcar_ausencia(ana, ipe, '2026-12-05', '2026-12-12', 'Cirurgia') as r from ids, c;
create temp table rui0 as select x ->> 'codigo' as codigo from au2, d8, jsonb_array_elements(r -> 'links') x where x ->> 'decisaoId' = d8::text;
select is((select (x ->> 'finalidade') || ' ' || (x ->> 'envio') || ' ' || (x ? 'codigo') from au2, d8, jsonb_array_elements(r -> 'links') x
            where x ->> 'decisaoId' = d8::text), 'SUBSTITUTO COPIAR true', 'V-14: marcar a ausência devolve o link do substituto para copiar');
select is((select (pg_temp.dec((select ana from ids), d8) -> 'links' -> 0) - 'mandadoEm' - 'membroId' from d8),
  '{"nome": "Rui Alves", "finalidade": "SUBSTITUTO", "canal": "WHATSAPP", "envio": "COPIAR", "podeReenviar": true}'::jsonb,
  'V-14: a decisão mostra quem tem o link do substituto e que dá para copiar de novo');
create temp table rui as select plataforma_reenviar_link_conselho(ana, ipe, d8, null, m_rui, 'SUBSTITUTO') ->> 'codigo' as codigo from ids, c, d8, m;
select is((select publico_conselho(codigo) ->> 'motivo' from rui0), 'LINK_TROCADO', 'V-14: copiar de novo troca o link do substituto');
select is((select publico_conselho(codigo) ->> 'estado' from rui), 'RESPONDER', 'V-14: o link do substituto responde no lugar da síndica');
select is(pg_temp.campos($$ select publico_responder_conselho(codigo, true, 1, null) from rui $$), '["justificativa"]'::jsonb,
  'V-14: com justificativa');
select is((select publico_responder_conselho(codigo, true, 1, 'Pode trocar a lâmpada.') ->> 'estado' from rui), 'FECHADA', 'V-14: respondida pelo link');
select is((select pg_temp.dec((select ana from ids), d8) ->> 'respondidaPor' from d8), 'Rui Alves', 'V-14: em nome do subsíndico');
create temp table x6 as select plataforma_criar_despesa(bruna, ipe, 'Conserto do portão', 60000, null, 'Portões Já', null, null, null, null,
                                                        'PESSOA', v_ana, '2026-12-10') as r from ids, c, vs;
select is((select (r -> 'links' -> 0) - 'membroId' - 'despesaId' from x6),
  '{"nome": "Rui Alves", "canal": "WHATSAPP", "finalidade": "SUBSTITUTO", "envio": "COPIAR", "aviso": "Peça o link ao síndico"}'::jsonb,
  'FC-10: pedida à síndica ausente, nasce o link do substituto; quem pediu não vê o código');
select is((select plataforma_despesa(ana, ipe, (r ->> 'id')::uuid) -> 'links' -> 0 ->> 'podeReenviar' from ids, c, x6), 'true',
  'FC-10: a síndica vê o link do substituto e pode copiar');

select pg_temp.em('2026-12-20 09:00:00-03');
select ok((select plataforma_marcar_ausencia(ana, ipe, '2026-12-20', '2026-12-22', 'Folga') ? 'id' from ids, c),
  'V-14: a ausência que passou do fim não impede marcar outra');
select ok((select encerrada_em is not null from ausencias_sindico where de = '2026-12-05'), 'V-14: a que passou do fim fica encerrada');

-- ---------------------------------------------------------------------------------------
-- Relatório do mês e isolamento entre condomínios.

select is((select plataforma_previa_relatorio(ana, ipe, '2026-11') -> 'decisoes' -> 'despesas' from ids, c),
  '{"pedidas": 4, "aprovadas": 2, "recusadas": 1, "valorAprovado": 920000, "aguardandoNoFim": 0}'::jsonb,
  'FC-10: as despesas entram nas Decisões do mês');
select is((select plataforma_previa_relatorio(ana, ipe, '2026-11') -> 'decisoes' ->> 'peloConselho' from ids, c), '4',
  'V-14: e o que o conselho decidiu');
select throws_ok($$ select plataforma_despesas(davi, ipe, 'TODAS') from ids, c $$, 'TC401', null, 'PT-01: o síndico de outro condomínio não entra');
select throws_ok($$ select plataforma_despesa(davi, jatoba, x1) from ids, c, x1 $$, 'TC404', null, 'PT-01: nem acha a despesa pelo dele');
select is((select array_agg(x ->> 'nome') from ids, c, jsonb_array_elements(plataforma_conselho_candidatos(davi, jatoba, null) -> 'candidatos') x),
  array['Síndico Davi'], 'PT-01: os candidatos são só do dele');
select is((select array_agg(x ->> 'nome' order by x ->> 'nome') from ids, c, jsonb_array_elements(plataforma_conselho_candidatos(ana, ipe, null) -> 'candidatos') x),
  array['Bruna', 'Edu', 'Gil', 'Síndica Ana'], 'V-14: os candidatos: quem tem acesso (Gil saiu e pode voltar), menos quem já é do conselho');
select is((select jsonb_array_length(plataforma_conselho(davi, jatoba) -> 'membros') from ids, c), 0, 'PT-01: o conselho do outro é vazio');

select set_config('app.pessoa_id', (select davi::text from ids), true), set_config('app.condominio_id', (select jatoba::text from c), true);
set local role dominio;
select is((select count(*)::int from conselho_membros) + (select count(*)::int from despesas_aprovacao) + (select count(*)::int from votos_conselho)
          + (select count(*)::int from links_conselho) + (select count(*)::int from arquivos_aprovacao) + (select count(*)::int from ausencias_sindico),
  0, 'RLS: nada do conselho nem das despesas do Ipê aparece no Jatobá');
reset role;
select set_config('app.condominio_id', '', true), set_config('app.pessoa_id', '', true);

select * from finish();
rollback;

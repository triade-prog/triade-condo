-- Orçamentos e compras (R8: OC-01 a OC-07, OC-10). O Residencial Ipê troca a bomba do poço: a
-- zeladora Bruna pede propostas a três fornecedores (um cadastrado, dois pelo link), um recusa, um
-- manda duas versões, o prazo fecha sozinho, a síndica liga a regra por faixa, Gil decide com o
-- motivo, o conselho recusa e depois aprova, o fornecedor aceita pelo link, a compra e a entrega
-- ficam registradas. Um segundo orçamento mostra o prestador que nasce da cotação e o cancelamento;
-- um terceiro, o link que vence. O relógio começa numa segunda-feira, 26/10/2026, às 09:00.
begin;
select plan(182);

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
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['ATUALIZAR']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Subsíndico', array['APROVAR']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, edu, 'Edu', 'Secretário', array['ACOMPANHAR']) as v_edu
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.vo(p uuid) returns integer language sql as $$ select versao from orcamentos where id = p $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;

-- O conselho: Gil (subsíndico, com acesso), Lúcia e Marcos (só nome e e-mail). Três titulares, dois votos decidem.
create temp table m as select
  (plataforma_incluir_membro(ana, ipe, gil, null, null, null, 'gil@exemplo.com', 'SUBSINDICO', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_gil,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Lúcia Prado', null, 'lucia@exemplo.com', 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_lucia,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Marcos Lima', null, 'marcos@exemplo.com', 'CONSELHEIRO_FISCAL', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_marcos
  from ids, c;

-- O prestador cadastrado (HidroPress) e a manutenção aberta à qual o orçamento se liga.
create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'HidroPress', 'Bombas', 'Marcos', '+5513998124455', 'marcos@hidropress.invalid', null,
                               'CHAMADO', null, null, null, null) ->> 'id')::uuid as hidro
  from ids, c;
create temp table cfg as select (select id from prioridades where condominio_id = ipe and modelo = 'ALTA') as alta from c;
create temp table mt as select
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba do poço parou', 'Casa de bombas', null, alta, v_ana, null, null, null, null,
                                   null, null, null) ->> 'id')::uuid as mt
  from ids, c, cfg, vs;

-- Os e-mails da fila: o código do link sai na hora de montar.
create temp table emails (para text, tipo text, finalidade text, titulo text, codigo text);
create function pg_temp.fila() returns void language sql as $$
  insert into emails select m ->> 'para', m ->> 'tipo', coalesce(m -> 'orcamento' ->> 'finalidade', m -> 'conselho' ->> 'finalidade'),
                            coalesce(m -> 'orcamento' ->> 'titulo', m -> 'conselho' ->> 'titulo'), m -> 'codigos' ->> 'abrir'
    from jsonb_array_elements(email_pegar_lote(100)) m where m ->> 'tipo' in ('ORCAMENTO', 'CONSELHO') $$;
create function pg_temp.codigo_de(p_para text) returns text language sql as $$
  select codigo from emails where para = p_para order by ctid desc limit 1 $$;

-- Os códigos dos links do WhatsApp (o fornecedor abre sem conta).
create temp table cod (quem text primary key, codigo text);
create function pg_temp.cod(p text) returns text language sql as $$ select codigo from cod where quem = p $$;
create function pg_temp.guardar(p text, p_codigo text) returns void language sql as $$
  insert into cod values (p, p_codigo) on conflict (quem) do update set codigo = excluded.codigo $$;

create function pg_temp.aviso(p_pessoa uuid, p_orcamento uuid, p_tipo text) returns jsonb language sql as $$
  select x from ids, c, jsonb_array_elements(plataforma_avisos(p_pessoa, ipe) -> 'itens') x
   where x ->> 'orcamentoId' = p_orcamento::text and x ->> 'tipo' = 'ORCAMENTO_' || p_tipo order by x ->> 'criadoEm' desc limit 1 $$;

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê (CF-03) e o que o pedido exige (quadro 471).

select throws_ok($$ select plataforma_orcamentos(edu, ipe, null) from ids, c $$, 'TC401', null, 'OC-01: quem só acompanha não vê os orçamentos');
select throws_ok($$ select plataforma_orcamentos(davi, ipe, null) from ids, c $$, 'TC401', null, 'OC-01: o síndico de outro condomínio não entra');
select throws_ok($$ select plataforma_criar_orcamento(edu, ipe, 'Troca da bomba', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', null, null, null,
                           '2026-11-02 18:00-03', 15, '[]', false) from ids, c $$, 'TC401', null, 'OC-01: quem só acompanha não pede orçamento');
select is((select plataforma_orcamentos(bruna, ipe, null) -> 'pode' from ids, c), '{"criar": true, "decidir": false}'::jsonb,
  'CF-03: quem atualiza pede, mas não decide');
select is((select plataforma_orcamentos(gil, ipe, null) -> 'pode' from ids, c), '{"criar": true, "decidir": true}'::jsonb, 'CF-03: quem aprova decide');
select is(pg_temp.motivo($$ select plataforma_criar_orcamento(bruna, ipe, 'Lâmpadas', 'Dez lâmpadas LED', 'Garagem', 'ITENS', null, null, null,
                                   '2026-11-02 18:00-03', 15, '[]', false) from ids, c $$), 'TIPO_ITENS_DEPOIS', 'OC-08: a lista de itens fica para a segunda rodada');
select is(pg_temp.campos($$ select plataforma_criar_orcamento(bruna, ipe, 'Tb', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', null, null, null,
                                   '2026-11-02 18:00-03', 15, '[]', false) from ids, c $$), '["titulo"]'::jsonb, 'OC-01: o pedido diz o que é');
select is(pg_temp.campos($$ select plataforma_criar_orcamento(bruna, ipe, 'Troca da bomba', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', null, null, null,
                                   '2026-10-26 09:30-03', 15, '[]', false) from ids, c $$), '["prazoPropostas"]'::jsonb, 'OC-03: o prazo vem de 1 hora a 60 dias');
select is(pg_temp.campos($$ select plataforma_criar_orcamento(bruna, ipe, 'Troca da bomba', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', null, null, null,
                                   '2026-11-02 18:00-03', 15, '[]', true) from ids, c $$), '["convites"]'::jsonb, 'OC-03: mandar pede pelo menos um convidado');
select is(pg_temp.campos($$ select plataforma_criar_orcamento(bruna, ipe, 'Troca da bomba', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', null, null, null,
                                   '2026-11-02 18:00-03', 15, '[{"nome": "Hidro Norte", "canal": "WHATSAPP"}]', true) from ids, c $$), '["convites"]'::jsonb,
  'OC-03: pelo WhatsApp, o convite precisa do celular');
select is(pg_temp.campos($$ select plataforma_criar_orcamento(bruna, ipe, 'Troca da bomba', 'Bomba de 2 cv', 'Casa de bombas', 'SERVICO', mt, null, null,
                                   '2026-11-02 18:00-03', 15, '[{"prestadorId": "00000000-0000-0000-0000-000000000001"}]', true) from ids, c, mt $$),
  '["convites"]'::jsonb, 'OC-03: o prestador do convite precisa estar cadastrado');
select is((select plataforma_orcamento_opcoes(bruna, ipe) -> 'prestadores' -> 0 ->> 'nome' from ids, c), 'HidroPress', 'OC-03: os prestadores cadastrados aparecem para convidar');
select is((select plataforma_orcamento_opcoes(bruna, ipe) -> 'quem' from ids, c), '{"nome": "Bruna", "cargo": "Zeladora", "condominio": "Residencial Ipê"}'::jsonb,
  'OC-03: a mensagem pronta sabe quem manda e por qual condomínio');
select is((select plataforma_orcamento_opcoes(bruna, ipe) -> 'conselho' from ids, c), '{"podePedir": true, "titulares": 3}'::jsonb, 'OC-05: o conselho tem quórum');

-- ---------------------------------------------------------------------------------------
-- O pedido (OC-03, quadros 471 e 475): três convidados, um cadastrado e dois pelo link.

create temp table o1r as select plataforma_criar_orcamento(bruna, ipe, 'Troca da bomba do poço', 'Bomba de 2 cv com instalação e retirada da antiga',
  'Casa de bombas', 'SERVICO', mt, null, 800000, '2026-11-02 18:00-03', 15,
  ('[{"prestadorId": "' || hidro || '"}, {"nome": "Bombas Silva", "email": "Silva@Exemplo.com", "canal": "EMAIL"},
    {"nome": "Hidro Norte", "celular": "(61) 99999-0002", "canal": "WHATSAPP"}]')::jsonb, true) as r from ids, c, mt, pr;
create temp table o1 as select (r ->> 'id')::uuid as o1 from o1r;
select is((select r ->> 'estado' from o1r), 'PEDINDO', 'OC-03: mandar os convites deixa o orçamento pedindo propostas');
select is((select jsonb_array_length(r -> 'links') from o1r), 3, 'OC-03: um link por convidado');
select is((select r -> 'links' -> 0 ->> 'envio' || ' ' || (r -> 'links' -> 0 ->> 'letra') || ' ' || (r -> 'links' -> 0 ->> 'nome') from o1r), 'COPIAR A HidroPress',
  'OC-03: pelo WhatsApp, sem modelo aprovado, o link volta para copiar');
select ok((select length(r -> 'links' -> 0 ->> 'codigo') >= 14 from o1r), 'OC-03: o código do link vem junto');
select is((select r -> 'links' -> 1 ->> 'envio' || ' ' || (r -> 'links' -> 1 ? 'codigo') from o1r), 'EMAIL false', 'OC-03: pelo e-mail, o código nasce na fila');
select is((select r -> 'links' -> 2 -> 'mensagem' from o1r),
  '{"quem": "Bruna", "cargo": "Zeladora", "condominio": "Residencial Ipê", "titulo": "Troca da bomba do poço", "prazo": "02/11, 18h"}'::jsonb,
  'OC-03: as peças da mensagem pronta');
select pg_temp.guardar('A', r -> 'links' -> 0 ->> 'codigo') from o1r;
select pg_temp.guardar('C', r -> 'links' -> 2 ->> 'codigo') from o1r;
select is((select count(*)::integer from codigos_sem_conta where tipo = 'ORCAMENTO' and revogado_em is null), 2, 'OC-03: só o hash fica no banco');
select is((select count(*)::integer from codigos_sem_conta k, cod where k.hash = hash_codigo(cod.codigo)), 2, 'OC-03: e é o hash dos códigos dados');
select pg_temp.fila();
select is((select tipo || ' ' || finalidade || ' ' || titulo from emails where para = 'silva@exemplo.com'), 'ORCAMENTO CONVITE Troca da bomba do poço',
  'OC-03: o convite pelo e-mail sai da fila com o código');
select is((select string_agg(x ->> 'letra' || ':' || (x ->> 'estado'), ' ' order by x ->> 'letra') from ids, c, o1, jsonb_array_elements(plataforma_orcamento(bruna, ipe, o1) -> 'convites') x),
  'A:CONVIDADO B:CONVIDADO C:CONVIDADO', 'OC-03: os convites pela letra');
select is((select x ->> 'contatoMascarado' from ids, c, o1, jsonb_array_elements(plataforma_orcamento(bruna, ipe, o1) -> 'convites') x where x ->> 'letra' = 'B'),
  email_mascarado('silva@exemplo.com'), 'OC-03: o contato aparece mascarado na ficha');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' -> 'origem' ->> 'tipo' from ids, c, o1), 'MANUTENCAO', 'OC-01: o orçamento fica ligado à manutenção');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'historico' -> -1 ->> 'acao' from ids, c, o1), 'orcamento.criado', 'OC-01: a memória começa no pedido');
select is((select plataforma_orcamentos(gil, ipe, null) -> 'contagens' ->> 'pedindo' from ids, c), '1', 'OC-01: quem aprova vê o pedido na lista');
select is((select plataforma_painel(bruna, ipe) -> 'orcamentos' from ids, c), '{"emAndamento": 1, "pedeAtencao": 0, "paraDecidir": 0}'::jsonb,
  'OC-01: o Início resume os orçamentos');

-- ---------------------------------------------------------------------------------------
-- O link do fornecedor (OC-03, quadros 476 a 478): abrir, recusar, mandar a proposta em versões.

select throws_ok($$ select publico_orcamento('CODIGO-QUE-NAO-EXISTE-NEM-NUNCA-EXISTIU') $$, 'TC404', null, 'OC-03: código errado não abre nada');
select is((select publico_orcamento(pg_temp.cod('A')) ->> 'estado'), 'VER', 'OC-03: o link abre o pedido sem conta');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pedido' -> 'quem'), '{"nome": "Bruna", "cargo": "Zeladora"}'::jsonb, 'OC-03: o fornecedor vê quem pede');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pedido' ->> 'prazoTexto'), '02/11, 18h', 'OC-03: e até quando');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pode'), '{"recusar": true, "mandarProposta": true, "confirmarPreco": false, "aceitar": false}'::jsonb,
  'OC-03: pode recusar ou mandar a proposta');
select is((select publico_orcamento(pg_temp.cod('A')) ? 'convites'), false, 'OC-03: o fornecedor não vê os outros convidados');
select is((select aberturas from convites_orcamento where nome = 'HidroPress'), 5, 'OC-03: cada abertura conta');
select is((select publico_recusar_orcamento(pg_temp.cod('C'), 'Sem agenda este mês') ->> 'estado'), 'RECUSOU', 'OC-03: o fornecedor recusa pelo link');
select is(pg_temp.motivo($$ select publico_recusar_orcamento(pg_temp.cod('C'), 'De novo') $$), 'JA_RESPONDEU', 'OC-03: recusa uma vez só');
select is((select pg_temp.aviso(bruna, o1, 'RECUSOU') ->> 'fornecedor' from ids, o1), 'Hidro Norte', 'OC-03: quem cuida é avisado da recusa');
select is(pg_temp.campos($$ select publico_enviar_proposta(pg_temp.cod('A'), 0, true, null, null, '5 dias', '1 ano', '2026-11-05', null, 'Bomba e instalação', null, null) $$),
  '["valor"]'::jsonb, 'OC-04: a proposta tem valor');
select is(pg_temp.campos($$ select publico_enviar_proposta(pg_temp.cod('A'), 780000, true, null, null, '', '1 ano', '2026-11-05', null, 'Bomba e instalação', null, null) $$),
  '["prazoExecucao"]'::jsonb, 'OC-04: e o prazo para fazer');
create temp table pa1 as select publico_enviar_proposta(pg_temp.cod('A'), 780000, true, null, 'Bomba Schneider 2 cv', '5 dias úteis', '1 ano', '2026-11-05',
  'À vista', 'Bomba, instalação e retirada da antiga', 'Elétrica nova', null) as r;
select is((select (r ->> 'estado') || ' ' || (r ->> 'numero') from pa1), 'ENVIADA 1', 'OC-04: a primeira versão entra');
select is((select r ->> 'avisoValidade' from pa1), 'O condomínio pediu validade de pelo menos 15 dias; a sua vale 10 dias',
  'OC-04: validade menor que a pedida avisa, não barra');
select is((select pg_temp.aviso(bruna, o1, 'PROPOSTA_RECEBIDA') ->> 'fornecedor' from ids, o1), 'HidroPress', 'OC-04: quem cuida é avisado da proposta');
-- O PDF da proposta pelo link e a segunda versão.
create temp table pdfa as select publico_iniciar_pdf_orcamento(pg_temp.cod('A'), 'Proposta HidroPress.pdf', 'application/pdf', 3000) as r;
select ok((select (r ->> 'caminho') = ipe || '/orcamentos/' || o1 || '/' || (r ->> 'arquivoId') from pdfa, c, o1), 'OC-04: o caminho é do condomínio e do orçamento');
select is(pg_temp.motivo($$ select publico_iniciar_pdf_orcamento(pg_temp.cod('A'), 'foto.png', 'image/png', 3000) $$), 'PROPOSTA_SO_PDF', 'OC-04: a proposta vai em PDF');
select is((select publico_verificar_pdf_orcamento(pg_temp.cod('A'), (r ->> 'arquivoId')::uuid, true, 2900, null) ->> 'situacao' from pdfa), 'LIBERADO',
  'OC-04: o PDF verificado fica liberado');
create temp table pa2 as select publico_enviar_proposta(pg_temp.cod('A'), 760000, true, null, 'Bomba Schneider 2 cv', '5 dias úteis', '1 ano', '2026-11-20',
  'À vista', 'Bomba, instalação e retirada da antiga', 'Elétrica nova', (select (r ->> 'arquivoId')::uuid from pdfa)) as r;
select is((select (r ->> 'numero') || ' ' || (r ->> 'versoes') || ' ' || (r -> 'proposta' ->> 'total') from pa2), '2 2 760000', 'OC-04: a segunda versão passa a valer');
select is((select count(*)::integer || ' ' || count(*) filter (where em_uso)::integer from propostas_orcamento where valor in (780000, 760000)), '2 1',
  'OC-04: a versão anterior fica guardada, só a última em uso');
select is((select publico_arquivo_orcamento(pg_temp.cod('A'), (r ->> 'arquivoId')::uuid) ->> 'nome' from pdfa), 'Proposta HidroPress.pdf', 'OC-04: o PDF abre pelo link');
select throws_ok($$ select publico_arquivo_orcamento(pg_temp.cod('C'), (r ->> 'arquivoId')::uuid) from pdfa $$, 'TC404', null,
  'OC-03: outro convidado não abre o PDF de ninguém');
-- O convite pelo e-mail: a proposta B.
select is((select publico_orcamento(pg_temp.codigo_de('silva@exemplo.com')) ->> 'estado'), 'VER', 'OC-03: o link do e-mail abre');
select publico_enviar_proposta(pg_temp.codigo_de('silva@exemplo.com'), 800000, false, 20000, null, '7 dias', '6 meses', '2026-11-30', '30 dias',
  'Bomba e instalação', 'Retirada da antiga', null);
select is((select total::bigint from propostas_orcamento p join convites_orcamento k on k.id = p.convite_id where k.nome = 'Bombas Silva'), 820000::bigint,
  'OC-04: o total soma o frete fora');
-- Mandar o link de novo: o anterior para.
create temp table rea as select plataforma_reenviar_convite(bruna, ipe, o1, k.id) -> 'link' as l from ids, c, o1, convites_orcamento k where k.nome = 'HidroPress';
select is((select l ->> 'envio' from rea), 'COPIAR', 'OC-03: mandar de novo pelo WhatsApp dá outro código');
select is((select publico_orcamento(pg_temp.cod('A')) ->> 'estado' || ' ' || (publico_orcamento(pg_temp.cod('A')) ->> 'motivo')), 'NAO_VALE LINK_TROCADO',
  'OC-03: o código anterior para');
select pg_temp.guardar('A', l ->> 'codigo') from rea;
select is((select publico_orcamento(pg_temp.cod('A')) ->> 'estado'), 'ENVIADA', 'OC-03: o novo abre e mostra a proposta enviada');
select plataforma_reenviar_convite(bruna, ipe, o1, k.id) from ids, c, o1, convites_orcamento k where k.nome = 'Bombas Silva';
select pg_temp.fila();
select is((select count(*)::integer from emails where para = 'silva@exemplo.com'), 2, 'OC-03: pelo e-mail, outro e-mail com outro código');
select is((select publico_orcamento(codigo) ->> 'motivo' from emails where para = 'silva@exemplo.com' order by ctid limit 1), 'LINK_TROCADO',
  'OC-03: o código do primeiro e-mail parou');
select throws_ok($$ select plataforma_reenviar_convite(edu, ipe, o1, k.id) from ids, c, o1, convites_orcamento k where k.nome = 'HidroPress' $$, 'TC401', null,
  'CF-03: quem só acompanha não manda link');
-- Alterar o pedido avisa o fornecedor pelo link.
select throws_ok($$ select plataforma_alterar_orcamento(bruna, ipe, o1, 99, 'Troca da bomba do poço', 'Bomba de 2 cv com instalação, retirada da antiga e teste',
                           'Casa de bombas', 800000) from ids, c, o1 $$, 'TC409', null, 'OC-01: versão velha não altera');
select plataforma_alterar_orcamento(bruna, ipe, o1, pg_temp.vo(o1), 'Troca da bomba do poço', 'Bomba de 2 cv com instalação, retirada da antiga e teste',
  'Casa de bombas', 800000) from ids, c, o1;
select ok((select publico_orcamento(pg_temp.cod('A')) -> 'pedido' ? 'alteradoEm'), 'OC-03: o fornecedor vê que o pedido mudou');
-- Um quarto convidado, que manda proposta e depois é revogado: a proposta fica guardada, mas não conta.
create temp table cd as select plataforma_convidar(bruna, ipe, o1, '[{"nome": "Poço Fácil", "celular": "61999990004", "canal": "WHATSAPP"}]') -> 'links' -> 0 as l
  from ids, c, o1;
select is((select l ->> 'letra' from cd), 'D', 'OC-03: convidar depois segue a letra');
select pg_temp.guardar('D', l ->> 'codigo') from cd;
select publico_enviar_proposta(pg_temp.cod('D'), 700000, true, null, null, '3 dias', null, '2026-11-30', null, 'Só a bomba', null, null);
select is(pg_temp.campos($$ select plataforma_revogar_convite(bruna, ipe, o1, k.id, '') from ids, c, o1, convites_orcamento k where k.nome = 'Poço Fácil' $$),
  '["motivo"]'::jsonb, 'OC-03: revogar pede o motivo');
select plataforma_revogar_convite(bruna, ipe, o1, k.id, 'Mandamos para o número errado') from ids, c, o1, convites_orcamento k where k.nome = 'Poço Fácil';
select is((select publico_orcamento(pg_temp.cod('D')) ->> 'motivo'), 'REVOGADO', 'OC-03: revogado, o link para na hora');
select is(pg_temp.motivo($$ select publico_enviar_proposta(pg_temp.cod('D'), 650000, true, null, null, '3 dias', null, '2026-11-30', null, 'Só a bomba', null, null) $$),
  'REVOGADO', 'OC-03: e não recebe mais proposta');
select is((select count(*)::integer from propostas_orcamento where valor = 700000), 1, 'OC-03: a proposta já recebida fica guardada');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' ->> 'recebidas' from ids, c, o1), '2', 'OC-03: mas não conta na comparação');

-- ---------------------------------------------------------------------------------------
-- O prazo fecha na leitura (quadro 473), estende e fecha antes.

select pg_temp.em('2026-11-02 18:01:00-03');
select is((select x ->> 'estado' || ' ' || (x ->> 'situacao') || ' ' || (x -> 'pedeAtencao')::text from ids, c, jsonb_array_elements(plataforma_orcamentos(bruna, ipe, null) -> 'orcamentos') x),
  'COMPARANDO Pronto para comparar ["PRAZO_FECHOU"]', 'OC-02: passado o prazo, a lista já mostra pronto para comparar');
select is((select pg_temp.aviso(bruna, o1, 'PRAZO_FECHOU') ->> 'titulo' from ids, o1), 'Troca da bomba do poço', 'OC-02: quem cuida é avisado');
select is((select plataforma_painel(bruna, ipe) -> 'orcamentos' from ids, c), '{"emAndamento": 1, "pedeAtencao": 1, "paraDecidir": 0}'::jsonb,
  'OC-02: o Início pede atenção; só quem decide vê para decidir');
select is((select plataforma_painel(gil, ipe) -> 'orcamentos' ->> 'paraDecidir' from ids, c), '1', 'OC-02: para Gil, há um para decidir');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' -> 'pedeAtencao' from ids, c, o1), '[]'::jsonb, 'OC-02: abrir a ficha é olhar: deixa de pedir atenção');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pode' ->> 'mandarProposta'), 'false', 'OC-03: fechado o prazo, o link não recebe mais');
select is(pg_temp.motivo($$ select publico_enviar_proposta(pg_temp.cod('A'), 750000, true, null, null, '5 dias', null, '2026-11-20', null, 'Bomba', null, null) $$),
  'PRAZO_PROPOSTAS_ACABOU', 'OC-03: nem pela função');
select is((select publico_orcamento(pg_temp.cod('C')) ->> 'estado'), 'RECUSOU', 'OC-03: quem recusou vê a recusa');
select is(pg_temp.campos($$ select plataforma_estender_prazo(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-01 18:00-03') from ids, c, o1 $$), '["prazoPropostas"]'::jsonb,
  'OC-03: estender é para depois');
select is((select plataforma_estender_prazo(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-04 18:00-03') ->> 'estado' from ids, c, o1), 'PEDINDO', 'OC-03: estender reabre o prazo');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pode' ->> 'mandarProposta'), 'true', 'OC-03: e o fornecedor pode mandar outra versão');
select is((select plataforma_fechar_propostas(bruna, ipe, o1, pg_temp.vo(o1)) ->> 'estado' from ids, c, o1), 'COMPARANDO', 'OC-02: fechar antes encerra na hora');
select is(pg_temp.motivo($$ select plataforma_fechar_propostas(bruna, ipe, o1, pg_temp.vo(o1)) from ids, c, o1 $$), 'ORCAMENTO_FECHADO', 'OC-02: e só uma vez');

-- ---------------------------------------------------------------------------------------
-- Comparar (OC-02, quadro 479): escopo e não só preço.

create temp table cmp as select plataforma_comparacao(gil, ipe, o1) as r from ids, c, o1;
select is((select string_agg(x ->> 'letra' || ':' || (x ->> 'total') || ':' || (x ->> 'menorTotal'), ' ' order by x ->> 'letra') from cmp, jsonb_array_elements(r -> 'propostas') x),
  'A:760000:true B:820000:false', 'OC-02: as propostas lado a lado, a de menor total marcada');
select is((select x ->> 'origem' || ' ' || (x ->> 'versoes') || ' ' || jsonb_array_length(x -> 'anteriores') from cmp, jsonb_array_elements(r -> 'propostas') x where x ->> 'letra' = 'A'),
  'PRESTADOR 2 1', 'OC-04: a versão anterior aparece como histórico');
select is((select x -> 'anteriores' -> 0 ->> 'total' from cmp, jsonb_array_elements(r -> 'propostas') x where x ->> 'letra' = 'A'), '780000', 'OC-04: com o total de então');
select is((select r -> 'minimo' from cmp), '{"pedido": 1, "recebidas": 2, "atendido": true, "abaixoMinimo": "MOTIVO"}'::jsonb, 'OC-05: sem regra, o mínimo é 1');
select is((select r -> 'pode' from cmp), '{"decidir": true, "pedirConfirmacao": true}'::jsonb, 'OC-06: Gil pode decidir');
select is((select plataforma_comparacao(bruna, ipe, o1) -> 'pode' ->> 'decidir' from ids, c, o1), 'false', 'OC-06: Bruna compara, mas não decide');
select throws_ok($$ select plataforma_comparacao(edu, ipe, o1) from ids, c, o1 $$, 'TC401', null, 'CF-03: quem só acompanha não compara');

-- ---------------------------------------------------------------------------------------
-- As regras do condomínio (OC-05, quadro 484).

select throws_ok($$ select plataforma_salvar_regras_orcamento(bruna, ipe, pg_temp.vcfg(), true, '[{"minimo": 1, "quemAprova": "SINDICO"}]', 'MOTIVO', 7, 15, 30, null)
                    from ids, c $$, 'TC401', null, 'OC-05: só quem configura muda a regra');
select is(pg_temp.campos($$ select plataforma_salvar_regras_orcamento(ana, ipe, pg_temp.vcfg(), true, '[{"ate": 500000, "minimo": 1, "quemAprova": "SINDICO"},
                                   {"ate": 400000, "minimo": 2, "quemAprova": "SINDICO"}]', 'MOTIVO', 7, 15, 30, null) from ids, c $$), '["faixas"]'::jsonb,
  'OC-05: cada faixa começa onde a anterior termina');
select is(pg_temp.campos($$ select plataforma_salvar_regras_orcamento(ana, ipe, pg_temp.vcfg(), true, '[{"minimo": 1, "quemAprova": "SINDICO"},
                                   {"minimo": 2, "quemAprova": "SINDICO"}]', 'MOTIVO', 7, 15, 30, null) from ids, c $$), '["faixas"]'::jsonb,
  'OC-05: só a última faixa fica sem teto');
select is(pg_temp.campos($$ select plataforma_salvar_regras_orcamento(ana, ipe, pg_temp.vcfg(), true, '[]', 'MOTIVO', 7, 15, 30, null) from ids, c $$), '["faixas"]'::jsonb,
  'OC-05: ligada, a regra precisa de faixa');
select lives_ok($$ select plataforma_salvar_regras_orcamento(ana, ipe, pg_temp.vcfg(), true, '[{"ate": 500000, "minimo": 1, "quemAprova": "SINDICO"},
                           {"minimo": 3, "quemAprova": "CONSELHO"}]', 'BLOQUEIA', 7, 15, 30, 500000) from ids, c $$, 'OC-05: duas faixas e a alçada do conselho');
select is((select plataforma_regras_orcamento(bruna, ipe) - 'versao' - 'pode' from ids, c),
  '{"ligada": true, "faixas": [{"ate": 500000, "minimo": 1, "quemAprova": "SINDICO"}, {"ate": null, "minimo": 3, "quemAprova": "CONSELHO"}],
    "abaixoMinimo": "BLOQUEIA", "prazoDias": 7, "validadeDias": 15, "linkDias": 30, "alcadaConselho": 500000}'::jsonb, 'OC-05: a regra como ficou');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' -> 'regra' from ids, c, o1),
  '{"ligada": true, "faixa": {"minimo": 3, "quemAprova": "CONSELHO"}, "anterior": 500000, "minimo": 3, "recebidas": 2, "minimoAtendido": false,
    "abaixoMinimo": "BLOQUEIA", "alcadaConselho": 500000, "passaAlcada": true}'::jsonb, 'OC-05: o orçamento de R$ 8.000 cai na faixa do conselho');

-- ---------------------------------------------------------------------------------------
-- Decidir (OC-06, quadro 481): o motivo, a faixa, a validade e quem aprova.

create temp table pp as select
  (select p.id from propostas_orcamento p join convites_orcamento k on k.id = p.convite_id where k.nome = 'HidroPress' and p.em_uso) as pa,
  (select p.id from propostas_orcamento p join convites_orcamento k on k.id = p.convite_id where k.nome = 'Bombas Silva' and p.em_uso) as pb;
select throws_ok($$ select plataforma_escolher_proposta(bruna, ipe, o1, pg_temp.vo(o1), pa, null, 'CONSELHO') from ids, c, o1, pp $$, 'TC401', null,
  'OC-06: quem atualiza não decide');
select is(pg_temp.motivo($$ select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Melhor garantia', 'CONSELHO') from ids, c, o1, pp $$), 'ABAIXO_DO_MINIMO',
  'OC-05: com a regra em bloquear, abaixo do mínimo não decide');
select plataforma_salvar_regras_orcamento(ana, ipe, pg_temp.vcfg(), true, '[{"ate": 500000, "minimo": 1, "quemAprova": "SINDICO"}, {"minimo": 3, "quemAprova": "CONSELHO"}]',
  'MOTIVO', 7, 15, 30, 500000) from ids, c;
select is(pg_temp.campos($$ select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, null, 'CONSELHO') from ids, c, o1, pp $$), '["motivo"]'::jsonb,
  'OC-06: abaixo do mínimo, o motivo é obrigatório');
select is(pg_temp.campos($$ select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Melhor garantia', 'PESSOA') from ids, c, o1, pp $$), '["quemAprova"]'::jsonb,
  'OC-05: a faixa manda ao conselho');
select is(pg_temp.campos($$ select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pb, null, 'CONSELHO') from ids, c, o1, pp $$), '["motivo"]'::jsonb,
  'OC-06: fora da de menor total, o motivo é obrigatório');
-- A proposta vence: só se escolhe depois que o fornecedor confirma o preço.
select pg_temp.em('2026-11-21 10:00:00-03');
select is((select x ->> 'vencidas' || ' ' || (x -> 'pedeAtencao')::text from ids, c, jsonb_array_elements(plataforma_orcamentos(bruna, ipe, null) -> 'orcamentos') x),
  '1 ["PROPOSTA_VENCIDA"]', 'OC-04: a proposta vencida pede atenção');
select is(pg_temp.motivo($$ select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Melhor garantia', 'CONSELHO') from ids, c, o1, pp $$), 'PROPOSTA_ORCAMENTO_VENCIDA',
  'OC-04: vencida, não se escolhe');
select is(pg_temp.motivo($$ select plataforma_pedir_confirmacao_preco(bruna, ipe, o1, k.id) from ids, c, o1, convites_orcamento k where k.nome = 'Bombas Silva' $$), 'PROPOSTA_VALE',
  'OC-04: a que ainda vale não precisa confirmar');
create temp table conf as select plataforma_pedir_confirmacao_preco(bruna, ipe, o1, k.id) -> 'link' as l from ids, c, o1, convites_orcamento k where k.nome = 'HidroPress';
select pg_temp.guardar('A', l ->> 'codigo') from conf;
select is((select publico_orcamento(pg_temp.cod('A')) ->> 'estado'), 'CONFIRMAR_PRECO', 'OC-04: o link pede a confirmação do preço');
select is(pg_temp.campos($$ select publico_confirmar_preco(pg_temp.cod('A'), '2026-11-01') $$), '["validaAte"]'::jsonb, 'OC-04: a validade nova é de hoje em diante');
select is((select publico_confirmar_preco(pg_temp.cod('A'), '2026-12-15') ->> 'estado'), 'ENVIADA', 'OC-04: confirmado, a proposta volta a valer');
select is((select pg_temp.aviso(bruna, o1, 'PRECO_CONFIRMADO') ->> 'fornecedor' from ids, o1), 'HidroPress', 'OC-04: quem cuida é avisado');
-- A escolha vai ao conselho como despesa para aprovar (R5).
create temp table esc1 as select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Melhor garantia e já conhece o poço', 'CONSELHO') as r from ids, c, o1, pp;
select is((select r ->> 'estado' || ' ' || (r ->> 'passaAlcada') || ' ' || (r ? 'despesaId') from esc1), 'ESCOLHIDA true true', 'OC-06: escolhida, acima da alçada, com a despesa aberta');
select is((select d.estado || ' ' || d.valor || ' ' || d.descricao || ' ' || (d.prestador_id = hidro)::text from despesas_aprovacao d, o1, pr where d.orcamento_id = o1),
  'AGUARDANDO 760000 Troca da bomba do poço true', 'OC-06: a despesa leva o valor, o título e o prestador');
select is((select count(*)::integer from arquivos_aprovacao a join despesas_aprovacao d on d.id = a.despesa_id, o1 where d.orcamento_id = o1), 1,
  'OC-06: o PDF da proposta vai junto para quem aprova');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' ->> 'situacao' from ids, c, o1), 'Esperando o conselho', 'OC-06: a ficha diz o que falta');
select is((select publico_orcamento(pg_temp.codigo_de('silva@exemplo.com')) ->> 'estado'), 'NAO_ESCOLHIDA', 'OC-03: quem não foi escolhido fica sabendo');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'escolha' ->> 'esperaAprovacao'), 'true', 'OC-03: o escolhido vê que espera aprovação');
select is((select publico_orcamento(pg_temp.cod('A')) -> 'pode' ->> 'aceitar'), 'true', 'OC-03: e já pode aceitar');
select pg_temp.em('2026-11-21 10:10:00-03');
-- Desfazer a escolha retira a despesa.
select is((select plataforma_desfazer_escolha(gil, ipe, o1, pg_temp.vo(o1)) ->> 'estado' from ids, c, o1), 'COMPARANDO', 'OC-06: a escolha se desfaz antes da resposta');
select is((select string_agg(estado, ' ' order by pedida_em) from despesas_aprovacao, o1 where orcamento_id = o1), 'RETIRADA', 'OC-06: e a despesa é retirada');
select is((select publico_orcamento(pg_temp.codigo_de('silva@exemplo.com')) ->> 'estado'), 'ENVIADA', 'OC-03: o outro volta a estar na disputa');
select pg_temp.em('2026-11-21 10:20:00-03');
-- O conselho recusa: o orçamento volta a comparar, com a justificativa à vista.
select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Melhor garantia e já conhece o poço', 'CONSELHO') from ids, c, o1, pp;
select pg_temp.fila();
select is((select count(*)::integer from emails where tipo = 'CONSELHO' and para = 'lucia@exemplo.com'), 1,
  'OC-06: o pedido ao conselho manda o link aos membros; o da escolha desfeita foi cancelado na fila');
select is((select count(*)::integer from envios_email where tipo = 'CONSELHO' and para = 'lucia@exemplo.com' and estado = 'CANCELADO'), 1, 'OC-06: o e-mail da despesa retirada não sai');
select pg_temp.em('2026-11-21 10:30:00-03');
select plataforma_votar_despesa(gil, ipe, d.id, 'RECUSAR', 'O poço precisa de laudo antes') from ids, c, o1, despesas_aprovacao d where d.orcamento_id = o1 and d.estado = 'AGUARDANDO';
select is((select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), 'RECUSAR', 'Concordo com o laudo') ->> 'estado'), 'FECHADA', 'OC-06: dois votos recusam');
select is((select plataforma_orcamento(gil, ipe, o1) -> 'orcamento' ->> 'estado' || ' · ' || (plataforma_orcamento(gil, ipe, o1) -> 'orcamento' -> 'recusa' ->> 'estado') from ids, c, o1),
  'COMPARANDO · RECUSADA', 'OC-06: recusada, volta a comparar com a recusa à vista');
select is((select pg_temp.aviso(bruna, o1, 'APROVADA') ->> 'resultado' from ids, o1), 'RECUSADA', 'OC-06: quem cuida sabe da resposta');
select pg_temp.em('2026-11-21 10:40:00-03');
-- O conselho aprova: aprovada, espera o aceite.
select plataforma_escolher_proposta(gil, ipe, o1, pg_temp.vo(o1), pa, 'Laudo feito; melhor garantia', 'CONSELHO') from ids, c, o1, pp;
select pg_temp.fila();
select pg_temp.em('2026-11-21 10:50:00-03');
select plataforma_votar_despesa(gil, ipe, d.id, 'APROVAR', null) from ids, c, o1, despesas_aprovacao d where d.orcamento_id = o1 and d.estado = 'AGUARDANDO';
select is((select publico_votar_conselho(pg_temp.codigo_de('lucia@exemplo.com'), 'APROVAR', null) ->> 'estado'), 'FECHADA', 'OC-06: dois votos aprovam');
select is((select plataforma_orcamento(gil, ipe, o1) -> 'orcamento' ->> 'situacao' from ids, c, o1), 'Esperando o aceite do fornecedor', 'OC-06: aprovada, falta o aceite');
select is((select pg_temp.aviso(bruna, o1, 'APROVADA') ->> 'resultado' from ids, o1), 'APROVADA', 'OC-06: e quem cuida sabe');
select is(pg_temp.motivo($$ select plataforma_desfazer_escolha(gil, ipe, o1, pg_temp.vo(o1)) from ids, c, o1 $$), 'JA_RESPONDIDA', 'OC-06: aprovada, a escolha não se desfaz');
select is(pg_temp.motivo($$ select plataforma_revogar_convite(bruna, ipe, o1, k.id, 'Mudou de ideia') from ids, c, o1, convites_orcamento k where k.nome = 'HidroPress' $$),
  'CONVITE_ESCOLHIDO', 'OC-03: o convite escolhido não se revoga');
select is(pg_temp.motivo($$ select plataforma_registrar_compra(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-21', 760000) from ids, c, o1 $$), 'NAO_ESTA_COMPRANDO',
  'OC-01: aprovar não é comprar: a compra só depois do aceite');
select pg_temp.em('2026-11-21 11:00:00-03');
-- O aceite pelo link (quadro 478).
select is(pg_temp.motivo($$ select publico_aceitar_orcamento(pg_temp.codigo_de('silva@exemplo.com'), 'Silva') $$), 'NAO_ESCOLHIDO', 'OC-03: só o escolhido aceita');
select is((select publico_aceitar_orcamento(pg_temp.cod('A'), 'Marcos, da HidroPress') ->> 'estado'), 'ACEITA', 'OC-03: o fornecedor aceita pelo link');
select is(pg_temp.motivo($$ select publico_aceitar_orcamento(pg_temp.cod('A'), 'Marcos') $$), 'JA_ACEITA', 'OC-03: aceita uma vez só');
select is((select estado from orcamentos, o1 where id = o1), 'COMPRANDO', 'OC-01: aprovada e aceita, está comprando');
select is((select count(*)::integer from prestadores where condominio_id = (select ipe from c)), 1, 'OC-10: o prestador cadastrado não se duplica');
select is((select pg_temp.aviso(bruna, o1, 'ACEITE') ->> 'fornecedor' from ids, o1), 'HidroPress', 'OC-03: quem cuida é avisado do aceite');

-- ---------------------------------------------------------------------------------------
-- Compra e entrega (OC-01, quadro 482), com a nota fiscal.

select is(pg_temp.motivo($$ select plataforma_registrar_entrega(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-21', false, null) from ids, c, o1 $$), 'SEM_COMPRA',
  'OC-01: a entrega vem depois da compra');
select is(pg_temp.campos($$ select plataforma_registrar_compra(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-22', 750000) from ids, c, o1 $$), '["data"]'::jsonb,
  'OC-01: a compra não é no futuro');
select pg_temp.em('2026-11-21 11:10:00-03');
select lives_ok($$ select plataforma_registrar_compra(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-21', 750000) from ids, c, o1 $$, 'OC-01: a compra fica registrada');
select is(pg_temp.motivo($$ select plataforma_registrar_compra(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-21', 750000) from ids, c, o1 $$), 'JA_COMPRADA', 'OC-01: uma vez só');
create temp table nf as select plataforma_iniciar_anexo_orcamento(bruna, ipe, o1, 'NOTA_FISCAL', 'NF 1234.pdf', 'application/pdf', 5000) as r from ids, c, o1;
select plataforma_verificar_anexo_orcamento(bruna, ipe, (r ->> 'arquivoId')::uuid, true, 4900, null) from ids, c, nf;
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' -> 'compra' from ids, c, o1),
  (select jsonb_build_object('compradaEm', '2026-11-21', 'valorFechado', 750000, 'notaFiscal', jsonb_build_object('id', r ->> 'arquivoId', 'nome', 'NF 1234.pdf')) from nf),
  'OC-01: a ficha mostra a compra e a nota fiscal');
select throws_ok($$ select plataforma_abrir_anexo_orcamento(edu, ipe, (r ->> 'arquivoId')::uuid) from ids, c, nf $$, 'TC401', null, 'CF-03: quem só acompanha não abre a nota');
select is((select plataforma_abrir_anexo_orcamento(gil, ipe, (r ->> 'arquivoId')::uuid) ->> 'nome' from ids, c, nf), 'NF 1234.pdf', 'OC-01: quem aprova abre a nota');
select pg_temp.em('2026-11-21 11:20:00-03');
select is((select plataforma_registrar_entrega(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-21', true, 'Veio a bomba; a instalação é amanhã') ->> 'estado' from ids, c, o1),
  'COMPRANDO', 'OC-01: entrega parcial continua comprando');
select pg_temp.em('2026-11-22 17:00:00-03');
select is((select plataforma_registrar_entrega(bruna, ipe, o1, pg_temp.vo(o1), '2026-11-22', false, 'Instalada e testada') ->> 'estado' from ids, c, o1), 'ENTREGUE',
  'OC-01: entregue, encerra');
select is((select plataforma_orcamento(bruna, ipe, o1) -> 'orcamento' -> 'entrega' from ids, c, o1),
  '{"entregueEm": "2026-11-22", "parcial": true, "observacao": "Instalada e testada"}'::jsonb, 'OC-01: a entrega como ficou');
select is(pg_temp.motivo($$ select plataforma_cancelar_orcamento(bruna, ipe, o1, pg_temp.vo(o1), 'Tarde demais') from ids, c, o1 $$), 'ORCAMENTO_FECHADO',
  'OC-01: entregue não se cancela');
select is((select plataforma_orcamentos(bruna, ipe, 'ENCERRADOS') -> 'contagens' from ids, c),
  '{"emAndamento": 0, "decididos": 1, "encerrados": 1, "cancelados": 0, "pedindo": 0, "comparar": 0, "decidir": 0, "comprando": 0}'::jsonb, 'OC-07: as contagens da lista');
select is((select publico_orcamento(pg_temp.cod('A')) ->> 'estado'), 'ACEITA', 'OC-03: o link do escolhido mostra o aceite');
select is((select string_agg(x ->> 'acao', ' ' order by x ->> 'em') from ids, c, o1, jsonb_array_elements(plataforma_orcamento(bruna, ipe, o1) -> 'historico') x
            where x ->> 'acao' in ('orcamento.escolhida', 'orcamento.escolha_desfeita', 'orcamento.recusada', 'orcamento.aprovada', 'orcamento.aceite',
                                   'orcamento.compra', 'orcamento.entrega')),
  'orcamento.escolhida orcamento.escolha_desfeita orcamento.escolhida orcamento.recusada orcamento.escolhida orcamento.aprovada orcamento.aceite orcamento.compra ' ||
  'orcamento.entrega orcamento.entrega',
  'OC-07: a memória guarda cada passo, inclusive a recusa');
select is((select count(*)::integer from historico h where h.entidade = 'orcamentos' and (h.dados ?| array['nome', 'email', 'telefone', 'celular'])), 0,
  'LGPD: a memória guarda ids, não contatos');

-- ---------------------------------------------------------------------------------------
-- O segundo orçamento: rascunho, decisão da síndica, aceite fora do link, o prestador que nasce (OC-10) e o cancelamento.

create temp table o2r as select plataforma_criar_orcamento(ana, ipe, 'Troca do quadro elétrico da piscina', 'Quadro novo com disjuntores DR', 'Casa de máquinas',
  'SERVICO', null, null, 100000, '2026-11-30 18:00-03', 15, '[{"nome": "Elétrica Souza", "email": "souza@exemplo.com", "canal": "EMAIL"}]', false) as r from ids, c;
create temp table o2 as select (r ->> 'id')::uuid as o2 from o2r;
select is((select r ->> 'estado' || ' ' || jsonb_array_length(r -> 'links') from o2r), 'RASCUNHO 0', 'OC-03: guardar sem mandar fica em rascunho, sem link');
select is((select plataforma_orcamento(ana, ipe, o2) -> 'pode' ->> 'mandar' from ids, c, o2), 'true', 'OC-03: pronto para mandar');
select is((select plataforma_mandar_orcamento(ana, ipe, o2, pg_temp.vo(o2)) ->> 'estado' from ids, c, o2), 'PEDINDO', 'OC-03: mandar depois leva a pedindo');
select is(pg_temp.motivo($$ select plataforma_mandar_orcamento(ana, ipe, o2, pg_temp.vo(o2)) from ids, c, o2 $$), 'JA_MANDADO', 'OC-03: e só uma vez');
select pg_temp.fila();
select is((select finalidade || ' ' || titulo from emails where para = 'souza@exemplo.com'), 'CONVITE Troca do quadro elétrico da piscina', 'OC-03: o convite sai pela fila');
select publico_enviar_proposta(pg_temp.codigo_de('souza@exemplo.com'), 120000, true, null, null, '2 dias', '90 dias', '2026-12-20', null, 'Quadro, disjuntores e mão de obra', null, null);
select plataforma_fechar_propostas(ana, ipe, o2, pg_temp.vo(o2)) from ids, c, o2;
select is((select (plataforma_comparacao(ana, ipe, o2) -> 'regra') - 'alcadaConselho' from ids, c, o2),
  '{"ligada": true, "faixa": {"ate": 500000, "minimo": 1, "quemAprova": "SINDICO"}, "minimo": 1, "recebidas": 1, "minimoAtendido": true, "abaixoMinimo": "MOTIVO", "passaAlcada": false}'::jsonb,
  'OC-05: R$ 1.000 cai na faixa da síndica');
create temp table esc2 as select plataforma_escolher_proposta(ana, ipe, o2, pg_temp.vo(o2), p.id, null, 'PESSOA') as r from ids, c, o2, propostas_orcamento p where p.orcamento_id = o2;
select is((select r - 'versao' from esc2), '{"estado": "ESCOLHIDA", "passaAlcada": false}'::jsonb, 'OC-06: a síndica decide sem despesa: a de menor total, sem motivo');
select is((select aprovada_em is not null from orcamentos, o2 where id = o2), true, 'OC-06: decidida por quem aprova, já está aprovada');
select is((select plataforma_orcamento(ana, ipe, o2) -> 'orcamento' ->> 'situacao' from ids, c, o2), 'Esperando o aceite do fornecedor', 'OC-06: falta o aceite');
select pg_temp.em('2026-11-28 09:00:00-03');
select is((select x -> 'pedeAtencao' from ids, c, jsonb_array_elements(plataforma_orcamentos(ana, ipe, null) -> 'orcamentos') x where x ->> 'id' = (select o2::text from o2)),
  '["SEM_ACEITE"]'::jsonb, 'OC-01: cinco dias sem aceite pedem atenção');
select is((select pg_temp.aviso(ana, o2, 'SEM_ACEITE_5D') ->> 'titulo' from ids, o2), 'Troca do quadro elétrico da piscina', 'OC-01: e o sino de quem cuida avisa');
select is((select count(*)::integer from avisos_orcamento a, o2 where a.orcamento_id = o2 and a.tipo = 'SEM_ACEITE_5D'), 1, 'OC-01: uma vez só por escolha');
select is(pg_temp.campos($$ select plataforma_aceite_fora_do_link(ana, ipe, o2, pg_temp.vo(o2), '2026-11-29') from ids, c, o2 $$), '["data"]'::jsonb, 'OC-03: o aceite fora do link é até hoje');
create temp table af as select plataforma_aceite_fora_do_link(ana, ipe, o2, pg_temp.vo(o2), '2026-11-27') as r from ids, c, o2;
select is((select r ->> 'estado' from af), 'COMPRANDO', 'OC-03: o aceite registrado pela gestão leva à compra');
select is((select p.nome || ' ' || p.acordo || ' ' || p.servico || ' ' || p.email || ' ' || (p.orcamento_origem_id = o2)::text from prestadores p, af, o2 where p.id = (r ->> 'prestadorId')::uuid),
  'Elétrica Souza CHAMADO Troca do quadro elétrico da piscina souza@exemplo.com true', 'OC-10: o fornecedor que aceitou vira prestador com a origem guardada');
select is((select x ->> 'aceiteForaDoLink' || ' ' || (x ->> 'aceiteNome') from ids, c, o2, jsonb_array_elements(plataforma_orcamento(ana, ipe, o2) -> 'convites') x), 'true Elétrica Souza',
  'OC-03: a ficha marca que o aceite foi fora do link');
select is((select publico_orcamento(pg_temp.codigo_de('souza@exemplo.com')) ->> 'estado'), 'ACEITA', 'OC-03: pelo link, o fornecedor vê o aceite');
select is(pg_temp.campos($$ select plataforma_cancelar_orcamento(ana, ipe, o2, pg_temp.vo(o2), '') from ids, c, o2 $$), '["motivo"]'::jsonb, 'OC-01: cancelar pede o motivo');
select is((select plataforma_cancelar_orcamento(ana, ipe, o2, pg_temp.vo(o2), 'A seguradora vai cobrir a troca') ->> 'estado' from ids, c, o2), 'CANCELADO', 'OC-01: cancelado com motivo');
select is((select publico_orcamento(pg_temp.codigo_de('souza@exemplo.com')) ->> 'estado'), 'CANCELADO', 'OC-03: o link conta o cancelamento');
select is((select plataforma_orcamentos(ana, ipe, 'CANCELADOS') -> 'orcamentos' -> 0 ? 'canceladoEm' from ids, c), true, 'OC-07: o cancelado continua na lista');
select is((select plataforma_orcamento(ana, ipe, o2) -> 'orcamento' -> 'cancelado' ->> 'motivo' from ids, c, o2), 'A seguradora vai cobrir a troca', 'OC-07: com o motivo na ficha');
select is((select count(*)::integer from orcamentos) || ' ' || (select count(*) from convites_orcamento) || ' ' || (select count(*) from propostas_orcamento), '2 5 5',
  'OC-04: nada se apaga: dois orçamentos, cinco convites, cinco versões de proposta');
select throws_ok($$ delete from propostas_orcamento $$, 'TC010', null, 'OC-04: a proposta não se apaga');
select throws_ok($$ delete from orcamentos $$, 'TC010', null, 'OC-04: nem o orçamento');

-- ---------------------------------------------------------------------------------------
-- O relatório, a memória e o terceiro orçamento: o link vence 30 dias depois do prazo.

select pg_temp.em('2026-12-02 09:00:00-03');
create temp table rel as select plataforma_gerar_relatorio(ana, ipe, '2026-11', array['DECISOES'], null, null, '[]', false) as r from ids, c;
select is((select (conteudo -> 'decisoes' -> 'orcamentos' -> 0) - 'id' from relatorios_mes, rel where id = (r ->> 'id')::uuid),
  '{"titulo": "Troca da bomba do poço", "escolhida": "HidroPress", "total": 760000, "motivo": "Laudo feito; melhor garantia", "decididoEm": "2026-11-21", "propostas": 2, "peloConselho": true}'::jsonb,
  'TR-02: o relatório do mês conta a decisão: a escolhida, o total e o motivo, nunca os concorrentes');
create temp table o3r as select plataforma_criar_orcamento(bruna, ipe, 'Pintura do muro', 'Dois demãos de tinta acrílica', 'Muro da frente', 'SERVICO', null, null, 300000,
  '2026-12-05 18:00-03', 15, '[{"nome": "Pinturas Lima", "celular": "61999990005", "canal": "WHATSAPP"}]', true) as r from ids, c;
select pg_temp.guardar('L', r -> 'links' -> 0 ->> 'codigo') from o3r;
select pg_temp.em('2026-12-06 09:00:00-03');
select is((select publico_orcamento(pg_temp.cod('L')) ->> 'estado'), 'PRAZO_ACABOU', 'OC-03: passado o prazo sem proposta, o link diz que acabou');
select pg_temp.em('2027-01-10 09:00:00-03');
select is((select publico_orcamento(pg_temp.cod('L')) ->> 'motivo'), 'VENCIDO', 'OC-03: 30 dias depois do prazo, o link vence');

-- ---------------------------------------------------------------------------------------
-- Isolamento (PT-01) e retenção (PT-11).

select throws_ok($$ select plataforma_orcamento(davi, jatoba, o1) from ids, c, o1 $$, 'TC404', null, 'PT-01: o orçamento do Ipê não existe para o Jatobá');
select is((select plataforma_orcamentos(davi, jatoba, null) -> 'orcamentos' from ids, c), '[]'::jsonb, 'PT-01: a lista do Jatobá está vazia');
set local role dominio;
select is((select count(*)::integer from orcamentos), 0, 'PT-01: sem contexto, a RLS não mostra orçamento');
select is((select count(*)::integer from propostas_orcamento), 0, 'PT-01: nem proposta');
select is((select count(*)::integer from convites_orcamento), 0, 'PT-01: nem convite');
reset role;
select is((select numero || ' ' || sistema || ' ' || no_fim from retencao_tipos where codigo = 'ORCAMENTO'), '41 PLATAFORMA Ficam', 'PT-11: o orçamento está no inventário e fica');

select * from finish();
rollback;

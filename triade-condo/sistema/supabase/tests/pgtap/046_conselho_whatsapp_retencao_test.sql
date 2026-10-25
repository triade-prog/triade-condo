-- Conselho pelo WhatsApp e o prazo do contato de quem saiu (R5.3: V-14, W-16, W-20, F0.11, PT-11).
-- O Residencial Ipê tem o número conectado: Rui, subsíndico só com nome e celular; Lúcia,
-- conselheira que não mora lá; Marcos, conselheiro fiscal morador do 304; Velho, conselheiro que
-- sai no primeiro dia; Recente e Mandato, suplentes (um sai dois dias depois, o outro tem o
-- mandato acabando no primeiro dia); Gil, com acesso ao painel, entra e sai. O Edifício Jatobá
-- não tem WhatsApp: o link continua para copiar. O relógio começa num domingo, 26/07/2026, às 09:00.
begin;
select plan(54);

create function pg_temp.em(p timestamptz) returns void language sql as $$ select ajustar_relogio(p - now()) $$;
select pg_temp.em('2026-07-26 09:00:00-03');

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['ATUALIZAR', 'RESPONDER']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Conselheiro', array['APROVAR']) as v_gil
  from ids, c;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.vp(p uuid) returns integer language sql as $$ select versao from pedidos where id = p $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from conselho_membros where id = p $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.sem(p jsonb) returns jsonb language sql as $$ select p - 'membroId' - 'decisaoId' - 'despesaId' - 'codigo' $$;

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre B', 1, true) ->> 'id')::uuid as bb from ids, c;
select plataforma_incluir_unidades(ana, ipe, bb, '[{"identificacao": "304"}]') from ids, c, bl;
create temp table mor as select
  plataforma_incluir_pessoa_unidade(ana, ipe, (select id from unidades where identificacao = '304'), null, 'Marcos Lima', '+5561999990304',
                                    '{"proprietario": true, "principal": true, "mora": true}', true) as marcos
  from ids, c;
create temp table ct as select (select contato_id from contatos_unidade where id = (marcos ->> 'vinculoId')::uuid) as c_marcos from mor;
create temp table p as select (plataforma_registrar_pedido(bruna, ipe, null, null, 'Garagem G2',
  (select id from categorias where condominio_id = ipe and modelo = 'MANUTENCAO'),
  (select id from prioridades where condominio_id = ipe and modelo = 'NORMAL'), 'Infiltração na laje da G2',
  'A mancha voltou depois do conserto.', 'OBSERVACAO', false, null) ->> 'id')::uuid as p1 from ids, c;

-- O número do Ipê conectado (piloto).
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '556198124400', null) from ids, c;
create function pg_temp.chega(p_id text, p_tel text, p_texto text) returns jsonb language sql as $$
  select whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_build_object('id', p_id, 'telefone', p_tel, 'tipo', 'TEXTO', 'texto', p_texto, 'enviadaEm', app_now())) $$;

create temp table m as select
  (plataforma_incluir_membro(ana, ipe, null, null, 'Rui Alves', '(61) 99999-0001', null, 'SUBSINDICO', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_rui,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Lúcia Prado', '+5561999990002', null, 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_lucia,
  (plataforma_incluir_membro(ana, ipe, null, c_marcos, null, null, null, 'CONSELHEIRO_FISCAL', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_marcos,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Vítor Velho', '61999990005', 'velho@exemplo.com', 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_velho,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Rita Recente', '+5561999990006', 'rita@exemplo.com', 'SUPLENTE', '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_recente,
  (plataforma_incluir_membro(ana, ipe, null, null, 'Mário Mandato', '+5561999990007', null, 'SUPLENTE', '2026-01-01', '2026-07-26', 'WHATSAPP') ->> 'id')::uuid as m_mandato
  from ids, c, ct;

-- ---------------------------------------------------------------------------------------
-- Os modelos (W-20).

select is((select string_agg(chave || ':' || para || ':' || situacao, ', ' order by chave) from modelos_whatsapp where chave like 'conselho%'),
  'conselho_aviso:CONSELHO:APROVADO_PILOTO, conselho_substituto:CONSELHO:APROVADO_PILOTO, conselho_voto:CONSELHO:APROVADO_PILOTO',
  'W-20: os três modelos do link do conselho, aprovados no piloto, para quem é do conselho');
select is((select count(*)::int from modelos_whatsapp where chave like 'conselho%' and nota = 'Aprovado pela Carolina em 25/10/2026'
            and rodape = 'Para não receber mais avisos, responda PARAR.'), 3, 'W-16: com a nota da aprovação e o rodapé do PARAR');
select is(celular_whatsapp('61999990005') || ' ' || celular_whatsapp('(61) 99999-0001') || ' ' || celular_whatsapp('+5561999990002')
          || ' ' || coalesce(celular_whatsapp('123'), '-'), '+5561999990005 +5561999990001 +5561999990002 -',
  'W-20: o celular do membro no formato do WhatsApp');

-- ---------------------------------------------------------------------------------------
-- O voto pelo WhatsApp (V-14, W-20).

create temp table d1 as select plataforma_pedir_decisao(bruna, ipe, p1, pg_temp.vp(p1), 'Qual conserto fazer na laje da G2', 'Chove na quinta',
  '2026-07-31', null, '[{"descricao": "Remendo no trecho rachado", "custo": 240000}, {"descricao": "Refazer a impermeabilização", "custo": 1890000}]',
  'CONSELHO') as r from ids, c, p;
create temp table d1i as select (r ->> 'id')::uuid as d1 from d1;
select is((select jsonb_agg(pg_temp.sem(x) order by x ->> 'nome') from d1, jsonb_array_elements(r -> 'links') x),
  '[{"nome": "Lúcia Prado", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "VOTO"},
    {"nome": "Marcos Lima", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "VOTO"},
    {"nome": "Rui Alves", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "VOTO"},
    {"nome": "Vítor Velho", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "VOTO"}]'::jsonb,
  'W-20: com o número conectado, o link de cada titular entra na fila do WhatsApp, em vez de COPIAR');
select is((select count(*)::int from d1, jsonb_array_elements(r -> 'links') x where x ? 'codigo' or x ? 'aviso'), 0,
  'V-14: quem só pediu (Atualizar) não recebe código nem precisa pedir o link ao síndico');
select is((select string_agg(para, ' ' order by para) from envios_whatsapp where finalidade = 'CONSELHO' and estado = 'NA_FILA'),
  '+5561999990001 +5561999990002 +5561999990005 +5561999990304', 'W-20: uma mensagem por titular, no número do membro');
select is((select texto from envios_whatsapp where para = '+5561999990002' and finalidade = 'CONSELHO'),
  E'Votação do conselho do Residencial Ipê: Qual conserto fazer na laje da G2\n\nVote até 31/07/2026 pelo seu link pessoal:\n[link]\n\nNina, assistente virtual do Residencial Ipê.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: o texto do modelo de voto, com [link] no lugar do link');
select is((select modelo_chave || ' ' || (modelo_parametros ->> 3) from envios_whatsapp where para = '+5561999990002' and finalidade = 'CONSELHO'),
  'conselho_voto [link]', 'W-20: o modelo e as variáveis, sem o código');
select is((select dec_link from (select x -> 'link' ->> 'envio' as dec_link
             from ids, d1i, jsonb_array_elements((select y from jsonb_array_elements(plataforma_decisoes(ana, (select ipe from c), 'TODAS') -> 'decisoes') y
                                                  where y ->> 'id' = d1::text) -> 'conselho' -> 'votos') x where x ->> 'nome' = 'Lúcia Prado') z),
  'NA_FILA', 'V-14: a decisão mostra o link de Lúcia na fila do WhatsApp');

-- A fila: o código nasce na hora de enviar e entra no lugar de [link] (rota /conselho).
create temp table lote as select whatsapp_pegar_lote(20) as l;
create temp table saiu as select x ->> 'para' as para, x ->> 'link' as codigo, x ->> 'rota' as rota, x ->> 'texto' as texto, (x ->> 'envio')::uuid as envio
  from lote, jsonb_array_elements(l) b, jsonb_array_elements(b -> 'envios') x;
select is((select count(*)::int from saiu where rota = 'conselho' and codigo is not null and texto like '%[link]%'), 4,
  'W-20: as quatro mensagens saem com o código à parte e o texto com [link]');
select is((select publico_conselho(codigo) ->> 'estado' from saiu where para = '+5561999990002'), 'VOTAR', 'V-14: o código da mensagem abre a votação');
select is((select count(*)::int from saiu s, codigos_sem_conta k where k.hash = hash_codigo(s.codigo) and k.envio_whatsapp_id = s.envio), 4,
  'PT-01: só o hash do código fica guardado, ligado à mensagem');
select is((select count(*)::int from envios_whatsapp w, saiu s
            where w.finalidade = 'CONSELHO' and (position(s.codigo in coalesce(w.texto, '')) > 0 or position(s.codigo in coalesce(w.texto_enviado, '')) > 0
                                                 or position(s.codigo in coalesce(w.modelo_parametros::text, '')) > 0)), 0,
  'PT-01: o texto guardado nunca tem o código');
select is((select count(*)::int from envios_whatsapp where finalidade = 'CONSELHO' and texto_enviado like '%[link]%'), 4,
  'W-20: o que foi enviado fica guardado com [link]');
select whatsapp_resultado(ipe, envio, 'P-' || right(para, 4), null, null) from c, saiu where para <> '+5561999990304';
select whatsapp_resultado(ipe, envio, null, 'O provedor recusou', 'PERMANENTE') from c, saiu where para = '+5561999990304';
select is((select publico_conselho(codigo) ->> 'estado' from saiu where para = '+5561999990304'), 'NAO_VALE',
  'W-14: a mensagem que falhou de vez para o código que levaria');
select is((select publico_votar_conselho(codigo, '1', null) ->> 'estado' from saiu where para = '+5561999990005'), 'VOTADO',
  'V-14: Vítor vota pelo link do WhatsApp');

-- Reenviar: quem cuida do conselho recebe também o código para copiar; a anterior na fila para.
create temp table re1 as select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_lucia) as r from ids, c, d1i, m;
select is((select pg_temp.sem(r) || jsonb_build_object('temCodigo', r ? 'codigo') from re1),
  '{"nome": "Lúcia Prado", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "VOTO", "temCodigo": true}'::jsonb,
  'V-14: a síndica reenvia pelo WhatsApp e ainda pode copiar o link');
select is((select publico_conselho(codigo) ->> 'motivo' from saiu where para = '+5561999990002'), 'LINK_TROCADO', 'V-14: reenviar troca o link');
select is((select publico_conselho(r ->> 'codigo') ->> 'estado' from re1), 'VOTAR', 'V-14: o código para copiar vale');
create temp table re2 as select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_lucia) as r from ids, c, d1i, m;
select is((select string_agg(estado, ' ') from envios_whatsapp where finalidade = 'CONSELHO' and para = '+5561999990002' and motivo = 'O link foi mandado de novo'),
  'CANCELADA', 'W-20: mandar de novo cancela a mensagem que ainda estava na fila');

-- PARAR de quem não é morador (W-16): marca o membro; a Nina confirma; a fila respeita.
select pg_temp.chega('M1', '+5561999990002', 'Parar');
select ok((select whatsapp_parou_em is not null from conselho_membros where id = (select m_lucia from m)), 'W-16: o PARAR de Lúcia marca o membro');
select is((select string_agg(estado, ' ') from envios_whatsapp where finalidade = 'CONSELHO' and para = '+5561999990002'
             and motivo = 'A pessoa pediu para parar de receber avisos'), 'CANCELADA', 'W-16: o que estava na fila para ela é cancelado');
select is((select texto from envios_whatsapp where finalidade = 'RESPOSTA' and para = '+5561999990002'),
  'Pronto: você não recebe mais os links do conselho do Residencial Ipê por aqui. O síndico pode mandar o link por outro meio. Para voltar, mande VOLTAR.',
  'W-16: a Nina confirma');
select is((select triagem from mensagens_whatsapp where provedor_id = 'M1'), 'ARQUIVADA', 'W-16: a mensagem não vai para A identificar');
create temp table re3 as select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_lucia) as r from ids, c, d1i, m;
select is((select pg_temp.sem(r) || jsonb_build_object('temCodigo', r ? 'codigo') from re3),
  '{"nome": "Lúcia Prado", "canal": "WHATSAPP", "envio": "COPIAR", "finalidade": "VOTO", "semWhatsapp": "PAROU", "temCodigo": true}'::jsonb,
  'W-16: quem pediu PARAR não recebe pelo WhatsApp: o link fica para copiar');
select is((select plataforma_conselho(ana, ipe) -> 'membros' from ids, c) @> '[{"nome": "Lúcia Prado", "whatsappParou": true}]', true,
  'W-16: a tela do conselho mostra que o número pediu PARAR');
select pg_temp.chega('M2', '+5561999990002', 'voltar');
select is((select whatsapp_parou_em from conselho_membros where id = (select m_lucia from m)), null, 'W-16: VOLTAR tira a marca');
select is((select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_lucia) ->> 'envio' from ids, c, d1i, m), 'WHATSAPP',
  'W-16: e o link volta a ir pelo WhatsApp');

-- O morador para pelo contato, como sempre; vale também para o link do conselho.
select pg_temp.chega('M3', '+5561999990304', 'PARAR');
select ok((select whatsapp_parou_em is not null from contatos where id = (select c_marcos from ct)), 'W-16: Marcos para pelo contato do morador');
select is((select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_marcos) ->> 'semWhatsapp' from ids, c, d1i, m), 'PAROU',
  'W-16: e o link dele fica para copiar');

-- Gil, com acesso ao painel, entra e sai no mesmo dia; Vítor sai também.
create temp table m2 as select (plataforma_incluir_membro(ana, ipe, gil, null, null, null, 'gil@exemplo.com', 'CONSELHEIRO', '2026-01-01', '2027-12-31', 'EMAIL') ->> 'id')::uuid as m_gil
  from ids, c;
select plataforma_retirar_membro(ana, ipe, m_gil, pg_temp.vm(m_gil), 'Mudou de cidade') from ids, c, m2;
select plataforma_retirar_membro(ana, ipe, m_velho, pg_temp.vm(m_velho), 'Vendeu o apartamento') from ids, c, m;

-- ---------------------------------------------------------------------------------------
-- O aviso da vencida e o substituto pelo WhatsApp.

select plataforma_definir_regras_decisoes(ana, ipe, pg_temp.vcfg(), 'MAIORIA', null, 'SINDICO', 'SUBSINDICO', null) from ids, c;
create temp table d3 as select (plataforma_pedir_decisao(bruna, ipe, p1, pg_temp.vp(p1), 'Trocar a lâmpada da G2', 'Está escuro', '2026-07-26',
  v_ana, '[{"descricao": "Trocar por LED"}]') ->> 'id')::uuid as d3 from ids, c, p, vs;
select pg_temp.em('2026-07-27 09:00:00-03');
select verificar_decisoes();
select is((select texto from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id, d3 where l.decisao_id = d3 and l.finalidade = 'AVISO'),
  E'Conselho do Residencial Ipê: a decisão "Trocar a lâmpada da G2" passou do prazo de 26/07/2026 sem resposta. Veja pelo link:\n[link]\n\nNina, assistente virtual do Residencial Ipê.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: a vencida avisa o subsíndico pelo WhatsApp, com o modelo do aviso');
select is((select estado || ' ' || modelo_chave from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id, d3 where l.decisao_id = d3 and l.finalidade = 'AVISO'),
  'NA_FILA conselho_aviso', 'W-20: na fila, pela rotina');

select pg_temp.em('2026-07-28 09:00:00-03');
create temp table au as select plataforma_marcar_ausencia(ana, ipe, '2026-07-28', '2026-08-05', 'Viagem') as r from ids, c;
select is((select pg_temp.sem(x) - 'codigo' from au, d3, jsonb_array_elements(r -> 'links') x where x ->> 'decisaoId' = d3::text),
  '{"nome": "Rui Alves", "canal": "WHATSAPP", "envio": "WHATSAPP", "estado": "NA_FILA", "finalidade": "SUBSTITUTO"}'::jsonb,
  'V-14: o link do substituto vai pelo WhatsApp');
select is((select texto from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id, d3 where l.decisao_id = d3 and l.finalidade = 'SUBSTITUTO'),
  E'Conselho do Residencial Ipê: o síndico está ausente e você responde no lugar dele.\n\nTrocar a lâmpada da G2, até 26/07/2026:\n[link]\n\nNina, assistente virtual do Residencial Ipê.\n\nPara não receber mais avisos, responda PARAR.',
  'W-20: com o modelo do substituto');
select is((select (pg_temp.sem(x) - 'mandadoEm') from ids, d3, jsonb_array_elements((select y from jsonb_array_elements(plataforma_decisoes(ana, (select ipe from c), 'TODAS') -> 'decisoes') y
                                                      where y ->> 'id' = d3::text) -> 'links') x where x ->> 'finalidade' = 'SUBSTITUTO'),
  '{"nome": "Rui Alves", "canal": "WHATSAPP", "envio": "NA_FILA", "finalidade": "SUBSTITUTO", "podeReenviar": true}'::jsonb,
  'V-14: a decisão mostra o link do substituto na fila');
create temp table lote2 as select whatsapp_pegar_lote(20) as l;
select is((select count(*)::int from lote2, jsonb_array_elements(l) b, jsonb_array_elements(b -> 'envios') x
            where x ->> 'para' = '+5561999990001' and x ->> 'rota' = 'conselho' and x ? 'link'), 2, 'W-20: o aviso e o substituto saem com o código');
select is((select publico_conselho(x ->> 'link') ->> 'estado' from lote2, jsonb_array_elements(l) b, jsonb_array_elements(b -> 'envios') x
            where x ->> 'texto' like '%ausente%'), 'RESPONDER', 'V-14: o link do substituto responde no lugar da síndica');
select plataforma_retirar_membro(ana, ipe, m_recente, pg_temp.vm(m_recente), 'Pediu para sair') from ids, c, m;

-- Na fila, o que deixou de valer é cancelado antes de sair.
select plataforma_encerrar_ausencia(ana, ipe, (r ->> 'id')::uuid, (select versao from ausencias_sindico where id = (r ->> 'id')::uuid)) from ids, c, au;
select plataforma_reenviar_link_conselho(ana, ipe, d1, null, m_rui) from ids, c, d1i, m;
update conselho_membros set canal = 'EMAIL', email = 'rui@exemplo.com' where id = (select m_rui from m);
select whatsapp_pegar_lote(20);
select is((select string_agg(w.estado, ' ') from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id, d1i
            where l.decisao_id = d1 and w.para = '+5561999990001' and w.motivo = 'O contato do membro mudou'),
  'CANCELADA', 'W-20: trocou o canal: a mensagem na fila é cancelada');
update conselho_membros set canal = 'WHATSAPP', email = null where id = (select m_rui from m);

-- ---------------------------------------------------------------------------------------
-- Sem WhatsApp (Jatobá): continua COPIAR; e nada se mistura (PT-01).

create temp table mj as select (plataforma_incluir_membro(davi, jatoba, null, null, 'Joana Jatobá', '+5568999990001', null, 'CONSELHEIRO',
  '2026-01-01', '2027-12-31', 'WHATSAPP') ->> 'id')::uuid as m_joana from ids, c;
create temp table pj as select (plataforma_registrar_pedido(davi, jatoba, null, null, 'Portão',
  (select id from categorias where condominio_id = jatoba and modelo = 'MANUTENCAO'),
  (select id from prioridades where condominio_id = jatoba and modelo = 'NORMAL'), 'Portão rangendo', 'Faz barulho.', 'OBSERVACAO', false, null) ->> 'id')::uuid as pj
  from ids, c;
create temp table dj as select plataforma_pedir_decisao(davi, jatoba, pj, pg_temp.vp(pj), 'Lubrificar o portão', 'Faz barulho', '2026-08-10', null,
  '[{"descricao": "Lubrificar"}]', 'CONSELHO') as r from ids, c, pj;
select is((select pg_temp.sem(r -> 'links' -> 0) || jsonb_build_object('temCodigo', r -> 'links' -> 0 ? 'codigo') from dj),
  '{"nome": "Joana Jatobá", "canal": "WHATSAPP", "envio": "COPIAR", "finalidade": "VOTO", "semWhatsapp": "WHATSAPP_DESLIGADO", "temCodigo": true}'::jsonb,
  'V-14: sem o número conectado, o link continua para copiar');
select is((select count(*)::int from envios_whatsapp where condominio_id = (select jatoba from c)), 0, 'PT-01: o Jatobá não tem nada na fila');
select set_config('app.pessoa_id', (select davi::text from ids), true), set_config('app.condominio_id', (select jatoba::text from c), true);
set local role dominio;
select is((select count(*)::int from envios_whatsapp where finalidade = 'CONSELHO'), 0, 'RLS: no Jatobá não aparece envio do conselho do Ipê');
reset role;
select set_config('app.pessoa_id', '', true), set_config('app.condominio_id', '', true);

-- ---------------------------------------------------------------------------------------
-- O prazo do contato de quem saiu (F0.11, PT-11): 25/10/2026, às 10:00. Vítor e Gil saíram há
-- 91 dias; o mandato de Mário acabou há mais de 90; Rita saiu há 89; os outros estão no conselho.

select is((select situacao from retencao_tipos where codigo = 'CONSELHO'), 'NA_ROTINA', 'PT-11: o conselho entrou na rotina');
select pg_temp.em('2026-10-25 10:00:00-03');
create temp table r1 as select aplicar_retencao() as id;
select is((select (x -> 'itens' ->> 'CONSELHO')::int from retencao_rodadas r, r1, c, jsonb_array_elements(r.clientes) x
            where r.id = r1.id and x ->> 'condominioId' = ipe::text), 3, 'PT-11: contando, a rotina acha os três que saíram há mais de 90 dias');
select is((select count(*)::int from conselho_membros where contato_apagado_em is not null), 0, 'PT-11: contando, nada é apagado');
select is((select (x -> 'itens' ->> 'CONSELHO') from retencao_rodadas r, r1, c, jsonb_array_elements(r.clientes) x
            where r.id = r1.id and x ->> 'condominioId' = jatoba::text), null, 'PT-01: no Jatobá, ninguém');

select console_retencao_modo(adm, 'APAGANDO', (select versao from retencao_estado)) from ids;
create temp table r2 as select aplicar_retencao() as id;
select is((select string_agg(nome || ':' || coalesce(celular, '-') || ':' || coalesce(email, '-') || ':' || (contato_apagado_em is not null), ', ' order by nome)
             from conselho_membros where condominio_id = (select ipe from c)),
  'Gil:-:-:true, Lúcia Prado:+5561999990002:-:false, Marcos Lima:+5561999990304:-:false, Mário Mandato:-:-:true, Rita Recente:+5561999990006:rita@exemplo.com:false, Rui Alves:61999990001:-:false, Vítor Velho:-:-:true',
  'PT-11: apagando, sai o contato de quem saiu há mais de 90 dias (retirado ou mandato acabado); quem saiu há 89 e quem está fica');
select is((select pessoa_id from conselho_membros where id = (select m_gil from m2)), (select gil from ids),
  'PT-11: quem tem conta guarda só a ligação');
select is((select escolha from votos_conselho v, d1i, m where v.decisao_id = d1 and v.membro_id = m_velho), '1', 'PT-11: os votos ficam');
select is((select count(*)::int from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id, m
            where l.membro_id = m_velho and w.dados_apagados_em is not null and w.para is null and w.texto is null), 1,
  'PT-11: a cópia do contato no envio do link é apagada junto');
select is((select contato_apagado_em is not null from conselho_membros where id = (select m_joana from mj)), false, 'PT-01: o membro do Jatobá fica');
select is((select x -> 'contatoApagadoEm' is not null from ids, c, jsonb_array_elements(plataforma_conselho(ana, ipe) -> 'retirados') x where x ->> 'nome' = 'Vítor Velho'),
  true, 'PT-11: a tela mostra que o contato foi apagado');
select is((select count(*)::int from conselho_membros m, r2 where m.contato_apagado_em is not null)
          - (select (x -> 'itens' ->> 'CONSELHO')::int from retencao_rodadas r, r2, c, jsonb_array_elements(r.clientes) x
              where r.id = r2.id and x ->> 'condominioId' = ipe::text), 0, 'PT-03: o histórico conta o que foi apagado');

-- Renovar o mandato de quem teve o contato apagado pede o contato de novo (regra 7).
select is(pg_temp.campos($$ select plataforma_alterar_membro(ana, ipe, m_mandato, pg_temp.vm(m_mandato), 'SUPLENTE', '2026-10-25', '2028-10-24', 'WHATSAPP', null, null)
                            from ids, c, m $$), '["celular"]'::jsonb, 'V-14: renovar pede o celular de novo');
select plataforma_alterar_membro(ana, ipe, m_mandato, pg_temp.vm(m_mandato), 'SUPLENTE', '2026-10-25', '2028-10-24', 'WHATSAPP', '+5561999990077', null) from ids, c, m;
select is((select celular || ' ' || (contato_apagado_em is null) from conselho_membros where id = (select m_mandato from m)), '+5561999990077 true',
  'V-14: com o contato novo, a marca de apagado sai');

select * from finish();
rollback;

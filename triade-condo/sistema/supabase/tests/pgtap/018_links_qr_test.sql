-- Links e QR (peça R13; AT-30, MP-08, V-11): etiquetas por local que abrem o WhatsApp do
-- condomínio, recado que some, troca de código e desativação com motivo; link do prestador na
-- manutenção, com o que ele vê, a chegada pela etiqueta, o "não consegui fazer", o "terminei",
-- as fotos e o aviso no sino. Cada condomínio só vê o que é seu.
begin;
select plan(62);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_MANUTENCAO']) as v_fabio
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.ve(p uuid) returns integer language sql as $$ select versao from etiquetas where id = p $$;
create function pg_temp.vm(p uuid) returns integer language sql as $$ select versao from manutencoes where id = p $$;

-- Etiquetas (AT-30). Sem número de WhatsApp, não há etiqueta.
select is(pg_temp.motivo($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, 'Garagem · subsolo 1', null, null, null) from ids, c $$),
  'SEM_NUMERO_WHATSAPP', 'AT-30: sem número de WhatsApp cadastrado na implantação, não há etiqueta');
update condominios set numero_whatsapp = '+5561990001234' where id = (select ipe from c);
update condominios set numero_whatsapp = '+5568990005555' where id = (select jatoba from c);

select throws_ok($$ select plataforma_salvar_etiqueta(bruna, ipe, null, null, 'Garagem', null, null, null) from ids, c $$, 'TC401', null,
  'AT-30: só quem pode configurar cria etiqueta');
create temp table et as select
  (plataforma_salvar_etiqueta(ana, ipe, null, null, 'Elevador social · bloco A', 'Dentro da cabine', null, null) ->> 'id')::uuid as e1,
  (plataforma_salvar_etiqueta(ana, ipe, null, null, 'Casa de bombas', 'Porta de entrada', null, null) ->> 'id')::uuid as e2,
  (plataforma_salvar_etiqueta(ana, ipe, null, null, 'Garagem · subsolo 1', null, 'Já sabemos do portão travando.', hoje + 3) ->> 'id')::uuid as e3,
  (plataforma_salvar_etiqueta(davi, jatoba, null, null, 'Hall', null, null, null) ->> 'id')::uuid as ej
  from ids, c, d;
select is((select array_agg(numero order by numero) from etiquetas where condominio_id = (select ipe from c)), array[1, 2, 3]::smallint[],
  'AT-30: as etiquetas recebem números seguidos no condomínio (E01, E02, E03)');
select is((select numero from etiquetas where id = (select ej from et)), 1::smallint, 'AT-30: cada condomínio conta as próprias etiquetas');
select ok((select codigo ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' from etiquetas where id = (select e1 from et)),
  'AT-30: o código da etiqueta tem 12 caracteres sem os que se confundem');
select ok(exists (select 1 from codigos_sem_conta s join etiquetas e on s.hash = hash_codigo(e.codigo) where e.id = (select e1 from et)),
  'AT-30: o código sem conta guarda só o hash');
select is(pg_temp.motivo($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, ' casa de BOMBAS ', null, null, null) from ids, c $$),
  'LOCAL_REPETIDO', 'AT-30: duas etiquetas em uso não têm o mesmo local');
select is(pg_temp.campos($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, 'Portão', null, 'Recado', hoje + 31) from ids, c, d $$),
  '["recadoAte"]', 'AT-30: o recado some em no máximo 30 dias');
select is(pg_temp.campos($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, 'Portão', null, 'Recado sem data', null) from ids, c $$),
  '["recadoAte"]', 'AT-30: recado precisa da data em que some');
select is(pg_temp.campos($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, 'X', null, null, null) from ids, c $$),
  '["local"]', 'AT-30: local de 2 a 120 caracteres');

-- Locais viram sugestão.
select is(plataforma_locais(fabio, ipe), '["Casa de bombas", "Elevador social · bloco A", "Garagem · subsolo 1"]'::jsonb,
  'AT-30: os locais das etiquetas viram sugestão para quem usa a Plataforma') from ids, c;

-- A página da etiqueta.
create temp table cod as select (select codigo from etiquetas where id = e3) as c3, (select codigo from etiquetas where id = e1) as c1 from et;
select is(publico_etiqueta(c3) - 'recadoEm',
  '{"condominio": "Residencial Ipê", "local": "Garagem · subsolo 1", "rotulo": "E03", "recado": "Já sabemos do portão travando.", "whatsapp": "5561990001234"}'::jsonb,
  'AT-30: a etiqueta mostra só o condomínio, o local, o código curto, o recado e o número do WhatsApp') from cod;
select is(publico_etiqueta(lower(c3)) ->> 'local', 'Garagem · subsolo 1', 'AT-30: o código vale em minúsculas também') from cod;
select is((select vezes from etiqueta_aberturas where etiqueta_id = (select e3 from et)), 2, 'AT-30: conta as aberturas do dia, sem saber quem abriu');
select throws_ok($$ select publico_etiqueta('ABCD-EFGH-JKMN') $$, 'TC404', null, 'AT-30: código desconhecido responde como não encontrado');
select throws_ok($$ select publico_etiqueta('a') $$, 'TC404', null, 'AT-30: código fora do formato responde como não encontrado');
select ajustar_relogio('4 days');
select ok(not (publico_etiqueta(c3) ? 'recado'), 'AT-30: o recado some sozinho na data') from cod;
select ajustar_relogio('0');

-- Alterar, trocar o código e desativar.
select is((plataforma_salvar_etiqueta(ana, ipe, e1, pg_temp.ve(e1), 'Elevador social · bloco A', 'Dentro da cabine, à esquerda',
           'Elevador em manutenção até sexta.', hoje + 2) ->> 'versao')::integer, 2, 'AT-30: o síndico muda onde fica e escreve recado')
  from ids, c, et, d;
select ok(exists (select 1 from historico where entidade = 'etiquetas' and entidade_id = (select e1::text from et) and acao = 'etiqueta.recado'),
  'AT-30: o recado fica no histórico da etiqueta');
select is(pg_temp.campos($$ select plataforma_trocar_codigo_etiqueta(ana, ipe, e1, pg_temp.ve(e1), '') from ids, c, et $$), '["motivo"]',
  'AT-30: trocar o código pede motivo');
create temp table novo as select plataforma_trocar_codigo_etiqueta(ana, ipe, e1, pg_temp.ve(e1), 'Cópia colada no prédio vizinho') ->> 'codigo' as c1n
  from ids, c, et;
select is(publico_etiqueta(c1), '{"condominio": "Residencial Ipê", "foraDeUso": true}'::jsonb,
  'AT-30: depois de trocar, a etiqueta colada diz que não está mais em uso') from cod;
select is(publico_etiqueta(c1n) ->> 'rotulo', 'E01', 'AT-30: o código novo abre a mesma etiqueta') from novo;
select ok(exists (select 1 from historico where acao = 'etiqueta.codigo_trocado' and dados ->> 'motivo' = 'Cópia colada no prédio vizinho'),
  'AT-30: a troca fica no histórico com o motivo');
select lives_ok($$ select plataforma_desativar_etiqueta(ana, ipe, e2, pg_temp.ve(e2), 'Casa de bombas trancada, sem acesso') from ids, c, et $$,
  'AT-30: desativar com motivo');
select is(publico_etiqueta((select codigo from etiquetas where id = e2)) ->> 'foraDeUso', 'true', 'AT-30: etiqueta desativada fica fora de uso') from et;
select is(pg_temp.motivo($$ select plataforma_salvar_etiqueta(ana, ipe, e2, pg_temp.ve(e2), 'Casa de bombas', null, null, null) from ids, c, et $$),
  'ETIQUETA_DESATIVADA', 'AT-30: etiqueta desativada não muda');
select lives_ok($$ select plataforma_salvar_etiqueta(ana, ipe, null, null, 'Casa de bombas', null, null, null) from ids, c $$,
  'AT-30: o local da etiqueta desativada pode ganhar etiqueta nova');
select throws_ok($$ select plataforma_etiqueta(davi, jatoba, e1) from ids, c, et $$, 'TC404', null,
  'AT-30: um condomínio não vê a etiqueta do outro');

-- Visão geral.
select is((plataforma_links_qr(ana, ipe) -> 'etiquetas' -> 0 ->> 'rotulo'), 'E01', 'AT-30: Links e QR lista as etiquetas em uso primeiro') from ids, c;
select is((plataforma_links_qr(ana, ipe) ->> 'numeroWhatsapp'), '+5561990001234', 'AT-30: Links e QR mostra o número que as etiquetas abrem') from ids, c;

-- Link do prestador (V-11).
create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'HidroPress Bombas', 'Bombas', 'Márcio', '+5561933441200', null, null,
                               'CHAMADO', null, null, null, null) ->> 'id')::uuid as hidro,
  (select id from prioridades where condominio_id = ipe and modelo = 'ALTA') as alta
  from ids, c;
create temp table m as select
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Bomba de recalque com ruído', 'Casa de bombas',
     'Detalhe interno: o morador do 101 reclamou', alta, v_bruna, hidro, null, null, null, null, null, null) ->> 'id')::uuid as m1,
  (plataforma_registrar_manutencao(ana, ipe, 'CORRETIVA', 'Lâmpada da garagem', 'Garagem · subsolo 1', null, alta, v_bruna,
     null, null, null, null, null, null, null) ->> 'id')::uuid as m2
  from ids, c, vs, pr;
select is(pg_temp.motivo($$ select plataforma_criar_link_prestador(ana, ipe, m2, pg_temp.vm(m2), 'Trocar a lâmpada da vaga 31', null, null,
            hoje + 14, null) from ids, c, m, d $$), 'SEM_EXECUTOR', 'V-11: sem quem executa, não há link');
select throws_ok($$ select plataforma_criar_link_prestador(fabio, ipe, m1, pg_temp.vm(m1), 'Trocar o rolamento da bomba 2', null, null,
                   hoje + 14, null) from ids, c, m, d $$, 'TC401', null, 'V-11: só quem cuida da manutenção manda link');
select is(pg_temp.campos($$ select plataforma_criar_link_prestador(ana, ipe, m1, pg_temp.vm(m1), 'Trocar o rolamento', null, null,
            hoje + 61, null) from ids, c, m, d $$), '["valeAte"]', 'V-11: o link vale no máximo 60 dias');
create temp table lk as select plataforma_criar_link_prestador(ana, ipe, m1, pg_temp.vm(m1),
  'Bomba 2 com ruído forte. Diagnosticar e trocar o rolamento.', 'Hoje, 14h às 17h', 'Procurar a zeladora na portaria.', hoje + 14, null) as r
  from ids, c, m, d;
select ok(length(r ->> 'codigo') >= 40, 'V-11: o código do link do prestador é longo e aleatório') from lk;
select ok(not exists (select 1 from links_prestador l, lk where l.o_que_fazer like '%' || (lk.r ->> 'codigo') || '%')
          and exists (select 1 from codigos_sem_conta s, lk where s.hash = hash_codigo(lk.r ->> 'codigo') and s.tipo = 'PRESTADOR'),
  'V-11: o código do link é guardado só embaralhado');
create temp table pp as select publico_prestador(r ->> 'codigo') as v from lk;
select is(v ->> 'oQueFazer', 'Bomba 2 com ruído forte. Diagnosticar e trocar o rolamento.', 'V-11: o prestador vê o que fazer') from pp;
select ok(v::text not like '%101%' and v::text not like '%reclamou%' and not (v ? 'detalhes') and not (v ? 'pedido'),
  'V-11: os detalhes internos e o morador não vão ao prestador') from pp;
select ok((select aberto_em is not null from links_prestador where id = ((select r from lk) ->> 'id')::uuid), 'V-11: a primeira abertura fica registrada');

-- Chegada pela etiqueta (MP-08).
select is(publico_prestador_chegada(r ->> 'codigo', (select codigo from etiquetas where ativa and local = 'Casa de bombas')) - 'em',
  '{"confirmado": true, "etiqueta": {"rotulo": "E04", "local": "Casa de bombas"}, "etiquetaLida": true}'::jsonb,
  'MP-08: a etiqueta do local da manutenção confirma a chegada') from lk;
select is(publico_prestador_chegada(r ->> 'codigo', (select codigo from etiquetas where id = (select e3 from et))) ->> 'confirmado', 'false',
  'MP-08: a etiqueta de outro local deixa a chegada como informada') from lk;
select is(publico_prestador_chegada(r ->> 'codigo', null) ->> 'confirmado', 'false', 'MP-08: sem etiqueta, a chegada fica informada pelo prestador') from lk;
select is(publico_prestador_chegada(r ->> 'codigo', (select codigo from etiquetas where id = (select ej from et))) ->> 'confirmado', 'false',
  'MP-08: a etiqueta de outro condomínio não confirma nada') from lk;

-- Não consegui fazer e terminei (V-11).
select is(pg_temp.campos($$ select publico_prestador_impedimento(r ->> 'codigo', 'SEM_ACESSO', '', null) from lk $$), '["texto"]',
  'V-11: não consegui fazer pede o que aconteceu');
select lives_ok($$ select publico_prestador_impedimento(r ->> 'codigo', 'SEM_ACESSO', 'Ninguém na portaria com a chave.', null) from lk $$,
  'V-11: o prestador conta que não conseguiu');
select is((select estado from manutencoes where id = (select m1 from m)), 'PLANEJADA', 'V-11: o que o prestador manda não muda a situação');
select is((select count(*)::integer from avisos_prestador a join vinculos v on v.pessoa_id = a.pessoa_id where v.id = (select v_bruna from vs)), 1,
  'V-11: o responsável recebe o aviso no sino');
select is((plataforma_avisos(bruna, ipe) -> 'itens' -> 0 ->> 'tipo'), 'PRESTADOR_IMPEDIMENTO', 'V-11: o aviso aparece no sino da responsável') from ids, c;
create temp table foto as select (publico_prestador_iniciar_foto(r ->> 'codigo', 'depois.jpg', 'image/jpeg', 1000) ->> 'arquivoId')::uuid as f from lk;
select is(pg_temp.motivo($$ select publico_prestador_iniciar_foto(r ->> 'codigo', 'laudo.pdf', 'application/pdf', 1000) from lk $$),
  'TIPO_NAO_ACEITO', 'V-11: pelo link vão só fotos');
select is(pg_temp.campos($$ select publico_prestador_terminei(r ->> 'codigo', 'Troquei o rolamento.', false, null, 'Márcio', array[f]) from lk, foto $$),
  '["fotos"]', 'V-11: foto que ainda não foi conferida não vai junto');
select lives_ok($$ select publico_prestador_verificar_foto(r ->> 'codigo', f, true, 980, null) from lk, foto $$, 'V-11: a foto é conferida e liberada');
select is(pg_temp.campos($$ select publico_prestador_terminei(r ->> 'codigo', 'Troquei o rolamento.', true, null, 'Márcio', null) from lk $$),
  '["pendenteTexto"]', 'V-11: se ficou algo para depois, diz o quê');
select lives_ok($$ select publico_prestador_terminei(r ->> 'codigo', 'Troquei o rolamento e testei as duas bombas.', false, null, 'Márcio', array[f]) from lk, foto $$,
  'V-11: o prestador conta o que fez, com a foto');
select is((select estado from manutencoes where id = (select m1 from m)), 'PLANEJADA', 'V-11: terminar pelo link não conclui a manutenção');
select is(jsonb_array_length(plataforma_link_prestador(fabio, ipe, m1) -> 'fotos'), 1, 'V-11: quem vê a manutenção vê as fotos do prestador') from ids, c, m;
select is((select array_agg(x ->> 'tipo' order by x ->> 'tipo') from jsonb_array_elements(plataforma_link_prestador(fabio, ipe, m1) -> 'registros') x
            where x ->> 'tipo' <> 'CHEGOU'), array['IMPEDIMENTO', 'TERMINOU'], 'V-11: a manutenção mostra o que o prestador mandou') from ids, c, m;
select ok(exists (select 1 from historico where acao = 'manutencao.prestador_terminou' and entidade_id = (select m1::text from m)),
  'V-11: o terminei fica no histórico da manutenção');

-- Mandar de novo, cancelar e concluir.
create temp table lk2 as select plataforma_criar_link_prestador(ana, ipe, m1, pg_temp.vm(m1),
  'Voltar para testar as duas bombas em revezamento.', null, null, hoje + 7, null) as r from ids, c, m, d;
select is(publico_prestador(r ->> 'codigo') ->> 'encerrado', 'true', 'V-11: mandar de novo para o link anterior') from lk;
select throws_ok($$ select publico_prestador_chegada(r ->> 'codigo', null) from lk $$, 'TC422', null, 'V-11: o link anterior não recebe mais nada');
select is(pg_temp.campos($$ select plataforma_cancelar_link_prestador(ana, ipe, m1, (r ->> 'id')::uuid, '') from ids, c, m, lk2 $$), '["motivo"]',
  'V-11: cancelar o link pede motivo');
select lives_ok($$ select plataforma_cancelar_link_prestador(ana, ipe, m1, (r ->> 'id')::uuid, 'Serviço remarcado com outro prestador') from ids, c, m, lk2 $$,
  'V-11: cancelar com motivo');
select is(publico_prestador(r ->> 'codigo') ->> 'motivo', 'CANCELADO', 'V-11: o link cancelado diz que foi cancelado') from lk2;
create temp table lk3 as select plataforma_criar_link_prestador(ana, ipe, m1, pg_temp.vm(m1),
  'Voltar para testar as duas bombas em revezamento.', null, null, hoje + 7, null) as r from ids, c, m, d;
select plataforma_concluir_manutencao(ana, ipe, m1, pg_temp.vm(m1), 'Rolamento trocado e bombas testadas pelo prestador.', hoje, true) from ids, c, m, d;
select is(publico_prestador(r ->> 'codigo') ->> 'motivo', 'CONCLUIDA', 'V-11: com a manutenção concluída, o link para') from lk3;

select * from finish();
rollback;

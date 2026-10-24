-- Documentos e memória com banco (0294; MP-12, MP-05, CT-02, CT-03): o histórico do prontuário
-- (decisão D.1), o arquivo do contrato do prestador em Documentos (D.2) e a linha do tempo com
-- busca e período (D.3).
begin;
select plan(36);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.pessoa('Síndica Ana') as ana,
  teste.pessoa('Gil') as gil,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  plataforma_autorizar_pessoa(ana, ipe, gil, 'Gil', 'Administração', array['DOCUMENTOS']) as v_gil,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Zeladora', array['MANUTENCAO']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_COMUNICADOS']) as v_fabio
  from ids, c;
create temp table d as select (app_now() at time zone 'America/Sao_Paulo')::date as hoje;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.documento(p_tipo text, p_titulo text, p_vale date, p_restrito boolean default false) returns uuid
language plpgsql as $$
declare v_doc uuid; v_ver uuid;
begin
  v_doc := (plataforma_salvar_documento((select ana from ids), (select ipe from c), null, null, p_tipo, p_titulo, null, p_restrito, false, p_vale) ->> 'id')::uuid;
  v_ver := (plataforma_iniciar_versao_documento((select ana from ids), (select ipe from c), v_doc, 'contrato-2026.pdf', 'application/pdf', 2000, null,
            '2025-04-12', null) ->> 'versaoId')::uuid;
  perform plataforma_verificar_versao_documento((select ana from ids), (select ipe from c), v_doc, v_ver, true, 1990, null);
  return v_doc;
end $$;

-- ---------------------------------------------------------------------------------------
-- 1. Histórico do prontuário (D.1).
create temp table dc as select
  pg_temp.documento('OUTRO', 'Apólice 2025', hoje + 40) as apolice25,
  pg_temp.documento('OUTRO', 'Apólice 2026', hoje + 400) as apolice26,
  pg_temp.documento('LAUDO', 'AVCB 2025', hoje - 16) as avcb,
  pg_temp.documento('LAUDO', 'Laudo restrito', hoje + 300, true) as restrito
  from d;
select plataforma_item_prontuario(ana, ipe, null, 'SEGURO', null, 'LIGAR', null, null, apolice25, null, null) from ids, c, dc;
select ajustar_relogio(interval '1 minutes');
select plataforma_item_prontuario(ana, ipe, (select id from itens_prontuario where chave = 'SEGURO'), null,
         (select versao from itens_prontuario where chave = 'SEGURO'), 'DESLIGAR', null, null, null, null, null) from ids, c;
select ajustar_relogio(interval '2 minutes');
select plataforma_item_prontuario(ana, ipe, (select id from itens_prontuario where chave = 'SEGURO'), null,
         (select versao from itens_prontuario where chave = 'SEGURO'), 'LIGAR', null, null, apolice26, 30, null) from ids, c, dc;
select ajustar_relogio(interval '3 minutes');
select plataforma_item_prontuario(ana, ipe, null, 'AVCB', null, 'LIGAR', null, null, avcb, null, null) from ids, c, dc;
select ajustar_relogio(interval '4 minutes');
select plataforma_item_prontuario(ana, ipe, null, 'SPDA', null, 'LIGAR', null, null, restrito, null, null) from ids, c, dc;
select ajustar_relogio(interval '5 minutes');
select plataforma_item_prontuario(ana, ipe, null, 'AGUA', null, 'NAO_SE_APLICA', null, null, null, null, 'Prédio sem poço') from ids, c;

create temp table hi as select
  plataforma_historico_prontuario(ana, ipe) as tudo,
  plataforma_historico_prontuario(ana, ipe, (select id from itens_prontuario where chave = 'SEGURO')) as seguro,
  plataforma_historico_prontuario(fabio, ipe, (select id from itens_prontuario where chave = 'SPDA')) as spda_gil
  from ids, c;
select is((select jsonb_array_length(tudo -> 'eventos') from hi), 7, 'D.1: seis mudanças e o que venceu');
select is((select tudo -> 'eventos' -> 0 ->> 'acao' from hi), 'NAO_SE_APLICA', 'D.1: do mais novo ao mais antigo');
select is((select string_agg(x ->> 'acao', ', ' order by o desc) from hi, jsonb_array_elements(seguro -> 'eventos') with ordinality x(x, o)),
  'LIGAR, DESLIGAR, LIGAR', 'D.1: com o item, só as mudanças dele');
select is((select seguro -> 'eventos' -> 0 ->> 'documento' from hi), 'Apólice 2026', 'D.1: o documento ligado vem pelo título');
select is((select (seguro -> 'eventos' -> 0 ->> 'avisarDias')::integer from hi), 30, 'D.1: e quantos dias antes avisa');
select is((select seguro -> 'eventos' -> 0 ->> 'autor' from hi), 'Síndica Ana', 'D.1: com quem fez');
select is((select seguro -> 'item' ->> 'nome' from hi), 'Apólice do seguro obrigatório', 'D.1: o item escolhido vem com o nome');
select is((select x ->> 'item' from hi, jsonb_array_elements(tudo -> 'eventos') x where x ->> 'acao' = 'VENCEU'), 'AVCB (Corpo de Bombeiros)',
  'D.1: o que venceu entra sozinho, pela data');
select is((select x ->> 'motivo' from hi, jsonb_array_elements(tudo -> 'eventos') x where x ->> 'acao' = 'NAO_SE_APLICA'), 'Prédio sem poço',
  'D.1: o não se aplica traz o motivo');
select is((select spda_gil -> 'eventos' -> 0 ->> 'documento' from hi), 'documento restrito', 'D.1: quem não vê restritos não vê o título');
select ok((select jsonb_array_length(tudo -> 'itens') >= 4 from hi), 'D.1: a lista de itens para escolher');
select throws_ok($$ select plataforma_historico_prontuario(bruna, ipe) from ids, c $$, 'TC401', null, 'D.1: quem não vê documentos não vê o histórico');
select throws_ok($$ select plataforma_historico_prontuario(ana, ipe, gen_random_uuid()) from ids, c $$, 'TC404', null, 'D.1: item que não existe');
select is((select jsonb_array_length(plataforma_historico_prontuario(ana, ipe, null, ((tudo -> 'eventos' -> 2 ->> 'quando'))::timestamptz) -> 'eventos')
             from ids, c, hi), 4, 'D.1: Ver mais antigos continua de onde parou');
-- Muitas mudanças no mesmo instante: a página leva todas as empatadas e Ver mais antigos não pula nenhuma.
insert into historico (ocorrido_em, condominio_id, autor_tipo, autor_id, acao, entidade, entidade_id, dados)
select app_now() + interval '1 hour', ipe, 'PESSOA', ana, 'prontuario.vale', 'itens_prontuario', i.id::text, '{}'::jsonb
  from ids, c, itens_prontuario i, generate_series(1, 60) where i.chave = 'SEGURO';
create temp table pg as select plataforma_historico_prontuario(ana, ipe) as p1 from ids, c;
select is((select jsonb_array_length(p1 -> 'eventos') from pg), 60, 'D.1: o empate no corte vem inteiro na mesma página');
select is((select jsonb_array_length(plataforma_historico_prontuario(ana, ipe, null, (p1 ->> 'maisAntigosAntes')::timestamptz) -> 'eventos') from ids, c, pg),
  7, 'D.1: e a página seguinte traz o resto, sem pular');

-- ---------------------------------------------------------------------------------------
-- 2. O contrato do prestador (D.2).
create temp table pr as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'HidroPress Bombas', 'Bombas', 'Marcos', '+5513998124455', null, null,
     'CONTRATO', (select hoje from d) + 200, null, null, null) ->> 'id')::uuid as hidro,
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Verde Vivo', 'Jardim', null, null, null, null,
     'CHAMADO', null, null, null, null) ->> 'id')::uuid as verde
  from ids, c;
create temp table ct as select pg_temp.documento('CONTRATO', 'Contrato com a HidroPress', null) as contrato,
                               pg_temp.documento('ATA', 'Ata de março', null) as ata;

select is(pg_temp.motivo($$ select plataforma_ligar_contrato_prestador(ana, ipe, verde, (select versao from prestadores where id = verde), contrato)
                            from ids, c, pr, ct $$), 'SEM_CONTRATO', 'D.2: só prestador com contrato tem o arquivo');
select is(pg_temp.campos($$ select plataforma_ligar_contrato_prestador(ana, ipe, hidro, (select versao from prestadores where id = hidro), ata)
                            from ids, c, pr, ct $$), '["documentoId"]', 'D.2: o documento precisa ser do tipo Contrato');
select throws_ok($$ select plataforma_ligar_contrato_prestador(bruna, ipe, hidro, 1, contrato) from ids, c, pr, ct $$, 'TC401', null,
  'D.2: quem só cuida da manutenção não guarda documento');
select lives_ok($$ select plataforma_ligar_contrato_prestador(ana, ipe, hidro, (select versao from prestadores where id = hidro), contrato)
                  from ids, c, pr, ct $$, 'D.2: liga o contrato ao prestador');
select is((select vale_ate from documentos, ct where id = contrato), (select hoje + 200 from d), 'D.2: o documento ganha a data de fim do prestador');
select is((select plataforma_prestador(ana, ipe, hidro) -> 'prestador' -> 'contratoDocumento' ->> 'arquivo' from ids, c, pr), 'contrato-2026.pdf',
  'D.2: a ficha traz o arquivo do contrato');
select is((select x -> 'contratoDocumento' ->> 'titulo' from ids, c, jsonb_array_elements(plataforma_prestadores(ana, ipe, false) -> 'itens') x
            where x ->> 'nome' = 'HidroPress Bombas'), 'Contrato com a HidroPress', 'D.2: a lista também, para o atalho Contratos');
select ok((select (plataforma_prestador(bruna, ipe, hidro) -> 'prestador' -> 'contratoDocumento' ->> 'oculto')::boolean from ids, c, pr),
  'D.2: quem não vê documentos sabe que existe, sem o arquivo');

update documentos set vale_ate = (select hoje + 365 from d) where id = (select contrato from ct);
select is((select contrato_ate from prestadores, pr where id = hidro), (select hoje + 365 from d), 'D.2: mudar no documento muda no prestador');
select lives_ok($$ select plataforma_ligar_contrato_prestador(ana, ipe, hidro, (select versao from prestadores where id = hidro), contrato, (select hoje + 500 from d))
                  from ids, c, pr, ct $$, 'D.2: enviar a versão nova pode mudar a data de fim');
select is((select vale_ate from documentos, ct where id = contrato), (select hoje + 500 from d), 'D.2: e a data vale para os dois');
select is((select count(*)::integer from historico where acao = 'prestador.contrato_ligado'), 2, 'D.2: cada ligação fica no histórico');
update documentos set vale_ate = null where id = (select contrato from ct);
select is((select contrato_ate from prestadores, pr where id = hidro), null::date, 'D.2: apagar a data no documento apaga no prestador');

-- Enviar o contrato guarda e liga numa transação só.
create temp table aq as select
  (plataforma_salvar_prestador(ana, ipe, null, null, 'Aqualimp', 'Reservatórios', null, null, null, null,
     'CONTRATO', (select hoje from d) + 90, null, null, null) ->> 'id')::uuid as aqua from ids, c;
select throws_ok($$ select plataforma_guardar_contrato_prestador(ana, ipe, aqua, 99, 'Contrato com Aqualimp', null, false, null) from ids, c, aq $$,
  'TC409', null, 'D.2: com a versão velha, recusa antes de guardar');
select is((select count(*)::integer from documentos where titulo = 'Contrato com Aqualimp'), 0, 'D.2: e não sobra documento solto');
create temp table g1 as select (plataforma_guardar_contrato_prestador(ana, ipe, aqua, (select versao from prestadores where id = aqua),
  'Contrato com Aqualimp', null, false, null) ->> 'id')::uuid as doc from ids, c, aq;
select is((select vale_ate from documentos, g1 where id = doc), (select hoje + 90 from d), 'D.2: guarda, liga e leva a data do prestador');
select plataforma_salvar_prestador(ana, ipe, aqua, (select versao from prestadores where id = aqua), 'Aqualimp', 'Reservatórios', null, null, null, null,
  'CHAMADO', null, null, null, null) from ids, c, aq;
select plataforma_salvar_prestador(ana, ipe, aqua, (select versao from prestadores where id = aqua), 'Aqualimp', 'Reservatórios', null, null, null, null,
  'CONTRATO', (select hoje from d) + 120, null, null, null) from ids, c, aq;
select is((select (plataforma_guardar_contrato_prestador(ana, ipe, aqua, (select versao from prestadores where id = aqua),
  'Contrato com Aqualimp', null, false, null) ->> 'id')::uuid from ids, c, aq), (select doc from g1),
  'D.2: o acordo que foi e voltou reaproveita o mesmo contrato, sem título repetido');

-- ---------------------------------------------------------------------------------------
-- 3. A linha do tempo com busca e período (D.3).
select plataforma_salvar_anotacao(ana, ipe, null, null, 'COMBINADO', 'Bomba 2 com ruído', 'Esperar a peça; a bomba 1 trabalha sozinha.',
                                  (select hoje - 30 from d), null, null, null) from ids, c;
select plataforma_salvar_anotacao(ana, ipe, null, null, 'DECISAO', 'Pintura do muro', 'Cada lado paga metade.',
                                  (select hoje - 400 from d), null, null, null) from ids, c;
select is((select string_agg(x ->> 'titulo', ', ') from ids, c,
            jsonb_array_elements(plataforma_linha_do_tempo(ana, ipe, 'ANOTADO', null, 'BOMBA', null, null) -> 'eventos') x),
  'Bomba 2 com ruído', 'D.3: a busca olha o título e o texto, sem diferença de maiúscula');
select is((select jsonb_array_length(plataforma_linha_do_tempo(ana, ipe, 'ANOTADO', null, null, (select hoje - 100 from d), null) -> 'eventos') from ids, c),
  1, 'D.3: o período deixa de fora o que veio antes');
select is(pg_temp.campos($$ select plataforma_linha_do_tempo(ana, ipe, 'TUDO', null, null, '2026-03-01', '2026-02-01') from ids, c $$), '["ate"]',
  'D.3: o fim do período não vem antes do começo');

select * from finish();
rollback;

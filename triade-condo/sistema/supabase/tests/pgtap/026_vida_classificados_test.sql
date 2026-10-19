-- Vida em condomínio: classificados entre moradores (peça R12; AC-05, CD-12, W-20, W-22).
-- O morador manda ANUNCIAR, escolhe o tipo com número, manda o texto e a foto e diz se o WhatsApp
-- aparece. Quem cuida dos classificados publica com título e valor, recusa com motivo ou tira do
-- mural; a decisão vai ao morador. Publicado, fica 30 dias na aba Classificados do mural, com o
-- primeiro nome e o bloco. O relógio fica numa quarta-feira, 03/03/2027.
begin;
select plan(56);

select ajustar_relogio(timestamptz '2027-03-03 12:00:00-03' - now());

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.pessoa('Ana Lopes') as ana,
  teste.pessoa('Bruna') as bruna,
  teste.pessoa('Fábio') as fabio,
  teste.pessoa('Síndico Davi') as davi;
create temp table c as select
  console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe,
  console_criar_condominio(adm, 'Edifício Jatobá', 'Rio Branco', 'AC', null) as jatoba
  from ids;
select console_atribuir(adm, ipe, impl, 'IMPLANTACAO') from ids, c;
select console_editar_ficha(impl, ipe, (select versao from condominios where id = ipe), 'Residencial Ipê', 'Brasília', 'DF', null,
                            '+5561998124400', '[]') from ids, c;
create temp table vs as select
  teste.vincular(ana, ipe) as v_ana,
  teste.vincular(davi, jatoba) as v_davi,
  plataforma_autorizar_pessoa(ana, ipe, bruna, 'Bruna', 'Secretária', array['VER_CLASSIFICADOS']) as v_bruna,
  plataforma_autorizar_pessoa(ana, ipe, fabio, 'Fábio', 'Conselho', array['VER_AGENDA']) as v_fabio
  from ids, c;
update horarios set intervalos = (select jsonb_agg(jsonb_build_object('dia', d, 'inicio', '00:00', 'fim', '24:00')) from generate_series(0, 6) d)
 where tipo in ('ATENDIMENTO', 'FUNCIONAMENTO');

create temp table bl as select (plataforma_salvar_bloco(ana, ipe, null, null, 'Torre A', 1, true) ->> 'id')::uuid as ba from ids, c;
select plataforma_incluir_unidades(ana, ipe, ba, '[{"identificacao": "101"}, {"identificacao": "102"}]') from ids, c, bl;
create temp table u as select
  (select id from unidades where identificacao = '101') as u101,
  (select id from unidades where identificacao = '102') as u102;
create temp table vin as select
  plataforma_incluir_pessoa_unidade(ana, ipe, u101, null, 'Marta Souza', '+5561999990001', '{"proprietario": true, "principal": true, "mora": true}', true) as marta,
  plataforma_incluir_pessoa_unidade(ana, ipe, u102, null, 'Rui Lima', '+5561977771212', '{"proprietario": true, "principal": true, "mora": true}', true) as rui
  from ids, c, u;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create temp table seq (n integer);
insert into seq values (0);
create function pg_temp.msg(p_tel text, p_texto text, p_midia text default null) returns jsonb language plpgsql as $$
declare v_n integer;
begin
  update seq set n = n + 1 returning n into v_n;
  return whatsapp_receber((select segredo from g), 'ipe-inst',
    jsonb_strip_nulls(jsonb_build_object('id', 'M' || v_n, 'telefone', p_tel, 'enviadaEm', app_now(), 'texto', p_texto,
      'tipo', case when p_midia is null then 'TEXTO' when p_midia like 'image/%' then 'IMAGEM' else 'VIDEO' end,
      'midia', case when p_midia is not null then jsonb_build_object('url', 'https://provedor.invalid/m' || v_n, 'tipo', p_midia) end)));
end $$;
create temp table vistos (id uuid primary key);
create function pg_temp.ultima(p_tel text) returns text language plpgsql as $$
declare v text;
begin
  select string_agg(texto, ' | ' order by criado_em, id) into v from envios_whatsapp e
   where para = p_tel and not exists (select 1 from vistos where id = e.id);
  insert into vistos select id from envios_whatsapp e where para = p_tel on conflict do nothing;
  return v;
end $$;
create function pg_temp.diz(p_tel text, p_texto text, p_midia text default null) returns text language plpgsql as $$
begin
  perform pg_temp.ultima(p_tel);
  perform pg_temp.msg(p_tel, p_texto, p_midia);
  return pg_temp.ultima(p_tel);
end $$;
-- Um anúncio inteiro de uma vez.
create function pg_temp.anunciar(p_tel text, p_tipo text, p_texto text, p_sim text) returns text language plpgsql as $$
begin
  perform pg_temp.diz(p_tel, 'ANUNCIAR');
  perform pg_temp.diz(p_tel, p_tipo);
  perform pg_temp.diz(p_tel, p_texto);
  return pg_temp.diz(p_tel, p_sim);
end $$;
create function pg_temp.etapa(p_tel text) returns text language sql as $$ select etapa from conversas_whatsapp where telefone = p_tel $$;
create function pg_temp.cl(p_texto text) returns classificados language sql as $$ select * from classificados where texto = p_texto $$;
create function pg_temp.lista() returns jsonb language sql as $$
  select plataforma_classificados((select ana from ids), (select ipe from c)) $$;
create function pg_temp.mural() returns jsonb language sql as $$
  select publico_mural(mural_codigo) from configuracao_condominio where condominio_id = (select ipe from c) $$;
create function pg_temp.vcfg() returns integer language sql as $$ select versao from configuracao_condominio where condominio_id = (select ipe from c) $$;

-- Conectado, com o termo aceito, e o mural ligado.
create temp table g as select console_whatsapp_credenciais(impl, ipe, null, 'ipe-inst', decode(repeat('ab', 40), 'hex')) ->> 'segredo' as segredo
  from ids, c;
select plataforma_aceitar_termo_whatsapp(ana, ipe) from ids, c;
select console_whatsapp_situacao(impl, ipe, 'CONECTADO', '5561998124400', null) from ids, c;
select plataforma_definir_mural_email(ana, ipe, pg_temp.vcfg(), true, array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE'], false,
                                      null, false, false) from ids, c;

-- Permissões e modelo (CF-03, W-20).
select is((select count(*)::integer from permissoes where codigo in ('VER_CLASSIFICADOS', 'CLASSIFICADOS')), 2,
  'AC-05: Ver os classificados e Cuidar dos classificados entram em Pessoas e acesso');
select is((select situacao from modelos_whatsapp where chave = 'anuncio_decidido'), 'APROVADO_PILOTO',
  'W-20: o modelo anuncio_decidido entra aprovado para o piloto');

-- ANUNCIAR, passo a passo (decisão 6).
select is(pg_temp.diz('+5561999990001', 'anunciar'),
  E'Olá, Marta. O anúncio vai para o mural do Residencial Ipê por 30 dias, depois que o condomínio aprovar. É:\n\n1. Vendo\n2. Doo\n3. Procuro\n4. Serviço de morador',
  'AC-05: ANUNCIAR começa com o prazo e os tipos com número');
select is(pg_temp.etapa('+5561999990001'), 'ANUNCIO_TIPO', 'W-22: a conversa fica na etapa do tipo');
select is(pg_temp.diz('+5561999990001', 'bicicleta'), 'Responda só com o número do tipo, de 1 a 4, ou SAIR.',
  'W-22: a Nina não tenta entender texto livre no tipo');
select is(pg_temp.diz('+5561999990001', '1'), 'Mande o texto do anúncio, com o preço, e uma foto se quiser.',
  'AC-05: no Vendo, a Nina pede o texto com o preço');
select is(pg_temp.diz('+5561999990001', null, 'video/mp4'), 'No anúncio, mande só texto e foto. Para desistir, SAIR.',
  'AC-05: vídeo não entra no anúncio');
select is(pg_temp.diz('+5561999990001', null, 'image/jpeg'), 'Foto recebida. Agora mande o texto do anúncio.',
  'AC-05: a foto sem texto fica guardada e a Nina pede o texto');
select is(pg_temp.diz('+5561999990001', 'oi'), 'O texto do anúncio precisa ter de 3 a 1.000 letras. Mande de novo, ou SAIR.',
  'AC-05: texto curto demais volta');
select is(pg_temp.diz('+5561999990001', 'Bicicleta aro 29, pouco usada, R$ 900'),
  'Quer que o seu WhatsApp apareça no anúncio para quem se interessar? Responda SIM ou NÃO. Com NÃO, quem se interessar fala com o condomínio, que passa o recado.',
  'AC-05: depois do texto, a Nina pergunta se o telefone aparece');
select is(pg_temp.diz('+5561999990001', 'pode ser'), 'Responda SIM ou NÃO, ou SAIR.', 'W-22: só SIM ou NÃO');
select is(pg_temp.diz('+5561999990001', 'sim'),
  E'Anúncio enviado para aprovação. Aviso aqui quando estiver no mural.\n\nNina, assistente virtual do Residencial Ipê',
  'AC-05: o anúncio vai para aprovação');
select is((select (tipo, estado, mostrar_telefone, foto_mensagem_id is not null, rotulo_unidade(unidade_id))::text
             from pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')),
  '(VENDO,A_APROVAR,t,t,"Torre A · 101")', 'AC-05: o anúncio guarda tipo, unidade, foto e o SIM do telefone');
select is(pg_temp.etapa('+5561999990001'), 'INICIO', 'W-22: a conversa volta ao começo');
select is((select count(*)::integer from historico where acao = 'classificado.enviado'), 1, 'AC-05: o envio fica no histórico');

-- Doo, com a foto depois do texto e NÃO.
select pg_temp.diz('+5561977771212', 'ANUNCIAR');
select is(pg_temp.diz('+5561977771212', '2'), 'Mande o texto do anúncio e uma foto se quiser.', 'AC-05: na doação, sem pedir preço');
select pg_temp.diz('+5561977771212', 'Berço de madeira com colchão. Retirar na Torre A.');
select is(left(pg_temp.diz('+5561977771212', null, 'image/png'), 36), 'Foto recebida. Quer que o seu WhatsA',
  'AC-05: a foto que chega depois do texto ainda entra');
select pg_temp.diz('+5561977771212', 'não');
select is((select (tipo, mostrar_telefone, foto_mensagem_id is not null)::text from pg_temp.cl('Berço de madeira com colchão. Retirar na Torre A.')),
  '(DOO,f,t)', 'AC-05: com NÃO, o telefone não aparece');

-- SAIR, a palavra de outra coisa no meio e o prazo da conversa.
select pg_temp.diz('+5561977771212', 'ANUNCIAR');
select is(pg_temp.diz('+5561977771212', 'sair'), 'Tudo bem, o anúncio não foi enviado. Para começar de novo, mande ANUNCIAR.',
  'W-22: SAIR desiste do anúncio');
select pg_temp.diz('+5561977771212', 'ANUNCIAR');
select pg_temp.diz('+5561977771212', 'RESERVAR');
select ok(pg_temp.etapa('+5561977771212') not like 'ANUNCIO%', 'W-22: RESERVAR no meio do anúncio fecha o anúncio e segue para a reserva');
select pg_temp.diz('+5561977771212', 'ANUNCIAR');
select ajustar_relogio(timestamptz '2027-03-03 12:40:00-03' - now());
select pg_temp.diz('+5561977771212', '3');
select ok(pg_temp.etapa('+5561977771212') not like 'ANUNCIO%', 'W-22: depois de 30 minutos parado, o anúncio expira');
select is((select count(*)::integer from classificados), 2, 'W-22: nenhum desses virou anúncio');
select pg_temp.diz('+5561955550000', 'ANUNCIAR');
select ok(coalesce(pg_temp.etapa('+5561955550000'), '') not like 'ANUNCIO%', 'AC-05: telefone sem cadastro segue o atendimento de sempre');

-- Até 3 anúncios por pessoa.
select pg_temp.anunciar('+5561999990001', '4', 'Aulas de violão para crianças. Sábados de manhã.', 'SIM');
select pg_temp.anunciar('+5561999990001', '3', 'Procuro babá para as tardes', 'NAO');
select is(pg_temp.diz('+5561999990001', 'ANUNCIAR'),
  'Você já tem 3 anúncios no mural ou esperando aprovação. Quando um sair, dá para anunciar de novo.',
  'AC-05: cada pessoa tem até 3 anúncios ao mesmo tempo');

-- A aba Classificados (decisão 14).
select is((select pg_temp.lista() ->> 'aAprovar'), '4', 'AC-05: quatro anúncios a aprovar');
select is((select x ->> 'tituloSugerido' from jsonb_array_elements(pg_temp.lista() -> 'classificados') x where x ->> 'tipo' = 'VENDO'),
  'Vendo bicicleta aro 29', 'AC-05: o título sugerido junta o tipo e o começo do texto');
select is((select x ->> 'valorSugerido' from jsonb_array_elements(pg_temp.lista() -> 'classificados') x where x ->> 'tipo' = 'VENDO'),
  '90000', 'AC-05: o valor sugerido vem do R$ do texto');
select is((select x ->> 'foto' from jsonb_array_elements(pg_temp.lista() -> 'classificados') x where x ->> 'tipo' = 'VENDO'), 'false',
  'AC-05: a foto só aparece depois de baixada e conferida');
select whatsapp_midia_resultado(ipe, foto_mensagem_id, 20480, null) from c, classificados where foto_mensagem_id is not null;
select is((select x ->> 'foto' from jsonb_array_elements(pg_temp.lista() -> 'classificados') x where x ->> 'tipo' = 'VENDO'), 'true',
  'AC-05: a foto conferida aparece no anúncio');
select is((select plataforma_foto_classificado(ana, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id) ->> 'tipo' from ids, c),
  'image/jpeg', 'AC-05: a tela abre a foto por link');
select is((select plataforma_classificados(bruna, ipe) -> 'pode' ->> 'editar' from ids, c), 'false', 'CF-03: quem só vê não publica');
select throws_ok($$ select plataforma_classificados(fabio, ipe) from ids, c $$, 'TC401', null, 'CF-03: sem a permissão, não vê os anúncios');
select throws_ok($$ select plataforma_publicar_classificado(bruna, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id, 1, 'Vendo bicicleta', null)
  from ids, c $$, 'TC401', null, 'CF-03: publicar pede Cuidar dos classificados');
select is((select jsonb_array_length(plataforma_classificados(davi, jatoba) -> 'classificados') from ids, c), 0,
  'AC-05: os anúncios de um condomínio não aparecem em outro');

-- Publicar, recusar e tirar do mural, com a decisão ao morador.
select is(pg_temp.campos($$ select plataforma_publicar_classificado(ana, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id, 1, ' ab ', null)
  from ids, c $$), '["titulo"]', 'AC-05: publicar pede o título');
select throws_ok($$ select plataforma_publicar_classificado(ana, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id, 7, 'Vendo bicicleta', null)
  from ids, c $$, 'TC409', null, 'AC-05: versão velha não publica');
select is((select plataforma_publicar_classificado(ana, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id, 1,
                                                   'Vendo bicicleta  aro 29', 90000) ->> 'noMuralAte' from ids, c),
  '2027-04-02', 'AC-05: publicado, fica 30 dias no mural');
select is((select (finalidade, modelo_chave, classificado_id is not null, texto)::text from envios_whatsapp
            where para = '+5561999990001' and finalidade = 'CLASSIFICADO'),
  '(CLASSIFICADO,anuncio_decidido,t,"Sobre o seu anúncio no mural: está no mural até 02/04, com o título ""Vendo bicicleta aro 29"". Quem se interessar fala com você por aqui.

Ana, do condomínio")', 'W-20: a publicação vai ao morador, pelo modelo quando a conversa estiver fechada');
select is(pg_temp.motivo($$ select plataforma_publicar_classificado(ana, ipe, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id, 2, 'Outro título', null)
  from ids, c $$), 'ANUNCIO_DECIDIDO', 'AC-05: anúncio decidido não se decide de novo');
select plataforma_publicar_classificado(ana, ipe, (pg_temp.cl('Berço de madeira com colchão. Retirar na Torre A.')).id, 1, 'Doo berço de madeira', null)
  from ids, c;
select is(pg_temp.campos($$ select plataforma_recusar_classificado(ana, ipe, (pg_temp.cl('Procuro babá para as tardes')).id, 1, '')
  from ids, c $$), '["motivo"]', 'AC-05: recusar pede motivo');
select is((select plataforma_recusar_classificado(ana, ipe, (pg_temp.cl('Procuro babá para as tardes')).id, 1, 'Serviço de fora do prédio') ->> 'estado'
             from ids, c), 'RECUSADO', 'AC-05: o anúncio recusado não vai ao mural');
select ok((select texto from envios_whatsapp where para = '+5561999990001' and finalidade = 'CLASSIFICADO' order by criado_em desc, id desc limit 1)
  like '%não foi publicado. Motivo: Serviço de fora do prédio%', 'AC-05: o motivo da recusa vai ao morador');
select is((select count(*)::integer from historico where acao in ('classificado.publicado', 'classificado.recusado')), 3,
  'AC-05: cada decisão fica no histórico');

-- O mural (CD-12): primeiro nome e bloco, telefone só com SIM, foto por link.
select is((select jsonb_array_length(pg_temp.mural() -> 'classificados')), 2, 'CD-12: os anúncios publicados aparecem no mural');
select is((select x - 'id' from jsonb_array_elements(pg_temp.mural() -> 'classificados') x where x ->> 'tipo' = 'VENDO'),
  '{"ate": "2027-04-02", "foto": true, "quem": "Marta", "tipo": "VENDO", "bloco": "Torre A", "texto": "Bicicleta aro 29, pouco usada, R$ 900", "titulo": "Vendo bicicleta aro 29", "whatsapp": "5561999990001", "valorCentavos": 90000}'::jsonb,
  'CD-12: no mural vão o primeiro nome e o bloco, nunca a unidade, e o WhatsApp com SIM');
select ok((select not (x ? 'whatsapp') from jsonb_array_elements(pg_temp.mural() -> 'classificados') x where x ->> 'tipo' = 'DOO'),
  'CD-12: sem o SIM, o telefone não aparece');
select is((select publico_mural_classificado_foto(mural_codigo, (pg_temp.cl('Bicicleta aro 29, pouco usada, R$ 900')).id) ->> 'tipo'
             from configuracao_condominio where condominio_id = (select ipe from c)), 'image/jpeg', 'CD-12: a foto do anúncio abre pelo mural');
select throws_ok($$ select publico_mural_classificado_foto(mural_codigo, (pg_temp.cl('Procuro babá para as tardes')).id)
  from configuracao_condominio where condominio_id = (select ipe from c) $$, 'TC404', null, 'CD-12: anúncio fora do mural não mostra foto');

-- O painel.
select is((select plataforma_painel(ana, ipe) -> 'vida' ->> 'classificadosAAprovar' from ids, c), '1', 'AC-05: o Início mostra os anúncios a aprovar');
select ok((select not coalesce(plataforma_painel(fabio, ipe) -> 'vida' ? 'classificadosAAprovar', false) from ids, c),
  'AC-05: só para quem vê os classificados');

-- Tirar do mural e o prazo de 30 dias.
select is((select plataforma_tirar_classificado(ana, ipe, (pg_temp.cl('Berço de madeira com colchão. Retirar na Torre A.')).id, 2, null) ->> 'estado'
             from ids, c), 'RETIRADO', 'AC-05: o anúncio pode sair do mural antes do prazo');
select is((select jsonb_array_length(pg_temp.mural() -> 'classificados')), 1, 'CD-12: o anúncio tirado sai do mural na hora');
select is(pg_temp.motivo($$ select plataforma_tirar_classificado(ana, ipe, (pg_temp.cl('Berço de madeira com colchão. Retirar na Torre A.')).id, 3, null)
  from ids, c $$), 'ANUNCIO_FORA_DO_MURAL', 'AC-05: o que não está no mural não sai de novo');
select ajustar_relogio(timestamptz '2027-04-03 09:00:00-03' - now());
select is((select x ->> 'estado' from jsonb_array_elements(pg_temp.lista() -> 'classificados') x where x ->> 'tipo' = 'VENDO'), 'VENCIDO',
  'AC-05: depois dos 30 dias, o anúncio aparece como vencido');
select is((select jsonb_array_length(pg_temp.mural() -> 'classificados')), 0, 'CD-12: e sai do mural sozinho');
select is(left(pg_temp.diz('+5561999990001', 'ANUNCIAR'), 12), 'Olá, Marta. ', 'AC-05: com o vencido, a Marta pode anunciar de novo');

select * from finish();
rollback;

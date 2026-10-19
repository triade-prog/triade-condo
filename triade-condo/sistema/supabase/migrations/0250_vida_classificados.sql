-- 0250 · Vida em condomínio: classificados entre moradores (peça R12; AC-05, CD-12, W-22). Telas e
-- decisões aprovadas pela Carolina em 19/10/2026 (docs/telas/vida.html, tela 9 e decisões 6 e 14).
--
-- Regras desta parte:
-- 1. O morador com unidade confirmada manda ANUNCIAR no WhatsApp do condomínio. A Nina pergunta o
--    tipo com números (Vendo, Doo, Procuro, Serviço de morador), pede o texto e uma foto se ele
--    quiser, e pergunta se o WhatsApp dele aparece no anúncio (SIM ou NÃO). SAIR desiste.
-- 2. Todo anúncio passa por quem cuida dos classificados, que publica (com o título e o valor que
--    aparecem no mural) ou recusa com motivo. Publicado, fica 30 dias na aba Classificados do
--    mural online; pode ser tirado antes. A decisão vai ao morador pelo WhatsApp.
-- 3. O telefone só aparece com SIM; sem isso, o interessado fala com o condomínio. No mural vão o
--    primeiro nome e o bloco, nunca a unidade. O mural avisa que o condomínio não vende nem
--    garante nada.
-- 4. Cada pessoa tem até 3 anúncios esperando aprovação ou no mural ao mesmo tempo.
-- 5. Permissões (CF-03): Ver os classificados e Cuidar dos classificados, dadas pelo síndico.

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_CLASSIFICADOS', 'Ver os classificados', 'Ver os anúncios dos moradores.', 21),
  ('CLASSIFICADOS', 'Cuidar dos classificados', 'Publicar, recusar e tirar do mural os anúncios dos moradores.', 22);
insert into permissao_acoes (permissao, acao) values
  ('VER_CLASSIFICADOS', 'classificados.ver'),
  ('CLASSIFICADOS', 'classificados.ver'),
  ('CLASSIFICADOS', 'classificados.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'classificados.ver'),
  ('SINDICO', 'classificados.editar');

-- ---------------------------------------------------------------------------------------
-- Classificados (AC-05).

create table classificados (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  contato_id       uuid not null,
  unidade_id       uuid not null,
  tipo             text not null check (tipo in ('VENDO', 'DOO', 'PROCURO', 'SERVICO')),
  texto            text not null check (length(btrim(texto)) between 3 and 1000),
  foto_mensagem_id uuid references mensagens_whatsapp (id),
  mostrar_telefone boolean not null,
  estado           text not null default 'A_APROVAR' check (estado in ('A_APROVAR', 'NO_MURAL', 'RECUSADO', 'RETIRADO')),
  titulo           text check (length(btrim(titulo)) between 3 and 80),
  valor_centavos   integer check (valor_centavos between 1 and 100000000),
  no_mural_ate     date,
  motivo           text check (length(btrim(motivo)) between 3 and 500),
  criado_em        timestamptz not null default app_now(),
  decidido_em      timestamptz,
  decidido_por     uuid references pessoas (id),
  retirado_em      timestamptz,
  retirado_por     uuid references pessoas (id),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check ((estado = 'A_APROVAR') = (decidido_em is null)),
  check (estado not in ('NO_MURAL', 'RETIRADO') or (titulo is not null and no_mural_ate is not null)),
  check (estado <> 'RECUSADO' or motivo is not null),
  check ((estado = 'RETIRADO') = (retirado_em is not null))
);
create index classificados_condominio on classificados (condominio_id, criado_em desc);
call proteger_tabela_condominio('classificados');
create trigger classificados_sem_exclusao before delete on classificados for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- WhatsApp: etapas do anúncio, finalidade e modelo novos (W-20, W-22).

alter table conversas_whatsapp drop constraint conversas_whatsapp_etapa_check;
alter table conversas_whatsapp add constraint conversas_whatsapp_etapa_check
  check (etapa in ('INICIO', 'MENU', 'UNIDADE', 'ANEXANDO', 'CONSULTA',
                   'RESERVA_AREA', 'RESERVA_UNIDADE', 'RESERVA_DIA', 'RESERVA_HORARIO', 'RESERVA_CONFIRMAR',
                   'ANUNCIO_TIPO', 'ANUNCIO_TEXTO', 'ANUNCIO_TELEFONE'));

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO'));
alter table envios_whatsapp add column classificado_id uuid;
alter table envios_whatsapp add constraint envios_whatsapp_classificado
  foreign key (classificado_id, condominio_id) references classificados (id, condominio_id);

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido'));

insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('anuncio_decidido', 1, 'Anúncio decidido', 'MORADOR', 'Anúncio publicado, recusado ou tirado do mural, com a conversa fechada',
   '["condomínio", "decisão e detalhes", "quem decidiu"]',
   E'Sobre o seu anúncio no mural do {{1}}: {{2}}\n\n{{3}}, do condomínio\n\nPara anunciar de novo, mande ANUNCIAR.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave = 'anuncio_decidido';

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function tipo_do_anuncio(p_tipo text) returns text
language sql immutable
set search_path = public
as $$ select case p_tipo when 'VENDO' then 'Vendo' when 'DOO' then 'Doação' when 'PROCURO' then 'Procuro' else 'Serviço de morador' end $$;

-- Anúncio no mural agora: publicado e dentro dos 30 dias.
create function anuncio_no_mural(cl classificados) returns boolean
language sql stable
set search_path = public
as $$ select cl.estado = 'NO_MURAL' and cl.no_mural_ate >= hoje_no_condominio() $$;

-- O estado como a tela mostra: o publicado que passou do prazo aparece como vencido.
create function estado_do_anuncio(cl classificados) returns text
language sql stable
set search_path = public
as $$ select case when cl.estado = 'NO_MURAL' and not anuncio_no_mural(cl) then 'VENCIDO' else cl.estado end $$;

-- A foto, só depois de baixada e conferida.
create function foto_do_anuncio(cl classificados) returns mensagens_whatsapp
language sql stable
set search_path = public
as $$
  select m.* from mensagens_whatsapp m
   where m.id = cl.foto_mensagem_id and m.midia_situacao = 'LIBERADA' and m.midia_tipo in ('image/jpeg', 'image/png', 'image/webp')
$$;

-- Título sugerido: o tipo e o começo do texto ("Vendo bicicleta aro 29").
create function titulo_sugerido(cl classificados) returns text
language plpgsql immutable
set search_path = public
as $$
declare v text := btrim(regexp_replace(split_part(regexp_replace(btrim(cl.texto), '[.,;:!?]|\n', '|', 'g'), '|', 1), '\s+', ' ', 'g'));
begin
  if length(v) < 3 then v := left(btrim(regexp_replace(cl.texto, '\s+', ' ', 'g')), 60); end if;
  if cl.tipo in ('VENDO', 'DOO', 'PROCURO') and lower(v) !~ '^(vendo|doo|doa|procuro)' then
    v := case cl.tipo when 'VENDO' then 'Vendo ' when 'DOO' then 'Doo ' else 'Procuro ' end || lower(left(v, 1)) || substr(v, 2);
  else
    v := upper(left(v, 1)) || substr(v, 2);
  end if;
  return btrim(left(v, 80));
end $$;

-- Valor sugerido: o primeiro "R$ 900" ou "R$ 1.150,50" do texto, em centavos.
create function valor_sugerido(cl classificados) returns integer
language plpgsql immutable
set search_path = public
as $$
declare
  v text := substring(cl.texto from 'R\$\s?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]{1,9}(?:,[0-9]{2})?)');
  n numeric;
begin
  if v is null then return null; end if;
  n := replace(replace(v, '.', ''), ',', '.')::numeric * 100;
  return case when n between 1 and 100000000 then n::integer end;
end $$;

create function bloco_da_unidade(p_unidade uuid) returns text
language sql stable
set search_path = public
as $$ select b.nome from unidades u join blocos b on b.id = u.bloco_id where u.id = p_unidade $$;

create function classificado_json(cl classificados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', cl.id, 'tipo', cl.tipo, 'texto', cl.texto, 'estado', estado_do_anuncio(cl),
    'titulo', cl.titulo, 'valorCentavos', cl.valor_centavos, 'noMuralAte', to_char(cl.no_mural_ate, 'YYYY-MM-DD'),
    'tituloSugerido', titulo_sugerido(cl), 'valorSugerido', valor_sugerido(cl),
    'mostrarTelefone', cl.mostrar_telefone, 'foto', (foto_do_anuncio(cl)).id is not null,
    'unidade', jsonb_build_object('id', cl.unidade_id, 'nome', rotulo_unidade(cl.unidade_id)),
    'contato', (select jsonb_build_object('id', ct.id, 'nome', ct.nome) from contatos ct where ct.id = cl.contato_id and ct.dados_removidos_em is null),
    'criadoEm', cl.criado_em,
    'decisao', case when cl.decidido_em is not null then jsonb_build_object('em', cl.decidido_em, 'por', nome_pessoa(cl.decidido_por)) end,
    'retirada', case when cl.retirado_em is not null then jsonb_build_object('em', cl.retirado_em, 'por', nome_pessoa(cl.retirado_por)) end,
    'motivo', cl.motivo, 'versao', cl.versao))
$$;

-- A decisão vai ao morador; fora das 24 horas, pelo modelo anuncio_decidido (decisão 15).
create function avisar_morador_classificado(cl classificados, p_decisao text, p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  ct contatos;
  v_envio uuid;
  v_quem text := nome_curto(nome_pessoa(p_pessoa));
begin
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then return; end if;
  select * into ct from contatos where id = cl.contato_id;
  if ct.id is null or ct.telefone is null or ct.dados_removidos_em is not null then return; end if;
  v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, null, null, 'CLASSIFICADO',
    'Sobre o seu anúncio no mural: ' || p_decisao || E'\n\n' || v_quem || ', do condomínio', p_pessoa, p_pessoa);
  update envios_whatsapp set classificado_id = cl.id, modelo_chave = 'anuncio_decidido',
                             modelo_parametros = jsonb_build_array(nome_do_condominio(), left(p_decisao, 700), v_quem)
   where id = v_envio;
end $$;

-- ---------------------------------------------------------------------------------------
-- Anunciar pelo WhatsApp (decisões 6 e 14; W-22).

create function sair_do_anuncio(c conversas_whatsapp) returns void
language sql
set search_path = public
as $$ update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, vida = null where id = c.id $$;

create function pedir_telefone_anuncio(m mensagens_whatsapp, p_antes text) returns void
language sql
set search_path = public
as $$
  select resposta_vida(m, p_antes || 'Quer que o seu WhatsApp apareça no anúncio para quem se interessar? Responda SIM ou NÃO. '
    || 'Com NÃO, quem se interessar fala com o condomínio, que passa o recado.')
$$;

create function iniciar_anuncio_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[]) returns void
language plpgsql
set search_path = public
as $$
declare
  u record;
begin
  perform sair_do_anuncio(c);
  select * into u from unidades_dos_contatos(p_contatos) limit 1;
  if u.unidade_id is null then
    perform resposta_vida(m, 'Pelo cadastro do condomínio, os anúncios são de quem tem a unidade confirmada. '
      || 'Se o seu cadastro está diferente, fale com o condomínio.');
    return;
  end if;
  if (select count(*) from classificados cl
       where cl.contato_id = any (p_contatos) and (cl.estado = 'A_APROVAR' or anuncio_no_mural(cl))) >= 3 then
    perform resposta_vida(m, 'Você já tem 3 anúncios no mural ou esperando aprovação. Quando um sair, dá para anunciar de novo.');
    return;
  end if;
  update conversas_whatsapp set etapa = 'ANUNCIO_TIPO', etapa_ate = app_now() + interval '30 minutes',
         vida = jsonb_build_object('contato', u.contato_id, 'unidade', u.unidade_id)
   where id = c.id;
  perform resposta_vida(m, 'Olá, ' || nome_curto((select nome from contatos where id = u.contato_id)) || '. O anúncio vai para o mural do '
    || nome_do_condominio() || E' por 30 dias, depois que o condomínio aprovar. É:\n\n1. Vendo\n2. Doo\n3. Procuro\n4. Serviço de morador');
end $$;

-- As etapas do anúncio: tipo, texto (com a foto, se vier) e o SIM ou NÃO do telefone.
create function continuar_anuncio_whatsapp(m mensagens_whatsapp, c conversas_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
  v_texto text := btrim(coalesce(m.texto, ''));
  v_foto boolean := m.tipo = 'IMAGEM' and m.midia_tipo in ('image/jpeg', 'image/png', 'image/webp');
  v_vida jsonb := c.vida;
  v_tipo text;
  cl classificados;
begin
  if v_cmd in ('SAIR', 'SAI', 'CANCELA') then
    perform sair_do_anuncio(c);
    perform resposta_vida(m, 'Tudo bem, o anúncio não foi enviado. Para começar de novo, mande ANUNCIAR.');
    return;
  end if;
  if m.tipo not in ('TEXTO', 'IMAGEM') or (m.tipo = 'IMAGEM' and not v_foto) then
    perform resposta_vida(m, 'No anúncio, mande só texto e foto. Para desistir, SAIR.');
    return;
  end if;
  if c.etapa = 'ANUNCIO_TIPO' then
    v_tipo := case v_texto when '1' then 'VENDO' when '2' then 'DOO' when '3' then 'PROCURO' when '4' then 'SERVICO' end;
    if v_tipo is null then
      perform resposta_vida(m, 'Responda só com o número do tipo, de 1 a 4, ou SAIR.');
      return;
    end if;
    update conversas_whatsapp set etapa = 'ANUNCIO_TEXTO', etapa_ate = app_now() + interval '30 minutes',
           vida = v_vida || jsonb_build_object('tipo', v_tipo)
     where id = c.id;
    perform resposta_vida(m, 'Mande o texto do anúncio' || case when v_tipo in ('VENDO', 'SERVICO') then ', com o preço,' else '' end
      || ' e uma foto se quiser.');
    return;
  end if;
  if v_foto then
    v_vida := v_vida || jsonb_build_object('foto', m.id);
  end if;
  if c.etapa = 'ANUNCIO_TEXTO' then
    if v_texto = '' then
      update conversas_whatsapp set etapa_ate = app_now() + interval '30 minutes', vida = v_vida where id = c.id;
      perform resposta_vida(m, 'Foto recebida. Agora mande o texto do anúncio.');
      return;
    end if;
    if length(v_texto) < 3 or length(v_texto) > 1000 then
      perform resposta_vida(m, 'O texto do anúncio precisa ter de 3 a 1.000 letras. Mande de novo, ou SAIR.');
      return;
    end if;
    update conversas_whatsapp set etapa = 'ANUNCIO_TELEFONE', etapa_ate = app_now() + interval '30 minutes',
           vida = v_vida || jsonb_build_object('texto', v_texto)
     where id = c.id;
    perform pedir_telefone_anuncio(m, '');
    return;
  end if;
  -- ANUNCIO_TELEFONE: a foto que chega depois do texto ainda entra.
  if v_foto and v_texto = '' then
    update conversas_whatsapp set etapa_ate = app_now() + interval '30 minutes', vida = v_vida where id = c.id;
    perform pedir_telefone_anuncio(m, 'Foto recebida. ');
    return;
  end if;
  if v_cmd not in ('SIM', 'S', 'SIM.', 'NÃO', 'NAO', 'N', 'NÃO.', 'NAO.') then
    perform resposta_vida(m, 'Responda SIM ou NÃO, ou SAIR.');
    return;
  end if;
  insert into classificados (condominio_id, contato_id, unidade_id, tipo, texto, foto_mensagem_id, mostrar_telefone)
  values (contexto_condominio(), (v_vida ->> 'contato')::uuid, (v_vida ->> 'unidade')::uuid, v_vida ->> 'tipo', v_vida ->> 'texto',
          (v_vida ->> 'foto')::uuid, v_cmd in ('SIM', 'S', 'SIM.'))
  returning * into cl;
  perform registrar_historico('classificado.enviado', 'classificados', cl.id::text,
    jsonb_build_object('tipo', cl.tipo, 'unidade', rotulo_unidade(cl.unidade_id), 'foto', cl.foto_mensagem_id is not null));
  perform sair_do_anuncio(c);
  perform resposta_vida(m, 'Anúncio enviado para aprovação. Aviso aqui quando estiver no mural.' || assinatura_nina());
end $$;

-- ANUNCIAR passa antes de tudo; durante o anúncio, PARAR, VOLTAR, REVISAR, RESERVAR e CANCELAR
-- fecham o anúncio e seguem o caminho de antes.
alter function processar_mensagem_whatsapp(mensagens_whatsapp) rename to processar_mensagem_reservas;

create function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  c conversas_whatsapp;
  v_contatos uuid[];
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
  v_anuncio boolean;
begin
  select * into c from conversas_whatsapp where telefone = m.telefone;
  v_anuncio := c.id is not null and c.etapa like 'ANUNCIO\_%';
  if v_anuncio and (c.etapa_ate is null or c.etapa_ate < app_now()
                    or v_cmd in ('PARAR', 'VOLTAR') or v_cmd ~ '^(REVISAR|RESERVAR|CANCELAR)\M') then
    perform sair_do_anuncio(c);
    v_anuncio := false;
  end if;
  if not v_anuncio and v_cmd !~ '^ANUNCIAR\M' then
    perform processar_mensagem_reservas(m);
    return;
  end if;
  v_contatos := contatos_do_telefone(m.telefone);
  if cardinality(v_contatos) = 0 then
    perform processar_mensagem_reservas(m);
    return;
  end if;
  if c.id is null then
    insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone) returning * into c;
  end if;
  update conversas_whatsapp set atualizada_em = app_now(), texto_pendente = null, pedido_id = null where id = c.id returning * into c;
  update mensagens_whatsapp set contato_id = v_contatos[1] where id = m.id;
  m.contato_id := v_contatos[1];
  if v_cmd ~ '^ANUNCIAR\M' then
    perform iniciar_anuncio_whatsapp(m, c, v_contatos);
  else
    perform continuar_anuncio_whatsapp(m, c);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API: a aba Classificados.

create function plataforma_classificados(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.ver');
  return jsonb_build_object(
    'classificados', coalesce((
      select jsonb_agg(classificado_json(cl) order by cl.estado <> 'A_APROVAR', coalesce(cl.decidido_em, cl.criado_em) desc)
        from (select * from classificados order by criado_em desc limit 300) cl), '[]'::jsonb),
    'aAprovar', (select count(*) from classificados where estado = 'A_APROVAR'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'classificados.editar')));
end $$;

create function exigir_classificado(p_id uuid, p_versao integer) returns classificados
language plpgsql
set search_path = public
as $$
declare cl classificados;
begin
  select * into cl from classificados where id = p_id for update;
  if cl.id is null then raise exception 'Anúncio não encontrado' using errcode = 'TC404'; end if;
  if cl.versao <> p_versao then perform conflito_versao('classificados', p_id); end if;
  return cl;
end $$;

create function plataforma_publicar_classificado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                                 p_valor_centavos integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cl classificados;
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.editar');
  cl := exigir_classificado(p_id, p_versao);
  if cl.estado <> 'A_APROVAR' then perform recusar_motivo('O anúncio já foi decidido', 'ANUNCIO_DECIDIDO'); end if;
  if length(v_titulo) not between 3 and 80 then perform recusar_campos('Escreva o título, de 3 a 80 letras', 'titulo'); end if;
  if p_valor_centavos is not null and p_valor_centavos not between 1 and 100000000 then
    perform recusar_campos('Valor inválido', 'valorCentavos');
  end if;
  update classificados set estado = 'NO_MURAL', titulo = v_titulo, valor_centavos = p_valor_centavos,
                           no_mural_ate = hoje_no_condominio() + 30, decidido_em = app_now(), decidido_por = p_pessoa
   where id = cl.id returning * into cl;
  perform registrar_historico('classificado.publicado', 'classificados', cl.id::text,
    jsonb_build_object('titulo', cl.titulo, 'ate', cl.no_mural_ate));
  perform avisar_morador_classificado(cl, 'está no mural até ' || to_char(cl.no_mural_ate, 'DD/MM') || ', com o título "' || cl.titulo || '".'
    || case when cl.mostrar_telefone then ' Quem se interessar fala com você por aqui.' else ' Quem se interessar fala com o condomínio, que passa o recado.' end,
    p_pessoa);
  return classificado_json(cl);
end $$;

create function plataforma_recusar_classificado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cl classificados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.editar');
  cl := exigir_classificado(p_id, p_versao);
  if cl.estado <> 'A_APROVAR' then perform recusar_motivo('O anúncio já foi decidido', 'ANUNCIO_DECIDIDO'); end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then perform recusar_campos('Escreva o motivo', 'motivo'); end if;
  update classificados set estado = 'RECUSADO', motivo = btrim(p_motivo), decidido_em = app_now(), decidido_por = p_pessoa
   where id = cl.id returning * into cl;
  perform registrar_historico('classificado.recusado', 'classificados', cl.id::text, jsonb_build_object('motivo', cl.motivo));
  perform avisar_morador_classificado(cl, 'não foi publicado. Motivo: ' || cl.motivo, p_pessoa);
  return classificado_json(cl);
end $$;

create function plataforma_tirar_classificado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cl classificados;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.editar');
  cl := exigir_classificado(p_id, p_versao);
  if not anuncio_no_mural(cl) then perform recusar_motivo('O anúncio não está no mural', 'ANUNCIO_FORA_DO_MURAL'); end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then perform recusar_campos('O motivo tem de 3 a 500 letras', 'motivo'); end if;
  update classificados set estado = 'RETIRADO', motivo = v_motivo, retirado_em = app_now(), retirado_por = p_pessoa
   where id = cl.id returning * into cl;
  perform registrar_historico('classificado.retirado', 'classificados', cl.id::text, jsonb_strip_nulls(jsonb_build_object('motivo', v_motivo)));
  perform avisar_morador_classificado(cl, '"' || cl.titulo || '" saiu do mural.' || coalesce(' Motivo: ' || v_motivo, ''), p_pessoa);
  return classificado_json(cl);
end $$;

create function plataforma_foto_classificado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cl classificados;
  m mensagens_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.ver');
  select * into cl from classificados where id = p_id;
  if cl.id is not null then m := foto_do_anuncio(cl); end if;
  if m.id is null then raise exception 'Foto não encontrada' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', m.midia_caminho, 'tipo', m.midia_tipo, 'nome', 'foto');
end $$;

-- ---------------------------------------------------------------------------------------
-- Mural (decisão 14; CD-12): a aba Classificados, com o primeiro nome e o bloco.

alter function publico_mural(text) rename to publico_mural_r12b;
alter function publico_mural_r12b(text) security invoker;

create function publico_mural(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_mural_r12b(p_codigo);
  if v ? 'comunicados' then
    v := v || jsonb_build_object('classificados', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', cl.id, 'tipo', cl.tipo, 'titulo', cl.titulo, 'texto', cl.texto, 'valorCentavos', cl.valor_centavos,
               'ate', to_char(cl.no_mural_ate, 'YYYY-MM-DD'), 'foto', (foto_do_anuncio(cl)).id is not null,
               'quem', (select nome_curto(ct.nome) from contatos ct where ct.id = cl.contato_id and ct.dados_removidos_em is null),
               'bloco', bloco_da_unidade(cl.unidade_id),
               'whatsapp', case when cl.mostrar_telefone then
                 (select regexp_replace(ct.telefone, '\D', '', 'g') from contatos ct
                   where ct.id = cl.contato_id and ct.dados_removidos_em is null and contato_ativo(ct.id)) end))
             order by cl.decidido_em desc)
        from classificados cl where anuncio_no_mural(cl)), '[]'::jsonb));
  end if;
  return v;
end $$;

create function publico_mural_classificado_foto(p_codigo text, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cl classificados;
  m mensagens_whatsapp;
begin
  perform exigir_mural(p_codigo);
  select * into cl from classificados x where x.id = p_id and anuncio_no_mural(x);
  if cl.id is not null then m := foto_do_anuncio(cl); end if;
  if m.id is null then raise exception 'Foto não encontrada' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', m.midia_caminho, 'nome', 'foto', 'tipo', m.midia_tipo);
end $$;

-- ---------------------------------------------------------------------------------------
-- Painel: os anúncios a aprovar no cartão Vida em condomínio.

alter function plataforma_painel(uuid, uuid) rename to painel_r12_assembleias;
alter function painel_r12_assembleias(uuid, uuid) security invoker;

create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  n integer;
begin
  v := painel_r12_assembleias(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'classificados.ver') then
    select count(*) into n from classificados where estado = 'A_APROVAR';
    if n > 0 then
      v := v || jsonb_build_object('vida', coalesce(v -> 'vida', jsonb_build_object('reservasAAprovar', 0, 'proximasAAprovar', '[]'::jsonb))
                                           || jsonb_build_object('classificadosAAprovar', n));
    end if;
  end if;
  return v;
end $$;

call fechar_acesso();

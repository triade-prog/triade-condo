-- 0284 · Comunicado pelo WhatsApp do condomínio (F6.6; CD-02, W-20, W-16, CD-11, CD-08, CD-01).
-- Desenho em docs/telas/comunicado-whatsapp.html, aprovado pela Carolina em 20/10/2026.
--
-- Regras desta parte (as decisões do desenho):
-- 1. Todo comunicado segue um caminho só: a opção "Vai pelo WhatsApp do condomínio" fica no
--    comunicado e vale também para o comunicado do registro do pedido (0281).
-- 2. Só recebe quem aceitou, do próprio celular. Ninguém da gestão marca o aceite.
-- 3. Vão o nome do condomínio, o título e o link pessoal (o mesmo do e-mail, /c), sempre pelo
--    modelo comunicado_publicado, mesmo com a conversa aberta. O texto inteiro fica no link.
-- 4. O horário sem envio dos comunicados vale para o WhatsApp, urgente inclusive.
-- 5. Saem 10 por minuto por condomínio (um a cada 6 segundos); respostas, protocolos e avisos
--    de pedido não entram nesse ritmo.
-- 6. O aceite: a Nina pergunta uma vez, depois de um atendimento terminado (pedido registrado,
--    consulta ou recado); ou o morador manda COMUNICADOS. SIM e COMUNICADOS ligam; NÃO fica anotado.
-- 7. PARAR COMUNICADOS desliga só os comunicados. PARAR (0200) continua parando tudo o que o
--    condomínio inicia; VOLTAR desfaz o PARAR e mantém a escolha dos comunicados.
-- 8. O aceite é do número: trocar o telefone do contato apaga o aceite e a pergunta.
-- 9. Cada condomínio começa desligado; liga quem muda as configurações (config.editar), com o
--    número conectado.
-- 10. Uma mensagem por telefone, com o público refeito na hora do envio.
-- 11. A fila espera até 24 horas e depois cancela. Desligar ou arquivar cancela o que está na
--     fila. Corrigido antes de sair, vai o título da versão em uso.
-- 12. Falha de comunicado não toca o sino e não tem reenvio.
-- 13. Corrigir pode avisar de novo pelo WhatsApp quem recebeu a versão anterior (vem desligado);
--     a mensagem começa com "Corrigido: ".
--
-- O rodapé do modelo ficou "Para parar os comunicados, responda PARAR COMUNICADOS.": o do
-- desenho passava dos 60 caracteres que o rodapé aceita (regra da Meta, 0210).

-- ---------------------------------------------------------------------------------------
-- Colunas.

-- Liga e desliga no condomínio (decisão 9): quando e quem mudou por último.
alter table configuracao_condominio
  add column comunicados_whatsapp     boolean not null default false,
  add column comunicados_whatsapp_em  timestamptz,
  add column comunicados_whatsapp_por uuid references pessoas (id),
  add constraint comunicados_whatsapp_quem check ((comunicados_whatsapp_em is null) = (comunicados_whatsapp_por is null));

-- O aceite do contato (decisões 6 a 8). A pergunta da Nina fica marcada para não repetir.
alter table contatos
  add column comunicados_whatsapp               text check (comunicados_whatsapp in ('ACEITOU', 'RECUSOU', 'PAROU')),
  add column comunicados_whatsapp_em            timestamptz,
  add column comunicados_whatsapp_origem        text check (comunicados_whatsapp_origem in ('PERGUNTA', 'COMANDO')),
  add column comunicados_whatsapp_perguntado_em timestamptz,
  add constraint comunicados_whatsapp_completo
    check ((comunicados_whatsapp is null) = (comunicados_whatsapp_em is null)
           and (comunicados_whatsapp is null) = (comunicados_whatsapp_origem is null)),
  add constraint comunicados_whatsapp_com_telefone
    check (telefone is not null or (comunicados_whatsapp is null and comunicados_whatsapp_perguntado_em is null));

-- Trocou (ou apagou) o telefone: o aceite não passa para o número novo (decisão 8).
create function contatos_aceite_do_numero() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.telefone is distinct from old.telefone then
    new.comunicados_whatsapp := null;
    new.comunicados_whatsapp_em := null;
    new.comunicados_whatsapp_origem := null;
    new.comunicados_whatsapp_perguntado_em := null;
  end if;
  return new;
end $$;
create trigger contatos_aceite_do_numero before update of telefone on contatos
  for each row execute function contatos_aceite_do_numero();

alter table comunicados add column por_whatsapp boolean not null default true;

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO', 'PRESTADOR',
                        'PROTOCOLO', 'AVISO_PRESTADOR', 'COMUNICADO'));
alter table envios_whatsapp
  add column comunicado_id        uuid,
  add column comunicado_corrigido boolean not null default false,
  add column link_aberto_em       timestamptz,
  add constraint envios_whatsapp_comunicado foreign key (comunicado_id, condominio_id) references comunicados (id, condominio_id),
  add constraint envios_whatsapp_comunicado_tem_id check ((finalidade = 'COMUNICADO') = (comunicado_id is not null)),
  add constraint envios_whatsapp_corrigido_de_comunicado check (not comunicado_corrigido or comunicado_id is not null),
  add constraint envios_whatsapp_link_de_comunicado check (link_aberto_em is null or comunicado_id is not null);
create index envios_whatsapp_comunicado on envios_whatsapp (comunicado_id) where comunicado_id is not null;

create function envios_whatsapp_regras_f66() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.comunicado_id, new.comunicado_corrigido) is distinct from (old.comunicado_id, old.comunicado_corrigido) then
    raise exception 'O envio não muda de comunicado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger envios_whatsapp_regras_f66 before update on envios_whatsapp for each row execute function envios_whatsapp_regras_f66();

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador', 'comunicado_publicado'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador',
                          'comunicado_publicado'));

-- O modelo (decisão 3): aprovado no piloto com este desenho; no número oficial, vai à Meta (F6.5).
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('comunicado_publicado', 1, 'Comunicado publicado', 'MORADOR', 'Comunicado publicado ou corrigido, para quem aceitou receber por aqui',
   '["condomínio", "título do comunicado", "link"]',
   E'Comunicado do {{1}}: {{2}}\n\nLeia o comunicado inteiro no link, que é só seu:\n{{3}}\n\nNina, assistente virtual do {{1}}.',
   'Para parar os comunicados, responda PARAR COMUNICADOS.', 'APROVADO_PILOTO',
   'Aprovado com o desenho do comunicado pelo WhatsApp', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave = 'comunicado_publicado';

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function comunicados_whatsapp_ativos() returns boolean
language sql stable
set search_path = public
as $$ select coalesce((select comunicados_whatsapp from configuracao_condominio), false) $$;

-- Recebe comunicado pelo WhatsApp: tem telefone, aceitou e não mandou PARAR (decisões 2 e 7).
create function recebe_comunicado_whatsapp(ct contatos) returns boolean
language sql stable
set search_path = public
as $$
  select ct.dados_removidos_em is null and ct.telefone is not null and ct.comunicados_whatsapp is not distinct from 'ACEITOU'
         and ct.whatsapp_parou_em is null
$$;

-- A situação para as telas: ACEITOU, RECUSOU, PAROU (PARAR ou PARAR COMUNICADOS) ou SEM_RESPOSTA.
create function situacao_comunicados_whatsapp(ct contatos) returns text
language sql stable
set search_path = public
as $$
  select case when ct.telefone is null then null
              when ct.comunicados_whatsapp = 'PAROU' or (ct.comunicados_whatsapp = 'ACEITOU' and ct.whatsapp_parou_em is not null) then 'PAROU'
              else coalesce(ct.comunicados_whatsapp, 'SEM_RESPOSTA') end
$$;

-- A versão em uso do comunicado (a publicada da mesma família), para o título e o link.
create function comunicado_em_uso(p_comunicado uuid) returns comunicados
language sql stable
set search_path = public
as $$
  select a.* from comunicados c join comunicados a on a.familia_id = c.familia_id and a.estado = 'PUBLICADO' where c.id = p_comunicado
$$;

-- As variáveis do modelo; o link entra no lugar de [link] na hora do envio (decisões 3 e 13).
create function parametros_comunicado_whatsapp(p_titulo text, p_corrigido boolean) returns jsonb
language sql stable
set search_path = public
as $$ select jsonb_build_array(nome_do_condominio(), case when p_corrigido then 'Corrigido: ' else '' end || btrim(p_titulo), '[link]') $$;

-- O texto com o modelo mais novo, aprovado ou não: é o que sai com a conversa aberta.
create function texto_comunicado_whatsapp(p_parametros jsonb) returns text
language sql stable
set search_path = public
as $$
  select renderizar_modelo(m, p_parametros) from modelos_whatsapp m where m.chave = 'comunicado_publicado' order by m.numero desc limit 1
$$;

-- O número do condomínio para o wa.me, com o botão ligado (só dígitos).
create function numero_comunicados_whatsapp() returns text
language sql stable
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(numero_whatsapp, ''), '\D', '', 'g'), '')
    from condominios where id = contexto_condominio() and comunicados_whatsapp_ativos()
$$;

-- ---------------------------------------------------------------------------------------
-- Pôr na fila (decisões 1, 4, 5 e 10).

-- Um envio por telefone de quem recebe agora, um a cada 6 segundos depois do último comunicado
-- na fila, sem cair no horário sem envio. Com p_telefones, só esses (a correção, decisão 13).
create function enfileirar_comunicado_whatsapp(p_id uuid, p_corrigido boolean, p_telefones text[] default null) returns integer
language plpgsql
set search_path = public
as $$
declare
  c comunicados;
  r record;
  v_params jsonb;
  v_texto text;
  v_quando timestamptz;
  v_primeiro timestamptz;
  v_n integer := 0;
begin
  select * into c from comunicados where id = p_id;
  if c.id is null or c.estado <> 'PUBLICADO' or not c.por_whatsapp or not comunicados_whatsapp_ativos() then return 0; end if;
  v_params := parametros_comunicado_whatsapp(c.titulo, p_corrigido);
  v_texto := texto_comunicado_whatsapp(v_params);
  select greatest(app_now(), coalesce(max(enviar_apos) + interval '6 seconds', app_now())) into v_quando
    from envios_whatsapp where finalidade = 'COMUNICADO' and estado = 'NA_FILA' and enviar_apos < 'infinity';
  for r in
    select distinct on (ct.telefone) ct.telefone, ct.id
      from destinatarios_comunicado(c.assunto, c.publico, c.blocos, c.unidades, c.contatos) d
      join contatos ct on ct.id = d.contato_id
     where recebe_comunicado_whatsapp(ct) and (p_telefones is null or ct.telefone = any (p_telefones))
     order by ct.telefone, ct.criado_em, ct.id
  loop
    v_quando := fim_do_silencio(v_quando);
    v_primeiro := coalesce(v_primeiro, v_quando);
    insert into envios_whatsapp (condominio_id, para, contato_id, finalidade, texto, responsavel, criado_por, enviar_apos,
                                 comunicado_id, comunicado_corrigido, modelo_chave, modelo_parametros)
    values (c.condominio_id, r.telefone, r.id, 'COMUNICADO', v_texto, c.publicado_por, c.publicado_por, v_quando,
            c.id, coalesce(p_corrigido, false), 'comunicado_publicado', v_params);
    v_quando := v_quando + interval '6 seconds';
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then
    perform registrar_historico('comunicado.whatsapp_na_fila', 'comunicados', c.familia_id::text, jsonb_build_object(
      'comunicado', c.id, 'numero', c.numero, 'quantos', v_n, 'enviarApos', v_primeiro, 'corrigido', coalesce(p_corrigido, false)));
  end if;
  return v_n;
end $$;

-- Publicar também põe o WhatsApp na fila (o resto é igual a 0160).
create or replace function publicar_comunicado(p_id uuid, p_por uuid, p_evento text, p_sistema boolean default false) returns integer
language plpgsql
set search_path = public
as $$
declare
  c comunicados;
  v_versao integer;
begin
  select * into c from comunicados where id = p_id;
  perform definir_transicao(p_evento, null, p_sistema);
  update comunicados
     set estado = 'PUBLICADO', publicado_em = app_now(), publicado_por = p_por,
         assinatura = (select comunicados_assinatura from configuracao_condominio),
         destinatarios = (select count(distinct contato_id) from destinatarios_comunicado(c.assunto, c.publico, c.blocos, c.unidades, c.contatos))
   where id = p_id returning versao into v_versao;
  perform registrar_historico('comunicado.publicado', 'comunicados', c.familia_id::text, jsonb_build_object(
    'comunicado', p_id, 'numero', c.numero, 'programado', p_sistema));
  perform enfileirar_comunicado(p_id);
  perform enfileirar_comunicado_whatsapp(p_id, false);
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- A fila (decisões 3, 4, 10 e 11).

-- Antes do lote, no condomínio: cancela o que não vale mais, adia o que cairia no horário sem
-- envio e solta, com o número de volta, o que a queda do WhatsApp (0270) segurou.
create function preparar_comunicados_whatsapp() returns void
language plpgsql
set search_path = public
as $$
declare
  v_ligado boolean := comunicados_whatsapp_ativos();
  v_fim timestamptz;
  v_base timestamptz;
begin
  if not exists (select 1 from envios_whatsapp where finalidade = 'COMUNICADO' and estado = 'NA_FILA') then return; end if;
  update envios_whatsapp w set estado = 'CANCELADA', motivo = case
           when not v_ligado then 'Os comunicados pelo WhatsApp foram desligados'
           when (comunicado_em_uso(w.comunicado_id)).id is null then 'O comunicado foi arquivado'
           else 'Passou de 24 horas sem sair' end
   where w.finalidade = 'COMUNICADO' and w.estado = 'NA_FILA'
     and (not v_ligado or w.criado_em < app_now() - interval '24 hours' or (comunicado_em_uso(w.comunicado_id)).id is null);
  -- O público é refeito na hora: quem saiu, parou ou trocou de número não recebe.
  update envios_whatsapp w set estado = 'CANCELADA', motivo = 'A pessoa não recebe mais comunicados por aqui'
   where w.finalidade = 'COMUNICADO' and w.estado = 'NA_FILA' and w.enviar_apos <= app_now() + interval '1 minute'
     and not exists (select 1 from comunicados cv
                       cross join lateral destinatarios_comunicado(cv.assunto, cv.publico, cv.blocos, cv.unidades, cv.contatos) d
                       join contatos ct on ct.id = d.contato_id
                      where cv.id = (comunicado_em_uso(w.comunicado_id)).id and ct.telefone = w.para and recebe_comunicado_whatsapp(ct));
  v_fim := fim_do_silencio(app_now());
  if v_fim > app_now() then
    update envios_whatsapp w set enviar_apos = v_fim + (x.n - 1) * interval '6 seconds'
      from (select id, row_number() over (order by enviar_apos, criado_em, id) as n from envios_whatsapp
             where finalidade = 'COMUNICADO' and estado = 'NA_FILA' and enviar_apos < v_fim) x
     where w.id = x.id;
  end if;
  if exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO')
     and not exists (select 1 from quedas_whatsapp where estado = 'FORA_DO_AR') then
    select greatest(v_fim, coalesce(max(enviar_apos) + interval '6 seconds', v_fim)) into v_base
      from envios_whatsapp where finalidade = 'COMUNICADO' and estado = 'NA_FILA' and enviar_apos < 'infinity';
    update envios_whatsapp w set enviar_apos = v_base + (x.n - 1) * interval '6 seconds'
      from (select id, row_number() over (order by criado_em, id) as n from envios_whatsapp
             where finalidade = 'COMUNICADO' and estado = 'NA_FILA' and enviar_apos = 'infinity' and conciliacao is null) x
     where w.id = x.id;
  end if;
end $$;

-- Na hora de sair: o título da versão em uso e o link pessoal, que nasce aqui (decisões 3 e 11).
create function montar_comunicado_whatsapp(e envios_whatsapp, x jsonb) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cv comunicados := comunicado_em_uso(e.comunicado_id);
  v_modelo modelos_whatsapp;
  v_params jsonb;
  v_texto text;
  v_codigo text;
begin
  if cv.id is null then select * into cv from comunicados where id = e.comunicado_id; end if;
  v_params := parametros_comunicado_whatsapp(cv.titulo, e.comunicado_corrigido);
  select * into v_modelo from modelos_whatsapp where id = e.modelo_id;
  v_texto := case when v_modelo.id is not null then renderizar_modelo(v_modelo, v_params) else texto_comunicado_whatsapp(v_params) end;
  v_codigo := criar_link('COMUNICADO', cv.familia_id, e.contato_id, e.id, null, interval '90 days');
  update envios_whatsapp set modelo_parametros = v_params, texto_enviado = v_texto where id = e.id;
  return x || jsonb_build_object('texto', v_texto, 'link', v_codigo, 'rota', 'c');
end $$;

alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_f67;
alter function pegar_lote_whatsapp_f67(integer) security invoker;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  l jsonb;
  x jsonb;
  v_envios jsonb;
  e envios_whatsapp;
begin
  -- Como no lote (0210): só o verificador enxerga todos os condomínios.
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    perform preparar_comunicados_whatsapp();
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  v_lotes := pegar_lote_whatsapp_f67(p_max);
  for l in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((l ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(l -> 'envios') loop
      select * into e from envios_whatsapp where id = (x ->> 'envio')::uuid;
      if e.finalidade = 'COMUNICADO' then x := montar_comunicado_whatsapp(e, x); end if;
      v_envios := v_envios || jsonb_build_array(x);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(l, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

-- Falha de comunicado não toca o sino (decisão 12); as outras, como em 0200.
create or replace function falha_whatsapp(e envios_whatsapp) returns void
language sql
set search_path = public
as $$
  select avisar_whatsapp(array[e.responsavel], 'FALHA_ENVIO', e.pedido_id, null, e.id, e.id::text) where e.finalidade <> 'COMUNICADO'
$$;

-- E não tem reenvio (decisão 12).
alter function plataforma_reenviar_whatsapp(uuid, uuid, uuid, text) rename to reenviar_whatsapp_f66;
alter function reenviar_whatsapp_f66(uuid, uuid, uuid, text) security invoker;
create function plataforma_reenviar_whatsapp(p_pessoa uuid, p_condominio uuid, p_envio uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if exists (select 1 from envios_whatsapp where id = p_envio and finalidade = 'COMUNICADO') then
    perform recusar_motivo('Mensagem de comunicado não tem reenvio: a pessoa lê pelo mural, pelo e-mail ou pelo grupo', 'COMUNICADO_SEM_REENVIO');
  end if;
  return reenviar_whatsapp_f66(p_pessoa, p_condominio, p_envio, p_motivo);
end $$;

-- Arquivar cancela o que ainda está na fila (decisão 11).
alter function plataforma_arquivar_comunicado(uuid, uuid, uuid, integer, text) rename to arquivar_comunicado_f66;
alter function arquivar_comunicado_f66(uuid, uuid, uuid, integer, text) security invoker;
create function plataforma_arquivar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := arquivar_comunicado_f66(p_pessoa, p_condominio, p_id, p_versao, p_motivo);
  update envios_whatsapp w set estado = 'CANCELADA', motivo = 'O comunicado foi arquivado'
    from comunicados c, comunicados a
   where a.id = p_id and c.familia_id = a.familia_id and w.comunicado_id = c.id and w.estado = 'NA_FILA';
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- A Nina: o aceite, COMUNICADOS e PARAR COMUNICADOS (decisões 6 a 8).

-- Grava a escolha em todos os contatos ativos do telefone (o aceite é do número).
create function escolher_comunicados_whatsapp(p_contatos uuid[], p_situacao text, p_origem text) returns void
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  for v_id in
    update contatos set comunicados_whatsapp = p_situacao, comunicados_whatsapp_em = app_now(), comunicados_whatsapp_origem = p_origem
     where id = any (p_contatos) and telefone is not null and comunicados_whatsapp is distinct from p_situacao
    returning id
  loop
    perform registrar_historico('contato.comunicados_whatsapp', 'contato', v_id::text, jsonb_build_object('situacao', p_situacao, 'origem', p_origem));
  end loop;
end $$;

-- Pergunta da Nina esperando resposta: feita há menos de 24 horas, sem escolha depois.
create function pergunta_comunicados_pendente(p_contatos uuid[]) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from contatos where id = any (p_contatos) and comunicados_whatsapp is null
                                         and comunicados_whatsapp_perguntado_em > app_now() - interval '24 hours')
$$;

-- As palavras passam antes de tudo; SIM e NÃO só com a pergunta esperando e fora da reserva e do
-- anúncio, que também usam SIM. Depois de um atendimento terminado, a Nina pergunta uma vez.
alter function processar_mensagem_whatsapp(mensagens_whatsapp) rename to processar_mensagem_classificados;

create function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  c conversas_whatsapp;
  c2 conversas_whatsapp;
  ct contatos;
  v_contatos uuid[];
  v_cmd text := regexp_replace(upper(btrim(regexp_replace(coalesce(m.texto, ''), '\s+', ' ', 'g'))), '[.!]+$', '');
  v_nome text;
  v_ligado boolean := comunicados_whatsapp_ativos();
  v_texto text;
begin
  v_contatos := contatos_do_telefone(m.telefone);
  if cardinality(v_contatos) = 0 then
    perform processar_mensagem_classificados(m);
    return;
  end if;
  select * into c from conversas_whatsapp where telefone = m.telefone;
  select * into ct from contatos where id = v_contatos[1];
  v_nome := nullif(nome_curto(ct.nome), '');

  if v_cmd in ('COMUNICADOS', 'PARAR COMUNICADOS')
     or (v_cmd in ('SIM', 'NÃO', 'NAO') and pergunta_comunicados_pendente(v_contatos)
         and (c.id is null or (c.etapa not like 'RESERVA\_%' and c.etapa not like 'ANUNCIO\_%'))) then
    insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone)
    on conflict (condominio_id, telefone) do update set atualizada_em = app_now();
    update mensagens_whatsapp set contato_id = ct.id where id = m.id;
    if v_cmd = 'PARAR COMUNICADOS' then
      perform escolher_comunicados_whatsapp(v_contatos, 'PAROU', 'COMANDO');
      v_texto := 'Pronto: você não recebe mais os comunicados do ' || nome_do_condominio() || ' por aqui. '
                 || 'As respostas aos seus pedidos continuam. Para voltar, mande COMUNICADOS.';
    elsif v_cmd in ('NÃO', 'NAO') then
      perform escolher_comunicados_whatsapp(v_contatos, 'RECUSOU', 'PERGUNTA');
      v_texto := 'Tudo bem: você não vai receber os comunicados por aqui. Se mudar de ideia, mande COMUNICADOS.';
    else
      perform escolher_comunicados_whatsapp(v_contatos, 'ACEITOU', case when v_cmd = 'SIM' then 'PERGUNTA' else 'COMANDO' end);
      v_texto := case when v_ligado
                   then 'Pronto' || coalesce(', ' || v_nome, '') || ': você vai receber os comunicados do ' || nome_do_condominio()
                        || ' por aqui. Para parar, mande PARAR COMUNICADOS.'
                   else 'Anotei' || coalesce(', ' || v_nome, '') || ': quando o ' || nome_do_condominio()
                        || ' começar a mandar os comunicados por aqui, você recebe. Para parar, mande PARAR COMUNICADOS.' end
                 || case when exists (select 1 from contatos where id = any (v_contatos) and whatsapp_parou_em is not null)
                      then ' Você tinha pedido para parar todos os avisos: para voltar a recebê-los, mande VOLTAR.' else '' end;
    end if;
    perform responder_whatsapp(m.telefone, ct.id, null, v_texto);
    return;
  end if;

  perform processar_mensagem_classificados(m);

  if not v_ligado or exists (select 1 from contatos where id = any (v_contatos)
                                                      and (comunicados_whatsapp is not null or comunicados_whatsapp_perguntado_em is not null
                                                           or whatsapp_parou_em is not null)) then
    return;
  end if;
  select * into c2 from conversas_whatsapp where telefone = m.telefone;
  if (c2.etapa = 'ANEXANDO' and c2.pedido_id is not null and c2.pedido_id is distinct from c.pedido_id)
     or (c.etapa = 'MENU' and v_cmd = '3' and c2.etapa = 'INICIO')
     or (c2.etapa = 'CONSULTA' and (c.id is null or c.etapa <> 'CONSULTA' or c2.consultado_id is distinct from c.consultado_id)) then
    update contatos set comunicados_whatsapp_perguntado_em = app_now() where id = any (v_contatos) and telefone is not null;
    perform enfileirar_whatsapp(m.telefone, ct.id, null, null, null, 'RESPOSTA',
      'Mais uma coisa' || coalesce(', ' || v_nome, '') || ': quer receber os comunicados do condomínio também por aqui? '
      || E'São avisos como falta de água, obras e assembleias, com um link para ler.\n\nResponda SIM ou NÃO. Dá para mudar quando quiser.',
      null, null, app_now() + interval '5 seconds');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Páginas sem conta: o link pessoal e o mural.

-- O link do WhatsApp conta quem abriu; a página mostra o botão para quem ainda não recebe por lá.
alter function publico_comunicado(text) rename to publico_comunicado_f66;
alter function publico_comunicado_f66(text) security invoker;
create function publico_comunicado(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  l links_publicos;
  ct contatos;
begin
  v := publico_comunicado_f66(p_codigo);
  if not (v ? 'comunicado') then return v; end if;
  select * into l from links_publicos where hash = hash_codigo(p_codigo) and tipo = 'COMUNICADO';
  if l.envio_id is not null then
    update envios_whatsapp set link_aberto_em = app_now() where id = l.envio_id and link_aberto_em is null;
  end if;
  select * into ct from contatos where id = l.contato_id;
  if ct.id is not null and recebe_comunicado_whatsapp(ct) then return v; end if;
  return v || jsonb_strip_nulls(jsonb_build_object('comunicadosWhatsapp', numero_comunicados_whatsapp()));
end $$;

alter function publico_mural(text) rename to publico_mural_f66;
alter function publico_mural_f66(text) security invoker;
create function publico_mural(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_mural_f66(p_codigo);
  if not (v ? 'comunicados') then return v; end if;
  return v || jsonb_strip_nulls(jsonb_build_object('comunicadosWhatsapp', numero_comunicados_whatsapp()));
end $$;

-- ---------------------------------------------------------------------------------------
-- Escrever, corrigir e ver o comunicado.

-- O público também diz quantos recebem pelo WhatsApp e pelos dois (a tela faz a conta do "por
-- nenhum" com o que estiver ligado).
create or replace function publico_json(p_pessoa uuid, p_assunto text, p_publico text, p_blocos uuid[], p_unidades uuid[], p_contatos uuid[])
returns jsonb
language sql stable
set search_path = public
as $$
  with d as (select * from destinatarios_comunicado(p_assunto, p_publico, p_blocos, p_unidades, p_contatos)),
  sem as (select unnest(unidades_sem_destinatario(p_assunto, p_publico, p_blocos, p_unidades)) as id),
  canais as (select distinct d.contato_id, recebe_por_email(ct) as email, recebe_comunicado_whatsapp(ct) as whatsapp
               from d join contatos ct on ct.id = d.contato_id)
  select jsonb_strip_nulls(jsonb_build_object(
    'contatos', (select count(distinct contato_id) from d),
    'unidades', (select count(distinct unidade_id) from d),
    'comEmail', (select count(*) from canais where email),
    'comWhatsapp', (select count(*) from canais where whatsapp),
    'pelosDois', (select count(*) from canais where email and whatsapp),
    'semNinguem', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', rotulo_unidade(s.id)) order by rotulo_unidade(s.id))
                              from sem s), '[]'::jsonb),
    'quem', case when pode(p_pessoa, contexto_condominio(), 'moradores.ver') then coalesce((
              select jsonb_agg(jsonb_build_object('contatoId', x.contato_id, 'nome', x.nome, 'unidades', x.unidades, 'email', x.email,
                                                  'whatsapp', x.whatsapp) order by lower(x.nome))
                from (select d.contato_id, ct.nome, bool_or(recebe_por_email(ct)) as email, bool_or(recebe_comunicado_whatsapp(ct)) as whatsapp,
                             jsonb_agg(rotulo_unidade(d.unidade_id) order by rotulo_unidade(d.unidade_id)) as unidades
                        from d join contatos ct on ct.id = d.contato_id group by d.contato_id, ct.nome) x), '[]'::jsonb) end,
    'blocos', case when p_publico = 'BLOCOS' then (select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome) order by b.ordem, b.nome)
                                                      from blocos b where b.id = any (p_blocos)) end,
    'unidadesEscolhidas', case when p_publico = 'UNIDADES' then (select jsonb_agg(jsonb_build_object('id', x, 'nome', rotulo_unidade(x)) order by rotulo_unidade(x))
                                                                  from unnest(p_unidades) x) end,
    'contatosEscolhidos', case when p_publico = 'CONTATOS' and pode(p_pessoa, contexto_condominio(), 'moradores.ver') then
                            (select jsonb_agg(jsonb_build_object('id', ct.id, 'nome', ct.nome) order by lower(ct.nome))
                               from contatos ct where ct.id = any (p_contatos)) end))
$$;

alter function plataforma_comunicado_opcoes(uuid, uuid) rename to comunicado_opcoes_f66;
alter function comunicado_opcoes_f66(uuid, uuid) security invoker;
create function plataforma_comunicado_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := comunicado_opcoes_f66(p_pessoa, p_condominio);
  return jsonb_set(v, '{canais}', (v -> 'canais') || jsonb_build_object(
    'whatsappLigado', comunicados_whatsapp_ativos(),
    'whatsappConectado', exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO')));
end $$;

alter function plataforma_salvar_comunicado(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text,
                                            timestamptz, boolean, boolean) rename to salvar_comunicado_f66;
alter function salvar_comunicado_f66(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text,
                                     timestamptz, boolean, boolean) security invoker;
-- Igual a 0160, com "Vai pelo WhatsApp do condomínio" (decisão 1): guardado antes de publicar,
-- para a fila já sair certa.
create function plataforma_salvar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_assunto text,
                                             p_titulo text, p_texto text, p_publico text, p_blocos uuid[], p_unidades uuid[],
                                             p_contatos uuid[], p_pedido uuid, p_manutencao uuid, p_acao text,
                                             p_programado_para timestamptz, p_no_mural boolean default null, p_por_email boolean default null,
                                             p_por_whatsapp boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c comunicados;
begin
  v := salvar_comunicado_f66(p_pessoa, p_condominio, p_id, p_versao, p_assunto, p_titulo, p_texto, p_publico, p_blocos, p_unidades,
                             p_contatos, p_pedido, p_manutencao, case when p_acao = 'PUBLICAR' then 'RASCUNHO' else p_acao end,
                             p_programado_para, p_no_mural, p_por_email);
  select * into c from comunicados where id = (v ->> 'id')::uuid;
  if p_por_whatsapp is not null and c.por_whatsapp <> p_por_whatsapp then
    update comunicados set por_whatsapp = p_por_whatsapp where id = c.id;
  end if;
  if p_acao = 'PUBLICAR' then
    perform publicar_comunicado(c.id, p_pessoa, 'PUBLICADO');
  end if;
  return jsonb_build_object('id', c.id, 'versao', (select versao from comunicados where id = c.id));
end $$;

alter function plataforma_corrigir_comunicado(uuid, uuid, uuid, integer, text, text, text, boolean) rename to corrigir_comunicado_f66;
alter function corrigir_comunicado_f66(uuid, uuid, uuid, integer, text, text, text, boolean) security invoker;
-- Corrigir (0160) guarda o WhatsApp na versão nova; avisar de novo vai só aos telefones que
-- receberam uma versão anterior, com "Corrigido: " no título (decisão 13).
create function plataforma_corrigir_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_texto text, p_mudanca text, p_avisar_email boolean default false,
                                               p_avisar_whatsapp boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  a comunicados;
  v_id uuid;
begin
  v := corrigir_comunicado_f66(p_pessoa, p_condominio, p_id, p_versao, p_titulo, p_texto, p_mudanca, p_avisar_email);
  v_id := (v ->> 'id')::uuid;
  select * into a from comunicados where id = p_id;
  update comunicados set por_whatsapp = a.por_whatsapp where id = v_id and por_whatsapp <> a.por_whatsapp;
  if coalesce(p_avisar_whatsapp, false) then
    perform enfileirar_comunicado_whatsapp(v_id, true, array(
      select distinct e.para from envios_whatsapp e join comunicados c on c.id = e.comunicado_id
       where c.familia_id = a.familia_id and e.estado in ('ENVIADA', 'ENTREGUE', 'LIDA')));
  end if;
  return jsonb_build_object('id', v_id, 'versao', (select versao from comunicados where id = v_id));
end $$;

alter function plataforma_comunicado(uuid, uuid, uuid) rename to comunicado_detalhe_f66;
alter function comunicado_detalhe_f66(uuid, uuid, uuid) security invoker;
-- Como chegou (CD-08): o WhatsApp, as mensagens que não chegaram junto com os e-mails e a correção
-- que pode avisar de novo. Enviada não é lida: lida é o que o WhatsApp informa.
create function plataforma_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c comunicados;
begin
  v := comunicado_detalhe_f66(p_pessoa, p_condominio, p_id);
  c := exigir_comunicado(p_id);
  return v || jsonb_build_object(
    'canais', (v -> 'canais') || jsonb_build_object(
      'porWhatsapp', c.por_whatsapp, 'whatsappLigado', comunicados_whatsapp_ativos(),
      'whatsappConectado', exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO')),
    'whatsapp', (select jsonb_strip_nulls(jsonb_build_object(
                   'total', count(*),
                   'naFila', count(*) filter (where e.estado in ('NA_FILA', 'ENVIANDO')),
                   'enviadas', count(*) filter (where e.estado in ('ENVIADA', 'ENTREGUE', 'LIDA')),
                   'entregues', count(*) filter (where e.estado in ('ENTREGUE', 'LIDA')),
                   'lidas', count(*) filter (where e.estado = 'LIDA'),
                   'falharam', count(*) filter (where e.estado in ('FALHOU', 'DESCONHECIDO')),
                   'canceladas', count(*) filter (where e.estado = 'CANCELADA'),
                   'abertos', count(*) filter (where e.link_aberto_em is not null),
                   'saiAte', max(e.enviar_apos) filter (where e.estado = 'NA_FILA' and e.enviar_apos < 'infinity'),
                   'parados', nullif(count(*) filter (where e.estado = 'NA_FILA' and e.enviar_apos = 'infinity'), 0)))
                   from envios_whatsapp e where e.comunicado_id = c.id),
    'problemas', case when pode(p_pessoa, p_condominio, 'moradores.ver') then coalesce((
                   select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                            'envioId', e.id, 'contatoId', ct.id, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id),
                            'canal', 'WHATSAPP', 'estado', e.estado, 'motivo', e.motivo))
                          order by e.criado_em desc)
                     from envios_whatsapp e join contatos ct on ct.id = e.contato_id
                    where e.comunicado_id = c.id
                      and (e.estado in ('FALHOU', 'DESCONHECIDO') or (e.estado = 'CANCELADA' and e.motivo = 'Passou de 24 horas sem sair'))),
                   '[]'::jsonb)
                 || coalesce((select jsonb_agg(x || jsonb_build_object('canal', 'EMAIL'))
                                from jsonb_array_elements(case when jsonb_typeof(v -> 'problemas') = 'array' then v -> 'problemas' else '[]' end) x),
                             '[]'::jsonb)
                 end,
    'pode', (v -> 'pode') || jsonb_build_object(
      'avisarWhatsapp', comunicados_whatsapp_ativos() and c.por_whatsapp and c.estado = 'PUBLICADO'
                        and exists (select 1 from envios_whatsapp e join comunicados x on x.id = e.comunicado_id
                                     where x.familia_id = c.familia_id and e.estado in ('ENVIADA', 'ENTREGUE', 'LIDA'))));
end $$;

-- ---------------------------------------------------------------------------------------
-- Configurações › WhatsApp: ligar e convidar (decisão 9).

-- Contagens por telefone de quem é contato de uma unidade agora.
create function plataforma_comunicados_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_numero text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select * into cfg from configuracao_condominio;
  select nullif(regexp_replace(coalesce(numero_whatsapp, ''), '\D', '', 'g'), '') into v_numero from condominios where id = p_condominio;
  return jsonb_strip_nulls(jsonb_build_object(
    'ligado', cfg.comunicados_whatsapp,
    'mudadoEm', cfg.comunicados_whatsapp_em,
    'mudadoPor', nome_pessoa(cfg.comunicados_whatsapp_por),
    'versao', cfg.versao,
    'conectado', exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO'),
    'numero', v_numero,
    'contagens', (
      with t as (select ct.telefone, max(situacao_comunicados_whatsapp(ct)) as s
                   from contatos ct where ct.telefone is not null and contato_ativo(ct.id) group by ct.telefone)
      select jsonb_build_object('aceitaram', count(*) filter (where s = 'ACEITOU'), 'recusaram', count(*) filter (where s = 'RECUSOU'),
                                'pararam', count(*) filter (where s = 'PAROU'), 'semResposta', count(*) filter (where s = 'SEM_RESPOSTA'))
        from t),
    'convite', case when v_numero is not null then
                 'Quer receber os comunicados do ' || nome_do_condominio() || ' no WhatsApp? Toque no link e envie a mensagem que aparece: '
                 || 'https://wa.me/' || v_numero || '?text=COMUNICADOS' end,
    'porMinuto', 10,
    'silencio', jsonb_build_object('inicio', to_char(cfg.comunicados_silencio_inicio, 'HH24:MI'), 'fim', to_char(cfg.comunicados_silencio_fim, 'HH24:MI')),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar'))));
end $$;

-- Desligar cancela a fila; os aceites ficam guardados para quando religar.
create function plataforma_definir_comunicados_whatsapp(p_pessoa uuid, p_condominio uuid, p_versao integer, p_ligado boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_versao integer;
  v_canceladas integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_ligado is null then perform recusar_campos('Diga se fica ligado', 'ligado'); end if;
  select * into cfg from configuracao_condominio;
  if p_ligado and not cfg.comunicados_whatsapp and not exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO') then
    perform recusar_motivo('Conecte o WhatsApp do condomínio para usar', 'WHATSAPP_DESCONECTADO');
  end if;
  update configuracao_condominio
     set comunicados_whatsapp = p_ligado,
         comunicados_whatsapp_em = case when p_ligado <> cfg.comunicados_whatsapp then app_now() else comunicados_whatsapp_em end,
         comunicados_whatsapp_por = case when p_ligado <> cfg.comunicados_whatsapp then p_pessoa else comunicados_whatsapp_por end
   where id = cfg.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', cfg.id); end if;
  if p_ligado <> cfg.comunicados_whatsapp then
    if not p_ligado then
      update envios_whatsapp set estado = 'CANCELADA', motivo = 'Os comunicados pelo WhatsApp foram desligados'
       where finalidade = 'COMUNICADO' and estado = 'NA_FILA';
      get diagnostics v_canceladas = row_count;
    end if;
    perform registrar_historico(case when p_ligado then 'whatsapp.comunicados_ligados' else 'whatsapp.comunicados_desligados' end,
                                'configuracao_condominio', cfg.id::text, jsonb_build_object('canceladas', v_canceladas));
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Cadastro e registro do pedido.

-- A ficha da unidade: a situação dos comunicados pelo WhatsApp de cada contato, sem botão.
alter function plataforma_unidade(uuid, uuid, uuid) rename to unidade_detalhe_f66;
alter function unidade_detalhe_f66(uuid, uuid, uuid) security invoker;
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidade_detalhe_f66(p_pessoa, p_condominio, p_unidade);
  return v || jsonb_build_object(
    'contatos', coalesce((
      select jsonb_agg(x.item || coalesce((
               select jsonb_strip_nulls(jsonb_build_object(
                        'comunicadosWhatsapp', situacao_comunicados_whatsapp(ct),
                        'comunicadosWhatsappEm', case when situacao_comunicados_whatsapp(ct) = 'PAROU' and ct.comunicados_whatsapp = 'ACEITOU'
                                                      then ct.whatsapp_parou_em else ct.comunicados_whatsapp_em end,
                        'comunicadosWhatsappOrigem', case when situacao_comunicados_whatsapp(ct) in ('ACEITOU', 'RECUSOU') then ct.comunicados_whatsapp_origem end))
                 from contatos ct where ct.id = (x.item ->> 'contatoId')::uuid), '{}'::jsonb) order by x.n)
        from jsonb_array_elements(v -> 'contatos') with ordinality x(item, n)), '[]'::jsonb),
    'comunicadosWhatsappLigado', comunicados_whatsapp_ativos());
end $$;

-- A lista de moradores (0160) com o filtro "sem WhatsApp para comunicados".
create or replace function plataforma_moradores(p_pessoa uuid, p_condominio uuid, p_busca text, p_estado text, p_pagina integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_digitos text;
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_estado is not null and p_estado not in ('PENDENTE', 'CONFIRMADO', 'SEM_EMAIL', 'SEM_WHATSAPP') then
    perform recusar_campos('Situação desconhecida', 'estado');
  end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_digitos := nullif(regexp_replace(coalesce(v_busca, ''), '\D', '', 'g'), '');
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with lista as (
    select cu.id, cu.contato_id, ct.nome, ct.telefone, ct.email_situacao, recebe_comunicado_whatsapp(ct) as whatsapp,
           cu.unidade_id, u.identificacao, u.andar, b.nome as bloco,
           b.ordem as bloco_ordem, cu.relacao, cu.principal, cu.estado, cu.origem, cu.versao
      from contatos_unidade cu
      join contatos ct on ct.id = cu.contato_id
      join unidades u on u.id = cu.unidade_id
      left join blocos b on b.id = u.bloco_id
     where cu.estado <> 'ENCERRADO'
       and (p_estado is null
            or (p_estado = 'SEM_EMAIL' and ct.email_situacao is distinct from 'CONFIRMADO')
            or (p_estado = 'SEM_WHATSAPP' and not recebe_comunicado_whatsapp(ct))
            or cu.estado = p_estado)
       and (v_busca is null
            or ct.nome ilike '%' || v_busca || '%'
            or u.identificacao ilike v_busca || '%'
            or b.nome ilike '%' || v_busca || '%'
            or u.andar ilike v_busca
            or ct.email ilike '%' || v_busca || '%'
            or (length(v_digitos) >= 4 and ct.telefone like '%' || v_digitos || '%'))
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'vinculoId', l.id, 'contatoId', l.contato_id, 'nome', l.nome, 'telefone', l.telefone, 'unidadeId', l.unidade_id,
               'unidade', l.identificacao, 'andar', l.andar, 'bloco', l.bloco, 'relacao', l.relacao, 'principal', l.principal,
               'estado', l.estado, 'origem', l.origem, 'versao', l.versao, 'emailSituacao', l.email_situacao,
               'comunicadosWhatsapp', l.whatsapp)) order by l.ordem)
             from (select *, row_number() over (order by bloco_ordem nulls first, lower(bloco) nulls first, chave_andar(andar),
                                                         chave_unidade(identificacao), principal desc, lower(nome)) as ordem from lista) l
            where l.ordem > (v_pagina - 1) * 50 and l.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from lista),
    'pagina', v_pagina,
    'porPagina', 50,
    'aConfirmar', (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa where cu.estado = 'PENDENTE'),
    'semEmail', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                  where cu.estado <> 'ENCERRADO' and ct.email_situacao is distinct from 'CONFIRMADO'),
    'semWhatsapp', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                     where cu.estado <> 'ENCERRADO' and not recebe_comunicado_whatsapp(ct)),
    'comunicadosWhatsappLigado', comunicados_whatsapp_ativos(),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'))
    into v;
  return v;
end $$;

-- No registro do pedido, a linha dos moradores afetados conta o WhatsApp (decisão 1).
alter function avisos_do_registro(uuid) rename to avisos_do_registro_f66;
create function avisos_do_registro(p_pedido uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(case when x ->> 'destino' = 'MORADORES' and x ? 'comunicadoId'
                                 then x || jsonb_build_object('whatsapps', (select count(*) from envios_whatsapp e
                                                                             where e.comunicado_id = (x ->> 'comunicadoId')::uuid))
                                 else x end order by n), '[]'::jsonb)
    from jsonb_array_elements(avisos_do_registro_f66(p_pedido)) with ordinality y(x, n)
$$;

alter function plataforma_quem_avisar(uuid, uuid, jsonb) rename to quem_avisar_f66;
alter function quem_avisar_f66(uuid, uuid, jsonb) security invoker;
create function plataforma_quem_avisar(p_pessoa uuid, p_condominio uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := quem_avisar_f66(p_pessoa, p_condominio, p_dados);
  return jsonb_set(v, '{moradores}', (v -> 'moradores') || jsonb_build_object('whatsapp', comunicados_whatsapp_ativos()));
end $$;

call fechar_acesso();

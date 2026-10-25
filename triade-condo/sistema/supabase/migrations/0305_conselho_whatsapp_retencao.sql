-- 0305 · Conselho: o link pelo WhatsApp e o prazo do contato de quem saiu (peça R5.3; V-14, W-20,
-- W-16, F0.11 e PT-11). Continua a 0303 (Decisões e aprovações) e a 0301 (retenção).
--
-- Regras desta parte:
-- 1. Os três modelos do link do conselheiro (voto, substituto do síndico ausente e aviso da
--    vencida) ficam todos no bloco "Os modelos" logo abaixo: é o único lugar dos textos. O texto
--    guardado na fila sai do modelo com [link] no lugar do link; o código nasce só na hora de
--    enviar e a api-plataforma o põe no lugar de [link] (rota /conselho, a mesma do e-mail). O
--    texto guardado nunca tem o código.
-- 2. O link do membro com canal WhatsApp entra na fila do WhatsApp quando o condomínio está com o
--    número conectado, o modelo está em uso naquele número (piloto ou oficial), o celular do
--    membro é um número de WhatsApp e o número não pediu PARAR. A resposta traz envio "WHATSAPP"
--    e estado "NA_FILA". Falta qualquer uma dessas coisas: continua o "COPIAR" da 0303, com o
--    motivo em semWhatsapp (WHATSAPP_DESLIGADO, SEM_MODELO, SEM_NUMERO ou PAROU).
-- 3. O síndico e quem tem conselho.editar continuam podendo copiar o link: quando o link vai pelo
--    WhatsApp, a resposta traz também o código para eles (é outro código, que vale junto com o
--    da mensagem). Para os outros, o código não volta.
-- 4. Mandar de novo cancela a mensagem que ainda está na fila e para os códigos de antes. Na
--    hora de enviar, a fila cancela o que não vale mais (o membro saiu, o mandato venceu, passou
--    a suplente, trocou o contato ou o canal, a decisão fechou, a ausência acabou, o número
--    pediu PARAR). Mensagem que falha de vez para o código que ela levaria.
-- 5. PARAR e VOLTAR (W-16): o membro do conselho que não é morador também pode parar. O PARAR que
--    chega de um número que não é de contato cadastrado, mas é de um membro do conselho, marca o
--    membro (whatsapp_parou_em) e a Nina confirma. O morador continua parando pelo contato. Por
--    isso os três modelos levam o rodapé do PARAR, e o "para" dos modelos ganha CONSELHO: quem
--    recebe não é necessariamente morador (nem é equipe ou prestador).
-- 6. Retenção do conselho (tipo 33 do inventário, que passa a NA_ROTINA): 90 dias depois de sair
--    do conselho, o celular e o e-mail do membro são apagados e a linha fica, com
--    contato_apagado_em; o nome, o papel, o mandato e os votos ficam. "Sair do conselho" é o que
--    vier primeiro: ser retirado (retirado_em) ou o fim do mandato (o dia seguinte a mandato_fim,
--    no fuso do condomínio). Quem está ligado a uma pessoa com conta ou a um contato de morador
--    guarda só a ligação: o contato do morador segue o tipo CONTATO, e a conta, a dela. A cópia do
--    contato que a 0303 guardou nos envios do link (e-mail e WhatsApp) é apagada junto; o que ainda
--    está na fila é cancelado; o envio que está saindo naquela hora fica para o prazo dos envios
--    (tipo ENVIO, 12 meses). Membro com contato guardado por obrigação legal fica inteiro.
-- 7. Se o síndico renovar o mandato de quem teve o contato apagado, ele informa o contato de novo
--    e a marca de apagado sai.
--
-- As funções internas que mudam (retencao_candidatos, retencao_aplicar_item, mandar_link_conselho,
-- votacao_json, links_extras_json e membro_json) são refeitas com create or replace, com a mesma
-- assinatura e sem security definer, como eram: elas rodam dentro das funções da Plataforma e da
-- rotina. As de entrada (whatsapp_pegar_lote e processar_mensagem_whatsapp) seguem a convenção de
-- renomear a anterior e chamá-la.

-- ---------------------------------------------------------------------------------------
-- Os modelos (regra 1). Textos propostos à Carolina em 25/10/2026: para mudar, mude só aqui.
-- O corpo não começa nem termina com variável (regra da Meta, modelo_corpo_valido): por isso o
-- "Conselho do {{1}}:" na frente do substituto e do aviso.

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador', 'comunicado_publicado', 'encomenda_guardada',
                   'conselho_voto', 'conselho_substituto', 'conselho_aviso'));
alter table modelos_whatsapp drop constraint modelos_whatsapp_para_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_para_check check (para in ('MORADOR', 'EQUIPE', 'PRESTADOR', 'CONSELHO'));

insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('conselho_voto', 1, 'Votação do conselho', 'CONSELHO', 'Decisão ou despesa pedida ao conselho, com o link pessoal do titular',
   '["condomínio", "pergunta", "prazo", "link"]',
   E'Votação do conselho do {{1}}: {{2}}\n\nVote até {{3}} pelo seu link pessoal:\n{{4}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado pela Carolina em 25/10/2026', app_now()),
  ('conselho_substituto', 1, 'Substituto do síndico', 'CONSELHO', 'O subsíndico responde no lugar do síndico ausente, pelo link pessoal',
   '["condomínio", "pergunta", "prazo", "link"]',
   E'Conselho do {{1}}: o síndico está ausente e você responde no lugar dele.\n\n{{2}}, até {{3}}:\n{{4}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado pela Carolina em 25/10/2026', app_now()),
  ('conselho_aviso', 1, 'Decisão vencida', 'CONSELHO', 'Decisão ou despesa vencida sem resposta, para quem as regras mandam avisar',
   '["condomínio", "pergunta", "prazo", "link"]',
   E'Conselho do {{1}}: a decisão "{{2}}" passou do prazo de {{3}} sem resposta. Veja pelo link:\n{{4}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado pela Carolina em 25/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave in ('conselho_voto', 'conselho_substituto', 'conselho_aviso');

-- O modelo de cada finalidade do link.
create function modelo_do_link_conselho(p_finalidade text) returns text
language sql immutable
set search_path = public
as $$ select case p_finalidade when 'VOTO' then 'conselho_voto' when 'SUBSTITUTO' then 'conselho_substituto' else 'conselho_aviso' end $$;

-- ---------------------------------------------------------------------------------------
-- A fila do WhatsApp: a finalidade, o link e o código de cada envio.

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO', 'PRESTADOR',
                        'PROTOCOLO', 'AVISO_PRESTADOR', 'COMUNICADO', 'ENCOMENDA', 'CONSELHO'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador',
                          'comunicado_publicado', 'encomenda_guardada', 'conselho_voto', 'conselho_substituto', 'conselho_aviso'));
alter table envios_whatsapp
  add column link_conselho_id uuid,
  add constraint envios_whatsapp_link_conselho foreign key (link_conselho_id, condominio_id) references links_conselho (id, condominio_id),
  add constraint envios_whatsapp_conselho_tem_link check ((finalidade = 'CONSELHO') = (link_conselho_id is not null));
create index envios_whatsapp_link_conselho on envios_whatsapp (link_conselho_id, criado_em) where link_conselho_id is not null;

-- O código que a mensagem do WhatsApp levou (para parar se ela falha de vez).
alter table codigos_sem_conta add column envio_whatsapp_id uuid;
create index codigos_sem_conta_envio_whatsapp on codigos_sem_conta (envio_whatsapp_id) where envio_whatsapp_id is not null;

create function envios_whatsapp_regras_r5() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link_conselho_id is distinct from old.link_conselho_id then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  -- Falhou de vez: o código que esta mensagem levaria para.
  if new.estado = 'FALHOU' and old.estado <> 'FALHOU' and new.link_conselho_id is not null then
    update codigos_sem_conta set revogado_em = app_now() where envio_whatsapp_id = new.id and revogado_em is null;
  end if;
  return new;
end $$;
create trigger envios_whatsapp_regras_r5 before update on envios_whatsapp for each row execute function envios_whatsapp_regras_r5();

-- Reenviar uma falha pela tela do WhatsApp (W-14) leva o mesmo link, como o do prestador (0282).
create function envios_whatsapp_reenvio_conselho() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reenvio_de is not null and new.finalidade = 'CONSELHO' and new.link_conselho_id is null then
    select link_conselho_id into new.link_conselho_id from envios_whatsapp where id = new.reenvio_de;
  end if;
  return new;
end $$;
create trigger envios_whatsapp_reenvio_conselho before insert on envios_whatsapp for each row execute function envios_whatsapp_reenvio_conselho();

-- ---------------------------------------------------------------------------------------
-- O membro: o PARAR do número e o contato apagado pelo prazo (regras 5 a 7).

alter table conselho_membros
  add column whatsapp_parou_em  timestamptz,
  add column contato_apagado_em timestamptz;
-- O canal pede o contato, menos depois de apagado pelo prazo (0303 criou estas duas sem nome).
alter table conselho_membros drop constraint conselho_membros_check2;
alter table conselho_membros drop constraint conselho_membros_check3;
alter table conselho_membros
  add constraint conselho_membros_whatsapp_tem_celular check (canal <> 'WHATSAPP' or celular is not null or contato_apagado_em is not null),
  add constraint conselho_membros_email_tem_email check (canal <> 'EMAIL' or email is not null or contato_apagado_em is not null),
  add constraint conselho_membros_contato_apagado check (contato_apagado_em is null or (celular is null and email is null and whatsapp_parou_em is null));

-- O PARAR é do número: trocar o celular tira a marca. Informar o contato de novo tira a marca de
-- apagado (regra 7).
create function conselho_membros_contato() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.celular is distinct from old.celular then new.whatsapp_parou_em := null; end if;
  if old.contato_apagado_em is not null and new.contato_apagado_em is not null and (new.celular is not null or new.email is not null) then
    new.contato_apagado_em := null;
  end if;
  return new;
end $$;
create trigger conselho_membros_contato before update on conselho_membros for each row execute function conselho_membros_contato();

-- A rotina apaga o contato de quem foi retirado (regra 7 da 0301: só dentro dela).
call liberar_para_retencao('conselho_membros', 'conselho_membros_regras');

-- O celular do membro no formato do WhatsApp (+, DDI e número). Sem DDI, é do Brasil. Nulo
-- quando não dá um número válido.
create function celular_whatsapp(p text) returns text
language sql immutable
set search_path = public
as $$
  select case when telefone_valido(x) then x end
    from (select case when btrim(coalesce(p, '')) like '+%' then '+' || d
                      when length(d) in (10, 11) then '+55' || d
                      else '+' || d end as x
            from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s) t
$$;

-- O número pediu PARAR: pelo membro (quem não é morador) ou por um contato com o mesmo número.
create function numero_parou_conselho(p_telefone text, m conselho_membros) returns boolean
language sql stable
set search_path = public
as $$
  select m.whatsapp_parou_em is not null
      or exists (select 1 from contatos ct where ct.telefone = any (variantes_telefone(p_telefone))
                                             and ct.whatsapp_parou_em is not null and ct.dados_removidos_em is null)
$$;

-- Por que o link do membro não vai pelo WhatsApp agora (regra 2); nulo quando vai.
create function sem_whatsapp_conselho(m conselho_membros, p_finalidade text) returns text
language sql stable
set search_path = public
as $$
  select case
    when (conexao_conectada()).id is null then 'WHATSAPP_DESLIGADO'
    when (modelo_em_uso(modelo_do_link_conselho(p_finalidade), (conexao_conectada()).oficial)).id is null then 'SEM_MODELO'
    when celular_whatsapp(m.celular) is null then 'SEM_NUMERO'
    when numero_parou_conselho(celular_whatsapp(m.celular), m) then 'PAROU' end
$$;

-- As variáveis do modelo: condomínio, pergunta (ou a despesa com o valor), prazo e [link].
create function parametros_link_conselho(l links_conselho) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_array(nome_do_condominio(),
                           coalesce(d.pergunta, x.descricao || ' (despesa de ' || reais(x.valor) || ')'),
                           data_br(coalesce(d.prazo, x.prazo)), '[link]')
    from (select 1) um
    left join decisoes_pedido d on d.id = l.decisao_id
    left join despesas_aprovacao x on x.id = l.despesa_id
$$;

-- O código da mensagem do WhatsApp, na hora de enviar: não para os de antes (o mandar de novo já
-- parou), e fica ligado à mensagem para parar se ela falhar de vez (regra 4).
create function codigo_conselho_whatsapp(l links_conselho, p_envio uuid) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  loop
    v_codigo := novo_codigo();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id, envio_whatsapp_id)
  values (hash_codigo(v_codigo), l.condominio_id, 'CONSELHO', l.id, p_envio);
  update links_conselho set codigo_em = app_now() where id = l.id;
  return v_codigo;
end $$;

-- A mensagem na fila ainda vale? Nulo quando vale; senão, o motivo de cancelar (regra 4).
create function cancelar_envio_conselho(e envios_whatsapp) returns text
language plpgsql
stable
set search_path = public
as $$
declare
  l links_conselho;
  m conselho_membros;
  d decisoes_pedido;
  x despesas_aprovacao;
begin
  select * into l from links_conselho where id = e.link_conselho_id;
  select * into m from conselho_membros where id = l.membro_id;
  select * into d from decisoes_pedido where id = l.decisao_id;
  select * into x from despesas_aprovacao where id = l.despesa_id;
  return case
    when l.revogado_em is not null then 'O link não vale mais'
    when not membro_em_dia(m) then 'O membro saiu do conselho ou o mandato venceu'
    when l.finalidade = 'VOTO' and not membro_titular(m) then 'O membro passou a suplente'
    when m.canal <> 'WHATSAPP' or not coalesce(celular_whatsapp(m.celular) = any (variantes_telefone(e.para)), false)
      then 'O contato do membro mudou'
    when coalesce(d.estado, x.estado) <> 'AGUARDANDO' then 'Já foi respondida ou retirada'
    when l.finalidade = 'VOTO' and coalesce(d.modo, x.modo) <> 'CONSELHO' then 'A votação fechou'
    when l.finalidade = 'SUBSTITUTO' and not substituto_vale(l) then 'A ausência do síndico acabou'
    when numero_parou_conselho(e.para, m) then 'A pessoa pediu para parar de receber avisos' end;
end $$;

-- ---------------------------------------------------------------------------------------
-- Mandar o link (regras 2 a 4): o e-mail como na 0303; o WhatsApp pela fila quando dá; senão,
-- para copiar.

create or replace function mandar_link_conselho(l links_conselho, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  m conselho_membros;
  v jsonb;
  v_sem text;
  v_modelo modelos_whatsapp;
  v_params jsonb;
begin
  m := exigir_membro(l.membro_id);
  v := jsonb_strip_nulls(jsonb_build_object('membroId', m.id, 'nome', m.nome, 'canal', m.canal, 'finalidade', l.finalidade,
                                            'decisaoId', l.decisao_id, 'despesaId', l.despesa_id));
  if m.canal = 'EMAIL' then
    update envios_whatsapp set estado = 'CANCELADA', motivo = 'O link foi mandado de novo' where link_conselho_id = l.id and estado = 'NA_FILA';
    update envios_email set estado = 'CANCELADO', motivo = 'O link foi mandado de novo' where link_conselho_id = l.id and estado = 'NA_FILA';
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'CONSELHO' and alvo_id = l.id and revogado_em is null;
    insert into envios_email (condominio_id, tipo, link_conselho_id, para, criado_por) values (l.condominio_id, 'CONSELHO', l.id, m.email, p_pessoa);
    return v || jsonb_build_object('envio', 'EMAIL');
  end if;
  v_sem := sem_whatsapp_conselho(m, l.finalidade);
  if v_sem is null then
    update envios_whatsapp set estado = 'CANCELADA', motivo = 'O link foi mandado de novo' where link_conselho_id = l.id and estado = 'NA_FILA';
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'CONSELHO' and alvo_id = l.id and revogado_em is null;
    v_modelo := modelo_em_uso(modelo_do_link_conselho(l.finalidade), (conexao_conectada()).oficial);
    v_params := parametros_link_conselho(l);
    insert into envios_whatsapp (condominio_id, para, contato_id, finalidade, texto, responsavel, criado_por, link_conselho_id,
                                 modelo_chave, modelo_parametros)
    values (l.condominio_id, celular_whatsapp(m.celular), m.contato_id, 'CONSELHO', left(renderizar_modelo(v_modelo, v_params), 4096),
            coalesce(p_pessoa, (quem_cuida_dos_pedidos())[1]), p_pessoa, l.id, v_modelo.chave, v_params);
    v := v || jsonb_build_object('envio', 'WHATSAPP', 'estado', 'NA_FILA');
    if mostra_codigo_conselho(p_pessoa) then v := v || jsonb_build_object('codigo', novo_codigo_conselho(l, false)); end if;
    return v;
  end if;
  v := v || jsonb_build_object('semWhatsapp', v_sem);
  if not mostra_codigo_conselho(p_pessoa) then
    return v || jsonb_build_object('envio', 'COPIAR', 'aviso', 'Peça o link ao síndico');
  end if;
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'O link foi mandado de novo' where link_conselho_id = l.id and estado = 'NA_FILA';
  return v || jsonb_build_object('envio', 'COPIAR', 'codigo', novo_codigo_conselho(l));
end $$;

-- O envio do link para as telas: a situação do último envio (e-mail ou WhatsApp) ou COPIAR.
create function envio_link_conselho(p_link uuid, p_canal text) returns text
language sql stable
set search_path = public
as $$
  select coalesce((select z.estado from (select e.estado, e.criado_em from envios_email e where e.link_conselho_id = p_link
                                          union all
                                          select w.estado, w.criado_em from envios_whatsapp w where w.link_conselho_id = p_link) z
                    order by z.criado_em desc limit 1),
                  case when p_canal = 'WHATSAPP' then 'COPIAR' end)
$$;

create or replace function votacao_json(p_decisao uuid, p_despesa uuid, p_titulares integer, p_necessarios integer, p_aguardando boolean,
                                        p_prazo date, p_pessoa uuid, p_gestao boolean)
returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.*, m.nome, m.papel, m.pessoa_id, m.canal as canal_membro, membro_em_dia(m) as em_dia, membro_vota(m) as vota
      from votos_conselho x join conselho_membros m on m.id = x.membro_id
     where x.decisao_id = p_decisao or x.despesa_id = p_despesa
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'titulares', p_titulares, 'necessarios', p_necessarios,
    'votaram', (select count(*) from v where escolha is not null),
    'contagem', case when p_gestao or not p_aguardando then
                  coalesce((select jsonb_object_agg(escolha, n) from (select escolha, count(*) as n from v where escolha is not null group by escolha) c), '{}'::jsonb) end,
    'faltam', case when p_gestao then (select jsonb_agg(nome order by lower(nome)) from v where escolha is null and vota) end,
    'votos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'membroId', v.membro_id, 'nome', v.nome, 'papel', v.papel, 'escolha', v.escolha, 'justificativa', v.justificativa,
               'votadoEm', v.votado_em, 'canal', v.canal, 'emDia', v.em_dia, 'eu', v.pessoa_id is not distinct from p_pessoa and p_pessoa is not null,
               'link', case when p_gestao then (
                 select jsonb_strip_nulls(jsonb_build_object('canal', v.canal_membro, 'abertoEm', l.aberto_em, 'mandadoEm', l.codigo_em,
                          'envio', envio_link_conselho(l.id, v.canal_membro),
                          'podeReenviar', p_aguardando and v.vota and p_prazo >= hoje_no_condominio()))
                   from links_conselho l where l.membro_id = v.membro_id and (l.decisao_id = p_decisao or l.despesa_id = p_despesa)
                                           and l.finalidade = 'VOTO') end))
             order by v.papel <> 'SUBSINDICO', lower(v.nome))
        from v where p_gestao or not p_aguardando or v.pessoa_id = p_pessoa), '[]'::jsonb),
    'eu', (select jsonb_strip_nulls(jsonb_build_object('membroId', v.membro_id, 'escolha', v.escolha, 'justificativa', v.justificativa,
                                                       'votadoEm', v.votado_em,
                                                       'podeVotar', p_aguardando and v.vota and p_prazo >= hoje_no_condominio()))
             from v where v.pessoa_id = p_pessoa and p_pessoa is not null limit 1)))
$$;

create or replace function links_extras_json(p_decisao uuid, p_despesa uuid, p_aberto boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'membroId', m.id, 'nome', m.nome, 'finalidade', l.finalidade, 'canal', m.canal, 'abertoEm', l.aberto_em, 'mandadoEm', l.codigo_em,
           'envio', envio_link_conselho(l.id, m.canal),
           'podeReenviar', p_aberto and membro_em_dia(m) and (l.finalidade <> 'SUBSTITUTO' or substituto_vale(l))))
         order by l.finalidade, lower(m.nome)), '[]'::jsonb)
    from links_conselho l join conselho_membros m on m.id = l.membro_id
   where (l.decisao_id = p_decisao or l.despesa_id = p_despesa) and l.finalidade <> 'VOTO' and l.revogado_em is null
$$;

-- O membro nas telas: também o contato apagado pelo prazo e o PARAR do número.
create or replace function membro_json(m conselho_membros, p_contatos boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'versao', m.versao, 'nome', m.nome, 'papel', m.papel, 'titular', membro_titular(m),
    'pessoaId', m.pessoa_id, 'contatoId', m.contato_id,
    'unidade', case when m.contato_id is not null then unidades_do_contato(m.contato_id) end,
    'mandatoInicio', to_char(m.mandato_inicio, 'YYYY-MM-DD'), 'mandatoFim', to_char(m.mandato_fim, 'YYYY-MM-DD'),
    'emDia', membro_em_dia(m), 'vota', membro_titular(m) and membro_em_dia(m),
    'mandatoVencendo', membro_em_dia(m) and m.mandato_fim - hoje_no_condominio() <= 30,
    'canal', m.canal, 'painel', membro_com_painel(m),
    'celular', case when p_contatos then m.celular end, 'email', case when p_contatos then m.email end,
    'celularMascarado', celular_mascarado(m.celular), 'emailMascarado', email_mascarado(m.email),
    'whatsappParou', case when m.canal = 'WHATSAPP' and m.celular is not null
                          then numero_parou_conselho(coalesce(celular_whatsapp(m.celular), m.celular), m) end,
    'contatoApagadoEm', m.contato_apagado_em,
    'incluidoEm', m.incluido_em, 'retiradoEm', m.retirado_em, 'retiradoMotivo', case when p_contatos then m.retirado_motivo end))
$$;

-- ---------------------------------------------------------------------------------------
-- A fila: antes do lote, cancela o que não vale mais; depois, dá a cada mensagem do link o seu
-- código, que a api-plataforma põe no lugar de [link] (rota /conselho).

alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_r5;
alter function pegar_lote_whatsapp_r5(integer) security invoker;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  e envios_whatsapp;
  l links_conselho;
  v_motivo text;
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  lote jsonb;
  x jsonb;
  v_envios jsonb;
begin
  -- Como no lote (0210): só o verificador enxerga todos os condomínios.
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    for e in select * from envios_whatsapp where estado = 'NA_FILA' and finalidade = 'CONSELHO' loop
      v_motivo := cancelar_envio_conselho(e);
      if v_motivo is not null then
        update envios_whatsapp set estado = 'CANCELADA', motivo = v_motivo where id = e.id;
      end if;
    end loop;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  v_lotes := pegar_lote_whatsapp_r5(p_max);
  for lote in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((lote ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(lote -> 'envios') loop
      select * into e from envios_whatsapp where id = (x ->> 'envio')::uuid;
      if e.finalidade = 'CONSELHO' then
        select * into l from links_conselho where id = e.link_conselho_id;
        x := x || jsonb_build_object('link', codigo_conselho_whatsapp(l, e.id), 'rota', 'conselho');
      end if;
      v_envios := v_envios || jsonb_build_array(x);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(lote, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

-- ---------------------------------------------------------------------------------------
-- PARAR e VOLTAR de quem é do conselho e não é contato cadastrado (regra 5). O morador segue
-- pelo contato, como sempre.

alter function processar_mensagem_whatsapp(mensagens_whatsapp) rename to processar_mensagem_comunicados;
create function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cmd text := regexp_replace(upper(btrim(regexp_replace(coalesce(m.texto, ''), '\s+', ' ', 'g'))), '[.!]+$', '');
  v_membros uuid[];
begin
  if v_cmd in ('PARAR', 'VOLTAR') and cardinality(contatos_do_telefone(m.telefone)) = 0 then
    select array_agg(x.id order by x.incluido_em) into v_membros from conselho_membros x
     where x.retirado_em is null and x.contato_apagado_em is null and celular_whatsapp(x.celular) = any (variantes_telefone(m.telefone));
    if v_membros is not null then
      insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone)
      on conflict (condominio_id, telefone) do update set atualizada_em = app_now();
      update conselho_membros set whatsapp_parou_em = case when v_cmd = 'PARAR' then app_now() end
       where id = any (v_membros) and (whatsapp_parou_em is null) = (v_cmd = 'PARAR');
      if v_cmd = 'PARAR' then
        update envios_whatsapp set estado = 'CANCELADA', motivo = 'A pessoa pediu para parar de receber avisos'
         where estado = 'NA_FILA' and finalidade = 'CONSELHO' and para = any (variantes_telefone(m.telefone));
      end if;
      update mensagens_whatsapp set triagem = 'ARQUIVADA', tratada_em = app_now(),
                                    triagem_motivo = case when v_cmd = 'PARAR' then 'Membro do conselho pediu para parar os avisos'
                                                          else 'Membro do conselho voltou a receber os avisos' end
       where id = m.id;
      perform registrar_historico(case when v_cmd = 'PARAR' then 'conselho.whatsapp_parou' else 'conselho.whatsapp_voltou' end,
                                  'conselho_membros', v_membros[1]::text, jsonb_build_object('membros', cardinality(v_membros)));
      perform responder_whatsapp(m.telefone, null, null, case when v_cmd = 'PARAR'
        then 'Pronto: você não recebe mais os links do conselho do ' || nome_do_condominio() || ' por aqui. O síndico pode mandar o link por outro meio. Para voltar, mande VOLTAR.'
        else 'Pronto: você volta a receber os links do conselho do ' || nome_do_condominio() || ' por aqui.' end);
      return;
    end if;
  end if;
  perform processar_mensagem_comunicados(m);
end $$;

-- ---------------------------------------------------------------------------------------
-- Retenção do conselho (regra 6): o tipo 33 entra na rotina.

-- Apaga o contato do membro e a cópia dele nos envios do link. Devolve 0 (não há arquivo).
create function apagar_contato_conselho(p_id uuid) returns integer
language plpgsql
set search_path = public
as $$
declare r record;
begin
  update envios_email set estado = 'CANCELADO', motivo = 'O contato do membro foi apagado pelo prazo'
   where estado = 'NA_FILA' and link_conselho_id in (select id from links_conselho where membro_id = p_id);
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'O contato do membro foi apagado pelo prazo'
   where estado = 'NA_FILA' and link_conselho_id in (select id from links_conselho where membro_id = p_id);
  for r in select e.id from envios_email e join links_conselho l on l.id = e.link_conselho_id
            where l.membro_id = p_id and e.dados_apagados_em is null and e.estado not in ('NA_FILA', 'ENVIANDO') loop
    perform apagar_envio_email(r.id);
  end loop;
  for r in select w.id from envios_whatsapp w join links_conselho l on l.id = w.link_conselho_id
            where l.membro_id = p_id and w.dados_apagados_em is null and w.estado not in ('NA_FILA', 'ENVIANDO') loop
    perform apagar_envio_whatsapp(r.id);
  end loop;
  update conselho_membros set celular = null, email = null, whatsapp_parou_em = null, contato_apagado_em = app_now()
   where id = p_id and contato_apagado_em is null;
  return 0;
end $$;

create or replace function retencao_candidatos(p_ref timestamptz) returns table (codigo text, tabela text, alvo text)
language sql stable
set search_path = public
as $$
  -- 3. Contato que saiu da última unidade há 180 dias, sem pedido aberto e sem guarda.
  select 'CONTATO', 'contatos', c.id::text from contatos c
   where c.dados_removidos_em is null
     and exists (select 1 from contatos_unidade cu where cu.contato_id = c.id)
     and not exists (select 1 from contatos_unidade cu where cu.contato_id = c.id and cu.estado <> 'ENCERRADO')
     and (select max(cu.encerrado_em) from contatos_unidade cu where cu.contato_id = c.id) < p_ref - interval '180 days'
     and not exists (select 1 from pedidos p where p.contato_id = c.id and p.estado not in ('ENCERRADO', 'CANCELADO'))
     and not contato_protegido(c.id)
  union all
  -- 4 e 5. Família e pets 90 dias depois de sair.
  select 'FAMILIA', 'familiares_unidade', f.id::text from familiares_unidade f
   where f.dados_apagados_em is null and f.saiu_em < p_ref - interval '90 days'
  union all
  select 'PET', 'pets_unidade', p.id::text from pets_unidade p
   where p.dados_apagados_em is null and p.saiu_em < p_ref - interval '90 days'
  union all
  -- 6. Veículo retirado há 90 dias.
  select 'VEICULO', 'veiculos', v.id::text from veiculos v
   where v.retirado_em < p_ref - interval '90 days' and (v.placa is not null or v.modelo is not null) and not contato_protegido(v.contato_id)
  union all
  -- 7. Cópia do cadastro por link aprovado há 30 dias.
  select 'CADASTRO_LINK', 'cadastros_link', l.id::text from cadastros_link l
   where l.estado = 'APROVADO' and l.dados_apagados_em is null and l.decidido_em < p_ref - interval '30 days'
  union all
  -- 11. Mensagem que não virou pedido, 90 dias depois de chegar (a do classificado segue o classificado).
  select 'MENSAGEM', 'mensagens_whatsapp', m.id::text from mensagens_whatsapp m
   where m.apagada_em is null and m.pedido_id is null and m.recebida_em < p_ref - interval '90 days'
     and not exists (select 1 from classificados k where k.foto_mensagem_id = m.id) and not contato_protegido(m.contato_id)
  union all
  -- 12. Conversa parada há 30 dias.
  select 'CONVERSA', 'conversas_whatsapp', w.id::text from conversas_whatsapp w
   where w.atualizada_em < p_ref - interval '30 days'
  union all
  -- 14. Envios de 12 meses atrás que já saíram da fila.
  select 'ENVIO', 'envios_whatsapp', e.id::text from envios_whatsapp e
   where e.dados_apagados_em is null and e.criado_em < p_ref - interval '12 months' and e.estado not in ('NA_FILA', 'ENVIANDO')
     and (e.encomenda_id is null or not guardado('ENCOMENDA', e.encomenda_id))
     and (e.pedido_id is null or not guardado('PEDIDO', e.pedido_id)) and not contato_protegido(e.contato_id)
  union all
  select 'ENVIO', 'envios_email', e.id::text from envios_email e
   where e.dados_apagados_em is null and e.criado_em < p_ref - interval '12 months' and e.estado not in ('NA_FILA', 'ENVIANDO')
     and (e.pedido_id is null or not guardado('PEDIDO', e.pedido_id))
     and (e.pedido_atendimento_id is null or not guardado('PEDIDO', e.pedido_atendimento_id)) and not contato_protegido(e.contato_id)
  union all
  -- 15. Avisos vistos há 12 meses.
  select 'AVISO', 'avisos', a.id::text from avisos a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_decisao', a.id::text from avisos_decisao a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_documento', a.id::text from avisos_documento a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_email', a.id::text from avisos_email a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_manutencao', a.id::text from avisos_manutencao a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_memoria', a.id::text from avisos_memoria a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_pedido_documento', a.id::text from avisos_pedido_documento a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_prestador', a.id::text from avisos_prestador a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_reserva', a.id::text from avisos_reserva a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_triade', a.id::text from avisos_triade a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_vida', a.id::text from avisos_vida a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_whatsapp', a.id::text from avisos_whatsapp a where a.visto_em < p_ref - interval '12 months'
  union all
  -- 18. E-mail de quem pediu documento, 12 meses depois.
  select 'PEDIDO_DOCUMENTO', 'pedidos_documento', d.id::text from pedidos_documento d
   where d.dados_apagados_em is null and d.estado <> 'ESPERANDO' and d.criado_em < p_ref - interval '12 months'
  union all
  -- 19. Reserva de 24 meses atrás: fica a unidade e a data.
  select 'RESERVA', 'reservas', r.id::text from reservas r
   where r.dados_apagados_em is null and r.data < (p_ref - interval '24 months')::date and not contato_protegido(r.contato_id)
  union all
  -- 21. Classificado fora do mural há 90 dias.
  select 'CLASSIFICADO', 'classificados', k.id::text from classificados k
   where k.apagado_em is null and not contato_protegido(k.contato_id)
     and case k.estado when 'RETIRADO' then k.retirado_em
                       when 'RECUSADO' then k.decidido_em
                       when 'NO_MURAL' then (k.no_mural_ate + 1)::timestamptz
                       else null end < p_ref - interval '90 days'
  union all
  -- 22. Encomenda: a foto 90 dias depois de entregue, os nomes 12 meses depois.
  select 'ENCOMENDA', 'fotos_encomenda', f.id::text from fotos_encomenda f join encomendas e on e.id = f.encomenda_id
   where f.apagada_em is null and f.situacao = 'LIBERADO' and e.entregue_em < p_ref - interval '90 days' and not guardado('ENCOMENDA', e.id)
  union all
  select 'ENCOMENDA', 'encomendas', e.id::text from encomendas e
   where e.dados_apagados_em is null and e.entregue_em < p_ref - interval '12 months' and not guardado('ENCOMENDA', e.id)
  union all
  -- 24. Imagens de chamado 24 meses depois de resolvido.
  select 'CHAMADO', 'arquivos_chamado', a.id::text from arquivos_chamado a join chamados ch on ch.id = a.chamado_id
   where a.apagado_em is null and a.situacao = 'LIBERADO' and ch.resolvido_em < p_ref - interval '24 months'
  union all
  -- 25. Exportação vencida (7 dias).
  select 'EXPORTACAO', 'exportacoes', x.id::text from exportacoes x
   where x.arquivos_apagados_em is null and x.expira_em < p_ref
  union all
  -- 26. Links e códigos vencidos ou revogados há 90 dias.
  select 'LINK', 'links_publicos', encode(l.hash, 'hex') from links_publicos l
   where l.condominio_id = contexto_condominio() and coalesce(l.revogado_em, l.expira_em) < p_ref - interval '90 days'
  union all
  select 'LINK', 'codigos_sem_conta', encode(c.hash, 'hex') from codigos_sem_conta c
   where c.condominio_id = contexto_condominio() and c.revogado_em < p_ref - interval '90 days'
  union all
  -- 33. Conselho: o contato de quem saiu há 90 dias (retirado, ou o mandato acabou: conta do dia
  -- seguinte ao fim, no fuso do condomínio). Nome, papel, mandato e votos ficam.
  select 'CONSELHO', 'conselho_membros', m.id::text from conselho_membros m
   where m.contato_apagado_em is null and (m.celular is not null or m.email is not null)
     and least(m.retirado_em, ((m.mandato_fim + 1)::timestamp at time zone fuso_do_condominio())) < p_ref - interval '90 days'
     and not contato_protegido(m.contato_id)
$$;

create or replace function retencao_aplicar_item(p_tabela text, p_alvo text) returns integer
language plpgsql
set search_path = public
as $$
declare v_caminho text; v_arquivos integer := 0; r record;
begin
  case p_tabela
  when 'contatos' then
    v_arquivos := apagar_dados_contato(p_alvo::uuid, null, 'PRAZO');
  when 'familiares_unidade' then
    update familiares_unidade set nome = null, aniversario_dia = null, aniversario_mes = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'pets_unidade' then
    update pets_unidade set nome = null, raca = null, observacao = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'veiculos' then
    update veiculos set placa = null, modelo = null where id = p_alvo::uuid;
  when 'cadastros_link' then
    update cadastros_link set nome = null, telefone = null, ligacao = null, email = null, aniversario_dia = null, aniversario_mes = null,
                              familia = '[]', pets = '[]', veiculos = '[]', dados_apagados_em = app_now()
     where id = p_alvo::uuid;
  when 'mensagens_whatsapp' then
    v_arquivos := apagar_mensagem(p_alvo::uuid);
  when 'conversas_whatsapp' then
    delete from conversas_whatsapp where id = p_alvo::uuid;
  when 'envios_whatsapp' then
    perform apagar_envio_whatsapp(p_alvo::uuid);
  when 'envios_email' then
    perform apagar_envio_email(p_alvo::uuid);
  when 'pedidos_documento' then
    update pedidos_documento set email = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'reservas' then
    update reservas set contato_id = null, observacao = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'classificados' then
    v_arquivos := apagar_classificado(p_alvo::uuid);
  when 'fotos_encomenda' then
    select caminho into v_caminho from fotos_encomenda where id = p_alvo::uuid;
    v_arquivos := enfileirar_arquivo('portaria', v_caminho, 'ENCOMENDA');
    update fotos_encomenda set situacao = 'NAO_LIBERADO', tamanho = null, motivo_recusa = 'Apagada pelo prazo', apagada_em = app_now()
     where id = p_alvo::uuid;
  when 'encomendas' then
    update encomendas set retirou_nome = null, retirou_ligacao = null, outro_meio_com = null, observacao = null, dados_apagados_em = app_now()
     where id = p_alvo::uuid;
  when 'arquivos_chamado' then
    select caminho into v_caminho from arquivos_chamado where id = p_alvo::uuid;
    v_arquivos := enfileirar_arquivo('suporte', v_caminho, 'CHAMADO');
    update arquivos_chamado set situacao = 'NAO_LIBERADO', tamanho = null, motivo_recusa = 'Apagada pelo prazo', apagado_em = app_now()
     where id = p_alvo::uuid;
  when 'exportacoes' then
    for r in select caminho from partes_exportacao where exportacao_id = p_alvo::uuid and caminho is not null loop
      v_arquivos := v_arquivos + enfileirar_arquivo('exportacoes', r.caminho, 'EXPORTACAO');
    end loop;
    update exportacoes set arquivos_apagados_em = app_now() where id = p_alvo::uuid;
  when 'links_publicos' then
    delete from links_publicos where hash = decode(p_alvo, 'hex');
  when 'codigos_sem_conta' then
    delete from codigos_sem_conta where hash = decode(p_alvo, 'hex');
  when 'conselho_membros' then
    v_arquivos := apagar_contato_conselho(p_alvo::uuid);
  else
    if p_tabela like 'avisos%' then
      execute format('delete from %I where id = $1::uuid', p_tabela) using p_alvo;
    else
      raise exception 'Tabela sem regra de retenção: %', p_tabela;
    end if;
  end case;
  return v_arquivos;
end $$;

update retencao_tipos set situacao = 'NA_ROTINA' where codigo = 'CONSELHO';

call fechar_acesso();

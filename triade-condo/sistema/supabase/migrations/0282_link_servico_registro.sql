-- 0282 · Link do serviço para o prestador avisado no registro (F6.7; MP-09, V-11). Desenho em
-- docs/telas/link-servico-registro.html, aprovado pela Carolina em 20/10/2026.
--
-- Regras desta parte (as decisões do desenho):
-- 1. Ao escolher o prestador no registro, "Mandar o link do serviço" vem marcado. Desmarcado, o
--    prestador recebe só o texto, como no F6.4 (0281).
-- 2. Com o link, nasce na mesma transação uma manutenção corretiva ligada ao pedido: título do
--    assunto, local do pedido (sem a unidade de quem pediu), prioridade do pedido e o responsável
--    do pedido (sem ele, ou se ele não vê a manutenção, quem registra). Precisa da permissão de
--    editar manutenção.
-- 3. Quem registra diz só quando e como entrar; "o que fazer" é a mensagem ao prestador. A
--    validade (padrão 7 dias) e o prazo para responder vêm preenchidos.
-- 4. O link do registro não leva arquivos.
-- 5. No WhatsApp, o link sai pelo modelo link_prestador (o mesmo da troca para a reserva); o texto
--    do pedido fica dentro do link. No e-mail, vão o texto, o prazo e o link.
-- 6. Prestador sem celular nem e-mail não é escolhido no registro, como no F6.4.
-- 7. O prazo para responder vem com 4 horas no pedido urgente e 24 nos outros.
-- 8. O prazo conta da saída da mensagem: enquanto ela espera na fila, não há prazo nem troca.
--    Sem reserva (ou com a troca desligada), o responsável é avisado no sino quando o prazo vence.
-- 9. Pedido, manutenção, link e mensagem gravam juntos (PT-04).
-- 10. O link é o mesmo da manutenção (0170 e 0270); a página só ganha o número do pedido.
-- 11. Cancelar o pedido não cancela a manutenção ligada.
-- 12. A criação, o envio do link e a resposta entram no histórico do pedido e da manutenção.

-- ---------------------------------------------------------------------------------------
-- O prazo que espera a mensagem sair (decisão 8).

alter table links_prestador
  add column prazo_no_envio   smallint check (prazo_no_envio in (4, 8, 24, 48)),
  add column reserva_no_envio uuid,
  add constraint links_prestador_reserva_no_envio foreign key (reserva_no_envio, condominio_id) references prestadores (id, condominio_id),
  add constraint links_prestador_reserva_no_envio_com_prazo check (reserva_no_envio is null or prazo_no_envio is not null);

-- Sem reserva, o responsável fica sabendo que o prazo venceu sem resposta.
alter table avisos_reserva drop constraint avisos_reserva_tipo_check;
alter table avisos_reserva add constraint avisos_reserva_tipo_check
  check (tipo in ('TROCOU', 'MANDAR_LINK', 'NAO_TROCOU', 'RESERVA_SEM_RESPOSTA', 'SEM_RESPOSTA'));

-- O e-mail ao prestador pode levar o link; o código nasce na hora de mandar.
alter table envios_email
  add column link_prestador_id uuid,
  add constraint envios_email_link_prestador foreign key (link_prestador_id, condominio_id) references links_prestador (id, condominio_id),
  add constraint envios_email_link_do_prestador check (link_prestador_id is null or tipo = 'PRESTADOR');

create function envios_email_regras_f67() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link_prestador_id is distinct from old.link_prestador_id then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger envios_email_regras_f67 before update on envios_email for each row execute function envios_email_regras_f67();

-- Reenviar uma falha (W-14) do link do prestador leva o mesmo link: sem ele, a fila recusaria o
-- reenvio (envios_whatsapp_prestador_tem_link). Vale também para o link da reserva (0270).
create function envios_whatsapp_reenvio_link() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reenvio_de is not null and new.finalidade = 'PRESTADOR' and new.link_prestador_id is null then
    select link_prestador_id into new.link_prestador_id from envios_whatsapp where id = new.reenvio_de;
  end if;
  return new;
end $$;
create trigger envios_whatsapp_reenvio_link before insert on envios_whatsapp for each row execute function envios_whatsapp_reenvio_link();

-- O aviso do registro guarda a manutenção e o link que nasceram com ele.
alter table avisos_registro_pedido
  add column manutencao_id     uuid,
  add column link_prestador_id uuid,
  add constraint avisos_registro_pedido_manutencao foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  add constraint avisos_registro_pedido_link foreign key (link_prestador_id, condominio_id) references links_prestador (id, condominio_id),
  add constraint avisos_registro_pedido_link_do_prestador check (link_prestador_id is null or (destino = 'PRESTADOR' and manutencao_id is not null));

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- Por onde o link chega ao prestador: WhatsApp do condomínio (com o modelo do link) ou e-mail.
create function meio_link_prestador(p_prestador uuid) returns text
language sql stable
set search_path = public
as $$
  select case
    when r.id is null or r.arquivado_em is not null then null
    when r.telefone is not null and (conexao_conectada()).id is not null
         and (modelo_em_uso('link_prestador', (conexao_conectada()).oficial)).id is not null then 'WHATSAPP'
    when r.email is not null and (select email_ligado from configuracao_condominio) then 'EMAIL' end
    from (select 1) x left join prestadores r on r.id = p_prestador
$$;

-- A reserva ativa do cadastro do prestador.
create function reserva_ativa(p_prestador uuid) returns uuid
language sql stable
set search_path = public
as $$
  select x.reserva_id from prestadores x join prestadores r on r.id = x.reserva_id and r.arquivado_em is null where x.id = p_prestador
$$;

-- Prazo padrão para responder (decisão 7).
create function prazo_padrao_link(p_prioridade uuid) returns integer
language sql stable
set search_path = public
as $$ select case when prioridade_urgente(p_prioridade) then 4 else 24 end $$;

-- O link do registro pode ser oferecido a quem registra?
create function link_no_registro_disponivel(p_pessoa uuid, p_privado boolean) returns text
language sql stable
set search_path = public
as $$
  select case when coalesce(p_privado, false) then 'PRIVADO'
              when not pode(p_pessoa, contexto_condominio(), 'manutencao.editar') then 'SEM_PERMISSAO' end
$$;

-- O prazo começa quando a mensagem sai (decisão 8). Devolve até quando responder. Se a
-- mensagem sair de novo (reenvio), vale o prazo que já começou.
create function iniciar_prazo_link(p_link uuid) returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  l links_prestador;
  m manutencoes;
  v_ate timestamptz;
  v_reserva uuid;
begin
  select * into l from links_prestador where id = p_link for update;
  if l.id is null then return null; end if;
  if l.responder_ate is not null or l.prazo_no_envio is null then return l.responder_ate; end if;
  select * into m from manutencoes where id = l.manutencao_id;
  v_ate := app_now() + make_interval(hours => l.prazo_no_envio);
  -- A reserva vale se ainda estiver ativa e o serviço continuar com o mesmo prestador.
  if l.reserva_no_envio is not null and m.prestador_id is not distinct from l.prestador_id
     and exists (select 1 from prestadores where id = l.reserva_no_envio and arquivado_em is null) then
    v_reserva := l.reserva_no_envio;
  end if;
  update links_prestador set responder_horas = l.prazo_no_envio, responder_ate = v_ate, reserva_id = v_reserva where id = l.id;
  if v_reserva is not null then
    perform registrar_historico('manutencao.reserva_programada', 'manutencoes', m.id::text,
      jsonb_build_object('link', l.id, 'reserva', v_reserva, 'horas', l.prazo_no_envio));
  end if;
  return v_ate;
end $$;

-- ---------------------------------------------------------------------------------------
-- O bloco Quem avisar com o link (decisões 1, 3 e 7).

alter function plataforma_quem_avisar(uuid, uuid, jsonb) rename to quem_avisar_f64;
alter function quem_avisar_f64(uuid, uuid, jsonb) security invoker;
create function plataforma_quem_avisar(p_pessoa uuid, p_condominio uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_motivo text;
  v_prioridade uuid;
  r prestadores;
begin
  v := quem_avisar_f64(p_pessoa, p_condominio, p_dados);
  v_motivo := link_no_registro_disponivel(p_pessoa, coalesce((d ->> 'privado')::boolean, false));
  v_prioridade := nullif(d ->> 'prioridadeId', '')::uuid;
  select * into r from prestadores where id = nullif(d ->> 'prestadorId', '')::uuid and arquivado_em is null;
  v := jsonb_set(v, '{prestador,link}', jsonb_strip_nulls(jsonb_build_object(
    'disponivel', v_motivo is null, 'motivo', v_motivo,
    'valeAte', to_char(hoje_no_condominio() + 7, 'YYYY-MM-DD'),
    'responderHoras', prazo_padrao_link(v_prioridade),
    'mensagem', 'O ' || nome_do_condominio() || ' tem um serviço para [prestador]: '
                || coalesce(nullif(btrim(coalesce(d ->> 'assunto', '')), ''), '[assunto]') || ' ('
                || coalesce(nullif(btrim(coalesce(d ->> 'local', '')), ''), 'Numa unidade do condomínio')
                || E').\n\nVeja o que fazer e confirme até [prazo]: [link]\n\nO link é só para este serviço e não precisa de conta.')));
  if r.id is not null then
    v := jsonb_set(v, '{prestador,escolhido}', (v -> 'prestador' -> 'escolhido') || jsonb_strip_nulls(jsonb_build_object(
      'meioLink', meio_link_prestador(r.id),
      'paraLink', case meio_link_prestador(r.id) when 'WHATSAPP' then telefone_mascarado(r.telefone) when 'EMAIL' then r.email end,
      'reserva', (select jsonb_build_object('id', x.id, 'nome', x.nome) from prestadores x where x.id = reserva_ativa(r.id)))));
  end if;
  return jsonb_set(v, '{prestadores}', coalesce((
    select jsonb_agg(x || jsonb_strip_nulls(jsonb_build_object('meioLink', meio_link_prestador((x ->> 'id')::uuid))) order by n)
      from jsonb_array_elements(v -> 'prestadores') with ordinality y(x, n)), '[]'::jsonb));
exception when invalid_text_representation then
  perform recusar_campos('Identificador inválido', 'dados');
end $$;

-- ---------------------------------------------------------------------------------------
-- Avisar no registro com o link (decisões 2, 5, 9 e 12).

create function avisar_registro_link(p pedidos, p_prestador uuid, p_texto text, p_link jsonb, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  r prestadores;
  v_meio text := meio_link_prestador(p_prestador);
  v_texto text := btrim(coalesce(p_texto, ''));
  v_rascunho text;
  v_horas integer;
  v_vale date;
  v_reserva uuid;
  v_resp uuid;
  v_titulo text := left(btrim(p.assunto), 120);
  v_local text := left(coalesce(nullif(btrim(p.local), ''), 'Numa unidade do condomínio'), 120);
  v_manutencao uuid;
  v jsonb;
  v_link uuid;
  v_envio uuid;
begin
  if exists (select 1 from avisos_registro_pedido where pedido_id = p.id and destino = 'PRESTADOR') then return; end if;
  if p.privado then perform recusar_motivo('Pedido privado não vai para o prestador', 'PEDIDO_PRIVADO'); end if;
  if not pode(p_por, p.condominio_id, 'manutencao.editar') then
    perform recusar_motivo('Mandar o link do serviço pede a permissão de editar manutenção', 'SEM_PERMISSAO_MANUTENCAO');
  end if;
  select * into r from prestadores where id = p_prestador and arquivado_em is null;
  if r.id is null then perform recusar_campos('Escolha um prestador do cadastro', 'prestadorId'); end if;
  if v_meio is null then
    perform recusar_motivo('O prestador não tem celular nem e-mail para receber por aqui', 'PRESTADOR_SEM_MEIO');
  end if;
  if length(v_texto) not between 10 and 1500 then perform recusar_campos('O que fazer de 10 a 1500 caracteres', 'textoPrestador'); end if;
  if texto_com_dado_de_morador(v_texto, p.contato_id) then
    perform recusar_motivo('Tire da mensagem o nome, o telefone ou o e-mail de morador', 'DADO_DE_MORADOR');
  end if;
  -- Quando e como entrar são o que quem registra escreve (decisão 3); no link da manutenção são opcionais.
  if length(btrim(coalesce(p_link ->> 'quando', ''))) not between 2 and 120 then
    perform recusar_campos('Quando de 2 a 120 caracteres', 'quando');
  end if;
  if length(btrim(coalesce(p_link ->> 'comoEntrar', ''))) not between 2 and 500 then
    perform recusar_campos('Como entrar de 2 a 500 caracteres', 'comoEntrar');
  end if;
  begin
    v_horas := coalesce((p_link ->> 'responderHoras')::integer, prazo_padrao_link(p.prioridade_id));
    v_vale := coalesce((p_link ->> 'valeAte')::date, hoje_no_condominio() + 7);
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    perform recusar_campos('Prazo ou validade inválidos', 'link');
  end;
  if v_horas not in (4, 8, 24, 48) then perform recusar_campos('Prazo de 4, 8, 24 ou 48 horas', 'responderHoras'); end if;
  if coalesce((p_link ->> 'reserva')::boolean, true) then v_reserva := reserva_ativa(r.id); end if;
  -- A manutenção corretiva ligada ao pedido (decisão 2).
  -- O responsável do pedido, se ele enxerga a manutenção; senão, quem registra.
  v_resp := case when p.responsavel_id is not null and vinculo_com_acesso(p.responsavel_id)
                      and pode(pessoa_do_vinculo(p.responsavel_id), p.condominio_id, 'manutencao.ver')
                 then p.responsavel_id else meu_vinculo(p_por) end;
  v := plataforma_registrar_manutencao(p_por, p.condominio_id, 'CORRETIVA', v_titulo, v_local, null, p.prioridade_id, v_resp, r.id,
                                       null, null, null, null, p.id, null);
  v_manutencao := (v ->> 'id')::uuid;
  -- O link, com os campos e a validade conferidos como na manutenção; o código só nasce no envio.
  v := criar_link_prestador_r13(p_por, p.condominio_id, v_manutencao, (select versao from manutencoes where id = v_manutencao), v_texto, p_link ->> 'quando', p_link ->> 'comoEntrar', v_vale, '{}');
  v_link := (v ->> 'id')::uuid;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'PRESTADOR' and alvo_id = v_link and revogado_em is null;
  update links_prestador set prazo_no_envio = v_horas, reserva_no_envio = v_reserva where id = v_link;
  v_rascunho := rascunho_prestador(p.local, p.assunto, p.descricao, p_por);
  update pedidos set prestador_id = r.id where id = p.id;
  if v_meio = 'WHATSAPP' then
    insert into envios_whatsapp (condominio_id, para, pedido_id, finalidade, texto, responsavel, criado_por, link_prestador_id, modelo_chave,
                                 modelo_parametros)
    values (p.condominio_id, r.telefone, p.id, 'PRESTADOR',
            'O ' || nome_do_condominio() || ' tem um serviço para ' || r.nome || ': ' || v_titulo || ' (' || v_local
            || E').\n\nVeja o que fazer e confirme até [ate]: [link]\n\nO link é só para este serviço e não precisa de conta.',
            p_por, p_por, v_link, 'link_prestador',
            jsonb_build_array(nome_do_condominio(), r.nome, v_titulo || ' (' || v_local || ')', '[ate]', '[link]'))
    returning id into v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, prestador_id, envio_whatsapp_id, manutencao_id,
                                        link_prestador_id, editado, criado_por)
    values (p.condominio_id, p.id, 'PRESTADOR', 'WHATSAPP', r.id, v_envio, v_manutencao, v_link, v_texto <> v_rascunho, p_por);
  else
    insert into envios_email (condominio_id, tipo, prestador_id, pedido_atendimento_id, para, corpo, link_prestador_id, criado_por)
    values (p.condominio_id, 'PRESTADOR', r.id, p.id, r.email, v_texto, v_link, p_por) returning id into v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, prestador_id, envio_email_id, manutencao_id,
                                        link_prestador_id, editado, criado_por)
    values (p.condominio_id, p.id, 'PRESTADOR', 'EMAIL', r.id, v_envio, v_manutencao, v_link, v_texto <> v_rascunho, p_por);
  end if;
  perform registrar_historico('pedido.avisado', 'pedidos', p.id::text, jsonb_strip_nulls(jsonb_build_object(
    'destino', 'PRESTADOR', 'prestador', r.id, 'meios', jsonb_build_array(v_meio), 'link', true, 'manutencao', v_manutencao,
    'horas', v_horas, 'editado', case when v_texto <> v_rascunho then true end)));
  perform registrar_historico('manutencao.link_no_registro', 'manutencoes', v_manutencao::text, jsonb_strip_nulls(jsonb_build_object(
    'link', v_link, 'pedido', p.id, 'canal', v_meio, 'horas', v_horas, 'reserva', v_reserva)));
end $$;

-- Tudo junto, na transação do registro: com o link, o prestador sai por aqui; o resto, como no F6.4.
alter function avisar_registro(pedidos, uuid, jsonb) rename to avisar_registro_f64;
create function avisar_registro(p pedidos, p_por uuid, p_avisar jsonb) returns void
language plpgsql
set search_path = public
as $$
declare a jsonb := coalesce(p_avisar, '{}'::jsonb);
begin
  if jsonb_typeof(a) = 'object' and jsonb_typeof(a -> 'prestador') = 'object' and jsonb_typeof(a -> 'prestador' -> 'link') = 'object' then
    perform avisar_registro_f64(p, p_por, a - 'prestador');
    begin
      perform avisar_registro_link(p, nullif(a -> 'prestador' ->> 'id', '')::uuid, a -> 'prestador' ->> 'texto', a -> 'prestador' -> 'link', p_por);
    exception when invalid_text_representation then
      perform recusar_campos('Escolha um prestador do cadastro', 'prestadorId');
    end;
  else
    perform avisar_registro_f64(p, p_por, a);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- O envio: o prazo começa quando a mensagem sai (decisão 8).

-- WhatsApp: o código já nasce na 0270; aqui começa o prazo e o "[ate]" vira a hora.
alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_f64;
alter function pegar_lote_whatsapp_f64(integer) security invoker;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  l jsonb;
  x jsonb;
  v_envios jsonb;
  v_link uuid;
  v_ate timestamptz;
  v_texto text;
begin
  v_lotes := pegar_lote_whatsapp_f64(p_max);
  for l in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((l ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(l -> 'envios') loop
      select link_prestador_id into v_link from envios_whatsapp where id = (x ->> 'envio')::uuid;
      if v_link is not null and position('[ate]' in x ->> 'texto') > 0 then
        v_ate := iniciar_prazo_link(v_link);
        v_texto := replace(x ->> 'texto', '[ate]', coalesce(dia_hora(v_ate), 'o quanto antes'));
        x := jsonb_set(x, '{texto}', to_jsonb(v_texto));
        update envios_whatsapp set texto_enviado = replace(texto_enviado, '[ate]', coalesce(dia_hora(v_ate), 'o quanto antes'))
         where id = (x ->> 'envio')::uuid and texto_enviado is not null;
      end if;
      v_envios := v_envios || jsonb_build_array(x);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(l, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

-- E-mail: o código nasce e o prazo começa na hora de montar o e-mail.
alter function montar_email(envios_email) rename to montar_email_f64;
alter function montar_email_f64(envios_email) security invoker;
create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v jsonb;
  l links_prestador;
  v_codigo text;
  v_ate timestamptz;
begin
  v := montar_email_f64(e);
  if v is null or e.link_prestador_id is null then return v; end if;
  select * into l from links_prestador where id = e.link_prestador_id;
  if not link_prestador_vale(l) then
    update envios_email set estado = 'CANCELADO', motivo = 'O link do serviço parou antes de sair' where id = e.id;
    return null;
  end if;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'PRESTADOR' and alvo_id = l.id and revogado_em is null;
  v_codigo := novo_codigo();
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), e.condominio_id, 'PRESTADOR', l.id);
  v_ate := iniciar_prazo_link(l.id);
  return jsonb_set(v, '{pedido}', (v -> 'pedido') || jsonb_strip_nulls(jsonb_build_object(
    'link', v_codigo, 'responderAte', dia_hora(v_ate), 'titulo', (select titulo from manutencoes where id = l.manutencao_id))));
end $$;

-- ---------------------------------------------------------------------------------------
-- Sem reserva, o prazo vencido avisa o responsável no sino (decisão 8).

alter function verificar_reservas() rename to verificar_reservas_r6;
alter function verificar_reservas_r6() security invoker;
create function verificar_reservas() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  l links_prestador;
  v_total integer;
begin
  v_total := verificar_reservas_r6();
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform entrar_como_sistema(c.id);
    begin
      for l in update links_prestador x set sem_resposta_avisado_em = app_now()
                where x.troca_de is null and (x.reserva_id is null or x.troca_desligada_em is not null) and x.prazo_no_envio is not null
                  and x.revogado_em is null and x.respondido_em is null and x.sem_resposta_avisado_em is null
                  and x.responder_ate <= app_now() and link_prestador_vale(x) returning * loop
        perform avisar_reserva(l.id, l.manutencao_id, 'SEM_RESPOSTA');
        perform registrar_historico('manutencao.prestador_sem_resposta', 'manutencoes', l.manutencao_id::text, jsonb_build_object('link', l.id));
      end loop;
    exception when others then
      raise warning 'Prazos do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------
-- O que se vê: o cartão do pedido, o link na manutenção e a página do prestador.

-- O link do registro, como está agora (decisões 8 e 10).
create function link_do_registro(p_link uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'manutencaoId', m.id, 'titulo', m.titulo, 'estadoManutencao', m.estado,
    'situacao', case
      when l.troca_resultado = 'TROCOU' then 'PASSOU_RESERVA'
      when l.resposta is not null then l.resposta
      when link_prestador_situacao(l) <> 'VALE' then link_prestador_situacao(l)
      when l.responder_ate is null and l.prazo_no_envio is not null then 'ESPERANDO_ENVIO'
      when l.responder_ate <= app_now() then 'SEM_RESPOSTA'
      else 'ESPERANDO' end,
    'responderAte', l.responder_ate, 'horas', coalesce(l.responder_horas, l.prazo_no_envio), 'respondidoEm', l.respondido_em,
    'reserva', case when coalesce(l.reserva_id, l.reserva_no_envio) is not null
                    then jsonb_build_object('nome', nome_prestador(coalesce(l.reserva_id, l.reserva_no_envio))) end,
    'paraReserva', case when l.troca_resultado = 'TROCOU' then (select x.para from links_prestador x where x.troca_de = l.id) end))
    from links_prestador l join manutencoes m on m.id = l.manutencao_id where l.id = p_link
$$;

alter function avisos_do_registro(uuid) rename to avisos_do_registro_f64;
create function avisos_do_registro(p_pedido uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(case when x ->> 'destino' = 'PRESTADOR' and a.link_prestador_id is not null
                                 then x || jsonb_build_object('link', link_do_registro(a.link_prestador_id)) else x end order by n), '[]'::jsonb)
    from jsonb_array_elements(avisos_do_registro_f64(p_pedido)) with ordinality y(x, n)
    left join lateral (select r.link_prestador_id from avisos_registro_pedido r
                        where r.pedido_id = p_pedido and r.destino = 'PRESTADOR' and r.link_prestador_id is not null limit 1) a on true
$$;

-- O link na manutenção: o prazo que espera a mensagem sair e o pedido de onde veio.
alter function plataforma_link_prestador(uuid, uuid, uuid) rename to link_prestador_r6;
alter function link_prestador_r6(uuid, uuid, uuid) security invoker;
create function plataforma_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  l links_prestador;
begin
  v := link_prestador_r6(p_pessoa, p_condominio, p_manutencao);
  select * into l from links_prestador where manutencao_id = p_manutencao order by criado_em desc, id desc limit 1;
  if l.id is not null and v ? 'link' then
    v := jsonb_set(v, '{link}', (v -> 'link') || jsonb_strip_nulls(jsonb_build_object(
      'prazoNoEnvio', case when l.responder_ate is null then l.prazo_no_envio end,
      'reservaNoEnvio', case when l.responder_ate is null and l.reserva_no_envio is not null
                             then jsonb_build_object('id', l.reserva_no_envio, 'nome', nome_prestador(l.reserva_no_envio)) end,
      'noRegistro', case when exists (select 1 from avisos_registro_pedido a where a.link_prestador_id = l.id) then
                      (select jsonb_build_object('pedidoId', p.id, 'protocolo', p.protocolo, 'meio', a.meio)
                         from avisos_registro_pedido a join pedidos p on p.id = a.pedido_id where a.link_prestador_id = l.id limit 1) end)));
  end if;
  return v;
end $$;

-- A página do prestador com o número do pedido (decisão 10).
alter function publico_prestador(text) rename to publico_prestador_r6;
alter function publico_prestador_r6(text) security invoker;
create function publico_prestador(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c codigos_sem_conta;
begin
  v := publico_prestador_r6(p_codigo);
  if coalesce((v ->> 'encerrado')::boolean, false) then return v; end if;
  select * into c from codigos_sem_conta where hash = hash_codigo(p_codigo) and tipo = 'PRESTADOR';
  return v || jsonb_strip_nulls(jsonb_build_object('pedido', (
    select p.protocolo from links_prestador l join manutencoes m on m.id = l.manutencao_id join pedidos p on p.id = m.pedido_id
     where l.id = c.alvo_id)));
end $$;

call fechar_acesso();

-- 0280 · Aviso de pedido registrado (F6.4; AT-26). Desenho em docs/telas/aviso-pedido-registrado.html,
-- aprovado pela Carolina em 20/10/2026.
--
-- Regras desta parte (as decisões do desenho):
-- 1. Prestador só com prévia: ninguém de fora é avisado sozinho. Quem registra escolhe um
--    prestador do cadastro e vê a mensagem antes; o prestador fica ligado ao pedido.
-- 2. Síndico: por padrão, só pedido sem responsável ou de prioridade urgente (o nível mais alto
--    em uso); o condomínio muda para nunca ou todos. Quem registra pode avisar a mais.
-- 3. O protocolo mandado a quem pediu não é retorno: não mexe no próximo retorno nem nos
--    indicadores.
-- 4. Vale para todo canal. No WhatsApp, a conversa do morador continua igual (ele já recebe o
--    protocolo ali) e a regra do síndico passa a valer.
-- 5. O responsável é sempre avisado, menos quando foi ele quem registrou. Sem responsável, vão
--    os que cuidam dos pedidos, como já era no WhatsApp.
-- 6. Quem pediu recebe o protocolo só com contato confirmado: pelo WhatsApp do condomínio
--    (número conectado, sem PARAR, com o modelo em uso) ou, sem ele, por e-mail confirmado.
-- 7. Tudo na mesma transação do registro (PT-04): se o registro não grava, nada sai.
-- 8. Sem repetir: cada pessoa recebe o aviso de registro uma vez por pedido.
-- 9. Nome, telefone e e-mail de morador não vão ao prestador nem aos moradores afetados: o
--    texto editável é conferido e recusado se tiver o nome de quem pediu, telefone ou e-mail de
--    contato do condomínio.
-- 10. Pedido privado não oferece prestador nem moradores afetados.
-- 11. O WhatsApp de quem atende espera o horário de funcionamento (como no F6.3); o sino é na
--    hora. Morador e prestador recebem na hora.
-- 12. Falha de envio segue as regras da fila (W-13, W-14) e aparece no cartão do pedido.
-- 13. Os moradores afetados recebem um comunicado publicado, ligado ao pedido, com as regras dos
--    comunicados (e-mail; mural só quando é para todos). Precisa da permissão de comunicados.
-- 14. Cada aviso entra no histórico do pedido: quem, por onde, se pela regra e se o texto foi
--    editado. Nada se apaga.

-- ---------------------------------------------------------------------------------------
-- Regras do condomínio (Configurações › Prazos e avisos).

alter table configuracao_condominio
  add column aviso_novo_sindico   text not null default 'SEM_RESPONSAVEL_OU_URGENTE'
                                  check (aviso_novo_sindico in ('NUNCA', 'SEM_RESPONSAVEL_OU_URGENTE', 'TODOS')),
  add column aviso_novo_protocolo boolean not null default true;

-- O prestador escolhido no registro fica ligado ao pedido (decisão 1).
alter table pedidos add column prestador_id uuid;
alter table pedidos add constraint pedidos_prestador foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id);

-- ---------------------------------------------------------------------------------------
-- Envios novos: o protocolo a quem pediu e o aviso ao prestador, pelo WhatsApp e por e-mail.

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO', 'PRESTADOR',
                        'PROTOCOLO', 'AVISO_PRESTADOR'));

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador'));

-- Fora da conversa de 24 horas só sai com modelo (W-20): aprovados no piloto com este desenho.
-- No número oficial, esperam a aprovação da Meta.
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('protocolo_pedido', 1, 'Protocolo do pedido', 'MORADOR', 'Pedido registrado pelo condomínio por outro canal (telefone, presencial, e-mail)',
   '["nome", "protocolo", "unidade", "assunto", "como chegou", "horário de atendimento"]',
   E'Olá, {{1}}. Registramos seu pedido {{2}} ({{3}}): {{4}}.\n\nChegou {{5}}. Para acompanhar, responda aqui com 2 · Ver meus pedidos.\n\nO que acontece agora: o condomínio confere os pedidos {{6}} e dá notícia por aqui. Em emergência, ligue 193.',
   'O condomínio e a TRÍADE nunca pedem senha nem pagamento.', 'APROVADO_PILOTO', 'Aprovado com o desenho do aviso de pedido registrado', app_now()),
  ('aviso_prestador', 1, 'Pedido para o prestador', 'PRESTADOR', 'Pedido registrado que o condomínio escolheu avisar ao prestador',
   '["condomínio", "protocolo e prioridade", "o que aconteceu"]',
   E'Aviso do {{1}} · pedido {{2}}.\n\n{{3}}\n\nPara responder, use este número.',
   'O condomínio nunca pede pagamento por mensagem.', 'APROVADO_PILOTO', 'Aprovado com o desenho do aviso de pedido registrado', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave in ('protocolo_pedido', 'aviso_prestador');

alter table envios_email drop constraint envios_email_tipo_check;
alter table envios_email add constraint envios_email_tipo_check
  check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO', 'ENQUETE', 'ASSEMBLEIA', 'PROTOCOLO', 'PRESTADOR'));
alter table envios_email
  add column pedido_atendimento_id uuid,
  add column prestador_id          uuid,
  add column corpo                 text check (length(btrim(corpo)) between 3 and 4000),
  add constraint envios_email_pedido_atendimento foreign key (pedido_atendimento_id, condominio_id) references pedidos (id, condominio_id),
  add constraint envios_email_prestador foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  add constraint envios_email_protocolo check (tipo <> 'PROTOCOLO' or (contato_id is not null and pedido_atendimento_id is not null)),
  add constraint envios_email_aviso_prestador check (tipo <> 'PRESTADOR' or (prestador_id is not null and pedido_atendimento_id is not null
                                                                            and corpo is not null));

-- As colunas novas também não mudam depois de postas na fila.
create function envios_email_regras_f64() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.pedido_atendimento_id, new.prestador_id, new.corpo) is distinct from (old.pedido_atendimento_id, old.prestador_id, old.corpo) then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger envios_email_regras_f64 before update on envios_email for each row execute function envios_email_regras_f64();

-- ---------------------------------------------------------------------------------------
-- Quem foi avisado no registro: uma linha por pessoa (ou prestador, ou comunicado) e meio.

create table avisos_registro_pedido (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  pedido_id         uuid not null,
  destino           text not null check (destino in ('QUEM_PEDIU', 'RESPONSAVEL', 'SINDICO', 'PRESTADOR', 'MORADORES')),
  meio              text not null check (meio in ('SINO', 'WHATSAPP', 'EMAIL', 'COMUNICADO', 'CONVERSA')),
  pessoa_id         uuid references pessoas (id),
  contato_id        uuid,
  prestador_id      uuid,
  comunicado_id     uuid,
  envio_whatsapp_id uuid,
  envio_email_id    uuid,
  pela_regra        boolean not null default false,
  editado           boolean not null default false,
  criado_em         timestamptz not null default app_now(),
  criado_por        uuid references pessoas (id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  foreign key (comunicado_id, condominio_id) references comunicados (id, condominio_id),
  foreign key (envio_whatsapp_id, condominio_id) references envios_whatsapp (id, condominio_id),
  foreign key (envio_email_id, condominio_id) references envios_email (id, condominio_id),
  -- Sem repetir (decisão 8).
  unique nulls not distinct (pedido_id, destino, meio, pessoa_id, contato_id, prestador_id),
  check (destino not in ('RESPONSAVEL', 'SINDICO') or pessoa_id is not null),
  check (destino <> 'QUEM_PEDIU' or contato_id is not null),
  check (destino <> 'PRESTADOR' or prestador_id is not null),
  check (destino <> 'MORADORES' or comunicado_id is not null),
  check (meio <> 'WHATSAPP' or envio_whatsapp_id is not null),
  check (meio <> 'EMAIL' or envio_email_id is not null)
);
create index avisos_registro_pedido_pedido on avisos_registro_pedido (pedido_id, criado_em);
call proteger_tabela_condominio('avisos_registro_pedido');
create trigger avisos_registro_pedido_sem_exclusao before delete on avisos_registro_pedido for each row execute function somente_insercao();
create trigger avisos_registro_pedido_sem_mudanca before update on avisos_registro_pedido for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- Urgente é a prioridade de nível mais alto em uso no condomínio (decisão 2).
create function prioridade_urgente(p_prioridade uuid) returns boolean
language sql stable
set search_path = public
as $$
  select coalesce((select nivel from prioridades where id = p_prioridade) >= (select max(nivel) from prioridades where ativa), false)
$$;

-- O síndico entra pela regra do condomínio?
create function sindico_pela_regra(p_responsavel uuid, p_prioridade uuid) returns boolean
language sql stable
set search_path = public
as $$
  select case (select aviso_novo_sindico from configuracao_condominio)
           when 'TODOS' then true
           when 'NUNCA' then false
           else p_responsavel is null or prioridade_urgente(p_prioridade) end
$$;

-- "por telefone", "pessoalmente": como o pedido chegou, na frase do protocolo.
create function canal_na_frase(p_canal text) returns text
language sql immutable
set search_path = public
as $$
  select case p_canal when 'TELEFONE' then 'por telefone' when 'PRESENCIAL' then 'pessoalmente' when 'MENSAGEM' then 'por mensagem'
                      when 'EMAIL' then 'por e-mail' when 'OBSERVACAO' then 'por quem cuida do prédio' else 'ao condomínio' end
$$;

create function conexao_conectada() returns conexoes_whatsapp
language sql stable
set search_path = public
as $$ select * from conexoes_whatsapp where situacao = 'CONECTADO' $$;

-- Por onde o protocolo chega a quem pediu (decisão 6): WhatsApp, e-mail ou nada.
create function meio_protocolo(p_contato uuid) returns text
language sql stable
set search_path = public
as $$
  select case
    when ct.id is null or ct.dados_removidos_em is not null then null
    when ct.telefone is not null and ct.whatsapp_parou_em is null and (conexao_conectada()).id is not null
         and (modelo_em_uso('protocolo_pedido', (conexao_conectada()).oficial)).id is not null then 'WHATSAPP'
    when ct.email_situacao = 'CONFIRMADO' and (select email_ligado from configuracao_condominio) then 'EMAIL' end
    from (select 1) x left join contatos ct on ct.id = p_contato
$$;

-- Por onde o aviso chega ao prestador: WhatsApp do condomínio ou e-mail do cadastro.
create function meio_prestador(p_prestador uuid) returns text
language sql stable
set search_path = public
as $$
  select case
    when r.id is null or r.arquivado_em is not null then null
    when r.telefone is not null and (conexao_conectada()).id is not null
         and (modelo_em_uso('aviso_prestador', (conexao_conectada()).oficial)).id is not null then 'WHATSAPP'
    when r.email is not null and (select email_ligado from configuracao_condominio) then 'EMAIL' end
    from (select 1) x left join prestadores r on r.id = p_prestador
$$;

-- A pessoa recebe o aviso de pedido novo também no WhatsApp dela (F6.3)?
create function recebe_pedido_novo_no_whatsapp(p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from avisos_whatsapp_pessoa where pessoa_id = p_pessoa and ligado and 'PEDIDO_NOVO' = any (tipos))
     and exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS')
$$;

-- Texto com dado de morador (decisão 9): o nome de quem pediu, telefone ou e-mail de contato do
-- condomínio. O telefone vale com ou sem separadores, pelos 8 últimos dígitos.
create function texto_com_dado_de_morador(p_texto text, p_contato uuid) returns boolean
language sql stable
set search_path = public
as $$
  with numeros as (
    select regexp_replace(m[1], '[^0-9]', '', 'g') as d from regexp_matches(coalesce(p_texto, ''), '([0-9][0-9 ().+-]{6,}[0-9])', 'g') m
  )
  select coalesce(
       exists (select 1 from contatos ct where ct.id = p_contato and length(btrim(ct.nome)) >= 3
                                           and position(lower(btrim(ct.nome)) in lower(p_texto)) > 0)
    or exists (select 1 from contatos ct, numeros n
                where ct.telefone is not null and ct.dados_removidos_em is null and length(n.d) >= 8
                  and position(right(regexp_replace(ct.telefone, '[^0-9]', '', 'g'), 8) in n.d) > 0)
    or exists (select 1 from contatos ct where ct.email is not null and ct.dados_removidos_em is null
                                           and position(lower(ct.email) in lower(p_texto)) > 0), false)
$$;

-- O protocolo a quem pediu (decisão 6), igual na prévia e no envio. Na prévia ainda não há
-- número de protocolo.
create function texto_protocolo(p_nome text, p_protocolo text, p_unidade text, p_assunto text, p_canal text) returns text
language sql stable
set search_path = public
as $$
  select 'Olá, ' || nome_curto(p_nome) || '. Registramos seu pedido ' || coalesce(p_protocolo, '[nº do protocolo]')
      || ' (' || coalesce(p_unidade, 'área comum') || '): ' || coalesce(nullif(btrim(p_assunto), ''), '[assunto]') || E'.\n\n'
      || 'Chegou ' || canal_na_frase(p_canal) || E'. Para acompanhar, responda aqui com 2 · Ver meus pedidos.\n\n'
      || 'O que acontece agora: o condomínio confere os pedidos ' || descrever_atendimento() || E' e dá notícia por aqui. Em emergência, ligue 193.\n\n'
      || aviso_golpe_whatsapp()
$$;

-- "+55 61 9••••-4444": o celular do prestador na tela de registrar.
create function telefone_mascarado(p_telefone text) returns text
language sql immutable
set search_path = public
as $$
  select case when length(d) >= 12 then '+' || substr(d, 1, 2) || ' ' || substr(d, 3, 2) || ' ' || substr(d, 5, 1) || '••••-' || right(d, 4) end
    from (select regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g') as d) x
$$;

-- Os rascunhos das mensagens editáveis. Sem unidade nem dado de quem pediu (decisão 9).
create function rascunho_prestador(p_local text, p_assunto text, p_descricao text, p_pessoa uuid) returns text
language sql stable
set search_path = public
as $$
  select coalesce(nullif(btrim(p_local), ''), 'Numa unidade do condomínio') || ': ' || btrim(coalesce(p_assunto, '')) || '.'
      || coalesce(E'\n\n' || nullif(btrim(p_descricao), ''), '')
      || E'\n\nPara combinar, fale com ' || coalesce(nullif(nome_curto(nome_pessoa(p_pessoa)), ''), 'a gestão') || ', do condomínio.'
$$;

create function rascunho_moradores(p_local text, p_assunto text) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'titulo', left(btrim(coalesce(p_assunto, 'Aviso do condomínio')), 120),
    'texto', btrim(coalesce(p_assunto, '')) || coalesce(' (' || nullif(btrim(p_local), '') || ')', '')
             || '. O condomínio já sabe e está cuidando. Avisaremos quando for resolvido.')
$$;

-- Os avisos possíveis para um pedido ainda por registrar (ou recém-registrado): o que a tela
-- mostra no bloco Quem avisar e o que o registro faz.
create function linhas_aviso_registro(p_pessoa uuid, p_contato uuid, p_prioridade uuid, p_privado boolean, p_responsavel uuid)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  ct contatos;
  v_resp uuid[];
  v_sind uuid[];
  v_meio text;
  v_regra boolean;
begin
  select * into cfg from configuracao_condominio;
  select * into ct from contatos where id = p_contato;
  v_meio := meio_protocolo(p_contato);
  -- Responsável (decisão 5): a pessoa do vínculo; sem ele, os que cuidam dos pedidos.
  v_resp := case when pessoa_do_vinculo(p_responsavel) is not null then array[pessoa_do_vinculo(p_responsavel)]
                 else quem_cuida_dos_pedidos() end;
  v_sind := (select coalesce(array_agg(s), '{}') from sindicos_ativos() s where not (s = any (v_resp)));
  v_regra := sindico_pela_regra(p_responsavel, p_prioridade);
  return jsonb_build_object(
    'quemPediu', jsonb_strip_nulls(jsonb_build_object(
      'contatoId', ct.id, 'nome', ct.nome, 'meio', v_meio,
      'marcado', v_meio is not null and cfg.aviso_novo_protocolo,
      'motivo', case when ct.id is null then 'SEM_CONTATO' when v_meio is null then 'SEM_MEIO' end)),
    'responsavel', jsonb_build_object(
      'semResponsavel', pessoa_do_vinculo(p_responsavel) is null,
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', x, 'nome', nome_pessoa(x), 'voceMesmo', x = p_pessoa,
                                                               'whatsapp', recebe_pedido_novo_no_whatsapp(x)) order by x = p_pessoa, lower(nome_pessoa(x)))
                             from unnest(v_resp) x), '[]'::jsonb)),
    'sindico', jsonb_build_object(
      'pelaRegra', v_regra, 'regra', cfg.aviso_novo_sindico,
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', x, 'nome', nome_pessoa(x), 'voceMesmo', x = p_pessoa,
                                                               'whatsapp', recebe_pedido_novo_no_whatsapp(x)) order by lower(nome_pessoa(x)))
                             from unnest(v_sind) x), '[]'::jsonb)),
    'prestador', jsonb_strip_nulls(jsonb_build_object('disponivel', not coalesce(p_privado, false),
                                                      'motivo', case when coalesce(p_privado, false) then 'PRIVADO' end)),
    'moradores', jsonb_strip_nulls(jsonb_build_object(
      'disponivel', not coalesce(p_privado, false) and pode(p_pessoa, contexto_condominio(), 'comunicados.publicar'),
      'motivo', case when coalesce(p_privado, false) then 'PRIVADO'
                     when not pode(p_pessoa, contexto_condominio(), 'comunicados.publicar') then 'SEM_PERMISSAO' end)));
end $$;

-- O bloco Quem avisar na tela de registrar (antes de gravar): as linhas, os rascunhos, os
-- prestadores do cadastro e a conferência dos textos editados.
create function plataforma_quem_avisar(p_pessoa uuid, p_condominio uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_unidade uuid;
  v_contato uuid;
  v_prestador uuid;
  v_prioridade uuid;
  v_responsavel uuid;
  v_privado boolean;
  v_local text;
  v_assunto text;
  v jsonb;
  r prestadores;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.atualizar');
  begin
    v_unidade := nullif(d ->> 'unidadeId', '')::uuid;
    v_contato := nullif(d ->> 'contatoId', '')::uuid;
    v_prestador := nullif(d ->> 'prestadorId', '')::uuid;
    v_prioridade := nullif(d ->> 'prioridadeId', '')::uuid;
    v_responsavel := nullif(d ->> 'responsavelId', '')::uuid;
  exception when invalid_text_representation then
    perform recusar_campos('Identificador inválido', 'dados');
  end;
  v_privado := coalesce((d ->> 'privado')::boolean, false);
  v_local := nullif(btrim(coalesce(d ->> 'local', '')), '');
  v_assunto := nullif(btrim(coalesce(d ->> 'assunto', '')), '');
  -- Contato que não é confirmado da unidade não vale (MU-02): o registro recusaria.
  if v_contato is not null and not exists (select 1 from contatos_unidade where contato_id = v_contato and unidade_id = v_unidade
                                                                              and estado = 'CONFIRMADO') then
    v_contato := null;
  end if;
  -- Como no registro (0090): sem responsável escolhido, vai o padrão da fila, se disponível.
  if v_responsavel is null then select responsavel_padrao into v_responsavel from configuracao_condominio; end if;
  if v_responsavel is not null and not responsavel_disponivel(v_responsavel) then v_responsavel := null; end if;
  v := linhas_aviso_registro(p_pessoa, v_contato, v_prioridade, v_privado, v_responsavel);
  select * into r from prestadores where id = v_prestador and arquivado_em is null;
  if v -> 'quemPediu' ->> 'meio' is not null then
    v := jsonb_set(v, '{quemPediu,mensagem}', to_jsonb(texto_protocolo(v -> 'quemPediu' ->> 'nome', null,
                                                                       coalesce(rotulo_unidade(v_unidade), v_local), v_assunto, d ->> 'canal')));
  end if;
  return v || jsonb_build_object(
    'prestador', (v -> 'prestador') || jsonb_strip_nulls(jsonb_build_object(
      'escolhido', case when r.id is not null then jsonb_strip_nulls(jsonb_build_object('id', r.id, 'nome', r.nome, 'meio', meio_prestador(r.id))) end,
      'rascunho', rascunho_prestador(v_local, v_assunto, d ->> 'descricao', p_pessoa),
      'cabecalho', nome_do_condominio() || ' · pedido [nº do protocolo] ('
                   || coalesce((select lower(nome) from prioridades where id = v_prioridade), 'prioridade') || ')',
      'rodape', 'O condomínio nunca pede pagamento por mensagem.',
      'textoComDadoDeMorador', case when d ? 'textoPrestador' then texto_com_dado_de_morador(d ->> 'textoPrestador', v_contato) end)),
    'moradores', (v -> 'moradores') || jsonb_strip_nulls(jsonb_build_object(
      'rascunho', rascunho_moradores(v_local, v_assunto),
      'publico', case when v_unidade is not null and (select bloco_id from unidades where id = v_unidade) is not null then 'BLOCOS' else 'TODOS' end,
      'blocos', case when v_unidade is not null then (select to_jsonb(array_remove(array[bloco_id], null)) from unidades where id = v_unidade) end,
      'textoComDadoDeMorador', case when d ? 'textoMoradores' then texto_com_dado_de_morador(d ->> 'textoMoradores', v_contato) end)),
    'prestadores', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'nome', x.nome, 'servico', x.servico, 'acordo', x.acordo, 'contratoAte', to_char(x.contrato_ate, 'YYYY-MM-DD'),
               'reserva', (select nome from prestadores where id = x.reserva_id), 'meio', meio_prestador(x.id),
               'para', case meio_prestador(x.id) when 'WHATSAPP' then telefone_mascarado(x.telefone) when 'EMAIL' then x.email end,
               'temCelular', x.telefone is not null, 'temEmail', x.email is not null))
             order by lower(x.nome))
        from prestadores x where x.arquivado_em is null), '[]'::jsonb),
    'blocos', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome,
                                                            'unidades', (select count(*) from unidades u where u.bloco_id = b.id and u.ativa))
                                         order by b.ordem, b.nome) from blocos b where b.ativo), '[]'::jsonb),
    'totalUnidades', (select count(*) from unidades where ativa),
    'condominio', nome_do_condominio(),
    'regra', jsonb_build_object('sindico', (select aviso_novo_sindico from configuracao_condominio),
                                'protocolo', (select aviso_novo_protocolo from configuracao_condominio)));
end $$;

-- ---------------------------------------------------------------------------------------
-- Avisar no registro.

-- Guarda o que saiu para quem atende: o sino e, se a pessoa ligou, o WhatsApp dela (F6.3).
create function registrar_aviso_pessoa(p pedidos, p_destino text, p_pessoa uuid, p_pela_regra boolean, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_envio uuid;
begin
  if exists (select 1 from avisos_registro_pedido where pedido_id = p.id and pessoa_id = p_pessoa) then return; end if;
  if not exists (select 1 from avisos_whatsapp where pessoa_id = p_pessoa and tipo = 'PEDIDO_NOVO' and referencia = p.id::text) then return; end if;
  insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, pessoa_id, pela_regra, criado_por)
  values (p.condominio_id, p.id, p_destino, 'SINO', p_pessoa, p_pela_regra, p_por);
  select id into v_envio from envios_whatsapp
   where pedido_id = p.id and pessoa_id = p_pessoa and finalidade = 'AVISO' order by criado_em desc limit 1;
  if v_envio is not null then
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, pessoa_id, envio_whatsapp_id, pela_regra, criado_por)
    values (p.condominio_id, p.id, p_destino, 'WHATSAPP', p_pessoa, v_envio, p_pela_regra, p_por);
  end if;
  perform registrar_historico('pedido.avisado', 'pedidos', p.id::text, jsonb_strip_nulls(jsonb_build_object(
    'destino', p_destino, 'pessoa', p_pessoa, 'meios', case when v_envio is not null then '["SINO", "WHATSAPP"]'::jsonb else '["SINO"]'::jsonb end,
    'pelaRegra', case when p_pela_regra then true end)));
end $$;

-- Avisa quem atende, uma vez por pedido (decisão 8), e guarda o que saiu.
create function avisar_registro_pessoa(p pedidos, p_destino text, p_pessoa uuid, p_pela_regra boolean, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from avisos_registro_pedido where pedido_id = p.id and pessoa_id = p_pessoa) then return; end if;
  perform avisar_whatsapp(array[p_pessoa], 'PEDIDO_NOVO', p.id, null, null, p.id::text);
  perform registrar_aviso_pessoa(p, p_destino, p_pessoa, p_pela_regra, p_por);
end $$;

-- O protocolo a quem pediu (decisões 3 e 6). Não é retorno: não entra no andamento.
create function avisar_registro_quem_pediu(p pedidos, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  ct contatos;
  cx conexoes_whatsapp;
  v_meio text := meio_protocolo(p.contato_id);
  v_envio uuid;
  v_unidade text := coalesce(rotulo_unidade(p.unidade_id), p.local);
begin
  if v_meio is null or exists (select 1 from avisos_registro_pedido where pedido_id = p.id and destino = 'QUEM_PEDIU') then return; end if;
  select * into ct from contatos where id = p.contato_id;
  if v_meio = 'WHATSAPP' then
    cx := conexao_conectada();
    v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, p.id, null, 'PROTOCOLO',
                                   texto_protocolo(ct.nome, p.protocolo, v_unidade, p.assunto, p.canal), null, p_por);
    update envios_whatsapp set modelo_chave = 'protocolo_pedido',
                               modelo_parametros = jsonb_build_array(nome_curto(ct.nome), p.protocolo, coalesce(v_unidade, 'área comum'), p.assunto,
                                                                     canal_na_frase(p.canal), descrever_atendimento())
     where id = v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, contato_id, envio_whatsapp_id, pela_regra, criado_por)
    values (p.condominio_id, p.id, 'QUEM_PEDIU', 'WHATSAPP', ct.id, v_envio, false, p_por);
  else
    insert into envios_email (condominio_id, tipo, contato_id, pedido_atendimento_id, para, criado_por)
    values (p.condominio_id, 'PROTOCOLO', ct.id, p.id, ct.email, p_por) returning id into v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, contato_id, envio_email_id, pela_regra, criado_por)
    values (p.condominio_id, p.id, 'QUEM_PEDIU', 'EMAIL', ct.id, v_envio, false, p_por);
  end if;
  perform registrar_historico('pedido.avisado', 'pedidos', p.id::text, jsonb_build_object(
    'destino', 'QUEM_PEDIU', 'contato', ct.id, 'meios', jsonb_build_array(v_meio)));
end $$;

-- O aviso ao prestador escolhido (decisões 1 e 9).
create function avisar_registro_prestador(p pedidos, p_prestador uuid, p_texto text, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  r prestadores;
  v_meio text := meio_prestador(p_prestador);
  v_texto text := btrim(coalesce(p_texto, ''));
  v_rascunho text;
  v_cabeca text;
  v_envio uuid;
begin
  if exists (select 1 from avisos_registro_pedido where pedido_id = p.id and destino = 'PRESTADOR') then return; end if;
  if p.privado then perform recusar_motivo('Pedido privado não vai para o prestador', 'PEDIDO_PRIVADO'); end if;
  select * into r from prestadores where id = p_prestador and arquivado_em is null;
  if r.id is null then perform recusar_campos('Escolha um prestador do cadastro', 'prestadorId'); end if;
  if v_meio is null then
    perform recusar_motivo('O prestador não tem celular nem e-mail para receber por aqui', 'PRESTADOR_SEM_MEIO');
  end if;
  if length(v_texto) not between 3 and 1500 then perform recusar_campos('Mensagem de 3 a 1500 caracteres', 'textoPrestador'); end if;
  if texto_com_dado_de_morador(v_texto, p.contato_id) then
    perform recusar_motivo('Tire da mensagem o nome, o telefone ou o e-mail de morador', 'DADO_DE_MORADOR');
  end if;
  v_rascunho := rascunho_prestador(p.local, p.assunto, p.descricao, p_por);
  update pedidos set prestador_id = r.id where id = p.id;
  v_cabeca := (select pr.nome from prioridades pr where pr.id = p.prioridade_id);
  if v_meio = 'WHATSAPP' then
    insert into envios_whatsapp (condominio_id, para, pedido_id, finalidade, texto, responsavel, criado_por, modelo_chave, modelo_parametros)
    values (p.condominio_id, r.telefone, p.id, 'AVISO_PRESTADOR',
            nome_do_condominio() || ' · pedido ' || p.protocolo || ' (' || lower(v_cabeca) || E')\n' || v_texto
            || E'\n\nO condomínio nunca pede pagamento por mensagem.',
            p_por, p_por, 'aviso_prestador', jsonb_build_array(nome_do_condominio(), p.protocolo || ' (' || lower(v_cabeca) || ')', v_texto))
    returning id into v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, prestador_id, envio_whatsapp_id, editado, criado_por)
    values (p.condominio_id, p.id, 'PRESTADOR', 'WHATSAPP', r.id, v_envio, v_texto <> v_rascunho, p_por);
  else
    insert into envios_email (condominio_id, tipo, prestador_id, pedido_atendimento_id, para, corpo, criado_por)
    values (p.condominio_id, 'PRESTADOR', r.id, p.id, r.email, v_texto, p_por) returning id into v_envio;
    insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, prestador_id, envio_email_id, editado, criado_por)
    values (p.condominio_id, p.id, 'PRESTADOR', 'EMAIL', r.id, v_envio, v_texto <> v_rascunho, p_por);
  end if;
  perform registrar_historico('pedido.avisado', 'pedidos', p.id::text, jsonb_strip_nulls(jsonb_build_object(
    'destino', 'PRESTADOR', 'prestador', r.id, 'meios', jsonb_build_array(v_meio), 'editado', case when v_texto <> v_rascunho then true end)));
end $$;

-- O comunicado aos moradores afetados (decisão 13), publicado e ligado ao pedido.
create function avisar_registro_moradores(p pedidos, p_dados jsonb, p_por uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  v jsonb;
  v_assunto text;
  v_rascunho jsonb := rascunho_moradores(p.local, p.assunto);
  v_titulo text := btrim(coalesce(p_dados ->> 'titulo', ''));
  v_texto text := btrim(coalesce(p_dados ->> 'texto', ''));
  v_blocos uuid[];
  v_unidades uuid[];
begin
  if exists (select 1 from avisos_registro_pedido where pedido_id = p.id and destino = 'MORADORES') then return; end if;
  if p.privado then perform recusar_motivo('Pedido privado não vai para os outros moradores', 'PEDIDO_PRIVADO'); end if;
  if texto_com_dado_de_morador(v_titulo || ' ' || v_texto, p.contato_id) then
    perform recusar_motivo('Tire do comunicado o nome, o telefone ou o e-mail de morador', 'DADO_DE_MORADOR');
  end if;
  begin
    v_blocos := (select coalesce(array_agg(x::uuid), '{}') from jsonb_array_elements_text(coalesce(p_dados -> 'blocos', '[]')) x);
    v_unidades := (select coalesce(array_agg(x::uuid), '{}') from jsonb_array_elements_text(coalesce(p_dados -> 'unidades', '[]')) x);
  exception when invalid_text_representation then
    perform recusar_campos('Escolha os blocos ou as unidades', 'moradores');
  end;
  select case when 'AVISO' = any (comunicados_assuntos) then 'AVISO' else comunicados_assuntos[1] end into v_assunto from configuracao_condominio;
  v := plataforma_salvar_comunicado(p_por, p.condominio_id, null, null, v_assunto, v_titulo, v_texto, p_dados ->> 'publico',
                                    v_blocos, v_unidades, '{}', p.id, null, 'PUBLICAR', null);
  insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, comunicado_id, editado, criado_por)
  values (p.condominio_id, p.id, 'MORADORES', 'COMUNICADO', (v ->> 'id')::uuid,
          (v_titulo, v_texto) is distinct from (v_rascunho ->> 'titulo', v_rascunho ->> 'texto'), p_por);
  perform registrar_historico('pedido.avisado', 'pedidos', p.id::text, jsonb_strip_nulls(jsonb_build_object(
    'destino', 'MORADORES', 'comunicado', (v ->> 'id')::uuid, 'meios', '["COMUNICADO"]'::jsonb,
    'editado', case when (v_titulo, v_texto) is distinct from (v_rascunho ->> 'titulo', v_rascunho ->> 'texto') then true end)));
end $$;

-- Tudo junto, na transação do registro (decisão 7). p_avisar: quemPediu (desmarcar), sindico
-- (marcar a mais), prestador {id, texto} e moradores {publico, blocos, unidades, titulo, texto}.
create function avisar_registro(p pedidos, p_por uuid, p_avisar jsonb) returns void
language plpgsql
set search_path = public
as $$
declare
  a jsonb := coalesce(p_avisar, '{}'::jsonb);
  l jsonb := linhas_aviso_registro(p_por, p.contato_id, p.prioridade_id, p.privado, p.responsavel_id);
  x jsonb;
  v_sindico boolean;
begin
  if jsonb_typeof(a) <> 'object' then perform recusar_campos('Diga quem avisar', 'avisar'); end if;
  if coalesce((a ->> 'quemPediu')::boolean, (l -> 'quemPediu' ->> 'marcado')::boolean, false)
     and l -> 'quemPediu' ->> 'meio' is not null then
    perform avisar_registro_quem_pediu(p, p_por);
  end if;
  for x in select * from jsonb_array_elements(l -> 'responsavel' -> 'pessoas') loop
    continue when (x ->> 'voceMesmo')::boolean;
    perform avisar_registro_pessoa(p, 'RESPONSAVEL', (x ->> 'id')::uuid, false, p_por);
  end loop;
  v_sindico := (l -> 'sindico' ->> 'pelaRegra')::boolean or coalesce((a ->> 'sindico')::boolean, false);
  if v_sindico then
    for x in select * from jsonb_array_elements(l -> 'sindico' -> 'pessoas') loop
      continue when (x ->> 'voceMesmo')::boolean;
      perform avisar_registro_pessoa(p, 'SINDICO', (x ->> 'id')::uuid, (l -> 'sindico' ->> 'pelaRegra')::boolean, p_por);
    end loop;
  end if;
  if jsonb_typeof(a -> 'prestador') = 'object' then
    begin
      perform avisar_registro_prestador(p, nullif(a -> 'prestador' ->> 'id', '')::uuid, a -> 'prestador' ->> 'texto', p_por);
    exception when invalid_text_representation then
      perform recusar_campos('Escolha um prestador do cadastro', 'prestadorId');
    end;
  end if;
  if jsonb_typeof(a -> 'moradores') = 'object' then
    if not (l -> 'moradores' ->> 'disponivel')::boolean and not p.privado then
      perform recusar_motivo('Avisar os moradores pede a permissão de comunicados', 'SEM_PERMISSAO_COMUNICADOS');
    end if;
    perform avisar_registro_moradores(p, a -> 'moradores', p_por);
  end if;
end $$;

-- O registro (0090) com os avisos. Devolve também o que saiu, para a confirmação.
alter function plataforma_registrar_pedido(uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, boolean, uuid)
  rename to registrar_pedido_r13;
alter function registrar_pedido_r13(uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, boolean, uuid) security invoker;
create function plataforma_registrar_pedido(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_local text,
                                            p_categoria uuid, p_prioridade uuid, p_assunto text, p_descricao text, p_canal text,
                                            p_privado boolean, p_responsavel uuid, p_avisar jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  p pedidos;
begin
  v := registrar_pedido_r13(p_pessoa, p_condominio, p_unidade, p_contato, p_local, p_categoria, p_prioridade, p_assunto, p_descricao,
                            p_canal, p_privado, p_responsavel);
  select * into p from pedidos where id = (v ->> 'id')::uuid;
  perform avisar_registro(p, p_pessoa, p_avisar);
  return v || jsonb_build_object('versao', (select versao from pedidos where id = p.id), 'avisos', avisos_do_registro(p.id));
end $$;

-- ---------------------------------------------------------------------------------------
-- Pedido que chega pelo WhatsApp (decisão 4): a conversa segue igual (o morador já recebe o
-- protocolo ali); o síndico entra pela regra e o cartão do pedido mostra quem soube.

alter function criar_pedido_whatsapp(conversas_whatsapp, uuid, uuid, text) rename to criar_pedido_whatsapp_r13;
create function criar_pedido_whatsapp(p_conversa conversas_whatsapp, p_contato uuid, p_unidade uuid, p_texto text) returns pedidos
language plpgsql
set search_path = public
as $$
declare
  v pedidos;
  v_resp uuid[];
  x uuid;
begin
  v := criar_pedido_whatsapp_r13(p_conversa, p_contato, p_unidade, p_texto);
  v_resp := quem_avisar_do_pedido(v);
  insert into avisos_registro_pedido (condominio_id, pedido_id, destino, meio, contato_id, envio_whatsapp_id)
  values (v.condominio_id, v.id, 'QUEM_PEDIU', 'CONVERSA', p_contato,
          (select id from envios_whatsapp where pedido_id = v.id and finalidade = 'RESPOSTA' order by criado_em desc limit 1));
  foreach x in array v_resp loop
    perform registrar_aviso_pessoa(v, 'RESPONSAVEL', x, false, null);
  end loop;
  if sindico_pela_regra(v.responsavel_id, v.prioridade_id) then
    for x in select s from sindicos_ativos() s where not (s = any (v_resp)) loop
      perform avisar_registro_pessoa(v, 'SINDICO', x, true, null);
    end loop;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- O que saiu no registro, para a confirmação e o cartão do pedido (decisões 12 e 14).

-- O envio como está agora: se a falha foi reenviada (W-14), vale o reenvio mais novo.
create function envio_atual(p_envio uuid) returns envios_whatsapp
language sql stable
set search_path = public
as $$
  with recursive cadeia (id, n) as (
    select p_envio, 0
    union all
    select e.id, c.n + 1 from envios_whatsapp e join cadeia c on e.reenvio_de = c.id where c.n < 20
  )
  select e.* from envios_whatsapp e where e.id = (select id from cadeia order by n desc limit 1)
$$;

create function avisos_do_registro(p_pedido uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'destino', a.destino, 'meio', a.meio,
           'nome', coalesce(nome_pessoa(a.pessoa_id), (select nome from contatos where id = a.contato_id),
                            (select nome from prestadores where id = a.prestador_id),
                            (select case c.publico when 'TODOS' then 'Todos os moradores'
                                                   when 'BLOCOS' then (select string_agg(b.nome, ', ' order by b.ordem, b.nome) from blocos b where b.id = any (c.blocos))
                                                   when 'UNIDADES' then cardinality(c.unidades) || case when cardinality(c.unidades) = 1 then ' unidade' else ' unidades' end
                                                   else 'Contatos escolhidos' end
                               from comunicados c where c.id = a.comunicado_id)),
           'situacao', case a.meio
                         when 'SINO' then 'NO_SINO'
                         when 'CONVERSA' then coalesce((envio_atual(a.envio_whatsapp_id)).estado, 'NA_CONVERSA')
                         when 'WHATSAPP' then (envio_atual(a.envio_whatsapp_id)).estado
                         when 'EMAIL' then (select e.estado from envios_email e where e.id = a.envio_email_id)
                         when 'COMUNICADO' then (select c.estado from comunicados c where c.id = a.comunicado_id) end,
           'enviarApos', (select case when e.estado = 'NA_FILA' and e.enviar_apos > app_now() and e.enviar_apos < 'infinity' then e.enviar_apos end
                            from envio_atual(a.envio_whatsapp_id) e where e.id is not null),
           'parado', (select envio_parado(e) from envio_atual(a.envio_whatsapp_id) e where e.id is not null),
           'motivo', coalesce((select e.motivo from envio_atual(a.envio_whatsapp_id) e where e.estado in ('FALHOU', 'DESCONHECIDO', 'CANCELADA')),
                              (select e.motivo from envios_email e where e.id = a.envio_email_id and e.estado in ('FALHOU', 'DEVOLVIDO', 'CANCELADO'))),
           'entregueEm', coalesce((select e.entregue_em from envio_atual(a.envio_whatsapp_id) e where e.id is not null),
                                  (select e.entregue_em from envios_email e where e.id = a.envio_email_id)),
           'lidoEm', (select e.lida_em from envio_atual(a.envio_whatsapp_id) e where e.id is not null),
           'vistoEm', case when a.meio = 'SINO' then (select w.visto_em from avisos_whatsapp w where w.pessoa_id = a.pessoa_id and w.tipo = 'PEDIDO_NOVO'
                                                                                              and w.referencia = a.pedido_id::text) end,
           'comunicadoId', a.comunicado_id,
           'destinatarios', (select c.destinatarios from comunicados c where c.id = a.comunicado_id),
           'noMural', (select c.no_mural from comunicados c where c.id = a.comunicado_id),
           'emails', (select count(*) from envios_email e where e.comunicado_id = a.comunicado_id),
           'pelaRegra', case when a.pela_regra then true end, 'editado', case when a.editado then true end,
           'em', a.criado_em))
         order by array_position(array['QUEM_PEDIU', 'RESPONSAVEL', 'SINDICO', 'PRESTADOR', 'MORADORES'], a.destino), a.criado_em,
                  array_position(array['CONVERSA', 'SINO', 'WHATSAPP', 'EMAIL', 'COMUNICADO'], a.meio)), '[]'::jsonb)
    from avisos_registro_pedido a where a.pedido_id = p_pedido
$$;

-- O pedido (0090) com o prestador, os avisos do registro e os nomes no histórico.
alter function plataforma_pedido(uuid, uuid, uuid) rename to pedido_detalhe_r13;
alter function pedido_detalhe_r13(uuid, uuid, uuid) security invoker;
create function plataforma_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  p pedidos;
begin
  v := pedido_detalhe_r13(p_pessoa, p_condominio, p_id);
  select * into p from pedidos where id = p_id;
  return v
    || jsonb_build_object('pedido', (v -> 'pedido') || jsonb_strip_nulls(jsonb_build_object(
         'prestador', (select jsonb_build_object('id', r.id, 'nome', r.nome) from prestadores r where r.id = p.prestador_id))))
    || jsonb_build_object('avisosRegistro', avisos_do_registro(p.id))
    || jsonb_build_object('historico', coalesce((
         select jsonb_agg(case when h ->> 'acao' = 'pedido.avisado' then
                                 jsonb_set(h, '{dados}', (h -> 'dados') || jsonb_strip_nulls(jsonb_build_object('quem', coalesce(
                                   nome_pessoa((h -> 'dados' ->> 'pessoa')::uuid),
                                   (select nome from contatos where id = (h -> 'dados' ->> 'contato')::uuid),
                                   (select nome from prestadores where id = (h -> 'dados' ->> 'prestador')::uuid)))))
                               else h end order by n)
           from jsonb_array_elements(v -> 'historico') with ordinality x(h, n)), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------
-- Configurações › Prazos e avisos: o cartão Pedido novo.

alter function plataforma_configuracoes(uuid, uuid) rename to configuracoes_r13;
alter function configuracoes_r13(uuid, uuid) security invoker;
create function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := configuracoes_r13(p_pessoa, p_condominio);
  return v || jsonb_build_object('avisoNovo', (select jsonb_build_object('sindico', c.aviso_novo_sindico, 'protocolo', c.aviso_novo_protocolo,
                                                                         'podeMudar', eh_sindico(p_pessoa) and pode(p_pessoa, p_condominio, 'config.editar'))
                                                 from configuracao_condominio c));
end $$;

create function plataforma_definir_aviso_novo(p_pessoa uuid, p_condominio uuid, p_versao integer, p_sindico text, p_protocolo boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  -- Quem fica sabendo de pedido novo é decisão do síndico (desenho, tela 7).
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico muda quem é avisado de pedido novo' using errcode = 'TC401'; end if;
  if p_sindico is null or p_sindico not in ('NUNCA', 'SEM_RESPONSAVEL_OU_URGENTE', 'TODOS') then
    perform recusar_campos('Escolha quando avisar o síndico', 'sindico');
  end if;
  if p_protocolo is null then perform recusar_campos('Diga se manda o protocolo', 'protocolo'); end if;
  select id into v_id from configuracao_condominio;
  update configuracao_condominio set aviso_novo_sindico = p_sindico, aviso_novo_protocolo = p_protocolo
   where id = v_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_id); end if;
  perform registrar_historico('regras_aviso.pedido_novo', 'configuracao_condominio', v_id::text,
                              jsonb_build_object('sindico', p_sindico, 'protocolo', p_protocolo));
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- E-mail do protocolo e do aviso ao prestador (a forma fica na API).

alter function montar_email(envios_email) rename to montar_email_r13;
alter function montar_email_r13(envios_email) security invoker;
create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  ct contatos;
  r prestadores;
  p pedidos;
  v_cancelar text;
begin
  if e.tipo not in ('PROTOCOLO', 'PRESTADOR') then return montar_email_r13(e); end if;
  select * into cfg from configuracao_condominio;
  select * into p from pedidos where id = e.pedido_atendimento_id;
  if e.tipo = 'PROTOCOLO' then
    select * into ct from contatos where id = e.contato_id;
    v_cancelar := case
      when not cfg.email_ligado then 'O envio por e-mail foi desligado'
      when ct.id is null or ct.dados_removidos_em is not null or ct.email_situacao <> 'CONFIRMADO' or lower(ct.email) <> lower(e.para)
        then 'O contato não recebe mais por e-mail' end;
  else
    select * into r from prestadores where id = e.prestador_id;
    v_cancelar := case
      when not cfg.email_ligado then 'O envio por e-mail foi desligado'
      when r.id is null or r.arquivado_em is not null or lower(coalesce(r.email, '')) <> lower(e.para) then 'O prestador mudou de e-mail ou saiu do cadastro' end;
  end if;
  if v_cancelar is not null then
    update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
    return null;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', cfg.email_responder_para, 'nome', coalesce(nome_curto(ct.nome), r.nome),
    'codigos', case when e.tipo = 'PROTOCOLO' then jsonb_build_object('parar', criar_link('PARAR_EMAIL', ct.id, ct.id, e.id, ct.email, interval '1 year'))
                    else '{}'::jsonb end,
    'pedido', jsonb_strip_nulls(jsonb_build_object(
      'protocolo', p.protocolo,
      'prioridade', (select lower(nome) from prioridades where id = p.prioridade_id),
      'assunto', case when e.tipo = 'PROTOCOLO' then p.assunto end,
      'unidade', case when e.tipo = 'PROTOCOLO' then coalesce(rotulo_unidade(p.unidade_id), p.local) end,
      'canal', case when e.tipo = 'PROTOCOLO' then canal_na_frase(p.canal) end,
      'atendimento', case when e.tipo = 'PROTOCOLO' then descrever_atendimento() end,
      'texto', case when e.tipo = 'PRESTADOR' then e.corpo end))));
end $$;

call fechar_acesso();

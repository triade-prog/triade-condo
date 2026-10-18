-- 0160 · Mural online e e-mail dos comunicados e documentos (CD-12, CD-13, CD-14). Telas e
-- decisões aprovadas pela Carolina em 18/10/2026 (docs/telas/mural-email.html).
--
-- Regras desta parte:
-- 1. Mural do prédio (CD-12): um link sem conta, com código de 12 caracteres aleatórios, que
--    mostra só os comunicados publicados para todo o condomínio e marcados "no mural". Sem
--    nomes, telefones ou unidades. Começa desligado; trocar o link pede motivo e o antigo para
--    na hora. Conta quantas vezes foi aberto por dia, sem saber quem abriu.
-- 2. E-mail do contato (CD-13): opcional, um por contato, confirmado pela própria pessoa num
--    link que vale 7 dias. Ninguém da gestão marca como confirmado. "Parar de receber" só a
--    própria pessoa desfaz.
-- 3. Quem recebe por e-mail: a conta da CD-02, refeita na hora do envio, para quem tem e-mail
--    confirmado e não parou. O e-mail começa desligado em cada condomínio. Fora do horário sem
--    envio; dentro dele, espera o fim.
-- 4. Fila de e-mails: o banco guarda cada envio; a api-plataforma pega um lote, manda pelo
--    Resend e devolve o resultado. Devolução definitiva e spam desligam aquele e-mail e avisam
--    no sino; caixa cheia tenta de novo por 24 horas.
-- 5. Link pessoal (CD-13): abre o comunicado na versão mais nova, com os arquivos, enquanto a
--    pessoa for contato de uma unidade, até 90 dias. Conta quem abriu, sem rastreio escondido.
-- 6. Documento por e-mail (CD-14): só "pode ir ao morador" e não restrito; vai a versão em
--    vigor por link de 7 dias que pode ser cancelado. Pedido pelo mural tem resposta neutra;
--    contato confirmado recebe na hora (ou com aprovação), outro e-mail espera o síndico.
-- 7. Os códigos dos links nunca ficam guardados: só o sha256 (o do mural fica na configuração,
--    porque é público e o síndico copia).

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- E-mail sem espaço, com domínio. Vazio (null) não é inválido: quem exige o campo confere.
create function email_valido(p text) returns boolean
language sql immutable
set search_path = public
as $$ select length(p) between 6 and 254 and p ~ '^[^@\s<>(),;:"\[\]]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$' $$;

create function hash_codigo(p text) returns bytea
language sql immutable
set search_path = public
as $$ select extensions.digest(convert_to(coalesce(p, ''), 'UTF8'), 'sha256') $$;

-- Código de link pessoal: 32 bytes aleatórios em base64url.
create function novo_codigo() returns text
language sql volatile
set search_path = public
as $$ select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_') $$;

-- Código do mural: 12 caracteres sem os que se confundem (I, L, O, 0, 1), em três grupos.
create function novo_codigo_mural() returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v text := '';
begin
  for i in 0..11 loop
    v := v || substr(v_letras, 1 + get_byte(v_bytes, i) % 31, 1);
    if i in (3, 7) then v := v || '-'; end if;
  end loop;
  return v;
end $$;

-- O sistema entra num condomínio sem pessoa: a fila de e-mails, os eventos do provedor e os
-- links sem conta. Só funções internas chamam (nenhuma é da API).
create function entrar_como_sistema(p_condominio uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  perform limpar_contexto();
  perform set_config('app.condominio_id', coalesce(p_condominio::text, ''), true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Configuração do mural e do e-mail.

alter table configuracao_condominio
  add column mural_ligado          boolean not null default false,
  add column mural_codigo          text unique check (mural_codigo ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  add column mural_assuntos        text[] not null default array['AVISO', 'OBRAS', 'ASSEMBLEIA', 'LEMBRETE']
    check (mural_assuntos <@ array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE']),
  add column email_ligado          boolean not null default false,
  add column email_responder_para  text check (email_valido(email_responder_para)),
  add column documentos_no_mural   boolean not null default true,
  add column documentos_automatico boolean not null default true,
  add constraint mural_ligado_com_codigo check (not mural_ligado or mural_codigo is not null);

-- Links sem conta. O código chega antes de se saber o condomínio: a tabela é global e guarda
-- só o hash do código.
create table links_publicos (
  hash          bytea primary key check (length(hash) = 32),
  condominio_id uuid not null references condominios (id) on delete restrict,
  tipo          text not null check (tipo in ('MURAL', 'COMUNICADO', 'CONFIRMAR_EMAIL', 'PARAR_EMAIL', 'DOCUMENTO')),
  alvo_id       uuid,
  contato_id    uuid,
  envio_id      uuid,
  email_hash    bytea,
  criado_em     timestamptz not null default app_now(),
  expira_em     timestamptz,
  revogado_em   timestamptz,
  check ((tipo = 'MURAL') = (alvo_id is null)),
  check (tipo not in ('COMUNICADO', 'CONFIRMAR_EMAIL', 'PARAR_EMAIL') or contato_id is not null),
  check (tipo not in ('CONFIRMAR_EMAIL', 'PARAR_EMAIL') or email_hash is not null)
);
create index links_publicos_envio on links_publicos (envio_id) where envio_id is not null;
call proteger_tabela_global('links_publicos', 'Links sem conta (mural e e-mail): o código chega antes de se saber o condomínio; guarda só o hash');

-- O link que a pessoa abriu: entra no condomínio dele, sem pessoa. Código desconhecido,
-- vencido ou de outro tipo responde igual.
create function entrar_por_link(p_codigo text, p_tipos text[]) returns links_publicos
language plpgsql
set search_path = public
as $$
declare l links_publicos;
begin
  perform limpar_contexto();
  if p_codigo is null or length(p_codigo) not between 14 and 64 or p_codigo !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Link não encontrado' using errcode = 'TC404';
  end if;
  select * into l from links_publicos where hash = hash_codigo(p_codigo) and tipo = any (p_tipos);
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  perform entrar_como_sistema(l.condominio_id);
  return l;
end $$;

create function link_vale(l links_publicos) returns boolean
language sql stable
set search_path = public
as $$ select l.revogado_em is null and (l.expira_em is null or l.expira_em > app_now()) $$;

create function criar_link(p_tipo text, p_alvo uuid, p_contato uuid, p_envio uuid, p_email text, p_validade interval) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text := novo_codigo();
begin
  insert into links_publicos (hash, condominio_id, tipo, alvo_id, contato_id, envio_id, email_hash, expira_em)
  values (hash_codigo(v_codigo), contexto_condominio(), p_tipo, p_alvo, p_contato, p_envio,
          case when p_email is not null then hash_codigo(lower(p_email)) end,
          case when p_validade is not null then app_now() + p_validade end);
  return v_codigo;
end $$;

-- Aberturas do mural por dia, sem saber quem abriu.
create table mural_aberturas (
  condominio_id uuid not null references condominios (id) on delete restrict,
  dia           date not null,
  vezes         integer not null default 1 check (vezes > 0),
  primary key (condominio_id, dia)
);
call proteger_tabela_condominio('mural_aberturas');

-- ---------------------------------------------------------------------------------------
-- Comunicado no mural e por e-mail.

alter table comunicados
  add column no_mural  boolean not null default false,
  add column por_email boolean not null default true,
  add constraint mural_so_para_todos check (not no_mural or publico = 'TODOS');

-- ---------------------------------------------------------------------------------------
-- E-mail do contato.

alter table contatos
  add column email                text check (email_valido(email)),
  add column email_situacao       text check (email_situacao in ('PENDENTE', 'CONFIRMADO', 'DEVOLVIDO', 'PAROU')),
  add column email_confirmado_em  timestamptz,
  add column email_parou_motivo   text check (email_parou_motivo in ('PEDIDO', 'SPAM')),
  add column email_comunicados    boolean not null default true,
  add constraint email_com_situacao check ((email is null) = (email_situacao is null)),
  add constraint email_parou_com_motivo check ((email_situacao = 'PAROU') = (email_parou_motivo is not null)),
  add constraint email_some_com_dados check (dados_removidos_em is null or email is null);
create index contatos_email on contatos (condominio_id, lower(email)) where email is not null;

-- ---------------------------------------------------------------------------------------
-- Pedidos de documento pelo mural (CD-14).

create table pedidos_documento (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  documento_id    uuid not null,
  email           text not null check (email_valido(email)),
  contato_id      uuid,
  origem          text not null default 'MURAL' check (origem in ('MURAL')),
  estado          text not null check (estado in ('ESPERANDO', 'ENVIADO', 'RECUSADO')),
  automatico      boolean not null default false,
  motivo_recusa   text check (length(btrim(motivo_recusa)) between 3 and 500),
  decidido_em     timestamptz,
  decidido_por    uuid references pessoas (id),
  criado_em       timestamptz not null default app_now(),
  unique (id, condominio_id),
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  check ((estado = 'RECUSADO') = (motivo_recusa is not null)),
  check ((estado = 'ESPERANDO') = (decidido_em is null)),
  check (decidido_por is null or decidido_em is not null)
);
create index pedidos_documento_estado on pedidos_documento (condominio_id, estado, criado_em desc);
call proteger_tabela_condominio('pedidos_documento');
create trigger pedidos_documento_sem_exclusao before delete on pedidos_documento for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Fila de e-mails (CD-13, CD-14).

alter table versoes_documento add constraint versoes_documento_id_condominio unique (id, condominio_id);

create table envios_email (
  id                   uuid primary key default gen_random_uuid(),
  condominio_id        uuid not null references condominios (id) on delete restrict,
  tipo                 text not null check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO')),
  comunicado_id        uuid,
  contato_id           uuid,
  documento_id         uuid,
  versao_documento_id  uuid,
  pedido_id            uuid,
  recado               text check (length(btrim(recado)) between 1 and 500),
  para                 text not null check (email_valido(para)),
  estado               text not null default 'NA_FILA'
                       check (estado in ('NA_FILA', 'ENVIANDO', 'ENVIADO', 'ENTREGUE', 'DEVOLVIDO', 'SPAM', 'FALHOU', 'CANCELADO')),
  enviar_apos          timestamptz not null default app_now(),
  tentativas           smallint not null default 0 check (tentativas between 0 and 50),
  provedor_id          text check (length(provedor_id) between 1 and 200),
  aceito_em            timestamptz,
  entregue_em          timestamptz,
  devolvido_em         timestamptz,
  aberto_em            timestamptz,
  motivo               text check (length(motivo) between 1 and 300),
  criado_em            timestamptz not null default app_now(),
  criado_por           uuid references pessoas (id),
  unique (id, condominio_id),
  foreign key (comunicado_id, condominio_id) references comunicados (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  foreign key (versao_documento_id, condominio_id) references versoes_documento (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos_documento (id, condominio_id),
  check (tipo <> 'COMUNICADO' or (comunicado_id is not null and contato_id is not null)),
  check (tipo <> 'CONFIRMACAO' or contato_id is not null),
  check (tipo <> 'DOCUMENTO' or (documento_id is not null and versao_documento_id is not null)),
  check (estado not in ('ENVIADO', 'ENTREGUE', 'DEVOLVIDO', 'SPAM') or aceito_em is not null)
);
create index envios_email_fila on envios_email (condominio_id, enviar_apos) where estado = 'NA_FILA';
create index envios_email_comunicado on envios_email (comunicado_id) where comunicado_id is not null;
create index envios_email_documento on envios_email (documento_id) where documento_id is not null;
create index envios_email_contato on envios_email (contato_id, criado_em desc) where contato_id is not null;
create unique index envios_email_provedor on envios_email (provedor_id) where provedor_id is not null;
call proteger_tabela_condominio('envios_email');
create trigger envios_email_sem_exclusao before delete on envios_email for each row execute function somente_insercao();

create function envios_email_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.tipo, new.comunicado_id, new.contato_id, new.documento_id, new.versao_documento_id, new.pedido_id,
      new.recado, new.para, new.criado_em, new.criado_por)
     is distinct from
     (old.condominio_id, old.tipo, old.comunicado_id, old.contato_id, old.documento_id, old.versao_documento_id, old.pedido_id,
      old.recado, old.para, old.criado_em, old.criado_por) then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger envios_email_regras before update on envios_email for each row execute function envios_email_regras();

-- Avisos no sino de e-mail que voltou ou foi marcado como spam, para quem cuida dos moradores.
create table avisos_email (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  envio_id      uuid not null,
  tipo          text not null check (tipo in ('DEVOLVIDO', 'SPAM')),
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (envio_id, condominio_id) references envios_email (id, condominio_id),
  unique (pessoa_id, envio_id)
);
create index avisos_email_pessoa on avisos_email (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_email');
create trigger avisos_email_sem_exclusao before delete on avisos_email for each row execute function somente_insercao();
create function avisos_email_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.envio_id, new.tipo, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.envio_id, old.tipo, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_email_regras before update on avisos_email for each row execute function avisos_email_regras();

-- Pedido de documento esperando o síndico também avisa no sino, uma vez por pedido e pessoa.
create table avisos_pedido_documento (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  pedido_id     uuid not null,
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (pedido_id, condominio_id) references pedidos_documento (id, condominio_id),
  unique (pessoa_id, pedido_id)
);
create index avisos_pedido_documento_pessoa on avisos_pedido_documento (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_pedido_documento');
create trigger avisos_pedido_documento_sem_exclusao before delete on avisos_pedido_documento for each row execute function somente_insercao();

create function avisos_pedido_documento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.pedido_id, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.pedido_id, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_pedido_documento_regras before update on avisos_pedido_documento for each row execute function avisos_pedido_documento_regras();

insert into configuracoes (chave, valor, descricao) values
  ('limite_mural_max',                   '300', 'Aberturas do mural pelo mesmo aparelho dentro da janela'),
  ('limite_mural_janela_minutos',        '10',  'Janela das aberturas do mural'),
  ('limite_link_max',                    '60',  'Links do e-mail abertos pelo mesmo aparelho dentro da janela'),
  ('limite_link_janela_minutos',         '10',  'Janela dos links do e-mail'),
  ('limite_pedido_documento_max',        '3',   'Pedidos de documento pelo mesmo e-mail dentro da janela'),
  ('limite_pedido_documento_janela_minutos', '1440', 'Janela dos pedidos de documento por e-mail (um dia)'),
  ('limite_pedido_aparelho_max',         '10',  'Pedidos de documento pelo mesmo aparelho dentro da janela'),
  ('limite_pedido_aparelho_janela_minutos', '60', 'Janela dos pedidos de documento por aparelho');

-- ---------------------------------------------------------------------------------------
-- Quando sai: dentro do horário sem envio, o e-mail espera o fim (CD-11).

create function fim_do_silencio(p timestamptz) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare
  c configuracao_condominio;
  v_local timestamp;
  v_hora time;
  v_dia date;
begin
  select * into c from configuracao_condominio;
  if c.id is null or c.comunicados_silencio_inicio = c.comunicados_silencio_fim then return p; end if;
  v_local := p at time zone c.fuso;
  v_hora := v_local::time;
  v_dia := v_local::date;
  if c.comunicados_silencio_inicio > c.comunicados_silencio_fim then
    if v_hora >= c.comunicados_silencio_inicio then return ((v_dia + 1) + c.comunicados_silencio_fim) at time zone c.fuso; end if;
    if v_hora < c.comunicados_silencio_fim then return (v_dia + c.comunicados_silencio_fim) at time zone c.fuso; end if;
  elsif v_hora >= c.comunicados_silencio_inicio and v_hora < c.comunicados_silencio_fim then
    return (v_dia + c.comunicados_silencio_fim) at time zone c.fuso;
  end if;
  return p;
end $$;

-- O contato está numa unidade agora (vínculo confirmado e dados guardados).
create function contato_ativo(p_contato uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from contatos_unidade cu join contatos ct on ct.id = cu.contato_id and ct.dados_removidos_em is null
                  where cu.contato_id = p_contato and cu.estado = 'CONFIRMADO')
$$;

create function unidades_do_contato(p_contato uuid) returns text
language sql stable
set search_path = public
as $$
  select string_agg(rotulo_unidade(cu.unidade_id), ', ' order by rotulo_unidade(cu.unidade_id))
    from contatos_unidade cu where cu.contato_id = p_contato and cu.estado = 'CONFIRMADO'
$$;

-- Recebe por e-mail: e-mail confirmado, sem ter parado, com "comunicados por e-mail" ligado.
create function recebe_por_email(ct contatos) returns boolean
language sql stable
set search_path = public
as $$ select ct.dados_removidos_em is null and ct.email_situacao = 'CONFIRMADO' and ct.email_comunicados $$;

-- ---------------------------------------------------------------------------------------
-- Pôr na fila.

-- Os e-mails de um comunicado publicado, para quem recebe agora (CD-02, CD-13).
create function enfileirar_comunicado(p_id uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  c comunicados;
  v_n integer;
  v_quando timestamptz;
begin
  select * into c from comunicados where id = p_id;
  if c.id is null or c.estado <> 'PUBLICADO' or not c.por_email or not (select email_ligado from configuracao_condominio) then
    return 0;
  end if;
  v_quando := fim_do_silencio(app_now());
  insert into envios_email (condominio_id, tipo, comunicado_id, contato_id, para, enviar_apos, criado_por)
  select c.condominio_id, 'COMUNICADO', c.id, ct.id, ct.email, v_quando, contexto_pessoa()
    from (select distinct contato_id from destinatarios_comunicado(c.assunto, c.publico, c.blocos, c.unidades, c.contatos)) d
    join contatos ct on ct.id = d.contato_id
   where recebe_por_email(ct);
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform registrar_historico('comunicado.email_na_fila', 'comunicados', c.familia_id::text, jsonb_build_object(
      'comunicado', c.id, 'numero', c.numero, 'quantos', v_n, 'enviarApos', v_quando));
  end if;
  return v_n;
end $$;

-- O e-mail de confirmação do contato (só com o e-mail ligado no condomínio).
create function enfileirar_confirmacao(p_contato uuid) returns boolean
language plpgsql
set search_path = public
as $$
declare ct contatos;
begin
  if not coalesce((select email_ligado from configuracao_condominio), false) then return false; end if;
  select * into ct from contatos where id = p_contato;
  if ct.id is null or ct.email_situacao is distinct from 'PENDENTE' then return false; end if;
  update envios_email set estado = 'CANCELADO', motivo = 'Trocado por um envio novo'
   where contato_id = p_contato and tipo = 'CONFIRMACAO' and estado = 'NA_FILA';
  insert into envios_email (condominio_id, tipo, contato_id, para, criado_por)
  values (ct.condominio_id, 'CONFIRMACAO', ct.id, ct.email, contexto_pessoa());
  return true;
end $$;

-- Documento que pode ir por e-mail (CD-14): vai ao morador, não é restrito, não está
-- arquivado e tem versão em vigor.
create function documento_vai_por_email(d documentos) returns boolean
language sql stable
set search_path = public
as $$
  select d.ao_morador and not d.restrito and d.arquivado_em is null and exists (select 1 from versao_em_vigor(d.id) v where v.id is not null)
$$;

create function enfileirar_documento(p_documento uuid, p_contato uuid, p_para text, p_pedido uuid, p_recado text) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v versoes_documento;
  v_id uuid;
begin
  v := versao_em_vigor(p_documento);
  insert into envios_email (condominio_id, tipo, documento_id, versao_documento_id, contato_id, pedido_id, recado, para, criado_por)
  values (v.condominio_id, 'DOCUMENTO', p_documento, v.id, p_contato, p_pedido, nullif(btrim(coalesce(p_recado, '')), ''), btrim(p_para),
          contexto_pessoa())
  returning id into v_id;
  return v_id;
end $$;

-- Publicar agora também põe os e-mails na fila (o resto é igual a 0150).
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
  return v_versao;
end $$;

-- O público também diz quantos recebem por e-mail.
create or replace function publico_json(p_pessoa uuid, p_assunto text, p_publico text, p_blocos uuid[], p_unidades uuid[], p_contatos uuid[])
returns jsonb
language sql stable
set search_path = public
as $$
  with d as (select * from destinatarios_comunicado(p_assunto, p_publico, p_blocos, p_unidades, p_contatos)),
  sem as (select unnest(unidades_sem_destinatario(p_assunto, p_publico, p_blocos, p_unidades)) as id)
  select jsonb_strip_nulls(jsonb_build_object(
    'contatos', (select count(distinct contato_id) from d),
    'unidades', (select count(distinct unidade_id) from d),
    'comEmail', (select count(distinct d.contato_id) from d join contatos ct on ct.id = d.contato_id where recebe_por_email(ct)),
    'semNinguem', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', rotulo_unidade(s.id)) order by rotulo_unidade(s.id))
                              from sem s), '[]'::jsonb),
    'quem', case when pode(p_pessoa, contexto_condominio(), 'moradores.ver') then coalesce((
              select jsonb_agg(jsonb_build_object('contatoId', x.contato_id, 'nome', x.nome, 'unidades', x.unidades, 'email', x.email) order by lower(x.nome))
                from (select d.contato_id, ct.nome, bool_or(recebe_por_email(ct)) as email,
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

-- ---------------------------------------------------------------------------------------
-- Comunicados: no mural e por e-mail.

alter function plataforma_comunicado_opcoes(uuid, uuid) rename to comunicado_opcoes_r1;
alter function comunicado_opcoes_r1(uuid, uuid) security invoker;
create function plataforma_comunicado_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return comunicado_opcoes_r1(p_pessoa, p_condominio) || (
    select jsonb_build_object('canais', jsonb_build_object('muralLigado', c.mural_ligado, 'muralAssuntos', to_jsonb(c.mural_assuntos),
                                                           'emailLigado', c.email_ligado))
      from configuracao_condominio c);
end $$;

alter function plataforma_salvar_comunicado(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text, timestamptz)
  rename to salvar_comunicado_r1;
alter function salvar_comunicado_r1(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text, timestamptz)
  security invoker;
-- Igual a 0150, com onde o comunicado aparece: no mural (só para todo o condomínio; sem
-- escolha, segue os assuntos do mural) e por e-mail. Os canais ficam guardados antes de
-- publicar, para a fila já sair certa.
create function plataforma_salvar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_assunto text,
                                             p_titulo text, p_texto text, p_publico text, p_blocos uuid[], p_unidades uuid[],
                                             p_contatos uuid[], p_pedido uuid, p_manutencao uuid, p_acao text,
                                             p_programado_para timestamptz, p_no_mural boolean default null, p_por_email boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c comunicados;
  v_mural boolean;
begin
  v := salvar_comunicado_r1(p_pessoa, p_condominio, p_id, p_versao, p_assunto, p_titulo, p_texto, p_publico, p_blocos, p_unidades,
                            p_contatos, p_pedido, p_manutencao, case when p_acao = 'PUBLICAR' then 'RASCUNHO' else p_acao end,
                            p_programado_para);
  select * into c from comunicados where id = (v ->> 'id')::uuid;
  v_mural := c.publico = 'TODOS'
             and coalesce(p_no_mural, (select c.assunto = any (mural_assuntos) from configuracao_condominio));
  if (c.no_mural, c.por_email) is distinct from (v_mural, coalesce(p_por_email, c.por_email)) then
    update comunicados set no_mural = v_mural, por_email = coalesce(p_por_email, c.por_email) where id = c.id;
  end if;
  if p_acao = 'PUBLICAR' then
    perform publicar_comunicado(c.id, p_pessoa, 'PUBLICADO');
  end if;
  return jsonb_build_object('id', c.id, 'versao', (select versao from comunicados where id = c.id));
end $$;

alter function plataforma_corrigir_comunicado(uuid, uuid, uuid, integer, text, text, text) rename to corrigir_comunicado_r1;
alter function corrigir_comunicado_r1(uuid, uuid, uuid, integer, text, text, text) security invoker;
-- Corrigir (igual a 0150): a versão nova fica no mural no lugar da antiga. Só reenvia por
-- e-mail se pedirem; o e-mail começa com o que mudou.
create function plataforma_corrigir_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_texto text, p_mudanca text, p_avisar_email boolean default false)
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
  v := corrigir_comunicado_r1(p_pessoa, p_condominio, p_id, p_versao, p_titulo, p_texto, p_mudanca);
  v_id := (v ->> 'id')::uuid;
  select * into a from comunicados where id = p_id;
  update comunicados set no_mural = a.no_mural, por_email = a.por_email where id = v_id and (no_mural, por_email) <> (a.no_mural, a.por_email);
  if coalesce(p_avisar_email, false) then perform enfileirar_comunicado(v_id); end if;
  return jsonb_build_object('id', v_id, 'versao', (select versao from comunicados where id = v_id));
end $$;

-- Tirar do mural ou pôr de volta um comunicado publicado (CD-12).
create function plataforma_mural_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_no_mural boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
  c := exigir_comunicado(p_id);
  if c.estado not in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO') then
    perform recusar_motivo('Este comunicado já não está em uso', 'COMUNICADO_FORA_DE_USO');
  end if;
  if p_no_mural is null then perform recusar_campos('Diga se aparece no mural', 'noMural'); end if;
  if p_no_mural and c.publico <> 'TODOS' then
    perform recusar_motivo('Só comunicado para todo o condomínio vai ao mural', 'MURAL_SO_PARA_TODOS');
  end if;
  update comunicados set no_mural = p_no_mural where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('comunicados', p_id); end if;
  perform registrar_historico(case when p_no_mural then 'comunicado.mural_ligado' else 'comunicado.mural_tirado' end,
                              'comunicados', c.familia_id::text, jsonb_build_object('comunicado', c.id, 'numero', c.numero));
  return jsonb_build_object('versao', v_versao);
end $$;

alter function plataforma_comunicado(uuid, uuid, uuid) rename to comunicado_detalhe_r1;
alter function comunicado_detalhe_r1(uuid, uuid, uuid) security invoker;
-- O comunicado (0150) e como chegou: mural, e-mails enviados, entregues, que voltaram e quantos
-- abriram o link pessoal (CD-13, CD-08).
create function plataforma_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c comunicados;
  cfg configuracao_condominio;
begin
  v := comunicado_detalhe_r1(p_pessoa, p_condominio, p_id);
  c := exigir_comunicado(p_id);
  select * into cfg from configuracao_condominio;
  return v || jsonb_build_object(
    'canais', jsonb_build_object('noMural', c.no_mural, 'porEmail', c.por_email, 'muralLigado', cfg.mural_ligado,
                                 'emailLigado', cfg.email_ligado),
    'email', (select jsonb_strip_nulls(jsonb_build_object(
                'total', count(*),
                'naFila', count(*) filter (where e.estado in ('NA_FILA', 'ENVIANDO')),
                'enviados', count(*) filter (where e.estado in ('ENVIADO', 'ENTREGUE', 'DEVOLVIDO', 'SPAM')),
                'entregues', count(*) filter (where e.estado = 'ENTREGUE'),
                'devolvidos', count(*) filter (where e.estado = 'DEVOLVIDO'),
                'spam', count(*) filter (where e.estado = 'SPAM'),
                'falharam', count(*) filter (where e.estado = 'FALHOU'),
                'cancelados', count(*) filter (where e.estado = 'CANCELADO'),
                'abertos', count(*) filter (where e.aberto_em is not null),
                'enviarApos', min(e.enviar_apos) filter (where e.estado = 'NA_FILA')))
                from envios_email e where e.comunicado_id = c.id),
    'problemas', case when pode(p_pessoa, p_condominio, 'moradores.ver') then coalesce((
                   select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                            'envioId', e.id, 'contatoId', ct.id, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id),
                            'estado', e.estado, 'motivo', e.motivo, 'situacaoEmail', ct.email_situacao))
                          order by coalesce(e.devolvido_em, e.criado_em) desc)
                     from envios_email e join contatos ct on ct.id = e.contato_id
                    where e.comunicado_id = c.id and e.estado in ('DEVOLVIDO', 'SPAM', 'FALHOU')), '[]'::jsonb) end,
    'pode', (v -> 'pode') || jsonb_build_object(
      'mural', pode(p_pessoa, p_condominio, 'comunicados.publicar') and c.publico = 'TODOS'
               and c.estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO'),
      'avisarEmail', cfg.email_ligado and c.por_email and c.estado = 'PUBLICADO'));
end $$;

-- ---------------------------------------------------------------------------------------
-- Configurações: mural e e-mail (CD-12, CD-13, CD-14).

create function gerar_link_mural() returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  loop
    v_codigo := novo_codigo_mural();
    exit when not exists (select 1 from links_publicos where hash = hash_codigo(v_codigo));
  end loop;
  insert into links_publicos (hash, condominio_id, tipo) values (hash_codigo(v_codigo), contexto_condominio(), 'MURAL');
  return v_codigo;
end $$;

create or replace function plataforma_plano_comunicacao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return (select jsonb_strip_nulls(jsonb_build_object(
    'assuntos', to_jsonb(c.comunicados_assuntos), 'plano', c.comunicados_plano, 'assinatura', c.comunicados_assinatura,
    'silencioInicio', to_char(c.comunicados_silencio_inicio, 'HH24:MI'), 'silencioFim', to_char(c.comunicados_silencio_fim, 'HH24:MI'),
    'mural', jsonb_build_object('ligado', c.mural_ligado, 'codigo', c.mural_codigo, 'assuntos', to_jsonb(c.mural_assuntos),
                                'aberturas', (select coalesce(sum(vezes), 0) from mural_aberturas where dia > hoje_no_condominio() - 7)),
    'email', jsonb_build_object('ligado', c.email_ligado, 'responderPara', c.email_responder_para,
                                'comEmail', (select count(*) from contatos ct where recebe_por_email(ct) and contato_ativo(ct.id)),
                                'contatos', (select count(*) from contatos ct where contato_ativo(ct.id))),
    'documentos', jsonb_build_object('noMural', c.documentos_no_mural, 'automatico', c.documentos_automatico),
    'versao', c.versao, 'podeEditar', pode(p_pessoa, p_condominio, 'config.editar')))
    from configuracao_condominio c);
end $$;

create function plataforma_definir_mural_email(p_pessoa uuid, p_condominio uuid, p_versao integer, p_mural_ligado boolean,
                                               p_mural_assuntos text[], p_email_ligado boolean, p_responder_para text,
                                               p_documentos_no_mural boolean, p_documentos_automatico boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_assuntos text[];
  v_responder text := nullif(btrim(coalesce(p_responder_para, '')), '');
  v_codigo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_mural_ligado is null or p_email_ligado is null or p_documentos_no_mural is null or p_documentos_automatico is null then
    perform recusar_campos('Diga o que fica ligado', 'muralLigado');
  end if;
  select coalesce(array_agg(a order by array_position(array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE'], a)), '{}')
    into v_assuntos from (select distinct unnest(coalesce(p_mural_assuntos, '{}')) a) x;
  if not v_assuntos <@ array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE'] then
    perform recusar_campos('Assunto desconhecido', 'muralAssuntos');
  end if;
  if v_responder is not null and not email_valido(v_responder) then perform recusar_campos('E-mail inválido', 'responderPara'); end if;
  select * into v_antes from configuracao_condominio;
  v_codigo := v_antes.mural_codigo;
  if p_mural_ligado and v_codigo is null then v_codigo := gerar_link_mural(); end if;
  update configuracao_condominio
     set mural_ligado = p_mural_ligado, mural_codigo = v_codigo, mural_assuntos = v_assuntos, email_ligado = p_email_ligado,
         email_responder_para = v_responder, documentos_no_mural = p_documentos_no_mural,
         documentos_automatico = p_documentos_automatico
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('mural_email.alterado', 'configuracao_condominio', v_antes.id::text, jsonb_build_object(
    'mural', p_mural_ligado, 'assuntos', to_jsonb(v_assuntos), 'porEmail', p_email_ligado, 'com_resposta', v_responder is not null,
    'documentos', p_documentos_no_mural, 'automatico', p_documentos_automatico));
  -- Ligou o e-mail agora: quem já tem e-mail esperando confirmação recebe o pedido.
  if p_email_ligado and not v_antes.email_ligado then
    perform enfileirar_confirmacao(ct.id) from contatos ct where ct.email_situacao = 'PENDENTE' and contato_ativo(ct.id);
  end if;
  return jsonb_build_object('versao', v_versao, 'codigo', v_codigo);
end $$;

-- Trocar o link do mural: o antigo para na hora (CD-12).
create function plataforma_trocar_link_mural(p_pessoa uuid, p_condominio uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_motivo text;
  v_codigo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  v_motivo := exigir_motivo(p_motivo);
  select * into v_antes from configuracao_condominio;
  if v_antes.mural_codigo is null then perform recusar_motivo('O mural ainda não tem link', 'MURAL_SEM_LINK'); end if;
  update links_publicos set revogado_em = app_now() where hash = hash_codigo(v_antes.mural_codigo) and revogado_em is null;
  v_codigo := gerar_link_mural();
  update configuracao_condominio set mural_codigo = v_codigo where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('mural.link_trocado', 'configuracao_condominio', v_antes.id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao, 'codigo', v_codigo);
end $$;

-- ---------------------------------------------------------------------------------------
-- E-mail do contato (CD-13, MU-01).

-- Gravar, trocar ou tirar o e-mail e a preferência. E-mail novo fica esperando a pessoa
-- confirmar; ninguém da gestão confirma por ela.
create function plataforma_email_contato(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer, p_email text,
                                         p_recebe boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ct contatos;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_versao integer;
  v_fila boolean := false;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into ct from contatos where id = p_contato;
  if not found then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  if v_email is not null and not email_valido(v_email) then perform recusar_campos('E-mail inválido', 'email'); end if;
  if lower(v_email) is distinct from lower(ct.email) then
    update contatos set email = v_email, email_situacao = case when v_email is not null then 'PENDENTE' end,
                        email_confirmado_em = null, email_parou_motivo = null, email_comunicados = coalesce(p_recebe, true)
     where id = p_contato and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
    update envios_email set estado = 'CANCELADO', motivo = 'O e-mail do contato mudou'
     where contato_id = p_contato and estado = 'NA_FILA';
    perform registrar_historico('contato.email_alterado', 'contato', p_contato::text, jsonb_build_object('comEmail', v_email is not null));
    if v_email is not null then v_fila := enfileirar_confirmacao(p_contato); end if;
  else
    update contatos set email_comunicados = coalesce(p_recebe, email_comunicados)
     where id = p_contato and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
    if coalesce(p_recebe, ct.email_comunicados) is distinct from ct.email_comunicados then
      perform registrar_historico('contato.email_preferencia', 'contato', p_contato::text, jsonb_build_object('recebe', p_recebe));
    end if;
  end if;
  return jsonb_build_object('versao', v_versao, 'situacao', (select email_situacao from contatos where id = p_contato),
                            'confirmacaoNaFila', v_fila);
end $$;

-- Mandar de novo o pedido de confirmação (no máximo um a cada 10 minutos).
create function plataforma_reenviar_confirmacao(p_pessoa uuid, p_condominio uuid, p_contato uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ct contatos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into ct from contatos where id = p_contato;
  if not found then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  if ct.email_situacao is distinct from 'PENDENTE' then
    perform recusar_motivo('Este e-mail não está esperando confirmação', 'EMAIL_NAO_PENDENTE');
  end if;
  if not (select email_ligado from configuracao_condominio) then
    perform recusar_motivo('O envio por e-mail está desligado neste condomínio', 'EMAIL_DESLIGADO');
  end if;
  if exists (select 1 from envios_email where contato_id = p_contato and tipo = 'CONFIRMACAO' and criado_em > app_now() - interval '10 minutes') then
    perform recusar_motivo('Já mandamos há pouco. Espere alguns minutos', 'CONFIRMACAO_RECENTE');
  end if;
  perform enfileirar_confirmacao(p_contato);
  perform registrar_historico('contato.confirmacao_reenviada', 'contato', p_contato::text);
  return jsonb_build_object('ok', true);
end $$;

alter function plataforma_unidade(uuid, uuid, uuid) rename to unidade_detalhe_r1;
alter function unidade_detalhe_r1(uuid, uuid, uuid) security invoker;
-- A unidade (0110) com o e-mail de cada contato.
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidade_detalhe_r1(p_pessoa, p_condominio, p_unidade);
  return v || jsonb_build_object(
    'contatos', coalesce((
      select jsonb_agg(x.item || coalesce((
               select jsonb_strip_nulls(jsonb_build_object('email', ct.email, 'emailSituacao', ct.email_situacao,
                                                           'emailComunicados', ct.email_comunicados, 'emailParouMotivo', ct.email_parou_motivo))
                 from contatos ct where ct.id = (x.item ->> 'contatoId')::uuid), '{}'::jsonb) order by x.n)
        from jsonb_array_elements(v -> 'contatos') with ordinality x(item, n)), '[]'::jsonb),
    'emailLigado', (select email_ligado from configuracao_condominio));
end $$;

-- A lista de moradores (0080) com a situação do e-mail e o filtro "sem e-mail confirmado".
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
  if p_estado is not null and p_estado not in ('PENDENTE', 'CONFIRMADO', 'SEM_EMAIL') then perform recusar_campos('Situação desconhecida', 'estado'); end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_digitos := nullif(regexp_replace(coalesce(v_busca, ''), '\D', '', 'g'), '');
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with lista as (
    select cu.id, cu.contato_id, ct.nome, ct.telefone, ct.email_situacao, cu.unidade_id, u.identificacao, u.andar, b.nome as bloco,
           b.ordem as bloco_ordem, cu.relacao, cu.principal, cu.estado, cu.origem, cu.versao
      from contatos_unidade cu
      join contatos ct on ct.id = cu.contato_id
      join unidades u on u.id = cu.unidade_id
      left join blocos b on b.id = u.bloco_id
     where cu.estado <> 'ENCERRADO'
       and (p_estado is null
            or (p_estado = 'SEM_EMAIL' and ct.email_situacao is distinct from 'CONFIRMADO')
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
               'estado', l.estado, 'origem', l.origem, 'versao', l.versao, 'emailSituacao', l.email_situacao)) order by l.ordem)
             from (select *, row_number() over (order by bloco_ordem nulls first, lower(bloco) nulls first, chave_andar(andar),
                                                         chave_unidade(identificacao), principal desc, lower(nome)) as ordem from lista) l
            where l.ordem > (v_pagina - 1) * 50 and l.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from lista),
    'pagina', v_pagina,
    'porPagina', 50,
    'aConfirmar', (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa where cu.estado = 'PENDENTE'),
    'semEmail', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                  where cu.estado <> 'ENCERRADO' and ct.email_situacao is distinct from 'CONFIRMADO'),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'))
    into v;
  return v;
end $$;

-- Remover os dados pessoais (0080) leva o e-mail junto (PT-11).
create or replace function plataforma_remover_dados_contato(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if not exists (select 1 from contatos where id = p_contato) then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  if exists (select 1 from contatos_unidade where contato_id = p_contato and estado <> 'ENCERRADO') then
    perform recusar_motivo('Encerre os vínculos do contato antes de remover os dados', 'CONTATO_COM_UNIDADE');
  end if;
  update contatos set nome = null, telefone = null, email = null, email_situacao = null, email_confirmado_em = null,
                      email_parou_motivo = null, dados_removidos_em = app_now(), dados_removidos_por = p_pessoa
   where id = p_contato and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
  update envios_email set estado = 'CANCELADO', motivo = 'Os dados do contato foram removidos' where contato_id = p_contato and estado = 'NA_FILA';
  perform registrar_historico('contato.dados_removidos', 'contato', p_contato::text);
end $$;

alter function plataforma_importar_moradores(uuid, uuid, jsonb, text) rename to importar_moradores_r1;
alter function importar_moradores_r1(uuid, uuid, jsonb, text) security invoker;
-- Importar (0110) com a coluna e-mail: o contato sem e-mail ganha o da planilha, esperando
-- confirmação. Contato que já tem e-mail fica com o dele.
create function plataforma_importar_moradores(p_pessoa uuid, p_condominio uuid, p_linhas jsonb, p_agrupamento text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v jsonb;
  v_contato uuid;
  v_email text;
  v_emails integer := 0;
begin
  if p_linhas is not null and jsonb_typeof(p_linhas) = 'array' then
    for r in select x, n::int as n from jsonb_array_elements(p_linhas) with ordinality e(x, n) loop
      if jsonb_typeof(r.x) = 'object' and coalesce(jsonb_typeof(r.x -> 'email'), 'null') <> 'null'
         and not email_valido(btrim(coalesce(r.x ->> 'email', ''))) then
        raise exception 'Linha % da planilha com dado inválido', r.n
          using errcode = 'TC422', detail = jsonb_build_object('motivo', 'LINHA_INVALIDA', 'linha', r.n, 'campos', '["email"]'::jsonb)::text;
      end if;
    end loop;
  end if;
  v := importar_moradores_r1(p_pessoa, p_condominio, p_linhas, p_agrupamento);
  for r in select x from jsonb_array_elements(p_linhas) e(x) where nullif(btrim(coalesce(x ->> 'email', '')), '') is not null loop
    v_email := btrim(r.x ->> 'email');
    select id into v_contato from contatos
     where telefone = r.x ->> 'telefone' and lower(btrim(nome)) = lower(btrim(r.x ->> 'nome')) and email is null
     order by criado_em limit 1;
    if v_contato is not null then
      update contatos set email = v_email, email_situacao = 'PENDENTE' where id = v_contato;
      perform enfileirar_confirmacao(v_contato);
      v_emails := v_emails + 1;
    end if;
  end loop;
  return case when v_emails > 0 then v || jsonb_build_object('emails', v_emails) else v end;
end $$;

-- ---------------------------------------------------------------------------------------
-- Documento por e-mail (CD-14).

-- Avisa no sino quem cuida dos documentos (e vê o documento), uma vez por pedido.
create function avisar_pedido_documento(p pedidos_documento) returns void
language sql
set search_path = public
as $$
  insert into avisos_pedido_documento (condominio_id, pessoa_id, pedido_id)
  select p.condominio_id, v.pessoa_id, p.id
    from (select distinct pessoa_id from vinculos where condominio_id = p.condominio_id and revogado_em is null
                                                    and funcao in ('SINDICO', 'AUTORIZADO')) v
    join documentos d on d.id = p.documento_id
   where pode(v.pessoa_id, p.condominio_id, 'documentos.editar')
     and (not d.restrito or pode(v.pessoa_id, p.condominio_id, 'documentos.restritos'))
  on conflict (pessoa_id, pedido_id) do nothing
$$;

-- O síndico envia pela tela do documento, para contatos com e-mail confirmado ou endereços
-- digitados (até 20).
create function plataforma_enviar_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_contatos uuid[], p_emails text[],
                                            p_recado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d documentos;
  v_recado text := nullif(btrim(coalesce(p_recado, '')), '');
  v_emails text[];
  v_n integer := 0;
  r record;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  d := exigir_documento(p_pessoa, p_id);
  if not documento_vai_por_email(d) then
    perform recusar_motivo('Só vai por e-mail documento que pode ir ao morador e tem versão em vigor', 'DOCUMENTO_NAO_VAI_POR_EMAIL');
  end if;
  if not (select email_ligado from configuracao_condominio) then
    perform recusar_motivo('O envio por e-mail está desligado neste condomínio', 'EMAIL_DESLIGADO');
  end if;
  if exists (select 1 from unnest(coalesce(p_contatos, '{}')) x
              where not exists (select 1 from contatos ct where ct.id = x and ct.email_situacao = 'CONFIRMADO' and contato_ativo(ct.id))) then
    perform recusar_campos('Escolha contatos com e-mail confirmado', 'contatos');
  end if;
  select coalesce(array_agg(distinct btrim(e)), '{}') into v_emails from unnest(coalesce(p_emails, '{}')) e where btrim(e) <> '';
  if exists (select 1 from unnest(v_emails) e where not email_valido(e)) then perform recusar_campos('E-mail inválido', 'emails'); end if;
  if cardinality(coalesce(p_contatos, '{}')) + cardinality(v_emails) not between 1 and 20 then
    perform recusar_campos('Escolha de 1 a 20 destinatários', 'contatos');
  end if;
  if length(v_recado) > 500 then perform recusar_campos('Recado até 500 caracteres', 'recado'); end if;
  for r in
    select distinct on (lower(x.para)) x.contato_id, x.para from (
      select ct.id as contato_id, ct.email as para from contatos ct where ct.id = any (coalesce(p_contatos, '{}'))
      union all
      select null, e from unnest(v_emails) e) x
    order by lower(x.para), x.contato_id nulls last
  loop
    perform enfileirar_documento(d.id, r.contato_id, r.para, null, v_recado);
    v_n := v_n + 1;
  end loop;
  perform registrar_historico('documento.enviado_por_email', 'documentos', d.id::text, jsonb_build_object(
    'quantos', v_n, 'contatos', to_jsonb(coalesce(p_contatos, '{}')), 'numero', (select numero from versao_em_vigor(d.id))));
  return jsonb_build_object('enviados', v_n);
end $$;

create function plataforma_pedidos_documento(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_restritos boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  v_restritos := pode(p_pessoa, p_condominio, 'documentos.restritos');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'documentoId', x.documento_id, 'titulo', d.titulo, 'email', x.email, 'estado', x.estado,
               'automatico', x.automatico, 'criadoEm', x.criado_em, 'decididoEm', x.decidido_em,
               'decididoPor', (select nome from pessoas where id = x.decidido_por), 'motivo', x.motivo_recusa,
               'contato', case when x.contato_id is not null then jsonb_build_object('id', ct.id, 'nome', ct.nome,
                                                                                     'unidades', unidades_do_contato(ct.id)) end,
               'abertoEm', (select max(e.aberto_em) from envios_email e where e.pedido_id = x.id)))
             order by x.estado = 'ESPERANDO' desc, x.criado_em desc)
        from (select * from pedidos_documento order by criado_em desc limit 100) x
        join documentos d on d.id = x.documento_id and (not d.restrito or v_restritos)
        left join contatos ct on ct.id = x.contato_id), '[]'::jsonb),
    'esperando', (select count(*) from pedidos_documento where estado = 'ESPERANDO'),
    'podeDecidir', pode(p_pessoa, p_condominio, 'documentos.editar'));
end $$;

create function plataforma_decidir_pedido_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_enviar boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x pedidos_documento;
  d documentos;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  select * into x from pedidos_documento where id = p_id for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'TC404'; end if;
  d := exigir_documento(p_pessoa, x.documento_id);
  if x.estado <> 'ESPERANDO' then perform recusar_motivo('Este pedido já foi decidido', 'PEDIDO_JA_DECIDIDO'); end if;
  if p_enviar is null then perform recusar_campos('Enviar ou recusar', 'enviar'); end if;
  if p_enviar then
    if not documento_vai_por_email(d) then
      perform recusar_motivo('Só vai por e-mail documento que pode ir ao morador e tem versão em vigor', 'DOCUMENTO_NAO_VAI_POR_EMAIL');
    end if;
    if not (select email_ligado from configuracao_condominio) then
      perform recusar_motivo('O envio por e-mail está desligado neste condomínio', 'EMAIL_DESLIGADO');
    end if;
    update pedidos_documento set estado = 'ENVIADO', decidido_em = app_now(), decidido_por = p_pessoa where id = p_id;
    perform enfileirar_documento(d.id, x.contato_id, x.email, x.id, null);
    perform registrar_historico('documento.pedido_enviado', 'documentos', d.id::text, jsonb_build_object('pedido', x.id));
  else
    v_motivo := exigir_motivo(p_motivo);
    update pedidos_documento set estado = 'RECUSADO', motivo_recusa = v_motivo, decidido_em = app_now(), decidido_por = p_pessoa
     where id = p_id;
    perform registrar_historico('documento.pedido_recusado', 'documentos', d.id::text, jsonb_build_object('pedido', x.id, 'motivo', v_motivo));
  end if;
  return jsonb_build_object('estado', case when p_enviar then 'ENVIADO' else 'RECUSADO' end);
end $$;

-- Cancelar o link de um documento enviado: ele para na hora (CD-04).
create function plataforma_cancelar_envio_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_envio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_email;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  perform exigir_documento(p_pessoa, p_id);
  select * into e from envios_email where id = p_envio and documento_id = p_id;
  if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  update links_publicos set revogado_em = app_now() where envio_id = e.id and revogado_em is null;
  if e.estado in ('NA_FILA', 'ENVIANDO') then
    update envios_email set estado = 'CANCELADO', motivo = 'Link cancelado' where id = e.id;
  end if;
  perform registrar_historico('documento.link_cancelado', 'documentos', p_id::text, jsonb_build_object('envio', e.id));
  return jsonb_build_object('ok', true);
end $$;

alter function plataforma_documento(uuid, uuid, uuid) rename to documento_detalhe_r1;
alter function documento_detalhe_r1(uuid, uuid, uuid) security invoker;
-- O documento (0150) com os envios por e-mail e quem pode receber.
create function plataforma_documento(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  d documentos;
  v_editar boolean;
  v_enviar boolean;
begin
  v := documento_detalhe_r1(p_pessoa, p_condominio, p_id);
  d := exigir_documento(p_pessoa, p_id);
  v_editar := pode(p_pessoa, p_condominio, 'documentos.editar');
  v_enviar := v_editar and documento_vai_por_email(d) and (select email_ligado from configuracao_condominio);
  return v || jsonb_strip_nulls(jsonb_build_object(
    'envios', case when v_editar then coalesce((
                select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'id', e.id, 'para', e.para, 'contato', (select nome from contatos where id = e.contato_id),
                         'estado', e.estado, 'criadoEm', e.criado_em, 'abertoEm', e.aberto_em, 'pedido', e.pedido_id is not null,
                         'numero', (select numero from versoes_documento where id = e.versao_documento_id),
                         'cancelado', exists (select 1 from links_publicos l where l.envio_id = e.id and l.revogado_em is not null)
                                      or e.estado = 'CANCELADO',
                         'vence', (select max(l.expira_em) from links_publicos l where l.envio_id = e.id)))
                       order by e.criado_em desc)
                  from (select * from envios_email where documento_id = d.id order by criado_em desc limit 50) e), '[]'::jsonb) end,
    'contatosComEmail', case when v_enviar and pode(p_pessoa, p_condominio, 'moradores.ver') then coalesce((
                          select jsonb_agg(jsonb_build_object('id', ct.id, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id))
                                           order by lower(ct.nome))
                            from contatos ct where ct.email_situacao = 'CONFIRMADO' and contato_ativo(ct.id)), '[]'::jsonb) end,
    'pode', (v -> 'pode') || jsonb_build_object('enviarEmail', v_enviar),
    'vaiPorEmail', documento_vai_por_email(d)));
end $$;

alter function plataforma_documentos(uuid, uuid, text, text) rename to documentos_lista_r1;
alter function documentos_lista_r1(uuid, uuid, text, text) security invoker;
create function plataforma_documentos(p_pessoa uuid, p_condominio uuid, p_filtro text, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return documentos_lista_r1(p_pessoa, p_condominio, p_filtro, p_busca)
         || jsonb_build_object('pedidosEsperando', (select count(*) from pedidos_documento where estado = 'ESPERANDO'));
end $$;

-- ---------------------------------------------------------------------------------------
-- Painel e avisos: e-mail que voltou e pedido de documento entram no sino.

create function avisar_email(e envios_email, p_tipo text) returns void
language sql
set search_path = public
as $$
  insert into avisos_email (condominio_id, pessoa_id, envio_id, tipo)
  select e.condominio_id, v.pessoa_id, e.id, p_tipo
    from (select distinct pessoa_id from vinculos where condominio_id = e.condominio_id and revogado_em is null
                                                    and funcao in ('SINDICO', 'AUTORIZADO')) v
   where pode(v.pessoa_id, e.condominio_id, 'moradores.editar')
  on conflict (pessoa_id, envio_id) do nothing
$$;

create or replace function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select jsonb_strip_nulls(jsonb_build_object(
    'condominio', jsonb_build_object('id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'cenario', c.cenario),
    'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome),
    'funcoes', coalesce((select jsonb_agg(distinct v.funcao order by v.funcao) from vinculos v join funcoes f on f.codigo = v.funcao
                          where v.pessoa_id = p_pessoa and v.condominio_id = c.id and v.revogado_em is null and f.sistema = 'PLATAFORMA'), '[]'::jsonb),
    'acoes', to_jsonb(acoes_da_pessoa(p_pessoa, c.id)),
    'pendencias', to_jsonb(pendencias_configuracao(c.id)),
    'moradores', case when pode(p_pessoa, c.id, 'moradores.ver') then resumo_moradores(c.id) end,
    'pedidos', case when pode(p_pessoa, c.id, 'pedidos.ver') then resumo_pedidos(p_pessoa) end,
    'mesFechado', case when pode(p_pessoa, c.id, 'pedidos.ver') then mes_fechado() end,
    'manutencao', case when pode(p_pessoa, c.id, 'manutencao.ver') then resumo_manutencao() end,
    'comunicados', case when pode(p_pessoa, c.id, 'comunicados.ver') or pode(p_pessoa, c.id, 'documentos.ver')
                        then resumo_comunicados(p_pessoa) end,
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_email a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

create or replace function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(x.item order by x.visto, x.criado desc)
        from (
          select a.visto_em is not null as visto, a.criado_em as criado, jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'pedidoId', p.id, 'protocolo', p.protocolo,
                   'assunto', case when pedido_visivel(p_pessoa, p) then p.assunto end,
                   'responsavel', nome_do_vinculo(p.responsavel_id),
                   'referencia', a.referencia, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em) as item
            from avisos a join pedidos p on p.id = a.pedido_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'MANUTENCAO_RETORNO_VENCIDO', 'manutencaoId', m.id, 'titulo', m.titulo,
                   'responsavel', nome_do_vinculo(m.responsavel_id),
                   'referencia', a.referencia, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_manutencao a join manutencoes m on m.id = a.manutencao_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'DOCUMENTO_VENCENDO', 'documentoId', d.id, 'titulo', d.titulo,
                   'referencia', to_char(a.referencia, 'YYYY-MM-DD'), 'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_documento a join documentos d on d.id = a.documento_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'DOCUMENTO_PEDIDO', 'documentoId', d.id, 'titulo', d.titulo,
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_pedido_documento a join pedidos_documento p on p.id = a.pedido_id join documentos d on d.id = p.documento_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', case a.tipo when 'SPAM' then 'EMAIL_SPAM' else 'EMAIL_DEVOLVIDO' end,
                   'contatoId', e.contato_id, 'nome', (select nome from contatos where id = e.contato_id),
                   'unidades', unidades_do_contato(e.contato_id), 'comunicadoId', e.comunicado_id, 'documentoId', e.documento_id,
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_email a join envios_email e on e.id = a.envio_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  update avisos set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  update avisos_manutencao set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_m = row_count;
  update avisos_documento set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_d = row_count;
  update avisos_email set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_e = row_count;
  update avisos_pedido_documento set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_p = row_count;
  return v_n + v_m + v_d + v_e + v_p;
end $$;

-- ---------------------------------------------------------------------------------------
-- Sem conta: o mural e os links do e-mail. Funções chamadas pela API sem sessão; cada uma
-- entra só no condomínio do link.

-- O comunicado como o morador lê: sem autor, sem público, sem nada da gestão.
create function comunicado_publico_json(c comunicados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'assunto', c.assunto, 'titulo', c.titulo, 'texto', c.texto, 'assinatura', c.assinatura,
    'publicadoEm', c.publicado_em, 'numero', c.numero, 'mudanca', c.mudanca,
    'arquivos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
                            from arquivos_comunicado a
                           where a.familia_id = c.familia_id and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb)))
$$;

-- O mural que o link aponta, ligado e com o código de agora; senão, não encontrado.
create function exigir_mural(p_codigo text) returns configuracao_condominio
language plpgsql
set search_path = public
as $$
declare
  l links_publicos;
  cfg configuracao_condominio;
begin
  l := entrar_por_link(upper(p_codigo), array['MURAL']);
  select * into cfg from configuracao_condominio;
  if l.revogado_em is not null or not cfg.mural_ligado or cfg.mural_codigo is distinct from upper(p_codigo) then
    raise exception 'Mural fora do ar' using errcode = 'TC404';
  end if;
  return cfg;
end $$;

create function publico_mural(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  cfg configuracao_condominio;
  v_nome text;
begin
  l := entrar_por_link(upper(p_codigo), array['MURAL']);
  select * into cfg from configuracao_condominio;
  select nome into v_nome from condominios where id = l.condominio_id;
  if l.revogado_em is not null then return jsonb_build_object('condominio', v_nome, 'trocado', true); end if;
  if not cfg.mural_ligado or cfg.mural_codigo is distinct from upper(p_codigo) then
    return jsonb_build_object('condominio', v_nome, 'foraDoAr', true);
  end if;
  insert into mural_aberturas (condominio_id, dia) values (l.condominio_id, hoje_no_condominio())
  on conflict (condominio_id, dia) do update set vezes = mural_aberturas.vezes + 1;
  return jsonb_build_object(
    'condominio', v_nome,
    'comunicados', coalesce((
      select jsonb_agg(comunicado_publico_json(c) order by c.publicado_em desc)
        from (select * from comunicados where estado = 'PUBLICADO' and no_mural and publico = 'TODOS'
               order by publicado_em desc limit 60) c), '[]'::jsonb),
    'documentos', case when cfg.documentos_no_mural and cfg.email_ligado then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'tipo', d.tipo)
                       order by array_position(array['CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO'], d.tipo), lower(d.titulo))
        from documentos d where documento_vai_por_email(d)), '[]'::jsonb) else '[]'::jsonb end,
    'atualizadoEm', (select max(publicado_em) from comunicados where estado = 'PUBLICADO' and no_mural and publico = 'TODOS'));
end $$;

create function publico_mural_arquivo(p_codigo text, p_comunicado uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  a arquivos_comunicado;
begin
  perform exigir_mural(p_codigo);
  select * into c from comunicados where id = p_comunicado and estado = 'PUBLICADO' and no_mural and publico = 'TODOS';
  if not found then raise exception 'Comunicado não encontrado' using errcode = 'TC404'; end if;
  a := exigir_arquivo_comunicado(c.familia_id, p_arquivo);
  if a.situacao <> 'LIBERADO' then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Pedir um documento pelo mural (CD-14). A resposta é sempre a mesma, para não revelar quem
-- mora no prédio. A API conta os limites por e-mail e por aparelho antes de chamar.
create function publico_pedir_documento(p_codigo text, p_documento uuid, p_email text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  d documentos;
  ct contatos;
  v_email text := btrim(coalesce(p_email, ''));
  v_id uuid;
  v_auto boolean;
begin
  cfg := exigir_mural(p_codigo);
  if not email_valido(v_email) then perform recusar_campos('E-mail inválido', 'email'); end if;
  select * into d from documentos where id = p_documento;
  if not cfg.documentos_no_mural or not cfg.email_ligado or d.id is null or not documento_vai_por_email(d) then
    return jsonb_build_object('ok', true);
  end if;
  -- O mesmo pedido de novo, logo depois, não vira outro.
  if exists (select 1 from pedidos_documento where documento_id = d.id and lower(email) = lower(v_email)
                and estado <> 'RECUSADO' and criado_em > app_now() - interval '1 hour') then
    return jsonb_build_object('ok', true);
  end if;
  select * into ct from contatos c where lower(c.email) = lower(v_email) and c.email_situacao = 'CONFIRMADO' and contato_ativo(c.id)
   order by c.criado_em limit 1;
  v_auto := ct.id is not null and cfg.documentos_automatico;
  insert into pedidos_documento (condominio_id, documento_id, email, contato_id, estado, automatico, decidido_em)
  values (d.condominio_id, d.id, coalesce(ct.email, v_email), ct.id, case when v_auto then 'ENVIADO' else 'ESPERANDO' end, v_auto,
          case when v_auto then app_now() end)
  returning id into v_id;
  if v_auto then
    perform enfileirar_documento(d.id, ct.id, ct.email, v_id, null);
  else
    perform avisar_pedido_documento(x) from pedidos_documento x where x.id = v_id;
  end if;
  perform registrar_historico('documento.pedido', 'documentos', d.id::text, jsonb_build_object(
    'pedido', v_id, 'automatico', v_auto, 'deContato', ct.id is not null));
  return jsonb_build_object('ok', true);
end $$;

-- Link pessoal do e-mail (CD-13): vale enquanto a pessoa for contato de uma unidade.
create function exigir_link_comunicado(p_codigo text) returns links_publicos
language plpgsql
set search_path = public
as $$
declare l links_publicos;
begin
  l := entrar_por_link(p_codigo, array['COMUNICADO']);
  if not link_vale(l) or not contato_ativo(l.contato_id) then
    perform recusar_motivo('Este link venceu', 'LINK_VENCIDO');
  end if;
  return l;
end $$;

create function publico_comunicado(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  c comunicados;
  v_nome text;
begin
  l := exigir_link_comunicado(p_codigo);
  select nome into v_nome from condominios where id = l.condominio_id;
  select * into c from comunicados where familia_id = l.alvo_id and estado = 'PUBLICADO';
  if not found then
    return jsonb_build_object('condominio', v_nome, 'foraDeUso', true);
  end if;
  if l.envio_id is not null then
    update envios_email set aberto_em = app_now() where id = l.envio_id and aberto_em is null;
  end if;
  return jsonb_build_object('condominio', v_nome, 'comunicado', comunicado_publico_json(c));
end $$;

create function publico_comunicado_arquivo(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  a arquivos_comunicado;
begin
  l := exigir_link_comunicado(p_codigo);
  a := exigir_arquivo_comunicado(l.alvo_id, p_arquivo);
  if a.situacao <> 'LIBERADO' then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Confirmar o e-mail (CD-13): só a própria pessoa, pelo link que chegou nele.
create function publico_confirmar_email(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  ct contatos;
begin
  l := entrar_por_link(p_codigo, array['CONFIRMAR_EMAIL']);
  select * into ct from contatos where id = l.contato_id;
  if not link_vale(l) or ct.email is null or hash_codigo(lower(ct.email)) <> l.email_hash
     or ct.email_situacao not in ('PENDENTE', 'CONFIRMADO') then
    perform recusar_motivo('Este link venceu', 'LINK_VENCIDO');
  end if;
  if ct.email_situacao = 'PENDENTE' then
    update contatos set email_situacao = 'CONFIRMADO', email_confirmado_em = app_now() where id = ct.id;
    perform registrar_historico('contato.email_confirmado', 'contato', ct.id::text);
  end if;
  return jsonb_build_object('nome', ct.nome, 'email', ct.email, 'condominio', (select nome from condominios where id = l.condominio_id));
end $$;

create function exigir_link_parar(p_codigo text) returns contatos
language plpgsql
set search_path = public
as $$
declare
  l links_publicos;
  ct contatos;
begin
  l := entrar_por_link(p_codigo, array['PARAR_EMAIL']);
  select * into ct from contatos where id = l.contato_id;
  if not link_vale(l) or ct.email is null or hash_codigo(lower(ct.email)) <> l.email_hash then
    perform recusar_motivo('Este link venceu', 'LINK_VENCIDO');
  end if;
  return ct;
end $$;

-- Parar de receber (CD-13): um toque, sem login. Só a própria pessoa volta.
create function publico_parar_email(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ct contatos;
begin
  ct := exigir_link_parar(p_codigo);
  if ct.email_situacao in ('PENDENTE', 'CONFIRMADO') then
    update contatos set email_situacao = 'PAROU', email_parou_motivo = 'PEDIDO' where id = ct.id;
    update envios_email set estado = 'CANCELADO', motivo = 'O contato parou de receber' where contato_id = ct.id and estado = 'NA_FILA';
    perform registrar_historico('contato.email_parou', 'contato', ct.id::text, jsonb_build_object('motivo', 'PEDIDO'));
  end if;
  return jsonb_build_object('condominio', (select nome from condominios where id = ct.condominio_id),
                            'parou', (select email_situacao = 'PAROU' from contatos where id = ct.id));
end $$;

create function publico_voltar_email(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ct contatos;
begin
  ct := exigir_link_parar(p_codigo);
  if ct.email_situacao = 'PAROU' and ct.email_parou_motivo = 'PEDIDO' then
    update contatos set email_situacao = 'CONFIRMADO', email_parou_motivo = null, email_confirmado_em = app_now() where id = ct.id;
    perform registrar_historico('contato.email_voltou', 'contato', ct.id::text);
  end if;
  return jsonb_build_object('condominio', (select nome from condominios where id = ct.condominio_id),
                            'parou', (select email_situacao = 'PAROU' from contatos where id = ct.id));
end $$;

-- Abrir o documento enviado por e-mail (CD-14): link de 7 dias que pode ser cancelado; cada
-- abertura fica no histórico do documento.
create function publico_documento(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  v versoes_documento;
  d documentos;
begin
  l := entrar_por_link(p_codigo, array['DOCUMENTO']);
  select * into v from versoes_documento where id = l.alvo_id;
  select * into d from documentos where id = v.documento_id;
  if not link_vale(l) or d.arquivado_em is not null or v.situacao <> 'LIBERADO' then
    perform recusar_motivo('Este link venceu', 'LINK_VENCIDO');
  end if;
  update envios_email set aberto_em = app_now() where id = l.envio_id and aberto_em is null;
  perform registrar_historico('documento.aberto_por_email', 'documentos', d.id::text, jsonb_build_object(
    'envio', l.envio_id, 'numero', v.numero));
  return jsonb_build_object('caminho', v.caminho, 'nome', v.nome, 'tipo', v.tipo, 'titulo', d.titulo, 'numero', v.numero,
                            'condominio', (select nome from condominios where id = l.condominio_id));
end $$;

-- ---------------------------------------------------------------------------------------
-- A fila: a api-plataforma pega um lote, manda pelo Resend e devolve o resultado.

-- Monta a mensagem de um envio, com os códigos dos links. Envio que perdeu o sentido (e-mail
-- trocado, contato que saiu, comunicado arquivado) é cancelado com o motivo.
create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  ct contatos;
  c comunicados;
  atual comunicados;
  d documentos;
  v versoes_documento;
  v_base jsonb;
  v_cancelar text;
begin
  select * into cfg from configuracao_condominio;
  select * into ct from contatos where id = e.contato_id;
  v_base := jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', cfg.email_responder_para, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id)));
  update links_publicos set revogado_em = app_now() where envio_id = e.id and revogado_em is null;
  if e.tipo = 'COMUNICADO' then
    select * into c from comunicados where id = e.comunicado_id;
    select * into atual from comunicados where familia_id = c.familia_id and estado = 'PUBLICADO';
    v_cancelar := case
      when not cfg.email_ligado then 'O envio por e-mail foi desligado'
      when ct.id is null or not recebe_por_email(ct) or lower(ct.email) <> lower(e.para) then 'O contato não recebe mais por e-mail'
      when not contato_ativo(ct.id) then 'O contato saiu da unidade'
      when atual.id is null then 'O comunicado saiu de uso' end;
    if v_cancelar is null then
      return v_base || jsonb_build_object(
        'codigos', jsonb_build_object('ver', criar_link('COMUNICADO', c.familia_id, ct.id, e.id, null, interval '90 days'),
                                      'parar', criar_link('PARAR_EMAIL', ct.id, ct.id, e.id, ct.email, interval '1 year')),
        'comunicado', comunicado_publico_json(atual) || jsonb_strip_nulls(jsonb_build_object(
          'correcao', case when c.numero > 1 then c.mudanca end,
          'imagens', (select jsonb_agg(a.id order by a.enviado_em, a.id) from arquivos_comunicado a
                       where a.familia_id = c.familia_id and a.situacao = 'LIBERADO' and a.retirado_em is null and a.tipo like 'image/%'))));
    end if;
  elsif e.tipo = 'CONFIRMACAO' then
    v_cancelar := case when ct.id is null or ct.email is null or lower(ct.email) <> lower(e.para) or ct.email_situacao <> 'PENDENTE'
                       then 'O e-mail mudou ou já foi confirmado' end;
    if v_cancelar is null then
      return v_base || jsonb_build_object('codigos', jsonb_build_object(
        'confirmar', criar_link('CONFIRMAR_EMAIL', ct.id, ct.id, e.id, ct.email, interval '7 days')));
    end if;
  else
    select * into d from documentos where id = e.documento_id;
    select * into v from versoes_documento where id = e.versao_documento_id;
    v_cancelar := case when not cfg.email_ligado then 'O envio por e-mail foi desligado'
                       when not documento_vai_por_email(d) then 'O documento não vai mais por e-mail' end;
    if v_cancelar is null then
      return v_base || jsonb_build_object(
        'codigos', jsonb_build_object('abrir', criar_link('DOCUMENTO', v.id, e.contato_id, e.id, null, interval '7 days')),
        'documento', jsonb_strip_nulls(jsonb_build_object('titulo', d.titulo, 'numero', v.numero,
                                                          'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'), 'recado', e.recado)));
    end if;
  end if;
  update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
  return null;
end $$;

create function email_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  e envios_email;
  v_msg jsonb;
  v_saida jsonb := '[]'::jsonb;
  v_max integer := least(greatest(coalesce(p_max, 50), 1), 100);
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    exit when jsonb_array_length(v_saida) >= v_max;
    perform entrar_como_sistema(r.id);
    -- O que travou no meio do envio volta para a fila.
    update envios_email set estado = 'NA_FILA' where estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '15 minutes';
    for e in select * from envios_email where estado = 'NA_FILA' and enviar_apos <= app_now()
              order by enviar_apos, criado_em limit v_max - jsonb_array_length(v_saida) for update skip locked loop
      begin
        v_msg := montar_email(e);
        if v_msg is not null then
          update envios_email set estado = 'ENVIANDO', tentativas = tentativas + 1, enviar_apos = app_now() where id = e.id;
          v_saida := v_saida || jsonb_build_array(v_msg);
        end if;
      exception when others then
        update envios_email set estado = 'FALHOU', motivo = left('Não deu para montar: ' || sqlerrm, 300) where id = e.id;
      end;
    end loop;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_saida;
end $$;

-- O provedor aceitou (com o id dele) ou recusou o envio. Falha passageira tenta de novo por
-- até 24 horas.
create function email_resultado(p_condominio uuid, p_envio uuid, p_provedor_id text, p_erro text, p_tentar_de_novo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare e envios_email;
begin
  perform entrar_como_sistema(p_condominio);
  select * into e from envios_email where id = p_envio for update;
  if not found or e.estado <> 'ENVIANDO' then return; end if;
  if p_provedor_id is not null then
    update envios_email set estado = 'ENVIADO', provedor_id = p_provedor_id, aceito_em = app_now(), motivo = null where id = e.id;
  elsif coalesce(p_tentar_de_novo, false) and e.criado_em > app_now() - interval '24 hours' and e.tentativas < 20 then
    update envios_email set estado = 'NA_FILA', enviar_apos = app_now() + least(interval '30 minutes' * e.tentativas, interval '2 hours'),
                            motivo = left(coalesce(p_erro, 'Falha passageira'), 300)
     where id = e.id;
  else
    update envios_email set estado = 'FALHOU', motivo = left(coalesce(p_erro, 'O provedor recusou'), 300) where id = e.id;
    update links_publicos set revogado_em = app_now() where envio_id = e.id and revogado_em is null;
  end if;
  perform entrar_como_sistema(null);
end $$;

-- O que o provedor conta depois (CD-13): entregue, devolvido (definitivo ou passageiro) ou
-- marcado como spam.
create function email_evento(p_condominio uuid, p_envio uuid, p_provedor_id text, p_tipo text, p_detalhe text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_email;
  ct contatos;
begin
  if p_tipo is null or p_tipo not in ('ENTREGUE', 'DEVOLVIDO', 'ADIADO', 'SPAM') then return false; end if;
  perform entrar_como_sistema(p_condominio);
  select * into e from envios_email where id = p_envio and provedor_id is not distinct from coalesce(p_provedor_id, provedor_id) for update;
  if not found then perform entrar_como_sistema(null); return false; end if;
  select * into ct from contatos where id = e.contato_id;
  if p_tipo = 'ENTREGUE' and e.estado = 'ENVIADO' then
    update envios_email set estado = 'ENTREGUE', entregue_em = app_now() where id = e.id;
  elsif p_tipo = 'ADIADO' and e.estado in ('ENVIADO', 'ENTREGUE') and e.criado_em > app_now() - interval '24 hours' and e.tentativas < 20 then
    update envios_email set estado = 'NA_FILA', enviar_apos = app_now() + interval '2 hours', provedor_id = null, aceito_em = null,
                            motivo = 'Caixa cheia: tentamos de novo'
     where id = e.id;
  elsif p_tipo = 'DEVOLVIDO' and e.estado in ('ENVIADO', 'ENTREGUE') then
    update envios_email set estado = 'DEVOLVIDO', devolvido_em = app_now(), motivo = left(coalesce(p_detalhe, 'Endereço não existe'), 300)
     where id = e.id;
    if ct.id is not null and lower(ct.email) = lower(e.para) and ct.email_situacao in ('PENDENTE', 'CONFIRMADO') then
      update contatos set email_situacao = 'DEVOLVIDO' where id = ct.id;
      perform registrar_historico('contato.email_devolvido', 'contato', ct.id::text, jsonb_build_object('envio', e.id));
    end if;
    perform avisar_email(e, 'DEVOLVIDO');
  elsif p_tipo = 'SPAM' and e.estado in ('ENVIADO', 'ENTREGUE') then
    update envios_email set estado = 'SPAM', motivo = 'Marcado como spam' where id = e.id;
    if ct.id is not null and lower(ct.email) = lower(e.para) and ct.email_situacao in ('PENDENTE', 'CONFIRMADO') then
      update contatos set email_situacao = 'PAROU', email_parou_motivo = 'SPAM' where id = ct.id;
      update envios_email set estado = 'CANCELADO', motivo = 'O contato marcou como spam' where contato_id = ct.id and estado = 'NA_FILA';
      perform registrar_historico('contato.email_parou', 'contato', ct.id::text, jsonb_build_object('motivo', 'SPAM'));
    end if;
    perform avisar_email(e, 'SPAM');
  end if;
  perform entrar_como_sistema(null);
  return true;
end $$;

-- A cada 2 minutos, se houver e-mail esperando, o banco chama a api-plataforma pelo pg_net.
-- O endereço e o segredo de repasse ficam no Vault do Supabase (api_plataforma_url e
-- repasse_segredo), gravados à mão; sem eles, só a própria API esvazia a fila.
create function chamar_fila_email() returns boolean
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_url text;
  v_segredo text;
  v_tem boolean := false;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'api_plataforma_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_segredo using 'repasse_segredo';
  if v_url is null or v_segredo is null then return false; end if;
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios loop
    perform entrar_como_sistema(r.id);
    if exists (select 1 from envios_email where (estado = 'NA_FILA' and enviar_apos <= app_now())
                                             or (estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '15 minutes')) then
      v_tem := true;
      exit;
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  if not v_tem then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using rtrim(v_url, '/') || '/v1/interno/fila-email', '{}'::jsonb,
          jsonb_build_object('content-type', 'application/json', 'x-repasse-segredo', v_segredo);
  return true;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('enviar-emails', '*/2 * * * *', 'select public.chamar_fila_email()');
exception when others then
  raise notice 'pg_cron indisponível: agende chamar_fila_email() de outro jeito (%).', sqlerrm;
end $$;

call fechar_acesso();

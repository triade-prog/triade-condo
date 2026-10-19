-- 0200 · WhatsApp do condomínio (passo 5; W-01, W-05, W-08 a W-16, W-21, AT-28, F6.3). Telas e
-- decisões aprovadas pela Carolina em 18/10/2026 (docs/telas/whatsapp.html). Começa como piloto
-- pelo Wafly (DC14), que não é a API oficial: só no condomínio de teste, com o termo aceito pelo
-- síndico, atrás de um conector trocável. Nada aqui sabe qual provedor está ligado.
--
-- Regras desta parte:
-- 1. Conexão (W-01): um número por condomínio, o da ficha. As credenciais da instância chegam
--    cifradas pela API (o banco nunca vê o token) e só voltam para a própria API. O aviso do
--    provedor chega num endereço com segredo próprio do condomínio (só o hash fica guardado) e
--    só vale se a instância for a dele (W-15). Conectar pede o termo do piloto aceito.
-- 2. Recebimento (W-15, PT-01): o condomínio vem do segredo do endereço, nunca do texto. A
--    mesma mensagem (id do provedor) não entra duas vezes. A ordem usa a hora do WhatsApp.
-- 3. Quem é reconhecido (MU-02): telefone de contato com vínculo confirmado. Pendente ou
--    desconhecido não consulta nada e não abre pedido: recebe resposta neutra e vai para
--    "A identificar", com aviso no sino.
-- 4. Pedido só com a escolha do morador (W-05, W-08): a primeira mensagem traz as opções; com
--    1, o que ele escreveu vira a descrição, com a categoria e a prioridade do WhatsApp e o
--    responsável padrão. O que ele mandar nos minutos seguintes entra no mesmo pedido. A
--    confirmação traz protocolo e o que acontece agora, sem prometer prazo, com o 193 e o
--    aviso contra golpes (W-21).
-- 5. Consulta (W-09, AT-28): só os pedidos do próprio contato, com a situação combinada.
--    Revisão (W-10, AT-15) até 30 dias depois de concluir: avisa quem cuida, nunca reabre.
-- 6. Fila de envio (W-13, W-14, PT-04): gravada junto com a alteração. Só falha passageira
--    repete (até 5 vezes, intervalo crescente); tempo esgotado vira resultado desconhecido e
--    não repete; erro permanente vai para as falhas, com responsável. Reenviar pede motivo.
-- 7. Fora do horário (W-12): uma resposta por período fora do horário de atendimento, sem
--    prazo; o pedido segue normal. PARAR desliga os avisos que o condomínio inicia (W-16).
-- 8. Avisos no WhatsApp de quem atende (W-11, F6.3): pedido novo, retorno vencido e pedido de
--    revisão, para quem ligou, só no horário de funcionamento, sem dado do morador.

-- ---------------------------------------------------------------------------------------
-- Permissões do Console.

insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'console.whatsapp.ver'),
  ('ADMINISTRACAO', 'console.whatsapp.conectar'),
  ('IMPLANTACAO', 'console.whatsapp.ver'),
  ('IMPLANTACAO', 'console.whatsapp.conectar'),
  ('SUPORTE', 'console.whatsapp.ver');

-- ---------------------------------------------------------------------------------------
-- O que muda nas tabelas dos pedidos: o canal WhatsApp, o pedido aberto pelo próprio morador
-- (sem pessoa da gestão como autora) e o retorno dado pelo WhatsApp.

create function trocar_regra(p_tabela regclass, p_padrao text) returns void
language plpgsql
set search_path = public
as $$
declare v text;
begin
  select conname into v from pg_constraint
   where conrelid = p_tabela and contype = 'c' and pg_get_constraintdef(oid) ~ p_padrao;
  if v is null then raise exception 'Regra antiga não encontrada em %: %', p_tabela, p_padrao; end if;
  execute format('alter table %s drop constraint %I', p_tabela, v);
end $$;

select trocar_regra('pedidos', 'canal = ANY');
select trocar_regra('andamentos_pedido', 'meio = ANY');
select trocar_regra('arquivos_pedido', 'tipo = ANY');
select trocar_regra('arquivos_pedido', 'tamanho_declarado >= 1');
select trocar_regra('arquivos_pedido', 'tamanho >= 1');
drop function trocar_regra(regclass, text);

alter table pedidos
  alter column criado_por drop not null,
  add constraint pedidos_canal check (canal in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OBSERVACAO', 'OUTRO', 'WHATSAPP')),
  add constraint pedidos_autor check (criado_por is not null or canal = 'WHATSAPP');

alter table andamentos_pedido
  add constraint andamentos_pedido_meio check (meio in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OUTRO', 'WHATSAPP'));

-- Áudio e vídeo chegam pelo WhatsApp, até 16 MB (W-05). Arquivo que veio do morador não tem
-- pessoa como autora.
alter table arquivos_pedido
  alter column enviado_por drop not null,
  add column pelo_whatsapp boolean not null default false,
  add constraint arquivos_pedido_tipo check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                                      'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4')),
  add constraint arquivos_pedido_tamanho_declarado check (tamanho_declarado between 1 and 16777216),
  add constraint arquivos_pedido_tamanho check (tamanho between 1 and 16777216),
  add constraint arquivos_pedido_autor check ((enviado_por is null) = pelo_whatsapp);

create or replace function arquivos_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.pedido_id, new.conclusao_id, new.parte, new.nome, new.descricao, new.tipo,
      new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por, new.pelo_whatsapp)
     is distinct from
     (old.id, old.condominio_id, old.pedido_id, old.conclusao_id, old.parte, old.nome, old.descricao, old.tipo,
      old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por, old.pelo_whatsapp) then
    raise exception 'O arquivo do pedido não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
                                       is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'O arquivo já foi verificado' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
                                     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'O arquivo já foi tirado do pedido' using errcode = 'TC422';
  end if;
  return new;
end $$;

-- O armazenamento dos pedidos aceita o áudio e o vídeo do WhatsApp, até 16 MB.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set file_size_limit = 16777216,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4']
     where id = 'pedidos';
  end if;
end $$;

-- O morador deixa de receber avisos que o condomínio inicia (W-16). Respostas às mensagens
-- dele continuam.
alter table contatos add column whatsapp_parou_em timestamptz;

-- Configuração do WhatsApp no condomínio.
alter table configuracao_condominio
  add column whatsapp_fora_horario   text not null default
    'Recebemos sua mensagem fora do horário de atendimento. Ela fica registrada e o condomínio confere no próximo horário. Em emergência, ligue 193.'
    check (length(btrim(whatsapp_fora_horario)) between 20 and 600),
  add column whatsapp_categoria      uuid,
  add column whatsapp_prioridade     uuid,
  add column whatsapp_anexar_minutos smallint not null default 30 check (whatsapp_anexar_minutos in (15, 30, 60)),
  add constraint configuracao_whatsapp_categoria foreign key (whatsapp_categoria, condominio_id) references categorias (id, condominio_id),
  add constraint configuracao_whatsapp_prioridade foreign key (whatsapp_prioridade, condominio_id) references prioridades (id, condominio_id);

-- ---------------------------------------------------------------------------------------
-- Conexão do número (W-01).

create table conexoes_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null unique references condominios (id) on delete restrict,
  provedor         text not null default 'WAFLY' check (provedor in ('WAFLY')),
  oficial          boolean not null default false,
  instancia        text check (instancia ~ '^[A-Za-z0-9_-]{1,100}$'),
  -- Cifradas pela API (AES-GCM); o banco nunca vê o token.
  credenciais      bytea check (length(credenciais) between 28 and 4096),
  situacao         text not null default 'SEM_CREDENCIAIS'
                   check (situacao in ('SEM_CREDENCIAIS', 'DESCONECTADO', 'CONECTANDO', 'CONECTADO')),
  aparelho         text check (telefone_valido(aparelho)),
  conectado_em     timestamptz,
  desconectado_em  timestamptz,
  ultima_recebida  timestamptz,
  termo_aceito_em  timestamptz,
  termo_aceito_por uuid references pessoas (id),
  versao           integer not null default 1,
  check ((termo_aceito_em is null) = (termo_aceito_por is null)),
  check ((situacao = 'SEM_CREDENCIAIS') = (credenciais is null)),
  check (situacao <> 'CONECTADO' or (conectado_em is not null and aparelho is not null))
);
call proteger_tabela_condominio('conexoes_whatsapp');
create trigger conexoes_whatsapp_sem_exclusao before delete on conexoes_whatsapp for each row execute function somente_insercao();

-- O endereço do aviso do provedor: o segredo chega antes de se saber o condomínio. Tabela
-- global, com só o hash.
create table ganchos_whatsapp (
  hash          bytea primary key check (length(hash) = 32),
  condominio_id uuid not null references condominios (id) on delete restrict,
  criado_em     timestamptz not null default app_now(),
  revogado_em   timestamptz
);
create index ganchos_whatsapp_condominio on ganchos_whatsapp (condominio_id) where revogado_em is null;
call proteger_tabela_global('ganchos_whatsapp', 'Endereço do aviso do WhatsApp: o segredo chega antes de se saber o condomínio; guarda só o hash');

-- ---------------------------------------------------------------------------------------
-- Mensagens recebidas (W-05, W-15).

create table mensagens_whatsapp (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  provedor_id     text not null check (length(provedor_id) between 1 and 200),
  telefone        text not null check (telefone_valido(telefone)),
  contato_id      uuid,
  pedido_id       uuid,
  tipo            text not null check (tipo in ('TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'DOCUMENTO', 'OUTRO')),
  texto           text check (length(texto) between 1 and 4096),
  enviada_em      timestamptz not null,
  recebida_em     timestamptz not null default app_now(),
  -- Mídia: o endereço do provedor só até baixar; depois, o caminho no armazenamento.
  midia_url       text check (length(midia_url) between 8 and 2000),
  midia_tipo      text check (midia_tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                             'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4')),
  midia_nome      text check (length(btrim(midia_nome)) between 1 and 200),
  midia_situacao  text check (midia_situacao in ('BAIXAR', 'LIBERADA', 'RECUSADA')),
  midia_caminho   text unique,
  midia_tamanho   integer check (midia_tamanho between 1 and 16777216),
  midia_motivo    text check (length(midia_motivo) between 3 and 300),
  arquivo_id      uuid references arquivos_pedido (id),
  -- O que a mensagem pede de alguém: nada (conversa), ser identificada (número sem vínculo
  -- confirmado ou recado), ou já foi tratada.
  triagem         text not null default 'CONVERSA' check (triagem in ('CONVERSA', 'A_IDENTIFICAR', 'RECADO', 'TRATADA', 'ARQUIVADA')),
  triagem_motivo  text check (length(btrim(triagem_motivo)) between 3 and 300),
  tratada_em      timestamptz,
  tratada_por     uuid references pessoas (id),
  unique (id, condominio_id),
  unique (condominio_id, provedor_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  check (texto is not null or midia_tipo is not null or tipo = 'OUTRO'),
  check ((midia_situacao is null) = (midia_tipo is null)),
  check (midia_situacao <> 'LIBERADA' or (midia_caminho is not null and midia_tamanho is not null)),
  check (midia_situacao <> 'RECUSADA' or midia_motivo is not null),
  check ((tratada_em is null) = (triagem in ('CONVERSA', 'A_IDENTIFICAR', 'RECADO'))),
  check (triagem <> 'ARQUIVADA' or triagem_motivo is not null)
);
create index mensagens_whatsapp_telefone on mensagens_whatsapp (condominio_id, telefone, enviada_em desc);
create index mensagens_whatsapp_pedido on mensagens_whatsapp (pedido_id, enviada_em) where pedido_id is not null;
create index mensagens_whatsapp_triagem on mensagens_whatsapp (condominio_id, enviada_em desc) where triagem in ('A_IDENTIFICAR', 'RECADO');
create index mensagens_whatsapp_baixar on mensagens_whatsapp (condominio_id) where midia_situacao = 'BAIXAR';
call proteger_tabela_condominio('mensagens_whatsapp');
create trigger mensagens_whatsapp_sem_exclusao before delete on mensagens_whatsapp for each row execute function somente_insercao();

create function mensagens_whatsapp_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.provedor_id, new.telefone, new.tipo, new.texto, new.enviada_em, new.recebida_em)
     is distinct from (old.condominio_id, old.provedor_id, old.telefone, old.tipo, old.texto, old.enviada_em, old.recebida_em) then
    raise exception 'A mensagem recebida não muda' using errcode = 'TC422';
  end if;
  if old.pedido_id is not null and new.pedido_id is distinct from old.pedido_id then
    raise exception 'A mensagem já é de um pedido' using errcode = 'TC422';
  end if;
  if old.tratada_em is not null and (new.triagem, new.tratada_em, new.tratada_por, new.triagem_motivo)
                                    is distinct from (old.triagem, old.tratada_em, old.tratada_por, old.triagem_motivo) then
    raise exception 'A mensagem já foi tratada' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger mensagens_whatsapp_regras before update on mensagens_whatsapp for each row execute function mensagens_whatsapp_regras();

-- ---------------------------------------------------------------------------------------
-- Fila de envio (W-13, W-14, PT-04).

create table envios_whatsapp (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  para          text not null check (telefone_valido(para)),
  contato_id    uuid,
  pessoa_id     uuid references pessoas (id),
  pedido_id     uuid,
  andamento_id  uuid references andamentos_pedido (id),
  finalidade    text not null check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO')),
  texto         text not null check (length(btrim(texto)) between 1 and 4096),
  estado        text not null default 'NA_FILA'
                check (estado in ('NA_FILA', 'ENVIANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHOU', 'DESCONHECIDO', 'CANCELADA')),
  enviar_apos   timestamptz not null default app_now(),
  tentativas    smallint not null default 0 check (tentativas between 0 and 10),
  provedor_id   text check (length(provedor_id) between 1 and 200),
  aceita_em     timestamptz,
  entregue_em   timestamptz,
  lida_em       timestamptz,
  motivo        text check (length(motivo) between 1 and 300),
  -- Quem cuida da falha (W-14): quem mandou o retorno ou, nas automáticas, o síndico.
  responsavel   uuid references pessoas (id),
  resolvida_em  timestamptz,
  resolvida_por uuid references pessoas (id),
  resolucao     text check (length(btrim(resolucao)) between 3 and 300),
  reenvio_de    uuid references envios_whatsapp (id),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  unique (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  check (finalidade <> 'RETORNO' or (andamento_id is not null and criado_por is not null)),
  check (finalidade <> 'AVISO' or pessoa_id is not null),
  check (estado not in ('ENVIADA', 'ENTREGUE', 'LIDA') or aceita_em is not null),
  check ((resolvida_em is null) = (resolvida_por is null) and (resolvida_em is null) = (resolucao is null)),
  check (resolvida_em is null or estado in ('FALHOU', 'DESCONHECIDO'))
);
create index envios_whatsapp_fila on envios_whatsapp (condominio_id, enviar_apos) where estado = 'NA_FILA';
create index envios_whatsapp_pedido on envios_whatsapp (pedido_id, criado_em) where pedido_id is not null;
create index envios_whatsapp_falhas on envios_whatsapp (condominio_id, criado_em desc) where estado in ('FALHOU', 'DESCONHECIDO') and resolvida_em is null;
create unique index envios_whatsapp_provedor on envios_whatsapp (condominio_id, provedor_id) where provedor_id is not null;
call proteger_tabela_condominio('envios_whatsapp');
create trigger envios_whatsapp_sem_exclusao before delete on envios_whatsapp for each row execute function somente_insercao();

create function envios_whatsapp_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.para, new.contato_id, new.pessoa_id, new.pedido_id, new.andamento_id, new.finalidade, new.texto,
      new.reenvio_de, new.criado_em, new.criado_por)
     is distinct from
     (old.condominio_id, old.para, old.contato_id, old.pessoa_id, old.pedido_id, old.andamento_id, old.finalidade, old.texto,
      old.reenvio_de, old.criado_em, old.criado_por) then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger envios_whatsapp_regras before update on envios_whatsapp for each row execute function envios_whatsapp_regras();

-- ---------------------------------------------------------------------------------------
-- Conversa de cada telefone com o número do condomínio: em que ponto está.

create table conversas_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  telefone         text not null check (telefone_valido(telefone)),
  etapa            text not null default 'INICIO' check (etapa in ('INICIO', 'MENU', 'UNIDADE', 'ANEXANDO', 'CONSULTA')),
  etapa_ate        timestamptz,
  texto_pendente   text check (length(texto_pendente) between 1 and 4000),
  pedido_id        uuid,
  consultado_id    uuid,
  menu_em          timestamptz,
  neutra_em        timestamptz,
  fora_horario_em  timestamptz,
  atualizada_em    timestamptz not null default app_now(),
  unique (condominio_id, telefone),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (consultado_id, condominio_id) references pedidos (id, condominio_id)
);
call proteger_tabela_condominio('conversas_whatsapp');

-- Pedido de revisão do morador (W-10): avisa quem cuida; quem decide é uma pessoa (AT-15).
create table revisoes_whatsapp (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pedido_id     uuid not null,
  contato_id    uuid not null,
  mensagem_id   uuid not null,
  texto         text not null check (length(btrim(texto)) between 1 and 2000),
  criado_em     timestamptz not null default app_now(),
  decidida_em   timestamptz,
  decidida_por  uuid references pessoas (id),
  decisao       text check (decisao in ('REABERTO', 'MANTIDO')),
  resposta      text check (length(btrim(resposta)) between 3 and 2000),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (mensagem_id, condominio_id) references mensagens_whatsapp (id, condominio_id),
  check ((decidida_em is null) = (decisao is null)),
  check (decisao <> 'MANTIDO' or (resposta is not null and decidida_por is not null))
);
create index revisoes_whatsapp_pedido on revisoes_whatsapp (pedido_id) where decidida_em is null;
call proteger_tabela_condominio('revisoes_whatsapp');
create trigger revisoes_whatsapp_sem_exclusao before delete on revisoes_whatsapp for each row execute function somente_insercao();

-- Avisos no WhatsApp de quem atende (W-11, F6.3): cada pessoa liga os seus, para o próprio
-- celular.
create table avisos_whatsapp_pessoa (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  telefone      text not null check (telefone_valido(telefone)),
  tipos         text[] not null default array['PEDIDO_NOVO', 'RETORNO_VENCIDO', 'REVISAO']
                check (tipos <@ array['PEDIDO_NOVO', 'RETORNO_VENCIDO', 'REVISAO']),
  ligado        boolean not null default true,
  versao        integer not null default 1,
  unique (condominio_id, pessoa_id)
);
call proteger_tabela_condominio('avisos_whatsapp_pessoa');

-- Avisos no sino.
create table avisos_whatsapp (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  tipo          text not null check (tipo in ('PEDIDO_NOVO', 'REVISAO', 'A_IDENTIFICAR', 'FALHA_ENVIO', 'DESCONECTADO')),
  pedido_id     uuid,
  mensagem_id   uuid,
  envio_id      uuid,
  -- O que evita repetir: o pedido, a revisão, o telefone do dia, o envio ou a desconexão.
  referencia    text not null check (length(referencia) between 1 and 100),
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (mensagem_id, condominio_id) references mensagens_whatsapp (id, condominio_id),
  foreign key (envio_id, condominio_id) references envios_whatsapp (id, condominio_id),
  unique (pessoa_id, tipo, referencia)
);
create index avisos_whatsapp_pessoa_criado on avisos_whatsapp (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_whatsapp');
create trigger avisos_whatsapp_sem_exclusao before delete on avisos_whatsapp for each row execute function somente_insercao();
create function avisos_whatsapp_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.tipo, new.pedido_id, new.mensagem_id, new.envio_id, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.tipo, old.pedido_id, old.mensagem_id, old.envio_id, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_whatsapp_regras before update on avisos_whatsapp for each row execute function avisos_whatsapp_regras();

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- Telefone do provedor ("5561998124400", "5561998124400@c.us") no formato do cadastro.
create function telefone_whatsapp(p text) returns text
language sql immutable
set search_path = public
as $$
  select case when d ~ '^[1-9][0-9]{9,14}$' then '+' || d end
    from (select regexp_replace(split_part(coalesce(p, ''), '@', 1), '[^0-9]', '', 'g') as d) x
$$;

-- Celular brasileiro chega com ou sem o 9 da frente, conforme a conta: as duas formas valem.
create function variantes_telefone(p text) returns text[]
language sql immutable
set search_path = public
as $$
  select case
    when p ~ '^\+55[1-9][0-9][6-9][0-9]{7}$' then array[p, substr(p, 1, 5) || '9' || substr(p, 6)]
    when p ~ '^\+55[1-9][0-9]9[6-9][0-9]{7}$' then array[p, substr(p, 1, 5) || substr(p, 7)]
    else array[p] end
$$;

-- Contatos ativos (vínculo confirmado, dados guardados) com este telefone, o principal antes.
create function contatos_do_telefone(p_telefone text) returns uuid[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(ct.id order by ct.criado_em), '{}') from contatos ct
   where ct.telefone = any (variantes_telefone(p_telefone)) and contato_ativo(ct.id)
$$;

-- Unidades confirmadas desses contatos, em ordem estável (a escolha por número usa a ordem).
create function unidades_dos_contatos(p_contatos uuid[]) returns table (unidade_id uuid, contato_id uuid, rotulo text)
language sql stable
set search_path = public
as $$
  select distinct on (cu.unidade_id) cu.unidade_id, cu.contato_id, rotulo_unidade(cu.unidade_id)
    from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa
   where cu.contato_id = any (p_contatos) and cu.estado = 'CONFIRMADO'
   order by cu.unidade_id, cu.principal desc
$$;

-- Dentro do horário (funcionamento ou atendimento) do condomínio do contexto. Sem horário
-- definido, sempre; feriado, nunca.
create function dentro_do_horario(p_tipo text, p_quando timestamptz) returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text;
  v_intervalos jsonb;
  v_local timestamp;
begin
  select c.fuso, h.intervalos into v_fuso, v_intervalos
    from configuracao_condominio c join horarios h on h.condominio_id = c.condominio_id and h.tipo = p_tipo;
  if v_fuso is null or jsonb_array_length(v_intervalos) = 0 then return true; end if;
  v_local := p_quando at time zone v_fuso;
  if exists (select 1 from feriados where data = v_local::date) then return false; end if;
  return exists (select 1 from jsonb_array_elements(v_intervalos) x
                  where (x ->> 'dia')::int = extract(dow from v_local)::int
                    and v_local::time >= (x ->> 'inicio')::time
                    and (x ->> 'fim' = '24:00' or v_local::time < (x ->> 'fim')::time));
end $$;

-- O próximo momento dentro do horário: agora, se já está dentro.
create function proximo_horario(p_tipo text, p_quando timestamptz) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text;
  v_intervalos jsonb;
  v_local timestamp;
  v_dia date;
  i record;
begin
  if dentro_do_horario(p_tipo, p_quando) then return p_quando; end if;
  select c.fuso, h.intervalos into v_fuso, v_intervalos
    from configuracao_condominio c join horarios h on h.condominio_id = c.condominio_id and h.tipo = p_tipo;
  v_local := p_quando at time zone v_fuso;
  for d in 0..30 loop
    v_dia := v_local::date + d;
    continue when exists (select 1 from feriados where data = v_dia);
    for i in select (x ->> 'inicio')::time as inicio from jsonb_array_elements(v_intervalos) x
              where (x ->> 'dia')::int = extract(dow from v_dia)::int order by 1 loop
      if v_dia + i.inicio > v_local then return (v_dia + i.inicio) at time zone v_fuso; end if;
    end loop;
  end loop;
  return p_quando;
end $$;

-- Dia e mês no fuso do condomínio ("21/10").
create function dia_mes(p timestamptz) returns text
language sql stable
set search_path = public
as $$ select to_char(p at time zone (select fuso from configuracao_condominio), 'DD/MM') $$;

-- Quem cuida dos pedidos: o síndico e quem registra e atualiza pedidos.
create function quem_cuida_dos_pedidos() returns uuid[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct v.pessoa_id), '{}') from vinculos v
   where v.condominio_id = contexto_condominio() and v.revogado_em is null and v.funcao in ('SINDICO', 'AUTORIZADO')
     and (v.funcao = 'SINDICO' or pode(v.pessoa_id, v.condominio_id, 'pedidos.atualizar'))
$$;

-- Quem é avisado sobre um pedido: o responsável ou, sem responsável, quem cuida dos pedidos.
create function quem_avisar_do_pedido(p pedidos) returns uuid[]
language sql stable
set search_path = public
as $$
  select case when pessoa_do_vinculo(p.responsavel_id) is not null then array[pessoa_do_vinculo(p.responsavel_id)]
              else quem_cuida_dos_pedidos() end
$$;

-- Põe uma mensagem na fila (PT-04): gravada na mesma transação da alteração.
create function enfileirar_whatsapp(p_para text, p_contato uuid, p_pessoa uuid, p_pedido uuid, p_andamento uuid, p_finalidade text,
                                    p_texto text, p_responsavel uuid, p_criado_por uuid, p_quando timestamptz default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  insert into envios_whatsapp (condominio_id, para, contato_id, pessoa_id, pedido_id, andamento_id, finalidade, texto,
                               responsavel, criado_por, enviar_apos)
  values (contexto_condominio(), p_para, p_contato, p_pessoa, p_pedido, p_andamento, p_finalidade, left(p_texto, 4096),
          coalesce(p_responsavel, p_criado_por, (quem_cuida_dos_pedidos())[1]), p_criado_por, coalesce(p_quando, app_now()))
  returning id into v_id;
  return v_id;
end $$;

-- Resposta ao telefone de quem escreveu.
create function responder_whatsapp(p_telefone text, p_contato uuid, p_pedido uuid, p_texto text) returns uuid
language sql
set search_path = public
as $$ select enfileirar_whatsapp(p_telefone, p_contato, null, p_pedido, null, 'RESPOSTA', p_texto, null, null) $$;

-- O texto do aviso no WhatsApp de quem atende: protocolo, assunto e unidade, sem dado do
-- morador (W-11). O link do painel a API acrescenta.
create function texto_aviso_whatsapp(p_tipo text, p pedidos) returns text
language sql stable
set search_path = public
as $$
  select (select nome from condominios where id = p.condominio_id) || ' · '
      || case p_tipo when 'PEDIDO_NOVO' then 'pedido novo' when 'RETORNO_VENCIDO' then 'retorno vencido' else 'pedido de revisão' end
      || E'\n' || p.protocolo || ' · ' || case when p.privado then 'pedido privado' else p.assunto end
      || coalesce(' (' || coalesce(rotulo_unidade(p.unidade_id), p.local) || ')', '')
      || case when p_tipo = 'RETORNO_VENCIDO' and p.responsavel_id is not null then ' · responsável ' || nome_do_vinculo(p.responsavel_id) else '' end
$$;

-- Aviso no WhatsApp da pessoa que ligou aquele tipo, só no horário de funcionamento (F6.3).
create function avisar_no_whatsapp(p_pessoa uuid, p_tipo text, p_pedido uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  a avisos_whatsapp_pessoa;
  p pedidos;
begin
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa and ligado and p_tipo = any (tipos);
  if a.id is null then return; end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then return; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or not pedido_visivel(p_pessoa, p) then return; end if;
  perform enfileirar_whatsapp(a.telefone, null, p_pessoa, p.id, null, 'AVISO', texto_aviso_whatsapp(p_tipo, p), p_pessoa, null,
                              proximo_horario('FUNCIONAMENTO', app_now()));
end $$;

-- Aviso no sino, uma vez por pessoa, tipo e referência; os de pedido também vão ao WhatsApp
-- de quem ligou.
create function avisar_whatsapp(p_pessoas uuid[], p_tipo text, p_pedido uuid, p_mensagem uuid, p_envio uuid, p_referencia text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_n integer := 0;
  v_pessoa uuid;
begin
  for v_pessoa in
    insert into avisos_whatsapp (condominio_id, pessoa_id, tipo, pedido_id, mensagem_id, envio_id, referencia)
    select contexto_condominio(), x, p_tipo, p_pedido, p_mensagem, p_envio, p_referencia from unnest(p_pessoas) x where x is not null
    on conflict (pessoa_id, tipo, referencia) do nothing
    returning pessoa_id
  loop
    v_n := v_n + 1;
    if p_tipo in ('PEDIDO_NOVO', 'REVISAO') then perform avisar_no_whatsapp(v_pessoa, p_tipo, p_pedido); end if;
  end loop;
  return v_n;
end $$;

-- Retorno vencido e escalonamento (passo 6) também vão ao WhatsApp de quem ligou.
create function avisos_no_whatsapp() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo in ('RETORNO_VENCIDO', 'ESCALADO_SINDICO', 'ESCALADO_SUBSTITUTO') then
    perform avisar_no_whatsapp(new.pessoa_id, 'RETORNO_VENCIDO', new.pedido_id);
  end if;
  return new;
end $$;
create trigger avisos_no_whatsapp after insert on avisos for each row execute function avisos_no_whatsapp();

-- Pedido que reabre resolve o pedido de revisão do morador (AT-15).
create function revisoes_reabertas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'ENCERRADO' and new.estado in ('ABERTO', 'EM_ANDAMENTO') then
    update revisoes_whatsapp set decidida_em = app_now(), decidida_por = contexto_pessoa(), decisao = 'REABERTO'
     where pedido_id = new.id and decidida_em is null;
  end if;
  return new;
end $$;
create trigger revisoes_reabertas after update of estado on pedidos for each row execute function revisoes_reabertas();

-- ---------------------------------------------------------------------------------------
-- Textos das respostas automáticas (W-08, W-12, W-21).

create function aviso_golpe_whatsapp() returns text
language sql immutable
set search_path = public
as $$ select 'O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem.' $$;

create function nome_curto(p text) returns text
language sql immutable
set search_path = public
as $$ select split_part(btrim(coalesce(p, '')), ' ', 1) $$;

-- O que o morador vê de cada pedido (AT-28): a situação combinada, sem etapa nem nota interna.
create function situacao_para_morador(p pedidos) returns text
language sql stable
set search_path = public
as $$
  select case
    when p.estado = 'CANCELADO' then 'Cancelado'
    when p.estado = 'ENCERRADO' then 'Concluído em ' || dia_mes(p.encerrado_em)
    when exists (select 1 from pendencias_pedido pp where pp.pedido_id = p.id and pp.resolvida_em is null) then 'Aguardando'
    when p.responsavel_id is null and p.estado = 'ABERTO'
         and not exists (select 1 from andamentos_pedido a where a.pedido_id = p.id and a.tipo = 'RETORNO') then 'Recebido'
    else 'Em andamento' end
    || case when p.estado in ('ABERTO', 'EM_ANDAMENTO') and p.proximo_retorno is not null
            then ' · próxima notícia até ' || dia_mes(p.proximo_retorno) else '' end
$$;

-- Pedidos que o morador vê: os dele, ativos ou concluídos nos últimos 30 dias.
create function pedidos_do_morador(p_contatos uuid[]) returns setof pedidos
language sql stable
set search_path = public
as $$
  select * from pedidos p
   where p.contato_id = any (p_contatos)
     and (p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')
          or coalesce(p.encerrado_em, p.cancelado_em) >= app_now() - interval '30 days')
   order by p.criado_em desc
$$;

create function menu_whatsapp(p_nome text) returns text
language sql immutable
set search_path = public
as $$
  select 'Olá, ' || nome_curto(p_nome) || E'. Recebemos sua mensagem.\nResponda com o número:\n'
      || E'1 · Registrar como pedido novo\n2 · Ver meus pedidos\n3 · Era só um recado'
$$;

-- ---------------------------------------------------------------------------------------
-- O pedido que o morador abre (W-05, W-08).

create function categoria_whatsapp() returns uuid
language sql stable
set search_path = public
as $$
  select coalesce(
    (select c.id from configuracao_condominio cfg join categorias c on c.id = cfg.whatsapp_categoria and c.ativa),
    (select id from categorias where ativa order by lower(nome) limit 1))
$$;

create function prioridade_whatsapp() returns uuid
language sql stable
set search_path = public
as $$
  select coalesce(
    (select p.id from configuracao_condominio cfg join prioridades p on p.id = cfg.whatsapp_prioridade and p.ativa),
    (select id from prioridades where ativa order by nivel limit 1))
$$;

-- Liga a mídia já conferida ao pedido, como arquivo do relato.
create function anexar_midia_whatsapp(p_mensagem uuid) returns boolean
language plpgsql
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  v_arquivo uuid;
begin
  select * into m from mensagens_whatsapp where id = p_mensagem;
  if m.pedido_id is null or m.midia_situacao is distinct from 'LIBERADA' or m.arquivo_id is not null then return false; end if;
  if (select count(*) from arquivos_pedido where pedido_id = m.pedido_id and retirado_em is null) >= 30 then return false; end if;
  insert into arquivos_pedido (condominio_id, pedido_id, parte, nome, tipo, tamanho_declarado, tamanho, caminho, situacao,
                               verificado_em, enviado_em, enviado_por, pelo_whatsapp)
  values (m.condominio_id, m.pedido_id, 'RELATO',
          coalesce(m.midia_nome, case m.tipo when 'IMAGEM' then 'foto' when 'AUDIO' then 'audio' when 'VIDEO' then 'video' else 'documento' end
                                 || '-' || to_char(m.enviada_em at time zone 'UTC', 'YYYYMMDD-HH24MISS')),
          m.midia_tipo, m.midia_tamanho, m.midia_tamanho, m.midia_caminho, 'LIBERADO', app_now(), m.enviada_em, null, true)
  returning id into v_arquivo;
  update mensagens_whatsapp set arquivo_id = v_arquivo where id = m.id;
  return true;
end $$;

create function criar_pedido_whatsapp(p_conversa conversas_whatsapp, p_contato uuid, p_unidade uuid, p_texto text) returns pedidos
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_assunto text;
  v_resp uuid;
  v_ano integer;
  v_numero integer;
  v_protocolo text;
  v pedidos;
  m record;
  v_categoria uuid := categoria_whatsapp();
  v_prioridade uuid := prioridade_whatsapp();
begin
  select * into cfg from configuracao_condominio;
  v_assunto := left(btrim(split_part(coalesce(v_texto, ''), E'\n', 1)), 120);
  if length(v_assunto) < 3 then v_assunto := 'Pedido pelo WhatsApp'; end if;
  v_resp := cfg.responsavel_padrao;
  if not responsavel_disponivel(v_resp) then v_resp := null; end if;
  v_ano := extract(year from hoje_no_condominio())::integer;
  insert into protocolos_pedido as x (condominio_id, ano, ultimo) values (contexto_condominio(), v_ano, 1)
  on conflict (condominio_id, ano) do update set ultimo = x.ultimo + 1
  returning ultimo into v_numero;
  v_protocolo := v_ano || '-' || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;
  perform definir_transicao('REGISTRADO', null, true);
  insert into pedidos (condominio_id, protocolo, unidade_id, contato_id, categoria_id, prioridade_id, etapa_id, assunto, descricao,
                       canal, privado, estado, responsavel_id, responsavel_desde, proximo_retorno, criado_por)
  values (contexto_condominio(), v_protocolo, p_unidade, p_contato, v_categoria, v_prioridade,
          coalesce(etapa_inicial(v_categoria, 'ABERTO'), etapa_inicial(null, 'ABERTO')), v_assunto,
          case when length(v_texto) >= 3 then left(v_texto, 4000) else 'Pedido pelo WhatsApp: veja as mensagens e os arquivos.' end,
          'WHATSAPP', false, 'ABERTO', v_resp, case when v_resp is not null then app_now() end,
          calcular_proximo_retorno(v_categoria, v_prioridade), null)
  returning * into v;
  perform registrar_historico('pedido.registrado', 'pedidos', v.id::text, jsonb_strip_nulls(jsonb_build_object(
    'protocolo', v_protocolo, 'canal', 'WHATSAPP', 'responsavel', v_resp)));
  -- As mensagens desde as opções entram no pedido, com as mídias já conferidas.
  for m in update mensagens_whatsapp set pedido_id = v.id
            where telefone = p_conversa.telefone and pedido_id is null and triagem = 'CONVERSA'
              and recebida_em >= coalesce(p_conversa.menu_em, app_now()) - interval '1 minute'
           returning id
  loop
    perform anexar_midia_whatsapp(m.id);
  end loop;
  update conversas_whatsapp set etapa = 'ANEXANDO', etapa_ate = app_now() + make_interval(mins => cfg.whatsapp_anexar_minutos),
                                pedido_id = v.id, texto_pendente = null, atualizada_em = app_now()
   where id = p_conversa.id;
  perform avisar_whatsapp(quem_avisar_do_pedido(v), 'PEDIDO_NOVO', v.id, null, null, v.id::text);
  perform responder_whatsapp(p_conversa.telefone, p_contato, v.id,
    'Pedido ' || v_protocolo || ' registrado (' || rotulo_unidade(p_unidade) || E').\n\n'
    || 'O que você mandar nos próximos ' || cfg.whatsapp_anexar_minutos || ' minutos, como foto, áudio ou documento, entra neste pedido.'
    || E'\n\nO que acontece agora: o condomínio confere os pedidos no horário de atendimento e dá notícia por aqui. Em emergência, ligue 193.'
    || E'\n\n' || aviso_golpe_whatsapp());
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- A conversa (W-05, W-08 a W-10, W-12, W-16, MU-02).

-- Pedido de revisão (W-10): REVISAR e o que continua acontecendo, até 30 dias depois de
-- concluir. Vale o pedido consultado por último ou o concluído mais recente do morador.
create function revisar_pelo_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[], p_texto text) returns void
language plpgsql
set search_path = public
as $$
declare
  p pedidos;
  v_motivo text := nullif(btrim(p_texto), '');
  v_id uuid;
begin
  select * into p from pedidos_do_morador(p_contatos) x
   where x.estado = 'ENCERRADO' and x.encerrado_em >= app_now() - interval '30 days'
   order by x.id = c.consultado_id desc, x.encerrado_em desc limit 1;
  if p.id is null then
    perform responder_whatsapp(m.telefone, m.contato_id, null,
      'Não há pedido seu concluído nos últimos 30 dias para revisar. Para registrar um novo, conte o que aconteceu.');
    return;
  end if;
  if v_motivo is null then
    perform responder_whatsapp(m.telefone, m.contato_id, p.id,
      'Conte o que continua acontecendo no pedido ' || p.protocolo || ': mande REVISAR e o motivo, numa mensagem só.');
    return;
  end if;
  update mensagens_whatsapp set pedido_id = p.id where id = m.id;
  if exists (select 1 from revisoes_whatsapp where pedido_id = p.id and decidida_em is null) then
    perform responder_whatsapp(m.telefone, m.contato_id, p.id,
      'O pedido ' || p.protocolo || ' já está com um pedido de revisão. Quem cuida dele vai dar notícia por aqui.');
    return;
  end if;
  insert into revisoes_whatsapp (condominio_id, pedido_id, contato_id, mensagem_id, texto)
  values (m.condominio_id, p.id, p.contato_id, m.id, left(v_motivo, 2000)) returning id into v_id;
  perform registrar_historico('pedido.revisao_pedida', 'pedidos', p.id::text, jsonb_build_object('revisao', v_id, 'canal', 'WHATSAPP'));
  perform avisar_whatsapp(quem_avisar_do_pedido(p), 'REVISAO', p.id, m.id, null, v_id::text);
  perform responder_whatsapp(m.telefone, m.contato_id, p.id,
    'Recebido. Quem cuida do pedido ' || p.protocolo || ' vai avaliar e dar notícia por aqui. '
    || 'O pedido não reabre sozinho: uma pessoa do condomínio decide.');
end $$;

-- Lista dos pedidos do morador (W-09).
create function lista_pedidos_whatsapp(p_contatos uuid[]) returns text
language sql stable
set search_path = public
as $$
  select case when count(*) = 0
    then 'Você não tem pedidos abertos nem concluídos nos últimos 30 dias. Para registrar um, conte o que aconteceu.'
    else E'Seus pedidos:\n\n' || string_agg(x.protocolo || ' · ' || x.assunto || E'\n' || situacao_para_morador(x), E'\n\n' order by x.criado_em desc)
         || E'\n\nPara ver um, mande o número (ex.: ' || split_part(max(x.protocolo), '-', 2) || ').' end
    from (select * from pedidos_do_morador(p_contatos) limit 5) x
$$;

-- Um pedido do morador, pelo número (W-09, AT-28).
create function detalhe_pedido_whatsapp(p pedidos) returns text
language sql stable
set search_path = public
as $$
  select p.protocolo || ' · ' || p.assunto || E'\n' || situacao_para_morador(p) || '.'
      || case when p.estado = 'ENCERRADO' then
           coalesce(E'\nO que foi feito: ' || (select c.explicacao from conclusoes_pedido c where c.pedido_id = p.id
                                                 order by c.concluida_em desc limit 1), '')
           || case when p.encerrado_em >= app_now() - interval '30 days'
                   then E'\n\nSe não resolveu, responda REVISAR e conte o que continua acontecendo. Vale até '
                        || dia_mes(p.encerrado_em + interval '30 days') || '.' else '' end
         when p.estado = 'CANCELADO' then coalesce(E'\nMotivo: ' || p.motivo_cancelamento, '')
         else '' end
$$;

create function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  c conversas_whatsapp;
  cfg configuracao_condominio;
  v_contatos uuid[];
  v_contato contatos;
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
  v_texto text := nullif(btrim(coalesce(m.texto, '')), '');
  v_unidades record;
  v_n integer;
  v_escolha integer;
  v_unidade uuid;
  v_contato_unidade uuid;
  p pedidos;
begin
  select * into cfg from configuracao_condominio;
  insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone)
  on conflict (condominio_id, telefone) do update set atualizada_em = app_now()
  returning * into c;
  v_contatos := contatos_do_telefone(m.telefone);

  -- Número sem vínculo confirmado (MU-02): nada é consultado nem registrado.
  if cardinality(v_contatos) = 0 then
    update mensagens_whatsapp set triagem = 'A_IDENTIFICAR' where id = m.id;
    if c.neutra_em is null or c.neutra_em < app_now() - interval '24 hours' then
      perform responder_whatsapp(m.telefone, null, null,
        'Olá! Recebemos sua mensagem. Este número ainda não está no cadastro do condomínio, e o condomínio vai conferir. '
        || E'Por segurança, não mande documentos nem dados pessoais por aqui.\n\n' || aviso_golpe_whatsapp());
      update conversas_whatsapp set neutra_em = app_now() where id = c.id;
    end if;
    perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'A_IDENTIFICAR', null, m.id, null,
                            encode(extensions.digest(m.telefone, 'sha256'), 'hex') || ':' || hoje_no_condominio());
    return;
  end if;
  select * into v_contato from contatos where id = v_contatos[1];
  update mensagens_whatsapp set contato_id = v_contato.id where id = m.id;
  m.contato_id := v_contato.id;

  -- Parar e voltar a receber avisos (W-16).
  if v_cmd in ('PARAR', 'VOLTAR') then
    update contatos set whatsapp_parou_em = case when v_cmd = 'PARAR' then app_now() end
     where id = any (v_contatos) and (whatsapp_parou_em is null) = (v_cmd = 'PARAR');
    perform registrar_historico(case when v_cmd = 'PARAR' then 'contato.whatsapp_parou' else 'contato.whatsapp_voltou' end,
                                'contato', v_contato.id::text, '{}'::jsonb);
    perform responder_whatsapp(m.telefone, v_contato.id, null, case when v_cmd = 'PARAR'
      then 'Pronto: você não recebe mais avisos do condomínio por aqui. Suas mensagens e as respostas aos seus pedidos continuam. Para voltar, mande VOLTAR.'
      else 'Pronto: você volta a receber os avisos do condomínio por aqui.' end);
    return;
  end if;
  if v_cmd ~ '^REVISAR\M' then
    perform revisar_pelo_whatsapp(m, c, v_contatos, substr(btrim(m.texto), 8));
    return;
  end if;

  if c.etapa <> 'INICIO' and (c.etapa_ate is null or c.etapa_ate < app_now()) then
    update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, texto_pendente = null where id = c.id returning * into c;
  end if;

  -- Ver os pedidos (W-09).
  if v_cmd = '2' and c.etapa <> 'UNIDADE' then
    update conversas_whatsapp set etapa = 'CONSULTA', etapa_ate = app_now() + interval '30 minutes', texto_pendente = null where id = c.id;
    perform responder_whatsapp(m.telefone, v_contato.id, null, lista_pedidos_whatsapp(v_contatos));
    return;
  end if;
  if v_cmd ~ '^([0-9]{4}-)?[0-9]{4,6}$' then
    select * into p from pedidos_do_morador(v_contatos) x
     where x.protocolo = v_cmd or split_part(x.protocolo, '-', 2) = v_cmd order by x.criado_em desc limit 1;
  end if;
  if v_cmd ~ '^([0-9]{4}-)?[0-9]{4,6}$' and (c.etapa = 'CONSULTA' or v_cmd ~ '-' or p.id is not null) then
    if p.id is null then
      perform responder_whatsapp(m.telefone, v_contato.id, null,
        'Não achei esse pedido entre os seus. Mande 2 para ver a lista.');
    else
      update conversas_whatsapp set consultado_id = p.id, etapa = 'CONSULTA', etapa_ate = app_now() + interval '30 minutes' where id = c.id;
      perform responder_whatsapp(m.telefone, v_contato.id, p.id, detalhe_pedido_whatsapp(p));
    end if;
    return;
  end if;

  if c.etapa = 'ANEXANDO' then
    update mensagens_whatsapp set pedido_id = c.pedido_id where id = m.id;
    perform anexar_midia_whatsapp(m.id);
    return;
  end if;

  if c.etapa = 'UNIDADE' then
    select count(*) into v_n from unidades_dos_contatos(v_contatos);
    v_escolha := case when v_cmd ~ '^[0-9]{1,2}$' then v_cmd::integer end;
    if v_escolha between 1 and v_n then
      select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos)
       order by rotulo, unidade_id offset v_escolha - 1 limit 1;
      perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, c.texto_pendente);
    else
      perform responder_whatsapp(m.telefone, v_contato.id, null, 'Responda só com o número da unidade da lista.');
    end if;
    return;
  end if;

  if c.etapa = 'MENU' then
    if v_cmd = '1' then
      select count(*) into v_n from unidades_dos_contatos(v_contatos);
      if v_n > 1 then
        update conversas_whatsapp set etapa = 'UNIDADE', etapa_ate = app_now() + interval '30 minutes' where id = c.id;
        perform responder_whatsapp(m.telefone, v_contato.id, null,
          E'Você está ligado a mais de uma unidade. O pedido é de qual?\n'
          || (select string_agg(row_number || ' · ' || rotulo, E'\n' order by row_number)
                from (select rotulo, row_number() over (order by rotulo, unidade_id) from unidades_dos_contatos(v_contatos)) x));
      elsif c.texto_pendente is null and not exists (
              select 1 from mensagens_whatsapp x where x.telefone = m.telefone and x.pedido_id is null and x.triagem = 'CONVERSA'
                                                   and x.midia_tipo is not null and x.recebida_em >= c.menu_em - interval '1 minute') then
        update conversas_whatsapp set etapa_ate = app_now() + interval '30 minutes' where id = c.id;
        perform responder_whatsapp(m.telefone, v_contato.id, null, 'Conte o que aconteceu, numa mensagem só. Se tiver foto, pode mandar junto.');
      else
        select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos) limit 1;
        perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, c.texto_pendente);
      end if;
      return;
    elsif v_cmd = '3' then
      update mensagens_whatsapp set triagem = 'RECADO'
       where telefone = m.telefone and pedido_id is null and triagem = 'CONVERSA' and id <> m.id
         and recebida_em >= c.menu_em - interval '1 minute';
      update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, texto_pendente = null where id = c.id;
      perform responder_whatsapp(m.telefone, v_contato.id, null, 'Recado recebido. Quem cuida do condomínio vai ler.');
      return;
    end if;
    -- Texto depois de escolher 1 sem descrever: vira o pedido. Senão, junta à descrição.
    if v_texto is not null and c.texto_pendente is null and exists (
         select 1 from mensagens_whatsapp x where x.telefone = m.telefone and x.texto = '1' and x.recebida_em > c.menu_em) then
      select count(*) into v_n from unidades_dos_contatos(v_contatos);
      if v_n = 1 then
        select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos);
        perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, v_texto);
        return;
      end if;
    end if;
    if v_texto is not null then
      update conversas_whatsapp set texto_pendente = left(concat_ws(E'\n', texto_pendente, v_texto), 4000),
                                    etapa_ate = app_now() + interval '60 minutes'
       where id = c.id;
    end if;
    return;
  end if;

  -- Começo de conversa: o que ele escreveu fica guardado e vão as opções.
  update conversas_whatsapp set etapa = 'MENU', etapa_ate = app_now() + interval '60 minutes', texto_pendente = left(v_texto, 4000),
                                menu_em = app_now(), pedido_id = null
   where id = c.id;
  perform responder_whatsapp(m.telefone, v_contato.id, null, menu_whatsapp(v_contato.nome));

  -- Fora do horário de atendimento (W-12): uma vez por período, sem prazo.
  if not dentro_do_horario('ATENDIMENTO', app_now()) and (c.fora_horario_em is null or c.fora_horario_em < app_now() - interval '12 hours') then
    perform responder_whatsapp(m.telefone, v_contato.id, null, cfg.whatsapp_fora_horario);
    update conversas_whatsapp set fora_horario_em = app_now() where id = c.id;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Entradas da API (sem pessoa; só a API, com o segredo de repasse, chega aqui).

-- O condomínio do endereço do aviso. Segredo desconhecido ou revogado responde igual.
create function entrar_por_gancho(p_segredo text, p_instancia text) returns conexoes_whatsapp
language plpgsql
set search_path = public
as $$
declare
  v_condominio uuid;
  cx conexoes_whatsapp;
begin
  perform limpar_contexto();
  if p_segredo is null or p_segredo !~ '^[A-Za-z0-9_-]{32,64}$' then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
  select condominio_id into v_condominio from ganchos_whatsapp where hash = hash_codigo(p_segredo) and revogado_em is null;
  if v_condominio is null then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
  perform entrar_como_sistema(v_condominio);
  select * into cx from conexoes_whatsapp;
  -- A instância, quando o provedor manda, tem de ser a do condomínio.
  if cx.id is null or (p_instancia is not null and cx.instancia is distinct from p_instancia) then
    raise exception 'Aviso recusado' using errcode = 'TC403';
  end if;
  return cx;
end $$;

-- Mensagem recebida (W-05, W-15, PT-01). p_msg: id, telefone, enviadaEm, tipo, texto e, se
-- houver, midia {url, tipo, nome}. Devolve as mídias a baixar.
create function whatsapp_receber(p_segredo text, p_instancia text, p_msg jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  m mensagens_whatsapp;
  v_tel text := telefone_whatsapp(p_msg ->> 'telefone');
  v_tipo text := p_msg ->> 'tipo';
  v_midia jsonb := p_msg -> 'midia';
  v_enviada timestamptz;
begin
  cx := entrar_por_gancho(p_segredo, p_instancia);
  if v_tel is null or coalesce(length(p_msg ->> 'id'), 0) not between 1 and 200
     or v_tipo is null or v_tipo not in ('TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'DOCUMENTO', 'OUTRO') then
    raise exception 'Mensagem inválida' using errcode = 'TC422';
  end if;
  -- Tipo que não dá para guardar (figurinha, localização, contato) sem texto vira OUTRO.
  if v_tipo <> 'TEXTO' and nullif(p_msg ->> 'texto', '') is null
     and coalesce(v_midia ->> 'tipo', '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                                  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4') then
    v_tipo := 'OUTRO';
  end if;
  if v_tipo = 'TEXTO' and nullif(p_msg ->> 'texto', '') is null then v_tipo := 'OUTRO'; end if;
  begin
    v_enviada := least(coalesce((p_msg ->> 'enviadaEm')::timestamptz, app_now()), app_now());
  exception when others then v_enviada := app_now();
  end;
  insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, tipo, texto, enviada_em,
                                  midia_url, midia_tipo, midia_nome, midia_situacao)
  values (cx.condominio_id, p_msg ->> 'id', v_tel, v_tipo, left(nullif(p_msg ->> 'texto', ''), 4096), v_enviada,
          v_midia ->> 'url',
          case when v_midia ->> 'tipo' in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                           'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4') then v_midia ->> 'tipo' end,
          left(nullif(btrim(v_midia ->> 'nome'), ''), 200),
          case when v_midia ->> 'tipo' in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                           'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4')
                    and v_midia ->> 'url' is not null then 'BAIXAR' end)
  on conflict (condominio_id, provedor_id) do nothing
  returning * into m;
  if m.id is null then
    perform entrar_como_sistema(null);
    return jsonb_build_object('repetida', true, 'midias', '[]'::jsonb);
  end if;
  update conexoes_whatsapp set ultima_recebida = app_now() where id = cx.id;
  perform processar_mensagem_whatsapp(m);
  perform entrar_como_sistema(null);
  return jsonb_build_object('repetida', false, 'mensagem', m.id, 'condominio', m.condominio_id,
    'midias', case when m.midia_situacao = 'BAIXAR' then jsonb_build_array(jsonb_build_object(
                'condominio', m.condominio_id, 'mensagem', m.id, 'url', m.midia_url, 'tipo', m.midia_tipo,
                'caminho', 'whatsapp/' || m.condominio_id || '/' || m.id)) else '[]'::jsonb end);
end $$;

-- Mídias que ainda não foram baixadas (a API tenta de novo quando a fila roda).
create function whatsapp_midias_pendentes() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v jsonb := '[]'::jsonb;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios loop
    perform entrar_como_sistema(r.id);
    v := v || coalesce((select jsonb_agg(jsonb_build_object('condominio', m.condominio_id, 'mensagem', m.id, 'url', m.midia_url,
                                                            'tipo', m.midia_tipo, 'caminho', 'whatsapp/' || m.condominio_id || '/' || m.id))
                          from (select * from mensagens_whatsapp where midia_situacao = 'BAIXAR' order by recebida_em limit 20) m), '[]'::jsonb);
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v;
end $$;

-- Resultado da mídia baixada e conferida (W-05): liberada entra no pedido; recusada avisa o
-- morador do motivo. Endereço que expirou desiste depois de um dia.
create function whatsapp_midia_resultado(p_condominio uuid, p_mensagem uuid, p_tamanho integer, p_motivo text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  v_protocolo text;
  v_palavra text;
begin
  perform entrar_como_sistema(p_condominio);
  select * into m from mensagens_whatsapp where id = p_mensagem for update;
  if m.id is null or m.midia_situacao is distinct from 'BAIXAR' then perform entrar_como_sistema(null); return; end if;
  v_palavra := case m.tipo when 'IMAGEM' then 'Foto anexada' when 'AUDIO' then 'Áudio anexado' when 'VIDEO' then 'Vídeo anexado'
                           else 'Documento anexado' end;
  if p_motivo is null then
    update mensagens_whatsapp set midia_situacao = 'LIBERADA', midia_tamanho = p_tamanho,
                                  midia_caminho = 'whatsapp/' || m.condominio_id || '/' || m.id, midia_url = null
     where id = m.id;
    if anexar_midia_whatsapp(m.id) then
      select protocolo into v_protocolo from pedidos where id = m.pedido_id;
      perform responder_whatsapp(m.telefone, m.contato_id, m.pedido_id, v_palavra || ' ao pedido ' || v_protocolo || '.');
    end if;
  else
    update mensagens_whatsapp set midia_situacao = 'RECUSADA', midia_motivo = left(p_motivo, 300), midia_url = null where id = m.id;
    if m.contato_id is not null then
      perform responder_whatsapp(m.telefone, m.contato_id, m.pedido_id, 'Não deu para usar o arquivo: ' || left(p_motivo, 250));
    end if;
  end if;
  perform entrar_como_sistema(null);
end $$;

-- Eventos do provedor (W-13): entrega, leitura e conexão.
create function whatsapp_evento(p_segredo text, p_instancia text, p_tipo text, p_provedor_id text, p_aparelho text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_aparelho text := telefone_whatsapp(p_aparelho);
begin
  cx := entrar_por_gancho(p_segredo, p_instancia);
  if p_tipo = 'ENTREGUE' then
    update envios_whatsapp set estado = 'ENTREGUE', entregue_em = app_now()
     where provedor_id = p_provedor_id and estado = 'ENVIADA';
  elsif p_tipo = 'LIDA' then
    update envios_whatsapp set estado = 'LIDA', lida_em = app_now(), entregue_em = coalesce(entregue_em, app_now())
     where provedor_id = p_provedor_id and estado in ('ENVIADA', 'ENTREGUE');
  elsif p_tipo = 'DESCONECTADO' and cx.situacao in ('CONECTADO', 'CONECTANDO') then
    update conexoes_whatsapp set situacao = 'DESCONECTADO', desconectado_em = app_now() where id = cx.id;
    perform registrar_historico('whatsapp.desconectado', 'conexao_whatsapp', cx.id::text, jsonb_build_object('origem', 'PROVEDOR'));
    perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'DESCONECTADO', null, null, null, 'D:' || app_now()::text);
  elsif p_tipo = 'CONECTADO' and cx.situacao <> 'SEM_CREDENCIAIS' then
    if v_aparelho is not null and (select numero_whatsapp from condominios where id = cx.condominio_id) = any (variantes_telefone(v_aparelho)) then
      update conexoes_whatsapp set situacao = 'CONECTADO', aparelho = v_aparelho, conectado_em = app_now() where id = cx.id;
      perform registrar_historico('whatsapp.conectado', 'conexao_whatsapp', cx.id::text, jsonb_build_object('origem', 'PROVEDOR'));
    else
      perform entrar_como_sistema(null);
      return false;
    end if;
  else
    perform entrar_como_sistema(null);
    return false;
  end if;
  perform entrar_como_sistema(null);
  return true;
end $$;

-- ---------------------------------------------------------------------------------------
-- A fila (W-13, W-14): a API pega um lote por condomínio conectado, manda pelo conector e
-- devolve o resultado de cada envio.

-- Falha que fica com alguém (W-14): avisa no sino quem cuida dela.
create function falha_whatsapp(e envios_whatsapp) returns void
language sql
set search_path = public
as $$ select avisar_whatsapp(array[e.responsavel], 'FALHA_ENVIO', e.pedido_id, null, e.id, e.id::text) $$;

create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  e envios_whatsapp;
  cx conexoes_whatsapp;
  v_envios jsonb;
  v_saida jsonb := '[]'::jsonb;
  v_max integer := least(greatest(coalesce(p_max, 20), 1), 50);
  v_cancelar text;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    -- Travou no meio do envio: pode ter saído; não repete sozinho (W-14).
    for e in update envios_whatsapp set estado = 'DESCONHECIDO', motivo = 'O envio parou no meio: pode ter saído'
              where estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '5 minutes' returning * loop
      perform falha_whatsapp(e);
    end loop;
    select * into cx from conexoes_whatsapp where situacao = 'CONECTADO';
    continue when cx.id is null;
    v_envios := '[]'::jsonb;
    for e in select * from envios_whatsapp where estado = 'NA_FILA' and enviar_apos <= app_now()
              order by enviar_apos, criado_em limit v_max for update skip locked loop
      v_cancelar := case
        when e.contato_id is not null and not exists (select 1 from contatos where id = e.contato_id and dados_removidos_em is null)
          then 'Os dados do contato foram removidos'
        when e.finalidade = 'AVISO' and not exists (select 1 from avisos_whatsapp_pessoa a where a.pessoa_id = e.pessoa_id and a.ligado
                                                                                          and a.telefone = e.para)
          then 'A pessoa desligou os avisos no WhatsApp'
        when e.finalidade = 'AVISO' and not exists (select 1 from vinculos v where v.pessoa_id = e.pessoa_id and v.revogado_em is null
                                                                             and v.funcao in ('SINDICO', 'AUTORIZADO'))
          then 'A pessoa não tem mais acesso ao condomínio' end;
      if v_cancelar is not null then
        update envios_whatsapp set estado = 'CANCELADA', motivo = v_cancelar where id = e.id;
      else
        update envios_whatsapp set estado = 'ENVIANDO', tentativas = tentativas + 1, enviar_apos = app_now() where id = e.id;
        v_envios := v_envios || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'envio', e.id, 'para', e.para, 'texto', e.texto,
          'pedido', case when e.finalidade = 'AVISO' then e.pedido_id end)));
      end if;
    end loop;
    if jsonb_array_length(v_envios) > 0 then
      v_saida := v_saida || jsonb_build_array(jsonb_build_object(
        'condominio', r.id, 'provedor', cx.provedor, 'instancia', cx.instancia,
        'credenciais', encode(cx.credenciais, 'base64'), 'envios', v_envios));
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_saida;
end $$;

-- O conector aceitou (com o id do provedor) ou falhou. p_falha: PASSAGEIRA repete até 5
-- vezes com intervalo crescente; TEMPO vira resultado desconhecido; PERMANENTE falha na hora.
create function whatsapp_resultado(p_condominio uuid, p_envio uuid, p_provedor_id text, p_erro text, p_falha text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare e envios_whatsapp;
begin
  perform entrar_como_sistema(p_condominio);
  select * into e from envios_whatsapp where id = p_envio for update;
  if e.id is null or e.estado <> 'ENVIANDO' then perform entrar_como_sistema(null); return; end if;
  if p_provedor_id is not null then
    update envios_whatsapp set estado = 'ENVIADA', provedor_id = left(p_provedor_id, 200), aceita_em = app_now(), motivo = null
     where id = e.id;
  elsif p_falha = 'PASSAGEIRA' and e.tentativas < 5 then
    update envios_whatsapp set estado = 'NA_FILA', enviar_apos = app_now() + make_interval(mins => power(2, e.tentativas - 1)::integer),
                               motivo = left(coalesce(p_erro, 'Falha passageira'), 300)
     where id = e.id;
  else
    update envios_whatsapp set estado = case when p_falha = 'TEMPO' then 'DESCONHECIDO' else 'FALHOU' end,
                               motivo = left(coalesce(p_erro, case when p_falha = 'TEMPO' then 'Tempo esgotado: pode ter saído'
                                                                   else 'O provedor recusou' end), 300)
     where id = e.id returning * into e;
    perform falha_whatsapp(e);
  end if;
  perform entrar_como_sistema(null);
end $$;

-- A cada minuto, se houver envio esperando ou mídia a baixar, o banco chama a api-plataforma
-- pelo pg_net (mesmo api_plataforma_url e repasse_segredo do Vault que o e-mail usa).
create function chamar_fila_whatsapp() returns boolean
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
    if exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO')
       and (exists (select 1 from envios_whatsapp where (estado = 'NA_FILA' and enviar_apos <= app_now())
                                                     or (estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '5 minutes'))
            or exists (select 1 from mensagens_whatsapp where midia_situacao = 'BAIXAR')) then
      v_tem := true;
      exit;
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  if not v_tem then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using rtrim(v_url, '/') || '/v1/interno/fila-whatsapp', '{}'::jsonb,
          jsonb_build_object('content-type', 'application/json', 'x-repasse-segredo', v_segredo);
  return true;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('enviar-whatsapp', '* * * * *', 'select public.chamar_fila_whatsapp()');
exception when others then
  raise notice 'pg_cron indisponível: agende chamar_fila_whatsapp() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- Console: a conexão do número (W-01). As credenciais nunca voltam para a tela.

create function conexao_do_cliente() returns conexoes_whatsapp
language plpgsql
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  select * into cx from conexoes_whatsapp;
  if cx.id is null then
    insert into conexoes_whatsapp (condominio_id) values (contexto_condominio()) returning * into cx;
  end if;
  return cx;
end $$;

create function conexao_json(cx conexoes_whatsapp) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'provedor', cx.provedor, 'oficial', cx.oficial, 'situacao', cx.situacao, 'aparelho', cx.aparelho,
    'conectadoEm', cx.conectado_em, 'desconectadoEm', cx.desconectado_em, 'ultimaRecebida', cx.ultima_recebida,
    'termoAceitoEm', cx.termo_aceito_em, 'termoAceitoPor', nome_pessoa(cx.termo_aceito_por), 'versao', cx.versao))
$$;

create function console_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.ver');
  select * into cx from conexoes_whatsapp;
  return jsonb_build_object(
    'numeroFicha', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', nome_pessoa(h.autor_id), 'dados', h.dados)
                       order by h.ocorrido_em desc, h.id desc)
        from (select * from historico h where h.condominio_id = p_condominio and h.entidade = 'conexao_whatsapp'
               order by h.ocorrido_em desc, h.id desc limit 30) h), '[]'::jsonb),
    'pode', jsonb_build_object('conectar', pode(p_pessoa, p_condominio, 'console.whatsapp.conectar')));
end $$;

-- Guarda as credenciais cifradas e troca o segredo do endereço do aviso. Devolve o segredo
-- (uma vez) para a API ligar os avisos no provedor.
create function console_whatsapp_credenciais(p_pessoa uuid, p_condominio uuid, p_versao integer, p_instancia text, p_credenciais bytea)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_segredo text := novo_codigo();
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  if p_instancia is null or p_instancia !~ '^[A-Za-z0-9_-]{1,100}$' then perform recusar_campos('Instância inválida', 'instancia'); end if;
  if p_credenciais is null or length(p_credenciais) not between 28 and 4096 then perform recusar_campos('Credenciais inválidas', 'token'); end if;
  cx := conexao_do_cliente();
  if p_versao is not null and p_versao <> cx.versao then perform conflito_versao('conexoes_whatsapp', cx.id); end if;
  update conexoes_whatsapp set instancia = p_instancia, credenciais = p_credenciais, situacao = 'DESCONECTADO',
                               desconectado_em = case when situacao = 'CONECTADO' then app_now() else desconectado_em end
   where id = cx.id returning versao into v_versao;
  update ganchos_whatsapp set revogado_em = app_now() where condominio_id = p_condominio and revogado_em is null;
  insert into ganchos_whatsapp (hash, condominio_id) values (hash_codigo(v_segredo), p_condominio);
  perform registrar_historico_interno('whatsapp.credenciais', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
  return jsonb_build_object('segredo', v_segredo, 'versao', v_versao);
end $$;

-- O que a API precisa para falar com o provedor em nome do cliente. Conectar pede o termo do
-- piloto aceito pelo síndico e o número na ficha (DC14).
create function console_whatsapp_acesso(p_pessoa uuid, p_condominio uuid, p_para text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  if p_para is null or p_para not in ('CONSULTAR', 'CONECTAR', 'DESCONECTAR') then perform recusar_campos('Ação desconhecida', 'acao'); end if;
  perform entrar_condominio(p_pessoa, p_condominio, case when p_para = 'CONSULTAR' then 'console.whatsapp.ver' else 'console.whatsapp.conectar' end);
  select * into cx from conexoes_whatsapp;
  if cx.id is null or cx.credenciais is null then perform recusar_motivo('Guarde as credenciais da instância primeiro', 'SEM_CREDENCIAIS'); end if;
  if p_para = 'CONECTAR' then
    if cx.termo_aceito_em is null then perform recusar_motivo('O síndico ainda não aceitou o termo do piloto', 'TERMO_PENDENTE'); end if;
    if (select numero_whatsapp from condominios where id = p_condominio) is null then
      perform recusar_motivo('Cadastre o número do condomínio na ficha', 'SEM_NUMERO');
    end if;
  end if;
  return jsonb_build_object('provedor', cx.provedor, 'instancia', cx.instancia, 'credenciais', encode(cx.credenciais, 'base64'),
                            'numero', (select numero_whatsapp from condominios where id = p_condominio), 'situacao', cx.situacao);
end $$;

-- O que a API viu no provedor. Conectado só vale com o aparelho do número da ficha; outro
-- aparelho é recusado e a API desconecta. Desconectar na mão pede motivo.
create function console_whatsapp_situacao(p_pessoa uuid, p_condominio uuid, p_situacao text, p_aparelho text, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_aparelho text := telefone_whatsapp(p_aparelho);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if p_situacao is null or p_situacao not in ('CONECTANDO', 'CONECTADO', 'DESCONECTADO') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  perform entrar_condominio(p_pessoa, p_condominio,
    case when p_situacao = 'CONECTANDO' or v_motivo is not null then 'console.whatsapp.conectar' else 'console.whatsapp.ver' end);
  select * into cx from conexoes_whatsapp for update;
  if cx.id is null or cx.credenciais is null then perform recusar_motivo('Guarde as credenciais da instância primeiro', 'SEM_CREDENCIAIS'); end if;
  if p_situacao = 'CONECTADO' then
    if v_aparelho is null or not ((select numero_whatsapp from condominios where id = p_condominio) = any (variantes_telefone(v_aparelho))) then
      if cx.situacao in ('CONECTADO', 'CONECTANDO') then
        update conexoes_whatsapp set situacao = 'DESCONECTADO', desconectado_em = app_now() where id = cx.id returning * into cx;
      end if;
      perform registrar_historico_interno('whatsapp.aparelho_diferente', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
      return conexao_json(cx) || jsonb_build_object('aparelhoDiferente', true);
    end if;
    if cx.situacao <> 'CONECTADO' or cx.aparelho is distinct from v_aparelho then
      update conexoes_whatsapp set situacao = 'CONECTADO', aparelho = v_aparelho, conectado_em = app_now() where id = cx.id returning * into cx;
      perform registrar_historico_interno('whatsapp.conectado', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
    end if;
  elsif p_situacao = 'CONECTANDO' then
    if cx.situacao <> 'CONECTANDO' then
      update conexoes_whatsapp set situacao = 'CONECTANDO' where id = cx.id returning * into cx;
    end if;
  else
    if v_motivo is not null and length(v_motivo) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
    if cx.situacao in ('CONECTADO', 'CONECTANDO') then
      update conexoes_whatsapp set situacao = 'DESCONECTADO', desconectado_em = app_now() where id = cx.id returning * into cx;
      perform registrar_historico_interno('whatsapp.desconectado', 'conexao_whatsapp', cx.id::text,
        jsonb_strip_nulls(jsonb_build_object('origem', case when v_motivo is not null then 'TRIADE' else 'PROVEDOR' end, 'motivo', v_motivo)));
      perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'DESCONECTADO', null, null, null, 'D:' || app_now()::text);
    end if;
  end if;
  return conexao_json(cx);
end $$;

-- Os números dos clientes atribuídos, desconectados primeiro.
create function console_whatsapp_lista(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v jsonb := '[]'::jsonb;
  cx conexoes_whatsapp;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  for r in select distinct v.condominio_id from vinculos v
            where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes()) loop
    continue when not pode(p_pessoa, r.condominio_id, 'console.whatsapp.ver');
    perform entrar_condominio(p_pessoa, r.condominio_id, 'console.whatsapp.ver');
    select * into cx from conexoes_whatsapp;
    continue when cx.id is null and (select numero_whatsapp from condominios where id = r.condominio_id) is null;
    v := v || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'condominioId', r.condominio_id, 'nome', (select nome from condominios where id = r.condominio_id),
      'numero', (select numero_whatsapp from condominios where id = r.condominio_id),
      'situacao', coalesce(cx.situacao, 'SEM_CREDENCIAIS'), 'oficial', cx.oficial,
      'desde', case when cx.situacao = 'CONECTADO' then cx.conectado_em else cx.desconectado_em end,
      'termo', cx.termo_aceito_em is not null)));
  end loop;
  return coalesce((select jsonb_agg(x order by array_position(array['DESCONECTADO', 'CONECTANDO', 'SEM_CREDENCIAIS', 'CONECTADO'], x ->> 'situacao'),
                                    x ->> 'nome') from jsonb_array_elements(v) x), '[]'::jsonb);
end $$;

create or replace function console_contagens(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_carteira integer := 0;
  v_implantacoes integer := 0;
  v_chamados integer := 0;
  v_suporte integer := 0;
  v_whatsapp integer := 0;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select * from jsonb_array_elements_text(v_lista) as y(id)
  loop
    if pode(p_pessoa, r.id::uuid, 'console.carteira.ver') then
      perform entrar_condominio(p_pessoa, r.id::uuid, 'console.carteira.ver');
      v_carteira := v_carteira + 1;
      if pode(p_pessoa, r.id::uuid, 'console.implantacao.ver')
         and (select estado from clientes where condominio_id = r.id::uuid) = 'IMPLANTACAO' then
        v_implantacoes := v_implantacoes + 1;
      end if;
      if pode(p_pessoa, r.id::uuid, 'console.chamados.ver') then
        v_chamados := v_chamados + (select count(*) from chamados where condominio_id = r.id::uuid and situacao in ('NOVO', 'ANDAMENTO'));
      end if;
      if pode(p_pessoa, r.id::uuid, 'console.suporte.acesso') then
        v_suporte := v_suporte + (select count(*) from pedidos_suporte_acesso where condominio_id = r.id::uuid
                                                                       and situacao in ('ABERTO', 'DUVIDOSO'));
      end if;
      if pode(p_pessoa, r.id::uuid, 'console.whatsapp.ver') then
        v_whatsapp := v_whatsapp + (select count(*) from conexoes_whatsapp where condominio_id = r.id::uuid and situacao = 'DESCONECTADO');
      end if;
    end if;
  end loop;
  return jsonb_build_object('carteira', v_carteira, 'implantacoes', v_implantacoes, 'chamados', v_chamados, 'suporteAcesso', v_suporte,
                            'whatsapp', v_whatsapp);
end $$;

-- ---------------------------------------------------------------------------------------
-- Plataforma: WhatsApp (A identificar, falhas de envio, conexão), a conversa no pedido e as
-- configurações.

-- Quem cuida dos pedidos vê o WhatsApp do condomínio.
create function exigir_whatsapp(p_pessoa uuid, p_condominio uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if not (pode(p_pessoa, p_condominio, 'pedidos.responder') or pode(p_pessoa, p_condominio, 'pedidos.atualizar')) then
    raise exception 'Sem permissão para o WhatsApp do condomínio' using errcode = 'TC401';
  end if;
end $$;

create function resumo_whatsapp() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'situacao', coalesce((select situacao from conexoes_whatsapp), 'SEM_CREDENCIAIS'),
    'aIdentificar', (select count(distinct telefone) from mensagens_whatsapp where triagem in ('A_IDENTIFICAR', 'RECADO')),
    'falhas', (select count(*) from envios_whatsapp where estado in ('FALHOU', 'DESCONHECIDO') and resolvida_em is null))
$$;

create function plataforma_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  select * into cx from conexoes_whatsapp;
  return jsonb_build_object(
    'numero', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'resumo', resumo_whatsapp(),
    'aIdentificar', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', m.id, 'telefone', m.telefone, 'tipo', m.tipo, 'texto', m.texto, 'enviadaEm', m.enviada_em, 'triagem', m.triagem,
               'contato', case when m.contato_id is not null then jsonb_build_object('id', m.contato_id,
                            'nome', (select nome from contatos where id = m.contato_id), 'unidades', unidades_do_contato(m.contato_id)) end,
               'vinculoPendente', exists (select 1 from contatos ct join contatos_unidade cu on cu.contato_id = ct.id and cu.estado = 'PENDENTE'
                                           where ct.telefone = any (variantes_telefone(m.telefone))),
               'midia', case when m.midia_tipo is not null then jsonb_build_object('tipo', m.midia_tipo, 'situacao', m.midia_situacao,
                                                                                   'motivo', m.midia_motivo) end))
             order by m.enviada_em desc)
        from (select * from mensagens_whatsapp where triagem in ('A_IDENTIFICAR', 'RECADO') order by enviada_em desc limit 100) m), '[]'::jsonb),
    'falhas', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', e.id, 'finalidade', e.finalidade, 'estado', e.estado, 'motivo', e.motivo, 'tentativas', e.tentativas,
               'criadoEm', e.criado_em, 'texto', e.texto, 'responsavel', nome_pessoa(e.responsavel),
               'para', coalesce((select nome from contatos where id = e.contato_id), nome_pessoa(e.pessoa_id)),
               'unidades', case when e.contato_id is not null then unidades_do_contato(e.contato_id) end,
               'pedido', case when p.id is not null then jsonb_build_object('id', p.id, 'protocolo', p.protocolo) end))
             order by e.criado_em desc)
        from envios_whatsapp e left join pedidos p on p.id = e.pedido_id and pedido_visivel(p_pessoa, p)
       where e.estado in ('FALHOU', 'DESCONHECIDO') and e.resolvida_em is null), '[]'::jsonb),
    'pode', jsonb_build_object('triar', pode(p_pessoa, p_condominio, 'pedidos.atualizar'),
                               'ligar', pode(p_pessoa, p_condominio, 'moradores.editar'),
                               'reenviar', pode(p_pessoa, p_condominio, 'pedidos.responder')));
end $$;

-- Tratar as mensagens de um telefone em "A identificar": arquivar com motivo, juntar a um
-- pedido ou ligar o número a um contato. Nada vira pedido sozinho (MU-02).
create function plataforma_triar_whatsapp(p_pessoa uuid, p_condominio uuid, p_mensagem uuid, p_acao text, p_motivo text,
                                          p_pedido uuid, p_contato uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  p pedidos;
  ct contatos;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_n integer := 0;
  r record;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  select * into m from mensagens_whatsapp where id = p_mensagem and triagem in ('A_IDENTIFICAR', 'RECADO');
  if m.id is null then raise exception 'Mensagem não encontrada' using errcode = 'TC404'; end if;
  if p_acao = 'ARQUIVAR' then
    if not pode(p_pessoa, p_condominio, 'pedidos.atualizar') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
    if length(v_motivo) is null or length(v_motivo) not between 3 and 300 then perform recusar_campos('Diga o motivo (3 a 300 caracteres)', 'motivo'); end if;
    update mensagens_whatsapp set triagem = 'ARQUIVADA', triagem_motivo = v_motivo, tratada_em = app_now(), tratada_por = p_pessoa
     where telefone = m.telefone and triagem in ('A_IDENTIFICAR', 'RECADO');
    get diagnostics v_n = row_count;
  elsif p_acao = 'PEDIDO' then
    if not pode(p_pessoa, p_condominio, 'pedidos.atualizar') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
    p := exigir_pedido(p_pessoa, p_pedido);
    perform exigir_em_andamento(p);
    for r in update mensagens_whatsapp set triagem = 'TRATADA', tratada_em = app_now(), tratada_por = p_pessoa, pedido_id = p.id
              where telefone = m.telefone and triagem in ('A_IDENTIFICAR', 'RECADO') and pedido_id is null returning id loop
      v_n := v_n + 1;
      perform anexar_midia_whatsapp(r.id);
    end loop;
    perform registrar_historico('pedido.whatsapp_juntado', 'pedidos', p.id::text, jsonb_build_object('mensagens', v_n));
  elsif p_acao = 'CONTATO' then
    if not pode(p_pessoa, p_condominio, 'moradores.editar') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
    select * into ct from contatos where id = p_contato and dados_removidos_em is null;
    if ct.id is null then perform recusar_campos('Escolha um contato', 'contatoId'); end if;
    if not (ct.telefone = any (variantes_telefone(m.telefone))) then
      update contatos set telefone = m.telefone where id = ct.id;
      perform registrar_historico('contato.telefone_whatsapp', 'contato', ct.id::text, '{}'::jsonb);
    end if;
    update mensagens_whatsapp set triagem = 'TRATADA', tratada_em = app_now(), tratada_por = p_pessoa, contato_id = ct.id
     where telefone = m.telefone and triagem in ('A_IDENTIFICAR', 'RECADO');
    get diagnostics v_n = row_count;
    update conversas_whatsapp set neutra_em = null, etapa = 'INICIO', etapa_ate = null where telefone = m.telefone;
  else
    perform recusar_campos('Ação desconhecida', 'acao');
  end if;
  return jsonb_build_object('tratadas', v_n, 'contatoAtivo', case when p_acao = 'CONTATO' then contato_ativo(ct.id) end);
end $$;

-- Arquivo de uma mensagem em "A identificar" (os do pedido abrem pelos arquivos do pedido).
create function plataforma_midia_whatsapp(p_pessoa uuid, p_condominio uuid, p_mensagem uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m mensagens_whatsapp;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  select * into m from mensagens_whatsapp where id = p_mensagem and midia_situacao = 'LIBERADA'
                                            and (pedido_id is null or pedido_visivel(p_pessoa, (select x from pedidos x where x.id = pedido_id)));
  if m.id is null then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', m.midia_caminho, 'tipo', m.midia_tipo, 'nome', coalesce(m.midia_nome, 'arquivo'));
end $$;

-- Reenviar (com motivo) ou dar a falha por resolvida (W-14).
create function exigir_falha(p_envio uuid) returns envios_whatsapp
language plpgsql
set search_path = public
as $$
declare e envios_whatsapp;
begin
  select * into e from envios_whatsapp where id = p_envio and estado in ('FALHOU', 'DESCONHECIDO') and resolvida_em is null for update;
  if e.id is null then raise exception 'Falha não encontrada' using errcode = 'TC404'; end if;
  return e;
end $$;

create function plataforma_reenviar_whatsapp(p_pessoa uuid, p_condominio uuid, p_envio uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if not pode(p_pessoa, p_condominio, 'pedidos.responder') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
  e := exigir_falha(p_envio);
  if length(v_motivo) is null or length(v_motivo) not between 3 and 300 then perform recusar_campos('Diga o motivo (3 a 300 caracteres)', 'motivo'); end if;
  if e.contato_id is not null and not exists (select 1 from contatos where id = e.contato_id and dados_removidos_em is null) then
    perform recusar_motivo('Os dados do contato foram removidos', 'CONTATO_REMOVIDO');
  end if;
  insert into envios_whatsapp (condominio_id, para, contato_id, pessoa_id, pedido_id, andamento_id, finalidade, texto, responsavel,
                               criado_por, reenvio_de)
  values (e.condominio_id, coalesce((select telefone from contatos where id = e.contato_id), e.para), e.contato_id, e.pessoa_id,
          e.pedido_id, e.andamento_id, e.finalidade, e.texto, p_pessoa, coalesce(e.criado_por, p_pessoa), e.id)
  returning id into v_id;
  update envios_whatsapp set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = left('Reenviado: ' || v_motivo, 300) where id = e.id;
  if e.pedido_id is not null then
    perform registrar_historico('pedido.whatsapp_reenviado', 'pedidos', e.pedido_id::text, jsonb_build_object('envio', v_id, 'motivo', v_motivo));
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create function plataforma_resolver_falha_whatsapp(p_pessoa uuid, p_condominio uuid, p_envio uuid, p_motivo text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  e := exigir_falha(p_envio);
  if length(v_motivo) is null or length(v_motivo) not between 3 and 300 then perform recusar_campos('Diga o que foi feito (3 a 300 caracteres)', 'motivo'); end if;
  update envios_whatsapp set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = v_motivo where id = e.id;
  if e.pedido_id is not null then
    perform registrar_historico('pedido.whatsapp_falha_resolvida', 'pedidos', e.pedido_id::text, jsonb_build_object('envio', e.id));
  end if;
end $$;

-- A conversa do pedido (W-05, W-13): mensagens do morador, respostas e retornos, com o estado
-- de cada envio, e os pedidos de revisão.
create function plataforma_pedido_whatsapp(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  ct contatos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_id);
  select * into ct from contatos where id = p.contato_id;
  return jsonb_build_object(
    'mensagens', coalesce((
      select jsonb_agg(x.item order by x.em, x.ordem)
        from (
          select m.enviada_em as em, 0 as ordem, jsonb_strip_nulls(jsonb_build_object(
                   'id', m.id, 'lado', 'MORADOR', 'tipo', m.tipo, 'texto', m.texto, 'em', m.enviada_em,
                   'autor', (select nome from contatos where id = m.contato_id),
                   'midia', case when m.midia_tipo is not null then jsonb_build_object('tipo', m.midia_tipo, 'situacao', m.midia_situacao,
                                                                                       'motivo', m.midia_motivo, 'arquivoId', m.arquivo_id) end)) as item
            from mensagens_whatsapp m where m.pedido_id = p.id
          union all
          select e.criado_em, 1, jsonb_strip_nulls(jsonb_build_object(
                   'id', e.id, 'lado', 'CONDOMINIO', 'tipo', 'TEXTO', 'texto', e.texto, 'em', e.criado_em,
                   'finalidade', e.finalidade, 'autor', nome_pessoa(e.criado_por), 'estado', e.estado, 'motivo', e.motivo,
                   'resolvida', e.resolvida_em is not null))
            from envios_whatsapp e where e.pedido_id = p.id and e.finalidade in ('RESPOSTA', 'RETORNO')) x), '[]'::jsonb),
    'revisoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', r.id, 'texto', r.texto, 'em', r.criado_em,
                                                            'decisao', r.decisao, 'decididaEm', r.decidida_em,
                                                            'decididaPor', nome_pessoa(r.decidida_por), 'resposta', r.resposta))
                       order by r.criado_em desc)
        from revisoes_whatsapp r where r.pedido_id = p.id), '[]'::jsonb),
    'pode', jsonb_build_object(
      'responder', pode_no_pedido(p_pessoa, p, 'pedidos.responder') and p.estado in ('ABERTO', 'EM_ANDAMENTO')
                   and ct.id is not null and ct.dados_removidos_em is null and ct.telefone is not null
                   and exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS'),
      'decidirRevisao', pode_no_pedido(p_pessoa, p, 'pedidos.responder')));
end $$;

-- Responder pelo WhatsApp é dar retorno (AT-06, W-14): fica no andamento, recalcula o próximo
-- retorno na hora e vai para a fila; a falha de envio é tratada à parte.
create function plataforma_responder_whatsapp(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_texto text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  ct contatos;
  v_proximo timestamptz;
  v_versao integer;
  v_andamento uuid;
  v_envio uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.responder');
  perform exigir_em_andamento(v);
  select * into ct from contatos where id = v.contato_id;
  if ct.id is null or ct.dados_removidos_em is not null or ct.telefone is null then
    perform recusar_motivo('O pedido não tem contato com WhatsApp', 'SEM_CONTATO');
  end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then
    perform recusar_motivo('O WhatsApp do condomínio não está ligado', 'SEM_WHATSAPP');
  end if;
  if length(btrim(coalesce(p_texto, ''))) not between 3 and 2000 then
    perform recusar_campos('Escreva a resposta (3 a 2000 caracteres)', 'texto');
  end if;
  v_proximo := calcular_proximo_retorno(v.categoria_id, v.prioridade_id);
  update pedidos set proximo_retorno = v_proximo where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  insert into andamentos_pedido (condominio_id, pedido_id, tipo, meio, texto, criado_por)
  values (p_condominio, p_id, 'RETORNO', 'WHATSAPP', btrim(p_texto), p_pessoa) returning id into v_andamento;
  v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, p_id, v_andamento, 'RETORNO', btrim(p_texto), p_pessoa, p_pessoa);
  perform registrar_historico('pedido.retorno_registrado', 'pedidos', p_id::text, jsonb_build_object(
    'andamento', v_andamento, 'meio', 'WHATSAPP', 'envio', v_envio, 'de', v.proximo_retorno, 'para', v_proximo));
  return jsonb_build_object('versao', v_versao, 'proximoRetorno', v_proximo, 'envio', v_envio);
end $$;

-- Manter o pedido concluído depois do pedido de revisão (AT-15): a resposta vai ao morador.
-- Reabrir é pelo caminho de sempre, que resolve a revisão.
create function plataforma_manter_revisao_whatsapp(p_pessoa uuid, p_condominio uuid, p_revisao uuid, p_resposta text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r revisoes_whatsapp;
  p pedidos;
  ct contatos;
  v_resposta text := nullif(btrim(coalesce(p_resposta, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into r from revisoes_whatsapp where id = p_revisao and decidida_em is null for update;
  if r.id is null then raise exception 'Pedido de revisão não encontrado' using errcode = 'TC404'; end if;
  p := exigir_pedido(p_pessoa, r.pedido_id);
  perform exigir_acao_no_pedido(p_pessoa, p, 'pedidos.responder');
  if length(v_resposta) is null or length(v_resposta) not between 3 and 2000 then
    perform recusar_campos('Escreva a resposta ao morador (3 a 2000 caracteres)', 'resposta');
  end if;
  update revisoes_whatsapp set decidida_em = app_now(), decidida_por = p_pessoa, decisao = 'MANTIDO', resposta = v_resposta where id = r.id;
  select * into ct from contatos where id = r.contato_id;
  if ct.dados_removidos_em is null and ct.telefone is not null then
    perform enfileirar_whatsapp(ct.telefone, ct.id, null, p.id, null, 'RESPOSTA', v_resposta, p_pessoa, p_pessoa);
  end if;
  perform registrar_historico('pedido.revisao_mantida', 'pedidos', p.id::text, jsonb_build_object('revisao', r.id));
  return jsonb_build_object('decisao', 'MANTIDO');
end $$;

-- Configurações › WhatsApp: as mensagens, o pedido que chega e os avisos de cada pessoa.
create function plataforma_config_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  cx conexoes_whatsapp;
  a avisos_whatsapp_pessoa;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select * into cfg from configuracao_condominio;
  select * into cx from conexoes_whatsapp;
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa;
  return jsonb_strip_nulls(jsonb_build_object(
    'numero', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'config', jsonb_build_object('foraHorario', cfg.whatsapp_fora_horario, 'categoriaId', categoria_whatsapp(),
                                 'prioridadeId', prioridade_whatsapp(), 'anexarMinutos', cfg.whatsapp_anexar_minutos, 'versao', cfg.versao),
    'avisoGolpe', aviso_golpe_whatsapp(),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by lower(nome)) from categorias where ativa), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nivel) from prioridades where ativa), '[]'::jsonb),
    'meusAvisos', case when a.id is not null then jsonb_build_object('telefone', a.telefone, 'tipos', to_jsonb(a.tipos), 'ligado', a.ligado,
                                                                     'versao', a.versao) end,
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar'),
                               'aceitarTermo', eh_sindico(p_pessoa) and cx.termo_aceito_em is null)));
end $$;

create function plataforma_definir_whatsapp(p_pessoa uuid, p_condominio uuid, p_versao integer, p_fora_horario text, p_categoria uuid,
                                            p_prioridade uuid, p_anexar integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fora text := btrim(coalesce(p_fora_horario, ''));
  v_versao integer;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if length(v_fora) not between 20 and 600 then perform recusar_campos('Mensagem de fora do horário de 20 a 600 caracteres', 'foraHorario'); end if;
  -- Não prometer prazo nem atendimento imediato (W-12).
  if v_fora ~* '(imediat|em at[ée] [0-9]|garant|agora mesmo|j[áa] estamos)' then
    perform recusar_motivo('A mensagem de fora do horário não promete prazo nem atendimento imediato', 'PROMESSA_DE_PRAZO');
  end if;
  if p_anexar is null or p_anexar not in (15, 30, 60) then perform recusar_campos('Escolha 15, 30 ou 60 minutos', 'anexarMinutos'); end if;
  if not exists (select 1 from categorias where id = p_categoria and ativa) then perform recusar_campos('Escolha uma categoria ativa', 'categoriaId'); end if;
  if not exists (select 1 from prioridades where id = p_prioridade and ativa) then perform recusar_campos('Escolha uma prioridade ativa', 'prioridadeId'); end if;
  select id into v_id from configuracao_condominio;
  update configuracao_condominio set whatsapp_fora_horario = v_fora, whatsapp_categoria = p_categoria, whatsapp_prioridade = p_prioridade,
                                     whatsapp_anexar_minutos = p_anexar
   where id = v_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_id); end if;
  perform registrar_historico('whatsapp.configurado', 'configuracao_condominio', v_id::text, '{}'::jsonb);
  return v_versao;
end $$;

-- O termo do piloto (DC14): só o síndico aceita, antes de a TRÍADE conectar.
create function plataforma_aceitar_termo_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico aceita o termo do piloto' using errcode = 'TC401'; end if;
  cx := conexao_do_cliente();
  if cx.termo_aceito_em is null then
    update conexoes_whatsapp set termo_aceito_em = app_now(), termo_aceito_por = p_pessoa where id = cx.id returning * into cx;
    perform registrar_historico('whatsapp.termo_aceito', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
  end if;
  return conexao_json(cx);
end $$;

-- Avisos no WhatsApp da própria pessoa (W-11, F6.3).
create function plataforma_meus_avisos_whatsapp(p_pessoa uuid, p_condominio uuid, p_versao integer, p_telefone text, p_tipos text[],
                                                p_ligado boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a avisos_whatsapp_pessoa;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not telefone_valido(p_telefone) then perform recusar_campos('Celular com DDI e DDD (ex.: +5561999998888)', 'telefone'); end if;
  if p_tipos is null or not (p_tipos <@ array['PEDIDO_NOVO', 'RETORNO_VENCIDO', 'REVISAO']) then perform recusar_campos('Avisos desconhecidos', 'tipos'); end if;
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa;
  if a.id is null then
    insert into avisos_whatsapp_pessoa (condominio_id, pessoa_id, telefone, tipos, ligado)
    values (p_condominio, p_pessoa, p_telefone, p_tipos, coalesce(p_ligado, true)) returning versao into v_versao;
  else
    update avisos_whatsapp_pessoa set telefone = p_telefone, tipos = p_tipos, ligado = coalesce(p_ligado, ligado)
     where id = a.id and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('avisos_whatsapp_pessoa', a.id); end if;
  end if;
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- Painel e sino: o WhatsApp entra na contagem do menu e nos avisos.

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
    'memoria', case when pode(p_pessoa, c.id, 'documentos.ver') then jsonb_build_object('prontuario', resumo_prontuario()) end,
    'acessosExcepcionais', case when pode(p_pessoa, c.id, 'acesso_excepcional.aprovar') then (
      select jsonb_build_object(
        'pedidos', coalesce(jsonb_agg(resumo_acesso_excepcional(a) order by a.criado_em) filter (where a.situacao = 'PEDIDO'), '[]'::jsonb),
        'valendo', count(*) filter (where a.situacao = 'APROVADO' and a.valido_ate > app_now()))
        from acessos_excepcionais a
       where a.condominio_id = c.id and (a.situacao = 'PEDIDO' or (a.situacao = 'APROVADO' and a.valido_ate > app_now()))) end,
    'whatsapp', case when pode(p_pessoa, c.id, 'pedidos.responder') or pode(p_pessoa, c.id, 'pedidos.atualizar') then resumo_whatsapp() end,
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_email a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_prestador a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_memoria a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_triade a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_whatsapp a where a.pessoa_id = p_pessoa and a.visto_em is null)))
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_build_object(
                   'id', a.id, 'tipo', 'PRESTADOR_' || r.tipo, 'manutencaoId', m.id, 'titulo', m.titulo,
                   'nome', (select l.para from links_prestador l where l.id = r.link_id),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em)
            from avisos_prestador a join registros_prestador r on r.id = a.registro_id join manutencoes m on m.id = r.manutencao_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'itemId', a.item_id, 'titulo', (select i.nome from itens_prontuario i where i.id = a.item_id),
                   'exportacaoId', a.exportacao_id, 'referencia', to_char(a.referencia, 'YYYY-MM-DD'),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_memoria a
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', a.tipo, 'texto', a.texto, 'chamadoId', a.chamado_id,
                   'numero', (select ch.numero from chamados ch where ch.id = a.chamado_id),
                   'titulo', (select ch.titulo from chamados ch where ch.id = a.chamado_id),
                   'acessoId', a.acesso_id, 'nome', (select nome_pessoa(x.pedido_por) from acessos_excepcionais x where x.id = a.acesso_id),
                   'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_triade a
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days'
          union all
          select a.visto_em is not null, a.criado_em, jsonb_strip_nulls(jsonb_build_object(
                   'id', a.id, 'tipo', 'WHATSAPP_' || a.tipo, 'pedidoId', p.id, 'protocolo', p.protocolo,
                   'assunto', case when pedido_visivel(p_pessoa, p) then p.assunto end,
                   'envioId', a.envio_id, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
            from avisos_whatsapp a left join pedidos p on p.id = a.pedido_id
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_prestador where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_memoria where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_triade where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_whatsapp where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer; v_r integer; v_x integer; v_t integer; v_w integer;
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
  update avisos_prestador set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  update avisos_memoria set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_x = row_count;
  update avisos_triade set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_t = row_count;
  update avisos_whatsapp set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_w = row_count;
  return v_n + v_m + v_d + v_e + v_p + v_r + v_x + v_t + v_w;
end $$;

call fechar_acesso();

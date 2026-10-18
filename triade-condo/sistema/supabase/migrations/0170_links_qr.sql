-- 0170 · Links e QR (peça R13; AT-30, MP-08, V-11). Telas e decisões aprovadas pela Carolina em
-- 18/10/2026 (docs/telas/links-qr.html).
--
-- Regras desta parte:
-- 1. Etiqueta por local (AT-30): um local com um QR que aponta para o sistema (/l/<código>), não
--    direto para o WhatsApp; mudar o número do condomínio não obriga a reimprimir. O código tem
--    12 caracteres sem os que se confundem e fica guardado, como o do mural, para reimprimir.
--    Trocar o código e desativar pedem motivo; o código velho para na hora. Sem número de
--    WhatsApp cadastrado na implantação, não há etiqueta.
-- 2. A página da etiqueta mostra só o nome do condomínio, o local, o código curto (E04) e o
--    recado do síndico, que some na data escolhida (no máximo 30 dias). Nada de nomes, unidades,
--    pedidos ou situação da manutenção. Conta as aberturas por dia, sem saber quem abriu.
-- 3. Os locais das etiquetas viram sugestão no campo Local de pedidos, manutenção e agenda, que
--    continua aceitando texto livre.
-- 4. Link do prestador (V-11): um por manutenção de cada vez, para quem executa (prestador do
--    cadastro ou nome escrito à mão). Vale até a data escolhida (padrão 14 dias, no máximo 60) e
--    enquanto a manutenção não for concluída nem cancelada. Cancelar pede motivo; mandar de novo
--    gera link novo e o anterior para. O código é guardado só embaralhado (sha256).
-- 5. O prestador vê só o que foi escrito para ele (o que fazer, local, quando, como entrar e os
--    arquivos marcados). Detalhes internos, pedido, morador e valores não vão.
-- 6. Chegada pela etiqueta (MP-08): a etiqueta lida, se for do local da manutenção, confirma a
--    chegada; sem etiqueta ou com outra, a chegada fica "informada pelo prestador". Sem GPS.
-- 7. O que o prestador manda (não consegui fazer, terminei, fotos) vai para o histórico e avisa
--    o responsável no sino. A situação da manutenção não muda sozinha.

-- ---------------------------------------------------------------------------------------
-- Códigos sem conta desta parte. O código chega antes de se saber o condomínio: a tabela é
-- global e guarda só o hash.

create table codigos_sem_conta (
  hash          bytea primary key check (length(hash) = 32),
  condominio_id uuid not null references condominios (id) on delete restrict,
  tipo          text not null check (tipo in ('ETIQUETA', 'PRESTADOR')),
  alvo_id       uuid not null,
  criado_em     timestamptz not null default app_now(),
  revogado_em   timestamptz
);
create index codigos_sem_conta_alvo on codigos_sem_conta (alvo_id);
call proteger_tabela_global('codigos_sem_conta', 'Etiquetas e links de prestador: o código chega antes de se saber o condomínio; guarda só o hash');

-- O código que alguém abriu: entra no condomínio dele, sem pessoa. Desconhecido ou de outro
-- tipo responde como não encontrado; o revogado volta para a página dizer que parou.
create function entrar_por_codigo(p_codigo text, p_tipo text) returns codigos_sem_conta
language plpgsql
set search_path = public
as $$
declare l codigos_sem_conta;
begin
  perform limpar_contexto();
  if p_codigo is null or length(p_codigo) not between 14 and 64 or p_codigo !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Link não encontrado' using errcode = 'TC404';
  end if;
  select * into l from codigos_sem_conta where hash = hash_codigo(p_codigo) and tipo = p_tipo;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  perform entrar_como_sistema(l.condominio_id);
  return l;
end $$;

-- ---------------------------------------------------------------------------------------
-- Etiquetas por local (AT-30).

create table etiquetas (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  numero             smallint not null check (numero between 1 and 999),
  local              text not null check (length(btrim(local)) between 2 and 120),
  onde               text check (length(btrim(onde)) between 2 and 120),
  codigo             text not null unique check (codigo ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  recado             text check (length(btrim(recado)) between 3 and 300),
  recado_ate         date,
  recado_em          timestamptz,
  ativa              boolean not null default true,
  desativada_em      timestamptz,
  desativada_por     uuid references pessoas (id),
  motivo_desativacao text check (length(btrim(motivo_desativacao)) between 3 and 500),
  criado_em          timestamptz not null default app_now(),
  criado_por         uuid not null references pessoas (id),
  atualizado_em      timestamptz not null default app_now(),
  versao             integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, numero),
  check ((recado is null) = (recado_ate is null) and (recado is null) = (recado_em is null)),
  check (ativa = (desativada_em is null) and (desativada_em is null) = (desativada_por is null)
         and (desativada_em is null) = (motivo_desativacao is null))
);
create unique index etiquetas_local_ativo on etiquetas (condominio_id, lower(btrim(local))) where ativa;
call proteger_tabela_condominio('etiquetas');
create trigger etiquetas_sem_exclusao before delete on etiquetas for each row execute function somente_insercao();

-- Etiqueta desativada não volta; o número e a data de criação não mudam.
create function etiquetas_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not old.ativa then raise exception 'Etiqueta desativada não muda' using errcode = 'TC422'; end if;
  if (new.numero, new.criado_em, new.criado_por) is distinct from (old.numero, old.criado_em, old.criado_por) then
    raise exception 'O número da etiqueta não muda' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger etiquetas_regras before update on etiquetas for each row execute function etiquetas_regras();

-- Aberturas de cada etiqueta por dia, sem saber quem abriu.
create table etiqueta_aberturas (
  condominio_id uuid not null references condominios (id) on delete restrict,
  etiqueta_id   uuid not null,
  dia           date not null,
  vezes         integer not null default 1 check (vezes > 0),
  primary key (etiqueta_id, dia),
  foreign key (etiqueta_id, condominio_id) references etiquetas (id, condominio_id)
);
call proteger_tabela_condominio('etiqueta_aberturas');

-- ---------------------------------------------------------------------------------------
-- Link do prestador (V-11, MP-08).

create table links_prestador (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  manutencao_id      uuid not null,
  prestador_id       uuid,
  para               text not null check (length(btrim(para)) between 2 and 120),
  o_que_fazer        text not null check (length(btrim(o_que_fazer)) between 10 and 2000),
  quando             text check (length(btrim(quando)) between 2 and 120),
  como_entrar        text check (length(btrim(como_entrar)) between 2 and 500),
  arquivos           uuid[] not null default '{}' check (cardinality(arquivos) <= 10),
  expira_em          timestamptz not null,
  aberto_em          timestamptz,
  criado_em          timestamptz not null default app_now(),
  criado_por         uuid not null references pessoas (id),
  revogado_em        timestamptz,
  revogado_por       uuid references pessoas (id),
  motivo_revogacao   text check (length(btrim(motivo_revogacao)) between 3 and 500),
  unique (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  check (expira_em > criado_em),
  check ((revogado_em is null) = (motivo_revogacao is null) and (revogado_por is null or revogado_em is not null))
);
create unique index links_prestador_um_por_manutencao on links_prestador (manutencao_id) where revogado_em is null;
call proteger_tabela_condominio('links_prestador');
create trigger links_prestador_sem_exclusao before delete on links_prestador for each row execute function somente_insercao();

-- O que foi combinado não muda; só a primeira abertura e o cancelamento, que não volta.
create function links_prestador_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.manutencao_id, new.prestador_id, new.para, new.o_que_fazer, new.quando, new.como_entrar,
      new.arquivos, new.expira_em, new.criado_em, new.criado_por)
     is distinct from
     (old.id, old.condominio_id, old.manutencao_id, old.prestador_id, old.para, old.o_que_fazer, old.quando, old.como_entrar,
      old.arquivos, old.expira_em, old.criado_em, old.criado_por) then
    raise exception 'O link do prestador não muda: mande um link novo' using errcode = 'TC422';
  end if;
  if old.revogado_em is not null and (new.revogado_em, new.revogado_por, new.motivo_revogacao)
     is distinct from (old.revogado_em, old.revogado_por, old.motivo_revogacao) then
    raise exception 'O link já foi cancelado' using errcode = 'TC422';
  end if;
  if old.aberto_em is not null and new.aberto_em is distinct from old.aberto_em then
    raise exception 'A primeira abertura não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger links_prestador_regras before update on links_prestador for each row execute function links_prestador_regras();

-- O que o prestador manda pelo link: chegada, não consegui fazer e terminei. Nada se apaga.
create table registros_prestador (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  link_id          uuid not null,
  manutencao_id    uuid not null,
  tipo             text not null check (tipo in ('CHEGOU', 'IMPEDIMENTO', 'TERMINOU')),
  etiqueta_id      uuid,
  confirmado       boolean,
  impedimento      text check (impedimento in ('SEM_ACESSO', 'FALTA_PECA', 'OUTRO_SERVICO', 'OUTRO')),
  texto            text check (length(btrim(texto)) between 3 and 2000),
  ficou_pendente   boolean,
  pendente_texto   text check (length(btrim(pendente_texto)) between 3 and 500),
  quem_fez         text check (length(btrim(quem_fez)) between 2 and 120),
  criado_em        timestamptz not null default app_now(),
  unique (id, condominio_id),
  foreign key (link_id, condominio_id) references links_prestador (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (etiqueta_id, condominio_id) references etiquetas (id, condominio_id),
  check ((tipo = 'CHEGOU') = (confirmado is not null)),
  check (etiqueta_id is null or tipo = 'CHEGOU'),
  check ((tipo = 'IMPEDIMENTO') = (impedimento is not null)),
  check (tipo = 'CHEGOU' or texto is not null),
  check ((tipo = 'TERMINOU') = (ficou_pendente is not null)),
  check (pendente_texto is null or ficou_pendente),
  check (quem_fez is null or tipo = 'TERMINOU')
);
create index registros_prestador_m on registros_prestador (manutencao_id, criado_em);
call proteger_tabela_condominio('registros_prestador');
create trigger registros_prestador_sem_exclusao before delete on registros_prestador for each row execute function somente_insercao();
create trigger registros_prestador_sem_mudanca before update on registros_prestador for each row execute function somente_insercao();

-- Fotos que o prestador manda pelo link (regras de 0100), no bucket "manutencoes". Ficam
-- soltas até irem junto de um "não consegui fazer" ou de um "terminei".
create table arquivos_prestador (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  link_id           uuid not null,
  manutencao_id     uuid not null,
  registro_id       uuid,
  nome              text not null check (length(btrim(nome)) between 1 and 200),
  tipo              text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_declarado integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null unique,
  situacao          text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa     text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em        timestamptz not null default app_now(),
  verificado_em     timestamptz,
  retirado_em       timestamptz,
  retirado_por      uuid references pessoas (id),
  motivo_retirada   text check (length(btrim(motivo_retirada)) between 3 and 500),
  foreign key (link_id, condominio_id) references links_prestador (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (registro_id, condominio_id) references registros_prestador (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check (registro_id is null or situacao = 'LIBERADO'),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_prestador_link on arquivos_prestador (link_id, enviado_em);
create index arquivos_prestador_registro on arquivos_prestador (registro_id) where registro_id is not null;
call proteger_tabela_condominio('arquivos_prestador');
create trigger arquivos_prestador_sem_exclusao before delete on arquivos_prestador for each row execute function somente_insercao();

create function arquivos_prestador_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.link_id, new.manutencao_id, new.nome, new.tipo, new.tamanho_declarado, new.caminho, new.enviado_em)
     is distinct from
     (old.id, old.condominio_id, old.link_id, old.manutencao_id, old.nome, old.tipo, old.tamanho_declarado, old.caminho, old.enviado_em) then
    raise exception 'A foto do prestador não muda depois de enviada' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
     is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'A foto já foi verificada' using errcode = 'TC422';
  end if;
  if old.registro_id is not null and new.registro_id is distinct from old.registro_id then
    raise exception 'A foto já foi enviada junto de um registro' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'A foto já foi tirada da manutenção' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger arquivos_prestador_regras before update on arquivos_prestador for each row execute function arquivos_prestador_regras();

-- Avisos no sino do responsável quando o prestador manda algo.
create table avisos_prestador (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  registro_id   uuid not null,
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (registro_id, condominio_id) references registros_prestador (id, condominio_id),
  unique (pessoa_id, registro_id)
);
create index avisos_prestador_pessoa on avisos_prestador (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_prestador');
create trigger avisos_prestador_sem_exclusao before delete on avisos_prestador for each row execute function somente_insercao();
create function avisos_prestador_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.registro_id, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.registro_id, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_prestador_regras before update on avisos_prestador for each row execute function avisos_prestador_regras();

insert into configuracoes (chave, valor, descricao) values
  ('limite_etiqueta_max',              '120', 'Etiquetas abertas pelo mesmo aparelho dentro da janela'),
  ('limite_etiqueta_janela_minutos',   '10',  'Janela das aberturas de etiqueta'),
  ('limite_prestador_max',             '120', 'Chamadas ao link do prestador pelo mesmo aparelho dentro da janela'),
  ('limite_prestador_janela_minutos',  '10',  'Janela do link do prestador');

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function etiqueta_rotulo(p_numero integer) returns text
language sql immutable
set search_path = public
as $$ select 'E' || lpad(p_numero::text, 2, '0') $$;

-- Novo código de etiqueta, que não se repete com nenhum outro link sem conta.
create function gerar_codigo_etiqueta(p_etiqueta uuid) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  loop
    v_codigo := novo_codigo_mural();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo))
          and not exists (select 1 from links_publicos where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), contexto_condominio(), 'ETIQUETA', p_etiqueta);
  return v_codigo;
end $$;

create function numero_whatsapp_condominio() returns text
language sql stable
set search_path = public
as $$ select numero_whatsapp from condominios where id = contexto_condominio() $$;

create function exigir_etiqueta(p_id uuid) returns etiquetas
language plpgsql
set search_path = public
as $$
declare v etiquetas;
begin
  select * into v from etiquetas where id = p_id;
  if not found then raise exception 'Etiqueta não encontrada' using errcode = 'TC404'; end if;
  return v;
end $$;

create function recado_vale(e etiquetas) returns boolean
language sql stable
set search_path = public
as $$ select e.recado is not null and e.recado_ate >= hoje_no_condominio() $$;

create function etiqueta_json(e etiquetas) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'numero', e.numero, 'rotulo', etiqueta_rotulo(e.numero), 'local', e.local, 'onde', e.onde, 'codigo', e.codigo,
    'recado', case when recado_vale(e) then e.recado end, 'recadoAte', case when recado_vale(e) then to_char(e.recado_ate, 'YYYY-MM-DD') end,
    'ativa', e.ativa, 'motivoDesativacao', e.motivo_desativacao, 'desativadaEm', e.desativada_em,
    'aberturas7', (select coalesce(sum(vezes), 0) from etiqueta_aberturas a where a.etiqueta_id = e.id and a.dia > hoje_no_condominio() - 7),
    'aberturasHoje', (select coalesce(sum(vezes), 0) from etiqueta_aberturas a where a.etiqueta_id = e.id and a.dia = hoje_no_condominio()),
    'semUso', case when e.ativa and e.criado_em < app_now() - interval '90 days'
                    and not exists (select 1 from etiqueta_aberturas a where a.etiqueta_id = e.id and a.dia > hoje_no_condominio() - 90)
                   then true end,
    'criadoEm', e.criado_em, 'versao', e.versao))
$$;

-- O link do prestador vale: não cancelado, dentro da data e com a manutenção aberta.
create function link_prestador_vale(l links_prestador) returns boolean
language sql stable
set search_path = public
as $$
  select l.revogado_em is null and l.expira_em > app_now()
     and exists (select 1 from manutencoes m where m.id = l.manutencao_id and m.estado not in ('CONCLUIDA', 'CANCELADA'))
$$;

create function link_prestador_situacao(l links_prestador) returns text
language sql stable
set search_path = public
as $$
  select case
    when l.revogado_em is not null then 'CANCELADO'
    when (select estado from manutencoes where id = l.manutencao_id) = 'CONCLUIDA' then 'CONCLUIDA'
    when (select estado from manutencoes where id = l.manutencao_id) = 'CANCELADA' then 'MANUTENCAO_CANCELADA'
    when l.expira_em <= app_now() then 'VENCIDO'
    else 'VALE' end
$$;

create function registro_prestador_json(r registros_prestador) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'tipo', r.tipo, 'confirmado', r.confirmado, 'impedimento', r.impedimento, 'texto', r.texto,
    'ficouPendente', r.ficou_pendente, 'pendenteTexto', r.pendente_texto, 'quemFez', r.quem_fez, 'em', r.criado_em,
    'etiqueta', (select jsonb_build_object('rotulo', etiqueta_rotulo(e.numero), 'local', e.local) from etiquetas e where e.id = r.etiqueta_id),
    'fotos', (select count(*) from arquivos_prestador a where a.registro_id = r.id and a.retirado_em is null)))
$$;

-- ---------------------------------------------------------------------------------------
-- Configurações › Links e QR: tudo o que abre sem conta.

create function plataforma_links_qr(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return (select jsonb_strip_nulls(jsonb_build_object(
    'numeroWhatsapp', numero_whatsapp_condominio(),
    'mural', jsonb_build_object('ligado', cfg.mural_ligado,
                                'aberturas', (select coalesce(sum(vezes), 0) from mural_aberturas where dia > hoje_no_condominio() - 7)),
    'etiquetas', coalesce((select jsonb_agg(etiqueta_json(e) order by e.ativa desc, e.numero) from etiquetas e), '[]'::jsonb),
    'prestador', jsonb_build_object(
      'validos', (select count(*) from links_prestador l where link_prestador_vale(l)),
      'venceEm', (select min(l.expira_em) from links_prestador l where link_prestador_vale(l)),
      'links', case when pode(p_pessoa, p_condominio, 'manutencao.ver') then coalesce((
        select jsonb_agg(jsonb_build_object('id', l.id, 'manutencaoId', l.manutencao_id, 'titulo', m.titulo, 'para', l.para,
                                            'expiraEm', l.expira_em) order by l.expira_em)
          from links_prestador l join manutencoes m on m.id = l.manutencao_id where link_prestador_vale(l)), '[]'::jsonb) end),
    'documentos', jsonb_build_object(
      'validos', (select count(*) from links_publicos l where l.tipo = 'DOCUMENTO' and link_vale(l)),
      'venceEm', (select max(l.expira_em) from links_publicos l where l.tipo = 'DOCUMENTO' and link_vale(l))),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar')))
    from configuracao_condominio cfg);
end $$;

create function plataforma_etiqueta(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e etiquetas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  e := exigir_etiqueta(p_id);
  return jsonb_build_object(
    'etiqueta', etiqueta_json(e),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                          'dados', h.dados) order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'etiquetas' and h.entidade_id = e.id::text), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar') and e.ativa);
end $$;

-- Criar ou alterar uma etiqueta: local, onde fica e o recado.
create function plataforma_salvar_etiqueta(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_local text,
                                           p_onde text, p_recado text, p_recado_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text := btrim(coalesce(p_local, ''));
  v_onde text := nullif(btrim(coalesce(p_onde, '')), '');
  v_recado text := nullif(btrim(coalesce(p_recado, '')), '');
  v_antes etiquetas;
  v_id uuid;
  v_numero integer;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if length(v_local) not between 2 and 120 then perform recusar_campos('Local de 2 a 120 caracteres', 'local'); end if;
  if length(v_onde) not between 2 and 120 then perform recusar_campos('Onde fica de 2 a 120 caracteres', 'onde'); end if;
  if length(v_recado) not between 3 and 300 then perform recusar_campos('Recado de 3 a 300 caracteres', 'recado'); end if;
  if v_recado is not null and (p_recado_ate is null or p_recado_ate < hoje_no_condominio() or p_recado_ate > hoje_no_condominio() + 30) then
    perform recusar_campos('O recado some entre hoje e daqui a 30 dias', 'recadoAte');
  end if;
  if exists (select 1 from etiquetas where ativa and lower(btrim(local)) = lower(v_local) and id is distinct from p_id) then
    perform recusar_motivo('Já existe uma etiqueta para este local', 'LOCAL_REPETIDO');
  end if;

  if p_id is null then
    if numero_whatsapp_condominio() is null then
      perform recusar_motivo('O condomínio ainda não tem número de WhatsApp cadastrado', 'SEM_NUMERO_WHATSAPP');
    end if;
    perform 1 from condominios where id = p_condominio for update;
    select coalesce(max(numero), 0) + 1 into v_numero from etiquetas;
    if v_numero > 999 then perform recusar_motivo('O condomínio já tem 999 etiquetas', 'LIMITE_ETIQUETAS'); end if;
    v_id := gen_random_uuid();
    insert into etiquetas (id, condominio_id, numero, local, onde, codigo, recado, recado_ate, recado_em, criado_por)
    values (v_id, p_condominio, v_numero, v_local, v_onde, gerar_codigo_etiqueta(v_id), v_recado,
            case when v_recado is not null then p_recado_ate end, case when v_recado is not null then app_now() end, p_pessoa)
    returning versao into v_versao;
    perform registrar_historico('etiqueta.criada', 'etiquetas', v_id::text, jsonb_build_object('numero', v_numero, 'local', v_local));
    if v_recado is not null then
      perform registrar_historico('etiqueta.recado', 'etiquetas', v_id::text, jsonb_build_object('recado', v_recado, 'ate', p_recado_ate));
    end if;
    return jsonb_build_object('id', v_id, 'versao', v_versao);
  end if;

  v_antes := exigir_etiqueta(p_id);
  if not v_antes.ativa then perform recusar_motivo('Etiqueta desativada não muda', 'ETIQUETA_DESATIVADA'); end if;
  update etiquetas
     set local = v_local, onde = v_onde, recado = v_recado,
         recado_ate = case when v_recado is not null then p_recado_ate end,
         recado_em = case when v_recado is null then null
                          when v_recado is distinct from v_antes.recado or p_recado_ate is distinct from v_antes.recado_ate then app_now()
                          else v_antes.recado_em end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('etiquetas', p_id); end if;
  if v_local is distinct from v_antes.local or v_onde is distinct from v_antes.onde then
    perform registrar_historico('etiqueta.alterada', 'etiquetas', p_id::text, jsonb_strip_nulls(jsonb_build_object(
      'localAntes', case when v_local is distinct from v_antes.local then v_antes.local end,
      'local', case when v_local is distinct from v_antes.local then v_local end,
      'ondeMudou', case when v_onde is distinct from v_antes.onde then true end)));
  end if;
  if v_recado is distinct from v_antes.recado or (v_recado is not null and p_recado_ate is distinct from v_antes.recado_ate) then
    perform registrar_historico(case when v_recado is null then 'etiqueta.recado_tirado' else 'etiqueta.recado' end, 'etiquetas', p_id::text,
      jsonb_strip_nulls(jsonb_build_object('recado', v_recado, 'ate', case when v_recado is not null then p_recado_ate end)));
  end if;
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- Trocar o código: a etiqueta colada para na hora.
create function plataforma_trocar_codigo_etiqueta(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e etiquetas;
  v_motivo text;
  v_codigo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  e := exigir_etiqueta(p_id);
  if not e.ativa then perform recusar_motivo('Etiqueta desativada não muda', 'ETIQUETA_DESATIVADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update codigos_sem_conta set revogado_em = app_now() where hash = hash_codigo(e.codigo) and revogado_em is null;
  v_codigo := gerar_codigo_etiqueta(e.id);
  update etiquetas set codigo = v_codigo where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('etiquetas', p_id); end if;
  perform registrar_historico('etiqueta.codigo_trocado', 'etiquetas', p_id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao, 'codigo', v_codigo);
end $$;

create function plataforma_desativar_etiqueta(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e etiquetas;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  e := exigir_etiqueta(p_id);
  if not e.ativa then perform recusar_motivo('A etiqueta já está desativada', 'ETIQUETA_DESATIVADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update codigos_sem_conta set revogado_em = app_now() where hash = hash_codigo(e.codigo) and revogado_em is null;
  update etiquetas set ativa = false, desativada_em = app_now(), desativada_por = p_pessoa, motivo_desativacao = v_motivo,
                       recado = null, recado_ate = null, recado_em = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('etiquetas', p_id); end if;
  perform registrar_historico('etiqueta.desativada', 'etiquetas', p_id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Os locais das etiquetas, para sugerir no campo Local de pedidos, manutenção e agenda.
create function plataforma_locais(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  return coalesce((select jsonb_agg(e.local order by lower(e.local)) from etiquetas e where e.ativa), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Link do prestador na manutenção.

create function plataforma_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  l links_prestador;
  v_editar boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  m := exigir_manutencao(p_manutencao);
  v_editar := pode(p_pessoa, p_condominio, 'manutencao.editar');
  select * into l from links_prestador where manutencao_id = m.id order by criado_em desc, id desc limit 1;
  return jsonb_strip_nulls(jsonb_build_object(
    'link', case when l.id is not null then jsonb_strip_nulls(jsonb_build_object(
      'id', l.id, 'para', l.para, 'oQueFazer', l.o_que_fazer, 'quando', l.quando, 'comoEntrar', l.como_entrar,
      'expiraEm', l.expira_em, 'abertoEm', l.aberto_em, 'criadoEm', l.criado_em, 'criadoPor', (select nome from pessoas where id = l.criado_por),
      'situacao', link_prestador_situacao(l), 'motivoCancelamento', l.motivo_revogacao)) end,
    'registros', coalesce((
      select jsonb_agg(registro_prestador_json(r) order by r.criado_em desc, r.id desc)
        from registros_prestador r where r.manutencao_id = m.id), '[]'::jsonb),
    'fotos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'registroId', a.registro_id, 'enviadoEm', a.enviado_em)
                       order by a.enviado_em, a.id)
        from arquivos_prestador a where a.manutencao_id = m.id and a.situacao = 'LIBERADO' and a.registro_id is not null
                                    and a.retirado_em is null), '[]'::jsonb),
    'para', case when m.prestador_id is not null then (
               select jsonb_strip_nulls(jsonb_build_object('nome', x.nome, 'telefone', x.telefone, 'email', x.email))
                 from prestadores x where x.id = m.prestador_id)
             when m.executor_texto is not null then jsonb_build_object('nome', m.executor_texto) end,
    'local', m.local,
    'sugestao', jsonb_strip_nulls(jsonb_build_object('oQueFazer', m.titulo || '. Local: ' || m.local || '.')),
    'etiqueta', (select jsonb_build_object('rotulo', etiqueta_rotulo(e.numero), 'local', e.local) from etiquetas e
                  where e.ativa and lower(btrim(e.local)) = lower(btrim(m.local))),
    'arquivos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
        from arquivos_manutencao a where a.manutencao_id = m.id and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb),
    'pode', jsonb_build_object(
      'mandar', v_editar and m.estado not in ('CONCLUIDA', 'CANCELADA') and (m.prestador_id is not null or m.executor_texto is not null),
      'cancelar', v_editar and l.id is not null and l.revogado_em is null),
    'semExecutor', case when m.prestador_id is null and m.executor_texto is null then true end));
end $$;

-- Mandar link ao prestador. O link anterior da manutenção para; o código volta só agora.
create function plataforma_criar_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_versao integer,
                                                p_o_que_fazer text, p_quando text, p_como_entrar text, p_vale_ate date,
                                                p_arquivos uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_o_que text := btrim(coalesce(p_o_que_fazer, ''));
  v_quando text := nullif(btrim(coalesce(p_quando, '')), '');
  v_como text := nullif(btrim(coalesce(p_como_entrar, '')), '');
  v_arquivos uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_arquivos, '{}')) x), '{}');
  v_para text;
  v_id uuid := gen_random_uuid();
  v_codigo text := novo_codigo();
  v_expira timestamptz;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  m := exigir_manutencao(p_manutencao);
  perform exigir_manutencao_aberta(m);
  if m.prestador_id is not null then
    select nome into v_para from prestadores where id = m.prestador_id;
  elsif m.executor_texto is not null then
    v_para := m.executor_texto;
  else
    perform recusar_motivo('Escolha antes quem executa: um prestador ou um nome', 'SEM_EXECUTOR');
  end if;
  if length(v_o_que) not between 10 and 2000 then perform recusar_campos('O que fazer de 10 a 2.000 caracteres', 'oQueFazer'); end if;
  if length(v_quando) not between 2 and 120 then perform recusar_campos('Quando de 2 a 120 caracteres', 'quando'); end if;
  if length(v_como) not between 2 and 500 then perform recusar_campos('Como entrar de 2 a 500 caracteres', 'comoEntrar'); end if;
  if p_vale_ate is null or p_vale_ate < hoje_no_condominio() or p_vale_ate > hoje_no_condominio() + 60 then
    perform recusar_campos('O link vale de hoje até daqui a 60 dias', 'valeAte');
  end if;
  if cardinality(v_arquivos) > 10 then perform recusar_campos('No máximo 10 arquivos', 'arquivos'); end if;
  if exists (select 1 from unnest(v_arquivos) x where not exists (
               select 1 from arquivos_manutencao a where a.id = x and a.manutencao_id = m.id and a.situacao = 'LIBERADO' and a.retirado_em is null)) then
    perform recusar_campos('Arquivo que não é desta manutenção', 'arquivos');
  end if;
  v_versao := tocar_manutencao(m.id, p_versao);
  -- O fim do dia escolhido, no fuso do condomínio.
  v_expira := ((p_vale_ate + 1)::timestamp at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'));
  update links_prestador set revogado_em = app_now(), revogado_por = p_pessoa, motivo_revogacao = 'Mandado um link novo'
   where manutencao_id = m.id and revogado_em is null;
  update codigos_sem_conta set revogado_em = app_now()
   where tipo = 'PRESTADOR' and revogado_em is null and alvo_id in (select id from links_prestador where manutencao_id = m.id);
  insert into links_prestador (id, condominio_id, manutencao_id, prestador_id, para, o_que_fazer, quando, como_entrar, arquivos, expira_em, criado_por)
  values (v_id, p_condominio, m.id, m.prestador_id, v_para, v_o_que, v_quando, v_como, v_arquivos, v_expira, p_pessoa);
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), p_condominio, 'PRESTADOR', v_id);
  perform registrar_historico('manutencao.link_prestador', 'manutencoes', m.id::text, jsonb_build_object(
    'link', v_id, 'para', v_para, 'ate', p_vale_ate, 'arquivos', cardinality(v_arquivos)));
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'versao', v_versao, 'expiraEm', v_expira);
end $$;

-- Por onde o link saiu (copiado, WhatsApp de quem mandou ou e-mail de quem mandou): só histórico.
create function plataforma_envio_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_link uuid, p_canal text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare l links_prestador;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  perform exigir_manutencao(p_manutencao);
  if p_canal is null or p_canal not in ('COPIADO', 'WHATSAPP', 'EMAIL') then perform recusar_campos('Canal desconhecido', 'canal'); end if;
  select * into l from links_prestador where id = p_link and manutencao_id = p_manutencao;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico('manutencao.link_prestador_enviado', 'manutencoes', p_manutencao::text,
    jsonb_build_object('link', l.id, 'canal', p_canal));
  return jsonb_build_object('ok', true);
end $$;

create function plataforma_cancelar_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_link uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  perform exigir_manutencao(p_manutencao);
  select * into l from links_prestador where id = p_link and manutencao_id = p_manutencao;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  if l.revogado_em is not null then perform recusar_motivo('O link já foi cancelado', 'LINK_CANCELADO'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update links_prestador set revogado_em = app_now(), revogado_por = p_pessoa, motivo_revogacao = v_motivo where id = l.id;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'PRESTADOR' and alvo_id = l.id and revogado_em is null;
  perform registrar_historico('manutencao.link_prestador_cancelado', 'manutencoes', p_manutencao::text,
    jsonb_build_object('link', l.id, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

create function plataforma_abrir_foto_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_prestador;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  perform exigir_manutencao(p_manutencao);
  select * into a from arquivos_prestador where id = p_arquivo and manutencao_id = p_manutencao and situacao = 'LIBERADO'
                                            and registro_id is not null and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

create function plataforma_tirar_foto_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_arquivo uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a arquivos_prestador;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  perform exigir_manutencao(p_manutencao);
  select * into a from arquivos_prestador where id = p_arquivo and manutencao_id = p_manutencao and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_prestador set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  perform registrar_historico('manutencao.foto_prestador_tirada', 'manutencoes', p_manutencao::text,
    jsonb_build_object('arquivo', a.id, 'arquivoNome', a.nome, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Avisos no sino: o que o prestador manda.

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
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_prestador a where a.pessoa_id = p_pessoa and a.visto_em is null)))
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_prestador where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer; v_r integer;
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
  return v_n + v_m + v_d + v_e + v_p + v_r;
end $$;

-- ---------------------------------------------------------------------------------------
-- Sem conta: a página da etiqueta e o link do prestador. Funções chamadas pela API sem sessão;
-- cada uma entra só no condomínio do código.

-- A etiqueta como quem aponta a câmera vê: condomínio, local, código curto, recado e o número
-- do WhatsApp do condomínio. Conta a abertura.
create function publico_etiqueta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l codigos_sem_conta;
  e etiquetas;
  v_nome text;
begin
  l := entrar_por_codigo(upper(p_codigo), 'ETIQUETA');
  select nome into v_nome from condominios where id = l.condominio_id;
  select * into e from etiquetas where id = l.alvo_id;
  if l.revogado_em is not null or not e.ativa or e.codigo is distinct from upper(p_codigo) then
    return jsonb_build_object('condominio', v_nome, 'foraDeUso', true);
  end if;
  insert into etiqueta_aberturas (condominio_id, etiqueta_id, dia) values (l.condominio_id, e.id, hoje_no_condominio())
  on conflict (etiqueta_id, dia) do update set vezes = etiqueta_aberturas.vezes + 1;
  return jsonb_strip_nulls(jsonb_build_object(
    'condominio', v_nome, 'local', e.local, 'rotulo', etiqueta_rotulo(e.numero),
    'recado', case when recado_vale(e) then e.recado end,
    'recadoEm', case when recado_vale(e) then e.recado_em end,
    'whatsapp', ltrim(numero_whatsapp_condominio(), '+')));
end $$;

-- O link do prestador que alguém abriu, ainda valendo.
create function exigir_link_prestador(p_codigo text) returns links_prestador
language plpgsql
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_prestador;
begin
  c := entrar_por_codigo(p_codigo, 'PRESTADOR');
  select * into l from links_prestador where id = c.alvo_id;
  if c.revogado_em is not null or not link_prestador_vale(l) then
    perform recusar_motivo('Este link não vale mais', 'LINK_ENCERRADO');
  end if;
  return l;
end $$;

create function publico_prestador(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_prestador;
  m manutencoes;
  v_nome text;
begin
  c := entrar_por_codigo(p_codigo, 'PRESTADOR');
  select * into l from links_prestador where id = c.alvo_id;
  select nome into v_nome from condominios where id = c.condominio_id;
  if c.revogado_em is not null or not link_prestador_vale(l) then
    return jsonb_build_object('condominio', v_nome, 'encerrado', true,
      'motivo', case when c.revogado_em is not null and l.revogado_em is null then 'CANCELADO' else link_prestador_situacao(l) end);
  end if;
  select * into m from manutencoes where id = l.manutencao_id;
  if l.aberto_em is null then
    update links_prestador set aberto_em = app_now() where id = l.id;
    perform registrar_historico('manutencao.link_prestador_aberto', 'manutencoes', m.id::text, jsonb_build_object('link', l.id));
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'condominio', v_nome, 'para', l.para, 'tipo', m.tipo, 'titulo', m.titulo, 'local', m.local,
    'oQueFazer', l.o_que_fazer, 'quando', l.quando, 'comoEntrar', l.como_entrar, 'expiraEm', l.expira_em,
    'arquivos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
        from arquivos_manutencao a where a.id = any (l.arquivos) and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb),
    'registros', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('tipo', r.tipo, 'confirmado', r.confirmado, 'em', r.criado_em,
                         'etiqueta', (select etiqueta_rotulo(e.numero) from etiquetas e where e.id = r.etiqueta_id)))
                       order by r.criado_em desc, r.id desc)
        from registros_prestador r where r.link_id = l.id), '[]'::jsonb)));
end $$;

create function publico_prestador_arquivo(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  a arquivos_manutencao;
begin
  l := exigir_link_prestador(p_codigo);
  if not p_arquivo = any (l.arquivos) then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  select * into a from arquivos_manutencao where id = p_arquivo and manutencao_id = l.manutencao_id and situacao = 'LIBERADO' and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Avisa no sino quem é responsável pela manutenção (uma vez por registro).
create function avisar_registro_prestador(r registros_prestador) returns void
language plpgsql
set search_path = public
as $$
declare v_pessoa uuid;
begin
  select pessoa_do_vinculo(m.responsavel_id) into v_pessoa from manutencoes m where m.id = r.manutencao_id;
  if v_pessoa is not null then
    insert into avisos_prestador (condominio_id, pessoa_id, registro_id) values (r.condominio_id, v_pessoa, r.id)
    on conflict (pessoa_id, registro_id) do nothing;
  end if;
end $$;

-- Chegada (MP-08). A etiqueta lida confirma só se for do local da manutenção.
create function publico_prestador_chegada(p_codigo text, p_etiqueta text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  m manutencoes;
  e etiquetas;
  v_lida uuid;
  v_confirmado boolean := false;
  r registros_prestador;
begin
  l := exigir_link_prestador(p_codigo);
  select * into m from manutencoes where id = l.manutencao_id;
  if p_etiqueta is not null and upper(p_etiqueta) ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' then
    select * into e from etiquetas where codigo = upper(p_etiqueta) and ativa;
    if found then
      v_lida := e.id;
      v_confirmado := lower(btrim(e.local)) = lower(btrim(m.local));
    end if;
  end if;
  if (select count(*) from registros_prestador where link_id = l.id and tipo = 'CHEGOU') >= 20 then
    perform recusar_motivo('Chegada já registrada muitas vezes neste link', 'LIMITE_REGISTROS');
  end if;
  insert into registros_prestador (condominio_id, link_id, manutencao_id, tipo, etiqueta_id, confirmado)
  values (l.condominio_id, l.id, m.id, 'CHEGOU', v_lida, v_confirmado) returning * into r;
  perform registrar_historico('manutencao.prestador_chegou', 'manutencoes', m.id::text, jsonb_strip_nulls(jsonb_build_object(
    'link', l.id, 'registro', r.id, 'confirmado', v_confirmado,
    'etiqueta', case when v_lida is not null then etiqueta_rotulo(e.numero) end)));
  return jsonb_strip_nulls(jsonb_build_object('confirmado', v_confirmado, 'em', r.criado_em,
    'etiqueta', case when v_lida is not null then jsonb_build_object('rotulo', etiqueta_rotulo(e.numero), 'local', e.local) end,
    'etiquetaLida', p_etiqueta is not null));
end $$;

-- Foto do prestador: o mesmo caminho dos arquivos dos pedidos (iniciar, enviar, verificar).
create function publico_prestador_iniciar_foto(p_codigo text, p_nome text, p_tipo text, p_tamanho integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  l := exigir_link_prestador(p_codigo);
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP)', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from links_prestador where id = l.id for update;
  if (select count(*) from arquivos_prestador where link_id = l.id) >= 30 then
    perform recusar_motivo('Este link já recebeu 30 fotos', 'LIMITE_ARQUIVOS');
  end if;
  v_caminho := l.condominio_id || '/' || l.manutencao_id || '/prestador/' || v_id;
  insert into arquivos_prestador (id, condominio_id, link_id, manutencao_id, nome, tipo, tamanho_declarado, caminho)
  values (v_id, l.condominio_id, l.id, l.manutencao_id, btrim(p_nome), p_tipo, p_tamanho, v_caminho);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function publico_prestador_foto_a_verificar(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  a arquivos_prestador;
begin
  l := exigir_link_prestador(p_codigo);
  select * into a from arquivos_prestador where id = p_arquivo and link_id = l.id;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function publico_prestador_verificar_foto(p_codigo text, p_arquivo uuid, p_liberado boolean, p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  a arquivos_prestador;
begin
  l := exigir_link_prestador(p_codigo);
  select * into a from arquivos_prestador where id = p_arquivo and link_id = l.id;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_prestador set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
  else
    update arquivos_prestador set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

-- Junta as fotos liberadas deste link ao registro.
create function prender_fotos_prestador(p_link uuid, p_registro uuid, p_fotos uuid[]) returns integer
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  if cardinality(coalesce(p_fotos, '{}')) > 10 then perform recusar_campos('No máximo 10 fotos', 'fotos'); end if;
  if exists (select 1 from unnest(coalesce(p_fotos, '{}')) x where not exists (
               select 1 from arquivos_prestador a where a.id = x and a.link_id = p_link and a.situacao = 'LIBERADO' and a.registro_id is null)) then
    perform recusar_campos('Foto que não chegou ou já foi enviada', 'fotos');
  end if;
  update arquivos_prestador set registro_id = p_registro where id = any (coalesce(p_fotos, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function publico_prestador_impedimento(p_codigo text, p_impedimento text, p_texto text, p_fotos uuid[]) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  v_texto text := btrim(coalesce(p_texto, ''));
  r registros_prestador;
  v_fotos integer;
begin
  l := exigir_link_prestador(p_codigo);
  if p_impedimento is null or p_impedimento not in ('SEM_ACESSO', 'FALTA_PECA', 'OUTRO_SERVICO', 'OUTRO') then
    perform recusar_campos('Diga o que aconteceu', 'impedimento');
  end if;
  if length(v_texto) not between 3 and 2000 then perform recusar_campos('Conte em poucas palavras (de 3 a 2.000 caracteres)', 'texto'); end if;
  if (select count(*) from registros_prestador where link_id = l.id and tipo <> 'CHEGOU') >= 20 then
    perform recusar_motivo('Este link já recebeu muitos registros', 'LIMITE_REGISTROS');
  end if;
  insert into registros_prestador (condominio_id, link_id, manutencao_id, tipo, impedimento, texto)
  values (l.condominio_id, l.id, l.manutencao_id, 'IMPEDIMENTO', p_impedimento, v_texto) returning * into r;
  v_fotos := prender_fotos_prestador(l.id, r.id, p_fotos);
  perform registrar_historico('manutencao.prestador_impedimento', 'manutencoes', l.manutencao_id::text, jsonb_build_object(
    'link', l.id, 'registro', r.id, 'impedimento', p_impedimento, 'texto', v_texto, 'fotos', v_fotos));
  perform avisar_registro_prestador(r);
  return jsonb_build_object('ok', true, 'em', r.criado_em);
end $$;

create function publico_prestador_terminei(p_codigo text, p_texto text, p_ficou_pendente boolean, p_pendente_texto text,
                                           p_quem_fez text, p_fotos uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_pendente text := nullif(btrim(coalesce(p_pendente_texto, '')), '');
  v_quem text := nullif(btrim(coalesce(p_quem_fez, '')), '');
  r registros_prestador;
  v_fotos integer;
begin
  l := exigir_link_prestador(p_codigo);
  if length(v_texto) not between 3 and 2000 then perform recusar_campos('O que foi feito, de 3 a 2.000 caracteres', 'texto'); end if;
  if p_ficou_pendente is null then perform recusar_campos('Diga se ficou algo para depois', 'ficouPendente'); end if;
  if p_ficou_pendente and length(coalesce(v_pendente, '')) not between 3 and 500 then
    perform recusar_campos('Diga o que ficou para depois (de 3 a 500 caracteres)', 'pendenteTexto');
  end if;
  if length(v_quem) not between 2 and 120 then perform recusar_campos('Quem fez, de 2 a 120 caracteres', 'quemFez'); end if;
  if (select count(*) from registros_prestador where link_id = l.id and tipo <> 'CHEGOU') >= 20 then
    perform recusar_motivo('Este link já recebeu muitos registros', 'LIMITE_REGISTROS');
  end if;
  insert into registros_prestador (condominio_id, link_id, manutencao_id, tipo, texto, ficou_pendente, pendente_texto, quem_fez)
  values (l.condominio_id, l.id, l.manutencao_id, 'TERMINOU', v_texto, p_ficou_pendente,
          case when p_ficou_pendente then v_pendente end, v_quem) returning * into r;
  v_fotos := prender_fotos_prestador(l.id, r.id, p_fotos);
  perform registrar_historico('manutencao.prestador_terminou', 'manutencoes', l.manutencao_id::text, jsonb_strip_nulls(jsonb_build_object(
    'link', l.id, 'registro', r.id, 'texto', v_texto, 'ficouPendente', p_ficou_pendente,
    'pendente', case when p_ficou_pendente then v_pendente end, 'fotos', v_fotos)));
  perform avisar_registro_prestador(r);
  return jsonb_build_object('ok', true, 'em', r.criado_em);
end $$;

call fechar_acesso();

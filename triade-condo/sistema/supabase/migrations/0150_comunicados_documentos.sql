-- 0150 · Comunicados e documentos (peça R1; CD-01, CD-02, CD-04, CD-05, CD-06 em parte, CD-07,
-- CD-09, CD-11 e MP-12 em parte). Telas e decisões aprovadas pela Carolina em 18/10/2026
-- (docs/telas/comunicados.html).
--
-- Regras desta parte:
-- 1. Permissões (CF-03, CD-04): Ver comunicados e documentos (nova) vê tudo, menos os documentos
--    restritos. Publicar (já existia) escreve, publica, programa, corrige e arquiva comunicados.
--    Cuidar dos documentos (nova) guarda, troca versão, arquiva e vê os restritos. O síndico tem
--    as três.
-- 2. Ciclo do comunicado (CD-01): rascunho, programado, publicado, substituído e arquivado.
--    Publicado não se edita: corrigir pede o que mudou e cria a versão seguinte, e a anterior
--    fica como substituída, com o texto guardado. Arquivar pede motivo. Nada é apagado.
-- 3. Para quem (CD-02): todo o condomínio, blocos, unidades ou contatos escolhidos. Recebe quem
--    tem vínculo confirmado e "recebe comunicados" ligado; assembleia e convocação inclui o
--    proprietário que não recebe o dia a dia. A conta é refeita sempre (a cada envio, quando o
--    WhatsApp chegar); na publicação fica guardado quantos eram.
-- 4. Como chega agora: copiar o texto e a versão para o mural ficam no histórico. O envio pelo
--    WhatsApp (CD-08) chega com o passo 5; os publicados antes não são reenviados sozinhos.
-- 5. Programar (CD-06): dia e hora no futuro; a rotina de 5 minutos publica. Até lá dá para
--    mudar ou voltar a rascunho.
-- 6. Fotos e PDF (CD-09): até 4 por comunicado, com as regras dos pedidos, no bucket privado
--    "comunicados". Ficam com o comunicado em todas as versões.
-- 7. Ligar a pedido ou manutenção (CD-05): opcional, no mesmo condomínio. Comunicar o prédio
--    não conta como retorno ao morador do pedido.
-- 8. Documentos e versões (CD-07, CD-04): tipos fixos; cada documento tem a versão em vigor e as
--    anteriores, com o que mudou, a data em que passa a valer e onde foi aprovado. PDF ou foto
--    até 20 MB no bucket privado "documentos"; abrir e baixar ficam no histórico.
-- 9. Quem vê cada documento: a gestão ou só quem cuida dos documentos (restrito). A marca
--    "pode ir ao morador" fica guardada para o passo 5 (CD-03).
-- 10. Validade (MP-12): a 60 dias do fim, o documento aparece no início e avisa no sino quem
--    cuida dos documentos, uma vez por data.
-- 11. Plano de comunicação (CD-11): assuntos em uso, o combinado com os moradores, a assinatura
--    padrão e o horário sem envio, nas Configurações.

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_COMUNICADOS', 'Ver comunicados e documentos', 'Ver os comunicados e os documentos do condomínio, menos os restritos.', 13),
  ('DOCUMENTOS', 'Cuidar dos documentos', 'Guardar documentos, trocar versões, arquivar e ver os documentos restritos.', 14);
insert into permissao_acoes (permissao, acao) values
  ('VER_COMUNICADOS', 'comunicados.ver'),
  ('VER_COMUNICADOS', 'documentos.ver'),
  ('PUBLICAR', 'comunicados.ver'),
  ('PUBLICAR', 'comunicados.publicar'),
  ('DOCUMENTOS', 'documentos.ver'),
  ('DOCUMENTOS', 'documentos.editar'),
  ('DOCUMENTOS', 'documentos.restritos');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'comunicados.ver'),
  ('SINDICO', 'comunicados.publicar'),
  ('SINDICO', 'documentos.ver'),
  ('SINDICO', 'documentos.editar'),
  ('SINDICO', 'documentos.restritos');

-- ---------------------------------------------------------------------------------------
-- Plano de comunicação do condomínio (CD-11).

alter table configuracao_condominio
  add column comunicados_assuntos   text[] not null default array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE']
    check (cardinality(comunicados_assuntos) between 1 and 5
           and comunicados_assuntos <@ array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE']),
  add column comunicados_plano      text check (length(btrim(comunicados_plano)) between 1 and 2000),
  add column comunicados_assinatura text check (length(btrim(comunicados_assinatura)) between 2 and 120),
  add column comunicados_silencio_inicio time not null default '21:00',
  add column comunicados_silencio_fim    time not null default '08:00';

-- ---------------------------------------------------------------------------------------
-- Comunicados (CD-01, CD-02, CD-05, CD-06).

create table comunicados (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  -- A primeira versão; todas as versões do mesmo comunicado têm a mesma família.
  familia_id       uuid not null,
  numero           smallint not null default 1 check (numero between 1 and 500),
  anterior_id      uuid,
  assunto          text not null check (assunto in ('AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE')),
  titulo           text not null check (length(btrim(titulo)) between 3 and 120),
  texto            text not null check (length(btrim(texto)) between 3 and 4000),
  publico          text not null check (publico in ('TODOS', 'BLOCOS', 'UNIDADES', 'CONTATOS')),
  blocos           uuid[] not null default '{}' check (cardinality(blocos) <= 100),
  unidades         uuid[] not null default '{}' check (cardinality(unidades) <= 1000),
  contatos         uuid[] not null default '{}' check (cardinality(contatos) <= 1000),
  pedido_id        uuid,
  manutencao_id    uuid,
  estado           text not null check (estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO', 'SUBSTITUIDO', 'ARQUIVADO')),
  programado_para  timestamptz,
  programado_por   uuid references pessoas (id),
  publicado_em     timestamptz,
  publicado_por    uuid references pessoas (id),
  -- Quantos contatos recebiam na hora da publicação.
  destinatarios    integer check (destinatarios >= 0),
  assinatura       text check (length(btrim(assinatura)) between 2 and 120),
  mudanca          text check (length(btrim(mudanca)) between 3 and 500),
  substituido_em   timestamptz,
  arquivado_em     timestamptz,
  arquivado_por    uuid references pessoas (id),
  motivo_arquivo   text check (length(btrim(motivo_arquivo)) between 3 and 500),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  unique (familia_id, numero),
  foreign key (familia_id, condominio_id) references comunicados (id, condominio_id) deferrable initially deferred,
  foreign key (anterior_id, condominio_id) references comunicados (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  check ((numero = 1) = (anterior_id is null) and (numero = 1) = (familia_id = id)),
  check ((numero = 1) = (mudanca is null)),
  check ((estado = 'PROGRAMADO') = (programado_para is not null) or estado in ('PUBLICADO', 'SUBSTITUIDO', 'ARQUIVADO')),
  check ((programado_para is null) = (programado_por is null)),
  check (estado not in ('PUBLICADO', 'SUBSTITUIDO') or publicado_em is not null),
  check ((publicado_em is null) = (publicado_por is null) and (publicado_em is null) = (destinatarios is null)),
  check ((estado = 'SUBSTITUIDO') = (substituido_em is not null)),
  check ((estado = 'ARQUIVADO') = (arquivado_em is not null)
         and (arquivado_em is null) = (arquivado_por is null) and (arquivado_em is null) = (motivo_arquivo is null)),
  check (case publico when 'TODOS' then cardinality(blocos) + cardinality(unidades) + cardinality(contatos) = 0
                      when 'BLOCOS' then cardinality(blocos) > 0 and cardinality(unidades) + cardinality(contatos) = 0
                      when 'UNIDADES' then cardinality(unidades) > 0 and cardinality(blocos) + cardinality(contatos) = 0
                      else cardinality(contatos) > 0 and cardinality(blocos) + cardinality(unidades) = 0 end)
);
-- Só uma versão em uso por comunicado.
create unique index comunicados_um_em_uso on comunicados (familia_id) where estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO');
create index comunicados_estado on comunicados (condominio_id, estado);
create index comunicados_programados on comunicados (programado_para) where estado = 'PROGRAMADO';
create index comunicados_pedido on comunicados (pedido_id) where pedido_id is not null;
create index comunicados_manutencao on comunicados (manutencao_id) where manutencao_id is not null;
call proteger_tabela_condominio('comunicados');
call ligar_guardiao('comunicados');
insert into estados_iniciais (tabela, estado) values
  ('comunicados', 'RASCUNHO'), ('comunicados', 'PROGRAMADO'), ('comunicados', 'PUBLICADO');
insert into transicoes_permitidas (tabela, de, para) values
  ('comunicados', 'RASCUNHO', 'PROGRAMADO'),
  ('comunicados', 'RASCUNHO', 'PUBLICADO'),
  ('comunicados', 'PROGRAMADO', 'RASCUNHO'),
  ('comunicados', 'PROGRAMADO', 'PUBLICADO'),
  ('comunicados', 'PUBLICADO', 'SUBSTITUIDO'),
  ('comunicados', 'RASCUNHO', 'ARQUIVADO'),
  ('comunicados', 'PROGRAMADO', 'ARQUIVADO'),
  ('comunicados', 'PUBLICADO', 'ARQUIVADO');
create trigger comunicados_sem_exclusao before delete on comunicados for each row execute function somente_insercao();

-- Publicado não se edita: o que o morador leu fica como estava (CD-01).
create function comunicados_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.familia_id, new.numero, new.anterior_id, new.criado_em, new.criado_por)
     is distinct from (old.familia_id, old.numero, old.anterior_id, old.criado_em, old.criado_por) then
    raise exception 'A família e a versão do comunicado não mudam' using errcode = 'TC422';
  end if;
  if old.estado not in ('RASCUNHO', 'PROGRAMADO')
     and (new.assunto, new.titulo, new.texto, new.publico, new.blocos, new.unidades, new.contatos, new.pedido_id,
          new.manutencao_id, new.assinatura, new.mudanca, new.publicado_em, new.publicado_por, new.destinatarios)
         is distinct from
         (old.assunto, old.titulo, old.texto, old.publico, old.blocos, old.unidades, old.contatos, old.pedido_id,
          old.manutencao_id, old.assinatura, old.mudanca, old.publicado_em, old.publicado_por, old.destinatarios) then
    raise exception 'Comunicado publicado não se edita: corrija em uma versão nova' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger comunicados_regras before update on comunicados for each row execute function comunicados_regras();

-- Fotos e PDF do comunicado (CD-09): ficam com a família, em todas as versões.
create table arquivos_comunicado (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  familia_id         uuid not null,
  nome               text not null check (length(btrim(nome)) between 1 and 200),
  tipo               text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_declarado  integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho            integer check (tamanho between 1 and 10485760),
  caminho            text not null unique,
  situacao           text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa      text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em         timestamptz not null default app_now(),
  enviado_por        uuid not null references pessoas (id),
  verificado_em      timestamptz,
  retirado_em        timestamptz,
  retirado_por       uuid references pessoas (id),
  motivo_retirada    text check (length(btrim(motivo_retirada)) between 3 and 500),
  foreign key (familia_id, condominio_id) references comunicados (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_comunicado_f on arquivos_comunicado (familia_id, enviado_em);
call proteger_tabela_condominio('arquivos_comunicado');
create trigger arquivos_comunicado_sem_exclusao before delete on arquivos_comunicado for each row execute function somente_insercao();

create function arquivos_comunicado_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.familia_id, new.nome, new.tipo, new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.familia_id, old.nome, old.tipo, old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'O arquivo do comunicado não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
     is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'O arquivo já foi verificado' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'O arquivo já foi tirado do comunicado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger arquivos_comunicado_regras before update on arquivos_comunicado for each row execute function arquivos_comunicado_regras();

-- ---------------------------------------------------------------------------------------
-- Documentos (CD-07, CD-04, MP-12).

create table documentos (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  tipo           text not null check (tipo in ('CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO')),
  titulo         text not null check (length(btrim(titulo)) between 3 and 120),
  descricao      text check (length(btrim(descricao)) between 2 and 500),
  restrito       boolean not null default false,
  ao_morador     boolean not null default false,
  vale_ate       date check (vale_ate between date '2000-01-01' and date '2100-12-31'),
  arquivado_em   timestamptz,
  arquivado_por  uuid references pessoas (id),
  motivo_arquivo text check (length(btrim(motivo_arquivo)) between 3 and 500),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid not null references pessoas (id),
  atualizado_em  timestamptz not null default app_now(),
  versao         integer not null default 1,
  unique (id, condominio_id),
  -- Documento restrito não vai ao morador.
  check (not (restrito and ao_morador)),
  check ((arquivado_em is null) = (arquivado_por is null) and (arquivado_em is null) = (motivo_arquivo is null))
);
create unique index documentos_titulo_ativo on documentos (condominio_id, lower(btrim(titulo))) where arquivado_em is null;
call proteger_tabela_condominio('documentos');
create trigger documentos_sem_exclusao before delete on documentos for each row execute function somente_insercao();
create trigger documentos_regras before update on documentos for each row execute function prestadores_regras();

-- Cada arquivo enviado é uma versão. O número só nasce quando o arquivo é liberado.
create table versoes_documento (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  documento_id       uuid not null,
  numero             smallint check (numero between 1 and 500),
  mudanca            text check (length(btrim(mudanca)) between 3 and 500),
  vigente_desde      date not null check (vigente_desde between date '1950-01-01' and date '2100-12-31'),
  aprovado_em        text check (length(btrim(aprovado_em)) between 2 and 120),
  nome               text not null check (length(btrim(nome)) between 1 and 200),
  tipo               text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_declarado  integer not null check (tamanho_declarado between 1 and 20971520),
  tamanho            integer check (tamanho between 1 and 20971520),
  caminho            text not null unique,
  situacao           text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa      text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em         timestamptz not null default app_now(),
  enviado_por        uuid not null references pessoas (id),
  verificado_em      timestamptz,
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  unique (documento_id, numero),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null) and (situacao = 'LIBERADO') = (numero is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null))
);
create index versoes_documento_d on versoes_documento (documento_id, numero);
call proteger_tabela_condominio('versoes_documento');
create trigger versoes_documento_sem_exclusao before delete on versoes_documento for each row execute function somente_insercao();

create function versoes_documento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.documento_id, new.mudanca, new.vigente_desde, new.aprovado_em, new.nome, new.tipo,
      new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.documento_id, old.mudanca, old.vigente_desde, old.aprovado_em, old.nome, old.tipo,
      old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'A versão do documento não muda depois de enviada' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' then raise exception 'A versão já foi verificada' using errcode = 'TC422'; end if;
  return new;
end $$;
create trigger versoes_documento_regras before update on versoes_documento for each row execute function versoes_documento_regras();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('comunicados', 'comunicados', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
           ('documentos', 'documentos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- Avisos no sino de documento perto de vencer (MP-12), uma vez por pessoa e por data.
create table avisos_documento (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  documento_id  uuid not null,
  tipo          text not null check (tipo in ('VALIDADE')),
  referencia    date not null,
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  unique (pessoa_id, documento_id, tipo, referencia)
);
create index avisos_documento_pessoa on avisos_documento (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_documento');
create trigger avisos_documento_sem_exclusao before delete on avisos_documento for each row execute function somente_insercao();

create function avisos_documento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.documento_id, new.tipo, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.documento_id, old.tipo, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_documento_regras before update on avisos_documento for each row execute function avisos_documento_regras();

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function exigir_comunicado(p_id uuid) returns comunicados
language plpgsql
set search_path = public
as $$
declare v comunicados;
begin
  select * into v from comunicados where id = p_id;
  if not found then raise exception 'Comunicado não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

-- O documento que a pessoa enxerga (o restrito só para quem cuida dos documentos).
create function exigir_documento(p_pessoa uuid, p_id uuid) returns documentos
language plpgsql
set search_path = public
as $$
declare v documentos;
begin
  select * into v from documentos where id = p_id;
  if not found or (v.restrito and not pode(p_pessoa, v.condominio_id, 'documentos.restritos')) then
    raise exception 'Documento não encontrado' using errcode = 'TC404';
  end if;
  return v;
end $$;

-- Quem recebe (CD-02): vínculo confirmado, contato com dados e "recebe comunicados" ligado.
-- Assembleia e convocação também chega ao proprietário que não recebe o dia a dia.
create function destinatarios_comunicado(p_assunto text, p_publico text, p_blocos uuid[], p_unidades uuid[], p_contatos uuid[])
returns table (contato_id uuid, unidade_id uuid)
language sql stable
set search_path = public
as $$
  select cu.contato_id, cu.unidade_id
    from contatos_unidade cu
    join contatos ct on ct.id = cu.contato_id and ct.dados_removidos_em is null
    join unidades u on u.id = cu.unidade_id and u.ativa
   where cu.estado = 'CONFIRMADO'
     and (cu.recebe_comunicados or (p_assunto = 'ASSEMBLEIA' and cu.proprietario))
     and case p_publico
           when 'TODOS' then true
           when 'BLOCOS' then u.bloco_id = any (p_blocos)
           when 'UNIDADES' then u.id = any (p_unidades)
           else cu.contato_id = any (p_contatos) end
$$;

-- As unidades do público sem ninguém que recebe (no público por contatos, nenhuma).
create function unidades_sem_destinatario(p_assunto text, p_publico text, p_blocos uuid[], p_unidades uuid[]) returns uuid[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(u.id), '{}') from unidades u
   where u.ativa and p_publico <> 'CONTATOS'
     and case p_publico when 'TODOS' then true when 'BLOCOS' then u.bloco_id = any (p_blocos) else u.id = any (p_unidades) end
     and not exists (select 1 from destinatarios_comunicado(p_assunto, 'UNIDADES', '{}', array[u.id], '{}'))
$$;

create function rotulo_unidade(p_unidade uuid) returns text
language sql stable
set search_path = public
as $$
  select nome_da_unidade(b.nome, u.andar, u.identificacao) from unidades u left join blocos b on b.id = u.bloco_id where u.id = p_unidade
$$;

-- O público como a tela mostra: a conta, as unidades sem ninguém e, para quem vê os moradores,
-- os nomes de quem recebe.
create function publico_json(p_pessoa uuid, p_assunto text, p_publico text, p_blocos uuid[], p_unidades uuid[], p_contatos uuid[])
returns jsonb
language sql stable
set search_path = public
as $$
  with d as (select * from destinatarios_comunicado(p_assunto, p_publico, p_blocos, p_unidades, p_contatos)),
  sem as (select unnest(unidades_sem_destinatario(p_assunto, p_publico, p_blocos, p_unidades)) as id)
  select jsonb_strip_nulls(jsonb_build_object(
    'contatos', (select count(distinct contato_id) from d),
    'unidades', (select count(distinct unidade_id) from d),
    'semNinguem', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', rotulo_unidade(s.id)) order by rotulo_unidade(s.id))
                              from sem s), '[]'::jsonb),
    'quem', case when pode(p_pessoa, contexto_condominio(), 'moradores.ver') then coalesce((
              select jsonb_agg(jsonb_build_object('contatoId', x.contato_id, 'nome', x.nome, 'unidades', x.unidades) order by lower(x.nome))
                from (select d.contato_id, ct.nome, jsonb_agg(rotulo_unidade(d.unidade_id) order by rotulo_unidade(d.unidade_id)) as unidades
                        from d join contatos ct on ct.id = d.contato_id group by d.contato_id, ct.nome) x), '[]'::jsonb) end,
    'blocos', case when p_publico = 'BLOCOS' then (select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome) order by b.ordem, b.nome)
                                                      from blocos b where b.id = any (p_blocos)) end,
    'unidadesEscolhidas', case when p_publico = 'UNIDADES' then (select jsonb_agg(jsonb_build_object('id', x, 'nome', rotulo_unidade(x)) order by rotulo_unidade(x))
                                                                  from unnest(p_unidades) x) end,
    'contatosEscolhidos', case when p_publico = 'CONTATOS' and pode(p_pessoa, contexto_condominio(), 'moradores.ver') then
                            (select jsonb_agg(jsonb_build_object('id', ct.id, 'nome', ct.nome) order by lower(ct.nome))
                               from contatos ct where ct.id = any (p_contatos)) end))
$$;

-- O comunicado como as listas recebem.
create function comunicado_json(c comunicados, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'familiaId', c.familia_id, 'numero', c.numero, 'assunto', c.assunto, 'titulo', c.titulo, 'estado', c.estado,
    'publico', c.publico,
    'publicoResumo', case c.publico
                       when 'TODOS' then 'Todo o condomínio'
                       when 'BLOCOS' then (select string_agg(b.nome, ', ' order by b.ordem, b.nome) from blocos b where b.id = any (c.blocos))
                       when 'UNIDADES' then cardinality(c.unidades) || case when cardinality(c.unidades) = 1 then ' unidade' else ' unidades' end
                       else cardinality(c.contatos) || case when cardinality(c.contatos) = 1 then ' contato' else ' contatos' end end,
    'destinatarios', c.destinatarios,
    'programadoPara', c.programado_para, 'publicadoEm', c.publicado_em,
    'publicadoPor', (select nome from pessoas where id = c.publicado_por),
    'autor', (select nome from pessoas where id = c.criado_por),
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto)
                 from pedidos p where p.id = c.pedido_id and pode(p_pessoa, c.condominio_id, 'pedidos.ver') and pedido_visivel(p_pessoa, p)),
    'manutencao', case when pode(p_pessoa, c.condominio_id, 'manutencao.ver') then (
                    select jsonb_build_object('id', m.id, 'titulo', m.titulo, 'estado', m.estado) from manutencoes m where m.id = c.manutencao_id) end,
    'arquivadoEm', c.arquivado_em, 'substituidoEm', c.substituido_em,
    'criadoEm', c.criado_em, 'atualizadoEm', c.atualizado_em, 'versao', c.versao))
$$;

-- A versão em vigor do documento: a liberada de maior número que já vale hoje.
create function versao_em_vigor(p_documento uuid) returns versoes_documento
language sql stable
set search_path = public
as $$
  select * from versoes_documento where documento_id = p_documento and situacao = 'LIBERADO' and vigente_desde <= hoje_no_condominio()
   order by numero desc limit 1
$$;

create function documento_json(d documentos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'tipo', d.tipo, 'titulo', d.titulo, 'descricao', d.descricao, 'restrito', d.restrito, 'aoMorador', d.ao_morador,
    'valeAte', to_char(d.vale_ate, 'YYYY-MM-DD'),
    'vencendo', d.vale_ate is not null and d.arquivado_em is null and d.vale_ate <= hoje_no_condominio() + 60,
    'vencido', d.vale_ate is not null and d.vale_ate < hoje_no_condominio(),
    'emVigor', (select jsonb_build_object('id', v.id, 'numero', v.numero, 'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'),
                                          'aprovadoEm', v.aprovado_em, 'nome', v.nome)
                  from versao_em_vigor(d.id) v where v.id is not null),
    'proxima', (select jsonb_build_object('id', v.id, 'numero', v.numero, 'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'))
                  from versoes_documento v where v.documento_id = d.id and v.situacao = 'LIBERADO' and v.vigente_desde > hoje_no_condominio()
                 order by v.numero desc limit 1),
    'arquivadoEm', d.arquivado_em, 'atualizadoEm', d.atualizado_em, 'versao', d.versao))
$$;

-- Publicar: guarda a assinatura e a conta de quem recebe.
create function publicar_comunicado(p_id uuid, p_por uuid, p_evento text, p_sistema boolean default false) returns integer
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
  return v_versao;
end $$;

-- Publica os programados que chegaram na hora, no condomínio do contexto.
create function publicar_programados() returns integer
language plpgsql
set search_path = public
as $$
declare
  c comunicados;
  v_n integer := 0;
begin
  for c in select * from comunicados where estado = 'PROGRAMADO' and programado_para <= app_now() order by programado_para loop
    perform publicar_comunicado(c.id, c.programado_por, 'PUBLICADO_NA_HORA', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Documento a 60 dias do fim: avisa quem cuida dos documentos (e vê o documento), uma vez.
create function avisar_documentos() returns integer
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  insert into avisos_documento (condominio_id, pessoa_id, documento_id, tipo, referencia)
  select d.condominio_id, v.pessoa_id, d.id, 'VALIDADE', d.vale_ate
    from documentos d
    join (select distinct pessoa_id from vinculos where condominio_id = contexto_condominio() and revogado_em is null
                                                    and funcao in ('SINDICO', 'AUTORIZADO')) v
      on pode(v.pessoa_id, d.condominio_id, 'documentos.editar')
     and (not d.restrito or pode(v.pessoa_id, d.condominio_id, 'documentos.restritos'))
   where d.arquivado_em is null and d.vale_ate is not null and d.vale_ate <= hoje_no_condominio() + 60
  on conflict (pessoa_id, documento_id, tipo, referencia) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Rotina dos comunicados e documentos, em todos os condomínios, a cada 5 minutos. Um
-- condomínio com problema não impede os outros.
create function verificar_comunicados() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    begin
      v_total := v_total + publicar_programados() + avisar_documentos();
    exception when others then
      raise warning 'Comunicados do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- Resumo para o Início: programados para hoje, rascunho parado há mais de 3 dias e documento
-- perto de vencer.
create function resumo_comunicados(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with hoje as (select * from comunicados where estado = 'PROGRAMADO'
                   and (programado_para at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date = hoje_no_condominio()),
  parados as (select * from comunicados where estado = 'RASCUNHO' and atualizado_em <= app_now() - interval '3 days'),
  vencendo as (select * from documentos d where pode(p_pessoa, d.condominio_id, 'documentos.ver') and d.arquivado_em is null
                  and d.vale_ate is not null and d.vale_ate <= hoje_no_condominio() + 60
                  and (not d.restrito or pode(p_pessoa, d.condominio_id, 'documentos.restritos')))
  select jsonb_strip_nulls(jsonb_build_object(
    'programadosHoje', case when pode(p_pessoa, contexto_condominio(), 'comunicados.ver') then (select count(*) from hoje) end,
    'proximoProgramado', case when pode(p_pessoa, contexto_condominio(), 'comunicados.ver') then (
                           select jsonb_build_object('id', id, 'titulo', titulo, 'em', programado_para) from hoje order by programado_para limit 1) end,
    'rascunhosParados', case when pode(p_pessoa, contexto_condominio(), 'comunicados.ver') then (select count(*) from parados) end,
    'rascunhoMaisAntigo', case when pode(p_pessoa, contexto_condominio(), 'comunicados.ver') then (
                            select jsonb_build_object('id', id, 'titulo', titulo, 'desde', atualizado_em) from parados order by atualizado_em limit 1) end,
    'documentosVencendo', (select count(*) from vencendo),
    'documentoMaisProximo', (select jsonb_build_object('id', id, 'titulo', titulo, 'valeAte', to_char(vale_ate, 'YYYY-MM-DD'))
                               from vencendo order by vale_ate limit 1)))
$$;

-- ---------------------------------------------------------------------------------------
-- Painel e avisos: comunicados e documentos entram.

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
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)))
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer;
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
  return v_n + v_m + v_d;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API (security definer). Pessoa e condomínio vêm da sessão.

-- O que a tela de escrever precisa: assuntos em uso, blocos, unidades, contatos (a quem vê
-- os moradores), pedidos e manutenções abertos para ligar, e o plano de comunicação.
create function plataforma_comunicado_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  return (
    select jsonb_strip_nulls(jsonb_build_object(
      'assuntos', to_jsonb(c.comunicados_assuntos),
      'plano', c.comunicados_plano, 'assinatura', c.comunicados_assinatura,
      'silencio', jsonb_build_object('inicio', to_char(c.comunicados_silencio_inicio, 'HH24:MI'), 'fim', to_char(c.comunicados_silencio_fim, 'HH24:MI')),
      'fuso', c.fuso,
      'blocos', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome) order by b.ordem, b.nome) from blocos b where b.ativo), '[]'::jsonb),
      'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id), 'blocoId', u.bloco_id) order by rotulo_unidade(u.id))
                              from unidades u where u.ativa), '[]'::jsonb),
      'contatos', case when pode(p_pessoa, p_condominio, 'moradores.ver') then coalesce((
                    select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'unidades', x.unidades) order by lower(x.nome))
                      from (select ct.id, ct.nome, jsonb_agg(distinct rotulo_unidade(cu.unidade_id)) as unidades
                              from contatos ct join contatos_unidade cu on cu.contato_id = ct.id and cu.estado = 'CONFIRMADO'
                             where ct.dados_removidos_em is null group by ct.id, ct.nome) x), '[]'::jsonb) end,
      'pedidos', case when pode(p_pessoa, p_condominio, 'pedidos.ver') then coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'protocolo', x.protocolo, 'assunto', x.assunto) order by x.criado_em desc)
          from (select * from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and pedido_visivel(p_pessoa, p)
                 order by p.criado_em desc limit 300) x), '[]'::jsonb) end,
      'manutencoes', case when pode(p_pessoa, p_condominio, 'manutencao.ver') then coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'local', m.local) order by m.criado_em desc)
          from (select * from manutencoes where estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by criado_em desc limit 300) m), '[]'::jsonb) end,
      'pode', jsonb_build_object('publicar', pode(p_pessoa, p_condominio, 'comunicados.publicar'),
                                 'verMoradores', pode(p_pessoa, p_condominio, 'moradores.ver')),
      'agora', app_now()))
      from configuracao_condominio c);
end $$;

-- Quem recebe, antes de publicar (CD-02).
create function plataforma_publico_comunicado(p_pessoa uuid, p_condominio uuid, p_assunto text, p_publico text, p_blocos uuid[],
                                              p_unidades uuid[], p_contatos uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  if p_assunto is null or p_assunto not in ('AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE') then
    perform recusar_campos('Assunto desconhecido', 'assunto');
  end if;
  if p_publico is null or p_publico not in ('TODOS', 'BLOCOS', 'UNIDADES', 'CONTATOS') then
    perform recusar_campos('Público desconhecido', 'publico');
  end if;
  return publico_json(p_pessoa, p_assunto, p_publico, coalesce(p_blocos, '{}'), coalesce(p_unidades, '{}'), coalesce(p_contatos, '{}'));
end $$;

-- A lista (CD-01), com os atalhos do que pede atenção.
create function plataforma_comunicados(p_pessoa uuid, p_condominio uuid, p_filtro text, p_assunto text, p_atencao text,
                                       p_busca text, p_pagina integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  if coalesce(p_filtro, 'EM_USO') not in ('EM_USO', 'PUBLICADO', 'PROGRAMADO', 'RASCUNHO', 'ARQUIVADO', 'TODOS') then
    perform recusar_campos('Filtro desconhecido', 'filtro');
  end if;
  if p_assunto is not null and p_assunto not in ('AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE') then
    perform recusar_campos('Assunto desconhecido', 'assunto');
  end if;
  if p_atencao is not null and p_atencao not in ('RASCUNHOS_PARADOS', 'PROGRAMADOS_HOJE') then
    perform recusar_campos('Atalho desconhecido', 'atencao');
  end if;
  return (
    with base as (
      select c.* from comunicados c
       where (case coalesce(p_filtro, 'EM_USO')
                when 'EM_USO' then c.estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO')
                when 'TODOS' then true
                else c.estado = p_filtro end)
         and (p_assunto is null or c.assunto = p_assunto)
         and (v_busca is null or lower(c.titulo) like '%' || v_busca || '%' or lower(c.texto) like '%' || v_busca || '%')
         and (case p_atencao
                when 'RASCUNHOS_PARADOS' then c.estado = 'RASCUNHO' and c.atualizado_em <= app_now() - interval '3 days'
                when 'PROGRAMADOS_HOJE' then c.estado = 'PROGRAMADO'
                  and (c.programado_para at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date = hoje_no_condominio()
                else true end))
    select jsonb_build_object(
      'itens', coalesce((
        select jsonb_agg(comunicado_json(x.linha, p_pessoa) order by x.ordem1, x.ordem2 desc)
          from (select b::comunicados as linha,
                       case b.estado when 'PROGRAMADO' then 0 when 'RASCUNHO' then 1 else 2 end as ordem1,
                       coalesce(b.publicado_em, b.atualizado_em) as ordem2
                  from base b order by ordem1, ordem2 desc offset (v_pagina - 1) * 30 limit 30) x), '[]'::jsonb),
      'total', (select count(*) from base),
      'pagina', v_pagina,
      'atalhos', jsonb_build_object(
        'rascunhosParados', (select count(*) from comunicados where estado = 'RASCUNHO' and atualizado_em <= app_now() - interval '3 days'),
        'programadosHoje', (select count(*) from comunicados where estado = 'PROGRAMADO'
          and (programado_para at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date = hoje_no_condominio())),
      'pode', jsonb_build_object('publicar', pode(p_pessoa, p_condominio, 'comunicados.publicar'))));
end $$;

-- Um comunicado, com o texto, as versões, os arquivos, quem recebe agora e o histórico.
create function plataforma_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  v_publicar boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  c := exigir_comunicado(p_id);
  v_publicar := pode(p_pessoa, p_condominio, 'comunicados.publicar');
  return jsonb_build_object(
    'comunicado', comunicado_json(c, p_pessoa) || jsonb_strip_nulls(jsonb_build_object(
      'texto', c.texto, 'assinatura', coalesce(c.assinatura, (select comunicados_assinatura from configuracao_condominio)),
      'mudanca', c.mudanca, 'blocos', to_jsonb(c.blocos), 'unidades', to_jsonb(c.unidades), 'contatos', to_jsonb(c.contatos),
      'pedidoId', c.pedido_id, 'manutencaoId', c.manutencao_id,
      'arquivamento', case when c.estado = 'ARQUIVADO' then jsonb_build_object('motivo', c.motivo_arquivo, 'em', c.arquivado_em,
                        'por', (select nome from pessoas where id = c.arquivado_por)) end,
      'pedidoOculto', case when c.pedido_id is not null and not exists (
                        select 1 from pedidos p where p.id = c.pedido_id and pode(p_pessoa, p_condominio, 'pedidos.ver')
                                                  and pedido_visivel(p_pessoa, p)) then true end)),
    'publicoAgora', publico_json(p_pessoa, c.assunto, c.publico, c.blocos, c.unidades, c.contatos),
    'versoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'numero', x.numero, 'estado', x.estado, 'titulo', x.titulo, 'texto', x.texto, 'mudanca', x.mudanca,
               'publicadoEm', x.publicado_em, 'publicadoPor', (select nome from pessoas where id = x.publicado_por),
               'substituidoEm', x.substituido_em)) order by x.numero desc)
        from comunicados x where x.familia_id = c.familia_id), '[]'::jsonb),
    'arquivos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', a.id, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', coalesce(a.tamanho, a.tamanho_declarado), 'situacao', a.situacao,
               'motivoRecusa', a.motivo_recusa, 'enviadoEm', a.enviado_em, 'enviadoPor', (select nome from pessoas where id = a.enviado_por),
               'podeTirar', v_publicar or a.enviado_por = p_pessoa)) order by a.enviado_em, a.id)
        from arquivos_comunicado a where a.familia_id = c.familia_id and a.retirado_em is null), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                          'dados', h.dados) order by h.ocorrido_em desc, h.id desc)
        from historico h
       where (h.entidade = 'comunicados' and h.entidade_id = c.familia_id::text)
          or (h.entidade = 'comunicados' and h.acao = 'estado.mudou'
              and h.entidade_id in (select x.id::text from comunicados x where x.familia_id = c.familia_id))), '[]'::jsonb),
    'pode', jsonb_build_object(
      'editar', v_publicar and c.estado in ('RASCUNHO', 'PROGRAMADO'),
      'corrigir', v_publicar and c.estado = 'PUBLICADO',
      'arquivar', v_publicar and c.estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO'),
      'enviar', v_publicar and c.estado in ('RASCUNHO', 'PROGRAMADO'),
      'copiar', c.estado = 'PUBLICADO'),
    'condominio', (select nome from condominios where id = p_condominio),
    'limites', jsonb_build_object('arquivos', 4, 'tamanho', 10485760));
end $$;

-- Confere o que o comunicado leva (assunto em uso, título, texto, público e ligações).
create function ler_comunicado(p_pessoa uuid, p_assunto text, p_titulo text, p_texto text, p_publico text, p_blocos uuid[],
                               p_unidades uuid[], p_contatos uuid[], p_pedido uuid, p_manutencao uuid, p_antes comunicados)
returns comunicados
language plpgsql
set search_path = public
as $$
declare
  c comunicados;
  v_pedido pedidos;
begin
  if p_assunto is null or not (select p_assunto = any (comunicados_assuntos) from configuracao_condominio)
     and p_assunto is distinct from p_antes.assunto then
    perform recusar_campos('Escolha um assunto em uso', 'assunto');
  end if;
  c.assunto := p_assunto;
  c.titulo := btrim(coalesce(p_titulo, ''));
  if length(c.titulo) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  c.texto := btrim(coalesce(p_texto, ''));
  if length(c.texto) not between 3 and 4000 then perform recusar_campos('Texto de 3 a 4000 caracteres', 'texto'); end if;
  if p_publico is null or p_publico not in ('TODOS', 'BLOCOS', 'UNIDADES', 'CONTATOS') then
    perform recusar_campos('Escolha para quem', 'publico');
  end if;
  c.publico := p_publico;
  c.blocos := case when p_publico = 'BLOCOS' then (select coalesce(array_agg(distinct x), '{}') from unnest(p_blocos) x) else '{}' end;
  c.unidades := case when p_publico = 'UNIDADES' then (select coalesce(array_agg(distinct x), '{}') from unnest(p_unidades) x) else '{}' end;
  c.contatos := case when p_publico = 'CONTATOS' then (select coalesce(array_agg(distinct x), '{}') from unnest(p_contatos) x) else '{}' end;
  if p_publico = 'BLOCOS' and (cardinality(c.blocos) = 0 or exists (
       select 1 from unnest(c.blocos) x where not exists (select 1 from blocos b where b.id = x and b.ativo))) then
    perform recusar_campos('Escolha os blocos', 'blocos');
  end if;
  if p_publico = 'UNIDADES' and (cardinality(c.unidades) = 0 or cardinality(c.unidades) > 1000 or exists (
       select 1 from unnest(c.unidades) x where not exists (select 1 from unidades u where u.id = x and u.ativa))) then
    perform recusar_campos('Escolha as unidades', 'unidades');
  end if;
  if p_publico = 'CONTATOS' and (not pode(p_pessoa, contexto_condominio(), 'moradores.ver') or cardinality(c.contatos) = 0
       or cardinality(c.contatos) > 1000 or exists (
       select 1 from unnest(c.contatos) x where not exists (select 1 from contatos ct where ct.id = x and ct.dados_removidos_em is null))) then
    perform recusar_campos('Escolha os contatos', 'contatos');
  end if;
  if p_pedido is not null then
    select * into v_pedido from pedidos where id = p_pedido;
    if not found or not pode(p_pessoa, contexto_condominio(), 'pedidos.ver') or not pedido_visivel(p_pessoa, v_pedido) then
      perform recusar_campos('Pedido não encontrado', 'pedidoId');
    end if;
  elsif p_antes.pedido_id is not null and not exists (
          select 1 from pedidos p where p.id = p_antes.pedido_id and pode(p_pessoa, contexto_condominio(), 'pedidos.ver')
                                    and pedido_visivel(p_pessoa, p)) then
    -- O pedido que a pessoa não enxerga continua ligado como estava.
    c.pedido_id := p_antes.pedido_id;
  end if;
  c.pedido_id := coalesce(p_pedido, c.pedido_id);
  if p_manutencao is not null and (not pode(p_pessoa, contexto_condominio(), 'manutencao.ver')
                                   or not exists (select 1 from manutencoes where id = p_manutencao)) then
    perform recusar_campos('Manutenção não encontrada', 'manutencaoId');
  end if;
  c.manutencao_id := case when p_manutencao is not null then p_manutencao
                          when not pode(p_pessoa, contexto_condominio(), 'manutencao.ver') then p_antes.manutencao_id end;
  return c;
end $$;

-- Ligou agora: o pedido e a manutenção registram no histórico deles.
create function registrar_ligacoes_comunicado(p_id uuid, p_antes comunicados, p_depois comunicados) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_depois.pedido_id is not null and p_depois.pedido_id is distinct from p_antes.pedido_id then
    perform registrar_historico('pedido.comunicado_ligado', 'pedidos', p_depois.pedido_id::text, jsonb_build_object('comunicado', p_id));
  end if;
  if p_depois.manutencao_id is not null and p_depois.manutencao_id is distinct from p_antes.manutencao_id then
    perform registrar_historico('manutencao.comunicado_ligado', 'manutencoes', p_depois.manutencao_id::text, jsonb_build_object('comunicado', p_id));
  end if;
end $$;

-- Escrever ou mudar o rascunho ou o programado, e decidir: guardar como rascunho, programar
-- ou publicar agora (CD-01, CD-06).
create function plataforma_salvar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_assunto text,
                                             p_titulo text, p_texto text, p_publico text, p_blocos uuid[], p_unidades uuid[],
                                             p_contatos uuid[], p_pedido uuid, p_manutencao uuid, p_acao text,
                                             p_programado_para timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v comunicados;
  c comunicados;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
  if p_acao is null or p_acao not in ('RASCUNHO', 'PROGRAMAR', 'PUBLICAR') then
    perform recusar_campos('Guardar, programar ou publicar', 'acao');
  end if;
  if p_id is not null then
    v := exigir_comunicado(p_id);
    if v.estado not in ('RASCUNHO', 'PROGRAMADO') then
      perform recusar_motivo('Comunicado publicado não se edita: corrija em uma versão nova', 'COMUNICADO_PUBLICADO');
    end if;
    if v.versao <> p_versao then perform conflito_versao('comunicados', p_id); end if;
  end if;
  c := ler_comunicado(p_pessoa, p_assunto, p_titulo, p_texto, p_publico, p_blocos, p_unidades, p_contatos, p_pedido, p_manutencao, v);
  if p_acao = 'PROGRAMAR' and (p_programado_para is null or p_programado_para <= app_now() + interval '1 minute'
                               or p_programado_para > app_now() + interval '1 year') then
    perform recusar_campos('Programe para daqui a pelo menos 2 minutos e até um ano', 'programadoPara');
  end if;
  if p_id is null then
    v_id := gen_random_uuid();
    perform definir_transicao(case p_acao when 'RASCUNHO' then 'ESCRITO' when 'PROGRAMAR' then 'PROGRAMADO' else 'ESCRITO' end);
    insert into comunicados (id, condominio_id, familia_id, assunto, titulo, texto, publico, blocos, unidades, contatos, pedido_id,
                             manutencao_id, estado, programado_para, programado_por, criado_por)
    values (v_id, p_condominio, v_id, c.assunto, c.titulo, c.texto, c.publico, c.blocos, c.unidades, c.contatos, c.pedido_id,
            c.manutencao_id, case when p_acao = 'PROGRAMAR' then 'PROGRAMADO' else 'RASCUNHO' end,
            case when p_acao = 'PROGRAMAR' then p_programado_para end, case when p_acao = 'PROGRAMAR' then p_pessoa end, p_pessoa);
    perform registrar_historico('comunicado.escrito', 'comunicados', v_id::text, jsonb_strip_nulls(jsonb_build_object(
      'assunto', c.assunto, 'publico', c.publico, 'pedido', c.pedido_id, 'manutencao', c.manutencao_id)));
    v.pedido_id := null; v.manutencao_id := null;
  else
    v_id := p_id;
    perform definir_transicao(case p_acao when 'PROGRAMAR' then 'PROGRAMADO' else 'VOLTOU_A_RASCUNHO' end);
    update comunicados set assunto = c.assunto, titulo = c.titulo, texto = c.texto, publico = c.publico, blocos = c.blocos,
                           unidades = c.unidades, contatos = c.contatos, pedido_id = c.pedido_id, manutencao_id = c.manutencao_id,
                           estado = case when p_acao = 'PROGRAMAR' then 'PROGRAMADO' else 'RASCUNHO' end,
                           programado_para = case when p_acao = 'PROGRAMAR' then p_programado_para end,
                           programado_por = case when p_acao = 'PROGRAMAR' then p_pessoa end
     where id = p_id and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('comunicados', p_id); end if;
    perform registrar_historico('comunicado.alterado', 'comunicados', v.familia_id::text, jsonb_build_object(
      'campos', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (values
          ('assunto', v.assunto is distinct from c.assunto), ('titulo', v.titulo is distinct from c.titulo),
          ('texto', v.texto is distinct from c.texto),
          ('publico', (v.publico, v.blocos, v.unidades, v.contatos) is distinct from (c.publico, c.blocos, c.unidades, c.contatos)),
          ('ligacoes', (v.pedido_id, v.manutencao_id) is distinct from (c.pedido_id, c.manutencao_id))) t(k, mudou) where mudou)));
  end if;
  if p_acao = 'PROGRAMAR' then
    perform registrar_historico('comunicado.programado', 'comunicados', coalesce(v.familia_id, v_id)::text,
                                jsonb_build_object('para', p_programado_para));
  end if;
  perform registrar_ligacoes_comunicado(v_id, v, c);
  if p_acao = 'PUBLICAR' then
    v_versao := publicar_comunicado(v_id, p_pessoa, 'PUBLICADO');
  end if;
  return jsonb_build_object('id', v_id, 'versao', (select versao from comunicados where id = v_id));
end $$;

-- Corrigir o publicado (CD-01): nasce a versão seguinte, já publicada; a anterior fica como
-- substituída, com o texto guardado.
create function plataforma_corrigir_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_texto text, p_mudanca text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v comunicados;
  v_id uuid := gen_random_uuid();
  v_mudanca text;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
  v := exigir_comunicado(p_id);
  if v.estado <> 'PUBLICADO' then perform recusar_motivo('Só o comunicado publicado é corrigido', 'COMUNICADO_NAO_PUBLICADO'); end if;
  if v.versao <> p_versao then perform conflito_versao('comunicados', p_id); end if;
  if length(v_titulo) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if length(v_texto) not between 3 and 4000 then perform recusar_campos('Texto de 3 a 4000 caracteres', 'texto'); end if;
  if v_titulo = v.titulo and v_texto = v.texto then perform recusar_campos('Mude o título ou o texto', 'texto'); end if;
  v_mudanca := exigir_motivo(p_mudanca, 'mudanca');
  perform definir_transicao('SUBSTITUIDO', v_mudanca);
  update comunicados set estado = 'SUBSTITUIDO', substituido_em = app_now() where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('comunicados', p_id); end if;
  perform definir_transicao('CORRIGIDO', v_mudanca);
  insert into comunicados (id, condominio_id, familia_id, numero, anterior_id, assunto, titulo, texto, publico, blocos, unidades, contatos,
                           pedido_id, manutencao_id, estado, mudanca, publicado_em, publicado_por, destinatarios, assinatura, criado_por)
  values (v_id, p_condominio, v.familia_id, v.numero + 1, v.id, v.assunto, v_titulo, v_texto, v.publico, v.blocos, v.unidades, v.contatos,
          v.pedido_id, v.manutencao_id, 'PUBLICADO', v_mudanca, app_now(), p_pessoa,
          (select count(distinct contato_id) from destinatarios_comunicado(v.assunto, v.publico, v.blocos, v.unidades, v.contatos)),
          (select comunicados_assinatura from configuracao_condominio), p_pessoa);
  perform registrar_historico('comunicado.corrigido', 'comunicados', v.familia_id::text, jsonb_build_object(
    'comunicado', v_id, 'numero', v.numero + 1, 'mudanca', v_mudanca));
  return jsonb_build_object('id', v_id, 'versao', 1);
end $$;

-- Arquivar (CD-01): pede motivo e não volta. Nada é apagado.
create function plataforma_arquivar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v comunicados;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
  v := exigir_comunicado(p_id);
  if v.estado not in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO') then
    perform recusar_motivo('Este comunicado já não está em uso', 'COMUNICADO_FORA_DE_USO');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao('ARQUIVADO', v_motivo);
  update comunicados set estado = 'ARQUIVADO', arquivado_em = app_now(), arquivado_por = p_pessoa, motivo_arquivo = v_motivo
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('comunicados', p_id); end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Copiar o texto e imprimir para o mural ficam no histórico (o caminho até o morador agora).
create function plataforma_uso_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_uso text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v comunicados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  v := exigir_comunicado(p_id);
  if p_uso is null or p_uso not in ('COPIADO', 'MURAL') then perform recusar_campos('Copiar ou mural', 'uso'); end if;
  if v.estado <> 'PUBLICADO' then perform recusar_motivo('Só o comunicado publicado vai para o morador', 'COMUNICADO_NAO_PUBLICADO'); end if;
  perform registrar_historico(case p_uso when 'COPIADO' then 'comunicado.copiado' else 'comunicado.mural' end,
                              'comunicados', v.familia_id::text, jsonb_build_object('comunicado', v.id, 'numero', v.numero));
  return jsonb_build_object('ok', true);
end $$;

-- Os comunicados ligados a um pedido ou a uma manutenção (CD-05).
create function plataforma_comunicados_ligados(p_pessoa uuid, p_condominio uuid, p_pedido uuid, p_manutencao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if (p_pedido is null) = (p_manutencao is null) then perform recusar_campos('Um pedido ou uma manutenção', 'id'); end if;
  if p_pedido is not null then
    perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
    perform exigir_pedido(p_pessoa, p_pedido);
  else
    perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
    perform exigir_manutencao(p_manutencao);
  end if;
  if not pode(p_pessoa, p_condominio, 'comunicados.ver') then
    return jsonb_build_object('podeVer', false, 'podeEscrever', false, 'comunicados', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'podeVer', true,
    'podeEscrever', pode(p_pessoa, p_condominio, 'comunicados.publicar'),
    'comunicados', coalesce((
      select jsonb_agg(comunicado_json(c, p_pessoa) order by c.criado_em desc)
        from comunicados c
       where c.estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO')
         and (c.pedido_id = p_pedido or c.manutencao_id = p_manutencao)), '[]'::jsonb));
end $$;

-- Plano de comunicação (CD-11), nas Configurações.
create function plataforma_plano_comunicacao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return (select jsonb_strip_nulls(jsonb_build_object(
    'assuntos', to_jsonb(c.comunicados_assuntos), 'plano', c.comunicados_plano, 'assinatura', c.comunicados_assinatura,
    'silencioInicio', to_char(c.comunicados_silencio_inicio, 'HH24:MI'), 'silencioFim', to_char(c.comunicados_silencio_fim, 'HH24:MI'),
    'versao', c.versao, 'podeEditar', pode(p_pessoa, p_condominio, 'config.editar')))
    from configuracao_condominio c);
end $$;

create function plataforma_definir_plano_comunicacao(p_pessoa uuid, p_condominio uuid, p_versao integer, p_assuntos text[],
                                                     p_plano text, p_assinatura text, p_silencio_inicio time, p_silencio_fim time)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_assuntos text[];
  v_plano text := nullif(btrim(coalesce(p_plano, '')), '');
  v_assinatura text := nullif(btrim(coalesce(p_assinatura, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  select array_agg(a order by array_position(array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE'], a))
    into v_assuntos from (select distinct unnest(p_assuntos) a) x;
  if coalesce(cardinality(v_assuntos), 0) = 0 or not v_assuntos <@ array['AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE'] then
    perform recusar_campos('Deixe pelo menos um assunto em uso', 'assuntos');
  end if;
  if length(v_plano) > 2000 then perform recusar_campos('Plano até 2000 caracteres', 'plano'); end if;
  if length(v_assinatura) not between 2 and 120 then perform recusar_campos('Assinatura de 2 a 120 caracteres', 'assinatura'); end if;
  if p_silencio_inicio is null or p_silencio_fim is null then perform recusar_campos('Diga o horário sem envio', 'silencioInicio', 'silencioFim'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio
     set comunicados_assuntos = v_assuntos, comunicados_plano = v_plano, comunicados_assinatura = v_assinatura,
         comunicados_silencio_inicio = p_silencio_inicio, comunicados_silencio_fim = p_silencio_fim
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('plano_comunicacao.alterado', 'configuracao_condominio', v_antes.id::text, jsonb_build_object(
    'assuntos', to_jsonb(v_assuntos), 'com_plano', v_plano is not null, 'com_assinatura', v_assinatura is not null,
    'silencio', to_char(p_silencio_inicio, 'HH24:MI') || '-' || to_char(p_silencio_fim, 'HH24:MI')));
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- Fotos e PDF do comunicado (mesmas regras de 0100, até 4).

create function exigir_arquivo_comunicado(p_familia uuid, p_arquivo uuid) returns arquivos_comunicado
language plpgsql
set search_path = public
as $$
declare v arquivos_comunicado;
begin
  select * into v from arquivos_comunicado where id = p_arquivo and familia_id = p_familia and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function plataforma_iniciar_arquivo_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_nome text, p_tipo text,
                                                      p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
  c := exigir_comunicado(p_id);
  if c.estado not in ('RASCUNHO', 'PROGRAMADO') then
    perform recusar_motivo('Fotos e PDF entram antes de publicar', 'COMUNICADO_PUBLICADO');
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP) e PDF', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from comunicados where id = c.familia_id for update;
  if (select count(*) from arquivos_comunicado where familia_id = c.familia_id and retirado_em is null and situacao <> 'NAO_LIBERADO') >= 4 then
    perform recusar_motivo('O comunicado já tem 4 arquivos', 'LIMITE_ARQUIVOS_COMUNICADO');
  end if;
  v_caminho := p_condominio || '/' || c.familia_id || '/' || v_id;
  insert into arquivos_comunicado (id, condominio_id, familia_id, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, c.familia_id, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function plataforma_arquivo_comunicado_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  a arquivos_comunicado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  c := exigir_comunicado(p_id);
  a := exigir_arquivo_comunicado(c.familia_id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function plataforma_verificar_arquivo_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid,
                                                        p_liberado boolean, p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  a arquivos_comunicado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  c := exigir_comunicado(p_id);
  a := exigir_arquivo_comunicado(c.familia_id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_comunicado set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
    perform registrar_historico('comunicado.arquivo_enviado', 'comunicados', c.familia_id::text, jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome));
  else
    update arquivos_comunicado set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
    perform registrar_historico('comunicado.arquivo_recusado', 'comunicados', c.familia_id::text, jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome, 'motivo', btrim(p_motivo)));
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_abrir_arquivo_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  a arquivos_comunicado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  c := exigir_comunicado(p_id);
  a := exigir_arquivo_comunicado(c.familia_id, p_arquivo);
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

create function plataforma_tirar_arquivo_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comunicados;
  a arquivos_comunicado;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  c := exigir_comunicado(p_id);
  a := exigir_arquivo_comunicado(c.familia_id, p_arquivo);
  if not (a.enviado_por = p_pessoa or pode(p_pessoa, p_condominio, 'comunicados.publicar')) then
    raise exception 'Sem permissão para tirar este arquivo' using errcode = 'TC401';
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_comunicado set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  perform registrar_historico('comunicado.arquivo_tirado', 'comunicados', c.familia_id::text, jsonb_build_object(
    'arquivo', a.id, 'arquivoNome', a.nome, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Documentos (CD-07, CD-04, MP-12).

create function plataforma_documentos(p_pessoa uuid, p_condominio uuid, p_filtro text, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_restritos boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  if coalesce(p_filtro, 'VIGOR') not in ('VIGOR', 'CONVENCAO_REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'VENCENDO', 'ARQUIVADOS') then
    perform recusar_campos('Filtro desconhecido', 'filtro');
  end if;
  v_restritos := pode(p_pessoa, p_condominio, 'documentos.restritos');
  return (
    with visiveis as (select d.* from documentos d where not d.restrito or v_restritos),
    base as (
      select d.* from visiveis d
       where (case coalesce(p_filtro, 'VIGOR')
                when 'ARQUIVADOS' then d.arquivado_em is not null
                when 'CONVENCAO_REGIMENTO' then d.arquivado_em is null and d.tipo in ('CONVENCAO', 'REGIMENTO')
                when 'ATA' then d.arquivado_em is null and d.tipo = 'ATA'
                when 'CONTRATO' then d.arquivado_em is null and d.tipo = 'CONTRATO'
                when 'LAUDO' then d.arquivado_em is null and d.tipo = 'LAUDO'
                when 'VENCENDO' then d.arquivado_em is null and d.vale_ate is not null and d.vale_ate <= hoje_no_condominio() + 60
                else d.arquivado_em is null end)
         and (v_busca is null or lower(d.titulo) like '%' || v_busca || '%' or lower(coalesce(d.descricao, '')) like '%' || v_busca || '%'))
    select jsonb_build_object(
      'itens', coalesce((select jsonb_agg(documento_json(b::documentos)
                                          order by array_position(array['CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO'], b.tipo),
                                                   lower(b.titulo))
                           from base b), '[]'::jsonb),
      'total', (select count(*) from base),
      'vencendo', (select count(*) from visiveis d where d.arquivado_em is null and d.vale_ate is not null
                                                     and d.vale_ate <= hoje_no_condominio() + 60),
      'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'documentos.editar'), 'restritos', v_restritos)));
end $$;

create function plataforma_documento(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d documentos;
  v_editar boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  d := exigir_documento(p_pessoa, p_id);
  v_editar := pode(p_pessoa, p_condominio, 'documentos.editar');
  return jsonb_build_object(
    'documento', documento_json(d) || jsonb_strip_nulls(jsonb_build_object(
      'criadoPor', (select nome from pessoas where id = d.criado_por), 'criadoEm', d.criado_em,
      'arquivamento', case when d.arquivado_em is not null then jsonb_build_object('motivo', d.motivo_arquivo, 'em', d.arquivado_em,
                        'por', (select nome from pessoas where id = d.arquivado_por)) end)),
    'versoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', v.id, 'numero', v.numero, 'mudanca', v.mudanca, 'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'),
               'aprovadoEm', v.aprovado_em, 'nome', v.nome, 'tipo', v.tipo, 'tamanho', coalesce(v.tamanho, v.tamanho_declarado),
               'situacao', v.situacao, 'motivoRecusa', v.motivo_recusa, 'enviadoEm', v.enviado_em,
               'enviadoPor', (select nome from pessoas where id = v.enviado_por),
               'emVigor', v.id = (select x.id from versao_em_vigor(d.id) x)))
             order by v.numero desc nulls first, v.enviado_em desc)
        from versoes_documento v where v.documento_id = d.id
         and (v.situacao = 'LIBERADO' or v.enviado_por = p_pessoa)), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                          'dados', h.dados) order by h.ocorrido_em desc, h.id desc)
        from (select * from historico h where h.entidade = 'documentos' and h.entidade_id = d.id::text
               order by h.ocorrido_em desc, h.id desc limit 200) h), '[]'::jsonb),
    'pode', jsonb_build_object('editar', v_editar and d.arquivado_em is null, 'enviar', v_editar and d.arquivado_em is null,
                               'restritos', pode(p_pessoa, p_condominio, 'documentos.restritos')),
    'limites', jsonb_build_object('tamanho', 20971520),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- Guardar o documento (os dados; o arquivo entra como versão).
create function plataforma_salvar_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_tipo text, p_titulo text,
                                            p_descricao text, p_restrito boolean, p_ao_morador boolean, p_vale_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v documentos;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  if p_tipo is null or p_tipo not in ('CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO') then
    perform recusar_campos('Escolha o tipo', 'tipo');
  end if;
  if length(v_titulo) not between 3 and 120 then perform recusar_campos('Nome de 3 a 120 caracteres', 'titulo'); end if;
  if length(v_descricao) not between 2 and 500 then perform recusar_campos('Descrição de 2 a 500 caracteres', 'descricao'); end if;
  if coalesce(p_restrito, false) and coalesce(p_ao_morador, false) then
    perform recusar_campos('Documento só da gestão não vai ao morador', 'aoMorador');
  end if;
  if coalesce(p_restrito, false) and not pode(p_pessoa, p_condominio, 'documentos.restritos') then
    perform recusar_campos('Só quem cuida dos documentos guarda documento restrito', 'restrito');
  end if;
  if p_vale_ate is not null and p_vale_ate not between date '2000-01-01' and date '2100-12-31' then
    perform recusar_campos('Data fora do esperado', 'valeAte');
  end if;
  if exists (select 1 from documentos where lower(btrim(titulo)) = lower(v_titulo) and arquivado_em is null and id is distinct from p_id) then
    perform recusar_campos('Já existe um documento com esse nome', 'titulo');
  end if;
  if p_id is null then
    insert into documentos (condominio_id, tipo, titulo, descricao, restrito, ao_morador, vale_ate, criado_por)
    values (p_condominio, p_tipo, v_titulo, v_descricao, coalesce(p_restrito, false), coalesce(p_ao_morador, false), p_vale_ate, p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico('documento.criado', 'documentos', v_id::text, jsonb_build_object(
      'tipo', p_tipo, 'restrito', coalesce(p_restrito, false), 'aoMorador', coalesce(p_ao_morador, false)));
  else
    v := exigir_documento(p_pessoa, p_id);
    if v.arquivado_em is not null then perform recusar_motivo('Documento arquivado não muda', 'DOCUMENTO_ARQUIVADO'); end if;
    if v.versao <> p_versao then perform conflito_versao('documentos', p_id); end if;
    update documentos set tipo = p_tipo, titulo = v_titulo, descricao = v_descricao, restrito = coalesce(p_restrito, false),
                          ao_morador = coalesce(p_ao_morador, false), vale_ate = p_vale_ate
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_versao is null then perform conflito_versao('documentos', p_id); end if;
    perform registrar_historico('documento.alterado', 'documentos', v_id::text, jsonb_build_object(
      'campos', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (values
          ('tipo', v.tipo is distinct from p_tipo), ('titulo', v.titulo is distinct from v_titulo),
          ('descricao', v.descricao is distinct from v_descricao), ('restrito', v.restrito is distinct from coalesce(p_restrito, false)),
          ('aoMorador', v.ao_morador is distinct from coalesce(p_ao_morador, false)),
          ('valeAte', v.vale_ate is distinct from p_vale_ate)) t(k, mudou) where mudou)));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function plataforma_arquivar_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v documentos;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  v := exigir_documento(p_pessoa, p_id);
  if v.arquivado_em is not null then perform recusar_motivo('Documento já arquivado', 'DOCUMENTO_ARQUIVADO'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update documentos set arquivado_em = app_now(), arquivado_por = p_pessoa, motivo_arquivo = v_motivo
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('documentos', p_id); end if;
  perform registrar_historico('documento.arquivado', 'documentos', p_id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Nova versão: o arquivo, o que mudou e a data em que passa a valer (CD-07).
create function plataforma_iniciar_versao_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_nome text, p_tipo text,
                                                    p_tamanho integer, p_mudanca text, p_vigente_desde date, p_aprovado_em text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d documentos;
  v_id uuid := gen_random_uuid();
  v_caminho text;
  v_mudanca text := nullif(btrim(coalesce(p_mudanca, '')), '');
  v_aprovado text := nullif(btrim(coalesce(p_aprovado_em, '')), '');
  v_tem boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  d := exigir_documento(p_pessoa, p_id);
  if d.arquivado_em is not null then perform recusar_motivo('Documento arquivado não recebe versão', 'DOCUMENTO_ARQUIVADO'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só PDF ou fotos (JPG, PNG, WEBP)', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 20971520 then perform recusar_motivo('Arquivo com mais de 20 MB', 'DOCUMENTO_GRANDE'); end if;
  if p_vigente_desde is null or p_vigente_desde not between date '1950-01-01' and hoje_no_condominio() + 731 then
    perform recusar_campos('Diga desde quando vale', 'vigenteDesde');
  end if;
  if length(v_aprovado) not between 2 and 120 then perform recusar_campos('Onde foi aprovado: de 2 a 120 caracteres', 'aprovadoEm'); end if;
  v_tem := exists (select 1 from versoes_documento where documento_id = d.id and situacao = 'LIBERADO');
  -- A primeira versão não precisa dizer o que mudou; as seguintes, sim.
  if v_tem and length(coalesce(v_mudanca, '')) not between 3 and 500 then
    perform recusar_campos('Diga o que mudou (de 3 a 500 caracteres)', 'mudanca');
  end if;
  if length(v_mudanca) not between 3 and 500 then perform recusar_campos('O que mudou: de 3 a 500 caracteres', 'mudanca'); end if;
  v_caminho := p_condominio || '/' || d.id || '/' || v_id;
  insert into versoes_documento (id, condominio_id, documento_id, mudanca, vigente_desde, aprovado_em, nome, tipo, tamanho_declarado,
                                 caminho, enviado_por)
  values (v_id, p_condominio, d.id, v_mudanca, p_vigente_desde, v_aprovado, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('versaoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function exigir_versao_documento(p_documento uuid, p_versao uuid) returns versoes_documento
language plpgsql
set search_path = public
as $$
declare v versoes_documento;
begin
  select * into v from versoes_documento where id = p_versao and documento_id = p_documento;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function plataforma_versao_documento_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v versoes_documento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  perform exigir_documento(p_pessoa, p_id);
  v := exigir_versao_documento(p_id, p_versao);
  if v.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if v.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', v.caminho, 'tipo', v.tipo);
end $$;

-- Liberado, o arquivo ganha o número da versão seguinte.
create function plataforma_verificar_versao_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao uuid,
                                                      p_liberado boolean, p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_documento;
  v_numero integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  perform exigir_documento(p_pessoa, p_id);
  v := exigir_versao_documento(p_id, p_versao);
  if v.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if v.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    perform 1 from documentos where id = p_id for update;
    select coalesce(max(numero), 0) + 1 into v_numero from versoes_documento where documento_id = p_id;
    update versoes_documento set situacao = 'LIBERADO', tamanho = p_tamanho, numero = v_numero, verificado_em = app_now() where id = v.id;
    update documentos set atualizado_em = app_now() where id = p_id;
    perform registrar_historico('documento.versao_guardada', 'documentos', p_id::text, jsonb_strip_nulls(jsonb_build_object(
      'versao', v.id, 'numero', v_numero, 'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'), 'mudanca', v.mudanca)));
  else
    update versoes_documento set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = v.id;
    perform registrar_historico('documento.versao_recusada', 'documentos', p_id::text, jsonb_build_object(
      'versao', v.id, 'arquivoNome', v.nome, 'motivo', btrim(p_motivo)));
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end, 'numero', v_numero);
end $$;

-- Abrir ou baixar uma versão: cada vez fica no histórico do documento (CD-04).
create function plataforma_abrir_versao_documento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao uuid, p_baixar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v versoes_documento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  perform exigir_documento(p_pessoa, p_id);
  v := exigir_versao_documento(p_id, p_versao);
  if v.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  perform registrar_historico(case when coalesce(p_baixar, false) then 'documento.baixado' else 'documento.aberto' end,
                              'documentos', p_id::text, jsonb_build_object('versao', v.id, 'numero', v.numero));
  return jsonb_build_object('caminho', v.caminho, 'nome', v.nome, 'tipo', v.tipo);
end $$;

-- ---------------------------------------------------------------------------------------
-- Rotina dos comunicados e documentos: a cada 5 minutos, pelo pg_cron do Supabase. Onde o
-- pg_cron não existe (o banco dos testes), a rotina é chamada direto.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-comunicados', '*/5 * * * *', 'select public.verificar_comunicados()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_comunicados() de outro jeito (%).', sqlerrm;
end $$;

call fechar_acesso();

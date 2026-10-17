-- 0140 · Manutenção e prestadores (peça R6; MP-01, MP-02, MP-03, MP-04, MP-05, MP-07, MP-09 em
-- parte, MP-13). Telas e decisões aprovadas pela Carolina em 17/10/2026 (docs/telas/manutencao.html).
--
-- Regras desta parte:
-- 1. Permissões (CF-03): Ver a manutenção e Cuidar da manutenção, dadas pelo síndico. O
--    cadastro de prestadores fica em Cuidar da manutenção; telefone e e-mail dos prestadores só
--    aparecem a quem vê a manutenção. O morador não vê a manutenção nesta etapa.
-- 2. Manutenção não é pedido (MP-04): ligar a um pedido é opcional e só no mesmo condomínio.
--    Concluir a manutenção não encerra o pedido; cancelar a visita não apaga a manutenção.
-- 3. Situações fixas (MP-02): planejada, em andamento, pendente, concluída e cancelada. Pendente
--    pede tipo e motivo, com os tipos de pendência dos pedidos. Concluída e cancelada só voltam
--    reabrindo com motivo. Cada condomínio cria etapas dentro das situações, nas Configurações.
-- 4. Tipos (MP-03, MP-07): corretiva, preventiva e vistoria. A vistoria tem a lista do que olhar
--    feita para ela; cada item fica certo, com problema ou não deu, e um item com problema pode
--    abrir uma manutenção corretiva ligada à vistoria.
-- 5. Preventivas (MP-03, MP-13): frequência em semanas, meses ou anos. A manutenção abre sozinha
--    alguns dias antes (padrão 15). A próxima data conta a partir da data prevista, para o
--    calendário não escorregar; o atraso fica visível.
-- 6. Prestadores (MP-05, MP-09): cadastro do condomínio, que fica quando o síndico muda; com
--    contrato (com vigência) ou por chamado; registrar não é contratar; arquivar não apaga; cada
--    um pode ter uma reserva indicada. A troca automática para a reserva chega com o WhatsApp.
-- 7. Quem executa (MP-01, MP-07): um prestador do cadastro, alguém da equipe (pessoa com acesso)
--    ou um nome escrito à mão, ou ninguém ainda. Nada é atribuído sozinho.
-- 8. Retorno e previsão (MP-01): separados, como nos pedidos; mudar qualquer um pede motivo. O
--    retorno vencido avisa o responsável no sino, uma vez por vencimento. Os prazos dos pedidos
--    não mudam.
-- 9. Fotos e documentos com as regras dos pedidos (0100), no bucket privado "manutencoes".
-- 10. Agenda (MP-04, AG-09): a visita marcada a partir da manutenção fica ligada a ela, e as
--    preventivas entram na agenda como datas de outra tela, para quem vê a manutenção.

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_MANUTENCAO', 'Ver a manutenção', 'Ver as manutenções, as preventivas e os prestadores do condomínio.', 11),
  ('MANUTENCAO', 'Cuidar da manutenção', 'Registrar e acompanhar manutenções, preventivas, vistorias e o cadastro de prestadores.', 12);
insert into permissao_acoes (permissao, acao) values
  ('VER_MANUTENCAO', 'manutencao.ver'),
  ('MANUTENCAO', 'manutencao.ver'),
  ('MANUTENCAO', 'manutencao.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'manutencao.ver'),
  ('SINDICO', 'manutencao.editar');

-- ---------------------------------------------------------------------------------------
-- Prestadores (MP-05).

create table prestadores (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  nome                text not null check (length(btrim(nome)) between 2 and 120),
  servico             text not null check (length(btrim(servico)) between 2 and 80),
  contato             text check (length(btrim(contato)) between 2 and 120),
  telefone            text check (telefone_valido(telefone)),
  email               text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  documento           text check (documento ~ '^[0-9./-]{11,18}$'),
  acordo              text not null check (acordo in ('CONTRATO', 'CHAMADO')),
  contrato_ate        date,
  desde               date,
  reserva_id          uuid,
  observacao          text check (length(btrim(observacao)) between 1 and 1000),
  arquivado_em        timestamptz,
  arquivado_por       uuid references pessoas (id),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid not null references pessoas (id),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  unique (id, condominio_id),
  foreign key (reserva_id, condominio_id) references prestadores (id, condominio_id),
  check (reserva_id is null or reserva_id <> id),
  check (contrato_ate is null or acordo = 'CONTRATO'),
  check ((arquivado_em is null) = (arquivado_por is null))
);
create unique index prestadores_nome_ativo on prestadores (condominio_id, lower(btrim(nome))) where arquivado_em is null;
call proteger_tabela_condominio('prestadores');
create trigger prestadores_sem_exclusao before delete on prestadores for each row execute function somente_insercao();

create function prestadores_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then new.atualizado_em := app_now(); end if;
  return new;
end $$;
create trigger prestadores_regras before update on prestadores for each row execute function prestadores_regras();

-- ---------------------------------------------------------------------------------------
-- Etapas da manutenção (MP-02): ajustáveis por condomínio, sempre dentro de uma situação fixa.

create table etapas_manutencao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 2 and 40),
  situacao      text not null check (situacao in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDA')),
  ordem         smallint not null check (ordem between 1 and 100),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  unique (id, condominio_id)
);
create unique index etapas_manutencao_nome_ativo on etapas_manutencao (condominio_id, situacao, lower(btrim(nome))) where ativa;
call proteger_tabela_condominio('etapas_manutencao');
create trigger etapas_manutencao_sem_exclusao before delete on etapas_manutencao for each row execute function somente_insercao();

create function etapas_manutencao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.situacao <> old.situacao then
    raise exception 'A situação da etapa não muda: crie outra etapa' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger etapas_manutencao_regras before update on etapas_manutencao for each row execute function etapas_manutencao_regras();

-- ---------------------------------------------------------------------------------------
-- Preventivas (MP-03, MP-13): o que se repete.

create table preventivas (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  atividade         text not null check (length(btrim(atividade)) between 3 and 120),
  local             text not null check (length(btrim(local)) between 2 and 120),
  unidade_tempo     text not null check (unidade_tempo in ('SEMANA', 'MES', 'ANO')),
  intervalo         smallint not null check (intervalo between 1 and 60),
  proxima_data      date not null check (proxima_data between date '2000-01-01' and date '2100-12-31'),
  antecedencia_dias smallint not null default 15 check (antecedencia_dias between 0 and 90),
  responsavel_id    uuid not null,
  prestador_id      uuid,
  executor_vinculo  uuid,
  executor_texto    text check (length(btrim(executor_texto)) between 2 and 120),
  observacao        text check (length(btrim(observacao)) between 1 and 1000),
  ativa             boolean not null default true,
  criado_em         timestamptz not null default app_now(),
  criado_por        uuid not null references pessoas (id),
  atualizado_em     timestamptz not null default app_now(),
  versao            integer not null default 1,
  unique (id, condominio_id),
  foreign key (responsavel_id, condominio_id) references vinculos (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  foreign key (executor_vinculo, condominio_id) references vinculos (id, condominio_id),
  check (num_nonnulls(prestador_id, executor_vinculo, executor_texto) <= 1)
);
call proteger_tabela_condominio('preventivas');
create trigger preventivas_sem_exclusao before delete on preventivas for each row execute function somente_insercao();
create trigger preventivas_regras before update on preventivas for each row execute function prestadores_regras();

-- ---------------------------------------------------------------------------------------
-- Manutenções (MP-01, MP-02, MP-03, MP-07).

create table manutencoes (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  tipo                text not null check (tipo in ('CORRETIVA', 'PREVENTIVA', 'VISTORIA')),
  titulo              text not null check (length(btrim(titulo)) between 3 and 120),
  local               text not null check (length(btrim(local)) between 2 and 120),
  detalhes            text check (length(btrim(detalhes)) between 1 and 2000),
  prioridade_id       uuid,
  responsavel_id      uuid not null,
  prestador_id        uuid,
  executor_vinculo    uuid,
  executor_texto      text check (length(btrim(executor_texto)) between 2 and 120),
  estado              text not null check (estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDA', 'CANCELADA')),
  etapa_id            uuid,
  proximo_retorno     timestamptz,
  previsao            date check (previsao between date '2000-01-01' and date '2100-12-31'),
  -- Data da preventiva que gerou esta manutenção; não muda com a previsão.
  data_prevista       date,
  pendencia_tipo      text check (pendencia_tipo in ('FORNECEDOR', 'MORADOR', 'DECISAO', 'PECA', 'ACESSO', 'SEM_EXECUTOR', 'OUTRO')),
  pendencia_motivo    text check (length(btrim(pendencia_motivo)) between 3 and 300),
  pendente_desde      timestamptz,
  -- Vistoria (MP-07): como se chega e o que impede.
  acesso              text check (length(btrim(acesso)) between 2 and 300),
  impedimento         text check (length(btrim(impedimento)) between 2 and 300),
  pedido_id           uuid,
  preventiva_id       uuid,
  origem_id           uuid,
  conclusao           text check (length(btrim(conclusao)) between 10 and 2000),
  realizada_em        date,
  concluida_em        timestamptz,
  concluida_por       uuid references pessoas (id),
  cancelada_em        timestamptz,
  cancelada_por       uuid references pessoas (id),
  motivo_cancelamento text check (length(btrim(motivo_cancelamento)) between 3 and 500),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid references pessoas (id),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  unique (id, condominio_id),
  foreign key (prioridade_id, condominio_id) references prioridades (id, condominio_id),
  foreign key (responsavel_id, condominio_id) references vinculos (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  foreign key (executor_vinculo, condominio_id) references vinculos (id, condominio_id),
  foreign key (etapa_id, condominio_id) references etapas_manutencao (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (preventiva_id, condominio_id) references preventivas (id, condominio_id),
  foreign key (origem_id, condominio_id) references manutencoes (id, condominio_id),
  check (num_nonnulls(prestador_id, executor_vinculo, executor_texto) <= 1),
  check (preventiva_id is null or tipo = 'PREVENTIVA'),
  check ((preventiva_id is null) = (data_prevista is null)),
  check ((estado = 'PENDENTE') = (pendencia_tipo is not null)
         and (pendencia_tipo is null) = (pendencia_motivo is null) and (pendencia_tipo is null) = (pendente_desde is null)),
  check ((estado = 'CONCLUIDA') = (concluida_em is not null)
         and (concluida_em is null) = (concluida_por is null) and (concluida_em is null) = (realizada_em is null)
         and (concluida_em is null) = (conclusao is null)),
  check ((estado = 'CANCELADA') = (cancelada_em is not null)
         and (cancelada_em is null) = (cancelada_por is null) and (cancelada_em is null) = (motivo_cancelamento is null)),
  check (estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') or proximo_retorno is null),
  check (origem_id is null or origem_id <> id)
);
create index manutencoes_estado on manutencoes (condominio_id, estado);
create index manutencoes_pedido on manutencoes (pedido_id) where pedido_id is not null;
create index manutencoes_preventiva on manutencoes (preventiva_id, data_prevista) where preventiva_id is not null;
create index manutencoes_prestador on manutencoes (prestador_id) where prestador_id is not null;
create unique index manutencoes_uma_por_data on manutencoes (preventiva_id, data_prevista) where preventiva_id is not null;
call proteger_tabela_condominio('manutencoes');
call ligar_guardiao('manutencoes');
insert into estados_iniciais (tabela, estado) values
  ('manutencoes', 'PLANEJADA'), ('manutencoes', 'EM_ANDAMENTO');
insert into transicoes_permitidas (tabela, de, para) values
  ('manutencoes', 'PLANEJADA', 'EM_ANDAMENTO'),
  ('manutencoes', 'EM_ANDAMENTO', 'PLANEJADA'),
  ('manutencoes', 'PLANEJADA', 'PENDENTE'),
  ('manutencoes', 'EM_ANDAMENTO', 'PENDENTE'),
  ('manutencoes', 'PENDENTE', 'EM_ANDAMENTO'),
  ('manutencoes', 'PENDENTE', 'PLANEJADA'),
  ('manutencoes', 'PLANEJADA', 'CONCLUIDA'),
  ('manutencoes', 'EM_ANDAMENTO', 'CONCLUIDA'),
  ('manutencoes', 'PENDENTE', 'CONCLUIDA'),
  ('manutencoes', 'PLANEJADA', 'CANCELADA'),
  ('manutencoes', 'EM_ANDAMENTO', 'CANCELADA'),
  ('manutencoes', 'PENDENTE', 'CANCELADA'),
  ('manutencoes', 'CONCLUIDA', 'EM_ANDAMENTO'),
  ('manutencoes', 'CANCELADA', 'PLANEJADA');
create trigger manutencoes_sem_exclusao before delete on manutencoes for each row execute function somente_insercao();

-- A etapa combina com a situação; a preventiva e a vistoria de origem não mudam depois.
create function manutencoes_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.etapa_id is not null and not exists (
       select 1 from etapas_manutencao e where e.id = new.etapa_id and e.situacao = new.estado) then
    raise exception 'A etapa não combina com a situação da manutenção' using errcode = 'TC422';
  end if;
  if tg_op = 'UPDATE' then
    if (new.tipo, new.preventiva_id, new.data_prevista, new.origem_id, new.criado_em, new.criado_por)
       is distinct from (old.tipo, old.preventiva_id, old.data_prevista, old.origem_id, old.criado_em, old.criado_por) then
      raise exception 'Tipo e origem da manutenção não mudam' using errcode = 'TC422';
    end if;
    new.atualizado_em := app_now();
  end if;
  return new;
end $$;
create trigger manutencoes_regras before insert or update on manutencoes for each row execute function manutencoes_regras();

-- Providências (MP-02): o que fazer, quem executa e o resultado.
create table providencias_manutencao (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  manutencao_id    uuid not null,
  texto            text not null check (length(btrim(texto)) between 3 and 300),
  prestador_id     uuid,
  executor_vinculo uuid,
  executor_texto   text check (length(btrim(executor_texto)) between 2 and 120),
  feita_em         timestamptz,
  feita_por        uuid references pessoas (id),
  resultado        text check (length(btrim(resultado)) between 2 and 1000),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  foreign key (executor_vinculo, condominio_id) references vinculos (id, condominio_id),
  check (num_nonnulls(prestador_id, executor_vinculo, executor_texto) <= 1),
  check ((feita_em is null) = (feita_por is null) and (resultado is null or feita_em is not null))
);
create index providencias_manutencao_m on providencias_manutencao (manutencao_id, criado_em);
call proteger_tabela_condominio('providencias_manutencao');
create trigger providencias_manutencao_sem_exclusao before delete on providencias_manutencao for each row execute function somente_insercao();

-- A providência feita não volta.
create function providencias_manutencao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.feita_em is not null then raise exception 'Providência feita não muda' using errcode = 'TC422'; end if;
  if (new.manutencao_id, new.texto, new.criado_em, new.criado_por) is distinct from (old.manutencao_id, old.texto, old.criado_em, old.criado_por) then
    raise exception 'O que foi combinado na providência não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger providencias_manutencao_regras before update on providencias_manutencao
  for each row execute function providencias_manutencao_regras();

-- Itens da vistoria (MP-07): a lista é de cada vistoria.
create table itens_vistoria (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  manutencao_id    uuid not null,
  texto            text not null check (length(btrim(texto)) between 2 and 200),
  ordem            smallint not null check (ordem between 1 and 100),
  ativo            boolean not null default true,
  resultado        text check (resultado in ('CERTO', 'PROBLEMA', 'NAO_DEU')),
  observacao       text check (length(btrim(observacao)) between 2 and 500),
  respondido_em    timestamptz,
  respondido_por   uuid references pessoas (id),
  gerada_id        uuid,
  criado_em        timestamptz not null default app_now(),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (gerada_id, condominio_id) references manutencoes (id, condominio_id),
  unique (id, condominio_id),
  check ((resultado is null) = (respondido_em is null) and (respondido_em is null) = (respondido_por is null)),
  check (gerada_id is null or resultado = 'PROBLEMA')
);
create index itens_vistoria_m on itens_vistoria (manutencao_id, ordem);
call proteger_tabela_condominio('itens_vistoria');
create trigger itens_vistoria_sem_exclusao before delete on itens_vistoria for each row execute function somente_insercao();

-- Fotos e documentos da manutenção (regras de 0100). O item é opcional (a foto do item da vistoria).
create table arquivos_manutencao (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  manutencao_id      uuid not null,
  item_id            uuid,
  nome               text not null check (length(btrim(nome)) between 1 and 200),
  descricao          text check (length(btrim(descricao)) between 2 and 300),
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
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (item_id, condominio_id) references itens_vistoria (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_manutencao_m on arquivos_manutencao (manutencao_id, enviado_em);
call proteger_tabela_condominio('arquivos_manutencao');
create trigger arquivos_manutencao_sem_exclusao before delete on arquivos_manutencao for each row execute function somente_insercao();

create function arquivos_manutencao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.manutencao_id, new.item_id, new.nome, new.descricao, new.tipo, new.tamanho_declarado,
      new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.manutencao_id, old.item_id, old.nome, old.descricao, old.tipo, old.tamanho_declarado,
      old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'O arquivo da manutenção não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
     is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'O arquivo já foi verificado' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'O arquivo já foi tirado da manutenção' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger arquivos_manutencao_regras before update on arquivos_manutencao for each row execute function arquivos_manutencao_regras();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('manutencoes', 'manutencoes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- Avisos da manutenção no sino (retorno vencido), separados dos avisos dos pedidos.
create table avisos_manutencao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  manutencao_id uuid not null,
  tipo          text not null check (tipo in ('RETORNO_VENCIDO')),
  referencia    timestamptz not null,
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  unique (pessoa_id, manutencao_id, tipo, referencia)
);
create index avisos_manutencao_pessoa on avisos_manutencao (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_manutencao');
create trigger avisos_manutencao_sem_exclusao before delete on avisos_manutencao for each row execute function somente_insercao();

create function avisos_manutencao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.manutencao_id, new.tipo, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.manutencao_id, old.tipo, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_manutencao_regras before update on avisos_manutencao for each row execute function avisos_manutencao_regras();

-- A visita da agenda pode ficar ligada à manutenção (MP-04).
alter table compromissos add column manutencao_id uuid;
alter table compromissos add constraint compromissos_manutencao
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id);
create index compromissos_manutencao on compromissos (manutencao_id) where manutencao_id is not null;

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function exigir_manutencao(p_id uuid) returns manutencoes
language plpgsql
set search_path = public
as $$
declare v manutencoes;
begin
  select * into v from manutencoes where id = p_id;
  if not found then raise exception 'Manutenção não encontrada' using errcode = 'TC404'; end if;
  return v;
end $$;

create function exigir_manutencao_aberta(p_m manutencoes) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_m.estado in ('CONCLUIDA', 'CANCELADA') then
    perform recusar_motivo('Manutenção concluída ou cancelada: reabra para mudar', 'MANUTENCAO_ENCERRADA');
  end if;
end $$;

-- Sobe a versão da manutenção lida (AT-24).
create function tocar_manutencao(p_id uuid, p_versao integer) returns integer
language plpgsql
set search_path = public
as $$
declare v_versao integer;
begin
  update manutencoes set atualizado_em = app_now() where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  return v_versao;
end $$;

-- Pessoa com acesso ao condomínio do contexto (síndico ou autorizado), com o vínculo ativo.
create function vinculo_com_acesso(p_vinculo uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from vinculos where id = p_vinculo and funcao in ('SINDICO', 'AUTORIZADO') and revogado_em is null)
$$;

-- O responsável precisa enxergar a manutenção.
create function exigir_responsavel_manutencao(p_vinculo uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_vinculo is null or not vinculo_com_acesso(p_vinculo)
     or not pode(pessoa_do_vinculo(p_vinculo), contexto_condominio(), 'manutencao.ver') then
    perform recusar_campos('Responsável: pessoa com acesso que vê a manutenção', 'responsavelId');
  end if;
end $$;

-- Quem executa: um prestador ativo, uma pessoa com acesso ou um nome escrito à mão (ou ninguém).
create function exigir_executor(p_prestador uuid, p_vinculo uuid, p_texto text) returns text
language plpgsql
set search_path = public
as $$
declare v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if num_nonnulls(p_prestador, p_vinculo, v_texto) > 1 then
    perform recusar_campos('Quem executa: um prestador, alguém da equipe ou um nome', 'executor');
  end if;
  if p_prestador is not null and not exists (select 1 from prestadores where id = p_prestador and arquivado_em is null) then
    perform recusar_campos('Prestador não encontrado no cadastro', 'executor');
  end if;
  if p_vinculo is not null and not vinculo_com_acesso(p_vinculo) then
    perform recusar_campos('Pessoa sem acesso ao condomínio', 'executor');
  end if;
  if length(v_texto) not between 2 and 120 then perform recusar_campos('Nome de quem executa de 2 a 120 caracteres', 'executor'); end if;
  return v_texto;
end $$;

create function executor_json(p_prestador uuid, p_vinculo uuid, p_texto text) returns jsonb
language sql stable
set search_path = public
as $$
  select case
    when p_prestador is not null then (select jsonb_build_object('tipo', 'PRESTADOR', 'id', x.id, 'nome', x.nome) from prestadores x where x.id = p_prestador)
    when p_vinculo is not null then jsonb_build_object('tipo', 'EQUIPE', 'id', p_vinculo, 'nome', nome_do_vinculo(p_vinculo))
    when p_texto is not null then jsonb_build_object('tipo', 'TEXTO', 'nome', p_texto) end
$$;

-- Próxima data de uma preventiva: a partir da data prevista, pulando até passar da data dada.
create function proxima_da_preventiva(p_unidade text, p_intervalo integer, p_base date, p_depois_de date) returns date
language plpgsql immutable
set search_path = public
as $$
declare
  v_d date := p_base;
  v_passo interval := case p_unidade when 'SEMANA' then make_interval(weeks => p_intervalo)
                                     when 'MES' then make_interval(months => p_intervalo)
                                     else make_interval(years => p_intervalo) end;
  v_k integer := 1;
begin
  loop
    -- Sempre a partir da data base, para o fim de mês não escorregar (31 → 28 → 28...).
    v_d := (p_base + v_passo * v_k)::date;
    exit when v_d > p_depois_de or v_k > 5000;
    v_k := v_k + 1;
  end loop;
  return v_d;
end $$;

-- Retorno vencido da manutenção: aberta e com o retorno combinado no passado.
create function manutencao_retorno_vencido(p_m manutencoes) returns boolean
language sql stable
set search_path = public
as $$ select p_m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') and p_m.proximo_retorno is not null and p_m.proximo_retorno < app_now() $$;

-- Preventiva atrasada: aberta, gerada por uma preventiva, com a data prevista no passado.
create function manutencao_atrasada(p_m manutencoes) returns boolean
language sql stable
set search_path = public
as $$ select p_m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') and p_m.data_prevista is not null and p_m.data_prevista < hoje_no_condominio() $$;

-- A manutenção como as listas recebem.
create function manutencao_json(m manutencoes, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'tipo', m.tipo, 'titulo', m.titulo, 'local', m.local, 'estado', m.estado,
    'etapa', (select jsonb_build_object('id', e.id, 'nome', e.nome) from etapas_manutencao e where e.id = m.etapa_id),
    'prioridade', (select jsonb_build_object('id', x.id, 'nome', x.nome, 'nivel', x.nivel) from prioridades x where x.id = m.prioridade_id),
    'responsavel', jsonb_build_object('vinculoId', m.responsavel_id, 'nome', nome_do_vinculo(m.responsavel_id)),
    'executor', executor_json(m.prestador_id, m.executor_vinculo, m.executor_texto),
    'proximoRetorno', m.proximo_retorno, 'retornoVencido', manutencao_retorno_vencido(m),
    'previsao', to_char(m.previsao, 'YYYY-MM-DD'), 'dataPrevista', to_char(m.data_prevista, 'YYYY-MM-DD'),
    'atrasada', manutencao_atrasada(m),
    'pendencia', case when m.estado = 'PENDENTE' then jsonb_build_object('tipo', m.pendencia_tipo, 'motivo', m.pendencia_motivo,
                                                                         'desde', m.pendente_desde) end,
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto, 'estado', p.estado)
                 from pedidos p where p.id = m.pedido_id
                  and pode(p_pessoa, m.condominio_id, 'pedidos.ver') and pedido_visivel(p_pessoa, p)),
    'preventivaId', m.preventiva_id,
    'visita', case when pode(p_pessoa, m.condominio_id, 'agenda.ver') then (
      select jsonb_build_object('id', c.id, 'data', to_char(c.data, 'YYYY-MM-DD'), 'horaInicio', to_char(c.hora_inicio, 'HH24:MI'))
        from compromissos c where c.manutencao_id = m.id and c.estado in ('PLANEJADO', 'A_CONFIRMAR', 'CONFIRMADO')
         and c.data >= hoje_no_condominio()
       order by c.data, c.hora_inicio nulls first limit 1) end,
    'realizadaEm', to_char(m.realizada_em, 'YYYY-MM-DD'), 'concluidaEm', m.concluida_em,
    'criadoEm', m.criado_em, 'versao', m.versao))
$$;

-- Manutenções que se repetem: abre a manutenção da preventiva quando chega a hora (MP-03).
-- Uma por data prevista; devolve quantas abriu. Roda no condomínio do contexto.
create function abrir_preventivas() returns integer
language plpgsql
set search_path = public
as $$
declare
  p preventivas;
  v_id uuid;
  v_n integer := 0;
begin
  for p in select * from preventivas x
            where x.ativa and x.proxima_data - x.antecedencia_dias <= hoje_no_condominio()
              and not exists (select 1 from manutencoes m where m.preventiva_id = x.id and m.data_prevista = x.proxima_data)
              and vinculo_com_acesso(x.responsavel_id) loop
    perform definir_transicao('PREVENTIVA', null, contexto_pessoa() is null);
    insert into manutencoes (condominio_id, tipo, titulo, local, responsavel_id, prestador_id, executor_vinculo, executor_texto,
                             estado, previsao, data_prevista, preventiva_id, detalhes, criado_por)
    values (p.condominio_id, 'PREVENTIVA', p.atividade, p.local, p.responsavel_id,
            case when exists (select 1 from prestadores where id = p.prestador_id and arquivado_em is null) then p.prestador_id end,
            case when vinculo_com_acesso(p.executor_vinculo) then p.executor_vinculo end, p.executor_texto,
            'PLANEJADA', p.proxima_data, p.proxima_data, p.id, p.observacao, contexto_pessoa())
    returning id into v_id;
    perform registrar_historico('manutencao.registrada', 'manutencoes', v_id::text, jsonb_build_object(
      'tipo', 'PREVENTIVA', 'preventiva', p.id, 'dataPrevista', to_char(p.proxima_data, 'YYYY-MM-DD')));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- A preventiva anda depois que a manutenção da data prevista termina (concluída ou cancelada).
create function avancar_preventiva(p_m manutencoes, p_depois_de date) returns void
language plpgsql
set search_path = public
as $$
declare p preventivas;
begin
  if p_m.preventiva_id is null then return; end if;
  select * into p from preventivas where id = p_m.preventiva_id;
  if p.proxima_data <> p_m.data_prevista then return; end if;
  update preventivas set proxima_data = proxima_da_preventiva(p.unidade_tempo, p.intervalo, p_m.data_prevista,
                                                              greatest(p_depois_de, p_m.data_prevista))
   where id = p.id;
  perform registrar_historico('preventiva.avancou', 'preventivas', p.id::text, jsonb_build_object(
    'de', to_char(p_m.data_prevista, 'YYYY-MM-DD'),
    'para', to_char((select proxima_data from preventivas where id = p.id), 'YYYY-MM-DD'), 'manutencao', p_m.id));
end $$;

-- Retorno vencido: avisa o responsável uma vez por vencimento (sem responsável ativo, o síndico).
create function avisar_manutencoes(p_agora timestamptz) returns integer
language plpgsql
set search_path = public
as $$
declare
  m manutencoes;
  v_pessoas uuid[];
  v_n integer;
  v_total integer := 0;
begin
  for m in select * from manutencoes x where x.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')
                                         and x.proximo_retorno is not null and x.proximo_retorno < p_agora loop
    v_pessoas := case when pessoa_do_vinculo(m.responsavel_id) is not null then array[pessoa_do_vinculo(m.responsavel_id)]
                      else sindicos_do_condominio() end;
    insert into avisos_manutencao (condominio_id, pessoa_id, manutencao_id, tipo, referencia)
    select m.condominio_id, x, m.id, 'RETORNO_VENCIDO', m.proximo_retorno from unnest(v_pessoas) x where x is not null
    on conflict (pessoa_id, manutencao_id, tipo, referencia) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      perform registrar_historico('manutencao.retorno_venceu', 'manutencoes', m.id::text, jsonb_build_object('de', m.proximo_retorno));
      v_total := v_total + v_n;
    end if;
  end loop;
  return v_total;
end $$;

-- Rotina da manutenção, em todos os condomínios: abre as preventivas e avisa os retornos
-- vencidos. Um condomínio com problema não impede os outros.
create function verificar_manutencao() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
  v_agora timestamptz := app_now();
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    begin
      v_total := v_total + abrir_preventivas() + avisar_manutencoes(v_agora);
    exception when others then
      raise warning 'Manutenção do condomínio % não conferida: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- Resumo para o Início: retorno vencido, preventiva atrasada e contrato a 60 dias do fim.
create function resumo_manutencao() returns jsonb
language sql stable
set search_path = public
as $$
  with abertas as (select m.*, manutencao_retorno_vencido(m) as vencido, manutencao_atrasada(m) as atrasada
                     from manutencoes m where m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')),
  vencida as (select id, titulo, proximo_retorno from abertas where vencido order by proximo_retorno limit 1),
  atrasada as (select id, titulo, data_prevista from abertas where atrasada order by data_prevista limit 1),
  contratos as (select * from prestadores where arquivado_em is null and acordo = 'CONTRATO' and contrato_ate is not null
                  and contrato_ate between hoje_no_condominio() and hoje_no_condominio() + 60)
  select jsonb_strip_nulls(jsonb_build_object(
    'abertas', (select count(*) from abertas),
    'retornoVencido', (select count(*) from abertas where vencido),
    'vencidaMaisAntiga', (select jsonb_build_object('id', id, 'titulo', titulo, 'desde', proximo_retorno) from vencida),
    'preventivasAtrasadas', (select count(*) from abertas where atrasada),
    'atrasadaMaisAntiga', (select jsonb_build_object('id', id, 'titulo', titulo, 'data', to_char(data_prevista, 'YYYY-MM-DD')) from atrasada),
    'contratosAVencer', (select count(*) from contratos),
    'contratoMaisProximo', (select jsonb_build_object('id', id, 'nome', nome, 'ate', to_char(contrato_ate, 'YYYY-MM-DD'))
                              from contratos order by contrato_ate limit 1)))
$$;

-- ---------------------------------------------------------------------------------------
-- Painel, avisos e agenda: a manutenção entra.

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
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

-- Os avisos da pessoa nos últimos 30 dias: os dos pedidos e os da manutenção.
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  update avisos set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  update avisos_manutencao set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_m = row_count;
  return v_n + v_m;
end $$;

-- O compromisso mostra a manutenção ligada, a quem vê a manutenção.
create or replace function compromisso_json(c compromissos, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'data', to_char(c.data, 'YYYY-MM-DD'),
    'horaInicio', to_char(c.hora_inicio, 'HH24:MI'), 'horaFim', to_char(c.hora_fim, 'HH24:MI'),
    'diaTodo', c.hora_inicio is null, 'onde', c.onde, 'unidadeId', c.unidade_id, 'local', c.local,
    'lugar', nome_do_lugar(c),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object('vinculoId', x, 'nome', nome_do_vinculo(x)) order by nome_do_vinculo(x))
                                 from unnest(c.participantes) x), '[]'::jsonb),
    'deFora', c.de_fora, 'observacao', c.observacao, 'estado', c.estado, 'versao', c.versao,
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto)
                 from pedidos p where p.id = c.pedido_id
                  and pode(p_pessoa, c.condominio_id, 'pedidos.ver') and pedido_visivel(p_pessoa, p)),
    'pedidoOculto', case when c.pedido_id is not null and not exists (
                      select 1 from pedidos p where p.id = c.pedido_id and pode(p_pessoa, c.condominio_id, 'pedidos.ver')
                                                and pedido_visivel(p_pessoa, p)) then true end,
    'manutencao', case when pode(p_pessoa, c.condominio_id, 'manutencao.ver') then (
                    select jsonb_build_object('id', m.id, 'titulo', m.titulo, 'estado', m.estado) from manutencoes m where m.id = c.manutencao_id) end,
    'serie', case when c.serie_id is not null then (
               select jsonb_build_object('id', s.id, 'frequencia', s.frequencia, 'intervalo', s.intervalo,
                        'ate', (select to_char(max(x.data), 'YYYY-MM-DD') from compromissos x where x.serie_id = s.id),
                        'total', (select count(*) from compromissos x where x.serie_id = s.id))
                 from series_compromisso s where s.id = c.serie_id) end,
    'cancelamento', case when c.cancelado_em is not null then jsonb_build_object('em', c.cancelado_em, 'motivo', c.motivo_cancelamento,
                      'por', (select nome from pessoas where id = c.cancelado_por)) end,
    'realizadoEm', c.realizado_em))
$$;

-- A agenda ganha as preventivas como datas de outra tela (AG-09), para quem vê a manutenção.
create or replace function plataforma_agenda(p_pessoa uuid, p_condominio uuid, p_de date, p_ate date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.ver');
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then
    perform recusar_campos('Período de até 93 dias', 'de', 'ate');
  end if;
  return jsonb_build_object(
    'compromissos', coalesce((
      select jsonb_agg(compromisso_json(c, p_pessoa) order by c.data, c.hora_inicio nulls first, c.titulo)
        from compromissos c where c.data between p_de and p_ate), '[]'::jsonb),
    'datas', coalesce((
      select jsonb_agg(x.d order by x.data, x.titulo)
        from (
          select f.data, f.descricao as titulo,
                 jsonb_build_object('data', to_char(f.data, 'YYYY-MM-DD'), 'titulo', f.descricao, 'fonte', 'FERIADO') as d
            from feriados f where f.data between p_de and p_ate and pode(p_pessoa, p_condominio, 'config.ver')
          union all
          select p.proxima_data, p.atividade,
                 jsonb_build_object('data', to_char(p.proxima_data, 'YYYY-MM-DD'), 'titulo', p.atividade, 'fonte', 'PREVENTIVA',
                                    'id', p.id)
            from preventivas p where p.ativa and p.proxima_data between p_de and p_ate and pode(p_pessoa, p_condominio, 'manutencao.ver')
        ) x), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')));
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API (security definer). Pessoa e condomínio vêm da sessão.

-- O que as telas precisam para registrar e filtrar.
create function plataforma_manutencao_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  return jsonb_build_object(
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'cargo', v.cargo, 'eu', v.pessoa_id = p_pessoa,
                                          'veManutencao', pode(v.pessoa_id, p_condominio, 'manutencao.ver')) order by p.nome)
        from vinculos v join pessoas p on p.id = v.pessoa_id
       where v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null), '[]'::jsonb),
    'prestadores', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'servico', x.servico) order by lower(x.nome))
        from prestadores x where x.arquivado_em is null), '[]'::jsonb),
    'prioridades', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'significado', x.significado, 'nivel', x.nivel) order by x.nivel)
        from prioridades x where x.ativa), '[]'::jsonb),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'situacao', x.situacao) order by x.situacao, x.ordem, lower(x.nome))
        from etapas_manutencao x where x.ativa), '[]'::jsonb),
    'locais', coalesce((
      select jsonb_agg(l order by lower(l)) from (
        select distinct on (lower(btrim(local))) btrim(local) as l from (
          select local from manutencoes union all select local from preventivas) t
         order by lower(btrim(local)), btrim(local)) y), '[]'::jsonb),
    'pedidos', case when pode(p_pessoa, p_condominio, 'pedidos.ver') then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'protocolo', x.protocolo, 'assunto', x.assunto) order by x.criado_em desc)
        from (select * from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and pedido_visivel(p_pessoa, p)
               order by p.criado_em desc limit 300) x), '[]'::jsonb) else '[]'::jsonb end,
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar'),
                               'agenda', pode(p_pessoa, p_condominio, 'agenda.editar')),
    'pendenciaDias', (select aviso_pendencia_dias from configuracao_condominio),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- A lista das manutenções, com filtros e os atalhos do que pede atenção.
create function plataforma_manutencoes(p_pessoa uuid, p_condominio uuid, p_situacao text, p_tipo text, p_prestador uuid,
                                       p_atencao text, p_busca text, p_pagina integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_dias integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  if coalesce(p_situacao, 'ABERTAS') not in ('ABERTAS', 'PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDA', 'CANCELADA', 'TODAS') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  if p_tipo is not null and p_tipo not in ('CORRETIVA', 'PREVENTIVA', 'VISTORIA') then perform recusar_campos('Tipo desconhecido', 'tipo'); end if;
  if p_atencao is not null and p_atencao not in ('RETORNO_VENCIDO', 'PREVENTIVAS_MES', 'PENDENTES_PARADAS') then
    perform recusar_campos('Atalho desconhecido', 'atencao');
  end if;
  select aviso_pendencia_dias into v_dias from configuracao_condominio;
  return (
    with base as (
      select m.* from manutencoes m
       where (case coalesce(p_situacao, 'ABERTAS')
                when 'ABERTAS' then m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')
                when 'TODAS' then true
                else m.estado = p_situacao end)
         and (p_tipo is null or m.tipo = p_tipo)
         and (p_prestador is null or m.prestador_id = p_prestador
              or exists (select 1 from providencias_manutencao x where x.manutencao_id = m.id and x.prestador_id = p_prestador))
         and (v_busca is null or lower(m.titulo) like '%' || v_busca || '%' or lower(m.local) like '%' || v_busca || '%'
              or exists (select 1 from prestadores x where x.id = m.prestador_id and lower(x.nome) like '%' || v_busca || '%'))
         and (case p_atencao
                when 'RETORNO_VENCIDO' then manutencao_retorno_vencido(m)
                when 'PREVENTIVAS_MES' then m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') and m.tipo = 'PREVENTIVA'
                                            and date_trunc('month', m.data_prevista) = date_trunc('month', hoje_no_condominio())
                when 'PENDENTES_PARADAS' then m.estado = 'PENDENTE' and m.pendente_desde + make_interval(days => v_dias) <= app_now()
                else true end)),
    abertas as (select * from manutencoes where estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
    select jsonb_build_object(
      'itens', coalesce((
        select jsonb_agg(manutencao_json(x.linha, p_pessoa) order by x.ordem1, x.ordem2, x.criado desc)
          from (select b::manutencoes as linha, b.criado_em as criado,
                       case when manutencao_retorno_vencido(b::manutencoes) then 0 when b.estado = 'PENDENTE' then 1 else 2 end as ordem1,
                       coalesce(b.proximo_retorno, b.data_prevista::timestamptz, b.criado_em) as ordem2
                  from base b
                 order by ordem1, ordem2, b.criado_em desc
                 offset (v_pagina - 1) * 30 limit 30) x), '[]'::jsonb),
      'total', (select count(*) from base),
      'pagina', v_pagina,
      'atalhos', jsonb_build_object(
        'retornoVencido', (select count(*) from abertas m where manutencao_retorno_vencido(m)),
        'preventivasMes', (select count(*) from abertas m where m.tipo = 'PREVENTIVA'
                             and date_trunc('month', m.data_prevista) = date_trunc('month', hoje_no_condominio())),
        'pendentesParadas', (select count(*) from abertas m where m.estado = 'PENDENTE'
                               and m.pendente_desde + make_interval(days => v_dias) <= app_now())),
      'pendenciaDias', v_dias,
      'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar'))));
end $$;

-- Uma manutenção, com as providências, a vistoria, as ligações e o histórico.
create function plataforma_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_editar boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  m := exigir_manutencao(p_id);
  v_editar := pode(p_pessoa, p_condominio, 'manutencao.editar');
  return jsonb_build_object(
    'manutencao', manutencao_json(m, p_pessoa) || jsonb_strip_nulls(jsonb_build_object(
      'detalhes', m.detalhes, 'acesso', m.acesso, 'impedimento', m.impedimento,
      'registradaPor', (select nome from pessoas where id = m.criado_por),
      'conclusao', case when m.estado = 'CONCLUIDA' then jsonb_build_object('texto', m.conclusao,
                     'realizadaEm', to_char(m.realizada_em, 'YYYY-MM-DD'), 'em', m.concluida_em,
                     'por', (select nome from pessoas where id = m.concluida_por)) end,
      'cancelamento', case when m.estado = 'CANCELADA' then jsonb_build_object('motivo', m.motivo_cancelamento, 'em', m.cancelada_em,
                        'por', (select nome from pessoas where id = m.cancelada_por)) end,
      'origem', (select jsonb_build_object('id', o.id, 'titulo', o.titulo, 'tipo', o.tipo) from manutencoes o where o.id = m.origem_id),
      'preventiva', (select jsonb_build_object('id', p.id, 'unidadeTempo', p.unidade_tempo, 'intervalo', p.intervalo,
                                               'proximaData', to_char(p.proxima_data, 'YYYY-MM-DD'))
                       from preventivas p where p.id = m.preventiva_id),
      'pedidoOculto', case when m.pedido_id is not null and not exists (
                        select 1 from pedidos p where p.id = m.pedido_id and pode(p_pessoa, p_condominio, 'pedidos.ver')
                                                  and pedido_visivel(p_pessoa, p)) then true end)),
    'prestador', (select jsonb_strip_nulls(jsonb_build_object('id', x.id, 'nome', x.nome, 'servico', x.servico, 'acordo', x.acordo,
                                             'contato', x.contato, 'telefone', x.telefone, 'email', x.email,
                                             'reserva', (select jsonb_build_object('id', r.id, 'nome', r.nome) from prestadores r where r.id = x.reserva_id)))
                    from prestadores x where x.id = m.prestador_id),
    'providencias', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'texto', x.texto, 'executor', executor_json(x.prestador_id, x.executor_vinculo, x.executor_texto),
               'feitaEm', x.feita_em, 'feitaPor', (select nome from pessoas where id = x.feita_por), 'resultado', x.resultado,
               'criadoEm', x.criado_em)) order by x.criado_em, x.id)
        from providencias_manutencao x where x.manutencao_id = m.id), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'texto', x.texto, 'ordem', x.ordem, 'resultado', x.resultado, 'observacao', x.observacao,
               'respondidoEm', x.respondido_em,
               'fotos', (select count(*) from arquivos_manutencao a where a.item_id = x.id and a.retirado_em is null and a.situacao = 'LIBERADO'),
               'gerada', (select jsonb_build_object('id', g.id, 'titulo', g.titulo, 'estado', g.estado) from manutencoes g where g.id = x.gerada_id)))
             order by x.ordem, x.criado_em)
        from itens_vistoria x where x.manutencao_id = m.id and x.ativo), '[]'::jsonb),
    'geradas', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'titulo', g.titulo, 'estado', g.estado) order by g.criado_em)
        from manutencoes g where g.origem_id = m.id), '[]'::jsonb),
    'compromissos', case when pode(p_pessoa, p_condominio, 'agenda.ver') then coalesce((
      select jsonb_agg(compromisso_json(c, p_pessoa) order by c.data, c.hora_inicio nulls first)
        from compromissos c where c.manutencao_id = m.id and c.estado <> 'CANCELADO'), '[]'::jsonb) end,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
                                          'dados', h.dados) order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'manutencoes' and h.entidade_id = m.id::text), '[]'::jsonb),
    'pode', jsonb_build_object(
      'editar', v_editar and m.estado not in ('CONCLUIDA', 'CANCELADA'),
      'reabrir', v_editar and m.estado in ('CONCLUIDA', 'CANCELADA'),
      'enviar', v_editar and m.estado <> 'CANCELADA',
      'marcarVisita', v_editar and pode(p_pessoa, p_condominio, 'agenda.editar') and m.estado not in ('CONCLUIDA', 'CANCELADA')),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

-- Confere o que a manutenção leva: título, local, detalhes, prioridade, responsável e o pedido.
create function ler_manutencao(p_pessoa uuid, p_titulo text, p_local text, p_detalhes text, p_prioridade uuid, p_responsavel uuid,
                               p_pedido uuid, p_acesso text, p_impedimento text, p_sem_prioridade boolean default false)
returns manutencoes
language plpgsql
set search_path = public
as $$
declare
  m manutencoes;
  v_pedido pedidos;
begin
  m.titulo := btrim(coalesce(p_titulo, ''));
  if length(m.titulo) not between 3 and 120 then perform recusar_campos('Diga o que precisa ser feito, de 3 a 120 caracteres', 'titulo'); end if;
  m.local := btrim(coalesce(p_local, ''));
  if length(m.local) not between 2 and 120 then perform recusar_campos('Diga o local ou o equipamento', 'local'); end if;
  m.detalhes := nullif(btrim(coalesce(p_detalhes, '')), '');
  if length(m.detalhes) > 2000 then perform recusar_campos('Detalhes até 2000 caracteres', 'detalhes'); end if;
  m.acesso := nullif(btrim(coalesce(p_acesso, '')), '');
  if length(m.acesso) not between 2 and 300 then perform recusar_campos('Acesso de 2 a 300 caracteres', 'acesso'); end if;
  m.impedimento := nullif(btrim(coalesce(p_impedimento, '')), '');
  if length(m.impedimento) not between 2 and 300 then perform recusar_campos('Impedimento de 2 a 300 caracteres', 'impedimento'); end if;
  if (p_prioridade is null and not p_sem_prioridade)
     or (p_prioridade is not null and not exists (select 1 from prioridades where id = p_prioridade and ativa)) then
    perform recusar_campos('Escolha a prioridade', 'prioridadeId');
  end if;
  m.prioridade_id := p_prioridade;
  perform exigir_responsavel_manutencao(p_responsavel);
  m.responsavel_id := p_responsavel;
  if p_pedido is not null then
    select * into v_pedido from pedidos where id = p_pedido;
    if not found or not pode(p_pessoa, contexto_condominio(), 'pedidos.ver') or not pedido_visivel(p_pessoa, v_pedido) then
      perform recusar_campos('Pedido não encontrado', 'pedidoId');
    end if;
    m.pedido_id := p_pedido;
  end if;
  return m;
end $$;

-- Registrar uma manutenção (MP-01): corretiva ou vistoria. A preventiva nasce pela preventiva.
create function plataforma_registrar_manutencao(p_pessoa uuid, p_condominio uuid, p_tipo text, p_titulo text, p_local text,
                                                p_detalhes text, p_prioridade uuid, p_responsavel uuid, p_prestador uuid,
                                                p_executor_vinculo uuid, p_executor_texto text, p_proximo_retorno timestamptz,
                                                p_previsao date, p_pedido uuid, p_itens text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_texto text;
  v_id uuid;
  v_item text;
  v_ordem integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  if p_tipo is null or p_tipo not in ('CORRETIVA', 'VISTORIA') then
    perform recusar_campos('Tipo: corretiva ou vistoria (a preventiva nasce em Preventivas)', 'tipo');
  end if;
  m := ler_manutencao(p_pessoa, p_titulo, p_local, p_detalhes, p_prioridade, p_responsavel, p_pedido, null, null);
  v_texto := exigir_executor(p_prestador, p_executor_vinculo, p_executor_texto);
  if p_proximo_retorno is not null and (p_proximo_retorno < app_now() - interval '1 hour' or p_proximo_retorno > app_now() + interval '2 years') then
    perform recusar_campos('O próximo retorno fica entre agora e dois anos à frente', 'proximoRetorno');
  end if;
  if p_previsao is not null and (p_previsao < hoje_no_condominio() or p_previsao > hoje_no_condominio() + 731) then
    perform recusar_campos('A previsão fica entre hoje e dois anos à frente', 'previsao');
  end if;
  if p_tipo = 'CORRETIVA' and coalesce(cardinality(p_itens), 0) > 0 then
    perform recusar_campos('A lista do que olhar é só da vistoria', 'itens');
  end if;
  if coalesce(cardinality(p_itens), 0) > 60 then perform recusar_campos('Até 60 itens na vistoria', 'itens'); end if;
  perform definir_transicao('REGISTRADA');
  insert into manutencoes (condominio_id, tipo, titulo, local, detalhes, prioridade_id, responsavel_id, prestador_id, executor_vinculo,
                           executor_texto, estado, proximo_retorno, previsao, pedido_id, criado_por)
  values (p_condominio, p_tipo, m.titulo, m.local, m.detalhes, m.prioridade_id, m.responsavel_id, p_prestador, p_executor_vinculo,
          v_texto, 'PLANEJADA', p_proximo_retorno, p_previsao, m.pedido_id, p_pessoa)
  returning id into v_id;
  foreach v_item in array coalesce(p_itens, '{}') loop
    continue when btrim(coalesce(v_item, '')) = '';
    if length(btrim(v_item)) not between 2 and 200 then perform recusar_campos('Cada item de 2 a 200 caracteres', 'itens'); end if;
    v_ordem := v_ordem + 1;
    insert into itens_vistoria (condominio_id, manutencao_id, texto, ordem) values (p_condominio, v_id, btrim(v_item), v_ordem);
  end loop;
  perform registrar_historico('manutencao.registrada', 'manutencoes', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'tipo', p_tipo, 'prioridade', m.prioridade_id, 'pedido', m.pedido_id, 'itens', nullif(v_ordem, 0))));
  if m.pedido_id is not null then
    perform registrar_historico('pedido.manutencao_ligada', 'pedidos', m.pedido_id::text, jsonb_build_object('manutencao', v_id));
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Mudar o que foi registrado (MP-01), na manutenção aberta.
create function plataforma_alterar_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                              p_local text, p_detalhes text, p_prioridade uuid, p_responsavel uuid,
                                              p_prestador uuid, p_executor_vinculo uuid, p_executor_texto text, p_pedido uuid,
                                              p_acesso text, p_impedimento text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  m manutencoes;
  v_texto text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  if v.versao <> p_versao then perform conflito_versao('manutencoes', p_id); end if;
  -- A preventiva gerada sozinha pode seguir sem prioridade; as outras precisam de uma.
  m := ler_manutencao(p_pessoa, p_titulo, p_local, p_detalhes, p_prioridade, p_responsavel, p_pedido, p_acesso, p_impedimento,
                      v.tipo = 'PREVENTIVA');
  -- O pedido que a pessoa não enxerga continua ligado como estava.
  if p_pedido is null and v.pedido_id is not null and not exists (
       select 1 from pedidos p where p.id = v.pedido_id and pode(p_pessoa, p_condominio, 'pedidos.ver') and pedido_visivel(p_pessoa, p)) then
    m.pedido_id := v.pedido_id;
  end if;
  v_texto := exigir_executor(p_prestador, p_executor_vinculo, p_executor_texto);
  update manutencoes set titulo = m.titulo, local = m.local, detalhes = m.detalhes, prioridade_id = m.prioridade_id,
                         responsavel_id = m.responsavel_id, prestador_id = p_prestador, executor_vinculo = p_executor_vinculo,
                         executor_texto = v_texto, pedido_id = m.pedido_id, acesso = m.acesso, impedimento = m.impedimento
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  perform registrar_historico('manutencao.alterada', 'manutencoes', p_id::text, jsonb_build_object(
    'campos', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (values
        ('titulo', v.titulo is distinct from m.titulo), ('local', v.local is distinct from m.local),
        ('detalhes', v.detalhes is distinct from m.detalhes), ('prioridade', v.prioridade_id is distinct from m.prioridade_id),
        ('responsavel', v.responsavel_id is distinct from m.responsavel_id),
        ('executor', (v.prestador_id, v.executor_vinculo, v.executor_texto) is distinct from (p_prestador, p_executor_vinculo, v_texto)),
        ('pedido', v.pedido_id is distinct from m.pedido_id),
        ('acesso', (v.acesso, v.impedimento) is distinct from (m.acesso, m.impedimento))) t(k, mudou) where mudou)));
  if m.pedido_id is not null and m.pedido_id is distinct from v.pedido_id then
    perform registrar_historico('pedido.manutencao_ligada', 'pedidos', m.pedido_id::text, jsonb_build_object('manutencao', p_id));
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Próximo retorno (MP-01): mudar pede motivo, que vai para o histórico.
create function plataforma_retorno_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_quando timestamptz,
                                              p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  v_motivo := exigir_motivo(p_motivo);
  if p_quando is not null and (p_quando < app_now() or p_quando > app_now() + interval '2 years') then
    perform recusar_campos('O próximo retorno fica entre agora e dois anos à frente', 'quando');
  end if;
  update manutencoes set proximo_retorno = p_quando where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  perform registrar_historico('manutencao.retorno_mudou', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'de', v.proximo_retorno, 'para', p_quando, 'motivo', v_motivo)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Previsão de conclusão (MP-01): só quando conhecida; mudar pede motivo.
create function plataforma_previsao_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date,
                                               p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  v_motivo := exigir_motivo(p_motivo);
  if p_data is not null and (p_data < hoje_no_condominio() or p_data > hoje_no_condominio() + 731) then
    perform recusar_campos('A previsão fica entre hoje e dois anos à frente', 'data');
  end if;
  update manutencoes set previsao = p_data where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  perform registrar_historico('manutencao.previsao_mudou', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'de', to_char(v.previsao, 'YYYY-MM-DD'), 'para', to_char(p_data, 'YYYY-MM-DD'), 'motivo', v_motivo)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Situação (MP-02): planejada, em andamento ou pendente (com tipo e motivo), e a etapa.
create function plataforma_situacao_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_estado text,
                                               p_etapa uuid, p_pendencia_tipo text, p_pendencia_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  if p_estado is null or p_estado not in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') then
    perform recusar_campos('Situação: planejada, em andamento ou pendente', 'estado');
  end if;
  if p_etapa is not null and not exists (select 1 from etapas_manutencao where id = p_etapa and ativa and situacao = p_estado) then
    perform recusar_campos('A etapa não combina com a situação', 'etapaId');
  end if;
  if p_estado = 'PENDENTE' then
    if p_pendencia_tipo is null or p_pendencia_tipo not in ('FORNECEDOR', 'MORADOR', 'DECISAO', 'PECA', 'ACESSO', 'SEM_EXECUTOR', 'OUTRO') then
      perform recusar_campos('Diga o que impede', 'pendenciaTipo');
    end if;
    if length(btrim(coalesce(p_pendencia_motivo, ''))) not between 3 and 300 then
      perform recusar_campos('Explique a pendência (de 3 a 300 caracteres)', 'pendenciaMotivo');
    end if;
    v_motivo := btrim(p_pendencia_motivo);
  end if;
  if (p_estado, p_etapa) is not distinct from (v.estado, v.etapa_id)
     and (p_estado <> 'PENDENTE' or (p_pendencia_tipo, v_motivo) is not distinct from (v.pendencia_tipo, v.pendencia_motivo)) then
    return jsonb_build_object('versao', v.versao);
  end if;
  perform definir_transicao(case p_estado when 'PENDENTE' then 'PENDENCIA' when 'EM_ANDAMENTO' then 'INICIADA' else 'PLANEJADA' end,
                            v_motivo);
  update manutencoes
     set estado = p_estado, etapa_id = p_etapa,
         pendencia_tipo = case when p_estado = 'PENDENTE' then p_pendencia_tipo end,
         pendencia_motivo = case when p_estado = 'PENDENTE' then v_motivo end,
         pendente_desde = case when p_estado = 'PENDENTE' then (case when v.estado = 'PENDENTE' then v.pendente_desde else app_now() end) end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  if p_estado = 'PENDENTE' or v.estado = 'PENDENTE' or p_etapa is distinct from v.etapa_id then
    perform registrar_historico('manutencao.situacao', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
      'estado', p_estado, 'etapa', (select nome from etapas_manutencao where id = p_etapa),
      'pendenciaTipo', case when p_estado = 'PENDENTE' then p_pendencia_tipo end,
      'pendencia', case when p_estado = 'PENDENTE' then v_motivo end,
      'pendenciaResolvida', case when v.estado = 'PENDENTE' and p_estado <> 'PENDENTE' then true end)));
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Concluir (MP-02): o que foi feito e a data. Providências abertas fecham juntas, se a pessoa
-- confirmar. Não encerra o pedido ligado (MP-04). A preventiva anda para a próxima data.
create function plataforma_concluir_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_conclusao text,
                                               p_realizada_em date, p_fechar_providencias boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_texto text := btrim(coalesce(p_conclusao, ''));
  v_abertas integer;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  if v.versao <> p_versao then perform conflito_versao('manutencoes', p_id); end if;
  if length(v_texto) not between 10 and 2000 then perform recusar_campos('Diga o que foi feito (de 10 a 2000 caracteres)', 'conclusao'); end if;
  if p_realizada_em is null or p_realizada_em > hoje_no_condominio() or p_realizada_em < (v.criado_em at time zone 'UTC')::date - 1 then
    perform recusar_campos('A data em que foi feita fica entre o registro e hoje', 'realizadaEm');
  end if;
  select count(*) into v_abertas from providencias_manutencao where manutencao_id = p_id and feita_em is null;
  if v_abertas > 0 and not coalesce(p_fechar_providencias, false) then
    raise exception 'Há providências abertas' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'PROVIDENCIAS_ABERTAS', 'providencias', (
        select jsonb_agg(jsonb_build_object('id', id, 'texto', texto) order by criado_em)
          from providencias_manutencao where manutencao_id = p_id and feita_em is null))::text;
  end if;
  update providencias_manutencao set feita_em = app_now(), feita_por = p_pessoa where manutencao_id = p_id and feita_em is null;
  perform definir_transicao('CONCLUIDA');
  update manutencoes set estado = 'CONCLUIDA', etapa_id = null, conclusao = v_texto, realizada_em = p_realizada_em,
                         concluida_em = app_now(), concluida_por = p_pessoa, proximo_retorno = null,
                         pendencia_tipo = null, pendencia_motivo = null, pendente_desde = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  perform registrar_historico('manutencao.concluida', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'realizadaEm', to_char(p_realizada_em, 'YYYY-MM-DD'), 'providenciasFechadas', nullif(v_abertas, 0))));
  if v.pedido_id is not null then
    perform registrar_historico('pedido.manutencao_concluida', 'pedidos', v.pedido_id::text, jsonb_build_object('manutencao', p_id));
  end if;
  perform avancar_preventiva(v, p_realizada_em);
  return jsonb_build_object('versao', v_versao);
end $$;

-- Cancelar (MP-02): pede motivo. A preventiva pula para a próxima data.
create function plataforma_cancelar_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao('CANCELADA', v_motivo);
  update manutencoes set estado = 'CANCELADA', etapa_id = null, cancelada_em = app_now(), cancelada_por = p_pessoa,
                         motivo_cancelamento = v_motivo, proximo_retorno = null,
                         pendencia_tipo = null, pendencia_motivo = null, pendente_desde = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  perform avancar_preventiva(v, hoje_no_condominio());
  return jsonb_build_object('versao', v_versao);
end $$;

-- Reabrir (MP-02): pede motivo. A concluída volta em andamento; a cancelada volta planejada.
-- A conclusão anterior fica no histórico.
create function plataforma_reabrir_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  if v.estado not in ('CONCLUIDA', 'CANCELADA') then
    perform recusar_motivo('Só a concluída ou a cancelada é reaberta', 'MANUTENCAO_ABERTA');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  if v.estado = 'CONCLUIDA' then
    perform registrar_historico('manutencao.conclusao_anterior', 'manutencoes', p_id::text, jsonb_build_object(
      'conclusao', v.conclusao, 'realizadaEm', to_char(v.realizada_em, 'YYYY-MM-DD')));
  end if;
  perform definir_transicao('REABERTA', v_motivo);
  update manutencoes set estado = case when v.estado = 'CONCLUIDA' then 'EM_ANDAMENTO' else 'PLANEJADA' end,
                         conclusao = null, realizada_em = null, concluida_em = null, concluida_por = null,
                         cancelada_em = null, cancelada_por = null, motivo_cancelamento = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('manutencoes', p_id); end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Providências (MP-02).
create function plataforma_incluir_providencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_texto text,
                                               p_prestador uuid, p_executor_vinculo uuid, p_executor_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_exec text;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  if length(v_texto) not between 3 and 300 then perform recusar_campos('Diga a providência, de 3 a 300 caracteres', 'texto'); end if;
  v_exec := exigir_executor(p_prestador, p_executor_vinculo, p_executor_texto);
  if (select count(*) from providencias_manutencao where manutencao_id = p_id) >= 50 then
    perform recusar_motivo('A manutenção já tem 50 providências', 'LIMITE_PROVIDENCIAS');
  end if;
  v_versao := tocar_manutencao(p_id, p_versao);
  insert into providencias_manutencao (condominio_id, manutencao_id, texto, prestador_id, executor_vinculo, executor_texto, criado_por)
  values (p_condominio, p_id, v_texto, p_prestador, p_executor_vinculo, v_exec, p_pessoa) returning id into v_id;
  perform registrar_historico('manutencao.providencia', 'manutencoes', p_id::text, jsonb_build_object('providencia', v_id, 'texto', v_texto));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function plataforma_fazer_providencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_providencia uuid,
                                             p_resultado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  x providencias_manutencao;
  v_resultado text := nullif(btrim(coalesce(p_resultado, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  select * into x from providencias_manutencao where id = p_providencia and manutencao_id = p_id;
  if not found then raise exception 'Providência não encontrada' using errcode = 'TC404'; end if;
  if x.feita_em is not null then perform recusar_motivo('Providência já feita', 'PROVIDENCIA_FEITA'); end if;
  if length(v_resultado) not between 2 and 1000 then perform recusar_campos('Resultado de 2 a 1000 caracteres', 'resultado'); end if;
  v_versao := tocar_manutencao(p_id, p_versao);
  update providencias_manutencao set feita_em = app_now(), feita_por = p_pessoa, resultado = v_resultado where id = x.id;
  perform registrar_historico('manutencao.providencia_feita', 'manutencoes', p_id::text, jsonb_build_object(
    'providencia', x.id, 'texto', x.texto));
  return jsonb_build_object('versao', v_versao);
end $$;

-- A lista da vistoria (MP-07): incluir itens e tirar os que ainda não têm resposta.
create function plataforma_itens_vistoria(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_incluir text[],
                                          p_tirar uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  v_item text;
  v_ordem integer;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  if v.tipo <> 'VISTORIA' then perform recusar_motivo('A lista do que olhar é só da vistoria', 'NAO_E_VISTORIA'); end if;
  if exists (select 1 from unnest(coalesce(p_tirar, '{}')) t
              where not exists (select 1 from itens_vistoria i where i.id = t and i.manutencao_id = p_id and i.ativo and i.resultado is null)) then
    perform recusar_campos('Só sai da lista o item ainda sem resposta', 'tirar');
  end if;
  v_versao := tocar_manutencao(p_id, p_versao);
  update itens_vistoria set ativo = false where id = any (coalesce(p_tirar, '{}'));
  select coalesce(max(ordem), 0) into v_ordem from itens_vistoria where manutencao_id = p_id;
  foreach v_item in array coalesce(p_incluir, '{}') loop
    continue when btrim(coalesce(v_item, '')) = '';
    if length(btrim(v_item)) not between 2 and 200 then perform recusar_campos('Cada item de 2 a 200 caracteres', 'incluir'); end if;
    v_ordem := v_ordem + 1;
    if v_ordem > 100 then perform recusar_campos('Até 100 itens na vistoria', 'incluir'); end if;
    insert into itens_vistoria (condominio_id, manutencao_id, texto, ordem) values (p_condominio, p_id, btrim(v_item), v_ordem);
  end loop;
  perform registrar_historico('manutencao.lista_vistoria', 'manutencoes', p_id::text, jsonb_build_object(
    'incluidos', (select count(*) from unnest(coalesce(p_incluir, '{}')) t where btrim(coalesce(t, '')) <> ''),
    'tirados', coalesce(cardinality(p_tirar), 0)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Resposta de um item da vistoria: certo, com problema ou não deu (MP-07).
create function plataforma_responder_item(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_item uuid,
                                          p_resultado text, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  i itens_vistoria;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  select * into i from itens_vistoria where id = p_item and manutencao_id = p_id and ativo;
  if not found then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  if p_resultado is not null and p_resultado not in ('CERTO', 'PROBLEMA', 'NAO_DEU') then
    perform recusar_campos('Resultado: certo, com problema ou não deu', 'resultado');
  end if;
  if i.gerada_id is not null and p_resultado is distinct from 'PROBLEMA' then
    perform recusar_motivo('O item já abriu uma manutenção: o problema fica registrado', 'ITEM_COM_MANUTENCAO');
  end if;
  if length(v_obs) not between 2 and 500 then perform recusar_campos('Observação de 2 a 500 caracteres', 'observacao'); end if;
  if p_resultado = 'NAO_DEU' and v_obs is null then perform recusar_campos('Diga por que não deu para ver', 'observacao'); end if;
  v_versao := tocar_manutencao(p_id, p_versao);
  update itens_vistoria set resultado = p_resultado, observacao = v_obs,
                            respondido_em = case when p_resultado is null then null else app_now() end,
                            respondido_por = case when p_resultado is null then null else p_pessoa end
   where id = i.id;
  perform registrar_historico('manutencao.item_respondido', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'item', i.id, 'texto', i.texto, 'resultado', p_resultado)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Item com problema vira manutenção corretiva ligada à vistoria (MP-07).
create function plataforma_item_virar_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v manutencoes;
  i itens_vistoria;
  v_nova uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  v := exigir_manutencao(p_id);
  perform exigir_manutencao_aberta(v);
  select * into i from itens_vistoria where id = p_item and manutencao_id = p_id and ativo;
  if not found then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  if i.resultado is distinct from 'PROBLEMA' then perform recusar_motivo('Só item com problema vira manutenção', 'ITEM_SEM_PROBLEMA'); end if;
  if i.gerada_id is not null then perform recusar_motivo('O item já abriu uma manutenção', 'ITEM_COM_MANUTENCAO'); end if;
  v_versao := tocar_manutencao(p_id, p_versao);
  perform definir_transicao('REGISTRADA');
  insert into manutencoes (condominio_id, tipo, titulo, local, detalhes, prioridade_id, responsavel_id, estado, pedido_id, origem_id, criado_por)
  values (p_condominio, 'CORRETIVA', case when length(i.texto) < 3 then 'Problema: ' || i.texto else left(i.texto, 120) end, v.local, i.observacao,
          coalesce(v.prioridade_id, (select id from prioridades where ativa order by nivel limit 1)),
          v.responsavel_id, 'PLANEJADA', v.pedido_id, v.id, p_pessoa)
  returning id into v_nova;
  update itens_vistoria set gerada_id = v_nova where id = i.id;
  perform registrar_historico('manutencao.registrada', 'manutencoes', v_nova::text, jsonb_build_object('tipo', 'CORRETIVA', 'origem', v.id));
  perform registrar_historico('manutencao.item_virou_manutencao', 'manutencoes', p_id::text, jsonb_build_object('item', i.id, 'manutencao', v_nova));
  return jsonb_build_object('id', v_nova, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Fotos e documentos da manutenção (mesmas regras de 0100).

create function exigir_arquivo_manutencao(p_manutencao uuid, p_arquivo uuid) returns arquivos_manutencao
language plpgsql
set search_path = public
as $$
declare v arquivos_manutencao;
begin
  select * into v from arquivos_manutencao where id = p_arquivo and manutencao_id = p_manutencao and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function plataforma_arquivos_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_editar boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  m := exigir_manutencao(p_id);
  v_editar := pode(p_pessoa, p_condominio, 'manutencao.editar');
  return jsonb_build_object(
    'arquivos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', a.id, 'itemId', a.item_id, 'nome', a.nome, 'descricao', a.descricao, 'tipo', a.tipo,
               'tamanho', coalesce(a.tamanho, a.tamanho_declarado), 'situacao', a.situacao, 'motivoRecusa', a.motivo_recusa,
               'enviadoEm', a.enviado_em, 'enviadoPor', (select nome from pessoas where id = a.enviado_por),
               'podeTirar', v_editar or a.enviado_por = p_pessoa))
             order by a.enviado_em, a.id)
        from arquivos_manutencao a where a.manutencao_id = m.id and a.retirado_em is null), '[]'::jsonb),
    'pode', jsonb_build_object('enviar', v_editar and m.estado <> 'CANCELADA'),
    'limites', jsonb_build_object('porManutencao', 30, 'tamanho', 10485760));
end $$;

create function plataforma_iniciar_arquivo_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_item uuid, p_nome text,
                                                      p_descricao text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  m := exigir_manutencao(p_id);
  if m.estado = 'CANCELADA' then perform recusar_motivo('Manutenção cancelada: reabra para enviar', 'MANUTENCAO_ENCERRADA'); end if;
  if p_item is not null and not exists (select 1 from itens_vistoria where id = p_item and manutencao_id = p_id and ativo) then
    perform recusar_campos('Item da vistoria não encontrado', 'itemId');
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP) e PDF', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  if length(v_descricao) not between 2 and 300 then perform recusar_campos('Descrição de 2 a 300 caracteres', 'descricao'); end if;
  perform 1 from manutencoes where id = p_id for update;
  if (select count(*) from arquivos_manutencao where manutencao_id = p_id and retirado_em is null) >= 30 then
    perform recusar_motivo('A manutenção já tem 30 arquivos', 'LIMITE_ARQUIVOS');
  end if;
  v_caminho := p_condominio || '/' || p_id || '/' || v_id;
  insert into arquivos_manutencao (id, condominio_id, manutencao_id, item_id, nome, descricao, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, p_id, p_item, btrim(p_nome), v_descricao, p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function plataforma_arquivo_manutencao_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_manutencao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  perform exigir_manutencao(p_id);
  a := exigir_arquivo_manutencao(p_id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function plataforma_verificar_arquivo_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid,
                                                        p_liberado boolean, p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_manutencao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  perform exigir_manutencao(p_id);
  a := exigir_arquivo_manutencao(p_id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_manutencao set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
    perform registrar_historico('manutencao.arquivo_enviado', 'manutencoes', p_id::text, jsonb_strip_nulls(jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome, 'item', a.item_id)));
  else
    update arquivos_manutencao set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
    perform registrar_historico('manutencao.arquivo_recusado', 'manutencoes', p_id::text, jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome, 'motivo', btrim(p_motivo)));
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_abrir_arquivo_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_manutencao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  perform exigir_manutencao(p_id);
  a := exigir_arquivo_manutencao(p_id, p_arquivo);
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

create function plataforma_tirar_arquivo_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a arquivos_manutencao;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  perform exigir_manutencao(p_id);
  a := exigir_arquivo_manutencao(p_id, p_arquivo);
  if not (a.enviado_por = p_pessoa or pode(p_pessoa, p_condominio, 'manutencao.editar')) then
    raise exception 'Sem permissão para tirar este arquivo' using errcode = 'TC401';
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_manutencao set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  perform registrar_historico('manutencao.arquivo_tirado', 'manutencoes', p_id::text, jsonb_build_object(
    'arquivo', a.id, 'arquivoNome', a.nome, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Prestadores (MP-05, MP-09).

create function prestador_json(x prestadores) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', x.id, 'nome', x.nome, 'servico', x.servico, 'contato', x.contato, 'telefone', x.telefone, 'email', x.email,
    'documento', x.documento, 'acordo', x.acordo, 'contratoAte', to_char(x.contrato_ate, 'YYYY-MM-DD'),
    'desde', to_char(x.desde, 'YYYY-MM-DD'), 'observacao', x.observacao,
    'reserva', (select jsonb_build_object('id', r.id, 'nome', r.nome) from prestadores r where r.id = x.reserva_id),
    'arquivado', x.arquivado_em is not null, 'arquivadoEm', x.arquivado_em,
    'abertas', (select count(*) from manutencoes m where m.prestador_id = x.id and m.estado in ('PLANEJADA', 'EM_ANDAMENTO')),
    'pendentes', (select count(*) from manutencoes m where m.prestador_id = x.id and m.estado = 'PENDENTE'),
    'contratoVence', x.acordo = 'CONTRATO' and x.contrato_ate is not null and x.contrato_ate between hoje_no_condominio() and hoje_no_condominio() + 60,
    'contratoVencido', x.acordo = 'CONTRATO' and x.contrato_ate is not null and x.contrato_ate < hoje_no_condominio(),
    'versao', x.versao))
$$;

create function plataforma_prestadores(p_pessoa uuid, p_condominio uuid, p_arquivados boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(prestador_json(x) order by x.acordo = 'CHAMADO', lower(x.nome))
        from prestadores x where (x.arquivado_em is not null) = coalesce(p_arquivados, false)), '[]'::jsonb),
    'arquivados', (select count(*) from prestadores where arquivado_em is not null),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar')));
end $$;

create function plataforma_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare x prestadores;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  select * into x from prestadores where id = p_id;
  if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'prestador', prestador_json(x),
    'manutencoes', coalesce((
      select jsonb_agg(manutencao_json(m, p_pessoa) order by m.estado in ('CONCLUIDA', 'CANCELADA'), coalesce(m.concluida_em, m.criado_em) desc)
        from manutencoes m
       where m.prestador_id = x.id
          or exists (select 1 from providencias_manutencao pv where pv.manutencao_id = m.id and pv.prestador_id = x.id)), '[]'::jsonb),
    'reservaDe', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome) order by lower(r.nome))
                             from prestadores r where r.reserva_id = x.id and r.arquivado_em is null), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar')));
end $$;

-- Cadastrar ou mudar um prestador (MP-05). Registrar não é contratar.
create function plataforma_salvar_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                            p_servico text, p_contato text, p_telefone text, p_email text, p_documento text,
                                            p_acordo text, p_contrato_ate date, p_desde date, p_reserva uuid, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v prestadores;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_servico text := btrim(coalesce(p_servico, ''));
  v_contato text := nullif(btrim(coalesce(p_contato, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_doc text := nullif(btrim(coalesce(p_documento, '')), '');
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_tel text := nullif(btrim(coalesce(p_telefone, '')), '');
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  if p_id is not null then
    select * into v from prestadores where id = p_id;
    if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  end if;
  if length(v_nome) not between 2 and 120 then perform recusar_campos('Nome de 2 a 120 caracteres', 'nome'); end if;
  if length(v_servico) not between 2 and 80 then perform recusar_campos('Diga o serviço, de 2 a 80 caracteres', 'servico'); end if;
  if length(v_contato) not between 2 and 120 then perform recusar_campos('Pessoa de contato de 2 a 120 caracteres', 'contato'); end if;
  if v_tel is not null and not coalesce(telefone_valido(v_tel), false) then perform recusar_campos('Telefone inválido', 'telefone'); end if;
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254) then
    perform recusar_campos('E-mail inválido', 'email');
  end if;
  if v_doc is not null and v_doc !~ '^[0-9./-]{11,18}$' then perform recusar_campos('CNPJ ou CPF inválido', 'documento'); end if;
  if p_acordo is null or p_acordo not in ('CONTRATO', 'CHAMADO') then perform recusar_campos('Com contrato ou por chamado', 'acordo'); end if;
  if p_contrato_ate is not null and p_acordo <> 'CONTRATO' then perform recusar_campos('Vigência só de contrato', 'contratoAte'); end if;
  if p_desde is not null and p_desde > hoje_no_condominio() then perform recusar_campos('Desde: uma data até hoje', 'desde'); end if;
  if length(v_obs) > 1000 then perform recusar_campos('Observação até 1000 caracteres', 'observacao'); end if;
  if p_reserva is not null and (p_reserva = p_id or not exists (select 1 from prestadores where id = p_reserva and arquivado_em is null)) then
    perform recusar_campos('A reserva é outro prestador do cadastro', 'reservaId');
  end if;
  if exists (select 1 from prestadores where arquivado_em is null and lower(btrim(nome)) = lower(v_nome) and id is distinct from p_id) then
    perform recusar_campos('Já há um prestador com esse nome', 'nome');
  end if;
  if p_id is null then
    insert into prestadores (condominio_id, nome, servico, contato, telefone, email, documento, acordo, contrato_ate, desde, reserva_id,
                             observacao, criado_por)
    values (p_condominio, v_nome, v_servico, v_contato, v_tel, v_email, v_doc, p_acordo, p_contrato_ate, p_desde, p_reserva, v_obs, p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico('prestador.cadastrado', 'prestadores', v_id::text, jsonb_build_object('acordo', p_acordo));
  else
    if v.arquivado_em is not null then perform recusar_motivo('Prestador arquivado: volte ao cadastro para mudar', 'PRESTADOR_ARQUIVADO'); end if;
    update prestadores set nome = v_nome, servico = v_servico, contato = v_contato, telefone = v_tel, email = v_email,
                           documento = v_doc, acordo = p_acordo, contrato_ate = p_contrato_ate, desde = p_desde,
                           reserva_id = p_reserva, observacao = v_obs
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('prestadores', p_id); end if;
    perform registrar_historico('prestador.alterado', 'prestadores', v_id::text, jsonb_build_object('acordo', p_acordo));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Arquivar não apaga: o prestador sai das escolhas e continua no histórico (MP-05).
create function plataforma_arquivar_prestador(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_arquivar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v prestadores;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  select * into v from prestadores where id = p_id;
  if not found then raise exception 'Prestador não encontrado' using errcode = 'TC404'; end if;
  if coalesce(p_arquivar, true) and v.arquivado_em is null then
    update prestadores set arquivado_em = app_now(), arquivado_por = p_pessoa where id = p_id and versao = p_versao returning versao into v_versao;
  elsif not coalesce(p_arquivar, true) and v.arquivado_em is not null then
    if exists (select 1 from prestadores where arquivado_em is null and lower(btrim(nome)) = lower(btrim(v.nome))) then
      perform recusar_motivo('Já há um prestador ativo com esse nome', 'NOME_EM_USO');
    end if;
    update prestadores set arquivado_em = null, arquivado_por = null where id = p_id and versao = p_versao returning versao into v_versao;
  else
    return jsonb_build_object('versao', v.versao);
  end if;
  if v_versao is null then perform conflito_versao('prestadores', p_id); end if;
  perform registrar_historico(case when coalesce(p_arquivar, true) then 'prestador.arquivado' else 'prestador.reativado' end,
                              'prestadores', p_id::text, '{}'::jsonb);
  return jsonb_build_object('versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Preventivas (MP-03, MP-13).

create function preventiva_json(p preventivas, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'atividade', p.atividade, 'local', p.local, 'unidadeTempo', p.unidade_tempo, 'intervalo', p.intervalo,
    'proximaData', to_char(p.proxima_data, 'YYYY-MM-DD'), 'antecedenciaDias', p.antecedencia_dias,
    'responsavel', jsonb_build_object('vinculoId', p.responsavel_id, 'nome', nome_do_vinculo(p.responsavel_id)),
    'executor', executor_json(p.prestador_id, p.executor_vinculo, p.executor_texto),
    'observacao', p.observacao, 'ativa', p.ativa, 'versao', p.versao,
    'aberta', (select manutencao_json(m, p_pessoa) from manutencoes m
                where m.preventiva_id = p.id and m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')
                order by m.data_prevista limit 1),
    'ultima', (select jsonb_build_object('id', m.id, 'realizadaEm', to_char(m.realizada_em, 'YYYY-MM-DD')) from manutencoes m
                where m.preventiva_id = p.id and m.estado = 'CONCLUIDA' order by m.realizada_em desc limit 1)))
$$;

create function plataforma_preventivas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.ver');
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(preventiva_json(p, p_pessoa) order by not p.ativa, p.proxima_data, lower(p.atividade))
                         from preventivas p), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'manutencao.editar')));
end $$;

-- Cadastrar ou mudar uma preventiva. Se a data já está dentro da antecedência, a manutenção
-- abre na hora.
create function plataforma_salvar_preventiva(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_atividade text,
                                             p_local text, p_unidade_tempo text, p_intervalo integer, p_proxima_data date,
                                             p_antecedencia integer, p_responsavel uuid, p_prestador uuid, p_executor_vinculo uuid,
                                             p_executor_texto text, p_observacao text, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v preventivas;
  v_atividade text := btrim(coalesce(p_atividade, ''));
  v_local text := btrim(coalesce(p_local, ''));
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_exec text;
  v_id uuid;
  v_versao integer;
  v_abertas integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  if p_id is not null then
    select * into v from preventivas where id = p_id;
    if not found then raise exception 'Preventiva não encontrada' using errcode = 'TC404'; end if;
  end if;
  if length(v_atividade) not between 3 and 120 then perform recusar_campos('Diga a atividade, de 3 a 120 caracteres', 'atividade'); end if;
  if length(v_local) not between 2 and 120 then perform recusar_campos('Diga o local ou o equipamento', 'local'); end if;
  if p_unidade_tempo is null or p_unidade_tempo not in ('SEMANA', 'MES', 'ANO') then
    perform recusar_campos('Repete em semanas, meses ou anos', 'unidadeTempo');
  end if;
  if p_intervalo is null or p_intervalo < 1
     or p_intervalo > (case p_unidade_tempo when 'SEMANA' then 52 when 'MES' then 60 else 10 end) then
    perform recusar_campos('A cada 1 a 52 semanas, 1 a 60 meses ou 1 a 10 anos', 'intervalo');
  end if;
  if p_proxima_data is null or p_proxima_data > hoje_no_condominio() + 3660
     or (p_proxima_data < hoje_no_condominio() and (p_id is null or p_proxima_data <> v.proxima_data)) then
    perform recusar_campos('A próxima data fica entre hoje e dez anos à frente', 'proximaData');
  end if;
  if coalesce(p_antecedencia, 15) not between 0 and 90 then perform recusar_campos('Abrir de 0 a 90 dias antes', 'antecedenciaDias'); end if;
  perform exigir_responsavel_manutencao(p_responsavel);
  v_exec := exigir_executor(p_prestador, p_executor_vinculo, p_executor_texto);
  if length(v_obs) > 1000 then perform recusar_campos('Observação até 1000 caracteres', 'observacao'); end if;
  if p_id is null then
    insert into preventivas (condominio_id, atividade, local, unidade_tempo, intervalo, proxima_data, antecedencia_dias, responsavel_id,
                             prestador_id, executor_vinculo, executor_texto, observacao, ativa, criado_por)
    values (p_condominio, v_atividade, v_local, p_unidade_tempo, p_intervalo, p_proxima_data, coalesce(p_antecedencia, 15), p_responsavel,
            p_prestador, p_executor_vinculo, v_exec, v_obs, coalesce(p_ativa, true), p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico('preventiva.cadastrada', 'preventivas', v_id::text, jsonb_build_object(
      'unidadeTempo', p_unidade_tempo, 'intervalo', p_intervalo, 'proximaData', to_char(p_proxima_data, 'YYYY-MM-DD')));
  else
    -- Com uma manutenção aberta para a data atual, a data não muda até ela terminar.
    if p_proxima_data <> v.proxima_data and exists (
         select 1 from manutencoes m where m.preventiva_id = p_id and m.data_prevista = v.proxima_data
                                       and m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')) then
      perform recusar_motivo('A manutenção desta data já está aberta: conclua ou cancele antes de mudar a data', 'PREVENTIVA_ABERTA');
    end if;
    update preventivas set atividade = v_atividade, local = v_local, unidade_tempo = p_unidade_tempo, intervalo = p_intervalo,
                           proxima_data = p_proxima_data, antecedencia_dias = coalesce(p_antecedencia, 15),
                           responsavel_id = p_responsavel, prestador_id = p_prestador, executor_vinculo = p_executor_vinculo,
                           executor_texto = v_exec, observacao = v_obs, ativa = coalesce(p_ativa, v.ativa)
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('preventivas', p_id); end if;
    perform registrar_historico('preventiva.alterada', 'preventivas', v_id::text, jsonb_build_object(
      'unidadeTempo', p_unidade_tempo, 'intervalo', p_intervalo, 'proximaData', to_char(p_proxima_data, 'YYYY-MM-DD'),
      'ativa', coalesce(p_ativa, v.ativa)));
  end if;
  v_abertas := abrir_preventivas();
  return jsonb_build_object('id', v_id, 'versao', (select versao from preventivas where id = v_id), 'abertas', v_abertas);
end $$;

-- ---------------------------------------------------------------------------------------
-- Etapas da manutenção, nas Configurações (MP-02).

create function plataforma_etapas_manutencao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return jsonb_build_object(
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'situacao', x.situacao, 'ordem', x.ordem,
                                                            'ativa', x.ativa, 'versao', x.versao)
                                         order by array_position(array['PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDA'], x.situacao),
                                                  x.ordem, lower(x.nome))
                          from etapas_manutencao x), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar'));
end $$;

create function plataforma_salvar_etapa_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                                   p_situacao text, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v etapas_manutencao;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if length(v_nome) not between 2 and 40 then perform recusar_campos('Nome da etapa de 2 a 40 caracteres', 'nome'); end if;
  if p_id is null then
    if p_situacao is null or p_situacao not in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDA') then
      perform recusar_campos('Escolha a situação da etapa', 'situacao');
    end if;
    if exists (select 1 from etapas_manutencao where ativa and situacao = p_situacao and lower(btrim(nome)) = lower(v_nome)) then
      perform recusar_campos('Já há uma etapa com esse nome nesta situação', 'nome');
    end if;
    if (select count(*) from etapas_manutencao) >= 60 then perform recusar_motivo('Até 60 etapas', 'LIMITE_ETAPAS'); end if;
    insert into etapas_manutencao (condominio_id, nome, situacao, ordem, ativa)
    values (p_condominio, v_nome, p_situacao,
            least(100, coalesce((select max(ordem) from etapas_manutencao where situacao = p_situacao), 0) + 1), coalesce(p_ativa, true))
    returning id, versao into v_id, v_versao;
    perform registrar_historico('etapa_manutencao.criada', 'etapas_manutencao', v_id::text, jsonb_build_object('situacao', p_situacao));
  else
    select * into v from etapas_manutencao where id = p_id;
    if not found then raise exception 'Etapa não encontrada' using errcode = 'TC404'; end if;
    if p_situacao is not null and p_situacao <> v.situacao then
      perform recusar_campos('A situação da etapa não muda: crie outra etapa', 'situacao');
    end if;
    if coalesce(p_ativa, v.ativa) and exists (select 1 from etapas_manutencao where ativa and situacao = v.situacao and id <> p_id
                                                                                 and lower(btrim(nome)) = lower(v_nome)) then
      perform recusar_campos('Já há uma etapa com esse nome nesta situação', 'nome');
    end if;
    update etapas_manutencao set nome = v_nome, ativa = coalesce(p_ativa, v.ativa)
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('etapas_manutencao', p_id); end if;
    perform registrar_historico('etapa_manutencao.alterada', 'etapas_manutencao', v_id::text, jsonb_build_object('ativa', coalesce(p_ativa, v.ativa)));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- No pedido e na agenda (MP-04).

-- As manutenções ligadas ao pedido. Nada muda sozinho no pedido.
create function plataforma_manutencoes_do_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if not pode(p_pessoa, p_condominio, 'manutencao.ver') then
    return jsonb_build_object('podeVer', false, 'podeAbrir', false, 'manutencoes', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'podeVer', true,
    'podeAbrir', pode(p_pessoa, p_condominio, 'manutencao.editar'),
    'manutencoes', coalesce((
      select jsonb_agg(manutencao_json(m, p_pessoa) order by m.criado_em)
        from manutencoes m where m.pedido_id = v.id and m.estado <> 'CANCELADA'), '[]'::jsonb));
end $$;

-- Marcar a visita a partir da manutenção: o compromisso nasce ligado a ela (e ao pedido dela).
create function plataforma_marcar_visita_manutencao(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_tipo text, p_titulo text,
                                                    p_data date, p_inicio time, p_fim time, p_onde text, p_unidade uuid,
                                                    p_local text, p_participantes uuid[], p_de_fora text, p_observacao text,
                                                    p_estado text, p_aceitar_conflito boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m manutencoes;
  v_r jsonb;
  v_pedido uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  m := exigir_manutencao(p_manutencao);
  perform exigir_manutencao_aberta(m);
  -- O pedido da manutenção entra na visita só se a pessoa o enxerga.
  select p.id into v_pedido from pedidos p where p.id = m.pedido_id and pode(p_pessoa, p_condominio, 'pedidos.ver') and pedido_visivel(p_pessoa, p);
  v_r := plataforma_marcar_compromisso(p_pessoa, p_condominio, p_tipo, p_titulo, p_data, p_inicio, p_fim, p_onde, p_unidade, p_local,
                                       p_participantes, p_de_fora, v_pedido, p_observacao, p_estado, null, null, null, null,
                                       p_aceitar_conflito);
  update compromissos set manutencao_id = m.id where id = (v_r ->> 'id')::uuid;
  perform registrar_historico('manutencao.visita_marcada', 'manutencoes', m.id::text, jsonb_build_object(
    'compromisso', (v_r ->> 'id')::uuid, 'data', to_char(p_data, 'YYYY-MM-DD'), 'hora', to_char(p_inicio, 'HH24:MI')));
  return v_r;
end $$;

-- ---------------------------------------------------------------------------------------
-- Rotina da manutenção: de hora em hora, pelo pg_cron do Supabase. Onde o pg_cron não existe
-- (o banco dos testes), a rotina é chamada direto.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-manutencao', '7 * * * *', 'select public.verificar_manutencao()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_manutencao() de outro jeito (%).', sqlerrm;
end $$;

call fechar_acesso();

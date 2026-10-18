-- 0180 · Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04). Telas e decisões
-- aprovadas pela Carolina em 18/10/2026 (docs/telas/memoria.html).
--
-- Regras desta parte:
-- 1. A memória é do prédio (CT-03): nada muda quando o síndico muda; quem sai perde o acesso e
--    o que fez continua com o nome e a data. Nada é apagado: corrigir guarda a versão anterior.
-- 2. Prontuário (MP-12): lista sugerida igual para todos os cenários, mais os itens que o
--    síndico cria. Cada item aponta para um documento de Documentos; a validade vem de lá. Os
--    contratos dos prestadores e as preventivas entram como contagem, sem cópia. Situação: em
--    dia, vence (no prazo de aviso do item, 60 dias se não mudar), venceu, falta ou não se
--    aplica (com motivo). Vence e venceu avisam no sino de quem cuida dos documentos, uma vez
--    por data; o que falta aparece no Início.
-- 3. Quem mexe: ver a memória é de quem vê os documentos; prontuário, manual e anotar são de
--    quem cuida dos documentos; dossiê e exportação, só do síndico.
-- 4. Linha do tempo (CT-03): montada na hora com manutenções concluídas, versões de
--    documentos, assembleias publicadas, entrada e saída de síndico e itens do prontuário
--    vencidos, mais as anotações (decisão, combinado, obra, ocorrência ou outro). Cada um vê de
--    cada área só o que já veria na tela dela. Anotação corrigida guarda a versão anterior;
--    tirar da linha do tempo pede motivo.
-- 5. Manual do prédio (MP-14): seções curtas, em ordem; cada uma "no mural" ou "só a gestão"
--    (nova começa só a gestão). As do mural aparecem no mural online, sem conta. Mudar guarda a
--    versão anterior; tirar pede motivo.
-- 6. Dossiê de passagem de bastão (CT-02): retrato gerado na hora pelo síndico e guardado como
--    foi gerado. Nunca traz senha nem dado de morador além do número da unidade; pedido privado
--    aparece só como "pedido privado".
-- 7. Exportação (CT-04): só o síndico pede, uma por vez e no máximo uma por dia (a que falhou
--    não conta). Um pacote com os dados (planilhas e JSON) e pacotes com os arquivos, montados
--    pela api-plataforma em segundo plano e guardados no bucket privado "exportacoes". Os links
--    valem 7 dias. Pedido, pronto e cada download ficam no histórico, que a TRÍADE vê no Console.

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'memoria.dossie'),
  ('SINDICO', 'memoria.exportar');

-- ---------------------------------------------------------------------------------------
-- Prontuário do prédio (MP-12).

-- Lista sugerida, igual para todos os cenários. A chave liga o item guardado à sugestão.
create function prontuario_sugerido() returns table (chave text, grupo text, nome text, ordem integer)
language sql immutable
set search_path = public
as $$
  values
    ('CONVENCAO',        'CONSTITUICAO', 'Convenção', 1),
    ('REGIMENTO',        'CONSTITUICAO', 'Regimento interno', 2),
    ('ATA_AGO',          'CONSTITUICAO', 'Ata da última assembleia ordinária', 3),
    ('SEGURO',           'SEGUROS',      'Apólice do seguro obrigatório', 10),
    ('GARANTIA',         'SEGUROS',      'Garantia da construtora', 11),
    ('AVCB',             'LAUDOS',       'AVCB (Corpo de Bombeiros)', 20),
    ('ELEVADORES',       'LAUDOS',       'Inspeção dos elevadores', 21),
    ('SPDA',             'LAUDOS',       'Para-raios (SPDA)', 22),
    ('AGUA',             'LAUDOS',       'Limpeza da caixa d''água e potabilidade', 23),
    ('EXTINTORES',       'LAUDOS',       'Recarga dos extintores', 24),
    ('INSPECAO_PREDIAL', 'LAUDOS',       'Inspeção predial', 25),
    ('PLANTAS',          'PLANTAS',      'Plantas aprovadas', 30),
    ('PROJETOS',         'PLANTAS',      'Projetos elétrico e hidráulico', 31),
    ('MANUAL_CONSTRUTORA', 'PLANTAS',    'Manual do proprietário (construtora)', 32)
$$;

create table itens_prontuario (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  chave          text check (chave ~ '^[A-Z][A-Z_]{1,39}$'),
  grupo          text not null check (grupo in ('CONSTITUICAO', 'SEGUROS', 'LAUDOS', 'PLANTAS', 'OUTRO')),
  nome           text not null check (length(btrim(nome)) between 3 and 120),
  documento_id   uuid,
  avisar_dias    smallint not null default 60 check (avisar_dias between 0 and 365),
  nao_se_aplica  text check (length(btrim(nao_se_aplica)) between 3 and 500),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid not null references pessoas (id),
  atualizado_em  timestamptz not null default app_now(),
  versao         integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, chave),
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  check (documento_id is null or nao_se_aplica is null)
);
create unique index itens_prontuario_nome on itens_prontuario (condominio_id, lower(btrim(nome)));
call proteger_tabela_condominio('itens_prontuario');
create trigger itens_prontuario_sem_exclusao before delete on itens_prontuario for each row execute function somente_insercao();

create function itens_prontuario_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.chave, new.criado_em, new.criado_por) is distinct from (old.chave, old.criado_em, old.criado_por)
     or (old.chave is not null and (new.nome, new.grupo) is distinct from (old.nome, old.grupo)) then
    raise exception 'O item do prontuário não muda de origem' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger itens_prontuario_regras before update on itens_prontuario for each row execute function itens_prontuario_regras();

-- ---------------------------------------------------------------------------------------
-- Anotações da linha do tempo (CT-03).

create table anotacoes_memoria (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  tipo             text not null check (tipo in ('DECISAO', 'COMBINADO', 'OBRA', 'OCORRENCIA', 'OUTRO')),
  titulo           text not null check (length(btrim(titulo)) between 3 and 120),
  texto            text not null check (length(btrim(texto)) between 3 and 4000),
  aconteceu_em     date not null check (aconteceu_em between date '1950-01-01' and date '2100-12-31'),
  documento_id     uuid,
  pedido_id        uuid,
  manutencao_id    uuid,
  retirada_em      timestamptz,
  retirada_por     uuid references pessoas (id),
  motivo_retirada  text check (length(btrim(motivo_retirada)) between 3 and 500),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (documento_id, condominio_id) references documentos (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  check (num_nonnulls(documento_id, pedido_id, manutencao_id) <= 1),
  check ((retirada_em is null) = (retirada_por is null) and (retirada_em is null) = (motivo_retirada is null))
);
create index anotacoes_memoria_data on anotacoes_memoria (condominio_id, aconteceu_em desc);
call proteger_tabela_condominio('anotacoes_memoria');
create trigger anotacoes_memoria_sem_exclusao before delete on anotacoes_memoria for each row execute function somente_insercao();

create function anotacoes_memoria_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.retirada_em is not null then raise exception 'A anotação já saiu da linha do tempo' using errcode = 'TC422'; end if;
  if (new.criado_em, new.criado_por) is distinct from (old.criado_em, old.criado_por) then
    raise exception 'Quem anotou e quando não mudam' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger anotacoes_memoria_regras before update on anotacoes_memoria for each row execute function anotacoes_memoria_regras();

-- Cada correção guarda aqui como a anotação estava.
create table versoes_anotacao (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  anotacao_id    uuid not null,
  numero         smallint not null check (numero between 1 and 500),
  tipo           text not null,
  titulo         text not null,
  texto          text not null,
  aconteceu_em   date not null,
  documento_id   uuid,
  pedido_id      uuid,
  manutencao_id  uuid,
  escrita_em     timestamptz not null,
  escrita_por    uuid not null references pessoas (id),
  substituida_em timestamptz not null default app_now(),
  foreign key (anotacao_id, condominio_id) references anotacoes_memoria (id, condominio_id),
  unique (anotacao_id, numero)
);
call proteger_tabela_condominio('versoes_anotacao');
create trigger versoes_anotacao_sem_exclusao before delete on versoes_anotacao for each row execute function somente_insercao();
create trigger versoes_anotacao_sem_mudanca before update on versoes_anotacao for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Manual do prédio (MP-14).

create table secoes_manual (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  titulo           text not null check (length(btrim(titulo)) between 3 and 80),
  resumo           text check (length(btrim(resumo)) between 3 and 160),
  texto            text not null check (length(btrim(texto)) between 3 and 8000),
  ordem            smallint not null check (ordem between 1 and 200),
  no_mural         boolean not null default false,
  retirada_em      timestamptz,
  retirada_por     uuid references pessoas (id),
  motivo_retirada  text check (length(btrim(motivo_retirada)) between 3 and 500),
  escrita_em       timestamptz not null default app_now(),
  escrita_por      uuid not null references pessoas (id),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  check ((retirada_em is null) = (retirada_por is null) and (retirada_em is null) = (motivo_retirada is null))
);
create unique index secoes_manual_titulo on secoes_manual (condominio_id, lower(btrim(titulo))) where retirada_em is null;
call proteger_tabela_condominio('secoes_manual');
create trigger secoes_manual_sem_exclusao before delete on secoes_manual for each row execute function somente_insercao();

create function secoes_manual_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.retirada_em is not null then raise exception 'A seção já saiu do manual' using errcode = 'TC422'; end if;
  if (new.criado_em, new.criado_por) is distinct from (old.criado_em, old.criado_por) then
    raise exception 'Quem criou e quando não mudam' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger secoes_manual_regras before update on secoes_manual for each row execute function secoes_manual_regras();

-- Cada mudança de texto guarda aqui como a seção estava.
create table versoes_secao_manual (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  secao_id       uuid not null,
  numero         smallint not null check (numero between 1 and 1000),
  titulo         text not null,
  resumo         text,
  texto          text not null,
  escrita_em     timestamptz not null,
  escrita_por    uuid not null references pessoas (id),
  substituida_em timestamptz not null default app_now(),
  foreign key (secao_id, condominio_id) references secoes_manual (id, condominio_id),
  unique (secao_id, numero)
);
call proteger_tabela_condominio('versoes_secao_manual');
create trigger versoes_secao_manual_sem_exclusao before delete on versoes_secao_manual for each row execute function somente_insercao();
create trigger versoes_secao_manual_sem_mudanca before update on versoes_secao_manual for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Dossiê de passagem de bastão (CT-02): o retrato fica como foi gerado.

create table dossies (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  conteudo       jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  gerado_em      timestamptz not null default app_now(),
  gerado_por     uuid not null references pessoas (id),
  unique (id, condominio_id)
);
create index dossies_data on dossies (condominio_id, gerado_em desc);
call proteger_tabela_condominio('dossies');
create trigger dossies_sem_exclusao before delete on dossies for each row execute function somente_insercao();
create trigger dossies_sem_mudanca before update on dossies for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Exportação (CT-04).

create table exportacoes (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  situacao       text not null default 'MONTANDO' check (situacao in ('MONTANDO', 'PRONTA', 'FALHOU')),
  pedida_em      timestamptz not null default app_now(),
  pedida_por     uuid not null references pessoas (id),
  pronta_em      timestamptz,
  expira_em      timestamptz,
  erro           text check (length(erro) between 1 and 300),
  unique (id, condominio_id),
  check ((situacao = 'PRONTA') = (pronta_em is not null) and (pronta_em is null) = (expira_em is null)),
  check ((situacao = 'FALHOU') = (erro is not null))
);
create unique index exportacoes_uma_por_vez on exportacoes (condominio_id) where situacao = 'MONTANDO';
create index exportacoes_data on exportacoes (condominio_id, pedida_em desc);
call proteger_tabela_condominio('exportacoes');
create trigger exportacoes_sem_exclusao before delete on exportacoes for each row execute function somente_insercao();

create function exportacoes_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.situacao <> 'MONTANDO' then raise exception 'A exportação já terminou' using errcode = 'TC422'; end if;
  if (new.pedida_em, new.pedida_por) is distinct from (old.pedida_em, old.pedida_por) then
    raise exception 'Quem pediu e quando não mudam' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger exportacoes_regras before update on exportacoes for each row execute function exportacoes_regras();

-- Cada pacote: o dos dados e os dos arquivos (até 45 MB cada, abaixo do limite do armazenamento).
create table partes_exportacao (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  exportacao_id   uuid not null,
  numero          smallint not null check (numero between 1 and 999),
  tipo            text not null check (tipo in ('DADOS', 'ARQUIVOS')),
  arquivos        jsonb not null default '[]'::jsonb check (jsonb_typeof(arquivos) = 'array'),
  quantos         integer not null default 0 check (quantos >= 0),
  situacao        text not null default 'ESPERA' check (situacao in ('ESPERA', 'MONTANDO', 'PRONTA', 'FALHOU')),
  tentativas      smallint not null default 0 check (tentativas between 0 and 10),
  iniciada_em     timestamptz,
  caminho         text not null unique,
  tamanho         bigint check (tamanho > 0),
  pronta_em       timestamptz,
  unique (id, condominio_id),
  unique (exportacao_id, numero),
  foreign key (exportacao_id, condominio_id) references exportacoes (id, condominio_id),
  check ((tipo = 'DADOS') = (numero = 1)),
  check ((situacao = 'PRONTA') = (tamanho is not null) and (situacao = 'PRONTA') = (pronta_em is not null))
);
create index partes_exportacao_espera on partes_exportacao (condominio_id) where situacao in ('ESPERA', 'MONTANDO');
call proteger_tabela_condominio('partes_exportacao');
create trigger partes_exportacao_sem_exclusao before delete on partes_exportacao for each row execute function somente_insercao();

create function partes_exportacao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.situacao in ('PRONTA', 'FALHOU') then raise exception 'O pacote já terminou' using errcode = 'TC422'; end if;
  if (new.exportacao_id, new.numero, new.tipo, new.arquivos, new.quantos, new.caminho)
     is distinct from (old.exportacao_id, old.numero, old.tipo, old.arquivos, old.quantos, old.caminho) then
    raise exception 'O conteúdo do pacote não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger partes_exportacao_regras before update on partes_exportacao for each row execute function partes_exportacao_regras();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('exportacoes', 'exportacoes', false, 52428800, array['application/zip'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Avisos no sino: prontuário vencendo ou vencido e exportação pronta ou que falhou.

create table avisos_memoria (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  pessoa_id      uuid not null references pessoas (id),
  tipo           text not null check (tipo in ('PRONTUARIO_VENCE', 'PRONTUARIO_VENCEU', 'EXPORTACAO_PRONTA', 'EXPORTACAO_FALHOU')),
  item_id        uuid,
  exportacao_id  uuid,
  referencia     date,
  criado_em      timestamptz not null default app_now(),
  visto_em       timestamptz,
  foreign key (item_id, condominio_id) references itens_prontuario (id, condominio_id),
  foreign key (exportacao_id, condominio_id) references exportacoes (id, condominio_id),
  check ((tipo like 'PRONTUARIO%') = (item_id is not null and referencia is not null)),
  check ((tipo like 'EXPORTACAO%') = (exportacao_id is not null)),
  unique nulls not distinct (pessoa_id, tipo, item_id, exportacao_id, referencia)
);
create index avisos_memoria_pessoa on avisos_memoria (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_memoria');
create trigger avisos_memoria_sem_exclusao before delete on avisos_memoria for each row execute function somente_insercao();
create function avisos_memoria_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.tipo, new.item_id, new.exportacao_id, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.tipo, old.item_id, old.exportacao_id, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_memoria_regras before update on avisos_memoria for each row execute function avisos_memoria_regras();

-- ---------------------------------------------------------------------------------------
-- Prontuário: a lista com a situação de cada item.

create function prontuario_lista() returns table (id uuid, chave text, grupo text, nome text, ordem integer, documento_id uuid,
                                                   avisar_dias integer, nao_se_aplica text, versao integer, situacao text, vale_ate date)
language sql stable
set search_path = public
as $$
  select i.id, coalesce(s.chave, i.chave), coalesce(s.grupo, i.grupo), coalesce(s.nome, i.nome), coalesce(s.ordem, 900),
         i.documento_id, coalesce(i.avisar_dias, 60)::integer, i.nao_se_aplica, i.versao,
         case when i.nao_se_aplica is not null then 'NAO_SE_APLICA'
              when d.id is null or d.arquivado_em is not null
                   or not exists (select 1 from versoes_documento v where v.documento_id = d.id and v.situacao = 'LIBERADO') then 'FALTA'
              when d.vale_ate is not null and d.vale_ate < hoje_no_condominio() then 'VENCEU'
              when d.vale_ate is not null and d.vale_ate <= hoje_no_condominio() + coalesce(i.avisar_dias, 60) then 'VENCE'
              else 'EM_DIA' end,
         case when i.nao_se_aplica is null and d.arquivado_em is null then d.vale_ate end
    from prontuario_sugerido() s
    full join itens_prontuario i on i.chave = s.chave
    left join documentos d on d.id = i.documento_id
$$;

create function resumo_prontuario() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*) filter (where situacao <> 'NAO_SE_APLICA'),
    'emDia', count(*) filter (where situacao = 'EM_DIA'),
    'vence', count(*) filter (where situacao = 'VENCE'),
    'venceu', count(*) filter (where situacao = 'VENCEU'),
    'falta', count(*) filter (where situacao = 'FALTA'),
    'naoSeAplica', count(*) filter (where situacao = 'NAO_SE_APLICA'))
    from prontuario_lista()
$$;

create function plataforma_prontuario(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_manut boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  v_manut := pode(p_pessoa, p_condominio, 'manutencao.ver');
  return jsonb_strip_nulls(jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', x.id, 'chave', x.chave, 'grupo', x.grupo, 'nome', x.nome, 'situacao', x.situacao, 'avisarDias', x.avisar_dias,
               'motivo', x.nao_se_aplica, 'versao', x.versao, 'valeAte', to_char(x.vale_ate, 'YYYY-MM-DD'),
               'documento', case when d.id is null then null
                                 when d.restrito and not pode(p_pessoa, p_condominio, 'documentos.restritos') then jsonb_build_object('restrito', true)
                                 else jsonb_strip_nulls(jsonb_build_object(
                                   'id', d.id, 'titulo', d.titulo, 'tipo', d.tipo, 'arquivado', case when d.arquivado_em is not null then true end,
                                   'emVigor', (select jsonb_build_object('numero', v.numero, 'vigenteDesde', to_char(v.vigente_desde, 'YYYY-MM-DD'))
                                                 from versao_em_vigor(d.id) v where v.id is not null))) end))
             order by array_position(array['CONSTITUICAO', 'SEGUROS', 'LAUDOS', 'PLANTAS', 'OUTRO'], x.grupo), x.ordem, lower(x.nome))
        from prontuario_lista() x left join documentos d on d.id = x.documento_id), '[]'::jsonb),
    'resumo', resumo_prontuario(),
    'contratos', case when v_manut then jsonb_build_object(
      'total', (select count(*) from prestadores where arquivado_em is null and acordo = 'CONTRATO'),
      'vencendo', coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'prestador', x.nome, 'ate', to_char(x.contrato_ate, 'YYYY-MM-DD')) order by x.contrato_ate)
          from prestadores x where x.arquivado_em is null and x.acordo = 'CONTRATO' and x.contrato_ate <= hoje_no_condominio() + 60), '[]'::jsonb)) end,
    'preventivas', case when v_manut then jsonb_build_object(
      'ativas', (select count(*) from preventivas where ativa),
      'atrasadas', (select count(*) from preventivas where ativa and proxima_data < hoje_no_condominio())) end,
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'tipo', d.tipo, 'valeAte', to_char(d.vale_ate, 'YYYY-MM-DD'))
                       order by lower(d.titulo))
        from documentos d where d.arquivado_em is null and (not d.restrito or pode(p_pessoa, p_condominio, 'documentos.restritos'))), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'documentos.editar')));
end $$;

-- Mexer num item: criar item próprio, ligar ou desligar documento, "não se aplica" e voltar a
-- valer. O item sugerido só ganha linha na primeira vez que alguém mexe nele.
create function plataforma_item_prontuario(p_pessoa uuid, p_condominio uuid, p_id uuid, p_chave text, p_versao integer, p_acao text,
                                           p_nome text, p_grupo text, p_documento uuid, p_avisar_dias integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i itens_prontuario;
  s record;
  d documentos;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  if p_acao is null or p_acao not in ('CRIAR', 'LIGAR', 'DESLIGAR', 'NAO_SE_APLICA', 'VALE') then
    perform recusar_campos('Ação desconhecida', 'acao');
  end if;

  if p_acao = 'CRIAR' then
    if length(v_nome) not between 3 and 120 then perform recusar_campos('Nome do item de 3 a 120 caracteres', 'nome'); end if;
    if p_grupo is null or p_grupo not in ('CONSTITUICAO', 'SEGUROS', 'LAUDOS', 'PLANTAS', 'OUTRO') then
      perform recusar_campos('Escolha o grupo', 'grupo');
    end if;
    if exists (select 1 from prontuario_lista() x where lower(btrim(x.nome)) = lower(v_nome)) then
      perform recusar_motivo('Já existe um item com este nome', 'ITEM_REPETIDO');
    end if;
    if (select count(*) from itens_prontuario where chave is null) >= 100 then
      perform recusar_motivo('O prontuário já tem 100 itens próprios', 'LIMITE_ITENS');
    end if;
    insert into itens_prontuario (condominio_id, grupo, nome, criado_por) values (p_condominio, p_grupo, v_nome, p_pessoa) returning * into i;
    perform registrar_historico('prontuario.item_criado', 'itens_prontuario', i.id::text, jsonb_build_object('item', v_nome, 'grupo', p_grupo));
    return jsonb_build_object('id', i.id, 'versao', i.versao);
  end if;

  if p_id is not null then
    select * into i from itens_prontuario where id = p_id;
    if not found then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  else
    select * into s from prontuario_sugerido() x where x.chave = p_chave;
    if s.chave is null then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
    select * into i from itens_prontuario where chave = p_chave;
    if not found then
      insert into itens_prontuario (condominio_id, chave, grupo, nome, criado_por) values (p_condominio, s.chave, s.grupo, s.nome, p_pessoa)
      on conflict (condominio_id, chave) do nothing returning * into i;
      if i.id is null then perform conflito_versao('itens_prontuario', (select id from itens_prontuario where chave = p_chave)); end if;
      p_versao := i.versao;
    end if;
  end if;

  if p_acao = 'LIGAR' then
    select * into d from documentos where id = p_documento;
    if not found or d.arquivado_em is not null then perform recusar_campos('Escolha um documento guardado em Documentos', 'documentoId'); end if;
    if d.restrito and not pode(p_pessoa, p_condominio, 'documentos.restritos') then
      perform recusar_campos('Escolha um documento guardado em Documentos', 'documentoId');
    end if;
    if coalesce(p_avisar_dias, 60) not between 0 and 365 then perform recusar_campos('Avisar de 0 a 365 dias antes', 'avisarDias'); end if;
    update itens_prontuario set documento_id = d.id, avisar_dias = coalesce(p_avisar_dias, 60), nao_se_aplica = null
     where id = i.id and versao = p_versao returning versao into v_versao;
  elsif p_acao = 'DESLIGAR' then
    if i.documento_id is null then perform recusar_motivo('O item não tem documento ligado', 'SEM_DOCUMENTO'); end if;
    update itens_prontuario set documento_id = null where id = i.id and versao = p_versao returning versao into v_versao;
  elsif p_acao = 'NAO_SE_APLICA' then
    v_motivo := exigir_motivo(p_motivo);
    update itens_prontuario set documento_id = null, nao_se_aplica = v_motivo where id = i.id and versao = p_versao returning versao into v_versao;
  else
    if i.nao_se_aplica is null then perform recusar_motivo('O item já vale', 'JA_VALE'); end if;
    update itens_prontuario set nao_se_aplica = null where id = i.id and versao = p_versao returning versao into v_versao;
  end if;
  if v_versao is null then perform conflito_versao('itens_prontuario', i.id); end if;
  perform registrar_historico('prontuario.' || lower(p_acao), 'itens_prontuario', i.id::text, jsonb_strip_nulls(jsonb_build_object(
    'item', i.nome, 'documento', case when p_acao = 'LIGAR' then d.id end, 'documentoTitulo', case when p_acao = 'LIGAR' then d.titulo end,
    'avisarDias', case when p_acao = 'LIGAR' then coalesce(p_avisar_dias, 60) end, 'motivo', v_motivo)));
  return jsonb_build_object('id', i.id, 'versao', v_versao);
end $$;

-- Prontuário vencendo ou vencido: avisa quem cuida dos documentos (e vê o documento), uma vez
-- por data. Se o aviso do documento já saiu para a mesma data, o "vence" não repete.
create function avisar_prontuario() returns integer
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  insert into avisos_memoria (condominio_id, pessoa_id, tipo, item_id, referencia)
  select contexto_condominio(), v.pessoa_id, case x.situacao when 'VENCEU' then 'PRONTUARIO_VENCEU' else 'PRONTUARIO_VENCE' end, x.id, x.vale_ate
    from prontuario_lista() x
    join documentos d on d.id = x.documento_id
    join (select distinct pessoa_id from vinculos where condominio_id = contexto_condominio() and revogado_em is null
                                                    and funcao in ('SINDICO', 'AUTORIZADO')) v
      on pode(v.pessoa_id, contexto_condominio(), 'documentos.editar')
     and (not d.restrito or pode(v.pessoa_id, contexto_condominio(), 'documentos.restritos'))
   where x.id is not null and x.situacao in ('VENCE', 'VENCEU')
     and (x.situacao = 'VENCEU' or not exists (select 1 from avisos_documento a where a.pessoa_id = v.pessoa_id and a.documento_id = d.id
                                                                                and a.referencia = x.vale_ate))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function verificar_comunicados() returns integer
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
      v_total := v_total + publicar_programados() + avisar_documentos() + avisar_prontuario();
    exception when others then
      raise warning 'Comunicados do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------
-- Linha do tempo (CT-03).

create function data_no_condominio(p timestamptz) returns date
language sql stable
set search_path = public
as $$ select (p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date $$;

-- A ligação de uma anotação, do jeito que a pessoa pode ver.
create function ligacao_anotacao_json(p_pessoa uuid, a anotacoes_memoria) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select case when d.restrito and not pode(p_pessoa, a.condominio_id, 'documentos.restritos')
                 then jsonb_build_object('tipo', 'DOCUMENTO', 'restrito', true)
                 else jsonb_build_object('tipo', 'DOCUMENTO', 'id', d.id, 'titulo', d.titulo) end
       from documentos d where d.id = a.documento_id),
    (select case when not pode(p_pessoa, a.condominio_id, 'pedidos.ver') then null
                 when pedido_visivel(p_pessoa, p) then jsonb_build_object('tipo', 'PEDIDO', 'id', p.id, 'protocolo', p.protocolo, 'titulo', p.assunto)
                 else jsonb_build_object('tipo', 'PEDIDO', 'id', p.id, 'protocolo', p.protocolo, 'privado', true) end
       from pedidos p where p.id = a.pedido_id),
    (select case when pode(p_pessoa, a.condominio_id, 'manutencao.ver')
                 then jsonb_build_object('tipo', 'MANUTENCAO', 'id', m.id, 'titulo', m.titulo) end
       from manutencoes m where m.id = a.manutencao_id))
$$;

create function anotacao_json(p_pessoa uuid, a anotacoes_memoria) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'aconteceuEm', to_char(a.aconteceu_em, 'YYYY-MM-DD'),
    'ligacao', ligacao_anotacao_json(p_pessoa, a),
    'autor', (select nome from pessoas where id = a.criado_por), 'criadoEm', a.criado_em,
    'corrigida', case when exists (select 1 from versoes_anotacao v where v.anotacao_id = a.id) then true end,
    'retiradaEm', a.retirada_em, 'motivoRetirada', a.motivo_retirada, 'versao', a.versao))
$$;

-- Os acontecimentos que a pessoa pode ver, de todas as áreas. "categoria" é o filtro da tela.
create function eventos_memoria(p_pessoa uuid) returns table (data date, momento timestamptz, categoria text, evento jsonb)
language plpgsql stable
set search_path = public
as $$
declare
  v_cond uuid := contexto_condominio();
  v_manut boolean := pode(p_pessoa, v_cond, 'manutencao.ver');
  v_restritos boolean := pode(p_pessoa, v_cond, 'documentos.restritos');
  v_comunicados boolean := pode(p_pessoa, v_cond, 'comunicados.ver');
begin
  return query
    select a.aconteceu_em, a.criado_em, 'ANOTADO'::text, jsonb_build_object('fonte', 'ANOTADO') || anotacao_json(p_pessoa, a)
      from anotacoes_memoria a where a.retirada_em is null;
  if v_manut then
    return query
      select coalesce(m.realizada_em, data_no_condominio(m.concluida_em)), m.concluida_em, 'MANUTENCAO'::text,
             jsonb_strip_nulls(jsonb_build_object('fonte', 'MANUTENCAO', 'id', m.id, 'titulo', 'Manutenção concluída: ' || m.titulo,
               'detalhe', coalesce((select x.nome from prestadores x where x.id = m.prestador_id), m.executor_texto, nome_do_vinculo(m.executor_vinculo)),
               'manutencaoId', m.id))
        from manutencoes m where m.estado = 'CONCLUIDA' and m.concluida_em is not null;
  end if;
  return query
    select v.vigente_desde, v.verificado_em, 'DOCUMENTOS'::text,
           jsonb_strip_nulls(jsonb_build_object('fonte', 'DOCUMENTO', 'id', v.id, 'documentoId', d.id,
             'titulo', case when v.numero = 1 then 'Documento guardado: ' || d.titulo else d.titulo || ', versão ' || v.numero end,
             'detalhe', coalesce(v.mudanca, case when v.aprovado_em is not null then 'Aprovado em ' || v.aprovado_em end)))
      from versoes_documento v join documentos d on d.id = v.documento_id
     where v.situacao = 'LIBERADO' and (not d.restrito or v_restritos);
  return query
    select x.vale_ate, x.vale_ate::timestamptz, 'DOCUMENTOS'::text,
           jsonb_build_object('fonte', 'PRONTUARIO', 'id', x.id, 'titulo', x.nome || ' venceu', 'detalhe', 'Do prontuário')
      from prontuario_lista() x where x.situacao = 'VENCEU';
  if v_comunicados then
    return query
      select data_no_condominio(c.publicado_em), c.publicado_em, 'COMUNICADOS'::text,
             jsonb_build_object('fonte', 'COMUNICADO', 'id', c.id, 'titulo', 'Assembleia: ' || c.titulo, 'detalhe', 'Comunicado publicado')
        from comunicados c where c.assunto = 'ASSEMBLEIA' and c.numero = 1 and c.publicado_em is not null;
  end if;
  return query
    select data_no_condominio(v.criado_em), v.criado_em, 'PESSOAS'::text,
           jsonb_build_object('fonte', 'PESSOA', 'id', v.id, 'titulo', p.nome || ' assume como síndico', 'detalhe', 'Entrada na Plataforma')
      from vinculos v join pessoas p on p.id = v.pessoa_id where v.condominio_id = v_cond and v.funcao = 'SINDICO'
    union all
    select data_no_condominio(v.revogado_em), v.revogado_em, 'PESSOAS'::text,
           jsonb_build_object('fonte', 'PESSOA', 'id', v.id, 'titulo', p.nome || ' deixa de ser síndico', 'detalhe', 'Acesso encerrado')
      from vinculos v join pessoas p on p.id = v.pessoa_id where v.condominio_id = v_cond and v.funcao = 'SINDICO' and v.revogado_em is not null;
end $$;

-- A linha do tempo, do mais novo ao mais antigo, aos poucos: cerca de 60 por vez, sem cortar um
-- dia no meio.
create function plataforma_linha_do_tempo(p_pessoa uuid, p_condominio uuid, p_filtro text, p_antes date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filtro text := coalesce(p_filtro, 'TUDO');
  v_corte date;
  v_eventos jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  if v_filtro not in ('TUDO', 'ANOTADO', 'MANUTENCAO', 'DOCUMENTOS', 'COMUNICADOS', 'PESSOAS') then
    perform recusar_campos('Filtro desconhecido', 'filtro');
  end if;
  with e as materialized (
         select * from eventos_memoria(p_pessoa) x
          where (v_filtro = 'TUDO' or x.categoria = v_filtro) and (p_antes is null or x.data < p_antes) and x.data is not null),
       corte as (select min(t.data) as data from (select data from e order by data desc limit 60) t)
  select (select jsonb_agg(e.evento || jsonb_build_object('data', to_char(e.data, 'YYYY-MM-DD'), 'categoria', e.categoria)
                           order by e.data desc, e.momento desc nulls last)
            from e, corte where e.data >= corte.data),
         case when exists (select 1 from e, corte where e.data < corte.data) then (select data from corte) end
    into v_eventos, v_corte;
  return jsonb_strip_nulls(jsonb_build_object(
    'eventos', coalesce(v_eventos, '[]'::jsonb),
    'maisAntigosAntes', to_char(v_corte, 'YYYY-MM-DD'),
    'podeAnotar', pode(p_pessoa, p_condominio, 'documentos.editar')));
end $$;

-- O que dá para ligar numa anotação: documentos, pedidos e manutenções que a pessoa vê.
create function plataforma_opcoes_memoria(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  return jsonb_build_object(
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'tipo', d.tipo, 'valeAte', to_char(d.vale_ate, 'YYYY-MM-DD'))
                       order by lower(d.titulo))
        from documentos d where d.arquivado_em is null and (not d.restrito or pode(p_pessoa, p_condominio, 'documentos.restritos'))), '[]'::jsonb),
    'pedidos', case when pode(p_pessoa, p_condominio, 'pedidos.ver') then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'protocolo', x.protocolo, 'titulo', x.assunto) order by x.criado_em desc)
        from (select * from pedidos p where pedido_visivel(p_pessoa, p) order by p.criado_em desc limit 80) x), '[]'::jsonb) else '[]'::jsonb end,
    'manutencoes', case when pode(p_pessoa, p_condominio, 'manutencao.ver') then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo) order by x.criado_em desc)
        from (select * from manutencoes order by criado_em desc limit 80) x), '[]'::jsonb) else '[]'::jsonb end);
end $$;

create function exigir_anotacao(p_id uuid) returns anotacoes_memoria
language plpgsql
set search_path = public
as $$
declare a anotacoes_memoria;
begin
  select * into a from anotacoes_memoria where id = p_id;
  if not found then raise exception 'Anotação não encontrada' using errcode = 'TC404'; end if;
  return a;
end $$;

create function plataforma_anotacao(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a anotacoes_memoria;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  a := exigir_anotacao(p_id);
  return jsonb_build_object(
    'anotacao', anotacao_json(p_pessoa, a),
    'versoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'numero', v.numero, 'tipo', v.tipo, 'titulo', v.titulo, 'texto', v.texto, 'aconteceuEm', to_char(v.aconteceu_em, 'YYYY-MM-DD'),
               'escritaEm', v.escrita_em, 'autor', (select nome from pessoas where id = v.escrita_por), 'substituidaEm', v.substituida_em))
             order by v.numero desc)
        from versoes_anotacao v where v.anotacao_id = a.id), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'documentos.editar') and a.retirada_em is null);
end $$;

-- Anotar ou corrigir. Corrigir guarda como estava.
create function plataforma_salvar_anotacao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_tipo text, p_titulo text,
                                           p_texto text, p_aconteceu_em date, p_documento uuid, p_pedido uuid, p_manutencao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
  a anotacoes_memoria;
  d documentos;
  p pedidos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  if p_tipo is null or p_tipo not in ('DECISAO', 'COMBINADO', 'OBRA', 'OCORRENCIA', 'OUTRO') then perform recusar_campos('Escolha o que é', 'tipo'); end if;
  if length(v_titulo) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if length(v_texto) not between 3 and 4000 then perform recusar_campos('Conte o que aconteceu (de 3 a 4.000 caracteres)', 'texto'); end if;
  if p_aconteceu_em is null or p_aconteceu_em < date '1950-01-01' or p_aconteceu_em > hoje_no_condominio() then
    perform recusar_campos('Data de quando aconteceu, até hoje', 'aconteceuEm');
  end if;
  if num_nonnulls(p_documento, p_pedido, p_manutencao) > 1 then perform recusar_campos('Ligue a uma coisa só', 'ligacao'); end if;
  if p_documento is not null then
    select * into d from documentos where id = p_documento;
    if not found or (d.restrito and not pode(p_pessoa, p_condominio, 'documentos.restritos')) then
      perform recusar_campos('Documento não encontrado', 'documentoId');
    end if;
  end if;
  if p_pedido is not null then
    select * into p from pedidos where id = p_pedido;
    if not found or not pode(p_pessoa, p_condominio, 'pedidos.ver') or not pedido_visivel(p_pessoa, p) then
      perform recusar_campos('Pedido não encontrado', 'pedidoId');
    end if;
  end if;
  if p_manutencao is not null and (not pode(p_pessoa, p_condominio, 'manutencao.ver')
                                   or not exists (select 1 from manutencoes where id = p_manutencao)) then
    perform recusar_campos('Manutenção não encontrada', 'manutencaoId');
  end if;

  if p_id is null then
    insert into anotacoes_memoria (condominio_id, tipo, titulo, texto, aconteceu_em, documento_id, pedido_id, manutencao_id, criado_por)
    values (p_condominio, p_tipo, v_titulo, v_texto, p_aconteceu_em, p_documento, p_pedido, p_manutencao, p_pessoa) returning * into a;
    perform registrar_historico('memoria.anotada', 'anotacoes_memoria', a.id::text,
      jsonb_build_object('tipo', p_tipo, 'titulo', v_titulo, 'aconteceuEm', p_aconteceu_em));
    return jsonb_build_object('id', a.id, 'versao', a.versao);
  end if;

  a := exigir_anotacao(p_id);
  if a.retirada_em is not null then perform recusar_motivo('A anotação já saiu da linha do tempo', 'ANOTACAO_RETIRADA'); end if;
  if (a.tipo, a.titulo, a.texto, a.aconteceu_em, a.documento_id, a.pedido_id, a.manutencao_id)
     is not distinct from (p_tipo, v_titulo, v_texto, p_aconteceu_em, p_documento, p_pedido, p_manutencao) then
    return jsonb_build_object('id', a.id, 'versao', a.versao);
  end if;
  update anotacoes_memoria set tipo = p_tipo, titulo = v_titulo, texto = v_texto, aconteceu_em = p_aconteceu_em,
                               documento_id = p_documento, pedido_id = p_pedido, manutencao_id = p_manutencao
   where id = a.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('anotacoes_memoria', a.id); end if;
  insert into versoes_anotacao (condominio_id, anotacao_id, numero, tipo, titulo, texto, aconteceu_em, documento_id, pedido_id, manutencao_id,
                                escrita_em, escrita_por)
  values (a.condominio_id, a.id, (select count(*) + 1 from versoes_anotacao where anotacao_id = a.id), a.tipo, a.titulo, a.texto, a.aconteceu_em,
          a.documento_id, a.pedido_id, a.manutencao_id,
          coalesce((select max(substituida_em) from versoes_anotacao where anotacao_id = a.id), a.criado_em),
          coalesce((select h.autor_id from historico h where h.entidade = 'anotacoes_memoria' and h.entidade_id = a.id::text
                     order by h.id desc limit 1), a.criado_por));
  perform registrar_historico('memoria.anotacao_corrigida', 'anotacoes_memoria', a.id::text,
    jsonb_build_object('tituloAntes', a.titulo, 'titulo', v_titulo));
  return jsonb_build_object('id', a.id, 'versao', v_versao);
end $$;

create function plataforma_retirar_anotacao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a anotacoes_memoria;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  a := exigir_anotacao(p_id);
  if a.retirada_em is not null then perform recusar_motivo('A anotação já saiu da linha do tempo', 'ANOTACAO_RETIRADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update anotacoes_memoria set retirada_em = app_now(), retirada_por = p_pessoa, motivo_retirada = v_motivo
   where id = a.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('anotacoes_memoria', a.id); end if;
  perform registrar_historico('memoria.anotacao_retirada', 'anotacoes_memoria', a.id::text, jsonb_build_object('titulo', a.titulo, 'motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Manual do prédio (MP-14).

create function secao_manual_json(m secoes_manual) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'titulo', m.titulo, 'resumo', m.resumo, 'texto', m.texto, 'ordem', m.ordem, 'noMural', m.no_mural,
    'escritaEm', m.escrita_em, 'autor', (select nome from pessoas where id = m.escrita_por),
    'versoes', (select count(*) from versoes_secao_manual v where v.secao_id = m.id),
    'retiradaEm', m.retirada_em, 'motivoRetirada', m.motivo_retirada, 'versao', m.versao))
$$;

create function plataforma_manual(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  return jsonb_build_object(
    'secoes', coalesce((select jsonb_agg(secao_manual_json(m) order by m.ordem, m.criado_em) from secoes_manual m where m.retirada_em is null), '[]'::jsonb),
    'muralLigado', (select mural_ligado from configuracao_condominio),
    'podeEditar', pode(p_pessoa, p_condominio, 'documentos.editar'));
end $$;

create function exigir_secao_manual(p_id uuid) returns secoes_manual
language plpgsql
set search_path = public
as $$
declare m secoes_manual;
begin
  select * into m from secoes_manual where id = p_id;
  if not found then raise exception 'Seção não encontrada' using errcode = 'TC404'; end if;
  return m;
end $$;

create function plataforma_secao_manual(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m secoes_manual;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.ver');
  m := exigir_secao_manual(p_id);
  return jsonb_build_object(
    'secao', secao_manual_json(m),
    'versoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', v.numero, 'titulo', v.titulo, 'resumo', v.resumo, 'texto', v.texto,
                         'escritaEm', v.escrita_em, 'autor', (select nome from pessoas where id = v.escrita_por), 'substituidaEm', v.substituida_em))
                       order by v.numero desc)
        from versoes_secao_manual v where v.secao_id = m.id), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'documentos.editar') and m.retirada_em is null);
end $$;

-- Escrever ou mudar uma seção. Mudar o texto guarda como estava; ligar ou desligar o mural não.
create function plataforma_salvar_secao_manual(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_resumo text, p_texto text, p_no_mural boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_resumo text := nullif(btrim(coalesce(p_resumo, '')), '');
  v_texto text := btrim(coalesce(p_texto, ''));
  m secoes_manual;
  v_versao integer;
  v_mudou_texto boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  if length(v_titulo) not between 3 and 80 then perform recusar_campos('Título de 3 a 80 caracteres', 'titulo'); end if;
  if length(v_resumo) not between 3 and 160 then perform recusar_campos('Resumo de 3 a 160 caracteres', 'resumo'); end if;
  if length(v_texto) not between 3 and 8000 then perform recusar_campos('Texto de 3 a 8.000 caracteres', 'texto'); end if;
  if exists (select 1 from secoes_manual where retirada_em is null and lower(btrim(titulo)) = lower(v_titulo) and id is distinct from p_id) then
    perform recusar_motivo('Já existe uma seção com este título', 'SECAO_REPETIDA');
  end if;

  if p_id is null then
    if (select count(*) from secoes_manual where retirada_em is null) >= 60 then
      perform recusar_motivo('O manual já tem 60 seções', 'LIMITE_SECOES');
    end if;
    insert into secoes_manual (condominio_id, titulo, resumo, texto, ordem, no_mural, escrita_por, criado_por)
    values (p_condominio, v_titulo, v_resumo, v_texto,
            least(coalesce((select max(ordem) from secoes_manual where retirada_em is null), 0) + 1, 200),
            coalesce(p_no_mural, false), p_pessoa, p_pessoa)
    returning * into m;
    perform registrar_historico('manual.secao_criada', 'secoes_manual', m.id::text, jsonb_build_object('titulo', v_titulo, 'noMural', m.no_mural));
    return jsonb_build_object('id', m.id, 'versao', m.versao);
  end if;

  m := exigir_secao_manual(p_id);
  if m.retirada_em is not null then perform recusar_motivo('A seção já saiu do manual', 'SECAO_RETIRADA'); end if;
  v_mudou_texto := (m.titulo, m.resumo, m.texto) is distinct from (v_titulo, v_resumo, v_texto);
  update secoes_manual set titulo = v_titulo, resumo = v_resumo, texto = v_texto, no_mural = coalesce(p_no_mural, m.no_mural),
                           escrita_em = case when v_mudou_texto then app_now() else m.escrita_em end,
                           escrita_por = case when v_mudou_texto then p_pessoa else m.escrita_por end
   where id = m.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('secoes_manual', m.id); end if;
  if v_mudou_texto then
    insert into versoes_secao_manual (condominio_id, secao_id, numero, titulo, resumo, texto, escrita_em, escrita_por)
    values (m.condominio_id, m.id, (select count(*) + 1 from versoes_secao_manual where secao_id = m.id), m.titulo, m.resumo, m.texto,
            m.escrita_em, m.escrita_por);
    perform registrar_historico('manual.secao_alterada', 'secoes_manual', m.id::text, jsonb_build_object('tituloAntes', m.titulo, 'titulo', v_titulo));
  end if;
  if coalesce(p_no_mural, m.no_mural) is distinct from m.no_mural then
    perform registrar_historico(case when p_no_mural then 'manual.secao_no_mural' else 'manual.secao_fora_do_mural' end,
      'secoes_manual', m.id::text, jsonb_build_object('titulo', v_titulo));
  end if;
  return jsonb_build_object('id', m.id, 'versao', v_versao);
end $$;

-- Nova ordem das seções: a lista inteira, na ordem que a tela mostra.
create function plataforma_ordem_manual(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  if p_ids is null or cardinality(p_ids) <> (select count(*) from secoes_manual where retirada_em is null)
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from secoes_manual m where m.id = x and m.retirada_em is null)) then
    perform recusar_campos('Mande todas as seções, cada uma uma vez', 'ids');
  end if;
  for i in 1 .. cardinality(p_ids) loop
    update secoes_manual set ordem = i where id = p_ids[i] and ordem <> i;
  end loop;
  perform registrar_historico('manual.ordem', 'secoes_manual', p_condominio::text, jsonb_build_object('secoes', cardinality(p_ids)));
  return jsonb_build_object('ok', true);
end $$;

create function plataforma_retirar_secao_manual(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m secoes_manual;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'documentos.editar');
  m := exigir_secao_manual(p_id);
  if m.retirada_em is not null then perform recusar_motivo('A seção já saiu do manual', 'SECAO_RETIRADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  update secoes_manual set retirada_em = app_now(), retirada_por = p_pessoa, motivo_retirada = v_motivo, no_mural = false
   where id = m.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('secoes_manual', m.id); end if;
  perform registrar_historico('manual.secao_retirada', 'secoes_manual', m.id::text, jsonb_build_object('titulo', m.titulo, 'motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- O mural online ganha a aba do manual: só as seções marcadas.
create or replace function publico_mural(p_codigo text) returns jsonb
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
    'manual', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'resumo', m.resumo, 'texto', m.texto,
                                                            'atualizadoEm', m.escrita_em)) order by m.ordem, m.criado_em)
        from secoes_manual m where m.retirada_em is null and m.no_mural), '[]'::jsonb),
    'atualizadoEm', (select max(publicado_em) from comunicados where estado = 'PUBLICADO' and no_mural and publico = 'TODOS'));
end $$;

-- ---------------------------------------------------------------------------------------
-- Dossiê de passagem de bastão (CT-02). Montado como o síndico vê; de morador, só a unidade.

create function montar_dossie(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'condominio', (select jsonb_build_object('nome', c.nome, 'cidade', c.cidade, 'uf', c.uf) from condominios c where c.id = contexto_condominio()),
    'geradoPor', (select nome from pessoas where id = p_pessoa),
    'pendencias', jsonb_build_object(
      'pedidosAbertos', (select count(*) from pedidos where estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')),
      'pedidos', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'protocolo', p.protocolo, 'assunto', case when p.privado then 'Pedido privado' else p.assunto end,
                 'unidade', rotulo_unidade(p.unidade_id), 'estado', p.estado, 'proximoRetorno', p.proximo_retorno,
                 'retornoVencido', case when p.proximo_retorno < app_now() then true end,
                 'responsavel', nome_do_vinculo(p.responsavel_id))) order by p.proximo_retorno nulls last, p.criado_em)
          from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')), '[]'::jsonb),
      'manutencoes', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'titulo', m.titulo, 'tipo', m.tipo, 'local', m.local, 'estado', m.estado, 'previsao', to_char(m.previsao, 'YYYY-MM-DD'),
                 'pendencia', m.pendencia_motivo, 'responsavel', nome_do_vinculo(m.responsavel_id))) order by m.criado_em)
          from manutencoes m where m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')), '[]'::jsonb),
      'prontuario', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('item', x.nome, 'situacao', x.situacao, 'valeAte', to_char(x.vale_ate, 'YYYY-MM-DD')))
                         order by array_position(array['VENCEU', 'VENCE', 'FALTA'], x.situacao), x.ordem)
          from prontuario_lista() x where x.situacao in ('VENCEU', 'VENCE', 'FALTA')), '[]'::jsonb)),
    'prestadores', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('prestador', x.nome, 'servico', x.servico, 'acordo', x.acordo,
                                                            'contratoAte', to_char(x.contrato_ate, 'YYYY-MM-DD'), 'contato', x.contato,
                                                            'telefone', x.telefone)) order by lower(x.nome))
        from prestadores x where x.arquivado_em is null), '[]'::jsonb),
    'documentos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'tipo', d.tipo, 'titulo', d.titulo, 'restrito', case when d.restrito then true end, 'valeAte', to_char(d.vale_ate, 'YYYY-MM-DD'),
               'emVigor', (select v.numero from versao_em_vigor(d.id) v where v.id is not null)))
             order by array_position(array['CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO'], d.tipo), lower(d.titulo))
        from documentos d where d.arquivado_em is null), '[]'::jsonb),
    'preventivas', coalesce((
      select jsonb_agg(jsonb_build_object('atividade', x.atividade, 'local', x.local, 'proxima', to_char(x.proxima_data, 'YYYY-MM-DD'),
                                          'intervalo', x.intervalo, 'unidadeTempo', x.unidade_tempo) order by x.proxima_data)
        from preventivas x where x.ativa), '[]'::jsonb),
    'anotacoes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'aconteceuEm', to_char(a.aconteceu_em, 'YYYY-MM-DD'))
                       order by a.aconteceu_em desc)
        from (select * from anotacoes_memoria where retirada_em is null order by aconteceu_em desc, criado_em desc limit 40) a), '[]'::jsonb),
    'agenda', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('titulo', c.titulo, 'tipo', c.tipo, 'data', to_char(c.data, 'YYYY-MM-DD'),
                                                            'hora', to_char(c.hora_inicio, 'HH24:MI'), 'local', c.local))
                       order by c.data, c.hora_inicio nulls first)
        from compromissos c where c.estado not in ('CANCELADO', 'REALIZADO')
                             and c.data between hoje_no_condominio() and hoje_no_condominio() + 60), '[]'::jsonb),
    'comunicados', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', c.titulo, 'assunto', c.assunto, 'publicadoEm', c.publicado_em) order by c.publicado_em desc)
        from (select * from comunicados where estado = 'PUBLICADO' order by publicado_em desc limit 10) c), '[]'::jsonb),
    'acesso', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'pessoa', p.nome, 'funcao', v.funcao, 'cargo', v.cargo, 'desde', v.criado_em,
               'permissoes', (select jsonb_agg(pe.nome order by pe.ordem) from vinculo_permissoes vp join permissoes pe on pe.codigo = vp.permissao
                               where vp.vinculo_id = v.id and vp.retirada_em is null)))
             order by array_position(array['SINDICO', 'AUTORIZADO'], v.funcao), lower(p.nome))
        from vinculos v join pessoas p on p.id = v.pessoa_id join funcoes f on f.codigo = v.funcao
       where v.condominio_id = contexto_condominio() and v.revogado_em is null and f.sistema = 'PLATAFORMA'), '[]'::jsonb),
    'manual', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('titulo', m.titulo, 'texto', m.texto, 'noMural', m.no_mural)) order by m.ordem)
        from secoes_manual m where m.retirada_em is null), '[]'::jsonb),
    'resumoProntuario', resumo_prontuario())
$$;

create function plataforma_gerar_dossie(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d dossies;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.dossie');
  if (select count(*) from dossies where gerado_em > app_now() - interval '1 day') >= 20 then
    perform recusar_motivo('Já foram gerados 20 dossiês hoje', 'LIMITE_DOSSIES');
  end if;
  insert into dossies (condominio_id, conteudo, gerado_por) values (p_condominio, montar_dossie(p_pessoa), p_pessoa) returning * into d;
  perform registrar_historico('memoria.dossie_gerado', 'dossies', d.id::text, '{}'::jsonb);
  return jsonb_build_object('id', d.id, 'geradoEm', d.gerado_em);
end $$;

create function plataforma_dossies(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.dossie');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'geradoEm', d.gerado_em, 'autor', (select nome from pessoas where id = d.gerado_por))
                     order by d.gerado_em desc)
      from (select * from dossies order by gerado_em desc limit 50) d), '[]'::jsonb);
end $$;

create function plataforma_dossie(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d dossies;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.dossie');
  select * into d from dossies where id = p_id;
  if not found then raise exception 'Dossiê não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico('memoria.dossie_aberto', 'dossies', d.id::text, '{}'::jsonb);
  return jsonb_build_object('id', d.id, 'geradoEm', d.gerado_em, 'autor', (select nome from pessoas where id = d.gerado_por), 'conteudo', d.conteudo);
end $$;

-- ---------------------------------------------------------------------------------------
-- Exportação (CT-04).

-- Os arquivos que vão nos pacotes, com o nome dentro do ZIP. Só os liberados e não tirados.
create function arquivos_para_exportar() returns table (bucket text, caminho text, nome text, tamanho bigint)
language sql stable
set search_path = public
as $$
  select 'pedidos', a.caminho, 'pedidos/' || p.protocolo || '/' || left(a.id::text, 8) || '-' || a.nome, a.tamanho::bigint
    from arquivos_pedido a join pedidos p on p.id = a.pedido_id where a.situacao = 'LIBERADO' and a.retirado_em is null
  union all
  select 'manutencoes', a.caminho,
         'manutencao/' || to_char(m.criado_em, 'YYYY-MM-DD') || ' ' || replace(m.titulo, '/', '-') || '/' || left(a.id::text, 8) || '-' || a.nome,
         a.tamanho::bigint
    from arquivos_manutencao a join manutencoes m on m.id = a.manutencao_id where a.situacao = 'LIBERADO' and a.retirado_em is null
  union all
  select 'manutencoes', a.caminho,
         'manutencao/' || to_char(m.criado_em, 'YYYY-MM-DD') || ' ' || replace(m.titulo, '/', '-') || '/prestador-' || left(a.id::text, 8) || '-' || a.nome,
         a.tamanho::bigint
    from arquivos_prestador a join manutencoes m on m.id = a.manutencao_id
   where a.situacao = 'LIBERADO' and a.retirado_em is null and a.registro_id is not null
  union all
  select 'comunicados', a.caminho,
         'comunicados/' || coalesce((select to_char(c.criado_em, 'YYYY-MM-DD') || ' ' || replace(c.titulo, '/', '-') from comunicados c
                                      where c.familia_id = a.familia_id order by c.numero limit 1), 'comunicado') || '/' || left(a.id::text, 8) || '-' || a.nome,
         a.tamanho::bigint
    from arquivos_comunicado a where a.situacao = 'LIBERADO' and a.retirado_em is null
  union all
  select 'documentos', v.caminho, 'documentos/' || replace(d.titulo, '/', '-') || '/v' || v.numero || '-' || v.nome, v.tamanho::bigint
    from versoes_documento v join documentos d on d.id = v.documento_id where v.situacao = 'LIBERADO'
$$;

create function exportacao_json(e exportacoes) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'situacao', case when e.situacao = 'PRONTA' and e.expira_em <= app_now() then 'VENCIDA' else e.situacao end,
    'pedidaEm', e.pedida_em, 'autor', (select nome from pessoas where id = e.pedida_por), 'prontaEm', e.pronta_em, 'expiraEm', e.expira_em,
    'erro', e.erro,
    'partes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', x.numero, 'tipo', x.tipo, 'situacao', x.situacao, 'tamanho', x.tamanho,
                                                            'arquivos', case when x.tipo = 'ARQUIVOS' then x.quantos end)) order by x.numero)
        from partes_exportacao x where x.exportacao_id = e.id), '[]'::jsonb)))
$$;

create function plataforma_exportacoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.exportar');
  v_motivo := case
    when exists (select 1 from exportacoes where situacao = 'MONTANDO') then 'MONTANDO'
    when exists (select 1 from exportacoes where situacao = 'PRONTA' and pedida_em > app_now() - interval '1 day') then 'UMA_POR_DIA' end;
  return jsonb_strip_nulls(jsonb_build_object(
    'exportacoes', coalesce((select jsonb_agg(exportacao_json(e) order by e.pedida_em desc)
                               from (select * from exportacoes order by pedida_em desc limit 20) e), '[]'::jsonb),
    'podePedir', v_motivo is null, 'motivo', v_motivo,
    'montando', exists (select 1 from exportacoes where situacao = 'MONTANDO')));
end $$;

-- Pedir a exportação: monta a lista de pacotes. Cada pacote de arquivos fica com até 45 MB.
create function plataforma_pedir_exportacao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e exportacoes;
  r record;
  v_lote jsonb := '[]'::jsonb;
  v_soma bigint := 0;
  v_numero integer := 1;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.exportar');
  perform 1 from condominios where id = p_condominio for update;
  if exists (select 1 from exportacoes where situacao = 'MONTANDO') then
    perform recusar_motivo('Já há uma exportação sendo montada', 'EXPORTACAO_MONTANDO');
  end if;
  if exists (select 1 from exportacoes where situacao = 'PRONTA' and pedida_em > app_now() - interval '1 day') then
    perform recusar_motivo('Só uma exportação por dia', 'EXPORTACAO_RECENTE');
  end if;
  insert into exportacoes (condominio_id, pedida_por) values (p_condominio, p_pessoa) returning * into e;
  v_id := gen_random_uuid();
  insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, caminho)
  values (v_id, p_condominio, e.id, 1, 'DADOS', p_condominio || '/' || e.id || '/' || v_id);
  for r in select * from arquivos_para_exportar() order by nome loop
    if jsonb_array_length(v_lote) > 0 and (v_soma + r.tamanho > 47185920 or jsonb_array_length(v_lote) >= 2000) then
      v_numero := v_numero + 1;
      v_id := gen_random_uuid();
      insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, arquivos, quantos, caminho)
      values (v_id, p_condominio, e.id, v_numero, 'ARQUIVOS', v_lote, jsonb_array_length(v_lote), p_condominio || '/' || e.id || '/' || v_id);
      v_lote := '[]'::jsonb;
      v_soma := 0;
    end if;
    v_lote := v_lote || jsonb_build_array(jsonb_build_object('b', r.bucket, 'c', r.caminho, 'n', r.nome));
    v_soma := v_soma + r.tamanho;
  end loop;
  if jsonb_array_length(v_lote) > 0 then
    v_numero := v_numero + 1;
    v_id := gen_random_uuid();
    insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, arquivos, quantos, caminho)
    values (v_id, p_condominio, e.id, v_numero, 'ARQUIVOS', v_lote, jsonb_array_length(v_lote), p_condominio || '/' || e.id || '/' || v_id);
  end if;
  perform registrar_historico('memoria.exportacao_pedida', 'exportacoes', e.id::text, jsonb_build_object('pacotes', v_numero));
  return jsonb_build_object('id', e.id, 'pacotes', v_numero);
end $$;

-- Baixar um pacote pronto: devolve o caminho para a API gerar o link curto. Fica no histórico.
create function plataforma_baixar_exportacao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_numero integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e exportacoes;
  x partes_exportacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'memoria.exportar');
  select * into e from exportacoes where id = p_id;
  if not found then raise exception 'Exportação não encontrada' using errcode = 'TC404'; end if;
  if e.situacao <> 'PRONTA' or e.expira_em <= app_now() then perform recusar_motivo('Esta exportação não está disponível', 'EXPORTACAO_INDISPONIVEL'); end if;
  select * into x from partes_exportacao where exportacao_id = e.id and numero = p_numero;
  if not found then raise exception 'Pacote não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico('memoria.exportacao_baixada', 'exportacoes', e.id::text, jsonb_build_object('pacote', p_numero));
  return jsonb_build_object('caminho', x.caminho, 'arquivo',
    'triade-' || to_char(e.pedida_em at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'YYYY-MM-DD')
    || case when x.tipo = 'DADOS' then '-dados' else '-arquivos-' || (x.numero - 1) end || '.zip');
end $$;

-- Exportação que não deu certo: avisa quem pediu.
create function falhar_exportacao(p_exportacao uuid, p_erro text) returns void
language plpgsql
set search_path = public
as $$
declare e exportacoes;
begin
  select * into e from exportacoes where id = p_exportacao for update;
  if e.situacao <> 'MONTANDO' then return; end if;
  update partes_exportacao set situacao = 'FALHOU' where exportacao_id = e.id and situacao in ('ESPERA', 'MONTANDO');
  update exportacoes set situacao = 'FALHOU', erro = left(coalesce(p_erro, 'Falha ao montar'), 300) where id = e.id;
  insert into avisos_memoria (condominio_id, pessoa_id, tipo, exportacao_id) values (e.condominio_id, e.pedida_por, 'EXPORTACAO_FALHOU', e.id)
  on conflict do nothing;
  perform registrar_historico('memoria.exportacao_falhou', 'exportacoes', e.id::text, jsonb_build_object('erro', left(coalesce(p_erro, 'Falha'), 300)));
end $$;

-- A api-plataforma pega o próximo pacote para montar (o que travou há mais de 10 minutos volta).
create function exportacao_pegar_parte() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  x partes_exportacao;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    for x in select * from partes_exportacao
              where situacao = 'ESPERA' or (situacao = 'MONTANDO' and iniciada_em < app_now() - interval '10 minutes')
              order by numero for update skip locked loop
      if x.tentativas >= 3 then
        perform falhar_exportacao(x.exportacao_id, 'O pacote ' || x.numero || ' não pôde ser montado');
        continue;
      end if;
      update partes_exportacao set situacao = 'MONTANDO', tentativas = tentativas + 1, iniciada_em = app_now() where id = x.id;
      perform entrar_como_sistema(null);
      perform set_config('app.verificador', '', true);
      return jsonb_build_object('condominio', x.condominio_id, 'exportacao', x.exportacao_id, 'parte', x.id, 'numero', x.numero,
                                'tipo', x.tipo, 'caminho', x.caminho, 'arquivos', x.arquivos);
    end loop;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return null;
end $$;

-- Os dados do condomínio, tabela por tabela, para o pacote dos dados. Fica de fora o que é só da
-- TRÍADE (ficha do cliente, notas internas, vínculos do Console e histórico interno), os códigos
-- embaralhados e as contagens e avisos de tela.
create function exportacao_dados(p_condominio uuid, p_parte uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x partes_exportacao;
  r record;
  v_tabelas jsonb := '{}'::jsonb;
  v_linhas jsonb;
  v_fora text[];
  v_onde text;
begin
  perform entrar_como_sistema(p_condominio);
  select * into x from partes_exportacao where id = p_parte;
  if not found or x.tipo <> 'DADOS' or x.situacao <> 'MONTANDO' then raise exception 'Pacote não encontrado' using errcode = 'TC404'; end if;
  for r in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
              and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'condominio_id' and not a.attisdropped)
              and c.relname not in ('clientes', 'notas_internas', 'codigos_sem_conta', 'links_publicos', 'sessoes_condominio',
                                    'etiqueta_aberturas', 'mural_aberturas', 'exportacoes', 'partes_exportacao',
                                    'avisos', 'avisos_documento', 'avisos_email', 'avisos_manutencao', 'avisos_pedido_documento',
                                    'avisos_prestador', 'avisos_memoria')
            order by c.relname loop
    select coalesce(array_agg(a.attname::text), '{}') into v_fora from pg_attribute a
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped and a.atttypid = 'bytea'::regtype;
    v_onde := case r.relname
      when 'historico' then 'where not x.interno'
      when 'vinculos' then 'where x.condominio_id = contexto_condominio() and exists (select 1 from funcoes f where f.codigo = x.funcao and f.sistema = ''PLATAFORMA'')'
      else '' end;
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - %L::text[]), ''[]''::jsonb) from %I x %s', v_fora, r.relname, v_onde) into v_linhas;
    v_tabelas := v_tabelas || jsonb_build_object(r.relname, v_linhas);
  end loop;
  v_tabelas := v_tabelas || jsonb_build_object('pessoas', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome)
      from pessoas p where exists (select 1 from vinculos v join funcoes f on f.codigo = v.funcao
                                    where v.pessoa_id = p.id and v.condominio_id = p_condominio and f.sistema = 'PLATAFORMA')), '[]'::jsonb));
  return jsonb_build_object(
    'condominio', (select jsonb_build_object('id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'endereco', c.endereco,
                                             'numeroWhatsapp', c.numero_whatsapp, 'cenario', c.cenario)
                     from condominios c where c.id = p_condominio),
    'geradoEm', app_now(),
    'tabelas', v_tabelas);
end $$;

-- O pacote ficou pronto (com o tamanho) ou deu erro. Erro tenta de novo até 3 vezes. Com todos
-- prontos, a exportação vale 7 dias e quem pediu é avisado no sino.
create function exportacao_parte_pronta(p_condominio uuid, p_parte uuid, p_tamanho bigint, p_erro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x partes_exportacao;
  e exportacoes;
begin
  perform entrar_como_sistema(p_condominio);
  select * into x from partes_exportacao where id = p_parte for update;
  if not found or x.situacao <> 'MONTANDO' then return jsonb_build_object('ok', false); end if;
  if p_erro is not null or p_tamanho is null or p_tamanho < 1 then
    if x.tentativas >= 3 then
      perform falhar_exportacao(x.exportacao_id, 'O pacote ' || x.numero || ' não pôde ser montado: ' || coalesce(p_erro, 'sem tamanho'));
    else
      update partes_exportacao set situacao = 'ESPERA', iniciada_em = null where id = x.id;
    end if;
    perform entrar_como_sistema(null);
    return jsonb_build_object('ok', false);
  end if;
  update partes_exportacao set situacao = 'PRONTA', tamanho = p_tamanho, pronta_em = app_now() where id = x.id;
  select * into e from exportacoes where id = x.exportacao_id for update;
  if e.situacao = 'MONTANDO' and not exists (select 1 from partes_exportacao where exportacao_id = e.id and situacao <> 'PRONTA') then
    update exportacoes set situacao = 'PRONTA', pronta_em = app_now(), expira_em = app_now() + interval '7 days' where id = e.id;
    insert into avisos_memoria (condominio_id, pessoa_id, tipo, exportacao_id) values (e.condominio_id, e.pedida_por, 'EXPORTACAO_PRONTA', e.id)
    on conflict do nothing;
    perform registrar_historico('memoria.exportacao_pronta', 'exportacoes', e.id::text,
      jsonb_build_object('pacotes', (select count(*) from partes_exportacao where exportacao_id = e.id),
                         'tamanho', (select sum(tamanho) from partes_exportacao where exportacao_id = e.id)));
  end if;
  perform entrar_como_sistema(null);
  return jsonb_build_object('ok', true);
end $$;

-- A cada minuto, se houver pacote esperando, o banco chama a api-plataforma pelo pg_net (mesmo
-- endereço e segredo da fila de e-mails, no Vault). Sem eles, a exportação é montada quando a
-- tela de exportação é aberta.
create function chamar_exportacao() returns boolean
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
    if exists (select 1 from partes_exportacao where situacao = 'ESPERA'
                                                or (situacao = 'MONTANDO' and iniciada_em < app_now() - interval '10 minutes')) then
      v_tem := true;
      exit;
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  if not v_tem then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using rtrim(v_url, '/') || '/v1/interno/exportacao', '{}'::jsonb,
          jsonb_build_object('content-type', 'application/json', 'x-repasse-segredo', v_segredo);
  return true;
end $$;

-- ---------------------------------------------------------------------------------------
-- Início e sino: o prontuário e a exportação.

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
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_email a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_prestador a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_memoria a where a.pessoa_id = p_pessoa and a.visto_em is null)))
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_prestador where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_memoria where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer; v_r integer; v_x integer;
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
  return v_n + v_m + v_d + v_e + v_p + v_r + v_x;
end $$;

-- ---------------------------------------------------------------------------------------
-- Console: a TRÍADE vê as exportações na ficha do cliente.

create or replace function console_ficha(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  select jsonb_build_object(
    'condominio', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'endereco', c.endereco,
      'numeroWhatsapp', c.numero_whatsapp, 'contatos', c.contatos, 'cenario', c.cenario,
      'versao', c.versao, 'criadoEm', c.criado_em),
    'cliente', jsonb_build_object('estagio', cl.estado, 'referenciaContrato', cl.referencia_contrato, 'versao', cl.versao),
    'sindicos', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'desde', v.criado_em) order by v.criado_em)
        from vinculos v join pessoas p on p.id = v.pessoa_id
       where v.condominio_id = c.id and v.funcao = 'SINDICO' and v.revogado_em is null), '[]'::jsonb),
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'funcao', v.funcao,
                                          'desde', v.criado_em, 'versao', v.versao) order by p.nome, v.funcao)
        from vinculos v join pessoas p on p.id = v.pessoa_id join funcoes f on f.codigo = v.funcao
       where v.condominio_id = c.id and f.sistema = 'CONSOLE' and v.revogado_em is null), '[]'::jsonb),
    'situacoes', to_jsonb(situacoes_cliente(c.id)),
    'exportacoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', e.id, 'situacao', e.situacao, 'pedidaEm', e.pedida_em,
                                                            'autor', (select nome from pessoas where id = e.pedida_por), 'prontaEm', e.pronta_em))
                       order by e.pedida_em desc)
        from (select * from exportacoes x where x.condominio_id = c.id order by x.pedida_em desc limit 5) e), '[]'::jsonb),
    'permissoes', coalesce((
      select jsonb_agg(distinct fa.acao order by fa.acao)
        from vinculos v join funcao_acoes fa on fa.funcao = v.funcao
       where v.pessoa_id = p_pessoa and v.condominio_id = c.id and v.revogado_em is null
         and v.funcao = any (contexto_equipe_funcoes())), '[]'::jsonb))
    into v
    from condominios c join clientes cl on cl.condominio_id = c.id
   where c.id = p_condominio;
  return v;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('montar-exportacoes', '* * * * *', 'select public.chamar_exportacao()');
exception when others then
  raise notice 'pg_cron indisponível: agende chamar_exportacao() de outro jeito (%).', sqlerrm;
end $$;

call fechar_acesso();

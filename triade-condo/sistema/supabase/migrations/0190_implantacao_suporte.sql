-- 0190 · Implantação e suporte (peça R4; PI-04, PI-05, CT-01, PI-09, PI-11, PI-17, PI-20 e
-- SH-01). Telas e decisões aprovadas pela Carolina em 18/10/2026
-- (docs/telas/implantacao-suporte.html).
--
-- Regras desta parte:
-- 1. Roteiro de implantação com versão (PI-04): 8 etapas, cada uma com responsável e substituto
--    da equipe atribuída ao cliente e situação (preparada, pendente, realizada ou não se aplica
--    com motivo). Só fica realizada com o que foi feito escrito. Mudar o roteiro cria versão
--    nova; a implantação em andamento segue a dela. A apresentação (etapa 5) registra se foi
--    presencial ou por vídeo (SH-01).
-- 2. Pendências (PI-05): etapa, quem precisa agir (equipe ou cliente), responsável da equipe e
--    próximo retorno. As vencidas aparecem em Implantações.
-- 3. Entrega (PI-04): só com as etapas 1 a 7 realizadas ou não aplicáveis (a 7, pedido de
--    teste, sempre realizada) e um pedido registrado e encerrado pelo síndico. Passa o cliente
--    a ativo, avisa o síndico no sino e não volta atrás. Nada interno vai ao cliente.
-- 4. Troca de síndico (CT-01): só administração e implantação; registra quem pediu, por qual
--    canal e o que foi conferido. O novo síndico entra com conta própria; o vínculo do anterior
--    acaba na hora (a sessão dele para de valer no condomínio) e a autoria antiga fica.
-- 5. Suporte de acesso (PI-09): pedido, verificação (vínculo ativo, dados confirmados e canal
--    já conhecido) e só então o link de senha nova para o e-mail já cadastrado. A equipe nunca
--    vê nem escolhe senha. Tirar o autenticador perdido e decidir caso duvidoso é da
--    administração.
-- 6. Acesso excepcional (PI-11): pedido com motivo, áreas e prazo (até 72 horas), só para
--    cliente atribuído; o síndico aprova ou recusa e pode encerrar antes. Enquanto vale, a
--    pessoa da TRÍADE só lê as áreas aprovadas, e cada abertura fica no histórico.
-- 7. Chamados (PI-17, PI-20): quem tem conta na Plataforma abre chamado de suporte técnico com
--    imagens (regras das fotos dos pedidos, bucket "suporte"). O síndico vê os do condomínio;
--    a pessoa autorizada, os seus. A equipe atribuída responde, com nota interna que o cliente
--    nunca vê. Resolvido volta a abrir se o cliente responder em até 7 dias.

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'suporte.chamados'),
  ('SINDICO', 'acesso_excepcional.aprovar'),
  ('AUTORIZADO', 'suporte.chamados'),
  ('ADMINISTRACAO', 'console.implantacao.ver'),
  ('ADMINISTRACAO', 'console.implantacao.editar'),
  ('ADMINISTRACAO', 'console.troca.fazer'),
  ('ADMINISTRACAO', 'console.suporte.acesso'),
  ('ADMINISTRACAO', 'console.casos_duvidosos'),
  ('ADMINISTRACAO', 'console.chamados.ver'),
  ('ADMINISTRACAO', 'console.chamados.responder'),
  ('ADMINISTRACAO', 'console.acesso_excepcional.pedir'),
  ('IMPLANTACAO', 'console.implantacao.ver'),
  ('IMPLANTACAO', 'console.implantacao.editar'),
  ('IMPLANTACAO', 'console.troca.fazer'),
  ('IMPLANTACAO', 'console.chamados.ver'),
  ('IMPLANTACAO', 'console.chamados.responder'),
  ('SUPORTE', 'console.implantacao.ver'),
  ('SUPORTE', 'console.suporte.acesso'),
  ('SUPORTE', 'console.chamados.ver'),
  ('SUPORTE', 'console.chamados.responder'),
  ('SUPORTE', 'console.acesso_excepcional.pedir');

-- ---------------------------------------------------------------------------------------
-- Roteiro de implantação (PI-04): global e com versão.

create table roteiros_implantacao (
  numero     smallint primary key check (numero between 1 and 999),
  etapas     jsonb not null check (jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) between 3 and 20),
  criado_em  timestamptz not null default app_now()
);
call proteger_tabela_global('roteiros_implantacao', 'O roteiro de implantação é o mesmo para todos os clientes, com versão');
create trigger roteiros_implantacao_sem_mudanca before update or delete on roteiros_implantacao for each row execute function somente_insercao();
insert into roteiros_implantacao (numero, etapas) values (1, '[
  {"numero": 1, "chave": "FICHA", "titulo": "Ficha do condomínio", "descricao": "Nome, endereço, contatos, cenário e contrato."},
  {"numero": 2, "chave": "ORGANIZACAO", "titulo": "Como o condomínio já se organiza", "descricao": "Atas, regras, contratos e quem responde hoje. A configuração parte disso."},
  {"numero": 3, "chave": "DOCUMENTOS", "titulo": "Documentos", "descricao": "Convenção, regimento, atas, laudos e contratos guardados em Documentos."},
  {"numero": 4, "chave": "CONFIGURACAO", "titulo": "Configuração", "descricao": "Horários, categorias, prazos, quem atende e o número do condomínio."},
  {"numero": 5, "chave": "APRESENTACAO", "titulo": "Apresentação ao síndico e ao conselho", "descricao": "Presencial em Brasília ou por vídeo."},
  {"numero": 6, "chave": "MORADORES", "titulo": "Moradores", "descricao": "Unidades e contatos importados e conferidos."},
  {"numero": 7, "chave": "PEDIDO_TESTE", "titulo": "Pedido de teste com o síndico", "descricao": "O síndico registra, responde e conclui um pedido sozinho."},
  {"numero": 8, "chave": "ENTREGA", "titulo": "Entrega", "descricao": "Ato explícito: o cliente passa a ativo."}
]'::jsonb);

create table implantacoes (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null unique references condominios (id) on delete restrict,
  roteiro_versao   smallint not null references roteiros_implantacao (numero),
  criado_em        timestamptz not null default app_now(),
  entregue_em      timestamptz,
  entregue_por     uuid references pessoas (id),
  recado           text check (length(btrim(recado)) between 3 and 1000),
  versao           integer not null default 1,
  unique (id, condominio_id),
  check ((entregue_em is null) = (entregue_por is null))
);
call proteger_tabela_interna('implantacoes', 'Implantação do cliente: roteiro e entrega; o cliente não vê (PI-04, PI-06)');
create trigger implantacoes_sem_exclusao before delete on implantacoes for each row execute function somente_insercao();

create table etapas_implantacao (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  implantacao_id   uuid not null,
  numero           smallint not null check (numero between 1 and 20),
  chave            text not null check (chave ~ '^[A-Z][A-Z_]{1,39}$'),
  titulo           text not null,
  situacao         text not null default 'PREPARADA' check (situacao in ('PREPARADA', 'PENDENTE', 'REALIZADA', 'NAO_SE_APLICA')),
  responsavel_id   uuid references pessoas (id),
  substituto_id    uuid references pessoas (id),
  feito            text check (length(btrim(feito)) between 3 and 2000),
  motivo           text check (length(btrim(motivo)) between 3 and 500),
  modalidade       text check (modalidade in ('PRESENCIAL', 'VIDEO')),
  quando           date,
  realizada_em     timestamptz,
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  unique (implantacao_id, numero),
  foreign key (implantacao_id, condominio_id) references implantacoes (id, condominio_id),
  check (situacao <> 'REALIZADA' or (feito is not null and realizada_em is not null)),
  check (situacao <> 'NAO_SE_APLICA' or motivo is not null),
  check (responsavel_id is null or substituto_id is null or responsavel_id <> substituto_id)
);
call proteger_tabela_interna('etapas_implantacao', 'Etapas do roteiro de implantação; o cliente não vê (PI-04)');
create trigger etapas_implantacao_sem_exclusao before delete on etapas_implantacao for each row execute function somente_insercao();

create table pendencias_implantacao (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  implantacao_id   uuid not null,
  etapa            smallint check (etapa between 1 and 20),
  texto            text not null check (length(btrim(texto)) between 3 and 300),
  com_quem         text not null check (com_quem in ('EQUIPE', 'CLIENTE')),
  responsavel_id   uuid not null references pessoas (id),
  proximo_retorno  date not null check (proximo_retorno between date '2020-01-01' and date '2100-12-31'),
  resolvida_em     timestamptz,
  resolucao        text check (length(btrim(resolucao)) between 2 and 300),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (implantacao_id, condominio_id) references implantacoes (id, condominio_id),
  check ((resolvida_em is null) = (resolucao is null))
);
call proteger_tabela_interna('pendencias_implantacao', 'Pendências de implantação; o cliente não vê (PI-05)');
create trigger pendencias_implantacao_sem_exclusao before delete on pendencias_implantacao for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Troca de síndico (CT-01): o registro do que foi conferido.

create table trocas_sindico (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  anterior_vinculo   uuid not null,
  novo_vinculo       uuid not null,
  pedido_por         text not null check (length(btrim(pedido_por)) between 2 and 120),
  canal              text not null check (canal in ('WHATSAPP', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'OUTRO')),
  conferido          text[] not null check (cardinality(conferido) between 1 and 6),
  feita_em           timestamptz not null default app_now(),
  feita_por          uuid not null references pessoas (id),
  foreign key (anterior_vinculo, condominio_id) references vinculos (id, condominio_id),
  foreign key (novo_vinculo, condominio_id) references vinculos (id, condominio_id)
);
call proteger_tabela_interna('trocas_sindico', 'Troca de síndico com o que foi conferido (CT-01)');
create trigger trocas_sindico_sem_mudanca before update or delete on trocas_sindico for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Suporte de acesso (PI-09).

create table pedidos_suporte_acesso (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  pessoa_id        uuid not null references pessoas (id),
  tipo             text not null check (tipo in ('SENHA', 'AUTENTICADOR', 'EMAIL_NAO_CHEGA', 'OUTRO')),
  canal            text not null check (canal in ('WHATSAPP', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'OUTRO')),
  descricao        text check (length(btrim(descricao)) between 3 and 1000),
  dados_conferidos boolean not null default false,
  canal_conhecido  boolean not null default false,
  situacao         text not null default 'ABERTO' check (situacao in ('ABERTO', 'DUVIDOSO', 'ENVIADO', 'AUTENTICADOR_TIRADO', 'RECUSADO')),
  motivo           text check (length(btrim(motivo)) between 3 and 500),
  atendido_por     uuid not null references pessoas (id),
  decidido_em      timestamptz,
  decidido_por     uuid references pessoas (id),
  criado_em        timestamptz not null default app_now(),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  check (situacao not in ('DUVIDOSO', 'RECUSADO') or motivo is not null),
  check ((situacao in ('ABERTO', 'DUVIDOSO')) = (decidido_em is null)),
  check ((decidido_em is null) = (decidido_por is null))
);
call proteger_tabela_interna('pedidos_suporte_acesso', 'Pedidos de suporte de acesso e a verificação (PI-09)');
create trigger pedidos_suporte_acesso_sem_exclusao before delete on pedidos_suporte_acesso for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Acesso excepcional (PI-11). A pessoa da TRÍADE precisa enxergar o próprio pedido antes de
-- entrar no condomínio (é o que pode() confere), por isso a regra de leitura é própria.

create table acessos_excepcionais (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  pedido_por       uuid not null references pessoas (id),
  motivo           text not null check (length(btrim(motivo)) between 10 and 1000),
  areas            text[] not null check (cardinality(areas) between 1 and 4
                                          and areas <@ array['PEDIDOS', 'MORADORES', 'COMUNICADOS', 'MANUTENCAO']),
  horas            smallint not null check (horas between 1 and 72),
  chamado_id       uuid,
  situacao         text not null default 'PEDIDO' check (situacao in ('PEDIDO', 'APROVADO', 'RECUSADO', 'ENCERRADO')),
  decidido_em      timestamptz,
  decidido_por     uuid references pessoas (id),
  motivo_recusa    text check (length(btrim(motivo_recusa)) between 3 and 500),
  valido_ate       timestamptz,
  encerrado_em     timestamptz,
  encerrado_por    uuid references pessoas (id),
  criado_em        timestamptz not null default app_now(),
  unique (id, condominio_id),
  check ((situacao = 'PEDIDO') = (decidido_em is null)),
  check ((decidido_em is null) = (decidido_por is null)),
  check ((situacao = 'RECUSADO') = (motivo_recusa is not null)),
  check ((situacao in ('APROVADO', 'ENCERRADO')) = (valido_ate is not null)),
  check ((situacao = 'ENCERRADO') = (encerrado_em is not null and encerrado_por is not null))
);
alter table acessos_excepcionais enable row level security;
alter table acessos_excepcionais force row level security;
create policy acesso_excepcional_visivel on acessos_excepcionais
  using (condominio_id = contexto_condominio() or pedido_por = contexto_pessoa())
  with check (condominio_id = contexto_condominio());
insert into tabelas_sem_condominio (tabela, motivo) values
  ('acessos_excepcionais', 'Acesso excepcional da TRÍADE; aparece no condomínio do contexto e para quem pediu (pode() confere antes do contexto)');
create trigger acessos_excepcionais_sem_exclusao before delete on acessos_excepcionais for each row execute function somente_insercao();

-- As ações de leitura que cada área libera.
create function acoes_area_excepcional(p_area text) returns text[]
language sql immutable
set search_path = public
as $$
  select case p_area
    when 'PEDIDOS' then array['pedidos.ver']
    when 'MORADORES' then array['moradores.ver']
    when 'COMUNICADOS' then array['comunicados.ver', 'documentos.ver']
    when 'MANUTENCAO' then array['manutencao.ver']
    else '{}'::text[] end
$$;

-- pode() ganha o acesso excepcional aprovado e dentro do prazo, só de leitura.
create or replace function pode(p_pessoa uuid, p_condominio uuid, p_acao text) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from vinculos v
      join funcao_acoes fa on fa.funcao = v.funcao
      join funcoes f on f.codigo = v.funcao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio
       and v.revogado_em is null and fa.acao = p_acao
       and (f.sistema = 'PLATAFORMA'
            or (p_pessoa = contexto_pessoa() and v.funcao = any (contexto_equipe_funcoes()))))
  or exists (
    select 1 from vinculos v
      join vinculo_permissoes vp on vp.vinculo_id = v.id and vp.retirada_em is null
      join permissao_acoes pa on pa.permissao = vp.permissao
     where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio
       and v.revogado_em is null and v.funcao = 'AUTORIZADO' and pa.acao = p_acao)
  or (p_acao in ('pedidos.ver', 'moradores.ver', 'comunicados.ver', 'documentos.ver', 'manutencao.ver')
      and p_pessoa = contexto_pessoa() and contexto_equipe()
      and exists (
        select 1 from acessos_excepcionais a
         where a.pedido_por = p_pessoa and a.condominio_id = p_condominio and a.situacao = 'APROVADO'
           and a.valido_ate > app_now()
           and exists (select 1 from unnest(a.areas) x where p_acao = any (acoes_area_excepcional(x)))))
$$;

-- ---------------------------------------------------------------------------------------
-- Chamados de suporte técnico (PI-17, PI-20).

create table chamados (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  numero           integer not null check (numero > 0),
  aberto_por       uuid not null references pessoas (id),
  tipo             text not null check (tipo in ('DUVIDA', 'PROBLEMA', 'SUGESTAO')),
  area             text not null check (area in ('INICIO', 'PEDIDOS', 'AGENDA', 'MANUTENCAO', 'COMUNICADOS', 'MEMORIA', 'MORADORES',
                                                 'CONFIGURACOES', 'PESSOAS', 'ACESSO', 'OUTRO')),
  titulo           text not null check (length(btrim(titulo)) between 3 and 120),
  situacao         text not null default 'NOVO' check (situacao in ('NOVO', 'ANDAMENTO', 'ESPERANDO_CLIENTE', 'RESOLVIDO')),
  responsavel_id   uuid references pessoas (id),
  resolvido_em     timestamptz,
  criado_em        timestamptz not null default app_now(),
  atualizado_em    timestamptz not null default app_now(),
  versao           integer not null default 1,
  unique (id, condominio_id),
  unique (condominio_id, numero),
  check ((situacao = 'RESOLVIDO') = (resolvido_em is not null))
);
create index chamados_situacao on chamados (condominio_id, situacao, atualizado_em desc);
call proteger_tabela_condominio('chamados');
create trigger chamados_sem_exclusao before delete on chamados for each row execute function somente_insercao();

create table mensagens_chamado (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  chamado_id       uuid not null,
  autor_id         uuid not null references pessoas (id),
  lado             text not null check (lado in ('CLIENTE', 'TRIADE')),
  interna          boolean not null default false,
  texto            text not null check (length(btrim(texto)) between 2 and 4000),
  criado_em        timestamptz not null default app_now(),
  foreign key (chamado_id, condominio_id) references chamados (id, condominio_id),
  check (not interna or lado = 'TRIADE')
);
create index mensagens_chamado_c on mensagens_chamado (chamado_id, criado_em);
call proteger_tabela_condominio('mensagens_chamado');
create trigger mensagens_chamado_sem_mudanca before update or delete on mensagens_chamado for each row execute function somente_insercao();

-- Imagens do chamado (regras de 0100), no bucket "suporte".
create table arquivos_chamado (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  chamado_id        uuid not null,
  nome              text not null check (length(btrim(nome)) between 1 and 200),
  tipo              text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_declarado integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null unique,
  situacao          text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa     text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em        timestamptz not null default app_now(),
  enviado_por       uuid not null references pessoas (id),
  verificado_em     timestamptz,
  foreign key (chamado_id, condominio_id) references chamados (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null))
);
create index arquivos_chamado_c on arquivos_chamado (chamado_id, enviado_em);
call proteger_tabela_condominio('arquivos_chamado');
create trigger arquivos_chamado_sem_exclusao before delete on arquivos_chamado for each row execute function somente_insercao();

create function arquivos_chamado_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.chamado_id, new.nome, new.tipo, new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.chamado_id, old.nome, old.tipo, old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'A imagem não muda depois de enviada' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' then raise exception 'A imagem já foi verificada' using errcode = 'TC422'; end if;
  return new;
end $$;
create trigger arquivos_chamado_regras before update on arquivos_chamado for each row execute function arquivos_chamado_regras();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('suporte', 'suporte', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Avisos no sino da Plataforma: entrega, resposta de chamado e pedido de acesso excepcional.

create table avisos_triade (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  pessoa_id      uuid not null references pessoas (id),
  tipo           text not null check (tipo in ('ENTREGA', 'CHAMADO_RESPOSTA', 'ACESSO_PEDIDO')),
  chamado_id     uuid,
  acesso_id      uuid,
  texto          text check (length(btrim(texto)) between 1 and 1000),
  criado_em      timestamptz not null default app_now(),
  visto_em       timestamptz,
  foreign key (chamado_id, condominio_id) references chamados (id, condominio_id),
  foreign key (acesso_id, condominio_id) references acessos_excepcionais (id, condominio_id),
  check ((tipo = 'CHAMADO_RESPOSTA') = (chamado_id is not null)),
  check ((tipo = 'ACESSO_PEDIDO') = (acesso_id is not null))
);
create index avisos_triade_pessoa on avisos_triade (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_triade');
create trigger avisos_triade_sem_exclusao before delete on avisos_triade for each row execute function somente_insercao();
create function avisos_triade_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.tipo, new.chamado_id, new.acesso_id, new.texto, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.tipo, old.chamado_id, old.acesso_id, old.texto, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_triade_regras before update on avisos_triade for each row execute function avisos_triade_regras();

insert into configuracoes (chave, valor, descricao) values
  ('limite_chamado_max', '20', 'Chamados abertos pela mesma pessoa dentro da janela'),
  ('limite_chamado_janela_minutos', '1440', 'Janela dos chamados');

-- ---------------------------------------------------------------------------------------
-- Ajudas.

-- Pessoa da equipe atribuída ao cliente do contexto (responsável, substituto, chamado).
create function eh_equipe_do_cliente(p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from vinculos v join funcoes f on f.codigo = v.funcao
                  where v.pessoa_id = p_pessoa and v.condominio_id = contexto_condominio()
                    and v.revogado_em is null and f.sistema = 'CONSOLE')
$$;

create function equipe_do_cliente() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('pessoaId', x.id, 'nome', x.nome, 'funcoes', to_jsonb(x.funcoes)) order by x.nome), '[]'::jsonb)
    from (select p.id, p.nome, array_agg(distinct v.funcao order by v.funcao) as funcoes
            from vinculos v join funcoes f on f.codigo = v.funcao join pessoas p on p.id = v.pessoa_id
           where v.condominio_id = contexto_condominio() and v.revogado_em is null and f.sistema = 'CONSOLE'
           group by p.id, p.nome) x
$$;

create function nome_pessoa(p_id uuid) returns text
language sql stable
set search_path = public
as $$ select nome from pessoas where id = p_id $$;

-- Síndicos ativos do condomínio do contexto (quem recebe os avisos da TRÍADE).
create function sindicos_ativos() returns setof uuid
language sql stable
set search_path = public
as $$
  select distinct pessoa_id from vinculos
   where condominio_id = contexto_condominio() and funcao = 'SINDICO' and revogado_em is null
$$;

-- ---------------------------------------------------------------------------------------
-- Implantação (PI-04, PI-05, SH-01).

-- A implantação do cliente do contexto; nasce na primeira vez que alguém abre a aba, se o
-- cliente ainda está em implantação, com a versão atual do roteiro.
create function implantacao_do_cliente() returns implantacoes
language plpgsql
set search_path = public
as $$
declare
  v implantacoes;
  v_versao smallint;
begin
  select * into v from implantacoes where condominio_id = contexto_condominio();
  if found then return v; end if;
  if (select estado from clientes where condominio_id = contexto_condominio()) <> 'IMPLANTACAO' then
    return null;
  end if;
  select max(numero) into v_versao from roteiros_implantacao;
  insert into implantacoes (condominio_id, roteiro_versao) values (contexto_condominio(), v_versao) returning * into v;
  insert into etapas_implantacao (condominio_id, implantacao_id, numero, chave, titulo)
  select contexto_condominio(), v.id, (e ->> 'numero')::smallint, e ->> 'chave', e ->> 'titulo'
    from roteiros_implantacao r, jsonb_array_elements(r.etapas) e
   where r.numero = v_versao;
  perform registrar_historico_interno('implantacao.iniciada', 'implantacao', v.id::text,
                                      jsonb_build_object('roteiro', v_versao));
  return v;
end $$;

-- O pedido de teste (etapa 7): registrado por um síndico ativo e encerrado.
create function pedido_teste() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'encerradoEm', p.encerrado_em)
    from pedidos p
   where p.condominio_id = contexto_condominio() and p.estado = 'ENCERRADO'
     and p.criado_por in (select sindicos_ativos())
   order by p.encerrado_em
   limit 1
$$;

-- O que ainda falta para entregar.
create function entrega_faltando(p_implantacao uuid) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when exists (select 1 from etapas_implantacao e where e.implantacao_id = p_implantacao and e.chave <> 'ENTREGA'
                                                     and e.situacao not in ('REALIZADA', 'NAO_SE_APLICA'))
         then 'ETAPAS_ABERTAS' end,
    case when not exists (select 1 from sindicos_ativos()) then 'SEM_SINDICO' end,
    case when pedido_teste() is null then 'SEM_PEDIDO_TESTE' end], null)
$$;

create function resumo_etapa(e etapas_implantacao, p_descricao text) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'numero', e.numero, 'chave', e.chave, 'titulo', e.titulo, 'descricao', p_descricao, 'situacao', e.situacao,
    'responsavelId', e.responsavel_id, 'responsavel', nome_pessoa(e.responsavel_id),
    'substitutoId', e.substituto_id, 'substituto', nome_pessoa(e.substituto_id),
    'feito', e.feito, 'motivo', e.motivo, 'modalidade', e.modalidade, 'quando', e.quando,
    'realizadaEm', e.realizada_em, 'atualizadoEm', e.atualizado_em, 'versao', e.versao))
$$;

create function console_implantacao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  v_hoje date;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.ver');
  v := implantacao_do_cliente();
  if v.id is null then
    return jsonb_build_object('legado', true, 'estagio', (select estado from clientes where condominio_id = p_condominio));
  end if;
  v_hoje := hoje_no_condominio();
  return jsonb_strip_nulls(jsonb_build_object(
    'legado', false,
    'estagio', (select estado from clientes where condominio_id = p_condominio),
    'implantacao', jsonb_build_object('id', v.id, 'roteiroVersao', v.roteiro_versao, 'criadaEm', v.criado_em,
                                      'entregueEm', v.entregue_em, 'entreguePor', nome_pessoa(v.entregue_por),
                                      'recado', v.recado, 'versao', v.versao),
    'etapas', (select jsonb_agg(resumo_etapa(e, (select x ->> 'descricao' from roteiros_implantacao r, jsonb_array_elements(r.etapas) x
                                                  where r.numero = v.roteiro_versao and (x ->> 'numero')::smallint = e.numero))
                                order by e.numero)
                 from etapas_implantacao e where e.implantacao_id = v.id),
    'pendencias', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', p.id, 'etapa', p.etapa, 'texto', p.texto, 'comQuem', p.com_quem,
               'responsavelId', p.responsavel_id, 'responsavel', nome_pessoa(p.responsavel_id),
               'proximoRetorno', p.proximo_retorno, 'vencida', p.resolvida_em is null and p.proximo_retorno < v_hoje,
               'resolvidaEm', p.resolvida_em, 'resolucao', p.resolucao, 'versao', p.versao))
             order by p.resolvida_em is not null, p.proximo_retorno, p.criado_em)
        from pendencias_implantacao p
       where p.implantacao_id = v.id and (p.resolvida_em is null or p.resolvida_em >= app_now() - interval '30 days')), '[]'::jsonb),
    'equipe', equipe_do_cliente(),
    'entrega', jsonb_build_object(
      'faltando', to_jsonb(entrega_faltando(v.id)),
      'pedidoTeste', pedido_teste(),
      'sindicos', (select count(*) from sindicos_ativos()),
      'pendenciasClienteVencidas', (select count(*) from pendencias_implantacao p where p.implantacao_id = v.id and p.resolvida_em is null
                                                       and p.com_quem = 'CLIENTE' and p.proximo_retorno < v_hoje)),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'console.implantacao.editar') and v.entregue_em is null,
                               'entregar', pode(p_pessoa, p_condominio, 'console.estagio.mudar') and v.entregue_em is null)));
end $$;

create function console_salvar_etapa(p_pessoa uuid, p_condominio uuid, p_numero integer, p_versao integer, p_situacao text,
                                     p_responsavel uuid, p_substituto uuid, p_feito text, p_motivo text,
                                     p_modalidade text, p_quando date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  e etapas_implantacao;
  v_feito text := nullif(btrim(coalesce(p_feito, '')), '');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.editar');
  v := implantacao_do_cliente();
  if v.id is null or v.entregue_em is not null then
    perform recusar_motivo('A implantação deste cliente já foi entregue', 'JA_ENTREGUE');
  end if;
  select * into e from etapas_implantacao where implantacao_id = v.id and numero = p_numero;
  if not found then raise exception 'Etapa não encontrada' using errcode = 'TC404'; end if;
  if e.chave = 'ENTREGA' then
    perform recusar_motivo('A entrega é feita pelo botão Entregar', 'ETAPA_ENTREGA');
  end if;
  if p_situacao is null or p_situacao not in ('PREPARADA', 'PENDENTE', 'REALIZADA', 'NAO_SE_APLICA') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  if p_situacao = 'NAO_SE_APLICA' and e.chave = 'PEDIDO_TESTE' then
    perform recusar_motivo('O pedido de teste com o síndico sempre se aplica', 'PEDIDO_TESTE_OBRIGATORIO');
  end if;
  if p_responsavel is not null and not eh_equipe_do_cliente(p_responsavel) then
    perform recusar_campos('O responsável precisa ser da equipe atribuída ao cliente', 'responsavel');
  end if;
  if p_substituto is not null and not eh_equipe_do_cliente(p_substituto) then
    perform recusar_campos('O substituto precisa ser da equipe atribuída ao cliente', 'substituto');
  end if;
  if p_substituto is not null and p_substituto = p_responsavel then
    perform recusar_campos('Substituto diferente do responsável', 'substituto');
  end if;
  if p_situacao = 'REALIZADA' and coalesce(length(v_feito), 0) not between 3 and 2000 then
    perform recusar_campos('Escreva o que foi feito (3 a 2.000 caracteres)', 'feito');
  end if;
  if length(v_feito) > 2000 then perform recusar_campos('Até 2.000 caracteres', 'feito'); end if;
  if p_situacao = 'NAO_SE_APLICA' and coalesce(length(v_motivo), 0) not between 3 and 500 then
    perform recusar_campos('Diga por que não se aplica (3 a 500 caracteres)', 'motivo');
  end if;
  if e.chave <> 'APRESENTACAO' and (p_modalidade is not null or p_quando is not null) then
    perform recusar_campos('Modalidade e data são só da apresentação', 'modalidade');
  end if;
  if p_modalidade is not null and p_modalidade not in ('PRESENCIAL', 'VIDEO') then
    perform recusar_campos('Presencial ou por vídeo', 'modalidade');
  end if;
  if e.chave = 'APRESENTACAO' and p_situacao = 'REALIZADA' and p_modalidade is null then
    perform recusar_campos('Diga se a apresentação foi presencial ou por vídeo', 'modalidade');
  end if;
  if p_quando is not null and p_quando not between date '2020-01-01' and date '2100-12-31' then
    perform recusar_campos('Data inválida', 'quando');
  end if;
  update etapas_implantacao
     set situacao = p_situacao, responsavel_id = p_responsavel, substituto_id = p_substituto, feito = v_feito,
         motivo = case when p_situacao = 'NAO_SE_APLICA' then v_motivo end,
         modalidade = p_modalidade, quando = p_quando,
         realizada_em = case when p_situacao = 'REALIZADA' then coalesce(case when e.situacao = 'REALIZADA' then e.realizada_em end, app_now()) end,
         atualizado_em = app_now()
   where id = e.id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('etapas_implantacao', e.id); end if;
  perform registrar_historico_interno('implantacao.etapa', 'implantacao', v.id::text, jsonb_strip_nulls(jsonb_build_object(
    'etapa', e.numero, 'de', e.situacao, 'para', p_situacao, 'modalidade', p_modalidade)));
  return v_versao;
end $$;

create function console_salvar_pendencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_etapa integer,
                                         p_texto text, p_com_quem text, p_responsavel uuid, p_proximo_retorno date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  v_id uuid;
  v_versao integer;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.editar');
  v := implantacao_do_cliente();
  if v.id is null or v.entregue_em is not null then
    perform recusar_motivo('A implantação deste cliente já foi entregue', 'JA_ENTREGUE');
  end if;
  if coalesce(length(v_texto), 0) not between 3 and 300 then perform recusar_campos('Pendência de 3 a 300 caracteres', 'texto'); end if;
  if p_com_quem is null or p_com_quem not in ('EQUIPE', 'CLIENTE') then
    perform recusar_campos('Diga quem precisa agir', 'comQuem');
  end if;
  if p_etapa is not null and not exists (select 1 from etapas_implantacao where implantacao_id = v.id and numero = p_etapa) then
    perform recusar_campos('Etapa desconhecida', 'etapa');
  end if;
  if p_responsavel is null or not eh_equipe_do_cliente(p_responsavel) then
    perform recusar_campos('O responsável precisa ser da equipe atribuída ao cliente', 'responsavel');
  end if;
  if p_proximo_retorno is null or p_proximo_retorno not between date '2020-01-01' and date '2100-12-31' then
    perform recusar_campos('Diga o próximo retorno', 'proximoRetorno');
  end if;
  if p_id is null then
    insert into pendencias_implantacao (condominio_id, implantacao_id, etapa, texto, com_quem, responsavel_id, proximo_retorno, criado_por)
    values (p_condominio, v.id, p_etapa, v_texto, p_com_quem, p_responsavel, p_proximo_retorno, p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico_interno('implantacao.pendencia_criada', 'implantacao', v.id::text,
                                        jsonb_strip_nulls(jsonb_build_object('pendencia', v_id, 'etapa', p_etapa, 'comQuem', p_com_quem)));
  else
    update pendencias_implantacao
       set etapa = p_etapa, texto = v_texto, com_quem = p_com_quem, responsavel_id = p_responsavel,
           proximo_retorno = p_proximo_retorno, atualizado_em = app_now()
     where id = p_id and implantacao_id = v.id and versao = p_versao and resolvida_em is null
    returning id, versao into v_id, v_versao;
    if v_id is null then
      if exists (select 1 from pendencias_implantacao where id = p_id and implantacao_id = v.id and resolvida_em is not null) then
        perform recusar_motivo('A pendência já foi resolvida', 'JA_RESOLVIDA');
      end if;
      if not exists (select 1 from pendencias_implantacao where id = p_id and implantacao_id = v.id) then
        raise exception 'Pendência não encontrada' using errcode = 'TC404';
      end if;
      perform conflito_versao('pendencias_implantacao', p_id);
    end if;
    perform registrar_historico_interno('implantacao.pendencia_alterada', 'implantacao', v.id::text,
                                        jsonb_build_object('pendencia', v_id));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function console_resolver_pendencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_resolucao text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  v_versao integer;
  v_resolucao text := btrim(coalesce(p_resolucao, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.editar');
  v := implantacao_do_cliente();
  if v.id is null or v.entregue_em is not null then
    perform recusar_motivo('A implantação deste cliente já foi entregue', 'JA_ENTREGUE');
  end if;
  if coalesce(length(v_resolucao), 0) not between 2 and 300 then perform recusar_campos('Diga como resolveu (2 a 300 caracteres)', 'resolucao'); end if;
  update pendencias_implantacao set resolvida_em = app_now(), resolucao = v_resolucao, atualizado_em = app_now()
   where id = p_id and implantacao_id = v.id and versao = p_versao and resolvida_em is null
  returning versao into v_versao;
  if v_versao is null then
    if exists (select 1 from pendencias_implantacao where id = p_id and implantacao_id = v.id and resolvida_em is not null) then
      perform recusar_motivo('A pendência já foi resolvida', 'JA_RESOLVIDA');
    end if;
    if not exists (select 1 from pendencias_implantacao where id = p_id and implantacao_id = v.id) then
      raise exception 'Pendência não encontrada' using errcode = 'TC404';
    end if;
    perform conflito_versao('pendencias_implantacao', p_id);
  end if;
  perform registrar_historico_interno('implantacao.pendencia_resolvida', 'implantacao', v.id::text, jsonb_build_object('pendencia', p_id));
  return v_versao;
end $$;

-- Entrega (PI-04): ato explícito, com tudo conferido. O cliente passa a ativo pelo guardião
-- e o síndico recebe o recado no sino.
create function console_entregar_implantacao(p_pessoa uuid, p_condominio uuid, p_versao integer, p_recado text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  v_faltando text[];
  v_recado text := btrim(coalesce(p_recado, ''));
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.estagio.mudar');
  if not pode(p_pessoa, p_condominio, 'console.implantacao.editar') then
    raise exception 'Sem permissão para console.implantacao.editar neste condomínio' using errcode = 'TC401';
  end if;
  v := implantacao_do_cliente();
  if v.id is null or v.entregue_em is not null then
    perform recusar_motivo('A implantação deste cliente já foi entregue', 'JA_ENTREGUE');
  end if;
  v_faltando := entrega_faltando(v.id);
  if cardinality(v_faltando) > 0 then
    raise exception 'Ainda falta conferir antes de entregar' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', v_faltando[1], 'faltando', to_jsonb(v_faltando))::text;
  end if;
  if coalesce(length(v_recado), 0) not between 3 and 1000 then perform recusar_campos('Recado de 3 a 1.000 caracteres', 'recado'); end if;
  update implantacoes set entregue_em = app_now(), entregue_por = p_pessoa, recado = v_recado
   where id = v.id and versao = p_versao and entregue_em is null
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('implantacoes', v.id); end if;
  update etapas_implantacao set situacao = 'REALIZADA', feito = 'Entregue ao cliente', realizada_em = app_now(),
                                responsavel_id = p_pessoa, atualizado_em = app_now()
   where implantacao_id = v.id and chave = 'ENTREGA';
  perform definir_transicao('IMPLANTACAO_CONCLUIDA', 'Entrega da implantação');
  update clientes set estado = 'ATIVO' where condominio_id = p_condominio;
  insert into avisos_triade (condominio_id, pessoa_id, tipo, texto)
  select p_condominio, s, 'ENTREGA', v_recado from sindicos_ativos() s;
  perform registrar_historico_interno('implantacao.entregue', 'implantacao', v.id::text, '{}'::jsonb);
  return v_versao;
end $$;

-- O botão antigo "Concluir implantação" dá lugar à entrega quando há roteiro em andamento.
create or replace function console_mudar_estagio(p_pessoa uuid, p_condominio uuid, p_versao integer, p_estagio text, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_atual text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.estagio.mudar');
  select id, estado into v_cliente, v_atual from clientes where condominio_id = p_condominio;
  if v_atual = p_estagio then
    perform recusar_motivo('O cliente já está neste estágio', 'MESMO_ESTAGIO');
  end if;
  if p_estagio = 'ATIVO' and exists (select 1 from implantacoes where condominio_id = p_condominio and entregue_em is null) then
    perform recusar_motivo('Conclua pela entrega da implantação', 'USE_ENTREGA');
  end if;
  if p_estagio = 'ATIVO' and 'SEM_SINDICO' = any (situacoes_cliente(p_condominio)) then
    perform recusar_motivo('Convide o síndico antes de concluir a implantação', 'SEM_SINDICO');
  end if;
  perform definir_transicao(case p_estagio when 'ATIVO' then 'IMPLANTACAO_CONCLUIDA' else 'ESTAGIO_ALTERADO' end,
                            nullif(btrim(p_motivo), ''));
  update clientes set estado = p_estagio where id = v_cliente and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('clientes', v_cliente); end if;
  return v_versao;
end $$;

-- Implantações em andamento dos clientes atribuídos (lista do menu).
create function console_implantacoes(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_saida jsonb := '[]'::jsonb;
  im implantacoes;
  v_hoje date;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select * from jsonb_array_elements_text(v_lista) as y(id)
  loop
    if pode(p_pessoa, r.id::uuid, 'console.implantacao.ver') then
      perform entrar_condominio(p_pessoa, r.id::uuid, 'console.implantacao.ver');
      if (select estado from clientes where condominio_id = r.id::uuid) = 'IMPLANTACAO' then
        select * into im from implantacoes where condominio_id = r.id::uuid;
        v_hoje := hoje_no_condominio();
        v_saida := v_saida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'condominioId', r.id::uuid,
          'nome', (select nome from condominios where id = r.id::uuid),
          'iniciada', im.id is not null,
          'roteiroVersao', im.roteiro_versao,
          'etapas', coalesce((select count(*) from etapas_implantacao where implantacao_id = im.id), 8),
          'feitas', coalesce((select count(*) from etapas_implantacao where implantacao_id = im.id
                                                             and situacao in ('REALIZADA', 'NAO_SE_APLICA')), 0),
          'proxima', (select jsonb_build_object('numero', numero, 'titulo', titulo, 'situacao', situacao,
                                                'responsavel', nome_pessoa(responsavel_id))
                        from etapas_implantacao where implantacao_id = im.id and situacao not in ('REALIZADA', 'NAO_SE_APLICA')
                       order by numero limit 1),
          'pendencias', coalesce((select count(*) from pendencias_implantacao where implantacao_id = im.id and resolvida_em is null), 0),
          'vencidas', coalesce((select count(*) from pendencias_implantacao where implantacao_id = im.id and resolvida_em is null
                                                                        and proximo_retorno < v_hoje), 0),
          'proximoRetorno', (select min(proximo_retorno) from pendencias_implantacao where implantacao_id = im.id and resolvida_em is null),
          'criadaEm', coalesce(im.criado_em, (select criado_em from condominios where id = r.id::uuid))
        )));
      end if;
    end if;
  end loop;
  return (select coalesce(jsonb_agg(x order by (x ->> 'vencidas')::int desc, x ->> 'proximoRetorno' nulls last, x ->> 'nome'), '[]'::jsonb)
            from jsonb_array_elements(v_saida) x);
end $$;

-- ---------------------------------------------------------------------------------------
-- Troca de síndico (CT-01). A conta do novo síndico vem antes (a API convida ou acha pelo
-- e-mail); aqui tudo acontece junto: entra o novo, sai o anterior, fica o registro.

create function console_trocar_sindico(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer, p_novo uuid,
                                       p_nome text, p_pedido_por text, p_canal text, p_conferido text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior vinculos;
  v_novo uuid;
  v_troca uuid;
  v_versao integer;
  v_conferido text[];
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.troca.fazer');
  if length(btrim(coalesce(p_pedido_por, ''))) not between 2 and 120 then
    perform recusar_campos('Diga quem pediu a troca', 'pedidoPor');
  end if;
  if p_canal is null or p_canal not in ('WHATSAPP', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'OUTRO') then
    perform recusar_campos('Diga por qual canal chegou o pedido', 'canal');
  end if;
  select coalesce(array_agg(btrim(x)), '{}') into v_conferido from unnest(coalesce(p_conferido, '{}')) x where btrim(x) <> '';
  if cardinality(v_conferido) not between 1 and 6
     or exists (select 1 from unnest(v_conferido) x where length(x) not between 3 and 200) then
    perform recusar_campos('Registre o que foi conferido (de 1 a 6 itens, 3 a 200 caracteres cada)', 'conferido');
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then perform recusar_campos('Nome inválido', 'nome'); end if;
  select * into v_anterior from vinculos
   where id = p_vinculo and condominio_id = p_condominio and funcao = 'SINDICO' and revogado_em is null;
  if not found then raise exception 'Síndico não encontrado' using errcode = 'TC404'; end if;
  if v_anterior.pessoa_id = p_novo then
    perform recusar_motivo('O novo síndico precisa ser outra pessoa', 'MESMO_SINDICO');
  end if;
  perform garantir_pessoa(p_novo, p_nome);
  if exists (select 1 from vinculos where pessoa_id = p_novo and condominio_id = p_condominio
                                    and funcao = 'SINDICO' and revogado_em is null) then
    perform recusar_motivo('Esta pessoa já é síndica deste condomínio', 'JA_SINDICO');
  end if;
  update vinculos set revogado_em = app_now(), revogado_por = p_pessoa
   where id = p_vinculo and versao = p_versao and revogado_em is null
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('vinculos', p_vinculo); end if;
  insert into vinculos (pessoa_id, condominio_id, funcao, criado_por) values (p_novo, p_condominio, 'SINDICO', p_pessoa)
  returning id into v_novo;
  insert into trocas_sindico (condominio_id, anterior_vinculo, novo_vinculo, pedido_por, canal, conferido, feita_por)
  values (p_condominio, p_vinculo, v_novo, btrim(p_pedido_por), p_canal, v_conferido, p_pessoa)
  returning id into v_troca;
  perform registrar_historico('sindico.trocado', 'vinculo', v_novo::text, jsonb_build_object(
    'anterior', p_vinculo, 'pessoa_anterior', v_anterior.pessoa_id, 'pessoa_nova', p_novo));
  perform registrar_historico_interno('troca.registrada', 'troca', v_troca::text, jsonb_build_object(
    'canal', p_canal, 'conferidos', cardinality(v_conferido)));
  return jsonb_build_object(
    'trocaId', v_troca, 'vinculoId', v_novo,
    'autorizados', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'pessoaId', v.pessoa_id, 'nome', nome_pessoa(v.pessoa_id)) order by nome_pessoa(v.pessoa_id))
        from vinculos v
       where v.condominio_id = p_condominio and v.funcao = 'AUTORIZADO' and v.revogado_em is null
         and v.criado_por = v_anterior.pessoa_id), '[]'::jsonb));
end $$;

create function console_trocas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'feitaEm', t.feita_em, 'feitaPor', nome_pessoa(t.feita_por),
             'anterior', (select nome_pessoa(pessoa_id) from vinculos where id = t.anterior_vinculo),
             'novo', (select nome_pessoa(pessoa_id) from vinculos where id = t.novo_vinculo),
             'pedidoPor', t.pedido_por, 'canal', t.canal, 'conferido', to_jsonb(t.conferido))
           order by t.feita_em desc)
      from trocas_sindico t where t.condominio_id = p_condominio), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Suporte de acesso (PI-09). O e-mail fica no Auth: a API o lê só para mandar o link e
-- mostra mascarado. Aqui ficam o pedido, a verificação e a decisão.

-- Quem tem conta na Plataforma neste condomínio (para abrir o pedido).
create function console_pessoas_plataforma(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  return coalesce((
    select jsonb_agg(jsonb_build_object('pessoaId', x.pessoa_id, 'nome', nome_pessoa(x.pessoa_id), 'funcoes', to_jsonb(x.funcoes),
                                        'desde', x.desde) order by nome_pessoa(x.pessoa_id))
      from (select v.pessoa_id, array_agg(distinct v.funcao order by v.funcao) as funcoes, min(v.criado_em) as desde
              from vinculos v join funcoes f on f.codigo = v.funcao
             where v.condominio_id = p_condominio and v.revogado_em is null and f.sistema = 'PLATAFORMA'
             group by v.pessoa_id) x), '[]'::jsonb);
end $$;

create function vinculo_plataforma_ativo(p_alvo uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('funcoes', to_jsonb(array_agg(distinct v.funcao order by v.funcao)), 'desde', min(v.criado_em))
    from vinculos v join funcoes f on f.codigo = v.funcao
   where v.pessoa_id = p_alvo and v.condominio_id = contexto_condominio() and v.revogado_em is null and f.sistema = 'PLATAFORMA'
  having count(*) > 0
$$;

create function console_abrir_suporte_acesso(p_pessoa uuid, p_condominio uuid, p_alvo uuid, p_tipo text, p_canal text, p_descricao text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  if p_alvo is null or vinculo_plataforma_ativo(p_alvo) is null then
    perform recusar_motivo('Esta pessoa não tem vínculo ativo neste condomínio', 'SEM_VINCULO');
  end if;
  if p_tipo is null or p_tipo not in ('SENHA', 'AUTENTICADOR', 'EMAIL_NAO_CHEGA', 'OUTRO') then
    perform recusar_campos('Diga o que aconteceu', 'tipo');
  end if;
  if p_canal is null or p_canal not in ('WHATSAPP', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'OUTRO') then
    perform recusar_campos('Diga por qual canal chegou o pedido', 'canal');
  end if;
  if coalesce(length(v_descricao), 0) not between 3 and 1000 then perform recusar_campos('Descrição de 3 a 1.000 caracteres', 'descricao'); end if;
  if exists (select 1 from pedidos_suporte_acesso where pessoa_id = p_alvo and condominio_id = p_condominio
                                                  and situacao in ('ABERTO', 'DUVIDOSO')) then
    perform recusar_motivo('Esta pessoa já tem um pedido em andamento', 'PEDIDO_ABERTO');
  end if;
  insert into pedidos_suporte_acesso (condominio_id, pessoa_id, tipo, canal, descricao, atendido_por)
  values (p_condominio, p_alvo, p_tipo, p_canal, v_descricao, p_pessoa)
  returning id into v_id;
  perform registrar_historico_interno('suporte_acesso.aberto', 'suporte_acesso', v_id::text,
                                      jsonb_build_object('pessoa_id', p_alvo, 'tipo', p_tipo, 'canal', p_canal));
  return v_id;
end $$;

create function resumo_suporte_acesso(s pedidos_suporte_acesso) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id, 'condominioId', s.condominio_id, 'condominio', (select nome from condominios where id = s.condominio_id),
    'pessoaId', s.pessoa_id, 'pessoa', nome_pessoa(s.pessoa_id), 'tipo', s.tipo, 'canal', s.canal, 'descricao', s.descricao,
    'vinculo', vinculo_plataforma_ativo(s.pessoa_id),
    'dadosConferidos', s.dados_conferidos, 'canalConhecido', s.canal_conhecido,
    'situacao', s.situacao, 'motivo', s.motivo, 'atendidoPor', nome_pessoa(s.atendido_por),
    'decididoEm', s.decidido_em, 'decididoPor', nome_pessoa(s.decidido_por),
    'criadoEm', s.criado_em, 'atualizadoEm', s.atualizado_em, 'versao', s.versao))
$$;

-- Fila dos clientes atribuídos: os em andamento e os decididos nos últimos 30 dias.
create function console_suportes_acesso(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_saida jsonb := '[]'::jsonb;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select * from jsonb_array_elements_text(v_lista) as y(id)
  loop
    if pode(p_pessoa, r.id::uuid, 'console.suporte.acesso') then
      perform entrar_condominio(p_pessoa, r.id::uuid, 'console.suporte.acesso');
      v_saida := v_saida || coalesce((
        select jsonb_agg(resumo_suporte_acesso(s)) from pedidos_suporte_acesso s
         where s.condominio_id = r.id::uuid
           and (s.situacao in ('ABERTO', 'DUVIDOSO') or s.atualizado_em >= app_now() - interval '30 days')), '[]'::jsonb);
    end if;
  end loop;
  return (select coalesce(jsonb_agg(x order by x ->> 'situacao' not in ('ABERTO', 'DUVIDOSO'), x ->> 'criadoEm' desc), '[]'::jsonb)
            from jsonb_array_elements(v_saida) x);
end $$;

create function exigir_suporte_acesso(p_id uuid) returns pedidos_suporte_acesso
language plpgsql
set search_path = public
as $$
declare v pedidos_suporte_acesso;
begin
  select * into v from pedidos_suporte_acesso where id = p_id and condominio_id = contexto_condominio();
  if not found then raise exception 'Pedido não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function console_suporte_acesso(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos_suporte_acesso;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  v := exigir_suporte_acesso(p_id);
  return resumo_suporte_acesso(v) || jsonb_build_object(
    'pode', jsonb_build_object(
      'verificar', v.situacao = 'ABERTO',
      'decidir', v.situacao = 'ABERTO' or (v.situacao = 'DUVIDOSO' and pode(p_pessoa, p_condominio, 'console.casos_duvidosos')),
      'tirarAutenticador', v.situacao in ('ABERTO', 'DUVIDOSO') and pode(p_pessoa, p_condominio, 'console.casos_duvidosos')));
end $$;

create function console_verificar_suporte_acesso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_tipo text,
                                                 p_dados_conferidos boolean, p_canal_conhecido boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos_suporte_acesso;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  v := exigir_suporte_acesso(p_id);
  if v.situacao <> 'ABERTO' then perform recusar_motivo('O pedido não está mais em verificação', 'JA_DECIDIDO'); end if;
  if p_tipo is null or p_tipo not in ('SENHA', 'AUTENTICADOR', 'EMAIL_NAO_CHEGA', 'OUTRO') then
    perform recusar_campos('Diga o que aconteceu', 'tipo');
  end if;
  update pedidos_suporte_acesso
     set tipo = p_tipo, dados_conferidos = coalesce(p_dados_conferidos, false), canal_conhecido = coalesce(p_canal_conhecido, false),
         atualizado_em = app_now()
   where id = v.id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos_suporte_acesso', v.id); end if;
  perform registrar_historico_interno('suporte_acesso.verificado', 'suporte_acesso', v.id::text, jsonb_build_object(
    'tipo', p_tipo, 'dados', coalesce(p_dados_conferidos, false), 'canal', coalesce(p_canal_conhecido, false)));
  return v_versao;
end $$;

-- Decisão: ENVIAR (link de senha nova ao e-mail já cadastrado), TIRAR_AUTENTICADOR (só a
-- administração), DUVIDOSO (passa à administração) ou RECUSAR. A API faz o envio depois.
create function console_decidir_suporte_acesso(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_decisao text,
                                               p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos_suporte_acesso;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_situacao text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  v := exigir_suporte_acesso(p_id);
  if p_decisao is null or p_decisao not in ('ENVIAR', 'TIRAR_AUTENTICADOR', 'DUVIDOSO', 'RECUSAR') then
    perform recusar_campos('Decisão desconhecida', 'decisao');
  end if;
  if v.situacao not in ('ABERTO', 'DUVIDOSO') then perform recusar_motivo('O pedido já foi decidido', 'JA_DECIDIDO'); end if;
  if (v.situacao = 'DUVIDOSO' or p_decisao = 'TIRAR_AUTENTICADOR') and not pode(p_pessoa, p_condominio, 'console.casos_duvidosos') then
    raise exception 'Caso duvidoso e autenticador perdido ficam com a administração' using errcode = 'TC401';
  end if;
  if p_decisao = 'DUVIDOSO' and v.situacao = 'DUVIDOSO' then
    perform recusar_motivo('O pedido já está com a administração', 'JA_DUVIDOSO');
  end if;
  if p_decisao in ('ENVIAR', 'TIRAR_AUTENTICADOR') then
    if vinculo_plataforma_ativo(v.pessoa_id) is null then
      perform recusar_motivo('A pessoa não tem mais vínculo ativo neste condomínio', 'SEM_VINCULO');
    end if;
    if not (v.dados_conferidos and v.canal_conhecido) then
      perform recusar_motivo('Conclua a verificação antes', 'VERIFICACAO_INCOMPLETA');
    end if;
  end if;
  if p_decisao = 'TIRAR_AUTENTICADOR' and v.tipo <> 'AUTENTICADOR' then
    perform recusar_motivo('O pedido não é de autenticador perdido', 'NAO_E_AUTENTICADOR');
  end if;
  if p_decisao in ('DUVIDOSO', 'RECUSAR') and coalesce(length(v_motivo), 0) not between 3 and 500 then
    perform recusar_campos('Diga o motivo (3 a 500 caracteres)', 'motivo');
  end if;
  v_situacao := case p_decisao when 'ENVIAR' then 'ENVIADO' when 'TIRAR_AUTENTICADOR' then 'AUTENTICADOR_TIRADO'
                                when 'DUVIDOSO' then 'DUVIDOSO' else 'RECUSADO' end;
  update pedidos_suporte_acesso
     set situacao = v_situacao,
         motivo = case when p_decisao in ('DUVIDOSO', 'RECUSAR') then v_motivo else motivo end,
         decidido_em = case when v_situacao = 'DUVIDOSO' then null else app_now() end,
         decidido_por = case when v_situacao = 'DUVIDOSO' then null else p_pessoa end,
         atualizado_em = app_now()
   where id = v.id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos_suporte_acesso', v.id); end if;
  perform registrar_historico_interno('suporte_acesso.' || lower(v_situacao), 'suporte_acesso', v.id::text,
                                      jsonb_build_object('pessoa_id', v.pessoa_id));
  if v_situacao = 'ENVIADO' then
    perform registrar_historico('acesso.link_senha_suporte', 'pessoa', v.pessoa_id::text, '{}'::jsonb);
  elsif v_situacao = 'AUTENTICADOR_TIRADO' then
    perform registrar_historico('acesso.autenticador_tirado_suporte', 'pessoa', v.pessoa_id::text, '{}'::jsonb);
  end if;
  return jsonb_build_object('situacao', v_situacao, 'pessoaId', v.pessoa_id, 'versao', v_versao);
end $$;

-- O envio pela API falhou: o pedido volta a aberto, com o registro.
create function console_falha_suporte_acesso(p_pessoa uuid, p_condominio uuid, p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos_suporte_acesso;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.suporte.acesso');
  v := exigir_suporte_acesso(p_id);
  if v.situacao not in ('ENVIADO', 'AUTENTICADOR_TIRADO') or v.decidido_por <> p_pessoa then
    raise exception 'Pedido não encontrado' using errcode = 'TC404';
  end if;
  update pedidos_suporte_acesso set situacao = 'ABERTO', decidido_em = null, decidido_por = null, atualizado_em = app_now()
   where id = v.id;
  perform registrar_historico_interno('suporte_acesso.falhou', 'suporte_acesso', v.id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Acesso excepcional (PI-11).

create function resumo_acesso_excepcional(a acessos_excepcionais) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'pedidoPorId', a.pedido_por, 'pedidoPor', nome_pessoa(a.pedido_por),
    'funcoes', (select to_jsonb(array_agg(distinct v.funcao order by v.funcao)) from vinculos v join funcoes f on f.codigo = v.funcao
                 where v.pessoa_id = a.pedido_por and v.condominio_id = a.condominio_id and v.revogado_em is null and f.sistema = 'CONSOLE'),
    'motivo', a.motivo, 'areas', to_jsonb(a.areas), 'horas', a.horas,
    'situacao', case when a.situacao = 'APROVADO' and a.valido_ate <= app_now() then 'EXPIRADO' else a.situacao end,
    'decididoEm', a.decidido_em, 'decididoPor', nome_pessoa(a.decidido_por), 'motivoRecusa', a.motivo_recusa,
    'validoAte', a.valido_ate, 'encerradoEm', a.encerrado_em, 'encerradoPor', nome_pessoa(a.encerrado_por),
    'leituras', (select count(*) from historico h where h.condominio_id = a.condominio_id and h.acao = 'acesso_excepcional.leitura'
                                                  and h.entidade_id = a.id::text),
    'criadoEm', a.criado_em))
$$;

create function console_pedir_acesso_excepcional(p_pessoa uuid, p_condominio uuid, p_motivo text, p_areas text[], p_horas integer,
                                                 p_chamado uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_areas text[];
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.acesso_excepcional.pedir');
  if coalesce(length(v_motivo), 0) not between 10 and 1000 then perform recusar_campos('Diga por que precisa ver (10 a 1.000 caracteres)', 'motivo'); end if;
  select array_agg(distinct x order by x) into v_areas from unnest(coalesce(p_areas, '{}')) x;
  if v_areas is null or not (v_areas <@ array['PEDIDOS', 'MORADORES', 'COMUNICADOS', 'MANUTENCAO']) then
    perform recusar_campos('Escolha o que vai ver', 'areas');
  end if;
  if p_horas is null or p_horas not between 1 and 72 then perform recusar_campos('Prazo de 1 a 72 horas', 'horas'); end if;
  if p_chamado is not null and not exists (select 1 from chamados where id = p_chamado and condominio_id = p_condominio) then
    perform recusar_campos('Chamado desconhecido', 'chamado');
  end if;
  if exists (select 1 from acessos_excepcionais where pedido_por = p_pessoa and condominio_id = p_condominio
                and (situacao = 'PEDIDO' or (situacao = 'APROVADO' and valido_ate > app_now()))) then
    perform recusar_motivo('Você já tem um acesso pedido ou valendo neste condomínio', 'JA_PEDIDO');
  end if;
  insert into acessos_excepcionais (condominio_id, pedido_por, motivo, areas, horas, chamado_id)
  values (p_condominio, p_pessoa, v_motivo, v_areas, p_horas, p_chamado)
  returning id into v_id;
  insert into avisos_triade (condominio_id, pessoa_id, tipo, acesso_id)
  select p_condominio, s, 'ACESSO_PEDIDO', v_id from sindicos_ativos() s;
  perform registrar_historico('acesso_excepcional.pedido', 'acesso_excepcional', v_id::text,
                              jsonb_build_object('areas', to_jsonb(v_areas), 'horas', p_horas));
  return v_id;
end $$;

create function console_acessos_excepcionais(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(resumo_acesso_excepcional(a) || jsonb_build_object('meu', a.pedido_por = p_pessoa)
                                        order by a.criado_em desc)
                         from acessos_excepcionais a
                        where a.condominio_id = p_condominio and a.criado_em >= app_now() - interval '90 days'), '[]'::jsonb),
    'podePedir', pode(p_pessoa, p_condominio, 'console.acesso_excepcional.pedir'));
end $$;

-- Cada abertura de área pelo acesso excepcional fica no histórico que o síndico vê.
create function console_ler_excepcional(p_pessoa uuid, p_condominio uuid, p_area text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a acessos_excepcionais;
begin
  if p_area is null or p_area not in ('PEDIDOS', 'MORADORES', 'COMUNICADOS', 'MANUTENCAO') then
    perform recusar_campos('Área desconhecida', 'area');
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, (acoes_area_excepcional(p_area))[1]);
  select * into a from acessos_excepcionais
   where pedido_por = p_pessoa and condominio_id = p_condominio and situacao = 'APROVADO' and valido_ate > app_now()
     and p_area = any (areas)
   order by valido_ate desc limit 1;
  if not found then raise exception 'Sem acesso excepcional a esta área' using errcode = 'TC401'; end if;
  perform registrar_historico('acesso_excepcional.leitura', 'acesso_excepcional', a.id::text, jsonb_build_object('area', p_area));
  return jsonb_build_object('acessoId', a.id, 'validoAte', a.valido_ate, 'areas', to_jsonb(a.areas));
end $$;

create function plataforma_acessos_excepcionais(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'acesso_excepcional.aprovar');
  return coalesce((
    select jsonb_agg(resumo_acesso_excepcional(a) order by a.situacao <> 'PEDIDO', a.criado_em desc)
      from acessos_excepcionais a
     where a.condominio_id = p_condominio
       and (a.situacao = 'PEDIDO' or (a.situacao = 'APROVADO' and a.valido_ate > app_now())
            or a.criado_em >= app_now() - interval '30 days')), '[]'::jsonb);
end $$;

create function plataforma_decidir_acesso_excepcional(p_pessoa uuid, p_condominio uuid, p_id uuid, p_aprovar boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a acessos_excepcionais;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'acesso_excepcional.aprovar');
  select * into a from acessos_excepcionais where id = p_id and condominio_id = p_condominio for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'PEDIDO' then perform recusar_motivo('O pedido já foi decidido', 'JA_DECIDIDO'); end if;
  if p_aprovar is null then perform recusar_campos('Aprove ou recuse', 'aprovar'); end if;
  if p_aprovar then
    if not exists (select 1 from vinculos v join funcoes f on f.codigo = v.funcao
                    where v.pessoa_id = a.pedido_por and v.condominio_id = p_condominio and v.revogado_em is null and f.sistema = 'CONSOLE') then
      perform recusar_motivo('Quem pediu não atende mais este condomínio', 'SEM_ATRIBUICAO');
    end if;
    update acessos_excepcionais set situacao = 'APROVADO', decidido_em = app_now(), decidido_por = p_pessoa,
                                    valido_ate = app_now() + make_interval(hours => a.horas)
     where id = a.id returning * into a;
  else
    if coalesce(length(v_motivo), 0) not between 3 and 500 then perform recusar_campos('Diga o motivo (3 a 500 caracteres)', 'motivo'); end if;
    update acessos_excepcionais set situacao = 'RECUSADO', decidido_em = app_now(), decidido_por = p_pessoa, motivo_recusa = v_motivo
     where id = a.id returning * into a;
  end if;
  perform registrar_historico('acesso_excepcional.' || case when p_aprovar then 'aprovado' else 'recusado' end,
                              'acesso_excepcional', a.id::text, '{}'::jsonb);
  return resumo_acesso_excepcional(a);
end $$;

create function plataforma_encerrar_acesso_excepcional(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a acessos_excepcionais;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'acesso_excepcional.aprovar');
  select * into a from acessos_excepcionais where id = p_id and condominio_id = p_condominio for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'APROVADO' or a.valido_ate <= app_now() then
    perform recusar_motivo('O acesso não está valendo', 'NAO_VALE');
  end if;
  update acessos_excepcionais set situacao = 'ENCERRADO', encerrado_em = app_now(), encerrado_por = p_pessoa
   where id = a.id returning * into a;
  perform registrar_historico('acesso_excepcional.encerrado', 'acesso_excepcional', a.id::text, '{}'::jsonb);
  return resumo_acesso_excepcional(a);
end $$;

-- A Carteira mostra quem tem pendência de implantação vencida (PI-05, PI-01).
create or replace function situacoes_cliente(p_condominio uuid) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when not exists (select 1 from vinculos v where v.condominio_id = c.id and v.funcao = 'SINDICO' and v.revogado_em is null)
         then 'SEM_SINDICO' end,
    case when c.cenario is null then 'SEM_CENARIO' end,
    case when c.numero_whatsapp is null then 'SEM_NUMERO_WHATSAPP' end,
    case when jsonb_array_length(c.contatos) = 0 then 'SEM_CONTATO' end,
    case when cl.referencia_contrato is null then 'SEM_CONTRATO' end,
    case when exists (select 1 from pendencias_implantacao p join implantacoes i on i.id = p.implantacao_id
                       where p.condominio_id = c.id and i.entregue_em is null and p.resolvida_em is null
                         and p.proximo_retorno < hoje_no_condominio())
         then 'PENDENCIA_VENCIDA' end
  ], null)
  from condominios c left join clientes cl on cl.condominio_id = c.id
  where c.id = p_condominio
$$;

-- ---------------------------------------------------------------------------------------
-- Chamados (PI-17, PI-20).

create function chamado_visivel(p_pessoa uuid, c chamados) returns boolean
language sql stable
set search_path = public
as $$ select c.aberto_por = p_pessoa or eh_sindico(p_pessoa) $$;

create function exigir_chamado(p_id uuid) returns chamados
language plpgsql
set search_path = public
as $$
declare v chamados;
begin
  select * into v from chamados where id = p_id and condominio_id = contexto_condominio();
  if not found then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

-- Resolvido há mais de 7 dias não volta a abrir: abre-se outro.
create function chamado_fechado(c chamados) returns boolean
language sql stable
set search_path = public
as $$ select c.situacao = 'RESOLVIDO' and c.resolvido_em < app_now() - interval '7 days' $$;

create function resumo_chamado(c chamados, p_internas boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'condominioId', c.condominio_id, 'numero', c.numero, 'tipo', c.tipo, 'area', c.area, 'titulo', c.titulo,
    'situacao', c.situacao, 'abertoPorId', c.aberto_por, 'abertoPor', nome_pessoa(c.aberto_por),
    'responsavelId', c.responsavel_id, 'responsavel', nome_pessoa(c.responsavel_id),
    'imagens', (select count(*) from arquivos_chamado a where a.chamado_id = c.id and a.situacao = 'LIBERADO'),
    'ultima', (select jsonb_build_object('lado', m.lado, 'autor', nome_pessoa(m.autor_id), 'em', m.criado_em)
                 from mensagens_chamado m where m.chamado_id = c.id and (p_internas or not m.interna)
                order by m.criado_em desc limit 1),
    'resolvidoEm', c.resolvido_em, 'criadoEm', c.criado_em, 'atualizadoEm', c.atualizado_em, 'versao', c.versao))
$$;

create function mensagens_do_chamado(p_chamado uuid, p_internas boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'lado', m.lado, 'interna', m.interna, 'autor', nome_pessoa(m.autor_id),
                                                'texto', m.texto, 'criadoEm', m.criado_em) order by m.criado_em, m.id), '[]'::jsonb)
    from mensagens_chamado m where m.chamado_id = p_chamado and (p_internas or not m.interna)
$$;

create function arquivos_do_chamado(p_chamado uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', a.id, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', coalesce(a.tamanho, a.tamanho_declarado), 'situacao', a.situacao,
           'motivoRecusa', a.motivo_recusa, 'enviadoEm', a.enviado_em, 'enviadoPor', nome_pessoa(a.enviado_por)))
         order by a.enviado_em, a.id), '[]'::jsonb)
    from arquivos_chamado a where a.chamado_id = p_chamado and a.situacao <> 'ENVIANDO'
$$;

create function plataforma_chamados(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(resumo_chamado(c, false) order by c.situacao = 'RESOLVIDO', c.atualizado_em desc)
                         from chamados c where chamado_visivel(p_pessoa, c)), '[]'::jsonb),
    'todos', eh_sindico(p_pessoa));
end $$;

create function plataforma_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c chamados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  return resumo_chamado(c, false) || jsonb_build_object(
    'mensagens', mensagens_do_chamado(c.id, false),
    'arquivos', arquivos_do_chamado(c.id),
    'pode', jsonb_build_object(
      'responder', not chamado_fechado(c),
      'resolver', c.situacao <> 'RESOLVIDO',
      'enviarImagem', c.situacao <> 'RESOLVIDO' and c.aberto_por = p_pessoa
                      and (select count(*) from arquivos_chamado a where a.chamado_id = c.id and a.situacao <> 'NAO_LIBERADO') < 3));
end $$;

create function plataforma_abrir_chamado(p_pessoa uuid, p_condominio uuid, p_tipo text, p_area text, p_titulo text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_numero integer;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  if p_tipo is null or p_tipo not in ('DUVIDA', 'PROBLEMA', 'SUGESTAO') then perform recusar_campos('Escolha o tipo', 'tipo'); end if;
  if p_area is null or p_area not in ('INICIO', 'PEDIDOS', 'AGENDA', 'MANUTENCAO', 'COMUNICADOS', 'MEMORIA', 'MORADORES',
                                      'CONFIGURACOES', 'PESSOAS', 'ACESSO', 'OUTRO') then
    perform recusar_campos('Diga onde no sistema', 'area');
  end if;
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Conte o que aconteceu (até 4.000 caracteres)', 'texto'); end if;
  if not limite_contar('chamado', p_pessoa::text) then
    perform recusar_motivo('Muitos chamados abertos hoje; responda num dos que já existem', 'LIMITE_CHAMADOS');
  end if;
  perform pg_advisory_xact_lock(hashtext('chamados:' || p_condominio));
  select coalesce(max(numero), 0) + 1 into v_numero from chamados where condominio_id = p_condominio;
  insert into chamados (condominio_id, numero, aberto_por, tipo, area, titulo)
  values (p_condominio, v_numero, p_pessoa, p_tipo, p_area, v_titulo)
  returning id into v_id;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, v_id, p_pessoa, 'CLIENTE', v_texto);
  perform registrar_historico('chamado.aberto', 'chamado', v_id::text, jsonb_build_object('tipo', p_tipo, 'area', p_area));
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

create function plataforma_responder_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_texto text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_reaberto boolean := false;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  if chamado_fechado(c) then
    perform recusar_motivo('Este chamado foi resolvido há mais de 7 dias; abra outro', 'CHAMADO_FECHADO');
  end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Resposta de 2 a 4.000 caracteres', 'texto'); end if;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, c.id, p_pessoa, 'CLIENTE', v_texto);
  v_reaberto := c.situacao = 'RESOLVIDO';
  update chamados
     set situacao = case when situacao in ('RESOLVIDO', 'ESPERANDO_CLIENTE') then 'ANDAMENTO' else situacao end,
         resolvido_em = null, atualizado_em = app_now()
   where id = c.id;
  if v_reaberto then
    perform registrar_historico('chamado.reaberto', 'chamado', c.id::text, '{}'::jsonb);
  end if;
  return jsonb_build_object('reaberto', v_reaberto);
end $$;

create function plataforma_resolver_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c chamados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  if c.situacao = 'RESOLVIDO' then perform recusar_motivo('O chamado já está resolvido', 'JA_RESOLVIDO'); end if;
  update chamados set situacao = 'RESOLVIDO', resolvido_em = app_now(), atualizado_em = app_now() where id = c.id;
  perform registrar_historico('chamado.resolvido', 'chamado', c.id::text, jsonb_build_object('lado', 'CLIENTE'));
  return jsonb_build_object('situacao', 'RESOLVIDO');
end $$;

-- Imagens: só quem abriu, até 3 por chamado, com as regras das fotos dos pedidos.
create function plataforma_iniciar_arquivo_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_nome text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if c.aberto_por <> p_pessoa then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  if c.situacao = 'RESOLVIDO' then perform recusar_motivo('O chamado já está resolvido', 'JA_RESOLVIDO'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then
    perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome');
  end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp') then
    perform recusar_motivo('Só imagens (JPG, PNG, WEBP)', 'SO_IMAGEM');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Imagem com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from chamados where id = c.id for update;
  if (select count(*) from arquivos_chamado where chamado_id = c.id and situacao <> 'NAO_LIBERADO') >= 3 then
    perform recusar_motivo('O chamado já tem 3 imagens', 'LIMITE_IMAGENS');
  end if;
  v_caminho := p_condominio || '/' || c.id || '/' || v_id;
  insert into arquivos_chamado (id, condominio_id, chamado_id, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, c.id, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function plataforma_arquivo_chamado_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_chamado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  select * into a from arquivos_chamado where id = p_arquivo and chamado_id = p_id and enviado_por = p_pessoa;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function plataforma_verificar_arquivo_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid, p_liberado boolean,
                                                     p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_chamado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  select * into a from arquivos_chamado where id = p_arquivo and chamado_id = p_id and enviado_por = p_pessoa;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_chamado set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
  else
    update arquivos_chamado set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_abrir_arquivo_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  a arquivos_chamado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  select * into a from arquivos_chamado where id = p_arquivo and chamado_id = c.id;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Console: fila dos clientes atribuídos.
create function console_chamados(p_pessoa uuid, p_filtro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_saida jsonb := '[]'::jsonb;
  v_filtro text := coalesce(p_filtro, 'ABERTOS');
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then raise exception 'Só a equipe TRÍADE' using errcode = 'TC401'; end if;
  if v_filtro not in ('ABERTOS', 'ESPERANDO_CLIENTE', 'RESOLVIDOS', 'TODOS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select * from jsonb_array_elements_text(v_lista) as y(id)
  loop
    if pode(p_pessoa, r.id::uuid, 'console.chamados.ver') then
      perform entrar_condominio(p_pessoa, r.id::uuid, 'console.chamados.ver');
      v_saida := v_saida || coalesce((
        select jsonb_agg(resumo_chamado(c, true) || jsonb_build_object('condominio', (select nome from condominios where id = c.condominio_id)))
          from chamados c
         where case v_filtro when 'ABERTOS' then c.situacao in ('NOVO', 'ANDAMENTO')
                             when 'ESPERANDO_CLIENTE' then c.situacao = 'ESPERANDO_CLIENTE'
                             when 'RESOLVIDOS' then c.situacao = 'RESOLVIDO' and c.resolvido_em >= app_now() - interval '60 days'
                             else c.situacao <> 'RESOLVIDO' or c.resolvido_em >= app_now() - interval '60 days' end), '[]'::jsonb);
    end if;
  end loop;
  return (select coalesce(jsonb_agg(x order by x ->> 'situacao' <> 'NOVO', x ->> 'atualizadoEm' desc), '[]'::jsonb)
            from jsonb_array_elements(v_saida) x);
end $$;

create function console_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c chamados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.chamados.ver');
  c := exigir_chamado(p_id);
  return resumo_chamado(c, true) || jsonb_build_object(
    'condominio', (select nome from condominios where id = c.condominio_id),
    'mensagens', mensagens_do_chamado(c.id, true),
    'arquivos', arquivos_do_chamado(c.id),
    'equipe', equipe_do_cliente(),
    'pode', jsonb_build_object(
      'responder', pode(p_pessoa, p_condominio, 'console.chamados.responder') and c.situacao <> 'RESOLVIDO',
      'notaInterna', pode(p_pessoa, p_condominio, 'console.chamados.responder'),
      'atualizar', pode(p_pessoa, p_condominio, 'console.chamados.responder'),
      'pedirAcesso', pode(p_pessoa, p_condominio, 'console.acesso_excepcional.pedir')));
end $$;

create function console_responder_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_texto text, p_interna boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_interna boolean := coalesce(p_interna, false);
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.chamados.responder');
  c := exigir_chamado(p_id);
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Resposta de 2 a 4.000 caracteres', 'texto'); end if;
  if not v_interna and c.situacao = 'RESOLVIDO' then
    perform recusar_motivo('O chamado está resolvido; o cliente reabre respondendo', 'JA_RESOLVIDO');
  end if;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, interna, texto)
  values (p_condominio, c.id, p_pessoa, 'TRIADE', v_interna, v_texto);
  if not v_interna then
    update chamados
       set situacao = case when situacao = 'NOVO' then 'ANDAMENTO' else situacao end,
           responsavel_id = coalesce(responsavel_id, p_pessoa), atualizado_em = app_now()
     where id = c.id;
    insert into avisos_triade (condominio_id, pessoa_id, tipo, chamado_id) values (p_condominio, c.aberto_por, 'CHAMADO_RESPOSTA', c.id);
  else
    perform registrar_historico_interno('chamado.nota_interna', 'chamado', c.id::text, '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function console_atualizar_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_situacao text,
                                          p_responsavel uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.chamados.responder');
  c := exigir_chamado(p_id);
  if p_situacao is null or p_situacao not in ('NOVO', 'ANDAMENTO', 'ESPERANDO_CLIENTE', 'RESOLVIDO') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  if p_responsavel is not null and not eh_equipe_do_cliente(p_responsavel) then
    perform recusar_campos('O responsável precisa ser da equipe atribuída ao cliente', 'responsavel');
  end if;
  update chamados
     set situacao = p_situacao, responsavel_id = p_responsavel,
         resolvido_em = case when p_situacao = 'RESOLVIDO' then coalesce(case when c.situacao = 'RESOLVIDO' then c.resolvido_em end, app_now()) end,
         atualizado_em = app_now()
   where id = c.id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('chamados', c.id); end if;
  if p_situacao is distinct from c.situacao then
    perform registrar_historico('chamado.situacao', 'chamado', c.id::text, jsonb_build_object('de', c.situacao, 'para', p_situacao));
  end if;
  return v_versao;
end $$;

create function console_abrir_arquivo_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_chamado;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.chamados.ver');
  select * into a from arquivos_chamado where id = p_arquivo and chamado_id = p_id;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Números do menu do Console.
create function console_contagens(p_pessoa uuid) returns jsonb
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
    end if;
  end loop;
  return jsonb_build_object('carteira', v_carteira, 'implantacoes', v_implantacoes, 'chamados', v_chamados, 'suporteAcesso', v_suporte);
end $$;

-- ---------------------------------------------------------------------------------------
-- Início e sino: avisos da TRÍADE e os pedidos de acesso excepcional esperando o síndico.

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
    'avisosNaoVistos', (select count(*) from avisos a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_manutencao a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_email a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_pedido_documento a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_prestador a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_memoria a where a.pessoa_id = p_pessoa and a.visto_em is null)
                       + (select count(*) from avisos_triade a where a.pessoa_id = p_pessoa and a.visto_em is null)))
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
           where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (select count(*) from avisos where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_manutencao where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_email where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_pedido_documento where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_prestador where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_memoria where pessoa_id = p_pessoa and visto_em is null)
               + (select count(*) from avisos_triade where pessoa_id = p_pessoa and visto_em is null));
end $$;

create or replace function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer; v_m integer; v_d integer; v_e integer; v_p integer; v_r integer; v_x integer; v_t integer;
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
  return v_n + v_m + v_d + v_e + v_p + v_r + v_x + v_t;
end $$;


call fechar_acesso();

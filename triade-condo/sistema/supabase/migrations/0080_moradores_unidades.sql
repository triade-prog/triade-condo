-- 0080 · Moradores e unidades na Plataforma do síndico (passo 3; MU-01, MU-02, MU-03, MU-04,
-- MU-07, MU-08, PT-11)
--
-- Regras desta parte:
-- 1. O prédio tem blocos (torres, quadras...) opcionais e unidades. Bloco e unidade não se
--    apagam: são desativados, e só quando não têm nada ativo dentro.
-- 2. Contato é quem fala pela unidade (morador, proprietário, inquilino...). Não tem login: o
--    morador usa só o WhatsApp (V-07). O cadastro é breve (MU-01): nome e telefone. CPF não
--    entra, porque nenhum recurso do sistema precisa dele ainda (PT-11).
-- 3. O vínculo do contato com a unidade (contatos_unidade) nasce pendente ou confirmado. Só o
--    vínculo confirmado pelo síndico vale para alguma coisa (MU-02); o que vem de planilha
--    nasce pendente. Um contato pode estar em mais de uma unidade, e uma unidade tem vários
--    contatos, um deles o principal (MU-08).
-- 4. Telefone sozinho não prova identidade (MU-03): o mesmo número pode estar em mais de um
--    contato (casal, família), e a tela avisa; número que mudou de dono se resolve encerrando
--    o vínculo antigo. Quem procura pelo telefone (o WhatsApp, no passo 5) só acha vínculos
--    confirmados e recebe todos, para perguntar qual unidade quando houver mais de uma.
-- 5. Mudança (MU-07): encerra os vínculos de quem sai e cria os de quem entra, de uma vez.
--    Vínculo encerrado não volta e não muda; a autoria fica.
-- 6. Contato sem nenhum vínculo ativo pode ter os dados pessoais removidos (PT-11): o
--    registro fica, sem nome nem telefone, para o histórico continuar coerente.
-- 7. Por ora, moradores e unidades ficam com o síndico. Dar isso a uma pessoa autorizada
--    exige uma permissão nova no CF-03; vínculo criado por quem não pode confirmar nasce
--    pendente.

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'moradores.ver'),
  ('SINDICO', 'moradores.editar'),
  ('SINDICO', 'moradores.confirmar');

-- ---------------------------------------------------------------------------------------
-- Blocos e unidades.

create table blocos (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 1 and 40),
  ordem         smallint not null default 1 check (ordem between 1 and 500),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  unique (id, condominio_id)
);
create unique index blocos_nome_ativo on blocos (condominio_id, lower(btrim(nome))) where ativo;
call proteger_tabela_condominio('blocos');
create trigger blocos_sem_exclusao before delete on blocos for each row execute function somente_insercao();

-- Identificação livre: "101", "Casa 12", "Loja 3". Única entre as ativas do mesmo bloco.
create table unidades (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  bloco_id      uuid,
  identificacao text not null check (length(btrim(identificacao)) between 1 and 20),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  foreign key (bloco_id, condominio_id) references blocos (id, condominio_id),
  unique (id, condominio_id)
);
create unique index unidades_identificacao_ativa on unidades
  (condominio_id, coalesce(bloco_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(identificacao))) where ativa;
call proteger_tabela_condominio('unidades');
create trigger unidades_sem_exclusao before delete on unidades for each row execute function somente_insercao();

-- Ordem natural: "2" antes de "10", "Casa 2" antes de "Casa 10".
create function chave_unidade(p text) returns text
language sql immutable
set search_path = public
as $$
  select lower(coalesce(substring(btrim(p) from '^\D*'), '')) || lpad(coalesce(substring(btrim(p) from '\d{1,12}'), ''), 12, '0')
         || lower(btrim(p))
$$;

-- ---------------------------------------------------------------------------------------
-- Contatos (MU-01, MU-03, PT-11).

-- Telefone em formato internacional: +5561999991234. A tela normaliza o que a pessoa digita.
create function telefone_valido(p text) returns boolean
language sql immutable
set search_path = public
as $$ select p ~ '^\+[1-9][0-9]{9,14}$' $$;

create table contatos (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  nome                text check (length(btrim(nome)) between 1 and 120),
  telefone            text check (telefone_valido(telefone)),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid references pessoas (id),
  dados_removidos_em  timestamptz,
  dados_removidos_por uuid references pessoas (id),
  versao              integer not null default 1,
  unique (id, condominio_id),
  check ((dados_removidos_em is null) = (dados_removidos_por is null)),
  check (case when dados_removidos_em is null then nome is not null and telefone is not null
              else nome is null and telefone is null end)
);
create index contatos_telefone on contatos (condominio_id, telefone) where telefone is not null;
call proteger_tabela_condominio('contatos');
create trigger contatos_sem_exclusao before delete on contatos for each row execute function somente_insercao();

create function contatos_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.dados_removidos_em is not null then
    raise exception 'Os dados deste contato foram removidos' using errcode = 'TC422', detail = '{"motivo":"CONTATO_REMOVIDO"}';
  end if;
  if (new.condominio_id, new.criado_em, new.criado_por) is distinct from (old.condominio_id, old.criado_em, old.criado_por) then
    raise exception 'Contato não muda de condomínio nem de autoria' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger contatos_regras before update on contatos for each row execute function contatos_regras();

-- ---------------------------------------------------------------------------------------
-- Vínculo do contato com a unidade (MU-02, MU-07, MU-08).

create table contatos_unidade (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  contato_id          uuid not null,
  unidade_id          uuid not null,
  relacao             text not null check (relacao in ('PROPRIETARIO', 'INQUILINO', 'MORADOR', 'FAMILIAR', 'OUTRO')),
  principal           boolean not null default false,
  recebe_comunicados  boolean not null default true,
  estado              text not null,
  origem              text not null check (origem in ('PAINEL', 'PLANILHA')),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid references pessoas (id),
  confirmado_em       timestamptz,
  confirmado_por      uuid references pessoas (id),
  encerrado_em        timestamptz,
  encerrado_por       uuid references pessoas (id),
  motivo_encerramento text check (motivo_encerramento in ('MUDANCA', 'CORRECAO', 'PEDIDO', 'RECUSADO')),
  data_saida          date check (data_saida between date '2000-01-01' and date '2100-12-31'),
  versao              integer not null default 1,
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check (estado in ('PENDENTE', 'CONFIRMADO', 'ENCERRADO')),
  check ((confirmado_em is null) = (confirmado_por is null)),
  check (estado <> 'CONFIRMADO' or confirmado_em is not null),
  check (estado <> 'PENDENTE' or confirmado_em is null),
  check ((estado = 'ENCERRADO') = (encerrado_em is not null)),
  check ((encerrado_em is null) = (encerrado_por is null) and (encerrado_em is null) = (motivo_encerramento is null)),
  check (data_saida is null or motivo_encerramento = 'MUDANCA'),
  check ((motivo_encerramento = 'RECUSADO') is not true or confirmado_em is null)
);
create unique index contatos_unidade_ativo on contatos_unidade (contato_id, unidade_id) where estado <> 'ENCERRADO';
create unique index contatos_unidade_principal on contatos_unidade (unidade_id) where principal and estado <> 'ENCERRADO';
create index contatos_unidade_unidade on contatos_unidade (unidade_id);
create index contatos_unidade_contato on contatos_unidade (contato_id);
call proteger_tabela_condominio('contatos_unidade');
call ligar_guardiao('contatos_unidade');
insert into estados_iniciais (tabela, estado) values ('contatos_unidade', 'PENDENTE'), ('contatos_unidade', 'CONFIRMADO');
insert into transicoes_permitidas (tabela, de, para) values
  ('contatos_unidade', 'PENDENTE', 'CONFIRMADO'),
  ('contatos_unidade', 'PENDENTE', 'ENCERRADO'),
  ('contatos_unidade', 'CONFIRMADO', 'ENCERRADO');
create trigger contatos_unidade_sem_exclusao before delete on contatos_unidade for each row execute function somente_insercao();

create function contatos_unidade_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from unidades where id = new.unidade_id and ativa) then
      raise exception 'Unidade desativada' using errcode = 'TC422', detail = '{"motivo":"UNIDADE_INATIVA"}';
    end if;
    if exists (select 1 from contatos where id = new.contato_id and dados_removidos_em is not null) then
      raise exception 'Os dados deste contato foram removidos' using errcode = 'TC422', detail = '{"motivo":"CONTATO_REMOVIDO"}';
    end if;
  elsif old.estado = 'ENCERRADO' then
    raise exception 'Vínculo encerrado não muda' using errcode = 'TC422', detail = '{"motivo":"VINCULO_ENCERRADO"}';
  elsif (new.condominio_id, new.contato_id, new.unidade_id, new.origem, new.criado_em, new.criado_por)
        is distinct from (old.condominio_id, old.contato_id, old.unidade_id, old.origem, old.criado_em, old.criado_por) then
    raise exception 'Vínculo não muda de contato nem de unidade: encerre e crie outro' using errcode = 'TC422';
  end if;
  if new.estado = 'ENCERRADO' then
    new.principal := false;
  end if;
  return new;
end $$;
create trigger contatos_unidade_regras before insert or update on contatos_unidade
  for each row execute function contatos_unidade_regras();

-- Quem fala pela unidade, a partir do telefone (MU-02, MU-03). Só vínculos confirmados de
-- unidades ativas; pendente, encerrado ou número desconhecido não acham nada. Pode voltar
-- mais de uma linha (telefone compartilhado ou contato em várias unidades): quem chama
-- pergunta qual, sem nunca revelar nomes nem a existência de moradores.
create function unidades_do_telefone(p_condominio uuid, p_telefone text) returns table (contato_id uuid, unidade_id uuid)
language sql stable
set search_path = public
as $$
  select cu.contato_id, cu.unidade_id
    from contatos_unidade cu
    join contatos ct on ct.id = cu.contato_id
    join unidades u on u.id = cu.unidade_id and u.ativa
   where cu.condominio_id = p_condominio and cu.estado = 'CONFIRMADO' and ct.telefone = p_telefone
   order by cu.unidade_id, cu.contato_id
$$;

-- O mesmo telefone em outro contato com vínculo ativo (MU-03): a tela avisa, não bloqueia.
create function telefone_compartilhado(p_contato uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from contatos a join contatos b on b.condominio_id = a.condominio_id and b.telefone = a.telefone and b.id <> a.id
     where a.id = p_contato
       and exists (select 1 from contatos_unidade cu where cu.contato_id = b.id and cu.estado <> 'ENCERRADO'))
$$;

-- ---------------------------------------------------------------------------------------
-- Ajudantes das funções da API (o contexto já é o condomínio).

create function exigir_unidade(p_unidade uuid) returns unidades
language plpgsql
set search_path = public
as $$
declare v unidades;
begin
  select * into v from unidades where id = p_unidade and condominio_id = contexto_condominio();
  if not found then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
  return v;
end $$;

create function exigir_relacao(p text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p is null or p not in ('PROPRIETARIO', 'INQUILINO', 'MORADOR', 'FAMILIAR', 'OUTRO') then
    perform recusar_campos('Relação com a unidade desconhecida', 'relacao');
  end if;
end $$;

create function criar_contato(p_nome text, p_telefone text, p_autor uuid) returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then perform recusar_campos('Nome entre 1 e 120 caracteres', 'nome'); end if;
  if not coalesce(telefone_valido(p_telefone), false) then perform recusar_campos('Telefone inválido', 'telefone'); end if;
  insert into contatos (condominio_id, nome, telefone, criado_por)
  values (contexto_condominio(), btrim(p_nome), p_telefone, p_autor) returning id into v_id;
  perform registrar_historico('contato.criado', 'contato', v_id::text);
  return v_id;
end $$;

-- Liga o contato à unidade. Principal: o anterior deixa de ser (um por unidade).
create function ligar_contato_unidade(p_contato uuid, p_unidade uuid, p_relacao text, p_principal boolean, p_recebe boolean,
                                      p_estado text, p_origem text, p_autor uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  perform exigir_relacao(p_relacao);
  if coalesce(p_principal, false) then
    update contatos_unidade set principal = false where unidade_id = p_unidade and principal and estado <> 'ENCERRADO';
  end if;
  perform definir_transicao(case p_estado when 'CONFIRMADO' then 'CONTATO_CONFIRMADO' else 'CONTATO_INCLUIDO' end);
  begin
    insert into contatos_unidade (condominio_id, contato_id, unidade_id, relacao, principal, recebe_comunicados, estado, origem,
                                  criado_por, confirmado_em, confirmado_por)
    values (contexto_condominio(), p_contato, p_unidade, p_relacao, coalesce(p_principal, false), coalesce(p_recebe, true),
            p_estado, p_origem, p_autor,
            case when p_estado = 'CONFIRMADO' then app_now() end, case when p_estado = 'CONFIRMADO' then p_autor end)
    returning id into v_id;
  exception when unique_violation then
    perform recusar_motivo('Este contato já está nesta unidade', 'CONTATO_JA_NA_UNIDADE');
  end;
  return v_id;
end $$;

-- Encerra um vínculo ativo, seguindo a versão lida (AT-24).
create function encerrar_contato_unidade(p_id uuid, p_versao integer, p_motivo text, p_data_saida date, p_autor uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_versao integer;
begin
  perform definir_transicao(case p_motivo when 'RECUSADO' then 'CONTATO_RECUSADO' else 'VINCULO_ENCERRADO' end, p_motivo);
  update contatos_unidade
     set estado = 'ENCERRADO', encerrado_em = app_now(), encerrado_por = p_autor, motivo_encerramento = p_motivo,
         data_saida = case when p_motivo = 'MUDANCA' then p_data_saida end
   where id = p_id and versao = p_versao and estado <> 'ENCERRADO'
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos_unidade', p_id); end if;
end $$;

-- Lista [{id, versao}] vinda da API.
create function itens_com_versao_validos(p jsonb, p_max integer) returns boolean
language sql immutable
set search_path = public
as $$
  select p is not null and jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= p_max
     and not exists (select 1 from jsonb_array_elements(p) x
                      where jsonb_typeof(x) <> 'object'
                         or coalesce(x ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         or jsonb_typeof(x -> 'versao') <> 'number' or (x ->> 'versao') !~ '^[1-9][0-9]{0,8}$')
     and (select count(distinct x ->> 'id') from jsonb_array_elements(p) x) = jsonb_array_length(p)
$$;

-- Hoje no fuso do condomínio do contexto.
create function hoje_no_condominio() returns date
language sql stable
set search_path = public
as $$ select (app_now() at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date $$;

-- Resumo para o painel e para a lista de unidades.
create function resumo_moradores(p_condominio uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'unidades', (select count(*) from unidades u where u.condominio_id = p_condominio and u.ativa),
    'semContato', (select count(*) from unidades u where u.condominio_id = p_condominio and u.ativa
                     and not exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'CONFIRMADO')),
    'aConfirmar', (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa
                    where cu.condominio_id = p_condominio and cu.estado = 'PENDENTE'))
$$;

-- ---------------------------------------------------------------------------------------
-- Funções da API da Plataforma (security definer). Pessoa e condomínio vêm da sessão.

-- O painel ganha o resumo de moradores para quem pode ver.
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
    'moradores', case when pode(p_pessoa, c.id, 'moradores.ver') then resumo_moradores(c.id) end))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

-- Blocos e unidades, com quantos contatos cada unidade tem (MU-08).
create function plataforma_unidades(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  return jsonb_build_object(
    'blocos', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'ordem', b.ordem, 'ativo', b.ativo, 'versao', b.versao)
                                         order by b.ativo desc, b.ordem, lower(b.nome)) from blocos b), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', u.id, 'blocoId', u.bloco_id, 'identificacao', u.identificacao, 'ativa', u.ativa, 'versao', u.versao,
               'confirmados', (select count(*) from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'CONFIRMADO'),
               'pendentes', (select count(*) from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'PENDENTE'),
               'principal', (select ct.nome from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                              where cu.unidade_id = u.id and cu.principal and cu.estado <> 'ENCERRADO'))
             order by u.ativa desc, b.ordem nulls first, lower(b.nome) nulls first, chave_unidade(u.identificacao))
        from unidades u left join blocos b on b.id = u.bloco_id), '[]'::jsonb),
    'resumo', resumo_moradores(p_condominio),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'));
end $$;

-- Uma unidade com os contatos ativos e os que já saíram (MU-07, MU-08).
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_u unidades;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  v_u := exigir_unidade(p_unidade);
  return jsonb_build_object(
    'unidade', jsonb_build_object('id', v_u.id, 'identificacao', v_u.identificacao, 'blocoId', v_u.bloco_id,
                                  'bloco', (select nome from blocos where id = v_u.bloco_id), 'ativa', v_u.ativa, 'versao', v_u.versao),
    'contatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', cu.id, 'contatoId', ct.id, 'nome', ct.nome, 'telefone', ct.telefone, 'contatoVersao', ct.versao,
               'relacao', cu.relacao, 'principal', cu.principal, 'recebeComunicados', cu.recebe_comunicados,
               'estado', cu.estado, 'origem', cu.origem, 'desde', coalesce(cu.confirmado_em, cu.criado_em), 'versao', cu.versao,
               'telefoneCompartilhado', telefone_compartilhado(ct.id),
               'outrasUnidades', coalesce((
                 select jsonb_agg(concat_ws(' · ', b2.nome, u2.identificacao) order by chave_unidade(u2.identificacao))
                   from contatos_unidade c2 join unidades u2 on u2.id = c2.unidade_id left join blocos b2 on b2.id = u2.bloco_id
                  where c2.contato_id = ct.id and c2.unidade_id <> v_u.id and c2.estado <> 'ENCERRADO'), '[]'::jsonb))
             order by cu.estado = 'PENDENTE', cu.principal desc, lower(ct.nome))
        from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
       where cu.unidade_id = v_u.id and cu.estado <> 'ENCERRADO'), '[]'::jsonb),
    'anteriores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', cu.id, 'contatoId', ct.id, 'nome', ct.nome, 'relacao', cu.relacao, 'motivo', cu.motivo_encerramento,
               'dataSaida', to_char(cu.data_saida, 'YYYY-MM-DD'), 'encerradoEm', cu.encerrado_em,
               'dadosRemovidos', ct.dados_removidos_em is not null, 'contatoVersao', ct.versao,
               'semVinculoAtivo', not exists (select 1 from contatos_unidade c3 where c3.contato_id = ct.id and c3.estado <> 'ENCERRADO'))
             order by cu.encerrado_em desc)
        from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
       where cu.unidade_id = v_u.id and cu.estado = 'ENCERRADO'), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'));
end $$;

-- Criar ou alterar um bloco. Desativar só sem unidade ativa dentro.
create function plataforma_salvar_bloco(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                        p_ordem integer, p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes blocos;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_ordem is not null and p_ordem not between 1 and 500 then perform recusar_campos('Ordem entre 1 e 500', 'ordem'); end if;
  begin
    if p_id is null then
      insert into blocos (condominio_id, nome, ordem)
      values (p_condominio, btrim(p_nome), coalesce(p_ordem, (select coalesce(max(ordem), 0) + 1 from blocos)))
      returning id, versao into v_id, v_versao;
      perform registrar_historico('bloco.criado', 'bloco', v_id::text);
    else
      select * into v_antes from blocos where id = p_id;
      if not found then raise exception 'Bloco não encontrado' using errcode = 'TC404'; end if;
      if v_antes.ativo and not coalesce(p_ativo, true)
         and exists (select 1 from unidades where bloco_id = p_id and ativa) then
        perform recusar_motivo('Desative ou mude de bloco as unidades antes', 'BLOCO_COM_UNIDADES');
      end if;
      update blocos set nome = btrim(p_nome), ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('blocos', p_id); end if;
      perform registrar_historico('bloco.alterado', 'bloco', v_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.nome is distinct from btrim(p_nome) then 'nome_do_bloco' end,
        case when p_ordem is not null and v_antes.ordem is distinct from p_ordem::smallint then 'ordem' end,
        case when p_ativo is not null and v_antes.ativo is distinct from p_ativo then 'ativo' end], null))));
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe um bloco ativo com este nome', 'NOME_REPETIDO');
    when check_violation or not_null_violation then perform recusar_campos('Nome até 40 caracteres e ordem entre 1 e 500', 'nome', 'ordem');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Incluir uma ou várias unidades num bloco (ou sem bloco). As que já existem ativas ficam
-- como estão e voltam na resposta.
create function plataforma_incluir_unidades(p_pessoa uuid, p_condominio uuid, p_bloco uuid, p_identificacoes text[]) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existentes text[];
  v_criadas integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_identificacoes is null or cardinality(p_identificacoes) not between 1 and 1000
     or exists (select 1 from unnest(p_identificacoes) x where length(btrim(coalesce(x, ''))) not between 1 and 20) then
    perform recusar_campos('De 1 a 1000 unidades, cada uma com até 20 caracteres', 'identificacoes');
  end if;
  if p_bloco is not null and not exists (select 1 from blocos where id = p_bloco and ativo) then
    perform recusar_campos('Bloco não encontrado ou desativado', 'blocoId');
  end if;
  select coalesce(array_agg(u.identificacao order by chave_unidade(u.identificacao)), '{}') into v_existentes
    from unidades u
   where u.ativa and u.bloco_id is not distinct from p_bloco
     and lower(btrim(u.identificacao)) in (select lower(btrim(x)) from unnest(p_identificacoes) x);
  insert into unidades (condominio_id, bloco_id, identificacao)
  select p_condominio, p_bloco, min(btrim(x)) from unnest(p_identificacoes) x
   where lower(btrim(x)) not in (select lower(btrim(e)) from unnest(v_existentes) e)
   group by lower(btrim(x));
  get diagnostics v_criadas = row_count;
  if v_criadas > 0 then
    perform registrar_historico('unidades.incluidas', 'bloco', coalesce(p_bloco::text, 'sem_bloco'), jsonb_build_object('quantidade', v_criadas));
  end if;
  return jsonb_build_object('criadas', v_criadas, 'jaExistiam', to_jsonb(v_existentes));
end $$;

-- Renomear, mudar de bloco ou desativar uma unidade (desativar só sem contato ativo).
create function plataforma_alterar_unidade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_identificacao text,
                                           p_bloco uuid, p_ativa boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes unidades;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  v_antes := exigir_unidade(p_id);
  if p_bloco is not null and p_bloco is distinct from v_antes.bloco_id and not exists (select 1 from blocos where id = p_bloco and ativo) then
    perform recusar_campos('Bloco não encontrado ou desativado', 'blocoId');
  end if;
  if v_antes.ativa and not coalesce(p_ativa, true)
     and exists (select 1 from contatos_unidade where unidade_id = p_id and estado <> 'ENCERRADO') then
    perform recusar_motivo('Encerre os contatos da unidade antes de desativar', 'UNIDADE_COM_CONTATOS');
  end if;
  begin
    update unidades set identificacao = btrim(p_identificacao), bloco_id = p_bloco, ativa = coalesce(p_ativa, ativa)
     where id = p_id and versao = p_versao returning versao into v_versao;
  exception
    when unique_violation then perform recusar_motivo('Já existe uma unidade ativa com esta identificação no bloco', 'UNIDADE_REPETIDA');
    when check_violation or not_null_violation then perform recusar_campos('Identificação até 20 caracteres', 'identificacao');
  end;
  if v_versao is null then perform conflito_versao('unidades', p_id); end if;
  perform registrar_historico('unidade.alterada', 'unidade', p_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
    case when v_antes.identificacao is distinct from btrim(p_identificacao) then 'identificacao' end,
    case when v_antes.bloco_id is distinct from p_bloco then 'bloco' end,
    case when p_ativa is not null and v_antes.ativa is distinct from p_ativa then 'ativa' end], null))));
  return v_versao;
end $$;

-- Incluir um contato na unidade (MU-01, MU-08): contato novo (nome e telefone) ou um que já
-- existe no condomínio (a mesma pessoa em outra unidade). Quem pode confirmar inclui já
-- confirmado; os outros deixam pendente para o síndico (MU-02).
create function plataforma_incluir_contato(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_nome text,
                                           p_telefone text, p_relacao text, p_principal boolean, p_recebe boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contato uuid := p_contato;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if not (exigir_unidade(p_unidade)).ativa then perform recusar_motivo('Unidade desativada', 'UNIDADE_INATIVA'); end if;
  if v_contato is null then
    v_contato := criar_contato(p_nome, p_telefone, p_pessoa);
  elsif not exists (select 1 from contatos where id = v_contato) then
    raise exception 'Contato não encontrado' using errcode = 'TC404';
  end if;
  v_id := ligar_contato_unidade(v_contato, p_unidade, p_relacao, p_principal, p_recebe,
            case when pode(p_pessoa, p_condominio, 'moradores.confirmar') then 'CONFIRMADO' else 'PENDENTE' end, 'PAINEL', p_pessoa);
  return jsonb_build_object('vinculoId', v_id, 'contatoId', v_contato,
    'avisos', case when telefone_compartilhado(v_contato) then '["TELEFONE_COMPARTILHADO"]'::jsonb else '[]'::jsonb end);
end $$;

-- Corrigir nome ou telefone do contato (vale para todas as unidades dele).
create function plataforma_alterar_contato(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer, p_nome text,
                                           p_telefone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes contatos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into v_antes from contatos where id = p_contato;
  if not found then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then perform recusar_campos('Nome entre 1 e 120 caracteres', 'nome'); end if;
  if not coalesce(telefone_valido(p_telefone), false) then perform recusar_campos('Telefone inválido', 'telefone'); end if;
  update contatos set nome = btrim(p_nome), telefone = p_telefone where id = p_contato and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
  perform registrar_historico('contato.alterado', 'contato', p_contato::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
    case when v_antes.nome is distinct from btrim(p_nome) then 'nome_do_contato' end,
    case when v_antes.telefone is distinct from p_telefone then 'numero' end], null))));
  return jsonb_build_object('versao', v_versao,
    'avisos', case when telefone_compartilhado(p_contato) then '["TELEFONE_COMPARTILHADO"]'::jsonb else '[]'::jsonb end);
end $$;

-- Relação, principal e preferência de comunicados de um vínculo (MU-08).
create function plataforma_alterar_vinculo_unidade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_relacao text,
                                                   p_principal boolean, p_recebe boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes contatos_unidade;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into v_antes from contatos_unidade where id = p_id and estado <> 'ENCERRADO';
  if not found then raise exception 'Vínculo não encontrado' using errcode = 'TC404'; end if;
  perform exigir_relacao(p_relacao);
  if coalesce(p_principal, false) and not v_antes.principal then
    update contatos_unidade set principal = false where unidade_id = v_antes.unidade_id and principal and estado <> 'ENCERRADO';
  end if;
  update contatos_unidade set relacao = p_relacao, principal = coalesce(p_principal, false), recebe_comunicados = coalesce(p_recebe, true)
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos_unidade', p_id); end if;
  perform registrar_historico('vinculo_unidade.alterado', 'contato_unidade', p_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
    case when v_antes.relacao is distinct from p_relacao then 'relacao' end,
    case when v_antes.principal is distinct from coalesce(p_principal, false) then 'principal' end,
    case when v_antes.recebe_comunicados is distinct from coalesce(p_recebe, true) then 'recebe_comunicados' end], null))));
  return v_versao;
end $$;

-- Confirmar vínculos pendentes (MU-02), um ou vários, todos ou nenhum.
-- p_itens: [{"id": "...", "versao": 1}, ...]
create function plataforma_confirmar_contatos(p_pessoa uuid, p_condominio uuid, p_itens jsonb) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_id uuid;
  v_total integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.confirmar');
  if not itens_com_versao_validos(p_itens, 2000) or jsonb_array_length(p_itens) = 0 then
    perform recusar_campos('Lista de contatos inválida', 'itens');
  end if;
  perform definir_transicao('CONTATO_CONFIRMADO');
  for r in select (x ->> 'id')::uuid as id, (x ->> 'versao')::int as versao from jsonb_array_elements(p_itens) x loop
    update contatos_unidade set estado = 'CONFIRMADO', confirmado_em = app_now(), confirmado_por = p_pessoa
     where id = r.id and versao = r.versao and estado = 'PENDENTE' returning id into v_id;
    if v_id is null then
      if exists (select 1 from contatos_unidade where id = r.id and versao = r.versao) then
        perform recusar_motivo('Só vínculo pendente se confirma', 'NAO_PENDENTE');
      end if;
      perform conflito_versao('contatos_unidade', r.id);
    end if;
    v_total := v_total + 1;
    v_id := null;
  end loop;
  return v_total;
end $$;

-- Encerrar um vínculo: recusar o pendente (MU-02) ou tirar o confirmado por mudança, correção
-- ou pedido do morador (MU-07). Recusar é parte de confirmar; tirar é parte de editar.
create function plataforma_encerrar_vinculo_unidade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text,
                                                    p_data_saida date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_estado text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  select estado into v_estado from contatos_unidade where id = p_id;
  if v_estado is null then raise exception 'Vínculo não encontrado' using errcode = 'TC404'; end if;
  if v_estado = 'ENCERRADO' then perform recusar_motivo('Vínculo já encerrado', 'VINCULO_ENCERRADO'); end if;
  if v_estado = 'PENDENTE' then
    -- Pendente nunca valeu: não sai por mudança, é recusado.
    if p_motivo is distinct from 'RECUSADO' then
      perform recusar_motivo('Contato pendente se recusa, não se encerra', 'PENDENTE_SE_RECUSA');
    end if;
    perform entrar_condominio(p_pessoa, p_condominio, 'moradores.confirmar');
  else
    perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
    if p_motivo is null or p_motivo not in ('MUDANCA', 'CORRECAO', 'PEDIDO') then
      perform recusar_campos('Motivo desconhecido', 'motivo');
    end if;
  end if;
  perform encerrar_contato_unidade(p_id, p_versao, p_motivo, coalesce(p_data_saida, hoje_no_condominio()), p_pessoa);
end $$;

-- Mudança (MU-07): quem sai e quem entra, numa só operação.
-- p_saem: [{"id": "<vínculo>", "versao": 1}]
-- p_entram: [{"nome": "...", "telefone": "+55...", "relacao": "INQUILINO", "principal": true, "recebeComunicados": true}]
create function plataforma_registrar_mudanca(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_data date, p_saem jsonb, p_entram jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_contato uuid;
  v_estado text;
  v_entram integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if not (exigir_unidade(p_unidade)).ativa then perform recusar_motivo('Unidade desativada', 'UNIDADE_INATIVA'); end if;
  if p_data is null or p_data not between date '2000-01-01' and date '2100-12-31' then perform recusar_campos('Data da mudança inválida', 'data'); end if;
  if not itens_com_versao_validos(p_saem, 50) then perform recusar_campos('Lista de quem sai inválida', 'saem'); end if;
  if p_entram is null or jsonb_typeof(p_entram) <> 'array' or jsonb_array_length(p_entram) > 20
     or exists (select 1 from jsonb_array_elements(p_entram) x where jsonb_typeof(x) <> 'object') then
    perform recusar_campos('Lista de quem entra inválida', 'entram');
  end if;
  if jsonb_array_length(p_saem) + jsonb_array_length(p_entram) = 0 then
    perform recusar_motivo('Diga quem sai ou quem entra', 'MUDANCA_VAZIA');
  end if;
  if (select count(*) from jsonb_array_elements(p_entram) x where (x ->> 'principal')::boolean is true) > 1 then
    perform recusar_campos('Só um contato principal', 'entram');
  end if;

  for r in select (x ->> 'id')::uuid as id, (x ->> 'versao')::int as versao from jsonb_array_elements(p_saem) x loop
    if not exists (select 1 from contatos_unidade where id = r.id and unidade_id = p_unidade and estado <> 'ENCERRADO') then
      raise exception 'Vínculo não encontrado nesta unidade' using errcode = 'TC404';
    end if;
    perform encerrar_contato_unidade(r.id, r.versao, 'MUDANCA', p_data, p_pessoa);
  end loop;

  v_estado := case when pode(p_pessoa, p_condominio, 'moradores.confirmar') then 'CONFIRMADO' else 'PENDENTE' end;
  for r in select x, n from jsonb_array_elements(p_entram) with ordinality e(x, n) loop
    if jsonb_typeof(r.x -> 'principal') not in ('boolean', 'null') and r.x ? 'principal'
       or jsonb_typeof(r.x -> 'recebeComunicados') not in ('boolean', 'null') and r.x ? 'recebeComunicados' then
      perform recusar_campos('Preferência inválida', 'entram');
    end if;
    v_contato := criar_contato(r.x ->> 'nome', r.x ->> 'telefone', p_pessoa);
    perform ligar_contato_unidade(v_contato, p_unidade, r.x ->> 'relacao', (r.x ->> 'principal')::boolean,
                                  coalesce((r.x ->> 'recebeComunicados')::boolean, true), v_estado, 'PAINEL', p_pessoa);
    v_entram := v_entram + 1;
  end loop;

  perform registrar_historico('mudanca.registrada', 'unidade', p_unidade::text,
    jsonb_build_object('data', to_char(p_data, 'YYYY-MM-DD'), 'saem', jsonb_array_length(p_saem), 'entram', v_entram));
  return jsonb_build_object('saem', jsonb_array_length(p_saem), 'entram', v_entram);
end $$;

-- Moradores do condomínio, com busca por nome, telefone ou unidade, em páginas de 50.
create function plataforma_moradores(p_pessoa uuid, p_condominio uuid, p_busca text, p_estado text, p_pagina integer) returns jsonb
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
  if p_estado is not null and p_estado not in ('PENDENTE', 'CONFIRMADO') then perform recusar_campos('Situação desconhecida', 'estado'); end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_digitos := nullif(regexp_replace(coalesce(v_busca, ''), '\D', '', 'g'), '');
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with lista as (
    select cu.id, cu.contato_id, ct.nome, ct.telefone, cu.unidade_id, u.identificacao, b.nome as bloco, b.ordem as bloco_ordem,
           cu.relacao, cu.principal, cu.estado, cu.origem, cu.versao
      from contatos_unidade cu
      join contatos ct on ct.id = cu.contato_id
      join unidades u on u.id = cu.unidade_id
      left join blocos b on b.id = u.bloco_id
     where cu.estado <> 'ENCERRADO' and (p_estado is null or cu.estado = p_estado)
       and (v_busca is null
            or ct.nome ilike '%' || v_busca || '%'
            or u.identificacao ilike v_busca || '%'
            or b.nome ilike '%' || v_busca || '%'
            or (length(v_digitos) >= 4 and ct.telefone like '%' || v_digitos || '%'))
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
               'vinculoId', l.id, 'contatoId', l.contato_id, 'nome', l.nome, 'telefone', l.telefone, 'unidadeId', l.unidade_id,
               'unidade', l.identificacao, 'bloco', l.bloco, 'relacao', l.relacao, 'principal', l.principal,
               'estado', l.estado, 'origem', l.origem, 'versao', l.versao) order by l.ordem)
             from (select *, row_number() over (order by bloco_ordem nulls first, lower(bloco) nulls first, chave_unidade(identificacao),
                                                         principal desc, lower(nome)) as ordem from lista) l
            where l.ordem > (v_pagina - 1) * 50 and l.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from lista),
    'pagina', v_pagina,
    'porPagina', 50,
    'aConfirmar', (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa where cu.estado = 'PENDENTE'),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'))
    into v;
  return v;
end $$;

-- Remover os dados pessoais de um contato que não está mais em nenhuma unidade (PT-11).
create function plataforma_remover_dados_contato(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer) returns void
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
  update contatos set nome = null, telefone = null, dados_removidos_em = app_now(), dados_removidos_por = p_pessoa
   where id = p_contato and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
  perform registrar_historico('contato.dados_removidos', 'contato', p_contato::text);
end $$;

-- Importar unidades e contatos de uma planilha (F3.3, PI-04). Tudo ou nada. Blocos e
-- unidades que faltam são criados; o contato com o mesmo nome e telefone é reaproveitado; o
-- vínculo nasce pendente, para o síndico conferir (MU-02); o que já existe é ignorado.
-- p_linhas: [{"bloco": "Torre A" | null, "unidade": "101", "nome": "...", "telefone": "+55...", "relacao": "MORADOR"}]
create function plataforma_importar_moradores(p_pessoa uuid, p_condominio uuid, p_linhas jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_bloco uuid;
  v_unidade uuid;
  v_contato uuid;
  v_blocos integer := 0;
  v_unidades integer := 0;
  v_contatos integer := 0;
  v_vinculos integer := 0;
  v_ignoradas integer := 0;
  v_campos text[];
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) not between 1 and 2000 then
    perform recusar_campos('De 1 a 2000 linhas', 'linhas');
  end if;

  for r in select x, n::int as n from jsonb_array_elements(p_linhas) with ordinality e(x, n) loop
    v_campos := array_remove(array[
      case when jsonb_typeof(r.x) <> 'object' then 'linha' end,
      case when jsonb_typeof(r.x) = 'object' and r.x ? 'bloco' and jsonb_typeof(r.x -> 'bloco') <> 'null'
                and length(btrim(coalesce(r.x ->> 'bloco', ''))) not between 1 and 40 then 'bloco' end,
      case when length(btrim(coalesce(r.x ->> 'unidade', ''))) not between 1 and 20 then 'unidade' end,
      case when length(btrim(coalesce(r.x ->> 'nome', ''))) not between 1 and 120 then 'nome' end,
      case when not coalesce(telefone_valido(r.x ->> 'telefone'), false) then 'telefone' end,
      case when coalesce(r.x ->> 'relacao', 'MORADOR') not in ('PROPRIETARIO', 'INQUILINO', 'MORADOR', 'FAMILIAR', 'OUTRO') then 'relacao' end
    ], null);
    if cardinality(v_campos) > 0 then
      raise exception 'Linha % da planilha com dado inválido', r.n
        using errcode = 'TC422', detail = jsonb_build_object('motivo', 'LINHA_INVALIDA', 'linha', r.n, 'campos', to_jsonb(v_campos))::text;
    end if;

    v_bloco := null;
    if nullif(btrim(coalesce(r.x ->> 'bloco', '')), '') is not null then
      select id into v_bloco from blocos where ativo and lower(btrim(nome)) = lower(btrim(r.x ->> 'bloco'));
      if v_bloco is null then
        insert into blocos (condominio_id, nome, ordem)
        values (p_condominio, btrim(r.x ->> 'bloco'), least((select coalesce(max(ordem), 0) + 1 from blocos), 500))
        returning id into v_bloco;
        v_blocos := v_blocos + 1;
      end if;
    end if;

    select id into v_unidade from unidades
     where ativa and bloco_id is not distinct from v_bloco and lower(btrim(identificacao)) = lower(btrim(r.x ->> 'unidade'));
    if v_unidade is null then
      insert into unidades (condominio_id, bloco_id, identificacao) values (p_condominio, v_bloco, btrim(r.x ->> 'unidade'))
      returning id into v_unidade;
      v_unidades := v_unidades + 1;
    end if;

    select id into v_contato from contatos
     where telefone = r.x ->> 'telefone' and lower(btrim(nome)) = lower(btrim(r.x ->> 'nome'))
     order by criado_em limit 1;
    if v_contato is null then
      insert into contatos (condominio_id, nome, telefone, criado_por)
      values (p_condominio, btrim(r.x ->> 'nome'), r.x ->> 'telefone', p_pessoa) returning id into v_contato;
      v_contatos := v_contatos + 1;
    end if;

    if exists (select 1 from contatos_unidade where contato_id = v_contato and unidade_id = v_unidade and estado <> 'ENCERRADO') then
      v_ignoradas := v_ignoradas + 1;
    else
      perform ligar_contato_unidade(v_contato, v_unidade, coalesce(r.x ->> 'relacao', 'MORADOR'), false, true, 'PENDENTE', 'PLANILHA', p_pessoa);
      v_vinculos := v_vinculos + 1;
    end if;
  end loop;

  perform registrar_historico('moradores.importados', 'condominio', p_condominio::text, jsonb_build_object(
    'linhas', jsonb_array_length(p_linhas), 'blocos', v_blocos, 'unidades', v_unidades, 'contatos', v_contatos,
    'vinculos', v_vinculos, 'ignoradas', v_ignoradas));
  return jsonb_build_object('linhas', jsonb_array_length(p_linhas), 'blocos', v_blocos, 'unidades', v_unidades,
                            'contatos', v_contatos, 'vinculos', v_vinculos, 'ignoradas', v_ignoradas);
end $$;

call fechar_acesso();

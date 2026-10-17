-- 0110 · Vínculo detalhado entre a pessoa e a unidade (passo 3b; MU-10, MU-08, MU-07, MU-11,
-- PT-11). Telas aprovadas pela Carolina em 17/10/2026.
--
-- Regras desta parte:
-- 1. Três marcações independentes no vínculo: proprietário (é dono, more ou não), responsável
--    pela unidade e mora na unidade. O responsável é a coluna principal de antes: continua um
--    só por unidade e é quem o condomínio procura primeiro.
-- 2. Quem não é proprietário diz a ligação: inquilino, familiar ou outro (cedido, procurador,
--    funcionário). Familiar pode dizer o parentesco com o responsável; é opcional e serve só
--    para saber quem fala pela unidade (PT-11).
-- 3. Período de ocupação: ocupa_desde em branco quer dizer que a pessoa sempre ocupou a
--    unidade; com data, ela só vê o que é da unidade a partir dali (a regra vale quando o
--    morador consultar pelo WhatsApp, no passo 5; o síndico vê tudo). data_saida é o "ocupou
--    até", agora para qualquer encerramento menos a recusa. A mudança preenche as duas.
-- 4. A relação de antes (relacao) passa a ser calculada das marcações, e o que já a lê
--    (pedidos, lista de moradores, falta de proprietário) continua igual. Os vínculos que já
--    existem são convertidos sem perder nada e sem data de entrada, e o histórico registra.
-- 5. As funções que recebem a relação de antes continuam valendo (planilha e chamadas
--    antigas), traduzidas para as marcações.

-- ---------------------------------------------------------------------------------------
-- Colunas novas e conversão do que existe.

alter table contatos_unidade
  add column proprietario boolean not null default false,
  add column mora         boolean not null default false,
  add column ligacao      text check (ligacao in ('INQUILINO', 'FAMILIAR', 'OUTRO')),
  add column parentesco   text check (parentesco in ('CONJUGE', 'FILHO', 'PAI_MAE', 'IRMAO', 'OUTRO_PARENTE')),
  add column ocupa_desde  date check (ocupa_desde between date '2000-01-01' and date '2100-12-31');

-- Os encerrados também são convertidos, por isso as regras (vínculo encerrado não muda,
-- versão) ficam desligadas só durante a conversão. Proprietário mora na unidade quando não
-- há inquilino ativo nela; quem era "outro" não mora.
alter table contatos_unidade disable trigger user;
update contatos_unidade cu set
  proprietario = cu.relacao = 'PROPRIETARIO',
  mora = case cu.relacao
           when 'OUTRO' then false
           when 'PROPRIETARIO' then cu.estado = 'ENCERRADO'
             or not exists (select 1 from contatos_unidade i where i.unidade_id = cu.unidade_id and i.relacao = 'INQUILINO' and i.estado <> 'ENCERRADO')
           else true end,
  ligacao = case cu.relacao when 'PROPRIETARIO' then null when 'INQUILINO' then 'INQUILINO' when 'FAMILIAR' then 'FAMILIAR' else 'OUTRO' end;
alter table contatos_unidade enable trigger user;

do $$
declare r record;
begin
  for r in select condominio_id, count(*) as n from contatos_unidade group by condominio_id loop
    perform set_config('app.condominio_id', r.condominio_id::text, true);
    perform registrar_historico('vinculos.convertidos', 'condominio', r.condominio_id::text, jsonb_build_object('quantidade', r.n));
  end loop;
  perform set_config('app.condominio_id', '', true);
end $$;

-- A relação de antes, calculada das marcações.
alter table contatos_unidade drop column relacao;
alter table contatos_unidade add column relacao text generated always as (
  case when proprietario then 'PROPRIETARIO'
       when ligacao = 'INQUILINO' then 'INQUILINO'
       when ligacao = 'FAMILIAR' then 'FAMILIAR'
       when mora then 'MORADOR'
       else 'OUTRO' end) stored;

-- "Ocupou até" para qualquer encerramento menos a recusa (antes, só para mudança).
do $$
declare v text;
begin
  select conname into v from pg_constraint
   where conrelid = 'contatos_unidade'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'data_saida IS NULL\) OR \(motivo_encerramento';
  if v is null then raise exception 'Regra antiga da data de saída não encontrada'; end if;
  execute format('alter table contatos_unidade drop constraint %I', v);
end $$;

alter table contatos_unidade
  add constraint contatos_unidade_saida check (data_saida is null or (motivo_encerramento is not null and motivo_encerramento <> 'RECUSADO')),
  add constraint contatos_unidade_ligacao check (proprietario = (ligacao is null)),
  add constraint contatos_unidade_parentesco check (parentesco is null or ligacao = 'FAMILIAR'),
  add constraint contatos_unidade_periodo check (data_saida is null or ocupa_desde is null or data_saida >= ocupa_desde);

-- ---------------------------------------------------------------------------------------
-- Marcações vindas da API.

create type marcas_vinculo as (proprietario boolean, principal boolean, mora boolean, ligacao text, parentesco text, ocupa_desde date);

-- A relação de antes vira marcações (planilha e chamadas antigas). Desconhecida: null.
create function marcas_da_relacao(p text) returns jsonb
language sql immutable
set search_path = public
as $$
  select case p
    when 'PROPRIETARIO' then '{"proprietario": true, "mora": true, "ligacao": null}'::jsonb
    when 'INQUILINO' then '{"proprietario": false, "mora": true, "ligacao": "INQUILINO"}'::jsonb
    when 'MORADOR' then '{"proprietario": false, "mora": true, "ligacao": "OUTRO"}'::jsonb
    when 'FAMILIAR' then '{"proprietario": false, "mora": true, "ligacao": "FAMILIAR"}'::jsonb
    when 'OUTRO' then '{"proprietario": false, "mora": false, "ligacao": "OUTRO"}'::jsonb
  end
$$;

-- {"proprietario": bool, "principal": bool, "mora": bool, "ligacao": "INQUILINO" | "FAMILIAR" |
--  "OUTRO" | null, "parentesco": "CONJUGE" | ... | null, "ocupaDesde": "2025-03-01" | null}
-- Booleano ausente é falso. Recusa apontando cada campo errado.
create function ler_marcas(p jsonb) returns marcas_vinculo
language plpgsql
set search_path = public
as $$
declare
  v marcas_vinculo;
  v_campos text[] := '{}';
  k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform recusar_campos('Marcações inválidas', 'marcas'); end if;
  foreach k in array array['proprietario', 'principal', 'mora'] loop
    if coalesce(jsonb_typeof(p -> k), 'null') not in ('boolean', 'null') then v_campos := v_campos || k; end if;
  end loop;
  if coalesce(jsonb_typeof(p -> 'ligacao'), 'null') <> 'null' and p ->> 'ligacao' not in ('INQUILINO', 'FAMILIAR', 'OUTRO') then
    v_campos := v_campos || 'ligacao'::text;
  end if;
  if coalesce(jsonb_typeof(p -> 'parentesco'), 'null') <> 'null' and p ->> 'parentesco' not in ('CONJUGE', 'FILHO', 'PAI_MAE', 'IRMAO', 'OUTRO_PARENTE') then
    v_campos := v_campos || 'parentesco'::text;
  end if;
  if coalesce(jsonb_typeof(p -> 'ocupaDesde'), 'null') <> 'null' then
    if jsonb_typeof(p -> 'ocupaDesde') <> 'string' or p ->> 'ocupaDesde' !~ '^\d{4}-\d{2}-\d{2}$' then
      v_campos := v_campos || 'ocupaDesde'::text;
    else
      begin
        v.ocupa_desde := (p ->> 'ocupaDesde')::date;
        if v.ocupa_desde not between date '2000-01-01' and date '2100-12-31' then v_campos := v_campos || 'ocupaDesde'::text; end if;
      exception when others then
        v_campos := v_campos || 'ocupaDesde'::text;
      end;
    end if;
  end if;
  if cardinality(v_campos) > 0 then perform recusar_campos('Marcações inválidas', variadic v_campos); end if;

  v.proprietario := coalesce((p ->> 'proprietario')::boolean, false);
  v.principal := coalesce((p ->> 'principal')::boolean, false);
  v.mora := coalesce((p ->> 'mora')::boolean, false);
  v.ligacao := p ->> 'ligacao';
  v.parentesco := p ->> 'parentesco';
  -- Proprietário não tem ligação; quem não é proprietário diz qual é.
  if v.proprietario and v.ligacao is not null then perform recusar_campos('Proprietário não tem ligação', 'ligacao'); end if;
  if not v.proprietario and v.ligacao is null then perform recusar_campos('Diga a ligação com a unidade', 'ligacao'); end if;
  if v.parentesco is not null and v.ligacao is distinct from 'FAMILIAR' then perform recusar_campos('Parentesco só para familiar', 'parentesco'); end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Ocupação da unidade (MU-10, MU-11). Conta quem está ativo (confirmado ou a confirmar).

-- PROPRIETARIO_MORA, ALUGADA (inquilino mora), CEDIDA (mora alguém que não é dono nem
-- inquilino), VAZIA (tem cadastro, ninguém mora) ou SEM_CADASTRO.
create function ocupacao_unidade(p_unidade uuid) returns text
language sql stable
set search_path = public
as $$
  select case
    when not exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO') then 'SEM_CADASTRO'
    when exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO' and proprietario and mora) then 'PROPRIETARIO_MORA'
    when exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO' and mora and ligacao = 'INQUILINO') then 'ALUGADA'
    when exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO' and mora) then 'CEDIDA'
    else 'VAZIA' end
$$;

create function proprietario_nao_mora(p_unidade uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO' and proprietario)
     and not exists (select 1 from contatos_unidade where unidade_id = p_unidade and estado <> 'ENCERRADO' and proprietario and mora)
$$;

-- ---------------------------------------------------------------------------------------
-- Ajudantes com as marcações.

drop function ligar_contato_unidade(uuid, uuid, text, boolean, boolean, text, text, uuid);
drop function exigir_relacao(text);

-- Liga o contato à unidade. Responsável: o anterior deixa de ser (um por unidade).
create function ligar_contato_unidade(p_contato uuid, p_unidade uuid, p_marcas marcas_vinculo, p_recebe boolean,
                                      p_estado text, p_origem text, p_autor uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  if p_marcas.principal then
    update contatos_unidade set principal = false where unidade_id = p_unidade and principal and estado <> 'ENCERRADO';
  end if;
  perform definir_transicao(case p_estado when 'CONFIRMADO' then 'CONTATO_CONFIRMADO' else 'CONTATO_INCLUIDO' end);
  begin
    insert into contatos_unidade (condominio_id, contato_id, unidade_id, proprietario, principal, mora, ligacao, parentesco, ocupa_desde,
                                  recebe_comunicados, estado, origem, criado_por, confirmado_em, confirmado_por)
    values (contexto_condominio(), p_contato, p_unidade, p_marcas.proprietario, p_marcas.principal, p_marcas.mora, p_marcas.ligacao,
            p_marcas.parentesco, p_marcas.ocupa_desde, coalesce(p_recebe, true), p_estado, p_origem, p_autor,
            case when p_estado = 'CONFIRMADO' then app_now() end, case when p_estado = 'CONFIRMADO' then p_autor end)
    returning id into v_id;
  exception when unique_violation then
    perform recusar_motivo('Este contato já está nesta unidade', 'CONTATO_JA_NA_UNIDADE');
  end;
  return v_id;
end $$;

-- Encerra um vínculo ativo, seguindo a versão lida (AT-24). A data de saída vale para todo
-- encerramento menos a recusa, e não fica antes da entrada.
create or replace function encerrar_contato_unidade(p_id uuid, p_versao integer, p_motivo text, p_data_saida date, p_autor uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_versao integer;
begin
  perform definir_transicao(case p_motivo when 'RECUSADO' then 'CONTATO_RECUSADO' else 'VINCULO_ENCERRADO' end, p_motivo);
  begin
    update contatos_unidade
       set estado = 'ENCERRADO', encerrado_em = app_now(), encerrado_por = p_autor, motivo_encerramento = p_motivo,
           data_saida = case when p_motivo <> 'RECUSADO' then p_data_saida end
     where id = p_id and versao = p_versao and estado <> 'ENCERRADO'
    returning versao into v_versao;
  exception when check_violation then
    perform recusar_campos('A saída não pode ser antes da entrada', 'dataSaida');
  end;
  if v_versao is null then perform conflito_versao('contatos_unidade', p_id); end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções da API da Plataforma (security definer). Pessoa e condomínio vêm da sessão.

-- Blocos e unidades, com a ocupação de cada uma e os contadores do topo (MU-10, MU-11).
create or replace function plataforma_unidades(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  return jsonb_build_object(
    'estrutura', (select jsonb_build_object('agrupamento', c.agrupamento, 'usaAndar', c.usa_andar, 'versao', c.versao) from configuracao_condominio c),
    'blocos', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'ordem', b.ordem, 'ativo', b.ativo, 'versao', b.versao)
                                         order by b.ativo desc, b.ordem, lower(b.nome)) from blocos b), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', u.id, 'blocoId', u.bloco_id, 'andar', u.andar, 'identificacao', u.identificacao, 'ativa', u.ativa, 'versao', u.versao,
               'confirmados', (select count(*) from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'CONFIRMADO'),
               'pendentes', (select count(*) from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'PENDENTE'),
               'temProprietario', exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.proprietario and cu.estado <> 'ENCERRADO'),
               'semProprietario', u.ativa and falta_proprietario(u.id),
               'principal', (select ct.nome from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                              where cu.unidade_id = u.id and cu.principal and cu.estado <> 'ENCERRADO'),
               'principalRelacao', (select cu.relacao from contatos_unidade cu where cu.unidade_id = u.id and cu.principal and cu.estado <> 'ENCERRADO'),
               'ocupacao', ocupacao_unidade(u.id),
               'proprietario', (select ct.nome from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                                 where cu.unidade_id = u.id and cu.proprietario and cu.estado <> 'ENCERRADO'
                                 order by cu.principal desc, cu.mora desc, lower(ct.nome) limit 1),
               'proprietarioNaoMora', proprietario_nao_mora(u.id),
               'semResponsavel', u.ativa
                 and exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.estado <> 'ENCERRADO')
                 and not exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.principal and cu.estado <> 'ENCERRADO'))
             order by u.ativa desc, b.ordem nulls first, lower(b.nome) nulls first, chave_andar(u.andar), chave_unidade(u.identificacao))
        from unidades u left join blocos b on b.id = u.bloco_id), '[]'::jsonb),
    'resumo', resumo_moradores(p_condominio),
    'ocupacao', (select jsonb_build_object(
        'comMorador', count(*) filter (where ocupacao_unidade(u.id) in ('PROPRIETARIO_MORA', 'ALUGADA', 'CEDIDA')),
        'alugadas', count(*) filter (where ocupacao_unidade(u.id) = 'ALUGADA'),
        'proprietarioNaoMora', count(*) filter (where proprietario_nao_mora(u.id)),
        'semResponsavel', count(*) filter (where exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.estado <> 'ENCERRADO')
                                             and not exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.principal and cu.estado <> 'ENCERRADO')))
      from unidades u where u.ativa),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'));
end $$;

-- Uma unidade com as pessoas ativas, as que já saíram e a ocupação (MU-07, MU-08, MU-10).
create or replace function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_u unidades;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  v_u := exigir_unidade(p_unidade);
  return jsonb_build_object(
    'unidade', jsonb_build_object('id', v_u.id, 'identificacao', v_u.identificacao, 'blocoId', v_u.bloco_id, 'andar', v_u.andar,
                                  'bloco', (select nome from blocos where id = v_u.bloco_id), 'ativa', v_u.ativa, 'versao', v_u.versao),
    'contatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', cu.id, 'contatoId', ct.id, 'nome', ct.nome, 'telefone', ct.telefone, 'contatoVersao', ct.versao,
               'relacao', cu.relacao, 'principal', cu.principal, 'recebeComunicados', cu.recebe_comunicados,
               'proprietario', cu.proprietario, 'mora', cu.mora, 'ligacao', cu.ligacao, 'parentesco', cu.parentesco,
               'ocupaDesde', to_char(cu.ocupa_desde, 'YYYY-MM-DD'),
               'estado', cu.estado, 'origem', cu.origem, 'desde', coalesce(cu.confirmado_em, cu.criado_em), 'versao', cu.versao,
               'telefoneCompartilhado', telefone_compartilhado(ct.id),
               'outrasUnidades', coalesce((
                 select jsonb_agg(nome_da_unidade(b2.nome, u2.andar, u2.identificacao) order by chave_andar(u2.andar), chave_unidade(u2.identificacao))
                   from contatos_unidade c2 join unidades u2 on u2.id = c2.unidade_id left join blocos b2 on b2.id = u2.bloco_id
                  where c2.contato_id = ct.id and c2.unidade_id <> v_u.id and c2.estado <> 'ENCERRADO'), '[]'::jsonb))
             order by cu.estado = 'PENDENTE', cu.principal desc, cu.mora desc, lower(ct.nome))
        from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
       where cu.unidade_id = v_u.id and cu.estado <> 'ENCERRADO'), '[]'::jsonb),
    'anteriores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', cu.id, 'contatoId', ct.id, 'nome', ct.nome, 'relacao', cu.relacao, 'motivo', cu.motivo_encerramento,
               'proprietario', cu.proprietario, 'mora', cu.mora, 'ligacao', cu.ligacao, 'parentesco', cu.parentesco,
               'ocupaDesde', to_char(cu.ocupa_desde, 'YYYY-MM-DD'),
               'dataSaida', to_char(cu.data_saida, 'YYYY-MM-DD'), 'encerradoEm', cu.encerrado_em,
               'dadosRemovidos', ct.dados_removidos_em is not null, 'contatoVersao', ct.versao,
               'semVinculoAtivo', not exists (select 1 from contatos_unidade c3 where c3.contato_id = ct.id and c3.estado <> 'ENCERRADO'))
             order by cu.encerrado_em desc)
        from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
       where cu.unidade_id = v_u.id and cu.estado = 'ENCERRADO'), '[]'::jsonb),
    'ocupacao', jsonb_build_object(
      'situacao', ocupacao_unidade(v_u.id),
      'moram', (select count(*) from contatos_unidade where unidade_id = v_u.id and estado <> 'ENCERRADO' and mora),
      'proprietarioNaoMora', proprietario_nao_mora(v_u.id)),
    'faltaProprietario', falta_proprietario(v_u.id),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'));
end $$;

-- Incluir uma pessoa na unidade com as marcações (MU-01, MU-08, MU-10): contato novo (nome e
-- telefone) ou um que já existe no condomínio. Quem pode confirmar inclui já confirmado; os
-- outros deixam pendente para o síndico (MU-02). Inquilino em unidade sem proprietário no
-- cadastro entra junto com o proprietário do imóvel (p_proprietario: {"contatoId": "..."} ou
-- {"nome": "...", "telefone": "+55..."}), que fica registrado sem morar lá, sem ser o
-- responsável e sem receber os comunicados do dia a dia.
create function plataforma_incluir_pessoa_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_nome text,
                                                  p_telefone text, p_marcas jsonb, p_recebe boolean, p_proprietario jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contato uuid := p_contato;
  v_marcas marcas_vinculo;
  v_id uuid;
  v_dono uuid;
  v_estado text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if not (exigir_unidade(p_unidade)).ativa then perform recusar_motivo('Unidade desativada', 'UNIDADE_INATIVA'); end if;
  v_marcas := ler_marcas(p_marcas);
  if v_contato is null then
    v_contato := criar_contato(p_nome, p_telefone, p_pessoa);
  elsif not exists (select 1 from contatos where id = v_contato) then
    raise exception 'Contato não encontrado' using errcode = 'TC404';
  end if;
  v_estado := case when pode(p_pessoa, p_condominio, 'moradores.confirmar') then 'CONFIRMADO' else 'PENDENTE' end;
  v_id := ligar_contato_unidade(v_contato, p_unidade, v_marcas, p_recebe, v_estado, 'PAINEL', p_pessoa);
  if not v_marcas.proprietario and v_marcas.ligacao = 'INQUILINO' and falta_proprietario(p_unidade) then
    if p_proprietario is null or jsonb_typeof(p_proprietario) <> 'object' then
      perform recusar_motivo('Informe o proprietário do imóvel', 'FALTA_PROPRIETARIO');
    end if;
    if nullif(p_proprietario ->> 'contatoId', '') is not null then
      begin
        v_dono := (p_proprietario ->> 'contatoId')::uuid;
      exception when invalid_text_representation then
        perform recusar_campos('Proprietário inválido', 'proprietario');
      end;
      if not exists (select 1 from contatos where id = v_dono and dados_removidos_em is null) then
        raise exception 'Contato não encontrado' using errcode = 'TC404';
      end if;
      if v_dono = v_contato then perform recusar_motivo('Inquilino e proprietário são pessoas diferentes', 'MESMA_PESSOA'); end if;
    else
      begin
        v_dono := criar_contato(p_proprietario ->> 'nome', p_proprietario ->> 'telefone', p_pessoa);
      exception when sqlstate 'TC422' then
        perform recusar_campos('Confira o nome e o telefone do proprietário', 'proprietario');
      end;
    end if;
    perform ligar_contato_unidade(v_dono, p_unidade, row(true, false, false, null, null, null)::marcas_vinculo, false, v_estado, 'PAINEL', p_pessoa);
  end if;
  return jsonb_build_object('vinculoId', v_id, 'contatoId', v_contato, 'proprietarioId', v_dono,
    'avisos', case when telefone_compartilhado(v_contato) then '["TELEFONE_COMPARTILHADO"]'::jsonb else '[]'::jsonb end);
end $$;

-- A chamada de antes, com a relação: vira marcações.
create or replace function plataforma_incluir_contato(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_nome text,
                                                      p_telefone text, p_relacao text, p_principal boolean, p_recebe boolean,
                                                      p_proprietario jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if marcas_da_relacao(p_relacao) is null then
    perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
    perform recusar_campos('Relação com a unidade desconhecida', 'relacao');
  end if;
  return plataforma_incluir_pessoa_unidade(p_pessoa, p_condominio, p_unidade, p_contato, p_nome, p_telefone,
    marcas_da_relacao(p_relacao) || jsonb_build_object('principal', coalesce(p_principal, false)), p_recebe, p_proprietario);
end $$;

-- Marcações, parentesco, entrada e preferência de comunicados de um vínculo ativo (MU-08,
-- MU-10). Marcar outro responsável tira a marcação de quem tinha.
create function plataforma_alterar_marcas_vinculo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_marcas jsonb,
                                                  p_recebe boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes contatos_unidade;
  v marcas_vinculo;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into v_antes from contatos_unidade where id = p_id and estado <> 'ENCERRADO';
  if not found then raise exception 'Vínculo não encontrado' using errcode = 'TC404'; end if;
  v := ler_marcas(p_marcas);
  if v.principal and not v_antes.principal then
    update contatos_unidade set principal = false where unidade_id = v_antes.unidade_id and principal and estado <> 'ENCERRADO';
  end if;
  update contatos_unidade
     set proprietario = v.proprietario, principal = v.principal, mora = v.mora, ligacao = v.ligacao, parentesco = v.parentesco,
         ocupa_desde = v.ocupa_desde, recebe_comunicados = coalesce(p_recebe, true)
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos_unidade', p_id); end if;
  perform registrar_historico('vinculo_unidade.alterado', 'contato_unidade', p_id::text, jsonb_build_object('campos', to_jsonb(array_remove(array[
    case when v_antes.proprietario is distinct from v.proprietario then 'proprietario' end,
    case when v_antes.principal is distinct from v.principal then 'responsavel' end,
    case when v_antes.mora is distinct from v.mora then 'mora' end,
    case when v_antes.ligacao is distinct from v.ligacao then 'ligacao' end,
    case when v_antes.parentesco is distinct from v.parentesco then 'parentesco' end,
    case when v_antes.ocupa_desde is distinct from v.ocupa_desde then 'ocupa_desde' end,
    case when v_antes.recebe_comunicados is distinct from coalesce(p_recebe, true) then 'recebe_comunicados' end], null))));
  return v_versao;
end $$;

-- A chamada de antes, com a relação: vira marcações, mantendo a entrada e o parentesco.
create or replace function plataforma_alterar_vinculo_unidade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_relacao text,
                                                              p_principal boolean, p_recebe boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_antes contatos_unidade;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if marcas_da_relacao(p_relacao) is null then perform recusar_campos('Relação com a unidade desconhecida', 'relacao'); end if;
  select * into v_antes from contatos_unidade where id = p_id and estado <> 'ENCERRADO';
  if not found then raise exception 'Vínculo não encontrado' using errcode = 'TC404'; end if;
  return plataforma_alterar_marcas_vinculo(p_pessoa, p_condominio, p_id, p_versao,
    marcas_da_relacao(p_relacao) || jsonb_build_object('principal', coalesce(p_principal, false),
      'ocupaDesde', to_char(v_antes.ocupa_desde, 'YYYY-MM-DD'),
      'parentesco', case when p_relacao = 'FAMILIAR' then v_antes.parentesco end), p_recebe);
end $$;

-- Mudança (MU-07, MU-10): quem sai e quem entra, numa só operação. A data da mudança vira o
-- "ocupou até" de quem sai e o "ocupa desde" de quem entra. Se entra inquilino ou sai o
-- proprietário, a unidade não fica com inquilino e sem proprietário (MU-01).
-- p_saem: [{"id": "<vínculo>", "versao": 1}]
-- p_entram: [{"nome": "...", "telefone": "+55...", "proprietario": false, "principal": true, "mora": true,
--             "ligacao": "INQUILINO", "parentesco": null, "recebeComunicados": true}]
-- (ou, como antes, com "relacao" no lugar das marcações)
create or replace function plataforma_registrar_mudanca(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_data date, p_saem jsonb, p_entram jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_contato uuid;
  v_marcas jsonb;
  v_estado text;
  v_entram integer := 0;
  v_checar_dono boolean := false;
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
  if (select count(*) from jsonb_array_elements(p_entram) x where x -> 'principal' = 'true'::jsonb) > 1 then
    perform recusar_campos('Só um responsável', 'entram');
  end if;

  for r in select (x ->> 'id')::uuid as id, (x ->> 'versao')::int as versao from jsonb_array_elements(p_saem) x loop
    if not exists (select 1 from contatos_unidade where id = r.id and unidade_id = p_unidade and estado <> 'ENCERRADO') then
      raise exception 'Vínculo não encontrado nesta unidade' using errcode = 'TC404';
    end if;
    v_checar_dono := v_checar_dono or exists (select 1 from contatos_unidade where id = r.id and proprietario);
    perform encerrar_contato_unidade(r.id, r.versao, 'MUDANCA', p_data, p_pessoa);
  end loop;

  v_estado := case when pode(p_pessoa, p_condominio, 'moradores.confirmar') then 'CONFIRMADO' else 'PENDENTE' end;
  for r in select x from jsonb_array_elements(p_entram) e(x) loop
    if r.x ? 'recebeComunicados' and jsonb_typeof(r.x -> 'recebeComunicados') not in ('boolean', 'null') then
      perform recusar_campos('Preferência inválida', 'entram');
    end if;
    v_contato := criar_contato(r.x ->> 'nome', r.x ->> 'telefone', p_pessoa);
    if r.x ? 'relacao' then
      if marcas_da_relacao(r.x ->> 'relacao') is null then perform recusar_campos('Relação com a unidade desconhecida', 'relacao'); end if;
      v_marcas := marcas_da_relacao(r.x ->> 'relacao') || jsonb_build_object('principal', coalesce(r.x -> 'principal', 'false'::jsonb));
    else
      v_marcas := r.x - 'nome' - 'telefone' - 'recebeComunicados';
    end if;
    perform ligar_contato_unidade(v_contato, p_unidade, ler_marcas(v_marcas || jsonb_build_object('ocupaDesde', to_char(p_data, 'YYYY-MM-DD'))),
                                  coalesce((r.x ->> 'recebeComunicados')::boolean, true), v_estado, 'PAINEL', p_pessoa);
    v_entram := v_entram + 1;
    v_checar_dono := v_checar_dono or (v_marcas ->> 'ligacao' = 'INQUILINO' and v_marcas -> 'proprietario' is distinct from 'true'::jsonb);
  end loop;
  if v_checar_dono and falta_proprietario(p_unidade) then
    perform recusar_motivo('Inclua o proprietário do imóvel entre quem entra', 'FALTA_PROPRIETARIO');
  end if;

  perform registrar_historico('mudanca.registrada', 'unidade', p_unidade::text,
    jsonb_build_object('data', to_char(p_data, 'YYYY-MM-DD'), 'saem', jsonb_array_length(p_saem), 'entram', v_entram));
  return jsonb_build_object('saem', jsonb_array_length(p_saem), 'entram', v_entram);
end $$;

-- Importar unidades e contatos de uma planilha (F3.3, PI-04), agora com as colunas
-- opcionais do vínculo: mora (sim ou não), responsável (sim ou não), parentesco e ocupa
-- desde. A relação continua valendo e vira marcações. Proprietário sem a coluna mora mora na
-- unidade quando ela não tem inquilino. Responsável da planilha só vale para a unidade que
-- ainda não tem um. Tudo ou nada, como antes.
-- p_linhas: [{"bloco": "Torre A" | null, "andar": "3" | null, "unidade": "302", "nome": "...", "telefone": "+55...",
--             "relacao": "MORADOR", "mora": true | null, "responsavel": true | null, "parentesco": "FILHO" | null,
--             "ocupaDesde": "2025-03-01" | null}]
create or replace function plataforma_importar_moradores(p_pessoa uuid, p_condominio uuid, p_linhas jsonb, p_agrupamento text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_bloco uuid;
  v_unidade uuid;
  v_contato uuid;
  v_vinculo uuid;
  v_marcas jsonb;
  v_m marcas_vinculo;
  v_decidir_mora uuid[] := '{}';
  v_blocos integer := 0;
  v_unidades integer := 0;
  v_contatos integer := 0;
  v_vinculos integer := 0;
  v_ignoradas integer := 0;
  v_campos text[];
  v_detalhe text;
  v_andar text;
  v_config configuracao_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_agrupamento is not null and p_agrupamento not in ('TORRE', 'BLOCO', 'QUADRA', 'PREDIO') then
    perform recusar_campos('Divisão desconhecida', 'agrupamento');
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) not between 1 and 2000 then
    perform recusar_campos('De 1 a 2000 linhas', 'linhas');
  end if;

  for r in select x, n::int as n from jsonb_array_elements(p_linhas) with ordinality e(x, n) loop
    v_campos := array_remove(array[
      case when jsonb_typeof(r.x) <> 'object' then 'linha' end,
      case when jsonb_typeof(r.x) = 'object' and r.x ? 'bloco' and jsonb_typeof(r.x -> 'bloco') <> 'null'
                and length(btrim(coalesce(r.x ->> 'bloco', ''))) not between 1 and 40 then 'bloco' end,
      case when jsonb_typeof(r.x) = 'object' and r.x ? 'andar' and jsonb_typeof(r.x -> 'andar') <> 'null'
                and length(btrim(coalesce(r.x ->> 'andar', ''))) not between 1 and 20 then 'andar' end,
      case when length(btrim(coalesce(r.x ->> 'unidade', ''))) not between 1 and 20 then 'unidade' end,
      case when length(btrim(coalesce(r.x ->> 'nome', ''))) not between 1 and 120 then 'nome' end,
      case when not coalesce(telefone_valido(r.x ->> 'telefone'), false) then 'telefone' end,
      case when marcas_da_relacao(coalesce(r.x ->> 'relacao', 'MORADOR')) is null then 'relacao' end,
      case when jsonb_typeof(r.x) = 'object' and coalesce(jsonb_typeof(r.x -> 'mora'), 'null') not in ('boolean', 'null') then 'mora' end,
      case when jsonb_typeof(r.x) = 'object' and coalesce(jsonb_typeof(r.x -> 'responsavel'), 'null') not in ('boolean', 'null') then 'responsavel' end
    ], null);
    if cardinality(v_campos) = 0 then
      v_marcas := marcas_da_relacao(coalesce(r.x ->> 'relacao', 'MORADOR'))
        || jsonb_strip_nulls(jsonb_build_object('mora', r.x -> 'mora', 'parentesco', r.x -> 'parentesco', 'ocupaDesde', r.x -> 'ocupaDesde'));
      begin
        v_m := ler_marcas(v_marcas);
      exception when sqlstate 'TC422' then
        get stacked diagnostics v_detalhe = pg_exception_detail;
        v_campos := array(select jsonb_array_elements_text(v_detalhe::jsonb -> 'campos'));
      end;
    end if;
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

    v_andar := nullif(btrim(coalesce(r.x ->> 'andar', '')), '');
    select id into v_unidade from unidades
     where ativa and bloco_id is not distinct from v_bloco and lower(btrim(identificacao)) = lower(btrim(r.x ->> 'unidade'))
       and coalesce(lower(btrim(andar)), '') = coalesce(lower(v_andar), '');
    if v_unidade is null then
      insert into unidades (condominio_id, bloco_id, andar, identificacao) values (p_condominio, v_bloco, v_andar, btrim(r.x ->> 'unidade'))
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
      v_m.principal := coalesce((r.x ->> 'responsavel')::boolean, false)
        and not exists (select 1 from contatos_unidade where unidade_id = v_unidade and principal and estado <> 'ENCERRADO');
      v_vinculo := ligar_contato_unidade(v_contato, v_unidade, v_m, true, 'PENDENTE', 'PLANILHA', p_pessoa);
      if v_m.proprietario and coalesce(jsonb_typeof(r.x -> 'mora'), 'null') = 'null' then
        v_decidir_mora := v_decidir_mora || v_vinculo;
      end if;
      v_vinculos := v_vinculos + 1;
    end if;
  end loop;

  -- Proprietário sem a coluna mora: mora quando a unidade não tem inquilino.
  update contatos_unidade cu set mora = not exists (
      select 1 from contatos_unidade i where i.unidade_id = cu.unidade_id and i.ligacao = 'INQUILINO' and i.mora and i.estado <> 'ENCERRADO')
   where cu.id = any (v_decidir_mora);

  select * into v_config from configuracao_condominio;
  if (v_config.agrupamento = 'NENHUM' and exists (select 1 from blocos where ativo))
     or (not v_config.usa_andar and exists (select 1 from unidades where ativa and andar is not null)) then
    update configuracao_condominio
       set agrupamento = case when agrupamento = 'NENHUM' and exists (select 1 from blocos where ativo) then coalesce(p_agrupamento, 'BLOCO') else agrupamento end,
           usa_andar = usa_andar or exists (select 1 from unidades where ativa and andar is not null)
     where id = v_config.id;
  end if;

  perform registrar_historico('moradores.importados', 'condominio', p_condominio::text, jsonb_build_object(
    'linhas', jsonb_array_length(p_linhas), 'blocos', v_blocos, 'unidades', v_unidades, 'contatos', v_contatos,
    'vinculos', v_vinculos, 'ignoradas', v_ignoradas));
  return jsonb_build_object('linhas', jsonb_array_length(p_linhas), 'blocos', v_blocos, 'unidades', v_unidades,
                            'contatos', v_contatos, 'vinculos', v_vinculos, 'ignoradas', v_ignoradas,
                            'semProprietario', (select count(*) from unidades u where u.ativa and falta_proprietario(u.id)));
end $$;

call fechar_acesso();

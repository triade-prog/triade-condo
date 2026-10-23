-- 0287 · Família, pets e aniversário no cadastro da unidade (F3.9; MU-06) e o menu da unidade com
-- histórico, aniversariantes e busca por etiqueta (F3.10; MU-11). Desenho nos quadros 201 a 215 do
-- canvas do novo frontend, aprovado pela Carolina em 23/10/2026. O link de cadastro com a fila de
-- pendentes (MU-09, quadros 216 a 223) vem na 0288.
--
-- Decisões (todas a opção 1, 23/10/2026):
-- B. Aniversário só com dia e mês, opcional, sem o ano: ninguém fica sabendo a idade (PT-11).
-- C. As etiquetas da busca são as marcas que já existem (à venda, para alugar, a confirmar, sem
--    responsável) e duas novas que saem do cadastro (com pet, aniversariante do mês). A tela
--    filtra a lista com o que esta função devolve; nada novo é guardado para isso.
-- D. Família e pets são cartões da ficha da unidade, sem foto. Familiar não tem telefone nem
--    acesso: quem fala com o condomínio é pessoa com vínculo (contatos_unidade).
--
-- Regras desta parte:
-- 1. Retirar familiar ou pet: "saiu" guarda a data e fica no histórico; "cadastrado por engano"
--    apaga os dados, e o histórico guarda só que um familiar ou um pet foi retirado.
-- 2. Remover os dados de quem saiu (PT-11) apaga também o aniversário.
-- 3. O histórico da unidade junta o que o sistema já grava sobre ela: pessoas (vínculos),
--    mudança, marcas, veículos, família e pets. Telefone e placa nunca aparecem; quem teve os
--    dados removidos aparece como pessoa removida.
-- 4. Unidade com familiar ou pet não é desativada (como com veículo).
-- 5. Família, pets e aniversários aparecem só para quem vê os moradores; nunca no mural nem no
--    WhatsApp.

-- ---------------------------------------------------------------------------------------
-- Aniversário: dia e mês.

create function aniversario_valido(p_dia smallint, p_mes smallint) returns boolean
language sql immutable
set search_path = public
as $$
  select (p_dia is null and p_mes is null)
      or (p_mes between 1 and 12 and p_dia between 1 and case when p_mes = 2 then 29 when p_mes in (4, 6, 9, 11) then 30 else 31 end)
$$;

alter table contatos
  add column aniversario_dia smallint,
  add column aniversario_mes smallint,
  add constraint contatos_aniversario check (aniversario_valido(aniversario_dia, aniversario_mes)),
  add constraint contatos_aniversario_removido check (dados_removidos_em is null or aniversario_dia is null);

-- Remover os dados apaga o aniversário junto (regra 2).
create function contatos_aniversario_removido() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.dados_removidos_em is not null then
    new.aniversario_dia := null;
    new.aniversario_mes := null;
  end if;
  return new;
end $$;
create trigger contatos_aniversario_removido before update on contatos
  for each row execute function contatos_aniversario_removido();

-- {"dia": 3, "mes": 11} ou {} (sem aniversário). Fora disso, recusa o campo.
create function ler_aniversario(p jsonb, out dia smallint, out mes smallint)
language plpgsql immutable
set search_path = public
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform recusar_campos('Aniversário: dia e mês', 'aniversario');
  end if;
  if coalesce(jsonb_typeof(p -> 'dia'), 'null') = 'null' and coalesce(jsonb_typeof(p -> 'mes'), 'null') = 'null' then
    return;
  end if;
  if jsonb_typeof(p -> 'dia') <> 'number' or jsonb_typeof(p -> 'mes') <> 'number'
     or (p ->> 'dia') !~ '^[0-9]{1,2}$' or (p ->> 'mes') !~ '^[0-9]{1,2}$'
     or not aniversario_valido((p ->> 'dia')::smallint, (p ->> 'mes')::smallint) then
    perform recusar_campos('Aniversário: um dia que exista no mês escolhido', 'aniversario');
  end if;
  dia := (p ->> 'dia')::smallint;
  mes := (p ->> 'mes')::smallint;
end $$;

create function aniversario_json(p_dia smallint, p_mes smallint) returns jsonb
language sql immutable
set search_path = public
as $$ select case when p_dia is not null then jsonb_build_object('dia', p_dia, 'mes', p_mes) end $$;

-- Mês de hoje no fuso do condomínio do contexto.
create function mes_no_condominio() returns smallint
language sql stable
set search_path = public
as $$ select extract(month from hoje_no_condominio())::smallint $$;

-- Grava o aniversário do contato quando mudou; devolve a versão (que sobe só se mudou).
create function gravar_aniversario_contato(p_contato uuid, p_versao integer, p_aniversario jsonb) returns integer
language plpgsql
set search_path = public
as $$
declare
  a record;
  v_antes contatos;
  v_versao integer;
begin
  a := ler_aniversario(p_aniversario);
  select * into v_antes from contatos where id = p_contato;
  if (v_antes.aniversario_dia, v_antes.aniversario_mes) is not distinct from (a.dia, a.mes) then return v_antes.versao; end if;
  update contatos set aniversario_dia = a.dia, aniversario_mes = a.mes where id = p_contato and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('contatos', p_contato); end if;
  perform registrar_historico('contato.alterado', 'contato', p_contato::text, '{"campos": ["aniversario"]}'::jsonb);
  return v_versao;
end $$;

-- Corrigir nome, telefone e aniversário do contato. p_aniversario nulo deixa como está.
alter function plataforma_alterar_contato(uuid, uuid, uuid, integer, text, text) rename to contato_alterar_r1;
alter function contato_alterar_r1(uuid, uuid, uuid, integer, text, text) security invoker;
create function plataforma_alterar_contato(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer, p_nome text,
                                           p_telefone text, p_aniversario jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := contato_alterar_r1(p_pessoa, p_condominio, p_contato, p_versao, p_nome, p_telefone);
  if p_aniversario is not null then
    v := v || jsonb_build_object('versao', gravar_aniversario_contato(p_contato, (v ->> 'versao')::integer, p_aniversario));
  end if;
  return v;
end $$;

-- Incluir pessoa na unidade (0110) com o aniversário, se vier.
alter function plataforma_incluir_pessoa_unidade(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, jsonb) rename to pessoa_unidade_incluir_r1;
alter function pessoa_unidade_incluir_r1(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, jsonb) security invoker;
create function plataforma_incluir_pessoa_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_nome text,
                                                  p_telefone text, p_marcas jsonb, p_recebe boolean, p_proprietario jsonb default null,
                                                  p_aniversario jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_contato uuid;
begin
  if p_aniversario is not null then perform ler_aniversario(p_aniversario); end if;
  v := pessoa_unidade_incluir_r1(p_pessoa, p_condominio, p_unidade, p_contato, p_nome, p_telefone, p_marcas, p_recebe, p_proprietario);
  if p_aniversario is not null then
    v_contato := (v ->> 'contatoId')::uuid;
    perform gravar_aniversario_contato(v_contato, (select versao from contatos where id = v_contato), p_aniversario);
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Família e pets (MU-06).

create table familiares_unidade (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  unidade_id       uuid not null,
  nome             text not null check (length(btrim(nome)) between 1 and 120),
  parentesco       text not null check (parentesco in ('CONJUGE', 'FILHO', 'PAI_MAE', 'OUTRO_PARENTE', 'TRABALHA_NA_CASA')),
  mora             boolean not null default true,
  aniversario_dia  smallint,
  aniversario_mes  smallint,
  saiu_em          timestamptz,
  saiu_por         uuid references pessoas (id),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check (aniversario_valido(aniversario_dia, aniversario_mes)),
  check ((saiu_em is null) = (saiu_por is null))
);
create index familiares_unidade_unidade on familiares_unidade (unidade_id);
call proteger_tabela_condominio('familiares_unidade');

create table pets_unidade (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  unidade_id     uuid not null,
  nome           text not null check (length(btrim(nome)) between 1 and 60),
  especie        text not null check (especie in ('CAO', 'GATO', 'OUTRO')),
  porte          text check (porte in ('PEQUENO', 'MEDIO', 'GRANDE')),
  raca           text check (length(btrim(raca)) between 2 and 60),
  observacao     text check (length(btrim(observacao)) between 2 and 280),
  saiu_em        timestamptz,
  saiu_por       uuid references pessoas (id),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid not null references pessoas (id),
  versao         integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check ((saiu_em is null) = (saiu_por is null))
);
create index pets_unidade_unidade on pets_unidade (unidade_id);
call proteger_tabela_condominio('pets_unidade');

-- Familiar e pet não mudam de unidade; depois de sair, não mudam mais.
create function familia_pets_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.unidade_id, new.criado_em, new.criado_por) is distinct from (old.condominio_id, old.unidade_id, old.criado_em, old.criado_por) then
    raise exception 'Não muda de unidade: retire e inclua na outra' using errcode = 'TC422';
  end if;
  if old.saiu_em is not null then
    raise exception 'Quem saiu da unidade não muda' using errcode = 'TC422', detail = '{"motivo":"JA_SAIU"}';
  end if;
  return new;
end $$;
create trigger familiares_unidade_regras before update on familiares_unidade for each row execute function familia_pets_regras();
create trigger pets_unidade_regras before update on pets_unidade for each row execute function familia_pets_regras();

-- Unidade com familiar ou pet não é desativada (regra 4).
create function unidade_sem_familia_pets() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.ativa and not new.ativa and (exists (select 1 from familiares_unidade where unidade_id = new.id and saiu_em is null)
                                      or exists (select 1 from pets_unidade where unidade_id = new.id and saiu_em is null)) then
    raise exception 'Retire a família e os pets da unidade antes' using errcode = 'TC422', detail = '{"motivo":"UNIDADE_COM_FAMILIA"}';
  end if;
  return new;
end $$;
create trigger unidades_sem_familia_pets before update of ativa on unidades for each row execute function unidade_sem_familia_pets();

create function familiar_json(f familiares_unidade) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'parentesco', f.parentesco, 'mora', f.mora,
    'aniversario', aniversario_json(f.aniversario_dia, f.aniversario_mes), 'desde', f.criado_em, 'versao', f.versao))
$$;

create function pet_json(p pets_unidade) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'nome', p.nome, 'especie', p.especie, 'porte', p.porte, 'raca', p.raca, 'observacao', p.observacao,
    'desde', p.criado_em, 'versao', p.versao))
$$;

create function exigir_unidade_ativa(p_unidade uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_unidade is null or not exists (select 1 from unidades where id = p_unidade) then
    perform recusar_campos('Unidade não encontrada', 'unidadeId');
  end if;
  if not (exigir_unidade(p_unidade)).ativa then perform recusar_motivo('Unidade desativada', 'UNIDADE_INATIVA'); end if;
end $$;

-- Incluir ou editar familiar. p_id nulo inclui na unidade p_unidade.
create function plataforma_salvar_familiar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_unidade uuid,
                                           p_nome text, p_parentesco text, p_mora boolean, p_aniversario jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_antes familiares_unidade;
  v_unidade uuid := p_unidade;
  a record;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_id is not null then
    select * into v_antes from familiares_unidade where id = p_id;
    if not found then raise exception 'Familiar não encontrado' using errcode = 'TC404'; end if;
    if v_antes.saiu_em is not null then perform recusar_motivo('Quem saiu da unidade não muda', 'JA_SAIU'); end if;
    v_unidade := v_antes.unidade_id;
  end if;
  perform exigir_unidade_ativa(v_unidade);
  if length(v_nome) not between 1 and 120 then perform recusar_campos('Nome entre 1 e 120 caracteres', 'nome'); end if;
  if p_parentesco is null or p_parentesco not in ('CONJUGE', 'FILHO', 'PAI_MAE', 'OUTRO_PARENTE', 'TRABALHA_NA_CASA') then
    perform recusar_campos('Escolha o parentesco', 'parentesco');
  end if;
  a := ler_aniversario(coalesce(p_aniversario, '{}'::jsonb));
  if p_id is null then
    insert into familiares_unidade (condominio_id, unidade_id, nome, parentesco, mora, aniversario_dia, aniversario_mes, criado_por)
    values (p_condominio, v_unidade, v_nome, p_parentesco, coalesce(p_mora, true), a.dia, a.mes, p_pessoa)
    returning id, versao into v_id, v_versao;
    perform registrar_historico('unidade.familiar_incluido', 'unidade', v_unidade::text, jsonb_build_object('familiar', v_id));
  else
    if v_antes.versao <> p_versao then perform conflito_versao('familiares_unidade', p_id); end if;
    update familiares_unidade set nome = v_nome, parentesco = p_parentesco, mora = coalesce(p_mora, true),
                                  aniversario_dia = a.dia, aniversario_mes = a.mes
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('familiares_unidade', p_id); end if;
    perform registrar_historico('unidade.familiar_alterado', 'unidade', v_unidade::text, jsonb_build_object('familiar', v_id));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Incluir ou editar pet.
create function plataforma_salvar_pet(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_unidade uuid,
                                      p_nome text, p_especie text, p_porte text, p_raca text, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_raca text := nullif(btrim(coalesce(p_raca, '')), '');
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_antes pets_unidade;
  v_unidade uuid := p_unidade;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_id is not null then
    select * into v_antes from pets_unidade where id = p_id;
    if not found then raise exception 'Pet não encontrado' using errcode = 'TC404'; end if;
    if v_antes.saiu_em is not null then perform recusar_motivo('Quem saiu da unidade não muda', 'JA_SAIU'); end if;
    v_unidade := v_antes.unidade_id;
  end if;
  perform exigir_unidade_ativa(v_unidade);
  if length(v_nome) not between 1 and 60 then perform recusar_campos('Nome entre 1 e 60 caracteres', 'nome'); end if;
  if p_especie is null or p_especie not in ('CAO', 'GATO', 'OUTRO') then perform recusar_campos('Escolha a espécie', 'especie'); end if;
  if p_porte is not null and p_porte not in ('PEQUENO', 'MEDIO', 'GRANDE') then perform recusar_campos('Porte pequeno, médio ou grande', 'porte'); end if;
  if v_raca is not null and length(v_raca) not between 2 and 60 then perform recusar_campos('Raça de 2 a 60 caracteres', 'raca'); end if;
  if v_obs is not null and length(v_obs) not between 2 and 280 then perform recusar_campos('Observação de 2 a 280 caracteres', 'observacao'); end if;
  if p_id is null then
    insert into pets_unidade (condominio_id, unidade_id, nome, especie, porte, raca, observacao, criado_por)
    values (p_condominio, v_unidade, v_nome, p_especie, p_porte, v_raca, v_obs, p_pessoa) returning id, versao into v_id, v_versao;
    perform registrar_historico('unidade.pet_incluido', 'unidade', v_unidade::text, jsonb_build_object('pet', v_id));
  else
    if v_antes.versao <> p_versao then perform conflito_versao('pets_unidade', p_id); end if;
    update pets_unidade set nome = v_nome, especie = p_especie, porte = p_porte, raca = v_raca, observacao = v_obs
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('pets_unidade', p_id); end if;
    perform registrar_historico('unidade.pet_alterado', 'unidade', v_unidade::text, jsonb_build_object('pet', v_id));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Retirar familiar ou pet (regra 1). p_tipo: FAMILIAR ou PET; p_motivo: SAIU ou ENGANO.
create function plataforma_retirar_familia_pet(p_pessoa uuid, p_condominio uuid, p_tipo text, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabela regclass;
  v_chave text;
  v_unidade uuid;
  v_saiu timestamptz;
  v_versao integer;
  v_achou uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_tipo is null or p_tipo not in ('FAMILIAR', 'PET') then perform recusar_campos('Familiar ou pet', 'tipo'); end if;
  if p_motivo is null or p_motivo not in ('SAIU', 'ENGANO') then perform recusar_campos('Diga se saiu ou se foi cadastrado por engano', 'motivo'); end if;
  v_tabela := case p_tipo when 'FAMILIAR' then 'familiares_unidade' else 'pets_unidade' end;
  v_chave := case p_tipo when 'FAMILIAR' then 'familiar' else 'pet' end;
  execute format('select unidade_id, saiu_em, versao from %s where id = $1', v_tabela) into v_unidade, v_saiu, v_versao using p_id;
  if v_unidade is null then raise exception 'Não encontrado' using errcode = 'TC404'; end if;
  if v_saiu is not null then perform recusar_motivo('Já saiu da unidade', 'JA_SAIU'); end if;
  if v_versao <> p_versao then perform conflito_versao(v_tabela, p_id); end if;
  if p_motivo = 'SAIU' then
    execute format('update %s set saiu_em = app_now(), saiu_por = $1 where id = $2 and versao = $3 returning id', v_tabela)
      into v_achou using p_pessoa, p_id, p_versao;
    if v_achou is null then perform conflito_versao(v_tabela, p_id); end if;
    perform registrar_historico('unidade.' || v_chave || '_saiu', 'unidade', v_unidade::text, jsonb_build_object(v_chave, p_id));
  else
    execute format('delete from %s where id = $1 and versao = $2 returning id', v_tabela) into v_achou using p_id, p_versao;
    if v_achou is null then perform conflito_versao(v_tabela, p_id); end if;
    perform registrar_historico('unidade.' || v_chave || '_apagado', 'unidade', v_unidade::text);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Histórico da unidade (regra 3).

create function papel_do_vinculo(cu contatos_unidade) returns text
language sql immutable
set search_path = public
as $$
  select case when cu.proprietario then 'Proprietário' when cu.ligacao = 'INQUILINO' then 'Inquilino'
              when cu.ligacao = 'FAMILIAR' then 'Familiar ou cônjuge' else 'Outra ligação' end
$$;

create function nome_parentesco_familiar(p text) returns text
language sql immutable
set search_path = public
as $$
  select case p when 'CONJUGE' then 'Cônjuge' when 'FILHO' then 'Filho ou filha' when 'PAI_MAE' then 'Pai ou mãe'
                when 'OUTRO_PARENTE' then 'Outro parente' when 'TRABALHA_NA_CASA' then 'Trabalha na casa' end
$$;

create function nome_especie(p text) returns text
language sql immutable
set search_path = public
as $$ select case p when 'CAO' then 'cão' when 'GATO' then 'gato' else 'outro' end $$;

-- Cada registro do histórico que fala da unidade: categoria, título e detalhe já escritos.
create function historico_da_unidade(p_unidade uuid)
returns table (id bigint, em timestamptz, categoria text, titulo text, detalhe text, autor text)
language sql stable
set search_path = public
as $$
  with brutos as (
    select h.*, null::contatos_unidade as cu from historico h
     where h.entidade = 'unidade' and h.entidade_id = p_unidade::text
    union all
    select h.*, cu from historico h join contatos_unidade cu on cu.id::text = h.entidade_id
     where h.entidade in ('contatos_unidade', 'contato_unidade') and cu.unidade_id = p_unidade
  ), lidos as (
    select b.id, b.ocorrido_em, b.acao, b.dados, b.cu, b.autor_id,
           (select case when ct.dados_removidos_em is not null then 'Pessoa removida' else ct.nome end
              from contatos ct where ct.id = (b.cu).contato_id) as pessoa,
           (select f from familiares_unidade f where f.id::text = b.dados ->> 'familiar') as f,
           (select p from pets_unidade p where p.id::text = b.dados ->> 'pet') as p,
           (select v from veiculos v where v.id::text = b.dados ->> 'veiculo') as v
      from brutos b
  )
  select l.id, l.ocorrido_em,
    case when l.acao in ('estado.mudou', 'vinculo_unidade.alterado') then 'PESSOAS'
         when l.acao = 'mudanca.registrada' then 'MUDANCA'
         when l.acao = 'unidade.situacao_mudou' then 'MARCAS'
         when l.acao like 'unidade.veiculo%' then 'VEICULOS'
         when l.acao like 'unidade.familiar%' or l.acao like 'unidade.pet%' then 'FAMILIA_PETS'
         else 'UNIDADE' end,
    case
      when l.acao = 'estado.mudou' then
        case l.dados ->> 'evento'
          when 'CONTATO_INCLUIDO' then l.pessoa || case when (l.cu).origem = 'PLANILHA' then ' incluído pela planilha' else ' incluído' end
          when 'CONTATO_CONFIRMADO' then l.pessoa || case when l.dados ->> 'de' is null then ' incluído' else ' confirmado' end
          when 'CONTATO_RECUSADO' then l.pessoa || ' recusado'
          else l.pessoa || ' saiu' end
      when l.acao = 'vinculo_unidade.alterado' then l.pessoa || ': marcações alteradas'
      when l.acao = 'mudanca.registrada' then 'Mudança registrada'
      when l.acao = 'unidade.situacao_mudou' then
        case when (l.dados ->> 'aVenda')::boolean and (l.dados ->> 'paraAlugar')::boolean then 'Marcada à venda e para alugar'
             when (l.dados ->> 'aVenda')::boolean then 'Marcada à venda'
             when (l.dados ->> 'paraAlugar')::boolean then 'Marcada para alugar'
             else 'Deixou de estar à venda e para alugar' end
      when l.acao = 'unidade.veiculo_incluido' then 'Veículo incluído'
      when l.acao = 'unidade.veiculo_alterado' then 'Veículo alterado'
      when l.acao = 'unidade.veiculo_retirado' then 'Veículo retirado'
      when l.acao = 'unidade.familiar_incluido' then coalesce((l.f).nome || ' incluído na família', 'Familiar incluído')
      when l.acao = 'unidade.familiar_alterado' then coalesce((l.f).nome || ': cadastro alterado', 'Familiar alterado')
      when l.acao = 'unidade.familiar_saiu' then coalesce((l.f).nome, 'Familiar') || ' saiu'
      when l.acao = 'unidade.familiar_apagado' then 'Familiar retirado'
      when l.acao = 'unidade.pet_incluido' then coalesce((l.p).nome || ' incluído', 'Pet incluído')
      when l.acao = 'unidade.pet_alterado' then coalesce((l.p).nome || ': cadastro alterado', 'Pet alterado')
      when l.acao = 'unidade.pet_saiu' then coalesce((l.p).nome, 'Pet') || ' saiu'
      when l.acao = 'unidade.pet_apagado' then 'Pet retirado'
      when l.acao = 'unidade.alterada' then 'Unidade alterada'
      else 'Alteração na unidade' end,
    nullif(concat_ws(' · ',
      case
        when l.acao = 'estado.mudou' then papel_do_vinculo(l.cu)
        when l.acao = 'unidade.familiar_incluido' then nome_parentesco_familiar((l.f).parentesco)
        when l.acao like 'unidade.pet%' and l.p is not null then 'Pet · ' || nome_especie((l.p).especie)
        when l.acao like 'unidade.%_apagado' then 'cadastrado por engano, os dados foram apagados'
        when l.acao = 'mudanca.registrada' then
          'saíram ' || coalesce(l.dados ->> 'saem', '0') || ', entraram ' || coalesce(l.dados ->> 'entram', '0')
        when l.acao like 'unidade.veiculo%' then
          concat_ws(', ', case (l.v).tipo when 'CARRO' then 'Carro' when 'MOTO' then 'Moto' when 'OUTRO' then 'Outro veículo' end,
                    (select 'de ' || case when ct.dados_removidos_em is not null then 'pessoa removida' else ct.nome end
                       from contatos ct where ct.id = (l.v).contato_id))
      end,
      case when l.acao = 'estado.mudou' and l.dados ->> 'evento' = 'CONTATO_INCLUIDO' then 'espera confirmação'
           when l.acao = 'estado.mudou' and l.dados ->> 'evento' = 'VINCULO_ENCERRADO' then
             case l.dados ->> 'motivo' when 'MUDANCA' then 'vínculo encerrado na mudança' when 'CORRECAO' then 'cadastro corrigido'
                                       when 'PEDIDO' then 'a pedido' else null end
           when l.acao = 'unidade.veiculo_retirado' and l.dados ->> 'motivo' = 'SAIU' then 'saiu com quem saiu da unidade'
      end), ''),
    case when l.autor_id is null then 'pelo sistema' else 'por ' || nome_pessoa(l.autor_id) end
  from lidos l
$$;

-- A página do histórico: do mais novo ao mais antigo, 30 por vez. p_categoria nula traz tudo;
-- p_antes é o id do último registro já mostrado.
create function plataforma_historico_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_categoria text, p_antes bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itens jsonb;
  v_mais boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  perform exigir_unidade(p_unidade);
  if p_categoria is not null and p_categoria not in ('PESSOAS', 'MUDANCA', 'MARCAS', 'VEICULOS', 'FAMILIA_PETS') then
    perform recusar_campos('Categoria do histórico', 'categoria');
  end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x.id, 'em', x.em, 'categoria', x.categoria, 'titulo', x.titulo,
                                                                 'detalhe', x.detalhe, 'autor', x.autor)) order by x.em desc, x.id desc), '[]'::jsonb),
         count(*) > 30
    into v_itens, v_mais
    from (select * from historico_da_unidade(p_unidade) h
           where (p_categoria is null or h.categoria = p_categoria) and (p_antes is null or h.id < p_antes)
           order by h.em desc, h.id desc limit 31) x;
  if v_mais then v_itens := v_itens - 30; end if;
  return jsonb_build_object(
    'unidade', rotulo_unidade(p_unidade),
    'itens', v_itens,
    'mais', v_mais,
    'total', (select count(*) from historico_da_unidade(p_unidade) h where p_categoria is null or h.categoria = p_categoria),
    'desde', (select min(h.em) from historico_da_unidade(p_unidade) h));
end $$;

-- ---------------------------------------------------------------------------------------
-- A ficha da unidade (0284) com a família, os pets, o aniversário de cada pessoa e as três
-- últimas mudanças.

alter function plataforma_unidade(uuid, uuid, uuid) rename to unidade_detalhe_r4;
alter function unidade_detalhe_r4(uuid, uuid, uuid) security invoker;
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidade_detalhe_r4(p_pessoa, p_condominio, p_unidade);
  return v || jsonb_build_object(
    'contatos', coalesce((
      select jsonb_agg(x.item || coalesce((select jsonb_strip_nulls(jsonb_build_object('aniversario', aniversario_json(ct.aniversario_dia, ct.aniversario_mes)))
                                             from contatos ct where ct.id = (x.item ->> 'contatoId')::uuid), '{}'::jsonb) order by x.n)
        from jsonb_array_elements(v -> 'contatos') with ordinality x(item, n)), '[]'::jsonb),
    'familia', coalesce((select jsonb_agg(familiar_json(f) order by f.criado_em) from familiares_unidade f
                          where f.unidade_id = p_unidade and f.saiu_em is null), '[]'::jsonb),
    'pets', coalesce((select jsonb_agg(pet_json(p) order by p.criado_em) from pets_unidade p
                       where p.unidade_id = p_unidade and p.saiu_em is null), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', h.id, 'em', h.em, 'titulo', h.titulo, 'detalhe', h.detalhe,
                                                                                 'autor', h.autor)) order by h.em desc, h.id desc)
                             from (select * from historico_da_unidade(p_unidade) order by em desc, id desc limit 3) h), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------
-- A lista de unidades (0260) com as etiquetas novas: com pet e aniversariante do mês.

create function aniversariantes_da_unidade(p_unidade uuid, p_mes smallint) returns integer
language sql stable
set search_path = public
as $$
  select (select count(*) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
           where cu.unidade_id = p_unidade and cu.estado <> 'ENCERRADO' and ct.aniversario_mes = p_mes)::integer
       + (select count(*) from familiares_unidade f where f.unidade_id = p_unidade and f.saiu_em is null and f.aniversario_mes = p_mes)::integer
$$;

alter function plataforma_unidades(uuid, uuid) rename to unidades_r4;
alter function unidades_r4(uuid, uuid) security invoker;
create function plataforma_unidades(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_mes smallint;
begin
  v := unidades_r4(p_pessoa, p_condominio);
  v_mes := mes_no_condominio();
  return v || jsonb_build_object(
    'unidades', coalesce((
      select jsonb_agg(x.item || jsonb_build_object(
                         'pets', (select count(*) from pets_unidade p where p.unidade_id = u.id and p.saiu_em is null),
                         'familia', (select count(*) from familiares_unidade f where f.unidade_id = u.id and f.saiu_em is null),
                         'aniversariantesMes', aniversariantes_da_unidade(u.id, v_mes))
                       order by x.n)
        from jsonb_array_elements(v -> 'unidades') with ordinality x(item, n)
        join unidades u on u.id = (x.item ->> 'id')::uuid), '[]'::jsonb),
    'mes', v_mes);
end $$;

-- ---------------------------------------------------------------------------------------
-- Aniversariantes do mês: pessoas com vínculo ativo e família, de todas as unidades ou de uma.

create function plataforma_aniversariantes(p_pessoa uuid, p_condominio uuid, p_mes integer, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_mes smallint;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_mes is not null and p_mes not between 1 and 12 then perform recusar_campos('Mês de 1 a 12', 'mes'); end if;
  v_mes := coalesce(p_mes, mes_no_condominio());
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  return jsonb_build_object(
    'mes', v_mes,
    'mesAtual', mes_no_condominio(),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'id', a.id, 'nome', a.nome, 'dia', a.dia, 'descricao', a.descricao,
                                          'unidadeId', a.unidade_id, 'unidade', rotulo_unidade(a.unidade_id))
                       order by a.dia, lower(a.nome))
        from (
          select distinct on (cu.id) 'PESSOA' as tipo, ct.id, ct.nome, ct.aniversario_dia as dia, cu.unidade_id,
                 papel_do_vinculo(cu) || case when cu.principal then ' · responsável' else '' end as descricao
            from contatos_unidade cu join contatos ct on ct.id = cu.contato_id join unidades u on u.id = cu.unidade_id and u.ativa
           where cu.estado <> 'ENCERRADO' and ct.aniversario_mes = v_mes and (p_unidade is null or cu.unidade_id = p_unidade)
          union all
          select 'FAMILIA', f.id, f.nome, f.aniversario_dia, f.unidade_id,
                 'Família · ' || lower(nome_parentesco_familiar(f.parentesco))
            from familiares_unidade f join unidades u on u.id = f.unidade_id and u.ativa
           where f.saiu_em is null and f.aniversario_mes = v_mes and (p_unidade is null or f.unidade_id = p_unidade)
        ) a), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id))
                                           order by chave_unidade(coalesce((select nome from blocos where id = u.bloco_id), '')), chave_andar(u.andar), chave_unidade(u.identificacao))
                            from unidades u where u.ativa), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------
-- Busca da lista de unidades (0270): também acha pelo nome de quem é da família.

alter function plataforma_buscar_unidades(uuid, uuid, text) rename to buscar_unidades_r1;
alter function buscar_unidades_r1(uuid, uuid, text) security invoker;
create function plataforma_buscar_unidades(p_pessoa uuid, p_condominio uuid, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_q text := btrim(coalesce(p_busca, ''));
begin
  v := buscar_unidades_r1(p_pessoa, p_condominio, p_busca);
  return v || coalesce((
    select jsonb_agg(jsonb_build_object('unidadeId', f.unidade_id, 'tipo', 'FAMILIA', 'texto', f.nome) order by f.nome)
      from (select distinct on (f.unidade_id) f.unidade_id, f.nome from familiares_unidade f join unidades u on u.id = f.unidade_id and u.ativa
             where f.saiu_em is null and f.nome ilike '%' || v_q || '%'
               and not exists (select 1 from jsonb_array_elements(v) a where (a ->> 'unidadeId')::uuid = f.unidade_id)
             order by f.unidade_id, f.nome) f), '[]'::jsonb);
end $$;

call fechar_acesso();

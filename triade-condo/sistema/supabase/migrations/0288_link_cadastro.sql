-- 0288 · Link de cadastro da unidade e a fila do que chega por ele (F3.10; MU-09). Desenho nos
-- quadros 216 a 223 do canvas do novo frontend, aprovado pela Carolina em 23/10/2026. A família,
-- os pets, o histórico e os aniversariantes vieram na 0287.
--
-- Decisão A.1 (23/10/2026): o link de cadastro inteiro neste segundo passo, com a fila na mesma
-- aba A confirmar dos moradores.
--
-- Regras desta parte:
-- 1. O link é da unidade ("Esta unidade") ou do prédio todo ("A pessoa escolhe" a unidade). Quem
--    cadastra moradores cria; vale de 1 a 30 dias e pode ser encerrado antes. O código aparece só
--    na hora de criar: o banco guarda o hash (codigos_sem_conta), como nos outros links sem conta.
-- 2. O link pede sempre nome e telefone; o resto (ligação, e-mail, aniversário, família, pets e
--    veículos) só se quem criou marcou.
-- 3. O que a pessoa manda fica separado do cadastro (cadastros_link) até o síndico conferir. Até
--    lá não vale para nada: não recebe comunicado, não fala pela unidade, não aparece em lugar
--    nenhum além da fila.
-- 4. Quem mandou recebe uma chave só sua (o banco guarda o hash). Com ela, no mesmo aparelho,
--    corrige o que mandou enquanto o síndico não conferiu e vê o resultado depois.
-- 5. Só o síndico (moradores.confirmar) aprova ou recusa. Aprovar pode corrigir nome, telefone,
--    ligação e e-mail e tirar familiar, pet ou veículo; entra pelas mesmas funções do painel
--    (pessoa confirmada, família, pets, veículos e e-mail com confirmação pela própria pessoa).
-- 6. Recusar pede o motivo, que a pessoa vê ao abrir o link de novo. Os dados mandados são
--    apagados (os campos ficam vazios); o histórico da unidade guarda só que um cadastro pelo
--    link foi recusado.
-- 7. A fila conta em "A confirmar" (resumo, abas e pendentes de cada unidade), e a lista de
--    pessoas filtra por unidade para o "Pendentes" do menu da linha.

-- ---------------------------------------------------------------------------------------
-- O link.

alter table codigos_sem_conta drop constraint codigos_sem_conta_tipo_check;
alter table codigos_sem_conta add constraint codigos_sem_conta_tipo_check
  check (tipo in ('ETIQUETA', 'PRESTADOR', 'ENQUETE', 'ASSEMBLEIA', 'CADASTRO'));

create table links_cadastro (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  unidade_id      uuid,
  pede            text[] not null default '{}'
                  check (pede <@ array['LIGACAO', 'EMAIL', 'ANIVERSARIO', 'FAMILIA', 'PETS', 'VEICULOS']::text[]),
  expira_em       timestamptz not null,
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid not null references pessoas (id),
  encerrado_em    timestamptz,
  encerrado_por   uuid references pessoas (id),
  versao          integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check (expira_em > criado_em and expira_em <= criado_em + interval '31 days'),
  check ((encerrado_em is null) = (encerrado_por is null))
);
create index links_cadastro_unidade on links_cadastro (unidade_id);
call proteger_tabela_condominio('links_cadastro');
create trigger links_cadastro_sem_exclusao before delete on links_cadastro for each row execute function somente_insercao();

-- O link não muda de unidade nem do que pede; depois de encerrado, não muda mais.
create function links_cadastro_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.unidade_id, new.pede, new.expira_em, new.criado_em, new.criado_por)
     is distinct from (old.condominio_id, old.unidade_id, old.pede, old.expira_em, old.criado_em, old.criado_por) then
    raise exception 'O link de cadastro não muda: encerre e crie outro' using errcode = 'TC422';
  end if;
  if old.encerrado_em is not null then
    raise exception 'Link encerrado não muda' using errcode = 'TC422', detail = '{"motivo":"LINK_ENCERRADO"}';
  end if;
  return new;
end $$;
create trigger links_cadastro_regras before update on links_cadastro for each row execute function links_cadastro_regras();

create function link_cadastro_ativo(l links_cadastro) returns boolean
language sql stable
set search_path = public
as $$ select l.encerrado_em is null and l.expira_em > app_now() $$;

-- ---------------------------------------------------------------------------------------
-- O que chega pelo link.

create table cadastros_link (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  link_id          uuid not null,
  unidade_id       uuid not null,
  chave_hash       bytea not null unique check (length(chave_hash) = 32),
  nome             text check (length(btrim(nome)) between 1 and 120),
  telefone         text check (telefone_valido(telefone)),
  ligacao          text check (ligacao in ('PROPRIETARIO_MORA', 'PROPRIETARIO', 'INQUILINO', 'FAMILIAR', 'OUTRO')),
  email            text check (email_valido(email)),
  aniversario_dia  smallint,
  aniversario_mes  smallint,
  familia          jsonb not null default '[]' check (jsonb_typeof(familia) = 'array' and jsonb_array_length(familia) <= 10),
  pets             jsonb not null default '[]' check (jsonb_typeof(pets) = 'array' and jsonb_array_length(pets) <= 10),
  veiculos         jsonb not null default '[]' check (jsonb_typeof(veiculos) = 'array' and jsonb_array_length(veiculos) <= 5),
  estado           text not null default 'ENVIADO' check (estado in ('ENVIADO', 'APROVADO', 'RECUSADO')),
  enviado_em       timestamptz not null default app_now(),
  corrigido_em     timestamptz,
  decidido_em      timestamptz,
  decidido_por     uuid references pessoas (id),
  motivo_recusa    text check (motivo_recusa in ('NAO_E_DA_UNIDADE', 'NAO_CONHECO', 'JA_CADASTRADO', 'OUTRO')),
  explicacao       text check (length(btrim(explicacao)) between 3 and 500),
  contato_id       uuid references contatos (id),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (link_id, condominio_id) references links_cadastro (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  check (aniversario_valido(aniversario_dia, aniversario_mes)),
  check ((decidido_em is null) = (estado = 'ENVIADO') and (decidido_em is null) = (decidido_por is null)),
  check ((estado = 'RECUSADO') = (motivo_recusa is not null)),
  check ((estado = 'APROVADO') = (contato_id is not null)),
  check (estado = 'RECUSADO' or (nome is not null and telefone is not null)),
  check (estado <> 'RECUSADO' or (nome is null and telefone is null and email is null and aniversario_dia is null
                                  and familia = '[]' and pets = '[]' and veiculos = '[]'))
);
create index cadastros_link_fila on cadastros_link (unidade_id) where estado = 'ENVIADO';
create index cadastros_link_link on cadastros_link (link_id);
call proteger_tabela_condominio('cadastros_link');
create trigger cadastros_link_sem_exclusao before delete on cadastros_link for each row execute function somente_insercao();

-- Depois de conferido, o cadastro não muda mais.
create function cadastros_link_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.link_id, new.chave_hash, new.enviado_em) is distinct from (old.condominio_id, old.link_id, old.chave_hash, old.enviado_em) then
    raise exception 'O cadastro pelo link não muda de link' using errcode = 'TC422';
  end if;
  if old.estado <> 'ENVIADO' then
    raise exception 'Cadastro já conferido' using errcode = 'TC422', detail = '{"motivo":"JA_CONFERIDO"}';
  end if;
  return new;
end $$;
create trigger cadastros_link_regras before update on cadastros_link for each row execute function cadastros_link_regras();

insert into configuracoes (chave, valor, descricao) values
  ('limite_cadastro_max',            '20', 'Envios e correções do link de cadastro pelo mesmo aparelho dentro da janela'),
  ('limite_cadastro_janela_minutos', '60', 'Janela dos envios do link de cadastro'),
  ('cadastro_link_max_envios',       '300', 'Cadastros que um mesmo link aceita');

-- As marcações do vínculo a partir da ligação que a pessoa escolheu.
create function marcas_da_ligacao_cadastro(p text) returns jsonb
language sql immutable
set search_path = public
as $$
  select case p
    when 'PROPRIETARIO_MORA' then '{"proprietario": true, "mora": true, "ligacao": null}'::jsonb
    when 'PROPRIETARIO' then '{"proprietario": true, "mora": false, "ligacao": null}'::jsonb
    when 'INQUILINO' then '{"proprietario": false, "mora": true, "ligacao": "INQUILINO"}'::jsonb
    when 'FAMILIAR' then '{"proprietario": false, "mora": true, "ligacao": "FAMILIAR"}'::jsonb
    when 'OUTRO' then '{"proprietario": false, "mora": true, "ligacao": "OUTRO"}'::jsonb
  end
$$;

-- Família, pets e veículos mandados: confere cada item e devolve só os campos conhecidos.
-- Familiar: {"nome", "parentesco", "mora", "aniversario"?}; pet: {"nome", "especie", "porte"?,
-- "raca"?}; veículo: {"placa", "tipo", "modelo"?}.
create function ler_itens_cadastro(p_tipo text, p jsonb, p_max integer) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  x jsonb;
  v jsonb := '[]';
  a record;
  v_nome text;
  v_texto text;
  v_placa text;
begin
  if p is null then return '[]'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > p_max then perform recusar_campos('Até ' || p_max || ' itens', lower(p_tipo)); end if;
  for x in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(x) <> 'object' then perform recusar_campos('Item inválido', lower(p_tipo)); end if;
    v_nome := btrim(coalesce(x ->> 'nome', ''));
    if p_tipo = 'FAMILIA' then
      if length(v_nome) not between 1 and 120 then perform recusar_campos('Nome do familiar entre 1 e 120 caracteres', 'familia'); end if;
      if coalesce(x ->> 'parentesco', '') not in ('CONJUGE', 'FILHO', 'PAI_MAE', 'OUTRO_PARENTE', 'TRABALHA_NA_CASA') then
        perform recusar_campos('Escolha o parentesco', 'familia');
      end if;
      if coalesce(jsonb_typeof(x -> 'mora'), 'null') not in ('boolean', 'null') then perform recusar_campos('Mora ou não mora', 'familia'); end if;
      a := ler_aniversario(coalesce(nullif(x -> 'aniversario', 'null'::jsonb), '{}'::jsonb));
      v := v || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('nome', v_nome, 'parentesco', x ->> 'parentesco',
             'mora', coalesce((x ->> 'mora')::boolean, true), 'aniversario', aniversario_json(a.dia, a.mes))));
    elsif p_tipo = 'PETS' then
      if length(v_nome) not between 1 and 60 then perform recusar_campos('Nome do pet entre 1 e 60 caracteres', 'pets'); end if;
      if coalesce(x ->> 'especie', '') not in ('CAO', 'GATO', 'OUTRO') then perform recusar_campos('Escolha a espécie', 'pets'); end if;
      if x ->> 'porte' is not null and x ->> 'porte' not in ('PEQUENO', 'MEDIO', 'GRANDE') then perform recusar_campos('Porte pequeno, médio ou grande', 'pets'); end if;
      v_texto := nullif(btrim(coalesce(x ->> 'raca', '')), '');
      if v_texto is not null and length(v_texto) not between 2 and 60 then perform recusar_campos('Raça de 2 a 60 caracteres', 'pets'); end if;
      v := v || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('nome', v_nome, 'especie', x ->> 'especie',
             'porte', x ->> 'porte', 'raca', v_texto)));
    else
      v_placa := normalizar_placa(x ->> 'placa');
      if v_placa is null then perform recusar_campos('Placa Mercosul (ABC1D23) ou antiga (ABC-1234)', 'veiculos'); end if;
      if coalesce(x ->> 'tipo', '') not in ('CARRO', 'MOTO', 'OUTRO') then perform recusar_campos('Tipo do veículo', 'veiculos'); end if;
      v_texto := nullif(btrim(coalesce(x ->> 'modelo', '')), '');
      if v_texto is not null and length(v_texto) not between 2 and 60 then perform recusar_campos('Modelo e cor de 2 a 60 caracteres', 'veiculos'); end if;
      v := v || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('placa', v_placa, 'tipo', x ->> 'tipo', 'modelo', v_texto)));
    end if;
  end loop;
  return v;
end $$;

create function cadastro_link_json(c cadastros_link) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'linkId', c.link_id, 'unidadeId', c.unidade_id, 'unidade', rotulo_unidade(c.unidade_id),
    'nome', c.nome, 'telefone', c.telefone, 'ligacao', c.ligacao, 'email', c.email,
    'aniversario', aniversario_json(c.aniversario_dia, c.aniversario_mes),
    'familia', c.familia, 'pets', c.pets, 'veiculos', c.veiculos,
    'estado', c.estado, 'enviadoEm', c.enviado_em, 'corrigidoEm', c.corrigido_em, 'decididoEm', c.decidido_em,
    'motivo', c.motivo_recusa, 'explicacao', c.explicacao, 'versao', c.versao))
$$;

create function link_cadastro_json(l links_cadastro) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', l.id, 'unidadeId', l.unidade_id, 'unidade', case when l.unidade_id is not null then rotulo_unidade(l.unidade_id) end,
    'pede', to_jsonb(l.pede), 'expiraEm', l.expira_em, 'criadoEm', l.criado_em, 'criadoPor', nome_pessoa(l.criado_por),
    'encerradoEm', l.encerrado_em, 'ativo', link_cadastro_ativo(l),
    'envios', (select count(*) from cadastros_link c where c.link_id = l.id),
    'aConferir', (select count(*) from cadastros_link c where c.link_id = l.id and c.estado = 'ENVIADO'),
    'versao', l.versao))
$$;

-- ---------------------------------------------------------------------------------------
-- Do lado do síndico.

-- Criar o link: p_unidade nula serve para o prédio todo (a pessoa escolhe a unidade).
create function plataforma_criar_link_cadastro(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_pede text[], p_dias integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_cadastro;
  v_codigo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_unidade is not null then perform exigir_unidade_ativa(p_unidade); end if;
  if p_dias is null or p_dias not in (1, 3, 7, 15, 30) then perform recusar_campos('Vale por 1, 3, 7, 15 ou 30 dias', 'dias'); end if;
  if p_pede is null or not (p_pede <@ array['LIGACAO', 'EMAIL', 'ANIVERSARIO', 'FAMILIA', 'PETS', 'VEICULOS']::text[]) then
    perform recusar_campos('O que pedir', 'pede');
  end if;
  insert into links_cadastro (condominio_id, unidade_id, pede, expira_em, criado_por)
  values (p_condominio, p_unidade, (select coalesce(array_agg(distinct x order by x), '{}') from unnest(p_pede) x),
          app_now() + make_interval(days => p_dias), p_pessoa)
  returning * into l;
  v_codigo := gerar_codigo_sem_conta('CADASTRO', l.id);
  if p_unidade is not null then
    perform registrar_historico('unidade.link_cadastro_criado', 'unidade', p_unidade::text, jsonb_build_object('link', l.id));
  else
    perform registrar_historico('link_cadastro.criado', 'link_cadastro', l.id::text);
  end if;
  return link_cadastro_json(l) || jsonb_build_object('codigo', v_codigo);
end $$;

-- Os links ainda valendo: da unidade, ou os do prédio todo com p_unidade nula.
create function plataforma_links_cadastro(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(link_cadastro_json(l) order by l.criado_em desc) from links_cadastro l
                        where l.unidade_id is not distinct from p_unidade and link_cadastro_ativo(l)), '[]'::jsonb),
    'unidade', case when p_unidade is not null then rotulo_unidade(p_unidade) end,
    'podeCriar', pode(p_pessoa, p_condominio, 'moradores.editar'));
end $$;

create function plataforma_encerrar_link_cadastro(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_cadastro;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into l from links_cadastro where id = p_id;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  if l.encerrado_em is not null then perform recusar_motivo('O link já foi encerrado', 'LINK_ENCERRADO'); end if;
  update links_cadastro set encerrado_em = app_now(), encerrado_por = p_pessoa where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('links_cadastro', p_id); end if;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'CADASTRO' and alvo_id = p_id and revogado_em is null;
  if l.unidade_id is not null then
    perform registrar_historico('unidade.link_cadastro_encerrado', 'unidade', l.unidade_id::text, jsonb_build_object('link', l.id));
  else
    perform registrar_historico('link_cadastro.encerrado', 'link_cadastro', l.id::text);
  end if;
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- A fila: o que chegou pelo link e espera o síndico, de todas as unidades ou de uma.
create function plataforma_cadastros_link(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(cadastro_link_json(c) || jsonb_build_object('linkAtivo', link_cadastro_ativo(l), 'linkExpiraEm', l.expira_em)
                                        order by c.enviado_em)
                         from cadastros_link c join links_cadastro l on l.id = c.link_id join unidades u on u.id = c.unidade_id and u.ativa
                        where c.estado = 'ENVIADO' and (p_unidade is null or c.unidade_id = p_unidade)), '[]'::jsonb),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'));
end $$;

-- Aprovar: a pessoa entra confirmada na unidade (mesmo contato quando o telefone e o nome já
-- estão no condomínio), com a família, os pets, os veículos e o e-mail que ficaram.
create function plataforma_aprovar_cadastro_link(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                                 p_telefone text, p_ligacao text, p_email text, p_familia jsonb, p_pets jsonb,
                                                 p_veiculos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c cadastros_link;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_familia jsonb;
  v_pets jsonb;
  v_veiculos jsonb;
  v_contato uuid;
  v_r jsonb;
  x jsonb;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.confirmar');
  select * into c from cadastros_link where id = p_id for update;
  if not found then raise exception 'Cadastro não encontrado' using errcode = 'TC404'; end if;
  if c.estado <> 'ENVIADO' then perform recusar_motivo('Este cadastro já foi conferido', 'JA_CONFERIDO'); end if;
  if c.versao <> p_versao then perform conflito_versao('cadastros_link', p_id); end if;
  if length(v_nome) not between 1 and 120 then perform recusar_campos('Nome entre 1 e 120 caracteres', 'nome'); end if;
  if not coalesce(telefone_valido(p_telefone), false) then perform recusar_campos('Telefone inválido', 'telefone'); end if;
  if marcas_da_ligacao_cadastro(p_ligacao) is null then perform recusar_campos('Diga a ligação com a unidade', 'ligacao'); end if;
  if v_email is not null and not email_valido(v_email) then perform recusar_campos('E-mail inválido', 'email'); end if;
  v_familia := ler_itens_cadastro('FAMILIA', p_familia, 10);
  v_pets := ler_itens_cadastro('PETS', p_pets, 10);
  v_veiculos := ler_itens_cadastro('VEICULOS', p_veiculos, 5);

  -- O mesmo telefone com o mesmo nome já no condomínio é a mesma pessoa.
  select ct.id into v_contato from contatos ct
   where ct.telefone = p_telefone and ct.dados_removidos_em is null and lower(btrim(ct.nome)) = lower(v_nome)
   order by ct.criado_em limit 1;
  if v_contato is not null and exists (select 1 from contatos_unidade cu where cu.contato_id = v_contato and cu.unidade_id = c.unidade_id
                                                                         and cu.estado <> 'ENCERRADO') then
    perform recusar_motivo('Esta pessoa já está nesta unidade', 'CONTATO_JA_NA_UNIDADE');
  end if;
  v_r := plataforma_incluir_pessoa_unidade(p_pessoa, p_condominio, c.unidade_id, v_contato, case when v_contato is null then v_nome end,
                                           case when v_contato is null then p_telefone end,
                                           marcas_da_ligacao_cadastro(p_ligacao) || '{"principal": false}'::jsonb, true, null,
                                           aniversario_json(c.aniversario_dia, c.aniversario_mes));
  v_contato := (v_r ->> 'contatoId')::uuid;
  if v_email is not null then
    v_r := v_r || jsonb_build_object('email', plataforma_email_contato(p_pessoa, p_condominio, v_contato,
                                                                       (select versao from contatos where id = v_contato), v_email, true));
  end if;
  for x in select * from jsonb_array_elements(v_familia) loop
    perform plataforma_salvar_familiar(p_pessoa, p_condominio, null, null, c.unidade_id, x ->> 'nome', x ->> 'parentesco',
                                       (x ->> 'mora')::boolean, coalesce(x -> 'aniversario', '{}'::jsonb));
  end loop;
  for x in select * from jsonb_array_elements(v_pets) loop
    perform plataforma_salvar_pet(p_pessoa, p_condominio, null, null, c.unidade_id, x ->> 'nome', x ->> 'especie', x ->> 'porte',
                                  x ->> 'raca', null);
  end loop;
  for x in select * from jsonb_array_elements(v_veiculos) loop
    perform plataforma_salvar_veiculo(p_pessoa, p_condominio, null, null, c.unidade_id, x ->> 'placa', x ->> 'tipo', x ->> 'modelo',
                                      v_contato, null);
  end loop;
  update cadastros_link set estado = 'APROVADO', decidido_em = app_now(), decidido_por = p_pessoa, contato_id = v_contato
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('cadastros_link', p_id); end if;
  perform registrar_historico('unidade.cadastro_link_aprovado', 'unidade', c.unidade_id::text,
                              jsonb_build_object('cadastro', p_id, 'contato', v_contato, 'familia', jsonb_array_length(v_familia),
                                                 'pets', jsonb_array_length(v_pets), 'veiculos', jsonb_array_length(v_veiculos)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'contatoId', v_contato, 'vinculoId', v_r ->> 'vinculoId',
                            'avisos', coalesce(v_r -> 'avisos', '[]'::jsonb),
                            'confirmacaoNaFila', coalesce((v_r -> 'email' ->> 'confirmacaoNaFila')::boolean, false));
end $$;

-- Recusar: guarda o motivo para a pessoa ver e apaga os dados mandados.
create function plataforma_recusar_cadastro_link(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text,
                                                 p_explicacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c cadastros_link;
  v_explicacao text := nullif(btrim(coalesce(p_explicacao, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.confirmar');
  select * into c from cadastros_link where id = p_id for update;
  if not found then raise exception 'Cadastro não encontrado' using errcode = 'TC404'; end if;
  if c.estado <> 'ENVIADO' then perform recusar_motivo('Este cadastro já foi conferido', 'JA_CONFERIDO'); end if;
  if c.versao <> p_versao then perform conflito_versao('cadastros_link', p_id); end if;
  if p_motivo is null or p_motivo not in ('NAO_E_DA_UNIDADE', 'NAO_CONHECO', 'JA_CADASTRADO', 'OUTRO') then
    perform recusar_campos('Escolha o motivo', 'motivo');
  end if;
  if v_explicacao is not null and length(v_explicacao) not between 3 and 500 then perform recusar_campos('Explicação de 3 a 500 caracteres', 'explicacao'); end if;
  if p_motivo = 'OUTRO' and v_explicacao is null then perform recusar_campos('Explique o motivo', 'explicacao'); end if;
  update cadastros_link
     set estado = 'RECUSADO', decidido_em = app_now(), decidido_por = p_pessoa, motivo_recusa = p_motivo, explicacao = v_explicacao,
         nome = null, telefone = null, ligacao = null, email = null, aniversario_dia = null, aniversario_mes = null,
         familia = '[]', pets = '[]', veiculos = '[]'
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('cadastros_link', p_id); end if;
  perform registrar_historico('unidade.cadastro_link_recusado', 'unidade', c.unidade_id::text, jsonb_build_object('cadastro', p_id, 'motivo', p_motivo));
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Sem conta: a página do link. O código do link é a entrada; a chave de quem mandou é a dele.

create function exigir_link_cadastro(p_codigo text) returns links_cadastro
language plpgsql
set search_path = public
as $$
declare
  k codigos_sem_conta;
  l links_cadastro;
begin
  k := entrar_por_codigo(p_codigo, 'CADASTRO');
  select * into l from links_cadastro where id = k.alvo_id;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  return l;
end $$;

create function cadastro_da_chave(l links_cadastro, p_chave text) returns cadastros_link
language plpgsql
set search_path = public
as $$
declare c cadastros_link;
begin
  if p_chave is null then return null; end if;
  select * into c from cadastros_link where chave_hash = hash_codigo(p_chave) and link_id = l.id;
  return c;
end $$;

-- O que a página mostra: o condomínio, a unidade (ou as unidades para escolher), o que o link
-- pede e, com a chave, o que a pessoa já mandou e a situação.
create function cadastro_publico_json(l links_cadastro, c cadastros_link) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'condominio', (select nome from condominios where id = l.condominio_id),
    'unidadeId', l.unidade_id,
    'unidade', case when l.unidade_id is not null then rotulo_unidade(l.unidade_id) end,
    'unidades', case when l.unidade_id is null and link_cadastro_ativo(l) then
                  coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id))
                                             order by chave_unidade(coalesce((select nome from blocos where id = u.bloco_id), '')),
                                                      chave_andar(u.andar), chave_unidade(u.identificacao))
                              from unidades u where u.ativa), '[]'::jsonb) end,
    'pede', to_jsonb(l.pede),
    'expiraEm', l.expira_em,
    'aberto', link_cadastro_ativo(l),
    'envio', case when c.id is not null then
               cadastro_link_json(c) - 'id' - 'linkId' - 'versao' - 'decididoEm' - 'corrigidoEm'
               || jsonb_build_object('unidade', rotulo_unidade(c.unidade_id)) end))
$$;

create function publico_cadastro(p_codigo text, p_chave text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare l links_cadastro;
begin
  l := exigir_link_cadastro(p_codigo);
  return cadastro_publico_json(l, cadastro_da_chave(l, p_chave));
end $$;

-- Mandar ou corrigir. Sem chave cria um cadastro novo e devolve a chave (uma vez só); com a
-- chave corrige o que ainda não foi conferido.
create function publico_enviar_cadastro(p_codigo text, p_chave text, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_cadastro;
  c cadastros_link;
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_unidade uuid;
  v_nome text := btrim(coalesce(d ->> 'nome', ''));
  v_telefone text := d ->> 'telefone';
  v_ligacao text;
  v_email text;
  a record;
  v_familia jsonb := '[]';
  v_pets jsonb := '[]';
  v_veiculos jsonb := '[]';
  v_chave text;
begin
  l := exigir_link_cadastro(p_codigo);
  if not link_cadastro_ativo(l) then perform recusar_motivo('Este link não aceita mais cadastro', 'LINK_FECHADO'); end if;
  if p_chave is not null then
    c := cadastro_da_chave(l, p_chave);
    if c.id is null then raise exception 'Cadastro não encontrado' using errcode = 'TC404'; end if;
    if c.estado <> 'ENVIADO' then perform recusar_motivo('O condomínio já conferiu este cadastro', 'JA_CONFERIDO'); end if;
  elsif (select count(*) from cadastros_link where link_id = l.id) >= configuracao_int('cadastro_link_max_envios') then
    perform recusar_motivo('Este link já recebeu cadastros demais. Peça um novo ao condomínio.', 'LIMITE_LINK');
  end if;

  if l.unidade_id is not null then
    v_unidade := l.unidade_id;
  else
    begin
      v_unidade := (d ->> 'unidadeId')::uuid;
    exception when invalid_text_representation then
      perform recusar_campos('Escolha a unidade', 'unidadeId');
    end;
    if v_unidade is null or not exists (select 1 from unidades where id = v_unidade and ativa) then
      perform recusar_campos('Escolha a unidade', 'unidadeId');
    end if;
  end if;
  if length(v_nome) not between 1 and 120 then perform recusar_campos('Nome entre 1 e 120 caracteres', 'nome'); end if;
  if not coalesce(telefone_valido(v_telefone), false) then perform recusar_campos('Telefone inválido', 'telefone'); end if;
  if 'LIGACAO' = any (l.pede) then
    v_ligacao := d ->> 'ligacao';
    if marcas_da_ligacao_cadastro(v_ligacao) is null then perform recusar_campos('Diga sua ligação com a unidade', 'ligacao'); end if;
  end if;
  if 'EMAIL' = any (l.pede) then
    v_email := nullif(btrim(coalesce(d ->> 'email', '')), '');
    if v_email is not null and not email_valido(v_email) then perform recusar_campos('E-mail inválido', 'email'); end if;
  end if;
  a := ler_aniversario(case when 'ANIVERSARIO' = any (l.pede) then coalesce(nullif(d -> 'aniversario', 'null'::jsonb), '{}'::jsonb) else '{}'::jsonb end);
  if 'FAMILIA' = any (l.pede) then v_familia := ler_itens_cadastro('FAMILIA', d -> 'familia', 10); end if;
  if 'PETS' = any (l.pede) then v_pets := ler_itens_cadastro('PETS', d -> 'pets', 10); end if;
  if 'VEICULOS' = any (l.pede) then v_veiculos := ler_itens_cadastro('VEICULOS', d -> 'veiculos', 5); end if;

  if c.id is null then
    v_chave := novo_codigo();
    insert into cadastros_link (condominio_id, link_id, unidade_id, chave_hash, nome, telefone, ligacao, email, aniversario_dia,
                                aniversario_mes, familia, pets, veiculos)
    values (l.condominio_id, l.id, v_unidade, hash_codigo(v_chave), v_nome, v_telefone, v_ligacao, v_email, a.dia, a.mes,
            v_familia, v_pets, v_veiculos)
    returning * into c;
    perform registrar_historico('unidade.cadastro_link_enviado', 'unidade', v_unidade::text, jsonb_build_object('cadastro', c.id));
  else
    update cadastros_link set unidade_id = v_unidade, nome = v_nome, telefone = v_telefone, ligacao = v_ligacao, email = v_email,
                              aniversario_dia = a.dia, aniversario_mes = a.mes, familia = v_familia, pets = v_pets,
                              veiculos = v_veiculos, corrigido_em = app_now()
     where id = c.id returning * into c;
  end if;
  return cadastro_publico_json(l, c) || case when v_chave is not null then jsonb_build_object('chave', v_chave) else '{}'::jsonb end;
end $$;

-- ---------------------------------------------------------------------------------------
-- A fila conta em "A confirmar": o resumo, a lista de unidades e a lista de pessoas.

create or replace function resumo_moradores(p_condominio uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'unidades', (select count(*) from unidades u where u.condominio_id = p_condominio and u.ativa),
    'semContato', (select count(*) from unidades u where u.condominio_id = p_condominio and u.ativa
                     and not exists (select 1 from contatos_unidade cu where cu.unidade_id = u.id and cu.estado = 'CONFIRMADO')),
    'aConfirmar', (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa
                    where cu.condominio_id = p_condominio and cu.estado = 'PENDENTE')
                + (select count(*) from cadastros_link c join unidades u on u.id = c.unidade_id and u.ativa
                    where c.condominio_id = p_condominio and c.estado = 'ENVIADO'),
    'semProprietario', (select count(*) from unidades u where u.condominio_id = p_condominio and u.ativa and falta_proprietario(u.id)))
$$;

alter function plataforma_unidades(uuid, uuid) rename to unidades_r5;
alter function unidades_r5(uuid, uuid) security invoker;
create function plataforma_unidades(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidades_r5(p_pessoa, p_condominio);
  return v || jsonb_build_object(
    'unidades', coalesce((
      select jsonb_agg(x.item || jsonb_build_object(
                         'pendentes', (x.item ->> 'pendentes')::integer + n.envios,
                         'cadastrosLink', n.envios)
                       order by x.n)
        from jsonb_array_elements(v -> 'unidades') with ordinality x(item, n)
        cross join lateral (select count(*)::integer as envios from cadastros_link c
                             where c.unidade_id = (x.item ->> 'id')::uuid and c.estado = 'ENVIADO') n), '[]'::jsonb));
end $$;

-- A lista de pessoas (0284) com o filtro por unidade e a conta do que veio pelo link.
alter function plataforma_moradores(uuid, uuid, text, text, integer) rename to moradores_r6;
alter function moradores_r6(uuid, uuid, text, text, integer) security invoker;
create function plataforma_moradores(p_pessoa uuid, p_condominio uuid, p_busca text, p_estado text, p_pagina integer,
                                     p_unidade uuid default null)
returns jsonb
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
  if p_unidade is null then
    v := moradores_r6(p_pessoa, p_condominio, p_busca, p_estado, p_pagina);
    return v || jsonb_build_object('aConfirmar', (v ->> 'aConfirmar')::integer + (select count(*) from cadastros_link c
                                                    join unidades u on u.id = c.unidade_id and u.ativa where c.estado = 'ENVIADO'));
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_estado is not null and p_estado not in ('PENDENTE', 'CONFIRMADO', 'SEM_EMAIL', 'SEM_WHATSAPP') then
    perform recusar_campos('Situação desconhecida', 'estado');
  end if;
  perform exigir_unidade(p_unidade);
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_digitos := nullif(regexp_replace(coalesce(v_busca, ''), '\D', '', 'g'), '');
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with lista as (
    select cu.id, cu.contato_id, ct.nome, ct.telefone, ct.email_situacao, recebe_comunicado_whatsapp(ct) as whatsapp,
           cu.unidade_id, u.identificacao, u.andar, b.nome as bloco,
           cu.relacao, cu.principal, cu.estado, cu.origem, cu.versao
      from contatos_unidade cu
      join contatos ct on ct.id = cu.contato_id
      join unidades u on u.id = cu.unidade_id
      left join blocos b on b.id = u.bloco_id
     where cu.estado <> 'ENCERRADO'
       and cu.unidade_id = p_unidade
       and (p_estado is null
            or (p_estado = 'SEM_EMAIL' and ct.email_situacao is distinct from 'CONFIRMADO')
            or (p_estado = 'SEM_WHATSAPP' and not recebe_comunicado_whatsapp(ct))
            or cu.estado = p_estado)
       and (v_busca is null
            or ct.nome ilike '%' || v_busca || '%'
            or ct.email ilike '%' || v_busca || '%'
            or (length(v_digitos) >= 4 and ct.telefone like '%' || v_digitos || '%'))
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'vinculoId', l.id, 'contatoId', l.contato_id, 'nome', l.nome, 'telefone', l.telefone, 'unidadeId', l.unidade_id,
               'unidade', l.identificacao, 'andar', l.andar, 'bloco', l.bloco, 'relacao', l.relacao, 'principal', l.principal,
               'estado', l.estado, 'origem', l.origem, 'versao', l.versao, 'emailSituacao', l.email_situacao,
               'comunicadosWhatsapp', l.whatsapp)) order by l.ordem)
             from (select *, row_number() over (order by principal desc, lower(nome)) as ordem from lista) l
            where l.ordem > (v_pagina - 1) * 50 and l.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from lista),
    'pagina', v_pagina,
    'porPagina', 50,
    'unidade', jsonb_build_object('id', p_unidade, 'nome', rotulo_unidade(p_unidade)),
    'aConfirmar', (select count(*) from contatos_unidade cu where cu.unidade_id = p_unidade and cu.estado = 'PENDENTE')
                + (select count(*) from cadastros_link c where c.unidade_id = p_unidade and c.estado = 'ENVIADO'),
    'semEmail', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                  where cu.unidade_id = p_unidade and cu.estado <> 'ENCERRADO' and ct.email_situacao is distinct from 'CONFIRMADO'),
    'semWhatsapp', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                     where cu.unidade_id = p_unidade and cu.estado <> 'ENCERRADO' and not recebe_comunicado_whatsapp(ct)),
    'comunicadosWhatsappLigado', comunicados_whatsapp_ativos(),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'))
    into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- O histórico da unidade (0287) com o link de cadastro.

alter function historico_da_unidade(uuid) rename to historico_da_unidade_r1;
create function historico_da_unidade(p_unidade uuid)
returns table (id bigint, em timestamptz, categoria text, titulo text, detalhe text, autor text)
language sql stable
set search_path = public
as $$
  select h.id, h.em,
         case when x.acao like 'unidade.cadastro_link%' or x.acao like 'unidade.link_cadastro%' then 'PESSOAS' else h.categoria end,
         case x.acao
           when 'unidade.link_cadastro_criado' then 'Link de cadastro criado'
           when 'unidade.link_cadastro_encerrado' then 'Link de cadastro encerrado'
           when 'unidade.cadastro_link_enviado' then 'Cadastro recebido pelo link'
           when 'unidade.cadastro_link_aprovado' then
             coalesce((select case when ct.dados_removidos_em is not null then 'Pessoa removida' else ct.nome end
                         from contatos ct where ct.id::text = x.dados ->> 'contato') || ': cadastro pelo link aprovado', 'Cadastro pelo link aprovado')
           when 'unidade.cadastro_link_recusado' then 'Cadastro pelo link recusado'
           else h.titulo end,
         case x.acao
           when 'unidade.cadastro_link_enviado' then 'espera o síndico conferir'
           when 'unidade.cadastro_link_aprovado' then
             nullif(concat_ws(', ',
               case when (x.dados ->> 'familia')::integer > 0 then (x.dados ->> 'familia') || ' da família' end,
               case when (x.dados ->> 'pets')::integer = 1 then '1 pet' when (x.dados ->> 'pets')::integer > 1 then (x.dados ->> 'pets') || ' pets' end,
               case when (x.dados ->> 'veiculos')::integer = 1 then '1 veículo' when (x.dados ->> 'veiculos')::integer > 1 then (x.dados ->> 'veiculos') || ' veículos' end), '')
           when 'unidade.cadastro_link_recusado' then
             case x.dados ->> 'motivo' when 'NAO_E_DA_UNIDADE' then 'não é desta unidade' when 'NAO_CONHECO' then 'pessoa desconhecida'
                                       when 'JA_CADASTRADO' then 'já estava no cadastro' else 'outro motivo' end || ', os dados foram apagados'
           else h.detalhe end,
         h.autor
    from historico_da_unidade_r1(p_unidade) h
    join historico x on x.id = h.id
$$;

call fechar_acesso();

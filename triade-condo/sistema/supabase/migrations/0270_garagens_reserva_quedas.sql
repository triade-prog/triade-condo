-- 0270 · Garagens e veículos (F3.8; MU-11, MU-06 em parte), troca automática para o prestador
-- reserva (F5.9; MP-09) e queda do WhatsApp (F5.10; W-17). Desenho em
-- docs/telas/garagens-reserva-quedas.html.
--
-- Regras desta parte:
-- 1. Placa (MU-06): Mercosul (ABC1D23) ou antiga (ABC1234), guardada em maiúsculas e sem hífen.
--    A mesma placa não fica em uso em duas unidades. Placa é dado pessoal: não vai ao histórico,
--    ao mural nem ao WhatsApp; remover os dados de quem saiu apaga as placas dos veículos dele.
-- 2. Vaga: identificação livre, única entre as vagas em uso; é de uma unidade ou do condomínio.
--    O veículo fica numa vaga da própria unidade, ou sem vaga. Nada se apaga: a vaga sai de uso
--    (só sem veículo nela) e o veículo é retirado.
-- 3. Veículo de quem sai, sai junto: encerrar o vínculo da pessoa retira os veículos ligados a
--    ela naquela unidade, com registro.
-- 4. Busca da lista de unidades (MU-11): identificação, nome, telefone e placa em uso.
-- 5. Reserva (MP-09): ao mandar o link, um prazo de 4, 8, 24 ou 48 horas corridas para o
--    prestador responder. Responder é confirmar, recusar ou registrar a chegada; abrir não conta.
--    Sem resposta no prazo (esperando o próximo horário de funcionamento) ou com recusa, o
--    serviço passa para a reserva do cadastro: uma vez por link, só com a manutenção aberta,
--    quem executa ainda o principal e a reserva ativa. Toda troca vai para o histórico, cancela
--    o link do principal e avisa o responsável no sino. O link da reserva sai pelo WhatsApp do
--    condomínio (o código nasce na hora do envio); sem número conectado ou sem celular, o
--    responsável é avisado para mandar.
-- 6. Queda (W-17): abre quando o número desconecta, ou à mão; uma por vez; quem cuida vem das
--    configurações do WhatsApp (padrão, o síndico). O canal alternativo aparece nas etiquetas e
--    no mural enquanto o número estiver fora. O que entra na fila fica parado; ao voltar, a
--    resposta automática e o aviso à equipe que perderam o sentido saem como não mandados e o
--    resto espera a decisão de quem cuida (mandar agora, resolvido por outro canal, não
--    mandar). Só encerra com o número de volta, nada parado e um resumo.

-- ---------------------------------------------------------------------------------------
-- Garagens e veículos (MU-06, MU-11).

create table vagas (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  identificacao  text not null check (length(btrim(identificacao)) between 1 and 20),
  onde           text check (length(btrim(onde)) between 2 and 60),
  coberta        boolean,
  unidade_id     uuid,
  ativa          boolean not null default true,
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid not null references pessoas (id),
  versao         integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id)
);
create unique index vagas_identificacao_ativa on vagas (condominio_id, lower(btrim(identificacao))) where ativa;
create index vagas_unidade on vagas (unidade_id) where unidade_id is not null;
call proteger_tabela_condominio('vagas');
create trigger vagas_sem_exclusao before delete on vagas for each row execute function somente_insercao();

create table veiculos (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  unidade_id      uuid not null,
  placa           text check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  tipo            text not null check (tipo in ('CARRO', 'MOTO', 'OUTRO')),
  modelo          text check (length(btrim(modelo)) between 2 and 60),
  contato_id      uuid,
  vaga_id         uuid,
  retirado_em     timestamptz,
  retirado_por    uuid references pessoas (id),
  motivo_retirada text check (motivo_retirada in ('RETIRADO', 'SAIU')),
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid not null references pessoas (id),
  versao          integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (vaga_id, condominio_id) references vagas (id, condominio_id),
  check ((retirado_em is null) = (motivo_retirada is null)),
  check (retirado_em is not null or placa is not null)
);
create unique index veiculos_placa_em_uso on veiculos (condominio_id, placa) where retirado_em is null;
create index veiculos_unidade on veiculos (unidade_id);
create index veiculos_contato on veiculos (contato_id) where contato_id is not null;
call proteger_tabela_condominio('veiculos');
create trigger veiculos_sem_exclusao before delete on veiculos for each row execute function somente_insercao();

-- Veículo retirado não volta; depois de retirado, só se apagam a placa e o modelo (PT-11).
create function veiculos_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.unidade_id, new.criado_em, new.criado_por) is distinct from (old.condominio_id, old.unidade_id, old.criado_em, old.criado_por) then
    raise exception 'O veículo não muda de unidade: retire e cadastre na outra' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (
       (new.tipo, new.contato_id, new.vaga_id, new.retirado_em, new.retirado_por, new.motivo_retirada)
         is distinct from (old.tipo, old.contato_id, old.vaga_id, old.retirado_em, old.retirado_por, old.motivo_retirada)
       or (new.placa is not null and new.placa is distinct from old.placa)
       or (new.modelo is not null and new.modelo is distinct from old.modelo)) then
    raise exception 'Veículo retirado não muda' using errcode = 'TC422', detail = '{"motivo":"VEICULO_RETIRADO"}';
  end if;
  return new;
end $$;
create trigger veiculos_regras before update on veiculos for each row execute function veiculos_regras();

-- Vaga fora de uso não volta, a não ser pela própria tela (reativar); vaga com veículo não sai de uso.
create function vagas_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.criado_em, new.criado_por) is distinct from (old.condominio_id, old.criado_em, old.criado_por) then
    raise exception 'A vaga não muda de condomínio nem de autoria' using errcode = 'TC422';
  end if;
  if old.ativa and not new.ativa and exists (select 1 from veiculos where vaga_id = new.id and retirado_em is null) then
    raise exception 'Tire o veículo da vaga antes' using errcode = 'TC422', detail = '{"motivo":"VAGA_COM_VEICULO"}';
  end if;
  if new.unidade_id is distinct from old.unidade_id
     and exists (select 1 from veiculos where vaga_id = new.id and retirado_em is null and unidade_id is distinct from new.unidade_id) then
    raise exception 'Tire o veículo da vaga antes de passar a vaga a outra unidade' using errcode = 'TC422', detail = '{"motivo":"VAGA_COM_VEICULO"}';
  end if;
  return new;
end $$;
create trigger vagas_regras before update on vagas for each row execute function vagas_regras();

-- Placa no formato do cadastro: maiúsculas, sem hífen nem espaço. Fora dos dois formatos, null.
create function normalizar_placa(p text) returns text
language sql immutable
set search_path = public
as $$
  select case when x ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then x end
    from (select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) as x) s
$$;

-- "ABC-1234" na antiga; a Mercosul fica como é ("ABC1D23").
create function mostrar_placa(p text) returns text
language sql immutable
set search_path = public
as $$ select case when p ~ '^[A-Z]{3}[0-9]{4}$' then left(p, 3) || '-' || right(p, 4) else p end $$;

-- Encerrar o vínculo de alguém retira os veículos dele naquela unidade (decisão 4).
create function veiculos_de_quem_saiu() returns trigger
language plpgsql
set search_path = public
as $$
declare v record;
begin
  if new.estado = 'ENCERRADO' and old.estado <> 'ENCERRADO' then
    for v in update veiculos set retirado_em = app_now(), retirado_por = contexto_pessoa(), motivo_retirada = 'SAIU'
              where contato_id = new.contato_id and unidade_id = new.unidade_id and retirado_em is null returning id loop
      perform registrar_historico('unidade.veiculo_retirado', 'unidade', new.unidade_id::text,
        jsonb_build_object('veiculo', v.id, 'motivo', 'SAIU'));
    end loop;
  end if;
  return new;
end $$;
create trigger contatos_unidade_veiculos after update of estado on contatos_unidade
  for each row execute function veiculos_de_quem_saiu();

-- Remover os dados pessoais de quem saiu apaga as placas e os modelos dos veículos dele (PT-11).
create function placas_de_dados_removidos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.dados_removidos_em is not null and old.dados_removidos_em is null then
    update veiculos set retirado_em = coalesce(retirado_em, app_now()), retirado_por = coalesce(retirado_por, contexto_pessoa()),
                        motivo_retirada = coalesce(motivo_retirada, 'SAIU')
     where contato_id = new.id and retirado_em is null;
    update veiculos set placa = null, modelo = null where contato_id = new.id;
  end if;
  return new;
end $$;
create trigger contatos_placas after update of dados_removidos_em on contatos
  for each row execute function placas_de_dados_removidos();

-- Unidade com veículo em uso não é desativada (como contato e bloco).
create function unidade_sem_veiculo() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.ativa and not new.ativa and exists (select 1 from veiculos where unidade_id = new.id and retirado_em is null) then
    raise exception 'Retire os veículos da unidade antes' using errcode = 'TC422', detail = '{"motivo":"UNIDADE_COM_VEICULO"}';
  end if;
  return new;
end $$;
create trigger unidades_sem_veiculo before update of ativa on unidades for each row execute function unidade_sem_veiculo();

create function vaga_json(v vagas) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'identificacao', v.identificacao, 'onde', v.onde, 'coberta', v.coberta, 'unidadeId', v.unidade_id,
    'unidade', rotulo_unidade(v.unidade_id), 'ativa', v.ativa, 'versao', v.versao,
    'veiculos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'placa', mostrar_placa(x.placa), 'tipo', x.tipo, 'modelo', x.modelo)
                                           order by x.placa)
                            from veiculos x where x.vaga_id = v.id and x.retirado_em is null), '[]'::jsonb)))
$$;

create function veiculo_json(x veiculos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', x.id, 'placa', mostrar_placa(x.placa), 'tipo', x.tipo, 'modelo', x.modelo, 'unidadeId', x.unidade_id,
    'contatoId', x.contato_id, 'contato', (select nome from contatos where id = x.contato_id),
    'vagaId', x.vaga_id, 'vaga', (select identificacao from vagas where id = x.vaga_id),
    'versao', x.versao))
$$;

-- Moradores e unidades › Garagens: todas as vagas, com a unidade e o veículo de cada uma.
create function plataforma_garagens(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  return jsonb_build_object(
    'vagas', coalesce((select jsonb_agg(vaga_json(v) order by v.ativa desc, chave_unidade(v.identificacao)) from vagas v), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'vagas', (select count(*) from vagas where ativa),
      'deUnidades', (select count(*) from vagas where ativa and unidade_id is not null),
      'doCondominio', (select count(*) from vagas where ativa and unidade_id is null),
      'veiculos', (select count(*) from veiculos where retirado_em is null),
      'semVaga', (select count(*) from veiculos where retirado_em is null and vaga_id is null)),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id))
                                           order by chave_unidade(coalesce((select nome from blocos where id = u.bloco_id), '')), chave_andar(u.andar), chave_unidade(u.identificacao))
                            from unidades u where u.ativa), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'));
end $$;

create function plataforma_salvar_vaga(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_identificacao text,
                                       p_onde text, p_coberta boolean, p_unidade uuid, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ident text := btrim(coalesce(p_identificacao, ''));
  v_onde text := nullif(btrim(coalesce(p_onde, '')), '');
  v_antes vagas;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if length(v_ident) not between 1 and 20 then perform recusar_campos('Identificação da vaga de 1 a 20 caracteres', 'identificacao'); end if;
  if v_onde is not null and length(v_onde) not between 2 and 60 then perform recusar_campos('Onde fica de 2 a 60 caracteres', 'onde'); end if;
  if p_unidade is not null and not exists (select 1 from unidades where id = p_unidade and ativa) then
    perform recusar_campos('Unidade não encontrada', 'unidadeId');
  end if;
  if exists (select 1 from vagas where ativa and lower(btrim(identificacao)) = lower(v_ident) and id is distinct from p_id)
     and coalesce(p_ativa, true) then
    perform recusar_campos('Já existe uma vaga em uso com esta identificação', 'identificacao');
  end if;
  if p_id is null then
    insert into vagas (condominio_id, identificacao, onde, coberta, unidade_id, criado_por)
    values (p_condominio, v_ident, v_onde, p_coberta, p_unidade, p_pessoa) returning id, versao into v_id, v_versao;
    perform registrar_historico('vaga.criada', 'vaga', v_id::text, jsonb_build_object('unidade', p_unidade));
  else
    select * into v_antes from vagas where id = p_id;
    if not found then raise exception 'Vaga não encontrada' using errcode = 'TC404'; end if;
    if v_antes.versao <> p_versao then perform conflito_versao('vagas', p_id); end if;
    update vagas set identificacao = v_ident, onde = v_onde, coberta = p_coberta, unidade_id = p_unidade, ativa = coalesce(p_ativa, ativa)
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('vagas', p_id); end if;
    perform registrar_historico(case when v_antes.ativa and not coalesce(p_ativa, true) then 'vaga.fora_de_uso'
                                     when not v_antes.ativa and coalesce(p_ativa, false) then 'vaga.reativada'
                                     else 'vaga.alterada' end,
      'vaga', v_id::text, jsonb_build_object('unidade', p_unidade, 'unidadeAntes', v_antes.unidade_id));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Incluir ou editar veículo. A placa é conferida no formato e na unicidade; quem e a vaga são
-- da própria unidade.
create function plataforma_salvar_veiculo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_unidade uuid,
                                          p_placa text, p_tipo text, p_modelo text, p_contato uuid, p_vaga uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placa text := normalizar_placa(p_placa);
  v_modelo text := nullif(btrim(coalesce(p_modelo, '')), '');
  v_antes veiculos;
  v_unidade uuid := p_unidade;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if p_id is not null then
    select * into v_antes from veiculos where id = p_id;
    if not found then raise exception 'Veículo não encontrado' using errcode = 'TC404'; end if;
    if v_antes.retirado_em is not null then perform recusar_motivo('Veículo retirado não muda', 'VEICULO_RETIRADO'); end if;
    v_unidade := v_antes.unidade_id;
  end if;
  if v_unidade is null or not exists (select 1 from unidades where id = v_unidade and ativa) then
    perform recusar_campos('Unidade não encontrada', 'unidadeId');
  end if;
  if v_placa is null then perform recusar_campos('Placa Mercosul (ABC1D23) ou antiga (ABC-1234)', 'placa'); end if;
  if p_tipo is null or p_tipo not in ('CARRO', 'MOTO', 'OUTRO') then perform recusar_campos('Tipo do veículo', 'tipo'); end if;
  if v_modelo is not null and length(v_modelo) not between 2 and 60 then perform recusar_campos('Modelo e cor de 2 a 60 caracteres', 'modelo'); end if;
  if p_contato is not null and not exists (select 1 from contatos_unidade where contato_id = p_contato and unidade_id = v_unidade and estado <> 'ENCERRADO') then
    perform recusar_campos('Só pessoas desta unidade', 'contatoId');
  end if;
  if p_vaga is not null and not exists (select 1 from vagas where id = p_vaga and ativa and unidade_id = v_unidade) then
    perform recusar_campos('Só vagas desta unidade', 'vagaId');
  end if;
  if exists (select 1 from veiculos where placa = v_placa and retirado_em is null and id is distinct from p_id) then
    perform recusar_campos('Esta placa já está em uso em outra unidade do condomínio', 'placa');
  end if;
  if p_id is null then
    insert into veiculos (condominio_id, unidade_id, placa, tipo, modelo, contato_id, vaga_id, criado_por)
    values (p_condominio, v_unidade, v_placa, p_tipo, v_modelo, p_contato, p_vaga, p_pessoa) returning id, versao into v_id, v_versao;
    perform registrar_historico('unidade.veiculo_incluido', 'unidade', v_unidade::text, jsonb_build_object('veiculo', v_id, 'vaga', p_vaga));
  else
    if v_antes.versao <> p_versao then perform conflito_versao('veiculos', p_id); end if;
    update veiculos set placa = v_placa, tipo = p_tipo, modelo = v_modelo, contato_id = p_contato, vaga_id = p_vaga
     where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('veiculos', p_id); end if;
    perform registrar_historico('unidade.veiculo_alterado', 'unidade', v_unidade::text, jsonb_build_object('veiculo', v_id, 'vaga', p_vaga));
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function plataforma_retirar_veiculo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v veiculos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  select * into v from veiculos where id = p_id;
  if not found then raise exception 'Veículo não encontrado' using errcode = 'TC404'; end if;
  if v.retirado_em is not null then perform recusar_motivo('Veículo já retirado', 'VEICULO_RETIRADO'); end if;
  update veiculos set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = 'RETIRADO'
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('veiculos', p_id); end if;
  perform registrar_historico('unidade.veiculo_retirado', 'unidade', v.unidade_id::text, jsonb_build_object('veiculo', v.id, 'motivo', 'RETIRADO'));
  return jsonb_build_object('versao', v_versao);
end $$;

-- A ficha da unidade (0260) com as vagas e os veículos em uso.
alter function plataforma_unidade(uuid, uuid, uuid) rename to unidade_detalhe_r3;
alter function unidade_detalhe_r3(uuid, uuid, uuid) security invoker;
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidade_detalhe_r3(p_pessoa, p_condominio, p_unidade);
  return v || jsonb_build_object(
    'vagas', coalesce((select jsonb_agg(vaga_json(x) order by chave_unidade(x.identificacao)) from vagas x
                        where x.unidade_id = p_unidade and x.ativa), '[]'::jsonb),
    'veiculos', coalesce((select jsonb_agg(veiculo_json(x) order by x.criado_em) from veiculos x
                           where x.unidade_id = p_unidade and x.retirado_em is null), '[]'::jsonb));
end $$;

-- Busca da lista de unidades (MU-11): o que achou em cada unidade. A placa acha com ou sem
-- hífen; nome e telefone, só de quem tem vínculo ativo.
create function plataforma_buscar_unidades(p_pessoa uuid, p_condominio uuid, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := btrim(coalesce(p_busca, ''));
  v_placa text := upper(regexp_replace(coalesce(p_busca, ''), '[^A-Za-z0-9]', '', 'g'));
  v_digitos text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if length(v_q) not between 2 and 60 then perform recusar_campos('Busque com 2 a 60 caracteres', 'busca'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('unidadeId', x.unidade_id, 'tipo', x.tipo, 'texto', x.texto) order by x.ordem, x.texto)
      from (
        select distinct on (x.unidade_id) x.* from (
          select u.id as unidade_id, 'UNIDADE' as tipo, rotulo_unidade(u.id) as texto, 1 as ordem
            from unidades u where u.ativa and rotulo_unidade(u.id) ilike '%' || v_q || '%'
          union all
          select v.unidade_id, 'PLACA', 'placa ' || mostrar_placa(v.placa) || coalesce(' · ' || v.modelo, '')
                 || ' · ' || coalesce('vaga ' || (select identificacao from vagas where id = v.vaga_id), 'sem vaga'), 2
            from veiculos v where v.retirado_em is null and length(v_placa) >= 3 and v.placa like '%' || v_placa || '%'
          union all
          select cu.unidade_id, 'NOME', ct.nome, 3
            from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
           where cu.estado <> 'ENCERRADO' and ct.nome ilike '%' || v_q || '%'
          union all
          select cu.unidade_id, 'TELEFONE', ct.nome, 4
            from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
           where cu.estado <> 'ENCERRADO' and length(v_digitos) >= 4 and regexp_replace(ct.telefone, '\D', '', 'g') like '%' || v_digitos || '%'
        ) x order by x.unidade_id, x.ordem) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Prestador reserva (MP-09).

-- O prestador responde pelo link: confirma ou recusa. Os dois entram como registros, como a
-- chegada; confirmar não pede texto e recusar pede só se quiser.
do $$
declare v text;
begin
  select conname into v from pg_constraint
   where conrelid = 'registros_prestador'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '^CHECK \(+tipo = ''CHEGOU''::text\) OR \(texto IS NOT NULL\)+$';
  if v is null then raise exception 'Regra do texto do registro não encontrada'; end if;
  execute format('alter table registros_prestador drop constraint %I', v);
end $$;
alter table registros_prestador drop constraint registros_prestador_tipo_check;
alter table registros_prestador
  add constraint registros_prestador_tipo_check check (tipo in ('CHEGOU', 'IMPEDIMENTO', 'TERMINOU', 'CONFIRMOU', 'RECUSOU')),
  add constraint registros_prestador_texto check (tipo in ('CHEGOU', 'CONFIRMOU', 'RECUSOU') or texto is not null);

alter table links_prestador
  add column responder_horas    smallint check (responder_horas in (4, 8, 24, 48)),
  add column responder_ate      timestamptz,
  add column reserva_id         uuid,
  add column troca_de           uuid references links_prestador (id),
  add column respondido_em      timestamptz,
  add column resposta           text check (resposta in ('CONFIRMOU', 'RECUSOU', 'CHEGOU')),
  add column troca_desligada_em  timestamptz,
  add column troca_desligada_por uuid references pessoas (id),
  add column trocado_em         timestamptz,
  add column troca_resultado    text check (troca_resultado in ('TROCOU', 'NAO_TROCOU')),
  add column sem_resposta_avisado_em timestamptz,
  add constraint links_prestador_reserva foreign key (reserva_id, condominio_id) references prestadores (id, condominio_id),
  add constraint links_prestador_prazo check ((responder_horas is null) = (responder_ate is null)),
  add constraint links_prestador_reserva_com_prazo check (reserva_id is null or responder_ate is not null),
  add constraint links_prestador_resposta check ((respondido_em is null) = (resposta is null)),
  add constraint links_prestador_troca check ((trocado_em is null) = (troca_resultado is null)),
  add constraint links_prestador_uma_troca check (troca_de is null or reserva_id is null);
create index links_prestador_esperando on links_prestador (responder_ate)
  where revogado_em is null and respondido_em is null and trocado_em is null and responder_ate is not null;

-- Avisos no sino do responsável pela manutenção: passou para a reserva (com o link mandado ou
-- para mandar), não passou (e por quê) ou a reserva também não respondeu.
create table avisos_reserva (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  link_id       uuid not null,
  tipo          text not null check (tipo in ('TROCOU', 'MANDAR_LINK', 'NAO_TROCOU', 'RESERVA_SEM_RESPOSTA')),
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (link_id, condominio_id) references links_prestador (id, condominio_id),
  unique (pessoa_id, link_id, tipo)
);
create index avisos_reserva_pessoa on avisos_reserva (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_reserva');
create trigger avisos_reserva_sem_exclusao before delete on avisos_reserva for each row execute function somente_insercao();
create function avisos_reserva_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.link_id, new.tipo, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.link_id, old.tipo, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_reserva_regras before update on avisos_reserva for each row execute function avisos_reserva_regras();

-- O link novo da reserva vai pela fila do WhatsApp; o código nasce na hora do envio.
alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO', 'PRESTADOR'));
alter table envios_whatsapp add column link_prestador_id uuid;
alter table envios_whatsapp add constraint envios_whatsapp_link_prestador
  foreign key (link_prestador_id, condominio_id) references links_prestador (id, condominio_id);
alter table envios_whatsapp add constraint envios_whatsapp_prestador_tem_link check ((finalidade = 'PRESTADOR') = (link_prestador_id is not null));

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido', 'link_prestador'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido', 'link_prestador'));
alter table modelos_whatsapp drop constraint modelos_whatsapp_para_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_para_check check (para in ('MORADOR', 'EQUIPE', 'PRESTADOR'));

insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('link_prestador', 1, 'Serviço para o prestador', 'PRESTADOR', 'Link do serviço mandado à reserva quando o principal não respondeu',
   '["condomínio", "prestador", "serviço e local", "responder até", "link"]',
   E'O {{1}} tem um serviço para {{2}}: {{3}}.\n\nVeja o que fazer e confirme até {{4}}: {{5}}\n\nO link é só para este serviço e não precisa de conta.',
   'Mensagem automática do condomínio.', 'APROVADO_PILOTO', 'Aprovado com o desenho de garagens, reserva e quedas', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave = 'link_prestador';

-- "21/10, 14:00" no fuso do condomínio.
create function dia_hora(p timestamptz) returns text
language sql stable
set search_path = public
as $$ select to_char(p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'DD/MM, HH24:MI') $$;

create function nome_prestador(p_id uuid) returns text
language sql stable
set search_path = public
as $$ select nome from prestadores where id = p_id $$;

-- Quem é avisado sobre a troca: o responsável pela manutenção.
create function avisar_reserva(p_link uuid, p_manutencao uuid, p_tipo text) returns void
language plpgsql
set search_path = public
as $$
declare v_pessoa uuid;
begin
  select pessoa_do_vinculo(m.responsavel_id) into v_pessoa from manutencoes m where m.id = p_manutencao;
  if v_pessoa is not null then
    insert into avisos_reserva (condominio_id, pessoa_id, link_id, tipo) values (contexto_condominio(), v_pessoa, p_link, p_tipo)
    on conflict (pessoa_id, link_id, tipo) do nothing;
  end if;
end $$;

-- A troca (decisões 9 a 12). p_motivo: SEM_RESPOSTA ou RECUSOU. Devolve se trocou.
create function trocar_para_reserva(p_link uuid, p_motivo text) returns boolean
language plpgsql
set search_path = public
as $$
declare
  l links_prestador;
  m manutencoes;
  r prestadores;
  v_novo uuid;
  v_envio uuid;
  v_ate timestamptz;
  v_pessoa uuid;
  v_por_whatsapp boolean;
begin
  select * into l from links_prestador where id = p_link for update;
  if l.id is null or l.trocado_em is not null or l.reserva_id is null or l.troca_desligada_em is not null then return false; end if;
  select * into m from manutencoes where id = l.manutencao_id for update;
  select * into r from prestadores where id = l.reserva_id;
  if l.revogado_em is not null or not link_prestador_vale(l) or m.prestador_id is distinct from l.prestador_id then
    -- Mudou à mão, o link parou ou a manutenção terminou: nada a trocar.
    update links_prestador set trocado_em = app_now(), troca_resultado = 'NAO_TROCOU' where id = l.id;
    return false;
  end if;
  if r.arquivado_em is not null then
    update links_prestador set trocado_em = app_now(), troca_resultado = 'NAO_TROCOU' where id = l.id;
    perform registrar_historico('manutencao.reserva_nao_assumiu', 'manutencoes', m.id::text,
      jsonb_build_object('link', l.id, 'motivo', p_motivo, 'por', 'RESERVA_ARQUIVADA'));
    perform avisar_reserva(l.id, m.id, 'NAO_TROCOU');
    return false;
  end if;
  update manutencoes set prestador_id = r.id, atualizado_em = app_now() where id = m.id;
  update links_prestador set revogado_em = app_now(), trocado_em = app_now(), troca_resultado = 'TROCOU',
                             motivo_revogacao = case when p_motivo = 'RECUSOU' then 'Passou para a reserva: o prestador não pode atender'
                                                     else 'Passou para a reserva: sem resposta no prazo' end
   where id = l.id;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'PRESTADOR' and alvo_id = l.id and revogado_em is null;
  v_por_whatsapp := r.telefone is not null and exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO');
  if v_por_whatsapp then
    v_ate := app_now() + make_interval(hours => l.responder_horas);
    insert into links_prestador (condominio_id, manutencao_id, prestador_id, para, o_que_fazer, quando, como_entrar, arquivos, expira_em,
                                 criado_por, troca_de, responder_horas, responder_ate)
    values (l.condominio_id, m.id, r.id, r.nome, l.o_que_fazer, l.quando, l.como_entrar, l.arquivos,
            greatest(l.expira_em, v_ate + interval '1 day'), l.criado_por, l.id, l.responder_horas, v_ate)
    returning id into v_novo;
    v_pessoa := pessoa_do_vinculo(m.responsavel_id);
    insert into envios_whatsapp (condominio_id, para, finalidade, texto, responsavel, link_prestador_id, modelo_chave, modelo_parametros)
    values (l.condominio_id, r.telefone, 'PRESTADOR',
            'O ' || nome_do_condominio() || ' tem um serviço para ' || r.nome || ': ' || m.titulo || coalesce(' (' || m.local || ')', '')
            || E'.\n\nVeja o que fazer e confirme até ' || dia_hora(v_ate) || E': [link]\n\nO link é só para este serviço e não precisa de conta.',
            coalesce(v_pessoa, (quem_cuida_dos_pedidos())[1]), v_novo, 'link_prestador',
            jsonb_build_array(nome_do_condominio(), r.nome, m.titulo || coalesce(' (' || m.local || ')', ''), dia_hora(v_ate), '[link]'))
    returning id into v_envio;
  end if;
  perform registrar_historico('manutencao.reserva_assumiu', 'manutencoes', m.id::text, jsonb_strip_nulls(jsonb_build_object(
    'link', l.id, 'linkNovo', v_novo, 'de', l.prestador_id, 'para', r.id, 'motivo', p_motivo, 'horas', l.responder_horas,
    'canal', case when v_por_whatsapp then 'WHATSAPP' end)));
  perform avisar_reserva(coalesce(v_novo, l.id), m.id, case when v_por_whatsapp then 'TROCOU' else 'MANDAR_LINK' end);
  return true;
end $$;

-- Responder é confirmar, recusar ou chegar (decisão 7); recusar troca na hora.
create function registros_prestador_resposta() returns trigger
language plpgsql
set search_path = public
as $$
declare l links_prestador;
begin
  if new.tipo not in ('CONFIRMOU', 'RECUSOU', 'CHEGOU') then return new; end if;
  update links_prestador set respondido_em = app_now(), resposta = new.tipo
   where id = new.link_id and respondido_em is null returning * into l;
  if l.id is not null and new.tipo = 'RECUSOU' and l.reserva_id is not null then
    perform trocar_para_reserva(l.id, 'RECUSOU');
  end if;
  return new;
end $$;
create trigger registros_prestador_resposta after insert on registros_prestador for each row execute function registros_prestador_resposta();

create function publico_prestador_confirmar(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  r registros_prestador;
begin
  l := exigir_link_prestador(p_codigo);
  if l.respondido_em is not null then return jsonb_build_object('ok', true, 'resposta', l.resposta); end if;
  insert into registros_prestador (condominio_id, link_id, manutencao_id, tipo) values (l.condominio_id, l.id, l.manutencao_id, 'CONFIRMOU')
  returning * into r;
  perform registrar_historico('manutencao.prestador_confirmou', 'manutencoes', l.manutencao_id::text, jsonb_build_object('link', l.id, 'registro', r.id));
  perform avisar_registro_prestador(r);
  return jsonb_build_object('ok', true, 'resposta', 'CONFIRMOU');
end $$;

create function publico_prestador_recusar(p_codigo text, p_texto text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  r registros_prestador;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  l := exigir_link_prestador(p_codigo);
  if l.respondido_em is not null then perform recusar_motivo('Você já respondeu a este serviço', 'JA_RESPONDIDO'); end if;
  if v_texto is not null and length(v_texto) not between 3 and 500 then perform recusar_campos('Motivo de 3 a 500 caracteres', 'texto'); end if;
  insert into registros_prestador (condominio_id, link_id, manutencao_id, tipo, texto) values (l.condominio_id, l.id, l.manutencao_id, 'RECUSOU', v_texto)
  returning * into r;
  perform registrar_historico('manutencao.prestador_recusou', 'manutencoes', l.manutencao_id::text, jsonb_build_object('link', l.id, 'registro', r.id));
  perform avisar_registro_prestador(r);
  return jsonb_build_object('ok', true, 'resposta', 'RECUSOU');
end $$;

-- A página do prestador (0170) com o prazo para responder e o motivo de quem foi trocado.
alter function publico_prestador(text) rename to publico_prestador_r13;
alter function publico_prestador_r13(text) security invoker;
create function publico_prestador(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c codigos_sem_conta;
  l links_prestador;
begin
  v := publico_prestador_r13(p_codigo);
  select * into c from codigos_sem_conta where hash = hash_codigo(p_codigo) and tipo = 'PRESTADOR';
  select * into l from links_prestador where id = c.alvo_id;
  if coalesce((v ->> 'encerrado')::boolean, false) then
    return v || case when l.troca_resultado = 'TROCOU' then jsonb_build_object('motivo', 'REPASSADO') else '{}'::jsonb end;
  end if;
  return v || jsonb_strip_nulls(jsonb_build_object(
    'responderAte', case when l.respondido_em is null then l.responder_ate end,
    'resposta', l.resposta));
end $$;

-- Mandar link com o prazo para responder (decisão 8). Sem prazo, igual a 0170.
alter function plataforma_criar_link_prestador(uuid, uuid, uuid, integer, text, text, text, date, uuid[]) rename to criar_link_prestador_r13;
alter function criar_link_prestador_r13(uuid, uuid, uuid, integer, text, text, text, date, uuid[]) security invoker;
create function plataforma_criar_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_versao integer,
                                                p_o_que_fazer text, p_quando text, p_como_entrar text, p_vale_ate date,
                                                p_arquivos uuid[], p_responder_horas integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  m manutencoes;
  v_reserva uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  m := exigir_manutencao(p_manutencao);
  if p_responder_horas is not null then
    if p_responder_horas not in (4, 8, 24, 48) then perform recusar_campos('Prazo de 4, 8, 24 ou 48 horas', 'responderHoras'); end if;
    select x.reserva_id into v_reserva from prestadores x join prestadores r on r.id = x.reserva_id and r.arquivado_em is null
     where x.id = m.prestador_id;
    if v_reserva is null then perform recusar_campos('Este prestador não tem reserva no cadastro', 'responderHoras'); end if;
  end if;
  v := criar_link_prestador_r13(p_pessoa, p_condominio, p_manutencao, p_versao, p_o_que_fazer, p_quando, p_como_entrar, p_vale_ate, p_arquivos);
  if v_reserva is not null then
    update links_prestador set responder_horas = p_responder_horas, responder_ate = criado_em + make_interval(hours => p_responder_horas),
                               reserva_id = v_reserva
     where id = (v ->> 'id')::uuid;
    perform registrar_historico('manutencao.reserva_programada', 'manutencoes', m.id::text,
      jsonb_build_object('link', v ->> 'id', 'reserva', v_reserva, 'horas', p_responder_horas));
  end if;
  return v;
end $$;

-- Desligar a troca automática deste link (botão "Não trocar sozinho").
create function plataforma_desligar_troca(p_pessoa uuid, p_condominio uuid, p_manutencao uuid, p_link uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare l links_prestador;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'manutencao.editar');
  perform exigir_manutencao(p_manutencao);
  select * into l from links_prestador where id = p_link and manutencao_id = p_manutencao;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  if l.reserva_id is null or l.trocado_em is not null or l.troca_desligada_em is not null then
    perform recusar_motivo('Este link não tem troca automática esperando', 'SEM_TROCA');
  end if;
  update links_prestador set troca_desligada_em = app_now(), troca_desligada_por = p_pessoa where id = l.id;
  perform registrar_historico('manutencao.reserva_desligada', 'manutencoes', p_manutencao::text, jsonb_build_object('link', l.id));
  return jsonb_build_object('ok', true);
end $$;

-- O link na manutenção (0170) com o prazo, a reserva e o que aconteceu com a troca.
alter function plataforma_link_prestador(uuid, uuid, uuid) rename to link_prestador_r13;
alter function link_prestador_r13(uuid, uuid, uuid) security invoker;
create function plataforma_link_prestador(p_pessoa uuid, p_condominio uuid, p_manutencao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  l links_prestador;
  m manutencoes;
  v_reserva uuid;
begin
  v := link_prestador_r13(p_pessoa, p_condominio, p_manutencao);
  m := exigir_manutencao(p_manutencao);
  select * into l from links_prestador where manutencao_id = p_manutencao order by criado_em desc, id desc limit 1;
  select x.reserva_id into v_reserva from prestadores x join prestadores r on r.id = x.reserva_id and r.arquivado_em is null
   where x.id = m.prestador_id;
  if l.id is not null then
    v := jsonb_set(v, '{link}', (v -> 'link') || jsonb_strip_nulls(jsonb_build_object(
      'responderAte', l.responder_ate, 'responderHoras', l.responder_horas, 'respondidoEm', l.respondido_em, 'resposta', l.resposta,
      'reserva', case when l.reserva_id is not null then jsonb_build_object('id', l.reserva_id, 'nome', nome_prestador(l.reserva_id)) end,
      'trocaDesligadaEm', l.troca_desligada_em, 'trocaResultado', l.troca_resultado, 'trocadoEm', l.trocado_em,
      'trocaDe', case when l.troca_de is not null then jsonb_build_object('nome', (select para from links_prestador where id = l.troca_de)) end)));
    v := jsonb_set(v, '{pode}', (v -> 'pode') || jsonb_build_object(
      'naoTrocar', pode(p_pessoa, p_condominio, 'manutencao.editar') and l.reserva_id is not null and l.trocado_em is null
                   and l.troca_desligada_em is null and l.revogado_em is null and l.respondido_em is null));
  end if;
  return v || jsonb_strip_nulls(jsonb_build_object(
    'reservaDoCadastro', case when v_reserva is not null then jsonb_build_object('id', v_reserva, 'nome', nome_prestador(v_reserva)) end));
end $$;

-- A cada 5 minutos: troca o que venceu sem resposta (no horário de funcionamento) e avisa
-- quando a reserva também não respondeu.
create function verificar_reservas() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  l links_prestador;
  v_total integer := 0;
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform entrar_como_sistema(c.id);
    begin
      if dentro_do_horario('FUNCIONAMENTO', app_now()) then
        for l in select * from links_prestador
                  where revogado_em is null and respondido_em is null and trocado_em is null and troca_desligada_em is null
                    and reserva_id is not null and responder_ate <= app_now() order by responder_ate loop
          if trocar_para_reserva(l.id, 'SEM_RESPOSTA') then v_total := v_total + 1; end if;
        end loop;
      end if;
      for l in update links_prestador x set sem_resposta_avisado_em = app_now()
                where x.troca_de is not null and x.revogado_em is null and x.respondido_em is null and x.sem_resposta_avisado_em is null
                  and x.responder_ate <= app_now() and link_prestador_vale(x) returning * loop
        perform avisar_reserva(l.id, l.manutencao_id, 'RESERVA_SEM_RESPOSTA');
        perform registrar_historico('manutencao.reserva_sem_resposta', 'manutencoes', l.manutencao_id::text, jsonb_build_object('link', l.id));
      end loop;
    exception when others then
      raise warning 'Reservas do condomínio % não conferidas: %', c.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-reservas', '*/5 * * * *', 'select public.verificar_reservas()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_reservas() de outro jeito (%).', sqlerrm;
end $$;

-- O link da reserva: o código nasce na hora de mandar (0240 + este).
alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_r12c;
alter function pegar_lote_whatsapp_r12c(integer) security invoker;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  l jsonb;
  x jsonb;
  v_envios jsonb;
  v_link uuid;
  v_codigo text;
begin
  v_lotes := pegar_lote_whatsapp_r12c(p_max);
  for l in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((l ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(l -> 'envios') loop
      select link_prestador_id into v_link from envios_whatsapp where id = (x ->> 'envio')::uuid;
      if v_link is not null then
        update codigos_sem_conta set revogado_em = app_now() where tipo = 'PRESTADOR' and alvo_id = v_link and revogado_em is null;
        v_codigo := novo_codigo();
        insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), (l ->> 'condominio')::uuid, 'PRESTADOR', v_link);
        x := x || jsonb_build_object('link', v_codigo, 'rota', 'p');
      end if;
      v_envios := v_envios || jsonb_build_array(x);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(l, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

-- ---------------------------------------------------------------------------------------
-- Queda do WhatsApp (W-17).

alter table configuracao_condominio add column whatsapp_quedas_pessoa uuid references pessoas (id);

create table quedas_whatsapp (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  estado            text not null default 'FORA_DO_AR' check (estado in ('FORA_DO_AR', 'CONFERINDO', 'ENCERRADA')),
  origem            text not null check (origem in ('PROVEDOR', 'MANUAL')),
  inicio            timestamptz not null default app_now(),
  voltou_em         timestamptz,
  encerrada_em      timestamptz,
  responsavel       uuid references pessoas (id),
  canal_alternativo text check (length(btrim(canal_alternativo)) between 5 and 300),
  o_que_aconteceu   text check (length(btrim(o_que_aconteceu)) between 3 and 1000),
  resumo            text check (length(btrim(resumo)) between 10 and 2000),
  aberta_por        uuid references pessoas (id),
  encerrada_por     uuid references pessoas (id),
  versao            integer not null default 1,
  unique (id, condominio_id),
  check ((estado = 'FORA_DO_AR') = (voltou_em is null)),
  check ((estado = 'ENCERRADA') = (encerrada_em is not null)),
  check (estado <> 'ENCERRADA' or resumo is not null),
  check (origem = 'PROVEDOR' or aberta_por is not null)
);
create unique index quedas_whatsapp_uma_aberta on quedas_whatsapp (condominio_id) where estado <> 'ENCERRADA';
call proteger_tabela_condominio('quedas_whatsapp');
create trigger quedas_whatsapp_sem_exclusao before delete on quedas_whatsapp for each row execute function somente_insercao();

-- Fora do ar → conferindo (o número voltou) → encerrada. Se cair de novo durante a conferência,
-- volta a fora do ar. Encerrada não muda.
create function quedas_whatsapp_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'ENCERRADA' then raise exception 'Queda encerrada não muda' using errcode = 'TC422', detail = '{"motivo":"QUEDA_ENCERRADA"}'; end if;
  if (new.condominio_id, new.origem, new.inicio, new.aberta_por) is distinct from (old.condominio_id, old.origem, old.inicio, old.aberta_por) then
    raise exception 'O começo da queda não muda' using errcode = 'TC422';
  end if;
  if new.estado is distinct from old.estado and not (
       (old.estado = 'FORA_DO_AR' and new.estado = 'CONFERINDO')
    or (old.estado = 'CONFERINDO' and new.estado in ('FORA_DO_AR', 'ENCERRADA'))) then
    raise exception 'Mudança de situação da queda não permitida' using errcode = 'TC409';
  end if;
  return new;
end $$;
create trigger quedas_whatsapp_regras before update on quedas_whatsapp for each row execute function quedas_whatsapp_regras();

-- O que ficou parado na fila por causa da queda e o que quem cuida decidiu.
alter table envios_whatsapp
  add column queda_id           uuid,
  add column conciliacao        text check (conciliacao in ('MANDAR', 'OUTRO_CANAL', 'NAO_MANDAR')),
  add column conciliacao_motivo text check (length(btrim(conciliacao_motivo)) between 3 and 300),
  add column conciliada_em      timestamptz,
  add column conciliada_por     uuid references pessoas (id),
  add constraint envios_whatsapp_queda foreign key (queda_id, condominio_id) references quedas_whatsapp (id, condominio_id),
  add constraint envios_whatsapp_conciliacao check ((conciliacao is null) = (conciliada_em is null) and (conciliacao is null or queda_id is not null)),
  add constraint envios_whatsapp_conciliacao_motivo check (conciliacao is distinct from 'OUTRO_CANAL' or conciliacao_motivo is not null);
create index envios_whatsapp_queda on envios_whatsapp (queda_id) where queda_id is not null;

alter table avisos_whatsapp drop constraint avisos_whatsapp_tipo_check;
alter table avisos_whatsapp add constraint avisos_whatsapp_tipo_check
  check (tipo in ('PEDIDO_NOVO', 'REVISAO', 'A_IDENTIFICAR', 'FALHA_ENVIO', 'DESCONECTADO', 'QUEDA', 'QUEDA_VOLTOU'));

-- Parada: fica na fila sem hora de sair, até alguém decidir.
create function envio_parado(e envios_whatsapp) returns boolean
language sql immutable
set search_path = public
as $$ select e.queda_id is not null and e.conciliacao is null and e.estado = 'NA_FILA' and e.enviar_apos = 'infinity'::timestamptz $$;

-- Quem cuida da queda (decisão 14): o escolhido, se ainda tiver acesso ao WhatsApp; senão, o síndico.
create function quem_cuida_das_quedas() returns uuid
language sql stable
set search_path = public
as $$
  select coalesce(
    (select c.whatsapp_quedas_pessoa from configuracao_condominio c
      where exists (select 1 from vinculos v where v.pessoa_id = c.whatsapp_quedas_pessoa and v.condominio_id = c.condominio_id
                                              and v.revogado_em is null and v.funcao in ('SINDICO', 'AUTORIZADO')
                                              and (v.funcao = 'SINDICO' or pode(v.pessoa_id, v.condominio_id, 'pedidos.responder')))),
    (select v.pessoa_id from vinculos v where v.condominio_id = contexto_condominio() and v.revogado_em is null and v.funcao = 'SINDICO'
      order by v.criado_em limit 1))
$$;

create function abrir_queda(p_origem text, p_pessoa uuid, p_o_que text) returns quedas_whatsapp
language plpgsql
set search_path = public
as $$
declare q quedas_whatsapp;
begin
  select * into q from quedas_whatsapp where estado <> 'ENCERRADA' for update;
  if q.id is not null then
    if q.estado = 'CONFERINDO' then
      update quedas_whatsapp set estado = 'FORA_DO_AR', voltou_em = null where id = q.id returning * into q;
      perform registrar_historico('whatsapp.queda_caiu_de_novo', 'queda_whatsapp', q.id::text, jsonb_build_object('origem', p_origem));
    end if;
  else
    insert into quedas_whatsapp (condominio_id, origem, responsavel, aberta_por, o_que_aconteceu)
    values (contexto_condominio(), p_origem, quem_cuida_das_quedas(), p_pessoa, p_o_que) returning * into q;
    perform registrar_historico('whatsapp.queda_aberta', 'queda_whatsapp', q.id::text, jsonb_build_object('origem', p_origem));
    if q.responsavel is not null then
      perform avisar_whatsapp(array[q.responsavel], 'QUEDA', null, null, null, 'Q:' || q.id::text);
    end if;
  end if;
  update envios_whatsapp set queda_id = q.id, enviar_apos = 'infinity'
   where estado = 'NA_FILA' and enviar_apos <= app_now() and conciliacao is null and (queda_id is null or queda_id = q.id);
  return q;
end $$;

-- O número voltou: a queda passa a conferindo. O automático que perdeu o sentido sai como não
-- mandado (decisão 16); o resto espera.
create function queda_voltou(q quedas_whatsapp, p_origem text) returns void
language plpgsql
set search_path = public
as $$
begin
  update quedas_whatsapp set estado = 'CONFERINDO', voltou_em = app_now() where id = q.id;
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'Resposta automática vencida na queda do WhatsApp',
                             conciliacao = 'NAO_MANDAR', conciliacao_motivo = 'Resposta automática vencida', conciliada_em = app_now()
   where queda_id = q.id and conciliacao is null and estado = 'NA_FILA' and criado_por is null and finalidade in ('RESPOSTA', 'AVISO');
  perform registrar_historico('whatsapp.queda_voltou', 'queda_whatsapp', q.id::text, jsonb_build_object('origem', p_origem));
  if q.responsavel is not null then
    perform avisar_whatsapp(array[q.responsavel], 'QUEDA_VOLTOU', null, null, null, 'V:' || q.id::text || ':' || app_now()::text);
  end if;
end $$;

-- A conexão muda de situação: abre a queda ao cair, passa a conferindo ao voltar (decisão 13).
create function quedas_pela_conexao() returns trigger
language plpgsql
set search_path = public
as $$
declare q quedas_whatsapp;
begin
  if new.situacao = 'DESCONECTADO' and old.situacao in ('CONECTADO', 'CONECTANDO') then
    perform abrir_queda('PROVEDOR', null, null);
  elsif new.situacao = 'CONECTADO' and old.situacao <> 'CONECTADO' then
    select * into q from quedas_whatsapp where estado = 'FORA_DO_AR';
    if q.id is not null then perform queda_voltou(q, 'PROVEDOR'); end if;
  end if;
  return new;
end $$;
create trigger conexoes_whatsapp_quedas after update of situacao on conexoes_whatsapp
  for each row execute function quedas_pela_conexao();

-- Envio que entra na fila com o número fora do ar fica parado. O agendado para depois segue
-- o horário dele.
create function envios_na_queda() returns trigger
language plpgsql
set search_path = public
as $$
declare v_queda uuid;
begin
  select id into v_queda from quedas_whatsapp where estado = 'FORA_DO_AR';
  if v_queda is not null and new.estado = 'NA_FILA' and new.enviar_apos <= app_now() then
    new.queda_id := v_queda;
    new.enviar_apos := 'infinity';
  end if;
  return new;
end $$;
create trigger envios_whatsapp_queda before insert on envios_whatsapp for each row execute function envios_na_queda();

create function exigir_queda(p_id uuid) returns quedas_whatsapp
language plpgsql
set search_path = public
as $$
declare q quedas_whatsapp;
begin
  select * into q from quedas_whatsapp where id = p_id;
  if not found then raise exception 'Queda não encontrada' using errcode = 'TC404'; end if;
  return q;
end $$;

create function exigir_cuidar_da_queda(p_pessoa uuid, p_condominio uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if not pode(p_pessoa, p_condominio, 'pedidos.responder') then
    raise exception 'Sem permissão para cuidar da queda' using errcode = 'TC401';
  end if;
end $$;

create function queda_json(q quedas_whatsapp, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', q.id, 'estado', q.estado, 'origem', q.origem, 'inicio', q.inicio, 'voltouEm', q.voltou_em, 'encerradaEm', q.encerrada_em,
    'responsavel', nome_pessoa(q.responsavel), 'souResponsavel', q.responsavel = p_pessoa,
    'canalAlternativo', q.canal_alternativo, 'oQueAconteceu', q.o_que_aconteceu, 'resumo', q.resumo,
    'abertaPor', nome_pessoa(q.aberta_por), 'encerradaPor', nome_pessoa(q.encerrada_por), 'versao', q.versao,
    'paradas', (select count(*) from envios_whatsapp e where e.queda_id = q.id),
    'faltam', (select count(*) from envios_whatsapp e where e.queda_id = q.id and envio_parado(e)),
    'atrasadas', (select count(*) from mensagens_whatsapp m where m.enviada_em >= q.inicio and m.enviada_em < coalesce(q.voltou_em, app_now())
                                                            and m.recebida_em >= coalesce(q.voltou_em, app_now()) - interval '1 minute'),
    'outroCanal', (select count(*) from pedidos p where p.criado_em >= q.inicio and p.criado_em < coalesce(q.voltou_em, q.encerrada_em, app_now())
                                                  and p.canal <> 'WHATSAPP')))
$$;

-- O que ficou parado, com a decisão de cada um.
create function envios_da_queda(q quedas_whatsapp, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', e.id, 'finalidade', e.finalidade, 'estado', e.estado, 'criadoEm', e.criado_em, 'texto', e.texto,
           'automatica', e.criado_por is null, 'por', nome_pessoa(e.criado_por),
           'para', coalesce((select nome from contatos where id = e.contato_id), nome_pessoa(e.pessoa_id),
                            (select para from links_prestador where id = e.link_prestador_id)),
           'unidades', case when e.contato_id is not null then unidades_do_contato(e.contato_id) end,
           'pedido', case when p.id is not null then jsonb_build_object('id', p.id, 'protocolo', p.protocolo) end,
           'parada', envio_parado(e), 'conciliacao', e.conciliacao, 'conciliacaoMotivo', e.conciliacao_motivo,
           'conciliadaPor', nome_pessoa(e.conciliada_por)))
         order by envio_parado(e) desc, e.criado_em), '[]'::jsonb)
    from envios_whatsapp e left join pedidos p on p.id = e.pedido_id and pedido_visivel(p_pessoa, p)
   where e.queda_id = q.id
$$;

-- Abrir à mão, quando as mensagens param de chegar (decisão 13).
create function plataforma_abrir_queda(p_pessoa uuid, p_condominio uuid, p_o_que_aconteceu text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q quedas_whatsapp;
  v_texto text := nullif(btrim(coalesce(p_o_que_aconteceu, '')), '');
begin
  perform exigir_cuidar_da_queda(p_pessoa, p_condominio);
  if exists (select 1 from quedas_whatsapp where estado <> 'ENCERRADA') then perform recusar_motivo('Já existe uma queda aberta', 'QUEDA_ABERTA'); end if;
  if v_texto is not null and length(v_texto) not between 3 and 1000 then perform recusar_campos('O que aconteceu de 3 a 1.000 caracteres', 'oQueAconteceu'); end if;
  q := abrir_queda('MANUAL', p_pessoa, v_texto);
  return jsonb_build_object('id', q.id, 'versao', q.versao);
end $$;

-- Canal alternativo e o que aconteceu (decisão 15).
create function plataforma_editar_queda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_canal text, p_o_que_aconteceu text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q quedas_whatsapp;
  v_canal text := nullif(btrim(coalesce(p_canal, '')), '');
  v_o_que text := nullif(btrim(coalesce(p_o_que_aconteceu, '')), '');
  v_versao integer;
begin
  perform exigir_cuidar_da_queda(p_pessoa, p_condominio);
  q := exigir_queda(p_id);
  if q.estado = 'ENCERRADA' then perform recusar_motivo('Queda encerrada não muda', 'QUEDA_ENCERRADA'); end if;
  if v_canal is not null and length(v_canal) not between 5 and 300 then perform recusar_campos('Canal alternativo de 5 a 300 caracteres', 'canalAlternativo'); end if;
  if v_o_que is not null and length(v_o_que) not between 3 and 1000 then perform recusar_campos('O que aconteceu de 3 a 1.000 caracteres', 'oQueAconteceu'); end if;
  update quedas_whatsapp set canal_alternativo = v_canal, o_que_aconteceu = v_o_que where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('quedas_whatsapp', p_id); end if;
  perform registrar_historico('whatsapp.queda_editada', 'queda_whatsapp', p_id::text,
    jsonb_build_object('canalAlternativo', v_canal is not null, 'canalMudou', v_canal is distinct from q.canal_alternativo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- A queda aberta à mão volta à mão (a do provedor volta quando o número reconecta).
create function plataforma_queda_voltou(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare q quedas_whatsapp;
begin
  perform exigir_cuidar_da_queda(p_pessoa, p_condominio);
  q := exigir_queda(p_id);
  if q.estado <> 'FORA_DO_AR' then perform recusar_motivo('A queda não está fora do ar', 'QUEDA_NAO_FORA'); end if;
  if not exists (select 1 from conexoes_whatsapp where situacao = 'CONECTADO') then
    perform recusar_motivo('O número ainda está desconectado: ele volta sozinho quando reconectar', 'NUMERO_DESCONECTADO');
  end if;
  perform queda_voltou(q, 'MANUAL');
  return jsonb_build_object('ok', true);
end $$;

-- Decidir o que ficou parado (decisão 16): mandar agora, resolvido por outro canal (com motivo)
-- ou não mandar. Só com o número de volta.
create function plataforma_conciliar_queda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_envios uuid[], p_decisao text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q quedas_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_n integer;
begin
  perform exigir_cuidar_da_queda(p_pessoa, p_condominio);
  q := exigir_queda(p_id);
  if q.estado <> 'CONFERINDO' then perform recusar_motivo('Espere o número voltar para decidir', 'QUEDA_NAO_CONFERINDO'); end if;
  if p_decisao is null or p_decisao not in ('MANDAR', 'OUTRO_CANAL', 'NAO_MANDAR') then perform recusar_campos('Decisão desconhecida', 'decisao'); end if;
  if p_decisao = 'OUTRO_CANAL' and length(coalesce(v_motivo, '')) not between 3 and 300 then
    perform recusar_campos('Diga por onde foi resolvido (de 3 a 300 caracteres)', 'motivo');
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
  if coalesce(cardinality(p_envios), 0) = 0 or cardinality(p_envios) > 200 then perform recusar_campos('Escolha de 1 a 200 mensagens', 'envios'); end if;
  if exists (select 1 from unnest(p_envios) x where not exists (select 1 from envios_whatsapp e where e.id = x and e.queda_id = q.id and envio_parado(e))) then
    perform recusar_motivo('Alguma mensagem já foi decidida', 'JA_DECIDIDA');
  end if;
  update envios_whatsapp
     set conciliacao = p_decisao, conciliacao_motivo = v_motivo, conciliada_em = app_now(), conciliada_por = p_pessoa,
         enviar_apos = case when p_decisao = 'MANDAR' then app_now() else enviar_apos end,
         estado = case when p_decisao = 'MANDAR' then estado else 'CANCELADA' end,
         motivo = case p_decisao when 'OUTRO_CANAL' then left('Resolvido por outro canal: ' || v_motivo, 300)
                                 when 'NAO_MANDAR' then left(coalesce('Não mandada depois da queda: ' || v_motivo, 'Não mandada depois da queda'), 300)
                                 else motivo end
   where id = any (p_envios);
  get diagnostics v_n = row_count;
  perform registrar_historico('whatsapp.queda_conciliada', 'queda_whatsapp', q.id::text,
    jsonb_build_object('decisao', p_decisao, 'mensagens', v_n));
  return jsonb_build_object('decididas', v_n);
end $$;

-- Encerrar (decisão 18): número de volta, nada parado e o resumo.
create function plataforma_encerrar_queda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_resumo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q quedas_whatsapp;
  v_resumo text := btrim(coalesce(p_resumo, ''));
  v_versao integer;
begin
  perform exigir_cuidar_da_queda(p_pessoa, p_condominio);
  q := exigir_queda(p_id);
  if q.estado <> 'CONFERINDO' then perform recusar_motivo('A queda só se encerra depois que o número volta', 'QUEDA_NAO_CONFERINDO'); end if;
  if exists (select 1 from envios_whatsapp e where e.queda_id = q.id and envio_parado(e)) then
    perform recusar_motivo('Decida antes o que ficou parado', 'QUEDA_COM_PARADAS');
  end if;
  if length(v_resumo) not between 10 and 2000 then perform recusar_campos('O que foi feito, de 10 a 2.000 caracteres', 'resumo'); end if;
  update quedas_whatsapp set estado = 'ENCERRADA', encerrada_em = app_now(), encerrada_por = p_pessoa, resumo = v_resumo
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('quedas_whatsapp', p_id); end if;
  perform registrar_historico('whatsapp.queda_encerrada', 'queda_whatsapp', p_id::text, jsonb_build_object(
    'minutos', (extract(epoch from (q.voltou_em - q.inicio)) / 60)::integer));
  return jsonb_build_object('versao', v_versao);
end $$;

-- O WhatsApp na Plataforma (0210) com a queda aberta, a conferência e as últimas quedas.
alter function plataforma_whatsapp(uuid, uuid) rename to whatsapp_r5b;
alter function whatsapp_r5b(uuid, uuid) security invoker;
create function plataforma_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  q quedas_whatsapp;
begin
  v := whatsapp_r5b(p_pessoa, p_condominio);
  select * into q from quedas_whatsapp where estado <> 'ENCERRADA';
  return v || jsonb_strip_nulls(jsonb_build_object(
    'queda', case when q.id is not null then queda_json(q, p_pessoa) || jsonb_build_object('envios', envios_da_queda(q, p_pessoa)) end,
    'quedas', coalesce((select jsonb_agg(queda_json(x, p_pessoa) order by x.inicio desc)
                          from (select * from quedas_whatsapp where estado = 'ENCERRADA' order by inicio desc limit 10) x), '[]'::jsonb),
    'responsavelQuedas', nome_pessoa(quem_cuida_das_quedas())))
    || jsonb_build_object('pode', (v -> 'pode') || jsonb_build_object('queda', pode(p_pessoa, p_condominio, 'pedidos.responder')));
end $$;

-- Uma queda encerrada, com o que foi decidido em cada mensagem.
create function plataforma_queda(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare q quedas_whatsapp;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  q := exigir_queda(p_id);
  return queda_json(q, p_pessoa) || jsonb_build_object('envios', envios_da_queda(q, p_pessoa));
end $$;

-- Configurações › WhatsApp (0200) com quem cuida das quedas e quem pode.
alter function plataforma_config_whatsapp(uuid, uuid) rename to config_whatsapp_r5;
alter function config_whatsapp_r5(uuid, uuid) security invoker;
create function plataforma_config_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := config_whatsapp_r5(p_pessoa, p_condominio);
  return v || jsonb_build_object(
    'quedas', jsonb_strip_nulls(jsonb_build_object(
      'pessoaId', (select whatsapp_quedas_pessoa from configuracao_condominio), 'quemCuida', nome_pessoa(quem_cuida_das_quedas()))),
    'pessoasQuedas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.pessoa_id, 'nome', x.nome, 'sindico', x.sindico) order by x.sindico desc, lower(x.nome))
        from (select distinct v.pessoa_id, nome_pessoa(v.pessoa_id) as nome, bool_or(v.funcao = 'SINDICO') as sindico
                from vinculos v where v.condominio_id = p_condominio and v.revogado_em is null and v.funcao in ('SINDICO', 'AUTORIZADO')
                 and (v.funcao = 'SINDICO' or pode(v.pessoa_id, v.condominio_id, 'pedidos.responder'))
               group by v.pessoa_id) x), '[]'::jsonb));
end $$;

-- Escolher quem cuida das quedas (decisão 14). Vazio volta ao síndico.
create function plataforma_quedas_responsavel(p_pessoa uuid, p_condominio uuid, p_versao integer, p_responsavel uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_responsavel is not null and not exists (
       select 1 from vinculos v where v.pessoa_id = p_responsavel and v.condominio_id = p_condominio and v.revogado_em is null
                                 and v.funcao in ('SINDICO', 'AUTORIZADO')
                                 and (v.funcao = 'SINDICO' or pode(v.pessoa_id, v.condominio_id, 'pedidos.responder'))) then
    perform recusar_campos('Escolha alguém que responde pelo WhatsApp do condomínio', 'pessoaId');
  end if;
  update configuracao_condominio set whatsapp_quedas_pessoa = p_responsavel where versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', (select id from configuracao_condominio)); end if;
  perform registrar_historico('whatsapp.quedas_responsavel', 'configuracao', p_condominio::text, jsonb_build_object('pessoa', p_responsavel));
  return jsonb_build_object('versao', v_versao);
end $$;

-- O canal alternativo para os moradores, enquanto o número estiver fora (decisão 15).
create function canal_alternativo() returns text
language sql stable
set search_path = public
as $$ select canal_alternativo from quedas_whatsapp where estado = 'FORA_DO_AR' $$;

alter function publico_etiqueta(text) rename to publico_etiqueta_r12;
alter function publico_etiqueta_r12(text) security invoker;
create function publico_etiqueta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_etiqueta_r12(p_codigo);
  if v ? 'foraDeUso' then return v; end if;
  return v || jsonb_strip_nulls(jsonb_build_object('canalAlternativo', canal_alternativo()));
end $$;

alter function publico_mural(text) rename to publico_mural_r12c;
alter function publico_mural_r12c(text) security invoker;
create function publico_mural(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_mural_r12c(p_codigo);
  if not (v ? 'comunicados') then return v; end if;
  return v || jsonb_strip_nulls(jsonb_build_object('canalAlternativo', canal_alternativo()));
end $$;

-- O resumo do WhatsApp no Início (0200) com a queda aberta.
create or replace function resumo_whatsapp() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'situacao', coalesce((select situacao from conexoes_whatsapp), 'SEM_CREDENCIAIS'),
    'aIdentificar', (select count(distinct telefone) from mensagens_whatsapp where triagem in ('A_IDENTIFICAR', 'RECADO')),
    'falhas', (select count(*) from envios_whatsapp where estado in ('FALHOU', 'DESCONHECIDO') and resolvida_em is null),
    'queda', (select jsonb_strip_nulls(jsonb_build_object('estado', q.estado, 'inicio', q.inicio, 'responsavel', nome_pessoa(q.responsavel),
                                                          'canalAlternativo', q.canal_alternativo,
                                                          'faltam', (select count(*) from envios_whatsapp e where e.queda_id = q.id and envio_parado(e))))
                from quedas_whatsapp q where q.estado <> 'ENCERRADA')))
$$;

-- ---------------------------------------------------------------------------------------
-- Sino: os avisos da reserva entram com os outros (0220).

alter function plataforma_avisos(uuid, uuid) rename to avisos_r12;
alter function avisos_r12(uuid, uuid) security invoker;
create function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := avisos_r12(p_pessoa, p_condominio);
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(x.item order by (x.item ->> 'vistoEm') is not null, (x.item ->> 'criadoEm')::timestamptz desc)
        from (select item from jsonb_array_elements(v -> 'itens') item
              union all
              select jsonb_strip_nulls(jsonb_build_object(
                       'id', a.id, 'tipo', 'RESERVA_' || a.tipo, 'manutencaoId', m.id, 'titulo', m.titulo,
                       'nome', l.para, 'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
                from avisos_reserva a join links_prestador l on l.id = a.link_id join manutencoes m on m.id = l.manutencao_id
               where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (v ->> 'naoVistos')::integer + (select count(*) from avisos_reserva where pessoa_id = p_pessoa and visto_em is null));
end $$;

alter function plataforma_marcar_avisos(uuid, uuid, uuid[]) rename to marcar_avisos_r12;
alter function marcar_avisos_r12(uuid, uuid, uuid[]) security invoker;
create function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_r integer;
begin
  v_n := marcar_avisos_r12(p_pessoa, p_condominio, p_ids);
  update avisos_reserva set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  return v_n + v_r;
end $$;

call fechar_acesso();

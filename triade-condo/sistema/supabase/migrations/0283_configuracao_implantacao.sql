-- 0283 · Configuração na implantação (PI-04, CF-01, CF-03, CF-09, CF-12; desenho "Configuração na
-- implantação", aprovado por Carolina em 20/10/2026).
--
-- A TRÍADE monta a configuração do condomínio pelo Console enquanto o cliente está em implantação,
-- com as mesmas funções que o app usa. Depois da entrega, o dia a dia é do síndico. Três grupos:
-- 1. Só a TRÍADE: fuso, etapas dos pedidos, etapas da manutenção, janela dos pedidos parecidos e o
--    tempo em que o que chega pelo WhatsApp entra no mesmo pedido. Saem das funções do app e passam
--    para funções do Console; com o cliente ativo, mudar pede motivo e avisa o síndico no sino.
-- 2. A TRÍADE monta e o síndico ajusta: tudo o mais da página Configurações. A equipe com
--    config.implantar muda pelas funções do app só enquanto o cliente está em implantação.
-- 3. Só o condomínio: revisar a conclusão, reabrir pedido, trocar o link do mural, o termo do piloto
--    e os avisos de cada pessoa. A TRÍADE nunca muda.
-- Cada parte é conferida por alguém da equipe; a etapa 4 do roteiro só fica realizada com as 11
-- conferidas, e uma mudança depois da conferência pede outra.

-- ---------------------------------------------------------------------------------------
-- Ações. Todas as funções internas veem a configuração (decisão 6); administração e
-- implantação montam e fazem os ajustes técnicos.

insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'config.ver'),
  ('IMPLANTACAO', 'config.ver'),
  ('SUPORTE', 'config.ver'),
  ('FINANCEIRO', 'config.ver'),
  ('ADMINISTRACAO', 'config.implantar'),
  ('IMPLANTACAO', 'config.implantar'),
  ('ADMINISTRACAO', 'config.tecnica'),
  ('IMPLANTACAO', 'config.tecnica');

-- A equipe enxerga o estágio dos clientes que atende: pode() confere a implantação antes de o
-- condomínio entrar no contexto.
create policy cliente_da_equipe on clientes for select
  using (contexto_equipe() and exists (
    select 1 from vinculos v join funcoes f on f.codigo = v.funcao
     where v.condominio_id = clientes.condominio_id and v.pessoa_id = contexto_pessoa()
       and v.revogado_em is null and f.sistema = 'CONSOLE'));

create function cliente_em_implantacao(p_condominio uuid) returns boolean
language sql stable
set search_path = public
as $$ select exists (select 1 from clientes where condominio_id = p_condominio and estado = 'IMPLANTACAO') $$;

-- pode() de antes continua sendo a regra do vínculo; a nova soma a montagem pela TRÍADE: quem tem
-- config.implantar muda as configurações do app enquanto o cliente está em implantação.
alter function pode(uuid, uuid, text) rename to pode_por_vinculo;
create function pode(p_pessoa uuid, p_condominio uuid, p_acao text) returns boolean
language sql stable
set search_path = public
as $$
  select pode_por_vinculo(p_pessoa, p_condominio, p_acao)
      or (p_acao = 'config.editar' and pode_por_vinculo(p_pessoa, p_condominio, 'config.implantar')
          and cliente_em_implantacao(p_condominio))
$$;

-- A pessoa da equipe montando a configuração deste cliente agora.
create function implantando(p_pessoa uuid, p_condominio uuid) returns boolean
language sql stable
set search_path = public
as $$ select pode_por_vinculo(p_pessoa, p_condominio, 'config.implantar') and cliente_em_implantacao(p_condominio) $$;

-- ---------------------------------------------------------------------------------------
-- Só o condomínio decide (grupo 3): a montagem não vale aqui.

alter function plataforma_definir_regras_pedidos(uuid, uuid, integer, boolean, boolean) rename to definir_regras_pedidos_f283;
alter function definir_regras_pedidos_f283(uuid, uuid, integer, boolean, boolean) security invoker;
create function plataforma_definir_regras_pedidos(p_pessoa uuid, p_condominio uuid, p_versao integer, p_revisao boolean,
                                                  p_reabertura boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  if not pode_por_vinculo(p_pessoa, p_condominio, 'config.editar') then
    raise exception 'Revisão e reabertura são decisão do condomínio' using errcode = 'TC401';
  end if;
  return definir_regras_pedidos_f283(p_pessoa, p_condominio, p_versao, p_revisao, p_reabertura);
end $$;

alter function plataforma_trocar_link_mural(uuid, uuid, integer, text) rename to trocar_link_mural_f283;
alter function trocar_link_mural_f283(uuid, uuid, integer, text) security invoker;
create function plataforma_trocar_link_mural(p_pessoa uuid, p_condominio uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  if not pode_por_vinculo(p_pessoa, p_condominio, 'config.editar') then
    raise exception 'Trocar o link do mural é com o condomínio' using errcode = 'TC401';
  end if;
  return trocar_link_mural_f283(p_pessoa, p_condominio, p_versao, p_motivo);
end $$;

-- Pedido novo (F6.4) é do grupo 2: o síndico ajusta, e a TRÍADE deixa pronto na implantação.
create or replace function plataforma_definir_aviso_novo(p_pessoa uuid, p_condominio uuid, p_versao integer, p_sindico text, p_protocolo boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if not (eh_sindico(p_pessoa) or implantando(p_pessoa, p_condominio)) then
    raise exception 'Só o síndico muda quem é avisado de pedido novo' using errcode = 'TC401';
  end if;
  if p_sindico is null or p_sindico not in ('NUNCA', 'SEM_RESPONSAVEL_OU_URGENTE', 'TODOS') then
    perform recusar_campos('Escolha quando avisar o síndico', 'sindico');
  end if;
  if p_protocolo is null then perform recusar_campos('Diga se manda o protocolo', 'protocolo'); end if;
  select id into v_id from configuracao_condominio;
  update configuracao_condominio set aviso_novo_sindico = p_sindico, aviso_novo_protocolo = p_protocolo
   where id = v_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_id); end if;
  perform registrar_historico('regras_aviso.pedido_novo', 'configuracao_condominio', v_id::text,
                              jsonb_build_object('sindico', p_sindico, 'protocolo', p_protocolo));
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- Só a TRÍADE (grupo 1). As funções do app saem; as do Console fazem o mesmo, com motivo e aviso
-- ao síndico quando o cliente já está ativo (decisão 10).

alter table avisos_triade drop constraint avisos_triade_tipo_check;
alter table avisos_triade add constraint avisos_triade_tipo_check
  check (tipo in ('ENTREGA', 'CHAMADO_RESPOSTA', 'ACESSO_PEDIDO', 'CONFIGURACAO'));
alter table avisos_triade add constraint avisos_triade_configuracao_texto check (tipo <> 'CONFIGURACAO' or texto is not null);

-- Entra para o ajuste técnico e devolve o motivo: em implantação é opcional; com o cliente ativo,
-- obrigatório.
create function exigir_ajuste_tecnico(p_pessoa uuid, p_condominio uuid, p_motivo text) returns text
language plpgsql
set search_path = public
as $$
declare v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.tecnica');
  if not cliente_em_implantacao(p_condominio) and coalesce(length(v_motivo), 0) not between 3 and 500 then
    perform recusar_campos('Com o cliente ativo, diga o motivo (3 a 500 caracteres)', 'motivo');
  end if;
  if length(v_motivo) > 500 then perform recusar_campos('Motivo de até 500 caracteres', 'motivo'); end if;
  return v_motivo;
end $$;

-- Com o cliente ativo, cada síndico recebe no sino o que a TRÍADE mudou e por quê.
create function avisar_ajuste_tecnico(p_texto text, p_motivo text) returns void
language plpgsql
set search_path = public
as $$
begin
  if cliente_em_implantacao(contexto_condominio()) then return; end if;
  insert into avisos_triade (condominio_id, pessoa_id, tipo, texto)
  select contexto_condominio(), s, 'CONFIGURACAO', left(p_texto || coalesce(' Motivo: ' || p_motivo, ''), 1000)
    from sindicos_ativos() s;
end $$;

drop function plataforma_definir_fuso(uuid, uuid, integer, text);
create function console_definir_fuso(p_pessoa uuid, p_condominio uuid, p_versao integer, p_fuso text, p_motivo text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := exigir_ajuste_tecnico(p_pessoa, p_condominio, p_motivo);
  v_antes configuracao_condominio;
  v_versao integer;
begin
  if not fuso_valido(p_fuso) then perform recusar_campos('Fuso desconhecido', 'fuso'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set fuso = p_fuso where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('fuso.alterado', 'configuracao_condominio', v_antes.id::text,
                              jsonb_strip_nulls(jsonb_build_object('de', v_antes.fuso, 'para', p_fuso, 'motivo', v_motivo)));
  perform avisar_ajuste_tecnico('A TRÍADE mudou o fuso do condomínio.', v_motivo);
  return v_versao;
end $$;

drop function plataforma_salvar_etapa(uuid, uuid, uuid, integer, text, text, uuid, boolean, boolean);
create function console_salvar_etapa_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                            p_situacao text, p_categoria uuid, p_pausa_prazo boolean, p_ativa boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := exigir_ajuste_tecnico(p_pessoa, p_condominio, p_motivo);
  v_antes etapas;
  v_id uuid;
  v_versao integer;
begin
  begin
    if p_id is null then
      if p_situacao is null or p_situacao not in ('ABERTO', 'EM_ANDAMENTO', 'ENCERRADO') then
        perform recusar_campos('Escolha a situação da etapa', 'situacao');
      end if;
      insert into etapas (condominio_id, nome, situacao, categoria_id, pausa_prazo, ordem)
      values (p_condominio, btrim(p_nome), p_situacao, p_categoria, coalesce(p_pausa_prazo, false),
              (select coalesce(max(ordem), 0) + 1 from etapas where situacao = p_situacao))
      returning id, versao into v_id, v_versao;
      perform registrar_historico('etapa.criada', 'etapa', v_id::text,
                                  jsonb_strip_nulls(jsonb_build_object('situacao', p_situacao, 'motivo', v_motivo)));
      perform avisar_ajuste_tecnico(format('A TRÍADE criou a etapa "%s" dos pedidos.', btrim(p_nome)), v_motivo);
    else
      select * into v_antes from etapas where id = p_id;
      if not found then raise exception 'Etapa não encontrada' using errcode = 'TC404'; end if;
      update etapas set nome = btrim(p_nome), pausa_prazo = coalesce(p_pausa_prazo, pausa_prazo), ativa = coalesce(p_ativa, ativa)
       where id = p_id and versao = p_versao returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('etapas', p_id); end if;
      perform exigir_etapas_essenciais();
      perform registrar_historico('etapa.alterada', 'etapa', v_id::text, jsonb_strip_nulls(jsonb_build_object('campos', to_jsonb(array_remove(array[
        case when v_antes.nome is distinct from btrim(p_nome) then 'nome' end,
        case when v_antes.pausa_prazo is distinct from coalesce(p_pausa_prazo, v_antes.pausa_prazo) then 'pausaPrazo' end,
        case when v_antes.ativa is distinct from coalesce(p_ativa, v_antes.ativa) then 'ativa' end], null)), 'motivo', v_motivo)));
      perform avisar_ajuste_tecnico(format('A TRÍADE mudou a etapa "%s" dos pedidos.', btrim(p_nome)), v_motivo);
    end if;
  exception
    when unique_violation then perform recusar_motivo('Já existe uma etapa ativa com este nome', 'NOME_REPETIDO');
    when foreign_key_violation then perform recusar_campos('Categoria não encontrada', 'categoriaId');
    when check_violation or not_null_violation then perform recusar_campos('Confira o nome e a pausa do prazo', 'nome', 'pausaPrazo');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

drop function plataforma_salvar_etapa_manutencao(uuid, uuid, uuid, integer, text, text, boolean);
create function console_salvar_etapa_manutencao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                                p_situacao text, p_ativa boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := exigir_ajuste_tecnico(p_pessoa, p_condominio, p_motivo);
  v etapas_manutencao;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id uuid;
  v_versao integer;
begin
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
    perform registrar_historico('etapa_manutencao.criada', 'etapas_manutencao', v_id::text,
                                jsonb_strip_nulls(jsonb_build_object('situacao', p_situacao, 'motivo', v_motivo)));
    perform avisar_ajuste_tecnico(format('A TRÍADE criou a etapa "%s" da manutenção.', v_nome), v_motivo);
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
    perform registrar_historico('etapa_manutencao.alterada', 'etapas_manutencao', v_id::text,
                                jsonb_strip_nulls(jsonb_build_object('ativa', coalesce(p_ativa, v.ativa), 'motivo', v_motivo)));
    perform avisar_ajuste_tecnico(format('A TRÍADE mudou a etapa "%s" da manutenção.', v_nome), v_motivo);
  end if;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

drop function plataforma_definir_parecidos(uuid, uuid, integer, integer);
create function console_definir_parecidos(p_pessoa uuid, p_condominio uuid, p_versao integer, p_dias integer, p_motivo text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := exigir_ajuste_tecnico(p_pessoa, p_condominio, p_motivo);
  v_antes configuracao_condominio;
  v_versao integer;
begin
  if p_dias is null or p_dias not in (30, 60, 90, 180) then perform recusar_campos('Escolha 30, 60, 90 ou 180 dias', 'dias'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set parecidos_dias = p_dias where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('parecidos.alterados', 'configuracao_condominio', v_antes.id::text,
    jsonb_strip_nulls(jsonb_build_object('antes', v_antes.parecidos_dias, 'depois', p_dias, 'motivo', v_motivo)));
  perform avisar_ajuste_tecnico(format('A TRÍADE mudou a janela dos pedidos parecidos para %s dias.', p_dias), v_motivo);
  return v_versao;
end $$;

-- O WhatsApp do app fica com a mensagem, a categoria e a prioridade; o tempo de anexar vai para o Console.
drop function plataforma_definir_whatsapp(uuid, uuid, integer, text, uuid, uuid, integer);
create function plataforma_definir_whatsapp(p_pessoa uuid, p_condominio uuid, p_versao integer, p_fora_horario text, p_categoria uuid,
                                            p_prioridade uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fora text := btrim(coalesce(p_fora_horario, ''));
  v_versao integer;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if length(v_fora) not between 20 and 600 then perform recusar_campos('Mensagem de fora do horário de 20 a 600 caracteres', 'foraHorario'); end if;
  -- Não prometer prazo nem atendimento imediato (W-12).
  if v_fora ~* '(imediat|em at[ée] [0-9]|garant|agora mesmo|j[áa] estamos)' then
    perform recusar_motivo('A mensagem de fora do horário não promete prazo nem atendimento imediato', 'PROMESSA_DE_PRAZO');
  end if;
  if not exists (select 1 from categorias where id = p_categoria and ativa) then perform recusar_campos('Escolha uma categoria ativa', 'categoriaId'); end if;
  if not exists (select 1 from prioridades where id = p_prioridade and ativa) then perform recusar_campos('Escolha uma prioridade ativa', 'prioridadeId'); end if;
  select id into v_id from configuracao_condominio;
  update configuracao_condominio set whatsapp_fora_horario = v_fora, whatsapp_categoria = p_categoria, whatsapp_prioridade = p_prioridade
   where id = v_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_id); end if;
  perform registrar_historico('whatsapp.configurado', 'configuracao_condominio', v_id::text, '{}'::jsonb);
  return v_versao;
end $$;

create function console_definir_anexar(p_pessoa uuid, p_condominio uuid, p_versao integer, p_minutos integer, p_motivo text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := exigir_ajuste_tecnico(p_pessoa, p_condominio, p_motivo);
  v_antes configuracao_condominio;
  v_versao integer;
begin
  if p_minutos is null or p_minutos not in (15, 30, 60) then perform recusar_campos('Escolha 15, 30 ou 60 minutos', 'minutos'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set whatsapp_anexar_minutos = p_minutos where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('whatsapp.anexar_alterado', 'configuracao_condominio', v_antes.id::text,
    jsonb_strip_nulls(jsonb_build_object('antes', v_antes.whatsapp_anexar_minutos, 'depois', p_minutos, 'motivo', v_motivo)));
  perform avisar_ajuste_tecnico(
    format('A TRÍADE mudou para %s minutos o tempo em que o que chega pelo WhatsApp entra no mesmo pedido.', p_minutos), v_motivo);
  return v_versao;
end $$;

-- Configurações › WhatsApp: a equipe também lê (config.ver), e todos sabem se podem o ajuste técnico.
create or replace function config_whatsapp_r5(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  cx conexoes_whatsapp;
  a avisos_whatsapp_pessoa;
begin
  perform definir_pessoa(p_pessoa);
  perform entrar_condominio(p_pessoa, p_condominio,
                            case when contexto_equipe() then 'config.ver' else 'plataforma.painel.ver' end);
  select * into cfg from configuracao_condominio;
  select * into cx from conexoes_whatsapp;
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa;
  return jsonb_strip_nulls(jsonb_build_object(
    'numero', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'config', jsonb_build_object('foraHorario', cfg.whatsapp_fora_horario, 'categoriaId', categoria_whatsapp(),
                                 'prioridadeId', prioridade_whatsapp(), 'anexarMinutos', cfg.whatsapp_anexar_minutos, 'versao', cfg.versao),
    'avisoGolpe', aviso_golpe_whatsapp(),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by lower(nome)) from categorias where ativa), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nivel) from prioridades where ativa), '[]'::jsonb),
    'meusAvisos', case when a.id is not null then jsonb_build_object('telefone', a.telefone, 'tipos', to_jsonb(a.tipos), 'ligado', a.ligado,
                                                                     'versao', a.versao) end,
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar'),
                               'tecnica', pode(p_pessoa, p_condominio, 'config.tecnica'),
                               'aceitarTermo', eh_sindico(p_pessoa) and cx.termo_aceito_em is null)));
end $$;

-- Os locais das etiquetas, sugeridos ao montar as Etiquetas: a equipe também lê.
create or replace function plataforma_locais(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform definir_pessoa(p_pessoa);
  perform entrar_condominio(p_pessoa, p_condominio, case when contexto_equipe() then 'config.ver' else 'plataforma.painel.ver' end);
  return coalesce((select jsonb_agg(e.local order by lower(e.local)) from etiquetas e where e.ativa), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------
-- Partes conferidas (decisão 8). Só de inserção; vale a última de cada parte, e uma mudança da
-- parte depois dela pede outra conferência.

create table conferencias_configuracao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  parte         text not null check (parte in ('HORARIOS', 'FERIADOS', 'AREAS', 'CATEGORIAS', 'ETAPAS', 'MODELOS', 'PRAZOS',
                                               'MANUTENCAO', 'COMUNICADOS', 'ETIQUETAS', 'WHATSAPP')),
  conferida_por uuid not null references pessoas (id),
  conferida_em  timestamptz not null default app_now(),
  -- De onde veio (tela 2): só no Console, nunca aparece para o cliente.
  nota          text check (length(btrim(nota)) between 1 and 500)
);
create index conferencias_configuracao_parte_idx on conferencias_configuracao (condominio_id, parte, conferida_em desc);
call proteger_tabela_interna('conferencias_configuracao', 'Partes da configuração conferidas pela equipe na implantação; o cliente não vê (PI-04, PI-06)');
create trigger conferencias_configuracao_sem_mudanca before update or delete on conferencias_configuracao
  for each row execute function somente_insercao();

-- Decisão 12: quem já foi entregue começa com as partes conferidas pela entrega.
insert into conferencias_configuracao (condominio_id, parte, conferida_por, conferida_em)
select i.condominio_id, p.parte, i.entregue_por, i.entregue_em
  from implantacoes i
 cross join unnest(array['HORARIOS', 'FERIADOS', 'AREAS', 'CATEGORIAS', 'ETAPAS', 'MODELOS', 'PRAZOS', 'MANUTENCAO', 'COMUNICADOS',
                         'ETIQUETAS', 'WHATSAPP']) p(parte)
 where i.entregue_em is not null;

-- As 11 partes, na ordem das abas do app.
create function partes_da_configuracao() returns text[]
language sql immutable
set search_path = public
as $$ select array['HORARIOS', 'FERIADOS', 'AREAS', 'CATEGORIAS', 'ETAPAS', 'MODELOS', 'PRAZOS', 'MANUTENCAO', 'COMUNICADOS',
                   'ETIQUETAS', 'WHATSAPP'] $$;

-- A parte que um evento do histórico muda (nulo: não é configuração).
create function parte_da_configuracao(p_acao text, p_entidade text) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_acao in ('horarios.alterados', 'fuso.alterado') then 'HORARIOS'
    when p_entidade = 'feriado' then 'FERIADOS'
    when p_entidade = 'areas_comuns' and p_acao like 'area.%' then 'AREAS'
    when p_entidade in ('categoria', 'prioridade') then 'CATEGORIAS'
    when p_entidade = 'etapa' then 'ETAPAS'
    when p_entidade = 'modelo_resposta' then 'MODELOS'
    when p_entidade = 'prazo' or p_acao in ('regras_aviso.alteradas', 'regras_aviso.pedido_novo') then 'PRAZOS'
    when p_entidade = 'etapas_manutencao' then 'MANUTENCAO'
    when p_acao in ('plano_comunicacao.alterado', 'mural_email.alterado') then 'COMUNICADOS'
    when p_entidade = 'etiquetas' then 'ETIQUETAS'
    when p_acao in ('whatsapp.configurado', 'whatsapp.quedas_responsavel') then 'WHATSAPP'
  end
$$;

-- Cada parte do condomínio do contexto: a última conferência, a última mudança e se vale.
create function situacao_partes_configuracao()
returns table (parte text, conferida_em timestamptz, conferida_por uuid, nota text, mudada_em timestamptz, mudada_por uuid,
               conferida boolean)
language sql stable
set search_path = public
as $$
  with mudancas as (
    select distinct on (x.parte) x.parte, x.ocorrido_em, x.autor_id
      from (select parte_da_configuracao(h.acao, h.entidade) as parte, h.ocorrido_em, h.autor_id, h.id
              from historico h
             where h.condominio_id = contexto_condominio()
               and (h.entidade in ('horarios', 'feriado', 'areas_comuns', 'categoria', 'prioridade', 'etapa', 'modelo_resposta', 'prazo',
                                   'etapas_manutencao', 'etiquetas')
                    or h.acao in ('fuso.alterado', 'regras_aviso.alteradas', 'regras_aviso.pedido_novo', 'plano_comunicacao.alterado',
                                  'mural_email.alterado', 'whatsapp.configurado', 'whatsapp.quedas_responsavel'))) x
     where x.parte is not null
     order by x.parte, x.ocorrido_em desc, x.id desc),
  conferencias as (
    select distinct on (c.parte) c.parte, c.conferida_em, c.conferida_por, c.nota
      from conferencias_configuracao c
     order by c.parte, c.conferida_em desc, c.id desc)
  select p.parte, c.conferida_em, c.conferida_por, c.nota, m.ocorrido_em, m.autor_id,
         c.conferida_em is not null and (m.ocorrido_em is null or m.ocorrido_em <= c.conferida_em)
    from unnest(partes_da_configuracao()) with ordinality p(parte, n)
    left join conferencias c on c.parte = p.parte
    left join mudancas m on m.parte = p.parte
   order by p.n
$$;

-- A aba Configuração da ficha (tela 1): as partes, o que é só do síndico e os ajustes da TRÍADE.
create function console_configuracao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_implantacao boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  if not contexto_equipe() then raise exception 'Sem permissão para config.ver neste condomínio' using errcode = 'TC401'; end if;
  select * into cfg from configuracao_condominio;
  v_implantacao := cliente_em_implantacao(p_condominio)
                   and not exists (select 1 from implantacoes where condominio_id = p_condominio and entregue_em is not null);
  return jsonb_build_object(
    'estagio', (select estado from clientes where condominio_id = p_condominio),
    'emImplantacao', v_implantacao,
    'partes', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'parte', s.parte, 'conferida', s.conferida,
                 'conferencia', case when s.conferida_em is not null then
                   jsonb_strip_nulls(jsonb_build_object('em', s.conferida_em, 'por', nome_pessoa(s.conferida_por), 'nota', s.nota)) end,
                 'mudanca', case when s.mudada_em is not null then
                   jsonb_strip_nulls(jsonb_build_object('em', s.mudada_em, 'por', nome_pessoa(s.mudada_por),
                                                        'equipe', exists (select 1 from equipe_triade e where e.pessoa_id = s.mudada_por))) end)))
                 from situacao_partes_configuracao() s),
    'sindico', jsonb_build_object(
      'termoAceito', (select termo_aceito_em is not null from conexoes_whatsapp),
      'revisao', cfg.revisao_conclusao,
      'reabertura', cfg.reabertura,
      'avisosLigados', (select count(*) from avisos_whatsapp_pessoa where ligado),
      'pessoas', (select count(distinct pessoa_id) from vinculos where condominio_id = p_condominio and revogado_em is null
                                                                    and funcao in ('SINDICO', 'AUTORIZADO'))),
    'ajustes', jsonb_build_object('fuso', cfg.fuso, 'parecidosDias', cfg.parecidos_dias, 'anexarMinutos', cfg.whatsapp_anexar_minutos,
                                  'versao', cfg.versao),
    'pode', jsonb_build_object(
      'conferir', v_implantacao and pode(p_pessoa, p_condominio, 'console.implantacao.editar'),
      'montar', pode(p_pessoa, p_condominio, 'config.editar'),
      'tecnica', pode(p_pessoa, p_condominio, 'config.tecnica')),
    'motivoObrigatorio', not cliente_em_implantacao(p_condominio));
end $$;

create function console_conferir_parte(p_pessoa uuid, p_condominio uuid, p_parte text, p_nota text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v implantacoes;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.editar');
  v := implantacao_do_cliente();
  if v.id is null or v.entregue_em is not null then
    perform recusar_motivo('A implantação deste cliente já foi entregue', 'JA_ENTREGUE');
  end if;
  if p_parte is null or not (p_parte = any (partes_da_configuracao())) then
    perform recusar_campos('Parte da configuração desconhecida', 'parte');
  end if;
  if length(btrim(p_nota)) > 500 then perform recusar_campos('De onde veio: até 500 caracteres', 'nota'); end if;
  insert into conferencias_configuracao (condominio_id, parte, conferida_por, nota)
  values (p_condominio, p_parte, p_pessoa, nullif(btrim(coalesce(p_nota, '')), '')) returning id into v_id;
  perform registrar_historico_interno('configuracao.conferida', 'implantacao', v.id::text, jsonb_build_object('parte', p_parte));
  return jsonb_build_object('id', v_id,
                            'conferidas', (select count(*) from situacao_partes_configuracao() where conferida),
                            'total', cardinality(partes_da_configuracao()));
end $$;

-- A etapa 4 do roteiro (decisão 4 e 8): só fica realizada com as 11 partes conferidas, e a
-- configuração sempre se aplica. Mudar uma parte depois não desfaz a etapa realizada.
alter function console_salvar_etapa(uuid, uuid, integer, integer, text, uuid, uuid, text, text, text, date) rename to salvar_etapa_implantacao_f283;
alter function salvar_etapa_implantacao_f283(uuid, uuid, integer, integer, text, uuid, uuid, text, text, text, date) security invoker;
create function console_salvar_etapa(p_pessoa uuid, p_condominio uuid, p_numero integer, p_versao integer, p_situacao text,
                                     p_responsavel uuid, p_substituto uuid, p_feito text, p_motivo text,
                                     p_modalidade text, p_quando date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare e etapas_implantacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.editar');
  select x.* into e from etapas_implantacao x join implantacoes i on i.id = x.implantacao_id
   where i.condominio_id = p_condominio and x.numero = p_numero;
  if e.chave = 'CONFIGURACAO' then
    if p_situacao = 'NAO_SE_APLICA' then
      perform recusar_motivo('A configuração sempre se aplica', 'CONFIGURACAO_OBRIGATORIA');
    end if;
    if p_situacao = 'REALIZADA' and e.situacao <> 'REALIZADA'
       and exists (select 1 from situacao_partes_configuracao() where not conferida) then
      perform recusar_motivo('Confira as 11 partes da configuração antes de marcar a etapa', 'CONFIGURACAO_SEM_CONFERIR');
    end if;
  end if;
  return salvar_etapa_implantacao_f283(p_pessoa, p_condominio, p_numero, p_versao, p_situacao, p_responsavel, p_substituto,
                                       p_feito, p_motivo, p_modalidade, p_quando);
end $$;

-- O roteiro mostra o andamento da configuração na etapa 4 (tela 4).
alter function console_implantacao(uuid, uuid) rename to implantacao_f283;
alter function implantacao_f283(uuid, uuid) security invoker;
create function console_implantacao(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := implantacao_f283(p_pessoa, p_condominio);
  if (v ->> 'legado')::boolean then return v; end if;
  return v || jsonb_build_object('configuracao', (
    select jsonb_build_object('conferidas', count(*) filter (where conferida), 'total', count(*),
                              'faltando', coalesce(jsonb_agg(parte) filter (where not conferida), '[]'::jsonb))
      from situacao_partes_configuracao()));
end $$;

-- ---------------------------------------------------------------------------------------
-- Configurações do app: quem pode o ajuste técnico (o síndico só lê) e o Pedido novo também
-- para quem está montando.

alter function plataforma_configuracoes(uuid, uuid) rename to configuracoes_f283;
alter function configuracoes_f283(uuid, uuid) security invoker;
create function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := configuracoes_f283(p_pessoa, p_condominio);
  return v || jsonb_build_object(
    'avisoNovo', (v -> 'avisoNovo') || jsonb_build_object(
      'podeMudar', (eh_sindico(p_pessoa) or implantando(p_pessoa, p_condominio)) and pode(p_pessoa, p_condominio, 'config.editar')),
    'tecnica', jsonb_build_object('pode', pode(p_pessoa, p_condominio, 'config.tecnica'),
                                  'motivo', pode(p_pessoa, p_condominio, 'config.tecnica') and not cliente_em_implantacao(p_condominio)),
    'anexarMinutos', (select whatsapp_anexar_minutos from configuracao_condominio));
end $$;

call fechar_acesso();

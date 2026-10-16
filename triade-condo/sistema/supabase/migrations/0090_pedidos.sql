-- 0090 · Pedidos no painel da Plataforma do síndico (passo 4; AT-01, AT-02, AT-03, AT-06,
-- AT-07, AT-11, AT-12, AT-13, AT-14, AT-15, AT-17, AT-24, AT-31, AT-32, CF-05)
--
-- Regras desta parte:
-- 1. O pedido nasce pelo painel (DC10): o síndico ou uma pessoa autorizada registra o que
--    chegou por telefone, pessoalmente, por mensagem, por e-mail ou o que ela mesma viu. O
--    WhatsApp entra no passo 5 como mais uma entrada para o mesmo pedido.
-- 2. Protocolo por condomínio e por ano ("2026-0001"), sem buracos, nunca reaproveitado.
-- 3. O pedido segue o guardião (0030): nasce aberto, anda, pode passar por revisão, é
--    encerrado ou cancelado, e pode ser reaberto. A etapa (configurada no passo 2) sempre
--    combina com a situação: aberto, em andamento ou encerrado (AT-05).
-- 4. Responsável real (AT-03): uma pessoa da lista de quem atende (CF-05), que confirma que
--    aceitou. Repassar volta a pedir o aceite. Sem ninguém disponível, o pedido fica sem
--    responsável, à vista na fila; nunca com pessoa inventada (AT-12).
-- 5. Próximo retorno (AT-06) é o compromisso de dar notícia ao morador; previsão de solução
--    (AT-07) é outra coisa, só quando conhecida. Registrar um retorno recalcula o próximo
--    retorno pelo prazo (AT-10) e não mexe na previsão; nota interna não conta como retorno.
--    Mudar qualquer um dos dois na mão exige motivo, que vai para o histórico.
-- 6. Pendência (AT-11) tem tipo, motivo e responsável. Concluir com pendência aberta não pode.
-- 7. Conclusão (AT-13) explica ao morador o que foi feito; a evidência é opcional. Revisão
--    (AT-14) é opcional por condomínio: ligada, quem não é síndico conclui e o síndico revisa;
--    o síndico que conclui já revisa. Reabrir (AT-15) pede motivo, preserva a conclusão
--    anterior e dá responsável e próximo retorno; pode ser desligado por condomínio.
--    Cancelar (AT-31) pede motivo; o pedido cancelado continua no histórico.
-- 8. Pedido privado (AT-32): só o síndico, quem registrou e o responsável veem.
-- 9. Tudo vai para o histórico (AT-17) com autor e data, e toda alteração leva a versão que a
--    pessoa leu (AT-24). Nada se apaga.
-- 10. Permissões (CF-03): Acompanhar vê; Responder registra retornos; Atualizar registra
--    pedidos e muda etapa, categoria, prioridade, responsável, previsão e pendências;
--    Concluir conclui, reabre e cancela. Revisar fica com o síndico. O responsável do pedido
--    responde e atualiza aquele pedido, mesmo sem as permissões gerais.

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'pedidos.ver'),
  ('SINDICO', 'pedidos.responder'),
  ('SINDICO', 'pedidos.atualizar'),
  ('SINDICO', 'pedidos.concluir'),
  ('SINDICO', 'pedidos.revisar');
insert into permissao_acoes (permissao, acao) values
  ('ACOMPANHAR', 'pedidos.ver'),
  ('RESPONDER', 'pedidos.ver'),
  ('RESPONDER', 'pedidos.responder'),
  ('ATUALIZAR', 'pedidos.ver'),
  ('ATUALIZAR', 'pedidos.atualizar'),
  ('CONCLUIR', 'pedidos.ver'),
  ('CONCLUIR', 'pedidos.concluir');
update permissoes set descricao = 'Registrar pedidos e mudar etapa, categoria, prioridade, responsável, previsão e pendências.'
 where codigo = 'ATUALIZAR';
update permissoes set descricao = 'Concluir, reabrir e cancelar pedidos.' where codigo = 'CONCLUIR';
update permissoes set descricao = 'Dar retorno aos moradores em nome do condomínio e combinar o próximo retorno.' where codigo = 'RESPONDER';

-- Revisão da conclusão (AT-14) e reabertura (AT-15), por condomínio.
alter table configuracao_condominio
  add column revisao_conclusao boolean not null default false,
  add column reabertura        boolean not null default true;

-- Permite referência composta (id e condomínio) às etapas, como nas categorias.
alter table etapas add constraint etapas_id_condominio unique (id, condominio_id);

-- ---------------------------------------------------------------------------------------
-- Protocolo (AT-01): um contador por condomínio e por ano.

create table protocolos_pedido (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  ano           smallint not null check (ano between 2000 and 2100),
  ultimo        integer not null check (ultimo between 1 and 999999),
  unique (condominio_id, ano)
);
call proteger_tabela_condominio('protocolos_pedido');
create trigger protocolos_pedido_sem_exclusao before delete on protocolos_pedido for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Pedidos.

create table pedidos (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  protocolo           text not null check (protocolo ~ '^\d{4}-\d{4,6}$'),
  unidade_id          uuid,
  contato_id          uuid,
  local               text check (length(btrim(local)) between 2 and 120),
  categoria_id        uuid not null,
  prioridade_id       uuid not null,
  etapa_id            uuid not null,
  assunto             text not null check (length(btrim(assunto)) between 3 and 120),
  descricao           text not null check (length(btrim(descricao)) between 3 and 4000),
  canal               text not null check (canal in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OBSERVACAO', 'OUTRO')),
  privado             boolean not null default false,
  estado              text not null check (estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO', 'ENCERRADO', 'CANCELADO')),
  responsavel_id      uuid,
  responsavel_desde   timestamptz,
  aceito_em           timestamptz,
  proximo_retorno     timestamptz,
  previsao            date check (previsao between date '2000-01-01' and date '2100-12-31'),
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid not null references pessoas (id),
  encerrado_em        timestamptz,
  cancelado_em        timestamptz,
  cancelado_por       uuid references pessoas (id),
  motivo_cancelamento text check (length(btrim(motivo_cancelamento)) between 3 and 500),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  foreign key (categoria_id, condominio_id) references categorias (id, condominio_id),
  foreign key (prioridade_id, condominio_id) references prioridades (id, condominio_id),
  foreign key (etapa_id, condominio_id) references etapas (id, condominio_id),
  foreign key (responsavel_id, condominio_id) references vinculos (id, condominio_id),
  unique (id, condominio_id),
  unique (condominio_id, protocolo),
  check (unidade_id is not null or local is not null),
  check (contato_id is null or unidade_id is not null),
  check ((responsavel_id is null) = (responsavel_desde is null)),
  check (aceito_em is null or responsavel_id is not null),
  check ((estado = 'ENCERRADO') = (encerrado_em is not null)),
  check ((estado = 'CANCELADO') = (cancelado_em is not null)),
  check ((cancelado_em is null) = (cancelado_por is null) and (cancelado_em is null) = (motivo_cancelamento is null)),
  check (estado in ('ABERTO', 'EM_ANDAMENTO') or proximo_retorno is null)
);
create index pedidos_estado on pedidos (condominio_id, estado);
create index pedidos_responsavel on pedidos (responsavel_id) where responsavel_id is not null;
create index pedidos_unidade on pedidos (unidade_id) where unidade_id is not null;
create index pedidos_criado on pedidos (condominio_id, criado_em desc);
call proteger_tabela_condominio('pedidos');
call ligar_guardiao('pedidos');
insert into estados_iniciais (tabela, estado) values ('pedidos', 'ABERTO');
insert into transicoes_permitidas (tabela, de, para) values
  ('pedidos', 'ABERTO', 'EM_ANDAMENTO'),
  ('pedidos', 'EM_ANDAMENTO', 'ABERTO'),
  ('pedidos', 'ABERTO', 'EM_REVISAO'),
  ('pedidos', 'EM_ANDAMENTO', 'EM_REVISAO'),
  ('pedidos', 'ABERTO', 'ENCERRADO'),
  ('pedidos', 'EM_ANDAMENTO', 'ENCERRADO'),
  ('pedidos', 'EM_REVISAO', 'ENCERRADO'),
  ('pedidos', 'EM_REVISAO', 'ABERTO'),
  ('pedidos', 'EM_REVISAO', 'EM_ANDAMENTO'),
  ('pedidos', 'ENCERRADO', 'ABERTO'),
  ('pedidos', 'ENCERRADO', 'EM_ANDAMENTO'),
  ('pedidos', 'ABERTO', 'CANCELADO'),
  ('pedidos', 'EM_ANDAMENTO', 'CANCELADO');
create trigger pedidos_sem_exclusao before delete on pedidos for each row execute function somente_insercao();

-- Situação de etapa que combina com cada estado do pedido.
create function situacao_da_etapa(p_estado text) returns text
language sql immutable
set search_path = public
as $$
  select case p_estado when 'ABERTO' then 'ABERTO' when 'EM_ANDAMENTO' then 'EM_ANDAMENTO'
                       when 'EM_REVISAO' then 'ENCERRADO' when 'ENCERRADO' then 'ENCERRADO' end
$$;

-- Responsável ativo da lista de quem atende (CF-05). "Disponível" é conferido à parte.
create function responsavel_ativo(p_vinculo uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from responsaveis_atendimento r join vinculos v on v.id = r.vinculo_id and v.revogado_em is null
                  where r.vinculo_id = p_vinculo and r.retirado_em is null)
$$;

create function responsavel_disponivel(p_vinculo uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from responsaveis_atendimento r join vinculos v on v.id = r.vinculo_id and v.revogado_em is null
                  where r.vinculo_id = p_vinculo and r.retirado_em is null and r.disponivel)
$$;

create function pedidos_regras() returns trigger
language plpgsql
set search_path = public
as $$
declare v_etapa etapas;
begin
  if tg_op = 'UPDATE' then
    if old.estado in ('ENCERRADO', 'CANCELADO') and new.estado = old.estado then
      raise exception 'Pedido encerrado não muda: reabra' using errcode = 'TC422', detail = '{"motivo":"PEDIDO_ENCERRADO"}';
    end if;
    if (new.condominio_id, new.protocolo, new.unidade_id, new.contato_id, new.assunto, new.descricao, new.canal, new.criado_em, new.criado_por)
       is distinct from (old.condominio_id, old.protocolo, old.unidade_id, old.contato_id, old.assunto, old.descricao, old.canal, old.criado_em, old.criado_por) then
      raise exception 'O registro do pedido não muda: acrescente uma nota' using errcode = 'TC422';
    end if;
    new.atualizado_em := app_now();
  else
    if new.unidade_id is not null and not exists (select 1 from unidades where id = new.unidade_id and ativa) then
      raise exception 'Unidade desativada' using errcode = 'TC422', detail = '{"motivo":"UNIDADE_INATIVA"}';
    end if;
    if new.contato_id is not null and not exists (
      select 1 from contatos_unidade where contato_id = new.contato_id and unidade_id = new.unidade_id and estado = 'CONFIRMADO') then
      raise exception 'Escolha um contato confirmado desta unidade' using errcode = 'TC422', detail = '{"motivo":"CONTATO_NAO_CONFIRMADO"}';
    end if;
  end if;

  if tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id then
    if not exists (select 1 from categorias where id = new.categoria_id and ativa) then
      raise exception 'Escolha uma categoria ativa' using errcode = 'TC422', detail = '{"campos":["categoriaId"]}';
    end if;
  end if;
  if tg_op = 'INSERT' or new.prioridade_id is distinct from old.prioridade_id then
    if not exists (select 1 from prioridades where id = new.prioridade_id and ativa) then
      raise exception 'Escolha uma prioridade ativa' using errcode = 'TC422', detail = '{"campos":["prioridadeId"]}';
    end if;
  end if;

  -- A etapa combina com a situação e com a categoria (AT-05); etapa nova só se estiver ativa.
  if new.estado <> 'CANCELADO' then
    select * into v_etapa from etapas where id = new.etapa_id;
    if v_etapa.situacao <> situacao_da_etapa(new.estado)
       or (v_etapa.categoria_id is not null and v_etapa.categoria_id <> new.categoria_id)
       or ((tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id) and not v_etapa.ativa) then
      raise exception 'Etapa que não combina com o pedido' using errcode = 'TC422', detail = '{"motivo":"ETAPA_INCOMPATIVEL"}';
    end if;
  end if;

  if new.responsavel_id is not null and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and not responsavel_ativo(new.responsavel_id) then
    raise exception 'O responsável precisa estar na lista de quem atende' using errcode = 'TC422', detail = '{"motivo":"RESPONSAVEL_INVALIDO"}';
  end if;
  return new;
end $$;
create trigger pedidos_regras before insert or update on pedidos for each row execute function pedidos_regras();

-- ---------------------------------------------------------------------------------------
-- Pendências e impedimentos (AT-11, AT-12).

create table pendencias_pedido (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  pedido_id      uuid not null,
  tipo           text not null check (tipo in ('FORNECEDOR', 'MORADOR', 'DECISAO', 'PECA', 'ACESSO', 'SEM_EXECUTOR', 'OUTRO')),
  motivo         text not null check (length(btrim(motivo)) between 3 and 300),
  responsavel_id uuid not null,
  aberta_em      timestamptz not null default app_now(),
  aberta_por     uuid not null references pessoas (id),
  resolvida_em   timestamptz,
  resolvida_por  uuid references pessoas (id),
  resolucao      text check (length(btrim(resolucao)) between 2 and 300),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (responsavel_id, condominio_id) references vinculos (id, condominio_id),
  check ((resolvida_em is null) = (resolvida_por is null)),
  check (resolucao is null or resolvida_em is not null)
);
create index pendencias_pedido_pedido on pendencias_pedido (pedido_id);
call proteger_tabela_condominio('pendencias_pedido');
create trigger pendencias_pedido_sem_exclusao before delete on pendencias_pedido for each row execute function somente_insercao();

create function pendencias_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from vinculos where id = new.responsavel_id and funcao in ('SINDICO', 'AUTORIZADO') and revogado_em is null) then
      raise exception 'O responsável da pendência é o síndico ou uma pessoa autorizada' using errcode = 'TC422',
        detail = '{"motivo":"RESPONSAVEL_INVALIDO"}';
    end if;
  elsif old.resolvida_em is not null
     or (new.condominio_id, new.pedido_id, new.tipo, new.motivo, new.responsavel_id, new.aberta_em, new.aberta_por)
        is distinct from (old.condominio_id, old.pedido_id, old.tipo, old.motivo, old.responsavel_id, old.aberta_em, old.aberta_por) then
    raise exception 'Pendência só muda para resolvida' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger pendencias_pedido_regras before insert or update on pendencias_pedido
  for each row execute function pendencias_pedido_regras();

-- ---------------------------------------------------------------------------------------
-- Andamento: retornos dados ao morador (AT-06) e notas internas. Só inserção.

create table andamentos_pedido (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pedido_id     uuid not null,
  tipo          text not null check (tipo in ('RETORNO', 'NOTA')),
  meio          text check (meio in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OUTRO')),
  texto         text not null check (length(btrim(texto)) between 3 and 2000),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid not null references pessoas (id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  check ((tipo = 'RETORNO') = (meio is not null))
);
create index andamentos_pedido_pedido on andamentos_pedido (pedido_id, criado_em);
call proteger_tabela_condominio('andamentos_pedido');
create trigger andamentos_pedido_somente_insercao before update or delete on andamentos_pedido
  for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Conclusões (AT-13, AT-14, AT-15). Cada conclusão fica, mesmo depois de reaberta.

create table conclusoes_pedido (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  pedido_id         uuid not null,
  etapa_id          uuid not null,
  etapa_anterior    uuid not null,
  explicacao        text not null check (length(btrim(explicacao)) between 10 and 2000),
  evidencia         text check (length(btrim(evidencia)) between 2 and 300),
  concluida_em      timestamptz not null default app_now(),
  concluida_por     uuid not null references pessoas (id),
  revisao           text not null check (revisao in ('SEM_REVISAO', 'AGUARDANDO', 'APROVADA', 'DEVOLVIDA')),
  revisada_em       timestamptz,
  revisada_por      uuid references pessoas (id),
  motivo_devolucao  text check (length(btrim(motivo_devolucao)) between 3 and 500),
  reaberta_em       timestamptz,
  reaberta_por      uuid references pessoas (id),
  motivo_reabertura text check (length(btrim(motivo_reabertura)) between 3 and 500),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (etapa_id, condominio_id) references etapas (id, condominio_id),
  foreign key (etapa_anterior, condominio_id) references etapas (id, condominio_id),
  check ((revisao in ('APROVADA', 'DEVOLVIDA')) = (revisada_em is not null)),
  check ((revisada_em is null) = (revisada_por is null)),
  check ((revisao = 'DEVOLVIDA') = (motivo_devolucao is not null)),
  check ((reaberta_em is null) = (reaberta_por is null) and (reaberta_em is null) = (motivo_reabertura is null)),
  check (reaberta_em is null or revisao in ('SEM_REVISAO', 'APROVADA'))
);
create index conclusoes_pedido_pedido on conclusoes_pedido (pedido_id, concluida_em);
call proteger_tabela_condominio('conclusoes_pedido');
create trigger conclusoes_pedido_sem_exclusao before delete on conclusoes_pedido for each row execute function somente_insercao();

-- A conclusão não muda: só recebe a revisão (uma vez) e a reabertura (uma vez).
create function conclusoes_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.pedido_id, new.etapa_id, new.etapa_anterior, new.explicacao, new.evidencia, new.concluida_em, new.concluida_por)
     is distinct from (old.condominio_id, old.pedido_id, old.etapa_id, old.etapa_anterior, old.explicacao, old.evidencia, old.concluida_em, old.concluida_por)
     or (old.revisao <> 'AGUARDANDO' and (new.revisao, new.revisada_em, new.revisada_por, new.motivo_devolucao)
                                          is distinct from (old.revisao, old.revisada_em, old.revisada_por, old.motivo_devolucao))
     or (old.reaberta_em is not null and (new.reaberta_em, new.reaberta_por, new.motivo_reabertura)
                                         is distinct from (old.reaberta_em, old.reaberta_por, old.motivo_reabertura)) then
    raise exception 'A conclusão fica como foi registrada' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger conclusoes_pedido_regras before update on conclusoes_pedido for each row execute function conclusoes_pedido_regras();

-- ---------------------------------------------------------------------------------------
-- Responsável retirado da lista de quem atende (CF-05): os pedidos em aberto dele passam ao
-- responsável padrão (que o síndico escolhe antes de retirar) ou ficam sem responsável, à
-- vista na fila. Quem assume confirma o aceite.

create function pedidos_do_responsavel_retirado() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_padrao uuid;
  r record;
begin
  if old.retirado_em is not null or new.retirado_em is null then return null; end if;
  select responsavel_padrao into v_padrao from configuracao_condominio where condominio_id = new.condominio_id;
  if v_padrao = new.vinculo_id or not responsavel_disponivel(v_padrao) then v_padrao := null; end if;
  for r in select id from pedidos where responsavel_id = new.vinculo_id and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') loop
    update pedidos set responsavel_id = v_padrao, responsavel_desde = case when v_padrao is not null then app_now() end, aceito_em = null
     where id = r.id;
    perform registrar_historico('pedido.responsavel', 'pedidos', r.id::text,
      jsonb_strip_nulls(jsonb_build_object('de', new.vinculo_id, 'para', v_padrao, 'motivo', 'Saiu da lista de quem atende')));
  end loop;
  return null;
end $$;
create trigger pedidos_do_responsavel_retirado after update of retirado_em on responsaveis_atendimento
  for each row execute function pedidos_do_responsavel_retirado();

-- ---------------------------------------------------------------------------------------
-- Ajudantes das funções da API (o contexto já é o condomínio).

create function eh_sindico(p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from vinculos where pessoa_id = p_pessoa and condominio_id = contexto_condominio()
                                          and funcao = 'SINDICO' and revogado_em is null)
$$;

create function eh_responsavel(p_pessoa uuid, p_pedido pedidos) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from vinculos where id = p_pedido.responsavel_id and pessoa_id = p_pessoa and revogado_em is null)
$$;

-- Pedido privado (AT-32): só o síndico, quem registrou e o responsável.
create function pedido_visivel(p_pessoa uuid, p_pedido pedidos) returns boolean
language sql stable
set search_path = public
as $$
  select not p_pedido.privado or p_pedido.criado_por = p_pessoa or eh_responsavel(p_pessoa, p_pedido) or eh_sindico(p_pessoa)
$$;

-- A pessoa pode fazer a ação neste pedido: pela permissão ou por ser o responsável dele
-- (responder e atualizar).
create function pode_no_pedido(p_pessoa uuid, p_pedido pedidos, p_acao text) returns boolean
language sql stable
set search_path = public
as $$
  select pode(p_pessoa, contexto_condominio(), p_acao)
      or (p_acao in ('pedidos.responder', 'pedidos.atualizar') and eh_responsavel(p_pessoa, p_pedido))
$$;

-- Pedido que a pessoa enxerga; o privado de outros responde como não encontrado.
create function exigir_pedido(p_pessoa uuid, p_id uuid) returns pedidos
language plpgsql
set search_path = public
as $$
declare v pedidos;
begin
  select * into v from pedidos where id = p_id;
  if not found or not pedido_visivel(p_pessoa, v) then raise exception 'Pedido não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

create function exigir_acao_no_pedido(p_pessoa uuid, p_pedido pedidos, p_acao text) returns void
language plpgsql
set search_path = public
as $$
begin
  if not pode_no_pedido(p_pessoa, p_pedido, p_acao) then
    raise exception 'Sem permissão para % neste pedido', p_acao using errcode = 'TC401';
  end if;
end $$;

-- Pedido em andamento (aberto ou em andamento). Em revisão, só nota, revisão e cancelamento.
create function exigir_em_andamento(p_pedido pedidos) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_pedido.estado in ('ENCERRADO', 'CANCELADO') then
    perform recusar_motivo('Pedido encerrado: reabra para mudar', 'PEDIDO_ENCERRADO');
  elsif p_pedido.estado = 'EM_REVISAO' then
    perform recusar_motivo('Pedido em revisão: aguarde a revisão do síndico', 'PEDIDO_EM_REVISAO');
  end if;
end $$;

-- Sobe a versão do pedido lido (AT-24): toda ação sobre o pedido passa por aqui ou por um
-- update com a versão.
create function tocar_pedido(p_id uuid, p_versao integer) returns integer
language plpgsql
set search_path = public
as $$
declare v_versao integer;
begin
  update pedidos set atualizado_em = app_now() where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  return v_versao;
end $$;

-- Primeira etapa ativa da situação: a da categoria antes da geral.
create function etapa_inicial(p_categoria uuid, p_situacao text) returns uuid
language sql stable
set search_path = public
as $$
  select id from etapas
   where ativa and situacao = p_situacao and (categoria_id is null or categoria_id = p_categoria)
   order by (categoria_id is not null) desc, ordem, criado_em
   limit 1
$$;

-- Próximo retorno a partir de agora, pelo prazo da categoria e da prioridade (AT-10).
-- Sem prazo configurado, nenhum: a tela mostra que não há compromisso.
create function calcular_proximo_retorno(p_categoria uuid, p_prioridade uuid) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare v_horas integer := horas_de_prazo(contexto_condominio(), p_categoria, p_prioridade);
begin
  if v_horas is null then return null; end if;
  return vencimento_do_prazo(contexto_condominio(), app_now(), v_horas);
end $$;

-- Retorno vencido: em aberto, com o prazo passado e fora de etapa que pausa o prazo.
create function retorno_vencido(p_pedido pedidos) returns boolean
language sql stable
set search_path = public
as $$
  select p_pedido.estado in ('ABERTO', 'EM_ANDAMENTO') and p_pedido.proximo_retorno is not null
     and p_pedido.proximo_retorno < app_now()
     and not coalesce((select pausa_prazo from etapas where id = p_pedido.etapa_id), false)
$$;

create function nome_do_vinculo(p_vinculo uuid) returns text
language sql stable
set search_path = public
as $$ select p.nome from vinculos v join pessoas p on p.id = v.pessoa_id where v.id = p_vinculo $$;

-- O vínculo ativo da pessoa no condomínio do contexto (síndico antes de autorizado).
create function meu_vinculo(p_pessoa uuid) returns uuid
language sql stable
set search_path = public
as $$
  select id from vinculos where pessoa_id = p_pessoa and condominio_id = contexto_condominio() and revogado_em is null
                            and funcao in ('SINDICO', 'AUTORIZADO')
   order by funcao = 'AUTORIZADO' limit 1
$$;

create function exigir_motivo(p_motivo text, p_campo text default 'motivo') returns text
language plpgsql
set search_path = public
as $$
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    perform recusar_campos('Explique o motivo (de 3 a 500 caracteres)', p_campo);
  end if;
  return btrim(p_motivo);
end $$;

-- Resumo dos pedidos que a pessoa enxerga, para o Início e a fila.
create function resumo_pedidos(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with visiveis as (
    select p.*, retorno_vencido(p) as vencido, eh_responsavel(p_pessoa, p) as meu
      from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') and pedido_visivel(p_pessoa, p))
  select jsonb_build_object(
    'ativos', (select count(*) from visiveis),
    'semResponsavel', (select count(*) from visiveis where responsavel_id is null),
    'aguardandoAceite', (select count(*) from visiveis where responsavel_id is not null and aceito_em is null),
    'meusParaAceitar', (select count(*) from visiveis where meu and aceito_em is null),
    'retornoVencido', (select count(*) from visiveis where vencido),
    'emRevisao', (select count(*) from visiveis where estado = 'EM_REVISAO'),
    'comPendencia', (select count(*) from visiveis v where exists (select 1 from pendencias_pedido pp where pp.pedido_id = v.id and pp.resolvida_em is null)),
    'meus', (select count(*) from visiveis where meu))
$$;

-- ---------------------------------------------------------------------------------------
-- Funções da API da Plataforma (security definer). Pessoa e condomínio vêm da sessão.

-- O painel ganha o resumo dos pedidos para quem pode ver.
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
    'pedidos', case when pode(p_pessoa, c.id, 'pedidos.ver') then resumo_pedidos(p_pessoa) end))
    into v
    from condominios c, pessoas p
   where c.id = p_condominio and p.id = p_pessoa;
  return v;
end $$;

-- As configurações ganham as regras dos pedidos (revisão e reabertura).
create or replace function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  select jsonb_build_object(
    'fuso', c.fuso,
    'versao', c.versao,
    'horarios', (select jsonb_object_agg(h.tipo, jsonb_build_object('intervalos', h.intervalos, 'versao', h.versao)) from horarios h),
    'feriados', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'data', to_char(f.data, 'YYYY-MM-DD'), 'descricao', f.descricao)
                                           order by f.data) from feriados f), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'ativa', x.ativa, 'versao', x.versao)
                                             order by x.ativa desc, lower(x.nome)) from categorias x), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'significado', x.significado,
                                                                 'nivel', x.nivel, 'ativa', x.ativa, 'versao', x.versao)
                                              order by x.nivel) from prioridades x), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'situacao', x.situacao,
                                                            'categoriaId', x.categoria_id, 'pausaPrazo', x.pausa_prazo,
                                                            'ordem', x.ordem, 'ativa', x.ativa, 'versao', x.versao)
                                         order by array_position(array['ABERTO', 'EM_ANDAMENTO', 'ENCERRADO'], x.situacao), x.ordem, lower(x.nome))
                         from etapas x), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'texto', x.texto,
                                                             'categoriaId', x.categoria_id, 'ativo', x.ativo, 'versao', x.versao)
                                          order by x.ativo desc, lower(x.titulo)) from modelos_resposta x), '[]'::jsonb),
    'prazos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'categoriaId', x.categoria_id, 'prioridadeId', x.prioridade_id,
                                                            'horas', x.horas, 'versao', x.versao)
                                         order by (x.categoria_id is not null), (x.prioridade_id is not null), x.id) from prazos x), '[]'::jsonb),
    'regrasPedidos', jsonb_build_object('revisao', c.revisao_conclusao, 'reabertura', c.reabertura),
    'pendencias', to_jsonb(pendencias_configuracao(c.condominio_id)),
    'podeEditar', pode(p_pessoa, p_condominio, 'config.editar'))
    into v
    from configuracao_condominio c;
  return v;
end $$;

-- Revisão da conclusão (AT-14) e reabertura (AT-15) ligadas ou não.
create function plataforma_definir_regras_pedidos(p_pessoa uuid, p_condominio uuid, p_versao integer, p_revisao boolean,
                                                  p_reabertura boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_revisao is null or p_reabertura is null then perform recusar_campos('Escolha sim ou não', 'revisao', 'reabertura'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set revisao_conclusao = p_revisao, reabertura = p_reabertura
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('regras_pedidos.alteradas', 'configuracao_condominio', v_antes.id::text,
    jsonb_build_object('antes', jsonb_build_object('revisao', v_antes.revisao_conclusao, 'reabertura', v_antes.reabertura),
                       'depois', jsonb_build_object('revisao', p_revisao, 'reabertura', p_reabertura)));
  return v_versao;
end $$;

-- O que a tela dos pedidos precisa para filtrar e registrar: categorias, prioridades,
-- etapas, quem atende, unidades e o que a pessoa pode fazer.
create function plataforma_pedidos_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  return jsonb_build_object(
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'ativa', x.ativa)
                                             order by x.ativa desc, lower(x.nome)) from categorias x), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'significado', x.significado,
                                                                 'nivel', x.nivel, 'ativa', x.ativa)
                                              order by x.nivel desc) from prioridades x), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'situacao', x.situacao,
                                                            'categoriaId', x.categoria_id, 'pausaPrazo', x.pausa_prazo, 'ativa', x.ativa)
                                         order by array_position(array['ABERTO', 'EM_ANDAMENTO', 'ENCERRADO'], x.situacao), x.ordem, lower(x.nome))
                         from etapas x), '[]'::jsonb),
    'responsaveis', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'disponivel', r.disponivel, 'eu', v.pessoa_id = p_pessoa)
                       order by r.disponivel desc, p.nome)
        from responsaveis_atendimento r join vinculos v on v.id = r.vinculo_id and v.revogado_em is null join pessoas p on p.id = v.pessoa_id
       where r.retirado_em is null), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'eu', v.pessoa_id = p_pessoa) order by p.nome)
        from vinculos v join pessoas p on p.id = v.pessoa_id
       where v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null), '[]'::jsonb),
    'responsavelPadrao', (select c.responsavel_padrao from configuracao_condominio c where responsavel_disponivel(c.responsavel_padrao)),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', nome_da_unidade(b.nome, u.andar, u.identificacao))
                       order by b.ordem nulls first, lower(b.nome) nulls first, chave_andar(u.andar), chave_unidade(u.identificacao))
        from unidades u left join blocos b on b.id = u.bloco_id where u.ativa), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'texto', x.texto, 'categoriaId', x.categoria_id)
                                          order by lower(x.titulo)) from modelos_resposta x where x.ativo), '[]'::jsonb),
    'regras', (select jsonb_build_object('revisao', c.revisao_conclusao, 'reabertura', c.reabertura) from configuracao_condominio c),
    'pode', jsonb_build_object(
      'registrar', pode(p_pessoa, p_condominio, 'pedidos.atualizar'),
      'responder', pode(p_pessoa, p_condominio, 'pedidos.responder'),
      'atualizar', pode(p_pessoa, p_condominio, 'pedidos.atualizar'),
      'concluir', pode(p_pessoa, p_condominio, 'pedidos.concluir'),
      'revisar', pode(p_pessoa, p_condominio, 'pedidos.revisar')),
    'meuVinculo', meu_vinculo(p_pessoa));
end $$;

-- Contatos confirmados de uma unidade, para escolher quem pediu (MU-02: só o confirmado vale).
-- Sem telefone: quem registra só precisa saber quem é.
create function plataforma_pedido_contatos(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.atualizar');
  perform exigir_unidade(p_unidade);
  return coalesce((
    select jsonb_agg(jsonb_build_object('contatoId', ct.id, 'nome', ct.nome, 'relacao', cu.relacao, 'principal', cu.principal)
                     order by cu.principal desc, lower(ct.nome))
      from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
     where cu.unidade_id = p_unidade and cu.estado = 'CONFIRMADO'), '[]'::jsonb);
end $$;

-- Registrar um pedido (AT-01). Sem responsável escolhido, vai para o responsável padrão da
-- fila, se disponível. Quem registra para si mesmo já aceita.
create function plataforma_registrar_pedido(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_local text,
                                            p_categoria uuid, p_prioridade uuid, p_assunto text, p_descricao text, p_canal text,
                                            p_privado boolean, p_responsavel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resp uuid := p_responsavel;
  v_ano integer;
  v_numero integer;
  v_protocolo text;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.atualizar');
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  if p_unidade is null and nullif(btrim(coalesce(p_local, '')), '') is null then
    perform recusar_campos('Informe a unidade ou o local', 'unidadeId', 'local');
  end if;
  if p_contato is not null and p_unidade is null then perform recusar_campos('Escolha a unidade de quem pediu', 'unidadeId'); end if;
  if p_canal is null or p_canal not in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OBSERVACAO', 'OUTRO') then
    perform recusar_campos('Diga como o pedido chegou', 'canal');
  end if;
  if v_resp is null then
    select responsavel_padrao into v_resp from configuracao_condominio;
    if not responsavel_disponivel(v_resp) then v_resp := null; end if;
  elsif not responsavel_disponivel(v_resp) then
    perform recusar_motivo('Escolha um responsável disponível', 'RESPONSAVEL_INDISPONIVEL');
  end if;

  v_ano := extract(year from hoje_no_condominio())::integer;
  insert into protocolos_pedido as x (condominio_id, ano, ultimo) values (p_condominio, v_ano, 1)
  on conflict (condominio_id, ano) do update set ultimo = x.ultimo + 1
  returning ultimo into v_numero;
  v_protocolo := v_ano || '-' || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;

  perform definir_transicao('REGISTRADO');
  begin
    insert into pedidos (condominio_id, protocolo, unidade_id, contato_id, local, categoria_id, prioridade_id, etapa_id,
                         assunto, descricao, canal, privado, estado, responsavel_id, responsavel_desde, aceito_em,
                         proximo_retorno, criado_por)
    values (p_condominio, v_protocolo, p_unidade, p_contato, nullif(btrim(coalesce(p_local, '')), ''), p_categoria, p_prioridade,
            coalesce(etapa_inicial(p_categoria, 'ABERTO'), etapa_inicial(null, 'ABERTO')),
            btrim(p_assunto), btrim(p_descricao), p_canal, coalesce(p_privado, false), 'ABERTO',
            v_resp, case when v_resp is not null then app_now() end,
            case when exists (select 1 from vinculos where id = v_resp and pessoa_id = p_pessoa) then app_now() end,
            calcular_proximo_retorno(p_categoria, p_prioridade), p_pessoa)
    returning id into v_id;
  exception
    when foreign_key_violation then perform recusar_campos('Categoria, prioridade ou contato não encontrado', 'categoriaId', 'prioridadeId', 'contatoId');
    when check_violation or not_null_violation then
      perform recusar_campos('Confira o assunto (3 a 120 caracteres), a descrição (3 a 4000) e o local', 'assunto', 'descricao', 'local');
  end;
  perform registrar_historico('pedido.registrado', 'pedidos', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'protocolo', v_protocolo, 'canal', p_canal, 'privado', case when coalesce(p_privado, false) then true end, 'responsavel', v_resp)));
  return jsonb_build_object('id', v_id, 'protocolo', v_protocolo, 'versao', 1);
end $$;

-- Fila (AT-02): filtros por situação, responsável, prioridade, categoria e atenção, busca
-- por protocolo, assunto, local ou unidade, em páginas de 50. Mostra há quanto tempo cada
-- pedido está aberto (a tela calcula a partir de abertoEm e agora).
-- p_situacao: ATIVOS (padrão), ABERTO, EM_ANDAMENTO, EM_REVISAO, ENCERRADO, CANCELADO, TODOS.
-- p_responsavel: EU, NENHUM ou o id do vínculo. p_atencao: SEM_RESPONSAVEL, AGUARDANDO_ACEITE,
-- RETORNO_VENCIDO, COM_PENDENCIA.
create function plataforma_pedidos(p_pessoa uuid, p_condominio uuid, p_situacao text, p_responsavel text, p_prioridade uuid,
                                   p_categoria uuid, p_atencao text, p_busca text, p_pagina integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_situacao text := coalesce(p_situacao, 'ATIVOS');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_resp uuid;
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if v_situacao not in ('ATIVOS', 'ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO', 'ENCERRADO', 'CANCELADO', 'TODOS') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  if p_atencao is not null and p_atencao not in ('SEM_RESPONSAVEL', 'AGUARDANDO_ACEITE', 'RETORNO_VENCIDO', 'COM_PENDENCIA') then
    perform recusar_campos('Filtro desconhecido', 'atencao');
  end if;
  if p_responsavel is not null and p_responsavel not in ('EU', 'NENHUM') then
    if p_responsavel !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform recusar_campos('Responsável desconhecido', 'responsavel');
    end if;
    v_resp := p_responsavel::uuid;
  end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');

  with lista as (
    select p.*, retorno_vencido(p) as vencido, eh_responsavel(p_pessoa, p) as eu, u.identificacao, u.andar, b.nome as bloco,
           ca.nome as categoria, pr.nome as prioridade, pr.nivel, e.nome as etapa, e.pausa_prazo,
           (select count(*) from pendencias_pedido pp where pp.pedido_id = p.id and pp.resolvida_em is null) as pendencias
      from pedidos p
      join categorias ca on ca.id = p.categoria_id
      join prioridades pr on pr.id = p.prioridade_id
      join etapas e on e.id = p.etapa_id
      left join unidades u on u.id = p.unidade_id
      left join blocos b on b.id = u.bloco_id
     where pedido_visivel(p_pessoa, p)
       and case v_situacao when 'ATIVOS' then p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')
                           when 'TODOS' then true else p.estado = v_situacao end
       and (p_responsavel is null
            or (p_responsavel = 'EU' and eh_responsavel(p_pessoa, p))
            or (p_responsavel = 'NENHUM' and p.responsavel_id is null)
            or p.responsavel_id = v_resp)
       and (p_prioridade is null or p.prioridade_id = p_prioridade)
       and (p_categoria is null or p.categoria_id = p_categoria)
       and (v_busca is null
            or p.protocolo like v_busca || '%' or p.protocolo like '%-' || v_busca || '%'
            or p.assunto ilike '%' || v_busca || '%'
            or p.local ilike '%' || v_busca || '%'
            or u.identificacao ilike v_busca || '%'
            or b.nome ilike '%' || v_busca || '%')
  ), filtrada as (
    select * from lista l
     where p_atencao is null
        or (p_atencao = 'SEM_RESPONSAVEL' and l.responsavel_id is null and l.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'))
        or (p_atencao = 'AGUARDANDO_ACEITE' and l.responsavel_id is not null and l.aceito_em is null and l.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'))
        or (p_atencao = 'RETORNO_VENCIDO' and l.vencido)
        or (p_atencao = 'COM_PENDENCIA' and l.pendencias > 0)
  ), ordenada as (
    select f.*, row_number() over (
             order by f.estado in ('ENCERRADO', 'CANCELADO'), f.vencido desc, f.nivel desc,
                      coalesce(f.proximo_retorno, 'infinity'::timestamptz), coalesce(f.encerrado_em, f.cancelado_em) desc nulls last, f.criado_em) as ordem
      from filtrada f
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
               'id', o.id, 'protocolo', o.protocolo, 'assunto', o.assunto, 'estado', o.estado, 'privado', o.privado,
               'unidade', case when o.unidade_id is not null then nome_da_unidade(o.bloco, o.andar, o.identificacao) end,
               'local', o.local, 'categoria', o.categoria, 'prioridade', jsonb_build_object('nome', o.prioridade, 'nivel', o.nivel),
               'etapa', jsonb_build_object('nome', o.etapa, 'pausaPrazo', o.pausa_prazo),
               'responsavel', case when o.responsavel_id is not null then jsonb_build_object(
                                'vinculoId', o.responsavel_id, 'nome', nome_do_vinculo(o.responsavel_id), 'eu', o.eu) end,
               'aceito', o.aceito_em is not null, 'abertoEm', o.criado_em, 'encerradoEm', coalesce(o.encerrado_em, o.cancelado_em),
               'proximoRetorno', o.proximo_retorno, 'retornoVencido', o.vencido, 'previsao', to_char(o.previsao, 'YYYY-MM-DD'),
               'pendencias', o.pendencias) order by o.ordem)
             from ordenada o where o.ordem > (v_pagina - 1) * 50 and o.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from filtrada),
    'pagina', v_pagina,
    'porPagina', 50,
    'resumo', resumo_pedidos(p_pessoa),
    'agora', app_now())
    into v;
  return v;
end $$;

-- Um pedido inteiro: dados, pendências, andamento, conclusões e histórico (AT-17).
create function plataforma_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_responder boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  v_responder := pode_no_pedido(p_pessoa, v, 'pedidos.responder');
  return jsonb_build_object(
    'pedido', (select jsonb_build_object(
        'id', v.id, 'protocolo', v.protocolo, 'assunto', v.assunto, 'descricao', v.descricao, 'canal', v.canal,
        'privado', v.privado, 'estado', v.estado, 'local', v.local, 'versao', v.versao,
        'unidade', case when v.unidade_id is not null then jsonb_build_object('id', u.id,
                     'nome', nome_da_unidade(b.nome, u.andar, u.identificacao)) end,
        'contato', case when v.contato_id is not null then jsonb_strip_nulls(jsonb_build_object('id', ct.id, 'nome', ct.nome,
                     'telefone', case when v_responder then ct.telefone end,
                     'relacao', (select cu.relacao from contatos_unidade cu where cu.contato_id = v.contato_id and cu.unidade_id = v.unidade_id
                                  order by cu.estado = 'ENCERRADO', cu.criado_em desc limit 1),
                     'dadosRemovidos', ct.dados_removidos_em is not null)) end,
        'categoria', jsonb_build_object('id', ca.id, 'nome', ca.nome),
        'prioridade', jsonb_build_object('id', pr.id, 'nome', pr.nome, 'nivel', pr.nivel, 'significado', pr.significado),
        'etapa', jsonb_build_object('id', e.id, 'nome', e.nome, 'situacao', e.situacao, 'pausaPrazo', e.pausa_prazo),
        'responsavel', case when v.responsavel_id is not null then jsonb_build_object(
                         'vinculoId', v.responsavel_id, 'nome', nome_do_vinculo(v.responsavel_id), 'eu', eh_responsavel(p_pessoa, v),
                         'desde', v.responsavel_desde, 'aceitoEm', v.aceito_em) end,
        'proximoRetorno', v.proximo_retorno, 'retornoVencido', retorno_vencido(v),
        'previsao', to_char(v.previsao, 'YYYY-MM-DD'),
        'abertoEm', v.criado_em, 'registradoPor', (select nome from pessoas where id = v.criado_por),
        'encerradoEm', v.encerrado_em,
        'cancelamento', case when v.cancelado_em is not null then jsonb_build_object('em', v.cancelado_em, 'motivo', v.motivo_cancelamento,
                          'por', (select nome from pessoas where id = v.cancelado_por)) end)
      from categorias ca, prioridades pr, etapas e
      left join unidades u on u.id = v.unidade_id
      left join blocos b on b.id = u.bloco_id
      left join contatos ct on ct.id = v.contato_id
     where ca.id = v.categoria_id and pr.id = v.prioridade_id and e.id = v.etapa_id),
    'pendencias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pp.id, 'tipo', pp.tipo, 'motivo', pp.motivo,
               'responsavel', jsonb_build_object('vinculoId', pp.responsavel_id, 'nome', nome_do_vinculo(pp.responsavel_id),
                                                 'ativo', exists (select 1 from vinculos x where x.id = pp.responsavel_id and x.revogado_em is null)),
               'abertaEm', pp.aberta_em, 'abertaPor', (select nome from pessoas where id = pp.aberta_por),
               'resolvidaEm', pp.resolvida_em, 'resolvidaPor', (select nome from pessoas where id = pp.resolvida_por), 'resolucao', pp.resolucao)
             order by pp.resolvida_em is not null, pp.aberta_em)
        from pendencias_pedido pp where pp.pedido_id = v.id), '[]'::jsonb),
    'andamentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'meio', a.meio, 'texto', a.texto, 'em', a.criado_em,
                                          'autor', (select nome from pessoas where id = a.criado_por)) order by a.criado_em desc)
        from andamentos_pedido a where a.pedido_id = v.id), '[]'::jsonb),
    'conclusoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'etapa', (select nome from etapas where id = c.etapa_id), 'explicacao', c.explicacao, 'evidencia', c.evidencia,
               'concluidaEm', c.concluida_em, 'concluidaPor', (select nome from pessoas where id = c.concluida_por),
               'revisao', c.revisao, 'revisadaEm', c.revisada_em, 'revisadaPor', (select nome from pessoas where id = c.revisada_por),
               'motivoDevolucao', c.motivo_devolucao, 'reabertaEm', c.reaberta_em,
               'reabertaPor', (select nome from pessoas where id = c.reaberta_por), 'motivoReabertura', c.motivo_reabertura)
             order by c.concluida_em desc)
        from conclusoes_pedido c where c.pedido_id = v.id), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
               'acao', h.acao, 'em', h.ocorrido_em, 'autor', (select nome from pessoas where id = h.autor_id),
               'dados', h.dados || case when h.acao = 'pedido.responsavel' then jsonb_strip_nulls(jsonb_build_object(
                                         'deNome', nome_do_vinculo((h.dados ->> 'de')::uuid), 'paraNome', nome_do_vinculo((h.dados ->> 'para')::uuid)))
                                        when h.acao = 'pedido.registrado' and h.dados ? 'responsavel' then jsonb_build_object(
                                         'responsavelNome', nome_do_vinculo((h.dados ->> 'responsavel')::uuid))
                                        else '{}'::jsonb end)
             order by h.ocorrido_em, h.id)
        from historico h where h.entidade = 'pedidos' and h.entidade_id = v.id::text), '[]'::jsonb),
    'pode', jsonb_build_object(
      'responder', v_responder,
      'atualizar', pode_no_pedido(p_pessoa, v, 'pedidos.atualizar'),
      'concluir', pode(p_pessoa, p_condominio, 'pedidos.concluir'),
      'revisar', pode(p_pessoa, p_condominio, 'pedidos.revisar'),
      'aceitar', eh_responsavel(p_pessoa, v) and v.aceito_em is null and v.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'),
      'repassar', pode(p_pessoa, p_condominio, 'pedidos.atualizar') or eh_responsavel(p_pessoa, v)),
    'regras', (select jsonb_build_object('revisao', c.revisao_conclusao, 'reabertura', c.reabertura) from configuracao_condominio c),
    'agora', app_now());
end $$;

-- Mudar categoria, prioridade, local e se é privado (AT-02, AT-32). Categoria nova com etapa
-- própria: o pedido vai para a etapa geral da mesma situação.
create function plataforma_alterar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_categoria uuid,
                                          p_prioridade uuid, p_local text, p_privado boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_etapa uuid;
  v_local text := nullif(btrim(coalesce(p_local, '')), '');
  v_versao integer;
  v_mudou jsonb := '[]'::jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  v_etapa := v.etapa_id;
  if p_categoria is distinct from v.categoria_id
     and (select categoria_id from etapas where id = v.etapa_id) is not null then
    v_etapa := etapa_inicial(p_categoria, situacao_da_etapa(v.estado));
  end if;
  begin
    update pedidos set categoria_id = p_categoria, prioridade_id = p_prioridade, local = v_local, privado = coalesce(p_privado, privado),
                       etapa_id = v_etapa
     where id = p_id and versao = p_versao returning versao into v_versao;
  exception
    when foreign_key_violation or not_null_violation then perform recusar_campos('Categoria ou prioridade não encontrada', 'categoriaId', 'prioridadeId');
    when check_violation then perform recusar_campos('Informe a unidade ou o local (2 a 120 caracteres)', 'local');
  end;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  if p_categoria is distinct from v.categoria_id then
    perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'categoria',
      'de', (select nome from categorias where id = v.categoria_id), 'para', (select nome from categorias where id = p_categoria)));
  end if;
  if v_etapa is distinct from v.etapa_id then
    perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'etapa',
      'de', (select nome from etapas where id = v.etapa_id), 'para', (select nome from etapas where id = v_etapa)));
  end if;
  if p_prioridade is distinct from v.prioridade_id then
    perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'prioridade',
      'de', (select nome from prioridades where id = v.prioridade_id), 'para', (select nome from prioridades where id = p_prioridade)));
  end if;
  if v_local is distinct from v.local then
    perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'local', 'de', v.local, 'para', v_local));
  end if;
  if coalesce(p_privado, v.privado) is distinct from v.privado then
    perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'privado', 'de', v.privado, 'para', p_privado));
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Mudar a etapa (AT-05): só para etapas de aberto ou em andamento; encerrar é concluir.
create function plataforma_mover_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_etapa uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_etapa etapas;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  select * into v_etapa from etapas where id = p_etapa;
  if not found then perform recusar_campos('Etapa não encontrada', 'etapaId'); end if;
  if v_etapa.situacao = 'ENCERRADO' then perform recusar_motivo('Para encerrar, conclua o pedido', 'CONCLUIR_PARA_ENCERRAR'); end if;
  if p_etapa = v.etapa_id then return jsonb_build_object('versao', v.versao); end if;
  if v_etapa.situacao <> v.estado then
    perform definir_transicao('ETAPA_MUDOU');
  end if;
  update pedidos set etapa_id = p_etapa, estado = v_etapa.situacao where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  perform registrar_historico('pedido.alterado', 'pedidos', p_id::text, jsonb_build_object('campo', 'etapa',
    'de', (select nome from etapas where id = v.etapa_id), 'para', v_etapa.nome));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Atribuir ou repassar (AT-03): quem atualiza pedidos ou o próprio responsável (repasse entre
-- turnos). O novo responsável precisa estar disponível e confirma o aceite.
create function plataforma_atribuir_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_responsavel uuid,
                                           p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_versao integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  if v.estado in ('ENCERRADO', 'CANCELADO') then perform recusar_motivo('Pedido encerrado: reabra para mudar', 'PEDIDO_ENCERRADO'); end if;
  if p_responsavel is null or not responsavel_disponivel(p_responsavel) then
    perform recusar_motivo('Escolha um responsável disponível', 'RESPONSAVEL_INDISPONIVEL');
  end if;
  if p_responsavel = v.responsavel_id then perform recusar_motivo('Esta pessoa já é a responsável', 'MESMO_RESPONSAVEL'); end if;
  if length(v_motivo) > 300 then perform recusar_campos('Motivo até 300 caracteres', 'motivo'); end if;
  update pedidos set responsavel_id = p_responsavel, responsavel_desde = app_now(),
                     aceito_em = case when exists (select 1 from vinculos where id = p_responsavel and pessoa_id = p_pessoa) then app_now() end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  perform registrar_historico('pedido.responsavel', 'pedidos', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('de', v.responsavel_id, 'para', p_responsavel, 'motivo', v_motivo)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- O responsável confirma que aceitou o pedido (AT-03).
create function plataforma_aceitar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if not eh_responsavel(p_pessoa, v) then perform recusar_motivo('Só o responsável aceita o pedido', 'NAO_RESPONSAVEL'); end if;
  if v.estado in ('ENCERRADO', 'CANCELADO') then perform recusar_motivo('Pedido encerrado', 'PEDIDO_ENCERRADO'); end if;
  if v.aceito_em is not null then return jsonb_build_object('versao', v.versao); end if;
  update pedidos set aceito_em = app_now() where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  perform registrar_historico('pedido.aceito', 'pedidos', p_id::text, jsonb_build_object('responsavel', v.responsavel_id));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Retorno dado ao morador (AT-06): fica no andamento e recalcula o próximo retorno pelo
-- prazo, sem mexer na previsão de solução.
create function plataforma_registrar_retorno(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_meio text,
                                             p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_proximo timestamptz;
  v_versao integer;
  v_andamento uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.responder');
  perform exigir_em_andamento(v);
  if p_meio is null or p_meio not in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OUTRO') then
    perform recusar_campos('Diga como o retorno foi dado', 'meio');
  end if;
  if length(btrim(coalesce(p_texto, ''))) not between 3 and 2000 then
    perform recusar_campos('Escreva o que foi dito ao morador (3 a 2000 caracteres)', 'texto');
  end if;
  v_proximo := calcular_proximo_retorno(v.categoria_id, v.prioridade_id);
  update pedidos set proximo_retorno = v_proximo where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  insert into andamentos_pedido (condominio_id, pedido_id, tipo, meio, texto, criado_por)
  values (p_condominio, p_id, 'RETORNO', p_meio, btrim(p_texto), p_pessoa) returning id into v_andamento;
  perform registrar_historico('pedido.retorno_registrado', 'pedidos', p_id::text, jsonb_build_object(
    'andamento', v_andamento, 'meio', p_meio, 'de', v.proximo_retorno, 'para', v_proximo));
  return jsonb_build_object('versao', v_versao, 'proximoRetorno', v_proximo);
end $$;

-- Nota interna: só a gestão lê; não é retorno ao morador (cobrar fornecedor, por exemplo).
create function plataforma_anotar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_versao integer;
  v_andamento uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if not (pode_no_pedido(p_pessoa, v, 'pedidos.responder') or pode_no_pedido(p_pessoa, v, 'pedidos.atualizar')) then
    raise exception 'Sem permissão para anotar neste pedido' using errcode = 'TC401';
  end if;
  if v.estado in ('ENCERRADO', 'CANCELADO') then perform recusar_motivo('Pedido encerrado: reabra para mudar', 'PEDIDO_ENCERRADO'); end if;
  if length(btrim(coalesce(p_texto, ''))) not between 3 and 2000 then perform recusar_campos('Nota de 3 a 2000 caracteres', 'texto'); end if;
  v_versao := tocar_pedido(p_id, p_versao);
  insert into andamentos_pedido (condominio_id, pedido_id, tipo, texto, criado_por)
  values (p_condominio, p_id, 'NOTA', btrim(p_texto), p_pessoa) returning id into v_andamento;
  perform registrar_historico('pedido.nota', 'pedidos', p_id::text, jsonb_build_object('andamento', v_andamento));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Mudar o próximo retorno na mão (AT-06): sempre com motivo.
create function plataforma_mudar_retorno(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_quando timestamptz,
                                         p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.responder');
  perform exigir_em_andamento(v);
  if p_quando is null or p_quando <= app_now() or p_quando > app_now() + interval '180 days' then
    perform recusar_campos('O próximo retorno fica entre agora e 180 dias', 'quando');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update pedidos set proximo_retorno = p_quando where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  perform registrar_historico('pedido.retorno_mudou', 'pedidos', p_id::text,
    jsonb_build_object('de', v.proximo_retorno, 'para', p_quando, 'motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Previsão de solução (AT-07): só quando conhecida; mudar ou tirar pede justificativa.
create function plataforma_definir_previsao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date,
                                            p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  if p_data is not distinct from v.previsao then return jsonb_build_object('versao', v.versao); end if;
  if p_data is not null and (p_data < hoje_no_condominio() or p_data > hoje_no_condominio() + 730) then
    perform recusar_campos('A previsão fica entre hoje e dois anos', 'data');
  end if;
  if v.previsao is not null then v_motivo := exigir_motivo(p_motivo);
  elsif length(v_motivo) > 500 then perform recusar_campos('Motivo até 500 caracteres', 'motivo');
  end if;
  update pedidos set previsao = p_data where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  perform registrar_historico('pedido.previsao_mudou', 'pedidos', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'de', to_char(v.previsao, 'YYYY-MM-DD'), 'para', to_char(p_data, 'YYYY-MM-DD'), 'motivo', v_motivo)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Pendência ou impedimento (AT-11, AT-12), com responsável e motivo.
create function plataforma_abrir_pendencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_tipo text,
                                           p_motivo text, p_responsavel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_versao integer;
  v_pendencia uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  if p_tipo is null or p_tipo not in ('FORNECEDOR', 'MORADOR', 'DECISAO', 'PECA', 'ACESSO', 'SEM_EXECUTOR', 'OUTRO') then
    perform recusar_campos('Escolha o tipo da pendência', 'tipo');
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
  if p_responsavel is null then perform recusar_campos('Escolha quem cuida da pendência', 'responsavel'); end if;
  v_versao := tocar_pedido(p_id, p_versao);
  begin
    insert into pendencias_pedido (condominio_id, pedido_id, tipo, motivo, responsavel_id, aberta_por)
    values (p_condominio, p_id, p_tipo, btrim(p_motivo), p_responsavel, p_pessoa) returning id into v_pendencia;
  exception when foreign_key_violation then
    perform recusar_motivo('O responsável da pendência é o síndico ou uma pessoa autorizada', 'RESPONSAVEL_INVALIDO');
  end;
  perform registrar_historico('pedido.pendencia_aberta', 'pedidos', p_id::text,
    jsonb_build_object('pendencia', v_pendencia, 'tipo', p_tipo, 'responsavel', p_responsavel));
  return jsonb_build_object('versao', v_versao, 'id', v_pendencia);
end $$;

-- Resolver uma pendência: quem atualiza o pedido ou quem cuida da pendência.
create function plataforma_resolver_pendencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_pendencia uuid,
                                              p_resolucao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_pend pendencias_pedido;
  v_resolucao text := nullif(btrim(coalesce(p_resolucao, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  select * into v_pend from pendencias_pedido where id = p_pendencia and pedido_id = p_id;
  if not found then raise exception 'Pendência não encontrada' using errcode = 'TC404'; end if;
  if not (pode_no_pedido(p_pessoa, v, 'pedidos.atualizar')
          or exists (select 1 from vinculos where id = v_pend.responsavel_id and pessoa_id = p_pessoa and revogado_em is null)) then
    raise exception 'Sem permissão para resolver esta pendência' using errcode = 'TC401';
  end if;
  perform exigir_em_andamento(v);
  if v_pend.resolvida_em is not null then perform recusar_motivo('Esta pendência já foi resolvida', 'PENDENCIA_RESOLVIDA'); end if;
  if length(v_resolucao) not between 2 and 300 then perform recusar_campos('Resolução de 2 a 300 caracteres', 'resolucao'); end if;
  v_versao := tocar_pedido(p_id, p_versao);
  update pendencias_pedido set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = v_resolucao where id = p_pendencia;
  perform registrar_historico('pedido.pendencia_resolvida', 'pedidos', p_id::text,
    jsonb_build_object('pendencia', p_pendencia, 'tipo', v_pend.tipo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Concluir (AT-13, AT-14): explicação ao morador, evidência opcional e a etapa de
-- encerramento (Concluído, Não procede...). Com revisão ligada, quem não é síndico deixa o
-- pedido em revisão; o síndico que conclui já revisa.
create function plataforma_concluir_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_etapa uuid,
                                           p_explicacao text, p_evidencia text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_etapa etapas;
  v_revisao boolean;
  v_estado text;
  v_evidencia text := nullif(btrim(coalesce(p_evidencia, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.concluir');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_em_andamento(v);
  select * into v_etapa from etapas where id = p_etapa;
  if not found or v_etapa.situacao <> 'ENCERRADO' or not v_etapa.ativa
     or (v_etapa.categoria_id is not null and v_etapa.categoria_id <> v.categoria_id) then
    perform recusar_campos('Escolha como o pedido termina', 'etapaId');
  end if;
  if length(btrim(coalesce(p_explicacao, ''))) not between 10 and 2000 then
    perform recusar_campos('Explique ao morador o que foi feito (10 a 2000 caracteres)', 'explicacao');
  end if;
  if length(v_evidencia) > 300 then perform recusar_campos('Evidência até 300 caracteres', 'evidencia'); end if;
  if exists (select 1 from pendencias_pedido where pedido_id = p_id and resolvida_em is null) then
    perform recusar_motivo('Resolva as pendências antes de concluir', 'PENDENCIA_ABERTA');
  end if;
  select revisao_conclusao into v_revisao from configuracao_condominio;
  v_estado := case when v_revisao and not pode(p_pessoa, p_condominio, 'pedidos.revisar') then 'EM_REVISAO' else 'ENCERRADO' end;
  perform definir_transicao('CONCLUIDO');
  update pedidos set estado = v_estado, etapa_id = p_etapa, proximo_retorno = null,
                     encerrado_em = case when v_estado = 'ENCERRADO' then app_now() end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  insert into conclusoes_pedido (condominio_id, pedido_id, etapa_id, etapa_anterior, explicacao, evidencia, concluida_por,
                                 revisao, revisada_em, revisada_por)
  values (p_condominio, p_id, p_etapa, v.etapa_id, btrim(p_explicacao), v_evidencia, p_pessoa,
          case when not v_revisao then 'SEM_REVISAO' when v_estado = 'EM_REVISAO' then 'AGUARDANDO' else 'APROVADA' end,
          case when v_revisao and v_estado = 'ENCERRADO' then app_now() end,
          case when v_revisao and v_estado = 'ENCERRADO' then p_pessoa end);
  return jsonb_build_object('versao', v_versao, 'estado', v_estado);
end $$;

-- Revisar a conclusão (AT-14): aprovar encerra; devolver pede motivo e volta o pedido para a
-- etapa em que estava, com próximo retorno.
create function plataforma_revisar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_aprovar boolean,
                                          p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_conclusao conclusoes_pedido;
  v_etapa uuid;
  v_situacao text;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.revisar');
  v := exigir_pedido(p_pessoa, p_id);
  if v.estado <> 'EM_REVISAO' then perform recusar_motivo('Este pedido não está em revisão', 'SEM_REVISAO'); end if;
  if p_aprovar is null then perform recusar_campos('Aprove ou devolva', 'aprovar'); end if;
  select * into v_conclusao from conclusoes_pedido where pedido_id = p_id and revisao = 'AGUARDANDO';
  if p_aprovar then
    perform definir_transicao('REVISAO_APROVADA');
    update pedidos set estado = 'ENCERRADO', encerrado_em = app_now() where id = p_id and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
    update conclusoes_pedido set revisao = 'APROVADA', revisada_em = app_now(), revisada_por = p_pessoa where id = v_conclusao.id;
  else
    v_motivo := exigir_motivo(p_motivo);
    v_etapa := v_conclusao.etapa_anterior;
    if not (select ativa from etapas where id = v_etapa) then
      v_etapa := coalesce(etapa_inicial(v.categoria_id, 'EM_ANDAMENTO'), etapa_inicial(v.categoria_id, 'ABERTO'));
    end if;
    v_situacao := (select situacao from etapas where id = v_etapa);
    perform definir_transicao('REVISAO_DEVOLVIDA', v_motivo);
    update pedidos set estado = v_situacao, etapa_id = v_etapa, proximo_retorno = calcular_proximo_retorno(v.categoria_id, v.prioridade_id)
     where id = p_id and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
    update conclusoes_pedido set revisao = 'DEVOLVIDA', revisada_em = app_now(), revisada_por = p_pessoa, motivo_devolucao = v_motivo
     where id = v_conclusao.id;
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Reabrir (AT-15): com motivo, preservando a conclusão anterior. O pedido ganha responsável
-- (o escolhido, o anterior se disponível ou o padrão) e próximo retorno. Uma pessoa decide;
-- nada reabre sozinho.
create function plataforma_reabrir_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text,
                                          p_responsavel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_motivo text;
  v_resp uuid;
  v_etapa uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.concluir');
  v := exigir_pedido(p_pessoa, p_id);
  if v.estado <> 'ENCERRADO' then perform recusar_motivo('Só pedido encerrado é reaberto', 'NAO_ENCERRADO'); end if;
  if not (select reabertura from configuracao_condominio) then
    perform recusar_motivo('Este condomínio não reabre pedidos: registre um pedido novo', 'REABERTURA_DESLIGADA');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  if p_responsavel is not null then
    if not responsavel_disponivel(p_responsavel) then perform recusar_motivo('Escolha um responsável disponível', 'RESPONSAVEL_INDISPONIVEL'); end if;
    v_resp := p_responsavel;
  elsif responsavel_disponivel(v.responsavel_id) then
    v_resp := v.responsavel_id;
  else
    select responsavel_padrao into v_resp from configuracao_condominio;
    if not responsavel_disponivel(v_resp) then
      perform recusar_motivo('Escolha quem assume o pedido reaberto', 'RESPONSAVEL_NECESSARIO');
    end if;
  end if;
  v_etapa := coalesce(etapa_inicial(v.categoria_id, 'EM_ANDAMENTO'), etapa_inicial(v.categoria_id, 'ABERTO'));
  perform definir_transicao('REABERTO', v_motivo);
  update pedidos set estado = (select situacao from etapas where id = v_etapa), etapa_id = v_etapa, encerrado_em = null,
                     responsavel_id = v_resp,
                     responsavel_desde = case when v_resp is distinct from v.responsavel_id then app_now() else v.responsavel_desde end,
                     aceito_em = case when exists (select 1 from vinculos where id = v_resp and pessoa_id = p_pessoa) then app_now() end,
                     proximo_retorno = calcular_proximo_retorno(v.categoria_id, v.prioridade_id)
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  update conclusoes_pedido set reaberta_em = app_now(), reaberta_por = p_pessoa, motivo_reabertura = v_motivo
   where id = (select id from conclusoes_pedido where pedido_id = p_id and reaberta_em is null and revisao in ('SEM_REVISAO', 'APROVADA')
                order by concluida_em desc limit 1);
  if v_resp is distinct from v.responsavel_id then
    perform registrar_historico('pedido.responsavel', 'pedidos', p_id::text,
      jsonb_strip_nulls(jsonb_build_object('de', v.responsavel_id, 'para', v_resp, 'motivo', 'Reabertura')));
  end if;
  return jsonb_build_object('versao', v_versao);
end $$;

-- Cancelar (AT-31): com motivo e autor; as pendências abertas são encerradas junto. O
-- pedido cancelado continua na fila (filtro Cancelados) e no histórico.
create function plataforma_cancelar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.concluir');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_em_andamento(v);
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao('CANCELADO', v_motivo);
  update pedidos set estado = 'CANCELADO', cancelado_em = app_now(), cancelado_por = p_pessoa, motivo_cancelamento = v_motivo,
                     proximo_retorno = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  update pendencias_pedido set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = 'Pedido cancelado'
   where pedido_id = p_id and resolvida_em is null;
  return jsonb_build_object('versao', v_versao);
end $$;

call fechar_acesso();

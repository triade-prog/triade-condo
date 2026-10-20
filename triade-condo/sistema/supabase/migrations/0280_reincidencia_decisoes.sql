-- 0280 · Pedidos relacionados (AT-18), pedido de decisão ao síndico (AT-23, o núcleo escolhido pela
-- Carolina em 20/10/2026) e os dois indicadores que faltavam na TR-01 (F7.4): reincidência e
-- decisões aguardando o síndico. Desenho aprovado em docs/telas/reincidencia-decisoes.html.
--
-- Regras desta parte (as decisões do desenho):
-- 1. O sistema sugere, a pessoa confirma (AT-18): parecidos são da mesma categoria e do mesmo local
--    (o texto do campo Local sem diferença de maiúscula e espaço, que é o mesmo da etiqueta QR) ou
--    da mesma unidade, abertos até N dias antes ou depois (30, 60, 90 ou 180; padrão 90), sem os
--    cancelados. Nada fica ligado sem alguém que atualiza o pedido confirmar. "Não é" tira a
--    sugestão daquele par.
-- 2. Duplicado e reincidência são diferentes: o mais novo dos dois é o ligado. Reincidência é o
--    problema que voltou depois de concluído (o mais antigo encerrado antes de o novo abrir);
--    duplicado é o mesmo problema relatado de novo. Só a reincidência entra no indicador.
-- 3. Cada relato mantém o seu protocolo: ligar não junta nem apaga pedidos. A ligação vai para o
--    histórico dos dois; desfazer pede motivo e também fica. Um pedido fica ligado a um outro por
--    vez.
-- 4. Duplicado pode encerrar com aviso: ao ligar como duplicado, quem conclui pode encerrar o
--    duplicado com o texto ao morador, pela conclusão de sempre (etapa "Não procede", ou a
--    primeira de encerramento). Nunca encerra sozinho.
-- 5. O pedido de decisão nasce no pedido em andamento, com o que decidir, de 1 a 5 alternativas
--    (custo estimado opcional, em centavos), o prazo (de hoje até 90 dias) e quem decide. Depois
--    de enviado não muda; quem pediu, ou quem atualiza o pedido, pode retirar com motivo.
-- 6. Decide quem tem a ação decisoes.aprovar: o síndico, ou quem ele der a permissão Aprovar.
--    Responde a pessoa escolhida ou o síndico. Aprovar uma alternativa ou devolver exige
--    justificativa e fica com o nome de quem respondeu.
-- 7. Aprovar não contrata nem paga: a resposta só fica registrada.
-- 8. A decisão vira pendência do tipo Decisão para quem decide, que se resolve sozinha com a
--    resposta ou a retirada e não se resolve à mão. Cancelar o pedido retira a decisão.
-- 9. Avisos no sino: quem decide, quando chega o pedido e quando o prazo vence; quem pediu, quando
--    a resposta sai. O morador não vê a decisão.
-- 10. Decisões aguardando são de agora; decididas e o tempo típico (mediana) são do período.

insert into funcao_acoes (funcao, acao) values ('SINDICO', 'decisoes.aprovar');
insert into permissao_acoes (permissao, acao) values ('APROVAR', 'pedidos.ver'), ('APROVAR', 'decisoes.aprovar');

-- Janela dos parecidos (decisão 1), na aba Regras.
alter table configuracao_condominio
  add column parecidos_dias smallint not null default 90 check (parecidos_dias in (30, 60, 90, 180));

-- O mesmo local escrito de jeitos diferentes: sem maiúscula, sem espaço sobrando.
create function chave_local(p_local text) returns text
language sql immutable
set search_path = public
as $$ select nullif(lower(btrim(regexp_replace(coalesce(p_local, ''), '\s+', ' ', 'g'))), '') $$;

-- Onde é o pedido, como frase curta: o local, a unidade ou os dois.
create function onde_do_pedido(p pedidos) returns text
language sql stable
set search_path = public
as $$
  select nullif(concat_ws(' · ', p.local,
           (select nome_da_unidade(b.nome, u.andar, u.identificacao) from unidades u left join blocos b on b.id = u.bloco_id
             where u.id = p.unidade_id and p.local is null)), '')
$$;

-- ---------------------------------------------------------------------------------------
-- Pedidos relacionados (AT-18).

create table ligacoes_pedido (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  pedido_id       uuid not null,
  outro_id        uuid not null,
  tipo            text not null check (tipo in ('REINCIDENCIA', 'DUPLICADO')),
  motivo          text check (length(btrim(motivo)) between 3 and 300),
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid not null references pessoas (id),
  desfeita_em     timestamptz,
  desfeita_por    uuid references pessoas (id),
  motivo_desfazer text check (length(btrim(motivo_desfazer)) between 3 and 500),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (outro_id, condominio_id) references pedidos (id, condominio_id),
  check (pedido_id <> outro_id),
  check ((desfeita_em is null) = (desfeita_por is null) and (desfeita_em is null) = (motivo_desfazer is null))
);
create unique index ligacoes_pedido_ativa on ligacoes_pedido (pedido_id) where desfeita_em is null;
create index ligacoes_pedido_outro on ligacoes_pedido (outro_id) where desfeita_em is null;
call proteger_tabela_condominio('ligacoes_pedido');
create trigger ligacoes_pedido_sem_exclusao before delete on ligacoes_pedido for each row execute function somente_insercao();

create function ligacoes_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.desfeita_em is not null or new.desfeita_em is null
     or (new.condominio_id, new.pedido_id, new.outro_id, new.tipo, new.motivo, new.criado_em, new.criado_por)
        is distinct from (old.condominio_id, old.pedido_id, old.outro_id, old.tipo, old.motivo, old.criado_em, old.criado_por) then
    raise exception 'Ligação só muda para desfeita' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger ligacoes_pedido_regras before update on ligacoes_pedido for each row execute function ligacoes_pedido_regras();

-- "Não é": o par sai das sugestões. Fica registrado, sem volta.
create table parecidos_descartados (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  pedido_a       uuid not null,
  pedido_b       uuid not null,
  descartado_em  timestamptz not null default app_now(),
  descartado_por uuid not null references pessoas (id),
  foreign key (pedido_a, condominio_id) references pedidos (id, condominio_id),
  foreign key (pedido_b, condominio_id) references pedidos (id, condominio_id),
  check (pedido_a < pedido_b),
  unique (pedido_a, pedido_b)
);
call proteger_tabela_condominio('parecidos_descartados');
create trigger parecidos_descartados_somente_insercao before update or delete on parecidos_descartados
  for each row execute function somente_insercao();

-- O par na ordem do tempo: o novo é o que fica ligado ao antigo.
create function par_no_tempo(a pedidos, b pedidos, out antigo pedidos, out novo pedidos)
language sql stable
set search_path = public
as $$
  select case when (a.criado_em, a.protocolo) <= (b.criado_em, b.protocolo) then a else b end,
         case when (a.criado_em, a.protocolo) <= (b.criado_em, b.protocolo) then b else a end
$$;

-- Reincidência só de pedido concluído antes de o novo abrir (decisão 2).
create function pode_ser_reincidencia(a pedidos, b pedidos) returns boolean
language sql stable
set search_path = public
as $$
  select (x.antigo).estado = 'ENCERRADO' and (x.antigo).encerrado_em <= (x.novo).criado_em from par_no_tempo(a, b) x
$$;

-- Os parecidos sugeridos para um pedido (decisão 1), os mais próximos no tempo primeiro.
create function pedidos_parecidos(p_pessoa uuid, p pedidos) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(x.item order by x.distancia), '[]'::jsonb)
    from (select jsonb_build_object(
                   'id', o.id, 'protocolo', o.protocolo, 'assunto', o.assunto, 'estado', o.estado, 'versao', o.versao,
                   'categoria', (select nome from categorias where id = o.categoria_id), 'onde', onde_do_pedido(o),
                   'abertoEm', o.criado_em, 'encerradoEm', o.encerrado_em,
                   'podeReincidencia', pode_ser_reincidencia(p, o)) as item,
                 abs(extract(epoch from o.criado_em - p.criado_em)) as distancia
            from pedidos o
           where o.id <> p.id and o.estado <> 'CANCELADO' and o.categoria_id = p.categoria_id
             and o.criado_em between p.criado_em - make_interval(days => (select parecidos_dias from configuracao_condominio))
                                 and p.criado_em + make_interval(days => (select parecidos_dias from configuracao_condominio))
             and ((p.unidade_id is not null and o.unidade_id = p.unidade_id) or chave_local(o.local) = chave_local(p.local))
             and pedido_visivel(p_pessoa, o)
             and not exists (select 1 from ligacoes_pedido l where l.desfeita_em is null
                               and ((l.pedido_id = p.id and l.outro_id = o.id) or (l.pedido_id = o.id and l.outro_id = p.id)))
             and not exists (select 1 from parecidos_descartados d where d.pedido_a = least(p.id, o.id) and d.pedido_b = greatest(p.id, o.id))
           order by distancia
           limit 5) x
$$;

-- As ligações do pedido, dos dois lados, com o que cada uma é para este pedido.
create function ligacoes_do_pedido(p_pessoa uuid, p pedidos) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', l.id, 'tipo', l.tipo, 'papel', case when l.pedido_id = p.id then 'NOVO' else 'ANTIGO' end,
           'pedido', jsonb_build_object('id', o.id, 'protocolo', o.protocolo, 'assunto', o.assunto, 'estado', o.estado,
                                        'encerradoEm', o.encerrado_em, 'abertoEm', o.criado_em),
           'motivo', l.motivo, 'em', l.criado_em, 'por', nome_pessoa(l.criado_por)))
         order by l.criado_em), '[]'::jsonb)
    from ligacoes_pedido l
    join pedidos o on o.id = case when l.pedido_id = p.id then l.outro_id else l.pedido_id end
   where l.desfeita_em is null and (l.pedido_id = p.id or l.outro_id = p.id) and pedido_visivel(p_pessoa, o)
$$;

-- Ligar dois pedidos (decisões 1 a 4). p_id é o pedido aberto na tela, com a versão lida;
-- p_encerrar fecha o duplicado com p_texto ao morador (p_versao_outro é a versão lida do outro).
create function plataforma_ligar_pedidos(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_outro uuid, p_tipo text,
                                         p_motivo text, p_encerrar boolean, p_texto text, p_versao_outro integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  o pedidos;
  v_antigo pedidos;
  v_novo pedidos;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
  v_ligacao uuid;
  v_etapa uuid;
  v_conclusao jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  if p_tipo is null or p_tipo not in ('REINCIDENCIA', 'DUPLICADO') then perform recusar_campos('Escolha reincidência ou duplicado', 'tipo'); end if;
  if p_outro is null or p_outro = p_id then perform recusar_campos('Escolha o outro pedido', 'outroId'); end if;
  o := exigir_pedido(p_pessoa, p_outro);
  if v.estado = 'CANCELADO' or o.estado = 'CANCELADO' then
    perform recusar_motivo('Pedido cancelado não se liga a outro', 'PEDIDO_CANCELADO');
  end if;
  if coalesce(length(v_motivo), 0) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
  v_antigo := (par_no_tempo(v, o)).antigo;
  v_novo := (par_no_tempo(v, o)).novo;
  if p_tipo = 'REINCIDENCIA' and not pode_ser_reincidencia(v, o) then
    perform recusar_motivo('Reincidência só de um pedido concluído antes de o outro abrir', 'NAO_E_REINCIDENCIA');
  end if;
  if exists (select 1 from ligacoes_pedido where desfeita_em is null and pedido_id = v_novo.id) then
    perform recusar_motivo('O pedido ' || v_novo.protocolo || ' já está ligado a outro: desfaça antes', 'JA_LIGADO');
  end if;
  if exists (select 1 from ligacoes_pedido where desfeita_em is null and pedido_id = v_antigo.id and outro_id = v_novo.id) then
    perform recusar_motivo('Estes pedidos já estão ligados', 'JA_LIGADO');
  end if;
  if coalesce(p_encerrar, false) then
    if p_tipo <> 'DUPLICADO' then perform recusar_campos('Só o duplicado se encerra ao ligar', 'encerrar'); end if;
    if not pode(p_pessoa, p_condominio, 'pedidos.concluir') then
      raise exception 'Sem permissão para encerrar o duplicado' using errcode = 'TC401';
    end if;
    if v_novo.id <> p_id and p_versao_outro is null then perform recusar_campos('Falta a versão lida do duplicado', 'versaoOutro'); end if;
    select id into v_etapa from etapas
     where situacao = 'ENCERRADO' and ativa and (categoria_id is null or categoria_id = v_novo.categoria_id)
     order by modelo = 'NAO_PROCEDE' desc nulls last, categoria_id is null, ordem limit 1;
  end if;

  if v_novo.id <> p_id or not coalesce(p_encerrar, false) then
    v_versao := tocar_pedido(p_id, p_versao);
  end if;
  insert into ligacoes_pedido (condominio_id, pedido_id, outro_id, tipo, motivo, criado_por)
  values (p_condominio, v_novo.id, v_antigo.id, p_tipo, v_motivo, p_pessoa) returning id into v_ligacao;
  perform registrar_historico('pedido.ligado', 'pedidos', v_novo.id::text,
    jsonb_build_object('ligacao', v_ligacao, 'tipo', p_tipo, 'papel', 'NOVO', 'outro', v_antigo.id, 'protocolo', v_antigo.protocolo));
  perform registrar_historico('pedido.ligado', 'pedidos', v_antigo.id::text,
    jsonb_build_object('ligacao', v_ligacao, 'tipo', p_tipo, 'papel', 'ANTIGO', 'outro', v_novo.id, 'protocolo', v_novo.protocolo));

  if coalesce(p_encerrar, false) then
    v_conclusao := plataforma_concluir_pedido(p_pessoa, p_condominio, v_novo.id,
                                              case when v_novo.id = p_id then p_versao else p_versao_outro end, v_etapa, p_texto, null);
    if v_novo.id = p_id then v_versao := (v_conclusao ->> 'versao')::integer; end if;
  end if;
  return jsonb_build_object('versao', v_versao, 'id', v_ligacao);
end $$;

create function plataforma_desfazer_ligacao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_ligacao uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  l ligacoes_pedido;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  select * into l from ligacoes_pedido where id = p_ligacao and (pedido_id = p_id or outro_id = p_id);
  if not found then raise exception 'Ligação não encontrada' using errcode = 'TC404'; end if;
  if l.desfeita_em is not null then perform recusar_motivo('Esta ligação já foi desfeita', 'LIGACAO_DESFEITA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  v_versao := tocar_pedido(p_id, p_versao);
  update ligacoes_pedido set desfeita_em = app_now(), desfeita_por = p_pessoa, motivo_desfazer = v_motivo where id = p_ligacao;
  perform registrar_historico('pedido.ligacao_desfeita', 'pedidos', l.pedido_id::text,
    jsonb_build_object('ligacao', l.id, 'tipo', l.tipo, 'outro', l.outro_id, 'protocolo', (select protocolo from pedidos where id = l.outro_id),
                       'motivo', v_motivo));
  perform registrar_historico('pedido.ligacao_desfeita', 'pedidos', l.outro_id::text,
    jsonb_build_object('ligacao', l.id, 'tipo', l.tipo, 'outro', l.pedido_id, 'protocolo', (select protocolo from pedidos where id = l.pedido_id),
                       'motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- "Não é" (decisão 1). Não mexe na versão do pedido: é só a sugestão que some.
create function plataforma_descartar_parecido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_outro uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_pedido(p_pessoa, p_outro);
  if p_outro = p_id then perform recusar_campos('Escolha o outro pedido', 'outroId'); end if;
  insert into parecidos_descartados (condominio_id, pedido_a, pedido_b, descartado_por)
  values (p_condominio, least(p_id, p_outro), greatest(p_id, p_outro), p_pessoa)
  on conflict (pedido_a, pedido_b) do nothing;
end $$;

-- Janela dos parecidos, na aba Regras (decisão 1).
create function plataforma_definir_parecidos(p_pessoa uuid, p_condominio uuid, p_versao integer, p_dias integer) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_dias is null or p_dias not in (30, 60, 90, 180) then perform recusar_campos('Escolha 30, 60, 90 ou 180 dias', 'dias'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio set parecidos_dias = p_dias where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('parecidos.alterados', 'configuracao_condominio', v_antes.id::text,
    jsonb_build_object('antes', v_antes.parecidos_dias, 'depois', p_dias));
  return v_versao;
end $$;

alter function plataforma_configuracoes(uuid, uuid) rename to configuracoes_f74;
alter function configuracoes_f74(uuid, uuid) security invoker;
create function plataforma_configuracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return configuracoes_f74(p_pessoa, p_condominio) || jsonb_build_object('parecidosDias', (select parecidos_dias from configuracao_condominio));
end $$;

-- ---------------------------------------------------------------------------------------
-- Pedido de decisão ao síndico (AT-23).

create table decisoes_pedido (
  id                   uuid primary key default gen_random_uuid(),
  condominio_id        uuid not null references condominios (id) on delete restrict,
  pedido_id            uuid not null,
  pendencia_id         uuid not null references pendencias_pedido (id),
  pergunta             text not null check (length(btrim(pergunta)) between 3 and 500),
  porque               text check (length(btrim(porque)) between 3 and 500),
  prazo                date not null,
  decisor_id           uuid not null,
  estado               text not null check (estado in ('AGUARDANDO', 'APROVADA', 'DEVOLVIDA', 'RETIRADA')),
  pedida_em            timestamptz not null default app_now(),
  pedida_por           uuid not null references pessoas (id),
  respondida_em        timestamptz,
  respondida_por       uuid references pessoas (id),
  alternativa_aprovada smallint check (alternativa_aprovada between 1 and 5),
  justificativa        text check (length(btrim(justificativa)) between 3 and 1000),
  retirada_motivo      text check (length(btrim(retirada_motivo)) between 3 and 500),
  versao               integer not null default 1,
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (decisor_id, condominio_id) references vinculos (id, condominio_id),
  unique (id, condominio_id),
  check ((estado = 'AGUARDANDO') = (respondida_em is null) and (respondida_em is null) = (respondida_por is null)),
  check ((estado = 'APROVADA') = (alternativa_aprovada is not null)),
  check ((estado in ('APROVADA', 'DEVOLVIDA')) = (justificativa is not null)),
  check ((estado = 'RETIRADA') = (retirada_motivo is not null))
);
create index decisoes_pedido_pedido on decisoes_pedido (pedido_id);
create index decisoes_pedido_aguardando on decisoes_pedido (decisor_id) where estado = 'AGUARDANDO';
call proteger_tabela_condominio('decisoes_pedido');
call ligar_guardiao('decisoes_pedido');
insert into estados_iniciais (tabela, estado) values ('decisoes_pedido', 'AGUARDANDO');
insert into transicoes_permitidas (tabela, de, para) values
  ('decisoes_pedido', 'AGUARDANDO', 'APROVADA'),
  ('decisoes_pedido', 'AGUARDANDO', 'DEVOLVIDA'),
  ('decisoes_pedido', 'AGUARDANDO', 'RETIRADA');
create trigger decisoes_pedido_sem_exclusao before delete on decisoes_pedido for each row execute function somente_insercao();

-- Depois de enviado, só a resposta ou a retirada mudam (decisão 5).
create function decisoes_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.pedido_id, new.pendencia_id, new.pergunta, new.porque, new.prazo, new.decisor_id, new.pedida_em, new.pedida_por)
     is distinct from (old.condominio_id, old.pedido_id, old.pendencia_id, old.pergunta, old.porque, old.prazo, old.decisor_id, old.pedida_em, old.pedida_por)
     or old.estado <> 'AGUARDANDO' then
    raise exception 'Pedido de decisão enviado não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger decisoes_pedido_regras before update on decisoes_pedido for each row execute function decisoes_pedido_regras();

create table alternativas_decisao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  decisao_id    uuid not null,
  numero        smallint not null check (numero between 1 and 5),
  descricao     text not null check (length(btrim(descricao)) between 3 and 200),
  detalhe       text check (length(btrim(detalhe)) between 2 and 200),
  custo         centavos check (custo >= 0),
  moeda         moeda not null default 'BRL',
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  unique (decisao_id, numero)
);
call proteger_tabela_condominio('alternativas_decisao');
create trigger alternativas_decisao_somente_insercao before update or delete on alternativas_decisao
  for each row execute function somente_insercao();

create table avisos_decisao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  decisao_id    uuid not null,
  tipo          text not null check (tipo in ('PEDIDA', 'VENCIDA', 'RESPONDIDA')),
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  unique (pessoa_id, decisao_id, tipo)
);
create index avisos_decisao_pessoa on avisos_decisao (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_decisao');
create trigger avisos_decisao_sem_exclusao before delete on avisos_decisao for each row execute function somente_insercao();
create function avisos_decisao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.decisao_id, new.tipo, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.decisao_id, old.tipo, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_decisao_regras before update on avisos_decisao for each row execute function avisos_decisao_regras();

create function avisar_decisao(p_pessoa uuid, p_decisao uuid, p_tipo text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_pessoa is not null and p_pessoa is distinct from contexto_pessoa() then
    insert into avisos_decisao (condominio_id, pessoa_id, decisao_id, tipo) values (contexto_condominio(), p_pessoa, p_decisao, p_tipo)
    on conflict (pessoa_id, decisao_id, tipo) do nothing;
  end if;
end $$;

-- Quem pode decidir: vínculo ativo com a ação decisoes.aprovar (decisão 6). "eu" marca quem pede,
-- que pode decidir o próprio pedido mas não recebe aviso de si mesmo.
create function decisores_do_condominio() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('vinculoId', v.id, 'nome', p.nome, 'sindico', v.funcao = 'SINDICO', 'eu', v.pessoa_id = contexto_pessoa())
                            order by v.funcao <> 'SINDICO', lower(p.nome)), '[]'::jsonb)
    from vinculos v join pessoas p on p.id = v.pessoa_id
   where v.condominio_id = contexto_condominio() and v.revogado_em is null and pode(v.pessoa_id, v.condominio_id, 'decisoes.aprovar')
$$;

create function decisao_json(d decisoes_pedido, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'versao', d.versao, 'estado', d.estado, 'pendenciaId', d.pendencia_id, 'pergunta', d.pergunta, 'porque', d.porque,
    'prazo', to_char(d.prazo, 'YYYY-MM-DD'), 'vencida', d.estado = 'AGUARDANDO' and d.prazo < hoje_no_condominio(),
    'decisor', jsonb_build_object('vinculoId', d.decisor_id, 'nome', nome_do_vinculo(d.decisor_id),
                                  'eu', exists (select 1 from vinculos where id = d.decisor_id and pessoa_id = p_pessoa)),
    'pedidaEm', d.pedida_em, 'pedidaPor', nome_pessoa(d.pedida_por),
    'respondidaEm', d.respondida_em, 'respondidaPor', nome_pessoa(d.respondida_por),
    'alternativaAprovada', d.alternativa_aprovada, 'justificativa', d.justificativa, 'retiradaMotivo', d.retirada_motivo,
    'alternativas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', a.numero, 'descricao', a.descricao,
                                                                                    'detalhe', a.detalhe, 'custo', a.custo, 'moeda', a.moeda))
                                               order by a.numero)
                                from alternativas_decisao a where a.decisao_id = d.id), '[]'::jsonb),
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto, 'estado', p.estado)
                 from pedidos p where p.id = d.pedido_id),
    'pode', jsonb_build_object(
      'responder', d.estado = 'AGUARDANDO' and pode(p_pessoa, d.condominio_id, 'decisoes.aprovar')
                   and (exists (select 1 from vinculos where id = d.decisor_id and pessoa_id = p_pessoa and revogado_em is null)
                        or eh_sindico(p_pessoa)),
      'retirar', d.estado = 'AGUARDANDO'
                 and (d.pedida_por = p_pessoa or pode_no_pedido(p_pessoa, (select p from pedidos p where p.id = d.pedido_id), 'pedidos.atualizar')))))
$$;

-- Pedir a decisão (decisões 5 e 8). p_alternativas: [{descricao, detalhe?, custo?}], de 1 a 5.
create function plataforma_pedir_decisao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_pergunta text, p_porque text,
                                         p_prazo date, p_decisor uuid, p_alternativas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_porque text := nullif(btrim(coalesce(p_porque, '')), '');
  v_versao integer;
  v_pendencia uuid;
  v_decisao uuid;
  v_decisor_pessoa uuid;
  a record;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  if length(btrim(coalesce(p_pergunta, ''))) not between 3 and 500 then
    perform recusar_campos('Diga o que precisa ser decidido (3 a 500 caracteres)', 'pergunta');
  end if;
  if length(v_porque) not between 3 and 500 then perform recusar_campos('Por que agora: de 3 a 500 caracteres', 'porque'); end if;
  if p_prazo is null or p_prazo < hoje_no_condominio() or p_prazo > hoje_no_condominio() + 90 then
    perform recusar_campos('O prazo vai de hoje a 90 dias', 'prazo');
  end if;
  select pessoa_id into v_decisor_pessoa from vinculos where id = p_decisor and revogado_em is null;
  if v_decisor_pessoa is null or not pode(v_decisor_pessoa, p_condominio, 'decisoes.aprovar') then
    perform recusar_campos('Escolha quem decide: o síndico ou quem tem a permissão Aprovar', 'decisorId');
  end if;
  if p_alternativas is null or jsonb_typeof(p_alternativas) <> 'array' or jsonb_array_length(p_alternativas) not between 1 and 5 then
    perform recusar_campos('Escreva de 1 a 5 alternativas', 'alternativas');
  end if;
  for a in select x.value as item, x.n from jsonb_array_elements(p_alternativas) with ordinality x(value, n) loop
    if length(btrim(coalesce(a.item ->> 'descricao', ''))) not between 3 and 200
       or length(nullif(btrim(coalesce(a.item ->> 'detalhe', '')), '')) not between 2 and 200
       or (a.item ? 'custo' and jsonb_typeof(a.item -> 'custo') <> 'null'
           and (jsonb_typeof(a.item -> 'custo') <> 'number' or (a.item ->> 'custo')::numeric < 0
                or (a.item ->> 'custo')::numeric <> trunc((a.item ->> 'custo')::numeric))) then
      perform recusar_campos('Confira a alternativa ' || a.n || ': descrição de 3 a 200 caracteres e custo em reais', 'alternativas');
    end if;
  end loop;

  v_versao := tocar_pedido(p_id, p_versao);
  insert into pendencias_pedido (condominio_id, pedido_id, tipo, motivo, responsavel_id, aberta_por)
  values (p_condominio, p_id, 'DECISAO', left(btrim(p_pergunta), 300), p_decisor, p_pessoa) returning id into v_pendencia;
  perform definir_transicao('PEDIDA');
  insert into decisoes_pedido (condominio_id, pedido_id, pendencia_id, pergunta, porque, prazo, decisor_id, estado, pedida_por)
  values (p_condominio, p_id, v_pendencia, btrim(p_pergunta), v_porque, p_prazo, p_decisor, 'AGUARDANDO', p_pessoa)
  returning id into v_decisao;
  insert into alternativas_decisao (condominio_id, decisao_id, numero, descricao, detalhe, custo)
  select p_condominio, v_decisao, x.n, btrim(x.value ->> 'descricao'), nullif(btrim(coalesce(x.value ->> 'detalhe', '')), ''),
         case when jsonb_typeof(x.value -> 'custo') = 'number' then (x.value ->> 'custo')::bigint end
    from jsonb_array_elements(p_alternativas) with ordinality x(value, n);
  perform registrar_historico('pedido.pendencia_aberta', 'pedidos', p_id::text,
    jsonb_build_object('pendencia', v_pendencia, 'tipo', 'DECISAO', 'responsavel', p_decisor));
  perform registrar_historico('pedido.decisao_pedida', 'pedidos', p_id::text,
    jsonb_build_object('decisao', v_decisao, 'decisor', p_decisor, 'prazo', to_char(p_prazo, 'YYYY-MM-DD'),
                       'alternativas', jsonb_array_length(p_alternativas)));
  perform avisar_decisao(v_decisor_pessoa, v_decisao, 'PEDIDA');
  return jsonb_build_object('versao', v_versao, 'id', v_decisao);
end $$;

-- Fecha a pendência da decisão e sobe a versão do pedido, sem pedir a versão lida dele: quem
-- responde está na tela Decisões.
create function fechar_pendencia_da_decisao(d decisoes_pedido, p_pessoa uuid, p_resolucao text) returns void
language plpgsql
set search_path = public
as $$
begin
  update pendencias_pedido set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = left(p_resolucao, 300)
   where id = d.pendencia_id and resolvida_em is null;
  update pedidos set atualizado_em = app_now() where id = d.pedido_id;
  perform registrar_historico('pedido.pendencia_resolvida', 'pedidos', d.pedido_id::text,
    jsonb_build_object('pendencia', d.pendencia_id, 'tipo', 'DECISAO'));
end $$;

-- Responder (decisões 6, 7 e 9): aprovar uma alternativa ou devolver, sempre com justificativa.
create function plataforma_responder_decisao(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_versao integer, p_aprovar boolean,
                                             p_alternativa integer, p_justificativa text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisoes_pedido;
  v pedidos;
  v_justificativa text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'decisoes.aprovar');
  select * into d from decisoes_pedido where id = p_decisao;
  if not found then raise exception 'Pedido de decisão não encontrado' using errcode = 'TC404'; end if;
  v := exigir_pedido(p_pessoa, d.pedido_id);
  if not (exists (select 1 from vinculos where id = d.decisor_id and pessoa_id = p_pessoa and revogado_em is null) or eh_sindico(p_pessoa)) then
    raise exception 'Só quem foi escolhido para decidir, ou o síndico, responde' using errcode = 'TC401';
  end if;
  if d.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta decisão já foi respondida ou retirada', 'DECISAO_FECHADA'); end if;
  perform exigir_em_andamento(v);
  if p_aprovar is null then perform recusar_campos('Aprove uma alternativa ou devolva', 'aprovar'); end if;
  if p_aprovar and not exists (select 1 from alternativas_decisao where decisao_id = d.id and numero = p_alternativa) then
    perform recusar_campos('Escolha a alternativa aprovada', 'alternativa');
  end if;
  if coalesce(length(v_justificativa), 0) not between 3 and 1000 then perform recusar_campos('Escreva a justificativa (3 a 1000 caracteres)', 'justificativa'); end if;
  perform definir_transicao(case when p_aprovar then 'APROVADA' else 'DEVOLVIDA' end);
  update decisoes_pedido
     set estado = case when p_aprovar then 'APROVADA' else 'DEVOLVIDA' end, respondida_em = app_now(), respondida_por = p_pessoa,
         alternativa_aprovada = case when p_aprovar then p_alternativa end, justificativa = v_justificativa
   where id = p_decisao and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('decisoes_pedido', p_decisao); end if;
  perform fechar_pendencia_da_decisao(d, p_pessoa,
    case when p_aprovar then 'Aprovada a alternativa ' || p_alternativa else 'Devolvida sem decidir' end);
  perform registrar_historico('pedido.decisao_respondida', 'pedidos', d.pedido_id::text,
    jsonb_strip_nulls(jsonb_build_object('decisao', d.id, 'aprovada', p_aprovar, 'alternativa', case when p_aprovar then p_alternativa end)));
  perform avisar_decisao(d.pedida_por, d.id, 'RESPONDIDA');
  return jsonb_build_object('versao', v_versao);
end $$;

-- Retirar (decisão 5): quem pediu ou quem atualiza o pedido, com motivo.
create function plataforma_retirar_decisao(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisoes_pedido;
  v pedidos;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into d from decisoes_pedido where id = p_decisao;
  if not found then raise exception 'Pedido de decisão não encontrado' using errcode = 'TC404'; end if;
  v := exigir_pedido(p_pessoa, d.pedido_id);
  if not (d.pedida_por = p_pessoa or pode_no_pedido(p_pessoa, v, 'pedidos.atualizar')) then
    raise exception 'Sem permissão para retirar este pedido de decisão' using errcode = 'TC401';
  end if;
  if d.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta decisão já foi respondida ou retirada', 'DECISAO_FECHADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao('RETIRADA', v_motivo);
  update decisoes_pedido set estado = 'RETIRADA', respondida_em = app_now(), respondida_por = p_pessoa, retirada_motivo = v_motivo
   where id = p_decisao and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('decisoes_pedido', p_decisao); end if;
  perform fechar_pendencia_da_decisao(d, p_pessoa, 'Retirada: ' || v_motivo);
  perform registrar_historico('pedido.decisao_retirada', 'pedidos', d.pedido_id::text,
    jsonb_build_object('decisao', d.id, 'motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- A tela Decisões. AGUARDANDO: o que espera a minha resposta. DECIDIDAS e TODAS: o que eu pedi
-- ou respondo; o síndico vê todas.
create function plataforma_decisoes(p_pessoa uuid, p_condominio uuid, p_filtro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filtro text := coalesce(p_filtro, 'AGUARDANDO');
  v_sindico boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if v_filtro not in ('AGUARDANDO', 'DECIDIDAS', 'TODAS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  v_sindico := eh_sindico(p_pessoa);
  return jsonb_build_object(
    'decisoes', coalesce((
      select jsonb_agg(decisao_json(d, p_pessoa)
                       order by d.estado <> 'AGUARDANDO', case when d.estado = 'AGUARDANDO' then d.prazo end, d.respondida_em desc nulls last, d.pedida_em desc)
        from decisoes_pedido d join pedidos p on p.id = d.pedido_id
       where pedido_visivel(p_pessoa, p)
         and case v_filtro
               when 'AGUARDANDO' then d.estado = 'AGUARDANDO' and exists (select 1 from vinculos x where x.id = d.decisor_id and x.pessoa_id = p_pessoa)
               when 'DECIDIDAS' then d.estado in ('APROVADA', 'DEVOLVIDA')
               else true end
         and (v_filtro = 'AGUARDANDO' or v_sindico or d.pedida_por = p_pessoa
              or exists (select 1 from vinculos x where x.id = d.decisor_id and x.pessoa_id = p_pessoa))), '[]'::jsonb),
    'aguardandoEu', (select count(*) from decisoes_pedido d join vinculos x on x.id = d.decisor_id
                      where d.estado = 'AGUARDANDO' and x.pessoa_id = p_pessoa),
    'filtro', v_filtro,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('aprovar', pode(p_pessoa, p_condominio, 'decisoes.aprovar')));
end $$;

-- Resumo para o Início e o menu (decisão 10): o que espera a minha resposta agora.
create function resumo_decisoes(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('aguardando', count(*), 'vencidas', count(*) filter (where d.prazo < hoje_no_condominio()),
                            'maisAntigaDias', hoje_no_condominio()
                              - min((d.pedida_em at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date))
    from decisoes_pedido d join vinculos x on x.id = d.decisor_id
   where d.estado = 'AGUARDANDO' and x.pessoa_id = p_pessoa
$$;

-- ---------------------------------------------------------------------------------------
-- O pedido com as ligações, os parecidos e as decisões.

alter function plataforma_pedido(uuid, uuid, uuid) rename to pedido_f74;
alter function pedido_f74(uuid, uuid, uuid) security invoker;
create function plataforma_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  p pedidos;
  v_atualizar boolean;
begin
  v := pedido_f74(p_pessoa, p_condominio, p_id);
  p := exigir_pedido(p_pessoa, p_id);
  v_atualizar := (v -> 'pode' ->> 'atualizar')::boolean;
  return v || jsonb_build_object(
    'relacionados', jsonb_build_object(
      'ligados', ligacoes_do_pedido(p_pessoa, p),
      'parecidos', case when v_atualizar and p.estado <> 'CANCELADO' then pedidos_parecidos(p_pessoa, p) else '[]'::jsonb end,
      'dias', (select parecidos_dias from configuracao_condominio)),
    'decisoes', coalesce((select jsonb_agg(decisao_json(d, p_pessoa) order by d.pedida_em desc) from decisoes_pedido d where d.pedido_id = p.id),
                         '[]'::jsonb),
    'decisores', case when v_atualizar and p.estado in ('ABERTO', 'EM_ANDAMENTO') then decisores_do_condominio() else '[]'::jsonb end,
    'pode', (v -> 'pode') || jsonb_build_object(
      'ligar', v_atualizar and p.estado <> 'CANCELADO',
      'pedirDecisao', v_atualizar and p.estado in ('ABERTO', 'EM_ANDAMENTO')));
end $$;

-- A pendência da decisão não se resolve à mão (decisão 8).
alter function plataforma_resolver_pendencia(uuid, uuid, uuid, integer, uuid, text) rename to resolver_pendencia_f74;
alter function resolver_pendencia_f74(uuid, uuid, uuid, integer, uuid, text) security invoker;
create function plataforma_resolver_pendencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_pendencia uuid, p_resolucao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if exists (select 1 from decisoes_pedido where pendencia_id = p_pendencia and estado = 'AGUARDANDO') then
    perform recusar_motivo('Esta pendência se resolve com a resposta da decisão', 'PENDENCIA_DE_DECISAO');
  end if;
  return resolver_pendencia_f74(p_pessoa, p_condominio, p_id, p_versao, p_pendencia, p_resolucao);
end $$;

-- Cancelar o pedido retira a decisão que esperava resposta (decisão 8).
alter function plataforma_cancelar_pedido(uuid, uuid, uuid, integer, text) rename to cancelar_pedido_f74;
alter function cancelar_pedido_f74(uuid, uuid, uuid, integer, text) security invoker;
create function plataforma_cancelar_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  d decisoes_pedido;
begin
  v := cancelar_pedido_f74(p_pessoa, p_condominio, p_id, p_versao, p_motivo);
  for d in select * from decisoes_pedido where pedido_id = p_id and estado = 'AGUARDANDO' loop
    perform definir_transicao('RETIRADA', 'Pedido cancelado');
    update decisoes_pedido set estado = 'RETIRADA', respondida_em = app_now(), respondida_por = p_pessoa, retirada_motivo = 'Pedido cancelado'
     where id = d.id;
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Início: a linha das decisões no Agora, para quem pode aprovar.

alter function plataforma_painel(uuid, uuid) rename to painel_f74;
alter function painel_f74(uuid, uuid) security invoker;
create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := painel_f74(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'decisoes.aprovar') then
    v := v || jsonb_build_object('decisoes', resumo_decisoes(p_pessoa));
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Os dois indicadores que faltavam (TR-01, TR-07).

-- Reincidência no período: pedidos abertos no período e ligados como reincidência, sobre todos os
-- abertos no período (sem os cancelados). Sem pedido no período, "sem dados" (total 0 e
-- porcentagem nula).
create function reincidencia_no_periodo(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
begin
  return (
    with base as (
      select p.id, p.local, p.unidade_id, p.categoria_id, p.protocolo, onde_do_pedido(p) as onde,
             exists (select 1 from ligacoes_pedido l where l.pedido_id = p.id and l.desfeita_em is null and l.tipo = 'REINCIDENCIA') as reincidente
        from pedidos p
       where p.criado_em >= v_ini and p.criado_em < v_fim and p.estado <> 'CANCELADO'
    ), onde as (
      select coalesce(chave_local(b.local), b.unidade_id::text) as chave, b.categoria_id,
             count(*) as vezes, max(b.protocolo) as ultima, max(b.onde) as onde
        from base b where b.reincidente
       group by 1, 2
    )
    select jsonb_build_object(
      'pedidos', (select count(*) from base),
      'reincidencias', (select count(*) from base where reincidente),
      'porcentagem', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where reincidente) / count(*)) end from base),
      'ondeVolta', coalesce((select jsonb_agg(jsonb_build_object('onde', o.onde, 'categoria', (select nome from categorias where id = o.categoria_id),
                                                                 'vezes', o.vezes, 'ultima', o.ultima)
                                              order by o.vezes desc, o.ultima desc)
                               from (select * from onde order by vezes desc, ultima desc limit 5) o), '[]'::jsonb)));
end $$;

-- Decisões aguardando o síndico: de agora; decididas e tempo típico (mediana), do período.
-- Devolvida conta como decidida; retirada, não.
create function decisoes_no_periodo(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
begin
  return (
    select jsonb_build_object(
      'aguardando', (select count(*) from decisoes_pedido where estado = 'AGUARDANDO'),
      'vencidas', (select count(*) from decisoes_pedido where estado = 'AGUARDANDO' and prazo < hoje_no_condominio()),
      'maisAntigaDias', (select hoje_no_condominio() - min((pedida_em at time zone v_fuso)::date) from decisoes_pedido where estado = 'AGUARDANDO'),
      'decididas', count(*),
      'aprovadas', count(*) filter (where estado = 'APROVADA'),
      'devolvidas', count(*) filter (where estado = 'DEVOLVIDA'),
      'medianaHoras', round((percentile_cont(0.5) within group (order by extract(epoch from respondida_em - pedida_em) / 3600))::numeric, 1))
      from decisoes_pedido
     where estado in ('APROVADA', 'DEVOLVIDA') and respondida_em >= v_ini and respondida_em < v_fim);
end $$;

alter function plataforma_indicadores(uuid, uuid, text) rename to indicadores_f74;
alter function indicadores_f74(uuid, uuid, text) security invoker;
create function plataforma_indicadores(p_pessoa uuid, p_condominio uuid, p_periodo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_de date;
  v_ate date;
begin
  v := indicadores_f74(p_pessoa, p_condominio, p_periodo);
  v_de := (v -> 'atual' ->> 'de')::date;
  v_ate := (v -> 'atual' ->> 'ate')::date;
  return v || jsonb_build_object('reincidencia', reincidencia_no_periodo(v_de, v_ate), 'decisoes', decisoes_no_periodo(v_de, v_ate));
end $$;

-- ---------------------------------------------------------------------------------------
-- Prazo vencido avisa quem decide, uma vez (decisão 9). Roda de hora em hora.

create function verificar_decisoes() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
  v_n integer;
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform entrar_como_sistema(c.id);
    begin
      insert into avisos_decisao (condominio_id, pessoa_id, decisao_id, tipo)
      select c.id, x.pessoa_id, d.id, 'VENCIDA'
        from decisoes_pedido d join vinculos x on x.id = d.decisor_id and x.revogado_em is null
       where d.estado = 'AGUARDANDO' and d.prazo < hoje_no_condominio()
      on conflict (pessoa_id, decisao_id, tipo) do nothing;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    exception when others then
      raise warning 'Decisões do condomínio % não conferidas: %', c.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-decisoes', '17 * * * *', 'select public.verificar_decisoes()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_decisoes() de outro jeito (%).', sqlerrm;
end $$;

-- Sino: os avisos das decisões entram com os outros (0270).
alter function plataforma_avisos(uuid, uuid) rename to avisos_f74;
alter function avisos_f74(uuid, uuid) security invoker;
create function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := avisos_f74(p_pessoa, p_condominio);
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(x.item order by (x.item ->> 'vistoEm') is not null, (x.item ->> 'criadoEm')::timestamptz desc)
        from (select item from jsonb_array_elements(v -> 'itens') item
              union all
              select jsonb_strip_nulls(jsonb_build_object(
                       'id', a.id, 'tipo', 'DECISAO_' || a.tipo, 'decisaoId', d.id, 'pedidoId', p.id, 'protocolo', p.protocolo,
                       'titulo', d.pergunta, 'prazo', to_char(d.prazo, 'YYYY-MM-DD'), 'estado', d.estado,
                       'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
                from avisos_decisao a join decisoes_pedido d on d.id = a.decisao_id join pedidos p on p.id = d.pedido_id
               where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') x), '[]'::jsonb),
    'naoVistos', (v ->> 'naoVistos')::integer + (select count(*) from avisos_decisao where pessoa_id = p_pessoa and visto_em is null));
end $$;

alter function plataforma_marcar_avisos(uuid, uuid, uuid[]) rename to marcar_avisos_f74;
alter function marcar_avisos_f74(uuid, uuid, uuid[]) security invoker;
create function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_r integer;
begin
  v_n := marcar_avisos_f74(p_pessoa, p_condominio, p_ids);
  update avisos_decisao set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  return v_n + v_r;
end $$;

call fechar_acesso();

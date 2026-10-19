-- 0240 · Vida em condomínio: assembleias (peça R12; AC-02, CD-07, AT-17, W-20). Telas e decisões
-- aprovadas pela Carolina em 19/10/2026 (docs/telas/vida.html, telas 6 a 8 e decisões 8 a 13 e 15).
--
-- Regras desta parte:
-- 1. O síndico monta a assembleia (tipo, forma, 1ª e 2ª chamada, local, link da videochamada) e
--    a pauta. Cada item tem o seu quórum, escolhido entre os comuns, com o aviso de conferir a
--    convenção. Enquanto é rascunho, tudo muda; convocada, não muda mais.
-- 2. Convocar confere a antecedência (Configurações, conforme a convenção) e, com o voto pela
--    fração ideal, que toda unidade ativa tem a fração. O edital vai como comunicado publicado
--    (mural e e-mail) e cada unidade recebe um link pessoal, sem conta, pelo WhatsApp (modelo
--    aprovado, respeitando PARAR) e pelo e-mail dos proprietários. Um lembrete vai na véspera.
-- 3. Votam o proprietário ou o procurador com procuração aceita pelo síndico. Pelo link, o
--    proprietário indica o procurador (outra unidade ou outra pessoa); o síndico confere o
--    documento recebido e aceita ou recusa com motivo. Aceita para outra unidade, o link dela
--    passa a valer pelas duas. O síndico marca, com motivo, as unidades sem direito a voto.
-- 4. Na hora, abrir o link registra a presença online; o síndico (ou o secretário) marca quem
--    está no salão e registra o voto de quem não usa o link. Um item por vez abre e fecha a sua
--    votação; o voto pode ser trocado enquanto o item está aberto.
-- 5. O resultado pesa pela fração ideal (ou um voto por unidade, se o síndico escolher). Quando o
--    quórum do item é sobre todas as frações e os presentes não o alcançam, o sistema avisa antes
--    de votar. Ao fechar o item, os números ficam guardados e não mudam.
-- 6. Ao encerrar, o rascunho da ata vem montado: o texto é editável, os números não. A ata
--    assinada entra por Documentos › Atas e é ligada à assembleia; a assembleia realizada vai
--    para a linha do tempo da Memória do prédio.
-- 7. Permissões (CF-03): Ver as assembleias e Cuidar das assembleias, dadas pelo síndico.

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_ASSEMBLEIAS', 'Ver as assembleias', 'Ver as assembleias, a presença e os resultados.', 19),
  ('ASSEMBLEIAS', 'Cuidar das assembleias', 'Convocar, conduzir a votação e fazer a ata das assembleias.', 20);
insert into permissao_acoes (permissao, acao) values
  ('VER_ASSEMBLEIAS', 'assembleias.ver'),
  ('ASSEMBLEIAS', 'assembleias.ver'),
  ('ASSEMBLEIAS', 'assembleias.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'assembleias.ver'),
  ('SINDICO', 'assembleias.editar');

alter table codigos_sem_conta drop constraint codigos_sem_conta_tipo_check;
alter table codigos_sem_conta add constraint codigos_sem_conta_tipo_check check (tipo in ('ETIQUETA', 'PRESTADOR', 'ENQUETE', 'ASSEMBLEIA'));

-- Fração ideal da unidade, em porcentagem (decisão 9).
alter table unidades add column fracao_ideal numeric(9, 6) check (fracao_ideal > 0 and fracao_ideal <= 100);

-- Regras da convenção (decisões 9 e 11).
alter table configuracao_condominio
  add column assembleia_antecedencia smallint not null default 10 check (assembleia_antecedencia between 1 and 60),
  add column assembleia_peso text not null default 'FRACAO' check (assembleia_peso in ('FRACAO', 'UNIDADE'));

-- ---------------------------------------------------------------------------------------
-- Assembleias (AC-02).

create table assembleias (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  titulo              text not null check (length(btrim(titulo)) between 5 and 120),
  tipo                text not null check (tipo in ('ORDINARIA', 'EXTRAORDINARIA')),
  forma               text not null check (forma in ('PRESENCIAL', 'ONLINE', 'HIBRIDA')),
  primeira_chamada    timestamptz not null,
  segunda_chamada     timestamptz not null,
  local               text check (length(btrim(local)) between 2 and 200),
  link_video          text check (link_video ~ '^https://[^[:space:]]{4,}$' and length(link_video) <= 300),
  estado              text not null default 'RASCUNHO' check (estado in ('RASCUNHO', 'CONVOCADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA')),
  peso                text check (peso in ('FRACAO', 'UNIDADE')),
  antecedencia        smallint,
  convocada_em        timestamptz,
  convocada_por       uuid references pessoas (id),
  comunicado_id       uuid,
  lembrete_enviado_em timestamptz,
  iniciada_em         timestamptz,
  iniciada_por        uuid references pessoas (id),
  encerrada_em        timestamptz,
  encerrada_por       uuid references pessoas (id),
  cancelada_em        timestamptz,
  cancelada_por       uuid references pessoas (id),
  motivo_cancelamento text check (length(btrim(motivo_cancelamento)) between 3 and 500),
  ata_texto           text check (length(ata_texto) <= 20000),
  ata_documento_id    uuid,
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid not null references pessoas (id),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  unique (id, condominio_id),
  foreign key (comunicado_id, condominio_id) references comunicados (id, condominio_id),
  foreign key (ata_documento_id, condominio_id) references documentos (id, condominio_id),
  check (segunda_chamada >= primeira_chamada),
  check ((estado = 'RASCUNHO') = (convocada_em is null) or estado = 'CANCELADA'),
  check (estado = 'RASCUNHO' or estado = 'CANCELADA' or (peso is not null and antecedencia is not null)),
  check ((estado = 'CANCELADA') = (cancelada_em is not null)),
  check (estado <> 'ENCERRADA' or encerrada_em is not null)
);
create index assembleias_condominio on assembleias (condominio_id, primeira_chamada desc);
call proteger_tabela_condominio('assembleias');
create trigger assembleias_sem_exclusao before delete on assembleias for each row execute function somente_insercao();

create table itens_assembleia (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  assembleia_id uuid not null,
  ordem         smallint not null check (ordem between 1 and 30),
  titulo        text not null check (length(btrim(titulo)) between 3 and 200),
  descricao     text check (length(btrim(descricao)) between 2 and 1000),
  tipo          text not null check (tipo in ('APROVACAO', 'ESCOLHA')),
  -- APROVACAO: Sim, Não e Abstenção. ESCOLHA: as opções do síndico e Em branco no fim.
  opcoes        text[] not null check (cardinality(opcoes) between 3 and 11),
  quorum        text not null check (quorum in ('MAIORIA_PRESENTES', 'MAIORIA_TODAS', 'DOIS_TERCOS_TODAS', 'UNANIMIDADE')),
  estado        text not null default 'AGUARDANDO' check (estado in ('AGUARDANDO', 'ABERTO', 'ENCERRADO')),
  aberto_em     timestamptz,
  encerrado_em  timestamptz,
  resultado     jsonb,
  unique (id, condominio_id),
  unique (assembleia_id, ordem),
  foreign key (assembleia_id, condominio_id) references assembleias (id, condominio_id),
  check ((estado = 'ENCERRADO') = (resultado is not null and encerrado_em is not null)),
  check (estado = 'AGUARDANDO' or aberto_em is not null)
);
-- Um item aberto por vez.
create unique index itens_assembleia_um_aberto on itens_assembleia (assembleia_id) where estado = 'ABERTO';
call proteger_tabela_condominio('itens_assembleia');

-- Os números do item fechado não mudam (regra 5).
create function itens_assembleia_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'ENCERRADO' then
    raise exception 'O item já foi votado: os números não mudam' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger itens_assembleia_regras before update on itens_assembleia for each row execute function itens_assembleia_regras();

create table convites_assembleia (
  id                      uuid primary key default gen_random_uuid(),
  condominio_id           uuid not null references condominios (id) on delete restrict,
  assembleia_id           uuid not null,
  unidade_id              uuid not null,
  peso                    numeric(12, 6) not null check (peso > 0),
  sem_direito             boolean not null default false,
  motivo_sem_direito      text check (length(btrim(motivo_sem_direito)) between 3 and 300),
  procurador_nome         text check (length(btrim(procurador_nome)) between 3 and 120),
  procurador_convite_id   uuid,
  procuracao_estado       text check (procuracao_estado in ('PENDENTE', 'ACEITA', 'RECUSADA')),
  procuracao_em           timestamptz,
  procuracao_motivo       text check (length(btrim(procuracao_motivo)) between 3 and 300),
  procuracao_decidida_em  timestamptz,
  procuracao_decidida_por uuid references pessoas (id),
  presente_em             timestamptz,
  presenca_forma          text check (presenca_forma in ('ONLINE', 'SALAO')),
  presenca_por            uuid references pessoas (id),
  unique (id, condominio_id),
  unique (assembleia_id, unidade_id),
  foreign key (assembleia_id, condominio_id) references assembleias (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (procurador_convite_id, condominio_id) references convites_assembleia (id, condominio_id),
  check (sem_direito = (motivo_sem_direito is not null)),
  check ((procuracao_estado is null) = (procurador_nome is null)),
  check (procurador_convite_id is distinct from id),
  check ((presente_em is null) = (presenca_forma is null))
);
call proteger_tabela_condominio('convites_assembleia');
create trigger convites_assembleia_sem_exclusao before delete on convites_assembleia for each row execute function somente_insercao();

create table votos_assembleia (
  item_id         uuid not null,
  condominio_id   uuid not null references condominios (id) on delete restrict,
  convite_id      uuid not null,
  opcao           smallint not null check (opcao between 1 and 11),
  peso            numeric(12, 6) not null check (peso > 0),
  votado_em       timestamptz not null,
  -- Quem votou: o link (de quem representa) ou a pessoa da equipe que registrou.
  pelo_convite_id uuid,
  registrado_por  uuid references pessoas (id),
  trocas          smallint not null default 0 check (trocas between 0 and 1000),
  primary key (item_id, convite_id),
  foreign key (item_id, condominio_id) references itens_assembleia (id, condominio_id),
  foreign key (convite_id, condominio_id) references convites_assembleia (id, condominio_id),
  foreign key (pelo_convite_id, condominio_id) references convites_assembleia (id, condominio_id),
  check ((pelo_convite_id is null) <> (registrado_por is null))
);
call proteger_tabela_condominio('votos_assembleia');
create trigger votos_assembleia_sem_exclusao before delete on votos_assembleia for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- WhatsApp e e-mail: o link pessoal da assembleia (decisão 15).

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA'));
alter table envios_whatsapp add column convite_assembleia_id uuid;
alter table envios_whatsapp add constraint envios_whatsapp_convite_assembleia
  foreign key (convite_assembleia_id, condominio_id) references convites_assembleia (id, condominio_id);

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete'));

insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('assembleia_convocacao', 1, 'Convocação de assembleia', 'MORADOR', 'Assembleia convocada, com o link pessoal da unidade',
   '["condomínio", "assembleia", "1ª chamada", "de quem é o link", "link"]',
   E'O {{1}} convoca a {{2}}, com 1ª chamada em {{3}}. O edital está no mural.\n\nPelo link, que é só {{4}}, dá para indicar procurador, registrar presença e votar online:\n{{5}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now()),
  ('assembleia_lembrete', 1, 'Lembrete de assembleia', 'MORADOR', 'Lembrete na véspera da assembleia, com o link pessoal',
   '["condomínio", "assembleia", "1ª chamada", "de quem é o link", "link"]',
   E'Lembrete do {{1}}: a {{2}} é em {{3}}. Para registrar presença e votar online, use o link, que é só {{4}}:\n{{5}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave in ('assembleia_convocacao', 'assembleia_lembrete');

alter table envios_email drop constraint envios_email_tipo_check;
alter table envios_email add constraint envios_email_tipo_check check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO', 'ENQUETE', 'ASSEMBLEIA'));
alter table envios_email add column convite_assembleia_id uuid;
alter table envios_email add constraint envios_email_convite_assembleia
  foreign key (convite_assembleia_id, condominio_id) references convites_assembleia (id, condominio_id);
alter table envios_email add constraint envios_email_assembleia_tem_convite
  check (tipo <> 'ASSEMBLEIA' or (convite_assembleia_id is not null and contato_id is not null));

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- "Assembleia geral ordinária" no meio da frase: "assembleia geral ordinária".
create function nome_da_assembleia(a assembleias) returns text
language sql immutable
set search_path = public
as $$ select case a.tipo when 'ORDINARIA' then 'assembleia geral ordinária' else 'assembleia geral extraordinária' end $$;

-- "sábado, 08/11, às 19:00", no fuso do condomínio.
create function chamada_por_extenso(p timestamptz) returns text
language sql stable
set search_path = public
as $$
  select dia_por_extenso((p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date) || ', às '
      || to_char(p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'HH24:MI')
$$;

create function gerar_codigo_sem_conta(p_tipo text, p_alvo uuid) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  loop
    v_codigo := novo_codigo_mural();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo))
          and not exists (select 1 from links_publicos where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), contexto_condominio(), p_tipo, p_alvo);
  return v_codigo;
end $$;

-- Os proprietários confirmados da unidade: quem recebe o convite.
create function proprietarios_da_unidade(p_unidade uuid) returns setof contatos
language sql stable
set search_path = public
as $$
  select ct.* from contatos ct
   where ct.dados_removidos_em is null
     and exists (select 1 from contatos_unidade cu where cu.unidade_id = p_unidade and cu.contato_id = ct.id
                                                  and cu.relacao = 'PROPRIETARIO' and cu.estado = 'CONFIRMADO')
$$;

-- As unidades que o link vota: a própria (se não passou a outra unidade) e as das procurações
-- aceitas para ela.
create function representados(c convites_assembleia) returns setof convites_assembleia
language sql stable
set search_path = public
as $$
  select x.* from convites_assembleia x
   where (x.id = c.id and not (x.procuracao_estado = 'ACEITA' and x.procurador_convite_id is not null))
      or (x.procurador_convite_id = c.id and x.procuracao_estado = 'ACEITA')
$$;

create function exigir_assembleia(p_id uuid) returns assembleias
language plpgsql
set search_path = public
as $$
declare a assembleias;
begin
  select * into a from assembleias where id = p_id;
  if not found then raise exception 'Assembleia não encontrada' using errcode = 'TC404'; end if;
  return a;
end $$;

-- O resultado do item, pelo peso escolhido (regra 5). "alcancavel" diz se o quórum ainda dá com
-- os presentes com direito a voto.
create function resultado_item(i itens_assembleia) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_total numeric := (select coalesce(sum(peso), 0) from convites_assembleia where assembleia_id = i.assembleia_id);
  v_presentes numeric := (select coalesce(sum(peso), 0) from convites_assembleia where assembleia_id = i.assembleia_id
                                                                                 and presente_em is not null and not sem_direito);
  v_pesos numeric[];
  v_contas integer[];
  v_validos numeric;
  v_meta numeric;
  v_ganha integer;
  v_segundo numeric;
  v_situacao text;
  v_n integer := cardinality(i.opcoes);
  v_ultimo integer := case when i.tipo = 'APROVACAO' then 3 else cardinality(i.opcoes) end; -- Abstenção ou Em branco
begin
  select array_agg(coalesce(s.p, 0) order by g.n), array_agg(coalesce(s.c, 0) order by g.n) into v_pesos, v_contas
    from generate_series(1, v_n) g(n)
    left join (select opcao, sum(peso) p, count(*)::integer c from votos_assembleia where item_id = i.id group by opcao) s on s.opcao = g.n;
  v_meta := case i.quorum when 'MAIORIA_TODAS' then v_total / 2 when 'DOIS_TERCOS_TODAS' then v_total * 2 / 3 when 'UNANIMIDADE' then v_total end;
  if i.tipo = 'APROVACAO' then
    v_situacao := case
      when i.quorum = 'MAIORIA_PRESENTES' then case when v_pesos[1] > v_pesos[2] then 'APROVADO' else 'REPROVADO' end
      when i.quorum = 'MAIORIA_TODAS' then case when v_pesos[1] > v_meta then 'APROVADO' else 'REPROVADO' end
      else case when v_pesos[1] >= v_meta then 'APROVADO' else 'REPROVADO' end end;
  else
    select g.n into v_ganha from generate_series(1, v_n - 1) g(n) order by v_pesos[g.n] desc, g.n limit 1;
    select max(v_pesos[g.n]) into v_segundo from generate_series(1, v_n - 1) g(n) where g.n <> v_ganha;
    v_situacao := case
      when v_pesos[v_ganha] = 0 then 'SEM_VOTOS'
      when v_pesos[v_ganha] = coalesce(v_segundo, -1) then 'EMPATE'
      when i.quorum = 'MAIORIA_PRESENTES' then 'ESCOLHIDA'
      when i.quorum = 'MAIORIA_TODAS' and v_pesos[v_ganha] > v_meta then 'ESCOLHIDA'
      when i.quorum <> 'MAIORIA_TODAS' and v_pesos[v_ganha] >= v_meta then 'ESCOLHIDA'
      else 'SEM_QUORUM' end;
  end if;
  v_validos := (select coalesce(sum(v_pesos[g.n]), 0) from generate_series(1, v_n) g(n) where g.n <> v_ultimo);
  return jsonb_strip_nulls(jsonb_build_object(
    'opcoes', (select jsonb_agg(jsonb_build_object('texto', i.opcoes[g.n], 'votos', v_contas[g.n], 'peso', round(v_pesos[g.n], 6),
                                                   'porcentagem', case when v_presentes > 0 then round(100 * v_pesos[g.n] / v_presentes, 1) else 0 end)
                                order by g.n) from generate_series(1, v_n) g(n)),
    'votaram', (select count(*) from votos_assembleia where item_id = i.id),
    'presentes', (select count(*) from convites_assembleia where assembleia_id = i.assembleia_id and presente_em is not null and not sem_direito),
    'pesoPresentes', round(v_presentes, 6), 'pesoTotal', round(v_total, 6),
    'porcentagemPresentes', case when v_total > 0 then round(100 * v_presentes / v_total, 1) else 0 end,
    'situacao', v_situacao,
    'vencedor', case when v_situacao = 'ESCOLHIDA' then i.opcoes[v_ganha] end,
    'alcancavel', case when v_meta is null then true when i.quorum = 'MAIORIA_TODAS' then v_presentes > v_meta else v_presentes >= v_meta end,
    'validos', round(v_validos, 6)));
end $$;

create function item_json(i itens_assembleia) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', i.id, 'ordem', i.ordem, 'titulo', i.titulo, 'descricao', i.descricao, 'tipo', i.tipo, 'opcoes', to_jsonb(i.opcoes),
    'quorum', i.quorum, 'estado', i.estado, 'abertoEm', i.aberto_em, 'encerradoEm', i.encerrado_em,
    'resultado', case when i.estado = 'ENCERRADO' then i.resultado else resultado_item(i) end))
$$;

create function assembleia_json(a assembleias) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'forma', a.forma, 'primeiraChamada', a.primeira_chamada, 'segundaChamada', a.segunda_chamada,
    'local', a.local, 'linkVideo', a.link_video, 'estado', a.estado,
    'peso', coalesce(a.peso, (select assembleia_peso from configuracao_condominio)),
    'antecedencia', coalesce(a.antecedencia, (select assembleia_antecedencia from configuracao_condominio)),
    'enviarAte', to_char(data_no_condominio(a.primeira_chamada) - coalesce(a.antecedencia, (select assembleia_antecedencia from configuracao_condominio)), 'YYYY-MM-DD'),
    'convocadaEm', a.convocada_em, 'convocadaPor', nome_pessoa(a.convocada_por), 'comunicadoId', a.comunicado_id,
    'iniciadaEm', a.iniciada_em, 'encerradaEm', a.encerrada_em, 'canceladaEm', a.cancelada_em, 'motivoCancelamento', a.motivo_cancelamento,
    'ataTexto', a.ata_texto,
    'ataDocumento', (select jsonb_build_object('id', d.id, 'titulo', d.titulo) from documentos d where d.id = a.ata_documento_id),
    'itens', coalesce((select jsonb_agg(item_json(i) order by i.ordem) from itens_assembleia i where i.assembleia_id = a.id), '[]'::jsonb),
    'presenca', case when a.estado not in ('RASCUNHO', 'CANCELADA') then (
      select jsonb_build_object(
        'unidades', count(*), 'presentes', count(*) filter (where c.presente_em is not null),
        'online', count(*) filter (where c.presenca_forma = 'ONLINE'), 'salao', count(*) filter (where c.presenca_forma = 'SALAO'),
        'porProcuracao', count(*) filter (where c.procuracao_estado = 'ACEITA'),
        'procuracoesPendentes', count(*) filter (where c.procuracao_estado = 'PENDENTE'),
        'semDireito', count(*) filter (where c.sem_direito),
        'porcentagem', case when sum(c.peso) > 0 then round(100 * coalesce(sum(c.peso) filter (where c.presente_em is not null), 0) / sum(c.peso), 1) else 0 end)
        from convites_assembleia c where c.assembleia_id = a.id) end,
    'criadoEm', a.criado_em, 'versao', a.versao))
$$;

-- A pauta, como o síndico mandou: 1 a 30 itens; ESCOLHA ganha Em branco no fim.
create function gravar_pauta(p_assembleia uuid, p_itens jsonb) returns void
language plpgsql
set search_path = public
as $$
declare
  x jsonb;
  n integer := 0;
  v_tipo text;
  v_opcoes text[];
  v_campos text[] := '{}';
begin
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) not between 1 and 30 then
    perform recusar_campos('A pauta tem de 1 a 30 itens', 'itens');
  end if;
  delete from itens_assembleia where assembleia_id = p_assembleia;
  for x in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    v_tipo := coalesce(x ->> 'tipo', 'APROVACAO');
    select array_agg(btrim(o) order by k) into v_opcoes
      from jsonb_array_elements_text(coalesce(x -> 'opcoes', '[]'::jsonb)) with ordinality t(o, k) where btrim(o) <> '';
    if length(btrim(coalesce(x ->> 'titulo', ''))) not between 3 and 200 then v_campos := v_campos || ('itens.' || n || '.titulo'); end if;
    if v_tipo not in ('APROVACAO', 'ESCOLHA') then v_campos := v_campos || ('itens.' || n || '.tipo'); end if;
    if coalesce(x ->> 'quorum', '') not in ('MAIORIA_PRESENTES', 'MAIORIA_TODAS', 'DOIS_TERCOS_TODAS', 'UNANIMIDADE') then
      v_campos := v_campos || ('itens.' || n || '.quorum');
    end if;
    if v_tipo = 'ESCOLHA' and (v_opcoes is null or cardinality(v_opcoes) not between 2 and 10 or not opcoes_enquete_validas(v_opcoes || array['Em branco'])) then
      v_campos := v_campos || ('itens.' || n || '.opcoes');
    end if;
    if cardinality(v_campos) = 0 then
      insert into itens_assembleia (condominio_id, assembleia_id, ordem, titulo, descricao, tipo, opcoes, quorum)
      values (contexto_condominio(), p_assembleia, n, btrim(x ->> 'titulo'), nullif(btrim(coalesce(x ->> 'descricao', '')), ''), v_tipo,
              case when v_tipo = 'APROVACAO' then array['Sim', 'Não', 'Abstenção'] else v_opcoes || array['Em branco'] end, x ->> 'quorum');
    end if;
  end loop;
  if cardinality(v_campos) > 0 then perform recusar_campos('Confira a pauta', variadic v_campos); end if;
end $$;

-- O convite (ou o lembrete) para os proprietários da unidade, pelo WhatsApp e pelo e-mail.
create function enviar_convite_assembleia(a assembleias, c convites_assembleia, p_lembrete boolean, p_pessoa uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  ct contatos;
  v_envio uuid;
  v_n integer := 0;
  v_dono text := 'da ' || rotulo_unidade(c.unidade_id);
  v_whats boolean := exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS');
  v_email boolean := coalesce((select email_ligado from configuracao_condominio), false);
begin
  for ct in select * from proprietarios_da_unidade(c.unidade_id) loop
    if v_whats and ct.telefone is not null and ct.whatsapp_parou_em is null then
      v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, null, null, 'ASSEMBLEIA',
        case when p_lembrete
          then 'Lembrete: a ' || nome_da_assembleia(a) || ' é em ' || chamada_por_extenso(a.primeira_chamada)
               || '. Para registrar presença e votar online, use o link, que é só ' || v_dono || E':\n[link]'
          else 'O ' || nome_do_condominio() || ' convoca a ' || nome_da_assembleia(a) || ', com 1ª chamada em '
               || chamada_por_extenso(a.primeira_chamada) || E'. O edital está no mural.\n\nPelo link, que é só ' || v_dono
               || E', dá para indicar procurador, registrar presença e votar online:\n[link]' end
        || assinatura_nina(), p_pessoa, p_pessoa);
      update envios_whatsapp set convite_assembleia_id = c.id,
                                 modelo_chave = case when p_lembrete then 'assembleia_lembrete' else 'assembleia_convocacao' end,
                                 modelo_parametros = jsonb_build_array(nome_do_condominio(), nome_da_assembleia(a),
                                                                       chamada_por_extenso(a.primeira_chamada), v_dono, '[link]')
       where id = v_envio;
      v_n := v_n + 1;
    end if;
    if v_email and recebe_por_email(ct) then
      insert into envios_email (condominio_id, tipo, contato_id, convite_assembleia_id, lembrete, para, criado_por)
      values (a.condominio_id, 'ASSEMBLEIA', ct.id, c.id, p_lembrete, ct.email, p_pessoa);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- O edital, montado com a pauta, as chamadas e como votar (regra 2).
create function texto_edital(a assembleias) returns text
language sql stable
set search_path = public
as $$
  select 'Ficam convocados os condôminos do ' || nome_do_condominio() || ' para a ' || nome_da_assembleia(a) || ', '
      || case a.forma when 'PRESENCIAL' then 'presencial' when 'ONLINE' then 'online' else 'híbrida (presencial e online)' end
      || E'.\n\n1ª chamada: ' || chamada_por_extenso(a.primeira_chamada) || E'.\n2ª chamada: ' || chamada_por_extenso(a.segunda_chamada) || '.'
      || case when a.local is not null then E'\nLocal: ' || a.local || '.' else '' end
      || case when a.forma <> 'PRESENCIAL' then E'\nVideochamada: o endereço vai no link pessoal de cada unidade.' else '' end
      || E'\n\nPauta:\n' || (select string_agg(i.ordem || '. ' || i.titulo, E'\n' order by i.ordem) from itens_assembleia i where i.assembleia_id = a.id)
      || E'\n\nVotam os proprietários ou os procuradores com procuração aceita pelo síndico. '
      || case when a.peso = 'FRACAO' then 'O voto pesa pela fração ideal de cada unidade. ' else 'Cada unidade tem um voto. ' end
      || 'Cada unidade recebe pelo WhatsApp ou pelo e-mail um link pessoal para indicar procurador, registrar presença e votar online.'
$$;

-- Fecha o item e guarda os números (regra 5).
create function fechar_item(i itens_assembleia) returns itens_assembleia
language plpgsql
set search_path = public
as $$
declare r jsonb := resultado_item(i);
begin
  update itens_assembleia set estado = 'ENCERRADO', encerrado_em = app_now(), resultado = r where id = i.id returning * into i;
  perform registrar_historico('assembleia.item_encerrado', 'assembleias', i.assembleia_id::text,
    jsonb_build_object('item', i.ordem, 'titulo', i.titulo, 'situacao', r ->> 'situacao', 'vencedor', r ->> 'vencedor'));
  return i;
end $$;

-- Marca presença (online pelo link ou no salão pelo síndico) da unidade.
create function marcar_presenca(c convites_assembleia, p_forma text, p_pessoa uuid) returns void
language sql
set search_path = public
as $$
  update convites_assembleia set presente_em = coalesce(presente_em, app_now()), presenca_forma = coalesce(presenca_forma, p_forma),
                                 presenca_por = case when presente_em is null then p_pessoa else presenca_por end
   where id = c.id;
$$;

-- O voto de uma unidade no item aberto.
create function gravar_voto(i itens_assembleia, c convites_assembleia, p_opcao integer, p_pelo uuid, p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if c.sem_direito then perform recusar_motivo('Esta unidade está sem direito a voto nesta assembleia', 'SEM_DIREITO_A_VOTO'); end if;
  insert into votos_assembleia (item_id, condominio_id, convite_id, opcao, peso, votado_em, pelo_convite_id, registrado_por)
  values (i.id, i.condominio_id, c.id, p_opcao, c.peso, app_now(), p_pelo, p_pessoa)
  on conflict (item_id, convite_id) do update
    set opcao = excluded.opcao, votado_em = excluded.votado_em, pelo_convite_id = excluded.pelo_convite_id,
        registrado_por = excluded.registrado_por, trocas = votos_assembleia.trocas + 1;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API: a aba Assembleias e a tela da assembleia.

create function plataforma_assembleias(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cfg configuracao_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.ver');
  select * into cfg from configuracao_condominio;
  return jsonb_build_object(
    'assembleias', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'forma', a.forma, 'estado', a.estado, 'primeiraChamada', a.primeira_chamada,
               'itens', (select count(*) from itens_assembleia i where i.assembleia_id = a.id),
               'presentes', (select count(*) filter (where presente_em is not null) from convites_assembleia c where c.assembleia_id = a.id),
               'unidades', (select count(*) from convites_assembleia c where c.assembleia_id = a.id),
               'procuracoesPendentes', (select count(*) from convites_assembleia c where c.assembleia_id = a.id and c.procuracao_estado = 'PENDENTE')))
             order by a.estado in ('ENCERRADA', 'CANCELADA'), a.primeira_chamada desc)
        from assembleias a), '[]'::jsonb),
    'regras', jsonb_build_object('antecedencia', cfg.assembleia_antecedencia, 'peso', cfg.assembleia_peso, 'versao', cfg.versao),
    'semFracao', (select count(*) from unidades where ativa and fracao_ideal is null),
    'unidades', (select count(*) from unidades where ativa),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'assembleias.editar'),
                               'configurar', pode(p_pessoa, p_condominio, 'config.editar'),
                               'fracoes', pode(p_pessoa, p_condominio, 'moradores.editar')));
end $$;

create function plataforma_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a assembleias;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.ver');
  a := exigir_assembleia(p_id);
  return jsonb_build_object(
    'assembleia', assembleia_json(a),
    'unidades', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', c.id, 'unidade', rotulo_unidade(c.unidade_id), 'peso', c.peso, 'semDireito', c.sem_direito, 'motivoSemDireito', c.motivo_sem_direito,
               'procuracao', case when c.procuracao_estado is not null then jsonb_build_object(
                  'estado', c.procuracao_estado, 'nome', c.procurador_nome, 'em', c.procuracao_em, 'motivo', c.procuracao_motivo,
                  'unidade', (select rotulo_unidade(x.unidade_id) from convites_assembleia x where x.id = c.procurador_convite_id)) end,
               'presenteEm', c.presente_em, 'presencaForma', c.presenca_forma,
               'proprietarios', (select string_agg(p.nome, ', ' order by p.nome) from proprietarios_da_unidade(c.unidade_id) p),
               'semContato', not exists (select 1 from proprietarios_da_unidade(c.unidade_id) p where p.telefone is not null or p.email is not null),
               'votos', (select jsonb_object_agg(i.ordem::text, v.opcao) from votos_assembleia v join itens_assembleia i on i.id = v.item_id
                          where v.convite_id = c.id)))
             order by chave_unidade(rotulo_unidade(c.unidade_id)))
        from convites_assembleia c where c.assembleia_id = a.id), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo) order by d.criado_em desc)
                              from documentos d where d.tipo = 'ATA' and d.arquivado_em is null), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', nome_pessoa(h.autor_id), 'dados', h.dados)
                       order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'assembleias' and h.entidade_id = a.id::text), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'assembleias.editar')));
end $$;

create function plataforma_salvar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  v_titulo text := btrim(coalesce(p_dados ->> 'titulo', ''));
  v_primeira timestamptz;
  v_segunda timestamptz;
  v_local text := nullif(btrim(coalesce(p_dados ->> 'local', '')), '');
  v_video text := nullif(btrim(coalesce(p_dados ->> 'linkVideo', '')), '');
  v_campos text[] := '{}';
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  if p_id is not null then
    a := exigir_assembleia(p_id);
    if a.estado <> 'RASCUNHO' then perform recusar_motivo('A assembleia convocada não muda: cancele e convoque outra', 'ASSEMBLEIA_CONVOCADA'); end if;
    if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  end if;
  begin v_primeira := (p_dados ->> 'primeiraChamada')::timestamptz; exception when others then v_primeira := null; end;
  begin v_segunda := (p_dados ->> 'segundaChamada')::timestamptz; exception when others then v_segunda := null; end;
  if length(v_titulo) not between 5 and 120 then v_campos := v_campos || 'titulo'::text; end if;
  if coalesce(p_dados ->> 'tipo', '') not in ('ORDINARIA', 'EXTRAORDINARIA') then v_campos := v_campos || 'tipo'::text; end if;
  if coalesce(p_dados ->> 'forma', '') not in ('PRESENCIAL', 'ONLINE', 'HIBRIDA') then v_campos := v_campos || 'forma'::text; end if;
  if v_primeira is null or v_primeira <= app_now() then v_campos := v_campos || 'primeiraChamada'::text; end if;
  if v_segunda is null or v_segunda < coalesce(v_primeira, v_segunda) then v_campos := v_campos || 'segundaChamada'::text; end if;
  if v_local is not null and length(v_local) not between 2 and 200 then v_campos := v_campos || 'local'::text; end if;
  if v_video is not null and (v_video !~ '^https://[^[:space:]]{4,}$' or length(v_video) > 300) then v_campos := v_campos || 'linkVideo'::text; end if;
  if cardinality(v_campos) > 0 then perform recusar_campos('Confira a assembleia', variadic v_campos); end if;

  if p_id is null then
    insert into assembleias (condominio_id, titulo, tipo, forma, primeira_chamada, segunda_chamada, local, link_video, criado_por)
    values (p_condominio, v_titulo, p_dados ->> 'tipo', p_dados ->> 'forma', v_primeira, v_segunda, v_local, v_video, p_pessoa)
    returning * into a;
    perform registrar_historico('assembleia.criada', 'assembleias', a.id::text, jsonb_build_object('titulo', a.titulo));
  else
    update assembleias set titulo = v_titulo, tipo = p_dados ->> 'tipo', forma = p_dados ->> 'forma', primeira_chamada = v_primeira,
                           segunda_chamada = v_segunda, local = v_local, link_video = v_video, atualizado_em = app_now()
     where id = p_id returning * into a;
  end if;
  perform gravar_pauta(a.id, coalesce(p_dados -> 'itens', '[]'::jsonb));
  return jsonb_build_object('id', a.id, 'versao', a.versao);
end $$;

create function plataforma_convocar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  cfg configuracao_condominio;
  c convites_assembleia;
  v jsonb;
  v_envios integer := 0;
  v_sem integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  select * into cfg from configuracao_condominio;
  if a.estado <> 'RASCUNHO' then perform recusar_motivo('A assembleia já foi convocada', 'ASSEMBLEIA_CONVOCADA'); end if;
  if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  if a.forma <> 'PRESENCIAL' and a.link_video is null then perform recusar_campos('Online ou híbrida pede o link da videochamada', 'linkVideo'); end if;
  if a.forma <> 'ONLINE' and a.local is null then perform recusar_campos('Presencial ou híbrida pede o local', 'local'); end if;
  if data_no_condominio(a.primeira_chamada) - hoje_no_condominio() < cfg.assembleia_antecedencia then
    perform recusar_motivo('A convocação precisa de ' || cfg.assembleia_antecedencia || ' dias de antecedência', 'ASSEMBLEIA_ANTECEDENCIA');
  end if;
  v_sem := (select count(*) from unidades where ativa and fracao_ideal is null);
  if cfg.assembleia_peso = 'FRACAO' and v_sem > 0 then
    perform recusar_motivo(v_sem || ' unidades sem fração ideal', 'SEM_FRACAO_IDEAL');
  end if;

  update assembleias set estado = 'CONVOCADA', peso = cfg.assembleia_peso, antecedencia = cfg.assembleia_antecedencia, convocada_em = app_now(),
                         convocada_por = p_pessoa, atualizado_em = app_now()
   where id = p_id returning * into a;
  insert into convites_assembleia (condominio_id, assembleia_id, unidade_id, peso)
  select p_condominio, a.id, u.id, case when a.peso = 'FRACAO' then u.fracao_ideal else 1 end from unidades u where u.ativa;
  v := plataforma_salvar_comunicado(p_pessoa, p_condominio, null, null, 'ASSEMBLEIA', left('Edital: ' || a.titulo, 120), texto_edital(a),
                                    'TODOS', '{}', '{}', '{}', null, null, 'PUBLICAR', null, true, cfg.email_ligado);
  update assembleias set comunicado_id = (v ->> 'id')::uuid where id = a.id returning * into a;
  for c in select * from convites_assembleia where assembleia_id = a.id loop
    v_envios := v_envios + enviar_convite_assembleia(a, c, false, p_pessoa);
  end loop;
  perform registrar_historico('assembleia.convocada', 'assembleias', a.id::text, jsonb_build_object(
    'unidades', (select count(*) from convites_assembleia where assembleia_id = a.id), 'envios', v_envios, 'comunicado', v ->> 'id'));
  return jsonb_build_object('versao', a.versao, 'comunicadoId', v ->> 'id', 'envios', v_envios,
                            'unidades', (select count(*) from convites_assembleia where assembleia_id = a.id));
end $$;

create function plataforma_cancelar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a assembleias;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado not in ('RASCUNHO', 'CONVOCADA') then perform recusar_motivo('Só a assembleia que ainda não começou é cancelada', 'ASSEMBLEIA_EM_ANDAMENTO'); end if;
  if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Escreva o motivo', 'motivo'); end if;
  update assembleias set estado = 'CANCELADA', cancelada_em = app_now(), cancelada_por = p_pessoa, motivo_cancelamento = btrim(p_motivo),
                         atualizado_em = app_now()
   where id = p_id returning * into a;
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'A assembleia foi cancelada'
   where estado = 'NA_FILA' and convite_assembleia_id in (select id from convites_assembleia where assembleia_id = p_id);
  update envios_email set estado = 'CANCELADO', motivo = 'A assembleia foi cancelada'
   where estado = 'NA_FILA' and convite_assembleia_id in (select id from convites_assembleia where assembleia_id = p_id);
  perform registrar_historico('assembleia.cancelada', 'assembleias', a.id::text, jsonb_build_object('motivo', a.motivo_cancelamento));
  return jsonb_build_object('versao', a.versao);
end $$;

create function plataforma_iniciar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a assembleias;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado <> 'CONVOCADA' then perform recusar_motivo('Só a assembleia convocada começa', 'ASSEMBLEIA_NAO_CONVOCADA'); end if;
  if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  if app_now() < a.primeira_chamada - interval '30 minutes' then
    perform recusar_motivo('A assembleia começa a partir de meia hora antes da 1ª chamada', 'ASSEMBLEIA_CEDO');
  end if;
  update assembleias set estado = 'EM_ANDAMENTO', iniciada_em = app_now(), iniciada_por = p_pessoa, atualizado_em = app_now()
   where id = p_id returning * into a;
  perform registrar_historico('assembleia.iniciada', 'assembleias', a.id::text, '{}');
  return jsonb_build_object('versao', a.versao);
end $$;

create function exigir_em_andamento(p_id uuid) returns assembleias
language plpgsql
set search_path = public
as $$
declare a assembleias := exigir_assembleia(p_id);
begin
  if a.estado <> 'EM_ANDAMENTO' then perform recusar_motivo('A assembleia não está em andamento', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  return a;
end $$;

-- Abre a votação de um item; só um por vez (regra 4).
create function plataforma_abrir_item(p_pessoa uuid, p_condominio uuid, p_id uuid, p_item uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  i itens_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_em_andamento(p_id);
  select * into i from itens_assembleia where id = p_item and assembleia_id = p_id;
  if i.id is null then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  if i.estado <> 'AGUARDANDO' then perform recusar_motivo('Este item já foi aberto', 'ITEM_JA_ABERTO'); end if;
  if exists (select 1 from itens_assembleia where assembleia_id = p_id and estado = 'ABERTO') then
    perform recusar_motivo('Feche o item aberto antes de abrir outro', 'OUTRO_ITEM_ABERTO');
  end if;
  update itens_assembleia set estado = 'ABERTO', aberto_em = app_now() where id = p_item returning * into i;
  perform registrar_historico('assembleia.item_aberto', 'assembleias', p_id::text, jsonb_build_object('item', i.ordem, 'titulo', i.titulo));
  return item_json(i);
end $$;

create function plataforma_encerrar_item(p_pessoa uuid, p_condominio uuid, p_id uuid, p_item uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  i itens_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_em_andamento(p_id);
  select * into i from itens_assembleia where id = p_item and assembleia_id = p_id;
  if i.id is null then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  if i.estado <> 'ABERTO' then perform recusar_motivo('Este item não está em votação', 'ITEM_FECHADO'); end if;
  return item_json(fechar_item(i));
end $$;

-- Presença no salão (ou tirar a presença marcada por engano), pelo síndico ou secretário.
create function plataforma_presenca_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid, p_presente boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_em_andamento(p_id);
  select * into c from convites_assembleia where id = p_convite and assembleia_id = p_id;
  if c.id is null then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
  if p_presente then
    perform marcar_presenca(c, 'SALAO', p_pessoa);
  else
    if exists (select 1 from votos_assembleia where convite_id = c.id) then
      perform recusar_motivo('A unidade já votou: a presença fica', 'JA_VOTOU');
    end if;
    update convites_assembleia set presente_em = null, presenca_forma = null, presenca_por = null where id = c.id;
  end if;
  perform registrar_historico(case when p_presente then 'assembleia.presenca' else 'assembleia.presenca_retirada' end, 'assembleias', p_id::text,
    jsonb_build_object('unidade', rotulo_unidade(c.unidade_id)));
  return jsonb_build_object('ok', true);
end $$;

-- Sem direito a voto, com motivo (decisão 11). Antes de começar ou durante, sem voto dado.
create function plataforma_direito_voto(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid, p_sem_direito boolean, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado not in ('CONVOCADA', 'EM_ANDAMENTO') then perform recusar_motivo('A assembleia não está aberta', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  select * into c from convites_assembleia where id = p_convite and assembleia_id = p_id;
  if c.id is null then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
  if p_sem_direito and length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Escreva o motivo', 'motivo'); end if;
  if p_sem_direito and exists (select 1 from votos_assembleia where convite_id = c.id) then
    perform recusar_motivo('A unidade já votou', 'JA_VOTOU');
  end if;
  update convites_assembleia set sem_direito = p_sem_direito, motivo_sem_direito = case when p_sem_direito then btrim(p_motivo) end where id = c.id;
  perform registrar_historico(case when p_sem_direito then 'assembleia.sem_direito' else 'assembleia.direito_devolvido' end, 'assembleias', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('unidade', rotulo_unidade(c.unidade_id), 'motivo', case when p_sem_direito then btrim(p_motivo) end)));
  return jsonb_build_object('ok', true);
end $$;

-- Aceitar ou recusar a procuração, conferido o documento (regra 3).
create function plataforma_procuracao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid, p_aceitar boolean, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado not in ('CONVOCADA', 'EM_ANDAMENTO') then perform recusar_motivo('A assembleia não está aberta', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  select * into c from convites_assembleia where id = p_convite and assembleia_id = p_id;
  if c.id is null then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
  if c.procuracao_estado is distinct from 'PENDENTE' then perform recusar_motivo('Não há procuração esperando', 'PROCURACAO_DECIDIDA'); end if;
  if not p_aceitar and length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Escreva o motivo', 'motivo'); end if;
  if p_aceitar and exists (select 1 from votos_assembleia where convite_id = c.id) then
    perform recusar_motivo('A unidade já votou', 'JA_VOTOU');
  end if;
  update convites_assembleia set procuracao_estado = case when p_aceitar then 'ACEITA' else 'RECUSADA' end,
                                 procuracao_motivo = case when p_aceitar then null else btrim(p_motivo) end,
                                 procuracao_decidida_em = app_now(), procuracao_decidida_por = p_pessoa
   where id = c.id;
  perform registrar_historico(case when p_aceitar then 'assembleia.procuracao_aceita' else 'assembleia.procuracao_recusada' end,
    'assembleias', p_id::text, jsonb_strip_nulls(jsonb_build_object('unidade', rotulo_unidade(c.unidade_id), 'procurador', c.procurador_nome,
      'motivo', case when not p_aceitar then btrim(p_motivo) end)));
  return jsonb_build_object('ok', true);
end $$;

-- O secretário registra o voto de quem está no salão e não usa o link (decisão 12).
create function plataforma_registrar_voto(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid, p_item uuid, p_opcao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
  i itens_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_em_andamento(p_id);
  select * into c from convites_assembleia where id = p_convite and assembleia_id = p_id;
  select * into i from itens_assembleia where id = p_item and assembleia_id = p_id;
  if c.id is null or i.id is null then raise exception 'Não encontrado' using errcode = 'TC404'; end if;
  if i.estado <> 'ABERTO' then perform recusar_motivo('Este item não está em votação', 'ITEM_FECHADO'); end if;
  if p_opcao is null or p_opcao not between 1 and cardinality(i.opcoes) then perform recusar_campos('Escolha uma opção', 'opcao'); end if;
  perform marcar_presenca(c, 'SALAO', p_pessoa);
  perform gravar_voto(i, c, p_opcao, null, p_pessoa);
  return item_json(i);
end $$;

-- O rascunho da ata: presença e o resultado de cada item, com os números guardados (regra 6).
create function rascunho_ata(a assembleias) returns text
language sql stable
set search_path = public
as $$
  select 'Ata da ' || nome_da_assembleia(a) || ' do ' || nome_do_condominio() || ', realizada em '
      || chamada_por_extenso(coalesce(a.iniciada_em, a.primeira_chamada)) || ', '
      || case a.forma when 'PRESENCIAL' then 'de forma presencial' when 'ONLINE' then 'de forma online' else 'de forma presencial e online' end
      || coalesce(' (' || a.local || ')', '') || E'.\n\nPresidente: \nSecretário: \n\n'
      || (select 'Presentes: ' || count(*) filter (where c.presente_em is not null) || ' de ' || count(*) || ' unidades ('
                 || count(*) filter (where c.presenca_forma = 'ONLINE') || ' online, ' || count(*) filter (where c.presenca_forma = 'SALAO')
                 || ' no salão, ' || count(*) filter (where c.procuracao_estado = 'ACEITA') || ' por procuração), '
                 || replace(to_char(case when sum(c.peso) > 0 then 100 * coalesce(sum(c.peso) filter (where c.presente_em is not null), 0) / sum(c.peso) else 0 end, 'FM990.0'), '.', ',')
                 || case when a.peso = 'FRACAO' then '% das frações ideais.' else '% das unidades.' end
            from convites_assembleia c where c.assembleia_id = a.id)
      || E'\n\nDeliberações:\n'
      || coalesce((select string_agg(i.ordem || '. ' || i.titulo || ': '
                     || case when i.estado <> 'ENCERRADO' then 'não votado'
                             else case i.resultado ->> 'situacao' when 'APROVADO' then 'aprovado' when 'REPROVADO' then 'não aprovado'
                                    when 'ESCOLHIDA' then 'escolhida a opção ' || (i.resultado ->> 'vencedor') when 'EMPATE' then 'empate'
                                    when 'SEM_QUORUM' then 'sem quórum' else 'sem votos' end
                                  || ' (' || (select string_agg((o ->> 'texto') || ' ' || (o ->> 'votos'), ', ' order by k)
                                                from jsonb_array_elements(i.resultado -> 'opcoes') with ordinality t(o, k)) || ')' end,
                     E'\n' order by i.ordem) from itens_assembleia i where i.assembleia_id = a.id), '')
      || E'\n\nRegistros da assembleia:\n'
$$;

-- Encerra: fecha o item que ficou aberto e monta o rascunho da ata (regra 6).
create function plataforma_encerrar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  i itens_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_em_andamento(p_id);
  if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  for i in select * from itens_assembleia where assembleia_id = p_id and estado = 'ABERTO' loop
    perform fechar_item(i);
  end loop;
  update assembleias set estado = 'ENCERRADA', encerrada_em = app_now(), encerrada_por = p_pessoa, atualizado_em = app_now(),
                         ata_texto = coalesce(ata_texto, rascunho_ata(a))
   where id = p_id returning * into a;
  perform registrar_historico('assembleia.encerrada', 'assembleias', a.id::text, jsonb_build_object(
    'presentes', (select count(*) from convites_assembleia where assembleia_id = a.id and presente_em is not null),
    'votados', (select count(*) from itens_assembleia where assembleia_id = a.id and estado = 'ENCERRADO')));
  return jsonb_build_object('versao', a.versao);
end $$;

-- O texto da ata (o que o presidente registra). Os números vêm dos itens e não mudam.
create function plataforma_ata_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_texto text, p_documento uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a assembleias;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado <> 'ENCERRADA' then perform recusar_motivo('A ata é feita depois de encerrar a assembleia', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  if a.versao <> p_versao then perform conflito_versao('assembleias', p_id); end if;
  if length(coalesce(p_texto, '')) > 20000 then perform recusar_campos('O texto passa de 20 mil letras', 'texto'); end if;
  if p_documento is not null and not exists (select 1 from documentos where id = p_documento and tipo = 'ATA') then
    perform recusar_campos('Escolha uma ata de Documentos', 'documentoId');
  end if;
  update assembleias set ata_texto = coalesce(p_texto, ata_texto), ata_documento_id = coalesce(p_documento, ata_documento_id), atualizado_em = app_now()
   where id = p_id returning * into a;
  if p_documento is not null then
    perform registrar_historico('assembleia.ata_ligada', 'assembleias', a.id::text,
      jsonb_build_object('documento', (select titulo from documentos where id = p_documento)));
  end if;
  return jsonb_build_object('versao', a.versao);
end $$;

-- Um link para mandar por outro meio (unidade sem WhatsApp nem e-mail, ou procurador de fora).
create function plataforma_link_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'assembleias.editar');
  a := exigir_assembleia(p_id);
  if a.estado not in ('CONVOCADA', 'EM_ANDAMENTO') then perform recusar_motivo('A assembleia não está aberta', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  select * into c from convites_assembleia where id = p_convite and assembleia_id = p_id;
  if c.id is null then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
  perform registrar_historico('assembleia.link_gerado', 'assembleias', p_id::text, jsonb_build_object('unidade', rotulo_unidade(c.unidade_id)));
  return jsonb_build_object('codigo', gerar_codigo_sem_conta('ASSEMBLEIA', c.id));
end $$;

-- Regras da convenção (Configurações).
create function plataforma_regras_assembleia(p_pessoa uuid, p_condominio uuid, p_versao integer, p_antecedencia integer, p_peso text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cfg configuracao_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_antecedencia is null or p_antecedencia not between 1 and 60 then perform recusar_campos('De 1 a 60 dias', 'antecedencia'); end if;
  if p_peso is null or p_peso not in ('FRACAO', 'UNIDADE') then perform recusar_campos('Escolha o peso do voto', 'peso'); end if;
  select * into cfg from configuracao_condominio;
  if cfg.versao <> p_versao then perform conflito_versao('configuracao_condominio', cfg.id); end if;
  update configuracao_condominio set assembleia_antecedencia = p_antecedencia, assembleia_peso = p_peso where id = cfg.id returning * into cfg;
  perform registrar_historico('config.assembleias', 'configuracao_condominio', cfg.id::text,
    jsonb_build_object('antecedencia', p_antecedencia, 'peso', p_peso));
  return jsonb_build_object('versao', cfg.versao);
end $$;

-- A fração ideal das unidades, de uma vez (decisão 9).
create function plataforma_fracoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  return jsonb_build_object(
    'unidades', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id), 'fracao', u.fracao_ideal,
                                                                                'versao', u.versao))
                                           order by chave_unidade(rotulo_unidade(u.id)))
                            from unidades u where u.ativa), '[]'::jsonb),
    'soma', (select coalesce(sum(fracao_ideal), 0) from unidades where ativa),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'moradores.editar')));
end $$;

create function plataforma_salvar_fracoes(p_pessoa uuid, p_condominio uuid, p_fracoes jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x jsonb;
  u unidades;
  v_fracao numeric;
  v_n integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  if jsonb_typeof(p_fracoes) is distinct from 'array' or jsonb_array_length(p_fracoes) > 2000 then perform recusar_campos('Lista inválida', 'fracoes'); end if;
  for x in select * from jsonb_array_elements(p_fracoes) loop
    select * into u from unidades where id = (x ->> 'unidadeId')::uuid and ativa;
    if u.id is null then raise exception 'Unidade não encontrada' using errcode = 'TC404'; end if;
    v_fracao := (x ->> 'fracao')::numeric;
    if v_fracao is not null and (v_fracao <= 0 or v_fracao > 100) then perform recusar_campos('A fração vai de 0 a 100%', 'fracoes'); end if;
    if u.versao <> (x ->> 'versao')::integer then perform conflito_versao('unidades', u.id); end if;
    if u.fracao_ideal is distinct from v_fracao then
      update unidades set fracao_ideal = v_fracao where id = u.id;
      v_n := v_n + 1;
    end if;
  end loop;
  if v_n > 0 then
    perform registrar_historico('unidades.fracoes', 'condominios', p_condominio::text, jsonb_build_object('alteradas', v_n,
      'soma', (select coalesce(sum(fracao_ideal), 0) from unidades where ativa)));
  end if;
  return jsonb_build_object('alteradas', v_n, 'soma', (select coalesce(sum(fracao_ideal), 0) from unidades where ativa));
end $$;

-- ---------------------------------------------------------------------------------------
-- O link pessoal da assembleia (decisões 8 e 12).

create function exigir_convite_assembleia(p_codigo text) returns convites_assembleia
language plpgsql
set search_path = public
as $$
declare
  l codigos_sem_conta;
  c convites_assembleia;
begin
  l := entrar_por_codigo(upper(btrim(coalesce(p_codigo, ''))), 'ASSEMBLEIA');
  select * into c from convites_assembleia where id = l.alvo_id;
  if c.id is null or l.revogado_em is not null then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  return c;
end $$;

create function assembleia_publica_json(c convites_assembleia) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'condominio', nome_do_condominio(), 'titulo', a.titulo, 'tipo', a.tipo, 'forma', a.forma, 'estado', a.estado,
    'primeiraChamada', a.primeira_chamada, 'segundaChamada', a.segunda_chamada, 'local', a.local,
    'linkVideo', case when a.estado in ('CONVOCADA', 'EM_ANDAMENTO') then a.link_video end,
    'peso', a.peso, 'motivoCancelamento', a.motivo_cancelamento,
    'unidade', rotulo_unidade(c.unidade_id),
    'proprietarios', (select string_agg(p.nome, ', ' order by p.nome) from proprietarios_da_unidade(c.unidade_id) p),
    'semDireito', c.sem_direito,
    'procuracao', case when c.procuracao_estado is not null then jsonb_build_object(
      'estado', c.procuracao_estado, 'nome', c.procurador_nome, 'motivo', c.procuracao_motivo,
      'unidade', (select rotulo_unidade(x.unidade_id) from convites_assembleia x where x.id = c.procurador_convite_id)) end,
    'representa', (select jsonb_agg(rotulo_unidade(x.unidade_id) order by chave_unidade(rotulo_unidade(x.unidade_id)))
                     from convites_assembleia x where x.procurador_convite_id = c.id and x.procuracao_estado = 'ACEITA'),
    'outrasUnidades', case when a.estado = 'CONVOCADA' and c.procuracao_estado is distinct from 'ACEITA' then (
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', rotulo_unidade(x.unidade_id)) order by chave_unidade(rotulo_unidade(x.unidade_id)))
        from convites_assembleia x where x.assembleia_id = a.id and x.id <> c.id) end,
    'presenteEm', c.presente_em,
    'itens', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', i.id, 'ordem', i.ordem, 'titulo', i.titulo, 'descricao', i.descricao, 'opcoes', to_jsonb(i.opcoes), 'estado', i.estado,
                'quorum', i.quorum,
                'meuVoto', (select v.opcao from votos_assembleia v where v.item_id = i.id and v.convite_id = c.id),
                'resultado', case when i.estado = 'ENCERRADO' then i.resultado end)) order by i.ordem)
                from itens_assembleia i where i.assembleia_id = a.id)))
    from assembleias a where a.id = c.assembleia_id
$$;

-- Abrir o link durante a assembleia registra a presença online da unidade e das que ela representa.
create function publico_assembleia(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c convites_assembleia;
  a assembleias;
  r convites_assembleia;
begin
  c := exigir_convite_assembleia(p_codigo);
  select * into a from assembleias where id = c.assembleia_id;
  if a.estado = 'EM_ANDAMENTO' then
    for r in select * from representados(c) loop perform marcar_presenca(r, 'ONLINE', null); end loop;
    select * into c from convites_assembleia where id = c.id;
  end if;
  return assembleia_publica_json(c);
end $$;

-- O voto pelo link vale para a unidade e para as que ela representa.
create function publico_votar_assembleia(p_codigo text, p_item uuid, p_opcao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c convites_assembleia;
  a assembleias;
  i itens_assembleia;
  r convites_assembleia;
  v_n integer := 0;
begin
  c := exigir_convite_assembleia(p_codigo);
  select * into a from assembleias where id = c.assembleia_id;
  if a.estado <> 'EM_ANDAMENTO' then perform recusar_motivo('A votação só abre durante a assembleia', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  select * into i from itens_assembleia where id = p_item and assembleia_id = a.id for update;
  if i.id is null then raise exception 'Item não encontrado' using errcode = 'TC404'; end if;
  if i.estado <> 'ABERTO' then perform recusar_motivo('Este item não está em votação', 'ITEM_FECHADO'); end if;
  if p_opcao is null or p_opcao not between 1 and cardinality(i.opcoes) then perform recusar_campos('Escolha uma opção', 'opcao'); end if;
  for r in select * from representados(c) where not sem_direito loop
    perform marcar_presenca(r, 'ONLINE', null);
    perform gravar_voto(i, r, p_opcao, c.id, null);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then
    perform recusar_motivo(case when c.sem_direito then 'Esta unidade está sem direito a voto nesta assembleia'
                                else 'O voto desta unidade está com o procurador' end, 'SEM_DIREITO_A_VOTO');
  end if;
  select * into c from convites_assembleia where id = c.id;
  return assembleia_publica_json(c);
end $$;

-- Antes da assembleia, o proprietário indica quem vota pela unidade (regra 3).
create function publico_procuracao_assembleia(p_codigo text, p_nome text, p_unidade_procurador uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c convites_assembleia;
  a assembleias;
  v_procurador convites_assembleia;
begin
  c := exigir_convite_assembleia(p_codigo);
  select * into a from assembleias where id = c.assembleia_id;
  if a.estado <> 'CONVOCADA' then perform recusar_motivo('A procuração é indicada até a 1ª chamada', 'ASSEMBLEIA_FORA_DE_HORA'); end if;
  if c.procuracao_estado = 'ACEITA' then perform recusar_motivo('A procuração já foi aceita pelo síndico', 'PROCURACAO_DECIDIDA'); end if;
  if p_nome is null then
    update convites_assembleia set procurador_nome = null, procurador_convite_id = null, procuracao_estado = null, procuracao_em = null,
                                   procuracao_motivo = null, procuracao_decidida_em = null, procuracao_decidida_por = null
     where id = c.id returning * into c;
    perform registrar_historico('assembleia.procuracao_retirada', 'assembleias', a.id::text, jsonb_build_object('unidade', rotulo_unidade(c.unidade_id)));
    return assembleia_publica_json(c);
  end if;
  if length(btrim(p_nome)) not between 3 and 120 then perform recusar_campos('Escreva o nome do procurador', 'nome'); end if;
  if p_unidade_procurador is not null then
    select * into v_procurador from convites_assembleia where assembleia_id = a.id and id = p_unidade_procurador and id <> c.id;
    if v_procurador.id is null then perform recusar_campos('Escolha outra unidade desta assembleia', 'unidadeId'); end if;
    if v_procurador.procurador_convite_id is not null and v_procurador.procuracao_estado = 'ACEITA' then
      perform recusar_campos('Essa unidade passou o próprio voto a outra', 'unidadeId');
    end if;
  end if;
  update convites_assembleia set procurador_nome = btrim(p_nome), procurador_convite_id = v_procurador.id, procuracao_estado = 'PENDENTE',
                                 procuracao_em = app_now(), procuracao_motivo = null, procuracao_decidida_em = null, procuracao_decidida_por = null
   where id = c.id returning * into c;
  perform registrar_historico('assembleia.procuracao_indicada', 'assembleias', a.id::text,
    jsonb_strip_nulls(jsonb_build_object('unidade', rotulo_unidade(c.unidade_id), 'procurador', c.procurador_nome,
                                         'unidadeProcurador', rotulo_unidade(v_procurador.unidade_id))));
  return assembleia_publica_json(c);
end $$;

-- ---------------------------------------------------------------------------------------
-- Rotina: o lembrete na véspera (regra 2).

create function verificar_assembleias() returns integer
language plpgsql
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
  v_n integer := 0;
begin
  for a in select * from assembleias where estado = 'CONVOCADA' and lembrete_enviado_em is null
                                       and primeira_chamada - interval '1 day' <= app_now() and primeira_chamada > app_now()
                                       for update skip locked loop
    for c in select * from convites_assembleia where assembleia_id = a.id loop
      v_n := v_n + enviar_convite_assembleia(a, c, true, a.convocada_por);
    end loop;
    update assembleias set lembrete_enviado_em = app_now() where id = a.id;
    perform registrar_historico('assembleia.lembrete', 'assembleias', a.id::text, '{}');
  end loop;
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
      v_total := v_total + publicar_programados() + avisar_documentos() + avisar_prontuario() + verificar_enquetes() + verificar_assembleias();
    exception when others then
      raise warning 'Comunicados do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------
-- Envios: o código entra só na hora de enviar.

alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_r12b;
alter function pegar_lote_whatsapp_r12b(integer) security invoker;

create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  l jsonb;
  x jsonb;
  v_envios jsonb;
  v_convite uuid;
begin
  -- Sem pessoa nem condomínio na sessão, só o verificador enxerga todos os condomínios. Fica
  -- ligado também durante a parte da enquete (0230), que percorre os condomínios do mesmo jeito.
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    update envios_whatsapp w set estado = 'CANCELADA', motivo = case
             when a.estado = 'CANCELADA' then 'A assembleia foi cancelada'
             when a.estado = 'ENCERRADA' then 'A assembleia já terminou'
             else 'A pessoa pediu para parar de receber avisos' end
      from convites_assembleia c, assembleias a
     where w.estado = 'NA_FILA' and w.finalidade = 'ASSEMBLEIA' and c.id = w.convite_assembleia_id and a.id = c.assembleia_id
       and (a.estado in ('CANCELADA', 'ENCERRADA')
            or exists (select 1 from contatos ct where ct.id = w.contato_id and ct.whatsapp_parou_em is not null));
  end loop;
  perform entrar_como_sistema(null);
  v_lotes := pegar_lote_whatsapp_r12b(p_max);
  perform set_config('app.verificador', '', true);
  for l in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((l ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(l -> 'envios') loop
      select convite_assembleia_id into v_convite from envios_whatsapp where id = (x ->> 'envio')::uuid;
      v_envios := v_envios || jsonb_build_array(case when v_convite is not null
                                                     then x || jsonb_build_object('link', gerar_codigo_sem_conta('ASSEMBLEIA', v_convite), 'rota', 'a')
                                                     else x end);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(l, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

alter function montar_email(envios_email) rename to montar_email_r12;
alter function montar_email_r12(envios_email) security invoker;

create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  ct contatos;
  c convites_assembleia;
  a assembleias;
  v_cancelar text;
begin
  if e.tipo <> 'ASSEMBLEIA' then return montar_email_r12(e); end if;
  select * into cfg from configuracao_condominio;
  select * into ct from contatos where id = e.contato_id;
  select * into c from convites_assembleia where id = e.convite_assembleia_id;
  select * into a from assembleias where id = c.assembleia_id;
  v_cancelar := case
    when not cfg.email_ligado then 'O envio por e-mail foi desligado'
    when ct.id is null or not recebe_por_email(ct) or lower(ct.email) <> lower(e.para) then 'O contato não recebe mais por e-mail'
    when a.estado = 'CANCELADA' then 'A assembleia foi cancelada'
    when a.estado = 'ENCERRADA' then 'A assembleia já terminou' end;
  if v_cancelar is not null then
    update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
    return null;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', cfg.email_responder_para, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id),
    'codigos', jsonb_build_object('votar', gerar_codigo_sem_conta('ASSEMBLEIA', c.id),
                                  'parar', criar_link('PARAR_EMAIL', ct.id, ct.id, e.id, ct.email, interval '1 year')),
    'assembleia', jsonb_build_object('titulo', a.titulo, 'nome', nome_da_assembleia(a), 'chamada', chamada_por_extenso(a.primeira_chamada),
                                     'dono', 'da ' || rotulo_unidade(c.unidade_id), 'lembrete', e.lembrete)));
end $$;

-- ---------------------------------------------------------------------------------------
-- Memória do prédio: a assembleia realizada entra na linha do tempo (regra 6).

alter function eventos_memoria(uuid) rename to eventos_memoria_r10;

create function eventos_memoria(p_pessoa uuid) returns table (data date, momento timestamptz, categoria text, evento jsonb)
language plpgsql stable
set search_path = public
as $$
begin
  return query select * from eventos_memoria_r10(p_pessoa);
  if pode(p_pessoa, contexto_condominio(), 'comunicados.ver') or pode(p_pessoa, contexto_condominio(), 'assembleias.ver') then
    return query
      select data_no_condominio(a.encerrada_em), a.encerrada_em, 'COMUNICADOS'::text,
             jsonb_strip_nulls(jsonb_build_object('fonte', 'ASSEMBLEIA', 'id', a.id, 'titulo', 'Assembleia realizada: ' || a.titulo,
               'detalhe', (select count(*) filter (where presente_em is not null) || ' de ' || count(*) || ' unidades presentes'
                             from convites_assembleia c where c.assembleia_id = a.id)
                          || ' · ' || (select count(*) from itens_assembleia i where i.assembleia_id = a.id and i.estado = 'ENCERRADO') || ' itens votados',
               'documentoId', a.ata_documento_id))
        from assembleias a where a.estado = 'ENCERRADA';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Painel: a próxima assembleia e as procurações a conferir.

create function resumo_assembleias() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'proxima', (select jsonb_build_object('id', a.id, 'titulo', a.titulo, 'estado', a.estado, 'primeiraChamada', a.primeira_chamada,
                                          'procuracoesPendentes', (select count(*) from convites_assembleia c
                                                                    where c.assembleia_id = a.id and c.procuracao_estado = 'PENDENTE'))
                  from assembleias a where a.estado in ('CONVOCADA', 'EM_ANDAMENTO') order by a.primeira_chamada limit 1)))
$$;

alter function plataforma_painel(uuid, uuid) rename to painel_r12_enquetes;
alter function painel_r12_enquetes(uuid, uuid) security invoker;

create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  r jsonb;
begin
  v := painel_r12_enquetes(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'assembleias.ver') then
    r := resumo_assembleias();
    if r ? 'proxima' then
      v := v || jsonb_build_object('vida', coalesce(v -> 'vida', jsonb_build_object('reservasAAprovar', 0, 'proximasAAprovar', '[]'::jsonb))
                                           || jsonb_build_object('assembleia', r -> 'proxima'));
    end if;
  end if;
  return v;
end $$;

call fechar_acesso();

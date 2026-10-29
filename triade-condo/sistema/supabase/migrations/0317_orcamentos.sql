-- 0317 · Orçamentos e compras (peça R8): pedir propostas a fornecedores por link sem conta (OC-03),
-- comparar escopo e não só preço (OC-02), decidir com o motivo escrito (OC-06), regras por faixa de
-- valor (OC-05), acompanhar a compra e a entrega (OC-01), a planilha (OC-07) e o prestador que nasce
-- da cotação (OC-10). Plano técnico aprovado pela Carol em 28/10/2026, quadros 470 a 486. Modelo: a
-- 0303 (links com código, despesas, anexos, avisos e retenção). Nesta rodada só o tipo SERVICO; a
-- lista de itens (OC-08) fica para a segunda rodada.
--
-- Regras desta parte:
-- 1. A TRÍADE não escolhe fornecedor nem compra (V-17, OC-01): aprovar não é contratar, receber nem
--    pagar. O que fica aqui é o pedido, as propostas, a escolha com o motivo, a compra e a entrega.
-- 2. O orçamento nasce em RASCUNHO ou já PEDINDO (mandar os convites). O prazo das propostas fecha
--    na leitura (PEDINDO → COMPARANDO) ou pelo "Fechar antes"; estender volta a PEDINDO. Escolher
--    leva a ESCOLHIDA; a escolha se desfaz enquanto não aprovada nem aceita. Aprovada (quando houve
--    despesa) e aceita pelo fornecedor (pelo link ou "aceitou fora do link"), vai a COMPRANDO;
--    registrar a entrega leva a ENTREGUE (parcial fica COMPRANDO). Qualquer aberto cancela com
--    motivo; nada se apaga.
-- 3. Cada convite tem um link só dele (codigos_sem_conta, tipo ORCAMENTO; só o hash fica). O código
--    aparece uma vez; mandar de novo gera outro e o anterior para. Revogar para na hora e guarda a
--    proposta já recebida. O fornecedor nunca vê os outros convidados nem os outros preços.
-- 4. A proposta tem versões (1, 2, 3…): só a última está em uso e nenhuma se apaga (OC-04). Vencida é
--    a que passou da validade; só se escolhe depois que o fornecedor confirma o preço pelo link.
-- 5. Regras do condomínio (OC-05): faixas por valor estimado com o mínimo de propostas e quem aprova;
--    abaixo do mínimo, pede motivo ou bloqueia. A alçada do conselho é conselho_alcada (a mesma de
--    Decisões) e só avisa. Quem aprova pelo conselho vira uma despesa para aprovar (R5), ligada ao
--    orçamento: aprovada marca aprovada_em; recusada ou retirada devolve a COMPARANDO.
-- 6. O motivo da escolha é obrigatório quando não é a de menor total ou quando se decide abaixo do
--    mínimo. Vai para quem aprova, para a planilha e para o resumo aos moradores.
-- 7. O fornecedor sem cadastro que aceita vira prestador (acordo CHAMADO) com a origem guardada (OC-10).
-- 8. Avisos no sino de quem cuida: proposta recebida, recusa, prazo fechou, preço confirmado, aceite,
--    5 dias sem aceite e a resposta de quem aprova.

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê (CF-03).

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'orcamentos.ver'), ('SINDICO', 'orcamentos.editar'), ('SINDICO', 'orcamentos.decidir');
insert into permissao_acoes (permissao, acao) values
  ('APROVAR', 'orcamentos.ver'), ('APROVAR', 'orcamentos.editar'), ('APROVAR', 'orcamentos.decidir'),
  ('ATUALIZAR', 'orcamentos.ver'), ('ATUALIZAR', 'orcamentos.editar'),
  ('VER_MANUTENCAO', 'orcamentos.ver');

-- ---------------------------------------------------------------------------------------
-- Regras (regra 5).

alter table configuracao_condominio
  add column orcamento_regra_ligada   boolean not null default false,
  add column orcamento_abaixo_minimo  text not null default 'MOTIVO' check (orcamento_abaixo_minimo in ('MOTIVO', 'BLOQUEIA')),
  add column orcamento_prazo_dias     smallint not null default 7 check (orcamento_prazo_dias between 1 and 30),
  add column orcamento_validade_dias  smallint not null default 15 check (orcamento_validade_dias between 1 and 180),
  add column orcamento_link_dias      smallint not null default 30 check (orcamento_link_dias between 1 and 60);

create table faixas_orcamento (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  ordem         smallint not null check (ordem between 1 and 6),
  ate           centavos check (ate > 0),
  minimo        smallint not null check (minimo between 1 and 10),
  quem_aprova   text not null check (quem_aprova in ('SINDICO', 'CONSELHO')),
  criada_em     timestamptz not null default app_now(),
  criada_por    uuid not null references pessoas (id),
  retirada_em   timestamptz,
  unique (id, condominio_id)
);
create unique index faixas_orcamento_ordem on faixas_orcamento (condominio_id, ordem) where retirada_em is null;
call proteger_tabela_condominio('faixas_orcamento');
create trigger faixas_orcamento_sem_exclusao before delete on faixas_orcamento for each row execute function somente_insercao();

create function faixas_orcamento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.retirada_em is not null
     or (new.condominio_id, new.ordem, new.ate, new.minimo, new.quem_aprova, new.criada_em, new.criada_por)
        is distinct from (old.condominio_id, old.ordem, old.ate, old.minimo, old.quem_aprova, old.criada_em, old.criada_por) then
    raise exception 'A faixa só se retira' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger faixas_orcamento_regras before update on faixas_orcamento for each row execute function faixas_orcamento_regras();

-- ---------------------------------------------------------------------------------------
-- O orçamento (regra 2).

create table orcamentos (
  id                     uuid primary key default gen_random_uuid(),
  condominio_id          uuid not null references condominios (id) on delete restrict,
  titulo                 text not null check (length(btrim(titulo)) between 3 and 120),
  descricao              text not null check (length(btrim(descricao)) between 3 and 2000),
  local                  text check (length(btrim(local)) between 2 and 120),
  tipo                   text not null default 'SERVICO' check (tipo in ('SERVICO', 'ITENS')),
  manutencao_id          uuid,
  pedido_id              uuid,
  valor_estimado         centavos check (valor_estimado > 0),
  prazo_propostas        timestamptz not null,
  validade_minima_dias   smallint not null check (validade_minima_dias between 1 and 180),
  cuidador_id            uuid not null references pessoas (id),
  estado                 text not null check (estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO', 'ENTREGUE', 'CANCELADO')),
  proposta_escolhida_id  uuid,
  motivo_escolha         text check (length(btrim(motivo_escolha)) between 3 and 1000),
  escolhida_em           timestamptz,
  escolhida_por          uuid references pessoas (id),
  quem_aprova            text check (quem_aprova in ('PESSOA', 'CONSELHO')),
  despesa_id             uuid,
  aprovada_em            timestamptz,
  comprada_em            date,
  valor_fechado          centavos check (valor_fechado > 0),
  nota_fiscal_arquivo_id uuid,
  entregue_em            date,
  entrega_parcial        boolean not null default false,
  entrega_obs            text check (length(btrim(entrega_obs)) between 1 and 500),
  cancelado_em           timestamptz,
  cancelado_por          uuid references pessoas (id),
  cancelado_motivo       text check (length(btrim(cancelado_motivo)) between 3 and 500),
  editado_em             timestamptz,
  fechamento_visto_em    timestamptz,
  criado_em              timestamptz not null default app_now(),
  criado_por             uuid not null references pessoas (id),
  versao                 integer not null default 1,
  unique (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (despesa_id, condominio_id) references despesas_aprovacao (id, condominio_id),
  check (num_nonnulls(manutencao_id, pedido_id) <= 1),
  check ((proposta_escolhida_id is null) = (escolhida_em is null) and (escolhida_em is null) = (escolhida_por is null)
         and (escolhida_em is null) = (quem_aprova is null)),
  check (despesa_id is null or quem_aprova = 'CONSELHO'),
  check (estado not in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE') or proposta_escolhida_id is not null),
  check ((comprada_em is null) = (valor_fechado is null)),
  check (estado <> 'ENTREGUE' or entregue_em is not null),
  check ((estado = 'CANCELADO') = (cancelado_em is not null) and (cancelado_em is null) = (cancelado_motivo is null)
         and (cancelado_em is null) = (cancelado_por is null))
);
create index orcamentos_abertos on orcamentos (condominio_id, prazo_propostas) where estado in ('PEDINDO', 'COMPARANDO', 'ESCOLHIDA');
call proteger_tabela_condominio('orcamentos');
call ligar_guardiao('orcamentos');
insert into estados_iniciais (tabela, estado) values ('orcamentos', 'RASCUNHO'), ('orcamentos', 'PEDINDO');
insert into transicoes_permitidas (tabela, de, para) values
  ('orcamentos', 'RASCUNHO', 'PEDINDO'),
  ('orcamentos', 'PEDINDO', 'COMPARANDO'),
  ('orcamentos', 'COMPARANDO', 'PEDINDO'),
  ('orcamentos', 'COMPARANDO', 'ESCOLHIDA'),
  ('orcamentos', 'ESCOLHIDA', 'COMPARANDO'),
  ('orcamentos', 'ESCOLHIDA', 'COMPRANDO'),
  ('orcamentos', 'COMPRANDO', 'ENTREGUE'),
  ('orcamentos', 'RASCUNHO', 'CANCELADO'),
  ('orcamentos', 'PEDINDO', 'CANCELADO'),
  ('orcamentos', 'COMPARANDO', 'CANCELADO'),
  ('orcamentos', 'ESCOLHIDA', 'CANCELADO'),
  ('orcamentos', 'COMPRANDO', 'CANCELADO');
create trigger orcamentos_sem_exclusao before delete on orcamentos for each row execute function somente_insercao();

-- Cancelado e entregue não mudam mais (só a nota fiscal chega depois); a origem não muda.
create function orcamentos_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.tipo, new.manutencao_id, new.pedido_id, new.criado_em, new.criado_por)
     is distinct from (old.condominio_id, old.tipo, old.manutencao_id, old.pedido_id, old.criado_em, old.criado_por) then
    raise exception 'O orçamento não muda de origem' using errcode = 'TC422';
  end if;
  if old.estado = 'CANCELADO' then
    raise exception 'Orçamento cancelado não muda' using errcode = 'TC422';
  end if;
  if old.estado = 'ENTREGUE' and (new.estado, new.titulo, new.descricao, new.proposta_escolhida_id, new.comprada_em, new.valor_fechado, new.entregue_em)
     is distinct from (old.estado, old.titulo, old.descricao, old.proposta_escolhida_id, old.comprada_em, old.valor_fechado, old.entregue_em) then
    raise exception 'Orçamento entregue não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger orcamentos_regras before update on orcamentos for each row execute function orcamentos_regras();

-- ---------------------------------------------------------------------------------------
-- Os convites (regra 3).

create table convites_orcamento (
  id                   uuid primary key default gen_random_uuid(),
  condominio_id        uuid not null references condominios (id) on delete restrict,
  orcamento_id         uuid not null,
  prestador_id         uuid,
  ordem                smallint not null check (ordem between 1 and 20),
  nome                 text not null check (length(btrim(nome)) between 2 and 120),
  celular              text check (celular ~ '^\+?[0-9]{10,15}$'),
  email                text check (email_valido(email)),
  canal                text not null check (canal in ('WHATSAPP', 'EMAIL')),
  estado               text not null default 'CONVIDADO' check (estado in ('CONVIDADO', 'RECUSOU', 'RESPONDEU', 'REVOGADO')),
  recusa_motivo        text check (length(btrim(recusa_motivo)) between 1 and 500),
  recusou_em           timestamptz,
  aberturas            integer not null default 0 check (aberturas >= 0),
  ultima_abertura_em   timestamptz,
  mandado_em           timestamptz,
  codigo_em            timestamptz,
  expira_em            timestamptz not null,
  revogado_em          timestamptz,
  revogado_por         uuid references pessoas (id),
  revogado_motivo      text check (length(btrim(revogado_motivo)) between 3 and 500),
  escolhido            boolean not null default false,
  aceite_em            timestamptz,
  aceite_nome          text check (length(btrim(aceite_nome)) between 2 and 120),
  aceite_fora_do_link  boolean not null default false,
  resultado_avisado_em timestamptz,
  criado_em            timestamptz not null default app_now(),
  criado_por           uuid not null references pessoas (id),
  versao               integer not null default 1,
  unique (id, condominio_id),
  unique (orcamento_id, ordem),
  foreign key (orcamento_id, condominio_id) references orcamentos (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  check (canal <> 'WHATSAPP' or celular is not null),
  check (canal <> 'EMAIL' or email is not null),
  check ((estado = 'REVOGADO') = (revogado_em is not null) and (revogado_em is null) = (revogado_motivo is null)
         and (revogado_em is null) = (revogado_por is null)),
  check ((aceite_em is null) = (aceite_nome is null))
);
create index convites_orcamento_do_orcamento on convites_orcamento (orcamento_id, criado_em);
create unique index convites_orcamento_um_escolhido on convites_orcamento (orcamento_id) where escolhido;
call proteger_tabela_condominio('convites_orcamento');
call ligar_guardiao('convites_orcamento');
insert into estados_iniciais (tabela, estado) values ('convites_orcamento', 'CONVIDADO');
insert into transicoes_permitidas (tabela, de, para) values
  ('convites_orcamento', 'CONVIDADO', 'RECUSOU'),
  ('convites_orcamento', 'CONVIDADO', 'RESPONDEU'),
  ('convites_orcamento', 'RECUSOU', 'RESPONDEU'),
  ('convites_orcamento', 'CONVIDADO', 'REVOGADO'),
  ('convites_orcamento', 'RECUSOU', 'REVOGADO'),
  ('convites_orcamento', 'RESPONDEU', 'REVOGADO');
create trigger convites_orcamento_sem_exclusao before delete on convites_orcamento for each row execute function somente_insercao();

create function convites_orcamento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.orcamento_id, new.ordem, new.criado_em, new.criado_por)
     is distinct from (old.condominio_id, old.orcamento_id, old.ordem, old.criado_em, old.criado_por) then
    raise exception 'O convite não muda de orçamento' using errcode = 'TC422';
  end if;
  if old.revogado_em is not null and (new.revogado_em, new.revogado_por, new.revogado_motivo, new.estado)
     is distinct from (old.revogado_em, old.revogado_por, old.revogado_motivo, old.estado) then
    raise exception 'Convite revogado não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger convites_orcamento_regras before update on convites_orcamento for each row execute function convites_orcamento_regras();

alter table codigos_sem_conta drop constraint codigos_sem_conta_tipo_check;
alter table codigos_sem_conta add constraint codigos_sem_conta_tipo_check
  check (tipo in ('ETIQUETA', 'PRESTADOR', 'ENQUETE', 'ASSEMBLEIA', 'CADASTRO', 'CONSELHO', 'ORCAMENTO'));

-- ---------------------------------------------------------------------------------------
-- As propostas (regra 4).

create table propostas_orcamento (
  id                    uuid primary key default gen_random_uuid(),
  condominio_id         uuid not null references condominios (id) on delete restrict,
  orcamento_id          uuid not null,
  convite_id            uuid not null,
  numero                smallint not null check (numero between 1 and 99),
  em_uso                boolean not null default true,
  valor                 centavos not null check (valor > 0),
  frete_incluso         boolean not null default true,
  frete                 centavos not null default 0 check (frete >= 0),
  total                 centavos generated always as (valor + frete) stored,
  marca_modelo          text check (length(btrim(marca_modelo)) between 1 and 200),
  prazo_execucao        text not null check (length(btrim(prazo_execucao)) between 1 and 120),
  garantia              text check (length(btrim(garantia)) between 1 and 120),
  valida_ate            date not null,
  pagamento             text check (length(btrim(pagamento)) between 1 and 200),
  inclui                text not null check (length(btrim(inclui)) between 3 and 2000),
  nao_inclui            text check (length(btrim(nao_inclui)) between 1 and 2000),
  pdf_arquivo_id        uuid,
  enviada_em            timestamptz not null default app_now(),
  confirmada_em         timestamptz,
  confirmacao_pedida_em timestamptz,
  unique (id, condominio_id),
  unique (convite_id, numero),
  foreign key (orcamento_id, condominio_id) references orcamentos (id, condominio_id),
  foreign key (convite_id, condominio_id) references convites_orcamento (id, condominio_id),
  check (not frete_incluso or frete = 0)
);
create unique index propostas_orcamento_em_uso on propostas_orcamento (convite_id) where em_uso;
call proteger_tabela_condominio('propostas_orcamento');
create trigger propostas_orcamento_sem_exclusao before delete on propostas_orcamento for each row execute function somente_insercao();

-- Da proposta só mudam o "em uso", a confirmação do preço e a validade confirmada (OC-04).
create function propostas_orcamento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.orcamento_id, new.convite_id, new.numero, new.valor, new.frete_incluso, new.frete, new.marca_modelo,
      new.prazo_execucao, new.garantia, new.pagamento, new.inclui, new.nao_inclui, new.pdf_arquivo_id, new.enviada_em)
     is distinct from
     (old.condominio_id, old.orcamento_id, old.convite_id, old.numero, old.valor, old.frete_incluso, old.frete, old.marca_modelo,
      old.prazo_execucao, old.garantia, old.pagamento, old.inclui, old.nao_inclui, old.pdf_arquivo_id, old.enviada_em)
     or (new.valida_ate <> old.valida_ate and new.confirmada_em is null) then
    raise exception 'A proposta enviada não muda: o fornecedor manda outra versão' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger propostas_orcamento_regras before update on propostas_orcamento for each row execute function propostas_orcamento_regras();

alter table orcamentos add constraint orcamentos_proposta_escolhida
  foreign key (proposta_escolhida_id, condominio_id) references propostas_orcamento (id, condominio_id);

-- ---------------------------------------------------------------------------------------
-- Anexos do pedido (fotos e arquivos que vão para o fornecedor), o PDF da proposta e a nota fiscal.
-- No bucket privado "pedidos", em condomínio/orcamentos/orçamento/arquivo, como arquivos_aprovacao.

create table arquivos_orcamento (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  orcamento_id      uuid not null,
  convite_id        uuid,
  parte             text not null default 'PEDIDO' check (parte in ('PEDIDO', 'PROPOSTA', 'NOTA_FISCAL')),
  nome              text not null check (length(btrim(nome)) between 1 and 200),
  tipo              text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_declarado integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null unique,
  situacao          text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa     text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em        timestamptz not null default app_now(),
  enviado_por       uuid references pessoas (id),
  verificado_em     timestamptz,
  retirado_em       timestamptz,
  retirado_por      uuid references pessoas (id),
  motivo_retirada   text check (length(btrim(motivo_retirada)) between 3 and 500),
  unique (id, condominio_id),
  foreign key (orcamento_id, condominio_id) references orcamentos (id, condominio_id),
  foreign key (convite_id, condominio_id) references convites_orcamento (id, condominio_id),
  check ((parte = 'PROPOSTA') = (convite_id is not null)),
  check (parte = 'PROPOSTA' or enviado_por is not null),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check ((retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_orcamento_do_orcamento on arquivos_orcamento (orcamento_id, enviado_em);
call proteger_tabela_condominio('arquivos_orcamento');
create trigger arquivos_orcamento_sem_exclusao before delete on arquivos_orcamento for each row execute function somente_insercao();

create function arquivos_orcamento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.orcamento_id, new.convite_id, new.parte, new.nome, new.tipo, new.tamanho_declarado, new.caminho,
      new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.orcamento_id, old.convite_id, old.parte, old.nome, old.tipo, old.tamanho_declarado, old.caminho,
      old.enviado_em, old.enviado_por) then
    raise exception 'O anexo não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
     is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'O anexo já foi verificado' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'O anexo já foi tirado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger arquivos_orcamento_regras before update on arquivos_orcamento for each row execute function arquivos_orcamento_regras();

alter table propostas_orcamento add constraint propostas_orcamento_pdf
  foreign key (pdf_arquivo_id, condominio_id) references arquivos_orcamento (id, condominio_id);
alter table orcamentos add constraint orcamentos_nota_fiscal
  foreign key (nota_fiscal_arquivo_id, condominio_id) references arquivos_orcamento (id, condominio_id);

-- ---------------------------------------------------------------------------------------
-- Avisos no sino de quem cuida (regra 8).

create table avisos_orcamento (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  tipo          text not null check (tipo in ('PROPOSTA_RECEBIDA', 'RECUSOU', 'PRAZO_FECHOU', 'PRECO_CONFIRMADO', 'ACEITE', 'SEM_ACEITE_5D', 'APROVADA')),
  orcamento_id  uuid not null,
  convite_id    uuid,
  referencia    text not null default '',
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (orcamento_id, condominio_id) references orcamentos (id, condominio_id),
  foreign key (convite_id, condominio_id) references convites_orcamento (id, condominio_id)
);
create unique index avisos_orcamento_unico on avisos_orcamento (pessoa_id, orcamento_id, coalesce(convite_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, referencia);
create index avisos_orcamento_pessoa on avisos_orcamento (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_orcamento');
create trigger avisos_orcamento_sem_exclusao before delete on avisos_orcamento for each row execute function somente_insercao();
create function avisos_orcamento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.tipo, new.orcamento_id, new.convite_id, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.tipo, old.orcamento_id, old.convite_id, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_orcamento_regras before update on avisos_orcamento for each row execute function avisos_orcamento_regras();

-- Quem cuida recebe; quem fez a ação (a pessoa do contexto) não é avisado do que fez.
create function avisar_orcamento(o orcamentos, p_tipo text, p_convite uuid default null, p_referencia text default '') returns void
language plpgsql
set search_path = public
as $$
begin
  if o.cuidador_id is distinct from contexto_pessoa() then
    insert into avisos_orcamento (condominio_id, pessoa_id, tipo, orcamento_id, convite_id, referencia)
    values (o.condominio_id, o.cuidador_id, p_tipo, o.id, p_convite, coalesce(p_referencia, ''))
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- O prestador que nasce da cotação (OC-10) e a despesa ligada ao orçamento (regra 5).

alter table prestadores add column orcamento_origem_id uuid;
alter table prestadores add constraint prestadores_orcamento_origem
  foreign key (orcamento_origem_id, condominio_id) references orcamentos (id, condominio_id);

alter table despesas_aprovacao add column orcamento_id uuid;
alter table despesas_aprovacao add constraint despesas_aprovacao_orcamento
  foreign key (orcamento_id, condominio_id) references orcamentos (id, condominio_id);
create index despesas_aprovacao_do_orcamento on despesas_aprovacao (orcamento_id) where orcamento_id is not null;

-- O e-mail do convite sai pela fila de sempre (0160), tipo ORCAMENTO.
alter table envios_email drop constraint envios_email_tipo_check;
alter table envios_email add constraint envios_email_tipo_check
  check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO', 'ENQUETE', 'ASSEMBLEIA', 'PROTOCOLO', 'PRESTADOR', 'CONSELHO', 'ORCAMENTO'));
alter table envios_email
  add column convite_orcamento_id uuid,
  add constraint envios_email_convite_orcamento foreign key (convite_orcamento_id, condominio_id) references convites_orcamento (id, condominio_id),
  add constraint envios_email_orcamento_tem_convite check ((tipo = 'ORCAMENTO') = (convite_orcamento_id is not null));

create function envios_email_regras_r8() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.convite_orcamento_id is distinct from old.convite_orcamento_id then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  if new.estado = 'FALHOU' and old.estado <> 'FALHOU' and new.convite_orcamento_id is not null then
    update codigos_sem_conta set revogado_em = app_now() where envio_email_id = new.id and revogado_em is null;
  end if;
  return new;
end $$;
create trigger envios_email_regras_r8 before update on envios_email for each row execute function envios_email_regras_r8();

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function exigir_orcamento(p_id uuid) returns orcamentos
language plpgsql
set search_path = public
as $$
declare o orcamentos;
begin
  select * into o from orcamentos where id = p_id;
  if not found then raise exception 'Orçamento não encontrado' using errcode = 'TC404'; end if;
  return o;
end $$;

create function exigir_convite_orcamento(p_id uuid) returns convites_orcamento
language plpgsql
set search_path = public
as $$
declare c convites_orcamento;
begin
  select * into c from convites_orcamento where id = p_id;
  if not found then raise exception 'Convite não encontrado' using errcode = 'TC404'; end if;
  return c;
end $$;

-- "26/10, 18h" ou "26/10, 18h30".
create function prazo_texto(p timestamptz) returns text
language sql stable
set search_path = public
as $$
  select to_char(p at time zone fuso_do_condominio(), 'DD/MM, HH24"h"')
         || case when to_char(p at time zone fuso_do_condominio(), 'MI') = '00' then '' else to_char(p at time zone fuso_do_condominio(), 'MI') end
$$;

create function letra_do_convite(c convites_orcamento) returns text
language sql stable
set search_path = public
as $$
  select chr(64 + c.ordem)
$$;

-- Telefone do prestador no formato do cadastro (+55 e DDD), ou nulo.
create function telefone_do_convite(p text) returns text
language sql immutable
set search_path = public
as $$
  select case when p is null then null
              when telefone_valido(p) then p
              when telefone_valido('+' || p) then '+' || p
              when telefone_valido('+55' || p) then '+55' || p end
$$;

-- As faixas em vigor, em ordem.
create function faixas_orcamento_json() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce((select jsonb_agg(jsonb_build_object('ate', f.ate, 'minimo', f.minimo, 'quemAprova', f.quem_aprova) order by f.ordem)
                     from faixas_orcamento f where f.retirada_em is null), '[]'::jsonb)
$$;

create function regras_orcamento_json() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('ligada', c.orcamento_regra_ligada, 'faixas', faixas_orcamento_json(), 'abaixoMinimo', c.orcamento_abaixo_minimo,
                            'prazoDias', c.orcamento_prazo_dias, 'validadeDias', c.orcamento_validade_dias, 'linkDias', c.orcamento_link_dias,
                            'alcadaConselho', c.conselho_alcada)
    from configuracao_condominio c
$$;

-- A faixa que vale para um valor: a primeira cujo teto comporta; a sem teto pega o resto. Nula
-- com a regra desligada (mínimo 1, síndico).
create function faixa_do_valor(p_valor bigint) returns faixas_orcamento
language sql stable
set search_path = public
as $$
  select f.* from faixas_orcamento f
   where f.retirada_em is null and p_valor is not null and (select orcamento_regra_ligada from configuracao_condominio)
     and (f.ate is null or p_valor <= f.ate)
   order by f.ordem limit 1
$$;

-- As propostas em uso que contam: de convites não revogados.
create function propostas_recebidas(o orcamentos) returns integer
language sql stable
set search_path = public
as $$
  select count(*)::integer from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
   where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO'
$$;

create function menor_total(o orcamentos) returns bigint
language sql stable
set search_path = public
as $$
  select min(p.total) from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
   where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO'
$$;

create function proposta_vencida(p propostas_orcamento) returns boolean
language sql stable
set search_path = public
as $$ select p.valida_ate < hoje_no_condominio() $$;

-- O valor que define a faixa: o estimado; sem ele, o menor total recebido.
create function valor_da_faixa(o orcamentos) returns bigint
language sql stable
set search_path = public
as $$ select coalesce(o.valor_estimado, menor_total(o)) $$;

create function regra_do_orcamento_json(o orcamentos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'ligada', c.orcamento_regra_ligada,
    'faixa', case when f.id is not null then jsonb_build_object('ate', f.ate, 'minimo', f.minimo, 'quemAprova', f.quem_aprova) end,
    'anterior', (select max(x.ate) from faixas_orcamento x where x.retirada_em is null and f.id is not null and x.ordem < f.ordem),
    'minimo', coalesce(f.minimo, 1),
    'recebidas', propostas_recebidas(o),
    'minimoAtendido', propostas_recebidas(o) >= coalesce(f.minimo, 1),
    'abaixoMinimo', c.orcamento_abaixo_minimo,
    'alcadaConselho', c.conselho_alcada,
    'passaAlcada', c.conselho_alcada is not null and coalesce((select p.total from propostas_orcamento p where p.id = o.proposta_escolhida_id), menor_total(o)) > c.conselho_alcada))
    from configuracao_condominio c left join faixa_do_valor(valor_da_faixa(o)) f on true
$$;

-- A transição com o autor do contexto; sem pessoa (o link), é o sistema.
create function transicao_orcamento(p_evento text, p_motivo text default null) returns void
language sql
set search_path = public
as $$ select definir_transicao(p_evento, p_motivo, contexto_pessoa() is null) $$;

-- O prazo fecha na leitura (regra 2) e o aceite que demora avisa (regra 8).
create function conferir_orcamento(o orcamentos) returns orcamentos
language plpgsql
set search_path = public
as $$
declare v_n integer;
begin
  if o.estado = 'PEDINDO' and o.prazo_propostas <= app_now() then
    v_n := propostas_recebidas(o);
    perform definir_transicao('PRAZO_FECHOU', null, true);
    update orcamentos set estado = 'COMPARANDO' where id = o.id and estado = 'PEDINDO' returning * into o;
    perform registrar_historico('orcamento.prazo_fechou', 'orcamentos', o.id::text,
      jsonb_build_object('recebidas', v_n, 'minimo', (regra_do_orcamento_json(o) ->> 'minimo')::integer));
    insert into avisos_orcamento (condominio_id, pessoa_id, tipo, orcamento_id, referencia)
    values (o.condominio_id, o.cuidador_id, 'PRAZO_FECHOU', o.id, '') on conflict do nothing;
  end if;
  if o.estado = 'ESCOLHIDA' and o.escolhida_em + interval '5 days' <= app_now()
     and not exists (select 1 from convites_orcamento where orcamento_id = o.id and escolhido and aceite_em is not null) then
    insert into avisos_orcamento (condominio_id, pessoa_id, tipo, orcamento_id, referencia)
    values (o.condominio_id, o.cuidador_id, 'SEM_ACEITE_5D', o.id, to_char(o.escolhida_em, 'YYYY-MM-DD')) on conflict do nothing;
  end if;
  return o;
end $$;

create function conferir_orcamentos() returns void
language plpgsql
set search_path = public
as $$
declare o orcamentos;
begin
  for o in select * from orcamentos where estado in ('PEDINDO', 'ESCOLHIDA') loop
    perform conferir_orcamento(o);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- O link do convite (regra 3): o código nasce na hora de mandar; só o hash fica.

create function novo_codigo_orcamento(c convites_orcamento, p_trocar boolean default true, p_envio uuid default null) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  if p_trocar then
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'ORCAMENTO' and alvo_id = c.id and revogado_em is null;
  end if;
  loop
    v_codigo := novo_codigo();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id, envio_email_id)
  values (hash_codigo(v_codigo), c.condominio_id, 'ORCAMENTO', c.id, p_envio);
  update convites_orcamento set codigo_em = app_now() where id = c.id;
  return v_codigo;
end $$;

-- O cargo de quem manda, para a mensagem pronta (quadro 475).
create function cargo_da_pessoa(p_pessoa uuid) returns text
language sql stable
set search_path = public
as $$
  select coalesce((select v.cargo from vinculos v where v.pessoa_id = p_pessoa and v.condominio_id = contexto_condominio()
                                                    and v.funcao = 'AUTORIZADO' and v.revogado_em is null and v.cargo is not null limit 1),
                  case when eh_sindico(p_pessoa) then 'síndico(a)' end, 'da gestão')
$$;

-- Manda o convite pelo canal: pelo e-mail entra na fila e o código nasce ao montar o e-mail; pelo
-- WhatsApp não há modelo aprovado, e o código volta para a tela montar a mensagem pronta e abrir
-- o WhatsApp de quem manda (envio COPIAR). As peças da mensagem voltam junto.
create function mandar_convite(c convites_orcamento, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  o orcamentos;
  v jsonb;
begin
  o := exigir_orcamento(c.orcamento_id);
  update convites_orcamento set mandado_em = app_now() where id = c.id;
  v := jsonb_strip_nulls(jsonb_build_object(
    'conviteId', c.id, 'nome', c.nome, 'canal', c.canal, 'letra', letra_do_convite(c),
    'mensagem', jsonb_build_object('quem', nome_pessoa(p_pessoa), 'cargo', cargo_da_pessoa(p_pessoa), 'condominio', nome_do_condominio(),
                                   'titulo', o.titulo, 'prazo', prazo_texto(o.prazo_propostas))));
  if c.canal = 'EMAIL' then
    update envios_email set estado = 'CANCELADO', motivo = 'O convite foi mandado de novo' where convite_orcamento_id = c.id and estado = 'NA_FILA';
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'ORCAMENTO' and alvo_id = c.id and revogado_em is null;
    insert into envios_email (condominio_id, tipo, convite_orcamento_id, para, criado_por) values (c.condominio_id, 'ORCAMENTO', c.id, c.email, p_pessoa);
    return v || jsonb_build_object('envio', 'EMAIL');
  end if;
  return v || jsonb_build_object('envio', 'COPIAR', 'codigo', novo_codigo_orcamento(c));
end $$;

-- Confere e limpa um convite do pedido: prestador cadastrado ou nome e contato. Devolve o convite
-- pronto para inserir (sem id).
create function convite_da_entrada(p_item jsonb, p_n integer) returns convites_orcamento
language plpgsql
set search_path = public
as $$
declare
  c convites_orcamento;
  pr prestadores;
  v_canal text := upper(btrim(coalesce(p_item ->> 'canal', '')));
begin
  c.prestador_id := nullif(p_item ->> 'prestadorId', '')::uuid;
  c.nome := nullif(btrim(coalesce(p_item ->> 'nome', '')), '');
  c.celular := so_digitos_celular(p_item ->> 'celular');
  c.email := nullif(lower(btrim(coalesce(p_item ->> 'email', ''))), '');
  if c.prestador_id is not null then
    select * into pr from prestadores where id = c.prestador_id and arquivado_em is null;
    if not found then perform recusar_campos(format('Convite %s: escolha um prestador cadastrado', p_n), 'convites'); end if;
    c.nome := pr.nome;
    c.celular := coalesce(c.celular, so_digitos_celular(pr.telefone));
    c.email := coalesce(c.email, lower(pr.email));
    if v_canal = '' then v_canal := case when c.celular is not null then 'WHATSAPP' else 'EMAIL' end; end if;
  end if;
  if coalesce(length(c.nome), 0) not between 2 and 120 then perform recusar_campos(format('Convite %s: escreva o nome (2 a 120 caracteres)', p_n), 'convites'); end if;
  if v_canal not in ('WHATSAPP', 'EMAIL') then perform recusar_campos(format('Convite %s: diga se vai pelo WhatsApp ou pelo e-mail', p_n), 'convites'); end if;
  if c.celular is not null and c.celular !~ '^\+?[0-9]{10,15}$' then perform recusar_campos(format('Convite %s: celular com DDD', p_n), 'convites'); end if;
  if c.email is not null and not email_valido(c.email) then perform recusar_campos(format('Convite %s: e-mail inválido', p_n), 'convites'); end if;
  if v_canal = 'WHATSAPP' and c.celular is null then perform recusar_campos(format('Convite %s: para o WhatsApp, falta o celular', p_n), 'convites'); end if;
  if v_canal = 'EMAIL' and c.email is null then perform recusar_campos(format('Convite %s: para o e-mail, falta o e-mail', p_n), 'convites'); end if;
  c.canal := v_canal;
  return c;
end $$;

-- Grava os convites de um orçamento e, se o orçamento já pede propostas, manda cada um.
create function incluir_convites(o orcamentos, p_convites jsonb, p_pessoa uuid, p_mandar boolean) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  x record;
  c convites_orcamento;
  v_links jsonb := '[]'::jsonb;
begin
  if p_convites is null or jsonb_typeof(p_convites) <> 'array' then perform recusar_campos('Mande a lista de convites', 'convites'); end if;
  if (select count(*) from convites_orcamento where orcamento_id = o.id) + jsonb_array_length(p_convites) > 20 then
    perform recusar_motivo('Até 20 convidados por orçamento, contando os revogados', 'LIMITE_CONVITES');
  end if;
  for x in select value as item, n from jsonb_array_elements(p_convites) with ordinality t(value, n) loop
    c := convite_da_entrada(x.item, x.n::integer);
    if c.prestador_id is not null and exists (select 1 from convites_orcamento where orcamento_id = o.id and prestador_id = c.prestador_id and estado <> 'REVOGADO') then
      perform recusar_campos(format('Convite %s: este prestador já foi convidado', x.n), 'convites');
    end if;
    perform transicao_orcamento('CONVIDADO');
    insert into convites_orcamento (condominio_id, orcamento_id, prestador_id, ordem, nome, celular, email, canal, expira_em, criado_por)
    values (o.condominio_id, o.id, c.prestador_id, (select count(*) + 1 from convites_orcamento where orcamento_id = o.id), c.nome, c.celular, c.email, c.canal,
            o.prazo_propostas, p_pessoa)
    returning * into c;
    perform registrar_historico('orcamento.convidado', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object(
      'convite', c.id, 'canal', c.canal, 'prestador', c.prestador_id)));
    if p_mandar then v_links := v_links || jsonb_build_array(mandar_convite(c, p_pessoa)); end if;
  end loop;
  return v_links;
end $$;

-- ---------------------------------------------------------------------------------------
-- O que as telas leem.

create function situacao_orcamento(o orcamentos) returns text
language sql stable
set search_path = public
as $$
  select case o.estado
    when 'RASCUNHO' then 'Rascunho'
    when 'PEDINDO' then case when o.prazo_propostas <= app_now() then 'Pronto para comparar' else 'Pedindo propostas' end
    when 'COMPARANDO' then 'Pronto para comparar'
    when 'ESCOLHIDA' then case
      when o.despesa_id is not null and (select estado from despesas_aprovacao where id = o.despesa_id) = 'AGUARDANDO' then 'Esperando o conselho'
      when exists (select 1 from convites_orcamento c where c.orcamento_id = o.id and c.escolhido and c.aceite_em is not null) then 'Esperando a aprovação'
      else 'Esperando o aceite do fornecedor' end
    when 'COMPRANDO' then 'Comprando'
    when 'ENTREGUE' then 'Entregue'
    else 'Cancelado' end
$$;

create function origem_orcamento_json(o orcamentos) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('tipo', 'MANUTENCAO', 'id', m.id, 'texto', 'Manutenção · ' || m.titulo) from manutencoes m where m.id = o.manutencao_id),
    (select jsonb_build_object('tipo', 'PEDIDO', 'id', p.id, 'texto', 'Pedido ' || p.protocolo || ' · ' || p.assunto) from pedidos p where p.id = o.pedido_id))
$$;

-- O que pede atenção (quadro 470): prazo fechou sem olhar, proposta vencida entre as em uso,
-- sem aceite há 5 dias.
create function pede_atencao_orcamento(o orcamentos) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select 'PRAZO_FECHOU' as x where o.estado = 'COMPARANDO' and o.fechamento_visto_em is null
    union all
    select 'PROPOSTA_VENCIDA' where o.estado in ('PEDINDO', 'COMPARANDO')
       and exists (select 1 from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
                    where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO' and proposta_vencida(p))
    union all
    select 'SEM_ACEITE' where o.estado = 'ESCOLHIDA' and o.escolhida_em + interval '5 days' <= app_now()
       and not exists (select 1 from convites_orcamento c where c.orcamento_id = o.id and c.escolhido and c.aceite_em is not null)) t
$$;

create function orcamento_resumo_json(o orcamentos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', o.id, 'titulo', o.titulo, 'tipo', o.tipo, 'local', o.local, 'estado', o.estado, 'situacao', situacao_orcamento(o),
    'origem', origem_orcamento_json(o),
    'convidados', (select count(*) from convites_orcamento c where c.orcamento_id = o.id and c.estado <> 'REVOGADO'),
    'recebidas', propostas_recebidas(o),
    'recusas', (select count(*) from convites_orcamento c where c.orcamento_id = o.id and c.estado = 'RECUSOU'),
    'prazoPropostas', o.prazo_propostas, 'prazoFechou', o.prazo_propostas <= app_now(),
    'vencidas', (select count(*) from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
                  where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO' and proposta_vencida(p)),
    'escolhida', (select jsonb_build_object('nome', c.nome, 'total', p.total)
                    from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id where p.id = o.proposta_escolhida_id),
    'decididoEm', o.escolhida_em, 'concluidoEm', case when o.estado = 'ENTREGUE' then to_char(o.entregue_em, 'YYYY-MM-DD') end,
    'canceladoEm', o.cancelado_em,
    'pedeAtencao', pede_atencao_orcamento(o), 'versao', o.versao))
$$;

create function proposta_json(p propostas_orcamento) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'total', p.total, 'valor', p.valor, 'frete', p.frete, 'freteIncluso', p.frete_incluso,
    'marcaModelo', p.marca_modelo, 'prazoExecucao', p.prazo_execucao, 'garantia', p.garantia,
    'validaAte', to_char(p.valida_ate, 'YYYY-MM-DD'), 'vencida', proposta_vencida(p), 'confirmada', p.confirmada_em is not null,
    'confirmadaEm', p.confirmada_em, 'confirmacaoPedidaEm', p.confirmacao_pedida_em,
    'pagamento', p.pagamento, 'inclui', p.inclui, 'naoInclui', p.nao_inclui, 'faltaAlgo', p.nao_inclui is not null,
    'pdf', (select jsonb_build_object('id', a.id, 'nome', a.nome) from arquivos_orcamento a where a.id = p.pdf_arquivo_id and a.situacao = 'LIBERADO' and a.retirado_em is null),
    'enviadaEm', p.enviada_em))
$$;

create function convite_json(c convites_orcamento) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'letra', letra_do_convite(c), 'nome', c.nome, 'origem', case when c.prestador_id is null then 'LINK' else 'PRESTADOR' end,
    'prestadorId', c.prestador_id, 'canal', c.canal,
    'contatoMascarado', case when c.canal = 'WHATSAPP' then celular_mascarado(c.celular) else email_mascarado(c.email) end,
    'estado', c.estado, 'aberturas', c.aberturas, 'ultimaAberturaEm', c.ultima_abertura_em, 'mandadoEm', c.mandado_em,
    'envio', case when c.mandado_em is null then null
                  when c.canal = 'EMAIL' then coalesce((select e.estado from envios_email e where e.convite_orcamento_id = c.id order by e.criado_em desc limit 1), 'NA_FILA')
                  else 'COPIAR' end,
    'recusaMotivo', c.recusa_motivo, 'recusouEm', c.recusou_em,
    'propostaEmUso', (select proposta_json(p) from propostas_orcamento p where p.convite_id = c.id and p.em_uso),
    'versoes', (select count(*) from propostas_orcamento p where p.convite_id = c.id),
    'revogado', case when c.revogado_em is not null then jsonb_build_object('em', c.revogado_em, 'motivo', c.revogado_motivo) end,
    'escolhido', c.escolhido, 'aceiteEm', c.aceite_em, 'aceiteNome', c.aceite_nome, 'aceiteForaDoLink', c.aceite_fora_do_link,
    'versao', c.versao))
$$;

-- Os anexos liberados do pedido (parte PEDIDO) e, para a gestão, a nota fiscal.
create function arquivos_orcamento_json(o orcamentos, p_gestao boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', a.id, 'parte', a.parte, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', coalesce(a.tamanho, a.tamanho_declarado),
           'situacao', case when p_gestao then a.situacao end, 'motivoRecusa', case when p_gestao then a.motivo_recusa end,
           'enviadoEm', case when p_gestao then a.enviado_em end))
         order by a.enviado_em, a.id), '[]'::jsonb)
    from arquivos_orcamento a
   where a.orcamento_id = o.id and a.retirado_em is null and a.parte in ('PEDIDO', 'NOTA_FISCAL')
     and (p_gestao or a.parte = 'PEDIDO')
     and (a.situacao = 'LIBERADO' or (p_gestao and a.situacao <> 'ENVIANDO'))
$$;

-- O texto de cada evento do histórico (como descreverEventoOrcamento no domínio).
create function texto_evento_orcamento(p_acao text, p_dados jsonb) returns text
language sql stable
set search_path = public
as $$
  with c as (select coalesce((select nome from convites_orcamento where id = (p_dados ->> 'convite')::uuid), 'O fornecedor') as nome)
  select case p_acao
    when 'orcamento.criado' then 'Orçamento criado'
    when 'orcamento.convidado' then nome || ' foi convidado'
    when 'orcamento.convite_reenviado' then 'Link mandado de novo para ' || nome
    when 'orcamento.convite_revogado' then 'Link de ' || nome || ' revogado'
    when 'orcamento.recusou' then nome || ' recusou o convite'
    when 'orcamento.proposta' then nome || ' mandou a proposta' || case when (p_dados ->> 'numero')::integer > 1 then ' (versão ' || (p_dados ->> 'numero') || ')' else '' end
    when 'orcamento.confirmacao_pedida' then 'Pedida a confirmação do preço a ' || nome
    when 'orcamento.preco_confirmado' then nome || ' confirmou o preço'
    when 'orcamento.prazo_fechou' then 'Prazo fechou com ' || (p_dados ->> 'recebidas') || case when (p_dados ->> 'recebidas') = '1' then ' proposta' else ' propostas' end
    when 'orcamento.estendido' then 'Prazo estendido'
    when 'orcamento.fechado_antes' then 'Prazo fechado antes'
    when 'orcamento.escolhida' then 'Proposta de ' || nome || ' escolhida'
    when 'orcamento.escolha_desfeita' then 'Escolha desfeita'
    when 'orcamento.ao_conselho' then 'Mandada ao conselho como despesa para aprovar'
    when 'orcamento.aprovada' then 'Aprovada'
    when 'orcamento.recusada' then 'Escolha recusada por quem aprova'
    when 'orcamento.aceite' then nome || ' aceitou fazer o serviço'
    when 'orcamento.aceite_fora' then 'Aceite registrado fora do link'
    when 'orcamento.compra' then 'Compra registrada'
    when 'orcamento.entrega' then case when (p_dados ->> 'parcial')::boolean then 'Entrega parcial registrada' else 'Entrega registrada' end
    when 'orcamento.cancelado' then 'Orçamento cancelado'
    when 'orcamento.editado' then 'O pedido foi alterado'
    when 'orcamento.anexo_enviado' then 'Arquivo anexado'
    when 'orcamento.anexo_tirado' then 'Arquivo tirado'
    when 'orcamento.prestador_criado' then 'Prestador cadastrado a partir deste orçamento'
    else null end
    from c
$$;

create function historico_orcamento_json(o orcamentos) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'em', h.ocorrido_em, 'acao', h.acao, 'quem', nome_pessoa(h.autor_id), 'dados', h.dados,
             'texto', texto_evento_orcamento(h.acao, h.dados),
             'tom', case when h.acao in ('orcamento.recusou', 'orcamento.convite_revogado', 'orcamento.cancelado', 'orcamento.recusada') then 'neutro'
                         when h.acao in ('orcamento.escolhida', 'orcamento.aprovada', 'orcamento.aceite', 'orcamento.entrega') then 'ok' end))
                   order by h.ocorrido_em desc, h.id desc)
      from historico h where h.entidade = 'orcamentos' and h.entidade_id = o.id::text and h.acao like 'orcamento.%'), '[]'::jsonb)
$$;

create function orcamento_json(o orcamentos, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with e as (select c.*, p.total, p.id as proposta_id from convites_orcamento c join propostas_orcamento p on p.convite_id = c.id
              where p.id = o.proposta_escolhida_id),
       x as (select d.* from despesas_aprovacao d where d.id = o.despesa_id),
       r as (select d.* from despesas_aprovacao d where d.orcamento_id = o.id and d.estado in ('RECUSADA', 'RETIRADA') order by d.respondida_em desc limit 1),
       perm as (select pode(p_pessoa, o.condominio_id, 'orcamentos.editar') as editar, pode(p_pessoa, o.condominio_id, 'orcamentos.decidir') as decidir)
  select jsonb_build_object(
    'orcamento', orcamento_resumo_json(o) || jsonb_strip_nulls(jsonb_build_object(
      'descricao', o.descricao, 'valorEstimado', o.valor_estimado, 'validadeMinimaDias', o.validade_minima_dias,
      'cuidador', jsonb_build_object('id', o.cuidador_id, 'nome', nome_pessoa(o.cuidador_id)),
      'criadoEm', o.criado_em, 'criadoPor', nome_pessoa(o.criado_por), 'editadoEm', o.editado_em,
      'regra', regra_do_orcamento_json(o),
      'escolha', (select jsonb_strip_nulls(jsonb_build_object(
                    'propostaId', e.proposta_id, 'convite', jsonb_build_object('id', e.id, 'letra', (select letra_do_convite(k) from convites_orcamento k where k.id = e.id), 'nome', e.nome),
                    'total', e.total, 'motivo', o.motivo_escolha, 'quemAprova', o.quem_aprova, 'escolhidaEm', o.escolhida_em,
                    'escolhidaPor', nome_pessoa(o.escolhida_por), 'despesaId', o.despesa_id,
                    'despesaEstado', (select estado from x), 'despesaJustificativa', (select justificativa from x),
                    'aprovadaEm', o.aprovada_em, 'aceiteEm', e.aceite_em, 'aceiteNome', e.aceite_nome, 'aceiteForaDoLink', e.aceite_fora_do_link,
                    'semAceiteHaDias', case when e.aceite_em is null then extract(day from app_now() - o.escolhida_em)::integer end))
                    from e),
      'recusa', (select jsonb_strip_nulls(jsonb_build_object('despesaId', r.id, 'estado', r.estado, 'justificativa', coalesce(r.justificativa, r.retirada_motivo),
                                                             'em', r.respondida_em)) from r where o.estado = 'COMPARANDO'),
      'compra', case when o.comprada_em is not null then jsonb_strip_nulls(jsonb_build_object(
                  'compradaEm', to_char(o.comprada_em, 'YYYY-MM-DD'), 'valorFechado', o.valor_fechado,
                  'notaFiscal', (select jsonb_build_object('id', a.id, 'nome', a.nome) from arquivos_orcamento a where a.id = o.nota_fiscal_arquivo_id))) end,
      'entrega', case when o.entregue_em is not null or o.entrega_parcial then jsonb_strip_nulls(jsonb_build_object(
                   'entregueEm', to_char(o.entregue_em, 'YYYY-MM-DD'), 'parcial', o.entrega_parcial, 'observacao', o.entrega_obs)) end,
      'cancelado', case when o.cancelado_em is not null then jsonb_build_object('em', o.cancelado_em, 'motivo', o.cancelado_motivo, 'por', nome_pessoa(o.cancelado_por)) end)),
    'convites', coalesce((select jsonb_agg(convite_json(c) order by c.ordem) from convites_orcamento c where c.orcamento_id = o.id), '[]'::jsonb),
    'arquivos', arquivos_orcamento_json(o, true),
    'historico', historico_orcamento_json(o),
    'pode', (select jsonb_build_object(
      'editar', editar and o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO'),
      'convidar', editar and o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO'),
      'mandar', editar and o.estado = 'RASCUNHO' and exists (select 1 from convites_orcamento c where c.orcamento_id = o.id and c.estado <> 'REVOGADO'),
      'estender', editar and o.estado in ('PEDINDO', 'COMPARANDO'),
      'fechar', editar and o.estado = 'PEDINDO' and o.prazo_propostas > app_now(),
      'comparar', pode(p_pessoa, o.condominio_id, 'orcamentos.ver') and o.estado in ('PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO', 'ENTREGUE')
                  and propostas_recebidas(o) > 0,
      'decidir', decidir and o.estado = 'COMPARANDO' and propostas_recebidas(o) > 0,
      'desfazerEscolha', decidir and o.estado = 'ESCOLHIDA'
                         and not exists (select 1 from convites_orcamento c where c.orcamento_id = o.id and c.escolhido and c.aceite_em is not null)
                         and (o.despesa_id is null or (select estado from x) = 'AGUARDANDO'),
      'aceiteFora', editar and o.estado = 'ESCOLHIDA'
                    and not exists (select 1 from convites_orcamento c where c.orcamento_id = o.id and c.escolhido and c.aceite_em is not null),
      'registrarCompra', editar and o.estado = 'COMPRANDO' and o.comprada_em is null,
      'registrarEntrega', editar and o.estado = 'COMPRANDO' and o.comprada_em is not null,
      'anexar', editar and o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO', 'COMPRANDO'),
      'cancelar', editar and o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO')) from perm))
$$;

-- ---------------------------------------------------------------------------------------
-- Lista, ficha, opções e resumo.

create function plataforma_orcamentos(p_pessoa uuid, p_condominio uuid, p_filtro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_filtro text := coalesce(p_filtro, 'EM_ANDAMENTO');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.ver');
  if v_filtro not in ('EM_ANDAMENTO', 'DECIDIDOS', 'ENCERRADOS', 'CANCELADOS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  perform conferir_orcamentos();
  return jsonb_build_object(
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'filtro', v_filtro,
    'pode', jsonb_build_object('criar', pode(p_pessoa, p_condominio, 'orcamentos.editar'), 'decidir', pode(p_pessoa, p_condominio, 'orcamentos.decidir')),
    'contagens', (select jsonb_build_object(
      'emAndamento', count(*) filter (where estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO')),
      'decididos', count(*) filter (where estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE')),
      'encerrados', count(*) filter (where estado = 'ENTREGUE'),
      'cancelados', count(*) filter (where estado = 'CANCELADO'),
      'pedindo', count(*) filter (where estado = 'PEDINDO'),
      'comparar', count(*) filter (where estado = 'COMPARANDO' and (o.fechamento_visto_em is null or propostas_recebidas(o) = 0)),
      'decidir', count(*) filter (where estado = 'COMPARANDO' and o.fechamento_visto_em is not null and propostas_recebidas(o) > 0),
      'comprando', count(*) filter (where estado in ('ESCOLHIDA', 'COMPRANDO')))
      from orcamentos o),
    'orcamentos', coalesce((
      select jsonb_agg(orcamento_resumo_json(o) order by o.estado = 'RASCUNHO', o.prazo_propostas desc, o.criado_em desc)
        from orcamentos o
       where case v_filtro
               when 'EM_ANDAMENTO' then o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO')
               when 'DECIDIDOS' then o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE')
               when 'ENCERRADOS' then o.estado = 'ENTREGUE'
               else o.estado = 'CANCELADO' end), '[]'::jsonb));
end $$;

create function plataforma_orcamento(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o orcamentos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.ver');
  o := conferir_orcamento(exigir_orcamento(p_id));
  -- Abrir a ficha com o prazo fechado é "olhar": o cartão deixa de pedir atenção por isso.
  if o.estado = 'COMPARANDO' and o.fechamento_visto_em is null and pode(p_pessoa, p_condominio, 'orcamentos.editar') then
    update orcamentos set fechamento_visto_em = app_now() where id = o.id returning * into o;
  end if;
  return orcamento_json(o, p_pessoa) || jsonb_build_object('hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'));
end $$;

create function plataforma_orcamento_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  return jsonb_build_object(
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'prestadores', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                               'id', p.id, 'nome', p.nome, 'servico', p.servico,
                               'canal', case when p.telefone is not null then 'WHATSAPP' when p.email is not null then 'EMAIL' end,
                               'servicosFeitos', (select count(*) from manutencoes m where m.prestador_id = p.id and m.estado = 'CONCLUIDA')))
                                             order by lower(p.nome))
                               from prestadores p where p.arquivado_em is null), '[]'::jsonb),
    'manutencoes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'local', m.local) order by m.criado_em desc)
                               from manutencoes m where m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE')), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.protocolo, 'titulo', p.assunto) order by p.criado_em desc)
                           from pedidos p where p.estado in ('ABERTO', 'EM_ANDAMENTO') and pedido_visivel(p_pessoa, p)), '[]'::jsonb),
    'locais', coalesce((select jsonb_agg(l order by l) from (select distinct m.local as l from manutencoes m where m.local is not null limit 50) t), '[]'::jsonb),
    'regras', regras_orcamento_json(),
    'conselho', jsonb_build_object('podePedir', votos_necessarios(titulares_em_dia()) is not null, 'titulares', titulares_em_dia()),
    'quem', jsonb_build_object('nome', nome_pessoa(p_pessoa), 'cargo', cargo_da_pessoa(p_pessoa), 'condominio', nome_do_condominio()));
end $$;

-- O resumo do Início e do menu.
create function resumo_orcamentos(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'emAndamento', count(*) filter (where o.estado in ('PEDINDO', 'COMPARANDO', 'ESCOLHIDA', 'COMPRANDO')),
    'pedeAtencao', count(*) filter (where jsonb_array_length(pede_atencao_orcamento(o)) > 0),
    'paraDecidir', count(*) filter (where o.estado = 'COMPARANDO' and propostas_recebidas(o) > 0 and pode(p_pessoa, o.condominio_id, 'orcamentos.decidir')))
    from orcamentos o
$$;

-- ---------------------------------------------------------------------------------------
-- Criar, alterar, convidar, estender, fechar, cancelar.

create function exigir_dados_orcamento(p_pessoa uuid, p_titulo text, p_descricao text, p_local text, p_valor_estimado bigint, p_manutencao uuid,
                                       p_pedido uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if length(btrim(coalesce(p_titulo, ''))) not between 3 and 120 then perform recusar_campos('Diga o que é (3 a 120 caracteres)', 'titulo'); end if;
  if length(btrim(coalesce(p_descricao, ''))) not between 3 and 2000 then
    perform recusar_campos('Escreva o que precisa estar na proposta (3 a 2000 caracteres)', 'descricao');
  end if;
  if length(nullif(btrim(coalesce(p_local, '')), '')) not between 2 and 120 then perform recusar_campos('Local de 2 a 120 caracteres', 'local'); end if;
  if p_valor_estimado is not null and p_valor_estimado <= 0 then perform recusar_campos('O valor estimado, em reais, maior que zero', 'valorEstimado'); end if;
  if p_manutencao is not null and p_pedido is not null then perform recusar_campos('Escolha a manutenção ou o pedido, não os dois', 'manutencaoId'); end if;
  if p_manutencao is not null and not exists (select 1 from manutencoes where id = p_manutencao) then
    perform recusar_campos('Manutenção não encontrada', 'manutencaoId');
  end if;
  if p_pedido is not null and not exists (select 1 from pedidos p where p.id = p_pedido and pedido_visivel(p_pessoa, p)) then
    perform recusar_campos('Pedido não encontrado', 'pedidoId');
  end if;
end $$;

create function exigir_prazo_propostas(p_prazo timestamptz) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_prazo is null or p_prazo < app_now() + interval '1 hour' or p_prazo > app_now() + interval '60 days' then
    perform recusar_campos('O prazo das propostas vai de daqui a 1 hora até 60 dias', 'prazoPropostas');
  end if;
end $$;

create function plataforma_criar_orcamento(p_pessoa uuid, p_condominio uuid, p_titulo text, p_descricao text, p_local text, p_tipo text,
                                           p_manutencao uuid, p_pedido uuid, p_valor_estimado bigint, p_prazo timestamptz, p_validade integer,
                                           p_convites jsonb, p_mandar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_links jsonb;
  v_mandar boolean := coalesce(p_mandar, true);
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  if coalesce(p_tipo, 'SERVICO') = 'ITENS' then perform recusar_motivo('A lista de itens ainda não está pronta: por enquanto, só serviço', 'TIPO_ITENS_DEPOIS'); end if;
  if coalesce(p_tipo, 'SERVICO') <> 'SERVICO' then perform recusar_campos('Tipo desconhecido', 'tipo'); end if;
  perform exigir_dados_orcamento(p_pessoa, p_titulo, p_descricao, p_local, p_valor_estimado, p_manutencao, p_pedido);
  perform exigir_prazo_propostas(p_prazo);
  if p_validade is null or p_validade not between 1 and 180 then perform recusar_campos('A validade mínima vai de 1 a 180 dias', 'validadeMinimaDias'); end if;
  if v_mandar and (p_convites is null or jsonb_typeof(p_convites) <> 'array' or jsonb_array_length(p_convites) = 0) then
    perform recusar_campos('Convide pelo menos um fornecedor, ou guarde sem mandar', 'convites');
  end if;
  perform transicao_orcamento('CRIADO');
  insert into orcamentos (condominio_id, titulo, descricao, local, tipo, manutencao_id, pedido_id, valor_estimado, prazo_propostas, validade_minima_dias,
                          cuidador_id, estado, criado_por)
  values (p_condominio, btrim(p_titulo), btrim(p_descricao), nullif(btrim(coalesce(p_local, '')), ''), 'SERVICO', p_manutencao, p_pedido, p_valor_estimado,
          p_prazo, p_validade, p_pessoa, case when v_mandar then 'PEDINDO' else 'RASCUNHO' end, p_pessoa)
  returning * into o;
  perform registrar_historico('orcamento.criado', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object(
    'tipo', o.tipo, 'manutencao', p_manutencao, 'pedido', p_pedido, 'prazo', p_prazo, 'mandar', v_mandar)));
  v_links := incluir_convites(o, coalesce(p_convites, '[]'::jsonb), p_pessoa, v_mandar);
  return jsonb_build_object('id', o.id, 'versao', (select versao from orcamentos where id = o.id), 'estado', o.estado, 'links', v_links);
end $$;

-- Mudar o que precisa (regra 2). Com propostas já recebidas, marca editado_em: o link avisa o
-- fornecedor de que o pedido mudou e ele pode mandar outra versão.
create function plataforma_alterar_orcamento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text, p_descricao text,
                                             p_local text, p_valor_estimado bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_versao integer;
  v_mudou boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if o.estado not in ('RASCUNHO', 'PEDINDO', 'COMPARANDO') then perform recusar_motivo('Depois de escolhida, o pedido não muda', 'ORCAMENTO_FECHADO'); end if;
  perform exigir_dados_orcamento(p_pessoa, p_titulo, p_descricao, p_local, p_valor_estimado, o.manutencao_id, o.pedido_id);
  v_mudou := (btrim(p_titulo), btrim(p_descricao), nullif(btrim(coalesce(p_local, '')), '')) is distinct from (o.titulo, o.descricao, o.local);
  update orcamentos
     set titulo = btrim(p_titulo), descricao = btrim(p_descricao), local = nullif(btrim(coalesce(p_local, '')), ''), valor_estimado = p_valor_estimado,
         editado_em = case when v_mudou and propostas_recebidas(o) > 0 then app_now() else editado_em end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  perform registrar_historico('orcamento.editado', 'orcamentos', p_id::text,
    jsonb_build_object('comPropostas', propostas_recebidas(o) > 0, 'valorEstimado', p_valor_estimado));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Convidar mais (quadro 474). No rascunho, os convites ficam guardados até mandar.
create function plataforma_convidar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convites jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o orcamentos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := conferir_orcamento(exigir_orcamento(p_id));
  if o.estado not in ('RASCUNHO', 'PEDINDO', 'COMPARANDO') then perform recusar_motivo('Depois de escolhida, não se convida mais', 'ORCAMENTO_FECHADO'); end if;
  if p_convites is null or jsonb_typeof(p_convites) <> 'array' or jsonb_array_length(p_convites) = 0 then
    perform recusar_campos('Convide pelo menos um fornecedor', 'convites');
  end if;
  if o.estado = 'COMPARANDO' then perform recusar_motivo('O prazo fechou: estenda o prazo para convidar mais', 'PRAZO_FECHADO'); end if;
  return jsonb_build_object('links', incluir_convites(o, p_convites, p_pessoa, o.estado = 'PEDINDO'), 'versao', (select versao from orcamentos where id = o.id));
end $$;

-- Mandar os convites do rascunho (RASCUNHO → PEDINDO).
create function plataforma_mandar_orcamento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  v_links jsonb := '[]'::jsonb;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if o.estado <> 'RASCUNHO' then perform recusar_motivo('Os convites já foram mandados', 'JA_MANDADO'); end if;
  if not exists (select 1 from convites_orcamento where orcamento_id = o.id and estado <> 'REVOGADO') then
    perform recusar_campos('Convide pelo menos um fornecedor antes de mandar', 'convites');
  end if;
  perform exigir_prazo_propostas(o.prazo_propostas);
  perform transicao_orcamento('MANDADO');
  update orcamentos set estado = 'PEDINDO' where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  for c in select * from convites_orcamento where orcamento_id = o.id and estado <> 'REVOGADO' and mandado_em is null order by ordem loop
    v_links := v_links || jsonb_build_array(mandar_convite(c, p_pessoa));
  end loop;
  return jsonb_build_object('versao', v_versao, 'estado', 'PEDINDO', 'links', v_links);
end $$;

create function plataforma_reenviar_convite(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := conferir_orcamento(exigir_orcamento(p_id));
  c := exigir_convite_orcamento(p_convite);
  if c.orcamento_id <> o.id then raise exception 'Convite não encontrado' using errcode = 'TC404'; end if;
  if c.estado = 'REVOGADO' then perform recusar_motivo('Este link foi revogado: convide de novo', 'CONVITE_REVOGADO'); end if;
  if o.estado not in ('PEDINDO', 'ESCOLHIDA') then perform recusar_motivo('O orçamento não está pedindo propostas', 'ORCAMENTO_FECHADO'); end if;
  if o.estado = 'ESCOLHIDA' and not c.escolhido then perform recusar_motivo('Só o link do escolhido se manda de novo agora', 'NAO_ESCOLHIDO'); end if;
  v := mandar_convite(c, p_pessoa);
  perform registrar_historico('orcamento.convite_reenviado', 'orcamentos', o.id::text, jsonb_build_object('convite', c.id, 'canal', c.canal));
  return jsonb_build_object('link', v);
end $$;

-- Revogar para na hora e guarda a proposta já recebida (quadro 485).
create function plataforma_revogar_convite(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  c := exigir_convite_orcamento(p_convite);
  if c.orcamento_id <> o.id then raise exception 'Convite não encontrado' using errcode = 'TC404'; end if;
  if c.estado = 'REVOGADO' then perform recusar_motivo('Este link já foi revogado', 'CONVITE_REVOGADO'); end if;
  if c.escolhido then perform recusar_motivo('É o convite escolhido: desfaça a escolha antes', 'CONVITE_ESCOLHIDO'); end if;
  v_motivo := exigir_motivo(p_motivo);
  perform transicao_orcamento('REVOGADO', v_motivo);
  update convites_orcamento set estado = 'REVOGADO', revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = v_motivo where id = c.id;
  update codigos_sem_conta set revogado_em = app_now() where tipo = 'ORCAMENTO' and alvo_id = c.id and revogado_em is null;
  update envios_email set estado = 'CANCELADO', motivo = 'O link foi revogado' where convite_orcamento_id = c.id and estado = 'NA_FILA';
  perform registrar_historico('orcamento.convite_revogado', 'orcamentos', o.id::text, jsonb_build_object('convite', c.id, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

create function plataforma_estender_prazo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_prazo timestamptz) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := conferir_orcamento(exigir_orcamento(p_id));
  if o.estado not in ('PEDINDO', 'COMPARANDO') then perform recusar_motivo('Só se estende o prazo enquanto não há escolha', 'ORCAMENTO_FECHADO'); end if;
  perform exigir_prazo_propostas(p_prazo);
  if p_prazo <= o.prazo_propostas then perform recusar_campos('O prazo novo vem depois do atual', 'prazoPropostas'); end if;
  perform transicao_orcamento('ESTENDIDO');
  update orcamentos set estado = 'PEDINDO', prazo_propostas = p_prazo, fechamento_visto_em = null where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  update convites_orcamento set expira_em = p_prazo where orcamento_id = o.id and estado <> 'REVOGADO';
  perform registrar_historico('orcamento.estendido', 'orcamentos', o.id::text, jsonb_build_object('de', o.prazo_propostas, 'para', p_prazo));
  return jsonb_build_object('versao', v_versao, 'estado', 'PEDINDO');
end $$;

-- "Fechar antes": o prazo passa a ser agora.
create function plataforma_fechar_propostas(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := conferir_orcamento(exigir_orcamento(p_id));
  if o.estado <> 'PEDINDO' then perform recusar_motivo('O orçamento não está pedindo propostas', 'ORCAMENTO_FECHADO'); end if;
  perform transicao_orcamento('FECHADO_ANTES');
  update orcamentos set estado = 'COMPARANDO', prazo_propostas = app_now(), fechamento_visto_em = app_now()
   where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  update convites_orcamento set expira_em = app_now() where orcamento_id = o.id and estado <> 'REVOGADO';
  perform registrar_historico('orcamento.fechado_antes', 'orcamentos', o.id::text, jsonb_build_object('recebidas', propostas_recebidas(o)));
  return jsonb_build_object('versao', v_versao, 'estado', 'COMPARANDO');
end $$;

create function plataforma_pedir_confirmacao_preco(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  p propostas_orcamento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := conferir_orcamento(exigir_orcamento(p_id));
  c := exigir_convite_orcamento(p_convite);
  if c.orcamento_id <> o.id then raise exception 'Convite não encontrado' using errcode = 'TC404'; end if;
  if o.estado not in ('PEDINDO', 'COMPARANDO') then perform recusar_motivo('Só antes da escolha', 'ORCAMENTO_FECHADO'); end if;
  if c.estado = 'REVOGADO' then perform recusar_motivo('Este link foi revogado', 'CONVITE_REVOGADO'); end if;
  select * into p from propostas_orcamento where convite_id = c.id and em_uso;
  if not found then perform recusar_motivo('Este fornecedor ainda não mandou proposta', 'SEM_PROPOSTA'); end if;
  if not proposta_vencida(p) then perform recusar_motivo('A proposta ainda vale: não precisa confirmar', 'PROPOSTA_VALE'); end if;
  update propostas_orcamento set confirmacao_pedida_em = app_now() where id = p.id;
  perform registrar_historico('orcamento.confirmacao_pedida', 'orcamentos', o.id::text, jsonb_build_object('convite', c.id, 'proposta', p.id));
  return jsonb_build_object('link', mandar_convite(c, p_pessoa));
end $$;

create function plataforma_cancelar_orcamento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if o.estado in ('ENTREGUE', 'CANCELADO') then perform recusar_motivo('Este orçamento já terminou', 'ORCAMENTO_FECHADO'); end if;
  v_motivo := exigir_motivo(p_motivo);
  perform transicao_orcamento('CANCELADO', v_motivo);
  update orcamentos set estado = 'CANCELADO', cancelado_em = app_now(), cancelado_por = p_pessoa, cancelado_motivo = v_motivo
   where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  update envios_email set estado = 'CANCELADO', motivo = 'O orçamento foi cancelado'
   where estado = 'NA_FILA' and convite_orcamento_id in (select id from convites_orcamento where orcamento_id = o.id);
  if o.despesa_id is not null and (select estado from despesas_aprovacao where id = o.despesa_id) = 'AGUARDANDO' then
    perform definir_transicao('RETIRADA', 'O orçamento foi cancelado');
    update despesas_aprovacao set estado = 'RETIRADA', respondida_em = app_now(), respondida_por = p_pessoa, retirada_motivo = 'O orçamento foi cancelado'
     where id = o.despesa_id;
    perform retirar_anexos_do_orcamento(o.despesa_id, p_pessoa, 'O orçamento foi cancelado');
    perform registrar_historico('despesa.retirada', 'despesas_aprovacao', o.despesa_id::text, jsonb_build_object('motivo', 'O orçamento foi cancelado'));
  end if;
  perform registrar_historico('orcamento.cancelado', 'orcamentos', o.id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao, 'estado', 'CANCELADO');
end $$;

-- ---------------------------------------------------------------------------------------
-- Comparar (OC-02, quadro 479) e decidir (OC-06, quadro 481).

create function plataforma_comparacao(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_menor bigint;
  v_regra jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.ver');
  o := conferir_orcamento(exigir_orcamento(p_id));
  if o.estado = 'COMPARANDO' and o.fechamento_visto_em is null and pode(p_pessoa, p_condominio, 'orcamentos.editar') then
    update orcamentos set fechamento_visto_em = app_now() where id = o.id;
  end if;
  v_menor := menor_total(o);
  v_regra := regra_do_orcamento_json(o);
  return jsonb_build_object(
    'orcamento', jsonb_build_object('id', o.id, 'titulo', o.titulo, 'local', o.local, 'descricao', o.descricao, 'estado', o.estado,
                                    'valorEstimado', o.valor_estimado, 'propostaEscolhidaId', o.proposta_escolhida_id, 'motivoEscolha', o.motivo_escolha,
                                    'versao', o.versao),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'propostas', coalesce((
      select jsonb_agg(proposta_json(p) || jsonb_strip_nulls(jsonb_build_object(
               'conviteId', c.id, 'letra', letra_do_convite(c), 'nome', c.nome, 'origem', case when c.prestador_id is null then 'LINK' else 'PRESTADOR' end,
               'prestadorId', c.prestador_id, 'conviteEstado', c.estado,
               'versoes', (select count(*) from propostas_orcamento x where x.convite_id = c.id),
               'menorTotal', p.total = v_menor,
               'anteriores', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'total', x.total, 'validaAte', to_char(x.valida_ate, 'YYYY-MM-DD'),
                                                                           'enviadaEm', x.enviada_em) order by x.numero desc)
                                         from propostas_orcamento x where x.convite_id = c.id and not x.em_uso), '[]'::jsonb)))
                       order by c.ordem)
        from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
       where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO'), '[]'::jsonb),
    'menorTotal', (select c.id from propostas_orcamento p join convites_orcamento c on c.id = p.convite_id
                    where p.orcamento_id = o.id and p.em_uso and c.estado <> 'REVOGADO' and p.total = v_menor order by p.enviada_em limit 1),
    'minimo', jsonb_build_object('pedido', (v_regra ->> 'minimo')::integer, 'recebidas', propostas_recebidas(o),
                                 'atendido', (v_regra ->> 'minimoAtendido')::boolean, 'abaixoMinimo', v_regra ->> 'abaixoMinimo'),
    'regra', v_regra,
    'alcadaConselho', (select conselho_alcada from configuracao_condominio),
    'conselho', jsonb_build_object('podePedir', votos_necessarios(titulares_em_dia()) is not null, 'titulares', titulares_em_dia()),
    'pode', jsonb_build_object('decidir', pode(p_pessoa, p_condominio, 'orcamentos.decidir') and o.estado = 'COMPARANDO' and propostas_recebidas(o) > 0,
                               'pedirConfirmacao', pode(p_pessoa, p_condominio, 'orcamentos.editar') and o.estado in ('PEDINDO', 'COMPARANDO')));
end $$;

-- A despesa para aprovar ligada ao orçamento (regra 5): descrição = título, valor = total, o
-- fornecedor do convite e o PDF da proposta como anexo. O PDF copiado para a despesa aponta para o
-- mesmo arquivo; o caminho só precisa ser único entre os anexos em vigor, porque a cópia sai junto
-- com a despesa retirada ou recusada (e a escolha pode ir ao conselho mais de uma vez).
alter table arquivos_aprovacao drop constraint arquivos_aprovacao_caminho_key;
create unique index arquivos_aprovacao_caminho on arquivos_aprovacao (caminho) where retirado_em is null;

create function retirar_anexos_do_orcamento(p_despesa uuid, p_pessoa uuid, p_motivo text) returns void
language sql
set search_path = public
as $$
  update arquivos_aprovacao set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = p_motivo
   where despesa_id = p_despesa and retirado_em is null
$$;

create function abrir_despesa_do_orcamento(o orcamentos, c convites_orcamento, p propostas_orcamento, p_pessoa uuid, p_motivo text) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  q record;
  v_id uuid;
  a arquivos_orcamento;
  v_alcada bigint := (select conselho_alcada from configuracao_condominio);
begin
  select * into q from exigir_quorum();
  perform definir_transicao('PEDIDA');
  insert into despesas_aprovacao (condominio_id, descricao, valor, prestador_id, fornecedor, manutencao_id, modo, titulares, votos_necessarios, prazo,
                                  alcada, estado, pedida_por, orcamento_id)
  values (o.condominio_id, left(o.titulo, 200), p.total, c.prestador_id, case when c.prestador_id is null then c.nome end, o.manutencao_id, 'CONSELHO',
          q.titulares, q.necessarios, hoje_no_condominio() + 7, v_alcada, 'AGUARDANDO', p_pessoa, o.id)
  returning id into v_id;
  select * into a from arquivos_orcamento where id = p.pdf_arquivo_id and situacao = 'LIBERADO' and retirado_em is null;
  if found then
    insert into arquivos_aprovacao (condominio_id, despesa_id, parte, nome, tipo, tamanho_declarado, tamanho, caminho, situacao, enviado_por, verificado_em)
    values (o.condominio_id, v_id, 'DOCUMENTO', a.nome, a.tipo, a.tamanho_declarado, a.tamanho, a.caminho, 'LIBERADO', p_pessoa, app_now());
  end if;
  perform registrar_historico('despesa.pedida', 'despesas_aprovacao', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'modo', 'CONSELHO', 'titulares', q.titulares, 'necessarios', q.necessarios, 'prazo', hoje_no_condominio() + 7, 'valor', p.total,
    'orcamento', o.id, 'motivoEscolha', p_motivo, 'passaAlcada', v_alcada is not null and p.total >= v_alcada)));
  perform registrar_historico('orcamento.ao_conselho', 'orcamentos', o.id::text, jsonb_build_object('despesa', v_id, 'titulares', q.titulares, 'necessarios', q.necessarios));
  return jsonb_build_object('despesaId', v_id, 'links', abrir_votacao(null, v_id, p_pessoa));
end $$;

create function plataforma_escolher_proposta(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_proposta uuid, p_motivo text,
                                             p_quem_aprova text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  p propostas_orcamento;
  v_regra jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_menor bigint;
  v_obrigatorio boolean;
  v_despesa jsonb := '{}'::jsonb;
  v_versao integer;
  v_alcada bigint := (select conselho_alcada from configuracao_condominio);
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.decidir');
  o := conferir_orcamento(exigir_orcamento(p_id));
  perform 1 from orcamentos where id = o.id for update;
  if o.estado <> 'COMPARANDO' then perform recusar_motivo('Só se escolhe com o prazo fechado e antes de outra escolha', 'NAO_ESTA_COMPARANDO'); end if;
  select * into p from propostas_orcamento where id = p_proposta and orcamento_id = o.id and em_uso;
  if not found then perform recusar_campos('Escolha uma das propostas em uso', 'propostaId'); end if;
  c := exigir_convite_orcamento(p.convite_id);
  if c.estado = 'REVOGADO' then perform recusar_motivo('O link deste fornecedor foi revogado', 'CONVITE_REVOGADO'); end if;
  if proposta_vencida(p) then perform recusar_motivo('A proposta venceu: peça a confirmação do preço antes', 'PROPOSTA_VENCIDA'); end if;
  if p_quem_aprova is null or p_quem_aprova not in ('PESSOA', 'CONSELHO') then perform recusar_campos('Diga quem aprova', 'quemAprova'); end if;
  v_regra := regra_do_orcamento_json(o);
  v_menor := menor_total(o);
  if not (v_regra ->> 'minimoAtendido')::boolean and (v_regra ->> 'abaixoMinimo') = 'BLOQUEIA' then
    perform recusar_motivo(format('A regra do condomínio pede %s propostas e chegaram %s', v_regra ->> 'minimo', v_regra ->> 'recebidas'), 'ABAIXO_DO_MINIMO');
  end if;
  v_obrigatorio := p.total > v_menor or not (v_regra ->> 'minimoAtendido')::boolean;
  if v_obrigatorio and v_motivo is null then
    perform recusar_campos(case when p.total > v_menor then 'Não é a de menor total: escreva o motivo' else 'Abaixo do mínimo de propostas: escreva o motivo' end, 'motivo');
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 1000 then perform recusar_campos('Motivo de 3 a 1000 caracteres', 'motivo'); end if;
  if (v_regra -> 'faixa' ->> 'quemAprova') = 'CONSELHO' and p_quem_aprova = 'PESSOA' then
    perform recusar_campos('A regra do condomínio manda esta faixa ao conselho', 'quemAprova');
  end if;
  perform transicao_orcamento('ESCOLHIDA');
  update orcamentos
     set estado = 'ESCOLHIDA', proposta_escolhida_id = p.id, motivo_escolha = v_motivo, escolhida_em = app_now(), escolhida_por = p_pessoa,
         quem_aprova = p_quem_aprova, aprovada_em = case when p_quem_aprova = 'PESSOA' then app_now() end, despesa_id = null
   where id = o.id and versao = p_versao returning * into o;
  if o.id is null then perform conflito_versao('orcamentos', p_id); end if;
  update convites_orcamento set escolhido = true where id = c.id;
  update convites_orcamento set resultado_avisado_em = app_now() where orcamento_id = o.id and id <> c.id and estado <> 'REVOGADO';
  perform registrar_historico('orcamento.escolhida', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object(
    'convite', c.id, 'proposta', p.id, 'total', p.total, 'menorTotal', v_menor, 'motivo', v_motivo, 'quemAprova', p_quem_aprova,
    'minimoAtendido', (v_regra ->> 'minimoAtendido')::boolean, 'passaAlcada', v_alcada is not null and p.total > v_alcada)));
  if p_quem_aprova = 'CONSELHO' then
    v_despesa := abrir_despesa_do_orcamento(o, c, p, p_pessoa, v_motivo);
    update orcamentos set despesa_id = (v_despesa ->> 'despesaId')::uuid where id = o.id;
  end if;
  return jsonb_build_object('versao', (select versao from orcamentos where id = o.id), 'estado', 'ESCOLHIDA',
                            'passaAlcada', v_alcada is not null and p.total > v_alcada) || v_despesa;
end $$;

-- Trocar a escolha enquanto não aprovada nem aceita (regra 2).
create function plataforma_desfazer_escolha(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  x despesas_aprovacao;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.decidir');
  o := exigir_orcamento(p_id);
  perform 1 from orcamentos where id = o.id for update;
  if o.estado <> 'ESCOLHIDA' then perform recusar_motivo('Não há escolha para desfazer', 'NAO_ESCOLHIDA'); end if;
  if exists (select 1 from convites_orcamento where orcamento_id = o.id and escolhido and aceite_em is not null) then
    perform recusar_motivo('O fornecedor já aceitou: cancele o orçamento se precisar', 'JA_ACEITA');
  end if;
  if o.despesa_id is not null then
    select * into x from despesas_aprovacao where id = o.despesa_id for update;
    if x.estado <> 'AGUARDANDO' then perform recusar_motivo('Quem aprova já respondeu', 'JA_RESPONDIDA'); end if;
  end if;
  perform transicao_orcamento('ESCOLHA_DESFEITA');
  update orcamentos set estado = 'COMPARANDO', proposta_escolhida_id = null, motivo_escolha = null, escolhida_em = null, escolhida_por = null,
                        quem_aprova = null, aprovada_em = null, despesa_id = null
   where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  update convites_orcamento set escolhido = false, resultado_avisado_em = null where orcamento_id = o.id and (escolhido or resultado_avisado_em is not null);
  if x.id is not null then
    perform definir_transicao('RETIRADA', 'A escolha foi desfeita');
    update despesas_aprovacao set estado = 'RETIRADA', respondida_em = app_now(), respondida_por = p_pessoa, retirada_motivo = 'A escolha do orçamento foi desfeita'
     where id = x.id;
    update envios_email set estado = 'CANCELADO', motivo = 'A despesa foi retirada'
     where estado = 'NA_FILA' and link_conselho_id in (select id from links_conselho where despesa_id = x.id);
    perform retirar_anexos_do_orcamento(x.id, p_pessoa, 'A escolha do orçamento foi desfeita');
    perform registrar_historico('despesa.retirada', 'despesas_aprovacao', x.id::text, jsonb_build_object('motivo', 'A escolha do orçamento foi desfeita'));
  end if;
  perform registrar_historico('orcamento.escolha_desfeita', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object('despesa', x.id)));
  return jsonb_build_object('versao', v_versao, 'estado', 'COMPARANDO');
end $$;

-- Aprovada (quando houve despesa) e aceita: COMPRANDO (regra 2).
create function avancar_para_compra(o orcamentos) returns boolean
language plpgsql
set search_path = public
as $$
begin
  select * into o from orcamentos where id = o.id;
  if o.estado <> 'ESCOLHIDA' or o.aprovada_em is null
     or not exists (select 1 from convites_orcamento where orcamento_id = o.id and escolhido and aceite_em is not null) then
    return false;
  end if;
  perform transicao_orcamento('APROVADA_E_ACEITA');
  update orcamentos set estado = 'COMPRANDO' where id = o.id;
  return true;
end $$;

-- O fornecedor sem cadastro que aceita vira prestador (OC-10); com o nome já cadastrado, liga ao existente.
create function prestador_do_aceite(o orcamentos, c convites_orcamento) returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  if c.prestador_id is not null then return c.prestador_id; end if;
  select id into v_id from prestadores where lower(btrim(nome)) = lower(btrim(c.nome)) and arquivado_em is null;
  if v_id is null then
    insert into prestadores (condominio_id, nome, servico, telefone, email, acordo, desde, criado_por, orcamento_origem_id)
    values (o.condominio_id, c.nome, left(o.titulo, 80), telefone_do_convite(c.celular), c.email, 'CHAMADO', hoje_no_condominio(),
            coalesce(contexto_pessoa(), o.cuidador_id), o.id)
    returning id into v_id;
    perform registrar_historico('orcamento.prestador_criado', 'orcamentos', o.id::text, jsonb_build_object('convite', c.id, 'prestador', v_id));
    perform registrar_historico('prestador.criado', 'prestadores', v_id::text, jsonb_build_object('orcamento', o.id, 'acordo', 'CHAMADO'));
  end if;
  update convites_orcamento set prestador_id = v_id where id = c.id;
  return v_id;
end $$;

create function registrar_aceite(o orcamentos, c convites_orcamento, p_nome text, p_fora boolean, p_em timestamptz) returns jsonb
language plpgsql
set search_path = public
as $$
declare v_prestador uuid;
begin
  if c.aceite_em is not null then perform recusar_motivo('O aceite já foi registrado', 'JA_ACEITA'); end if;
  if o.estado <> 'ESCOLHIDA' then perform recusar_motivo('O orçamento não espera aceite', 'NAO_ESPERA_ACEITE'); end if;
  if not c.escolhido then perform recusar_motivo('Esta proposta não foi a escolhida', 'NAO_ESCOLHIDO'); end if;
  update convites_orcamento set aceite_em = p_em, aceite_nome = btrim(p_nome), aceite_fora_do_link = p_fora where id = c.id returning * into c;
  v_prestador := prestador_do_aceite(o, c);
  if o.despesa_id is not null then
    update despesas_aprovacao set prestador_id = v_prestador, fornecedor = null where id = o.despesa_id and estado = 'AGUARDANDO' and prestador_id is null;
  end if;
  perform registrar_historico(case when p_fora then 'orcamento.aceite_fora' else 'orcamento.aceite' end, 'orcamentos', o.id::text,
    jsonb_build_object('convite', c.id, 'prestador', v_prestador, 'em', p_em));
  perform avisar_orcamento(o, 'ACEITE', c.id);
  perform avancar_para_compra(o);
  return jsonb_build_object('estado', (select estado from orcamentos where id = o.id), 'prestadorId', v_prestador);
end $$;

create function plataforma_aceite_fora_do_link(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  c convites_orcamento;
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  perform 1 from orcamentos where id = o.id for update;
  if o.versao <> p_versao then perform conflito_versao('orcamentos', p_id); end if;
  if p_data is null or p_data > hoje_no_condominio() then perform recusar_campos('Diga quando aceitou (até hoje)', 'data'); end if;
  select * into c from convites_orcamento where orcamento_id = o.id and escolhido;
  if not found then perform recusar_motivo('Não há proposta escolhida', 'NAO_ESCOLHIDA'); end if;
  v := registrar_aceite(o, c, c.nome, true, (p_data + 1)::timestamp at time zone fuso_do_condominio() - interval '1 second');
  return v || jsonb_build_object('versao', (select versao from orcamentos where id = o.id));
end $$;

-- A despesa ligada fecha: aprovada marca aprovada_em (e, com aceite, vai a COMPRANDO); recusada ou
-- retirada devolve a COMPARANDO, com a justificativa à vista (regra 5).
create function despesa_do_orcamento_fechou() returns trigger
language plpgsql
set search_path = public
as $$
declare o orcamentos;
begin
  select * into o from orcamentos where id = new.orcamento_id and despesa_id = new.id for update;
  if not found or o.estado <> 'ESCOLHIDA' then return new; end if;
  if new.estado = 'APROVADA' then
    update orcamentos set aprovada_em = coalesce(new.respondida_em, app_now()) where id = o.id;
    perform registrar_historico('orcamento.aprovada', 'orcamentos', o.id::text, jsonb_build_object('despesa', new.id, 'justificativa', new.justificativa));
    perform avisar_orcamento(o, 'APROVADA', null, 'APROVADA');
    perform avancar_para_compra(o);
  else
    perform definir_transicao('ESCOLHA_RECUSADA', coalesce(new.justificativa, new.retirada_motivo), contexto_pessoa() is null);
    update orcamentos set estado = 'COMPARANDO', proposta_escolhida_id = null, motivo_escolha = null, escolhida_em = null, escolhida_por = null,
                          quem_aprova = null, aprovada_em = null, despesa_id = null, fechamento_visto_em = null
     where id = o.id;
    update convites_orcamento set escolhido = false, resultado_avisado_em = null where orcamento_id = o.id and (escolhido or resultado_avisado_em is not null);
    perform retirar_anexos_do_orcamento(new.id, coalesce(contexto_pessoa(), o.cuidador_id), 'A despesa do orçamento foi ' || lower(new.estado));
    perform registrar_historico('orcamento.recusada', 'orcamentos', o.id::text,
      jsonb_strip_nulls(jsonb_build_object('despesa', new.id, 'estado', new.estado, 'justificativa', coalesce(new.justificativa, new.retirada_motivo))));
    perform avisar_orcamento(o, 'APROVADA', null, 'RECUSADA');
  end if;
  return new;
end $$;
create trigger despesa_do_orcamento_fechou after update of estado on despesas_aprovacao for each row
  when (new.orcamento_id is not null and old.estado = 'AGUARDANDO' and new.estado <> 'AGUARDANDO')
  execute function despesa_do_orcamento_fechou();

-- ---------------------------------------------------------------------------------------
-- Compra e entrega (OC-01, quadro 482).

create function plataforma_registrar_compra(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date, p_valor bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if o.estado <> 'COMPRANDO' then perform recusar_motivo('A compra se registra depois da aprovação e do aceite', 'NAO_ESTA_COMPRANDO'); end if;
  if o.comprada_em is not null then perform recusar_motivo('A compra já foi registrada', 'JA_COMPRADA'); end if;
  if p_data is null or p_data > hoje_no_condominio() then perform recusar_campos('Diga a data da compra (até hoje)', 'data'); end if;
  if p_valor is null or p_valor <= 0 then perform recusar_campos('O valor fechado, em reais, maior que zero', 'valorFechado'); end if;
  update orcamentos set comprada_em = p_data, valor_fechado = p_valor where id = o.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  perform registrar_historico('orcamento.compra', 'orcamentos', o.id::text, jsonb_build_object(
    'data', p_data, 'valorFechado', p_valor, 'valorProposta', (select total from propostas_orcamento where id = o.proposta_escolhida_id)));
  return jsonb_build_object('versao', v_versao);
end $$;

create function plataforma_registrar_entrega(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_data date, p_parcial boolean, p_obs text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_versao integer;
  v_obs text := nullif(btrim(coalesce(p_obs, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if o.estado <> 'COMPRANDO' then perform recusar_motivo('A entrega se registra depois da compra', 'NAO_ESTA_COMPRANDO'); end if;
  if o.comprada_em is null then perform recusar_motivo('Registre a compra antes da entrega', 'SEM_COMPRA'); end if;
  if p_data is null or p_data > hoje_no_condominio() or p_data < o.comprada_em then perform recusar_campos('Diga a data da entrega (da compra até hoje)', 'data'); end if;
  if length(v_obs) > 500 then perform recusar_campos('Observação até 500 caracteres', 'observacao'); end if;
  if coalesce(p_parcial, false) then
    update orcamentos set entrega_parcial = true, entrega_obs = coalesce(v_obs, entrega_obs) where id = o.id and versao = p_versao returning versao into v_versao;
  else
    perform transicao_orcamento('ENTREGUE');
    update orcamentos set estado = 'ENTREGUE', entregue_em = p_data, entrega_obs = coalesce(v_obs, entrega_obs) where id = o.id and versao = p_versao
    returning versao into v_versao;
  end if;
  if v_versao is null then perform conflito_versao('orcamentos', p_id); end if;
  perform registrar_historico('orcamento.entrega', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object('data', p_data, 'parcial', coalesce(p_parcial, false), 'observacao', v_obs)));
  return jsonb_build_object('versao', v_versao, 'estado', (select estado from orcamentos where id = o.id));
end $$;

-- ---------------------------------------------------------------------------------------
-- Regras (OC-05, quadro 484).

create function plataforma_regras_orcamento(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  return regras_orcamento_json() || jsonb_build_object(
    'versao', (select versao from configuracao_condominio),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar')));
end $$;

create function plataforma_salvar_regras_orcamento(p_pessoa uuid, p_condominio uuid, p_versao integer, p_ligada boolean, p_faixas jsonb,
                                                   p_abaixo_minimo text, p_prazo_dias integer, p_validade_dias integer, p_link_dias integer,
                                                   p_alcada bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
  x record;
  v_anterior bigint := 0;
  v_n integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_abaixo_minimo is null or p_abaixo_minimo not in ('MOTIVO', 'BLOQUEIA') then perform recusar_campos('Diga o que acontece abaixo do mínimo', 'abaixoMinimo'); end if;
  if p_prazo_dias is null or p_prazo_dias not between 1 and 30 then perform recusar_campos('O prazo padrão vai de 1 a 30 dias', 'prazoDias'); end if;
  if p_validade_dias is null or p_validade_dias not between 1 and 180 then perform recusar_campos('A validade mínima vai de 1 a 180 dias', 'validadeDias'); end if;
  if p_link_dias is null or p_link_dias not between 1 and 60 then perform recusar_campos('O link vale de 1 a 60 dias', 'linkDias'); end if;
  if p_alcada is not null and p_alcada <= 0 then perform recusar_campos('A alçada é um valor em reais maior que zero', 'alcadaConselho'); end if;
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) > 6 then perform recusar_campos('Até 6 faixas', 'faixas'); end if;
  v_n := jsonb_array_length(p_faixas);
  if coalesce(p_ligada, false) and v_n = 0 then perform recusar_campos('Com a regra ligada, inclua pelo menos uma faixa', 'faixas'); end if;
  for x in select value as f, n from jsonb_array_elements(p_faixas) with ordinality t(value, n) loop
    if jsonb_typeof(x.f -> 'minimo') <> 'number' or (x.f ->> 'minimo')::numeric not between 1 and 10 or (x.f ->> 'minimo')::numeric <> trunc((x.f ->> 'minimo')::numeric) then
      perform recusar_campos(format('Faixa %s: mínimo de 1 a 10 propostas', x.n), 'faixas');
    end if;
    if coalesce(x.f ->> 'quemAprova', '') not in ('SINDICO', 'CONSELHO') then perform recusar_campos(format('Faixa %s: diga quem aprova', x.n), 'faixas'); end if;
    if x.f ? 'ate' and jsonb_typeof(x.f -> 'ate') = 'number' then
      if (x.f ->> 'ate')::numeric <= v_anterior then perform recusar_campos(format('Faixa %s: cada faixa começa onde a anterior termina', x.n), 'faixas'); end if;
      v_anterior := (x.f ->> 'ate')::bigint;
    elsif x.n < v_n then
      perform recusar_campos(format('Faixa %s: só a última faixa fica sem teto', x.n), 'faixas');
    end if;
  end loop;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio
     set orcamento_regra_ligada = coalesce(p_ligada, false), orcamento_abaixo_minimo = p_abaixo_minimo, orcamento_prazo_dias = p_prazo_dias,
         orcamento_validade_dias = p_validade_dias, orcamento_link_dias = p_link_dias, conselho_alcada = p_alcada
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  update faixas_orcamento set retirada_em = app_now() where retirada_em is null;
  insert into faixas_orcamento (condominio_id, ordem, ate, minimo, quem_aprova, criada_por)
  select p_condominio, t.n, case when jsonb_typeof(t.value -> 'ate') = 'number' then (t.value ->> 'ate')::bigint end, (t.value ->> 'minimo')::smallint,
         t.value ->> 'quemAprova', p_pessoa
    from jsonb_array_elements(p_faixas) with ordinality t(value, n);
  perform registrar_historico('regras_orcamento.alteradas', 'configuracao_condominio', v_antes.id::text, jsonb_build_object(
    'antes', jsonb_build_object('ligada', v_antes.orcamento_regra_ligada, 'abaixoMinimo', v_antes.orcamento_abaixo_minimo, 'prazoDias', v_antes.orcamento_prazo_dias,
                                'validadeDias', v_antes.orcamento_validade_dias, 'linkDias', v_antes.orcamento_link_dias, 'alcada', v_antes.conselho_alcada),
    'depois', jsonb_build_object('ligada', coalesce(p_ligada, false), 'faixas', p_faixas, 'abaixoMinimo', p_abaixo_minimo, 'prazoDias', p_prazo_dias,
                                 'validadeDias', p_validade_dias, 'linkDias', p_link_dias, 'alcada', p_alcada)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Anexos do pedido e a nota fiscal (a gestão): iniciar → verificar → link → tirar, como as despesas.

create function pode_anexar_orcamento(p_pessoa uuid, o orcamentos, p_parte text) returns boolean
language sql stable
set search_path = public
as $$
  select pode(p_pessoa, o.condominio_id, 'orcamentos.editar')
     and ((p_parte = 'PEDIDO' and o.estado in ('RASCUNHO', 'PEDINDO', 'COMPARANDO'))
          or (p_parte = 'NOTA_FISCAL' and o.estado in ('COMPRANDO', 'ENTREGUE')))
$$;

create function plataforma_iniciar_anexo_orcamento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_parte text, p_nome text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orcamentos;
  v_id uuid := gen_random_uuid();
  v_parte text := coalesce(p_parte, 'PEDIDO');
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  o := exigir_orcamento(p_id);
  if v_parte not in ('PEDIDO', 'NOTA_FISCAL') then perform recusar_campos('Diga se é arquivo do pedido ou a nota fiscal', 'parte'); end if;
  if not pode_anexar_orcamento(p_pessoa, o, v_parte) then raise exception 'Sem permissão para juntar anexo aqui' using errcode = 'TC401'; end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP) e PDF', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from orcamentos where id = o.id for update;
  if (select count(*) from arquivos_orcamento where orcamento_id = o.id and parte = 'PEDIDO' and retirado_em is null) >= 10 and v_parte = 'PEDIDO' then
    perform recusar_motivo('Já há 10 anexos', 'LIMITE_ARQUIVOS');
  end if;
  v_caminho := p_condominio || '/orcamentos/' || o.id || '/' || v_id;
  insert into arquivos_orcamento (id, condominio_id, orcamento_id, parte, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, o.id, v_parte, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function exigir_anexo_orcamento(p_arquivo uuid) returns arquivos_orcamento
language plpgsql stable
set search_path = public
as $$
declare a arquivos_orcamento;
begin
  select * into a from arquivos_orcamento where id = p_arquivo and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return a;
end $$;

create function plataforma_anexo_orcamento_a_verificar(p_pessoa uuid, p_condominio uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_orcamento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  a := exigir_anexo_orcamento(p_arquivo);
  if a.enviado_por is distinct from p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

-- Marca o resultado da verificação; a nota fiscal liberada fica ligada ao orçamento.
create function liberar_anexo_orcamento(a arquivos_orcamento, p_liberado boolean, p_tamanho integer, p_motivo text) returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if p_liberado then
    update arquivos_orcamento set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
    if a.parte = 'NOTA_FISCAL' then update orcamentos set nota_fiscal_arquivo_id = a.id where id = a.orcamento_id; end if;
  else
    update arquivos_orcamento set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
  end if;
  if a.parte <> 'PROPOSTA' then
    perform registrar_historico(case when p_liberado then 'orcamento.anexo_enviado' else 'orcamento.anexo_recusado' end, 'orcamentos', a.orcamento_id::text,
      jsonb_strip_nulls(jsonb_build_object('arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte, 'motivo', case when not p_liberado then btrim(p_motivo) end)));
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_verificar_anexo_orcamento(p_pessoa uuid, p_condominio uuid, p_arquivo uuid, p_liberado boolean, p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_orcamento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  a := exigir_anexo_orcamento(p_arquivo);
  if a.enviado_por is distinct from p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return liberar_anexo_orcamento(a, p_liberado, p_tamanho, p_motivo);
end $$;

-- Abrir: quem vê orçamentos abre o pedido, a nota fiscal e o PDF de qualquer proposta.
create function plataforma_abrir_anexo_orcamento(p_pessoa uuid, p_condominio uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_orcamento;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.ver');
  a := exigir_anexo_orcamento(p_arquivo);
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

create function plataforma_tirar_anexo_orcamento(p_pessoa uuid, p_condominio uuid, p_arquivo uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a arquivos_orcamento;
  o orcamentos;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'orcamentos.editar');
  a := exigir_anexo_orcamento(p_arquivo);
  o := exigir_orcamento(a.orcamento_id);
  if a.parte = 'PROPOSTA' or not pode_anexar_orcamento(p_pessoa, o, a.parte) then
    raise exception 'Sem permissão para tirar este anexo' using errcode = 'TC401';
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_orcamento set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  if o.nota_fiscal_arquivo_id = a.id then update orcamentos set nota_fiscal_arquivo_id = null where id = o.id; end if;
  perform registrar_historico('orcamento.anexo_tirado', 'orcamentos', o.id::text, jsonb_build_object('arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- O link do fornecedor (/o/<código>, quadros 476 a 478). Sem conta: o código entra no condomínio
-- como sistema. O fornecedor nunca recebe os outros convidados nem os outros preços.

create function exigir_convite_por_codigo(c codigos_sem_conta) returns convites_orcamento
language plpgsql
set search_path = public
as $$
declare l convites_orcamento;
begin
  select * into l from convites_orcamento where id = c.alvo_id;
  if l.id is null then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  return l;
end $$;

-- O estado da página: VER, RECUSOU, ENVIADA, CONFIRMAR_PRECO, ESCOLHIDA (aceitar), ACEITA,
-- NAO_ESCOLHIDA, PRAZO_ACABOU, CANCELADO e NAO_VALE (LINK_TROCADO, REVOGADO, VENCIDO).
create function estado_link_orcamento(l convites_orcamento, o orcamentos, p propostas_orcamento, p_trocado boolean, out estado text, out motivo text)
language plpgsql stable
set search_path = public
as $$
declare v_link_dias integer := (select orcamento_link_dias from configuracao_condominio);
begin
  if l.estado = 'REVOGADO' then estado := 'NAO_VALE'; motivo := 'REVOGADO'; return; end if;
  if p_trocado then estado := 'NAO_VALE'; motivo := 'LINK_TROCADO'; return; end if;
  if o.estado = 'CANCELADO' then estado := 'CANCELADO'; return; end if;
  if l.escolhido and o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE') then
    estado := case when l.aceite_em is not null then 'ACEITA' else 'ESCOLHIDA' end; return;
  end if;
  if o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE') then estado := 'NAO_ESCOLHIDA'; return; end if;
  if l.estado = 'RECUSOU' then estado := 'RECUSOU'; return; end if;
  if app_now() > l.expira_em + make_interval(days => v_link_dias) then estado := 'NAO_VALE'; motivo := 'VENCIDO'; return; end if;
  if p.id is not null and p.confirmacao_pedida_em is not null and p.confirmada_em is null and proposta_vencida(p) then estado := 'CONFIRMAR_PRECO'; return; end if;
  if o.estado = 'COMPARANDO' or l.expira_em <= app_now() then
    estado := case when p.id is not null then 'ENVIADA' else 'PRAZO_ACABOU' end; return;
  end if;
  estado := case when p.id is not null then 'ENVIADA' else 'VER' end;
end $$;

create function orcamento_publico_json(l convites_orcamento, p_trocado boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  o orcamentos;
  p propostas_orcamento;
  r record;
  v_pode_mandar boolean;
begin
  select * into o from orcamentos where id = l.orcamento_id;
  select * into p from propostas_orcamento where convite_id = l.id and em_uso;
  select * into r from estado_link_orcamento(l, o, p, p_trocado);
  if r.estado = 'NAO_VALE' then
    return jsonb_strip_nulls(jsonb_build_object('condominio', nome_do_condominio(), 'estado', r.estado, 'motivo', r.motivo, 'fornecedor', jsonb_build_object('nome', l.nome)));
  end if;
  v_pode_mandar := r.estado in ('VER', 'ENVIADA', 'CONFIRMAR_PRECO') and o.estado = 'PEDINDO' and l.expira_em > app_now();
  return jsonb_strip_nulls(jsonb_build_object(
    'condominio', nome_do_condominio(), 'estado', r.estado, 'motivo', r.motivo,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'fornecedor', jsonb_build_object('nome', l.nome, 'canal', l.canal),
    'pedido', jsonb_strip_nulls(jsonb_build_object(
      'titulo', o.titulo, 'descricao', o.descricao, 'local', o.local, 'tipo', o.tipo, 'prazoPropostas', o.prazo_propostas,
      'prazoTexto', prazo_texto(o.prazo_propostas), 'validadeMinimaDias', o.validade_minima_dias, 'alteradoEm', o.editado_em,
      'quem', jsonb_build_object('nome', nome_pessoa(o.cuidador_id), 'cargo', cargo_da_pessoa(o.cuidador_id)),
      'arquivos', arquivos_orcamento_json(o, false))),
    'proposta', case when p.id is not null then proposta_json(p) end,
    'versoes', (select count(*) from propostas_orcamento x where x.convite_id = l.id),
    'recusa', case when l.estado = 'RECUSOU' then jsonb_strip_nulls(jsonb_build_object('em', l.recusou_em, 'motivo', l.recusa_motivo)) end,
    'aceite', case when l.aceite_em is not null then jsonb_build_object('em', l.aceite_em, 'nome', l.aceite_nome) end,
    'escolha', case when l.escolhido and o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE') then jsonb_strip_nulls(jsonb_build_object(
                 'em', o.escolhida_em, 'total', (select total from propostas_orcamento where id = o.proposta_escolhida_id),
                 'aprovada', o.aprovada_em is not null, 'esperaAprovacao', o.aprovada_em is null)) end,
    'pode', jsonb_build_object('recusar', r.estado = 'VER', 'mandarProposta', v_pode_mandar,
                               'confirmarPreco', r.estado = 'CONFIRMAR_PRECO', 'aceitar', r.estado = 'ESCOLHIDA')));
end $$;

create function publico_orcamento(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l convites_orcamento;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'ORCAMENTO');
  l := exigir_convite_por_codigo(c);
  perform conferir_orcamento(exigir_orcamento(l.orcamento_id));
  if c.revogado_em is null and l.estado <> 'REVOGADO' then
    update convites_orcamento set aberturas = aberturas + 1, ultima_abertura_em = app_now() where id = l.id returning * into l;
  end if;
  return orcamento_publico_json(l, c.revogado_em is not null);
end $$;

-- O que vale para agir pelo link: código vivo, convite não revogado.
create function exigir_link_orcamento_vivo(p_codigo text) returns convites_orcamento
language plpgsql
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l convites_orcamento;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'ORCAMENTO');
  l := exigir_convite_por_codigo(c);
  if l.estado = 'REVOGADO' then perform recusar_motivo('O condomínio cancelou este link', 'REVOGADO'); end if;
  if c.revogado_em is not null then perform recusar_motivo('Um link novo foi mandado e este parou', 'LINK_TROCADO'); end if;
  perform conferir_orcamento(exigir_orcamento(l.orcamento_id));
  select * into l from convites_orcamento where id = l.id for update;
  return l;
end $$;

create function publico_recusar_orcamento(p_codigo text, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  o := exigir_orcamento(l.orcamento_id);
  if o.estado <> 'PEDINDO' or l.expira_em <= app_now() then perform recusar_motivo('O prazo para propostas acabou', 'PRAZO_ACABOU'); end if;
  if l.estado <> 'CONVIDADO' then perform recusar_motivo('Você já respondeu a este convite', 'JA_RESPONDEU'); end if;
  if length(v_motivo) > 500 then perform recusar_campos('Motivo até 500 caracteres', 'motivo'); end if;
  perform transicao_orcamento('RECUSOU');
  update convites_orcamento set estado = 'RECUSOU', recusou_em = app_now(), recusa_motivo = v_motivo where id = l.id returning * into l;
  perform registrar_historico('orcamento.recusou', 'orcamentos', o.id::text, jsonb_strip_nulls(jsonb_build_object('convite', l.id, 'motivo', v_motivo)));
  perform avisar_orcamento(o, 'RECUSOU', l.id);
  return orcamento_publico_json(l, false);
end $$;

-- A proposta pelo link (quadro 477): versão nova a cada envio até o prazo; a anterior fica guardada.
create function publico_enviar_proposta(p_codigo text, p_valor bigint, p_frete_incluso boolean, p_frete bigint, p_marca_modelo text, p_prazo_execucao text,
                                        p_garantia text, p_valida_ate date, p_pagamento text, p_inclui text, p_nao_inclui text, p_pdf uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
  v_numero integer;
  v_frete bigint := case when coalesce(p_frete_incluso, true) then 0 else coalesce(p_frete, 0) end;
  v_aviso text;
  p propostas_orcamento;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  o := exigir_orcamento(l.orcamento_id);
  if o.estado <> 'PEDINDO' or l.expira_em <= app_now() then perform recusar_motivo('O prazo para propostas acabou', 'PRAZO_ACABOU'); end if;
  if p_valor is null or p_valor <= 0 then perform recusar_campos('O valor, em reais, maior que zero', 'valor'); end if;
  if v_frete < 0 then perform recusar_campos('O frete não pode ser negativo', 'frete'); end if;
  if length(nullif(btrim(coalesce(p_marca_modelo, '')), '')) > 200 then perform recusar_campos('Marca e modelo até 200 caracteres', 'marcaModelo'); end if;
  if length(btrim(coalesce(p_prazo_execucao, ''))) not between 1 and 120 then perform recusar_campos('Diga o prazo para fazer (até 120 caracteres)', 'prazoExecucao'); end if;
  if length(nullif(btrim(coalesce(p_garantia, '')), '')) > 120 then perform recusar_campos('Garantia até 120 caracteres', 'garantia'); end if;
  if p_valida_ate is null or p_valida_ate < hoje_no_condominio() then perform recusar_campos('Até quando o preço vale: hoje ou depois', 'validaAte'); end if;
  if length(nullif(btrim(coalesce(p_pagamento, '')), '')) > 200 then perform recusar_campos('Pagamento até 200 caracteres', 'pagamento'); end if;
  if length(btrim(coalesce(p_inclui, ''))) not between 3 and 2000 then perform recusar_campos('Diga o que inclui (3 a 2000 caracteres)', 'inclui'); end if;
  if length(nullif(btrim(coalesce(p_nao_inclui, '')), '')) > 2000 then perform recusar_campos('O que não inclui até 2000 caracteres', 'naoInclui'); end if;
  if p_pdf is not null and not exists (select 1 from arquivos_orcamento where id = p_pdf and convite_id = l.id and parte = 'PROPOSTA'
                                                                           and situacao = 'LIBERADO' and retirado_em is null) then
    perform recusar_campos('Envie o PDF antes', 'pdfArquivoId');
  end if;
  if p_valida_ate < hoje_no_condominio() + o.validade_minima_dias then
    v_aviso := format('O condomínio pediu validade de pelo menos %s dias; a sua vale %s dias', o.validade_minima_dias, p_valida_ate - hoje_no_condominio());
  end if;
  update propostas_orcamento set em_uso = false where convite_id = l.id and em_uso;
  select coalesce(max(numero), 0) + 1 into v_numero from propostas_orcamento where convite_id = l.id;
  insert into propostas_orcamento (condominio_id, orcamento_id, convite_id, numero, valor, frete_incluso, frete, marca_modelo, prazo_execucao, garantia,
                                   valida_ate, pagamento, inclui, nao_inclui, pdf_arquivo_id)
  values (l.condominio_id, o.id, l.id, v_numero, p_valor, coalesce(p_frete_incluso, true), v_frete, nullif(btrim(coalesce(p_marca_modelo, '')), ''),
          btrim(p_prazo_execucao), nullif(btrim(coalesce(p_garantia, '')), ''), p_valida_ate, nullif(btrim(coalesce(p_pagamento, '')), ''),
          btrim(p_inclui), nullif(btrim(coalesce(p_nao_inclui, '')), ''), p_pdf)
  returning * into p;
  if l.estado <> 'RESPONDEU' then
    perform transicao_orcamento('PROPOSTA');
    update convites_orcamento set estado = 'RESPONDEU' where id = l.id returning * into l;
  end if;
  perform registrar_historico('orcamento.proposta', 'orcamentos', o.id::text, jsonb_build_object(
    'convite', l.id, 'proposta', p.id, 'numero', v_numero, 'total', p.total, 'validaAte', p_valida_ate, 'abaixoDaValidade', v_aviso is not null));
  perform avisar_orcamento(o, 'PROPOSTA_RECEBIDA', l.id, v_numero::text);
  return orcamento_publico_json(l, false) || jsonb_strip_nulls(jsonb_build_object('numero', v_numero, 'avisoValidade', v_aviso));
end $$;

-- Confirmar o preço de uma proposta vencida: a validade passa a ser a nova data.
create function publico_confirmar_preco(p_codigo text, p_valida_ate date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
  p propostas_orcamento;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  o := exigir_orcamento(l.orcamento_id);
  select * into p from propostas_orcamento where convite_id = l.id and em_uso;
  if not found then perform recusar_motivo('Mande a proposta antes', 'SEM_PROPOSTA'); end if;
  if o.estado not in ('PEDINDO', 'COMPARANDO') then perform recusar_motivo('O condomínio já decidiu', 'ORCAMENTO_FECHADO'); end if;
  if p.confirmacao_pedida_em is null or not proposta_vencida(p) then perform recusar_motivo('O condomínio não pediu confirmação do preço', 'SEM_PEDIDO_DE_CONFIRMACAO'); end if;
  if p_valida_ate is null or p_valida_ate < hoje_no_condominio() then perform recusar_campos('Até quando o preço vale: hoje ou depois', 'validaAte'); end if;
  update propostas_orcamento set confirmada_em = app_now(), valida_ate = p_valida_ate where id = p.id;
  perform registrar_historico('orcamento.preco_confirmado', 'orcamentos', o.id::text, jsonb_build_object('convite', l.id, 'proposta', p.id, 'validaAte', p_valida_ate));
  perform avisar_orcamento(o, 'PRECO_CONFIRMADO', l.id, to_char(app_now(), 'YYYY-MM-DD HH24:MI'));
  return orcamento_publico_json(l, false);
end $$;

-- O aceite pelo link (quadro 478).
create function publico_aceitar_orcamento(p_codigo text, p_nome text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  o := exigir_orcamento(l.orcamento_id);
  if length(btrim(coalesce(p_nome, ''))) not between 2 and 120 then perform recusar_campos('Diga quem confirma (2 a 120 caracteres)', 'nome'); end if;
  perform registrar_aceite(o, l, p_nome, false, app_now());
  select * into l from convites_orcamento where id = l.id;
  return orcamento_publico_json(l, false);
end $$;

-- O PDF da proposta pelo link: iniciar e verificar, com os mesmos limites.
create function publico_iniciar_pdf_orcamento(p_codigo text, p_nome text, p_tipo text, p_tamanho integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  o := exigir_orcamento(l.orcamento_id);
  if o.estado <> 'PEDINDO' or l.expira_em <= app_now() then perform recusar_motivo('O prazo para propostas acabou', 'PRAZO_ACABOU'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_tipo is null or p_tipo <> 'application/pdf' then perform recusar_motivo('A proposta vai em PDF', 'TIPO_NAO_ACEITO'); end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  if (select count(*) from arquivos_orcamento where convite_id = l.id and retirado_em is null) >= 10 then perform recusar_motivo('Já há 10 arquivos', 'LIMITE_ARQUIVOS'); end if;
  v_caminho := l.condominio_id || '/orcamentos/' || o.id || '/' || v_id;
  insert into arquivos_orcamento (id, condominio_id, orcamento_id, convite_id, parte, nome, tipo, tamanho_declarado, caminho)
  values (v_id, l.condominio_id, o.id, l.id, 'PROPOSTA', btrim(p_nome), p_tipo, p_tamanho, v_caminho);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function publico_pdf_orcamento_a_verificar(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  a arquivos_orcamento;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  select * into a from arquivos_orcamento where id = p_arquivo and convite_id = l.id and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function publico_verificar_pdf_orcamento(p_codigo text, p_arquivo uuid, p_liberado boolean, p_tamanho integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l convites_orcamento;
  a arquivos_orcamento;
begin
  l := exigir_link_orcamento_vivo(p_codigo);
  select * into a from arquivos_orcamento where id = p_arquivo and convite_id = l.id and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return liberar_anexo_orcamento(a, p_liberado, p_tamanho, p_motivo);
end $$;

-- Os arquivos do pedido e o próprio PDF, enquanto o link vale.
create function publico_arquivo_orcamento(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l convites_orcamento;
  a arquivos_orcamento;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'ORCAMENTO');
  l := exigir_convite_por_codigo(c);
  if orcamento_publico_json(l, c.revogado_em is not null) ->> 'estado' in ('NAO_VALE', 'CANCELADO') then
    raise exception 'Arquivo não encontrado' using errcode = 'TC404';
  end if;
  select * into a from arquivos_orcamento
   where id = p_arquivo and orcamento_id = l.orcamento_id and situacao = 'LIBERADO' and retirado_em is null
     and (parte = 'PEDIDO' or (parte = 'PROPOSTA' and convite_id = l.id));
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- ---------------------------------------------------------------------------------------
-- E-mail do convite: o código nasce na hora de montar (o anterior para).

alter function montar_email(envios_email) rename to montar_email_r8;
alter function montar_email_r8(envios_email) security invoker;
create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  l convites_orcamento;
  o orcamentos;
  p propostas_orcamento;
  v_cancelar text;
  v_finalidade text;
begin
  if e.tipo <> 'ORCAMENTO' then return montar_email_r8(e); end if;
  select * into l from convites_orcamento where id = e.convite_orcamento_id;
  select * into o from orcamentos where id = l.orcamento_id;
  select * into p from propostas_orcamento where convite_id = l.id and em_uso;
  v_finalidade := case when l.escolhido and o.estado = 'ESCOLHIDA' then 'ESCOLHIDA'
                       when p.id is not null and p.confirmacao_pedida_em is not null and p.confirmada_em is null then 'CONFIRMAR_PRECO'
                       else 'CONVITE' end;
  v_cancelar := case
    when l.estado = 'REVOGADO' then 'O link foi revogado'
    when l.canal <> 'EMAIL' or lower(coalesce(l.email, '')) <> lower(e.para) then 'O contato do fornecedor mudou'
    when o.estado = 'CANCELADO' then 'O orçamento foi cancelado'
    when v_finalidade = 'CONVITE' and (o.estado <> 'PEDINDO' or l.expira_em <= app_now()) then 'O prazo para propostas acabou' end;
  if v_cancelar is not null then
    update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
    return null;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', (select email_responder_para from configuracao_condominio), 'nome', l.nome,
    'codigos', jsonb_build_object('abrir', novo_codigo_orcamento(l, false, e.id)),
    'orcamento', jsonb_strip_nulls(jsonb_build_object(
      'finalidade', v_finalidade, 'titulo', o.titulo, 'local', o.local, 'prazo', prazo_texto(o.prazo_propostas),
      'quem', nome_pessoa(coalesce(e.criado_por, o.cuidador_id)), 'cargo', cargo_da_pessoa(coalesce(e.criado_por, o.cuidador_id)),
      'validaAte', case when p.id is not null then data_br(p.valida_ate) end,
      'total', case when v_finalidade = 'ESCOLHIDA' then reais((select total from propostas_orcamento where id = o.proposta_escolhida_id)) end))));
end $$;

-- ---------------------------------------------------------------------------------------
-- Sino, Início e relatório.

alter function plataforma_avisos(uuid, uuid) rename to avisos_r8;
alter function avisos_r8(uuid, uuid) security invoker;
create function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := avisos_r8(p_pessoa, p_condominio);
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(y.item order by (y.item ->> 'vistoEm') is not null, (y.item ->> 'criadoEm')::timestamptz desc)
        from (select item from jsonb_array_elements(v -> 'itens') item
              union all
              select jsonb_strip_nulls(jsonb_build_object(
                       'id', a.id, 'tipo', 'ORCAMENTO_' || a.tipo, 'orcamentoId', o.id, 'titulo', o.titulo,
                       'fornecedor', c.nome, 'estado', o.estado, 'resultado', nullif(a.referencia, '') ,
                       'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
                from avisos_orcamento a join orcamentos o on o.id = a.orcamento_id left join convites_orcamento c on c.id = a.convite_id
               where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') y), '[]'::jsonb),
    'naoVistos', (v ->> 'naoVistos')::integer + (select count(*) from avisos_orcamento where pessoa_id = p_pessoa and visto_em is null));
end $$;

alter function plataforma_marcar_avisos(uuid, uuid, uuid[]) rename to marcar_avisos_r8;
alter function marcar_avisos_r8(uuid, uuid, uuid[]) security invoker;
create function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_r integer;
begin
  v_n := marcar_avisos_r8(p_pessoa, p_condominio, p_ids);
  update avisos_orcamento set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  return v_n + v_r;
end $$;

alter function plataforma_painel(uuid, uuid) rename to painel_r8;
alter function painel_r8(uuid, uuid) security invoker;
create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := painel_r8(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'orcamentos.ver') then
    perform conferir_orcamentos();
    v := v || jsonb_build_object('orcamentos', resumo_orcamentos(p_pessoa));
  end if;
  return v;
end $$;

-- Relatório do mês (TR-02): o orçamento decidido entra em "Decisões do mês" com o título, a
-- escolhida, o total e o motivo; nunca os concorrentes.
alter function relatorio_decisoes(date, date) rename to relatorio_decisoes_r8;
create function relatorio_decisoes(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := fuso_do_condominio();
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
begin
  return relatorio_decisoes_r8(p_de, p_ate) || jsonb_build_object(
    'orcamentos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', o.id, 'titulo', o.titulo, 'escolhida', c.nome, 'total', p.total, 'motivo', o.motivo_escolha,
               'decididoEm', to_char(data_no_condominio(o.escolhida_em), 'YYYY-MM-DD'), 'propostas', propostas_recebidas(o),
               'peloConselho', o.quem_aprova = 'CONSELHO')) order by o.escolhida_em)
        from orcamentos o join propostas_orcamento p on p.id = o.proposta_escolhida_id join convites_orcamento c on c.id = p.convite_id
       where o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE') and o.escolhida_em >= v_ini and o.escolhida_em < v_fim), '[]'::jsonb));
end $$;

-- Memória do prédio: o orçamento decidido entra na linha do tempo, para quem vê orçamentos.
alter function eventos_memoria(uuid) rename to eventos_memoria_r8;
create function eventos_memoria(p_pessoa uuid) returns table (data date, momento timestamptz, categoria text, evento jsonb)
language plpgsql stable
set search_path = public
as $$
begin
  return query select * from eventos_memoria_r8(p_pessoa);
  if pode(p_pessoa, contexto_condominio(), 'orcamentos.ver') then
    return query
      select data_no_condominio(o.escolhida_em), o.escolhida_em, 'DOCUMENTOS'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'fonte', 'ORCAMENTO', 'id', o.id, 'titulo', 'Orçamento decidido: ' || o.titulo,
               'detalhe', c.nome || ' · ' || reais(p.total) || coalesce(' · ' || o.motivo_escolha, '')))
        from orcamentos o join propostas_orcamento p on p.id = o.proposta_escolhida_id join convites_orcamento c on c.id = p.convite_id
       where o.estado in ('ESCOLHIDA', 'COMPRANDO', 'ENTREGUE');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Inventário de dados (F0.11, PT-11): o fornecedor convidado e as propostas entram no catálogo.

insert into retencao_tipos (numero, codigo, sistema, grupo, nome, o_que, para_que, base, quem, prazo, no_fim, situacao) values
 (41, 'ORCAMENTO', 'PLATAFORMA', 'Documentos e memória', 'Orçamentos e propostas de fornecedores', 'Nome, telefone e e-mail do fornecedor convidado; propostas, versões e PDFs', 'Comparar e provar a escolha', 'Legítimo interesse', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam', 'FICA');

call fechar_acesso();

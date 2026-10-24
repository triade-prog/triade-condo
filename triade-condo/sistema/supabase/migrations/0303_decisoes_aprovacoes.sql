-- 0303 · Decisões e aprovações (peça R5): o conselho e o subsíndico (V-14, R5.1) e a despesa para
-- aprovar (FC-10, R5.2). Plano técnico aprovado pela Carolina em 24/10/2026 (decisões A.1 a H.1),
-- telas 410 a 423 do quadro de desenho. Parte da base da F7.4 (0280): decisoes_pedido, as
-- alternativas, os avisos e as funções da tela Decisões.
--
-- Regras desta parte:
-- 1. Conselho (conselho_membros): pessoa com acesso, morador cadastrado ou só nome e contato;
--    papel Subsíndico, Conselheiro, Conselheiro fiscal ou Suplente; titular é todo papel menos
--    Suplente; mandato de início e fim, como na ata; o link vai pelo WhatsApp ou pelo e-mail.
--    Um subsíndico por vez. Retirar pede motivo e não apaga. Vota só o titular não retirado com o
--    mandato em dia. Ser do conselho não dá acesso ao painel. Cuida do conselho o síndico ou quem
--    tem Configurar. O sino do síndico avisa 30 dias antes do fim do mandato.
-- 2. Regras (Configurações › Regras): quórum Maioria (metade dos titulares em dia + 1), Todos ou
--    um mínimo; empate ou falta de votos no prazo devolve ao síndico (decisão nova, com as mesmas
--    alternativas, ligada à de origem) ou fica devolvida; a decisão vencida avisa só quem decide,
--    também o subsíndico ou também o conselho; a alçada do conselho só avisa, nunca bloqueia.
-- 3. A decisão pedida ao conselho guarda, na hora do pedido, quantos titulares havia e quantos
--    votos aprovam: o quórum não muda no meio. Sem titulares em dia para o quórum, não se pede.
-- 4. Votos (votos_conselho): uma alternativa ou devolver (decisão), aprovar ou recusar (despesa).
--    Devolver e recusar pedem justificativa. O voto troca até o prazo; cada troca vai para o
--    histórico. Fecha sozinho quando uma escolha chega aos votos necessários, ou quando nenhuma
--    escolha consegue mais chegar, ou no prazo (vale a regra do empate). Quem não é da gestão só
--    vê os outros votos depois de fechar.
-- 5. Link do conselheiro (/conselho/<código>): sem conta, um por membro e por item, vale até o
--    fim do dia do prazo, e trocar o link para o anterior. O código nasce na hora de mandar e só
--    o hash fica guardado. Pelo e-mail sai pela fila de sempre; pelo WhatsApp ainda não há
--    modelo aprovado, e a tela mostra o link para copiar, só para o síndico e quem cuida do
--    conselho. O resultado fica à vista até 7 dias depois do prazo; o link que não vale não
--    mostra nada do item.
-- 6. Ausência do síndico (ausencias_sindico): até 60 dias; o substituto é o subsíndico em dia.
--    Enquanto vale, o que foi pedido ao síndico no modo pessoa (decisões e despesas) pode ser
--    respondido pelo subsíndico, no painel ou pelo link. No fim, o que ele não respondeu fica
--    com o síndico.
-- 7. Despesa para aprovar (despesas_aprovacao): o que é, o valor em centavos, o fornecedor, o
--    vencimento, os anexos (bucket privado "pedidos", o mesmo dos pedidos) e a ligação opcional a
--    um pedido, uma manutenção ou uma decisão. Aprova uma pessoa com Aprovar ou o conselho.
--    Aprovar não paga nada: depois de aprovada, "Paga fora do sistema" é só um registro, que se
--    desfaz. O morador não vê.
-- 8. A decidida vai para a linha do tempo da Memória e para o relatório do mês.

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê (CF-03).

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'conselho.ver'), ('SINDICO', 'conselho.editar'), ('SINDICO', 'despesas.ver'), ('SINDICO', 'despesas.registrar');
insert into permissao_acoes (permissao, acao) values
  ('CONFIGURAR', 'conselho.ver'), ('CONFIGURAR', 'conselho.editar'),
  ('APROVAR', 'conselho.ver'), ('APROVAR', 'despesas.ver'), ('APROVAR', 'despesas.registrar'),
  ('ATUALIZAR', 'despesas.ver'), ('ATUALIZAR', 'despesas.registrar');

-- ---------------------------------------------------------------------------------------
-- Regras (regra 2).

alter table configuracao_condominio
  add column conselho_quorum        text not null default 'MAIORIA' check (conselho_quorum in ('MAIORIA', 'TODOS', 'MINIMO')),
  add column conselho_minimo        smallint check (conselho_minimo between 1 and 50),
  add column conselho_empate        text not null default 'SINDICO' check (conselho_empate in ('SINDICO', 'DEVOLVIDA')),
  add column decisao_vencida_avisa  text not null default 'NINGUEM' check (decisao_vencida_avisa in ('NINGUEM', 'SUBSINDICO', 'CONSELHO')),
  add column conselho_alcada        centavos check (conselho_alcada > 0),
  add constraint conselho_minimo_com_regra check ((conselho_quorum = 'MINIMO') = (conselho_minimo is not null));

-- ---------------------------------------------------------------------------------------
-- O conselho (regra 1).

create table conselho_membros (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  pessoa_id       uuid references pessoas (id),
  contato_id      uuid,
  nome            text not null check (length(btrim(nome)) between 2 and 120),
  celular         text check (celular ~ '^\+?[0-9]{10,15}$'),
  email           text check (email_valido(email)),
  papel           text not null check (papel in ('SUBSINDICO', 'CONSELHEIRO', 'CONSELHEIRO_FISCAL', 'SUPLENTE')),
  mandato_inicio  date not null,
  mandato_fim     date not null,
  canal           text not null check (canal in ('WHATSAPP', 'EMAIL')),
  incluido_em     timestamptz not null default app_now(),
  incluido_por    uuid not null references pessoas (id),
  retirado_em     timestamptz,
  retirado_por    uuid references pessoas (id),
  retirado_motivo text check (length(btrim(retirado_motivo)) between 3 and 500),
  versao          integer not null default 1,
  unique (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  check (pessoa_id is null or contato_id is null),
  check (mandato_fim >= mandato_inicio),
  check (canal <> 'WHATSAPP' or celular is not null),
  check (canal <> 'EMAIL' or email is not null),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (retirado_motivo is null))
);
create unique index conselho_um_subsindico on conselho_membros (condominio_id) where papel = 'SUBSINDICO' and retirado_em is null;
create unique index conselho_pessoa_ativa on conselho_membros (condominio_id, pessoa_id) where pessoa_id is not null and retirado_em is null;
create unique index conselho_contato_ativo on conselho_membros (condominio_id, contato_id) where contato_id is not null and retirado_em is null;
call proteger_tabela_condominio('conselho_membros');
create trigger conselho_membros_sem_exclusao before delete on conselho_membros for each row execute function somente_insercao();

-- Retirado não volta nem muda; quem é o membro não muda.
create function conselho_membros_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.retirado_em is not null
     or (new.condominio_id, new.pessoa_id, new.contato_id, new.incluido_em, new.incluido_por)
        is distinct from (old.condominio_id, old.pessoa_id, old.contato_id, old.incluido_em, old.incluido_por) then
    raise exception 'Membro retirado não muda, e quem é o membro não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger conselho_membros_regras before update on conselho_membros for each row execute function conselho_membros_regras();

-- Vota quem é titular, não foi retirado e está com o mandato em dia.
create function membro_em_dia(m conselho_membros) returns boolean
language sql stable
set search_path = public
as $$ select m.retirado_em is null and hoje_no_condominio() between m.mandato_inicio and m.mandato_fim $$;

create function membro_titular(m conselho_membros) returns boolean
language sql immutable
set search_path = public
as $$ select m.papel <> 'SUPLENTE' $$;

-- Vota e conta no quórum só o titular em dia: o suplente não vota, nem o que passou a suplente.
create function membro_vota(m conselho_membros) returns boolean
language sql stable
set search_path = public
as $$ select membro_titular(m) and membro_em_dia(m) $$;

create function titulares_em_dia() returns integer
language sql stable
set search_path = public
as $$ select count(*)::integer from conselho_membros m where membro_vota(m) $$;

-- Votos que aprovam com n titulares, pela regra do condomínio. Nulo: sem quórum possível.
create function votos_necessarios(n integer) returns integer
language sql stable
set search_path = public
as $$
  select case when n < 1 then null
              when c.conselho_quorum = 'MAIORIA' then n / 2 + 1
              when c.conselho_quorum = 'TODOS' then n
              when c.conselho_minimo <= n then c.conselho_minimo end
    from configuracao_condominio c
$$;

create function subsindico_em_dia() returns conselho_membros
language sql stable
set search_path = public
as $$ select m.* from conselho_membros m where m.papel = 'SUBSINDICO' and membro_em_dia(m) limit 1 $$;

-- O membro tem vínculo ativo no painel (vota também na tela Decisões).
create function membro_com_painel(m conselho_membros) returns boolean
language sql stable
set search_path = public
as $$
  select m.pessoa_id is not null
     and exists (select 1 from vinculos v where v.pessoa_id = m.pessoa_id and v.condominio_id = m.condominio_id and v.revogado_em is null)
$$;

create function nome_do_papel(p_papel text) returns text
language sql immutable
set search_path = public
as $$
  select case p_papel when 'SUBSINDICO' then 'Subsíndico' when 'CONSELHEIRO' then 'Conselheiro'
                      when 'CONSELHEIRO_FISCAL' then 'Conselheiro fiscal' else 'Suplente' end
$$;

create function membro_do_conselho(p_pessoa uuid) returns conselho_membros
language sql stable
set search_path = public
as $$ select m.* from conselho_membros m where m.pessoa_id = p_pessoa and m.retirado_em is null limit 1 $$;

create function exigir_membro(p_id uuid) returns conselho_membros
language plpgsql
set search_path = public
as $$
declare m conselho_membros;
begin
  select * into m from conselho_membros where id = p_id;
  if not found then raise exception 'Membro do conselho não encontrado' using errcode = 'TC404'; end if;
  return m;
end $$;

-- Contato mostrado sem tudo: "(61) 9•••• 4821" e "mar•••@gmail.com".
create function celular_mascarado(p text) returns text
language sql immutable
set search_path = public
as $$
  select case when p is null then null
              when length(regexp_replace(p, '\D', '', 'g')) >= 12
                then '(' || substr(right(regexp_replace(p, '\D', '', 'g'), 11), 1, 2) || ') ' || substr(right(regexp_replace(p, '\D', '', 'g'), 11), 3, 1)
                     || '•••• ' || right(p, 4)
              else '•••• ' || right(p, 4) end
$$;

create function email_mascarado(p text) returns text
language sql immutable
set search_path = public
as $$ select case when p is null then null else left(split_part(p, '@', 1), 3) || '•••@' || split_part(p, '@', 2) end $$;

-- ---------------------------------------------------------------------------------------
-- Ausência do síndico (regra 6).

create table ausencias_sindico (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  sindico_id      uuid not null,
  substituto_id   uuid not null,
  de              date not null,
  ate             date not null,
  motivo          text check (length(btrim(motivo)) between 2 and 200),
  criada_em       timestamptz not null default app_now(),
  criada_por      uuid not null references pessoas (id),
  encerrada_em    timestamptz,
  encerrada_por   uuid references pessoas (id),
  inicio_avisado  boolean not null default false,
  fim_avisado     boolean not null default false,
  versao          integer not null default 1,
  unique (id, condominio_id),
  foreign key (sindico_id, condominio_id) references vinculos (id, condominio_id),
  foreign key (substituto_id, condominio_id) references conselho_membros (id, condominio_id),
  check (ate >= de and ate <= de + 60),
  check ((encerrada_em is null) = (encerrada_por is null))
);
create unique index ausencias_sindico_uma_aberta on ausencias_sindico (condominio_id) where encerrada_em is null;
call proteger_tabela_condominio('ausencias_sindico');
create trigger ausencias_sindico_sem_exclusao before delete on ausencias_sindico for each row execute function somente_insercao();

create function ausencias_sindico_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.encerrada_em is not null and (new.encerrada_em, new.encerrada_por) is distinct from (old.encerrada_em, old.encerrada_por)
     or (new.condominio_id, new.sindico_id, new.substituto_id, new.de, new.ate, new.motivo, new.criada_em, new.criada_por)
        is distinct from (old.condominio_id, old.sindico_id, old.substituto_id, old.de, old.ate, old.motivo, old.criada_em, old.criada_por) then
    raise exception 'A ausência marcada só se encerra' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger ausencias_sindico_regras before update on ausencias_sindico for each row execute function ausencias_sindico_regras();

-- A ausência que vale hoje, se houver.
create function ausencia_ativa() returns ausencias_sindico
language sql stable
set search_path = public
as $$
  select a.* from ausencias_sindico a
   where a.encerrada_em is null and hoje_no_condominio() between a.de and a.ate
   order by a.de limit 1
$$;

-- O vínculo do síndico (o primeiro ativo).
create function vinculo_do_sindico() returns uuid
language sql stable
set search_path = public
as $$ select id from vinculos where condominio_id = contexto_condominio() and funcao = 'SINDICO' and revogado_em is null order by criado_em limit 1 $$;

-- A pessoa responde no lugar do síndico agora: é o substituto da ausência que vale hoje, com
-- painel, e o item foi pedido ao síndico (p_decisor).
create function substitui_o_sindico(p_pessoa uuid, p_decisor uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from ausencias_sindico a join conselho_membros m on m.id = a.substituto_id
                  where a.encerrada_em is null and hoje_no_condominio() between a.de and a.ate
                    and a.sindico_id = p_decisor and m.pessoa_id = p_pessoa and membro_em_dia(m) and membro_com_painel(m))
$$;

-- ---------------------------------------------------------------------------------------
-- A decisão pedida ao conselho (regra 3).

alter table decisoes_pedido
  add column modo                 text not null default 'PESSOA' check (modo in ('PESSOA', 'CONSELHO')),
  add column titulares            smallint check (titulares between 1 and 50),
  add column votos_necessarios    smallint check (votos_necessarios between 1 and 50),
  add column origem_id            uuid,
  add column respondida_membro_id uuid,
  add constraint decisoes_pedido_origem foreign key (origem_id, condominio_id) references decisoes_pedido (id, condominio_id),
  add constraint decisoes_pedido_membro foreign key (respondida_membro_id, condominio_id) references conselho_membros (id, condominio_id),
  add constraint decisoes_pedido_modo check ((modo = 'PESSOA') = (decisor_id is not null)
                                             and (modo = 'CONSELHO') = (titulares is not null)
                                             and (titulares is null) = (votos_necessarios is null)
                                             and votos_necessarios <= titulares);
alter table decisoes_pedido alter column decisor_id drop not null;
-- Fechada pelo conselho (pelo voto ou pela regra), não há uma pessoa que respondeu; pelo link
-- do substituto, fica o membro.
alter table decisoes_pedido drop constraint decisoes_pedido_check;
alter table decisoes_pedido add constraint decisoes_pedido_respondida check (
  (estado = 'AGUARDANDO') = (respondida_em is null)
  and (respondida_por is null or respondida_em is not null)
  and (respondida_membro_id is null or respondida_por is null));
create index decisoes_pedido_conselho on decisoes_pedido (prazo) where estado = 'AGUARDANDO' and modo = 'CONSELHO';

-- O que a regra fecha sozinho não tem uma pessoa que resolveu a pendência.
alter table pendencias_pedido drop constraint pendencias_pedido_check;
alter table pendencias_pedido add constraint pendencias_pedido_resolvida check (resolvida_por is null or resolvida_em is not null);

alter table avisos_decisao drop constraint avisos_decisao_tipo_check;
alter table avisos_decisao add constraint avisos_decisao_tipo_check
  check (tipo in ('PEDIDA', 'VENCIDA', 'RESPONDIDA', 'VOTO', 'ESCALADA', 'VOLTOU'));

-- ---------------------------------------------------------------------------------------
-- A despesa para aprovar (regra 7).

create table despesas_aprovacao (
  id                   uuid primary key default gen_random_uuid(),
  condominio_id        uuid not null references condominios (id) on delete restrict,
  descricao            text not null check (length(btrim(descricao)) between 3 and 200),
  valor                centavos not null check (valor > 0),
  moeda                moeda not null default 'BRL',
  prestador_id         uuid,
  fornecedor           text check (length(btrim(fornecedor)) between 2 and 120),
  vencimento           date,
  pedido_id            uuid,
  manutencao_id        uuid,
  decisao_id           uuid,
  modo                 text not null check (modo in ('PESSOA', 'CONSELHO')),
  decisor_id           uuid,
  titulares            smallint check (titulares between 1 and 50),
  votos_necessarios    smallint check (votos_necessarios between 1 and 50),
  prazo                date not null,
  alcada               centavos,
  estado               text not null check (estado in ('AGUARDANDO', 'APROVADA', 'RECUSADA', 'RETIRADA')),
  pedida_em            timestamptz not null default app_now(),
  pedida_por           uuid not null references pessoas (id),
  voltou_ao_sindico_em timestamptz,
  respondida_em        timestamptz,
  respondida_por       uuid references pessoas (id),
  respondida_membro_id uuid,
  justificativa        text check (length(btrim(justificativa)) between 3 and 1000),
  retirada_motivo      text check (length(btrim(retirada_motivo)) between 3 and 500),
  paga_em              date,
  paga_registrada_em   timestamptz,
  paga_registrada_por  uuid references pessoas (id),
  comprovante_id       uuid,
  versao               integer not null default 1,
  unique (id, condominio_id),
  foreign key (prestador_id, condominio_id) references prestadores (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (manutencao_id, condominio_id) references manutencoes (id, condominio_id),
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  foreign key (decisor_id, condominio_id) references vinculos (id, condominio_id),
  foreign key (respondida_membro_id, condominio_id) references conselho_membros (id, condominio_id),
  check ((prestador_id is null) <> (fornecedor is null)),
  check (num_nonnulls(pedido_id, manutencao_id, decisao_id) <= 1),
  check ((modo = 'PESSOA') = (decisor_id is not null)),
  check ((titulares is null) = (votos_necessarios is null) and votos_necessarios <= titulares),
  check (modo = 'PESSOA' or titulares is not null),
  check ((estado = 'AGUARDANDO') = (respondida_em is null)),
  check (respondida_membro_id is null or respondida_por is null),
  check ((estado in ('APROVADA', 'RECUSADA')) = (justificativa is not null)),
  check ((estado = 'RETIRADA') = (retirada_motivo is not null)),
  check ((paga_em is null) = (paga_registrada_em is null) and (paga_em is null) = (paga_registrada_por is null)),
  check (paga_em is null or estado = 'APROVADA'),
  check (comprovante_id is null or paga_em is not null)
);
create index despesas_aprovacao_aguardando on despesas_aprovacao (prazo) where estado = 'AGUARDANDO';
call proteger_tabela_condominio('despesas_aprovacao');
call ligar_guardiao('despesas_aprovacao');
insert into estados_iniciais (tabela, estado) values ('despesas_aprovacao', 'AGUARDANDO');
insert into transicoes_permitidas (tabela, de, para) values
  ('despesas_aprovacao', 'AGUARDANDO', 'APROVADA'),
  ('despesas_aprovacao', 'AGUARDANDO', 'RECUSADA'),
  ('despesas_aprovacao', 'AGUARDANDO', 'RETIRADA');
create trigger despesas_aprovacao_sem_exclusao before delete on despesas_aprovacao for each row execute function somente_insercao();

-- Depois de pedida: o que é muda só enquanto ninguém votou (a função confere); quem aprova muda
-- só de conselho para o síndico, pela regra do empate; decidida, só o registro do pagamento.
create function despesas_aprovacao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.pedida_em, new.pedida_por, new.titulares, new.votos_necessarios, new.alcada)
     is distinct from (old.condominio_id, old.pedida_em, old.pedida_por, old.titulares, old.votos_necessarios, old.alcada) then
    raise exception 'A despesa pedida não muda de origem' using errcode = 'TC422';
  end if;
  if (new.modo, new.decisor_id) is distinct from (old.modo, old.decisor_id)
     and not (old.modo = 'CONSELHO' and new.modo = 'PESSOA' and old.estado = 'AGUARDANDO' and new.voltou_ao_sindico_em is not null) then
    raise exception 'Quem aprova não muda' using errcode = 'TC422';
  end if;
  if old.estado <> 'AGUARDANDO'
     and ((new.descricao, new.valor, new.prestador_id, new.fornecedor, new.vencimento, new.pedido_id, new.manutencao_id, new.decisao_id,
           new.prazo, new.estado, new.respondida_em, new.respondida_por, new.respondida_membro_id, new.justificativa, new.retirada_motivo)
          is distinct from
          (old.descricao, old.valor, old.prestador_id, old.fornecedor, old.vencimento, old.pedido_id, old.manutencao_id, old.decisao_id,
           old.prazo, old.estado, old.respondida_em, old.respondida_por, old.respondida_membro_id, old.justificativa, old.retirada_motivo)) then
    raise exception 'Despesa decidida não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger despesas_aprovacao_regras before update on despesas_aprovacao for each row execute function despesas_aprovacao_regras();

alter table despesas_aprovacao add constraint despesas_aprovacao_voltou check (voltou_ao_sindico_em is null or modo = 'PESSOA');

-- ---------------------------------------------------------------------------------------
-- Votos, links e anexos: servem para a decisão e para a despesa.

create table votos_conselho (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  membro_id     uuid not null,
  decisao_id    uuid,
  despesa_id    uuid,
  escolha       text check (escolha in ('1', '2', '3', '4', '5', 'DEVOLVER', 'APROVAR', 'RECUSAR')),
  justificativa text check (length(btrim(justificativa)) between 3 and 1000),
  votado_em     timestamptz,
  votado_por    uuid references pessoas (id),
  canal         text check (canal in ('LINK', 'PAINEL')),
  criado_em     timestamptz not null default app_now(),
  versao        integer not null default 1,
  foreign key (membro_id, condominio_id) references conselho_membros (id, condominio_id),
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  foreign key (despesa_id, condominio_id) references despesas_aprovacao (id, condominio_id),
  check ((decisao_id is null) <> (despesa_id is null)),
  check (escolha is null or (decisao_id is not null) = (escolha not in ('APROVAR', 'RECUSAR'))),
  check ((escolha is null) = (votado_em is null) and (escolha is null) = (canal is null)),
  check (justificativa is null or escolha is not null),
  check (escolha not in ('DEVOLVER', 'RECUSAR') or justificativa is not null)
);
create unique index votos_conselho_decisao on votos_conselho (decisao_id, membro_id) where decisao_id is not null;
create unique index votos_conselho_despesa on votos_conselho (despesa_id, membro_id) where despesa_id is not null;
call proteger_tabela_condominio('votos_conselho');
create trigger votos_conselho_sem_exclusao before delete on votos_conselho for each row execute function somente_insercao();

create function votos_conselho_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.membro_id, new.decisao_id, new.despesa_id, new.criado_em)
     is distinct from (old.condominio_id, old.membro_id, old.decisao_id, old.despesa_id, old.criado_em)
     or (old.escolha is not null and new.escolha is null) then
    raise exception 'Do voto só muda a escolha' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger votos_conselho_regras before update on votos_conselho for each row execute function votos_conselho_regras();

-- O link pessoal: VOTO (titular), SUBSTITUTO (o subsíndico responde no lugar do síndico ausente)
-- e AVISO (só para ver a decisão vencida, pela regra). O código fica em codigos_sem_conta.
create table links_conselho (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  membro_id     uuid not null,
  decisao_id    uuid,
  despesa_id    uuid,
  finalidade    text not null check (finalidade in ('VOTO', 'SUBSTITUTO', 'AVISO')),
  criado_em     timestamptz not null default app_now(),
  aberto_em     timestamptz,
  codigo_em     timestamptz,
  revogado_em   timestamptz,
  unique (id, condominio_id),
  foreign key (membro_id, condominio_id) references conselho_membros (id, condominio_id),
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  foreign key (despesa_id, condominio_id) references despesas_aprovacao (id, condominio_id),
  check ((decisao_id is null) <> (despesa_id is null))
);
create unique index links_conselho_decisao on links_conselho (decisao_id, membro_id, finalidade) where decisao_id is not null;
create unique index links_conselho_despesa on links_conselho (despesa_id, membro_id, finalidade) where despesa_id is not null;
call proteger_tabela_condominio('links_conselho');
create trigger links_conselho_sem_exclusao before delete on links_conselho for each row execute function somente_insercao();

create function links_conselho_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.membro_id, new.decisao_id, new.despesa_id, new.finalidade, new.criado_em)
     is distinct from (old.condominio_id, old.membro_id, old.decisao_id, old.despesa_id, old.finalidade, old.criado_em)
     or old.revogado_em is not null then
    raise exception 'O link do conselho não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger links_conselho_regras before update on links_conselho for each row execute function links_conselho_regras();

alter table codigos_sem_conta drop constraint codigos_sem_conta_tipo_check;
alter table codigos_sem_conta add constraint codigos_sem_conta_tipo_check
  check (tipo in ('ETIQUETA', 'PRESTADOR', 'ENQUETE', 'ASSEMBLEIA', 'CADASTRO', 'CONSELHO'));
-- O envio de e-mail que levou o código do link do conselho.
alter table codigos_sem_conta add column envio_email_id uuid;
create index codigos_sem_conta_envio on codigos_sem_conta (envio_email_id) where envio_email_id is not null;

-- Anexos da decisão e da despesa: fatura, nota, orçamento e o comprovante do pagamento. No
-- bucket privado "pedidos", em condomínio/aprovacoes/item/arquivo.
create table arquivos_aprovacao (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  decisao_id        uuid,
  despesa_id        uuid,
  parte             text not null default 'DOCUMENTO' check (parte in ('DOCUMENTO', 'COMPROVANTE')),
  nome              text not null check (length(btrim(nome)) between 1 and 200),
  tipo              text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_declarado integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null unique,
  situacao          text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa     text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em        timestamptz not null default app_now(),
  enviado_por       uuid not null references pessoas (id),
  verificado_em     timestamptz,
  retirado_em       timestamptz,
  retirado_por      uuid references pessoas (id),
  motivo_retirada   text check (length(btrim(motivo_retirada)) between 3 and 500),
  unique (id, condominio_id),
  foreign key (decisao_id, condominio_id) references decisoes_pedido (id, condominio_id),
  foreign key (despesa_id, condominio_id) references despesas_aprovacao (id, condominio_id),
  check ((decisao_id is null) <> (despesa_id is null)),
  check (parte = 'DOCUMENTO' or despesa_id is not null),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_aprovacao_decisao on arquivos_aprovacao (decisao_id, enviado_em) where decisao_id is not null;
create index arquivos_aprovacao_despesa on arquivos_aprovacao (despesa_id, enviado_em) where despesa_id is not null;
call proteger_tabela_condominio('arquivos_aprovacao');
create trigger arquivos_aprovacao_sem_exclusao before delete on arquivos_aprovacao for each row execute function somente_insercao();

create function arquivos_aprovacao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.decisao_id, new.despesa_id, new.parte, new.nome, new.tipo, new.tamanho_declarado, new.caminho,
      new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.decisao_id, old.despesa_id, old.parte, old.nome, old.tipo, old.tamanho_declarado, old.caminho,
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
create trigger arquivos_aprovacao_regras before update on arquivos_aprovacao for each row execute function arquivos_aprovacao_regras();

alter table despesas_aprovacao add constraint despesas_aprovacao_comprovante
  foreign key (comprovante_id, condominio_id) references arquivos_aprovacao (id, condominio_id);

-- Avisos no sino que não são de decisão: despesa, mandato e ausência.
create table avisos_aprovacao (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  pessoa_id     uuid not null references pessoas (id),
  tipo          text not null check (tipo in ('DESPESA_PEDIDA', 'DESPESA_VENCIDA', 'DESPESA_RESPONDIDA', 'DESPESA_VOTO', 'DESPESA_ESCALADA',
                                              'DESPESA_VOLTOU', 'MANDATO_VENCENDO', 'AUSENCIA_INICIO', 'AUSENCIA_FIM')),
  despesa_id    uuid,
  membro_id     uuid,
  ausencia_id   uuid,
  referencia    date not null default '2000-01-01',
  criado_em     timestamptz not null default app_now(),
  visto_em      timestamptz,
  foreign key (despesa_id, condominio_id) references despesas_aprovacao (id, condominio_id),
  foreign key (membro_id, condominio_id) references conselho_membros (id, condominio_id),
  foreign key (ausencia_id, condominio_id) references ausencias_sindico (id, condominio_id),
  check (num_nonnulls(despesa_id, membro_id, ausencia_id) = 1),
  check ((tipo like 'DESPESA_%') = (despesa_id is not null)),
  check ((tipo = 'MANDATO_VENCENDO') = (membro_id is not null))
);
create unique index avisos_aprovacao_unico on avisos_aprovacao (pessoa_id, coalesce(despesa_id, membro_id, ausencia_id), tipo, referencia);
create index avisos_aprovacao_pessoa on avisos_aprovacao (pessoa_id, criado_em desc);
call proteger_tabela_condominio('avisos_aprovacao');
create trigger avisos_aprovacao_sem_exclusao before delete on avisos_aprovacao for each row execute function somente_insercao();
create function avisos_aprovacao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.visto_em is not null or new.visto_em is null
     or (new.condominio_id, new.pessoa_id, new.tipo, new.despesa_id, new.membro_id, new.ausencia_id, new.referencia, new.criado_em)
        is distinct from (old.condominio_id, old.pessoa_id, old.tipo, old.despesa_id, old.membro_id, old.ausencia_id, old.referencia, old.criado_em) then
    raise exception 'Do aviso só muda o visto' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger avisos_aprovacao_regras before update on avisos_aprovacao for each row execute function avisos_aprovacao_regras();

create function avisar_aprovacao(p_pessoa uuid, p_tipo text, p_despesa uuid, p_membro uuid, p_ausencia uuid, p_referencia date default null)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_pessoa is not null and p_pessoa is distinct from contexto_pessoa() then
    insert into avisos_aprovacao (condominio_id, pessoa_id, tipo, despesa_id, membro_id, ausencia_id, referencia)
    values (contexto_condominio(), p_pessoa, p_tipo, p_despesa, p_membro, p_ausencia, coalesce(p_referencia, '2000-01-01'))
    on conflict do nothing;
  end if;
end $$;

-- O e-mail do link do conselho sai pela fila de sempre (0160).
alter table envios_email drop constraint envios_email_tipo_check;
alter table envios_email add constraint envios_email_tipo_check
  check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO', 'ENQUETE', 'ASSEMBLEIA', 'PROTOCOLO', 'PRESTADOR', 'CONSELHO'));
alter table envios_email
  add column link_conselho_id uuid,
  add constraint envios_email_link_conselho foreign key (link_conselho_id, condominio_id) references links_conselho (id, condominio_id),
  add constraint envios_email_conselho_tem_link check ((tipo = 'CONSELHO') = (link_conselho_id is not null));

create function envios_email_regras_r5() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link_conselho_id is distinct from old.link_conselho_id then
    raise exception 'O envio não muda de destino nem de conteúdo' using errcode = 'TC422';
  end if;
  -- Falhou de vez: o código que este e-mail levaria para (os das tentativas de antes também).
  if new.estado = 'FALHOU' and old.estado <> 'FALHOU' and new.link_conselho_id is not null then
    update codigos_sem_conta set revogado_em = app_now() where envio_email_id = new.id and revogado_em is null;
  end if;
  return new;
end $$;
create trigger envios_email_regras_r5 before update on envios_email for each row execute function envios_email_regras_r5();

-- ---------------------------------------------------------------------------------------
-- Ajudantes da votação e do link.

-- A transição com o autor do contexto; sem pessoa (o link, a rotina de hora em hora), é o sistema.
create function transicao_aprovacao(p_evento text, p_motivo text default null) returns void
language sql
set search_path = public
as $$ select definir_transicao(p_evento, p_motivo, contexto_pessoa() is null) $$;

-- "R$ 4.250,00".
create function reais(p centavos) returns text
language sql immutable
set search_path = public
as $$ select 'R$ ' || translate(to_char(p / 100.0, 'FM999,999,999,990.00'), ',.', '.,') $$;

create function data_br(p date) returns text
language sql immutable
set search_path = public
as $$ select to_char(p, 'DD/MM/YYYY') $$;

-- Os titulares em dia e os votos que aprovam, para a tela mostrar antes de pedir.
create function conselho_quorum_json() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'titularesEmDia', titulares_em_dia(),
    'necessarios', votos_necessarios(titulares_em_dia()),
    'podePedir', votos_necessarios(titulares_em_dia()) is not null,
    'quorum', c.conselho_quorum, 'minimo', c.conselho_minimo, 'empate', c.conselho_empate,
    'vencidaAvisa', c.decisao_vencida_avisa, 'alcada', c.conselho_alcada))
    from configuracao_condominio c
$$;

-- Antes de pedir ao conselho: há titulares em dia para o quórum (regra 3).
create function exigir_quorum(out titulares integer, out necessarios integer)
language plpgsql
set search_path = public
as $$
begin
  titulares := titulares_em_dia();
  necessarios := votos_necessarios(titulares);
  if titulares = 0 then
    perform recusar_motivo('Ainda não há conselho com titular de mandato em dia', 'CONSELHO_VAZIO');
  end if;
  if necessarios is null then
    perform recusar_motivo(format('Só %s titulares com mandato em dia e a regra pede %s votos: ajuste o conselho ou a regra antes de pedir',
                                  titulares, (select conselho_minimo from configuracao_condominio)), 'SEM_QUORUM_POSSIVEL');
  end if;
end $$;

-- O código novo do link: o anterior para na hora (regra 5). Ao montar o e-mail (p_trocar
-- falso), não: o mandar de novo já parou os anteriores, e o código de uma tentativa que pode ter
-- chegado continua valendo; se o e-mail falha de vez, os códigos dele param (p_envio).
create function novo_codigo_conselho(l links_conselho, p_trocar boolean default true, p_envio uuid default null) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  if p_trocar then
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'CONSELHO' and alvo_id = l.id and revogado_em is null;
  end if;
  loop
    v_codigo := novo_codigo();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id, envio_email_id)
  values (hash_codigo(v_codigo), l.condominio_id, 'CONSELHO', l.id, p_envio);
  update links_conselho set codigo_em = app_now() where id = l.id;
  return v_codigo;
end $$;

-- O código do link para copiar só volta para quem cuida do conselho (o síndico ou quem tem
-- conselho.editar): quem só pediu não vota no lugar de ninguém.
create function mostra_codigo_conselho(p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$ select p_pessoa is not null and (eh_sindico(p_pessoa) or pode(p_pessoa, contexto_condominio(), 'conselho.editar')) $$;

-- Manda o link pelo canal do membro. Pelo e-mail, entra na fila e o código nasce na hora de
-- montar o e-mail (o de antes para já). Pelo WhatsApp ainda não há modelo aprovado: o código
-- volta para a tela mostrar o link para copiar, só para quem cuida do conselho; para os outros,
-- o código nem nasce (o de antes segue valendo) e a tela diz para pedir o link ao síndico.
create function mandar_link_conselho(l links_conselho, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  m conselho_membros;
  v jsonb;
begin
  m := exigir_membro(l.membro_id);
  v := jsonb_strip_nulls(jsonb_build_object('membroId', m.id, 'nome', m.nome, 'canal', m.canal, 'finalidade', l.finalidade,
                                            'decisaoId', l.decisao_id, 'despesaId', l.despesa_id));
  if m.canal = 'EMAIL' then
    update envios_email set estado = 'CANCELADO', motivo = 'O link foi mandado de novo' where link_conselho_id = l.id and estado = 'NA_FILA';
    update codigos_sem_conta set revogado_em = app_now() where tipo = 'CONSELHO' and alvo_id = l.id and revogado_em is null;
    insert into envios_email (condominio_id, tipo, link_conselho_id, para, criado_por) values (l.condominio_id, 'CONSELHO', l.id, m.email, p_pessoa);
    return v || jsonb_build_object('envio', 'EMAIL');
  end if;
  if not mostra_codigo_conselho(p_pessoa) then
    return v || jsonb_build_object('envio', 'COPIAR', 'aviso', 'Peça o link ao síndico');
  end if;
  return v || jsonb_build_object('envio', 'COPIAR', 'codigo', novo_codigo_conselho(l));
end $$;

-- Cria o link do membro para o item, uma vez só. Já existindo, não manda de novo (devolve nulo).
create function criar_link_conselho(p_membro uuid, p_decisao uuid, p_despesa uuid, p_finalidade text, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare l links_conselho;
begin
  insert into links_conselho (condominio_id, membro_id, decisao_id, despesa_id, finalidade)
  values (contexto_condominio(), p_membro, p_decisao, p_despesa, p_finalidade)
  on conflict do nothing returning * into l;
  if l.id is null then return null; end if;
  return mandar_link_conselho(l, p_pessoa);
end $$;

-- Abre a votação: cada titular em dia ganha o voto pendente e o link; quem tem painel, o aviso.
create function abrir_votacao(p_decisao uuid, p_despesa uuid, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  m conselho_membros;
  v_links jsonb := '[]'::jsonb;
begin
  for m in select * from conselho_membros x where membro_vota(x) order by x.papel <> 'SUBSINDICO', lower(x.nome), x.id loop
    insert into votos_conselho (condominio_id, membro_id, decisao_id, despesa_id) values (m.condominio_id, m.id, p_decisao, p_despesa);
    v_links := v_links || jsonb_build_array(criar_link_conselho(m.id, p_decisao, p_despesa, 'VOTO', p_pessoa));
    if membro_com_painel(m) then
      if p_decisao is not null then perform avisar_decisao(m.pessoa_id, p_decisao, 'VOTO');
      else perform avisar_aprovacao(m.pessoa_id, 'DESPESA_VOTO', p_despesa, null, null); end if;
    end if;
  end loop;
  return v_links;
end $$;

-- O resultado agora (regra 4): a escolha que chegou aos votos necessários, ou se nenhuma
-- escolha consegue mais chegar. Quem vota hoje (titular em dia) ainda pode votar ou trocar; o
-- voto de quem saiu, teve o mandato vencido ou passou a suplente fica como está.
create function apurar_votos(p_decisao uuid, p_despesa uuid, p_necessarios integer, out vencedora text, out votos integer, out impossivel boolean)
language plpgsql stable
set search_path = public
as $$
declare
  v_escolhas text[];
  v_elegiveis integer;
  e text;
  v_n integer;
  v_fora integer;
begin
  if p_decisao is not null then
    select array_agg(numero::text order by numero) || array['DEVOLVER'] into v_escolhas from alternativas_decisao where decisao_id = p_decisao;
  else
    v_escolhas := array['APROVAR', 'RECUSAR'];
  end if;
  select count(*) into v_elegiveis
    from votos_conselho v join conselho_membros m on m.id = v.membro_id
   where (v.decisao_id = p_decisao or v.despesa_id = p_despesa) and membro_vota(m);
  impossivel := true;
  foreach e in array v_escolhas loop
    select count(*), count(*) filter (where not membro_vota(m)) into v_n, v_fora
      from votos_conselho v join conselho_membros m on m.id = v.membro_id
     where (v.decisao_id = p_decisao or v.despesa_id = p_despesa) and v.escolha = e;
    if v_n >= p_necessarios then
      vencedora := e;
      votos := v_n;
      impossivel := false;
      return;
    end if;
    if v_fora + v_elegiveis >= p_necessarios then impossivel := false; end if;
  end loop;
end $$;

-- Fecha a decisão do conselho quando a votação decidiu, quando nenhuma escolha chega mais ou no
-- prazo (regras 2 e 4). Sem quórum: pela regra, volta ao síndico numa decisão nova, com as mesmas
-- alternativas e ligada a esta, ou fica devolvida.
create function fechar_decisao_do_conselho(d decisoes_pedido) returns boolean
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_just text;
  v_sindico uuid;
  v_nova uuid;
  v_pendencia uuid;
  v_prazo date := least(hoje_no_condominio() + 7, hoje_no_condominio() + 90);
  v_volta boolean;
begin
  -- Trava e lê de novo: o voto e a rotina podem fechar ao mesmo tempo; quem chega depois sai.
  select * into d from decisoes_pedido where id = d.id for update;
  if not found or d.estado <> 'AGUARDANDO' or d.modo <> 'CONSELHO' then return false; end if;
  select * into r from apurar_votos(d.id, null, d.votos_necessarios);
  if r.vencedora is not null then
    v_just := case when r.vencedora = 'DEVOLVER' then 'Devolvida' else 'Aprovada' end || format(' por %s de %s titulares', r.votos, d.titulares);
    perform transicao_aprovacao(case when r.vencedora = 'DEVOLVER' then 'DEVOLVIDA_PELO_CONSELHO' else 'APROVADA_PELO_CONSELHO' end);
    update decisoes_pedido
       set estado = case when r.vencedora = 'DEVOLVER' then 'DEVOLVIDA' else 'APROVADA' end, respondida_em = app_now(),
           alternativa_aprovada = case when r.vencedora <> 'DEVOLVER' then r.vencedora::smallint end, justificativa = v_just
     where id = d.id;
    perform fechar_pendencia_da_decisao(d, null, v_just);
    perform registrar_historico('pedido.decisao_respondida', 'pedidos', d.pedido_id::text, jsonb_strip_nulls(jsonb_build_object(
      'decisao', d.id, 'aprovada', r.vencedora <> 'DEVOLVER', 'alternativa', case when r.vencedora <> 'DEVOLVER' then r.vencedora::integer end,
      'conselho', true, 'votos', r.votos, 'titulares', d.titulares)));
    perform avisar_decisao(d.pedida_por, d.id, 'RESPONDIDA');
    return true;
  end if;
  if not (r.impossivel or d.prazo < hoje_no_condominio()) then return false; end if;

  v_sindico := vinculo_do_sindico();
  v_volta := v_sindico is not null and (select conselho_empate from configuracao_condominio) = 'SINDICO';
  v_just := case when r.impossivel then format('Nenhuma alternativa pode mais chegar a %s votos', d.votos_necessarios)
                 else format('O conselho não chegou a %s votos iguais até o prazo', d.votos_necessarios) end
            || case when v_volta then ': voltou para o síndico decidir' else '' end;
  perform transicao_aprovacao('SEM_QUORUM', v_just);
  update decisoes_pedido set estado = 'DEVOLVIDA', respondida_em = app_now(), justificativa = v_just where id = d.id;
  perform fechar_pendencia_da_decisao(d, null, v_just);
  perform registrar_historico('pedido.decisao_respondida', 'pedidos', d.pedido_id::text,
    jsonb_build_object('decisao', d.id, 'aprovada', false, 'conselho', true, 'semQuorum', true, 'voltou', v_volta));
  if not v_volta then
    perform avisar_decisao(d.pedida_por, d.id, 'RESPONDIDA');
    return true;
  end if;

  insert into pendencias_pedido (condominio_id, pedido_id, tipo, motivo, responsavel_id, aberta_por)
  values (d.condominio_id, d.pedido_id, 'DECISAO', left(d.pergunta, 300), v_sindico, d.pedida_por) returning id into v_pendencia;
  perform transicao_aprovacao('PEDIDA', 'Sem quórum no conselho');
  insert into decisoes_pedido (condominio_id, pedido_id, pendencia_id, pergunta, porque, prazo, decisor_id, estado, pedida_por, origem_id)
  values (d.condominio_id, d.pedido_id, v_pendencia, d.pergunta, d.porque, v_prazo, v_sindico, 'AGUARDANDO', d.pedida_por, d.id)
  returning id into v_nova;
  insert into alternativas_decisao (condominio_id, decisao_id, numero, descricao, detalhe, custo, moeda)
  select condominio_id, v_nova, numero, descricao, detalhe, custo, moeda from alternativas_decisao where decisao_id = d.id;
  perform registrar_historico('pedido.pendencia_aberta', 'pedidos', d.pedido_id::text,
    jsonb_build_object('pendencia', v_pendencia, 'tipo', 'DECISAO', 'responsavel', v_sindico));
  perform registrar_historico('pedido.decisao_pedida', 'pedidos', d.pedido_id::text,
    jsonb_build_object('decisao', v_nova, 'decisor', v_sindico, 'prazo', to_char(v_prazo, 'YYYY-MM-DD'), 'origem', d.id,
                       'alternativas', (select count(*) from alternativas_decisao where decisao_id = v_nova)));
  perform avisar_decisao(pessoa_do_vinculo(v_sindico), v_nova, 'VOLTOU');
  perform avisar_decisao(d.pedida_por, d.id, 'RESPONDIDA');
  perform garantir_substituto();
  return true;
end $$;

-- A despesa do conselho fecha do mesmo jeito. Sem quórum, pela regra, a mesma despesa passa para
-- o síndico (com os anexos e os votos à vista), ou fica recusada.
create function fechar_despesa_do_conselho(x despesas_aprovacao) returns boolean
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_just text;
  v_sindico uuid;
  v_volta boolean;
begin
  select * into x from despesas_aprovacao where id = x.id for update;
  if not found or x.estado <> 'AGUARDANDO' or x.modo <> 'CONSELHO' then return false; end if;
  select * into r from apurar_votos(null, x.id, x.votos_necessarios);
  if r.vencedora is not null then
    v_just := case when r.vencedora = 'APROVAR' then 'Aprovada' else 'Recusada' end || format(' por %s de %s titulares', r.votos, x.titulares);
    perform transicao_aprovacao(case when r.vencedora = 'APROVAR' then 'APROVADA_PELO_CONSELHO' else 'RECUSADA_PELO_CONSELHO' end);
    update despesas_aprovacao set estado = case when r.vencedora = 'APROVAR' then 'APROVADA' else 'RECUSADA' end, respondida_em = app_now(),
                                  justificativa = v_just
     where id = x.id;
    perform registrar_historico('despesa.respondida', 'despesas_aprovacao', x.id::text,
      jsonb_build_object('aprovada', r.vencedora = 'APROVAR', 'conselho', true, 'votos', r.votos, 'titulares', x.titulares));
    perform avisar_aprovacao(x.pedida_por, 'DESPESA_RESPONDIDA', x.id, null, null);
    return true;
  end if;
  if not (r.impossivel or x.prazo < hoje_no_condominio()) then return false; end if;
  v_sindico := vinculo_do_sindico();
  v_volta := v_sindico is not null and (select conselho_empate from configuracao_condominio) = 'SINDICO';
  v_just := case when r.impossivel then format('Nenhuma escolha pode mais chegar a %s votos', x.votos_necessarios)
                 else format('O conselho não chegou a %s votos iguais até o prazo', x.votos_necessarios) end;
  if v_volta then
    update despesas_aprovacao set modo = 'PESSOA', decisor_id = v_sindico, voltou_ao_sindico_em = app_now(),
                                  prazo = greatest(prazo, hoje_no_condominio() + 7)
     where id = x.id;
    perform registrar_historico('despesa.voltou_ao_sindico', 'despesas_aprovacao', x.id::text,
      jsonb_build_object('decisor', v_sindico, 'semQuorum', true));
    perform avisar_aprovacao(pessoa_do_vinculo(v_sindico), 'DESPESA_VOLTOU', x.id, null, null);
    perform garantir_substituto();
  else
    perform transicao_aprovacao('SEM_QUORUM', v_just);
    update despesas_aprovacao set estado = 'RECUSADA', respondida_em = app_now(), justificativa = v_just where id = x.id;
    perform registrar_historico('despesa.respondida', 'despesas_aprovacao', x.id::text,
      jsonb_build_object('aprovada', false, 'conselho', true, 'semQuorum', true));
    perform avisar_aprovacao(x.pedida_por, 'DESPESA_RESPONDIDA', x.id, null, null);
  end if;
  return true;
end $$;

-- O voto do membro (regra 4), pelo painel ou pelo link. Troca até o prazo; cada troca vai para o
-- histórico. Depois de votar, confere se a votação fechou.
create function registrar_voto(m conselho_membros, p_decisao uuid, p_despesa uuid, p_escolha text, p_justificativa text, p_canal text,
                               p_pessoa uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  d decisoes_pedido;
  x despesas_aprovacao;
  v votos_conselho;
  v_estado text;
  v_modo text;
  v_prazo date;
  v_just text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_escolha text := upper(btrim(coalesce(p_escolha, '')));
begin
  if p_decisao is not null then
    select * into d from decisoes_pedido where id = p_decisao for update;
    if not found then raise exception 'Decisão não encontrada' using errcode = 'TC404'; end if;
    v_estado := d.estado; v_modo := d.modo; v_prazo := d.prazo;
  else
    select * into x from despesas_aprovacao where id = p_despesa for update;
    if not found then raise exception 'Despesa não encontrada' using errcode = 'TC404'; end if;
    v_estado := x.estado; v_modo := x.modo; v_prazo := x.prazo;
  end if;
  select * into v from votos_conselho where membro_id = m.id and (decisao_id = p_decisao or despesa_id = p_despesa) for update;
  if not found then perform recusar_motivo('Você não vota nesta decisão', 'NAO_VOTA'); end if;
  if v_estado <> 'AGUARDANDO' then perform recusar_motivo('A votação já fechou', 'VOTACAO_FECHADA'); end if;
  if v_modo <> 'CONSELHO' then perform recusar_motivo('A votação fechou e voltou para o síndico', 'VOLTOU_AO_SINDICO'); end if;
  if v_prazo < hoje_no_condominio() then perform recusar_motivo('O prazo para votar acabou', 'PRAZO_ACABOU'); end if;
  if not membro_em_dia(m) then perform recusar_motivo('O mandato não está em dia: o voto não vale', 'MANDATO_VENCIDO'); end if;
  if not membro_titular(m) then perform recusar_motivo('Suplente não vota: o voto não vale', 'SUPLENTE_NAO_VOTA'); end if;
  if p_decisao is not null then
    if not (v_escolha = 'DEVOLVER' or exists (select 1 from alternativas_decisao where decisao_id = p_decisao and numero::text = v_escolha)) then
      perform recusar_campos('Escolha uma alternativa ou devolva', 'escolha');
    end if;
  elsif v_escolha not in ('APROVAR', 'RECUSAR') then
    perform recusar_campos('Aprove ou recuse', 'escolha');
  end if;
  if (v_escolha in ('DEVOLVER', 'RECUSAR') and v_just is null) or coalesce(length(v_just), 3) not between 3 and 1000 then
    perform recusar_campos(case when v_escolha = 'DEVOLVER' then 'Escreva o que falta para decidir (3 a 1000 caracteres)'
                                else 'Escreva o porquê (3 a 1000 caracteres)' end, 'justificativa');
  end if;
  update votos_conselho set escolha = v_escolha, justificativa = v_just, votado_em = app_now(), votado_por = p_pessoa, canal = p_canal
   where id = v.id;
  perform registrar_historico('conselho.voto', case when p_decisao is not null then 'decisoes_pedido' else 'despesas_aprovacao' end,
    coalesce(p_decisao, p_despesa)::text,
    jsonb_strip_nulls(jsonb_build_object('membro', m.id, 'escolha', v_escolha, 'antes', v.escolha, 'canal', p_canal)));
  if p_decisao is not null then
    select * into d from decisoes_pedido where id = p_decisao;
    perform fechar_decisao_do_conselho(d);
    select estado into v_estado from decisoes_pedido where id = p_decisao;
  else
    select * into x from despesas_aprovacao where id = p_despesa;
    perform fechar_despesa_do_conselho(x);
    select estado into v_estado from despesas_aprovacao where id = p_despesa;
  end if;
  return jsonb_build_object('escolha', v_escolha, 'trocou', v.escolha is not null, 'estado', v_estado);
end $$;

-- O substituto responde no lugar do síndico (regra 6), pelo painel (p_pessoa) ou pelo link
-- (p_membro). A resposta é a de uma pessoa: aprovar uma alternativa ou devolver, com justificativa.
create function responder_decisao_substituto(d decisoes_pedido, p_pessoa uuid, p_membro uuid, p_versao integer, p_aprovar boolean,
                                             p_alternativa integer, p_justificativa text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v pedidos;
  v_just text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_versao integer;
begin
  if d.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta decisão já foi respondida ou retirada', 'DECISAO_FECHADA'); end if;
  select * into v from pedidos where id = d.pedido_id;
  perform exigir_em_andamento(v);
  if p_aprovar is null then perform recusar_campos('Aprove uma alternativa ou devolva', 'aprovar'); end if;
  if p_aprovar and not exists (select 1 from alternativas_decisao where decisao_id = d.id and numero = p_alternativa) then
    perform recusar_campos('Escolha a alternativa aprovada', 'alternativa');
  end if;
  if coalesce(length(v_just), 0) not between 3 and 1000 then perform recusar_campos('Escreva a justificativa (3 a 1000 caracteres)', 'justificativa'); end if;
  perform transicao_aprovacao(case when p_aprovar then 'APROVADA' else 'DEVOLVIDA' end, 'No lugar do síndico ausente');
  update decisoes_pedido
     set estado = case when p_aprovar then 'APROVADA' else 'DEVOLVIDA' end, respondida_em = app_now(), respondida_por = p_pessoa,
         respondida_membro_id = case when p_pessoa is null then p_membro end,
         alternativa_aprovada = case when p_aprovar then p_alternativa end, justificativa = v_just
   where id = d.id and (p_versao is null or versao = p_versao) returning versao into v_versao;
  if v_versao is null then perform conflito_versao('decisoes_pedido', d.id); end if;
  perform fechar_pendencia_da_decisao(d, p_pessoa,
    case when p_aprovar then 'Aprovada a alternativa ' || p_alternativa else 'Devolvida sem decidir' end || ' (substituto)');
  perform registrar_historico('pedido.decisao_respondida', 'pedidos', d.pedido_id::text, jsonb_strip_nulls(jsonb_build_object(
    'decisao', d.id, 'aprovada', p_aprovar, 'alternativa', case when p_aprovar then p_alternativa end, 'porSubstituto', true,
    'substituto', p_membro)));
  perform avisar_decisao(d.pedida_por, d.id, 'RESPONDIDA');
  perform avisar_decisao(pessoa_do_vinculo(d.decisor_id), d.id, 'RESPONDIDA');
  return v_versao;
end $$;

-- A resposta de uma pessoa à despesa (quem decide, o síndico ou o substituto).
create function responder_despesa_pessoa(x despesas_aprovacao, p_pessoa uuid, p_membro uuid, p_versao integer, p_aprovar boolean,
                                         p_justificativa text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_just text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_versao integer;
begin
  if x.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta despesa já foi respondida ou retirada', 'DESPESA_FECHADA'); end if;
  if p_aprovar is null then perform recusar_campos('Aprove ou recuse', 'aprovar'); end if;
  if coalesce(length(v_just), 0) not between 3 and 1000 then perform recusar_campos('Escreva a justificativa (3 a 1000 caracteres)', 'justificativa'); end if;
  perform transicao_aprovacao(case when p_aprovar then 'APROVADA' else 'RECUSADA' end, case when p_membro is not null then 'No lugar do síndico ausente' end);
  update despesas_aprovacao
     set estado = case when p_aprovar then 'APROVADA' else 'RECUSADA' end, respondida_em = app_now(), respondida_por = p_pessoa,
         respondida_membro_id = case when p_pessoa is null then p_membro end, justificativa = v_just
   where id = x.id and (p_versao is null or versao = p_versao) returning versao into v_versao;
  if v_versao is null then perform conflito_versao('despesas_aprovacao', x.id); end if;
  perform registrar_historico('despesa.respondida', 'despesas_aprovacao', x.id::text,
    jsonb_strip_nulls(jsonb_build_object('aprovada', p_aprovar, 'substituto', p_membro)));
  perform avisar_aprovacao(x.pedida_por, 'DESPESA_RESPONDIDA', x.id, null, null);
  if p_membro is not null then perform avisar_aprovacao(pessoa_do_vinculo(x.decisor_id), 'DESPESA_RESPONDIDA', x.id, null, null); end if;
  return v_versao;
end $$;

-- O link do substituto vale enquanto a ausência vale e o item foi pedido ao síndico ausente.
create function substituto_vale(l links_conselho) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from ausencias_sindico a
                  where a.encerrada_em is null and hoje_no_condominio() between a.de and a.ate and a.substituto_id = l.membro_id
                    and a.sindico_id = coalesce((select decisor_id from decisoes_pedido where id = l.decisao_id),
                                                (select decisor_id from despesas_aprovacao where id = l.despesa_id)))
$$;

-- Durante a ausência, o que foi pedido ao síndico vai também para o substituto: o aviso no sino,
-- se ele tem painel; o link, se não tem (regra 6). Roda ao marcar a ausência, ao pedir e de hora
-- em hora; não repete. Devolve os links que nasceram agora, para a tela mostrar o de copiar.
create function garantir_substituto() returns jsonb
language plpgsql
set search_path = public
as $$
declare
  a ausencias_sindico;
  m conselho_membros;
  r record;
  v_links jsonb := '[]'::jsonb;
begin
  a := ausencia_ativa();
  if a.id is null then return v_links; end if;
  select * into m from conselho_membros where id = a.substituto_id;
  if not membro_em_dia(m) then return v_links; end if;
  for r in select id from decisoes_pedido where estado = 'AGUARDANDO' and modo = 'PESSOA' and decisor_id = a.sindico_id loop
    if membro_com_painel(m) then perform avisar_decisao(m.pessoa_id, r.id, 'PEDIDA');
    else v_links := v_links || coalesce(jsonb_build_array(criar_link_conselho(m.id, r.id, null, 'SUBSTITUTO', contexto_pessoa())), '[]'); end if;
  end loop;
  for r in select id from despesas_aprovacao where estado = 'AGUARDANDO' and modo = 'PESSOA' and decisor_id = a.sindico_id loop
    if membro_com_painel(m) then perform avisar_aprovacao(m.pessoa_id, 'DESPESA_PEDIDA', r.id, null, null);
    else v_links := v_links || coalesce(jsonb_build_array(criar_link_conselho(m.id, null, r.id, 'SUBSTITUTO', contexto_pessoa())), '[]'); end if;
  end loop;
  if not a.inicio_avisado then
    perform avisar_aprovacao(m.pessoa_id, 'AUSENCIA_INICIO', null, null, a.id);
    update ausencias_sindico set inicio_avisado = true where id = a.id;
  end if;
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(v_links) x where x <> 'null'::jsonb);
end $$;

-- A decisão vencida avisa também quem a regra manda (regra 2): pelo sino de quem tem painel e
-- pelo link de quem não tem. Quem decide não é avisado de novo por aqui.
create function escalar_para(m conselho_membros, p_decisor uuid, p_decisao uuid, p_despesa uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if m.id is null or not membro_em_dia(m) or m.pessoa_id is not distinct from pessoa_do_vinculo(p_decisor) then return; end if;
  if membro_com_painel(m) then
    if p_decisao is not null then perform avisar_decisao(m.pessoa_id, p_decisao, 'ESCALADA');
    else perform avisar_aprovacao(m.pessoa_id, 'DESPESA_ESCALADA', p_despesa, null, null); end if;
  else
    perform criar_link_conselho(m.id, p_decisao, p_despesa, 'AVISO', null);
  end if;
end $$;

-- O que a rotina de hora em hora confere em cada condomínio: votações que fecham, substituto,
-- fim da ausência, vencidas escaladas, despesas vencidas e mandatos perto do fim.
create function verificar_aprovacoes() returns integer
language plpgsql
set search_path = public
as $$
declare
  r record;
  d decisoes_pedido;
  x despesas_aprovacao;
  m conselho_membros;
  a ausencias_sindico;
  v_n integer := 0;
  v_regra text := (select decisao_vencida_avisa from configuracao_condominio);
begin
  for d in select * from decisoes_pedido where estado = 'AGUARDANDO' and modo = 'CONSELHO' order by pedida_em loop
    if fechar_decisao_do_conselho(d) then v_n := v_n + 1; end if;
  end loop;
  for x in select * from despesas_aprovacao where estado = 'AGUARDANDO' and modo = 'CONSELHO' order by pedida_em loop
    if fechar_despesa_do_conselho(x) then v_n := v_n + 1; end if;
  end loop;
  perform garantir_substituto();
  for a in select * from ausencias_sindico
            where inicio_avisado and not fim_avisado and (encerrada_em is not null or ate < hoje_no_condominio()) loop
    perform avisar_aprovacao((select pessoa_id from conselho_membros where id = a.substituto_id), 'AUSENCIA_FIM', null, null, a.id);
    update ausencias_sindico set fim_avisado = true where id = a.id;
  end loop;

  a := ausencia_ativa();
  for r in select id, decisor_id from decisoes_pedido where estado = 'AGUARDANDO' and modo = 'PESSOA' and prazo < hoje_no_condominio() loop
    if a.id is not null and r.decisor_id = a.sindico_id then
      select * into m from conselho_membros where id = a.substituto_id;
      if membro_com_painel(m) and membro_em_dia(m) then perform avisar_decisao(m.pessoa_id, r.id, 'VENCIDA'); end if;
    end if;
    if v_regra = 'SUBSINDICO' then
      perform escalar_para(subsindico_em_dia(), r.decisor_id, r.id, null);
    elsif v_regra = 'CONSELHO' then
      for m in select * from conselho_membros cm where membro_titular(cm) and membro_em_dia(cm) loop
        perform escalar_para(m, r.decisor_id, r.id, null);
      end loop;
    end if;
  end loop;
  for r in select id, decisor_id from despesas_aprovacao where estado = 'AGUARDANDO' and modo = 'PESSOA' and prazo < hoje_no_condominio() loop
    perform avisar_aprovacao(pessoa_do_vinculo(r.decisor_id), 'DESPESA_VENCIDA', r.id, null, null);
    if a.id is not null and r.decisor_id = a.sindico_id then
      select * into m from conselho_membros where id = a.substituto_id;
      if membro_com_painel(m) and membro_em_dia(m) then perform avisar_aprovacao(m.pessoa_id, 'DESPESA_VENCIDA', r.id, null, null); end if;
    end if;
    if v_regra = 'SUBSINDICO' then
      perform escalar_para(subsindico_em_dia(), r.decisor_id, null, r.id);
    elsif v_regra = 'CONSELHO' then
      for m in select * from conselho_membros cm where membro_titular(cm) and membro_em_dia(cm) loop
        perform escalar_para(m, r.decisor_id, null, r.id);
      end loop;
    end if;
  end loop;

  -- O mandato perto do fim avisa o síndico, uma vez por fim de mandato.
  for m in select * from conselho_membros cm where cm.retirado_em is null and cm.mandato_fim between hoje_no_condominio() and hoje_no_condominio() + 30 loop
    insert into avisos_aprovacao (condominio_id, pessoa_id, tipo, membro_id, referencia)
    select m.condominio_id, v.pessoa_id, 'MANDATO_VENCENDO', m.id, m.mandato_fim
      from vinculos v where v.condominio_id = m.condominio_id and v.funcao = 'SINDICO' and v.revogado_em is null
    on conflict do nothing;
  end loop;
  return v_n;
end $$;

alter function verificar_decisoes() rename to verificar_decisoes_f303;
alter function verificar_decisoes_f303() security invoker;
create function verificar_decisoes() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer;
begin
  v_total := verificar_decisoes_f303();
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform entrar_como_sistema(c.id);
    begin
      v_total := v_total + verificar_aprovacoes();
    exception when others then
      raise warning 'Aprovações do condomínio % não conferidas: %', c.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

create function eh_votante(p_pessoa uuid, p_decisao uuid, p_despesa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from votos_conselho v join conselho_membros m on m.id = v.membro_id
                  where (v.decisao_id = p_decisao or v.despesa_id = p_despesa) and m.pessoa_id = p_pessoa)
$$;

-- Quem vê a despesa: quem cuida das despesas (o síndico, Atualizar e Aprovar), quem pediu, quem
-- decide, quem vota e o substituto do síndico ausente.
create function despesa_visivel(x despesas_aprovacao, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select pode(p_pessoa, x.condominio_id, 'despesas.ver') or x.pedida_por = p_pessoa
      or exists (select 1 from vinculos v where v.id = x.decisor_id and v.pessoa_id = p_pessoa)
      or eh_votante(p_pessoa, null, x.id)
      or (x.modo = 'PESSOA' and substitui_o_sindico(p_pessoa, x.decisor_id))
$$;

create function despesa_espera(x despesas_aprovacao, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select x.estado = 'AGUARDANDO' and (
         (x.modo = 'PESSOA' and (exists (select 1 from vinculos v where v.id = x.decisor_id and v.pessoa_id = p_pessoa)
                                 or substitui_o_sindico(p_pessoa, x.decisor_id)))
      or (x.modo = 'CONSELHO' and x.prazo >= hoje_no_condominio()
          and exists (select 1 from votos_conselho v join conselho_membros m on m.id = v.membro_id
                       where v.despesa_id = x.id and m.pessoa_id = p_pessoa and v.escolha is null and membro_vota(m))))
$$;

-- ---------------------------------------------------------------------------------------
-- O que as telas leem.

-- Os anexos liberados do item, para a tela e para o link.
create function anexos_aprovacao_json(p_decisoes uuid[], p_despesa uuid, p_com_quem boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', a.id, 'parte', a.parte, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', coalesce(a.tamanho, a.tamanho_declarado),
           'situacao', case when p_com_quem then a.situacao end, 'motivoRecusa', case when p_com_quem then a.motivo_recusa end,
           'enviadoEm', case when p_com_quem then a.enviado_em end, 'enviadoPor', case when p_com_quem then nome_pessoa(a.enviado_por) end))
         order by a.enviado_em, a.id), '[]'::jsonb)
    from arquivos_aprovacao a
   where (a.decisao_id = any (p_decisoes) or a.despesa_id = p_despesa) and a.retirado_em is null
     and (a.situacao = 'LIBERADO' or (p_com_quem and a.situacao <> 'ENVIANDO'))
$$;

-- A votação do item. A gestão vê os votos na hora; o membro sem papel na gestão vê só o próprio
-- até fechar (regra 4).
create function votacao_json(p_decisao uuid, p_despesa uuid, p_titulares integer, p_necessarios integer, p_aguardando boolean,
                             p_prazo date, p_pessoa uuid, p_gestao boolean)
returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.*, m.nome, m.papel, m.pessoa_id, m.canal as canal_membro, membro_em_dia(m) as em_dia, membro_vota(m) as vota
      from votos_conselho x join conselho_membros m on m.id = x.membro_id
     where x.decisao_id = p_decisao or x.despesa_id = p_despesa
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'titulares', p_titulares, 'necessarios', p_necessarios,
    'votaram', (select count(*) from v where escolha is not null),
    'contagem', case when p_gestao or not p_aguardando then
                  coalesce((select jsonb_object_agg(escolha, n) from (select escolha, count(*) as n from v where escolha is not null group by escolha) c), '{}'::jsonb) end,
    'faltam', case when p_gestao then (select jsonb_agg(nome order by lower(nome)) from v where escolha is null and vota) end,
    'votos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'membroId', v.membro_id, 'nome', v.nome, 'papel', v.papel, 'escolha', v.escolha, 'justificativa', v.justificativa,
               'votadoEm', v.votado_em, 'canal', v.canal, 'emDia', v.em_dia, 'eu', v.pessoa_id is not distinct from p_pessoa and p_pessoa is not null,
               'link', case when p_gestao then (
                 select jsonb_strip_nulls(jsonb_build_object('canal', v.canal_membro, 'abertoEm', l.aberto_em, 'mandadoEm', l.codigo_em,
                          'envio', coalesce((select e.estado from envios_email e where e.link_conselho_id = l.id order by e.criado_em desc limit 1),
                                            case when v.canal_membro = 'WHATSAPP' then 'COPIAR' end),
                          'podeReenviar', p_aguardando and v.vota and p_prazo >= hoje_no_condominio()))
                   from links_conselho l where l.membro_id = v.membro_id and (l.decisao_id = p_decisao or l.despesa_id = p_despesa)
                                           and l.finalidade = 'VOTO') end))
             order by v.papel <> 'SUBSINDICO', lower(v.nome))
        from v where p_gestao or not p_aguardando or v.pessoa_id = p_pessoa), '[]'::jsonb),
    'eu', (select jsonb_strip_nulls(jsonb_build_object('membroId', v.membro_id, 'escolha', v.escolha, 'justificativa', v.justificativa,
                                                       'votadoEm', v.votado_em,
                                                       'podeVotar', p_aguardando and v.vota and p_prazo >= hoje_no_condominio()))
             from v where v.pessoa_id = p_pessoa and p_pessoa is not null limit 1)))
$$;

-- Os links que não são de voto (o do substituto e o do aviso da vencida), para a gestão ver
-- quem tem e mandar de novo ("Copiar o link do substituto").
create function links_extras_json(p_decisao uuid, p_despesa uuid, p_aberto boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'membroId', m.id, 'nome', m.nome, 'finalidade', l.finalidade, 'canal', m.canal, 'abertoEm', l.aberto_em, 'mandadoEm', l.codigo_em,
           'envio', coalesce((select e.estado from envios_email e where e.link_conselho_id = l.id order by e.criado_em desc limit 1),
                             case when m.canal = 'WHATSAPP' then 'COPIAR' end),
           'podeReenviar', p_aberto and membro_em_dia(m) and (l.finalidade <> 'SUBSTITUTO' or substituto_vale(l))))
         order by l.finalidade, lower(m.nome)), '[]'::jsonb)
    from links_conselho l join conselho_membros m on m.id = l.membro_id
   where (l.decisao_id = p_decisao or l.despesa_id = p_despesa) and l.finalidade <> 'VOTO' and l.revogado_em is null
$$;

-- Quem é da gestão da decisão: o síndico, quem aprova, quem pediu e quem atualiza o pedido.
create function gestao_da_decisao(d decisoes_pedido, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select eh_sindico(p_pessoa) or pode(p_pessoa, d.condominio_id, 'decisoes.aprovar') or d.pedida_por = p_pessoa
      or exists (select 1 from pedidos p where p.id = d.pedido_id and pedido_visivel(p_pessoa, p) and pode_no_pedido(p_pessoa, p, 'pedidos.atualizar'))
$$;

-- A decisão (0280) com o conselho, a origem, o substituto e os anexos.
create or replace function decisao_json(d decisoes_pedido, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'versao', d.versao, 'estado', d.estado, 'modo', d.modo, 'pendenciaId', d.pendencia_id, 'pergunta', d.pergunta, 'porque', d.porque,
    'prazo', to_char(d.prazo, 'YYYY-MM-DD'), 'vencida', d.estado = 'AGUARDANDO' and d.prazo < hoje_no_condominio(),
    'decisor', case when d.decisor_id is not null then jsonb_build_object('vinculoId', d.decisor_id, 'nome', nome_do_vinculo(d.decisor_id),
                                  'eu', exists (select 1 from vinculos where id = d.decisor_id and pessoa_id = p_pessoa)) end,
    'pedidaEm', d.pedida_em, 'pedidaPor', nome_pessoa(d.pedida_por),
    'respondidaEm', d.respondida_em,
    'respondidaPor', coalesce(nome_pessoa(d.respondida_por), (select nome from conselho_membros where id = d.respondida_membro_id),
                              case when d.modo = 'CONSELHO' and d.estado in ('APROVADA', 'DEVOLVIDA') then 'Conselho' end),
    'alternativaAprovada', d.alternativa_aprovada, 'justificativa', d.justificativa, 'retiradaMotivo', d.retirada_motivo,
    'alternativas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', a.numero, 'descricao', a.descricao,
                                                                                    'detalhe', a.detalhe, 'custo', a.custo, 'moeda', a.moeda))
                                               order by a.numero)
                                from alternativas_decisao a where a.decisao_id = d.id), '[]'::jsonb),
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto, 'estado', p.estado)
                 from pedidos p where p.id = d.pedido_id and pedido_visivel(p_pessoa, p)),
    'conselho', case when d.titulares is not null then
                  votacao_json(d.id, null, d.titulares, d.votos_necessarios, d.estado = 'AGUARDANDO', d.prazo, p_pessoa, gestao_da_decisao(d, p_pessoa)) end,
    'origem', (select jsonb_build_object('id', o.id, 'justificativa', o.justificativa,
                                         'conselho', votacao_json(o.id, null, o.titulares, o.votos_necessarios, false, o.prazo, p_pessoa, true))
                 from decisoes_pedido o where o.id = d.origem_id),
    'voltouAoSindico', (select n.id from decisoes_pedido n where n.origem_id = d.id),
    'substituto', (select jsonb_build_object('nome', m.nome, 'ate', to_char(a.ate, 'YYYY-MM-DD'))
                     from ausencias_sindico a join conselho_membros m on m.id = a.substituto_id
                    where d.estado = 'AGUARDANDO' and d.modo = 'PESSOA' and a.sindico_id = d.decisor_id and a.encerrada_em is null
                      and hoje_no_condominio() between a.de and a.ate),
    'anexos', anexos_aprovacao_json(array_remove(array[d.id, d.origem_id], null), null, gestao_da_decisao(d, p_pessoa)),
    'links', case when gestao_da_decisao(d, p_pessoa) and d.modo = 'PESSOA' then links_extras_json(d.id, null, d.estado = 'AGUARDANDO') end,
    'pode', jsonb_build_object(
      'responder', d.estado = 'AGUARDANDO' and d.modo = 'PESSOA'
                   and ((pode(p_pessoa, d.condominio_id, 'decisoes.aprovar')
                         and (exists (select 1 from vinculos where id = d.decisor_id and pessoa_id = p_pessoa and revogado_em is null)
                              or eh_sindico(p_pessoa)))
                        or substitui_o_sindico(p_pessoa, d.decisor_id)),
      'votar', d.estado = 'AGUARDANDO' and d.modo = 'CONSELHO' and d.prazo >= hoje_no_condominio()
               and exists (select 1 from votos_conselho v join conselho_membros m on m.id = v.membro_id
                            where v.decisao_id = d.id and m.pessoa_id = p_pessoa and membro_vota(m)),
      'reenviar', d.estado = 'AGUARDANDO' and gestao_da_decisao(d, p_pessoa),
      'anexar', d.estado = 'AGUARDANDO'
                and (d.pedida_por = p_pessoa or exists (select 1 from pedidos p where p.id = d.pedido_id and pode_no_pedido(p_pessoa, p, 'pedidos.atualizar'))),
      'retirar', d.estado = 'AGUARDANDO'
                 and (d.pedida_por = p_pessoa or pode_no_pedido(p_pessoa, (select p from pedidos p where p.id = d.pedido_id), 'pedidos.atualizar')))))
$$;

-- A decisão que a pessoa enxerga na tela Decisões: pelo pedido (como na 0280), por votar nela
-- ou por responder no lugar do síndico.
create function decisao_visivel(d decisoes_pedido, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select (pode(p_pessoa, d.condominio_id, 'pedidos.ver') and exists (select 1 from pedidos p where p.id = d.pedido_id and pedido_visivel(p_pessoa, p)))
      or eh_votante(p_pessoa, d.id, null)
      or (d.modo = 'PESSOA' and substitui_o_sindico(p_pessoa, d.decisor_id))
$$;

-- O que espera a resposta da pessoa: pedido a ela, o voto que falta ou no lugar do síndico.
create function decisao_espera(d decisoes_pedido, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select d.estado = 'AGUARDANDO' and (
         (d.modo = 'PESSOA' and (exists (select 1 from vinculos x where x.id = d.decisor_id and x.pessoa_id = p_pessoa)
                                 or substitui_o_sindico(p_pessoa, d.decisor_id)))
      or (d.modo = 'CONSELHO' and d.prazo >= hoje_no_condominio()
          and exists (select 1 from votos_conselho v join conselho_membros m on m.id = v.membro_id
                       where v.decisao_id = d.id and m.pessoa_id = p_pessoa and v.escolha is null and membro_vota(m))))
$$;

create function ausencia_json() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('id', a.id, 'versao', a.versao, 'de', to_char(a.de, 'YYYY-MM-DD'), 'ate', to_char(a.ate, 'YYYY-MM-DD'),
                            'motivo', a.motivo, 'sindico', nome_do_vinculo(a.sindico_id), 'substituto', m.nome, 'substitutoId', m.id,
                            'ativa', hoje_no_condominio() between a.de and a.ate)
    from ausencias_sindico a join conselho_membros m on m.id = a.substituto_id
   where a.encerrada_em is null and a.ate >= hoje_no_condominio()
   order by a.de limit 1
$$;

-- A tela Decisões (0280). AGUARDANDO: o que espera a minha resposta e, para o síndico, quem
-- pediu e quem vota (já tendo votado, para trocar), o que está em votação no conselho.
-- DECIDIDAS e TODAS: o que eu pedi, respondo ou voto; o síndico vê todas.
create or replace function plataforma_decisoes(p_pessoa uuid, p_condominio uuid, p_filtro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filtro text := coalesce(p_filtro, 'AGUARDANDO');
  v_sindico boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if v_filtro not in ('AGUARDANDO', 'DECIDIDAS', 'TODAS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  v_sindico := eh_sindico(p_pessoa);
  return jsonb_build_object(
    'decisoes', coalesce((
      select jsonb_agg(decisao_json(d, p_pessoa)
                       order by d.estado <> 'AGUARDANDO', case when d.estado = 'AGUARDANDO' then d.prazo end, d.respondida_em desc nulls last, d.pedida_em desc)
        from decisoes_pedido d
       where decisao_visivel(d, p_pessoa)
         and case v_filtro
               when 'AGUARDANDO' then decisao_espera(d, p_pessoa)
                                      or (d.estado = 'AGUARDANDO' and d.modo = 'CONSELHO'
                                          and (v_sindico or d.pedida_por = p_pessoa or eh_votante(p_pessoa, d.id, null)))
               when 'DECIDIDAS' then d.estado in ('APROVADA', 'DEVOLVIDA')
               else true end
         and (v_filtro = 'AGUARDANDO' or v_sindico or d.pedida_por = p_pessoa or eh_votante(p_pessoa, d.id, null)
              or exists (select 1 from vinculos x where x.id = d.decisor_id and x.pessoa_id = p_pessoa)
              or (d.modo = 'PESSOA' and substitui_o_sindico(p_pessoa, d.decisor_id)))), '[]'::jsonb),
    'aguardandoEu', (select count(*) from decisoes_pedido d where decisao_espera(d, p_pessoa)),
    'despesasAguardando', (select count(*) from despesas_aprovacao x where despesa_espera(x, p_pessoa)),
    'filtro', v_filtro,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'conselho', conselho_quorum_json(),
    'ausencia', ausencia_json(),
    'pode', jsonb_build_object('aprovar', pode(p_pessoa, p_condominio, 'decisoes.aprovar'),
                               'despesas', pode(p_pessoa, p_condominio, 'despesas.ver')
                                           or exists (select 1 from despesas_aprovacao x where despesa_visivel(x, p_pessoa))));
end $$;

-- O resumo do Início e do menu (0280): também os votos que faltam e as despesas.
create or replace function resumo_decisoes(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with fila as (
    select d.prazo, d.pedida_em, d.modo, false as despesa from decisoes_pedido d where decisao_espera(d, p_pessoa)
    union all
    select x.prazo, x.pedida_em, x.modo, true from despesas_aprovacao x where despesa_espera(x, p_pessoa)
  )
  select jsonb_build_object('aguardando', count(*), 'vencidas', count(*) filter (where prazo < hoje_no_condominio()),
                            'maisAntigaDias', hoje_no_condominio()
                              - min((pedida_em at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date),
                            'votos', count(*) filter (where modo = 'CONSELHO'), 'despesas', count(*) filter (where despesa),
                            -- As votações abertas em que a pessoa vota, já tendo votado ou não: quem só vota
                            -- segue vendo Decisões para trocar o voto até fechar.
                            'votando', (select count(*) from decisoes_pedido d
                                         where d.modo = 'CONSELHO' and d.estado = 'AGUARDANDO' and d.prazo >= hoje_no_condominio()
                                           and eh_votante(p_pessoa, d.id, null))
                                     + (select count(*) from despesas_aprovacao x
                                         where x.modo = 'CONSELHO' and x.estado = 'AGUARDANDO' and x.voltou_ao_sindico_em is null
                                           and x.prazo >= hoje_no_condominio() and eh_votante(p_pessoa, null, x.id)))
    from fila
$$;

-- O Início: a linha das decisões também para quem só vota ou substitui, quando há o que fazer.
alter function plataforma_painel(uuid, uuid) rename to painel_f303;
alter function painel_f303(uuid, uuid) security invoker;
create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  r jsonb;
begin
  v := painel_f303(p_pessoa, p_condominio);
  if not v ? 'decisoes' then
    r := resumo_decisoes(p_pessoa);
    if (r ->> 'aguardando')::integer > 0 or (r ->> 'votando')::integer > 0 then v := v || jsonb_build_object('decisoes', r); end if;
  end if;
  return v;
end $$;

-- O pedido (0281) com o conselho em Quem decide (quadro 413).
alter function plataforma_pedido(uuid, uuid, uuid) rename to pedido_f303;
alter function pedido_f303(uuid, uuid, uuid) security invoker;
create function plataforma_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := pedido_f303(p_pessoa, p_condominio, p_id);
  if coalesce((v -> 'pode' ->> 'pedirDecisao')::boolean, false) then
    v := v || jsonb_build_object('conselho', conselho_quorum_json());
  end if;
  return v;
end $$;

-- Pedir a decisão (0280), agora também ao conselho (p_modo CONSELHO, sem quem decide).
alter function plataforma_pedir_decisao(uuid, uuid, uuid, integer, text, text, date, uuid, jsonb) rename to pedir_decisao_f303;
alter function pedir_decisao_f303(uuid, uuid, uuid, integer, text, text, date, uuid, jsonb) security invoker;
create function plataforma_pedir_decisao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_pergunta text, p_porque text,
                                         p_prazo date, p_decisor uuid, p_alternativas jsonb, p_modo text default 'PESSOA')
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
  v_responsavel uuid;
  v_r jsonb;
  q record;
  a record;
begin
  if coalesce(p_modo, 'PESSOA') = 'PESSOA' then
    v_r := pedir_decisao_f303(p_pessoa, p_condominio, p_id, p_versao, p_pergunta, p_porque, p_prazo, p_decisor, p_alternativas);
    return v_r || jsonb_build_object('links', garantir_substituto());
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if p_modo <> 'CONSELHO' then perform recusar_campos('Escolha quem decide', 'modo'); end if;
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.atualizar');
  perform exigir_em_andamento(v);
  if p_decisor is not null then perform recusar_campos('Pedida ao conselho, não há uma pessoa que decide', 'decisorId'); end if;
  if length(btrim(coalesce(p_pergunta, ''))) not between 3 and 500 then
    perform recusar_campos('Diga o que precisa ser decidido (3 a 500 caracteres)', 'pergunta');
  end if;
  if length(v_porque) not between 3 and 500 then perform recusar_campos('Por que agora: de 3 a 500 caracteres', 'porque'); end if;
  if p_prazo is null or p_prazo < hoje_no_condominio() or p_prazo > hoje_no_condominio() + 90 then
    perform recusar_campos('O prazo vai de hoje a 90 dias', 'prazo');
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
  select * into q from exigir_quorum();
  v_responsavel := coalesce(vinculo_do_sindico(), meu_vinculo(p_pessoa));

  v_versao := tocar_pedido(p_id, p_versao);
  insert into pendencias_pedido (condominio_id, pedido_id, tipo, motivo, responsavel_id, aberta_por)
  values (p_condominio, p_id, 'DECISAO', left(btrim(p_pergunta), 300), v_responsavel, p_pessoa) returning id into v_pendencia;
  perform definir_transicao('PEDIDA');
  insert into decisoes_pedido (condominio_id, pedido_id, pendencia_id, pergunta, porque, prazo, decisor_id, estado, pedida_por, modo,
                               titulares, votos_necessarios)
  values (p_condominio, p_id, v_pendencia, btrim(p_pergunta), v_porque, p_prazo, null, 'AGUARDANDO', p_pessoa, 'CONSELHO', q.titulares, q.necessarios)
  returning id into v_decisao;
  insert into alternativas_decisao (condominio_id, decisao_id, numero, descricao, detalhe, custo)
  select p_condominio, v_decisao, x.n, btrim(x.value ->> 'descricao'), nullif(btrim(coalesce(x.value ->> 'detalhe', '')), ''),
         case when jsonb_typeof(x.value -> 'custo') = 'number' then (x.value ->> 'custo')::bigint end
    from jsonb_array_elements(p_alternativas) with ordinality x(value, n);
  perform registrar_historico('pedido.pendencia_aberta', 'pedidos', p_id::text,
    jsonb_build_object('pendencia', v_pendencia, 'tipo', 'DECISAO', 'responsavel', v_responsavel));
  perform registrar_historico('pedido.decisao_pedida', 'pedidos', p_id::text,
    jsonb_build_object('decisao', v_decisao, 'conselho', true, 'titulares', q.titulares, 'necessarios', q.necessarios,
                       'prazo', to_char(p_prazo, 'YYYY-MM-DD'), 'alternativas', jsonb_array_length(p_alternativas)));
  return jsonb_build_object('versao', v_versao, 'id', v_decisao, 'titulares', q.titulares, 'necessarios', q.necessarios,
                            'links', abrir_votacao(v_decisao, null, p_pessoa));
end $$;

-- Responder (0280): a decisão do conselho se vota; o substituto responde a pedida ao síndico.
alter function plataforma_responder_decisao(uuid, uuid, uuid, integer, boolean, integer, text) rename to responder_decisao_f303;
alter function responder_decisao_f303(uuid, uuid, uuid, integer, boolean, integer, text) security invoker;
create function plataforma_responder_decisao(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_versao integer, p_aprovar boolean,
                                             p_alternativa integer, p_justificativa text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d decisoes_pedido;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  select * into d from decisoes_pedido where id = p_decisao for update;
  if not found then raise exception 'Pedido de decisão não encontrado' using errcode = 'TC404'; end if;
  if d.modo = 'CONSELHO' and d.estado = 'AGUARDANDO' then perform recusar_motivo('Pedida ao conselho: cada titular vota', 'DECISAO_DO_CONSELHO'); end if;
  if substitui_o_sindico(p_pessoa, d.decisor_id) and not (pode(p_pessoa, p_condominio, 'decisoes.aprovar') and eh_sindico(p_pessoa)) then
    return jsonb_build_object('versao', responder_decisao_substituto(d, p_pessoa, null, p_versao, p_aprovar, p_alternativa, p_justificativa));
  end if;
  return responder_decisao_f303(p_pessoa, p_condominio, p_decisao, p_versao, p_aprovar, p_alternativa, p_justificativa);
end $$;

-- O voto do conselheiro que tem painel (quadro 414).
create function plataforma_votar_decisao(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_escolha text, p_justificativa text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m conselho_membros;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  m := membro_do_conselho(p_pessoa);
  if m.id is null then raise exception 'Só quem é do conselho vota' using errcode = 'TC401'; end if;
  return registrar_voto(m, p_decisao, null, p_escolha, p_justificativa, 'PAINEL', p_pessoa);
end $$;

-- Reenviar o link (quadro 414): o código troca e o anterior para. Vale para o link de voto, o
-- do substituto e o do aviso (p_finalidade; sem ela, o de voto, depois o do substituto).
create function plataforma_reenviar_link_conselho(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_despesa uuid, p_membro uuid,
                                                  p_finalidade text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisoes_pedido;
  x despesas_aprovacao;
  l links_conselho;
  m conselho_membros;
  v_r jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if p_decisao is not null then
    select * into d from decisoes_pedido where id = p_decisao;
    if not found or not decisao_visivel(d, p_pessoa) then raise exception 'Decisão não encontrada' using errcode = 'TC404'; end if;
    if not gestao_da_decisao(d, p_pessoa) then raise exception 'Sem permissão para reenviar o link' using errcode = 'TC401'; end if;
    if d.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta decisão já fechou', 'DECISAO_FECHADA'); end if;
  else
    select * into x from despesas_aprovacao where id = p_despesa;
    if not found or not despesa_visivel(x, p_pessoa) then raise exception 'Despesa não encontrada' using errcode = 'TC404'; end if;
    if not (pode(p_pessoa, p_condominio, 'despesas.registrar') or x.pedida_por = p_pessoa) then
      raise exception 'Sem permissão para reenviar o link' using errcode = 'TC401';
    end if;
    if x.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta despesa já fechou', 'DESPESA_FECHADA'); end if;
  end if;
  if p_finalidade is not null and p_finalidade not in ('VOTO', 'SUBSTITUTO', 'AVISO') then
    perform recusar_campos('Diga qual link: de voto, do substituto ou do aviso', 'finalidade');
  end if;
  select * into l from links_conselho
   where membro_id = p_membro and (decisao_id = p_decisao or despesa_id = p_despesa) and revogado_em is null
     and (p_finalidade is null or finalidade = p_finalidade)
   order by array_position(array['VOTO', 'SUBSTITUTO', 'AVISO'], finalidade) limit 1;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  m := exigir_membro(l.membro_id);
  if not membro_em_dia(m) then perform recusar_motivo('O mandato não está em dia: o link não vale', 'MANDATO_VENCIDO'); end if;
  if l.finalidade = 'VOTO' and not membro_titular(m) then perform recusar_motivo('Suplente não vota', 'SUPLENTE_NAO_VOTA'); end if;
  if l.finalidade = 'SUBSTITUTO' and not substituto_vale(l) then
    perform recusar_motivo('A ausência do síndico acabou: ele responde', 'AUSENCIA_ACABOU');
  end if;
  v_r := mandar_link_conselho(l, p_pessoa);
  perform registrar_historico('conselho.link_reenviado', case when p_decisao is not null then 'decisoes_pedido' else 'despesas_aprovacao' end,
    coalesce(p_decisao, p_despesa)::text, jsonb_build_object('membro', m.id, 'canal', m.canal, 'finalidade', l.finalidade));
  return v_r;
end $$;

-- ---------------------------------------------------------------------------------------
-- Pessoas › Conselho (quadros 410 e 411) e as Regras (quadro 421).

create function membro_json(m conselho_membros, p_contatos boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'versao', m.versao, 'nome', m.nome, 'papel', m.papel, 'titular', membro_titular(m),
    'pessoaId', m.pessoa_id, 'contatoId', m.contato_id,
    'unidade', case when m.contato_id is not null then unidades_do_contato(m.contato_id) end,
    'mandatoInicio', to_char(m.mandato_inicio, 'YYYY-MM-DD'), 'mandatoFim', to_char(m.mandato_fim, 'YYYY-MM-DD'),
    'emDia', membro_em_dia(m), 'vota', membro_titular(m) and membro_em_dia(m),
    'mandatoVencendo', membro_em_dia(m) and m.mandato_fim - hoje_no_condominio() <= 30,
    'canal', m.canal, 'painel', membro_com_painel(m),
    'celular', case when p_contatos then m.celular end, 'email', case when p_contatos then m.email end,
    'celularMascarado', celular_mascarado(m.celular), 'emailMascarado', email_mascarado(m.email),
    'incluidoEm', m.incluido_em, 'retiradoEm', m.retirado_em, 'retiradoMotivo', case when p_contatos then m.retirado_motivo end))
$$;

create function plataforma_conselho(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gerenciar boolean;
  s conselho_membros;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.ver');
  v_gerenciar := pode(p_pessoa, p_condominio, 'conselho.editar');
  s := subsindico_em_dia();
  return jsonb_strip_nulls(jsonb_build_object(
    'membros', coalesce((select jsonb_agg(membro_json(m, v_gerenciar)
                                          order by array_position(array['SUBSINDICO', 'CONSELHEIRO', 'CONSELHEIRO_FISCAL', 'SUPLENTE'], m.papel), lower(m.nome))
                           from conselho_membros m where m.retirado_em is null), '[]'::jsonb),
    'retirados', case when v_gerenciar then coalesce((select jsonb_agg(membro_json(m, true) order by m.retirado_em desc)
                                                        from conselho_membros m where m.retirado_em is not null), '[]'::jsonb) end,
    'regras', conselho_quorum_json(),
    'subsindico', case when s.id is not null then jsonb_build_object('id', s.id, 'nome', s.nome) end,
    'sindico', nome_do_vinculo(vinculo_do_sindico()),
    'ausencia', ausencia_json(),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('gerenciar', v_gerenciar, 'marcarAusencia', v_gerenciar and s.id is not null and ausencia_json() is null)));
end $$;

-- Quem pode entrar no conselho: pessoa com acesso ou morador cadastrado (nome ou unidade).
create function plataforma_conselho_candidatos(p_pessoa uuid, p_condominio uuid, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  return jsonb_build_object('candidatos', coalesce((select jsonb_agg(x.item order by x.ordem, x.nome) from (
      select 1 as ordem, lower(p.nome) as nome,
             jsonb_build_object('tipo', 'PESSOA', 'id', p.id, 'nome', p.nome, 'detalhe', 'Pessoa com acesso ao painel') as item
        from (select distinct pessoa_id from vinculos where condominio_id = p_condominio and revogado_em is null and funcao in ('SINDICO', 'AUTORIZADO')) v
        join pessoas p on p.id = v.pessoa_id
       where (v_busca is null or lower(p.nome) like '%' || v_busca || '%')
         and not exists (select 1 from conselho_membros m where m.pessoa_id = p.id and m.retirado_em is null)
      union all
      select 2, lower(ct.nome),
             jsonb_strip_nulls(jsonb_build_object('tipo', 'CONTATO', 'id', ct.id, 'nome', ct.nome, 'detalhe', unidades_do_contato(ct.id),
                                                  'celularMascarado', celular_mascarado(ct.telefone), 'emailMascarado', email_mascarado(ct.email)))
        from contatos ct
       where ct.dados_removidos_em is null and contato_ativo(ct.id)
         and (v_busca is null or lower(ct.nome) like '%' || v_busca || '%' or lower(coalesce(unidades_do_contato(ct.id), '')) like '%' || v_busca || '%')
         and not exists (select 1 from conselho_membros m where m.contato_id = ct.id and m.retirado_em is null)
       order by 1, 2 limit 30) x), '[]'::jsonb));
end $$;

-- Confere o papel, o mandato, o canal e os contatos do membro.
create function exigir_dados_membro(p_papel text, p_inicio date, p_fim date, p_canal text, p_celular text, p_email text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_papel is null or p_papel not in ('SUBSINDICO', 'CONSELHEIRO', 'CONSELHEIRO_FISCAL', 'SUPLENTE') then
    perform recusar_campos('Escolha o papel: subsíndico, conselheiro, conselheiro fiscal ou suplente', 'papel');
  end if;
  if p_inicio is null then perform recusar_campos('Diga o início do mandato', 'mandatoInicio'); end if;
  if p_fim is null or p_fim < p_inicio then perform recusar_campos('O fim do mandato vem depois do início', 'mandatoFim'); end if;
  if p_fim < hoje_no_condominio() then perform recusar_campos('O fim do mandato já passou', 'mandatoFim'); end if;
  if p_celular is not null and p_celular !~ '^\+?[0-9]{10,15}$' then perform recusar_campos('Celular com DDD', 'celular'); end if;
  if p_email is not null and not email_valido(p_email) then perform recusar_campos('E-mail inválido', 'email'); end if;
  if p_canal is null or p_canal not in ('WHATSAPP', 'EMAIL') then perform recusar_campos('Diga como recebe o link para votar', 'canal'); end if;
  if p_canal = 'WHATSAPP' and p_celular is null then perform recusar_campos('Para receber pelo WhatsApp, falta o celular', 'celular'); end if;
  if p_canal = 'EMAIL' and p_email is null then perform recusar_campos('Para receber pelo e-mail, falta o e-mail', 'email'); end if;
end $$;

create function so_digitos_celular(p text) returns text
language sql immutable
set search_path = public
as $$ select nullif(case when btrim(coalesce(p, '')) like '+%' then '+' else '' end || regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') $$;

-- A mudança de quem vota pode fechar votações (mandato vencido, membro retirado).
create function apurar_votacoes_do_membro(p_membro uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  d decisoes_pedido;
  x despesas_aprovacao;
begin
  for d in select dp.* from decisoes_pedido dp where dp.estado = 'AGUARDANDO' and dp.modo = 'CONSELHO'
                and exists (select 1 from votos_conselho v where v.decisao_id = dp.id and v.membro_id = p_membro) loop
    perform fechar_decisao_do_conselho(d);
  end loop;
  for x in select da.* from despesas_aprovacao da where da.estado = 'AGUARDANDO' and da.modo = 'CONSELHO'
                and exists (select 1 from votos_conselho v where v.despesa_id = da.id and v.membro_id = p_membro) loop
    perform fechar_despesa_do_conselho(x);
  end loop;
end $$;

create function plataforma_incluir_membro(p_pessoa uuid, p_condominio uuid, p_membro_pessoa uuid, p_contato uuid, p_nome text, p_celular text,
                                          p_email text, p_papel text, p_inicio date, p_fim date, p_canal text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ct contatos;
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_celular text := so_digitos_celular(p_celular);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  if p_membro_pessoa is not null and p_contato is not null then perform recusar_campos('Escolha a pessoa ou o morador, não os dois', 'pessoaId'); end if;
  if p_membro_pessoa is not null then
    if not exists (select 1 from vinculos where pessoa_id = p_membro_pessoa and condominio_id = p_condominio and revogado_em is null) then
      perform recusar_campos('Escolha uma pessoa com acesso a este condomínio', 'pessoaId');
    end if;
    v_nome := nome_pessoa(p_membro_pessoa);
    if exists (select 1 from conselho_membros where pessoa_id = p_membro_pessoa and retirado_em is null) then
      perform recusar_motivo('Esta pessoa já é do conselho', 'JA_E_MEMBRO');
    end if;
  elsif p_contato is not null then
    select * into ct from contatos where id = p_contato and dados_removidos_em is null;
    if not found then perform recusar_campos('Escolha um morador cadastrado', 'contatoId'); end if;
    v_nome := ct.nome;
    v_celular := coalesce(v_celular, so_digitos_celular(ct.telefone));
    v_email := coalesce(v_email, lower(ct.email));
    if exists (select 1 from conselho_membros where contato_id = p_contato and retirado_em is null) then
      perform recusar_motivo('Este morador já é do conselho', 'JA_E_MEMBRO');
    end if;
  end if;
  if coalesce(length(v_nome), 0) not between 2 and 120 then perform recusar_campos('Escreva o nome (2 a 120 caracteres)', 'nome'); end if;
  perform exigir_dados_membro(p_papel, p_inicio, p_fim, p_canal, v_celular, v_email);
  if p_papel = 'SUBSINDICO' and exists (select 1 from conselho_membros where papel = 'SUBSINDICO' and retirado_em is null) then
    perform recusar_motivo('Já há um subsíndico: retire ou mude o papel dele antes', 'JA_HA_SUBSINDICO');
  end if;
  insert into conselho_membros (condominio_id, pessoa_id, contato_id, nome, celular, email, papel, mandato_inicio, mandato_fim, canal, incluido_por)
  values (p_condominio, p_membro_pessoa, p_contato, v_nome, v_celular, v_email, p_papel, p_inicio, p_fim, p_canal, p_pessoa)
  returning id, versao into v_id, v_versao;
  perform registrar_historico('conselho.membro_incluido', 'conselho_membros', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'papel', p_papel, 'inicio', p_inicio, 'fim', p_fim, 'canal', p_canal, 'pessoa', p_membro_pessoa, 'contato', p_contato)));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Mudar o papel, o mandato (renovar), o canal e os contatos. Quem é o membro não muda.
create function plataforma_alterar_membro(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_papel text, p_inicio date, p_fim date,
                                          p_canal text, p_celular text, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m conselho_membros;
  v_celular text := so_digitos_celular(p_celular);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_versao integer;
  v_campos text[] := '{}';
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  m := exigir_membro(p_id);
  if m.retirado_em is not null then perform recusar_motivo('Membro retirado não muda', 'MEMBRO_RETIRADO'); end if;
  perform exigir_dados_membro(p_papel, p_inicio, p_fim, p_canal, v_celular, v_email);
  if p_papel = 'SUBSINDICO' and m.papel <> 'SUBSINDICO' and exists (select 1 from conselho_membros where papel = 'SUBSINDICO' and retirado_em is null) then
    perform recusar_motivo('Já há um subsíndico: retire ou mude o papel dele antes', 'JA_HA_SUBSINDICO');
  end if;
  if p_papel = 'SUPLENTE' and m.papel <> 'SUPLENTE'
     and exists (select 1 from votos_conselho v
                   left join decisoes_pedido d on d.id = v.decisao_id
                   left join despesas_aprovacao x on x.id = v.despesa_id
                  where v.membro_id = m.id and v.escolha is null
                    and coalesce(d.estado, x.estado) = 'AGUARDANDO' and coalesce(d.modo, x.modo) = 'CONSELHO') then
    perform recusar_motivo('Ainda tem voto a dar numa votação aberta: espere fechar para passar a suplente', 'VOTO_PENDENTE');
  end if;
  if m.papel = 'SUBSINDICO' and p_papel <> 'SUBSINDICO'
     and exists (select 1 from ausencias_sindico where substituto_id = m.id and encerrada_em is null and ate >= hoje_no_condominio()) then
    perform recusar_motivo('Ele substitui o síndico numa ausência marcada: encerre a ausência antes', 'SUBSTITUTO_EM_AUSENCIA');
  end if;
  if p_papel is distinct from m.papel then v_campos := v_campos || 'papel'::text; end if;
  if (p_inicio, p_fim) is distinct from (m.mandato_inicio, m.mandato_fim) then v_campos := v_campos || 'mandato'::text; end if;
  if p_canal is distinct from m.canal then v_campos := v_campos || 'canal'::text; end if;
  if (v_celular, v_email) is distinct from (m.celular, m.email) then v_campos := v_campos || 'contato'::text; end if;
  update conselho_membros set papel = p_papel, mandato_inicio = p_inicio, mandato_fim = p_fim, canal = p_canal, celular = v_celular, email = v_email
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('conselho_membros', p_id); end if;
  perform registrar_historico('conselho.membro_alterado', 'conselho_membros', p_id::text, jsonb_build_object(
    'campos', to_jsonb(v_campos), 'papel', p_papel, 'inicio', p_inicio, 'fim', p_fim, 'canal', p_canal));
  perform apurar_votacoes_do_membro(p_id);
  return v_versao;
end $$;

-- Retirar pede motivo e não apaga (regra 1). Os links dele param; os votos que deu ficam.
create function plataforma_retirar_membro(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m conselho_membros;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  m := exigir_membro(p_id);
  if m.retirado_em is not null then perform recusar_motivo('Este membro já foi retirado', 'MEMBRO_RETIRADO'); end if;
  if exists (select 1 from ausencias_sindico where substituto_id = m.id and encerrada_em is null and ate >= hoje_no_condominio()) then
    perform recusar_motivo('Ele substitui o síndico numa ausência marcada: encerre a ausência antes', 'SUBSTITUTO_EM_AUSENCIA');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update conselho_membros set retirado_em = app_now(), retirado_por = p_pessoa, retirado_motivo = v_motivo
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('conselho_membros', p_id); end if;
  update codigos_sem_conta set revogado_em = app_now()
   where tipo = 'CONSELHO' and revogado_em is null and alvo_id in (select id from links_conselho where membro_id = p_id);
  update links_conselho set revogado_em = app_now() where membro_id = p_id and revogado_em is null;
  update envios_email set estado = 'CANCELADO', motivo = 'O membro saiu do conselho'
   where estado = 'NA_FILA' and link_conselho_id in (select id from links_conselho where membro_id = p_id);
  perform registrar_historico('conselho.membro_retirado', 'conselho_membros', p_id::text, jsonb_build_object('motivo', v_motivo));
  perform apurar_votacoes_do_membro(p_id);
  return v_versao;
end $$;

create function plataforma_regras_decisoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare s conselho_membros;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  s := subsindico_em_dia();
  return conselho_quorum_json() || jsonb_strip_nulls(jsonb_build_object(
    'versao', (select versao from configuracao_condominio),
    'subsindico', s.nome, 'sindico', nome_do_vinculo(vinculo_do_sindico()),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar'))));
end $$;

create function plataforma_definir_regras_decisoes(p_pessoa uuid, p_condominio uuid, p_versao integer, p_quorum text, p_minimo integer,
                                                   p_empate text, p_vencida text, p_alcada bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes configuracao_condominio;
  v_versao integer;
  v_minimo integer := case when p_quorum = 'MINIMO' then p_minimo end;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_quorum is null or p_quorum not in ('MAIORIA', 'TODOS', 'MINIMO') then perform recusar_campos('Escolha como o conselho aprova', 'quorum'); end if;
  if p_quorum = 'MINIMO' and (v_minimo is null or v_minimo < 1 or v_minimo > greatest(titulares_em_dia(), 1)) then
    perform recusar_campos(format('Escolha de 1 a %s votos', greatest(titulares_em_dia(), 1)), 'minimo');
  end if;
  if p_empate is null or p_empate not in ('SINDICO', 'DEVOLVIDA') then perform recusar_campos('Escolha o que acontece no empate', 'empate'); end if;
  if p_vencida is null or p_vencida not in ('NINGUEM', 'SUBSINDICO', 'CONSELHO') then
    perform recusar_campos('Escolha quem é avisado da decisão vencida', 'vencidaAvisa');
  end if;
  if p_alcada is not null and p_alcada <= 0 then perform recusar_campos('A alçada é um valor em reais maior que zero', 'alcada'); end if;
  select * into v_antes from configuracao_condominio;
  update configuracao_condominio
     set conselho_quorum = p_quorum, conselho_minimo = v_minimo, conselho_empate = p_empate, decisao_vencida_avisa = p_vencida,
         conselho_alcada = p_alcada
   where id = v_antes.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', v_antes.id); end if;
  perform registrar_historico('regras_decisoes.alteradas', 'configuracao_condominio', v_antes.id::text, jsonb_build_object(
    'antes', jsonb_build_object('quorum', v_antes.conselho_quorum, 'minimo', v_antes.conselho_minimo, 'empate', v_antes.conselho_empate,
                                'vencidaAvisa', v_antes.decisao_vencida_avisa, 'alcada', v_antes.conselho_alcada),
    'depois', jsonb_build_object('quorum', p_quorum, 'minimo', v_minimo, 'empate', p_empate, 'vencidaAvisa', p_vencida, 'alcada', p_alcada)));
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- Ausência do síndico (quadro 412).

create function plataforma_marcar_ausencia(p_pessoa uuid, p_condominio uuid, p_de date, p_ate date, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sindico uuid;
  s conselho_membros;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  if p_de is null or p_de < hoje_no_condominio() then perform recusar_campos('A ausência começa hoje ou depois', 'de'); end if;
  if p_ate is null or p_ate < p_de or p_ate > p_de + 60 then perform recusar_campos('A ausência vai até 60 dias', 'ate'); end if;
  if length(v_motivo) not between 2 and 200 then perform recusar_campos('Motivo de 2 a 200 caracteres', 'motivo'); end if;
  v_sindico := vinculo_do_sindico();
  if v_sindico is null then perform recusar_motivo('O condomínio está sem síndico no painel', 'AUSENCIA_SEM_SINDICO'); end if;
  s := subsindico_em_dia();
  if s.id is null then
    perform recusar_motivo('Sem subsíndico com mandato em dia, a ausência não pode ser marcada', 'SEM_SUBSINDICO');
  end if;
  -- Trava as ausências do condomínio: dois pedidos ao mesmo tempo não marcam duas.
  perform 1 from ausencias_sindico where encerrada_em is null for update;
  if exists (select 1 from ausencias_sindico where encerrada_em is null and ate >= hoje_no_condominio()) then
    perform recusar_motivo('Já há uma ausência marcada: encerre antes de marcar outra', 'JA_HA_AUSENCIA');
  end if;
  -- A que já passou do fim fica encerrada; só uma fica aberta (ausencias_sindico_uma_aberta).
  update ausencias_sindico set encerrada_em = app_now(), encerrada_por = p_pessoa where encerrada_em is null;
  insert into ausencias_sindico (condominio_id, sindico_id, substituto_id, de, ate, motivo, criada_por)
  values (p_condominio, v_sindico, s.id, p_de, p_ate, v_motivo, p_pessoa) returning id, versao into v_id, v_versao;
  perform registrar_historico('ausencia.marcada', 'ausencias_sindico', v_id::text, jsonb_build_object(
    'de', p_de, 'ate', p_ate, 'sindico', v_sindico, 'substituto', s.id));
  return jsonb_build_object('id', v_id, 'links', garantir_substituto(), 'versao', (select versao from ausencias_sindico where id = v_id));
end $$;

-- Encerrar antes: o que o substituto não respondeu fica com o síndico.
create function plataforma_encerrar_ausencia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a ausencias_sindico;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'conselho.editar');
  select * into a from ausencias_sindico where id = p_id;
  if not found then raise exception 'Ausência não encontrada' using errcode = 'TC404'; end if;
  if a.encerrada_em is not null or a.ate < hoje_no_condominio() then perform recusar_motivo('Esta ausência já terminou', 'AUSENCIA_ENCERRADA'); end if;
  update ausencias_sindico set encerrada_em = app_now(), encerrada_por = p_pessoa, fim_avisado = true
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('ausencias_sindico', p_id); end if;
  if a.inicio_avisado then
    perform avisar_aprovacao((select pessoa_id from conselho_membros where id = a.substituto_id), 'AUSENCIA_FIM', null, null, a.id);
  end if;
  perform registrar_historico('ausencia.encerrada', 'ausencias_sindico', p_id::text, jsonb_build_object('de', a.de, 'ate', a.ate));
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- Decisões › Despesas (quadros 418 a 420 e 423).

create function despesa_gestao(x despesas_aprovacao, p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$ select pode(p_pessoa, x.condominio_id, 'despesas.ver') or x.pedida_por = p_pessoa $$;

create function despesa_json(x despesas_aprovacao, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', x.id, 'versao', x.versao, 'estado', x.estado, 'modo', x.modo, 'descricao', x.descricao, 'valor', x.valor, 'moeda', x.moeda,
    'fornecedor', jsonb_strip_nulls(jsonb_build_object('prestadorId', x.prestador_id,
                                                        'nome', coalesce((select nome from prestadores where id = x.prestador_id), x.fornecedor))),
    'vencimento', to_char(x.vencimento, 'YYYY-MM-DD'), 'prazo', to_char(x.prazo, 'YYYY-MM-DD'),
    'vencida', x.estado = 'AGUARDANDO' and x.prazo < hoje_no_condominio(),
    'ligacao', coalesce(
      (select jsonb_build_object('tipo', 'PEDIDO', 'id', p.id, 'rotulo', p.protocolo || ' · ' || p.assunto)
         from pedidos p where p.id = x.pedido_id and pedido_visivel(p_pessoa, p)),
      (select jsonb_build_object('tipo', 'MANUTENCAO', 'id', m.id, 'rotulo', m.titulo) from manutencoes m where m.id = x.manutencao_id),
      (select jsonb_build_object('tipo', 'DECISAO', 'id', d.id, 'rotulo', d.pergunta) from decisoes_pedido d where d.id = x.decisao_id)),
    'decisor', case when x.decisor_id is not null then jsonb_build_object('vinculoId', x.decisor_id, 'nome', nome_do_vinculo(x.decisor_id),
                                  'eu', exists (select 1 from vinculos where id = x.decisor_id and pessoa_id = p_pessoa)) end,
    'conselho', case when x.titulares is not null then
                  votacao_json(null, x.id, x.titulares, x.votos_necessarios, x.estado = 'AGUARDANDO' and x.modo = 'CONSELHO', x.prazo, p_pessoa,
                               despesa_gestao(x, p_pessoa)) end,
    'voltouAoSindicoEm', x.voltou_ao_sindico_em,
    'alcada', x.alcada, 'passaAlcada', x.alcada is not null and x.valor >= x.alcada,
    'pedidaEm', x.pedida_em, 'pedidaPor', nome_pessoa(x.pedida_por),
    'respondidaEm', x.respondida_em,
    'respondidaPor', coalesce(nome_pessoa(x.respondida_por), (select nome from conselho_membros where id = x.respondida_membro_id),
                              case when x.modo = 'CONSELHO' and x.estado in ('APROVADA', 'RECUSADA') then 'Conselho' end),
    'justificativa', x.justificativa, 'retiradaMotivo', x.retirada_motivo,
    'pagamento', case when x.paga_em is not null then jsonb_strip_nulls(jsonb_build_object(
                   'pagaEm', to_char(x.paga_em, 'YYYY-MM-DD'), 'registradaEm', x.paga_registrada_em, 'registradaPor', nome_pessoa(x.paga_registrada_por),
                   'comprovanteId', x.comprovante_id)) end,
    'anexos', (select count(*) from arquivos_aprovacao a where a.despesa_id = x.id and a.situacao = 'LIBERADO' and a.retirado_em is null),
    'substituto', (select jsonb_build_object('nome', m.nome, 'ate', to_char(a.ate, 'YYYY-MM-DD'))
                     from ausencias_sindico a join conselho_membros m on m.id = a.substituto_id
                    where x.estado = 'AGUARDANDO' and x.modo = 'PESSOA' and a.sindico_id = x.decisor_id and a.encerrada_em is null
                      and hoje_no_condominio() between a.de and a.ate),
    'links', case when x.modo = 'PESSOA' and (x.pedida_por = p_pessoa or pode(p_pessoa, x.condominio_id, 'despesas.registrar'))
                  then links_extras_json(null, x.id, x.estado = 'AGUARDANDO') end,
    'pode', jsonb_build_object(
      'responder', x.estado = 'AGUARDANDO' and x.modo = 'PESSOA'
                   and ((pode(p_pessoa, x.condominio_id, 'decisoes.aprovar')
                         and (exists (select 1 from vinculos where id = x.decisor_id and pessoa_id = p_pessoa and revogado_em is null)
                              or eh_sindico(p_pessoa)))
                        or substitui_o_sindico(p_pessoa, x.decisor_id)),
      'votar', x.estado = 'AGUARDANDO' and x.modo = 'CONSELHO' and x.prazo >= hoje_no_condominio()
               and exists (select 1 from votos_conselho v join conselho_membros m on m.id = v.membro_id
                            where v.despesa_id = x.id and m.pessoa_id = p_pessoa and membro_vota(m)),
      'alterar', x.estado = 'AGUARDANDO' and pode(p_pessoa, x.condominio_id, 'despesas.registrar')
                 and not exists (select 1 from votos_conselho v where v.despesa_id = x.id and v.escolha is not null),
      'retirar', x.estado = 'AGUARDANDO' and (x.pedida_por = p_pessoa or pode(p_pessoa, x.condominio_id, 'despesas.registrar')),
      'reenviar', x.estado = 'AGUARDANDO' and (x.pedida_por = p_pessoa or pode(p_pessoa, x.condominio_id, 'despesas.registrar')),
      'anexar', x.estado = 'AGUARDANDO' and (x.pedida_por = p_pessoa or pode(p_pessoa, x.condominio_id, 'despesas.registrar')),
      'pagar', x.estado = 'APROVADA' and x.paga_em is null and pode(p_pessoa, x.condominio_id, 'despesas.registrar'),
      'anexarComprovante', x.estado = 'APROVADA' and x.paga_em is null and pode(p_pessoa, x.condominio_id, 'despesas.registrar'),
      'desfazerPagamento', x.paga_em is not null and pode(p_pessoa, x.condominio_id, 'despesas.registrar'))))
$$;

create function exigir_despesa(p_pessoa uuid, p_id uuid) returns despesas_aprovacao
language plpgsql
set search_path = public
as $$
declare x despesas_aprovacao;
begin
  select * into x from despesas_aprovacao where id = p_id;
  if not found or not despesa_visivel(x, p_pessoa) then raise exception 'Despesa não encontrada' using errcode = 'TC404'; end if;
  return x;
end $$;

-- Filtros: Aguardando, Aprovadas, Recusadas e Todas (as retiradas só em Todas).
create function plataforma_despesas(p_pessoa uuid, p_condominio uuid, p_filtro text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_filtro text := coalesce(p_filtro, 'AGUARDANDO');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if v_filtro not in ('AGUARDANDO', 'APROVADAS', 'RECUSADAS', 'TODAS') then perform recusar_campos('Filtro desconhecido', 'filtro'); end if;
  return jsonb_build_object(
    'despesas', coalesce((
      select jsonb_agg(despesa_json(x, p_pessoa)
                       order by x.estado <> 'AGUARDANDO', case when x.estado = 'AGUARDANDO' then x.prazo end, x.respondida_em desc nulls last, x.pedida_em desc)
        from despesas_aprovacao x
       where despesa_visivel(x, p_pessoa)
         and case v_filtro when 'AGUARDANDO' then x.estado = 'AGUARDANDO' when 'APROVADAS' then x.estado = 'APROVADA'
                           when 'RECUSADAS' then x.estado = 'RECUSADA' else true end), '[]'::jsonb),
    'contagem', (select jsonb_build_object('AGUARDANDO', count(*) filter (where estado = 'AGUARDANDO'),
                                           'APROVADAS', count(*) filter (where estado = 'APROVADA'),
                                           'RECUSADAS', count(*) filter (where estado = 'RECUSADA'))
                   from despesas_aprovacao x where despesa_visivel(x, p_pessoa)),
    'aguardandoEu', (select count(*) from despesas_aprovacao x where despesa_espera(x, p_pessoa)),
    'filtro', v_filtro,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'alcada', (select conselho_alcada from configuracao_condominio),
    'pode', jsonb_build_object('registrar', pode(p_pessoa, p_condominio, 'despesas.registrar')));
end $$;

-- O que a janela Nova despesa precisa: quem aprova, o conselho, a alçada e os prestadores.
create function plataforma_despesa_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'despesas.registrar');
  return jsonb_build_object(
    'decisores', decisores_do_condominio(),
    'conselho', conselho_quorum_json(),
    'prestadores', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'servico', servico) order by lower(nome))
                               from prestadores where arquivado_em is null), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'ausencia', ausencia_json());
end $$;

-- O que é, o valor, o fornecedor e a ligação: confere e devolve os campos limpos.
create function exigir_dados_despesa(p_pessoa uuid, p_descricao text, p_valor bigint, p_prestador uuid, p_fornecedor text, p_pedido uuid,
                                     p_manutencao uuid, p_decisao uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if length(btrim(coalesce(p_descricao, ''))) not between 3 and 200 then perform recusar_campos('Diga o que é (3 a 200 caracteres)', 'descricao'); end if;
  if p_valor is null or p_valor <= 0 then perform recusar_campos('O valor, em reais, maior que zero', 'valor'); end if;
  if p_prestador is not null and nullif(btrim(coalesce(p_fornecedor, '')), '') is not null then
    perform recusar_campos('Escolha o prestador ou escreva o nome, não os dois', 'fornecedor');
  end if;
  if p_prestador is not null and not exists (select 1 from prestadores where id = p_prestador and arquivado_em is null) then
    perform recusar_campos('Escolha um prestador cadastrado', 'prestadorId');
  end if;
  if p_prestador is null and length(btrim(coalesce(p_fornecedor, ''))) not between 2 and 120 then
    perform recusar_campos('Diga o fornecedor (2 a 120 caracteres)', 'fornecedor');
  end if;
  if num_nonnulls(p_pedido, p_manutencao, p_decisao) > 1 then perform recusar_campos('Ligue a uma coisa só', 'ligacao'); end if;
  if p_pedido is not null then perform exigir_pedido(p_pessoa, p_pedido); end if;
  if p_manutencao is not null and not (pode(p_pessoa, contexto_condominio(), 'manutencao.ver')
                                       and exists (select 1 from manutencoes where id = p_manutencao)) then
    perform recusar_campos('Manutenção não encontrada', 'manutencaoId');
  end if;
  if p_decisao is not null and not exists (select 1 from decisoes_pedido d where d.id = p_decisao and decisao_visivel(d, p_pessoa)) then
    perform recusar_campos('Decisão não encontrada', 'decisaoId');
  end if;
end $$;

create function plataforma_criar_despesa(p_pessoa uuid, p_condominio uuid, p_descricao text, p_valor bigint, p_prestador uuid, p_fornecedor text,
                                         p_vencimento date, p_pedido uuid, p_manutencao uuid, p_decisao uuid, p_modo text, p_decisor uuid,
                                         p_prazo date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_versao integer;
  v_decisor_pessoa uuid;
  v_alcada bigint := (select conselho_alcada from configuracao_condominio);
  v_links jsonb := '[]'::jsonb;
  v_titulares integer;
  v_necessarios integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'despesas.registrar');
  perform exigir_dados_despesa(p_pessoa, p_descricao, p_valor, p_prestador, p_fornecedor, p_pedido, p_manutencao, p_decisao);
  if p_prazo is null or p_prazo < hoje_no_condominio() or p_prazo > hoje_no_condominio() + 90 then
    perform recusar_campos('O prazo vai de hoje a 90 dias', 'prazo');
  end if;
  if p_modo is null or p_modo not in ('PESSOA', 'CONSELHO') then perform recusar_campos('Escolha quem aprova', 'modo'); end if;
  if p_modo = 'PESSOA' then
    select pessoa_id into v_decisor_pessoa from vinculos where id = p_decisor and revogado_em is null;
    if v_decisor_pessoa is null or not pode(v_decisor_pessoa, p_condominio, 'decisoes.aprovar') then
      perform recusar_campos('Escolha quem aprova: o síndico ou quem tem a permissão Aprovar', 'decisorId');
    end if;
  else
    if p_decisor is not null then perform recusar_campos('Pedida ao conselho, não há uma pessoa que aprova', 'decisorId'); end if;
    select titulares, necessarios into v_titulares, v_necessarios from exigir_quorum();
  end if;
  perform definir_transicao('PEDIDA');
  insert into despesas_aprovacao (condominio_id, descricao, valor, prestador_id, fornecedor, vencimento, pedido_id, manutencao_id, decisao_id,
                                  modo, decisor_id, titulares, votos_necessarios, prazo, alcada, estado, pedida_por)
  values (p_condominio, btrim(p_descricao), p_valor, p_prestador, case when p_prestador is null then btrim(p_fornecedor) end, p_vencimento,
          p_pedido, p_manutencao, p_decisao, p_modo, case when p_modo = 'PESSOA' then p_decisor end, v_titulares, v_necessarios, p_prazo,
          v_alcada, 'AGUARDANDO', p_pessoa)
  returning id, versao into v_id, v_versao;
  perform registrar_historico('despesa.pedida', 'despesas_aprovacao', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'modo', p_modo, 'decisor', case when p_modo = 'PESSOA' then p_decisor end, 'titulares', v_titulares, 'necessarios', v_necessarios,
    'prazo', p_prazo, 'valor', p_valor, 'passaAlcada', v_alcada is not null and p_valor >= v_alcada)));
  if p_modo = 'PESSOA' then
    perform avisar_aprovacao(v_decisor_pessoa, 'DESPESA_PEDIDA', v_id, null, null);
    v_links := garantir_substituto();
  else
    v_links := abrir_votacao(null, v_id, p_pessoa);
  end if;
  return jsonb_strip_nulls(jsonb_build_object('id', v_id, 'versao', v_versao, 'alcada', v_alcada,
                                              'passaAlcada', v_alcada is not null and p_valor >= v_alcada, 'links', v_links));
end $$;

-- Mudar o que é, enquanto ninguém votou nem respondeu. Quem aprova e o prazo não mudam.
create function plataforma_alterar_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_descricao text, p_valor bigint,
                                           p_prestador uuid, p_fornecedor text, p_vencimento date, p_pedido uuid, p_manutencao uuid, p_decisao uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  x despesas_aprovacao;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'despesas.registrar');
  x := exigir_despesa(p_pessoa, p_id);
  if x.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta despesa já foi respondida ou retirada', 'DESPESA_FECHADA'); end if;
  if exists (select 1 from votos_conselho where despesa_id = x.id and escolha is not null) then
    perform recusar_motivo('Já há voto nesta despesa: retire e peça de novo', 'DESPESA_COM_VOTO');
  end if;
  perform exigir_dados_despesa(p_pessoa, p_descricao, p_valor, p_prestador, p_fornecedor, p_pedido, p_manutencao, p_decisao);
  update despesas_aprovacao
     set descricao = btrim(p_descricao), valor = p_valor, prestador_id = p_prestador,
         fornecedor = case when p_prestador is null then btrim(p_fornecedor) end, vencimento = p_vencimento,
         pedido_id = p_pedido, manutencao_id = p_manutencao, decisao_id = p_decisao
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('despesas_aprovacao', p_id); end if;
  perform registrar_historico('despesa.alterada', 'despesas_aprovacao', p_id::text, jsonb_strip_nulls(jsonb_build_object(
    'valorAntes', case when x.valor <> p_valor then x.valor end, 'valor', case when x.valor <> p_valor then p_valor end)));
  return v_versao;
end $$;

-- Responder no modo pessoa (regra 7): quem decide, o síndico ou o substituto, com justificativa.
create function plataforma_responder_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_aprovar boolean,
                                             p_justificativa text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare x despesas_aprovacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  x := exigir_despesa(p_pessoa, p_id);
  perform 1 from despesas_aprovacao where id = p_id for update;
  if x.modo = 'CONSELHO' and x.estado = 'AGUARDANDO' then perform recusar_motivo('Pedida ao conselho: cada titular vota', 'DESPESA_DO_CONSELHO'); end if;
  if pode(p_pessoa, p_condominio, 'decisoes.aprovar')
     and (exists (select 1 from vinculos where id = x.decisor_id and pessoa_id = p_pessoa and revogado_em is null) or eh_sindico(p_pessoa)) then
    return jsonb_build_object('versao', responder_despesa_pessoa(x, p_pessoa, null, p_versao, p_aprovar, p_justificativa));
  end if;
  if substitui_o_sindico(p_pessoa, x.decisor_id) then
    return jsonb_build_object('versao', responder_despesa_pessoa(x, p_pessoa, (membro_do_conselho(p_pessoa)).id, p_versao, p_aprovar, p_justificativa));
  end if;
  raise exception 'Só quem foi escolhido para aprovar, ou o síndico, responde' using errcode = 'TC401';
end $$;

create function plataforma_votar_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_escolha text, p_justificativa text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m conselho_membros;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  m := membro_do_conselho(p_pessoa);
  if m.id is null then raise exception 'Só quem é do conselho vota' using errcode = 'TC401'; end if;
  return registrar_voto(m, null, p_id, p_escolha, p_justificativa, 'PAINEL', p_pessoa);
end $$;

create function plataforma_retirar_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x despesas_aprovacao;
  v_motivo text;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  x := exigir_despesa(p_pessoa, p_id);
  if not (x.pedida_por = p_pessoa or pode(p_pessoa, p_condominio, 'despesas.registrar')) then
    raise exception 'Sem permissão para retirar esta despesa' using errcode = 'TC401';
  end if;
  if x.estado <> 'AGUARDANDO' then perform recusar_motivo('Esta despesa já foi respondida ou retirada', 'DESPESA_FECHADA'); end if;
  v_motivo := exigir_motivo(p_motivo);
  perform definir_transicao('RETIRADA', v_motivo);
  update despesas_aprovacao set estado = 'RETIRADA', respondida_em = app_now(), respondida_por = p_pessoa, retirada_motivo = v_motivo
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('despesas_aprovacao', p_id); end if;
  update envios_email set estado = 'CANCELADO', motivo = 'A despesa foi retirada'
   where estado = 'NA_FILA' and link_conselho_id in (select id from links_conselho where despesa_id = p_id);
  perform registrar_historico('despesa.retirada', 'despesas_aprovacao', p_id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('versao', v_versao);
end $$;

-- Paga fora do sistema (regra 7): só o registro, com a data e o comprovante opcional.
create function plataforma_pagar_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_paga_em date, p_comprovante uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x despesas_aprovacao;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'despesas.registrar');
  x := exigir_despesa(p_pessoa, p_id);
  if x.estado <> 'APROVADA' then perform recusar_motivo('Só a despesa aprovada se marca como paga', 'DESPESA_NAO_APROVADA'); end if;
  if x.paga_em is not null then perform recusar_motivo('Já está marcada como paga', 'JA_PAGA'); end if;
  if p_paga_em is null or p_paga_em > hoje_no_condominio() then perform recusar_campos('Diga quando foi pago (até hoje)', 'pagaEm'); end if;
  if p_comprovante is not null and not exists (select 1 from arquivos_aprovacao where id = p_comprovante and despesa_id = x.id
                                                  and parte = 'COMPROVANTE' and situacao = 'LIBERADO' and retirado_em is null) then
    perform recusar_campos('Envie o comprovante antes', 'comprovanteId');
  end if;
  update despesas_aprovacao set paga_em = p_paga_em, paga_registrada_em = app_now(), paga_registrada_por = p_pessoa, comprovante_id = p_comprovante
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('despesas_aprovacao', p_id); end if;
  perform registrar_historico('despesa.paga_fora', 'despesas_aprovacao', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('pagaEm', p_paga_em, 'comprovante', p_comprovante)));
  return jsonb_build_object('versao', v_versao);
end $$;

create function plataforma_desfazer_pagamento(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x despesas_aprovacao;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'despesas.registrar');
  x := exigir_despesa(p_pessoa, p_id);
  if x.paga_em is null then perform recusar_motivo('A despesa não está marcada como paga', 'NAO_PAGA'); end if;
  update despesas_aprovacao set paga_em = null, paga_registrada_em = null, paga_registrada_por = null, comprovante_id = null
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('despesas_aprovacao', p_id); end if;
  perform registrar_historico('despesa.pagamento_desfeito', 'despesas_aprovacao', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('pagaEm', x.paga_em, 'comprovante', x.comprovante_id)));
  return jsonb_build_object('versao', v_versao);
end $$;

-- A ficha (quadro 420): a despesa, os anexos, o histórico e o texto pronto para publicar como
-- comunicado (abre como rascunho; o morador só vê se o síndico publicar).
create function plataforma_despesa(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare x despesas_aprovacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  x := exigir_despesa(p_pessoa, p_id);
  return despesa_json(x, p_pessoa) || jsonb_strip_nulls(jsonb_build_object(
    'anexos', anexos_aprovacao_json('{}'::uuid[], x.id, despesa_gestao(x, p_pessoa)),
    'historico', case when despesa_gestao(x, p_pessoa) then coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('em', h.ocorrido_em, 'acao', h.acao, 'quem', nome_pessoa(h.autor_id),
                                                            'membro', (select nome from conselho_membros where id = (h.dados ->> 'membro')::uuid),
                                                            'dados', h.dados))
                       order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'despesas_aprovacao' and h.entidade_id = x.id::text), '[]'::jsonb) end,
    'comunicado', case when x.estado in ('APROVADA', 'RECUSADA') and despesa_gestao(x, p_pessoa) then jsonb_build_object(
      'titulo', left(case when x.estado = 'APROVADA' then 'Despesa aprovada: ' else 'Despesa recusada: ' end || x.descricao, 120),
      'texto', x.descricao || ', de ' || reais(x.valor) || ', com ' || coalesce((select nome from prestadores where id = x.prestador_id), x.fornecedor)
               || case when x.estado = 'APROVADA' then ', foi aprovada' else ', foi recusada' end
               || ' em ' || data_br(data_no_condominio(x.respondida_em))
               || coalesce(' (' || x.justificativa || ')', '') || '.') end));
end $$;

-- ---------------------------------------------------------------------------------------
-- Anexos da decisão e da despesa (orçamentos, nota, comprovante). Mesmo caminho dos arquivos
-- do pedido: a API gera o link de envio no bucket privado "pedidos", verifica o arquivo e
-- devolve o resultado; abrir gera o link de 5 minutos. Até 10 por item.

-- A decisão vista pela pessoa: a própria ou a que voltou ao síndico a partir dela.
create function decisao_vista(p_pessoa uuid, p_id uuid) returns decisoes_pedido
language plpgsql stable
set search_path = public
as $$
declare d decisoes_pedido;
begin
  select * into d from decisoes_pedido where id = p_id;
  if not found or not (decisao_visivel(d, p_pessoa)
                       or exists (select 1 from decisoes_pedido n where n.origem_id = d.id and decisao_visivel(n, p_pessoa))) then
    raise exception 'Decisão não encontrada' using errcode = 'TC404';
  end if;
  return d;
end $$;

-- Quem junta anexo: na decisão aguardando, quem pediu ou quem atualiza o pedido; na despesa
-- aguardando, quem pediu ou quem registra despesas; o comprovante, na despesa aprovada, quem
-- registra despesas.
create function pode_anexar_aprovacao(p_pessoa uuid, p_decisao uuid, p_despesa uuid, p_parte text) returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  d decisoes_pedido;
  x despesas_aprovacao;
begin
  if p_decisao is not null then
    d := decisao_vista(p_pessoa, p_decisao);
    return p_parte = 'DOCUMENTO' and coalesce((decisao_json(d, p_pessoa) -> 'pode' ->> 'anexar')::boolean, false);
  end if;
  x := exigir_despesa(p_pessoa, p_despesa);
  if p_parte = 'COMPROVANTE' then
    return x.estado = 'APROVADA' and pode(p_pessoa, x.condominio_id, 'despesas.registrar');
  end if;
  return p_parte = 'DOCUMENTO' and x.estado = 'AGUARDANDO'
     and (x.pedida_por = p_pessoa or pode(p_pessoa, x.condominio_id, 'despesas.registrar'));
end $$;

-- O anexo, de item que a pessoa vê.
create function exigir_anexo_aprovacao(p_pessoa uuid, p_arquivo uuid) returns arquivos_aprovacao
language plpgsql stable
set search_path = public
as $$
declare a arquivos_aprovacao;
begin
  select * into a from arquivos_aprovacao where id = p_arquivo and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.decisao_id is not null then perform decisao_vista(p_pessoa, a.decisao_id); else perform exigir_despesa(p_pessoa, a.despesa_id); end if;
  return a;
end $$;

create function plataforma_iniciar_anexo_aprovacao(p_pessoa uuid, p_condominio uuid, p_decisao uuid, p_despesa uuid, p_parte text,
                                                   p_nome text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_parte text := coalesce(p_parte, 'DOCUMENTO');
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if (p_decisao is null) = (p_despesa is null) then perform recusar_campos('Diga de que decisão ou despesa é o anexo', 'item'); end if;
  if v_parte not in ('DOCUMENTO', 'COMPROVANTE') or (v_parte = 'COMPROVANTE' and p_despesa is null) then
    perform recusar_campos('Diga se é documento ou comprovante', 'parte');
  end if;
  if not pode_anexar_aprovacao(p_pessoa, p_decisao, p_despesa, v_parte) then
    raise exception 'Sem permissão para juntar anexo aqui' using errcode = 'TC401';
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then
    perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome');
  end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP) e PDF', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  -- Trava o item para contar sem corrida com outro envio.
  if p_decisao is not null then
    perform 1 from decisoes_pedido where id = p_decisao for update;
  else
    perform 1 from despesas_aprovacao where id = p_despesa for update;
  end if;
  if (select count(*) from arquivos_aprovacao where (decisao_id = p_decisao or despesa_id = p_despesa) and retirado_em is null) >= 10 then
    perform recusar_motivo('Já há 10 anexos', 'LIMITE_ARQUIVOS');
  end if;
  v_caminho := p_condominio || '/aprovacoes/' || coalesce(p_decisao, p_despesa) || '/' || v_id;
  insert into arquivos_aprovacao (id, condominio_id, decisao_id, despesa_id, parte, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, p_decisao, p_despesa, v_parte, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

create function plataforma_anexo_aprovacao_a_verificar(p_pessoa uuid, p_condominio uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_aprovacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  a := exigir_anexo_aprovacao(p_pessoa, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

create function plataforma_verificar_anexo_aprovacao(p_pessoa uuid, p_condominio uuid, p_arquivo uuid, p_liberado boolean, p_tamanho integer,
                                                     p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_aprovacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  a := exigir_anexo_aprovacao(p_pessoa, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_aprovacao set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
  else
    update arquivos_aprovacao set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
  end if;
  perform registrar_historico(case when p_liberado then 'aprovacao.anexo_enviado' else 'aprovacao.anexo_recusado' end,
    case when a.decisao_id is not null then 'decisoes_pedido' else 'despesas_aprovacao' end, coalesce(a.decisao_id, a.despesa_id)::text,
    jsonb_strip_nulls(jsonb_build_object('arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte,
                                         'motivo', case when not p_liberado then btrim(p_motivo) end)));
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_abrir_anexo_aprovacao(p_pessoa uuid, p_condominio uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a arquivos_aprovacao;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  a := exigir_anexo_aprovacao(p_pessoa, p_arquivo);
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Tirar: quem enviou ou quem junta anexo no item; o comprovante usado no pagamento não sai.
create function plataforma_tirar_anexo_aprovacao(p_pessoa uuid, p_condominio uuid, p_arquivo uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a arquivos_aprovacao;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  a := exigir_anexo_aprovacao(p_pessoa, p_arquivo);
  if not pode_anexar_aprovacao(p_pessoa, a.decisao_id, a.despesa_id, a.parte) then
    raise exception 'Sem permissão para tirar este anexo' using errcode = 'TC401';
  end if;
  if exists (select 1 from despesas_aprovacao where comprovante_id = a.id) then
    perform recusar_motivo('É o comprovante do pagamento: desfaça o pagamento antes', 'COMPROVANTE_EM_USO');
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_aprovacao set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  perform registrar_historico('aprovacao.anexo_tirado', case when a.decisao_id is not null then 'decisoes_pedido' else 'despesas_aprovacao' end,
    coalesce(a.decisao_id, a.despesa_id)::text, jsonb_build_object('arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- O link do conselheiro (/conselho/<código>, quadros 415 e 416). Sem conta: o código entra no
-- condomínio como sistema. O código trocado responde que o link parou; o resto do que a página
-- mostra sai de conselho_publico_json.

create function exigir_link_conselho(c codigos_sem_conta) returns links_conselho
language plpgsql
set search_path = public
as $$
declare l links_conselho;
begin
  select * into l from links_conselho where id = c.alvo_id;
  if l.id is null then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  return l;
end $$;

-- O estado da página: VOTAR, VOTADO (pode trocar até o prazo), RESPONDER (o substituto),
-- AGUARDANDO (o aviso da vencida, só para ver), FECHADA (com o resultado), PRAZO_ACABOU,
-- NAO_VALE (com o motivo: SAIU_DO_CONSELHO, LINK_TROCADO, MANDATO_VENCIDO, SUPLENTE_NAO_VOTA,
-- AUSENCIA_ACABOU) e LINK_VENCIDO (fechada ou com o prazo acabado há mais de 7 dias). O link que
-- não vale e o vencido não mostram nada do item.
create function conselho_publico_json(l links_conselho, p_trocado boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  m conselho_membros;
  d decisoes_pedido;
  x despesas_aprovacao;
  v votos_conselho;
  v_estado_item text;
  v_modo text;
  v_prazo date;
  v_estado text;
  v_motivo text;
  v_item jsonb;
  v_fechada boolean;
begin
  select * into m from conselho_membros where id = l.membro_id;
  if l.decisao_id is not null then
    select * into d from decisoes_pedido where id = l.decisao_id;
    v_estado_item := d.estado; v_modo := d.modo; v_prazo := d.prazo;
  else
    select * into x from despesas_aprovacao where id = l.despesa_id;
    v_estado_item := x.estado; v_modo := x.modo; v_prazo := x.prazo;
  end if;
  select * into v from votos_conselho where membro_id = m.id and (decisao_id = l.decisao_id or despesa_id = l.despesa_id);
  v_fechada := v_estado_item <> 'AGUARDANDO' or (l.finalidade = 'VOTO' and v_modo <> 'CONSELHO')
               or (l.finalidade in ('SUBSTITUTO', 'AVISO') and v_modo <> 'PESSOA');
  if m.retirado_em is not null then
    v_estado := 'NAO_VALE'; v_motivo := 'SAIU_DO_CONSELHO';
  elsif p_trocado then
    v_estado := 'NAO_VALE'; v_motivo := 'LINK_TROCADO';
  elsif v_fechada then
    v_estado := 'FECHADA';
  elsif not membro_em_dia(m) then
    v_estado := 'NAO_VALE'; v_motivo := 'MANDATO_VENCIDO';
  elsif l.finalidade = 'VOTO' and not membro_titular(m) then
    v_estado := 'NAO_VALE'; v_motivo := 'SUPLENTE_NAO_VOTA';
  elsif l.finalidade = 'SUBSTITUTO' then
    if substituto_vale(l) then v_estado := 'RESPONDER'; else v_estado := 'NAO_VALE'; v_motivo := 'AUSENCIA_ACABOU'; end if;
  elsif l.finalidade = 'AVISO' then
    v_estado := 'AGUARDANDO';
  elsif v_prazo < hoje_no_condominio() then
    v_estado := 'PRAZO_ACABOU';
  elsif v.escolha is not null then
    v_estado := 'VOTADO';
  else
    v_estado := 'VOTAR';
  end if;
  -- O resultado fica à vista até 7 dias depois do prazo; depois, o link venceu.
  if v_estado in ('FECHADA', 'PRAZO_ACABOU') and hoje_no_condominio() > v_prazo + 7 then v_estado := 'LINK_VENCIDO'; end if;
  if v_estado in ('NAO_VALE', 'LINK_VENCIDO') then
    -- O link que não vale não mostra mais nada do item.
    return jsonb_strip_nulls(jsonb_build_object('condominio', nome_do_condominio(), 'estado', v_estado, 'motivo', v_motivo, 'membro', m.nome));
  end if;
  if l.decisao_id is not null then
    v_item := jsonb_strip_nulls(jsonb_build_object(
      'tipo', 'DECISAO', 'pergunta', d.pergunta, 'porque', d.porque,
      'alternativas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', a.numero, 'descricao', a.descricao,
                                                                                      'detalhe', a.detalhe, 'custo', a.custo, 'moeda', a.moeda))
                                                 order by a.numero)
                                  from alternativas_decisao a where a.decisao_id = d.id), '[]'::jsonb),
      'pedidaPor', nome_pessoa(d.pedida_por), 'pedidaEm', d.pedida_em,
      'anexos', anexos_aprovacao_json(array_remove(array[d.id, d.origem_id], null), null, false),
      'resultado', case when v_fechada then jsonb_strip_nulls(jsonb_build_object(
                     'estado', d.estado, 'alternativaAprovada', d.alternativa_aprovada, 'justificativa', d.justificativa,
                     'voltouAoSindico', d.estado = 'DEVOLVIDA' and exists (select 1 from decisoes_pedido n where n.origem_id = d.id))) end));
  else
    v_item := jsonb_strip_nulls(jsonb_build_object(
      'tipo', 'DESPESA', 'descricao', x.descricao, 'valor', x.valor, 'moeda', x.moeda,
      'fornecedor', coalesce((select nome from prestadores where id = x.prestador_id), x.fornecedor),
      'vencimento', to_char(x.vencimento, 'YYYY-MM-DD'),
      'pedidaPor', nome_pessoa(x.pedida_por), 'pedidaEm', x.pedida_em,
      'anexos', anexos_aprovacao_json('{}'::uuid[], x.id, false),
      'resultado', case when v_fechada then jsonb_strip_nulls(jsonb_build_object(
                     'estado', x.estado, 'justificativa', x.justificativa,
                     'voltouAoSindico', x.voltou_ao_sindico_em is not null)) end));
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'condominio', nome_do_condominio(), 'estado', v_estado, 'motivo', v_motivo, 'finalidade', l.finalidade,
    'membro', jsonb_build_object('nome', m.nome, 'papel', m.papel),
    'prazo', to_char(v_prazo, 'YYYY-MM-DD'), 'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'item', v_item,
    'meuVoto', case when v.escolha is not null then jsonb_strip_nulls(jsonb_build_object('escolha', v.escolha, 'justificativa', v.justificativa,
                                                                                         'votadoEm', v.votado_em)) end,
    -- Os votos dos outros só depois de fechar (regra 4).
    'conselho', case when l.finalidade = 'VOTO' then
                  case when l.decisao_id is not null
                       then votacao_json(d.id, null, d.titulares, d.votos_necessarios, not v_fechada, d.prazo, null, false)
                       else votacao_json(null, x.id, x.titulares, x.votos_necessarios, not v_fechada, x.prazo, null, false) end end));
end $$;

create function publico_conselho(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_conselho;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'CONSELHO');
  l := exigir_link_conselho(c);
  if c.revogado_em is null and l.revogado_em is null and l.aberto_em is null then
    update links_conselho set aberto_em = app_now() where id = l.id returning * into l;
  end if;
  return conselho_publico_json(l, c.revogado_em is not null or l.revogado_em is not null);
end $$;

-- O voto pelo link (quadro 415).
create function publico_votar_conselho(p_codigo text, p_escolha text, p_justificativa text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_conselho;
  m conselho_membros;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'CONSELHO');
  l := exigir_link_conselho(c);
  m := exigir_membro(l.membro_id);
  if m.retirado_em is not null then perform recusar_motivo('Você não é mais do conselho', 'SAIU_DO_CONSELHO'); end if;
  if c.revogado_em is not null or l.revogado_em is not null then perform recusar_motivo('Este link foi trocado por um novo', 'LINK_TROCADO'); end if;
  if l.finalidade <> 'VOTO' then perform recusar_motivo('Este link não é de voto', 'NAO_VOTA'); end if;
  perform registrar_voto(m, l.decisao_id, l.despesa_id, p_escolha, p_justificativa, 'LINK', null);
  return conselho_publico_json(l, false);
end $$;

-- A resposta do substituto pelo link (quadro 416): uma alternativa ou devolver na decisão,
-- aprovar ou recusar na despesa, sempre com justificativa.
create function publico_responder_conselho(p_codigo text, p_aprovar boolean, p_alternativa integer, p_justificativa text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_conselho;
  d decisoes_pedido;
  x despesas_aprovacao;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'CONSELHO');
  l := exigir_link_conselho(c);
  if (exigir_membro(l.membro_id)).retirado_em is not null then perform recusar_motivo('Você não é mais do conselho', 'SAIU_DO_CONSELHO'); end if;
  if c.revogado_em is not null or l.revogado_em is not null then perform recusar_motivo('Este link foi trocado por um novo', 'LINK_TROCADO'); end if;
  if l.finalidade <> 'SUBSTITUTO' then perform recusar_motivo('Este link não é para responder no lugar do síndico', 'NAO_RESPONDE'); end if;
  if not membro_em_dia(exigir_membro(l.membro_id)) then perform recusar_motivo('O mandato não está em dia', 'MANDATO_VENCIDO'); end if;
  if not substituto_vale(l) then perform recusar_motivo('A ausência do síndico acabou: ele responde', 'AUSENCIA_ACABOU'); end if;
  if l.decisao_id is not null then
    select * into d from decisoes_pedido where id = l.decisao_id for update;
    perform responder_decisao_substituto(d, null, l.membro_id, null, p_aprovar, p_alternativa, p_justificativa);
  else
    select * into x from despesas_aprovacao where id = l.despesa_id for update;
    perform responder_despesa_pessoa(x, null, l.membro_id, null, p_aprovar, p_justificativa);
  end if;
  return conselho_publico_json(l, false);
end $$;

create function publico_conselho_anexo(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c codigos_sem_conta;
  l links_conselho;
  a arquivos_aprovacao;
begin
  c := entrar_por_codigo(btrim(coalesce(p_codigo, '')), 'CONSELHO');
  l := exigir_link_conselho(c);
  if conselho_publico_json(l, c.revogado_em is not null or l.revogado_em is not null) ->> 'estado'
     not in ('VOTAR', 'VOTADO', 'RESPONDER', 'AGUARDANDO') then
    raise exception 'Arquivo não encontrado' using errcode = 'TC404';
  end if;
  select * into a from arquivos_aprovacao
   where id = p_arquivo and situacao = 'LIBERADO' and retirado_em is null
     and (despesa_id = l.despesa_id
          or decisao_id = l.decisao_id
          or decisao_id = (select origem_id from decisoes_pedido where id = l.decisao_id));
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- ---------------------------------------------------------------------------------------
-- E-mail do link do conselheiro: o código nasce na hora de montar (o anterior para). Não depende
-- do "Enviar por e-mail" das Configurações, que é o dos comunicados aos moradores.

alter function montar_email(envios_email) rename to montar_email_r5;
alter function montar_email_r5(envios_email) security invoker;
create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  l links_conselho;
  m conselho_membros;
  d decisoes_pedido;
  x despesas_aprovacao;
  v_cancelar text;
begin
  if e.tipo <> 'CONSELHO' then return montar_email_r5(e); end if;
  select * into l from links_conselho where id = e.link_conselho_id;
  select * into m from conselho_membros where id = l.membro_id;
  select * into d from decisoes_pedido where id = l.decisao_id;
  select * into x from despesas_aprovacao where id = l.despesa_id;
  v_cancelar := case
    when not membro_em_dia(m) then 'O membro saiu do conselho ou o mandato venceu'
    when l.finalidade = 'VOTO' and not membro_titular(m) then 'O membro passou a suplente'
    when m.canal <> 'EMAIL' or lower(coalesce(m.email, '')) <> lower(e.para) then 'O contato do membro mudou'
    when coalesce(d.estado, x.estado) <> 'AGUARDANDO' then 'Já foi respondida ou retirada'
    when l.finalidade = 'VOTO' and coalesce(d.modo, x.modo) <> 'CONSELHO' then 'A votação fechou'
    when l.finalidade = 'SUBSTITUTO' and not substituto_vale(l) then 'A ausência do síndico acabou' end;
  if v_cancelar is not null then
    update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
    return null;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', (select email_responder_para from configuracao_condominio), 'nome', nome_curto(m.nome),
    'codigos', jsonb_build_object('abrir', novo_codigo_conselho(l, false, e.id)),
    'conselho', jsonb_strip_nulls(jsonb_build_object(
      'finalidade', l.finalidade, 'item', case when d.id is not null then 'DECISAO' else 'DESPESA' end,
      'titulo', coalesce(d.pergunta, x.descricao), 'valor', case when x.id is not null then reais(x.valor) end,
      'prazo', data_br(coalesce(d.prazo, x.prazo)), 'papel', nome_do_papel(m.papel),
      'pedidaPor', nome_pessoa(coalesce(d.pedida_por, x.pedida_por))))));
end $$;

-- ---------------------------------------------------------------------------------------
-- Sino: os avisos novos das decisões e os das despesas, do mandato e da ausência.

alter function plataforma_avisos(uuid, uuid) rename to avisos_f303;
alter function avisos_f303(uuid, uuid) security invoker;
create function plataforma_avisos(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := avisos_f303(p_pessoa, p_condominio);
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(y.item order by (y.item ->> 'vistoEm') is not null, (y.item ->> 'criadoEm')::timestamptz desc)
        from (select item from jsonb_array_elements(v -> 'itens') item
              union all
              select jsonb_strip_nulls(jsonb_build_object(
                       'id', a.id, 'tipo', a.tipo, 'despesaId', x.id, 'membroId', m.id, 'ausenciaId', u.id,
                       'titulo', coalesce(x.descricao, m.nome, (select nome from conselho_membros where id = u.substituto_id)),
                       'valor', x.valor, 'prazo', to_char(coalesce(x.prazo, m.mandato_fim, u.ate), 'YYYY-MM-DD'), 'estado', x.estado,
                       'criadoEm', a.criado_em, 'vistoEm', a.visto_em))
                from avisos_aprovacao a
                left join despesas_aprovacao x on x.id = a.despesa_id
                left join conselho_membros m on m.id = a.membro_id
                left join ausencias_sindico u on u.id = a.ausencia_id
               where a.pessoa_id = p_pessoa and a.criado_em >= app_now() - interval '30 days') y), '[]'::jsonb),
    'naoVistos', (v ->> 'naoVistos')::integer + (select count(*) from avisos_aprovacao where pessoa_id = p_pessoa and visto_em is null));
end $$;

alter function plataforma_marcar_avisos(uuid, uuid, uuid[]) rename to marcar_avisos_f303;
alter function marcar_avisos_f303(uuid, uuid, uuid[]) security invoker;
create function plataforma_marcar_avisos(p_pessoa uuid, p_condominio uuid, p_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_r integer;
begin
  v_n := marcar_avisos_f303(p_pessoa, p_condominio, p_ids);
  update avisos_aprovacao set visto_em = app_now()
   where pessoa_id = p_pessoa and visto_em is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_r = row_count;
  return v_n + v_r;
end $$;

-- ---------------------------------------------------------------------------------------
-- Relatório do mês (TR-02): em "Decisões do mês", as despesas e o que o conselho decidiu.

create or replace function relatorio_decisoes(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
  v jsonb := decisoes_no_periodo(p_de, p_ate);
begin
  return jsonb_build_object(
    'pedidas', (select count(*) from decisoes_pedido where pedida_em >= v_ini and pedida_em < v_fim),
    'decididas', v -> 'decididas', 'aprovadas', v -> 'aprovadas', 'devolvidas', v -> 'devolvidas',
    'medianaHoras', v -> 'medianaHoras',
    'aguardandoNoFim', (select count(*) from decisoes_pedido where pedida_em < v_fim and (respondida_em is null or respondida_em >= v_fim)),
    'peloConselho', (select count(*) from decisoes_pedido
                      where modo = 'CONSELHO' and estado in ('APROVADA', 'DEVOLVIDA') and respondida_em >= v_ini and respondida_em < v_fim)
                  + (select count(*) from despesas_aprovacao
                      where modo = 'CONSELHO' and estado in ('APROVADA', 'RECUSADA') and respondida_em >= v_ini and respondida_em < v_fim),
    'despesas', (select jsonb_build_object(
                   'pedidas', count(*) filter (where pedida_em >= v_ini and pedida_em < v_fim),
                   'aprovadas', count(*) filter (where estado = 'APROVADA' and respondida_em >= v_ini and respondida_em < v_fim),
                   'recusadas', count(*) filter (where estado = 'RECUSADA' and respondida_em >= v_ini and respondida_em < v_fim),
                   'valorAprovado', coalesce(sum(valor) filter (where estado = 'APROVADA' and respondida_em >= v_ini and respondida_em < v_fim), 0),
                   'aguardandoNoFim', count(*) filter (where pedida_em < v_fim and (respondida_em is null or respondida_em >= v_fim)))
                   from despesas_aprovacao));
end $$;

-- ---------------------------------------------------------------------------------------
-- Memória do prédio: a despesa decidida entra na linha do tempo, para quem cuida das despesas.

alter function eventos_memoria(uuid) rename to eventos_memoria_r5;

create function eventos_memoria(p_pessoa uuid) returns table (data date, momento timestamptz, categoria text, evento jsonb)
language plpgsql stable
set search_path = public
as $$
begin
  return query select * from eventos_memoria_r5(p_pessoa);
  if pode(p_pessoa, contexto_condominio(), 'despesas.ver') then
    return query
      select data_no_condominio(x.respondida_em), x.respondida_em, 'DOCUMENTOS'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'fonte', 'DESPESA', 'id', x.id,
               'titulo', case when x.estado = 'APROVADA' then 'Despesa aprovada: ' else 'Despesa recusada: ' end || x.descricao,
               'detalhe', reais(x.valor) || ' · ' || coalesce((select nome from prestadores where id = x.prestador_id), x.fornecedor)
                          || case when x.modo = 'CONSELHO' then ' · pelo conselho'
                                  else ' · por ' || coalesce(nome_pessoa(x.respondida_por), (select nome from conselho_membros where id = x.respondida_membro_id), '') end))
        from despesas_aprovacao x where x.estado in ('APROVADA', 'RECUSADA');
  end if;
end $$;

call fechar_acesso();

-- 0304 · Propostas do Comercial (R17.3; IDEIAS CM-06, CM-07, CM-19, CM-20, CM-27, CM-28 e o
-- resto de CM-11, CM-12 e CM-16; desenho dos quadros 325 a 329, 337 e 344 aprovado pela
-- Carolina em 24/10/2026; plano em comercial/r17-3/plano-0304.md).
--
-- Decisões (Carolina, 24/10/2026):
-- H.1  O preço sai da Tabela de preços (0295), com as mesmas regras de console_sugestao_plano:
--      fundador só no mensal e com vaga livre; anual = meses pagos × cheia, implantação isenta;
--      acima de 400 unidades, sob consulta (valor digitado com motivo). Não há outro cálculo.
--      A vaga de fundador só é ocupada quando o interessado virar cliente (R17.4).
-- F.1  Proposta com desconto só é enviada depois da aprovação da Administração
--      (console.comercial.desconto, ação nova); sem desconto, envia direto.
-- E.1  Vai por link sem conta, que expira com a validade da versão e pode ser revogado. O
--      banco guarda só o resumo (sha256) do código. As aberturas guardam a data e um resumo
--      anônimo do aparelho, sem identificar a pessoa.
-- L.1  Custo por apartamento = mensalidade / unidades, marcado como estimativa, sem ROI; as
--      premissas ficam na versão.
-- EM-07 O que está incluído e o que é planejado vem pronto e não se edita.
--
-- Regras desta parte:
-- 1. Uma proposta por negociação (por interessado). Cada mudança depois do envio é uma versão
--    nova; a versão enviada não muda (gatilho). O rascunho muda à vontade.
-- 2. Situações da versão: RASCUNHO, AGUARDA_DESCONTO, PRONTA (desconto aprovado), ENVIADA,
--    ACEITA, RECUSADA, VENCIDA, SUBSTITUIDA. Enviada que passou da validade é vencida, mesmo
--    antes da rotina diária gravar; vencida não aceita: refazer com a tabela do dia (OC-04).
-- 3. A impressão digital (hash) é o sha256 do conteúdo canônico da versão (o que o síndico vê),
--    gravado no envio. As referências ficam fora dela: a autorização pode ser retirada depois.
-- 4. O aceite pelo link guarda nome, CPF (validado), cargo, data, IP, a versão e o hash; vira
--    conversa e leva o interessado para Aprovação no condomínio (quando a ficha já tem quem
--    decide e a data) ou para Negociação, sem nunca voltar etapa.
-- 5. Notas internas nunca vão na proposta (CM-12): a nota da versão, o motivo do desconto, a
--    resposta da Administração, as conversas e as notas da ficha ficam só para a equipe. O link
--    e o kit nunca as leem.
-- 6. Respostas prontas (CM-27) e referências (CM-28) são modelos: só a Administração muda.
--    Resposta só entra na proposta depois de revisada. Referência só com autorização registrada;
--    retirar a autorização apaga o contato e tira a referência de tudo que ainda vai ser lido.
-- 7. O kit (CM-20) não tem tabela: sai da versão enviada, da ficha do prédio, dos concorrentes
--    da ficha (CM-17) com o preço só quando conferido na Tabela de preços, e das respostas.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê.

insert into funcao_acoes (funcao, acao) values ('ADMINISTRACAO', 'console.comercial.desconto');

-- O Comercial lê a Tabela de preços dentro das funções da proposta (a tela da tabela continua
-- só de Administração e Financeiro: console_tabela_precos confere console.precos.ver).
create policy leitura_comercial on faixas_preco for select using (contexto_equipe() and pode_global('console.comercial.ver'));
create policy leitura_comercial on parametros_preco for select using (contexto_equipe() and pode_global('console.comercial.ver'));
create policy leitura_comercial on precos_concorrentes for select using (contexto_equipe() and pode_global('console.comercial.ver'));

alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial', 'proposta', 'resposta_comercial',
                                                                'referencia_comercial')
             and pode_global('console.comercial.ver')));

insert into configuracoes (chave, valor, descricao) values
  ('proposta_validade_dias', '15', 'Dias de validade da proposta comercial, contados do envio'),
  ('limite_proposta_max', '60', 'Aberturas do link da proposta pelo mesmo aparelho dentro da janela'),
  ('limite_proposta_janela_minutos', '60', 'Janela das aberturas do link da proposta'),
  ('limite_aceite_max', '5', 'Aceites tentados pelo mesmo aparelho dentro da janela'),
  ('limite_aceite_janela_minutos', '60', 'Janela dos aceites da proposta');

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function comercial_hoje() returns date
language sql stable
set search_path = public
as $$ select (app_now() at time zone 'America/Sao_Paulo')::date $$;

-- CPF com os dois dígitos verificadores (só dígitos, 11, sem todos iguais).
create function cpf_valido(p text) returns boolean
language plpgsql immutable
set search_path = public
as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then return false; end if;
  select array_agg(substr(p, n, 1)::int order by n) into d from generate_series(1, 11) n;
  s := 0;
  for i in 1 .. 9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1 .. 10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  return r = d[11];
end $$;

-- O que está incluído e o que é planejado (EM-07): texto pronto, igual em toda proposta.
-- Mudar é uma migration nova; a versão guarda a cópia do dia em que nasceu.
create function comercial_oferta_incluido() returns jsonb
language sql immutable
set search_path = public
as $$ select '["Todo pedido com responsável, prazo e conclusão explicada", "Comunicados, documentos e mural do prédio por link", "Agenda, manutenção e prestadores"]'::jsonb $$;

create function comercial_oferta_planejado() returns jsonb
language sql immutable
set search_path = public
as $$ select '["WhatsApp oficial", "Inteligência artificial"]'::jsonb $$;

create function comercial_hash(p jsonb) returns text
language sql immutable
set search_path = public
as $$ select encode(extensions.digest(convert_to(p::text, 'UTF8'), 'sha256'), 'hex') $$;

create function comercial_ordem_etapa(p_etapa text) returns integer
language sql stable
set search_path = public
as $$ select ordem from parametros_etapa_comercial where etapa = p_etapa $$;

-- ---------------------------------------------------------------------------------------
-- Respostas prontas (CM-27): só a Administração muda; só a revisada entra na proposta.

create table respostas_comercial (
  id           uuid primary key default gen_random_uuid(),
  tema         text not null check (tema in ('LGPD', 'SEGURANCA', 'SUPORTE', 'IMPLANTACAO', 'CANCELAMENTO', 'DEVOLUCAO', 'OUTRO')),
  titulo       text not null check (length(btrim(titulo)) between 3 and 60),
  texto        text not null check (length(btrim(texto)) between 10 and 3000),
  revisada_em  timestamptz,
  revisada_por uuid references pessoas (id),
  ativa        boolean not null default true,
  criado_em    timestamptz not null default app_now(),
  criado_por   uuid references pessoas (id),
  alterado_em  timestamptz,
  alterado_por uuid references pessoas (id),
  versao       integer not null default 1,
  check ((revisada_em is null) = (revisada_por is null))
);
-- Os temas do quadro 344, a revisar: a Administração escreve e revisa antes do primeiro uso.
insert into respostas_comercial (tema, titulo, texto) values
  ('LGPD', 'LGPD', 'Quem controla os dados do condomínio, o que a TRÍADE guarda e por quanto tempo.'),
  ('SEGURANCA', 'Segurança', 'Onde os dados ficam, quem da equipe acessa e como o acesso é registrado.'),
  ('SUPORTE', 'Suporte', 'Como o síndico pede ajuda, em quanto tempo responde e em que horário.'),
  ('IMPLANTACAO', 'Prazo de implantação', 'Do contrato assinado ao prédio usando, com as 8 etapas.'),
  ('CANCELAMENTO', 'Como cancelar', 'Aviso, multa e o que acontece com os dados no cancelamento.'),
  ('DEVOLUCAO', 'Devolução dos dados', 'Exportação completa do histórico, em planilha e PDF.');
call proteger_tabela_comercial('respostas_comercial', 'console.comercial.modelos',
  'Respostas prontas do comercial para questionário e cotação; só a Administração muda (CM-27)');
create trigger respostas_comercial_sem_exclusao before delete on respostas_comercial for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Referências e casos (CM-28): só com autorização registrada; retirar apaga o contato.

create table referencias_comercial (
  id                uuid primary key default gen_random_uuid(),
  sindico           text not null check (length(btrim(sindico)) between 2 and 80),
  condominio        text not null check (length(btrim(condominio)) between 2 and 120),
  unidades          integer check (unidades between 1 and 20000),
  -- CONTATO: pode passar o contato; SO_NOME: só o nome e o prédio.
  escopo            text not null check (escopo in ('CONTATO', 'SO_NOME')),
  whatsapp          text check (whatsapp ~ '^55[0-9]{10,11}$'),
  email             text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  autorizado_em     date not null,
  autorizacao_texto text not null check (length(btrim(autorizacao_texto)) between 10 and 500),
  -- Caso com número medido na Plataforma, depois de pelo menos 3 meses de uso (EM-07).
  caso_texto        text check (length(btrim(caso_texto)) between 10 and 600),
  caso_uso_desde    date,
  caso_medido_em    date,
  retirada_em       timestamptz,
  retirada_por      uuid references pessoas (id),
  retirada_motivo   text check (length(btrim(retirada_motivo)) between 3 and 300),
  criado_em         timestamptz not null default app_now(),
  criado_por        uuid references pessoas (id),
  alterado_em       timestamptz,
  alterado_por      uuid references pessoas (id),
  versao            integer not null default 1,
  check (escopo = 'CONTATO' or (whatsapp is null and email is null)),
  check (escopo <> 'CONTATO' or retirada_em is not null or num_nonnulls(whatsapp, email) >= 1),
  check ((caso_texto is null) = (caso_medido_em is null) and (caso_texto is null) = (caso_uso_desde is null)),
  check (caso_medido_em is null or caso_medido_em >= caso_uso_desde + interval '3 months'),
  check ((retirada_em is null) = (retirada_motivo is null)),
  check (retirada_em is null or (whatsapp is null and email is null))
);
call proteger_tabela_comercial('referencias_comercial', 'console.comercial.modelos',
  'Referências de síndicos clientes, só com autorização registrada, que pode ser retirada (CM-28)');
create trigger referencias_comercial_sem_exclusao before delete on referencias_comercial for each row execute function somente_insercao();

-- Retirada não volta: para autorizar de novo, registra-se outra referência.
create function referencias_comercial_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.retirada_em is not null then
    raise exception 'A autorização foi retirada; registre outra referência' using errcode = 'TC422', detail = '{"motivo":"REFERENCIA_RETIRADA"}';
  end if;
  if (new.id, new.autorizado_em, new.criado_em, new.criado_por) is distinct from (old.id, old.autorizado_em, old.criado_em, old.criado_por) then
    raise exception 'A data da autorização não muda' using errcode = 'TC422', detail = '{"motivo":"AUTORIZACAO_FIXA"}';
  end if;
  return new;
end $$;
create trigger referencias_comercial_regras before update on referencias_comercial for each row execute function referencias_comercial_regras();

-- ---------------------------------------------------------------------------------------
-- Propostas e versões (CM-06, CM-07, CM-19).

create table propostas_comercial (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null unique references interessados (id),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1
);
call proteger_tabela_comercial('propostas_comercial', 'console.comercial.editar', 'Propostas do comercial, uma por interessado; as versões ficam em versoes_proposta');
create trigger propostas_comercial_sem_exclusao before delete on propostas_comercial for each row execute function somente_insercao();

create function propostas_comercial_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.interessado_id, new.criado_em, new.criado_por) is distinct from (old.id, old.interessado_id, old.criado_em, old.criado_por) then
    raise exception 'A proposta não muda de interessado' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger propostas_comercial_fixas before update on propostas_comercial for each row execute function propostas_comercial_fixas();

create table versoes_proposta (
  id                       uuid primary key default gen_random_uuid(),
  proposta_id              uuid not null references propostas_comercial (id),
  numero                   integer not null check (numero between 1 and 99),
  situacao                 text not null default 'RASCUNHO' check (situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA', 'ACEITA', 'RECUSADA',
                                                                                'VENCIDA', 'SUBSTITUIDA')),
  -- O prédio no dia da versão.
  condominio               text not null check (length(btrim(condominio)) between 2 and 120),
  cidade                   text,
  uf                       char(2),
  -- O plano, pela Tabela de preços do dia (H.1).
  faixa                    text not null check (faixa in ('ATE_40', 'DE_41_A_100', 'DE_101_A_200', 'DE_201_A_400', 'ACIMA_DE_400')),
  unidades                 integer not null check (unidades between 1 and 20000),
  ciclo                    text not null check (ciclo in ('MENSAL', 'ANUAL')),
  tabela                   text not null check (tabela in ('FUNDADOR', 'CHEIA', 'MANUAL')),
  mensal_tabela_centavos   centavos check (mensal_tabela_centavos > 0),
  mensal_centavos          centavos check (mensal_centavos > 0),
  anual_centavos           centavos check (anual_centavos > 0),
  meses_pagos_anual        integer check (meses_pagos_anual between 1 and 12),
  depois_centavos          centavos check (depois_centavos > 0),
  implantacao_centavos     centavos check (implantacao_centavos > 0),
  implantacao_parcelas     integer check (implantacao_parcelas between 1 and 12),
  implantacao_sem_custo    boolean not null,
  valor_manual_motivo      text check (length(btrim(valor_manual_motivo)) between 3 and 500),
  -- Desconto na mensalidade (F.1): pedido pelo Comercial, respondido pela Administração.
  desconto_percentual      numeric(5, 2) check (desconto_percentual > 0 and desconto_percentual < 100),
  desconto_motivo          text check (length(btrim(desconto_motivo)) between 3 and 500),
  desconto_situacao        text not null default 'SEM' check (desconto_situacao in ('SEM', 'PEDIDO', 'APROVADO', 'RECUSADO')),
  desconto_pedido_em       timestamptz,
  desconto_pedido_por      uuid references pessoas (id),
  desconto_resposta        text check (length(btrim(desconto_resposta)) between 2 and 500),
  desconto_respondido_em   timestamptz,
  desconto_respondido_por  uuid references pessoas (id),
  -- Custo por apartamento (CM-19, L.1): estimativa, com as premissas.
  por_apartamento_centavos centavos check (por_apartamento_centavos > 0),
  premissas                jsonb not null check (jsonb_typeof(premissas) = 'object'),
  -- Oferta honesta (EM-07): cópia do texto pronto.
  incluido                 jsonb not null check (jsonb_typeof(incluido) = 'array'),
  planejado                jsonb not null check (jsonb_typeof(planejado) = 'array'),
  -- Respostas prontas escolhidas (cópia do texto revisado) e referências escolhidas.
  respostas                jsonb not null default '[]' check (jsonb_typeof(respostas) = 'array' and jsonb_array_length(respostas) <= 20),
  referencias              uuid[] not null default '{}' check (cardinality(referencias) <= 10),
  validade_dias            integer not null check (validade_dias between 1 and 60),
  valido_ate               date,
  hash                     text check (hash ~ '^[0-9a-f]{64}$'),
  -- Só da equipe; nunca vai na proposta (CM-12).
  nota_interna             text check (length(btrim(nota_interna)) between 2 and 1000),
  enviada_em               timestamptz,
  enviada_por              uuid references pessoas (id),
  recusada_em              timestamptz,
  recusada_por             uuid references pessoas (id),
  recusada_motivo          text check (length(btrim(recusada_motivo)) between 3 and 500),
  substituida_em           timestamptz,
  criado_em                timestamptz not null default app_now(),
  criado_por               uuid references pessoas (id),
  alterado_em              timestamptz,
  alterado_por             uuid references pessoas (id),
  versao                   integer not null default 1,
  unique (proposta_id, numero),
  check ((desconto_percentual is null) = (desconto_motivo is null)),
  check (desconto_percentual is not null or desconto_situacao = 'SEM'),
  check ((desconto_situacao = 'SEM') = (desconto_pedido_em is null)),
  check ((desconto_situacao in ('APROVADO', 'RECUSADO')) = (desconto_respondido_em is not null)),
  check ((tabela = 'MANUAL') = (valor_manual_motivo is not null)),
  check (situacao <> 'AGUARDA_DESCONTO' or desconto_situacao = 'PEDIDO'),
  check (situacao <> 'PRONTA' or desconto_situacao = 'APROVADO'),
  check (situacao not in ('ENVIADA', 'ACEITA', 'RECUSADA', 'VENCIDA')
         or (enviada_em is not null and valido_ate is not null and hash is not null and mensal_centavos is not null
             and (desconto_percentual is null or desconto_situacao = 'APROVADO'))),
  check ((situacao = 'RECUSADA') = (recusada_em is not null) and (recusada_em is null) = (recusada_motivo is null)),
  check ((situacao = 'SUBSTITUIDA') = (substituida_em is not null))
);
-- Uma versão em andamento por proposta: as outras foram substituídas, venceram ou fecharam.
create unique index versoes_proposta_uma_em_andamento on versoes_proposta (proposta_id)
  where situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA');
call proteger_tabela_comercial('versoes_proposta', 'console.comercial.editar', 'Versões das propostas do comercial; a versão enviada não muda (CM-07)');
create trigger versoes_proposta_sem_exclusao before delete on versoes_proposta for each row execute function somente_insercao();

-- A versão enviada não muda (CM-07): só a situação anda (aceita, recusada, vencida ou
-- substituída). A anonimização (CM-12) é a única que ainda apaga a nota interna.
create function versoes_proposta_regras() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_livres text[] := array['situacao', 'recusada_em', 'recusada_por', 'recusada_motivo', 'substituida_em', 'alterado_em', 'alterado_por', 'versao',
                           'nota_interna'];
begin
  if (new.id, new.proposta_id, new.numero, new.criado_em, new.criado_por) is distinct from (old.id, old.proposta_id, old.numero, old.criado_em, old.criado_por) then
    raise exception 'A versão não troca de proposta nem de número' using errcode = 'TC422', detail = '{"motivo":"VERSAO_ENVIADA"}';
  end if;
  if old.situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then
    return new;
  end if;
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres)
     or (new.nota_interna is distinct from old.nota_interna and not (comercial_sistema() and new.nota_interna is null))
     or not (new.situacao = old.situacao or (old.situacao = 'ENVIADA' and new.situacao in ('ACEITA', 'RECUSADA', 'VENCIDA', 'SUBSTITUIDA'))) then
    raise exception 'A versão enviada não muda; faça uma versão nova' using errcode = 'TC422', detail = '{"motivo":"VERSAO_ENVIADA"}';
  end if;
  return new;
end $$;
create trigger versoes_proposta_regras before update on versoes_proposta for each row execute function versoes_proposta_regras();

-- Links da proposta (E.1): só o resumo do código; vale até o fim do dia da validade.
create table links_proposta (
  id              uuid primary key default gen_random_uuid(),
  versao_id       uuid not null references versoes_proposta (id),
  hash            bytea not null unique,
  expira_em       timestamptz not null,
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid references pessoas (id),
  revogado_em     timestamptz,
  revogado_por    uuid references pessoas (id),
  revogado_motivo text check (length(btrim(revogado_motivo)) between 3 and 300),
  check ((revogado_em is null) = (revogado_motivo is null))
);
create index links_proposta_versao on links_proposta (versao_id);
call proteger_tabela_comercial('links_proposta', 'console.comercial.editar', 'Links sem conta das propostas do comercial; só o resumo do código fica guardado');
create trigger links_proposta_sem_exclusao before delete on links_proposta for each row execute function somente_insercao();

create function links_proposta_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.revogado_em is not null or new.revogado_em is null
     or (new.id, new.versao_id, new.hash, new.expira_em, new.criado_em, new.criado_por)
        is distinct from (old.id, old.versao_id, old.hash, old.expira_em, old.criado_em, old.criado_por) then
    raise exception 'O link só muda para revogado' using errcode = 'TC422', detail = '{"motivo":"LINK_FIXO"}';
  end if;
  return new;
end $$;
create trigger links_proposta_regras before update on links_proposta for each row execute function links_proposta_regras();

-- Aberturas (CM-07): a data e o resumo anônimo do aparelho; quem abriu não é identificado.
create table aberturas_proposta (
  id        uuid primary key default gen_random_uuid(),
  link_id   uuid not null references links_proposta (id),
  versao_id uuid not null references versoes_proposta (id),
  aparelho  text check (aparelho ~ '^[0-9a-f]{64}$'),
  aberta_em timestamptz not null default app_now()
);
create index aberturas_proposta_versao on aberturas_proposta (versao_id, aberta_em desc);
call proteger_tabela_comercial('aberturas_proposta', 'console.comercial.editar', 'Aberturas do link da proposta, com o resumo anônimo do aparelho; só inserção');
create trigger aberturas_proposta_somente_insercao before update or delete on aberturas_proposta for each row execute function somente_insercao();

-- Aceite pelo link (CM-07): nome, CPF, cargo, data, IP, versão e hash. Só a anonimização
-- (CM-12) apaga nome, CPF e IP depois.
create table aceites_proposta (
  id             uuid primary key default gen_random_uuid(),
  versao_id      uuid not null unique references versoes_proposta (id),
  link_id        uuid not null references links_proposta (id),
  nome           text check (length(btrim(nome)) between 2 and 80),
  cpf            text check (cpf is null or cpf_valido(cpf)),
  cargo          text not null check (length(btrim(cargo)) between 2 and 60),
  ip             text check (length(ip) between 3 and 45),
  aparelho       text check (aparelho ~ '^[0-9a-f]{64}$'),
  hash_versao    text not null check (hash_versao ~ '^[0-9a-f]{64}$'),
  aceito_em      timestamptz not null default app_now(),
  anonimizado_em timestamptz,
  check (anonimizado_em is not null or (nome is not null and cpf is not null))
);
call proteger_tabela_comercial('aceites_proposta', 'console.comercial.editar', 'Aceites das propostas pelo link: nome, CPF, cargo, data, IP, versão e hash; só inserção');
create trigger aceites_proposta_sem_exclusao before delete on aceites_proposta for each row execute function somente_insercao();

create function aceites_proposta_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not comercial_sistema() or new.anonimizado_em is null
     or (new.id, new.versao_id, new.link_id, new.cargo, new.hash_versao, new.aceito_em)
        is distinct from (old.id, old.versao_id, old.link_id, old.cargo, old.hash_versao, old.aceito_em) then
    raise exception 'O aceite não se altera' using errcode = 'TC422', detail = '{"motivo":"ACEITE_FIXO"}';
  end if;
  return new;
end $$;
create trigger aceites_proposta_regras before update on aceites_proposta for each row execute function aceites_proposta_regras();

-- ---------------------------------------------------------------------------------------
-- O preço pela Tabela de preços (H.1, L.1). Não grava nada.

-- Mesmas regras de console_sugestao_plano: a tabela pedida (ou a em uso); fundador só no
-- mensal e com vaga livre; anual = meses pagos × mensal, implantação isenta; acima de 400,
-- sob consulta com o valor digitado. O desconto vale só na mensalidade.
create function comercial_calcular_proposta(p_unidades integer, p_ciclo text, p_tabela text, p_valor_manual bigint, p_implantacao_manual bigint,
                                            p_desconto numeric) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  f faixas_preco;
  p parametros_preco;
  v_ciclo text := coalesce(p_ciclo, 'MENSAL');
  v_tabela text;
  v_livres integer;
  v_avisos text[] := '{}';
  v_base bigint;
  v_mensal bigint;
  v_anual bigint;
  v_depois bigint;
  v_impl bigint;
  v_parcelas integer;
  v_sem_custo boolean := false;
  v_por_ap bigint;
  v_dias integer := configuracao_int('proposta_validade_dias');
begin
  if v_ciclo not in ('MENSAL', 'ANUAL') then perform recusar_campos('Escolha o ciclo', 'ciclo'); end if;
  if p_desconto is not null and (p_desconto <= 0 or p_desconto >= 100) then perform recusar_campos('O desconto vai de 0,01% a 99,99%', 'desconto'); end if;
  select * into p from parametros_preco;
  v_livres := greatest(p.vagas_fundador - vagas_fundador_ocupadas(), 0);
  if p_unidades is null or p_unidades < 1 then
    return jsonb_build_object('ciclo', v_ciclo, 'validadeDias', v_dias, 'avisos', jsonb_build_array('SEM_UNIDADES'),
                              'vagasFundador', vagas_fundador_json());
  end if;
  select * into f from faixas_preco where p_unidades >= unidades_de and (unidades_ate is null or p_unidades <= unidades_ate) order by ordem limit 1;

  v_tabela := case when p_tabela in ('FUNDADOR', 'CHEIA') then p_tabela else p.tabela_em_uso end;
  if f.sob_consulta then
    v_tabela := 'MANUAL';
    v_avisos := array_append(v_avisos, 'SOB_CONSULTA');
  elsif v_tabela = 'FUNDADOR' and v_ciclo = 'ANUAL' then
    v_tabela := 'CHEIA';
    v_avisos := array_append(v_avisos, 'FUNDADOR_SO_MENSAL');
  elsif v_tabela = 'FUNDADOR' and v_livres = 0 then
    v_tabela := 'CHEIA';
    v_avisos := array_append(v_avisos, 'SEM_VAGA_FUNDADOR');
  end if;

  if v_tabela = 'FUNDADOR' then
    v_base := f.fundador_centavos;
    v_depois := f.cheia_centavos;
    v_sem_custo := true;
  elsif v_tabela = 'CHEIA' then
    v_base := f.cheia_centavos;
    if v_ciclo = 'ANUAL' then
      v_sem_custo := true;
    else
      v_impl := f.implantacao_centavos;
      v_parcelas := case when f.implantacao_centavos is not null then p.parcelas_implantacao end;
      v_sem_custo := f.implantacao_centavos is null;
    end if;
  else
    v_base := p_valor_manual;
    if v_ciclo = 'ANUAL' then
      v_sem_custo := true;
    else
      v_impl := p_implantacao_manual;
      v_parcelas := case when p_implantacao_manual is not null then p.parcelas_implantacao end;
      v_sem_custo := p_implantacao_manual is null;
    end if;
  end if;
  if v_base is null and v_tabela <> 'MANUAL' then v_avisos := array_append(v_avisos, 'VALOR_A_DEFINIR'); end if;

  v_mensal := case when v_base is not null and p_desconto is not null then round(v_base * (100 - p_desconto) / 100)::bigint else v_base end;
  v_anual := case when v_ciclo = 'ANUAL' then v_mensal * p.meses_pagos_anual end;
  v_por_ap := case when v_mensal is not null then greatest(round(v_mensal::numeric / p_unidades), 1)::bigint end;

  return jsonb_strip_nulls(jsonb_build_object(
    'unidades', p_unidades,
    'faixa', jsonb_strip_nulls(jsonb_build_object('codigo', f.codigo, 'nome', f.nome, 'unidadesDe', f.unidades_de, 'unidadesAte', f.unidades_ate,
                                                  'sobConsulta', f.sob_consulta)),
    'ciclo', v_ciclo,
    'tabela', v_tabela,
    'tabelaEmUso', p.tabela_em_uso,
    'mensalTabela', v_base,
    'mensal', v_mensal,
    'anual', v_anual,
    'mesesPagos', case when v_ciclo = 'ANUAL' then p.meses_pagos_anual end,
    'depoisFundador', v_depois,
    'fundadorMeses', case when v_tabela = 'FUNDADOR' then 12 end,
    'implantacao', v_impl,
    'implantacaoParcelas', v_parcelas,
    'implantacaoSemCusto', v_sem_custo,
    'desconto', trim_scale(p_desconto),
    'porApartamento', v_por_ap,
    'validadeDias', v_dias,
    'validoAtePrevisto', comercial_hoje() + v_dias,
    'vagasFundador', vagas_fundador_json(),
    'avisos', to_jsonb(v_avisos)));
end $$;

-- As premissas do custo por apartamento (L.1), guardadas na versão.
create function comercial_premissas(p_mensal bigint, p_unidades integer, p_por_ap bigint) returns jsonb
language sql immutable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'estimativa', true, 'semRoi', true, 'implantacaoAParte', true, 'mensal', p_mensal, 'unidades', p_unidades, 'porApartamento', p_por_ap,
    'texto', case when p_mensal is not null then
      'Estimativa: ' || reais(p_mensal::integer) || ' por mês divididos por ' || p_unidades || ' unidades dá ' || reais(p_por_ap::integer)
      || ' por apartamento por mês. A implantação é à parte. Não é cálculo de retorno.' end))
$$;

-- ---------------------------------------------------------------------------------------
-- O que a proposta mostra.

-- Enviada que passou da validade é vencida, mesmo antes da rotina gravar.
create function proposta_situacao(v versoes_proposta) returns text
language sql stable
set search_path = public
as $$ select case when v.situacao = 'ENVIADA' and v.valido_ate < comercial_hoje() then 'VENCIDA' else v.situacao end $$;

-- O conteúdo canônico da versão: o que o síndico vê, sem nada interno (CM-12). O hash é dele.
create function proposta_conteudo(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'versao', v.numero, 'condominio', v.condominio, 'cidade', v.cidade, 'uf', v.uf,
    'faixa', v.faixa, 'unidades', v.unidades, 'ciclo', v.ciclo, 'tabela', v.tabela, 'moeda', 'BRL',
    'mensalTabela', v.mensal_tabela_centavos, 'mensal', v.mensal_centavos, 'anual', v.anual_centavos, 'mesesPagos', v.meses_pagos_anual,
    'depoisFundador', v.depois_centavos, 'fundadorMeses', case when v.tabela = 'FUNDADOR' then 12 end,
    'implantacao', v.implantacao_centavos, 'implantacaoParcelas', v.implantacao_parcelas, 'implantacaoSemCusto', v.implantacao_sem_custo,
    'desconto', case when v.desconto_situacao = 'APROVADO' then trim_scale(v.desconto_percentual) end,
    'porApartamento', v.por_apartamento_centavos, 'premissas', v.premissas,
    'incluido', v.incluido, 'planejado', v.planejado,
    'respostas', (select coalesce(jsonb_agg(jsonb_build_object('tema', r ->> 'tema', 'titulo', r ->> 'titulo', 'texto', r ->> 'texto') order by o), '[]'::jsonb)
                    from jsonb_array_elements(v.respostas) with ordinality x(r, o)),
    'validadeDias', v.validade_dias, 'validoAte', v.valido_ate))
$$;

-- As referências da versão que ainda estão autorizadas; o contato só com escopo CONTATO.
create function proposta_referencias(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', r.id, 'sindico', r.sindico, 'condominio', r.condominio, 'unidades', r.unidades, 'escopo', r.escopo,
      'whatsapp', case when r.escopo = 'CONTATO' then r.whatsapp end, 'email', case when r.escopo = 'CONTATO' then r.email end,
      'caso', case when r.caso_texto is not null then jsonb_build_object('texto', r.caso_texto, 'usoDesde', r.caso_uso_desde, 'medidoEm', r.caso_medido_em) end))
      order by array_position(v.referencias, r.id)), '[]'::jsonb)
    from referencias_comercial r where r.id = any (v.referencias) and r.retirada_em is null
$$;

create function proposta_aberturas(p_versao uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object('total', count(*), 'aparelhos', count(distinct aparelho), 'ultima', max(aberta_em)))
    from aberturas_proposta where versao_id = p_versao
$$;

create function comercial_pessoa_json(p uuid) returns jsonb
language sql stable
set search_path = public
as $$ select case when p is not null then jsonb_build_object('id', p, 'nome', comercial_nome(p)) end $$;

-- A versão para a equipe: tudo, com o que é interno, o link, as aberturas e o aceite.
create function versao_proposta_json(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select proposta_conteudo(v) || jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'versaoRegistro', v.versao, 'numero', v.numero, 'situacao', proposta_situacao(v), 'hash', v.hash,
    'respostas', v.respostas,
    'referencias', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sindico', r.sindico, 'condominio', r.condominio,
                                                                 'retirada', r.retirada_em is not null) order by array_position(v.referencias, r.id)), '[]'::jsonb)
                      from referencias_comercial r where r.id = any (v.referencias)),
    'descontoPedido', case when v.desconto_percentual is not null then jsonb_strip_nulls(jsonb_build_object(
        'percentual', trim_scale(v.desconto_percentual), 'motivo', v.desconto_motivo, 'situacao', v.desconto_situacao,
        'pedidoEm', v.desconto_pedido_em, 'pedidoPor', comercial_pessoa_json(v.desconto_pedido_por),
        'resposta', v.desconto_resposta, 'respondidoEm', v.desconto_respondido_em, 'respondidoPor', comercial_pessoa_json(v.desconto_respondido_por))) end,
    'descontoSituacao', v.desconto_situacao,
    'valorManualMotivo', v.valor_manual_motivo, 'notaInterna', v.nota_interna,
    'enviadaEm', v.enviada_em, 'enviadaPor', comercial_pessoa_json(v.enviada_por),
    'recusa', case when v.recusada_em is not null then jsonb_build_object('em', v.recusada_em, 'motivo', v.recusada_motivo,
                                                                          'por', comercial_pessoa_json(v.recusada_por)) end,
    'substituidaEm', v.substituida_em, 'criadoEm', v.criado_em, 'criadoPor', comercial_pessoa_json(v.criado_por), 'alteradoEm', v.alterado_em,
    'link', (select jsonb_strip_nulls(jsonb_build_object('ativo', l.revogado_em is null and l.expira_em >= app_now(), 'criadoEm', l.criado_em,
                                                         'expiraEm', l.expira_em, 'revogadoEm', l.revogado_em, 'revogadoMotivo', l.revogado_motivo))
               from links_proposta l where l.versao_id = v.id order by l.criado_em desc, l.id desc limit 1),
    'aberturas', proposta_aberturas(v.id),
    'aceite', (select jsonb_strip_nulls(jsonb_build_object('nome', a.nome, 'cargo', a.cargo, 'em', a.aceito_em, 'ip', a.ip, 'hashVersao', a.hash_versao,
                                                           'cpfMascarado', case when a.cpf is not null then '•••.' || substr(a.cpf, 4, 3) || '.' || substr(a.cpf, 7, 3) || '-••' end,
                                                           'anonimizado', a.anonimizado_em is not null))
                 from aceites_proposta a where a.versao_id = v.id)))
$$;

-- O link para o síndico (quadros 328 e 329): o conteúdo, o hash e o aceite. Nada interno.
create function proposta_publica_json(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select proposta_conteudo(v) || jsonb_strip_nulls(jsonb_build_object(
    'numero', v.numero, 'situacao', proposta_situacao(v), 'hash', v.hash, 'enviadaEm', v.enviada_em,
    'aosCuidados', (select i.nome_contato from propostas_comercial p join interessados i on i.id = p.interessado_id
                     where p.id = v.proposta_id and i.anonimizado_em is null),
    'referencias', proposta_referencias(v),
    'podeAceitar', proposta_situacao(v) = 'ENVIADA',
    'aceite', (select jsonb_strip_nulls(jsonb_build_object('nome', a.nome, 'cargo', a.cargo, 'em', a.aceito_em, 'numero', v.numero, 'hash', a.hash_versao))
                 from aceites_proposta a where a.versao_id = v.id)))
$$;

-- O preço de um concorrente conferido na Tabela de preços para tantas unidades (como precoConcorrente).
create function comercial_preco_concorrente(c precos_concorrentes, p_unidades integer) returns bigint
language sql stable
set search_path = public
as $$
  select case c.modelo
    when 'FIXO' then c.valor_centavos
    when 'FAIXA' then (select (f ->> 'valor')::bigint from jsonb_array_elements(c.faixas) f where p_unidades <= (f ->> 'ate')::integer
                        order by (f ->> 'ate')::integer limit 1)
    else greatest(c.por_unidade_centavos * p_unidades, coalesce(c.minimo_centavos, 0)) end
$$;

-- O kit para o conselho (CM-20, CM-19, CM-27, CM-28): da versão enviada, da ficha do prédio,
-- dos concorrentes da ficha e das respostas. Comparativo só com fatos confirmados: o preço do
-- concorrente só aparece quando conferido na Tabela de preços. Nada interno (CM-12).
create function proposta_kit_json(v versoes_proposta, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'proposta', proposta_publica_json(v) - 'aosCuidados' - 'podeAceitar' - 'aceite',
    'predio', jsonb_strip_nulls(jsonb_build_object(
      'condominio', v.condominio, 'cidade', v.cidade, 'uf', v.uf, 'unidades', v.unidades,
      'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
      'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate, 'decisaoEm', i.decisao_em)),
    'comparativo', jsonb_strip_nulls(jsonb_build_object(
      'triade', jsonb_strip_nulls(jsonb_build_object('ciclo', v.ciclo, 'mensal', v.mensal_centavos, 'anual', v.anual_centavos,
                                                     'porApartamento', v.por_apartamento_centavos, 'implantacao', v.implantacao_centavos,
                                                     'implantacaoSemCusto', v.implantacao_sem_custo, 'estimativa', true)),
      'sistemaAtual', case when i.sistema_atual is not null then jsonb_strip_nulls(jsonb_build_object('nome', i.sistema_atual, 'fidelidadeAte', i.fidelidade_ate)) end,
      'concorrentes', (select coalesce(jsonb_agg(jsonb_build_object(
            'nome', c ->> 'nome',
            'confirmado', exists (select 1 from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                                                       and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome')),
            'planos', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'plano', pc.plano, 'modelo', pc.modelo, 'preco', comercial_preco_concorrente(pc, v.unidades), 'aPartirDe', pc.a_partir_de,
                  'porApartamento', case when comercial_preco_concorrente(pc, v.unidades) is not null
                                         then greatest(round(comercial_preco_concorrente(pc, v.unidades)::numeric / v.unidades), 1)::bigint end,
                  'fonte', pc.fonte, 'lidoEm', pc.lido_em)) order by pc.plano nulls first), '[]'::jsonb)
                from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                              and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome'))) order by o), '[]'::jsonb)
         from jsonb_array_elements(i.concorrentes) with ordinality x(c, o)))),
    'respostas', proposta_conteudo(v) -> 'respostas',
    'referencias', proposta_referencias(v),
    'oferta', jsonb_build_object('incluido', v.incluido, 'planejado', v.planejado))
$$;

-- ---------------------------------------------------------------------------------------
-- Leitura: sugestão, lista, ficha e kit.

create function comercial_respostas_revisadas() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tema', r.tema, 'titulo', r.titulo) order by r.criado_em, r.titulo), '[]'::jsonb)
    from respostas_comercial r where r.ativa and r.revisada_em is not null
$$;

create function comercial_referencias_autorizadas() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', r.id, 'sindico', r.sindico, 'condominio', r.condominio, 'unidades', r.unidades,
                                                                 'escopo', r.escopo, 'temCaso', r.caso_texto is not null)) order by r.criado_em), '[]'::jsonb)
    from referencias_comercial r where r.retirada_em is null
$$;

-- Sugestão pela tabela (CM-06, H.1): as unidades da ficha do prédio, ou as que a tela mandar.
-- Não grava nada.
create function comercial_sugestao_proposta(p_pessoa uuid, p_interessado uuid, p_unidades integer default null, p_ciclo text default null,
                                            p_tabela text default null, p_valor_manual bigint default null, p_implantacao_manual bigint default null,
                                            p_desconto numeric default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_interessado);
  return comercial_calcular_proposta(coalesce(p_unidades, i.unidades), p_ciclo, p_tabela, p_valor_manual, p_implantacao_manual, p_desconto)
    || jsonb_build_object(
      'interessado', jsonb_strip_nulls(jsonb_build_object('id', i.id, 'condominio', i.condominio, 'unidades', i.unidades, 'faixa', i.faixa,
                                                          'pessoa', i.nome_contato, 'etapa', i.etapa)),
      'propostaId', (select id from propostas_comercial where interessado_id = i.id),
      'oferta', jsonb_build_object('incluido', comercial_oferta_incluido(), 'planejado', comercial_oferta_planejado()),
      'respostas', comercial_respostas_revisadas(),
      'referencias', comercial_referencias_autorizadas());
end $$;

-- As abas do quadro 326: em aberto, aguardando aprovação, aceitas, vencidas e recusadas.
create function proposta_aba(p_situacao text) returns text
language sql immutable
set search_path = public
as $$
  select case when p_situacao in ('RASCUNHO', 'PRONTA', 'ENVIADA') then 'EM_ABERTO' when p_situacao = 'AGUARDA_DESCONTO' then 'AGUARDANDO_APROVACAO'
              when p_situacao = 'ACEITA' then 'ACEITAS' when p_situacao = 'VENCIDA' then 'VENCIDAS' when p_situacao = 'RECUSADA' then 'RECUSADAS' end
$$;

create function comercial_propostas(p_pessoa uuid, p_aba text default null, p_interessado uuid default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_saida jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  if p_aba is not null and p_aba not in ('EM_ABERTO', 'AGUARDANDO_APROVACAO', 'ACEITAS', 'VENCIDAS', 'RECUSADAS') then
    perform recusar_campos('Aba inválida', 'aba');
  end if;
  with atual as (
    select distinct on (p.id) p.id, p.versao, p.criado_em, coalesce(p.alterado_em, p.criado_em) as mexida_em, i.id as interessado_id,
           i.condominio, i.etapa, i.responsavel_id, v
      from propostas_comercial p join interessados i on i.id = p.interessado_id join versoes_proposta v on v.proposta_id = p.id
     where i.anonimizado_em is null and (p_interessado is null or i.id = p_interessado)
     order by p.id, v.numero desc
  ), linhas as (
    select a.*, proposta_situacao(a.v) as situacao, proposta_aba(proposta_situacao(a.v)) as aba from atual a
  )
  select jsonb_build_object(
    'propostas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', l.id, 'versao', l.versao, 'aba', l.aba,
        'interessado', jsonb_strip_nulls(jsonb_build_object('id', l.interessado_id, 'condominio', l.condominio, 'etapa', l.etapa,
                                                            'responsavel', comercial_pessoa_json(l.responsavel_id))),
        'atual', jsonb_strip_nulls(jsonb_build_object('id', (l.v).id, 'numero', (l.v).numero, 'situacao', l.situacao, 'ciclo', (l.v).ciclo,
                                                      'tabela', (l.v).tabela, 'mensal', (l.v).mensal_centavos, 'validoAte', (l.v).valido_ate,
                                                      'enviadaEm', (l.v).enviada_em, 'descontoSituacao', (l.v).desconto_situacao,
                                                      'desconto', trim_scale((l.v).desconto_percentual))),
        'aberturas', proposta_aberturas((l.v).id),
        'aceite', (select jsonb_build_object('em', a.aceito_em, 'cargo', a.cargo) from aceites_proposta a where a.versao_id = (l.v).id)))
        order by l.mexida_em desc) from linhas l where p_aba is null or l.aba = p_aba), '[]'::jsonb),
    'contagens', jsonb_build_object(
      'EM_ABERTO', (select count(*) from linhas where aba = 'EM_ABERTO'),
      'AGUARDANDO_APROVACAO', (select count(*) from linhas where aba = 'AGUARDANDO_APROVACAO'),
      'ACEITAS', (select count(*) from linhas where aba = 'ACEITAS'),
      'VENCIDAS', (select count(*) from linhas where aba = 'VENCIDAS'),
      'RECUSADAS', (select count(*) from linhas where aba = 'RECUSADAS')),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeAprovarDesconto', pode_global('console.comercial.desconto'))
  into v_saida;
  return v_saida;
end $$;

create function comercial_buscar_proposta(p_id uuid) returns propostas_comercial
language plpgsql
set search_path = public
as $$
declare p propostas_comercial;
begin
  select * into p from propostas_comercial where id = p_id;
  if not found then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  return p;
end $$;

create function comercial_buscar_versao(p_proposta uuid, p_id uuid) returns versoes_proposta
language plpgsql
set search_path = public
as $$
declare v versoes_proposta;
begin
  select * into v from versoes_proposta where id = p_id and proposta_id = p_proposta;
  if not found then raise exception 'Versão não encontrada' using errcode = 'TC404'; end if;
  return v;
end $$;

-- A proposta com as versões (quadro 326): a mais nova primeiro.
create function comercial_proposta(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  p := comercial_buscar_proposta(p_id);
  i := comercial_buscar(p.interessado_id);
  return jsonb_build_object(
    'id', p.id, 'versao', p.versao, 'criadoEm', p.criado_em,
    'interessado', jsonb_strip_nulls(jsonb_build_object('id', i.id, 'condominio', i.condominio, 'pessoa', i.nome_contato, 'etapa', i.etapa,
                                                        'unidades', i.unidades, 'faixa', i.faixa, 'anonimizado', i.anonimizado_em is not null,
                                                        'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj))),
    'versoes', coalesce((select jsonb_agg(versao_proposta_json(v) order by v.numero desc) from versoes_proposta v where v.proposta_id = p.id), '[]'::jsonb),
    'kitDisponivel', exists (select 1 from versoes_proposta v where v.proposta_id = p.id and proposta_situacao(v) in ('ENVIADA', 'ACEITA')),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeAprovarDesconto', pode_global('console.comercial.desconto'));
end $$;

-- Kit para o conselho (quadro 337): da versão enviada ou aceita mais nova.
create function comercial_kit(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  p := comercial_buscar_proposta(p_id);
  select * into v from versoes_proposta x where x.proposta_id = p.id and proposta_situacao(x) in ('ENVIADA', 'ACEITA') order by x.numero desc limit 1;
  if v.id is null then perform recusar_motivo('O kit sai da versão enviada; envie a proposta antes', 'SEM_VERSAO_ENVIADA'); end if;
  return proposta_kit_json(v, comercial_buscar(p.interessado_id))
    || jsonb_build_object('propostaId', p.id, 'versaoId', v.id, 'respostasDisponiveis', comercial_respostas_revisadas());
end $$;

-- ---------------------------------------------------------------------------------------
-- Escrita: criar, salvar o rascunho e fazer versão nova.

-- Interessado que pode receber proposta: aberto, com dados e fora da lista de não contatar.
create function comercial_exigir_aberto(i interessados) returns void
language plpgsql
set search_path = public
as $$
begin
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if not comercial_aberta(i.etapa) then perform recusar_motivo('Interessado fechado não recebe proposta', 'INTERESSADO_FECHADO'); end if;
  if comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj) then perform recusar_motivo('Este contato está na lista de não contatar', 'NAO_CONTATAR'); end if;
end $$;

-- As respostas escolhidas, com o texto revisado de agora (CM-27).
create function comercial_copiar_respostas(p_ids jsonb) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v jsonb := '[]';
  v_id text;
  r respostas_comercial;
begin
  if p_ids is null or jsonb_typeof(p_ids) = 'null' then return v; end if;
  if jsonb_typeof(p_ids) <> 'array' or jsonb_array_length(p_ids) > 20 then perform recusar_campos('Escolha até 20 respostas prontas', 'respostas'); end if;
  for v_id in select x from jsonb_array_elements_text(p_ids) with ordinality e(x, o) group by x order by min(o) loop
    select * into r from respostas_comercial where id::text = v_id and ativa and revisada_em is not null;
    if r.id is null then perform recusar_campos('Só entram respostas prontas revisadas pela Administração', 'respostas'); end if;
    v := v || jsonb_build_object('id', r.id, 'tema', r.tema, 'titulo', r.titulo, 'texto', r.texto, 'revisadaEm', r.revisada_em);
  end loop;
  return v;
end $$;

create function comercial_exigir_referencias(p_ids jsonb) returns uuid[]
language plpgsql
set search_path = public
as $$
declare v uuid[];
begin
  if p_ids is null or jsonb_typeof(p_ids) = 'null' then return '{}'; end if;
  if jsonb_typeof(p_ids) <> 'array' or jsonb_array_length(p_ids) > 10 then perform recusar_campos('Escolha até 10 referências', 'referencias'); end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v from jsonb_array_elements_text(p_ids) x;
  if exists (select 1 from unnest(v) r where not exists (select 1 from referencias_comercial c where c.id = r and c.retirada_em is null)) then
    perform recusar_campos('Só entram referências com autorização em vigor', 'referencias');
  end if;
  return v;
end $$;

-- Monta a versão pelos dados da tela e pela Tabela de preços do dia; o preço nunca vem da tela,
-- só o valor sob consulta, com motivo.
create function comercial_preparar_versao(i interessados, p_dados jsonb) returns versoes_proposta
language plpgsql
set search_path = public
as $$
declare
  v versoes_proposta;
  c jsonb;
  v_unidades integer := coalesce((p_dados ->> 'unidades')::integer, i.unidades);
  v_desconto numeric := nullif(p_dados ->> 'desconto', '')::numeric;
  v_tabela text := comercial_texto(p_dados, 'tabela');
  v_dias integer := coalesce((p_dados ->> 'validadeDias')::integer, configuracao_int('proposta_validade_dias'));
begin
  if v_unidades is null then perform recusar_campos('Informe as unidades do prédio', 'unidades'); end if;
  if v_tabela is not null and v_tabela not in ('FUNDADOR', 'CHEIA', 'MANUAL') then perform recusar_campos('Escolha a tabela', 'tabela'); end if;
  if v_dias not between 1 and 60 then perform recusar_campos('A validade vai de 1 a 60 dias', 'validadeDias'); end if;
  c := comercial_calcular_proposta(v_unidades, comercial_texto(p_dados, 'ciclo'), v_tabela, (p_dados ->> 'valorManual')::bigint,
                                   (p_dados ->> 'implantacaoManual')::bigint, v_desconto);
  if c ->> 'tabela' = 'MANUAL' then
    if (p_dados ->> 'valorManual') is null then perform recusar_campos('Sob consulta: digite a mensalidade combinada', 'valorManual'); end if;
    if comercial_texto(p_dados, 'valorManualMotivo') is null then perform recusar_campos('Diga de onde veio o valor sob consulta', 'valorManualMotivo'); end if;
  end if;
  if v_desconto is not null and comercial_texto(p_dados, 'descontoMotivo') is null then
    perform recusar_campos('Diga por que o desconto', 'descontoMotivo');
  end if;
  v.condominio := i.condominio;
  v.cidade := i.cidade;
  v.uf := i.uf;
  v.faixa := c -> 'faixa' ->> 'codigo';
  v.unidades := v_unidades;
  v.ciclo := c ->> 'ciclo';
  v.tabela := c ->> 'tabela';
  v.mensal_tabela_centavos := (c ->> 'mensalTabela')::bigint;
  v.mensal_centavos := (c ->> 'mensal')::bigint;
  v.anual_centavos := (c ->> 'anual')::bigint;
  v.meses_pagos_anual := (c ->> 'mesesPagos')::integer;
  v.depois_centavos := (c ->> 'depoisFundador')::bigint;
  v.implantacao_centavos := (c ->> 'implantacao')::bigint;
  v.implantacao_parcelas := (c ->> 'implantacaoParcelas')::integer;
  v.implantacao_sem_custo := (c ->> 'implantacaoSemCusto')::boolean;
  v.valor_manual_motivo := case when v.tabela = 'MANUAL' then comercial_texto(p_dados, 'valorManualMotivo') end;
  v.desconto_percentual := v_desconto;
  v.desconto_motivo := case when v_desconto is not null then comercial_texto(p_dados, 'descontoMotivo') end;
  v.por_apartamento_centavos := (c ->> 'porApartamento')::bigint;
  v.premissas := comercial_premissas(v.mensal_centavos, v_unidades, v.por_apartamento_centavos);
  v.incluido := comercial_oferta_incluido();
  v.planejado := comercial_oferta_planejado();
  v.respostas := comercial_copiar_respostas(p_dados -> 'respostas');
  v.referencias := comercial_exigir_referencias(p_dados -> 'referencias');
  v.validade_dias := v_dias;
  v.nota_interna := comercial_texto(p_dados, 'notaInterna');
  return v;
end $$;

create function comercial_inserir_versao(p_proposta uuid, p_numero integer, n versoes_proposta, p_pessoa uuid) returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  insert into versoes_proposta (proposta_id, numero, situacao, condominio, cidade, uf, faixa, unidades, ciclo, tabela, mensal_tabela_centavos, mensal_centavos,
                                anual_centavos, meses_pagos_anual, depois_centavos, implantacao_centavos, implantacao_parcelas, implantacao_sem_custo,
                                valor_manual_motivo, desconto_percentual, desconto_motivo, desconto_situacao, por_apartamento_centavos, premissas, incluido,
                                planejado, respostas, referencias, validade_dias, nota_interna, criado_por)
  values (p_proposta, p_numero, 'RASCUNHO', n.condominio, n.cidade, n.uf, n.faixa, n.unidades, n.ciclo, n.tabela, n.mensal_tabela_centavos, n.mensal_centavos,
          n.anual_centavos, n.meses_pagos_anual, n.depois_centavos, n.implantacao_centavos, n.implantacao_parcelas, n.implantacao_sem_custo,
          n.valor_manual_motivo, n.desconto_percentual, n.desconto_motivo, 'SEM', n.por_apartamento_centavos, n.premissas, n.incluido,
          n.planejado, n.respostas, n.referencias, n.validade_dias, n.nota_interna, p_pessoa)
  returning id into v_id;
  return v_id;
end $$;

-- Nova proposta (quadro 325): uma por interessado, nasce como rascunho v1.
create function comercial_criar_proposta(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_proposta uuid;
  v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_interessado);
  perform comercial_exigir_aberto(i);
  select id into v_proposta from propostas_comercial where interessado_id = i.id;
  if v_proposta is not null then
    raise exception 'Este interessado já tem proposta; faça uma versão nova' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'PROPOSTA_EXISTE', 'propostaId', v_proposta)::text;
  end if;
  insert into propostas_comercial (interessado_id, criado_por) values (i.id, p_pessoa) returning id into v_proposta;
  v_id := comercial_inserir_versao(v_proposta, 1, comercial_preparar_versao(i, p_dados), p_pessoa);
  perform registrar_historico_interno('comercial.proposta_criada', 'proposta', v_proposta::text, jsonb_build_object('versao', 1));
  return jsonb_build_object('id', v_proposta, 'versaoId', v_id, 'numero', 1, 'situacao', 'RASCUNHO',
                            'versao', (select versao from versoes_proposta where id = v_id));
end $$;

-- Salvar o rascunho. Desconto aprovado continua aprovado se o desconto e a base não mudaram;
-- qualquer outra mudança volta para rascunho e pede de novo.
create function comercial_salvar_versao(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  n versoes_proposta;
  v_mantem boolean;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_buscar_versao(p.id, p_id);
  if v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then
    perform recusar_motivo('A versão enviada não muda; faça uma versão nova', 'VERSAO_ENVIADA');
  end if;
  n := comercial_preparar_versao(comercial_buscar(p.interessado_id), p_dados);
  v_mantem := v.desconto_situacao = 'APROVADO' and n.desconto_percentual is not null
              and (n.desconto_percentual, n.mensal_tabela_centavos, n.ciclo, n.tabela) is not distinct from
                  (v.desconto_percentual, v.mensal_tabela_centavos, v.ciclo, v.tabela);
  update versoes_proposta set
    (condominio, cidade, uf, faixa, unidades, ciclo, tabela, mensal_tabela_centavos, mensal_centavos, anual_centavos, meses_pagos_anual, depois_centavos,
     implantacao_centavos, implantacao_parcelas, implantacao_sem_custo, valor_manual_motivo, desconto_percentual, desconto_motivo, por_apartamento_centavos,
     premissas, incluido, planejado, respostas, referencias, validade_dias, nota_interna)
    = (n.condominio, n.cidade, n.uf, n.faixa, n.unidades, n.ciclo, n.tabela, n.mensal_tabela_centavos, n.mensal_centavos, n.anual_centavos, n.meses_pagos_anual,
       n.depois_centavos, n.implantacao_centavos, n.implantacao_parcelas, n.implantacao_sem_custo, n.valor_manual_motivo, n.desconto_percentual, n.desconto_motivo,
       n.por_apartamento_centavos, n.premissas, n.incluido, n.planejado, n.respostas, n.referencias, n.validade_dias, n.nota_interna),
    situacao = case when v_mantem then 'PRONTA' else 'RASCUNHO' end,
    desconto_situacao = case when v_mantem then 'APROVADO' else 'SEM' end,
    desconto_pedido_em = case when v_mantem then desconto_pedido_em end,
    desconto_pedido_por = case when v_mantem then desconto_pedido_por end,
    desconto_resposta = case when v_mantem then desconto_resposta end,
    desconto_respondido_em = case when v_mantem then desconto_respondido_em end,
    desconto_respondido_por = case when v_mantem then desconto_respondido_por end,
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', case when v_mantem then 'PRONTA' else 'RASCUNHO' end);
end $$;

-- Versão nova (CM-07): a em andamento fica substituída (e o link dela para de abrir); a
-- enviada que venceu fica vencida. Proposta aceita não ganha versão: segue para o contrato.
create function comercial_nova_versao(p_pessoa uuid, p_proposta uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  i interessados;
  a versoes_proposta;
  n versoes_proposta;
  v_id uuid;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  if p.versao <> p_versao then perform conflito_versao('propostas_comercial', p_proposta); end if;
  i := comercial_buscar(p.interessado_id);
  perform comercial_exigir_aberto(i);
  select * into a from versoes_proposta where proposta_id = p.id order by numero desc limit 1 for update;
  if a.situacao = 'ACEITA' then perform recusar_motivo('Proposta aceita não ganha versão nova', 'PROPOSTA_ACEITA'); end if;
  n := comercial_preparar_versao(i, p_dados);
  if proposta_situacao(a) = 'VENCIDA' and a.situacao = 'ENVIADA' then
    update versoes_proposta set situacao = 'VENCIDA', alterado_em = app_now(), alterado_por = p_pessoa where id = a.id;
  elsif a.situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA') then
    update versoes_proposta set situacao = 'SUBSTITUIDA', substituida_em = app_now(), alterado_em = app_now(), alterado_por = p_pessoa where id = a.id;
  end if;
  update links_proposta set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = 'Substituída pela versão ' || (a.numero + 1)
   where versao_id = a.id and revogado_em is null;
  v_id := comercial_inserir_versao(p.id, a.numero + 1, n, p_pessoa);
  update propostas_comercial set alterado_em = app_now(), alterado_por = p_pessoa where id = p.id returning versao into v_versao;
  perform registrar_historico_interno('comercial.proposta_versao', 'proposta', p.id::text, jsonb_build_object('versao', a.numero + 1));
  return jsonb_build_object('id', p.id, 'versao', v_versao, 'versaoId', v_id, 'numero', a.numero + 1, 'situacao', 'RASCUNHO');
end $$;

-- ---------------------------------------------------------------------------------------
-- Desconto (F.1): o Comercial pede; só a Administração aprova ou recusa.

create function comercial_pedir_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_proposta;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  v := comercial_buscar_versao(p_proposta, p_id);
  if v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  if v.desconto_percentual is null then perform recusar_motivo('Esta versão não tem desconto', 'SEM_DESCONTO'); end if;
  if v.situacao <> 'RASCUNHO' then perform recusar_motivo('Só o rascunho pede aprovação do desconto', 'DESCONTO_JA_PEDIDO'); end if;
  if v.mensal_centavos is null then perform recusar_motivo('A faixa ainda não tem valor na tabela', 'PROPOSTA_SEM_VALOR'); end if;
  update versoes_proposta set situacao = 'AGUARDA_DESCONTO', desconto_situacao = 'PEDIDO', desconto_pedido_em = app_now(), desconto_pedido_por = p_pessoa,
                              desconto_resposta = null, desconto_respondido_em = null, desconto_respondido_por = null,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning versao into v_versao;
  perform registrar_historico_interno('comercial.desconto_pedido', 'proposta', p_proposta::text,
    jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', 'AGUARDA_DESCONTO');
end $$;

-- A resposta fica no histórico do interessado (nota interna, nunca na proposta).
create function comercial_responder_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_aprovar boolean, p_resposta text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  v_versao integer;
  v_situacao text := case when p_aprovar then 'PRONTA' else 'RASCUNHO' end;
begin
  perform entrar_console(p_pessoa, 'console.comercial.desconto');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_buscar_versao(p.id, p_id);
  if v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  if v.situacao <> 'AGUARDA_DESCONTO' then perform recusar_motivo('Este desconto não está aguardando resposta', 'DESCONTO_NAO_PEDIDO'); end if;
  if not coalesce(p_aprovar, false) and nullif(btrim(p_resposta), '') is null then
    perform recusar_campos('Diga a quem pediu por que recusou', 'resposta');
  end if;
  update versoes_proposta set situacao = v_situacao, desconto_situacao = case when p_aprovar then 'APROVADO' else 'RECUSADO' end,
                              desconto_resposta = nullif(btrim(p_resposta), ''), desconto_respondido_em = app_now(), desconto_respondido_por = p_pessoa,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning versao into v_versao;
  perform comercial_inserir_conversa(p.interessado_id, 'NOTA',
    format('Desconto de %s%% na proposta v%s %s pela Administração.%s', replace(trim_scale(v.desconto_percentual)::text, '.', ','), v.numero,
           case when p_aprovar then 'aprovado' else 'recusado' end, coalesce(' ' || nullif(btrim(p_resposta), ''), '')), false, null, null);
  perform registrar_historico_interno(case when p_aprovar then 'comercial.desconto_aprovado' else 'comercial.desconto_recusado' end, 'proposta',
    p.id::text, jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', v_situacao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Envio, link, revogação e recusa (E.1, CM-07).

-- Link novo para a versão: o anterior para de abrir. Devolve o código uma vez só.
create function comercial_gerar_link(v versoes_proposta, p_pessoa uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_codigo text;
  v_expira timestamptz := ((v.valido_ate + 1)::timestamp) at time zone 'America/Sao_Paulo';
begin
  update links_proposta set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = 'Trocado por um link novo'
   where versao_id = v.id and revogado_em is null;
  loop
    v_codigo := novo_codigo();
    exit when not exists (select 1 from links_proposta where hash = hash_codigo(v_codigo));
  end loop;
  insert into links_proposta (versao_id, hash, expira_em, criado_por) values (v.id, hash_codigo(v_codigo), v_expira, p_pessoa);
  return jsonb_build_object('codigo', v_codigo, 'expiraEm', v_expira);
end $$;

-- Enviar (F.1): sem desconto vai direto; com desconto, só aprovado. Grava a validade e o hash,
-- gera o link, registra a conversa e leva o interessado a Proposta enviada (sem voltar etapa).
create function comercial_enviar_proposta(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  i interessados;
  v versoes_proposta;
  v_respostas jsonb;
  v_link jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_buscar_versao(p.id, p_id);
  if v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  i := comercial_buscar(p.interessado_id);
  perform comercial_exigir_aberto(i);
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then perform recusar_motivo('Esta versão já foi enviada', 'VERSAO_ENVIADA'); end if;
  if v.desconto_percentual is not null and v.desconto_situacao <> 'APROVADO' then
    perform recusar_motivo('Proposta com desconto só sai depois da aprovação da Administração', 'DESCONTO_SEM_APROVACAO');
  end if;
  if v.mensal_centavos is null then perform recusar_motivo('A faixa ainda não tem valor na tabela', 'PROPOSTA_SEM_VALOR'); end if;
  -- As respostas saem com o texto revisado de hoje (a Administração pode ter mudado).
  v_respostas := comercial_copiar_respostas((select coalesce(jsonb_agg(r -> 'id'), '[]'::jsonb) from jsonb_array_elements(v.respostas) r));
  perform comercial_exigir_referencias(to_jsonb(v.referencias));
  update versoes_proposta set respostas = v_respostas, valido_ate = comercial_hoje() + validade_dias, enviada_em = app_now(), enviada_por = p_pessoa,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into v;
  update versoes_proposta set hash = comercial_hash(proposta_conteudo(v)), situacao = 'ENVIADA' where id = p_id returning * into v;
  v_link := comercial_gerar_link(v, p_pessoa);
  perform comercial_inserir_conversa(i.id, 'PROPOSTA', format('Proposta v%s enviada por link, válida até %s.', v.numero, to_char(v.valido_ate, 'DD/MM/YYYY')),
                                     false, null, null);
  if comercial_ordem_etapa(i.etapa) < comercial_ordem_etapa('PROPOSTA_ENVIADA') then
    update interessados set etapa = 'PROPOSTA_ENVIADA', etapa_desde = app_now(), faixa = coalesce(faixa, v.faixa), unidades = coalesce(unidades, v.unidades),
                            alterado_em = app_now(), alterado_por = p_pessoa
     where id = i.id;
    insert into etapas_interessado (interessado_id, de, para, criado_por) values (i.id, i.etapa, 'PROPOSTA_ENVIADA', p_pessoa);
    perform comercial_iniciar_cadencia(i.id);
  end if;
  update propostas_comercial set alterado_em = app_now(), alterado_por = p_pessoa where id = p.id;
  perform registrar_historico_interno('comercial.proposta_enviada', 'proposta', p.id::text, jsonb_build_object('versao', v.numero, 'hash', v.hash));
  return jsonb_build_object('id', v.id, 'versao', v.versao, 'numero', v.numero, 'situacao', 'ENVIADA', 'validoAte', v.valido_ate, 'hash', v.hash,
                            'link', v_link);
end $$;

-- Link novo para a versão enviada (o código só aparece na hora; o anterior para de abrir).
create function comercial_novo_link(p_pessoa uuid, p_proposta uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_proposta;
  v_link jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  v := comercial_buscar_versao(p_proposta, p_id);
  if proposta_situacao(v) not in ('ENVIADA', 'ACEITA') then perform recusar_motivo('Só a versão enviada e em validade tem link', 'SEM_LINK'); end if;
  v_link := comercial_gerar_link(v, p_pessoa);
  perform registrar_historico_interno('comercial.proposta_link', 'proposta', p_proposta::text, jsonb_build_object('versao', v.numero));
  return jsonb_build_object('id', v.id, 'link', v_link);
end $$;

create function comercial_revogar_link(p_pessoa uuid, p_proposta uuid, p_id uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_proposta;
  v_total integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  v := comercial_buscar_versao(p_proposta, p_id);
  if length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Diga por que revogar o link', 'motivo'); end if;
  update links_proposta set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = btrim(p_motivo)
   where versao_id = v.id and revogado_em is null;
  get diagnostics v_total = row_count;
  if v_total = 0 then perform recusar_motivo('Esta versão não tem link aberto', 'SEM_LINK'); end if;
  perform registrar_historico_interno('comercial.proposta_revogada', 'proposta', p_proposta::text, jsonb_build_object('versao', v.numero));
  return jsonb_build_object('id', v.id, 'revogados', v_total);
end $$;

-- O síndico disse não (a equipe registra): a versão fecha como recusada e o link para.
create function comercial_recusar_proposta(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_buscar_versao(p.id, p_id);
  if v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  if proposta_situacao(v) <> 'ENVIADA' then perform recusar_motivo('Só a versão enviada e em validade é recusada', 'PROPOSTA_INDISPONIVEL'); end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Diga o que a pessoa respondeu', 'motivo'); end if;
  update versoes_proposta set situacao = 'RECUSADA', recusada_em = app_now(), recusada_por = p_pessoa, recusada_motivo = btrim(p_motivo),
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning versao into v_versao;
  update links_proposta set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = 'Proposta recusada'
   where versao_id = p_id and revogado_em is null;
  perform comercial_inserir_conversa(p.interessado_id, 'PROPOSTA', format('Proposta v%s recusada: %s', v.numero, btrim(p_motivo)), true, null, null);
  perform registrar_historico_interno('comercial.proposta_recusada', 'proposta', p.id::text, jsonb_build_object('versao', v.numero));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', 'RECUSADA');
end $$;

-- Rotina diária: a enviada que passou da validade fica gravada como vencida.
create function comercial_vencer_propostas() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  update versoes_proposta set situacao = 'VENCIDA', alterado_em = app_now() where situacao = 'ENVIADA' and valido_ate < comercial_hoje();
  get diagnostics v_total = row_count;
  perform set_config('app.comercial_sistema', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('vencer-propostas', '27 3 * * *', 'select public.comercial_vencer_propostas()');
exception when others then
  raise notice 'pg_cron indisponível: agende comercial_vencer_propostas() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- O link sem conta (quadros 328 e 329). Sem pessoa: a api-console chama com o código, o
-- resumo do aparelho e, no aceite, o IP. Cada aparelho tem limite de uso na api-console.

create function publico_buscar_link(p_codigo text) returns links_proposta
language plpgsql
set search_path = public
as $$
declare l links_proposta;
begin
  select * into l from links_proposta where hash = hash_codigo(p_codigo) and revogado_em is null;
  if not found then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  return l;
end $$;

-- Vencida não abre nem aceita (a aceita continua abrindo, para baixar o que foi aceito).
create function publico_exigir_em_validade(l links_proposta, v versoes_proposta) returns void
language plpgsql
set search_path = public
as $$
begin
  if v.situacao <> 'ACEITA' and (l.expira_em < app_now() or proposta_situacao(v) = 'VENCIDA') then
    raise exception 'Esta proposta venceu' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'PROPOSTA_VENCIDA', 'validoAte', v.valido_ate)::text;
  end if;
  if v.situacao not in ('ENVIADA', 'ACEITA', 'RECUSADA', 'VENCIDA') then
    raise exception 'Proposta não encontrada' using errcode = 'TC404';
  end if;
end $$;

create function publico_proposta(p_codigo text, p_aparelho text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  v_saida jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id;
  perform publico_exigir_em_validade(l, v);
  insert into aberturas_proposta (link_id, versao_id, aparelho) values (l.id, v.id, case when p_aparelho ~ '^[0-9a-f]{64}$' then p_aparelho end);
  v_saida := proposta_publica_json(v) || jsonb_build_object('kitDisponivel', v.situacao in ('ENVIADA', 'ACEITA'));
  perform set_config('app.comercial_sistema', '', true);
  return v_saida;
end $$;

create function publico_kit_proposta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  v_kit jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id;
  perform publico_exigir_em_validade(l, v);
  if v.situacao not in ('ENVIADA', 'ACEITA') then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  v_kit := proposta_kit_json(v, (select i from propostas_comercial p join interessados i on i.id = p.interessado_id where p.id = v.proposta_id));
  perform set_config('app.comercial_sistema', '', true);
  return v_kit;
end $$;

-- Aceite (CM-07): nome, CPF validado, cargo, data, IP, versão e hash. Vira conversa e leva o
-- interessado a Aprovação no condomínio (com quem decide e a data na ficha) ou a Negociação.
create function publico_aceitar_proposta(p_codigo text, p_dados jsonb, p_ip text, p_aparelho text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  i interessados;
  v_nome text := comercial_texto(p_dados, 'nome');
  v_cpf text := regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_cargo text := comercial_texto(p_dados, 'cargo');
  v_alvo text;
  v_em timestamptz := app_now();
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id for update;
  perform publico_exigir_em_validade(l, v);
  if v.situacao = 'ACEITA' then perform recusar_motivo('Esta proposta já foi aceita', 'PROPOSTA_JA_ACEITA'); end if;
  if v.situacao <> 'ENVIADA' then perform recusar_motivo('Esta proposta não pode mais ser aceita', 'PROPOSTA_INDISPONIVEL'); end if;
  if coalesce(length(v_nome), 0) not between 2 and 80 then perform recusar_campos('Escreva o seu nome', 'nome'); end if;
  if not cpf_valido(v_cpf) then perform recusar_campos('CPF inválido', 'cpf'); end if;
  if coalesce(length(v_cargo), 0) not between 2 and 60 then perform recusar_campos('Diga o seu cargo no condomínio', 'cargo'); end if;
  if coalesce((p_dados ->> 'concordo')::boolean, false) is not true then perform recusar_campos('Confirme que leu a proposta', 'concordo'); end if;
  insert into aceites_proposta (versao_id, link_id, nome, cpf, cargo, ip, aparelho, hash_versao, aceito_em)
  values (v.id, l.id, v_nome, v_cpf, v_cargo, case when length(p_ip) between 3 and 45 then p_ip end,
          case when p_aparelho ~ '^[0-9a-f]{64}$' then p_aparelho end, v.hash, v_em);
  update versoes_proposta set situacao = 'ACEITA', alterado_em = v_em where id = v.id;
  select i2.* into i from propostas_comercial p join interessados i2 on i2.id = p.interessado_id where p.id = v.proposta_id;
  perform comercial_inserir_conversa(i.id, 'PROPOSTA', format('Proposta v%s aceita pelo link por %s (%s).', v.numero, v_nome, v_cargo), true, null, null);
  if i.anonimizado_em is null and comercial_aberta(i.etapa) then
    v_alvo := case when cardinality(comercial_falta(i, 'APROVACAO')) = 0 then 'APROVACAO' else 'NEGOCIACAO' end;
    if comercial_ordem_etapa(i.etapa) < comercial_ordem_etapa(v_alvo) and cardinality(comercial_falta(i, v_alvo)) = 0 then
      update interessados set etapa = v_alvo, etapa_desde = v_em where id = i.id;
      insert into etapas_interessado (interessado_id, de, para) values (i.id, i.etapa, v_alvo);
      perform comercial_iniciar_cadencia(i.id);
    end if;
  end if;
  update propostas_comercial set alterado_em = v_em where id = v.proposta_id;
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_build_object('situacao', 'ACEITA', 'numero', v.numero, 'nome', v_nome, 'cargo', v_cargo, 'aceitoEm', v_em, 'hash', v.hash);
end $$;

-- ---------------------------------------------------------------------------------------
-- Modelos (só a Administração muda): respostas prontas e referências.

create function comercial_respostas(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'respostas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', r.id, 'tema', r.tema, 'titulo', r.titulo, 'texto', r.texto, 'ativa', r.ativa, 'revisada', r.revisada_em is not null,
        'revisadaEm', r.revisada_em, 'revisadaPor', comercial_pessoa_json(r.revisada_por), 'versao', r.versao)) order by r.criado_em, r.titulo)
        from respostas_comercial r), '[]'::jsonb),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

-- Mudar o texto sem marcar revisada deixa a resposta "a revisar" (fora das propostas novas).
create function comercial_salvar_resposta(p_pessoa uuid, p_id uuid, p_versao integer, p_tema text, p_titulo text, p_texto text, p_revisada boolean,
                                          p_ativa boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if p_id is null then
    insert into respostas_comercial (tema, titulo, texto, revisada_em, revisada_por, ativa, criado_por)
    values (p_tema, btrim(p_titulo), btrim(p_texto), case when p_revisada then app_now() end, case when p_revisada then p_pessoa end,
            coalesce(p_ativa, true), p_pessoa)
    returning id, versao into v_id, v_versao;
  else
    update respostas_comercial set tema = p_tema, titulo = btrim(p_titulo), texto = btrim(p_texto),
                                   revisada_em = case when p_revisada then app_now() end, revisada_por = case when p_revisada then p_pessoa end,
                                   ativa = coalesce(p_ativa, true), alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id and versao = p_versao
    returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('respostas_comercial', p_id); end if;
  end if;
  perform registrar_historico_interno('comercial.resposta', 'resposta_comercial', v_id::text, jsonb_build_object('revisada', coalesce(p_revisada, false)));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function comercial_referencias(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'referencias', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', r.id, 'sindico', r.sindico, 'condominio', r.condominio, 'unidades', r.unidades, 'escopo', r.escopo, 'whatsapp', r.whatsapp, 'email', r.email,
        'autorizadoEm', r.autorizado_em, 'autorizacaoTexto', r.autorizacao_texto,
        'caso', case when r.caso_texto is not null then jsonb_build_object('texto', r.caso_texto, 'usoDesde', r.caso_uso_desde, 'medidoEm', r.caso_medido_em) end,
        'retirada', case when r.retirada_em is not null then jsonb_build_object('em', r.retirada_em, 'motivo', r.retirada_motivo,
                                                                                'por', comercial_pessoa_json(r.retirada_por)) end,
        'emUso', (select count(*) from versoes_proposta v where r.id = any (v.referencias) and v.situacao in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA', 'ENVIADA')),
        'versao', r.versao)) order by r.retirada_em is not null, r.criado_em) from referencias_comercial r), '[]'::jsonb),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

create function comercial_salvar_referencia(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_versao integer;
  v_escopo text := comercial_texto(p_dados, 'escopo');
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if v_escopo = 'CONTATO' and comercial_texto(p_dados, 'whatsapp') is null and comercial_texto(p_dados, 'email') is null then
    perform recusar_campos('Com o contato autorizado, informe o WhatsApp ou o e-mail', 'whatsapp', 'email');
  end if;
  if comercial_texto(p_dados, 'casoTexto') is not null and (p_dados ->> 'casoMedidoEm')::date < (p_dados ->> 'casoUsoDesde')::date + interval '3 months' then
    perform recusar_campos('Caso só com número medido depois de pelo menos 3 meses de uso', 'casoMedidoEm');
  end if;
  if p_id is null then
    insert into referencias_comercial (sindico, condominio, unidades, escopo, whatsapp, email, autorizado_em, autorizacao_texto, caso_texto, caso_uso_desde,
                                       caso_medido_em, criado_por)
    values (comercial_texto(p_dados, 'sindico'), comercial_texto(p_dados, 'condominio'), (p_dados ->> 'unidades')::integer, v_escopo,
            case when v_escopo = 'CONTATO' then comercial_texto(p_dados, 'whatsapp') end, case when v_escopo = 'CONTATO' then lower(comercial_texto(p_dados, 'email')) end,
            (p_dados ->> 'autorizadoEm')::date, comercial_texto(p_dados, 'autorizacaoTexto'), comercial_texto(p_dados, 'casoTexto'),
            (p_dados ->> 'casoUsoDesde')::date, (p_dados ->> 'casoMedidoEm')::date, p_pessoa)
    returning id, versao into v_id, v_versao;
  else
    update referencias_comercial set sindico = comercial_texto(p_dados, 'sindico'), condominio = comercial_texto(p_dados, 'condominio'),
                                     unidades = (p_dados ->> 'unidades')::integer, escopo = v_escopo,
                                     whatsapp = case when v_escopo = 'CONTATO' then comercial_texto(p_dados, 'whatsapp') end,
                                     email = case when v_escopo = 'CONTATO' then lower(comercial_texto(p_dados, 'email')) end,
                                     autorizacao_texto = comercial_texto(p_dados, 'autorizacaoTexto'), caso_texto = comercial_texto(p_dados, 'casoTexto'),
                                     caso_uso_desde = (p_dados ->> 'casoUsoDesde')::date, caso_medido_em = (p_dados ->> 'casoMedidoEm')::date,
                                     alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id and versao = p_versao
    returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('referencias_comercial', p_id); end if;
  end if;
  perform registrar_historico_interno('comercial.referencia', 'referencia_comercial', v_id::text, jsonb_build_object('escopo', v_escopo));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- Retirar a autorização (CM-28): apaga o contato e a referência some do link e do kit.
create function comercial_retirar_referencia(p_pessoa uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Diga como o síndico pediu para sair', 'motivo'); end if;
  update referencias_comercial set retirada_em = app_now(), retirada_por = p_pessoa, retirada_motivo = btrim(p_motivo), whatsapp = null, email = null,
                                   alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('referencias_comercial', p_id); end if;
  perform registrar_historico_interno('comercial.referencia_retirada', 'referencia_comercial', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- LGPD (CM-12): a anonimização do interessado também apaga o nome, o CPF e o IP do aceite e a
-- nota interna das versões. Mesmo corpo da 0296, com as propostas no fim.

create or replace function comercial_anonimizar(p_id uuid, p_resumo text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('app.comercial_sistema', 'on', true);
  update interessados set nome_contato = null, papel_contato = null, whatsapp = null, email = null, cnpj = null, endereco = null,
         optin_em = null, optin_canal = null, optin_texto = null, observacao = null, perda_detalhe = null, decisor = null, visita_nota = null,
         proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null,
         cadencia_fim_em = case when cadencia_id is not null then coalesce(cadencia_fim_em, app_now()) end,
         cadencia_fim_motivo = case when cadencia_id is not null then coalesce(cadencia_fim_motivo, 'NAO_CONTATAR') end,
         anonimizado_em = app_now()
   where id = p_id;
  update conversas_comercial set resumo = p_resumo where interessado_id = p_id;
  update aceites_proposta a set nome = null, cpf = null, ip = null, aparelho = null, anonimizado_em = app_now()
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.anonimizado_em is null;
  update versoes_proposta v set nota_interna = null
    from propostas_comercial p
   where p.id = v.proposta_id and p.interessado_id = p_id and v.nota_interna is not null;
  update links_proposta l set revogado_em = app_now(), revogado_motivo = 'Dados apagados (LGPD)'
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where l.versao_id = v.id and p.interessado_id = p_id and l.revogado_em is null;
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Quem está no Console: as ações do menu, agora com a aprovação de desconto. A lista leva as
-- da 0295, 0296 e 0301, para nenhuma frente apagar a da outra.

create or replace function console_sessao(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then
    raise exception 'Só a equipe TRÍADE' using errcode = 'TC401';
  end if;
  select jsonb_build_object(
    'pessoaId', p.id,
    'nome', p.nome,
    'funcoes', to_jsonb(contexto_equipe_funcoes()),
    'acoes', coalesce((select jsonb_agg(distinct fa.acao order by fa.acao) from funcao_acoes fa
                        where fa.funcao = any (contexto_equipe_funcoes())
                          and fa.acao in ('console.condominios.criar', 'console.equipe.gerenciar', 'console.historico.equipe',
                                          'console.pagamentos.ver', 'console.pagamentos.registrar',
                                          'console.precos.ver', 'console.precos.editar',
                                          'console.retencao.ver', 'console.retencao.ligar',
                                          'console.comercial.ver', 'console.comercial.editar', 'console.comercial.modelos',
                                          'console.comercial.exportar', 'console.comercial.excluir', 'console.comercial.desconto')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

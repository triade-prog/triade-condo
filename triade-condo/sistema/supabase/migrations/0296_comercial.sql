-- 0296 · Comercial no Console, primeira rodada (R17.1 e R17.2; IDEIAS seção 23; desenho dos
-- quadros 320 a 348 aprovado pela Carolina em 24/10/2026; banco autorizado por escrito em
-- 24/10/2026). Os interessados (quem pediu demonstração ou falou com a TRÍADE e ainda não é
-- cliente) ficam no Console, numa área só da equipe; o síndico nunca vê.
--
-- R17.1 · entrada e cuidado com os dados
-- CM-01 O pedido de demonstração do site entra sozinho como Novo, origem Site. O mesmo
--       WhatsApp (+55), e-mail ou CNPJ junta no mesmo interessado, como conversa. A primeira
--       origem e as UTM nunca são sobrescritas (gatilho).
-- CM-02 Origens à mão (WhatsApp comercial, Instagram, indicação, parceiro, construtora,
--       cotação, evento, outro). Cotação (oHub, CoteiBem) tem primeiro retorno em 24 horas;
--       as outras, 1 hora útil (K.1).
-- CM-12 LGPD: site entra com consentimento; à mão e planilha, com legítimo interesse
--       documentado. O opt-in do WhatsApp guarda data, canal e texto. Lista de não contatar.
--       Perdido sem conversa há 12 meses é anonimizado (rotina diária). Exportar e apagar a
--       pedido só pela Administração, com registro no histórico.
-- CM-24 Importar planilha: duplicados por CNPJ, endereço, WhatsApp e e-mail; nada entra até
--       decidir juntar ou criar; o lote guarda a origem e a base legal.
--
-- R17.2 · funil e rotina
-- CM-03 Etapas fixas, com a chance de fechar de cada uma; Perdido pede o motivo.
-- CM-04 Responsável, próximo passo e data; ordem: atrasados, hoje, sem próximo passo, futuros.
--       Meu dia por pessoa.
-- CM-05 Conversas: só inserção; corrigir é registrar outra.
-- CM-11 Função Comercial: vê e edita só o Comercial. Não muda plano, pagamento nem liberação
--       e não vê dado de condomínio (não pode ser atribuída a cliente).
-- CM-14 Negócio parado: cada etapa tem um limite de dias; só uma conversa zera o contador.
-- CM-15 Mensagens prontas por etapa; a tela abre o WhatsApp e a conversa fica registrada.
--       Nada sai sozinho.
-- CM-16 Ficha do prédio: administradora e o app dela, sistema atual e fidelidade, assembleia
--       ordinária, mandato, quem decide e a visita.
-- CM-17 Objeções de uma lista fechada, com resposta pronta; concorrentes na disputa, com o
--       preço e quem ganhou.
-- CM-25 A etapa só avança com o que ela pede (data da demonstração; faixa antes da proposta;
--       quem decide e a data da reunião antes da Aprovação no condomínio).
-- CM-26 Cadências: passos com dias, por tipo de interessado; viram tarefas no Meu dia, param
--       quando a pessoa responde e nunca enviam nada sozinhas (R.1).
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- A função Comercial e quem pode o quê (CM-11).

insert into funcoes (codigo, nome, sistema) values ('COMERCIAL', 'Comercial', 'CONSOLE');

insert into funcao_acoes (funcao, acao) values
  ('COMERCIAL', 'console.comercial.ver'),
  ('COMERCIAL', 'console.comercial.editar'),
  ('ADMINISTRACAO', 'console.comercial.ver'),
  ('ADMINISTRACAO', 'console.comercial.editar'),
  ('ADMINISTRACAO', 'console.comercial.modelos'),
  ('ADMINISTRACAO', 'console.comercial.exportar'),
  ('ADMINISTRACAO', 'console.comercial.excluir');

-- O Comercial não cuida de cliente: não entra na atribuição (e, sem vínculo, não vê condomínio).
create function vinculos_sem_comercial() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.funcao = 'COMERCIAL' then
    raise exception 'A função Comercial não é atribuída a cliente' using errcode = 'TC422', detail = '{"motivo":"COMERCIAL_SEM_CLIENTE"}';
  end if;
  return new;
end $$;
create trigger vinculos_sem_comercial before insert on vinculos for each row execute function vinculos_sem_comercial();

-- Pedidos do site pelo mesmo WhatsApp: até 5 por hora (o resto volta como limite).
insert into configuracoes (chave, valor, descricao) values
  ('limite_site_max', '5', 'Pedidos de demonstração do site pelo mesmo WhatsApp dentro da janela'),
  ('limite_site_janela_minutos', '60', 'Janela dos pedidos de demonstração do site');

-- Rotinas sem pessoa (a entrada do site e a anonimização) ligam esta marca só na transação.
create function comercial_sistema() returns boolean
language sql stable
set search_path = public
as $$ select coalesce(current_setting('app.comercial_sistema', true), '') = 'on' $$;

create procedure proteger_tabela_comercial(p_tabela regclass, p_escrita text, p_motivo text)
language plpgsql
set search_path = public
as $$
begin
  execute format('alter table %s enable row level security', p_tabela);
  execute format('alter table %s force row level security', p_tabela);
  if not exists (select 1 from pg_policy where polrelid = p_tabela and polname = 'so_comercial') then
    execute format('create policy so_comercial on %s using (comercial_sistema() or (contexto_equipe() and pode_global(''console.comercial.ver''))) '
                   'with check (comercial_sistema() or (contexto_equipe() and pode_global(%L)))', p_tabela, p_escrita);
  end if;
  if exists (select 1 from pg_attribute where attrelid = p_tabela and attname = 'versao' and not attisdropped)
     and not exists (select 1 from pg_trigger where tgrelid = p_tabela and tgname = 'controle_versao') then
    execute format('create trigger controle_versao before update on %s for each row execute function controle_versao()', p_tabela);
  end if;
  insert into tabelas_sem_condominio (tabela, motivo) values (p_tabela::text, p_motivo)
  on conflict (tabela) do update set motivo = excluded.motivo;
end $$;

-- Texto para comparar endereço e nome: sem acento, sem espaço e sem pontuação.
create function comercial_normalizar(p text) returns text
language sql immutable
set search_path = public
as $$
  select nullif(regexp_replace(translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g'), '')
$$;

-- WhatsApp mascarado para a lista: (61) 9 ••••-0412.
create function comercial_mascarar(p_whatsapp text) returns text
language sql immutable
set search_path = public
as $$
  select case when p_whatsapp ~ '^55[0-9]{10,11}$' then
    '(' || substr(p_whatsapp, 3, 2) || ') ' || case when length(p_whatsapp) = 13 then substr(p_whatsapp, 5, 1) || ' ' else '' end
    || '••••-' || right(p_whatsapp, 4) end
$$;

-- Meta interna de primeiro retorno (K.1): 1 hora útil, de segunda a sexta, das 9h às 18h de
-- Brasília. Feriado não entra na conta.
create function comercial_hora_util(p_de timestamptz, p_horas integer default 1) returns timestamptz
language plpgsql stable
set search_path = public
as $$
declare
  v timestamp := p_de at time zone 'America/Sao_Paulo';
  v_resto interval := make_interval(hours => p_horas);
  v_fim timestamp;
begin
  loop
    if extract(isodow from v) in (6, 7) then
      v := date_trunc('day', v) + interval '1 day 9 hours';
      continue;
    end if;
    if v::time < time '09:00' then v := date_trunc('day', v) + interval '9 hours'; end if;
    if v::time >= time '18:00' then
      v := date_trunc('day', v) + interval '1 day 9 hours';
      continue;
    end if;
    v_fim := date_trunc('day', v) + interval '18 hours';
    if v + v_resto <= v_fim then
      return (v + v_resto) at time zone 'America/Sao_Paulo';
    end if;
    v_resto := v_resto - (v_fim - v);
    v := date_trunc('day', v) + interval '1 day 9 hours';
  end loop;
end $$;

-- O evento interno do Comercial não tem condomínio: quem vê o Comercial também o lê (sem isso,
-- o Comercial não grava o evento). O resto fica como na 0295.
alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial')
             and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- Etapas (CM-03, CM-14): fixas; a equipe corrige só a chance de fechar e o limite de dias.

create table parametros_etapa_comercial (
  id            uuid primary key default gen_random_uuid(),
  etapa         text not null unique check (etapa in ('NOVO', 'EM_CONTATO', 'DEMO_MARCADA', 'DEMO_FEITA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO',
                                                      'APROVACAO', 'GANHO', 'PERDIDO', 'SEM_RESPOSTA')),
  ordem         integer not null unique,
  aberta        boolean not null,
  probabilidade integer not null check (probabilidade between 0 and 100),
  limite_dias   integer check (limite_dias between 1 and 365),
  alterado_em   timestamptz,
  alterado_por  uuid references pessoas (id),
  versao        integer not null default 1,
  check (aberta or limite_dias is null)
);
insert into parametros_etapa_comercial (etapa, ordem, aberta, probabilidade, limite_dias) values
  ('NOVO', 1, true, 5, 2),
  ('EM_CONTATO', 2, true, 10, 5),
  ('DEMO_MARCADA', 3, true, 30, 7),
  ('DEMO_FEITA', 4, true, 30, 5),
  ('PROPOSTA_ENVIADA', 5, true, 50, 7),
  ('NEGOCIACAO', 6, true, 65, 10),
  ('APROVACAO', 7, true, 80, 30),
  ('GANHO', 8, false, 100, null),
  ('PERDIDO', 9, false, 0, null),
  ('SEM_RESPOSTA', 10, false, 0, null);
call proteger_tabela_comercial('parametros_etapa_comercial', 'console.comercial.modelos',
  'Etapas fixas do funil comercial, com a chance de fechar e o limite de dias sem conversa');
create trigger parametros_etapa_comercial_sem_exclusao before delete on parametros_etapa_comercial for each row execute function somente_insercao();

create function parametros_etapa_comercial_fixos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.etapa, new.ordem, new.aberta) is distinct from (old.id, old.etapa, old.ordem, old.aberta)
     or (not new.aberta and new.limite_dias is not null) then
    raise exception 'As etapas são fixas; mude só a chance e o limite de dias' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger parametros_etapa_comercial_fixos before update on parametros_etapa_comercial
  for each row execute function parametros_etapa_comercial_fixos();

-- Objeções (CM-17): lista fechada, com a resposta pronta.
create table objecoes_comercial (
  id       uuid primary key default gen_random_uuid(),
  codigo   text not null unique check (codigo ~ '^[A-Z][A-Z_]{2,39}$'),
  ordem    integer not null unique,
  texto    text not null check (length(btrim(texto)) between 3 and 80),
  resposta text not null check (length(btrim(resposta)) between 10 and 600)
);
insert into objecoes_comercial (codigo, ordem, texto, resposta) values
  ('AUMENTA_TAXA', 1, 'Vai aumentar a taxa', 'Custa poucos reais por apartamento por mês e evita retrabalho, multa e conserto repetido. O simulador mostra o valor por apartamento.'),
  ('MORADORES_IDOSOS', 2, 'Moradores idosos', 'O morador usa pelo WhatsApp, sem baixar aplicativo. Quem preferir continua falando com a portaria ou com o síndico.'),
  ('ADMINISTRADORA_TEM_APP', 3, 'A administradora já tem app', 'O app da administradora cuida do boleto. A TRÍADE cuida do dia a dia do síndico: pedidos, manutenção, avisos e registro de tudo.'),
  ('CONTRATO_VIGENTE', 4, 'Contrato com outro sistema', 'A troca pode ser marcada para o fim da fidelidade atual. A implantação traz os cadastros e os documentos.'),
  ('PRECISA_ASSEMBLEIA', 5, 'Precisa de assembleia', 'Mandamos o kit do conselho: comparativo, valor por apartamento e o texto para a pauta e a ata.'),
  ('DADOS_MORADORES', 6, 'Medo de expor os dados dos moradores', 'Cada condomínio só vê os próprios dados, com registro de quem acessou. A TRÍADE segue a LGPD e só entra com autorização do síndico.'),
  ('SEM_PRIORIDADE', 7, 'Não é prioridade agora', 'Combinamos uma data para voltar a falar, perto da assembleia ou do fim do mandato.'),
  ('ACHOU_CARO', 8, 'Achou caro', 'Comparar o valor por apartamento e o que já se gasta com planilha, grupo de WhatsApp e retrabalho. O preço de fundador vale 12 meses.');
call proteger_tabela_comercial('objecoes_comercial', 'console.comercial.modelos', 'Lista fechada de objeções do comercial, com a resposta pronta');
create trigger objecoes_comercial_sem_exclusao before delete on objecoes_comercial for each row execute function somente_insercao();

-- Mensagens prontas por etapa (CM-15). Campos entre colchetes: [nome], [condominio], [pessoa].
create table mensagens_comercial (
  id           uuid primary key default gen_random_uuid(),
  etapa        text not null references parametros_etapa_comercial (etapa),
  titulo       text not null check (length(btrim(titulo)) between 3 and 60),
  texto        text not null check (length(btrim(texto)) between 10 and 1000),
  ativa        boolean not null default true,
  criado_em    timestamptz not null default app_now(),
  criado_por   uuid references pessoas (id),
  alterado_em  timestamptz,
  alterado_por uuid references pessoas (id),
  versao       integer not null default 1
);
insert into mensagens_comercial (etapa, titulo, texto) values
  ('NOVO', 'Primeiro retorno', 'Oi, [nome]! Aqui é [pessoa], da TRÍADE. Recebi o seu pedido de demonstração para o [condominio]. Qual o melhor dia e horário para mostrarmos o sistema?'),
  ('EM_CONTATO', 'Marcar a demonstração', 'Oi, [nome]! Conseguimos marcar a demonstração do [condominio]? Leva 30 minutos, por vídeo, e pode chamar o conselho.'),
  ('DEMO_MARCADA', 'Confirmar a demonstração', 'Oi, [nome]! Confirmando a demonstração do [condominio]. Mando o link da chamada um pouco antes.'),
  ('DEMO_FEITA', 'Resumo da demonstração', 'Oi, [nome]! Obrigado pela conversa. Vou preparar a proposta do [condominio] e mando ainda hoje.'),
  ('PROPOSTA_ENVIADA', 'Lembrar da proposta', 'Oi, [nome]! Conseguiu olhar a proposta do [condominio]? Fico à disposição para tirar dúvidas.'),
  ('NEGOCIACAO', 'Mandar o kit do conselho', 'Oi, [nome]! Para levar ao conselho, preparei um resumo com o comparativo e o valor por apartamento do [condominio].'),
  ('APROVACAO', 'Confirmar a assembleia', 'Oi, [nome]! A proposta da TRÍADE entrou na pauta da reunião do [condominio]? Posso ajudar com o texto para a ata.');
call proteger_tabela_comercial('mensagens_comercial', 'console.comercial.modelos', 'Mensagens prontas do comercial por etapa; a tela abre o WhatsApp, nada sai sozinho');
create trigger mensagens_comercial_sem_exclusao before delete on mensagens_comercial for each row execute function somente_insercao();

-- Cadências (CM-26): passos com dias, que viram tarefas. Nunca enviam nada sozinhas (R.1).
create function passos_cadencia_validos(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 10
     and not exists (
       select 1 from jsonb_array_elements(p) with ordinality e(s, i)
        where jsonb_typeof(s) <> 'object'
           or exists (select 1 from jsonb_object_keys(s) k where k not in ('dia', 'canal', 'texto'))
           or coalesce(s ->> 'dia', '') !~ '^[0-9]{1,2}$'
           or coalesce(s ->> 'canal', '') not in ('WHATSAPP', 'LIGACAO', 'EMAIL')
           or length(btrim(coalesce(s ->> 'texto', ''))) not between 3 and 1000
           or (i > 1 and (p -> (i::int - 2) ->> 'dia') ~ '^[0-9]{1,2}$' and (s ->> 'dia')::int <= (p -> (i::int - 2) ->> 'dia')::int))
$$;

create table cadencias_comercial (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null unique check (length(btrim(nome)) between 3 and 60),
  gatilho              text not null references parametros_etapa_comercial (etapa),
  origem               text check (origem in ('SITE', 'WHATSAPP_COMERCIAL', 'INSTAGRAM', 'INDICACAO', 'PARCEIRO', 'CONSTRUTORA', 'COTACAO',
                                              'EVENTO', 'IMPORTACAO', 'OUTRO')),
  passos               jsonb not null check (passos_cadencia_validos(passos)),
  termina_sem_resposta boolean not null default false,
  ativa                boolean not null default true,
  criado_em            timestamptz not null default app_now(),
  criado_por           uuid references pessoas (id),
  alterado_em          timestamptz,
  alterado_por         uuid references pessoas (id),
  versao               integer not null default 1
);
create unique index cadencias_comercial_uma_por_gatilho on cadencias_comercial (gatilho, coalesce(origem, '')) where ativa;
insert into cadencias_comercial (nome, gatilho, origem, passos, termina_sem_resposta) values
  ('Novo pelo site', 'NOVO', 'SITE', '[
     {"dia": 0, "canal": "WHATSAPP", "texto": "Oi, [nome]! Aqui é [pessoa], da TRÍADE. Recebi o seu pedido de demonstração para o [condominio]. Qual o melhor horário?"},
     {"dia": 1, "canal": "LIGACAO", "texto": "Ligar para marcar a demonstração."},
     {"dia": 3, "canal": "WHATSAPP", "texto": "Oi, [nome]! Ainda quer ver a TRÍADE funcionando no [condominio]? Leva 30 minutos."},
     {"dia": 7, "canal": "WHATSAPP", "texto": "Vou encerrar por aqui para não incomodar. Se quiser retomar, é só responder esta mensagem."}]', false),
  ('Depois da demonstração', 'DEMO_FEITA', null, '[
     {"dia": 0, "canal": "WHATSAPP", "texto": "Oi, [nome]! Obrigado pela conversa. Mando o resumo do que vimos e a proposta do [condominio]."},
     {"dia": 2, "canal": "WHATSAPP", "texto": "Mandar a proposta, se ainda não foi."},
     {"dia": 5, "canal": "LIGACAO", "texto": "Ligar para tirar dúvidas da proposta."}]', false),
  ('Depois da proposta', 'PROPOSTA_ENVIADA', null, '[
     {"dia": 0, "canal": "WHATSAPP", "texto": "Oi, [nome]! Aqui é [pessoa], da TRÍADE. Mandei a proposta do [condominio]. Fico à disposição para tirar dúvidas."},
     {"dia": 3, "canal": "LIGACAO", "texto": "Perguntar se a proposta foi ao conselho e quando é a próxima reunião."},
     {"dia": 7, "canal": "WHATSAPP", "texto": "Posso ajudar a levar ao conselho? Tenho um resumo com o comparativo e o texto para a ata."},
     {"dia": 14, "canal": "WHATSAPP", "texto": "Vou encerrar por aqui para não incomodar. Se quiser retomar, é só responder esta mensagem."}]', true);
call proteger_tabela_comercial('cadencias_comercial', 'console.comercial.modelos', 'Cadências do comercial: passos que viram tarefas no Meu dia; nada sai sozinho');
create trigger cadencias_comercial_sem_exclusao before delete on cadencias_comercial for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Lotes de importação (CM-24) e lista de não contatar (CM-12).

create table lotes_comercial (
  id               uuid primary key default gen_random_uuid(),
  arquivo          text not null check (length(btrim(arquivo)) between 1 and 200),
  origem_texto     text not null check (length(btrim(origem_texto)) between 3 and 200),
  base_legal_texto text not null check (length(btrim(base_legal_texto)) between 10 and 1000),
  linhas           integer not null check (linhas between 0 and 2000),
  criados          integer not null check (criados >= 0),
  juntados         integer not null check (juntados >= 0),
  bloqueados       integer not null check (bloqueados >= 0),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid not null references pessoas (id)
);
call proteger_tabela_comercial('lotes_comercial', 'console.comercial.editar', 'Lotes de planilha importados no comercial, com a origem e a base legal');
create trigger lotes_comercial_sem_exclusao before delete on lotes_comercial for each row execute function somente_insercao();

-- O lote só muda na própria importação, para gravar os totais.
create function lotes_comercial_fixos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not comercial_sistema() or (new.id, new.arquivo, new.origem_texto, new.base_legal_texto, new.linhas, new.criado_em, new.criado_por)
     is distinct from (old.id, old.arquivo, old.origem_texto, old.base_legal_texto, old.linhas, old.criado_em, old.criado_por) then
    raise exception 'Lote importado não muda' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger lotes_comercial_fixos before update on lotes_comercial for each row execute function lotes_comercial_fixos();

create table nao_contatar (
  id         uuid primary key default gen_random_uuid(),
  whatsapp   text check (whatsapp ~ '^55[0-9]{10,11}$'),
  email      text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cnpj       text check (cnpj ~ '^[0-9]{14}$'),
  motivo     text not null check (motivo in ('PEDIU', 'EXCLUSAO', 'EQUIPE')),
  observacao text check (length(observacao) <= 300),
  criado_em  timestamptz not null default app_now(),
  criado_por uuid references pessoas (id),
  check (num_nonnulls(whatsapp, email, cnpj) >= 1)
);
create index nao_contatar_whatsapp on nao_contatar (whatsapp) where whatsapp is not null;
create index nao_contatar_email on nao_contatar (email) where email is not null;
call proteger_tabela_comercial('nao_contatar', 'console.comercial.editar', 'Lista de não contatar do comercial (LGPD); entra pela equipe ou pelo pedido de exclusão');
create trigger nao_contatar_somente_insercao before update or delete on nao_contatar for each row execute function somente_insercao();

create function comercial_nao_contatar_tem(p_whatsapp text, p_email text, p_cnpj text) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from nao_contatar n
                  where (p_whatsapp is not null and n.whatsapp = p_whatsapp)
                     or (p_email is not null and n.email = lower(p_email))
                     or (p_cnpj is not null and n.cnpj = p_cnpj))
$$;

-- ---------------------------------------------------------------------------------------
-- Interessados.

create table interessados (
  id                   uuid primary key default gen_random_uuid(),
  -- Contato
  nome_contato         text check (length(btrim(nome_contato)) between 2 and 80),
  papel_contato        text check (papel_contato in ('SINDICO', 'SUBSINDICO', 'CONSELHEIRO', 'SINDICO_PROFISSIONAL', 'ADMINISTRADORA', 'MORADOR', 'OUTRO')),
  whatsapp             text check (whatsapp ~ '^55[0-9]{10,11}$'),
  email                text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  -- Condomínio
  condominio           text not null check (length(btrim(condominio)) between 2 and 120),
  cnpj                 text check (cnpj ~ '^[0-9]{14}$'),
  endereco             text check (length(btrim(endereco)) between 3 and 200),
  cidade               text check (length(btrim(cidade)) between 2 and 80),
  uf                   char(2) check (uf ~ '^[A-Z]{2}$'),
  faixa                text check (faixa in ('ATE_40', 'DE_41_A_100', 'DE_101_A_200', 'DE_201_A_400', 'ACIMA_DE_400')),
  unidades             integer check (unidades between 1 and 20000),
  -- Origem (CM-01, CM-02): nunca muda depois de gravada.
  origem               text not null check (origem in ('SITE', 'WHATSAPP_COMERCIAL', 'INSTAGRAM', 'INDICACAO', 'PARCEIRO', 'CONSTRUTORA', 'COTACAO',
                                                        'EVENTO', 'IMPORTACAO', 'OUTRO')),
  origem_detalhe       text check (length(btrim(origem_detalhe)) between 1 and 200),
  utm                  jsonb check (utm is null or (jsonb_typeof(utm) = 'object' and length(utm::text) <= 1000)),
  lote_id              uuid references lotes_comercial (id),
  -- Base legal e WhatsApp (CM-12, P.1)
  base_legal           text not null check (base_legal in ('CONSENTIMENTO', 'LEGITIMO_INTERESSE')),
  base_legal_texto     text not null check (length(btrim(base_legal_texto)) between 10 and 1000),
  base_legal_em        timestamptz not null default app_now(),
  optin_em             timestamptz,
  optin_canal          text check (optin_canal in ('SITE', 'WHATSAPP', 'LIGACAO', 'EMAIL', 'PRESENCIAL')),
  optin_texto          text check (length(btrim(optin_texto)) between 3 and 500),
  -- Funil (CM-03, CM-04)
  etapa                text not null default 'NOVO' references parametros_etapa_comercial (etapa),
  etapa_desde          timestamptz not null default app_now(),
  responsavel_id       uuid references pessoas (id),
  proximo_passo        text check (length(btrim(proximo_passo)) between 2 and 200),
  proximo_passo_data   date,
  proximo_passo_hora   time,
  primeiro_retorno_ate timestamptz,
  primeira_resposta_em timestamptz,
  ultima_conversa_em   timestamptz,
  demonstracao_em      timestamptz,
  -- Prédio (CM-16)
  administradora       text check (length(btrim(administradora)) between 2 and 120),
  app_administradora   boolean,
  sistema_atual        text check (length(btrim(sistema_atual)) between 2 and 120),
  fidelidade_ate       date,
  assembleia_ordinaria date,
  mandato_ate          date,
  decisor              text check (length(btrim(decisor)) between 2 and 300),
  decisao_em           date,
  visita_em            date,
  visita_nota          text check (length(btrim(visita_nota)) between 2 and 500),
  -- Objeções e concorrentes (CM-17)
  objecoes             text[] not null default '{}',
  concorrentes         jsonb not null default '[]' check (jsonb_typeof(concorrentes) = 'array' and jsonb_array_length(concorrentes) <= 10),
  -- Perda (CM-03)
  motivo_perda         text check (motivo_perda in ('PRECO', 'OUTRO_SISTEMA', 'ASSEMBLEIA_NAO_APROVOU', 'FICOU_PARA_DEPOIS', 'NAO_RESPONDEU',
                                                    'FORA_DO_PERFIL', 'OUTRO')),
  perda_detalhe        text check (length(btrim(perda_detalhe)) between 2 and 500),
  vencedor             text check (length(btrim(vencedor)) between 2 and 80),
  retomar_em           date,
  -- Cadência (CM-26)
  cadencia_id          uuid references cadencias_comercial (id),
  cadencia_inicio      date,
  cadencia_feitos      integer not null default 0 check (cadencia_feitos between 0 and 10),
  cadencia_fim_em      timestamptz,
  cadencia_fim_motivo  text check (cadencia_fim_motivo in ('RESPONDEU', 'CONCLUIDA', 'PARADA', 'ETAPA', 'NAO_CONTATAR')),
  observacao           text check (length(btrim(observacao)) between 2 and 1000),
  anonimizado_em       timestamptz,
  criado_em            timestamptz not null default app_now(),
  criado_por           uuid references pessoas (id),
  alterado_em          timestamptz,
  alterado_por         uuid references pessoas (id),
  versao               integer not null default 1,
  check ((proximo_passo is null) = (proximo_passo_data is null)),
  check (proximo_passo_hora is null or proximo_passo_data is not null),
  check ((optin_em is null) = (optin_canal is null) and (optin_em is null) = (optin_texto is null)),
  check ((etapa = 'PERDIDO') = (motivo_perda is not null)),
  check ((cadencia_id is null) = (cadencia_inicio is null)),
  check (anonimizado_em is not null or nome_contato is not null or whatsapp is not null or email is not null or origem = 'IMPORTACAO')
);
create index interessados_whatsapp on interessados (whatsapp) where whatsapp is not null;
create index interessados_email on interessados (email) where email is not null;
create index interessados_cnpj on interessados (cnpj) where cnpj is not null;
create index interessados_etapa on interessados (etapa);
call proteger_tabela_comercial('interessados', 'console.comercial.editar', 'Interessados do comercial: quem ainda não é cliente; só a equipe com o Comercial vê');
create trigger interessados_sem_exclusao before delete on interessados for each row execute function somente_insercao();

-- A primeira origem, as UTM e o lote nunca mudam (CM-01). A objeção vem da lista fechada.
create function interessados_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.origem, new.origem_detalhe, new.utm, new.lote_id, new.criado_em, new.criado_por, new.base_legal_em)
     is distinct from (old.origem, old.origem_detalhe, old.utm, old.lote_id, old.criado_em, old.criado_por, old.base_legal_em) then
    raise exception 'A origem do interessado não muda' using errcode = 'TC422', detail = '{"motivo":"ORIGEM_FIXA"}';
  end if;
  if tg_op = 'UPDATE' and old.anonimizado_em is not null and not comercial_sistema() then
    raise exception 'Interessado anonimizado não muda' using errcode = 'TC422', detail = '{"motivo":"ANONIMIZADO"}';
  end if;
  if exists (select 1 from unnest(new.objecoes) o where not exists (select 1 from objecoes_comercial where codigo = o)) then
    perform recusar_campos('Escolha as objeções da lista', 'objecoes');
  end if;
  if exists (select 1 from jsonb_array_elements(new.concorrentes) c
              where jsonb_typeof(c) <> 'object'
                 or exists (select 1 from jsonb_object_keys(c) k where k not in ('nome', 'preco', 'venceu'))
                 or length(btrim(coalesce(c ->> 'nome', ''))) not between 2 and 80
                 or (c ? 'preco' and jsonb_typeof(c -> 'preco') <> 'null' and coalesce(c ->> 'preco', '') !~ '^[1-9][0-9]{0,9}$')
                 or (c ? 'venceu' and jsonb_typeof(c -> 'venceu') <> 'boolean')) then
    perform recusar_campos('Confira os concorrentes', 'concorrentes');
  end if;
  return new;
end $$;
create trigger interessados_regras before insert or update on interessados for each row execute function interessados_regras();

-- Conversas (CM-05): só inserção. A anonimização é a única que reescreve o resumo.
create table conversas_comercial (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  canal          text not null check (canal in ('ENTRADA', 'WHATSAPP', 'LIGACAO', 'EMAIL', 'REUNIAO', 'DEMONSTRACAO', 'VISITA', 'PROPOSTA', 'NOTA', 'OUTRO')),
  resumo         text not null check (length(btrim(resumo)) between 2 and 2000),
  respondeu      boolean not null default false,
  mensagem_id    uuid references mensagens_comercial (id),
  cadencia_passo integer check (cadencia_passo between 1 and 10),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id)
);
create index conversas_comercial_interessado on conversas_comercial (interessado_id, criado_em desc);
call proteger_tabela_comercial('conversas_comercial', 'console.comercial.editar', 'Conversas com os interessados do comercial; só inserção');

create function conversas_comercial_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or not comercial_sistema()
     or (new.id, new.interessado_id, new.canal, new.criado_em, new.criado_por) is distinct from (old.id, old.interessado_id, old.canal, old.criado_em, old.criado_por) then
    raise exception 'Conversa não se altera nem se apaga; registre outra' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger conversas_comercial_fixas before update or delete on conversas_comercial for each row execute function conversas_comercial_fixas();

-- Mudanças de etapa, para a linha do tempo e para o painel (só inserção).
create table etapas_interessado (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  de             text references parametros_etapa_comercial (etapa),
  para           text not null references parametros_etapa_comercial (etapa),
  motivo_perda   text,
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id)
);
create index etapas_interessado_interessado on etapas_interessado (interessado_id, criado_em);
call proteger_tabela_comercial('etapas_interessado', 'console.comercial.editar', 'Mudanças de etapa dos interessados do comercial; só inserção');
create trigger etapas_interessado_somente_insercao before update or delete on etapas_interessado for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- Regras do funil.

create function comercial_aberta(p_etapa text) returns boolean
language sql stable
set search_path = public
as $$ select coalesce((select aberta from parametros_etapa_comercial where etapa = p_etapa), false) $$;

-- O que falta para a etapa (CM-25).
create function comercial_falta(i interessados, p_etapa text) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when p_etapa in ('DEMO_MARCADA', 'DEMO_FEITA') and i.demonstracao_em is null then 'demonstracaoEm' end,
    case when p_etapa in ('PROPOSTA_ENVIADA', 'NEGOCIACAO', 'APROVACAO', 'GANHO') and i.faixa is null then 'faixa' end,
    case when p_etapa in ('APROVACAO', 'GANHO') and i.decisor is null then 'decisor' end,
    case when p_etapa in ('APROVACAO', 'GANHO') and i.decisao_em is null then 'decisaoEm' end
  ], null)
$$;

-- A tarefa da vez (CM-04, CM-14, CM-26): primeiro retorno, próximo passo ou passo da cadência,
-- o que vencer antes; e se o negócio está parado.
create function comercial_tarefa(i interessados) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_agora  timestamptz := app_now();
  v_hoje   date := (app_now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz;
  v_tipo   text;
  v_texto  text;
  v_canal  text;
  v_c      timestamptz;
  v_passos jsonb;
  v_passo  jsonb;
  v_lim    integer;
  v_ref    timestamptz;
  v_parado integer;
begin
  if not comercial_aberta(i.etapa) or i.anonimizado_em is not null then
    return jsonb_build_object('situacao', 'FECHADO');
  end if;
  if i.primeira_resposta_em is null and i.primeiro_retorno_ate is not null then
    v_quando := i.primeiro_retorno_ate; v_tipo := 'PRIMEIRO_RETORNO'; v_texto := 'Primeiro retorno';
  end if;
  if i.proximo_passo is not null then
    v_c := (i.proximo_passo_data + coalesce(i.proximo_passo_hora, time '23:59:59')) at time zone 'America/Sao_Paulo';
    if v_quando is null or v_c < v_quando then v_quando := v_c; v_tipo := 'PROXIMO_PASSO'; v_texto := i.proximo_passo; v_canal := null; end if;
  end if;
  if i.cadencia_id is not null and i.cadencia_fim_em is null then
    select passos into v_passos from cadencias_comercial where id = i.cadencia_id;
    v_passo := v_passos -> i.cadencia_feitos;
    if v_passo is not null then
      v_c := ((i.cadencia_inicio + (v_passo ->> 'dia')::integer) + time '23:59:59') at time zone 'America/Sao_Paulo';
      if v_quando is null or v_c < v_quando then
        v_quando := v_c; v_tipo := 'CADENCIA'; v_texto := v_passo ->> 'texto'; v_canal := v_passo ->> 'canal';
      end if;
    end if;
  end if;
  select limite_dias into v_lim from parametros_etapa_comercial where etapa = i.etapa;
  v_ref := coalesce(i.ultima_conversa_em, i.criado_em);
  if v_lim is not null and v_agora - v_ref > make_interval(days => v_lim) then
    v_parado := v_hoje - (v_ref at time zone 'America/Sao_Paulo')::date;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'situacao', case when v_quando is null then 'SEM_PASSO'
                     when v_quando < v_agora then 'ATRASADO'
                     when (v_quando at time zone 'America/Sao_Paulo')::date = v_hoje then 'HOJE'
                     else 'FUTURO' end,
    'tarefa', v_tipo,
    'texto', v_texto,
    'canal', v_canal,
    'quando', v_quando,
    'passo', case when v_tipo = 'CADENCIA' then i.cadencia_feitos + 1 end,
    'passos', case when v_tipo = 'CADENCIA' then jsonb_array_length(v_passos) end,
    'diasParado', v_parado));
end $$;

-- Pede atenção: atrasado, primeiro retorno vencendo hoje ou negócio parado.
create function comercial_atencao(p_tarefa jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select p_tarefa ->> 'situacao' = 'ATRASADO' or p_tarefa ? 'diasParado'
      or (p_tarefa ->> 'tarefa' = 'PRIMEIRO_RETORNO' and p_tarefa ->> 'situacao' = 'HOJE')
$$;

create function comercial_ordem(p_tarefa jsonb) returns integer
language sql immutable
set search_path = public
as $$ select case p_tarefa ->> 'situacao' when 'ATRASADO' then 1 when 'HOJE' then 2 when 'SEM_PASSO' then 3 when 'FUTURO' then 4 else 5 end $$;

-- Pessoa da equipe que pode ser responsável: ativa, com Comercial ou Administração.
create function comercial_exigir_responsavel(p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_pessoa is not null and not exists (
    select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
     where e.pessoa_id = p_pessoa and e.ativa and ef.retirada_em is null and ef.funcao in ('COMERCIAL', 'ADMINISTRACAO')) then
    perform recusar_campos('O responsável precisa ser da equipe, com a função Comercial ou Administração', 'responsavelId');
  end if;
end $$;

-- Começa a cadência da etapa (e da origem, quando houver uma só dela), trocando a anterior.
create function comercial_iniciar_cadencia(p_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  i interessados;
  v_cad uuid;
begin
  select * into i from interessados where id = p_id;
  select id into v_cad from cadencias_comercial
   where ativa and gatilho = i.etapa and (origem is null or origem = i.origem)
   order by (origem is not null) desc limit 1;
  if i.cadencia_id is not null and i.cadencia_fim_em is null then
    update interessados set cadencia_fim_em = app_now(), cadencia_fim_motivo = 'ETAPA' where id = p_id;
  end if;
  if v_cad is not null and not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj) then
    update interessados set cadencia_id = v_cad, cadencia_inicio = (app_now() at time zone 'America/Sao_Paulo')::date, cadencia_feitos = 0,
                            cadencia_fim_em = null, cadencia_fim_motivo = null
     where id = p_id;
  end if;
end $$;

-- Registra uma conversa e o que ela muda: primeiro retorno, contador de parado e cadência.
create function comercial_inserir_conversa(p_id uuid, p_canal text, p_resumo text, p_respondeu boolean, p_mensagem uuid, p_passo integer)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_pessoa uuid := contexto_pessoa();
begin
  insert into conversas_comercial (interessado_id, canal, resumo, respondeu, mensagem_id, cadencia_passo, criado_por)
  values (p_id, p_canal, btrim(p_resumo), coalesce(p_respondeu, false) and p_canal <> 'NOTA', p_mensagem, p_passo, v_pessoa)
  returning id into v_id;
  -- A nota interna fica nas conversas, mas não é falar com a pessoa: não conta retorno nem tira o parado.
  if p_canal = 'NOTA' then return v_id; end if;
  update interessados set
    ultima_conversa_em = app_now(),
    primeira_resposta_em = case when primeira_resposta_em is null and v_pessoa is not null and p_canal <> 'ENTRADA' then app_now() else primeira_resposta_em end,
    cadencia_fim_em = case when coalesce(p_respondeu, false) and cadencia_id is not null and cadencia_fim_em is null then app_now() else cadencia_fim_em end,
    cadencia_fim_motivo = case when coalesce(p_respondeu, false) and cadencia_id is not null and cadencia_fim_em is null then 'RESPONDEU' else cadencia_fim_motivo end
   where id = p_id;
  return v_id;
end $$;

-- Interessado parecido (CM-01, CM-24): mesmo WhatsApp, CNPJ, e-mail ou, na planilha, endereço.
-- Prefere o que está aberto.
create function comercial_parecido(p_whatsapp text, p_email text, p_cnpj text, p_endereco text, p_ignorar uuid default null)
returns table (id uuid, campo text)
language sql stable
set search_path = public
as $$
  select i.id,
         case when p_whatsapp is not null and i.whatsapp = p_whatsapp then 'WHATSAPP'
              when p_cnpj is not null and i.cnpj = p_cnpj then 'CNPJ'
              when p_email is not null and i.email = lower(p_email) then 'EMAIL'
              else 'ENDERECO' end
    from interessados i
   where i.anonimizado_em is null and i.id is distinct from p_ignorar
     and ((p_whatsapp is not null and i.whatsapp = p_whatsapp)
          or (p_cnpj is not null and i.cnpj = p_cnpj)
          or (p_email is not null and i.email = lower(p_email))
          or (comercial_normalizar(p_endereco) is not null and comercial_normalizar(i.endereco) = comercial_normalizar(p_endereco)))
   order by comercial_aberta(i.etapa) desc, i.criado_em desc
   limit 1
$$;

create function comercial_nome(p uuid) returns text
language sql stable
set search_path = public
as $$ select nome from pessoas where id = p $$;

-- O interessado em JSON. Completo: a ficha (WhatsApp inteiro, prédio, base legal); resumo: a
-- lista e o quadro (WhatsApp mascarado).
create function comercial_json(i interessados, p_completo boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_tarefa jsonb := comercial_tarefa(i);
  v jsonb;
begin
  v := jsonb_build_object(
    'id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'cidade', i.cidade, 'uf', i.uf, 'faixa', i.faixa, 'unidades', i.unidades,
    'pessoa', i.nome_contato, 'papel', i.papel_contato, 'whatsappMascarado', comercial_mascarar(i.whatsapp),
    'origem', i.origem, 'origemDetalhe', i.origem_detalhe, 'etapa', i.etapa, 'etapaDesde', i.etapa_desde,
    'probabilidade', (select probabilidade from parametros_etapa_comercial where etapa = i.etapa),
    'responsavel', case when i.responsavel_id is not null then jsonb_build_object('id', i.responsavel_id, 'nome', comercial_nome(i.responsavel_id)) end,
    'proximoPasso', case when i.proximo_passo is not null then
      jsonb_strip_nulls(jsonb_build_object('texto', i.proximo_passo, 'data', i.proximo_passo_data, 'hora', to_char(i.proximo_passo_hora, 'HH24:MI'))) end,
    'primeiroRetornoAte', i.primeiro_retorno_ate, 'primeiraRespostaEm', i.primeira_resposta_em,
    'ultimaConversa', (select jsonb_build_object('em', c.criado_em, 'resumo', c.resumo, 'canal', c.canal)
                         from conversas_comercial c where c.interessado_id = i.id order by c.criado_em desc, c.id desc limit 1),
    'motivoPerda', i.motivo_perda, 'anonimizado', i.anonimizado_em is not null, 'criadoEm', i.criado_em,
    'tarefa', v_tarefa, 'atencao', comercial_atencao(v_tarefa),
    'temWhatsapp', i.optin_em is not null and i.whatsapp is not null and not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj));
  if p_completo then
    v := v || jsonb_build_object(
      'whatsapp', i.whatsapp, 'email', i.email, 'cnpj', i.cnpj, 'endereco', i.endereco, 'utm', i.utm,
      'lote', (select jsonb_build_object('id', l.id, 'arquivo', l.arquivo, 'origem', l.origem_texto) from lotes_comercial l where l.id = i.lote_id),
      'baseLegal', jsonb_build_object('tipo', i.base_legal, 'texto', i.base_legal_texto, 'em', i.base_legal_em),
      'optin', case when i.optin_em is not null then jsonb_build_object('em', i.optin_em, 'canal', i.optin_canal, 'texto', i.optin_texto) end,
      'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
      'predio', jsonb_strip_nulls(jsonb_build_object(
        'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
        'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate,
        'decisor', i.decisor, 'decisaoEm', i.decisao_em, 'visitaEm', i.visita_em, 'visitaNota', i.visita_nota,
        'demonstracaoEm', i.demonstracao_em)),
      'objecoes', to_jsonb(i.objecoes), 'concorrentes', i.concorrentes,
      'perda', case when i.etapa = 'PERDIDO' then jsonb_strip_nulls(jsonb_build_object('motivo', i.motivo_perda, 'detalhe', i.perda_detalhe,
                                                                                      'vencedor', i.vencedor, 'retomarEm', i.retomar_em)) end,
      'observacao', i.observacao,
      'cadencia', (select jsonb_strip_nulls(jsonb_build_object('id', c.id, 'nome', c.nome, 'passos', c.passos, 'feitos', i.cadencia_feitos,
                                                               'inicio', i.cadencia_inicio, 'fimEm', i.cadencia_fim_em, 'fimMotivo', i.cadencia_fim_motivo))
                     from cadencias_comercial c where c.id = i.cadencia_id),
      'falta', (select jsonb_object_agg(p.etapa, to_jsonb(comercial_falta(i, p.etapa))) from parametros_etapa_comercial p
                 where cardinality(comercial_falta(i, p.etapa)) > 0));
  end if;
  return jsonb_strip_nulls(v);
end $$;

-- ---------------------------------------------------------------------------------------
-- Leitura: lista e quadro, Meu dia e ficha.

create function comercial_etapas_json() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('etapa', etapa, 'ordem', ordem, 'aberta', aberta, 'probabilidade', probabilidade,
                                                                 'limiteDias', limite_dias, 'versao', versao)) order by ordem), '[]'::jsonb)
    from parametros_etapa_comercial
$$;

create function comercial_equipe_json() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome), '[]'::jsonb)
    from pessoas p
   where exists (select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
                  where e.pessoa_id = p.id and e.ativa and ef.retirada_em is null and ef.funcao in ('COMERCIAL', 'ADMINISTRACAO'))
$$;

create function comercial_lista(p_pessoa uuid, p_busca text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := comercial_normalizar(p_busca);
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g'), '');
  v_mes timestamptz := date_trunc('month', app_now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  with linhas as (
    select i.*, comercial_json(i, false) as j from interessados i
     where i.anonimizado_em is null
       and (v_busca is null or comercial_normalizar(i.condominio) like '%' || v_busca || '%'
            or comercial_normalizar(i.nome_contato) like '%' || v_busca || '%'
            or (v_digitos is not null and length(v_digitos) >= 4 and (i.whatsapp like '%' || v_digitos || '%' or i.cnpj like '%' || v_digitos || '%')))
  )
  select jsonb_build_object(
    'interessados', coalesce((select jsonb_agg(l.j order by comercial_aberta(l.etapa) desc, comercial_ordem(l.j -> 'tarefa'), l.j -> 'tarefa' ->> 'quando',
                                               l.criado_em desc)
                                from (select * from linhas order by criado_em desc limit 500) l), '[]'::jsonb),
    'contagens', jsonb_build_object(
      'atencao', (select count(*) from linhas l where comercial_aberta(l.etapa) and (l.j ->> 'atencao')::boolean),
      'abertos', (select count(*) from linhas l where comercial_aberta(l.etapa)),
      'porEtapa', coalesce((select jsonb_object_agg(e.etapa, (select count(*) from linhas l where l.etapa = e.etapa
                                                                and (e.aberta or l.etapa_desde >= v_mes)))
                              from parametros_etapa_comercial e), '{}'::jsonb)),
    'etapas', comercial_etapas_json(),
    'equipe', comercial_equipe_json(),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeExportar', pode_global('console.comercial.exportar'))
  into v;
  return v;
end $$;

-- Meu dia (CM-04): o que é da pessoa e o que está sem responsável, por atrasados, hoje e sem
-- próximo passo.
create function comercial_meu_dia(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  with linhas as (
    select i.criado_em, comercial_json(i, false) as j from interessados i
     where i.anonimizado_em is null and comercial_aberta(i.etapa) and (i.responsavel_id = p_pessoa or i.responsavel_id is null)
  )
  select jsonb_build_object(
    'atrasados', coalesce((select jsonb_agg(j order by j -> 'tarefa' ->> 'quando', criado_em) from linhas where j -> 'tarefa' ->> 'situacao' = 'ATRASADO'), '[]'::jsonb),
    'hoje', coalesce((select jsonb_agg(j order by j -> 'tarefa' ->> 'quando', criado_em) from linhas where j -> 'tarefa' ->> 'situacao' = 'HOJE'), '[]'::jsonb),
    'semPasso', coalesce((select jsonb_agg(j order by criado_em) from linhas where j -> 'tarefa' ->> 'situacao' = 'SEM_PASSO'), '[]'::jsonb),
    'equipe', comercial_equipe_json(),
    'podeEditar', pode_global('console.comercial.editar'))
  into v;
  return v;
end $$;

create function comercial_buscar(p_id uuid) returns interessados
language plpgsql
set search_path = public
as $$
declare i interessados;
begin
  select * into i from interessados where id = p_id;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  return i;
end $$;

create function comercial_ficha(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_id);
  return comercial_json(i, true) || jsonb_build_object(
    'conversas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', c.id, 'canal', c.canal, 'resumo', c.resumo, 'respondeu', c.respondeu, 'em', c.criado_em, 'passo', c.cadencia_passo,
        'autor', case when c.criado_por is not null then jsonb_build_object('id', c.criado_por, 'nome', comercial_nome(c.criado_por)) end))
        order by c.criado_em desc, c.id desc) from conversas_comercial c where c.interessado_id = p_id), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('de', e.de, 'para', e.para, 'motivoPerda', e.motivo_perda, 'em', e.criado_em,
        'autor', case when e.criado_por is not null then jsonb_build_object('id', e.criado_por, 'nome', comercial_nome(e.criado_por)) end))
        order by e.criado_em) from etapas_interessado e where e.interessado_id = p_id), '[]'::jsonb),
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'texto', m.texto) order by m.criado_em)
                             from mensagens_comercial m where m.ativa and m.etapa = i.etapa), '[]'::jsonb),
    'objecoesLista', (select jsonb_agg(jsonb_build_object('codigo', o.codigo, 'texto', o.texto, 'resposta', o.resposta) order by o.ordem) from objecoes_comercial o),
    'etapasLista', comercial_etapas_json(),
    'equipe', comercial_equipe_json(),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeExcluir', pode_global('console.comercial.excluir'));
end $$;

-- ---------------------------------------------------------------------------------------
-- Entrada: à mão, pelo site e pela planilha.

create function comercial_texto(p jsonb, p_chave text) returns text
language sql immutable
set search_path = public
as $$ select nullif(btrim(p ->> p_chave), '') $$;

-- Interessado novo à mão (CM-02). Mesmo WhatsApp, e-mail ou CNPJ junta no que já existe.
create function comercial_criar(p_pessoa uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem   text := comercial_texto(p_dados, 'origem');
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cnpj     text := comercial_texto(p_dados, 'cnpj');
  v_resp     uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_existe   record;
  v_id       uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if v_origem is null or v_origem in ('SITE', 'IMPORTACAO') then
    perform recusar_campos('Escolha por onde a pessoa chegou', 'origem');
  end if;
  if coalesce((p_dados ->> 'contatoAceito')::boolean, false) is not true then
    perform recusar_campos('Confirme que a pessoa procurou a TRÍADE ou aceitou o contato', 'contatoAceito');
  end if;
  if v_whatsapp is null and v_email is null then
    perform recusar_campos('Informe o WhatsApp ou o e-mail', 'whatsapp', 'email');
  end if;
  if comercial_nao_contatar_tem(v_whatsapp, v_email, v_cnpj) then
    perform recusar_motivo('Este contato está na lista de não contatar', 'NAO_CONTATAR');
  end if;
  perform comercial_exigir_responsavel(v_resp);
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, v_cnpj, null);
  if v_existe.id is not null then
    perform comercial_inserir_conversa(v_existe.id, 'OUTRO',
      'Registrado de novo à mão (' || v_origem || coalesce(': ' || comercial_texto(p_dados, 'origemDetalhe'), '') || ').', false, null, null);
    perform registrar_historico_interno('comercial.juntado', 'interessado', v_existe.id::text, jsonb_build_object('campo', v_existe.campo));
    return jsonb_build_object('id', v_existe.id, 'juntado', true, 'campo', v_existe.campo);
  end if;
  insert into interessados (nome_contato, papel_contato, whatsapp, email, condominio, cnpj, cidade, uf, faixa, unidades, origem, origem_detalhe,
                            base_legal, base_legal_texto, optin_em, optin_canal, optin_texto, responsavel_id, primeiro_retorno_ate, criado_por)
  values (comercial_texto(p_dados, 'pessoa'), comercial_texto(p_dados, 'papel'), v_whatsapp, v_email, comercial_texto(p_dados, 'condominio'), v_cnpj,
          comercial_texto(p_dados, 'cidade'), comercial_texto(p_dados, 'uf'), comercial_texto(p_dados, 'faixa'), (p_dados ->> 'unidades')::integer,
          v_origem, comercial_texto(p_dados, 'origemDetalhe'), 'LEGITIMO_INTERESSE',
          'A pessoa procurou a TRÍADE ou aceitou o contato; dados usados só para responder e negociar (legítimo interesse documentado).',
          case when comercial_texto(p_dados, 'optinTexto') is not null then app_now() end,
          case when comercial_texto(p_dados, 'optinTexto') is not null then coalesce(comercial_texto(p_dados, 'optinCanal'), 'WHATSAPP') end,
          comercial_texto(p_dados, 'optinTexto'), v_resp,
          case when v_origem = 'COTACAO' then app_now() + interval '24 hours' else comercial_hora_util(app_now()) end, p_pessoa)
  returning id into v_id;
  insert into etapas_interessado (interessado_id, de, para, criado_por) values (v_id, null, 'NOVO', p_pessoa);
  perform comercial_inserir_conversa(v_id, 'ENTRADA', 'Registrado à mão. Origem: ' || v_origem || coalesce(' (' || comercial_texto(p_dados, 'origemDetalhe') || ')', '') || '.',
                                     false, null, null);
  perform comercial_iniciar_cadencia(v_id);
  perform registrar_historico_interno('comercial.criado', 'interessado', v_id::text, jsonb_build_object('origem', v_origem));
  return jsonb_build_object('id', v_id, 'juntado', false);
end $$;

-- Pedido do site (CM-01): sem pessoa; a rota protegida da api-console chama. O mesmo contato
-- junta no interessado que já existe, como conversa, sem mexer na primeira origem nem nas UTM.
create function comercial_entrada_site(p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_resumo   text;
  v_existe   record;
  v_id       uuid;
  v_texto    text := coalesce(comercial_texto(p_dados, 'consentimentoTexto'),
                              'Autorizo o uso destes dados só para responder a este pedido, como diz a política de privacidade.');
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  if v_whatsapp is null or v_whatsapp !~ '^55[0-9]{10,11}$' then perform recusar_campos('WhatsApp inválido', 'whatsapp'); end if;
  if coalesce((p_dados ->> 'consentimento')::boolean, false) is not true then perform recusar_campos('Falta o consentimento', 'consentimento'); end if;
  v_resumo := 'Pedido de demonstração pelo site: ' || coalesce(comercial_texto(p_dados, 'condominio'), '') ||
              coalesce(' (' || comercial_texto(p_dados, 'unidadesTexto') || ')', '') || '.';
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, null, null);
  if v_existe.id is not null then
    perform comercial_inserir_conversa(v_existe.id, 'ENTRADA', v_resumo, true, null, null);
    perform set_config('app.comercial_sistema', '', true);
    return jsonb_build_object('id', v_existe.id, 'juntado', true);
  end if;
  insert into interessados (nome_contato, whatsapp, email, condominio, faixa, origem, origem_detalhe, utm, base_legal, base_legal_texto,
                            optin_em, optin_canal, optin_texto, primeiro_retorno_ate)
  values (comercial_texto(p_dados, 'nome'), v_whatsapp, v_email, comercial_texto(p_dados, 'condominio'), comercial_texto(p_dados, 'faixa'), 'SITE',
          comercial_texto(p_dados, 'pagina'), case when jsonb_typeof(p_dados -> 'utm') = 'object' and p_dados -> 'utm' <> '{}'::jsonb then p_dados -> 'utm' end,
          'CONSENTIMENTO', v_texto, app_now(), 'SITE', left(v_texto, 500), comercial_hora_util(app_now()))
  returning id into v_id;
  insert into etapas_interessado (interessado_id, de, para) values (v_id, null, 'NOVO');
  perform comercial_inserir_conversa(v_id, 'ENTRADA', v_resumo, false, null, null);
  perform comercial_iniciar_cadencia(v_id);
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_build_object('id', v_id, 'juntado', false);
end $$;

-- Planilha (CM-24). Sem p_confirmar, só confere: devolve as novas, as parecidas e as que estão
-- na lista de não contatar, sem gravar. Com p_confirmar, cada parecida precisa da decisão
-- (JUNTAR ou CRIAR) e o lote fica gravado com a origem e a base legal.
create function comercial_importar(p_pessoa uuid, p_dados jsonb, p_confirmar boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_par      record;
  v_parecidas jsonb := '[]';
  v_bloq     jsonb := '[]';
  v_novas    integer := 0;
  v_lote     uuid;
  v_criados  integer := 0;
  v_juntados integer := 0;
  v_decisao  text;
  v_id       uuid;
  v_linhas   integer := jsonb_array_length(coalesce(p_dados -> 'linhas', '[]'));
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if v_linhas = 0 or v_linhas > 2000 then perform recusar_campos('A planilha precisa ter de 1 a 2000 linhas', 'linhas'); end if;
  if comercial_texto(p_dados, 'origemTexto') is null then perform recusar_campos('Diga de onde veio a lista', 'origemTexto'); end if;
  if length(coalesce(comercial_texto(p_dados, 'baseLegalTexto'), '')) < 10 then
    perform recusar_campos('Escreva o teste de legítimo interesse do lote', 'baseLegalTexto');
  end if;
  if p_confirmar then
    insert into lotes_comercial (arquivo, origem_texto, base_legal_texto, linhas, criados, juntados, bloqueados, criado_por)
    values (coalesce(comercial_texto(p_dados, 'arquivo'), 'planilha'), comercial_texto(p_dados, 'origemTexto'), comercial_texto(p_dados, 'baseLegalTexto'),
            v_linhas, 0, 0, 0, p_pessoa)
    returning id into v_lote;
  end if;
  for r in select (l ->> 'linha')::integer as linha, nullif(btrim(l ->> 'condominio'), '') as condominio, nullif(btrim(l ->> 'cnpj'), '') as cnpj,
                  nullif(btrim(l ->> 'endereco'), '') as endereco, nullif(btrim(l ->> 'cidade'), '') as cidade, nullif(btrim(l ->> 'uf'), '') as uf,
                  (l ->> 'unidades')::integer as unidades, nullif(btrim(l ->> 'faixa'), '') as faixa, nullif(btrim(l ->> 'pessoa'), '') as pessoa,
                  nullif(btrim(l ->> 'whatsapp'), '') as whatsapp, lower(nullif(btrim(l ->> 'email'), '')) as email, l ->> 'decisao' as decisao
             from jsonb_array_elements(p_dados -> 'linhas') l
  loop
    if r.condominio is null then perform recusar_campos(format('Linha %s sem o nome do condomínio', r.linha), 'linhas'); end if;
    if comercial_nao_contatar_tem(r.whatsapp, r.email, r.cnpj) then
      v_bloq := v_bloq || jsonb_build_object('linha', r.linha, 'condominio', r.condominio);
      continue;
    end if;
    select * into v_par from comercial_parecido(r.whatsapp, r.email, r.cnpj, r.endereco);
    if v_par.id is not null then
      v_parecidas := v_parecidas || jsonb_build_object('linha', r.linha, 'condominio', r.condominio, 'interessadoId', v_par.id, 'campo', v_par.campo,
                                                       'interessado', (select condominio from interessados where id = v_par.id));
      v_decisao := r.decisao;
    else
      v_novas := v_novas + 1;
      v_decisao := 'CRIAR';
    end if;
    if p_confirmar then
      if v_decisao is null or v_decisao not in ('JUNTAR', 'CRIAR') then
        perform recusar_motivo('Decida juntar ou criar cada linha parecida', 'PARECIDOS_SEM_DECISAO');
      end if;
      if v_decisao = 'JUNTAR' then
        perform comercial_inserir_conversa(v_par.id, 'OUTRO', format('Apareceu de novo na planilha %s, linha %s.', coalesce(comercial_texto(p_dados, 'arquivo'), ''), r.linha),
                                           false, null, null);
        v_juntados := v_juntados + 1;
      else
        insert into interessados (nome_contato, whatsapp, email, condominio, cnpj, endereco, cidade, uf, faixa, unidades, origem, origem_detalhe, lote_id,
                                  base_legal, base_legal_texto, criado_por)
        values (r.pessoa, r.whatsapp, r.email, r.condominio, r.cnpj, r.endereco, r.cidade, upper(r.uf), r.faixa, r.unidades, 'IMPORTACAO',
                left(comercial_texto(p_dados, 'origemTexto'), 200), v_lote, 'LEGITIMO_INTERESSE', comercial_texto(p_dados, 'baseLegalTexto'), p_pessoa)
        returning id into v_id;
        insert into etapas_interessado (interessado_id, de, para, criado_por) values (v_id, null, 'NOVO', p_pessoa);
        v_criados := v_criados + 1;
      end if;
    end if;
  end loop;
  if p_confirmar then
    perform set_config('app.comercial_sistema', 'on', true);
    update lotes_comercial set criados = v_criados, juntados = v_juntados, bloqueados = jsonb_array_length(v_bloq) where id = v_lote;
    perform set_config('app.comercial_sistema', '', true);
    perform registrar_historico_interno('comercial.importado', 'lote_comercial', v_lote::text,
      jsonb_build_object('linhas', v_linhas, 'criados', v_criados, 'juntados', v_juntados, 'bloqueados', jsonb_array_length(v_bloq)));
    return jsonb_build_object('loteId', v_lote, 'criados', v_criados, 'juntados', v_juntados, 'bloqueados', v_bloq);
  end if;
  return jsonb_build_object('linhas', v_linhas, 'novas', v_novas, 'parecidas', v_parecidas, 'bloqueados', v_bloq);
end $$;

-- ---------------------------------------------------------------------------------------
-- Escrita na ficha.

-- Contato, prédio, objeções, concorrentes e responsável (CM-16, CM-17). A etapa tem a sua função.
create function comercial_salvar(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cnpj     text := comercial_texto(p_dados, 'cnpj');
  v_resp     uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_existe   record;
  v_versao   integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if v_whatsapp is null and v_email is null and i.origem <> 'IMPORTACAO' then
    perform recusar_campos('Informe o WhatsApp ou o e-mail', 'whatsapp', 'email');
  end if;
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, v_cnpj, null, p_id);
  if v_existe.id is not null then
    raise exception 'Este contato já é de outro interessado' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'DUPLICADO', 'campos', jsonb_build_array(lower(v_existe.campo)), 'interessadoId', v_existe.id)::text;
  end if;
  perform comercial_exigir_responsavel(v_resp);
  update interessados set
    nome_contato = comercial_texto(p_dados, 'pessoa'), papel_contato = comercial_texto(p_dados, 'papel'), whatsapp = v_whatsapp, email = v_email,
    condominio = comercial_texto(p_dados, 'condominio'), cnpj = v_cnpj, endereco = comercial_texto(p_dados, 'endereco'),
    cidade = comercial_texto(p_dados, 'cidade'), uf = comercial_texto(p_dados, 'uf'), faixa = comercial_texto(p_dados, 'faixa'),
    unidades = (p_dados ->> 'unidades')::integer, responsavel_id = v_resp,
    administradora = comercial_texto(p_dados, 'administradora'), app_administradora = (p_dados ->> 'appAdministradora')::boolean,
    sistema_atual = comercial_texto(p_dados, 'sistemaAtual'), fidelidade_ate = (p_dados ->> 'fidelidadeAte')::date,
    assembleia_ordinaria = (p_dados ->> 'assembleiaOrdinaria')::date, mandato_ate = (p_dados ->> 'mandatoAte')::date,
    decisor = comercial_texto(p_dados, 'decisor'), decisao_em = (p_dados ->> 'decisaoEm')::date,
    visita_em = (p_dados ->> 'visitaEm')::date, visita_nota = comercial_texto(p_dados, 'visitaNota'),
    demonstracao_em = (p_dados ->> 'demonstracaoEm')::timestamptz,
    objecoes = coalesce((select array_agg(distinct o) from jsonb_array_elements_text(coalesce(p_dados -> 'objecoes', '[]')) o), '{}'),
    concorrentes = coalesce(p_dados -> 'concorrentes', '[]'),
    observacao = comercial_texto(p_dados, 'observacao'),
    -- Opt-in novo: guarda data, canal e o texto; tirar o opt-in apaga os três.
    optin_em = case when comercial_texto(p_dados, 'optinTexto') is null then null
                    when comercial_texto(p_dados, 'optinTexto') is distinct from i.optin_texto then app_now() else i.optin_em end,
    optin_canal = case when comercial_texto(p_dados, 'optinTexto') is null then null else coalesce(comercial_texto(p_dados, 'optinCanal'), i.optin_canal, 'WHATSAPP') end,
    optin_texto = comercial_texto(p_dados, 'optinTexto'),
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  perform registrar_historico_interno('comercial.ficha', 'interessado', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- Mudar a etapa (CM-03, CM-25). Perdido pede o motivo; a etapa só avança com o que ela pede.
create function comercial_mudar_etapa(p_pessoa uuid, p_id uuid, p_versao integer, p_etapa text, p_motivo_perda text default null,
                                      p_detalhe text default null, p_vencedor text default null, p_retomar_em date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_falta text[];
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.versao <> p_versao then perform conflito_versao('interessados', p_id); end if;
  if not exists (select 1 from parametros_etapa_comercial where etapa = p_etapa) then perform recusar_campos('Etapa inválida', 'etapa'); end if;
  if p_etapa = i.etapa then return jsonb_build_object('id', p_id, 'versao', i.versao, 'etapa', i.etapa); end if;
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if p_etapa = 'PERDIDO' and p_motivo_perda is null then perform recusar_campos('Diga por que não fechou', 'motivoPerda'); end if;
  v_falta := comercial_falta(i, p_etapa);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta o que a etapa pede' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'FALTA_PARA_ETAPA', 'campos', to_jsonb(v_falta))::text;
  end if;
  update interessados set
    etapa = p_etapa, etapa_desde = app_now(),
    motivo_perda = case when p_etapa = 'PERDIDO' then p_motivo_perda end,
    perda_detalhe = case when p_etapa = 'PERDIDO' then nullif(btrim(p_detalhe), '') end,
    vencedor = case when p_etapa = 'PERDIDO' then nullif(btrim(p_vencedor), '') end,
    retomar_em = case when p_etapa = 'PERDIDO' then p_retomar_em end,
    concorrentes = case when p_etapa = 'PERDIDO' and nullif(btrim(p_vencedor), '') is not null then
      (select coalesce(jsonb_agg(c || jsonb_build_object('venceu', c ->> 'nome' = btrim(p_vencedor))), '[]') from jsonb_array_elements(concorrentes) c)
      else concorrentes end,
    proximo_passo = case when comercial_aberta(p_etapa) then proximo_passo end,
    proximo_passo_data = case when comercial_aberta(p_etapa) then proximo_passo_data end,
    proximo_passo_hora = case when comercial_aberta(p_etapa) then proximo_passo_hora end,
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id;
  insert into etapas_interessado (interessado_id, de, para, motivo_perda, criado_por) values (p_id, i.etapa, p_etapa, p_motivo_perda, p_pessoa);
  perform comercial_iniciar_cadencia(p_id);
  perform registrar_historico_interno('comercial.etapa', 'interessado', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('de', i.etapa, 'para', p_etapa, 'motivoPerda', p_motivo_perda)));
  select versao into v_versao from interessados where id = p_id;
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'etapa', p_etapa);
end $$;

-- Registrar conversa (CM-05, CM-15). "Respondeu" para a cadência (CM-26).
create function comercial_registrar_conversa(p_pessoa uuid, p_id uuid, p_canal text, p_resumo text, p_respondeu boolean default false,
                                             p_mensagem uuid default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if p_canal is null or p_canal = 'ENTRADA' then perform recusar_campos('Escolha o canal', 'canal'); end if;
  if p_mensagem is not null and (i.optin_em is null or comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj)) then
    perform recusar_motivo('Sem opt-in do WhatsApp, a mensagem pronta fica desligada', 'SEM_OPTIN');
  end if;
  v_id := comercial_inserir_conversa(p_id, p_canal, p_resumo, p_respondeu, p_mensagem, null);
  return jsonb_build_object('id', v_id, 'versao', (select versao from interessados where id = p_id));
end $$;

-- Próximo passo, data e responsável (CM-04). Texto vazio tira o próximo passo.
create function comercial_proximo_passo(p_pessoa uuid, p_id uuid, p_versao integer, p_texto text, p_data date, p_hora time default null,
                                        p_responsavel uuid default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if not comercial_aberta(i.etapa) then perform recusar_motivo('Interessado fechado não tem próximo passo', 'ETAPA_FECHADA'); end if;
  if nullif(btrim(p_texto), '') is not null and p_data is null then perform recusar_campos('Escolha a data do próximo passo', 'data'); end if;
  perform comercial_exigir_responsavel(p_responsavel);
  update interessados set
    proximo_passo = nullif(btrim(p_texto), ''),
    proximo_passo_data = case when nullif(btrim(p_texto), '') is not null then p_data end,
    proximo_passo_hora = case when nullif(btrim(p_texto), '') is not null then p_hora end,
    responsavel_id = coalesce(p_responsavel, responsavel_id),
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- Passo da cadência feito (vira conversa e avança) ou cadência parada (CM-26). No último passo
-- sem resposta, a cadência que termina em Sem resposta muda a etapa.
create function comercial_cadencia(p_pessoa uuid, p_id uuid, p_acao text, p_resumo text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_cad cadencias_comercial;
  v_passo jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.cadencia_id is null or i.cadencia_fim_em is not null then perform recusar_motivo('Não há cadência em andamento', 'SEM_CADENCIA'); end if;
  select * into v_cad from cadencias_comercial where id = i.cadencia_id;
  if p_acao = 'PARAR' then
    update interessados set cadencia_fim_em = app_now(), cadencia_fim_motivo = 'PARADA', alterado_em = app_now(), alterado_por = p_pessoa where id = p_id;
  elsif p_acao = 'FEITO' then
    v_passo := v_cad.passos -> i.cadencia_feitos;
    perform comercial_inserir_conversa(p_id, case v_passo ->> 'canal' when 'LIGACAO' then 'LIGACAO' when 'EMAIL' then 'EMAIL' else 'WHATSAPP' end,
      coalesce(nullif(btrim(p_resumo), ''), format('Cadência %s, passo %s: %s', v_cad.nome, i.cadencia_feitos + 1, v_passo ->> 'texto')),
      false, null, i.cadencia_feitos + 1);
    update interessados set cadencia_feitos = cadencia_feitos + 1,
      cadencia_fim_em = case when cadencia_feitos + 1 >= jsonb_array_length(v_cad.passos) then app_now() end,
      cadencia_fim_motivo = case when cadencia_feitos + 1 >= jsonb_array_length(v_cad.passos) then 'CONCLUIDA' end,
      alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id;
    if i.cadencia_feitos + 1 >= jsonb_array_length(v_cad.passos) and v_cad.termina_sem_resposta then
      update interessados set etapa = 'SEM_RESPOSTA', etapa_desde = app_now(), proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null
       where id = p_id;
      insert into etapas_interessado (interessado_id, de, para, criado_por) values (p_id, i.etapa, 'SEM_RESPOSTA', p_pessoa);
    end if;
  else
    perform recusar_campos('Ação inválida', 'acao');
  end if;
  return jsonb_build_object('id', p_id, 'versao', (select versao from interessados where id = p_id));
end $$;

-- ---------------------------------------------------------------------------------------
-- LGPD (CM-12): não contatar, apagar a pedido, anonimizar os antigos e exportar.

create function comercial_nao_contatar(p_pessoa uuid, p_whatsapp text, p_email text, p_cnpj text, p_observacao text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  insert into nao_contatar (whatsapp, email, cnpj, motivo, observacao, criado_por)
  values (nullif(p_whatsapp, ''), lower(nullif(p_email, '')), nullif(p_cnpj, ''), 'PEDIU', nullif(btrim(p_observacao), ''), p_pessoa)
  returning id into v_id;
  update interessados set cadencia_fim_em = app_now(), cadencia_fim_motivo = 'NAO_CONTATAR'
   where cadencia_id is not null and cadencia_fim_em is null
     and ((p_whatsapp <> '' and whatsapp = p_whatsapp) or (p_email <> '' and email = lower(p_email)) or (p_cnpj <> '' and cnpj = p_cnpj));
  perform registrar_historico_interno('comercial.nao_contatar', 'nao_contatar', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id);
end $$;

-- Apaga nome, contato e conversas; ficam só os números do funil.
create function comercial_anonimizar(p_id uuid, p_resumo text) returns void
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
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- Pedido de exclusão (Administração): apaga já e põe o contato na lista de não contatar.
create function comercial_excluir(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.excluir');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then return jsonb_build_object('id', p_id, 'anonimizado', true); end if;
  if num_nonnulls(i.whatsapp, i.email, i.cnpj) > 0 then
    insert into nao_contatar (whatsapp, email, cnpj, motivo, criado_por) values (i.whatsapp, i.email, i.cnpj, 'EXCLUSAO', p_pessoa);
  end if;
  perform comercial_anonimizar(p_id, 'Apagado a pedido da pessoa (LGPD).');
  perform registrar_historico_interno('comercial.excluido', 'interessado', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'anonimizado', true);
end $$;

-- Rotina diária: perdido ou sem resposta, sem conversa há 12 meses, é anonimizado.
create function comercial_anonimizar_antigos() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total integer := 0;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  for r in select id from interessados
            where anonimizado_em is null and etapa in ('PERDIDO', 'SEM_RESPOSTA')
              and coalesce(ultima_conversa_em, criado_em) < app_now() - interval '12 months'
  loop
    perform comercial_anonimizar(r.id, 'Apagado depois de 12 meses sem conversa (LGPD).');
    v_total := v_total + 1;
  end loop;
  perform set_config('app.comercial_sistema', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('anonimizar-comercial', '17 4 * * *', 'select public.comercial_anonimizar_antigos()');
exception when others then
  raise notice 'pg_cron indisponível: agende comercial_anonimizar_antigos() de outro jeito (%).', sqlerrm;
end $$;

-- Exportar (só a Administração), com registro no histórico.
create function comercial_exportar(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.exportar');
  select coalesce(jsonb_agg(jsonb_build_object(
      'condominio', i.condominio, 'cidade', i.cidade, 'uf', i.uf, 'faixa', i.faixa, 'unidades', i.unidades, 'pessoa', i.nome_contato,
      'whatsapp', i.whatsapp, 'email', i.email, 'cnpj', i.cnpj, 'origem', i.origem, 'etapa', i.etapa, 'motivoPerda', i.motivo_perda,
      'responsavel', comercial_nome(i.responsavel_id), 'baseLegal', i.base_legal, 'criadoEm', i.criado_em) order by i.criado_em), '[]'::jsonb)
    into v from interessados i where i.anonimizado_em is null;
  perform registrar_historico_interno('comercial.exportado', 'interessado', null, jsonb_build_object('linhas', jsonb_array_length(v)));
  return jsonb_build_object('linhas', v);
end $$;

-- ---------------------------------------------------------------------------------------
-- Modelos (só a Administração muda): mensagens, cadências e etapas.

create function comercial_modelos(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'etapa', m.etapa, 'titulo', m.titulo, 'texto', m.texto, 'ativa', m.ativa,
                                                                'versao', m.versao) order by p.ordem, m.criado_em)
                             from mensagens_comercial m join parametros_etapa_comercial p on p.etapa = m.etapa), '[]'::jsonb),
    'cadencias', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', c.id, 'nome', c.nome, 'gatilho', c.gatilho, 'origem', c.origem,
                                                                                 'passos', c.passos, 'terminaSemResposta', c.termina_sem_resposta,
                                                                                 'ativa', c.ativa, 'versao', c.versao,
                                                                                 'emUso', (select count(*) from interessados i where i.cadencia_id = c.id
                                                                                             and i.cadencia_fim_em is null and i.anonimizado_em is null)))
                                            order by p.ordem, c.nome)
                             from cadencias_comercial c join parametros_etapa_comercial p on p.etapa = c.gatilho), '[]'::jsonb),
    'objecoes', (select jsonb_agg(jsonb_build_object('codigo', o.codigo, 'texto', o.texto, 'resposta', o.resposta) order by o.ordem) from objecoes_comercial o),
    'etapas', comercial_etapas_json(),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

create function comercial_salvar_mensagem(p_pessoa uuid, p_id uuid, p_versao integer, p_etapa text, p_titulo text, p_texto text, p_ativa boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if p_id is null then
    insert into mensagens_comercial (etapa, titulo, texto, ativa, criado_por) values (p_etapa, btrim(p_titulo), btrim(p_texto), coalesce(p_ativa, true), p_pessoa)
    returning id, versao into v_id, v_versao;
  else
    update mensagens_comercial set etapa = p_etapa, titulo = btrim(p_titulo), texto = btrim(p_texto), ativa = coalesce(p_ativa, true),
                                   alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id and versao = p_versao
    returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('mensagens_comercial', p_id); end if;
  end if;
  perform registrar_historico_interno('comercial.mensagem', 'mensagem_comercial', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function comercial_salvar_cadencia(p_pessoa uuid, p_id uuid, p_versao integer, p_nome text, p_gatilho text, p_origem text, p_passos jsonb,
                                          p_termina_sem_resposta boolean, p_ativa boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if not passos_cadencia_validos(p_passos) then perform recusar_campos('Confira os passos: de 1 a 10, com dias em ordem', 'passos'); end if;
  if coalesce(p_ativa, true) and exists (select 1 from cadencias_comercial where ativa and gatilho = p_gatilho and origem is not distinct from nullif(p_origem, '')
                                                                       and id is distinct from p_id) then
    perform recusar_motivo('Já há uma cadência ativa para esta etapa e origem', 'CADENCIA_REPETIDA');
  end if;
  if p_id is null then
    insert into cadencias_comercial (nome, gatilho, origem, passos, termina_sem_resposta, ativa, criado_por)
    values (btrim(p_nome), p_gatilho, nullif(p_origem, ''), p_passos, coalesce(p_termina_sem_resposta, false), coalesce(p_ativa, true), p_pessoa)
    returning id, versao into v_id, v_versao;
  else
    update cadencias_comercial set nome = btrim(p_nome), gatilho = p_gatilho, origem = nullif(p_origem, ''), passos = p_passos,
                                   termina_sem_resposta = coalesce(p_termina_sem_resposta, false), ativa = coalesce(p_ativa, true),
                                   alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id and versao = p_versao
    returning id, versao into v_id, v_versao;
    if v_id is null then perform conflito_versao('cadencias_comercial', p_id); end if;
  end if;
  perform registrar_historico_interno('comercial.cadencia', 'cadencia_comercial', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function comercial_salvar_etapa(p_pessoa uuid, p_etapa text, p_versao integer, p_probabilidade integer, p_limite_dias integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  select id into v_id from parametros_etapa_comercial where etapa = p_etapa;
  if v_id is null then raise exception 'Etapa não encontrada' using errcode = 'TC404'; end if;
  update parametros_etapa_comercial set probabilidade = p_probabilidade, limite_dias = p_limite_dias, alterado_em = app_now(), alterado_por = p_pessoa
   where id = v_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('parametros_etapa_comercial', v_id); end if;
  perform registrar_historico_interno('comercial.etapa_parametros', 'etapa_comercial', p_etapa,
    jsonb_strip_nulls(jsonb_build_object('probabilidade', p_probabilidade, 'limiteDias', p_limite_dias)));
  return jsonb_build_object('etapa', p_etapa, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- Quem está no Console: agora com as ações do Comercial, para o menu. A lista já leva as
-- ações da Retenção de dados (0301, outra frente), para nenhuma das duas apagar a da outra.

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
                                          'console.comercial.ver', 'console.comercial.editar', 'console.comercial.modelos',
                                          'console.comercial.exportar', 'console.comercial.excluir',
                                          'console.retencao.ver', 'console.retencao.ligar')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

-- 0298 · Motor de IA com freio, sugestão no pedido e transcrição do áudio (entrega IA 1; IA-20,
-- IA-17, IA-15, IA-16, IA-11 triagem, W-06, NG-13, NG-15). Desenho e escolhas aprovados pela
-- Carolina em 24/10/2026 (notas da IA 1, escolhas 1 a 5, e decisões D3, D4 e D6 do plano).
--
-- Regras desta parte:
-- 1. Conector trocável (IA-20): o condomínio guarda só o nome do provedor e do modelo. A chave
--    fica no segredo da função; o banco nunca a vê. Sem provedor disponível, a função fica
--    indisponível e o pedido segue como sempre.
-- 2. Freio: a TRÍADE tem uma chave por condomínio (nasce desligada, até o contrato com o provedor
--    estar assinado; só a Administração muda, com motivo, no histórico da equipe) e um limite por
--    mês para cada função, em quantidade (250 sugestões e 60 minutos de transcrição). O síndico
--    liga ou desliga cada função em Configurações › Ajuda da IA e vê o uso, sem valores.
-- 3. Cada chamada fica registrada no condomínio (NG-13): função, provedor, modelo, tokens, segundos
--    de áudio, custo e resultado. O custo fica em milionésimos da moeda do provedor (inteiro, como
--    pede a PT-09): uma sugestão custa cerca de 0,03 centavo, que em centavos inteiros viraria zero.
--    O Console soma o mês e mostra em reais. Chamada que falhou não conta no limite.
-- 4. A IA só sugere (IA-15): categoria, prioridade e local ficam guardados como sugestão e nunca
--    mudam o pedido sozinhos. Usar a sugestão preenche os três; quem escolhe outra coisa deixa no
--    histórico o que a IA tinha sugerido. Sem confiança ou com categoria fora de uso, não há
--    cartão. O texto que vai para a IA não leva nome nem telefone (a limpeza é do domínio).
-- 5. Transcrição do áudio do WhatsApp (W-06): fica só no painel, marcada como automática. Sem
--    serviço de transcrição (o padrão), aparece só o áudio. O morador não recebe nada sobre isso.
-- 6. Nada da IA conta como retorno ao morador nem muda prazo.

-- ---------------------------------------------------------------------------------------
-- Permissões do Console: todas as funções veem o cartão; só a Administração muda a chave e o
-- limite. Na Plataforma, a peça usa as ações que já existem (pedidos.* e config.*).

insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'console.ia.ver'),
  ('IMPLANTACAO', 'console.ia.ver'),
  ('FINANCEIRO', 'console.ia.ver'),
  ('SUPORTE', 'console.ia.ver'),
  ('ADMINISTRACAO', 'console.ia.chave'),
  ('ADMINISTRACAO', 'console.ia.limite');

-- ---------------------------------------------------------------------------------------
-- 1. A IA de cada condomínio.

create table ia_condominio (
  id                     uuid primary key default gen_random_uuid(),
  condominio_id          uuid not null unique references condominios (id) on delete restrict,
  -- Chave da TRÍADE (só a Administração muda).
  ligada                 boolean not null default false,
  ligada_em              timestamptz,
  mudada_em              timestamptz,
  mudada_por             uuid references pessoas (id),
  motivo                 text check (length(btrim(motivo)) between 3 and 300),
  -- O conector: o nome do provedor e do modelo, nunca a chave.
  provedor               text not null default 'ANTHROPIC' check (provedor in ('ANTHROPIC', 'TESTE')),
  modelo_sugerir         text not null default 'claude-haiku-5-5' check (modelo_sugerir ~ '^[a-z0-9][a-z0-9.-]{2,59}$'),
  provedor_transcricao   text not null default 'NENHUM' check (provedor_transcricao in ('NENHUM', 'TESTE')),
  -- O que o síndico liga ou desliga, e desde quando vale (vale para o que chegar depois).
  sugerir                boolean not null default true,
  sugerir_desde          timestamptz,
  transcrever            boolean not null default true,
  transcrever_desde      timestamptz,
  -- O limite do mês, definido pela TRÍADE.
  limite_sugestoes       integer not null default 250 check (limite_sugestoes between 0 and 100000),
  limite_transcricao_min integer not null default 60 check (limite_transcricao_min between 0 and 100000),
  versao                 integer not null default 1
);
call proteger_tabela_condominio('ia_condominio');

-- Cada chamada ao provedor (NG-13). Só de inserção.
create table chamadas_ia (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  funcao          text not null check (funcao in ('SUGERIR', 'TRANSCREVER')),
  provedor        text not null check (provedor ~ '^[A-Z][A-Z_]{1,29}$'),
  modelo          text not null check (length(modelo) between 1 and 60),
  tokens_entrada  integer not null default 0 check (tokens_entrada between 0 and 10000000),
  tokens_saida    integer not null default 0 check (tokens_saida between 0 and 10000000),
  segundos_audio  integer not null default 0 check (segundos_audio between 0 and 86400),
  custo_micros    bigint not null default 0 check (custo_micros between 0 and 1000000000000),
  moeda           text not null default 'USD' check (moeda in ('USD', 'BRL')),
  resultado       text not null check (resultado in ('OK', 'SEM_CONFIANCA', 'FORA_DO_USO', 'VAZIA', 'FALHA')),
  pedido_id       uuid,
  mensagem_id     uuid,
  criado_em       timestamptz not null default app_now(),
  unique (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (mensagem_id, condominio_id) references mensagens_whatsapp (id, condominio_id)
);
create index chamadas_ia_mes on chamadas_ia (condominio_id, funcao, criado_em);
call proteger_tabela_condominio('chamadas_ia');
create trigger chamadas_ia_so_insercao before update or delete on chamadas_ia for each row execute function somente_insercao();

-- A sugestão para um pedido (ou para o registro, antes de o pedido existir). Nunca muda o pedido.
create table sugestoes_ia (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references condominios (id) on delete restrict,
  pedido_id        uuid,
  estado           text not null,
  -- No registro: o resumo do relato pedido (sem o texto), para não pedir de novo o mesmo.
  relato_hash      text check (relato_hash ~ '^[0-9a-f]{32}$'),
  categoria_id     uuid,
  prioridade_id    uuid,
  local            text check (length(btrim(local)) between 2 and 120),
  porque           text check (length(btrim(porque)) between 3 and 400),
  confianca        text check (confianca in ('ALTA', 'MEDIA', 'BAIXA')),
  chamada_id       uuid,
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid references pessoas (id),
  preparando_desde timestamptz,
  decidida_em      timestamptz,
  decidida_por     uuid references pessoas (id),
  -- O que a pessoa escolheu quando não foi a sugestão.
  escolha          jsonb check (escolha is null or jsonb_typeof(escolha) = 'object'),
  versao           integer not null default 1,
  unique (id, condominio_id),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  foreign key (categoria_id, condominio_id) references categorias (id, condominio_id),
  foreign key (prioridade_id, condominio_id) references prioridades (id, condominio_id),
  foreign key (chamada_id, condominio_id) references chamadas_ia (id, condominio_id),
  check (estado not in ('PRONTA', 'USADA', 'RECUSADA') or (categoria_id is not null and prioridade_id is not null)),
  check ((decidida_em is null) = (estado not in ('USADA', 'RECUSADA')))
);
create unique index sugestoes_ia_pedido on sugestoes_ia (pedido_id) where pedido_id is not null;
call proteger_tabela_condominio('sugestoes_ia');
call ligar_guardiao('sugestoes_ia');
insert into estados_iniciais (tabela, estado) values ('sugestoes_ia', 'PREPARANDO'), ('sugestoes_ia', 'LIMITE');
insert into transicoes_permitidas (tabela, de, para) values
  ('sugestoes_ia', 'PREPARANDO', 'PRONTA'),
  ('sugestoes_ia', 'PREPARANDO', 'SEM_SUGESTAO'),
  ('sugestoes_ia', 'PREPARANDO', 'FALHA'),
  ('sugestoes_ia', 'FALHA', 'PREPARANDO'),
  ('sugestoes_ia', 'FALHA', 'LIMITE'),
  ('sugestoes_ia', 'PRONTA', 'USADA'),
  ('sugestoes_ia', 'PRONTA', 'RECUSADA');

-- A transcrição de um áudio do WhatsApp (W-06). Só no painel.
create table transcricoes_ia (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  mensagem_id    uuid not null,
  estado         text not null,
  texto          text check (length(texto) between 1 and 8000),
  segundos       integer check (segundos between 0 and 86400),
  chamada_id     uuid,
  criado_em      timestamptz not null default app_now(),
  atualizado_em  timestamptz not null default app_now(),
  unique (mensagem_id),
  foreign key (mensagem_id, condominio_id) references mensagens_whatsapp (id, condominio_id),
  foreign key (chamada_id, condominio_id) references chamadas_ia (id, condominio_id),
  check ((estado = 'PRONTA') = (texto is not null))
);
call proteger_tabela_condominio('transcricoes_ia');
call ligar_guardiao('transcricoes_ia');
insert into estados_iniciais (tabela, estado) values ('transcricoes_ia', 'TRANSCREVENDO'), ('transcricoes_ia', 'LIMITE');
insert into transicoes_permitidas (tabela, de, para) values
  ('transcricoes_ia', 'TRANSCREVENDO', 'PRONTA'),
  ('transcricoes_ia', 'TRANSCREVENDO', 'SEM_TRANSCRICAO'),
  ('transcricoes_ia', 'TRANSCREVENDO', 'FALHA'),
  ('transcricoes_ia', 'FALHA', 'TRANSCREVENDO'),
  ('transcricoes_ia', 'FALHA', 'LIMITE');

-- ---------------------------------------------------------------------------------------
-- 2. Ajudantes (o contexto já é o condomínio).

-- A configuração da IA do condomínio do contexto; nasce na primeira leitura.
create function ia_cfg() returns ia_condominio
language plpgsql
set search_path = public
as $$
declare c ia_condominio;
begin
  select * into c from ia_condominio;
  if c.id is null then
    insert into ia_condominio (condominio_id) values (contexto_condominio()) on conflict (condominio_id) do nothing;
    select * into c from ia_condominio;
  end if;
  return c;
end $$;

create function ia_fuso() returns text
language sql stable
set search_path = public
as $$ select coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo') $$;

-- O começo do mês no fuso do condomínio, e o dia em que o limite renova.
create function ia_inicio_mes() returns timestamptz
language sql stable
set search_path = public
as $$ select date_trunc('month', app_now() at time zone ia_fuso()) at time zone ia_fuso() $$;

create function ia_renova_em() returns date
language sql stable
set search_path = public
as $$ select (date_trunc('month', app_now() at time zone ia_fuso()) + interval '1 month')::date $$;

-- O uso do mês: sugestões em quantidade, transcrição em segundos. Falha não conta.
create function ia_uso(p_funcao text) returns integer
language sql stable
set search_path = public
as $$
  select case when p_funcao = 'SUGERIR' then count(*)::integer else coalesce(sum(segundos_audio), 0)::integer end
    from chamadas_ia where funcao = p_funcao and resultado <> 'FALHA' and criado_em >= ia_inicio_mes()
$$;

-- Desde quando a função vale (desligar e ligar de novo vale para o que chegar depois).
create function ia_desde(c ia_condominio, p_funcao text) returns timestamptz
language sql stable
set search_path = public
as $$
  select case when not c.ligada or c.ligada_em is null then null
              when p_funcao = 'SUGERIR' and c.sugerir then greatest(c.ligada_em, coalesce(c.sugerir_desde, c.ligada_em))
              when p_funcao = 'TRANSCREVER' and c.transcrever then greatest(c.ligada_em, coalesce(c.transcrever_desde, c.ligada_em))
         end
$$;

-- A situação da função agora: DESLIGADA_TRIADE, DESLIGADA, LIMITE ou LIGADA.
create function ia_situacao(c ia_condominio, p_funcao text) returns text
language sql stable
set search_path = public
as $$
  select case when not c.ligada then 'DESLIGADA_TRIADE'
              when (p_funcao = 'SUGERIR' and not c.sugerir) or (p_funcao = 'TRANSCREVER' and not c.transcrever) then 'DESLIGADA'
              when p_funcao = 'SUGERIR' and ia_uso('SUGERIR') >= c.limite_sugestoes then 'LIMITE'
              when p_funcao = 'TRANSCREVER' and ia_uso('TRANSCREVER') >= c.limite_transcricao_min * 60 then 'LIMITE'
              else 'LIGADA' end
$$;

-- O uso do mês para o síndico: quantidade, sem valores.
create function ia_uso_json(c ia_condominio) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'sugestoes', jsonb_build_object('usadas', ia_uso('SUGERIR'), 'limite', c.limite_sugestoes),
    'transcricao', jsonb_build_object('minutos', ceil(ia_uso('TRANSCREVER') / 60.0)::integer, 'segundos', ia_uso('TRANSCREVER'),
                                      'limite', c.limite_transcricao_min),
    'renovaEm', to_char(ia_renova_em(), 'YYYY-MM-DD'))
$$;

create function sugestao_ia_json(s sugestoes_ia) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id, 'estado', s.estado, 'local', s.local, 'porque', s.porque, 'confianca', s.confianca, 'criadaEm', s.criado_em,
    'categoria', (select jsonb_build_object('id', c.id, 'nome', c.nome) from categorias c where c.id = s.categoria_id),
    'prioridade', (select jsonb_build_object('id', p.id, 'nome', p.nome, 'significado', p.significado) from prioridades p where p.id = s.prioridade_id),
    'decididaEm', s.decidida_em, 'decididaPor', nome_pessoa(s.decidida_por), 'escolha', s.escolha,
    'renovaEm', case when s.estado = 'LIMITE' then to_char(ia_renova_em(), 'YYYY-MM-DD') end,
    'versao', s.versao))
$$;

-- O que vai para a IA na sugestão: o texto (a API tira nome e telefone antes de enviar), os nomes
-- a tirar, as categorias em uso e as prioridades. Nada de outros pedidos ou unidades.
create function ia_entrada(p_texto text, p_unidade uuid, p_contato uuid, c ia_condominio) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'texto', left(p_texto, 6000),
    'nomes', coalesce((select jsonb_agg(distinct x.nome) from (
                select ct.nome from contatos ct where ct.id = p_contato and ct.nome is not null
                union all
                select ct.nome from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                 where cu.unidade_id = p_unidade and ct.nome is not null) x), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by lower(nome)) from categorias where ativa), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'significado', significado, 'nivel', nivel) order by nivel)
                               from prioridades where ativa), '[]'::jsonb),
    'provedor', c.provedor, 'modelo', c.modelo_sugerir)
$$;

-- O relato do pedido com as transcrições prontas dos áudios dele.
create function ia_texto_do_pedido(p pedidos) returns text
language sql stable
set search_path = public
as $$
  select concat_ws(E'\n', 'Assunto: ' || p.assunto, 'Relato: ' || p.descricao,
                   case when p.local is not null then 'Local informado: ' || p.local end,
                   (select string_agg('Áudio (transcrição automática): ' || t.texto, E'\n' order by m.enviada_em)
                      from transcricoes_ia t join mensagens_whatsapp m on m.id = t.mensagem_id
                     where m.pedido_id = p.id and t.estado = 'PRONTA'))
$$;

-- ---------------------------------------------------------------------------------------
-- 3. Configurações › Ajuda da IA (síndico): ler e ligar ou desligar cada função.

create function plataforma_ajuda_ia(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c ia_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  c := ia_cfg();
  return jsonb_strip_nulls(jsonb_build_object(
    'ligadaTriade', c.ligada, 'motivoTriade', case when not c.ligada then c.motivo end,
    'sugerir', jsonb_build_object('ligada', c.sugerir, 'situacao', ia_situacao(c, 'SUGERIR')),
    'transcrever', jsonb_build_object('ligada', c.transcrever, 'situacao', ia_situacao(c, 'TRANSCREVER'),
                                      'servico', c.provedor_transcricao <> 'NENHUM'),
    'uso', ia_uso_json(c),
    'versao', c.versao,
    'pode', jsonb_build_object('editar', c.ligada and pode_por_vinculo(p_pessoa, p_condominio, 'config.editar'))));
end $$;

create function plataforma_definir_ajuda_ia(p_pessoa uuid, p_condominio uuid, p_versao integer, p_sugerir boolean, p_transcrever boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c ia_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  if not pode_por_vinculo(p_pessoa, p_condominio, 'config.editar') then
    raise exception 'Ligar e desligar a IA é com o condomínio' using errcode = 'TC401';
  end if;
  c := ia_cfg();
  if not c.ligada then perform recusar_motivo('A TRÍADE desligou a IA deste condomínio', 'IA_DESLIGADA_TRIADE'); end if;
  if p_sugerir is null or p_transcrever is null then perform recusar_campos('Diga o que fica ligado', 'sugerir', 'transcrever'); end if;
  update ia_condominio
     set sugerir = p_sugerir, transcrever = p_transcrever,
         sugerir_desde = case when p_sugerir and not sugerir then app_now() else sugerir_desde end,
         transcrever_desde = case when p_transcrever and not transcrever then app_now() else transcrever_desde end
   where id = c.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('ia_condominio', c.id); end if;
  if (p_sugerir, p_transcrever) is distinct from (c.sugerir, c.transcrever) then
    perform registrar_historico('ia.funcoes', 'ia_condominio', c.id::text, jsonb_build_object('sugerir', p_sugerir, 'transcrever', p_transcrever));
  end if;
  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------
-- 4. A sugestão no pedido (IA-17, IA-11 triagem, IA-15).

-- Pedir a sugestão de um pedido. Uma por pedido: o que já foi sugerido volta sem nova chamada.
-- p_provedores: os provedores que a API tem agora (sem a chave, nenhum).
create function plataforma_pedir_sugestao_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid, p_provedores text[]) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  c ia_condominio;
  s sugestoes_ia;
  v_desde timestamptz;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, p, 'pedidos.atualizar');
  select * into s from sugestoes_ia where pedido_id = p.id for update;
  -- Já resolvida (pronta, decidida, sem sugestão, limite): volta como está.
  if s.id is not null and (s.estado not in ('FALHA', 'PREPARANDO') or s.preparando_desde > app_now() - interval '2 minutes') then
    return jsonb_build_object('sugestao', sugestao_ia_json(s));
  end if;
  c := ia_cfg();
  v_desde := ia_desde(c, 'SUGERIR');
  if p.estado not in ('ABERTO', 'EM_ANDAMENTO') or v_desde is null or p.criado_em < v_desde
     or not (c.provedor = any (coalesce(p_provedores, '{}'))) then
    return jsonb_build_object('sugestao', case when s.id is not null then sugestao_ia_json(s) end, 'indisponivel', true);
  end if;
  if ia_situacao(c, 'SUGERIR') = 'LIMITE' then
    if s.id is null then
      perform definir_transicao('LIMITE_DO_MES');
      insert into sugestoes_ia (condominio_id, pedido_id, estado, criado_por) values (p_condominio, p.id, 'LIMITE', p_pessoa) returning * into s;
    elsif s.estado = 'FALHA' then
      perform definir_transicao('LIMITE_DO_MES');
      update sugestoes_ia set estado = 'LIMITE' where id = s.id returning * into s;
    end if;
    return jsonb_build_object('sugestao', sugestao_ia_json(s));
  end if;
  perform definir_transicao('PEDIDA');
  if s.id is null then
    insert into sugestoes_ia (condominio_id, pedido_id, estado, criado_por, preparando_desde)
    values (p_condominio, p.id, 'PREPARANDO', p_pessoa, app_now()) returning * into s;
  else
    update sugestoes_ia set estado = 'PREPARANDO', preparando_desde = app_now() where id = s.id returning * into s;
  end if;
  return jsonb_build_object('sugestao', sugestao_ia_json(s),
                            'entrada', ia_entrada(ia_texto_do_pedido(p), p.unidade_id, p.contato_id, c));
end $$;

-- Pedir a sugestão no registro, antes de o pedido existir: o mesmo relato não pede de novo.
create function plataforma_pedir_sugestao_registro(p_pessoa uuid, p_condominio uuid, p_assunto text, p_relato text, p_local text,
                                                   p_unidade uuid, p_provedores text[]) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c ia_condominio;
  s sugestoes_ia;
  v_texto text := concat_ws(E'\n', 'Assunto: ' || nullif(btrim(coalesce(p_assunto, '')), ''), 'Relato: ' || btrim(coalesce(p_relato, '')),
                            'Local informado: ' || nullif(btrim(coalesce(p_local, '')), ''));
  v_hash text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.atualizar');
  if length(btrim(coalesce(p_relato, ''))) < 15 then perform recusar_campos('Escreva o relato antes', 'relato'); end if;
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  v_hash := md5(v_texto);
  select * into s from sugestoes_ia
   where pedido_id is null and relato_hash = v_hash and criado_por = p_pessoa and criado_em > app_now() - interval '1 hour'
     and estado in ('PRONTA', 'SEM_SUGESTAO', 'LIMITE')
   order by criado_em desc limit 1;
  if s.id is not null then return jsonb_build_object('sugestao', sugestao_ia_json(s)); end if;
  c := ia_cfg();
  if ia_desde(c, 'SUGERIR') is null or not (c.provedor = any (coalesce(p_provedores, '{}'))) then
    return jsonb_build_object('indisponivel', true);
  end if;
  if ia_situacao(c, 'SUGERIR') = 'LIMITE' then
    return jsonb_build_object('sugestao', jsonb_build_object('estado', 'LIMITE', 'renovaEm', to_char(ia_renova_em(), 'YYYY-MM-DD')));
  end if;
  perform definir_transicao('PEDIDA');
  insert into sugestoes_ia (condominio_id, estado, relato_hash, criado_por, preparando_desde)
  values (p_condominio, 'PREPARANDO', v_hash, p_pessoa, app_now()) returning * into s;
  return jsonb_build_object('sugestao', sugestao_ia_json(s), 'entrada', ia_entrada(v_texto, p_unidade, null, c));
end $$;

-- O que a IA respondeu, já interpretado pela API. p_resultado: ok, provedor, modelo, tokensEntrada,
-- tokensSaida, custoMicros, moeda e, quando ok, categoriaId, prioridadeId, local, porque, confianca.
-- Registra a chamada (NG-13) e guarda a sugestão; nada muda no pedido.
create function plataforma_resultado_sugestao(p_pessoa uuid, p_condominio uuid, p_sugestao uuid, p_resultado jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s sugestoes_ia;
  r jsonb := coalesce(p_resultado, '{}'::jsonb);
  v_ok boolean := coalesce((r ->> 'ok')::boolean, false);
  v_cat uuid;
  v_pri uuid;
  v_resultado text;
  v_chamada uuid;
  v_local text := nullif(left(btrim(coalesce(r ->> 'local', '')), 120), '');
  v_porque text := nullif(left(btrim(coalesce(r ->> 'porque', '')), 400), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into s from sugestoes_ia where id = p_sugestao and criado_por is not distinct from p_pessoa for update;
  if s.id is null or s.estado <> 'PREPARANDO' then raise exception 'Sugestão não encontrada' using errcode = 'TC404'; end if;
  if v_ok then
    begin
      v_cat := (r ->> 'categoriaId')::uuid;
      v_pri := (r ->> 'prioridadeId')::uuid;
    exception when others then v_cat := null; v_pri := null;
    end;
    v_resultado := case
      when coalesce(r ->> 'confianca', 'BAIXA') = 'BAIXA' then 'SEM_CONFIANCA'
      when not exists (select 1 from categorias where id = v_cat and ativa)
        or not exists (select 1 from prioridades where id = v_pri and ativa) then 'FORA_DO_USO'
      else 'OK' end;
  else
    v_resultado := 'FALHA';
  end if;
  insert into chamadas_ia (condominio_id, funcao, provedor, modelo, tokens_entrada, tokens_saida, custo_micros, moeda, resultado, pedido_id)
  values (p_condominio, 'SUGERIR', coalesce(nullif(r ->> 'provedor', ''), 'DESCONHECIDO'), left(coalesce(nullif(r ->> 'modelo', ''), '?'), 60),
          greatest(coalesce((r ->> 'tokensEntrada')::integer, 0), 0), greatest(coalesce((r ->> 'tokensSaida')::integer, 0), 0),
          greatest(coalesce((r ->> 'custoMicros')::bigint, 0), 0), coalesce(nullif(r ->> 'moeda', ''), 'USD'), v_resultado, s.pedido_id)
  returning id into v_chamada;
  if v_resultado = 'OK' then
    perform definir_transicao('SUGERIDA');
    update sugestoes_ia set estado = 'PRONTA', categoria_id = v_cat, prioridade_id = v_pri, local = case when length(v_local) >= 2 then v_local end,
                            porque = case when length(v_porque) >= 3 then v_porque end, confianca = r ->> 'confianca', chamada_id = v_chamada,
                            preparando_desde = null
     where id = s.id returning * into s;
    if s.pedido_id is not null then
      perform registrar_historico('pedido.sugestao_pronta', 'pedidos', s.pedido_id::text, jsonb_build_object(
        'sugestao', s.id, 'categoria', (select c.nome from categorias c where c.id = v_cat), 'prioridade', (select x.nome from prioridades x where x.id = v_pri)));
    end if;
  elsif v_resultado = 'FALHA' then
    perform definir_transicao('FALHOU');
    update sugestoes_ia set estado = 'FALHA', chamada_id = v_chamada, preparando_desde = null where id = s.id returning * into s;
  else
    -- Sem confiança ou com categoria fora de uso: não há cartão, o pedido fica como sempre foi.
    perform definir_transicao('SEM_SUGESTAO');
    update sugestoes_ia set estado = 'SEM_SUGESTAO', chamada_id = v_chamada, preparando_desde = null where id = s.id returning * into s;
  end if;
  return jsonb_build_object('sugestao', sugestao_ia_json(s));
end $$;

-- Usar a sugestão (com algum campo trocado ou não) ou escolher outra coisa. Usar preenche os
-- três campos pelo caminho de sempre (plataforma_alterar_pedido); o histórico guarda o que a IA
-- tinha sugerido quando a escolha é outra. Sem campos e sem usar: só dispensa o cartão.
create function plataforma_decidir_sugestao(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_usar boolean,
                                            p_categoria uuid, p_prioridade uuid, p_local text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  s sugestoes_ia;
  v_cat uuid;
  v_pri uuid;
  v_local text;
  v_igual boolean;
  v_versao integer;
  v_dispensa boolean := not coalesce(p_usar, false) and p_categoria is null and p_prioridade is null and p_local is null;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, p, 'pedidos.atualizar');
  select * into s from sugestoes_ia where pedido_id = p.id for update;
  if s.id is null or s.estado <> 'PRONTA' then
    perform recusar_motivo('A sugestão já foi decidida ou não existe', 'SUGESTAO_DECIDIDA');
  end if;
  v_versao := p.versao;
  if not v_dispensa then
    v_cat := coalesce(p_categoria, case when p_usar then s.categoria_id end, p.categoria_id);
    v_pri := coalesce(p_prioridade, case when p_usar then s.prioridade_id end, p.prioridade_id);
    v_local := coalesce(nullif(btrim(coalesce(p_local, '')), ''), case when p_usar then s.local end, p.local);
    v_versao := (plataforma_alterar_pedido(p_pessoa, p_condominio, p_id, p_versao, v_cat, v_pri, v_local, null) ->> 'versao')::integer;
  end if;
  v_igual := not v_dispensa and v_cat = s.categoria_id and v_pri = s.prioridade_id
             and (s.local is null or v_local is not distinct from s.local);
  perform definir_transicao(case when v_igual then 'USADA' else 'ESCOLHEU_OUTRA' end);
  update sugestoes_ia set estado = case when v_igual then 'USADA' else 'RECUSADA' end, decidida_em = app_now(), decidida_por = p_pessoa,
                          escolha = case when v_igual or v_dispensa then null else jsonb_strip_nulls(jsonb_build_object(
                            'categoria', (select nome from categorias where id = v_cat), 'prioridade', (select nome from prioridades where id = v_pri),
                            'local', v_local)) end
   where id = s.id returning * into s;
  perform registrar_historico(case when v_igual then 'pedido.sugestao_usada' else 'pedido.sugestao_recusada' end, 'pedidos', p.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'sugestao', s.id, 'dispensou', case when v_dispensa then true end,
      'categoria', (select nome from categorias where id = s.categoria_id), 'prioridade', (select nome from prioridades where id = s.prioridade_id),
      'local', s.local,
      'escolhida', case when not v_igual and not v_dispensa then jsonb_strip_nulls(jsonb_build_object(
                     'categoria', (select nome from categorias where id = v_cat), 'prioridade', (select nome from prioridades where id = v_pri),
                     'local', v_local)) end)));
  return jsonb_build_object('versao', v_versao, 'sugestao', sugestao_ia_json(s));
end $$;

-- Depois do registro: a sugestão mostrada no formulário vai para o pedido, como usada (o que
-- foi registrado é o que a IA sugeriu) ou como escolha de outra coisa.
create function plataforma_sugestao_no_registro(p_pessoa uuid, p_condominio uuid, p_sugestao uuid, p_pedido uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  s sugestoes_ia;
  v_igual boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_pedido);
  select * into s from sugestoes_ia where id = p_sugestao and pedido_id is null and criado_por = p_pessoa and estado = 'PRONTA' for update;
  if s.id is null or p.criado_por is distinct from p_pessoa or exists (select 1 from sugestoes_ia where pedido_id = p.id) then
    return null;
  end if;
  v_igual := p.categoria_id = s.categoria_id and p.prioridade_id = s.prioridade_id and (s.local is null or p.local is not distinct from s.local);
  perform definir_transicao(case when v_igual then 'USADA' else 'ESCOLHEU_OUTRA' end);
  update sugestoes_ia set pedido_id = p.id, estado = case when v_igual then 'USADA' else 'RECUSADA' end, decidida_em = app_now(), decidida_por = p_pessoa,
                          escolha = case when v_igual then null else jsonb_strip_nulls(jsonb_build_object(
                            'categoria', (select nome from categorias where id = p.categoria_id),
                            'prioridade', (select nome from prioridades where id = p.prioridade_id), 'local', p.local)) end
   where id = s.id returning * into s;
  perform registrar_historico(case when v_igual then 'pedido.sugestao_usada' else 'pedido.sugestao_recusada' end, 'pedidos', p.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'sugestao', s.id, 'noRegistro', true,
      'categoria', (select nome from categorias where id = s.categoria_id), 'prioridade', (select nome from prioridades where id = s.prioridade_id),
      'local', s.local, 'escolhida', s.escolha)));
  return jsonb_build_object('estado', s.estado);
end $$;

-- ---------------------------------------------------------------------------------------
-- 5. A transcrição do áudio (W-06).

create function transcricao_ia_json(t transcricoes_ia) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'estado', t.estado, 'texto', t.texto, 'segundos', t.segundos,
    'renovaEm', case when t.estado = 'LIMITE' then to_char(ia_renova_em(), 'YYYY-MM-DD') end))
$$;

-- Começa a transcrição (já no condomínio do contexto). p_segundos: a duração lida do arquivo,
-- quando dá para saber; com ela, o áudio que passaria do limite não começa.
create function iniciar_transcricao(m mensagens_whatsapp, p_provedores text[], p_segundos integer) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  c ia_condominio := ia_cfg();
  t transcricoes_ia;
  v_desde timestamptz := ia_desde(c, 'TRANSCREVER');
  v_sistema boolean := contexto_pessoa() is null;
begin
  select * into t from transcricoes_ia where mensagem_id = m.id for update;
  if t.id is not null and t.estado <> 'FALHA' then return jsonb_build_object('transcricao', transcricao_ia_json(t)); end if;
  -- Sem serviço, função desligada ou áudio de antes de ligar: aparece só o áudio, sem aviso de texto.
  if m.tipo <> 'AUDIO' or m.midia_situacao is distinct from 'LIBERADA' or v_desde is null or m.recebida_em < v_desde
     or c.provedor_transcricao = 'NENHUM' or not (c.provedor_transcricao = any (coalesce(p_provedores, '{}'))) then
    return jsonb_build_object('transcricao', case when t.id is not null then transcricao_ia_json(t) end, 'indisponivel', true);
  end if;
  if ia_situacao(c, 'TRANSCREVER') = 'LIMITE'
     or (p_segundos is not null and ia_uso('TRANSCREVER') + p_segundos > c.limite_transcricao_min * 60) then
    perform definir_transicao('LIMITE_DO_MES', null, v_sistema);
    if t.id is null then
      insert into transcricoes_ia (condominio_id, mensagem_id, estado) values (m.condominio_id, m.id, 'LIMITE') returning * into t;
    else
      update transcricoes_ia set estado = 'LIMITE', atualizado_em = app_now() where id = t.id returning * into t;
    end if;
    return jsonb_build_object('transcricao', transcricao_ia_json(t));
  end if;
  perform definir_transicao('PEDIDA', null, v_sistema);
  if t.id is null then
    insert into transcricoes_ia (condominio_id, mensagem_id, estado) values (m.condominio_id, m.id, 'TRANSCREVENDO') returning * into t;
  else
    update transcricoes_ia set estado = 'TRANSCREVENDO', atualizado_em = app_now() where id = t.id returning * into t;
  end if;
  return jsonb_build_object('transcricao', transcricao_ia_json(t), 'id', t.id, 'caminho', m.midia_caminho, 'tipo', m.midia_tipo,
                            'provedor', c.provedor_transcricao);
end $$;

-- Chamada pela API depois de guardar o áudio do WhatsApp.
create function whatsapp_iniciar_transcricao(p_condominio uuid, p_mensagem uuid, p_provedores text[], p_segundos integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  v jsonb;
begin
  perform entrar_como_sistema(p_condominio);
  select * into m from mensagens_whatsapp where id = p_mensagem;
  if m.id is null then perform entrar_como_sistema(null); return jsonb_build_object('indisponivel', true); end if;
  v := iniciar_transcricao(m, p_provedores, p_segundos);
  perform entrar_como_sistema(null);
  return v;
end $$;

-- Tentar de novo pelo painel, quando falhou (não conta duas vezes: a falha não entra no limite).
create function plataforma_tentar_transcricao(p_pessoa uuid, p_condominio uuid, p_mensagem uuid, p_provedores text[], p_segundos integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  t transcricoes_ia;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into m from mensagens_whatsapp where id = p_mensagem and pedido_id is not null;
  if m.id is null or not pedido_visivel(p_pessoa, (select x from pedidos x where x.id = m.pedido_id)) then
    raise exception 'Áudio não encontrado' using errcode = 'TC404';
  end if;
  select * into t from transcricoes_ia where mensagem_id = m.id;
  if t.id is null or t.estado <> 'FALHA' then
    perform recusar_motivo('Só tenta de novo o áudio que não deu para transcrever', 'TRANSCRICAO_SEM_FALHA');
  end if;
  return iniciar_transcricao(m, p_provedores, p_segundos);
end $$;

-- O que o serviço de transcrição devolveu: ok, provedor, modelo, segundos, custoMicros, moeda e texto.
-- Texto vazio (muito curto, só barulho) fica sem transcrição: aparece só o áudio.
create function whatsapp_resultado_transcricao(p_condominio uuid, p_transcricao uuid, p_resultado jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t transcricoes_ia;
  m mensagens_whatsapp;
  r jsonb := coalesce(p_resultado, '{}'::jsonb);
  v_ok boolean := coalesce((r ->> 'ok')::boolean, false);
  v_texto text := nullif(left(btrim(coalesce(r ->> 'texto', '')), 8000), '');
  v_seg integer := least(greatest(coalesce((r ->> 'segundos')::integer, 0), 0), 86400);
  v_chamada uuid;
begin
  perform entrar_como_sistema(p_condominio);
  select * into t from transcricoes_ia where id = p_transcricao for update;
  if t.id is null or t.estado <> 'TRANSCREVENDO' then perform entrar_como_sistema(null); return null; end if;
  select * into m from mensagens_whatsapp where id = t.mensagem_id;
  insert into chamadas_ia (condominio_id, funcao, provedor, modelo, segundos_audio, custo_micros, moeda, resultado, pedido_id, mensagem_id)
  values (p_condominio, 'TRANSCREVER', coalesce(nullif(r ->> 'provedor', ''), 'DESCONHECIDO'), left(coalesce(nullif(r ->> 'modelo', ''), '?'), 60),
          case when v_ok then v_seg else 0 end, case when v_ok then greatest(coalesce((r ->> 'custoMicros')::bigint, 0), 0) else 0 end,
          coalesce(nullif(r ->> 'moeda', ''), 'USD'), case when not v_ok then 'FALHA' when v_texto is null then 'VAZIA' else 'OK' end,
          m.pedido_id, m.id)
  returning id into v_chamada;
  if not v_ok then
    perform definir_transicao('FALHOU', null, true);
    update transcricoes_ia set estado = 'FALHA', chamada_id = v_chamada, atualizado_em = app_now() where id = t.id returning * into t;
  elsif v_texto is null then
    perform definir_transicao('SEM_TEXTO', null, true);
    update transcricoes_ia set estado = 'SEM_TRANSCRICAO', segundos = v_seg, chamada_id = v_chamada, atualizado_em = app_now() where id = t.id returning * into t;
  else
    perform definir_transicao('TRANSCRITA', null, true);
    update transcricoes_ia set estado = 'PRONTA', texto = v_texto, segundos = v_seg, chamada_id = v_chamada, atualizado_em = app_now()
     where id = t.id returning * into t;
    if m.pedido_id is not null then
      perform registrar_historico('pedido.audio_transcrito', 'pedidos', m.pedido_id::text, jsonb_build_object('mensagem', m.id, 'segundos', v_seg));
    end if;
  end if;
  perform entrar_como_sistema(null);
  return jsonb_build_object('transcricao', transcricao_ia_json(t));
end $$;

-- ---------------------------------------------------------------------------------------
-- 6. O que a ficha do pedido mostra: a sugestão, as transcrições dos áudios e se dá para pedir.

create function plataforma_ia_do_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  c ia_condominio;
  s sugestoes_ia;
  v_desde timestamptz;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_id);
  c := ia_cfg();
  select * into s from sugestoes_ia where pedido_id = p.id;
  v_desde := ia_desde(c, 'SUGERIR');
  return jsonb_strip_nulls(jsonb_build_object(
    'sugestao', case when s.id is not null then sugestao_ia_json(s) end,
    'transcricoes', coalesce((select jsonb_object_agg(t.mensagem_id, transcricao_ia_json(t))
                                from transcricoes_ia t join mensagens_whatsapp m on m.id = t.mensagem_id where m.pedido_id = p.id), '{}'::jsonb),
    'sugerir', ia_situacao(c, 'SUGERIR'),
    'transcrever', case when c.provedor_transcricao = 'NENHUM' then 'SEM_SERVICO' else ia_situacao(c, 'TRANSCREVER') end,
    'pode', jsonb_build_object(
      'decidir', pode_no_pedido(p_pessoa, p, 'pedidos.atualizar') and p.estado in ('ABERTO', 'EM_ANDAMENTO'),
      -- Pedir a sugestão quando o pedido chegou com a função ligada e ainda não tem uma.
      'pedir', pode_no_pedido(p_pessoa, p, 'pedidos.atualizar') and p.estado in ('ABERTO', 'EM_ANDAMENTO') and v_desde is not null
               and p.criado_em >= v_desde and (s.id is null or s.estado = 'FALHA'))));
end $$;

-- ---------------------------------------------------------------------------------------
-- 7. Console: o cartão IA e custo (NG-13, NG-15), a chave e o limite.

create function ia_custos_mes(p_funcao text) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'chamadas', count(*), 'falhas', count(*) filter (where resultado = 'FALHA'),
    'custoMicros', coalesce(sum(custo_micros) filter (where moeda = 'USD'), 0),
    'custoMicrosReais', coalesce(sum(custo_micros) filter (where moeda = 'BRL'), 0))
    from chamadas_ia where funcao = p_funcao and criado_em >= ia_inicio_mes()
$$;

create function console_ia_cliente(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c ia_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ia.ver');
  c := ia_cfg();
  return jsonb_strip_nulls(jsonb_build_object(
    'ligada', c.ligada, 'motivo', c.motivo, 'mudadaEm', c.mudada_em, 'mudadaPor', nome_pessoa(c.mudada_por),
    'provedor', c.provedor, 'modelo', c.modelo_sugerir, 'provedorTranscricao', c.provedor_transcricao,
    'sugerir', jsonb_build_object('ligada', c.sugerir, 'usadas', ia_uso('SUGERIR'), 'limite', c.limite_sugestoes) || ia_custos_mes('SUGERIR'),
    'transcrever', jsonb_build_object('ligada', c.transcrever, 'segundos', ia_uso('TRANSCREVER'), 'minutos', ceil(ia_uso('TRANSCREVER') / 60.0)::integer,
                                      'limite', c.limite_transcricao_min,
                                      'audios', (select count(*) from chamadas_ia where funcao = 'TRANSCREVER' and resultado <> 'FALHA' and criado_em >= ia_inicio_mes()))
                   || ia_custos_mes('TRANSCREVER'),
    'renovaEm', to_char(ia_renova_em(), 'YYYY-MM-DD'),
    'versao', c.versao,
    'pode', jsonb_build_object('chave', pode(p_pessoa, p_condominio, 'console.ia.chave'), 'limite', pode(p_pessoa, p_condominio, 'console.ia.limite'))));
end $$;

-- As chamadas do mês, da mais nova para a mais antiga (até 200).
create function console_ia_chamadas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ia.ver');
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', x.id, 'em', x.criado_em, 'funcao', x.funcao, 'provedor', x.provedor, 'modelo', x.modelo, 'tokensEntrada', x.tokens_entrada,
            'tokensSaida', x.tokens_saida, 'segundos', x.segundos_audio, 'custoMicros', x.custo_micros, 'moeda', x.moeda, 'resultado', x.resultado,
            'protocolo', (select protocolo from pedidos where id = x.pedido_id))) order by x.criado_em desc)
             from (select * from chamadas_ia where criado_em >= ia_inicio_mes() order by criado_em desc limit 200) x), '[]'::jsonb);
end $$;

-- A chave que desliga (ou liga) a IA do condomínio. Só a Administração; desligar pede motivo. Fica no
-- histórico interno do cliente e no histórico da equipe.
create function console_ia_chave(p_pessoa uuid, p_condominio uuid, p_versao integer, p_ligada boolean, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c ia_condominio;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ia.chave');
  c := ia_cfg();
  if p_ligada is null then perform recusar_campos('Diga se liga ou desliga', 'ligada'); end if;
  if not p_ligada and (v_motivo is null or length(v_motivo) not between 3 and 300) then
    perform recusar_campos('Diga o motivo (3 a 300 caracteres)', 'motivo');
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
  update ia_condominio set ligada = p_ligada, motivo = v_motivo, mudada_em = app_now(), mudada_por = p_pessoa,
                           ligada_em = case when p_ligada and not ligada then app_now() else ligada_em end
   where id = c.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('ia_condominio', c.id); end if;
  if p_ligada is distinct from c.ligada then
    perform registrar_historico_interno('ia.chave', 'ia_condominio', c.id::text, jsonb_strip_nulls(jsonb_build_object('ligada', p_ligada, 'motivo', v_motivo)));
    -- O histórico da equipe (sem condomínio no contexto do evento, como as mudanças da equipe).
    insert into historico (ocorrido_em, condominio_id, autor_tipo, autor_id, acao, entidade, entidade_id, dados, interno)
    values (app_now(), null, 'PESSOA', p_pessoa, 'ia.chave', 'condominios', p_condominio::text,
            jsonb_strip_nulls(jsonb_build_object('ligada', p_ligada, 'motivo', v_motivo, 'condominio', p_condominio,
                                                 'cliente', (select x.nome from condominios x where x.id = p_condominio))), true);
  end if;
  return jsonb_build_object('versao', v_versao, 'ligada', p_ligada);
end $$;

-- O limite do mês e o conector (provedor e modelo). Nulo mantém o que está.
create function console_ia_ajustar(p_pessoa uuid, p_condominio uuid, p_versao integer, p_limite_sugestoes integer, p_limite_minutos integer,
                                   p_provedor text, p_modelo text, p_provedor_transcricao text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c ia_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ia.limite');
  c := ia_cfg();
  if p_limite_sugestoes is not null and p_limite_sugestoes not between 0 and 100000 then perform recusar_campos('Limite de 0 a 100000', 'limiteSugestoes'); end if;
  if p_limite_minutos is not null and p_limite_minutos not between 0 and 100000 then perform recusar_campos('Limite de 0 a 100000', 'limiteMinutos'); end if;
  begin
    update ia_condominio set limite_sugestoes = coalesce(p_limite_sugestoes, limite_sugestoes),
                             limite_transcricao_min = coalesce(p_limite_minutos, limite_transcricao_min),
                             provedor = coalesce(p_provedor, provedor), modelo_sugerir = coalesce(p_modelo, modelo_sugerir),
                             provedor_transcricao = coalesce(p_provedor_transcricao, provedor_transcricao)
     where id = c.id and versao = p_versao returning versao into v_versao;
  exception when check_violation then perform recusar_campos('Provedor ou modelo fora do esperado', 'provedor', 'modelo', 'provedorTranscricao');
  end;
  if v_versao is null then perform conflito_versao('ia_condominio', c.id); end if;
  perform registrar_historico_interno('ia.ajuste', 'ia_condominio', c.id::text, jsonb_strip_nulls(jsonb_build_object(
    'limiteSugestoes', p_limite_sugestoes, 'limiteMinutos', p_limite_minutos, 'provedor', p_provedor, 'modelo', p_modelo,
    'provedorTranscricao', p_provedor_transcricao)));
  return jsonb_build_object('versao', v_versao);
end $$;

call fechar_acesso();

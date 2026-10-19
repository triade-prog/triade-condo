-- Textos do WhatsApp e janela de 24h (D3, F5.4; W-08, W-12, W-13, W-16, W-20, W-22, AT-13),
-- no desenho docs/telas/textos-janela.html, aprovado em 19/10/2026.
--
-- A Nina, assistente virtual, assina as mensagens automáticas (W-22); retorno, conclusão e
-- resposta à revisão levam o nome de quem atende. A confirmação traz o horário de atendimento
-- cadastrado e o fora do horário diz quando é o próximo. O pedido que nasceu no WhatsApp avisa
-- o morador quando é concluído (AT-13). A janela de 24h (W-20) vale para todo envio, também no
-- piloto: dentro dela, texto livre; fora, só com modelo aprovado (os modelos são da TRÍADE,
-- iguais para todos, com versão e situação); sem modelo, o envio vira falha com responsável;
-- resposta automática atrasada é cancelada; PARAR barra o que o condomínio inicia fora da janela.

insert into funcao_acoes (funcao, acao) values ('ADMINISTRACAO', 'console.whatsapp.modelos');

-- ---------------------------------------------------------------------------------------
-- Modelos de mensagem (W-20): globais, com versão. Aprovado não se edita; mudar cria versão
-- nova, que só vale depois de aprovada. No piloto, a administração aprova; no oficial, a Meta.

create function modelo_corpo_valido(p_corpo text, p_n integer) returns boolean
language sql immutable
set search_path = public
as $$
  select p_corpo !~ '^\s*\{\{' and p_corpo !~ '\}\}\s*$'
     and regexp_replace(p_corpo, '\{\{[1-9][0-9]*\}\}', '', 'g') !~ '\{|\}'
     and (select coalesce(array_agg(distinct x[1]::integer order by x[1]::integer), '{}')
            from regexp_matches(p_corpo, '\{\{([1-9][0-9]*)\}\}', 'g') x)
       = (select coalesce(array_agg(i order by i), '{}') from generate_series(1, p_n) i)
$$;

create table modelos_whatsapp (
  id           uuid primary key default gen_random_uuid(),
  chave        text not null check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida',
                                               'aviso_pedido_novo', 'aviso_retorno_vencido', 'aviso_revisao')),
  numero       integer not null check (numero >= 1),
  titulo       text not null check (length(btrim(titulo)) between 3 and 60),
  para         text not null check (para in ('MORADOR', 'EQUIPE')),
  uso          text not null check (length(btrim(uso)) between 3 and 120),
  categoria    text not null default 'UTILIDADE' check (categoria = 'UTILIDADE'),
  idioma       text not null default 'pt_BR' check (idioma = 'pt_BR'),
  variaveis    jsonb not null check (jsonb_typeof(variaveis) = 'array' and jsonb_array_length(variaveis) between 1 and 9),
  corpo        text not null check (length(btrim(corpo)) between 20 and 1024),
  rodape       text check (length(btrim(rodape)) between 3 and 60),
  situacao     text not null default 'RASCUNHO'
               check (situacao in ('RASCUNHO', 'APROVADO_PILOTO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'PAUSADO', 'DESATIVADO')),
  motivo       text check (length(btrim(motivo)) between 3 and 300),
  nota         text check (length(btrim(nota)) between 3 and 200),
  criado_em    timestamptz not null default app_now(),
  criado_por   uuid references pessoas (id),
  decidido_em  timestamptz,
  decidido_por uuid references pessoas (id),
  versao       integer not null default 1,
  unique (chave, numero),
  check (modelo_corpo_valido(corpo, jsonb_array_length(variaveis))),
  check (para = 'EQUIPE' or rodape is not null)
);
call proteger_tabela_global('modelos_whatsapp', 'Modelos de mensagem da TRÍADE, iguais para todos os condomínios (W-20)');
create trigger modelos_whatsapp_sem_exclusao before delete on modelos_whatsapp for each row execute function somente_insercao();
create trigger controle_versao before update on modelos_whatsapp for each row execute function controle_versao();

-- Cada decisão sobre um modelo fica registrada (quem, quando, para qual situação e por quê).
create table modelos_whatsapp_eventos (
  id         bigint generated always as identity primary key,
  modelo_id  uuid not null references modelos_whatsapp (id),
  situacao   text not null,
  motivo     text,
  em         timestamptz not null default app_now(),
  por        uuid references pessoas (id)
);
call proteger_tabela_global('modelos_whatsapp_eventos', 'Histórico dos modelos de mensagem da TRÍADE (W-20)');
create trigger modelos_whatsapp_eventos_sem_mudanca before update or delete on modelos_whatsapp_eventos
  for each row execute function somente_insercao();

create function modelos_whatsapp_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.chave, new.numero, new.titulo, new.para, new.uso, new.variaveis, new.categoria, new.idioma, new.criado_em, new.criado_por)
     is distinct from
     (old.chave, old.numero, old.titulo, old.para, old.uso, old.variaveis, old.categoria, old.idioma, old.criado_em, old.criado_por) then
    raise exception 'O modelo não muda de identidade' using errcode = 'TC422';
  end if;
  if (new.corpo, new.rodape) is distinct from (old.corpo, old.rodape) and old.situacao <> 'RASCUNHO' then
    raise exception 'Modelo fora do rascunho não se edita: crie uma versão nova' using errcode = 'TC422';
  end if;
  if new.situacao is distinct from old.situacao and not (
       (old.situacao = 'RASCUNHO' and new.situacao in ('APROVADO_PILOTO', 'ENVIADO'))
    or (old.situacao = 'APROVADO_PILOTO' and new.situacao in ('ENVIADO', 'DESATIVADO'))
    or (old.situacao = 'ENVIADO' and new.situacao in ('APROVADO', 'RECUSADO'))
    or (old.situacao = 'APROVADO' and new.situacao in ('PAUSADO', 'DESATIVADO'))
    or (old.situacao = 'PAUSADO' and new.situacao in ('APROVADO', 'DESATIVADO'))) then
    raise exception 'Mudança de situação do modelo não permitida' using errcode = 'TC409';
  end if;
  if new.situacao in ('RECUSADO', 'PAUSADO') and new.situacao is distinct from old.situacao and new.motivo is null then
    raise exception 'Diga o motivo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger modelos_whatsapp_regras before update on modelos_whatsapp for each row execute function modelos_whatsapp_regras();

-- Os seis modelos, como aprovados no desenho. Nenhum começa nem termina com variável (regra da
-- Meta); os do morador terminam com o jeito de parar (W-16).
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('noticia_pedido', 1, 'Notícia do pedido', 'MORADOR', 'Retorno escrito no pedido, com a conversa fechada',
   '["protocolo", "condomínio", "texto do retorno", "quem escreveu"]',
   E'Notícia do seu pedido {{1}} no {{2}}:\n\n{{3}}\n\n{{4}}, do condomínio\n\nPara responder, é só mandar mensagem aqui.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now()),
  ('pedido_concluido', 1, 'Pedido concluído', 'MORADOR', 'Conclusão de pedido que nasceu no WhatsApp',
   '["protocolo", "condomínio", "o que foi feito", "quem concluiu", "revisar até"]',
   E'O pedido {{1}} no {{2}} foi concluído.\nO que foi feito: {{3}}\n\n{{4}}, do condomínio\n\nSe não resolveu, responda REVISAR e conte o que continua acontecendo, até {{5}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now()),
  ('revisao_respondida', 1, 'Revisão respondida', 'MORADOR', 'Pedido mantido concluído, com a conversa fechada',
   '["protocolo", "condomínio", "resposta", "quem respondeu"]',
   E'Resposta ao seu pedido de revisão do {{1}} no {{2}}:\n\n{{3}}\n\n{{4}}, do condomínio\n\nPara responder, é só mandar mensagem aqui.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now()),
  ('aviso_pedido_novo', 1, 'Pedido novo', 'EQUIPE', 'Aviso que a pessoa ligou',
   '["condomínio", "protocolo", "assunto e unidade", "link do painel"]',
   E'Pedido novo no {{1}}.\n{{2}} · {{3}}\n\nAbrir no painel: {{4}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.',
   null, 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now()),
  ('aviso_retorno_vencido', 1, 'Retorno vencido', 'EQUIPE', 'Aviso que a pessoa ligou',
   '["condomínio", "protocolo", "assunto e unidade", "quando venceu", "responsável", "link do painel"]',
   E'Retorno vencido no {{1}}.\n{{2}} · {{3}}\nVenceu {{4}} · responsável: {{5}}\n\nAbrir no painel: {{6}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.',
   null, 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now()),
  ('aviso_revisao', 1, 'Pedido de revisão', 'EQUIPE', 'Aviso que a pessoa ligou',
   '["condomínio", "protocolo", "assunto e unidade", "link do painel"]',
   E'Pedido de revisão no {{1}}.\n{{2}} · {{3}}\n\nAbrir no painel: {{4}}\nEste aviso vai porque você ligou em Configurações › WhatsApp.',
   null, 'APROVADO_PILOTO', 'Aprovado com o desenho dos textos em 19/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo) select id, situacao, nota from modelos_whatsapp;

-- O modelo que vale para uma chave: a versão aprovada mais nova. No piloto vale também o
-- aprovado no piloto; no conector oficial, só o aprovado pela Meta.
create function modelo_em_uso(p_chave text, p_oficial boolean) returns modelos_whatsapp
language sql stable
set search_path = public
as $$
  select * from modelos_whatsapp
   where chave = p_chave and (situacao = 'APROVADO' or (situacao = 'APROVADO_PILOTO' and not coalesce(p_oficial, false)))
   order by numero desc limit 1
$$;

-- Texto do modelo com as variáveis: cada uma em parágrafo único (a variável não leva quebra).
create function renderizar_modelo(m modelos_whatsapp, p jsonb) returns text
language plpgsql immutable
set search_path = public
as $$
declare
  v text := m.corpo;
  i integer;
begin
  for i in reverse jsonb_array_length(m.variaveis)..1 loop
    v := replace(v, '{{' || i || '}}', regexp_replace(btrim(coalesce(p ->> (i - 1), '')), '\s+', ' ', 'g'));
  end loop;
  return v || coalesce(E'\n\n' || m.rodape, '');
end $$;

-- ---------------------------------------------------------------------------------------
-- Colunas novas.

alter table mensagens_whatsapp add column chegou_atrasada boolean not null default false;

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO'));
alter table envios_whatsapp
  add column modelo_chave      text check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida',
                                                            'aviso_pedido_novo', 'aviso_retorno_vencido', 'aviso_revisao')),
  add column modelo_parametros jsonb check (jsonb_typeof(modelo_parametros) = 'array'),
  add column modelo_id         uuid references modelos_whatsapp (id),
  add column texto_enviado     text check (length(texto_enviado) between 1 and 4096),
  add constraint envios_whatsapp_modelo check ((modelo_chave is null) = (modelo_parametros is null));

-- ---------------------------------------------------------------------------------------
-- Ajudantes dos textos.

create function nome_do_condominio() returns text
language sql stable
set search_path = public
as $$ select nome from condominios where id = contexto_condominio() $$;

-- "8h", "8h30", "24h".
create function hora_curta(p text) returns text
language sql immutable
set search_path = public
as $$ select (split_part(p, ':', 1)::integer)::text || 'h' || case when split_part(p, ':', 2) in ('', '00') then '' else split_part(p, ':', 2) end $$;

-- O horário de atendimento em palavras ("em dias úteis, das 8h às 18h"). Dias com horários
-- diferentes, ou sem horário, ficam no genérico.
create function descrever_atendimento() returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_intervalos jsonb;
  v_dias integer[];
  v_horas text[];
  v_nomes text[] := array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  v_texto_dias text;
  v_lista text[];
begin
  select intervalos into v_intervalos from horarios where tipo = 'ATENDIMENTO';
  if v_intervalos is null or jsonb_array_length(v_intervalos) = 0 then return 'no horário de atendimento'; end if;
  select array_agg(dia order by dia), array_agg(distinct faixas) into v_dias, v_horas
    from (select (x ->> 'dia')::integer as dia,
                 string_agg('das ' || hora_curta(x ->> 'inicio') || ' às ' || hora_curta(x ->> 'fim'), ' e ' order by x ->> 'inicio') as faixas
            from jsonb_array_elements(v_intervalos) x group by 1) d;
  if cardinality(v_horas) <> 1 then return 'no horário de atendimento'; end if;
  v_texto_dias := case
    when v_dias = array[1, 2, 3, 4, 5] then 'em dias úteis'
    when v_dias = array[1, 2, 3, 4, 5, 6] then 'de segunda a sábado'
    when v_dias = array[0, 1, 2, 3, 4, 5, 6] then 'todos os dias'
    else null end;
  if v_texto_dias is null then
    select array_agg(v_nomes[d + 1] order by d) into v_lista from unnest(v_dias) d;
    v_texto_dias := 'de ' || case when cardinality(v_lista) = 1 then v_lista[1]
                                  else array_to_string(v_lista[1:cardinality(v_lista) - 1], ', ') || ' e ' || v_lista[cardinality(v_lista)] end;
  end if;
  return v_texto_dias || ', ' || v_horas[1];
end $$;

-- "Próximo horário de atendimento: segunda, a partir das 8h." Sem horário cadastrado, nada.
create function texto_proximo_atendimento() returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := (select fuso from configuracao_condominio);
  v_prox timestamptz := proximo_horario('ATENDIMENTO', app_now());
  v_local timestamp;
  v_hoje date;
begin
  if v_fuso is null or v_prox <= app_now() then return null; end if;
  v_local := v_prox at time zone v_fuso;
  v_hoje := (app_now() at time zone v_fuso)::date;
  return 'Próximo horário de atendimento: '
      || case when v_local::date = v_hoje then 'hoje' when v_local::date = v_hoje + 1 then 'amanhã'
              else (array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])[extract(dow from v_local)::integer + 1] end
      || ', a partir das ' || hora_curta(to_char(v_local, 'HH24:MI')) || '.';
end $$;

-- Quando o retorno venceu ("às 14:00" ou "em 17/10 às 14:00").
create function quando_venceu(p timestamptz) returns text
language sql stable
set search_path = public
as $$
  select case when (p at time zone c.fuso)::date = (app_now() at time zone c.fuso)::date
              then 'às ' || to_char(p at time zone c.fuso, 'HH24:MI')
              else 'em ' || to_char(p at time zone c.fuso, 'DD/MM') || ' às ' || to_char(p at time zone c.fuso, 'HH24:MI') end
    from configuracao_condominio c where p is not null
$$;

-- Retorno e resposta de gente: o protocolo no começo e quem escreveu no fim.
create function texto_assinado(p pedidos, p_texto text, p_pessoa uuid) returns text
language sql stable
set search_path = public
as $$ select 'Sobre o pedido ' || p.protocolo || E':\n' || p_texto || E'\n\n' || nome_curto(nome_pessoa(p_pessoa)) || ', do condomínio' $$;

-- Parâmetros dos modelos de aviso à equipe. O link do painel a API põe no lugar de {{painel}}.
create function parametros_aviso(p_tipo text, p pedidos) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_array(nome_do_condominio(), p.protocolo,
           case when p.privado then 'pedido privado' else p.assunto end
           || coalesce(' (' || coalesce(rotulo_unidade(p.unidade_id), p.local) || ')', ''))
      || case when p_tipo = 'RETORNO_VENCIDO'
              then jsonb_build_array(coalesce(quando_venceu(p.proximo_retorno), 'agora'),
                                     coalesce(nome_do_vinculo(p.responsavel_id), 'sem responsável'))
              else '[]'::jsonb end
      || jsonb_build_array('{{painel}}')
$$;

-- A conversa fica aberta por 24 horas desde a última mensagem que a pessoa mandou ao número do
-- condomínio, pela hora do WhatsApp (W-20).
create function janela_ate(p_telefone text) returns timestamptz
language sql stable
set search_path = public
as $$
  select max(enviada_em) + interval '24 hours' from mensagens_whatsapp where telefone = any (variantes_telefone(p_telefone))
$$;

create function janela_aberta(p_telefone text) returns boolean
language sql stable
set search_path = public
as $$ select coalesce(janela_ate(p_telefone) > app_now(), false) $$;

-- ---------------------------------------------------------------------------------------
-- Textos da Nina, a assistente virtual (W-22, D3): ela se apresenta, fala por ela no que faz e
-- cita o condomínio no que depende de pessoas.

create or replace function menu_whatsapp(p_nome text) returns text
language sql stable
set search_path = public
as $$
  select 'Olá, ' || nome_curto(p_nome) || '. Sou a Nina, assistente virtual do ' || (select nome from condominios where id = contexto_condominio())
      || E'.\nResponda com o número:\n1 · Registrar um pedido novo\n2 · Ver meus pedidos\n3 · É só um recado'
$$;
create or replace function criar_pedido_whatsapp(p_conversa conversas_whatsapp, p_contato uuid, p_unidade uuid, p_texto text) returns pedidos
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_assunto text;
  v_resp uuid;
  v_ano integer;
  v_numero integer;
  v_protocolo text;
  v pedidos;
  m record;
  v_categoria uuid := categoria_whatsapp();
  v_prioridade uuid := prioridade_whatsapp();
begin
  select * into cfg from configuracao_condominio;
  v_assunto := left(btrim(split_part(coalesce(v_texto, ''), E'\n', 1)), 120);
  if length(v_assunto) < 3 then v_assunto := 'Pedido pelo WhatsApp'; end if;
  v_resp := cfg.responsavel_padrao;
  if not responsavel_disponivel(v_resp) then v_resp := null; end if;
  v_ano := extract(year from hoje_no_condominio())::integer;
  insert into protocolos_pedido as x (condominio_id, ano, ultimo) values (contexto_condominio(), v_ano, 1)
  on conflict (condominio_id, ano) do update set ultimo = x.ultimo + 1
  returning ultimo into v_numero;
  v_protocolo := v_ano || '-' || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;
  perform definir_transicao('REGISTRADO', null, true);
  insert into pedidos (condominio_id, protocolo, unidade_id, contato_id, categoria_id, prioridade_id, etapa_id, assunto, descricao,
                       canal, privado, estado, responsavel_id, responsavel_desde, proximo_retorno, criado_por)
  values (contexto_condominio(), v_protocolo, p_unidade, p_contato, v_categoria, v_prioridade,
          coalesce(etapa_inicial(v_categoria, 'ABERTO'), etapa_inicial(null, 'ABERTO')), v_assunto,
          case when length(v_texto) >= 3 then left(v_texto, 4000) else 'Pedido pelo WhatsApp: veja as mensagens e os arquivos.' end,
          'WHATSAPP', false, 'ABERTO', v_resp, case when v_resp is not null then app_now() end,
          calcular_proximo_retorno(v_categoria, v_prioridade), null)
  returning * into v;
  perform registrar_historico('pedido.registrado', 'pedidos', v.id::text, jsonb_strip_nulls(jsonb_build_object(
    'protocolo', v_protocolo, 'canal', 'WHATSAPP', 'responsavel', v_resp)));
  -- As mensagens desde as opções entram no pedido, com as mídias já conferidas.
  for m in update mensagens_whatsapp set pedido_id = v.id
            where telefone = p_conversa.telefone and pedido_id is null and triagem = 'CONVERSA'
              and recebida_em >= coalesce(p_conversa.menu_em, app_now()) - interval '1 minute'
           returning id
  loop
    perform anexar_midia_whatsapp(m.id);
  end loop;
  update conversas_whatsapp set etapa = 'ANEXANDO', etapa_ate = app_now() + make_interval(mins => cfg.whatsapp_anexar_minutos),
                                pedido_id = v.id, texto_pendente = null, atualizada_em = app_now()
   where id = p_conversa.id;
  perform avisar_whatsapp(quem_avisar_do_pedido(v), 'PEDIDO_NOVO', v.id, null, null, v.id::text);
  perform responder_whatsapp(p_conversa.telefone, p_contato, v.id,
    'Registrei o pedido ' || v_protocolo || ' (' || rotulo_unidade(p_unidade) || E').\n\n'
    || 'O que você mandar nos próximos ' || cfg.whatsapp_anexar_minutos || ' minutos, como foto, áudio ou documento, entra neste pedido.'
    || E'\n\nO que acontece agora: o condomínio confere os pedidos ' || descrever_atendimento() || ' e dá notícia por aqui. Em emergência, ligue 193.'
    || E'\n\n' || aviso_golpe_whatsapp());
  return v;
end $$;
create or replace function revisar_pelo_whatsapp(m mensagens_whatsapp, c conversas_whatsapp, p_contatos uuid[], p_texto text) returns void
language plpgsql
set search_path = public
as $$
declare
  p pedidos;
  v_motivo text := nullif(btrim(p_texto), '');
  v_id uuid;
begin
  select * into p from pedidos_do_morador(p_contatos) x
   where x.estado = 'ENCERRADO' and x.encerrado_em >= app_now() - interval '30 days'
   order by x.id = c.consultado_id desc, x.encerrado_em desc limit 1;
  if p.id is null then
    perform responder_whatsapp(m.telefone, m.contato_id, null,
      'Não há pedido seu concluído nos últimos 30 dias para revisar. Para registrar um novo, conte o que aconteceu.');
    return;
  end if;
  if v_motivo is null then
    perform responder_whatsapp(m.telefone, m.contato_id, p.id,
      'Conte o que continua acontecendo no pedido ' || p.protocolo || ': mande REVISAR e o motivo numa mensagem só.');
    return;
  end if;
  update mensagens_whatsapp set pedido_id = p.id where id = m.id;
  if exists (select 1 from revisoes_whatsapp where pedido_id = p.id and decidida_em is null) then
    perform responder_whatsapp(m.telefone, m.contato_id, p.id,
      'O pedido ' || p.protocolo || ' já está com um pedido de revisão. Quem cuida dele vai dar notícia por aqui.');
    return;
  end if;
  insert into revisoes_whatsapp (condominio_id, pedido_id, contato_id, mensagem_id, texto)
  values (m.condominio_id, p.id, p.contato_id, m.id, left(v_motivo, 2000)) returning id into v_id;
  perform registrar_historico('pedido.revisao_pedida', 'pedidos', p.id::text, jsonb_build_object('revisao', v_id, 'canal', 'WHATSAPP'));
  perform avisar_whatsapp(quem_avisar_do_pedido(p), 'REVISAO', p.id, m.id, null, v_id::text);
  perform responder_whatsapp(m.telefone, m.contato_id, p.id,
    'Anotei. Quem cuida do pedido ' || p.protocolo || ' vai avaliar e dar notícia por aqui. '
    || 'O pedido não reabre sozinho: uma pessoa do condomínio decide.');
end $$;
create or replace function processar_mensagem_whatsapp(m mensagens_whatsapp) returns void
language plpgsql
set search_path = public
as $$
declare
  c conversas_whatsapp;
  cfg configuracao_condominio;
  v_contatos uuid[];
  v_contato contatos;
  v_cmd text := upper(btrim(coalesce(m.texto, '')));
  v_texto text := nullif(btrim(coalesce(m.texto, '')), '');
  v_unidades record;
  v_n integer;
  v_escolha integer;
  v_unidade uuid;
  v_contato_unidade uuid;
  p pedidos;
begin
  select * into cfg from configuracao_condominio;
  insert into conversas_whatsapp (condominio_id, telefone) values (m.condominio_id, m.telefone)
  on conflict (condominio_id, telefone) do update set atualizada_em = app_now()
  returning * into c;
  v_contatos := contatos_do_telefone(m.telefone);

  -- Número sem vínculo confirmado (MU-02): nada é consultado nem registrado.
  if cardinality(v_contatos) = 0 then
    update mensagens_whatsapp set triagem = 'A_IDENTIFICAR' where id = m.id;
    if c.neutra_em is null or c.neutra_em < app_now() - interval '24 hours' then
      perform responder_whatsapp(m.telefone, null, null,
        'Olá. Sou a Nina, assistente virtual do ' || (select nome from condominios where id = m.condominio_id)
        || '. Recebi sua mensagem, mas este número ainda não está no cadastro do condomínio. Quem cuida do condomínio vai conferir.'
        || E'\n\nPor segurança, não mande documentos nem dados pessoais por aqui.\n\n' || aviso_golpe_whatsapp());
      update conversas_whatsapp set neutra_em = app_now() where id = c.id;
    end if;
    perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'A_IDENTIFICAR', null, m.id, null,
                            encode(extensions.digest(m.telefone, 'sha256'), 'hex') || ':' || hoje_no_condominio());
    return;
  end if;
  select * into v_contato from contatos where id = v_contatos[1];
  update mensagens_whatsapp set contato_id = v_contato.id where id = m.id;
  m.contato_id := v_contato.id;

  -- Parar e voltar a receber avisos (W-16).
  if v_cmd in ('PARAR', 'VOLTAR') then
    update contatos set whatsapp_parou_em = case when v_cmd = 'PARAR' then app_now() end
     where id = any (v_contatos) and (whatsapp_parou_em is null) = (v_cmd = 'PARAR');
    perform registrar_historico(case when v_cmd = 'PARAR' then 'contato.whatsapp_parou' else 'contato.whatsapp_voltou' end,
                                'contato', v_contato.id::text, '{}'::jsonb);
    perform responder_whatsapp(m.telefone, v_contato.id, null, case when v_cmd = 'PARAR'
      then 'Pronto: você não recebe mais avisos do condomínio por aqui. Você continua podendo mandar mensagens, e respondemos enquanto a conversa estiver aberta. Para voltar, mande VOLTAR.'
      else 'Pronto: você volta a receber os avisos do condomínio por aqui.' end);
    return;
  end if;
  if v_cmd ~ '^REVISAR\M' then
    perform revisar_pelo_whatsapp(m, c, v_contatos, substr(btrim(m.texto), 8));
    return;
  end if;

  if c.etapa <> 'INICIO' and (c.etapa_ate is null or c.etapa_ate < app_now()) then
    update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, texto_pendente = null where id = c.id returning * into c;
  end if;

  -- Ver os pedidos (W-09).
  if v_cmd = '2' and c.etapa <> 'UNIDADE' then
    update conversas_whatsapp set etapa = 'CONSULTA', etapa_ate = app_now() + interval '30 minutes', texto_pendente = null where id = c.id;
    perform responder_whatsapp(m.telefone, v_contato.id, null, lista_pedidos_whatsapp(v_contatos));
    return;
  end if;
  if v_cmd ~ '^([0-9]{4}-)?[0-9]{4,6}$' then
    select * into p from pedidos_do_morador(v_contatos) x
     where x.protocolo = v_cmd or split_part(x.protocolo, '-', 2) = v_cmd order by x.criado_em desc limit 1;
  end if;
  if v_cmd ~ '^([0-9]{4}-)?[0-9]{4,6}$' and (c.etapa = 'CONSULTA' or v_cmd ~ '-' or p.id is not null) then
    if p.id is null then
      perform responder_whatsapp(m.telefone, v_contato.id, null,
        'Não encontrei esse pedido entre os seus. Mande 2 para ver a lista.');
    else
      update conversas_whatsapp set consultado_id = p.id, etapa = 'CONSULTA', etapa_ate = app_now() + interval '30 minutes' where id = c.id;
      perform responder_whatsapp(m.telefone, v_contato.id, p.id, detalhe_pedido_whatsapp(p));
    end if;
    return;
  end if;

  if c.etapa = 'ANEXANDO' then
    update mensagens_whatsapp set pedido_id = c.pedido_id where id = m.id;
    perform anexar_midia_whatsapp(m.id);
    return;
  end if;

  if c.etapa = 'UNIDADE' then
    select count(*) into v_n from unidades_dos_contatos(v_contatos);
    v_escolha := case when v_cmd ~ '^[0-9]{1,2}$' then v_cmd::integer end;
    if v_escolha between 1 and v_n then
      select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos)
       order by rotulo, unidade_id offset v_escolha - 1 limit 1;
      perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, c.texto_pendente);
    else
      perform responder_whatsapp(m.telefone, v_contato.id, null, 'Responda só com o número da unidade, de 1 a ' || v_n || '.');
    end if;
    return;
  end if;

  if c.etapa = 'MENU' then
    if v_cmd = '1' then
      select count(*) into v_n from unidades_dos_contatos(v_contatos);
      if v_n > 1 then
        update conversas_whatsapp set etapa = 'UNIDADE', etapa_ate = app_now() + interval '30 minutes' where id = c.id;
        perform responder_whatsapp(m.telefone, v_contato.id, null,
          E'O pedido é de qual unidade?\n'
          || (select string_agg(row_number || ' · ' || rotulo, E'\n' order by row_number)
                from (select rotulo, row_number() over (order by rotulo, unidade_id) from unidades_dos_contatos(v_contatos)) x));
      elsif c.texto_pendente is null and not exists (
              select 1 from mensagens_whatsapp x where x.telefone = m.telefone and x.pedido_id is null and x.triagem = 'CONVERSA'
                                                   and x.midia_tipo is not null and x.recebida_em >= c.menu_em - interval '1 minute') then
        update conversas_whatsapp set etapa_ate = app_now() + interval '30 minutes' where id = c.id;
        perform responder_whatsapp(m.telefone, v_contato.id, null, 'Conte o que aconteceu numa mensagem só. Se tiver foto, pode mandar junto.');
      else
        select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos) limit 1;
        perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, c.texto_pendente);
      end if;
      return;
    elsif v_cmd = '3' then
      update mensagens_whatsapp set triagem = 'RECADO'
       where telefone = m.telefone and pedido_id is null and triagem = 'CONVERSA' and id <> m.id
         and recebida_em >= c.menu_em - interval '1 minute';
      update conversas_whatsapp set etapa = 'INICIO', etapa_ate = null, texto_pendente = null where id = c.id;
      perform responder_whatsapp(m.telefone, v_contato.id, null, 'Anotei o recado. Quem cuida do condomínio vai ler.');
      return;
    end if;
    -- Texto depois de escolher 1 sem descrever: vira o pedido. Senão, junta à descrição.
    if v_texto is not null and c.texto_pendente is null and exists (
         select 1 from mensagens_whatsapp x where x.telefone = m.telefone and x.texto = '1' and x.recebida_em > c.menu_em) then
      select count(*) into v_n from unidades_dos_contatos(v_contatos);
      if v_n = 1 then
        select unidade_id, contato_id into v_unidade, v_contato_unidade from unidades_dos_contatos(v_contatos);
        perform criar_pedido_whatsapp(c, v_contato_unidade, v_unidade, v_texto);
        return;
      end if;
    end if;
    if v_texto is not null then
      update conversas_whatsapp set texto_pendente = left(concat_ws(E'\n', texto_pendente, v_texto), 4000),
                                    etapa_ate = app_now() + interval '60 minutes'
       where id = c.id;
    end if;
    return;
  end if;

  -- Começo de conversa: o que ele escreveu fica guardado e vão as opções.
  update conversas_whatsapp set etapa = 'MENU', etapa_ate = app_now() + interval '60 minutes', texto_pendente = left(v_texto, 4000),
                                menu_em = app_now(), pedido_id = null
   where id = c.id;
  perform responder_whatsapp(m.telefone, v_contato.id, null, menu_whatsapp(v_contato.nome));

  -- Fora do horário de atendimento (W-12): uma vez por período, sem prazo.
  if not dentro_do_horario('ATENDIMENTO', app_now()) and (c.fora_horario_em is null or c.fora_horario_em < app_now() - interval '12 hours') then
    perform responder_whatsapp(m.telefone, v_contato.id, null, cfg.whatsapp_fora_horario || coalesce(E'\n\n' || texto_proximo_atendimento(), ''));
    update conversas_whatsapp set fora_horario_em = app_now() where id = c.id;
  end if;
end $$;
create or replace function whatsapp_midia_resultado(p_condominio uuid, p_mensagem uuid, p_tamanho integer, p_motivo text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  v_protocolo text;
  v_palavra text;
begin
  perform entrar_como_sistema(p_condominio);
  select * into m from mensagens_whatsapp where id = p_mensagem for update;
  if m.id is null or m.midia_situacao is distinct from 'BAIXAR' then perform entrar_como_sistema(null); return; end if;
  v_palavra := case m.tipo when 'IMAGEM' then 'Anexei a foto' when 'AUDIO' then 'Anexei o áudio' when 'VIDEO' then 'Anexei o vídeo'
                           else 'Anexei o documento' end;
  if p_motivo is null then
    update mensagens_whatsapp set midia_situacao = 'LIBERADA', midia_tamanho = p_tamanho,
                                  midia_caminho = 'whatsapp/' || m.condominio_id || '/' || m.id, midia_url = null
     where id = m.id;
    if anexar_midia_whatsapp(m.id) then
      select protocolo into v_protocolo from pedidos where id = m.pedido_id;
      perform responder_whatsapp(m.telefone, m.contato_id, m.pedido_id, v_palavra || ' ao pedido ' || v_protocolo || '.');
    end if;
  else
    update mensagens_whatsapp set midia_situacao = 'RECUSADA', midia_motivo = left(p_motivo, 300), midia_url = null where id = m.id;
    if m.contato_id is not null then
      perform responder_whatsapp(m.telefone, m.contato_id, m.pedido_id, 'Não consegui usar o arquivo: ' || left(p_motivo, 250));
    end if;
  end if;
  perform entrar_como_sistema(null);
end $$;

create or replace function whatsapp_receber(p_segredo text, p_instancia text, p_msg jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  m mensagens_whatsapp;
  v_tel text := telefone_whatsapp(p_msg ->> 'telefone');
  v_tipo text := p_msg ->> 'tipo';
  v_midia jsonb := p_msg -> 'midia';
  v_enviada timestamptz;
begin
  cx := entrar_por_gancho(p_segredo, p_instancia);
  if v_tel is null or coalesce(length(p_msg ->> 'id'), 0) not between 1 and 200
     or v_tipo is null or v_tipo not in ('TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'DOCUMENTO', 'OUTRO') then
    raise exception 'Mensagem inválida' using errcode = 'TC422';
  end if;
  -- Tipo que não dá para guardar (figurinha, localização, contato) sem texto vira OUTRO.
  if v_tipo <> 'TEXTO' and nullif(p_msg ->> 'texto', '') is null
     and coalesce(v_midia ->> 'tipo', '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                                  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4') then
    v_tipo := 'OUTRO';
  end if;
  if v_tipo = 'TEXTO' and nullif(p_msg ->> 'texto', '') is null then v_tipo := 'OUTRO'; end if;
  begin
    v_enviada := least(coalesce((p_msg ->> 'enviadaEm')::timestamptz, app_now()), app_now());
  exception when others then v_enviada := app_now();
  end;
  insert into mensagens_whatsapp (condominio_id, provedor_id, telefone, tipo, texto, enviada_em,
                                  midia_url, midia_tipo, midia_nome, midia_situacao, chegou_atrasada)
  values (cx.condominio_id, p_msg ->> 'id', v_tel, v_tipo, left(nullif(p_msg ->> 'texto', ''), 4096), v_enviada,
          v_midia ->> 'url',
          case when v_midia ->> 'tipo' in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                           'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4') then v_midia ->> 'tipo' end,
          left(nullif(btrim(v_midia ->> 'nome'), ''), 200),
          case when v_midia ->> 'tipo' in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf',
                                           'audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4')
                    and v_midia ->> 'url' is not null then 'BAIXAR' end,
          v_enviada < app_now() - interval '24 hours')
  on conflict (condominio_id, provedor_id) do nothing
  returning * into m;
  if m.id is null then
    perform entrar_como_sistema(null);
    return jsonb_build_object('repetida', true, 'midias', '[]'::jsonb);
  end if;
  update conexoes_whatsapp set ultima_recebida = app_now() where id = cx.id;
  -- Chegou depois de fechada a conversa (número desconectado por mais de um dia): nada de
  -- resposta automática fora da janela; vai para A identificar e alguém responde por outro meio.
  if m.chegou_atrasada then
    update mensagens_whatsapp set triagem = 'A_IDENTIFICAR', contato_id = (contatos_do_telefone(m.telefone))[1] where id = m.id;
    perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'A_IDENTIFICAR', null, m.id, null,
                            encode(extensions.digest(m.telefone, 'sha256'), 'hex') || ':' || hoje_no_condominio());
  else
    perform processar_mensagem_whatsapp(m);
  end if;
  perform entrar_como_sistema(null);
  return jsonb_build_object('repetida', false, 'mensagem', m.id, 'condominio', m.condominio_id,
    'midias', case when m.midia_situacao = 'BAIXAR' then jsonb_build_array(jsonb_build_object(
                'condominio', m.condominio_id, 'mensagem', m.id, 'url', m.midia_url, 'tipo', m.midia_tipo,
                'caminho', 'whatsapp/' || m.condominio_id || '/' || m.id)) else '[]'::jsonb end);
end $$;
create or replace function texto_aviso_whatsapp(p_tipo text, p pedidos) returns text
language sql stable
set search_path = public
as $$
  select (select nome from condominios where id = p.condominio_id) || ' · '
      || case p_tipo when 'PEDIDO_NOVO' then 'pedido novo' when 'RETORNO_VENCIDO' then 'retorno vencido' else 'pedido de revisão' end
      || E'\n' || p.protocolo || ' · ' || case when p.privado then 'pedido privado' else p.assunto end
      || coalesce(' (' || coalesce(rotulo_unidade(p.unidade_id), p.local) || ')', '')
      || case when p_tipo = 'RETORNO_VENCIDO' then coalesce(E'\nVenceu ' || quando_venceu(p.proximo_retorno), '')
              || coalesce(' · responsável: ' || nome_do_vinculo(p.responsavel_id), '') else '' end
$$;
create or replace function avisar_no_whatsapp(p_pessoa uuid, p_tipo text, p_pedido uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  a avisos_whatsapp_pessoa;
  p pedidos;
  v_envio uuid;
begin
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa and ligado and p_tipo = any (tipos);
  if a.id is null then return; end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then return; end if;
  select * into p from pedidos where id = p_pedido;
  if p.id is null or not pedido_visivel(p_pessoa, p) then return; end if;
  v_envio := enfileirar_whatsapp(a.telefone, null, p_pessoa, p.id, null, 'AVISO', texto_aviso_whatsapp(p_tipo, p), p_pessoa, null,
                                proximo_horario('FUNCIONAMENTO', app_now()));
  update envios_whatsapp set modelo_chave = case p_tipo when 'PEDIDO_NOVO' then 'aviso_pedido_novo' when 'RETORNO_VENCIDO' then 'aviso_retorno_vencido'
                                                    else 'aviso_revisao' end,
                            modelo_parametros = parametros_aviso(p_tipo, p)
   where id = v_envio;
end $$;
create or replace function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  e envios_whatsapp;
  cx conexoes_whatsapp;
  v_envios jsonb;
  v_saida jsonb := '[]'::jsonb;
  v_max integer := least(greatest(coalesce(p_max, 20), 1), 50);
  v_cancelar text;
  v_falhar text;
  v_texto text;
  v_modelo modelos_whatsapp;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    -- Travou no meio do envio: pode ter saído; não repete sozinho (W-14).
    for e in update envios_whatsapp set estado = 'DESCONHECIDO', motivo = 'O envio parou no meio: pode ter saído'
              where estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '5 minutes' returning * loop
      perform falha_whatsapp(e);
    end loop;
    select * into cx from conexoes_whatsapp where situacao = 'CONECTADO';
    continue when cx.id is null;
    v_envios := '[]'::jsonb;
    for e in select * from envios_whatsapp where estado = 'NA_FILA' and enviar_apos <= app_now()
              order by enviar_apos, criado_em limit v_max for update skip locked loop
      v_cancelar := case
        when e.contato_id is not null and not exists (select 1 from contatos where id = e.contato_id and dados_removidos_em is null)
          then 'Os dados do contato foram removidos'
        when e.finalidade = 'AVISO' and not exists (select 1 from avisos_whatsapp_pessoa a where a.pessoa_id = e.pessoa_id and a.ligado
                                                                                          and a.telefone = e.para)
          then 'A pessoa desligou os avisos no WhatsApp'
        when e.finalidade = 'AVISO' and not exists (select 1 from vinculos v where v.pessoa_id = e.pessoa_id and v.revogado_em is null
                                                                             and v.funcao in ('SINDICO', 'AUTORIZADO'))
          then 'A pessoa não tem mais acesso ao condomínio' end;
      -- Janela de 24h (W-20): fora dela, só com modelo aprovado; resposta automática atrasada
      -- é cancelada; quem pediu PARAR não recebe o que o condomínio inicia.
      v_falhar := null;
      v_texto := e.texto;
      v_modelo := null;
      if v_cancelar is null and not janela_aberta(e.para) then
        if e.modelo_chave is null then
          v_cancelar := 'A conversa no WhatsApp passou de 24 horas';
        elsif e.contato_id is not null and exists (select 1 from contatos where id = e.contato_id and whatsapp_parou_em is not null) then
          v_falhar := 'A pessoa pediu para parar de receber avisos';
        else
          v_modelo := modelo_em_uso(e.modelo_chave, cx.oficial);
          if v_modelo.id is null then
            v_falhar := 'Sem modelo aprovado para este envio';
          else
            v_texto := renderizar_modelo(v_modelo, e.modelo_parametros);
            if length(v_texto) > 1024 then v_falhar := 'O texto passa do tamanho que o modelo aceita'; end if;
          end if;
        end if;
      end if;
      if v_cancelar is not null then
        update envios_whatsapp set estado = 'CANCELADA', motivo = v_cancelar where id = e.id;
      elsif v_falhar is not null then
        update envios_whatsapp set estado = 'FALHOU', motivo = v_falhar where id = e.id returning * into e;
        perform falha_whatsapp(e);
      else
        update envios_whatsapp set estado = 'ENVIANDO', tentativas = tentativas + 1, enviar_apos = app_now(),
                                   modelo_id = v_modelo.id, texto_enviado = case when v_modelo.id is not null then v_texto end
         where id = e.id;
        v_envios := v_envios || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'envio', e.id, 'para', e.para, 'texto', v_texto,
          'pedido', case when e.finalidade = 'AVISO' then e.pedido_id end,
          'modelo', case when v_modelo.id is not null then jsonb_build_object('chave', v_modelo.chave, 'versao', v_modelo.versao,
                                                                             'parametros', e.modelo_parametros) end)));
      end if;
    end loop;
    if jsonb_array_length(v_envios) > 0 then
      v_saida := v_saida || jsonb_build_array(jsonb_build_object(
        'condominio', r.id, 'provedor', cx.provedor, 'instancia', cx.instancia,
        'credenciais', encode(cx.credenciais, 'base64'), 'envios', v_envios));
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_saida;
end $$;
create or replace function plataforma_reenviar_whatsapp(p_pessoa uuid, p_condominio uuid, p_envio uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if not pode(p_pessoa, p_condominio, 'pedidos.responder') then raise exception 'Sem permissão' using errcode = 'TC401'; end if;
  e := exigir_falha(p_envio);
  if length(v_motivo) is null or length(v_motivo) not between 3 and 300 then perform recusar_campos('Diga o motivo (3 a 300 caracteres)', 'motivo'); end if;
  if e.contato_id is not null and not exists (select 1 from contatos where id = e.contato_id and dados_removidos_em is null) then
    perform recusar_motivo('Os dados do contato foram removidos', 'CONTATO_REMOVIDO');
  end if;
  insert into envios_whatsapp (condominio_id, para, contato_id, pessoa_id, pedido_id, andamento_id, finalidade, texto, responsavel,
                               criado_por, reenvio_de, modelo_chave, modelo_parametros)
  values (e.condominio_id, coalesce((select telefone from contatos where id = e.contato_id), e.para), e.contato_id, e.pessoa_id,
          e.pedido_id, e.andamento_id, e.finalidade, e.texto, p_pessoa, coalesce(e.criado_por, p_pessoa), e.id,
          e.modelo_chave, e.modelo_parametros)
  returning id into v_id;
  update envios_whatsapp set resolvida_em = app_now(), resolvida_por = p_pessoa, resolucao = left('Reenviado: ' || v_motivo, 300) where id = e.id;
  if e.pedido_id is not null then
    perform registrar_historico('pedido.whatsapp_reenviado', 'pedidos', e.pedido_id::text, jsonb_build_object('envio', v_id, 'motivo', v_motivo));
  end if;
  return jsonb_build_object('id', v_id);
end $$;
create or replace function plataforma_whatsapp(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  select * into cx from conexoes_whatsapp;
  return jsonb_build_object(
    'numero', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'resumo', resumo_whatsapp(),
    'aIdentificar', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', m.id, 'telefone', m.telefone, 'tipo', m.tipo, 'texto', m.texto, 'enviadaEm', m.enviada_em, 'triagem', m.triagem,
               'atrasada', case when m.chegou_atrasada then true end,
               'contato', case when m.contato_id is not null then jsonb_build_object('id', m.contato_id,
                            'nome', (select nome from contatos where id = m.contato_id), 'unidades', unidades_do_contato(m.contato_id)) end,
               'vinculoPendente', exists (select 1 from contatos ct join contatos_unidade cu on cu.contato_id = ct.id and cu.estado = 'PENDENTE'
                                           where ct.telefone = any (variantes_telefone(m.telefone))),
               'midia', case when m.midia_tipo is not null then jsonb_build_object('tipo', m.midia_tipo, 'situacao', m.midia_situacao,
                                                                                   'motivo', m.midia_motivo) end))
             order by m.enviada_em desc)
        from (select * from mensagens_whatsapp where triagem in ('A_IDENTIFICAR', 'RECADO') order by enviada_em desc limit 100) m), '[]'::jsonb),
    'falhas', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', e.id, 'finalidade', e.finalidade, 'estado', e.estado, 'motivo', e.motivo, 'tentativas', e.tentativas,
               'criadoEm', e.criado_em, 'texto', e.texto, 'responsavel', nome_pessoa(e.responsavel),
               'para', coalesce((select nome from contatos where id = e.contato_id), nome_pessoa(e.pessoa_id)),
               'unidades', case when e.contato_id is not null then unidades_do_contato(e.contato_id) end,
               'pedido', case when p.id is not null then jsonb_build_object('id', p.id, 'protocolo', p.protocolo) end))
             order by e.criado_em desc)
        from envios_whatsapp e left join pedidos p on p.id = e.pedido_id and pedido_visivel(p_pessoa, p)
       where e.estado in ('FALHOU', 'DESCONHECIDO') and e.resolvida_em is null), '[]'::jsonb),
    'pode', jsonb_build_object('triar', pode(p_pessoa, p_condominio, 'pedidos.atualizar'),
                               'ligar', pode(p_pessoa, p_condominio, 'moradores.editar'),
                               'reenviar', pode(p_pessoa, p_condominio, 'pedidos.responder')));
end $$;
create or replace function plataforma_pedido_whatsapp(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos;
  ct contatos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  p := exigir_pedido(p_pessoa, p_id);
  select * into ct from contatos where id = p.contato_id;
  return jsonb_build_object(
    'mensagens', coalesce((
      select jsonb_agg(x.item order by x.em, x.ordem)
        from (
          select m.enviada_em as em, 0 as ordem, jsonb_strip_nulls(jsonb_build_object(
                   'id', m.id, 'lado', 'MORADOR', 'tipo', m.tipo, 'texto', m.texto, 'em', m.enviada_em,
                   'autor', (select nome from contatos where id = m.contato_id),
                   'midia', case when m.midia_tipo is not null then jsonb_build_object('tipo', m.midia_tipo, 'situacao', m.midia_situacao,
                                                                                       'motivo', m.midia_motivo, 'arquivoId', m.arquivo_id) end)) as item
            from mensagens_whatsapp m where m.pedido_id = p.id
          union all
          select e.criado_em, 1, jsonb_strip_nulls(jsonb_build_object(
                   'id', e.id, 'lado', 'CONDOMINIO', 'tipo', 'TEXTO', 'texto', coalesce(e.texto_enviado, e.texto), 'em', e.criado_em, 'modelo', case when e.modelo_id is not null then true end,
                   'finalidade', e.finalidade, 'autor', nome_pessoa(e.criado_por), 'estado', e.estado, 'motivo', e.motivo,
                   'resolvida', e.resolvida_em is not null))
            from envios_whatsapp e where e.pedido_id = p.id and e.finalidade in ('RESPOSTA', 'RETORNO', 'CONCLUSAO')) x), '[]'::jsonb),
    'janela', janela_do_pedido(p, ct, p_pessoa),
    'revisoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', r.id, 'texto', r.texto, 'em', r.criado_em,
                                                            'decisao', r.decisao, 'decididaEm', r.decidida_em,
                                                            'decididaPor', nome_pessoa(r.decidida_por), 'resposta', r.resposta))
                       order by r.criado_em desc)
        from revisoes_whatsapp r where r.pedido_id = p.id), '[]'::jsonb),
    'pode', jsonb_build_object(
      'responder', pode_no_pedido(p_pessoa, p, 'pedidos.responder') and p.estado in ('ABERTO', 'EM_ANDAMENTO')
                   and ct.id is not null and ct.dados_removidos_em is null and ct.telefone is not null
                   and exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS'),
      'decidirRevisao', pode_no_pedido(p_pessoa, p, 'pedidos.responder')));
end $$;
create or replace function plataforma_responder_whatsapp(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_texto text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  ct contatos;
  v_proximo timestamptz;
  v_versao integer;
  v_andamento uuid;
  v_envio uuid;
  v_aberta boolean;
  v_aviso text;
  v_modelo modelos_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  perform exigir_acao_no_pedido(p_pessoa, v, 'pedidos.responder');
  perform exigir_em_andamento(v);
  select * into ct from contatos where id = v.contato_id;
  if ct.id is null or ct.dados_removidos_em is not null or ct.telefone is null then
    perform recusar_motivo('O pedido não tem contato com WhatsApp', 'SEM_CONTATO');
  end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then
    perform recusar_motivo('O WhatsApp do condomínio não está ligado', 'SEM_WHATSAPP');
  end if;
  if length(btrim(coalesce(p_texto, ''))) not between 3 and 2000 then
    perform recusar_campos('Escreva a resposta (3 a 2000 caracteres)', 'texto');
  end if;
  v_aberta := janela_aberta(ct.telefone);
  if not v_aberta and length(btrim(p_texto)) > 800 then
    perform recusar_motivo('Com a conversa fechada, o WhatsApp aceita até 800 caracteres', 'LONGO_FORA_DA_JANELA');
  end if;
  if not v_aberta then
    v_modelo := modelo_em_uso('noticia_pedido', (select oficial from conexoes_whatsapp));
    v_aviso := case when ct.whatsapp_parou_em is not null then 'PAROU' when v_modelo.id is null then 'SEM_MODELO' end;
  end if;
  v_proximo := calcular_proximo_retorno(v.categoria_id, v.prioridade_id);
  update pedidos set proximo_retorno = v_proximo where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('pedidos', p_id); end if;
  insert into andamentos_pedido (condominio_id, pedido_id, tipo, meio, texto, criado_por)
  values (p_condominio, p_id, 'RETORNO', 'WHATSAPP', btrim(p_texto), p_pessoa) returning id into v_andamento;
  v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, p_id, v_andamento, 'RETORNO', texto_assinado(v, btrim(p_texto), p_pessoa),
                                p_pessoa, p_pessoa);
  update envios_whatsapp set modelo_chave = 'noticia_pedido',
                            modelo_parametros = jsonb_build_array(v.protocolo, nome_do_condominio(), btrim(p_texto), nome_curto(nome_pessoa(p_pessoa)))
   where id = v_envio;
  perform registrar_historico('pedido.retorno_registrado', 'pedidos', p_id::text, jsonb_build_object(
    'andamento', v_andamento, 'meio', 'WHATSAPP', 'envio', v_envio, 'de', v.proximo_retorno, 'para', v_proximo));
  return jsonb_strip_nulls(jsonb_build_object('versao', v_versao, 'proximoRetorno', v_proximo, 'envio', v_envio, 'aviso', v_aviso));
end $$;
create or replace function plataforma_manter_revisao_whatsapp(p_pessoa uuid, p_condominio uuid, p_revisao uuid, p_resposta text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r revisoes_whatsapp;
  p pedidos;
  ct contatos;
  v_resposta text := nullif(btrim(coalesce(p_resposta, '')), '');
  v_envio uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  select * into r from revisoes_whatsapp where id = p_revisao and decidida_em is null for update;
  if r.id is null then raise exception 'Pedido de revisão não encontrado' using errcode = 'TC404'; end if;
  p := exigir_pedido(p_pessoa, r.pedido_id);
  perform exigir_acao_no_pedido(p_pessoa, p, 'pedidos.responder');
  if length(v_resposta) is null or length(v_resposta) not between 3 and 2000 then
    perform recusar_campos('Escreva a resposta ao morador (3 a 2000 caracteres)', 'resposta');
  end if;
  update revisoes_whatsapp set decidida_em = app_now(), decidida_por = p_pessoa, decisao = 'MANTIDO', resposta = v_resposta where id = r.id;
  select * into ct from contatos where id = r.contato_id;
  if ct.dados_removidos_em is null and ct.telefone is not null then
    v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, p.id, null, 'RESPOSTA', texto_assinado(p, v_resposta, p_pessoa), p_pessoa, p_pessoa);
    update envios_whatsapp set modelo_chave = 'revisao_respondida',
                              modelo_parametros = jsonb_build_array(p.protocolo, nome_do_condominio(), v_resposta, nome_curto(nome_pessoa(p_pessoa)))
     where id = v_envio;
  end if;
  perform registrar_historico('pedido.revisao_mantida', 'pedidos', p.id::text, jsonb_build_object('revisao', r.id));
  return jsonb_build_object('decisao', 'MANTIDO');
end $$;
-- ---------------------------------------------------------------------------------------
-- A janela na conversa do pedido (W-20): aberta até quando, o limite do texto e, fechada,
-- como a mensagem vai chegar pelo modelo ({{texto}} a tela troca pelo que a pessoa escreve).

create function janela_do_pedido(p pedidos, ct contatos, p_pessoa uuid) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_ate timestamptz;
  v_aberta boolean;
  v_modelo modelos_whatsapp;
begin
  if ct.id is null or ct.telefone is null or ct.dados_removidos_em is not null then return null; end if;
  v_ate := janela_ate(ct.telefone);
  v_aberta := coalesce(v_ate > app_now(), false);
  if not v_aberta then v_modelo := modelo_em_uso('noticia_pedido', (select oficial from conexoes_whatsapp)); end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'aberta', v_aberta, 'ate', case when v_aberta then v_ate end, 'limite', case when v_aberta then 2000 else 800 end,
    'parou', ct.whatsapp_parou_em is not null,
    'modelo', case when v_modelo.id is not null then jsonb_build_object(
                'titulo', v_modelo.titulo,
                'previa', renderizar_modelo(v_modelo, jsonb_build_array(p.protocolo, nome_do_condominio(), '{{texto}}',
                                                                        nome_curto(nome_pessoa(p_pessoa))))) end));
end $$;

-- ---------------------------------------------------------------------------------------
-- A conclusão vai ao morador (AT-13) quando o pedido nasceu no WhatsApp: o que foi feito, quem
-- concluiu e até quando dá para pedir revisão.

-- Chamada quando o pedido encerra e quando a conclusão é gravada: a conclusão pode vir antes
-- (revisão aprovada depois) ou depois (encerra na hora) da mudança de estado. Manda uma vez.
create function conclusao_ao_morador(p_pedido uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  p pedidos;
  ct contatos;
  c conclusoes_pedido;
  v_envio uuid;
  v_ate text;
begin
  select * into p from pedidos where id = p_pedido;
  if p.id is null or p.estado <> 'ENCERRADO' or p.canal <> 'WHATSAPP' then return; end if;
  if not exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS') then return; end if;
  select * into ct from contatos where id = p.contato_id;
  if ct.id is null or ct.telefone is null or ct.dados_removidos_em is not null then return; end if;
  select * into c from conclusoes_pedido where pedido_id = p.id order by concluida_em desc limit 1;
  if c.id is null then return; end if;
  if exists (select 1 from envios_whatsapp where pedido_id = p.id and finalidade = 'CONCLUSAO' and criado_em >= c.concluida_em) then return; end if;
  v_ate := dia_mes(coalesce(p.encerrado_em, app_now()) + interval '30 days');
  v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, p.id, null, 'CONCLUSAO',
    'Pedido ' || p.protocolo || E' concluído.\nO que foi feito: ' || c.explicacao
    || E'\n\n' || nome_curto(nome_pessoa(c.concluida_por)) || E', do condomínio\n\n'
    || 'Se não resolveu, responda REVISAR e conte o que continua acontecendo, até ' || v_ate || '.',
    c.concluida_por, coalesce(contexto_pessoa(), c.concluida_por));
  update envios_whatsapp set modelo_chave = 'pedido_concluido',
                             modelo_parametros = jsonb_build_array(p.protocolo, nome_do_condominio(), left(c.explicacao, 600),
                                                                   nome_curto(nome_pessoa(c.concluida_por)), v_ate)
   where id = v_envio;
end $$;

create function conclusao_ao_morador_pedido() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'ENCERRADO' and old.estado is distinct from 'ENCERRADO' then perform conclusao_ao_morador(new.id); end if;
  return new;
end $$;
create trigger conclusao_ao_morador after update of estado on pedidos for each row execute function conclusao_ao_morador_pedido();

create function conclusao_ao_morador_gravada() returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform conclusao_ao_morador(new.pedido_id);
  return new;
end $$;
create trigger conclusao_ao_morador after insert on conclusoes_pedido for each row execute function conclusao_ao_morador_gravada();

-- ---------------------------------------------------------------------------------------
-- Console › WhatsApp › Modelos de mensagem (W-20): ver é de quem vê o WhatsApp; escrever e
-- decidir, só da administração.

create function modelo_json(m modelos_whatsapp) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'chave', m.chave, 'numero', m.numero, 'titulo', m.titulo, 'para', m.para, 'uso', m.uso, 'categoria', m.categoria,
    'idioma', m.idioma, 'variaveis', m.variaveis, 'corpo', m.corpo, 'rodape', m.rodape, 'situacao', m.situacao,
    'motivo', m.motivo, 'nota', m.nota, 'criadoEm', m.criado_em, 'criadoPor', nome_pessoa(m.criado_por),
    'decididoEm', m.decidido_em, 'decididoPor', nome_pessoa(m.decidido_por), 'versao', m.versao))
$$;

create function console_modelos_whatsapp(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.whatsapp.ver');
  return jsonb_build_object(
    'modelos', coalesce((
      select jsonb_agg(modelo_json(m) || jsonb_strip_nulls(jsonb_build_object(
               'emUsoPiloto', (modelo_em_uso(m.chave, false)).numero, 'emUsoOficial', (modelo_em_uso(m.chave, true)).numero))
             order by array_position(array['noticia_pedido', 'pedido_concluido', 'revisao_respondida',
                                           'aviso_pedido_novo', 'aviso_retorno_vencido', 'aviso_revisao'], m.chave))
        from (select distinct on (chave) * from modelos_whatsapp order by chave, numero desc) m), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode_global('console.whatsapp.modelos')));
end $$;

create function console_modelo_whatsapp(p_pessoa uuid, p_chave text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.whatsapp.ver');
  if not exists (select 1 from modelos_whatsapp where chave = p_chave) then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'versoes', (select jsonb_agg(modelo_json(m) order by m.numero desc) from modelos_whatsapp m where m.chave = p_chave),
    'eventos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('numero', m.numero, 'situacao', e.situacao,
                                                                               'motivo', e.motivo, 'em', e.em, 'por', nome_pessoa(e.por)))
                                          order by e.em desc, e.id desc)
                           from modelos_whatsapp_eventos e join modelos_whatsapp m on m.id = e.modelo_id where m.chave = p_chave), '[]'::jsonb),
    'emUsoPiloto', (modelo_em_uso(p_chave, false)).numero, 'emUsoOficial', (modelo_em_uso(p_chave, true)).numero,
    'pode', jsonb_build_object('editar', pode_global('console.whatsapp.modelos')));
end $$;

-- Escreve o rascunho: p_numero nulo cria a versão seguinte (copiando o resto da anterior);
-- com número, edita o rascunho daquela versão.
create function console_salvar_modelo_whatsapp(p_pessoa uuid, p_chave text, p_numero integer, p_versao integer, p_corpo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a modelos_whatsapp;
  v_corpo text := btrim(coalesce(p_corpo, ''));
  v_n integer;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.whatsapp.modelos');
  select * into a from modelos_whatsapp where chave = p_chave order by numero desc limit 1;
  if a.id is null then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if length(v_corpo) not between 20 and 1024 or not modelo_corpo_valido(v_corpo, jsonb_array_length(a.variaveis)) then
    perform recusar_campos('Use as variáveis {{1}} a {{' || jsonb_array_length(a.variaveis)
                           || '}}, sem começar nem terminar com uma delas (20 a 1024 caracteres)', 'corpo');
  end if;
  if p_numero is null then
    if exists (select 1 from modelos_whatsapp where chave = p_chave and situacao in ('RASCUNHO', 'ENVIADO')) then
      perform recusar_motivo('Já há uma versão em rascunho ou em análise', 'MODELO_PENDENTE');
    end if;
    insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, criado_por)
    values (a.chave, a.numero + 1, a.titulo, a.para, a.uso, a.variaveis, v_corpo, a.rodape, p_pessoa)
    returning numero, versao into v_n, v_versao;
    insert into modelos_whatsapp_eventos (modelo_id, situacao, por)
    select id, 'RASCUNHO', p_pessoa from modelos_whatsapp where chave = p_chave and numero = v_n;
    return jsonb_build_object('numero', v_n, 'versao', v_versao);
  end if;
  if not exists (select 1 from modelos_whatsapp where chave = p_chave and numero = p_numero and situacao = 'RASCUNHO') then
    perform recusar_motivo('Só o rascunho se edita: crie uma versão nova', 'MODELO_FECHADO');
  end if;
  update modelos_whatsapp set corpo = v_corpo where chave = p_chave and numero = p_numero and versao = p_versao returning versao into v_versao;
  if v_versao is null then
    raise exception 'O modelo mudou' using errcode = 'TC409',
      detail = jsonb_build_object('versao', (select versao from modelos_whatsapp where chave = p_chave and numero = p_numero))::text;
  end if;
  return jsonb_build_object('numero', p_numero, 'versao', v_versao);
end $$;

-- Muda a situação: aprovar no piloto, enviar à Meta, registrar a resposta da Meta, pausar ou
-- desativar. Recusado e pausado pedem o motivo.
create function console_decidir_modelo_whatsapp(p_pessoa uuid, p_chave text, p_numero integer, p_versao integer, p_situacao text,
                                                p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m modelos_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_console(p_pessoa, 'console.whatsapp.modelos');
  select * into m from modelos_whatsapp where chave = p_chave and numero = p_numero for update;
  if m.id is null then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if p_situacao in ('RECUSADO', 'PAUSADO') and (v_motivo is null or length(v_motivo) not between 3 and 300) then
    perform recusar_campos('Diga o motivo (3 a 300 caracteres)', 'motivo');
  end if;
  if not ((m.situacao = 'RASCUNHO' and p_situacao in ('APROVADO_PILOTO', 'ENVIADO'))
       or (m.situacao = 'APROVADO_PILOTO' and p_situacao in ('ENVIADO', 'DESATIVADO'))
       or (m.situacao = 'ENVIADO' and p_situacao in ('APROVADO', 'RECUSADO'))
       or (m.situacao = 'APROVADO' and p_situacao in ('PAUSADO', 'DESATIVADO'))
       or (m.situacao = 'PAUSADO' and p_situacao in ('APROVADO', 'DESATIVADO'))) then
    perform recusar_motivo('Esta mudança não vale para a situação do modelo', 'SITUACAO_MODELO');
  end if;
  update modelos_whatsapp set situacao = p_situacao, motivo = case when p_situacao in ('RECUSADO', 'PAUSADO') then v_motivo else motivo end,
                              decidido_em = app_now(), decidido_por = p_pessoa
   where id = m.id and versao = p_versao returning * into m;
  if m.id is null then
    raise exception 'O modelo mudou' using errcode = 'TC409',
      detail = jsonb_build_object('versao', (select versao from modelos_whatsapp where chave = p_chave and numero = p_numero))::text;
  end if;
  insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo, por) values (m.id, p_situacao, v_motivo, p_pessoa);
  return jsonb_build_object('situacao', m.situacao, 'versao', m.versao);
end $$;

call fechar_acesso();

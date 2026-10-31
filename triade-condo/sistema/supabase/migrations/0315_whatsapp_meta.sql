-- WhatsApp oficial pela Meta, no modelo de parceiro (W-01, W-13 a W-15, W-17, W-20, DC4;
-- quadros 460 a 465, aprovados pela Carol em 31/10/2026). A TRÍADE é Provedor de Tecnologia:
-- cada condomínio tem a própria conta do WhatsApp (WABA), no CNPJ dele, feita pelo cadastro
-- hospedado da Meta, e paga a Meta com o próprio cartão.
--
-- 1. Provedor META na conexão do condomínio: a conta (WABA), o número (id da Meta), a empresa,
--    o nome que aparece, a qualidade e o limite por dia, a falta de cartão e a suspensão. O
--    token do condomínio e o PIN do número ficam nas credenciais cifradas, como as do Wafly.
-- 2. Contas recebidas da Meta (tabela global): o aviso PARTNER_ADDED chega antes de se saber o
--    condomínio. A equipe liga a conta ao cliente no Console; nada é ligado sozinho. Depois de
--    ligada, a conta e o número dizem de qual condomínio é cada aviso da Meta.
-- 3. Modelos aprovados por condomínio: a Meta aprova cada modelo na conta de cada condomínio.
--    No oficial pela Meta, modelo_em_uso só devolve o que está aprovado na conta deste
--    condomínio; o piloto continua igual.
-- 4. O aviso da Meta chega num endereço só (/v1/whatsapp/meta, assinado com a chave secreta do
--    app). Recebida, entregue e lida seguem as funções de sempre; o condomínio sai do número.
-- 5. O lote da fila leva, no META, o id do número e o nome do modelo na Meta.
-- 6. "Já terminei" na Plataforma: o síndico diz que voltou da Meta, e a equipe usa isso para
--    reconhecer a conta que chegou.
--
-- Nada aqui troca o número de quem está no Wafly: ligar a conta da Meta pede o piloto
-- desconectado antes (a troca do Águas Claras é a entrega C, depois do consentimento F6.8).

-- ---------------------------------------------------------------------------------------
-- 1. A conexão.

alter table conexoes_whatsapp drop constraint conexoes_whatsapp_provedor_check;
alter table conexoes_whatsapp add constraint conexoes_whatsapp_provedor_check check (provedor in ('WAFLY', 'META'));
alter table conexoes_whatsapp
  add column waba_id          text check (waba_id ~ '^[0-9]{5,30}$'),
  add column numero_id        text check (numero_id ~ '^[0-9]{5,30}$'),
  add column empresa_meta_id  text check (empresa_meta_id ~ '^[0-9]{5,30}$'),
  add column nome_exibicao    text check (length(btrim(nome_exibicao)) between 1 and 100),
  add column qualidade        text check (qualidade in ('VERDE', 'AMARELO', 'VERMELHO', 'DESCONHECIDA')),
  add column limite_diario    integer check (limite_diario > 0),
  add column falta_cartao_em  timestamptz,
  add column suspenso_em      timestamptz,
  add column cadastro_meta_em timestamptz,
  add column cadastro_meta_por uuid references pessoas (id),
  add constraint conexoes_whatsapp_meta check (provedor <> 'META' or (oficial and waba_id is not null and numero_id is not null));

-- ---------------------------------------------------------------------------------------
-- 2. Contas que chegam da Meta.

create table contas_meta_recebidas (
  waba_id         text primary key check (waba_id ~ '^[0-9]{5,30}$'),
  empresa_meta_id text check (empresa_meta_id ~ '^[0-9]{5,30}$'),
  nome_empresa    text check (length(btrim(nome_empresa)) between 1 and 200),
  -- O que a Meta mandou no aviso, sem tokens.
  dados           jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  recebida_em     timestamptz not null default app_now(),
  condominio_id   uuid references condominios (id) on delete restrict,
  numero_id       text check (numero_id ~ '^[0-9]{5,30}$'),
  ligada_em       timestamptz,
  ligada_por      uuid references pessoas (id),
  check ((condominio_id is null) = (ligada_em is null)),
  check (condominio_id is null or numero_id is not null)
);
create unique index contas_meta_recebidas_numero on contas_meta_recebidas (numero_id) where numero_id is not null;
create unique index contas_meta_recebidas_condominio on contas_meta_recebidas (condominio_id) where condominio_id is not null;
call proteger_tabela_global('contas_meta_recebidas',
  'Contas do WhatsApp que chegam da Meta pelo cadastro hospedado, antes de se saber o condomínio; depois, acham o condomínio de cada aviso');
create trigger contas_meta_recebidas_sem_exclusao before delete on contas_meta_recebidas for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- 3. Modelos aprovados na conta de cada condomínio.

create table modelos_whatsapp_condominio (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  modelo_id     uuid not null references modelos_whatsapp (id),
  -- Nome do modelo na Meta: a chave e o número da versão ("noticia_pedido_3").
  nome_meta     text not null check (nome_meta ~ '^[a-z0-9_]{1,200}$'),
  meta_id       text check (meta_id ~ '^[0-9]{1,40}$'),
  situacao      text not null default 'ENVIADO' check (situacao in ('ENVIADO', 'APROVADO', 'RECUSADO', 'PAUSADO', 'DESATIVADO', 'FALHOU')),
  motivo        text check (length(btrim(motivo)) between 1 and 300),
  enviado_em    timestamptz not null default app_now(),
  decidido_em   timestamptz,
  versao        integer not null default 1,
  unique (condominio_id, modelo_id),
  unique (condominio_id, nome_meta)
);
call proteger_tabela_condominio('modelos_whatsapp_condominio');

-- No oficial pela Meta, só o que a conta deste condomínio aprovou. No piloto e no oficial
-- antigo (conta única), como antes.
create or replace function modelo_em_uso(p_chave text, p_oficial boolean) returns modelos_whatsapp
language sql stable
set search_path = public
as $$
  select m.* from modelos_whatsapp m
   where m.chave = p_chave
     and case when coalesce(p_oficial, false) and exists (select 1 from conexoes_whatsapp where provedor = 'META')
              then m.situacao <> 'DESATIVADO'
                   and exists (select 1 from modelos_whatsapp_condominio mc where mc.modelo_id = m.id and mc.situacao = 'APROVADO')
              else m.situacao = 'APROVADO' or (m.situacao = 'APROVADO_PILOTO' and not coalesce(p_oficial, false)) end
   order by m.numero desc limit 1
$$;

-- ---------------------------------------------------------------------------------------
-- 4. O aviso da Meta: o condomínio sai do número (que só existe numa conta ligada). A API
-- confere a assinatura antes; o número vem na variável da transação, nunca do endereço.

create or replace function entrar_por_gancho(p_segredo text, p_instancia text) returns conexoes_whatsapp
language plpgsql
set search_path = public
as $$
declare
  v_numero text := nullif(current_setting('app.meta_numero', true), '');
  v_condominio uuid;
  cx conexoes_whatsapp;
begin
  perform limpar_contexto();
  if p_segredo is null and v_numero is not null then
    if v_numero !~ '^[0-9]{5,30}$' then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
    select condominio_id into v_condominio from contas_meta_recebidas where numero_id = v_numero and condominio_id is not null;
    if v_condominio is null then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
    perform entrar_como_sistema(v_condominio);
    select * into cx from conexoes_whatsapp;
    if cx.id is null or cx.provedor <> 'META' or cx.numero_id is distinct from v_numero then
      raise exception 'Aviso recusado' using errcode = 'TC403';
    end if;
    return cx;
  end if;
  if p_segredo is null or p_segredo !~ '^[A-Za-z0-9_-]{32,64}$' then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
  select condominio_id into v_condominio from ganchos_whatsapp where hash = hash_codigo(p_segredo) and revogado_em is null;
  if v_condominio is null then raise exception 'Aviso recusado' using errcode = 'TC403'; end if;
  perform entrar_como_sistema(v_condominio);
  select * into cx from conexoes_whatsapp;
  -- A instância, quando o provedor manda, tem de ser a do condomínio.
  if cx.id is null or (p_instancia is not null and cx.instancia is distinct from p_instancia) then
    raise exception 'Aviso recusado' using errcode = 'TC403';
  end if;
  return cx;
end $$;

-- Número da Meta que não é de conta ligada: devolve null (a API responde 200 à Meta e ignora).
create function numero_meta_ligado(p_numero text) returns boolean
language sql stable
set search_path = public
as $$ select exists (select 1 from contas_meta_recebidas where numero_id = p_numero and condominio_id is not null) $$;

-- Mensagem recebida pela Meta: a mesma whatsapp_receber, com o condomínio pelo número.
create function whatsapp_receber_meta(p_numero_id text, p_msg jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not numero_meta_ligado(p_numero_id) then return jsonb_build_object('repetida', true, 'ignorada', true, 'midias', '[]'::jsonb); end if;
  perform set_config('app.meta_numero', p_numero_id, true);
  v := whatsapp_receber(null, null, p_msg);
  perform set_config('app.meta_numero', '', true);
  return v;
end $$;

-- Situação de um envio pela Meta: entregue e lida como sempre; falhou vira falha com o motivo
-- (W-14). O erro 131042 é a conta sem cartão: os envios pagos param até o condomínio pôr.
create function whatsapp_evento_meta(p_numero_id text, p_tipo text, p_provedor_id text, p_codigo integer, p_erro text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  e envios_whatsapp;
  v boolean := true;
begin
  if p_tipo is null or p_tipo not in ('ENTREGUE', 'LIDA', 'FALHOU') then raise exception 'Evento desconhecido' using errcode = 'TC422'; end if;
  if not numero_meta_ligado(p_numero_id) then return false; end if;
  perform set_config('app.meta_numero', p_numero_id, true);
  if p_tipo in ('ENTREGUE', 'LIDA') then
    v := whatsapp_evento(null, null, p_tipo, p_provedor_id, null);
    -- Modelo entregue: a conta voltou a pagar.
    cx := entrar_por_gancho(null, null);
    if cx.falta_cartao_em is not null and exists (select 1 from envios_whatsapp where provedor_id = p_provedor_id and modelo_id is not null) then
      update conexoes_whatsapp set falta_cartao_em = null where id = cx.id;
      perform registrar_historico('whatsapp.cartao_voltou', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
    end if;
  else
    cx := entrar_por_gancho(null, null);
    for e in update envios_whatsapp set estado = 'FALHOU',
                                        motivo = left(case when p_codigo = 131042 then 'A conta do condomínio na Meta está sem cartão'
                                                           else coalesce(nullif(btrim(p_erro), ''), 'A Meta não entregou') end, 300)
              where provedor_id = p_provedor_id and estado in ('ENVIADA', 'ENTREGUE') returning * loop
      perform falha_whatsapp(e);
    end loop;
    if p_codigo = 131042 and cx.falta_cartao_em is null then
      update conexoes_whatsapp set falta_cartao_em = app_now() where id = cx.id;
      perform registrar_historico('whatsapp.falta_cartao', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
    end if;
  end if;
  perform set_config('app.meta_numero', '', true);
  perform entrar_como_sistema(null);
  return v;
end $$;

-- Conta que chegou pelo cadastro hospedado (account_update PARTNER_ADDED). Repetida só
-- atualiza o que a Meta mandou.
create function whatsapp_conta_meta_recebida(p_waba text, p_empresa text, p_dados jsonb) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_waba is null or p_waba !~ '^[0-9]{5,30}$' or (p_empresa is not null and p_empresa !~ '^[0-9]{5,30}$') then
    raise exception 'Conta inválida' using errcode = 'TC422';
  end if;
  insert into contas_meta_recebidas (waba_id, empresa_meta_id, dados)
  values (p_waba, p_empresa, coalesce(p_dados, '{}'::jsonb))
  on conflict (waba_id) do update set empresa_meta_id = coalesce(excluded.empresa_meta_id, contas_meta_recebidas.empresa_meta_id),
                                      dados = contas_meta_recebidas.dados || excluded.dados;
  return true;
end $$;

-- A Meta mudou algo na conta ligada: qualidade e limite do número, suspensão, volta.
create function whatsapp_conta_meta_evento(p_waba text, p_tipo text, p_qualidade text, p_limite integer, p_motivo text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condominio uuid;
  cx conexoes_whatsapp;
begin
  if p_tipo is null or p_tipo not in ('QUALIDADE', 'SUSPENSO', 'LIBERADO') then raise exception 'Evento desconhecido' using errcode = 'TC422'; end if;
  select condominio_id into v_condominio from contas_meta_recebidas where waba_id = p_waba and condominio_id is not null;
  if v_condominio is null then return false; end if;
  perform entrar_como_sistema(v_condominio);
  select * into cx from conexoes_whatsapp where provedor = 'META' and waba_id = p_waba for update;
  if cx.id is null then perform entrar_como_sistema(null); return false; end if;
  if p_tipo = 'QUALIDADE' then
    update conexoes_whatsapp set qualidade = coalesce(case when p_qualidade in ('VERDE', 'AMARELO', 'VERMELHO', 'DESCONHECIDA') then p_qualidade end, qualidade),
                                 limite_diario = coalesce(case when p_limite > 0 then p_limite end, limite_diario)
     where id = cx.id;
  elsif p_tipo = 'SUSPENSO' and cx.suspenso_em is null then
    update conexoes_whatsapp set suspenso_em = app_now() where id = cx.id;
    perform registrar_historico('whatsapp.suspenso', 'conexao_whatsapp', cx.id::text,
                                jsonb_strip_nulls(jsonb_build_object('motivo', left(nullif(btrim(p_motivo), ''), 300))));
    perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'DESCONECTADO', null, null, null, 'S:' || app_now()::text);
  elsif p_tipo = 'LIBERADO' and cx.suspenso_em is not null then
    update conexoes_whatsapp set suspenso_em = null where id = cx.id;
    perform registrar_historico('whatsapp.liberado', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
  end if;
  perform entrar_como_sistema(null);
  return true;
end $$;

-- A Meta decidiu um modelo na conta do condomínio (message_template_status_update).
create function whatsapp_modelo_meta(p_waba text, p_nome text, p_meta_id text, p_situacao text, p_motivo text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condominio uuid;
  v_situacao text := case upper(coalesce(p_situacao, '')) when 'APPROVED' then 'APROVADO' when 'REJECTED' then 'RECUSADO'
                                                          when 'PAUSED' then 'PAUSADO' when 'DISABLED' then 'DESATIVADO'
                                                          when 'PENDING' then 'ENVIADO' when 'IN_APPEAL' then 'ENVIADO' end;
  mc modelos_whatsapp_condominio;
begin
  if v_situacao is null then return false; end if;
  select condominio_id into v_condominio from contas_meta_recebidas where waba_id = p_waba and condominio_id is not null;
  if v_condominio is null then return false; end if;
  perform entrar_como_sistema(v_condominio);
  update modelos_whatsapp_condominio
     set situacao = v_situacao, meta_id = coalesce(case when p_meta_id ~ '^[0-9]{1,40}$' then p_meta_id end, meta_id),
         motivo = case when v_situacao in ('RECUSADO', 'PAUSADO', 'DESATIVADO') then left(nullif(btrim(p_motivo), ''), 300) end,
         decidido_em = case when v_situacao = 'ENVIADO' then null else app_now() end
   where nome_meta = p_nome or (p_meta_id is not null and meta_id = p_meta_id)
  returning * into mc;
  if mc.id is not null then
    perform registrar_historico('whatsapp.modelo_meta', 'modelos_whatsapp_condominio', mc.id::text,
                                jsonb_strip_nulls(jsonb_build_object('modelo', mc.nome_meta, 'situacao', v_situacao, 'motivo', mc.motivo)));
  end if;
  perform entrar_como_sistema(null);
  return mc.id is not null;
end $$;

-- ---------------------------------------------------------------------------------------
-- 5. O lote da fila: no META, o id do número e o nome do modelo na conta do condomínio.

alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_meta;
alter function pegar_lote_whatsapp_meta(integer) security invoker;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saida jsonb := '[]'::jsonb;
  lote jsonb;
  x jsonb;
  v_envios jsonb;
  cx conexoes_whatsapp;
  v_nome text;
begin
  for lote in select * from jsonb_array_elements(pegar_lote_whatsapp_meta(p_max)) loop
    if lote ->> 'provedor' = 'META' then
      perform entrar_como_sistema((lote ->> 'condominio')::uuid);
      select * into cx from conexoes_whatsapp;
      v_envios := '[]'::jsonb;
      for x in select * from jsonb_array_elements(lote -> 'envios') loop
        if x ? 'modelo' then
          -- O mesmo modelo que o lote escolheu (modelo_em_uso, na mesma transação).
          select mc.nome_meta into v_nome from modelos_whatsapp_condominio mc
           where mc.modelo_id = (modelo_em_uso(x -> 'modelo' ->> 'chave', true)).id and mc.situacao = 'APROVADO';
          x := jsonb_set(x, '{modelo}', (x -> 'modelo') || jsonb_strip_nulls(jsonb_build_object('nome', v_nome, 'idioma', 'pt_BR')));
        end if;
        v_envios := v_envios || jsonb_build_array(x);
      end loop;
      lote := jsonb_set(lote, '{envios}', v_envios) || jsonb_build_object('numeroId', cx.numero_id);
      perform entrar_como_sistema(null);
    end if;
    v_saida := v_saida || jsonb_build_array(lote);
  end loop;
  return v_saida;
end $$;

-- ---------------------------------------------------------------------------------------
-- 6. Plataforma: "Já terminei" depois do cadastro na Meta (quadro 461, estado 1).

create function plataforma_whatsapp_meta_terminei(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico faz o cadastro na Meta' using errcode = 'TC401'; end if;
  cx := conexao_do_cliente();
  if cx.provedor = 'META' then perform recusar_motivo('O número oficial já está ligado', 'JA_LIGADO'); end if;
  update conexoes_whatsapp set cadastro_meta_em = app_now(), cadastro_meta_por = p_pessoa where id = cx.id returning * into cx;
  perform registrar_historico('whatsapp.cadastro_meta', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
  return conexao_json(cx);
end $$;

-- O que a tela mostra da conexão, agora com o número oficial (sem ids da Meta: esses ficam no
-- Console).
create or replace function conexao_json(cx conexoes_whatsapp) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'provedor', cx.provedor, 'oficial', cx.oficial, 'situacao', cx.situacao, 'aparelho', cx.aparelho,
    'conectadoEm', cx.conectado_em, 'desconectadoEm', cx.desconectado_em, 'ultimaRecebida', cx.ultima_recebida,
    'termoAceitoEm', cx.termo_aceito_em, 'termoAceitoPor', nome_pessoa(cx.termo_aceito_por), 'versao', cx.versao,
    'nomeExibicao', cx.nome_exibicao, 'qualidade', cx.qualidade, 'limiteDiario', cx.limite_diario,
    'faltaCartaoEm', cx.falta_cartao_em, 'suspensoEm', cx.suspenso_em, 'cadastroMetaEm', cx.cadastro_meta_em,
    'modelos', case when cx.provedor = 'META' then (
      select jsonb_build_object('aprovados', count(*) filter (where situacao = 'APROVADO'),
                                'emAnalise', count(*) filter (where situacao = 'ENVIADO'),
                                'recusados', count(*) filter (where situacao in ('RECUSADO', 'PAUSADO', 'DESATIVADO', 'FALHOU')),
                                'total', count(*))
        from modelos_whatsapp_condominio where condominio_id = cx.condominio_id) end))
$$;

-- ---------------------------------------------------------------------------------------
-- 7. Console: as contas recebidas e a ligação ao cliente (quadros 463 a 465).

-- As contas que esperam cliente, as ligadas nos últimos 30 dias e quem disse "Já terminei"
-- nos últimos 7 dias (para reconhecer a conta).
create function console_contas_meta(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_terminaram jsonb := '[]'::jsonb;
  cx conexoes_whatsapp;
begin
  perform entrar_console(p_pessoa, 'console.whatsapp.ver');
  for r in select distinct v.condominio_id from vinculos v
            where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes()) loop
    continue when not pode(p_pessoa, r.condominio_id, 'console.whatsapp.ver');
    perform entrar_condominio(p_pessoa, r.condominio_id, 'console.whatsapp.ver');
    select * into cx from conexoes_whatsapp;
    if cx.cadastro_meta_em > app_now() - interval '7 days' and cx.provedor <> 'META' then
      v_terminaram := v_terminaram || jsonb_build_array(jsonb_build_object(
        'condominioId', r.condominio_id, 'nome', (select nome from condominios where id = r.condominio_id), 'em', cx.cadastro_meta_em));
    end if;
  end loop;
  perform entrar_console(p_pessoa, 'console.whatsapp.ver');
  return jsonb_build_object(
    'esperando', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                             'wabaId', c.waba_id, 'empresaId', c.empresa_meta_id, 'nomeEmpresa', c.nome_empresa,
                             'recebidaEm', c.recebida_em)) order by c.recebida_em desc)
                             from contas_meta_recebidas c where c.condominio_id is null), '[]'::jsonb),
    'ligadas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'wabaId', c.waba_id, 'condominioId', c.condominio_id, 'nome', (select nome from condominios where id = c.condominio_id),
                           'ligadaEm', c.ligada_em, 'ligadaPor', nome_pessoa(c.ligada_por))) order by c.ligada_em desc)
                           from contas_meta_recebidas c where c.ligada_em > app_now() - interval '30 days'), '[]'::jsonb),
    'terminaram', v_terminaram,
    'pode', jsonb_build_object('ligar', pode_global('console.whatsapp.conectar')));
end $$;

-- Antes de falar com a Meta: a conta existe e está livre, o cliente pode receber. O piloto
-- conectado precisa ser desconectado antes (a troca de número é decisão à parte).
create function console_meta_preparar(p_pessoa uuid, p_condominio uuid, p_waba text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contas_meta_recebidas;
  cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  select * into c from contas_meta_recebidas where waba_id = p_waba;
  if c.waba_id is null then raise exception 'Conta não encontrada' using errcode = 'TC404'; end if;
  if c.condominio_id is not null then perform recusar_motivo('Esta conta já está ligada a um cliente', 'CONTA_LIGADA'); end if;
  if exists (select 1 from contas_meta_recebidas where condominio_id = p_condominio) then
    perform recusar_motivo('Este cliente já tem uma conta da Meta ligada', 'CLIENTE_LIGADO');
  end if;
  select * into cx from conexoes_whatsapp;
  if cx.provedor = 'WAFLY' and cx.situacao in ('CONECTADO', 'CONECTANDO') then
    perform recusar_motivo('Desconecte o número de teste antes de ligar o oficial', 'PILOTO_CONECTADO');
  end if;
  return jsonb_strip_nulls(jsonb_build_object('wabaId', c.waba_id, 'empresaId', c.empresa_meta_id));
end $$;

-- Liga a conta ao cliente, depois que a API pegou o token, assinou os avisos e registrou o
-- número com o PIN. As credenciais chegam cifradas ({token, pin}).
create function console_ligar_conta_meta(p_pessoa uuid, p_condominio uuid, p_waba text, p_empresa text, p_nome_empresa text,
                                         p_numero_id text, p_numero text, p_nome_exibicao text, p_qualidade text, p_limite integer,
                                         p_credenciais bytea)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contas_meta_recebidas;
  cx conexoes_whatsapp;
  v_numero text := telefone_whatsapp(p_numero);
begin
  perform console_meta_preparar(p_pessoa, p_condominio, p_waba);
  if p_numero_id is null or p_numero_id !~ '^[0-9]{5,30}$' then perform recusar_campos('Número da Meta inválido', 'numeroId'); end if;
  if v_numero is null then perform recusar_campos('Telefone inválido', 'numero'); end if;
  if p_credenciais is null or length(p_credenciais) not between 28 and 4096 then perform recusar_campos('Credenciais inválidas', 'credenciais'); end if;
  if exists (select 1 from contas_meta_recebidas where numero_id = p_numero_id) then
    perform recusar_motivo('Este número já está ligado a outro cliente', 'NUMERO_LIGADO');
  end if;
  select * into c from contas_meta_recebidas where waba_id = p_waba for update;
  update contas_meta_recebidas
     set condominio_id = p_condominio, numero_id = p_numero_id, ligada_em = app_now(), ligada_por = p_pessoa,
         empresa_meta_id = coalesce(case when p_empresa ~ '^[0-9]{5,30}$' then p_empresa end, empresa_meta_id),
         nome_empresa = coalesce(left(nullif(btrim(p_nome_empresa), ''), 200), nome_empresa)
   where waba_id = p_waba;
  cx := conexao_do_cliente();
  update conexoes_whatsapp
     set provedor = 'META', oficial = true, instancia = null, credenciais = p_credenciais, situacao = 'CONECTADO',
         aparelho = v_numero, conectado_em = app_now(), waba_id = p_waba, numero_id = p_numero_id,
         empresa_meta_id = coalesce(case when p_empresa ~ '^[0-9]{5,30}$' then p_empresa end, c.empresa_meta_id),
         nome_exibicao = left(nullif(btrim(p_nome_exibicao), ''), 100),
         qualidade = case when p_qualidade in ('VERDE', 'AMARELO', 'VERMELHO', 'DESCONHECIDA') then p_qualidade end,
         limite_diario = case when p_limite > 0 then p_limite end, falta_cartao_em = null, suspenso_em = null
   where id = cx.id returning * into cx;
  -- O endereço do Wafly deixa de valer: os avisos agora vêm da Meta.
  update ganchos_whatsapp set revogado_em = app_now() where condominio_id = p_condominio and revogado_em is null;
  perform registrar_historico_interno('whatsapp.meta_ligada', 'conexao_whatsapp', cx.id::text,
                                      jsonb_build_object('waba', p_waba, 'numero', p_numero_id));
  return conexao_json(cx);
end $$;

-- O que a API precisa para falar com a Meta em nome do cliente (token e PIN cifrados).
create function console_meta_acesso(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  select * into cx from conexoes_whatsapp;
  if cx.id is null or cx.provedor <> 'META' then perform recusar_motivo('O cliente não tem conta da Meta ligada', 'SEM_META'); end if;
  return jsonb_build_object('wabaId', cx.waba_id, 'numeroId', cx.numero_id, 'credenciais', encode(cx.credenciais, 'base64'));
end $$;

-- Os modelos que ainda faltam mandar para a conta do cliente: a última versão de cada chave
-- que a TRÍADE liberou (no piloto ou no oficial).
create function console_modelos_meta_faltando(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'modeloId', m.id, 'chave', m.chave, 'nome', m.chave || '_' || m.numero, 'categoria', m.categoria, 'idioma', m.idioma,
             'corpo', m.corpo, 'rodape', m.rodape, 'variaveis', m.variaveis)) order by m.chave)
      from (select distinct on (chave) * from modelos_whatsapp where situacao in ('APROVADO_PILOTO', 'ENVIADO', 'APROVADO')
             order by chave, numero desc) m
     where not exists (select 1 from modelos_whatsapp_condominio mc where mc.modelo_id = m.id and mc.situacao <> 'FALHOU')), '[]'::jsonb);
end $$;

-- O que a Meta respondeu a cada modelo mandado: em análise (com o id) ou recusado na hora.
create function console_modelos_meta_enviados(p_pessoa uuid, p_condominio uuid, p_resultados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x jsonb;
  m modelos_whatsapp;
  v_situacao text;
  v_total integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  if jsonb_typeof(p_resultados) is distinct from 'array' then perform recusar_campos('Resultados inválidos', 'resultados'); end if;
  for x in select * from jsonb_array_elements(p_resultados) loop
    select * into m from modelos_whatsapp where id = (x ->> 'modeloId')::uuid;
    continue when m.id is null;
    v_situacao := case x ->> 'situacao' when 'APPROVED' then 'APROVADO' when 'REJECTED' then 'RECUSADO' when 'PENDING' then 'ENVIADO'
                                        when 'FALHOU' then 'FALHOU' else 'ENVIADO' end;
    insert into modelos_whatsapp_condominio (condominio_id, modelo_id, nome_meta, meta_id, situacao, motivo, decidido_em)
    values (p_condominio, m.id, m.chave || '_' || m.numero, case when x ->> 'metaId' ~ '^[0-9]{1,40}$' then x ->> 'metaId' end,
            v_situacao, left(nullif(btrim(x ->> 'motivo'), ''), 300), case when v_situacao in ('APROVADO', 'RECUSADO') then app_now() end)
    on conflict (condominio_id, modelo_id) do update
       set meta_id = coalesce(excluded.meta_id, modelos_whatsapp_condominio.meta_id), situacao = excluded.situacao,
           motivo = excluded.motivo, enviado_em = app_now(), decidido_em = excluded.decidido_em;
    v_total := v_total + 1;
  end loop;
  perform registrar_historico_interno('whatsapp.modelos_meta_enviados', 'conexao_whatsapp',
                                      (select id::text from conexoes_whatsapp), jsonb_build_object('modelos', v_total));
  return jsonb_build_object('enviados', v_total);
end $$;

-- A parte da Meta na ficha do cliente (quadro 465): ids, qualidade e os modelos deste cliente.
create function console_whatsapp_meta(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.ver');
  select * into cx from conexoes_whatsapp;
  if cx.id is null or cx.provedor <> 'META' then return jsonb_build_object('ligada', false); end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'ligada', true, 'wabaId', cx.waba_id, 'numeroId', cx.numero_id, 'empresaId', cx.empresa_meta_id,
    'ligadaEm', (select ligada_em from contas_meta_recebidas where waba_id = cx.waba_id),
    'ligadaPor', (select nome_pessoa(ligada_por) from contas_meta_recebidas where waba_id = cx.waba_id),
    'modelos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'chave', m.chave, 'titulo', m.titulo, 'nome', mc.nome_meta, 'situacao', mc.situacao, 'motivo', mc.motivo,
                           'enviadoEm', mc.enviado_em, 'decididoEm', mc.decidido_em)) order by m.chave, m.numero desc)
                           from modelos_whatsapp_condominio mc join modelos_whatsapp m on m.id = mc.modelo_id), '[]'::jsonb),
    'pode', jsonb_build_object('conectar', pode(p_pessoa, p_condominio, 'console.whatsapp.conectar'))));
end $$;

-- Credenciais cifradas do número oficial, para a função baixar a mídia recebida pela Meta (o id
-- da mídia só vira endereço com o token do condomínio). Só META e só para o sistema.
create function whatsapp_credenciais_meta(p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_como_sistema(p_condominio);
  select * into cx from conexoes_whatsapp where provedor = 'META';
  perform entrar_como_sistema(null);
  return jsonb_build_object('credenciais', case when cx.credenciais is null then null else encode(cx.credenciais, 'base64') end);
end $$;

call fechar_acesso();

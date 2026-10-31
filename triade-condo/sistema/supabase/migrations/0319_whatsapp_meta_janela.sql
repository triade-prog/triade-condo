-- WhatsApp oficial pela janela da Meta (cadastro incorporado; F5.12; W-01, W-15, W-17, DC4;
-- quadros 466 a 469 aprovados pela Carolina em 31/10/2026).
--
-- O síndico abre a janela da Meta dentro da Plataforma. Ela devolve o código (vale 30 s) e os ids
-- da conta e do número; a API troca o código pelo token do condomínio, assina os avisos,
-- registra o número com PIN e liga a conta ao condomínio da sessão, sem a equipe. Se o número
-- ainda não foi confirmado na Meta, a conta fica pendente até o código por SMS ou ligação.
-- No Console, a equipe confere a conta na Meta (cartão e qualidade) e desliga o número com motivo.
-- A ligação pelo Console (contas recebidas, 0315) continua como plano B.

alter table conexoes_whatsapp
  -- O cadastro que espera o código: os ids e o número (sem segredo) e o token cifrado à parte.
  add column meta_pendente        jsonb check (meta_pendente is null or jsonb_typeof(meta_pendente) = 'object'),
  add column meta_credenciais_pendentes bytea check (meta_credenciais_pendentes is null or length(meta_credenciais_pendentes) between 28 and 4096),
  add column conferido_em         timestamptz,
  add column saude                text check (saude in ('OK', 'FALTA_CARTAO', 'BLOQUEADA')),
  add column desligado_em         timestamptz,
  add column desligado_por        uuid references pessoas (id),
  add column motivo_desligado     text check (length(btrim(motivo_desligado)) between 3 and 300),
  add constraint conexoes_whatsapp_meta_pendente check ((meta_pendente is null) = (meta_credenciais_pendentes is null));

alter table contas_meta_recebidas
  add column ligada_pelo_sindico boolean not null default false,
  add column desligada_em        timestamptz;

-- ---------------------------------------------------------------------------------------
-- 1. Plataforma: preparar, guardar o pendente e ligar.

-- O síndico, no condomínio da sessão, com a conta livre ou já deste condomínio.
create function plataforma_meta_preparar(p_pessoa uuid, p_condominio uuid, p_waba text, p_empresa text, p_numero_id text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contas_meta_recebidas;
  cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico faz o cadastro na Meta' using errcode = 'TC401'; end if;
  if p_waba is null or p_waba !~ '^[0-9]{5,30}$' then perform recusar_campos('Conta da Meta inválida', 'wabaId'); end if;
  if p_numero_id is null or p_numero_id !~ '^[0-9]{5,30}$' then perform recusar_campos('Número da Meta inválido', 'numeroId'); end if;
  cx := conexao_do_cliente();
  if cx.provedor = 'META' and cx.situacao <> 'DESCONECTADO' then perform recusar_motivo('O número oficial já está ligado', 'JA_LIGADO'); end if;
  if cx.provedor = 'WAFLY' and cx.situacao in ('CONECTADO', 'CONECTANDO') then
    perform recusar_motivo('Desconecte o número de teste antes de ligar o oficial', 'PILOTO_CONECTADO');
  end if;
  insert into contas_meta_recebidas (waba_id, empresa_meta_id, dados)
  values (p_waba, case when p_empresa ~ '^[0-9]{5,30}$' then p_empresa end, '{"origem": "JANELA"}')
  on conflict (waba_id) do nothing;
  select * into c from contas_meta_recebidas where waba_id = p_waba for update;
  if c.condominio_id is not null and c.condominio_id <> p_condominio then
    perform recusar_motivo('Esta conta já está ligada a outro condomínio', 'CONTA_LIGADA');
  end if;
  if exists (select 1 from contas_meta_recebidas where numero_id = p_numero_id and condominio_id is distinct from p_condominio) then
    perform recusar_motivo('Este número já está ligado a outro condomínio', 'NUMERO_LIGADO');
  end if;
  return jsonb_build_object('wabaId', p_waba);
end $$;

-- A janela terminou, mas o número espera o código: guarda o token cifrado e os ids.
create function plataforma_meta_guardar_pendente(p_pessoa uuid, p_condominio uuid, p_waba text, p_empresa text, p_numero_id text,
                                                 p_numero text, p_credenciais bytea) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_numero text := telefone_whatsapp(p_numero);
begin
  perform plataforma_meta_preparar(p_pessoa, p_condominio, p_waba, p_empresa, p_numero_id);
  if v_numero is null then perform recusar_campos('Telefone inválido', 'numero'); end if;
  if p_credenciais is null or length(p_credenciais) not between 28 and 4096 then perform recusar_campos('Credenciais inválidas', 'credenciais'); end if;
  cx := conexao_do_cliente();
  update conexoes_whatsapp
     set meta_pendente = jsonb_build_object('wabaId', p_waba, 'empresaId', case when p_empresa ~ '^[0-9]{5,30}$' then p_empresa end,
                                            'numeroId', p_numero_id, 'numero', v_numero, 'desde', app_now()),
         meta_credenciais_pendentes = p_credenciais
   where id = cx.id returning * into cx;
  perform registrar_historico('whatsapp.meta_codigo_pendente', 'conexao_whatsapp', cx.id::text, '{}'::jsonb);
  return jsonb_build_object('numero', v_numero);
end $$;

-- O pendente, para pedir e conferir o código (só o síndico).
create function plataforma_meta_pendente(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico faz o cadastro na Meta' using errcode = 'TC401'; end if;
  select * into cx from conexoes_whatsapp;
  if cx.meta_pendente is null then perform recusar_motivo('Comece de novo pela janela da Meta', 'SEM_CADASTRO'); end if;
  return cx.meta_pendente || jsonb_build_object('credenciais', encode(cx.meta_credenciais_pendentes, 'base64'));
end $$;

-- Liga a conta ao condomínio da sessão, depois que a API trocou o código, assinou os avisos e
-- registrou o número. As credenciais chegam cifradas ({token, pin}).
create function plataforma_ligar_conta_meta(p_pessoa uuid, p_condominio uuid, p_waba text, p_empresa text, p_nome_empresa text,
                                            p_numero_id text, p_numero text, p_nome_exibicao text, p_qualidade text, p_limite integer,
                                            p_credenciais bytea, p_falta_cartao boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_numero text := telefone_whatsapp(p_numero);
  v_empresa text := case when p_empresa ~ '^[0-9]{5,30}$' then p_empresa end;
begin
  perform plataforma_meta_preparar(p_pessoa, p_condominio, p_waba, p_empresa, p_numero_id);
  if v_numero is null then perform recusar_campos('Telefone inválido', 'numero'); end if;
  if p_credenciais is null or length(p_credenciais) not between 28 and 4096 then perform recusar_campos('Credenciais inválidas', 'credenciais'); end if;
  -- Se o condomínio já teve outra conta (desligada), ela deixa de ser dele.
  update contas_meta_recebidas set condominio_id = null, numero_id = null, ligada_em = null, ligada_por = null
   where condominio_id = p_condominio and waba_id <> p_waba;
  update contas_meta_recebidas
     set condominio_id = p_condominio, numero_id = p_numero_id, ligada_em = app_now(), ligada_por = p_pessoa,
         ligada_pelo_sindico = true, desligada_em = null,
         empresa_meta_id = coalesce(v_empresa, empresa_meta_id),
         nome_empresa = coalesce(left(nullif(btrim(p_nome_empresa), ''), 200), nome_empresa)
   where waba_id = p_waba;
  cx := conexao_do_cliente();
  update conexoes_whatsapp
     set provedor = 'META', oficial = true, instancia = null, credenciais = p_credenciais, situacao = 'CONECTADO',
         aparelho = v_numero, conectado_em = app_now(), waba_id = p_waba, numero_id = p_numero_id,
         empresa_meta_id = coalesce(v_empresa, empresa_meta_id),
         nome_exibicao = left(nullif(btrim(p_nome_exibicao), ''), 100),
         qualidade = case when p_qualidade in ('VERDE', 'AMARELO', 'VERMELHO', 'DESCONHECIDA') then p_qualidade end,
         limite_diario = case when p_limite > 0 then p_limite end,
         falta_cartao_em = case when coalesce(p_falta_cartao, false) then app_now() end,
         saude = case when coalesce(p_falta_cartao, false) then 'FALTA_CARTAO' else 'OK' end, conferido_em = app_now(),
         suspenso_em = null, meta_pendente = null, meta_credenciais_pendentes = null,
         desligado_em = null, desligado_por = null, motivo_desligado = null
   where id = cx.id returning * into cx;
  update ganchos_whatsapp set revogado_em = app_now() where condominio_id = p_condominio and revogado_em is null;
  perform registrar_historico('whatsapp.meta_ligada', 'conexao_whatsapp', cx.id::text,
                              jsonb_build_object('waba', p_waba, 'numero', p_numero_id, 'origem', 'JANELA'));
  return conexao_json(cx);
end $$;

-- Os modelos que faltam mandar e o que a Meta respondeu, no condomínio em que já se entrou.
create function modelos_meta_faltando_aqui() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'modeloId', m.id, 'chave', m.chave, 'nome', m.chave || '_' || m.numero, 'categoria', m.categoria, 'idioma', m.idioma,
             'corpo', m.corpo, 'rodape', m.rodape, 'variaveis', m.variaveis)) order by m.chave)
      from (select distinct on (chave) * from modelos_whatsapp where situacao in ('APROVADO_PILOTO', 'ENVIADO', 'APROVADO')
             order by chave, numero desc) m
     where not exists (select 1 from modelos_whatsapp_condominio mc where mc.modelo_id = m.id and mc.situacao <> 'FALHOU')), '[]'::jsonb)
$$;

create function modelos_meta_enviados_aqui(p_resultados jsonb) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  x jsonb;
  m modelos_whatsapp;
  v_situacao text;
  v_total integer := 0;
begin
  if jsonb_typeof(p_resultados) is distinct from 'array' then perform recusar_campos('Resultados inválidos', 'resultados'); end if;
  for x in select * from jsonb_array_elements(p_resultados) loop
    select * into m from modelos_whatsapp where id = (x ->> 'modeloId')::uuid;
    continue when m.id is null;
    v_situacao := case x ->> 'situacao' when 'APPROVED' then 'APROVADO' when 'REJECTED' then 'RECUSADO' when 'PENDING' then 'ENVIADO'
                                        when 'FALHOU' then 'FALHOU' else 'ENVIADO' end;
    insert into modelos_whatsapp_condominio (condominio_id, modelo_id, nome_meta, meta_id, situacao, motivo, decidido_em)
    values (contexto_condominio(), m.id, m.chave || '_' || m.numero, case when x ->> 'metaId' ~ '^[0-9]{1,40}$' then x ->> 'metaId' end,
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

create function plataforma_modelos_meta_faltando(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico faz o cadastro na Meta' using errcode = 'TC401'; end if;
  if not exists (select 1 from conexoes_whatsapp where provedor = 'META' and situacao = 'CONECTADO') then
    perform recusar_motivo('O número oficial não está ligado', 'SEM_META');
  end if;
  return modelos_meta_faltando_aqui();
end $$;

create function plataforma_modelos_meta_enviados(p_pessoa uuid, p_condominio uuid, p_resultados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'plataforma.painel.ver');
  if not eh_sindico(p_pessoa) then raise exception 'Só o síndico faz o cadastro na Meta' using errcode = 'TC401'; end if;
  return modelos_meta_enviados_aqui(p_resultados);
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. Console: conferir na Meta e desligar o número (quadro 469).

-- O que a Meta disse da conta: cartão, bloqueio, qualidade, nome e limite. Diz se algo mudou.
create function console_meta_conferido(p_pessoa uuid, p_condominio uuid, p_saude text, p_qualidade text, p_nome_exibicao text,
                                       p_limite integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  antes conexoes_whatsapp;
  v_mudou boolean;
begin
  -- Conferir só traz o que a Meta já diz: quem vê a ficha pode.
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.ver');
  if p_saude is null or p_saude not in ('OK', 'FALTA_CARTAO', 'BLOQUEADA') then perform recusar_campos('Situação desconhecida', 'saude'); end if;
  select * into antes from conexoes_whatsapp for update;
  if antes.id is null or antes.provedor <> 'META' then perform recusar_motivo('O cliente não tem conta da Meta ligada', 'SEM_META'); end if;
  update conexoes_whatsapp
     set saude = p_saude, conferido_em = app_now(),
         falta_cartao_em = case when p_saude = 'FALTA_CARTAO' then coalesce(falta_cartao_em, app_now()) else null end,
         qualidade = coalesce(case when p_qualidade in ('VERDE', 'AMARELO', 'VERMELHO', 'DESCONHECIDA') then p_qualidade end, qualidade),
         nome_exibicao = coalesce(left(nullif(btrim(p_nome_exibicao), ''), 100), nome_exibicao),
         limite_diario = coalesce(case when p_limite > 0 then p_limite end, limite_diario)
   where id = antes.id returning * into cx;
  v_mudou := antes.saude is distinct from cx.saude or antes.qualidade is distinct from cx.qualidade
             or antes.nome_exibicao is distinct from cx.nome_exibicao or antes.limite_diario is distinct from cx.limite_diario;
  perform registrar_historico_interno('whatsapp.meta_conferida', 'conexao_whatsapp', cx.id::text,
                                      jsonb_build_object('mudou', v_mudou, 'saude', p_saude));
  return jsonb_strip_nulls(jsonb_build_object('conferidoEm', cx.conferido_em, 'mudou', v_mudou, 'saude', cx.saude,
                                              'qualidade', cx.qualidade, 'nomeExibicao', cx.nome_exibicao, 'limiteDiario', cx.limite_diario));
end $$;

-- O acesso para conferir: quem vê a ficha (o suporte também). Só a API lê as credenciais.
create function console_meta_conferir_acesso(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.ver');
  select * into cx from conexoes_whatsapp;
  if cx.id is null or cx.provedor <> 'META' then perform recusar_motivo('O cliente não tem conta da Meta ligada', 'SEM_META'); end if;
  return jsonb_build_object('wabaId', cx.waba_id, 'numeroId', cx.numero_id, 'credenciais', encode(cx.credenciais, 'base64'));
end $$;

-- Desliga o número oficial: a API já tirou o registro na Meta. A conta continua do condomínio.
create function console_meta_desligar(p_pessoa uuid, p_condominio uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.conectar');
  if v_motivo is null or length(v_motivo) not between 3 and 300 then perform recusar_campos('Motivo de 3 a 300 caracteres', 'motivo'); end if;
  select * into cx from conexoes_whatsapp for update;
  if cx.id is null or cx.provedor <> 'META' then perform recusar_motivo('O cliente não tem conta da Meta ligada', 'SEM_META'); end if;
  if cx.situacao = 'DESCONECTADO' then perform recusar_motivo('O número já está desligado', 'JA_DESLIGADO'); end if;
  update conexoes_whatsapp
     set situacao = 'DESCONECTADO', desconectado_em = app_now(), desligado_em = app_now(), desligado_por = p_pessoa, motivo_desligado = v_motivo
   where id = cx.id returning * into cx;
  update contas_meta_recebidas set desligada_em = app_now() where condominio_id = p_condominio;
  perform registrar_historico_interno('whatsapp.meta_desligada', 'conexao_whatsapp', cx.id::text,
                                      jsonb_build_object('origem', 'TRIADE', 'motivo', v_motivo));
  perform avisar_whatsapp(quem_cuida_dos_pedidos(), 'DESCONECTADO', null, null, null, 'D:' || app_now()::text);
  return jsonb_build_object('desligadoEm', cx.desligado_em);
end $$;

-- A parte da Meta na ficha, agora com a conferência, o desligar e o número.
create or replace function console_whatsapp_meta(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cx conexoes_whatsapp;
  c contas_meta_recebidas;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.whatsapp.ver');
  select * into cx from conexoes_whatsapp;
  if cx.id is null or cx.provedor <> 'META' then return jsonb_build_object('ligada', false); end if;
  select * into c from contas_meta_recebidas where waba_id = cx.waba_id;
  return jsonb_strip_nulls(jsonb_build_object(
    'ligada', true, 'wabaId', cx.waba_id, 'numeroId', cx.numero_id, 'empresaId', cx.empresa_meta_id, 'numero', cx.aparelho,
    'ligadaEm', c.ligada_em, 'ligadaPor', nome_pessoa(c.ligada_por), 'ligadaPeloSindico', coalesce(c.ligada_pelo_sindico, false),
    'conferidoEm', cx.conferido_em, 'saude', cx.saude,
    'desligadoEm', cx.desligado_em, 'desligadoPor', nome_pessoa(cx.desligado_por), 'motivoDesligado', cx.motivo_desligado,
    'modelos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'chave', m.chave, 'titulo', m.titulo, 'nome', mc.nome_meta, 'situacao', mc.situacao, 'motivo', mc.motivo,
                           'enviadoEm', mc.enviado_em, 'decididoEm', mc.decidido_em)) order by m.chave, m.numero desc)
                           from modelos_whatsapp_condominio mc join modelos_whatsapp m on m.id = mc.modelo_id), '[]'::jsonb),
    'pode', jsonb_build_object('conectar', pode(p_pessoa, p_condominio, 'console.whatsapp.conectar'))));
end $$;

-- Contas recebidas (plano B): a conta desligada não volta para a lista de espera.
create or replace function console_contas_meta(p_pessoa uuid) returns jsonb
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
                             from contas_meta_recebidas c where c.condominio_id is null and c.desligada_em is null), '[]'::jsonb),
    'ligadas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'wabaId', c.waba_id, 'condominioId', c.condominio_id, 'nome', (select nome from condominios where id = c.condominio_id),
                           'ligadaEm', c.ligada_em, 'ligadaPor', nome_pessoa(c.ligada_por), 'peloSindico', c.ligada_pelo_sindico))
                           order by c.ligada_em desc)
                           from contas_meta_recebidas c where c.ligada_em > app_now() - interval '30 days'), '[]'::jsonb),
    'terminaram', v_terminaram,
    'pode', jsonb_build_object('ligar', pode_global('console.whatsapp.conectar')));
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. O que a tela mostra: o pendente (sem segredo) e o desligado; e quem pode abrir a janela.

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
    'desligadoEm', cx.desligado_em, 'motivoDesligado', cx.motivo_desligado,
    'cadastroPendente', case when cx.meta_pendente is not null then jsonb_build_object(
                          'numero', cx.meta_pendente ->> 'numero', 'desde', cx.meta_pendente ->> 'desde') end,
    'modelos', case when cx.provedor = 'META' then (
      select jsonb_build_object('aprovados', count(*) filter (where situacao = 'APROVADO'),
                                'emAnalise', count(*) filter (where situacao = 'ENVIADO'),
                                'recusados', count(*) filter (where situacao in ('RECUSADO', 'PAUSADO', 'DESATIVADO', 'FALHOU')),
                                'total', count(*))
        from modelos_whatsapp_condominio where condominio_id = cx.condominio_id) end))
$$;

create or replace function config_whatsapp_r5(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  cx conexoes_whatsapp;
  a avisos_whatsapp_pessoa;
begin
  perform definir_pessoa(p_pessoa);
  perform entrar_condominio(p_pessoa, p_condominio,
                            case when contexto_equipe() then 'config.ver' else 'plataforma.painel.ver' end);
  select * into cfg from configuracao_condominio;
  select * into cx from conexoes_whatsapp;
  select * into a from avisos_whatsapp_pessoa where pessoa_id = p_pessoa;
  return jsonb_strip_nulls(jsonb_build_object(
    'numero', (select numero_whatsapp from condominios where id = p_condominio),
    'conexao', case when cx.id is not null then conexao_json(cx) else jsonb_build_object('situacao', 'SEM_CREDENCIAIS') end,
    'config', jsonb_build_object('foraHorario', cfg.whatsapp_fora_horario, 'categoriaId', categoria_whatsapp(),
                                 'prioridadeId', prioridade_whatsapp(), 'anexarMinutos', cfg.whatsapp_anexar_minutos, 'versao', cfg.versao),
    'avisoGolpe', aviso_golpe_whatsapp(),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by lower(nome)) from categorias where ativa), '[]'::jsonb),
    'prioridades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nivel) from prioridades where ativa), '[]'::jsonb),
    'meusAvisos', case when a.id is not null then jsonb_build_object('telefone', a.telefone, 'tipos', to_jsonb(a.tipos), 'ligado', a.ligado,
                                                                     'versao', a.versao) end,
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar'),
                               'tecnica', pode(p_pessoa, p_condominio, 'config.tecnica'),
                               'aceitarTermo', eh_sindico(p_pessoa) and cx.termo_aceito_em is null,
                               'cadastrarMeta', not contexto_equipe() and eh_sindico(p_pessoa))));
end $$;

call fechar_acesso();

-- 0318 · Reativar quem voltou e fechar a entrada sem pessoa depois do último dia (R17.7c; IDEIAS
-- CM-31, CM-32 e CM-13, e CM-30 na parte do reajuste; plano em comercial/r17-7c/plano-0318.md;
-- especificação em comercial/r17-7c/especificacao.md; quadros 487 a 491). Vem dos achados r3 e r7
-- da revisão da R17.7 (0311).
--
-- Decisões da Carol (plano, F1 a F7):
-- F1. Depois do último dia, todo link público recusa com CONTRATO_ENCERRADO (o nome do condomínio e
--     desde quando, para a página do quadro 489): mural (página, arquivos, agenda, foto de
--     classificado, pedir documento), etiqueta, comunicado /c, documento /d, cadastro, enquete /v,
--     assembleia /a, conselho, orçamento e prestador. Fica só o parar de receber e-mail (e os eventos
--     de e-mail e de WhatsApp); confirmar e voltar a receber e-mail recusam.
-- F2. O WhatsApp recebido não grava, não responde e não baixa mídia (volta como repetida); as mídias
--     pendentes e a transcrição param. O status (whatsapp_evento) continua.
-- F3. As filas cancelam o que está na fila com "O contrato do condomínio terminou" e não enviam.
-- F4. As rotinas por condomínio pulam o condomínio encerrado; a retenção, a exportação e as rotinas
--     do Comercial continuam.
-- F5. Desfazer antes do último dia: só a Administração, com nota; o encerramento é revogado (fica o
--     registro), a comissão do parceiro que o cancelamento encerrou reabre e a exportação já pedida
--     continua.
-- F6. Reativar depois do último dia: pelo aditivo de retorno (Modelos › Aditivo, parte Retorno), com
--     as duas assinaturas pelo gov.br conferidas como no contrato (0308). O plano vem da Tabela de
--     preços do dia, cheia, pela faixa das unidades ativas (acima de 400, o valor combinado). Reativar
--     revoga o último dia, põe o plano novo, ganha a reconquista e conta o aniversário dali.
-- F7. Quem foi reativado (ou teve o cancelamento desfeito) pode pedir cancelamento de novo.
--
-- Escolhas desta rodada, onde a especificação deixava escolher:
-- a. A assinatura dos aditivos fica numa tabela nova, envios_aditivo, com a mesma forma de
--    envios_contrato (menos o link do síndico). Generalizar envios_contrato mexeria em toda a
--    conferência do contrato (link público, ordem das travas, virar cliente, anonimização); a tabela
--    própria deixa o contrato como está. A conferência automática da API é a mesma.
-- b. O fechamento dos links fica na porta de entrada de todos eles: entrar_por_link (exceto
--    PARAR_EMAIL) e entrar_por_codigo. Cada família de link passa por uma das duas, então não há
--    link que escape, e o prestador passa a recusar com CONTRATO_ENCERRADO (antes saía encerrado com
--    a situação VALE). O voltar a receber e-mail usa o link de parar: ganha a mesma recusa à parte.
-- c. contrato_encerrado(condomínio) lê no contexto do condomínio, como o conjunto_modo; quem chama
--    já entrou nele. A cobrança (console_abrir_competencia) continua comparando o último dia com a
--    competência (contrato_ultimo_dia), agora sem o encerramento revogado.
-- d. O revogado_motivo do desfazer guarda a nota ("Cancelamento desfeito: ..."); o do reativar,
--    "Reativado pelo aditivo nº N". Os dois saem na retenção do cancelamento (12 meses) e na
--    anonimização, como "Dado apagado (LGPD)".
-- e. O aditivo de retorno guarda no retrato (dados.retorno) o plano que vai valer: competência,
--    ciclo, valor, faixa e tabela. Reativar lê dali; gerar de novo substitui o aditivo e zera as
--    assinaturas. No anual, o valor é o mensal vezes os meses pagos (0295). Na faixa sob consulta, o
--    valor é o mensal informado e o plano fica manual (sem tabela).
-- f. GET /v1/comercial/aditivos/:id/link: sem parâmetro, o PDF gerado (o que o condomínio assina);
--    ?envio=<id> baixa um envio e ?assinado=1 o assinado mais recente (o da TRÍADE, senão o do
--    condomínio). Aqui, comercial_abrir_aditivo_arquivo com p_gerado = false dá o assinado.
-- g. Reativar dá por superado o reajuste avisado antes do cancelamento que ainda não entrou no plano
--    (o plano agora é o do aditivo).
-- h. Os modelos de aditivo ganham numeração por tipo (Reajuste v1, Retorno v1) e "usar" troca só a
--    versão em uso do mesmo tipo. A leitura de Modelos › Aditivo traz as versões das duas partes
--    (cada uma com o tipo), os campos por tipo ({REAJUSTE, RETORNO}) e, como antes, emUso do reajuste.
-- i. O cancelamento traz a prévia do plano da volta (retornoPlano) e a linha Comissão do quadro 487;
--    um cancelamento antigo abre sozinho (comercial_cancelamento), mesmo fora da lista.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- 1. O catálogo de retenção (0301) com o que esta rodada guarda (C7).

update retencao_tipos
   set o_que = 'Quem pediu, retenção, notas (e a de desfazer), motivo da revogação e o representante do retorno que não reativou',
       prazo = '12 meses depois do último dia (ou do desfazer, do sinal tratado ou da expansão encerrada)'
 where codigo = 'CANCELAMENTO';
update retencao_tipos
   set o_que = 'O PDF com as duas assinaturas e a conferência; também o dos aditivos (no retorno, nome e CPF de quem assinou)'
 where codigo = 'CONTRATO_ASSINADO';

-- ---------------------------------------------------------------------------------------
-- 2. O último dia que vale (A1): o encerramento não revogado.

alter table encerramentos_contrato
  add column revogado_em     timestamptz,
  add column revogado_por    uuid references pessoas (id),
  add column revogado_motivo text check (length(btrim(revogado_motivo)) between 3 and 300),
  add constraint encerramentos_contrato_revogacao
    check ((revogado_em is null) = (revogado_por is null) and (revogado_em is null) = (revogado_motivo is null));
alter table encerramentos_contrato drop constraint encerramentos_contrato_condominio_id_key;
create unique index encerramentos_contrato_um_vigente on encerramentos_contrato (condominio_id) where revogado_em is null;

-- Só inserção, menos a revogação (os três campos juntos, uma vez) e o motivo apagado (LGPD).
create function encerramentos_contrato_regras() returns trigger
language plpgsql
set search_path = public
as $$
declare v_revogacao text[] := array['revogado_em', 'revogado_por', 'revogado_motivo'];
begin
  if tg_op = 'DELETE' then
    raise exception 'Registro só de inserção em % (% bloqueado)', tg_table_name, tg_op using errcode = 'TC010';
  end if;
  if old.revogado_em is null and new.revogado_em is not null and (to_jsonb(new) - v_revogacao) = (to_jsonb(old) - v_revogacao) then
    return new;
  end if;
  if old.revogado_em is not null and new.revogado_motivo = 'Dado apagado (LGPD)'
     and (to_jsonb(new) - 'revogado_motivo') = (to_jsonb(old) - 'revogado_motivo') then
    return new;
  end if;
  raise exception 'O último dia registrado só se revoga, uma vez' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
end $$;
create or replace trigger encerramentos_contrato_sem_mudanca before update or delete on encerramentos_contrato
  for each row execute function encerramentos_contrato_regras();

-- O último dia que vale no condomínio (nulo sem encerramento ou com ele revogado). Lê no contexto do
-- condomínio, como o conjunto_modo: quem chama já entrou nele.
-- Em plpgsql, e não em sql: a consulta em sql chamada de dentro de outra função guarda o plano
-- da primeira chamada (com o RLS de quem chamou) até o fim da transação.
create function contrato_ultimo_dia(p_condominio uuid) returns date
language plpgsql stable
set search_path = public
as $$
begin
  return (select ultimo_dia from encerramentos_contrato where condominio_id = p_condominio and revogado_em is null);
end $$;

create function contrato_encerrado(p_condominio uuid) returns boolean
language plpgsql stable
set search_path = public
as $$
begin
  return coalesce(contrato_ultimo_dia(p_condominio) < comercial_hoje(), false);
end $$;

-- A recusa da entrada sem pessoa (A4): o nome do condomínio e o dia seguinte ao último, para a
-- página "Este condomínio não usa mais a TRÍADE" (quadro 489).
create function exigir_contrato_vigente(p_condominio uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_dia date := contrato_ultimo_dia(p_condominio);
begin
  if v_dia is not null and v_dia < comercial_hoje() then
    raise exception 'Este condomínio não usa mais a TRÍADE' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'CONTRATO_ENCERRADO', 'condominio', (select nome from condominios where id = p_condominio),
                                  'desde', v_dia + 1)::text;
  end if;
end $$;

-- O módulo do plano (0311), agora pelo contrato_encerrado.
create or replace function conjunto_modo(p_condominio uuid, p_conjunto text) returns text
language sql stable
set search_path = public
as $$
  select case
    when contrato_encerrado(p_condominio) then 'CONSULTA'
    when (select base from conjuntos where codigo = p_conjunto) then 'COMPLETO'
    when cc.id is null then 'FORA'
    when cc.estado = 'LIBERADO' and cc.contratado then 'COMPLETO'
    when cc.estado = 'TESTE' and cc.teste_ate >= hoje_no_condominio() then 'COMPLETO'
    when cc.estado = 'NAO_LIBERADO' and not cc.ja_liberado then 'FORA'
    else 'CONSULTA' end
  from (select 1) x
  left join conjuntos_cliente cc on cc.condominio_id = p_condominio and cc.conjunto = p_conjunto
$$;

-- O que o plano deixa (0311), agora pelo contrato_encerrado.
create or replace function exigir_conjunto(p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_conjunto text;
  v_modo text;
begin
  -- Depois do último dia, o que fica não depende do módulo (conjunto_modo já diz consulta para todos).
  if contrato_encerrado(p_condominio) then
    if p_acao like 'console.%' or p_acao like '%.ver' or p_acao like 'privacidade.%'
       or p_acao in ('memoria.exportar', 'memoria.dossie', 'suporte.chamados', 'acesso_excepcional.aprovar') then
      return;
    end if;
    perform recusar_motivo('O contrato deste condomínio terminou: ficam a consulta e a exportação', 'CONTRATO_ENCERRADO');
  end if;
  v_conjunto := conjunto_da_acao(p_acao);
  if v_conjunto is null then return; end if;
  v_modo := conjunto_modo(p_condominio, v_conjunto);
  if v_modo = 'COMPLETO' or (v_modo = 'CONSULTA' and (p_acao like '%.ver' or p_acao = 'memoria.exportar')) then
    return;
  end if;
  perform recusar_motivo(format('%s não está no plano deste condomínio', (select nome from conjuntos where codigo = v_conjunto)),
                         case v_modo when 'CONSULTA' then 'CONJUNTO_SUSPENSO' else 'CONJUNTO_FORA_DO_PLANO' end);
end $$;

-- Abrir a competência (0311): a competência depois do último dia que vale não abre.
create or replace function console_abrir_competencia(p_pessoa uuid, p_competencia date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_comp date := date_trunc('month', p_competencia)::date;
  pl planos_cliente;
  v_criadas integer := 0;
  v_ja integer := 0;
  v_sem_plano integer := 0;
  v_encerrados integer := 0;
  v_cobranca uuid;
begin
  perform entrar_console(p_pessoa, 'console.pagamentos.registrar');
  if p_competencia is null then perform recusar_campos('Diga a competência', 'competencia'); end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select (x #>> '{}')::uuid as id from jsonb_array_elements(v_lista) x loop
    if pode(p_pessoa, r.id, 'console.pagamentos.registrar') then
      perform entrar_condominio(p_pessoa, r.id, 'console.pagamentos.registrar');
      select * into pl from planos_cliente where condominio_id = r.id;
      if contrato_ultimo_dia(r.id) < v_comp then
        v_encerrados := v_encerrados + 1;
        continue;
      end if;
      if pl.id is not null then pl := aplicar_reajustes_plano(pl, v_comp); end if;
      if pl.id is null or pl.inicio_competencia > v_comp
         or (pl.ciclo = 'ANUAL' and extract(month from pl.inicio_competencia) <> extract(month from v_comp)) then
        v_sem_plano := v_sem_plano + 1;
      elsif exists (select 1 from cobrancas where condominio_id = r.id and tipo = 'MENSALIDADE' and competencia = v_comp) then
        v_ja := v_ja + 1;
      else
        insert into cobrancas (condominio_id, tipo, competencia, valor_centavos, vence_em, criada_por)
        values (r.id, 'MENSALIDADE', v_comp, pl.valor_centavos, v_comp + (pl.dia_vencimento - 1), p_pessoa)
        returning id into v_cobranca;
        perform registrar_historico_interno('cobranca.aberta', 'cobranca', v_cobranca::text, jsonb_build_object('competencia', v_comp));
        v_criadas := v_criadas + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('criadas', v_criadas, 'jaAbertas', v_ja, 'semPlano', v_sem_plano, 'encerrados', v_encerrados);
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. Os links públicos (A4, escolha b): a porta de entrada de todos recusa depois do último dia.

-- 0160, agora com o contrato que terminou; só o parar de receber e-mail continua.
create or replace function entrar_por_link(p_codigo text, p_tipos text[]) returns links_publicos
language plpgsql
set search_path = public
as $$
declare l links_publicos;
begin
  perform limpar_contexto();
  if p_codigo is null or length(p_codigo) not between 14 and 64 or p_codigo !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Link não encontrado' using errcode = 'TC404';
  end if;
  select * into l from links_publicos where hash = hash_codigo(p_codigo) and tipo = any (p_tipos);
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  perform entrar_como_sistema(l.condominio_id);
  if l.tipo <> 'PARAR_EMAIL' then perform exigir_contrato_vigente(l.condominio_id); end if;
  return l;
end $$;

-- 0170, agora com o contrato que terminou: etiqueta, prestador, enquete, assembleia, cadastro,
-- conselho e orçamento.
create or replace function entrar_por_codigo(p_codigo text, p_tipo text) returns codigos_sem_conta
language plpgsql
set search_path = public
as $$
declare l codigos_sem_conta;
begin
  perform limpar_contexto();
  if p_codigo is null or length(p_codigo) not between 14 and 64 or p_codigo !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Link não encontrado' using errcode = 'TC404';
  end if;
  select * into l from codigos_sem_conta where hash = hash_codigo(p_codigo) and tipo = p_tipo;
  if not found then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  perform entrar_como_sistema(l.condominio_id);
  perform exigir_contrato_vigente(l.condominio_id);
  return l;
end $$;

-- 0160: voltar a receber e-mail usa o link de parar, que fica aberto; voltar recusa (F1).
create or replace function publico_voltar_email(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ct contatos;
begin
  ct := exigir_link_parar(p_codigo);
  perform exigir_contrato_vigente(ct.condominio_id);
  if ct.email_situacao = 'PAROU' and ct.email_parou_motivo = 'PEDIDO' then
    update contatos set email_situacao = 'CONFIRMADO', email_parou_motivo = null, email_confirmado_em = app_now() where id = ct.id;
    perform registrar_historico('contato.email_voltou', 'contato', ct.id::text);
  end if;
  return jsonb_build_object('condominio', (select nome from condominios where id = ct.condominio_id),
                            'parou', (select email_situacao = 'PAROU' from contatos where id = ct.id));
end $$;

-- ---------------------------------------------------------------------------------------
-- 4. O WhatsApp recebido (A2): não grava, não responde e não baixa mídia.

alter function whatsapp_receber(text, text, jsonb) rename to whatsapp_receber_r177c;
create function whatsapp_receber(p_segredo text, p_instancia text, p_msg jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cx conexoes_whatsapp;
begin
  cx := entrar_por_gancho(p_segredo, p_instancia);
  if contrato_encerrado(cx.condominio_id) then
    perform entrar_como_sistema(null);
    return jsonb_build_object('repetida', true, 'midias', '[]'::jsonb);
  end if;
  return whatsapp_receber_r177c(p_segredo, p_instancia, p_msg);
end $$;

-- 0200, sem as mídias do condomínio encerrado.
create or replace function whatsapp_midias_pendentes() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v jsonb := '[]'::jsonb;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios loop
    perform entrar_como_sistema(r.id);
    continue when contrato_encerrado(r.id);
    v := v || coalesce((select jsonb_agg(jsonb_build_object('condominio', m.condominio_id, 'mensagem', m.id, 'url', m.midia_url,
                                                            'tipo', m.midia_tipo, 'caminho', 'whatsapp/' || m.condominio_id || '/' || m.id))
                          from (select * from mensagens_whatsapp where midia_situacao = 'BAIXAR' order by recebida_em limit 20) m), '[]'::jsonb);
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v;
end $$;

-- 0298, sem a transcrição do condomínio encerrado (paga por uso).
create or replace function whatsapp_iniciar_transcricao(p_condominio uuid, p_mensagem uuid, p_provedores text[], p_segundos integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m mensagens_whatsapp;
  v jsonb;
begin
  perform entrar_como_sistema(p_condominio);
  if contrato_encerrado(p_condominio) then perform entrar_como_sistema(null); return jsonb_build_object('indisponivel', true); end if;
  select * into m from mensagens_whatsapp where id = p_mensagem;
  if m.id is null then perform entrar_como_sistema(null); return jsonb_build_object('indisponivel', true); end if;
  v := iniciar_transcricao(m, p_provedores, p_segundos);
  perform entrar_como_sistema(null);
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 5. As filas (A3): o que está na fila do condomínio encerrado é cancelado e não sai.

alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_r177c;
create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  -- Como no lote (0210): só o verificador enxerga todos os condomínios.
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    if contrato_encerrado(r.id) then
      update envios_whatsapp set estado = 'CANCELADA', motivo = 'O contrato do condomínio terminou' where estado = 'NA_FILA';
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return pegar_lote_whatsapp_r177c(p_max);
end $$;

alter function email_pegar_lote(integer) rename to pegar_lote_email_r177c;
create function email_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    if contrato_encerrado(r.id) then
      -- O que travou no meio do envio voltaria para a fila (0160): também é cancelado.
      update envios_email set estado = 'CANCELADO', motivo = 'O contrato do condomínio terminou'
       where estado = 'NA_FILA' or (estado = 'ENVIANDO' and enviar_apos <= app_now() - interval '15 minutes');
    end if;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return pegar_lote_email_r177c(p_max);
end $$;

-- ---------------------------------------------------------------------------------------
-- 6. As rotinas por condomínio (A5): pulam o condomínio encerrado. O que estava aberto fica como
-- estava, para consulta.

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
    continue when contrato_encerrado(c.id);
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

create or replace function verificar_prazos() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
  v_agora timestamptz := app_now();
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    continue when contrato_encerrado(c.id);
    begin
      v_total := v_total + verificar_prazos_condominio(v_agora);
    exception when others then
      raise warning 'Prazos do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

create or replace function verificar_manutencao() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
  v_agora timestamptz := app_now();
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    continue when contrato_encerrado(c.id);
    begin
      v_total := v_total + abrir_preventivas() + avisar_manutencoes(v_agora);
    exception when others then
      raise warning 'Manutenção do condomínio % não conferida: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

create or replace function verificar_encomendas() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total integer := 0;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    continue when contrato_encerrado(r.id);
    begin
      v_total := v_total + lembrar_encomendas();
    exception when others then
      raise warning 'Encomendas do condomínio % não conferidas: %', r.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- As decisões vencidas (0280, o invólucro da 0303 chama).
create or replace function verificar_decisoes_f303() returns integer
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
    continue when contrato_encerrado(c.id);
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

create or replace function verificar_decisoes() returns integer
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
    continue when contrato_encerrado(c.id);
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

-- Enquete e assembleia (dentro do condomínio): sem fechar, sem lembrete.
create or replace function verificar_enquetes() returns integer
language plpgsql
set search_path = public
as $$
declare
  e enquetes;
  c convites_enquete;
  v_n integer := 0;
begin
  if contrato_encerrado(contexto_condominio()) then return 0; end if;
  for e in select * from enquetes where encerrada_em is null and aberta_ate <= app_now() loop
    perform fechar_enquete(e.id, e.aberta_ate, null);
    v_n := v_n + 1;
  end loop;
  for e in select * from enquetes where encerrada_em is null and aberta_ate > app_now() and lembrete_em <= app_now()
                                    and lembrete_enviado_em is null for update skip locked loop
    for c in select * from convites_enquete where enquete_id = e.id and respondeu_em is null loop
      v_n := v_n + enviar_convite_enquete(e, c, true, e.criado_por);
    end loop;
    update enquetes set lembrete_enviado_em = app_now() where id = e.id;
    perform registrar_historico('enquete.lembrete', 'enquetes', e.id::text,
      jsonb_build_object('faltam', (select count(*) from convites_enquete where enquete_id = e.id and respondeu_em is null)));
  end loop;
  return v_n;
end $$;

create or replace function verificar_assembleias() returns integer
language plpgsql
set search_path = public
as $$
declare
  a assembleias;
  c convites_assembleia;
  v_n integer := 0;
begin
  if contrato_encerrado(contexto_condominio()) then return 0; end if;
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

-- ---------------------------------------------------------------------------------------
-- 7. O cancelamento desfeito e o cliente reativado (B2).

alter table cancelamentos_cliente
  add column desfeito_em          timestamptz,
  add column desfeito_por         uuid references pessoas (id),
  add column desfeito_nota        text check (length(btrim(desfeito_nota)) between 3 and 300),
  add column reativado_em         timestamptz,
  add column reativado_por        uuid references pessoas (id);
alter table cancelamentos_cliente drop constraint cancelamentos_cliente_situacao_check;
alter table cancelamentos_cliente drop constraint cancelamentos_cliente_check4;
alter table cancelamentos_cliente drop constraint cancelamentos_cliente_check5;
alter table cancelamentos_cliente drop constraint cancelamentos_cliente_check8;
alter table cancelamentos_cliente drop constraint cancelamentos_cliente_check9;
alter table cancelamentos_cliente
  add constraint cancelamentos_cliente_situacao_check
    check (situacao in ('PEDIDO', 'EM_RETENCAO', 'FICOU', 'CONFIRMADO', 'DESFEITO', 'REATIVADO')),
  add constraint cancelamentos_cliente_decidido
    check ((situacao in ('FICOU', 'CONFIRMADO', 'DESFEITO', 'REATIVADO')) = (decidido_em is not null and decidido_por is not null)),
  add constraint cancelamentos_cliente_motivo_confirmado
    check (situacao not in ('CONFIRMADO', 'DESFEITO', 'REATIVADO') or motivo is not null),
  add constraint cancelamentos_cliente_lembrar
    check (lembrar_em is null or (situacao in ('CONFIRMADO', 'DESFEITO', 'REATIVADO') and lembrar_em > ultimo_dia)),
  add constraint cancelamentos_cliente_exportacao
    check (exportacao_id is null or situacao in ('CONFIRMADO', 'DESFEITO', 'REATIVADO')),
  add constraint cancelamentos_cliente_desfeito
    check ((situacao = 'DESFEITO') = (desfeito_em is not null and desfeito_por is not null)
           and (desfeito_nota is null or situacao = 'DESFEITO')
           and (situacao <> 'DESFEITO' or desfeito_nota is not null or textos_apagados_em is not null));
drop index cancelamentos_cliente_um_aberto;
create unique index cancelamentos_cliente_um_aberto on cancelamentos_cliente (interessado_id)
  where situacao not in ('FICOU', 'DESFEITO', 'REATIVADO');

-- 0311, agora com o confirmado que vira desfeito ou reativado, uma vez.
create or replace function cancelamentos_cliente_regras() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fixos text[] := array['id', 'interessado_id', 'condominio_id', 'pedido_em', 'aviso_dias', 'ultimo_dia', 'criado_em', 'criado_por'];
  v_volta text[] := array['situacao', 'desfeito_em', 'desfeito_por', 'desfeito_nota', 'reativado_em', 'reativado_por', 'reativado_aditivo_id',
                          'alterado_em', 'alterado_por', 'versao'];
begin
  if (select jsonb_object_agg(k, to_jsonb(new) -> k) from unnest(v_fixos) k) is distinct from (select jsonb_object_agg(k, to_jsonb(old) -> k) from unnest(v_fixos) k) then
    raise exception 'O pedido de cancelamento não troca de cliente nem de data' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  -- Os textos apagados (LGPD) só saem.
  if new.textos_apagados_em is not null and old.textos_apagados_em is null then
    if num_nonnulls(new.pedido_por, new.retencao, new.decisao_nota, new.motivo_texto, new.desfeito_nota) > 0 then
      raise exception 'Os textos apagados saem todos' using errcode = 'TC422';
    end if;
    return new;
  end if;
  if old.situacao = 'CONFIRMADO' and new.situacao in ('DESFEITO', 'REATIVADO')
     and (to_jsonb(new) - v_volta) = (to_jsonb(old) - v_volta) then
    return new;
  end if;
  if old.situacao in ('FICOU', 'CONFIRMADO', 'DESFEITO', 'REATIVADO') and (to_jsonb(new) - 'versao') is distinct from (to_jsonb(old) - 'versao') then
    raise exception 'O cancelamento decidido não muda' using errcode = 'TC422', detail = '{"motivo":"CANCELAMENTO_DECIDIDO"}';
  end if;
  if old.retencao_em is not null and (new.retencao, new.retencao_em, new.retencao_por) is distinct from (old.retencao, old.retencao_em, old.retencao_por) then
    raise exception 'A tentativa de retenção registrada não muda' using errcode = 'TC422', detail = '{"motivo":"RETENCAO_REGISTRADA"}';
  end if;
  return new;
end $$;

-- 0311: o pedido aberto ignora também o desfeito e o reativado (F7).
create or replace function comercial_clientes_lidos()
returns table (cli_id uuid, cond_id uuid, nome text, contato text, resp_id uuid, contrato integer, inicio date, plano jsonb, unidades integer,
               canc_id uuid, canc_situacao text, ultimo_dia date)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v jsonb;
begin
  for r in
    select i.id, i.condominio_id, i.condominio, i.nome_contato, i.responsavel_id, c.numero, (c.dados ->> 'dataInicio')::date as ini,
           k.id as kid, k.situacao as ksit, k.ultimo_dia as kdia
      from interessados i
      left join contratos_comercial c on c.interessado_id = i.id and c.situacao = 'ASSINADO'
      left join cancelamentos_cliente k on k.interessado_id = i.id and k.situacao not in ('FICOU', 'DESFEITO', 'REATIVADO')
     where i.virou_cliente_em is not null and i.condominio_id is not null and i.anonimizado_em is null
     order by i.condominio, i.id
  loop
    v := comercial_leitura_cliente(r.condominio_id);
    cli_id := r.id; cond_id := r.condominio_id; nome := r.condominio; contato := r.nome_contato; resp_id := r.responsavel_id;
    contrato := r.numero; inicio := r.ini; plano := v -> 'plano'; unidades := (v ->> 'unidadesAtivas')::integer;
    canc_id := r.kid; canc_situacao := r.ksit; ultimo_dia := r.kdia;
    return next;
  end loop;
end $$;

create or replace function comercial_pedir_cancelamento(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  k cancelamentos_cliente;
  v_por text := comercial_texto(p_dados, 'pedidoPor');
  v_em timestamptz;
  v_dias integer := configuracao_int('comercial_cancelamento_aviso_dias');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  begin
    v_em := coalesce(nullif(p_dados ->> 'pedidoEm', '')::timestamptz, app_now());
  exception when others then
    perform recusar_campos('Diga quando o síndico pediu', 'pedidoEm');
  end;
  i := comercial_buscar_cliente(p_interessado, true);
  if exists (select 1 from cancelamentos_cliente where interessado_id = i.id and situacao not in ('FICOU', 'DESFEITO', 'REATIVADO')) then
    perform recusar_motivo('Este cliente já tem um pedido de cancelamento', 'CANCELAMENTO_ABERTO');
  end if;
  if coalesce(length(v_por), 0) not between 2 and 120 then perform recusar_campos('Diga quem pediu', 'pedidoPor'); end if;
  if v_em > app_now() + interval '5 minutes' or v_em < app_now() - interval '30 days' then
    perform recusar_campos('O pedido foi feito agora ou nos últimos 30 dias', 'pedidoEm');
  end if;
  insert into cancelamentos_cliente (interessado_id, condominio_id, pedido_por, pedido_em, aviso_dias, ultimo_dia, criado_por)
  values (i.id, i.condominio_id, v_por, v_em, v_dias, (v_em at time zone 'America/Sao_Paulo')::date + v_dias, p_pessoa)
  returning * into k;
  perform comercial_inserir_conversa(i.id, 'NOTA', 'Pedido de cancelamento registrado; último dia ' || comercial_data_br(k.ultimo_dia) || ' se confirmar.',
                                     false, null, null);
  perform registrar_historico_interno('comercial.cancelamento_pedido', 'cancelamento_cliente', k.id::text, jsonb_build_object('ultimoDia', k.ultimo_dia));
  return comercial_cancelamento_resposta(k);
end $$;

-- 0311: o desfeito e o reativado também já foram decididos.
create or replace function comercial_travar_cancelamento(p_id uuid, p_versao integer) returns cancelamentos_cliente
language plpgsql
set search_path = public
as $$
declare
  v_interessado uuid;
  k cancelamentos_cliente;
begin
  select interessado_id into v_interessado from cancelamentos_cliente where id = p_id;
  if v_interessado is null then raise exception 'Pedido de cancelamento não encontrado' using errcode = 'TC404'; end if;
  perform comercial_buscar_cliente(v_interessado, true);
  select * into k from cancelamentos_cliente where id = p_id for update;
  if k.versao <> p_versao then perform conflito_versao('cancelamentos_cliente', p_id); end if;
  if k.situacao in ('FICOU', 'CONFIRMADO', 'DESFEITO', 'REATIVADO') then
    perform recusar_motivo('Este pedido de cancelamento já foi decidido', 'CANCELAMENTO_DECIDIDO');
  end if;
  return k;
end $$;

-- O cancelamento confirmado, travado na ordem de sempre (interessado e depois o pedido). Sem
-- versão, não confere (gerar o aditivo de retorno não muda o cancelamento).
create function comercial_travar_confirmado(p_id uuid, p_versao integer) returns cancelamentos_cliente
language plpgsql
set search_path = public
as $$
declare
  v_interessado uuid;
  k cancelamentos_cliente;
begin
  select interessado_id into v_interessado from cancelamentos_cliente where id = p_id;
  if v_interessado is null then raise exception 'Pedido de cancelamento não encontrado' using errcode = 'TC404'; end if;
  perform comercial_buscar_cliente(v_interessado, true);
  select * into k from cancelamentos_cliente where id = p_id for update;
  -- O já decidido diz o que aconteceu antes do conflito de versão (dois desfazer ao mesmo tempo).
  if k.situacao in ('DESFEITO', 'REATIVADO') then
    perform recusar_motivo('Este cancelamento já foi desfeito ou o cliente já foi reativado', 'CANCELAMENTO_DECIDIDO');
  end if;
  if k.situacao <> 'CONFIRMADO' then
    perform recusar_motivo('Só o cancelamento confirmado se desfaz ou se reativa', 'CANCELAMENTO_NAO_CONFIRMADO');
  end if;
  if p_versao is not null and k.versao <> p_versao then perform conflito_versao('cancelamentos_cliente', p_id); end if;
  return k;
end $$;

-- ---------------------------------------------------------------------------------------
-- 8. A comissão do parceiro que o cancelamento encerrou reabre ao desfazer (B3).

-- 0310, agora com a reabertura: só pelo desfazer (app.comissao_reabrir), os quatro campos de volta
-- a vazio, uma vez por desfazer.
create or replace function comissoes_parceiro_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.parceiro_id, new.interessado_id, new.condominio_id, new.condominio, new.percentual, new.prazo_meses, new.inicio,
      new.mensal_centavos, new.depois_centavos, new.fundador_meses, new.criado_em)
     is distinct from (old.id, old.parceiro_id, old.interessado_id, old.condominio_id, old.condominio, old.percentual, old.prazo_meses, old.inicio,
                       old.mensal_centavos, old.depois_centavos, old.fundador_meses, old.criado_em) then
    raise exception 'A comissão só muda para encerrada, uma vez' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  if old.encerrada_em is not null then
    if comercial_sistema() and coalesce(current_setting('app.comissao_reabrir', true), '') = old.id::text
       and num_nonnulls(new.sem_comissao_desde, new.encerrada_motivo, new.encerrada_em, new.encerrada_por) = 0 then
      return new;
    end if;
    raise exception 'A comissão só muda para encerrada, uma vez' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------
-- 9. Desfazer antes do último dia (F5, quadro 487).

create function comercial_desfazer_cancelamento(p_pessoa uuid, p_id uuid, p_versao integer, p_nota text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  i interessados;
  v_nota text := nullif(btrim(p_nota), '');
  v_comissao uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  k := comercial_travar_confirmado(p_id, p_versao);
  if k.ultimo_dia < comercial_hoje() then
    perform recusar_motivo('O último dia já passou: a volta é pelo aditivo de retorno', 'ULTIMO_DIA_PASSOU');
  end if;
  if coalesce(length(v_nota), 0) not between 3 and 300 then
    perform recusar_campos('Diga quem pediu para desfazer e como (de 3 a 300 letras)', 'nota');
  end if;
  i := comercial_buscar_cliente(k.interessado_id);
  -- No condomínio: o último dia revogado (o registro fica) e o histórico que o síndico vê.
  perform entrar_como_sistema(k.condominio_id);
  update encerramentos_contrato set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = left('Cancelamento desfeito: ' || v_nota, 300)
   where cancelamento_id = k.id and revogado_em is null;
  perform registrar_historico('contrato.encerramento_revogado', 'encerramentos_contrato', k.condominio_id::text,
    jsonb_build_object('ultimoDia', k.ultimo_dia));
  perform definir_pessoa(p_pessoa);
  update cancelamentos_cliente set situacao = 'DESFEITO', desfeito_em = app_now(), desfeito_por = p_pessoa, desfeito_nota = v_nota,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = k.id
  returning * into k;
  -- A comissão que a confirmação encerrou (o motivo que ela gravou) volta a correr.
  perform set_config('app.comercial_sistema', 'on', true);
  perform set_config('app.comissao_reabrir',
    coalesce((select c.id::text from comissoes_parceiro c
               where c.interessado_id = k.interessado_id and c.encerrada_motivo = 'Cancelamento: último dia ' || comercial_data_br(k.ultimo_dia)), ''), true);
  update comissoes_parceiro c set sem_comissao_desde = null, encerrada_motivo = null, encerrada_em = null, encerrada_por = null
   where c.id::text = current_setting('app.comissao_reabrir', true)
  returning c.id into v_comissao;
  perform set_config('app.comissao_reabrir', '', true);
  perform set_config('app.comercial_sistema', '', true);
  if v_comissao is not null then
    perform registrar_historico_interno('comercial.comissao_reaberta', 'comissao_parceiro', v_comissao::text, jsonb_build_object('cancelamento', k.id));
  end if;
  perform comercial_inserir_conversa(k.interessado_id, 'NOTA', left('Cancelamento desfeito: ' || v_nota, 1000), false, null, null);
  perform registrar_historico_interno('comercial.cancelamento_desfeito', 'cancelamento_cliente', k.id::text,
    jsonb_build_object('ultimoDia', k.ultimo_dia, 'comissao', v_comissao is not null));
  return jsonb_build_object('cancelamento', comercial_cancelamento_json(k, i.condominio, comercial_leitura_cliente(i.condominio_id) -> 'plano'));
end $$;

-- ---------------------------------------------------------------------------------------
-- 10. Modelos › Aditivo com duas partes: Reajuste e Retorno (C1).

create function aditivo_campos(p_tipo text) returns text[]
language sql immutable
set search_path = public
as $$
  select case p_tipo
    when 'RETORNO' then array['condominio', 'cnpj', 'representante', 'cpf_representante', 'contrato', 'data_contrato', 'ultimo_dia', 'plano',
                              'valor_mensal', 'vale_desde']
    else aditivo_campos() end
$$;

create function aditivo_campos_errados(p_tipo text, p text) returns text[]
language sql immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select '«' || m[1] || '»' as x from regexp_matches(coalesce(p, ''), '«([^«»]*)»', 'g') m where not (m[1] = any (aditivo_campos(p_tipo)))
    union all
    select s from (values ('«'), ('»')) v(s) where strpos(regexp_replace(coalesce(p, ''), '«[^«»]*»', '', 'g'), s) > 0
  ) e
$$;

alter table modelos_aditivo add column tipo text not null default 'REAJUSTE' check (tipo in ('REAJUSTE', 'RETORNO'));
alter table modelos_aditivo drop constraint modelos_aditivo_texto_check1;
alter table modelos_aditivo add constraint modelos_aditivo_campos check (cardinality(aditivo_campos_errados(tipo, texto)) = 0);
alter table modelos_aditivo drop constraint modelos_aditivo_numero_key;
alter table modelos_aditivo add constraint modelos_aditivo_tipo_numero unique (tipo, numero);
drop index modelos_aditivo_um_em_uso;
create unique index modelos_aditivo_um_em_uso on modelos_aditivo (tipo) where situacao = 'EM_USO';

create or replace function modelos_aditivo_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.tipo, new.numero, new.criado_em, new.criado_por) is distinct from (old.id, old.tipo, old.numero, old.criado_em, old.criado_por) then
    raise exception 'O modelo não troca de número nem de tipo' using errcode = 'TC422', detail = '{"motivo":"MODELO_EM_USO"}';
  end if;
  if old.situacao = 'RASCUNHO' and new.situacao in ('RASCUNHO', 'EM_USO') then return new; end if;
  if old.situacao = 'EM_USO' and new.situacao = 'SUBSTITUIDA'
     and (to_jsonb(new) - array['situacao', 'substituida_em', 'alterado_em', 'alterado_por', 'versao'])
         is not distinct from (to_jsonb(old) - array['situacao', 'substituida_em', 'alterado_em', 'alterado_por', 'versao']) then
    return new;
  end if;
  raise exception 'A versão em uso não se edita; cadastre a versão seguinte' using errcode = 'TC422', detail = '{"motivo":"MODELO_EM_USO"}';
end $$;

create or replace function modelo_aditivo_json(m modelos_aditivo) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'versao', m.versao, 'tipo', m.tipo, 'numero', m.numero, 'titulo', m.titulo, 'texto', m.texto, 'situacao', m.situacao,
    'emUsoEm', m.em_uso_em, 'emUsoPor', comercial_pessoa_json(m.em_uso_por), 'substituidaEm', m.substituida_em,
    'criadoEm', m.criado_em, 'criadoPor', comercial_pessoa_json(m.criado_por),
    'aditivos', (select count(*) from aditivos_comercial a where a.modelo_id = m.id)))
$$;

-- A leitura de antes (versões, em uso e campos do reajuste) continua; "tipos" traz as duas partes.
create or replace function comercial_modelos_aditivo(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'versoes', coalesce((select jsonb_agg(modelo_aditivo_json(m) order by m.tipo, m.numero desc) from modelos_aditivo m), '[]'::jsonb),
    'emUso', (select modelo_aditivo_json(m) from modelos_aditivo m where m.situacao = 'EM_USO' and m.tipo = 'REAJUSTE'),
    'campos', jsonb_build_object('REAJUSTE', to_jsonb(aditivo_campos('REAJUSTE')), 'RETORNO', to_jsonb(aditivo_campos('RETORNO'))),
    'regra', (select comercial_regra_reajuste_json(r) from regra_reajuste r),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

create or replace function comercial_salvar_modelo_aditivo(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m modelos_aditivo;
  v_titulo text := comercial_texto(p_dados, 'titulo');
  v_texto text := comercial_texto(p_dados, 'texto');
  v_pedido text := comercial_texto(p_dados, 'tipo');
  v_tipo text;
  v_errados text[];
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if v_pedido is not null and v_pedido not in ('REAJUSTE', 'RETORNO') then perform recusar_campos('Escolha o tipo do aditivo', 'tipo'); end if;
  v_tipo := coalesce(v_pedido, (select tipo from modelos_aditivo where id = p_id), 'REAJUSTE');
  if exists (select 1 from modelos_aditivo where id = p_id and tipo <> v_pedido) then
    perform recusar_campos('O tipo do modelo não muda; cadastre um modelo do outro tipo', 'tipo');
  end if;
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Diga o título do aditivo', 'titulo'); end if;
  if coalesce(length(v_texto), 0) not between 50 and 20000 then perform recusar_campos('Cole o texto do aditivo (de 50 a 20 mil letras)', 'texto'); end if;
  v_errados := aditivo_campos_errados(v_tipo, v_texto);
  if cardinality(v_errados) > 0 then
    raise exception 'Campo escrito errado ou que não existe' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'CAMPO_ERRADO', 'campos', jsonb_build_array('texto'), 'camposErrados', to_jsonb(v_errados))::text;
  end if;
  perform pg_advisory_xact_lock(hashtext('modelos_aditivo'));
  if p_id is null then
    insert into modelos_aditivo (tipo, numero, titulo, texto, criado_por)
    values (v_tipo, (select coalesce(max(numero), 0) + 1 from modelos_aditivo where tipo = v_tipo), v_titulo, v_texto, p_pessoa)
    returning * into m;
  else
    select * into m from modelos_aditivo where id = p_id for update;
    if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
    if m.tipo <> v_tipo then perform recusar_campos('O tipo do modelo não muda; cadastre um modelo do outro tipo', 'tipo'); end if;
    if m.situacao <> 'RASCUNHO' then perform recusar_motivo('A versão em uso não se edita; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
    if m.versao <> p_versao then perform conflito_versao('modelos_aditivo', p_id); end if;
    update modelos_aditivo set titulo = v_titulo, texto = v_texto, alterado_em = app_now(), alterado_por = p_pessoa where id = p_id
    returning * into m;
  end if;
  perform registrar_historico_interno('comercial.modelo_aditivo', 'modelo_aditivo', m.id::text, jsonb_build_object('numero', m.numero, 'tipo', m.tipo));
  return modelo_aditivo_json(m);
end $$;

-- "Usar" troca só a versão em uso do mesmo tipo.
create or replace function comercial_usar_modelo_aditivo(p_pessoa uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m modelos_aditivo;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  perform pg_advisory_xact_lock(hashtext('modelos_aditivo'));
  select * into m from modelos_aditivo where id = p_id for update;
  if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if m.versao <> p_versao then perform conflito_versao('modelos_aditivo', p_id); end if;
  if m.situacao = 'EM_USO' then return modelo_aditivo_json(m); end if;
  if m.situacao <> 'RASCUNHO' then perform recusar_motivo('Esta versão já foi substituída; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
  update modelos_aditivo set situacao = 'SUBSTITUIDA', substituida_em = app_now(), alterado_em = app_now(), alterado_por = p_pessoa
   where situacao = 'EM_USO' and tipo = m.tipo;
  update modelos_aditivo set situacao = 'EM_USO', em_uso_em = app_now(), em_uso_por = p_pessoa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into m;
  perform registrar_historico_interno('comercial.modelo_aditivo_em_uso', 'modelo_aditivo', m.id::text, jsonb_build_object('numero', m.numero, 'tipo', m.tipo));
  return modelo_aditivo_json(m);
end $$;

-- ---------------------------------------------------------------------------------------
-- 11. O aditivo de retorno ao lado do de reajuste (C2).

alter table aditivos_comercial
  add column tipo               text not null default 'REAJUSTE' check (tipo in ('REAJUSTE', 'RETORNO')),
  add column cancelamento_id    uuid references cancelamentos_cliente (id),
  add column substituido_em     timestamptz,
  add column substituido_por    uuid references pessoas (id),
  add column substituido_motivo text check (length(btrim(substituido_motivo)) between 3 and 300),
  add column dados_apagados_em  timestamptz;
alter table aditivos_comercial alter column renovacao_id drop not null;
alter table aditivos_comercial drop constraint aditivos_comercial_situacao_check;
alter table aditivos_comercial drop constraint aditivos_comercial_check;
alter table aditivos_comercial
  add constraint aditivos_comercial_situacao_check check (situacao in ('GERANDO', 'PRONTO', 'SUBSTITUIDO')),
  add constraint aditivos_comercial_origem
    check ((tipo = 'REAJUSTE' and renovacao_id is not null and cancelamento_id is null)
           or (tipo = 'RETORNO' and cancelamento_id is not null and renovacao_id is null)),
  add constraint aditivos_comercial_pdf
    check (num_nonnulls(pdf_sha256, pdf_tamanho, pronto_em) in (0, 3) and (situacao <> 'PRONTO' or pronto_em is not null)
           and (situacao <> 'GERANDO' or pronto_em is null)),
  add constraint aditivos_comercial_substituido
    check ((situacao = 'SUBSTITUIDO') = (substituido_em is not null and substituido_por is not null and substituido_motivo is not null)
           and (situacao <> 'SUBSTITUIDO' or tipo = 'RETORNO'));
create unique index aditivos_comercial_um_retorno on aditivos_comercial (cancelamento_id) where situacao <> 'SUBSTITUIDO';

alter table cancelamentos_cliente
  add column reativado_aditivo_id uuid references aditivos_comercial (id),
  add constraint cancelamentos_cliente_reativado
    check ((situacao = 'REATIVADO') = (reativado_em is not null and reativado_por is not null and reativado_aditivo_id is not null));

-- 0311, agora com o substituído (gerar de novo) e o retrato apagado (LGPD, uma vez).
create or replace function aditivos_comercial_fixos() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pdf text[] := array['situacao', 'pdf_sha256', 'pdf_tamanho', 'pronto_em'];
  v_subst text[] := array['situacao', 'substituido_em', 'substituido_por', 'substituido_motivo'];
  v_lgpd text[] := array['dados', 'dados_apagados_em', 'substituido_motivo'];
begin
  if old.situacao = 'GERANDO' and new.situacao = 'PRONTO' and (to_jsonb(new) - v_pdf) = (to_jsonb(old) - v_pdf) then return new; end if;
  if old.situacao in ('GERANDO', 'PRONTO') and new.situacao = 'SUBSTITUIDO' and (to_jsonb(new) - v_subst) = (to_jsonb(old) - v_subst) then
    return new;
  end if;
  if comercial_sistema() and old.dados_apagados_em is null and new.dados_apagados_em is not null
     and (to_jsonb(new) - v_lgpd) = (to_jsonb(old) - v_lgpd) then
    return new;
  end if;
  raise exception 'O aditivo gerado não muda' using errcode = 'TC422', detail = '{"motivo":"ADITIVO_PRONTO"}';
end $$;

-- ---------------------------------------------------------------------------------------
-- 12. A assinatura dos aditivos pelo gov.br (C4, escolha a): só a equipe envia, o condomínio
-- (o PDF que o síndico assinou e mandou) e depois a TRÍADE, sobre esse arquivo.

create table envios_aditivo (
  id                uuid primary key default gen_random_uuid(),
  aditivo_id        uuid not null references aditivos_comercial (id),
  interessado_id    uuid not null references interessados (id),
  parte             text not null check (parte in ('CONDOMINIO', 'TRIADE')),
  situacao          text not null default 'ENVIANDO'
                    check (situacao in ('ENVIANDO', 'RECUSADO_NA_HORA', 'NAO_E_O_GERADO', 'A_CONFERIR', 'CONFERIDO', 'RECUSADO', 'SUBSTITUIDO')),
  nome              text check (length(btrim(nome)) between 1 and 200),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  sha256            text check (sha256 ~ '^[0-9a-f]{64}$'),
  enviado_por       uuid not null references pessoas (id),
  enviado_em        timestamptz not null default app_now(),
  -- A base da conferência automática: o PDF gerado (condomínio) ou o envio conferido do condomínio (TRÍADE).
  base_sha256       text not null check (base_sha256 ~ '^[0-9a-f]{64}$'),
  base_tamanho      integer not null check (base_tamanho between 1 and 10485760),
  base_assinaturas  integer not null check (base_assinaturas between 0 and 50),
  assinaturas       integer check (assinaturas between 0 and 1000),
  e_o_gerado        boolean,
  motivo_auto       text check (motivo_auto in ('ARQUIVO_INVALIDO', 'SEM_ASSINATURA', 'NAO_E_O_GERADO')),
  motivo_texto      text check (length(btrim(motivo_texto)) between 3 and 300),
  conferido_auto_em timestamptz,
  marca_valida      boolean,
  marca_pessoa      boolean,
  marca_data        boolean,
  assinante_nome    text check (length(btrim(assinante_nome)) between 2 and 120),
  cpf_mascarado     text check (cpf_mascarado ~ '^\*\*\*\.[0-9]{3}\.[0-9]{3}-\*\*$'),
  observacao        text check (length(btrim(observacao)) between 2 and 300),
  conferido_por     uuid references pessoas (id),
  conferido_em      timestamptz,
  recusa_motivo     text check (length(btrim(recusa_motivo)) between 3 and 300),
  recusado_por      uuid references pessoas (id),
  recusado_em       timestamptz,
  substituido_em    timestamptz,
  apagado_em        timestamptz,
  versao            integer not null default 1,
  check (situacao = 'ENVIANDO' or conferido_auto_em is not null or situacao = 'SUBSTITUIDO'),
  check ((situacao = 'RECUSADO_NA_HORA') = (motivo_auto in ('ARQUIVO_INVALIDO', 'SEM_ASSINATURA')) or situacao = 'SUBSTITUIDO' and motivo_auto is null
         or (situacao <> 'RECUSADO_NA_HORA' and motivo_auto is null) or (situacao in ('NAO_E_O_GERADO', 'RECUSADO', 'SUBSTITUIDO') and motivo_auto = 'NAO_E_O_GERADO')),
  check (situacao <> 'CONFERIDO' or (marca_valida and marca_pessoa and marca_data and conferido_por is not null and conferido_em is not null
                                     and (cpf_mascarado is not null or apagado_em is not null))),
  check ((recusado_em is null) = (recusa_motivo is null) or apagado_em is not null),
  check (situacao <> 'RECUSADO' or recusado_em is not null)
);
create index envios_aditivo_aditivo on envios_aditivo (aditivo_id, parte, enviado_em desc);
create unique index envios_aditivo_um_conferido on envios_aditivo (aditivo_id, parte) where situacao = 'CONFERIDO';
create unique index envios_aditivo_um_a_conferir on envios_aditivo (aditivo_id, parte) where situacao = 'A_CONFERIR';
call proteger_tabela_comercial('envios_aditivo', 'console.comercial.editar',
  'Envios do PDF do aditivo (reajuste e retorno) assinado pelo gov.br, com a conferência automática e a da equipe; o arquivo fica no bucket comercial');
create trigger envios_aditivo_sem_exclusao before delete on envios_aditivo for each row execute function somente_insercao();

-- A mesma ordem do contrato (0308).
create function envios_aditivo_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.aditivo_id, new.interessado_id, new.parte, new.caminho, new.enviado_por, new.enviado_em,
      new.base_sha256, new.base_tamanho, new.base_assinaturas)
     is distinct from (old.id, old.aditivo_id, old.interessado_id, old.parte, old.caminho, old.enviado_por, old.enviado_em,
                       old.base_sha256, old.base_tamanho, old.base_assinaturas)
     or (old.conferido_auto_em is not null
         and (new.sha256, new.tamanho, new.assinaturas, new.e_o_gerado, new.conferido_auto_em) is distinct from
             (old.sha256, old.tamanho, old.assinaturas, old.e_o_gerado, old.conferido_auto_em))
     or (old.conferido_em is not null and (new.conferido_em, new.conferido_por) is distinct from (old.conferido_em, old.conferido_por)) then
    raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
  end if;
  if new.situacao = old.situacao then
    -- Sem mudar de situação, só a anonimização e a retenção (LGPD) mexem no envio.
    if comercial_sistema() and new.apagado_em is not null then return new; end if;
    raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
  end if;
  if row(old.situacao, new.situacao) in (row('ENVIANDO', 'RECUSADO_NA_HORA'), row('ENVIANDO', 'NAO_E_O_GERADO'), row('ENVIANDO', 'A_CONFERIR'),
                                         row('ENVIANDO', 'SUBSTITUIDO'), row('A_CONFERIR', 'CONFERIDO'), row('A_CONFERIR', 'RECUSADO'),
                                         row('A_CONFERIR', 'SUBSTITUIDO'), row('NAO_E_O_GERADO', 'RECUSADO'), row('NAO_E_O_GERADO', 'SUBSTITUIDO'),
                                         row('CONFERIDO', 'SUBSTITUIDO')) then
    return new;
  end if;
  raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
end $$;
create trigger envios_aditivo_regras before update on envios_aditivo for each row execute function envios_aditivo_regras();

create function envio_aditivo_json(e envios_aditivo) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'versao', e.versao, 'parte', e.parte, 'situacao', e.situacao, 'enviadoEm', e.enviado_em,
    'enviadoPor', comercial_pessoa_json(e.enviado_por), 'nome', e.nome, 'tamanho', e.tamanho, 'sha256', e.sha256,
    'motivo', coalesce(e.motivo_auto, case when e.situacao = 'RECUSADO' then 'RECUSADO_NA_CONFERENCIA' end),
    'motivoTexto', coalesce(e.recusa_motivo, e.motivo_texto),
    'conferidoEm', e.conferido_em, 'conferidoPor', comercial_pessoa_json(e.conferido_por),
    'automatica', case when e.conferido_auto_em is not null then jsonb_build_object(
       'temAssinatura', coalesce(e.assinaturas, 0) > e.base_assinaturas, 'assinaturas', e.assinaturas, 'eOGerado', e.e_o_gerado,
       'em', e.conferido_auto_em) end,
    'conferencia', case when e.conferido_em is not null then jsonb_strip_nulls(jsonb_build_object(
       'assinaturaValida', e.marca_valida, 'pessoaConfere', e.marca_pessoa, 'dataConfere', e.marca_data,
       'assinanteNome', e.assinante_nome, 'cpfMascarado', e.cpf_mascarado, 'observacao', e.observacao,
       'por', comercial_pessoa_json(e.conferido_por), 'em', e.conferido_em)) end,
    'recusa', case when e.recusado_em is not null then jsonb_build_object('motivo', e.recusa_motivo, 'por', comercial_pessoa_json(e.recusado_por),
                                                                         'em', e.recusado_em) end))
$$;

-- O cartão de cada parte, como o do contrato (contrato_assinatura_json).
create function comercial_aditivo_assinatura_json(a aditivos_comercial, p_parte text) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_strip_nulls(jsonb_build_object('situacao', 'CONFERIDA', 'envioId', e.id, 'enviadoEm', e.enviado_em, 'conferidoEm', e.conferido_em,
                                                 'assinanteNome', e.assinante_nome))
       from envios_aditivo e where e.aditivo_id = a.id and e.parte = p_parte and e.situacao = 'CONFERIDO'),
    (select jsonb_strip_nulls(jsonb_build_object('situacao', case e.situacao when 'A_CONFERIR' then 'A_CONFERIR' when 'RECUSADO' then 'RECUSADA'
                                                                             when 'ENVIANDO' then 'AGUARDANDO' else e.motivo_auto end,
                                                 'envioId', e.id, 'enviadoEm', e.enviado_em, 'motivoTexto', coalesce(e.recusa_motivo, e.motivo_texto)))
       from envios_aditivo e where e.aditivo_id = a.id and e.parte = p_parte and e.situacao <> 'SUBSTITUIDO'
      order by e.enviado_em desc, e.id desc limit 1),
    jsonb_build_object('situacao', case when p_parte = 'TRIADE' then 'ESPERA_CONDOMINIO' else 'AGUARDANDO' end))
$$;

-- 0311, agora com o tipo, as datas, o cartão das assinaturas e os envios; no retorno, os campos
-- e o plano do retrato (enquanto não apagados).
create or replace function comercial_aditivo_json(a aditivos_comercial) returns jsonb
language sql stable
set search_path = public
as $$
  select case when a.id is not null then jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'numero', a.numero, 'tipo', a.tipo, 'situacao', a.situacao, 'hash', a.hash,
    'geradoEm', a.gerado_em, 'prontoEm', a.pronto_em, 'substituidoEm', a.substituido_em,
    'assinaturas', jsonb_build_object('condominio', comercial_aditivo_assinatura_json(a, 'CONDOMINIO'),
                                      'triade', comercial_aditivo_assinatura_json(a, 'TRIADE')),
    'envios', coalesce((select jsonb_agg(envio_aditivo_json(e) order by e.enviado_em, e.id) from envios_aditivo e
                         where e.aditivo_id = a.id and e.situacao <> 'SUBSTITUIDO'), '[]'::jsonb),
    'dados', case when a.tipo = 'RETORNO' and a.dados_apagados_em is null
                  then jsonb_build_object('campos', a.dados -> 'campos', 'retorno', a.dados -> 'retorno') end)) end
$$;

-- O aditivo travado na ordem de gerar de novo: interessado, cancelamento (no retorno), aditivo.
create function comercial_travar_aditivo(p_aditivo uuid) returns aditivos_comercial
language plpgsql
set search_path = public
as $$
declare a aditivos_comercial;
begin
  perform 1 from interessados where id = (select interessado_id from aditivos_comercial where id = p_aditivo) for update;
  perform 1 from cancelamentos_cliente where id = (select cancelamento_id from aditivos_comercial where id = p_aditivo) for update;
  select * into a from aditivos_comercial where id = p_aditivo for update;
  if not found then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  return a;
end $$;

create function comercial_travar_envio_aditivo(p_envio uuid) returns envios_aditivo
language plpgsql
set search_path = public
as $$
declare e envios_aditivo;
begin
  perform comercial_travar_aditivo((select aditivo_id from envios_aditivo where id = p_envio));
  select * into e from envios_aditivo where id = p_envio for update;
  if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  return e;
end $$;

-- A parte que ainda pode enviar: o condomínio primeiro; a TRÍADE depois do condomínio conferido.
create function comercial_aditivo_parte_aberta(a aditivos_comercial, p_parte text) returns text
language sql stable
set search_path = public
as $$
  select case
    when a.situacao = 'GERANDO' then 'ADITIVO_GERANDO'
    when a.situacao = 'SUBSTITUIDO' then 'ADITIVO_SUBSTITUIDO'
    when exists (select 1 from envios_aditivo e where e.aditivo_id = a.id and e.parte = 'TRIADE' and e.situacao = 'CONFERIDO') then 'ADITIVO_ASSINADO'
    when p_parte = 'CONDOMINIO'
         and exists (select 1 from envios_aditivo e where e.aditivo_id = a.id and e.parte = 'CONDOMINIO' and e.situacao = 'CONFERIDO') then 'CONDOMINIO_JA_CONFERIDO'
    when p_parte = 'TRIADE'
         and not exists (select 1 from envios_aditivo e where e.aditivo_id = a.id and e.parte = 'CONDOMINIO' and e.situacao = 'CONFERIDO') then 'ORDEM_DAS_ASSINATURAS'
  end
$$;

create function comercial_iniciar_envio_aditivo(p_pessoa uuid, p_aditivo uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aditivos_comercial;
  e_base envios_aditivo;
  v_parte text := coalesce(comercial_texto(p_dados, 'parte'), 'TRIADE');
  v_nome text := comercial_texto(p_dados, 'nome');
  v_tamanho bigint := comercial_inteiro(p_dados, 'tamanho');
  v_id uuid := gen_random_uuid();
  v_caminho text;
  v_fechada text;
begin
  perform entrar_console(p_pessoa, case when v_parte = 'TRIADE' then 'console.comercial.assinar' else 'console.comercial.editar' end);
  if v_parte not in ('CONDOMINIO', 'TRIADE') then perform recusar_campos('Diga quem assinou', 'parte'); end if;
  a := comercial_travar_aditivo(p_aditivo);
  if (select anonimizado_em from interessados where id = a.interessado_id) is not null or a.dados_apagados_em is not null then
    perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO');
  end if;
  v_fechada := comercial_aditivo_parte_aberta(a, v_parte);
  if v_fechada is not null then
    perform recusar_motivo(case v_fechada
      when 'ADITIVO_GERANDO' then 'O aditivo ainda está sendo montado'
      when 'ADITIVO_SUBSTITUIDO' then 'Este aditivo foi gerado de novo; envie o novo'
      when 'ADITIVO_ASSINADO' then 'O aditivo já foi assinado pelos dois'
      when 'CONDOMINIO_JA_CONFERIDO' then 'A assinatura do condomínio já foi conferida'
      else 'Primeiro o condomínio assina e a equipe confere; depois a TRÍADE assina sobre esse arquivo' end, v_fechada);
  end if;
  if coalesce(length(v_nome), 0) not between 1 and 200 then perform recusar_campos('Diga o nome do arquivo', 'nome'); end if;
  if v_tamanho is null or v_tamanho not between 1 and 10485760 then perform recusar_campos('Só PDF, até 10 MB', 'tamanho'); end if;
  if v_parte = 'TRIADE' then
    select * into e_base from envios_aditivo where aditivo_id = a.id and parte = 'CONDOMINIO' and situacao = 'CONFERIDO';
  end if;
  v_caminho := comercial_caminho(a.interessado_id, v_id);
  insert into envios_aditivo (id, aditivo_id, interessado_id, parte, nome, caminho, enviado_por, base_sha256, base_tamanho, base_assinaturas)
  values (v_id, a.id, a.interessado_id, v_parte, v_nome, v_caminho, p_pessoa, coalesce(e_base.sha256, a.pdf_sha256),
          coalesce(e_base.tamanho, a.pdf_tamanho), coalesce(e_base.assinaturas, 0));
  return jsonb_build_object('envioId', v_id, 'caminho', v_caminho, 'tipo', 'application/pdf');
end $$;

create function comercial_envio_aditivo_base(e envios_aditivo) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('caminho', e.caminho, 'tipo', 'application/pdf', 'baseTamanho', e.base_tamanho, 'baseSha256', e.base_sha256,
    'baseCaminho', case e.parte
      when 'CONDOMINIO' then (select a.caminho from aditivos_comercial a where a.id = e.aditivo_id and a.pdf_sha256 = e.base_sha256
                                                                         and a.dados_apagados_em is null)
      else (select x.caminho from envios_aditivo x where x.aditivo_id = e.aditivo_id and x.parte = 'CONDOMINIO' and x.situacao = 'CONFERIDO'
                                                    and x.sha256 = e.base_sha256 and x.apagado_em is null) end)
$$;

create function comercial_envio_aditivo_a_verificar(p_pessoa uuid, p_envio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_aditivo;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into e from envios_aditivo where id = p_envio;
  if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  if e.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  return comercial_envio_aditivo_base(e);
end $$;

-- A conferência automática (a API lê o arquivo), como comercial_envio_verificado (0308).
create function comercial_verificar_envio_aditivo(p_pessoa uuid, p_envio uuid, p_resultado jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_aditivo;
  a aditivos_comercial;
  v_valido boolean := coalesce((p_resultado ->> 'valido')::boolean, false);
  v_assinaturas bigint := comercial_inteiro(p_resultado, 'assinaturas');
  v_nova boolean := coalesce((p_resultado ->> 'assinaturaNova')::boolean, false);
  v_so boolean := coalesce((p_resultado ->> 'soAssinatura')::boolean, false);
  v_tamanho bigint := comercial_inteiro(p_resultado, 'tamanho');
  v_sha text := p_resultado ->> 'sha256';
  v_prefixo text := p_resultado ->> 'prefixoSha256';
  v_situacao text;
  v_motivo text;
  v_texto text;
  v_gerado boolean;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio_aditivo(p_envio);
  if e.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  select * into a from aditivos_comercial where id = e.aditivo_id;
  -- O aditivo foi gerado de novo ou a parte já foi conferida enquanto o arquivo subia: não conta.
  if comercial_aditivo_parte_aberta(a, e.parte) is not null then
    update envios_aditivo set situacao = 'SUBSTITUIDO', substituido_em = app_now() where id = e.id returning * into e;
    perform enfileirar_arquivo('comercial', e.caminho, 'COMERCIAL_SUBSTITUIDO');
    return envio_aditivo_json(e) || jsonb_build_object('apagarArquivo', false);
  end if;
  if v_valido and (v_sha is null or v_sha !~ '^[0-9a-f]{64}$' or v_tamanho is null or v_tamanho not between 1 and 10485760 or v_assinaturas is null) then
    perform recusar_campos('Conferência incompleta', 'sha256', 'tamanho', 'assinaturas');
  end if;
  v_gerado := coalesce(v_valido and v_tamanho > e.base_tamanho and v_prefixo = e.base_sha256 and v_so, false);
  if not v_valido then
    v_situacao := 'RECUSADO_NA_HORA';
    v_motivo := 'ARQUIVO_INVALIDO';
    v_texto := left(coalesce(nullif(btrim(p_resultado ->> 'motivo'), ''), 'O arquivo não é um PDF que dá para conferir.'), 300);
  elsif not v_nova or v_assinaturas <= e.base_assinaturas then
    v_situacao := 'RECUSADO_NA_HORA';
    v_motivo := 'SEM_ASSINATURA';
    v_texto := 'O PDF enviado não tem assinatura digital nova. Assine pelo gov.br e envie o arquivo que ele devolver.';
  elsif not v_gerado then
    v_situacao := 'NAO_E_O_GERADO';
    v_motivo := 'NAO_E_O_GERADO';
    v_texto := 'O conteúdo assinado não é o aditivo gerado. Baixe o aditivo, assine sem mudar nada e envie de novo.';
  else
    v_situacao := 'A_CONFERIR';
    update envios_aditivo set situacao = 'SUBSTITUIDO', substituido_em = app_now()
     where aditivo_id = a.id and parte = e.parte and situacao in ('A_CONFERIR', 'NAO_E_O_GERADO');
  end if;
  update envios_aditivo set situacao = v_situacao, motivo_auto = v_motivo, motivo_texto = v_texto, sha256 = case when v_valido then v_sha end,
         tamanho = case when v_valido then v_tamanho end, assinaturas = case when v_valido then v_assinaturas end,
         e_o_gerado = case when v_valido then v_gerado end, conferido_auto_em = app_now(),
         apagado_em = case when v_situacao = 'RECUSADO_NA_HORA' then app_now() end
   where id = e.id
  returning * into e;
  perform registrar_historico_interno('comercial.aditivo_envio', 'aditivo_comercial', a.id::text,
    jsonb_strip_nulls(jsonb_build_object('parte', e.parte, 'situacao', e.situacao, 'motivo', v_motivo)));
  return envio_aditivo_json(e) || jsonb_build_object('apagarArquivo', v_situacao = 'RECUSADO_NA_HORA');
end $$;

-- Conferir no validador: as três marcas. No retorno, o CPF do condomínio é o do representante do
-- aditivo; no reajuste (sem representante no retrato), a equipe digita o CPF e o nome.
create function comercial_conferir_envio_aditivo(p_pessoa uuid, p_envio uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_aditivo;
  a aditivos_comercial;
  v_falta text[];
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  v_nome text;
  v_obs text := comercial_texto(p_dados, 'observacao');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio_aditivo(p_envio);
  if e.versao <> p_versao then perform conflito_versao('envios_aditivo', p_envio); end if;
  if e.situacao <> 'A_CONFERIR' then
    perform recusar_motivo('Só o envio que passou na conferência automática é conferido', 'ENVIO_NAO_CONFERIVEL');
  end if;
  select * into a from aditivos_comercial where id = e.aditivo_id;
  v_falta := array_remove(array[case when coalesce((p_dados ->> 'assinaturaValida')::boolean, false) is not true then 'assinaturaValida' end,
                                case when coalesce((p_dados ->> 'pessoaConfere')::boolean, false) is not true then 'pessoaConfere' end,
                                case when coalesce((p_dados ->> 'dataConfere')::boolean, false) is not true then 'dataConfere' end], null);
  if cardinality(v_falta) > 0 then perform recusar_campos('Marque as três conferências do validador', variadic v_falta); end if;
  if v_obs is not null and length(v_obs) not between 2 and 300 then perform recusar_campos('A observação vai até 300 letras', 'observacao'); end if;
  if e.parte = 'CONDOMINIO' and a.tipo = 'RETORNO' then
    if a.dados_apagados_em is not null then perform recusar_motivo('O aditivo foi anonimizado', 'ANONIMIZADO'); end if;
    if v_cpf is not null and v_cpf <> a.dados -> 'representante' ->> 'cpf' then
      perform recusar_motivo('O CPF do validador não é o do representante do aditivo; recuse o envio', 'CPF_NAO_CONFERE_ADITIVO');
    end if;
    v_cpf := a.dados -> 'representante' ->> 'cpf';
    v_nome := a.dados -> 'representante' ->> 'nome';
  else
    if not cpf_valido(v_cpf) then perform recusar_campos('Digite o CPF que o validador mostra', 'cpf'); end if;
    v_nome := coalesce(comercial_texto(p_dados, 'assinanteNome'), case when e.parte = 'TRIADE' then comercial_nome(e.enviado_por) end);
    if coalesce(length(v_nome), 0) not between 2 and 120 then perform recusar_campos('Diga o nome de quem assinou', 'assinanteNome'); end if;
  end if;
  update envios_aditivo set situacao = 'CONFERIDO', marca_valida = true, marca_pessoa = true, marca_data = true, assinante_nome = v_nome,
         cpf_mascarado = comercial_cpf_mascarado(v_cpf), observacao = v_obs, conferido_por = p_pessoa, conferido_em = app_now()
   where id = e.id
  returning * into e;
  perform comercial_inserir_conversa(a.interessado_id, 'NOTA',
    format('Assinatura %s conferida no validador do gov.br (aditivo de %s nº %s).', case e.parte when 'CONDOMINIO' then 'do condomínio' else 'da TRÍADE' end,
           case a.tipo when 'RETORNO' then 'retorno' else 'reajuste' end, a.numero),
    false, null, null);
  perform registrar_historico_interno('comercial.aditivo_assinatura_conferida', 'aditivo_comercial', a.id::text,
    jsonb_build_object('parte', e.parte, 'numero', a.numero, 'tipo', a.tipo));
  return envio_aditivo_json(e) || jsonb_build_object('aditivo', comercial_aditivo_json(a));
end $$;

create function comercial_recusar_envio_aditivo(p_pessoa uuid, p_envio uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_aditivo;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio_aditivo(p_envio);
  if e.versao <> p_versao then perform conflito_versao('envios_aditivo', p_envio); end if;
  if e.situacao not in ('A_CONFERIR', 'NAO_E_O_GERADO') then
    perform recusar_motivo('Só o envio que ainda não conta pode ser recusado', 'ENVIO_NAO_CONFERIVEL');
  end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 300 then perform recusar_campos('Diga o motivo da recusa', 'motivo'); end if;
  update envios_aditivo set situacao = 'RECUSADO', recusa_motivo = btrim(p_motivo), recusado_por = p_pessoa, recusado_em = app_now()
   where id = e.id
  returning * into e;
  perform comercial_inserir_conversa(e.interessado_id, 'NOTA',
    format('Assinatura %s do aditivo recusada na conferência: %s', case e.parte when 'CONDOMINIO' then 'do condomínio' else 'da TRÍADE' end, btrim(p_motivo)),
    false, null, null);
  perform registrar_historico_interno('comercial.aditivo_assinatura_recusada', 'aditivo_comercial', e.aditivo_id::text, jsonb_build_object('parte', e.parte));
  return envio_aditivo_json(e);
end $$;

-- O PDF do aditivo (escolha f): um envio, o gerado ou, sem dizer, o assinado mais recente.
create function comercial_abrir_aditivo_arquivo(p_pessoa uuid, p_aditivo uuid, p_envio uuid, p_gerado boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aditivos_comercial;
  e envios_aditivo;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  select * into a from aditivos_comercial where id = p_aditivo;
  if not found or a.dados_apagados_em is not null then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  if p_envio is not null then
    select * into e from envios_aditivo where id = p_envio and aditivo_id = a.id and apagado_em is null
                                           and situacao not in ('ENVIANDO', 'RECUSADO_NA_HORA');
    if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  elsif not coalesce(p_gerado, false) then
    select * into e from envios_aditivo where aditivo_id = a.id and situacao = 'CONFERIDO' and apagado_em is null
     order by parte = 'TRIADE' desc, conferido_em desc limit 1;
  end if;
  if e.id is not null then
    perform registrar_historico_interno('comercial.aditivo_aberto', 'aditivo_comercial', a.id::text, jsonb_build_object('numero', a.numero, 'parte', e.parte));
    return jsonb_build_object('caminho', e.caminho, 'nome', coalesce(e.nome, format('aditivo-%s-assinado.pdf', a.numero)), 'tipo', 'application/pdf');
  end if;
  if a.pdf_sha256 is null then perform recusar_motivo('O aditivo ainda está sendo montado', 'ADITIVO_GERANDO'); end if;
  perform registrar_historico_interno('comercial.aditivo_aberto', 'aditivo_comercial', a.id::text, jsonb_build_object('numero', a.numero));
  return jsonb_build_object('caminho', a.caminho, 'nome', format('aditivo-%s.pdf', a.numero), 'tipo', 'application/pdf');
end $$;

-- O aditivo que ficou montando (qualquer tipo): o mesmo retrato, montado de novo.
create function comercial_aditivo_a_montar(p_pessoa uuid, p_aditivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a aditivos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into a from aditivos_comercial where id = p_aditivo;
  if not found then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao = 'SUBSTITUIDO' then perform recusar_motivo('Este aditivo foi gerado de novo', 'ADITIVO_SUBSTITUIDO'); end if;
  if a.situacao <> 'GERANDO' then perform recusar_motivo('Este aditivo já foi montado', 'ADITIVO_PRONTO'); end if;
  return jsonb_build_object('aditivoId', a.id, 'caminho', a.caminho, 'hash', a.hash, 'dados', a.dados);
end $$;

-- ---------------------------------------------------------------------------------------
-- 13. Gerar o aditivo de retorno (C3, quadro 488): o plano da Tabela de preços do dia, cheia, pela
-- faixa das unidades ativas; acima de 400, o valor combinado.

create function comercial_gerar_aditivo_retorno(p_pessoa uuid, p_cancelamento uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  i interessados;
  c contratos_comercial;
  m modelos_aditivo;
  a_ant aditivos_comercial;
  f faixas_preco;
  pp parametros_preco;
  v_rep text := comercial_texto(p_dados, 'representante');
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  v_comp date := comercial_data(p_dados, 'competencia');
  v_ciclo text := comercial_texto(p_dados, 'ciclo');
  v_informado bigint := comercial_inteiro(p_dados, 'valorCentavos');
  v_motivo text := comercial_texto(p_dados, 'motivo');
  v_hoje date := comercial_hoje();
  v_unidades integer;
  v_mensal bigint;
  v_valor bigint;
  v_tabela text;
  v_nome text;
  v_id uuid := gen_random_uuid();
  v_numero integer;
  v_campos jsonb;
  v_texto text;
  v_dados jsonb;
  v_caminho text;
  v_cnpj text;
  x text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  k := comercial_travar_confirmado(p_cancelamento, null);
  if k.ultimo_dia >= v_hoje then
    perform recusar_motivo('Antes do último dia, desfaça o cancelamento; o aditivo de retorno é para depois dele', 'ANTES_DO_ULTIMO_DIA');
  end if;
  i := comercial_buscar_cliente(k.interessado_id);
  select * into m from modelos_aditivo where situacao = 'EM_USO' and tipo = 'RETORNO';
  if m.id is null then perform recusar_motivo('Ponha em uso um modelo de aditivo de retorno (Modelos › Aditivo)', 'SEM_MODELO_RETORNO'); end if;
  select * into c from contratos_comercial where interessado_id = i.id and situacao = 'ASSINADO' order by gerado_em desc limit 1;
  if c.id is null or c.dados ->> 'dataInicio' is null then
    perform recusar_motivo('O cliente não tem contrato assinado com data de início', 'SEM_CONTRATO_ASSINADO');
  end if;
  select * into a_ant from aditivos_comercial where cancelamento_id = k.id and situacao <> 'SUBSTITUIDO' for update;
  if coalesce(length(v_rep), 0) not between 2 and 120 then perform recusar_campos('Diga o nome de quem assina pelo condomínio', 'representante'); end if;
  if not cpf_valido(v_cpf) then perform recusar_campos('Digite o CPF de quem assina pelo condomínio', 'cpf'); end if;
  if v_comp is null or extract(day from v_comp) <> 1 or v_comp < date_trunc('month', v_hoje)::date
     or v_comp > (date_trunc('month', v_hoje) + interval '6 months')::date then
    perform recusar_campos('A competência vai do mês de hoje a seis meses depois', 'competencia');
  end if;
  if v_ciclo is null or v_ciclo not in ('MENSAL', 'ANUAL') then perform recusar_campos('Escolha o ciclo', 'ciclo'); end if;
  if a_ant.id is not null and coalesce(length(v_motivo), 0) not between 3 and 300 then
    perform recusar_campos('Diga por que gerar de novo (as assinaturas começam do zero)', 'motivo');
  end if;
  -- O plano: a faixa das unidades ativas de hoje, na tabela cheia (sem fundador e sem desconto).
  v_unidades := (comercial_leitura_cliente(i.condominio_id) ->> 'unidadesAtivas')::integer;
  if coalesce(v_unidades, 0) < 1 then perform recusar_motivo('O condomínio não tem unidades ativas para achar a faixa', 'SEM_UNIDADES_ATIVAS'); end if;
  select * into f from faixas_preco
   where v_unidades >= unidades_de and (unidades_ate is null or v_unidades <= unidades_ate) order by ordem limit 1;
  select * into pp from parametros_preco;
  if f.id is null then perform recusar_motivo('A tabela de preços ainda não tem a faixa deste condomínio', 'PRECO_A_DEFINIR'); end if;
  if f.sob_consulta then
    if v_informado is null or v_informado < 1 then
      perform recusar_campos('Acima de 400 unidades, diga o valor mensal combinado com a Administração', 'valorCentavos');
    end if;
    v_mensal := v_informado;
    v_tabela := 'SOB_CONSULTA';
  else
    if v_informado is not null then perform recusar_campos('O valor vem da tabela de preços; só a faixa sob consulta recebe valor', 'valorCentavos'); end if;
    v_mensal := f.cheia_centavos;
    if v_mensal is null then perform recusar_motivo('A tabela de preços ainda não tem o valor cheio desta faixa', 'PRECO_A_DEFINIR'); end if;
    v_tabela := 'CHEIA';
  end if;
  v_valor := case when v_ciclo = 'ANUAL' then v_mensal * coalesce(pp.meses_pagos_anual, 12) else v_mensal end;
  v_nome := left(case v_tabela when 'CHEIA' then 'Tabela cheia, ' else 'Sob consulta, ' end || lower(f.nome), 60);
  -- Gerar de novo: o anterior fica substituído e as assinaturas começam do zero.
  if a_ant.id is not null then
    update envios_aditivo set situacao = 'SUBSTITUIDO', substituido_em = app_now()
     where aditivo_id = a_ant.id and situacao in ('ENVIANDO', 'A_CONFERIR', 'CONFERIDO', 'NAO_E_O_GERADO');
    update aditivos_comercial set situacao = 'SUBSTITUIDO', substituido_em = app_now(), substituido_por = p_pessoa, substituido_motivo = v_motivo
     where id = a_ant.id;
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from aditivos_comercial where interessado_id = i.id;
  v_cnpj := coalesce(c.dados -> 'campos' ->> 'cnpj', case when i.cnpj ~ '^[0-9]{14}$' then comercial_cnpj_formatado(i.cnpj) end, 'não informado');
  v_campos := jsonb_build_object(
    'condominio', coalesce(c.dados -> 'campos' ->> 'condominio', i.condominio),
    'cnpj', v_cnpj,
    'representante', v_rep,
    'cpf_representante', comercial_cpf_formatado(v_cpf),
    'contrato', 'nº ' || c.numero,
    'data_contrato', comercial_data_br((c.dados ->> 'dataInicio')::date),
    'ultimo_dia', comercial_data_br(k.ultimo_dia),
    'plano', v_nome || case v_ciclo when 'ANUAL' then ' (ciclo anual)' else ' (ciclo mensal)' end,
    'valor_mensal', comercial_reais(v_mensal) || ' por mês'
                    || case when v_ciclo = 'ANUAL' then format(' (%s por ano, %s meses pagos)', comercial_reais(v_valor), coalesce(pp.meses_pagos_anual, 12)) else '' end,
    'vale_desde', 'competência de ' || to_char(v_comp, 'MM/YYYY'));
  v_texto := m.texto;
  for x in select jsonb_object_keys(v_campos) loop
    v_texto := replace(v_texto, '«' || x || '»', v_campos ->> x);
  end loop;
  v_dados := jsonb_build_object(
    'numero', v_numero, 'tipo', 'RETORNO', 'titulo', m.titulo, 'texto', v_texto, 'campos', v_campos,
    'modelo', jsonb_build_object('numero', m.numero, 'tipo', m.tipo),
    'contrato', jsonb_build_object('numero', c.numero, 'hash', c.hash),
    'representante', jsonb_build_object('nome', v_rep, 'cpf', v_cpf),
    'retorno', jsonb_build_object('competencia', v_comp, 'ciclo', v_ciclo, 'valor', v_valor, 'valorMensal', v_mensal, 'tabela', v_tabela,
                                  'faixa', f.codigo, 'nome', v_nome, 'unidadesDe', f.unidades_de, 'unidadesAte', f.unidades_ate, 'unidades', v_unidades),
    'geradoEm', to_char(app_now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'));
  v_caminho := comercial_caminho(i.id, v_id);
  insert into aditivos_comercial (id, tipo, cancelamento_id, interessado_id, numero, modelo_id, dados, hash, caminho, gerado_por)
  values (v_id, 'RETORNO', k.id, i.id, v_numero, m.id, v_dados, comercial_hash(v_dados), v_caminho, p_pessoa);
  perform comercial_inserir_conversa(i.id, 'NOTA',
    format('Aditivo de retorno nº %s gerado do modelo v%s: %s, %s a partir da competência %s%s.', v_numero, m.numero, v_nome,
           comercial_reais(v_valor) || case v_ciclo when 'ANUAL' then ' por ano' else ' por mês' end, to_char(v_comp, 'MM/YYYY'),
           case when a_ant.id is not null then format(' (substitui o nº %s; assinaturas zeradas)', a_ant.numero) else '' end),
    false, null, null);
  perform registrar_historico_interno('comercial.aditivo_retorno', 'aditivo_comercial', v_id::text,
    jsonb_strip_nulls(jsonb_build_object('numero', v_numero, 'modelo', m.numero, 'substitui', a_ant.numero, 'tabela', v_tabela)));
  return jsonb_build_object('aditivoId', v_id, 'caminho', v_caminho, 'hash', comercial_hash(v_dados), 'dados', v_dados);
end $$;

-- ---------------------------------------------------------------------------------------
-- 14. Reativar depois do último dia (C5, quadro 488).

create function comercial_reativar_cliente(p_pessoa uuid, p_cancelamento uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  i interessados;
  a aditivos_comercial;
  pl planos_cliente;
  r reajustes_plano;
  v_ret jsonb;
  v_comp date;
  v_motivo text;
  v_ganhas integer;
  v_sistema text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  k := comercial_travar_confirmado(p_cancelamento, p_versao);
  if k.ultimo_dia >= comercial_hoje() then
    perform recusar_motivo('Antes do último dia, desfaça o cancelamento; reativar é para depois dele', 'ANTES_DO_ULTIMO_DIA');
  end if;
  i := comercial_buscar_cliente(k.interessado_id);
  select * into a from aditivos_comercial where cancelamento_id = k.id and situacao <> 'SUBSTITUIDO' for update;
  if a.id is null or a.situacao <> 'PRONTO' or a.dados_apagados_em is not null
     or (select count(*) from envios_aditivo e where e.aditivo_id = a.id and e.situacao = 'CONFERIDO') < 2 then
    perform recusar_motivo('Reativar só com o aditivo de retorno assinado pelas duas partes e conferido', 'ADITIVO_SEM_ASSINATURAS');
  end if;
  v_ret := a.dados -> 'retorno';
  v_comp := (v_ret ->> 'competencia')::date;
  v_motivo := 'Reativado pelo aditivo nº ' || a.numero;
  -- No condomínio: o último dia revogado (fica no histórico) e o plano do aditivo.
  perform entrar_como_sistema(k.condominio_id);
  update encerramentos_contrato set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = v_motivo
   where cancelamento_id = k.id and revogado_em is null;
  perform registrar_historico('contrato.reativado', 'encerramentos_contrato', k.condominio_id::text,
    jsonb_build_object('ultimoDia', k.ultimo_dia, 'valeDesde', v_comp));
  select * into pl from planos_cliente where condominio_id = k.condominio_id;
  perform comercial_entrar_cliente(p_pessoa, k.condominio_id, 'console.contrato.editar');
  -- O plano pelo guardião de sempre (versão, histórico e vaga de fundador liberada pelo gatilho).
  perform console_salvar_plano_tabela(p_pessoa, k.condominio_id, pl.versao, v_ret ->> 'nome', (v_ret ->> 'unidadesDe')::integer,
    (v_ret ->> 'unidadesAte')::integer, (v_ret ->> 'valor')::bigint, v_ret ->> 'ciclo', coalesce(pl.dia_vencimento, 10),
    pl.implantacao_centavos, coalesce(pl.implantacao_sem_cobranca, true), pl.implantacao_referencia, v_comp,
    case when v_ret ->> 'tabela' = 'CHEIA' then 'CHEIA' else 'MANUAL' end);
  select * into pl from planos_cliente where condominio_id = k.condominio_id;
  -- O reajuste avisado antes do cancelamento que ainda não entrou fica superado (escolha g).
  v_sistema := coalesce(current_setting('app.comercial_sistema', true), '');
  for r in select * from reajustes_plano where condominio_id = k.condominio_id and aplicado_em is null loop
    update reajustes_plano set aplicado_em = app_now(), superado = true where id = r.id;
    perform set_config('app.comercial_sistema', 'on', true);
    update renovacoes_cliente set situacao = 'SUPERADO' where id = r.renovacao_id and situacao = 'AVISO_ENVIADO';
    perform set_config('app.comercial_sistema', v_sistema, true);
    perform registrar_historico_interno('plano.reajuste_superado', 'plano', pl.id::text,
      jsonb_build_object('valorAvisado', r.valor_centavos, 'valorDoAviso', r.valor_de, 'valorHoje', pl.valor_centavos, 'desde', r.vale_desde));
  end loop;
  perform registrar_historico_interno('plano.reativado', 'plano', pl.id::text,
    jsonb_build_object('aditivo', a.numero, 'valeDesde', v_comp, 'tabela', v_ret ->> 'tabela'));
  perform definir_pessoa(p_pessoa);
  update cancelamentos_cliente set situacao = 'REATIVADO', reativado_em = app_now(), reativado_por = p_pessoa, reativado_aditivo_id = a.id,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = k.id
  returning * into k;
  -- A reconquista aberta fica ganha.
  update expansoes_cliente set etapa = 'GANHA', resultado = v_motivo, encerrada_em = app_now(), encerrada_por = p_pessoa,
         alterado_em = app_now(), alterado_por = p_pessoa
   where interessado_id = i.id and tipo = 'RECONQUISTA' and etapa not in ('GANHA', 'PERDIDA');
  get diagnostics v_ganhas = row_count;
  perform comercial_inserir_conversa(i.id, 'NOTA',
    format('Cliente reativado pelo aditivo de retorno nº %s; o plano volta na competência %s.', a.numero, to_char(v_comp, 'MM/YYYY')),
    false, null, null);
  perform registrar_historico_interno('comercial.cliente_reativado', 'cancelamento_cliente', k.id::text,
    jsonb_build_object('aditivo', a.numero, 'valeDesde', v_comp, 'reconquista', v_ganhas));
  return jsonb_build_object('cancelamento', comercial_cancelamento_json(k, i.condominio, comercial_leitura_cliente(i.condominio_id) -> 'plano'));
end $$;

-- O aniversário conta da última reativação, quando houver (C5).
create or replace function comercial_proximo_aniversario(p_interessado uuid, p_inicio date, p_hoje date, p_atraso integer) returns date
language sql stable
set search_path = public
as $$
  select min(s.a)
    from (select coalesce((select max((k.reativado_em at time zone 'America/Sao_Paulo')::date) from cancelamentos_cliente k
                            where k.interessado_id = p_interessado and k.situacao = 'REATIVADO'), p_inicio) as base) b,
         lateral (select (b.base + make_interval(years => n))::date as a from generate_series(1, 60) n) s
   where p_inicio is not null and s.a >= p_hoje - p_atraso
     and not exists (select 1 from renovacoes_cliente rc where rc.interessado_id = p_interessado and rc.aniversario = s.a)
$$;

-- ---------------------------------------------------------------------------------------
-- 15. A leitura (C6).

-- A prévia do plano da volta (quadro 488): a faixa pelas unidades ativas de hoje e o valor da tabela
-- cheia; acima de 400, sob consulta (o valor vai no Gerar). O gerar confere tudo de novo.
create function comercial_retorno_previa(p_interessado uuid) returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_unidades integer;
  f faixas_preco;
begin
  v_unidades := (comercial_leitura_cliente((select condominio_id from interessados where id = p_interessado)) ->> 'unidadesAtivas')::integer;
  if coalesce(v_unidades, 0) < 1 then return jsonb_build_object('unidades', coalesce(v_unidades, 0)); end if;
  select * into f from faixas_preco
   where v_unidades >= unidades_de and (unidades_ate is null or v_unidades <= unidades_ate) order by ordem limit 1;
  return jsonb_strip_nulls(jsonb_build_object('unidades', v_unidades, 'faixa', f.codigo,
    'valor', case when not coalesce(f.sob_consulta, false) then f.cheia_centavos end, 'sobConsulta', coalesce(f.sob_consulta, false)));
end $$;

create or replace function comercial_cancelamento_json(k cancelamentos_cliente, p_condominio text, p_plano jsonb) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', k.id, 'versao', k.versao, 'interessadoId', k.interessado_id, 'condominio', p_condominio,
    'plano', case when p_plano is not null and jsonb_typeof(p_plano) = 'object'
                  then jsonb_build_object('valor', p_plano -> 'valor', 'ciclo', p_plano -> 'ciclo', 'inicio', p_plano -> 'inicio', 'tabela', p_plano -> 'tabela') end,
    'pedidoPor', k.pedido_por, 'pedidoEm', k.pedido_em, 'avisoDias', k.aviso_dias, 'ultimoDia', k.ultimo_dia,
    'motivo', k.motivo, 'motivoTexto', k.motivo_texto,
    'retencao', k.retencao, 'retencaoEm', k.retencao_em, 'retencaoPor', comercial_pessoa_json(k.retencao_por),
    'situacao', case when k.situacao = 'CONFIRMADO' and k.ultimo_dia < comercial_hoje() then 'ENCERRADO' else k.situacao end,
    'decididoEm', k.decidido_em, 'decididoPor', comercial_pessoa_json(k.decidido_por), 'decisaoNota', k.decisao_nota,
    'lembrarEm', k.lembrar_em, 'exportacaoPedida', k.exportacao_id is not null,
    'desfeitoEm', k.desfeito_em, 'desfeitoPor', comercial_pessoa_json(k.desfeito_por), 'desfeitoNota', k.desfeito_nota,
    'reativadoEm', k.reativado_em, 'reativadoPor', comercial_pessoa_json(k.reativado_por),
    'retorno', (select comercial_aditivo_json(a) from aditivos_comercial a where a.cancelamento_id = k.id and a.situacao <> 'SUBSTITUIDO'),
    'retornoPlano', case when k.situacao = 'CONFIRMADO' and k.ultimo_dia < comercial_hoje() then comercial_retorno_previa(k.interessado_id) end,
    -- A linha "Comissão" do quadro 487: só quando o cliente veio de parceiro.
    'comissao', (select jsonb_strip_nulls(jsonb_build_object('parceiro', p.nome, 'semComissaoDesde', cp.sem_comissao_desde))
                   from comissoes_parceiro cp join parceiros_comercial p on p.id = cp.parceiro_id
                  where cp.interessado_id = k.interessado_id order by cp.inicio desc, cp.id limit 1)))
$$;

-- O que a equipe pode na aba (o mesmo objeto da lista e do cancelamento aberto sozinho).
create function comercial_renovacoes_pode() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('editar', pode_global('console.comercial.editar'), 'regra', pode_global('console.comercial.modelos'),
                            'confirmar', pode_global('console.comercial.cliente'), 'desfazer', pode_global('console.comercial.cliente'),
                            'reativar', pode_global('console.comercial.cliente'), 'assinar', pode_global('console.comercial.assinar'))
$$;

-- Um cancelamento sozinho (a página Reativar abre um antigo, que já saiu da lista).
create function comercial_cancelamento(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  select * into k from cancelamentos_cliente where id = p_id;
  if not found then raise exception 'Cancelamento não encontrado' using errcode = 'TC404'; end if;
  select * into i from interessados where id = k.interessado_id;
  if i.anonimizado_em is not null then raise exception 'Cancelamento não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'cancelamento', comercial_cancelamento_json(k, i.condominio, comercial_leitura_cliente(i.condominio_id) -> 'plano'),
    'pode', comercial_renovacoes_pode());
end $$;

-- O aviso de reajuste usa só o modelo de reajuste em uso.
create or replace function comercial_registrar_aviso(p_pessoa uuid, p_interessado uuid, p_aniversario date, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  c contratos_comercial;
  r regra_reajuste;
  m modelos_aditivo;
  rc renovacoes_cliente;
  f faixas_preco;
  v_hoje date := comercial_hoje();
  v_plano jsonb;
  v_tipo text;
  v_novo bigint;
  v_aviso date := coalesce(comercial_data(p_dados, 'avisoEm'), case when coalesce(p_dados ->> 'avisoEm', '') = '' then comercial_hoje() end);
  v_canal text := comercial_texto(p_dados, 'canal');
  v_para text := comercial_texto(p_dados, 'para');
  v_texto text := comercial_texto(p_dados, 'texto');
  v_sistema text;
  v_vale date;
  v_aditivo jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar_cliente(p_interessado, true);
  perform comercial_exigir_sem_cancelamento(i.id);
  c := comercial_contrato_da_renovacao(i, p_aniversario);
  select * into r from regra_reajuste;
  v_plano := comercial_leitura_cliente(i.condominio_id) -> 'plano';
  if v_plano is null or jsonb_typeof(v_plano) <> 'object' then perform recusar_motivo('O cliente ainda não tem plano', 'SEM_PLANO'); end if;
  v_tipo := comercial_tipo_renovacao(v_plano);
  v_novo := comercial_valor_renovacao(v_plano, r);
  if v_novo is null then
    perform recusar_motivo('O valor com reajuste ainda não está definido', 'REAJUSTE_A_DEFINIR');
  end if;
  if coalesce(p_dados ->> 'valorNovo', '') <> '' and (p_dados ->> 'valorNovo') is distinct from v_novo::text then
    raise exception 'O valor com reajuste mudou desde que a tela abriu' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'REGRA_MUDOU', 'valorNovo', v_novo)::text;
  end if;
  if v_aviso is null or v_aviso > v_hoje or v_aviso < v_hoje - 30 then perform recusar_campos('O aviso foi enviado hoje ou nos últimos 30 dias', 'avisoEm'); end if;
  if v_canal is null or v_canal not in ('WHATSAPP', 'EMAIL', 'CARTA', 'PRESENCIAL', 'OUTRO') then perform recusar_campos('Diga por onde o aviso foi', 'canal'); end if;
  if coalesce(length(v_para), 0) not between 2 and 120 then perform recusar_campos('Diga quem recebeu o aviso', 'para'); end if;
  if coalesce(length(v_texto), 0) not between 10 and 2000 then perform recusar_campos('Cole o texto do aviso (de 10 a 2.000 letras)', 'texto'); end if;
  v_vale := comercial_competencia_desde(greatest(p_aniversario, v_aviso + r.prazo_aviso_dias), (v_plano ->> 'diaVencimento')::integer);
  insert into renovacoes_cliente (interessado_id, condominio_id, aniversario, tipo, situacao, valor_atual, valor_novo, ciclo, indice, percentual,
                                  referencia, avisar_ate, aviso_em, aviso_canal, aviso_para, aviso_texto, vale_desde, registrado_por)
  values (i.id, i.condominio_id, p_aniversario, v_tipo, 'AVISO_ENVIADO', (v_plano ->> 'valor')::bigint, v_novo, v_plano ->> 'ciclo',
          case when v_tipo = 'REAJUSTE' then r.indice end, case when v_tipo = 'REAJUSTE' then r.percentual end,
          case when v_tipo = 'REAJUSTE' then r.referencia end, p_aniversario - r.prazo_aviso_dias, v_aviso, v_canal, v_para, v_texto, v_vale, p_pessoa)
  returning * into rc;
  -- O plano muda quando a competência abrir (decisão d); no fundador, para a tabela cheia da faixa.
  if v_tipo = 'FIM_FUNDADOR' then
    select * into f from faixas_preco where not sob_consulta and (v_plano ->> 'unidadesAte')::integer between unidades_de and unidades_ate;
  end if;
  v_sistema := coalesce(current_setting('app.comercial_sistema', true), '');
  perform set_config('app.comercial_sistema', 'on', true);
  perform entrar_como_sistema(i.condominio_id);
  insert into reajustes_plano (condominio_id, renovacao_id, tipo, vale_desde, valor_centavos, tabela, nome, valor_de, ciclo_de)
  values (i.condominio_id, rc.id, v_tipo, v_vale, v_novo, case when v_tipo = 'FIM_FUNDADOR' then 'CHEIA' end,
          case when v_tipo = 'FIM_FUNDADOR' then left('Tabela cheia, ' || lower(f.nome), 60) end, rc.valor_atual, rc.ciclo);
  perform definir_pessoa(p_pessoa);
  perform set_config('app.comercial_sistema', v_sistema, true);
  -- O aditivo, quando há modelo de reajuste em uso (decisão 5).
  select * into m from modelos_aditivo where situacao = 'EM_USO' and tipo = 'REAJUSTE';
  if m.id is not null then v_aditivo := comercial_criar_aditivo(rc, m, c, i); end if;
  perform comercial_inserir_conversa(i.id, 'NOTA',
    format('Aviso de reajuste registrado (aniversário %s): %s para %s a partir da competência %s.', comercial_data_br(p_aniversario),
           comercial_reais(rc.valor_atual), comercial_reais(v_novo), to_char(v_vale, 'MM/YYYY')), false, null, null);
  perform registrar_historico_interno('comercial.aviso_reajuste', 'renovacao_cliente', rc.id::text,
    jsonb_build_object('aniversario', p_aniversario, 'tipo', v_tipo, 'valor', rc.valor_atual, 'valorNovo', v_novo, 'valeDesde', v_vale,
                       'aditivo', v_aditivo is not null));
  return jsonb_build_object('renovacao', comercial_renovacao_json(rc, i.condominio, c.numero), 'aditivo', v_aditivo);
end $$;

-- 0311, agora com o desfeito e o reativado recentes na lista, o modelo de cada parte e o que pode.
create or replace function comercial_renovacoes(p_pessoa uuid, p_mes date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := comercial_hoje();
  v_mes date := date_trunc('month', coalesce(p_mes, comercial_hoje()))::date;
  v_ate date;
  v_atraso integer := configuracao_int('comercial_renovacao_atraso_dias');
  v_antes integer := configuracao_int('comercial_renovacao_antecedencia_dias');
  v_inicio integer := configuracao_int('comercial_renovacao_inicio_dias');
  r regra_reajuste;
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  v_ate := v_mes + configuracao_int('comercial_renovacao_horizonte_dias');
  select * into r from regra_reajuste;
  with cl as materialized (select * from comercial_clientes_lidos()),
  pend as materialized (
    select cl.*, comercial_proximo_aniversario(cl.cli_id, cl.inicio, v_hoje, v_atraso) as aniversario
      from cl where cl.inicio is not null and cl.canc_situacao is distinct from 'CONFIRMADO'
       and not exists (select 1 from renovacoes_cliente rc where rc.interessado_id = cl.cli_id and rc.situacao = 'AVISO_ENVIADO')
  ),
  ren as (
    select jsonb_strip_nulls(jsonb_build_object(
             'interessadoId', p.cli_id, 'condominio', p.nome, 'contrato', p.contrato, 'aniversario', p.aniversario,
             'avisarAte', p.aniversario - r.prazo_aviso_dias, 'avisarDesde', p.aniversario - r.prazo_aviso_dias - v_antes,
             'tipo', comercial_tipo_renovacao(p.plano),
             'situacao', case when p.aniversario - r.prazo_aviso_dias < v_hoje then 'ATRASADO' else 'AVISAR' end,
             'hoje', case when p.plano is not null and jsonb_typeof(p.plano) = 'object'
                          then jsonb_build_object('valor', p.plano -> 'valor', 'ciclo', p.plano -> 'ciclo', 'tabela', p.plano -> 'tabela') end,
             'novo', case when comercial_valor_renovacao(p.plano, r) is not null then jsonb_strip_nulls(jsonb_build_object(
                            'valor', comercial_valor_renovacao(p.plano, r),
                            'indice', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.indice end,
                            'percentual', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.percentual end,
                            'referencia', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.referencia end,
                            'tabela', case when comercial_tipo_renovacao(p.plano) = 'FIM_FUNDADOR' then 'CHEIA' end)) end,
             'semPlano', p.plano is null or jsonb_typeof(p.plano) <> 'object')) as j,
           case when p.aniversario - r.prazo_aviso_dias < v_hoje then 1 else 2 end as ordem, p.aniversario as quando, p.nome as cond
      from pend p
     where p.aniversario is not null
       and (p.aniversario - r.prazo_aviso_dias <= v_hoje + v_inicio or p.aniversario between v_mes and v_ate)
    union all
    select comercial_renovacao_json(rc, cl.nome, cl.contrato), case rc.situacao when 'AVISO_ENVIADO' then 3 else 4 end, rc.aniversario, cl.nome
      from renovacoes_cliente rc join cl on cl.cli_id = rc.interessado_id
     where rc.situacao = 'AVISO_ENVIADO' or rc.aniversario between v_mes and v_ate
  ),
  ris as (
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome,
             'plano', case when jsonb_typeof(cl.plano) = 'object' then cl.plano ->> 'nome' end,
             'sinais', jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s.id, 'versao', s.versao, 'tipo', s.tipo, 'origem', s.origem,
                                                                      'data', s.data_ref, 'detalhe', s.detalhe, 'criadoEm', s.criado_em))
                                 order by s.data_ref, s.tipo)) as j,
           min(s.data_ref) as quando, cl.nome as cond
      from riscos_cliente s join cl on cl.cli_id = s.interessado_id
     where s.tratado_em is null and cl.canc_situacao is distinct from 'CONFIRMADO'
     group by cl.cli_id, cl.nome, cl.plano
  ),
  expa as (
    select comercial_expansao_json(e, i) as j, e.etapa in ('GANHA', 'PERDIDA') as fechada, coalesce(e.encerrada_em, e.criado_em) as quando
      from expansoes_cliente e join interessados i on i.id = e.interessado_id
     where e.etapa not in ('GANHA', 'PERDIDA') or e.encerrada_em > app_now() - interval '180 days'
  ),
  sug as (
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome, 'tipo', 'MUDAR_FAIXA',
                              'motivo', 'Passou de ' || (cl.plano ->> 'unidadesAte') || ' unidades ativas') as j, cl.nome as cond
      from cl
     where cl.canc_situacao is distinct from 'CONFIRMADO' and jsonb_typeof(cl.plano) = 'object'
       and (cl.plano ->> 'unidadesAte')::integer < cl.unidades
       and not exists (select 1 from expansoes_cliente e where e.interessado_id = cl.cli_id and e.tipo = 'MUDAR_FAIXA'
                          and (e.etapa not in ('GANHA', 'PERDIDA') or e.encerrada_em > app_now() - interval '90 days'))
    union all
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome, 'tipo', 'RECONQUISTA',
                              'motivo', 'Saiu em ' || to_char(cl.ultimo_dia, 'MM/YYYY')
                                        || coalesce('; síndico novo em ' || to_char(sn.data_ref, 'MM/YYYY'), '; lembrar em ' || to_char(k.lembrar_em, 'DD/MM/YYYY'))),
           cl.nome
      from cl join cancelamentos_cliente k on k.id = cl.canc_id
      left join lateral (select s.data_ref, s.criado_em from riscos_cliente s
                          where s.interessado_id = cl.cli_id and s.tipo = 'SINDICO_NOVO' and s.tratado_em is null and s.criado_em > k.decidido_em
                          order by s.data_ref desc limit 1) sn on true
     where cl.canc_situacao = 'CONFIRMADO' and cl.ultimo_dia < v_hoje
       and (sn.data_ref is not null or k.lembrar_em <= v_hoje + 30)
       and not exists (select 1 from expansoes_cliente e where e.interessado_id = cl.cli_id and e.tipo = 'RECONQUISTA'
                          and (e.etapa not in ('GANHA', 'PERDIDA')
                               or e.encerrada_em >= coalesce(sn.criado_em, (k.lembrar_em - 30)::timestamp at time zone 'America/Sao_Paulo')))
  ),
  can as (
    select comercial_cancelamento_json(k, cl.nome, cl.plano) as j, k.situacao in ('PEDIDO', 'EM_RETENCAO') as aberto, k.pedido_em as quando
      from cancelamentos_cliente k join cl on cl.cli_id = k.interessado_id
     where k.situacao in ('PEDIDO', 'EM_RETENCAO')
        or (k.situacao = 'CONFIRMADO' and k.ultimo_dia > v_hoje - 365)
        or (k.situacao = 'FICOU' and k.decidido_em > app_now() - interval '90 days')
        or (k.situacao in ('DESFEITO', 'REATIVADO') and coalesce(k.reativado_em, k.desfeito_em) > app_now() - interval '90 days')
  )
  select jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'), 'hoje', v_hoje,
    'regra', comercial_regra_reajuste_json(r),
    'modeloAditivo', (select jsonb_build_object('id', m.id, 'numero', m.numero, 'titulo', m.titulo) from modelos_aditivo m
                       where m.situacao = 'EM_USO' and m.tipo = 'REAJUSTE'),
    'modeloRetorno', (select jsonb_build_object('id', m.id, 'numero', m.numero, 'titulo', m.titulo) from modelos_aditivo m
                       where m.situacao = 'EM_USO' and m.tipo = 'RETORNO'),
    'renovacoes', coalesce((select jsonb_agg(j order by ordem, quando, cond) from ren), '[]'::jsonb),
    'riscos', coalesce((select jsonb_agg(j order by quando, cond) from ris), '[]'::jsonb),
    'expansoes', coalesce((select jsonb_agg(j order by fechada, quando desc) from expa), '[]'::jsonb),
    'sugestoes', coalesce((select jsonb_agg(j order by cond) from sug), '[]'::jsonb),
    'cancelamentos', coalesce((select jsonb_agg(j order by aberto desc, quando desc) from can), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'id', cl.cli_id, 'condominio', cl.nome, 'contato', cl.contato,
                   'plano', case when jsonb_typeof(cl.plano) = 'object' then cl.plano end,
                   'situacao', case when cl.canc_situacao = 'CONFIRMADO' and cl.ultimo_dia < v_hoje then 'ENCERRADO'
                                    when cl.canc_situacao is not null then 'CANCELANDO' else 'ATIVO' end)) order by cl.nome) from cl), '[]'::jsonb),
    'equipe', comercial_equipe_json(),
    'contagens', jsonb_build_object(
      'renovacoes', (select count(*)::integer from ren),
      'riscos', (select count(*)::integer from ris),
      'expansoes', (select count(*)::integer from expa where not fechada) + (select count(*)::integer from sug),
      'cancelamentos', (select count(*)::integer from can where aberto)),
    'avisoCancelamentoDias', configuracao_int('comercial_cancelamento_aviso_dias'),
    'pode', comercial_renovacoes_pode())
  into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 16. LGPD (C7): a nota de desfazer, o motivo da revogação, o representante do aditivo de retorno
-- que não reativou e os PDFs dos envios do aditivo.

-- O retrato do aditivo de retorno sai (fica o número e o tipo) e o PDF vai para a fila de apagar,
-- com os envios. O aditivo que reativou fica, como o contrato assinado (CONTRATO_ASSINADO).
create function comercial_apagar_aditivos_retorno(p_interessado uuid, p_todos boolean) returns integer
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select a.id, a.caminho, a.pdf_sha256 from aditivos_comercial a join cancelamentos_cliente k on k.id = a.cancelamento_id
     where a.tipo = 'RETORNO' and a.dados_apagados_em is null and (p_interessado is null or a.interessado_id = p_interessado)
       and k.reativado_aditivo_id is distinct from a.id and (p_todos or k.textos_apagados_em is not null)
  loop
    update aditivos_comercial set dados = jsonb_build_object('apagado', true, 'numero', numero, 'tipo', tipo), dados_apagados_em = app_now(),
           substituido_motivo = case when substituido_motivo is not null then 'Dado apagado (LGPD)' end
     where id = r.id;
    if r.pdf_sha256 is not null then perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO'); end if;
    v_n := v_n + 1;
  end loop;
  -- Os envios desses aditivos (e, com p_todos, os que não são a prova de um aditivo que fica).
  for r in
    select e.id, e.caminho, e.apagado_em from envios_aditivo e join aditivos_comercial a on a.id = e.aditivo_id
     where (p_interessado is null or e.interessado_id = p_interessado)
       and (a.dados_apagados_em is not null or (p_todos and e.situacao <> 'CONFERIDO'))
       and (e.apagado_em is null or num_nonnulls(e.nome, e.assinante_nome, e.cpf_mascarado, e.observacao, e.recusa_motivo) > 0)
  loop
    update envios_aditivo set apagado_em = coalesce(apagado_em, app_now()), nome = null, assinante_nome = null, cpf_mascarado = null,
           observacao = null, recusa_motivo = null
     where id = r.id;
    if r.apagado_em is null then perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO'); end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- O motivo da revogação do último dia (no condomínio) sai com os textos do cancelamento.
create function comercial_apagar_revogacoes(p_interessado uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_pessoa uuid := contexto_pessoa();
  v_sistema text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_n integer := 0;
  v_k integer;
begin
  for r in
    select k.id, k.condominio_id from cancelamentos_cliente k
     where k.situacao in ('DESFEITO', 'REATIVADO') and k.textos_apagados_em is not null
       and (p_interessado is null or k.interessado_id = p_interessado)
  loop
    perform entrar_como_sistema(r.condominio_id);
    update encerramentos_contrato set revogado_motivo = 'Dado apagado (LGPD)'
     where cancelamento_id = r.id and revogado_em is not null and revogado_motivo <> 'Dado apagado (LGPD)';
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  if v_pessoa is not null then perform definir_pessoa(v_pessoa); else perform entrar_como_sistema(null); end if;
  perform set_config('app.comercial_sistema', v_sistema, true);
  return v_n;
end $$;

create or replace function comercial_anonimizar(p_id uuid, p_resumo text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cliente boolean;
  v_assinado uuid;
  v_cond uuid;
  v_pessoa uuid := contexto_pessoa();
  r record;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  select virou_cliente_em is not null, condominio_id into v_cliente, v_cond from interessados where id = p_id;
  select id into v_assinado from contratos_comercial where interessado_id = p_id and situacao = 'ASSINADO' and coalesce(v_cliente, false);
  update interessados set nome_contato = null, papel_contato = null, whatsapp = null, email = null, cnpj = null, endereco = null,
         optin_em = null, optin_canal = null, optin_texto = null, observacao = null, perda_detalhe = null, decisor = null, visita_nota = null,
         proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null,
         criterios = array_remove(criterios, 'OUTRO'), criterio_outro = null, problema = null,
         cadencia_fim_em = case when cadencia_id is not null then coalesce(cadencia_fim_em, app_now()) end,
         cadencia_fim_motivo = case when cadencia_id is not null then coalesce(cadencia_fim_motivo, 'NAO_CONTATAR') end,
         anonimizado_em = app_now()
   where id = p_id;
  update conversas_comercial set resumo = p_resumo where interessado_id = p_id;
  update fatos_comparativo set texto = 'Dado apagado (LGPD)', fonte = 'Dado apagado (LGPD)',
         outro_chave = case when outro_chave is not null then 'apagado' end, retirado_em = coalesce(retirado_em, app_now())
   where interessado_id = p_id and escopo = 'PREDIO';
  -- O aceite do contrato assinado é a prova de quem assinou: fica com o contrato.
  update aceites_proposta a set nome = null, cpf = null, ip = null, aparelho = null, anonimizado_em = app_now()
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.anonimizado_em is null
     and not exists (select 1 from contratos_comercial c where c.id = v_assinado and c.aceite_id = a.id);
  update aberturas_proposta a set aparelho = null
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.aparelho is not null;
  update versoes_proposta v set nota_interna = null
    from propostas_comercial p
   where p.id = v.proposta_id and p.interessado_id = p_id and v.nota_interna is not null;
  -- Documentos do aceite: os recebidos de quem virou cliente ficam; o resto some.
  update documentos_aceite set situacao = 'APAGADO', apagado_em = app_now(), nome = null, cnpj = null, mandato_ate = null, ip = null,
                               motivo_recusa = null
   where interessado_id = p_id and apagado_em is null and not (v_assinado is not null and situacao = 'RECEBIDO');
  for r in select caminho from documentos_aceite
            where interessado_id = p_id and caminho is not null and not (v_assinado is not null and situacao = 'RECEBIDO') loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- Contratos: o assinado de quem virou cliente fica; os outros perdem o retrato e o PDF.
  update contratos_comercial set dados = jsonb_build_object('anonimizado', true, 'numero', numero), anonimizado_em = app_now()
   where interessado_id = p_id and anonimizado_em is null and id is distinct from v_assinado;
  for r in select caminho from contratos_comercial
            where interessado_id = p_id and caminho is not null and id is distinct from v_assinado loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- Envios: os dois conferidos do contrato assinado de quem virou cliente ficam; dos outros (também
  -- os conferidos de um contrato que não chegou a virar cliente), o arquivo e quem assinou somem.
  update envios_contrato set apagado_em = coalesce(apagado_em, app_now()), nome = null, ip = null, assinante_nome = null, cpf_mascarado = null,
                             observacao = null, recusa_motivo = null
   where interessado_id = p_id and not (v_assinado is not null and contrato_id = v_assinado and situacao = 'CONFERIDO')
     and (apagado_em is null or num_nonnulls(nome, ip, assinante_nome, cpf_mascarado, observacao, recusa_motivo) > 0);
  for r in select caminho from envios_contrato
            where interessado_id = p_id and caminho is not null
              and not (v_assinado is not null and contrato_id = v_assinado and situacao = 'CONFERIDO') loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- O condomínio do piloto que não virou cliente (o piloto já foi encerrado pelo gatilho do
  -- interessado): ficam o nome e o endereço na carteira, sem contatos nem CNPJ.
  if v_cond is not null and not coalesce(v_cliente, false) then
    perform entrar_como_sistema(v_cond);
    update condominios set contatos = '[]'::jsonb, cnpj = null where id = v_cond and (contatos <> '[]'::jsonb or cnpj is not null);
    if v_pessoa is not null then perform definir_pessoa(v_pessoa); else perform entrar_como_sistema(null); end if;
  end if;
  update trocas_sistema set carta = 'Carta apagada (LGPD).' where interessado_id = p_id;
  update pilotos_comercial set combinado_com = null, detalhe = null where interessado_id = p_id;
  perform comercial_revogar_links_interessado(p_id, 'Dados apagados (LGPD)', null);
  -- A agenda (0310): a demonstração marcada é cancelada sem aviso e o e-mail sai da fila.
  update demonstracoes_comercial set situacao = 'CANCELADA', motivo = 'Dados apagados (LGPD)', encerrada_em = app_now(), encerrada_por = v_pessoa
   where interessado_id = p_id and situacao = 'MARCADA';
  update demonstracoes_comercial set nome_contato = null, condominio = null, email = null
   where interessado_id = p_id and num_nonnulls(nome_contato, condominio, email) > 0;
  update emails_comercial e set situacao = case when e.situacao in ('NA_FILA', 'ENVIANDO') then 'CANCELADO' else e.situacao end, para = null
    from demonstracoes_comercial d
   where d.id = e.demonstracao_id and d.interessado_id = p_id and e.para is not null;
  -- Renovação, risco, cancelamento e expansão (0311): saem os textos de pessoa; ficam os valores,
  -- as datas e o motivo da lista.
  update renovacoes_cliente set aviso_para = null, aviso_texto = null, dispensa_motivo = null, textos_apagados_em = coalesce(textos_apagados_em, app_now())
   where interessado_id = p_id and num_nonnulls(aviso_para, aviso_texto, dispensa_motivo) > 0;
  update cancelamentos_cliente set pedido_por = null, retencao = null, decisao_nota = null, motivo_texto = null, desfeito_nota = null,
         textos_apagados_em = app_now()
   where interessado_id = p_id and textos_apagados_em is null;
  update riscos_cliente set detalhe = null, tratado_nota = null where interessado_id = p_id and num_nonnulls(detalhe, tratado_nota) > 0;
  update expansoes_cliente set etapa = 'PERDIDA', resultado = 'Dados apagados (LGPD)', encerrada_em = app_now(), encerrada_por = v_pessoa
   where interessado_id = p_id and encerrada_em is null;
  update expansoes_cliente set motivo = 'Dado apagado (LGPD)', proximo_passo = null,
         resultado = case when resultado is not null then 'Dado apagado (LGPD)' end
   where interessado_id = p_id
     and (motivo <> 'Dado apagado (LGPD)' or proximo_passo is not null or resultado is distinct from case when resultado is not null then 'Dado apagado (LGPD)' end);
  -- 0318: o aditivo de retorno que não reativou, os envios dos aditivos que não ficam e o motivo
  -- da revogação do último dia.
  perform comercial_apagar_aditivos_retorno(p_id, true);
  perform comercial_apagar_revogacoes(p_id);
  perform set_config('app.comercial_sistema', '', true);
end $$;

create or replace function comercial_rotina_renovacoes() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_agora timestamptz := app_now();
  v_hoje date := comercial_hoje();
  v_queda integer := configuracao_int('comercial_uso_queda_percentual');
  v_base integer := configuracao_int('comercial_uso_base_minima');
  v_recentes integer;
  v_antes integer;
  v_total integer := 0;
  v_n integer;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  -- Uso caindo: os pedidos dos últimos 30 dias contra os 30 anteriores, uma vez por mês.
  for r in
    select i.id, i.condominio_id from interessados i
     where i.virou_cliente_em is not null and i.condominio_id is not null and i.anonimizado_em is null
       and not exists (select 1 from cancelamentos_cliente k where k.interessado_id = i.id and k.situacao = 'CONFIRMADO')
       and not exists (select 1 from riscos_cliente s where s.interessado_id = i.id and s.tipo = 'USO_CAINDO' and s.data_ref = date_trunc('month', v_hoje)::date)
  loop
    perform entrar_como_sistema(r.condominio_id);
    select count(*) filter (where criado_em >= v_agora - interval '30 days'), count(*) filter (where criado_em < v_agora - interval '30 days')
      into v_recentes, v_antes
      from pedidos where condominio_id = r.condominio_id and criado_em >= v_agora - interval '60 days' and criado_em < v_agora;
    perform entrar_como_sistema(null);
    if v_antes >= greatest(v_base, 1) and v_recentes * 100 <= v_antes * (100 - v_queda) then
      insert into riscos_cliente (interessado_id, tipo, origem, data_ref, detalhe)
      values (r.id, 'USO_CAINDO', 'PEDIDOS', date_trunc('month', v_hoje)::date,
              format('Uso caiu %s%% em 30 dias', round(100 - v_recentes * 100.0 / v_antes)::integer))
      on conflict (interessado_id, tipo, data_ref) do nothing;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end if;
  end loop;
  -- Retenção (catálogo 39 e 40).
  update renovacoes_cliente set aviso_para = null, aviso_texto = null, dispensa_motivo = null, textos_apagados_em = v_agora
   where num_nonnulls(aviso_para, aviso_texto, dispensa_motivo) > 0
     and coalesce(aviso_em, (registrado_em at time zone 'America/Sao_Paulo')::date)
         < v_hoje - make_interval(years => configuracao_int('comercial_aviso_texto_anos'));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  -- O desfeito conta da data em que foi desfeito (0318); os outros, como antes.
  update cancelamentos_cliente set pedido_por = null, retencao = null, decisao_nota = null, motivo_texto = null, desfeito_nota = null,
         textos_apagados_em = v_agora
   where textos_apagados_em is null
     and (case situacao when 'FICOU' then (decidido_em at time zone 'America/Sao_Paulo')::date
                        when 'DESFEITO' then (desfeito_em at time zone 'America/Sao_Paulo')::date
                        else ultimo_dia end)
         < v_hoje - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  -- 0318: com os textos do cancelamento, saem o motivo da revogação e o aditivo de retorno que não
  -- reativou (com os envios dele).
  v_total := v_total + comercial_apagar_revogacoes(null) + comercial_apagar_aditivos_retorno(null, false);
  -- A nota de qualquer sinal tratado; o detalhe só do marcado à mão (o automático não tem pessoa),
  -- também do sinal de quem saiu, que não aparece mais para ser tratado.
  update riscos_cliente s set detalhe = case when s.origem = 'A_MAO' then null else s.detalhe end, tratado_nota = null
   where (s.tratado_nota is not null or (s.origem = 'A_MAO' and s.detalhe is not null))
     and (s.tratado_em < v_agora - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'))
          or exists (select 1 from cancelamentos_cliente k where k.interessado_id = s.interessado_id and k.situacao = 'CONFIRMADO'
                        and k.ultimo_dia < v_hoje - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'))));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  update expansoes_cliente set motivo = 'Dado apagado (LGPD)', proximo_passo = null,
         resultado = case when resultado is not null then 'Dado apagado (LGPD)' end
   where encerrada_em < v_agora - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'))
     and (motivo <> 'Dado apagado (LGPD)' or proximo_passo is not null or resultado is distinct from case when resultado is not null then 'Dado apagado (LGPD)' end);
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  perform set_config('app.comercial_sistema', '', true);
  return v_total;
end $$;

call fechar_acesso();

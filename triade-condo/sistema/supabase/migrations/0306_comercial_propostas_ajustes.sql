-- 0306 · Ajustes das propostas do Comercial (R17.3; IDEIAS CM-07, CM-12, CM-19, CM-20). A 0304
-- já está aplicada no triade-condo-dev: aqui só se redefinem funções, políticas e gatilhos.
-- Defeitos achados na revisão independente de 24/10/2026:
--
-- 1. (LGPD) Link novo para interessado anonimizado ou na lista de não contatar; o link público
--    abria, mostrava o kit e aceitava para esses interessados. Agora o link novo pede
--    interessado aberto e o link público responde como inexistente.
-- 2. O aceite valia para interessado fechado (Ganho, Perdido, Sem resposta). Fechar ou
--    anonimizar o interessado revoga os links das versões dele (gatilho), os que já estavam
--    abertos são revogados aqui, e o aceite pede interessado aberto (PROPOSTA_INDISPONIVEL).
-- 3. A leitura da Tabela de preços pelo Comercial pedia contexto de equipe, e o kit pelo link
--    perdia o comparativo confirmado. As políticas aceitam também o fluxo sem pessoa
--    (comercial_sistema()), que só as funções do link ligam.
-- 4. O resumo do aparelho passa a ser HMAC com segredo do servidor (na api-console); a
--    anonimização apaga o resumo do aparelho das aberturas.
-- 5. Responder ao desconto, pedir, enviar e registrar recusa travam a linha da versão antes
--    de conferir a versão do registro (duas pessoas ao mesmo tempo: a segunda recebe 409).
-- 6. Mudar a implantação digitada derruba a aprovação, como mudar o valor; as premissas usam
--    centavos (bigint) no lugar de integer.
-- 7. Sob consulta (acima de 400 unidades, valor digitado) também pede a aprovação da
--    Administração, pelo mesmo fluxo do desconto. Fica no fim, em parte própria.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- 3. A Tabela de preços lida dentro do link sem pessoa.

alter policy leitura_comercial on faixas_preco using (comercial_sistema() or (contexto_equipe() and pode_global('console.comercial.ver')));
alter policy leitura_comercial on parametros_preco using (comercial_sistema() or (contexto_equipe() and pode_global('console.comercial.ver')));
alter policy leitura_comercial on precos_concorrentes using (comercial_sistema() or (contexto_equipe() and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- 2. Fechar ou anonimizar o interessado revoga os links das propostas dele.

create function comercial_revogar_links_interessado(p_interessado uuid, p_motivo text, p_pessoa uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_antes text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_total integer;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  update links_proposta l set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = p_motivo
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where l.versao_id = v.id and p.interessado_id = p_interessado and l.revogado_em is null;
  get diagnostics v_total = row_count;
  perform set_config('app.comercial_sistema', v_antes, true);
  return v_total;
end $$;

create function interessados_links_proposta() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.anonimizado_em is not null and old.anonimizado_em is null then
    perform comercial_revogar_links_interessado(new.id, 'Dados apagados (LGPD)', null);
  elsif new.etapa is distinct from old.etapa and not comercial_aberta(new.etapa) then
    perform comercial_revogar_links_interessado(new.id, 'Interessado fechado', new.alterado_por);
  end if;
  return null;
end $$;
create trigger interessados_links_proposta after update of etapa, anonimizado_em on interessados
  for each row execute function interessados_links_proposta();

-- Os links que já estavam abertos para interessado fechado ou anonimizado.
do $$
declare r record;
begin
  for r in select i.id, i.anonimizado_em from interessados i
            where (i.anonimizado_em is not null or not comercial_aberta(i.etapa))
              and exists (select 1 from propostas_comercial p join versoes_proposta v on v.proposta_id = p.id
                            join links_proposta l on l.versao_id = v.id
                           where p.interessado_id = i.id and l.revogado_em is null) loop
    perform comercial_revogar_links_interessado(r.id, case when r.anonimizado_em is not null then 'Dados apagados (LGPD)' else 'Interessado fechado' end, null);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- 4. A anonimização apaga também o resumo do aparelho das aberturas. A abertura continua só
-- de inserção; a única mudança é a da anonimização, que esvazia o aparelho.

create function aberturas_proposta_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and comercial_sistema() and new.aparelho is null
     and (new.id, new.link_id, new.versao_id, new.aberta_em) is not distinct from (old.id, old.link_id, old.versao_id, old.aberta_em) then
    return new;
  end if;
  raise exception 'A abertura não se altera' using errcode = 'TC422', detail = '{"motivo":"ABERTURA_FIXA"}';
end $$;
create or replace trigger aberturas_proposta_somente_insercao before update or delete on aberturas_proposta
  for each row execute function aberturas_proposta_regras();

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
  update aberturas_proposta a set aparelho = null
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.aparelho is not null;
  update versoes_proposta v set nota_interna = null
    from propostas_comercial p
   where p.id = v.proposta_id and p.interessado_id = p_id and v.nota_interna is not null;
  perform comercial_revogar_links_interessado(p_id, 'Dados apagados (LGPD)', null);
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- 6. Premissas em centavos (bigint).

create or replace function comercial_premissas(p_mensal bigint, p_unidades integer, p_por_ap bigint) returns jsonb
language sql immutable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'estimativa', true, 'semRoi', true, 'implantacaoAParte', true, 'mensal', p_mensal, 'unidades', p_unidades, 'porApartamento', p_por_ap,
    'texto', case when p_mensal is not null then
      'Estimativa: ' || reais(p_mensal::centavos) || ' por mês divididos por ' || p_unidades || ' unidades dá ' || reais(p_por_ap::centavos)
      || ' por apartamento por mês. A implantação é à parte. Não é cálculo de retorno.' end))
$$;

-- ---------------------------------------------------------------------------------------
-- 5. A versão travada antes de conferir a versão do registro.

create function comercial_travar_versao(p_proposta uuid, p_id uuid, p_versao integer) returns versoes_proposta
language plpgsql
set search_path = public
as $$
declare v versoes_proposta;
begin
  select * into v from versoes_proposta where id = p_id and proposta_id = p_proposta for update;
  if not found then raise exception 'Versão não encontrada' using errcode = 'TC404'; end if;
  if p_versao is not null and v.versao <> p_versao then perform conflito_versao('versoes_proposta', p_id); end if;
  return v;
end $$;

-- A aprovação continua só se nada que muda o preço mudou: desconto, valor da tabela (ou
-- digitado), ciclo, tabela e implantação.
create or replace function comercial_salvar_versao(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then
    perform recusar_motivo('A versão enviada não muda; faça uma versão nova', 'VERSAO_ENVIADA');
  end if;
  n := comercial_preparar_versao(comercial_buscar(p.interessado_id), p_dados);
  v_mantem := v.desconto_situacao = 'APROVADO' and n.desconto_percentual is not null
              and (n.desconto_percentual, n.mensal_tabela_centavos, n.ciclo, n.tabela, n.implantacao_centavos) is not distinct from
                  (v.desconto_percentual, v.mensal_tabela_centavos, v.ciclo, v.tabela, v.implantacao_centavos);
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

create or replace function comercial_pedir_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_proposta;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  v := comercial_travar_versao(p_proposta, p_id, p_versao);
  if v.desconto_percentual is null then perform recusar_motivo('Esta versão não tem desconto', 'SEM_DESCONTO'); end if;
  if v.situacao <> 'RASCUNHO' then perform recusar_motivo('Só o rascunho pede aprovação do desconto', 'DESCONTO_JA_PEDIDO'); end if;
  if v.mensal_centavos is null then perform recusar_motivo('A faixa ainda não tem valor na tabela', 'PROPOSTA_SEM_VALOR'); end if;
  update versoes_proposta set situacao = 'AGUARDA_DESCONTO', desconto_situacao = 'PEDIDO', desconto_pedido_em = app_now(), desconto_pedido_por = p_pessoa,
                              desconto_resposta = null, desconto_respondido_em = null, desconto_respondido_por = null,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  perform registrar_historico_interno('comercial.desconto_pedido', 'proposta', p_proposta::text,
    jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', 'AGUARDA_DESCONTO');
end $$;

create or replace function comercial_responder_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_aprovar boolean, p_resposta text)
returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if v.situacao <> 'AGUARDA_DESCONTO' then perform recusar_motivo('Este desconto não está aguardando resposta', 'DESCONTO_NAO_PEDIDO'); end if;
  if not coalesce(p_aprovar, false) and nullif(btrim(p_resposta), '') is null then
    perform recusar_campos('Diga a quem pediu por que recusou', 'resposta');
  end if;
  update versoes_proposta set situacao = v_situacao, desconto_situacao = case when p_aprovar then 'APROVADO' else 'RECUSADO' end,
                              desconto_resposta = nullif(btrim(p_resposta), ''), desconto_respondido_em = app_now(), desconto_respondido_por = p_pessoa,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  perform comercial_inserir_conversa(p.interessado_id, 'NOTA',
    format('Desconto de %s%% na proposta v%s %s pela Administração.%s', replace(trim_scale(v.desconto_percentual)::text, '.', ','), v.numero,
           case when p_aprovar then 'aprovado' else 'recusado' end, coalesce(' ' || nullif(btrim(p_resposta), ''), '')), false, null, null);
  perform registrar_historico_interno(case when p_aprovar then 'comercial.desconto_aprovado' else 'comercial.desconto_recusado' end, 'proposta',
    p.id::text, jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', v_situacao);
end $$;

create or replace function comercial_enviar_proposta(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
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
   where id = p_id and versao = p_versao
  returning * into v;
  if v.id is null then perform conflito_versao('versoes_proposta', p_id); end if;
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

create or replace function comercial_recusar_proposta(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_motivo text) returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if proposta_situacao(v) <> 'ENVIADA' then perform recusar_motivo('Só a versão enviada e em validade é recusada', 'PROPOSTA_INDISPONIVEL'); end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then perform recusar_campos('Diga o que a pessoa respondeu', 'motivo'); end if;
  update versoes_proposta set situacao = 'RECUSADA', recusada_em = app_now(), recusada_por = p_pessoa, recusada_motivo = btrim(p_motivo),
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  update links_proposta set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = 'Proposta recusada'
   where versao_id = p_id and revogado_em is null;
  perform comercial_inserir_conversa(p.interessado_id, 'PROPOSTA', format('Proposta v%s recusada: %s', v.numero, btrim(p_motivo)), true, null, null);
  perform registrar_historico_interno('comercial.proposta_recusada', 'proposta', p.id::text, jsonb_build_object('versao', v.numero));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', 'RECUSADA');
end $$;

-- ---------------------------------------------------------------------------------------
-- 1. Link novo só para interessado aberto, com dados e fora do não contatar.

create or replace function comercial_novo_link(p_pessoa uuid, p_proposta uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  v_link jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_buscar_versao(p.id, p_id);
  perform comercial_exigir_aberto(comercial_buscar(p.interessado_id));
  if proposta_situacao(v) not in ('ENVIADA', 'ACEITA') then perform recusar_motivo('Só a versão enviada e em validade tem link', 'SEM_LINK'); end if;
  v_link := comercial_gerar_link(v, p_pessoa);
  perform registrar_historico_interno('comercial.proposta_link', 'proposta', p_proposta::text, jsonb_build_object('versao', v.numero));
  return jsonb_build_object('id', v.id, 'link', v_link);
end $$;

-- O link público: interessado anonimizado ou no não contatar é como se o link não existisse.
create function publico_interessado_da_versao(v versoes_proposta) returns interessados
language plpgsql
set search_path = public
as $$
declare i interessados;
begin
  select i2.* into i from propostas_comercial p join interessados i2 on i2.id = p.interessado_id where p.id = v.proposta_id;
  if i.id is null or i.anonimizado_em is not null or comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj) then
    raise exception 'Proposta não encontrada' using errcode = 'TC404';
  end if;
  return i;
end $$;

create or replace function publico_proposta(p_codigo text, p_aparelho text) returns jsonb
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
  perform publico_interessado_da_versao(v);
  perform publico_exigir_em_validade(l, v);
  insert into aberturas_proposta (link_id, versao_id, aparelho) values (l.id, v.id, case when p_aparelho ~ '^[0-9a-f]{64}$' then p_aparelho end);
  v_saida := proposta_publica_json(v) || jsonb_build_object('kitDisponivel', v.situacao in ('ENVIADA', 'ACEITA'));
  perform set_config('app.comercial_sistema', '', true);
  return v_saida;
end $$;

create or replace function publico_kit_proposta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  i interessados;
  v_kit jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id;
  i := publico_interessado_da_versao(v);
  perform publico_exigir_em_validade(l, v);
  if v.situacao not in ('ENVIADA', 'ACEITA') then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  v_kit := proposta_kit_json(v, i);
  perform set_config('app.comercial_sistema', '', true);
  return v_kit;
end $$;

create or replace function publico_aceitar_proposta(p_codigo text, p_dados jsonb, p_ip text, p_aparelho text) returns jsonb
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
  i := publico_interessado_da_versao(v);
  perform publico_exigir_em_validade(l, v);
  if v.situacao = 'ACEITA' then perform recusar_motivo('Esta proposta já foi aceita', 'PROPOSTA_JA_ACEITA'); end if;
  if v.situacao <> 'ENVIADA' or not comercial_aberta(i.etapa) then
    perform recusar_motivo('Esta proposta não pode mais ser aceita', 'PROPOSTA_INDISPONIVEL');
  end if;
  if coalesce(length(v_nome), 0) not between 2 and 80 then perform recusar_campos('Escreva o seu nome', 'nome'); end if;
  if not cpf_valido(v_cpf) then perform recusar_campos('CPF inválido', 'cpf'); end if;
  if coalesce(length(v_cargo), 0) not between 2 and 60 then perform recusar_campos('Diga o seu cargo no condomínio', 'cargo'); end if;
  if coalesce((p_dados ->> 'concordo')::boolean, false) is not true then perform recusar_campos('Confirme que leu a proposta', 'concordo'); end if;
  insert into aceites_proposta (versao_id, link_id, nome, cpf, cargo, ip, aparelho, hash_versao, aceito_em)
  values (v.id, l.id, v_nome, v_cpf, v_cargo, case when length(p_ip) between 3 and 45 then p_ip end,
          case when p_aparelho ~ '^[0-9a-f]{64}$' then p_aparelho end, v.hash, v_em);
  update versoes_proposta set situacao = 'ACEITA', alterado_em = v_em where id = v.id;
  perform comercial_inserir_conversa(i.id, 'PROPOSTA', format('Proposta v%s aceita pelo link por %s (%s).', v.numero, v_nome, v_cargo), true, null, null);
  v_alvo := case when cardinality(comercial_falta(i, 'APROVACAO')) = 0 then 'APROVACAO' else 'NEGOCIACAO' end;
  if comercial_ordem_etapa(i.etapa) < comercial_ordem_etapa(v_alvo) and cardinality(comercial_falta(i, v_alvo)) = 0 then
    update interessados set etapa = v_alvo, etapa_desde = v_em where id = i.id;
    insert into etapas_interessado (interessado_id, de, para) values (i.id, i.etapa, v_alvo);
    perform comercial_iniciar_cadencia(i.id);
  end if;
  update propostas_comercial set alterado_em = v_em where id = v.proposta_id;
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_build_object('situacao', 'ACEITA', 'numero', v.numero, 'nome', v_nome, 'cargo', v_cargo, 'aceitoEm', v_em, 'hash', v.hash);
end $$;

-- ---------------------------------------------------------------------------------------
-- 7. Sob consulta também pede a aprovação da Administração (opção recomendada; a decisão final
-- é da Carolina). O valor digitado acima de 400 unidades segue o mesmo fluxo do desconto:
-- o Comercial pede, a Administração aprova ou recusa, e a proposta só sai aprovada. Esta parte
-- fica sozinha no fim da migration e no próprio commit, para sair inteira se a decisão for outra.

-- A trava da tabela: o pedido de aprovação vale também sem desconto quando é sob consulta. Que
-- a sob consulta só sai aprovada fica no envio (a trava de enviada não muda, para não pegar as
-- enviadas antes da 0306).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'versoes_proposta'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) = 'CHECK (((desconto_percentual IS NOT NULL) OR (desconto_situacao = ''SEM''::text)))' loop
    execute format('alter table versoes_proposta drop constraint %I', r.conname);
  end loop;
end $$;
alter table versoes_proposta add constraint versoes_proposta_pedido_aprovacao
  check (desconto_percentual is not null or tabela = 'MANUAL' or desconto_situacao = 'SEM');

-- O que precisa da Administração: desconto, valor sob consulta, ou os dois.
create function comercial_pede_aprovacao(v versoes_proposta) returns boolean
language sql immutable
set search_path = public
as $$ select v.desconto_percentual is not null or v.tabela = 'MANUAL' $$;

-- "desconto de 10%", "valor sob consulta de R$ 1.500,00 por mês" ou os dois.
create function comercial_texto_aprovacao(v versoes_proposta) returns text
language sql immutable
set search_path = public
as $$
  select concat_ws(' com ',
    case when v.tabela = 'MANUAL' then 'valor sob consulta de ' || reais(v.mensal_tabela_centavos::centavos) || ' por mês' end,
    case when v.desconto_percentual is not null then 'desconto de ' || replace(trim_scale(v.desconto_percentual)::text, '.', ',') || '%' end)
$$;

create or replace function versao_proposta_json(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select proposta_conteudo(v) || jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'versaoRegistro', v.versao, 'numero', v.numero, 'situacao', proposta_situacao(v), 'hash', v.hash,
    'respostas', v.respostas,
    'referencias', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sindico', r.sindico, 'condominio', r.condominio,
                                                                 'retirada', r.retirada_em is not null) order by array_position(v.referencias, r.id)), '[]'::jsonb)
                      from referencias_comercial r where r.id = any (v.referencias)),
    'pedeAprovacao', comercial_pede_aprovacao(v),
    'descontoPedido', case when comercial_pede_aprovacao(v) then jsonb_strip_nulls(jsonb_build_object(
        'percentual', trim_scale(v.desconto_percentual), 'motivo', v.desconto_motivo, 'situacao', v.desconto_situacao,
        'sobConsulta', v.tabela = 'MANUAL',
        'valorManual', case when v.tabela = 'MANUAL' then v.mensal_tabela_centavos end,
        'implantacaoManual', case when v.tabela = 'MANUAL' then v.implantacao_centavos end,
        'valorManualMotivo', v.valor_manual_motivo,
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

-- Salvar: a aprovação continua só se nada que muda o preço mudou (desconto, valor da tabela ou
-- digitado, ciclo, tabela e implantação), com desconto ou sob consulta.
create or replace function comercial_salvar_versao(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then
    perform recusar_motivo('A versão enviada não muda; faça uma versão nova', 'VERSAO_ENVIADA');
  end if;
  n := comercial_preparar_versao(comercial_buscar(p.interessado_id), p_dados);
  v_mantem := v.desconto_situacao = 'APROVADO' and comercial_pede_aprovacao(n)
              and (n.desconto_percentual, n.mensal_tabela_centavos, n.ciclo, n.tabela, n.implantacao_centavos) is not distinct from
                  (v.desconto_percentual, v.mensal_tabela_centavos, v.ciclo, v.tabela, v.implantacao_centavos);
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

create or replace function comercial_pedir_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v versoes_proposta;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  v := comercial_travar_versao(p_proposta, p_id, p_versao);
  if not comercial_pede_aprovacao(v) then perform recusar_motivo('Esta versão não tem desconto nem valor sob consulta', 'SEM_DESCONTO'); end if;
  if v.situacao <> 'RASCUNHO' then perform recusar_motivo('Só o rascunho pede aprovação', 'DESCONTO_JA_PEDIDO'); end if;
  if v.mensal_centavos is null then perform recusar_motivo('A faixa ainda não tem valor na tabela', 'PROPOSTA_SEM_VALOR'); end if;
  update versoes_proposta set situacao = 'AGUARDA_DESCONTO', desconto_situacao = 'PEDIDO', desconto_pedido_em = app_now(), desconto_pedido_por = p_pessoa,
                              desconto_resposta = null, desconto_respondido_em = null, desconto_respondido_por = null,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  perform registrar_historico_interno('comercial.desconto_pedido', 'proposta', p_proposta::text,
    jsonb_strip_nulls(jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual),
                                         'sobConsulta', case when v.tabela = 'MANUAL' then v.mensal_tabela_centavos end)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', 'AGUARDA_DESCONTO');
end $$;

create or replace function comercial_responder_desconto(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_aprovar boolean, p_resposta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  v_versao integer;
  v_situacao text := case when p_aprovar then 'PRONTA' else 'RASCUNHO' end;
  v_texto text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.desconto');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if v.situacao <> 'AGUARDA_DESCONTO' then perform recusar_motivo('Este pedido não está aguardando resposta', 'DESCONTO_NAO_PEDIDO'); end if;
  if not coalesce(p_aprovar, false) and nullif(btrim(p_resposta), '') is null then
    perform recusar_campos('Diga a quem pediu por que recusou', 'resposta');
  end if;
  update versoes_proposta set situacao = v_situacao, desconto_situacao = case when p_aprovar then 'APROVADO' else 'RECUSADO' end,
                              desconto_resposta = nullif(btrim(p_resposta), ''), desconto_respondido_em = app_now(), desconto_respondido_por = p_pessoa,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  v_texto := comercial_texto_aprovacao(v);
  perform comercial_inserir_conversa(p.interessado_id, 'NOTA',
    format('%s na proposta v%s %s pela Administração.%s', upper(left(v_texto, 1)) || substr(v_texto, 2), v.numero,
           case when p_aprovar then 'aprovado' else 'recusado' end, coalesce(' ' || nullif(btrim(p_resposta), ''), '')), false, null, null);
  perform registrar_historico_interno(case when p_aprovar then 'comercial.desconto_aprovado' else 'comercial.desconto_recusado' end, 'proposta',
    p.id::text, jsonb_strip_nulls(jsonb_build_object('versao', v.numero, 'percentual', trim_scale(v.desconto_percentual),
                                                     'sobConsulta', case when v.tabela = 'MANUAL' then v.mensal_tabela_centavos end)));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', v_situacao);
end $$;

create or replace function comercial_enviar_proposta(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer) returns jsonb
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
  v := comercial_travar_versao(p.id, p_id, p_versao);
  i := comercial_buscar(p.interessado_id);
  perform comercial_exigir_aberto(i);
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then perform recusar_motivo('Esta versão já foi enviada', 'VERSAO_ENVIADA'); end if;
  if v.desconto_percentual is not null and v.desconto_situacao <> 'APROVADO' then
    perform recusar_motivo('Proposta com desconto só sai depois da aprovação da Administração', 'DESCONTO_SEM_APROVACAO');
  end if;
  if v.tabela = 'MANUAL' and v.desconto_situacao <> 'APROVADO' then
    perform recusar_motivo('Proposta sob consulta só sai depois da aprovação da Administração', 'SOB_CONSULTA_SEM_APROVACAO');
  end if;
  if v.mensal_centavos is null then perform recusar_motivo('A faixa ainda não tem valor na tabela', 'PROPOSTA_SEM_VALOR'); end if;
  -- As respostas saem com o texto revisado de hoje (a Administração pode ter mudado).
  v_respostas := comercial_copiar_respostas((select coalesce(jsonb_agg(r -> 'id'), '[]'::jsonb) from jsonb_array_elements(v.respostas) r));
  perform comercial_exigir_referencias(to_jsonb(v.referencias));
  update versoes_proposta set respostas = v_respostas, valido_ate = comercial_hoje() + validade_dias, enviada_em = app_now(), enviada_por = p_pessoa,
                              alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning * into v;
  if v.id is null then perform conflito_versao('versoes_proposta', p_id); end if;
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

call fechar_acesso();

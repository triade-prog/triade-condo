-- Comunicação e vida em condomínio com banco (fase D, área C; CD-01, AC-03, AC-05).
-- 1. Comunicados: o período nos Filtros (decisão C.1). Vale a data que a aba mostra: publicado em,
--    programado para, editado em ou arquivado em, no dia do condomínio.
-- 2. Nova enquete: quantas unidades (ou pessoas) ficam sem o link pelos canais marcados (decisão C.2).
--    A lista traz quem não tem WhatsApp ou não tem e-mail; a tela junta com os canais escolhidos.
-- 3. Revisar o anúncio: o tipo (Vendo, Doação, Procuro, Serviço de morador) pode mudar ao publicar,
--    e a troca fica no histórico.
-- As aberturas do mural em Na mesma área já vinham do banco (plano de comunicação), sem mudança aqui.

-- ---------------------------------------------------------------------------------------
-- 1. A lista de comunicados com o período. A versão da 0150 passa a ser comunicados_r1.

-- O dia que a aba mostra para o comunicado, no fuso do condomínio.
create function dia_na_aba_comunicado(c comunicados) returns date
language sql stable
set search_path = public
as $$
  select (case c.estado when 'PUBLICADO' then c.publicado_em when 'PROGRAMADO' then c.programado_para
                        when 'ARQUIVADO' then c.arquivado_em when 'SUBSTITUIDO' then c.substituido_em
                        else c.atualizado_em end
          at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date
$$;

alter function plataforma_comunicados(uuid, uuid, text, text, text, text, integer) rename to comunicados_r1;
alter function comunicados_r1(uuid, uuid, text, text, text, text, integer) security invoker;

create function plataforma_comunicados(p_pessoa uuid, p_condominio uuid, p_filtro text, p_assunto text, p_atencao text,
                                       p_busca text, p_pagina integer, p_de date default null, p_ate date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  if coalesce(p_filtro, 'EM_USO') not in ('EM_USO', 'PUBLICADO', 'PROGRAMADO', 'RASCUNHO', 'ARQUIVADO', 'TODOS') then
    perform recusar_campos('Filtro desconhecido', 'filtro');
  end if;
  if p_assunto is not null and p_assunto not in ('AVISO', 'OBRAS', 'SEGURANCA', 'ASSEMBLEIA', 'LEMBRETE') then
    perform recusar_campos('Assunto desconhecido', 'assunto');
  end if;
  if p_atencao is not null and p_atencao not in ('RASCUNHOS_PARADOS', 'PROGRAMADOS_HOJE') then
    perform recusar_campos('Atalho desconhecido', 'atencao');
  end if;
  if p_de > p_ate then perform recusar_campos('O fim do período vem depois do começo', 'ate'); end if;
  return (
    with base as (
      select c.* from comunicados c
       where (case coalesce(p_filtro, 'EM_USO')
                when 'EM_USO' then c.estado in ('RASCUNHO', 'PROGRAMADO', 'PUBLICADO')
                when 'TODOS' then true
                else c.estado = p_filtro end)
         and (p_assunto is null or c.assunto = p_assunto)
         and (v_busca is null or lower(c.titulo) like '%' || v_busca || '%' or lower(c.texto) like '%' || v_busca || '%')
         and (p_de is null or dia_na_aba_comunicado(c) >= p_de)
         and (p_ate is null or dia_na_aba_comunicado(c) <= p_ate)
         and (case p_atencao
                when 'RASCUNHOS_PARADOS' then c.estado = 'RASCUNHO' and c.atualizado_em <= app_now() - interval '3 days'
                when 'PROGRAMADOS_HOJE' then c.estado = 'PROGRAMADO'
                  and (c.programado_para at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date = hoje_no_condominio()
                else true end))
    select jsonb_build_object(
      'itens', coalesce((
        select jsonb_agg(comunicado_json(x.linha, p_pessoa) order by x.ordem1, x.ordem2 desc)
          from (select b::comunicados as linha,
                       case b.estado when 'PROGRAMADO' then 0 when 'RASCUNHO' then 1 else 2 end as ordem1,
                       coalesce(b.publicado_em, b.atualizado_em) as ordem2
                  from base b order by ordem1, ordem2 desc offset (v_pagina - 1) * 30 limit 30) x), '[]'::jsonb),
      'total', (select count(*) from base),
      'pagina', v_pagina,
      'atalhos', jsonb_build_object(
        'rascunhosParados', (select count(*) from comunicados where estado = 'RASCUNHO' and atualizado_em <= app_now() - interval '3 days'),
        'programadosHoje', (select count(*) from comunicados where estado = 'PROGRAMADO'
          and (programado_para at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date = hoje_no_condominio())),
      'pode', jsonb_build_object('publicar', pode(p_pessoa, p_condominio, 'comunicados.publicar'))));
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. A aba Enquetes diz, antes de enviar, quem não recebe o link por WhatsApp ou por e-mail.
--    As regras são as do envio do convite (enviar_convite_enquete): WhatsApp para quem tem telefone e
--    não pediu para parar; e-mail para quem recebe por e-mail.

create or replace function plataforma_enquetes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.ver');
  return (
    with pessoas as (
      select distinct ct.id, ct.nome, (ct.telefone is not null and ct.whatsapp_parou_em is null) as whatsapp, recebe_por_email(ct) as email
        from contatos ct
        join contatos_unidade cu on cu.contato_id = ct.id and cu.estado = 'CONFIRMADO'
        join unidades u on u.id = cu.unidade_id and u.ativa
       where ct.dados_removidos_em is null),
    por_unidade as (
      select u.id, rotulo_unidade(u.id) as nome,
             coalesce(bool_or(ct.telefone is not null and ct.whatsapp_parou_em is null), false) as whatsapp,
             coalesce(bool_or(recebe_por_email(ct)), false) as email
        from unidades u
        left join contatos_unidade cu on cu.unidade_id = u.id and cu.estado = 'CONFIRMADO'
        left join contatos ct on ct.id = cu.contato_id and ct.dados_removidos_em is null
       where u.ativa
       group by u.id)
    select jsonb_build_object(
      'enquetes', coalesce((select jsonb_agg(enquete_json(e) order by enquete_aberta(e) desc, e.criado_em desc)
                              from (select * from enquetes order by criado_em desc limit 100) e), '[]'::jsonb),
      'canais', jsonb_build_object(
        'whatsapp', exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS'),
        'email', coalesce((select email_ligado from configuracao_condominio), false),
        'mural', coalesce((select mural_ligado from configuracao_condominio), false)),
      'unidades', (select count(*) from unidades where ativa),
      'pessoas', (select count(*) from pessoas),
      'semCanal', jsonb_build_object(
        'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'whatsapp', x.whatsapp, 'email', x.email)
                                               order by x.nome)
                                from por_unidade x where not (x.whatsapp and x.email)), '[]'::jsonb),
        'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'whatsapp', x.whatsapp, 'email', x.email)
                                              order by x.nome)
                               from pessoas x where not (x.whatsapp and x.email)), '[]'::jsonb)),
      'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'enquetes.editar'))));
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. Publicar o anúncio com o tipo escolhido na revisão. A versão da 0250 passa a ser
--    publicar_classificado_r1.

alter function plataforma_publicar_classificado(uuid, uuid, uuid, integer, text, integer) rename to publicar_classificado_r1;
alter function publicar_classificado_r1(uuid, uuid, uuid, integer, text, integer) security invoker;

create function plataforma_publicar_classificado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                                 p_valor_centavos integer, p_tipo text default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cl classificados;
  v_antes text;
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'classificados.editar');
  cl := exigir_classificado(p_id, p_versao);
  if cl.estado <> 'A_APROVAR' then perform recusar_motivo('O anúncio já foi decidido', 'ANUNCIO_DECIDIDO'); end if;
  if length(v_titulo) not between 3 and 80 then perform recusar_campos('Escreva o título, de 3 a 80 letras', 'titulo'); end if;
  if p_valor_centavos is not null and p_valor_centavos not between 1 and 100000000 then
    perform recusar_campos('Valor inválido', 'valorCentavos');
  end if;
  if p_tipo is not null and p_tipo not in ('VENDO', 'DOO', 'PROCURO', 'SERVICO') then
    perform recusar_campos('Tipo desconhecido', 'tipo');
  end if;
  v_antes := cl.tipo;
  update classificados set estado = 'NO_MURAL', titulo = v_titulo, valor_centavos = p_valor_centavos, tipo = coalesce(p_tipo, tipo),
                           no_mural_ate = hoje_no_condominio() + 30, decidido_em = app_now(), decidido_por = p_pessoa
   where id = cl.id returning * into cl;
  perform registrar_historico('classificado.publicado', 'classificados', cl.id::text,
    jsonb_build_object('titulo', cl.titulo, 'ate', cl.no_mural_ate)
    || case when cl.tipo <> v_antes then jsonb_build_object('tipo', cl.tipo, 'tipoAntes', v_antes) else '{}'::jsonb end);
  perform avisar_morador_classificado(cl, 'está no mural até ' || to_char(cl.no_mural_ate, 'DD/MM') || ', com o título "' || cl.titulo || '".'
    || case when cl.mostrar_telefone then ' Quem se interessar fala com você por aqui.' else ' Quem se interessar fala com o condomínio, que passa o recado.' end,
    p_pessoa);
  return classificado_json(cl);
end $$;

call fechar_acesso();

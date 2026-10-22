-- 0285 · Mural visto do painel (CD-15; CD-12, AC-05).
-- Desenho no canvas do novo frontend, quadros 72 a 79, aprovado pela Carolina em 22/10/2026.
--
-- Regras desta parte:
-- 1. O painel mostra o mesmo mural que o morador vê pelo link (publico_mural), com o código de
--    agora. Ver por ali não conta como abertura: as aberturas continuam sendo só de quem abre o link.
-- 2. Quem vê comunicados vê o mural no painel. Pôr e tirar do mural continuam pedindo
--    comunicados.publicar (plataforma_mural_comunicado, 0160).
-- 3. Ao lado, os comunicados publicados que não aparecem no link, cada um com o motivo: só para
--    um bloco, unidade ou contatos; assunto que começa fora do mural; ou tirado.
-- 4. O anúncio no mural ganha a data em que entrou ("há 2 dias" na vitrine).

-- ---------------------------------------------------------------------------------------
-- A abertura do mural só conta quando não é a prévia do painel. A marca vale só dentro da
-- transação de plataforma_mural, e quem chama pela API pública não tem como ligá-la.

create or replace function publico_mural_r10(p_codigo text) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  l links_publicos;
  cfg configuracao_condominio;
  v_nome text;
begin
  l := entrar_por_link(upper(p_codigo), array['MURAL']);
  select * into cfg from configuracao_condominio;
  select nome into v_nome from condominios where id = l.condominio_id;
  if l.revogado_em is not null then return jsonb_build_object('condominio', v_nome, 'trocado', true); end if;
  if not cfg.mural_ligado or cfg.mural_codigo is distinct from upper(p_codigo) then
    return jsonb_build_object('condominio', v_nome, 'foraDoAr', true);
  end if;
  if coalesce(current_setting('triade.mural_previa', true), '') <> 'sim' then
    insert into mural_aberturas (condominio_id, dia) values (l.condominio_id, hoje_no_condominio())
    on conflict (condominio_id, dia) do update set vezes = mural_aberturas.vezes + 1;
  end if;
  return jsonb_build_object(
    'condominio', v_nome,
    'comunicados', coalesce((
      select jsonb_agg(comunicado_publico_json(c) order by c.publicado_em desc)
        from (select * from comunicados where estado = 'PUBLICADO' and no_mural and publico = 'TODOS'
               order by publicado_em desc limit 60) c), '[]'::jsonb),
    'documentos', case when cfg.documentos_no_mural and cfg.email_ligado then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'tipo', d.tipo)
                       order by array_position(array['CONVENCAO', 'REGIMENTO', 'ATA', 'CONTRATO', 'LAUDO', 'ORCAMENTO', 'OUTRO'], d.tipo), lower(d.titulo))
        from documentos d where documento_vai_por_email(d)), '[]'::jsonb) else '[]'::jsonb end,
    'manual', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'resumo', m.resumo, 'texto', m.texto,
                                                            'atualizadoEm', m.escrita_em)) order by m.ordem, m.criado_em)
        from secoes_manual m where m.retirada_em is null and m.no_mural), '[]'::jsonb),
    'atualizadoEm', (select max(publicado_em) from comunicados where estado = 'PUBLICADO' and no_mural and publico = 'TODOS'));
end $$;

-- Os classificados do mural (0250) com a data em que o anúncio entrou.
create or replace function publico_mural_r12c(p_codigo text) returns jsonb
language plpgsql
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_mural_r12b(p_codigo);
  if v ? 'comunicados' then
    v := v || jsonb_build_object('classificados', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', cl.id, 'tipo', cl.tipo, 'titulo', cl.titulo, 'texto', cl.texto, 'valorCentavos', cl.valor_centavos,
               'desde', cl.decidido_em, 'ate', to_char(cl.no_mural_ate, 'YYYY-MM-DD'), 'foto', (foto_do_anuncio(cl)).id is not null,
               'quem', (select nome_curto(ct.nome) from contatos ct where ct.id = cl.contato_id and ct.dados_removidos_em is null),
               'bloco', bloco_da_unidade(cl.unidade_id),
               'whatsapp', case when cl.mostrar_telefone then
                 (select regexp_replace(ct.telefone, '\D', '', 'g') from contatos ct
                   where ct.id = cl.contato_id and ct.dados_removidos_em is null and contato_ativo(ct.id)) end))
             order by cl.decidido_em desc)
        from classificados cl where anuncio_no_mural(cl)), '[]'::jsonb));
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- O mural no painel (CD-15): o que o morador vê, as aberturas e o que ficou de fora.

create function motivo_fora_do_mural(c comunicados, cfg configuracao_condominio) returns text
language sql stable
set search_path = public
as $$
  select case
    when c.publico <> 'TODOS' then 'SO_PARA_ALGUNS'
    when not (c.assunto = any (cfg.mural_assuntos)) then 'ASSUNTO_FORA'
    else 'TIRADO' end
$$;

create function plataforma_mural(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  v_pode jsonb;
  v_mural jsonb;
  v_aberturas integer;
  v_fora jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  select * into cfg from configuracao_condominio;
  v_pode := jsonb_build_object('mural', pode(p_pessoa, p_condominio, 'comunicados.publicar'),
                               'configurar', pode(p_pessoa, p_condominio, 'config.ver'),
                               'classificados', pode(p_pessoa, p_condominio, 'classificados.ver'));
  v_aberturas := (select coalesce(sum(vezes), 0) from mural_aberturas where dia > hoje_no_condominio() - 7);
  v_fora := coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'assunto', c.assunto, 'publicadoEm', c.publicado_em,
                                        'versao', c.versao, 'motivo', motivo_fora_do_mural(c, cfg)) order by c.publicado_em desc)
      from (select * from comunicados where estado = 'PUBLICADO' and not (no_mural and publico = 'TODOS')
             order by publicado_em desc limit 30) c), '[]'::jsonb);
  if cfg.mural_ligado and cfg.mural_codigo is not null then
    perform set_config('triade.mural_previa', 'sim', true);
    v_mural := publico_mural(cfg.mural_codigo);
    perform set_config('triade.mural_previa', '', true);
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'ligado', cfg.mural_ligado,
    'codigo', case when cfg.mural_ligado then cfg.mural_codigo end,
    'aberturas', v_aberturas,
    'mural', v_mural,
    'versoes', coalesce((
      select jsonb_object_agg(c.id, c.versao)
        from comunicados c where c.estado = 'PUBLICADO' and c.no_mural and c.publico = 'TODOS'), '{}'::jsonb),
    'fora', v_fora,
    'pode', v_pode));
end $$;

call fechar_acesso();

-- Ajustes do evento no aviso (D4.40; CD-17, CD-18), da revisão de 27/10/2026, por cima da 0313:
-- 1. A assembleia cancelada sai do destaque: o edital continua no mural, sem o evento e com
--    "assembleiaCancelada", e não oferece mais "Pôr na agenda".
-- 2. O evento se corrige na versão nova (CD-01): corrigir pode mandar o evento novo ou tirá-lo;
--    sem mandar, herda o da versão anterior, como na 0313. No publicado, o evento não muda fora da
--    correção e da convocação, como o resto do comunicado.
-- 3. "Pôr na agenda" por um endereço de verdade (o celular abre a agenda, inclusive pelo
--    navegador de dentro do WhatsApp): o mural, o link pessoal e o painel devolvem o evento com o
--    fuso do condomínio, e a API monta o arquivo. Ler o evento não conta abertura do mural.

-- ---------------------------------------------------------------------------------------
-- 1. A assembleia cancelada.

-- O comunicado é edital (qualquer versão) de uma assembleia cancelada.
create function edital_de_assembleia_cancelada(c comunicados) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from assembleias a join comunicados e on e.id = a.comunicado_id
                  where e.familia_id = c.familia_id and a.estado = 'CANCELADA')
$$;

-- Igual a 0313, sem evento no edital da assembleia cancelada: nem destaque, nem bloco de data,
-- nem agenda.
create or replace function evento_comunicado_json(c comunicados) returns jsonb
language sql stable
set search_path = public
as $$
  select case when c.evento_dia is null or edital_de_assembleia_cancelada(c) then null else jsonb_strip_nulls(jsonb_build_object(
    'dia', to_char(c.evento_dia, 'YYYY-MM-DD'),
    'inicio', to_char(c.evento_inicio, 'HH24:MI'),
    'fim', to_char(c.evento_fim, 'HH24:MI'),
    'local', c.evento_local)) end
$$;

-- Igual a 0313, com o aviso de que a assembleia foi cancelada.
create or replace function comunicado_publico_json(c comunicados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'assunto', c.assunto, 'titulo', c.titulo, 'texto', c.texto, 'assinatura', c.assinatura,
    'publicadoEm', c.publicado_em, 'numero', c.numero, 'mudanca', c.mudanca,
    'evento', evento_comunicado_json(c),
    'assembleiaCancelada', case when c.assunto = 'ASSEMBLEIA' and edital_de_assembleia_cancelada(c) then true end,
    'arquivos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
                            from arquivos_comunicado a
                           where a.familia_id = c.familia_id and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb)))
$$;

-- ---------------------------------------------------------------------------------------
-- 2. O evento no publicado.

-- Publicado não se edita (0150): vale também para o evento. Só a correção e a convocação, que
-- gravam o evento logo depois de publicar, ligam a licença, e só dentro da própria chamada.
create function comunicados_evento_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado not in ('RASCUNHO', 'PROGRAMADO')
     and (new.evento_dia, new.evento_inicio, new.evento_fim, new.evento_local)
         is distinct from (old.evento_dia, old.evento_inicio, old.evento_fim, old.evento_local)
     and coalesce(current_setting('triade.evento_comunicado', true), '') <> 'sim' then
    raise exception 'Comunicado publicado não se edita: corrija em uma versão nova' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger comunicados_evento_regras before update on comunicados for each row execute function comunicados_evento_regras();

create function licenca_evento_comunicado(p_ligada boolean) returns void
language sql
set search_path = public
as $$ select set_config('triade.evento_comunicado', case when p_ligada then 'sim' else '' end, true); $$;

alter function plataforma_convocar_assembleia(uuid, uuid, uuid, integer) rename to convocar_assembleia_d440;
alter function convocar_assembleia_d440(uuid, uuid, uuid, integer) security invoker;
-- Igual a 0313, com a licença para gravar o evento no edital já publicado.
create function plataforma_convocar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform licenca_evento_comunicado(true);
  v := convocar_assembleia_d440(p_pessoa, p_condominio, p_id, p_versao);
  perform licenca_evento_comunicado(false);
  return v;
end $$;

alter function plataforma_corrigir_comunicado(uuid, uuid, uuid, integer, text, text, text, boolean, boolean) rename to corrigir_comunicado_d440;
alter function corrigir_comunicado_d440(uuid, uuid, uuid, integer, text, text, text, boolean, boolean) security invoker;
-- Igual a 0313 (a versão nova herda o evento) e, com p_mudar_evento, a versão nova fica com o
-- evento mandado, ou sem nenhum. O edital muda de data só na própria assembleia.
create function plataforma_corrigir_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_texto text, p_mudanca text, p_avisar_email boolean default false,
                                               p_avisar_whatsapp boolean default false, p_mudar_evento boolean default false,
                                               p_evento jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  e comunicados;
begin
  if p_mudar_evento then
    perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.publicar');
    if exists (select 1 from assembleias a join comunicados x on x.id = a.comunicado_id join comunicados c on c.familia_id = x.familia_id
                where c.id = p_id) then
      perform recusar_campos('O dia e o local do edital mudam na própria assembleia', 'evento');
    end if;
    e := evento_comunicado_de(p_evento);
  end if;
  perform licenca_evento_comunicado(true);
  v := corrigir_comunicado_d440(p_pessoa, p_condominio, p_id, p_versao, p_titulo, p_texto, p_mudanca, p_avisar_email, p_avisar_whatsapp);
  if p_mudar_evento then
    update comunicados
       set evento_dia = e.evento_dia, evento_inicio = e.evento_inicio, evento_fim = e.evento_fim, evento_local = e.evento_local
     where id = (v ->> 'id')::uuid
       and (evento_dia, evento_inicio, evento_fim, evento_local) is distinct from (e.evento_dia, e.evento_inicio, e.evento_fim, e.evento_local);
  end if;
  perform licenca_evento_comunicado(false);
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. O evento para a agenda (CD-18).

-- O que a API precisa para montar o arquivo: o aviso, o evento, o condomínio e o fuso.
create function agenda_comunicado_json(c comunicados) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare v_evento jsonb := evento_comunicado_json(c);
begin
  if v_evento is null then raise exception 'Este aviso não tem dia marcado' using errcode = 'TC404'; end if;
  return jsonb_build_object(
    'id', c.id, 'assunto', c.assunto, 'titulo', c.titulo, 'texto', c.texto, 'evento', v_evento,
    'condominio', (select nome from condominios where id = c.condominio_id),
    'fuso', coalesce((select fuso from configuracao_condominio where condominio_id = c.condominio_id), 'America/Sao_Paulo'));
end $$;

-- Pelo mural: o mesmo aviso que o mural mostra (0160), sem contar abertura.
create function publico_mural_agenda(p_codigo text, p_comunicado uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c comunicados;
begin
  perform exigir_mural(p_codigo);
  select * into c from comunicados where id = p_comunicado and estado = 'PUBLICADO' and no_mural and publico = 'TODOS';
  if not found then raise exception 'Comunicado não encontrado' using errcode = 'TC404'; end if;
  return agenda_comunicado_json(c);
end $$;

-- Pelo link pessoal (CD-13): a versão em uso da família, sem marcar o link como aberto.
create function publico_comunicado_agenda(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_publicos;
  c comunicados;
begin
  l := exigir_link_comunicado(p_codigo);
  select * into c from comunicados where familia_id = l.alvo_id and estado = 'PUBLICADO';
  if not found then raise exception 'Comunicado não encontrado' using errcode = 'TC404'; end if;
  return agenda_comunicado_json(c);
end $$;

-- Pela prévia do mural e pela ficha no painel (CD-15).
create function plataforma_comunicado_agenda(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'comunicados.ver');
  return agenda_comunicado_json(exigir_comunicado(p_id));
end $$;

call fechar_acesso();

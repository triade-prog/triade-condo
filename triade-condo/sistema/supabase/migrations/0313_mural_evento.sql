-- Mural do morador no conceito Janela acesa (D4.40; CD-17): o aviso com evento guarda dia, hora e
-- local em campos próprios, além do texto. Com eles, o mural mostra o bloco de data, escolhe o
-- destaque "O que importa agora" (o próximo evento, com a assembleia na frente) e gera "Pôr na
-- agenda" (CD-18). O edital da assembleia já nasce com a data da primeira chamada, a hora das
-- duas chamadas e o local. A correção leva o evento à versão nova. Nada muda para quem não marca
-- evento: os campos ficam vazios e o mural segue como antes.

alter table comunicados
  add column evento_dia    date,
  add column evento_inicio time,
  add column evento_fim    time,
  add column evento_local  text,
  add constraint comunicados_evento_local_check check (evento_local is null or length(btrim(evento_local)) between 2 and 120),
  add constraint comunicados_evento_check check (
    (evento_dia is not null or (evento_inicio is null and evento_fim is null and evento_local is null))
    and (evento_inicio is not null or evento_fim is null)
    and (evento_fim is null or evento_fim > evento_inicio));

-- O evento como vai às telas: {"dia": "2026-10-28", "inicio": "08:00", "fim": "14:00", "local": "…"}, ou nada.
create function evento_comunicado_json(c comunicados) returns jsonb
language sql immutable
set search_path = public
as $$
  select case when c.evento_dia is null then null else jsonb_strip_nulls(jsonb_build_object(
    'dia', to_char(c.evento_dia, 'YYYY-MM-DD'),
    'inicio', to_char(c.evento_inicio, 'HH24:MI'),
    'fim', to_char(c.evento_fim, 'HH24:MI'),
    'local', c.evento_local)) end
$$;

-- Lê o evento vindo da tela e recusa o que não serve, com o nome do campo.
create function evento_comunicado_de(p jsonb) returns comunicados
language plpgsql stable
set search_path = public
as $$
declare
  e comunicados;
  v_campos text[] := '{}';
begin
  if p is null or jsonb_typeof(p) = 'null' then return e; end if;
  if jsonb_typeof(p) <> 'object' then perform recusar_campos('O evento precisa de um dia', 'evento'); end if;
  begin
    if p ->> 'dia' !~ '^\d{4}-\d\d-\d\d$' then raise exception 'dia'; end if;
    e.evento_dia := (p ->> 'dia')::date;
  exception when others then v_campos := array_append(v_campos, 'evento.dia');
  end;
  if e.evento_dia is null and cardinality(v_campos) = 0 then v_campos := array_append(v_campos, 'evento.dia'); end if;
  if p ? 'inicio' and jsonb_typeof(p -> 'inicio') <> 'null' then
    begin
      if p ->> 'inicio' !~ '^\d\d:\d\d$' then raise exception 'hora'; end if;
      e.evento_inicio := (p ->> 'inicio')::time;
    exception when others then v_campos := array_append(v_campos, 'evento.inicio');
    end;
  end if;
  if p ? 'fim' and jsonb_typeof(p -> 'fim') <> 'null' then
    begin
      if p ->> 'fim' !~ '^\d\d:\d\d$' then raise exception 'hora'; end if;
      e.evento_fim := (p ->> 'fim')::time;
    exception when others then v_campos := array_append(v_campos, 'evento.fim');
    end;
    if e.evento_fim is not null and (e.evento_inicio is null or e.evento_fim <= e.evento_inicio) then v_campos := array_append(v_campos, 'evento.fim'); end if;
  end if;
  if p ? 'local' and jsonb_typeof(p -> 'local') <> 'null' then
    e.evento_local := nullif(btrim(p ->> 'local'), '');
    if e.evento_local is not null and length(e.evento_local) not between 2 and 120 then v_campos := array_append(v_campos, 'evento.local'); end if;
  end if;
  if cardinality(v_campos) > 0 then perform recusar_campos('Confira o evento do aviso', variadic v_campos); end if;
  return e;
end $$;

-- O morador vê o evento no mural e no link pessoal (CD-12, CD-13).
create or replace function comunicado_publico_json(c comunicados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'assunto', c.assunto, 'titulo', c.titulo, 'texto', c.texto, 'assinatura', c.assinatura,
    'publicadoEm', c.publicado_em, 'numero', c.numero, 'mudanca', c.mudanca,
    'evento', evento_comunicado_json(c),
    'arquivos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
                            from arquivos_comunicado a
                           where a.familia_id = c.familia_id and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb)))
$$;

-- A ficha e a lista do painel também (0150), sem mudar o resto.
create or replace function comunicado_json(c comunicados, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'familiaId', c.familia_id, 'numero', c.numero, 'assunto', c.assunto, 'titulo', c.titulo, 'estado', c.estado,
    'publico', c.publico,
    'publicoResumo', case c.publico
                       when 'TODOS' then 'Todo o condomínio'
                       when 'BLOCOS' then (select string_agg(b.nome, ', ' order by b.ordem, b.nome) from blocos b where b.id = any (c.blocos))
                       when 'UNIDADES' then cardinality(c.unidades) || case when cardinality(c.unidades) = 1 then ' unidade' else ' unidades' end
                       else cardinality(c.contatos) || case when cardinality(c.contatos) = 1 then ' contato' else ' contatos' end end,
    'destinatarios', c.destinatarios,
    'programadoPara', c.programado_para, 'publicadoEm', c.publicado_em,
    'publicadoPor', (select nome from pessoas where id = c.publicado_por),
    'autor', (select nome from pessoas where id = c.criado_por),
    'pedido', (select jsonb_build_object('id', p.id, 'protocolo', p.protocolo, 'assunto', p.assunto)
                 from pedidos p where p.id = c.pedido_id and pode(p_pessoa, c.condominio_id, 'pedidos.ver') and pedido_visivel(p_pessoa, p)),
    'manutencao', case when pode(p_pessoa, c.condominio_id, 'manutencao.ver') then (
                    select jsonb_build_object('id', m.id, 'titulo', m.titulo, 'estado', m.estado) from manutencoes m where m.id = c.manutencao_id) end,
    'evento', evento_comunicado_json(c),
    'arquivadoEm', c.arquivado_em, 'substituidoEm', c.substituido_em,
    'criadoEm', c.criado_em, 'atualizadoEm', c.atualizado_em, 'versao', c.versao))
$$;

-- ---------------------------------------------------------------------------------------
-- Escrever com o evento (CD-17).

alter function plataforma_salvar_comunicado(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text,
                                            timestamptz, boolean, boolean, boolean) rename to salvar_comunicado_cd17;
alter function salvar_comunicado_cd17(uuid, uuid, uuid, integer, text, text, text, text, uuid[], uuid[], uuid[], uuid, uuid, text,
                                      timestamptz, boolean, boolean, boolean) security invoker;
-- Igual a 0284, com o evento guardado antes de publicar. Sem evento (null), o aviso fica sem
-- dia, hora e local: a tela sempre manda o que está nos campos.
create function plataforma_salvar_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_assunto text,
                                             p_titulo text, p_texto text, p_publico text, p_blocos uuid[], p_unidades uuid[],
                                             p_contatos uuid[], p_pedido uuid, p_manutencao uuid, p_acao text,
                                             p_programado_para timestamptz, p_no_mural boolean default null, p_por_email boolean default null,
                                             p_por_whatsapp boolean default null, p_evento jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  e comunicados;
  v_id uuid;
begin
  e := evento_comunicado_de(p_evento);
  v := salvar_comunicado_cd17(p_pessoa, p_condominio, p_id, p_versao, p_assunto, p_titulo, p_texto, p_publico, p_blocos, p_unidades,
                              p_contatos, p_pedido, p_manutencao, case when p_acao = 'PUBLICAR' then 'RASCUNHO' else p_acao end,
                              p_programado_para, p_no_mural, p_por_email, p_por_whatsapp);
  v_id := (v ->> 'id')::uuid;
  update comunicados
     set evento_dia = e.evento_dia, evento_inicio = e.evento_inicio, evento_fim = e.evento_fim, evento_local = e.evento_local
   where id = v_id
     and (evento_dia, evento_inicio, evento_fim, evento_local) is distinct from (e.evento_dia, e.evento_inicio, e.evento_fim, e.evento_local);
  if p_acao = 'PUBLICAR' then
    perform publicar_comunicado(v_id, p_pessoa, 'PUBLICADO');
  end if;
  return jsonb_build_object('id', v_id, 'versao', (select versao from comunicados where id = v_id));
end $$;

alter function plataforma_corrigir_comunicado(uuid, uuid, uuid, integer, text, text, text, boolean, boolean) rename to corrigir_comunicado_cd17;
alter function corrigir_comunicado_cd17(uuid, uuid, uuid, integer, text, text, text, boolean, boolean) security invoker;
-- Corrigir (0284) leva o evento à versão nova: o dia e o local não se perdem na correção.
create function plataforma_corrigir_comunicado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text,
                                               p_texto text, p_mudanca text, p_avisar_email boolean default false,
                                               p_avisar_whatsapp boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  a comunicados;
begin
  v := corrigir_comunicado_cd17(p_pessoa, p_condominio, p_id, p_versao, p_titulo, p_texto, p_mudanca, p_avisar_email, p_avisar_whatsapp);
  select * into a from comunicados where id = p_id;
  update comunicados
     set evento_dia = a.evento_dia, evento_inicio = a.evento_inicio, evento_fim = a.evento_fim, evento_local = a.evento_local
   where id = (v ->> 'id')::uuid and a.evento_dia is not null;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- O edital já sabe quando e onde é a assembleia (AC-02; CD-17).

alter function plataforma_convocar_assembleia(uuid, uuid, uuid, integer) rename to convocar_assembleia_cd17;
alter function convocar_assembleia_cd17(uuid, uuid, uuid, integer) security invoker;
-- Igual a 0240: depois de convocar, o comunicado do edital recebe o dia da primeira chamada, a
-- hora das duas chamadas (início e fim do bloco) e o local, no fuso do condomínio.
create function plataforma_convocar_assembleia(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  a assembleias;
  v_fuso text;
begin
  v := convocar_assembleia_cd17(p_pessoa, p_condominio, p_id, p_versao);
  select * into a from assembleias where id = p_id;
  v_fuso := fuso_do_condominio();
  update comunicados
     set evento_dia = (a.primeira_chamada at time zone v_fuso)::date,
         evento_inicio = (a.primeira_chamada at time zone v_fuso)::time,
         evento_fim = case when (a.segunda_chamada at time zone v_fuso)::date = (a.primeira_chamada at time zone v_fuso)::date
                             and (a.segunda_chamada at time zone v_fuso)::time > (a.primeira_chamada at time zone v_fuso)::time
                           then (a.segunda_chamada at time zone v_fuso)::time end,
         evento_local = left(coalesce(a.local, case when a.forma = 'ONLINE' then 'Videochamada pelo link pessoal' end), 120)
   where id = a.comunicado_id;
  return v;
end $$;

call fechar_acesso();

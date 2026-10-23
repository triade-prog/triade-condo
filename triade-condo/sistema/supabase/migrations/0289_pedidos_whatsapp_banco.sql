-- 0289 · Pedidos e WhatsApp com banco (área A da rodada com banco do design do frontend; D4.2 e
-- D4.20). Desenho nos quadros 224 a 229 do canvas do novo frontend, aprovado pela Carolina em
-- 23/10/2026, com as decisões A.1 e A.2 recomendadas.
--
-- Regras desta parte:
-- 1. A lista de pedidos tem três ordens: Pede atenção primeiro (a de sempre: encerrados no fim,
--    retorno vencido, prioridade e o retorno mais perto), Mais recentes e Mais antigos (pela hora
--    do registro). Decisão A.1: a escolha fica guardada na pessoa e vale em qualquer aparelho.
-- 2. O pedido registrado a partir das mensagens de A identificar nasce com o canal WhatsApp do
--    condomínio. Na mão, o canal continua fora da lista: só vem com a mensagem.
-- 3. Decisão A.2: registrar e juntar as mensagens vão juntos. Se a junção falha, o registro
--    também não fica (uma função só, uma transação).

-- ---------------------------------------------------------------------------------------
-- 1. A ordem da lista, guardada na pessoa.

alter table pessoas add column ordem_pedidos text not null default 'ATENCAO'
  check (ordem_pedidos in ('ATENCAO', 'RECENTES', 'ANTIGOS'));

create function plataforma_ordem_pedidos(p_pessoa uuid, p_condominio uuid, p_ordem text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if p_ordem is null or p_ordem not in ('ATENCAO', 'RECENTES', 'ANTIGOS') then
    perform recusar_campos('Ordem desconhecida', 'ordem');
  end if;
  update pessoas set ordem_pedidos = p_ordem where id = p_pessoa;
  return jsonb_build_object('ordem', p_ordem);
end $$;

-- A fila (0090) na ordem da pessoa; devolve também qual é.
create or replace function plataforma_pedidos(p_pessoa uuid, p_condominio uuid, p_situacao text, p_responsavel text, p_prioridade uuid,
                                   p_categoria uuid, p_atencao text, p_busca text, p_pagina integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_situacao text := coalesce(p_situacao, 'ATIVOS');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_resp uuid;
  v_ordem text := coalesce((select ordem_pedidos from pessoas where id = p_pessoa), 'ATENCAO');
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  if v_situacao not in ('ATIVOS', 'ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO', 'ENCERRADO', 'CANCELADO', 'TODOS') then
    perform recusar_campos('Situação desconhecida', 'situacao');
  end if;
  if p_atencao is not null and p_atencao not in ('SEM_RESPONSAVEL', 'AGUARDANDO_ACEITE', 'RETORNO_VENCIDO', 'COM_PENDENCIA') then
    perform recusar_campos('Filtro desconhecido', 'atencao');
  end if;
  if p_responsavel is not null and p_responsavel not in ('EU', 'NENHUM') then
    if p_responsavel !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform recusar_campos('Responsável desconhecido', 'responsavel');
    end if;
    v_resp := p_responsavel::uuid;
  end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');

  with lista as (
    select p.*, retorno_vencido(p) as vencido, eh_responsavel(p_pessoa, p) as eu, u.identificacao, u.andar, b.nome as bloco,
           ca.nome as categoria, pr.nome as prioridade, pr.nivel, e.nome as etapa, e.pausa_prazo,
           (select count(*) from pendencias_pedido pp where pp.pedido_id = p.id and pp.resolvida_em is null) as pendencias
      from pedidos p
      join categorias ca on ca.id = p.categoria_id
      join prioridades pr on pr.id = p.prioridade_id
      join etapas e on e.id = p.etapa_id
      left join unidades u on u.id = p.unidade_id
      left join blocos b on b.id = u.bloco_id
     where pedido_visivel(p_pessoa, p)
       and case v_situacao when 'ATIVOS' then p.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')
                           when 'TODOS' then true else p.estado = v_situacao end
       and (p_responsavel is null
            or (p_responsavel = 'EU' and eh_responsavel(p_pessoa, p))
            or (p_responsavel = 'NENHUM' and p.responsavel_id is null)
            or p.responsavel_id = v_resp)
       and (p_prioridade is null or p.prioridade_id = p_prioridade)
       and (p_categoria is null or p.categoria_id = p_categoria)
       and (v_busca is null
            or p.protocolo like v_busca || '%' or p.protocolo like '%-' || v_busca || '%'
            or p.assunto ilike '%' || v_busca || '%'
            or p.local ilike '%' || v_busca || '%'
            or u.identificacao ilike v_busca || '%'
            or b.nome ilike '%' || v_busca || '%')
  ), filtrada as (
    select * from lista l
     where p_atencao is null
        or (p_atencao = 'SEM_RESPONSAVEL' and l.responsavel_id is null and l.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'))
        or (p_atencao = 'AGUARDANDO_ACEITE' and l.responsavel_id is not null and l.aceito_em is null and l.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'))
        or (p_atencao = 'RETORNO_VENCIDO' and l.vencido)
        or (p_atencao = 'COM_PENDENCIA' and l.pendencias > 0)
  ), ordenada as (
    select f.*, row_number() over (
             order by case when v_ordem = 'RECENTES' then f.criado_em end desc,
                      case when v_ordem = 'ANTIGOS' then f.criado_em end,
                      f.estado in ('ENCERRADO', 'CANCELADO'), f.vencido desc, f.nivel desc,
                      coalesce(f.proximo_retorno, 'infinity'::timestamptz), coalesce(f.encerrado_em, f.cancelado_em) desc nulls last, f.criado_em,
                      f.id) as ordem
      from filtrada f
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
               'id', o.id, 'protocolo', o.protocolo, 'assunto', o.assunto, 'estado', o.estado, 'privado', o.privado,
               'unidade', case when o.unidade_id is not null then nome_da_unidade(o.bloco, o.andar, o.identificacao) end,
               'local', o.local, 'categoria', o.categoria, 'prioridade', jsonb_build_object('nome', o.prioridade, 'nivel', o.nivel),
               'etapa', jsonb_build_object('nome', o.etapa, 'pausaPrazo', o.pausa_prazo),
               'responsavel', case when o.responsavel_id is not null then jsonb_build_object(
                                'vinculoId', o.responsavel_id, 'nome', nome_do_vinculo(o.responsavel_id), 'eu', o.eu) end,
               'aceito', o.aceito_em is not null, 'abertoEm', o.criado_em, 'encerradoEm', coalesce(o.encerrado_em, o.cancelado_em),
               'proximoRetorno', o.proximo_retorno, 'retornoVencido', o.vencido, 'previsao', to_char(o.previsao, 'YYYY-MM-DD'),
               'pendencias', o.pendencias) order by o.ordem)
             from ordenada o where o.ordem > (v_pagina - 1) * 50 and o.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from filtrada),
    'pagina', v_pagina,
    'porPagina', 50,
    'ordem', v_ordem,
    'resumo', resumo_pedidos(p_pessoa),
    'agora', app_now())
    into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 2 e 3. Registrar com as mensagens do WhatsApp.

-- O registro de sempre (0090, renomeado na 0281) aceita o canal WhatsApp do condomínio só quando
-- vem de plataforma_registrar_pedido_whatsapp, que marca a transação.
create or replace function registrar_pedido_r13(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_contato uuid, p_local text,
                                            p_categoria uuid, p_prioridade uuid, p_assunto text, p_descricao text, p_canal text,
                                            p_privado boolean, p_responsavel uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resp uuid := p_responsavel;
  v_ano integer;
  v_numero integer;
  v_protocolo text;
  v_id uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.atualizar');
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  if p_unidade is null and nullif(btrim(coalesce(p_local, '')), '') is null then
    perform recusar_campos('Informe a unidade ou o local', 'unidadeId', 'local');
  end if;
  if p_contato is not null and p_unidade is null then perform recusar_campos('Escolha a unidade de quem pediu', 'unidadeId'); end if;
  if p_canal is null or (p_canal not in ('TELEFONE', 'PRESENCIAL', 'MENSAGEM', 'EMAIL', 'OBSERVACAO', 'OUTRO')
                         and not (p_canal = 'WHATSAPP' and coalesce(current_setting('triade.registro_whatsapp', true), '') = 'sim')) then
    perform recusar_campos('Diga como o pedido chegou', 'canal');
  end if;
  if v_resp is null then
    select responsavel_padrao into v_resp from configuracao_condominio;
    if not responsavel_disponivel(v_resp) then v_resp := null; end if;
  elsif not responsavel_disponivel(v_resp) then
    perform recusar_motivo('Escolha um responsável disponível', 'RESPONSAVEL_INDISPONIVEL');
  end if;

  v_ano := extract(year from hoje_no_condominio())::integer;
  insert into protocolos_pedido as x (condominio_id, ano, ultimo) values (p_condominio, v_ano, 1)
  on conflict (condominio_id, ano) do update set ultimo = x.ultimo + 1
  returning ultimo into v_numero;
  v_protocolo := v_ano || '-' || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;

  perform definir_transicao('REGISTRADO');
  begin
    insert into pedidos (condominio_id, protocolo, unidade_id, contato_id, local, categoria_id, prioridade_id, etapa_id,
                         assunto, descricao, canal, privado, estado, responsavel_id, responsavel_desde, aceito_em,
                         proximo_retorno, criado_por)
    values (p_condominio, v_protocolo, p_unidade, p_contato, nullif(btrim(coalesce(p_local, '')), ''), p_categoria, p_prioridade,
            coalesce(etapa_inicial(p_categoria, 'ABERTO'), etapa_inicial(null, 'ABERTO')),
            btrim(p_assunto), btrim(p_descricao), p_canal, coalesce(p_privado, false), 'ABERTO',
            v_resp, case when v_resp is not null then app_now() end,
            case when exists (select 1 from vinculos where id = v_resp and pessoa_id = p_pessoa) then app_now() end,
            calcular_proximo_retorno(p_categoria, p_prioridade), p_pessoa)
    returning id into v_id;
  exception
    when foreign_key_violation then perform recusar_campos('Categoria, prioridade ou contato não encontrado', 'categoriaId', 'prioridadeId', 'contatoId');
    when check_violation or not_null_violation then
      perform recusar_campos('Confira o assunto (3 a 120 caracteres), a descrição (3 a 4000) e o local', 'assunto', 'descricao', 'local');
  end;
  perform registrar_historico('pedido.registrado', 'pedidos', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'protocolo', v_protocolo, 'canal', p_canal, 'privado', case when coalesce(p_privado, false) then true end, 'responsavel', v_resp)));
  return jsonb_build_object('id', v_id, 'protocolo', v_protocolo, 'versao', 1);
end $$;

-- "Chegou pelo WhatsApp do condomínio", na frase do protocolo (0281).
create or replace function canal_na_frase(p_canal text) returns text
language sql immutable
set search_path = public
as $$
  select case p_canal when 'TELEFONE' then 'por telefone' when 'PRESENCIAL' then 'pessoalmente' when 'MENSAGEM' then 'por mensagem'
                      when 'EMAIL' then 'por e-mail' when 'OBSERVACAO' then 'por quem cuida do prédio'
                      when 'WHATSAPP' then 'pelo WhatsApp do condomínio' else 'ao condomínio' end
$$;

-- Registra o pedido com o canal WhatsApp do condomínio e junta as mensagens do número na mesma
-- transação: se a junção falha (mensagem já tratada, sem permissão no WhatsApp), nada fica.
create function plataforma_registrar_pedido_whatsapp(p_pessoa uuid, p_condominio uuid, p_mensagem uuid, p_unidade uuid,
                                                     p_contato uuid, p_local text, p_categoria uuid, p_prioridade uuid,
                                                     p_assunto text, p_descricao text, p_privado boolean, p_responsavel uuid,
                                                     p_avisar jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_juntou jsonb;
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if p_mensagem is null or not exists (select 1 from mensagens_whatsapp where id = p_mensagem and triagem in ('A_IDENTIFICAR', 'RECADO')) then
    raise exception 'Mensagem não encontrada' using errcode = 'TC404';
  end if;
  perform set_config('triade.registro_whatsapp', 'sim', true);
  v := plataforma_registrar_pedido(p_pessoa, p_condominio, p_unidade, p_contato, p_local, p_categoria, p_prioridade, p_assunto,
                                   p_descricao, 'WHATSAPP', p_privado, p_responsavel, p_avisar);
  perform set_config('triade.registro_whatsapp', '', true);
  v_juntou := plataforma_triar_whatsapp(p_pessoa, p_condominio, p_mensagem, 'PEDIDO', null, (v ->> 'id')::uuid, null);
  return v || jsonb_build_object('juntou', true, 'mensagens', v_juntou -> 'tratadas');
end $$;

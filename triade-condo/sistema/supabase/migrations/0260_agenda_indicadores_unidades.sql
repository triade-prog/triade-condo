-- 0260 · Datas de outras telas na Agenda, dois indicadores novos e unidades à venda ou para alugar
-- (AG-09, TR-01, MU-11). Telas e decisões aprovadas pela Carolina em 19/10/2026
-- (docs/telas/agenda-indicadores-unidades.html).
--
-- Regras desta parte:
-- 1. O vencimento do contrato de um prestador (prestadores.contrato_ate) e a validade de um
--    documento (documentos.vale_ate) entram na Agenda no dia, sem horário. A assembleia convocada
--    ou em andamento entra no horário da 1ª chamada, com a 2ª ao lado. Rascunho e cancelada não
--    entram. Nada disso se edita na Agenda: a data leva à tela de origem.
-- 2. Cada data só aparece para quem pode ver a tela de origem: contratos para quem vê a
--    Manutenção, documentos para quem vê os documentos (o restrito, só para quem vê os
--    restritos), assembleias para quem vê as assembleias.
-- 3. Pendências por responsável são de agora: pedidos abertos ou em andamento, pelo responsável
--    de hoje, com quantos têm o retorno vencido e a idade do mais antigo.
-- 4. Tempo de solução por categoria usa o período escolhido: pedidos concluídos no período, da
--    abertura até a conclusão, em horas corridas. Tempo típico é a mediana; o mais demorado vai
--    ao lado. O pedido reaberto conta da primeira abertura até a última conclusão.
-- 5. Quem cuida dos moradores marca e desmarca a unidade à venda e para alugar. Cada mudança fica
--    no histórico da unidade. A marca aparece só na Plataforma, nunca no mural nem ao morador.

-- ---------------------------------------------------------------------------------------
-- Datas de outras telas na Agenda (AG-09, AC-02).

create or replace function plataforma_agenda(p_pessoa uuid, p_condominio uuid, p_de date, p_ate date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'agenda.ver');
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then
    perform recusar_campos('Período de até 93 dias', 'de', 'ate');
  end if;
  return jsonb_build_object(
    'compromissos', coalesce((
      select jsonb_agg(compromisso_json(c, p_pessoa) order by c.data, c.hora_inicio nulls first, c.titulo)
        from compromissos c where c.data between p_de and p_ate), '[]'::jsonb),
    'datas', coalesce((
      select jsonb_agg(x.d order by x.data, x.hora nulls first, x.titulo)
        from (
          select f.data, null::text as hora, f.descricao as titulo,
                 jsonb_build_object('data', to_char(f.data, 'YYYY-MM-DD'), 'titulo', f.descricao, 'fonte', 'FERIADO') as d
            from feriados f where f.data between p_de and p_ate and pode(p_pessoa, p_condominio, 'config.ver')
          union all
          select p.proxima_data, null, p.atividade,
                 jsonb_build_object('data', to_char(p.proxima_data, 'YYYY-MM-DD'), 'titulo', p.atividade, 'fonte', 'PREVENTIVA',
                                    'id', p.id)
            from preventivas p where p.ativa and p.proxima_data between p_de and p_ate and pode(p_pessoa, p_condominio, 'manutencao.ver')
          union all
          select r.data, to_char(r.hora_inicio, 'HH24:MI'), a.nome,
                 jsonb_build_object('data', to_char(r.data, 'YYYY-MM-DD'), 'titulo', a.nome || ' · ' || rotulo_unidade(r.unidade_id),
                                    'fonte', 'RESERVA', 'id', r.id, 'horaInicio', to_char(r.hora_inicio, 'HH24:MI'),
                                    'horaFim', to_char(r.hora_fim, 'HH24:MI'),
                                    'quem', (select ct.nome from contatos ct where ct.id = r.contato_id and ct.dados_removidos_em is null))
            from reservas r join areas_comuns a on a.id = r.area_id
           where r.estado = 'CONFIRMADA' and r.data between p_de and p_ate and pode(p_pessoa, p_condominio, 'reservas.ver')
          union all
          -- Decisão 1: o vencimento do contrato é data do dia.
          select p.contrato_ate, null, p.nome,
                 jsonb_build_object('data', to_char(p.contrato_ate, 'YYYY-MM-DD'), 'titulo', p.nome, 'fonte', 'CONTRATO', 'id', p.id)
            from prestadores p
           where p.arquivado_em is null and p.acordo = 'CONTRATO' and p.contrato_ate between p_de and p_ate
             and pode(p_pessoa, p_condominio, 'manutencao.ver')
          union all
          -- Decisão 2: o documento restrito só para quem vê os restritos.
          select d.vale_ate, null, d.titulo,
                 jsonb_build_object('data', to_char(d.vale_ate, 'YYYY-MM-DD'), 'titulo', d.titulo, 'fonte', 'DOCUMENTO', 'id', d.id,
                                    'restrito', d.restrito)
            from documentos d
           where d.arquivado_em is null and d.vale_ate between p_de and p_ate and pode(p_pessoa, p_condominio, 'documentos.ver')
             and (not d.restrito or pode(p_pessoa, p_condominio, 'documentos.restritos'))
          union all
          -- Decisão 3: convocada ou em andamento, no horário da 1ª chamada.
          select (a.primeira_chamada at time zone v_fuso)::date, to_char(a.primeira_chamada at time zone v_fuso, 'HH24:MI'), a.titulo,
                 jsonb_strip_nulls(jsonb_build_object(
                   'data', to_char(a.primeira_chamada at time zone v_fuso, 'YYYY-MM-DD'), 'titulo', a.titulo, 'fonte', 'ASSEMBLEIA',
                   'id', a.id, 'horaInicio', to_char(a.primeira_chamada at time zone v_fuso, 'HH24:MI'),
                   'segundaChamada', to_char(a.segunda_chamada at time zone v_fuso, 'HH24:MI'), 'local', a.local,
                   'estado', a.estado))
            from assembleias a
           where a.estado in ('CONVOCADA', 'EM_ANDAMENTO')
             and (a.primeira_chamada at time zone v_fuso)::date between p_de and p_ate
             and pode(p_pessoa, p_condominio, 'assembleias.ver')
        ) x), '[]'::jsonb),
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar')));
end $$;

-- ---------------------------------------------------------------------------------------
-- Pendências por responsável e tempo de solução por categoria (TR-01, TR-03, TR-07).

-- Decisão 5: o estado de agora, não o período.
create function pendencias_por_responsavel() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'responsavelId', x.responsavel_id, 'nome', x.nome, 'abertos', x.abertos, 'retornoVencido', x.vencidos,
           'maisAntigoDias', x.dias)
         order by x.responsavel_id is null, x.abertos desc, lower(x.nome)), '[]'::jsonb)
    from (select p.responsavel_id, (select pe.nome from vinculos v join pessoas pe on pe.id = v.pessoa_id where v.id = p.responsavel_id) as nome,
                 count(*) as abertos,
                 count(*) filter (where p.proximo_retorno < app_now()) as vencidos,
                 hoje_no_condominio() - min((p.criado_em at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'))::date) as dias
            from pedidos p
           where p.estado in ('ABERTO', 'EM_ANDAMENTO')
           group by p.responsavel_id) x
$$;

-- Decisão 6: tempo típico pela mediana, com o mais demorado ao lado. Sem pedido concluído, a
-- categoria vem sem número ("sem dados"), nunca zero.
create function solucao_por_categoria(p_de date, p_ate date) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_fuso text := coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo');
  v_ini timestamptz := p_de::timestamp at time zone v_fuso;
  v_fim timestamptz := (p_ate + 1)::timestamp at time zone v_fuso;
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('categoriaId', c.id, 'nome', c.nome, 'concluidos', coalesce(s.n, 0),
                                        'medianaHoras', s.mediana, 'maisDemoradoHoras', s.maximo)
                     order by lower(c.nome))
      from categorias c
      left join (select p.categoria_id, count(*) as n,
                        round((percentile_cont(0.5) within group (order by extract(epoch from p.encerrado_em - p.criado_em) / 3600))::numeric, 1) as mediana,
                        round((max(extract(epoch from p.encerrado_em - p.criado_em)) / 3600)::numeric, 1) as maximo
                   from pedidos p
                  where p.estado = 'ENCERRADO' and p.encerrado_em >= v_ini and p.encerrado_em < v_fim
                  group by p.categoria_id) s on s.categoria_id = c.id
     where c.ativa or s.n is not null), '[]'::jsonb);
end $$;

create or replace function plataforma_indicadores(p_pessoa uuid, p_condominio uuid, p_periodo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date;
  v_mes date;
  v_de date;
  v_ate date;
  v_meses integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v_hoje := hoje_no_condominio();
  v_mes := date_trunc('month', v_hoje)::date;
  case coalesce(p_periodo, 'ESTE_MES')
    when 'ESTE_MES' then v_de := v_mes; v_ate := v_hoje; v_meses := 1;
    when 'MES_PASSADO' then v_de := (v_mes - interval '1 month')::date; v_ate := v_mes - 1; v_meses := 1;
    when 'TRES_MESES' then v_de := (v_mes - interval '2 months')::date; v_ate := v_hoje; v_meses := 3;
    else perform recusar_campos('Período desconhecido', 'periodo');
  end case;
  return jsonb_build_object(
    'periodo', coalesce(p_periodo, 'ESTE_MES'),
    'atual', indicadores_atendimento(v_de, v_ate),
    'porcentagemAnterior', indicadores_atendimento((v_de - make_interval(months => v_meses))::date, v_de - 1) -> 'retornos' -> 'porcentagem',
    'pendencias', pendencias_por_responsavel(),
    'solucao', solucao_por_categoria(v_de, v_ate));
end $$;

-- ---------------------------------------------------------------------------------------
-- Unidades à venda e para alugar (MU-11).

alter table unidades
  add column a_venda_desde     date,
  add column para_alugar_desde date;

alter function plataforma_unidades(uuid, uuid) rename to unidades_r3;
alter function unidades_r3(uuid, uuid) security invoker;
-- A lista (0110) com as duas marcas em cada unidade e os dois contadores do topo.
create function plataforma_unidades(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := unidades_r3(p_pessoa, p_condominio);
  return v || jsonb_build_object(
    'unidades', coalesce((
      select jsonb_agg(x.item || jsonb_build_object('aVenda', u.a_venda_desde is not null, 'paraAlugar', u.para_alugar_desde is not null)
                       order by x.n)
        from jsonb_array_elements(v -> 'unidades') with ordinality x(item, n)
        join unidades u on u.id = (x.item ->> 'id')::uuid), '[]'::jsonb),
    'ocupacao', (v -> 'ocupacao') || (
      select jsonb_build_object('aVenda', count(*) filter (where a_venda_desde is not null),
                                'paraAlugar', count(*) filter (where para_alugar_desde is not null))
        from unidades where ativa));
end $$;

alter function plataforma_unidade(uuid, uuid, uuid) rename to unidade_detalhe_r2;
alter function unidade_detalhe_r2(uuid, uuid, uuid) security invoker;
-- A unidade (0160) com desde quando está à venda e para alugar.
create function plataforma_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  u unidades;
begin
  v := unidade_detalhe_r2(p_pessoa, p_condominio, p_unidade);
  u := exigir_unidade(p_unidade);
  return v || jsonb_build_object('unidade', (v -> 'unidade') || jsonb_build_object(
    'aVendaDesde', to_char(u.a_venda_desde, 'YYYY-MM-DD'), 'paraAlugarDesde', to_char(u.para_alugar_desde, 'YYYY-MM-DD')));
end $$;

-- Marcar ou desmarcar à venda e para alugar. A data de quando foi marcada fica até desmarcar.
create function plataforma_marcar_unidade(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_a_venda boolean, p_para_alugar boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes unidades;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.editar');
  v_antes := exigir_unidade(p_id);
  if not v_antes.ativa then perform recusar_motivo('Unidade desativada', 'UNIDADE_INATIVA'); end if;
  if p_a_venda is null or p_para_alugar is null then perform recusar_campos('Diga se está à venda e se está para alugar', 'aVenda', 'paraAlugar'); end if;
  if v_antes.versao <> p_versao then perform conflito_versao('unidades', p_id); end if;
  if (v_antes.a_venda_desde is not null) = p_a_venda and (v_antes.para_alugar_desde is not null) = p_para_alugar then
    return v_antes.versao;
  end if;
  update unidades
     set a_venda_desde = case when p_a_venda then coalesce(a_venda_desde, hoje_no_condominio()) end,
         para_alugar_desde = case when p_para_alugar then coalesce(para_alugar_desde, hoje_no_condominio()) end
   where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('unidades', p_id); end if;
  perform registrar_historico('unidade.situacao_mudou', 'unidade', p_id::text, jsonb_build_object('aVenda', p_a_venda, 'paraAlugar', p_para_alugar));
  return v_versao;
end $$;

call fechar_acesso();

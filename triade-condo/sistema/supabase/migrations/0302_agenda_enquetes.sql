-- 0302 · Enquetes abertas na Agenda (R7.2; AG-09). Telas e decisões aprovadas pela Carolina em
-- 24/10/2026 (quadros 380 a 383 do canvas do novo frontend).
--
-- Regras desta parte:
-- 1. A enquete aberta entra na Agenda no dia e na hora em que fecha (aberta_ate, no fuso do
--    condomínio), com quantos responderam de quantos convidados. Nada se edita na Agenda: a data
--    leva à ficha da enquete (decisão A.1).
-- 2. A Agenda devolve também todas as enquetes abertas, para a faixa "Enquetes abertas agora" no
--    alto da Lista, mesmo as que fecham depois do período mostrado (decisão A.1).
-- 3. A enquete encerrada antes do prazo deixa de estar aberta e sai da Agenda (decisão C.1).
-- 4. Só para quem vê as enquetes. Na secreta, só a contagem: a escolha de cada unidade nunca vem.
--    O lembrete automático não vira data na Agenda.

-- O que a Agenda mostra de uma enquete aberta: só contagens, nunca o que alguém escolheu.
create function enquete_na_agenda(e enquetes, p_fuso text) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'titulo', e.pergunta,
    'data', to_char(e.aberta_ate at time zone p_fuso, 'YYYY-MM-DD'),
    'horaInicio', to_char(e.aberta_ate at time zone p_fuso, 'HH24:MI'),
    'por', e.por, 'secreta', e.secreta,
    'responderam', (select count(*) from convites_enquete ce where ce.enquete_id = e.id and ce.respondeu_em is not null),
    'total', (select count(*) from convites_enquete ce where ce.enquete_id = e.id))
$$;

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
          union all
          -- Decisão A.1: a enquete aberta entra no dia e na hora em que fecha. Decisão C.1: a
          -- encerrada antes do prazo já não está aberta e sai.
          select (e.aberta_ate at time zone v_fuso)::date, to_char(e.aberta_ate at time zone v_fuso, 'HH24:MI'), e.pergunta,
                 enquete_na_agenda(e, v_fuso) || jsonb_build_object('fonte', 'ENQUETE')
            from enquetes e
           where enquete_aberta(e)
             and (e.aberta_ate at time zone v_fuso)::date between p_de and p_ate
             and pode(p_pessoa, p_condominio, 'enquetes.ver')
        ) x), '[]'::jsonb),
    -- Decisão A.1: todas as abertas, para a faixa do alto da Lista, fechem quando fecharem.
    'enquetesAbertas', case when pode(p_pessoa, p_condominio, 'enquetes.ver') then coalesce((
      select jsonb_agg(enquete_na_agenda(e, v_fuso) order by e.aberta_ate, e.pergunta)
        from enquetes e where enquete_aberta(e)), '[]'::jsonb) else '[]'::jsonb end,
    'hoje', to_char(hoje_no_condominio(), 'YYYY-MM-DD'),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'agenda.editar'),
                              'enquetes', pode(p_pessoa, p_condominio, 'enquetes.ver')));
end $$;

call fechar_acesso();

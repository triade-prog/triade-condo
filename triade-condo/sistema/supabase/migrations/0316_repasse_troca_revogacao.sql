-- D4.37 · Revogar sem deixar nada preso (CF-04, CF-05, CT-01, MP-01, MP-03, AT-11, AT-23).
-- Proposta enviada à Carolina em 27/10/2026 (painel D4.37).
-- 1. A troca de síndico no Console (0190) passa tudo do síndico anterior para o novo: pedidos,
--    pendências, manutenções, preventivas, quem executa, o lugar em quem atende, o responsável
--    padrão da fila, as decisões e despesas que esperavam por ele; e encerra a ausência dele.
--    A versão da 0190 passa a ser console_trocar_sindico_d437.
-- 2. Revogar uma pessoa autorizada (0297) passa também as pendências no nome dela, quem executa e
--    as decisões e despesas que esperavam por ela.
-- 3. revogar_vinculo (0040), que nenhuma rota chama, não revoga quem ainda tem algo em aberto.

-- ---------------------------------------------------------------------------------------
-- O repasse marca a transação com o vínculo que sai. Só com essa marca, e só enquanto o item está
-- aberto, a pendência muda de responsável e a decisão ou a despesa muda de quem decide.

create function em_repasse_de(p_vinculo uuid) returns boolean
language sql stable
set search_path = public
as $$ select p_vinculo is not null and coalesce(current_setting('app.repasse_vinculo', true), '') = p_vinculo::text $$;

create or replace function pendencias_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id then
    if not exists (select 1 from vinculos where id = new.responsavel_id and funcao in ('SINDICO', 'AUTORIZADO') and revogado_em is null) then
      raise exception 'O responsável da pendência é o síndico ou uma pessoa autorizada' using errcode = 'TC422',
        detail = '{"motivo":"RESPONSAVEL_INVALIDO"}';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
       old.resolvida_em is not null
       or (new.condominio_id, new.pedido_id, new.tipo, new.motivo, new.aberta_em, new.aberta_por)
          is distinct from (old.condominio_id, old.pedido_id, old.tipo, old.motivo, old.aberta_em, old.aberta_por)
       or (new.responsavel_id is distinct from old.responsavel_id
           and (new.resolvida_em is not null or not em_repasse_de(old.responsavel_id)))) then
    raise exception 'Pendência só muda para resolvida' using errcode = 'TC422';
  end if;
  return new;
end $$;

create or replace function decisoes_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.pedido_id, new.pendencia_id, new.pergunta, new.porque, new.prazo, new.pedida_em, new.pedida_por)
     is distinct from (old.condominio_id, old.pedido_id, old.pendencia_id, old.pergunta, old.porque, old.prazo, old.pedida_em, old.pedida_por)
     or old.estado <> 'AGUARDANDO'
     or (new.decisor_id is distinct from old.decisor_id and (new.estado <> 'AGUARDANDO' or not em_repasse_de(old.decisor_id))) then
    raise exception 'Pedido de decisão enviado não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;

create or replace function despesas_aprovacao_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.pedida_em, new.pedida_por, new.titulares, new.votos_necessarios, new.alcada)
     is distinct from (old.condominio_id, old.pedida_em, old.pedida_por, old.titulares, old.votos_necessarios, old.alcada) then
    raise exception 'A despesa pedida não muda de origem' using errcode = 'TC422';
  end if;
  if (new.modo, new.decisor_id) is distinct from (old.modo, old.decisor_id)
     and not (old.modo = 'CONSELHO' and new.modo = 'PESSOA' and old.estado = 'AGUARDANDO' and new.voltou_ao_sindico_em is not null)
     and not (old.modo = 'PESSOA' and new.modo = 'PESSOA' and old.estado = 'AGUARDANDO' and new.estado = 'AGUARDANDO'
              and em_repasse_de(old.decisor_id)) then
    raise exception 'Quem aprova não muda' using errcode = 'TC422';
  end if;
  if old.estado <> 'AGUARDANDO'
     and ((new.descricao, new.valor, new.prestador_id, new.fornecedor, new.vencimento, new.pedido_id, new.manutencao_id, new.decisao_id,
           new.prazo, new.estado, new.respondida_em, new.respondida_por, new.respondida_membro_id, new.justificativa, new.retirada_motivo)
          is distinct from
          (old.descricao, old.valor, old.prestador_id, old.fornecedor, old.vencimento, old.pedido_id, old.manutencao_id, old.decisao_id,
           old.prazo, old.estado, old.respondida_em, old.respondida_por, old.respondida_membro_id, old.justificativa, old.retirada_motivo)) then
    raise exception 'Despesa decidida não muda' using errcode = 'TC422';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------
-- O que fica com um vínculo além dos pedidos e das manutenções de que ele é responsável:
-- - as decisões e despesas aguardando por ele vão para p_decisor (a pendência da decisão vai junto,
--   e quem passa a decidir recebe o aviso);
-- - as outras pendências abertas no nome dele vão para p_pendencias;
-- - onde ele é quem executa (manutenção em aberto, preventiva ativa, providência ainda não feita
--   de manutenção em aberto), passa a ser p_executor; sem p_executor, fica sem quem executa.
-- Pendência e decisão sempre têm alguém: sem para quem passar, recusa. Devolve as quantidades
-- para o registro do repasse (sem nomes).
create function repassar_resto_do_vinculo(p_de uuid, p_pendencias uuid, p_executor uuid, p_decisor uuid, p_motivo text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_saida jsonb := '{}'::jsonb;
  v_d integer := 0;
  v_x integer := 0;
  v_p integer := 0;
  v_e integer := 0;
  v_ep integer := 0;
  v_ev integer := 0;
  r record;
begin
  if (exists (select 1 from decisoes_pedido where decisor_id = p_de and estado = 'AGUARDANDO')
      or exists (select 1 from despesas_aprovacao where decisor_id = p_de and estado = 'AGUARDANDO' and modo = 'PESSOA'))
     and (p_decisor is null or p_decisor = p_de) then
    perform recusar_motivo('Não há síndico para assumir as decisões que esperam por esta pessoa', 'SEM_QUEM_ASSUME');
  end if;
  perform set_config('app.repasse_vinculo', p_de::text, true);

  for r in select id, pedido_id, pendencia_id from decisoes_pedido where decisor_id = p_de and estado = 'AGUARDANDO' order by id loop
    v_d := v_d + 1;
    update decisoes_pedido set decisor_id = p_decisor where id = r.id;
    update pendencias_pedido set responsavel_id = p_decisor where id = r.pendencia_id and responsavel_id = p_de and resolvida_em is null;
    perform registrar_historico('pedido.decisao_repassada', 'pedidos', r.pedido_id::text,
      jsonb_build_object('decisao', r.id, 'de', p_de, 'para', p_decisor, 'motivo', p_motivo));
    perform avisar_decisao(pessoa_do_vinculo(p_decisor), r.id, 'PEDIDA');
  end loop;
  for r in select id from despesas_aprovacao where decisor_id = p_de and estado = 'AGUARDANDO' and modo = 'PESSOA' order by id loop
    v_x := v_x + 1;
    update despesas_aprovacao set decisor_id = p_decisor where id = r.id;
    perform registrar_historico('despesa.repassada', 'despesas_aprovacao', r.id::text,
      jsonb_build_object('de', p_de, 'para', p_decisor, 'motivo', p_motivo));
    perform avisar_aprovacao(pessoa_do_vinculo(p_decisor), 'DESPESA_PEDIDA', r.id, null, null);
  end loop;
  if v_d + v_x > 0 then
    v_saida := jsonb_build_object('decisoes', jsonb_build_object('para', p_decisor, 'quantidade', v_d, 'despesas', v_x));
  end if;

  if exists (select 1 from pendencias_pedido where responsavel_id = p_de and resolvida_em is null) then
    if p_pendencias is null or p_pendencias = p_de then
      perform recusar_motivo('Não há síndico para assumir as pendências desta pessoa', 'SEM_QUEM_ASSUME');
    end if;
    for r in select id, pedido_id, tipo from pendencias_pedido where responsavel_id = p_de and resolvida_em is null order by id loop
      v_p := v_p + 1;
      update pendencias_pedido set responsavel_id = p_pendencias where id = r.id;
      perform registrar_historico('pedido.pendencia_repassada', 'pedidos', r.pedido_id::text,
        jsonb_build_object('pendencia', r.id, 'tipo', r.tipo, 'de', p_de, 'para', p_pendencias, 'motivo', p_motivo));
    end loop;
    v_saida := v_saida || jsonb_build_object('pendencias', jsonb_build_object('para', p_pendencias, 'quantidade', v_p));
  end if;
  perform set_config('app.repasse_vinculo', '', true);

  for r in select id from manutencoes where executor_vinculo = p_de and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by id loop
    v_e := v_e + 1;
    update manutencoes set executor_vinculo = p_executor where id = r.id;
    perform registrar_historico('manutencao.alterada', 'manutencoes', r.id::text, jsonb_strip_nulls(jsonb_build_object(
      'campos', jsonb_build_array('executor'), 'de', p_de, 'para', p_executor, 'motivo', p_motivo)));
  end loop;
  for r in select id from preventivas where executor_vinculo = p_de and ativa order by id loop
    v_ep := v_ep + 1;
    update preventivas set executor_vinculo = p_executor where id = r.id;
    perform registrar_historico('preventiva.alterada', 'preventivas', r.id::text, jsonb_strip_nulls(jsonb_build_object(
      'campos', jsonb_build_array('executor'), 'de', p_de, 'para', p_executor, 'motivo', p_motivo)));
  end loop;
  for r in select x.id, x.manutencao_id from providencias_manutencao x join manutencoes m on m.id = x.manutencao_id
            where x.executor_vinculo = p_de and x.feita_em is null and m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by x.id loop
    v_ev := v_ev + 1;
    update providencias_manutencao set executor_vinculo = p_executor where id = r.id;
    perform registrar_historico('manutencao.alterada', 'manutencoes', r.manutencao_id::text, jsonb_strip_nulls(jsonb_build_object(
      'campos', jsonb_build_array('providencia'), 'providencia', r.id, 'de', p_de, 'para', p_executor, 'motivo', p_motivo)));
  end loop;
  if v_e + v_ep + v_ev > 0 then
    v_saida := v_saida || jsonb_build_object('execucoes',
      jsonb_build_object('para', p_executor, 'manutencoes', v_e, 'preventivas', v_ep, 'providencias', v_ev));
  end if;
  return v_saida;
end $$;

-- Algo em aberto com o vínculo: o que o repasse passaria adiante.
create function vinculo_com_algo_em_aberto(p_vinculo uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from pedidos where responsavel_id = p_vinculo and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO'))
      or exists (select 1 from pendencias_pedido where responsavel_id = p_vinculo and resolvida_em is null)
      or exists (select 1 from manutencoes where p_vinculo in (responsavel_id, executor_vinculo) and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
      or exists (select 1 from preventivas where p_vinculo in (responsavel_id, executor_vinculo) and ativa)
      or exists (select 1 from providencias_manutencao x join manutencoes m on m.id = x.manutencao_id
                  where x.executor_vinculo = p_vinculo and x.feita_em is null and m.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
      or exists (select 1 from decisoes_pedido where decisor_id = p_vinculo and estado = 'AGUARDANDO')
      or exists (select 1 from despesas_aprovacao where decisor_id = p_vinculo and estado = 'AGUARDANDO' and modo = 'PESSOA')
      or exists (select 1 from responsaveis_atendimento where vinculo_id = p_vinculo and retirado_em is null)
      or exists (select 1 from configuracao_condominio where responsavel_padrao = p_vinculo)
$$;

-- ---------------------------------------------------------------------------------------
-- 1. Troca de síndico: o novo assume tudo do anterior.
-- Depois da troca da 0190 (que confere, revoga o anterior e cria o novo): o novo entra em quem
-- atende no lugar do anterior (com a mesma disponibilidade) antes de receber os pedidos, e vira o
-- responsável padrão se o anterior era; só então o anterior sai da lista (o gatilho da 0090 não
-- acha mais pedido para repassar). As manutenções e preventivas passam, e o resto vai pelo
-- repasse comum. A ausência aberta do anterior se encerra: o substituto respondia por ele.
-- "sindico.repasse" diz quantos itens passaram (sem nomes), e a resposta ganha o mesmo resumo.
alter function console_trocar_sindico(uuid, uuid, uuid, integer, uuid, text, text, text, text[]) rename to console_trocar_sindico_d437;
alter function console_trocar_sindico_d437(uuid, uuid, uuid, integer, uuid, text, text, text, text[]) security invoker;
create function console_trocar_sindico(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer, p_novo uuid,
                                       p_nome text, p_pedido_por text, p_canal text, p_conferido text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r jsonb;
  v_novo uuid;
  v_lugar responsaveis_atendimento;
  v_repasse jsonb := '{}'::jsonb;
  v_n integer := 0;
  v_np integer := 0;
  r record;
begin
  v_r := console_trocar_sindico_d437(p_pessoa, p_condominio, p_vinculo, p_versao, p_novo, p_nome, p_pedido_por, p_canal, p_conferido);
  v_novo := (v_r ->> 'vinculoId')::uuid;

  select * into v_lugar from responsaveis_atendimento where vinculo_id = p_vinculo and retirado_em is null;
  if v_lugar.id is not null
     or exists (select 1 from pedidos where responsavel_id = p_vinculo and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')) then
    insert into responsaveis_atendimento (condominio_id, vinculo_id, disponivel, criado_por)
    values (p_condominio, v_novo, coalesce(v_lugar.disponivel, true), p_pessoa);
    v_repasse := jsonb_build_object('atendimento', true);
  end if;
  for r in select id from pedidos where responsavel_id = p_vinculo and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') order by id loop
    v_n := v_n + 1;
    update pedidos set responsavel_id = v_novo, responsavel_desde = app_now(), aceito_em = null where id = r.id;
    perform registrar_historico('pedido.responsavel', 'pedidos', r.id::text,
      jsonb_build_object('de', p_vinculo, 'para', v_novo, 'motivo', 'Troca de síndico'));
  end loop;
  if v_n > 0 then v_repasse := v_repasse || jsonb_build_object('pedidos', jsonb_build_object('para', v_novo, 'quantidade', v_n)); end if;
  if exists (select 1 from configuracao_condominio where condominio_id = p_condominio and responsavel_padrao = p_vinculo) then
    update configuracao_condominio set responsavel_padrao = v_novo where condominio_id = p_condominio;
    v_repasse := v_repasse || jsonb_build_object('padrao', true);
  end if;
  if v_lugar.id is not null then
    update responsaveis_atendimento set retirado_em = app_now(), retirado_por = p_pessoa where id = v_lugar.id;
  end if;

  v_n := 0;
  for r in select id from manutencoes where responsavel_id = p_vinculo and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by id loop
    v_n := v_n + 1;
    update manutencoes set responsavel_id = v_novo where id = r.id;
    perform registrar_historico('manutencao.alterada', 'manutencoes', r.id::text, jsonb_build_object(
      'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_novo, 'motivo', 'Troca de síndico'));
  end loop;
  for r in select id from preventivas where responsavel_id = p_vinculo and ativa order by id loop
    v_np := v_np + 1;
    update preventivas set responsavel_id = v_novo where id = r.id;
    perform registrar_historico('preventiva.alterada', 'preventivas', r.id::text, jsonb_build_object(
      'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_novo, 'motivo', 'Troca de síndico'));
  end loop;
  if v_n + v_np > 0 then
    v_repasse := v_repasse || jsonb_build_object('manutencoes', jsonb_build_object('para', v_novo, 'quantidade', v_n, 'preventivas', v_np));
  end if;

  v_repasse := v_repasse || repassar_resto_do_vinculo(p_vinculo, v_novo, v_novo, v_novo, 'Troca de síndico');

  for r in select * from ausencias_sindico where sindico_id = p_vinculo and encerrada_em is null order by id loop
    update ausencias_sindico set encerrada_em = app_now(), encerrada_por = p_pessoa, fim_avisado = true where id = r.id;
    if r.inicio_avisado and r.ate >= hoje_no_condominio() then
      perform avisar_aprovacao((select pessoa_id from conselho_membros where id = r.substituto_id), 'AUSENCIA_FIM', null, null, r.id);
    end if;
    perform registrar_historico('ausencia.encerrada', 'ausencias_sindico', r.id::text,
      jsonb_build_object('de', r.de, 'ate', r.ate, 'motivo', 'Troca de síndico'));
    v_repasse := v_repasse || jsonb_build_object('ausencia', true);
  end loop;

  if v_repasse <> '{}'::jsonb then
    perform registrar_historico('sindico.repasse', 'vinculo', v_novo::text, v_repasse);
  end if;
  return v_r || jsonb_build_object('repasse', v_repasse);
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. Revogar pessoa autorizada (0297) com o resto do repasse. Além dos pedidos e das manutenções:
-- as pendências vão para quem assume os pedidos ou, sem essa escolha, para o síndico; quem executa
-- vai para quem assume as manutenções (sem essa escolha, fica sem quem executa); as decisões e
-- despesas vão para o síndico. "pessoa.repasse" conta tudo.
create or replace function plataforma_revogar_pessoa(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer,
                                                     p_substituto uuid, p_deixar_pendente boolean, p_assume jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedidos uuid;
  v_manutencoes uuid := (p_assume ->> 'manutencoes')::uuid;
  v_repasse jsonb := '{}'::jsonb;
  v_n integer := 0;
  v_np integer := 0;
  v_sindico uuid;
  r record;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.autorizar');
  perform 1 from vinculos where id = p_vinculo for update;
  perform 1 from vinculos where id in ((p_assume ->> 'pedidos')::uuid, v_manutencoes) order by id for share;
  perform exigir_autorizado(p_vinculo);

  if p_assume ? 'pedidos' then
    v_pedidos := (p_assume ->> 'pedidos')::uuid;
    if v_pedidos is not null and (v_pedidos = p_vinculo or not responsavel_disponivel(v_pedidos)) then
      perform recusar_motivo('Quem assume os pedidos precisa estar entre os responsáveis e disponível', 'ASSUME_PEDIDOS_INVALIDO');
    end if;
    for r in select id from pedidos where responsavel_id = p_vinculo and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') order by id loop
      update pedidos set responsavel_id = v_pedidos, responsavel_desde = case when v_pedidos is not null then app_now() end, aceito_em = null
       where id = r.id;
      perform registrar_historico('pedido.responsavel', 'pedidos', r.id::text,
        jsonb_strip_nulls(jsonb_build_object('de', p_vinculo, 'para', v_pedidos, 'motivo', 'Acesso revogado')));
      v_n := v_n + 1;
    end loop;
    v_repasse := jsonb_build_object('pedidos', jsonb_build_object('para', v_pedidos, 'quantidade', v_n));
  end if;

  if exists (select 1 from manutencoes where responsavel_id = p_vinculo and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
     or exists (select 1 from preventivas where responsavel_id = p_vinculo and ativa) then
    if v_manutencoes is null then
      perform recusar_motivo('Esta pessoa cuida de manutenções: escolha quem assume', 'MANUTENCOES_SEM_RESPONSAVEL');
    end if;
    if v_manutencoes = p_vinculo or not vinculo_com_acesso(v_manutencoes)
       or not pode(pessoa_do_vinculo(v_manutencoes), p_condominio, 'manutencao.ver') then
      perform recusar_motivo('Quem assume as manutenções precisa ter acesso e ver a manutenção', 'ASSUME_MANUTENCOES_INVALIDO');
    end if;
    v_n := 0;
    for r in select id from manutencoes where responsavel_id = p_vinculo and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by id loop
      v_n := v_n + 1;
      update manutencoes set responsavel_id = v_manutencoes where id = r.id;
      perform registrar_historico('manutencao.alterada', 'manutencoes', r.id::text, jsonb_build_object(
        'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_manutencoes, 'motivo', 'Acesso revogado'));
    end loop;
    for r in select id from preventivas where responsavel_id = p_vinculo and ativa order by id loop
      v_np := v_np + 1;
      update preventivas set responsavel_id = v_manutencoes where id = r.id;
      perform registrar_historico('preventiva.alterada', 'preventivas', r.id::text, jsonb_build_object(
        'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_manutencoes, 'motivo', 'Acesso revogado'));
    end loop;
    v_repasse := v_repasse || jsonb_build_object('manutencoes',
      jsonb_build_object('para', v_manutencoes, 'quantidade', v_n, 'preventivas', v_np));
  elsif v_manutencoes is not null and (v_manutencoes = p_vinculo or not vinculo_com_acesso(v_manutencoes)) then
    -- Sem manutenção como responsável, quem assume ainda pode receber o "quem executa".
    perform recusar_motivo('Quem assume as manutenções precisa ter acesso e ver a manutenção', 'ASSUME_MANUTENCOES_INVALIDO');
  end if;

  v_sindico := vinculo_do_sindico();
  v_repasse := v_repasse || repassar_resto_do_vinculo(p_vinculo, coalesce(v_pedidos, v_sindico), v_manutencoes, v_sindico, 'Acesso revogado');

  perform plataforma_revogar_pessoa_e297(p_pessoa, p_condominio, p_vinculo, p_versao, p_substituto, p_deixar_pendente);
  if v_repasse <> '{}'::jsonb then
    perform registrar_historico('pessoa.repasse', 'vinculo', p_vinculo::text, v_repasse);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. revogar_vinculo (0040) não deixa nada preso: com algo em aberto, a revogação vai pela tela
-- de Pessoas (ou pela troca de síndico, no Console).
create or replace function revogar_vinculo(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'vinculos.revogar');
  if vinculo_com_algo_em_aberto(p_vinculo) then
    perform recusar_motivo('Esta pessoa ainda tem algo em aberto: revogue pela tela de Pessoas, que pergunta quem assume', 'TEM_ALGO_EM_ABERTO');
  end if;

  update vinculos set revogado_em = app_now(), revogado_por = p_pessoa
   where id = p_vinculo and versao = p_versao and revogado_em is null
  returning versao into v_versao;
  if v_versao is null then
    perform conflito_versao('vinculos', p_vinculo);
  end if;
  perform registrar_historico('vinculo.revogado', 'vinculo', p_vinculo::text, '{}'::jsonb);
  return v_versao;
end $$;

call fechar_acesso();

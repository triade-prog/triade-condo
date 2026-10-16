-- 0030 · Gatilho guardião das transições de estado (F0.4; PT-03)
-- Toda tabela com a coluna estado liga o guardião (ligar_guardiao). Ele aceita só o estado
-- inicial e as transições cadastradas para aquela tabela, e só com o evento e o autor
-- informados na mesma transação (definir_transicao). Cada mudança vai para o histórico junto
-- com a alteração: se uma falhar, nenhuma das duas fica.

create table estados_iniciais (
  tabela text not null check (tabela ~ '^[a-z][a-z0-9_]*$'),
  estado text not null check (estado ~ '^[A-Z][A-Z_]*$'),
  primary key (tabela, estado)
);

create table transicoes_permitidas (
  tabela text not null check (tabela ~ '^[a-z][a-z0-9_]*$'),
  de     text not null check (de ~ '^[A-Z][A-Z_]*$'),
  para   text not null check (para ~ '^[A-Z][A-Z_]*$'),
  primary key (tabela, de, para),
  check (de <> para)
);

call proteger_tabela_global('estados_iniciais', 'Estado em que cada tipo de registro nasce, igual para todos os condomínios');
call proteger_tabela_global('transicoes_permitidas', 'Mudanças de estado aceitas por tabela, iguais para todos os condomínios');

-- Informa o evento antes de mudar o estado. O autor é a pessoa do contexto; sem pessoa,
-- só com p_sistema (rotinas do próprio sistema, como o vencimento de um prazo).
create function definir_transicao(p_evento text, p_motivo text default null, p_sistema boolean default false) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_evento is null or p_evento !~ '^[A-Z][A-Z0-9_]{1,40}$' then
    raise exception 'Evento de transição inválido' using errcode = 'TC020';
  end if;
  if contexto_pessoa() is null and not p_sistema then
    raise exception 'Mudança de estado só com autor' using errcode = 'TC025';
  end if;
  perform set_config('app.transicao_evento', p_evento, true);
  perform set_config('app.transicao_motivo', coalesce(p_motivo, ''), true);
  perform set_config('app.transicao_sistema', case when p_sistema then 'on' else '' end, true);
end $$;

create function guardiao_transicao() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_evento  text := nullif(current_setting('app.transicao_evento', true), '');
  v_motivo  text := nullif(current_setting('app.transicao_motivo', true), '');
  v_sistema boolean := current_setting('app.transicao_sistema', true) = 'on';
  v_pessoa  uuid := contexto_pessoa();
  v_novo    jsonb := to_jsonb(new);
  v_de      text;
  v_para    text := v_novo ->> 'estado';
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from estados_iniciais where tabela = tg_table_name and estado = v_para) then
      raise exception '% não nasce em %', tg_table_name, v_para using errcode = 'TC021';
    end if;
  else
    v_de := to_jsonb(old) ->> 'estado';
    if v_de is not distinct from v_para then
      return new;
    end if;
    if not exists (select 1 from transicoes_permitidas where tabela = tg_table_name and de = v_de and para = v_para) then
      raise exception 'Transição proibida em %: % → %', tg_table_name, v_de, v_para using errcode = 'TC023';
    end if;
  end if;

  if v_evento is null then
    raise exception 'Mudança de estado só com o evento informado' using errcode = 'TC024';
  end if;
  if v_pessoa is null and not v_sistema then
    raise exception 'Mudança de estado só com autor' using errcode = 'TC025';
  end if;

  insert into historico (ocorrido_em, condominio_id, autor_tipo, autor_id, acao, entidade, entidade_id, dados)
  values (app_now(), (v_novo ->> 'condominio_id')::uuid,
          case when v_pessoa is null then 'SISTEMA' else 'PESSOA' end::tipo_autor, v_pessoa,
          'estado.mudou', tg_table_name, v_novo ->> 'id',
          jsonb_strip_nulls(jsonb_build_object('de', v_de, 'para', v_para, 'evento', v_evento, 'motivo', v_motivo)));
  return new;
end $$;

create procedure ligar_guardiao(p_tabela regclass)
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from pg_attribute where attrelid = p_tabela and attname = 'estado' and not attisdropped) then
    raise exception 'A tabela % não tem a coluna estado', p_tabela;
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = p_tabela and tgname = 'guardiao_transicao') then
    execute format('create trigger guardiao_transicao before insert or update on %s for each row execute function guardiao_transicao()', p_tabela);
  end if;
end $$;

call fechar_acesso();

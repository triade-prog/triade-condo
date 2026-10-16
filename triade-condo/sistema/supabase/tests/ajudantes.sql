-- Ajudantes dos testes (esquema teste, nunca vai para o Supabase). Criam dados fictícios
-- (PT-14) direto nas tabelas, como superusuário, e uma tabela de exemplo de condomínio com
-- as funções de API que toda funcionalidade vai seguir.
create schema if not exists teste;

create function teste.pessoa(p_nome text) returns uuid
language plpgsql
as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_id, v_id || '@exemplo.invalid');
  insert into public.pessoas (id, nome) values (v_id, p_nome);
  return v_id;
end $$;

create function teste.condominio(p_nome text) returns uuid
language sql
as $$ insert into public.condominios (nome) values (p_nome) returning id $$;

create function teste.vincular(p_pessoa uuid, p_condominio uuid, p_funcao text default 'SINDICO') returns uuid
language sql
as $$ insert into public.vinculos (pessoa_id, condominio_id, funcao) values (p_pessoa, p_condominio, p_funcao) returning id $$;

create function teste.permitir(p_funcao text, variadic p_acoes text[]) returns void
language sql
as $$ insert into public.funcao_acoes (funcao, acao) select p_funcao, unnest(p_acoes) on conflict do nothing $$;

-- Tabela de exemplo, criada dentro da transação de cada teste (o rollback desfaz tudo).
-- Segue o mesmo caminho de uma tabela de verdade: proteger_tabela_condominio, guardião e
-- funções da API que recebem pessoa e condomínio da sessão.
create procedure teste.criar_exemplos()
language plpgsql
as $proc$
begin
  create table public.exemplos (
    id            uuid primary key default gen_random_uuid(),
    condominio_id uuid not null references public.condominios (id),
    titulo        text not null,
    estado        text not null default 'ABERTO',
    versao        integer not null default 1
  );
  call public.proteger_tabela_condominio('public.exemplos');
  call public.ligar_guardiao('public.exemplos');
  insert into public.estados_iniciais (tabela, estado) values ('exemplos', 'ABERTO');
  insert into public.transicoes_permitidas (tabela, de, para) values ('exemplos', 'ABERTO', 'FECHADO');

  create function public.exemplo_criar(p_pessoa uuid, p_condominio uuid, p_titulo text) returns uuid
  language plpgsql security definer set search_path = public as $$
  declare v_id uuid;
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.criar');
    perform definir_transicao('CRIADO');
    insert into exemplos (condominio_id, titulo) values (p_condominio, p_titulo) returning id into v_id;
    return v_id;
  end $$;

  create function public.exemplo_listar(p_pessoa uuid, p_condominio uuid) returns setof text
  language plpgsql security definer set search_path = public as $$
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.ver');
    -- Sem filtro por condomínio de propósito: quem separa é o RLS.
    return query select titulo from exemplos order by titulo;
  end $$;

  create function public.exemplo_ler(p_pessoa uuid, p_condominio uuid, p_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
  declare v text;
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.ver');
    select titulo into v from exemplos where id = p_id;
    if v is null then raise exception 'Não encontrado' using errcode = 'TC404'; end if;
    return v;
  end $$;

  create function public.exemplo_buscar(p_pessoa uuid, p_condominio uuid, p_texto text) returns setof text
  language plpgsql security definer set search_path = public as $$
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.ver');
    return query select titulo from exemplos where titulo ilike '%' || p_texto || '%';
  end $$;

  create function public.exemplo_alterar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_titulo text) returns integer
  language plpgsql security definer set search_path = public as $$
  declare v_versao integer;
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.alterar');
    update exemplos set titulo = p_titulo where id = p_id and versao = p_versao returning versao into v_versao;
    if v_versao is null then perform conflito_versao('exemplos', p_id); end if;
    perform registrar_historico('exemplo.alterado', 'exemplo', p_id::text, jsonb_build_object('versao', v_versao));
    return v_versao;
  end $$;

  create function public.exemplo_fechar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_evento text) returns void
  language plpgsql security definer set search_path = public as $$
  begin
    perform entrar_condominio(p_pessoa, p_condominio, 'exemplos.alterar');
    if p_evento is not null then perform definir_transicao(p_evento); end if;
    update exemplos set estado = 'FECHADO' where id = p_id;
    if not found then raise exception 'Não encontrado' using errcode = 'TC404'; end if;
  end $$;

  call public.fechar_acesso();
end $proc$;

-- Executa o comando e devolve o erro (código e detalhe), para conferir o que vai para a tela.
create function teste.erro(p_sql text) returns jsonb
language plpgsql
as $$
declare v_codigo text; v_detalhe text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_codigo = returned_sqlstate, v_detalhe = pg_exception_detail;
  return jsonb_build_object('codigo', v_codigo, 'detalhe', nullif(v_detalhe, '')::jsonb);
end $$;

-- Pessoa da equipe TRÍADE, ativa, com as funções internas dadas (passo 1).
create function teste.equipe(p_nome text, variadic p_funcoes text[]) returns uuid
language plpgsql
as $$
declare v_id uuid := teste.pessoa(p_nome);
begin
  insert into public.equipe_triade (pessoa_id) values (v_id);
  insert into public.equipe_funcoes (pessoa_id, funcao) select v_id, unnest(p_funcoes);
  return v_id;
end $$;

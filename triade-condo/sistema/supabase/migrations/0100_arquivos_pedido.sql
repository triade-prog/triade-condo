-- 0100 · Fotos e documentos dos pedidos (passo 4b; F4.8, PT-07, PT-01, PT-11, AT-01, AT-13,
-- AT-17, AT-32)
--
-- Regras desta parte:
-- 1. Fotos (JPG, PNG, WEBP) e PDF, até 10 MB cada e 30 por pedido (os que não foram tirados).
-- 2. O arquivo fica no armazenamento privado do Supabase (bucket "pedidos"), no caminho
--    condomínio/pedido/arquivo. O nome dado pela pessoa só aparece na tela (PT-07).
-- 3. O navegador envia direto para o armazenamento, por um link de envio que a API gera depois
--    desta checagem. Em seguida a API confere o conteúdo de verdade (não só o nome), o tamanho e
--    tira a localização das fotos; só então o arquivo fica liberado. Enquanto isso, ninguém abre;
--    o que não passa fica "não liberado", com o motivo, e é apagado do armazenamento.
-- 4. Abrir e baixar: a API confere aqui se a pessoa vê o pedido e gera um link de 5 minutos.
-- 5. Envia quem pode dar retorno ou atualizar o pedido (e o responsável), enquanto o pedido está
--    em andamento. Quem concluiu junta arquivos à própria conclusão enquanto ela vale.
-- 6. Vê quem vê o pedido (o privado continua privado, AT-32).
-- 7. Tirar do pedido pede motivo, esconde de todos e vai para o histórico. Não apaga: apagar de
--    vez fica com a regra de guarda dos dados (PT-11), num passo próprio.

create table arquivos_pedido (
  id                 uuid primary key default gen_random_uuid(),
  condominio_id      uuid not null references condominios (id) on delete restrict,
  pedido_id          uuid not null,
  conclusao_id       uuid references conclusoes_pedido (id),
  parte              text not null check (parte in ('RELATO', 'ANDAMENTO', 'CONCLUSAO')),
  nome               text not null check (length(btrim(nome)) between 1 and 200),
  descricao          text check (length(btrim(descricao)) between 2 and 300),
  tipo               text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_declarado  integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho            integer check (tamanho between 1 and 10485760),
  caminho            text not null unique,
  situacao           text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa      text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em         timestamptz not null default app_now(),
  enviado_por        uuid not null references pessoas (id),
  verificado_em      timestamptz,
  retirado_em        timestamptz,
  retirado_por       uuid references pessoas (id),
  motivo_retirada    text check (length(btrim(motivo_retirada)) between 3 and 500),
  foreign key (pedido_id, condominio_id) references pedidos (id, condominio_id),
  check ((parte = 'CONCLUSAO') = (conclusao_id is not null)),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null)),
  check ((retirado_em is null) = (retirado_por is null) and (retirado_em is null) = (motivo_retirada is null))
);
create index arquivos_pedido_pedido on arquivos_pedido (pedido_id, enviado_em);
call proteger_tabela_condominio('arquivos_pedido');
create trigger arquivos_pedido_sem_exclusao before delete on arquivos_pedido for each row execute function somente_insercao();

-- O arquivo não muda: só recebe a verificação (uma vez) e a retirada (uma vez).
create function arquivos_pedido_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.pedido_id, new.conclusao_id, new.parte, new.nome, new.descricao, new.tipo,
      new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.pedido_id, old.conclusao_id, old.parte, old.nome, old.descricao, old.tipo,
      old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por) then
    raise exception 'O arquivo do pedido não muda depois de enviado' using errcode = 'TC422';
  end if;
  if old.situacao <> 'ENVIANDO' and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
     is distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    raise exception 'O arquivo já foi verificado' using errcode = 'TC422';
  end if;
  if old.retirado_em is not null and (new.retirado_em, new.retirado_por, new.motivo_retirada)
     is distinct from (old.retirado_em, old.retirado_por, old.motivo_retirada) then
    raise exception 'O arquivo já foi tirado do pedido' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger arquivos_pedido_regras before update on arquivos_pedido for each row execute function arquivos_pedido_regras();

-- Armazenamento privado. Sem nenhuma política em storage.objects: só a chave de serviço (a API)
-- lê e grava; o navegador só chega ao arquivo pelos links assinados que a API gera.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('pedidos', 'pedidos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- A conclusão que ainda vale e que a pessoa fez: aceita os arquivos dela.
create function conclusao_aberta_de(p_pessoa uuid, p_pedido pedidos) returns uuid
language sql stable
set search_path = public
as $$
  select c.id from conclusoes_pedido c
   where c.pedido_id = p_pedido.id and p_pedido.estado in ('EM_REVISAO', 'ENCERRADO')
     and c.concluida_por = p_pessoa and c.reaberta_em is null and c.revisao <> 'DEVOLVIDA'
     and c.concluida_em = (select max(concluida_em) from conclusoes_pedido where pedido_id = p_pedido.id)
   limit 1
$$;

create function pode_enviar_arquivo(p_pessoa uuid, p_pedido pedidos) returns boolean
language sql stable
set search_path = public
as $$
  select p_pedido.estado in ('ABERTO', 'EM_ANDAMENTO')
     and (pode_no_pedido(p_pessoa, p_pedido, 'pedidos.responder') or pode_no_pedido(p_pessoa, p_pedido, 'pedidos.atualizar'))
$$;

create function pode_tirar_arquivo(p_pessoa uuid, p_pedido pedidos, p_arquivo arquivos_pedido) returns boolean
language sql stable
set search_path = public
as $$
  select p_arquivo.retirado_em is null
     and (p_arquivo.enviado_por = p_pessoa or pode_no_pedido(p_pessoa, p_pedido, 'pedidos.atualizar') or eh_sindico(p_pessoa))
$$;

create function exigir_arquivo(p_pedido uuid, p_arquivo uuid) returns arquivos_pedido
language plpgsql
set search_path = public
as $$
declare v arquivos_pedido;
begin
  select * into v from arquivos_pedido where id = p_arquivo and pedido_id = p_pedido and retirado_em is null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API (security definer).

-- Arquivos do pedido que a pessoa vê, com o que ela pode fazer.
create function plataforma_arquivos_pedido(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v pedidos;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  return jsonb_build_object(
    'arquivos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', a.id, 'parte', a.parte, 'nome', a.nome, 'descricao', a.descricao, 'tipo', a.tipo,
               'tamanho', coalesce(a.tamanho, a.tamanho_declarado), 'situacao', a.situacao, 'motivoRecusa', a.motivo_recusa,
               'enviadoEm', a.enviado_em, 'enviadoPor', (select nome from pessoas where id = a.enviado_por),
               'podeTirar', pode_tirar_arquivo(p_pessoa, v, a)))
             order by a.enviado_em, a.id)
        from arquivos_pedido a where a.pedido_id = v.id and a.retirado_em is null), '[]'::jsonb),
    'pode', jsonb_build_object(
      'enviar', pode_enviar_arquivo(p_pessoa, v),
      'enviarConclusao', conclusao_aberta_de(p_pessoa, v) is not null),
    'limites', jsonb_build_object('porPedido', 30, 'tamanho', 10485760));
end $$;

-- Começa o envio: confere tudo o que dá para conferir antes do arquivo chegar e devolve o
-- caminho em que a API vai gerar o link de envio.
create function plataforma_iniciar_arquivo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_parte text, p_nome text,
                                           p_descricao text, p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  v_conclusao uuid;
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  if p_parte = 'CONCLUSAO' then
    v_conclusao := conclusao_aberta_de(p_pessoa, v);
    if v_conclusao is null then
      raise exception 'Só quem concluiu junta arquivos à conclusão' using errcode = 'TC401';
    end if;
  elsif p_parte in ('RELATO', 'ANDAMENTO') then
    if not (pode_no_pedido(p_pessoa, v, 'pedidos.responder') or pode_no_pedido(p_pessoa, v, 'pedidos.atualizar')) then
      raise exception 'Sem permissão para enviar arquivos neste pedido' using errcode = 'TC401';
    end if;
    perform exigir_em_andamento(v);
  else
    perform recusar_campos('Diga de que parte do pedido é o arquivo', 'parte');
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then
    perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome');
  end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP) e PDF', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  if length(v_descricao) not between 2 and 300 then
    perform recusar_campos('Descrição de 2 a 300 caracteres', 'descricao');
  end if;
  -- Trava o pedido para contar sem corrida com outro envio.
  perform 1 from pedidos where id = p_id for update;
  if (select count(*) from arquivos_pedido where pedido_id = p_id and retirado_em is null) >= 30 then
    perform recusar_motivo('O pedido já tem 30 arquivos', 'LIMITE_ARQUIVOS');
  end if;
  v_caminho := p_condominio || '/' || p_id || '/' || v_id;
  insert into arquivos_pedido (id, condominio_id, pedido_id, conclusao_id, parte, nome, descricao, tipo, tamanho_declarado,
                               caminho, enviado_por)
  values (v_id, p_condominio, p_id, v_conclusao, p_parte, btrim(p_nome), v_descricao, p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

-- O que a API precisa para verificar o arquivo que a pessoa acabou de enviar.
create function plataforma_arquivo_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  a arquivos_pedido;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  a := exigir_arquivo(v.id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'tipo', a.tipo);
end $$;

-- Resultado da verificação feita pela API: liberado (com o tamanho final) ou não liberado
-- (com o motivo). Vai para o histórico do pedido.
create function plataforma_verificar_arquivo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid, p_liberado boolean,
                                             p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  a arquivos_pedido;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  a := exigir_arquivo(v.id, p_arquivo);
  if a.enviado_por <> p_pessoa then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    update arquivos_pedido set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = a.id;
    perform registrar_historico('pedido.arquivo_enviado', 'pedidos', p_id::text, jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte));
  else
    update arquivos_pedido set situacao = 'NAO_LIBERADO', motivo_recusa = btrim(p_motivo), verificado_em = app_now() where id = a.id;
    perform registrar_historico('pedido.arquivo_recusado', 'pedidos', p_id::text, jsonb_build_object(
      'arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte, 'motivo', btrim(p_motivo)));
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

-- Abrir ou baixar: só arquivo liberado, de pedido que a pessoa vê. A API gera o link de 5 min.
create function plataforma_abrir_arquivo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  a arquivos_pedido;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  a := exigir_arquivo(v.id, p_arquivo);
  if a.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

-- Tirar do pedido (AT-17, PT-11): esconde de todos, com motivo, e fica no histórico.
create function plataforma_tirar_arquivo(p_pessoa uuid, p_condominio uuid, p_id uuid, p_arquivo uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos;
  a arquivos_pedido;
  v_motivo text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pedidos.ver');
  v := exigir_pedido(p_pessoa, p_id);
  a := exigir_arquivo(v.id, p_arquivo);
  if not pode_tirar_arquivo(p_pessoa, v, a) then
    raise exception 'Sem permissão para tirar este arquivo' using errcode = 'TC401';
  end if;
  v_motivo := exigir_motivo(p_motivo);
  update arquivos_pedido set retirado_em = app_now(), retirado_por = p_pessoa, motivo_retirada = v_motivo where id = a.id;
  perform registrar_historico('pedido.arquivo_tirado', 'pedidos', p_id::text, jsonb_build_object(
    'arquivo', a.id, 'arquivoNome', a.nome, 'parte', a.parte, 'motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

call fechar_acesso();

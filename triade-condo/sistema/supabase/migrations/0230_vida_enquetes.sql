-- 0230 · Vida em condomínio: enquetes e o link pessoal (peça R12; AC-03, W-20, W-22). Telas e
-- decisões aprovadas pela Carolina em 19/10/2026 (docs/telas/vida.html, telas 4 e 5 e decisões
-- 7, 8 e 15).
--
-- Regras desta parte:
-- 1. Uma pergunta, de 2 a 6 opções e um prazo (de 1 hora a 90 dias). Uma resposta por unidade ou
--    por pessoa com vínculo confirmado, secreta ou aberta. Enquete consulta, não decide: o que
--    precisa de quórum vai para Assembleias.
-- 2. Cada unidade (ou pessoa) tem um convite. O convite chega pelo WhatsApp (sempre pelo modelo
--    aprovado fora das 24 horas, respeitando PARAR) e por e-mail, com um link que é só dela,
--    sem conta e sem senha. Cada envio leva um código novo; o banco guarda só o hash. A resposta
--    pode ser trocada pelo link até o prazo.
-- 3. Quem respondeu fica separado do que respondeu. Na enquete secreta a escolha fica numa tabela
--    à parte, achada só por uma chave feita com um sal da própria enquete; o sal é apagado quando
--    a enquete fecha, e daí em diante ninguém liga a escolha à unidade, nem o síndico.
-- 4. O resultado aparece enquanto corre, com quantos faltam. Um lembrete vai uma vez, dois dias
--    antes do fim, só para quem não respondeu. O síndico encerra antes, se quiser, e publica o
--    resultado como comunicado (nasce rascunho em Comunicados, para conferir e publicar).
-- 5. No mural, a enquete aberta aparece com a pergunta e o prazo; responde-se pelo link pessoal.
-- 6. Permissões (CF-03): Ver as enquetes e Cuidar das enquetes, dadas pelo síndico.

insert into permissoes (codigo, nome, descricao, ordem) values
  ('VER_ENQUETES', 'Ver as enquetes', 'Ver as enquetes e os resultados.', 17),
  ('ENQUETES', 'Cuidar das enquetes', 'Criar, encerrar e publicar o resultado das enquetes.', 18);
insert into permissao_acoes (permissao, acao) values
  ('VER_ENQUETES', 'enquetes.ver'),
  ('ENQUETES', 'enquetes.ver'),
  ('ENQUETES', 'enquetes.editar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'enquetes.ver'),
  ('SINDICO', 'enquetes.editar');

alter table codigos_sem_conta drop constraint codigos_sem_conta_tipo_check;
alter table codigos_sem_conta add constraint codigos_sem_conta_tipo_check check (tipo in ('ETIQUETA', 'PRESTADOR', 'ENQUETE'));

-- ---------------------------------------------------------------------------------------
-- Enquetes (AC-03).

create function opcoes_enquete_validas(p text[]) returns boolean
language sql immutable
set search_path = public
as $$
  select cardinality(p) between 2 and 6
     and not exists (select 1 from unnest(p) o where o is null or length(btrim(o)) not between 1 and 80)
     and (select count(distinct lower(btrim(o))) from unnest(p) o) = cardinality(p)
$$;

create table enquetes (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references condominios (id) on delete restrict,
  pergunta            text not null check (length(btrim(pergunta)) between 5 and 200),
  opcoes              text[] not null check (opcoes_enquete_validas(opcoes)),
  por                 text not null check (por in ('UNIDADE', 'PESSOA')),
  secreta             boolean not null,
  aberta_ate          timestamptz not null,
  canais              text[] not null check (cardinality(canais) between 1 and 3 and canais <@ array['WHATSAPP', 'MURAL', 'EMAIL']),
  lembrete_em         timestamptz,
  lembrete_enviado_em timestamptz,
  -- Liga a escolha secreta ao convite enquanto a enquete corre; some quando ela fecha.
  sal                 bytea check (length(sal) = 32),
  encerrada_em        timestamptz,
  encerrada_por       uuid references pessoas (id),
  comunicado_id       uuid,
  criado_em           timestamptz not null default app_now(),
  criado_por          uuid not null references pessoas (id),
  atualizado_em       timestamptz not null default app_now(),
  versao              integer not null default 1,
  unique (id, condominio_id),
  foreign key (comunicado_id, condominio_id) references comunicados (id, condominio_id),
  check (aberta_ate > criado_em),
  check (lembrete_em is null or lembrete_em < aberta_ate),
  check (encerrada_por is null or encerrada_em is not null),
  check (not secreta or encerrada_em is null or sal is null),
  check (comunicado_id is null or encerrada_em is not null)
);
create index enquetes_condominio on enquetes (condominio_id, criado_em desc);
call proteger_tabela_condominio('enquetes');
create trigger enquetes_sem_exclusao before delete on enquetes for each row execute function somente_insercao();

-- A pergunta, as opções e quem responde não mudam depois de enviada.
create function enquetes_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.pergunta, new.opcoes, new.por, new.secreta, new.aberta_ate, new.canais, new.criado_em, new.criado_por)
     is distinct from (old.pergunta, old.opcoes, old.por, old.secreta, old.aberta_ate, old.canais, old.criado_em, old.criado_por) then
    raise exception 'A enquete enviada não muda: encerre e crie outra' using errcode = 'TC422';
  end if;
  if old.encerrada_em is not null and new.encerrada_em is distinct from old.encerrada_em then
    raise exception 'A enquete já fechou' using errcode = 'TC422';
  end if;
  if old.sal is null and new.sal is not null then
    raise exception 'O sal da enquete não volta' using errcode = 'TC422';
  end if;
  new.atualizado_em := app_now();
  return new;
end $$;
create trigger enquetes_regras before update on enquetes for each row execute function enquetes_regras();

-- Um convite por unidade (ou por pessoa). Guarda quando respondeu; a escolha só na aberta.
create table convites_enquete (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  enquete_id    uuid not null,
  unidade_id    uuid,
  contato_id    uuid,
  respondeu_em  timestamptz,
  opcao         smallint check (opcao between 1 and 6),
  trocas        smallint not null default 0 check (trocas between 0 and 1000),
  unique (id, condominio_id),
  foreign key (enquete_id, condominio_id) references enquetes (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (contato_id, condominio_id) references contatos (id, condominio_id),
  check ((unidade_id is null) <> (contato_id is null)),
  check (opcao is null or respondeu_em is not null)
);
create unique index convites_enquete_unidade on convites_enquete (enquete_id, unidade_id) where unidade_id is not null;
create unique index convites_enquete_contato on convites_enquete (enquete_id, contato_id) where contato_id is not null;
call proteger_tabela_condominio('convites_enquete');
create trigger convites_enquete_sem_exclusao before delete on convites_enquete for each row execute function somente_insercao();

-- A escolha da enquete secreta, sem convite, sem hora e sem pessoa.
create table respostas_secretas (
  enquete_id    uuid not null,
  condominio_id uuid not null references condominios (id) on delete restrict,
  chave         bytea not null check (length(chave) = 32),
  opcao         smallint not null check (opcao between 1 and 6),
  primary key (enquete_id, chave),
  foreign key (enquete_id, condominio_id) references enquetes (id, condominio_id)
);
call proteger_tabela_condominio('respostas_secretas');
create trigger respostas_secretas_sem_exclusao before delete on respostas_secretas for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- WhatsApp e e-mail: finalidade, modelos e tipo novos (W-20).

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE'));
alter table envios_whatsapp add column convite_enquete_id uuid;
alter table envios_whatsapp add constraint envios_whatsapp_convite_enquete
  foreign key (convite_enquete_id, condominio_id) references convites_enquete (id, condominio_id);

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete'));

-- O link entra no lugar de [link] na hora de enviar: o texto guardado nunca tem o código.
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('enquete_convite', 1, 'Convite para enquete', 'MORADOR', 'Enquete nova, com o link pessoal da unidade ou da pessoa',
   '["condomínio", "pergunta", "prazo", "de quem é o link", "link"]',
   E'Enquete do {{1}}: {{2}}\n\nResponda até {{3}} pelo link, que é só {{4}}:\n{{5}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now()),
  ('enquete_lembrete', 1, 'Lembrete de enquete', 'MORADOR', 'Lembrete dois dias antes do fim, só para quem não respondeu',
   '["condomínio", "pergunta", "prazo", "de quem é o link", "link"]',
   E'Lembrete do {{1}}: a enquete "{{2}}" fecha em {{3}} e ainda falta a resposta {{4}}. Responda pelo link:\n{{5}}\n\nNina, assistente virtual do {{1}}.',
   'Para não receber mais avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Vida em condomínio em 19/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave in ('enquete_convite', 'enquete_lembrete');

alter table envios_email drop constraint envios_email_tipo_check;
alter table envios_email add constraint envios_email_tipo_check check (tipo in ('COMUNICADO', 'CONFIRMACAO', 'DOCUMENTO', 'ENQUETE'));
alter table envios_email add column convite_enquete_id uuid;
alter table envios_email add column lembrete boolean not null default false;
alter table envios_email add constraint envios_email_convite_enquete
  foreign key (convite_enquete_id, condominio_id) references convites_enquete (id, condominio_id);
alter table envios_email add constraint envios_email_enquete_tem_convite
  check (tipo <> 'ENQUETE' or (convite_enquete_id is not null and contato_id is not null));

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

create function enquete_aberta(e enquetes) returns boolean
language sql stable
set search_path = public
as $$ select e.encerrada_em is null and e.aberta_ate > app_now() $$;

-- "31/10, às 23:59", no fuso do condomínio.
create function prazo_por_extenso(p timestamptz) returns text
language sql stable
set search_path = public
as $$
  select to_char(p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'DD/MM') || ', às '
      || to_char(p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'HH24:MI')
$$;

create function chave_secreta(e enquetes, p_convite uuid) returns bytea
language sql immutable
set search_path = public
as $$ select extensions.hmac(convert_to(p_convite::text, 'UTF8'), e.sal, 'sha256') $$;

-- De quem é o link, no meio da frase: "da Torre A · 302" ou "seu".
create function dono_do_convite(c convites_enquete) returns text
language sql stable
set search_path = public
as $$ select case when c.unidade_id is not null then 'da ' || rotulo_unidade(c.unidade_id) else 'seu' end $$;

-- Quem recebe o convite: os contatos confirmados da unidade, ou a própria pessoa.
create function contatos_do_convite(c convites_enquete) returns setof contatos
language sql stable
set search_path = public
as $$
  select ct.* from contatos ct
   where ct.dados_removidos_em is null
     and case when c.contato_id is not null then ct.id = c.contato_id and contato_ativo(ct.id)
              else exists (select 1 from contatos_unidade cu where cu.unidade_id = c.unidade_id and cu.contato_id = ct.id
                                                              and cu.estado = 'CONFIRMADO') end
$$;

-- Um código novo para o convite (cada envio leva o seu). Fica valendo enquanto a enquete corre.
create function gerar_codigo_convite(p_convite uuid) returns text
language plpgsql
set search_path = public
as $$
declare v_codigo text;
begin
  loop
    v_codigo := novo_codigo_mural();
    exit when not exists (select 1 from codigos_sem_conta where hash = hash_codigo(v_codigo))
          and not exists (select 1 from links_publicos where hash = hash_codigo(v_codigo));
  end loop;
  insert into codigos_sem_conta (hash, condominio_id, tipo, alvo_id) values (hash_codigo(v_codigo), contexto_condominio(), 'ENQUETE', p_convite);
  return v_codigo;
end $$;

-- O convite (ou o lembrete) para cada contato, pelos canais da enquete. Devolve quantos foram.
create function enviar_convite_enquete(e enquetes, c convites_enquete, p_lembrete boolean, p_pessoa uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  ct contatos;
  v_envio uuid;
  v_n integer := 0;
  v_whats boolean := 'WHATSAPP' = any (e.canais) and exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS');
  v_email boolean := 'EMAIL' = any (e.canais) and coalesce((select email_ligado from configuracao_condominio), false);
  v_params jsonb := jsonb_build_array(nome_do_condominio(), e.pergunta,
                                      prazo_por_extenso(e.aberta_ate), dono_do_convite(c), '[link]');
begin
  for ct in select * from contatos_do_convite(c) loop
    if v_whats and ct.telefone is not null and ct.whatsapp_parou_em is null then
      v_envio := enfileirar_whatsapp(ct.telefone, ct.id, null, null, null, 'ENQUETE',
        case when p_lembrete
          then 'Lembrete: a enquete "' || e.pergunta || '" fecha em ' || prazo_por_extenso(e.aberta_ate) || ' e ainda falta a resposta '
               || dono_do_convite(c) || E'. Responda pelo link:\n[link]'
          else 'Enquete do ' || nome_do_condominio() || ': ' || e.pergunta || E'\n\nResponda até '
               || prazo_por_extenso(e.aberta_ate) || ' pelo link, que é só ' || dono_do_convite(c) || E':\n[link]' end
        || assinatura_nina(), p_pessoa, p_pessoa);
      update envios_whatsapp set convite_enquete_id = c.id, modelo_chave = case when p_lembrete then 'enquete_lembrete' else 'enquete_convite' end,
                                 modelo_parametros = v_params
       where id = v_envio;
      v_n := v_n + 1;
    end if;
    if v_email and recebe_por_email(ct) then
      insert into envios_email (condominio_id, tipo, contato_id, convite_enquete_id, lembrete, para, criado_por)
      values (e.condominio_id, 'ENQUETE', ct.id, c.id, p_lembrete, ct.email, p_pessoa);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- As contagens por opção, de quem respondeu e do total.
create function resultado_enquete(e enquetes) returns jsonb
language sql stable
set search_path = public
as $$
  with votos as (
    select opcao from convites_enquete where enquete_id = e.id and not e.secreta and opcao is not null
    union all
    select opcao from respostas_secretas where enquete_id = e.id and e.secreta)
  select jsonb_build_object(
    'opcoes', (select jsonb_agg(jsonb_build_object('texto', o.texto, 'votos', (select count(*) from votos v where v.opcao = o.n)) order by o.n)
                 from unnest(e.opcoes) with ordinality o(texto, n)),
    'responderam', (select count(*) from convites_enquete where enquete_id = e.id and respondeu_em is not null),
    'total', (select count(*) from convites_enquete where enquete_id = e.id))
$$;

create function enquete_json(e enquetes) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'pergunta', e.pergunta, 'opcoes', to_jsonb(e.opcoes), 'por', e.por, 'secreta', e.secreta,
    'abertaAte', e.aberta_ate, 'canais', to_jsonb(e.canais), 'lembreteEm', e.lembrete_em, 'lembreteEnviadoEm', e.lembrete_enviado_em,
    'situacao', case when enquete_aberta(e) then 'ABERTA' else 'ENCERRADA' end,
    'encerradaEm', coalesce(e.encerrada_em, case when e.aberta_ate <= app_now() then e.aberta_ate end),
    'encerradaPor', nome_pessoa(e.encerrada_por),
    'comunicado', (select jsonb_build_object('id', c.id, 'estado', c.estado) from comunicados c where c.id = e.comunicado_id),
    'criadoEm', e.criado_em, 'criadoPor', nome_pessoa(e.criado_por), 'versao', e.versao,
    'resultado', resultado_enquete(e)))
$$;

create function exigir_enquete(p_id uuid) returns enquetes
language plpgsql
set search_path = public
as $$
declare e enquetes;
begin
  select * into e from enquetes where id = p_id;
  if not found then raise exception 'Enquete não encontrada' using errcode = 'TC404'; end if;
  return e;
end $$;

-- Fecha a enquete: guarda quando e quem, e apaga o sal (regra 3).
create function fechar_enquete(p_id uuid, p_quando timestamptz, p_por uuid) returns enquetes
language plpgsql
set search_path = public
as $$
declare e enquetes;
begin
  update enquetes set encerrada_em = p_quando, encerrada_por = p_por, sal = null where id = p_id and encerrada_em is null returning * into e;
  if e.id is not null then
    perform registrar_historico('enquete.encerrada', 'enquetes', e.id::text,
      jsonb_build_object('pelo', case when p_por is null then 'PRAZO' else 'SINDICO' end, 'resultado', resultado_enquete(e)));
  end if;
  return e;
end $$;

-- ---------------------------------------------------------------------------------------
-- Funções chamadas pela API: a aba Enquetes.

create function plataforma_enquetes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.ver');
  return jsonb_build_object(
    'enquetes', coalesce((select jsonb_agg(enquete_json(e) order by enquete_aberta(e) desc, e.criado_em desc)
                            from (select * from enquetes order by criado_em desc limit 100) e), '[]'::jsonb),
    'canais', jsonb_build_object(
      'whatsapp', exists (select 1 from conexoes_whatsapp where situacao <> 'SEM_CREDENCIAIS'),
      'email', coalesce((select email_ligado from configuracao_condominio), false),
      'mural', coalesce((select mural_ligado from configuracao_condominio), false)),
    'unidades', (select count(*) from unidades where ativa),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'enquetes.editar')));
end $$;

-- Uma enquete, com quem falta responder. Na aberta (não secreta), a escolha de cada um.
create function plataforma_enquete(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e enquetes;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.ver');
  e := exigir_enquete(p_id);
  return jsonb_build_object(
    'enquete', enquete_json(e),
    'convites', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', c.id, 'nome', coalesce(rotulo_unidade(c.unidade_id), (select nome from contatos where id = c.contato_id)),
               'respondeuEm', c.respondeu_em, 'opcao', case when not e.secreta then c.opcao end,
               'semContato', not exists (select 1 from contatos_do_convite(c))))
             order by c.respondeu_em is not null, coalesce(rotulo_unidade(c.unidade_id), (select nome from contatos where id = c.contato_id)))
        from convites_enquete c where c.enquete_id = e.id), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('acao', h.acao, 'em', h.ocorrido_em, 'autor', nome_pessoa(h.autor_id), 'dados', h.dados)
                       order by h.ocorrido_em desc, h.id desc)
        from historico h where h.entidade = 'enquetes' and h.entidade_id = e.id::text), '[]'::jsonb),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'enquetes.editar')));
end $$;

create function plataforma_criar_enquete(p_pessoa uuid, p_condominio uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e enquetes;
  c convites_enquete;
  v_pergunta text := btrim(coalesce(p_dados ->> 'pergunta', ''));
  v_opcoes text[];
  v_ate timestamptz;
  v_canais text[];
  v_campos text[] := '{}';
  v_envios integer := 0;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.editar');
  select array_agg(btrim(x) order by n) into v_opcoes
    from jsonb_array_elements_text(coalesce(p_dados -> 'opcoes', '[]'::jsonb)) with ordinality o(x, n) where btrim(x) <> '';
  select array_agg(distinct x) into v_canais from jsonb_array_elements_text(coalesce(p_dados -> 'canais', '[]'::jsonb)) x;
  begin
    v_ate := (p_dados ->> 'abertaAte')::timestamptz;
  exception when others then v_ate := null;
  end;
  if length(v_pergunta) not between 5 and 200 then v_campos := v_campos || 'pergunta'::text; end if;
  if v_opcoes is null or not opcoes_enquete_validas(v_opcoes) then v_campos := v_campos || 'opcoes'::text; end if;
  if coalesce(p_dados ->> 'por', '') not in ('UNIDADE', 'PESSOA') then v_campos := v_campos || 'por'::text; end if;
  if jsonb_typeof(p_dados -> 'secreta') is distinct from 'boolean' then v_campos := v_campos || 'secreta'::text; end if;
  if v_ate is null or v_ate < app_now() + interval '1 hour' or v_ate > app_now() + interval '90 days' then v_campos := v_campos || 'abertaAte'::text; end if;
  if v_canais is null or not (v_canais <@ array['WHATSAPP', 'MURAL', 'EMAIL']) then v_campos := v_campos || 'canais'::text; end if;
  if cardinality(v_campos) > 0 then perform recusar_campos('Confira a enquete', variadic v_campos); end if;

  insert into enquetes (condominio_id, pergunta, opcoes, por, secreta, aberta_ate, canais, lembrete_em, sal, criado_por)
  values (p_condominio, v_pergunta, v_opcoes, p_dados ->> 'por', (p_dados ->> 'secreta')::boolean, v_ate, v_canais,
          case when v_ate - interval '2 days' > app_now() + interval '12 hours' then v_ate - interval '2 days' end,
          extensions.gen_random_bytes(32), p_pessoa)
  returning * into e;
  if e.por = 'UNIDADE' then
    insert into convites_enquete (condominio_id, enquete_id, unidade_id)
    select p_condominio, e.id, u.id from unidades u where u.ativa;
  else
    insert into convites_enquete (condominio_id, enquete_id, contato_id)
    select distinct p_condominio, e.id, ct.id from contatos ct
      join contatos_unidade cu on cu.contato_id = ct.id and cu.estado = 'CONFIRMADO'
      join unidades u on u.id = cu.unidade_id and u.ativa
     where ct.dados_removidos_em is null;
  end if;
  for c in select * from convites_enquete where enquete_id = e.id loop
    v_envios := v_envios + enviar_convite_enquete(e, c, false, p_pessoa);
  end loop;
  perform registrar_historico('enquete.criada', 'enquetes', e.id::text, jsonb_build_object(
    'convites', (select count(*) from convites_enquete where enquete_id = e.id), 'envios', v_envios));
  return jsonb_build_object('id', e.id, 'versao', e.versao, 'convites', (select count(*) from convites_enquete where enquete_id = e.id),
                            'envios', v_envios);
end $$;

create function plataforma_encerrar_enquete(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e enquetes;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.editar');
  e := exigir_enquete(p_id);
  if not enquete_aberta(e) then perform recusar_motivo('A enquete já fechou', 'ENQUETE_FECHADA'); end if;
  if e.versao <> p_versao then perform conflito_versao('enquetes', p_id); end if;
  e := fechar_enquete(p_id, app_now(), p_pessoa);
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'A enquete fechou'
   where estado = 'NA_FILA' and convite_enquete_id in (select id from convites_enquete where enquete_id = p_id);
  update envios_email set estado = 'CANCELADO', motivo = 'A enquete fechou'
   where estado = 'NA_FILA' and convite_enquete_id in (select id from convites_enquete where enquete_id = p_id);
  return jsonb_build_object('versao', e.versao);
end $$;

-- O resultado vira um comunicado em rascunho, para conferir e publicar em Comunicados.
create function plataforma_publicar_enquete(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e enquetes;
  r jsonb;
  v_texto text;
  v jsonb;
  v_total integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.editar');
  e := exigir_enquete(p_id);
  if enquete_aberta(e) then perform recusar_motivo('Encerre a enquete antes de publicar o resultado', 'ENQUETE_ABERTA'); end if;
  if e.versao <> p_versao then perform conflito_versao('enquetes', p_id); end if;
  if e.encerrada_em is null then e := fechar_enquete(p_id, e.aberta_ate, null); end if;
  if e.comunicado_id is not null then
    return jsonb_build_object('comunicadoId', e.comunicado_id, 'versao', e.versao);
  end if;
  r := resultado_enquete(e);
  select sum((o ->> 'votos')::integer) into v_total from jsonb_array_elements(r -> 'opcoes') o;
  v_texto := 'Pergunta: ' || e.pergunta || E'\n\n'
    || (select string_agg(o ->> 'texto' || ': ' || (o ->> 'votos')
                          || case when v_total > 0 then ' (' || round(100.0 * (o ->> 'votos')::integer / v_total) || '%)' else '' end, E'\n' order by n)
          from jsonb_array_elements(r -> 'opcoes') with ordinality x(o, n))
    || E'\n\nResponderam ' || (r ->> 'responderam') || ' de ' || (r ->> 'total') || case when e.por = 'UNIDADE' then ' unidades' else ' pessoas' end
    || case when e.secreta then ', com respostas secretas' else '' end || '.'
    || E'\n\nA enquete é uma consulta e não tem valor de decisão de assembleia.';
  v := plataforma_salvar_comunicado(p_pessoa, p_condominio, null, null, 'AVISO', left('Resultado da enquete: ' || e.pergunta, 120),
                                    v_texto, 'TODOS', '{}', '{}', '{}', null, null, 'RASCUNHO', null);
  update enquetes set comunicado_id = (v ->> 'id')::uuid where id = p_id returning * into e;
  perform registrar_historico('enquete.resultado_publicado', 'enquetes', e.id::text, jsonb_build_object('comunicado', v ->> 'id'));
  return jsonb_build_object('comunicadoId', v ->> 'id', 'versao', e.versao);
end $$;

-- Um link para o síndico mandar por outro meio (unidade sem WhatsApp nem e-mail).
create function plataforma_link_enquete(p_pessoa uuid, p_condominio uuid, p_id uuid, p_convite uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e enquetes;
  c convites_enquete;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'enquetes.editar');
  e := exigir_enquete(p_id);
  if not enquete_aberta(e) then perform recusar_motivo('A enquete já fechou', 'ENQUETE_FECHADA'); end if;
  select * into c from convites_enquete where id = p_convite and enquete_id = p_id;
  if c.id is null then raise exception 'Convite não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico('enquete.link_gerado', 'enquetes', e.id::text,
    jsonb_build_object('para', coalesce(rotulo_unidade(c.unidade_id), (select nome from contatos where id = c.contato_id))));
  return jsonb_build_object('codigo', gerar_codigo_convite(c.id));
end $$;

-- ---------------------------------------------------------------------------------------
-- O link pessoal (decisão 8).

create function exigir_convite(p_codigo text) returns convites_enquete
language plpgsql
set search_path = public
as $$
declare
  l codigos_sem_conta;
  c convites_enquete;
begin
  l := entrar_por_codigo(upper(btrim(coalesce(p_codigo, ''))), 'ENQUETE');
  select * into c from convites_enquete where id = l.alvo_id;
  if c.id is null or l.revogado_em is not null then raise exception 'Link não encontrado' using errcode = 'TC404'; end if;
  return c;
end $$;

create function convite_publico_json(e enquetes, c convites_enquete) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'condominio', nome_do_condominio(), 'pergunta', e.pergunta, 'opcoes', to_jsonb(e.opcoes), 'por', e.por, 'secreta', e.secreta,
    'abertaAte', e.aberta_ate, 'aberta', enquete_aberta(e),
    'para', coalesce(rotulo_unidade(c.unidade_id), (select nome from contatos where id = c.contato_id)),
    'respondeuEm', c.respondeu_em,
    'escolha', case when not e.secreta then c.opcao
                    when e.sal is not null then (select opcao from respostas_secretas where enquete_id = e.id and chave = chave_secreta(e, c.id)) end,
    'resultado', case when not enquete_aberta(e) then resultado_enquete(e) end))
$$;

create function publico_enquete(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c convites_enquete;
  e enquetes;
begin
  c := exigir_convite(p_codigo);
  select * into e from enquetes where id = c.enquete_id;
  return convite_publico_json(e, c);
end $$;

create function publico_responder_enquete(p_codigo text, p_opcao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c convites_enquete;
  e enquetes;
begin
  c := exigir_convite(p_codigo);
  select * into e from enquetes where id = c.enquete_id for update;
  if not enquete_aberta(e) then perform recusar_motivo('A enquete já fechou', 'ENQUETE_FECHADA'); end if;
  if p_opcao is null or p_opcao not between 1 and cardinality(e.opcoes) then perform recusar_campos('Escolha uma opção', 'opcao'); end if;
  if e.secreta then
    insert into respostas_secretas (enquete_id, condominio_id, chave, opcao) values (e.id, e.condominio_id, chave_secreta(e, c.id), p_opcao)
    on conflict (enquete_id, chave) do update set opcao = excluded.opcao;
    update convites_enquete set respondeu_em = app_now(), trocas = trocas + case when respondeu_em is null then 0 else 1 end
     where id = c.id returning * into c;
  else
    update convites_enquete set respondeu_em = app_now(), opcao = p_opcao, trocas = trocas + case when respondeu_em is null then 0 else 1 end
     where id = c.id returning * into c;
  end if;
  return convite_publico_json(e, c);
end $$;

-- ---------------------------------------------------------------------------------------
-- Rotina: fecha as vencidas (apagando o sal) e manda o lembrete uma vez.

create function verificar_enquetes() returns integer
language plpgsql
set search_path = public
as $$
declare
  e enquetes;
  c convites_enquete;
  v_n integer := 0;
begin
  for e in select * from enquetes where encerrada_em is null and aberta_ate <= app_now() loop
    perform fechar_enquete(e.id, e.aberta_ate, null);
    v_n := v_n + 1;
  end loop;
  for e in select * from enquetes where encerrada_em is null and aberta_ate > app_now() and lembrete_em <= app_now()
                                    and lembrete_enviado_em is null for update skip locked loop
    for c in select * from convites_enquete where enquete_id = e.id and respondeu_em is null loop
      v_n := v_n + enviar_convite_enquete(e, c, true, e.criado_por);
    end loop;
    update enquetes set lembrete_enviado_em = app_now() where id = e.id;
    perform registrar_historico('enquete.lembrete', 'enquetes', e.id::text,
      jsonb_build_object('faltam', (select count(*) from convites_enquete where enquete_id = e.id and respondeu_em is null)));
  end loop;
  return v_n;
end $$;

create or replace function verificar_comunicados() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_total integer := 0;
begin
  perform set_config('app.verificador', 'on', true);
  for c in select id from condominios order by id loop
    perform set_config('app.condominio_id', c.id::text, true);
    begin
      v_total := v_total + publicar_programados() + avisar_documentos() + avisar_prontuario() + verificar_enquetes();
    exception when others then
      raise warning 'Comunicados do condomínio % não conferidos: %', c.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.condominio_id', '', true);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------
-- Envios: o código entra só na hora de enviar (WhatsApp e e-mail).

-- Antes do lote: cancela o que não vale mais (enquete fechou, já respondeu ao lembrete, pediu
-- PARAR). Depois: dá a cada envio de enquete o seu código, que a API põe no lugar de [link].
alter function whatsapp_pegar_lote(integer) rename to pegar_lote_whatsapp_r12;
alter function pegar_lote_whatsapp_r12(integer) security invoker;

create function whatsapp_pegar_lote(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lotes jsonb;
  v_saida jsonb := '[]'::jsonb;
  l jsonb;
  x jsonb;
  v_envios jsonb;
  v_convite uuid;
begin
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    update envios_whatsapp w set estado = 'CANCELADA', motivo = case
             when not enquete_aberta(e) then 'A enquete fechou'
             when w.modelo_chave = 'enquete_lembrete' and c.respondeu_em is not null then 'Já respondeu a enquete'
             else 'A pessoa pediu para parar de receber avisos' end
      from convites_enquete c, enquetes e
     where w.estado = 'NA_FILA' and w.finalidade = 'ENQUETE' and c.id = w.convite_enquete_id and e.id = c.enquete_id
       and (not enquete_aberta(e) or (w.modelo_chave = 'enquete_lembrete' and c.respondeu_em is not null)
            or exists (select 1 from contatos ct where ct.id = w.contato_id and ct.whatsapp_parou_em is not null));
  end loop;
  perform entrar_como_sistema(null);
  v_lotes := pegar_lote_whatsapp_r12(p_max);
  for l in select * from jsonb_array_elements(v_lotes) loop
    perform entrar_como_sistema((l ->> 'condominio')::uuid);
    v_envios := '[]'::jsonb;
    for x in select * from jsonb_array_elements(l -> 'envios') loop
      select convite_enquete_id into v_convite from envios_whatsapp where id = (x ->> 'envio')::uuid;
      v_envios := v_envios || jsonb_build_array(case when v_convite is not null
                                                     then x || jsonb_build_object('link', gerar_codigo_convite(v_convite)) else x end);
    end loop;
    v_saida := v_saida || jsonb_build_array(jsonb_set(l, '{envios}', v_envios));
  end loop;
  perform entrar_como_sistema(null);
  return v_saida;
end $$;

alter function montar_email(envios_email) rename to montar_email_r1b;

create function montar_email(e envios_email) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  cfg configuracao_condominio;
  ct contatos;
  c convites_enquete;
  q enquetes;
  v_cancelar text;
begin
  if e.tipo <> 'ENQUETE' then return montar_email_r1b(e); end if;
  select * into cfg from configuracao_condominio;
  select * into ct from contatos where id = e.contato_id;
  select * into c from convites_enquete where id = e.convite_enquete_id;
  select * into q from enquetes where id = c.enquete_id;
  v_cancelar := case
    when not cfg.email_ligado then 'O envio por e-mail foi desligado'
    when ct.id is null or not recebe_por_email(ct) or lower(ct.email) <> lower(e.para) then 'O contato não recebe mais por e-mail'
    when not enquete_aberta(q) then 'A enquete fechou'
    when e.lembrete and c.respondeu_em is not null then 'Já respondeu a enquete' end;
  if v_cancelar is not null then
    update envios_email set estado = 'CANCELADO', motivo = v_cancelar where id = e.id;
    return null;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'envio', e.id, 'condominio', e.condominio_id, 'tipo', e.tipo, 'para', e.para,
    'condominioNome', (select nome from condominios where id = e.condominio_id),
    'responderPara', cfg.email_responder_para, 'nome', ct.nome, 'unidades', unidades_do_contato(ct.id),
    'codigos', jsonb_build_object('responder', gerar_codigo_convite(c.id),
                                  'parar', criar_link('PARAR_EMAIL', ct.id, ct.id, e.id, ct.email, interval '1 year')),
    'enquete', jsonb_build_object('pergunta', q.pergunta, 'prazo', prazo_por_extenso(q.aberta_ate), 'dono', dono_do_convite(c),
                                  'lembrete', e.lembrete, 'secreta', q.secreta)));
end $$;

-- ---------------------------------------------------------------------------------------
-- Mural (regra 5), painel e início.

alter function publico_mural(text) rename to publico_mural_r10;
alter function publico_mural_r10(text) security invoker;

create function publico_mural(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := publico_mural_r10(p_codigo);
  if v ? 'comunicados' then
    v := v || jsonb_build_object('enquetes', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'pergunta', e.pergunta, 'opcoes', to_jsonb(e.opcoes), 'abertaAte', e.aberta_ate,
                                          'por', e.por, 'secreta', e.secreta) order by e.aberta_ate)
        from enquetes e where 'MURAL' = any (e.canais) and enquete_aberta(e)), '[]'::jsonb));
  end if;
  return v;
end $$;

create function resumo_enquetes() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'pergunta', e.pergunta, 'abertaAte', e.aberta_ate,
                                               'responderam', (select count(*) from convites_enquete c where c.enquete_id = e.id and c.respondeu_em is not null),
                                               'total', (select count(*) from convites_enquete c where c.enquete_id = e.id))
                            order by e.aberta_ate), '[]'::jsonb)
    from (select * from enquetes x where enquete_aberta(x) order by x.aberta_ate limit 3) e
$$;

alter function plataforma_painel(uuid, uuid) rename to painel_r12_reservas;
alter function painel_r12_reservas(uuid, uuid) security invoker;

create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := painel_r12_reservas(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'enquetes.ver') then
    v := v || jsonb_build_object('vida', coalesce(v -> 'vida', jsonb_build_object('reservasAAprovar', 0, 'proximasAAprovar', '[]'::jsonb))
                                         || jsonb_build_object('enquetesAbertas', resumo_enquetes()));
  end if;
  return v;
end $$;

call fechar_acesso();

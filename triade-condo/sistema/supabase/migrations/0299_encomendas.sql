-- 0299 · Portaria 1 · Encomendas (PA-01, PA-07 em parte, V-04 a V-06, CF-12, W-20, W-21, PT-01).
-- Desenho de 24/10/2026 (docs/design/telas-modelo/encomendas-*), com as notas aprovadas como
-- recomendado na mesma data (D7: cada pessoa tem conta própria com a permissão Cuidar da
-- portaria; D8: a retirada se confirma pelo nome, com foto opcional e sem código).
--
-- Regras desta parte:
-- 1. Quem registra e entrega é uma pessoa com conta própria e a permissão Cuidar da portaria
--    (ou o síndico, nos casos da regra 2). Não há conta do posto nem vizinho de plantão.
-- 2. O cenário do prédio (V-04 a V-06): na portaria presencial, o síndico cuida da portaria
--    como de tudo. Sem portaria ou com portaria remota, ninguém é presumido: só quem o
--    condomínio indicar (a permissão, ou o próprio síndico em Configurações › Portaria).
--    Sem portaria, quem foi indicado vê só o que ele mesmo registrou.
-- 3. Cuidar da portaria vê as unidades e o nome das pessoas de cada uma, sem telefone.
-- 4. O aviso sai pelo modelo "Encomenda guardada", assinado pela Nina e com o aviso contra
--    golpes (W-21), para todas as pessoas confirmadas que moram na unidade e têm WhatsApp, ao
--    mesmo tempo (PA-07 em parte: o aviso em sequência fica para a Portaria 2). Quem pediu
--    PARAR não recebe. A foto da etiqueta fica só no painel.
-- 5. "Sem aviso": ninguém da unidade pode receber (PARAR, sem contato confirmado, número fora
--    do WhatsApp ou WhatsApp desligado). "Aviso falhou": só a falha de envio. Nos dois, dá para
--    avisar de novo ou registrar "Avisei por outro meio" (interfone, bilhete ou pessoalmente).
-- 6. Entregar registra quem retirou (alguém da unidade ou outra pessoa, pelo nome), com foto
--    opcional, e quem entregou. Sem código por mensagem.
-- 7. Depois de N dias guardada (7, de saída), a encomenda entra no atalho e a unidade recebe um
--    lembrete, uma vez só, pelo mesmo modelo, com a data em que chegou. O lembrete se desliga.
-- 8. Falha de aviso de encomenda não toca o sino nem tem reenvio pelo WhatsApp: é tratada na
--    própria Portaria (avisar de novo ou outro meio).
--
-- Não depende da 0298.

-- ---------------------------------------------------------------------------------------
-- Permissões (D7). A ordem segue a última que existir.

insert into permissoes (codigo, nome, descricao, ordem)
select 'VER_PORTARIA', 'Ver a portaria', 'Acompanhar as encomendas guardadas e entregues, sem registrar nem entregar.',
       (select max(ordem) + 1 from permissoes);
insert into permissoes (codigo, nome, descricao, ordem)
select 'PORTARIA', 'Cuidar da portaria',
       'Registrar e entregar encomendas e avisar por outro meio. Vê só o nome das pessoas de cada unidade, sem telefone.',
       (select max(ordem) + 1 from permissoes);
insert into permissao_acoes (permissao, acao) values
  ('VER_PORTARIA', 'portaria.ver'),
  ('PORTARIA', 'portaria.ver'),
  ('PORTARIA', 'portaria.cuidar');
insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'portaria.ver'),
  ('SINDICO', 'portaria.cuidar');

-- ---------------------------------------------------------------------------------------
-- Configuração (CF-12): o lembrete e o síndico indicado nos prédios sem portaria presencial.

alter table configuracao_condominio
  add column portaria_lembrete_ligado boolean not null default true,
  add column portaria_lembrete_dias   integer not null default 7 check (portaria_lembrete_dias between 1 and 60),
  add column portaria_sindico         boolean not null default false;

-- Os lugares onde se guarda. Tirar de uso não apaga onde as encomendas antigas ficaram.
create table lugares_encomenda (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 2 and 40),
  ordem         integer not null default 1 check (ordem between 1 and 999),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  versao        integer not null default 1,
  unique (id, condominio_id)
);
create unique index lugares_encomenda_nome on lugares_encomenda (condominio_id, lower(btrim(nome))) where ativo;
call proteger_tabela_condominio('lugares_encomenda');
create trigger lugares_encomenda_sem_exclusao before delete on lugares_encomenda for each row execute function somente_insercao();

-- O condomínio novo nasce com um lugar, conforme o cenário; os que já existem também ganham.
alter function aplicar_modelo_configuracao(uuid, text, text) rename to aplicar_modelo_configuracao_pa1;
create function aplicar_modelo_configuracao(p_condominio uuid, p_uf text, p_cenario text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform aplicar_modelo_configuracao_pa1(p_condominio, p_uf, p_cenario);
  insert into lugares_encomenda (condominio_id, nome, ordem)
  select p_condominio, case when p_cenario in ('PORTARIA_PRESENCIAL', 'PORTARIA_REMOTA') then 'Sala da portaria' else 'Zeladoria' end, 1
   where not exists (select 1 from lugares_encomenda where condominio_id = p_condominio);
end $$;

do $$
declare r record;
begin
  for r in select id, uf, cenario from condominios loop
    perform set_config('app.condominio_id', r.id::text, true);
    insert into lugares_encomenda (condominio_id, nome, ordem)
    select r.id, case when r.cenario in ('PORTARIA_PRESENCIAL', 'PORTARIA_REMOTA') then 'Sala da portaria' else 'Zeladoria' end, 1
     where not exists (select 1 from lugares_encomenda where condominio_id = r.id);
  end loop;
  perform set_config('app.condominio_id', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- A encomenda (PA-01, PT-01).

create table encomendas (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  unidade_id     uuid not null,
  remetente      text not null check (length(btrim(remetente)) between 2 and 60),
  volumes        integer not null default 1 check (volumes between 1 and 50),
  lugar_id       uuid not null,
  observacao     text check (length(btrim(observacao)) between 1 and 200),
  estado         text not null check (estado in ('GUARDADA', 'ENTREGUE')),
  -- O aviso à unidade (regra 5). aviso_desde marca a rodada que vale (muda quando a unidade é corrigida).
  aviso          text not null default 'SEM_AVISO' check (aviso in ('AVISADA', 'SEM_AVISO', 'AVISO_FALHOU', 'OUTRO_MEIO')),
  aviso_motivo   text check (aviso_motivo in ('PAROU', 'SEM_CONTATO', 'SEM_WHATSAPP', 'WHATSAPP_DESLIGADO')),
  aviso_desde    timestamptz not null default app_now(),
  outro_meio     text check (outro_meio in ('INTERFONE', 'BILHETE', 'PESSOALMENTE')),
  outro_meio_com text check (length(btrim(outro_meio_com)) between 2 and 80),
  outro_meio_em  timestamptz,
  outro_meio_por uuid references pessoas (id),
  guardada_em    timestamptz not null default app_now(),
  guardada_por   uuid not null references pessoas (id),
  entregue_em    timestamptz,
  entregue_por   uuid references pessoas (id),
  -- Quem retirou (regra 6): uma pessoa da unidade ou outro nome, com a ligação se quiser.
  retirou_contato uuid,
  retirou_nome    text check (length(btrim(retirou_nome)) between 2 and 80),
  retirou_ligacao text check (length(btrim(retirou_ligacao)) between 2 and 60),
  lembrete_em    timestamptz,
  versao         integer not null default 1,
  unique (id, condominio_id),
  foreign key (unidade_id, condominio_id) references unidades (id, condominio_id),
  foreign key (lugar_id, condominio_id) references lugares_encomenda (id, condominio_id),
  foreign key (retirou_contato, condominio_id) references contatos (id, condominio_id),
  check ((aviso = 'SEM_AVISO') = (aviso_motivo is not null)),
  check ((aviso = 'OUTRO_MEIO') = (outro_meio is not null)),
  check ((outro_meio is null) = (outro_meio_em is null) and (outro_meio is null) = (outro_meio_por is null)),
  check (outro_meio is not null or outro_meio_com is null),
  check ((estado = 'ENTREGUE') = (entregue_em is not null) and (entregue_em is null) = (entregue_por is null)),
  check ((estado = 'ENTREGUE') = (num_nonnulls(retirou_contato, retirou_nome) = 1)),
  check (retirou_nome is not null or retirou_ligacao is null)
);
create index encomendas_estado on encomendas (condominio_id, estado, guardada_em);
create index encomendas_unidade on encomendas (unidade_id, guardada_em desc);
call proteger_tabela_condominio('encomendas');
call ligar_guardiao('encomendas');
insert into estados_iniciais (tabela, estado) values ('encomendas', 'GUARDADA');
insert into transicoes_permitidas (tabela, de, para) values ('encomendas', 'GUARDADA', 'ENTREGUE');
create trigger encomendas_sem_exclusao before delete on encomendas for each row execute function somente_insercao();

-- Entregue não muda; quem guardou e quando também não.
create function encomendas_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'ENTREGUE' and (new.unidade_id, new.remetente, new.volumes, new.lugar_id, new.observacao, new.retirou_contato,
                                  new.retirou_nome, new.retirou_ligacao, new.entregue_em, new.entregue_por)
                                 is distinct from (old.unidade_id, old.remetente, old.volumes, old.lugar_id, old.observacao,
                                                   old.retirou_contato, old.retirou_nome, old.retirou_ligacao, old.entregue_em, old.entregue_por) then
    perform recusar_motivo('Encomenda entregue não muda', 'ENCOMENDA_ENTREGUE');
  end if;
  if (new.condominio_id, new.guardada_em, new.guardada_por) is distinct from (old.condominio_id, old.guardada_em, old.guardada_por) then
    raise exception 'Quem guardou e quando não mudam' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger encomendas_regras before update on encomendas for each row execute function encomendas_regras();

-- Fotos da etiqueta e da retirada: só imagens, até 10 MB, só no painel (regra 4).
create table fotos_encomenda (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references condominios (id) on delete restrict,
  encomenda_id      uuid not null,
  tipo              text not null check (tipo in ('ETIQUETA', 'RETIRADA')),
  nome              text not null check (length(btrim(nome)) between 1 and 200),
  mime              text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_declarado integer not null check (tamanho_declarado between 1 and 10485760),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null unique,
  situacao          text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'LIBERADO', 'NAO_LIBERADO')),
  motivo_recusa     text check (length(btrim(motivo_recusa)) between 3 and 300),
  enviado_em        timestamptz not null default app_now(),
  enviado_por       uuid not null references pessoas (id),
  verificado_em     timestamptz,
  substituida_em    timestamptz,
  foreign key (encomenda_id, condominio_id) references encomendas (id, condominio_id),
  check ((situacao = 'ENVIANDO') = (verificado_em is null)),
  check ((situacao = 'LIBERADO') = (tamanho is not null)),
  check ((situacao = 'NAO_LIBERADO') = (motivo_recusa is not null))
);
create index fotos_encomenda_e on fotos_encomenda (encomenda_id, tipo, enviado_em desc);
call proteger_tabela_condominio('fotos_encomenda');
create trigger fotos_encomenda_sem_exclusao before delete on fotos_encomenda for each row execute function somente_insercao();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('portaria', 'portaria', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- O WhatsApp: a finalidade, o modelo e o número que não está no WhatsApp.

alter table envios_whatsapp drop constraint envios_whatsapp_finalidade_check;
alter table envios_whatsapp add constraint envios_whatsapp_finalidade_check
  check (finalidade in ('RESPOSTA', 'RETORNO', 'AVISO', 'CONCLUSAO', 'RESERVA', 'ENQUETE', 'ASSEMBLEIA', 'CLASSIFICADO', 'PRESTADOR',
                        'PROTOCOLO', 'AVISO_PRESTADOR', 'COMUNICADO', 'ENCOMENDA'));
alter table envios_whatsapp
  add column encomenda_id       uuid,
  add column encomenda_lembrete boolean not null default false,
  add constraint envios_whatsapp_encomenda foreign key (encomenda_id, condominio_id) references encomendas (id, condominio_id),
  add constraint envios_whatsapp_encomenda_tem_id check ((finalidade = 'ENCOMENDA') = (encomenda_id is not null)),
  add constraint envios_whatsapp_lembrete_de_encomenda check (not encomenda_lembrete or encomenda_id is not null);
create index envios_whatsapp_encomenda on envios_whatsapp (encomenda_id, criado_em) where encomenda_id is not null;

alter table modelos_whatsapp drop constraint modelos_whatsapp_chave_check;
alter table modelos_whatsapp add constraint modelos_whatsapp_chave_check
  check (chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                   'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao', 'assembleia_lembrete',
                   'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador', 'comunicado_publicado', 'encomenda_guardada'));
alter table envios_whatsapp drop constraint envios_whatsapp_modelo_chave_check;
alter table envios_whatsapp add constraint envios_whatsapp_modelo_chave_check
  check (modelo_chave in ('noticia_pedido', 'pedido_concluido', 'revisao_respondida', 'aviso_pedido_novo', 'aviso_retorno_vencido',
                          'aviso_revisao', 'reserva_decidida', 'enquete_convite', 'enquete_lembrete', 'assembleia_convocacao',
                          'assembleia_lembrete', 'anuncio_decidido', 'link_prestador', 'protocolo_pedido', 'aviso_prestador',
                          'comunicado_publicado', 'encomenda_guardada'));

-- O modelo (regra 4, W-20, W-21): aprovado no piloto com este desenho; no número oficial, vai à Meta.
insert into modelos_whatsapp (chave, numero, titulo, para, uso, variaveis, corpo, rodape, situacao, nota, decidido_em) values
  ('encomenda_guardada', 1, 'Encomenda guardada', 'MORADOR', 'Encomenda registrada na portaria e o lembrete, uma vez só, da que ficou guardada',
   '["unidade", "de quem veio e volumes", "onde está", "guardada desde", "quem recebeu", "condomínio"]',
   E'Encomenda guardada\n\nHá uma encomenda guardada para {{1}}.\n\nDe: {{2}}\nOnde está: {{3}}\nGuardada desde: {{4}}\nRecebida por: {{5}}\n\nPara retirar, diga seu nome na portaria. Pode retirar quem é da unidade ou alguém que vocês mandarem buscar.\n\nO condomínio nunca pede senha, código ou pagamento por mensagem. Na dúvida, confirme pessoalmente na portaria.\n\nNina, assistente virtual do {{6}}.',
   'Para não receber estes avisos, responda PARAR.', 'APROVADO_PILOTO',
   'Aprovado com o desenho da Portaria 1 · Encomendas, de 24/10/2026', app_now());
insert into modelos_whatsapp_eventos (modelo_id, situacao, motivo)
select id, situacao, nota from modelos_whatsapp where chave = 'encomenda_guardada';

-- O número que não está no WhatsApp: marcado pela falha do provedor, desmarcado quando o
-- telefone muda ou quando chega mensagem dele (regra 5).
alter table contatos add column whatsapp_inexistente_em timestamptz;

create function contatos_numero_inexistente() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.telefone is distinct from old.telefone then new.whatsapp_inexistente_em := null; end if;
  return new;
end $$;
create trigger contatos_numero_inexistente before update of telefone on contatos
  for each row execute function contatos_numero_inexistente();

create function mensagens_whatsapp_numero_existe() returns trigger
language plpgsql
set search_path = public
as $$
begin
  update contatos set whatsapp_inexistente_em = null
   where telefone = any (variantes_telefone(new.telefone)) and whatsapp_inexistente_em is not null and dados_removidos_em is null;
  return null;
end $$;
create trigger mensagens_whatsapp_numero_existe after insert on mensagens_whatsapp
  for each row execute function mensagens_whatsapp_numero_existe();

create function numero_fora_do_whatsapp(p_motivo text) returns boolean
language sql immutable
set search_path = public
as $$ select coalesce(p_motivo like 'O número não está no WhatsApp%', false) $$;

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- Regra 2: a portaria está aberta para a pessoa? O síndico, só na portaria presencial ou se
-- ele se indicou; quem tem a permissão, sempre.
create function portaria_aberta(p_pessoa uuid, p_condominio uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from vinculos v join vinculo_permissoes vp on vp.vinculo_id = v.id and vp.retirada_em is null
                  where v.pessoa_id = p_pessoa and v.condominio_id = p_condominio and v.revogado_em is null
                    and v.funcao = 'AUTORIZADO' and vp.permissao in ('PORTARIA', 'VER_PORTARIA'))
      or coalesce((select c.cenario = 'PORTARIA_PRESENCIAL' from condominios c where c.id = p_condominio), false)
      or coalesce((select cc.portaria_sindico from configuracao_condominio cc where cc.condominio_id = p_condominio), false)
$$;

-- Sem portaria, quem foi indicado vê só o que ele mesmo registrou; o síndico vê tudo (V-04).
create function portaria_so_minhas(p_pessoa uuid) returns boolean
language sql stable
set search_path = public
as $$
  select coalesce((select c.cenario = 'SEM_PORTARIA' from condominios c where c.id = contexto_condominio()), false)
     and not exists (select 1 from vinculos v where v.pessoa_id = p_pessoa and v.condominio_id = contexto_condominio()
                                                and v.revogado_em is null and v.funcao = 'SINDICO')
$$;

create function exigir_portaria(p_pessoa uuid, p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, p_acao);
  if not portaria_aberta(p_pessoa, p_condominio) then
    raise exception 'A portaria não está aberta para esta pessoa' using errcode = 'TC401';
  end if;
end $$;

-- O menu e as telas seguem a regra 2: sem a portaria aberta, as ações dela somem.
alter function acoes_da_pessoa(uuid, uuid) rename to acoes_da_pessoa_pa1;
create function acoes_da_pessoa(p_pessoa uuid, p_condominio uuid) returns text[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(a order by a), '{}') from unnest(acoes_da_pessoa_pa1(p_pessoa, p_condominio)) a
   where a not like 'portaria.%' or portaria_aberta(p_pessoa, p_condominio)
$$;

-- As pessoas da unidade para a portaria (regra 3): nome e papel, sem telefone; quem recebe o
-- aviso e, de quem não recebe, o motivo.
create function pessoas_encomenda(p_unidade uuid)
returns table (contato_id uuid, vinculo_id uuid, nome text, papel text, mora boolean, recebe boolean, motivo text, parou_em timestamptz,
               telefone text)
language sql stable
set search_path = public
as $$
  select ct.id, cu.id, ct.nome, papel_do_vinculo(cu), cu.mora,
         cu.mora and ct.whatsapp_parou_em is null and ct.whatsapp_inexistente_em is null,
         case when not cu.mora then 'NAO_MORA' when ct.whatsapp_parou_em is not null then 'PAROU'
              when ct.whatsapp_inexistente_em is not null then 'SEM_WHATSAPP' end,
         ct.whatsapp_parou_em, ct.telefone
    from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
   where cu.unidade_id = p_unidade and cu.estado = 'CONFIRMADO' and ct.dados_removidos_em is null
   order by cu.principal desc, cu.proprietario desc, cu.mora desc, ct.nome
$$;

-- Por que a unidade fica sem aviso, quando ninguém pode receber.
create function motivo_sem_aviso(p_unidade uuid) returns text
language sql stable
set search_path = public
as $$
  select case when (conexao_conectada()).id is null then 'WHATSAPP_DESLIGADO'
              when not exists (select 1 from pessoas_encomenda(p_unidade) p where p.mora) then 'SEM_CONTATO'
              when exists (select 1 from pessoas_encomenda(p_unidade) p where p.motivo = 'PAROU') then 'PAROU'
              else 'SEM_WHATSAPP' end
$$;

create function hora_encomenda(p timestamptz) returns text
language sql stable
set search_path = public
as $$ select to_char(p at time zone coalesce((select fuso from configuracao_condominio), 'America/Sao_Paulo'), 'HH24:MI') $$;

-- As variáveis do modelo. No lembrete, a data leva "(há N dias)".
create function parametros_encomenda(e encomendas, p_lembrete boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_array(
    rotulo_unidade(e.unidade_id),
    btrim(e.remetente) || ' · ' || e.volumes || case when e.volumes = 1 then ' volume' else ' volumes' end,
    (select nome from lugares_encomenda where id = e.lugar_id),
    dia_mes(e.guardada_em) || ' às ' || hora_encomenda(e.guardada_em)
      || case when p_lembrete then ' (há ' || greatest((hoje_no_condominio() - (e.guardada_em at time zone
                (select fuso from configuracao_condominio))::date), 1) || ' dias)' else '' end,
    nome_pessoa(e.guardada_por),
    nome_do_condominio())
$$;

-- O aviso da encomenda vale a partir de quando entra na fila. Todos os envios da rodada falharam:
-- "Aviso falhou"; todos porque o número não está no WhatsApp: "Sem aviso". Avisada por outro meio
-- não muda sozinha.
create function recalcular_aviso_encomenda(p_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  e encomendas;
  v_ok integer;
  v_total integer;
  v_fora integer;
  v_aviso text;
  v_motivo text;
begin
  select * into e from encomendas where id = p_id;
  if e.id is null or e.aviso = 'OUTRO_MEIO' then return; end if;
  select count(*) filter (where w.estado not in ('FALHOU', 'DESCONHECIDO', 'CANCELADA')), count(*),
         count(*) filter (where w.estado = 'FALHOU' and numero_fora_do_whatsapp(w.motivo))
    into v_ok, v_total, v_fora
    from envios_whatsapp w where w.encomenda_id = p_id and not w.encomenda_lembrete and w.criado_em >= e.aviso_desde;
  if v_total = 0 then v_aviso := 'SEM_AVISO'; v_motivo := motivo_sem_aviso(e.unidade_id);
  elsif v_ok > 0 then v_aviso := 'AVISADA';
  elsif v_fora = v_total then v_aviso := 'SEM_AVISO'; v_motivo := 'SEM_WHATSAPP';
  else v_aviso := 'AVISO_FALHOU';
  end if;
  update encomendas set aviso = v_aviso, aviso_motivo = v_motivo
   where id = p_id and (aviso, aviso_motivo) is distinct from (v_aviso, v_motivo);
end $$;

create function envios_whatsapp_aviso_encomenda() returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- O número que o provedor diz não estar no WhatsApp fica marcado no contato.
  if new.estado = 'FALHOU' and numero_fora_do_whatsapp(new.motivo) and new.contato_id is not null
     and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    update contatos set whatsapp_inexistente_em = app_now()
     where id = new.contato_id and whatsapp_inexistente_em is null and dados_removidos_em is null;
  end if;
  if new.encomenda_id is not null and not new.encomenda_lembrete then
    perform recalcular_aviso_encomenda(new.encomenda_id);
  end if;
  return null;
end $$;
create trigger envios_whatsapp_aviso_encomenda after insert or update of estado on envios_whatsapp
  for each row execute function envios_whatsapp_aviso_encomenda();

-- Põe o aviso na fila, um por telefone de quem recebe agora, todos ao mesmo tempo (regra 4).
-- O lembrete respeita o horário sem envio.
create function avisar_encomenda(p_id uuid, p_lembrete boolean, p_por uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  e encomendas;
  r record;
  v_params jsonb;
  v_texto text;
  v_quando timestamptz;
  v_n integer := 0;
begin
  select * into e from encomendas where id = p_id;
  if e.id is null or e.estado <> 'GUARDADA' or (conexao_conectada()).id is null then return 0; end if;
  v_params := parametros_encomenda(e, p_lembrete);
  select renderizar_modelo(m, v_params) into v_texto from modelos_whatsapp m where m.chave = 'encomenda_guardada' order by m.numero desc limit 1;
  v_quando := case when p_lembrete then fim_do_silencio(app_now()) else app_now() end;
  for r in
    select distinct on (p.telefone) p.telefone, p.contato_id from pessoas_encomenda(e.unidade_id) p
     where p.recebe order by p.telefone, p.contato_id
  loop
    insert into envios_whatsapp (condominio_id, para, contato_id, finalidade, texto, responsavel, criado_por, enviar_apos,
                                 encomenda_id, encomenda_lembrete, modelo_chave, modelo_parametros)
    values (e.condominio_id, r.telefone, r.contato_id, 'ENCOMENDA', v_texto, coalesce(p_por, e.guardada_por), p_por, v_quando,
            e.id, coalesce(p_lembrete, false), 'encomenda_guardada', v_params);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Falha de envio que a portaria resolveu (avisar de novo, outro meio ou entrega).
create function resolver_falhas_encomenda(p_id uuid, p_por uuid, p_resolucao text) returns void
language sql
set search_path = public
as $$
  update envios_whatsapp set resolvida_em = app_now(), resolvida_por = p_por, resolucao = p_resolucao
   where encomenda_id = p_id and estado in ('FALHOU', 'DESCONHECIDO') and resolvida_em is null
$$;

-- Falha de encomenda não toca o sino (regra 8); as outras, como em 0284.
create or replace function falha_whatsapp(e envios_whatsapp) returns void
language sql
set search_path = public
as $$
  select avisar_whatsapp(array[e.responsavel], 'FALHA_ENVIO', e.pedido_id, null, e.id, e.id::text)
   where e.finalidade not in ('COMUNICADO', 'ENCOMENDA')
$$;

-- E não tem reenvio pelo WhatsApp: avisa-se de novo pela Portaria (regra 8).
alter function plataforma_reenviar_whatsapp(uuid, uuid, uuid, text) rename to reenviar_whatsapp_pa1;
alter function reenviar_whatsapp_pa1(uuid, uuid, uuid, text) security invoker;
create function plataforma_reenviar_whatsapp(p_pessoa uuid, p_condominio uuid, p_envio uuid, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_whatsapp(p_pessoa, p_condominio);
  if exists (select 1 from envios_whatsapp where id = p_envio and finalidade = 'ENCOMENDA') then
    perform recusar_motivo('O aviso de encomenda se manda de novo pela Portaria', 'ENCOMENDA_PELA_PORTARIA');
  end if;
  return reenviar_whatsapp_pa1(p_pessoa, p_condominio, p_envio, p_motivo);
end $$;

create function exigir_encomenda(p_id uuid, p_pessoa uuid) returns encomendas
language plpgsql
set search_path = public
as $$
declare e encomendas;
begin
  select * into e from encomendas where id = p_id;
  if e.id is null or (portaria_so_minhas(p_pessoa) and e.guardada_por <> p_pessoa) then
    raise exception 'Encomenda não encontrada' using errcode = 'TC404';
  end if;
  return e;
end $$;

create function exigir_encomenda_guardada(p_id uuid, p_pessoa uuid) returns encomendas
language plpgsql
set search_path = public
as $$
declare e encomendas := exigir_encomenda(p_id, p_pessoa);
begin
  if e.estado <> 'GUARDADA' then perform recusar_motivo('Esta encomenda já foi entregue', 'ENCOMENDA_ENTREGUE'); end if;
  return e;
end $$;

create function exigir_lugar_encomenda(p_lugar uuid) returns lugares_encomenda
language plpgsql
set search_path = public
as $$
declare l lugares_encomenda;
begin
  select * into l from lugares_encomenda where id = p_lugar;
  if l.id is null then perform recusar_campos('Escolha onde ficou guardada', 'lugarId'); end if;
  if not l.ativo then perform recusar_motivo('Este lugar saiu de uso', 'LUGAR_FORA_DE_USO'); end if;
  return l;
end $$;

create function texto_encomenda(p text) returns text
language sql immutable
set search_path = public
as $$ select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '') $$;

create function conferir_encomenda(p_unidade uuid, p_remetente text, p_volumes integer, p_observacao text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform exigir_unidade_ativa(p_unidade);
  if length(texto_encomenda(p_remetente)) is null or length(texto_encomenda(p_remetente)) not between 2 and 60 then
    perform recusar_campos('Diga de quem veio (2 a 60 caracteres)', 'remetente');
  end if;
  if p_volumes is null or p_volumes not between 1 and 50 then perform recusar_campos('Volumes de 1 a 50', 'volumes'); end if;
  if length(texto_encomenda(p_observacao)) > 200 then perform recusar_campos('Observação até 200 caracteres', 'observacao'); end if;
end $$;

-- O que a tela mostra de cada encomenda: unidade, de quem veio, onde está, quem guardou e o aviso.
create function encomenda_json(e encomendas, p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  with envios as (
    select w.contato_id, w.estado, w.motivo, w.criado_em from envios_whatsapp w
     where w.encomenda_id = e.id and not w.encomenda_lembrete and w.criado_em >= e.aviso_desde
  ), pessoas as (select * from pessoas_encomenda(e.unidade_id))
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'unidade', jsonb_build_object('id', e.unidade_id, 'rotulo', rotulo_unidade(e.unidade_id)),
    'remetente', e.remetente,
    'volumes', e.volumes,
    'lugar', (select jsonb_build_object('id', l.id, 'nome', l.nome, 'ativo', l.ativo) from lugares_encomenda l where l.id = e.lugar_id),
    'observacao', e.observacao,
    'estado', e.estado,
    'aviso', e.aviso,
    'avisoMotivo', e.aviso_motivo,
    -- Quem recebeu (ou está para receber), quem não chegou e quem não recebe, pelo nome.
    'avisados', (select jsonb_agg(distinct ct.nome) from envios w join contatos ct on ct.id = w.contato_id
                  where w.estado not in ('FALHOU', 'DESCONHECIDO', 'CANCELADA') and ct.nome is not null),
    'naoChegou', (select jsonb_agg(distinct ct.nome) from envios w join contatos ct on ct.id = w.contato_id
                   where w.estado in ('FALHOU', 'DESCONHECIDO', 'CANCELADA') and not numero_fora_do_whatsapp(w.motivo) and ct.nome is not null
                     and not exists (select 1 from envios o where o.contato_id = w.contato_id and o.estado not in ('FALHOU', 'DESCONHECIDO', 'CANCELADA'))),
    'pararam', (select jsonb_agg(p.nome order by p.nome) from pessoas p where p.motivo = 'PAROU'),
    'semWhatsapp', (select jsonb_agg(p.nome order by p.nome) from pessoas p where p.motivo = 'SEM_WHATSAPP'),
    'moradores', (select count(*) from pessoas p where p.mora),
    'outroMeio', case when e.outro_meio is not null then jsonb_build_object(
                   'meio', e.outro_meio, 'com', e.outro_meio_com, 'em', e.outro_meio_em, 'por', nome_pessoa(e.outro_meio_por)) end,
    'guardadaEm', e.guardada_em,
    'guardadaPor', jsonb_build_object('id', e.guardada_por, 'nome', nome_pessoa(e.guardada_por), 'eu', e.guardada_por = p_pessoa),
    'entregueEm', e.entregue_em,
    'entreguePor', case when e.entregue_por is not null then jsonb_build_object('id', e.entregue_por, 'nome', nome_pessoa(e.entregue_por),
                                                                                 'eu', e.entregue_por = p_pessoa) end,
    'retirou', case when e.estado = 'ENTREGUE' then jsonb_build_object(
                 'contatoId', e.retirou_contato,
                 'nome', coalesce(e.retirou_nome, (select case when ct.dados_removidos_em is not null then 'Pessoa removida' else ct.nome end
                                                     from contatos ct where ct.id = e.retirou_contato)),
                 'ligacao', e.retirou_ligacao,
                 'daUnidade', e.retirou_contato is not null) end,
    'lembreteEm', e.lembrete_em,
    'lembrarEm', case when e.estado = 'GUARDADA' and e.lembrete_em is null and cc.portaria_lembrete_ligado
                      then e.guardada_em + make_interval(days => cc.portaria_lembrete_dias) end,
    'dias', ((case when e.estado = 'GUARDADA' then app_now() else e.entregue_em end) at time zone cc.fuso)::date
            - (e.guardada_em at time zone cc.fuso)::date,
    'antiga', e.estado = 'GUARDADA' and e.guardada_em <= app_now() - make_interval(days => cc.portaria_lembrete_dias),
    'fotoEtiqueta', (select f.id from fotos_encomenda f where f.encomenda_id = e.id and f.tipo = 'ETIQUETA' and f.situacao = 'LIBERADO'
                       and f.substituida_em is null order by f.enviado_em desc limit 1),
    'fotoRetirada', (select f.id from fotos_encomenda f where f.encomenda_id = e.id and f.tipo = 'RETIRADA' and f.situacao = 'LIBERADO'
                       and f.substituida_em is null order by f.enviado_em desc limit 1),
    'versao', e.versao))
  from configuracao_condominio cc
$$;

-- As encomendas que a pessoa vê (regra 2).
create function encomendas_visiveis(p_pessoa uuid) returns setof encomendas
language sql stable
set search_path = public
as $$
  select e.* from encomendas e where not portaria_so_minhas(p_pessoa) or e.guardada_por = p_pessoa
$$;

create function resumo_portaria(p_pessoa uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'guardadas', count(*) filter (where e.estado = 'GUARDADA'),
    'semAviso', count(*) filter (where e.estado = 'GUARDADA' and e.aviso = 'SEM_AVISO'),
    'avisoFalhou', count(*) filter (where e.estado = 'GUARDADA' and e.aviso = 'AVISO_FALHOU'),
    'antigas', count(*) filter (where e.estado = 'GUARDADA' and e.guardada_em <= app_now() - make_interval(days => cc.portaria_lembrete_dias)),
    'dias', cc.portaria_lembrete_dias)
  from configuracao_condominio cc left join encomendas_visiveis(p_pessoa) e on true
  group by cc.portaria_lembrete_dias
$$;

-- ---------------------------------------------------------------------------------------
-- A lista, as opções e a unidade.

-- Abas GUARDADAS e ENTREGUES; atalhos ANTIGAS, AVISO_FALHOU e SEM_AVISO (só nas guardadas). As
-- guardadas mais antigas por último; as entregues, a mais recente primeiro.
create function plataforma_encomendas(p_pessoa uuid, p_condominio uuid, p_aba text, p_atalho text, p_busca text, p_pagina integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := texto_encomenda(p_busca);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_dias integer;
  v_itens jsonb;
  v_total integer;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.ver');
  if coalesce(p_aba, '') not in ('GUARDADAS', 'ENTREGUES') then perform recusar_campos('Aba da lista', 'aba'); end if;
  if p_atalho is not null and (p_atalho not in ('ANTIGAS', 'AVISO_FALHOU', 'SEM_AVISO') or p_aba <> 'GUARDADAS') then
    perform recusar_campos('Atalho da lista', 'atalho');
  end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  select portaria_lembrete_dias into v_dias from configuracao_condominio;
  with base as (
    select e.* from encomendas_visiveis(p_pessoa) e
     where e.estado = case p_aba when 'GUARDADAS' then 'GUARDADA' else 'ENTREGUE' end
       and (p_atalho is null
            or (p_atalho = 'ANTIGAS' and e.guardada_em <= app_now() - make_interval(days => v_dias))
            or (p_atalho = 'AVISO_FALHOU' and e.aviso = 'AVISO_FALHOU')
            or (p_atalho = 'SEM_AVISO' and e.aviso = 'SEM_AVISO'))
       and (v_busca is null or rotulo_unidade(e.unidade_id) ilike '%' || v_busca || '%'
            or (select u.identificacao from unidades u where u.id = e.unidade_id) ilike v_busca || '%'
            or e.remetente ilike '%' || v_busca || '%')
  ), pagina as (
    select * from base
     order by case when p_aba = 'GUARDADAS' then extract(epoch from guardada_em) else -extract(epoch from entregue_em) end desc, id
     limit 50 offset (v_pagina - 1) * 50
  )
  select coalesce((select jsonb_agg(encomenda_json(p, p_pessoa)
                                    order by case when p_aba = 'GUARDADAS' then extract(epoch from p.guardada_em) else -extract(epoch from p.entregue_em) end desc, p.id)
                     from pagina p), '[]'::jsonb),
         (select count(*) from base)
    into v_itens, v_total;
  return jsonb_build_object(
    'itens', v_itens, 'total', v_total, 'pagina', v_pagina, 'porPagina', 50,
    'contagens', (select jsonb_build_object(
        'GUARDADAS', count(*) filter (where e.estado = 'GUARDADA'),
        'ENTREGUES', count(*) filter (where e.estado = 'ENTREGUE'),
        'ANTIGAS', count(*) filter (where e.estado = 'GUARDADA' and e.guardada_em <= app_now() - make_interval(days => v_dias)),
        'AVISO_FALHOU', count(*) filter (where e.estado = 'GUARDADA' and e.aviso = 'AVISO_FALHOU'),
        'SEM_AVISO', count(*) filter (where e.estado = 'GUARDADA' and e.aviso = 'SEM_AVISO'))
      from encomendas_visiveis(p_pessoa) e),
    'dias', v_dias,
    'soMinhas', portaria_so_minhas(p_pessoa),
    'pode', jsonb_build_object('cuidar', pode(p_pessoa, p_condominio, 'portaria.cuidar')));
end $$;

-- Para registrar: as unidades, os lugares em uso, o lembrete e quem está registrando.
create function plataforma_encomenda_opcoes(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.ver');
  return jsonb_build_object(
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'rotulo', rotulo_unidade(u.id), 'identificacao', u.identificacao)
                                           order by b.ordem nulls first, b.nome nulls first, u.identificacao)
                            from unidades u left join blocos b on b.id = u.bloco_id where u.ativa), '[]'::jsonb),
    'lugares', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) order by l.ordem, l.nome)
                           from lugares_encomenda l where l.ativo), '[]'::jsonb),
    'lembrete', (select jsonb_build_object('ligado', portaria_lembrete_ligado, 'dias', portaria_lembrete_dias) from configuracao_condominio),
    'cenario', (select cenario from condominios where id = p_condominio),
    'whatsapp', (conexao_conectada()).id is not null,
    'modelo', (select jsonb_build_object('titulo', m.titulo, 'corpo', m.corpo, 'rodape', m.rodape, 'situacao', m.situacao)
                 from modelos_whatsapp m where m.chave = 'encomenda_guardada' order by m.numero desc limit 1),
    'condominio', nome_do_condominio(),
    'eu', jsonb_build_object('id', p_pessoa, 'nome', nome_pessoa(p_pessoa)),
    'pode', jsonb_build_object('cuidar', pode(p_pessoa, p_condominio, 'portaria.cuidar')));
end $$;

-- Quem fica sabendo (regra 4) e quem pode retirar (regra 3), sem telefone.
create function pessoas_encomenda_json(p_unidade uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'contatoId', p.contato_id, 'nome', p.nome, 'papel', p.papel, 'mora', p.mora,
           'recebe', p.recebe and (conexao_conectada()).id is not null,
           'motivo', coalesce(p.motivo, case when (conexao_conectada()).id is null then 'WHATSAPP_DESLIGADO' end),
           'parouEm', p.parou_em))), '[]'::jsonb)
    from pessoas_encomenda(p_unidade) p
$$;

create function plataforma_encomenda_quem(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_pessoas jsonb;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.ver');
  perform exigir_unidade(p_unidade);
  v_pessoas := pessoas_encomenda_json(p_unidade);
  return jsonb_build_object(
    'unidade', jsonb_build_object('id', p_unidade, 'rotulo', rotulo_unidade(p_unidade)),
    'pessoas', v_pessoas,
    'recebem', (select count(distinct p.telefone) from pessoas_encomenda(p_unidade) p where p.recebe and (conexao_conectada()).id is not null),
    'motivoSemAviso', case when not exists (select 1 from jsonb_array_elements(v_pessoas) x where (x ->> 'recebe')::boolean)
                           then motivo_sem_aviso(p_unidade) end);
end $$;

-- A unidade vista pela portaria: o que está guardado, as últimas entregues e quem pode retirar.
create function plataforma_encomendas_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.ver');
  perform exigir_unidade(p_unidade);
  return jsonb_build_object(
    'unidade', jsonb_build_object('id', p_unidade, 'rotulo', rotulo_unidade(p_unidade)),
    'guardadas', coalesce((select jsonb_agg(encomenda_json(e, p_pessoa) order by e.guardada_em desc)
                             from encomendas_visiveis(p_pessoa) e where e.unidade_id = p_unidade and e.estado = 'GUARDADA'), '[]'::jsonb),
    'entregues', coalesce((select jsonb_agg(encomenda_json(x, p_pessoa) order by x.entregue_em desc)
                             from (select * from encomendas_visiveis(p_pessoa) e where e.unidade_id = p_unidade and e.estado = 'ENTREGUE'
                                    order by e.entregue_em desc limit 3) x), '[]'::jsonb),
    'totalEntregues', (select count(*) from encomendas_visiveis(p_pessoa) e where e.unidade_id = p_unidade and e.estado = 'ENTREGUE'),
    'pessoas', pessoas_encomenda_json(p_unidade),
    'pode', jsonb_build_object('cuidar', pode(p_pessoa, p_condominio, 'portaria.cuidar')));
end $$;

-- ---------------------------------------------------------------------------------------
-- Registrar, avisar, entregar e corrigir.

create function plataforma_registrar_encomenda(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_remetente text, p_volumes integer,
                                               p_lugar uuid, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e encomendas;
  v_n integer;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  perform conferir_encomenda(p_unidade, p_remetente, p_volumes, p_observacao);
  perform exigir_lugar_encomenda(p_lugar);
  perform definir_transicao('ENCOMENDA_GUARDADA');
  insert into encomendas (condominio_id, unidade_id, remetente, volumes, lugar_id, observacao, estado, aviso, aviso_motivo, guardada_por)
  values (p_condominio, p_unidade, texto_encomenda(p_remetente), p_volumes, p_lugar, texto_encomenda(p_observacao), 'GUARDADA',
          'SEM_AVISO', motivo_sem_aviso(p_unidade), p_pessoa)
  returning * into e;
  v_n := avisar_encomenda(e.id, false, p_pessoa);
  perform registrar_historico('unidade.encomenda_guardada', 'unidade', p_unidade::text, jsonb_build_object(
    'encomenda', e.id, 'volumes', e.volumes, 'lugar', e.lugar_id, 'avisos', v_n));
  select * into e from encomendas where id = e.id;
  return jsonb_build_object('id', e.id, 'avisos', v_n, 'encomenda', encomenda_json(e, p_pessoa));
end $$;

-- Avisar de novo: a mesma mensagem para quem recebe agora; resolve as falhas em aberto.
create function plataforma_avisar_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e encomendas;
  v_n integer;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  e := exigir_encomenda_guardada(p_id, p_pessoa);
  perform 1 from encomendas where id = e.id for update;
  if (conexao_conectada()).id is null then
    perform recusar_motivo('O WhatsApp do condomínio está desligado: avise por outro meio', 'WHATSAPP_DESCONECTADO');
  end if;
  if not exists (select 1 from pessoas_encomenda(e.unidade_id) p where p.recebe) then
    perform recusar_motivo('Ninguém da unidade recebe pelo WhatsApp: avise por outro meio', 'NINGUEM_RECEBE');
  end if;
  if exists (select 1 from envios_whatsapp where encomenda_id = e.id and estado in ('NA_FILA', 'ENVIANDO')) then
    perform recusar_motivo('O aviso ainda está saindo', 'AVISO_SAINDO');
  end if;
  perform resolver_falhas_encomenda(e.id, p_pessoa, 'Avisado de novo pela portaria');
  -- Volta a valer o que o WhatsApp disser, também depois de um aviso por outro meio.
  update encomendas set aviso = 'SEM_AVISO', aviso_motivo = motivo_sem_aviso(e.unidade_id), outro_meio = null, outro_meio_com = null,
                        outro_meio_em = null, outro_meio_por = null, aviso_desde = app_now()
   where id = e.id;
  v_n := avisar_encomenda(e.id, false, p_pessoa);
  perform registrar_historico('encomenda.avisada_de_novo', 'encomendas', e.id::text, jsonb_build_object('unidade', e.unidade_id, 'avisos', v_n));
  select * into e from encomendas where id = e.id;
  return jsonb_build_object('avisos', v_n, 'encomenda', encomenda_json(e, p_pessoa));
end $$;

create function plataforma_avisei_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_meio text, p_com text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e encomendas;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  e := exigir_encomenda_guardada(p_id, p_pessoa);
  if p_meio is null or p_meio not in ('INTERFONE', 'BILHETE', 'PESSOALMENTE') then perform recusar_campos('Diga como avisou', 'meio'); end if;
  if length(texto_encomenda(p_com)) not between 2 and 80 then perform recusar_campos('Com quem falou: 2 a 80 caracteres', 'com'); end if;
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'A portaria avisou por outro meio'
   where encomenda_id = e.id and estado = 'NA_FILA';
  perform resolver_falhas_encomenda(e.id, p_pessoa, 'Avisado pela portaria por outro meio');
  update encomendas set aviso = 'OUTRO_MEIO', aviso_motivo = null, outro_meio = p_meio, outro_meio_com = texto_encomenda(p_com),
                        outro_meio_em = app_now(), outro_meio_por = p_pessoa
   where id = e.id;
  perform registrar_historico('encomenda.avisada_outro_meio', 'encomendas', e.id::text, jsonb_build_object('unidade', e.unidade_id, 'meio', p_meio));
  select * into e from encomendas where id = e.id;
  return encomenda_json(e, p_pessoa);
end $$;

-- Entregar (regra 6): quem retirou é uma pessoa confirmada da unidade ou outro nome.
create function plataforma_entregar_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_contato uuid, p_nome text, p_ligacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e encomendas;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  e := exigir_encomenda_guardada(p_id, p_pessoa);
  if (p_contato is null) = (texto_encomenda(p_nome) is null) then
    perform recusar_campos('Escolha quem retirou: alguém da unidade ou outra pessoa, pelo nome', 'contatoId', 'nome');
  end if;
  if p_contato is not null and not exists (select 1 from pessoas_encomenda(e.unidade_id) p where p.contato_id = p_contato) then
    perform recusar_motivo('Esta pessoa não é da unidade', 'NAO_E_DA_UNIDADE');
  end if;
  if p_contato is null and length(texto_encomenda(p_nome)) not between 2 and 80 then
    perform recusar_campos('Nome de quem retirou: 2 a 80 caracteres', 'nome');
  end if;
  if p_contato is not null and texto_encomenda(p_ligacao) is not null then
    perform recusar_campos('A ligação só vale para outra pessoa', 'ligacao');
  end if;
  if length(texto_encomenda(p_ligacao)) not between 2 and 60 then perform recusar_campos('Ligação com a unidade: 2 a 60 caracteres', 'ligacao'); end if;
  perform definir_transicao('ENCOMENDA_ENTREGUE');
  update encomendas set estado = 'ENTREGUE', entregue_em = app_now(), entregue_por = p_pessoa,
                        retirou_contato = p_contato, retirou_nome = case when p_contato is null then texto_encomenda(p_nome) end,
                        retirou_ligacao = case when p_contato is null then texto_encomenda(p_ligacao) end
   where id = e.id;
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'A encomenda foi entregue'
   where encomenda_id = e.id and estado = 'NA_FILA';
  perform resolver_falhas_encomenda(e.id, p_pessoa, 'A encomenda foi entregue');
  perform registrar_historico('unidade.encomenda_entregue', 'unidade', e.unidade_id::text, jsonb_build_object(
    'encomenda', e.id, 'contato', p_contato, 'daUnidade', p_contato is not null));
  select * into e from encomendas where id = e.id;
  return encomenda_json(e, p_pessoa);
end $$;

-- Corrigir o registro enquanto está guardada. Trocou a unidade: a nova unidade é avisada.
create function plataforma_corrigir_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_unidade uuid,
                                              p_remetente text, p_volumes integer, p_lugar uuid, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e encomendas;
  v_versao integer;
  v_n integer := 0;
  v_mudou_unidade boolean;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  e := exigir_encomenda_guardada(p_id, p_pessoa);
  perform conferir_encomenda(p_unidade, p_remetente, p_volumes, p_observacao);
  if p_lugar is distinct from e.lugar_id then perform exigir_lugar_encomenda(p_lugar); end if;
  v_mudou_unidade := p_unidade <> e.unidade_id;
  update encomendas set unidade_id = p_unidade, remetente = texto_encomenda(p_remetente), volumes = p_volumes, lugar_id = p_lugar,
                        observacao = texto_encomenda(p_observacao)
   where id = e.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('encomendas', e.id); end if;
  if v_mudou_unidade then
    update envios_whatsapp set estado = 'CANCELADA', motivo = 'A encomenda era de outra unidade'
     where encomenda_id = e.id and estado = 'NA_FILA';
    perform resolver_falhas_encomenda(e.id, p_pessoa, 'A encomenda era de outra unidade');
    update encomendas set aviso = 'SEM_AVISO', aviso_motivo = motivo_sem_aviso(p_unidade), outro_meio = null, outro_meio_com = null,
                          outro_meio_em = null, outro_meio_por = null, aviso_desde = app_now(), lembrete_em = null
     where id = e.id;
    v_n := avisar_encomenda(e.id, false, p_pessoa);
    perform registrar_historico('unidade.encomenda_guardada', 'unidade', p_unidade::text, jsonb_build_object(
      'encomenda', e.id, 'volumes', p_volumes, 'lugar', p_lugar, 'avisos', v_n, 'corrigida', true));
  end if;
  perform registrar_historico('encomenda.corrigida', 'encomendas', e.id::text, jsonb_build_object(
    'unidadeAntes', e.unidade_id, 'unidade', p_unidade, 'volumesAntes', e.volumes, 'volumes', p_volumes,
    'lugarAntes', e.lugar_id, 'lugar', p_lugar));
  select * into e from encomendas where id = e.id;
  return jsonb_build_object('avisos', v_n, 'encomenda', encomenda_json(e, p_pessoa));
end $$;

-- ---------------------------------------------------------------------------------------
-- Fotos da etiqueta e da retirada (o mesmo caminho dos arquivos do comunicado, 0150).

create function exigir_foto_encomenda(p_encomenda uuid, p_foto uuid) returns fotos_encomenda
language plpgsql
set search_path = public
as $$
declare f fotos_encomenda;
begin
  select * into f from fotos_encomenda where id = p_foto and encomenda_id = p_encomenda;
  if not found then raise exception 'Foto não encontrada' using errcode = 'TC404'; end if;
  return f;
end $$;

create function plataforma_iniciar_foto_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_tipo text, p_nome text, p_mime text,
                                                  p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e encomendas;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  e := exigir_encomenda_guardada(p_id, p_pessoa);
  if p_tipo is null or p_tipo not in ('ETIQUETA', 'RETIRADA') then perform recusar_campos('Foto da etiqueta ou da retirada', 'tipo'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome'); end if;
  if p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    perform recusar_motivo('Só fotos (JPG, PNG, WEBP)', 'TIPO_NAO_ACEITO');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Arquivo com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from encomendas where id = e.id for update;
  if (select count(*) from fotos_encomenda where encomenda_id = e.id) >= 10 then
    perform recusar_motivo('Esta encomenda já tem fotos demais', 'LIMITE_FOTOS_ENCOMENDA');
  end if;
  v_caminho := p_condominio || '/' || e.id || '/' || v_id;
  insert into fotos_encomenda (id, condominio_id, encomenda_id, tipo, nome, mime, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, e.id, p_tipo, btrim(p_nome), p_mime, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('fotoId', v_id, 'caminho', v_caminho, 'tipo', p_mime);
end $$;

create function plataforma_foto_encomenda_a_verificar(p_pessoa uuid, p_condominio uuid, p_id uuid, p_foto uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare f fotos_encomenda;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  perform exigir_encomenda(p_id, p_pessoa);
  f := exigir_foto_encomenda(p_id, p_foto);
  if f.enviado_por <> p_pessoa then raise exception 'Foto não encontrada' using errcode = 'TC404'; end if;
  if f.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  return jsonb_build_object('caminho', f.caminho, 'tipo', f.mime);
end $$;

create function plataforma_verificar_foto_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_foto uuid, p_liberado boolean,
                                                    p_tamanho integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare f fotos_encomenda;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.cuidar');
  perform exigir_encomenda(p_id, p_pessoa);
  f := exigir_foto_encomenda(p_id, p_foto);
  if f.enviado_por <> p_pessoa then raise exception 'Foto não encontrada' using errcode = 'TC404'; end if;
  if f.situacao <> 'ENVIANDO' then perform recusar_motivo('O arquivo já foi verificado', 'JA_VERIFICADO'); end if;
  if p_liberado then
    -- A foto nova do mesmo tipo toma o lugar da anterior.
    update fotos_encomenda set substituida_em = app_now()
     where encomenda_id = p_id and tipo = f.tipo and situacao = 'LIBERADO' and substituida_em is null;
    update fotos_encomenda set situacao = 'LIBERADO', tamanho = p_tamanho, verificado_em = app_now() where id = f.id;
    perform registrar_historico('encomenda.foto_guardada', 'encomendas', p_id::text, jsonb_build_object('foto', f.id, 'tipo', f.tipo));
  else
    update fotos_encomenda set situacao = 'NAO_LIBERADO', motivo_recusa = left(coalesce(nullif(btrim(p_motivo), ''), 'Arquivo recusado'), 300),
                               verificado_em = app_now()
     where id = f.id;
  end if;
  return jsonb_build_object('situacao', case when p_liberado then 'LIBERADO' else 'NAO_LIBERADO' end);
end $$;

create function plataforma_abrir_foto_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_foto uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare f fotos_encomenda;
begin
  perform exigir_portaria(p_pessoa, p_condominio, 'portaria.ver');
  perform exigir_encomenda(p_id, p_pessoa);
  f := exigir_foto_encomenda(p_id, p_foto);
  if f.situacao <> 'LIBERADO' then perform recusar_motivo('Arquivo ainda não liberado', 'ARQUIVO_NAO_LIBERADO'); end if;
  return jsonb_build_object('caminho', f.caminho, 'nome', f.nome, 'tipo', f.mime);
end $$;

-- ---------------------------------------------------------------------------------------
-- Configurações › Prédio › Portaria (CF-12).

create function plataforma_portaria(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c configuracao_condominio;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.ver');
  select * into c from configuracao_condominio;
  return jsonb_build_object(
    'cenario', (select cenario from condominios where id = p_condominio),
    'lembreteLigado', c.portaria_lembrete_ligado,
    'lembreteDias', c.portaria_lembrete_dias,
    'sindicoIndicado', c.portaria_sindico,
    'versao', c.versao,
    'lugares', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', l.id, 'nome', l.nome, 'ativo', l.ativo, 'versao', l.versao,
                   'guardadas', (select count(*) from encomendas e where e.lugar_id = l.id and e.estado = 'GUARDADA'))
                 order by not l.ativo, l.ordem, l.nome) from lugares_encomenda l), '[]'::jsonb),
    -- Quem cuida da portaria: as pessoas com a permissão e, com a portaria aberta para ele, o síndico.
    'quemCuida', coalesce((select jsonb_agg(jsonb_build_object('pessoaId', x.pessoa_id, 'nome', x.nome, 'cargo', x.cargo,
                                                               'sindico', x.sindico, 'cuida', x.cuida) order by x.sindico, x.nome)
                             from (select v.pessoa_id, p.nome, v.cargo, v.funcao = 'SINDICO' as sindico,
                                          v.funcao = 'SINDICO' or exists (select 1 from vinculo_permissoes vp where vp.vinculo_id = v.id
                                                                            and vp.retirada_em is null and vp.permissao = 'PORTARIA') as cuida
                                     from vinculos v join pessoas p on p.id = v.pessoa_id
                                    where v.revogado_em is null and v.condominio_id = p_condominio
                                      and ((v.funcao = 'SINDICO' and portaria_aberta(v.pessoa_id, p_condominio))
                                           or (v.funcao = 'AUTORIZADO' and exists (
                                                 select 1 from vinculo_permissoes vp where vp.vinculo_id = v.id and vp.retirada_em is null
                                                                                       and vp.permissao in ('PORTARIA', 'VER_PORTARIA'))))) x),
                          '[]'::jsonb),
    'modelo', (select jsonb_build_object('titulo', m.titulo, 'situacao', m.situacao) from modelos_whatsapp m
                where m.chave = 'encomenda_guardada' order by m.numero desc limit 1),
    'pode', jsonb_build_object('editar', pode(p_pessoa, p_condominio, 'config.editar')));
end $$;

create function plataforma_definir_portaria(p_pessoa uuid, p_condominio uuid, p_versao integer, p_lembrete_ligado boolean,
                                            p_lembrete_dias integer, p_sindico boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c configuracao_condominio;
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if p_lembrete_ligado is null or p_sindico is null then perform recusar_campos('Diga o que fica ligado', 'lembreteLigado', 'sindicoIndicado'); end if;
  if p_lembrete_dias is null or p_lembrete_dias not between 1 and 60 then perform recusar_campos('Lembrar depois de 1 a 60 dias', 'lembreteDias'); end if;
  select * into c from configuracao_condominio;
  update configuracao_condominio set portaria_lembrete_ligado = p_lembrete_ligado, portaria_lembrete_dias = p_lembrete_dias,
                                     portaria_sindico = p_sindico
   where id = c.id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('configuracao_condominio', c.id); end if;
  perform registrar_historico('config.portaria', 'configuracao_condominio', c.id::text, jsonb_build_object(
    'lembreteLigado', p_lembrete_ligado, 'lembreteDias', p_lembrete_dias, 'sindicoIndicado', p_sindico));
  return v_versao;
end $$;

create function plataforma_salvar_lugar_encomenda(p_pessoa uuid, p_condominio uuid, p_id uuid, p_versao integer, p_nome text,
                                                  p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l lugares_encomenda;
  v_nome text := texto_encomenda(p_nome);
  v_versao integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'config.editar');
  if length(v_nome) is null or length(v_nome) not between 2 and 40 then perform recusar_campos('Nome do lugar de 2 a 40 caracteres', 'nome'); end if;
  if coalesce(p_ativo, true) and exists (select 1 from lugares_encomenda where ativo and lower(nome) = lower(v_nome) and id is distinct from p_id) then
    perform recusar_motivo('Já existe um lugar com este nome', 'LUGAR_REPETIDO');
  end if;
  if p_id is null then
    if (select count(*) from lugares_encomenda where ativo) >= 30 then perform recusar_motivo('O prédio já tem 30 lugares em uso', 'LIMITE_LUGARES'); end if;
    insert into lugares_encomenda (condominio_id, nome, ordem, criado_por)
    values (p_condominio, v_nome, coalesce((select max(ordem) from lugares_encomenda), 0) + 1, p_pessoa)
    returning * into l;
    perform registrar_historico('config.lugar_encomenda_incluido', 'lugares_encomenda', l.id::text, '{}'::jsonb);
    return jsonb_build_object('id', l.id, 'versao', l.versao);
  end if;
  select * into l from lugares_encomenda where id = p_id;
  if l.id is null then raise exception 'Lugar não encontrado' using errcode = 'TC404'; end if;
  if not coalesce(p_ativo, true) and l.ativo and (select count(*) from lugares_encomenda where ativo) = 1 then
    perform recusar_motivo('O prédio precisa de pelo menos um lugar em uso', 'ULTIMO_LUGAR');
  end if;
  update lugares_encomenda set nome = v_nome, ativo = coalesce(p_ativo, true) where id = p_id and versao = p_versao returning versao into v_versao;
  if v_versao is null then perform conflito_versao('lugares_encomenda', p_id); end if;
  perform registrar_historico(case when l.ativo and not coalesce(p_ativo, true) then 'config.lugar_encomenda_fora_de_uso'
                                   else 'config.lugar_encomenda_alterado' end, 'lugares_encomenda', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- O lembrete (regra 7): de hora em hora, uma vez por encomenda, depois de N dias guardada.

create function lembrar_encomendas() returns integer
language plpgsql
set search_path = public
as $$
declare
  c configuracao_condominio;
  e encomendas;
  v_n integer := 0;
begin
  select * into c from configuracao_condominio;
  if c.id is null or not c.portaria_lembrete_ligado then return 0; end if;
  for e in select * from encomendas where estado = 'GUARDADA' and lembrete_em is null
                                      and guardada_em <= app_now() - make_interval(days => c.portaria_lembrete_dias)
            order by guardada_em for update skip locked loop
    -- Fica marcado mesmo sem ninguém para receber: o lembrete é uma vez só.
    update encomendas set lembrete_em = app_now() where id = e.id;
    v_n := v_n + avisar_encomenda(e.id, true, null);
  end loop;
  return v_n;
end $$;

create function verificar_encomendas() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total integer := 0;
begin
  perform set_config('app.verificador', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    begin
      v_total := v_total + lembrar_encomendas();
    exception when others then
      raise warning 'Encomendas do condomínio % não conferidas: %', r.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.verificador', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('verificar-encomendas', '23 * * * *', 'select public.verificar_encomendas()');
exception when others then
  raise notice 'pg_cron indisponível: agende verificar_encomendas() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- O Início e o histórico da unidade.

alter function plataforma_painel(uuid, uuid) rename to painel_pa1;
alter function painel_pa1(uuid, uuid) security invoker;
create function plataforma_painel(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  v := painel_pa1(p_pessoa, p_condominio);
  if pode(p_pessoa, p_condominio, 'portaria.ver') and portaria_aberta(p_pessoa, p_condominio) then
    v := v || jsonb_build_object('portaria', resumo_portaria(p_pessoa));
  end if;
  return v;
end $$;

-- O histórico da unidade (0288) com a encomenda guardada e a entregue (PT-01).
alter function historico_da_unidade(uuid) rename to historico_da_unidade_pa1;
create function historico_da_unidade(p_unidade uuid)
returns table (id bigint, em timestamptz, categoria text, titulo text, detalhe text, autor text)
language sql stable
set search_path = public
as $$
  select h.id, h.em,
         case when x.acao like 'unidade.encomenda%' then 'ENCOMENDAS' else h.categoria end,
         case x.acao
           when 'unidade.encomenda_guardada' then 'Encomenda guardada'
           when 'unidade.encomenda_entregue' then 'Encomenda entregue'
           else h.titulo end,
         case x.acao
           when 'unidade.encomenda_guardada' then
             (select concat_ws(' · ', e.remetente,
                       e.volumes || case when e.volumes = 1 then ' volume' else ' volumes' end,
                       (select l.nome from lugares_encomenda l where l.id = (x.dados ->> 'lugar')::uuid),
                       case when (x.dados ->> 'corrigida')::boolean then 'registro corrigido para esta unidade' end,
                       case when (x.dados ->> 'avisos')::integer > 0 then 'unidade avisada pelo WhatsApp' else 'sem aviso pelo WhatsApp' end)
                from encomendas e where e.id = (x.dados ->> 'encomenda')::uuid)
           when 'unidade.encomenda_entregue' then
             (select concat_ws(' · ', e.remetente, 'retirou ' || coalesce(e.retirou_nome,
                       (select case when ct.dados_removidos_em is not null then 'Pessoa removida' else ct.nome end
                          from contatos ct where ct.id = e.retirou_contato)))
                from encomendas e where e.id = (x.dados ->> 'encomenda')::uuid)
           else h.detalhe end,
         h.autor
    from historico_da_unidade_pa1(p_unidade) h
    join historico x on x.id = h.id
$$;

alter function plataforma_historico_unidade(uuid, uuid, uuid, text, bigint) rename to historico_unidade_pa1;
alter function historico_unidade_pa1(uuid, uuid, uuid, text, bigint) security invoker;
create function plataforma_historico_unidade(p_pessoa uuid, p_condominio uuid, p_unidade uuid, p_categoria text, p_antes bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itens jsonb;
  v_mais boolean;
begin
  if p_categoria is distinct from 'ENCOMENDAS' then
    return historico_unidade_pa1(p_pessoa, p_condominio, p_unidade, p_categoria, p_antes);
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  perform exigir_unidade(p_unidade);
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x.id, 'em', x.em, 'categoria', x.categoria, 'titulo', x.titulo,
                                                                 'detalhe', x.detalhe, 'autor', x.autor)) order by x.em desc, x.id desc), '[]'::jsonb),
         count(*) > 30
    into v_itens, v_mais
    from (select * from historico_da_unidade(p_unidade) h
           where h.categoria = 'ENCOMENDAS' and (p_antes is null or h.id < p_antes)
           order by h.em desc, h.id desc limit 31) x;
  if v_mais then v_itens := v_itens - 30; end if;
  return jsonb_build_object(
    'unidade', rotulo_unidade(p_unidade),
    'itens', v_itens,
    'mais', v_mais,
    'total', (select count(*) from historico_da_unidade(p_unidade) h where h.categoria = 'ENCOMENDAS'),
    'desde', (select min(h.em) from historico_da_unidade(p_unidade) h));
end $$;

call fechar_acesso();

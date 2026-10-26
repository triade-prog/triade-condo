-- 0310 · Parceiros com comissão, agendamento da demonstração por link e calculadora do site
-- (R17.6; IDEIAS CM-22, CM-23 e CM-33; plano em comercial/r17-6/plano-0310.md; quadros 339
-- (parceiros), 340 (agendar, celular), 341 (agenda da equipe) e 348 (calculadora, celular)).
--
-- Decisões já tomadas (plano):
-- 1.   Parceiro é síndico profissional, administradora, construtora ou cliente que indica. O
--      interessado que chega por ele tem a origem Parceiro e o nome dele (origem fixa, CM-01).
-- 2.   A comissão nasce quando o interessado vira cliente, é recorrente por prédio ativo e o Console
--      calcula. O extrato sai em PDF (a tela monta). O.1: o pagamento é fora do sistema; o Console
--      só calcula e registra o que foi pago.
-- 3.   A regra (percentual e por quanto tempo) é da Administração (console.comercial.comissao, ação
--      nova). O Comercial vê, cadastra parceiros e registra indicações.
-- 4.   O link de agendamento vai no site, na mensagem pronta e na assinatura. O interessado escolhe um
--      horário livre da equipe; a equipe cadastra a disponibilidade e os bloqueios. A demonstração
--      entra no funil sozinha, como Demonstração marcada.
-- 5.   Confirmação e lembrete pelo Resend que já existe; sem a chave, a fila registra e não falha.
--      WhatsApp só com opt-in e a API oficial: nada sai pelo WhatsApp aqui.
-- 6.   A demonstração feita pede o registro da conversa e o próximo passo.
-- 7.   Calculadora (CM-33): unidades → valor por apartamento pela Tabela de preços, sem ROI; o contato
--      vira interessado com a faixa preenchida, pela rota do site (SITE_SEGREDO).
-- 8.   LGPD: o parceiro entra no catálogo de retenção e na anonimização; o agendamento guarda só o
--      necessário.
--
-- Mudança aprovada em 25/10/2026 (DC17, pesquisa sobre taxa de condomínio), para a calculadora:
-- 9.   Campo opcional "taxa média de condomínio do prédio (R$ por mês)", maior que zero e até
--      R$ 20.000. A tela diz quanto a TRÍADE pesa na taxa; sem ROI. No pedido de proposta, a taxa
--      segue junto e fica no interessado (taxa_condominio_media), também editável pela ficha.
-- 10.  R17.3c (CM-19 e CM-20; desenho da DC17 aprovado, quadros 445 a 447): a versão nova da
--      proposta tem a taxa opcional, que vem da ficha e fica nas premissas da versão (a versão
--      enviada não muda); o link e o kit levam a taxa; corrigir a taxa no kit grava na ficha e vale
--      para o kit e para a próxima versão. O percentual e o "menos de R$ 5" saem só do domínio.
--
-- Decisões desta rodada, onde o plano não dizia:
-- a. A comissão do mês é o percentual sobre a mensalidade contratada (a versão aceita da proposta;
--    no anual, o valor do ano dividido por 12): o Comercial não lê as cobranças do condomínio (RLS).
--    O fundador passa à tabela cheia depois dos meses de fundador. O percentual e o prazo ficam
--    congelados no dia em que o prédio vira cliente; mudar a regra vale para os próximos.
-- b. A comissão começa na primeira competência do plano (a que vence no dia 10 depois do início do
--    contrato), como a cobrança. "O prédio deixou de ser cliente" é marcado à mão pela Administração
--    (sem comissão desde o mês informado) até a renovação e o cancelamento chegarem (R17.7).
-- c. O pagamento é um por parceiro e mês, só inserção: guarda o calculado do dia, o valor pago, a
--    data, quem registrou e a observação. O extrato mostra a diferença.
-- d. O vínculo do interessado com o parceiro nasce na indicação (tela de Parceiros ou o novo
--    interessado com a origem Parceiro e o parceiro escolhido) e não muda. Contato que já estava no
--    Comercial é juntado, como hoje, sem virar indicação.
-- e. Agenda: a disponibilidade é por pessoa, em faixas por dia da semana, com duração (30 min),
--    intervalo (15), aviso mínimo em dias úteis (1) e até quantos dias à frente (14). O link pode ser
--    de uma pessoa ou da equipe (o horário vai para quem está livre e tem menos demonstrações).
--    Duas pessoas no mesmo horário: uma trava só para a agenda e uma restrição de exclusão no banco;
--    a segunda recebe HORARIO_OCUPADO.
-- f. Quem agenda pelo link junta no interessado do mesmo WhatsApp ou e-mail; aberto avança para
--    Demonstração marcada (nunca volta etapa), Perdido ou Sem resposta reabre, Ganho vira interessado
--    novo. Quem já tem demonstração marcada à frente não marca outra (a equipe remarca).
-- g. O agendamento pede e-mail (para a confirmação) e a autorização, além do que o quadro 340 mostra.
--    O e-mail fica na fila só até 90 dias depois da demonstração.
-- h. O lembrete sai às 8h do dia ou 1 hora antes, o que vier primeiro; não sai se faltar menos de
--    meia hora quando a demonstração foi marcada.
-- i. Calculadora: a rota só devolve a faixa, a tabela aplicada, a mensalidade, o valor por
--    apartamento e, no fundador, o valor depois; nunca a tabela inteira, a implantação ou as vagas.
-- j. Retenção: o contato do parceiro inativo é apagado 5 anos depois do último pagamento (ou do fim
--    da comissão) e, sem comissão nenhuma, 12 meses depois de inativado. Os tipos novos ficam como
--    "a fazer" no catálogo, como o do Comercial (32): a rotina própria do Comercial aplica.
--
-- Revisão independente do 4b7e8dc (11 achados), corrigida aqui antes de aplicar:
-- r1.  O link público só junta no interessado quando o WhatsApp E o e-mail batem com a ficha; o
--      e-mail digitado nunca vai para a ficha. Se só um bate, nasce um interessado novo marcado como
--      possível duplicado (possivel_duplicado_de), com aviso nas conversas dos dois. A confirmação e o
--      lembrete usam o nome, o condomínio e o e-mail digitados, guardados na demonstração.
-- r2.  O link público não revela o não contatar nem a demonstração já marcada: responde como se
--      tivesse marcado, sem marcar nem mandar e-mail, e avisa a equipe por dentro.
-- r3.  O pedido do site só preenche a taxa quando a ficha não tem; a diferente vai numa conversa. O
--      interessado Ganho ou fechado não muda (só a conversa entra).
-- r4.  A indicação não escreve o nome do parceiro nas conversas; apagar o parceiro reescreve as
--      conversas dos indicados que o citam e apaga a observação dos pagamentos.
-- r5.  O kit respeita a ficha: taxa tirada (taxa_condominio_em preenchida, taxa vazia) é sem taxa;
--      ficha que nunca teve taxa usa a da versão enviada.
-- r6.  Ordem das travas: a trava da agenda, depois o interessado, depois a demonstração (como a
--      anonimização), em marcar, remarcar, registrar como foi e encerrar.
-- r7.  O lembrete: o horário mais cedo entre as 8h do dia e uma hora antes que ainda esteja a pelo
--      menos 30 minutos de agora; se nenhum servir, não há lembrete.
-- r8.  A taxa digitada na versão só vai para a ficha quando a tela manda o campo, com a versão do
--      interessado (conflito) e o histórico.
-- r9.  A calculadora tem limite por aparelho do visitante (o site manda o IP) além do limite geral.
-- r10. A fila: o ENVIANDO preso de demonstração encerrada é cancelado e, com 5 tentativas, FALHOU.
-- r11. O motivo de o prédio ter saído só aparece no extrato para quem tem console.comercial.comissao.
-- E a R17.6b: o campo [link de agendamento] nas mensagens prontas (a ficha leva o link).
--
-- Reconferência do 1ac93d1 (5 achados), corrigida aqui antes de aplicar:
-- A.  A mensagem pronta leva um convite por interessado: /a/<codigo>?c=<convite>, 128 bits
--     aleatórios, guardados só como hash no interessado (os 5 últimos, um por mensagem aberta) e
--     válidos enquanto ele estiver aberto; Perdido, Ganho, Sem resposta e a anonimização revogam.
--     Com o convite, a demonstração junta naquela ficha sem exigir o e-mail; o e-mail digitado fica
--     só na demonstração e numa conversa. Sem convite (ou com um que não vale), a regra da r1.
-- B.  O parecido prefere a ficha que não é possível duplicado.
-- C.  Quem já tem demonstração marcada (WhatsApp e e-mail batendo, ou o convite) recebe a resposta
--     honesta, com a data; o não contatar segue com a resposta genérica (o risco que sobra, o
--     horário continuar livre, fica no painel). Nos dois casos, a ficha mostra o aviso em destaque
--     até alguém da equipe registrar uma conversa.
-- D.  Apagar o parceiro troca o nome por palavra inteira, sem diferença de maiúsculas, e cada parte
--     do nome com 3 letras ou mais.
-- E.  O [link de agendamento] é o de quem atende só quando a pessoa tem disponibilidade ativa e
--     continua na equipe; senão, o da equipe.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê e os parâmetros.

insert into funcao_acoes (funcao, acao) values ('ADMINISTRACAO', 'console.comercial.comissao');

insert into configuracoes (chave, valor, descricao) values
  ('limite_agenda_max', '120', 'Aberturas do link de agendamento pelo mesmo aparelho dentro da janela'),
  ('limite_agenda_janela_minutos', '60', 'Janela das aberturas do link de agendamento'),
  ('limite_agendar_max', '5', 'Agendamentos pelo link pelo mesmo aparelho dentro da janela'),
  ('limite_agendar_janela_minutos', '60', 'Janela dos agendamentos pelo link'),
  ('limite_calculadora_max', '600', 'Cálculos da calculadora do site dentro da janela (todo o site)'),
  ('limite_calculadora_janela_minutos', '10', 'Janela dos cálculos da calculadora do site'),
  ('limite_calculadora_ip_max', '60', 'Cálculos da calculadora do site pelo mesmo visitante dentro da janela'),
  ('limite_calculadora_ip_janela_minutos', '10', 'Janela dos cálculos da calculadora pelo mesmo visitante'),
  ('comercial_agenda_email_dias', '90', 'Dias depois da demonstração em que o e-mail do agendamento sai da fila (LGPD)'),
  ('comercial_parceiro_sem_comissao_meses', '12', 'Meses depois de inativado em que o contato do parceiro sem comissão é apagado'),
  ('comercial_parceiro_com_comissao_anos', '5', 'Anos depois do último pagamento ou do fim da comissão em que o contato do parceiro inativo é apagado');

insert into retencao_tipos (numero, codigo, sistema, grupo, nome, o_que, para_que, base, quem, prazo, no_fim, situacao) values
 (37, 'PARCEIRO', 'CONSOLE', 'Console TRÍADE', 'Parceiros do Comercial', 'Nome, WhatsApp, e-mail e CNPJ do parceiro; comissões e pagamentos',
  'Pagar a comissão das indicações', 'Execução do acordo de parceria; obrigação legal', 'TRÍADE',
  '5 anos depois do último pagamento; sem comissão, 12 meses depois de inativado', 'Contato apagado; ficam os valores', 'A_FAZER'),
 (38, 'AGENDAMENTO', 'CONSOLE', 'Console TRÍADE', 'Agendamento da demonstração', 'Horário marcado e o e-mail da confirmação e do lembrete',
  'Fazer a demonstração', 'Consentimento', 'TRÍADE', '90 dias depois da demonstração', 'E-mail apagado; ficam o horário e a situação', 'A_FAZER');

-- O cálculo da calculadora do site conta as vagas de fundador sem pessoa (só leitura, só a contagem).
create policy leitura_comercial on vagas_fundador for select using (comercial_sistema());
-- O link de agendamento (sem pessoa) só mostra o horário de quem ainda está ativo na equipe.
create policy leitura_agenda on equipe_triade for select using (comercial_sistema());
create policy leitura_agenda on equipe_funcoes for select using (comercial_sistema());

-- ---------------------------------------------------------------------------------------
-- 1. Parceiros (CM-22).

create table parceiros_comercial (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('SINDICO_PROFISSIONAL', 'ADMINISTRADORA', 'CONSTRUTORA', 'CLIENTE')),
  nome           text not null check (length(btrim(nome)) between 2 and 120),
  whatsapp       text check (whatsapp ~ '^55[0-9]{10,11}$'),
  email          text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  cnpj           text check (cnpj ~ '^[0-9]{14}$'),
  observacao     text check (length(btrim(observacao)) between 2 and 500),
  ativo          boolean not null default true,
  inativado_em   timestamptz,
  anonimizado_em timestamptz,
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1,
  check (ativo = (inativado_em is null)),
  check (anonimizado_em is null or (not ativo and whatsapp is null and email is null and cnpj is null and observacao is null))
);
create index parceiros_comercial_whatsapp on parceiros_comercial (whatsapp) where whatsapp is not null;
create index parceiros_comercial_email on parceiros_comercial (email) where email is not null;
call proteger_tabela_comercial('parceiros_comercial', 'console.comercial.editar',
  'Parceiros que indicam prédios ao Comercial (síndico profissional, administradora, construtora, cliente); CM-22');
create trigger parceiros_comercial_sem_exclusao before delete on parceiros_comercial for each row execute function somente_insercao();

create function parceiros_comercial_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.criado_em, new.criado_por) is distinct from (old.id, old.criado_em, old.criado_por) then
    raise exception 'O cadastro do parceiro não muda de origem' using errcode = 'TC422';
  end if;
  if old.anonimizado_em is not null then
    raise exception 'Parceiro apagado não muda' using errcode = 'TC422', detail = '{"motivo":"ANONIMIZADO"}';
  end if;
  return new;
end $$;
create trigger parceiros_comercial_regras before update on parceiros_comercial for each row execute function parceiros_comercial_regras();

-- O interessado indicado e a taxa média de condomínio informada (DC17).
alter table interessados
  add column parceiro_id uuid references parceiros_comercial (id),
  add column taxa_condominio_media numeric(10, 2) check (taxa_condominio_media > 0 and taxa_condominio_media <= 20000),
  -- Quando a ficha recebeu ou perdeu a taxa (r5): nulo é "nunca teve"; preenchido com a taxa vazia
  -- é "tirada por escolha".
  add column taxa_condominio_em timestamptz,
  -- O agendamento pelo link com o WhatsApp ou o e-mail de outro interessado, mas não os dois (r1).
  add column possivel_duplicado_de uuid references interessados (id),
  -- Os convites do link de agendamento (A): só o hash (sha256) dos 5 últimos; o convite em claro
  -- só existe na mensagem que a equipe abriu.
  add column agenda_convites bytea[],
  -- O agendamento pelo link que não marcou (C): o motivo, quando e o horário pedido, para o aviso.
  add column agendamento_recusado_em timestamptz,
  add column agendamento_recusado_motivo text check (agendamento_recusado_motivo in ('NAO_CONTATAR', 'DEMONSTRACAO_MARCADA')),
  add column agendamento_recusado_para timestamptz,
  add constraint interessados_parceiro_origem check (parceiro_id is null or origem = 'PARCEIRO'),
  add constraint interessados_duplicado_outro check (possivel_duplicado_de is distinct from id),
  add constraint interessados_convites check (agenda_convites is null
    or (cardinality(agenda_convites) between 1 and 5 and array_position(agenda_convites, null) is null)),
  add constraint interessados_agendamento_recusado check ((agendamento_recusado_em is null) = (agendamento_recusado_motivo is null)
    and (agendamento_recusado_em is null) = (agendamento_recusado_para is null));
create index interessados_parceiro on interessados (parceiro_id) where parceiro_id is not null;
create index interessados_convites on interessados using gin (agenda_convites) where agenda_convites is not null;

-- O convite vale enquanto o interessado está aberto (A): fechar ou anonimizar revoga. Gerar um
-- convite não é mexer na ficha: não muda a versão (quem está com a ficha aberta não recebe conflito).
-- Roda depois do controle_versao (ordem alfabética dos gatilhos).
create function interessados_convite_agenda() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.anonimizado_em is not null or not comercial_aberta(new.etapa) then
    new.agenda_convites := null;
  end if;
  if new.agenda_convites is distinct from old.agenda_convites
     and (to_jsonb(new) - array['agenda_convites', 'versao']) = (to_jsonb(old) - array['agenda_convites', 'versao']) then
    new.versao := old.versao;
  end if;
  return new;
end $$;
create trigger interessados_convite_agenda before update on interessados
  for each row execute function interessados_convite_agenda();

create function interessados_taxa_em() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.taxa_condominio_media is not null)
     or (tg_op = 'UPDATE' and new.taxa_condominio_media is distinct from old.taxa_condominio_media) then
    new.taxa_condominio_em := app_now();
  elsif tg_op = 'UPDATE' then
    new.taxa_condominio_em := old.taxa_condominio_em;
  end if;
  return new;
end $$;
create trigger interessados_taxa_em before insert or update of taxa_condominio_media, taxa_condominio_em on interessados
  for each row execute function interessados_taxa_em();

-- As regras da 0296 e mais: o parceiro do interessado só é posto uma vez (na indicação) e nunca muda;
-- a origem continua fixa, salvo o nome do parceiro apagado a pedido (LGPD), que sai do detalhe.
create or replace function interessados_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.origem, new.utm, new.lote_id, new.criado_em, new.criado_por, new.base_legal_em)
     is distinct from (old.origem, old.utm, old.lote_id, old.criado_em, old.criado_por, old.base_legal_em) then
    raise exception 'A origem do interessado não muda' using errcode = 'TC422', detail = '{"motivo":"ORIGEM_FIXA"}';
  end if;
  if tg_op = 'UPDATE' and new.origem_detalhe is distinct from old.origem_detalhe
     and not (comercial_sistema() and coalesce(current_setting('app.comercial_apagar_parceiro', true), '') = 'on'
              and new.origem_detalhe = 'Parceiro (dado apagado)')
     -- A indicação (r4): o nome do parceiro entra no detalhe junto com o parceiro, uma vez.
     and not (old.origem_detalhe is null and old.parceiro_id is null and new.parceiro_id is not null and new.origem = 'PARCEIRO') then
    raise exception 'A origem do interessado não muda' using errcode = 'TC422', detail = '{"motivo":"ORIGEM_FIXA"}';
  end if;
  if tg_op = 'UPDATE' and old.parceiro_id is not null and new.parceiro_id is distinct from old.parceiro_id then
    raise exception 'O parceiro do interessado não muda' using errcode = 'TC422', detail = '{"motivo":"ORIGEM_FIXA"}';
  end if;
  if tg_op = 'UPDATE' and old.parceiro_id is null and new.parceiro_id is not null and old.virou_cliente_em is not null then
    raise exception 'O parceiro entra na indicação, antes de virar cliente' using errcode = 'TC422', detail = '{"motivo":"ORIGEM_FIXA"}';
  end if;
  if tg_op = 'UPDATE' and old.anonimizado_em is not null and not comercial_sistema() then
    raise exception 'Interessado anonimizado não muda' using errcode = 'TC422', detail = '{"motivo":"ANONIMIZADO"}';
  end if;
  if exists (select 1 from unnest(new.objecoes) o where not exists (select 1 from objecoes_comercial where codigo = o)) then
    perform recusar_campos('Escolha as objeções da lista', 'objecoes');
  end if;
  if exists (select 1 from jsonb_array_elements(new.concorrentes) c
              where jsonb_typeof(c) <> 'object'
                 or exists (select 1 from jsonb_object_keys(c) k where k not in ('nome', 'preco', 'venceu'))
                 or length(btrim(coalesce(c ->> 'nome', ''))) not between 2 and 80
                 or (c ? 'preco' and jsonb_typeof(c -> 'preco') <> 'null' and coalesce(c ->> 'preco', '') !~ '^[1-9][0-9]{0,9}$')
                 or (c ? 'venceu' and jsonb_typeof(c -> 'venceu') <> 'boolean')) then
    perform recusar_campos('Confira os concorrentes', 'concorrentes');
  end if;
  return new;
end $$;

-- A regra da comissão: uma linha só; só a Administração muda (O.1).
create table regra_comissao (
  id           boolean primary key default true check (id),
  percentual   numeric(5, 2) not null check (percentual > 0 and percentual <= 100),
  -- Nulo: enquanto o prédio for cliente.
  prazo_meses  integer check (prazo_meses between 1 and 120),
  alterado_em  timestamptz,
  alterado_por uuid references pessoas (id),
  versao       integer not null default 1
);
call proteger_tabela_comercial('regra_comissao', 'console.comercial.comissao',
  'Regra da comissão dos parceiros (percentual e prazo), uma linha; só a Administração muda (CM-22, O.1)');
create trigger regra_comissao_sem_exclusao before delete on regra_comissao for each row execute function somente_insercao();
insert into regra_comissao (id, percentual, prazo_meses) values (true, 10, null);

-- A comissão de cada prédio indicado que virou cliente, com a regra e o plano daquele dia.
create table comissoes_parceiro (
  id                 uuid primary key default gen_random_uuid(),
  parceiro_id        uuid not null references parceiros_comercial (id),
  interessado_id     uuid not null unique references interessados (id),
  condominio_id      uuid references condominios (id),
  condominio         text not null check (length(btrim(condominio)) between 2 and 120),
  percentual         numeric(5, 2) not null check (percentual > 0 and percentual <= 100),
  prazo_meses        integer check (prazo_meses between 1 and 120),
  inicio             date not null check (extract(day from inicio) = 1),
  mensal_centavos    centavos not null check (mensal_centavos > 0),
  depois_centavos    centavos check (depois_centavos > 0),
  fundador_meses     integer check (fundador_meses between 1 and 60),
  -- O prédio deixou de ser cliente: sem comissão desde este mês (marcado pela Administração).
  sem_comissao_desde date check (extract(day from sem_comissao_desde) = 1),
  encerrada_motivo   text check (length(btrim(encerrada_motivo)) between 3 and 300),
  encerrada_em       timestamptz,
  encerrada_por      uuid references pessoas (id),
  criado_em          timestamptz not null default app_now(),
  versao             integer not null default 1,
  check ((sem_comissao_desde is null) = (encerrada_em is null) and (encerrada_em is null) = (encerrada_motivo is null)),
  check (sem_comissao_desde is null or sem_comissao_desde >= inicio),
  check ((depois_centavos is null) = (fundador_meses is null))
);
create index comissoes_parceiro_parceiro on comissoes_parceiro (parceiro_id);
call proteger_tabela_comercial('comissoes_parceiro', 'console.comercial.comissao',
  'Comissão por prédio indicado que virou cliente, com a regra e a mensalidade do dia (CM-22); só valores, sem dado de pessoa');
create trigger comissoes_parceiro_sem_exclusao before delete on comissoes_parceiro for each row execute function somente_insercao();

create function comissoes_parceiro_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.encerrada_em is not null
     or (new.id, new.parceiro_id, new.interessado_id, new.condominio_id, new.condominio, new.percentual, new.prazo_meses, new.inicio,
         new.mensal_centavos, new.depois_centavos, new.fundador_meses, new.criado_em)
        is distinct from (old.id, old.parceiro_id, old.interessado_id, old.condominio_id, old.condominio, old.percentual, old.prazo_meses, old.inicio,
                          old.mensal_centavos, old.depois_centavos, old.fundador_meses, old.criado_em) then
    raise exception 'A comissão só muda para encerrada, uma vez' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger comissoes_parceiro_fixas before update on comissoes_parceiro for each row execute function comissoes_parceiro_fixas();

-- O que foi pago fora do sistema (O.1): um registro por parceiro e mês, só inserção.
create table pagamentos_comissao (
  id                  uuid primary key default gen_random_uuid(),
  parceiro_id         uuid not null references parceiros_comercial (id),
  mes                 date not null check (extract(day from mes) = 1),
  calculado_centavos  bigint not null check (calculado_centavos >= 0),
  valor_centavos      bigint not null check (valor_centavos >= 0 and valor_centavos <= 100000000000),
  pago_em             date not null,
  observacao          text check (length(btrim(observacao)) between 2 and 300),
  registrado_em       timestamptz not null default app_now(),
  registrado_por      uuid not null references pessoas (id),
  unique (parceiro_id, mes)
);
call proteger_tabela_comercial('pagamentos_comissao', 'console.comercial.comissao',
  'Pagamentos de comissão feitos fora do sistema, registrados pela Administração (CM-22, O.1); só inserção');
create trigger pagamentos_comissao_sem_exclusao before delete on pagamentos_comissao for each row execute function somente_insercao();
create function pagamentos_comissao_fixos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Só inserção; a LGPD do parceiro (r4) só apaga a observação.
  if coalesce(current_setting('app.comercial_apagar_parceiro', true), '') = 'on' and new.observacao is null
     and (to_jsonb(new) - 'observacao') = (to_jsonb(old) - 'observacao') then
    return new;
  end if;
  raise exception 'O que foi registrado não se altera nem se apaga' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
end $$;
create trigger pagamentos_comissao_sem_mudanca before update on pagamentos_comissao for each row execute function pagamentos_comissao_fixos();

-- A comissão nasce quando o interessado indicado vira cliente (0308), com a versão aceita do contrato.
create function comercial_nascer_comissao() returns trigger
language plpgsql
set search_path = public
as $$
declare
  c contratos_comercial;
  v versoes_proposta;
  r regra_comissao;
  v_sistema text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_ini date;
  v_comp date;
begin
  if new.parceiro_id is null or new.virou_cliente_em is null or old.virou_cliente_em is not null then return null; end if;
  perform set_config('app.comercial_sistema', 'on', true);
  select * into c from contratos_comercial where interessado_id = new.id and situacao = 'ASSINADO' order by gerado_em desc limit 1;
  select * into v from versoes_proposta where id = c.versao_id;
  select * into r from regra_comissao;
  if v.id is not null then
    v_ini := coalesce((c.dados ->> 'dataInicio')::date, (new.virou_cliente_em at time zone 'America/Sao_Paulo')::date);
    v_comp := date_trunc('month', v_ini)::date;
    if v_comp + 9 < v_ini then v_comp := (v_comp + interval '1 month')::date; end if;
    insert into comissoes_parceiro (parceiro_id, interessado_id, condominio_id, condominio, percentual, prazo_meses, inicio, mensal_centavos,
                                    depois_centavos, fundador_meses)
    values (new.parceiro_id, new.id, new.condominio_id, v.condominio, r.percentual, r.prazo_meses, v_comp,
            case when v.ciclo = 'ANUAL' then round(v.anual_centavos::numeric / 12)::bigint else v.mensal_centavos end,
            case when v.tabela = 'FUNDADOR' and v.depois_centavos is not null then v.depois_centavos end,
            case when v.tabela = 'FUNDADOR' and v.depois_centavos is not null then 12 end)
    on conflict (interessado_id) do nothing;
  end if;
  perform set_config('app.comercial_sistema', v_sistema, true);
  return null;
end $$;
create trigger interessados_comissao after update of virou_cliente_em on interessados for each row execute function comercial_nascer_comissao();

-- A mensalidade do prédio no mês (o fundador passa à cheia depois dos meses de fundador) e a
-- comissão; nula fora do período (antes do início, depois do prazo ou sem ser mais cliente).
create function comercial_comissao_base(c comissoes_parceiro, p_mes date) returns bigint
language sql immutable
set search_path = public
as $$
  select case when c.fundador_meses is not null and p_mes >= (c.inicio + make_interval(months => c.fundador_meses))::date
              then c.depois_centavos else c.mensal_centavos end::bigint
$$;

create function comercial_comissao_mes(c comissoes_parceiro, p_mes date) returns bigint
language sql immutable
set search_path = public
as $$
  select case
    when p_mes < c.inicio then null
    when c.sem_comissao_desde is not null and p_mes >= c.sem_comissao_desde then null
    when c.prazo_meses is not null and p_mes >= (c.inicio + make_interval(months => c.prazo_meses))::date then null
    else round(comercial_comissao_base(c, p_mes) * c.percentual / 100)::bigint end
$$;

create function comercial_comissao_situacao(c comissoes_parceiro, p_mes date) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_mes < c.inicio then 'AINDA_NAO'
    when c.sem_comissao_desde is not null and p_mes >= c.sem_comissao_desde then 'ENCERRADA'
    when c.prazo_meses is not null and p_mes >= (c.inicio + make_interval(months => c.prazo_meses))::date then 'PRAZO_ACABOU'
    else 'ATIVA' end
$$;

create function comercial_mes_do(p timestamptz) returns date
language sql stable
set search_path = public
as $$ select date_trunc('month', p at time zone 'America/Sao_Paulo')::date $$;

create function comercial_parceiro_json(p parceiros_comercial) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'versao', p.versao, 'tipo', p.tipo, 'nome', p.nome, 'whatsapp', p.whatsapp, 'email', p.email, 'cnpj', p.cnpj,
    'observacao', p.observacao, 'ativo', p.ativo, 'inativadoEm', p.inativado_em, 'anonimizado', p.anonimizado_em is not null,
    'criadoEm', p.criado_em))
$$;

create function comercial_regra_json() returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('percentual', trim_scale(r.percentual), 'prazoMeses', r.prazo_meses, 'versao', r.versao,
                            'alteradoEm', r.alterado_em, 'alteradoPor', comercial_nome(r.alterado_por))
    from regra_comissao r
$$;

-- A tela de Parceiros (quadro 339): ativos, indicações do mês e sem indicação há 90 dias.
create function comercial_parceiros(p_pessoa uuid, p_mes date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := coalesce(date_trunc('month', p_mes)::date, comercial_mes_do(app_now()));
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  select coalesce(jsonb_agg(x.j order by x.ativo desc, x.nome), '[]'::jsonb) into v
    from (select p.ativo, p.nome,
                 comercial_parceiro_json(p) || jsonb_strip_nulls(jsonb_build_object(
                   'indicacoes', (select count(*) from interessados i where i.parceiro_id = p.id),
                   'indicacoesMes', (select count(*) from interessados i where i.parceiro_id = p.id and comercial_mes_do(i.criado_em) = v_mes),
                   'ultimaIndicacaoEm', (select max(i.criado_em) from interessados i where i.parceiro_id = p.id),
                   'prediosAtivos', (select count(*) from comissoes_parceiro c where c.parceiro_id = p.id and comercial_comissao_mes(c, v_mes) is not null),
                   'comissaoMes', coalesce((select sum(comercial_comissao_mes(c, v_mes)) from comissoes_parceiro c where c.parceiro_id = p.id), 0),
                   'pagoMes', (select jsonb_build_object('valor', g.valor_centavos, 'pagoEm', g.pago_em) from pagamentos_comissao g
                                where g.parceiro_id = p.id and g.mes = v_mes),
                   'semIndicacao90', p.ativo and coalesce((select max(i.criado_em) from interessados i where i.parceiro_id = p.id), p.criado_em)
                                                 < app_now() - interval '90 days')) as j
            from parceiros_comercial p) x;
  return jsonb_build_object('mes', to_char(v_mes, 'YYYY-MM'), 'regra', comercial_regra_json(), 'parceiros', v,
                            'podeEditar', pode_global('console.comercial.editar'), 'podeComissao', pode_global('console.comercial.comissao'),
                            'podeApagar', pode_global('console.comercial.excluir'));
end $$;

-- Novo parceiro ou mudança no cadastro (o mesmo WhatsApp, e-mail ou CNPJ não entra duas vezes).
create function comercial_salvar_parceiro(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cnpj     text := comercial_texto(p_dados, 'cnpj');
  v_ativo    boolean := coalesce((p_dados ->> 'ativo')::boolean, true);
  v_dup      uuid;
  v_id       uuid;
  v_versao   integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if comercial_texto(p_dados, 'tipo') is null or comercial_texto(p_dados, 'tipo') not in ('SINDICO_PROFISSIONAL', 'ADMINISTRADORA', 'CONSTRUTORA', 'CLIENTE') then
    perform recusar_campos('Escolha o tipo de parceiro', 'tipo');
  end if;
  if length(coalesce(comercial_texto(p_dados, 'nome'), '')) not between 2 and 120 then perform recusar_campos('Escreva o nome do parceiro', 'nome'); end if;
  select id into v_dup from parceiros_comercial
   where id is distinct from p_id and anonimizado_em is null
     and ((v_whatsapp is not null and whatsapp = v_whatsapp) or (v_email is not null and email = v_email) or (v_cnpj is not null and cnpj = v_cnpj))
   limit 1;
  if v_dup is not null then
    raise exception 'Este contato já é de outro parceiro' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'DUPLICADO', 'parceiroId', v_dup)::text;
  end if;
  begin
    if p_id is null then
      insert into parceiros_comercial (tipo, nome, whatsapp, email, cnpj, observacao, criado_por)
      values (comercial_texto(p_dados, 'tipo'), comercial_texto(p_dados, 'nome'), v_whatsapp, v_email, v_cnpj, comercial_texto(p_dados, 'observacao'), p_pessoa)
      returning id, versao into v_id, v_versao;
      perform registrar_historico_interno('comercial.parceiro_criado', 'parceiro_comercial', v_id::text, jsonb_build_object('tipo', comercial_texto(p_dados, 'tipo')));
    else
      update parceiros_comercial set tipo = comercial_texto(p_dados, 'tipo'), nome = comercial_texto(p_dados, 'nome'), whatsapp = v_whatsapp, email = v_email,
             cnpj = v_cnpj, observacao = comercial_texto(p_dados, 'observacao'), ativo = v_ativo,
             inativado_em = case when v_ativo then null else coalesce(inativado_em, app_now()) end,
             alterado_em = app_now(), alterado_por = p_pessoa
       where id = p_id and versao = p_versao
      returning id, versao into v_id, v_versao;
      if v_id is null then perform conflito_versao('parceiros_comercial', p_id); end if;
      perform registrar_historico_interno('comercial.parceiro', 'parceiro_comercial', v_id::text, jsonb_build_object('ativo', v_ativo));
    end if;
  exception when check_violation then
    perform recusar_campos('Confira o WhatsApp, o e-mail, o CNPJ e a observação', 'whatsapp', 'email', 'cnpj', 'observacao');
  end;
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

-- A indicação: um interessado novo com a origem Parceiro e o nome dele. O contato que já estava no
-- Comercial é juntado, como no novo interessado à mão, e não vira indicação.
create function comercial_indicar(p_pessoa uuid, p_parceiro uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p parceiros_comercial;
  r jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into p from parceiros_comercial where id = p_parceiro;
  if not found then raise exception 'Parceiro não encontrado' using errcode = 'TC404'; end if;
  if not p.ativo then perform recusar_motivo('Parceiro inativo não indica', 'PARCEIRO_INATIVO'); end if;
  -- O nome do parceiro não vai para comercial_criar, que o escreveria na conversa da entrada (r4):
  -- fica só no detalhe da origem, que a LGPD do parceiro troca.
  r := comercial_criar(p_pessoa, (p_dados - 'parceiroId' - 'origemDetalhe') || jsonb_build_object('origem', 'PARCEIRO'));
  if not (r ->> 'juntado')::boolean then
    update interessados set parceiro_id = p.id, origem_detalhe = p.nome where id = (r ->> 'id')::uuid;
    perform registrar_historico_interno('comercial.indicacao', 'parceiro_comercial', p.id::text, jsonb_build_object('interessadoId', r ->> 'id'));
  end if;
  return r || jsonb_build_object('parceiroId', p.id);
end $$;

-- O extrato do mês (quadro 339): cada prédio, desde quando, a mensalidade e a comissão; o total, o
-- que foi pago e a diferença. O perdido aparece com a comissão nula ("—").
create function comercial_extrato_parceiro(p_pessoa uuid, p_parceiro uuid, p_mes date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p parceiros_comercial;
  g pagamentos_comissao;
  v_mes date := coalesce(date_trunc('month', p_mes)::date, comercial_mes_do(app_now()));
  v_linhas jsonb;
  v_total bigint;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  select * into p from parceiros_comercial where id = p_parceiro;
  if not found then raise exception 'Parceiro não encontrado' using errcode = 'TC404'; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'comissaoId', c.id, 'versao', c.versao, 'interessadoId', c.interessado_id, 'condominio', c.condominio, 'desde', c.inicio,
           'mensalidade', comercial_comissao_base(c, v_mes), 'comissao', comercial_comissao_mes(c, v_mes),
           'situacao', comercial_comissao_situacao(c, v_mes), 'percentual', trim_scale(c.percentual), 'prazoMeses', c.prazo_meses,
           'semComissaoDesde', c.sem_comissao_desde,
           -- O motivo de o cliente ter saído é da Administração (CM-11, r11).
           'motivo', case when pode_global('console.comercial.comissao') then c.encerrada_motivo end)) order by c.inicio, c.condominio), '[]'::jsonb),
         coalesce(sum(comercial_comissao_mes(c, v_mes)), 0)
    into v_linhas, v_total
    from comissoes_parceiro c where c.parceiro_id = p.id and c.inicio <= v_mes;
  select * into g from pagamentos_comissao where parceiro_id = p.id and mes = v_mes;
  return jsonb_strip_nulls(jsonb_build_object(
    'parceiro', comercial_parceiro_json(p), 'mes', to_char(v_mes, 'YYYY-MM'), 'mesTexto', comercial_mes_texto(v_mes),
    'linhas', v_linhas, 'total', v_total, 'regra', comercial_regra_json(),
    'pago', case when g.id is not null then jsonb_strip_nulls(jsonb_build_object('valor', g.valor_centavos, 'calculado', g.calculado_centavos,
                 'pagoEm', g.pago_em, 'observacao', g.observacao, 'registradoEm', g.registrado_em, 'registradoPor', comercial_nome(g.registrado_por))) end,
    'diferenca', case when g.id is not null then v_total - g.valor_centavos end,
    'indicacoes', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'condominio', i.condominio, 'etapa', i.etapa, 'criadoEm', i.criado_em)
                                             order by i.criado_em desc), '[]'::jsonb)
                     from interessados i where i.parceiro_id = p.id),
    'podeComissao', pode_global('console.comercial.comissao')));
end $$;

create function comercial_salvar_regra_comissao(p_pessoa uuid, p_versao integer, p_percentual numeric, p_prazo_meses integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.comissao');
  if p_percentual is null or p_percentual <= 0 or p_percentual > 100 or p_percentual <> round(p_percentual, 2) then
    perform recusar_campos('O percentual vai de 0,01% a 100%', 'percentual');
  end if;
  if p_prazo_meses is not null and p_prazo_meses not between 1 and 120 then perform recusar_campos('O prazo vai de 1 a 120 meses', 'prazoMeses'); end if;
  update regra_comissao set percentual = p_percentual, prazo_meses = p_prazo_meses, alterado_em = app_now(), alterado_por = p_pessoa
   where versao = p_versao
  returning versao into v_versao;
  if v_versao is null then
    raise exception 'Outra pessoa alterou a regra' using errcode = 'TC409',
      detail = jsonb_build_object('versao', (select versao from regra_comissao), 'atual', comercial_regra_json())::text;
  end if;
  perform registrar_historico_interno('comercial.regra_comissao', 'regra_comissao', 'regra',
    jsonb_build_object('percentual', trim_scale(p_percentual), 'prazoMeses', p_prazo_meses));
  return comercial_regra_json();
end $$;

-- "Marcar como pago" guarda quem e quando (quadro 339). Só mês que já começou.
create function comercial_registrar_pagamento(p_pessoa uuid, p_parceiro uuid, p_mes date, p_valor bigint, p_pago_em date, p_observacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_calc bigint;
  v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.comissao');
  if not exists (select 1 from parceiros_comercial where id = p_parceiro) then raise exception 'Parceiro não encontrado' using errcode = 'TC404'; end if;
  if v_mes is null or v_mes > comercial_mes_do(app_now()) then perform recusar_campos('Escolha um mês que já começou', 'mes'); end if;
  if p_valor is null or p_valor < 0 or p_valor > 100000000000 then perform recusar_campos('Informe o valor pago', 'valor'); end if;
  if p_pago_em is null or p_pago_em > comercial_hoje() or p_pago_em < v_mes then perform recusar_campos('A data do pagamento vai do mês até hoje', 'pagoEm'); end if;
  select coalesce(sum(comercial_comissao_mes(c, v_mes)), 0) into v_calc from comissoes_parceiro c where c.parceiro_id = p_parceiro;
  begin
    insert into pagamentos_comissao (parceiro_id, mes, calculado_centavos, valor_centavos, pago_em, observacao, registrado_por)
    values (p_parceiro, v_mes, v_calc, p_valor, p_pago_em, nullif(btrim(p_observacao), ''), p_pessoa)
    returning id into v_id;
  exception
    when unique_violation then perform recusar_motivo('O pagamento deste mês já foi registrado', 'PAGAMENTO_REGISTRADO');
    when check_violation then perform recusar_campos('Confira a observação', 'observacao');
  end;
  perform registrar_historico_interno('comercial.comissao_paga', 'parceiro_comercial', p_parceiro::text,
    jsonb_build_object('mes', to_char(v_mes, 'YYYY-MM'), 'valor', p_valor, 'calculado', v_calc));
  return jsonb_build_object('id', v_id, 'calculado', v_calc, 'valor', p_valor, 'diferenca', v_calc - p_valor);
end $$;

-- O prédio deixou de ser cliente: sem comissão desde o mês informado (até a R17.7 ligar isso ao
-- cancelamento do plano).
create function comercial_encerrar_comissao(p_pessoa uuid, p_id uuid, p_versao integer, p_desde date, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c comissoes_parceiro;
  v_desde date := date_trunc('month', p_desde)::date;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.comissao');
  select * into c from comissoes_parceiro where id = p_id for update;
  if not found then raise exception 'Comissão não encontrada' using errcode = 'TC404'; end if;
  if c.versao <> p_versao then perform conflito_versao('comissoes_parceiro', p_id); end if;
  if c.encerrada_em is not null then perform recusar_motivo('Esta comissão já foi encerrada', 'COMISSAO_ENCERRADA'); end if;
  if v_desde is null or v_desde < c.inicio then perform recusar_campos('O mês vai do início da comissão em diante', 'desde'); end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then perform recusar_campos('Diga por que o prédio saiu', 'motivo'); end if;
  update comissoes_parceiro set sem_comissao_desde = v_desde, encerrada_motivo = btrim(p_motivo), encerrada_em = app_now(), encerrada_por = p_pessoa
   where id = p_id
  returning versao into v_versao;
  perform registrar_historico_interno('comercial.comissao_encerrada', 'comissao_parceiro', p_id::text,
    jsonb_build_object('desde', to_char(v_desde, 'YYYY-MM')));
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- O texto escapado para entrar numa expressão regular como ele é (D).
create function comercial_regex_literal(p text) returns text
language sql immutable
set search_path = public
as $$ select regexp_replace(p, '([.\\+*?\[^\]$(){}=!<>|:\-#/])', '\\\1', 'g') $$;

-- Apagar o contato do parceiro (LGPD): a pedido (Administração) ou pela rotina. Ficam o tipo, os
-- valores e as indicações; o nome sai do detalhe da origem dos interessados.
create function comercial_anonimizar_parceiro(p_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  v_sistema text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_nome text;
  v_padrao text;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  perform set_config('app.comercial_apagar_parceiro', 'on', true);
  select nome into v_nome from parceiros_comercial where id = p_id and anonimizado_em is null;
  update parceiros_comercial set nome = 'Parceiro apagado (LGPD)', whatsapp = null, email = null, cnpj = null, observacao = null,
         ativo = false, inativado_em = coalesce(inativado_em, app_now()), anonimizado_em = app_now()
   where id = p_id and anonimizado_em is null;
  update interessados set origem_detalhe = 'Parceiro (dado apagado)'
   where parceiro_id = p_id and origem_detalhe is distinct from 'Parceiro (dado apagado)';
  -- As conversas dos indicados que citam o nome (escritas à mão pela equipe, ou antes da r4) e a
  -- observação dos pagamentos (r4). Por palavra inteira e sem diferença de maiúsculas (D): o nome
  -- todo e depois cada parte com 3 letras ou mais ("Marta Lins": "Marta Lins", "Marta" e "Lins"),
  -- sem estragar outra palavra ("Ana" não mexe em "banana").
  if v_nome is not null and length(btrim(v_nome)) >= 2 then
    for v_padrao in
      select '\m' || comercial_regex_literal(t) || '\M'
        from (select btrim(v_nome) as t, 0 as ordem
              union all
              select p, 1 from regexp_split_to_table(btrim(v_nome), '\s+') p where char_length(p) >= 3 and p <> btrim(v_nome)) x
       order by x.ordem, char_length(x.t) desc
    loop
      update conversas_comercial c set resumo = regexp_replace(c.resumo, v_padrao, 'Parceiro (dado apagado)', 'gi')
        from interessados i
       where i.id = c.interessado_id and i.parceiro_id = p_id and c.resumo ~* v_padrao;
    end loop;
  end if;
  update pagamentos_comissao set observacao = null where parceiro_id = p_id and observacao is not null;
  perform set_config('app.comercial_apagar_parceiro', '', true);
  perform set_config('app.comercial_sistema', v_sistema, true);
end $$;

create function comercial_apagar_parceiro(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.excluir');
  if not exists (select 1 from parceiros_comercial where id = p_id) then raise exception 'Parceiro não encontrado' using errcode = 'TC404'; end if;
  perform comercial_anonimizar_parceiro(p_id);
  perform registrar_historico_interno('comercial.parceiro_apagado', 'parceiro_comercial', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'anonimizado', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. Agenda da demonstração (CM-23).

-- Faixas de horário: [{"dia": 1..7 (segunda = 1), "de": "09:00", "ate": "12:00"}], até 21.
create function agenda_faixas_validas(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 21
     and not exists (
       select 1 from jsonb_array_elements(p) x
        where jsonb_typeof(x) <> 'object'
           or exists (select 1 from jsonb_object_keys(x) k where k not in ('dia', 'de', 'ate'))
           or coalesce(x ->> 'dia', '') !~ '^[1-7]$'
           or coalesce(x ->> 'de', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           or coalesce(x ->> 'ate', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           or (x ->> 'de') >= (x ->> 'ate'))
$$;

create table disponibilidade_comercial (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid not null unique references pessoas (id),
  faixas            jsonb not null default '[]' check (agenda_faixas_validas(faixas)),
  duracao_minutos   integer not null default 30 check (duracao_minutos between 15 and 120),
  intervalo_minutos integer not null default 15 check (intervalo_minutos between 0 and 60),
  aviso_dias_uteis  integer not null default 1 check (aviso_dias_uteis between 0 and 10),
  horizonte_dias    integer not null default 14 check (horizonte_dias between 1 and 60),
  -- O link da chamada de vídeo, que vai na confirmação.
  sala_url          text check (sala_url ~ '^https://[^\s<>"]{3,}$' and length(sala_url) <= 300),
  ativa             boolean not null default true,
  criado_em         timestamptz not null default app_now(),
  criado_por        uuid references pessoas (id),
  alterado_em       timestamptz,
  alterado_por      uuid references pessoas (id),
  versao            integer not null default 1
);
call proteger_tabela_comercial('disponibilidade_comercial', 'console.comercial.editar',
  'Horários livres de cada pessoa da equipe para a demonstração (CM-23); sem dado de quem agenda');
create trigger disponibilidade_comercial_sem_exclusao before delete on disponibilidade_comercial for each row execute function somente_insercao();

create table bloqueios_comercial (
  id           uuid primary key default gen_random_uuid(),
  pessoa_id    uuid not null references pessoas (id),
  de           timestamptz not null,
  ate          timestamptz not null,
  motivo       text check (length(btrim(motivo)) between 2 and 120),
  cancelado_em timestamptz,
  cancelado_por uuid references pessoas (id),
  criado_em    timestamptz not null default app_now(),
  criado_por   uuid references pessoas (id),
  check (ate > de and ate <= de + interval '60 days')
);
create index bloqueios_comercial_pessoa on bloqueios_comercial (pessoa_id, de) where cancelado_em is null;
call proteger_tabela_comercial('bloqueios_comercial', 'console.comercial.editar',
  'Bloqueios na agenda de demonstração da equipe (folga, reunião); CM-23');
create trigger bloqueios_comercial_sem_exclusao before delete on bloqueios_comercial for each row execute function somente_insercao();

-- O link público: de uma pessoa ou da equipe (pessoa nula). O código não dá acesso a dado nenhum,
-- só à grade de horários; fica em claro para a equipe copiar de novo.
create table links_agenda (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique check (codigo ~ '^[a-z2-9]{12}$'),
  pessoa_id     uuid references pessoas (id),
  criado_em     timestamptz not null default app_now(),
  criado_por    uuid references pessoas (id),
  revogado_em   timestamptz,
  revogado_por  uuid references pessoas (id)
);
create unique index links_agenda_um_por_pessoa on links_agenda (coalesce(pessoa_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revogado_em is null;
call proteger_tabela_comercial('links_agenda', 'console.comercial.editar', 'Links públicos de agendamento da demonstração (CM-23)');
create trigger links_agenda_sem_exclusao before delete on links_agenda for each row execute function somente_insercao();

create table demonstracoes_comercial (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  pessoa_id      uuid not null references pessoas (id),
  inicio         timestamptz not null,
  fim            timestamptz not null,
  situacao       text not null default 'MARCADA' check (situacao in ('MARCADA', 'FEITA', 'NAO_COMPARECEU', 'CANCELADA')),
  origem         text not null check (origem in ('LINK', 'MAO')),
  link_id        uuid references links_agenda (id),
  remarcacoes    integer not null default 0 check (remarcacoes between 0 and 20),
  motivo         text check (length(btrim(motivo)) between 3 and 300),
  encerrada_em   timestamptz,
  encerrada_por  uuid references pessoas (id),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1,
  -- O que a pessoa digitou no link (r1): a confirmação e o lembrete usam isto, nunca a ficha. O
  -- e-mail e o nome saem 90 dias depois da demonstração, como a fila.
  nome_contato   text check (length(btrim(nome_contato)) between 2 and 80),
  condominio     text check (length(btrim(condominio)) between 2 and 120),
  email          text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  check (fim > inicio and fim <= inicio + interval '4 hours'),
  check ((situacao = 'MARCADA') = (encerrada_em is null)),
  check (situacao <> 'CANCELADA' or motivo is not null),
  -- Duas demonstrações da mesma pessoa nunca se sobrepõem (a última barreira da corrida).
  constraint demonstracoes_sem_sobrepor exclude using gist (pessoa_id with =, tstzrange(inicio, fim) with &&) where (situacao = 'MARCADA')
);
create index demonstracoes_comercial_interessado on demonstracoes_comercial (interessado_id);
create index demonstracoes_comercial_inicio on demonstracoes_comercial (inicio) where situacao = 'MARCADA';
call proteger_tabela_comercial('demonstracoes_comercial', 'console.comercial.editar',
  'Demonstrações marcadas pelo link ou pela equipe (CM-23); guarda só o horário, quem faz e a situação');
create trigger demonstracoes_comercial_sem_exclusao before delete on demonstracoes_comercial for each row execute function somente_insercao();

create function demonstracoes_comercial_fixas() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.interessado_id, new.origem, new.link_id, new.criado_em, new.criado_por)
     is distinct from (old.id, old.interessado_id, old.origem, old.link_id, old.criado_em, old.criado_por) then
    raise exception 'Demonstração encerrada não muda' using errcode = 'TC422', detail = '{"motivo":"DEMONSTRACAO_ENCERRADA"}';
  end if;
  -- Encerrada, só apaga o que a pessoa digitou (retenção e anonimização).
  if old.situacao <> 'MARCADA'
     and not ((to_jsonb(new) - array['nome_contato', 'condominio', 'email', 'versao', 'alterado_em', 'alterado_por'])
              = (to_jsonb(old) - array['nome_contato', 'condominio', 'email', 'versao', 'alterado_em', 'alterado_por'])
              and (new.nome_contato is null or new.nome_contato = old.nome_contato)
              and (new.condominio is null or new.condominio = old.condominio)
              and (new.email is null or new.email = old.email)) then
    raise exception 'Demonstração encerrada não muda' using errcode = 'TC422', detail = '{"motivo":"DEMONSTRACAO_ENCERRADA"}';
  end if;
  return new;
end $$;
create trigger demonstracoes_comercial_fixas before update on demonstracoes_comercial for each row execute function demonstracoes_comercial_fixas();

-- A fila da confirmação, do lembrete e do aviso de cancelamento (pelo Resend da api-console).
create table emails_comercial (
  id              uuid primary key default gen_random_uuid(),
  demonstracao_id uuid not null references demonstracoes_comercial (id),
  tipo            text not null check (tipo in ('CONFIRMACAO', 'LEMBRETE', 'CANCELAMENTO')),
  para            text check (para = lower(para) and para ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(para) <= 120),
  enviar_em       timestamptz not null,
  situacao        text not null default 'NA_FILA' check (situacao in ('NA_FILA', 'ENVIANDO', 'ENVIADO', 'FALHOU', 'SEM_CHAVE', 'CANCELADO')),
  tentativas      integer not null default 0 check (tentativas between 0 and 10),
  pego_em         timestamptz,
  provedor_id     text check (length(provedor_id) <= 120),
  erro            text check (length(erro) <= 300),
  enviado_em      timestamptz,
  criado_em       timestamptz not null default app_now(),
  check (para is not null or situacao not in ('NA_FILA', 'ENVIANDO'))
);
create index emails_comercial_fila on emails_comercial (enviar_em) where situacao in ('NA_FILA', 'ENVIANDO');
create index emails_comercial_demonstracao on emails_comercial (demonstracao_id);
call proteger_tabela_comercial('emails_comercial', 'console.comercial.editar',
  'Fila do e-mail de confirmação e lembrete da demonstração (CM-23); o e-mail sai 90 dias depois');
create trigger emails_comercial_sem_exclusao before delete on emails_comercial for each row execute function somente_insercao();

-- "terça, 28/10, 14:00", no horário de Brasília.
create function comercial_quando(p timestamptz) returns text
language sql stable
set search_path = public
as $$
  select (array['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'])[extract(isodow from p at time zone 'America/Sao_Paulo')::integer]
         || ', ' || to_char(p at time zone 'America/Sao_Paulo', 'DD/MM, HH24:MI')
$$;

-- O primeiro dia que a agenda mostra: hoje mais o aviso mínimo, em dias úteis (segunda a sexta).
create function comercial_primeiro_dia_agenda(p_dias_uteis integer) returns date
language plpgsql stable
set search_path = public
as $$
declare
  v date := comercial_hoje();
  n integer := 0;
begin
  while n < coalesce(p_dias_uteis, 0) loop
    v := v + 1;
    if extract(isodow from v) < 6 then n := n + 1; end if;
  end loop;
  return v;
end $$;

-- A grade: cada horário da disponibilidade, de hoje (com o aviso) até o horizonte de cada pessoa,
-- livre se não tem bloqueio nem outra demonstração marcada (com o intervalo antes e depois).
create function comercial_grade_agenda(p_pessoas uuid[], p_ate date)
returns table (pessoa_id uuid, inicio timestamptz, fim timestamptz, livre boolean)
language sql stable
set search_path = public
as $$
  with d as (
    select d.pessoa_id, d.faixas, d.duracao_minutos, d.intervalo_minutos, d.horizonte_dias, comercial_primeiro_dia_agenda(d.aviso_dias_uteis) as primeiro
      from disponibilidade_comercial d
     where d.ativa and (p_pessoas is null or d.pessoa_id = any (p_pessoas))
       and exists (select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
                    where e.pessoa_id = d.pessoa_id and e.ativa and ef.retirada_em is null and ef.funcao in ('COMERCIAL', 'ADMINISTRACAO'))
  ), s as (
    select d.pessoa_id, d.intervalo_minutos, (x.hora at time zone 'America/Sao_Paulo') as inicio,
           (x.hora at time zone 'America/Sao_Paulo') + make_interval(mins => d.duracao_minutos) as fim
      from d
      cross join lateral generate_series(d.primeiro::timestamp, least(p_ate, comercial_hoje() + d.horizonte_dias)::timestamp, interval '1 day') g(dia)
      cross join lateral jsonb_array_elements(d.faixas) f
      cross join lateral generate_series(g.dia + (f ->> 'de')::time, g.dia + (f ->> 'ate')::time - make_interval(mins => d.duracao_minutos),
                                         make_interval(mins => d.duracao_minutos + d.intervalo_minutos)) x(hora)
     where extract(isodow from g.dia) = (f ->> 'dia')::integer
  )
  select distinct on (s.pessoa_id, s.inicio) s.pessoa_id, s.inicio, s.fim,
         not exists (select 1 from bloqueios_comercial b
                      where b.pessoa_id = s.pessoa_id and b.cancelado_em is null and tstzrange(b.de, b.ate) && tstzrange(s.inicio, s.fim))
     and not exists (select 1 from demonstracoes_comercial m
                      where m.pessoa_id = s.pessoa_id and m.situacao = 'MARCADA'
                        and tstzrange(m.inicio - make_interval(mins => s.intervalo_minutos), m.fim + make_interval(mins => s.intervalo_minutos))
                            && tstzrange(s.inicio, s.fim))
    from s
   where s.inicio > app_now()
   order by s.pessoa_id, s.inicio
$$;

-- Põe a confirmação (ou o aviso de cancelamento) e o lembrete na fila; o que estava na fila sai.
create function comercial_enfileirar_emails(p_demo uuid, p_para text, p_tipo text) returns void
language plpgsql
set search_path = public
as $$
declare
  d demonstracoes_comercial;
  v_lembrete timestamptz;
begin
  update emails_comercial set situacao = 'CANCELADO' where demonstracao_id = p_demo and situacao = 'NA_FILA';
  if p_para is null then return; end if;
  select * into d from demonstracoes_comercial where id = p_demo;
  insert into emails_comercial (demonstracao_id, tipo, para, enviar_em) values (p_demo, p_tipo, p_para, app_now());
  if p_tipo = 'CONFIRMACAO' then
    -- O mais cedo entre as 8h do dia e uma hora antes que ainda esteja a 30 minutos de agora (r7).
    select min(t) into v_lembrete
      from unnest(array[(((d.inicio at time zone 'America/Sao_Paulo')::date + time '08:00') at time zone 'America/Sao_Paulo'),
                        d.inicio - interval '1 hour']) t
     where t >= app_now() + interval '30 minutes' and t < d.inicio;
    if v_lembrete is not null then
      insert into emails_comercial (demonstracao_id, tipo, para, enviar_em) values (p_demo, 'LEMBRETE', p_para, v_lembrete);
    end if;
  end if;
end $$;

-- A demonstração no funil: aberto antes da demonstração avança; Perdido ou Sem resposta reabre;
-- quem já passou da demonstração fica na etapa. Sempre: a data, o próximo passo e o responsável.
create function comercial_demo_no_funil(p_id uuid, p_inicio timestamptz, p_pessoa_demo uuid, p_autor uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  i interessados;
  v_para text;
begin
  select * into i from interessados where id = p_id for update;
  v_para := case when i.etapa in ('NOVO', 'EM_CONTATO', 'PERDIDO', 'SEM_RESPOSTA') then 'DEMO_MARCADA' else i.etapa end;
  update interessados set
    etapa = v_para,
    etapa_desde = case when v_para <> i.etapa then app_now() else etapa_desde end,
    motivo_perda = case when v_para <> i.etapa then null else motivo_perda end,
    perda_detalhe = case when v_para <> i.etapa then null else perda_detalhe end,
    vencedor = case when v_para <> i.etapa then null else vencedor end,
    retomar_em = case when v_para <> i.etapa then null else retomar_em end,
    demonstracao_em = p_inicio,
    proximo_passo = 'Demonstração · ' || comercial_quando(p_inicio),
    proximo_passo_data = (p_inicio at time zone 'America/Sao_Paulo')::date,
    proximo_passo_hora = (p_inicio at time zone 'America/Sao_Paulo')::time,
    responsavel_id = coalesce(responsavel_id, p_pessoa_demo),
    alterado_em = app_now(), alterado_por = p_autor
   where id = p_id;
  if v_para <> i.etapa then
    insert into etapas_interessado (interessado_id, de, para, criado_por) values (p_id, i.etapa, v_para, p_autor);
    perform comercial_iniciar_cadencia(p_id);
  end if;
end $$;

create function comercial_demo_json(d demonstracoes_comercial) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'versao', d.versao, 'inicio', d.inicio, 'fim', d.fim, 'quando', comercial_quando(d.inicio), 'situacao', d.situacao,
    'origem', d.origem, 'remarcacoes', d.remarcacoes, 'motivo', d.motivo,
    'interessado', (select jsonb_strip_nulls(jsonb_build_object('id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'etapa', i.etapa,
                                                                'pessoa', i.nome_contato, 'temEmail', i.email is not null))
                      from interessados i where i.id = d.interessado_id),
    'com', jsonb_build_object('id', d.pessoa_id, 'nome', comercial_nome(d.pessoa_id)),
    'confirmacao', (select e.situacao from emails_comercial e where e.demonstracao_id = d.id and e.tipo = 'CONFIRMACAO' order by e.criado_em desc limit 1),
    'lembrete', (select e.situacao from emails_comercial e where e.demonstracao_id = d.id and e.tipo = 'LEMBRETE' order by e.criado_em desc limit 1)))
$$;

-- A agenda da equipe (quadro 341): próximas, as que passaram sem registro, os horários livres de
-- cada um, os bloqueios e os links.
create function comercial_agenda(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'proximas', (select coalesce(jsonb_agg(comercial_demo_json(d) order by d.inicio), '[]'::jsonb) from demonstracoes_comercial d
                  where d.situacao = 'MARCADA' and d.fim > app_now()),
    'aRegistrar', (select coalesce(jsonb_agg(comercial_demo_json(d) order by d.inicio), '[]'::jsonb) from demonstracoes_comercial d
                    where d.situacao = 'MARCADA' and d.fim <= app_now()),
    'recentes', (select coalesce(jsonb_agg(comercial_demo_json(d) order by d.inicio desc), '[]'::jsonb) from demonstracoes_comercial d
                  where d.situacao <> 'MARCADA' and d.inicio > app_now() - interval '14 days'),
    'disponibilidades', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                             'pessoa', e, 'configurada', d.id is not null, 'versao', d.versao, 'faixas', coalesce(d.faixas, '[]'::jsonb),
                             'duracaoMinutos', coalesce(d.duracao_minutos, 30), 'intervaloMinutos', coalesce(d.intervalo_minutos, 15),
                             'avisoDiasUteis', coalesce(d.aviso_dias_uteis, 1), 'horizonteDias', coalesce(d.horizonte_dias, 14),
                             'salaUrl', d.sala_url, 'ativa', coalesce(d.ativa, false))) order by e ->> 'nome'), '[]'::jsonb)
                           from jsonb_array_elements(comercial_equipe_json()) e
                           left join disponibilidade_comercial d on d.pessoa_id = (e ->> 'id')::uuid),
    'bloqueios', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', b.id, 'pessoa', jsonb_build_object('id', b.pessoa_id, 'nome', comercial_nome(b.pessoa_id)),
                                                                                 'de', b.de, 'ate', b.ate, 'motivo', b.motivo)) order by b.de), '[]'::jsonb)
                    from bloqueios_comercial b where b.cancelado_em is null and b.ate > app_now()),
    'links', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('codigo', l.codigo, 'pessoaId', l.pessoa_id, 'criadoEm', l.criado_em))
                                        order by l.criado_em), '[]'::jsonb)
                from links_agenda l where l.revogado_em is null),
    'equipe', comercial_equipe_json(),
    'eu', p_pessoa,
    'podeEditar', pode_global('console.comercial.editar'));
end $$;

create function comercial_salvar_disponibilidade(p_pessoa uuid, p_de uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if p_de is null then perform recusar_campos('Escolha de quem são os horários', 'pessoaId'); end if;
  perform comercial_exigir_responsavel(p_de);
  begin
    if p_versao is null then
      if exists (select 1 from disponibilidade_comercial where pessoa_id = p_de) then
        perform conflito_versao('disponibilidade_comercial', (select id from disponibilidade_comercial where pessoa_id = p_de));
      end if;
      insert into disponibilidade_comercial (pessoa_id, faixas, duracao_minutos, intervalo_minutos, aviso_dias_uteis, horizonte_dias, sala_url, ativa, criado_por)
      values (p_de, coalesce(p_dados -> 'faixas', '[]'), coalesce((p_dados ->> 'duracaoMinutos')::integer, 30),
              coalesce((p_dados ->> 'intervaloMinutos')::integer, 15), coalesce((p_dados ->> 'avisoDiasUteis')::integer, 1),
              coalesce((p_dados ->> 'horizonteDias')::integer, 14), comercial_texto(p_dados, 'salaUrl'), coalesce((p_dados ->> 'ativa')::boolean, true), p_pessoa)
      returning id, versao into v_id, v_versao;
    else
      update disponibilidade_comercial set faixas = coalesce(p_dados -> 'faixas', '[]'), duracao_minutos = coalesce((p_dados ->> 'duracaoMinutos')::integer, 30),
             intervalo_minutos = coalesce((p_dados ->> 'intervaloMinutos')::integer, 15), aviso_dias_uteis = coalesce((p_dados ->> 'avisoDiasUteis')::integer, 1),
             horizonte_dias = coalesce((p_dados ->> 'horizonteDias')::integer, 14), sala_url = comercial_texto(p_dados, 'salaUrl'),
             ativa = coalesce((p_dados ->> 'ativa')::boolean, true), alterado_em = app_now(), alterado_por = p_pessoa
       where pessoa_id = p_de and versao = p_versao
      returning id, versao into v_id, v_versao;
      if v_id is null then
        perform conflito_versao('disponibilidade_comercial', coalesce((select id from disponibilidade_comercial where pessoa_id = p_de), gen_random_uuid()));
      end if;
    end if;
  exception when check_violation then
    perform recusar_campos('Confira os horários, a duração, o intervalo, o aviso e o link da sala', 'faixas');
  end;
  perform registrar_historico_interno('comercial.agenda', 'agenda_comercial', p_de::text, jsonb_build_object('faixas', jsonb_array_length(coalesce(p_dados -> 'faixas', '[]'))));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;

create function comercial_bloquear_agenda(p_pessoa uuid, p_de uuid, p_inicio timestamptz, p_fim timestamptz, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  perform comercial_exigir_responsavel(p_de);
  if p_de is null then perform recusar_campos('Escolha de quem é o bloqueio', 'pessoaId'); end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio or p_fim <= app_now() or p_fim > p_inicio + interval '60 days' then
    perform recusar_campos('O bloqueio vai de um horário a outro, até 60 dias, e termina no futuro', 'de', 'ate');
  end if;
  begin
    insert into bloqueios_comercial (pessoa_id, de, ate, motivo, criado_por) values (p_de, p_inicio, p_fim, nullif(btrim(p_motivo), ''), p_pessoa)
    returning id into v_id;
  exception when check_violation then perform recusar_campos('Motivo de 2 a 120 letras', 'motivo');
  end;
  perform registrar_historico_interno('comercial.agenda_bloqueio', 'agenda_comercial', p_de::text, jsonb_build_object('de', p_inicio, 'ate', p_fim));
  return jsonb_build_object('id', v_id);
end $$;

create function comercial_desbloquear_agenda(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_de uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  update bloqueios_comercial set cancelado_em = app_now(), cancelado_por = p_pessoa where id = p_id and cancelado_em is null
  returning pessoa_id into v_de;
  if v_de is null then raise exception 'Bloqueio não encontrado' using errcode = 'TC404'; end if;
  perform registrar_historico_interno('comercial.agenda_desbloqueio', 'agenda_comercial', v_de::text, jsonb_build_object('bloqueioId', p_id));
  return jsonb_build_object('id', p_id);
end $$;

create function comercial_codigo_agenda() returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_letras constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v text := '';
begin
  for k in 0..11 loop
    v := v || substr(v_letras, (get_byte(v_bytes, k) % 31) + 1, 1);
  end loop;
  return v;
end $$;

-- "Copiar o link de agendamento": o link ativo da pessoa (ou da equipe); trocar revoga o anterior.
create function comercial_link_agenda(p_pessoa uuid, p_de uuid, p_trocar boolean default false) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  perform comercial_exigir_responsavel(p_de);
  perform pg_advisory_xact_lock(hashtext('comercial_link_agenda'));
  if p_trocar then
    update links_agenda set revogado_em = app_now(), revogado_por = p_pessoa where pessoa_id is not distinct from p_de and revogado_em is null;
  end if;
  select codigo into v_codigo from links_agenda where pessoa_id is not distinct from p_de and revogado_em is null;
  if v_codigo is null then
    loop
      v_codigo := comercial_codigo_agenda();
      exit when not exists (select 1 from links_agenda where codigo = v_codigo);
    end loop;
    insert into links_agenda (codigo, pessoa_id, criado_por) values (v_codigo, p_de, p_pessoa);
    perform registrar_historico_interno('comercial.link_agenda', 'agenda_comercial', coalesce(p_de::text, 'equipe'), jsonb_build_object('trocado', p_trocar));
  end if;
  return jsonb_build_object('codigo', v_codigo, 'pessoaId', p_de);
end $$;

-- O link do [link de agendamento] (E): o de quem atende só quando a pessoa tem disponibilidade
-- ativa e continua na equipe (a mesma regra da grade); senão, o da equipe. Nulo quando ninguém
-- copiou o link ainda.
create function comercial_link_de(p_responsavel uuid) returns text
language sql stable
set search_path = public
as $$
  select l.codigo from links_agenda l
   where l.revogado_em is null
     and (l.pessoa_id is null
          or (l.pessoa_id = p_responsavel
              and exists (select 1 from disponibilidade_comercial d where d.pessoa_id = l.pessoa_id and d.ativa)
              and exists (select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
                           where e.pessoa_id = l.pessoa_id and e.ativa and ef.retirada_em is null and ef.funcao in ('COMERCIAL', 'ADMINISTRACAO'))))
   order by l.pessoa_id nulls last
   limit 1
$$;

-- O convite do interessado (A): a ficha pede um ao abrir a mensagem pronta com o [link de
-- agendamento]. 128 bits aleatórios; o banco guarda só o hash, nos 5 últimos (uma cadência manda
-- mais de uma mensagem). Não muda a versão da ficha (gatilho interessados_convite_agenda).
create function comercial_convite_agenda(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_codigo text;
  v_convite text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into i from interessados where id = p_id for update;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if not comercial_aberta(i.etapa) then
    perform recusar_motivo('Interessado fechado não recebe link de agendamento', 'INTERESSADO_FECHADO');
  end if;
  if comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj) then
    perform recusar_motivo('Este contato pediu para não ser procurado', 'NAO_CONTATAR');
  end if;
  v_codigo := comercial_link_de(i.responsavel_id);
  if v_codigo is null then
    perform recusar_motivo('Copie o link de agendamento na Agenda de demonstrações antes', 'SEM_LINK_AGENDA');
  end if;
  update interessados
     set agenda_convites = (array[extensions.digest(v_convite, 'sha256')] || coalesce(agenda_convites, '{}'::bytea[]))[1:5]
   where id = p_id;
  return jsonb_build_object('codigo', v_codigo, 'convite', v_convite);
end $$;

-- O agendamento pelo link que não marcou (C): fica na ficha em destaque, além da nota e do
-- histórico interno.
create function comercial_avisar_agendamento(p_id uuid, p_motivo text, p_para timestamptz) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_id is null then return; end if;
  update interessados set agendamento_recusado_em = app_now(), agendamento_recusado_motivo = p_motivo, agendamento_recusado_para = p_para
   where id = p_id and anonimizado_em is null;
end $$;

create function publico_link_agenda(p_codigo text) returns links_agenda
language plpgsql
set search_path = public
as $$
declare l links_agenda;
begin
  select * into l from links_agenda where codigo = p_codigo and revogado_em is null;
  if not found then raise exception 'Link de agendamento não encontrado' using errcode = 'TC404'; end if;
  return l;
end $$;

-- A página pública (quadro 340): os dias e os horários, com os ocupados riscados. Nada de quem
-- está do outro lado nem de quem já marcou.
create function publico_agenda(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_agenda;
  v_dias jsonb;
  v_duracao integer;
  v_saida jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_link_agenda(p_codigo);
  select coalesce(jsonb_agg(jsonb_build_object('data', x.dia, 'horarios', x.horarios) order by x.dia), '[]'::jsonb) into v_dias
    from (select (g.inicio at time zone 'America/Sao_Paulo')::date as dia,
                 jsonb_agg(jsonb_build_object('inicio', g.inicio, 'hora', to_char(g.inicio at time zone 'America/Sao_Paulo', 'HH24:MI'), 'livre', g.livre)
                           order by g.inicio) as horarios
            from (select a.inicio, bool_or(a.livre) as livre
                    from comercial_grade_agenda(case when l.pessoa_id is not null then array[l.pessoa_id] end, comercial_hoje() + 60) a
                   group by a.inicio) g
           group by 1) x;
  select min(duracao_minutos) into v_duracao from disponibilidade_comercial where ativa and (l.pessoa_id is null or pessoa_id = l.pessoa_id);
  v_saida := jsonb_build_object(
    'duracaoMinutos', coalesce(v_duracao, 30), 'fuso', 'America/Sao_Paulo', 'dias', v_dias,
    'faixas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', f.codigo, 'nome', f.nome) order by f.ordem), '[]'::jsonb) from faixas_preco f));
  perform set_config('app.comercial_sistema', '', true);
  return v_saida;
end $$;

-- Agendar pelo link (quadro 340). Uma trava só para a agenda: duas pessoas no mesmo horário, a
-- segunda espera e recebe HORARIO_OCUPADO. O interessado é criado ou juntado (decisão f).
-- O agendamento recusado por dentro (r2) fica no histórico interno, escrito pelo sistema: o link
-- público não tem ninguém da equipe no contexto. A Comercial lê pela política da seção 5
-- (entidade agenda_comercial); a leitura daqui é só a do "returning" da gravação.
create policy historico_agendamento_recusado_pelo_sistema on historico for insert
  with check (comercial_sistema() and condominio_id is null and interno and autor_tipo = 'SISTEMA' and autor_id is null
              and acao = 'comercial.agendamento_recusado' and entidade = 'agenda_comercial');
create policy historico_agendamento_recusado_pelo_sistema_leitura on historico for select
  using (comercial_sistema() and condominio_id is null and interno and autor_tipo = 'SISTEMA' and autor_id is null
         and acao = 'comercial.agendamento_recusado' and entidade = 'agenda_comercial');

create function publico_agendar(p_codigo text, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_agenda;
  i interessados;
  v_inicio   timestamptz;
  v_nome     text := comercial_texto(p_dados, 'nome');
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cond     text := comercial_texto(p_dados, 'condominio');
  v_faixa    text := comercial_texto(p_dados, 'faixa');
  v_texto    text := coalesce(comercial_texto(p_dados, 'consentimentoTexto'),
                              'Usamos estes dados só para a demonstração e para falar com você sobre ela.');
  v_parecido uuid;
  v_pessoa   uuid;
  v_fim      timestamptz;
  v_id       uuid;
  v_demo     uuid;
  v_juntado  boolean := false;
  v_resposta jsonb;
  v_convite  text := lower(comercial_texto(p_dados, 'convite'));
  v_por_convite boolean := false;
  v_marcada  demonstracoes_comercial;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_link_agenda(p_codigo);
  begin
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
  exception when others then
    perform recusar_campos('Escolha um horário', 'inicio');
  end;
  if v_inicio is null then perform recusar_campos('Escolha um horário', 'inicio'); end if;
  if length(coalesce(v_nome, '')) not between 2 and 80 then perform recusar_campos('Escreva o seu nome', 'nome'); end if;
  if v_whatsapp is null or v_whatsapp !~ '^55[0-9]{10,11}$' then perform recusar_campos('WhatsApp inválido', 'whatsapp'); end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then perform recusar_campos('E-mail inválido', 'email'); end if;
  if length(coalesce(v_cond, '')) not between 2 and 120 then perform recusar_campos('Escreva o nome do condomínio', 'condominio'); end if;
  if v_faixa is not null and not exists (select 1 from faixas_preco where codigo = v_faixa) then perform recusar_campos('Escolha as unidades', 'faixa'); end if;
  if coalesce((p_dados ->> 'consentimento')::boolean, false) is not true then perform recusar_campos('Falta a autorização', 'consentimento'); end if;

  -- A trava da agenda, depois o interessado, depois a demonstração (r6).
  perform pg_advisory_xact_lock(hashtext('comercial_agenda'));
  -- O horário ainda livre na grade do link; no link da equipe, quem tem menos demonstrações marcadas.
  select g.pessoa_id, g.fim into v_pessoa, v_fim
    from comercial_grade_agenda(case when l.pessoa_id is not null then array[l.pessoa_id] end, (v_inicio at time zone 'America/Sao_Paulo')::date) g
   where g.inicio = v_inicio and g.livre
   order by (select count(*) from demonstracoes_comercial m where m.pessoa_id = g.pessoa_id and m.situacao = 'MARCADA' and m.inicio > app_now()), g.pessoa_id
   limit 1;
  if v_pessoa is null then perform recusar_motivo('Este horário acabou de ser ocupado. Escolha outro.', 'HORARIO_OCUPADO'); end if;
  -- A mesma resposta quando marca e quando não marca (r2): o link não conta quem está no não
  -- contatar nem quem já tem demonstração.
  v_resposta := jsonb_build_object('id', gen_random_uuid(), 'inicio', v_inicio, 'fim', v_fim, 'quando', comercial_quando(v_inicio),
                                   'duracaoMinutos', (extract(epoch from v_fim - v_inicio) / 60)::integer);

  -- O convite da mensagem pronta (A): só o de um interessado aberto vale; o que não vale é como
  -- se não tivesse convite.
  if v_convite ~ '^[0-9a-f]{32}$' then
    select * into i from interessados x
     where x.agenda_convites @> array[extensions.digest(v_convite, 'sha256')]
       and x.anonimizado_em is null and comercial_aberta(x.etapa)
     for update;
    v_por_convite := i.id is not null;
  end if;

  if comercial_nao_contatar_tem(v_whatsapp, v_email, null)
     or (v_por_convite and comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj)) then
    if v_por_convite then
      v_parecido := i.id;
    else
      select p.id into v_parecido from comercial_parecido(v_whatsapp, v_email, null, null) p;
    end if;
    if v_parecido is not null then
      perform comercial_inserir_conversa(v_parecido, 'NOTA', 'Pediu uma demonstração pelo link para ' || comercial_quando(v_inicio)
        || ', mas o contato está no não contatar. Nada foi marcado nem enviado.', false, null, null);
      perform comercial_avisar_agendamento(v_parecido, 'NAO_CONTATAR', v_inicio);
    end if;
    perform registrar_historico_interno('comercial.agendamento_recusado', 'agenda_comercial', l.id::text,
      jsonb_build_object('motivo', 'NAO_CONTATAR', 'interessadoId', v_parecido));
    perform set_config('app.comercial_sistema', '', true);
    return v_resposta;
  end if;

  -- Sem convite, junta só quando o WhatsApp e o e-mail batem com a mesma ficha (r1).
  if not v_por_convite then
    select * into i from interessados x
     where x.anonimizado_em is null and x.whatsapp = v_whatsapp and x.email = v_email
     order by comercial_aberta(x.etapa) desc, x.criado_em desc
     limit 1
     for update;
  end if;
  -- Já tem demonstração marcada (C): quem chegou aqui tem o convite ou os dois dados da ficha, então
  -- a resposta é honesta, com a data; a equipe vê o aviso na ficha.
  select * into v_marcada from demonstracoes_comercial
   where i.id is not null and interessado_id = i.id and situacao = 'MARCADA' and inicio > app_now()
   order by inicio limit 1;
  if v_marcada.id is not null then
    perform comercial_inserir_conversa(i.id, 'NOTA', 'Pediu outra demonstração pelo link para ' || comercial_quando(v_inicio)
      || ', mas já tem uma marcada para ' || comercial_quando(v_marcada.inicio) || '. Nada foi marcado nem enviado: confira com o contato.', false, null, null);
    perform comercial_avisar_agendamento(i.id, 'DEMONSTRACAO_MARCADA', v_inicio);
    perform registrar_historico_interno('comercial.agendamento_recusado', 'agenda_comercial', l.id::text,
      jsonb_build_object('motivo', 'DEMONSTRACAO_MARCADA', 'interessadoId', i.id));
    perform set_config('app.comercial_sistema', '', true);
    return jsonb_build_object('jaMarcada', true, 'inicio', v_marcada.inicio, 'quando', comercial_quando(v_marcada.inicio));
  end if;

  if v_por_convite or (i.id is not null and i.etapa <> 'GANHO') then
    v_id := i.id;
    v_juntado := true;
    -- Os dois batem: só completa o que falta, sem trocar nada da ficha.
    update interessados set faixa = coalesce(faixa, v_faixa), nome_contato = coalesce(nome_contato, v_nome) where id = v_id;
  else
    -- Só um bate (ou nenhum): interessado novo; com um parecido, marcado como possível duplicado.
    if i.id is null then
      select p.id into v_parecido from comercial_parecido(v_whatsapp, v_email, null, null) p;
    end if;
    insert into interessados (nome_contato, whatsapp, email, condominio, faixa, origem, origem_detalhe, base_legal, base_legal_texto,
                              primeiro_retorno_ate, contato_de, possivel_duplicado_de)
    values (v_nome, v_whatsapp, v_email, v_cond, v_faixa, 'SITE', 'Agendamento pelo link', 'CONSENTIMENTO', left(v_texto, 1000), comercial_hora_util(app_now()),
            -- Ganho com os dois batendo: oportunidade nova do mesmo contato (0308).
            case when i.id is not null then coalesce(i.contato_de, i.id) end, v_parecido)
    returning id into v_id;
    insert into etapas_interessado (interessado_id, de, para) values (v_id, null, 'NOVO');
    if v_parecido is not null then
      perform comercial_inserir_conversa(v_id, 'NOTA', 'Possível duplicado: o WhatsApp ou o e-mail é de outro interessado, mas não os dois. '
        || 'Confira se é a mesma pessoa antes de falar dos dados do outro.', false, null, null);
      perform comercial_inserir_conversa(v_parecido, 'NOTA', 'Alguém agendou uma demonstração pelo link com o WhatsApp ou o e-mail deste interessado, '
        || 'mas não os dois. Ficou num interessado novo, marcado como possível duplicado.', false, null, null);
    end if;
  end if;
  begin
    insert into demonstracoes_comercial (interessado_id, pessoa_id, inicio, fim, origem, link_id, nome_contato, condominio, email)
    values (v_id, v_pessoa, v_inicio, v_fim, 'LINK', l.id, v_nome, v_cond, v_email)
    returning id into v_demo;
  exception when exclusion_violation then
    perform recusar_motivo('Este horário acabou de ser ocupado. Escolha outro.', 'HORARIO_OCUPADO');
  end;
  perform comercial_demo_no_funil(v_id, v_inicio, v_pessoa, null);
  perform comercial_inserir_conversa(v_id, 'ENTRADA', 'Agendou a demonstração pelo link: ' || comercial_quando(v_inicio) || ' (' || v_cond || ').',
                                     v_juntado, null, null);
  if v_juntado then
    -- O que a pessoa digitou fica na demonstração e aqui, para a equipe conferir; a ficha não muda.
    perform comercial_inserir_conversa(v_id, 'NOTA', 'Dados digitados no agendamento'
      || case when v_por_convite then ' (pelo link da mensagem desta ficha)' else '' end || ': ' || v_nome || ', ' || v_cond || ', ' || v_email
      || case when i.whatsapp is distinct from v_whatsapp then ', WhatsApp ' || v_whatsapp else '' end || '.',
                                       false, null, null);
  end if;
  perform comercial_enfileirar_emails(v_demo, v_email, 'CONFIRMACAO');
  perform set_config('app.comercial_sistema', '', true);
  return v_resposta || jsonb_build_object('id', v_demo);
end $$;

-- "Marcar à mão" (quadro 341): para um interessado aberto, num horário sem outra demonstração da
-- mesma pessoa (a equipe pode marcar fora da grade).
create function comercial_marcar_demonstracao(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_inicio timestamptz;
  v_com uuid := coalesce(nullif(p_dados ->> 'pessoaId', '')::uuid, p_pessoa);
  v_duracao integer;
  v_demo uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  perform comercial_exigir_responsavel(v_com);
  -- A trava da agenda antes do interessado, na mesma ordem do agendamento pelo link.
  perform pg_advisory_xact_lock(hashtext('comercial_agenda'));
  select * into i from interessados where id = p_interessado for update;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if not comercial_aberta(i.etapa) and i.etapa not in ('PERDIDO', 'SEM_RESPOSTA') then
    perform recusar_motivo('Interessado fechado não marca demonstração', 'INTERESSADO_FECHADO');
  end if;
  begin
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
  exception when others then perform recusar_campos('Escolha o horário', 'inicio');
  end;
  if v_inicio is null or v_inicio <= app_now() then perform recusar_campos('Escolha um horário no futuro', 'inicio'); end if;
  v_duracao := coalesce((p_dados ->> 'duracaoMinutos')::integer, (select duracao_minutos from disponibilidade_comercial where pessoa_id = v_com), 30);
  if v_duracao not between 15 and 120 then perform recusar_campos('A duração vai de 15 a 120 minutos', 'duracaoMinutos'); end if;
  if exists (select 1 from demonstracoes_comercial where interessado_id = i.id and situacao = 'MARCADA' and inicio > app_now()) then
    perform recusar_motivo('Este interessado já tem demonstração marcada; remarque a que existe', 'DEMONSTRACAO_MARCADA');
  end if;
  begin
    insert into demonstracoes_comercial (interessado_id, pessoa_id, inicio, fim, origem, criado_por)
    values (i.id, v_com, v_inicio, v_inicio + make_interval(mins => v_duracao), 'MAO', p_pessoa)
    returning id into v_demo;
  exception when exclusion_violation then
    perform recusar_motivo('Quem vai fazer a demonstração já tem outra neste horário', 'HORARIO_OCUPADO');
  end;
  perform comercial_demo_no_funil(i.id, v_inicio, v_com, p_pessoa);
  perform comercial_inserir_conversa(i.id, 'NOTA', 'Demonstração marcada pela equipe: ' || comercial_quando(v_inicio) || '.', false, null, null);
  if coalesce((p_dados ->> 'avisar')::boolean, true) then perform comercial_enfileirar_emails(v_demo, i.email, 'CONFIRMACAO'); end if;
  perform registrar_historico_interno('comercial.demonstracao', 'demonstracao_comercial', v_demo::text,
    jsonb_build_object('interessadoId', i.id, 'inicio', v_inicio, 'origem', 'MAO'));
  return comercial_demo_json((select d from demonstracoes_comercial d where d.id = v_demo));
end $$;

-- Trava o interessado da demonstração e depois a demonstração (r6): a mesma ordem da anonimização
-- (interessado, depois as demonstrações), para as duas nunca esperarem uma pela outra.
create function comercial_travar_demonstracao(p_id uuid) returns demonstracoes_comercial
language plpgsql
set search_path = public
as $$
declare
  v_interessado uuid;
  d demonstracoes_comercial;
begin
  select interessado_id into v_interessado from demonstracoes_comercial where id = p_id;
  if not found then raise exception 'Demonstração não encontrada' using errcode = 'TC404'; end if;
  perform 1 from interessados where id = v_interessado for update;
  select * into d from demonstracoes_comercial where id = p_id for update;
  return d;
end $$;

create function comercial_remarcar_demonstracao(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d demonstracoes_comercial;
  v_inicio timestamptz;
  v_com uuid;
  v_email text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  -- A trava da agenda, o interessado e só então a demonstração (r6), na ordem da anonimização.
  perform pg_advisory_xact_lock(hashtext('comercial_agenda'));
  d := comercial_travar_demonstracao(p_id);
  if d.versao <> p_versao then perform conflito_versao('demonstracoes_comercial', p_id); end if;
  if d.situacao <> 'MARCADA' then perform recusar_motivo('Demonstração encerrada não muda', 'DEMONSTRACAO_ENCERRADA'); end if;
  begin
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
  exception when others then perform recusar_campos('Escolha o horário', 'inicio');
  end;
  if v_inicio is null or v_inicio <= app_now() then perform recusar_campos('Escolha um horário no futuro', 'inicio'); end if;
  v_com := coalesce(nullif(p_dados ->> 'pessoaId', '')::uuid, d.pessoa_id);
  perform comercial_exigir_responsavel(v_com);
  begin
    update demonstracoes_comercial set inicio = v_inicio, fim = v_inicio + (d.fim - d.inicio), pessoa_id = v_com, remarcacoes = remarcacoes + 1,
           alterado_em = app_now(), alterado_por = p_pessoa
     where id = p_id;
  exception
    when exclusion_violation then perform recusar_motivo('Quem vai fazer a demonstração já tem outra neste horário', 'HORARIO_OCUPADO');
    when check_violation then perform recusar_motivo('Esta demonstração já foi remarcada muitas vezes', 'REMARCACOES');
  end;
  perform comercial_demo_no_funil(d.interessado_id, v_inicio, v_com, p_pessoa);
  perform comercial_inserir_conversa(d.interessado_id, 'NOTA', 'Demonstração remarcada para ' || comercial_quando(v_inicio) || '.', false, null, null);
  -- Pelo link, o e-mail que a pessoa digitou (r1); marcada pela equipe, o da ficha.
  select coalesce(d.email, i.email) into v_email from interessados i where i.id = d.interessado_id;
  if coalesce((p_dados ->> 'avisar')::boolean, true) then
    perform comercial_enfileirar_emails(p_id, v_email, 'CONFIRMACAO');
  else
    perform comercial_enfileirar_emails(p_id, null, 'CONFIRMACAO');
  end if;
  perform registrar_historico_interno('comercial.demonstracao_remarcada', 'demonstracao_comercial', p_id::text, jsonb_build_object('inicio', v_inicio));
  return comercial_demo_json((select x from demonstracoes_comercial x where x.id = p_id));
end $$;

-- "Registrar como foi" (decisão 6 do plano): o resumo da conversa e o próximo passo são obrigatórios;
-- o interessado vai para Demonstração feita (se ainda não passou dela).
create function comercial_demonstracao_feita(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d demonstracoes_comercial;
  i interessados;
  v_resumo text := comercial_texto(p_dados, 'resumo');
  v_passo text := comercial_texto(p_dados, 'proximoPasso');
  v_data date;
  v_hora time;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  -- O interessado antes da demonstração (r6).
  d := comercial_travar_demonstracao(p_id);
  if d.versao <> p_versao then perform conflito_versao('demonstracoes_comercial', p_id); end if;
  if d.situacao <> 'MARCADA' then perform recusar_motivo('Demonstração encerrada não muda', 'DEMONSTRACAO_ENCERRADA'); end if;
  if d.inicio > app_now() then perform recusar_motivo('A demonstração ainda não começou', 'DEMONSTRACAO_FUTURA'); end if;
  begin
    v_data := (p_dados ->> 'proximoPassoData')::date;
    v_hora := nullif(p_dados ->> 'proximoPassoHora', '')::time;
  exception when others then perform recusar_campos('Confira a data do próximo passo', 'proximoPassoData');
  end;
  if length(coalesce(v_resumo, '')) not between 2 and 2000 then perform recusar_campos('Conte como foi a demonstração', 'resumo'); end if;
  if length(coalesce(v_passo, '')) not between 2 and 200 or v_data is null then
    perform recusar_campos('Diga o próximo passo e a data', 'proximoPasso', 'proximoPassoData');
  end if;
  select * into i from interessados where id = d.interessado_id;
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  update demonstracoes_comercial set situacao = 'FEITA', encerrada_em = app_now(), encerrada_por = p_pessoa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id;
  update emails_comercial set situacao = 'CANCELADO' where demonstracao_id = p_id and situacao = 'NA_FILA';
  perform comercial_inserir_conversa(i.id, 'DEMONSTRACAO', v_resumo, true, null, null);
  update interessados set
    etapa = case when i.etapa in ('NOVO', 'EM_CONTATO', 'DEMO_MARCADA') then 'DEMO_FEITA' else etapa end,
    etapa_desde = case when i.etapa in ('NOVO', 'EM_CONTATO', 'DEMO_MARCADA') then app_now() else etapa_desde end,
    demonstracao_em = d.inicio, proximo_passo = v_passo, proximo_passo_data = v_data, proximo_passo_hora = v_hora,
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = i.id;
  if i.etapa in ('NOVO', 'EM_CONTATO', 'DEMO_MARCADA') then
    insert into etapas_interessado (interessado_id, de, para, criado_por) values (i.id, i.etapa, 'DEMO_FEITA', p_pessoa);
    perform comercial_iniciar_cadencia(i.id);
    perform registrar_historico_interno('comercial.etapa', 'interessado', i.id::text, jsonb_build_object('de', i.etapa, 'para', 'DEMO_FEITA'));
  end if;
  perform registrar_historico_interno('comercial.demonstracao_feita', 'demonstracao_comercial', p_id::text, jsonb_build_object('interessadoId', i.id));
  return comercial_demo_json((select x from demonstracoes_comercial x where x.id = p_id))
         || jsonb_build_object('interessadoVersao', (select versao from interessados where id = i.id));
end $$;

-- Não compareceu ou cancelada (com o motivo; o cancelamento avisa por e-mail, se pedido).
create function comercial_encerrar_demonstracao(p_pessoa uuid, p_id uuid, p_versao integer, p_situacao text, p_motivo text, p_avisar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d demonstracoes_comercial;
  v_email text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if p_situacao is null or p_situacao not in ('NAO_COMPARECEU', 'CANCELADA') then perform recusar_campos('Escolha o que aconteceu', 'situacao'); end if;
  d := comercial_travar_demonstracao(p_id);
  if d.versao <> p_versao then perform conflito_versao('demonstracoes_comercial', p_id); end if;
  if d.situacao <> 'MARCADA' then perform recusar_motivo('Demonstração encerrada não muda', 'DEMONSTRACAO_ENCERRADA'); end if;
  if p_situacao = 'NAO_COMPARECEU' and d.inicio > app_now() then perform recusar_motivo('A demonstração ainda não começou', 'DEMONSTRACAO_FUTURA'); end if;
  if p_situacao = 'CANCELADA' and length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then perform recusar_campos('Diga por que cancelou', 'motivo'); end if;
  update demonstracoes_comercial set situacao = p_situacao, motivo = nullif(btrim(p_motivo), ''), encerrada_em = app_now(), encerrada_por = p_pessoa,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id;
  select coalesce(d.email, i.email) into v_email from interessados i where i.id = d.interessado_id;
  perform comercial_enfileirar_emails(p_id, case when p_situacao = 'CANCELADA' and coalesce(p_avisar, false) and d.inicio > app_now() then v_email end,
                                      'CANCELAMENTO');
  perform comercial_inserir_conversa(d.interessado_id, 'NOTA',
    case p_situacao when 'NAO_COMPARECEU' then 'Não compareceu à demonstração de ' else 'Demonstração cancelada: ' end || comercial_quando(d.inicio)
    || coalesce(' (' || nullif(btrim(p_motivo), '') || ')', '') || '.', false, null, null);
  perform registrar_historico_interno('comercial.demonstracao_encerrada', 'demonstracao_comercial', p_id::text, jsonb_build_object('situacao', p_situacao));
  return comercial_demo_json((select x from demonstracoes_comercial x where x.id = p_id));
end $$;

-- Antes de pegar (r10): confirmação e lembrete de demonstração que já passou ou não está mais
-- marcada não saem, também o ENVIANDO preso; o preso com 5 tentativas ou mais vira FALHOU.
create function comercial_limpar_fila() returns void
language sql
set search_path = public
as $$
  update emails_comercial e set situacao = 'CANCELADO'
    from demonstracoes_comercial d
   where d.id = e.demonstracao_id and e.tipo <> 'CANCELAMENTO' and (d.situacao <> 'MARCADA' or d.inicio <= app_now())
     and (e.situacao = 'NA_FILA' or (e.situacao = 'ENVIANDO' and e.pego_em <= app_now() - interval '15 minutes'));
  update emails_comercial set situacao = 'FALHOU', erro = coalesce(erro, 'Ficou preso no envio depois de 5 tentativas')
   where situacao = 'ENVIANDO' and pego_em <= app_now() - interval '15 minutes' and tentativas >= 5;
$$;

-- A fila (a api-console pega, manda pelo Resend e devolve o resultado). Sem pessoa.
create function comercial_emails_pegar(p_max integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  -- Confirmação e lembrete de demonstração que já passou ou não está mais marcada não saem.
  perform comercial_limpar_fila();
  with lote as (
    select e.id from emails_comercial e
     where e.para is not null
       and ((e.situacao = 'NA_FILA' and e.enviar_em <= app_now())
            or (e.situacao = 'ENVIANDO' and e.pego_em <= app_now() - interval '15 minutes' and e.tentativas < 5))
     order by e.enviar_em
     limit least(greatest(coalesce(p_max, 50), 1), 100)
     for update skip locked
  ), pegos as (
    update emails_comercial e set situacao = 'ENVIANDO', pego_em = app_now(), tentativas = least(e.tentativas + 1, 10)
      from lote where e.id = lote.id
    returning e.*
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', p.id, 'tipo', p.tipo, 'para', p.para,
           -- O que a pessoa digitou no link (r1); marcada pela equipe, o da ficha.
           'nome', case when d.origem = 'LINK' then d.nome_contato else i.nome_contato end,
           'condominio', case when d.origem = 'LINK' then d.condominio else i.condominio end,
           'inicio', d.inicio, 'fim', d.fim, 'quando', comercial_quando(d.inicio), 'duracaoMinutos', (extract(epoch from d.fim - d.inicio) / 60)::integer,
           'salaUrl', s.sala_url, 'remarcada', d.remarcacoes > 0, 'motivo', case when p.tipo = 'CANCELAMENTO' then d.motivo end))), '[]'::jsonb)
    into v
    from pegos p
    join demonstracoes_comercial d on d.id = p.demonstracao_id
    join interessados i on i.id = d.interessado_id
    left join disponibilidade_comercial s on s.pessoa_id = d.pessoa_id;
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

create function comercial_email_resultado(p_id uuid, p_provedor_id text, p_erro text, p_tentar_de_novo boolean) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  update emails_comercial set
    situacao = case when p_provedor_id is not null then 'ENVIADO' when coalesce(p_tentar_de_novo, false) and tentativas < 5 then 'NA_FILA' else 'FALHOU' end,
    provedor_id = left(p_provedor_id, 120), erro = left(p_erro, 300),
    enviado_em = case when p_provedor_id is not null then app_now() end,
    enviar_em = case when p_provedor_id is null and coalesce(p_tentar_de_novo, false) then app_now() + make_interval(mins => 10 * tentativas) else enviar_em end
   where id = p_id and situacao = 'ENVIANDO';
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- Sem a chave do Resend: o que venceu fica registrado como "sem chave" e a fila não falha.
create function comercial_emails_sem_chave() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  perform comercial_limpar_fila();
  with x as (update emails_comercial set situacao = 'SEM_CHAVE', erro = 'Sem a chave do Resend na api-console'
              where situacao = 'NA_FILA' and enviar_em <= app_now() returning 1)
  select count(*)::integer into v from x;
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

-- O pg_cron chama a api-console (pg_net, com o Vault) quando há e-mail do Comercial vencido.
create function chamar_fila_comercial() returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
  v_tem boolean;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'api_console_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_segredo using 'repasse_segredo';
  if v_url is null or v_segredo is null then return false; end if;
  perform set_config('app.comercial_sistema', 'on', true);
  select exists (select 1 from emails_comercial where (situacao = 'NA_FILA' and enviar_em <= app_now())
                                                   or (situacao = 'ENVIANDO' and pego_em <= app_now() - interval '15 minutes')) into v_tem;
  perform set_config('app.comercial_sistema', '', true);
  if not v_tem then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using rtrim(v_url, '/') || '/v1/interno/fila-comercial', '{}'::jsonb,
          jsonb_build_object('content-type', 'application/json', 'x-repasse-segredo', v_segredo);
  return true;
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. Calculadora do site (CM-33) e o pedido de proposta.

-- Só o necessário para a tela (decisão i): nunca a tabela inteira, a implantação ou as vagas.
create function comercial_calculadora_site(p_unidades integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  if p_unidades is null or p_unidades not between 1 and 20000 then perform recusar_campos('Unidades de 1 a 20.000', 'unidades'); end if;
  r := comercial_calcular_proposta(p_unidades, 'MENSAL', null, null, null, null);
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_strip_nulls(jsonb_build_object(
    'unidades', p_unidades,
    'faixa', jsonb_build_object('codigo', r -> 'faixa' ->> 'codigo', 'nome', r -> 'faixa' ->> 'nome',
                                'sobConsulta', coalesce((r -> 'faixa' ->> 'sobConsulta')::boolean, false)),
    'tabela', r ->> 'tabela', 'mensal', r -> 'mensal', 'porApartamento', r -> 'porApartamento',
    'depoisFundador', r -> 'depoisFundador', 'fundadorMeses', r -> 'fundadorMeses'));
end $$;

-- O pedido do site (0296) passa a aceitar as unidades (a faixa sai da Tabela), o pedido de proposta
-- da calculadora e a taxa média de condomínio (DC17). Ao juntar, completa a faixa, as unidades e a
-- taxa do interessado que já existe.
create or replace function comercial_entrada_site(p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_pedido   text := coalesce(comercial_texto(p_dados, 'pedido'), 'DEMONSTRACAO');
  v_unidades integer;
  v_taxa     numeric(10, 2);
  v_faixa    text := comercial_texto(p_dados, 'faixa');
  v_resumo   text;
  v_existe   record;
  i          interessados;
  v_id       uuid;
  v_texto    text := coalesce(comercial_texto(p_dados, 'consentimentoTexto'),
                              'Autorizo o uso destes dados só para responder a este pedido, como diz a política de privacidade.');
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  if v_whatsapp is null or v_whatsapp !~ '^55[0-9]{10,11}$' then perform recusar_campos('WhatsApp inválido', 'whatsapp'); end if;
  if coalesce((p_dados ->> 'consentimento')::boolean, false) is not true then perform recusar_campos('Falta o consentimento', 'consentimento'); end if;
  if v_pedido not in ('DEMONSTRACAO', 'PROPOSTA') then perform recusar_campos('Pedido inválido', 'pedido'); end if;
  if coalesce(p_dados ->> 'unidades', '') <> '' then
    if (p_dados ->> 'unidades') !~ '^[0-9]{1,5}$' or (p_dados ->> 'unidades')::integer not between 1 and 20000 then
      perform recusar_campos('Unidades de 1 a 20.000', 'unidades');
    end if;
    v_unidades := (p_dados ->> 'unidades')::integer;
  end if;
  if coalesce(p_dados ->> 'taxaCondominio', '') <> '' then
    if (p_dados ->> 'taxaCondominio') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' or (p_dados ->> 'taxaCondominio')::numeric <= 0
       or (p_dados ->> 'taxaCondominio')::numeric > 20000 then
      perform recusar_campos('A taxa vai de R$ 0,01 a R$ 20.000', 'taxaCondominio');
    end if;
    v_taxa := (p_dados ->> 'taxaCondominio')::numeric;
  end if;
  if v_faixa is null and v_unidades is not null then
    select codigo into v_faixa from faixas_preco
     where v_unidades >= unidades_de and (unidades_ate is null or v_unidades <= unidades_ate) order by ordem limit 1;
  end if;
  v_resumo := case v_pedido
    when 'PROPOSTA' then 'Pedido de proposta pela calculadora do site: ' || coalesce(comercial_texto(p_dados, 'condominio'), '')
                         || coalesce(' (' || v_unidades || ' unidades)', '')
                         || coalesce(', taxa média de condomínio de ' || reais(round(v_taxa * 100)::bigint::centavos), '') || '.'
    else 'Pedido de demonstração pelo site: ' || coalesce(comercial_texto(p_dados, 'condominio'), '') ||
         coalesce(' (' || comercial_texto(p_dados, 'unidadesTexto') || ')', '') || '.' end;
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, null, null);
  if v_existe.id is not null then
    select * into i from interessados where id = v_existe.id for update;
    perform comercial_inserir_conversa(i.id, 'ENTRADA', v_resumo, true, null, null);
    -- Ganho ou fechado não muda (r3); aberto só completa o que está vazio. A taxa da ficha nunca é
    -- trocada pelo site: a diferente fica numa conversa para a equipe conferir.
    if comercial_aberta(i.etapa) then
      update interessados set faixa = coalesce(faixa, v_faixa), unidades = coalesce(unidades, v_unidades),
                              taxa_condominio_media = case when taxa_condominio_media is null and taxa_condominio_em is null then v_taxa
                                                           else taxa_condominio_media end
       where id = i.id
         and (faixa is null and v_faixa is not null or unidades is null and v_unidades is not null
              or v_taxa is not null and taxa_condominio_media is null and taxa_condominio_em is null);
    end if;
    if v_taxa is not null and (i.taxa_condominio_media is not null or i.taxa_condominio_em is not null or not comercial_aberta(i.etapa))
       and i.taxa_condominio_media is distinct from v_taxa then
      perform comercial_inserir_conversa(i.id, 'NOTA', 'No site, a taxa média de condomínio informada foi ' || reais(round(v_taxa * 100)::bigint::centavos)
        || coalesce('; a ficha tem ' || reais(round(i.taxa_condominio_media * 100)::bigint::centavos), '; a ficha está sem taxa')
        || '. A ficha não mudou.', false, null, null);
    end if;
    perform set_config('app.comercial_sistema', '', true);
    return jsonb_build_object('id', i.id, 'juntado', true);
  end if;
  insert into interessados (nome_contato, whatsapp, email, condominio, faixa, unidades, taxa_condominio_media, origem, origem_detalhe, utm,
                            base_legal, base_legal_texto, optin_em, optin_canal, optin_texto, primeiro_retorno_ate)
  values (comercial_texto(p_dados, 'nome'), v_whatsapp, v_email, comercial_texto(p_dados, 'condominio'), v_faixa, v_unidades, v_taxa, 'SITE',
          comercial_texto(p_dados, 'pagina'), case when jsonb_typeof(p_dados -> 'utm') = 'object' and p_dados -> 'utm' <> '{}'::jsonb then p_dados -> 'utm' end,
          'CONSENTIMENTO', v_texto, app_now(), 'SITE', left(v_texto, 500), comercial_hora_util(app_now()))
  returning id into v_id;
  insert into etapas_interessado (interessado_id, de, para) values (v_id, null, 'NOVO');
  perform comercial_inserir_conversa(v_id, 'ENTRADA', v_resumo, false, null, null);
  perform comercial_iniciar_cadencia(v_id);
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_build_object('id', v_id, 'juntado', false);
end $$;

-- Parecido (0308): o par que o link marcou como possível duplicado (r1) não conta pelo WhatsApp nem
-- pelo e-mail, para a equipe poder salvar as duas fichas enquanto confere; CNPJ e endereço continuam.
-- Entre as parecidas, a original vem antes da possível duplicada (B).
create or replace function comercial_parecido(p_whatsapp text, p_email text, p_cnpj text, p_endereco text, p_ignorar uuid default null)
returns table (id uuid, campo text)
language sql stable
set search_path = public
as $$
  with grupo as (select coalesce(x.contato_de, x.id) as g, x.possivel_duplicado_de as par from interessados x where x.id = p_ignorar),
  candidatos as (
    select i.*,
           exists (select 1 from grupo where grupo.g = coalesce(i.contato_de, i.id) or grupo.par = i.id or i.possivel_duplicado_de = p_ignorar) as do_grupo
      from interessados i
     where i.anonimizado_em is null and i.id is distinct from p_ignorar),
  marcados as (
    select c.*,
           (p_whatsapp is not null and c.whatsapp = p_whatsapp and not c.do_grupo) as por_whatsapp,
           (p_cnpj is not null and c.cnpj = p_cnpj) as por_cnpj,
           (p_email is not null and c.email = lower(p_email) and not c.do_grupo) as por_email,
           (comercial_normalizar(p_endereco) is not null and comercial_normalizar(c.endereco) = comercial_normalizar(p_endereco)) as por_endereco
      from candidatos c)
  select m.id,
         case when m.por_whatsapp then 'WHATSAPP' when m.por_cnpj then 'CNPJ' when m.por_email then 'EMAIL' else 'ENDERECO' end
    from marcados m
   where m.por_whatsapp or m.por_cnpj or m.por_email or m.por_endereco
   -- A ficha que não é possível duplicado vem antes da que o link marcou (B).
   order by (m.possivel_duplicado_de is null) desc, comercial_aberta(m.etapa) desc, m.criado_em desc
   limit 1
$$;

-- A mensagem pronta de marcar a demonstração passa a levar o link de agendamento (R17.6b). Só
-- troca o texto da 0296 que ninguém mudou.
update mensagens_comercial
   set texto = 'Oi, [nome]! Conseguimos marcar a demonstração do [condominio]? Leva 30 minutos, por vídeo, e pode chamar o conselho. '
            || 'Se preferir, escolha o horário por aqui: [link de agendamento]'
 where etapa = 'EM_CONTATO' and titulo = 'Marcar a demonstração'
   and texto = 'Oi, [nome]! Conseguimos marcar a demonstração do [condominio]? Leva 30 minutos, por vídeo, e pode chamar o conselho.';

-- A ficha passa a levar o parceiro, a taxa média de condomínio, o possível duplicado e o link de
-- agendamento. Mesmo corpo da 0307.
create or replace function comercial_json(i interessados, p_completo boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_tarefa jsonb := comercial_tarefa(i);
  v jsonb;
begin
  v := jsonb_build_object(
    'id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'cidade', i.cidade, 'uf', i.uf, 'faixa', i.faixa, 'unidades', i.unidades,
    'pessoa', i.nome_contato, 'papel', i.papel_contato, 'whatsappMascarado', comercial_mascarar(i.whatsapp),
    'origem', i.origem, 'origemDetalhe', i.origem_detalhe, 'etapa', i.etapa, 'etapaDesde', i.etapa_desde,
    'probabilidade', (select probabilidade from parametros_etapa_comercial where etapa = i.etapa),
    'responsavel', case when i.responsavel_id is not null then jsonb_build_object('id', i.responsavel_id, 'nome', comercial_nome(i.responsavel_id)) end,
    'proximoPasso', case when i.proximo_passo is not null then
      jsonb_strip_nulls(jsonb_build_object('texto', i.proximo_passo, 'data', i.proximo_passo_data, 'hora', to_char(i.proximo_passo_hora, 'HH24:MI'))) end,
    'primeiroRetornoAte', i.primeiro_retorno_ate, 'primeiraRespostaEm', i.primeira_resposta_em,
    'ultimaConversa', (select jsonb_build_object('em', c.criado_em, 'resumo', c.resumo, 'canal', c.canal)
                         from conversas_comercial c where c.interessado_id = i.id order by c.criado_em desc, c.id desc limit 1),
    'motivoPerda', i.motivo_perda, 'anonimizado', i.anonimizado_em is not null, 'criadoEm', i.criado_em,
    'tarefa', v_tarefa, 'atencao', comercial_atencao(v_tarefa),
    'temWhatsapp', i.optin_em is not null and i.whatsapp is not null and not comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
    'parceiro', (select jsonb_build_object('id', p.id, 'nome', p.nome) from parceiros_comercial p where p.id = i.parceiro_id),
    -- O agendamento pelo link com só o WhatsApp ou só o e-mail de outro interessado (r1).
    'possivelDuplicado', (select jsonb_build_object('id', o.id, 'condominio', o.condominio) from interessados o
                           where o.id = i.possivel_duplicado_de and o.anonimizado_em is null),
    -- O campo [link de agendamento] das mensagens prontas (R17.6b): o link de quem atende, se tem
    -- disponibilidade ativa e continua na equipe; senão, o da equipe (E). O convite (A) vem à parte.
    'linkAgenda', comercial_link_de(i.responsavel_id));
  if p_completo then
    v := v || jsonb_build_object(
      -- O agendamento pelo link que não marcou (C), até alguém da equipe registrar uma conversa.
      'agendamentoRecusado', case when i.agendamento_recusado_em is not null and i.anonimizado_em is null
                                   and not exists (select 1 from conversas_comercial c where c.interessado_id = i.id and c.criado_por is not null
                                                      and c.criado_em > i.agendamento_recusado_em)
        then jsonb_build_object('motivo', i.agendamento_recusado_motivo, 'em', i.agendamento_recusado_em,
                                'pedido', comercial_quando(i.agendamento_recusado_para)) end,
      'whatsapp', i.whatsapp, 'email', i.email, 'cnpj', i.cnpj, 'endereco', i.endereco, 'utm', i.utm,
      'lote', (select jsonb_build_object('id', l.id, 'arquivo', l.arquivo, 'origem', l.origem_texto) from lotes_comercial l where l.id = i.lote_id),
      'baseLegal', jsonb_build_object('tipo', i.base_legal, 'texto', i.base_legal_texto, 'em', i.base_legal_em),
      'optin', case when i.optin_em is not null then jsonb_build_object('em', i.optin_em, 'canal', i.optin_canal, 'texto', i.optin_texto) end,
      'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
      'predio', jsonb_strip_nulls(jsonb_build_object(
        'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
        'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate,
        'decisor', i.decisor, 'decisaoEm', i.decisao_em, 'visitaEm', i.visita_em, 'visitaNota', i.visita_nota,
        'demonstracaoEm', i.demonstracao_em,
        'criterios', comercial_criterios_ordem(i.criterios), 'criterioOutro', i.criterio_outro, 'problema', i.problema,
        'taxaCondominioMedia', i.taxa_condominio_media)),
      'objecoes', to_jsonb(i.objecoes), 'concorrentes', i.concorrentes,
      'perda', case when i.etapa = 'PERDIDO' then jsonb_strip_nulls(jsonb_build_object('motivo', i.motivo_perda, 'detalhe', i.perda_detalhe,
                                                                                      'vencedor', i.vencedor, 'retomarEm', i.retomar_em)) end,
      'observacao', i.observacao,
      'cadencia', (select jsonb_strip_nulls(jsonb_build_object('id', c.id, 'nome', c.nome, 'passos', c.passos, 'feitos', i.cadencia_feitos,
                                                               'inicio', i.cadencia_inicio, 'fimEm', i.cadencia_fim_em, 'fimMotivo', i.cadencia_fim_motivo))
                     from cadencias_comercial c where c.id = i.cadencia_id),
      'falta', (select jsonb_object_agg(p.etapa, to_jsonb(comercial_falta(i, p.etapa))) from parametros_etapa_comercial p
                 where cardinality(comercial_falta(i, p.etapa)) > 0));
  end if;
  return jsonb_strip_nulls(v);
end $$;

-- Salvar a ficha: igual à 0307, e a taxa média de condomínio só muda quando a tela manda o campo.
create or replace function comercial_salvar(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_whatsapp text := comercial_texto(p_dados, 'whatsapp');
  v_email    text := lower(comercial_texto(p_dados, 'email'));
  v_cnpj     text := comercial_texto(p_dados, 'cnpj');
  v_resp     uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_existe   record;
  v_versao   integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if v_whatsapp is null and v_email is null and i.origem <> 'IMPORTACAO' then
    perform recusar_campos('Informe o WhatsApp ou o e-mail', 'whatsapp', 'email');
  end if;
  select * into v_existe from comercial_parecido(v_whatsapp, v_email, v_cnpj, null, p_id);
  if v_existe.id is not null then
    raise exception 'Este contato já é de outro interessado' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'DUPLICADO', 'campos', jsonb_build_array(lower(v_existe.campo)), 'interessadoId', v_existe.id)::text;
  end if;
  perform comercial_exigir_responsavel(v_resp);
  if p_dados ? 'taxaCondominioMedia' and jsonb_typeof(p_dados -> 'taxaCondominioMedia') <> 'null'
     and (jsonb_typeof(p_dados -> 'taxaCondominioMedia') <> 'number' or (p_dados ->> 'taxaCondominioMedia')::numeric <= 0
          or (p_dados ->> 'taxaCondominioMedia')::numeric > 20000
          or (p_dados ->> 'taxaCondominioMedia')::numeric <> round((p_dados ->> 'taxaCondominioMedia')::numeric, 2)) then
    perform recusar_campos('A taxa vai de R$ 0,01 a R$ 20.000', 'taxaCondominioMedia');
  end if;
  update interessados set
    nome_contato = comercial_texto(p_dados, 'pessoa'), papel_contato = comercial_texto(p_dados, 'papel'), whatsapp = v_whatsapp, email = v_email,
    condominio = comercial_texto(p_dados, 'condominio'), cnpj = v_cnpj, endereco = comercial_texto(p_dados, 'endereco'),
    cidade = comercial_texto(p_dados, 'cidade'), uf = comercial_texto(p_dados, 'uf'), faixa = comercial_texto(p_dados, 'faixa'),
    unidades = (p_dados ->> 'unidades')::integer, responsavel_id = v_resp,
    administradora = comercial_texto(p_dados, 'administradora'), app_administradora = (p_dados ->> 'appAdministradora')::boolean,
    sistema_atual = comercial_texto(p_dados, 'sistemaAtual'), fidelidade_ate = (p_dados ->> 'fidelidadeAte')::date,
    assembleia_ordinaria = (p_dados ->> 'assembleiaOrdinaria')::date, mandato_ate = (p_dados ->> 'mandatoAte')::date,
    decisor = comercial_texto(p_dados, 'decisor'), decisao_em = (p_dados ->> 'decisaoEm')::date,
    visita_em = (p_dados ->> 'visitaEm')::date, visita_nota = comercial_texto(p_dados, 'visitaNota'),
    demonstracao_em = (p_dados ->> 'demonstracaoEm')::timestamptz,
    criterios = case when p_dados ? 'criterios'
                     then coalesce((select array_agg(distinct c) from jsonb_array_elements_text(coalesce(p_dados -> 'criterios', '[]')) c), '{}')
                     else criterios end,
    criterio_outro = case when p_dados ? 'criterioOutro' then comercial_texto(p_dados, 'criterioOutro') else criterio_outro end,
    problema = case when p_dados ? 'problema' then comercial_texto(p_dados, 'problema') else problema end,
    taxa_condominio_media = case when p_dados ? 'taxaCondominioMedia' then (p_dados ->> 'taxaCondominioMedia')::numeric else taxa_condominio_media end,
    objecoes = coalesce((select array_agg(distinct o) from jsonb_array_elements_text(coalesce(p_dados -> 'objecoes', '[]')) o), '{}'),
    concorrentes = coalesce(p_dados -> 'concorrentes', '[]'),
    observacao = comercial_texto(p_dados, 'observacao'),
    -- Opt-in novo: guarda data, canal e o texto; tirar o opt-in apaga os três.
    optin_em = case when comercial_texto(p_dados, 'optinTexto') is null then null
                    when comercial_texto(p_dados, 'optinTexto') is distinct from i.optin_texto then app_now() else i.optin_em end,
    optin_canal = case when comercial_texto(p_dados, 'optinTexto') is null then null else coalesce(comercial_texto(p_dados, 'optinCanal'), i.optin_canal, 'WHATSAPP') end,
    optin_texto = comercial_texto(p_dados, 'optinTexto'),
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  perform registrar_historico_interno('comercial.ficha', 'interessado', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'versao', v_versao);
end $$;

-- ---------------------------------------------------------------------------------------
-- 3b. A taxa média de condomínio na proposta, no link e no kit (R17.3c, CM-19 e CM-20; DC17,
-- quadros 445 a 447). O percentual e a frase "menos de R$ 5" saem de uma função só do domínio
-- (pesoNaTaxa e menosDeCincoReais); aqui fica só o dado.

-- As premissas da versão (0306) com a taxa informada: entra no conteúdo e no hash da versão, então a
-- versão enviada nunca muda.
create function comercial_premissas(p_mensal bigint, p_unidades integer, p_por_ap bigint, p_taxa numeric) returns jsonb
language sql immutable
set search_path = public
as $$
  select case when p_taxa is null then comercial_premissas(p_mensal, p_unidades, p_por_ap)
              else comercial_premissas(p_mensal, p_unidades, p_por_ap) || jsonb_strip_nulls(jsonb_build_object(
                     'taxaCondominio', p_taxa,
                     'texto', (comercial_premissas(p_mensal, p_unidades, p_por_ap) ->> 'texto')
                              || ' Taxa média de condomínio informada: ' || reais(round(p_taxa * 100)::bigint::centavos) || ' por mês.')) end
$$;

-- A taxa como a tela manda: ausente, fica a da ficha; nula, sem taxa; número de 0,01 a 20.000.
create function comercial_taxa_do_pedido(p_dados jsonb, p_chave text, p_atual numeric) returns numeric
language plpgsql immutable
set search_path = public
as $$
begin
  if not (p_dados ? p_chave) then return p_atual; end if;
  if jsonb_typeof(p_dados -> p_chave) = 'null' then return null; end if;
  if jsonb_typeof(p_dados -> p_chave) <> 'number' or (p_dados ->> p_chave)::numeric <= 0 or (p_dados ->> p_chave)::numeric > 20000
     or (p_dados ->> p_chave)::numeric <> round((p_dados ->> p_chave)::numeric, 2) then
    perform recusar_campos('A taxa vai de R$ 0,01 a R$ 20.000', p_chave);
  end if;
  return (p_dados ->> p_chave)::numeric;
end $$;

-- A versão (0304) com a taxa: vem preenchida da ficha; a taxa digitada na versão passa a ser a da
-- ficha (a mais recente que o prédio informou), para o kit e a próxima versão. Sem o campo, a da
-- ficha; com o campo, grava na ficha com a versão dela (r8).
create or replace function comercial_preparar_versao(i interessados, p_dados jsonb) returns versoes_proposta
language plpgsql
set search_path = public
as $$
declare
  v versoes_proposta;
  c jsonb;
  v_unidades integer := coalesce((p_dados ->> 'unidades')::integer, i.unidades);
  v_desconto numeric := nullif(p_dados ->> 'desconto', '')::numeric;
  v_tabela text := comercial_texto(p_dados, 'tabela');
  v_dias integer := coalesce((p_dados ->> 'validadeDias')::integer, configuracao_int('proposta_validade_dias'));
  v_taxa numeric := comercial_taxa_do_pedido(p_dados, 'taxaCondominio', i.taxa_condominio_media);
begin
  if v_unidades is null then perform recusar_campos('Informe as unidades do prédio', 'unidades'); end if;
  if v_tabela is not null and v_tabela not in ('FUNDADOR', 'CHEIA', 'MANUAL') then perform recusar_campos('Escolha a tabela', 'tabela'); end if;
  if v_dias not between 1 and 60 then perform recusar_campos('A validade vai de 1 a 60 dias', 'validadeDias'); end if;
  c := comercial_calcular_proposta(v_unidades, comercial_texto(p_dados, 'ciclo'), v_tabela, (p_dados ->> 'valorManual')::bigint,
                                   (p_dados ->> 'implantacaoManual')::bigint, v_desconto);
  if c ->> 'tabela' = 'MANUAL' then
    if (p_dados ->> 'valorManual') is null then perform recusar_campos('Sob consulta: digite a mensalidade combinada', 'valorManual'); end if;
    if comercial_texto(p_dados, 'valorManualMotivo') is null then perform recusar_campos('Diga de onde veio o valor sob consulta', 'valorManualMotivo'); end if;
  end if;
  if v_desconto is not null and comercial_texto(p_dados, 'descontoMotivo') is null then
    perform recusar_campos('Diga por que o desconto', 'descontoMotivo');
  end if;
  v.condominio := i.condominio;
  v.cidade := i.cidade;
  v.uf := i.uf;
  v.faixa := c -> 'faixa' ->> 'codigo';
  v.unidades := v_unidades;
  v.ciclo := c ->> 'ciclo';
  v.tabela := c ->> 'tabela';
  v.mensal_tabela_centavos := (c ->> 'mensalTabela')::bigint;
  v.mensal_centavos := (c ->> 'mensal')::bigint;
  v.anual_centavos := (c ->> 'anual')::bigint;
  v.meses_pagos_anual := (c ->> 'mesesPagos')::integer;
  v.depois_centavos := (c ->> 'depoisFundador')::bigint;
  v.implantacao_centavos := (c ->> 'implantacao')::bigint;
  v.implantacao_parcelas := (c ->> 'implantacaoParcelas')::integer;
  v.implantacao_sem_custo := (c ->> 'implantacaoSemCusto')::boolean;
  v.valor_manual_motivo := case when v.tabela = 'MANUAL' then comercial_texto(p_dados, 'valorManualMotivo') end;
  v.desconto_percentual := v_desconto;
  v.desconto_motivo := case when v_desconto is not null then comercial_texto(p_dados, 'descontoMotivo') end;
  v.por_apartamento_centavos := (c ->> 'porApartamento')::bigint;
  v.premissas := comercial_premissas(v.mensal_centavos, v_unidades, v.por_apartamento_centavos, v_taxa);
  v.incluido := comercial_oferta_incluido();
  v.planejado := comercial_oferta_planejado();
  v.respostas := comercial_copiar_respostas(p_dados -> 'respostas');
  v.referencias := comercial_exigir_referencias(p_dados -> 'referencias');
  v.validade_dias := v_dias;
  v.nota_interna := comercial_texto(p_dados, 'notaInterna');
  -- Só quando a tela manda o campo (a pessoa mudou a taxa) e com a versão da ficha que ela viu (r8).
  if p_dados ? 'taxaCondominio' and v_taxa is distinct from i.taxa_condominio_media then
    if coalesce(p_dados ->> 'interessadoVersao', '') !~ '^[0-9]{1,9}$' then
      perform recusar_campos('Falta a versão da ficha para gravar a taxa', 'interessadoVersao');
    end if;
    update interessados set taxa_condominio_media = v_taxa, alterado_em = app_now(), alterado_por = contexto_pessoa()
     where id = i.id and versao = (p_dados ->> 'interessadoVersao')::integer;
    if not found then perform conflito_versao('interessados', i.id); end if;
    perform registrar_historico_interno('comercial.taxa_condominio', 'interessado', i.id::text, jsonb_build_object('taxa', v_taxa, 'de', 'PROPOSTA'));
  end if;
  return v;
end $$;

-- A sugestão da nova proposta (0304) vem com a taxa da ficha, para o campo já vir preenchido.
create or replace function comercial_sugestao_proposta(p_pessoa uuid, p_interessado uuid, p_unidades integer default null, p_ciclo text default null,
                                                       p_tabela text default null, p_valor_manual bigint default null, p_implantacao_manual bigint default null,
                                                       p_desconto numeric default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_interessado);
  return comercial_calcular_proposta(coalesce(p_unidades, i.unidades), p_ciclo, p_tabela, p_valor_manual, p_implantacao_manual, p_desconto)
    || jsonb_build_object(
      'interessado', jsonb_strip_nulls(jsonb_build_object('id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'unidades', i.unidades, 'faixa', i.faixa,
                                                          'pessoa', i.nome_contato, 'etapa', i.etapa, 'taxaCondominioMedia', i.taxa_condominio_media)),
      'propostaId', (select id from propostas_comercial where interessado_id = i.id),
      'oferta', jsonb_build_object('incluido', comercial_oferta_incluido(), 'planejado', comercial_oferta_planejado()),
      'respostas', comercial_respostas_revisadas(),
      'referencias', comercial_referencias_autorizadas());
end $$;

-- A proposta com as versões (0304): o interessado leva a taxa da ficha, para a versão nova.
create or replace function comercial_proposta(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  p := comercial_buscar_proposta(p_id);
  i := comercial_buscar(p.interessado_id);
  return jsonb_build_object(
    'id', p.id, 'versao', p.versao, 'criadoEm', p.criado_em,
    'interessado', jsonb_strip_nulls(jsonb_build_object('id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'pessoa', i.nome_contato, 'etapa', i.etapa,
                                                        'unidades', i.unidades, 'faixa', i.faixa, 'anonimizado', i.anonimizado_em is not null,
                                                        'naoContatar', comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj),
                                                        'taxaCondominioMedia', i.taxa_condominio_media)),
    'versoes', coalesce((select jsonb_agg(versao_proposta_json(v) order by v.numero desc) from versoes_proposta v where v.proposta_id = p.id), '[]'::jsonb),
    'kitDisponivel', exists (select 1 from versoes_proposta v where v.proposta_id = p.id and proposta_situacao(v) in ('ENVIADA', 'ACEITA')),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeAprovarDesconto', pode_global('console.comercial.desconto'));
end $$;

-- O kit (quadro 447) respeita a ficha (r5): com a taxa posta ou tirada na ficha (no kit, na versão
-- ou no site), a da ficha, e tirada é sem taxa; a ficha que nunca teve taxa usa a da versão enviada.
create function comercial_taxa_do_kit(v versoes_proposta, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select case when i.taxa_condominio_em is not null
              then jsonb_build_object('taxaCondominio', i.taxa_condominio_media, 'taxaDe', case when i.taxa_condominio_media is not null then 'FICHA' end)
              when v.premissas ? 'taxaCondominio'
              then jsonb_build_object('taxaCondominio', (v.premissas ->> 'taxaCondominio')::numeric, 'taxaDe', 'VERSAO')
              else '{}'::jsonb end
$$;

create or replace function comercial_kit(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  p := comercial_buscar_proposta(p_id);
  select * into v from versoes_proposta x where x.proposta_id = p.id and proposta_situacao(x) in ('ENVIADA', 'ACEITA') order by x.numero desc limit 1;
  if v.id is null then perform recusar_motivo('O kit sai da versão enviada; envie a proposta antes', 'SEM_VERSAO_ENVIADA'); end if;
  i := comercial_buscar(p.interessado_id);
  return jsonb_strip_nulls(proposta_kit_json(v, i) || comercial_taxa_do_kit(v, i))
    || jsonb_build_object('propostaId', p.id, 'versaoId', v.id, 'respostasDisponiveis', comercial_respostas_revisadas(),
                          'interessado', jsonb_build_object('id', i.id, 'versao', i.versao), 'fatos', comercial_fatos_do_kit(i),
                          'podeEditar', pode_global('console.comercial.editar'));
end $$;

create or replace function publico_kit_proposta(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  i interessados;
  v_kit jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id;
  i := publico_interessado_da_versao(v);
  perform publico_exigir_em_validade(l, v);
  if v.situacao not in ('ENVIADA', 'ACEITA') then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  v_kit := jsonb_strip_nulls(proposta_kit_json(v, i) || comercial_taxa_do_kit(v, i));
  perform set_config('app.comercial_sistema', '', true);
  return v_kit;
end $$;

-- "Corrigir a taxa" no kit: grava na ficha; vale para o kit e para a próxima versão, nunca para a
-- versão já enviada.
create function comercial_salvar_taxa(p_pessoa uuid, p_id uuid, p_versao integer, p_taxa numeric) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if p_taxa is not null and (p_taxa <= 0 or p_taxa > 20000 or p_taxa <> round(p_taxa, 2)) then
    perform recusar_campos('A taxa vai de R$ 0,01 a R$ 20.000', 'taxaCondominio');
  end if;
  update interessados set taxa_condominio_media = p_taxa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('interessados', p_id); end if;
  perform registrar_historico_interno('comercial.taxa_condominio', 'interessado', p_id::text, jsonb_build_object('taxa', p_taxa));
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'taxaCondominio', p_taxa);
end $$;

-- ---------------------------------------------------------------------------------------
-- 4. LGPD: a anonimização do interessado (0308) também tira o e-mail da fila e cancela a
-- demonstração marcada; a rotina diária apaga o contato do parceiro e o e-mail do agendamento.

create or replace function comercial_anonimizar(p_id uuid, p_resumo text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_cliente boolean;
  v_assinado uuid;
  v_cond uuid;
  v_pessoa uuid := contexto_pessoa();
  r record;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  select virou_cliente_em is not null, condominio_id into v_cliente, v_cond from interessados where id = p_id;
  select id into v_assinado from contratos_comercial where interessado_id = p_id and situacao = 'ASSINADO' and coalesce(v_cliente, false);
  update interessados set nome_contato = null, papel_contato = null, whatsapp = null, email = null, cnpj = null, endereco = null,
         optin_em = null, optin_canal = null, optin_texto = null, observacao = null, perda_detalhe = null, decisor = null, visita_nota = null,
         proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null,
         criterios = array_remove(criterios, 'OUTRO'), criterio_outro = null, problema = null,
         cadencia_fim_em = case when cadencia_id is not null then coalesce(cadencia_fim_em, app_now()) end,
         cadencia_fim_motivo = case when cadencia_id is not null then coalesce(cadencia_fim_motivo, 'NAO_CONTATAR') end,
         anonimizado_em = app_now()
   where id = p_id;
  update conversas_comercial set resumo = p_resumo where interessado_id = p_id;
  update fatos_comparativo set texto = 'Dado apagado (LGPD)', fonte = 'Dado apagado (LGPD)',
         outro_chave = case when outro_chave is not null then 'apagado' end, retirado_em = coalesce(retirado_em, app_now())
   where interessado_id = p_id and escopo = 'PREDIO';
  -- O aceite do contrato assinado é a prova de quem assinou: fica com o contrato.
  update aceites_proposta a set nome = null, cpf = null, ip = null, aparelho = null, anonimizado_em = app_now()
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.anonimizado_em is null
     and not exists (select 1 from contratos_comercial c where c.id = v_assinado and c.aceite_id = a.id);
  update aberturas_proposta a set aparelho = null
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where a.versao_id = v.id and p.interessado_id = p_id and a.aparelho is not null;
  update versoes_proposta v set nota_interna = null
    from propostas_comercial p
   where p.id = v.proposta_id and p.interessado_id = p_id and v.nota_interna is not null;
  -- Documentos do aceite: os recebidos de quem virou cliente ficam; o resto some.
  update documentos_aceite set situacao = 'APAGADO', apagado_em = app_now(), nome = null, cnpj = null, mandato_ate = null, ip = null,
                               motivo_recusa = null
   where interessado_id = p_id and apagado_em is null and not (v_assinado is not null and situacao = 'RECEBIDO');
  for r in select caminho from documentos_aceite
            where interessado_id = p_id and caminho is not null and not (v_assinado is not null and situacao = 'RECEBIDO') loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- Contratos: o assinado de quem virou cliente fica; os outros perdem o retrato e o PDF.
  update contratos_comercial set dados = jsonb_build_object('anonimizado', true, 'numero', numero), anonimizado_em = app_now()
   where interessado_id = p_id and anonimizado_em is null and id is distinct from v_assinado;
  for r in select caminho from contratos_comercial
            where interessado_id = p_id and caminho is not null and id is distinct from v_assinado loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- Envios: os dois conferidos do contrato assinado de quem virou cliente ficam; dos outros (também
  -- os conferidos de um contrato que não chegou a virar cliente), o arquivo e quem assinou somem.
  update envios_contrato set apagado_em = coalesce(apagado_em, app_now()), nome = null, ip = null, assinante_nome = null, cpf_mascarado = null,
                             observacao = null, recusa_motivo = null
   where interessado_id = p_id and not (v_assinado is not null and contrato_id = v_assinado and situacao = 'CONFERIDO')
     and (apagado_em is null or num_nonnulls(nome, ip, assinante_nome, cpf_mascarado, observacao, recusa_motivo) > 0);
  for r in select caminho from envios_contrato
            where interessado_id = p_id and caminho is not null
              and not (v_assinado is not null and contrato_id = v_assinado and situacao = 'CONFERIDO') loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ANONIMIZADO');
  end loop;
  -- O condomínio do piloto que não virou cliente (o piloto já foi encerrado pelo gatilho do
  -- interessado): ficam o nome e o endereço na carteira, sem contatos nem CNPJ.
  if v_cond is not null and not coalesce(v_cliente, false) then
    perform entrar_como_sistema(v_cond);
    update condominios set contatos = '[]'::jsonb, cnpj = null where id = v_cond and (contatos <> '[]'::jsonb or cnpj is not null);
    if v_pessoa is not null then perform definir_pessoa(v_pessoa); else perform entrar_como_sistema(null); end if;
  end if;
  update trocas_sistema set carta = 'Carta apagada (LGPD).' where interessado_id = p_id;
  update pilotos_comercial set combinado_com = null, detalhe = null where interessado_id = p_id;
  perform comercial_revogar_links_interessado(p_id, 'Dados apagados (LGPD)', null);
  -- A agenda (0310): a demonstração marcada é cancelada sem aviso e o e-mail sai da fila.
  update demonstracoes_comercial set situacao = 'CANCELADA', motivo = 'Dados apagados (LGPD)', encerrada_em = app_now(), encerrada_por = v_pessoa
   where interessado_id = p_id and situacao = 'MARCADA';
  update demonstracoes_comercial set nome_contato = null, condominio = null, email = null
   where interessado_id = p_id and num_nonnulls(nome_contato, condominio, email) > 0;
  update emails_comercial e set situacao = case when e.situacao in ('NA_FILA', 'ENVIANDO') then 'CANCELADO' else e.situacao end, para = null
    from demonstracoes_comercial d
   where d.id = e.demonstracao_id and d.interessado_id = p_id and e.para is not null;
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- Roda todo dia (decisão j): o contato do parceiro inativo e o e-mail do agendamento.
create function comercial_retencao_parceiros_agenda() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total integer := 0;
  v_n integer;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  for r in
    select p.id from parceiros_comercial p
     where not p.ativo and p.anonimizado_em is null
       and case when exists (select 1 from comissoes_parceiro c where c.parceiro_id = p.id)
                then greatest(p.inativado_em,
                              (select max(g.pago_em)::timestamptz from pagamentos_comissao g where g.parceiro_id = p.id),
                              (select max(c.encerrada_em) from comissoes_parceiro c where c.parceiro_id = p.id))
                     < app_now() - make_interval(years => configuracao_int('comercial_parceiro_com_comissao_anos'))
                     -- Com prédio ainda ativo, a comissão continua devida: o contato fica.
                     and not exists (select 1 from comissoes_parceiro c where c.parceiro_id = p.id and c.encerrada_em is null
                                       and (c.prazo_meses is null or (c.inicio + make_interval(months => c.prazo_meses))::date > comercial_hoje()))
                else p.inativado_em < app_now() - make_interval(months => configuracao_int('comercial_parceiro_sem_comissao_meses')) end
  loop
    perform comercial_anonimizar_parceiro(r.id);
    v_total := v_total + 1;
  end loop;
  perform set_config('app.comercial_sistema', 'on', true);
  update emails_comercial e set para = null, situacao = case when e.situacao in ('NA_FILA', 'ENVIANDO') then 'CANCELADO' else e.situacao end
    from demonstracoes_comercial d
   where d.id = e.demonstracao_id and e.para is not null
     and d.fim < app_now() - make_interval(days => configuracao_int('comercial_agenda_email_dias'));
  get diagnostics v_n = row_count;
  -- O nome e o e-mail digitados no link saem junto (r1); fica o condomínio, que não é de pessoa.
  update demonstracoes_comercial set nome_contato = null, email = null
   where num_nonnulls(nome_contato, email) > 0 and fim < app_now() - make_interval(days => configuracao_int('comercial_agenda_email_dias'));
  perform set_config('app.comercial_sistema', '', true);
  return v_total + v_n;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('retencao-parceiros-agenda', '27 4 * * *', 'select public.comercial_retencao_parceiros_agenda()');
  perform cron.schedule('fila-email-comercial', '*/5 * * * *', 'select public.chamar_fila_comercial()');
exception when others then
  raise notice 'pg_cron indisponível: agende comercial_retencao_parceiros_agenda() e chamar_fila_comercial() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- 5. O histórico dos parceiros, das comissões e da agenda é do Comercial, como o dos interessados.

alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial', 'proposta', 'resposta_comercial',
                                                                'referencia_comercial', 'fato_comparativo', 'modelo_contrato',
                                                                'documento_aceite', 'contrato_comercial', 'piloto_comercial', 'troca_sistema',
                                                                'meta_comercial', 'parceiro_comercial', 'regra_comissao', 'comissao_parceiro',
                                                                'agenda_comercial', 'demonstracao_comercial')
             and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- Quem está no Console: as ações do menu, agora com a comissão dos parceiros. A lista leva as da
-- 0295, 0296, 0301, 0304, 0308 e 0309, para nenhuma frente apagar a da outra.

create or replace function console_sessao(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform definir_pessoa(p_pessoa);
  if not contexto_equipe() then
    raise exception 'Só a equipe TRÍADE' using errcode = 'TC401';
  end if;
  select jsonb_build_object(
    'pessoaId', p.id,
    'nome', p.nome,
    'funcoes', to_jsonb(contexto_equipe_funcoes()),
    'acoes', coalesce((select jsonb_agg(distinct fa.acao order by fa.acao) from funcao_acoes fa
                        where fa.funcao = any (contexto_equipe_funcoes())
                          and fa.acao in ('console.condominios.criar', 'console.equipe.gerenciar', 'console.historico.equipe',
                                          'console.pagamentos.ver', 'console.pagamentos.registrar',
                                          'console.precos.ver', 'console.precos.editar',
                                          'console.retencao.ver', 'console.retencao.ligar',
                                          'console.comercial.ver', 'console.comercial.editar', 'console.comercial.modelos',
                                          'console.comercial.exportar', 'console.comercial.excluir', 'console.comercial.desconto',
                                          'console.comercial.assinar', 'console.comercial.cliente', 'console.comercial.meta',
                                          'console.comercial.comissao')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

-- 0311 · Renovação e reajuste, cancelamento com retenção, sinais de risco e expansão dos clientes
-- (R17.7; IDEIAS CM-30, CM-31 e CM-32; plano em comercial/r17-7/plano-0311.md; quadros 346
-- (Renovações), 347 (Pedido de cancelamento) e 335 (o cartão do Comercial no Início)).
--
-- Decisões já tomadas (plano):
-- 1.  O aniversário conta da data de início do contrato assinado (0308: dados ->> 'dataInicio').
-- 2.  O índice é parâmetro da Administração. Sem ele, a tela mostra "[a definir com o advogado]" e
--     não calcula valor nenhum.
-- 3.  O fim do preço de fundador (12 meses) entra na mesma lista e passa o cliente para a tabela
--     cheia da Tabela de preços (0295) do dia do aviso.
-- 4.  Nada muda sem o aviso enviado: o aviso fica registrado (data, canal e texto) e o valor novo
--     vale depois do prazo de aviso (parâmetro, 30 dias), na competência seguinte da cobrança (0291).
-- 5.  O aviso gera o aditivo (CM-13): PDF com a impressão digital, de um modelo de aditivo em
--     Modelos › Contrato. Sem modelo em uso, não há aditivo e o reajuste vale só pelo aviso. A
--     assinatura pelo gov.br fica pendente no painel.
-- 6.  "Avisar até" é o aniversário menos o prazo; os atrasados e os que estão perto vão para o
--     cartão do Início.
-- 7.  Cancelamento: o motivo vem de uma lista própria (síndico novo, preço, pouco uso, foi para
--     outro sistema, administradora oferece, fechou o condomínio, outro com texto); uma tentativa de
--     retenção registrada; a decisão é do síndico.
-- 8.  Confirmado o cancelamento: 30 dias de aviso (N.1) com o último dia calculado; o acesso continua
--     até o último dia; a exportação completa fica pronta para o síndico (a da Plataforma, 0180); a
--     cobrança para depois do último dia; a comissão do parceiro (0310) acaba no último dia.
-- 9.  Sinais de risco (aba própria e cartão do Início): síndico novo eleito, uso caindo e troca de
--     sistema na pauta (marcada à mão).
-- 10. CM-11: o Comercial vê o nome, o plano e os sinais; nunca os dados do condomínio.
-- 11. Expansão: funil próprio ligado ao cliente; mais um prédio (CM-09, oportunidade nova do mesmo
--     contato, 0308), mudança de faixa (unidades ativas acima do limite da faixa do plano) e
--     reconquista (cliente que saiu, lembrado quando há síndico novo ou chega a data combinada).
--     Cada uma com responsável, próximo passo e motivo.
-- 12. LGPD: o texto do aviso e o da retenção entram no catálogo de retenção (0301) e na anonimização.
--
-- Decisões desta rodada, onde o plano não dizia:
-- a. O aniversário da vez é o primeiro depois do início do contrato que ainda não teve aviso nem
--    dispensa e não passou há mais de 60 dias (parâmetro); o que passou disso sem registro fica
--    para trás. "Renovar sem reajuste" (dispensa, com motivo) também conta como registro.
-- b. O índice é um parâmetro de uma linha (regra_reajuste: índice, percentual do período, a
--    referência e o prazo de aviso), mudado por quem cuida de Modelos (console.comercial.modelos,
--    a Administração): é o mesmo lugar do contrato e do aditivo, e evita uma ação nova.
-- c. O valor com reajuste é o valor de hoje vezes (1 + percentual), arredondado ao centavo. No
--    fundador, é a mensalidade cheia da faixa do plano; faixa sob consulta não tem valor e não avisa.
-- d. Vale desde: a primeira competência cujo vencimento cai no aniversário ou depois e no fim do
--    prazo de aviso ou depois (a regra da primeira competência de virar cliente, 0308). O plano do
--    cliente muda ao abrir essa competência (console_abrir_competencia): é ali que a cobrança nasce;
--    o fundador passa para a tabela cheia e a vaga é liberada pelo gatilho do plano (0295).
-- e. O aviso registrado não se desfaz (ele já foi para o síndico). O aditivo é numerado por cliente e
--    guarda o retrato com a impressão digital; o PDF é montado pela API e guardado como o contrato.
-- f. Pedido de cancelamento: a equipe registra quem pediu e quando; o último dia é a data do pedido
--    mais 30 dias (parâmetro, N.1): 24/10 dá 23/11. Registrar o pedido, a tentativa e "decidiu
--    ficar" é do Comercial; confirmar o cancelamento é da Administração (console.comercial.cliente),
--    porque para a cobrança, a comissão e abre a exportação. Confirmado não volta: se o síndico mudar
--    de ideia depois, é reconquista (CM-32).
-- g. Depois do último dia, a Plataforma fica só para ver e exportar (e a privacidade e o suporte):
--    as outras ações recebem CONTRATO_ENCERRADO. A carteira (estágio do cliente) não muda aqui; a
--    competência que começa depois do último dia não é aberta; a do último dia é.
-- h. A exportação do cancelamento é pedida em nome do síndico ativo (o aviso de pronta vai para ele),
--    como a da Plataforma; sem síndico ativo, não é pedida e a tela avisa. Se já houver uma montando,
--    vale essa.
-- i. A comissão (0310) fica sem comissão desde o mês seguinte ao do último dia, encerrada pelo
--    cancelamento. Ela continua calculada sobre a mensalidade contratada (o reajuste não muda a
--    comissão: o Comercial não lê as cobranças).
-- j. Síndico novo: vem da troca de síndico registrada no Console (0190, um gatilho) e da marcação à
--    mão em Risco (a eleição pode vir antes da troca). O evento da 0309 (janela de síndico novo) é
--    só do funil e continua recusando cliente. Uso caindo: sem a medida de adoção (PI-13) no banco,
--    usa a queda dos pedidos nos últimos 30 dias contra os 30 anteriores (40% ou mais, com pelo menos
--    10 pedidos antes; parâmetros), uma vez por mês, pela rotina diária. Sinal tratado ("Já vi") some
--    da lista.
-- k. Expansão: o "mais um prédio" abre a oportunidade nova pela 0308 e acompanha; mudar de faixa e
--    reconquista aparecem como sugestão e entram no funil por quem atende. Uma aberta de cada tipo por
--    cliente (mais um prédio pode ter várias). Ganhar a mudança de faixa não muda o plano: a
--    Administração muda o plano na ficha do cliente.
-- l. Retenção: o texto do aviso e quem recebeu saem 5 anos depois do aviso; quem pediu o
--    cancelamento, a tentativa de retenção, as notas e o detalhe dos sinais tratados saem 12 meses
--    depois do último dia (ou do sinal tratado). Os dois tipos entram como "a fazer" no catálogo, como
--    os do Comercial: a rotina própria aplica.
-- m. Ordem das travas: o interessado (o cliente) antes do cancelamento e da renovação, como a
--    anonimização; a expansão de mais um prédio trava o interessado na 0308.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos).

-- ---------------------------------------------------------------------------------------
-- Parâmetros e o catálogo de retenção.

insert into configuracoes (chave, valor, descricao) values
  ('comercial_renovacao_horizonte_dias', '120', 'Dias depois do começo do mês escolhido em que Renovações mostra os aniversários de contrato'),
  ('comercial_renovacao_atraso_dias', '60', 'Dias depois do aniversário em que a renovação sem aviso ainda aparece'),
  ('comercial_renovacao_inicio_dias', '15', 'Dias antes do "avisar até" em que a renovação entra no cartão do Comercial no Início'),
  ('comercial_cancelamento_aviso_dias', '30', 'Dias de aviso do cancelamento, sem multa (N.1)'),
  ('comercial_uso_queda_percentual', '40', 'Queda dos pedidos em 30 dias, em %, que vira sinal de uso caindo'),
  ('comercial_uso_base_minima', '10', 'Pedidos nos 30 dias anteriores abaixo dos quais a queda não vira sinal'),
  ('comercial_aviso_texto_anos', '5', 'Anos depois do aviso em que o texto e quem recebeu o aviso de reajuste são apagados'),
  ('comercial_cancelamento_texto_meses', '12', 'Meses depois do último dia (ou do sinal tratado) em que os textos do cancelamento e dos sinais são apagados');

insert into retencao_tipos (numero, codigo, sistema, grupo, nome, o_que, para_que, base, quem, prazo, no_fim, situacao) values
 (39, 'AVISO_REAJUSTE', 'CONSOLE', 'Console TRÍADE', 'Aviso de reajuste ao síndico', 'Texto do aviso, o canal e o nome de quem recebeu',
  'Provar o aviso antes do valor novo', 'Execução do contrato', 'TRÍADE', '5 anos depois do aviso',
  'Texto e nome apagados; ficam os valores, as datas e o aditivo', 'A_FAZER'),
 (40, 'CANCELAMENTO', 'CONSOLE', 'Console TRÍADE', 'Cancelamento, retenção e sinais de risco',
  'Quem pediu, a tentativa de retenção, as notas e o detalhe dos sinais', 'Atender o pedido e tentar manter o cliente',
  'Execução do contrato; legítimo interesse', 'TRÍADE', '12 meses depois do último dia (ou do sinal tratado)',
  'Textos apagados; ficam o motivo da lista e as datas', 'A_FAZER');

-- ---------------------------------------------------------------------------------------
-- 1. A regra do reajuste (decisão b): uma linha; sem índice, nada é calculado.

create table regra_reajuste (
  id               boolean primary key default true check (id),
  indice           text check (length(btrim(indice)) between 2 and 60),
  percentual       numeric(5, 2) check (percentual between -20 and 50),
  referencia       text check (length(btrim(referencia)) between 3 and 120),
  prazo_aviso_dias integer not null default 30 check (prazo_aviso_dias between 30 and 120),
  alterado_em      timestamptz,
  alterado_por     uuid references pessoas (id),
  versao           integer not null default 1,
  check ((indice is null) = (percentual is null)),
  check (referencia is null or indice is not null)
);
call proteger_tabela_comercial('regra_reajuste', 'console.comercial.modelos',
  'Regra do reajuste dos clientes (índice, percentual, referência e prazo de aviso), uma linha; só quem cuida de Modelos muda (CM-30)');
create trigger regra_reajuste_sem_exclusao before delete on regra_reajuste for each row execute function somente_insercao();
insert into regra_reajuste (id) values (true);

-- ---------------------------------------------------------------------------------------
-- 2. O modelo de aditivo (CM-13, decisão 5), em Modelos › Contrato, com versões como o contrato.

create function aditivo_campos() returns text[]
language sql immutable
set search_path = public
as $$ select array['condominio', 'contrato', 'data_contrato', 'aniversario', 'valor_atual', 'valor_novo', 'motivo_reajuste',
                   'vale_desde', 'aviso_em'] $$;

create function aditivo_campos_errados(p text) returns text[]
language sql immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select '«' || m[1] || '»' as x from regexp_matches(coalesce(p, ''), '«([^«»]*)»', 'g') m where not (m[1] = any (aditivo_campos()))
    union all
    select s from (values ('«'), ('»')) v(s) where strpos(regexp_replace(coalesce(p, ''), '«[^«»]*»', '', 'g'), s) > 0
  ) e
$$;

create table modelos_aditivo (
  id             uuid primary key default gen_random_uuid(),
  numero         integer not null unique check (numero between 1 and 999),
  titulo         text not null check (length(btrim(titulo)) between 3 and 120),
  texto          text not null check (length(btrim(texto)) between 50 and 20000),
  situacao       text not null default 'RASCUNHO' check (situacao in ('RASCUNHO', 'EM_USO', 'SUBSTITUIDA')),
  em_uso_em      timestamptz,
  em_uso_por     uuid references pessoas (id),
  substituida_em timestamptz,
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  alterado_em    timestamptz,
  alterado_por   uuid references pessoas (id),
  versao         integer not null default 1,
  check (cardinality(aditivo_campos_errados(texto)) = 0),
  check (situacao = 'RASCUNHO' or em_uso_em is not null),
  check ((situacao = 'SUBSTITUIDA') = (substituida_em is not null))
);
create unique index modelos_aditivo_um_em_uso on modelos_aditivo ((true)) where situacao = 'EM_USO';
call proteger_tabela_comercial('modelos_aditivo', 'console.comercial.modelos',
  'Versões do modelo de aditivo de reajuste (CM-13, CM-30); só a Administração muda; a versão em uso não se edita');
create trigger modelos_aditivo_sem_exclusao before delete on modelos_aditivo for each row execute function somente_insercao();

create function modelos_aditivo_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.numero, new.criado_em, new.criado_por) is distinct from (old.id, old.numero, old.criado_em, old.criado_por) then
    raise exception 'O modelo não troca de número' using errcode = 'TC422', detail = '{"motivo":"MODELO_EM_USO"}';
  end if;
  if old.situacao = 'RASCUNHO' and new.situacao in ('RASCUNHO', 'EM_USO') then return new; end if;
  if old.situacao = 'EM_USO' and new.situacao = 'SUBSTITUIDA'
     and (to_jsonb(new) - array['situacao', 'substituida_em', 'alterado_em', 'alterado_por', 'versao'])
         is not distinct from (to_jsonb(old) - array['situacao', 'substituida_em', 'alterado_em', 'alterado_por', 'versao']) then
    return new;
  end if;
  raise exception 'A versão em uso não se edita; cadastre a versão seguinte' using errcode = 'TC422', detail = '{"motivo":"MODELO_EM_USO"}';
end $$;
create trigger modelos_aditivo_regras before update on modelos_aditivo for each row execute function modelos_aditivo_regras();

-- ---------------------------------------------------------------------------------------
-- 3. A renovação de cada aniversário (CM-30): o aviso registrado ou a dispensa.

create table renovacoes_cliente (
  id                 uuid primary key default gen_random_uuid(),
  interessado_id     uuid not null references interessados (id),
  condominio_id      uuid not null references condominios (id),
  aniversario        date not null,
  tipo               text not null check (tipo in ('REAJUSTE', 'FIM_FUNDADOR')),
  situacao           text not null check (situacao in ('AVISO_ENVIADO', 'APLICADO', 'DISPENSADO')),
  valor_atual        centavos not null check (valor_atual > 0),
  valor_novo         centavos check (valor_novo > 0),
  ciclo              text not null check (ciclo in ('MENSAL', 'ANUAL')),
  indice             text check (length(btrim(indice)) between 2 and 60),
  percentual         numeric(5, 2),
  referencia         text check (length(btrim(referencia)) between 3 and 120),
  avisar_ate         date not null,
  aviso_em           date,
  aviso_canal        text check (aviso_canal in ('WHATSAPP', 'EMAIL', 'CARTA', 'PRESENCIAL', 'OUTRO')),
  aviso_para         text check (length(btrim(aviso_para)) between 2 and 120),
  aviso_texto        text check (length(btrim(aviso_texto)) between 10 and 2000),
  vale_desde         date check (extract(day from vale_desde) = 1),
  dispensa_motivo    text check (length(btrim(dispensa_motivo)) between 3 and 300),
  aplicado_em        timestamptz,
  textos_apagados_em timestamptz,
  registrado_em      timestamptz not null default app_now(),
  registrado_por     uuid references pessoas (id),
  versao             integer not null default 1,
  unique (interessado_id, aniversario),
  check ((situacao = 'DISPENSADO') = (dispensa_motivo is not null)),
  check (situacao = 'DISPENSADO'
         or (valor_novo is not null and aviso_em is not null and aviso_canal is not null and vale_desde is not null
             and (textos_apagados_em is not null or (aviso_para is not null and aviso_texto is not null)))),
  check ((situacao = 'APLICADO') = (aplicado_em is not null)),
  check (tipo <> 'REAJUSTE' or situacao = 'DISPENSADO' or (indice is not null and percentual is not null))
);
create index renovacoes_cliente_aviso on renovacoes_cliente (situacao) where situacao = 'AVISO_ENVIADO';
call proteger_tabela_comercial('renovacoes_cliente', 'console.comercial.editar',
  'Renovação de cada aniversário do contrato do cliente: aviso de reajuste ou dispensa (CM-30); o valor e as datas ficam');
create trigger renovacoes_cliente_sem_exclusao before delete on renovacoes_cliente for each row execute function somente_insercao();

-- Só o que a rotina faz: o aviso que passa a valer e os textos apagados (LGPD).
create function renovacoes_cliente_fixas() returns trigger
language plpgsql
set search_path = public
as $$
declare v_livres text[] := array['situacao', 'aplicado_em', 'aviso_para', 'aviso_texto', 'textos_apagados_em', 'versao'];
begin
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres)
     or (new.situacao is distinct from old.situacao and not (old.situacao = 'AVISO_ENVIADO' and new.situacao = 'APLICADO'))
     or (new.aplicado_em is distinct from old.aplicado_em and new.situacao <> 'APLICADO')
     or (num_nonnulls(new.aviso_para, new.aviso_texto) > 0
         and (new.aviso_para, new.aviso_texto) is distinct from (old.aviso_para, old.aviso_texto))
     or (new.textos_apagados_em is distinct from old.textos_apagados_em and old.textos_apagados_em is not null) then
    raise exception 'O aviso registrado não se altera' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger renovacoes_cliente_fixas before update on renovacoes_cliente for each row execute function renovacoes_cliente_fixas();

-- O que muda no plano e desde quando (decisão d): interno, no condomínio, para a cobrança ler.
create table reajustes_plano (
  id             uuid primary key default gen_random_uuid(),
  condominio_id  uuid not null references condominios (id) on delete restrict,
  renovacao_id   uuid not null unique references renovacoes_cliente (id),
  tipo           text not null check (tipo in ('REAJUSTE', 'FIM_FUNDADOR')),
  vale_desde     date not null check (extract(day from vale_desde) = 1),
  valor_centavos centavos not null check (valor_centavos > 0),
  tabela         text check (tabela = 'CHEIA'),
  nome           text check (length(btrim(nome)) between 2 and 60),
  aplicado_em    timestamptz,
  criado_em      timestamptz not null default app_now(),
  check ((tipo = 'FIM_FUNDADOR') = (tabela is not null and nome is not null))
);
create index reajustes_plano_pendentes on reajustes_plano (condominio_id, vale_desde) where aplicado_em is null;
call proteger_tabela_interna('reajustes_plano', 'Valor novo do plano depois do aviso de reajuste e desde qual competência (CM-30); o cliente não vê');
create trigger reajustes_plano_sem_exclusao before delete on reajustes_plano for each row execute function somente_insercao();
-- Quem registra o aviso é o Comercial, que não tem vínculo com o condomínio do cliente: grava
-- como sistema, dentro do condomínio (entrar_como_sistema), como o piloto encerrado da 0308.
-- Só a inserção; aplicar (na competência) é com a Administração já no condomínio.
create policy reajuste_registrado_pelo_comercial on reajustes_plano for insert
  with check (comercial_sistema() and contexto_pessoa() is null and condominio_id = contexto_condominio() and aplicado_em is null);
create function reajustes_plano_fixos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.aplicado_em is not null or new.aplicado_em is null or (to_jsonb(new) - 'aplicado_em') is distinct from (to_jsonb(old) - 'aplicado_em') then
    raise exception 'O reajuste só muda para aplicado, uma vez' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger reajustes_plano_fixos before update on reajustes_plano for each row execute function reajustes_plano_fixos();

-- O aditivo do aviso (decisão e): o retrato e o PDF, como o contrato (0308).
create table aditivos_comercial (
  id             uuid primary key default gen_random_uuid(),
  renovacao_id   uuid not null unique references renovacoes_cliente (id),
  interessado_id uuid not null references interessados (id),
  numero         integer not null check (numero between 1 and 999),
  modelo_id      uuid not null references modelos_aditivo (id),
  dados          jsonb not null,
  hash           text not null check (hash ~ '^[0-9a-f]{64}$'),
  caminho        text not null unique check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  situacao       text not null default 'GERANDO' check (situacao in ('GERANDO', 'PRONTO')),
  pdf_sha256     text check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_tamanho    bigint check (pdf_tamanho between 1 and 10485760),
  gerado_em      timestamptz not null default app_now(),
  gerado_por     uuid references pessoas (id),
  pronto_em      timestamptz,
  unique (interessado_id, numero),
  check ((situacao = 'PRONTO') = (pdf_sha256 is not null and pdf_tamanho is not null and pronto_em is not null))
);
call proteger_tabela_comercial('aditivos_comercial', 'console.comercial.editar',
  'Aditivo de reajuste gerado do modelo em uso, com a impressão digital (CM-13, CM-30); o retrato não muda');
create trigger aditivos_comercial_sem_exclusao before delete on aditivos_comercial for each row execute function somente_insercao();
create function aditivos_comercial_fixos() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.situacao <> 'GERANDO' or new.situacao <> 'PRONTO'
     or (to_jsonb(new) - array['situacao', 'pdf_sha256', 'pdf_tamanho', 'pronto_em'])
        is distinct from (to_jsonb(old) - array['situacao', 'pdf_sha256', 'pdf_tamanho', 'pronto_em']) then
    raise exception 'O aditivo gerado não muda' using errcode = 'TC422', detail = '{"motivo":"ADITIVO_PRONTO"}';
  end if;
  return new;
end $$;
create trigger aditivos_comercial_fixos before update on aditivos_comercial for each row execute function aditivos_comercial_fixos();

-- ---------------------------------------------------------------------------------------
-- 4. Sinais de risco (CM-31, decisão j).

create table riscos_cliente (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  tipo           text not null check (tipo in ('SINDICO_NOVO', 'USO_CAINDO', 'TROCA_NA_PAUTA')),
  origem         text not null check (origem in ('A_MAO', 'TROCA_SINDICO', 'PEDIDOS')),
  data_ref       date not null,
  detalhe        text check (length(btrim(detalhe)) between 3 and 200),
  tratado_em     timestamptz,
  tratado_por    uuid references pessoas (id),
  tratado_nota   text check (length(btrim(tratado_nota)) between 3 and 300),
  criado_em      timestamptz not null default app_now(),
  criado_por     uuid references pessoas (id),
  versao         integer not null default 1,
  unique (interessado_id, tipo, data_ref),
  check ((tratado_em is null) = (tratado_por is null)),
  check (tratado_nota is null or tratado_em is not null),
  check (origem <> 'A_MAO' or (criado_por is not null and tipo in ('SINDICO_NOVO', 'TROCA_NA_PAUTA'))),
  check (tipo <> 'TROCA_NA_PAUTA' or origem = 'A_MAO'),
  check (origem <> 'PEDIDOS' or tipo = 'USO_CAINDO'),
  check (origem <> 'TROCA_SINDICO' or tipo = 'SINDICO_NOVO')
);
create index riscos_cliente_abertos on riscos_cliente (interessado_id) where tratado_em is null;
call proteger_tabela_comercial('riscos_cliente', 'console.comercial.editar',
  'Sinais de risco do cliente: síndico novo, uso caindo e troca de sistema na pauta (CM-31); sem dado do condomínio');
create trigger riscos_cliente_sem_exclusao before delete on riscos_cliente for each row execute function somente_insercao();
create function riscos_cliente_fixos() returns trigger
language plpgsql
set search_path = public
as $$
declare v_livres text[] := array['tratado_em', 'tratado_por', 'tratado_nota', 'detalhe', 'versao'];
begin
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres)
     or (old.tratado_em is not null and (new.tratado_em, new.tratado_por) is distinct from (old.tratado_em, old.tratado_por))
     or (new.detalhe is not null and new.detalhe is distinct from old.detalhe)
     or (old.tratado_em is not null and new.tratado_nota is not null and new.tratado_nota is distinct from old.tratado_nota) then
    raise exception 'O sinal registrado só muda para tratado' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  return new;
end $$;
create trigger riscos_cliente_fixos before update on riscos_cliente for each row execute function riscos_cliente_fixos();

-- ---------------------------------------------------------------------------------------
-- 5. Cancelamento e retenção (CM-31, decisão f).

create table cancelamentos_cliente (
  id                 uuid primary key default gen_random_uuid(),
  interessado_id     uuid not null references interessados (id),
  condominio_id      uuid not null references condominios (id),
  pedido_por         text check (length(btrim(pedido_por)) between 2 and 120),
  pedido_em          timestamptz not null,
  aviso_dias         integer not null check (aviso_dias between 1 and 180),
  ultimo_dia         date not null,
  motivo             text check (motivo in ('SINDICO_NOVO', 'PRECO', 'POUCO_USO', 'OUTRO_SISTEMA', 'ADMINISTRADORA', 'FECHOU', 'OUTRO')),
  motivo_texto       text check (length(btrim(motivo_texto)) between 3 and 300),
  retencao           text check (length(btrim(retencao)) between 3 and 1000),
  retencao_em        timestamptz,
  retencao_por       uuid references pessoas (id),
  situacao           text not null default 'PEDIDO' check (situacao in ('PEDIDO', 'EM_RETENCAO', 'FICOU', 'CONFIRMADO')),
  decidido_em        timestamptz,
  decidido_por       uuid references pessoas (id),
  decisao_nota       text check (length(btrim(decisao_nota)) between 3 and 300),
  lembrar_em         date,
  exportacao_id      uuid references exportacoes (id),
  textos_apagados_em timestamptz,
  criado_em          timestamptz not null default app_now(),
  criado_por         uuid references pessoas (id),
  alterado_em        timestamptz,
  alterado_por       uuid references pessoas (id),
  versao             integer not null default 1,
  check ((retencao_em is null) = (retencao_por is null)),
  check (textos_apagados_em is not null or ((retencao is null) = (retencao_em is null))),
  check (textos_apagados_em is not null or pedido_por is not null),
  check (situacao <> 'EM_RETENCAO' or retencao_em is not null),
  check ((situacao in ('FICOU', 'CONFIRMADO')) = (decidido_em is not null and decidido_por is not null)),
  check (situacao <> 'CONFIRMADO' or motivo is not null),
  check (motivo is distinct from 'OUTRO' or motivo_texto is not null or textos_apagados_em is not null),
  check (motivo_texto is null or motivo = 'OUTRO'),
  check (lembrar_em is null or (situacao = 'CONFIRMADO' and lembrar_em > ultimo_dia)),
  check (exportacao_id is null or situacao = 'CONFIRMADO'),
  check (ultimo_dia = (pedido_em at time zone 'America/Sao_Paulo')::date + aviso_dias)
);
create unique index cancelamentos_cliente_um_aberto on cancelamentos_cliente (interessado_id) where situacao <> 'FICOU';
call proteger_tabela_comercial('cancelamentos_cliente', 'console.comercial.editar',
  'Pedido de cancelamento do cliente, a tentativa de retenção e a decisão (CM-31, N.1); confirmar é da Administração');
create trigger cancelamentos_cliente_sem_exclusao before delete on cancelamentos_cliente for each row execute function somente_insercao();

-- A ordem: pedido, uma tentativa de retenção, e a decisão (ficou ou confirmado), que não volta.
create function cancelamentos_cliente_regras() returns trigger
language plpgsql
set search_path = public
as $$
declare v_fixos text[] := array['id', 'interessado_id', 'condominio_id', 'pedido_em', 'aviso_dias', 'ultimo_dia', 'criado_em', 'criado_por'];
begin
  if (select jsonb_object_agg(k, to_jsonb(new) -> k) from unnest(v_fixos) k) is distinct from (select jsonb_object_agg(k, to_jsonb(old) -> k) from unnest(v_fixos) k) then
    raise exception 'O pedido de cancelamento não troca de cliente nem de data' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  -- Os textos apagados (LGPD) só saem.
  if new.textos_apagados_em is not null and old.textos_apagados_em is null then
    if num_nonnulls(new.pedido_por, new.retencao, new.decisao_nota, new.motivo_texto) > 0 then
      raise exception 'Os textos apagados saem todos' using errcode = 'TC422';
    end if;
    return new;
  end if;
  if old.situacao in ('FICOU', 'CONFIRMADO') and (to_jsonb(new) - 'versao') is distinct from (to_jsonb(old) - 'versao') then
    raise exception 'O cancelamento decidido não muda' using errcode = 'TC422', detail = '{"motivo":"CANCELAMENTO_DECIDIDO"}';
  end if;
  if old.retencao_em is not null and (new.retencao, new.retencao_em, new.retencao_por) is distinct from (old.retencao, old.retencao_em, old.retencao_por) then
    raise exception 'A tentativa de retenção registrada não muda' using errcode = 'TC422', detail = '{"motivo":"RETENCAO_REGISTRADA"}';
  end if;
  return new;
end $$;
create trigger cancelamentos_cliente_regras before update on cancelamentos_cliente for each row execute function cancelamentos_cliente_regras();

-- O último dia do contrato no condomínio (decisão g): a Plataforma lê para fechar o que não é consulta.
create table encerramentos_contrato (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null unique references condominios (id) on delete restrict,
  cancelamento_id uuid not null unique references cancelamentos_cliente (id),
  ultimo_dia      date not null,
  confirmado_em   timestamptz not null default app_now()
);
call proteger_tabela_condominio('encerramentos_contrato');
create trigger encerramentos_contrato_sem_mudanca before update or delete on encerramentos_contrato for each row execute function somente_insercao();

-- ---------------------------------------------------------------------------------------
-- 6. Expansão (CM-32, decisão k): funil próprio ligado ao cliente.

create table expansoes_cliente (
  id                 uuid primary key default gen_random_uuid(),
  interessado_id     uuid not null references interessados (id),
  tipo               text not null check (tipo in ('MAIS_UM_PREDIO', 'MUDAR_FAIXA', 'RECONQUISTA')),
  etapa              text not null default 'ABERTA' check (etapa in ('ABERTA', 'EM_CONVERSA', 'PROPOSTA', 'GANHA', 'PERDIDA')),
  motivo             text not null check (length(btrim(motivo)) between 3 and 300),
  responsavel_id     uuid not null references pessoas (id),
  proximo_passo      text check (length(btrim(proximo_passo)) between 3 and 200),
  proximo_passo_data date,
  oportunidade_id    uuid references interessados (id),
  resultado          text check (length(btrim(resultado)) between 3 and 300),
  encerrada_em       timestamptz,
  encerrada_por      uuid references pessoas (id),
  criado_em          timestamptz not null default app_now(),
  criado_por         uuid references pessoas (id),
  alterado_em        timestamptz,
  alterado_por       uuid references pessoas (id),
  versao             integer not null default 1,
  check ((etapa in ('GANHA', 'PERDIDA')) = (encerrada_em is not null)),
  check (etapa in ('GANHA', 'PERDIDA') or proximo_passo is not null),
  check (etapa <> 'PERDIDA' or resultado is not null),
  check ((tipo = 'MAIS_UM_PREDIO') = (oportunidade_id is not null))
);
create unique index expansoes_cliente_uma_aberta on expansoes_cliente (interessado_id, tipo)
  where etapa not in ('GANHA', 'PERDIDA') and tipo <> 'MAIS_UM_PREDIO';
create index expansoes_cliente_interessado on expansoes_cliente (interessado_id);
call proteger_tabela_comercial('expansoes_cliente', 'console.comercial.editar',
  'Funil de expansão dos clientes: mais um prédio, mudar de faixa e reconquista (CM-32)');
create trigger expansoes_cliente_sem_exclusao before delete on expansoes_cliente for each row execute function somente_insercao();
create function expansoes_cliente_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.interessado_id, new.tipo, new.oportunidade_id, new.criado_em, new.criado_por)
     is distinct from (old.id, old.interessado_id, old.tipo, old.oportunidade_id, old.criado_em, old.criado_por) then
    raise exception 'A expansão não troca de cliente nem de tipo' using errcode = 'TC422', detail = '{"motivo":"SO_INSERCAO"}';
  end if;
  -- Encerrada não reabre; só a anonimização (LGPD) mexe nela.
  if old.encerrada_em is not null and not comercial_sistema() then
    raise exception 'A expansão encerrada não muda' using errcode = 'TC422', detail = '{"motivo":"EXPANSAO_ENCERRADA"}';
  end if;
  return new;
end $$;
create trigger expansoes_cliente_regras before update on expansoes_cliente for each row execute function expansoes_cliente_regras();

-- ---------------------------------------------------------------------------------------
-- 7. Leituras do cliente (CM-11): o plano e as unidades ativas, entrando no condomínio só para ler.

-- O cliente do Comercial: virou cliente, tem condomínio e não foi apagado.
create function comercial_buscar_cliente(p_id uuid, p_travar boolean default false) returns interessados
language plpgsql
set search_path = public
as $$
declare i interessados;
begin
  if p_travar then
    select * into i from interessados where id = p_id for update;
  else
    select * into i from interessados where id = p_id;
  end if;
  if not found or i.virou_cliente_em is null or i.condominio_id is null or i.anonimizado_em is not null then
    raise exception 'Cliente não encontrado' using errcode = 'TC404';
  end if;
  return i;
end $$;

-- O plano (nome, valor, ciclo, tabela, faixa, início e vencimento) e quantas unidades estão ativas.
-- Entra no condomínio como sistema (entrar_como_sistema) e volta à pessoa de quem chamou (o
-- Console não tem condomínio no contexto), como a 0308.
create function comercial_leitura_cliente(p_cond uuid) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_pessoa uuid := nullif(current_setting('app.pessoa_id', true), '')::uuid;
  pl planos_cliente;
  v_unidades integer;
begin
  perform entrar_como_sistema(p_cond);
  select * into pl from planos_cliente where condominio_id = p_cond;
  select count(*)::integer into v_unidades from unidades where condominio_id = p_cond and ativa;
  if v_pessoa is not null then perform definir_pessoa(v_pessoa); else perform entrar_como_sistema(null); end if;
  return jsonb_build_object(
    'plano', case when pl.id is not null then jsonb_strip_nulls(jsonb_build_object(
      'nome', pl.nome, 'valor', pl.valor_centavos, 'ciclo', pl.ciclo, 'tabela', coalesce(pl.tabela_origem, 'MANUAL'),
      'unidadesDe', pl.unidades_de, 'unidadesAte', pl.unidades_ate, 'inicio', pl.inicio_competencia, 'diaVencimento', pl.dia_vencimento)) end,
    'unidadesAtivas', v_unidades);
end $$;

-- Todos os clientes com o contrato assinado e a leitura (uma entrada no condomínio por cliente).
create function comercial_clientes_lidos()
returns table (cli_id uuid, cond_id uuid, nome text, contato text, resp_id uuid, contrato integer, inicio date, plano jsonb, unidades integer,
               canc_id uuid, canc_situacao text, ultimo_dia date)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v jsonb;
begin
  for r in
    select i.id, i.condominio_id, i.condominio, i.nome_contato, i.responsavel_id, c.numero, (c.dados ->> 'dataInicio')::date as ini,
           k.id as kid, k.situacao as ksit, k.ultimo_dia as kdia
      from interessados i
      left join contratos_comercial c on c.interessado_id = i.id and c.situacao = 'ASSINADO'
      left join cancelamentos_cliente k on k.interessado_id = i.id and k.situacao <> 'FICOU'
     where i.virou_cliente_em is not null and i.condominio_id is not null and i.anonimizado_em is null
     order by i.condominio, i.id
  loop
    v := comercial_leitura_cliente(r.condominio_id);
    cli_id := r.id; cond_id := r.condominio_id; nome := r.condominio; contato := r.nome_contato; resp_id := r.responsavel_id;
    contrato := r.numero; inicio := r.ini; plano := v -> 'plano'; unidades := (v ->> 'unidadesAtivas')::integer;
    canc_id := r.kid; canc_situacao := r.ksit; ultimo_dia := r.kdia;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- 8. As contas da renovação.

-- O aniversário da vez (decisão a).
create function comercial_proximo_aniversario(p_interessado uuid, p_inicio date, p_hoje date, p_atraso integer) returns date
language sql stable
set search_path = public
as $$
  select min(s.a) from (select (p_inicio + make_interval(years => n))::date as a from generate_series(1, 60) n) s
   where p_inicio is not null and s.a >= p_hoje - p_atraso
     and not exists (select 1 from renovacoes_cliente rc where rc.interessado_id = p_interessado and rc.aniversario = s.a)
$$;

create function comercial_tipo_renovacao(p_plano jsonb) returns text
language sql immutable
set search_path = public
as $$ select case when p_plano ->> 'tabela' = 'FUNDADOR' then 'FIM_FUNDADOR' else 'REAJUSTE' end $$;

-- O valor com reajuste (decisão c); nulo quando não dá para calcular.
create function comercial_valor_renovacao(p_plano jsonb, r regra_reajuste) returns bigint
language sql stable
set search_path = public
as $$
  select case
    when p_plano is null or jsonb_typeof(p_plano) <> 'object' or p_plano ->> 'valor' is null then null
    when p_plano ->> 'tabela' = 'FUNDADOR' then
      (select f.cheia_centavos from faixas_preco f
        where not f.sob_consulta and (p_plano ->> 'unidadesAte')::integer between f.unidades_de and f.unidades_ate)::bigint
    when r.percentual is null then null
    else round((p_plano ->> 'valor')::bigint * (100 + r.percentual) / 100)::bigint end
$$;

-- A primeira competência cujo vencimento cai na data ou depois (decisão d).
create function comercial_competencia_desde(p_data date, p_dia integer) returns date
language sql immutable
set search_path = public
as $$
  select case when date_trunc('month', p_data)::date + (coalesce(p_dia, 10) - 1) >= p_data then date_trunc('month', p_data)::date
              else (date_trunc('month', p_data) + interval '1 month')::date end
$$;

create function comercial_regra_reajuste_json(r regra_reajuste) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'indice', r.indice, 'percentual', r.percentual, 'referencia', r.referencia, 'prazoAvisoDias', r.prazo_aviso_dias,
    'definida', r.percentual is not null, 'versao', r.versao, 'alteradoEm', r.alterado_em, 'alteradoPor', comercial_pessoa_json(r.alterado_por)))
$$;

create function comercial_aditivo_json(a aditivos_comercial) returns jsonb
language sql stable
set search_path = public
as $$
  select case when a.id is not null then jsonb_build_object('id', a.id, 'numero', a.numero, 'situacao', a.situacao, 'hash', a.hash) end
$$;

-- A renovação registrada na lista e nas respostas.
create function comercial_renovacao_json(rc renovacoes_cliente, p_condominio text, p_contrato integer) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', rc.id, 'versao', rc.versao, 'interessadoId', rc.interessado_id, 'condominio', p_condominio, 'contrato', p_contrato,
    'aniversario', rc.aniversario, 'avisarAte', rc.avisar_ate, 'tipo', rc.tipo, 'situacao', rc.situacao,
    'hoje', jsonb_build_object('valor', rc.valor_atual, 'ciclo', rc.ciclo, 'tabela', case when rc.tipo = 'FIM_FUNDADOR' then 'FUNDADOR' end),
    'novo', case when rc.valor_novo is not null then jsonb_strip_nulls(jsonb_build_object(
      'valor', rc.valor_novo, 'indice', rc.indice, 'percentual', rc.percentual, 'referencia', rc.referencia,
      'tabela', case when rc.tipo = 'FIM_FUNDADOR' then 'CHEIA' end)) end,
    'aviso', case when rc.aviso_em is not null then jsonb_strip_nulls(jsonb_build_object(
      'em', rc.aviso_em, 'canal', rc.aviso_canal, 'para', rc.aviso_para, 'texto', rc.aviso_texto)) end,
    'valeDesde', rc.vale_desde, 'dispensaMotivo', rc.dispensa_motivo, 'aplicadoEm', rc.aplicado_em,
    'registradoEm', rc.registrado_em, 'registradoPor', comercial_pessoa_json(rc.registrado_por),
    'aditivo', (select comercial_aditivo_json(a) from aditivos_comercial a where a.renovacao_id = rc.id)))
$$;

-- O retrato do aditivo e o registro (o PDF vem da API, por comercial_aditivo_pronto).
create function comercial_criar_aditivo(rc renovacoes_cliente, m modelos_aditivo, c contratos_comercial, i interessados) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_numero integer;
  v_campos jsonb;
  v_texto text := m.texto;
  v_dados jsonb;
  v_caminho text;
  v_por text := case rc.ciclo when 'ANUAL' then ' por ano' else ' por mês' end;
  k text;
begin
  select coalesce(max(numero), 0) + 1 into v_numero from aditivos_comercial where interessado_id = i.id;
  v_campos := jsonb_build_object(
    'condominio', coalesce(c.dados -> 'campos' ->> 'condominio', i.condominio),
    'contrato', 'nº ' || c.numero,
    'data_contrato', comercial_data_br((c.dados ->> 'dataInicio')::date),
    'aniversario', comercial_data_br(rc.aniversario),
    'valor_atual', comercial_reais(rc.valor_atual) || v_por,
    'valor_novo', comercial_reais(rc.valor_novo) || v_por,
    'motivo_reajuste', case rc.tipo when 'FIM_FUNDADOR' then 'fim do preço de fundador (12 meses), pela tabela cheia do dia do aviso'
                                     else 'reajuste anual pelo ' || rc.indice || ' de ' || replace(trim_scale(rc.percentual)::text, '.', ',') || '%'
                                          || coalesce(' (' || rc.referencia || ')', '') end,
    'vale_desde', 'competência de ' || to_char(rc.vale_desde, 'MM/YYYY'),
    'aviso_em', comercial_data_br(rc.aviso_em));
  for k in select jsonb_object_keys(v_campos) loop
    v_texto := replace(v_texto, '«' || k || '»', v_campos ->> k);
  end loop;
  v_dados := jsonb_build_object(
    'numero', v_numero, 'titulo', m.titulo, 'texto', v_texto, 'campos', v_campos,
    'modelo', jsonb_build_object('numero', m.numero),
    'contrato', jsonb_build_object('numero', c.numero, 'hash', c.hash),
    'geradoEm', to_char(app_now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'));
  v_caminho := comercial_caminho(i.id, v_id);
  insert into aditivos_comercial (id, renovacao_id, interessado_id, numero, modelo_id, dados, hash, caminho, gerado_por)
  values (v_id, rc.id, i.id, v_numero, m.id, v_dados, comercial_hash(v_dados), v_caminho, contexto_pessoa());
  return jsonb_build_object('aditivoId', v_id, 'caminho', v_caminho, 'hash', comercial_hash(v_dados), 'dados', v_dados);
end $$;

-- ---------------------------------------------------------------------------------------
-- 9. A tela de Renovações (quadro 346): as quatro abas numa leitura.

create function comercial_cancelamento_json(k cancelamentos_cliente, p_condominio text, p_plano jsonb) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', k.id, 'versao', k.versao, 'interessadoId', k.interessado_id, 'condominio', p_condominio,
    'plano', case when p_plano is not null and jsonb_typeof(p_plano) = 'object'
                  then jsonb_build_object('valor', p_plano -> 'valor', 'ciclo', p_plano -> 'ciclo', 'inicio', p_plano -> 'inicio', 'tabela', p_plano -> 'tabela') end,
    'pedidoPor', k.pedido_por, 'pedidoEm', k.pedido_em, 'avisoDias', k.aviso_dias, 'ultimoDia', k.ultimo_dia,
    'motivo', k.motivo, 'motivoTexto', k.motivo_texto,
    'retencao', k.retencao, 'retencaoEm', k.retencao_em, 'retencaoPor', comercial_pessoa_json(k.retencao_por),
    'situacao', case when k.situacao = 'CONFIRMADO' and k.ultimo_dia < comercial_hoje() then 'ENCERRADO' else k.situacao end,
    'decididoEm', k.decidido_em, 'decididoPor', comercial_pessoa_json(k.decidido_por), 'decisaoNota', k.decisao_nota,
    'lembrarEm', k.lembrar_em, 'exportacaoPedida', k.exportacao_id is not null))
$$;

create function comercial_expansao_json(e expansoes_cliente, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'versao', e.versao, 'interessadoId', e.interessado_id,
    'nome', case when e.tipo = 'MAIS_UM_PREDIO' then coalesce(i.nome_contato, i.condominio) else i.condominio end,
    'condominio', i.condominio, 'tipo', e.tipo, 'etapa', e.etapa, 'motivo', e.motivo,
    'responsavel', comercial_pessoa_json(e.responsavel_id), 'proximoPasso', e.proximo_passo, 'proximoPassoData', e.proximo_passo_data,
    'oportunidade', (select jsonb_build_object('id', o.id, 'condominio', o.condominio, 'etapa', o.etapa) from interessados o where o.id = e.oportunidade_id),
    'resultado', e.resultado, 'encerradaEm', e.encerrada_em, 'criadoEm', e.criado_em))
$$;

create function comercial_renovacoes(p_pessoa uuid, p_mes date default null) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := comercial_hoje();
  v_mes date := date_trunc('month', coalesce(p_mes, comercial_hoje()))::date;
  v_ate date;
  v_atraso integer := configuracao_int('comercial_renovacao_atraso_dias');
  r regra_reajuste;
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  v_ate := v_mes + configuracao_int('comercial_renovacao_horizonte_dias');
  select * into r from regra_reajuste;
  with cl as materialized (select * from comercial_clientes_lidos()),
  pend as materialized (
    select cl.*, comercial_proximo_aniversario(cl.cli_id, cl.inicio, v_hoje, v_atraso) as aniversario
      from cl where cl.inicio is not null and cl.canc_situacao is distinct from 'CONFIRMADO'
  ),
  ren as (
    select jsonb_strip_nulls(jsonb_build_object(
             'interessadoId', p.cli_id, 'condominio', p.nome, 'contrato', p.contrato, 'aniversario', p.aniversario,
             'avisarAte', p.aniversario - r.prazo_aviso_dias, 'tipo', comercial_tipo_renovacao(p.plano),
             'situacao', case when p.aniversario - r.prazo_aviso_dias < v_hoje then 'ATRASADO' else 'AVISAR' end,
             'hoje', case when p.plano is not null and jsonb_typeof(p.plano) = 'object'
                          then jsonb_build_object('valor', p.plano -> 'valor', 'ciclo', p.plano -> 'ciclo', 'tabela', p.plano -> 'tabela') end,
             'novo', case when comercial_valor_renovacao(p.plano, r) is not null then jsonb_strip_nulls(jsonb_build_object(
                            'valor', comercial_valor_renovacao(p.plano, r),
                            'indice', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.indice end,
                            'percentual', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.percentual end,
                            'referencia', case when comercial_tipo_renovacao(p.plano) = 'REAJUSTE' then r.referencia end,
                            'tabela', case when comercial_tipo_renovacao(p.plano) = 'FIM_FUNDADOR' then 'CHEIA' end)) end,
             'semPlano', p.plano is null or jsonb_typeof(p.plano) <> 'object')) as j,
           case when p.aniversario - r.prazo_aviso_dias < v_hoje then 1 else 2 end as ordem, p.aniversario as quando, p.nome as cond
      from pend p
     where p.aniversario is not null and (p.aniversario - r.prazo_aviso_dias < v_hoje or p.aniversario between v_mes and v_ate)
    union all
    select comercial_renovacao_json(rc, cl.nome, cl.contrato), case rc.situacao when 'AVISO_ENVIADO' then 3 else 4 end, rc.aniversario, cl.nome
      from renovacoes_cliente rc join cl on cl.cli_id = rc.interessado_id
     where rc.situacao = 'AVISO_ENVIADO' or rc.aniversario between v_mes and v_ate
  ),
  ris as (
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome,
             'plano', case when jsonb_typeof(cl.plano) = 'object' then cl.plano ->> 'nome' end,
             'sinais', jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s.id, 'versao', s.versao, 'tipo', s.tipo, 'origem', s.origem,
                                                                      'data', s.data_ref, 'detalhe', s.detalhe, 'criadoEm', s.criado_em))
                                 order by s.data_ref, s.tipo)) as j,
           min(s.data_ref) as quando, cl.nome as cond
      from riscos_cliente s join cl on cl.cli_id = s.interessado_id
     where s.tratado_em is null and cl.canc_situacao is distinct from 'CONFIRMADO'
     group by cl.cli_id, cl.nome, cl.plano
  ),
  expa as (
    select comercial_expansao_json(e, i) as j, e.etapa in ('GANHA', 'PERDIDA') as fechada, coalesce(e.encerrada_em, e.criado_em) as quando
      from expansoes_cliente e join interessados i on i.id = e.interessado_id
     where e.etapa not in ('GANHA', 'PERDIDA') or e.encerrada_em > app_now() - interval '180 days'
  ),
  sug as (
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome, 'tipo', 'MUDAR_FAIXA',
                              'motivo', 'Passou de ' || (cl.plano ->> 'unidadesAte') || ' unidades ativas') as j, cl.nome as cond
      from cl
     where cl.canc_situacao is distinct from 'CONFIRMADO' and jsonb_typeof(cl.plano) = 'object'
       and (cl.plano ->> 'unidadesAte')::integer < cl.unidades
       and not exists (select 1 from expansoes_cliente e where e.interessado_id = cl.cli_id and e.tipo = 'MUDAR_FAIXA' and e.etapa not in ('GANHA', 'PERDIDA'))
    union all
    select jsonb_build_object('interessadoId', cl.cli_id, 'condominio', cl.nome, 'tipo', 'RECONQUISTA',
                              'motivo', 'Saiu em ' || to_char(cl.ultimo_dia, 'MM/YYYY')
                                        || coalesce('; síndico novo em ' || to_char(sn.data_ref, 'MM/YYYY'), '; lembrar em ' || to_char(k.lembrar_em, 'DD/MM/YYYY'))),
           cl.nome
      from cl join cancelamentos_cliente k on k.id = cl.canc_id
      left join lateral (select s.data_ref from riscos_cliente s
                          where s.interessado_id = cl.cli_id and s.tipo = 'SINDICO_NOVO' and s.tratado_em is null and s.criado_em > k.decidido_em
                          order by s.data_ref desc limit 1) sn on true
     where cl.canc_situacao = 'CONFIRMADO' and cl.ultimo_dia < v_hoje
       and (sn.data_ref is not null or k.lembrar_em <= v_hoje + 30)
       and not exists (select 1 from expansoes_cliente e where e.interessado_id = cl.cli_id and e.tipo = 'RECONQUISTA' and e.etapa not in ('GANHA', 'PERDIDA'))
  ),
  can as (
    select comercial_cancelamento_json(k, cl.nome, cl.plano) as j, k.situacao in ('PEDIDO', 'EM_RETENCAO') as aberto, k.pedido_em as quando
      from cancelamentos_cliente k join cl on cl.cli_id = k.interessado_id
     where k.situacao in ('PEDIDO', 'EM_RETENCAO')
        or (k.situacao = 'CONFIRMADO' and k.ultimo_dia > v_hoje - 365)
        or (k.situacao = 'FICOU' and k.decidido_em > app_now() - interval '90 days')
  )
  select jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'), 'hoje', v_hoje,
    'regra', comercial_regra_reajuste_json(r),
    'modeloAditivo', (select jsonb_build_object('id', m.id, 'numero', m.numero, 'titulo', m.titulo) from modelos_aditivo m where m.situacao = 'EM_USO'),
    'renovacoes', coalesce((select jsonb_agg(j order by ordem, quando, cond) from ren), '[]'::jsonb),
    'riscos', coalesce((select jsonb_agg(j order by quando, cond) from ris), '[]'::jsonb),
    'expansoes', coalesce((select jsonb_agg(j order by fechada, quando desc) from expa), '[]'::jsonb),
    'sugestoes', coalesce((select jsonb_agg(j order by cond) from sug), '[]'::jsonb),
    'cancelamentos', coalesce((select jsonb_agg(j order by aberto desc, quando desc) from can), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'id', cl.cli_id, 'condominio', cl.nome, 'contato', cl.contato,
                   'plano', case when jsonb_typeof(cl.plano) = 'object' then cl.plano end,
                   'situacao', case when cl.canc_situacao = 'CONFIRMADO' and cl.ultimo_dia < v_hoje then 'ENCERRADO'
                                    when cl.canc_situacao is not null then 'CANCELANDO' else 'ATIVO' end)) order by cl.nome) from cl), '[]'::jsonb),
    'equipe', comercial_equipe_json(),
    'contagens', jsonb_build_object(
      'renovacoes', (select count(*)::integer from ren),
      'riscos', (select count(*)::integer from ris),
      'expansoes', (select count(*)::integer from expa where not fechada) + (select count(*)::integer from sug),
      'cancelamentos', (select count(*)::integer from can where aberto)),
    'avisoCancelamentoDias', configuracao_int('comercial_cancelamento_aviso_dias'),
    'pode', jsonb_build_object('editar', pode_global('console.comercial.editar'), 'regra', pode_global('console.comercial.modelos'),
                               'confirmar', pode_global('console.comercial.cliente')))
  into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 10. A regra, o aviso, a dispensa e o aditivo (CM-30).

create function comercial_salvar_regra_reajuste(p_pessoa uuid, p_versao integer, p_indice text, p_percentual numeric, p_referencia text,
                                                p_prazo_aviso_dias integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_indice text := nullif(btrim(p_indice), '');
  v_ref text := nullif(btrim(p_referencia), '');
  r regra_reajuste;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if v_indice is not null and length(v_indice) not between 2 and 60 then perform recusar_campos('Diga o índice (por exemplo, IPCA)', 'indice'); end if;
  if (v_indice is null) <> (p_percentual is null) then perform recusar_campos('O índice e o percentual vêm juntos', 'indice', 'percentual'); end if;
  if p_percentual is not null and (p_percentual not between -20 and 50 or p_percentual <> round(p_percentual, 2)) then
    perform recusar_campos('O percentual vai de -20% a 50%, com até duas casas', 'percentual');
  end if;
  if v_ref is not null and (length(v_ref) not between 3 and 120 or v_indice is null) then
    perform recusar_campos('A referência vai de 3 a 120 letras, com o índice', 'referencia');
  end if;
  if p_prazo_aviso_dias is null or p_prazo_aviso_dias not between 30 and 120 then
    perform recusar_campos('O prazo do aviso vai de 30 a 120 dias', 'prazoAvisoDias');
  end if;
  update regra_reajuste set indice = v_indice, percentual = p_percentual, referencia = v_ref, prazo_aviso_dias = p_prazo_aviso_dias,
         alterado_em = app_now(), alterado_por = p_pessoa
   where versao = p_versao
  returning * into r;
  if r.id is null then
    select * into r from regra_reajuste;
    raise exception 'Outra pessoa alterou a regra' using errcode = 'TC409',
      detail = jsonb_build_object('versao', r.versao, 'atual', comercial_regra_reajuste_json(r))::text;
  end if;
  perform registrar_historico_interno('comercial.regra_reajuste', 'regra_reajuste', 'regra',
    jsonb_strip_nulls(jsonb_build_object('indice', v_indice, 'percentual', trim_scale(p_percentual), 'prazoAvisoDias', p_prazo_aviso_dias)));
  return comercial_regra_reajuste_json(r);
end $$;

-- O cliente que confirmou o cancelamento não tem mais renovação.
create function comercial_exigir_sem_cancelamento(p_interessado uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from cancelamentos_cliente where interessado_id = p_interessado and situacao = 'CONFIRMADO') then
    perform recusar_motivo('Este cliente confirmou o cancelamento', 'CLIENTE_CANCELADO');
  end if;
end $$;

-- O aniversário pedido tem de ser o da vez; devolve o contrato assinado.
create function comercial_contrato_da_renovacao(i interessados, p_aniversario date) returns contratos_comercial
language plpgsql
set search_path = public
as $$
declare c contratos_comercial;
begin
  select * into c from contratos_comercial where interessado_id = i.id and situacao = 'ASSINADO' order by gerado_em desc limit 1;
  if c.id is null or c.dados ->> 'dataInicio' is null then
    perform recusar_motivo('O cliente não tem contrato assinado com data de início', 'SEM_CONTRATO_ASSINADO');
  end if;
  if exists (select 1 from renovacoes_cliente where interessado_id = i.id and aniversario = p_aniversario) then
    perform recusar_motivo('O aviso deste aniversário já foi registrado', 'RENOVACAO_REGISTRADA');
  end if;
  if p_aniversario is null or p_aniversario is distinct from
     comercial_proximo_aniversario(i.id, (c.dados ->> 'dataInicio')::date, comercial_hoje(), configuracao_int('comercial_renovacao_atraso_dias')) then
    perform recusar_campos('Este não é o aniversário da vez do contrato', 'aniversario');
  end if;
  return c;
end $$;

-- Registrar o aviso enviado ao síndico (decisão 4): o valor novo, desde quando, e o aditivo.
create function comercial_registrar_aviso(p_pessoa uuid, p_interessado uuid, p_aniversario date, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  c contratos_comercial;
  r regra_reajuste;
  m modelos_aditivo;
  rc renovacoes_cliente;
  f faixas_preco;
  v_hoje date := comercial_hoje();
  v_plano jsonb;
  v_tipo text;
  v_novo bigint;
  v_aviso date := coalesce(comercial_data(p_dados, 'avisoEm'), case when coalesce(p_dados ->> 'avisoEm', '') = '' then comercial_hoje() end);
  v_canal text := comercial_texto(p_dados, 'canal');
  v_para text := comercial_texto(p_dados, 'para');
  v_texto text := comercial_texto(p_dados, 'texto');
  v_sistema text;
  v_vale date;
  v_aditivo jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar_cliente(p_interessado, true);
  perform comercial_exigir_sem_cancelamento(i.id);
  c := comercial_contrato_da_renovacao(i, p_aniversario);
  select * into r from regra_reajuste;
  v_plano := comercial_leitura_cliente(i.condominio_id) -> 'plano';
  if v_plano is null or jsonb_typeof(v_plano) <> 'object' then perform recusar_motivo('O cliente ainda não tem plano', 'SEM_PLANO'); end if;
  v_tipo := comercial_tipo_renovacao(v_plano);
  v_novo := comercial_valor_renovacao(v_plano, r);
  if v_novo is null then
    perform recusar_motivo('O valor com reajuste ainda não está definido', 'REAJUSTE_A_DEFINIR');
  end if;
  if v_aviso is null or v_aviso > v_hoje or v_aviso < v_hoje - 30 then perform recusar_campos('O aviso foi enviado hoje ou nos últimos 30 dias', 'avisoEm'); end if;
  if v_canal is null or v_canal not in ('WHATSAPP', 'EMAIL', 'CARTA', 'PRESENCIAL', 'OUTRO') then perform recusar_campos('Diga por onde o aviso foi', 'canal'); end if;
  if coalesce(length(v_para), 0) not between 2 and 120 then perform recusar_campos('Diga quem recebeu o aviso', 'para'); end if;
  if coalesce(length(v_texto), 0) not between 10 and 2000 then perform recusar_campos('Cole o texto do aviso (de 10 a 2.000 letras)', 'texto'); end if;
  v_vale := comercial_competencia_desde(greatest(p_aniversario, v_aviso + r.prazo_aviso_dias), (v_plano ->> 'diaVencimento')::integer);
  insert into renovacoes_cliente (interessado_id, condominio_id, aniversario, tipo, situacao, valor_atual, valor_novo, ciclo, indice, percentual,
                                  referencia, avisar_ate, aviso_em, aviso_canal, aviso_para, aviso_texto, vale_desde, registrado_por)
  values (i.id, i.condominio_id, p_aniversario, v_tipo, 'AVISO_ENVIADO', (v_plano ->> 'valor')::bigint, v_novo, v_plano ->> 'ciclo',
          case when v_tipo = 'REAJUSTE' then r.indice end, case when v_tipo = 'REAJUSTE' then r.percentual end,
          case when v_tipo = 'REAJUSTE' then r.referencia end, p_aniversario - r.prazo_aviso_dias, v_aviso, v_canal, v_para, v_texto, v_vale, p_pessoa)
  returning * into rc;
  -- O plano muda quando a competência abrir (decisão d); no fundador, para a tabela cheia da faixa.
  if v_tipo = 'FIM_FUNDADOR' then
    select * into f from faixas_preco where not sob_consulta and (v_plano ->> 'unidadesAte')::integer between unidades_de and unidades_ate;
  end if;
  v_sistema := coalesce(current_setting('app.comercial_sistema', true), '');
  perform set_config('app.comercial_sistema', 'on', true);
  perform entrar_como_sistema(i.condominio_id);
  insert into reajustes_plano (condominio_id, renovacao_id, tipo, vale_desde, valor_centavos, tabela, nome)
  values (i.condominio_id, rc.id, v_tipo, v_vale, v_novo, case when v_tipo = 'FIM_FUNDADOR' then 'CHEIA' end,
          case when v_tipo = 'FIM_FUNDADOR' then left('Tabela cheia, ' || lower(f.nome), 60) end);
  perform definir_pessoa(p_pessoa);
  perform set_config('app.comercial_sistema', v_sistema, true);
  -- O aditivo, quando há modelo em uso (decisão 5).
  select * into m from modelos_aditivo where situacao = 'EM_USO';
  if m.id is not null then v_aditivo := comercial_criar_aditivo(rc, m, c, i); end if;
  perform comercial_inserir_conversa(i.id, 'NOTA',
    format('Aviso de reajuste registrado (aniversário %s): %s para %s a partir da competência %s.', comercial_data_br(p_aniversario),
           comercial_reais(rc.valor_atual), comercial_reais(v_novo), to_char(v_vale, 'MM/YYYY')), false, null, null);
  perform registrar_historico_interno('comercial.aviso_reajuste', 'renovacao_cliente', rc.id::text,
    jsonb_build_object('aniversario', p_aniversario, 'tipo', v_tipo, 'valor', rc.valor_atual, 'valorNovo', v_novo, 'valeDesde', v_vale,
                       'aditivo', v_aditivo is not null));
  return jsonb_build_object('renovacao', comercial_renovacao_json(rc, i.condominio, c.numero), 'aditivo', v_aditivo);
end $$;

-- Renovar sem reajuste (decisão a): o aniversário fica registrado com o motivo; o valor não muda.
create function comercial_dispensar_renovacao(p_pessoa uuid, p_interessado uuid, p_aniversario date, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  c contratos_comercial;
  r regra_reajuste;
  rc renovacoes_cliente;
  v_plano jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar_cliente(p_interessado, true);
  perform comercial_exigir_sem_cancelamento(i.id);
  c := comercial_contrato_da_renovacao(i, p_aniversario);
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then perform recusar_campos('Diga por que renova sem reajuste', 'motivo'); end if;
  select * into r from regra_reajuste;
  v_plano := comercial_leitura_cliente(i.condominio_id) -> 'plano';
  if v_plano is null or jsonb_typeof(v_plano) <> 'object' then perform recusar_motivo('O cliente ainda não tem plano', 'SEM_PLANO'); end if;
  insert into renovacoes_cliente (interessado_id, condominio_id, aniversario, tipo, situacao, valor_atual, ciclo, avisar_ate, dispensa_motivo, registrado_por)
  values (i.id, i.condominio_id, p_aniversario, comercial_tipo_renovacao(v_plano), 'DISPENSADO', (v_plano ->> 'valor')::bigint, v_plano ->> 'ciclo',
          p_aniversario - r.prazo_aviso_dias, btrim(p_motivo), p_pessoa)
  returning * into rc;
  perform registrar_historico_interno('comercial.renovacao_sem_reajuste', 'renovacao_cliente', rc.id::text, jsonb_build_object('aniversario', p_aniversario));
  return comercial_renovacao_json(rc, i.condominio, c.numero);
end $$;

-- O aditivo que ficou montando (a API caiu no meio): o mesmo retrato, para montar de novo.
create function comercial_aditivo_para_montar(p_pessoa uuid, p_renovacao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a aditivos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into a from aditivos_comercial where renovacao_id = p_renovacao;
  if not found then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'GERANDO' then perform recusar_motivo('Este aditivo já foi montado', 'ADITIVO_PRONTO'); end if;
  return jsonb_build_object('aditivoId', a.id, 'caminho', a.caminho, 'hash', a.hash, 'dados', a.dados);
end $$;

create function comercial_aditivo_pronto(p_pessoa uuid, p_aditivo uuid, p_sha256 text, p_tamanho bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a aditivos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into a from aditivos_comercial where id = p_aditivo for update;
  if not found then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'GERANDO' then perform recusar_motivo('Este aditivo já foi montado', 'ADITIVO_PRONTO'); end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' or p_tamanho is null or p_tamanho not between 1 and 10485760 then
    perform recusar_campos('O PDF montado precisa do resumo e do tamanho', 'sha256', 'tamanho');
  end if;
  update aditivos_comercial set situacao = 'PRONTO', pdf_sha256 = p_sha256, pdf_tamanho = p_tamanho, pronto_em = app_now() where id = a.id
  returning * into a;
  return comercial_aditivo_json(a);
end $$;

create function comercial_abrir_aditivo(p_pessoa uuid, p_renovacao uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a aditivos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  select * into a from aditivos_comercial where renovacao_id = p_renovacao;
  if not found then raise exception 'Aditivo não encontrado' using errcode = 'TC404'; end if;
  if a.situacao <> 'PRONTO' then perform recusar_motivo('O aditivo ainda está sendo montado', 'ADITIVO_GERANDO'); end if;
  perform registrar_historico_interno('comercial.aditivo_aberto', 'aditivo_comercial', a.id::text, jsonb_build_object('numero', a.numero));
  return jsonb_build_object('caminho', a.caminho, 'nome', format('aditivo-%s.pdf', a.numero), 'tipo', 'application/pdf');
end $$;

-- Modelos › Contrato: o modelo de aditivo.
create function modelo_aditivo_json(m modelos_aditivo) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'versao', m.versao, 'numero', m.numero, 'titulo', m.titulo, 'texto', m.texto, 'situacao', m.situacao,
    'emUsoEm', m.em_uso_em, 'emUsoPor', comercial_pessoa_json(m.em_uso_por), 'substituidaEm', m.substituida_em,
    'criadoEm', m.criado_em, 'criadoPor', comercial_pessoa_json(m.criado_por),
    'aditivos', (select count(*) from aditivos_comercial a where a.modelo_id = m.id)))
$$;

create function comercial_modelos_aditivo(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'versoes', coalesce((select jsonb_agg(modelo_aditivo_json(m) order by m.numero desc) from modelos_aditivo m), '[]'::jsonb),
    'emUso', (select modelo_aditivo_json(m) from modelos_aditivo m where m.situacao = 'EM_USO'),
    'campos', to_jsonb(aditivo_campos()),
    'regra', (select comercial_regra_reajuste_json(r) from regra_reajuste r),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

create function comercial_salvar_modelo_aditivo(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m modelos_aditivo;
  v_titulo text := comercial_texto(p_dados, 'titulo');
  v_texto text := comercial_texto(p_dados, 'texto');
  v_errados text[];
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Diga o título do aditivo', 'titulo'); end if;
  if coalesce(length(v_texto), 0) not between 50 and 20000 then perform recusar_campos('Cole o texto do aditivo (de 50 a 20 mil letras)', 'texto'); end if;
  v_errados := aditivo_campos_errados(v_texto);
  if cardinality(v_errados) > 0 then
    raise exception 'Campo escrito errado ou que não existe' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'CAMPO_ERRADO', 'campos', jsonb_build_array('texto'), 'camposErrados', to_jsonb(v_errados))::text;
  end if;
  if p_id is null then
    insert into modelos_aditivo (numero, titulo, texto, criado_por)
    values ((select coalesce(max(numero), 0) + 1 from modelos_aditivo), v_titulo, v_texto, p_pessoa)
    returning * into m;
  else
    select * into m from modelos_aditivo where id = p_id for update;
    if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
    if m.situacao <> 'RASCUNHO' then perform recusar_motivo('A versão em uso não se edita; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
    if m.versao <> p_versao then perform conflito_versao('modelos_aditivo', p_id); end if;
    update modelos_aditivo set titulo = v_titulo, texto = v_texto, alterado_em = app_now(), alterado_por = p_pessoa where id = p_id
    returning * into m;
  end if;
  perform registrar_historico_interno('comercial.modelo_aditivo', 'modelo_aditivo', m.id::text, jsonb_build_object('numero', m.numero));
  return modelo_aditivo_json(m);
end $$;

create function comercial_usar_modelo_aditivo(p_pessoa uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m modelos_aditivo;
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  select * into m from modelos_aditivo where id = p_id for update;
  if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if m.versao <> p_versao then perform conflito_versao('modelos_aditivo', p_id); end if;
  if m.situacao = 'EM_USO' then return modelo_aditivo_json(m); end if;
  if m.situacao <> 'RASCUNHO' then perform recusar_motivo('Esta versão já foi substituída; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
  update modelos_aditivo set situacao = 'SUBSTITUIDA', substituida_em = app_now(), alterado_em = app_now(), alterado_por = p_pessoa where situacao = 'EM_USO';
  update modelos_aditivo set situacao = 'EM_USO', em_uso_em = app_now(), em_uso_por = p_pessoa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into m;
  perform registrar_historico_interno('comercial.modelo_aditivo_em_uso', 'modelo_aditivo', m.id::text, jsonb_build_object('numero', m.numero));
  return modelo_aditivo_json(m);
end $$;

-- ---------------------------------------------------------------------------------------
-- 11. Sinais de risco (CM-31).

-- A troca de síndico registrada no Console (0190) vira sinal para o Comercial (decisão j).
create function comercial_sinal_troca_sindico() returns trigger
language plpgsql
set search_path = public
as $$
declare v_sistema text := coalesce(current_setting('app.comercial_sistema', true), '');
begin
  perform set_config('app.comercial_sistema', 'on', true);
  insert into riscos_cliente (interessado_id, tipo, origem, data_ref, detalhe)
  select i.id, 'SINDICO_NOVO', 'TROCA_SINDICO', (new.feita_em at time zone 'America/Sao_Paulo')::date, 'Troca de síndico registrada no Console'
    from interessados i
   where i.condominio_id = new.condominio_id and i.virou_cliente_em is not null and i.anonimizado_em is null
  on conflict (interessado_id, tipo, data_ref) do nothing;
  perform set_config('app.comercial_sistema', v_sistema, true);
  return null;
end $$;
create trigger trocas_sindico_sinal_comercial after insert on trocas_sindico for each row execute function comercial_sinal_troca_sindico();

-- Marcar à mão: síndico novo eleito (com a data da eleição) ou troca de sistema na pauta (com a data
-- da assembleia). O síndico novo vale também para quem saiu (reconquista).
create function comercial_marcar_risco(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_tipo text := comercial_texto(p_dados, 'tipo');
  v_data date := comercial_data(p_dados, 'data');
  v_detalhe text := comercial_texto(p_dados, 'detalhe');
  v_hoje date := comercial_hoje();
  s riscos_cliente;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar_cliente(p_interessado);
  if v_tipo is null or v_tipo not in ('SINDICO_NOVO', 'TROCA_NA_PAUTA') then perform recusar_campos('Escolha o sinal', 'tipo'); end if;
  if v_tipo = 'SINDICO_NOVO' and (v_data is null or v_data not between v_hoje - 365 and v_hoje + 90) then
    perform recusar_campos('A data da eleição vai de um ano atrás a 90 dias à frente', 'data');
  end if;
  if v_tipo = 'TROCA_NA_PAUTA' and (v_data is null or v_data not between v_hoje - 30 and v_hoje + 365) then
    perform recusar_campos('A data da assembleia vai de 30 dias atrás a um ano à frente', 'data');
  end if;
  if v_detalhe is not null and length(v_detalhe) not between 3 and 200 then perform recusar_campos('O detalhe vai de 3 a 200 letras', 'detalhe'); end if;
  if v_tipo = 'TROCA_NA_PAUTA' and exists (select 1 from cancelamentos_cliente where interessado_id = i.id and situacao = 'CONFIRMADO') then
    perform recusar_motivo('Este cliente confirmou o cancelamento', 'CLIENTE_CANCELADO');
  end if;
  insert into riscos_cliente (interessado_id, tipo, origem, data_ref, detalhe, criado_por)
  values (i.id, v_tipo, 'A_MAO', v_data, v_detalhe, p_pessoa)
  on conflict (interessado_id, tipo, data_ref) do nothing
  returning * into s;
  if s.id is null then perform recusar_motivo('Este sinal já foi registrado', 'SINAL_REGISTRADO'); end if;
  perform registrar_historico_interno('comercial.sinal_risco', 'risco_cliente', s.id::text, jsonb_build_object('tipo', v_tipo, 'data', v_data));
  return jsonb_build_object('id', s.id, 'versao', s.versao, 'tipo', s.tipo, 'data', s.data_ref);
end $$;

-- "Já vi": o sinal sai da lista, com a nota de quem tratou.
create function comercial_tratar_risco(p_pessoa uuid, p_id uuid, p_versao integer, p_nota text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s riscos_cliente;
  v_nota text := nullif(btrim(p_nota), '');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into s from riscos_cliente where id = p_id for update;
  if not found then raise exception 'Sinal não encontrado' using errcode = 'TC404'; end if;
  if s.versao <> p_versao then perform conflito_versao('riscos_cliente', p_id); end if;
  if s.tratado_em is not null then perform recusar_motivo('Este sinal já foi tratado', 'SINAL_TRATADO'); end if;
  if v_nota is not null and length(v_nota) not between 3 and 300 then perform recusar_campos('A nota vai de 3 a 300 letras', 'nota'); end if;
  update riscos_cliente set tratado_em = app_now(), tratado_por = p_pessoa, tratado_nota = v_nota where id = p_id returning * into s;
  perform registrar_historico_interno('comercial.sinal_tratado', 'risco_cliente', s.id::text, jsonb_build_object('tipo', s.tipo));
  return jsonb_build_object('id', s.id, 'versao', s.versao, 'tratado', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- 12. Cancelamento e retenção (CM-31).

create function comercial_cancelamento_resposta(k cancelamentos_cliente) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object('id', k.id, 'versao', k.versao, 'situacao', k.situacao, 'ultimoDia', k.ultimo_dia,
                                              'exportacaoPedida', k.exportacao_id is not null))
$$;

-- O cancelamento travado depois do cliente (decisão m).
create function comercial_travar_cancelamento(p_id uuid, p_versao integer) returns cancelamentos_cliente
language plpgsql
set search_path = public
as $$
declare
  v_interessado uuid;
  k cancelamentos_cliente;
begin
  select interessado_id into v_interessado from cancelamentos_cliente where id = p_id;
  if v_interessado is null then raise exception 'Pedido de cancelamento não encontrado' using errcode = 'TC404'; end if;
  perform comercial_buscar_cliente(v_interessado, true);
  select * into k from cancelamentos_cliente where id = p_id for update;
  if k.versao <> p_versao then perform conflito_versao('cancelamentos_cliente', p_id); end if;
  if k.situacao in ('FICOU', 'CONFIRMADO') then perform recusar_motivo('Este pedido de cancelamento já foi decidido', 'CANCELAMENTO_DECIDIDO'); end if;
  return k;
end $$;

create function comercial_motivo_cancelamento(p_dados jsonb, p_atual text) returns text
language plpgsql
set search_path = public
as $$
declare v text := coalesce(comercial_texto(p_dados, 'motivo'), p_atual);
begin
  if v is null or v not in ('SINDICO_NOVO', 'PRECO', 'POUCO_USO', 'OUTRO_SISTEMA', 'ADMINISTRADORA', 'FECHOU', 'OUTRO') then
    perform recusar_campos('Escolha o motivo do cancelamento', 'motivo');
  end if;
  return v;
end $$;

-- O pedido: quem pediu e quando. O último dia sai da data do pedido mais o aviso (N.1).
create function comercial_pedir_cancelamento(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  k cancelamentos_cliente;
  v_por text := comercial_texto(p_dados, 'pedidoPor');
  v_em timestamptz;
  v_dias integer := configuracao_int('comercial_cancelamento_aviso_dias');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  begin
    v_em := coalesce(nullif(p_dados ->> 'pedidoEm', '')::timestamptz, app_now());
  exception when others then
    perform recusar_campos('Diga quando o síndico pediu', 'pedidoEm');
  end;
  i := comercial_buscar_cliente(p_interessado, true);
  if exists (select 1 from cancelamentos_cliente where interessado_id = i.id and situacao <> 'FICOU') then
    perform recusar_motivo('Este cliente já tem um pedido de cancelamento', 'CANCELAMENTO_ABERTO');
  end if;
  if coalesce(length(v_por), 0) not between 2 and 120 then perform recusar_campos('Diga quem pediu', 'pedidoPor'); end if;
  if v_em > app_now() + interval '5 minutes' or v_em < app_now() - interval '30 days' then
    perform recusar_campos('O pedido foi feito agora ou nos últimos 30 dias', 'pedidoEm');
  end if;
  insert into cancelamentos_cliente (interessado_id, condominio_id, pedido_por, pedido_em, aviso_dias, ultimo_dia, criado_por)
  values (i.id, i.condominio_id, v_por, v_em, v_dias, (v_em at time zone 'America/Sao_Paulo')::date + v_dias, p_pessoa)
  returning * into k;
  perform comercial_inserir_conversa(i.id, 'NOTA', 'Pedido de cancelamento registrado; último dia ' || comercial_data_br(k.ultimo_dia) || ' se confirmar.',
                                     false, null, null);
  perform registrar_historico_interno('comercial.cancelamento_pedido', 'cancelamento_cliente', k.id::text, jsonb_build_object('ultimoDia', k.ultimo_dia));
  return comercial_cancelamento_resposta(k);
end $$;

-- A tentativa de retenção, uma só, com o motivo do cancelamento (quadro 347). Ela decide.
create function comercial_tentar_retencao(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  v_motivo text;
  v_texto text := comercial_texto(p_dados, 'motivoTexto');
  v_retencao text := comercial_texto(p_dados, 'retencao');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  k := comercial_travar_cancelamento(p_id, p_versao);
  if k.retencao_em is not null then perform recusar_motivo('A tentativa de retenção já foi registrada', 'RETENCAO_REGISTRADA'); end if;
  v_motivo := comercial_motivo_cancelamento(p_dados, k.motivo);
  if v_motivo = 'OUTRO' and coalesce(length(v_texto), 0) not between 3 and 300 then perform recusar_campos('Diga qual é o outro motivo', 'motivoTexto'); end if;
  if coalesce(length(v_retencao), 0) not between 3 and 1000 then perform recusar_campos('Diga o que foi oferecido ou combinado', 'retencao'); end if;
  update cancelamentos_cliente set motivo = v_motivo, motivo_texto = case when v_motivo = 'OUTRO' then v_texto end, retencao = v_retencao,
         retencao_em = app_now(), retencao_por = p_pessoa, situacao = 'EM_RETENCAO', alterado_em = app_now(), alterado_por = p_pessoa
   where id = k.id
  returning * into k;
  perform registrar_historico_interno('comercial.retencao', 'cancelamento_cliente', k.id::text, jsonb_build_object('motivo', v_motivo));
  return comercial_cancelamento_resposta(k);
end $$;

-- A síndica decidiu ficar: o pedido fecha, sem mudar nada no contrato.
create function comercial_cliente_ficou(p_pessoa uuid, p_id uuid, p_versao integer, p_nota text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  v_nota text := nullif(btrim(p_nota), '');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  k := comercial_travar_cancelamento(p_id, p_versao);
  if v_nota is not null and length(v_nota) not between 3 and 300 then perform recusar_campos('A nota vai de 3 a 300 letras', 'nota'); end if;
  update cancelamentos_cliente set situacao = 'FICOU', decidido_em = app_now(), decidido_por = p_pessoa, decisao_nota = v_nota,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = k.id
  returning * into k;
  perform comercial_inserir_conversa(k.interessado_id, 'NOTA', 'O cliente decidiu ficar; o pedido de cancelamento foi fechado.', false, null, null);
  perform registrar_historico_interno('comercial.cancelamento_ficou', 'cancelamento_cliente', k.id::text, '{}'::jsonb);
  return comercial_cancelamento_resposta(k);
end $$;

-- A exportação completa do condomínio, como a da Plataforma (0180), pedida em nome do síndico
-- ativo (decisão h). Chamada no contexto do condomínio; sem síndico ativo, devolve nulo.
create function comercial_exportacao_do_cancelamento(p_cond uuid) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_sindico uuid;
  v_exp uuid;
  r record;
  v_lote jsonb := '[]'::jsonb;
  v_soma bigint := 0;
  v_numero integer := 1;
  v_id uuid;
begin
  select id into v_exp from exportacoes where condominio_id = p_cond and situacao = 'MONTANDO';
  if v_exp is not null then return v_exp; end if;
  select pessoa_id into v_sindico from vinculos
   where condominio_id = p_cond and funcao = 'SINDICO' and revogado_em is null order by criado_em desc limit 1;
  if v_sindico is null then return null; end if;
  insert into exportacoes (condominio_id, pedida_por) values (p_cond, v_sindico) returning id into v_exp;
  v_id := gen_random_uuid();
  insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, caminho)
  values (v_id, p_cond, v_exp, 1, 'DADOS', p_cond || '/' || v_exp || '/' || v_id);
  for r in select * from arquivos_para_exportar() order by nome loop
    if jsonb_array_length(v_lote) > 0 and (v_soma + r.tamanho > 47185920 or jsonb_array_length(v_lote) >= 2000) then
      v_numero := v_numero + 1;
      v_id := gen_random_uuid();
      insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, arquivos, quantos, caminho)
      values (v_id, p_cond, v_exp, v_numero, 'ARQUIVOS', v_lote, jsonb_array_length(v_lote), p_cond || '/' || v_exp || '/' || v_id);
      v_lote := '[]'::jsonb;
      v_soma := 0;
    end if;
    v_lote := v_lote || jsonb_build_array(jsonb_build_object('b', r.bucket, 'c', r.caminho, 'n', r.nome));
    v_soma := v_soma + r.tamanho;
  end loop;
  if jsonb_array_length(v_lote) > 0 then
    v_numero := v_numero + 1;
    v_id := gen_random_uuid();
    insert into partes_exportacao (id, condominio_id, exportacao_id, numero, tipo, arquivos, quantos, caminho)
    values (v_id, p_cond, v_exp, v_numero, 'ARQUIVOS', v_lote, jsonb_array_length(v_lote), p_cond || '/' || v_exp || '/' || v_id);
  end if;
  perform registrar_historico('memoria.exportacao_pedida', 'exportacoes', v_exp::text, jsonb_build_object('pacotes', v_numero, 'motivo', 'CANCELAMENTO'));
  return v_exp;
end $$;

-- Confirmar o cancelamento (decisões 8, f a i): é a Administração que registra a decisão do síndico.
create function comercial_confirmar_cancelamento(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k cancelamentos_cliente;
  v_motivo text;
  v_texto text := comercial_texto(p_dados, 'motivoTexto');
  v_lembrar date := comercial_data(p_dados, 'lembrarEm');
  v_exp uuid;
  v_desde date;
  v_comissao uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  k := comercial_travar_cancelamento(p_id, p_versao);
  v_motivo := comercial_motivo_cancelamento(p_dados, k.motivo);
  v_texto := case when v_motivo = 'OUTRO' then coalesce(v_texto, k.motivo_texto) end;
  if v_motivo = 'OUTRO' and coalesce(length(v_texto), 0) not between 3 and 300 then perform recusar_campos('Diga qual é o outro motivo', 'motivoTexto'); end if;
  if coalesce(p_dados ->> 'lembrarEm', '') <> '' and (v_lembrar is null or v_lembrar <= k.ultimo_dia or v_lembrar > k.ultimo_dia + 1095) then
    perform recusar_campos('A data para lembrar de reconquistar vai do dia seguinte ao último até três anos depois', 'lembrarEm');
  end if;
  -- No condomínio: o último dia (a Plataforma lê) e a exportação para o síndico.
  perform entrar_como_sistema(k.condominio_id);
  insert into encerramentos_contrato (condominio_id, cancelamento_id, ultimo_dia) values (k.condominio_id, k.id, k.ultimo_dia);
  v_exp := comercial_exportacao_do_cancelamento(k.condominio_id);
  -- No histórico do condomínio (o síndico vê) sai como sistema, com o último dia; quem confirmou
  -- fica no evento do Console abaixo. A exportação também fica no histórico dele, como pedida.
  perform registrar_historico('contrato.encerramento_marcado', 'encerramentos_contrato', k.condominio_id::text,
    jsonb_build_object('ultimoDia', k.ultimo_dia));
  perform definir_pessoa(p_pessoa);
  update cancelamentos_cliente set motivo = v_motivo, motivo_texto = v_texto, situacao = 'CONFIRMADO', decidido_em = app_now(), decidido_por = p_pessoa,
         lembrar_em = v_lembrar, exportacao_id = v_exp, alterado_em = app_now(), alterado_por = p_pessoa
   where id = k.id
  returning * into k;
  -- A comissão do parceiro acaba no último dia: sem comissão desde o mês seguinte (decisão i).
  perform set_config('app.comercial_sistema', 'on', true);
  update comissoes_parceiro c
     set sem_comissao_desde = greatest(c.inicio, (date_trunc('month', k.ultimo_dia) + interval '1 month')::date),
         encerrada_motivo = 'Cancelamento: último dia ' || comercial_data_br(k.ultimo_dia), encerrada_em = app_now(), encerrada_por = p_pessoa
   where c.interessado_id = k.interessado_id and c.encerrada_em is null
  returning c.id, c.sem_comissao_desde into v_comissao, v_desde;
  perform set_config('app.comercial_sistema', '', true);
  if v_comissao is not null then
    perform registrar_historico_interno('comercial.comissao_encerrada', 'comissao_parceiro', v_comissao::text,
      jsonb_build_object('desde', to_char(v_desde, 'YYYY-MM'), 'cancelamento', k.id));
  end if;
  perform comercial_inserir_conversa(k.interessado_id, 'NOTA', 'Cancelamento confirmado; o acesso continua até ' || comercial_data_br(k.ultimo_dia) || '.',
                                     false, null, null);
  perform registrar_historico_interno('comercial.cancelamento_confirmado', 'cancelamento_cliente', k.id::text,
    jsonb_build_object('motivo', v_motivo, 'ultimoDia', k.ultimo_dia, 'exportacao', v_exp is not null, 'comissao', v_comissao is not null));
  return comercial_cancelamento_resposta(k) || jsonb_build_object('semSindico', v_exp is null);
end $$;

-- ---------------------------------------------------------------------------------------
-- 13. Expansão (CM-32).

create function comercial_etapa_expansao(p text) returns text
language plpgsql
set search_path = public
as $$
begin
  if p is null or p not in ('ABERTA', 'EM_CONVERSA', 'PROPOSTA') then perform recusar_campos('Escolha a etapa', 'etapa'); end if;
  return p;
end $$;

-- Abrir (p_id nulo) ou mudar uma expansão. O mais um prédio abre a oportunidade nova (0308).
create function comercial_salvar_expansao(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  e expansoes_cliente;
  v_tipo text := comercial_texto(p_dados, 'tipo');
  v_motivo text := comercial_texto(p_dados, 'motivo');
  v_resp uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_passo text := comercial_texto(p_dados, 'proximoPasso');
  v_data date := comercial_data(p_dados, 'proximoPassoData');
  v_etapa text := coalesce(comercial_texto(p_dados, 'etapa'), 'ABERTA');
  v_op uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  if coalesce(length(v_motivo), 0) not between 3 and 300 then perform recusar_campos('Diga o motivo (o que mostra a chance)', 'motivo'); end if;
  if v_resp is null then perform recusar_campos('Escolha quem atende', 'responsavelId'); end if;
  perform comercial_exigir_responsavel(v_resp);
  if coalesce(length(v_passo), 0) not between 3 and 200 then perform recusar_campos('Diga o próximo passo', 'proximoPasso'); end if;
  if coalesce(p_dados ->> 'proximoPassoData', '') <> '' and (v_data is null or v_data < comercial_hoje() - 1) then
    perform recusar_campos('A data do próximo passo é de hoje em diante', 'proximoPassoData');
  end if;
  v_etapa := comercial_etapa_expansao(v_etapa);
  if p_id is null then
    if v_tipo is null or v_tipo not in ('MAIS_UM_PREDIO', 'MUDAR_FAIXA', 'RECONQUISTA') then perform recusar_campos('Escolha o tipo', 'tipo'); end if;
    i := comercial_buscar_cliente(nullif(p_dados ->> 'interessadoId', '')::uuid, true);
    if v_tipo = 'RECONQUISTA' and not exists (select 1 from cancelamentos_cliente where interessado_id = i.id and situacao = 'CONFIRMADO') then
      perform recusar_motivo('A reconquista é de quem confirmou o cancelamento', 'NAO_SAIU');
    end if;
    if v_tipo = 'MUDAR_FAIXA' then perform comercial_exigir_sem_cancelamento(i.id); end if;
    if v_tipo <> 'MAIS_UM_PREDIO' and exists (select 1 from expansoes_cliente where interessado_id = i.id and tipo = v_tipo and etapa not in ('GANHA', 'PERDIDA')) then
      perform recusar_motivo('Este cliente já tem uma expansão deste tipo aberta', 'EXPANSAO_ABERTA');
    end if;
    if v_tipo = 'MAIS_UM_PREDIO' then
      if p_dados -> 'oportunidade' is null or jsonb_typeof(p_dados -> 'oportunidade') <> 'object' then
        perform recusar_campos('Diga o condomínio do prédio novo', 'condominio');
      end if;
      v_op := (comercial_nova_oportunidade(p_pessoa, i.id, (p_dados -> 'oportunidade') || jsonb_build_object('responsavelId', v_resp)) ->> 'id')::uuid;
    end if;
    insert into expansoes_cliente (interessado_id, tipo, etapa, motivo, responsavel_id, proximo_passo, proximo_passo_data, oportunidade_id, criado_por)
    values (i.id, v_tipo, v_etapa, v_motivo, v_resp, v_passo, v_data, v_op, p_pessoa)
    returning * into e;
    perform registrar_historico_interno('comercial.expansao', 'expansao_cliente', e.id::text, jsonb_build_object('tipo', v_tipo, 'oportunidade', v_op));
    return comercial_expansao_json(e, i);
  end if;
  select * into e from expansoes_cliente where id = p_id;
  if not found then raise exception 'Expansão não encontrada' using errcode = 'TC404'; end if;
  i := comercial_buscar_cliente(e.interessado_id, true);
  select * into e from expansoes_cliente where id = p_id for update;
  if e.versao <> p_versao then perform conflito_versao('expansoes_cliente', p_id); end if;
  if e.encerrada_em is not null then perform recusar_motivo('Esta expansão já foi encerrada', 'EXPANSAO_ENCERRADA'); end if;
  update expansoes_cliente set etapa = v_etapa, motivo = v_motivo, responsavel_id = v_resp, proximo_passo = v_passo, proximo_passo_data = v_data,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into e;
  perform registrar_historico_interno('comercial.expansao', 'expansao_cliente', e.id::text, jsonb_build_object('etapa', v_etapa));
  return comercial_expansao_json(e, i);
end $$;

create function comercial_encerrar_expansao(p_pessoa uuid, p_id uuid, p_versao integer, p_etapa text, p_resultado text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  e expansoes_cliente;
  v_resultado text := nullif(btrim(p_resultado), '');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into e from expansoes_cliente where id = p_id;
  if not found then raise exception 'Expansão não encontrada' using errcode = 'TC404'; end if;
  i := comercial_buscar_cliente(e.interessado_id, true);
  select * into e from expansoes_cliente where id = p_id for update;
  if e.versao <> p_versao then perform conflito_versao('expansoes_cliente', p_id); end if;
  if e.encerrada_em is not null then perform recusar_motivo('Esta expansão já foi encerrada', 'EXPANSAO_ENCERRADA'); end if;
  if p_etapa is null or p_etapa not in ('GANHA', 'PERDIDA') then perform recusar_campos('Diga se ganhou ou perdeu', 'etapa'); end if;
  if (p_etapa = 'PERDIDA' or v_resultado is not null) and coalesce(length(v_resultado), 0) not between 3 and 300 then
    perform recusar_campos('Diga o que aconteceu', 'resultado');
  end if;
  update expansoes_cliente set etapa = p_etapa, resultado = v_resultado, encerrada_em = app_now(), encerrada_por = p_pessoa,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into e;
  perform registrar_historico_interno('comercial.expansao_encerrada', 'expansao_cliente', e.id::text, jsonb_build_object('etapa', p_etapa));
  return comercial_expansao_json(e, i);
end $$;

-- ---------------------------------------------------------------------------------------
-- 14. A cobrança e a Plataforma: o reajuste na competência e o contrato que terminou.

-- O reajuste avisado que já vale na competência entra no plano (decisão d). No contexto do
-- condomínio, por quem abre a competência (a vaga de fundador é liberada pelo gatilho do plano).
create function aplicar_reajustes_plano(pl planos_cliente, p_comp date) returns planos_cliente
language plpgsql
set search_path = public
as $$
declare
  r reajustes_plano;
  v_sistema text := coalesce(current_setting('app.comercial_sistema', true), '');
begin
  for r in select * from reajustes_plano where condominio_id = pl.condominio_id and aplicado_em is null and vale_desde <= p_comp
            order by vale_desde, criado_em loop
    perform set_config('app.plano_tabela', coalesce(r.tabela, pl.tabela_origem, ''), true);
    update planos_cliente set valor_centavos = r.valor_centavos, nome = coalesce(r.nome, nome) where id = pl.id returning * into pl;
    perform set_config('app.plano_tabela', '', true);
    update reajustes_plano set aplicado_em = app_now() where id = r.id;
    perform set_config('app.comercial_sistema', 'on', true);
    update renovacoes_cliente set situacao = 'APLICADO', aplicado_em = app_now() where id = r.renovacao_id and situacao = 'AVISO_ENVIADO';
    perform set_config('app.comercial_sistema', v_sistema, true);
    perform registrar_historico_interno('plano.reajustado', 'plano', pl.id::text,
      jsonb_build_object('valor', r.valor_centavos, 'desde', r.vale_desde, 'tipo', r.tipo));
  end loop;
  return pl;
end $$;

-- Abrir a competência (0291, decisão D), agora com o reajuste avisado e sem o contrato que terminou.
create or replace function console_abrir_competencia(p_pessoa uuid, p_competencia date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lista jsonb;
  v_comp date := date_trunc('month', p_competencia)::date;
  pl planos_cliente;
  v_criadas integer := 0;
  v_ja integer := 0;
  v_sem_plano integer := 0;
  v_encerrados integer := 0;
  v_cobranca uuid;
begin
  perform entrar_console(p_pessoa, 'console.pagamentos.registrar');
  if p_competencia is null then perform recusar_campos('Diga a competência', 'competencia'); end if;
  select coalesce(jsonb_agg(distinct v.condominio_id), '[]'::jsonb) into v_lista
    from vinculos v where v.pessoa_id = p_pessoa and v.revogado_em is null and v.funcao = any (contexto_equipe_funcoes());
  for r in select (x #>> '{}')::uuid as id from jsonb_array_elements(v_lista) x loop
    if pode(p_pessoa, r.id, 'console.pagamentos.registrar') then
      perform entrar_condominio(p_pessoa, r.id, 'console.pagamentos.registrar');
      select * into pl from planos_cliente where condominio_id = r.id;
      if exists (select 1 from encerramentos_contrato e where e.condominio_id = r.id and e.ultimo_dia < v_comp) then
        v_encerrados := v_encerrados + 1;
        continue;
      end if;
      if pl.id is not null then pl := aplicar_reajustes_plano(pl, v_comp); end if;
      if pl.id is null or pl.inicio_competencia > v_comp
         or (pl.ciclo = 'ANUAL' and extract(month from pl.inicio_competencia) <> extract(month from v_comp)) then
        v_sem_plano := v_sem_plano + 1;
      elsif exists (select 1 from cobrancas where condominio_id = r.id and tipo = 'MENSALIDADE' and competencia = v_comp) then
        v_ja := v_ja + 1;
      else
        insert into cobrancas (condominio_id, tipo, competencia, valor_centavos, vence_em, criada_por)
        values (r.id, 'MENSALIDADE', v_comp, pl.valor_centavos, v_comp + (pl.dia_vencimento - 1), p_pessoa)
        returning id into v_cobranca;
        perform registrar_historico_interno('cobranca.aberta', 'cobranca', v_cobranca::text, jsonb_build_object('competencia', v_comp));
        v_criadas := v_criadas + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('criadas', v_criadas, 'jaAbertas', v_ja, 'semPlano', v_sem_plano, 'encerrados', v_encerrados);
end $$;

-- O que o plano deixa (0291), agora com o contrato que terminou (decisão g): depois do último dia,
-- ficam a consulta, a exportação, a privacidade e o suporte.
create or replace function exigir_conjunto(p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
declare
  v_conjunto text;
  v_modo text;
begin
  if p_acao not like 'console.%' and p_acao not like '%.ver' and p_acao not like 'privacidade.%'
     and p_acao not in ('memoria.exportar', 'memoria.dossie', 'suporte.chamados', 'acesso_excepcional.aprovar')
     and exists (select 1 from encerramentos_contrato e where e.condominio_id = p_condominio and e.ultimo_dia < comercial_hoje()) then
    perform recusar_motivo('O contrato deste condomínio terminou: ficam a consulta e a exportação', 'CONTRATO_ENCERRADO');
  end if;
  v_conjunto := conjunto_da_acao(p_acao);
  if v_conjunto is null then return; end if;
  v_modo := conjunto_modo(p_condominio, v_conjunto);
  if v_modo = 'COMPLETO' or (v_modo = 'CONSULTA' and (p_acao like '%.ver' or p_acao = 'memoria.exportar')) then
    return;
  end if;
  perform recusar_motivo(format('%s não está no plano deste condomínio', (select nome from conjuntos where codigo = v_conjunto)),
                         case v_modo when 'CONSULTA' then 'CONJUNTO_SUSPENSO' else 'CONJUNTO_FORA_DO_PLANO' end);
end $$;

-- ---------------------------------------------------------------------------------------
-- 15. O cartão do Comercial no Início (quadro 335): agora com as renovações que pedem aviso e os
-- clientes com sinal de risco, depois dos interessados.

create or replace function comercial_inicio(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := app_now();
  v_hoje  date := comercial_hoje();
  v_dias  integer[] := comercial_dias_janela();
  v_max   integer := configuracao_int('comercial_inicio_max');
  v_prazo integer := (select prazo_aviso_dias from regra_reajuste);
  v_ren   integer := configuracao_int('comercial_renovacao_inicio_dias');
  v_atraso integer := configuracao_int('comercial_renovacao_atraso_dias');
  v jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  -- Os candidatos numa leitura só: os abertos e, dos fechados, só os que podem ter janela (fidelidade,
  -- voltar a falar ou síndico novo sem tratar). Quem está no não contatar não aparece (LGPD).
  with cand as materialized (
    select i as r, p.aberta as aberto, p.limite_dias as lim, cd.passos
      from interessados i join parametros_etapa_comercial p on p.etapa = i.etapa
      left join cadencias_comercial cd on cd.id = i.cadencia_id and i.cadencia_fim_em is null
     where i.anonimizado_em is null and i.virou_cliente_em is null
       and (p.aberta
            or (i.etapa in ('PERDIDO', 'SEM_RESPOSTA')
                and (i.fidelidade_ate between v_hoje and v_hoje + v_dias[4] or i.retomar_em <= v_hoje
                     or exists (select 1 from janelas_comercial s where s.interessado_id = i.id and s.tipo = 'SINDICO_NOVO'
                                   and s.tratada_em is null and s.criado_em >= i.etapa_desde))))
       -- a regra de comercial_nao_contatar_tem, em junção (uma chamada por linha levava segundos)
       and not exists (select 1 from nao_contatar n where n.whatsapp = i.whatsapp)
       and not exists (select 1 from nao_contatar n where n.email = lower(i.email))
       and not exists (select 1 from nao_contatar n where n.cnpj = i.cnpj)
  ), base as materialized (
    select (c.r).id, (c.r).condominio, (c.r).etapa, (c.r).responsavel_id, (c.r).primeiro_retorno_ate,
           c.aberto and (c.r).primeira_resposta_em is null and (c.r).primeiro_retorno_ate < v_agora as sem_retorno,
           case when c.aberto then comercial_tarefa_de(c.r, c.lim, c.passos, v_agora) end as t,
           -- Só calcula as janelas de quem tem alguma data dentro do aviso.
           case when (c.aberto and ((c.r).assembleia_ordinaria between v_hoje + v_dias[2] and v_hoje + v_dias[1]
                                     or (c.r).mandato_ate between v_hoje and v_hoje + v_dias[3]))
                     or (c.r).fidelidade_ate between v_hoje and v_hoje + v_dias[4]
                     or not c.aberto
                then (select jsonb_agg(x order by x ->> 'de') from jsonb_array_elements(comercial_janelas_de(c.r, c.aberto, v_hoje, v_dias, true)) x
                       where (x ->> 'pedeAtencao')::boolean) end as j
      from cand c
  ), itens as materialized (
    select b.*,
           case when b.sem_retorno then 'PRIMEIRO_RETORNO'
                when b.t ->> 'situacao' = 'ATRASADO' then 'ATRASADO'
                when b.t ? 'diasParado' then 'PARADO'
                when b.j is not null then 'JANELA' end as motivo,
           (case when b.sem_retorno then 1 else 0 end) + (case when not b.sem_retorno and b.t ->> 'situacao' = 'ATRASADO' then 1 else 0 end)
             + (case when b.t ? 'diasParado' then 1 else 0 end) + coalesce(jsonb_array_length(b.j), 0) as razoes
      from base b
  ),
  -- Os clientes (0311): o aniversário da vez perto do "avisar até" e os sinais de risco sem tratar.
  clientes as materialized (
    select i.id, i.condominio, i.etapa, i.responsavel_id,
           comercial_proximo_aniversario(i.id, (c.dados ->> 'dataInicio')::date, v_hoje, v_atraso) as aniversario,
           (select jsonb_agg(jsonb_build_object('tipo', s.tipo, 'data', s.data_ref) order by s.data_ref, s.tipo)
              from riscos_cliente s where s.interessado_id = i.id and s.tratado_em is null) as sinais
      from interessados i
      left join contratos_comercial c on c.interessado_id = i.id and c.situacao = 'ASSINADO'
     where i.virou_cliente_em is not null and i.condominio_id is not null and i.anonimizado_em is null
       and not exists (select 1 from cancelamentos_cliente k where k.interessado_id = i.id and k.situacao = 'CONFIRMADO')
  ), cli_itens as materialized (
    select cl.*, case when cl.aniversario - v_prazo <= v_hoje + v_ren then 'RENOVACAO' when cl.sinais is not null then 'RISCO' end as motivo,
           (case when cl.aniversario - v_prazo <= v_hoje + v_ren then 1 else 0 end) + coalesce(jsonb_array_length(cl.sinais), 0) as razoes
      from clientes cl
  ), ordenados as materialized (
    select it.id, it.condominio, it.etapa, it.responsavel_id, it.motivo, it.razoes, it.t, it.j, null::date as aniversario, null::jsonb as sinais,
           case it.motivo when 'PRIMEIRO_RETORNO' then 1 when 'ATRASADO' then 2 when 'PARADO' then 3 when 'JANELA' then 4 when 'RENOVACAO' then 5 else 6 end as prioridade,
           case it.motivo when 'PRIMEIRO_RETORNO' then it.primeiro_retorno_ate
                          when 'ATRASADO' then (it.t ->> 'quando')::timestamptz
                          when 'JANELA' then ((it.j -> 0 ->> 'de')::date)::timestamp at time zone 'America/Sao_Paulo' end as quando
      from itens it where it.motivo is not null
    union all
    select ci.id, ci.condominio, ci.etapa, ci.responsavel_id, ci.motivo, ci.razoes, null, null, ci.aniversario, ci.sinais,
           case ci.motivo when 'RENOVACAO' then 5 else 6 end,
           case ci.motivo when 'RENOVACAO' then ((ci.aniversario - v_prazo)::timestamp at time zone 'America/Sao_Paulo')
                          else (((ci.sinais -> 0 ->> 'data')::date)::timestamp at time zone 'America/Sao_Paulo') end
      from cli_itens ci where ci.motivo is not null
  )
  select jsonb_build_object(
    'total', (select count(*)::integer from ordenados),
    'contagens', jsonb_build_object(
      'primeiroRetorno', (select count(*)::integer from itens where sem_retorno),
      'atrasados', (select count(*)::integer from itens where not sem_retorno and t ->> 'situacao' = 'ATRASADO'),
      'parados', (select count(*)::integer from itens where t ? 'diasParado'),
      'janelas', (select count(*)::integer from itens where j is not null),
      'renovacoes', (select count(*)::integer from cli_itens where aniversario - v_prazo <= v_hoje + v_ren),
      'riscos', (select count(*)::integer from cli_itens where sinais is not null)),
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'id', o.id, 'condominio', o.condominio, 'etapa', o.etapa, 'motivo', o.motivo,
                         'responsavel', case when o.responsavel_id is not null then jsonb_build_object('id', o.responsavel_id, 'nome', comercial_nome(o.responsavel_id)) end,
                         'meu', o.responsavel_id is not distinct from p_pessoa,
                         'quando', case when o.motivo in ('PRIMEIRO_RETORNO', 'ATRASADO') then o.quando end,
                         'tarefa', case when o.motivo = 'ATRASADO' then o.t ->> 'tarefa' end,
                         'diasParado', (o.t ->> 'diasParado')::integer,
                         'janela', case when o.motivo = 'JANELA' then o.j -> 0 end,
                         'renovacao', case when o.motivo = 'RENOVACAO' then jsonb_build_object('aniversario', o.aniversario, 'avisarAte', o.aniversario - v_prazo,
                                                                                               'dias', o.aniversario - v_hoje) end,
                         'risco', case when o.motivo = 'RISCO' then o.sinais -> 0 end,
                         'outros', greatest(o.razoes - 1, 0)))
                         order by o.prioridade, (o.responsavel_id is not distinct from p_pessoa) desc, o.quando nulls last, o.condominio)
                         from (select * from ordenados order by prioridade, (responsavel_id is not distinct from p_pessoa) desc, quando nulls last, condominio
                               limit v_max) o), '[]'::jsonb),
    'max', v_max,
    'podeEditar', pode_global('console.comercial.editar'))
  into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- 16. LGPD: a anonimização do interessado (0310) apaga também os textos desta rodada.

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
  -- Renovação, risco, cancelamento e expansão (0311): saem os textos de pessoa; ficam os valores,
  -- as datas e o motivo da lista.
  update renovacoes_cliente set aviso_para = null, aviso_texto = null, textos_apagados_em = coalesce(textos_apagados_em, app_now())
   where interessado_id = p_id and num_nonnulls(aviso_para, aviso_texto) > 0;
  update cancelamentos_cliente set pedido_por = null, retencao = null, decisao_nota = null, motivo_texto = null, textos_apagados_em = app_now()
   where interessado_id = p_id and textos_apagados_em is null;
  update riscos_cliente set detalhe = null, tratado_nota = null where interessado_id = p_id and num_nonnulls(detalhe, tratado_nota) > 0;
  update expansoes_cliente set etapa = 'PERDIDA', resultado = 'Dados apagados (LGPD)', encerrada_em = app_now(), encerrada_por = v_pessoa
   where interessado_id = p_id and encerrada_em is null;
  update expansoes_cliente set motivo = 'Dado apagado (LGPD)', proximo_passo = null
   where interessado_id = p_id and (motivo <> 'Dado apagado (LGPD)' or proximo_passo is not null);
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- 17. A rotina diária (decisões j e l): o uso caindo e a retenção dos textos.

create function comercial_rotina_renovacoes() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_agora timestamptz := app_now();
  v_hoje date := comercial_hoje();
  v_queda integer := configuracao_int('comercial_uso_queda_percentual');
  v_base integer := configuracao_int('comercial_uso_base_minima');
  v_recentes integer;
  v_antes integer;
  v_total integer := 0;
  v_n integer;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  -- Uso caindo: os pedidos dos últimos 30 dias contra os 30 anteriores, uma vez por mês.
  for r in
    select i.id, i.condominio_id from interessados i
     where i.virou_cliente_em is not null and i.condominio_id is not null and i.anonimizado_em is null
       and not exists (select 1 from cancelamentos_cliente k where k.interessado_id = i.id and k.situacao = 'CONFIRMADO')
       and not exists (select 1 from riscos_cliente s where s.interessado_id = i.id and s.tipo = 'USO_CAINDO' and s.data_ref = date_trunc('month', v_hoje)::date)
  loop
    perform entrar_como_sistema(r.condominio_id);
    select count(*) filter (where criado_em >= v_agora - interval '30 days'), count(*) filter (where criado_em < v_agora - interval '30 days')
      into v_recentes, v_antes
      from pedidos where condominio_id = r.condominio_id and criado_em >= v_agora - interval '60 days' and criado_em < v_agora;
    perform entrar_como_sistema(null);
    if v_antes >= greatest(v_base, 1) and v_recentes * 100 <= v_antes * (100 - v_queda) then
      insert into riscos_cliente (interessado_id, tipo, origem, data_ref, detalhe)
      values (r.id, 'USO_CAINDO', 'PEDIDOS', date_trunc('month', v_hoje)::date,
              format('Uso caiu %s%% em 30 dias', round(100 - v_recentes * 100.0 / v_antes)::integer))
      on conflict (interessado_id, tipo, data_ref) do nothing;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end if;
  end loop;
  -- Retenção (catálogo 39 e 40).
  update renovacoes_cliente set aviso_para = null, aviso_texto = null, textos_apagados_em = v_agora
   where num_nonnulls(aviso_para, aviso_texto) > 0 and aviso_em < v_hoje - make_interval(years => configuracao_int('comercial_aviso_texto_anos'));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  update cancelamentos_cliente set pedido_por = null, retencao = null, decisao_nota = null, motivo_texto = null, textos_apagados_em = v_agora
   where textos_apagados_em is null
     and (case when situacao = 'FICOU' then (decidido_em at time zone 'America/Sao_Paulo')::date else ultimo_dia end)
         < v_hoje - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'))
     and situacao in ('FICOU', 'CONFIRMADO');
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  update riscos_cliente set detalhe = null, tratado_nota = null
   where num_nonnulls(detalhe, tratado_nota) > 0 and origem = 'A_MAO'
     and tratado_em < v_agora - make_interval(months => configuracao_int('comercial_cancelamento_texto_meses'));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  perform set_config('app.comercial_sistema', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('comercial-renovacoes', '37 4 * * *', 'select public.comercial_rotina_renovacoes()');
exception when others then
  raise notice 'pg_cron indisponível: agende comercial_rotina_renovacoes() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- 18. O histórico desta rodada é do Comercial, como o dos interessados.

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
                                                                'agenda_comercial', 'demonstracao_comercial', 'regra_reajuste', 'modelo_aditivo',
                                                                'renovacao_cliente', 'aditivo_comercial', 'risco_cliente', 'cancelamento_cliente',
                                                                'expansao_cliente')
             and pode_global('console.comercial.ver')));

call fechar_acesso();

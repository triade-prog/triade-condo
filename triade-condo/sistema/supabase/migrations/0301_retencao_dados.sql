-- 0301 · Inventário de dados, retenção e exclusão (F0.11; PT-11, PT-03, EM-08).
-- Análise e decisões aprovadas pela Carolina em 24/10/2026 (A.1 a E.1) com o desenho dos
-- quadros 350 a 359 (docs/design/telas-modelo/privacidade-*).
--
-- Regras desta parte:
-- 1. O catálogo (retencao_tipos) guarda os 32 tipos de dado pessoal do sistema, com finalidade,
--    base, prazo e o que acontece no fim. As telas e o inventário em PDF leem dele.
-- 2. Os prazos são da TRÍADE, iguais para todos os condomínios (B.1). Mudar um prazo é uma
--    nova migration.
-- 3. Toda madrugada (03:10 em Brasília), a rotina procura, em cada condomínio, o que passou do
--    prazo. No modo CONTANDO, só conta; no modo APAGANDO, apaga o dado pessoal e mantém a
--    linha, com a data em que foi apagado. Nos dois, grava no histórico do condomínio quantos
--    itens de cada tipo, sem dado pessoal (PT-03: nada some em silêncio). Nasce CONTANDO: só a
--    Administração da TRÍADE liga a exclusão, depois de conferir os totais.
-- 4. Arquivos (fotos, áudios, exportações) vão para a fila arquivos_a_apagar; a api-plataforma
--    apaga do armazenamento e marca o resultado.
-- 5. O síndico pode guardar um pedido, uma manutenção, uma encomenda ou uma pessoa por
--    obrigação legal, com motivo. O que está guardado a rotina pula. Tirar a guarda pede motivo.
-- 6. Dados de uma pessoa (D.1, LGPD art. 18): o síndico busca pelo telefone ou e-mail, vê onde
--    a pessoa aparece, baixa tudo e remove os dados quando ela não mora mais em nenhuma unidade
--    e não tem pedido aberto. A busca fica no histórico.
-- 7. A rotina só passa por cima das travas de imutabilidade de cada tabela dentro dela mesma
--    (app.retencao, conferido junto com o papel dominio), e só para apagar.
--
-- Fica para depois (item pendente F0.12 do painel): os arquivos de pedido, manutenção e
-- prestador com 5 anos, os prestadores arquivados com 5 anos, a entrada da equipe que saiu, as
-- sessões, os dados do Console (clientes com 5 anos, comercial) e a exclusão do condomínio no
-- fim do contrato (C.1 e E.1), que espera o estado de contrato encerrado.

-- ---------------------------------------------------------------------------------------
-- Permissões.

insert into funcao_acoes (funcao, acao) values
  ('SINDICO', 'privacidade.ver'),
  ('SINDICO', 'privacidade.cuidar'),
  ('ADMINISTRACAO', 'console.retencao.ver'),
  ('ADMINISTRACAO', 'console.retencao.ligar');

-- ---------------------------------------------------------------------------------------
-- O catálogo (regra 1).

create table retencao_tipos (
  codigo    text primary key check (codigo ~ '^[A-Z][A-Z_]{1,39}$'),
  numero    integer not null unique check (numero between 1 and 99),
  sistema   text not null check (sistema in ('PLATAFORMA', 'CONSOLE')),
  grupo     text not null check (length(grupo) between 3 and 60),
  nome      text not null check (length(nome) between 3 and 80),
  o_que     text not null check (length(o_que) between 3 and 120),
  para_que  text not null check (length(para_que) between 3 and 120),
  base      text not null check (length(base) between 3 and 120),
  quem      text not null check (length(quem) between 3 and 120),
  prazo     text not null check (length(prazo) between 3 and 120),
  no_fim    text not null check (length(no_fim) between 3 and 160),
  -- NA_ROTINA: a rotina aplica; FICA: guardado enquanto o condomínio for cliente; A_FAZER: o
  -- prazo vale, mas a rotina ainda não aplica (F0.12).
  situacao  text not null check (situacao in ('NA_ROTINA', 'FICA', 'A_FAZER'))
);
call proteger_tabela_global('retencao_tipos', 'Catálogo de tipos de dado e prazos, igual para todos os condomínios (F0.11).');
create trigger retencao_tipos_sem_exclusao before delete on retencao_tipos for each row execute function somente_insercao();

insert into retencao_tipos (numero, codigo, sistema, grupo, nome, o_que, para_que, base, quem, prazo, no_fim, situacao) values
 (1, 'EQUIPE_CONDOMINIO', 'PLATAFORMA', 'Pessoas', 'Equipe do condomínio', 'Nome e e-mail de entrada', 'Entrar e responder pelo que fez', 'Execução do contrato', 'Condomínio; TRÍADE opera', '90 dias depois de perder o acesso', 'A entrada é apagada; o nome fica no histórico', 'A_FAZER'),
 (2, 'SESSAO', 'PLATAFORMA', 'Pessoas', 'Sessões de entrada', 'Em que condomínio a pessoa está', 'Manter a pessoa conectada', 'Execução do contrato', 'Condomínio; TRÍADE opera', '30 dias sem uso', 'Apagadas', 'A_FAZER'),
 (3, 'CONTATO', 'PLATAFORMA', 'Pessoas', 'Contato de morador', 'Nome, telefone, e-mail, aniversário', 'Comunicar e atender', 'Execução do contrato; legítimo interesse', 'Condomínio; TRÍADE opera', '180 dias depois de sair da última unidade', 'Os dados são apagados; fica “contato removido”', 'NA_ROTINA'),
 (4, 'FAMILIA', 'PLATAFORMA', 'Pessoas', 'Família', 'Nome, parentesco, aniversário', 'Saber quem mora', 'Legítimo interesse', 'Condomínio; TRÍADE opera', '90 dias depois de sair', 'Nome e aniversário apagados', 'NA_ROTINA'),
 (5, 'PET', 'PLATAFORMA', 'Pessoas', 'Pets', 'Nome, espécie, raça', 'Saber quem mora', 'Legítimo interesse', 'Condomínio; TRÍADE opera', '90 dias depois de sair', 'Nome, raça e observação apagados', 'NA_ROTINA'),
 (6, 'VEICULO', 'PLATAFORMA', 'Pessoas', 'Veículos', 'Placa e modelo', 'Garagem e portaria', 'Legítimo interesse', 'Condomínio; TRÍADE opera', '90 dias depois de retirado', 'Placa e modelo apagados', 'NA_ROTINA'),
 (7, 'CADASTRO_LINK', 'PLATAFORMA', 'Pessoas', 'Cadastro por link', 'O que o morador mandou', 'Receber o cadastro', 'Execução do contrato', 'Condomínio; TRÍADE opera', '30 dias depois de aprovado', 'A cópia é apagada; o cadastro fica na unidade', 'NA_ROTINA'),
 (8, 'PEDIDO', 'PLATAFORMA', 'Pedidos e manutenção', 'Pedidos', 'Relato, local, unidade, quem pediu', 'Atender e provar o que foi feito', 'Execução do contrato; legítimo interesse', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam; quem pediu some quando o contato é removido', 'FICA'),
 (9, 'ARQUIVO_SERVICO', 'PLATAFORMA', 'Pedidos e manutenção', 'Fotos e arquivos', 'De pedidos, manutenções e prestadores', 'Prova do serviço', 'Legítimo interesse', 'Condomínio; TRÍADE opera', '5 anos depois de encerrado', 'O arquivo é apagado; fica “apagado pelo prazo”', 'A_FAZER'),
 (10, 'MANUTENCAO', 'PLATAFORMA', 'Pedidos e manutenção', 'Manutenções e preventivas', 'O que foi feito, por quem, quando', 'Memória do prédio', 'Legítimo interesse; obrigação legal', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam', 'FICA'),
 (11, 'MENSAGEM', 'PLATAFORMA', 'Comunicação', 'Mensagens de WhatsApp', 'Texto, áudio, foto, número', 'Virar pedido', 'Execução do contrato', 'Condomínio; TRÍADE e Wafly operam', '90 dias se não virou pedido; se virou, segue o pedido', 'Texto, mídia e número apagados', 'NA_ROTINA'),
 (12, 'CONVERSA', 'PLATAFORMA', 'Comunicação', 'Conversas em andamento', 'Em que passo a conversa está', 'Continuar a conversa', 'Execução do contrato', 'Condomínio; TRÍADE opera', '30 dias sem mensagem', 'Apagadas', 'NA_ROTINA'),
 (13, 'TRANSCRICAO', 'PLATAFORMA', 'Comunicação', 'Transcrição de áudio', 'O texto do áudio', 'Ler o áudio', 'Execução do contrato', 'Condomínio; TRÍADE opera', 'Segue a mensagem', 'Apagada junto', 'NA_ROTINA'),
 (14, 'ENVIO', 'PLATAFORMA', 'Comunicação', 'Envios de WhatsApp e e-mail', 'Número, endereço, texto', 'Enviar e provar que enviou', 'Execução do contrato', 'Condomínio; TRÍADE, Wafly e Resend operam', '12 meses', 'Ficam só a data e a situação', 'NA_ROTINA'),
 (15, 'AVISO', 'PLATAFORMA', 'Comunicação', 'Avisos do app', 'Aviso para a equipe', 'Avisar', 'Execução do contrato', 'Condomínio; TRÍADE opera', '12 meses depois de visto', 'Apagados', 'NA_ROTINA'),
 (16, 'COMUNICADO', 'PLATAFORMA', 'Comunicação', 'Comunicados', 'Texto e para quem foi', 'Comunicar', 'Execução do contrato', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam', 'FICA'),
 (17, 'DOCUMENTO', 'PLATAFORMA', 'Documentos e memória', 'Documentos e atas', 'Arquivos e versões', 'Memória do prédio', 'Legítimo interesse; obrigação legal', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam', 'FICA'),
 (18, 'PEDIDO_DOCUMENTO', 'PLATAFORMA', 'Comunicação', 'Pedidos de documento', 'E-mail de quem pediu', 'Enviar o documento', 'Execução do contrato', 'Condomínio; TRÍADE opera', '12 meses', 'E-mail apagado', 'NA_ROTINA'),
 (19, 'RESERVA', 'PLATAFORMA', 'Portaria e vida em condomínio', 'Reservas', 'Unidade, quem reservou, observação', 'Usar a área comum', 'Execução do contrato', 'Condomínio; TRÍADE opera', '24 meses depois da data', 'Ficam só a unidade e a data', 'NA_ROTINA'),
 (20, 'VOTACAO', 'PLATAFORMA', 'Portaria e vida em condomínio', 'Enquetes e assembleias', 'Presença, procurador, votos', 'Provar a decisão', 'Obrigação legal', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam; o voto secreto não mostra quem votou', 'FICA'),
 (21, 'CLASSIFICADO', 'PLATAFORMA', 'Portaria e vida em condomínio', 'Classificados', 'Texto, foto, telefone', 'Anunciar no prédio', 'Legítimo interesse', 'Condomínio; TRÍADE opera', '90 dias depois de sair do mural', 'Texto e foto apagados', 'NA_ROTINA'),
 (22, 'ENCOMENDA', 'PLATAFORMA', 'Portaria e vida em condomínio', 'Encomendas', 'Remetente, quem retirou, foto da etiqueta', 'Provar a entrega', 'Legítimo interesse', 'Condomínio; TRÍADE opera', 'Foto: 90 dias depois de entregue; nomes: 12 meses', 'Apagados', 'NA_ROTINA'),
 (23, 'PRESTADOR', 'PLATAFORMA', 'Pedidos e manutenção', 'Prestadores', 'Nome, telefone, e-mail, CPF ou CNPJ', 'Contratar e chamar', 'Execução do contrato', 'Condomínio; TRÍADE opera', '5 anos depois de arquivado', 'Contato e documento apagados; o nome fica', 'A_FAZER'),
 (24, 'CHAMADO', 'PLATAFORMA', 'Documentos e memória', 'Chamados de suporte', 'Mensagens, imagens, dados conferidos', 'Suporte da TRÍADE', 'Execução do contrato', 'Condomínio; TRÍADE opera', 'Imagens: 24 meses depois de resolvido', 'Imagens apagadas', 'NA_ROTINA'),
 (25, 'EXPORTACAO', 'PLATAFORMA', 'Documentos e memória', 'Exportações', 'O arquivo com tudo', 'Entregar os dados ao condomínio', 'Execução do contrato', 'Condomínio; TRÍADE opera', '7 dias', 'O arquivo é apagado', 'NA_ROTINA'),
 (26, 'LINK', 'PLATAFORMA', 'Documentos e memória', 'Links e códigos sem conta', 'Só o resumo do código', 'Abrir sem conta', 'Execução do contrato', 'Condomínio; TRÍADE opera', '90 dias depois de vencer', 'Apagados', 'NA_ROTINA'),
 (27, 'HISTORICO', 'PLATAFORMA', 'Documentos e memória', 'Histórico', 'Quem fez o quê e quando, sem dado pessoal', 'Nada some em silêncio', 'Legítimo interesse', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Fica', 'FICA'),
 (28, 'RELATORIO', 'PLATAFORMA', 'Documentos e memória', 'Relatórios do mês e dossiês', 'Resumo do que aconteceu', 'Prestar contas', 'Execução do contrato', 'Condomínio; TRÍADE opera', 'Enquanto o condomínio for cliente', 'Ficam', 'FICA'),
 (29, 'EQUIPE_TRIADE', 'CONSOLE', 'Console TRÍADE', 'Equipe TRÍADE', 'Nome, entrada, funções', 'Trabalhar e responder pelo que fez', 'Execução do contrato', 'TRÍADE', '90 dias depois de sair', 'A entrada é apagada; o nome fica', 'A_FAZER'),
 (30, 'CLIENTE', 'CONSOLE', 'Console TRÍADE', 'Clientes, contratos e cobrança', 'Plano, cobranças, recebimentos', 'Cobrar e cumprir o fisco', 'Obrigação legal', 'TRÍADE', '5 anos depois do fim do contrato', 'Apagados', 'A_FAZER'),
 (31, 'NOTA_INTERNA', 'CONSOLE', 'Console TRÍADE', 'Notas internas e acessos excepcionais', 'O que a equipe anotou', 'Atender o cliente', 'Legítimo interesse', 'TRÍADE', 'Até o fim do contrato', 'Seguem o fim do contrato', 'FICA'),
 (32, 'COMERCIAL', 'CONSOLE', 'Console TRÍADE', 'Comercial', 'Interessados e propostas', 'Vender', 'Legítimo interesse', 'TRÍADE', '12 meses sem contato', 'Apagados', 'A_FAZER');

-- ---------------------------------------------------------------------------------------
-- O modo da rotina e as rodadas (regra 3).

create table retencao_estado (
  unica      boolean primary key default true check (unica),
  modo       text not null default 'CONTANDO' check (modo in ('CONTANDO', 'APAGANDO')),
  mudado_em  timestamptz,
  mudado_por uuid references pessoas (id),
  versao     integer not null default 1,
  check ((mudado_em is null) = (mudado_por is null))
);
call proteger_tabela_global('retencao_estado', 'Modo da rotina de retenção, um só para todos os condomínios (F0.11).');
create trigger retencao_estado_sem_exclusao before delete on retencao_estado for each row execute function somente_insercao();
create trigger controle_versao before update on retencao_estado for each row execute function controle_versao();
insert into retencao_estado (unica) values (true);

-- Uma linha por rodada; clientes = [{condominioId, itens: {CODIGO: n}, total, arquivos, erro}].
create table retencao_rodadas (
  id        bigint generated always as identity primary key,
  rodada_em timestamptz not null default app_now(),
  modo      text not null check (modo in ('CONTANDO', 'APAGANDO')),
  total     integer not null default 0 check (total >= 0),
  arquivos  integer not null default 0 check (arquivos >= 0),
  erros     integer not null default 0 check (erros >= 0),
  clientes  jsonb not null default '[]'::jsonb check (jsonb_typeof(clientes) = 'array')
);
call proteger_tabela_global('retencao_rodadas', 'Resumo de cada rodada da retenção, só com ids e totais, lido pelo Console (F0.11).');
create trigger retencao_rodadas_sem_alteracao before update or delete on retencao_rodadas for each row execute function somente_insercao();

-- A fila de arquivos (regra 4). Só caminhos; o arquivo some do armazenamento pela API.
create table arquivos_a_apagar (
  id          bigint generated always as identity primary key,
  bucket      text not null check (bucket in ('pedidos', 'manutencoes', 'comunicados', 'documentos', 'exportacoes', 'suporte', 'relatorios', 'portaria')),
  caminho     text not null check (length(caminho) between 3 and 500),
  origem      text not null check (origem ~ '^[A-Z][A-Z_]{1,39}$'),
  criado_em   timestamptz not null default app_now(),
  tentativas  integer not null default 0 check (tentativas between 0 and 50),
  apagado_em  timestamptz,
  erro        text check (length(erro) between 1 and 300),
  unique (bucket, caminho)
);
call proteger_tabela_global('arquivos_a_apagar', 'Fila de arquivos a apagar do armazenamento pela retenção; só caminhos, sem dado pessoal (F0.11).');
create trigger arquivos_a_apagar_sem_exclusao before delete on arquivos_a_apagar for each row execute function somente_insercao();

create function enfileirar_arquivo(p_bucket text, p_caminho text, p_origem text) returns integer
language sql
set search_path = public
as $$
  with novo as (insert into arquivos_a_apagar (bucket, caminho, origem) values (p_bucket, p_caminho, p_origem)
                on conflict (bucket, caminho) do nothing returning 1)
  select count(*)::integer from novo
$$;

-- ---------------------------------------------------------------------------------------
-- Guardar por obrigação legal (regra 5).

create table guardas_legais (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references condominios (id) on delete restrict,
  entidade        text not null check (entidade in ('PEDIDO', 'MANUTENCAO', 'ENCOMENDA', 'CONTATO')),
  alvo_id         uuid not null,
  motivo          text not null check (motivo in ('PROCESSO', 'SINISTRO', 'AUTORIDADE', 'OUTRO')),
  detalhe         text check (length(btrim(detalhe)) between 3 and 500),
  guardada_em     timestamptz not null default app_now(),
  guardada_por    uuid not null references pessoas (id),
  retirada_em     timestamptz,
  retirada_por    uuid references pessoas (id),
  motivo_retirada text check (length(btrim(motivo_retirada)) between 3 and 500),
  versao          integer not null default 1,
  check ((retirada_em is null) = (retirada_por is null) and (retirada_em is null) = (motivo_retirada is null)),
  check (motivo <> 'OUTRO' or detalhe is not null)
);
create unique index guardas_legais_ativa on guardas_legais (condominio_id, entidade, alvo_id) where retirada_em is null;
call proteger_tabela_condominio('guardas_legais');
create trigger guardas_legais_sem_exclusao before delete on guardas_legais for each row execute function somente_insercao();

create function guardas_legais_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.condominio_id, new.entidade, new.alvo_id, new.motivo, new.detalhe, new.guardada_em, new.guardada_por)
     is distinct from (old.condominio_id, old.entidade, old.alvo_id, old.motivo, old.detalhe, old.guardada_em, old.guardada_por)
     or old.retirada_em is not null then
    raise exception 'A guarda só pode ser retirada' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger guardas_legais_regras before update on guardas_legais for each row execute function guardas_legais_regras();

create function guardado(p_entidade text, p_alvo uuid) returns boolean
language sql stable
set search_path = public
as $$ select exists (select 1 from guardas_legais where entidade = p_entidade and alvo_id = p_alvo and retirada_em is null) $$;

-- A pessoa guardada, ou que aparece num pedido ou numa encomenda guardados, fica inteira: o
-- contato e o que é dela (mensagens, envios, reservas, anúncios, veículos).
create function contato_protegido(p_contato uuid) returns boolean
language sql stable
set search_path = public
as $$
  select p_contato is not null and (
    guardado('CONTATO', p_contato)
    or exists (select 1 from pedidos p join guardas_legais g on g.entidade = 'PEDIDO' and g.alvo_id = p.id and g.retirada_em is null
                where p.contato_id = p_contato)
    or exists (select 1 from encomendas e join guardas_legais g on g.entidade = 'ENCOMENDA' and g.alvo_id = e.id and g.retirada_em is null
                where e.retirou_contato = p_contato))
$$;

-- ---------------------------------------------------------------------------------------
-- A rotina passa pelas travas só dentro dela (regra 7).

create function retencao_ativa() returns boolean
language sql stable
set search_path = public
as $$ select current_setting('app.retencao', true) = 'on' and current_user = 'dominio' $$;

-- Refaz um gatilho com a condição de não valer durante a rotina.
create procedure liberar_para_retencao(p_tabela regclass, p_gatilho text)
language plpgsql
set search_path = public
as $$
declare v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def from pg_trigger t where t.tgrelid = p_tabela and t.tgname = p_gatilho and not t.tgisinternal;
  if v_def is null then raise exception 'Gatilho % não existe em %', p_gatilho, p_tabela; end if;
  if v_def ~ ' WHEN ' then raise exception 'Gatilho % já tem condição', p_gatilho; end if;
  execute format('drop trigger %I on %s', p_gatilho, p_tabela);
  execute replace(v_def, ' FOR EACH ROW EXECUTE ', ' FOR EACH ROW WHEN (NOT public.retencao_ativa()) EXECUTE ');
end $$;

call liberar_para_retencao('familiares_unidade', 'familiares_unidade_regras');
call liberar_para_retencao('pets_unidade', 'pets_unidade_regras');
call liberar_para_retencao('cadastros_link', 'cadastros_link_regras');
call liberar_para_retencao('mensagens_whatsapp', 'mensagens_whatsapp_regras');
call liberar_para_retencao('envios_whatsapp', 'envios_whatsapp_regras');
call liberar_para_retencao('envios_whatsapp', 'envios_whatsapp_regras_f66');
call liberar_para_retencao('envios_email', 'envios_email_regras');
call liberar_para_retencao('envios_email', 'envios_email_regras_f64');
call liberar_para_retencao('envios_email', 'envios_email_regras_f67');
call liberar_para_retencao('reservas', 'reservas_regras');
call liberar_para_retencao('encomendas', 'encomendas_regras');
call liberar_para_retencao('exportacoes', 'exportacoes_regras');
call liberar_para_retencao('arquivos_chamado', 'arquivos_chamado_regras');

-- Avisos vistos há mais de 12 meses saem de vez (o aviso não é registro de nada).
do $$
declare t text;
begin
  foreach t in array array['avisos', 'avisos_decisao', 'avisos_documento', 'avisos_email', 'avisos_manutencao', 'avisos_memoria',
                           'avisos_pedido_documento', 'avisos_prestador', 'avisos_reserva', 'avisos_triade', 'avisos_vida', 'avisos_whatsapp'] loop
    execute format('call liberar_para_retencao(%L, %L)', t, t || '_sem_exclusao');
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- Onde o dado apagado fica marcado.

alter table contatos add column dados_removidos_motivo text check (dados_removidos_motivo in ('PRAZO', 'PEDIDO', 'OUTRO'));
alter table contatos drop constraint contatos_check;
alter table contatos add constraint contatos_removidos_quem check (
  (dados_removidos_em is not null or (dados_removidos_por is null and dados_removidos_motivo is null))
  and (dados_removidos_em is null or dados_removidos_por is not null or dados_removidos_motivo = 'PRAZO'));

alter table familiares_unidade add column dados_apagados_em timestamptz, alter column nome drop not null;
alter table familiares_unidade add constraint familiares_apagados check ((nome is null) = (dados_apagados_em is not null));
alter table pets_unidade add column dados_apagados_em timestamptz, alter column nome drop not null;
alter table pets_unidade add constraint pets_apagados check ((nome is null) = (dados_apagados_em is not null));

alter table cadastros_link add column dados_apagados_em timestamptz;
alter table cadastros_link drop constraint cadastros_link_check4;
alter table cadastros_link add constraint cadastros_link_check4 check (estado = 'RECUSADO' or dados_apagados_em is not null or (nome is not null and telefone is not null));
alter table cadastros_link add constraint cadastros_link_apagados check (dados_apagados_em is null or (estado = 'APROVADO' and nome is null and telefone is null and email is null));

alter table mensagens_whatsapp add column apagada_em timestamptz, alter column telefone drop not null;
alter table mensagens_whatsapp drop constraint mensagens_whatsapp_check;
alter table mensagens_whatsapp add constraint mensagens_whatsapp_check check (texto is not null or midia_tipo is not null or tipo = 'OUTRO' or apagada_em is not null);
alter table mensagens_whatsapp add constraint mensagens_whatsapp_apagada check ((apagada_em is null) = (telefone is not null) and (apagada_em is null or (texto is null and midia_caminho is null)));

alter table transcricoes_ia add column apagada_em timestamptz;
alter table transcricoes_ia drop constraint transcricoes_ia_check;
alter table transcricoes_ia add constraint transcricoes_ia_check check (case when apagada_em is null then (estado = 'PRONTA') = (texto is not null) else texto is null end);

alter table envios_whatsapp add column dados_apagados_em timestamptz, alter column para drop not null, alter column texto drop not null;
alter table envios_whatsapp add constraint envios_whatsapp_apagados check (case when dados_apagados_em is null then para is not null and texto is not null
                                                                          else para is null and texto is null and texto_enviado is null end);
alter table envios_email add column dados_apagados_em timestamptz, alter column para drop not null;
alter table envios_email drop constraint envios_email_aviso_prestador;
alter table envios_email add constraint envios_email_aviso_prestador check (tipo <> 'PRESTADOR' or (prestador_id is not null and pedido_atendimento_id is not null
                                                                             and (corpo is not null or dados_apagados_em is not null)));
alter table envios_email add constraint envios_email_apagados check (case when dados_apagados_em is null then para is not null
                                                                      else para is null and corpo is null and recado is null end);

alter table pedidos_documento add column dados_apagados_em timestamptz, alter column email drop not null;
alter table pedidos_documento add constraint pedidos_documento_apagados check ((email is null) = (dados_apagados_em is not null));

alter table reservas add column dados_apagados_em timestamptz;
alter table reservas add constraint reservas_apagados check (dados_apagados_em is null or (contato_id is null and observacao is null));

alter table classificados add column apagado_em timestamptz, alter column texto drop not null;
alter table classificados add constraint classificados_apagado check ((texto is null) = (apagado_em is not null) and (apagado_em is null or foto_mensagem_id is null));

alter table encomendas add column dados_apagados_em timestamptz;
alter table encomendas drop constraint encomendas_check5;
alter table encomendas add constraint encomendas_check5 check ((estado = 'ENTREGUE') = (num_nonnulls(retirou_contato, retirou_nome, dados_apagados_em) >= 1)
                                                               and num_nonnulls(retirou_contato, retirou_nome) <= 1);
alter table encomendas add constraint encomendas_apagados check (dados_apagados_em is null or (retirou_nome is null and retirou_ligacao is null and outro_meio_com is null and observacao is null));
alter table fotos_encomenda add column apagada_em timestamptz;
alter table arquivos_chamado add column apagado_em timestamptz;
alter table exportacoes add column arquivos_apagados_em timestamptz;

-- ---------------------------------------------------------------------------------------
-- O que passou do prazo, numa data de referência (a de hoje para apagar, daqui a 30 dias para
-- mostrar o que vem). Lê só o condomínio do contexto.

create function retencao_candidatos(p_ref timestamptz) returns table (codigo text, tabela text, alvo text)
language sql stable
set search_path = public
as $$
  -- 3. Contato que saiu da última unidade há 180 dias, sem pedido aberto e sem guarda.
  select 'CONTATO', 'contatos', c.id::text from contatos c
   where c.dados_removidos_em is null
     and exists (select 1 from contatos_unidade cu where cu.contato_id = c.id)
     and not exists (select 1 from contatos_unidade cu where cu.contato_id = c.id and cu.estado <> 'ENCERRADO')
     and (select max(cu.encerrado_em) from contatos_unidade cu where cu.contato_id = c.id) < p_ref - interval '180 days'
     and not exists (select 1 from pedidos p where p.contato_id = c.id and p.estado not in ('ENCERRADO', 'CANCELADO'))
     and not contato_protegido(c.id)
  union all
  -- 4 e 5. Família e pets 90 dias depois de sair.
  select 'FAMILIA', 'familiares_unidade', f.id::text from familiares_unidade f
   where f.dados_apagados_em is null and f.saiu_em < p_ref - interval '90 days'
  union all
  select 'PET', 'pets_unidade', p.id::text from pets_unidade p
   where p.dados_apagados_em is null and p.saiu_em < p_ref - interval '90 days'
  union all
  -- 6. Veículo retirado há 90 dias.
  select 'VEICULO', 'veiculos', v.id::text from veiculos v
   where v.retirado_em < p_ref - interval '90 days' and (v.placa is not null or v.modelo is not null) and not contato_protegido(v.contato_id)
  union all
  -- 7. Cópia do cadastro por link aprovado há 30 dias.
  select 'CADASTRO_LINK', 'cadastros_link', l.id::text from cadastros_link l
   where l.estado = 'APROVADO' and l.dados_apagados_em is null and l.decidido_em < p_ref - interval '30 days'
  union all
  -- 11. Mensagem que não virou pedido, 90 dias depois de chegar (a do classificado segue o classificado).
  select 'MENSAGEM', 'mensagens_whatsapp', m.id::text from mensagens_whatsapp m
   where m.apagada_em is null and m.pedido_id is null and m.recebida_em < p_ref - interval '90 days'
     and not exists (select 1 from classificados k where k.foto_mensagem_id = m.id) and not contato_protegido(m.contato_id)
  union all
  -- 12. Conversa parada há 30 dias.
  select 'CONVERSA', 'conversas_whatsapp', w.id::text from conversas_whatsapp w
   where w.atualizada_em < p_ref - interval '30 days'
  union all
  -- 14. Envios de 12 meses atrás que já saíram da fila.
  select 'ENVIO', 'envios_whatsapp', e.id::text from envios_whatsapp e
   where e.dados_apagados_em is null and e.criado_em < p_ref - interval '12 months' and e.estado not in ('NA_FILA', 'ENVIANDO')
     and (e.encomenda_id is null or not guardado('ENCOMENDA', e.encomenda_id))
     and (e.pedido_id is null or not guardado('PEDIDO', e.pedido_id)) and not contato_protegido(e.contato_id)
  union all
  select 'ENVIO', 'envios_email', e.id::text from envios_email e
   where e.dados_apagados_em is null and e.criado_em < p_ref - interval '12 months' and e.estado not in ('NA_FILA', 'ENVIANDO')
     and (e.pedido_id is null or not guardado('PEDIDO', e.pedido_id))
     and (e.pedido_atendimento_id is null or not guardado('PEDIDO', e.pedido_atendimento_id)) and not contato_protegido(e.contato_id)
  union all
  -- 15. Avisos vistos há 12 meses.
  select 'AVISO', 'avisos', a.id::text from avisos a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_decisao', a.id::text from avisos_decisao a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_documento', a.id::text from avisos_documento a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_email', a.id::text from avisos_email a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_manutencao', a.id::text from avisos_manutencao a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_memoria', a.id::text from avisos_memoria a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_pedido_documento', a.id::text from avisos_pedido_documento a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_prestador', a.id::text from avisos_prestador a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_reserva', a.id::text from avisos_reserva a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_triade', a.id::text from avisos_triade a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_vida', a.id::text from avisos_vida a where a.visto_em < p_ref - interval '12 months'
  union all select 'AVISO', 'avisos_whatsapp', a.id::text from avisos_whatsapp a where a.visto_em < p_ref - interval '12 months'
  union all
  -- 18. E-mail de quem pediu documento, 12 meses depois.
  select 'PEDIDO_DOCUMENTO', 'pedidos_documento', d.id::text from pedidos_documento d
   where d.dados_apagados_em is null and d.estado <> 'ESPERANDO' and d.criado_em < p_ref - interval '12 months'
  union all
  -- 19. Reserva de 24 meses atrás: fica a unidade e a data.
  select 'RESERVA', 'reservas', r.id::text from reservas r
   where r.dados_apagados_em is null and r.data < (p_ref - interval '24 months')::date and not contato_protegido(r.contato_id)
  union all
  -- 21. Classificado fora do mural há 90 dias.
  select 'CLASSIFICADO', 'classificados', k.id::text from classificados k
   where k.apagado_em is null and not contato_protegido(k.contato_id)
     and case k.estado when 'RETIRADO' then k.retirado_em
                       when 'RECUSADO' then k.decidido_em
                       when 'NO_MURAL' then (k.no_mural_ate + 1)::timestamptz
                       else null end < p_ref - interval '90 days'
  union all
  -- 22. Encomenda: a foto 90 dias depois de entregue, os nomes 12 meses depois.
  select 'ENCOMENDA', 'fotos_encomenda', f.id::text from fotos_encomenda f join encomendas e on e.id = f.encomenda_id
   where f.apagada_em is null and f.situacao = 'LIBERADO' and e.entregue_em < p_ref - interval '90 days' and not guardado('ENCOMENDA', e.id)
  union all
  select 'ENCOMENDA', 'encomendas', e.id::text from encomendas e
   where e.dados_apagados_em is null and e.entregue_em < p_ref - interval '12 months' and not guardado('ENCOMENDA', e.id)
  union all
  -- 24. Imagens de chamado 24 meses depois de resolvido.
  select 'CHAMADO', 'arquivos_chamado', a.id::text from arquivos_chamado a join chamados ch on ch.id = a.chamado_id
   where a.apagado_em is null and a.situacao = 'LIBERADO' and ch.resolvido_em < p_ref - interval '24 months'
  union all
  -- 25. Exportação vencida (7 dias).
  select 'EXPORTACAO', 'exportacoes', x.id::text from exportacoes x
   where x.arquivos_apagados_em is null and x.expira_em < p_ref
  union all
  -- 26. Links e códigos vencidos ou revogados há 90 dias.
  select 'LINK', 'links_publicos', encode(l.hash, 'hex') from links_publicos l
   where l.condominio_id = contexto_condominio() and coalesce(l.revogado_em, l.expira_em) < p_ref - interval '90 days'
  union all
  select 'LINK', 'codigos_sem_conta', encode(c.hash, 'hex') from codigos_sem_conta c
   where c.condominio_id = contexto_condominio() and c.revogado_em < p_ref - interval '90 days'
$$;

-- ---------------------------------------------------------------------------------------
-- Apagar os dados de um contato (regra 6 e a regra do prazo). Devolve quantos arquivos foram
-- para a fila. Quem chama confere as condições.

create function apagar_mensagem(p_id uuid) returns integer
language plpgsql
set search_path = public
as $$
declare m mensagens_whatsapp; v_arquivos integer := 0;
begin
  select * into m from mensagens_whatsapp where id = p_id;
  if m.id is null or m.apagada_em is not null then return 0; end if;
  if m.midia_caminho is not null then v_arquivos := enfileirar_arquivo('pedidos', m.midia_caminho, 'MENSAGEM'); end if;
  update transcricoes_ia set texto = null, apagada_em = app_now() where mensagem_id = p_id and apagada_em is null;
  update mensagens_whatsapp
     set texto = null, telefone = null, apagada_em = app_now(),
         midia_url = null, midia_nome = null, midia_caminho = null, midia_tamanho = null,
         midia_situacao = case when midia_situacao is null then null else 'RECUSADA' end,
         midia_motivo = case when midia_situacao is null then midia_motivo else 'Apagada pelo prazo' end,
         triagem = case when triagem in ('CONVERSA', 'A_IDENTIFICAR', 'RECADO') then 'ARQUIVADA' else triagem end,
         triagem_motivo = case when triagem in ('CONVERSA', 'A_IDENTIFICAR', 'RECADO') then 'Apagada pelo prazo' else triagem_motivo end,
         tratada_em = coalesce(tratada_em, app_now())
   where id = p_id;
  return v_arquivos;
end $$;

create function apagar_envio_whatsapp(p_id uuid) returns void
language sql
set search_path = public
as $$
  update envios_whatsapp set para = null, texto = null, texto_enviado = null,
         modelo_parametros = case when modelo_parametros is null then null else '[]'::jsonb end, dados_apagados_em = app_now()
   where id = p_id and dados_apagados_em is null
$$;

create function apagar_envio_email(p_id uuid) returns void
language sql
set search_path = public
as $$
  update envios_email set para = null, corpo = null, recado = null, dados_apagados_em = app_now()
   where id = p_id and dados_apagados_em is null
$$;

create function apagar_dados_contato(p_contato uuid, p_autor uuid, p_motivo text) returns integer
language plpgsql
set search_path = public
as $$
declare r record; v_arquivos integer := 0;
begin
  update envios_email set estado = 'CANCELADO', motivo = 'Os dados do contato foram removidos' where contato_id = p_contato and estado = 'NA_FILA';
  update envios_whatsapp set estado = 'CANCELADA', motivo = 'Os dados do contato foram removidos' where contato_id = p_contato and estado = 'NA_FILA';
  update contatos set nome = null, telefone = null, email = null, email_situacao = null, email_confirmado_em = null,
                      email_parou_motivo = null, comunicados_whatsapp = null, comunicados_whatsapp_em = null,
                      comunicados_whatsapp_origem = null, comunicados_whatsapp_perguntado_em = null,
                      dados_removidos_em = app_now(), dados_removidos_por = p_autor, dados_removidos_motivo = p_motivo
   where id = p_contato and dados_removidos_em is null;
  -- O que é dele e não é registro de um pedido: mensagens soltas, envios, anúncios.
  for r in select id from mensagens_whatsapp where contato_id = p_contato and pedido_id is null and apagada_em is null
              and not exists (select 1 from classificados k where k.foto_mensagem_id = mensagens_whatsapp.id and k.apagado_em is null) loop
    v_arquivos := v_arquivos + apagar_mensagem(r.id);
  end loop;
  for r in select id from envios_whatsapp where contato_id = p_contato and dados_apagados_em is null and estado not in ('NA_FILA', 'ENVIANDO')
              and (pedido_id is null or not guardado('PEDIDO', pedido_id)) loop
    perform apagar_envio_whatsapp(r.id);
  end loop;
  for r in select id from envios_email where contato_id = p_contato and dados_apagados_em is null and estado not in ('NA_FILA', 'ENVIANDO')
              and (pedido_id is null or not guardado('PEDIDO', pedido_id)) loop
    perform apagar_envio_email(r.id);
  end loop;
  for r in select id from classificados where contato_id = p_contato and apagado_em is null loop
    v_arquivos := v_arquivos + apagar_classificado(r.id);
  end loop;
  update reservas set observacao = null where contato_id = p_contato and observacao is not null;
  return v_arquivos;
end $$;

create function apagar_classificado(p_id uuid) returns integer
language plpgsql
set search_path = public
as $$
declare v_mensagem uuid; v_arquivos integer := 0;
begin
  select foto_mensagem_id into v_mensagem from classificados where id = p_id and apagado_em is null;
  if not found then return 0; end if;
  update classificados set texto = null, foto_mensagem_id = null, mostrar_telefone = false, apagado_em = app_now() where id = p_id;
  if v_mensagem is not null then v_arquivos := apagar_mensagem(v_mensagem); end if;
  return v_arquivos;
end $$;

-- Aplica um item do candidatos. Devolve quantos arquivos foram para a fila.
create function retencao_aplicar_item(p_tabela text, p_alvo text) returns integer
language plpgsql
set search_path = public
as $$
declare v_caminho text; v_arquivos integer := 0; r record;
begin
  case p_tabela
  when 'contatos' then
    v_arquivos := apagar_dados_contato(p_alvo::uuid, null, 'PRAZO');
  when 'familiares_unidade' then
    update familiares_unidade set nome = null, aniversario_dia = null, aniversario_mes = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'pets_unidade' then
    update pets_unidade set nome = null, raca = null, observacao = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'veiculos' then
    update veiculos set placa = null, modelo = null where id = p_alvo::uuid;
  when 'cadastros_link' then
    update cadastros_link set nome = null, telefone = null, ligacao = null, email = null, aniversario_dia = null, aniversario_mes = null,
                              familia = '[]', pets = '[]', veiculos = '[]', dados_apagados_em = app_now()
     where id = p_alvo::uuid;
  when 'mensagens_whatsapp' then
    v_arquivos := apagar_mensagem(p_alvo::uuid);
  when 'conversas_whatsapp' then
    delete from conversas_whatsapp where id = p_alvo::uuid;
  when 'envios_whatsapp' then
    perform apagar_envio_whatsapp(p_alvo::uuid);
  when 'envios_email' then
    perform apagar_envio_email(p_alvo::uuid);
  when 'pedidos_documento' then
    update pedidos_documento set email = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'reservas' then
    update reservas set contato_id = null, observacao = null, dados_apagados_em = app_now() where id = p_alvo::uuid;
  when 'classificados' then
    v_arquivos := apagar_classificado(p_alvo::uuid);
  when 'fotos_encomenda' then
    select caminho into v_caminho from fotos_encomenda where id = p_alvo::uuid;
    v_arquivos := enfileirar_arquivo('portaria', v_caminho, 'ENCOMENDA');
    update fotos_encomenda set situacao = 'NAO_LIBERADO', tamanho = null, motivo_recusa = 'Apagada pelo prazo', apagada_em = app_now()
     where id = p_alvo::uuid;
  when 'encomendas' then
    update encomendas set retirou_nome = null, retirou_ligacao = null, outro_meio_com = null, observacao = null, dados_apagados_em = app_now()
     where id = p_alvo::uuid;
  when 'arquivos_chamado' then
    select caminho into v_caminho from arquivos_chamado where id = p_alvo::uuid;
    v_arquivos := enfileirar_arquivo('suporte', v_caminho, 'CHAMADO');
    update arquivos_chamado set situacao = 'NAO_LIBERADO', tamanho = null, motivo_recusa = 'Apagada pelo prazo', apagado_em = app_now()
     where id = p_alvo::uuid;
  when 'exportacoes' then
    for r in select caminho from partes_exportacao where exportacao_id = p_alvo::uuid and caminho is not null loop
      v_arquivos := v_arquivos + enfileirar_arquivo('exportacoes', r.caminho, 'EXPORTACAO');
    end loop;
    update exportacoes set arquivos_apagados_em = app_now() where id = p_alvo::uuid;
  when 'links_publicos' then
    delete from links_publicos where hash = decode(p_alvo, 'hex');
  when 'codigos_sem_conta' then
    delete from codigos_sem_conta where hash = decode(p_alvo, 'hex');
  else
    if p_tabela like 'avisos%' then
      execute format('delete from %I where id = $1::uuid', p_tabela) using p_alvo;
    else
      raise exception 'Tabela sem regra de retenção: %', p_tabela;
    end if;
  end case;
  return v_arquivos;
end $$;

-- Uma rodada num condomínio (o do contexto). Devolve {itens: {CODIGO: n}, total, arquivos}.
create function retencao_no_condominio(p_apagar boolean) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_itens jsonb := '{}'::jsonb;
  v_total integer := 0;
  v_arquivos integer := 0;
begin
  for r in select c.codigo, c.tabela, c.alvo from retencao_candidatos(app_now()) c order by c.codigo, c.tabela, c.alvo loop
    v_itens := jsonb_set(v_itens, array[r.codigo], to_jsonb(coalesce((v_itens ->> r.codigo)::integer, 0) + 1));
    v_total := v_total + 1;
    if p_apagar then
      v_arquivos := v_arquivos + retencao_aplicar_item(r.tabela, r.alvo);
    end if;
  end loop;
  return jsonb_build_object('itens', v_itens, 'total', v_total, 'arquivos', v_arquivos);
end $$;

-- A rotina de toda madrugada (regra 3).
create function aplicar_retencao() returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_modo text;
  v_res jsonb;
  v_clientes jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_arquivos integer := 0;
  v_erros integer := 0;
  v_id bigint;
begin
  select modo into v_modo from retencao_estado;
  perform set_config('app.verificador', 'on', true);
  perform set_config('app.retencao', 'on', true);
  for r in select id from condominios order by id loop
    perform entrar_como_sistema(r.id);
    begin
      v_res := retencao_no_condominio(v_modo = 'APAGANDO');
      if (v_res ->> 'total')::integer > 0 then
        perform registrar_historico('retencao.rodada', 'condominio', r.id::text,
                                    jsonb_build_object('modo', v_modo, 'itens', v_res -> 'itens', 'total', v_res -> 'total', 'arquivos', v_res -> 'arquivos'));
      end if;
      v_total := v_total + (v_res ->> 'total')::integer;
      v_arquivos := v_arquivos + (v_res ->> 'arquivos')::integer;
      v_clientes := v_clientes || jsonb_build_array(jsonb_build_object('condominioId', r.id) || v_res);
    exception when others then
      v_erros := v_erros + 1;
      v_clientes := v_clientes || jsonb_build_array(jsonb_build_object('condominioId', r.id, 'itens', '{}'::jsonb, 'total', 0, 'arquivos', 0,
                                                                        'erro', left(sqlerrm, 300)));
      raise warning 'Retenção do condomínio % não aplicada: %', r.id, sqlerrm;
    end;
  end loop;
  perform entrar_como_sistema(null);
  perform set_config('app.retencao', '', true);
  perform set_config('app.verificador', '', true);
  insert into retencao_rodadas (modo, total, arquivos, erros, clientes) values (v_modo, v_total, v_arquivos, v_erros, v_clientes)
  returning id into v_id;
  return v_id;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('aplicar-retencao', '10 6 * * *', 'select public.aplicar_retencao()');
exception when others then
  raise notice 'pg_cron indisponível: agende aplicar_retencao() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- A fila de arquivos para a api-plataforma (regra 4).

create function retencao_arquivos_pendentes(p_limite integer) returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'bucket', a.bucket, 'caminho', a.caminho) order by a.id), '[]'::jsonb)
    from (select * from arquivos_a_apagar where apagado_em is null and tentativas < 5 order by tentativas, id limit least(greatest(coalesce(p_limite, 50), 1), 200)) a
$$;

create function retencao_arquivo_resultado(p_id bigint, p_erro text) returns void
language sql
security definer
set search_path = public
as $$
  update arquivos_a_apagar
     set apagado_em = case when p_erro is null then app_now() end,
         tentativas = tentativas + 1,
         erro = left(nullif(btrim(p_erro), ''), 300)
   where id = p_id and apagado_em is null
$$;

create function chamar_retencao_arquivos() returns boolean
language plpgsql
set search_path = public
as $$
declare v_url text; v_segredo text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return false; end if;
  if not exists (select 1 from arquivos_a_apagar where apagado_em is null and tentativas < 5) then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'api_plataforma_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_segredo using 'repasse_segredo';
  if v_url is null or v_segredo is null then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using rtrim(v_url, '/') || '/v1/interno/retencao-arquivos', '{}'::jsonb,
          jsonb_build_object('content-type', 'application/json', 'x-repasse-segredo', v_segredo);
  return true;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('apagar-arquivos-retencao', '*/15 6-8 * * *', 'select public.chamar_retencao_arquivos()');
exception when others then
  raise notice 'pg_cron indisponível: agende chamar_retencao_arquivos() de outro jeito (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------------------
-- Plataforma · Privacidade e dados (quadros 350 e 351).

-- O fuso do condomínio do contexto, para as datas escritas por extenso.
create function fuso_do_condominio() returns text
language sql stable
set search_path = public
as $$ select coalesce((select fuso from configuracao_condominio where condominio_id = contexto_condominio()), 'America/Sao_Paulo') $$;

create function rotulo_guarda(g guardas_legais) returns jsonb
language sql stable
set search_path = public
as $$
  select case g.entidade
    when 'PEDIDO' then (select jsonb_build_object('titulo', 'Pedido ' || p.protocolo, 'detalhe', p.assunto) from pedidos p where p.id = g.alvo_id)
    when 'MANUTENCAO' then (select jsonb_build_object('titulo', 'Manutenção', 'detalhe', m.titulo) from manutencoes m where m.id = g.alvo_id)
    when 'ENCOMENDA' then (select jsonb_build_object('titulo', 'Encomenda de ' || to_char(e.guardada_em at time zone fuso_do_condominio(), 'DD/MM/YYYY'),
                                                     'detalhe', rotulo_unidade(e.unidade_id)) from encomendas e where e.id = g.alvo_id)
    when 'CONTATO' then (select jsonb_build_object('titulo', coalesce(c.nome, 'Contato removido'), 'detalhe', 'Pessoa') from contatos c where c.id = g.alvo_id)
  end
$$;

create function guarda_json(g guardas_legais) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('id', g.id, 'entidade', g.entidade, 'alvoId', g.alvo_id, 'motivo', g.motivo, 'detalhe', g.detalhe,
                            'guardadaEm', g.guardada_em, 'guardadaPor', nome_pessoa(g.guardada_por), 'versao', g.versao)
         || coalesce(rotulo_guarda(g), '{}'::jsonb)
$$;

create function plataforma_privacidade(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultima jsonb;
  v_agora integer;
  v_daqui integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.ver');
  select jsonb_build_object('em', h.ocorrido_em, 'modo', h.dados ->> 'modo', 'total', (h.dados ->> 'total')::integer)
    into v_ultima
    from historico h where h.acao = 'retencao.rodada' order by h.ocorrido_em desc, h.id desc limit 1;
  select count(*) into v_agora from retencao_candidatos(app_now());
  select count(*) into v_daqui from retencao_candidatos(app_now() + interval '30 days');
  return jsonb_build_object(
    'modo', (select modo from retencao_estado),
    'ultimaRodada', coalesce(v_ultima, (select jsonb_build_object('em', rodada_em, 'modo', modo, 'total', 0) from retencao_rodadas order by id desc limit 1)),
    'vencidos', v_agora,
    'proximos30', greatest(v_daqui - v_agora, 0),
    'podeCuidar', pode(p_pessoa, p_condominio, 'privacidade.cuidar'),
    'guardados', (select coalesce(jsonb_agg(guarda_json(g) order by g.guardada_em desc), '[]'::jsonb) from guardas_legais g where g.retirada_em is null),
    'tipos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'numero', t.numero, 'grupo', t.grupo, 'nome', t.nome, 'oQue', t.o_que,
                                                  'paraQue', t.para_que, 'base', t.base, 'prazo', t.prazo, 'noFim', t.no_fim, 'situacao', t.situacao)
                                order by t.numero)
                from retencao_tipos t where t.sistema = 'PLATAFORMA'));
end $$;

-- Guardar e tirar a guarda (quadro 355).
create function plataforma_guardar(p_pessoa uuid, p_condominio uuid, p_entidade text, p_alvo uuid, p_motivo text, p_detalhe text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g guardas_legais; v_existe boolean;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.cuidar');
  if p_entidade not in ('PEDIDO', 'MANUTENCAO', 'ENCOMENDA', 'CONTATO') then perform recusar_campos('O que guardar', 'entidade'); end if;
  if p_motivo is null or p_motivo not in ('PROCESSO', 'SINISTRO', 'AUTORIDADE', 'OUTRO') then perform recusar_campos('Escolha o motivo', 'motivo'); end if;
  if (p_motivo = 'OUTRO' and length(btrim(coalesce(p_detalhe, ''))) < 3) or length(btrim(coalesce(p_detalhe, ''))) > 500
     or (p_detalhe is not null and length(btrim(p_detalhe)) between 1 and 2) then
    perform recusar_campos('Detalhe de 3 a 500 letras', 'detalhe');
  end if;
  v_existe := case p_entidade
                when 'PEDIDO' then exists (select 1 from pedidos where id = p_alvo)
                when 'MANUTENCAO' then exists (select 1 from manutencoes where id = p_alvo)
                when 'ENCOMENDA' then exists (select 1 from encomendas where id = p_alvo)
                else exists (select 1 from contatos where id = p_alvo and dados_removidos_em is null) end;
  if not v_existe then raise exception 'Não encontrado' using errcode = 'TC404'; end if;
  if guardado(p_entidade, p_alvo) then perform recusar_motivo('Já está guardado', 'JA_GUARDADO'); end if;
  insert into guardas_legais (condominio_id, entidade, alvo_id, motivo, detalhe, guardada_por)
  values (p_condominio, p_entidade, p_alvo, p_motivo, nullif(btrim(p_detalhe), ''), p_pessoa)
  returning * into g;
  perform registrar_historico('privacidade.guardado', lower(p_entidade), p_alvo::text, jsonb_build_object('motivo', p_motivo, 'guarda', g.id));
  return guarda_json(g);
end $$;

create function plataforma_tirar_guarda(p_pessoa uuid, p_condominio uuid, p_guarda uuid, p_versao integer, p_motivo text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare g guardas_legais;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.cuidar');
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then perform recusar_campos('Motivo de 3 a 500 letras', 'motivo'); end if;
  select * into g from guardas_legais where id = p_guarda;
  if g.id is null then raise exception 'Guarda não encontrada' using errcode = 'TC404'; end if;
  if g.retirada_em is not null then perform recusar_motivo('A guarda já foi retirada', 'GUARDA_RETIRADA'); end if;
  update guardas_legais set retirada_em = app_now(), retirada_por = p_pessoa, motivo_retirada = btrim(p_motivo)
   where id = p_guarda and versao = p_versao returning * into g;
  if g.retirada_em is null then perform conflito_versao('guardas_legais', p_guarda); end if;
  perform registrar_historico('privacidade.guarda_retirada', lower(g.entidade), g.alvo_id::text, jsonb_build_object('guarda', g.id));
end $$;

-- A guarda de um item, para o selo na ficha (null quando não está guardado).
create function plataforma_guarda(p_pessoa uuid, p_condominio uuid, p_entidade text, p_alvo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.ver');
  return (select guarda_json(g) from guardas_legais g where g.entidade = p_entidade and g.alvo_id = p_alvo and g.retirada_em is null);
end $$;

-- ---------------------------------------------------------------------------------------
-- Dados de uma pessoa (quadros 352 a 354).

-- A data em que o prazo apaga sozinho (null enquanto mora, tem pedido aberto ou está guardado).
create function contato_apaga_em(p_contato uuid) returns timestamptz
language sql stable
set search_path = public
as $$
  select case
    when not exists (select 1 from contatos_unidade cu where cu.contato_id = p_contato) then null
    when exists (select 1 from contatos_unidade cu where cu.contato_id = p_contato and cu.estado <> 'ENCERRADO') then null
    when exists (select 1 from pedidos p where p.contato_id = p_contato and p.estado not in ('ENCERRADO', 'CANCELADO')) then null
    when contato_protegido(p_contato) then null
    else (select max(cu.encerrado_em) from contatos_unidade cu where cu.contato_id = p_contato) + interval '180 days' end
$$;

create function dados_pessoa_json(p_contato uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'contato', jsonb_build_object('id', c.id, 'nome', c.nome, 'telefone', c.telefone, 'email', c.email,
                                  'aniversarioDia', c.aniversario_dia, 'aniversarioMes', c.aniversario_mes, 'versao', c.versao),
    'situacao', jsonb_build_object(
      'mora', exists (select 1 from contatos_unidade cu where cu.contato_id = c.id and cu.estado <> 'ENCERRADO'),
      'pedidoAberto', (select p.protocolo from pedidos p where p.contato_id = c.id and p.estado not in ('ENCERRADO', 'CANCELADO') order by p.criado_em limit 1),
      'guarda', (select guarda_json(g) from guardas_legais g where g.entidade = 'CONTATO' and g.alvo_id = c.id and g.retirada_em is null),
      'saiuEm', (select max(cu.encerrado_em) from contatos_unidade cu where cu.contato_id = c.id
                  having bool_and(cu.estado = 'ENCERRADO')),
      'apagaEm', contato_apaga_em(c.id)),
    'onde', jsonb_build_array(
      jsonb_build_object('parte', 'UNIDADES', 'quantos', (select count(*) from contatos_unidade cu where cu.contato_id = c.id),
                         'ativos', (select count(*) from contatos_unidade cu where cu.contato_id = c.id and cu.estado <> 'ENCERRADO'),
                         'itens', (select coalesce(jsonb_agg(jsonb_build_object('unidade', rotulo_unidade(cu.unidade_id), 'estado', cu.estado,
                                                                                 'relacao', cu.relacao, 'desde', cu.criado_em, 'saiuEm', cu.encerrado_em)
                                                             order by cu.criado_em), '[]'::jsonb)
                                     from contatos_unidade cu where cu.contato_id = c.id)),
      jsonb_build_object('parte', 'PEDIDOS', 'quantos', (select count(*) from pedidos p where p.contato_id = c.id),
                         'abertos', (select count(*) from pedidos p where p.contato_id = c.id and p.estado not in ('ENCERRADO', 'CANCELADO'))),
      jsonb_build_object('parte', 'MENSAGENS', 'quantos', (select count(*) from mensagens_whatsapp m where m.contato_id = c.id and m.apagada_em is null),
                         'semPedido', (select count(*) from mensagens_whatsapp m where m.contato_id = c.id and m.apagada_em is null and m.pedido_id is null)),
      jsonb_build_object('parte', 'ENVIOS', 'quantos', (select count(*) from envios_whatsapp e where e.contato_id = c.id and e.dados_apagados_em is null)
                                                        + (select count(*) from envios_email e where e.contato_id = c.id and e.dados_apagados_em is null)),
      jsonb_build_object('parte', 'RESERVAS', 'quantos', (select count(*) from reservas r where r.contato_id = c.id)),
      jsonb_build_object('parte', 'ENCOMENDAS', 'quantos', (select count(*) from encomendas e where e.retirou_contato = c.id)),
      jsonb_build_object('parte', 'ENQUETES', 'quantos', (select count(*) from convites_enquete ce where ce.contato_id = c.id and ce.respondeu_em is not null)),
      jsonb_build_object('parte', 'CLASSIFICADOS', 'quantos', (select count(*) from classificados k where k.contato_id = c.id and k.apagado_em is null)),
      jsonb_build_object('parte', 'VEICULOS', 'quantos', (select count(*) from veiculos v where v.contato_id = c.id and v.placa is not null),
                         'itens', (select coalesce(jsonb_agg(jsonb_build_object('placa', v.placa, 'modelo', v.modelo, 'retiradoEm', v.retirado_em) order by v.criado_em), '[]'::jsonb)
                                     from veiculos v where v.contato_id = c.id and v.placa is not null))))
    from contatos c where c.id = p_contato
$$;

-- Busca pelo telefone (com ou sem o nono dígito) ou pelo e-mail. Fica no histórico.
create function plataforma_dados_pessoa(p_pessoa uuid, p_condominio uuid, p_busca text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_ids uuid[];
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.cuidar');
  if telefone_valido(v_busca) then
    select coalesce(array_agg(c.id order by c.criado_em), '{}') into v_ids
      from contatos c where c.telefone = any (variantes_telefone(v_busca)) and c.dados_removidos_em is null;
  elsif email_valido(v_busca) then
    select coalesce(array_agg(c.id order by c.criado_em), '{}') into v_ids
      from contatos c where lower(c.email) = lower(v_busca) and c.dados_removidos_em is null;
  else
    perform recusar_campos('Telefone com DDD ou e-mail', 'busca');
  end if;
  perform registrar_historico('privacidade.busca', 'condominio', p_condominio::text,
                              jsonb_build_object('por', case when telefone_valido(v_busca) then 'TELEFONE' else 'EMAIL' end,
                                                 'achados', coalesce(array_length(v_ids, 1), 0)));
  return jsonb_build_object('pessoas', (select coalesce(jsonb_agg(dados_pessoa_json(i) order by n), '[]'::jsonb)
                                          from unnest(v_ids) with ordinality u(i, n)));
end $$;

-- Tudo de uma pessoa, para a planilha (Baixar tudo). Fica no histórico.
create function plataforma_dados_pessoa_exportar(p_pessoa uuid, p_condominio uuid, p_contato uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c contatos; v_fuso text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.cuidar');
  select * into c from contatos where id = p_contato and dados_removidos_em is null;
  if c.id is null then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  v_fuso := fuso_do_condominio();
  perform registrar_historico('privacidade.exportada', 'contato', p_contato::text);
  return jsonb_build_object(
    'geradoEm', app_now(),
    'linhas',
      jsonb_build_array(jsonb_build_object('parte', 'Cadastro', 'quando', c.criado_em, 'o_que',
                                           concat_ws(' · ', c.nome, c.telefone, c.email,
                                                     case when c.aniversario_dia is not null then 'aniversário ' || lpad(c.aniversario_dia::text, 2, '0') || '/' || lpad(c.aniversario_mes::text, 2, '0') end)))
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Unidade', 'quando', cu.criado_em,
                                                       'o_que', concat_ws(' · ', rotulo_unidade(cu.unidade_id), cu.relacao, cu.estado,
                                                                          case when cu.encerrado_em is not null then 'saiu em ' || to_char(cu.encerrado_em at time zone v_fuso, 'DD/MM/YYYY') end))
                                    order by cu.criado_em)
                     from contatos_unidade cu where cu.contato_id = c.id), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Pedido', 'quando', p.criado_em, 'o_que', concat_ws(' · ', p.protocolo, p.assunto, p.estado))
                                    order by p.criado_em)
                     from pedidos p where p.contato_id = c.id), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Mensagem de WhatsApp', 'quando', m.recebida_em,
                                                       'o_que', coalesce(m.texto, case when m.midia_tipo is not null then 'Arquivo ' || m.midia_tipo end, m.tipo))
                                    order by m.recebida_em)
                     from mensagens_whatsapp m where m.contato_id = c.id and m.apagada_em is null), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Envio de WhatsApp', 'quando', e.criado_em, 'o_que', coalesce(e.texto_enviado, e.texto))
                                    order by e.criado_em)
                     from envios_whatsapp e where e.contato_id = c.id and e.dados_apagados_em is null), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Envio de e-mail', 'quando', e.criado_em, 'o_que', concat_ws(' · ', e.tipo, e.para))
                                    order by e.criado_em)
                     from envios_email e where e.contato_id = c.id and e.dados_apagados_em is null), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Reserva', 'quando', r.criado_em,
                                                       'o_que', concat_ws(' · ', r.protocolo, to_char(r.data, 'DD/MM/YYYY'), r.estado, r.observacao))
                                    order by r.criado_em)
                     from reservas r where r.contato_id = c.id), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Encomenda retirada', 'quando', e.entregue_em, 'o_que', concat_ws(' · ', e.remetente, rotulo_unidade(e.unidade_id)))
                                    order by e.entregue_em)
                     from encomendas e where e.retirou_contato = c.id), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Classificado', 'quando', k.criado_em, 'o_que', concat_ws(' · ', k.tipo, k.titulo, k.texto))
                                    order by k.criado_em)
                     from classificados k where k.contato_id = c.id and k.apagado_em is null), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('parte', 'Veículo', 'quando', v.criado_em, 'o_que', concat_ws(' · ', v.tipo, v.placa, v.modelo))
                                    order by v.criado_em)
                     from veiculos v where v.contato_id = c.id and v.placa is not null), '[]'::jsonb));
end $$;

-- Remover os dados agora (quadro 354): só de quem não mora, sem pedido aberto e sem guarda.
create function plataforma_remover_dados_pessoa(p_pessoa uuid, p_condominio uuid, p_contato uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c contatos; v_arquivos integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'privacidade.cuidar');
  if p_motivo is null or p_motivo not in ('PEDIDO', 'OUTRO') then perform recusar_campos('Escolha o motivo', 'motivo'); end if;
  select * into c from contatos where id = p_contato;
  if c.id is null or c.dados_removidos_em is not null then raise exception 'Contato não encontrado' using errcode = 'TC404'; end if;
  if c.versao is distinct from p_versao then perform conflito_versao('contatos', p_contato); end if;
  if exists (select 1 from contatos_unidade where contato_id = p_contato and estado <> 'ENCERRADO') then
    perform recusar_motivo('Encerre os vínculos do contato antes de remover os dados', 'CONTATO_COM_UNIDADE');
  end if;
  if exists (select 1 from pedidos where contato_id = p_contato and estado not in ('ENCERRADO', 'CANCELADO')) then
    perform recusar_motivo('Há pedido aberto desta pessoa', 'CONTATO_COM_PEDIDO_ABERTO');
  end if;
  if contato_protegido(p_contato) then perform recusar_motivo('Esta pessoa, ou um pedido ou uma encomenda dela, está guardada por obrigação legal', 'CONTATO_GUARDADO'); end if;
  perform set_config('app.retencao', 'on', true);
  v_arquivos := apagar_dados_contato(p_contato, p_pessoa, p_motivo);
  perform set_config('app.retencao', '', true);
  perform registrar_historico('contato.dados_removidos', 'contato', p_contato::text, jsonb_build_object('motivo', p_motivo, 'arquivos', v_arquivos));
  return jsonb_build_object('arquivos', v_arquivos);
end $$;

-- ---------------------------------------------------------------------------------------
-- Console · Retenção de dados (quadros 356 a 358).

create function console_retencao(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e retencao_estado;
begin
  perform entrar_console(p_pessoa, 'console.retencao.ver');
  select * into e from retencao_estado;
  return jsonb_build_object(
    'modo', e.modo, 'mudadoEm', e.mudado_em, 'mudadoPor', nome_pessoa(e.mudado_por), 'versao', e.versao,
    'podeLigar', pode_global('console.retencao.ligar'),
    'rodadas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'em', r.rodada_em, 'modo', r.modo, 'total', r.total, 'arquivos', r.arquivos, 'erros', r.erros,
                  'clientes', (select coalesce(jsonb_agg(x.c || jsonb_build_object('nome', (select nome from condominios where id = (x.c ->> 'condominioId')::uuid))
                                                         order by (x.c ? 'erro') desc, (x.c ->> 'total')::integer desc), '[]'::jsonb)
                                 from jsonb_array_elements(r.clientes) x(c)
                                where (x.c ->> 'total')::integer > 0 or x.c ? 'erro'))
                  order by r.id desc), '[]'::jsonb)
                  from (select * from retencao_rodadas order by id desc limit 30) r),
    'arquivos', jsonb_build_object(
      'naFila', (select count(*) from arquivos_a_apagar where apagado_em is null and tentativas < 5),
      'comErro', (select count(*) from arquivos_a_apagar where apagado_em is null and tentativas >= 5)),
    'tipos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'numero', t.numero, 'sistema', t.sistema, 'grupo', t.grupo, 'nome', t.nome,
                                                  'oQue', t.o_que, 'paraQue', t.para_que, 'base', t.base, 'quem', t.quem, 'prazo', t.prazo,
                                                  'noFim', t.no_fim, 'situacao', t.situacao) order by t.numero)
                from retencao_tipos t),
    -- Fim do contrato (C.1): ainda não há contrato encerrado no sistema (F0.12).
    'saidas', '[]'::jsonb);
end $$;

create function console_retencao_modo(p_pessoa uuid, p_modo text, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e retencao_estado;
begin
  perform entrar_console(p_pessoa, 'console.retencao.ligar');
  if p_modo is null or p_modo not in ('CONTANDO', 'APAGANDO') then perform recusar_campos('Modo desconhecido', 'modo'); end if;
  update retencao_estado set modo = p_modo, mudado_em = app_now(), mudado_por = p_pessoa
   where versao = p_versao returning * into e;
  if e.unica is null then
    raise exception 'O modo mudou enquanto você olhava' using errcode = 'TC409',
      detail = jsonb_build_object('versao', (select versao from retencao_estado))::text;
  end if;
  perform registrar_historico('retencao.modo', 'retencao', 'estado', jsonb_build_object('modo', p_modo));
  return jsonb_build_object('modo', e.modo, 'mudadoEm', e.mudado_em, 'mudadoPor', nome_pessoa(e.mudado_por), 'versao', e.versao);
end $$;

-- Quem está no Console: agora com Sistema › Retenção de dados no menu.
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
                                          'console.retencao.ver', 'console.retencao.ligar')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

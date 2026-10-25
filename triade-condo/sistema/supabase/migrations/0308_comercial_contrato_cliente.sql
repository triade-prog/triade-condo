-- 0308 · Contrato pelo gov.br, piloto, virar cliente, troca de sistema e vários condomínios
-- (R17.4; IDEIAS CM-08, CM-09, CM-13, CM-20, CM-21 e CM-29; plano em comercial/r17-4/plano-0308.md;
-- quadros 331, 333, 336, 338 e 345 aprovados em 24/10/2026 e 440 a 444, do contrato pelo gov.br,
-- esperando a aprovação da Carolina).
--
-- Decisões (Carolina, 25/10/2026: "vamos usar assinatura do gov.br"):
-- 1. Assinatura pelo gov.br (assinador.iti.br), sem API. Cada parte assina o mesmo PDF, nesta ordem:
--    primeiro o condomínio, depois a TRÍADE sobre o arquivo que o condomínio já assinou e que a
--    equipe conferiu. O PDF final é o envio da TRÍADE, com as duas assinaturas.
-- 2. O servidor (api-console) confere sozinho cada PDF enviado contra a base (o PDF gerado, para o
--    condomínio; o arquivo conferido do condomínio, para a TRÍADE), que lê do armazenamento: se tem
--    assinatura nova (um dicionário /Sig de verdade, com o /ByteRange cobrindo além da base), se os
--    primeiros N bytes têm o sha256 da base e se a parte acrescentada só traz a assinatura (o campo,
--    o widget pequeno, o AcroForm, o catálogo e a página mudando só as /Annots; o conteúdo e os
--    recursos de cada página iguais aos da base; o /ByteRange cobrindo o arquivo inteiro). Sem
--    assinatura nova: recusado na hora e o arquivo é apagado. Com assinatura sobre outro conteúdo (o
--    assinador regravou, trocou página ou acrescentou outra coisa): guardado, não conta, e pede de
--    novo (quadro 444).
-- 3. A equipe confere no validar.iti.gov.br as três marcas obrigatórias do quadro 442 (assinatura
--    válida, quem assinou é a pessoa do aceite, data depois da geração). Fica quem conferiu, quando,
--    o nome e o CPF mascarado de quem assinou, ou o motivo da recusa.
-- 4. O texto sai de Modelos › Contrato (quadro 443, console.comercial.modelos): versão com nome, OAB
--    e data da revisão do advogado, o termo de tratamento de dados e o índice de reajuste para ser
--    usada; uma só em uso; a versão em uso não se edita; os campos «...» são da lista fechada.
-- 5. Gerar contrato pede a proposta aceita, o modelo em uso, o CNPJ e a ata da eleição com o fim do
--    mandato (pelo link ou pela equipe). Gerar de novo substitui o anterior e zera as assinaturas;
--    depois de assinado pelos dois não se gera mais (mudança é aditivo).
-- 6. O link da proposta aceita continua valendo para os documentos e o contrato até
--    contrato_link_dias (60) depois do aceite, também em Ganho; fecha quando o interessado é perdido,
--    fica sem resposta ou é anonimizado.
-- 7. Virar cliente (CM-08) só com as duas assinaturas conferidas e cria de uma vez o que o quadro 331
--    lista. Quem pode: a Administração (console.comercial.cliente, ação nova, e console.condominios.criar).
--    O plano começa na competência da data de início do contrato; a primeira cobrança sai daí.
-- 8. Piloto (CM-21): 30, 45 ou 60 dias, meta obrigatória, com quem foi combinado; o condomínio entra
--    na carteira como Em piloto (estado novo PILOTO), com a implantação mínima e sem plano (sem
--    cobrança). Termina como proposta ou perdido com motivo (o condomínio fica Piloto encerrado). A
--    medição automática nesta rodada é a de retornos no prazo; as outras duas metas a Plataforma
--    mostra em Indicadores (pendente no painel).
-- 9. Troca de sistema (CM-29): carta-modelo (a síndica assina e manda), lista do que falta,
--    planilha-modelo e linha do tempo; ao virar cliente, vira pendência da implantação.
-- 10. Vários condomínios (CM-09): uma oportunidade nova com o mesmo contato, cada uma com o seu
--    condomínio, etapa e proposta. O contrato-quadro com desconto por volume fica pendente.
-- 11. LGPD: documentos e PDFs entram no catálogo de retenção (35 e 36). Anonimizar quem não virou
--    cliente apaga os arquivos (também os do contrato assinado e os envios conferidos) e os contatos
--    e o CNPJ do condomínio do piloto; de quem virou cliente fica o contrato assinado pelo prazo
--    legal. O CPF conferido fica só mascarado, e o CPF de quem representa o condomínio sai mascarado
--    em toda leitura (inteiro só no PDF).
-- 12. Revisão independente do 3f3902a (25/10/2026), antes de aplicar:
--    - virar cliente depois de um piloto perdido reaproveita o condomínio (Piloto encerrado →
--      Implantação); começar um segundo piloto do mesmo interessado é recusado;
--    - a primeira cobrança segue o contrato: a implantação em N parcelas mensais (cobrancas.parcela;
--      o índice único de uma implantação por cliente vira um por parcela) e a competência e o
--      vencimento a partir da data de início do contrato;
--    - depois de virar cliente, o Comercial não vê mais os dados do condomínio no contrato, na troca
--      e no piloto (a Administração continua vendo);
--    - documento conferido depois do contrato assinado ou de virar cliente é recusado; um só
--      recebido de cada tipo; o interessado é travado na conferência;
--    - fechar (perdido, sem resposta) ou anonimizar o interessado encerra o piloto e leva o
--      condomínio a Piloto encerrado (feito pela Administração do condomínio, marcado como do
--      sistema, porque a carteira só muda com alguém da equipe no condomínio); anonimizar tira os
--      contatos e o CNPJ do condomínio do piloto que não virou cliente;
--    - anonimizar apaga também os envios conferidos de um contrato que não virou cliente (ou que
--      ainda aguarda a TRÍADE) e manda à fila todos os arquivos, mesmo os de linhas já apagadas;
--    - até contrato_envios_abertos_max (3) envios em aberto por interessado; uma rotina diária
--      (comercial_limpar_envios_abertos, 3h47) recusa os que ficaram enviando mais de um dia e manda
--      os arquivos para a fila de apagar;
--    - a conferência e o recusar travam sempre o contrato antes do envio (como gerar de novo);
--    - o CPF de quem representa sai mascarado em toda leitura; inteiro só no retrato do PDF.
--
-- Nada aqui apaga linha nem remove função (o conector do Supabase trava nesses comandos). Sai só o
-- índice cobrancas_implantacao_unica (0291), trocado pelo de uma implantação por parcela.

-- ---------------------------------------------------------------------------------------
-- Quem pode o quê, parâmetros, catálogo de retenção e o armazenamento.

insert into funcao_acoes (funcao, acao) values
  ('ADMINISTRACAO', 'console.comercial.assinar'),
  ('ADMINISTRACAO', 'console.comercial.cliente');

insert into configuracoes (chave, valor, descricao) values
  ('contrato_link_dias', '60', 'Dias depois do aceite em que o link da proposta recebe os documentos e o contrato'),
  ('limite_contrato_max', '20', 'Envios de arquivo pelo link da proposta pelo mesmo aparelho dentro da janela'),
  ('limite_contrato_janela_minutos', '60', 'Janela dos envios de arquivo pelo link da proposta'),
  ('contrato_envios_abertos_max', '3', 'Envios de arquivo em aberto (enviando, nas 2 horas do link de envio) por interessado');

insert into retencao_tipos (numero, codigo, sistema, grupo, nome, o_que, para_que, base, quem, prazo, no_fim, situacao) values
 (35, 'COMERCIAL_ARQUIVO', 'CONSOLE', 'Console TRÍADE', 'Documentos e contratos do Comercial', 'CNPJ, ata, contrato gerado e PDFs assinados',
  'Fechar o contrato', 'Legítimo interesse; procedimentos preliminares do contrato', 'TRÍADE',
  'Quem não virou cliente: junto com o interessado', 'Arquivos apagados; ficam as datas e as situações', 'A_FAZER'),
 (36, 'CONTRATO_ASSINADO', 'CONSOLE', 'Console TRÍADE', 'Contrato assinado', 'O PDF com as duas assinaturas e a conferência',
  'Provar o contrato', 'Execução do contrato; obrigação legal', 'TRÍADE', '5 anos depois do fim do contrato', 'Apagado', 'A_FAZER');

-- A fila de arquivos da retenção passa a aceitar o bucket do Comercial (a api-plataforma apaga).
alter table arquivos_a_apagar drop constraint arquivos_a_apagar_bucket_check;
alter table arquivos_a_apagar add constraint arquivos_a_apagar_bucket_check
  check (bucket in ('pedidos', 'manutencoes', 'comunicados', 'documentos', 'exportacoes', 'suporte', 'relatorios', 'portaria', 'comercial'));

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('comercial', 'comercial', false, 10485760, array['application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Ajudantes.

-- CNPJ com os dois dígitos verificadores (só dígitos, 14, sem todos iguais).
create function cnpj_valido(p text) returns boolean
language plpgsql immutable
set search_path = public
as $$
declare
  d int[];
  p1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  p2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s int;
  r int;
  i int;
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^(.)\1{13}$' then return false; end if;
  select array_agg(substr(p, n, 1)::int order by n) into d from generate_series(1, 14) n;
  s := 0;
  for i in 1 .. 12 loop s := s + d[i] * p1[i]; end loop;
  r := s % 11;
  r := case when r < 2 then 0 else 11 - r end;
  if r <> d[13] then return false; end if;
  s := 0;
  for i in 1 .. 13 loop s := s + d[i] * p2[i]; end loop;
  r := s % 11;
  r := case when r < 2 then 0 else 11 - r end;
  return r = d[14];
end $$;

create function comercial_cnpj_formatado(p text) returns text
language sql immutable
set search_path = public
as $$ select substr(p, 1, 2) || '.' || substr(p, 3, 3) || '.' || substr(p, 6, 3) || '/' || substr(p, 9, 4) || '-' || substr(p, 13, 2) $$;

create function comercial_cpf_formatado(p text) returns text
language sql immutable
set search_path = public
as $$ select substr(p, 1, 3) || '.' || substr(p, 4, 3) || '.' || substr(p, 7, 3) || '-' || substr(p, 10, 2) $$;

-- O CPF conferido fica só assim: ***.456.789-**.
create function comercial_cpf_mascarado(p text) returns text
language sql immutable
set search_path = public
as $$ select case when p ~ '^[0-9]{11}$' then '***.' || substr(p, 4, 3) || '.' || substr(p, 7, 3) || '-**' end $$;

-- Os campos do contrato para ler (tela e ficha): o CPF de quem representa sai mascarado; inteiro só
-- no retrato que monta o PDF.
create function comercial_campos_leitura(p jsonb) returns jsonb
language sql immutable
set search_path = public
as $$
  select case when p ? 'cpf_representante'
              then p || jsonb_build_object('cpf_representante', comercial_cpf_mascarado(regexp_replace(p ->> 'cpf_representante', '[^0-9]', '', 'g')))
              else p end
$$;

-- Centavos em reais, como o contrato escreve: R$ 1.234,56.
create function comercial_reais(p bigint) returns text
language sql immutable
set search_path = public
as $$
  select case when p is null then null
              else 'R$ ' || regexp_replace((p / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || ',' || lpad((p % 100)::text, 2, '0') end
$$;

create function comercial_data_br(p date) returns text
language sql immutable
set search_path = public
as $$ select to_char(p, 'DD/MM/YYYY') $$;

-- Data que vem da tela; o que não é data volta como nulo (a função recusa com o campo).
create function comercial_data(p jsonb, p_chave text) returns date
language plpgsql immutable
set search_path = public
as $$
begin
  if coalesce(p ->> p_chave, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return (p ->> p_chave)::date;
exception when others then
  return null;
end $$;

create function comercial_inteiro(p jsonb, p_chave text) returns bigint
language sql immutable
set search_path = public
as $$ select case when coalesce(p ->> p_chave, '') ~ '^[0-9]{1,12}$' then (p ->> p_chave)::bigint end $$;

-- O papel do contato como a ficha do cliente escreve.
create function comercial_papel_texto(p text) returns text
language sql immutable
set search_path = public
as $$
  select case p when 'SINDICO' then 'Síndico(a)' when 'SUBSINDICO' then 'Subsíndico(a)' when 'CONSELHEIRO' then 'Conselheiro(a)'
                when 'SINDICO_PROFISSIONAL' then 'Síndico(a) profissional' when 'ADMINISTRADORA' then 'Administradora'
                when 'MORADOR' then 'Morador(a)' else 'Contato do Comercial' end
$$;

-- Caminho no bucket "comercial": interessado/registro/arquivo, só ids.
create function comercial_caminho(p_interessado uuid, p_registro uuid) returns text
language sql volatile
set search_path = public
as $$ select p_interessado::text || '/' || p_registro::text || '/' || gen_random_uuid()::text $$;

-- O histórico interno só vale com a equipe; pelo link do síndico fica a conversa do Comercial
-- (como no aceite da 0304).
create function comercial_historico(p_acao text, p_entidade text, p_id text, p_dados jsonb) returns void
language plpgsql
set search_path = public
as $$
begin
  if contexto_equipe() then perform registrar_historico_interno(p_acao, p_entidade, p_id, p_dados); end if;
end $$;

-- Quem cuida da implantação: da equipe ativa, com a função Implantação.
create function comercial_exigir_implantacao(p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_pessoa is null or not exists (
    select 1 from equipe_triade e join equipe_funcoes ef on ef.pessoa_id = e.pessoa_id
     where e.pessoa_id = p_pessoa and e.ativa and ef.retirada_em is null and ef.funcao = 'IMPLANTACAO') then
    perform recusar_campos('Escolha quem cuida da implantação (da equipe, com a função Implantação)', 'responsavelImplantacaoId');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- A carteira: o CNPJ na ficha e os estados do piloto.

alter table condominios add column cnpj text check (cnpj ~ '^[0-9]{14}$');

insert into estados_iniciais (tabela, estado) values ('clientes', 'PILOTO');
insert into transicoes_permitidas (tabela, de, para) values
  ('clientes', 'PILOTO', 'IMPLANTACAO'),
  ('clientes', 'PILOTO', 'PILOTO_ENCERRADO'),
  ('clientes', 'PILOTO_ENCERRADO', 'IMPLANTACAO');

-- O piloto começa e termina pelo Comercial: "Mudar estágio" não tira o cliente do piloto.
create function clientes_piloto_pelo_comercial() returns trigger
language plpgsql
set search_path = public
as $$
declare v_evento text := coalesce(current_setting('app.transicao_evento', true), '');
begin
  if tg_op = 'INSERT' and new.estado = 'PILOTO' and v_evento <> 'PILOTO_INICIADO' then
    perform recusar_motivo('O piloto começa pelo Comercial', 'PILOTO_PELO_COMERCIAL');
  end if;
  if tg_op = 'UPDATE' and old.estado in ('PILOTO', 'PILOTO_ENCERRADO') and new.estado is distinct from old.estado
     and v_evento not in ('PILOTO_VIROU_CLIENTE', 'PILOTO_ENCERRADO') then
    perform recusar_motivo('O piloto termina pelo Comercial: vira cliente ou perdido', 'PILOTO_PELO_COMERCIAL');
  end if;
  return new;
end $$;
create trigger clientes_piloto_pelo_comercial before insert or update of estado on clientes
  for each row execute function clientes_piloto_pelo_comercial();

-- O interessado guarda de qual contato é (CM-09) e, depois, o condomínio do piloto ou do cliente.
alter table interessados
  add column contato_de       uuid references interessados (id),
  add column condominio_id    uuid references condominios (id),
  add column virou_cliente_em timestamptz,
  add constraint interessados_contato_de_outro check (contato_de is distinct from id);
create index interessados_contato_de on interessados (contato_de) where contato_de is not null;

create function interessados_contato_fixo() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contato_de is distinct from old.contato_de
     or (old.condominio_id is not null and new.condominio_id is distinct from old.condominio_id)
     or (old.virou_cliente_em is not null and new.virou_cliente_em is distinct from old.virou_cliente_em) then
    raise exception 'O contato, o condomínio e a data de virar cliente não mudam' using errcode = 'TC422', detail = '{"motivo":"INTERESSADO_FIXO"}';
  end if;
  return new;
end $$;
create trigger interessados_contato_fixo before update of contato_de, condominio_id, virou_cliente_em on interessados
  for each row execute function interessados_contato_fixo();

-- Depois de virar cliente, o Comercial deixa de ver os dados do condomínio (CM-11); a
-- Administração, que atende o cliente, continua vendo.
create function comercial_ve_cliente(i interessados) returns boolean
language sql stable
set search_path = public
as $$ select i.virou_cliente_em is null or pode_global('console.comercial.cliente') $$;

-- Entrar num cliente para mexer na carteira: a Administração que ainda não o atende passa a atender
-- (o piloto pode ter sido aberto por outra pessoa). Só depois de conferida a ação global.
create function comercial_entrar_cliente(p_pessoa uuid, p_condominio uuid, p_acao text) returns void
language plpgsql
set search_path = public
as $$
declare v_vinculo uuid;
begin
  if not exists (select 1 from vinculos where pessoa_id = p_pessoa and condominio_id = p_condominio and funcao = 'ADMINISTRACAO' and revogado_em is null) then
    perform entrar_como_sistema(p_condominio);
    insert into vinculos (pessoa_id, condominio_id, funcao, criado_por) values (p_pessoa, p_condominio, 'ADMINISTRACAO', p_pessoa)
    returning id into v_vinculo;
  end if;
  perform entrar_condominio(p_pessoa, p_condominio, p_acao);
  if v_vinculo is not null then
    perform registrar_historico_interno('equipe.atribuida', 'vinculo', v_vinculo::text,
                                        jsonb_build_object('pessoa_id', p_pessoa, 'funcao', 'ADMINISTRACAO'));
  end if;
end $$;

-- Quem cuida da implantação passa a ver o cliente na carteira (vínculo Implantação).
create function comercial_atribuir_implantacao(p_responsavel uuid, p_pessoa uuid) returns void
language plpgsql
set search_path = public
as $$
declare v_vinculo uuid;
begin
  if not exists (select 1 from vinculos where pessoa_id = p_responsavel and condominio_id = contexto_condominio()
                                            and funcao = 'IMPLANTACAO' and revogado_em is null) then
    insert into vinculos (pessoa_id, condominio_id, funcao, criado_por) values (p_responsavel, contexto_condominio(), 'IMPLANTACAO', p_pessoa)
    returning id into v_vinculo;
    perform registrar_historico_interno('equipe.atribuida', 'vinculo', v_vinculo::text,
                                        jsonb_build_object('pessoa_id', p_responsavel, 'funcao', 'IMPLANTACAO'));
  end if;
end $$;

-- Os contatos da ficha do cliente a partir do interessado (o WhatsApp vira telefone +55...).
create function comercial_contatos_cliente(i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select case when i.nome_contato is not null and (i.whatsapp is not null or i.email is not null)
              then jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
                     'nome', left(i.nome_contato, 120), 'papel', comercial_papel_texto(i.papel_contato),
                     'telefone', case when i.whatsapp is not null then '+' || i.whatsapp end, 'email', i.email)))
              else '[]'::jsonb end
$$;

-- ---------------------------------------------------------------------------------------
-- Vários condomínios do mesmo contato (CM-09).

-- Parecido (0296): o mesmo WhatsApp ou e-mail de outra oportunidade do mesmo contato não é
-- duplicado; CNPJ e endereço continuam valendo para todos.
create or replace function comercial_parecido(p_whatsapp text, p_email text, p_cnpj text, p_endereco text, p_ignorar uuid default null)
returns table (id uuid, campo text)
language sql stable
set search_path = public
as $$
  with grupo as (select coalesce(x.contato_de, x.id) as g from interessados x where x.id = p_ignorar),
  candidatos as (
    select i.*,
           (p_whatsapp is not null and i.whatsapp = p_whatsapp and not exists (select 1 from grupo where grupo.g = coalesce(i.contato_de, i.id))) as por_whatsapp,
           (p_cnpj is not null and i.cnpj = p_cnpj) as por_cnpj,
           (p_email is not null and i.email = lower(p_email) and not exists (select 1 from grupo where grupo.g = coalesce(i.contato_de, i.id))) as por_email,
           (comercial_normalizar(p_endereco) is not null and comercial_normalizar(i.endereco) = comercial_normalizar(p_endereco)) as por_endereco
      from interessados i
     where i.anonimizado_em is null and i.id is distinct from p_ignorar)
  select c.id,
         case when c.por_whatsapp then 'WHATSAPP' when c.por_cnpj then 'CNPJ' when c.por_email then 'EMAIL' else 'ENDERECO' end
    from candidatos c
   where c.por_whatsapp or c.por_cnpj or c.por_email or c.por_endereco
   order by comercial_aberta(c.etapa) desc, c.criado_em desc
   limit 1
$$;

create function comercial_grupo(i interessados) returns uuid
language sql immutable
set search_path = public
as $$ select coalesce(i.contato_de, i.id) $$;

create function comercial_oportunidades_json(i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', o.id, 'condominio', o.condominio, 'cidade', o.cidade, 'uf', o.uf, 'unidades', o.unidades, 'etapa', o.etapa,
           'virouCliente', o.virou_cliente_em is not null, 'criadoEm', o.criado_em)) order by o.criado_em), '[]'::jsonb)
    from interessados o
   where coalesce(o.contato_de, o.id) = comercial_grupo(i) and o.id <> i.id and o.anonimizado_em is null
$$;

-- Oportunidade nova com o mesmo contato: outro condomínio, com a sua etapa e a sua proposta.
-- A origem e a base legal são as do contato; nada sai sozinho (a cadência não começa).
create function comercial_nova_oportunidade(p_pessoa uuid, p_id uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  v_condominio text := comercial_texto(p_dados, 'condominio');
  v_cnpj text := comercial_texto(p_dados, 'cnpj');
  v_resp uuid := nullif(p_dados ->> 'responsavelId', '')::uuid;
  v_existe record;
  v_id uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if comercial_nao_contatar_tem(i.whatsapp, i.email, i.cnpj) then perform recusar_motivo('Este contato está na lista de não contatar', 'NAO_CONTATAR'); end if;
  if coalesce(length(v_condominio), 0) not between 2 and 120 then perform recusar_campos('Diga o nome do condomínio', 'condominio'); end if;
  if exists (select 1 from interessados o where coalesce(o.contato_de, o.id) = comercial_grupo(i) and o.anonimizado_em is null
                                           and comercial_normalizar(o.condominio) = comercial_normalizar(v_condominio)) then
    raise exception 'Este contato já tem uma oportunidade para este condomínio' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'DUPLICADO', 'campos', jsonb_build_array('condominio'))::text;
  end if;
  if v_cnpj is not null then
    select * into v_existe from comercial_parecido(null, null, v_cnpj, null);
    if v_existe.id is not null then
      raise exception 'Este CNPJ já é de outro interessado' using errcode = 'TC422',
        detail = jsonb_build_object('motivo', 'DUPLICADO', 'campos', jsonb_build_array('cnpj'), 'interessadoId', v_existe.id)::text;
    end if;
  end if;
  perform comercial_exigir_responsavel(coalesce(v_resp, i.responsavel_id));
  begin
    insert into interessados (nome_contato, papel_contato, whatsapp, email, condominio, cnpj, endereco, cidade, uf, faixa, unidades, origem, origem_detalhe,
                              base_legal, base_legal_texto, optin_em, optin_canal, optin_texto, responsavel_id, contato_de, criado_por)
    values (i.nome_contato, i.papel_contato, i.whatsapp, i.email, v_condominio, v_cnpj, comercial_texto(p_dados, 'endereco'),
            comercial_texto(p_dados, 'cidade'), comercial_texto(p_dados, 'uf'), comercial_texto(p_dados, 'faixa'), comercial_inteiro(p_dados, 'unidades'),
            i.origem, left('Outro condomínio do mesmo contato (' || i.condominio || ')', 200), i.base_legal, i.base_legal_texto,
            i.optin_em, i.optin_canal, i.optin_texto, coalesce(v_resp, i.responsavel_id), comercial_grupo(i), p_pessoa)
    returning id into v_id;
  exception when check_violation then
    perform recusar_campos('Confira os dados do condomínio', 'condominio', 'cnpj', 'cidade', 'uf', 'faixa', 'unidades');
  end;
  insert into etapas_interessado (interessado_id, de, para, criado_por) values (v_id, null, 'NOVO', p_pessoa);
  perform comercial_inserir_conversa(v_id, 'NOTA', 'Oportunidade nova do mesmo contato de ' || i.condominio || '.', false, null, null);
  perform comercial_inserir_conversa(i.id, 'NOTA', 'O mesmo contato abriu a oportunidade de ' || v_condominio || '.', false, null, null);
  perform registrar_historico_interno('comercial.oportunidade', 'interessado', v_id::text, jsonb_build_object('contatoDe', comercial_grupo(i)));
  return jsonb_build_object('id', v_id, 'contatoDe', comercial_grupo(i));
end $$;

create function comercial_oportunidades(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i interessados;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_id);
  return jsonb_build_object('contatoDe', comercial_grupo(i), 'oportunidades', comercial_oportunidades_json(i));
end $$;

-- ---------------------------------------------------------------------------------------
-- Modelos › Contrato (quadro 443): o texto do advogado, com versões. Só a Administração muda.

create function contrato_campos() returns text[]
language sql immutable
set search_path = public
as $$ select array['condominio', 'cnpj', 'representante', 'cpf_representante', 'mandato_ate', 'plano', 'valor_mensal', 'valor_anual',
                   'implantacao', 'desconto', 'data_inicio', 'indice_reajuste'] $$;

-- Os campos escritos errado: «nome» fora da lista e « ou » sobrando.
create function contrato_campos_errados(p text) returns text[]
language sql immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select '«' || m[1] || '»' as x from regexp_matches(coalesce(p, ''), '«([^«»]*)»', 'g') m where not (m[1] = any (contrato_campos()))
    union all
    select s from (values ('«'), ('»')) v(s) where strpos(regexp_replace(coalesce(p, ''), '«[^«»]*»', '', 'g'), s) > 0
  ) e
$$;

create table modelos_contrato (
  id              uuid primary key default gen_random_uuid(),
  numero          integer not null unique check (numero between 1 and 999),
  titulo          text not null check (length(btrim(titulo)) between 3 and 120),
  texto           text not null check (length(btrim(texto)) between 50 and 100000),
  termo           text check (length(btrim(termo)) between 50 and 50000),
  indice_reajuste text check (length(btrim(indice_reajuste)) between 2 and 60),
  advogado_nome   text check (length(btrim(advogado_nome)) between 3 and 120),
  advogado_oab    text check (advogado_oab ~ '^[A-Z]{2} [0-9]{1,6}[A-Z]?$'),
  revisado_em     date check (revisado_em >= date '2020-01-01'),
  situacao        text not null default 'RASCUNHO' check (situacao in ('RASCUNHO', 'EM_USO', 'SUBSTITUIDA')),
  em_uso_em       timestamptz,
  em_uso_por      uuid references pessoas (id),
  substituida_em  timestamptz,
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid references pessoas (id),
  alterado_em     timestamptz,
  alterado_por    uuid references pessoas (id),
  versao          integer not null default 1,
  check (cardinality(contrato_campos_errados(texto)) = 0 and cardinality(contrato_campos_errados(termo)) = 0),
  check (situacao = 'RASCUNHO' or (advogado_nome is not null and advogado_oab is not null and revisado_em is not null
                                    and termo is not null and indice_reajuste is not null and em_uso_em is not null)),
  check ((situacao = 'SUBSTITUIDA') = (substituida_em is not null))
);
create unique index modelos_contrato_um_em_uso on modelos_contrato ((true)) where situacao = 'EM_USO';
call proteger_tabela_comercial('modelos_contrato', 'console.comercial.modelos',
  'Versões do modelo de contrato revisado por advogado (EM-06); só a Administração muda; a versão em uso não se edita');
create trigger modelos_contrato_sem_exclusao before delete on modelos_contrato for each row execute function somente_insercao();

-- O rascunho muda à vontade; a versão em uso só fica substituída (mudar o texto é a versão seguinte).
create function modelos_contrato_regras() returns trigger
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
create trigger modelos_contrato_regras before update on modelos_contrato for each row execute function modelos_contrato_regras();

-- OAB como "DF 12345": aceita "OAB/DF 12.345", "12345/DF" e parecidos.
create function comercial_oab(p text) returns text
language plpgsql immutable
set search_path = public
as $$
declare v text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v like 'OAB%' then v := substr(v, 4); end if;
  if v ~ '^[A-Z]{2}[0-9]{1,6}[A-Z]?$' then return substr(v, 1, 2) || ' ' || substr(v, 3); end if;
  if v ~ '^[0-9]{1,6}[A-Z]{2}$' then return right(v, 2) || ' ' || left(v, length(v) - 2); end if;
  return null;
end $$;

-- plpgsql: a tabela dos contratos vem depois.
create function modelo_contrato_json(m modelos_contrato, p_texto boolean) returns jsonb
language plpgsql stable
set search_path = public
as $$
begin
  return jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'versao', m.versao, 'numero', m.numero, 'titulo', m.titulo, 'situacao', m.situacao,
    'revisao', case when m.advogado_nome is not null then jsonb_build_object('advogado', m.advogado_nome, 'oab', m.advogado_oab, 'em', m.revisado_em) end,
    'indiceReajuste', m.indice_reajuste, 'temTermo', m.termo is not null,
    'emUsoEm', m.em_uso_em, 'emUsoPor', comercial_pessoa_json(m.em_uso_por), 'substituidaEm', m.substituida_em,
    'criadoEm', m.criado_em, 'criadoPor', comercial_pessoa_json(m.criado_por),
    'contratos', (select count(*) from contratos_comercial c where c.modelo_id = m.id and c.situacao <> 'GERANDO'),
    'falta', to_jsonb(array_remove(array[
      case when m.advogado_nome is null then 'revisao' end, case when m.termo is null then 'termo' end,
      case when m.indice_reajuste is null then 'indiceReajuste' end], null))))
  || case when p_texto then jsonb_strip_nulls(jsonb_build_object('texto', m.texto, 'termo', m.termo)) else '{}'::jsonb end;
end $$;

create function comercial_modelos_contrato(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  return jsonb_build_object(
    'versoes', coalesce((select jsonb_agg(modelo_contrato_json(m, true) order by m.numero desc) from modelos_contrato m), '[]'::jsonb),
    'emUso', (select modelo_contrato_json(m, false) from modelos_contrato m where m.situacao = 'EM_USO'),
    'campos', to_jsonb(contrato_campos()),
    'podeEditar', pode_global('console.comercial.modelos'));
end $$;

-- Cadastrar (p_id nulo) ou mudar o rascunho. Campo escrito errado impede salvar.
create function comercial_salvar_modelo_contrato(p_pessoa uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m modelos_contrato;
  v_texto text := comercial_texto(p_dados, 'texto');
  v_termo text := comercial_texto(p_dados, 'termo');
  v_advogado text := comercial_texto(p_dados, 'advogadoNome');
  v_oab text := comercial_oab(p_dados ->> 'advogadoOab');
  v_revisado date := comercial_data(p_dados, 'revisadoEm');
  v_errados text[];
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  if coalesce(length(comercial_texto(p_dados, 'titulo')), 0) not between 3 and 120 then perform recusar_campos('Diga o título do contrato', 'titulo'); end if;
  if coalesce(length(v_texto), 0) not between 50 and 100000 then perform recusar_campos('Cole o texto do contrato (de 50 a 100 mil letras)', 'texto'); end if;
  if v_termo is not null and length(v_termo) not between 50 and 50000 then perform recusar_campos('O termo de tratamento de dados vai de 50 a 50 mil letras', 'termo'); end if;
  v_errados := contrato_campos_errados(v_texto) || contrato_campos_errados(v_termo);
  if cardinality(v_errados) > 0 then
    raise exception 'Campo escrito errado ou que não existe' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'CAMPO_ERRADO', 'campos', jsonb_build_array('texto'), 'camposErrados', to_jsonb(v_errados))::text;
  end if;
  if comercial_texto(p_dados, 'indiceReajuste') is not null and length(comercial_texto(p_dados, 'indiceReajuste')) not between 2 and 60 then
    perform recusar_campos('Diga o índice de reajuste (por exemplo, IPCA)', 'indiceReajuste');
  end if;
  -- A revisão vem inteira: nome, OAB e data (até hoje).
  if num_nonnulls(v_advogado, comercial_texto(p_dados, 'advogadoOab'), p_dados ->> 'revisadoEm') > 0 then
    if coalesce(length(v_advogado), 0) not between 3 and 120 then perform recusar_campos('Diga o nome do advogado que revisou', 'advogadoNome'); end if;
    if v_oab is null then perform recusar_campos('Diga a OAB do advogado (por exemplo, DF 12345)', 'advogadoOab'); end if;
    if v_revisado is null or v_revisado > comercial_hoje() or v_revisado < date '2020-01-01' then
      perform recusar_campos('Diga a data da revisão (até hoje)', 'revisadoEm');
    end if;
  end if;
  if p_id is null then
    insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, criado_por)
    values ((select coalesce(max(numero), 0) + 1 from modelos_contrato), comercial_texto(p_dados, 'titulo'), v_texto, v_termo,
            comercial_texto(p_dados, 'indiceReajuste'), v_advogado, v_oab, v_revisado, p_pessoa)
    returning * into m;
    perform registrar_historico_interno('comercial.modelo_contrato', 'modelo_contrato', m.id::text, jsonb_build_object('numero', m.numero));
    return modelo_contrato_json(m, true);
  end if;
  select * into m from modelos_contrato where id = p_id for update;
  if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if m.situacao <> 'RASCUNHO' then perform recusar_motivo('A versão em uso não se edita; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
  if m.versao <> p_versao then perform conflito_versao('modelos_contrato', p_id); end if;
  update modelos_contrato set titulo = comercial_texto(p_dados, 'titulo'), texto = v_texto, termo = v_termo,
         indice_reajuste = comercial_texto(p_dados, 'indiceReajuste'), advogado_nome = v_advogado, advogado_oab = v_oab, revisado_em = v_revisado,
         alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into m;
  perform registrar_historico_interno('comercial.modelo_contrato', 'modelo_contrato', m.id::text, jsonb_build_object('numero', m.numero));
  return modelo_contrato_json(m, true);
end $$;

-- Pôr em uso: revisão do advogado, termo de dados e índice. A que estava em uso fica substituída;
-- os contratos já gerados guardam a versão usada.
create function comercial_usar_modelo_contrato(p_pessoa uuid, p_id uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m modelos_contrato;
  v_falta text[];
begin
  perform entrar_console(p_pessoa, 'console.comercial.modelos');
  select * into m from modelos_contrato where id = p_id for update;
  if not found then raise exception 'Modelo não encontrado' using errcode = 'TC404'; end if;
  if m.versao <> p_versao then perform conflito_versao('modelos_contrato', p_id); end if;
  if m.situacao = 'EM_USO' then return modelo_contrato_json(m, true); end if;
  if m.situacao <> 'RASCUNHO' then perform recusar_motivo('Esta versão já foi substituída; cadastre a versão seguinte', 'MODELO_EM_USO'); end if;
  v_falta := array_remove(array[case when m.advogado_nome is null then 'advogadoNome' end, case when m.advogado_oab is null then 'advogadoOab' end,
                                case when m.revisado_em is null then 'revisadoEm' end, case when m.termo is null then 'termo' end,
                                case when m.indice_reajuste is null then 'indiceReajuste' end], null);
  if cardinality(v_falta) > 0 then
    raise exception 'Para usar, a versão precisa da revisão do advogado (nome, OAB e data), do termo de dados e do índice' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'MODELO_SEM_REVISAO', 'campos', to_jsonb(v_falta))::text;
  end if;
  update modelos_contrato set situacao = 'SUBSTITUIDA', substituida_em = app_now(), alterado_em = app_now(), alterado_por = p_pessoa
   where situacao = 'EM_USO';
  update modelos_contrato set situacao = 'EM_USO', em_uso_em = app_now(), em_uso_por = p_pessoa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id
  returning * into m;
  perform registrar_historico_interno('comercial.modelo_em_uso', 'modelo_contrato', m.id::text, jsonb_build_object('numero', m.numero));
  return modelo_contrato_json(m, true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Documentos do aceite (quadro 441): cartão do CNPJ, ata da eleição com o fim do mandato e, se a
-- convenção pedir, a ata que aprovou. Pelo link do síndico ou pela equipe. Só PDF, até 10 MB.

create table documentos_aceite (
  id             uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados (id),
  aceite_id      uuid not null references aceites_proposta (id),
  tipo           text not null check (tipo in ('CNPJ', 'ATA_ELEICAO', 'ATA_APROVACAO')),
  situacao       text not null default 'ENVIANDO' check (situacao in ('ENVIANDO', 'RECEBIDO', 'RECUSADO', 'SUBSTITUIDO', 'APAGADO')),
  nome           text check (length(btrim(nome)) between 1 and 200),
  tamanho        integer check (tamanho between 1 and 10485760),
  caminho        text not null check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  sha256         text check (sha256 ~ '^[0-9a-f]{64}$'),
  cnpj           text check (cnpj is null or cnpj_valido(cnpj)),
  mandato_ate    date,
  pelo_link      boolean not null,
  ip             text check (length(ip) between 3 and 45),
  enviado_por    uuid references pessoas (id),
  enviado_em     timestamptz not null default app_now(),
  recebido_em    timestamptz,
  motivo_recusa  text check (length(btrim(motivo_recusa)) between 3 and 300),
  substituido_em timestamptz,
  apagado_em     timestamptz,
  check (tipo <> 'CNPJ' or cnpj is not null or apagado_em is not null),
  check (tipo <> 'ATA_ELEICAO' or mandato_ate is not null or apagado_em is not null),
  check (pelo_link or enviado_por is not null),
  check (situacao <> 'RECEBIDO' or (recebido_em is not null and sha256 is not null)),
  check ((situacao = 'RECUSADO') = (motivo_recusa is not null) or apagado_em is not null),
  check ((situacao = 'APAGADO') = (apagado_em is not null) or (situacao = 'RECEBIDO' and apagado_em is null))
);
create index documentos_aceite_interessado on documentos_aceite (interessado_id, tipo, enviado_em desc);
-- Um só recebido de cada tipo (duas conferências ao mesmo tempo não deixam dois).
create unique index documentos_aceite_um_recebido on documentos_aceite (interessado_id, tipo) where situacao = 'RECEBIDO';
call proteger_tabela_comercial('documentos_aceite', 'console.comercial.editar',
  'Documentos enviados depois do aceite (CNPJ e atas), pelo link ou pela equipe; o arquivo fica no bucket comercial');
create trigger documentos_aceite_sem_exclusao before delete on documentos_aceite for each row execute function somente_insercao();

create function documentos_aceite_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.interessado_id, new.aceite_id, new.tipo, new.caminho, new.pelo_link, new.enviado_por, new.enviado_em)
     is distinct from (old.id, old.interessado_id, old.aceite_id, old.tipo, old.caminho, old.pelo_link, old.enviado_por, old.enviado_em) then
    raise exception 'O documento enviado não muda' using errcode = 'TC422', detail = '{"motivo":"DOCUMENTO_FIXO"}';
  end if;
  if new.situacao = old.situacao
     or row(old.situacao, new.situacao) in (row('ENVIANDO', 'RECEBIDO'), row('ENVIANDO', 'RECUSADO'), row('RECEBIDO', 'SUBSTITUIDO'))
     or (new.situacao = 'APAGADO' and comercial_sistema()) then
    if new.situacao = old.situacao and new.apagado_em is null and (to_jsonb(new) - 'apagado_em') is distinct from (to_jsonb(old) - 'apagado_em')
       and not comercial_sistema() then
      raise exception 'O documento enviado não muda' using errcode = 'TC422', detail = '{"motivo":"DOCUMENTO_FIXO"}';
    end if;
    return new;
  end if;
  raise exception 'O documento enviado não muda' using errcode = 'TC422', detail = '{"motivo":"DOCUMENTO_FIXO"}';
end $$;
create trigger documentos_aceite_regras before update on documentos_aceite for each row execute function documentos_aceite_regras();

create function documento_aceite_json(d documentos_aceite, p_interno boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', d.id, 'tipo', d.tipo, 'situacao', d.situacao, 'nome', d.nome, 'tamanho', d.tamanho, 'enviadoEm', d.enviado_em,
    'recebidoEm', d.recebido_em, 'peloLink', d.pelo_link, 'motivo', d.motivo_recusa, 'mandatoAte', d.mandato_ate,
    'cnpj', case when d.cnpj is not null then comercial_cnpj_formatado(d.cnpj) end))
  || case when p_interno then jsonb_strip_nulls(jsonb_build_object('enviadoPor', comercial_pessoa_json(d.enviado_por), 'sha256', d.sha256))
          else '{}'::jsonb end
$$;

-- O último documento recebido de cada tipo.
create function comercial_documento_recebido(p_interessado uuid, p_tipo text) returns documentos_aceite
language sql stable
set search_path = public
as $$
  select * from documentos_aceite where interessado_id = p_interessado and tipo = p_tipo and situacao = 'RECEBIDO'
   order by recebido_em desc limit 1
$$;

-- O que falta para gerar o contrato: o CNPJ e a ata da eleição com o mandato em dia.
create function comercial_documentos_faltam(p_interessado uuid) returns text[]
language sql stable
set search_path = public
as $$
  select array_remove(array[
    case when (comercial_documento_recebido(p_interessado, 'CNPJ')).id is null then 'CNPJ' end,
    case when coalesce((comercial_documento_recebido(p_interessado, 'ATA_ELEICAO')).mandato_ate, date '1900-01-01') < comercial_hoje()
         then 'ATA_ELEICAO' end], null)
$$;

-- O aceite da proposta do interessado (uma versão aceita por proposta).
create function comercial_aceite_do_interessado(p_interessado uuid) returns aceites_proposta
language sql stable
set search_path = public
as $$
  select a.* from aceites_proposta a join versoes_proposta v on v.id = a.versao_id join propostas_comercial p on p.id = v.proposta_id
   where p.interessado_id = p_interessado and v.situacao = 'ACEITA'
   order by a.aceito_em desc limit 1
$$;

create function comercial_interessado_do_aceite(a aceites_proposta) returns interessados
language sql stable
set search_path = public
as $$
  select i.* from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id join interessados i on i.id = p.interessado_id
   where v.id = a.versao_id
$$;

-- Envios em aberto (o link de envio do armazenamento vale 2 horas): até contrato_envios_abertos_max
-- por interessado, somando documentos e PDFs assinados, para ninguém encher o armazenamento.
create function comercial_exigir_envios_abertos(p_interessado uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from documentos_aceite where interessado_id = p_interessado and situacao = 'ENVIANDO'
                                              and enviado_em > app_now() - interval '2 hours')
     + (select count(*) from envios_contrato where interessado_id = p_interessado and situacao = 'ENVIANDO'
                                              and enviado_em > app_now() - interval '2 hours')
     >= configuracao_int('contrato_envios_abertos_max') then
    perform recusar_motivo('Há envios em aberto; termine os que começou ou espere duas horas', 'ENVIOS_EM_ABERTO');
  end if;
end $$;

-- Começar o envio: grava o pedido e devolve o caminho; o navegador manda o arquivo direto ao
-- armazenamento e a API confere o conteúdo antes de valer.
create function comercial_documento_iniciar(i interessados, a aceites_proposta, p_dados jsonb, p_pelo_link boolean, p_ip text, p_pessoa uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_tipo text := comercial_texto(p_dados, 'tipo');
  v_nome text := comercial_texto(p_dados, 'nome');
  v_tamanho bigint := comercial_inteiro(p_dados, 'tamanho');
  v_cnpj text := nullif(regexp_replace(coalesce(p_dados ->> 'cnpj', ''), '[^0-9]', '', 'g'), '');
  v_mandato date := comercial_data(p_dados, 'mandatoAte');
  v_id uuid := gen_random_uuid();
  v_caminho text := comercial_caminho(i.id, v_id);
begin
  if v_tipo is null or v_tipo not in ('CNPJ', 'ATA_ELEICAO', 'ATA_APROVACAO') then perform recusar_campos('Escolha o documento', 'tipo'); end if;
  if coalesce(length(v_nome), 0) not between 1 and 200 then perform recusar_campos('Diga o nome do arquivo', 'nome'); end if;
  if v_tamanho is null or v_tamanho not between 1 and 10485760 then perform recusar_campos('Só PDF, até 10 MB', 'tamanho'); end if;
  if v_tipo = 'CNPJ' and not cnpj_valido(v_cnpj) then perform recusar_campos('CNPJ inválido', 'cnpj'); end if;
  if v_tipo = 'ATA_ELEICAO' and v_mandato is null then perform recusar_campos('Diga até quando vai o mandato', 'mandatoAte'); end if;
  if v_tipo = 'ATA_ELEICAO' and v_mandato < comercial_hoje() then perform recusar_campos('O mandato informado já acabou; envie a ata da eleição atual', 'mandatoAte'); end if;
  if i.virou_cliente_em is not null then perform recusar_motivo('Este interessado já virou cliente', 'VIROU_CLIENTE'); end if;
  if exists (select 1 from contratos_comercial where interessado_id = i.id and situacao = 'ASSINADO') then
    perform recusar_motivo('O contrato já foi assinado pelos dois', 'CONTRATO_ASSINADO');
  end if;
  perform comercial_exigir_envios_abertos(i.id);
  insert into documentos_aceite (id, interessado_id, aceite_id, tipo, nome, caminho, cnpj, mandato_ate, pelo_link, ip, enviado_por)
  values (v_id, i.id, a.id, v_tipo, v_nome, v_caminho, case when v_tipo = 'CNPJ' then v_cnpj end, case when v_tipo = 'ATA_ELEICAO' then v_mandato end,
          p_pelo_link, case when p_pelo_link and length(p_ip) between 3 and 45 then p_ip end, p_pessoa);
  return jsonb_build_object('documentoId', v_id, 'caminho', v_caminho, 'tipo', 'application/pdf');
end $$;

-- A API conferiu o conteúdo: recebido (o anterior do mesmo tipo fica substituído e o arquivo dele
-- vai para a fila de apagar) ou recusado com o motivo. Quem chama já travou o interessado e o
-- documento, nessa ordem. Depois do contrato assinado ou de virar cliente, nada substitui o
-- documento que o contrato usou: o envio é recusado e o arquivo vai para a fila de apagar.
create function comercial_documento_verificado(d documentos_aceite, p_liberado boolean, p_tamanho bigint, p_sha256 text, p_motivo text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r record;
  i interessados;
  v_nomes jsonb := '{"CNPJ": "Cartão do CNPJ", "ATA_ELEICAO": "Ata da eleição", "ATA_APROVACAO": "Ata de aprovação"}';
  v_tarde text;
begin
  if d.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  select * into i from interessados where id = d.interessado_id;
  v_tarde := case when i.anonimizado_em is not null then 'Os dados deste interessado foram apagados; o documento não foi guardado.'
                  when i.virou_cliente_em is not null then 'O condomínio já é cliente; o documento não foi guardado.'
                  when exists (select 1 from contratos_comercial where interessado_id = i.id and situacao = 'ASSINADO')
                    then 'O contrato já foi assinado pelos dois; o documento não foi guardado.' end;
  if v_tarde is not null then
    update documentos_aceite set situacao = 'RECUSADO', motivo_recusa = v_tarde where id = d.id returning * into d;
    perform enfileirar_arquivo('comercial', d.caminho, 'COMERCIAL_SUBSTITUIDO');
    perform comercial_historico('comercial.documento', 'documento_aceite', d.id::text, jsonb_build_object('tipo', d.tipo, 'situacao', d.situacao));
    return documento_aceite_json(d, false);
  end if;
  if p_liberado then
    if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' or p_tamanho is null or p_tamanho not between 1 and 10485760 then
      perform recusar_campos('Conferência sem o resumo ou o tamanho', 'sha256', 'tamanho');
    end if;
    for r in update documentos_aceite set situacao = 'SUBSTITUIDO', substituido_em = app_now()
              where interessado_id = d.interessado_id and tipo = d.tipo and situacao = 'RECEBIDO' returning caminho loop
      perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_SUBSTITUIDO');
    end loop;
    update documentos_aceite set situacao = 'RECEBIDO', recebido_em = app_now(), tamanho = p_tamanho, sha256 = p_sha256 where id = d.id
    returning * into d;
    perform comercial_inserir_conversa(d.interessado_id, case when d.pelo_link then 'PROPOSTA' else 'NOTA' end,
      format('%s recebido %s.', v_nomes ->> d.tipo, case when d.pelo_link then 'pelo link' else 'pela equipe' end), d.pelo_link, null, null);
  else
    update documentos_aceite set situacao = 'RECUSADO', motivo_recusa = left(coalesce(nullif(btrim(p_motivo), ''), 'O arquivo não pôde ser conferido.'), 300)
     where id = d.id
    returning * into d;
  end if;
  perform comercial_historico('comercial.documento', 'documento_aceite', d.id::text, jsonb_build_object('tipo', d.tipo, 'situacao', d.situacao));
  return documento_aceite_json(d, false);
end $$;

-- ---------------------------------------------------------------------------------------
-- Contrato gerado (quadro 440): o retrato dos dados, o PDF guardado e o sha256. Contrato e termo
-- num arquivo só; a impressão digital (sha256 do retrato) vai em cada folha.

create table contratos_comercial (
  id                 uuid primary key default gen_random_uuid(),
  interessado_id     uuid not null references interessados (id),
  versao_id          uuid not null references versoes_proposta (id),
  aceite_id          uuid not null references aceites_proposta (id),
  modelo_id          uuid not null references modelos_contrato (id),
  numero             integer not null check (numero between 1 and 99),
  situacao           text not null default 'GERANDO' check (situacao in ('GERANDO', 'AGUARDA_CONDOMINIO', 'AGUARDA_TRIADE', 'ASSINADO', 'SUBSTITUIDO')),
  -- O retrato do que o PDF diz: campos, texto, termo, modelo, proposta e a data da geração.
  dados              jsonb not null check (jsonb_typeof(dados) = 'object'),
  hash               text not null check (hash ~ '^[0-9a-f]{64}$'),
  caminho            text not null check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  pdf_sha256         text check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_tamanho        integer check (pdf_tamanho between 1 and 10485760),
  gerado_em          timestamptz not null default app_now(),
  gerado_por         uuid references pessoas (id),
  pronto_em          timestamptz,
  assinado_em        timestamptz,
  substituido_em     timestamptz,
  substituido_por    uuid references pessoas (id),
  substituido_motivo text check (length(btrim(substituido_motivo)) between 3 and 300),
  condominio_id      uuid references condominios (id),
  anonimizado_em     timestamptz,
  versao             integer not null default 1,
  unique (interessado_id, numero),
  check (situacao in ('GERANDO', 'SUBSTITUIDO') or (pdf_sha256 is not null and pdf_tamanho is not null and pronto_em is not null)),
  check ((situacao = 'ASSINADO') = (assinado_em is not null)),
  check ((situacao = 'SUBSTITUIDO') = (substituido_em is not null)),
  check (condominio_id is null or situacao = 'ASSINADO')
);
create unique index contratos_comercial_um_vigente on contratos_comercial (interessado_id) where situacao <> 'SUBSTITUIDO';
call proteger_tabela_comercial('contratos_comercial', 'console.comercial.editar',
  'Contratos gerados da proposta aceita, com o retrato dos dados, o PDF e o sha256; gerar de novo substitui o anterior');
create trigger contratos_comercial_sem_exclusao before delete on contratos_comercial for each row execute function somente_insercao();

-- O contrato gerado não muda: só anda a situação (gerando, aguarda o condomínio, aguarda a
-- TRÍADE, assinado ou substituído), o PDF é gravado uma vez e o cliente é ligado uma vez. A
-- anonimização (CM-12) é a única que troca o retrato.
create function contratos_comercial_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.interessado_id, new.versao_id, new.aceite_id, new.modelo_id, new.numero, new.hash, new.caminho, new.gerado_em, new.gerado_por)
     is distinct from (old.id, old.interessado_id, old.versao_id, old.aceite_id, old.modelo_id, old.numero, old.hash, old.caminho, old.gerado_em, old.gerado_por)
     or (new.dados is distinct from old.dados and not (comercial_sistema() and new.anonimizado_em is not null))
     or (old.pdf_sha256 is not null and (new.pdf_sha256, new.pdf_tamanho, new.pronto_em) is distinct from (old.pdf_sha256, old.pdf_tamanho, old.pronto_em))
     or (old.condominio_id is not null and new.condominio_id is distinct from old.condominio_id)
     or (new.situacao <> old.situacao
         and row(old.situacao, new.situacao) not in (row('GERANDO', 'AGUARDA_CONDOMINIO'), row('GERANDO', 'SUBSTITUIDO'),
                                                     row('AGUARDA_CONDOMINIO', 'AGUARDA_TRIADE'), row('AGUARDA_CONDOMINIO', 'SUBSTITUIDO'),
                                                     row('AGUARDA_TRIADE', 'ASSINADO'), row('AGUARDA_TRIADE', 'SUBSTITUIDO'))) then
    raise exception 'O contrato gerado não muda; gere de novo' using errcode = 'TC422', detail = '{"motivo":"CONTRATO_FIXO"}';
  end if;
  return new;
end $$;
create trigger contratos_comercial_regras before update on contratos_comercial for each row execute function contratos_comercial_regras();

-- ---------------------------------------------------------------------------------------
-- Envios do PDF assinado (quadros 441, 442 e 444): ordem fixa, condomínio e depois TRÍADE.

create table envios_contrato (
  id                uuid primary key default gen_random_uuid(),
  contrato_id       uuid not null references contratos_comercial (id),
  interessado_id    uuid not null references interessados (id),
  parte             text not null check (parte in ('CONDOMINIO', 'TRIADE')),
  situacao          text not null default 'ENVIANDO'
                    check (situacao in ('ENVIANDO', 'RECUSADO_NA_HORA', 'NAO_E_O_GERADO', 'A_CONFERIR', 'CONFERIDO', 'RECUSADO', 'SUBSTITUIDO')),
  nome              text check (length(btrim(nome)) between 1 and 200),
  tamanho           integer check (tamanho between 1 and 10485760),
  caminho           text not null check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  sha256            text check (sha256 ~ '^[0-9a-f]{64}$'),
  pelo_link         boolean not null,
  ip                text check (length(ip) between 3 and 45),
  enviado_por       uuid references pessoas (id),
  enviado_em        timestamptz not null default app_now(),
  -- A base da conferência automática: o PDF gerado (condomínio) ou o envio conferido do condomínio (TRÍADE).
  base_sha256       text not null check (base_sha256 ~ '^[0-9a-f]{64}$'),
  base_tamanho      integer not null check (base_tamanho between 1 and 10485760),
  base_assinaturas  integer not null check (base_assinaturas between 0 and 50),
  -- Conferência automática (no servidor).
  assinaturas       integer check (assinaturas between 0 and 1000),
  e_o_gerado        boolean,
  motivo_auto       text check (motivo_auto in ('ARQUIVO_INVALIDO', 'SEM_ASSINATURA', 'NAO_E_O_GERADO')),
  motivo_texto      text check (length(btrim(motivo_texto)) between 3 and 300),
  conferido_auto_em timestamptz,
  -- Conferência da equipe no validar.iti.gov.br (as três marcas do quadro 442).
  marca_valida      boolean,
  marca_pessoa      boolean,
  marca_data        boolean,
  assinante_nome    text check (length(btrim(assinante_nome)) between 2 and 120),
  cpf_mascarado     text check (cpf_mascarado ~ '^\*\*\*\.[0-9]{3}\.[0-9]{3}-\*\*$'),
  observacao        text check (length(btrim(observacao)) between 2 and 300),
  conferido_por     uuid references pessoas (id),
  conferido_em      timestamptz,
  recusa_motivo     text check (length(btrim(recusa_motivo)) between 3 and 300),
  recusado_por      uuid references pessoas (id),
  recusado_em       timestamptz,
  substituido_em    timestamptz,
  apagado_em        timestamptz,
  versao            integer not null default 1,
  check (pelo_link or enviado_por is not null),
  check (not pelo_link or parte = 'CONDOMINIO'),
  check (situacao = 'ENVIANDO' or conferido_auto_em is not null or situacao = 'SUBSTITUIDO'),
  check ((situacao = 'RECUSADO_NA_HORA') = (motivo_auto in ('ARQUIVO_INVALIDO', 'SEM_ASSINATURA')) or situacao = 'SUBSTITUIDO' and motivo_auto is null
         or (situacao <> 'RECUSADO_NA_HORA' and motivo_auto is null) or (situacao in ('NAO_E_O_GERADO', 'RECUSADO', 'SUBSTITUIDO') and motivo_auto = 'NAO_E_O_GERADO')),
  check (situacao <> 'CONFERIDO' or (marca_valida and marca_pessoa and marca_data and conferido_por is not null and conferido_em is not null
                                     and (cpf_mascarado is not null or apagado_em is not null))),
  check ((recusado_em is null) = (recusa_motivo is null) or apagado_em is not null),
  check (situacao <> 'RECUSADO' or recusado_em is not null)
);
create index envios_contrato_contrato on envios_contrato (contrato_id, parte, enviado_em desc);
create unique index envios_contrato_um_conferido on envios_contrato (contrato_id, parte) where situacao = 'CONFERIDO';
create unique index envios_contrato_um_a_conferir on envios_contrato (contrato_id, parte) where situacao = 'A_CONFERIR';
call proteger_tabela_comercial('envios_contrato', 'console.comercial.editar',
  'Envios do PDF assinado pelo gov.br, com a conferência automática e a da equipe; o arquivo fica no bucket comercial');
create trigger envios_contrato_sem_exclusao before delete on envios_contrato for each row execute function somente_insercao();

create function envios_contrato_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.contrato_id, new.interessado_id, new.parte, new.caminho, new.pelo_link, new.enviado_por, new.enviado_em,
      new.base_sha256, new.base_tamanho, new.base_assinaturas)
     is distinct from (old.id, old.contrato_id, old.interessado_id, old.parte, old.caminho, old.pelo_link, old.enviado_por, old.enviado_em,
                       old.base_sha256, old.base_tamanho, old.base_assinaturas)
     or (old.conferido_auto_em is not null
         and (new.sha256, new.tamanho, new.assinaturas, new.e_o_gerado, new.conferido_auto_em) is distinct from
             (old.sha256, old.tamanho, old.assinaturas, old.e_o_gerado, old.conferido_auto_em))
     or (old.conferido_em is not null and (new.conferido_em, new.conferido_por) is distinct from (old.conferido_em, old.conferido_por)) then
    raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
  end if;
  if new.situacao = old.situacao then
    -- Sem mudar de situação, só a anonimização (CM-12) mexe no envio.
    if comercial_sistema() and new.apagado_em is not null then return new; end if;
    raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
  end if;
  if row(old.situacao, new.situacao) in (row('ENVIANDO', 'RECUSADO_NA_HORA'), row('ENVIANDO', 'NAO_E_O_GERADO'), row('ENVIANDO', 'A_CONFERIR'),
                                         row('ENVIANDO', 'SUBSTITUIDO'), row('A_CONFERIR', 'CONFERIDO'), row('A_CONFERIR', 'RECUSADO'),
                                         row('A_CONFERIR', 'SUBSTITUIDO'), row('NAO_E_O_GERADO', 'RECUSADO'), row('NAO_E_O_GERADO', 'SUBSTITUIDO'),
                                         row('CONFERIDO', 'SUBSTITUIDO')) then
    return new;
  end if;
  raise exception 'O envio não muda' using errcode = 'TC422', detail = '{"motivo":"ENVIO_FIXO"}';
end $$;
create trigger envios_contrato_regras before update on envios_contrato for each row execute function envios_contrato_regras();

create function envio_contrato_json(e envios_contrato, p_interno boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id, 'parte', e.parte, 'situacao', e.situacao, 'enviadoEm', e.enviado_em, 'peloLink', e.pelo_link,
    'nome', e.nome, 'tamanho', e.tamanho,
    'motivo', coalesce(e.motivo_auto, case when e.situacao = 'RECUSADO' then 'RECUSADO_NA_CONFERENCIA' end),
    'motivoTexto', coalesce(e.recusa_motivo, e.motivo_texto),
    'conferidoEm', e.conferido_em))
  || case when p_interno then jsonb_strip_nulls(jsonb_build_object(
       'versao', e.versao, 'enviadoPor', comercial_pessoa_json(e.enviado_por), 'sha256', e.sha256,
       'automatica', case when e.conferido_auto_em is not null then jsonb_build_object(
          'temAssinatura', coalesce(e.assinaturas, 0) > e.base_assinaturas, 'assinaturas', e.assinaturas, 'eOGerado', e.e_o_gerado,
          'em', e.conferido_auto_em) end,
       'conferencia', case when e.conferido_em is not null then jsonb_strip_nulls(jsonb_build_object(
          'assinaturaValida', e.marca_valida, 'pessoaConfere', e.marca_pessoa, 'dataConfere', e.marca_data,
          'assinanteNome', e.assinante_nome, 'cpfMascarado', e.cpf_mascarado, 'observacao', e.observacao,
          'por', comercial_pessoa_json(e.conferido_por), 'em', e.conferido_em)) end,
       'recusa', case when e.recusado_em is not null then jsonb_build_object('motivo', e.recusa_motivo, 'por', comercial_pessoa_json(e.recusado_por),
                                                                            'em', e.recusado_em) end))
          else '{}'::jsonb end
$$;

-- A situação de cada assinatura, como a tela e o link mostram.
create function contrato_assinatura_json(c contratos_comercial, p_parte text) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_strip_nulls(jsonb_build_object('situacao', 'CONFERIDA', 'enviadoEm', e.enviado_em, 'conferidoEm', e.conferido_em,
                                                 'assinanteNome', e.assinante_nome))
       from envios_contrato e where e.contrato_id = c.id and e.parte = p_parte and e.situacao = 'CONFERIDO'),
    (select jsonb_strip_nulls(jsonb_build_object('situacao', case e.situacao when 'A_CONFERIR' then 'A_CONFERIR' when 'RECUSADO' then 'RECUSADA'
                                                                             when 'ENVIANDO' then 'AGUARDANDO' else e.motivo_auto end,
                                                 'enviadoEm', e.enviado_em, 'motivoTexto', coalesce(e.recusa_motivo, e.motivo_texto)))
       from envios_contrato e where e.contrato_id = c.id and e.parte = p_parte and e.situacao <> 'SUBSTITUIDO'
      order by e.enviado_em desc, e.id desc limit 1),
    jsonb_build_object('situacao', case when p_parte = 'TRIADE' and c.situacao in ('GERANDO', 'AGUARDA_CONDOMINIO') then 'ESPERA_CONDOMINIO'
                                        else 'AGUARDANDO' end))
$$;

create function contrato_comercial_json(c contratos_comercial, p_interno boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'numero', c.numero, 'situacao', c.situacao, 'hash', c.hash, 'geradoEm', c.gerado_em, 'prontoEm', c.pronto_em,
    'assinadoEm', c.assinado_em, 'dataInicio', c.dados ->> 'dataInicio',
    'modelo', (select jsonb_build_object('numero', m.numero, 'titulo', m.titulo) from modelos_contrato m where m.id = c.modelo_id),
    'assinaturas', jsonb_build_object('condominio', contrato_assinatura_json(c, 'CONDOMINIO'), 'triade', contrato_assinatura_json(c, 'TRIADE')),
    'podeBaixar', c.situacao in ('AGUARDA_CONDOMINIO', 'AGUARDA_TRIADE', 'ASSINADO'),
    'finalDisponivel', c.situacao = 'ASSINADO'))
  || case when p_interno then jsonb_strip_nulls(jsonb_build_object(
       'versao', c.versao, 'pdfSha256', c.pdf_sha256, 'pdfTamanho', c.pdf_tamanho, 'geradoPor', comercial_pessoa_json(c.gerado_por),
       'campos', comercial_campos_leitura(c.dados -> 'campos'), 'substituidoEm', c.substituido_em, 'substituidoMotivo', c.substituido_motivo,
       'substituidoPor', comercial_pessoa_json(c.substituido_por), 'anonimizado', c.anonimizado_em is not null))
          else '{}'::jsonb end
$$;

create function comercial_contrato_vigente(p_interessado uuid) returns contratos_comercial
language sql stable
set search_path = public
as $$ select * from contratos_comercial where interessado_id = p_interessado and situacao <> 'SUBSTITUIDO' $$;

-- O retrato do contrato: os campos «...» preenchidos e o texto do modelo com eles.
create function comercial_retrato_contrato(m modelos_contrato, v versoes_proposta, a aceites_proposta, p_cnpj text, p_mandato date,
                                           p_data_inicio date, p_numero integer) returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  f faixas_preco;
  pp parametros_preco;
  v_campos jsonb;
  v_texto text := m.texto;
  v_termo text := m.termo;
  k text;
begin
  select * into f from faixas_preco where codigo = v.faixa;
  select * into pp from parametros_preco;
  v_campos := jsonb_build_object(
    'condominio', v.condominio,
    'cnpj', comercial_cnpj_formatado(p_cnpj),
    'representante', a.nome,
    'cpf_representante', comercial_cpf_formatado(a.cpf),
    'mandato_ate', comercial_data_br(p_mandato),
    'plano', case v.ciclo when 'ANUAL' then 'Anual' else 'Mensal' end || ' · '
             || case v.tabela when 'FUNDADOR' then 'preço de fundador por 12 meses' when 'CHEIA' then 'tabela cheia' else 'sob consulta' end
             || ' · ' || v.unidades || ' unidades (' || lower(f.nome) || ')',
    'valor_mensal', comercial_reais(v.mensal_centavos) || ' por mês',
    'valor_anual', case when v.ciclo = 'ANUAL' then comercial_reais(v.anual_centavos) || ' por ano (' || v.meses_pagos_anual || ' meses pagos)'
                        else 'Não se aplica (ciclo mensal)' end,
    'implantacao', case when v.implantacao_sem_custo or v.implantacao_centavos is null then 'Sem custo'
                        else comercial_reais(v.implantacao_centavos) || ' em ' || coalesce(v.implantacao_parcelas, pp.parcelas_implantacao) || ' parcelas' end,
    'desconto', case when v.desconto_percentual is not null
                     then replace(trim_scale(v.desconto_percentual)::text, '.', ',') || '% na mensalidade, aprovado pela Administração'
                     else 'Sem desconto' end,
    'data_inicio', comercial_data_br(p_data_inicio),
    'indice_reajuste', m.indice_reajuste);
  for k in select jsonb_object_keys(v_campos) loop
    v_texto := replace(v_texto, '«' || k || '»', v_campos ->> k);
    v_termo := replace(v_termo, '«' || k || '»', v_campos ->> k);
  end loop;
  return jsonb_build_object(
    'numero', p_numero, 'titulo', m.titulo, 'texto', v_texto, 'termo', v_termo, 'campos', v_campos,
    'modelo', jsonb_build_object('numero', m.numero, 'advogado', m.advogado_nome, 'oab', m.advogado_oab, 'revisadoEm', m.revisado_em),
    'proposta', jsonb_build_object('numero', v.numero, 'hash', v.hash, 'aceitaEm', a.aceito_em),
    'geradoEm', to_char(app_now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'),
    'dataInicio', p_data_inicio,
    -- As parcelas da implantação que o contrato promete (virar cliente cobra assim).
    'implantacaoParcelas', case when v.implantacao_sem_custo or v.implantacao_centavos is null then null
                                else coalesce(v.implantacao_parcelas, pp.parcelas_implantacao) end);
end $$;

-- O que impede gerar, na ordem em que a tela mostra (quadros 336 e 444).
create function comercial_motivo_sem_gerar(i interessados) returns text
language sql stable
set search_path = public
as $$
  select case
    when i.anonimizado_em is not null then 'ANONIMIZADO'
    when i.virou_cliente_em is not null then 'VIROU_CLIENTE'
    when not comercial_aberta(i.etapa) then 'INTERESSADO_FECHADO'
    when (comercial_aceite_do_interessado(i.id)).id is null then 'SEM_ACEITE'
    when exists (select 1 from contratos_comercial c where c.interessado_id = i.id and c.situacao = 'ASSINADO') then 'CONTRATO_ASSINADO'
    when not exists (select 1 from modelos_contrato where situacao = 'EM_USO') then 'SEM_MODELO_CONTRATO'
    when cardinality(comercial_documentos_faltam(i.id)) > 0 then 'FALTA_DOCUMENTO'
  end
$$;

-- Gerar contrato (quadro 440). Gerar de novo substitui o anterior e zera as assinaturas. Devolve
-- o retrato para a API montar o PDF, que volta por comercial_contrato_pronto.
create function comercial_gerar_contrato(p_pessoa uuid, p_interessado uuid, p_data_inicio date, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  a aceites_proposta;
  v versoes_proposta;
  m modelos_contrato;
  c_ant contratos_comercial;
  d_cnpj documentos_aceite;
  d_ata documentos_aceite;
  v_motivo text;
  v_numero integer;
  v_dados jsonb;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into i from interessados where id = p_interessado for update;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  v_motivo := comercial_motivo_sem_gerar(i);
  if v_motivo = 'FALTA_DOCUMENTO' then
    raise exception 'Falta o CNPJ ou a ata da eleição com o fim do mandato' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'FALTA_DOCUMENTO', 'faltam', to_jsonb(comercial_documentos_faltam(i.id)))::text;
  elsif v_motivo is not null then
    perform recusar_motivo(case v_motivo
      when 'SEM_MODELO_CONTRATO' then 'Nenhuma versão do modelo de contrato está em uso; cadastre em Modelos › Contrato'
      when 'SEM_ACEITE' then 'O contrato sai da proposta aceita'
      when 'CONTRATO_ASSINADO' then 'O contrato já foi assinado pelos dois; mudança agora é aditivo'
      when 'VIROU_CLIENTE' then 'Este interessado já virou cliente'
      when 'ANONIMIZADO' then 'Interessado anonimizado não muda'
      else 'Interessado fechado não recebe contrato' end, v_motivo);
  end if;
  if p_data_inicio is null or p_data_inicio < comercial_hoje() or p_data_inicio > comercial_hoje() + 180 then
    perform recusar_campos('A data de início vai de hoje a 180 dias', 'dataInicio');
  end if;
  a := comercial_aceite_do_interessado(i.id);
  if a.anonimizado_em is not null then perform recusar_motivo('O aceite foi anonimizado', 'ANONIMIZADO'); end if;
  select * into v from versoes_proposta where id = a.versao_id;
  select * into m from modelos_contrato where situacao = 'EM_USO';
  select * into c_ant from contratos_comercial where interessado_id = i.id and situacao <> 'SUBSTITUIDO' for update;
  if c_ant.id is not null and coalesce(length(btrim(p_motivo)), 0) not between 3 and 300 then
    perform recusar_campos('Diga por que gerar de novo (as assinaturas começam do zero)', 'motivo');
  end if;
  d_cnpj := comercial_documento_recebido(i.id, 'CNPJ');
  d_ata := comercial_documento_recebido(i.id, 'ATA_ELEICAO');
  select coalesce(max(numero), 0) + 1 into v_numero from contratos_comercial where interessado_id = i.id;
  v_dados := comercial_retrato_contrato(m, v, a, d_cnpj.cnpj, d_ata.mandato_ate, p_data_inicio, v_numero);
  if c_ant.id is not null then
    update contratos_comercial set situacao = 'SUBSTITUIDO', substituido_em = app_now(), substituido_por = p_pessoa, substituido_motivo = btrim(p_motivo)
     where id = c_ant.id;
    update envios_contrato set situacao = 'SUBSTITUIDO', substituido_em = app_now()
     where contrato_id = c_ant.id and situacao in ('ENVIANDO', 'A_CONFERIR', 'CONFERIDO', 'NAO_E_O_GERADO');
  end if;
  v_caminho := comercial_caminho(i.id, v_id);
  insert into contratos_comercial (id, interessado_id, versao_id, aceite_id, modelo_id, numero, dados, hash, caminho, gerado_por)
  values (v_id, i.id, v.id, a.id, m.id, v_numero, v_dados, comercial_hash(v_dados), v_caminho, p_pessoa);
  perform comercial_inserir_conversa(i.id, 'NOTA',
    format('Contrato nº %s gerado do modelo v%s%s.', v_numero, m.numero, case when c_ant.id is not null then format(' (substitui o nº %s; assinaturas zeradas)', c_ant.numero) else '' end),
    false, null, null);
  perform registrar_historico_interno('comercial.contrato_gerado', 'contrato_comercial', v_id::text,
    jsonb_strip_nulls(jsonb_build_object('numero', v_numero, 'modelo', m.numero, 'substitui', c_ant.numero)));
  return jsonb_build_object('contratoId', v_id, 'numero', v_numero, 'hash', comercial_hash(v_dados), 'caminho', v_caminho, 'dados', v_dados);
end $$;

-- O PDF montado e guardado pela API: o sha256 do arquivo e o tamanho. Daí o condomínio já baixa.
create function comercial_contrato_pronto(p_pessoa uuid, p_contrato uuid, p_sha256 text, p_tamanho bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c contratos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  select * into c from contratos_comercial where id = p_contrato for update;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  if c.situacao <> 'GERANDO' then perform recusar_motivo('Este contrato já foi montado ou substituído', 'CONTRATO_PRONTO'); end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' or p_tamanho is null or p_tamanho not between 1 and 10485760 then
    perform recusar_campos('O PDF montado precisa do resumo e do tamanho', 'sha256', 'tamanho');
  end if;
  update contratos_comercial set situacao = 'AGUARDA_CONDOMINIO', pdf_sha256 = p_sha256, pdf_tamanho = p_tamanho, pronto_em = app_now()
   where id = c.id
  returning * into c;
  return contrato_comercial_json(c, true);
end $$;

-- Começar o envio do PDF assinado. Ordem fixa: o condomínio enquanto aguarda o condomínio; a
-- TRÍADE (quem assina por ela) só depois de conferida a assinatura do condomínio.
create function comercial_envio_iniciar(c contratos_comercial, p_parte text, p_dados jsonb, p_pelo_link boolean, p_ip text, p_pessoa uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  e_base envios_contrato;
  v_nome text := comercial_texto(p_dados, 'nome');
  v_tamanho bigint := comercial_inteiro(p_dados, 'tamanho');
  v_id uuid := gen_random_uuid();
  v_caminho text := comercial_caminho(c.interessado_id, v_id);
begin
  if p_parte is null or p_parte not in ('CONDOMINIO', 'TRIADE') then perform recusar_campos('Diga quem assinou', 'parte'); end if;
  if c.situacao = 'GERANDO' then perform recusar_motivo('O contrato ainda está sendo montado', 'CONTRATO_GERANDO'); end if;
  if c.situacao = 'ASSINADO' then perform recusar_motivo('O contrato já foi assinado pelos dois', 'CONTRATO_ASSINADO'); end if;
  if c.situacao = 'SUBSTITUIDO' then perform recusar_motivo('Este contrato foi gerado de novo; envie o novo', 'CONTRATO_SUBSTITUIDO'); end if;
  if p_parte = 'CONDOMINIO' and c.situacao <> 'AGUARDA_CONDOMINIO' then
    perform recusar_motivo('A assinatura do condomínio já foi conferida', 'CONDOMINIO_JA_CONFERIDO');
  end if;
  if p_parte = 'TRIADE' and c.situacao <> 'AGUARDA_TRIADE' then
    perform recusar_motivo('Primeiro o condomínio assina e a equipe confere; depois a TRÍADE assina sobre esse arquivo', 'ORDEM_DAS_ASSINATURAS');
  end if;
  if coalesce(length(v_nome), 0) not between 1 and 200 then perform recusar_campos('Diga o nome do arquivo', 'nome'); end if;
  if v_tamanho is null or v_tamanho not between 1 and 10485760 then perform recusar_campos('Só PDF, até 10 MB', 'tamanho'); end if;
  if p_parte = 'TRIADE' then
    select * into e_base from envios_contrato where contrato_id = c.id and parte = 'CONDOMINIO' and situacao = 'CONFERIDO';
  end if;
  perform comercial_exigir_envios_abertos(c.interessado_id);
  insert into envios_contrato (id, contrato_id, interessado_id, parte, nome, caminho, pelo_link, ip, enviado_por, base_sha256, base_tamanho, base_assinaturas)
  values (v_id, c.id, c.interessado_id, p_parte, v_nome, v_caminho, p_pelo_link, case when p_pelo_link and length(p_ip) between 3 and 45 then p_ip end,
          p_pessoa, coalesce(e_base.sha256, c.pdf_sha256), coalesce(e_base.tamanho, c.pdf_tamanho), coalesce(e_base.assinaturas, 0));
  return jsonb_build_object('envioId', v_id, 'caminho', v_caminho, 'tipo', 'application/pdf');
end $$;

-- A base que a API lê para conferir o envio: o PDF gerado (condomínio) ou o envio conferido do
-- condomínio (TRÍADE), com o resumo e o tamanho que o banco guardou. Sem base (o contrato foi gerado
-- de novo), a API manda o envio como inválido e a conferência o dá por substituído.
create function comercial_envio_base(e envios_contrato) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object('caminho', e.caminho, 'tipo', 'application/pdf', 'baseTamanho', e.base_tamanho, 'baseSha256', e.base_sha256,
    'baseCaminho', case e.parte
      when 'CONDOMINIO' then (select c.caminho from contratos_comercial c where c.id = e.contrato_id and c.pdf_sha256 = e.base_sha256)
      else (select x.caminho from envios_contrato x where x.contrato_id = e.contrato_id and x.parte = 'CONDOMINIO' and x.situacao = 'CONFERIDO'
                                                     and x.sha256 = e.base_sha256 and x.apagado_em is null) end)
$$;

-- A conferência automática feita pela API: {valido, motivo, sha256, tamanho, assinaturas,
-- assinaturaNova, soAssinatura, prefixoSha256}. Sem assinatura nova (um /Sig de verdade que cobre
-- além da base): recusado na hora (a API apaga o arquivo). Assinado sobre outro conteúdo (o começo
-- não é a base, ou a parte acrescentada traz mais que a assinatura, ou falta a resposta): guardado,
-- não conta. Senão, fica para a equipe conferir. Quem chama já travou o contrato e o envio, nessa ordem.
create function comercial_envio_verificado(e envios_contrato, p_res jsonb) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  c contratos_comercial;
  v_valido boolean := coalesce((p_res ->> 'valido')::boolean, false);
  v_assinaturas bigint := comercial_inteiro(p_res, 'assinaturas');
  v_nova boolean := coalesce((p_res ->> 'assinaturaNova')::boolean, false);
  v_so boolean := coalesce((p_res ->> 'soAssinatura')::boolean, false);
  v_tamanho bigint := comercial_inteiro(p_res, 'tamanho');
  v_sha text := p_res ->> 'sha256';
  v_prefixo text := p_res ->> 'prefixoSha256';
  v_situacao text;
  v_motivo text;
  v_texto text;
  v_gerado boolean;
begin
  if e.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  select * into c from contratos_comercial where id = e.contrato_id for update;
  if c.situacao = 'SUBSTITUIDO' or (e.parte = 'CONDOMINIO' and c.situacao <> 'AGUARDA_CONDOMINIO') or (e.parte = 'TRIADE' and c.situacao <> 'AGUARDA_TRIADE') then
    update envios_contrato set situacao = 'SUBSTITUIDO', substituido_em = app_now() where id = e.id returning * into e;
    perform enfileirar_arquivo('comercial', e.caminho, 'COMERCIAL_SUBSTITUIDO');
    return envio_contrato_json(e, false) || jsonb_build_object('apagarArquivo', false);
  end if;
  if v_valido and (v_sha is null or v_sha !~ '^[0-9a-f]{64}$' or v_tamanho is null or v_tamanho not between 1 and 10485760 or v_assinaturas is null) then
    perform recusar_campos('Conferência incompleta', 'sha256', 'tamanho', 'assinaturas');
  end if;
  v_gerado := coalesce(v_valido and v_tamanho > e.base_tamanho and v_prefixo = e.base_sha256 and v_so, false);
  if not v_valido then
    v_situacao := 'RECUSADO_NA_HORA';
    v_motivo := 'ARQUIVO_INVALIDO';
    v_texto := left(coalesce(nullif(btrim(p_res ->> 'motivo'), ''), 'O arquivo não é um PDF que dá para conferir.'), 300);
  elsif not v_nova or v_assinaturas <= e.base_assinaturas then
    v_situacao := 'RECUSADO_NA_HORA';
    v_motivo := 'SEM_ASSINATURA';
    v_texto := 'O PDF enviado não tem assinatura digital nova. Assine pelo gov.br e envie o arquivo que ele devolver.';
  elsif not v_gerado then
    v_situacao := 'NAO_E_O_GERADO';
    v_motivo := 'NAO_E_O_GERADO';
    v_texto := 'O conteúdo assinado não é o contrato gerado. Baixe o contrato, assine sem mudar nada e envie de novo.';
  else
    v_situacao := 'A_CONFERIR';
    update envios_contrato set situacao = 'SUBSTITUIDO', substituido_em = app_now()
     where contrato_id = c.id and parte = e.parte and situacao in ('A_CONFERIR', 'NAO_E_O_GERADO');
  end if;
  update envios_contrato set situacao = v_situacao, motivo_auto = v_motivo, motivo_texto = v_texto, sha256 = case when v_valido then v_sha end,
         tamanho = case when v_valido then v_tamanho end, assinaturas = case when v_valido then v_assinaturas end,
         e_o_gerado = case when v_valido then v_gerado end, conferido_auto_em = app_now(),
         apagado_em = case when v_situacao = 'RECUSADO_NA_HORA' then app_now() end
   where id = e.id
  returning * into e;
  if e.pelo_link then
    perform comercial_inserir_conversa(e.interessado_id, 'PROPOSTA',
      format('PDF assinado enviado pelo link: %s.', case v_situacao when 'A_CONFERIR' then 'falta a equipe conferir no validador'
                                                                      when 'NAO_E_O_GERADO' then 'não é o contrato gerado (guardado, não conta)'
                                                                      else 'recusado na hora' end), true, null, null);
  end if;
  perform comercial_historico('comercial.contrato_envio', 'contrato_comercial', c.id::text,
    jsonb_strip_nulls(jsonb_build_object('parte', e.parte, 'situacao', e.situacao, 'motivo', v_motivo)));
  return envio_contrato_json(e, false) || jsonb_build_object('apagarArquivo', v_situacao = 'RECUSADO_NA_HORA');
end $$;

-- O envio, com o contrato travado antes (gerar de novo trava o contrato e depois os envios; travar
-- na outra ordem dava impasse).
create function comercial_travar_envio(p_envio uuid, p_interessado uuid, p_pelo_link boolean) returns envios_contrato
language plpgsql
set search_path = public
as $$
declare e envios_contrato;
begin
  perform 1 from contratos_comercial
   where id = (select contrato_id from envios_contrato where id = p_envio and (p_interessado is null or interessado_id = p_interessado))
     for update;
  select * into e from envios_contrato where id = p_envio and (p_interessado is null or interessado_id = p_interessado)
                                         and (not p_pelo_link or pelo_link) for update;
  if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  return e;
end $$;

-- ---------------------------------------------------------------------------------------
-- Contrato no Console (quadros 440 e 442).

create function comercial_contrato(p_pessoa uuid, p_interessado uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  a aceites_proposta;
  c contratos_comercial;
  v_motivo text;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_interessado);
  a := comercial_aceite_do_interessado(i.id);
  c := comercial_contrato_vigente(i.id);
  v_motivo := comercial_motivo_sem_gerar(i);
  if not comercial_ve_cliente(i) then
    -- Virou cliente: o contrato fica na ficha do cliente; o Comercial vê só que foi assinado.
    return jsonb_strip_nulls(jsonb_build_object(
      'interessado', jsonb_build_object('id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'etapa', i.etapa),
      'documentos', '[]'::jsonb, 'faltam', '[]'::jsonb, 'envios', '[]'::jsonb, 'anteriores', '[]'::jsonb,
      'contrato', case when c.id is not null then jsonb_strip_nulls(jsonb_build_object('id', c.id, 'numero', c.numero, 'situacao', c.situacao,
                                                                                         'assinadoEm', c.assinado_em)) end,
      'podeGerar', false, 'motivoSemGerar', v_motivo, 'podeConferir', false, 'podeAssinar', false, 'podeVirarCliente', false,
      'virouClienteEm', i.virou_cliente_em, 'restrito', true));
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'interessado', jsonb_build_object('id', i.id, 'versao', i.versao, 'condominio', i.condominio, 'etapa', i.etapa),
    'aceite', case when a.id is not null then jsonb_strip_nulls(jsonb_build_object(
       'proposta', (select v.numero from versoes_proposta v where v.id = a.versao_id), 'nome', a.nome, 'cargo', a.cargo,
       'cpfMascarado', comercial_cpf_mascarado(a.cpf), 'aceitoEm', a.aceito_em,
       'linkAte', (a.aceito_em + make_interval(days => configuracao_int('contrato_link_dias')))::date)) end,
    'documentos', coalesce((select jsonb_agg(documento_aceite_json(d, true) order by d.enviado_em desc)
                              from documentos_aceite d where d.interessado_id = i.id), '[]'::jsonb),
    'faltam', to_jsonb(comercial_documentos_faltam(i.id)),
    'modeloEmUso', (select jsonb_build_object('id', m.id, 'numero', m.numero, 'titulo', m.titulo) from modelos_contrato m where m.situacao = 'EM_USO'),
    'podeGerar', pode_global('console.comercial.editar') and (v_motivo is null),
    'motivoSemGerar', v_motivo,
    'contrato', case when c.id is not null then contrato_comercial_json(c, true) end,
    'dadosMudaram', c.id is not null and (
       c.dados -> 'campos' ->> 'cnpj' is distinct from (select comercial_cnpj_formatado(d.cnpj) from comercial_documento_recebido(i.id, 'CNPJ') d)
       or c.dados -> 'campos' ->> 'mandato_ate' is distinct from (select comercial_data_br(d.mandato_ate) from comercial_documento_recebido(i.id, 'ATA_ELEICAO') d)),
    'envios', case when c.id is not null then coalesce((select jsonb_agg(envio_contrato_json(e, true) order by e.enviado_em desc)
                                                          from envios_contrato e where e.contrato_id = c.id), '[]'::jsonb) end,
    'anteriores', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x.id, 'numero', x.numero, 'geradoEm', x.gerado_em,
                                                                                 'substituidoEm', x.substituido_em, 'motivo', x.substituido_motivo))
                                             order by x.numero desc)
                              from contratos_comercial x where x.interessado_id = i.id and x.situacao = 'SUBSTITUIDO'), '[]'::jsonb),
    'podeConferir', pode_global('console.comercial.editar'),
    'podeAssinar', pode_global('console.comercial.assinar'),
    'podeVirarCliente', pode_global('console.comercial.cliente') and pode_global('console.condominios.criar') and c.situacao = 'ASSINADO'
                        and i.virou_cliente_em is null and i.anonimizado_em is null,
    'virouClienteEm', i.virou_cliente_em));
end $$;

-- Contrato no Console por id: busca e confere que é do interessado.
create function comercial_buscar_contrato(p_id uuid) returns contratos_comercial
language plpgsql
set search_path = public
as $$
declare c contratos_comercial;
begin
  select * into c from contratos_comercial where id = p_id;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  return c;
end $$;

create function comercial_buscar_envio(p_id uuid) returns envios_contrato
language plpgsql
set search_path = public
as $$
declare e envios_contrato;
begin
  select * into e from envios_contrato where id = p_id;
  if not found then raise exception 'Envio não encontrado' using errcode = 'TC404'; end if;
  return e;
end $$;

create function comercial_buscar_documento(p_id uuid) returns documentos_aceite
language plpgsql
set search_path = public
as $$
declare d documentos_aceite;
begin
  select * into d from documentos_aceite where id = p_id;
  if not found then raise exception 'Documento não encontrado' using errcode = 'TC404'; end if;
  return d;
end $$;

-- Depois de virar cliente, o Comercial deixa de ver os arquivos do condomínio (CM-11): o contrato
-- assinado fica na ficha do cliente.
create function comercial_exigir_nao_cliente(p_interessado uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from interessados where id = p_interessado and virou_cliente_em is not null) then
    perform recusar_motivo('Este interessado virou cliente; o contrato fica na ficha do cliente', 'VIROU_CLIENTE');
  end if;
end $$;

-- Documentos pela equipe (quando o síndico manda por outro canal).
create function comercial_iniciar_documento(p_pessoa uuid, p_interessado uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  a aceites_proposta;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_interessado);
  perform comercial_exigir_aberto(i);
  a := comercial_aceite_do_interessado(i.id);
  if a.id is null then perform recusar_motivo('Os documentos vêm depois do aceite da proposta', 'SEM_ACEITE'); end if;
  return comercial_documento_iniciar(i, a, p_dados, false, null, p_pessoa);
end $$;

create function comercial_documento_a_verificar(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d documentos_aceite;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  d := comercial_buscar_documento(p_id);
  if d.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  return jsonb_build_object('caminho', d.caminho, 'tipo', 'application/pdf');
end $$;

create function comercial_verificar_documento(p_pessoa uuid, p_id uuid, p_liberado boolean, p_tamanho bigint, p_sha256 text, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d documentos_aceite;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  -- O interessado antes do documento (a mesma ordem de gerar o contrato).
  perform 1 from interessados where id = (select interessado_id from documentos_aceite where id = p_id) for update;
  select * into d from documentos_aceite where id = p_id for update;
  if not found then raise exception 'Documento não encontrado' using errcode = 'TC404'; end if;
  return comercial_documento_verificado(d, p_liberado, p_tamanho, p_sha256, p_motivo);
end $$;

create function comercial_abrir_documento(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d documentos_aceite;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  d := comercial_buscar_documento(p_id);
  perform comercial_exigir_nao_cliente(d.interessado_id);
  if d.situacao not in ('RECEBIDO', 'SUBSTITUIDO') or d.apagado_em is not null then
    raise exception 'Documento não encontrado' using errcode = 'TC404';
  end if;
  perform registrar_historico_interno('comercial.documento_aberto', 'documento_aceite', d.id::text, jsonb_build_object('tipo', d.tipo));
  return jsonb_build_object('caminho', d.caminho, 'nome', d.nome, 'tipo', 'application/pdf');
end $$;

-- Baixar o PDF gerado ou um envio (o envio da TRÍADE conferido é o PDF final).
create function comercial_abrir_contrato(p_pessoa uuid, p_contrato uuid, p_envio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contratos_comercial;
  e envios_contrato;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  c := comercial_buscar_contrato(p_contrato);
  perform comercial_exigir_nao_cliente(c.interessado_id);
  if c.anonimizado_em is not null then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  if p_envio is null then
    if c.pdf_sha256 is null then perform recusar_motivo('O contrato ainda está sendo montado', 'CONTRATO_GERANDO'); end if;
    perform registrar_historico_interno('comercial.contrato_aberto', 'contrato_comercial', c.id::text, jsonb_build_object('numero', c.numero));
    return jsonb_build_object('caminho', c.caminho, 'nome', format('contrato-%s.pdf', c.numero), 'tipo', 'application/pdf');
  end if;
  e := comercial_buscar_envio(p_envio);
  if e.contrato_id <> c.id or e.apagado_em is not null or e.situacao in ('ENVIANDO', 'RECUSADO_NA_HORA') then
    raise exception 'Envio não encontrado' using errcode = 'TC404';
  end if;
  perform registrar_historico_interno('comercial.contrato_aberto', 'contrato_comercial', c.id::text, jsonb_build_object('numero', c.numero, 'parte', e.parte));
  return jsonb_build_object('caminho', e.caminho, 'nome', coalesce(e.nome, format('contrato-%s-assinado.pdf', c.numero)), 'tipo', 'application/pdf');
end $$;

-- O PDF assinado pela equipe: a TRÍADE (quem assina por ela) ou o do condomínio que chegou por
-- outro canal.
create function comercial_iniciar_envio(p_pessoa uuid, p_contrato uuid, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contratos_comercial;
  i interessados;
  v_parte text := coalesce(comercial_texto(p_dados, 'parte'), 'TRIADE');
begin
  perform entrar_console(p_pessoa, case when v_parte = 'TRIADE' then 'console.comercial.assinar' else 'console.comercial.editar' end);
  select * into c from contratos_comercial where id = p_contrato for update;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  i := comercial_buscar(c.interessado_id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  return comercial_envio_iniciar(c, v_parte, p_dados, false, null, p_pessoa);
end $$;

create function comercial_envio_a_verificar(p_pessoa uuid, p_envio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_contrato;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_buscar_envio(p_envio);
  if e.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  return comercial_envio_base(e);
end $$;

create function comercial_verificar_envio(p_pessoa uuid, p_envio uuid, p_resultado jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_contrato;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio(p_envio, null, false);
  return comercial_envio_verificado(e, p_resultado);
end $$;

-- Conferir no validador (quadro 442): as três marcas obrigatórias. Do condomínio, quem assinou é
-- a pessoa do aceite (o CPF, se digitado, tem de ser o do aceite); da TRÍADE, o CPF que o
-- validador mostra. Guarda só o CPF mascarado.
create function comercial_conferir_envio(p_pessoa uuid, p_envio uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_contrato;
  c contratos_comercial;
  a aceites_proposta;
  v_falta text[];
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  v_nome text;
  v_obs text := comercial_texto(p_dados, 'observacao');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio(p_envio, null, false);
  if e.versao <> p_versao then perform conflito_versao('envios_contrato', p_envio); end if;
  if e.situacao <> 'A_CONFERIR' then
    perform recusar_motivo('Só o envio que passou na conferência automática é conferido', 'ENVIO_NAO_CONFERIVEL');
  end if;
  select * into c from contratos_comercial where id = e.contrato_id for update;
  v_falta := array_remove(array[case when coalesce((p_dados ->> 'assinaturaValida')::boolean, false) is not true then 'assinaturaValida' end,
                                case when coalesce((p_dados ->> 'pessoaConfere')::boolean, false) is not true then 'pessoaConfere' end,
                                case when coalesce((p_dados ->> 'dataConfere')::boolean, false) is not true then 'dataConfere' end], null);
  if cardinality(v_falta) > 0 then perform recusar_campos('Marque as três conferências do validador', variadic v_falta); end if;
  if v_obs is not null and length(v_obs) not between 2 and 300 then perform recusar_campos('A observação vai até 300 letras', 'observacao'); end if;
  if e.parte = 'CONDOMINIO' then
    select * into a from aceites_proposta where id = c.aceite_id;
    if a.cpf is null then perform recusar_motivo('O aceite foi anonimizado', 'ANONIMIZADO'); end if;
    if v_cpf is not null and v_cpf <> a.cpf then
      perform recusar_motivo('O CPF do validador não é o de quem aceitou a proposta; recuse o envio', 'CPF_NAO_CONFERE');
    end if;
    v_cpf := a.cpf;
    v_nome := a.nome;
  else
    if not cpf_valido(v_cpf) then perform recusar_campos('Digite o CPF que o validador mostra', 'cpf'); end if;
    v_nome := coalesce(comercial_texto(p_dados, 'assinanteNome'), comercial_nome(e.enviado_por));
    if coalesce(length(v_nome), 0) not between 2 and 120 then perform recusar_campos('Diga o nome de quem assinou pela TRÍADE', 'assinanteNome'); end if;
  end if;
  update envios_contrato set situacao = 'CONFERIDO', marca_valida = true, marca_pessoa = true, marca_data = true, assinante_nome = v_nome,
         cpf_mascarado = comercial_cpf_mascarado(v_cpf), observacao = v_obs, conferido_por = p_pessoa, conferido_em = app_now()
   where id = e.id
  returning * into e;
  if e.parte = 'CONDOMINIO' then
    update contratos_comercial set situacao = 'AGUARDA_TRIADE' where id = c.id returning * into c;
  else
    update contratos_comercial set situacao = 'ASSINADO', assinado_em = app_now() where id = c.id returning * into c;
  end if;
  perform comercial_inserir_conversa(c.interessado_id, 'NOTA',
    format('Assinatura %s conferida no validador do gov.br (contrato nº %s).', case e.parte when 'CONDOMINIO' then 'do condomínio' else 'da TRÍADE' end, c.numero),
    false, null, null);
  perform registrar_historico_interno('comercial.assinatura_conferida', 'contrato_comercial', c.id::text,
    jsonb_build_object('parte', e.parte, 'numero', c.numero, 'situacao', c.situacao));
  return envio_contrato_json(e, true) || jsonb_build_object('contrato', contrato_comercial_json(c, true));
end $$;

-- Recusar e pedir de novo (quadro 442): com o motivo, que o síndico vê no link.
create function comercial_recusar_envio(p_pessoa uuid, p_envio uuid, p_versao integer, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e envios_contrato;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  e := comercial_travar_envio(p_envio, null, false);
  if e.versao <> p_versao then perform conflito_versao('envios_contrato', p_envio); end if;
  if e.situacao not in ('A_CONFERIR', 'NAO_E_O_GERADO') then
    perform recusar_motivo('Só o envio que ainda não conta pode ser recusado', 'ENVIO_NAO_CONFERIVEL');
  end if;
  if coalesce(length(btrim(p_motivo)), 0) not between 3 and 300 then perform recusar_campos('Diga o motivo, que o síndico vai ver', 'motivo'); end if;
  update envios_contrato set situacao = 'RECUSADO', recusa_motivo = btrim(p_motivo), recusado_por = p_pessoa, recusado_em = app_now()
   where id = e.id
  returning * into e;
  perform comercial_inserir_conversa(e.interessado_id, 'NOTA',
    format('Assinatura %s recusada na conferência: %s', case e.parte when 'CONDOMINIO' then 'do condomínio' else 'da TRÍADE' end, btrim(p_motivo)), false, null, null);
  perform registrar_historico_interno('comercial.assinatura_recusada', 'contrato_comercial', e.contrato_id::text, jsonb_build_object('parte', e.parte));
  return envio_contrato_json(e, true);
end $$;

-- ---------------------------------------------------------------------------------------
-- O link do síndico depois do aceite (quadro 441): documentos, contrato e PDF assinado, até
-- contrato_link_dias depois do aceite. Ganho não fecha o link da versão aceita (o síndico baixa o
-- PDF final); perdido, sem resposta e anonimizado fecham.

create function comercial_revogar_links_sem_aceite(p_interessado uuid, p_motivo text, p_pessoa uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_antes text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_total integer;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  update links_proposta l set revogado_em = app_now(), revogado_por = p_pessoa, revogado_motivo = p_motivo
    from versoes_proposta v join propostas_comercial p on p.id = v.proposta_id
   where l.versao_id = v.id and p.interessado_id = p_interessado and l.revogado_em is null and v.situacao <> 'ACEITA';
  get diagnostics v_total = row_count;
  perform set_config('app.comercial_sistema', v_antes, true);
  return v_total;
end $$;

create or replace function interessados_links_proposta() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.anonimizado_em is not null and old.anonimizado_em is null then
    perform comercial_revogar_links_interessado(new.id, 'Dados apagados (LGPD)', null);
    perform comercial_fechar_piloto(new.id, 'Dados apagados (LGPD)');
  elsif new.etapa is distinct from old.etapa and new.etapa = 'GANHO' then
    perform comercial_revogar_links_sem_aceite(new.id, 'Interessado fechado', new.alterado_por);
  elsif new.etapa is distinct from old.etapa and not comercial_aberta(new.etapa) then
    perform comercial_revogar_links_interessado(new.id, 'Interessado fechado', new.alterado_por);
    perform comercial_fechar_piloto(new.id, 'Interessado fechado sem virar cliente');
  end if;
  return null;
end $$;

-- O aceite do link, se o link ainda serve para o contrato.
create function publico_aceite_do_link(p_codigo text) returns aceites_proposta
language plpgsql
set search_path = public
as $$
declare
  l links_proposta;
  v versoes_proposta;
  i interessados;
  a aceites_proposta;
begin
  l := publico_buscar_link(p_codigo);
  select * into v from versoes_proposta where id = l.versao_id;
  i := publico_interessado_da_versao(v);
  if v.situacao <> 'ACEITA' or i.etapa in ('PERDIDO', 'SEM_RESPOSTA') then raise exception 'Proposta não encontrada' using errcode = 'TC404'; end if;
  select * into a from aceites_proposta where versao_id = v.id;
  if a.aceito_em + make_interval(days => configuracao_int('contrato_link_dias')) < app_now() then
    raise exception 'O prazo deste link para o contrato acabou' using errcode = 'TC422',
      detail = jsonb_build_object('motivo', 'LINK_CONTRATO_VENCIDO',
                                  'ate', (a.aceito_em + make_interval(days => configuracao_int('contrato_link_dias')))::date)::text;
  end if;
  return a;
end $$;

-- O passo a passo do link (quadro 441): documentos, o contrato e as assinaturas.
create function publico_contrato(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aceites_proposta;
  i interessados;
  c contratos_comercial;
  v_saida jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  a := publico_aceite_do_link(p_codigo);
  i := comercial_interessado_do_aceite(a);
  c := comercial_contrato_vigente(i.id);
  v_saida := jsonb_strip_nulls(jsonb_build_object(
    'condominio', (select v.condominio from versoes_proposta v where v.id = a.versao_id),
    'proposta', (select v.numero from versoes_proposta v where v.id = a.versao_id),
    'aceite', jsonb_build_object('nome', a.nome, 'cargo', a.cargo, 'aceitoEm', a.aceito_em),
    'linkAte', (a.aceito_em + make_interval(days => configuracao_int('contrato_link_dias')))::date,
    'documentos', coalesce((select jsonb_agg(documento_aceite_json(d, false) order by d.enviado_em desc) from documentos_aceite d
                             where d.interessado_id = i.id and d.situacao in ('RECEBIDO', 'RECUSADO')), '[]'::jsonb),
    'faltam', to_jsonb(comercial_documentos_faltam(i.id)),
    'podeEnviarDocumentos', c.situacao is distinct from 'ASSINADO',
    'contrato', case when c.id is not null and c.situacao <> 'GERANDO' then
       contrato_comercial_json(c, false) || jsonb_build_object('podeEnviar', c.situacao = 'AGUARDA_CONDOMINIO') end));
  perform set_config('app.comercial_sistema', '', true);
  return v_saida;
end $$;

create function publico_iniciar_documento(p_codigo text, p_dados jsonb, p_ip text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aceites_proposta;
  v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  a := publico_aceite_do_link(p_codigo);
  v := comercial_documento_iniciar(comercial_interessado_do_aceite(a), a, p_dados, true, p_ip, null);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

-- O documento do link é do interessado do link.
create function publico_documento_do_link(p_codigo text, p_id uuid) returns documentos_aceite
language plpgsql
set search_path = public
as $$
declare
  a aceites_proposta;
  d documentos_aceite;
begin
  a := publico_aceite_do_link(p_codigo);
  -- O interessado antes do documento (a mesma ordem de gerar o contrato).
  perform 1 from interessados where id = (comercial_interessado_do_aceite(a)).id for update;
  select * into d from documentos_aceite where id = p_id and interessado_id = (comercial_interessado_do_aceite(a)).id and pelo_link for update;
  if not found then raise exception 'Documento não encontrado' using errcode = 'TC404'; end if;
  return d;
end $$;

create function publico_documento_a_verificar(p_codigo text, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d documentos_aceite;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  d := publico_documento_do_link(p_codigo, p_id);
  if d.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  perform set_config('app.comercial_sistema', '', true);
  return jsonb_build_object('caminho', d.caminho, 'tipo', 'application/pdf');
end $$;

create function publico_verificar_documento(p_codigo text, p_id uuid, p_liberado boolean, p_tamanho bigint, p_sha256 text, p_motivo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  v := comercial_documento_verificado(publico_documento_do_link(p_codigo, p_id), p_liberado, p_tamanho, p_sha256, p_motivo);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

-- Baixar pelo link: o contrato gerado (para assinar) ou, assinado pelos dois, o PDF final.
create function publico_abrir_contrato(p_codigo text, p_final boolean) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aceites_proposta;
  c contratos_comercial;
  e envios_contrato;
  v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  a := publico_aceite_do_link(p_codigo);
  c := comercial_contrato_vigente((comercial_interessado_do_aceite(a)).id);
  if c.id is null or c.situacao = 'GERANDO' then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  if coalesce(p_final, false) then
    if c.situacao <> 'ASSINADO' then perform recusar_motivo('O PDF final sai quando a TRÍADE assinar', 'SEM_PDF_FINAL'); end if;
    select * into e from envios_contrato where contrato_id = c.id and parte = 'TRIADE' and situacao = 'CONFERIDO';
    v := jsonb_build_object('caminho', e.caminho, 'nome', format('contrato-%s-assinado.pdf', c.numero), 'tipo', 'application/pdf');
  else
    v := jsonb_build_object('caminho', c.caminho, 'nome', format('contrato-%s.pdf', c.numero), 'tipo', 'application/pdf');
  end if;
  perform comercial_historico('comercial.contrato_baixado', 'contrato_comercial', c.id::text,
                                      jsonb_build_object('final', coalesce(p_final, false), 'peloLink', true));
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

create function publico_iniciar_envio(p_codigo text, p_dados jsonb, p_ip text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a aceites_proposta;
  c contratos_comercial;
  v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  a := publico_aceite_do_link(p_codigo);
  select * into c from contratos_comercial
   where interessado_id = (comercial_interessado_do_aceite(a)).id and situacao <> 'SUBSTITUIDO' for update;
  if not found then raise exception 'Contrato não encontrado' using errcode = 'TC404'; end if;
  v := comercial_envio_iniciar(c, 'CONDOMINIO', p_dados, true, p_ip, null);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

create function publico_envio_do_link(p_codigo text, p_id uuid) returns envios_contrato
language plpgsql
set search_path = public
as $$
declare a aceites_proposta;
begin
  a := publico_aceite_do_link(p_codigo);
  return comercial_travar_envio(p_id, (comercial_interessado_do_aceite(a)).id, true);
end $$;

create function publico_envio_a_verificar(p_codigo text, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e envios_contrato;
  v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  e := publico_envio_do_link(p_codigo, p_id);
  if e.situacao <> 'ENVIANDO' then perform recusar_motivo('Este envio já foi conferido', 'ENVIO_CONFERIDO'); end if;
  -- A base é lida ainda como o sistema (sem ele, a RLS esconde o contrato do link).
  v := comercial_envio_base(e);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

create function publico_verificar_envio(p_codigo text, p_id uuid, p_resultado jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform limpar_contexto();
  perform set_config('app.comercial_sistema', 'on', true);
  v := comercial_envio_verificado(publico_envio_do_link(p_codigo, p_id), p_resultado);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- Troca de sistema (CM-29, quadro 345): carta-modelo, o que falta receber, planilha-modelo e
-- linha do tempo. A síndica assina e manda a carta; a TRÍADE não fala pelo condomínio.

create function troca_itens_validos(p jsonb) returns boolean
language sql immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 20
     and not exists (select 1 from jsonb_array_elements(p) x
                      where jsonb_typeof(x) <> 'object'
                         or exists (select 1 from jsonb_object_keys(x) k where k not in ('texto', 'recebido'))
                         or length(btrim(coalesce(x ->> 'texto', ''))) not between 3 and 120
                         or jsonb_typeof(x -> 'recebido') <> 'boolean')
$$;

create function troca_itens_padrao() returns jsonb
language sql immutable
set search_path = public
as $$
  select '[{"texto": "Lista de unidades e moradores", "recebido": false}, {"texto": "Contratos e prestadores", "recebido": false},
           {"texto": "Atas e convenção", "recebido": false}, {"texto": "Pendências abertas com moradores", "recebido": false}]'::jsonb
$$;

create table trocas_sistema (
  id               uuid primary key default gen_random_uuid(),
  interessado_id   uuid not null unique references interessados (id),
  empresa_anterior text not null check (length(btrim(empresa_anterior)) between 2 and 120),
  data_troca       date not null,
  itens            jsonb not null check (troca_itens_validos(itens)),
  carta            text not null check (length(btrim(carta)) between 20 and 4000),
  carta_enviada_em timestamptz,
  carta_enviada_por uuid references pessoas (id),
  condominio_id    uuid references condominios (id),
  criado_em        timestamptz not null default app_now(),
  criado_por       uuid references pessoas (id),
  alterado_em      timestamptz,
  alterado_por     uuid references pessoas (id),
  versao           integer not null default 1
);
call proteger_tabela_comercial('trocas_sistema', 'console.comercial.editar',
  'Troca de sistema do interessado (CM-29): carta, o que falta receber e a data; ao virar cliente segue para a implantação');
create trigger trocas_sistema_sem_exclusao before delete on trocas_sistema for each row execute function somente_insercao();

-- A carta-modelo, com o que ainda falta receber.
create function comercial_carta_troca(p_condominio text, p_representante text, p_empresa text, p_data date, p_itens jsonb) returns text
language sql immutable
set search_path = public
as $$
  select format(E'À %s,\n\nO %s, representado por %s, passa a usar a TRÍADE Condo a partir de %s e pede, até %s, a entrega dos itens abaixo:\n%s\n\nAtenciosamente,\n\n%s\n[assinatura]',
                p_empresa, p_condominio, coalesce(p_representante, 'quem o representa'), comercial_data_br(p_data), comercial_data_br(p_data - 15),
                coalesce((select string_agg('- ' || btrim(x ->> 'texto'), E'\n' order by n) from jsonb_array_elements(p_itens) with ordinality y(x, n)
                           where not (x ->> 'recebido')::boolean), '- (nada pendente)'),
                coalesce(p_representante, '[nome de quem assina]'))
$$;

create function troca_linha_do_tempo(t trocas_sistema) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_array(
    jsonb_build_object('chave', 'CARTA', 'quando', '30 dias antes', 'data', t.data_troca - 30, 'texto', 'Carta à empresa anterior pedindo os dados e documentos',
                       'situacao', case when t.carta_enviada_em is not null then 'FEITO' else 'PREVISTO' end),
    jsonb_build_object('chave', 'PLANILHA', 'quando', '15 dias antes', 'data', t.data_troca - 15, 'texto', 'Planilha-modelo preenchida com o mínimo para começar',
                       'situacao', case when f.faltam = 0 then 'FEITO' else 'FALTAM' end, 'faltam', f.faltam),
    jsonb_build_object('chave', 'TROCA', 'quando', 'Dia da troca', 'data', t.data_troca, 'texto', 'Comunicado aos moradores e número do WhatsApp do prédio',
                       'situacao', 'PREVISTO'),
    jsonb_build_object('chave', 'PRIMEIRA_SEMANA', 'quando', '1ª semana', 'data', t.data_troca + 7, 'texto', 'Pendências da implantação com responsável',
                       'situacao', case when t.condominio_id is not null then 'NA_IMPLANTACAO' else 'PREVISTO' end),
    jsonb_build_object('chave', 'ACOMPANHAMENTO', 'quando', '45 dias depois', 'data', t.data_troca + 45, 'texto', 'Conversa de acompanhamento com o síndico',
                       'situacao', 'PREVISTO'))
    from (select count(*)::integer as faltam from jsonb_array_elements(t.itens) x where not (x ->> 'recebido')::boolean) f
$$;

create function troca_sistema_json(t trocas_sistema) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', t.id, 'versao', t.versao, 'empresaAnterior', t.empresa_anterior, 'dataTroca', t.data_troca, 'itens', t.itens,
    'faltam', (select count(*) from jsonb_array_elements(t.itens) x where not (x ->> 'recebido')::boolean),
    'carta', t.carta, 'cartaEnviadaEm', t.carta_enviada_em, 'cartaEnviadaPor', comercial_pessoa_json(t.carta_enviada_por),
    'linhaDoTempo', troca_linha_do_tempo(t), 'naImplantacao', t.condominio_id is not null))
$$;

-- Quem assina a carta: quem aceitou a proposta ou, antes disso, o contato da ficha.
create function comercial_representante(i interessados) returns text
language sql stable
set search_path = public
as $$ select coalesce((comercial_aceite_do_interessado(i.id)).nome, i.nome_contato) $$;

create function comercial_troca(p_pessoa uuid, p_interessado uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  t trocas_sistema;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_interessado);
  select * into t from trocas_sistema where interessado_id = i.id;
  if not comercial_ve_cliente(i) then
    -- Virou cliente: a troca segue na implantação; o Comercial vê só que ela existe.
    return jsonb_strip_nulls(jsonb_build_object(
      'troca', case when t.id is not null then jsonb_build_object('id', t.id, 'naImplantacao', true) end,
      'itensPadrao', troca_itens_padrao(), 'sistemaAtual', i.sistema_atual, 'administradora', i.administradora,
      'podeEditar', false, 'restrito', true));
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'troca', case when t.id is not null then troca_sistema_json(t) end,
    'itensPadrao', troca_itens_padrao(),
    'sistemaAtual', i.sistema_atual, 'administradora', i.administradora,
    'podeEditar', pode_global('console.comercial.editar') and i.virou_cliente_em is null and i.anonimizado_em is null));
end $$;

-- Salvar a troca: sem itens, a lista padrão; sem carta, a carta-modelo com o que falta.
create function comercial_salvar_troca(p_pessoa uuid, p_interessado uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  t trocas_sistema;
  v_empresa text := comercial_texto(p_dados, 'empresaAnterior');
  v_data date := comercial_data(p_dados, 'dataTroca');
  v_itens jsonb := coalesce(p_dados -> 'itens', troca_itens_padrao());
  v_carta text := comercial_texto(p_dados, 'carta');
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  i := comercial_buscar(p_interessado);
  perform comercial_exigir_nao_cliente(i.id);
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if coalesce(length(v_empresa), 0) not between 2 and 120 then perform recusar_campos('Diga o sistema ou a empresa de antes', 'empresaAnterior'); end if;
  if v_data is null or v_data < comercial_hoje() - 30 or v_data > comercial_hoje() + 365 then
    perform recusar_campos('Diga a data da troca (até um ano)', 'dataTroca');
  end if;
  if jsonb_typeof(v_itens) = 'array' then
    v_itens := (select coalesce(jsonb_agg(jsonb_build_object('texto', btrim(x ->> 'texto'), 'recebido', coalesce((x ->> 'recebido')::boolean, false)) order by n), '[]')
                  from jsonb_array_elements(v_itens) with ordinality y(x, n) where jsonb_typeof(x) = 'object');
  end if;
  if not troca_itens_validos(v_itens) then perform recusar_campos('Confira a lista do que falta receber (de 1 a 20 itens)', 'itens'); end if;
  if v_carta is null then v_carta := comercial_carta_troca(i.condominio, comercial_representante(i), v_empresa, v_data, v_itens); end if;
  if length(v_carta) not between 20 and 4000 then perform recusar_campos('A carta vai de 20 a 4 mil letras', 'carta'); end if;
  select * into t from trocas_sistema where interessado_id = i.id for update;
  if t.id is null then
    insert into trocas_sistema (interessado_id, empresa_anterior, data_troca, itens, carta, criado_por)
    values (i.id, v_empresa, v_data, v_itens, v_carta, p_pessoa)
    returning * into t;
  else
    if t.versao <> p_versao then perform conflito_versao('trocas_sistema', t.id); end if;
    update trocas_sistema set empresa_anterior = v_empresa, data_troca = v_data, itens = v_itens, carta = v_carta,
           alterado_em = app_now(), alterado_por = p_pessoa
     where id = t.id
    returning * into t;
  end if;
  perform registrar_historico_interno('comercial.troca_sistema', 'troca_sistema', t.id::text, jsonb_build_object('dataTroca', t.data_troca));
  return troca_sistema_json(t);
end $$;

-- "Mandar a carta para a síndica": fica a data; quem manda à empresa anterior é ela.
create function comercial_carta_troca_enviada(p_pessoa uuid, p_interessado uuid, p_versao integer) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t trocas_sistema;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  perform comercial_exigir_nao_cliente(p_interessado);
  select * into t from trocas_sistema where interessado_id = p_interessado for update;
  if not found then raise exception 'Troca de sistema não encontrada' using errcode = 'TC404'; end if;
  if t.versao <> p_versao then perform conflito_versao('trocas_sistema', t.id); end if;
  update trocas_sistema set carta_enviada_em = app_now(), carta_enviada_por = p_pessoa, alterado_em = app_now(), alterado_por = p_pessoa
   where id = t.id
  returning * into t;
  perform comercial_inserir_conversa(p_interessado, 'NOTA', 'Carta à empresa anterior mandada para a síndica assinar e enviar.', false, null, null);
  perform registrar_historico_interno('comercial.troca_carta', 'troca_sistema', t.id::text, '{}'::jsonb);
  return troca_sistema_json(t);
end $$;

-- ---------------------------------------------------------------------------------------
-- Piloto com critério de sucesso (CM-21, quadro 338).

create table pilotos_comercial (
  id              uuid primary key default gen_random_uuid(),
  interessado_id  uuid not null references interessados (id),
  condominio_id   uuid not null references condominios (id),
  prazo_dias      integer not null check (prazo_dias in (30, 45, 60)),
  comeca_em       date not null,
  termina_em      date not null,
  meta            text not null check (meta in ('RETORNOS_NO_PRAZO', 'PEDIDOS_CONCLUIDOS_COM_EXPLICACAO', 'MORADORES_WHATSAPP')),
  meta_percentual integer not null check (meta_percentual between 1 and 100),
  combinado_com   text check (length(btrim(combinado_com)) between 3 and 120),
  situacao        text not null default 'EM_ANDAMENTO' check (situacao in ('EM_ANDAMENTO', 'VIROU_PROPOSTA', 'PERDIDO', 'VIROU_CLIENTE')),
  resultado       jsonb check (resultado is null or jsonb_typeof(resultado) = 'object'),
  motivo_perda    text check (motivo_perda in ('PRECO', 'OUTRO_SISTEMA', 'ASSEMBLEIA_NAO_APROVOU', 'FICOU_PARA_DEPOIS', 'NAO_RESPONDEU',
                                               'FORA_DO_PERFIL', 'OUTRO')),
  detalhe         text check (length(btrim(detalhe)) between 2 and 500),
  encerrado_em    timestamptz,
  encerrado_por   uuid references pessoas (id),
  criado_em       timestamptz not null default app_now(),
  criado_por      uuid references pessoas (id),
  versao          integer not null default 1,
  check (termina_em = comeca_em + prazo_dias),
  check ((situacao = 'EM_ANDAMENTO') = (encerrado_em is null) or situacao = 'VIROU_CLIENTE'),
  check ((situacao = 'PERDIDO') = (motivo_perda is not null))
);
create unique index pilotos_comercial_um_aberto on pilotos_comercial (interessado_id) where situacao in ('EM_ANDAMENTO', 'VIROU_PROPOSTA');
call proteger_tabela_comercial('pilotos_comercial', 'console.comercial.editar',
  'Pilotos do comercial (CM-21): prazo, meta medida pela Plataforma, com quem foi combinado e como terminou');
create trigger pilotos_comercial_sem_exclusao before delete on pilotos_comercial for each row execute function somente_insercao();

-- A medida da meta pela Plataforma. Retornos no prazo vêm dos indicadores de atendimento do
-- condomínio (só os números); as outras duas metas a Plataforma mostra em Indicadores. Entra no
-- condomínio como sistema: quem chama volta à própria pessoa depois.
create function comercial_piloto_medir(p pilotos_comercial) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r jsonb;
  v_ate date := least(p.termina_em, comercial_hoje());
  v_pct numeric;
begin
  if p.meta <> 'RETORNOS_NO_PRAZO' then return jsonb_build_object('medido', false, 'ondeVer', 'INDICADORES_PLATAFORMA'); end if;
  if comercial_hoje() < p.comeca_em then return jsonb_build_object('medido', false, 'motivo', 'NAO_COMECOU'); end if;
  perform entrar_como_sistema(p.condominio_id);
  r := indicadores_atendimento(p.comeca_em, v_ate);
  perform entrar_como_sistema(null);
  v_pct := (r -> 'retornos' ->> 'porcentagem')::numeric;
  return jsonb_strip_nulls(jsonb_build_object('medido', true, 'de', p.comeca_em, 'ate', v_ate,
    'retornos', (r -> 'retornos' ->> 'total')::integer, 'noPrazo', (r -> 'retornos' ->> 'noPrazo')::integer, 'porcentagem', v_pct,
    'meta', p.meta_percentual, 'atingiu', case when v_pct is not null then v_pct >= p.meta_percentual end));
end $$;

create function piloto_comercial_json(p pilotos_comercial, p_interno boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'prazoDias', p.prazo_dias, 'comecaEm', p.comeca_em, 'terminaEm', p.termina_em, 'meta', p.meta,
    'metaPercentual', p.meta_percentual, 'situacao', p.situacao, 'resultado', p.resultado, 'encerradoEm', p.encerrado_em))
  || case when p_interno then jsonb_strip_nulls(jsonb_build_object(
       'versao', p.versao, 'combinadoCom', p.combinado_com, 'motivoPerda', p.motivo_perda, 'detalhe', p.detalhe,
       'encerradoPor', comercial_pessoa_json(p.encerrado_por), 'criadoPor', comercial_pessoa_json(p.criado_por), 'criadoEm', p.criado_em))
          else '{}'::jsonb end
$$;

-- O último piloto do interessado (o que vale para o kit e a ficha).
create function comercial_piloto_atual(p_interessado uuid) returns pilotos_comercial
language sql stable
set search_path = public
as $$ select * from pilotos_comercial where interessado_id = p_interessado order by criado_em desc limit 1 $$;

-- A implantação mínima do piloto: o roteiro de sempre, com a organização, os documentos e a
-- apresentação como "não se aplica" (voltam se virar cliente). Quem cuida é o responsável dado.
create function comercial_implantacao_piloto(p_responsavel uuid) returns implantacoes
language plpgsql
set search_path = public
as $$
declare
  v implantacoes;
  v_roteiro smallint;
begin
  select max(numero) into v_roteiro from roteiros_implantacao;
  insert into implantacoes (condominio_id, roteiro_versao) values (contexto_condominio(), v_roteiro) returning * into v;
  insert into etapas_implantacao (condominio_id, implantacao_id, numero, chave, titulo, situacao, motivo, responsavel_id)
  select contexto_condominio(), v.id, (e ->> 'numero')::smallint, e ->> 'chave', e ->> 'titulo',
         case when e ->> 'chave' in ('ORGANIZACAO', 'DOCUMENTOS', 'APRESENTACAO') then 'NAO_SE_APLICA' else 'PREPARADA' end,
         case when e ->> 'chave' in ('ORGANIZACAO', 'DOCUMENTOS', 'APRESENTACAO') then 'Piloto (CM-21): implantação mínima; volta se virar cliente' end,
         p_responsavel
    from roteiros_implantacao r, jsonb_array_elements(r.etapas) e
   where r.numero = v_roteiro;
  perform registrar_historico_interno('implantacao.iniciada', 'implantacao', v.id::text, jsonb_build_object('roteiro', v_roteiro, 'piloto', true));
  return v;
end $$;

-- Começar o piloto (quadro 338): cria o condomínio na carteira como Em piloto, sem plano (sem
-- cobrança), com a implantação mínima e quem cuida dela. Só a Administração.
create function comercial_iniciar_piloto(p_pessoa uuid, p_interessado uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  p pilotos_comercial;
  v_prazo bigint := comercial_inteiro(p_dados, 'prazoDias');
  v_comeca date := comercial_data(p_dados, 'comecaEm');
  v_meta text := comercial_texto(p_dados, 'meta');
  v_pct bigint := comercial_inteiro(p_dados, 'metaPercentual');
  v_com text := comercial_texto(p_dados, 'combinadoCom');
  v_resp uuid := nullif(p_dados ->> 'responsavelImplantacaoId', '')::uuid;
  v_cond uuid;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  select * into i from interessados where id = p_interessado for update;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  if i.versao <> p_versao then perform conflito_versao('interessados', p_interessado); end if;
  perform comercial_exigir_aberto(i);
  if i.virou_cliente_em is not null then perform recusar_motivo('Este interessado já virou cliente', 'VIROU_CLIENTE'); end if;
  if exists (select 1 from pilotos_comercial where interessado_id = i.id and situacao in ('EM_ANDAMENTO', 'VIROU_PROPOSTA')) then
    perform recusar_motivo('Este interessado já tem um piloto', 'PILOTO_EXISTE');
  end if;
  -- Um piloto por interessado: o condomínio do piloto perdido continua na carteira (Piloto
  -- encerrado) e é ele que vira cliente se o contrato sair.
  if i.condominio_id is not null then
    perform recusar_motivo('Este interessado já teve um piloto; o condomínio continua na carteira como Piloto encerrado e vira cliente com o contrato',
                           'PILOTO_JA_FEITO');
  end if;
  if v_prazo is null or v_prazo not in (30, 45, 60) then perform recusar_campos('O prazo é de 30, 45 ou 60 dias', 'prazoDias'); end if;
  if v_comeca is null or v_comeca < comercial_hoje() or v_comeca > comercial_hoje() + 60 then
    perform recusar_campos('O piloto começa de hoje a 60 dias', 'comecaEm');
  end if;
  if v_meta is null or v_meta not in ('RETORNOS_NO_PRAZO', 'PEDIDOS_CONCLUIDOS_COM_EXPLICACAO', 'MORADORES_WHATSAPP') then
    perform recusar_campos('Combine a meta antes', 'meta');
  end if;
  if v_pct is null or v_pct not between 1 and 100 then perform recusar_campos('A meta vai de 1% a 100%', 'metaPercentual'); end if;
  if coalesce(length(v_com), 0) not between 3 and 120 then perform recusar_campos('Diga com quem foi combinado', 'combinadoCom'); end if;
  perform comercial_exigir_implantacao(v_resp);
  -- A carteira: o condomínio novo, em piloto.
  v_cond := abrir_condominio_novo(p_pessoa);
  begin
    insert into condominios (id, nome, cidade, uf, endereco, contatos, cnpj)
    values (v_cond, i.condominio, coalesce(comercial_texto(p_dados, 'cidade'), i.cidade), coalesce(comercial_texto(p_dados, 'uf'), i.uf::text),
            i.endereco, comercial_contatos_cliente(i), case when cnpj_valido(i.cnpj) then i.cnpj end);
  exception when check_violation then
    perform recusar_campos('Confira a cidade e a UF do condomínio', 'cidade', 'uf');
  end;
  perform definir_transicao('PILOTO_INICIADO', format('Piloto de %s dias', v_prazo));
  insert into clientes (condominio_id, estado, referencia_contrato) values (v_cond, 'PILOTO', 'Piloto sem cobrança (CM-21)');
  insert into vinculos (pessoa_id, condominio_id, funcao, criado_por) values (p_pessoa, v_cond, 'ADMINISTRACAO', p_pessoa);
  perform comercial_atribuir_implantacao(v_resp, p_pessoa);
  perform comercial_implantacao_piloto(v_resp);
  perform registrar_historico('condominio.cadastrado', 'condominio', v_cond::text, jsonb_build_object('origem', 'PILOTO'));
  -- De volta ao Comercial, sem condomínio.
  perform definir_pessoa(p_pessoa);
  insert into pilotos_comercial (interessado_id, condominio_id, prazo_dias, comeca_em, termina_em, meta, meta_percentual, combinado_com, criado_por)
  values (i.id, v_cond, v_prazo, v_comeca, v_comeca + v_prazo::integer, v_meta, v_pct, v_com, p_pessoa)
  returning * into p;
  update interessados set condominio_id = v_cond, alterado_em = app_now(), alterado_por = p_pessoa where id = i.id;
  perform comercial_inserir_conversa(i.id, 'NOTA', format('Piloto de %s dias combinado (%s a %s), meta de %s%%.', v_prazo,
    comercial_data_br(v_comeca), comercial_data_br(v_comeca + v_prazo::integer), v_pct), false, null, null);
  perform registrar_historico_interno('comercial.piloto', 'piloto_comercial', p.id::text,
    jsonb_build_object('prazoDias', v_prazo, 'meta', v_meta, 'situacao', p.situacao));
  return piloto_comercial_json(p, true) || jsonb_build_object('condominioId', v_cond);
end $$;

create function comercial_piloto(p_pessoa uuid, p_interessado uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  p pilotos_comercial;
  v_medida jsonb;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_interessado);
  p := comercial_piloto_atual(p_interessado);
  if p.id is null then
    return jsonb_build_object('piloto', null, 'podeComecar', pode_global('console.comercial.cliente') and i.condominio_id is null);
  end if;
  if not comercial_ve_cliente(i) then
    -- Virou cliente: a medida vem da operação do condomínio, que o Comercial não vê mais.
    return jsonb_build_object('piloto', piloto_comercial_json(p, false) - 'resultado', 'podeEncerrar', false, 'podeComecar', false, 'restrito', true);
  end if;
  if p.situacao = 'EM_ANDAMENTO' then
    v_medida := comercial_piloto_medir(p);
    perform definir_pessoa(p_pessoa);
  end if;
  return jsonb_build_object('piloto', piloto_comercial_json(p, true) || jsonb_strip_nulls(jsonb_build_object('medida', v_medida)),
                            'podeEncerrar', pode_global('console.comercial.editar') and p.situacao = 'EM_ANDAMENTO',
                            'podeComecar', false);
end $$;

-- O interessado fechou (perdido, sem resposta) ou foi anonimizado sem virar cliente: o piloto aberto
-- termina como perdido e o condomínio vai a Piloto encerrado (antes ficava Em piloto, sem cobrança,
-- para sempre). Vale também para o piloto que já virou proposta. Chamado pelo gatilho do
-- interessado. A carteira é da equipe (RLS e histórico interno pedem alguém da equipe no
-- condomínio): a mudança é feita pela Administração do condomínio (quem fechou, se for da
-- Administração; senão quem começou o piloto; senão quem atende o cliente), marcada como do sistema
-- e com o motivo. O contexto volta ao de quem chamou.
create function comercial_fechar_piloto(p_interessado uuid, p_motivo text) returns void
language plpgsql
set search_path = public
as $$
declare
  i interessados;
  p pilotos_comercial;
  v_pessoa uuid := contexto_pessoa();
  v_antes text := coalesce(current_setting('app.comercial_sistema', true), '');
  v_candidatos uuid[];
  v_adm uuid;
  v_mudou integer := 0;
  v_entrou boolean := false;
begin
  select * into i from interessados where id = p_interessado;
  if i.condominio_id is null or i.virou_cliente_em is not null then return; end if;
  perform set_config('app.comercial_sistema', 'on', true);
  for p in update pilotos_comercial
              set situacao = 'PERDIDO', encerrado_em = coalesce(encerrado_em, app_now()), encerrado_por = coalesce(encerrado_por, v_pessoa),
                  motivo_perda = case when i.motivo_perda is not null then i.motivo_perda when i.etapa = 'SEM_RESPOSTA' then 'NAO_RESPONDEU' else 'OUTRO' end
            where interessado_id = i.id and situacao in ('EM_ANDAMENTO', 'VIROU_PROPOSTA')
            returning * loop
    perform comercial_historico('comercial.piloto', 'piloto_comercial', p.id::text,
      jsonb_build_object('situacao', p.situacao, 'motivoPerda', p.motivo_perda, 'porque', p_motivo));
  end loop;
  perform entrar_como_sistema(i.condominio_id);
  select array_agg(x.id order by x.ordem, x.desde) into v_candidatos from (
    select v_pessoa as id, 0 as ordem, null::timestamptz as desde
    union all select criado_por, 1, criado_em from pilotos_comercial where interessado_id = i.id
    union all select pessoa_id, 2, criado_em from vinculos where condominio_id = i.condominio_id and funcao = 'ADMINISTRACAO' and revogado_em is null) x
   where x.id is not null;
  foreach v_adm in array coalesce(v_candidatos, '{}') loop
    begin
      perform comercial_entrar_cliente(v_adm, i.condominio_id, 'console.estagio.mudar');
      v_entrou := true;
    exception when sqlstate 'TC401' or sqlstate 'TC422' then
      -- Não é (mais) da Administração: tenta o próximo.
      perform entrar_como_sistema(i.condominio_id);
    end;
    exit when v_entrou;
  end loop;
  if v_entrou then
    perform definir_transicao('PILOTO_ENCERRADO', p_motivo, true);
    update clientes set estado = 'PILOTO_ENCERRADO' where condominio_id = i.condominio_id and estado = 'PILOTO';
    get diagnostics v_mudou = row_count;
  end if;
  if v_pessoa is not null then perform definir_pessoa(v_pessoa); else perform entrar_como_sistema(null); end if;
  if v_mudou > 0 then
    perform comercial_inserir_conversa(i.id, 'NOTA', 'Piloto encerrado: o condomínio ficou na carteira como Piloto encerrado.', false, null, null);
  elsif not v_entrou then
    perform comercial_inserir_conversa(i.id, 'NOTA',
      'Piloto encerrado, mas ninguém da Administração atende o condomínio: passe-o a Piloto encerrado na carteira.', false, null, null);
  end if;
  perform set_config('app.comercial_sistema', v_antes, true);
end $$;

-- Terminar o piloto: vira proposta (o condomínio fica em piloto até virar cliente) ou perdido com
-- motivo (o interessado vai a Perdido e o condomínio a Piloto encerrado; só a Administração).
create function comercial_encerrar_piloto(p_pessoa uuid, p_piloto uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p pilotos_comercial;
  i interessados;
  v_resultado text := comercial_texto(p_dados, 'resultado');
  v_motivo text := comercial_texto(p_dados, 'motivoPerda');
  v_detalhe text := comercial_texto(p_dados, 'detalhe');
  v_medida jsonb;
begin
  perform entrar_console(p_pessoa, case when v_resultado = 'PERDIDO' then 'console.comercial.cliente' else 'console.comercial.editar' end);
  select * into p from pilotos_comercial where id = p_piloto for update;
  if not found then raise exception 'Piloto não encontrado' using errcode = 'TC404'; end if;
  if p.versao <> p_versao then perform conflito_versao('pilotos_comercial', p_piloto); end if;
  if p.situacao <> 'EM_ANDAMENTO' then perform recusar_motivo('Este piloto já terminou', 'PILOTO_ENCERRADO'); end if;
  if v_resultado is null or v_resultado not in ('PROPOSTA', 'PERDIDO') then perform recusar_campos('Diga como o piloto terminou', 'resultado'); end if;
  if v_resultado = 'PERDIDO' and (v_motivo is null or v_motivo not in ('PRECO', 'OUTRO_SISTEMA', 'ASSEMBLEIA_NAO_APROVOU', 'FICOU_PARA_DEPOIS',
                                                                       'NAO_RESPONDEU', 'FORA_DO_PERFIL', 'OUTRO')) then
    perform recusar_campos('Diga por que não fechou', 'motivoPerda');
  end if;
  if v_detalhe is not null and length(v_detalhe) not between 2 and 500 then perform recusar_campos('O detalhe vai até 500 letras', 'detalhe'); end if;
  i := comercial_buscar(p.interessado_id);
  v_medida := comercial_piloto_medir(p);
  perform definir_pessoa(p_pessoa);
  update pilotos_comercial set situacao = case v_resultado when 'PERDIDO' then 'PERDIDO' else 'VIROU_PROPOSTA' end, resultado = v_medida,
         motivo_perda = case when v_resultado = 'PERDIDO' then v_motivo end, detalhe = v_detalhe, encerrado_em = app_now(), encerrado_por = p_pessoa
   where id = p.id
  returning * into p;
  perform comercial_inserir_conversa(i.id, 'NOTA',
    case v_resultado when 'PERDIDO' then 'Piloto terminou sem fechar.' else 'Piloto terminou; segue para a proposta.' end, false, null, null);
  perform registrar_historico_interno('comercial.piloto', 'piloto_comercial', p.id::text,
    jsonb_strip_nulls(jsonb_build_object('situacao', p.situacao, 'motivoPerda', p.motivo_perda)));
  if v_resultado = 'PERDIDO' then
    perform comercial_entrar_cliente(p_pessoa, p.condominio_id, 'console.estagio.mudar');
    perform definir_transicao('PILOTO_ENCERRADO', 'Piloto terminou sem fechar');
    update clientes set estado = 'PILOTO_ENCERRADO' where condominio_id = p.condominio_id and estado = 'PILOTO';
    perform definir_pessoa(p_pessoa);
    if i.anonimizado_em is null and comercial_aberta(i.etapa) then
      update interessados set etapa = 'PERDIDO', etapa_desde = app_now(), motivo_perda = v_motivo, perda_detalhe = v_detalhe,
             proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null, alterado_em = app_now(), alterado_por = p_pessoa
       where id = i.id;
      insert into etapas_interessado (interessado_id, de, para, motivo_perda, criado_por) values (i.id, i.etapa, 'PERDIDO', v_motivo, p_pessoa);
      perform comercial_iniciar_cadencia(i.id);
      perform registrar_historico_interno('comercial.etapa', 'interessado', i.id::text,
        jsonb_build_object('de', i.etapa, 'para', 'PERDIDO', 'motivoPerda', v_motivo));
    end if;
  end if;
  return piloto_comercial_json(p, true);
end $$;

-- ---------------------------------------------------------------------------------------
-- A implantação em parcelas (revisão do 3f3902a): o contrato diz "R$ X em N parcelas" e a cobrança
-- segue. Cada parcela é uma cobrança de implantação, mês a mês a partir da primeira competência do
-- plano; o índice de uma implantação por cliente vira um por parcela (o índice sai, nenhuma linha).

alter table cobrancas add column parcela smallint not null default 1 check (parcela between 1 and 24);
drop index cobrancas_implantacao_unica;
create unique index cobrancas_implantacao_parcela_unica on cobrancas (condominio_id, parcela) where tipo = 'IMPLANTACAO';

create function cobrancas_parcela_fixa() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parcela is distinct from old.parcela then
    raise exception 'A cobrança não se edita; corrija por ajuste, com motivo' using errcode = 'TC422';
  end if;
  return new;
end $$;
create trigger cobrancas_parcela_fixa before update of parcela on cobrancas for each row execute function cobrancas_parcela_fixa();

-- Mesmo corpo da 0291; a implantação com valor vira as suas parcelas (app.implantacao_parcelas, que
-- só virar cliente usa; sem ele, uma parcela como antes), a última com o resto da divisão.
create or replace function console_salvar_plano(p_pessoa uuid, p_condominio uuid, p_versao integer, p_nome text, p_unidades_de integer,
                                                p_unidades_ate integer, p_valor bigint, p_ciclo text, p_dia_vencimento integer,
                                                p_implantacao_valor bigint, p_implantacao_sem_cobranca boolean, p_implantacao_referencia text,
                                                p_inicio_competencia date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pl planos_cliente;
  v_versao integer;
  v_parcelas integer := coalesce(nullif(current_setting('app.implantacao_parcelas', true), '')::integer, 1);
  k integer;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.contrato.editar');
  if p_inicio_competencia is null then perform recusar_campos('Diga a competência em que o plano começa', 'inicioCompetencia'); end if;
  if coalesce(length(btrim(p_nome)), 0) not between 2 and 60 then perform recusar_campos('Diga o nome do plano', 'nome'); end if;
  if p_unidades_de < 0 or p_unidades_ate < 1 or p_unidades_de > p_unidades_ate then
    perform recusar_campos('A faixa de unidades não fecha', 'unidadesDe', 'unidadesAte');
  end if;
  -- Sem valor é "Valor a definir", nunca zero (os preços ainda estão em decisão).
  if p_valor <= 0 then perform recusar_campos('Deixe vazio para "Valor a definir"', 'valor'); end if;
  if p_ciclo is not null and p_ciclo not in ('MENSAL', 'ANUAL') then perform recusar_campos('Escolha o ciclo', 'ciclo'); end if;
  if p_dia_vencimento not between 1 and 28 then perform recusar_campos('O vencimento vai do dia 1 ao 28', 'diaVencimento'); end if;
  if p_implantacao_valor <= 0 then perform recusar_campos('Deixe vazio quando não houver valor', 'implantacaoValor'); end if;
  select * into pl from planos_cliente where condominio_id = p_condominio;
    if pl.id is null then
      insert into planos_cliente (condominio_id, nome, unidades_de, unidades_ate, valor_centavos, ciclo, dia_vencimento,
                                  implantacao_centavos, implantacao_sem_cobranca, implantacao_referencia, inicio_competencia)
      values (p_condominio, btrim(p_nome), p_unidades_de, p_unidades_ate, p_valor, coalesce(p_ciclo, 'MENSAL'), coalesce(p_dia_vencimento, 10),
              p_implantacao_valor, coalesce(p_implantacao_sem_cobranca, false), nullif(btrim(p_implantacao_referencia), ''),
              date_trunc('month', p_inicio_competencia)::date)
      returning * into pl;
    else
      update planos_cliente
         set nome = btrim(p_nome), unidades_de = p_unidades_de, unidades_ate = p_unidades_ate, valor_centavos = p_valor,
             ciclo = coalesce(p_ciclo, 'MENSAL'), dia_vencimento = coalesce(p_dia_vencimento, 10), implantacao_centavos = p_implantacao_valor,
             implantacao_sem_cobranca = coalesce(p_implantacao_sem_cobranca, false),
             implantacao_referencia = nullif(btrim(p_implantacao_referencia), ''),
             inicio_competencia = date_trunc('month', p_inicio_competencia)::date
       where id = pl.id and versao = p_versao
      returning versao into v_versao;
      if v_versao is null then perform conflito_versao('planos_cliente', pl.id); end if;
      select * into pl from planos_cliente where id = pl.id;
    end if;
  -- A implantação com valor vira a sua cobrança (ou as suas parcelas), com a referência do serviço (PI-07).
  if pl.implantacao_centavos is not null and not exists (select 1 from cobrancas where condominio_id = p_condominio and tipo = 'IMPLANTACAO') then
    if v_parcelas not between 1 and 24 or pl.implantacao_centavos < v_parcelas then v_parcelas := 1; end if;
    for k in 1 .. v_parcelas loop
      insert into cobrancas (condominio_id, tipo, referencia, valor_centavos, vence_em, criada_por, parcela)
      values (p_condominio, 'IMPLANTACAO',
              left(coalesce(pl.implantacao_referencia, 'Implantação'), 110) || case when v_parcelas > 1 then format(' (%s/%s)', k, v_parcelas) else '' end,
              case when k < v_parcelas then pl.implantacao_centavos / v_parcelas
                   else pl.implantacao_centavos - (v_parcelas - 1) * (pl.implantacao_centavos / v_parcelas) end,
              (pl.inicio_competencia + make_interval(months => k - 1))::date + (pl.dia_vencimento - 1), p_pessoa, k);
    end loop;
  end if;
  perform registrar_historico_interno('plano.salvo', 'plano', pl.id::text,
                                      jsonb_build_object('ciclo', pl.ciclo, 'comValor', pl.valor_centavos is not null));
  return plano_json(pl);
end $$;

-- ---------------------------------------------------------------------------------------
-- Virar cliente (CM-08, quadro 331): só com as duas assinaturas conferidas. Cria de uma vez o
-- cliente na carteira (ou tira do piloto), a ficha (contatos, CNPJ, contrato assinado e termo), o
-- plano pela versão aceita (a vaga de fundador vem junto), a implantação com o responsável, as
-- promessas e quem decide (nota interna) e a troca de sistema (pendências da implantação). O
-- interessado vai para Ganho; a primeira cobrança sai do plano, na competência do início do contrato.

create function comercial_texto_promessas(i interessados, v versoes_proposta, c contratos_comercial) returns text
language sql stable
set search_path = public
as $$
  select left(concat_ws(E'\n',
    format('Do Comercial: proposta v%s aceita e contrato nº %s assinado pelos dois.', v.numero, c.numero),
    'Quem decide: ' || coalesce(i.decisor, 'não informado') || coalesce(' (decisão em ' || comercial_data_br(i.decisao_em) || ')', '') || '.',
    'Prometido como pronto: ' || (select string_agg(x, '; ') from jsonb_array_elements_text(v.incluido) x) || '.',
    'Planejado, sem data prometida: ' || (select string_agg(x, '; ') from jsonb_array_elements_text(v.planejado) x) || '.',
    'Problema do prédio: ' || i.problema || '.',
    'Critérios do síndico: ' || (select string_agg(l ->> 'titulo', '; ') from jsonb_array_elements(comercial_criterios_ordem(i.criterios)) l) || '.'), 2000)
$$;

create function comercial_virar_cliente(p_pessoa uuid, p_interessado uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  c contratos_comercial;
  v versoes_proposta;
  f faixas_preco;
  pl pilotos_comercial;
  t trocas_sistema;
  d_cnpj documentos_aceite;
  imp implantacoes;
  r record;
  v_resp uuid := nullif(p_dados ->> 'responsavelImplantacaoId', '')::uuid;
  v_cond uuid;
  v_falta text[];
  v_ref text;
  v_plano jsonb;
  v_pendencias integer := 0;
  v_hoje date := comercial_hoje();
  v_do_piloto boolean;
  pp parametros_preco;
  v_inicio date;
  v_comp date;
begin
  perform entrar_console(p_pessoa, 'console.comercial.cliente');
  select * into i from interessados where id = p_interessado for update;
  if not found then raise exception 'Interessado não encontrado' using errcode = 'TC404'; end if;
  if i.versao <> p_versao then perform conflito_versao('interessados', p_interessado); end if;
  if i.anonimizado_em is not null then perform recusar_motivo('Interessado anonimizado não muda', 'ANONIMIZADO'); end if;
  if i.virou_cliente_em is not null then perform recusar_motivo('Este interessado já virou cliente', 'VIROU_CLIENTE'); end if;
  if not (comercial_aberta(i.etapa) or i.etapa = 'GANHO') then perform recusar_motivo('Interessado fechado não vira cliente', 'INTERESSADO_FECHADO'); end if;
  select * into c from contratos_comercial where interessado_id = i.id and situacao = 'ASSINADO' for update;
  if c.id is null then perform recusar_motivo('Virar cliente libera quando as duas assinaturas estiverem conferidas', 'CONTRATO_SEM_ASSINATURAS'); end if;
  perform comercial_exigir_implantacao(v_resp);
  if i.etapa <> 'GANHO' then
    v_falta := comercial_falta(i, 'GANHO');
    if cardinality(v_falta) > 0 then
      raise exception 'Falta o que a etapa pede' using errcode = 'TC422',
        detail = jsonb_build_object('motivo', 'FALTA_PARA_ETAPA', 'campos', to_jsonb(v_falta))::text;
    end if;
  end if;
  select * into v from versoes_proposta where id = c.versao_id;
  select * into f from faixas_preco where codigo = v.faixa;
  d_cnpj := comercial_documento_recebido(i.id, 'CNPJ');
  select * into pl from pilotos_comercial where interessado_id = i.id and situacao in ('EM_ANDAMENTO', 'VIROU_PROPOSTA') for update;
  select * into t from trocas_sistema where interessado_id = i.id for update;
  v_ref := left(format('Contrato TRÍADE nº %s · modelo v%s · sha256 %s', c.numero, (c.dados -> 'modelo' ->> 'numero'), left(c.pdf_sha256, 12)), 120);

  -- O Comercial: o interessado vai para Ganho (o link da versão aceita continua para o PDF final).
  if i.etapa <> 'GANHO' then
    update interessados set etapa = 'GANHO', etapa_desde = app_now(), proximo_passo = null, proximo_passo_data = null, proximo_passo_hora = null,
           alterado_em = app_now(), alterado_por = p_pessoa
     where id = i.id;
    insert into etapas_interessado (interessado_id, de, para, criado_por) values (i.id, i.etapa, 'GANHO', p_pessoa);
    perform comercial_iniciar_cadencia(i.id);
    perform registrar_historico_interno('comercial.etapa', 'interessado', i.id::text, jsonb_build_object('de', i.etapa, 'para', 'GANHO'));
  end if;

  -- A carteira: o condomínio do piloto (aberto, virou proposta ou perdido e retomado) ou um novo.
  v_do_piloto := pl.id is not null or i.condominio_id is not null;
  if v_do_piloto then
    v_cond := coalesce(pl.condominio_id, i.condominio_id);
    perform comercial_entrar_cliente(p_pessoa, v_cond, 'console.contrato.editar');
    perform definir_transicao('PILOTO_VIROU_CLIENTE', 'Contrato assinado pelos dois');
    update clientes set estado = 'IMPLANTACAO', referencia_contrato = v_ref where condominio_id = v_cond;
    update condominios set cnpj = coalesce(d_cnpj.cnpj, cnpj), contatos = case when contatos = '[]'::jsonb then comercial_contatos_cliente(i) else contatos end
     where id = v_cond;
    update etapas_implantacao set situacao = 'PREPARADA', motivo = null, atualizado_em = app_now()
     where condominio_id = v_cond and situacao = 'NAO_SE_APLICA' and motivo = 'Piloto (CM-21): implantação mínima; volta se virar cliente';
  else
    v_cond := abrir_condominio_novo(p_pessoa);
    begin
      insert into condominios (id, nome, cidade, uf, endereco, contatos, cnpj, cenario)
      values (v_cond, v.condominio, coalesce(comercial_texto(p_dados, 'cidade'), i.cidade, v.cidade),
              coalesce(comercial_texto(p_dados, 'uf'), i.uf::text, v.uf::text), i.endereco, comercial_contatos_cliente(i), d_cnpj.cnpj,
              comercial_texto(p_dados, 'cenario'));
    exception
      when check_violation then perform recusar_campos('Confira a cidade e a UF do condomínio', 'cidade', 'uf');
      when foreign_key_violation then perform recusar_campos('Cenário desconhecido', 'cenario');
    end;
    perform definir_transicao('CLIENTE_CADASTRADO', 'Virou cliente pelo Comercial');
    insert into clientes (condominio_id, referencia_contrato) values (v_cond, v_ref);
    insert into vinculos (pessoa_id, condominio_id, funcao, criado_por) values (p_pessoa, v_cond, 'ADMINISTRACAO', p_pessoa);
    perform registrar_historico('condominio.cadastrado', 'condominio', v_cond::text, jsonb_build_object('origem', 'COMERCIAL'));
  end if;
  perform comercial_atribuir_implantacao(v_resp, p_pessoa);

  -- O plano pela versão aceita (a vaga de fundador é ocupada pelo gatilho do plano). A primeira
  -- competência é a que tem o vencimento (dia 10) na data de início do contrato ou depois; a
  -- implantação sai nas parcelas do contrato, mês a mês a partir dela.
  v_inicio := (c.dados ->> 'dataInicio')::date;
  v_comp := date_trunc('month', v_inicio)::date;
  if v_comp + 9 < v_inicio then v_comp := (v_comp + interval '1 month')::date; end if;
  select * into pp from parametros_preco;
  perform set_config('app.implantacao_parcelas', coalesce((c.dados ->> 'implantacaoParcelas')::integer, v.implantacao_parcelas, pp.parcelas_implantacao, 1)::text, true);
  v_plano := console_salvar_plano_tabela(p_pessoa, v_cond, null,
    left(case v.tabela when 'FUNDADOR' then 'Fundador, ' when 'CHEIA' then 'Tabela cheia, ' else 'Sob consulta, ' end || lower(f.nome), 60),
    f.unidades_de, f.unidades_ate, case when v.ciclo = 'ANUAL' then v.anual_centavos else v.mensal_centavos end, v.ciclo, 10,
    -- O fundador não tem implantação (0295, decisão B).
    case when v.implantacao_sem_custo or v.tabela = 'FUNDADOR' then null else v.implantacao_centavos end,
    v.implantacao_sem_custo or v.implantacao_centavos is null or v.tabela = 'FUNDADOR',
    format('Implantação · contrato nº %s', c.numero), v_comp, v.tabela);
  perform set_config('app.implantacao_parcelas', '', true);

  -- A implantação com quem cuida dela.
  imp := implantacao_do_cliente();
  update etapas_implantacao set responsavel_id = v_resp, atualizado_em = app_now()
   where implantacao_id = imp.id and responsavel_id is null;

  -- As promessas e quem decide, para a implantação não prometer outra coisa.
  insert into notas_internas (condominio_id, texto, autor_id) values (v_cond, comercial_texto_promessas(i, v, c), p_pessoa);

  -- A troca de sistema: o que falta receber e a linha do tempo viram pendências.
  if t.id is not null then
    for r in select btrim(x ->> 'texto') as texto from jsonb_array_elements(t.itens) x where not (x ->> 'recebido')::boolean loop
      insert into pendencias_implantacao (condominio_id, implantacao_id, etapa, texto, com_quem, responsavel_id, proximo_retorno, criado_por)
      values (v_cond, imp.id, 2, left('Receber da empresa anterior: ' || r.texto, 300), 'CLIENTE', v_resp, greatest(t.data_troca - 15, v_hoje), p_pessoa);
      v_pendencias := v_pendencias + 1;
    end loop;
    if t.carta_enviada_em is null then
      insert into pendencias_implantacao (condominio_id, implantacao_id, etapa, texto, com_quem, responsavel_id, proximo_retorno, criado_por)
      values (v_cond, imp.id, 2, left('A síndica assina e manda a carta à empresa anterior (' || t.empresa_anterior || ')', 300), 'CLIENTE', v_resp,
              greatest(t.data_troca - 30, v_hoje), p_pessoa);
      v_pendencias := v_pendencias + 1;
    end if;
    insert into pendencias_implantacao (condominio_id, implantacao_id, etapa, texto, com_quem, responsavel_id, proximo_retorno, criado_por)
    values (v_cond, imp.id, 6, 'Dia da troca: comunicado aos moradores e número do WhatsApp do prédio', 'EQUIPE', v_resp, greatest(t.data_troca, v_hoje), p_pessoa),
           (v_cond, imp.id, null, 'Conversa de acompanhamento com o síndico, 45 dias depois da troca', 'EQUIPE', v_resp, greatest(t.data_troca + 45, v_hoje), p_pessoa);
    v_pendencias := v_pendencias + 2;
  end if;

  -- De volta ao Comercial, sem condomínio: liga tudo ao cliente.
  perform definir_pessoa(p_pessoa);
  update contratos_comercial set condominio_id = v_cond where id = c.id;
  if t.id is not null then update trocas_sistema set condominio_id = v_cond where id = t.id; end if;
  if pl.id is not null then
    update pilotos_comercial set situacao = 'VIROU_CLIENTE', encerrado_em = coalesce(encerrado_em, app_now()), encerrado_por = coalesce(encerrado_por, p_pessoa)
     where id = pl.id;
  end if;
  update interessados set condominio_id = v_cond, virou_cliente_em = app_now(), alterado_em = app_now(), alterado_por = p_pessoa where id = i.id;
  perform comercial_inserir_conversa(i.id, 'NOTA', 'Virou cliente: carteira, plano e implantação abertos.', false, null, null);
  perform registrar_historico_interno('comercial.virou_cliente', 'interessado', i.id::text,
    jsonb_strip_nulls(jsonb_build_object('contrato', c.numero, 'piloto', v_do_piloto, 'pendencias', v_pendencias)));
  return jsonb_build_object('condominioId', v_cond, 'implantacaoId', imp.id, 'plano', v_plano, 'pendencias', v_pendencias,
                            'doPiloto', v_do_piloto, 'etapa', 'GANHO');
end $$;

-- ---------------------------------------------------------------------------------------
-- Na ficha do cliente (Console): o contrato assinado e a troca de sistema, para quem atende.

create function console_contrato_cliente(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c contratos_comercial;
  e envios_contrato;
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  perform set_config('app.comercial_sistema', 'on', true);
  select * into c from contratos_comercial where condominio_id = p_condominio and situacao = 'ASSINADO';
  if c.id is null then
    perform set_config('app.comercial_sistema', '', true);
    return jsonb_build_object('contrato', null);
  end if;
  select * into e from envios_contrato where contrato_id = c.id and parte = 'TRIADE' and situacao = 'CONFERIDO';
  v := jsonb_build_object('contrato', jsonb_strip_nulls(jsonb_build_object(
    'numero', c.numero, 'hash', c.hash, 'pdfSha256', e.sha256, 'assinadoEm', c.assinado_em, 'dataInicio', c.dados ->> 'dataInicio',
    'modelo', c.dados -> 'modelo', 'campos', comercial_campos_leitura(c.dados -> 'campos'), 'temTermo', true,
    'assinaturas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('parte', x.parte, 'assinanteNome', x.assinante_nome,
                                                                                  'cpfMascarado', x.cpf_mascarado, 'conferidoEm', x.conferido_em))
                                              order by x.parte)
                               from envios_contrato x where x.contrato_id = c.id and x.situacao = 'CONFERIDO'), '[]'::jsonb))),
    'arquivo', jsonb_build_object('caminho', e.caminho, 'nome', format('contrato-%s-assinado.pdf', c.numero), 'tipo', 'application/pdf'));
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

create function console_troca_sistema(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t trocas_sistema;
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.implantacao.ver');
  perform set_config('app.comercial_sistema', 'on', true);
  select * into t from trocas_sistema where condominio_id = p_condominio;
  v := jsonb_build_object('troca', case when t.id is not null then troca_sistema_json(t) - 'versao' end);
  perform set_config('app.comercial_sistema', '', true);
  return v;
end $$;

-- ---------------------------------------------------------------------------------------
-- O kit mostra o piloto quando houver (CM-20). Mesmo corpo da 0307, com o piloto no fim.

create or replace function proposta_kit_json(v versoes_proposta, i interessados) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'proposta', proposta_publica_json(v) - 'aosCuidados' - 'podeAceitar' - 'aceite',
    'predio', jsonb_strip_nulls(jsonb_build_object(
      'condominio', v.condominio, 'cidade', v.cidade, 'uf', v.uf, 'unidades', v.unidades,
      'administradora', i.administradora, 'appAdministradora', i.app_administradora, 'sistemaAtual', i.sistema_atual,
      'fidelidadeAte', i.fidelidade_ate, 'assembleiaOrdinaria', i.assembleia_ordinaria, 'mandatoAte', i.mandato_ate, 'decisaoEm', i.decisao_em,
      'problema', i.problema, 'criterios', comercial_criterios_ordem(i.criterios), 'criterioOutro', i.criterio_outro)),
    'comparativo', jsonb_strip_nulls(jsonb_build_object(
      'triade', jsonb_strip_nulls(jsonb_build_object('ciclo', v.ciclo, 'mensal', v.mensal_centavos, 'anual', v.anual_centavos,
                                                     'porApartamento', v.por_apartamento_centavos, 'implantacao', v.implantacao_centavos,
                                                     'implantacaoSemCusto', v.implantacao_sem_custo, 'estimativa', true)),
      'sistemaAtual', case when i.sistema_atual is not null then jsonb_strip_nulls(jsonb_build_object('nome', i.sistema_atual, 'fidelidadeAte', i.fidelidade_ate)) end,
      'concorrentes', (select coalesce(jsonb_agg(jsonb_build_object(
            'nome', c ->> 'nome',
            'confirmado', exists (select 1 from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                                                       and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome')),
            'planos', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'plano', pc.plano, 'modelo', pc.modelo, 'preco', comercial_preco_concorrente(pc, v.unidades), 'aPartirDe', pc.a_partir_de,
                  -- De onde a equipe leu o preço (fonte e data) fica só na Tabela de preços (CM-12).
                  'porApartamento', case when comercial_preco_concorrente(pc, v.unidades) is not null
                                         then greatest(round(comercial_preco_concorrente(pc, v.unidades)::numeric / v.unidades), 1)::bigint end))
                  order by pc.plano nulls first), '[]'::jsonb)
                from precos_concorrentes pc where pc.arquivado_em is null and pc.conferido
                                              and comercial_normalizar(pc.nome) = comercial_normalizar(c ->> 'nome'))) order by o), '[]'::jsonb)
         from jsonb_array_elements(i.concorrentes) with ordinality x(c, o))))
      || proposta_comparativo_criterios(v, i),
    'respostas', proposta_conteudo(v) -> 'respostas',
    'referencias', proposta_referencias(v),
    'oferta', jsonb_build_object('incluido', v.incluido, 'planejado', v.planejado))
  -- O piloto (CM-21): prazo, meta e, se terminou, o resultado medido; com quem foi combinado é só da equipe.
  || coalesce((select jsonb_build_object('piloto', piloto_comercial_json(p, false))
                 from pilotos_comercial p where p.interessado_id = i.id and p.situacao <> 'PERDIDO'
                order by p.criado_em desc limit 1), '{}'::jsonb)
$$;

-- A ficha (0296) com as outras oportunidades do mesmo contato (CM-09), o piloto e a data de
-- virar cliente.
create or replace function comercial_ficha(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  pl pilotos_comercial;
begin
  perform entrar_console(p_pessoa, 'console.comercial.ver');
  i := comercial_buscar(p_id);
  pl := comercial_piloto_atual(i.id);
  return comercial_json(i, true) || jsonb_build_object(
    'conversas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', c.id, 'canal', c.canal, 'resumo', c.resumo, 'respondeu', c.respondeu, 'em', c.criado_em, 'passo', c.cadencia_passo,
        'autor', case when c.criado_por is not null then jsonb_build_object('id', c.criado_por, 'nome', comercial_nome(c.criado_por)) end))
        order by c.criado_em desc, c.id desc) from conversas_comercial c where c.interessado_id = p_id), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('de', e.de, 'para', e.para, 'motivoPerda', e.motivo_perda, 'em', e.criado_em,
        'autor', case when e.criado_por is not null then jsonb_build_object('id', e.criado_por, 'nome', comercial_nome(e.criado_por)) end))
        order by e.criado_em) from etapas_interessado e where e.interessado_id = p_id), '[]'::jsonb),
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'texto', m.texto) order by m.criado_em)
                             from mensagens_comercial m where m.ativa and m.etapa = i.etapa), '[]'::jsonb),
    'objecoesLista', (select jsonb_agg(jsonb_build_object('codigo', o.codigo, 'texto', o.texto, 'resposta', o.resposta) order by o.ordem) from objecoes_comercial o),
    'etapasLista', comercial_etapas_json(),
    'equipe', comercial_equipe_json(),
    'podeEditar', pode_global('console.comercial.editar'),
    'podeExcluir', pode_global('console.comercial.excluir'))
  || jsonb_strip_nulls(jsonb_build_object(
    'contatoDe', comercial_grupo(i),
    'oportunidades', comercial_oportunidades_json(i),
    'piloto', case when pl.id is null then null when comercial_ve_cliente(i) then piloto_comercial_json(pl, true)
                   else piloto_comercial_json(pl, false) - 'resultado' end,
    'contratoSituacao', (comercial_contrato_vigente(i.id)).situacao,
    'virouClienteEm', i.virou_cliente_em));
end $$;

-- ---------------------------------------------------------------------------------------
-- LGPD (CM-12). A anonimização apaga também os documentos, o contrato e os envios (e os arquivos,
-- pela fila da retenção). De quem virou cliente, o contrato assinado, os dois envios conferidos e
-- os documentos recebidos ficam pelo prazo legal (tipo 36). Mesmo corpo da 0307, com o que é da 0308.
-- Os arquivos vão para a fila mesmo quando a linha já estava apagada (a fila ignora o repetido), e
-- o condomínio do piloto que não virou cliente perde os contatos e o CNPJ.

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
  perform set_config('app.comercial_sistema', '', true);
end $$;

-- Envios que nunca terminaram (revisão do 3f3902a): o navegador pediu o caminho e o arquivo não foi
-- conferido. Passado um dia (o link de envio vale duas horas), o pedido é recusado e o arquivo, se
-- chegou, vai para a fila da retenção. Roda todo dia, antes da anonimização e da retenção.
create function comercial_limpar_envios_abertos() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total integer := 0;
begin
  perform set_config('app.comercial_sistema', 'on', true);
  for r in update documentos_aceite set situacao = 'RECUSADO', motivo_recusa = 'O arquivo não foi conferido a tempo; envie de novo.'
            where situacao = 'ENVIANDO' and enviado_em < app_now() - interval '1 day'
            returning caminho loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ABANDONADO');
    v_total := v_total + 1;
  end loop;
  for r in update envios_contrato set situacao = 'RECUSADO_NA_HORA', motivo_auto = 'ARQUIVO_INVALIDO',
                                      motivo_texto = 'O arquivo não foi conferido a tempo; envie de novo.',
                                      conferido_auto_em = app_now(), apagado_em = app_now()
            where situacao = 'ENVIANDO' and enviado_em < app_now() - interval '1 day'
            returning caminho loop
    perform enfileirar_arquivo('comercial', r.caminho, 'COMERCIAL_ABANDONADO');
    v_total := v_total + 1;
  end loop;
  perform set_config('app.comercial_sistema', '', true);
  return v_total;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('limpar-envios-comercial', '47 3 * * *', 'select public.comercial_limpar_envios_abertos()');
exception when others then
  raise notice 'pg_cron indisponível: agende comercial_limpar_envios_abertos() de outro jeito (%).', sqlerrm;
end $$;

-- Pedido de exclusão (0296): a pessoa pediu, então somem todas as oportunidades do mesmo contato
-- (CM-09), e o contato entra na lista de não contatar.
create or replace function comercial_excluir(p_pessoa uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i interessados;
  r record;
  v_total integer := 0;
begin
  perform entrar_console(p_pessoa, 'console.comercial.excluir');
  i := comercial_buscar(p_id);
  if i.anonimizado_em is not null then return jsonb_build_object('id', p_id, 'anonimizado', true, 'oportunidades', 0); end if;
  if num_nonnulls(i.whatsapp, i.email, i.cnpj) > 0 then
    insert into nao_contatar (whatsapp, email, cnpj, motivo, criado_por) values (i.whatsapp, i.email, i.cnpj, 'EXCLUSAO', p_pessoa);
  end if;
  for r in select o.id from interessados o where coalesce(o.contato_de, o.id) = comercial_grupo(i) and o.anonimizado_em is null
                                              and (o.id = i.id or o.whatsapp is not distinct from i.whatsapp and o.email is not distinct from i.email) loop
    perform comercial_anonimizar(r.id, 'Apagado a pedido da pessoa (LGPD).');
    perform registrar_historico_interno('comercial.excluido', 'interessado', r.id::text, '{}'::jsonb);
    v_total := v_total + 1;
  end loop;
  return jsonb_build_object('id', p_id, 'anonimizado', true, 'oportunidades', v_total);
end $$;

-- ---------------------------------------------------------------------------------------
-- O histórico das entidades novas fica com o resto do Comercial.

alter policy historico_leitura on historico
  using ((condominio_id = contexto_condominio() and (not interno or contexto_equipe()))
         or (condominio_id is null and not interno and autor_id is not distinct from contexto_pessoa())
         or (condominio_id is null and interno and pode_global('console.historico.equipe'))
         or (condominio_id is null and interno and entidade = 'precos' and pode_global('console.precos.ver'))
         or (condominio_id is null and interno and entidade in ('interessado', 'lote_comercial', 'nao_contatar', 'mensagem_comercial',
                                                                'cadencia_comercial', 'etapa_comercial', 'proposta', 'resposta_comercial',
                                                                'referencia_comercial', 'fato_comparativo', 'modelo_contrato',
                                                                'documento_aceite', 'contrato_comercial', 'piloto_comercial', 'troca_sistema')
             and pode_global('console.comercial.ver')));

-- ---------------------------------------------------------------------------------------
-- Quem está no Console: as ações do menu, agora com assinar pela TRÍADE e virar cliente. A lista
-- leva as da 0295, 0296, 0301 e 0304, para nenhuma frente apagar a da outra.

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
                                          'console.comercial.assinar', 'console.comercial.cliente')), '[]'::jsonb))
    into v from pessoas p where p.id = p_pessoa;
  return v;
end $$;

call fechar_acesso();

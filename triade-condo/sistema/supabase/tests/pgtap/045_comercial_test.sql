-- Comercial no Console (0296, R17.1 e R17.2): a função Comercial (só o Comercial, sem cliente),
-- a entrada do site com o mesmo contato juntando e a origem fixa, o registro à mão, a hora útil
-- do primeiro retorno, a tarefa da vez e o negócio parado, as etapas com o que pedem, as
-- conversas só de inserção, a cadência que só cria tarefas, a planilha com parecidos e não
-- contatar, o pedido de exclusão, a anonimização dos antigos, a exportação e os modelos.
begin;
select plan(101);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca', 'COMERCIAL') as com,
  teste.equipe('Inês', 'IMPLANTACAO') as impl,
  teste.equipe('Sueli', 'SUPORTE') as sup,
  teste.pessoa('Síndica Ana') as ana;
create temp table c as select console_criar_condominio(adm, 'Residencial Ipê', 'Brasília', 'DF', null) as ipe from ids;
grant select on ids, c to dominio;

create function pg_temp.erro(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) $$;
create function pg_temp.motivo(p_sql text) returns text language sql as $$ select teste.erro(p_sql) -> 'detalhe' ->> 'motivo' $$;
create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.v(p_id uuid) returns integer language sql as $$ select versao from interessados where id = p_id $$;
create function pg_temp.site(p_whatsapp text, p_condominio text, p_utm jsonb default null) returns jsonb language sql as $$
  select comercial_entrada_site(jsonb_build_object('nome', 'Renata Moura', 'whatsapp', p_whatsapp, 'condominio', p_condominio, 'faixa', 'DE_41_A_100',
                                                   'unidadesTexto', '41 a 100', 'consentimento', true, 'pagina', '/demonstracao', 'utm', p_utm)) $$;
create function pg_temp.manual(p_dados jsonb) returns jsonb language sql as $$
  select comercial_criar((select com from ids), jsonb_build_object('condominio', 'Residencial Cerrado', 'pessoa', 'Lúcia Prado', 'origem', 'INSTAGRAM',
                                                                   'contatoAceito', true) || p_dados) $$;

-- Função Comercial (CM-11).
select is((select nome from funcoes where codigo = 'COMERCIAL' and sistema = 'CONSOLE'), 'Comercial', 'a função Comercial existe no Console');
select is((select array_agg(acao order by acao) from funcao_acoes where funcao = 'COMERCIAL'),
  array['console.comercial.editar', 'console.comercial.ver'], 'o Comercial só vê e edita o Comercial');
select is((select array_agg(acao order by acao) from funcao_acoes where funcao = 'ADMINISTRACAO' and acao like 'console.comercial.%'),
  array['console.comercial.assinar', 'console.comercial.cliente', 'console.comercial.desconto', 'console.comercial.editar', 'console.comercial.excluir',
        'console.comercial.exportar', 'console.comercial.modelos', 'console.comercial.ver'],
  'a Administração também exporta, apaga a pedido, muda os modelos, aprova desconto (0304), assina pela TRÍADE e vira cliente (0308)');
select is((select console_sessao(com) -> 'acoes' from ids), '["console.comercial.editar", "console.comercial.ver"]'::jsonb,
  'a sessão do Comercial traz as ações do menu');
select ok((select console_sessao(adm) -> 'acoes' ? 'console.comercial.modelos' from ids), 'a sessão da Administração traz os modelos');
select is(pg_temp.motivo($$ select console_atribuir(adm, ipe, com, 'COMERCIAL') from ids, c $$), 'COMERCIAL_SEM_CLIENTE',
  'a função Comercial não é atribuída a cliente');
select is((select count(*)::int from console_carteira((select com from ids))), 0, 'o Comercial não vê nenhum condomínio');
select throws_ok($$ select console_tabela_precos(com) from ids $$, 'TC401', null, 'o Comercial não vê a tabela de preços');
select throws_ok($$ select console_salvar_plano_tabela(com, ipe, null, 'x', 1, 40, 12900, 'MENSAL', 10, null, true, null, current_date, 'FUNDADOR') from ids, c $$,
  'TC401', null, 'o Comercial não muda plano de cliente');
select throws_ok($$ select comercial_lista(impl) from ids $$, 'TC401', null, 'a Implantação não vê o Comercial');
select throws_ok($$ select comercial_lista(ana) from ids $$, 'TC401', null, 'o síndico nunca vê o Comercial');

-- Hora útil (K.1): segunda a sexta, das 9h às 18h de Brasília.
select is(comercial_hora_util('2026-10-23 17:30-03'), '2026-10-26 09:30-03'::timestamptz, 'sexta 17:30 vence segunda 9:30');
select is(comercial_hora_util('2026-10-24 10:00-03'), '2026-10-26 10:00-03'::timestamptz, 'sábado vence segunda 10:00');
select is(comercial_hora_util('2026-10-27 08:00-03'), '2026-10-27 10:00-03'::timestamptz, 'antes das 9h vence às 10h');
select is(comercial_hora_util('2026-10-28 12:00-03'), '2026-10-28 13:00-03'::timestamptz, 'no meio do dia, uma hora depois');
select is(comercial_hora_util('2026-10-28 19:00-03'), '2026-10-29 10:00-03'::timestamptz, 'depois das 18h vence no dia seguinte às 10h');

-- Entrada do site (CM-01).
create temp table s1 as select pg_temp.site('5561998760412', 'Edifício Jatobá', '{"utm_source": "instagram", "utm_campaign": "fundador"}') as r;
create temp table j as select (r ->> 'id')::uuid as id from s1;
select is((select r ->> 'juntado' from s1), 'false', 'o pedido do site cria um interessado');
select is((select array[etapa, origem, base_legal, optin_canal, faixa] from interessados where id = (select id from j)),
  array['NOVO', 'SITE', 'CONSENTIMENTO', 'SITE', 'DE_41_A_100'], 'entra como Novo, origem Site, com consentimento e o opt-in do site');
select ok((select primeiro_retorno_ate > criado_em and primeira_resposta_em is null from interessados where id = (select id from j)),
  'o primeiro retorno fica marcado para 1 hora útil');
select is((select c.nome from interessados i join cadencias_comercial c on c.id = i.cadencia_id where i.id = (select id from j)), 'Novo pelo site',
  'a cadência do site começa sozinha');
select is((select utm from interessados where id = (select id from j)), '{"utm_source": "instagram", "utm_campaign": "fundador"}'::jsonb, 'guarda as UTM');
create temp table s2 as select pg_temp.site('5561998760412', 'Edifício Jatobá de novo', '{"utm_source": "google"}') as r;
select is((select (r ->> 'id')::uuid from s2), (select id from j), 'o mesmo WhatsApp junta no mesmo interessado');
select is((select r ->> 'juntado' from s2), 'true', 'e diz que juntou');
select is((select array[origem, utm ->> 'utm_source', condominio] from interessados where id = (select id from j)),
  array['SITE', 'instagram', 'Edifício Jatobá'], 'a primeira origem e as UTM não mudam');
select is((select count(*)::int from conversas_comercial where interessado_id = (select id from j) and canal = 'ENTRADA'), 2,
  'o pedido novo vira conversa');
select is((select cadencia_fim_motivo from interessados where id = (select id from j)), 'RESPONDEU', 'a pessoa voltou a falar: a cadência para');
select is(pg_temp.campos($$ select comercial_entrada_site('{"whatsapp": "5561998760412", "condominio": "X", "consentimento": false}') $$),
  '["consentimento"]'::jsonb, 'sem consentimento o site não grava');
select throws_ok($$ update interessados set origem = 'INSTAGRAM' where id = (select id from j) $$, 'TC422', null, 'a origem não muda nem direto na tabela');

-- À mão (CM-02, CM-12).
select is(pg_temp.campos($$ select pg_temp.manual('{"contatoAceito": false, "whatsapp": "5561999990087"}') $$), '["contatoAceito"]'::jsonb,
  'à mão pede a confirmação de que a pessoa procurou ou aceitou o contato');
select is(pg_temp.campos($$ select pg_temp.manual('{"origem": "SITE", "whatsapp": "5561999990087"}') $$), '["origem"]'::jsonb,
  'Site não é origem à mão');
select is(pg_temp.campos($$ select pg_temp.manual('{}') $$), '["whatsapp", "email"]'::jsonb, 'pede o WhatsApp ou o e-mail');
create temp table m1 as select pg_temp.manual('{"whatsapp": "5561999990087", "email": "Lucia@Exemplo.com", "faixa": "DE_41_A_100",
  "optinTexto": "Aceitou receber mensagens pelo WhatsApp comercial", "responsavelId": null}') as r;
create temp table cerrado as select (r ->> 'id')::uuid as id from m1;
select is((select array[origem, base_legal, optin_canal, email] from interessados where id = (select id from cerrado)),
  array['INSTAGRAM', 'LEGITIMO_INTERESSE', 'WHATSAPP', 'lucia@exemplo.com'], 'à mão: legítimo interesse documentado e o opt-in do WhatsApp');
select is((select pg_temp.manual('{"email": "lucia@exemplo.com", "condominio": "Outro nome"}') ->> 'id')::uuid, (select id from cerrado),
  'o mesmo e-mail junta no interessado aberto');
select is(pg_temp.campos($$ select pg_temp.manual(jsonb_build_object('whatsapp', '5561999990001', 'responsavelId', (select impl from ids))) $$),
  '["responsavelId"]'::jsonb, 'responsável só com Comercial ou Administração');
create temp table cot as select (pg_temp.manual('{"whatsapp": "5561999990002", "origem": "COTACAO", "origemDetalhe": "oHub"}') ->> 'id')::uuid as id;
select is((select primeiro_retorno_ate - criado_em from interessados where id = (select id from cot)), interval '24 hours',
  'cotação tem 24 horas para o primeiro retorno');

-- Lista, tarefa da vez e Meu dia (CM-04, CM-14).
select is((select comercial_lista(com) -> 'contagens' ->> 'abertos' from ids), '3', 'três interessados abertos');
select is((select comercial_ficha(com, (select id from j)) ->> 'whatsapp' from ids), '5561998760412', 'a ficha mostra o WhatsApp inteiro');
select is((select i ->> 'whatsappMascarado' from jsonb_array_elements((select comercial_lista(com) -> 'interessados' from ids)) i
            where i ->> 'id' = (select id::text from j)), '(61) 9 ••••-0412', 'a lista mostra o WhatsApp mascarado');
select is((select jsonb_array_length(comercial_lista(com, 'jatoba') -> 'interessados') from ids), 1, 'a busca acha pelo condomínio sem acento');
select is((select comercial_proximo_passo(com, (select id from cerrado), pg_temp.v((select id from cerrado)), 'Ligar de novo',
                                          (app_now() at time zone 'America/Sao_Paulo')::date - 1, null, com) ->> 'versao' from ids)::int,
  pg_temp.v((select id from cerrado)), 'grava o próximo passo e o responsável');
select is((select comercial_tarefa(i) ->> 'situacao' from interessados i where id = (select id from cerrado)), 'ATRASADO',
  'próximo passo de ontem é atrasado');
select is((select comercial_lista(com) -> 'interessados' -> 0 ->> 'id' from ids), (select id::text from cerrado), 'o atrasado vem primeiro');
select is((select jsonb_array_length(comercial_meu_dia(com) -> 'atrasados') from ids), 1, 'o Meu dia da Bianca tem o atrasado dela');
select is((select comercial_meu_dia(adm) -> 'atrasados' from ids), '[]'::jsonb, 'o atrasado da Bianca não aparece no Meu dia da Carolina');
select is(pg_temp.campos($$ select comercial_proximo_passo(com, (select id from cerrado), pg_temp.v((select id from cerrado)), 'Ligar', null) from ids $$),
  '["data"]'::jsonb, 'próximo passo pede a data');
do $$ begin perform ajustar_relogio(interval '6 days'); end $$;
select is((select (comercial_tarefa(i) ->> 'diasParado')::int from interessados i where id = (select id from cot)), 6,
  'seis dias sem conversa no Novo: parado');
select ok((select (comercial_json(i, false) ->> 'atencao')::boolean from interessados i where id = (select id from cot)), 'parado pede atenção');
select lives_ok($$ select comercial_registrar_conversa(com, (select id from cot), 'NOTA', 'O síndico viaja até sexta.', true) from ids $$,
  'registra a nota interna');
select is((select (comercial_tarefa(i) ->> 'diasParado')::int from interessados i where id = (select id from cot)), 6,
  'a nota interna não é conversa com a pessoa: continua parado');
select ok((select primeira_resposta_em is null from interessados where id = (select id from cot)), 'a nota interna não conta como primeiro retorno');
select lives_ok($$ select comercial_registrar_conversa(com, (select id from cot), 'LIGACAO', 'Não atendeu; mandou áudio às 10:02.') from ids $$,
  'registra a conversa');
select is((select comercial_tarefa(i) ->> 'diasParado' from interessados i where id = (select id from cot)), null, 'só a conversa zera o contador');
select ok((select primeira_resposta_em is not null from interessados where id = (select id from cot)), 'a primeira conversa da equipe é o primeiro retorno');
do $$ begin perform ajustar_relogio(interval '0'); end $$;

-- Conversas só de inserção (CM-05).
select throws_ok($$ update conversas_comercial set resumo = 'outro' where interessado_id = (select id from cot) $$, 'TC422', null,
  'conversa não se altera');
select throws_ok($$ delete from conversas_comercial where interessado_id = (select id from cot) $$, 'TC422', null, 'conversa não se apaga');
select throws_ok($$ delete from interessados where id = (select id from cot) $$, null, null, 'interessado não se apaga');

-- Etapas com o que pedem (CM-03, CM-25).
select is(pg_temp.campos($$ select comercial_mudar_etapa(com, (select id from cot), pg_temp.v((select id from cot)), 'PROPOSTA_ENVIADA') from ids $$),
  '["faixa"]'::jsonb, 'proposta pede a faixa de unidades');
select is(pg_temp.motivo($$ select comercial_mudar_etapa(com, (select id from cot), pg_temp.v((select id from cot)), 'DEMO_MARCADA') from ids $$),
  'FALTA_PARA_ETAPA', 'demonstração marcada pede a data');
select is(pg_temp.campos($$ select comercial_mudar_etapa(com, (select id from cerrado), pg_temp.v((select id from cerrado)), 'APROVACAO') from ids $$),
  '["decisor", "decisaoEm"]'::jsonb, 'aprovação no condomínio pede quem decide e a data da reunião');
select is(pg_temp.campos($$ select comercial_mudar_etapa(com, (select id from cot), pg_temp.v((select id from cot)), 'PERDIDO') from ids $$),
  '["motivoPerda"]'::jsonb, 'perdido pede o motivo');
select throws_ok($$ select comercial_mudar_etapa(com, (select id from cot), 1, 'EM_CONTATO') from ids $$, 'TC409', null, 'versão velha dá conflito');
select is((select comercial_mudar_etapa(com, (select id from cerrado), pg_temp.v((select id from cerrado)), 'PROPOSTA_ENVIADA') ->> 'etapa' from ids),
  'PROPOSTA_ENVIADA', 'com a faixa, vai para Proposta enviada');
select is((select c.nome from interessados i join cadencias_comercial c on c.id = i.cadencia_id where i.id = (select id from cerrado)), 'Depois da proposta',
  'a etapa nova começa a cadência dela');
select is((select array_agg(coalesce(de, '-') || '>' || para order by criado_em) from etapas_interessado where interessado_id = (select id from cerrado)),
  array['->NOVO', 'NOVO>PROPOSTA_ENVIADA'], 'a mudança de etapa fica registrada');
select ok(exists (select 1 from historico where acao = 'comercial.etapa' and entidade_id = (select id::text from cerrado) and interno),
  'e no histórico interno');

-- Ficha do prédio, objeções e concorrentes (CM-16, CM-17).
select is(pg_temp.campos($$ select comercial_salvar(com, (select id from cerrado), pg_temp.v((select id from cerrado)),
  '{"condominio": "Residencial Cerrado", "whatsapp": "5561999990087", "faixa": "DE_41_A_100", "objecoes": ["INVENTADA"]}') from ids $$),
  '["objecoes"]'::jsonb, 'objeção só da lista fechada');
select is(pg_temp.motivo($$ select comercial_salvar(com, (select id from cerrado), pg_temp.v((select id from cerrado)),
  '{"condominio": "Residencial Cerrado", "whatsapp": "5561998760412"}') from ids $$), 'DUPLICADO', 'o WhatsApp de outro interessado não entra');
select lives_ok($$ select comercial_salvar(com, (select id from cerrado), pg_temp.v((select id from cerrado)), jsonb_build_object(
  'condominio', 'Residencial Cerrado', 'whatsapp', '5561999990087', 'email', 'lucia@exemplo.com', 'faixa', 'DE_41_A_100', 'unidades', 64,
  'administradora', 'Contábil Norte', 'appAdministradora', true, 'sistemaAtual', 'Planilha', 'assembleiaOrdinaria', '2027-03-18',
  'mandatoAte', '2027-03-31', 'decisor', 'Lúcia leva ao conselho', 'decisaoEm', '2026-11-06', 'objecoes', '["AUMENTA_TAXA", "MORADORES_IDOSOS"]'::jsonb,
  'concorrentes', '[{"nome": "Sistema X", "preco": 24900}, {"nome": "App da administradora"}]'::jsonb,
  'optinTexto', 'Aceitou receber mensagens pelo WhatsApp comercial', 'responsavelId', com)) from ids $$, 'grava o prédio, as objeções e os concorrentes');
select is((select comercial_ficha(com, (select id from cerrado)) -> 'predio' ->> 'administradora' from ids), 'Contábil Norte', 'a ficha mostra o prédio');
select is((select comercial_mudar_etapa(com, (select id from cerrado), pg_temp.v((select id from cerrado)), 'APROVACAO') ->> 'etapa' from ids),
  'APROVACAO', 'com quem decide e a data, vai para Aprovação no condomínio');

-- Mensagens prontas e cadência (CM-15, CM-26).
select is((select jsonb_array_length(comercial_ficha(com, (select id from cerrado)) -> 'mensagens') from ids), 1, 'a ficha traz as mensagens da etapa');
select is(pg_temp.motivo($$ select comercial_registrar_conversa(com, (select id from cot), 'WHATSAPP', 'Mensagem pronta', false,
  (select id from mensagens_comercial limit 1)) from ids $$), 'SEM_OPTIN', 'sem opt-in, a mensagem pronta fica desligada');
create temp table k as select (pg_temp.manual('{"whatsapp": "5561999990003", "condominio": "Edifício Aroeira"}') ->> 'id')::uuid as id;
update interessados set faixa = 'ATE_40' where id = (select id from k);
select comercial_mudar_etapa(com, (select id from k), pg_temp.v((select id from k)), 'PROPOSTA_ENVIADA') from ids;
update interessados set primeiro_retorno_ate = app_now() - interval '1 hour' where id = (select id from k);
select is((select comercial_tarefa(i) ->> 'tarefa' from interessados i where id = (select id from k)), 'PRIMEIRO_RETORNO',
  'primeiro retorno vencido vem antes da cadência');
select comercial_registrar_conversa(com, (select id from k), 'WHATSAPP', 'Primeiro retorno') from ids;
select is((select comercial_tarefa(i) ->> 'tarefa' from interessados i where id = (select id from k)), 'CADENCIA', 'depois, o passo da cadência');
select comercial_cadencia(com, (select id from k), 'FEITO') from ids, generate_series(1, 3);
select is((select cadencia_feitos from interessados where id = (select id from k)), 3, 'cada passo feito vira conversa e avança');
select is((select count(*)::int from conversas_comercial where interessado_id = (select id from k) and cadencia_passo is not null), 3,
  'as conversas dos passos ficam registradas');
select comercial_cadencia(com, (select id from k), 'FEITO') from ids;
select is((select array[etapa, cadencia_fim_motivo] from interessados where id = (select id from k)), array['SEM_RESPOSTA', 'CONCLUIDA'],
  'o último passo sem resposta termina em Sem resposta');
select is(pg_temp.motivo($$ select comercial_cadencia(com, (select id from k), 'FEITO') from ids $$), 'SEM_CADENCIA', 'nada depois do fim');

-- Planilha (CM-24) e não contatar (CM-12).
select comercial_nao_contatar(com, '5561911112222', null, null, 'Pediu para não receber contato') from ids;
create temp table lote as select jsonb_build_object('arquivo', 'predios-guara.xlsx', 'origemTexto', 'Lista de prédios do Guará',
  'baseLegalTexto', 'Prospecção de condomínios com dado público do prédio; teste de legítimo interesse aprovado em 24/10.',
  'linhas', jsonb_build_array(
    jsonb_build_object('linha', 2, 'condominio', 'Residencial Pequi', 'cnpj', '11222333000144', 'endereco', 'QE 40, Guará'),
    jsonb_build_object('linha', 3, 'condominio', 'Ed. Cerrado', 'email', 'lucia@exemplo.com'),
    jsonb_build_object('linha', 4, 'condominio', 'Bloqueado', 'whatsapp', '5561911112222'),
    jsonb_build_object('linha', 5, 'condominio', 'Res. Ipê Roxo', 'endereco', 'Rua 3, Lote 9'))) as d;
create temp table previa as select comercial_importar((select com from ids), (select d from lote), false) as r;
select is((select array[r ->> 'novas', jsonb_array_length(r -> 'parecidas')::text, jsonb_array_length(r -> 'bloqueados')::text] from previa),
  array['2', '1', '1'], 'a conferência mostra as novas, as parecidas e as bloqueadas');
select is((select count(*)::int from lotes_comercial), 0, 'conferir não grava nada');
select is(pg_temp.motivo($$ select comercial_importar(com, (select d from lote), true) from ids $$), 'PARECIDOS_SEM_DECISAO',
  'nada entra até decidir os parecidos');
create temp table imp as select comercial_importar((select com from ids),
  jsonb_set((select d from lote), '{linhas,1,decisao}', '"JUNTAR"'), true) as r;
select is((select array[(r ->> 'criados'), (r ->> 'juntados')] from imp), array['2', '1'], 'cria as novas e junta a parecida');
select is((select array[origem, base_legal] from interessados where condominio = 'Residencial Pequi'), array['IMPORTACAO', 'LEGITIMO_INTERESSE'],
  'a linha nova vem com a origem e a base legal do lote');
select is((select base_legal_texto from lotes_comercial), 'Prospecção de condomínios com dado público do prédio; teste de legítimo interesse aprovado em 24/10.',
  'o lote guarda o teste de legítimo interesse');
select is((select jsonb_array_length(comercial_importar(com, '{"origemTexto": "Outra lista", "baseLegalTexto": "Teste de legítimo interesse do lote",
  "linhas": [{"linha": 2, "condominio": "Pequi de novo", "endereco": "Q.E. 40 - Guará"}]}', false) -> 'parecidas') from ids), 1,
  'o mesmo endereço, escrito de outro jeito, aparece como parecido');
select is(pg_temp.motivo($$ select pg_temp.manual('{"whatsapp": "5561911112222"}') $$), 'NAO_CONTATAR', 'quem está na lista de não contatar não entra à mão');

-- Pedido de exclusão, anonimização e exportação (CM-12).
select throws_ok($$ select comercial_excluir(com, (select id from cot)) from ids $$, 'TC401', null, 'o Comercial não apaga');
select lives_ok($$ select comercial_excluir(adm, (select id from cot)) from ids $$, 'a Administração apaga a pedido');
select is((select array[coalesce(whatsapp, '-'), coalesce(nome_contato, '-'), etapa] from interessados where id = (select id from cot)),
  array['-', '-', 'NOVO'], 'apaga o nome e o WhatsApp e ficam os números do funil');
select ok(exists (select 1 from nao_contatar where whatsapp = '5561999990002' and motivo = 'EXCLUSAO'), 'o número entra na lista de não contatar');
select is((select array_agg(distinct resumo) from conversas_comercial where interessado_id = (select id from cot)), array['Apagado a pedido da pessoa (LGPD).'],
  'as conversas também');
select comercial_mudar_etapa(com, (select id from j), pg_temp.v((select id from j)), 'PERDIDO', 'FICOU_PARA_DEPOIS', 'Esperam a eleição') from ids;
do $$ begin perform ajustar_relogio(interval '13 months'); end $$;
select is(comercial_anonimizar_antigos(), 2, 'perdido e sem resposta há mais de 12 meses sem conversa são anonimizados');
do $$ begin perform ajustar_relogio(interval '0'); end $$;
select ok((select anonimizado_em is not null and whatsapp is null from interessados where id = (select id from j)), 'o perdido antigo foi anonimizado');
select throws_ok($$ select comercial_exportar(com) from ids $$, 'TC401', null, 'o Comercial não exporta');
select ok((select jsonb_array_length(comercial_exportar(adm) -> 'linhas') from ids) >= 3, 'a Administração exporta');
select ok(exists (select 1 from historico where acao = 'comercial.exportado' and interno), 'a exportação fica no histórico');

-- Modelos (só a Administração muda) e RLS.
select is((select jsonb_array_length(comercial_modelos(com) -> 'cadencias') from ids), 3, 'o Comercial lê as três cadências');
select throws_ok($$ select comercial_salvar_mensagem(com, null, null, 'NOVO', 'Teste', 'Texto da mensagem de teste', true) from ids $$, 'TC401', null,
  'o Comercial não muda as mensagens');
select is((select comercial_salvar_etapa(adm, 'NOVO', (select versao from parametros_etapa_comercial where etapa = 'NOVO'), 8, 3) ->> 'versao' from ids), '2',
  'a Administração corrige a chance e o limite da etapa');
select is(pg_temp.campos($$ select comercial_salvar_cadencia(adm, null, null, 'Ruim', 'NEGOCIACAO', null, '[{"dia": 3, "canal": "WHATSAPP", "texto": "Oi"},
  {"dia": 1, "canal": "LIGACAO", "texto": "Ligar"}]', false, true) from ids $$), '["passos"]'::jsonb, 'os dias da cadência vão em ordem');
set local role dominio;
select tentar_definir_pessoa((select sup from ids));
create temp table rls_sup as select (select count(*)::int from interessados) + (select count(*)::int from conversas_comercial) as n;
reset role;
select limpar_contexto();
select is((select n from rls_sup), 0, 'nem direto na tabela o suporte enxerga um interessado');

select * from finish();
rollback;

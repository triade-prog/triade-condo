-- A proposta como apresentação (0312, R17.8; CM-34; quadros 450 a 457): a versão guarda a Tabela
-- de preços do dia, quem cuida, o escopo e as condições; a impressão digital cobre tudo isso; quem
-- implanta é da equipe ativa; o e-mail só sai quando é do domínio da TRÍADE; a versão enviada antes
-- da 0312 continua com o mesmo conteúdo; a sugestão leva a prévia e a lista de quem pode implantar.
begin;
select plan(25);

create temp table ids as select
  teste.equipe('Carolina', 'ADMINISTRACAO') as adm,
  teste.equipe('Bianca Rocha', 'COMERCIAL') as com,
  teste.equipe('Davi Lima', 'IMPLANTACAO') as imp,
  teste.equipe('Ex da equipe', 'IMPLANTACAO') as ex,
  teste.pessoa('Síndica de fora') as fora;
update equipe_triade set ativa = false, desativada_em = now() where pessoa_id = (select ex from ids);
grant select on ids to dominio;

create function pg_temp.campos(p_sql text) returns jsonb language sql as $$ select teste.erro(p_sql) -> 'detalhe' -> 'campos' $$;
create function pg_temp.pp(p uuid) returns integer language sql as $$ select versao from propostas_comercial where id = p $$;
create function pg_temp.vv(p uuid) returns integer language sql as $$ select versao from versoes_proposta where id = p $$;
create function pg_temp.ap(p uuid) returns jsonb language sql as $$ select apresentacao from versoes_proposta where id = p $$;

select ajustar_relogio('2026-10-27 10:00:00-03'::timestamptz - now());

create temp table s as select
  (comercial_entrada_site(jsonb_build_object('nome', 'Lúcia Prado', 'condominio', 'Residencial Cerrado', 'consentimento', true,
                                             'whatsapp', '5561999990501', 'pedido', 'PROPOSTA', 'unidades', 72, 'taxaCondominio', '650')) ->> 'id')::uuid as cerrado,
  (comercial_entrada_site(jsonb_build_object('nome', 'Paulo Dias', 'condominio', 'Edifício Ipê', 'consentimento', true,
                                             'whatsapp', '5561999990502', 'pedido', 'PROPOSTA', 'unidades', 30)) ->> 'id')::uuid as ipe;

-- 1. A sugestão: a prévia da apresentação e quem pode implantar (quadro 456).
create temp table sug as select comercial_sugestao_proposta((select com from ids), (select cerrado from s)) as g;
select is((select jsonb_array_length(g -> 'apresentacao' -> 'tabela' -> 'faixas') from sug), 5, 'a prévia leva a Tabela de preços inteira, com as cinco faixas');
select is((select g -> 'apresentacao' -> 'tabela' -> 'faixas' -> 1 from sug),
  '{"codigo": "DE_41_A_100", "nome": "41 a 100 unidades", "de": 41, "ate": 100, "sobConsulta": false, "fundador": 22900, "cheia": 34900, "implantacao": 90000}'::jsonb,
  'cada faixa com o fundador, a cheia e a implantação');
select is((select g -> 'apresentacao' -> 'tabela' -> 'faixas' -> 4 from sug),
  '{"codigo": "ACIMA_DE_400", "nome": "Acima de 400 unidades", "de": 401, "sobConsulta": true}'::jsonb, 'acima de 400: sob consulta, sem valor');
select is((select array[g -> 'apresentacao' -> 'tabela' ->> 'em', g -> 'apresentacao' -> 'tabela' ->> 'mesesPagos', g -> 'apresentacao' -> 'tabela' ->> 'parcelas',
                        g -> 'apresentacao' -> 'tabela' ->> 'vagasFundador'] from sug),
  array['2026-10-27', '11', '3', '5'], 'com o dia da tabela, o 12 por 11, as parcelas e as vagas de fundador');
select is((select g -> 'apresentacao' -> 'equipe' from sug), '{"comercial": {"nome": "Bianca Rocha"}}'::jsonb,
  'quem fez é quem está no Console; sem escolher, ninguém para implantar');
select is((select array(select x ->> 'nome' from jsonb_array_elements(g -> 'implantadores') x) from sug),
  array['Bianca Rocha', 'Carolina', 'Davi Lima'], 'pode implantar só quem está na equipe ativa');
select is((select g -> 'apresentacao' -> 'condicoes' from sug), '{"cancelamentoDias": 30, "avisoReajusteDias": 30}'::jsonb,
  'as condições do dia; sem índice na regra do reajuste, a proposta não inventa um');
select is((select g -> 'apresentacao' -> 'escopo' -> 'naoIncluido' ->> 0 from sug), 'Financeiro, boletos e cobrança condominial.', 'o que não está incluído');
select is((select g -> 'quemFez' ->> 'nome' from sug), 'Bianca Rocha', 'a tela mostra quem faz a proposta, só para ler');

-- 2. A versão guarda a apresentação e quem implanta.
create temp table p as select comercial_criar_proposta((select com from ids), (select cerrado from s),
  jsonb_build_object('implantadorId', (select imp from ids), 'emailComercial', 'Bianca@TriHub.com.br')) as a;
select is((select pg_temp.ap((a ->> 'versaoId')::uuid) -> 'equipe' from p),
  '{"comercial": {"nome": "Bianca Rocha", "email": "bianca@trihub.com.br"}, "implantacao": {"nome": "Davi Lima"}}'::jsonb,
  'a versão guarda quem fez (com o e-mail da TRÍADE) e quem vai implantar');
select is((select implantador_id from versoes_proposta where id = (select (a ->> 'versaoId')::uuid from p)), (select imp from ids), 'e o implantador');
select is((select comercial_proposta(com, (a ->> 'id')::uuid) -> 'versoes' -> 0 -> 'implantador' ->> 'nome' from ids, p), 'Davi Lima',
  'a ficha da proposta devolve quem implanta, para editar o rascunho');
select is((select pg_temp.campos(format('select comercial_nova_versao(%L, %L, %s, %L)', com, (a ->> 'id')::uuid, pg_temp.pp((a ->> 'id')::uuid),
                                        jsonb_build_object('implantadorId', ex))) from ids, p), '["implantadorId"]'::jsonb,
  'quem saiu da equipe não implanta');
select is((select pg_temp.campos(format('select comercial_nova_versao(%L, %L, %s, %L)', com, (a ->> 'id')::uuid, pg_temp.pp((a ->> 'id')::uuid),
                                        jsonb_build_object('implantadorId', fora))) from ids, p), '["implantadorId"]'::jsonb,
  'nem quem não é da equipe');
select is((select pg_temp.campos(format('select comercial_nova_versao(%L, %L, %s, ''{"implantadorId": "Davi"}'')', com, (a ->> 'id')::uuid,
                                        pg_temp.pp((a ->> 'id')::uuid))) from ids, p), '["implantadorId"]'::jsonb, 'nem um texto qualquer');

-- O e-mail pessoal não vai para o síndico; tirar o implantador no rascunho volta para a equipe.
select comercial_salvar_versao((select com from ids), (a ->> 'id')::uuid, (a ->> 'versaoId')::uuid, pg_temp.vv((a ->> 'versaoId')::uuid),
                               '{"emailComercial": "bianca.rocha@gmail.com"}') from p;
select is((select pg_temp.ap((a ->> 'versaoId')::uuid) -> 'equipe' from p), '{"comercial": {"nome": "Bianca Rocha"}}'::jsonb,
  'e-mail de fora da TRÍADE não fica; sem implantador, a proposta fala da equipe');
select is((select implantador_id from versoes_proposta where id = (select (a ->> 'versaoId')::uuid from p)), null::uuid, 'e o implantador sai do rascunho');

-- 3. A impressão digital cobre a apresentação; a enviada não muda.
select comercial_salvar_versao((select com from ids), (a ->> 'id')::uuid, (a ->> 'versaoId')::uuid, pg_temp.vv((a ->> 'versaoId')::uuid),
                               jsonb_build_object('implantadorId', (select imp from ids), 'emailComercial', 'bianca@trihub.com.br')) from p;
create temp table env as select comercial_enviar_proposta((select com from ids), (a ->> 'id')::uuid, (a ->> 'versaoId')::uuid, pg_temp.vv((a ->> 'versaoId')::uuid)) as e,
                                (a ->> 'versaoId')::uuid as versao from p;
select is((select hash from versoes_proposta where id = (select versao from env)),
  (select comercial_hash(proposta_conteudo(v)) from versoes_proposta v where v.id = (select versao from env)), 'o hash é do conteúdo com a apresentação');
select ok((select proposta_conteudo(v) -> 'apresentacao' -> 'equipe' -> 'implantacao' ->> 'nome' = 'Davi Lima' from versoes_proposta v where v.id = (select versao from env)),
  'quem implanta está no conteúdo que a impressão digital cobre');
select is((select publico_proposta(e -> 'link' ->> 'codigo', null) -> 'apresentacao' -> 'escopo' -> 'incluido' -> 0 from env),
  '{"titulo": "Solicitações organizadas", "texto": "Responsável, prazo, próximo retorno e conclusão explicada."}'::jsonb, 'o link mostra o escopo guardado');
select ok((select not (publico_proposta(e -> 'link' ->> 'codigo', null) ? 'implantador') from env), 'o link não mostra o id de quem implanta');
update faixas_preco set fundador_centavos = 24900 where codigo = 'DE_41_A_100';
select is((select pg_temp.ap(versao) -> 'tabela' -> 'faixas' -> 1 ->> 'fundador' from env), '22900', 'mudar a Tabela de preços depois não muda a enviada (H.1)');
select is((select teste.erro(format('update versoes_proposta set implantador_id = null where id = %L', versao)) -> 'detalhe' ->> 'motivo' from env), 'VERSAO_ENVIADA',
  'e a enviada não troca quem implanta');

-- 4. A versão de antes da 0312 continua com o mesmo conteúdo e o mesmo hash.
create temp table ipe as select (comercial_criar_proposta((select com from ids), (select ipe from s), '{}') ->> 'versaoId')::uuid as v;
select ok((select proposta_conteudo(x) ? 'apresentacao' from versoes_proposta x where x.id = (select v from ipe)), 'a versão nova sempre leva a apresentação');
update versoes_proposta set apresentacao = null, implantador_id = null where id = (select v from ipe);
select ok((select not (proposta_conteudo(x) ? 'apresentacao') from versoes_proposta x where x.id = (select v from ipe)),
  'sem a apresentação (as versões de antes da 0312), o conteúdo é o de antes, com o mesmo hash');

select * from finish();
rollback;

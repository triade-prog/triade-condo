-- 0312 · A proposta como apresentação (R17.8; IDEIAS CM-34; quadros 450 a 457, versão 2,
-- aprovados pela Carolina em 26/10/2026, a partir do PDF de redesign dela). O link e o PDF passam
-- a ter quatro partes: capa (o problema, o exemplo de um pedido e o preço), investimento (com a
-- Tabela de preços inteira), escopo e equipe, condições e aceite. Para o PDF e o link mostrarem
-- sempre a mesma coisa, a versão guarda o que a apresentação usa, e a impressão digital cobre:
--
-- 1. A Tabela de preços do dia (faixas, 12 por 11, parcelas e vagas de fundador), copiada quando a versão é montada;
--    mudar a tabela depois não muda proposta enviada (H.1).
-- 2. Quem cuida: quem fez a proposta (nome e o e-mail da conta, só quando é do domínio da
--    TRÍADE) e, se escolhido, quem vai implantar (alguém da equipe ativa). Sem escolher, a
--    proposta fala da equipe de implantação, sem nome (quadro 457).
-- 3. O escopo: o que está incluído (título e explicação) e o que não está, textos fixos como o
--    incluído da 0304 (EM-07). Nada é cobrado à parte: os itens à parte só entram depois das
--    decisões de preço S1 a S5, e sempre com preço.
-- 4. As condições do dia: o aviso do cancelamento (0311, N.1), o prazo do aviso do reajuste e o
--    índice da regra do reajuste (0311); sem índice, a proposta diz "o índice do contrato".
--
-- As versões já enviadas não mudam: a coluna nova fica vazia nelas, e o conteúdo (jsonb_strip_nulls)
-- continua o mesmo, com a mesma impressão digital. A sugestão da Nova proposta leva a mesma
-- apresentação e a lista de quem pode implantar, para a prévia "Ver como o síndico vai ver".
-- Nada aqui apaga linha nem remove função.

alter table versoes_proposta
  add column apresentacao   jsonb check (apresentacao is null or jsonb_typeof(apresentacao) = 'object'),
  add column implantador_id uuid references pessoas (id);

comment on column versoes_proposta.apresentacao is
  'O que a apresentação da proposta usa (R17.8, CM-34): a Tabela de preços do dia, quem cuida, o escopo e as condições; entra na impressão digital';
comment on column versoes_proposta.implantador_id is 'Quem vai implantar (equipe ativa da TRÍADE), opcional (R17.8, quadro 456)';

-- ---------------------------------------------------------------------------------------
-- 3. O escopo (quadros 450 e 454): texto pronto, igual em toda proposta. Mudar é uma migration
-- nova; a versão guarda a cópia do dia em que nasceu.

create function comercial_escopo_incluido() returns jsonb
language sql immutable
set search_path = public
as $$ select '[{"titulo": "Solicitações organizadas", "texto": "Responsável, prazo, próximo retorno e conclusão explicada."}, {"titulo": "Comunicação com moradores", "texto": "Comunicados, documentos e mural do prédio por link."}, {"titulo": "Agenda e manutenção", "texto": "Ações preventivas, acompanhamento e prestadores."}, {"titulo": "Implantação acompanhada", "texto": "Configuração e reunião presencial em Brasília."}]'::jsonb $$;

create function comercial_escopo_nao_incluido() returns jsonb
language sql immutable
set search_path = public
as $$ select '["Financeiro, boletos e cobrança condominial.", "Portaria, controle de acesso e câmeras.", "Serviços jurídicos ou contábeis."]'::jsonb $$;

-- ---------------------------------------------------------------------------------------
-- 2. Quem cuida. O e-mail vem do cadastro de quem salva a versão (a api-console lê na conta e manda
-- em emailComercial) e só fica quando é do domínio da TRÍADE: e-mail pessoal de quem é da equipe
-- nunca vai para o síndico.

create function comercial_email_da_equipe(p_email text) returns text
language sql immutable
set search_path = public
as $$ select lower(btrim(p_email)) where lower(btrim(p_email)) ~ '^[a-z0-9._%+-]+@trihub\.com\.br$' $$;

-- Quem pode implantar: a equipe ativa, por nome (quadro 456).
create function comercial_implantadores() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome, p.id), '[]'::jsonb)
    from equipe_triade e join pessoas p on p.id = e.pessoa_id
   where e.ativa
$$;

-- A apresentação do dia: a tabela, quem cuida, o escopo e as condições.
create function comercial_apresentacao(p_comercial uuid, p_implantador uuid, p_email text) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r regra_reajuste;
  pp parametros_preco;
begin
  if p_implantador is not null and not exists (select 1 from equipe_triade where pessoa_id = p_implantador and ativa) then
    perform recusar_campos('Escolha para implantar alguém da equipe da TRÍADE', 'implantadorId');
  end if;
  select * into r from regra_reajuste;
  select * into pp from parametros_preco;
  return jsonb_strip_nulls(jsonb_build_object(
    'tabela', jsonb_build_object(
      'em', comercial_hoje(), 'mesesPagos', pp.meses_pagos_anual, 'parcelas', pp.parcelas_implantacao, 'vagasFundador', pp.vagas_fundador,
      'faixas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', f.codigo, 'nome', f.nome, 'de', f.unidades_de, 'ate', f.unidades_ate,
                                                              'sobConsulta', f.sob_consulta, 'fundador', f.fundador_centavos, 'cheia', f.cheia_centavos,
                                                              'implantacao', f.implantacao_centavos) order by f.ordem), '[]'::jsonb)
                   from faixas_preco f)),
    'equipe', jsonb_build_object(
      'comercial', case when p_comercial is not null then jsonb_build_object('nome', comercial_nome(p_comercial), 'email', comercial_email_da_equipe(p_email)) end,
      'implantacao', case when p_implantador is not null then jsonb_build_object('nome', comercial_nome(p_implantador)) end),
    'escopo', jsonb_build_object('incluido', comercial_escopo_incluido(), 'naoIncluido', comercial_escopo_nao_incluido()),
    'condicoes', jsonb_build_object('cancelamentoDias', configuracao_int('comercial_cancelamento_aviso_dias'),
                                    'avisoReajusteDias', r.prazo_aviso_dias, 'indice', r.indice)));
end $$;

-- ---------------------------------------------------------------------------------------
-- A versão montada (0310) com a apresentação e quem vai implantar. O resto do corpo é o da 0310.

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
  v_implantador uuid;
begin
  if v_unidades is null then perform recusar_campos('Informe as unidades do prédio', 'unidades'); end if;
  if v_tabela is not null and v_tabela not in ('FUNDADOR', 'CHEIA', 'MANUAL') then perform recusar_campos('Escolha a tabela', 'tabela'); end if;
  if v_dias not between 1 and 60 then perform recusar_campos('A validade vai de 1 a 60 dias', 'validadeDias'); end if;
  if coalesce(p_dados ->> 'implantadorId', '') !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$' then
    perform recusar_campos('Escolha para implantar alguém da equipe da TRÍADE', 'implantadorId');
  end if;
  v_implantador := nullif(p_dados ->> 'implantadorId', '')::uuid;
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
  v.implantador_id := v_implantador;
  v.apresentacao := comercial_apresentacao(contexto_pessoa(), v_implantador, comercial_texto(p_dados, 'emailComercial'));
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

-- A versão nova (0304) leva as colunas novas.
create or replace function comercial_inserir_versao(p_proposta uuid, p_numero integer, n versoes_proposta, p_pessoa uuid) returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid;
begin
  insert into versoes_proposta (proposta_id, numero, situacao, condominio, cidade, uf, faixa, unidades, ciclo, tabela, mensal_tabela_centavos, mensal_centavos,
                                anual_centavos, meses_pagos_anual, depois_centavos, implantacao_centavos, implantacao_parcelas, implantacao_sem_custo,
                                valor_manual_motivo, desconto_percentual, desconto_motivo, desconto_situacao, por_apartamento_centavos, premissas, incluido,
                                planejado, respostas, referencias, validade_dias, nota_interna, apresentacao, implantador_id, criado_por)
  values (p_proposta, p_numero, 'RASCUNHO', n.condominio, n.cidade, n.uf, n.faixa, n.unidades, n.ciclo, n.tabela, n.mensal_tabela_centavos, n.mensal_centavos,
          n.anual_centavos, n.meses_pagos_anual, n.depois_centavos, n.implantacao_centavos, n.implantacao_parcelas, n.implantacao_sem_custo,
          n.valor_manual_motivo, n.desconto_percentual, n.desconto_motivo, 'SEM', n.por_apartamento_centavos, n.premissas, n.incluido,
          n.planejado, n.respostas, n.referencias, n.validade_dias, n.nota_interna, n.apresentacao, n.implantador_id, p_pessoa)
  returning id into v_id;
  return v_id;
end $$;

-- Salvar o rascunho (0306) grava também a apresentação e quem vai implantar. Trocar quem implanta
-- não muda o preço: a aprovação continua pelas mesmas regras da 0306.
create or replace function comercial_salvar_versao(p_pessoa uuid, p_proposta uuid, p_id uuid, p_versao integer, p_dados jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p propostas_comercial;
  v versoes_proposta;
  n versoes_proposta;
  v_mantem boolean;
  v_versao integer;
begin
  perform entrar_console(p_pessoa, 'console.comercial.editar');
  p := comercial_buscar_proposta(p_proposta);
  v := comercial_travar_versao(p.id, p_id, p_versao);
  if v.situacao not in ('RASCUNHO', 'AGUARDA_DESCONTO', 'PRONTA') then
    perform recusar_motivo('A versão enviada não muda; faça uma versão nova', 'VERSAO_ENVIADA');
  end if;
  n := comercial_preparar_versao(comercial_buscar(p.interessado_id), p_dados);
  v_mantem := v.desconto_situacao = 'APROVADO' and comercial_pede_aprovacao(n)
              and (n.desconto_percentual, n.mensal_tabela_centavos, n.ciclo, n.tabela, n.implantacao_centavos) is not distinct from
                  (v.desconto_percentual, v.mensal_tabela_centavos, v.ciclo, v.tabela, v.implantacao_centavos);
  update versoes_proposta set
    (condominio, cidade, uf, faixa, unidades, ciclo, tabela, mensal_tabela_centavos, mensal_centavos, anual_centavos, meses_pagos_anual, depois_centavos,
     implantacao_centavos, implantacao_parcelas, implantacao_sem_custo, valor_manual_motivo, desconto_percentual, desconto_motivo, por_apartamento_centavos,
     premissas, incluido, planejado, respostas, referencias, validade_dias, nota_interna, apresentacao, implantador_id)
    = (n.condominio, n.cidade, n.uf, n.faixa, n.unidades, n.ciclo, n.tabela, n.mensal_tabela_centavos, n.mensal_centavos, n.anual_centavos, n.meses_pagos_anual,
       n.depois_centavos, n.implantacao_centavos, n.implantacao_parcelas, n.implantacao_sem_custo, n.valor_manual_motivo, n.desconto_percentual, n.desconto_motivo,
       n.por_apartamento_centavos, n.premissas, n.incluido, n.planejado, n.respostas, n.referencias, n.validade_dias, n.nota_interna, n.apresentacao,
       n.implantador_id),
    situacao = case when v_mantem then 'PRONTA' else 'RASCUNHO' end,
    desconto_situacao = case when v_mantem then 'APROVADO' else 'SEM' end,
    desconto_pedido_em = case when v_mantem then desconto_pedido_em end,
    desconto_pedido_por = case when v_mantem then desconto_pedido_por end,
    desconto_resposta = case when v_mantem then desconto_resposta end,
    desconto_respondido_em = case when v_mantem then desconto_respondido_em end,
    desconto_respondido_por = case when v_mantem then desconto_respondido_por end,
    alterado_em = app_now(), alterado_por = p_pessoa
   where id = p_id and versao = p_versao
  returning versao into v_versao;
  if v_versao is null then perform conflito_versao('versoes_proposta', p_id); end if;
  return jsonb_build_object('id', p_id, 'versao', v_versao, 'situacao', case when v_mantem then 'PRONTA' else 'RASCUNHO' end);
end $$;

-- O conteúdo da versão (0304), que a impressão digital cobre, com a apresentação. Nas versões de
-- antes da 0312 a apresentação é nula e sai pelo jsonb_strip_nulls: o conteúdo e o hash não mudam.
create or replace function proposta_conteudo(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'versao', v.numero, 'condominio', v.condominio, 'cidade', v.cidade, 'uf', v.uf,
    'faixa', v.faixa, 'unidades', v.unidades, 'ciclo', v.ciclo, 'tabela', v.tabela, 'moeda', 'BRL',
    'mensalTabela', v.mensal_tabela_centavos, 'mensal', v.mensal_centavos, 'anual', v.anual_centavos, 'mesesPagos', v.meses_pagos_anual,
    'depoisFundador', v.depois_centavos, 'fundadorMeses', case when v.tabela = 'FUNDADOR' then 12 end,
    'implantacao', v.implantacao_centavos, 'implantacaoParcelas', v.implantacao_parcelas, 'implantacaoSemCusto', v.implantacao_sem_custo,
    'desconto', case when v.desconto_situacao = 'APROVADO' then trim_scale(v.desconto_percentual) end,
    'porApartamento', v.por_apartamento_centavos, 'premissas', v.premissas,
    'incluido', v.incluido, 'planejado', v.planejado,
    'respostas', (select coalesce(jsonb_agg(jsonb_build_object('tema', r ->> 'tema', 'titulo', r ->> 'titulo', 'texto', r ->> 'texto') order by o), '[]'::jsonb)
                    from jsonb_array_elements(v.respostas) with ordinality x(r, o)),
    'validadeDias', v.validade_dias, 'validoAte', v.valido_ate,
    'apresentacao', v.apresentacao))
$$;

-- A versão para a equipe (0306) leva quem vai implantar, para editar o rascunho.
create or replace function versao_proposta_json(v versoes_proposta) returns jsonb
language sql stable
set search_path = public
as $$
  select proposta_conteudo(v) || jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'versaoRegistro', v.versao, 'numero', v.numero, 'situacao', proposta_situacao(v), 'hash', v.hash,
    'respostas', v.respostas,
    'referencias', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sindico', r.sindico, 'condominio', r.condominio,
                                                                 'retirada', r.retirada_em is not null) order by array_position(v.referencias, r.id)), '[]'::jsonb)
                      from referencias_comercial r where r.id = any (v.referencias)),
    'pedeAprovacao', comercial_pede_aprovacao(v),
    'descontoPedido', case when comercial_pede_aprovacao(v) then jsonb_strip_nulls(jsonb_build_object(
        'percentual', trim_scale(v.desconto_percentual), 'motivo', v.desconto_motivo, 'situacao', v.desconto_situacao,
        'sobConsulta', v.tabela = 'MANUAL',
        'valorManual', case when v.tabela = 'MANUAL' then v.mensal_tabela_centavos end,
        'implantacaoManual', case when v.tabela = 'MANUAL' then v.implantacao_centavos end,
        'valorManualMotivo', v.valor_manual_motivo,
        'pedidoEm', v.desconto_pedido_em, 'pedidoPor', comercial_pessoa_json(v.desconto_pedido_por),
        'resposta', v.desconto_resposta, 'respondidoEm', v.desconto_respondido_em, 'respondidoPor', comercial_pessoa_json(v.desconto_respondido_por))) end,
    'descontoSituacao', v.desconto_situacao,
    'valorManualMotivo', v.valor_manual_motivo, 'notaInterna', v.nota_interna,
    'implantador', comercial_pessoa_json(v.implantador_id),
    'enviadaEm', v.enviada_em, 'enviadaPor', comercial_pessoa_json(v.enviada_por),
    'recusa', case when v.recusada_em is not null then jsonb_build_object('em', v.recusada_em, 'motivo', v.recusada_motivo,
                                                                          'por', comercial_pessoa_json(v.recusada_por)) end,
    'substituidaEm', v.substituida_em, 'criadoEm', v.criado_em, 'criadoPor', comercial_pessoa_json(v.criado_por), 'alteradoEm', v.alterado_em,
    'link', (select jsonb_strip_nulls(jsonb_build_object('ativo', l.revogado_em is null and l.expira_em >= app_now(), 'criadoEm', l.criado_em,
                                                         'expiraEm', l.expira_em, 'revogadoEm', l.revogado_em, 'revogadoMotivo', l.revogado_motivo))
               from links_proposta l where l.versao_id = v.id order by l.criado_em desc, l.id desc limit 1),
    'aberturas', proposta_aberturas(v.id),
    'aceite', (select jsonb_strip_nulls(jsonb_build_object('nome', a.nome, 'cargo', a.cargo, 'em', a.aceito_em, 'ip', a.ip, 'hashVersao', a.hash_versao,
                                                           'cpfMascarado', case when a.cpf is not null then '•••.' || substr(a.cpf, 4, 3) || '.' || substr(a.cpf, 7, 3) || '-••' end,
                                                           'anonimizado', a.anonimizado_em is not null))
                 from aceites_proposta a where a.versao_id = v.id)))
$$;

-- A sugestão da Nova proposta (0310) com a apresentação do dia e quem pode implantar (quadro 456).
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
                                                          'pessoa', i.nome_contato, 'etapa', i.etapa, 'taxaCondominioMedia', i.taxa_condominio_media,
                                                          'cidade', i.cidade, 'uf', i.uf)),
      'propostaId', (select id from propostas_comercial where interessado_id = i.id),
      'oferta', jsonb_build_object('incluido', comercial_oferta_incluido(), 'planejado', comercial_oferta_planejado()),
      'respostas', comercial_respostas_revisadas(),
      'referencias', comercial_referencias_autorizadas(),
      'apresentacao', comercial_apresentacao(p_pessoa, null, null),
      'quemFez', comercial_pessoa_json(p_pessoa),
      'implantadores', comercial_implantadores());
end $$;

call fechar_acesso();

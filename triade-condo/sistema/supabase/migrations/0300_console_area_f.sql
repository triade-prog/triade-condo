-- Console, área F do novo frontend (D4.28; PI-04, PI-05, PI-12). Desenho aprovado pela Carolina.
-- 1. Implantações (a lista do menu): cada cliente traz a pendência vencida mais antiga, para a
--    tela dizer o que está parado e com quem, e quantas partes da configuração já foram
--    conferidas quando a próxima etapa é a configuração. A versão da 0190 passa a ser console_implantacoes_d428.
-- 2. Histórico da equipe: o nome atual de quem o evento fala (entrou, saiu, teve as funções
--    revistas). O nome é lido na hora, nunca gravado no histórico. A versão da 0060 passa a ser
--    console_historico_equipe_d428.

-- ---------------------------------------------------------------------------------------
-- 1. Implantações com a pendência vencida mais antiga e a configuração conferida.

alter function console_implantacoes(uuid) rename to console_implantacoes_d428;
alter function console_implantacoes_d428(uuid) security invoker;
create function console_implantacoes(p_pessoa uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_cliente uuid;
  v_hoje date;
  im implantacoes;
  v_vencida jsonb;
  v_configuracao jsonb;
  v_saida jsonb := '[]'::jsonb;
begin
  -- A antiga confere quem pode e dá a ordem; aqui só se acrescenta a cada item, na mesma ordem.
  for r in select x, n from jsonb_array_elements(console_implantacoes_d428(p_pessoa)) with ordinality y(x, n) order by n
  loop
    v_cliente := (r.x ->> 'condominioId')::uuid;
    -- Cada item lê com o contexto do próprio cliente (a configuração vem de contexto_condominio()).
    perform entrar_condominio(p_pessoa, v_cliente, 'console.implantacao.ver');
    v_hoje := hoje_no_condominio();
    select * into im from implantacoes where condominio_id = v_cliente;
    -- Vencida é a mesma regra da contagem: aberta e com o retorno antes de hoje no condomínio.
    v_vencida := (select jsonb_build_object('id', p.id, 'texto', p.texto, 'comQuem', p.com_quem,
                                            'responsavel', nome_pessoa(p.responsavel_id), 'etapa', p.etapa,
                                            'proximoRetorno', p.proximo_retorno)
                    from pendencias_implantacao p
                   where p.implantacao_id = im.id and p.resolvida_em is null and p.proximo_retorno < v_hoje
                   order by p.proximo_retorno, p.criado_em, p.id
                   limit 1);
    -- As partes conferidas só quando a próxima etapa é a da configuração (pela chave, não pelo número).
    v_configuracao := case when exists (select 1 from etapas_implantacao e
                                         where e.implantacao_id = im.id and e.chave = 'CONFIGURACAO'
                                           and e.numero = (r.x -> 'proxima' ->> 'numero')::integer) then
                        (select jsonb_build_object('conferidas', count(*) filter (where s.conferida), 'total', count(*))
                           from situacao_partes_configuracao() s) end;
    v_saida := v_saida || jsonb_build_array(r.x || jsonb_build_object('vencida', v_vencida, 'configuracao', v_configuracao));
  end loop;
  -- Nenhum condomínio fica no contexto depois da lista.
  perform definir_pessoa(p_pessoa);
  return v_saida;
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. Histórico da equipe com o nome atual da pessoa de quem o evento fala.

alter function console_historico_equipe(uuid, bigint, integer) rename to console_historico_equipe_d428;
alter function console_historico_equipe_d428(uuid, bigint, integer) security invoker;
create function console_historico_equipe(p_pessoa uuid, p_antes bigint default null, p_limite integer default 50)
returns table (id bigint, ocorrido_em timestamptz, autor_id uuid, autor_nome text, acao text,
               entidade text, entidade_id text, dados jsonb, alvo_nome text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
    select h.id, h.ocorrido_em, h.autor_id, h.autor_nome, h.acao, h.entidade, h.entidade_id, h.dados,
           case when h.entidade = 'pessoa' then p.nome end
      from console_historico_equipe_d428(p_pessoa, p_antes, p_limite) h
      left join pessoas p on h.entidade = 'pessoa' and p.id::text = h.entidade_id
     order by h.id desc;
end $$;

call fechar_acesso();

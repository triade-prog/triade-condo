-- Moradores e unidades com banco (fase D, área B; MU-02, MU-06, MU-10).
-- 1. Pessoas: as abas Proprietários, Inquilinos e Moram (decisão B.1). Cada linha continua sendo
--    uma pessoa numa unidade; Proprietários e Inquilinos vêm da ligação, Moram de quem mora, seja
--    qual for a ligação. A lista devolve o número de cada aba, já com a busca e o atalho.
-- 2. Garagens › Veículos: os veículos sem vaga entram na lista (decisão B.2), que antes só trazia
--    os que estavam numa vaga.

-- ---------------------------------------------------------------------------------------
-- 1. A lista de pessoas com a ligação. A versão da 0288 (com a unidade) passa a ser
--    moradores_r7 e deixa de ser chamada; a nova faz a lista inteira, com ou sem unidade.

alter function plataforma_moradores(uuid, uuid, text, text, integer, uuid) rename to moradores_r7;
alter function moradores_r7(uuid, uuid, text, text, integer, uuid) security invoker;

create function plataforma_moradores(p_pessoa uuid, p_condominio uuid, p_busca text, p_estado text, p_pagina integer,
                                     p_unidade uuid default null, p_ligacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_digitos text;
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  if p_estado is not null and p_estado not in ('PENDENTE', 'CONFIRMADO', 'SEM_EMAIL', 'SEM_WHATSAPP') then
    perform recusar_campos('Situação desconhecida', 'estado');
  end if;
  if p_ligacao is not null and p_ligacao not in ('PROPRIETARIOS', 'INQUILINOS', 'MORAM') then
    perform recusar_campos('Ligação desconhecida', 'ligacao');
  end if;
  if p_unidade is not null then perform exigir_unidade(p_unidade); end if;
  if length(v_busca) > 60 then perform recusar_campos('Busca até 60 caracteres', 'busca'); end if;
  v_digitos := nullif(regexp_replace(coalesce(v_busca, ''), '\D', '', 'g'), '');
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  with base as (
    select cu.id, cu.contato_id, ct.nome, ct.telefone, ct.email_situacao, recebe_comunicado_whatsapp(ct) as whatsapp,
           cu.unidade_id, u.identificacao, u.andar, b.nome as bloco, b.ordem as bloco_ordem,
           cu.relacao, cu.principal, cu.estado, cu.origem, cu.versao, cu.proprietario, cu.ligacao, cu.mora
      from contatos_unidade cu
      join contatos ct on ct.id = cu.contato_id
      join unidades u on u.id = cu.unidade_id
      left join blocos b on b.id = u.bloco_id
     where cu.estado <> 'ENCERRADO'
       and (p_unidade is null or cu.unidade_id = p_unidade)
       and (p_estado is null
            or (p_estado = 'SEM_EMAIL' and ct.email_situacao is distinct from 'CONFIRMADO')
            or (p_estado = 'SEM_WHATSAPP' and not recebe_comunicado_whatsapp(ct))
            or cu.estado = p_estado)
       and (v_busca is null
            or ct.nome ilike '%' || v_busca || '%'
            or (p_unidade is null and (u.identificacao ilike v_busca || '%' or b.nome ilike '%' || v_busca || '%' or u.andar ilike v_busca))
            or ct.email ilike '%' || v_busca || '%'
            or (length(v_digitos) >= 4 and ct.telefone like '%' || v_digitos || '%'))
  ),
  lista as (
    select * from base
     where p_ligacao is null
        or (p_ligacao = 'PROPRIETARIOS' and proprietario)
        or (p_ligacao = 'INQUILINOS' and ligacao = 'INQUILINO')
        or (p_ligacao = 'MORAM' and mora)
  )
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'vinculoId', l.id, 'contatoId', l.contato_id, 'nome', l.nome, 'telefone', l.telefone, 'unidadeId', l.unidade_id,
               'unidade', l.identificacao, 'andar', l.andar, 'bloco', l.bloco, 'relacao', l.relacao, 'principal', l.principal,
               'mora', l.mora, 'estado', l.estado, 'origem', l.origem, 'versao', l.versao, 'emailSituacao', l.email_situacao,
               'comunicadosWhatsapp', l.whatsapp)) order by l.ordem)
             from (select *, row_number() over (order by bloco_ordem nulls first, lower(bloco) nulls first, chave_andar(andar),
                                                         chave_unidade(identificacao), principal desc, lower(nome)) as ordem from lista) l
            where l.ordem > (v_pagina - 1) * 50 and l.ordem <= v_pagina * 50), '[]'::jsonb),
    'total', (select count(*) from lista),
    'pagina', v_pagina,
    'porPagina', 50,
    'ligacao', p_ligacao,
    'ligacoes', (select jsonb_build_object('todas', count(*), 'proprietarios', count(*) filter (where proprietario),
                                           'inquilinos', count(*) filter (where ligacao = 'INQUILINO'), 'moram', count(*) filter (where mora))
                   from base),
    'unidade', case when p_unidade is not null then jsonb_build_object('id', p_unidade, 'nome', rotulo_unidade(p_unidade)) end,
    'aConfirmar', case when p_unidade is null
                    then (select count(*) from contatos_unidade cu join unidades u on u.id = cu.unidade_id and u.ativa where cu.estado = 'PENDENTE')
                       + (select count(*) from cadastros_link c join unidades u on u.id = c.unidade_id and u.ativa where c.estado = 'ENVIADO')
                    else (select count(*) from contatos_unidade cu where cu.unidade_id = p_unidade and cu.estado = 'PENDENTE')
                       + (select count(*) from cadastros_link c where c.unidade_id = p_unidade and c.estado = 'ENVIADO') end,
    'semEmail', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                  where cu.estado <> 'ENCERRADO' and (p_unidade is null or cu.unidade_id = p_unidade)
                    and ct.email_situacao is distinct from 'CONFIRMADO'),
    'semWhatsapp', (select count(distinct cu.contato_id) from contatos_unidade cu join contatos ct on ct.id = cu.contato_id
                     where cu.estado <> 'ENCERRADO' and (p_unidade is null or cu.unidade_id = p_unidade)
                       and not recebe_comunicado_whatsapp(ct)),
    'comunicadosWhatsappLigado', comunicados_whatsapp_ativos(),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'),
    'podeConfirmar', pode(p_pessoa, p_condominio, 'moradores.confirmar'))
    into v;
  return jsonb_strip_nulls(v);
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. Garagens com os veículos sem vaga, em ordem de placa (veículo em uso sempre tem placa).

create or replace function plataforma_garagens(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'moradores.ver');
  return jsonb_build_object(
    'vagas', coalesce((select jsonb_agg(vaga_json(v) order by v.ativa desc, chave_unidade(v.identificacao)) from vagas v), '[]'::jsonb),
    'semVaga', coalesce((select jsonb_agg(veiculo_json(x) || jsonb_build_object('unidade', rotulo_unidade(x.unidade_id))
                                          order by x.placa)
                           from veiculos x where x.retirado_em is null and x.vaga_id is null), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'vagas', (select count(*) from vagas where ativa),
      'deUnidades', (select count(*) from vagas where ativa and unidade_id is not null),
      'doCondominio', (select count(*) from vagas where ativa and unidade_id is null),
      'veiculos', (select count(*) from veiculos where retirado_em is null),
      'semVaga', (select count(*) from veiculos where retirado_em is null and vaga_id is null)),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', rotulo_unidade(u.id))
                                           order by chave_unidade(coalesce((select nome from blocos where id = u.bloco_id), '')), chave_andar(u.andar), chave_unidade(u.identificacao))
                            from unidades u where u.ativa), '[]'::jsonb),
    'podeEditar', pode(p_pessoa, p_condominio, 'moradores.editar'));
end $$;

call fechar_acesso();

-- 0191 · A ficha do cliente no Console leva a versão do vínculo de cada síndico, que a troca de
-- síndico segue (CT-01, AT-24; peça R4). Só substitui console_ficha.

create or replace function console_ficha(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'console.ficha.ver');
  select jsonb_build_object(
    'condominio', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'endereco', c.endereco,
      'numeroWhatsapp', c.numero_whatsapp, 'contatos', c.contatos, 'cenario', c.cenario,
      'versao', c.versao, 'criadoEm', c.criado_em),
    'cliente', jsonb_build_object('estagio', cl.estado, 'referenciaContrato', cl.referencia_contrato, 'versao', cl.versao),
    'sindicos', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'desde', v.criado_em, 'versao', v.versao)
                       order by v.criado_em)
        from vinculos v join pessoas p on p.id = v.pessoa_id
       where v.condominio_id = c.id and v.funcao = 'SINDICO' and v.revogado_em is null), '[]'::jsonb),
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object('vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'funcao', v.funcao,
                                          'desde', v.criado_em, 'versao', v.versao) order by p.nome, v.funcao)
        from vinculos v join pessoas p on p.id = v.pessoa_id join funcoes f on f.codigo = v.funcao
       where v.condominio_id = c.id and f.sistema = 'CONSOLE' and v.revogado_em is null), '[]'::jsonb),
    'situacoes', to_jsonb(situacoes_cliente(c.id)),
    'exportacoes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', e.id, 'situacao', e.situacao, 'pedidaEm', e.pedida_em,
                                                            'autor', (select nome from pessoas where id = e.pedida_por), 'prontaEm', e.pronta_em))
                       order by e.pedida_em desc)
        from (select * from exportacoes x where x.condominio_id = c.id order by x.pedida_em desc limit 5) e), '[]'::jsonb),
    'permissoes', coalesce((
      select jsonb_agg(distinct fa.acao order by fa.acao)
        from vinculos v join funcao_acoes fa on fa.funcao = v.funcao
       where v.pessoa_id = p_pessoa and v.condominio_id = c.id and v.revogado_em is null
         and v.funcao = any (contexto_equipe_funcoes())), '[]'::jsonb))
    into v
    from condominios c join clientes cl on cl.condominio_id = c.id
   where c.id = p_condominio;
  return v;
end $$;

call fechar_acesso();

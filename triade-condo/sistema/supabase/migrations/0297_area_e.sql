-- Área E da rodada com banco (itens 13, 14 e 15 do novo frontend). Decisões aprovadas pela
-- Carolina em 24/10/2026.
-- 1. Revogar o acesso e quem assume (CF-04, CF-05, MP-01, MP-03): a janela de revogar pergunta
--    quem assume os pedidos em aberto e quem assume as manutenções e preventivas da pessoa. A
--    lista de Pessoas traz quanto está em aberto com cada uma, para a janela só perguntar o que
--    existe. A versão da 0070 passa a ser plataforma_revogar_pessoa_e297.
-- 2. A imagem dentro da mensagem do chamado (PI-20): cada imagem fica ligada à mensagem com que
--    foi enviada; até 3 por mensagem e 10 por chamado, só na própria mensagem do lado do cliente,
--    logo depois de enviada. As imagens antigas vão para a mensagem anterior mais próxima de quem
--    enviou. A versão da 0190 do iniciar passa a ser plataforma_iniciar_arquivo_chamado_e297.
-- 3. O Pronto do link do prestador (V-11, MP-08): enquanto o link vale, a página mostra tudo o
--    que o prestador mandou, com o texto e as fotos, e quando ele respondeu. As fotos do link
--    abrem pela página.

-- ---------------------------------------------------------------------------------------
-- 1. Revogar e quem assume.

-- A lista de Pessoas (0070) com o que está em aberto com cada pessoa e se ela pode cuidar da
-- manutenção (a janela de revogar oferece só quem pode assumir). As manutenções contam junto
-- com as preventivas ativas: as duas passam juntas para quem assume.
create or replace function plataforma_pessoas(p_pessoa uuid, p_condominio uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.ver');
  select jsonb_build_object(
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vinculoId', v.id, 'pessoaId', p.id, 'nome', p.nome, 'funcao', v.funcao, 'cargo', v.cargo,
               'permissoes', to_jsonb(permissoes_do_vinculo(v.id)), 'desde', v.criado_em, 'versao', v.versao,
               'responsavel', r.id is not null, 'disponivel', coalesce(r.disponivel, false),
               'cuidaManutencao', pode(p.id, p_condominio, 'manutencao.ver'),
               'emAberto', jsonb_build_object(
                 'pedidos', (select count(*) from pedidos x
                              where x.responsavel_id = v.id and x.estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO')),
                 'manutencoes', (select count(*) from manutencoes x
                                  where x.responsavel_id = v.id and x.estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
                                + (select count(*) from preventivas x where x.responsavel_id = v.id and x.ativa)))
             order by v.funcao = 'AUTORIZADO', p.nome)
        from vinculos v join pessoas p on p.id = v.pessoa_id
        left join responsaveis_atendimento r on r.vinculo_id = v.id and r.retirado_em is null
       where v.funcao in ('SINDICO', 'AUTORIZADO') and v.revogado_em is null), '[]'::jsonb),
    'responsavelPadrao', c.responsavel_padrao,
    'versao', c.versao,
    'permissoesDisponiveis', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome, 'descricao', x.descricao) order by x.ordem)
        from permissoes x where exists (select 1 from permissao_acoes pa where pa.permissao = x.codigo)), '[]'::jsonb),
    'pendencias', to_jsonb(pendencias_configuracao(p_condominio)))
    into v
    from configuracao_condominio c;
  return v;
end $$;

-- Revogar com quem assume. p_assume: {"pedidos": uuid | null, "manutencoes": uuid}.
-- - "pedidos" ausente: como na 0070 (os pedidos vão para o responsável padrão, pelo gatilho da
--   0090). Com um id: vão para essa pessoa, que precisa estar em quem atende, ativa e disponível
--   (CF-05). Com null: ficam na fila sem responsável.
-- - "manutencoes": obrigatório quando a pessoa tem manutenção em aberto ou preventiva ativa
--   (manutenção sempre tem responsável). Quem assume precisa ter acesso e ver a manutenção.
-- Os pedidos e as manutenções passam antes de a antiga revogar; assim o gatilho da 0090 não
-- acha mais nada para repassar. Os vínculos de quem sai (for update) e de quem assume (for share)
-- ficam travados antes de validar, para ninguém revogar quem assume no meio do caminho. Depois do
-- "pessoa.revogada" da antiga, o evento "pessoa.repasse" diz quem assumiu o quê (ids e
-- quantidades; o nome é lido na hora, nunca gravado).
alter function plataforma_revogar_pessoa(uuid, uuid, uuid, integer, uuid, boolean) rename to plataforma_revogar_pessoa_e297;
alter function plataforma_revogar_pessoa_e297(uuid, uuid, uuid, integer, uuid, boolean) security invoker;
create function plataforma_revogar_pessoa(p_pessoa uuid, p_condominio uuid, p_vinculo uuid, p_versao integer,
                                          p_substituto uuid, p_deixar_pendente boolean, p_assume jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedidos uuid;
  v_manutencoes uuid := (p_assume ->> 'manutencoes')::uuid;
  v_repasse jsonb := '{}'::jsonb;
  v_n integer := 0;
  v_np integer := 0;
  r record;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'pessoas.autorizar');
  perform 1 from vinculos where id = p_vinculo for update;
  perform 1 from vinculos where id in ((p_assume ->> 'pedidos')::uuid, v_manutencoes) order by id for share;
  perform exigir_autorizado(p_vinculo);

  if p_assume ? 'pedidos' then
    v_pedidos := (p_assume ->> 'pedidos')::uuid;
    if v_pedidos is not null and (v_pedidos = p_vinculo or not responsavel_disponivel(v_pedidos)) then
      perform recusar_motivo('Quem assume os pedidos precisa estar entre os responsáveis e disponível', 'ASSUME_PEDIDOS_INVALIDO');
    end if;
    for r in select id from pedidos where responsavel_id = p_vinculo and estado in ('ABERTO', 'EM_ANDAMENTO', 'EM_REVISAO') order by id loop
      update pedidos set responsavel_id = v_pedidos, responsavel_desde = case when v_pedidos is not null then app_now() end, aceito_em = null
       where id = r.id;
      perform registrar_historico('pedido.responsavel', 'pedidos', r.id::text,
        jsonb_strip_nulls(jsonb_build_object('de', p_vinculo, 'para', v_pedidos, 'motivo', 'Acesso revogado')));
      v_n := v_n + 1;
    end loop;
    v_repasse := jsonb_build_object('pedidos', jsonb_build_object('para', v_pedidos, 'quantidade', v_n));
  end if;

  if exists (select 1 from manutencoes where responsavel_id = p_vinculo and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE'))
     or exists (select 1 from preventivas where responsavel_id = p_vinculo and ativa) then
    if v_manutencoes is null then
      perform recusar_motivo('Esta pessoa cuida de manutenções: escolha quem assume', 'MANUTENCOES_SEM_RESPONSAVEL');
    end if;
    if v_manutencoes = p_vinculo or not vinculo_com_acesso(v_manutencoes)
       or not pode(pessoa_do_vinculo(v_manutencoes), p_condominio, 'manutencao.ver') then
      perform recusar_motivo('Quem assume as manutenções precisa ter acesso e ver a manutenção', 'ASSUME_MANUTENCOES_INVALIDO');
    end if;
    v_n := 0;
    for r in select id from manutencoes where responsavel_id = p_vinculo and estado in ('PLANEJADA', 'EM_ANDAMENTO', 'PENDENTE') order by id loop
      v_n := v_n + 1;
      update manutencoes set responsavel_id = v_manutencoes where id = r.id;
      perform registrar_historico('manutencao.alterada', 'manutencoes', r.id::text, jsonb_build_object(
        'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_manutencoes, 'motivo', 'Acesso revogado'));
    end loop;
    for r in select id from preventivas where responsavel_id = p_vinculo and ativa order by id loop
      v_np := v_np + 1;
      update preventivas set responsavel_id = v_manutencoes where id = r.id;
      perform registrar_historico('preventiva.alterada', 'preventivas', r.id::text, jsonb_build_object(
        'campos', jsonb_build_array('responsavel'), 'de', p_vinculo, 'para', v_manutencoes, 'motivo', 'Acesso revogado'));
    end loop;
    v_repasse := v_repasse || jsonb_build_object('manutencoes',
      jsonb_build_object('para', v_manutencoes, 'quantidade', v_n, 'preventivas', v_np));
  end if;

  perform plataforma_revogar_pessoa_e297(p_pessoa, p_condominio, p_vinculo, p_versao, p_substituto, p_deixar_pendente);
  if v_repasse <> '{}'::jsonb then
    perform registrar_historico('pessoa.repasse', 'vinculo', p_vinculo::text, v_repasse);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. A imagem dentro da mensagem do chamado.

-- A imagem aponta para uma mensagem do mesmo chamado e do mesmo condomínio.
alter table mensagens_chamado add constraint mensagens_chamado_id_chamado unique (id, chamado_id, condominio_id);
alter table arquivos_chamado add column mensagem_id uuid;
alter table arquivos_chamado add constraint arquivos_chamado_mensagem
  foreign key (mensagem_id, chamado_id, condominio_id) references mensagens_chamado (id, chamado_id, condominio_id);

-- A mensagem da imagem também não muda depois de enviada (regras da 0190). A única mudança aceita
-- é ligar uma imagem antiga, ainda sem mensagem, à mensagem dela (abaixo).
create or replace function arquivos_chamado_regras() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.condominio_id, new.chamado_id, new.nome, new.tipo, new.tamanho_declarado, new.caminho, new.enviado_em, new.enviado_por)
     is distinct from
     (old.id, old.condominio_id, old.chamado_id, old.nome, old.tipo, old.tamanho_declarado, old.caminho, old.enviado_em, old.enviado_por)
     or (old.mensagem_id is not null and new.mensagem_id is distinct from old.mensagem_id) then
    raise exception 'A imagem não muda depois de enviada' using errcode = 'TC422';
  end if;
  if old.mensagem_id is null and new.mensagem_id is not null
     and (new.situacao, new.tamanho, new.motivo_recusa, new.verificado_em)
         is not distinct from (old.situacao, old.tamanho, old.motivo_recusa, old.verificado_em) then
    return new;
  end if;
  if old.situacao <> 'ENVIANDO' then raise exception 'A imagem já foi verificada' using errcode = 'TC422'; end if;
  return new;
end $$;

-- As imagens que já existem vão para a última mensagem do cliente de quem enviou, até a hora do
-- envio; sem ela, para a primeira mensagem do chamado. É uma aproximação: num chamado com várias
-- respostas, a imagem cai na mensagem anterior mais próxima de quem enviou. Com row_security
-- desligado, um papel sem BYPASSRLS recebe um erro claro, em vez de atualizar zero linhas e
-- só falhar depois, no "set not null".
create function ligar_imagens_antigas_chamado() returns integer
language plpgsql
set search_path = public
set row_security = off
as $$
declare v_n integer;
begin
  update arquivos_chamado a
     set mensagem_id = coalesce(
           (select m.id from mensagens_chamado m
             where m.chamado_id = a.chamado_id and m.autor_id = a.enviado_por and m.lado = 'CLIENTE' and not m.interna
               and m.criado_em <= a.enviado_em
             order by m.criado_em desc, m.id desc limit 1),
           (select m.id from mensagens_chamado m where m.chamado_id = a.chamado_id order by m.criado_em, m.id limit 1))
   where a.mensagem_id is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
select ligar_imagens_antigas_chamado();
alter table arquivos_chamado alter column mensagem_id set not null;
create index arquivos_chamado_m on arquivos_chamado (mensagem_id, enviado_em);

-- Cada mensagem traz as imagens liberadas dela (Plataforma e Console). A assinatura é a da 0190.
create or replace function mensagens_do_chamado(p_chamado uuid, p_internas boolean) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'lado', m.lado, 'interna', m.interna, 'autor', nome_pessoa(m.autor_id),
                                                'texto', m.texto, 'criadoEm', m.criado_em,
                                                'imagens', coalesce((
                                                  select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo)
                                                                   order by a.enviado_em, a.id)
                                                    from arquivos_chamado a where a.mensagem_id = m.id and a.situacao = 'LIBERADO'), '[]'::jsonb))
                            order by m.criado_em, m.id), '[]'::jsonb)
    from mensagens_chamado m where m.chamado_id = p_chamado and (p_internas or not m.interna)
$$;

-- A lista de imagens do chamado (0190) com a mensagem de cada uma.
create or replace function arquivos_do_chamado(p_chamado uuid) returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', a.id, 'mensagemId', a.mensagem_id, 'nome', a.nome, 'tipo', a.tipo, 'tamanho', coalesce(a.tamanho, a.tamanho_declarado),
           'situacao', a.situacao, 'motivoRecusa', a.motivo_recusa, 'enviadoEm', a.enviado_em, 'enviadoPor', nome_pessoa(a.enviado_por)))
         order by a.enviado_em, a.id), '[]'::jsonb)
    from arquivos_chamado a where a.chamado_id = p_chamado and a.situacao <> 'ENVIANDO'
$$;

-- Imagens que ainda cabem no chamado: 10, menos as que não foram recusadas.
create function imagens_restantes_chamado(p_chamado uuid) returns integer
language sql stable
set search_path = public
as $$
  select greatest(0, 10 - (select count(*) from arquivos_chamado a where a.chamado_id = p_chamado and a.situacao <> 'NAO_LIBERADO'))::integer
$$;

-- O chamado na Plataforma (0190): quem vê o chamado anexa imagem na própria mensagem enquanto
-- couber e o chamado não estiver fechado.
create or replace function plataforma_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c chamados;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  return resumo_chamado(c, false) || jsonb_build_object(
    'mensagens', mensagens_do_chamado(c.id, false),
    'arquivos', arquivos_do_chamado(c.id),
    'imagensRestantes', imagens_restantes_chamado(c.id),
    'pode', jsonb_build_object(
      'responder', not chamado_fechado(c),
      'resolver', c.situacao <> 'RESOLVIDO',
      'enviarImagem', not chamado_fechado(c) and imagens_restantes_chamado(c.id) > 0));
end $$;

-- Abrir o chamado (0190) devolve também a mensagem, para a tela subir as imagens nela.
create or replace function plataforma_abrir_chamado(p_pessoa uuid, p_condominio uuid, p_tipo text, p_area text, p_titulo text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_numero integer;
  v_mensagem uuid;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  if p_tipo is null or p_tipo not in ('DUVIDA', 'PROBLEMA', 'SUGESTAO') then perform recusar_campos('Escolha o tipo', 'tipo'); end if;
  if p_area is null or p_area not in ('INICIO', 'PEDIDOS', 'AGENDA', 'MANUTENCAO', 'COMUNICADOS', 'MEMORIA', 'MORADORES',
                                      'CONFIGURACOES', 'PESSOAS', 'ACESSO', 'OUTRO') then
    perform recusar_campos('Diga onde no sistema', 'area');
  end if;
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Conte o que aconteceu (até 4.000 caracteres)', 'texto'); end if;
  if not limite_contar('chamado', p_pessoa::text) then
    perform recusar_motivo('Muitos chamados abertos hoje; responda num dos que já existem', 'LIMITE_CHAMADOS');
  end if;
  perform pg_advisory_xact_lock(hashtext('chamados:' || p_condominio));
  select coalesce(max(numero), 0) + 1 into v_numero from chamados where condominio_id = p_condominio;
  insert into chamados (condominio_id, numero, aberto_por, tipo, area, titulo)
  values (p_condominio, v_numero, p_pessoa, p_tipo, p_area, v_titulo)
  returning id into v_id;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, v_id, p_pessoa, 'CLIENTE', v_texto)
  returning id into v_mensagem;
  perform registrar_historico('chamado.aberto', 'chamado', v_id::text, jsonb_build_object('tipo', p_tipo, 'area', p_area));
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'mensagemId', v_mensagem);
end $$;

-- Responder (0190) devolve também a mensagem.
create or replace function plataforma_responder_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_texto text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_reaberto boolean := false;
  v_mensagem uuid;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  if chamado_fechado(c) then
    perform recusar_motivo('Este chamado foi resolvido há mais de 7 dias; abra outro', 'CHAMADO_FECHADO');
  end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Resposta de 2 a 4.000 caracteres', 'texto'); end if;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, c.id, p_pessoa, 'CLIENTE', v_texto)
  returning id into v_mensagem;
  v_reaberto := c.situacao = 'RESOLVIDO';
  update chamados
     set situacao = case when situacao in ('RESOLVIDO', 'ESPERANDO_CLIENTE') then 'ANDAMENTO' else situacao end,
         resolvido_em = null, atualizado_em = app_now()
   where id = c.id;
  if v_reaberto then
    perform registrar_historico('chamado.reaberto', 'chamado', c.id::text, '{}'::jsonb);
  end if;
  return jsonb_build_object('reaberto', v_reaberto, 'mensagemId', v_mensagem);
end $$;

-- Pedir mudança (0286) devolve também a mensagem.
create or replace function plataforma_pedir_mudanca(p_pessoa uuid, p_condominio uuid, p_parte text, p_titulo text, p_hoje text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_numero integer;
  v_aberto integer;
  v_mensagem uuid;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_hoje text := btrim(coalesce(p_hoje, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  if p_parte is null or p_parte !~ '^[A-Z][A-Z_]{1,39}$' then perform recusar_campos('Diga qual parte mudar', 'parte'); end if;
  if coalesce(length(v_titulo), 0) not between 3 and 120 then perform recusar_campos('Título de 3 a 120 caracteres', 'titulo'); end if;
  if coalesce(length(v_hoje), 0) not between 1 and 300 then perform recusar_campos('Diga como está hoje (até 300 caracteres)', 'hoje'); end if;
  if coalesce(length(v_texto), 0) not between 2 and 4000 then perform recusar_campos('Diga o que precisa e por quê (até 4.000 caracteres)', 'texto'); end if;
  perform pg_advisory_xact_lock(hashtext('chamados:' || p_condominio));
  select numero into v_aberto from chamados
   where condominio_id = p_condominio and tipo = 'MUDANCA' and mudanca_parte = p_parte and situacao <> 'RESOLVIDO';
  if found then
    perform recusar_motivo(format('Já há um pedido aberto para esta parte: chamado %s', v_aberto), 'MUDANCA_JA_PEDIDA');
  end if;
  if not limite_contar('chamado', p_pessoa::text) then
    perform recusar_motivo('Muitos chamados abertos hoje; responda num dos que já existem', 'LIMITE_CHAMADOS');
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from chamados where condominio_id = p_condominio;
  insert into chamados (condominio_id, numero, aberto_por, tipo, area, titulo, mudanca_parte, mudanca_hoje)
  values (p_condominio, v_numero, p_pessoa, 'MUDANCA', 'CONFIGURACOES', v_titulo, p_parte, v_hoje)
  returning id into v_id;
  insert into mensagens_chamado (condominio_id, chamado_id, autor_id, lado, texto) values (p_condominio, v_id, p_pessoa, 'CLIENTE', v_texto)
  returning id into v_mensagem;
  perform registrar_historico('chamado.aberto', 'chamado', v_id::text,
                              jsonb_build_object('tipo', 'MUDANCA', 'area', 'CONFIGURACOES', 'parte', p_parte));
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'mensagemId', v_mensagem);
end $$;

-- Iniciar a imagem na mensagem. As regras da 0190 (tipo, tamanho, chamado resolvido) continuam;
-- mudam quem pode e o limite: a própria mensagem, do lado do cliente, não interna, enviada há no
-- máximo 15 minutos; até 3 imagens por mensagem e 10 por chamado (as recusadas não contam).
alter function plataforma_iniciar_arquivo_chamado(uuid, uuid, uuid, text, text, integer) rename to plataforma_iniciar_arquivo_chamado_e297;
alter function plataforma_iniciar_arquivo_chamado_e297(uuid, uuid, uuid, text, text, integer) security invoker;
create function plataforma_iniciar_arquivo_chamado(p_pessoa uuid, p_condominio uuid, p_id uuid, p_mensagem uuid, p_nome text,
                                                   p_tipo text, p_tamanho integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  m mensagens_chamado;
  v_id uuid := gen_random_uuid();
  v_caminho text;
begin
  perform entrar_condominio(p_pessoa, p_condominio, 'suporte.chamados');
  c := exigir_chamado(p_id);
  if not chamado_visivel(p_pessoa, c) then raise exception 'Chamado não encontrado' using errcode = 'TC404'; end if;
  select * into m from mensagens_chamado where id = p_mensagem and chamado_id = c.id;
  if not found then raise exception 'Mensagem não encontrada' using errcode = 'TC404'; end if;
  if m.autor_id <> p_pessoa or m.lado <> 'CLIENTE' or m.interna then
    perform recusar_motivo('A imagem vai só na sua própria mensagem', 'MENSAGEM_DE_OUTRO');
  end if;
  if m.criado_em < app_now() - interval '15 minutes' then
    perform recusar_motivo('A imagem vai junto da mensagem, logo depois de enviar', 'MENSAGEM_ANTIGA');
  end if;
  if c.situacao = 'RESOLVIDO' then perform recusar_motivo('O chamado já está resolvido', 'JA_RESOLVIDO'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 200 then
    perform recusar_campos('Nome do arquivo de 1 a 200 caracteres', 'nome');
  end if;
  if p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'image/webp') then
    perform recusar_motivo('Só imagens (JPG, PNG, WEBP)', 'SO_IMAGEM');
  end if;
  if p_tamanho is null or p_tamanho < 1 then perform recusar_campos('Arquivo vazio', 'tamanho'); end if;
  if p_tamanho > 10485760 then perform recusar_motivo('Imagem com mais de 10 MB', 'ARQUIVO_GRANDE'); end if;
  perform 1 from chamados where id = c.id for update;
  if (select count(*) from arquivos_chamado where mensagem_id = m.id and situacao <> 'NAO_LIBERADO') >= 3 then
    perform recusar_motivo('A mensagem já tem 3 imagens', 'LIMITE_IMAGENS_MENSAGEM');
  end if;
  if imagens_restantes_chamado(c.id) = 0 then
    perform recusar_motivo('O chamado já tem 10 imagens', 'LIMITE_IMAGENS');
  end if;
  v_caminho := p_condominio || '/' || c.id || '/' || v_id;
  insert into arquivos_chamado (id, condominio_id, chamado_id, mensagem_id, nome, tipo, tamanho_declarado, caminho, enviado_por)
  values (v_id, p_condominio, c.id, m.id, btrim(p_nome), p_tipo, p_tamanho, v_caminho, p_pessoa);
  return jsonb_build_object('arquivoId', v_id, 'caminho', v_caminho, 'tipo', p_tipo);
end $$;

-- ---------------------------------------------------------------------------------------
-- 3. O Pronto do link do prestador.

-- A página do prestador (0282) com tudo o que ele mandou e quando respondeu. Encerrado continua
-- só "encerrado". As fotos retiradas pelo síndico saem também daqui.
create or replace function publico_prestador(p_codigo text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  c codigos_sem_conta;
  l links_prestador;
begin
  v := publico_prestador_r6(p_codigo);
  if coalesce((v ->> 'encerrado')::boolean, false) then return v; end if;
  select * into c from codigos_sem_conta where hash = hash_codigo(p_codigo) and tipo = 'PRESTADOR';
  select * into l from links_prestador where id = c.alvo_id;
  return v || jsonb_strip_nulls(jsonb_build_object(
    'pedido', (select p.protocolo from manutencoes m join pedidos p on p.id = m.pedido_id where m.id = l.manutencao_id),
    'respondidoEm', l.respondido_em,
    'registros', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', r.id, 'tipo', r.tipo, 'em', r.criado_em,
               'etiqueta', (select etiqueta_rotulo(e.numero) from etiquetas e where e.id = r.etiqueta_id),
               'confirmado', r.confirmado, 'impedimento', r.impedimento, 'texto', r.texto, 'quemFez', r.quem_fez,
               'ficouPendente', r.ficou_pendente, 'pendenteTexto', r.pendente_texto))
             || jsonb_build_object('fotos', coalesce((
                  select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'tipo', a.tipo) order by a.enviado_em, a.id)
                    from arquivos_prestador a
                   where a.registro_id = r.id and a.situacao = 'LIBERADO' and a.retirado_em is null), '[]'::jsonb))
             order by r.criado_em desc, r.id desc)
        from registros_prestador r where r.link_id = l.id), '[]'::jsonb)));
end $$;

-- Abrir uma foto do próprio link: liberada, não retirada e já enviada num registro (a página só
-- mostra as fotos dos registros; a solta, ainda não enviada, não abre). Link encerrado recusa
-- (LINK_ENCERRADO).
create function publico_prestador_foto(p_codigo text, p_arquivo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l links_prestador;
  a arquivos_prestador;
begin
  l := exigir_link_prestador(p_codigo);
  select * into a from arquivos_prestador
   where id = p_arquivo and link_id = l.id and situacao = 'LIBERADO' and retirado_em is null and registro_id is not null;
  if not found then raise exception 'Arquivo não encontrado' using errcode = 'TC404'; end if;
  return jsonb_build_object('caminho', a.caminho, 'nome', a.nome, 'tipo', a.tipo);
end $$;

call fechar_acesso();

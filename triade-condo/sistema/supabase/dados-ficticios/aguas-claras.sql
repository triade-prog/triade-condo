-- Dados fictícios para testar a Plataforma no Condomínio Águas Claras (PT-14).
-- Colar inteiro no SQL Editor do Supabase (triade-condo-dev) e rodar uma vez.
--
-- Atenção: pedido não se apaga (AT-17). O que este script cria fica no condomínio; dá para
-- cancelar ou encerrar, não para sumir. Por isso ele para sem gravar nada se o condomínio já
-- tiver unidades ou pedidos. Nomes e telefones são inventados.
--
-- Tudo passa pelas mesmas funções que a Plataforma usa, como se fosse a síndica: as regras
-- (permissões, guardião, histórico) valem iguais. Se algo falhar, nada fica gravado.

do $$
declare
  c   uuid;   -- condomínio
  s   uuid;   -- síndica (pessoa)
  vs  uuid;   -- vínculo da síndica
  ta  uuid;  tb uuid;   -- torres
  ver integer;
  cat_manut uuid; cat_limp uuid; cat_conv uuid; cat_seg uuid; cat_areas uuid;
  pri_normal uuid; pri_alta uuid; pri_urg uuid; pri_baixa uuid;
  et_analise uuid; et_prestador uuid; et_concluido uuid;
  u jsonb := '{}';
  ct jsonb := '{}';
  r jsonb;
  p uuid;
begin
  select id into c from condominios where nome = 'Condomínio Águas Claras';
  if c is null then raise exception 'Condomínio Águas Claras não encontrado'; end if;
  select v.pessoa_id, v.id into s, vs from vinculos v
   where v.condominio_id = c and v.funcao = 'SINDICO' and v.revogado_em is null limit 1;
  if s is null then raise exception 'O condomínio ainda não tem síndico com acesso ativo'; end if;
  if exists (select 1 from unidades where condominio_id = c) or exists (select 1 from pedidos where condominio_id = c) then
    raise exception 'O condomínio já tem unidades ou pedidos: nada foi gravado';
  end if;

  -- Horário de atendimento (segunda a sexta, 8h às 18h; sábado, 8h às 12h) e quem atende.
  select versao into ver from horarios where condominio_id = c and tipo = 'ATENDIMENTO';
  perform plataforma_definir_horarios(s, c, 'ATENDIMENTO', ver,
    '[{"dia":1,"inicio":"08:00","fim":"18:00"},{"dia":2,"inicio":"08:00","fim":"18:00"},{"dia":3,"inicio":"08:00","fim":"18:00"},
      {"dia":4,"inicio":"08:00","fim":"18:00"},{"dia":5,"inicio":"08:00","fim":"18:00"},{"dia":6,"inicio":"08:00","fim":"12:00"}]');
  select versao into ver from configuracao_condominio where condominio_id = c;
  perform plataforma_definir_atendimento(s, c, ver, jsonb_build_array(jsonb_build_object('vinculoId', vs, 'disponivel', true)), vs);

  -- Prédio: duas torres, quatro andares, quatro unidades por andar.
  select versao into ver from configuracao_condominio where condominio_id = c;
  perform plataforma_definir_estrutura(s, c, ver, 'TORRE', true);
  ta := (plataforma_salvar_bloco(s, c, null, null, 'Torre A', null, null) ->> 'id')::uuid;
  tb := (plataforma_salvar_bloco(s, c, null, null, 'Torre B', null, null) ->> 'id')::uuid;
  perform plataforma_incluir_unidades(s, c, b, (
    select jsonb_agg(jsonb_build_object('identificacao', a || lpad(n::text, 2, '0'), 'andar', a::text))
      from generate_series(1, 4) a, generate_series(1, 4) n))
    from unnest(array[ta, tb]) b;
  select jsonb_object_agg(bl.nome || ' ' || un.identificacao, un.id) into u
    from unidades un join blocos bl on bl.id = un.bloco_id where un.condominio_id = c;

  -- Moradores (a síndica inclui já confirmado). Inquilino entra junto com o proprietário.
  ct := ct || jsonb_build_object('marina', plataforma_incluir_contato(s, c, (u ->> 'Torre A 101')::uuid, null, 'Marina Souza', '+5561900000101', 'PROPRIETARIO', true, true) ->> 'contatoId');
  perform plataforma_incluir_contato(s, c, (u ->> 'Torre A 101')::uuid, null, 'Pedro Souza', '+5561900000102', 'FAMILIAR', false, true);
  ct := ct || jsonb_build_object('joana', plataforma_incluir_contato(s, c, (u ->> 'Torre A 102')::uuid, null, 'Joana Lima', '+5561900000103', 'INQUILINO', true, true,
    '{"nome": "Sara Melo", "telefone": "+5561900000104"}') ->> 'contatoId');
  ct := ct || jsonb_build_object('rui', plataforma_incluir_contato(s, c, (u ->> 'Torre A 201')::uuid, null, 'Rui Alves', '+5561900000105', 'PROPRIETARIO', true, true) ->> 'contatoId');
  ct := ct || jsonb_build_object('helena', plataforma_incluir_contato(s, c, (u ->> 'Torre B 202')::uuid, null, 'Helena Prado', '+5561900000106', 'PROPRIETARIO', true, true) ->> 'contatoId');
  ct := ct || jsonb_build_object('caio', plataforma_incluir_contato(s, c, (u ->> 'Torre B 304')::uuid, null, 'Caio Nunes', '+5561900000107', 'MORADOR', true, true) ->> 'contatoId');
  perform plataforma_incluir_contato(s, c, (u ->> 'Torre B 401')::uuid, null, 'Lúcia Ramos', '+5561900000108', 'PROPRIETARIO', true, true);

  -- Configuração que veio do cenário.
  select id into cat_manut from categorias where condominio_id = c and modelo = 'MANUTENCAO';
  select id into cat_limp  from categorias where condominio_id = c and modelo = 'LIMPEZA';
  select id into cat_conv  from categorias where condominio_id = c and modelo = 'CONVIVENCIA';
  select id into cat_seg   from categorias where condominio_id = c and modelo = 'SEGURANCA';
  select id into cat_areas from categorias where condominio_id = c and modelo = 'AREAS_COMUNS';
  select id into pri_baixa  from prioridades where condominio_id = c and modelo = 'BAIXA';
  select id into pri_normal from prioridades where condominio_id = c and modelo = 'NORMAL';
  select id into pri_alta   from prioridades where condominio_id = c and modelo = 'ALTA';
  select id into pri_urg    from prioridades where condominio_id = c and modelo = 'URGENTE';
  select id into et_analise   from etapas where condominio_id = c and modelo = 'EM_ANALISE';
  select id into et_prestador from etapas where condominio_id = c and modelo = 'AGUARDANDO_PRESTADOR';
  select id into et_concluido from etapas where condominio_id = c and modelo = 'CONCLUIDO';

  -- 1. Vazamento: em andamento, aguardando prestador, com retorno dado, previsão e pendência.
  r := plataforma_registrar_pedido(s, c, (u ->> 'Torre A 101')::uuid, (ct ->> 'marina')::uuid, 'Banheiro social', cat_manut, pri_normal,
    'Vazamento no teto do banheiro', 'A moradora ligou: mancha de água no teto do banheiro social desde ontem, pingando à noite.', 'TELEFONE', false, null);
  p := (r ->> 'id')::uuid;
  ver := (plataforma_mover_pedido(s, c, p, 1, et_prestador) ->> 'versao')::int;
  ver := (plataforma_registrar_retorno(s, c, p, ver, 'TELEFONE', 'Avisei que o encanador vem avaliar na quinta pela manhã.') ->> 'versao')::int;
  ver := (plataforma_definir_previsao(s, c, p, ver, hoje_no_condominio() + 4, null) ->> 'versao')::int;
  perform plataforma_abrir_pendencia(s, c, p, ver, 'FORNECEDOR', 'Encanador vai confirmar o horário da visita', vs);

  -- 2. Portão da garagem: urgente, aberto, visto pela gestão.
  perform plataforma_registrar_pedido(s, c, null, null, 'Portão da garagem', cat_seg, pri_urg,
    'Portão da garagem não fecha', 'O portão ficou aberto depois das 22h; o motor faz barulho e para no meio.', 'OBSERVACAO', false, null);

  -- 3. Lâmpada do hall: concluído, com explicação.
  r := plataforma_registrar_pedido(s, c, null, null, 'Hall da Torre B', cat_manut, pri_baixa,
    'Lâmpada queimada no hall', 'Duas lâmpadas do hall da Torre B queimadas.', 'PRESENCIAL', false, null);
  perform plataforma_concluir_pedido(s, c, (r ->> 'id')::uuid, 1, et_concluido, 'Trocamos as duas lâmpadas do hall da Torre B por lâmpadas de LED.', 'Nota da loja de materiais, 16/10');

  -- 4. Barulho: privado, em análise.
  r := plataforma_registrar_pedido(s, c, (u ->> 'Torre B 202')::uuid, (ct ->> 'helena')::uuid, null, cat_conv, pri_normal,
    'Barulho depois das 22h', 'A moradora reclama de som alto no andar de cima em dias de semana.', 'MENSAGEM', true, null);
  perform plataforma_mover_pedido(s, c, (r ->> 'id')::uuid, 1, et_analise);

  -- 5. Interfone: cancelado, com motivo.
  r := plataforma_registrar_pedido(s, c, (u ->> 'Torre A 102')::uuid, (ct ->> 'joana')::uuid, null, cat_manut, pri_normal,
    'Interfone não toca', 'O interfone da unidade não toca quando chamam da entrada.', 'TELEFONE', false, null);
  perform plataforma_cancelar_pedido(s, c, (r ->> 'id')::uuid, 1, 'A moradora resolveu: o aparelho estava desligado da tomada');

  -- 6. Escada: em andamento, com nota interna.
  r := plataforma_registrar_pedido(s, c, null, null, 'Escada da Torre A', cat_limp, pri_alta,
    'Escada da Torre A suja', 'Restos de obra na escada entre o 2º e o 3º andar.', 'OBSERVACAO', false, null);
  p := (r ->> 'id')::uuid;
  ver := (plataforma_mover_pedido(s, c, p, 1, et_analise) ->> 'versao')::int;
  perform plataforma_anotar_pedido(s, c, p, ver, 'Pedi à equipe de limpeza para passar hoje à tarde.');

  -- 7. Piscina: aberto, áreas comuns.
  perform plataforma_registrar_pedido(s, c, (u ->> 'Torre B 304')::uuid, (ct ->> 'caio')::uuid, 'Piscina', cat_areas, pri_normal,
    'Água da piscina turva', 'O morador avisou que a água da piscina está turva desde o fim de semana.', 'MENSAGEM', false, null);
end $$;

-- Conferência: o que ficou no condomínio.
select (select count(*) from unidades u join condominios c on c.id = u.condominio_id where c.nome = 'Condomínio Águas Claras') as unidades,
       (select count(*) from contatos_unidade cu join condominios c on c.id = cu.condominio_id where c.nome = 'Condomínio Águas Claras') as moradores,
       (select string_agg(p.protocolo || ' ' || p.estado, ', ' order by p.protocolo) from pedidos p join condominios c on c.id = p.condominio_id
         where c.nome = 'Condomínio Águas Claras') as pedidos;

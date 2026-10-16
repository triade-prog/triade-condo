-- T3 (PT-03) e F0.4: o histórico recusa alteração e exclusão; mudança de estado sem evento
-- e autor é recusada; cada mudança vai para o histórico junto com a alteração.
begin;
select plan(22);

call teste.criar_exemplos();
select teste.permitir('SINDICO', 'exemplos.ver', 'exemplos.criar', 'exemplos.alterar');
create temp table ids as select teste.condominio('Residencial Aurora') as a, teste.pessoa('Síndica Aurora') as pa;
select teste.vincular(pa, a) from ids;
create temp table ex as select exemplo_criar(pa, a, 'Lâmpada queimada no hall') as e from ids;

-- Registro com autor e condomínio vindos do contexto, e hora do relógio da aplicação.
select entrar_condominio(pa, a, 'exemplos.ver') from ids;
select isnt(registrar_historico('exemplo.visto', 'exemplo', 'x1', '{"origem": "painel"}'), null, 'registro gravado');
select results_eq(
  $$ select autor_tipo::text, autor_id, condominio_id, ocorrido_em from historico where acao = 'exemplo.visto' $$,
  $$ select 'PESSOA', pa, a, app_now() from ids $$,
  'autor, condomínio e hora vêm do contexto e do app_now()');

select throws_ok($$ update historico set acao = 'x.y' $$, 'TC010', null, 'T3: alteração recusada');
select throws_ok($$ delete from historico $$, 'TC010', null, 'T3: exclusão recusada');
select throws_ok($$ truncate historico $$, 'TC010', null, 'T3: TRUNCATE recusado');

select throws_ok($$ select registrar_historico('acesso.x', 'acesso', null, '{"senha": "123"}') $$, 'TC011', null, 'senha não entra (PT-08)');
select throws_ok($$ select registrar_historico('acesso.x', 'acesso', null, '{"sessao": {"refresh_token": "r"}}') $$, 'TC011', null, 'token aninhado não entra');
select throws_ok($$ select registrar_historico('pessoa.x', 'pessoa', null, '{"antes": {"email": "a@b.c"}}') $$, 'TC011', null, 'dado pessoal não entra');
select throws_ok($$ select registrar_historico('Ação Inválida', 'exemplo', null) $$, '23514', null, 'nome de ação fora do padrão é recusado');

-- Eventos de acesso: sem condomínio; sem pessoa, o autor é o sistema.
select lives_ok($$ select registrar_acesso(null, 'acesso.senha_errada', '{"motivo": "credenciais"}') $$, 'tentativa de login registrada');
select results_eq($$ select autor_tipo::text, condominio_id from historico where acao = 'acesso.senha_errada' $$,
  $$ values ('SISTEMA', null::uuid) $$, 'tentativa sem pessoa fica como sistema, sem condomínio');
select throws_ok($$ select registrar_acesso(null, 'pedido.criado') $$, 'TC422', null, 'registrar_acesso só aceita eventos de acesso');

-- Guardião de transições.
select results_eq(
  $$ select dados ->> 'para', dados ->> 'evento', autor_id from historico where acao = 'estado.mudou' and entidade_id = (select e::text from ex) $$,
  $$ select 'ABERTO', 'CRIADO', pa from ids $$,
  'o nascimento do registro vai para o histórico com evento e autor');
select throws_ok($$ select exemplo_fechar(pa, a, e, null) from ids, ex $$, 'TC024', null, 'T3: mudança de estado sem evento é recusada');
select lives_ok($$ select exemplo_fechar(pa, a, e, 'RESOLVIDO') from ids, ex $$, 'mudança com evento e autor passa');
select results_eq(
  $$ select dados ->> 'de', dados ->> 'para', dados ->> 'evento', autor_id from historico
      where acao = 'estado.mudou' and dados ->> 'para' = 'FECHADO' $$,
  $$ select 'ABERTO', 'FECHADO', 'RESOLVIDO', pa from ids $$,
  'a mudança fica no histórico, junto com a alteração');

select limpar_contexto();
select set_config('app.condominio_id', (select a::text from ids), true);
select throws_ok($$ select definir_transicao('REABERTO') $$, 'TC025', null, 'T3: mudança de estado sem autor é recusada');
select lives_ok($$ select definir_transicao('PRAZO_VENCEU', null, true) $$, 'o sistema informa que é ele o autor');
select throws_ok($$ update exemplos set estado = 'ABERTO' $$, 'TC023', null, 'transição não cadastrada é recusada');
select throws_ok($$ insert into exemplos (condominio_id, titulo, estado) select a, 'x', 'FECHADO' from ids $$, 'TC021', null,
  'registro não nasce em estado que não é o inicial');
select throws_ok($$ select definir_transicao('evento minúsculo') $$, 'TC020', null, 'evento fora do padrão é recusado');

select throws_ok($$ delete from vinculos $$, 'TC010', null, 'vínculo não se apaga');

select * from finish();
rollback;

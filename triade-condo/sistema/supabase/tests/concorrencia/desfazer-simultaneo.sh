#!/usr/bin/env bash
# Desfazer e reativar ao mesmo tempo (0318, R17.7c): desfazer, reativar, gerar o aditivo de retorno e
# conferir as assinaturas travam o cliente (o interessado) antes do cancelamento e do aditivo, na
# mesma ordem da confirmação (0311). Com conexões de verdade:
# 1. Dois desfazer do mesmo cancelamento ao mesmo tempo, com o cliente seguro por uma terceira
#    conexão: um desfaz, o outro espera o cliente e recebe CANCELAMENTO_DECIDIDO; o último dia é
#    revogado uma vez só.
# 2. Desfazer enquanto a confirmação de um pedido novo do mesmo cliente segura o cliente: o desfazer
#    espera e termina; o pedido novo convive com o desfeito (o índice só conta os abertos).
# 3. Uma conexão segura o cliente. Reativar fica esperando o cliente SEM ter travado o cancelamento:
#    uma terceira trava o cancelamento na hora. Quando a primeira termina, reativar recebe
#    ADITIVO_SEM_ASSINATURAS (não há aditivo assinado) e nada muda.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.desf_ids as select teste.equipe('Bianca do Desfazer', 'COMERCIAL') as com, teste.equipe('Carolina do Desfazer', 'ADMINISTRACAO') as adm,
                                      null::uuid as i, null::uuid as k, null::uuid as j, null::uuid as kj;
update teste.desf_ids set i = (comercial_criar(com, jsonb_build_object('condominio', 'Edifício do Desfazer', 'origem', 'INDICACAO', 'contatoAceito', true,
                                                                      'whatsapp', '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0'))) ->> 'id')::uuid,
                          j = (comercial_criar(com, jsonb_build_object('condominio', 'Edifício do Reativar', 'origem', 'INDICACAO', 'contatoAceito', true,
                                                                      'whatsapp', '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0'))) ->> 'id')::uuid;
-- Os clientes, sem passar pelo contrato inteiro (só o que o cancelamento lê).
set session_replication_role = replica;
update interessados set virou_cliente_em = now(), condominio_id = teste.condominio(condominio), etapa = 'GANHO'
 where id in (select i from teste.desf_ids union all select j from teste.desf_ids);
set session_replication_role = origin;
-- Os dois cancelamentos confirmados.
update teste.desf_ids set k = (comercial_pedir_cancelamento(com, i, '{"pedidoPor": "Síndica do prédio"}') ->> 'id')::uuid,
                          kj = (comercial_pedir_cancelamento(com, j, '{"pedidoPor": "Síndico do prédio"}') ->> 'id')::uuid;
select comercial_confirmar_cancelamento(adm, k, (select versao from cancelamentos_cliente where id = k), '{"motivo": "PRECO"}'),
       comercial_confirmar_cancelamento(adm, kj, (select versao from cancelamentos_cliente where id = kj), '{"motivo": "PRECO"}')
  from teste.desf_ids;
-- O do Reativar já passou do último dia (sem esperar 30 dias).
set session_replication_role = replica;
update cancelamentos_cliente set pedido_em = pedido_em - interval '32 days',
       ultimo_dia = ((pedido_em - interval '32 days') at time zone 'America/Sao_Paulo')::date + aviso_dias
 where id = (select kj from teste.desf_ids);
update encerramentos_contrato e set ultimo_dia = k.ultimo_dia from cancelamentos_cliente k where k.id = e.cancelamento_id and k.id = (select kj from teste.desf_ids);
set session_replication_role = origin;
SQL

limpar_ids() { "${PSQL[@]}" -c "drop table teste.desf_ids" >/dev/null; }

# 1. Dois desfazer ao mesmo tempo, com o cliente seguro por uma terceira conexão.
"${PSQL[@]}" > "$DIR/trava" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select i from teste.desf_ids) for update;
select pg_sleep(1.5);
commit;
SQL
sleep 0.4
for n in a b; do
  "${PSQL[@]}" > "$DIR/desfazer_$n" 2>&1 <<'SQL' &
select coalesce((select teste.erro(format('select comercial_desfazer_cancelamento(%L, %L, %s, %L)', adm, k, (select versao from cancelamentos_cliente where id = k),
                                          'A síndica desistiu')) -> 'detalhe' ->> 'motivo'
                   from teste.desf_ids), 'DESFEITO');
SQL
done
wait
resultado=$(cat "$DIR/desfazer_a" "$DIR/desfazer_b" | tr -d ' ' | sort | tr '\n' ' ')
revogados=$("${PSQL[@]}" -c "select count(*) from encerramentos_contrato where cancelamento_id = (select k from teste.desf_ids) and revogado_em is not null")
if [ "$resultado" != "CANCELAMENTO_DECIDIDO DESFEITO " ] || [ "$revogados" != "1" ]; then
  echo "Desfazer simultâneo (dois desfazer): falhou ($resultado; revogados: $revogados)"
  limpar_ids
  exit 1
fi

# 2. Desfazer de novo não há; um pedido novo do mesmo cliente é confirmado enquanto outra conexão
#    segura o cliente: espera e confirma (o desfeito não conta como aberto).
"${PSQL[@]}" -c "update teste.desf_ids set k = (comercial_pedir_cancelamento(com, i, '{\"pedidoPor\": \"Síndica de novo\"}') ->> 'id')::uuid" >/dev/null
"${PSQL[@]}" > "$DIR/segura" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select i from teste.desf_ids) for update;
select pg_sleep(1);
commit;
SQL
sleep 0.3
confirmado=$("${PSQL[@]}" 2>&1 <<'SQL' || true
select comercial_confirmar_cancelamento(adm, k, (select versao from cancelamentos_cliente where id = k), '{"motivo": "PRECO"}') ->> 'situacao' from teste.desf_ids;
SQL
)
wait
abertos=$("${PSQL[@]}" -c "select string_agg(situacao, ',' order by situacao) from cancelamentos_cliente where interessado_id = (select i from teste.desf_ids)")
if [ "$(echo $confirmado)" != "CONFIRMADO" ] || [ "$abertos" != "CONFIRMADO,DESFEITO" ]; then
  echo "Desfazer simultâneo (pedido novo): falhou (confirmado: $confirmado; situações: $abertos)"
  limpar_ids
  exit 1
fi

# 3. Reativar espera o cliente antes de travar o cancelamento.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select j from teste.desf_ids) for update;
select pg_sleep(2);
commit;
SQL
sleep 0.5
"${PSQL[@]}" > "$DIR/segunda" 2>&1 <<'SQL' &
select teste.erro(format('select comercial_reativar_cliente(%L, %L, %s, %L)', adm, kj, (select versao from cancelamentos_cliente where id = kj), '{}'))
         -> 'detalhe' ->> 'motivo'
  from teste.desf_ids;
SQL
sleep 0.7
terceira=$("${PSQL[@]}" 2>&1 <<'SQL' || true
set lock_timeout = '300ms';
select 'esperando' from pg_stat_activity where wait_event_type = 'Lock' and query like '%comercial_reativar_cliente%' and query not like '%pg_stat_activity%';
select 'livre' from cancelamentos_cliente where id = (select kj from teste.desf_ids) for update;
SQL
)
wait
segunda=$(tr -d '[:space:]' < "$DIR/segunda")
situacao=$("${PSQL[@]}" -c "select situacao from cancelamentos_cliente where id = (select kj from teste.desf_ids)")
limpar_ids
if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "1" ] || [ "$(echo $terceira)" != "esperando livre" ] || [ "$segunda" != "ADITIVO_SEM_ASSINATURAS" ] \
   || [ "$situacao" != "CONFIRMADO" ]; then
  echo "Desfazer simultâneo (reativar): falhou (primeira: $(cat "$DIR/primeira"); segunda: $segunda; terceira: $terceira; situação: $situacao)"
  exit 1
fi
echo "Desfazer simultâneo: ok (dois desfazer: um desfaz, o outro recebe CANCELAMENTO_DECIDIDO, uma revogação só; o pedido novo convive com o desfeito; reativar espera o cliente antes de travar o cancelamento)"

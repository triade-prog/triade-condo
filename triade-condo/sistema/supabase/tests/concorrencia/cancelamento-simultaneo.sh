#!/usr/bin/env bash
# Ordem das travas do cancelamento (0311, decisão m): o pedido, a tentativa de retenção, "decidiu
# ficar" e a confirmação travam o cliente (o interessado) antes do pedido de cancelamento, como a
# anonimização. Com duas conexões de verdade:
# 1. Dois pedidos de cancelamento do mesmo cliente ao mesmo tempo: um registra, o outro espera o
#    cliente e recebe CANCELAMENTO_ABERTO (não um erro 500 do índice único).
# 2. Uma conexão segura o cliente (como a anonimização). A segunda confirma o cancelamento e fica
#    esperando o cliente SEM ter travado o pedido: uma terceira consegue travar o pedido na hora.
#    Quando a primeira confirma, a segunda termina e o pedido fica CONFIRMADO.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.canc_ids as select teste.equipe('Bianca do Cancelamento', 'COMERCIAL') as com, teste.equipe('Carolina do Cancelamento', 'ADMINISTRACAO') as adm,
                                      null::uuid as i, null::uuid as pedido;
update teste.canc_ids set i = (comercial_criar(com, jsonb_build_object('condominio', 'Edifício do Cancelamento', 'origem', 'INDICACAO', 'contatoAceito', true,
                                                                      'whatsapp', '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0'))) ->> 'id')::uuid;
-- O cliente, sem passar pelo contrato inteiro (só o que o cancelamento lê).
set session_replication_role = replica;
update interessados set virou_cliente_em = now(), condominio_id = teste.condominio('Edifício do Cancelamento'), etapa = 'GANHO'
 where id = (select i from teste.canc_ids);
set session_replication_role = origin;
SQL

# 1. Dois pedidos ao mesmo tempo, com o cliente seguro por uma terceira conexão.
"${PSQL[@]}" > "$DIR/trava" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select i from teste.canc_ids) for update;
select pg_sleep(1.5);
commit;
SQL
sleep 0.4
for n in a b; do
  "${PSQL[@]}" > "$DIR/pedido_$n" 2>&1 <<'SQL' &
select coalesce((select teste.erro(format('select comercial_pedir_cancelamento(%L, %L, %L)', com, i, '{"pedidoPor": "Síndica do prédio"}')) -> 'detalhe' ->> 'motivo'
                   from teste.canc_ids), 'REGISTRADO');
SQL
done
wait
resultado=$(cat "$DIR/pedido_a" "$DIR/pedido_b" | tr -d ' ' | sort | tr '\n' ' ')
if [ "$resultado" != "CANCELAMENTO_ABERTO REGISTRADO " ]; then
  echo "Cancelamento simultâneo (dois pedidos): falhou ($resultado)"
  "${PSQL[@]}" -c "drop table teste.canc_ids" >/dev/null
  exit 1
fi
"${PSQL[@]}" -c "update teste.canc_ids set pedido = (select id from cancelamentos_cliente where interessado_id = i)" >/dev/null

# 2. A confirmação espera o cliente antes de travar o pedido.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select i from teste.canc_ids) for update;
select pg_sleep(2);
commit;
SQL
sleep 0.5
"${PSQL[@]}" > "$DIR/segunda" 2>&1 <<'SQL' &
select comercial_confirmar_cancelamento(adm, pedido, (select versao from cancelamentos_cliente where id = pedido), '{"motivo": "PRECO"}') ->> 'situacao'
  from teste.canc_ids;
SQL
sleep 0.7
terceira=$("${PSQL[@]}" 2>&1 <<'SQL' || true
set lock_timeout = '300ms';
select 'esperando' from pg_stat_activity where wait_event_type = 'Lock' and query like '%comercial_confirmar_cancelamento%' and query not like '%pg_stat_activity%';
select 'livre' from cancelamentos_cliente where id = (select pedido from teste.canc_ids) for update;
SQL
)
wait
segunda=$(tr -d '[:space:]' < "$DIR/segunda")
"${PSQL[@]}" -c "drop table teste.canc_ids" >/dev/null
if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "1" ] || [ "$(echo $terceira)" != "esperando livre" ] || [ "$segunda" != "CONFIRMADO" ]; then
  echo "Cancelamento simultâneo (confirmar): falhou (primeira: $(cat "$DIR/primeira"); segunda: $segunda; terceira: $terceira)"
  exit 1
fi
echo "Cancelamento simultâneo: ok (dois pedidos: um registra, o outro recebe CANCELAMENTO_ABERTO; confirmar espera o cliente antes de travar o pedido)"

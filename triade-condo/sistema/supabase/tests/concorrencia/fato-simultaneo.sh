#!/usr/bin/env bash
# Fato do comparativo (0307) registrado duas vezes ao mesmo tempo, com duas conexões de verdade:
# as duas conferiram que não havia fato. A primeira grava e segura a transação; a segunda espera
# o índice único e, quando a primeira confirma, recebe FATO_EXISTE (e não um erro 500).
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.fato_ids as select teste.equipe('Bianca da Corrida', 'COMERCIAL') as com, null::uuid as i;
update teste.fato_ids set i = (comercial_criar(com, jsonb_build_object('condominio', 'Edifício Corrida', 'pessoa', 'Rita Dias', 'origem', 'INDICACAO',
                                                                       'contatoAceito', true, 'whatsapp', '5561999990999')) ->> 'id')::uuid;
update interessados set sistema_atual = 'App da Corrida' where id = (select i from teste.fato_ids);
SQL

# Primeira conexão: registra o fato e segura a transação por 2 segundos.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<'SQL' &
begin;
select comercial_salvar_fato(com, null, null, jsonb_build_object('sistema', 'App da Corrida', 'criterio', 'COMO_CANCELAR', 'interessadoId', i,
  'texto', 'Aviso de 90 dias', 'fonte', 'Contrato do prédio')) ->> 'versao' from teste.fato_ids;
select pg_sleep(2);
commit;
SQL
sleep 0.7

# Segunda conexão: o mesmo prédio, sistema e critério; espera e recebe FATO_EXISTE com o fato da primeira.
segunda=$("${PSQL[@]}" -c "select (e -> 'detalhe' ->> 'motivo') || ' ' || ((e -> 'detalhe' ->> 'fatoId') is not null) from (select teste.erro(format('select comercial_salvar_fato(%L, null, null, %L::jsonb)', com, jsonb_build_object('sistema', 'app da corrida', 'criterio', 'COMO_CANCELAR', 'interessadoId', i, 'texto', 'Aviso de 60 dias', 'fonte', 'Conversa com o síndico'))) as e from teste.fato_ids) x" 2>&1)
wait
final=$("${PSQL[@]}" -c "select count(*) || ' ' || min(texto) from fatos_comparativo where sistema_chave = 'appdacorrida'")
"${PSQL[@]}" -c "drop table teste.fato_ids" >/dev/null

if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "1" ] || [ "$segunda" != "FATO_EXISTE true" ] || [ "$final" != "1 Aviso de 90 dias" ]; then
  echo "Fato simultâneo: falhou (primeira: $(cat "$DIR/primeira"); segunda: $segunda; final: $final)"
  exit 1
fi
echo "Fato simultâneo: ok (o primeiro gravou, o segundo recebeu FATO_EXISTE, um fato só)"

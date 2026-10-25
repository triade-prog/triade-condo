#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrations em ordem, roda os testes pgTAP e o teste
# de edição simultânea, do fato do comparativo registrado duas vezes e da ordem das travas do contrato,
# com conexões de verdade.
# Uso: bash scripts/test-db.sh   (precisa de PostgreSQL 16+ com pgTAP e pg_prove)
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
PORTA="${PGPORT_TESTE:-54339}"
DADOS="$(mktemp -d /tmp/triade-pg.XXXXXX)"

como_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DADOS"

limpar() { como_pg "$PGBIN/pg_ctl" -D "$DADOS" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DADOS"; }
trap limpar EXIT

como_pg "$PGBIN/initdb" -D "$DADOS" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
como_pg "$PGBIN/pg_ctl" -D "$DADOS" -o "-p $PORTA -k /tmp -c listen_addresses=127.0.0.1" -w start >/dev/null

export PGHOST=/tmp PGPORT="$PORTA" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
PSQL=("$PGBIN/psql" -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$RAIZ/supabase/tests/bootstrap.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$RAIZ/supabase/tests/ajudantes.sql"

pg_prove --ext .sql -r "$RAIZ/supabase/tests/pgtap"

# Edição simultânea do mesmo registro com duas conexões (T4, AT-24).
PSQL_BIN="$PGBIN/psql" bash "$RAIZ/supabase/tests/concorrencia/edicao-simultanea.sh"

# O mesmo fato do comparativo registrado ao mesmo tempo (0307): FATO_EXISTE, não erro 500.
PSQL_BIN="$PGBIN/psql" bash "$RAIZ/supabase/tests/concorrencia/fato-simultaneo.sh"

# Conferir um envio enquanto o contrato é gerado de novo (0308): a mesma ordem de travas, sem impasse.
PSQL_BIN="$PGBIN/psql" bash "$RAIZ/supabase/tests/concorrencia/contrato-envio-simultaneo.sh"

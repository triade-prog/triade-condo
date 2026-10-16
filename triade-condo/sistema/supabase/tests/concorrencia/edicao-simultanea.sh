#!/usr/bin/env bash
# T4 (AT-24) com duas conexões de verdade: as duas leram a versão 1. A primeira grava e
# segura a transação; a segunda espera o bloqueio e, quando a primeira confirma, recebe o
# conflito em vez de sobrescrever.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"; "${PSQL[@]}" -c "drop table if exists public.exemplos cascade; drop function if exists public.exemplo_criar, public.exemplo_listar, public.exemplo_ler, public.exemplo_buscar, public.exemplo_alterar, public.exemplo_fechar; delete from estados_iniciais where tabela = '"'"'exemplos'"'"'; delete from transicoes_permitidas where tabela = '"'"'exemplos'"'"'; delete from tabelas_sem_condominio where tabela = '"'"'exemplos'"'"';" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
call teste.criar_exemplos();
select teste.permitir('SINDICO', 'exemplos.ver', 'exemplos.criar', 'exemplos.alterar');
create table teste.ids as select teste.condominio('Concorrência') as a, teste.pessoa('Síndica') as pa, teste.pessoa('Subsíndico') as ps;
select teste.vincular(pa, a), teste.vincular(ps, a) from teste.ids;
alter table teste.ids add column e uuid;
update teste.ids set e = exemplo_criar(pa, a, 'Original');
SQL

# Primeira conexão: grava a partir da versão 1 e segura a transação por 2 segundos.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<'SQL' &
begin;
select exemplo_alterar(pa, a, e, 1, 'Texto da síndica') from teste.ids;
select pg_sleep(2);
commit;
SQL
sleep 0.7

# Segunda conexão: também leu a versão 1; espera o bloqueio e recebe o conflito.
segunda=$("${PSQL[@]}" -c "select teste.erro(format('select exemplo_alterar(%L, %L, %L, 1, %L)', ps, a, e, 'Texto do subsíndico')) ->> 'codigo' from teste.ids" 2>&1)
wait
final=$("${PSQL[@]}" -c "select titulo || ' v' || versao from public.exemplos")
"${PSQL[@]}" -c "drop table teste.ids" >/dev/null

if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "2" ] || [ "$segunda" != "TC409" ] || [ "$final" != "Texto da síndica v2" ]; then
  echo "Edição simultânea: falhou (primeira: $(cat "$DIR/primeira"); segunda: $segunda; final: $final)"
  exit 1
fi
echo "Edição simultânea: ok (a primeira gravou, a segunda recebeu o conflito, nada sobrescrito)"

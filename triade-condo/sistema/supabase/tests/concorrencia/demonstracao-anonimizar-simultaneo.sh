#!/usr/bin/env bash
# Ordem das travas da demonstração (0310, revisão r6): apagar o interessado (comercial_anonimizar)
# trava o interessado e depois as demonstrações dele; registrar como foi e remarcar têm de travar na
# mesma ordem, senão as duas esperam uma pela outra.
# Uma conexão segura o interessado (como a anonimização, no começo). A segunda registra como foi
# (ou remarca) e fica esperando o interessado SEM ter travado a demonstração: uma terceira consegue
# travar a demonstração na hora. Quando a primeira confirma, a segunda termina.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.demo_ids as select teste.equipe('Bianca da Demonstração', 'COMERCIAL') as com,
                                      null::uuid as i_feita, null::uuid as feita, null::uuid as i_remarcar, null::uuid as remarcar;
do $$
declare t teste.demo_ids; h timestamptz := date_trunc('hour', now()) + interval '2 days';
begin
  select * into t from teste.demo_ids;
  t.i_feita := (comercial_criar(t.com, jsonb_build_object('condominio', 'Edifício da Demonstração', 'origem', 'INDICACAO', 'contatoAceito', true,
                                                          'whatsapp', '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0'))) ->> 'id')::uuid;
  t.i_remarcar := (comercial_criar(t.com, jsonb_build_object('condominio', 'Edifício da Remarcação', 'origem', 'INDICACAO', 'contatoAceito', true,
                                                             'whatsapp', '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0'))) ->> 'id')::uuid;
  t.feita := (comercial_marcar_demonstracao(t.com, t.i_feita, jsonb_build_object('inicio', h)) ->> 'id')::uuid;
  t.remarcar := (comercial_marcar_demonstracao(t.com, t.i_remarcar, jsonb_build_object('inicio', h + interval '1 hour')) ->> 'id')::uuid;
  -- A que vai ser registrada já aconteceu.
  update demonstracoes_comercial set inicio = now() - interval '2 hours', fim = now() - interval '90 minutes' where id = t.feita;
  update teste.demo_ids set i_feita = t.i_feita, feita = t.feita, i_remarcar = t.i_remarcar, remarcar = t.remarcar;
end $$;
SQL

# $1: a coluna do interessado; $2: a coluna da demonstração; $3: a chamada; $4: o nome do caso.
caso() {
  "${PSQL[@]}" > "$DIR/primeira" 2>&1 <<SQL &
begin;
select 1 from interessados where id = (select $1 from teste.demo_ids) for update;
select pg_sleep(2);
commit;
SQL
  sleep 0.5
  "${PSQL[@]}" > "$DIR/segunda" 2>&1 <<SQL &
$3
SQL
  sleep 0.7
  terceira=$("${PSQL[@]}" 2>&1 <<SQL || true
set lock_timeout = '300ms';
select 'esperando' from pg_stat_activity where wait_event_type = 'Lock' and query like '%comercial_%demonstracao%' and query not like '%pg_stat_activity%';
select 'livre' from demonstracoes_comercial where id = (select $2 from teste.demo_ids) for update;
SQL
)
  wait
  if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "1" ] || [ "$(echo $terceira)" != "esperando livre" ]; then
    echo "Demonstração e anonimização simultâneas ($4): falhou (primeira: $(cat "$DIR/primeira"); segunda: $(cat "$DIR/segunda"); terceira: $terceira)"
    "${PSQL[@]}" -c "drop table teste.demo_ids" >/dev/null
    exit 1
  fi
  segunda=$(tr -d '[:space:]' < "$DIR/segunda")
}

caso i_feita feita "select comercial_demonstracao_feita(com, feita, (select versao from demonstracoes_comercial where id = feita),
  jsonb_build_object('resumo', 'Gostou do mural', 'proximoPasso', 'Mandar a proposta', 'proximoPassoData', current_date + 3)) ->> 'situacao' from teste.demo_ids;" \
  "registrar como foi"
feita=$segunda
caso i_remarcar remarcar "select (comercial_remarcar_demonstracao(com, remarcar, (select versao from demonstracoes_comercial where id = remarcar),
  jsonb_build_object('inicio', date_trunc('hour', now()) + interval '3 days')) ->> 'remarcacoes') from teste.demo_ids;" \
  "remarcar"
remarcar=$segunda
"${PSQL[@]}" -c "drop table teste.demo_ids" >/dev/null

if [ "$feita" != "FEITA" ] || [ "$remarcar" != "1" ]; then
  echo "Demonstração e anonimização simultâneas: falhou (registrar: $feita; remarcar: $remarcar)"
  exit 1
fi
echo "Demonstração e anonimização simultâneas: ok (registrar como foi e remarcar esperam o interessado antes de travar a demonstração)"

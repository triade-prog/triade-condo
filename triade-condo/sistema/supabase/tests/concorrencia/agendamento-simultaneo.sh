#!/usr/bin/env bash
# Dois agendamentos pelo link no mesmo horário (0310, R17.6; CM-23), com duas conexões de verdade:
# a primeira marca e segura a transação; a segunda espera a trava da agenda e, quando a primeira
# confirma, recebe HORARIO_OCUPADO (e não um erro 500 nem duas demonstrações no mesmo horário).
# Uma terceira, num horário diferente, também espera a trava e marca depois.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

# A agenda de uma pessoa nova, aberta todos os dias, sem aviso mínimo; os dois horários são do dia
# seguinte ao primeiro dia da grade (nunca no passado, a qualquer hora em que o teste rodar).
"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.agenda_ids as select teste.equipe('Bianca da Agenda', 'COMERCIAL') as com, null::text as codigo,
                                        null::text as h1, null::text as h2,
                                        '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0') as w1,
                                        '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0') as w2,
                                        '5561' || lpad(floor(random() * 1e9)::bigint::text, 9, '0') as w3;
do $$
declare t teste.agenda_ids; a jsonb;
begin
  select * into t from teste.agenda_ids;
  perform comercial_salvar_disponibilidade(t.com, t.com, null, jsonb_build_object('avisoDiasUteis', 0, 'faixas',
    (select jsonb_agg(jsonb_build_object('dia', d, 'de', '08:00', 'ate', '20:00')) from generate_series(1, 7) d)));
  t.codigo := comercial_link_agenda(t.com, t.com) ->> 'codigo';
  a := publico_agenda(t.codigo);
  t.h1 := a -> 'dias' -> 1 -> 'horarios' -> 0 ->> 'inicio';
  t.h2 := a -> 'dias' -> 1 -> 'horarios' -> 2 ->> 'inicio';
  update teste.agenda_ids set codigo = t.codigo, h1 = t.h1, h2 = t.h2;
end $$;
SQL

pedido="jsonb_build_object('nome', 'Rita Dias', 'condominio', 'Edifício da Agenda', 'faixa', 'DE_41_A_100', 'consentimento', true"

# Primeira conexão: marca o horário e segura a transação por 2 segundos.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<SQL &
begin;
select publico_agendar(codigo, $pedido, 'inicio', h1, 'whatsapp', w1, 'email', 'rita1@exemplo.com.br')) ->> 'quando' is not null from teste.agenda_ids;
select pg_sleep(2);
commit;
SQL
sleep 0.7

# Segunda conexão: o mesmo horário, outra pessoa; espera e recebe HORARIO_OCUPADO.
"${PSQL[@]}" > "$DIR/segunda" 2>&1 <<SQL &
select teste.erro(format('select publico_agendar(%L, %L::jsonb)', codigo,
                         $pedido, 'inicio', h1, 'whatsapp', w2, 'email', 'rita2@exemplo.com.br'))) -> 'detalhe' ->> 'motivo'
  from teste.agenda_ids;
SQL

# Terceira conexão: outro horário; espera a trava e marca.
"${PSQL[@]}" > "$DIR/terceira" 2>&1 <<SQL &
select publico_agendar(codigo, $pedido, 'inicio', h2, 'whatsapp', w3, 'email', 'rita3@exemplo.com.br')) ->> 'quando' is not null from teste.agenda_ids;
SQL
sleep 0.5
esperando=$("${PSQL[@]}" -c "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%publico_agendar%'")
wait

final=$("${PSQL[@]}" -c "select count(*) || ' ' || count(distinct d.inicio) from demonstracoes_comercial d
                          where d.pessoa_id = (select com from teste.agenda_ids) and d.situacao = 'MARCADA'")
"${PSQL[@]}" -c "drop table teste.agenda_ids" >/dev/null

if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "t" ] || [ "$(tr -d '[:space:]' < "$DIR/segunda")" != "HORARIO_OCUPADO" ] \
   || [ "$(tr -d '[:space:]' < "$DIR/terceira")" != "t" ] || [ "$esperando" != "2" ] || [ "$final" != "2 2" ]; then
  echo "Agendamento simultâneo: falhou (primeira: $(cat "$DIR/primeira"); segunda: $(cat "$DIR/segunda"); terceira: $(cat "$DIR/terceira");" \
       "esperando: $esperando; final: $final)"
  exit 1
fi
echo "Agendamento simultâneo: ok (o segundo no mesmo horário espera a trava e recebe HORARIO_OCUPADO; outro horário marca depois)"

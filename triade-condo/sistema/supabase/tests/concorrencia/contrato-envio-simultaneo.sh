#!/usr/bin/env bash
# Ordem das travas do contrato (0308, revisões do 3f3902a e do 717fe30): gerar de novo trava o
# interessado, o contrato e depois os envios; conferir um envio tem de travar na mesma ordem, senão
# as duas esperam uma pela outra.
# 1. Uma conexão segura o contrato (como gerar de novo). A segunda confere automaticamente um envio
#    desse contrato e fica esperando o contrato SEM ter travado o envio: uma terceira consegue
#    travar o envio na hora. Quando a primeira confirma, a segunda termina e o envio fica para a
#    equipe conferir.
# 2. Uma conexão segura o interessado (como gerar de novo, no começo). A equipe confere o envio no
#    validador e espera o interessado SEM ter travado o contrato nem o envio: uma terceira trava os
#    dois na hora. Quando a primeira confirma, a conferência termina e o contrato espera a TRÍADE.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -v ON_ERROR_STOP=1 -q -X -tA)
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

"${PSQL[@]}" >/dev/null <<'SQL'
create table teste.trava_ids as select teste.equipe('Bianca da Trava', 'COMERCIAL') as com, null::uuid as i, null::text as codigo,
                                       null::uuid as contrato, null::uuid as envio;
insert into modelos_contrato (numero, titulo, texto, termo, indice_reajuste, advogado_nome, advogado_oab, revisado_em, situacao, em_uso_em)
select coalesce(max(numero), 0) + 1, 'Contrato da trava', 'Contrato entre a TRÍADE e o «condominio», a partir de «data_inicio».',
       'Termo de tratamento de dados do «condominio»: a TRÍADE trata os dados só para prestar o serviço.', 'IPCA', 'Rui Barros', 'DF 12345',
       current_date - 1, 'EM_USO', app_now()
  from modelos_contrato
 where not exists (select 1 from modelos_contrato where situacao = 'EM_USO');
update teste.trava_ids set i = (comercial_criar(com, jsonb_build_object('condominio', 'Edifício da Trava', 'pessoa', 'Rita Dias', 'origem', 'INDICACAO',
                                                                       'contatoAceito', true, 'whatsapp', '5561999990998')) ->> 'id')::uuid;
update interessados set unidades = 72, faixa = 'DE_41_A_100', cidade = 'Brasília', uf = 'DF' where id = (select i from teste.trava_ids);
do $$
declare t teste.trava_ids; r jsonb; e jsonb; d uuid;
begin
  select * into t from teste.trava_ids;
  r := comercial_criar_proposta(t.com, t.i, '{}');
  e := comercial_enviar_proposta(t.com, (r ->> 'id')::uuid, (r ->> 'versaoId')::uuid, (r ->> 'versao')::integer);
  t.codigo := e -> 'link' ->> 'codigo';
  perform publico_aceitar_proposta(t.codigo, '{"nome": "Rita Dias", "cpf": "52998224725", "cargo": "Síndica", "concordo": true}', null, null);
  d := (publico_iniciar_documento(t.codigo, '{"tipo": "CNPJ", "nome": "c.pdf", "tamanho": 900, "cnpj": "11222333000181"}', null) ->> 'documentoId')::uuid;
  perform publico_verificar_documento(t.codigo, d, true, 900, repeat('a', 64), null);
  d := (publico_iniciar_documento(t.codigo, '{"tipo": "ATA_ELEICAO", "nome": "a.pdf", "tamanho": 900, "mandatoAte": "2030-12-31"}', null) ->> 'documentoId')::uuid;
  perform publico_verificar_documento(t.codigo, d, true, 900, repeat('b', 64), null);
  t.contrato := (comercial_gerar_contrato(t.com, t.i, comercial_hoje() + 7, null) ->> 'contratoId')::uuid;
  perform comercial_contrato_pronto(t.com, t.contrato, repeat('c', 64), 5000);
  t.envio := (publico_iniciar_envio(t.codigo, '{"nome": "assinado.pdf", "tamanho": 5500}', null) ->> 'envioId')::uuid;
  update teste.trava_ids set codigo = t.codigo, contrato = t.contrato, envio = t.envio;
end $$;
SQL

# Primeira conexão: segura o contrato por 2 segundos, como gerar de novo.
"${PSQL[@]}" > "$DIR/primeira" 2>&1 <<'SQL' &
begin;
select 1 from contratos_comercial where id = (select contrato from teste.trava_ids) for update;
select pg_sleep(2);
commit;
SQL
sleep 0.5

# Segunda conexão: confere o envio (espera o contrato).
"${PSQL[@]}" > "$DIR/segunda" 2>&1 <<'SQL' &
select publico_verificar_envio(codigo, envio, jsonb_build_object('valido', true, 'sha256', repeat('d', 64), 'tamanho', 5500, 'assinaturas', 1,
                                                                 'prefixoSha256', repeat('c', 64), 'assinaturaNova', true, 'soAssinatura', true)) ->> 'situacao'
  from teste.trava_ids;
SQL
sleep 0.7

# Terceira conexão: enquanto a segunda espera, o envio continua livre.
terceira=$("${PSQL[@]}" 2>&1 <<'SQL' || true
set lock_timeout = '300ms';
select 'livre' from envios_contrato where id = (select envio from teste.trava_ids) for update;
SQL
)
wait
final=$("${PSQL[@]}" -c "select situacao from envios_contrato where id = (select envio from teste.trava_ids)")

# 2. A primeira segura o interessado por 2 segundos.
"${PSQL[@]}" > "$DIR/primeira2" 2>&1 <<'SQL' &
begin;
select 1 from interessados where id = (select i from teste.trava_ids) for update;
select pg_sleep(2);
commit;
SQL
sleep 0.5

# A equipe confere no validador (espera o interessado).
"${PSQL[@]}" > "$DIR/segunda2" 2>&1 <<'SQL' &
select comercial_conferir_envio(com, envio, (select versao from envios_contrato where id = envio),
                                '{"assinaturaValida": true, "pessoaConfere": true, "dataConfere": true}') -> 'contrato' ->> 'situacao'
  from teste.trava_ids;
SQL
sleep 0.7

# Enquanto a conferência espera o interessado, o contrato e o envio continuam livres.
terceira2=$("${PSQL[@]}" 2>&1 <<'SQL' || true
set lock_timeout = '300ms';
select 'esperando' from pg_stat_activity where wait_event_type = 'Lock' and query like 'select comercial_conferir_envio%';
begin;
select 'contrato' from contratos_comercial where id = (select contrato from teste.trava_ids) for update;
select 'envio' from envios_contrato where id = (select envio from teste.trava_ids) for update;
commit;
SQL
)
wait
final2=$("${PSQL[@]}" -c "select e.situacao || ' ' || c.situacao from envios_contrato e join contratos_comercial c on c.id = e.contrato_id
                           where e.id = (select envio from teste.trava_ids)")
"${PSQL[@]}" -c "drop table teste.trava_ids" >/dev/null

if [ "$(tr -d '[:space:]' < "$DIR/primeira")" != "1" ] || [ "$terceira" != "livre" ] || [ "$(tr -d '[:space:]' < "$DIR/segunda")" != "A_CONFERIR" ] \
   || [ "$final" != "A_CONFERIR" ]; then
  echo "Contrato e envio simultâneos: falhou (primeira: $(cat "$DIR/primeira"); segunda: $(cat "$DIR/segunda"); terceira: $terceira; final: $final)"
  exit 1
fi
if [ "$(tr -d '[:space:]' < "$DIR/primeira2")" != "1" ] || [ "$(echo $terceira2)" != "esperando contrato envio" ] \
   || [ "$(tr -d '[:space:]' < "$DIR/segunda2")" != "AGUARDA_TRIADE" ] || [ "$final2" != "CONFERIDO AGUARDA_TRIADE" ]; then
  echo "Conferência e interessado simultâneos: falhou (primeira: $(cat "$DIR/primeira2"); segunda: $(cat "$DIR/segunda2"); terceira: $terceira2; final: $final2)"
  exit 1
fi
echo "Contrato e envio simultâneos: ok (conferir espera o interessado e o contrato antes de travar o envio, na ordem de gerar de novo)"

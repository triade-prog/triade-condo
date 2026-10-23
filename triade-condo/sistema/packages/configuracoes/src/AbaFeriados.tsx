"use client";
// Feriados (CF-10, AT-10): data sem hora, mostrada como foi escrita (nunca vira o dia anterior
// por causa do fuso). Os nacionais vêm com um toque; o síndico tira o que não vale no prédio.

import { useState } from "react";
import { feriadosNacionais, mostrarDataSemHora } from "@triade/domain";
import { Aviso, Botao, chamarApi, Icone, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "./Janela.tsx";
import type { PropsAba } from "./Configuracoes.tsx";
import { naBase } from "./contexto.tsx";

/** Ano de hoje no horário de Brasília. */
function anoAtual(): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));
}

export function AbaFeriados({ config, pode, salvo }: PropsAba) {
  const [novo, setNovo] = useState(false);
  const [trazendo, setTrazendo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const ano = anoAtual();
  const existentes = new Set(config.feriados.map((f) => f.data));

  async function trazer(a: number) {
    setTrazendo(true);
    setFalha(null);
    let n = 0;
    for (const f of feriadosNacionais(a).filter((x) => !existentes.has(x.data))) {
      const r = await chamarApi(naBase("/feriados"), { corpo: f });
      if (!r.ok) { setTrazendo(false); return setFalha(textoDoErro(r.erro)); }
      n++;
    }
    setTrazendo(false);
    salvo(n === 0 ? `Os feriados nacionais de ${a} já estavam na lista.` : `${n} feriados nacionais de ${a} incluídos. Tire os que não valem no prédio.`);
  }

  async function tirar(id: string, descricao: string) {
    const r = await chamarApi(naBase(`/feriados/${id}/remover`), { corpo: {} });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    salvo(`Feriado retirado: ${descricao}.`);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-apoio text-tinta-suave">{config.feriados.length ? `${config.feriados.length} ${config.feriados.length === 1 ? "feriado" : "feriados"} na lista.` : "Nenhum feriado na lista ainda."}</p>
        {pode ? (
          <div className="flex flex-wrap gap-2">
            {[ano, ano + 1].filter((a) => !feriadosNacionais(a).some((x) => existentes.has(x.data))).slice(0, 1).map((a) => (
              <Botao key={a} disabled={trazendo} onClick={() => void trazer(a)}>Trazer feriados nacionais de {a}</Botao>
            ))}
            <Botao variante="contorno" onClick={() => setNovo(true)}><Icone nome="mais" />Novo feriado</Botao>
          </div>
        ) : null}
      </div>
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      {config.feriados.length === 0 ? (
        <Vazio titulo="Nenhum feriado cadastrado">Traga os nacionais e acrescente os da cidade.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full t-texto">
            <caption className="sr-only">Feriados do condomínio</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Data</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Feriado</th>
                {pode ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {config.feriados.map((f) => (
                <tr key={f.id} className="border-t border-linha">
                  <td className="px-4 py-2.5 whitespace-nowrap">{mostrarDataSemHora(f.data)}</td>
                  <td className="px-4 py-2.5">{f.descricao}</td>
                  {pode ? (
                    <td className="px-4 py-2.5 text-right">
                      <Botao variante="discreto" onClick={() => void tirar(f.id, f.descricao)} aria-label={`Tirar o feriado ${f.descricao} de ${mostrarDataSemHora(f.data)}`}>Tirar</Botao>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Janela
        aberto={novo}
        titulo="Novo feriado"
        textoBotao="Incluir feriado"
        campos={[
          { id: "data", rotulo: "Data", tipo: "data", obrigatorio: true, erro: "Escolha uma data válida." },
          { id: "descricao", rotulo: "Feriado", tipo: "texto", obrigatorio: true, max: 80, erro: "Escreva o nome do feriado (2 a 80 caracteres)." },
        ]}
        iniciais={{ data: "", descricao: "" }}
        aoFechar={() => setNovo(false)}
        aoSalvar={async (v) => {
          const r = await chamarApi(naBase("/feriados"), { corpo: { data: v.data, descricao: v.descricao } });
          if (r.ok) { setNovo(false); salvo(`Feriado incluído: ${mostrarDataSemHora(String(v.data))}.`); }
          return r;
        }}
      />
    </div>
  );
}

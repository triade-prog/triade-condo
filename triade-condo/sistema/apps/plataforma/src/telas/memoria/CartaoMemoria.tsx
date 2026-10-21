"use client";
// O cartão Memória do prédio no início (design "Memória do prédio", tela 1; MP-12): o que venceu,
// o que vence logo e o que falta no prontuário.

import Link from "next/link";
import { classeBotao, Icone } from "@triade/ui";
import { CabecaCartao } from "../CabecaCartao.tsx";
import type { ResumoProntuario } from "../tipos.ts";

export function CartaoMemoria({ resumo: r }: { resumo: ResumoProntuario }) {
  const linhas = [
    r.venceu ? { icone: "alerta" as const, tom: "text-erro bg-erro-fundo", titulo: r.venceu === 1 ? "1 item do prontuário venceu" : `${r.venceu} itens do prontuário venceram` } : null,
    r.vence ? { icone: "relogio" as const, tom: "text-atencao bg-atencao-fundo", titulo: r.vence === 1 ? "1 item vence logo" : `${r.vence} itens vencem logo` } : null,
    r.falta ? { icone: "documento" as const, tom: "text-violeta-600 bg-violeta-100", titulo: r.falta === 1 ? "1 item falta no prontuário" : `${r.falta} itens faltam no prontuário` } : null,
  ].filter((x) => x !== null);
  return (
    <section aria-labelledby="t-memoria" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <CabecaCartao id="t-memoria" titulo="Memória do prédio" href="/memoria" />
      {linhas.length === 0 ? <p className="text-sm text-tinta-suave">{r.emDia} de {r.total} itens do prontuário em dia. Nada vencido nem faltando.</p> : (
        <ul className="divide-y divide-linha">
          {linhas.map((l) => (
            <li key={l.titulo} className="flex items-center gap-3 py-2.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${l.tom}`}><Icone nome={l.icone} /></span>
              <span className="min-w-0 flex-1 text-sm font-medium">{l.titulo}</span>
              <Link href="/memoria" className={classeBotao("contorno", "", "m")} aria-label={`Ver: ${l.titulo}`}>Ver</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

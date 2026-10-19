"use client";
// O cartão Vida em condomínio no início (design "Vida em condomínio", tela 10; AC-01): só aparece
// quando há algo a fazer, como reservas esperando aprovação.

import Link from "next/link";
import { classeBotao, Icone } from "@triade/ui";
import type { ResumoVida } from "../tipos.ts";
import { diaCurto } from "./comum.tsx";

export function CartaoVida({ resumo: r }: { resumo: ResumoVida }) {
  return (
    <section aria-labelledby="t-vida" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-vida" className="flex items-center justify-between text-lg font-medium">
        Vida em condomínio
        <Link href="/vida" className="text-sm font-medium underline underline-offset-4">Abrir</Link>
      </h2>
      <ul className="divide-y divide-linha">
        <li className="flex items-center gap-3 py-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-atencao-fundo text-atencao"><Icone nome="calendario" /></span>
          <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <span className="font-medium">{r.reservasAAprovar === 1 ? "1 reserva a aprovar" : `${r.reservasAAprovar} reservas a aprovar`}</span>
            {r.proximasAAprovar.map((p) => (
              <span key={`${p.data}-${p.area}`} className="text-tinta-suave">
                {diaCurto(p.data)} · {p.area}{p.pedidos > 1 ? ` · ${p.pedidos} pedidos para o mesmo dia` : ""}
              </span>
            ))}
          </span>
          <Link href="/vida" className={classeBotao("contorno", "", "m")} aria-label="Ver as reservas a aprovar">Ver</Link>
        </li>
      </ul>
    </section>
  );
}

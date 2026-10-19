"use client";
// O cartão Vida em condomínio no início (design "Vida em condomínio", tela 10; AC-01): só aparece
// quando há algo a fazer ou acompanhar: reservas esperando aprovação, enquetes abertas (AC-03) e a
// próxima assembleia (AC-02) e anúncios a aprovar (AC-05).

import Link from "next/link";
import { classeBotao, Icone } from "@triade/ui";
import type { ResumoVida } from "../tipos.ts";
import { ESTADOS_ASSEMBLEIA, formatarDataHora, textoRespostas } from "@triade/domain";
import { diaCurto } from "./comum.tsx";
import { prazoCurto } from "./Enquetes.tsx";

export function CartaoVida({ resumo: r }: { resumo: ResumoVida }) {
  return (
    <section aria-labelledby="t-vida" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-vida" className="flex items-center justify-between text-lg font-medium">
        Vida em condomínio
        <Link href="/vida" className="text-sm font-medium underline underline-offset-4">Abrir</Link>
      </h2>
      <ul className="divide-y divide-linha">
        {r.reservasAAprovar ? <li className="flex items-center gap-3 py-2.5">
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
        </li> : null}
        {r.classificadosAAprovar ? (
          <li className="flex items-center gap-3 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-atencao-fundo text-atencao"><Icone nome="megafone" /></span>
            <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span className="font-medium">{r.classificadosAAprovar === 1 ? "1 anúncio a aprovar" : `${r.classificadosAAprovar} anúncios a aprovar`}</span>
              <span className="text-tinta-suave">Classificados entre moradores, para o mural</span>
            </span>
            <Link href="/vida?aba=classificados" className={classeBotao("contorno", "", "m")} aria-label="Ver os anúncios a aprovar">Ver</Link>
          </li>
        ) : null}
        {(r.enquetesAbertas ?? []).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-andamento-fundo text-andamento"><Icone nome="grafico" /></span>
            <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span className="font-medium">Enquete: {e.pergunta}</span>
              <span className="text-tinta-suave">{textoRespostas(e.responderam, e.total)} · fecha {prazoCurto(e.abertaAte)}</span>
            </span>
            <Link href="/vida?aba=enquetes" className={classeBotao("contorno", "", "m")} aria-label={`Ver a enquete: ${e.pergunta}`}>Ver</Link>
          </li>
        ))}
        {r.assembleia ? (
          <li className="flex items-center gap-3 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta"><Icone nome="convivio" /></span>
            <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span className="font-medium">Assembleia: {r.assembleia.titulo}</span>
              <span className="text-tinta-suave">
                {r.assembleia.estado === "EM_ANDAMENTO" ? ESTADOS_ASSEMBLEIA.EM_ANDAMENTO : `1ª chamada em ${formatarDataHora(r.assembleia.primeiraChamada)}`}
                {r.assembleia.procuracoesPendentes ? ` · ${r.assembleia.procuracoesPendentes === 1 ? "1 procuração" : `${r.assembleia.procuracoesPendentes} procurações`} a conferir` : ""}
              </span>
            </span>
            <Link href={`/vida/assembleia?id=${r.assembleia.id}`} className={classeBotao("contorno", "", "m")} aria-label={`Ver a assembleia: ${r.assembleia.titulo}`}>Ver</Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

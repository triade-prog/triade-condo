"use client";
// O cartão Manutenção no início (design "Telas da Manutenção", tela 7; MP-01, MP-03, MP-05):
// retorno vencido, preventiva atrasada e contrato perto do fim, cada um levando à lista.

import Link from "next/link";
import { mostrarDataCurta } from "@triade/domain";
import { classeBotao, Icone } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { ResumoManutencao } from "../tipos.ts";

export function CartaoManutencao({ resumo: r }: { resumo: ResumoManutencao }) {
  const linhas = [
    r.retornoVencido ? {
      icone: "relogio" as const, tom: "text-erro bg-erro-fundo", titulo: r.retornoVencido === 1 ? "1 retorno vencido" : `${r.retornoVencido} retornos vencidos`,
      detalhe: r.vencidaMaisAntiga ? `${r.vencidaMaisAntiga.titulo} · desde ${diaHora(r.vencidaMaisAntiga.desde)}` : "", href: "/manutencao?atencao=RETORNO_VENCIDO",
    } : null,
    r.preventivasAtrasadas ? {
      icone: "trocar" as const, tom: "text-atencao bg-atencao-fundo", titulo: r.preventivasAtrasadas === 1 ? "1 preventiva atrasada" : `${r.preventivasAtrasadas} preventivas atrasadas`,
      detalhe: r.atrasadaMaisAntiga ? `${r.atrasadaMaisAntiga.titulo} · era em ${mostrarDataCurta(r.atrasadaMaisAntiga.data)}` : "", href: "/manutencao?tipo=PREVENTIVA",
    } : null,
    r.contratosAVencer ? {
      icone: "documento" as const, tom: "text-violeta-600 bg-violeta-100", titulo: r.contratosAVencer === 1 ? "1 contrato vence em 60 dias" : `${r.contratosAVencer} contratos vencem em 60 dias`,
      detalhe: r.contratoMaisProximo ? `${r.contratoMaisProximo.nome} · ${mostrarDataCurta(r.contratoMaisProximo.ate)}` : "", href: "/manutencao/prestadores",
    } : null,
  ].filter((x) => x !== null);

  return (
    <section aria-labelledby="t-manutencao" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-manutencao" className="flex items-center justify-between text-lg font-medium">
        Manutenção
        <Link href="/manutencao" className="text-sm font-medium underline underline-offset-4">Ver todas</Link>
      </h2>
      {linhas.length === 0 ? (
        <p className="text-sm text-tinta-suave">{r.abertas ? `${r.abertas === 1 ? "1 manutenção aberta" : `${r.abertas} manutenções abertas`}, nada atrasado.` : "Nada aberto na manutenção."}</p>
      ) : (
        <ul className="divide-y divide-linha">
          {linhas.map((l) => (
            <li key={l.titulo} className="flex items-center gap-3 py-2.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${l.tom}`}><Icone nome={l.icone} /></span>
              <span className="grid min-w-0 flex-1 gap-0.5 text-sm"><span className="font-medium">{l.titulo}</span><span className="text-tinta-suave">{l.detalhe}</span></span>
              <Link href={l.href} className={classeBotao("contorno", "", "m")} aria-label={`Ver: ${l.titulo}`}>Ver</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";
// O cartão Comunicados e documentos no início (design "Telas dos Comunicados", tela 6; CD-06,
// MP-12): o que sai hoje, o rascunho parado e o documento perto de vencer.

import Link from "next/link";
import { descreverValidade } from "@triade/domain";
import { classeBotao, Icone } from "@triade/ui";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import type { ResumoComunicados } from "../tipos.ts";

export function CartaoComunicados({ resumo: r, verComunicados }: { resumo: ResumoComunicados; verComunicados: boolean }) {
  const linhas = [
    r.programadosHoje ? {
      icone: "relogio" as const, tom: "text-violeta-600 bg-violeta-100", titulo: r.programadosHoje === 1 ? "1 programado para hoje" : `${r.programadosHoje} programados para hoje`,
      detalhe: r.proximoProgramado ? `${r.proximoProgramado.titulo} · ${diaHora(r.proximoProgramado.em)}` : "", href: "/comunicados?atencao=PROGRAMADOS_HOJE",
    } : null,
    r.rascunhosParados ? {
      icone: "editar" as const, tom: "text-atencao bg-atencao-fundo", titulo: r.rascunhosParados === 1 ? "1 rascunho parado há mais de 3 dias" : `${r.rascunhosParados} rascunhos parados há mais de 3 dias`,
      detalhe: r.rascunhoMaisAntigo?.titulo ?? "", href: "/comunicados?atencao=RASCUNHOS_PARADOS",
    } : null,
    r.documentosVencendo ? {
      icone: "alerta" as const, tom: "text-erro bg-erro-fundo",
      titulo: r.documentoMaisProximo ? `${r.documentoMaisProximo.titulo} ${descreverValidade(r.documentoMaisProximo.valeAte, hojeEmBrasilia())}` : "Documento perto de vencer",
      detalhe: r.documentosVencendo === 1 ? "1 documento vence em até 60 dias" : `${r.documentosVencendo} documentos vencem em até 60 dias`,
      href: "/comunicados/documentos?filtro=VENCENDO",
    } : null,
  ].filter((x) => x !== null);

  return (
    <section aria-labelledby="t-comunicados" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-comunicados" className="flex items-center justify-between text-lg font-medium">
        Comunicados e documentos
        <Link href={verComunicados ? "/comunicados" : "/comunicados/documentos"} className="text-sm font-medium underline underline-offset-4">Ver todos</Link>
      </h2>
      {linhas.length === 0 ? <p className="text-sm text-tinta-suave">Nada programado para hoje, nenhum rascunho parado e nenhum documento perto de vencer.</p> : (
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

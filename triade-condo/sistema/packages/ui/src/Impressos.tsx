"use client";
// Os impressos (decisão D.1 da análise das páginas por link, 23/10/2026): o mesmo topo de prévia,
// com Voltar e Imprimir, e a folha A4 como sai na impressão. Na tela a folha diminui para caber;
// na impressão sai no tamanho de verdade, sem o topo.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Botao } from "./componentes.tsx";
import { Icone } from "./Icone.tsx";

/** A folha A4 tem 21 cm, que na tela são 794 px. */
const LARGURA_A4 = 794;

export function PreviaImpressao({ titulo, apoio, voltar, opcoes, podeImprimir = true, aviso, legenda, nota, children }: {
  titulo: string; apoio: string; voltar: string; opcoes?: ReactNode; podeImprimir?: boolean;
  aviso?: ReactNode; legenda?: string; nota?: string; children: ReactNode;
}) {
  // Aberta numa aba nova, Voltar fecha a aba; senão volta à página de antes ou vai ao endereço.
  function sair(ev: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) { ev.preventDefault(); window.history.back(); return; }
    if (window.opener) { ev.preventDefault(); window.close(); }
  }
  return (
    <div className="min-h-dvh bg-superficie-2 print:bg-white">
      <header className="flex flex-col gap-3 border-b border-linha bg-superficie px-4 py-3.5 md:flex-row md:items-center md:gap-6 md:px-10 md:py-4 print:hidden">
        <a href={voltar} onClick={sair} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-violeta-600 hover:underline md:self-center">
          <Icone nome="esq" className="h-4 w-4" />Voltar
        </a>
        <span className="hidden h-8 w-px bg-linha md:block" aria-hidden="true" />
        <span className="grid flex-1 gap-0.5">
          <span className="text-xs font-semibold tracking-[.1em] text-tinta-suave uppercase">Prévia para imprimir</span>
          <h1 className="text-xl font-semibold">{titulo}</h1>
          <span className="t-apoio">{apoio}</span>
        </span>
        {opcoes}
        {podeImprimir ? <Botao className="max-md:w-full" onClick={() => window.print()}><Icone nome="imprimir" />Imprimir</Botao> : null}
      </header>
      <main className="flex flex-col items-center gap-3 p-4 md:p-8 print:block print:p-0">
        {aviso ? <div className="w-full max-w-[794px] print:hidden">{aviso}</div> : null}
        {legenda ? <p className="t-apoio print:hidden">{legenda}</p> : null}
        {children}
        {nota ? <p className="t-apoio max-w-[794px] text-center print:hidden">{nota}</p> : null}
      </main>
    </div>
  );
}

/** Uma folha A4 em pé. Na tela, encolhe para caber na largura. */
export function FolhaA4({ rotulo, className = "", children }: { rotulo?: string; className?: string; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = caixa.current?.parentElement;
    if (!el) return;
    const medir = () => {
      const estilo = getComputedStyle(el);
      const livre = el.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      setEscala(Math.min(1, livre / LARGURA_A4));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={caixa} style={{ width: LARGURA_A4 * escala, height: LARGURA_A4 * escala * (297 / 210) }} className="folha-caixa shrink-0 print:h-auto! print:w-auto!">
      <section aria-label={rotulo} style={{ transform: `scale(${escala})` }}
        className={`folha-a4 flex h-[29.7cm] w-[21cm] origin-top-left flex-col overflow-hidden border border-linha bg-white shadow-s2 print:transform-none! print:border-0 print:shadow-none ${className}`}>
        {children}
      </section>
    </div>
  );
}

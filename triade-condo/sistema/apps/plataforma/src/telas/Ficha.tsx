"use client";
// Peças da ficha (DC15, telas-modelo pedido-ficha-* e manutencao-ficha-*): o cartão com título e
// ícone num quadrado, a linha de dados com a ação à direita e o menu "Mais ações", que fecha com
// Esc ou clicando fora. A ficha do pedido e a da manutenção usam as mesmas.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Botao, Icone, type NomeIcone } from "@triade/ui";

/** Cartão da ficha: título com ícone num quadrado e, à direita, a ação do cartão. */
export function Cartao({ id, titulo, icone, acao, children, rotulo, className = "" }: {
  id: string; titulo: ReactNode; icone: NomeIcone; acao?: ReactNode; children: ReactNode; rotulo?: string; className?: string;
}) {
  return (
    <section aria-labelledby={rotulo ? undefined : id} aria-label={rotulo} className={`grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="t-titulo-cartao flex items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Uma linha de Dados do pedido: ícone, nome, valor e, à direita, a ação. */
export function Dado({ icone, nome, children, acao, regiao }: { icone: NomeIcone; nome: string; children: ReactNode; acao?: ReactNode; regiao?: boolean }) {
  const conteudo = (
    <>
      <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
      <span className="text-tinta-suave max-md:text-[13px] md:w-40 md:shrink-0">{nome}</span>
      <span className="min-w-0 flex-1 max-md:basis-full max-md:pl-11">{children}</span>
      {acao ? <span className="shrink-0">{acao}</span> : null}
    </>
  );
  const classe = "flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-linha py-3 first:border-t-0";
  return regiao ? <section aria-label={nome} className={classe}>{conteudo}</section> : <div className={classe}>{conteudo}</div>;
}

/** Mais ações: o que a pessoa pode fazer além das três de sempre. Fecha com Esc ou clicando fora. */
export function MaisAcoes({ itens }: { itens: { texto: string; icone: NomeIcone; acao: () => void; perigo?: boolean }[] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  if (!itens.length) return null;
  return (
    <div ref={caixa} className="relative">
      <button type="button" className="emblema" aria-label="Mais ações" aria-expanded={aberto} onClick={() => setAberto(!aberto)}><Icone nome="pontos" /></button>
      {aberto ? (
        <div className="menu-pessoa" role="group" aria-label="Mais ações">
          {itens.map((x) => (
            <Botao key={x.texto} variante="discreto" className={x.perigo ? "text-erro" : ""} onClick={() => { setAberto(false); x.acao(); }}>
              <Icone nome={x.icone} />{x.texto}
            </Botao>
          ))}
        </div>
      ) : null}
    </div>
  );
}

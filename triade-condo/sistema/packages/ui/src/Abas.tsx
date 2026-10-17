"use client";
// Abas acessíveis (padrão WAI-ARIA): setas, Home e End trocam de aba; só a aba atual entra
// na ordem do Tab.

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Aba<T extends string> {
  id: T;
  texto: string;
}

export function Abas<T extends string>({ abas, atual, aoMudar, rotulo, children }: {
  abas: readonly Aba<T>[];
  atual: T;
  aoMudar: (id: T) => void;
  rotulo: string;
  children: ReactNode;
}) {
  const botoes = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  function teclas(ev: KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === atual);
    const n = abas.length;
    const proxima = ev.key === "ArrowRight" ? (i + 1) % n : ev.key === "ArrowLeft" ? (i - 1 + n) % n
      : ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : -1;
    if (proxima < 0) return;
    ev.preventDefault();
    aoMudar(abas[proxima]!.id);
    botoes.current[abas[proxima]!.id]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label={rotulo} className="flex gap-6 overflow-x-auto border-b border-linha" onKeyDown={teclas}>
        {abas.map((a) => (
          <button
            key={a.id}
            ref={(el) => { botoes.current[a.id] = el; }}
            id={`aba-${a.id}`}
            role="tab"
            type="button"
            aria-selected={atual === a.id}
            aria-controls={`painel-${a.id}`}
            tabIndex={atual === a.id ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            className="-mb-px min-h-11 border-b-2 border-transparent px-0.5 text-sm font-medium whitespace-nowrap text-tinta-suave hover:text-tinta aria-selected:border-violeta-600 aria-selected:text-violeta-600"
          >
            {a.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${atual}`} aria-labelledby={`aba-${atual}`} tabIndex={0}>
        {children}
      </div>
    </>
  );
}

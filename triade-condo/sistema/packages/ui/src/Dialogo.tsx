"use client";
// Janela sobre a tela, com o <dialog> nativo: foco preso dentro, Esc fecha e o resto da
// página fica inerte enquanto ela está aberta.

import { useEffect, useRef, type ReactNode } from "react";

export function Dialogo({ aberto, titulo, aoFechar, children }: { aberto: boolean; titulo: string; aoFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = `dialogo-${titulo.replace(/\W+/g, "-").toLowerCase()}`;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-linha bg-superficie p-5 text-tinta shadow-xl backdrop:bg-tinta/40"
    >
      {aberto ? (
        <div className="grid gap-4">
          <h2 id={idTitulo} className="text-base font-semibold">{titulo}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

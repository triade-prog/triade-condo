"use client";
// Janela sobre a tela, com o <dialog> nativo: foco preso dentro, Esc fecha e o resto da
// página fica inerte enquanto ela está aberta. No celular ela sobe de baixo, na largura toda (DC15).

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
      className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[24px] border border-linha bg-superficie p-6 text-tinta shadow-s3 max-md:mb-0 max-md:w-full max-md:max-w-full max-md:rounded-b-none backdrop:bg-violeta-900/35 backdrop:backdrop-blur-[2px]"
    >
      {aberto ? (
        <div className="grid gap-4">
          <h2 id={idTitulo} className="t-titulo-secao">{titulo}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

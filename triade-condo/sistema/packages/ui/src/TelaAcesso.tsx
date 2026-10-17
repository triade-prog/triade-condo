import type { ReactNode } from "react";
import { Marca } from "./Marca.tsx";

// Telas de acesso (entrar, convite, nova senha): a arte da marca de um lado e o formulário do
// outro (telas-modelo, DC13). No celular, a arte vira uma faixa no alto. A arte de fundo só
// aparece aqui, no início, nas telas vazias e na prioridade.
export function TelaAcesso({ sistema, frase, children }: { sistema: string; frase: string; children: ReactNode }) {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-3xl border border-linha bg-superficie shadow-s3 md:grid-cols-[1.05fr_1fr]">
        <div aria-hidden="true" className="relative flex min-h-44 flex-col justify-end overflow-hidden bg-[image:var(--grad-violeta)] p-6 text-white md:min-h-[540px] md:p-9">
          <span className="absolute -top-28 -right-24 h-[340px] w-[340px] rounded-full border border-white/20" />
          <span className="absolute -top-48 -right-48 h-[520px] w-[520px] rounded-full border border-white/15" />
          <span className="absolute top-8 right-16 h-72 w-36 rotate-[26deg] rounded-t-full border border-violeta-200/30 bg-[linear-gradient(170deg,#c27bff33,#7a2be026_55%,#5808cc00)]" />
          <span className="absolute top-14 right-10 h-56 w-8 rotate-[26deg] rounded-full bg-[image:var(--grad-trilha)] shadow-[inset_0_2px_0_#ffffff55]" />
          <p className="relative text-3xl leading-tight font-light tracking-tight md:text-[40px]">
            Bom ter você <em className="font-[family-name:var(--font-destaque)] font-normal text-laranja-200 italic">aqui</em>
          </p>
          <p className="relative mt-2 max-w-xs text-violeta-100">{frase}</p>
        </div>
        <div className="grid content-center gap-6 p-6 md:p-12">
          <Marca sistema={sistema} />
          {children}
        </div>
      </div>
    </main>
  );
}

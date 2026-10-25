import type { ReactNode } from "react";
import { Marca } from "./Marca.tsx";

// Telas de acesso (entrar, convite, nova senha): a foto dos prédios ao entardecer de um lado e o
// formulário do outro. No celular, a foto vira uma faixa no alto. O arquivo fica em
// public/marca/entrada-predios.webp de cada aplicação (1034 × 1192); a parte de baixo da foto é
// violeta liso, e o degradê por cima garante a leitura do título e da frase.
export const FOTO_ENTRADA = { src: "/marca/entrada-predios.webp", largura: 1034, altura: 1192 } as const;

export function TelaAcesso({ sistema, frase, children }: { sistema: string; frase: string; children: ReactNode }) {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-3xl border border-linha bg-superficie shadow-s3 md:grid-cols-[1.05fr_1fr]">
        <div aria-hidden="true" className="relative flex min-h-72 flex-col justify-end overflow-hidden bg-violeta-900 p-6 text-white md:min-h-[540px] md:p-9">
          {/* eslint-disable-next-line @next/next/no-img-element -- pacote compartilhado, sem next/image */}
          <img src={FOTO_ENTRADA.src} width={FOTO_ENTRADA.largura} height={FOTO_ENTRADA.altura} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[50%_12%] md:object-top" />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgb(24_5_103/.75)_58%,rgb(24_5_103/.94)_100%)] md:bg-[linear-gradient(180deg,transparent_55%,rgb(24_5_103/.6)_78%,rgb(24_5_103/.85)_100%)]" />
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

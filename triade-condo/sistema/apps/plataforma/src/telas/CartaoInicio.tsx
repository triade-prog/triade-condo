"use client";
// Cartão do Início no padrão novo (DC15, tela-modelo inicio-computador e inicio-celular; V-08,
// PT-10): ladrilho com o ícone, o título e, no canto, o mesmo "Ver tudo" em todo cartão. Cada
// linha tem o ladrilho na cor do que pede, o texto, um selo quando ajuda e um botão de contorno
// que leva até onde se resolve. Os cartões "Por área" fecham no celular numa linha curta com o
// resumo e o número do que pede atenção; um toque abre o cartão ali mesmo.

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { classeBotao, Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { useCelular } from "./celular.ts";

export interface LinhaInicio {
  chave?: string;
  icone: NomeIcone;
  tom: Tom | "violeta";
  titulo: ReactNode;
  detalhe?: ReactNode;
  selo?: { texto: string; tom: Tom };
  href?: string;
  botao?: string;
  iconeBotao?: NomeIcone;
  /** Nome do botão para leitor de tela, quando "Ver" sozinho não diz o quê. */
  rotuloBotao?: string;
  /** O que fica no lugar do botão (por exemplo, um botão que abre uma janela). */
  acao?: ReactNode;
}

export function LinhasInicio({ linhas }: { linhas: LinhaInicio[] }) {
  return (
    <ul className="divide-y divide-linha">
      {linhas.map((l, i) => (
        <li key={l.chave ?? (typeof l.titulo === "string" ? l.titulo : i)} className="flex items-center gap-3 py-3">
          <span className="ladrilho" data-tom={l.tom} aria-hidden="true"><Icone nome={l.icone} /></span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-medium">{l.titulo}</span>
            {l.detalhe ? <span className="t-apoio">{l.detalhe}</span> : null}
          </span>
          {l.selo ? <span className="max-sm:hidden"><Selo tom={l.selo.tom}>{l.selo.texto}</Selo></span> : null}
          {l.acao ?? (l.href ? (
            <Link href={l.href} className={classeBotao("contorno", "shrink-0", "m")} aria-label={l.rotuloBotao}>
              {l.iconeBotao ? <Icone nome={l.iconeBotao} /> : null}{l.botao ?? "Ver"}
            </Link>
          ) : null)}
        </li>
      ))}
    </ul>
  );
}

/** Resumo do cartão fechado no celular: os títulos das linhas, em uma linha só. */
export function resumoDasLinhas(linhas: LinhaInicio[]): string {
  return linhas.map((l) => (typeof l.titulo === "string" ? l.titulo : "")).filter(Boolean).join(" · ");
}

export function CartaoInicio({ titulo, icone, href, rotulo = "Ver tudo", area, className = "", children }: {
  titulo: string;
  icone: NomeIcone;
  href?: string;
  rotulo?: string;
  /** Cartão "Por área": no celular fecha numa linha com o resumo e o número do que pede atenção. */
  area?: { resumo: string; quantos?: number; tom?: Tom };
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const celular = useCelular();
  const [aberto, setAberto] = useState(false);
  const linhaCurta = !!area && celular;
  const ver = href ? (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-violeta-600 hover:underline"
      aria-label={rotulo === "Ver tudo" ? `Ver tudo de ${titulo}` : undefined}>
      {rotulo}<Icone nome="dir" className="h-4 w-4" />
    </Link>
  ) : null;

  if (linhaCurta) {
    return (
      <section aria-label={titulo} className={`grid border-t border-linha ${className}`}>
        <div className="relative flex min-h-14 items-center gap-3 py-2.5">
          <span className="ladrilho" aria-hidden="true"><Icone nome={icone} /></span>
          <span className="grid min-w-0 flex-1">
            <h2 className="font-medium">
              <button type="button" className="text-left after:absolute after:inset-0 focus-visible:outline-0 focus-visible:after:rounded-xl focus-visible:after:shadow-[var(--anel)]"
                aria-expanded={aberto} aria-controls={`${id}-corpo`} aria-describedby={aberto ? undefined : `${id}-resumo`} onClick={() => setAberto(!aberto)}>
                {titulo}
              </button>
            </h2>
            {aberto ? null : <span id={`${id}-resumo`} className="t-apoio truncate">{area.resumo}</span>}
          </span>
          {area.quantos && !aberto ? <span className="selo min-w-6 justify-center px-2" data-tom={area.tom ?? "atencao"} aria-hidden="true">{area.quantos}</span> : null}
          <Icone nome={aberto ? "baixo" : "dir"} className="h-5 w-5 text-tinta-suave" />
        </div>
        {aberto ? <div id={`${id}-corpo`} className="grid gap-2 pb-3">{children}{ver}</div> : <div id={`${id}-corpo`} hidden />}
      </section>
    );
  }
  return (
    <section aria-label={titulo} className={`grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-titulo-cartao flex items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>{titulo}
        </h2>
        {ver}
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

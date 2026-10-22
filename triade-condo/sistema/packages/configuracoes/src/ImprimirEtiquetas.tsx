"use client";
// Etiquetas para imprimir (design "Links e QR", tela 4; AT-30): folha A4 com 6 etiquetas ou uma
// por folha, cada uma com o local, o QR e o código curto. A etiqueta durável e a colagem no
// prédio são um serviço à parte da TRÍADE (SH-08).

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Aviso, Botao, Carregando, ErroCarregar, Logo } from "@triade/ui";
import { QrCode } from "./QrCode.tsx";
import { enderecoPlataforma, useCarregar, naBase } from "./contexto.tsx";
import type { Etiqueta, LinksQr } from "./tipos.ts";

export const enderecoEtiqueta = (codigo: string) => enderecoPlataforma(`/l/${codigo}`);

export function ImprimirEtiquetas() {
  const busca = useSearchParams();
  const carga = useCarregar<LinksQr>(naBase("/links-qr"));
  const [grande, setGrande] = useState(busca.get("tamanho") === "1");
  if (carga.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Preparando as etiquetas…" /></main>;
  if (carga.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></main>;
  const ids = busca.get("ids")?.split(",").filter(Boolean);
  const etiquetas = carga.dados.etiquetas.filter((e) => e.ativa && (!ids || ids.includes(e.id)));
  const folhas: Etiqueta[][] = [];
  const porFolha = grande ? 1 : 6;
  for (let i = 0; i < etiquetas.length; i += porFolha) folhas.push(etiquetas.slice(i, i + porFolha));

  return (
    <main className="mx-auto grid max-w-[21cm] gap-6 bg-superficie p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="grid gap-2">
          <p className="text-sm text-tinta-suave">
            {etiquetas.length === 1 ? "1 etiqueta" : `${etiquetas.length} etiquetas`}. Imprima em folha A4 em pé e cole cada uma no local escrito nela.
          </p>
          <span className="trilho" role="group" aria-label="Tamanho">
            <button type="button" className="chip" aria-pressed={!grande} data-escolhido={!grande ? "" : undefined} onClick={() => setGrande(false)}>6 por folha</button>
            <button type="button" className="chip" aria-pressed={grande} data-escolhido={grande ? "" : undefined} onClick={() => setGrande(true)}>Uma por folha</button>
          </span>
        </div>
        <Botao onClick={() => window.print()} disabled={!etiquetas.length}>Imprimir</Botao>
      </div>
      {!etiquetas.length ? <Aviso tom="info">Nenhuma etiqueta em uso. Crie em Configurações › Etiquetas por local.</Aviso> : null}
      <p className="text-xs text-tinta-suave print:hidden">Etiqueta durável, plastificada ou em acrílico, e a colagem no prédio são um serviço à parte da TRÍADE.</p>
      {folhas.map((f, i) => (
        <section key={i} aria-label={`Folha ${i + 1}`}
          className={`grid ${grande ? "" : "grid-cols-2 gap-[0.6cm]"} justify-center ${i < folhas.length - 1 ? "break-after-page" : ""}`}>
          {f.map((e) => <EtiquetaImpressa key={e.id} e={e} grande={grande} />)}
        </section>
      ))}
    </main>
  );
}

function EtiquetaImpressa({ e, grande }: { e: Etiqueta; grande: boolean }) {
  return (
    <article className={`grid content-start justify-items-center gap-2 rounded-2xl border border-linha bg-white text-center break-inside-avoid
      ${grande ? "w-[17cm] gap-4 p-[1.2cm]" : "h-[8.6cm] w-[8.8cm] p-[0.5cm]"}`}>
      <span className="h-1.5 w-full rounded-full bg-linear-to-r from-laranja-200 to-laranja-500" aria-hidden="true" />
      <Logo className={grande ? "h-14 w-auto" : "h-7 w-auto"} />
      <span className={`font-semibold tracking-wide text-violeta-700 uppercase ${grande ? "text-xl" : "text-[11px]"}`}>Viu um problema aqui?</span>
      <h2 className={`leading-tight font-medium ${grande ? "text-[34px]" : "text-[15px]"}`}>{e.local}</h2>
      <QrCode texto={enderecoEtiqueta(e.codigo)} rotulo={`QR da etiqueta ${e.rotulo}`} className={grande ? "h-[9cm] w-[9cm]" : "h-[3.6cm] w-[3.6cm]"} />
      <p className={`text-tinta-suave ${grande ? "text-lg" : "text-[10px] leading-snug"}`}>Aponte a câmera e avise pelo WhatsApp do condomínio. O local já vai escrito.</p>
      <span className={`rounded-md bg-violeta-50 px-2 font-mono text-violeta-800 ${grande ? "text-base" : "text-[10px]"}`}>{e.rotulo}</span>
    </article>
  );
}

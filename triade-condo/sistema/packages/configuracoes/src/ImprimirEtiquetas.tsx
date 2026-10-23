"use client";
// Etiquetas para imprimir (design "Links e QR", tela 4; AT-30): folha A4 com 6 etiquetas ou uma
// por folha, cada uma com o local, o QR e o código curto. A etiqueta durável e a colagem no
// prédio são um serviço à parte da TRÍADE (SH-08). O topo de prévia e a folha A4 são os mesmos dos
// outros impressos (decisão D.1, 23/10/2026).

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Aviso, Carregando, ErroCarregar, FolhaA4, Logo, PreviaImpressao } from "@triade/ui";
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
  const quantas = etiquetas.length === 1 ? "1 etiqueta em uso" : `${etiquetas.length} etiquetas em uso`;

  return (
    <PreviaImpressao titulo="Etiquetas para imprimir" apoio={`${quantas} · folha A4 em pé · cole cada uma no local escrito nela`} voltar="/configuracoes/etiquetas"
      podeImprimir={etiquetas.length > 0}
      opcoes={
        <span className="trilho max-md:flex" role="group" aria-label="Tamanho">
          <button type="button" className="chip max-md:flex-1" aria-pressed={!grande} data-escolhido={!grande ? "" : undefined} onClick={() => setGrande(false)}>6 por folha</button>
          <button type="button" className="chip max-md:flex-1" aria-pressed={grande} data-escolhido={grande ? "" : undefined} onClick={() => setGrande(true)}>Uma por folha</button>
        </span>
      }
      aviso={!etiquetas.length ? <Aviso tom="info">Nenhuma etiqueta em uso. Crie em Configurações › Etiquetas por local.</Aviso> : null}
      legenda={folhas.length ? `${folhas.length === 1 ? "1 folha" : `${folhas.length} folhas`} · como sai na impressão` : undefined}
      nota="Etiqueta durável, plastificada ou em acrílico, e a colagem no prédio são um serviço à parte da TRÍADE.">
      {folhas.map((f, i) => (
        <FolhaA4 key={i} rotulo={`Folha ${i + 1}`} className="p-[1cm]">
          {grande ? (
            <div className="grid flex-1 place-items-center">{f.map((e) => <EtiquetaImpressa key={e.id} e={e} grande />)}</div>
          ) : (
            <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-[0.5cm]">
              {f.map((e) => <EtiquetaImpressa key={e.id} e={e} grande={false} />)}
              {Array.from({ length: 6 - f.length }, (_, k) => <span key={`v${k}`} className="rounded-2xl border border-dashed border-linha print:border-transparent" aria-hidden="true" />)}
            </div>
          )}
        </FolhaA4>
      ))}
    </PreviaImpressao>
  );
}

function EtiquetaImpressa({ e, grande }: { e: Etiqueta; grande: boolean }) {
  return (
    <article className={`grid content-center justify-items-center rounded-2xl border border-dashed border-contorno/60 bg-white text-center break-inside-avoid
      ${grande ? "w-[17cm] gap-4 p-[1.2cm]" : "min-h-0 gap-[0.2cm] p-[0.4cm]"}`}>
      <span className="h-1.5 w-full rounded-full bg-linear-to-r from-laranja-200 to-laranja-500" aria-hidden="true" />
      <Logo className={grande ? "h-14 w-auto" : "h-7 w-auto"} />
      <span className={`font-bold tracking-wide text-violeta-600 uppercase ${grande ? "text-xl" : "text-[11px]"}`}>Viu um problema aqui?</span>
      <h2 className={`leading-tight font-semibold ${grande ? "text-[34px]" : "text-[15px]"}`}>{e.local}</h2>
      <QrCode texto={enderecoEtiqueta(e.codigo)} rotulo={`QR da etiqueta ${e.rotulo}`} className={grande ? "h-[9cm] w-[9cm]" : "h-[3.4cm] w-[3.4cm]"} />
      <p className={`text-tinta-suave ${grande ? "text-lg" : "text-[10px] leading-snug"}`}>Aponte a câmera e avise pelo WhatsApp do condomínio. O local já vai escrito.</p>
      <span className={`rounded-md bg-violeta-50 px-2 font-mono font-semibold text-violeta-700 ${grande ? "text-base" : "text-[10px]"}`}>{e.rotulo}</span>
    </article>
  );
}

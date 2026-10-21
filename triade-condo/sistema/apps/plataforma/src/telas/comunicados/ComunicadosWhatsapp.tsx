"use client";
// Cartaz dos comunicados pelo WhatsApp (design "Comunicado pelo WhatsApp", tela 4; CD-11, W-20):
// o QR abre o WhatsApp do condomínio com COMUNICADOS. O cartão que liga e desliga fica nas
// Configurações (@triade/configuracoes).

import { Aviso, Botao, Carregando, ErroCarregar, Marca } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ComunicadosWhatsapp } from "../tipos.ts";
import { QrCode } from "./QrCode.tsx";

const ENDERECO = "/v1/condominio/whatsapp/comunicados";

/** O link que abre a conversa com o condomínio já com a palavra COMUNICADOS. */
export const linkComunicadosWhatsapp = (numero: string) => `https://wa.me/${numero}?text=COMUNICADOS`;

/** Cartaz para o elevador e o hall: o QR abre o WhatsApp do condomínio com COMUNICADOS. */
export function CartazComunicadosWhatsapp() {
  const carga = useCarregar<ComunicadosWhatsapp>(ENDERECO);
  const cond = useCarregar<{ nome: string }>("/v1/condominio");
  if (carga.estado === "carregando" || cond.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Preparando o cartaz…" /></main>;
  if (carga.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></main>;
  const d = carga.dados;
  const link = d.numero ? linkComunicadosWhatsapp(d.numero) : null;
  const nome = cond.estado === "pronto" ? cond.dados.nome : "condomínio";
  return (
    <main className="mx-auto grid max-w-[21cm] gap-6 bg-superficie p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-tinta-suave">Imprima em folha A4 em pé e cole no elevador e no hall.</p>
        <Botao onClick={() => window.print()} disabled={!link || !d.ligado}>Imprimir</Botao>
      </div>
      {!d.ligado ? <Aviso tom="atencao" className="print:hidden">Os comunicados pelo WhatsApp estão desligados. Ligue em Configurações › WhatsApp antes de imprimir.</Aviso> : null}
      {link ? (
        <section className="grid justify-items-center gap-5 rounded-2xl border border-linha p-10 text-center print:border-0">
          <Marca sistema="Comunicados" />
          <h1 className="text-[34px] leading-tight font-semibold">Receba os comunicados do {nome} no WhatsApp</h1>
          <QrCode texto={link} rotulo="QR para receber os comunicados pelo WhatsApp" className="h-72 w-72" />
          <p className="max-w-md text-lg">Aponte a câmera do celular e envie a mensagem que aparece: COMUNICADOS. Vale para quem está no cadastro do condomínio.</p>
          <p className="max-w-md text-base">Para parar, mande PARAR COMUNICADOS.</p>
        </section>
      ) : <Aviso tom="info">O cartaz aparece quando o condomínio tiver um número de WhatsApp.</Aviso>}
    </main>
  );
}

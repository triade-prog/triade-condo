"use client";
// Cartaz dos comunicados pelo WhatsApp (design "Comunicado pelo WhatsApp", tela 4; CD-11, W-20):
// o QR abre o WhatsApp do condomínio com COMUNICADOS. O cartão que liga e desliga fica nas
// Configurações (@triade/configuracoes).

import Link from "next/link";
import { Aviso, Carregando, classeBotao, ErroCarregar, FolhaA4, Icone, Logo, PreviaImpressao } from "@triade/ui";
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
    <PreviaImpressao titulo="Cartaz do WhatsApp" apoio="Folha A4 em pé · cole no elevador e no hall" voltar="/configuracoes/comunicados" podeImprimir={Boolean(link && d.ligado)}
      aviso={!d.ligado ? (
        <Aviso tom="atencao" titulo="Os comunicados pelo WhatsApp estão desligados">
          O cartaz convida os moradores a receber pelo WhatsApp. Ligue antes de imprimir.
          <span className="mt-2 block"><Link href="/configuracoes/comunicados" className={classeBotao("contorno", "", "m")}><Icone nome="ajuste" />Ir para Configurações › Comunicados</Link></span>
        </Aviso>
      ) : !link ? <Aviso tom="info">O cartaz aparece quando o condomínio tiver um número de WhatsApp.</Aviso> : null}
      legenda={link && d.ligado ? "Como sai na impressão" : undefined}>
      {link ? (
        <FolhaA4 rotulo="Cartaz do WhatsApp" className="p-[1cm]">
          <div className="flex flex-1 flex-col items-center justify-center gap-7 rounded-[18px] border border-linha p-[1.4cm] text-center">
            <span className="grid justify-items-center gap-1">
              <Logo className="h-12 w-auto" />
              <small className="text-[11px] font-semibold tracking-[.16em] text-tinta-suave uppercase">Comunicados</small>
            </span>
            <h2 className="text-[40px] leading-tight font-medium">Receba os comunicados do {nome} no WhatsApp</h2>
            <QrCode texto={link} rotulo="QR para receber os comunicados pelo WhatsApp" className="h-[7cm] w-[7cm]" />
            <p className="max-w-[14cm] text-[21px] leading-normal">Aponte a câmera do celular e envie a mensagem que aparece: COMUNICADOS. Vale para quem está no cadastro do condomínio.</p>
            <p className="text-lg text-tinta-suave">Para parar, mande PARAR COMUNICADOS.</p>
          </div>
        </FolhaA4>
      ) : null}
    </PreviaImpressao>
  );
}

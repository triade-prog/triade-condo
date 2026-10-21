import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { CartazComunicadosWhatsapp } from "@/telas/comunicados/ComunicadosWhatsapp";

export const metadata: Metadata = { title: "Cartaz dos comunicados pelo WhatsApp" };

// Fora da moldura do painel: a folha sai limpa na impressão.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <CartazComunicadosWhatsapp />
    </Suspense>
  );
}

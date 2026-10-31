import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ComunicadoDoLink } from "@/telas/publico/Links";
import { ComEncerramento } from "@/telas/publico/comum";

export const metadata: Metadata = { title: { absolute: "Comunicado do condomínio" } };

// Link do e-mail, sem conta (CD-13, CD-14): fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ComEncerramento rotulo="Comunicado">
        <ComunicadoDoLink />
      </ComEncerramento>
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { DocumentoDoLink } from "@/telas/publico/Links";

export const metadata: Metadata = { title: { absolute: "Documento do condomínio" } };

// Link do e-mail, sem conta (CD-13, CD-14): fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <DocumentoDoLink />
    </Suspense>
  );
}

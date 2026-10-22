import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { DocumentosEMemoria } from "@/telas/documentos/DocumentosEMemoria";

export const metadata: Metadata = { title: "Documentos · Documentos e memória" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <DocumentosEMemoria parte="documentos" />
    </Suspense>
  );
}

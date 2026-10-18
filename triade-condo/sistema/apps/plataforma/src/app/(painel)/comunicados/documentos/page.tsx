import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Documentos } from "@/telas/comunicados/Documentos";

export const metadata: Metadata = { title: "Documentos" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Documentos />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ImprimirEtiquetas } from "@/telas/config/ImprimirEtiquetas";

export const metadata: Metadata = { title: "Etiquetas para imprimir" };

// Fora da moldura do painel: a folha sai limpa na impressão.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ImprimirEtiquetas />
    </Suspense>
  );
}

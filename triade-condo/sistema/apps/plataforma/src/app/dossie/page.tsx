import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { DossieImpresso } from "@/telas/memoria/DossieImpresso";

export const metadata: Metadata = { title: "Dossiê de passagem de bastão" };

// Fora da moldura do painel: a folha sai limpa na impressão.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <DossieImpresso />
    </Suspense>
  );
}

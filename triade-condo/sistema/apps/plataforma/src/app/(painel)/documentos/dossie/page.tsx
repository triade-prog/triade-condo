import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { DossieNoPainel } from "@/telas/memoria/DossieImpresso";

export const metadata: Metadata = { title: "Dossiê de passagem de bastão" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <DossieNoPainel />
    </Suspense>
  );
}

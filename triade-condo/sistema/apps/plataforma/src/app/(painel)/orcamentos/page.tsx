import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Orcamentos } from "@/telas/orcamentos/Orcamentos";

export const metadata: Metadata = { title: "Orçamentos" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Orcamentos />
    </Suspense>
  );
}

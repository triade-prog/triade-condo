import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { FichaOrcamento } from "@/telas/orcamentos/Orcamento";

export const metadata: Metadata = { title: "Orçamento" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaOrcamento />
    </Suspense>
  );
}

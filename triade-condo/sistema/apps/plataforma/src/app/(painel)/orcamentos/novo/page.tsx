import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { NovoOrcamento } from "@/telas/orcamentos/NovoOrcamento";

export const metadata: Metadata = { title: "Novo orçamento" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <NovoOrcamento />
    </Suspense>
  );
}

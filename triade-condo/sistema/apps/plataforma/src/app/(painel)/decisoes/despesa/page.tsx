import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { FichaDespesa } from "@/telas/decisoes/Despesa";

export const metadata: Metadata = { title: "Despesa" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaDespesa />
    </Suspense>
  );
}

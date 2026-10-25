import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { TabelaPrecos } from "@/telas/planos/TabelaPrecos";

export const metadata: Metadata = { title: "Tabela de preços" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <TabelaPrecos />
    </Suspense>
  );
}

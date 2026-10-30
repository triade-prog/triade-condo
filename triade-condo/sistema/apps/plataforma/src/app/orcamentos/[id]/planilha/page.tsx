import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Planilha } from "@/telas/orcamentos/Planilha";

export const metadata: Metadata = { title: "Planilha comparativa" };

// Fora da moldura do painel: a folha sai limpa na impressão (R8, quadro 483).
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Planilha />
    </Suspense>
  );
}

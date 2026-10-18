import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Mural } from "@/telas/comunicados/Mural";

export const metadata: Metadata = { title: "Comunicado para o mural" };

// Fora da moldura do painel: a folha sai limpa na impressão.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Mural />
    </Suspense>
  );
}

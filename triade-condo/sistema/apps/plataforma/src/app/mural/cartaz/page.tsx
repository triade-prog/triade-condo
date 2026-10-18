import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Cartaz } from "@/telas/comunicados/Cartaz";

export const metadata: Metadata = { title: "Cartaz do mural" };

// Fora da moldura do painel: a folha sai limpa na impressão.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Cartaz />
    </Suspense>
  );
}

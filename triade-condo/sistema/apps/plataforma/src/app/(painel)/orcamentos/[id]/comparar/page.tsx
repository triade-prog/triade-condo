import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Comparar } from "@/telas/orcamentos/Comparar";

export const metadata: Metadata = { title: "Comparar propostas" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Comparar />
    </Suspense>
  );
}

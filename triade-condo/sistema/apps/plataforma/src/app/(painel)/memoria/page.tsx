import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Memoria } from "@/telas/memoria/Memoria";

export const metadata: Metadata = { title: "Memória do prédio" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Memoria />
    </Suspense>
  );
}

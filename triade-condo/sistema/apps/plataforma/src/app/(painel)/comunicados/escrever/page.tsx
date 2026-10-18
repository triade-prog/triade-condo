import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Escrever } from "@/telas/comunicados/Escrever";

export const metadata: Metadata = { title: "Escrever comunicado" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Escrever />
    </Suspense>
  );
}

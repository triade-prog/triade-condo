import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Comunicados } from "@/telas/comunicados/Comunicados";

export const metadata: Metadata = { title: "Comunicados" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Comunicados />
    </Suspense>
  );
}

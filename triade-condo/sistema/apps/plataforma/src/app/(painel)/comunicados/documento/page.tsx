import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Documento } from "@/telas/comunicados/Documento";

export const metadata: Metadata = { title: "Documento" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Documento />
    </Suspense>
  );
}

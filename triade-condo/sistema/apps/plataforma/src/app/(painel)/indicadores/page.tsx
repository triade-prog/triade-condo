import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Indicadores } from "@/telas/Indicadores";

export const metadata: Metadata = { title: "Indicadores" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Indicadores />
    </Suspense>
  );
}

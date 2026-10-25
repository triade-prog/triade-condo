import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ModelosComercial } from "@/telas/comercial/Modelos";

export const metadata: Metadata = { title: "Modelos do Comercial" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ModelosComercial />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Assembleia } from "@/telas/publico/Assembleia";

export const metadata: Metadata = { title: { absolute: "Assembleia do condomínio" } };

// Link pessoal da assembleia (AC-02): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Assembleia />
    </Suspense>
  );
}

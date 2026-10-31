import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Enquete } from "@/telas/publico/Enquete";
import { ComEncerramento } from "@/telas/publico/comum";

export const metadata: Metadata = { title: { absolute: "Enquete do condomínio" } };

// Link pessoal da enquete (AC-03): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ComEncerramento rotulo="Enquete">
        <Enquete />
      </ComEncerramento>
    </Suspense>
  );
}

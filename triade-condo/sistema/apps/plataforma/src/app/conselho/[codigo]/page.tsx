import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ConselhoLink } from "@/telas/publico/Conselho";
import { ComEncerramento } from "@/telas/publico/comum";

export const metadata: Metadata = { title: { absolute: "Conselho do condomínio" } };

// Link pessoal do conselheiro (R5, V-14): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ComEncerramento rotulo="Conselho">
        <ConselhoLink />
      </ComEncerramento>
    </Suspense>
  );
}

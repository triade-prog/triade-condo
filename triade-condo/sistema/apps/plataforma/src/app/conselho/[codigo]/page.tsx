import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ConselhoLink } from "@/telas/publico/Conselho";

export const metadata: Metadata = { title: { absolute: "Conselho do condomínio" } };

// Link pessoal do conselheiro (R5, V-14): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ConselhoLink />
    </Suspense>
  );
}

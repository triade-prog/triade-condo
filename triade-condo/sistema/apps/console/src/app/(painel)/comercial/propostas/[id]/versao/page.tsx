import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { VersaoNovaProposta } from "@/telas/comercial/NovaProposta";

export const metadata: Metadata = { title: "Versão da proposta" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <VersaoNovaProposta />
    </Suspense>
  );
}

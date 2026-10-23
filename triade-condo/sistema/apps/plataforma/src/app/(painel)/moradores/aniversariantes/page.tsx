import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Aniversariantes } from "@/telas/moradores/Aniversariantes";

export const metadata: Metadata = { title: "Aniversariantes" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Aniversariantes />
    </Suspense>
  );
}

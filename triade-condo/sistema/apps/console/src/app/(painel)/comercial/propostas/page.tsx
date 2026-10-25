import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Propostas } from "@/telas/comercial/Propostas";

export const metadata: Metadata = { title: "Propostas" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Propostas />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Busca } from "@/telas/Busca";

export const metadata: Metadata = { title: "Buscar" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Busca />
    </Suspense>
  );
}

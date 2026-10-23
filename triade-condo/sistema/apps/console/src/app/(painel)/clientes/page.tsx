import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Carteira } from "@/telas/Carteira";

export const metadata: Metadata = { title: "Carteira de clientes" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Carteira />
    </Suspense>
  );
}

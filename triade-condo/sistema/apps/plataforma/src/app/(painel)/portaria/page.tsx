import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Encomendas } from "@/telas/portaria/Encomendas";

export const metadata: Metadata = { title: "Portaria" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Encomendas />
    </Suspense>
  );
}

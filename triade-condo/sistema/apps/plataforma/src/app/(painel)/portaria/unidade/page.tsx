import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { UnidadePortaria } from "@/telas/portaria/UnidadePortaria";

export const metadata: Metadata = { title: "Unidade · Portaria" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <UnidadePortaria />
    </Suspense>
  );
}

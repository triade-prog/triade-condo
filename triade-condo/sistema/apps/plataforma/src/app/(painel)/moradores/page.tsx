import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Moradores } from "@/telas/moradores/Moradores";

export const metadata: Metadata = { title: "Moradores e unidades" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Moradores />
    </Suspense>
  );
}

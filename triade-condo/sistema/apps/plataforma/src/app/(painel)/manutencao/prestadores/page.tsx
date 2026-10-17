import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Prestadores } from "@/telas/manutencao/Prestadores";

export const metadata: Metadata = { title: "Prestadores" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Prestadores />
    </Suspense>
  );
}

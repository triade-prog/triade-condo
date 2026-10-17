import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Prestador } from "@/telas/manutencao/Prestador";

export const metadata: Metadata = { title: "Prestador" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Prestador />
    </Suspense>
  );
}

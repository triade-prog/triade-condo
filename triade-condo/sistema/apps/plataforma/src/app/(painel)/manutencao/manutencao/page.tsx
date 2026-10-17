import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Manutencao } from "@/telas/manutencao/Manutencao";

export const metadata: Metadata = { title: "Manutenção" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Manutencao />
    </Suspense>
  );
}

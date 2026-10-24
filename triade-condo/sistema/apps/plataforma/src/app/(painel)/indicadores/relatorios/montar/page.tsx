import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Montar } from "@/telas/relatorios/Montar";

export const metadata: Metadata = { title: "Montar o relatório do mês" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Montar />
    </Suspense>
  );
}

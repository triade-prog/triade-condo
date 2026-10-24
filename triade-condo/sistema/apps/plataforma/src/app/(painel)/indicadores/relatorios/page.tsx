import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Relatorios } from "@/telas/relatorios/Relatorios";

export const metadata: Metadata = { title: "Relatórios do mês" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Relatorios />
    </Suspense>
  );
}

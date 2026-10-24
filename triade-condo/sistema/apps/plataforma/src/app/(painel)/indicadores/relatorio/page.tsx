import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Relatorio } from "@/telas/relatorios/Relatorio";

export const metadata: Metadata = { title: "Relatório do mês" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Relatorio />
    </Suspense>
  );
}

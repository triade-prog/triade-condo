import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { HistoricoProntuario } from "@/telas/memoria/HistoricoProntuario";

export const metadata: Metadata = { title: "Histórico do prontuário · Documentos e memória" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <HistoricoProntuario />
    </Suspense>
  );
}

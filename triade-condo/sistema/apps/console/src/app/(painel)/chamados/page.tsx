import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Chamados } from "@/telas/suporte/Chamados";

export const metadata: Metadata = { title: "Chamados" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Chamados />
    </Suspense>
  );
}

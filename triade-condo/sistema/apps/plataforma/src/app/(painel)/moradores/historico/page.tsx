import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Historico } from "@/telas/moradores/Historico";

export const metadata: Metadata = { title: "Histórico da unidade" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Historico />
    </Suspense>
  );
}

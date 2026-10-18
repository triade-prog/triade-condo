import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Comunicado } from "@/telas/comunicados/Comunicado";

export const metadata: Metadata = { title: "Comunicado" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Comunicado />
    </Suspense>
  );
}

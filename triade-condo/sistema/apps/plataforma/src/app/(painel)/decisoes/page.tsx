import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Decisoes } from "@/telas/decisoes/Decisoes";

export const metadata: Metadata = { title: "Decisões" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Decisoes />
    </Suspense>
  );
}

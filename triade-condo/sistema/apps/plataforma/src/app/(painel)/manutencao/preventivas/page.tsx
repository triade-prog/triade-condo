import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Preventivas } from "@/telas/manutencao/Preventivas";

export const metadata: Metadata = { title: "Preventivas" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Preventivas />
    </Suspense>
  );
}

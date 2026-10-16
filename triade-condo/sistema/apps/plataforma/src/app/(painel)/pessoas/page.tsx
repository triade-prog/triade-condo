import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Pessoas } from "@/telas/pessoas/Pessoas";

export const metadata: Metadata = { title: "Pessoas e acesso" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Pessoas />
    </Suspense>
  );
}

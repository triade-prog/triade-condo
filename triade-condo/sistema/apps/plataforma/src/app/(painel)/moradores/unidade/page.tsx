import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Unidade } from "@/telas/moradores/Unidade";

export const metadata: Metadata = { title: "Unidade" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Unidade />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Painel } from "@/telas/comercial/Painel";

export const metadata: Metadata = { title: "Painel comercial" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}

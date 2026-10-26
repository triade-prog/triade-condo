import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Renovacoes } from "@/telas/comercial/Renovacoes";

export const metadata: Metadata = { title: "Renovações" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Renovacoes />
    </Suspense>
  );
}

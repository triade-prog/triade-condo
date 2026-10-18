import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Manutencoes } from "@/telas/manutencao/Manutencoes";

export const metadata: Metadata = { title: "Manutenção" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Manutencoes />
    </Suspense>
  );
}

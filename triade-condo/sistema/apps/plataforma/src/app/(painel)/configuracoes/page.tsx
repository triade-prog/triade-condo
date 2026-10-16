import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Configuracoes } from "@/telas/config/Configuracoes";

export const metadata: Metadata = { title: "Configurações" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Configuracoes />
    </Suspense>
  );
}

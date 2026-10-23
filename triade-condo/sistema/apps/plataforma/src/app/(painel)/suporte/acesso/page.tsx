import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { AcessoTriade } from "@/telas/suporte/AcessoTriade";

export const metadata: Metadata = { title: "Acesso da TRÍADE" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <AcessoTriade />
    </Suspense>
  );
}

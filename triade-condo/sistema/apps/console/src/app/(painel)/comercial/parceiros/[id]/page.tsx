import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { ExtratoParceiro } from "@/telas/comercial/ExtratoParceiro";

export const metadata: Metadata = { title: "Extrato do parceiro" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ExtratoParceiro />
    </Suspense>
  );
}

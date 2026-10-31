import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Reativar } from "@/telas/comercial/Reativar";

export const metadata: Metadata = { title: "Reativar" };

// Reativar quem voltou depois do último dia (quadro 488; R17.7c, 0318).
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Reativar />
    </Suspense>
  );
}

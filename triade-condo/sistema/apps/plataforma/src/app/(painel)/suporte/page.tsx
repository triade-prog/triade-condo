import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { AjudaSuporte } from "@/telas/suporte/AjudaSuporte";

export const metadata: Metadata = { title: "Ajuda e suporte" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <AjudaSuporte />
    </Suspense>
  );
}

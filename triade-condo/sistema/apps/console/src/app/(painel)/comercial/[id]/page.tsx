import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { FichaInteressado } from "@/telas/comercial/FichaInteressado";

export const metadata: Metadata = { title: "Ficha do interessado" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaInteressado />
    </Suspense>
  );
}

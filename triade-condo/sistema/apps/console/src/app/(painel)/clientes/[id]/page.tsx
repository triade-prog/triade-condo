import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { FichaCliente } from "@/telas/ficha/FichaCliente";

export const metadata: Metadata = { title: "Ficha do condomínio" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaCliente />
    </Suspense>
  );
}

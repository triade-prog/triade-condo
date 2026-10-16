import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Importar } from "@/telas/moradores/Importar";

export const metadata: Metadata = { title: "Importar planilha" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Importar />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Etiqueta } from "@/telas/publico/Etiqueta";

export const metadata: Metadata = { title: { absolute: "Avisar um problema" } };

// Sem conta nem senha (AT-30): fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Etiqueta />
    </Suspense>
  );
}

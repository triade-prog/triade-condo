import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Mural } from "@/telas/publico/Mural";

export const metadata: Metadata = { title: { absolute: "Mural do condomínio" } };

// Sem conta nem senha (CD-12): fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Mural />
    </Suspense>
  );
}

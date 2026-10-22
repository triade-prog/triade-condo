import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { NoMural } from "@/telas/comunicados/NoMural";

export const metadata: Metadata = { title: "No mural" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <NoMural />
    </Suspense>
  );
}

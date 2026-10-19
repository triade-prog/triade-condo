import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Vida } from "@/telas/vida/Vida";

export const metadata: Metadata = { title: "Vida em condomínio" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Vida />
    </Suspense>
  );
}

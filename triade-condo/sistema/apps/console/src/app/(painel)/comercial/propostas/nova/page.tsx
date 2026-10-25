import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { NovaProposta } from "@/telas/comercial/NovaProposta";

export const metadata: Metadata = { title: "Nova proposta" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <NovaProposta />
    </Suspense>
  );
}

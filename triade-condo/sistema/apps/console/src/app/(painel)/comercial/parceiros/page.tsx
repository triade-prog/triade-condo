import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Parceiros } from "@/telas/comercial/Parceiros";

export const metadata: Metadata = { title: "Parceiros" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Parceiros />
    </Suspense>
  );
}

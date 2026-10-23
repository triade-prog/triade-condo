import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Pessoa } from "@/telas/pessoas/Pessoa";

export const metadata: Metadata = { title: "Pessoa" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Pessoa />
    </Suspense>
  );
}

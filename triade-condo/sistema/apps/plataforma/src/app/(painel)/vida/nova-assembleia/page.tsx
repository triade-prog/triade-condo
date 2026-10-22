import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { NovaAssembleia } from "@/telas/vida/NovaAssembleia";

export const metadata: Metadata = { title: "Nova assembleia" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <NovaAssembleia />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Assembleia } from "@/telas/vida/Assembleia";

export const metadata: Metadata = { title: "Assembleia" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Assembleia />
    </Suspense>
  );
}

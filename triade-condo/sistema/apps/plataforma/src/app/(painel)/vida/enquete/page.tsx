import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Enquete } from "@/telas/vida/Enquete";

export const metadata: Metadata = { title: "Enquete" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Enquete />
    </Suspense>
  );
}

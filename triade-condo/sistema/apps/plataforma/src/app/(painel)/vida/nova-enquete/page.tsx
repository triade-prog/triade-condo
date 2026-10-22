import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { NovaEnquete } from "@/telas/vida/NovaEnquete";

export const metadata: Metadata = { title: "Nova enquete" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <NovaEnquete />
    </Suspense>
  );
}

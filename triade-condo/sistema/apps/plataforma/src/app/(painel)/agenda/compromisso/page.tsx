import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Compromisso } from "@/telas/agenda/Compromisso";

export const metadata: Metadata = { title: "Compromisso" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Compromisso />
    </Suspense>
  );
}

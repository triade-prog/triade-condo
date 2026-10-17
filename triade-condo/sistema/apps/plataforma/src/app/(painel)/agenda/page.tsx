import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Agenda } from "@/telas/agenda/Agenda";

export const metadata: Metadata = { title: "Agenda" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Agenda />
    </Suspense>
  );
}

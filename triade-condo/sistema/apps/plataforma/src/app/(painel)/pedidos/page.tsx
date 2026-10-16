import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Pedidos } from "@/telas/pedidos/Pedidos";

export const metadata: Metadata = { title: "Pedidos" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Pedidos />
    </Suspense>
  );
}

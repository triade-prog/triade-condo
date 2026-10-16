import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Pedido } from "@/telas/pedidos/Pedido";

export const metadata: Metadata = { title: "Pedido" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Pedido />
    </Suspense>
  );
}

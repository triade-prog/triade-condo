import type { Metadata } from "next";
import { PedidoSuporteAcesso } from "@/telas/suporte/PedidoSuporteAcesso";

export const metadata: Metadata = { title: "Pedido de suporte de acesso" };

export default function Pagina() {
  return <PedidoSuporteAcesso />;
}

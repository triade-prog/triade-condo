import type { Metadata } from "next";
import { Pagamentos } from "@/telas/planos/Pagamentos";

export const metadata: Metadata = { title: "Pagamentos" };

export default function Pagina() {
  return <Pagamentos />;
}

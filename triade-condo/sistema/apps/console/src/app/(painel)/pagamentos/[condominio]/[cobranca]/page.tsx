import type { Metadata } from "next";
import { Cobranca } from "@/telas/planos/Cobranca";

export const metadata: Metadata = { title: "Cobrança" };

export default function Pagina() {
  return <Cobranca />;
}

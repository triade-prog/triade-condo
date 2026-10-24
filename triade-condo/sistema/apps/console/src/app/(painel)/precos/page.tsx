import type { Metadata } from "next";
import { TabelaPrecos } from "@/telas/planos/TabelaPrecos";

export const metadata: Metadata = { title: "Tabela de preços" };

export default function Pagina() {
  return <TabelaPrecos />;
}

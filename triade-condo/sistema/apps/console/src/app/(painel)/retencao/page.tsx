import type { Metadata } from "next";
import { Retencao } from "@/telas/retencao/Retencao";

export const metadata: Metadata = { title: "Retenção de dados" };

export default function Pagina() {
  return <Retencao />;
}

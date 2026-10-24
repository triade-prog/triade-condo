import type { Metadata } from "next";
import { MeuPlano } from "@/telas/plano/MeuPlano";

export const metadata: Metadata = { title: "Meu plano · Configurações" };

export default function Pagina() {
  return <MeuPlano />;
}

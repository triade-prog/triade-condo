import type { Metadata } from "next";
import { Implantacoes } from "@/telas/suporte/Implantacoes";

export const metadata: Metadata = { title: "Implantações" };

export default function Pagina() {
  return <Implantacoes />;
}

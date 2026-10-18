import type { Metadata } from "next";
import { Chamados } from "@/telas/suporte/Chamados";

export const metadata: Metadata = { title: "Chamados" };

export default function Pagina() {
  return <Chamados />;
}

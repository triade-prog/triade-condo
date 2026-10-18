import type { Metadata } from "next";
import { ChamadoConsole } from "@/telas/suporte/ChamadoConsole";

export const metadata: Metadata = { title: "Chamado" };

export default function Pagina() {
  return <ChamadoConsole />;
}

import type { Metadata } from "next";
import { FichaCliente } from "@/telas/ficha/FichaCliente";

export const metadata: Metadata = { title: "Ficha do condomínio" };

export default function Pagina() {
  return <FichaCliente />;
}

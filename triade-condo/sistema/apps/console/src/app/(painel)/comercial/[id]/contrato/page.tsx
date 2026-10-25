import type { Metadata } from "next";
import { ContratoInteressado } from "@/telas/comercial/ContratoInteressado";

export const metadata: Metadata = { title: "Contrato" };

export default function Pagina() {
  return <ContratoInteressado />;
}

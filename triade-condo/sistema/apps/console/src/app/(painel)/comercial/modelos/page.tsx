import type { Metadata } from "next";
import { ModelosComercial } from "@/telas/comercial/Modelos";

export const metadata: Metadata = { title: "Modelos do Comercial" };

export default function Pagina() {
  return <ModelosComercial />;
}

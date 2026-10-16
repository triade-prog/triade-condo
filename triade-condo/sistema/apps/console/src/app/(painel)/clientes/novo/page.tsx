import type { Metadata } from "next";
import { NovoCondominio } from "@/telas/NovoCondominio";

export const metadata: Metadata = { title: "Cadastrar condomínio" };

export default function Pagina() {
  return <NovoCondominio />;
}

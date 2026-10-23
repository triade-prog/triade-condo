import type { Metadata } from "next";
import { ResumoConfiguracao } from "@/telas/ficha/ResumoConfiguracao";

export const metadata: Metadata = { title: "Resumo da configuração" };

export default function Pagina() {
  return <ResumoConfiguracao />;
}

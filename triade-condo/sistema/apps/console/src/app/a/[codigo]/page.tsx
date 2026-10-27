import type { Metadata } from "next";
import { AgendarDemonstracao } from "@/telas/comercial/AgendarDemonstracao";

// Link de agendamento da demonstração (CM-23, quadro 340): sem conta e fora da moldura do Console.
// Não entra em busca e não manda o endereço (com o código) para outros sites.
export const metadata: Metadata = {
  title: { absolute: "Agendar demonstração · TRÍADE Condo" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Pagina() {
  return <AgendarDemonstracao />;
}

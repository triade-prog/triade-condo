import type { Metadata } from "next";
import { LinkProposta } from "@/telas/comercial/LinkProposta";

// Link da proposta para o síndico (CM-07, E.1): sem conta e fora da moldura do Console. Não entra
// em busca e não manda o endereço (com o código) para outros sites.
export const metadata: Metadata = {
  title: { absolute: "Proposta comercial · TRÍADE Condo" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Pagina() {
  return <LinkProposta />;
}

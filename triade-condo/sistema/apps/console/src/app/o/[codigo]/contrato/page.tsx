import type { Metadata } from "next";
import { LinkContrato } from "@/telas/comercial/LinkContrato";

// O contrato pelo link da proposta, depois do aceite (quadro 441, CM-13): sem conta e fora da
// moldura do Console. Não entra em busca e não manda o endereço (com o código) para outros sites.
export const metadata: Metadata = {
  title: { absolute: "Contrato para assinar · TRÍADE Condo" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Pagina() {
  return <LinkContrato />;
}

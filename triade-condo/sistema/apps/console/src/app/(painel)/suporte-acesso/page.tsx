import type { Metadata } from "next";
import { SuporteAcesso } from "@/telas/suporte/SuporteAcesso";

export const metadata: Metadata = { title: "Suporte de acesso" };

export default function Pagina() {
  return <SuporteAcesso />;
}

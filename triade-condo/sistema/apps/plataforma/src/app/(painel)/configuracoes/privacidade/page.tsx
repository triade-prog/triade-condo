import type { Metadata } from "next";
import { Privacidade } from "@/telas/privacidade/Privacidade";

export const metadata: Metadata = { title: "Privacidade e dados · Configurações" };

export default function Pagina() {
  return <Privacidade />;
}

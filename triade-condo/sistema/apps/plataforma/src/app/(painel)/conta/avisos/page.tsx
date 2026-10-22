import type { Metadata } from "next";
import { MeusAvisos } from "@/telas/config/Configuracoes";

export const metadata: Metadata = { title: "Meus avisos" };

export default function Pagina() {
  return <MeusAvisos />;
}

import type { Metadata } from "next";
import { DadosPessoa } from "@/telas/privacidade/DadosPessoa";

export const metadata: Metadata = { title: "Dados de uma pessoa · Privacidade e dados" };

export default function Pagina() {
  return <DadosPessoa />;
}

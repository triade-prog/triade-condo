import type { Metadata } from "next";
import { Equipe } from "@/telas/Equipe";

export const metadata: Metadata = { title: "Pessoas e funções" };

export default function Pagina() {
  return <Equipe />;
}

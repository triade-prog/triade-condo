import type { Metadata } from "next";
import { Entrar } from "@/telas/Entrar";

export const metadata: Metadata = { title: "Entrar" };

export default function Pagina() {
  return <Entrar />;
}

import type { Metadata } from "next";
import { AcessoExcepcional } from "@/telas/suporte/AcessoExcepcional";

export const metadata: Metadata = { title: "Acesso excepcional" };

export default function Pagina() {
  return <AcessoExcepcional />;
}

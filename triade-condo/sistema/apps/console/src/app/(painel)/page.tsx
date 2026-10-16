import type { Metadata } from "next";
import { Carteira } from "@/telas/Carteira";

export const metadata: Metadata = { title: "Carteira de clientes" };

export default function Pagina() {
  return <Carteira />;
}

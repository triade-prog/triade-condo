import type { Metadata } from "next";
import { Interessados } from "@/telas/comercial/Interessados";

export const metadata: Metadata = { title: "Interessados" };

export default function Pagina() {
  return <Interessados />;
}

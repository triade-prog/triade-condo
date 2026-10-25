import type { Metadata } from "next";
import { TrocaSistema } from "@/telas/comercial/TrocaSistema";

export const metadata: Metadata = { title: "Troca de sistema" };

export default function Pagina() {
  return <TrocaSistema />;
}

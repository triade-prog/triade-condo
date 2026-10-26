import type { Metadata } from "next";
import { Agenda } from "@/telas/comercial/Agenda";

export const metadata: Metadata = { title: "Agenda de demonstrações" };

export default function Pagina() {
  return <Agenda />;
}

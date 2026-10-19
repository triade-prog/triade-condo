import type { Metadata } from "next";
import { WhatsappConsole } from "@/telas/suporte/WhatsappConsole";

export const metadata: Metadata = { title: "WhatsApp" };

export default function Pagina() {
  return <WhatsappConsole />;
}

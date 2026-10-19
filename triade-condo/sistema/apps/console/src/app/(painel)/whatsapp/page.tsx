import type { Metadata } from "next";
import { NumerosWhatsapp } from "@/telas/suporte/NumerosWhatsapp";

export const metadata: Metadata = { title: "WhatsApp" };

export default function Pagina() {
  return <NumerosWhatsapp />;
}

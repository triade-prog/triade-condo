import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Whatsapp } from "@/telas/whatsapp/Whatsapp";

export const metadata: Metadata = { title: "WhatsApp" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Whatsapp />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Prestador } from "@/telas/publico/Prestador";

export const metadata: Metadata = { title: { absolute: "Serviço no condomínio" } };

// Sem conta (V-11, MP-08): fora da moldura do painel. A câmera só vale aqui (cabeçalhos).
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <Prestador />
    </Suspense>
  );
}

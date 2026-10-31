import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { OrcamentoLink } from "@/telas/publico/Orcamento";
import { ComEncerramento } from "@/telas/publico/comum";

export const metadata: Metadata = { title: { absolute: "Pedido de orçamento" } };

// O link do fornecedor (R8, OC-03): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ComEncerramento rotulo="Pedido de orçamento">
        <OrcamentoLink />
      </ComEncerramento>
    </Suspense>
  );
}

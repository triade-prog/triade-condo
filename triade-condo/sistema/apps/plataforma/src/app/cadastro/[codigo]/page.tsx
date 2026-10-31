import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { Cadastro } from "@/telas/publico/Cadastro";
import { ComEncerramento } from "@/telas/publico/comum";

export const metadata: Metadata = { title: { absolute: "Cadastro do condomínio" } };

// Link de cadastro da unidade ou do prédio (F3.10; MU-09): sem conta, fora da moldura do painel.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <ComEncerramento rotulo="Cadastro">
        <Cadastro />
      </ComEncerramento>
    </Suspense>
  );
}

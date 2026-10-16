import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { SenhaPeloLink } from "@/telas/Acesso";

export const metadata: Metadata = { title: "Criar senha nova" };

export default function Pagina() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar senha nova</h1>
      <Suspense fallback={<Carregando linhas={2} />}>
        <SenhaPeloLink tipo="redefinir" />
      </Suspense>
    </>
  );
}

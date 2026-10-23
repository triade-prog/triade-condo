import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@triade/ui";
import { SenhaPeloLink } from "@/telas/Acesso";

export const metadata: Metadata = { title: "Criar sua senha" };

export default function Pagina() {
  return (
    <>
      <h1 className="t-titulo-tela font-normal tracking-tight">Criar sua senha</h1>
      <p className="-mt-3 text-tinta-suave">Você foi convidado para o painel do condomínio. Cada pessoa tem o seu acesso.</p>
      <Suspense fallback={<Carregando linhas={2} />}>
        <SenhaPeloLink tipo="convite" />
      </Suspense>
    </>
  );
}

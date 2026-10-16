import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, Marca } from "@triade/ui";
import { CriarSenha } from "./CriarSenha";

export const metadata: Metadata = { title: "Criar sua senha" };

export default function Pagina() {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-superficie-2 px-4 py-10">
      <div className="grid w-full max-w-sm gap-6 rounded-xl border border-linha bg-superficie p-6 shadow-sm">
        <Marca sistema="Plataforma do síndico" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Criar sua senha</h1>
          <p className="mt-1 text-tinta-suave">A equipe TRÍADE convidou você para o painel do condomínio. Cada pessoa tem o seu acesso.</p>
        </div>
        <Suspense fallback={<Carregando linhas={2} />}>
          <CriarSenha />
        </Suspense>
      </div>
    </main>
  );
}

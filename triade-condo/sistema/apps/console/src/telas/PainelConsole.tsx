"use client";
// Moldura do Console TRÍADE (design "Console TRÍADE · Admin"): lateral contínua com grupos,
// identificação persistente e área principal branca. Em tela pequena, a lateral recolhe e a
// identificação fica no cabeçalho.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FUNCOES_CONSOLE } from "@triade/domain";
import { Carregando, chamarApi, ErroCarregar } from "@triade/ui";
import { ContextoSessao, useCarregar, type SessaoConsole } from "./sessao.tsx";

function Identidade() {
  return (
    <div className="grid gap-1">
      <span className="inline-flex items-center gap-2 text-base font-semibold tracking-tight">
        <svg aria-hidden="true" viewBox="0 0 32 32" className="h-6 w-6 text-lilas">
          <path d="M16 3 29 27H3Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
        </svg>
        TRÍADE
      </span>
      <span className="w-max rounded-full bg-console px-2 py-px text-[11px] font-semibold text-papel">Console TRÍADE · Admin</span>
    </div>
  );
}

function ItemMenu({ href, children, atual }: { href: string; children: ReactNode; atual: boolean }) {
  return (
    <Link
      href={href}
      aria-current={atual ? "page" : undefined}
      className={`block rounded-md px-2.5 py-2 text-sm ${atual ? "bg-selecao font-medium text-selecao-tinta" : "text-tinta hover:bg-superficie-2"}`}
    >
      {children}
    </Link>
  );
}

export function PainelConsole({ children }: { children: ReactNode }) {
  const sessao = useCarregar<SessaoConsole>("/v1/sessao");
  const caminho = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  async function sair() {
    await chamarApi("/v1/auth/sair", { corpo: {} });
    router.replace("/entrar");
  }

  if (sessao.estado !== "pronto") {
    return (
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="sr-only">Console TRÍADE</h1>
        {sessao.estado === "erro" ? <ErroCarregar texto={sessao.texto} tentarDeNovo={sessao.recarregar} /> : <Carregando rotulo="Abrindo o Console…" />}
      </main>
    );
  }

  const s = sessao.dados;
  const cuidaDaEquipe = s.acoes.includes("console.equipe.gerenciar");
  const veHistoricoEquipe = s.acoes.includes("console.historico.equipe");
  const clientesAtual = caminho === "/" || caminho.startsWith("/clientes");

  return (
    <ContextoSessao.Provider value={s}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
        <header className="flex items-center justify-between gap-3 border-b border-lateral-borda bg-lateral px-4 py-3 md:hidden">
          <Identidade />
          <button
            type="button"
            className="min-h-10 rounded-md border border-contorno px-3 text-sm font-semibold"
            aria-expanded={menuAberto}
            aria-controls="menu-console"
            onClick={() => setMenuAberto((v) => !v)}
          >
            Menu
          </button>
        </header>
        <aside
          id="menu-console"
          className={`${menuAberto ? "flex" : "hidden"} flex-col border-r border-lateral-borda bg-lateral px-3 py-5 md:sticky md:top-0 md:flex md:h-dvh`}
        >
          <div className="hidden px-2 pb-4 md:block"><Identidade /></div>
          <nav aria-label="Console" className="grid gap-1">
            <p className="px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-detalhe uppercase">Clientes</p>
            <ItemMenu href="/" atual={clientesAtual}>Carteira de clientes</ItemMenu>
            {cuidaDaEquipe || veHistoricoEquipe ? (
              <>
                <p className="px-2.5 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-detalhe uppercase">Equipe</p>
                {cuidaDaEquipe ? <ItemMenu href="/equipe" atual={caminho === "/equipe"}>Pessoas e funções</ItemMenu> : null}
                {veHistoricoEquipe ? <ItemMenu href="/equipe/historico" atual={caminho === "/equipe/historico"}>Histórico da equipe</ItemMenu> : null}
              </>
            ) : null}
          </nav>
          <div className="mt-auto grid gap-2 border-t border-lateral-borda px-2.5 pt-3 text-sm">
            <p>
              <span className="block font-medium">{s.nome}</span>
              <span className="text-xs text-tinta-suave">
                {s.funcoes.map((f) => FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f).join(", ") || "Sem função"}
              </span>
            </p>
            <button type="button" onClick={sair} className="w-max text-sm font-medium text-acao hover:underline">Sair</button>
          </div>
        </aside>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </ContextoSessao.Provider>
  );
}

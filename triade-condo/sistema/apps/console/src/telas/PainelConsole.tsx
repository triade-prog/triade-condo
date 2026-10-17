"use client";
// Moldura do Console TRÍADE (telas-modelo da identidade, DC13): a mesma barra superior branca da
// Plataforma, com "Console TRÍADE" e o selo laranja "Admin", e a lateral clara com os grupos
// Clientes e Equipe. Em tela pequena, a lateral abre pelo botão de menu.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FUNCOES_CONSOLE } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Icone, Iniciais, type NomeIcone } from "@triade/ui";
import { ContextoSessao, useCarregar, type SessaoConsole } from "./sessao.tsx";

function Identidade() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 text-violeta-500">
        <path d="M16 3 29 27H3Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight">TRÍADE</span>
        <span className="flex items-center gap-1.5 text-xs text-tinta-suave">
          Console TRÍADE<span className="sr-only"> · </span>
          <span className="rounded-full bg-laranja-500 px-2 py-px text-[10px] font-semibold tracking-wider text-violeta-900 uppercase">Admin</span>
        </span>
      </span>
    </span>
  );
}

function ItemMenu({ href, icone, children, atual }: { href: string; icone: NomeIcone; children: ReactNode; atual: boolean }) {
  return (
    <Link href={href} aria-current={atual ? "page" : undefined}>
      <Icone nome={icone} />
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
  const funcoes = s.funcoes.map((f) => FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f).join(", ") || "Sem função";

  return (
    <ContextoSessao.Provider value={s}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="flex items-center gap-3 border-b border-linha bg-superficie px-4 py-2.5">
        <button
          type="button"
          className="emblema md:hidden"
          aria-label="Menu"
          aria-expanded={menuAberto}
          aria-controls="menu-console"
          onClick={() => setMenuAberto((v) => !v)}
        >
          <Icone nome="menu" />
        </button>
        <Identidade />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2">
            <Iniciais nome={s.nome} />
            <span className="hidden leading-tight sm:block">
              <span className="block font-medium">{s.nome}</span>
              <span className="block text-xs text-tinta-suave">{funcoes}</span>
            </span>
            <span className="sr-only sm:hidden">{s.nome} · {funcoes}</span>
          </span>
          <Botao variante="discreto" tamanho="m" onClick={sair}>Sair</Botao>
        </div>
      </header>
      <div className="min-h-[calc(100dvh-63px)] md:grid md:grid-cols-[248px_1fr] md:gap-6 md:p-5">
        <nav id="menu-console" aria-label="Console" className={`${menuAberto ? "grid" : "hidden"} lateral m-3 md:sticky md:top-5 md:m-0 md:grid md:self-start`}>
          <p className="grupo">Clientes</p>
          <ItemMenu href="/" icone="predio" atual={clientesAtual}>Carteira de clientes</ItemMenu>
          {cuidaDaEquipe || veHistoricoEquipe ? (
            <>
              <hr />
              <p className="grupo">Equipe</p>
              {cuidaDaEquipe ? <ItemMenu href="/equipe" icone="pessoas" atual={caminho === "/equipe"}>Pessoas e funções</ItemMenu> : null}
              {veHistoricoEquipe ? <ItemMenu href="/equipe/historico" icone="relogio" atual={caminho === "/equipe/historico"}>Histórico da equipe</ItemMenu> : null}
            </>
          ) : null}
        </nav>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:px-2 md:py-2">{children}</main>
      </div>
    </ContextoSessao.Provider>
  );
}

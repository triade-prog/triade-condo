"use client";
// Moldura do Console TRÍADE no padrão novo (DC15, telas-modelo console-inicio-* e
// console-menu-celular; rodada Console, decisões B.1 e C.1 de 23/10/2026): a mesma da Plataforma.
// No alto, a marca com "Console TRÍADE" e o selo laranja "Admin", a busca de clientes e a pessoa,
// que abre o menu com as funções e Sair. Sem sino: o Agora do Início faz esse papel. No
// computador, a lateral com o Início e os grupos Clientes, Financeiro (Pagamentos, 0291, e Tabela
// de preços, 0295), Suporte
// e Equipe, e Sistema (Retenção de dados, F0.11), com o número do
// que está aberto em laranja; no celular, a barra de baixo com Início, Clientes, Chamados e Mais.
// Implantações saiu do menu e virou o filtro Em implantação da carteira. No Comercial, Interessados,
// Propostas (0304), Painel comercial (0309), Agenda de demonstrações e Parceiros (0310) e Modelos.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FUNCOES_CONSOLE } from "@triade/domain";
import { Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Iniciais, Logo, type NomeIcone } from "@triade/ui";
import { ContextoSessao, useCarregar, type SessaoConsole } from "./sessao.tsx";

interface Contagens {
  carteira: number;
  implantacoes: number;
  chamados: number;
  suporteAcesso: number;
  whatsapp?: number;
}

interface ItemDoMenu {
  href: string;
  texto: string;
  /** Nome curto na barra de baixo do celular. */
  curto?: string;
  icone: NomeIcone;
  grupo: "Clientes" | "Comercial" | "Financeiro" | "Suporte" | "Equipe" | "Sistema" | null;
  atual: (caminho: string) => boolean;
  ve: (s: SessaoConsole) => boolean;
  contagem?: (n: Contagens) => number | undefined;
  /** Fica na barra de baixo do celular. */
  atalho?: boolean;
}

const temFuncao = (s: SessaoConsole, ...f: string[]) => s.funcoes.some((x) => f.includes(x));
const atende = (s: SessaoConsole) => temFuncao(s, "ADMINISTRACAO", "IMPLANTACAO", "SUPORTE");

const ITENS: ItemDoMenu[] = [
  { href: "/", texto: "Início", icone: "casa", grupo: null, atual: (c) => c === "/", ve: () => true, atalho: true },
  { href: "/clientes", texto: "Carteira de clientes", curto: "Clientes", icone: "predio", grupo: "Clientes", atual: (c) => c.startsWith("/clientes"), ve: () => true, atalho: true },
  { href: "/comercial", texto: "Interessados", icone: "pessoas", grupo: "Comercial", atual: (c) => c === "/comercial" || /^\/comercial\/(?!modelos|propostas|painel|agenda|parceiros)/.test(c),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/comercial/painel", texto: "Painel comercial", curto: "Painel", icone: "grafico", grupo: "Comercial", atual: (c) => c.startsWith("/comercial/painel"),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/comercial/propostas", texto: "Propostas", icone: "documento", grupo: "Comercial", atual: (c) => c.startsWith("/comercial/propostas"),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/comercial/agenda", texto: "Agenda de demonstrações", curto: "Agenda", icone: "calendario", grupo: "Comercial", atual: (c) => c.startsWith("/comercial/agenda"),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/comercial/parceiros", texto: "Parceiros", icone: "estrela", grupo: "Comercial", atual: (c) => c.startsWith("/comercial/parceiros"),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/comercial/modelos", texto: "Modelos do Comercial", curto: "Modelos", icone: "camadas", grupo: "Comercial", atual: (c) => c.startsWith("/comercial/modelos"),
    ve: (s) => s.acoes.includes("console.comercial.ver") },
  { href: "/pagamentos", texto: "Pagamentos", icone: "dinheiro", grupo: "Financeiro", atual: (c) => c.startsWith("/pagamentos"),
    ve: (s) => s.acoes.includes("console.pagamentos.ver") },
  { href: "/precos", texto: "Tabela de preços", icone: "etiqueta", grupo: "Financeiro", atual: (c) => c.startsWith("/precos"),
    ve: (s) => s.acoes.includes("console.precos.ver") },
  { href: "/chamados", texto: "Chamados", icone: "balao", grupo: "Suporte", atual: (c) => c.startsWith("/chamados"), ve: atende, contagem: (n) => n.chamados, atalho: true },
  { href: "/suporte-acesso", texto: "Suporte de acesso", icone: "cadeado", grupo: "Suporte", atual: (c) => c.startsWith("/suporte-acesso"),
    ve: (s) => temFuncao(s, "ADMINISTRACAO", "SUPORTE"), contagem: (n) => n.suporteAcesso },
  { href: "/whatsapp", texto: "WhatsApp", icone: "whats", grupo: "Suporte", atual: (c) => c.startsWith("/whatsapp"), ve: atende, contagem: (n) => n.whatsapp },
  { href: "/equipe", texto: "Pessoas e funções", icone: "pessoas", grupo: "Equipe", atual: (c) => c === "/equipe", ve: (s) => s.acoes.includes("console.equipe.gerenciar") },
  { href: "/equipe/historico", texto: "Histórico da equipe", icone: "relogio", grupo: "Equipe", atual: (c) => c === "/equipe/historico", ve: (s) => s.acoes.includes("console.historico.equipe") },
  { href: "/retencao", texto: "Retenção de dados", icone: "escudo", grupo: "Sistema", atual: (c) => c.startsWith("/retencao"), ve: (s) => s.acoes.includes("console.retencao.ver") },
];
const GRUPOS = ["Clientes", "Comercial", "Financeiro", "Suporte", "Equipe", "Sistema"] as const;

function Contagem({ n, nome }: { n?: number; nome: string }) {
  return n ? <span className="contagem">{n}<span className="sr-only"> {nome}</span></span> : null;
}

/** O menu inteiro: na lateral do computador e na janela "Mais" do celular. */
function Menu({ itens, caminho, n, aoIr }: { itens: ItemDoMenu[]; caminho: string; n: Contagens | null; aoIr?: () => void }) {
  const ligacao = (item: ItemDoMenu) => (
    <Link key={item.href} href={item.href} aria-current={item.atual(caminho) ? "page" : undefined} onClick={aoIr}>
      <Icone nome={item.icone} />
      <span className="flex-1">{item.texto}</span>
      {n && item.contagem ? <Contagem n={item.contagem(n)} nome="em aberto" /> : null}
    </Link>
  );
  return (
    <>
      {itens.filter((i) => i.grupo === null).map(ligacao)}
      {GRUPOS.map((g) => {
        const doGrupo = itens.filter((i) => i.grupo === g);
        if (!doGrupo.length) return null;
        return (
          <div key={g} role="group" aria-labelledby={`grupo-${g.toLowerCase()}`} className="grid gap-0.5">
            <span id={`grupo-${g.toLowerCase()}`} className="grupo">{g}</span>
            {doGrupo.map(ligacao)}
          </div>
        );
      })}
    </>
  );
}

/** A marca do Console: o logo, "Console TRÍADE" e o selo laranja "Admin". */
function Identidade() {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Logo />
      <span className="flex items-center gap-1.5">
        <span className="t-rotulo font-medium tracking-widest text-tinta-suave uppercase">Console TRÍADE</span>
        <span className="sr-only"> · </span>
        <span className="rounded-full bg-laranja-500 px-1.5 t-rotulo leading-[14px] font-bold tracking-wider text-violeta-900 uppercase">Admin</span>
      </span>
    </span>
  );
}

/** A pessoa no topo: abre o menu com as funções e Sair. */
function Conta({ sessao, funcoes, aoSair }: { sessao: SessaoConsole; funcoes: string; aoSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="conta">
      <button type="button" className="pessoa" aria-expanded={aberto} aria-controls="menu-pessoa" onClick={() => setAberto((v) => !v)}>
        <Iniciais nome={sessao.nome} />
        <span className="sr-only">{`Conta de ${sessao.nome}, ${funcoes}`}</span>
        <span className="nome max-lg:hidden" aria-hidden="true">{sessao.nome}<small>{funcoes}</small></span>
        <Icone nome="baixo" className="h-4 w-4 text-tinta-suave max-lg:hidden" />
      </button>
      {aberto ? (
        <div id="menu-pessoa" className="menu-pessoa">
          <div className="quem">
            <span className="t-titulo-cartao">{sessao.nome}</span>
            <span className="t-apoio">{funcoes} · equipe TRÍADE</span>
          </div>
          <Botao variante="discreto" tamanho="m" onClick={aoSair}><Icone nome="sair" />Sair</Botao>
        </div>
      ) : null}
    </div>
  );
}

/** A busca de clientes: leva à carteira com o que foi escrito. */
function FormBusca({ className = "", chave, aoBuscar }: { className?: string; chave: string; aoBuscar: (q: string) => void }) {
  return (
    <form role="search" action="/clientes" className={`busca ${className}`}
      onSubmit={(e) => { e.preventDefault(); aoBuscar(String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}>
      <Icone nome="busca" />
      <input type="search" name="q" maxLength={60} aria-label="Buscar cliente" placeholder="Buscar cliente pelo nome ou pela cidade" key={chave}
        className="campo placeholder:text-tinta-suave" />
    </form>
  );
}

export function PainelConsole({ children }: { children: ReactNode }) {
  const sessao = useCarregar<SessaoConsole>("/v1/sessao");
  const caminho = usePathname();
  const contagens = useCarregar<Contagens>(sessao.estado === "pronto" ? `/v1/contagens?v=${caminho}` : null);
  const n = contagens.estado === "pronto" ? contagens.dados : null;
  const router = useRouter();
  const [mais, setMais] = useState(false);
  const [buscando, setBuscando] = useState(false);

  async function sair() {
    await chamarApi("/v1/auth/sair", { corpo: {} });
    router.replace("/entrar");
  }

  if (sessao.estado !== "pronto") {
    return (
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="sr-only">Console TRÍADE</h1>
        {sessao.estado === "erro" ? <ErroCarregar erro={sessao.erro} texto={sessao.texto} tentarDeNovo={sessao.recarregar} /> : <Carregando rotulo="Abrindo o Console…" />}
      </main>
    );
  }

  const s = sessao.dados;
  const funcoes = s.funcoes.map((f) => FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE] ?? f).join(", ") || "Sem função";
  const itens = ITENS.filter((i) => i.ve(s));
  const atalhos = itens.filter((i) => i.atalho);
  // O número no Mais soma o que está aberto nas partes que não estão na barra de baixo.
  const noMais = n ? itens.filter((i) => !i.atalho).reduce((t, i) => t + (i.contagem?.(n) ?? 0), 0) : 0;
  const buscar = (q: string) => router.push(q ? `/clientes?q=${encodeURIComponent(q)}` : "/clientes");

  return (
    <ContextoSessao.Provider value={s}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="topo print:hidden">
        <span className="marca"><Identidade /></span>
        <FormBusca className="max-md:hidden" chave={caminho} aoBuscar={buscar} />
        <button type="button" className="emblema md:hidden" aria-label="Buscar cliente" onClick={() => setBuscando(true)}><Icone nome="busca" /></button>
        <Conta sessao={s} funcoes={funcoes} aoSair={() => void sair()} />
      </header>
      <div className="min-h-[calc(100dvh-63px)] pb-24 md:grid md:grid-cols-[248px_minmax(0,1fr)] md:gap-8 md:p-6 md:pb-6 print:block print:min-h-0 print:p-0">
        <nav id="menu-console" aria-label="Console" className="lateral max-md:hidden md:sticky md:top-6 md:self-start print:hidden">
          <Menu itens={itens} caminho={caminho} n={n} />
        </nav>
        <main id="conteudo" className="min-w-0 px-4 py-6 md:p-0">{children}</main>
      </div>
      <nav aria-label="Atalhos" className="barra-baixo print:hidden">
        {atalhos.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.atual(caminho) ? "page" : undefined}>
            <Icone nome={item.icone} />
            {item.curto ?? item.texto}
            {n && item.contagem ? <Contagem n={item.contagem(n)} nome="em aberto" /> : null}
          </Link>
        ))}
        <button type="button" aria-expanded={mais} aria-controls="menu-mais" onClick={() => setMais(true)}>
          <Icone nome="menu" />Mais
          <Contagem n={noMais} nome="em aberto nas outras partes" />
        </button>
      </nav>
      <Dialogo aberto={mais} titulo="Menu" aoFechar={() => setMais(false)}>
        <nav id="menu-mais" aria-label="Console" className="lateral border-0 p-0 shadow-none">
          <Menu itens={itens} caminho={caminho} n={n} aoIr={() => setMais(false)} />
        </nav>
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setMais(false)}>Fechar</Botao></div>
      </Dialogo>
      <Dialogo aberto={buscando} titulo="Buscar cliente" aoFechar={() => setBuscando(false)}>
        <FormBusca chave={caminho} aoBuscar={(q) => { setBuscando(false); buscar(q); }} />
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setBuscando(false)}>Fechar</Botao></div>
      </Dialogo>
    </ContextoSessao.Provider>
  );
}

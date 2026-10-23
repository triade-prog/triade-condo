"use client";
// Peças comuns do Console no padrão novo (DC15, telas-modelo console-*; rodada Console, 23/10/2026):
// as mesmas da Plataforma do síndico, para as duas casas terem a mesma cara. O cartão com
// ladrilho, a linha de dado, o menu de ações, o link de volta, a barra de etapas, as abas de lista
// com o número, as linhas de lista que viram cartões no celular e a linha do tempo.

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Botao, classeBotao, Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";

/** Uma parte da tela, em cartão: ladrilho com ícone, título e, à direita, uma ação. */
export function Cartao({ id, titulo, icone, acao, children, className = "" }: {
  id: string; titulo: ReactNode; icone: NomeIcone; acao?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`grid min-w-0 content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="t-titulo-cartao flex items-center gap-3">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Uma linha de dado num cartão: ícone, nome e valor. No celular, o valor desce para baixo do nome. */
export function Dado({ icone, nome, children }: { icone: NomeIcone; nome: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-linha py-3 first:border-t-0">
      <span className="ladrilho h-8 w-8 rounded-[10px]" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
      <span className="text-tinta-suave max-md:text-[13px] md:w-44 md:shrink-0">{nome}</span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere] max-md:basis-full max-md:pl-11">{children}</span>
    </div>
  );
}

/** O botão discreto de um cartão: Editar, Trocar, Rever. */
export function AcaoCartao({ icone, children, aoClicar, rotulo }: { icone: NomeIcone; children: ReactNode; aoClicar: () => void; rotulo?: string }) {
  return (
    <Botao variante="discreto" aria-label={rotulo} onClick={aoClicar} className="gap-1.5">
      <Icone nome={icone} className="h-4 w-4" />{children}
    </Botao>
  );
}

export interface ItemMenu {
  texto: string;
  icone: NomeIcone;
  acao?: () => void;
  href?: string;
  /** Abre numa aba nova (o resumo para imprimir). */
  novaAba?: boolean;
}

/** Menu de ações: abre sob o botão, fecha com Esc ou clicando fora. No celular, o botão fica só com o ícone. */
export function MenuAcoes({ rotulo, itens, texto }: { rotulo: string; itens: ItemMenu[]; texto: string }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  if (!itens.length) return null;
  const classe = classeBotao("discreto", "!h-auto min-h-11 justify-start py-2");
  return (
    <div ref={caixa} className="relative">
      <Botao variante="contorno" aria-label={rotulo === texto ? undefined : rotulo} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}
        className="max-md:w-11 max-md:px-0">
        <Icone nome="pontos" /><span className="max-md:sr-only">{texto}</span>
      </Botao>
      {aberto ? (
        <div id={id} className="menu-pessoa" role="group" aria-label={rotulo}>
          {itens.map((x) => x.href ? (
            <Link key={x.texto} href={x.href} target={x.novaAba ? "_blank" : undefined} className={classe} onClick={() => setAberto(false)}>
              <Icone nome={x.icone} className="h-4.5 w-4.5 shrink-0 text-tinta-suave" />{x.texto}
            </Link>
          ) : (
            <button key={x.texto} type="button" className={classe} onClick={() => { setAberto(false); x.acao?.(); }}>
              <Icone nome={x.icone} className="h-4.5 w-4.5 shrink-0 text-tinta-suave" />{x.texto}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** O link de volta, no topo das páginas de detalhe. */
export function Voltar({ href, texto }: { href: string; texto: string }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />{texto}
    </Link>
  );
}

/** O título da página, o apoio e, à direita, o botão principal. */
export function CabecaPagina({ titulo, apoio, acao }: { titulo: string; apoio?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="t-titulo-tela">{titulo}</h1>
        {apoio ? <p className="t-apoio">{apoio}</p> : null}
      </div>
      {acao}
    </div>
  );
}

/** A barra de etapas (ou de partes): um traço por etapa, os feitos em violeta. */
export function BarraEtapas({ feitas, total, rotulo }: { feitas: number; total: number; rotulo: string }) {
  return (
    <span role="img" aria-label={rotulo} className="passos">
      {Array.from({ length: total }, (_, i) => <span key={i} data-feito={i < feitas ? "" : undefined} />)}
    </span>
  );
}

export interface AbaLista<T extends string> {
  valor: T;
  texto: string;
  n?: number;
}

/** As abas no alto de uma lista, com o número de cada uma (como em Ajuda e suporte da Plataforma). */
export function AbasLista<T extends string>({ abas, atual, aoMudar, rotulo }: { abas: AbaLista<T>[]; atual: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
      {abas.map((a) => {
        const escolhida = atual === a.valor;
        return (
          <button key={a.valor} type="button" aria-pressed={escolhida} onClick={() => aoMudar(a.valor)}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${escolhida ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
            {a.texto}
            {a.n !== undefined ? <span className={`contagem ml-0 ${escolhida ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{a.n}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

/** A caixa de uma lista: no computador, cartão com o cabeçalho das colunas e o rodapé; no celular, cartões soltos. */
export function CaixaLista({ titulo, abas, filtros, colunas, cabecalho, rodape, children }: {
  titulo: string; abas?: ReactNode; filtros?: ReactNode; colunas: string; cabecalho?: string[]; rodape?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-label={titulo} className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
      {abas}
      {filtros}
      {cabecalho ? (
        <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${colunas}`}>
          {cabecalho.map((c, i) => <span key={i} className="t-rotulo">{c}</span>)}
        </div>
      ) : null}
      {children}
      {rodape ? <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">{rodape}</div> : null}
    </section>
  );
}

/** Uma linha da lista: a linha inteira abre o que o link aponta. No celular, vira cartão. */
export const CLASSE_LINHA = "relative grid grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:border-linha md:last:border-b-0";
export const CLASSE_LINK_LINHA = "font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600";

export interface PassoTempo {
  chave: string | number;
  icone: NomeIcone;
  tom: Tom | "violeta";
  quando: string;
  quem: string;
  selo?: { texto: string; tom: Tom };
  texto: ReactNode;
  /** A nota vai num balão violeta; a mudança, em texto simples. */
  nota?: boolean;
}

/** A linha do tempo: o ícone de cada passo, quem e quando em cima e o que aconteceu embaixo. */
export function LinhaDoTempo({ itens, rotulo }: { itens: PassoTempo[]; rotulo: string }) {
  return (
    <ol aria-label={rotulo} className="grid">
      {itens.map((h, i) => (
        <li key={h.chave} className={`relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 ${i === itens.length - 1 ? "" : "pb-4 before:absolute before:top-9 before:bottom-0 before:left-[15px] before:w-0.5 before:bg-linha"}`}>
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom={h.tom} aria-hidden="true"><Icone nome={h.icone} className="h-4 w-4" /></span>
          <div className="grid min-w-0 gap-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 t-apoio text-tinta-suave">
              <span className="t-codigo">{h.quando}</span><span>· {h.quem}</span>
              {h.selo ? <span className="selo" data-tom={h.selo.tom}>{h.selo.texto}</span> : null}
            </p>
            {h.nota
              ? <p className="rounded-xl border border-violeta-200 bg-violeta-50 px-3 py-2.5 t-texto whitespace-pre-wrap [overflow-wrap:anywhere]">{h.texto}</p>
              : <p className="t-texto [overflow-wrap:anywhere]">{h.texto}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Uma linha do cartão Agora: ladrilho na cor do que pede, o texto, o selo e o botão do próximo passo. */
export interface LinhaAgora {
  chave: string;
  icone: NomeIcone;
  tom: Tom | "violeta";
  titulo: string;
  detalhe?: string;
  selo?: { texto: string; tom: Tom };
  acao: ReactNode;
}

export function LinhasAgora({ linhas }: { linhas: LinhaAgora[] }) {
  return (
    <ul className="divide-y divide-linha">
      {linhas.map((l) => (
        <li key={l.chave} className="flex items-center gap-3 py-3">
          <span className="ladrilho" data-tom={l.tom} aria-hidden="true"><Icone nome={l.icone} /></span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-medium">{l.titulo}</span>
            {l.detalhe ? <span className="t-apoio [overflow-wrap:anywhere]">{l.detalhe}</span> : null}
            {l.selo ? <span className="mt-1 md:hidden"><Selo tom={l.selo.tom}>{l.selo.texto}</Selo></span> : null}
          </span>
          {l.selo ? <span className="max-md:hidden"><Selo tom={l.selo.tom}>{l.selo.texto}</Selo></span> : null}
          {l.acao}
        </li>
      ))}
    </ul>
  );
}

const CELULAR = "(max-width: 767px)";

/** Se a tela está no tamanho de celular (o mesmo corte do max-md). */
export function useCelular(): boolean {
  return useSyncExternalStore(
    (avisar) => { const m = window.matchMedia(CELULAR); m.addEventListener("change", avisar); return () => m.removeEventListener("change", avisar); },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Dia e hora curtos, no horário de Brasília: "22/10, 23:59". */
export function diaHora(iso: string): string {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return f.format(new Date(iso));
}

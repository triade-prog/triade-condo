"use client";
// Peças comuns das telas de moradores e unidades (passo 3; DC15, telas-modelo moradores-*): o
// menu de ações (Montar o prédio, o menu de cada pessoa e de cada vaga), o cartão das partes da
// ficha e o cabeçalho das listas.

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AGRUPAMENTOS, ESTADOS_CONTATO_UNIDADE, MOTIVOS_ENCERRAMENTO, RELACOES_UNIDADE } from "@triade/domain";
import type { Estrutura } from "../tipos.ts";
import { Botao, classeBotao, Icone, Selo, type NomeIcone } from "@triade/ui";

export interface ItemMenu {
  texto: string;
  icone: NomeIcone;
  /** Uma linha de explicação embaixo do texto. */
  apoio?: string;
  acao?: () => void;
  href?: string;
  perigo?: boolean;
  /** Nome para o leitor de tela, quando o texto sozinho não diz de quem é; contém o texto que aparece (WCAG 2.5.3). */
  rotulo?: string;
}

/** Menu de ações: abre sob o botão, fecha com Esc ou clicando fora. Com `texto`, o botão tem
 * palavra (no celular, só o ícone); sem, é o emblema de três pontos. */
export function MenuAcoes({ rotulo, itens, texto, icone = "pontos" }: { rotulo: string; itens: ItemMenu[]; texto?: string; icone?: NomeIcone }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const base = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  if (!itens.length) return null;
  // O apoio não entra no nome do item: é a descrição dele.
  const idApoio = (x: ItemMenu) => `${base}-${itens.indexOf(x)}`;
  const descricao = (x: ItemMenu) => (x.apoio ? idApoio(x) : undefined);
  const conteudo = (x: ItemMenu) => (
    <>
      <Icone nome={x.icone} className={`h-4.5 w-4.5 shrink-0 ${x.perigo ? "" : "text-tinta-suave"}`} />
      <span className="grid text-left">
        <span>{x.texto}</span>
        {x.apoio ? <span id={idApoio(x)} aria-hidden="true" className="t-apoio font-normal">{x.apoio}</span> : null}
      </span>
    </>
  );
  const classe = (x: ItemMenu) => classeBotao("discreto", `!h-auto min-h-11 justify-start py-2 ${x.perigo ? "text-erro" : ""}`);
  return (
    <div ref={caixa} className="relative">
      {texto ? (
        <Botao variante="contorno" aria-label={rotulo === texto ? undefined : rotulo} aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="max-md:w-11 max-md:px-0">
          <Icone nome={icone} /><span className="max-md:sr-only">{texto}</span><Icone nome="baixo" className="h-4 w-4 max-md:hidden" />
        </Botao>
      ) : (
        <button type="button" className="emblema" aria-label={rotulo} aria-expanded={aberto} onClick={() => setAberto(!aberto)}><Icone nome={icone} /></button>
      )}
      {aberto ? (
        <div className="menu-pessoa" role="group" aria-label={rotulo}>
          {itens.map((x) => x.href ? (
            <Link key={x.texto} href={x.href} aria-label={x.rotulo} aria-describedby={descricao(x)} className={classe(x)} onClick={() => setAberto(false)}>{conteudo(x)}</Link>
          ) : (
            <button key={x.texto} type="button" aria-label={x.rotulo} aria-describedby={descricao(x)} className={classe(x)} onClick={() => { setAberto(false); x.acao?.(); }}>
              {conteudo(x)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Uma parte da ficha, em cartão: ladrilho com ícone, título e, à direita, uma ação. */
export function CartaoFicha({ id, titulo, icone, acao, children }: { id: string; titulo: string; icone: NomeIcone; acao?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`t-${id}`} className="grid scroll-mt-24 content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
          <h2 id={`t-${id}`} className="t-titulo-cartao">{titulo}</h2>
        </span>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** A identificação da unidade num ladrilho, em fonte mono: "101", "L2". */
export function LadrilhoUnidade({ texto, grande }: { texto: string; grande?: boolean }) {
  const curto = texto.length > 4 ? `${texto[0]}${texto.replace(/\D/g, "")}`.slice(0, 4) : texto;
  return (
    <span aria-hidden="true" className={`ladrilho t-codigo ${grande ? "h-14 w-14 rounded-2xl bg-[image:var(--grad-acao)] t-texto text-superficie" : "h-11 w-11 rounded-xl"}`}>{curto}</span>
  );
}

export function nomeRelacao(r: string): string {
  return RELACOES_UNIDADE[r as keyof typeof RELACOES_UNIDADE] ?? r;
}

export function nomeMotivo(m: string): string {
  return MOTIVOS_ENCERRAMENTO[m as keyof typeof MOTIVOS_ENCERRAMENTO] ?? m;
}

/** Confirmado ou a confirmar: palavra e forma, além da cor (MU-02). */
export function SeloEstado({ estado }: { estado: "PENDENTE" | "CONFIRMADO" }) {
  return estado === "CONFIRMADO"
    ? <Selo tom="ok">{ESTADOS_CONTATO_UNIDADE.CONFIRMADO}</Selo>
    : <Selo tom="atencao">{ESTADOS_CONTATO_UNIDADE.PENDENTE}</Selo>;
}

/** Como chamar a divisão do prédio nas telas: "Torre", "Torres", "Sem torre". */
export function nomesDivisao(e: Estrutura): { um: string; varios: string; sem: string; usa: boolean } {
  const a = AGRUPAMENTOS[e.agrupamento];
  return { um: a.um || "Bloco", varios: a.varios || "Blocos", sem: `Sem ${(a.um || "bloco").toLowerCase()}`, usa: e.agrupamento !== "NENHUM" };
}

/** Hoje no horário de Brasília, como aaaa-mm-dd. */
export function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export { Caixa, Escolha } from "@triade/configuracoes";

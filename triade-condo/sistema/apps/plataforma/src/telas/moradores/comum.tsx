"use client";
// Peças comuns das telas de moradores e unidades (passo 3).

import type { ReactNode } from "react";
import { AGRUPAMENTOS, ESTADOS_CONTATO_UNIDADE, MOTIVOS_ENCERRAMENTO, RELACOES_UNIDADE } from "@triade/domain";
import type { Estrutura } from "../tipos.ts";
import { Selo } from "@triade/ui";

export const opcoesRelacao = Object.entries(RELACOES_UNIDADE).map(([valor, texto]) => ({ valor, texto }));

export function nomeRelacao(r: string): string {
  return RELACOES_UNIDADE[r as keyof typeof RELACOES_UNIDADE] ?? r;
}

export function nomeMotivo(m: string): string {
  return MOTIVOS_ENCERRAMENTO[m as keyof typeof MOTIVOS_ENCERRAMENTO] ?? m;
}

/** Confirmado ou a confirmar: palavra e forma, além da cor (MU-02). */
export function SeloEstado({ estado }: { estado: "PENDENTE" | "CONFIRMADO" }) {
  return estado === "CONFIRMADO"
    ? <Selo tom="ok" marca="ok">{ESTADOS_CONTATO_UNIDADE.CONFIRMADO}</Selo>
    : <Selo tom="atencao" marca="atencao">{ESTADOS_CONTATO_UNIDADE.PENDENTE}</Selo>;
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

/** Botões de escolha (um ligado por vez), com aria-pressed. */
export function Escolha<T extends string>({ opcoes, atual, aoMudar, rotulo }: {
  opcoes: { valor: T; texto: ReactNode }[];
  atual: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={atual === o.valor}
          onClick={() => aoMudar(o.valor)}
          className="min-h-10 rounded-full border border-contorno bg-superficie px-3.5 text-sm aria-pressed:border-acao aria-pressed:bg-plataforma-bruma aria-pressed:font-semibold aria-pressed:text-acao-press"
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Caixa({ id, rotulo, ajuda, marcada, aoMudar }: { id: string; rotulo: string; ajuda?: string; marcada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-acao)]" checked={marcada} onChange={(e) => aoMudar(e.target.checked)} />
      <span>{rotulo}{ajuda ? <span className="block text-xs text-tinta-suave">{ajuda}</span> : null}</span>
    </label>
  );
}

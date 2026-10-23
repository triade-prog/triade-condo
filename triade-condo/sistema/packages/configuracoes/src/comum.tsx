"use client";
// Peças pequenas dos formulários das Configurações, usadas também em outras telas do app.

import type { ReactNode } from "react";

/** Botões de escolha (um ligado por vez), com aria-pressed. */
export function Escolha<T extends string>({ opcoes, atual, aoMudar, rotulo }: {
  opcoes: { valor: T; texto: ReactNode }[];
  atual: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="trilho justify-self-start">
      {opcoes.map((o) => (
        <button key={o.valor} type="button" className="chip" aria-pressed={atual === o.valor} onClick={() => aoMudar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Caixa({ id, rotulo, ajuda, marcada, aoMudar }: { id: string; rotulo: string; ajuda?: string; marcada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 t-texto">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-violeta-600" checked={marcada} onChange={(e) => aoMudar(e.target.checked)} />
      <span>{rotulo}{ajuda ? <span className="block t-apoio text-tinta-suave">{ajuda}</span> : null}</span>
    </label>
  );
}

const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "21/10 14:30", no horário de Brasília. */
export function diaHora(iso: string): string {
  return DIA_HORA.format(new Date(iso)).replace(",", "");
}

/** Uma parte numerada da página (Prazos e avisos, Área comum, Comunicados), como no Registrar pedido. */
export function ParteNumerada({ n, id, titulo, children, direita }: { n: number; id: string; titulo: string; children: ReactNode; direita?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-violeta-50 t-apoio font-bold text-violeta-700">{n}</span>
          <h2 id={id} className="t-titulo-secao font-medium">{titulo}</h2>
        </span>
        {direita}
      </div>
      {children}
    </section>
  );
}

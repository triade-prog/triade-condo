"use client";
// A proposta como apresentação na tela (R17.8, CM-34; quadros 450 e 451): a mesma ordem do PDF, no
// computador e no celular. Capa (o problema, o exemplo de um pedido e o preço), investimento (a
// Tabela de preços do dia), escopo e equipe, condições e próximos passos. O aceite entra no fim, pela
// página do link; a prévia do Console ("Ver como o síndico vai ver") usa o mesmo desenho sem aceite.

import type { ReactNode } from "react";
import { Icone } from "@triade/ui";
import { ACOMPANHAMENTO, NADA_A_PARTE, PARTES, PASSOS, SUB_CAPA, SUB_ESCOPO, TITULO_CAPA, type Apresentacao, type IconeContato } from "./apresentacao.ts";

const ICONE_CONTATO: Record<IconeContato, "whats" | "email" | "predio" | "calendario"> = { whats: "whats", email: "email", predio: "predio", agenda: "calendario" };

const Olho = ({ children, claro = false, tom }: { children: ReactNode; claro?: boolean; tom?: "ok" }) => (
  <span className={`t-rotulo font-bold ${claro ? "text-violeta-100" : tom === "ok" ? "text-ok" : "text-violeta-600"}`}>{children}</span>
);
const Traco = () => <span aria-hidden="true" className="block h-1 w-7 rounded-sm bg-laranja-500" />;

/** Os anéis finos da marca no fundo violeta. */
function Aneis({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 560" fill="none" stroke="currentColor" className={`pointer-events-none text-papel absolute opacity-15 ${className}`}>
      <circle cx="280" cy="280" r="270" strokeWidth="1.5" /><circle cx="280" cy="280" r="200" strokeWidth="1.5" /><circle cx="280" cy="280" r="130" strokeWidth="1.5" />
    </svg>
  );
}

function Acompanhamento() {
  return (
    <div className="grid gap-3.5 rounded-[18px] bg-superficie p-5 text-tinta shadow-[var(--shadow-s3)]">
      <span className="border-b border-linha pb-2.5"><Olho>Exemplo de acompanhamento</Olho></span>
      <ol className="grid gap-3.5">
        {ACOMPANHAMENTO.map((e, i) => (
          <li key={e.titulo} className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] t-codigo ${i === ACOMPANHAMENTO.length - 1 ? "bg-ok-fundo text-ok" : "bg-violeta-100 text-violeta-600"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="grid gap-0.5"><span className="t-titulo-cartao font-bold">{e.titulo}</span><span className="t-apoio">{e.texto}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Preco({ a }: { a: Apresentacao }) {
  const p = a.preco;
  return (
    <div className="grid gap-5 rounded-[18px] bg-superficie p-5 text-tinta sm:p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
      <div className="grid min-w-0 gap-1.5">
        <Olho>{p.rotulo}</Olho>
        <span className="text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[52px]">
          {p.valor}<span className="t-texto font-medium tracking-normal whitespace-nowrap text-tinta-suave"> / mês</span>
        </span>
      </div>
      <div className="grid min-w-0 gap-1 border-t border-linha pt-3.5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
        {p.porAp ? <><span className="text-[30px] font-extrabold text-violeta-600 tabular-nums">{p.porAp}</span><span className="t-apoio">por apartamento / mês</span></> : null}
        {p.taxa ? <span className="t-apoio">{p.taxa}</span> : null}
        {p.implantacao ? <span className="t-apoio font-bold text-ok">{p.implantacao}</span> : null}
      </div>
    </div>
  );
}

function Capa({ a }: { a: Apresentacao }) {
  return (
    <section aria-label="Capa" className="relative grid gap-6 overflow-hidden rounded-[24px] p-5 text-white sm:gap-7 sm:rounded-[28px] sm:p-11" style={{ background: "var(--grad-acao)" }}>
      <Aneis className="-top-28 -right-44 h-[560px] w-[560px] max-sm:-top-16 max-sm:-right-24 max-sm:h-[330px] max-sm:w-[330px]" />
      <div className="relative grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-10">
        <div className="grid min-w-0 gap-4">
          <Olho claro>{a.olhoCapa}</Olho>
          <h1 className="text-[32px] leading-[1.06] font-extrabold tracking-[-0.02em] sm:text-[52px]">{TITULO_CAPA}</h1>
          <p className="max-w-[52ch] t-texto text-violeta-50 sm:text-[17px]">{SUB_CAPA}</p>
          {a.para ? <span className="t-texto text-violeta-100">{a.para}</span> : null}
        </div>
        <div className="max-lg:order-last"><Acompanhamento /></div>
      </div>
      <div className="relative grid gap-3">
        <Olho claro>{a.rotuloCondicao}</Olho>
        <Preco a={a} />
        <div className="flex flex-wrap justify-between gap-2 rounded-[14px] border border-white/25 bg-white/12 px-5 py-4">
          <span className="t-rotulo font-bold text-inherit">{a.garantia.titulo}</span>
          <span className="t-apoio font-bold text-inherit">{a.garantia.validade}</span>
        </div>
      </div>
    </section>
  );
}

function Parte({ i, sub, children }: { i: 0 | 1 | 2; sub?: string; children: ReactNode }) {
  const p = PARTES[i];
  return (
    <section id={p.id} aria-labelledby={`${p.id}-titulo`} className="grid scroll-mt-4 gap-5 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1 sm:gap-6 sm:p-9">
      <div className="grid gap-2.5">
        <Olho>{p.olho}</Olho>
        <h2 id={`${p.id}-titulo`} className="t-titulo-ficha leading-[1.08] sm:text-[42px]">{p.titulo}</h2>
        {sub ? <p className="max-w-[62ch] t-texto text-tinta-suave">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Investimento({ a }: { a: Apresentacao }) {
  const inv = a.investimento;
  return (
    <Parte i={0} sub={inv.sub}>
      <div className="grid gap-5 rounded-[18px] bg-violeta-50 p-4 sm:p-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-2">
          <Olho>{inv.seu.rotulo}</Olho>
          <span className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[48px]">
            {inv.seu.valor}<span className="t-texto font-medium tracking-normal text-tinta-suave"> por mês</span>
          </span>
          {inv.seu.texto ? <span className="t-texto text-tinta-suave">{inv.seu.texto}</span> : null}
        </div>
        {inv.seu.lado ? (
          <div className="grid min-w-0 content-start gap-1 border-t border-violeta-200 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <Olho>{inv.seu.lado.olho}</Olho>
            <span className="t-titulo-ficha text-violeta-600">{inv.seu.lado.titulo}</span>
            <span className="t-texto">{inv.seu.lado.sub}</span>
            {inv.seu.lado.depois ? <span className="t-texto pt-1.5 font-bold">{inv.seu.lado.depois}</span> : null}
          </div>
        ) : null}
      </div>
      {inv.tabela ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><Olho>Tabela de investimento</Olho><span className="t-apoio">{inv.tabela.data}</span></div>
          <div className="overflow-x-auto rounded-[16px] border border-linha bg-superficie" tabIndex={0} role="region" aria-label="Tabela de investimento">
            <table className="w-full min-w-[480px] border-collapse t-texto">
              <thead>
                <tr>{inv.tabela.cabecalho.map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-linha bg-violeta-50 px-4 py-3 t-rotulo font-bold ${i ? "text-right" : "text-left"}`}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {inv.tabela.linhas.map((l) => (
                  <tr key={l.faixa} className={l.seu ? "bg-violeta-50 font-bold" : undefined}>
                    <th scope="row" className={`border-b border-linha px-4 py-3.5 text-left font-[inherit] ${l.seu ? "shadow-[inset_4px_0_0_var(--color-violeta-600)]" : ""}`}>
                      {l.faixa}{l.seu ? <span className="ml-2 rounded-full bg-violeta-100 px-2.5 py-0.5 t-apoio text-violeta-600">Seu prédio</span> : null}
                    </th>
                    {l.valores.map((v, i) => <td key={i} className="border-b border-linha px-4 py-3.5 text-right tabular-nums">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 rounded-[16px] bg-violeta-50 px-5 py-4">
        <Olho>O que está considerado neste valor</Olho>
        <p className="t-texto">{inv.considerado}</p>
        {inv.nota ? <p className="t-apoio">{inv.nota}</p> : null}
      </div>
    </Parte>
  );
}

function Escopo({ a }: { a: Apresentacao }) {
  const e = a.escopo;
  return (
    <Parte i={1} sub={SUB_ESCOPO}>
      <div className={`grid gap-4 ${e.naoIncluido.length ? "md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" : ""}`}>
        <div className="grid content-start gap-4 rounded-[18px] border border-ok-borda bg-ok-fundo p-5">
          <Olho tom="ok">Incluído na mensalidade</Olho>
          <ul className="grid gap-4">
            {e.incluido.map((i) => (
              <li key={i.titulo} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
                <Icone nome="check" className="mt-0.5 h-5 w-5 text-ok" />
                <span className="grid gap-0.5"><span className="t-titulo-cartao font-bold">{i.titulo}</span>{i.texto ? <span className="t-apoio">{i.texto}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
        {e.naoIncluido.length ? (
          <div className="grid content-start gap-4 rounded-[18px] border border-linha bg-violeta-50 p-5">
            <Olho>Não incluído</Olho>
            <ul className="grid gap-4">
              {e.naoIncluido.map((t) => (
                <li key={t} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 t-texto"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 rounded-full bg-violeta-600" />{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-between gap-2 rounded-[14px] border border-linha bg-superficie px-5 py-4">
        <span className="t-texto font-bold">{NADA_A_PARTE[0]}</span><span className="t-apoio">{NADA_A_PARTE[1]}</span>
      </div>
      <p className="rounded-[14px] bg-violeta-50 px-5 py-3.5 t-apoio text-tinta">{e.planejado}</p>
      <div className="grid gap-3">
        <Olho>Pessoas de contato</Olho>
        <div className="grid gap-3.5 md:grid-cols-2">
          {a.contatos.map((k) => (
            <div key={k.papel} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3.5 rounded-[16px] border border-linha bg-superficie p-4">
              <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-violeta-100 t-texto font-extrabold text-violeta-600">{k.iniciais}</span>
              <span className="grid min-w-0 gap-1">
                <span className="t-titulo-cartao font-extrabold tracking-[0.04em] uppercase [overflow-wrap:anywhere]">{k.nome}</span>
                <span className="t-apoio">{k.papel}</span>
                {k.linhas.map((l) => (
                  <span key={l.texto} className="inline-flex items-center gap-2 t-apoio [overflow-wrap:anywhere]"><Icone nome={ICONE_CONTATO[l.icone]} className="h-4 w-4 shrink-0" />{l.texto}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Parte>
  );
}

function Condicoes({ a, children }: { a: Apresentacao; children?: ReactNode }) {
  return (
    <Parte i={2}>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {a.condicoes.map((k) => (
          <div key={k.titulo} className="grid content-start gap-2 rounded-[16px] border border-linha bg-violeta-50 p-5"><Traco /><Olho>{k.titulo}</Olho><p className="t-texto">{k.texto}</p></div>
        ))}
      </div>
      <div className="grid gap-3">
        <Olho>Como começamos</Olho>
        <ol className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {PASSOS.map((k, i) => (
            <li key={k.titulo} className="grid content-start gap-1.5 rounded-[16px] border border-linha bg-superficie p-4">
              <span className="flex items-center gap-3">
                <span className="inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[9px] bg-violeta-100 t-codigo text-violeta-600">{String(i + 1).padStart(2, "0")}</span>
                <span className="t-titulo-cartao font-bold">{k.titulo}</span>
              </span>
              <span className="t-apoio">{k.texto}</span>
            </li>
          ))}
        </ol>
      </div>
      {children}
    </Parte>
  );
}

/** A apresentação inteira; `extra` entra entre o escopo e as condições, `aceite` no fim das condições. */
export function ApresentacaoProposta({ a, extra, aceite }: { a: Apresentacao; extra?: ReactNode; aceite?: ReactNode }) {
  return (
    <>
      <Capa a={a} />
      <nav aria-label="Partes da proposta" className="flex flex-wrap gap-2">
        {PARTES.map((p, i) => (
          <a key={p.id} href={`#${p.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-linha bg-superficie px-4 t-texto text-tinta no-underline">
            <span className="font-mono text-tinta-suave">{String(i + 1).padStart(2, "0")}</span>{["Investimento", "Escopo e equipe", "Condições e aceite"][i]}
          </a>
        ))}
      </nav>
      <Investimento a={a} />
      <Escopo a={a} />
      {extra}
      <Condicoes a={a}>{aceite}</Condicoes>
    </>
  );
}

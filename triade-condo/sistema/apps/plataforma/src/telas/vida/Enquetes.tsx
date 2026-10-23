"use client";
// Vida em condomínio › Enquetes (design "Vida em condomínio", tela 4; DC15, telas-modelo
// vida-enquetes-*; AC-03): abas Abertas e Encerradas. O cartão inteiro abre a enquete, com o
// resultado enquanto corre, quantos faltam e o lembrete; encerrar e publicar o resultado ficam na
// ficha. Na enquete secreta, o síndico vê quem respondeu, nunca o que respondeu.

import Link from "next/link";
import { useState } from "react";
import { formatarDataHora, porcentagem } from "@triade/domain";
import { Carregando, ErroCarregar, Icone, Selo, Vazio } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { EnqueteTela, ListaEnquetes, ResultadoEnquete } from "../tipos.ts";

/** "31/10, 23:59". */
export function prazoCurto(iso: string): string {
  const x = formatarDataHora(iso);
  return `${x.slice(0, 5)}, ${x.slice(11)}`;
}

const ABAS = { ABERTA: "Abertas", ENCERRADA: "Encerradas" } as const;
type Aba = keyof typeof ABAS;

export function AbaEnquetes() {
  const carga = useCarregar<ListaEnquetes>("/v1/condominio/enquetes");
  const [aba, setAba] = useState<Aba>("ABERTA");
  const l = carga.estado === "pronto" ? carga.dados : null;
  const daAba = (a: Aba) => l?.enquetes.filter((e) => (a === "ABERTA" ? e.situacao === "ABERTA" : e.situacao !== "ABERTA")) ?? [];
  const lista = daAba(aba);

  return (
    <div className="grid gap-5">
      <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha">
        {(Object.keys(ABAS) as Aba[]).map((a) => {
          const atual = aba === a;
          const n = l ? daAba(a).length : 0;
          return (
            <button key={a} type="button" aria-pressed={atual} onClick={() => setAba(a)}
              className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
              {ABAS[a]}
              {n ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span></> : null}
            </button>
          );
        })}
      </nav>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando as enquetes…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="as enquetes" /> : null}
      {l ? (
        lista.length === 0 ? (
          <Vazio titulo={aba === "ABERTA" ? "Nenhuma enquete aberta" : "Nenhuma enquete encerrada"} icone="grafico">
            {aba === "ABERTA" ? "Uma pergunta, de 2 a 6 opções e um prazo. Cada unidade recebe um link só dela, pelo WhatsApp ou pelo e-mail, e responde sem conta." : "A enquete encerrada fica aqui, com o resultado."}
          </Vazio>
        ) : (
          <ul aria-label="Enquetes" className="grid items-start gap-5 lg:grid-cols-2">
            {lista.map((e) => <CartaoEnquete key={e.id} e={e} />)}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function Barras({ r, marcar }: { r: ResultadoEnquete; marcar?: number }) {
  const votos = r.opcoes.reduce((s, o) => s + o.votos, 0);
  return (
    <ul className="grid gap-2.5">
      {r.opcoes.map((o, i) => {
        const p = porcentagem(o.votos, votos);
        return (
          <li key={i} className="grid gap-1 t-texto">
            <span className="flex justify-between gap-2">
              <span className={marcar === i + 1 ? "font-medium" : ""}>{o.texto}{marcar === i + 1 ? " (sua resposta)" : ""}</span>
              <span className="text-tinta-suave">{o.votos} · {p}%</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
              <span className="block h-full rounded-full bg-[image:var(--grad-acao)]" style={{ width: `${p}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Aberta até 26/10, 22:30" ou "Encerrada em 20/10". */
export function SeloEnquete({ e }: { e: Pick<EnqueteTela, "situacao" | "abertaAte" | "encerradaEm"> }) {
  return e.situacao === "ABERTA"
    ? <Selo tom="andamento">Aberta até {prazoCurto(e.abertaAte)}</Selo>
    : <Selo tom="neutro">Encerrada{e.encerradaEm ? ` em ${prazoCurto(e.encerradaEm).slice(0, 5)}` : ""}</Selo>;
}

function CartaoEnquete({ e }: { e: EnqueteTela }) {
  const r = e.resultado;
  const faltam = r.total - r.responderam;
  const quem = e.por === "UNIDADE" ? "unidades" : "pessoas";
  return (
    <li className="relative grid gap-3.5 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 hover:border-violeta-300 max-md:p-4">
      <span className="flex items-start gap-3">
        <span className="ladrilho h-10 w-10 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="grafico" /></span>
        <span className="grid min-w-0 flex-1 gap-1.5">
          <Link href={`/vida/enquete?id=${e.id}`} className="t-titulo-cartao after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{e.pergunta}</Link>
          <span className="flex flex-wrap gap-1.5">
            <SeloEnquete e={e} />
            {e.secreta ? <Selo tom="neutro">Respostas secretas</Selo> : null}
          </span>
        </span>
        <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
      </span>
      <Barras r={r} />
      <span className="flex flex-wrap justify-between gap-2 t-apoio text-tinta-suave">
        <span><b className="font-semibold text-tinta">{r.responderam} de {r.total} {quem}</b> responderam ({porcentagem(r.responderam, r.total)}%){e.situacao === "ABERTA" && faltam ? ` · ${faltam} ainda não` : ""}</span>
        {e.situacao === "ABERTA"
          ? <span>{e.lembreteEnviadoEm ? `Lembrete enviado em ${prazoCurto(e.lembreteEnviadoEm).slice(0, 5)}` : e.lembreteEm ? `Lembrete em ${prazoCurto(e.lembreteEm).slice(0, 5)}, só para quem falta` : "Sem lembrete: o prazo é curto"}</span>
          : e.comunicado ? <span>Resultado em Comunicados</span> : null}
      </span>
    </li>
  );
}

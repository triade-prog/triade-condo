"use client";
// Hoje na agenda, no início (design "Telas da Agenda", tela 6; AG-03, TR-11): o que está
// marcado para hoje e uma linha sobre os próximos dias.

import Link from "next/link";
import { diaDaSemana, somarDias } from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { Agenda } from "../tipos.ts";
import { LinhaCompromisso } from "./comum.tsx";

function hojeAqui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const quantos = (n: number) => (n === 0 ? "nada marcado" : n === 1 ? "1 compromisso" : `${n} compromissos`);

export function HojeNaAgenda() {
  const de = hojeAqui();
  const carga = useCarregar<Agenda>(`/v1/condominio/agenda?de=${somarDias(de, -1)}&ate=${somarDias(de, 7)}`);
  const titulo = <h2 id="t-hoje-agenda" className="text-lg font-medium">Hoje na agenda</h2>;
  const cabeca = (
    <div className="flex items-center justify-between gap-2">
      {titulo}
      <Link href="/agenda" className={classeBotao("discreto", "", "m")}>Ver agenda</Link>
    </div>
  );
  return (
    <section aria-labelledby="t-hoje-agenda" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      {cabeca}
      {carga.estado === "carregando" ? <Carregando linhas={2} rotulo="Carregando a agenda…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <Conteudo dados={carga.dados} /> : null}
    </section>
  );
}

function Conteudo({ dados }: { dados: Agenda }) {
  const hoje = dados.hoje;
  const ativos = dados.compromissos.filter((c) => c.estado !== "CANCELADO");
  const deHoje = ativos.filter((c) => c.data === hoje);
  const amanha = somarDias(hoje, 1);
  const nAmanha = ativos.filter((c) => c.data === amanha).length;
  const proximo = ativos.find((c) => c.data > amanha);
  const linha = [`Amanhã: ${quantos(nAmanha)}.`];
  if (proximo) {
    const n = ativos.filter((c) => c.data === proximo.data).length;
    linha.push(`${diaDaSemana(proximo.data).replace(/^./, (x) => x.toUpperCase())}: ${quantos(n)}.`);
  }
  return (
    <>
      {deHoje.length ? (
        <ul className="grid gap-2">{deHoje.map((c) => <LinhaCompromisso key={c.id} c={c} />)}</ul>
      ) : <p className="text-sm text-tinta-suave">Nada marcado para hoje.</p>}
      <p className="text-sm text-tinta-suave">{linha.join(" ")}</p>
    </>
  );
}

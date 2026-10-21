"use client";
// Hoje na agenda, no início (design "Telas da Agenda", tela 6; AG-03, TR-11): o que está
// marcado para hoje e uma linha sobre os próximos dias.

import { diaDaSemana, somarDias } from "@triade/domain";
import { Carregando, ErroCarregar } from "@triade/ui";
import { CartaoInicio } from "../CartaoInicio.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Agenda } from "../tipos.ts";
import { LinhaCompromisso, LinhaDataDeFora } from "./comum.tsx";

function hojeAqui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const quantos = (n: number) => (n === 0 ? "nada marcado" : n === 1 ? "1 compromisso" : `${n} compromissos`);

export function HojeNaAgenda() {
  const de = hojeAqui();
  const carga = useCarregar<Agenda>(`/v1/condominio/agenda?de=${somarDias(de, -1)}&ate=${somarDias(de, 7)}`);
  return (
    <CartaoInicio titulo="Hoje na agenda" icone="calendario" href="/agenda">
      {carga.estado === "carregando" ? <Carregando linhas={2} rotulo="Carregando a agenda…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <Conteudo dados={carga.dados} /> : null}
    </CartaoInicio>
  );
}

function Conteudo({ dados }: { dados: Agenda }) {
  const hoje = dados.hoje;
  const ativos = dados.compromissos.filter((c) => c.estado !== "CANCELADO");
  const deHoje = ativos.filter((c) => c.data === hoje);
  // As reservas confirmadas e as assembleias de hoje (peça R12, AG-09), entre os compromissos pela hora.
  const reservas = dados.datas.filter((d) => d.data === hoje && (d.fonte === "RESERVA" || d.fonte === "ASSEMBLEIA"));
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
      {deHoje.length + reservas.length ? (
        <ul className="grid gap-2">
          {[...deHoje.map((c) => ({ hora: c.horaInicio ?? "", item: <LinhaCompromisso key={c.id} c={c} /> })),
            ...reservas.map((d) => ({ hora: d.horaInicio ?? "", item: <LinhaDataDeFora key={d.id} d={d} hoje={hoje} /> }))]
            .sort((a, b) => a.hora.localeCompare(b.hora)).map((x) => x.item)}
        </ul>
      ) : <p className="t-apoio">Nada marcado para hoje.</p>}
      <p className="t-apoio">{linha.join(" ")}</p>
    </>
  );
}

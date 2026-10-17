"use client";
// Indicadores do atendimento (passo 7; F7.2, TR-01, TR-03, TR-07). A métrica principal é a
// porcentagem de retornos dados no prazo; ao lado, o tempo até o primeiro retorno, os
// concluídos e os reabertos, e a mesma conta por categoria. Sem nenhum caso no período, a tela
// diz "sem dados", nunca zero. Cada número explica a base de cálculo.

import { useRouter, useSearchParams } from "next/navigation";
import { mostrarHoras, mostrarPorcentagem, PERIODOS_INDICADORES, type PeriodoIndicadores } from "@triade/domain";
import { Carregando, ErroCarregar, Vazio } from "@triade/ui";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { Indicadores as Dados } from "./tipos.ts";

const ANTERIOR: Record<PeriodoIndicadores, string> = {
  ESTE_MES: "Mês passado",
  MES_PASSADO: "O mês antes dele",
  TRES_MESES: "Os 3 meses antes",
};

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="grid content-start gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

const nada = (v: number | null | undefined) => v === null || v === undefined;

export function Indicadores() {
  const { pode } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const periodo = (Object.keys(PERIODOS_INDICADORES) as PeriodoIndicadores[]).find((p) => p === busca.get("periodo")) ?? "ESTE_MES";
  const carga = useCarregar<Dados>(pode("pedidos.ver") ? `/v1/condominio/indicadores?periodo=${periodo}` : null);

  const cabecalho = (
    <div>
      <h1 className="text-[28px] font-normal tracking-tight">Indicadores</h1>
      <p className="mt-1 text-tinta-suave">Como o condomínio está respondendo aos moradores. Tudo sai do histórico dos pedidos.</p>
    </div>
  );
  if (!pode("pedidos.ver")) return <div className="grid gap-4">{cabecalho}<Vazio titulo="Sem acesso">Os indicadores aparecem para quem pode ver os pedidos.</Vazio></div>;

  const filtros = (
    <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
      {(Object.entries(PERIODOS_INDICADORES) as [PeriodoIndicadores, string][]).map(([valor, texto]) => (
        <button key={valor} type="button" aria-pressed={valor === periodo} onClick={() => router.replace(`/indicadores?periodo=${valor}`, { scroll: false })}
          className="min-h-10 rounded-full border border-linha px-4 text-sm aria-pressed:border-acao aria-pressed:bg-selecao aria-pressed:font-medium aria-pressed:text-selecao-tinta">
          {texto}
        </button>
      ))}
    </div>
  );

  if (carga.estado === "carregando") return <div className="grid gap-4">{cabecalho}{filtros}<Carregando rotulo="Calculando os indicadores…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{cabecalho}{filtros}<ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const { atual: a, porcentagemAnterior } = carga.dados;
  const r = a.retornos;
  return (
    <div className="grid gap-5">
      {cabecalho}
      {filtros}
      <div className="grid gap-3 md:grid-cols-3">
        <Cartao titulo="Retornos no prazo">
          <p className="text-2xl font-semibold">{mostrarPorcentagem(r.porcentagem)}</p>
          <p className="text-xs text-tinta-suave">
            {nada(r.porcentagem) ? "Nenhum retorno combinado no período." : `${r.noPrazo} de ${r.total} retornos dados até o prazo combinado.`}
            {" "}{ANTERIOR[periodo]}: {mostrarPorcentagem(porcentagemAnterior)}.
          </p>
        </Cartao>
        <Cartao titulo="Primeiro retorno">
          <p className="text-2xl font-semibold">{mostrarHoras(a.primeiroRetornoHoras)}</p>
          <p className="text-xs text-tinta-suave">Média de horas de atendimento entre o registro e o primeiro retorno, dos pedidos registrados no período.</p>
        </Cartao>
        <Cartao titulo="Concluídos e reabertos">
          <p><strong className="text-2xl font-semibold">{a.concluidos}</strong> concluídos · <strong className="text-2xl font-semibold">{a.reabertos}</strong> reabertos</p>
          <p className="text-xs text-tinta-suave">{a.registrados} {a.registrados === 1 ? "pedido registrado" : "pedidos registrados"} no período.</p>
        </Cartao>
      </div>
      {a.porCategoria.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
          <table className="w-full text-sm">
            <caption className="sr-only">Indicadores por categoria</caption>
            <thead className="bg-superficie-2 text-left text-tinta-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Categoria</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Retornos no prazo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Concluídos</th>
              </tr>
            </thead>
            <tbody>
              {a.porCategoria.map((c) => (
                <tr key={c.categoriaId} className="border-t border-linha">
                  <td className="px-4 py-2.5">{c.nome}</td>
                  <td className="px-4 py-2.5">{nada(c.porcentagem) ? "Sem dados" : `${mostrarPorcentagem(c.porcentagem)} (${c.noPrazo} de ${c.retornos})`}</td>
                  <td className="px-4 py-2.5">{c.concluidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-sm text-tinta-suave">
        Um retorno está no prazo quando é registrado antes de o retorno combinado vencer. Retorno combinado que venceu sem notícia conta como fora do prazo. Nota interna não conta. Pedido privado entra na conta, sem aparecer.
      </p>
    </div>
  );
}

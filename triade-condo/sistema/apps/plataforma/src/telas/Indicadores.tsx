"use client";
// Indicadores do atendimento (passo 7; F7.2, TR-01, TR-03, TR-07). A métrica principal é a
// porcentagem de retornos dados no prazo; ao lado, o tempo até o primeiro retorno, os
// concluídos e os reabertos, e a mesma conta por categoria. Abaixo, as pendências de cada
// responsável agora e o tempo de solução de cada categoria no período (design "Agenda,
// indicadores e unidades", tela 2). Sem nenhum caso no período, a tela diz "sem dados", nunca
// zero. Cada número explica a base de cálculo. Da F7.4 (TR-01): a reincidência no período, com
// onde o problema volta (AT-18), e as decisões aguardando o síndico (AT-23).

import { useRouter, useSearchParams } from "next/navigation";
import { mostrarDuracao, mostrarHoras, mostrarPorcentagem, PERIODOS_INDICADORES, type PeriodoIndicadores } from "@triade/domain";
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
const dias = (n: number) => (n === 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`);

const TH = "px-4 py-2.5 font-semibold";
const TD = "px-4 py-2.5";

/** Uma tabela de indicador, com a base de cálculo embaixo. */
function Tabela({ titulo, colunas, linhas, base, vazio }: { titulo: string; colunas: string[]; linhas: React.ReactNode[][]; base: string; vazio: string }) {
  return (
    <section aria-label={titulo} className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 className="text-lg font-medium">{titulo}</h2>
      {linhas.length ? (
        // Rola de lado no celular; com tabIndex, também pelo teclado.
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead className="text-left text-tinta-suave">
              <tr>{colunas.map((c, i) => <th key={c} scope="col" className={`${TH} ${i ? "" : "pl-0"}`}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-t border-linha">
                  {l.map((c, j) => j === 0 ? <th key={j} scope="row" className={`${TD} pl-0 text-left font-normal`}>{c}</th> : <td key={j} className={TD}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-tinta-suave">{vazio}</p>}
      <p className="text-xs text-tinta-suave">{base}</p>
    </section>
  );
}

/** Reincidência no período (AT-18): reincidentes sobre os abertos, e onde volta. */
function Reincidencia({ r }: { r: NonNullable<Dados["reincidencia"]> }) {
  return (
    <section aria-labelledby="t-reincidencia" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-reincidencia" className="text-lg font-medium">Reincidência</h2>
      <p>
        {nada(r.porcentagem) ? <strong className="text-2xl font-semibold">Sem dados</strong> : (
          <><strong className="text-2xl font-semibold">{r.reincidencias}</strong> de {r.pedidos} {r.pedidos === 1 ? "pedido" : "pedidos"} · <strong className="text-2xl font-semibold">{mostrarPorcentagem(r.porcentagem)}</strong></>
        )}
      </p>
      {r.ondeVolta.length ? (
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <caption className="sr-only">Onde o problema volta</caption>
            <thead className="text-left text-tinta-suave">
              <tr>
                <th scope="col" className={`${TH} pl-0`}>Onde volta</th><th scope="col" className={TH}>Categoria</th>
                <th scope="col" className={TH}>Vezes</th><th scope="col" className={TH}>Última</th>
              </tr>
            </thead>
            <tbody>
              {r.ondeVolta.map((o, i) => (
                <tr key={i} className="border-t border-linha">
                  <th scope="row" className={`${TD} pl-0 text-left font-normal`}>{o.onde ?? "Sem local"}</th>
                  <td className={TD}>{o.categoria}</td><td className={TD}>{o.vezes}</td><td className={`${TD} font-mono`}>{o.ultima}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-tinta-suave">
        Pedidos abertos no período e ligados como reincidência de um pedido concluído, sobre todos os pedidos abertos no período, no fuso do condomínio. Duplicado não conta. Sem pedido no período, &quot;sem dados&quot;; com pedidos e nenhuma reincidência, 0%. Reincidência é sinal para investigar, não causa confirmada.
      </p>
    </section>
  );
}

/** Decisões aguardando o síndico (AT-23): aguardando é de agora; decididas e tempo típico, do período. */
function DecisoesAguardando({ x }: { x: NonNullable<Dados["decisoes"]> }) {
  const numero = (n: React.ReactNode, texto: string) => (
    <li className="grid gap-0.5"><strong className="text-2xl font-semibold">{n}</strong><span className="text-xs text-tinta-suave">{texto}</span></li>
  );
  return (
    <section aria-labelledby="t-decisoes" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-decisoes" className="text-lg font-medium">Decisões aguardando o síndico</h2>
      <ul className="grid grid-cols-3 gap-3">
        {numero(x.aguardando, "aguardando agora")}
        {numero(x.vencidas, "com prazo vencido")}
        {numero(nada(x.maisAntigaDias) ? "—" : dias(x.maisAntigaDias!), "a mais antiga")}
      </ul>
      <ul className="grid grid-cols-3 gap-3 border-t border-linha pt-3">
        {numero(x.decididas, x.decididas === 1 ? "decidida no período" : "decididas no período")}
        {numero(`${x.aprovadas} · ${x.devolvidas}`, "aprovadas · devolvidas")}
        {numero(x.decididas ? mostrarDuracao(x.medianaHoras) : "Sem dados", "tempo típico")}
      </ul>
      <p className="text-xs text-tinta-suave">
        Aguardando é de agora, não do período: pedidos de decisão sem resposta, com o prazo no fuso do condomínio. Decididas e tempo típico (mediana, do pedido até a resposta) usam o período escolhido; devolvida conta como decidida. Sem nenhuma decisão no período, &quot;sem dados&quot;.
      </p>
    </section>
  );
}

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
          className="min-h-10 rounded-full border border-linha px-4 text-sm aria-pressed:border-violeta-600 aria-pressed:bg-violeta-100 aria-pressed:font-medium aria-pressed:text-violeta-700">
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
      <div className="grid gap-3 lg:grid-cols-2">
        <Tabela titulo="Pendências por responsável" colunas={["Responsável", "Abertos", "Retorno vencido", "Mais antigo"]}
          linhas={carga.dados.pendencias.map((p) => [p.nome ?? "Sem responsável", p.abertos, p.retornoVencido, dias(p.maisAntigoDias)])}
          vazio="Nenhum pedido aberto ou em andamento agora."
          base="Agora, não no período: pedidos abertos ou em andamento, pelo responsável de hoje. Retorno vencido conta o próximo retorno que já passou. Mais antigo é a idade do pedido aberto há mais tempo." />
        <Tabela titulo="Tempo de solução por categoria" colunas={["Categoria", "Concluídos", "Tempo típico", "Mais demorado"]}
          linhas={carga.dados.solucao.map((x) => [x.nome, x.concluidos, nada(x.medianaHoras) ? "Sem dados" : mostrarDuracao(x.medianaHoras),
            nada(x.maisDemoradoHoras) ? "" : mostrarDuracao(x.maisDemoradoHoras)])}
          vazio="Nenhuma categoria ativa."
          base="Pedidos concluídos no período, da abertura até a conclusão, em horas corridas. Tempo típico é a mediana: metade dos pedidos levou menos que isso. O pedido reaberto conta da primeira abertura até a última conclusão. Sem pedido concluído, a linha diz sem dados, nunca zero." />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {carga.dados.reincidencia ? <Reincidencia r={carga.dados.reincidencia} /> : null}
        {carga.dados.decisoes ? <DecisoesAguardando x={carga.dados.decisoes} /> : null}
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

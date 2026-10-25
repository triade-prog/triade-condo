"use client";
// Quanto custaria para o prédio (quadro 270): o número de unidades ativas, digitado ou no controle
// deslizante, e o que a TRÍADE cobraria no fundador e na tabela cheia, com os valores da aba Tabela.
// Ao lado, os preços públicos dos concorrentes, cadastrados à mão com fonte e data. Acima de 400
// unidades a TRÍADE fica sob consulta. Só quem muda a tabela cadastra ou arquiva um concorrente.

import { useState, type CSSProperties } from "react";
import { mostrarDataSemHora, mostrarValor } from "@triade/domain";
import { Botao, Icone } from "@triade/ui";
import { faixaDe, nomeFaixa, NOMES_TABELA, type Concorrente, type TabelaPrecos } from "./comum.tsx";
import { JanelaArquivarConcorrente, JanelaConcorrente } from "./janelasPrecos.tsx";
import type { Recado } from "./TabelaPrecos.tsx";

const MINIMO = 1;
const MAXIMO_CAMPO = 2000;
const MAXIMO_CONTROLE = 600;

interface Barra {
  chave: string;
  nome: string;
  /** Centavos que dão o tamanho da barra. */
  largura: number;
  texto: string;
  tipo: "fundador" | "cheia" | "concorrente";
  /** "A partir de", sob consulta ou de terceiros sem conferência. */
  tracejado: boolean;
}

/** O preço de um concorrente para n unidades. */
export function precoConcorrente(c: Concorrente, n: number): { valor?: number; ultimo?: number } {
  if (c.modelo === "POR_UNIDADE") return c.porUnidade === undefined ? {} : { valor: Math.max(c.minimo ?? 0, c.porUnidade * n) };
  if (c.modelo === "FAIXA") {
    const f = c.faixas.find((x) => x.ate === undefined || n <= x.ate);
    const conhecidos = c.faixas.filter((x) => x.valor !== undefined);
    return { valor: f?.valor, ultimo: conhecidos.at(-1)?.valor };
  }
  return { valor: c.valor };
}

/** O nome com o plano ("HabitaOne Essencial"): o mesmo concorrente pode ter mais de um plano. */
const nomeConcorrente = (c: Concorrente) => (c.plano ? `${c.nome} ${c.plano}` : c.nome);

/** Como o preço do concorrente se lê na linha da barra. */
function textoConcorrente(c: Concorrente, valor?: number): string {
  if (valor === undefined) return "sob consulta";
  if (c.aPartirDe) return `a partir de ${mostrarValor(valor)}`;
  return c.conferido ? mostrarValor(valor) : `≈ ${mostrarValor(valor)}, sem conferência`;
}

/** O resumo de como o concorrente cobra, na lista dos cadastrados. */
export function resumoConcorrente(c: Concorrente): string {
  if (c.modelo === "POR_UNIDADE") return `${mostrarValor(c.porUnidade)} por unidade${c.minimo ? `, mínimo de ${mostrarValor(c.minimo)}` : ""}`;
  if (c.modelo === "FAIXA") {
    const partes = c.faixas.map((f) => (f.ate === undefined ? `acima, ${f.valor === undefined ? "sob consulta" : mostrarValor(f.valor)}` : `${mostrarValor(f.valor)} até ${f.ate} un.`));
    const ultima = c.faixas.at(-1);
    return [...partes, ...(ultima && ultima.ate !== undefined ? ["acima, sob consulta"] : [])].join("; ");
  }
  return `${c.aPartirDe ? "a partir de " : ""}${mostrarValor(c.valor)} por mês`;
}

/** As contas da simulação para n unidades, com os valores da tabela. */
export function simular(d: TabelaPrecos, n: number) {
  const { parametros: p } = d;
  const faixa = faixaDe(d.faixas, n);
  const consulta = !faixa || faixa.sobConsulta;
  const f = consulta ? undefined : faixa;
  const vezes = (c: number | undefined, k: number) => (c === undefined ? undefined : c * k);
  const anoCheiaMensal = f?.cheia !== undefined && f.implantacao !== undefined ? f.cheia * 12 + f.implantacao : undefined;
  return {
    faixa, consulta,
    faixaNome: consulta ? `${faixa ? nomeFaixa(faixa).toLowerCase() : "acima da tabela"}, sob consulta` : nomeFaixa(f!),
    fundadorMes: f?.fundador, cheiaMes: f?.cheia, implantacao: f?.implantacao,
    anoFundador: vezes(f?.fundador, 12), anoCheiaMensal, anoCheiaAnual: vezes(f?.cheia, p.mesesPagosAnual),
  };
}

function barras(d: TabelaPrecos, n: number): Barra[] {
  const s = simular(d, n);
  const ultimaFaixa = [...d.faixas].reverse().find((f) => !f.sobConsulta);
  const emUso = d.parametros.tabelaEmUso;
  const triade = (tipo: "fundador" | "cheia"): Barra => {
    const valor = tipo === "fundador" ? s.fundadorMes : s.cheiaMes;
    const ultimo = tipo === "fundador" ? ultimaFaixa?.fundador : ultimaFaixa?.cheia;
    const tabela = tipo === "fundador" ? "FUNDADOR" : "CHEIA";
    return {
      chave: tipo, nome: `TRÍADE ${tipo === "fundador" ? "fundador" : "tabela cheia"}${emUso === tabela ? " (em uso)" : ""}`, tipo,
      largura: valor ?? ultimo ?? 0, texto: s.consulta ? "sob consulta" : mostrarValor(valor), tracejado: s.consulta || valor === undefined,
    };
  };
  const deles = d.concorrentes.map((c): Barra => {
    const { valor, ultimo } = precoConcorrente(c, n);
    return { chave: c.id, nome: nomeConcorrente(c), tipo: "concorrente", largura: valor ?? ultimo ?? 0, texto: textoConcorrente(c, valor),
      tracejado: valor === undefined || c.aPartirDe || !c.conferido };
  });
  return [triade("fundador"), triade("cheia"), ...deles];
}

const LISTRADO: CSSProperties = { backgroundImage: "repeating-linear-gradient(135deg, var(--color-laranja-500) 0 6px, var(--color-laranja-800) 6px 9px)" };

function classeBarra(b: Barra): string {
  const base = "block h-full rounded-full";
  if (b.tracejado) return `${base} border border-dashed bg-transparent ${b.tipo === "concorrente" ? "border-tinta-suave" : "border-violeta-600"}`;
  return `${base} ${b.tipo === "fundador" ? "bg-laranja-500" : b.tipo === "cheia" ? "" : "bg-contorno"}`;
}

function Resumo({ titulo, valor, apoio }: { titulo: string; valor?: number; apoio: string }) {
  return (
    <section aria-label={titulo} className="grid content-start gap-0.5 rounded-[18px] border border-linha bg-superficie p-[18px] shadow-s1">
      <span className="t-apoio">{titulo}</span>
      <span className="t-titulo-secao font-medium tabular-nums">{mostrarValor(valor)}</span>
      <span className="t-apoio">{apoio}</span>
    </section>
  );
}

type Janela = { tipo: "novo" } | { tipo: "editar"; c: Concorrente } | { tipo: "arquivar"; c: Concorrente } | null;

export function Simulador({ d, edita, avisar, feito, recarregar, unidades }: {
  d: TabelaPrecos; edita: boolean; avisar: (r: Recado) => void; feito: (texto: string) => void; recarregar: () => void;
  /** As unidades do prédio, quando o simulador abre da proposta. */
  unidades?: number;
}) {
  const inicial = unidades && unidades >= MINIMO ? Math.min(MAXIMO_CAMPO, Math.trunc(unidades)) : 100;
  const [n, setN] = useState(inicial);
  const [texto, setTexto] = useState(String(inicial));
  const [janela, setJanela] = useState<Janela>(null);
  const s = simular(d, n);
  const lista = barras(d, n);
  const maior = Math.max(1, ...lista.map((b) => b.largura));
  const lidoEm = d.concorrentes.map((c) => c.lidoEm).filter(Boolean).sort().at(-1);
  const p = d.parametros;

  const fixar = (v: number) => { const x = Math.min(MAXIMO_CAMPO, Math.max(MINIMO, Math.trunc(v))); setN(x); setTexto(String(x)); };
  function digitar(v: string) {
    setTexto(v);
    const x = Number.parseInt(v, 10);
    if (Number.isFinite(x)) setN(Math.min(MAXIMO_CAMPO, Math.max(MINIMO, x)));
  }

  async function copiar() {
    const linhas = s.consulta
      ? [`Simulação TRÍADE Condo para ${n} unidades ativas: acima de 400 unidades, sob consulta.`]
      : [
        `Simulação TRÍADE Condo para ${n} unidades ativas (faixa ${s.faixaNome}):`,
        `- ${NOMES_TABELA.FUNDADOR}: ${mostrarValor(s.fundadorMes)} por mês, implantação sem custo; 1º ano ${mostrarValor(s.anoFundador)}.`,
        `- Tabela cheia, mensal: ${mostrarValor(s.cheiaMes)} por mês e implantação de ${mostrarValor(s.implantacao)}; 1º ano ${mostrarValor(s.anoCheiaMensal)}.`,
        `- Tabela cheia, anual: ${mostrarValor(s.anoCheiaAnual)} por ano (12 meses pelo preço de ${p.mesesPagosAnual}), sem implantação.`,
        "Preço final, com impostos.",
      ];
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      avisar({ tom: "ok", texto: "Simulação copiada." });
    } catch {
      avisar({ tom: "erro", texto: "Não deu para copiar. Tente de novo ou copie os valores da tela." });
    }
  }

  const fechar = () => setJanela(null);
  const pronto = (t: string) => { fechar(); feito(t); };

  return (
    <div className="grid gap-5 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-2 max-md:w-full">
          <label htmlFor="sim-unidades" className="font-semibold">Unidades ativas do prédio</label>
          <div className="flex flex-wrap items-center gap-2">
            <Botao variante="contorno" soIcone aria-label="Menos 1 unidade" className="t-titulo-secao" onClick={() => fixar(n - 1)}>−</Botao>
            <input id="sim-unidades" type="number" inputMode="numeric" min={MINIMO} max={MAXIMO_CAMPO} value={texto} className="campo w-[120px]"
              onChange={(e) => digitar(e.target.value)} onBlur={() => setTexto(String(n))} />
            <input type="range" min={MINIMO} max={MAXIMO_CONTROLE} step={1} value={Math.min(n, MAXIMO_CONTROLE)} onChange={(e) => fixar(Number(e.target.value))}
              aria-label="Unidades ativas, controle deslizante" aria-valuetext={`${n} unidades, faixa ${s.faixaNome}`}
              className="min-h-11 w-80 max-w-full accent-violeta-600 max-md:order-last max-md:w-full" />
            <Botao variante="contorno" soIcone aria-label="Mais 1 unidade" className="t-titulo-secao" onClick={() => fixar(n + 1)}>+</Botao>
          </div>
        </div>
        <div className="grid justify-items-end max-md:justify-items-start">
          <span aria-live="polite" className="t-titulo-tela font-semibold text-violeta-600">{`${n} unidades`}</span>
          <span className="t-apoio">{`Faixa: ${s.faixaNome}`}</span>
        </div>
      </div>

      <div aria-live="polite" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Resumo titulo="1º ano no fundador" valor={s.anoFundador} apoio="12 meses, sem implantação" />
        <Resumo titulo="Fundador por mês" valor={s.fundadorMes} apoio="implantação sem custo" />
        <Resumo titulo="Tabela cheia por mês" valor={s.cheiaMes} apoio={`implantação ${s.implantacao === undefined ? "a definir" : mostrarValor(s.implantacao)}`} />
        <Resumo titulo="1º ano na cheia, mensal" valor={s.anoCheiaMensal} apoio="12 meses e a implantação" />
        <Resumo titulo="1º ano na cheia, anual" valor={s.anoCheiaAnual} apoio={`12 por ${p.mesesPagosAnual}, sem implantação`} />
      </div>

      <ul aria-label="Comparação por mês" className="grid gap-2">
        {lista.map((b) => (
          <li key={b.chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 t-texto md:grid-cols-[220px_minmax(0,1fr)_170px]">
            <span className={b.tipo === "concorrente" ? "font-medium" : "font-bold"}>{b.nome}</span>
            <span aria-hidden="true" className="h-3.5 overflow-hidden rounded-full bg-superficie-2 max-md:col-span-2 max-md:row-start-2">
              <span className={classeBarra(b)} style={{ width: `${((b.largura / maior) * 100).toFixed(1)}%`, ...(b.tipo === "cheia" && !b.tracejado ? LISTRADO : {}) }} />
            </span>
            <span className="text-right t-apoio text-tinta tabular-nums">{b.texto}</span>
          </li>
        ))}
      </ul>
      <p className="t-apoio">
        Laranja cheio: TRÍADE fundador; laranja listrado: TRÍADE tabela cheia, com os valores da aba Tabela. Tracejado: “a partir de”, sob consulta ou preço de terceiros sem conferência.
        {" "}Mensalidade sem implantação. Acima de 400 unidades, a TRÍADE fica sob consulta.
        {lidoEm ? ` Preços públicos dos concorrentes conferidos nos sites em ${mostrarDataSemHora(lidoEm)}.` : " Nenhum preço de concorrente cadastrado."}
      </p>
      <div className="flex flex-wrap gap-2">
        {edita ? <Botao variante="contorno" className="!h-auto min-h-11 max-w-full py-2 text-left whitespace-normal" onClick={() => setJanela({ tipo: "novo" })}><Icone nome="mais" />Cadastrar preço de concorrente (à mão, com fonte e data)</Botao> : null}
        <Botao variante="discreto" onClick={() => void copiar()}><Icone nome="copiar" />Copiar a simulação</Botao>
      </div>

      {d.concorrentes.length ? (
        <section aria-labelledby="sim-cadastrados" className="grid gap-1">
          <h2 id="sim-cadastrados" className="t-titulo-cartao">Preços de concorrentes cadastrados</h2>
          <ul className="grid divide-y divide-linha">
            {d.concorrentes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{nomeConcorrente(c)}</span>
                  <span className="t-apoio [overflow-wrap:anywhere]">
                    {`${resumoConcorrente(c)} · ${c.fonte}, ${mostrarDataSemHora(c.lidoEm)}${c.conferido ? "" : " · de terceiros, sem conferência"}`}
                  </span>
                </span>
                {edita ? (
                  <span className="flex gap-1.5">
                    <Botao variante="discreto" tamanho="m" aria-label={`Editar: ${nomeConcorrente(c)}`} onClick={() => setJanela({ tipo: "editar", c })}><Icone nome="editar" />Editar</Botao>
                    <Botao variante="discreto" tamanho="m" aria-label={`Arquivar: ${nomeConcorrente(c)}`} onClick={() => setJanela({ tipo: "arquivar", c })}>Arquivar</Botao>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {janela?.tipo === "novo" ? <JanelaConcorrente aoFechar={fechar} feito={pronto} recarregar={recarregar} /> : null}
      {janela?.tipo === "editar" ? <JanelaConcorrente c={janela.c} aoFechar={fechar} feito={pronto} recarregar={recarregar} /> : null}
      {janela?.tipo === "arquivar" ? <JanelaArquivarConcorrente c={janela.c} aoFechar={fechar} feito={pronto} recarregar={recarregar} /> : null}
    </div>
  );
}


// O custo por apartamento nas páginas de venda (DC17; CM-33): Início e Preços. Nenhum valor é
// escrito à mão: a tabela cheia por apartamento sai de precoDoSite (a mesma conta da calculadora,
// mensalidade dividida pelas unidades, em centavos) e o peso na taxa, de custoNaTaxa (a regra única
// do domínio). O "menos de R$ 5" só vale onde a conta dá menos de R$ 5 (EM-07); por isso a frase
// principal usa um prédio de exemplo e manda fazer a conta do prédio na calculadora.

import { dinheiro, formatar } from "../../../../packages/domain/src/dinheiro.ts";
import { custoNaTaxa, menosDeCincoReais, percentualTexto } from "../../../../packages/domain/src/taxa_condominio.ts";
import { faixas, mensalNoAnual, reais } from "../dados/oferta";
import { faixaDasUnidades, precoDoSite } from "./calculadora";

/** O prédio do exemplo da DC17: 100 unidades, na tabela cheia, com taxa média de R$ 650. */
export const UNIDADES_DO_EXEMPLO = 100;
export const TAXA_DO_EXEMPLO = 650;

/** "R$ 3,49". */
export const centavosEmReais = (centavos: number) => formatar(dinheiro(centavos));

/** A mesma conta da calculadora (mensalidade ÷ unidades, em centavos, nunca zero), para o anual e o fundador. */
export function centavosPorApartamento(mensalReais: number, unidades: number): number {
  return Math.max(Math.round((mensalReais * 100) / unidades), 1);
}

/** O valor por apartamento na tabela cheia, mensal: o mesmo número que a calculadora mostra sem a Tabela do Console. */
export function porApartamentoTabelaCheia(unidades: number): number {
  const p = precoDoSite(unidades);
  if (typeof p.porApartamento !== "number") throw new Error(`Sem preço de tabela para ${unidades} unidades`);
  return p.porApartamento;
}

export type LimiteFaixa = { de: number; ate: number };

/** De quantas a quantas unidades vai cada faixa com preço, na ordem de dados/oferta.ts, pela regra da calculadora. */
export function limitesDasFaixas(): LimiteFaixa[] {
  const limites: LimiteFaixa[] = [];
  let atual: string | null = null;
  for (let u = 1; ; u++) {
    const f = faixaDasUnidades(u);
    if (f.ate === null) break;
    if (f.codigo !== atual) {
      limites.push({ de: u, ate: f.ate });
      atual = f.codigo;
    }
  }
  if (limites.length !== faixas.length) throw new Error("As faixas da calculadora e da oferta não batem");
  return limites;
}

export type FormaPreco = "mensal" | "anual" | "fundador";

const mensalDa = (i: number, forma: FormaPreco) => {
  const f = faixas[i]!;
  return forma === "fundador" ? f.fundador : forma === "anual" ? mensalNoAnual(f.mensal) : f.mensal;
};

export type PorApartamentoFaixa = {
  /** Unidades no topo da faixa, onde o valor por apartamento é o menor. */
  unidades: number;
  /** Centavos por apartamento com essas unidades. */
  centavos: number;
  /** "R$ 3,49". */
  texto: string;
};

/** O valor por apartamento de cada faixa, no topo dela (100 unidades na de 41 a 100). */
export function porApartamentoNoTopo(forma: FormaPreco = "mensal"): PorApartamentoFaixa[] {
  return limitesDasFaixas().map((l, i) => {
    const centavos = forma === "mensal" ? porApartamentoTabelaCheia(l.ate) : centavosPorApartamento(mensalDa(i, forma), l.ate);
    return { unidades: l.ate, centavos, texto: centavosEmReais(centavos) };
  });
}

/** Os trechos de unidades em que o valor por apartamento fica abaixo de R$ 5,00 (onde "menos de R$ 5" é verdade). */
export function trechosMenosDeCinco(forma: FormaPreco = "mensal"): LimiteFaixa[] {
  const trechos: LimiteFaixa[] = [];
  limitesDasFaixas().forEach((l, i) => {
    for (let u = l.de; u <= l.ate; u++) {
      const c = forma === "mensal" ? porApartamentoTabelaCheia(u) : centavosPorApartamento(mensalDa(i, forma), u);
      if (!menosDeCincoReais(c)) continue;
      const ultimo = trechos.at(-1);
      if (ultimo && ultimo.ate === u - 1) ultimo.ate = u;
      else trechos.push({ de: u, ate: u });
    }
  });
  return trechos;
}

export type Exemplo = {
  unidades: number;
  /** "R$ 3,49". */
  porApartamento: string;
  /** "R$ 650". */
  taxa: string;
  /** "0,5%". */
  percentual: string;
};

/** O prédio do exemplo: R$ 3,49 por apartamento com 100 unidades, cerca de 0,5% de uma taxa de R$ 650. */
export function exemploDoPredio(): Exemplo {
  const centavos = porApartamentoTabelaCheia(UNIDADES_DO_EXEMPLO);
  const c = custoNaTaxa(centavos, TAXA_DO_EXEMPLO);
  if (c.percentual === null) throw new Error("Taxa do exemplo inválida");
  return { unidades: UNIDADES_DO_EXEMPLO, porApartamento: centavosEmReais(centavos), taxa: reais(TAXA_DO_EXEMPLO), percentual: percentualTexto(c.percentual) };
}

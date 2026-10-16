// Valores em dinheiro (PT-09): sempre centavos inteiros e moeda explícita. Nunca ponto
// flutuante; nada de somar reais com outra moeda.

export const MOEDAS = ["BRL"] as const;
export type Moeda = (typeof MOEDAS)[number];

export interface Dinheiro {
  readonly centavos: number;
  readonly moeda: Moeda;
}

export class ErroDinheiro extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDinheiro";
  }
}

function exigirCentavos(centavos: number): void {
  if (!Number.isSafeInteger(centavos)) throw new ErroDinheiro("Valor em centavos precisa ser inteiro");
}

export function dinheiro(centavos: number, moeda: Moeda = "BRL"): Dinheiro {
  exigirCentavos(centavos);
  if (!MOEDAS.includes(moeda)) throw new ErroDinheiro(`Moeda não aceita: ${String(moeda)}`);
  return Object.freeze({ centavos, moeda });
}

function mesmaMoeda(a: Dinheiro, b: Dinheiro): void {
  if (a.moeda !== b.moeda) throw new ErroDinheiro(`Moedas diferentes: ${a.moeda} e ${b.moeda}`);
}

export function somar(a: Dinheiro, b: Dinheiro): Dinheiro {
  mesmaMoeda(a, b);
  return dinheiro(a.centavos + b.centavos, a.moeda);
}

export function subtrair(a: Dinheiro, b: Dinheiro): Dinheiro {
  mesmaMoeda(a, b);
  return dinheiro(a.centavos - b.centavos, a.moeda);
}

export function multiplicar(a: Dinheiro, quantidade: number): Dinheiro {
  if (!Number.isSafeInteger(quantidade)) throw new ErroDinheiro("Quantidade precisa ser inteira");
  return dinheiro(a.centavos * quantidade, a.moeda);
}

/**
 * Divide o valor em partes que somam exatamente o total: os centavos que sobram vão,
 * um a um, para as primeiras partes (ex.: rateio de uma despesa entre unidades).
 */
export function repartir(total: Dinheiro, partes: number): Dinheiro[] {
  if (!Number.isSafeInteger(partes) || partes < 1) throw new ErroDinheiro("Número de partes inválido");
  const sinal = total.centavos < 0 ? -1 : 1;
  const absoluto = Math.abs(total.centavos);
  const base = Math.floor(absoluto / partes);
  const sobra = absoluto - base * partes;
  return Array.from({ length: partes }, (_, i) => dinheiro(sinal * (base + (i < sobra ? 1 : 0)), total.moeda));
}

const FORMATOS: Record<Moeda, Intl.NumberFormat> = {
  BRL: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
};

/** 11999 → "R$ 119,99" (com espaço comum no lugar do espaço inseparável do Intl). */
export function formatar(valor: Dinheiro): string {
  exigirCentavos(valor.centavos);
  // O Intl recebe o valor dividido só para exibir; a conta nunca sai dos centavos.
  return FORMATOS[valor.moeda].format(valor.centavos / 100).replace(/\u00a0/g, " ");
}

/**
 * Lê o que a pessoa digitou ("1.234,56", "R$ 10", "-3,5") sem passar por ponto flutuante.
 * Mais de duas casas depois da vírgula é recusado, para nunca arredondar escondido.
 */
export function lerReais(texto: string): Dinheiro {
  const limpo = texto.replace(/R\$/i, "").replace(/\s/g, "");
  const m = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpo);
  if (!m) throw new ErroDinheiro("Valor em reais inválido");
  const inteiros = m[2]!.replace(/\./g, "");
  const centavos = Number(inteiros) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return dinheiro(m[1] ? -centavos : centavos, "BRL");
}

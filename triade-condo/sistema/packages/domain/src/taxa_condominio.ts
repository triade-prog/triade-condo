// O custo da TRÍADE perto da taxa de condomínio (DC17; 0310, R17.6 e R17.3c; CM-19, CM-20, CM-33).
// Uma regra só para o Console (nova proposta, link, kit e PDFs) e para a calculadora do site: o
// valor por apartamento sai da Tabela de preços (no banco); aqui ficam só o "menos de R$ 5", que
// só aparece quando é verdade, e o peso na taxa média que o prédio informou. Sem ROI e sem
// economia prometida (EM-07): é uma estimativa, a mensalidade dividida pelas unidades.

import { z } from "zod";
import { dinheiro, formatar, lerReais } from "./dinheiro.ts";

/** O destaque dos quadros 445 a 448. Só com o valor por apartamento abaixo de R$ 5,00. */
export const TEXTO_MENOS_DE_CINCO = "Menos de R$ 5 por apartamento por mês";
/** R$ 5,00 em centavos: o valor por apartamento precisa ficar abaixo disto para o destaque. */
export const LIMITE_MENOS_DE_CINCO = 500;
/** A taxa vai de R$ 0,01 a R$ 20.000 (o mesmo limite do banco, numeric(10,2)). */
export const TAXA_CONDOMINIO_MAXIMA = 20000;

/** A ajuda do campo no Console (quadros 445 e 447) e no site (quadro 448). */
export const TEXTO_AJUDA_TAXA = "Opcional. Quanto cada apartamento paga por mês, em média. Só mostra o peso da TRÍADE na taxa; não muda o preço.";
export const TEXTO_AJUDA_TAXA_FICHA = `${TEXTO_AJUDA_TAXA} Veio da ficha do interessado.`;
export const TEXTO_AJUDA_TAXA_SITE = "Quanto cada apartamento paga por mês, em média. Serve só para mostrar o peso na taxa.";

/** A taxa em reais, com até duas casas, de R$ 0,01 a R$ 20.000. */
export const taxaCondominioSchema = z
  .number()
  .gt(0, { message: "A taxa vai de R$ 0,01 a R$ 20.000" })
  .max(TAXA_CONDOMINIO_MAXIMA, { message: "A taxa vai de R$ 0,01 a R$ 20.000" })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Até duas casas" });

/** O destaque "menos de R$ 5" só quando o valor por apartamento (em centavos) é menor que R$ 5,00. */
export function menosDeCincoReais(porApartamento: number | null | undefined): boolean {
  return typeof porApartamento === "number" && Number.isFinite(porApartamento) && porApartamento > 0 && porApartamento < LIMITE_MENOS_DE_CINCO;
}

/** A taxa em centavos (a conta nunca passa por ponto flutuante depois daqui). */
function taxaEmCentavos(taxa: number | null | undefined): number | null {
  if (typeof taxa !== "number" || !taxaCondominioSchema.safeParse(taxa).success) return null;
  return Math.round(taxa * 100);
}

/**
 * Quanto o valor por apartamento pesa na taxa, em %, com 1 casa, arredondado: R$ 3,58 numa taxa de
 * R$ 650,00 dá 0,6. Sem a taxa (ou sem o valor), nulo.
 */
export function pesoNaTaxa(porApartamento: number | null | undefined, taxa: number | null | undefined): number | null {
  const t = taxaEmCentavos(taxa);
  if (t === null || typeof porApartamento !== "number" || !Number.isSafeInteger(porApartamento) || porApartamento <= 0) return null;
  // porApartamento / t × 100, com 1 casa: arredonda porApartamento × 1000 / t e divide por 10.
  return Math.round((porApartamento * 1000) / t) / 10;
}

/** "0,6%"; abaixo de 0,05% vira "menos de 0,1%" (nunca "0,0%"). */
export function percentualTexto(p: number): string {
  if (p < 0.1) return "menos de 0,1%";
  return `${p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** "R$ 650,00". */
export function taxaTexto(taxa: number): string {
  return formatar(dinheiro(Math.round(taxa * 100)));
}

/** "R$ 3,58". */
function porApTexto(porApartamento: number): string {
  return formatar(dinheiro(porApartamento));
}

export interface CustoNaTaxa {
  /** Centavos por apartamento por mês. */
  porApartamento: number;
  /** O destaque "Menos de R$ 5 por apartamento por mês" só quando é verdade. */
  menosDeCinco: boolean;
  /** A taxa informada, em reais; nula sem a taxa. */
  taxa: number | null;
  /** Peso na taxa, em %, com 1 casa; nulo sem a taxa. */
  percentual: number | null;
  /** "cerca de 0,6%" (nulo sem a taxa). */
  cerca: string | null;
}

/** A regra única: o valor por apartamento, o destaque e o peso na taxa. */
export function custoNaTaxa(porApartamento: number, taxa?: number | null): CustoNaTaxa {
  const percentual = pesoNaTaxa(porApartamento, taxa);
  return {
    porApartamento,
    menosDeCinco: menosDeCincoReais(porApartamento),
    taxa: percentual === null ? null : (taxa as number),
    percentual,
    cerca: percentual === null ? null : `cerca de ${percentualTexto(percentual)}`,
  };
}

/** Linha "Na taxa de condomínio: cerca de 0,6% de R$ 650,00" (link 446, calculadora 448). Nula sem a taxa. */
export function linhaNaTaxa(c: CustoNaTaxa): string | null {
  return c.cerca && c.taxa !== null ? `${c.cerca} de ${taxaTexto(c.taxa)}` : null;
}

/**
 * O resumo da versão (quadro 445): "R$ 2,86 por mês com 72 unidades, cerca de 0,4% da taxa média
 * de R$ 650,00"; sem a taxa, só o valor e as unidades.
 */
export function resumoPorApartamento(c: CustoNaTaxa, unidades: number): string {
  const base = `${porApTexto(c.porApartamento)} por mês com ${unidades} unidades`;
  return c.cerca && c.taxa !== null ? `${base}, ${c.cerca} da taxa média de ${taxaTexto(c.taxa)}` : base;
}

/**
 * A frase debaixo do destaque. `taxaDe` completa a taxa: "que o prédio informou" (link 446),
 * "do Edifício Aroeira" (kit 447); sem ele, "da taxa de R$ 650,00" (calculadora 448). Sem a taxa,
 * só o valor por apartamento por mês.
 */
export function fraseDoDestaque(c: CustoNaTaxa, taxaDe?: string): string {
  if (!c.cerca || c.taxa === null) return `${porApTexto(c.porApartamento)} por apartamento por mês.`;
  if (!taxaDe) return `${porApTexto(c.porApartamento)} por apartamento, ${c.cerca} da taxa de ${taxaTexto(c.taxa)}.`;
  return `${porApTexto(c.porApartamento)} por apartamento, ${c.cerca} da taxa média de ${taxaTexto(c.taxa)} ${taxaDe}.`;
}

/**
 * A célula da TRÍADE na linha "Custo por apartamento por mês" do comparativo do kit (quadro 447):
 * com a taxa, "R$ 3,58 (estimativa), cerca de 0,6% da taxa"; sem ela, o texto que veio do banco.
 */
export function textoCustoComparativo(c: CustoNaTaxa, semTaxa: string): string {
  return c.cerca ? `${porApTexto(c.porApartamento)} (estimativa), ${c.cerca} da taxa` : semTaxa;
}

/**
 * Lê a taxa digitada ("650", "650,00", "1.250,50", "R$ 650"). Vazio: sem taxa (nulo). Fora do
 * limite ou com mais de duas casas: erro, com a mensagem para a tela.
 */
export function lerTaxaCondominio(texto: string): { taxa: number | null; erro?: string } {
  let t = texto.trim();
  if (!t) return { taxa: null };
  // "650.5" do teclado numérico: o ponto com uma ou duas casas é a vírgula.
  if (/^\d+\.\d{1,2}$/.test(t)) t = t.replace(".", ",");
  let centavos: number;
  try {
    centavos = lerReais(t).centavos;
  } catch {
    return { taxa: null, erro: "Digite a taxa em reais, por exemplo 650,00" };
  }
  if (centavos <= 0 || centavos > TAXA_CONDOMINIO_MAXIMA * 100) return { taxa: null, erro: "A taxa vai de R$ 0,01 a R$ 20.000" };
  return { taxa: centavos / 100 };
}

/** A taxa para o campo do formulário ("650,00"); sem taxa, vazio. */
export function taxaParaCampo(taxa: number | null | undefined): string {
  if (typeof taxa !== "number") return "";
  return (Math.round(taxa * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

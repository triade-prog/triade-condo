// Tabela de preços no Console (0295). Os mesmos valores e regras estão no banco
// (0295_tabela_precos.sql): faixas fixas, preço de fundador só no mensal, anual pela tabela
// cheia, vagas de fundador e a sugestão do plano, que não grava nada. Só a equipe vê; o
// síndico nunca. Valor vazio é "Valor a definir", nunca zero (PI-07).

import { z } from "zod";
import type { CicloPlano } from "./planos.ts";

/** As faixas fixas de unidades. Acima de 400 é sob consulta, sem valores. */
export const FAIXAS_PRECO = {
  ATE_40: { nome: "Até 40 unidades", de: 1, ate: 40 },
  DE_41_A_100: { nome: "41 a 100 unidades", de: 41, ate: 100 },
  DE_101_A_200: { nome: "101 a 200 unidades", de: 101, ate: 200 },
  DE_201_A_400: { nome: "201 a 400 unidades", de: 201, ate: 400 },
  ACIMA_DE_400: { nome: "Acima de 400 unidades", de: 401, ate: null },
} as const;
export type CodigoFaixa = keyof typeof FAIXAS_PRECO;
export const CODIGOS_FAIXA = Object.keys(FAIXAS_PRECO) as CodigoFaixa[];

/** De onde veio o plano do cliente. MANUAL é o plano escrito à mão (no banco, sem origem). */
export const TABELAS_PRECO = { FUNDADOR: "Fundador", CHEIA: "Tabela cheia", MANUAL: "Manual" } as const;
export type TabelaPreco = keyof typeof TABELAS_PRECO;
export type TabelaEmUso = Exclude<TabelaPreco, "MANUAL">;

/** Como o concorrente cobra. */
export const MODELOS_CONCORRENTE = { FIXO: "Valor fixo", FAIXA: "Por faixa de unidades", POR_UNIDADE: "Por unidade" } as const;
export type ModeloConcorrente = keyof typeof MODELOS_CONCORRENTE;

/** Avisos da sugestão do plano, ditos para quem usa o Console. */
export const AVISOS_SUGESTAO = {
  SEM_UNIDADES: "O condomínio ainda não tem unidades ativas. Cadastre as unidades para ver a faixa.",
  SOB_CONSULTA: "Acima de 400 unidades o preço é sob consulta. Escreva o plano à mão.",
  FUNDADOR_SO_MENSAL: "O preço de fundador é só no mensal. No anual vale a tabela cheia, com a implantação isenta.",
  SEM_VAGA_FUNDADOR: "As vagas de fundador acabaram. Vale a tabela cheia.",
  VALOR_A_DEFINIR: "Esta faixa ainda não tem valor na tabela. O plano fica com \"Valor a definir\".",
} as const;
export type AvisoSugestao = keyof typeof AVISOS_SUGESTAO;

/** Uma faixa como o Console lê (valores em centavos; ausente é "Valor a definir"). */
export interface FaixaPreco {
  codigo: CodigoFaixa;
  nome: string;
  unidadesDe: number;
  unidadesAte?: number;
  sobConsulta: boolean;
  fundador?: number;
  cheia?: number;
  implantacao?: number;
  anual?: number;
  versao: number;
}

export interface ParametrosPreco {
  mesesPagosAnual: number;
  parcelasImplantacao: number;
  vagasFundador: number;
  tabelaEmUso: TabelaEmUso;
  versao: number;
}

export interface Concorrente {
  id: string;
  nome: string;
  plano?: string;
  modelo: ModeloConcorrente;
  valor?: number;
  aPartirDe?: boolean;
  faixas?: { ate: number; valor: number }[];
  porUnidade?: number;
  minimo?: number;
  fonte: string;
  /** Visto na fonte oficial; sem conferência é preço de terceiros. */
  conferido: boolean;
  lidoEm: string;
  arquivado: boolean;
  versao: number;
}

/** A faixa das unidades ativas; sem unidade, nenhuma. */
export function faixaDasUnidades(unidades: number): CodigoFaixa | null {
  if (!Number.isInteger(unidades) || unidades < 1) return null;
  return CODIGOS_FAIXA.find((c) => unidades >= FAIXAS_PRECO[c].de && (FAIXAS_PRECO[c].ate === null || unidades <= FAIXAS_PRECO[c].ate)) ?? null;
}

/** O fundador vale 12 meses desde a competência em que o plano começa: devolve a última ("2026-11-01" → "2027-10-01"). */
export function fundadorAte(inicioCompetencia: string): string {
  const [a, m] = inicioCompetencia.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + 11;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export interface SugestaoCalculada {
  faixa: CodigoFaixa | null;
  tabela: TabelaPreco | null;
  valor: number | null;
  implantacao: number | null;
  implantacaoSemCobranca: boolean;
  avisos: AvisoSugestao[];
}

/**
 * Quanto custaria (simulador do Console), com as mesmas regras de console_sugestao_plano:
 * a tabela em uso; fundador só no mensal e com vaga (sem vaga, a cheia); anual = meses pagos ×
 * cheia, implantação isenta; acima de 400, sob consulta.
 */
export function calcularSugestao(entrada: {
  faixas: Pick<FaixaPreco, "codigo" | "sobConsulta" | "fundador" | "cheia" | "implantacao">[];
  parametros: Pick<ParametrosPreco, "mesesPagosAnual" | "tabelaEmUso">;
  unidades: number;
  ciclo: CicloPlano;
  /** Há vaga de fundador para este cliente (livre ou já ocupada por ele). */
  temVagaFundador: boolean;
}): SugestaoCalculada {
  const codigo = faixaDasUnidades(entrada.unidades);
  const f = entrada.faixas.find((x) => x.codigo === codigo);
  if (!codigo || !f) return { faixa: null, tabela: null, valor: null, implantacao: null, implantacaoSemCobranca: false, avisos: ["SEM_UNIDADES"] };
  const avisos: AvisoSugestao[] = [];
  let tabela: TabelaPreco = entrada.parametros.tabelaEmUso;
  if (f.sobConsulta) {
    tabela = "MANUAL";
    avisos.push("SOB_CONSULTA");
  } else if (tabela === "FUNDADOR" && entrada.ciclo === "ANUAL") {
    tabela = "CHEIA";
    avisos.push("FUNDADOR_SO_MENSAL");
  } else if (tabela === "FUNDADOR" && !entrada.temVagaFundador) {
    tabela = "CHEIA";
    avisos.push("SEM_VAGA_FUNDADOR");
  }
  let valor: number | null = null;
  let implantacao: number | null = null;
  let implantacaoSemCobranca = false;
  if (tabela === "FUNDADOR") {
    valor = f.fundador ?? null;
    implantacaoSemCobranca = true;
  } else if (tabela === "CHEIA" && entrada.ciclo === "ANUAL") {
    valor = f.cheia === undefined ? null : f.cheia * entrada.parametros.mesesPagosAnual;
    implantacaoSemCobranca = true;
  } else if (tabela === "CHEIA") {
    valor = f.cheia ?? null;
    implantacao = f.implantacao ?? null;
  }
  if (valor === null && tabela !== "MANUAL") avisos.push("VALOR_A_DEFINIR");
  return { faixa: codigo, tabela, valor, implantacao, implantacaoSemCobranca, avisos };
}

/** O preço do mês de um concorrente para tantas unidades; null quando o site não diz (passa da última faixa). */
export function precoConcorrente(c: Pick<Concorrente, "modelo" | "valor" | "faixas" | "porUnidade" | "minimo">, unidades: number): number | null {
  if (c.modelo === "FIXO") return c.valor ?? null;
  if (c.modelo === "FAIXA") return c.faixas?.find((f) => unidades <= f.ate)?.valor ?? null;
  if (c.porUnidade === undefined) return null;
  return Math.max(c.porUnidade * Math.max(unidades, 0), c.minimo ?? 0);
}

const versao = z.number().int().min(1);
const motivo = z.string().trim().min(3).max(500);
const centavos = z.number().int().positive().max(100_000_000_00);
const centavosOpcional = centavos.optional().nullable().transform((v) => v ?? null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

/** Os valores de uma faixa; vazio é "Valor a definir", nunca zero. */
export const faixaPrecoSchema = z.object({
  versao,
  fundador: centavosOpcional,
  cheia: centavosOpcional,
  implantacao: centavosOpcional,
  motivo,
});

export const parametrosPrecoSchema = z.object({
  versao,
  mesesPagosAnual: z.number().int().min(1).max(12),
  parcelasImplantacao: z.number().int().min(1).max(12),
  vagasFundador: z.number().int().min(0).max(1000),
  tabelaEmUso: z.enum(["FUNDADOR", "CHEIA"]),
  motivo,
});

const faixasConcorrente = z
  .array(z.object({ ate: z.number().int().min(1).max(999_999_999), valor: centavos }).strict())
  .min(1)
  .max(10)
  .refine((fs) => fs.every((f, i) => i === 0 || f.ate > fs[i - 1]!.ate), { message: "As faixas vão em ordem crescente" });

/** O concorrente, com o modelo de cobrança; a versão só na alteração. */
export const concorrenteSchema = z
  .object({
    versao: versao.optional().nullable().transform((v) => v ?? null),
    nome: z.string().trim().min(2).max(80),
    plano: z.string().trim().max(80).optional().nullable().transform((v) => (v ? v : null)),
    modelo: z.enum(chaves(MODELOS_CONCORRENTE)),
    valor: centavosOpcional,
    aPartirDe: z.boolean().optional().default(false),
    faixas: faixasConcorrente.optional().nullable().transform((v) => v ?? null),
    porUnidade: centavosOpcional,
    minimo: centavosOpcional,
    fonte: z.string().trim().min(3).max(300),
    conferido: z.boolean().optional().default(true),
    lidoEm: data,
    observacao: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null)),
    motivo,
  })
  .refine((d) => d.modelo !== "FIXO" || d.valor !== null, { message: "Diga o valor", path: ["valor"] })
  .refine((d) => d.modelo !== "FAIXA" || d.faixas !== null, { message: "Diga as faixas", path: ["faixas"] })
  .refine((d) => d.modelo !== "POR_UNIDADE" || d.porUnidade !== null, { message: "Diga o valor por unidade", path: ["porUnidade"] });

export const arquivarConcorrenteSchema = z.object({ versao, motivo });

/** A pergunta da sugestão: o ciclo e, se quiser, a competência em que o plano começa. */
export const sugestaoPlanoSchema = z.object({
  ciclo: z.enum(["MENSAL", "ANUAL"]).optional().default("MENSAL"),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}(-01)?$/)
    .optional()
    .nullable()
    .transform((v) => (v ? (v.length === 7 ? `${v}-01` : v) : null)),
});

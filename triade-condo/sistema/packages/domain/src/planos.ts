// Planos e cobrança dos clientes (peças C3 e C4; PI-03, PI-07, PI-08, PI-16, PI-19, CF-11,
// NG-01, NG-21). Os mesmos valores estão no banco (0291_planos_cobranca.sql).
// Nenhum preço mora aqui: o valor do plano é opcional e, vazio, fica "Valor a definir".

import { z } from "zod";

/** Os conjuntos (NG-01): a base vem com todo plano; os outros quatro se contratam e liberam inteiros. */
export const CONJUNTOS = {
  ATENDIMENTO: "Atendimento",
  AGENDA: "Agenda",
  MANUTENCAO: "Manutenção",
  VIDA: "Vida em condomínio",
  COMUNICACAO_AMPLIADA: "Comunicação ampliada",
} as const;
export type Conjunto = keyof typeof CONJUNTOS;

/** Como o conjunto está para o condomínio: completo, só consulta (suspenso, PI-16) ou fora do plano. */
export type ModoConjunto = "COMPLETO" | "CONSULTA" | "FORA";

/** Estado do conjunto no Console (CF-11: contratado e liberado são coisas separadas). */
export const ESTADOS_CONJUNTO = {
  BASE: "Incluído",
  NAO_LIBERADO: "Não liberado",
  LIBERADO: "Liberado",
  TESTE: "Em teste",
  SUSPENSO: "Suspenso",
} as const;
export type EstadoConjunto = keyof typeof ESTADOS_CONJUNTO;

/** Por que o conjunto foi suspenso (PI-16). */
export const MOTIVOS_SUSPENSAO = {
  CONTRATO_ENCERRADO: "Contrato encerrado",
  PEDIDO_CLIENTE: "Pedido do cliente",
  TESTE_ENCERRADO: "Fim do teste",
  OUTRO: "Outro motivo",
} as const;
export type MotivoSuspensao = keyof typeof MOTIVOS_SUSPENSAO;

export const CICLOS_PLANO = { MENSAL: "Mensal", ANUAL: "Anual" } as const;
export type CicloPlano = keyof typeof CICLOS_PLANO;

export const FORMAS_RECEBIMENTO = { PIX: "Pix", BOLETO: "Boleto", TRANSFERENCIA: "Transferência", OUTRO: "Outro" } as const;
export type FormaRecebimento = keyof typeof FORMAS_RECEBIMENTO;

export const TIPOS_AJUSTE = { DESCONTO: "Desconto", ACRESCIMO: "Acréscimo", CORRECAO: "Correção" } as const;
export type TipoAjuste = keyof typeof TIPOS_AJUSTE;

export const TIPOS_COBRANCA = { MENSALIDADE: "Mensalidade", IMPLANTACAO: "Implantação" } as const;
export type TipoCobranca = keyof typeof TIPOS_COBRANCA;

/** Situação da cobrança (PI-07). O atraso é um aviso à parte e não bloqueia nada (PI-08). */
export const SITUACOES_COBRANCA = {
  A_DEFINIR: "Valor a definir",
  ABERTA: "Em aberto",
  PARCIAL: "Pago em parte",
  QUITADA: "Quitada",
} as const;
export type SituacaoCobranca = keyof typeof SITUACOES_COBRANCA;

export const ESTADOS_RECEBIMENTO = { A_CONFERIR: "A conferir", CONFERIDO: "Conferido", DEVOLVIDO: "Devolvido" } as const;
export type EstadoRecebimento = keyof typeof ESTADOS_RECEBIMENTO;

/** Conjunto ao qual a ação pertence; a base não aparece (sempre liberada). */
export function conjuntoDaAcao(acao: string): Conjunto | null {
  if (acao.startsWith("agenda.")) return "AGENDA";
  if (acao.startsWith("manutencao.")) return "MANUTENCAO";
  if (/^(reservas|enquetes|assembleias|classificados)\./.test(acao)) return "VIDA";
  if (acao.startsWith("memoria.")) return "COMUNICACAO_AMPLIADA";
  return null;
}

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const centavos = z.number().int().positive().max(100_000_000_00);
const centavosOpcional = centavos.optional().nullable().transform((v) => v ?? null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const conjuntoVendido = z.enum(["AGENDA", "MANUTENCAO", "VIDA", "COMUNICACAO_AMPLIADA"]);

/** Plano do cliente: faixa de unidades e valor opcional (os preços ainda estão em decisão). */
export const planoSchema = z
  .object({
    versao: versao.optional().nullable().transform((v) => v ?? null),
    nome: texto(2, 60),
    unidadesDe: z.number().int().min(0).optional().nullable().transform((v) => v ?? null),
    unidadesAte: z.number().int().min(1).optional().nullable().transform((v) => v ?? null),
    valor: centavosOpcional,
    ciclo: z.enum(chaves(CICLOS_PLANO)),
    diaVencimento: z.number().int().min(1).max(28),
    implantacaoValor: centavosOpcional,
    implantacaoSemCobranca: z.boolean(),
    implantacaoReferencia: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null)),
    inicioCompetencia: data,
  })
  .refine((p) => p.unidadesDe === null || p.unidadesAte === null || p.unidadesDe <= p.unidadesAte, {
    message: "A faixa de unidades não fecha",
    path: ["unidadesAte"],
  });

export const contratarConjuntoSchema = z
  .object({ versao, contratado: z.boolean(), referencia: z.string().trim().max(120).optional(), motivo: z.string().trim().max(500).optional() })
  .refine((d) => !d.contratado || (d.referencia ?? "").length > 0, { message: "Diga o contrato ou aditivo", path: ["referencia"] })
  .refine((d) => d.contratado || (d.motivo ?? "").length >= 3, { message: "Diga o motivo", path: ["motivo"] });

export const liberarConjuntoSchema = z.object({ versao, referencia: texto(1, 120), motivo: texto(3, 500) });
export const testarConjuntoSchema = z.object({ versao, ate: data, motivo: texto(3, 500) });
export const suspenderConjuntoSchema = z.object({ versao, porque: z.enum(chaves(MOTIVOS_SUSPENSAO)), motivo: texto(3, 500) });

export const abrirCompetenciaSchema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}(-01)?$/).transform((v) => (v.length === 7 ? `${v}-01` : v)) });

/** Recebimento: de um cliente (com a cobrança) ou sem cliente (fica em Não identificados). */
export const recebimentoSchema = z
  .object({
    condominioId: z.string().uuid().optional().nullable().transform((v) => v ?? null),
    cobrancaId: z.string().uuid().optional().nullable().transform((v) => v ?? null),
    valor: centavos,
    recebidoEm: data,
    forma: z.enum(chaves(FORMAS_RECEBIMENTO)),
    referencia: texto(3, 120),
  })
  .refine((d) => !d.condominioId || d.cobrancaId, { message: "Escolha a cobrança", path: ["cobrancaId"] });

export const identificarRecebimentoSchema = z.object({ condominioId: z.string().uuid(), cobrancaId: z.string().uuid() });
export const conferirRecebimentoSchema = z.object({ versao });
export const devolverRecebimentoSchema = z.object({ versao, motivo: texto(3, 500) });
export const ajusteCobrancaSchema = z.object({ tipo: z.enum(chaves(TIPOS_AJUSTE)), valor: z.number().int().refine((v) => v !== 0), motivo: texto(3, 500) })
  .refine((d) => d.tipo === "CORRECAO" || d.valor > 0, { message: "Diga o valor", path: ["valor"] });
export const valorCobrancaSchema = z.object({ valor: centavos, motivo: texto(3, 500) });

/** O síndico pede para testar ou contratar (decisão E): vira um chamado; nada é liberado sozinho. */
export const pedirConjuntoSchema = z.object({
  conjunto: conjuntoVendido,
  pedido: z.enum(["TESTE", "CONTRATAR"]),
  texto: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
});

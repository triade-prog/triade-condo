// Pedidos relacionados (AT-18), pedido de decisão ao síndico (AT-23) e os dois indicadores que
// faltavam (F7.4, TR-01). Os mesmos valores estão no banco (0280_reincidencia_decisoes.sql).

import { z } from "zod";
import { dinheiro, formatar } from "./dinheiro.ts";
import { mostrarDataSemHora } from "./plataforma.ts";

/** Como um pedido se liga a outro (decisão 2): o mais novo é o ligado. */
export const TIPOS_LIGACAO = {
  REINCIDENCIA: "Reincidência",
  DUPLICADO: "Duplicado",
} as const;
export type TipoLigacao = keyof typeof TIPOS_LIGACAO;

/** A ligação vista de cada lado: o novo é "reincidência de" ou "duplicado de"; o antigo "voltou em". */
export function rotuloLigacao(tipo: TipoLigacao, papel: "NOVO" | "ANTIGO"): string {
  if (papel === "NOVO") return tipo === "REINCIDENCIA" ? "Reincidência de" : "Duplicado de";
  return tipo === "REINCIDENCIA" ? "Voltou em" : "Relatado de novo em";
}

/** Janela dos parecidos, em dias (decisão 1). */
export const JANELAS_PARECIDOS = [30, 60, 90, 180] as const;

export const ESTADOS_DECISAO = {
  AGUARDANDO: "Aguardando",
  APROVADA: "Aprovada",
  DEVOLVIDA: "Devolvida",
  RETIRADA: "Retirada",
} as const;
export type EstadoDecisao = keyof typeof ESTADOS_DECISAO;

export const FILTROS_DECISAO = {
  AGUARDANDO: "Aguardando",
  DECIDIDAS: "Decididas",
  TODAS: "Todas",
} as const;
export type FiltroDecisao = keyof typeof FILTROS_DECISAO;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const opcional = (s: z.ZodString) => s.nullable().optional().transform((v) => (v ? v : null));
const motivo = z.string().trim().min(3).max(500);

export const ligarPedidosSchema = z
  .object({
    versao,
    outroId: id,
    tipo: z.enum(chaves(TIPOS_LIGACAO)),
    motivo: z.string().trim().min(3).max(300),
    encerrar: z.boolean().default(false),
    texto: opcional(z.string().trim().max(2000)),
    versaoOutro: versao.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (!d.encerrar) return;
    if (d.tipo !== "DUPLICADO") ctx.addIssue({ code: "custom", path: ["encerrar"], message: "Só o duplicado se encerra ao ligar" });
    if (!d.texto || d.texto.length < 10) ctx.addIssue({ code: "custom", path: ["texto"], message: "Escreva ao morador (10 a 2000 caracteres)" });
  });

export const desfazerLigacaoSchema = z.object({ versao, motivo });
export const descartarParecidoSchema = z.object({ outroId: id });
export const parecidosSchema = z.object({
  versao,
  dias: z.number().int().refine((n) => (JANELAS_PARECIDOS as readonly number[]).includes(n), "Escolha 30, 60, 90 ou 180 dias"),
});

export const alternativaSchema = z.object({
  descricao: z.string().trim().min(3).max(200),
  detalhe: opcional(z.string().trim().max(200)).refine((v) => v === null || v.length >= 2, "De 2 a 200 caracteres"),
  /** Custo estimado em centavos (PT-09); sem custo, nulo. */
  custo: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
});

export const pedirDecisaoSchema = z.object({
  versao,
  pergunta: z.string().trim().min(3).max(500),
  porque: opcional(z.string().trim().max(500)).refine((v) => v === null || v.length >= 3, "De 3 a 500 caracteres"),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decisorId: id,
  alternativas: z.array(alternativaSchema).min(1).max(5),
});
export type PedirDecisao = z.infer<typeof pedirDecisaoSchema>;

export const responderDecisaoSchema = z
  .object({
    versao,
    aprovar: z.boolean(),
    alternativa: z.number().int().min(1).max(5).nullable().optional().transform((v) => v ?? null),
    justificativa: z.string().trim().min(3).max(1000),
  })
  .superRefine((d, ctx) => {
    if (d.aprovar && d.alternativa === null) ctx.addIssue({ code: "custom", path: ["alternativa"], message: "Escolha a alternativa aprovada" });
  });

export const retirarDecisaoSchema = z.object({ versao, motivo });
export const filtroDecisoesSchema = z.object({ filtro: z.enum(chaves(FILTROS_DECISAO)).default("AGUARDANDO") });

/** Eventos do histórico do pedido desta parte, como frase curta (AT-17). */
export function descreverEventoDecisao(acao: string, d: Record<string, unknown>): string | null {
  const protocolo = String(d.protocolo ?? "outro pedido");
  switch (acao) {
    case "pedido.ligado":
      return `${rotuloLigacao((d.tipo as TipoLigacao) ?? "DUPLICADO", d.papel === "ANTIGO" ? "ANTIGO" : "NOVO")} ${protocolo}`;
    case "pedido.ligacao_desfeita":
      return `Ligação com ${protocolo} desfeita${d.motivo ? `. Motivo: ${String(d.motivo)}` : ""}`;
    case "pedido.decisao_pedida": {
      const n = Number(d.alternativas ?? 0);
      const prazo = d.prazo ? ` · prazo ${mostrarDataSemHora(String(d.prazo))}` : "";
      return `Decisão pedida ao síndico · ${n === 1 ? "1 alternativa" : `${n} alternativas`}${prazo}`;
    }
    case "pedido.decisao_respondida":
      return d.aprovada ? `Decisão respondida: aprovada a alternativa ${String(d.alternativa ?? "")}` : "Decisão devolvida sem decidir";
    case "pedido.decisao_retirada":
      return `Pedido de decisão retirado${d.motivo ? `. Motivo: ${String(d.motivo)}` : ""}`;
    default:
      return null;
  }
}

/** Custo estimado sem os centavos quando redondo: 240000 → "R$ 2.400"; 115050 → "R$ 1.150,50". */
export function mostrarCusto(centavos: number): string {
  const texto = formatar(dinheiro(centavos));
  return centavos % 100 === 0 ? texto.replace(/,00$/, "") : texto;
}

/** O resumo das alternativas na lista: "2 alternativas, de R$ 2.400 a R$ 18.900" ou "1 alternativa, sem custo". */
export function resumoAlternativas(alternativas: { custo?: number | null }[]): string {
  const n = alternativas.length;
  const qtd = n === 1 ? "1 alternativa" : `${n} alternativas`;
  const custos = alternativas.map((a) => a.custo).filter((c): c is number => typeof c === "number").sort((a, b) => a - b);
  if (!custos.length) return `${qtd}, sem custo`;
  const menor = custos[0]!;
  const maior = custos[custos.length - 1]!;
  return menor === maior ? `${qtd}, ${mostrarCusto(menor)}` : `${qtd}, de ${mostrarCusto(menor)} a ${mostrarCusto(maior)}`;
}

const diaUtc = (data: string) => Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10)));

/** O prazo de uma decisão aguardando, como selo: "Vence em 4 dias", "Venceu ontem", "Até 28/10". Datas "AAAA-MM-DD". */
export function prazoDaDecisao(prazo: string, hoje: string): { texto: string; tom: "erro" | "atencao" | "andamento" } {
  const dias = Math.round((diaUtc(prazo) - diaUtc(hoje)) / 86_400_000);
  const ddmm = `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}`;
  if (dias < -1) return { texto: `Venceu em ${ddmm}`, tom: "erro" };
  if (dias === -1) return { texto: "Venceu ontem", tom: "erro" };
  if (dias === 0) return { texto: "Vence hoje", tom: "atencao" };
  if (dias === 1) return { texto: "Vence amanhã", tom: "atencao" };
  if (dias <= 7) return { texto: `Vence em ${dias} dias`, tom: "atencao" };
  return { texto: `Até ${ddmm}`, tom: "andamento" };
}

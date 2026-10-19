// Plataforma do síndico (passos 6 e 7): prazos, avisos dentro do painel, o início do dia e
// os indicadores do atendimento. Os mesmos valores estão no banco (0120_prazos_avisos.sql).

import { z } from "zod";

/** Tipos de aviso (F6.1, F6.2, AT-08, AT-09). */
export const TIPOS_AVISO = {
  RETORNO_VENCIDO: "Retorno vencido",
  ESCALADO_SINDICO: "Escalado a você",
  ESCALADO_SUBSTITUTO: "Escalado a você",
  SEM_RESPONSAVEL: "Sem responsável",
  PENDENCIA_PARADA: "Pendência parada",
} as const;
export type TipoAviso = keyof typeof TIPOS_AVISO;

/** Período dos indicadores (F7.2). */
export const PERIODOS_INDICADORES = {
  ESTE_MES: "Este mês",
  MES_PASSADO: "Mês passado",
  TRES_MESES: "Últimos 3 meses",
} as const;
export type PeriodoIndicadores = keyof typeof PERIODOS_INDICADORES;

/** Tempos sugeridos para um condomínio novo. */
export const REGRAS_AVISO_PADRAO = { sindicoHoras: 2, substitutoHoras: 8, semResponsavelHoras: 4, pendenciaDias: 3 } as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const horas = z.number().int().min(1).max(240);

export const regrasAvisoSchema = z
  .object({
    versao: z.number().int().min(1),
    sindicoHoras: horas,
    substitutoHoras: horas,
    substitutoId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    semResponsavelHoras: horas,
    pendenciaDias: z.number().int().min(1).max(60),
  })
  .superRefine((d, ctx) => {
    if (d.substitutoHoras <= d.sindicoHoras) {
      ctx.addIssue({ code: "custom", path: ["substitutoHoras"], message: "O substituto é avisado depois do síndico" });
    }
  });

/** Marcar avisos como vistos: os escolhidos, ou todos quando não vem nenhum. */
export const marcarAvisosSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200).nullable().optional().transform((v) => v ?? null) });

export const periodoIndicadoresSchema = z.object({ periodo: z.enum(chaves(PERIODOS_INDICADORES)).default("ESTE_MES") });

/** "86%" ou "Sem dados" (TR-07): sem nenhum caso no período, nunca zero. */
export function mostrarPorcentagem(p: number | null | undefined): string {
  return p === null || p === undefined ? "Sem dados" : `${p}%`;
}

/** Horas em palavras curtas: "40 min", "2 h", "1,5 h", "3 dias". */
export function mostrarHoras(h: number | null | undefined): string {
  if (h === null || h === undefined) return "Sem dados";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
  return `${Math.floor(h / 24)} dias`;
}

/** Tempo de solução em horas corridas (TR-01): "45 min", "5 h", "1 dia", "2 dias e 4 h". */
export function mostrarDuracao(h: number | null | undefined): string {
  if (h === null || h === undefined) return "Sem dados";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  const total = Math.round(h);
  if (total < 24) return `${total} h`;
  const dias = Math.floor(total / 24);
  const resto = total % 24;
  const d = dias === 1 ? "1 dia" : `${dias} dias`;
  return resto ? `${d} e ${resto} h` : d;
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09" → "setembro". */
export function nomeDoMes(mes: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(mes);
  return m ? NOMES_MES[Number(m[1]) - 1] ?? mes : mes;
}

/** O mês anterior a "2026-09": "agosto". */
export function nomeDoMesAnterior(mes: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(mes);
  return m ? NOMES_MES[(Number(m[1]) + 10) % 12]! : mes;
}

const PARA_AVISO: Record<string, string> = {
  RESPONSAVEL: "ao responsável",
  SINDICO: "ao síndico",
  SUBSTITUTO: "ao substituto",
};

/** Os eventos de prazo no histórico do pedido (AT-17). */
export function descreverAvisoPedido(acao: string, d: Record<string, unknown>): string | null {
  if (acao === "pedido.retorno_venceu") return "Retorno venceu";
  if (acao !== "pedido.aviso") return null;
  const para = PARA_AVISO[String(d.para)] ?? "";
  switch (d.tipo) {
    case "RETORNO_VENCIDO":
      return d.para === "SINDICO" ? "Aviso ao síndico: retorno vencido de pedido sem responsável" : `Aviso ${para}`;
    case "ESCALADO_SINDICO":
    case "ESCALADO_SUBSTITUTO":
      return `Aviso escalado ${para}`;
    case "SEM_RESPONSAVEL":
      return "Aviso ao síndico: pedido sem responsável";
    case "PENDENCIA_PARADA":
      return "Aviso de pendência parada a quem cuida dela";
    default:
      return "Aviso";
  }
}

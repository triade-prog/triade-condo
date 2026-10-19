// Agenda do condomínio (peça R7; AG-01 a AG-05, AG-08, AG-09). Os mesmos valores estão no banco
// (0130_agenda.sql). As datas chegam como "AAAA-MM-DD" no fuso do condomínio e as contas daqui
// são feitas em UTC, para não mudar de dia com o fuso do aparelho.

import { z } from "zod";

/** Tipos de compromisso (AG-01). */
export const TIPOS_COMPROMISSO = {
  REUNIAO: "Reunião",
  VISITA: "Visita técnica",
  ATIVIDADE: "Atividade programada",
  LEMBRETE: "Lembrete",
} as const;
export type TipoCompromisso = keyof typeof TIPOS_COMPROMISSO;

/** Situações (AG-02). Realizado e cancelado não voltam. */
export const SITUACOES_COMPROMISSO = {
  PLANEJADO: "Planejado",
  A_CONFIRMAR: "A confirmar",
  CONFIRMADO: "Confirmado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
} as const;
export type SituacaoCompromisso = keyof typeof SITUACOES_COMPROMISSO;

/** Onde acontece. */
export const LUGARES_COMPROMISSO = {
  NENHUM: "Sem lugar",
  UNIDADE: "Unidade",
  AREA_COMUM: "Área comum",
  OUTRO: "Outro lugar",
} as const;
export type LugarCompromisso = keyof typeof LUGARES_COMPROMISSO;

/** Repetição (AG-05). */
export const REPETICOES = {
  SEMANAL: "Toda semana",
  QUINZENAL: "A cada 2 semanas",
  MENSAL: "Todo mês",
} as const;
export type Repeticao = keyof typeof REPETICOES;

/** De onde vêm as datas de outras telas (AG-09), na ordem dos filtros da Agenda. */
export const FONTES_AGENDA = {
  FERIADO: "Feriados",
  PREVENTIVA: "Preventivas",
  RESERVA: "Reservas",
  CONTRATO: "Contratos",
  DOCUMENTO: "Documentos",
  ASSEMBLEIA: "Assembleias",
} as const;
export type FonteAgenda = keyof typeof FONTES_AGENDA;

/** Alcance de uma mudança num compromisso que se repete. */
export const ESCOPOS = { ESTA: "Só esta data", PROXIMAS: "Esta e as próximas" } as const;
export type Escopo = keyof typeof ESCOPOS;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const uuid = z.string().uuid();
const opcional = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) => opcional(z.string().max(max)).transform((v) => (v && v.trim() ? v.trim() : null));

const camposComuns = {
  tipo: z.enum(chaves(TIPOS_COMPROMISSO)),
  titulo: z.string().trim().min(3).max(120),
  horaInicio: opcional(hora),
  horaFim: opcional(hora),
  onde: z.enum(chaves(LUGARES_COMPROMISSO)).default("NENHUM"),
  unidadeId: opcional(uuid),
  local: texto(120),
  participantes: z.array(uuid).max(30).default([]),
  deFora: texto(200),
  pedidoId: opcional(uuid),
  observacao: texto(1000),
  aceitarConflito: z.boolean().default(false),
};

function conferirHorario(d: { horaInicio: string | null; horaFim: string | null }, ctx: z.RefinementCtx) {
  if (d.horaFim && (!d.horaInicio || d.horaFim <= d.horaInicio)) {
    ctx.addIssue({ code: "custom", path: ["horaFim"], message: "O fim vem depois do início" });
  }
}

function conferirLugar(d: { onde: LugarCompromisso; unidadeId: string | null; local: string | null }, ctx: z.RefinementCtx) {
  if (d.onde === "UNIDADE" && !d.unidadeId) ctx.addIssue({ code: "custom", path: ["unidadeId"], message: "Escolha a unidade" });
  if ((d.onde === "AREA_COMUM" || d.onde === "OUTRO") && (!d.local || d.local.length < 2)) {
    ctx.addIssue({ code: "custom", path: ["local"], message: "Diga onde" });
  }
}

/** Marcar um compromisso, com repetição opcional (AG-01, AG-05). */
export const marcarCompromissoSchema = z
  .object({
    ...camposComuns,
    data,
    estado: z.enum(["PLANEJADO", "A_CONFIRMAR", "CONFIRMADO"]).default("PLANEJADO"),
    repetir: opcional(z.enum(chaves(REPETICOES))),
    intervalo: opcional(z.number().int().min(1).max(12)),
    ate: opcional(data),
    vezes: opcional(z.number().int().min(2).max(104)),
  })
  .superRefine((d, ctx) => {
    conferirHorario(d, ctx);
    conferirLugar(d, ctx);
    if (d.repetir && (d.ate === null) === (d.vezes === null)) {
      ctx.addIssue({ code: "custom", path: ["ate"], message: "Repete até uma data ou por um número de vezes" });
    }
  });
export type MarcarCompromisso = z.infer<typeof marcarCompromissoSchema>;

/** Mudar o que foi combinado, menos a data (AG-05: só esta ou esta e as próximas). */
export const alterarCompromissoSchema = z
  .object({ ...camposComuns, versao: z.number().int().min(1), escopo: z.enum(chaves(ESCOPOS)).default("ESTA") })
  .superRefine((d, ctx) => {
    conferirHorario(d, ctx);
    conferirLugar(d, ctx);
  });

/** Reagendar (AG-02): pede o motivo; a data anterior fica no histórico. */
export const reagendarCompromissoSchema = z
  .object({
    versao: z.number().int().min(1),
    data,
    horaInicio: opcional(hora),
    horaFim: opcional(hora),
    motivo: z.string().trim().min(3).max(500),
    escopo: z.enum(chaves(ESCOPOS)).default("ESTA"),
    aceitarConflito: z.boolean().default(false),
  })
  .superRefine(conferirHorario);

export const situacaoCompromissoSchema = z.object({
  versao: z.number().int().min(1),
  estado: z.enum(["PLANEJADO", "A_CONFIRMAR", "CONFIRMADO", "REALIZADO"]),
});

export const cancelarCompromissoSchema = z.object({
  versao: z.number().int().min(1),
  motivo: z.string().trim().min(3).max(500),
  escopo: z.enum(chaves(ESCOPOS)).default("ESTA"),
});

/** Período da agenda, de até 93 dias. */
export const periodoAgendaSchema = z
  .object({ de: data, ate: data })
  .refine((p) => p.ate >= p.de && diasEntre(p.de, p.ate) <= 92, { path: ["ate"], message: "Período de até 93 dias" });

// ---------------------------------------------------------------------------------------
// Datas, sem fuso do aparelho.

function utc(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(dataIso: string, dias: number): string {
  const d = utc(dataIso);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate).getTime() - utc(de).getTime()) / 86400000);
}

/** "Vence em 22 dias", "Vence amanhã", "Vence hoje", "Venceu há 3 dias" (AG-09). */
export function textoVencimento(hoje: string, data: string): string {
  const n = diasEntre(hoje, data);
  if (n === 0) return "Vence hoje";
  if (n === 1) return "Vence amanhã";
  if (n > 1) return `Vence em ${n} dias`;
  return n === -1 ? "Venceu ontem" : `Venceu há ${-n} dias`;
}

/** O primeiro dia do mês de uma data. */
export function inicioDoMes(dataIso: string): string {
  return `${dataIso.slice(0, 7)}-01`;
}

/** O mesmo dia do mês seguinte (ou anterior), no primeiro dia: para navegar no calendário. */
export function mesVizinho(dataIso: string, passo: number): string {
  const d = utc(inicioDoMes(dataIso));
  d.setUTCMonth(d.getUTCMonth() + passo);
  return iso(d);
}

/** O domingo da semana de uma data. */
export function inicioDaSemana(dataIso: string): string {
  return somarDias(dataIso, -utc(dataIso).getUTCDay());
}

/** A grade do mês (AG-03): semanas inteiras de domingo a sábado, com os dias de fora marcados. */
export function gradeDoMes(dataIso: string): { data: string; doMes: boolean }[] {
  const primeiro = inicioDoMes(dataIso);
  const mes = primeiro.slice(0, 7);
  const ultimo = somarDias(mesVizinho(primeiro, 1), -1);
  const fim = somarDias(inicioDaSemana(ultimo), 6);
  const dias: { data: string; doMes: boolean }[] = [];
  for (let d = inicioDaSemana(primeiro); d <= fim; d = somarDias(d, 1)) dias.push({ data: d, doMes: d.startsWith(mes) });
  return dias;
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function diaDaSemana(dataIso: string): string {
  return DIAS_SEMANA[utc(dataIso).getUTCDay()]!;
}

/** "outubro de 2026". */
export function nomeDoMesAno(dataIso: string): string {
  const d = utc(dataIso);
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "17/10/2026". */
export function mostrarDataCurta(dataIso: string): string {
  const [a, m, d] = dataIso.split("-");
  return `${d}/${m}/${a}`;
}

/** "14:00 às 15:00", "10:00" ou "Dia todo". */
export function mostrarHorario(c: { horaInicio?: string | null; horaFim?: string | null }): string {
  if (!c.horaInicio) return "Dia todo";
  return c.horaFim ? `${c.horaInicio} às ${c.horaFim}` : c.horaInicio;
}

/** "Toda semana", "A cada 6 meses", com o fim: "A cada 6 meses, até 20/10/2028". */
export function descreverRepeticao(s: { frequencia: string; intervalo: number; ate?: string | null }): string {
  const base = s.frequencia === "MENSAL" && s.intervalo > 1 ? `A cada ${s.intervalo} meses` : REPETICOES[s.frequencia as Repeticao] ?? "Repete";
  return s.ate ? `${base}, até ${mostrarDataCurta(s.ate)}` : base;
}

/** Os eventos do compromisso no histórico (AG-02). */
export function descreverEventoCompromisso(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "compromisso.marcado":
      return d.repeticao ? "Marcado, com repetição" : "Marcado";
    case "compromisso.alterado":
      return d.escopo === "PROXIMAS" ? "Alterado, com as próximas datas" : "Alterado";
    case "compromisso.reagendado":
      return `Reagendado de ${mostrarDataCurta(String(d.de))} para ${mostrarDataCurta(String(d.para))}`;
    case "estado.mudou":
      if (d.para === "CANCELADO") return "Cancelado";
      return `${SITUACOES_COMPROMISSO[d.para as SituacaoCompromisso] ?? "Situação mudou"}${d.de ? "" : " ao marcar"}`;
    default:
      return "Alteração";
  }
}

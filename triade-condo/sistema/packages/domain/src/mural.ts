// Mural visto do painel e o mural em feed e vitrine (CD-15; CD-12, AC-05). Os motivos são os
// mesmos do banco (0285_mural_no_painel.sql).

import type { AssuntoComunicado, EventoComunicado } from "./comunicados.ts";
import { horaCurta, reais, TIPOS_ANUNCIO, type TipoAnuncio } from "./vida.ts";

/** De quanto em quanto tempo a prévia do mural confere de novo, com a tela aberta. */
export const MURAL_CONFERIR_S = 30;

/** Por que um comunicado publicado não aparece no link do mural. */
export const MOTIVOS_FORA_DO_MURAL = {
  SO_PARA_ALGUNS: "É só para um bloco, unidade ou contatos. Só comunicado para todo o condomínio vai ao mural.",
  ASSUNTO_FORA: "O assunto começa fora do mural.",
  TIRADO: "Foi tirado do mural.",
} as const;
export type MotivoForaDoMural = keyof typeof MOTIVOS_FORA_DO_MURAL;

/** A linha grande do anúncio na vitrine: o valor, "Grátis" na doação, senão o tipo. */
export function precoDoAnuncio(a: { tipo: TipoAnuncio; valorCentavos?: number | null }): string {
  if (a.valorCentavos) return reais(a.valorCentavos);
  if (a.tipo === "DOO") return "Grátis";
  return TIPOS_ANUNCIO[a.tipo];
}

const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "hoje", "ontem", "há 3 dias", "há 1 semana", "há 2 semanas", "há 1 mês", contando dias no fuso de Brasília. */
export function haQuanto(desde: string, agora: Date = new Date()): string {
  const dias = Math.round((Date.parse(DIA.format(agora)) - Date.parse(DIA.format(new Date(desde)))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) {
    const s = Math.floor(dias / 7);
    return s === 1 ? "há 1 semana" : `há ${s} semanas`;
  }
  const m = Math.floor(dias / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

/** "Conferido agora", "Conferido há 12 s", "Conferido há 3 min". */
export function textoConferido(em: number, agora: number = Date.now()): string {
  const s = Math.max(0, Math.round((agora - em) / 1000));
  if (s < 5) return "Conferido agora";
  if (s < 60) return `Conferido há ${s} s`;
  return `Conferido há ${Math.floor(s / 60)} min`;
}

// ---------------------------------------------------------------------------------------
// O mural do morador no conceito Janela acesa (D4.40): o que organiza a página é o tempo (agora,
// esta semana, antes) e o assunto. Tudo aqui é conta pura, no fuso de Brasília, para a tela e
// para os testes.


/** O que o mural precisa de cada aviso para agrupar e destacar. */
export interface AvisoDoMural {
  id: string;
  assunto: AssuntoComunicado | string;
  titulo: string;
  publicadoEm: string;
  evento?: EventoComunicado | null;
}

const FUSO = "America/Sao_Paulo";
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const DIAS_SEMANA_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"] as const;

/** As partes de um instante no fuso de Brasília. */
function partes(iso: string | Date): { ano: number; mes: number; dia: number; hora: string; semana: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? "");
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora: `${p.hour}:${p.minute}`, semana };
}

/** Dias inteiros entre dois instantes, contados pelo calendário de Brasília (positivo quando `ate` vem depois). */
function diasEntre(de: string | Date, ate: string | Date): number {
  return Math.round((Date.parse(DIA.format(new Date(ate))) - Date.parse(DIA.format(new Date(de)))) / 86_400_000);
}

/** O dia da semana (0 = domingo) de um dia no formato AAAA-MM-DD. */
function semanaDoDia(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}

/** "hoje, 09:10", "ontem, 18:40", "sex 24/10, 16:20" ou, em outro ano, "sex 24/10/2025, 16:20". */
export function dataHumana(iso: string, agora: Date = new Date()): string {
  const d = diasEntre(iso, agora);
  const p = partes(iso);
  if (d === 0) return `hoje, ${p.hora}`;
  if (d === 1) return `ontem, ${p.hora}`;
  const dd = String(p.dia).padStart(2, "0");
  const mm = String(p.mes).padStart(2, "0");
  const ano = p.ano === partes(agora).ano ? "" : `/${p.ano}`;
  return `${DIAS_SEMANA[p.semana]} ${dd}/${mm}${ano}, ${p.hora}`;
}

/** "Atualizado hoje às 09:10", "Atualizado ontem às 18:40", "Atualizado sex 24/10, às 16:20". */
export function textoAtualizado(iso: string, agora: Date = new Date()): string {
  const h = dataHumana(iso, agora);
  const [dia, hora] = h.split(", ");
  return dia === "hoje" || dia === "ontem" ? `Atualizado ${dia} às ${hora}` : `Atualizado ${dia}, às ${hora}`;
}

/** O bloco de data do aviso com evento: dia em relevo, mês, dia da semana e o resto em uma linha. */
export function blocoDeData(e: EventoComunicado): { dia: string; mes: string; semana: string; semanaLonga: string; detalhe: string } {
  const [, m, d] = e.dia.split("-");
  const s = semanaDoDia(e.dia);
  const horas = e.inicio ? (e.fim ? `${horaCurta(e.inicio)} às ${horaCurta(e.fim)}` : horaCurta(e.inicio)) : "";
  return {
    dia: String(Number(d)), mes: MESES[Number(m) - 1] ?? "", semana: DIAS_SEMANA[s] ?? "", semanaLonga: DIAS_SEMANA_LONGOS[s] ?? "",
    detalhe: [DIAS_SEMANA[s], horas, e.local].filter(Boolean).join(" · "),
  };
}

/** "hoje", "amanhã", "faltam 11 dias", "foi ontem", "foi há 3 dias", contando dias de Brasília. */
export function faltaParaOEvento(dia: string, agora: Date = new Date()): string {
  const d = diasEntre(agora, `${dia}T12:00:00-03:00`);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1) return `faltam ${d} dias`;
  if (d === -1) return "foi ontem";
  return `foi há ${-d} dias`;
}

/** O evento ainda não passou (vale o dia inteiro em Brasília). */
export function eventoFuturo(e: EventoComunicado | null | undefined, agora: Date = new Date()): boolean {
  return !!e && diasEntre(agora, `${e.dia}T12:00:00-03:00`) >= 0;
}

export interface MuralAgrupado<T extends AvisoDoMural> {
  /** O que importa agora: a assembleia convocada com evento futuro ou, sem ela, o próximo evento. */
  destaque?: T;
  /** Publicados nos últimos 7 dias, sem o destaque, do mais novo ao mais antigo. */
  estaSemana: T[];
  /** O resto, do mais novo ao mais antigo. */
  antes: T[];
}

/**
 * Agrupa o feed (D4.40): um só destaque, nunca dois; "Esta semana" são os 7 dias até hoje; o
 * que sobra vai para "Antes". A ordem de publicação é mantida dentro de cada parte.
 */
export function agruparMural<T extends AvisoDoMural>(avisos: readonly T[], agora: Date = new Date()): MuralAgrupado<T> {
  const ordem = [...avisos].sort((a, b) => Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm));
  const comEvento = ordem.filter((a) => eventoFuturo(a.evento, agora)).sort((a, b) => a.evento!.dia.localeCompare(b.evento!.dia));
  const destaque = comEvento.find((a) => a.assunto === "ASSEMBLEIA") ?? comEvento[0];
  const resto = destaque ? ordem.filter((a) => a.id !== destaque.id) : ordem;
  return {
    destaque,
    estaSemana: resto.filter((a) => diasEntre(a.publicadoEm, agora) < 7),
    antes: resto.filter((a) => diasEntre(a.publicadoEm, agora) >= 7),
  };
}

/** Quantos avisos foram publicados depois da última visita guardada no aparelho (CD-16). */
export function novosDesde<T extends AvisoDoMural>(avisos: readonly T[], ultimaVisita: string | null | undefined): Set<string> {
  const marco = ultimaVisita ? Date.parse(ultimaVisita) : NaN;
  if (Number.isNaN(marco)) return new Set();
  return new Set(avisos.filter((a) => Date.parse(a.publicadoEm) > marco).map((a) => a.id));
}

/** "quinta 23/10", para a linha dos avisos novos. */
export function diaDaVisita(iso: string): string {
  const p = partes(iso);
  return `${DIAS_SEMANA_LONGOS[p.semana]} ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
}

/** "1 aviso", "3 avisos", "2 enquetes", "4 anúncios". */
export function contar(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

const escaparIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compacto = (dia: string, hora?: string) => dia.replace(/-/g, "") + (hora ? `T${hora.replace(":", "")}00` : "");

/**
 * O arquivo de calendário do evento (CD-18): um VEVENT no fuso de Brasília, com título, local e o
 * texto do aviso. Sem hora, é o dia inteiro. Quem abre o arquivo escolhe o calendário.
 */
export function icsDoEvento(a: { id: string; titulo: string; texto: string; evento: EventoComunicado }, condominio: string, agora: Date = new Date()): string {
  const e = a.evento;
  const proximoDia = (() => { const d = new Date(`${e.dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const quando = e.inicio
    ? [`DTSTART;TZID=${FUSO}:${compacto(e.dia, e.inicio)}`, `DTEND;TZID=${FUSO}:${compacto(e.dia, e.fim ?? somarHora(e.inicio))}`]
    : [`DTSTART;VALUE=DATE:${compacto(e.dia)}`, `DTEND;VALUE=DATE:${compacto(proximoDia)}`];
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TRIADE Condo//Mural//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:mural-${a.id}@triade-condo`, `DTSTAMP:${carimbo}`, ...quando,
    `SUMMARY:${escaparIcs(a.titulo)}`, ...(e.local ? [`LOCATION:${escaparIcs(e.local)}`] : []),
    `DESCRIPTION:${escaparIcs(`${a.texto}\n\n${condominio}`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

function somarHora(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/** O nome do arquivo .ics, sem acento nem espaço. */
export function nomeDoIcs(titulo: string): string {
  const base = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "evento"}.ics`;
}

"use client";
// Peças comuns das telas de pedidos (passo 4).

import { CANAIS_PEDIDO, ESTADOS_PEDIDO, MEIOS_RETORNO, mostrarDataCurta, TIPOS_PENDENCIA } from "@triade/domain";
import { Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import type { EstadoPedido } from "../tipos.ts";

export const opcoesDe = (o: Record<string, string>) => Object.entries(o).map(([valor, texto]) => ({ valor, texto }));
export const opcoesCanal = opcoesDe(CANAIS_PEDIDO);
export const opcoesMeio = opcoesDe(MEIOS_RETORNO);
export const opcoesPendencia = opcoesDe(TIPOS_PENDENCIA);

export function nomeDe(o: Record<string, string>, codigo: string | null | undefined): string {
  return codigo ? o[codigo] ?? codigo : "";
}

/** Uma cor por situação (DC15): Aberto em petróleo, Em andamento em violeta, Em revisão em âmbar,
 * Encerrado em jade e Cancelado em cinza. A etapa vem junto quando diz mais que a situação. */
export const TOM_SITUACAO: Record<EstadoPedido, Tom> = { ABERTO: "info", EM_ANDAMENTO: "andamento", EM_REVISAO: "atencao", ENCERRADO: "ok", CANCELADO: "neutro" };

export function seloSituacao(estado: EstadoPedido, etapa?: string | null): { tom: Tom; texto: string } {
  const nome = ESTADOS_PEDIDO[estado];
  const comEtapa = etapa && etapa.toLowerCase() !== nome.toLowerCase() && estado !== "CANCELADO";
  return { tom: TOM_SITUACAO[estado], texto: comEtapa ? `${nome} · ${etapa}` : nome };
}

/** Situação do pedido: palavra e forma, além da cor. */
export function SeloEstadoPedido({ estado, etapa }: { estado: EstadoPedido; etapa?: string | null }) {
  const s = seloSituacao(estado, etapa);
  return <Selo tom={s.tom}>{s.texto}</Selo>;
}

/** A prioridade só aparece quando é Alta ou Urgente (DC15). */
export function SeloPrioridade({ nome }: { nome: string }) {
  if (!/^(alta|urgente)/i.test(nome)) return null;
  const urgente = /^urgente/i.test(nome);
  return <span className="selo inline-flex items-center gap-1" data-tom={urgente ? "erro" : "atencao"}><Icone nome="alerta" className="h-3.5 w-3.5" />{nome}</span>;
}

const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** 17/10, no horário de Brasília. */
export function dia(iso: string): string {
  return DIA.format(new Date(iso));
}

/** O dia de um instante no horário de Brasília, como "2026-10-17". */
export function diaDe(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** 17/10 09:00, no horário de Brasília. */
export function diaHora(iso: string): string {
  return DIA_HORA.format(new Date(iso)).replace(",", "");
}

/** 22/10/2026, 09:40, no horário de Brasília: para o que fica guardado (dossiê, exportação). */
export function diaHoraComAno(iso: string): string {
  return `${mostrarDataCurta(diaDe(iso))}, ${HORA.format(new Date(iso))}`;
}

/** Quanto falta (ou quanto passou) até o próximo retorno: "daqui a 20 h", "venceu às 14:00". */
export function faltaPara(iso: string, agoraIso: string): string {
  const min = Math.round((Date.parse(iso) - Date.parse(agoraIso)) / 60000);
  if (min < 0) {
    return DIA.format(new Date(iso)) === DIA.format(new Date(agoraIso)) ? `venceu às ${HORA.format(new Date(iso))}` : `venceu em ${diaHora(iso)}`;
  }
  if (min < 60) return `daqui a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `daqui a ${h} h` : `daqui a ${Math.floor(h / 24)} dias`;
}

/** Valor de um campo datetime-local (horário de Brasília) para ISO com fuso. */
export function deDataHoraLocal(v: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00-03:00` : null;
}

/** ISO para o valor de um campo datetime-local no horário de Brasília. */
export function paraDataHoraLocal(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "às 13:00" no mesmo dia; senão "em 16/10 13:00". */
export function aHora(iso: string, agoraIso: string): string {
  return DIA.format(new Date(iso)) === DIA.format(new Date(agoraIso)) ? `às ${HORA.format(new Date(iso))}` : `em ${diaHora(iso)}`;
}

const ICONES_CATEGORIA: [RegExp, NomeIcone][] = [
  [/manuten|conserto|reparo|obra|hidr|el[eé]tric/, "ferramenta"],
  [/limpeza|jardin/, "estrela"],
  [/barulho|conviv|reclama/, "balao"],
  [/seguran/, "escudo"],
  [/portaria|acesso|chave|interfone/, "chave"],
  [/boleto|cobran|financ|document/, "documento"],
  [/garagem|vaga/, "predio"],
];

/** O ícone da categoria, pelo nome (cada condomínio dá os seus). Sempre em cinza (DC15). */
export function iconeDaCategoria(nome: string | null | undefined): NomeIcone {
  const n = (nome ?? "").toLowerCase();
  return ICONES_CATEGORIA.find(([r]) => r.test(n))?.[1] ?? "pedido";
}

/** O ícone de como o pedido chegou. */
export const ICONE_CANAL: Record<string, NomeIcone> = {
  TELEFONE: "telefone", PRESENCIAL: "pessoa", MENSAGEM: "balao", EMAIL: "email", OBSERVACAO: "olho", OUTRO: "info", WHATSAPP: "whats",
};

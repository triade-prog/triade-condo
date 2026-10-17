"use client";
// Peças comuns das telas de pedidos (passo 4).

import { CANAIS_PEDIDO, ESTADOS_PEDIDO, MEIOS_RETORNO, TIPOS_PENDENCIA } from "@triade/domain";
import { Selo } from "@triade/ui";
import type { EstadoPedido } from "../tipos.ts";

export const opcoesDe = (o: Record<string, string>) => Object.entries(o).map(([valor, texto]) => ({ valor, texto }));
export const opcoesCanal = opcoesDe(CANAIS_PEDIDO);
export const opcoesMeio = opcoesDe(MEIOS_RETORNO);
export const opcoesPendencia = opcoesDe(TIPOS_PENDENCIA);

export function nomeDe(o: Record<string, string>, codigo: string | null | undefined): string {
  return codigo ? o[codigo] ?? codigo : "";
}

/** Situação do pedido: palavra e forma, além da cor. */
export function SeloEstadoPedido({ estado }: { estado: EstadoPedido }) {
  const nome = ESTADOS_PEDIDO[estado];
  if (estado === "ENCERRADO") return <Selo tom="ok" marca="ok">{nome}</Selo>;
  if (estado === "CANCELADO") return <Selo tom="neutro" marca="inativo">{nome}</Selo>;
  if (estado === "EM_REVISAO") return <Selo tom="info" marca="interno">{nome}</Selo>;
  if (estado === "EM_ANDAMENTO") return <Selo tom="info" marca="andamento">{nome}</Selo>;
  return <Selo tom="neutro" marca="andamento">{nome}</Selo>;
}

const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** 17/10 09:00, no horário de Brasília. */
export function diaHora(iso: string): string {
  return DIA_HORA.format(new Date(iso)).replace(",", "");
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

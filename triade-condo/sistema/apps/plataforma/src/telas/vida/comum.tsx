"use client";
// Peças comuns da Vida em condomínio (peça R12, design "Vida em condomínio"): o dia curto, o
// horário e a situação da reserva em selo, sempre com a palavra.

import { diaDaSemana, ESTADOS_RESERVA, inicioDaSemana, somarDias, type EstadoReserva } from "@triade/domain";
import { Selo, type Tom } from "@triade/ui";

const TOM_RESERVA: Record<EstadoReserva, Tom> = { A_APROVAR: "atencao", CONFIRMADA: "ok", RECUSADA: "neutro", CANCELADA: "neutro" };

export function SeloReserva({ estado, tolerancia }: { estado: EstadoReserva; tolerancia?: boolean }) {
  if (tolerancia && estado === "CONFIRMADA") return <Selo tom="andamento">Tolerância</Selo>;
  return <Selo tom={TOM_RESERVA[estado]}>{ESTADOS_RESERVA[estado]}</Selo>;
}

/** "sáb, 25/10". */
export function diaCurto(d: string): string {
  return `${diaDaSemana(d).slice(0, 3)}, ${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** "11:00 às 18:00". */
export function horario(r: { horaInicio: string; horaFim: string }): string {
  return `${r.horaInicio.slice(0, 5)} às ${r.horaFim.slice(0, 5)}`;
}

/** A segunda-feira da semana de uma data (a semana da área começa na segunda, como no desenho). */
export function segundaDaSemana(d: string): string {
  const seg = somarDias(inicioDaSemana(d), 1);
  return seg > d ? somarDias(seg, -7) : seg;
}

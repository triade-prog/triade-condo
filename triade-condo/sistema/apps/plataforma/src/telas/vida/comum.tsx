"use client";
// Peças comuns da Vida em condomínio (peça R12, design "Vida em condomínio"; DC15, telas-modelo
// vida-*): o dia curto e em quadrado, o horário, a situação da reserva em selo, sempre com a
// palavra, o andamento em linha do tempo e o link de volta.

import Link from "next/link";
import { diaDaSemana, ESTADOS_RESERVA, inicioDaSemana, somarDias, type EstadoReserva } from "@triade/domain";
import { Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";

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

/** O dia num quadrado (DC15, telas-modelo vida-*): "TER / 27 / out". */
export function DiaQuadro({ d, tom = "violeta" }: { d: string; tom?: Tom | "violeta" }) {
  const mes = new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return (
    <span className="ladrilho h-13 w-13 content-center rounded-[14px] leading-tight" data-tom={tom} aria-hidden="true">
      <span className="text-[11px] font-semibold uppercase tracking-wider">{diaDaSemana(d).slice(0, 3)}</span>
      <span className="text-[19px] font-bold">{d.slice(8, 10)}</span>
      <span className="text-[11px]">{mes}</span>
    </span>
  );
}

export interface PassoTempo { icone: NomeIcone; tom: Tom; titulo: string; quando: string; futuro?: boolean }

/** Andamento (como na ficha do pedido e do comunicado): o mais antigo em cima; o que ainda vai
 * acontecer fica com a borda tracejada. */
export function LinhaDoTempo({ itens }: { itens: PassoTempo[] }) {
  return (
    <ol className="grid">
      {itens.map((h, i) => (
        <li key={i} className={`relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 ${i === itens.length - 1 ? "" : "pb-4 before:absolute before:top-10 before:bottom-0 before:left-[18px] before:w-px before:bg-linha"}`}>
          <span className={`ladrilho h-9 w-9 rounded-full ${h.futuro ? "border border-dashed border-current" : ""}`} data-tom={h.tom} aria-hidden="true"><Icone nome={h.icone} className="h-4.5 w-4.5" /></span>
          <div className="grid gap-0.5 pt-1">
            <p className="font-medium">{h.titulo}</p>
            <p className="t-apoio">{h.quando}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** O link de volta, no topo das páginas da Vida em condomínio. */
export function Voltar({ href, texto }: { href: string; texto: string }) {
  return (
    <Link href={href} className="flex items-center gap-1 justify-self-start text-sm font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />{texto}
    </Link>
  );
}

import { describe, expect, it } from "vitest";
import {
  cancelarCompromissoSchema,
  descreverEventoCompromisso,
  descreverRepeticao,
  diasEntre,
  gradeDoMes,
  inicioDaSemana,
  marcarCompromissoSchema,
  mesVizinho,
  mostrarHorario,
  nomeDoMesAno,
  periodoAgendaSchema,
  reagendarCompromissoSchema,
  somarDias,
} from "./agenda.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const BASE = { tipo: "VISITA", titulo: "Encanador no apto 101", data: "2026-10-20" };

describe("agenda (peça R7)", () => {
  it("AG-01: tipo, título e lugar; o fim vem depois do início", () => {
    expect(marcarCompromissoSchema.parse(BASE).estado).toBe("PLANEJADO");
    expect(marcarCompromissoSchema.safeParse({ ...BASE, tipo: "FESTA" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, titulo: "Oi" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, horaInicio: "15:00", horaFim: "14:00" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, horaFim: "14:00" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, onde: "UNIDADE" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, onde: "UNIDADE", unidadeId: U }).success).toBe(true);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, onde: "AREA_COMUM", local: " " }).success).toBe(false);
  });

  it("AG-05: repete até uma data ou por um número de vezes", () => {
    expect(marcarCompromissoSchema.safeParse({ ...BASE, repetir: "SEMANAL" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, repetir: "SEMANAL", vezes: 4 }).success).toBe(true);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, repetir: "MENSAL", intervalo: 6, ate: "2028-10-20" }).success).toBe(true);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, repetir: "SEMANAL", vezes: 4, ate: "2027-01-01" }).success).toBe(false);
    expect(marcarCompromissoSchema.safeParse({ ...BASE, repetir: "SEMANAL", vezes: 105 }).success).toBe(false);
  });

  it("AG-02: reagendar e cancelar pedem o motivo", () => {
    expect(reagendarCompromissoSchema.safeParse({ versao: 1, data: "2026-10-27", motivo: "" }).success).toBe(false);
    expect(reagendarCompromissoSchema.parse({ versao: 1, data: "2026-10-27", motivo: "Chuva" }).escopo).toBe("ESTA");
    expect(cancelarCompromissoSchema.safeParse({ versao: 1, motivo: " " }).success).toBe(false);
  });

  it("AG-03: período de até 93 dias", () => {
    expect(periodoAgendaSchema.safeParse({ de: "2026-10-01", ate: "2026-11-15" }).success).toBe(true);
    expect(periodoAgendaSchema.safeParse({ de: "2026-10-01", ate: "2027-01-15" }).success).toBe(false);
    expect(periodoAgendaSchema.safeParse({ de: "2026-10-10", ate: "2026-10-01" }).success).toBe(false);
  });

  it("datas sem fuso do aparelho", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(diasEntre("2026-10-17", "2026-10-20")).toBe(3);
    expect(inicioDaSemana("2026-10-17")).toBe("2026-10-11");
    expect(mesVizinho("2026-12-15", 1)).toBe("2027-01-01");
    expect(nomeDoMesAno("2026-10-17")).toBe("outubro de 2026");
  });

  it("AG-03: o mês de outubro de 2026 começa na quinta e ocupa 5 semanas", () => {
    const g = gradeDoMes("2026-10-17");
    expect(g.length).toBe(35);
    expect(g[0]).toEqual({ data: "2026-09-27", doMes: false });
    expect(g[4]).toEqual({ data: "2026-10-01", doMes: true });
    expect(g[34]).toEqual({ data: "2026-10-31", doMes: true });
  });

  it("o horário, a repetição e o histórico em palavras", () => {
    expect(mostrarHorario({ horaInicio: "14:00", horaFim: "15:00" })).toBe("14:00 às 15:00");
    expect(mostrarHorario({ horaInicio: "10:00" })).toBe("10:00");
    expect(mostrarHorario({})).toBe("Dia todo");
    expect(descreverRepeticao({ frequencia: "MENSAL", intervalo: 6, ate: "2028-10-20" })).toBe("A cada 6 meses, até 20/10/2028");
    expect(descreverRepeticao({ frequencia: "SEMANAL", intervalo: 1 })).toBe("Toda semana");
    expect(descreverEventoCompromisso("compromisso.reagendado", { de: "2026-10-13", para: "2026-10-20" })).toBe("Reagendado de 13/10/2026 para 20/10/2026");
    expect(descreverEventoCompromisso("estado.mudou", { de: "PLANEJADO", para: "CONFIRMADO" })).toBe("Confirmado");
    expect(descreverEventoCompromisso("estado.mudou", { para: "CANCELADO" })).toBe("Cancelado");
  });
});

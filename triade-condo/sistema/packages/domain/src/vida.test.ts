import { describe, expect, it } from "vitest";
import {
  areaSchema,
  descreverArea,
  descreverEventoReserva,
  duracaoBloco,
  filtroReservasSchema,
  horaCurta,
  motivoReservaSchema,
  reais,
  registrarReservaSchema,
  textoLimite,
} from "./vida.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const SALAO = {
  nome: "Salão de festas", reserva: "SINDICO", antecedenciaMin: 2, antecedenciaMax: 60, horaInicio: "10:00", horaFim: "23:00",
  modo: "PERIODO", capacidade: 80, limiteQuantidade: 1, limitePeriodo: "MES",
} as const;

describe("vida em condomínio (peça R12)", () => {
  it("AC-07: a área tem horário, antecedência, blocos e limite coerentes", () => {
    expect(areaSchema.parse(SALAO).cancelarSemAvisoDias).toBe(3);
    expect(areaSchema.safeParse({ ...SALAO, horaFim: "09:00" }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, horaFim: "24:00" }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, antecedenciaMin: 70 }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS" }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS", blocoMinutos: 45 }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, modo: "BLOCOS", blocoMinutos: 60 }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, limitePeriodo: null }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, limiteQuantidade: null, limitePeriodo: null, toleranciaDias: 7 }).success).toBe(false);
  });

  it("AC-01: área ativa precisa de alguém que possa reservar", () => {
    const ninguem = { podeProprietarioMorador: false, podeInquilino: false, podeProprietarioAusente: false };
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: true }).success).toBe(false);
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: false }).success).toBe(true);
    expect(areaSchema.safeParse({ ...SALAO, ...ninguem, ativa: true, reserva: "SEM_RESERVA" }).success).toBe(true);
  });

  it("AC-07: a linha da área diz as regras como no desenho", () => {
    expect(descreverArea(SALAO)).toBe("Síndico aprova · 2 a 60 dias de antecedência · 10h às 23h · até 80 pessoas · 1 por mês por unidade");
    expect(descreverArea({ ...SALAO, reserva: "AUTOMATICA", antecedenciaMin: 0, antecedenciaMax: 7, modo: "BLOCOS", blocoMinutos: 120,
      capacidade: 12, limiteQuantidade: null, limitePeriodo: null, criadaPeloSindico: true }))
      .toBe("Criada pelo síndico · Automática · até 7 dias · blocos de 2 horas, 10h às 23h · até 12 pessoas");
    expect(descreverArea({ ...SALAO, reserva: "AUTOMATICA", limiteQuantidade: 2, toleranciaDias: 7 })).toContain("2 por mês por unidade, +1 se sobrar");
    expect(descreverArea({ ...SALAO, reserva: "SEM_RESERVA", horaInicio: "06:00" })).toBe("Uso livre, sem reserva · 6h às 23h");
  });

  it("AC-06: a conta do limite na reserva", () => {
    expect(textoLimite({ n: 2, quantidade: 2, periodo: "MES" }, "2026-10-26", false)).toBe("2ª reserva da unidade em outubro (limite 2)");
    expect(textoLimite({ n: 3, quantidade: 2, periodo: "MES" }, "2026-11-01", true)).toMatch(/^3ª em novembro, aceita/);
  });

  it("registrar, recusar e listar", () => {
    expect(registrarReservaSchema.parse({ areaId: U, unidadeId: U, data: "2026-10-25" }).contatoId).toBeNull();
    expect(registrarReservaSchema.safeParse({ areaId: U, unidadeId: U, data: "25/10" }).success).toBe(false);
    expect(motivoReservaSchema.safeParse({ versao: 1, motivo: "  " }).success).toBe(false);
    expect(filtroReservasSchema.parse({}).filtro).toBe("A_APROVAR");
  });

  it("textos", () => {
    expect(horaCurta("08:30")).toBe("8h30");
    expect(horaCurta("24:00")).toBe("24h");
    expect(duracaoBloco(60)).toBe("1 hora");
    expect(duracaoBloco(90)).toBe("1h30");
    expect(reais(15000)).toBe("R$ 150,00");
    expect(descreverEventoReserva("estado.mudou", { para: "CONFIRMADA" })).toBe("Confirmada na hora");
    expect(descreverEventoReserva("estado.mudou", { de: "A_APROVAR", para: "CONFIRMADA" })).toBe("Aprovada");
    expect(descreverEventoReserva("estado.mudou", { para: "CANCELADA", evento: "CANCELADA_PELO_MORADOR" })).toBe("Cancelada pelo morador");
  });
});

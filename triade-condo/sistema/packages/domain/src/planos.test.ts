import { describe, expect, it } from "vitest";
import { conjuntoDaAcao, mostrarValor, nomeCompetencia, planoSchema, proximaCompetencia, recebimentoSchema } from "./planos.ts";

const plano = { nome: "Fundador", ciclo: "MENSAL", diaVencimento: 10, implantacaoSemCobranca: true, inicioCompetencia: "2026-11-01" };

describe("planos e cobrança (0291)", () => {
  it("PI-07: valor vazio é Valor a definir, nunca zero", () => {
    expect(mostrarValor(null)).toBe("Valor a definir");
    expect(mostrarValor(12900)).toBe("R$ 129,00");
    expect(planoSchema.parse(plano).valor).toBeNull();
    expect(planoSchema.safeParse({ ...plano, valor: 0 }).success).toBe(false);
    expect(planoSchema.safeParse({ ...plano, valor: 129.9 }).success).toBe(false);
  });

  it("NG-01: a faixa de unidades precisa fechar", () => {
    expect(planoSchema.safeParse({ ...plano, unidadesDe: 41, unidadesAte: 100 }).success).toBe(true);
    expect(planoSchema.safeParse({ ...plano, unidadesDe: 101, unidadesAte: 100 }).success).toBe(false);
  });

  it("PI-03: cada ação cai no seu conjunto; o atendimento fica na base", () => {
    expect(conjuntoDaAcao("agenda.editar")).toBe("AGENDA");
    expect(conjuntoDaAcao("enquetes.ver")).toBe("VIDA");
    expect(conjuntoDaAcao("memoria.exportar")).toBe("COMUNICACAO_AMPLIADA");
    expect(conjuntoDaAcao("pedidos.ver")).toBeNull();
  });

  it("competências por extenso e a seguinte", () => {
    expect(nomeCompetencia("2026-10-01")).toBe("Outubro/2026");
    expect(proximaCompetencia("2026-12-01")).toBe("2027-01-01");
  });

  it("recebimento de um cliente pede a cobrança; sem cliente, não", () => {
    const r = { valor: 10000, recebidoEm: "2026-10-21", forma: "PIX", referencia: "E1234" };
    expect(recebimentoSchema.safeParse({ ...r, condominioId: "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b" }).success).toBe(false);
    expect(recebimentoSchema.safeParse(r).success).toBe(true);
  });
});

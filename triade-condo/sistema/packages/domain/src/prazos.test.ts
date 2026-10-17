import { describe, expect, it } from "vitest";
import { descreverEventoPedido } from "./pedidos.ts";
import { marcarAvisosSchema, mostrarHoras, mostrarPorcentagem, nomeDoMes, nomeDoMesAnterior, regrasAvisoSchema } from "./prazos.ts";

const V = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const REGRAS = { versao: 1, sindicoHoras: 2, substitutoHoras: 8, semResponsavelHoras: 4, pendenciaDias: 3 };

describe("prazos e avisos (passos 6 e 7)", () => {
  it("AT-09: o substituto é avisado depois do síndico; sem substituto, o aviso para no síndico", () => {
    expect(regrasAvisoSchema.parse(REGRAS).substitutoId).toBe(null);
    expect(regrasAvisoSchema.safeParse({ ...REGRAS, substitutoHoras: 2 }).success).toBe(false);
    expect(regrasAvisoSchema.safeParse({ ...REGRAS, sindicoHoras: 0 }).success).toBe(false);
    expect(regrasAvisoSchema.safeParse({ ...REGRAS, pendenciaDias: 61 }).success).toBe(false);
    expect(regrasAvisoSchema.safeParse({ ...REGRAS, substitutoId: V }).success).toBe(true);
  });

  it("F6.1: marcar sem ids marca todos", () => {
    expect(marcarAvisosSchema.parse({}).ids).toBe(null);
    expect(marcarAvisosSchema.parse({ ids: [V] }).ids).toEqual([V]);
    expect(marcarAvisosSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("TR-07: sem nenhum caso, sem dados, nunca zero", () => {
    expect(mostrarPorcentagem(null)).toBe("Sem dados");
    expect(mostrarPorcentagem(0)).toBe("0%");
    expect(mostrarPorcentagem(86)).toBe("86%");
  });

  it("horas em palavras curtas", () => {
    expect(mostrarHoras(0.5)).toBe("30 min");
    expect(mostrarHoras(3)).toBe("3 h");
    expect(mostrarHoras(2.5)).toBe("2,5 h");
    expect(mostrarHoras(72)).toBe("3 dias");
    expect(mostrarHoras(null)).toBe("Sem dados");
  });

  it("o mês fechado e o anterior", () => {
    expect(nomeDoMes("2026-09")).toBe("setembro");
    expect(nomeDoMesAnterior("2026-09")).toBe("agosto");
    expect(nomeDoMesAnterior("2026-01")).toBe("dezembro");
  });

  it("AT-17: cada aviso vai para o histórico do pedido, sem nome", () => {
    expect(descreverEventoPedido("pedido.retorno_venceu", { de: "2026-10-17T13:00:00Z" })).toBe("Retorno venceu");
    expect(descreverEventoPedido("pedido.aviso", { tipo: "RETORNO_VENCIDO", para: "RESPONSAVEL" })).toBe("Aviso ao responsável");
    expect(descreverEventoPedido("pedido.aviso", { tipo: "ESCALADO_SINDICO", para: "SINDICO" })).toBe("Aviso escalado ao síndico");
    expect(descreverEventoPedido("pedido.aviso", { tipo: "ESCALADO_SUBSTITUTO", para: "SUBSTITUTO" })).toBe("Aviso escalado ao substituto");
    expect(descreverEventoPedido("pedido.aviso", { tipo: "SEM_RESPONSAVEL", para: "SINDICO" })).toBe("Aviso ao síndico: pedido sem responsável");
  });
});

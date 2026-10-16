import { describe, expect, it } from "vitest";
import { descreverEventoPedido, registrarPedidoSchema, revisarPedidoSchema, tempoAberto } from "./pedidos.ts";

const V = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const NOVO = { categoriaId: V, prioridadeId: V, assunto: "Vazamento", descricao: "Mancha no teto", canal: "TELEFONE" };

describe("pedidos (passo 4)", () => {
  it("AT-01: unidade ou local; contato só com a unidade", () => {
    expect(registrarPedidoSchema.safeParse(NOVO).success).toBe(false);
    expect(registrarPedidoSchema.safeParse({ ...NOVO, local: "Garagem" }).success).toBe(true);
    expect(registrarPedidoSchema.safeParse({ ...NOVO, local: "Garagem", contatoId: V }).success).toBe(false);
    expect(registrarPedidoSchema.parse({ ...NOVO, unidadeId: V }).privado).toBe(false);
  });

  it("AT-02: há quanto tempo está aberto, em palavras curtas", () => {
    const desde = "2026-10-16T12:00:00Z";
    expect(tempoAberto(desde, "2026-10-16T12:40:00Z")).toBe("40 min");
    expect(tempoAberto(desde, "2026-10-16T17:10:00Z")).toBe("5 h");
    expect(tempoAberto(desde, "2026-10-17T13:00:00Z")).toBe("1 dia");
    expect(tempoAberto(desde, "2026-10-19T12:00:00Z")).toBe("3 dias");
  });

  it("AT-14: devolver pede motivo, aprovar não", () => {
    expect(revisarPedidoSchema.safeParse({ versao: 2, aprovar: false }).success).toBe(false);
    expect(revisarPedidoSchema.safeParse({ versao: 2, aprovar: true }).success).toBe(true);
  });

  it("AT-17: o histórico vira frase, com antes, depois e motivo", () => {
    expect(descreverEventoPedido("pedido.alterado", { campo: "prioridade", de: "Normal", para: "Urgente" })).toBe("Prioridade: Normal → Urgente");
    expect(descreverEventoPedido("pedido.responsavel", { de: V, para: V, deNome: "Bruna", paraNome: "Ana", motivo: "Fim do turno" }))
      .toBe("Repassado: Bruna → Ana. Motivo: Fim do turno");
    expect(descreverEventoPedido("estado.mudou", { de: "ENCERRADO", para: "EM_ANDAMENTO", evento: "REABERTO", motivo: "A mancha voltou" }))
      .toBe("Reaberto. Situação: Encerrado → Em andamento. Motivo: A mancha voltou");
    expect(descreverEventoPedido("pedido.previsao_mudou", { de: "2026-10-20", para: null, motivo: "Sem data do fornecedor" }))
      .toBe("Previsão de solução: 20/10/2026 → sem previsão. Motivo: Sem data do fornecedor");
  });
});

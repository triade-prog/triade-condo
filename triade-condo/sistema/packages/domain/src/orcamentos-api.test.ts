// Orçamentos (R8): o que o banco e a API usam do domínio, acrescentado na 0317.
import { describe, expect, it } from "vitest";
import { AVISOS_ORCAMENTO, caminhoLinkOrcamento, enviarAnexoOrcamentoSchema, PARTES_ANEXO_ORCAMENTO } from "./orcamentos.ts";

describe("orçamentos: o que a 0317 acrescentou", () => {
  it("o aviso do preço confirmado tem texto, como os outros que o banco grava", () => {
    const doBanco = ["PROPOSTA_RECEBIDA", "RECUSOU", "PRAZO_FECHOU", "PRECO_CONFIRMADO", "ACEITE", "SEM_ACEITE_5D", "APROVADA"];
    expect(Object.keys(AVISOS_ORCAMENTO).sort()).toEqual([...doBanco].sort());
    expect(AVISOS_ORCAMENTO.PRECO_CONFIRMADO).toBe("O fornecedor confirmou o preço");
  });
  it("o anexo da gestão é do pedido ou a nota fiscal; o PDF da proposta só vem pelo link", () => {
    expect(Object.keys(PARTES_ANEXO_ORCAMENTO)).toEqual(["PEDIDO", "NOTA_FISCAL"]);
    expect(enviarAnexoOrcamentoSchema.parse({ nome: " Foto.png ", tipo: "image/png", tamanho: 10 })).toEqual({ parte: "PEDIDO", nome: "Foto.png", tipo: "image/png", tamanho: 10 });
    expect(enviarAnexoOrcamentoSchema.parse({ parte: "NOTA_FISCAL", nome: "NF.pdf", tipo: "application/pdf", tamanho: 10 }).parte).toBe("NOTA_FISCAL");
    expect(enviarAnexoOrcamentoSchema.safeParse({ parte: "PROPOSTA", nome: "x.pdf", tipo: "application/pdf", tamanho: 10 }).success).toBe(false);
  });
  it("o link do fornecedor é /o/<código>", () => {
    expect(caminhoLinkOrcamento("abc-123_XYZ")).toBe("/o/abc-123_XYZ");
  });
});

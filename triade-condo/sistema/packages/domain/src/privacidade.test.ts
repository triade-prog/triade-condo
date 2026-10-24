import { describe, expect, it } from "vitest";
import { csvDadosPessoa, guardarSchema, modoRetencaoSchema, removerDadosPessoaSchema, tirarGuardaSchema } from "./privacidade.ts";

const id = "6b0c7f0e-6f2a-4a8e-9a55-2f0e9f1c1a11";

describe("privacidade (F0.11)", () => {
  it("guardar pede o motivo e, em Outro, o detalhe", () => {
    expect(guardarSchema.safeParse({ entidade: "PEDIDO", alvoId: id, motivo: "PROCESSO" }).success).toBe(true);
    expect(guardarSchema.safeParse({ entidade: "PEDIDO", alvoId: id, motivo: "OUTRO", detalhe: "  " }).success).toBe(false);
    expect(guardarSchema.safeParse({ entidade: "PEDIDO", alvoId: id, motivo: "OUTRO", detalhe: "Perícia do condomínio" }).success).toBe(true);
    expect(guardarSchema.safeParse({ entidade: "UNIDADE", alvoId: id, motivo: "PROCESSO" }).success).toBe(false);
  });
  it("tirar a guarda e remover os dados pedem motivo", () => {
    expect(tirarGuardaSchema.safeParse({ versao: 1, motivo: "ok" }).success).toBe(false);
    expect(tirarGuardaSchema.safeParse({ versao: 1, motivo: "O processo terminou" }).success).toBe(true);
    expect(removerDadosPessoaSchema.safeParse({ versao: 2, motivo: "PRAZO" }).success).toBe(false);
    expect(removerDadosPessoaSchema.safeParse({ versao: 2, motivo: "PEDIDO" }).success).toBe(true);
  });
  it("o modo é só CONTANDO ou APAGANDO", () => {
    expect(modoRetencaoSchema.safeParse({ modo: "APAGANDO", versao: 1 }).success).toBe(true);
    expect(modoRetencaoSchema.safeParse({ modo: "DESLIGADO", versao: 1 }).success).toBe(false);
  });
  it("a planilha escapa aspas, ponto e vírgula e fórmulas", () => {
    const csv = csvDadosPessoa([
      { parte: "Cadastro", quando: "2026-01-10T13:00:00Z", o_que: 'Ana; "Aninha"' },
      { parte: "Mensagem de WhatsApp", quando: null, o_que: "=HYPERLINK(1)" },
    ]);
    expect(csv).toBe('Parte;Quando;O que\r\nCadastro;2026-01-10T13:00:00Z;"Ana; ""Aninha"""\r\nMensagem de WhatsApp;;\'=HYPERLINK(1)\r\n');
  });
});

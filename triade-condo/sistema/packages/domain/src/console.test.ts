import { describe, expect, it } from "vitest";
import {
  contatoSchema,
  criarCondominioSchema,
  fichaSchema,
  normalizarTelefone,
} from "./console.ts";

describe("contratos do Console (passo 1)", () => {
  it("W-01: telefone vira o formato internacional", () => {
    expect(normalizarTelefone("(61) 99999-0001")).toBe("+5561999990001");
    expect(normalizarTelefone("+55 61 3333-0000")).toBe("+556133330000");
    expect(fichaSchema.shape.numeroWhatsapp.parse("61 99999 0001")).toBe("+5561999990001");
    expect(fichaSchema.shape.numeroWhatsapp.parse("")).toBeNull();
    expect(fichaSchema.shape.numeroWhatsapp.safeParse("123").success).toBe(false);
  });

  it("contato precisa de telefone ou e-mail", () => {
    expect(contatoSchema.safeParse({ nome: "Zé", papel: "Zelador" }).success).toBe(false);
    expect(contatoSchema.parse({ nome: "Ana", papel: "Síndica", email: "ANA@Exemplo.invalid " }).email).toBe("ana@exemplo.invalid");
  });

  it("cadastro de condomínio: UF válida e cenário opcional", () => {
    expect(criarCondominioSchema.parse({ nome: " Residencial Ipê ", cidade: "Brasília", uf: "DF" })).toEqual({
      nome: "Residencial Ipê",
      cidade: "Brasília",
      uf: "DF",
      cenario: null,
    });
    expect(criarCondominioSchema.safeParse({ nome: "Residencial Ipê", cidade: "Brasília", uf: "ZZ" }).success).toBe(false);
    expect(criarCondominioSchema.safeParse({ nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", cenario: "CASTELO" }).success).toBe(false);
  });
});

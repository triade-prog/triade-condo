import { describe, expect, it } from "vitest";
import { entrarSchema, escolherCondominioSchema, redefinirSenhaSchema } from "./schemas.ts";

describe("contratos de entrada", () => {
  it("normaliza o e-mail", () => {
    expect(entrarSchema.parse({ email: "  Ana@Exemplo.COM ", senha: "x" }).email).toBe("ana@exemplo.com");
  });

  it("senha nova com 12 caracteres ou mais", () => {
    expect(redefinirSenhaSchema.safeParse({ tokenHash: "a".repeat(20), novaSenha: "curta" }).success).toBe(false);
    expect(redefinirSenhaSchema.safeParse({ tokenHash: "a".repeat(20), novaSenha: "uma-senha-longa" }).success).toBe(true);
  });

  it("condomínio escolhido é um identificador, nunca um nome", () => {
    expect(escolherCondominioSchema.safeParse({ condominioId: "Residencial Sol" }).success).toBe(false);
  });
});

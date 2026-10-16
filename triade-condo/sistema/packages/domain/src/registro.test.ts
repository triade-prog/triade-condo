import { describe, expect, it } from "vitest";
import { limparParaLog, linhaDeLog } from "./registro.ts";

describe("PT-13: logs sem senhas, tokens nem dado pessoal", () => {
  it("esconde o valor das chaves sensíveis em qualquer nível", () => {
    const limpo = limparParaLog({
      rota: "/v1/auth/entrar",
      corpo: { email: "ana@exemplo.com", senha: "segredo-forte-123" },
      cabecalhos: { Authorization: "Bearer abc", cookie: "__Host-console=xyz" },
      lista: [{ refreshToken: "r1" }, { telefone: "+5571999999999" }],
    });
    expect(JSON.stringify(limpo)).not.toMatch(/ana@exemplo|segredo-forte|Bearer abc|xyz|r1|5571999/);
    expect(limpo).toMatchObject({ rota: "/v1/auth/entrar", corpo: { email: "[oculto]", senha: "[oculto]" } });
  });

  it("limpa segredos dentro de texto livre", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJh";
    const texto = limparParaLog(`falhou ${jwt} em https://x.y/r?token=abc123&ok=1 para ana@exemplo.com.br`);
    expect(texto).toBe("falhou [oculto] em https://x.y/r?token=[oculto]&ok=1 para [e-mail]");
  });

  it("erro vira nome e mensagem limpa", () => {
    expect(limparParaLog(new Error("Bearer abc.def"))).toEqual({ nome: "Error", mensagem: "Bearer [oculto]" });
  });

  it("monta a linha em JSON", () => {
    expect(JSON.parse(linhaDeLog("aviso", { funcao: "api", token: "t" }))).toEqual({ nivel: "aviso", funcao: "api", token: "[oculto]" });
  });
});

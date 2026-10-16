import { describe, expect, it } from "vitest";
import { CODIGOS_ERRO, ErroDominio, ERROS_BANCO, ehCodigoErro } from "./erros.ts";
import { TEXTOS_ERRO } from "./textos.ts";

describe("PT-17: erros padronizados", () => {
  it("todo código tem texto para a pessoa, sem termo técnico", () => {
    for (const codigo of Object.keys(CODIGOS_ERRO)) {
      const texto = TEXTOS_ERRO[codigo as keyof typeof CODIGOS_ERRO];
      expect(texto, codigo).toBeTruthy();
      expect(texto, codigo).not.toMatch(/\b(null|undefined|exception|stack|sql|http|api)\b/i);
    }
  });

  it("corpo do erro tem formato estável", () => {
    expect(new ErroDominio("VERSION_CONFLICT", { versao: 3 }).toJSON()).toEqual({ erro: { codigo: "VERSION_CONFLICT", detalhes: { versao: 3 } } });
    expect(new ErroDominio("FORBIDDEN").status).toBe(403);
  });

  it("erros do banco viram códigos conhecidos", () => {
    for (const codigo of Object.values(ERROS_BANCO)) expect(ehCodigoErro(codigo)).toBe(true);
  });
});

// Regras · Decisões e conselho (R5, quadro 421): o sub de cada quórum diz quantos votos aprovam
// com os titulares de hoje.
import { describe, expect, it } from "vitest";
import { subQuorum } from "./AbaDecisoes.tsx";

describe("o sub do quórum nas Regras", () => {
  it("maioria, todos e um número mínimo", () => {
    expect(subQuorum("MAIORIA", 4, null)).toBe("Com 4 titulares, 3 votos aprovam");
    expect(subQuorum("TODOS", 4, null)).toBe("Com 4 titulares, 4 votos aprovam");
    expect(subQuorum("MINIMO", 4, 2)).toBe("Com 4 titulares, 2 votos aprovam");
    expect(subQuorum("MINIMO", 1, 1)).toBe("Com 1 titular, 1 voto aprova");
    expect(subQuorum("MINIMO", 4, null)).toBe("Escolha de 1 até o número de titulares");
  });
  it("mínimo maior que os titulares não tem quórum possível", () => {
    expect(subQuorum("MINIMO", 2, 3)).toBe("Com 2 titulares, sem quórum possível");
  });
});

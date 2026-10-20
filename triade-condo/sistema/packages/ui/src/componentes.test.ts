// Mapas de estilo dos componentes base (DC13): a classe certa para cada variante e tamanho do
// botão, e todos os ícones do sistema de design disponíveis pelo nome.
import { describe, expect, it } from "vitest";
import { classeBotao } from "./componentes.tsx";
import { NOMES_ICONES } from "./Icone.tsx";

describe("classeBotao", () => {
  it("o padrão é o principal grande", () => {
    expect(classeBotao()).toBe("bt bt-primario");
  });

  it("junta variante, tamanho, só ícone e classes extras", () => {
    expect(classeBotao("secundario", "w-full", "m")).toBe("bt bt-secundario bt-m w-full");
    expect(classeBotao("discreto", "", "p", true)).toBe("bt bt-discreto bt-p bt-so");
  });
});

describe("ícones", () => {
  it("os ícones do sistema de design estão todos lá, sem nome repetido", () => {
    // 52 do sistema de design, o megafone dos comunicados (peça R1) e o convívio da Vida em condomínio (R12).
    expect(NOMES_ICONES.length).toBe(55);
    expect(new Set(NOMES_ICONES).size).toBe(NOMES_ICONES.length);
    for (const n of ["casa", "pedido", "retorno", "alerta", "check", "fechar", "whats", "megafone"]) expect(NOMES_ICONES).toContain(n);
  });
});

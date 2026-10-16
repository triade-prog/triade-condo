import { describe, expect, it } from "vitest";
import { dinheiro, formatar, lerReais, multiplicar, repartir, somar, subtrair } from "./dinheiro.ts";

describe("PT-09: valores em dinheiro exatos", () => {
  it("guarda centavos inteiros com a moeda", () => {
    expect(dinheiro(11999)).toEqual({ centavos: 11999, moeda: "BRL" });
  });

  it("recusa fração de centavo e valor fora do inteiro seguro", () => {
    expect(() => dinheiro(10.5)).toThrow("inteiro");
    expect(() => dinheiro(Number.MAX_SAFE_INTEGER + 1)).toThrow("inteiro");
  });

  it("recusa moeda que não está na lista", () => {
    // @ts-expect-error moeda fora do tipo
    expect(() => dinheiro(100, "USD")).toThrow("Moeda");
  });

  it("soma sem erro de ponto flutuante (0,10 + 0,20 = 0,30)", () => {
    expect(somar(dinheiro(10), dinheiro(20)).centavos).toBe(30);
    expect(subtrair(dinheiro(30), dinheiro(10)).centavos).toBe(20);
    expect(multiplicar(dinheiro(333), 3).centavos).toBe(999);
  });

  it("não mistura moedas", () => {
    const outra = { centavos: 100, moeda: "USD" } as never;
    expect(() => somar(dinheiro(100), outra)).toThrow("Moedas diferentes");
  });

  it("reparte sem perder nem criar centavo", () => {
    const partes = repartir(dinheiro(1000), 3);
    expect(partes.map((p) => p.centavos)).toEqual([334, 333, 333]);
    expect(partes.reduce((t, p) => t + p.centavos, 0)).toBe(1000);
    expect(repartir(dinheiro(-1000), 3).map((p) => p.centavos)).toEqual([-334, -333, -333]);
  });

  it("formata em reais", () => {
    expect(formatar(dinheiro(11999))).toBe("R$ 119,99");
    expect(formatar(dinheiro(123456789))).toBe("R$ 1.234.567,89");
  });

  it("lê o que a pessoa digitou sem arredondar escondido", () => {
    expect(lerReais("1.234,56").centavos).toBe(123456);
    expect(lerReais("R$ 10").centavos).toBe(1000);
    expect(lerReais("0,1").centavos).toBe(10);
    expect(lerReais("-3,5").centavos).toBe(-350);
    expect(() => lerReais("1,999")).toThrow();
    expect(() => lerReais("12.34")).toThrow();
    expect(() => lerReais("abc")).toThrow();
  });
});

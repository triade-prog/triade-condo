// O custo por apartamento no Início e em Preços (DC17): os números vêm da conta da calculadora e a
// frase "menos de R$ 5" só vale onde a conta dá menos de R$ 5 (EM-07).
import { describe, expect, it } from "vitest";
import { faixas } from "../dados/oferta";
import { precoDoSite } from "./calculadora";
import {
  centavosPorApartamento,
  exemploDoPredio,
  limitesDasFaixas,
  porApartamentoNoTopo,
  trechosMenosDeCinco,
} from "./por-apartamento";

describe("custo por apartamento nas páginas de venda (DC17)", () => {
  it("as faixas são as da calculadora: 1 a 40, 41 a 100, 101 a 200 e 201 a 400", () => {
    expect(limitesDasFaixas()).toEqual([{ de: 1, ate: 40 }, { de: 41, ate: 100 }, { de: 101, ate: 200 }, { de: 201, ate: 400 }]);
  });

  it("a conta é a mesma da calculadora em todas as unidades da tabela", () => {
    limitesDasFaixas().forEach((l, i) => {
      for (let u = l.de; u <= l.ate; u++) expect(centavosPorApartamento(faixas[i]!.mensal, u), `${u} unidades`).toBe(precoDoSite(u).porApartamento);
    });
  });

  it("o valor por apartamento no topo de cada faixa, no mensal, no anual e no fundador", () => {
    expect(porApartamentoNoTopo().map((p) => `${p.texto} com ${p.unidades}`)).toEqual(["R$ 4,98 com 40", "R$ 3,49 com 100", "R$ 2,75 com 200", "R$ 2,12 com 400"]);
    expect(porApartamentoNoTopo("anual").map((p) => p.texto)).toEqual(["R$ 4,55", "R$ 3,20", "R$ 2,52", "R$ 1,95"]);
    expect(porApartamentoNoTopo("fundador").map((p) => p.texto)).toEqual(["R$ 3,23", "R$ 2,29", "R$ 1,75", "R$ 1,37"]);
  });

  it("o exemplo da DC17: 100 unidades, R$ 3,49 por apartamento, cerca de 0,5% de uma taxa de R$ 650", () => {
    expect(exemploDoPredio()).toEqual({ unidades: 100, porApartamento: "R$ 3,49", taxa: "R$ 650", percentual: "0,5%" });
  });

  it("menos de R$ 5 na tabela cheia só com 40, de 70 a 100 e de 110 a 400 unidades", () => {
    expect(trechosMenosDeCinco()).toEqual([{ de: 40, ate: 40 }, { de: 70, ate: 100 }, { de: 110, ate: 400 }]);
  });

  it("no preço de fundador, menos de R$ 5 de 26 a 40 e de 46 a 400 unidades", () => {
    expect(trechosMenosDeCinco("fundador")).toEqual([{ de: 26, ate: 40 }, { de: 46, ate: 400 }]);
  });
});

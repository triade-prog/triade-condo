import { describe, expect, it } from "vitest";
import {
  atendimentoSchema,
  dataValida,
  feriadoSchema,
  feriadosNacionais,
  horariosSchema,
  intervalosSobrepostos,
  mostrarDataSemHora,
} from "./plataforma.ts";

describe("contratos da Plataforma (passo 2)", () => {
  it("CF-10: vários intervalos por dia, sem sobreposição; 24:00 vale", () => {
    const ok = [
      { dia: 1, inicio: "08:00", fim: "12:00" },
      { dia: 1, inicio: "12:00", fim: "18:00" },
      { dia: 6, inicio: "22:00", fim: "24:00" },
    ];
    expect(intervalosSobrepostos(ok)).toBe(false);
    expect(horariosSchema.safeParse({ versao: 1, intervalos: ok }).success).toBe(true);
    expect(intervalosSobrepostos([{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "11:00", fim: "13:00" }])).toBe(true);
    expect(horariosSchema.safeParse({ versao: 1, intervalos: [{ dia: 2, inicio: "18:00", fim: "08:00" }] }).success).toBe(false);
  });

  it("CF-10: data sem hora é conferida no calendário e mostrada como foi escrita", () => {
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("2026-02-29")).toBe(false);
    expect(feriadoSchema.safeParse({ data: "20/11/2026", descricao: "Consciência Negra" }).success).toBe(false);
    expect(mostrarDataSemHora("2026-11-20")).toBe("20/11/2026");
  });

  it("feriados nacionais com as datas móveis da Páscoa", () => {
    const f2026 = feriadosNacionais(2026);
    expect(f2026.find((f) => f.descricao === "Sexta-feira Santa")?.data).toBe("2026-04-03");
    expect(f2026.find((f) => f.descricao === "Corpus Christi")?.data).toBe("2026-06-04");
    expect(f2026.filter((f) => f.descricao === "Carnaval").map((f) => f.data)).toEqual(["2026-02-16", "2026-02-17"]);
    expect(f2026.every((f) => dataValida(f.data))).toBe(true);
  });

  it("CF-05: responsável repetido não passa", () => {
    const v = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
    expect(atendimentoSchema.safeParse({ versao: 1, padraoId: v, responsaveis: [{ vinculoId: v, disponivel: true }, { vinculoId: v, disponivel: false }] }).success)
      .toBe(false);
  });
});

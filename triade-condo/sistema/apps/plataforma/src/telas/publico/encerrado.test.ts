// O contrato encerrado nas páginas públicas (R17.7c, 0318; quadro 489): a recusa vira a página
// "Este condomínio não usa mais a TRÍADE", com o nome e o dia.
import { describe, expect, it } from "vitest";
import { encerramentoDe, subtituloEncerrado, textoForaDoAr } from "./encerrado.ts";

describe("a página de fora do ar (quadro 489)", () => {
  it("lê o motivo no detalhe do erro ou direto na resposta", () => {
    expect(encerramentoDe({ codigo: "VALIDATION_ERROR", detalhes: { motivo: "CONTRATO_ENCERRADO", condominio: " Edifício Ipiranga ", desde: "2026-11-24" } }))
      .toEqual({ condominio: "Edifício Ipiranga", desde: "2026-11-24" });
    expect(encerramentoDe({ encerrado: true, motivo: "CONTRATO_ENCERRADO", condominio: "Edifício Ipiranga" })).toEqual({ condominio: "Edifício Ipiranga", desde: undefined });
    expect(encerramentoDe({ codigo: "NOT_FOUND" })).toBeNull();
    expect(encerramentoDe({ codigo: "VALIDATION_ERROR", detalhes: { motivo: "VENCIDO" } })).toBeNull();
    expect(encerramentoDe({ encerrado: true, motivo: "CONCLUIDO" })).toBeNull();
    expect(encerramentoDe(null)).toBeNull();
    expect(encerramentoDe({ codigo: "X", detalhes: { motivo: "CONTRATO_ENCERRADO", desde: "24/11/2026" } })).toEqual({ condominio: "", desde: undefined });
  });

  it("o nome e o dia, e sem eles a frase continua certa", () => {
    const e = { condominio: "Edifício Ipiranga", desde: "2026-11-24" };
    expect(textoForaDoAr(e)).toBe("O mural e os links do Edifício Ipiranga saíram do ar em 24/11/2026.");
    expect(textoForaDoAr({ condominio: "" })).toBe("O mural e os links do condomínio saíram do ar.");
    expect(subtituloEncerrado("Mural", e)).toBe("Mural do Edifício Ipiranga");
    expect(subtituloEncerrado("Serviço", e, "no")).toBe("Serviço no Edifício Ipiranga");
    expect(subtituloEncerrado("Enquete", { condominio: "" })).toBe("Enquete");
  });
});

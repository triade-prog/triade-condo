import { describe, expect, it } from "vitest";
import { haQuanto, MOTIVOS_FORA_DO_MURAL, precoDoAnuncio, textoConferido } from "./mural.ts";

describe("mural visto do painel (CD-15)", () => {
  it("diz por que um publicado não está no link", () => {
    expect(Object.keys(MOTIVOS_FORA_DO_MURAL)).toEqual(["SO_PARA_ALGUNS", "ASSUNTO_FORA", "TIRADO"]);
  });

  it("a vitrine mostra o valor, Grátis na doação ou o tipo", () => {
    expect(precoDoAnuncio({ tipo: "VENDO", valorCentavos: 90000 })).toBe("R$ 900,00");
    expect(precoDoAnuncio({ tipo: "DOO" })).toBe("Grátis");
    expect(precoDoAnuncio({ tipo: "SERVICO" })).toBe("Serviço de morador");
    expect(precoDoAnuncio({ tipo: "PROCURO", valorCentavos: null })).toBe("Procuro");
  });

  it("conta há quanto tempo em dias de Brasília", () => {
    const agora = new Date("2026-10-22T02:30:00Z"); // 23:30 de 21/10 em Brasília
    expect(haQuanto("2026-10-21T13:00:00Z", agora)).toBe("hoje");
    expect(haQuanto("2026-10-20T20:00:00Z", agora)).toBe("ontem");
    expect(haQuanto("2026-10-18T12:00:00Z", agora)).toBe("há 3 dias");
    expect(haQuanto("2026-10-13T12:00:00Z", agora)).toBe("há 1 semana");
    expect(haQuanto("2026-10-01T12:00:00Z", agora)).toBe("há 2 semanas");
    expect(haQuanto("2026-09-15T12:00:00Z", agora)).toBe("há 1 mês");
    expect(haQuanto("2026-11-01T12:00:00Z", agora)).toBe("hoje");
  });

  it("diz quando a prévia conferiu", () => {
    expect(textoConferido(1000, 3000)).toBe("Conferido agora");
    expect(textoConferido(1000, 13000)).toBe("Conferido há 12 s");
    expect(textoConferido(0, 200_000)).toBe("Conferido há 3 min");
  });
});

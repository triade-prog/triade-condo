import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { faixas, mensalNoAnual, opcoesUnidades, reais } from "./oferta";

describe("oferta do site", () => {
  it("o anual à vista é 12 meses pelo preço de 11", () => {
    expect(faixas.map((f) => reais(mensalNoAnual(f.mensal)))).toEqual(["R$ 182", "R$ 320", "R$ 503", "R$ 778"]);
  });

  it("as faixas sobem juntas: preço, implantação e franquia", () => {
    for (let i = 1; i < faixas.length; i++) {
      expect(faixas[i].mensal).toBeGreaterThan(faixas[i - 1].mensal);
      expect(faixas[i].implantacao).toBeGreaterThan(faixas[i - 1].implantacao);
      expect(faixas[i].franquiaComunicados).toBeGreaterThan(faixas[i - 1].franquiaComunicados);
    }
    expect(opcoesUnidades.at(-1)).toBe("Mais de 400 ou vários prédios");
  });
});

describe("identidade do site (DC13)", () => {
  const site = readFileSync(new URL("../styles/site.css", import.meta.url), "utf8");
  const tema = readFileSync(new URL("../../../../packages/ui/src/tema.css", import.meta.url), "utf8");

  it("usa as mesmas cores da Plataforma", () => {
    for (const [nomeSite, nomeTema] of [["violeta-600", "violeta-600"], ["violeta-900", "violeta-900"], ["laranja-500", "laranja-500"], ["tinta", "tinta"], ["tinta-suave", "tinta-suave"], ["linha", "linha"], ["ok", "ok"], ["erro", "erro"], ["atencao", "atencao"], ["foco", "foco"], ["contorno", "contorno"]]) {
      const noSite = site.match(new RegExp(`--${nomeSite}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      const noTema = tema.match(new RegExp(`--color-${nomeTema}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      expect(noSite, nomeSite).toBeTruthy();
      expect(noSite?.toLowerCase(), nomeSite).toBe(noTema?.toLowerCase());
    }
  });

  it("só Manrope e IBM Plex Mono; a Playfair saiu dos títulos", () => {
    expect(site).toContain("@fontsource-variable/manrope");
    expect(site).toContain("@fontsource/ibm-plex-mono");
    const semComentarios = site.replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    expect(semComentarios).not.toContain("playfair");
  });
});

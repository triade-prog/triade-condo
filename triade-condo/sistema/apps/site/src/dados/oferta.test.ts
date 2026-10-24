import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { faixas, mensalNoAnual, opcoesUnidades, reais } from "./oferta";

describe("oferta do site", () => {
  it("o anual à vista é 12 meses pelo preço de 11", () => {
    expect(faixas.map((f) => reais(mensalNoAnual(f.mensal)))).toEqual(["R$ 182", "R$ 320", "R$ 503", "R$ 778"]);
  });

  it("os valores são os decididos em 24/10 (DC16): tabela cheia, implantação e fundador", () => {
    expect(faixas.map((f) => f.mensal)).toEqual([199, 349, 549, 849]);
    expect(faixas.map((f) => f.implantacao)).toEqual([600, 900, 1400, 2000]);
    expect(faixas.map((f) => f.fundador)).toEqual([129, 229, 349, 549]);
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

  it("Manrope e IBM Plex Mono; a Playfair só no destaque em itálico (em.d)", () => {
    expect(site).toContain("@fontsource-variable/manrope");
    expect(site).toContain("@fontsource/ibm-plex-mono");
    // Só os arquivos itálicos da Playfair entram, e ela só é usada por var(--serifa) nas páginas.
    const importsPlayfair = site.match(/@import "@fontsource\/playfair-display\/[^"]+";/g) ?? [];
    expect(importsPlayfair.length).toBeGreaterThan(0);
    for (const i of importsPlayfair) expect(i).toMatch(/italic\.css/);
    const paginas = readFileSync(new URL("../styles/paginas.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(paginas.match(/font-family:[^;]*/g)?.filter((f) => !/var\(--(sans|mono|serifa)\)/.test(f)) ?? []).toEqual([]);
  });
});

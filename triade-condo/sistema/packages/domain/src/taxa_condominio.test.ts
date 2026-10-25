/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  custoNaTaxa,
  fraseDoDestaque,
  lerTaxaCondominio,
  linhaNaTaxa,
  menosDeCincoReais,
  percentualTexto,
  pesoNaTaxa,
  resumoPorApartamento,
  taxaCondominioSchema,
  taxaParaCampo,
  TEXTO_AJUDA_TAXA,
  TEXTO_AJUDA_TAXA_FICHA,
  TEXTO_MENOS_DE_CINCO,
  textoCustoComparativo,
} from "./taxa_condominio.ts";
import { custoPorApartamento, dadosVersaoSchema, taxaKitSchema } from "./propostas.ts";
import { entradaSiteSchema, fichaInteressadoSchema } from "./comercial.ts";

const SQL = readFileSync(new URL("../../../supabase/migrations/0310_comercial_parceiros_agenda.sql", import.meta.url), "utf8");

describe("custo perto da taxa de condomínio (DC17)", () => {
  it("o peso na taxa com 1 casa, arredondado, como os quadros 445 a 448", () => {
    expect(pesoNaTaxa(358, 650)).toBe(0.6);
    expect(pesoNaTaxa(286, 650)).toBe(0.4);
    // O exemplo do pedido: R$ 3,49 numa taxa de R$ 650 é cerca de 0,5%.
    expect(pesoNaTaxa(349, 650)).toBe(0.5);
    expect(pesoNaTaxa(645, 320.5)).toBe(2);
    expect(pesoNaTaxa(358, null)).toBeNull();
    expect(pesoNaTaxa(358, 0)).toBeNull();
    expect(pesoNaTaxa(358, 20000.01)).toBeNull();
    expect(pesoNaTaxa(0, 650)).toBeNull();
    expect(percentualTexto(0.6)).toBe("0,6%");
    expect(percentualTexto(12)).toBe("12,0%");
    expect(percentualTexto(pesoNaTaxa(1, 20000)!)).toBe("menos de 0,1%");
  });

  it("o destaque só quando o valor por apartamento é menor que R$ 5,00 (nunca acima)", () => {
    expect(menosDeCincoReais(358)).toBe(true);
    expect(menosDeCincoReais(499)).toBe(true);
    expect(menosDeCincoReais(500)).toBe(false);
    expect(menosDeCincoReais(645)).toBe(false);
    expect(menosDeCincoReais(null)).toBe(false);
    expect(TEXTO_MENOS_DE_CINCO).toBe("Menos de R$ 5 por apartamento por mês");
    // Pela Tabela de preços (DC16), os 4 valores de fundador no meio das faixas.
    expect(menosDeCincoReais(custoPorApartamento(22900, 64))).toBe(true);
    expect(menosDeCincoReais(custoPorApartamento(12900, 20))).toBe(false);
    expect(menosDeCincoReais(custoPorApartamento(12900, 40))).toBe(true);
  });

  it("os textos dos quadros com e sem a taxa", () => {
    const com = custoNaTaxa(286, 650);
    expect(resumoPorApartamento(com, 72)).toBe("R$ 2,86 por mês com 72 unidades, cerca de 0,4% da taxa média de R$ 650,00");
    expect(linhaNaTaxa(com)).toBe("cerca de 0,4% de R$ 650,00");
    expect(fraseDoDestaque(com, "que o prédio informou")).toBe("R$ 2,86 por apartamento, cerca de 0,4% da taxa média de R$ 650,00 que o prédio informou.");
    const kit = custoNaTaxa(358, 650);
    expect(fraseDoDestaque(kit, "do Edifício Aroeira")).toBe("R$ 3,58 por apartamento, cerca de 0,6% da taxa média de R$ 650,00 do Edifício Aroeira.");
    expect(fraseDoDestaque(kit)).toBe("R$ 3,58 por apartamento, cerca de 0,6% da taxa de R$ 650,00.");
    expect(textoCustoComparativo(kit, "R$ 3,58 por apartamento por mês (estimativa)")).toBe("R$ 3,58 (estimativa), cerca de 0,6% da taxa");
    const sem = custoNaTaxa(645, null);
    expect(sem).toMatchObject({ menosDeCinco: false, percentual: null, cerca: null, taxa: null });
    expect(resumoPorApartamento(sem, 20)).toBe("R$ 6,45 por mês com 20 unidades");
    expect(linhaNaTaxa(sem)).toBeNull();
    expect(fraseDoDestaque(sem)).toBe("R$ 6,45 por apartamento por mês.");
    expect(textoCustoComparativo(sem, "do banco")).toBe("do banco");
    expect(TEXTO_AJUDA_TAXA_FICHA).toBe(`${TEXTO_AJUDA_TAXA} Veio da ficha do interessado.`);
  });

  it("sem ROI e sem economia prometida em nenhum texto (EM-07)", () => {
    const textos = [resumoPorApartamento(custoNaTaxa(358, 650), 64), fraseDoDestaque(custoNaTaxa(358, 650)), TEXTO_AJUDA_TAXA, linhaNaTaxa(custoNaTaxa(358, 650))];
    for (const t of textos) expect(t!.toLowerCase()).not.toMatch(/economi|retorno|roi\b|paga sozinh/);
  });

  it("lê a taxa digitada e recusa fora do limite, como o banco", () => {
    expect(lerTaxaCondominio("650")).toEqual({ taxa: 650 });
    expect(lerTaxaCondominio("R$ 1.250,50")).toEqual({ taxa: 1250.5 });
    expect(lerTaxaCondominio("650.5")).toEqual({ taxa: 650.5 });
    expect(lerTaxaCondominio("  ")).toEqual({ taxa: null });
    expect(lerTaxaCondominio("0").erro).toBe("A taxa vai de R$ 0,01 a R$ 20.000");
    expect(lerTaxaCondominio("20.000,01").erro).toBe("A taxa vai de R$ 0,01 a R$ 20.000");
    expect(lerTaxaCondominio("20.000,00")).toEqual({ taxa: 20000 });
    expect(lerTaxaCondominio("650,123").erro).toBeDefined();
    expect(lerTaxaCondominio("muito").erro).toBeDefined();
    expect(taxaParaCampo(650)).toBe("650,00");
    expect(taxaParaCampo(null)).toBe("");
    expect(taxaCondominioSchema.safeParse(650.12).success).toBe(true);
    expect(taxaCondominioSchema.safeParse(650.123).success).toBe(false);
    expect(taxaCondominioSchema.safeParse(0).success).toBe(false);
    expect(taxaCondominioSchema.safeParse(20000.01).success).toBe(false);
    expect(SQL).toContain("taxa_condominio_media numeric(10, 2) check (taxa_condominio_media > 0 and taxa_condominio_media <= 20000)");
  });

  it("a taxa no pedido do site, na ficha, na versão e no kit", () => {
    const site = { nome: "Paulo Dias", whatsapp: "5561999990401", condominio: "Edifício Aroeira", consentimento: true as const };
    expect(entradaSiteSchema.parse(site)).toMatchObject({ pedido: "DEMONSTRACAO", unidades: null, taxaCondominio: null });
    expect(entradaSiteSchema.parse({ ...site, pedido: "PROPOSTA", unidades: 64, taxaCondominio: 650 })).toMatchObject({ unidades: 64, taxaCondominio: 650 });
    expect(entradaSiteSchema.safeParse({ ...site, taxaCondominio: 0 }).success).toBe(false);
    const ficha = { versao: 1, condominio: "Edifício Aroeira", whatsapp: "61999990401" };
    expect(fichaInteressadoSchema.parse(ficha)).not.toHaveProperty("taxaCondominioMedia");
    expect(fichaInteressadoSchema.parse({ ...ficha, taxaCondominioMedia: null }).taxaCondominioMedia).toBeNull();
    expect(fichaInteressadoSchema.safeParse({ ...ficha, taxaCondominioMedia: 20001 }).success).toBe(false);
    expect(dadosVersaoSchema.parse({})).not.toHaveProperty("taxaCondominio");
    expect(dadosVersaoSchema.parse({ taxaCondominio: 650 }).taxaCondominio).toBe(650);
    expect(dadosVersaoSchema.parse({ taxaCondominio: null }).taxaCondominio).toBeNull();
    expect(taxaKitSchema.safeParse({ versao: 3, taxaCondominio: -1 }).success).toBe(false);
    expect(taxaKitSchema.parse({ versao: 3, taxaCondominio: null }).taxaCondominio).toBeNull();
  });
});

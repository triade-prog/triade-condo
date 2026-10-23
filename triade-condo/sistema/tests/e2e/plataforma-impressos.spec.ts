// Impressos no padrão novo (decisão D.1 da análise das páginas por link, 23/10/2026): o mesmo topo
// de prévia, com Voltar e Imprimir, e a folha A4 que cabe no celular. O cartaz não quebra o
// endereço no meio do código, e o cartaz do WhatsApp desligado manda para Configurações ›
// Comunicados em vez de imprimir (CD-12, W-20, AT-30).

import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { MURAL_FALSO } from "./api-falsa-comunicados";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  // A folha encolhe para caber: nada passa da largura da tela.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("Plataforma · impressos", () => {
  test("CD-12: o cartaz do mural tem o topo de prévia e o endereço só quebra antes do código", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/mural/cartaz`);
    await expect(page.getByRole("heading", { name: "Cartaz do mural", level: 1 })).toBeVisible();
    await expect(page.getByText("Prévia para imprimir")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/configuracoes/mural");
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
    const folha = page.getByRole("region", { name: "Cartaz do mural" });
    await expect(folha.getByRole("img", { name: "QR do mural online" })).toBeVisible();
    await expect(folha.getByText(MURAL_FALSO, { exact: true })).toHaveCSS("white-space", "nowrap");
    await conferir(page);
  });

  test("W-20: com os comunicados pelo WhatsApp desligados, o cartaz não imprime e leva às Configurações", async ({ page }) => {
    // Sem ligar, os comunicados pelo WhatsApp começam desligados.
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/mural/cartaz-whatsapp`);
    await expect(page.getByText("Os comunicados pelo WhatsApp estão desligados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para Configurações › Comunicados" })).toHaveAttribute("href", "/configuracoes/comunicados");
    await expect(page.getByRole("button", { name: "Imprimir" })).toHaveCount(0);
    await conferir(page);
  });

  test("CD-13: a folha do comunicado para o mural sai na folha A4 e volta ao comunicado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "Falta de água na quinta" }).first().click();
    const href = await page.getByRole("link", { name: "Abrir a folha" }).getAttribute("href");
    await page.goto(`${PLATAFORMA}${href}`);
    const folha = page.getByRole("region", { name: "Folha do comunicado" });
    await expect(folha.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(folha.getByText("Comunicado · Obras e manutenção")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", /^\/comunicados\/comunicado\?id=/);
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
    await conferir(page);
  });

  test("AT-30: as etiquetas cabem na tela do celular, duas por linha", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/etiquetas`);
    const folha = page.getByRole("region", { name: "Folha 1" });
    await expect(folha.getByRole("img", { name: "QR da etiqueta E01" })).toBeVisible();
    await expect(page.getByText("1 folha · como sai na impressão")).toBeVisible();
    await conferir(page);
  });
});

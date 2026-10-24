// Enquetes abertas na Agenda (R7.2; AG-09) com a API falsa: a faixa das abertas no alto da Lista,
// a enquete no dia e na hora em que fecha, no mês e no Início, e nada disso para quem não vê as
// enquetes. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { alternarOrigem, abrirFiltros, fecharFiltros } from "./agenda";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const celular = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

test.describe("Enquetes abertas na Agenda", () => {
  test("R7.2: a faixa das abertas, o dia em que fecha e o filtro Enquetes", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comDatasDeFora: true });
    await page.goto(`${PLATAFORMA}/agenda`);
    const faixa = page.getByRole("region", { name: "Enquetes abertas agora" });
    await expect(faixa.getByText("3 abertas")).toBeVisible();
    await expect(faixa.getByRole("link", { name: "Qual horário para a academia aos domingos?" })).toHaveAttribute("href", /\/vida\/enquete\?id=/);
    await expect(faixa.getByText("3 de 5 unidades")).toBeVisible();
    await expect(faixa.getByText("Secreta", { exact: true })).toBeVisible();
    await expect(faixa.getByText("Fecha em 47 dias")).toBeVisible();
    await expect(faixa.getByRole("link", { name: /Vida em condomínio › Enquetes/ })).toHaveAttribute("href", /\/vida\?aba=enquetes$/);

    // No dia e na hora em que fecha; a que fecha depois do período fica só na faixa.
    const lista = page.locator(".ag-lista");
    await expect(lista.getByRole("link", { name: "Fecha a enquete: Qual horário para a academia aos domingos?" })).toHaveAttribute("href", /\/vida\/enquete\?id=/);
    await expect(lista.getByText("Enquete · 3 de 5 unidades responderam · secreta")).toBeVisible();
    await expect(lista.getByText("Fecha em 5 dias")).toBeVisible();
    await expect(lista.getByText("22:30")).toBeVisible();
    await expect(lista.getByText("Fecha hoje")).toBeVisible();
    await expect(lista.getByText(/Que cor para a pintura da fachada/)).toHaveCount(0);
    await conferir(page);

    // Desligar Enquetes esconde a faixa e as linhas, e fica guardado.
    await alternarOrigem(page, "Enquetes");
    await expect(faixa).toHaveCount(0);
    await expect(page.getByText(/Fecha a enquete/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Enquetes abertas agora" })).toHaveCount(0);
    await alternarOrigem(page, "Enquetes");
    await expect(page.getByRole("region", { name: "Enquetes abertas agora" })).toBeVisible();

    // No mês, só no dia em que fecha, e sem a faixa.
    await page.getByRole("group", { name: "Como ver a agenda" }).getByRole("button", { name: "Mês" }).click();
    await expect(page.getByText("22h Fecha: Qual horário para a academia aos domingos?")).toBeVisible();
    await expect(page.getByRole("region", { name: "Enquetes abertas agora" })).toHaveCount(0);
    await conferir(page);
  });

  test("R7.2: no Início, a enquete que fecha hoje e quantas estão abertas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comDatasDeFora: true });
    await page.goto(PLATAFORMA);
    const cartao = page.getByRole("region", { name: "Hoje na agenda" });
    await expect(cartao.getByRole("link", { name: "Fecha a enquete: Troca do portão: qual horário de obra?" })).toBeVisible();
    await expect(cartao.getByText("Fecha hoje")).toBeVisible();
    await expect(cartao).toContainText("Enquetes abertas: 3.");
    await expect(cartao).not.toContainText("academia");
    await conferir(page);
  });

  test("R7.2: quem não vê as enquetes não vê nada delas, nem o filtro", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE", comDatasDeFora: true });
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByRole("link", { name: "Vence AVCB" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Enquetes abertas agora" })).toHaveCount(0);
    await expect(page.getByText(/enquete/i)).toHaveCount(0);
    const onde = celular(page) ? await abrirFiltros(page) : page;
    await expect(onde.getByRole("group", { name: "O que mostrar na agenda" }).getByRole("button", { name: "Assembleias" })).toBeVisible();
    await expect(onde.getByRole("group", { name: "O que mostrar na agenda" }).getByRole("button", { name: "Enquetes" })).toHaveCount(0);
    if (celular(page)) await fecharFiltros(page);
  });
});

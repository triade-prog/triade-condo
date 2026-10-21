// Datas de outras telas na Agenda, dois indicadores novos e unidades à venda ou para alugar
// (AG-09, TR-01, MU-11) com a API falsa. Cada tela passa no axe (WCAG 2.2 AA) no celular e no
// computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { alternarOrigem, origemLigada } from "./agenda";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A101 } from "./api-falsa-moradores";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Agenda, indicadores e unidades", () => {
  test("AG-09: contrato, documentos e assembleia na Agenda, com a tela de origem e o filtro guardado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comDatasDeFora: true });
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByRole("link", { name: "Vence o contrato de Elevadores Atlas" })).toHaveAttribute("href", /\/manutencao\/prestador\?id=/);
    await expect(page.getByText("Vence em 2 dias")).toBeVisible();
    await expect(page.getByRole("link", { name: "Vence AVCB" })).toHaveAttribute("href", /\/comunicados\/documento\?id=/);
    await expect(page.getByRole("link", { name: "Vence Apólice do seguro" })).toBeVisible();
    await expect(page.getByText("Restrito", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Assembleia geral ordinária" })).toHaveAttribute("href", /\/vida\/assembleia\?id=/);
    await expect(page.getByText("2ª 19:30")).toBeVisible();
    await expect(page.getByText("Convocada", { exact: true })).toBeVisible();
    await conferir(page);

    await expect(page.getByRole("link", { name: "Vem de Prestadores" })).toHaveAttribute("href", /\/manutencao\/prestadores$/);
    await alternarOrigem(page, "Documentos");
    await expect(page.getByRole("link", { name: "Vence AVCB" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Vence o contrato de Elevadores Atlas" })).toBeVisible();
    await alternarOrigem(page, "Compromissos");
    await expect(page.getByText("Encanador no apto 101")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("link", { name: "Vence o contrato de Elevadores Atlas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vence AVCB" })).toHaveCount(0);
    await expect(page.getByText("Encanador no apto 101")).toHaveCount(0);
    await origemLigada(page, "Documentos", false);

    await page.getByRole("group", { name: "Como ver a agenda" }).getByRole("button", { name: "Mês" }).click();
    await expect(page.getByText("Vence o contrato de Elevadores Atlas")).toBeVisible();
    await expect(page.getByText("19h Assembleia geral ordinária")).toBeVisible();
    await conferir(page);
  });

  test("AG-09: cada data só para quem vê a tela de origem; o restrito só para quem vê os restritos", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE", comDatasDeFora: true });
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByRole("link", { name: "Vence AVCB" })).toBeVisible();
    await expect(page.getByText("Apólice do seguro")).toHaveCount(0);
    await expect(page.getByText(/Elevadores Atlas/)).toHaveCount(0);
    await expect(page.getByText("Assembleia geral ordinária")).toHaveCount(0);
  });

  test("TR-01: pendências por responsável agora e tempo de solução por categoria no período", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/indicadores`);
    const pend = page.getByRole("region", { name: "Pendências por responsável" });
    await expect(pend.getByRole("row", { name: "Ana Souza 2 1 12 dias" })).toBeVisible();
    await expect(pend.getByRole("row", { name: "Sem responsável 1 1 1 dia" })).toBeVisible();
    await expect(pend).toContainText("Agora, não no período");
    const sol = page.getByRole("region", { name: "Tempo de solução por categoria" });
    await expect(sol.getByRole("row", { name: "Manutenção 3 2 dias e 4 h 6 dias" })).toBeVisible();
    await expect(sol.getByRole("row", { name: "Limpeza 0 Sem dados" })).toBeVisible();
    await expect(sol).toContainText("Tempo típico é a mediana");
    await conferir(page);
    await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "Mês passado" }).click();
    await expect(sol.getByRole("row", { name: "Limpeza 9 5 h 1 dia e 2 h" })).toBeVisible();
    await expect(pend.getByRole("row", { name: "Ana Souza 2 1 12 dias" })).toBeVisible();
  });

  test("MU-11: marcar a unidade à venda e para alugar, com contador e filtro na lista", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    const situacao = page.getByRole("region", { name: "Situação da unidade" });
    await expect(situacao).toContainText("nunca no mural nem para os moradores");
    await situacao.getByLabel("À venda").click();
    await expect(page.getByText("Torre A · 101 marcada à venda.")).toBeVisible();
    await expect(situacao.getByText(/^desde \d\d\/\d\d\/\d{4}$/)).toBeVisible();
    await situacao.getByLabel("Para alugar").click();
    await expect(page.getByText("Torre A · 101 marcada à venda e para alugar.")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/moradores`);
    const ocupacao = page.getByRole("group", { name: "Ocupação" });
    await ocupacao.getByRole("button", { name: "1 à venda" }).click();
    await expect(page.getByRole("link", { name: "Torre A · 101" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Torre A · 102" })).toHaveCount(0);
    await expect(page.getByText("À venda", { exact: true })).toBeVisible();
    await expect(page.getByText("Para alugar", { exact: true })).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await page.getByRole("region", { name: "Situação da unidade" }).getByLabel("À venda").click();
    await expect(page.getByText("Torre A · 101 marcada para alugar.")).toBeVisible();
  });

  test("MU-11: quem só vê não marca", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("À venda")).toHaveCount(0);
  });
});

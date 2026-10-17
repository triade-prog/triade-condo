// Passo 3b (F3.6): vínculo detalhado na Plataforma do síndico, com a API falsa. As três
// marcações, a ligação, o parentesco, o período de ocupação e a ocupação da unidade (MU-10,
// MU-11). Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A102 } from "./api-falsa-moradores";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma do síndico · passo 3b", () => {
  test("MU-11: a lista mostra a ocupação e os contadores filtram", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    const ocupacao = page.getByRole("group", { name: "Ocupação" });
    await expect(ocupacao.getByRole("button", { name: "2 com morador" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Torre A · 101/ })).toContainText("O proprietário mora");
    await conferir(page);
    await ocupacao.getByRole("button", { name: "1 alugada" }).click();
    expect(await page.getByRole("table").locator("tbody tr td:first-child").allInnerTexts()).toEqual(["Torre A · 102"]);
    await expect(page.getByRole("row", { name: /Torre A · 102/ })).toContainText("Joana Lima");
    await expect(page.getByRole("row", { name: /Torre A · 102/ })).toContainText("Alugada");
    await ocupacao.getByRole("button", { name: "1 alugada" }).click();
    await expect(page.getByRole("row", { name: /Torre A · 101/ })).toBeVisible();
  });

  test("MU-10: a ficha mostra as marcações e o período; trocar o responsável avisa quem perde", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await expect(page.getByText("Alugada · 2 moram aqui")).toBeVisible();
    const joana = page.getByRole("row", { name: /Joana Lima/ });
    await expect(joana).toContainText("Responsável · Mora aqui");
    await expect(joana).toContainText("inquilino · desde 01/03/2025");
    await conferir(page);

    await page.getByRole("button", { name: "Editar Paulo Lima" }).click();
    const janela = page.getByRole("dialog", { name: "Editar Paulo Lima" });
    await expect(janela.getByLabel("Ligação com a unidade")).toHaveValue("FAMILIAR");
    await janela.getByLabel("Parentesco com Joana Lima (responsável)").selectOption({ label: "Cônjuge ou companheiro(a)" });
    await janela.getByRole("checkbox", { name: "Responsável pela unidade" }).check();
    await expect(janela.getByRole("status").filter({ hasText: "Joana Lima deixa de ser o responsável pela unidade e continua como morador." })).toBeVisible();
    await janela.getByLabel("Ocupa desde").fill("2025-03-01");
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Paulo Lima atualizado." })).toBeVisible();
    await expect(page.getByRole("row", { name: /Paulo Lima/ })).toContainText("Responsável · Mora aqui");
    await expect(page.getByRole("row", { name: /Joana Lima/ })).not.toContainText("Responsável");
  });

  test("MU-07: a saída não fica antes da entrada; quem saiu fica com o período inteiro", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await page.getByRole("button", { name: "Encerrar o vínculo de Joana Lima" }).click();
    const janela = page.getByRole("dialog", { name: "Encerrar o vínculo de Joana Lima" });
    await janela.getByLabel("Motivo").selectOption({ label: "A pedido do contato" });
    await janela.getByLabel("Ocupou até").fill("2025-01-10");
    await janela.getByRole("button", { name: "Encerrar vínculo" }).click();
    await expect(janela.getByText("A saída não pode ser antes da entrada. Confira a data.")).toBeVisible();
    await conferir(page);
    await janela.getByLabel("Ocupou até").fill("2026-09-30");
    await janela.getByRole("button", { name: "Encerrar vínculo" }).click();
    const anteriores = page.getByRole("region", { name: "Anteriores" });
    await expect(anteriores).toContainText("ocupou de 01/03/2025 a 30/09/2026 · a pedido do contato");
  });

  test("MU-01 e MU-10: o proprietário que não mora entra no contador e na ficha", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await page.getByRole("button", { name: "Incluir proprietário" }).click();
    const janela = page.getByRole("dialog", { name: "Incluir proprietário · Torre A · 102" });
    await janela.getByLabel("Nome", { exact: true }).fill("Roberto Dias");
    await janela.getByLabel("Telefone (WhatsApp)").fill("(61) 97777-1212");
    await expect(janela.getByLabel("Ligação com a unidade")).toHaveCount(0);
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByText("Alugada · 2 moram aqui · o proprietário não mora")).toBeVisible();
    await expect(page.getByRole("row", { name: /Roberto Dias/ })).toContainText("não mora aqui");
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("group", { name: "Ocupação" }).getByRole("button", { name: "1 proprietário não mora" }).click();
    await expect(page.getByRole("row", { name: /Torre A · 102/ })).toContainText("Roberto Dias, proprietário, não mora");
    await conferir(page);
  });
});

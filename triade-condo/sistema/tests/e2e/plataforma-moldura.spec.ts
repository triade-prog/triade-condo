// Novo frontend, bloco 1 (DC15, docs/design/telas-modelo/moldura-*.html e estados.html; PT-10):
// o menu em quatro grupos no computador, a barra de baixo e o "Mais" no celular, o menu da conta
// e os estados sem permissão e erro. Cada tela passa no axe (WCAG 2.2 AA) nos dois aparelhos.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

async function abrirMenu(page: Page) {
  const mais = page.getByRole("button", { name: "Mais", exact: true });
  if (await mais.isVisible()) await mais.click();
  return page.getByRole("navigation", { name: "Plataforma" });
}

test.describe("Plataforma · moldura do novo frontend", () => {
  test("DC15: o Início e os quatro grupos do menu, com o item da tela aceso", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/pedidos`);
    await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
    await conferir(page);
    const menu = await abrirMenu(page);
    for (const g of ["Dia a dia", "Comunicação", "Prédio e pessoas", "Gestão"]) await expect(menu.getByRole("group", { name: g })).toBeVisible();
    await expect(menu.getByRole("group", { name: "Dia a dia" }).getByRole("link")).toHaveText([/Pedidos/, "Decisões", "Agenda", /Manutenção/]);
    await expect(menu.getByRole("link", { name: /^Pedidos/ })).toHaveAttribute("aria-current", "page");
    await conferir(page);
    await menu.getByRole("link", { name: "Documentos e memória" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Documentos" })).toBeVisible();
    await page.getByRole("navigation", { name: "Partes de documentos e memória" }).getByRole("link", { name: "Memória do prédio" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Memória do prédio" })).toBeVisible();
  });

  test("DC15: no celular, a barra de baixo com os atalhos e o Mais; no computador, a lateral", async ({ page }, info) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    const atalhos = page.getByRole("navigation", { name: "Atalhos" });
    if (info.project.name === "celular") {
      await expect(atalhos.getByRole("link")).toHaveText(["Início", /Pedidos/, "Agenda", /WhatsApp/]);
      await expect(atalhos.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
      await atalhos.getByRole("link", { name: "Agenda" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible();
      await atalhos.getByRole("button", { name: "Mais" }).click();
      const folha = page.getByRole("dialog", { name: "Menu" });
      await expect(folha.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
      await conferir(page);
      await folha.getByRole("link", { name: "Moradores e unidades" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Moradores e unidades" })).toBeVisible();
      await expect(folha).toBeHidden();
    } else {
      await expect(atalhos).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Plataforma" })).toBeVisible();
      await expect(page.getByRole("search")).toBeVisible();
    }
  });

  test("MU-04: a conta no topo, com o condomínio, trocar e sair", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await page.getByRole("button", { name: "Conta de Ana Souza, Síndico" }).click();
    await expect(page.getByText("Síndico · Residencial Ipê")).toBeVisible();
    await conferir(page);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Síndico · Residencial Ipê")).toBeHidden();
    await page.getByRole("button", { name: /^Conta de / }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("PT-10: a tela que a pessoa não pode abrir diz qual permissão falta e quem dá", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/moradores`);
    await expect(page.getByRole("heading", { level: 1, name: "Moradores e unidades" })).toBeVisible();
    await expect(page.getByText("Você não tem a permissão Cadastrar moradores.")).toBeVisible();
    await expect(page.getByText("Quem dá essa permissão é o síndico, em Pessoas e acesso.")).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/pessoas`);
    await expect(page.getByRole("heading", { level: 1, name: "Pessoas e acesso" })).toBeVisible();
    await expect(page.getByText("Esta parte é só do síndico.")).toBeVisible();
    await page.getByRole("link", { name: "Voltar ao Início" }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/`);
  });

  test("PT-10: o erro ao carregar diz o que houve, que nada se perdeu e dá saída", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.route(/\/api\/v1\/condominio\/agenda/, (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ erro: { codigo: "UPSTREAM_UNAVAILABLE" } }) }));
    await page.goto(`${PLATAFORMA}/agenda`);
    const erro = page.getByRole("alert").filter({ hasText: "Não deu para carregar" });
    await expect(erro).toBeVisible();
    await expect(erro.getByText("informe o código E-REDE")).toBeVisible();
    await expect(erro.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(erro.getByRole("link", { name: "Falar com o suporte" })).toHaveAttribute("href", "/suporte");
    await conferir(page);
  });
});

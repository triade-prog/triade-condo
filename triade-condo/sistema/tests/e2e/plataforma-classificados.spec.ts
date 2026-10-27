// Classificados (peça R12; AC-05, CD-12) com a API falsa: a aba com os filtros, publicar com o
// título e o valor sugeridos, recusar com motivo, tirar do mural, o cartão no Início e a aba
// Classificados do mural online, com o aviso de que o condomínio não vende nem garante nada.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { MURAL_FALSO } from "./api-falsa-comunicados";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Classificados", () => {
  test("AC-05: revisar e publicar com título e valor, recusar com motivo e tirar do mural", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    await abrirArea(page, "Vida em condomínio");
    await expect(page.getByText("1 anúncio a aprovar")).toBeVisible();
    await page.getByRole("link", { name: "Ver os anúncios a aprovar" }).click();
    await expect(page.getByRole("button", { name: /^Classificados/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Vendo · R$ 900,00 · Torre B · 201 · Paulo Mendes", { exact: true })).toBeVisible();
    await expect(page.getByText("Mostra o WhatsApp")).toBeVisible();
    await expect(page.getByRole("img", { name: "Foto do anúncio Vendo bicicleta aro 29" })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Revisar o anúncio Vendo bicicleta aro 29" }).click();
    const d = page.getByRole("dialog", { name: "Revisar o anúncio" });
    await expect(d.getByText("Bicicleta aro 29, pouco usada, R$ 900")).toBeVisible();
    await expect(d.getByLabel("Título no mural")).toHaveValue("Vendo bicicleta aro 29");
    await expect(d.getByLabel("Valor")).toHaveValue("900,00");
    await d.getByLabel("Valor").fill("novecentos");
    await d.getByRole("button", { name: "Publicar no mural" }).click();
    await expect(d.getByText("Escreva o valor como 900 ou 1.150,50")).toBeVisible();
    await d.getByLabel("Valor").fill("850");
    await conferir(page);
    await d.getByRole("button", { name: "Publicar no mural" }).click();
    await expect(page.getByText(/^Anúncio publicado no mural até \d\d\/\d\d\. Quem anunciou recebe o aviso pelo WhatsApp\.$/)).toBeVisible();
    await expect(page.getByText("Nada esperando aprovação")).toBeVisible();

    await page.getByRole("button", { name: /^No mural/ }).click();
    await expect(page.getByText("Vendo · R$ 850,00 · Torre B · 201 · Paulo Mendes", { exact: true })).toBeVisible();
    await expect(page.getByText("Doação · Torre A · 302 · Marta Souza", { exact: true })).toBeVisible();
    await expect(page.getByText("Contato pelo condomínio")).toBeVisible();
    await page.getByRole("button", { name: "Tirar do mural o anúncio Doo berço de madeira" }).click();
    const t = page.getByRole("dialog", { name: "Tirar do mural?" });
    await t.getByLabel("Motivo").fill("O berço já foi doado");
    await conferir(page);
    await t.getByRole("button", { name: "Tirar do mural" }).click();
    await expect(page.getByText("\"Doo berço de madeira\" saiu do mural. Quem anunciou recebe o aviso pelo WhatsApp.")).toBeVisible();

    await page.getByRole("button", { name: /^Encerrados/ }).click();
    await expect(page.getByText("Recusado por Ana Souza: Serviço de fora do prédio")).toBeVisible();
    await expect(page.getByText("Tirado do mural: O berço já foi doado")).toBeVisible();
    await conferir(page);
  });

  test("AC-05: recusar pede o motivo, que vai para quem anunciou", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=classificados`);
    await page.getByRole("button", { name: "Revisar o anúncio Vendo bicicleta aro 29" }).click();
    await page.getByRole("dialog", { name: "Revisar o anúncio" }).getByRole("button", { name: "Recusar…" }).click();
    const r = page.getByRole("dialog", { name: "Recusar o anúncio" });
    await r.getByRole("button", { name: "Recusar" }).click();
    await expect(r.getByText("Escreva o motivo, com pelo menos 3 letras")).toBeVisible();
    await r.getByLabel("Motivo").fill("Venda de fora do prédio");
    await conferir(page);
    await r.getByRole("button", { name: "Recusar" }).click();
    await expect(page.getByText("Anúncio recusado. O motivo vai para quem anunciou pelo WhatsApp.")).toBeVisible();
  });

  test("CD-12, CD-15: a aba Classificados do mural é uma vitrine, com o primeiro nome, o bloco e o aviso", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await page.getByRole("tab", { name: /^Classificados/ }).click();
    await expect(page).toHaveURL(/aba=classificados/);
    const vitrine = page.getByRole("list", { name: "Classificados entre moradores" });
    await expect(vitrine.getByRole("link", { name: /Aulas de violão para crianças/ })).toBeVisible();
    await expect(vitrine.getByText(/^Marta · Torre A · hoje$/)).toBeVisible();
    await expect(page.getByText("Anúncios de moradores, aprovados pelo condomínio. O condomínio não vende nem garante nada daqui.")).toBeVisible();
    await expect(page.getByText("Torre A · 302")).toHaveCount(0);
    await conferir(page);
    await vitrine.getByRole("link", { name: /Aulas de violão para crianças/ }).click();
    await expect(page.getByRole("heading", { name: "Aulas de violão para crianças" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Foto do anúncio Aulas de violão para crianças" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Chamar no WhatsApp" })).toHaveAttribute("href", "https://wa.me/5561977771212");
    await conferir(page);
    await page.getByRole("button", { name: "Voltar aos classificados" }).click();
    await vitrine.getByRole("link", { name: /Doo berço de madeira/ }).click();
    await expect(page.getByText("Contato pelo condomínio.")).toBeVisible();
    await expect(page.getByText(/^Marta · Torre A$/)).toBeVisible();
  });
});

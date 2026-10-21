// Passos 6 e 7 (F6.1, F6.2, F7.1, F7.2): prazos, avisos dentro do painel, o início do dia e os
// indicadores, com a API falsa. Cada tela passa no axe (WCAG 2.2 AA) no celular e no
// computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { historicoCompleto } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma do síndico · passos 6 e 7", () => {
  test("F7.1: o início mostra o agora e o mês fechado, separados", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora).toContainText("1 retorno vencido");
    await expect(agora).toContainText("O mais antigo venceu em 16/10 11:00, já avisado ao síndico.");
    await expect(agora).toContainText("1 sem responsável");
    const mes = page.getByRole("region", { name: "Mês fechado · setembro" });
    await expect(mes).toContainText("86% dos retornos no prazo");
    await expect(mes).toContainText("37 de 43. Agosto: 79%.");
    await expect(mes).toContainText("41 pedidos concluídos · 2 reabertos");
    await conferir(page);
    await mes.getByRole("link", { name: "Ver indicadores" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Indicadores" })).toBeVisible();
  });

  test("F6.1: o sino mostra os avisos; ver o aviso não resolve o pedido", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    await page.getByRole("button", { name: "Avisos (2) sem ver" }).click();
    const janela = page.getByRole("dialog", { name: "Avisos" });
    await expect(janela.getByRole("listitem")).toHaveCount(2);
    await expect(janela.getByRole("listitem").first()).toContainText("Escalado a você");
    await expect(janela.getByRole("listitem").first()).toContainText("O responsável, Bruna, já foi avisado.");
    await conferir(page);
    await janela.getByRole("button", { name: "Marcar todos como vistos" }).click();
    await expect(janela.getByText("Sem ver")).toHaveCount(0);
    await janela.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("button", { name: "Avisos", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Agora" })).toContainText("1 retorno vencido");
  });

  test("AT-09: o pedido vencido diz quem já foi avisado e quando o próximo será", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    await page.getByRole("button", { name: /Avisos/ }).click();
    await page.getByRole("dialog", { name: "Avisos" }).getByRole("link", { name: "Ver pedido 2026-0001" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Vazamento no banheiro/ })).toBeVisible();
    const faixa = page.getByRole("status").filter({ hasText: "Retorno vencido há 4 h de atendimento" });
    await expect(faixa).toContainText("Avisado ao responsável, Bruna, às 11:00; ao síndico, Ana Souza, às 13:00.");
    await expect(faixa).toContainText("O vencimento só acaba com o retorno ao morador.");
    await historicoCompleto(page);
    await expect(page.getByText("Aviso escalado ao síndico")).toBeVisible();
    await expect(page.getByText("Retorno venceu")).toBeVisible();
    await conferir(page);
    await faixa.getByRole("button", { name: "Registrar retorno" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("F6.2: as regras de aviso, com o substituto entre as pessoas autorizadas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=prazos`);
    await expect(page.getByRole("tab", { name: "Prazos e avisos", selected: true })).toBeVisible();
    await expect(page.getByLabel("2. Avisar o síndico depois de")).toHaveValue("2");
    await page.getByLabel("3. Avisar o substituto depois de").fill("2");
    await page.getByRole("button", { name: "Salvar regras" }).click();
    await expect(page.getByText("O substituto é avisado depois do síndico. Use mais horas.")).toBeVisible();
    await conferir(page);
    await page.getByLabel("3. Avisar o substituto depois de").fill("6");
    await page.getByLabel("Substituto", { exact: true }).selectOption({ label: "Bruna · Secretária" });
    await page.getByRole("button", { name: "Salvar regras" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Regras de aviso salvas." })).toBeVisible();
    await expect(page.getByLabel("Substituto", { exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole("heading", { name: "Prazos de retorno" })).toBeVisible();
  });

  test("F7.2: indicadores por período; sem caso no período, sem dados, nunca zero", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/indicadores`);
    const prazo = page.getByRole("region", { name: "Retornos no prazo" });
    await expect(prazo).toContainText("Sem dados");
    await expect(prazo).toContainText("Nenhum retorno combinado no período. Mês passado: 86%.");
    await conferir(page);
    await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "Mês passado" }).click();
    await expect(prazo).toContainText("86%");
    await expect(prazo).toContainText("37 de 43 retornos dados até o prazo combinado.");
    await expect(page.getByRole("row", { name: /Manutenção/ })).toContainText("90% (27 de 30)");
    await expect(page.getByRole("row", { name: /Segurança/ })).toContainText("Sem dados");
    await conferir(page);
  });

  test("PT-02: quem só vê os pedidos vê os indicadores, mas não muda as regras", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true, quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=prazos`);
    await expect(page.getByText("Síndico: depois de 2 h de atendimento")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar regras" })).toHaveCount(0);
    await page.goto(`${PLATAFORMA}/indicadores`);
    await expect(page.getByRole("heading", { level: 1, name: "Indicadores" })).toBeVisible();
  });
});

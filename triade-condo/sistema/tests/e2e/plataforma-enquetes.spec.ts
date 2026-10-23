// Enquetes (peça R12; AC-03; telas DC15) com a API falsa: a ficha com o resultado enquanto corre, a
// enquete nova em página, encerrar e publicar o resultado, o link copiado para a unidade sem contato e o link
// pessoal sem conta. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Enquetes", () => {
  test("AC-03: o resultado enquanto corre, quem falta e o link copiado; encerrar e publicar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    await abrirArea(page, "Vida em condomínio");
    await expect(page.getByText("Enquete: Qual horário para a academia aos domingos?")).toBeVisible();
    await expect(page.getByText(/3 de 5 responderam · fecha/)).toBeVisible();
    await page.getByRole("link", { name: "Ver a enquete: Qual horário para a academia aos domingos?" }).click();

    // A ficha da enquete é uma página (DC15): resultado, andamento, quem falta e quem respondeu.
    await expect(page.getByRole("heading", { level: 1, name: "Qual horário para a academia aos domingos?" })).toBeVisible();
    await expect(page.getByText("Das 8h às 20h")).toBeVisible();
    await expect(page.getByText("2 · 67%")).toBeVisible();
    await expect(page.getByText("3 de 5 unidades (60%)")).toBeVisible();
    await expect(page.getByText("Uma resposta por unidade", { exact: true })).toBeVisible();
    await expect(page.getByText("Respostas secretas: aparece quem respondeu, não o que respondeu.")).toBeVisible();
    await expect(page.getByText("Sem WhatsApp nem e-mail para receber")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Copiar o link de Torre B · 104" }).click();
    await expect(page.getByText(/\/v\/B4C5-D6E7-F8G9/)).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("button", { name: "Encerrar agora: Qual horário para a academia aos domingos?" }).click();
    const enc = page.getByRole("dialog", { name: "Encerrar a enquete agora?" });
    await expect(enc.getByText(/a ligação entre unidade e resposta é apagada de vez/)).toBeVisible();
    await enc.getByRole("button", { name: "Encerrar" }).click();
    await expect(page.getByText("Enquete encerrada. Os links param de aceitar resposta")).toBeVisible();

    await page.getByRole("button", { name: "Publicar o resultado" }).click();
    await expect(page.getByText("O resultado virou um comunicado em rascunho. Confira e publique em Comunicados.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir o comunicado" }).first()).toBeVisible();
    await conferir(page);

    await page.getByRole("link", { name: "Enquetes" }).first().click();
    await page.getByRole("button", { name: /^Encerradas/ }).click();
    await expect(page.getByRole("link", { name: "Qual horário para a academia aos domingos?" })).toBeVisible();
    await conferir(page);
  });

  test("AC-03: a enquete nova confere as opções e vai para as unidades", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=enquetes`);
    await page.getByRole("link", { name: "Nova enquete" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nova enquete" })).toBeVisible();
    const continuar = page.getByRole("button", { name: "Continuar" });
    const seguir = async () => { if (await continuar.isVisible()) await continuar.click(); };
    await page.getByLabel("Pergunta", { exact: true }).fill("Trocamos o piso da garagem?");
    await page.getByLabel("Opção 1").fill("Sim");
    await page.getByLabel("Opção 2").fill("sim");
    await conferir(page);
    await seguir();
    await expect(page.getByText("E-mail desligado")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a enquete" }).click();
    await expect(page.getByText("Escreva de 2 a 6 opções, diferentes entre si")).toBeVisible();
    await conferir(page);
    await page.getByLabel("Opção 2").fill("Não");
    await seguir();
    await page.getByRole("group", { name: "Respostas" }).getByRole("button", { name: "Abertas" }).click();
    await expect(page.getByText("O síndico vê o que cada um respondeu")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Enviar a enquete" }).click();
    await expect(page.getByText("Enquete enviada para 5 unidades. Cada uma recebe um link só dela, e a pergunta aparece no mural.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Trocamos o piso da garagem?", exact: true })).toBeVisible();
  });

  test("AC-03: o link pessoal responde sem conta e deixa trocar até o prazo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/v/K7QM-3XPA-9TRE`);
    await expect(page.getByRole("heading", { name: "Enquete do Residencial Ipê" })).toBeVisible();
    await expect(page.getByText("Torre A · 302")).toBeVisible();
    await expect(page.getByText(/^Aberta até /)).toBeVisible();
    await expect(page.getByText("Uma por unidade", { exact: true })).toBeVisible();
    await expect(page.getByText("Secreta", { exact: true })).toBeVisible();
    // O botão só aparece quando há o que enviar (decisão B.1).
    await expect(page.getByRole("button", { name: "Enviar resposta" })).toHaveCount(0);
    await conferir(page);
    await page.getByLabel("Das 6h às 22h").check();
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText(/^Resposta registrada em /)).toBeVisible();
    await expect(page.getByText("Sua resposta", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /resposta$/ })).toHaveCount(0);
    await page.getByLabel("Fechada aos domingos").check();
    await page.getByRole("button", { name: "Trocar a resposta" }).click();
    await expect(page.getByLabel("Fechada aos domingos")).toBeChecked();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/v/F8NW-2HJK-4MPQ`);
    await expect(page.getByText("A enquete fechou")).toBeVisible();
    await expect(page.getByText("Sim (sua resposta)")).toBeVisible();
    await expect(page.getByText("2 · 100%")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/v/ZZZZ-ZZZZ-ZZZZ`);
    await expect(page.getByText("Este link não existe.", { exact: false })).toBeVisible();
  });
});

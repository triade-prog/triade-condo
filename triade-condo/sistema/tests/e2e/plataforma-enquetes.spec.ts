// Enquetes (peça R12; AC-03) com a API falsa: a aba com o resultado enquanto corre, a enquete
// nova, encerrar e publicar o resultado, o link copiado para a unidade sem contato e o link
// pessoal sem conta. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

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
    await expect(page.getByText("Enquete: Qual horário para a academia aos domingos?")).toBeVisible();
    await expect(page.getByText(/3 de 5 responderam · fecha/)).toBeVisible();
    await page.getByRole("link", { name: "Ver a enquete: Qual horário para a academia aos domingos?" }).click();

    await expect(page.getByRole("tab", { name: "Enquetes", selected: true })).toBeVisible();
    await expect(page.getByText("Das 8h às 20h")).toBeVisible();
    await expect(page.getByText("2 · 67%")).toBeVisible();
    await expect(page.getByText("3 de 5 unidades (60%)")).toBeVisible();
    await expect(page.getByText(/Uma resposta por unidade · respostas secretas · enviada por WhatsApp e Mural/)).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "ver quais" }).click();
    const d = page.getByRole("dialog", { name: "Qual horário para a academia aos domingos?" });
    await expect(d.getByText("Respostas secretas: aparece quem respondeu, não o que respondeu.")).toBeVisible();
    await expect(d.getByText("sem WhatsApp nem e-mail para receber")).toBeVisible();
    await d.getByRole("button", { name: "Copiar o link de Torre B · 104" }).click();
    await expect(d.getByText(/\/v\/B4C5-D6E7-F8G9/)).toBeVisible();
    await conferir(page);
    await d.getByRole("button", { name: "Fechar" }).first().click();

    await page.getByRole("button", { name: "Encerrar agora: Qual horário para a academia aos domingos?" }).click();
    const enc = page.getByRole("dialog", { name: "Encerrar a enquete agora?" });
    await expect(enc.getByText(/a ligação entre unidade e resposta é apagada de vez/)).toBeVisible();
    await enc.getByRole("button", { name: "Encerrar" }).click();
    await expect(page.getByText("Enquete encerrada. Os links param de aceitar resposta")).toBeVisible();

    await page.getByRole("button", { name: "Publicar o resultado: Qual horário para a academia aos domingos?" }).click();
    await expect(page.getByText("O resultado virou um comunicado em rascunho. Confira e publique em Comunicados.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir o comunicado" }).first()).toBeVisible();
    await conferir(page);
  });

  test("AC-03: a enquete nova confere as opções e vai para as unidades", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=enquetes`);
    await page.getByRole("button", { name: "Nova enquete" }).click();
    const j = page.getByRole("dialog", { name: "Nova enquete" });
    await expect(j.getByText("e-mail desligado")).toBeVisible();
    await j.getByLabel("Pergunta").fill("Trocamos o piso da garagem?");
    await j.getByLabel("Opção 1").fill("Sim");
    await j.getByLabel("Opção 2").fill("sim");
    await j.getByRole("button", { name: "Enviar enquete" }).click();
    await expect(j.getByText("Escreva de 2 a 6 opções, diferentes entre si")).toBeVisible();
    await conferir(page);
    await j.getByLabel("Opção 2").fill("Não");
    await j.getByLabel("Respostas").selectOption("nao");
    await expect(j.getByText("O síndico vê o que cada um respondeu")).toBeVisible();
    await j.getByRole("button", { name: "Enviar enquete" }).click();
    await expect(page.getByText("Enquete enviada para 5 unidades. Cada uma recebe um link só dela, e a pergunta aparece no mural.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trocamos o piso da garagem?", exact: true })).toBeVisible();
  });

  test("AC-03: o link pessoal responde sem conta e deixa trocar até o prazo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/v/K7QM-3XPA-9TRE`);
    await expect(page.getByRole("heading", { name: "Enquete do Residencial Ipê" })).toBeVisible();
    await expect(page.getByText("Torre A · 302")).toBeVisible();
    await expect(page.getByText(/Aberta até .* · uma por unidade · secreta/)).toBeVisible();
    await conferir(page);
    await page.getByLabel("Das 6h às 22h").check();
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText(/Resposta de Torre A · 302 registrada em .*\. Dá para trocar até/)).toBeVisible();
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

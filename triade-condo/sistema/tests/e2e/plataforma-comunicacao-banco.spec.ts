// Comunicação e vida com banco (fase D, área C; 0293; CD-01, AC-03, AC-05, CF-12) com a API falsa:
// o período nos Filtros dos comunicados (decisão C.1, quadros 260 e 261), quem fica sem o link da
// enquete pelos canais marcados (decisão C.2), o tipo mudado em Revisar o anúncio e as aberturas do
// mural em Na mesma área. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · comunicação e vida com banco", () => {
  test("CD-01 (decisão C.1): o período nos Filtros fica no endereço, ao lado de Filtros, e vale o dia da aba", async ({ page, isMobile }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    // Um comunicado publicado há 60 dias, fora dos últimos 30.
    const antigo = estado.comunicados.comunicados[0]!;
    estado.comunicados.comunicados.push({ ...antigo, id: "9a0b1c2d-3e4f-4a5b-8c6d-e00000000293", familiaId: "9a0b1c2d-3e4f-4a5b-8c6d-e00000000293",
      titulo: "Dedetização das garagens", publicadoEm: new Date(Date.now() - 60 * 86400_000).toISOString() });
    await page.goto(`${PLATAFORMA}/comunicados`);
    const lista = page.getByRole("list", { name: "Comunicados" });
    await expect(lista.getByRole("listitem")).toHaveCount(2);

    await page.getByRole("button", { name: "Filtros" }).click();
    const d = page.getByRole("dialog", { name: "Filtrar comunicados" });
    await expect(d.getByText("Vale a data que aparece na aba: publicado em, programado para, editado em ou arquivado em.")).toBeVisible();
    await d.getByRole("button", { name: "Últimos 30 dias" }).click();
    await expect(d.getByRole("button", { name: "Últimos 30 dias" })).toHaveAttribute("aria-pressed", "true");
    await expect(d.getByLabel("De")).not.toHaveValue("");
    await conferir(page);
    await d.getByRole("button", { name: "Mostrar comunicados" }).click();

    await expect(page).toHaveURL(/de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}/);
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await expect(lista).toContainText("Falta de água na quinta");
    await expect(page.getByText("1 comunicado · últimos 30 dias")).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtros, 1 em uso" })).toBeVisible();
    await conferir(page);

    if (!isMobile) {
      await page.getByRole("button", { name: "Tirar o período" }).click();
      await expect(lista.getByRole("listitem")).toHaveCount(2);
      await expect(page).not.toHaveURL(/de=/);
    }

    // As datas à mão: o fim antes do começo não deixa mostrar.
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await d.getByLabel("De").fill("2026-10-31");
    await d.getByLabel("Até").fill("2026-10-01");
    await d.getByRole("button", { name: "Mostrar comunicados" }).click();
    await expect(d.getByText("O fim do período vem depois do começo")).toBeVisible();
  });

  test("AC-03 (decisão C.2): Nova enquete diz quantos ficam sem o link pelos canais marcados e quais são", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida/nova-enquete`);
    if (isMobile) {
      await page.getByLabel("Pergunta", { exact: true }).fill("Qual horário para a academia aos domingos?");
      await page.getByLabel("Opção 1", { exact: true }).fill("Das 8h às 20h");
      await page.getByLabel("Opção 2", { exact: true }).fill("Das 6h às 22h");
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    const quem = page.locator("#quem");
    const canais = quem.getByRole("list", { name: "Canais" });
    await expect(canais.getByRole("listitem").filter({ hasText: "WhatsApp" })).toContainText("4 unidades");
    await expect(canais.getByRole("listitem").filter({ hasText: "E-mail" })).toContainText("desligado");
    await expect(canais.getByRole("listitem").filter({ hasText: "Mural" })).toContainText("todos");
    await expect(quem.getByRole("status").filter({ hasText: "1 unidade sem WhatsApp" })).toContainText("Torre B · 104. Copie o link dela na ficha da enquete.");
    await conferir(page);

    await page.getByRole("button", { name: "Uma por pessoa" }).click();
    await expect(quem).toContainText("pessoas recebem o link: 7");
    await expect(quem.getByRole("status").filter({ hasText: "1 pessoa sem WhatsApp" })).toContainText("Rui Lima");

    await page.getByRole("checkbox", { name: /WhatsApp do condomínio/ }).uncheck();
    await expect(quem.getByRole("status")).toContainText("Só pelo mural, ninguém recebe o link próprio");
    await conferir(page);
  });

  test("AC-05: em Revisar o anúncio o tipo se muda e vale no mural", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=classificados`);
    await page.getByRole("button", { name: "Revisar o anúncio Vendo bicicleta aro 29" }).click();
    const d = page.getByRole("dialog", { name: "Revisar o anúncio" });
    await expect(d.getByLabel("Tipo")).toHaveValue("VENDO");
    await d.getByLabel("Tipo").selectOption("SERVICO");
    await expect(d.getByText("O morador escolheu Vendo.")).toBeVisible();
    await conferir(page);
    await d.getByRole("button", { name: "Publicar no mural" }).click();
    await expect(page.getByText(/Anúncio publicado no mural até/)).toBeVisible();
    await page.getByRole("button", { name: /^No mural/ }).click();
    await expect(page.getByText(/Serviço de morador/).first()).toBeVisible();
  });

  test("CF-12: Na mesma área diz quantas vezes o mural foi aberto em 7 dias", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/comunicados`);
    const area = page.getByRole("region", { name: "Na mesma área" });
    await expect(area.getByRole("link", { name: /Mural e e-mail/ })).toContainText("Mural ligado · aberto 214 vezes em 7 dias");
    await conferir(page);
  });
});

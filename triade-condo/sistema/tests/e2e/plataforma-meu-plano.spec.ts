// Meu plano e os conjuntos na Plataforma (NG-21, NG-01, PI-03; quadros 253 a 255, decisões C.1, E.1
// e F.1 de 23/10/2026) com a API falsa: o plano sem valores, o que está fora com o que traz, o
// pedido que vira chamado, a tela fora do plano em vez de erro e o aviso do conjunto só para
// consultar. Cada tela passa no axe e não usa emoji.
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

test.describe("Meu plano", () => {
  test("NG-21: o plano e os conjuntos sem valores; pedir para testar abre um chamado", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { conjuntos: { VIDA: "FORA", COMUNICACAO_AMPLIADA: "FORA" } });
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await page.getByRole("link", { name: /Meu plano/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Meu plano" })).toBeVisible();
    await expect(page.getByText("Essencial")).toBeVisible();
    await expect(page.getByText("Até 60 unidades · 42 unidades ativas")).toBeVisible();
    const no = page.getByRole("region", { name: "No seu plano" });
    await expect(no).toContainText("Atendimento");
    await expect(no).toContainText("Agenda");
    const fora = page.getByRole("region", { name: "Fora do seu plano" });
    await expect(fora).toContainText("Vida em condomínio");
    await expect(fora).toContainText("Reservas · Enquetes · Assembleias · Classificados");
    await expect(page.locator("main")).not.toContainText("R$");
    await conferir(page);

    await fora.getByRole("listitem").filter({ hasText: "Vida em condomínio" }).getByRole("button", { name: "Pedir para testar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido enviado à TRÍADE: chamado 41." })).toBeVisible();
    expect(estado.pedidosPlano).toEqual([{ conjunto: "VIDA", pedido: "TESTE" }]);
  });

  test("E.1: a tela de um conjunto fora do plano diz o que ele traz, em vez de dar erro", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { conjuntos: { MANUTENCAO: "FORA" } });
    await page.goto(`${PLATAFORMA}/manutencao`);
    await expect(page.locator("main").getByRole("heading", { level: 1, name: "Manutenção" })).toBeVisible();
    await expect(page.locator("main").getByText("Fora do plano", { exact: true })).toBeVisible();
    await expect(page.getByText("Fichas, preventivas e prestadores.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver Meu plano" })).toBeVisible();
    await conferir(page);
  });

  test("C.1: o conjunto suspenso abre só para consultar, com o aviso no alto", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { conjuntos: { AGENDA: "CONSULTA" } });
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByText("Agenda está só para consultar")).toBeVisible();
    await expect(page.getByText("Você ainda vê e exporta o que já está aqui.")).toBeVisible();
    await conferir(page);
  });

  test("Sem a resposta dos conjuntos, nada fica com cadeado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByText("está só para consultar")).toHaveCount(0);
    await expect(page.getByText("fora do plano")).toHaveCount(0);
  });
});

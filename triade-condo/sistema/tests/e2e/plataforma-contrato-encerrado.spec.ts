// O contrato encerrado nas páginas públicas (0318, R17.7c; quadro 489; decisão F1): depois do último
// dia, a API recusa os links públicos com o motivo CONTRATO_ENCERRADO e o detalhe com o nome do
// condomínio e o dia. O mural, a enquete e o cadastro mostram a mesma página "Este condomínio não usa
// mais a TRÍADE"; o link do prestador, que responde com o serviço encerrado, também. Passa no axe e
// não rola para o lado no celular.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const DETALHE = { motivo: "CONTRATO_ENCERRADO", condominio: "Edifício Jatobá", desde: "2026-11-24" };

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

/** Todo link público recusa como a API depois do último dia; o do prestador responde com o serviço encerrado. */
async function encerrarContrato(page: Page) {
  await instalarApiPlataformaFalsa(page, { logado: false });
  await page.route("**/api/v1/publico/**", (route) => {
    const caminho = new URL(route.request().url()).pathname;
    if (caminho.startsWith("/api/v1/publico/p/")) return route.fulfill({ json: { encerrado: true, ...DETALHE } });
    return route.fulfill({ status: 422, json: { erro: { codigo: "VALIDATION_ERROR", detalhes: DETALHE } } });
  });
}

async function paginaEncerrada(page: Page, subtitulo: string) {
  await expect(page.getByRole("heading", { name: "Este condomínio não usa mais a TRÍADE", level: 1 })).toBeVisible();
  await expect(page.getByText(subtitulo, { exact: true })).toBeVisible();
  await expect(page.getByText("O mural e os links do Edifício Jatobá saíram do ar em 24/11/2026.")).toBeVisible();
  await expect(page.getByText("Para falar com o condomínio, procure o síndico ou a portaria.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recebeu um link?" })).toBeVisible();
  await expect(page.getByText("Nada mais será enviado. O link para parar de receber, no rodapé dos e-mails antigos, continua funcionando.")).toBeVisible();
  await conferir(page);
}

test.describe("Plataforma · contrato encerrado (quadro 489)", () => {
  test("o mural, a enquete e o cadastro mostram a mesma página, com o nome e o dia", async ({ page }) => {
    await encerrarContrato(page);
    await page.goto(`${PLATAFORMA}/m/JATOBA-MURAL`);
    await paginaEncerrada(page, "Mural do Edifício Jatobá");

    await page.goto(`${PLATAFORMA}/v/B4C5-D6E7-F8G9`);
    await paginaEncerrada(page, "Enquete do Edifício Jatobá");

    await page.goto(`${PLATAFORMA}/cadastro/JATOBA-CAD1`);
    await paginaEncerrada(page, "Cadastro do Edifício Jatobá");
  });

  test("o link do prestador encerrado pelo fim do contrato também", async ({ page }) => {
    await encerrarContrato(page);
    await page.goto(`${PLATAFORMA}/p/PRESTADOR-JATOBA`);
    await paginaEncerrada(page, "Serviço no Edifício Jatobá");
    await expect(page.getByText("Este link não vale mais")).toHaveCount(0);
  });
});

// Comercial no Console (0296; quadros 320 a 326, 336, 342 e 343, aprovados em 24/10/2026) com a API
// falsa: a lista e o quadro no computador, o Meu dia no celular, a ficha com a mensagem pronta, a
// etapa que pede campo, o novo interessado que junta e os modelos. Cada tela passa no axe e não usa
// emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { INDICADO, SITE } from "./api-falsa-console-comercial";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const celular = () => test.info().project.name === "celular";

test.describe("Console · Comercial", () => {
  test("Interessados: lista com filtros e quadro no computador; Meu dia no celular", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial`);
    if (celular()) {
      await expect(page.getByRole("heading", { name: "Meu dia", level: 1 })).toBeVisible();
      const hoje = page.getByRole("region", { name: "Hoje" });
      await expect(hoje).toContainText("Residencial Jatobá");
      await expect(hoje).toContainText("Edifício Ipê Amarelo");
      const ipe = hoje.getByRole("listitem").filter({ hasText: "Edifício Ipê Amarelo" });
      await expect(ipe.getByRole("button", { name: "WhatsApp" })).toBeDisabled();
      await conferir(page);
      return;
    }
    await expect(page.getByRole("heading", { name: "Interessados", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Interessados" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Residencial Jatobá" })).toBeVisible();
    await expect(page.getByText("Origem: Site")).toBeVisible();
    await conferir(page);
    await page.getByRole("navigation", { name: "Filtrar os interessados" }).getByRole("button", { name: /Pede atenção/ }).click();
    await expect(page.getByRole("link", { name: "Residencial Jatobá" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edifício Ipê Amarelo" })).toHaveCount(0);
    await page.getByRole("button", { name: "Quadro" }).click();
    const funil = page.getByRole("list", { name: "Funil comercial" });
    await expect(funil.getByRole("listitem", { name: "Novo" })).toContainText("Residencial Jatobá");
    await conferir(page);
  });

  test("Novo interessado com o mesmo WhatsApp junta no que já existe", async ({ page }) => {
    test.skip(celular(), "o cadastro completo é no computador; o celular abre no Meu dia");
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial`);
    await page.getByRole("button", { name: "Novo interessado" }).first().click();
    const janela = page.getByRole("dialog", { name: "Novo interessado" });
    await janela.getByRole("textbox", { name: "WhatsApp" }).fill("(61) 98888-0000");
    await janela.getByRole("textbox", { name: "Condomínio" }).fill("Ipê Amarelo");
    await janela.getByRole("radio", { name: "Indicação" }).check({ force: true });
    await conferir(page);
    await janela.getByRole("button", { name: "Registrar interessado" }).click();
    await expect(page).toHaveURL(new RegExp(`/comercial/${INDICADO}\\?juntado=1`));
    await expect(page.getByText("Este contato já existia")).toBeVisible();
  });

  test("Ficha: mensagem pronta abre o WhatsApp e registra a conversa; a etapa pede a data da demonstração", async ({ page, context }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${SITE}`);
    await expect(page.getByRole("heading", { name: "Residencial Jatobá", level: 1 })).toBeVisible();
    await expect(page.getByText("Olá, Marta! Recebemos o pedido do Residencial Jatobá.")).toBeVisible();
    await conferir(page);
    await context.route("https://wa.me/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>WhatsApp</title>" }));
    const aba = context.waitForEvent("page");
    await page.getByRole("button", { name: "Abrir no WhatsApp" }).click();
    const nova = await aba;
    expect(nova.url()).toContain("5561999990412");
    await nova.close();
    const conversa = page.getByRole("dialog", { name: "Registrar conversa" });
    await expect(conversa.getByLabel("O que conversaram")).toHaveValue("Olá, Marta! Recebemos o pedido do Residencial Jatobá.");
    await conversa.getByRole("button", { name: "Registrar conversa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Conversa registrada." })).toBeVisible();
    expect(api.comercial.pedidos.at(-1)).toMatchObject({ caminho: `/v1/comercial/interessados/${SITE}/conversas`, corpo: { canal: "WHATSAPP", mensagemId: "m1" } });

    await page.getByRole("list", { name: "Etapas do funil" }).getByRole("button", { name: /^Demonstração marcada/ }).click();
    const ficha = page.getByRole("dialog", { name: "Editar Residencial Jatobá" });
    await expect(ficha.getByText("Para a próxima etapa falta: Data da demonstração")).toBeVisible();
    await expect(page).toHaveURL(/\?etapa=DEMO_MARCADA/);
    await conferir(page);
  });

  test("Ficha sem aceite do WhatsApp deixa a mensagem pronta desligada", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    await expect(page.getByRole("heading", { name: "Edifício Ipê Amarelo", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir no WhatsApp" })).toBeDisabled();
    await expect(page.getByText("Sem o aceite de mensagens pelo WhatsApp")).toBeVisible();
    await expect(page.getByText("Origem: Indicação")).toBeVisible();
    await conferir(page);
  });

  test("Modelos: mensagens por etapa, cadências e etapas", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/modelos`);
    await expect(page.getByRole("heading", { name: "Modelos do Comercial", level: 1 })).toBeVisible();
    await expect(page.getByText("Primeira resposta")).toBeVisible();
    await conferir(page);
    await page.getByRole("navigation", { name: "Partes dos modelos" }).getByRole("button", { name: /Cadências/ }).click();
    await expect(page.getByText("em uso por 1 interessado")).toBeVisible();
    await page.getByRole("navigation", { name: "Partes dos modelos" }).getByRole("button", { name: /Etapas/ }).click();
    await expect(page.getByText("Chance de fechar: 75%")).toBeVisible();
    await conferir(page);
  });
});

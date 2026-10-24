// Retenção de dados no Console (F0.11; PT-11, PT-03; quadros 356 a 358, aprovados em 24/10/2026)
// com a API falsa: Sistema › Retenção de dados só para a Administração; as rodadas por cliente no
// modo só contando, com a fila de arquivos e o erro; Ligar a exclusão com a confirmação do que
// será apagado na próxima rodada; o que se guarda (os 32 tipos) e os clientes que saíram (ainda
// nenhum). Cada tela passa no axe e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const celular = () => test.info().project.name === "celular";

test.describe("Console · Retenção de dados", () => {
  test("Rodadas só contando, o que se guarda e os clientes que saíram; Ligar a exclusão diz o que será apagado", async ({ page }) => {
    test.slow();
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/retencao`);
    await expect(page.getByRole("heading", { level: 1, name: "Retenção de dados" })).toBeVisible();
    if (!celular()) {
      const menu = page.getByRole("navigation", { name: "Console" });
      await expect(menu.getByRole("group", { name: "Sistema" }).getByRole("link", { name: "Retenção de dados" })).toHaveAttribute("aria-current", "page");
    }
    const modo = page.getByRole("region", { name: "Modo só contando" });
    await expect(modo).toContainText("A rotina conta o que apagaria, sem apagar nada.");
    if (celular()) {
      const rodadas = page.getByRole("list", { name: "Rodadas por cliente" });
      await expect(rodadas.getByRole("listitem").filter({ hasText: "Condomínio Águas Claras" }).first()).toContainText("Hoje, 03:10 · 46 itens · 13 arquivos");
      await expect(rodadas.getByRole("listitem").filter({ hasText: "Residencial Ipê" })).toContainText("Com erro");
    } else {
      const tabela = page.getByRole("table", { name: /Rodadas da rotina por cliente/ });
      const aguas = tabela.getByRole("row", { name: /Condomínio Águas Claras/ }).first();
      await expect(aguas).toContainText("Hoje, 03:10");
      await expect(aguas).toContainText("46");
      await expect(aguas).toContainText("13");
      await expect(aguas).toContainText("Só contando");
      await expect(tabela.getByRole("row", { name: /Residencial Ipê/ })).toContainText("Com erro");
      await expect(tabela.getByRole("row", { name: /Residencial Jardins/ }).last()).toContainText("Ontem, 03:10");
    }
    await expect(page.getByText("Fila de arquivos para apagar: 13 · com erro depois de 5 tentativas: 1")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Residencial Ipê: 1 erro na última rodada" }))
      .toContainText("O armazenamento não respondeu ao apagar uma foto de pedido.");
    await conferir(page);

    await page.getByRole("tab", { name: "O que se guarda" }).click();
    await expect(page.getByText("32 tipos de dado: 28 na Plataforma (o condomínio é o responsável) e 4 no Console (a TRÍADE é).")).toBeVisible();
    if (!celular()) {
      const tipos = page.getByRole("table", { name: /tipos de dado pessoal/ });
      await expect(tipos.getByRole("row")).toHaveCount(33);
      await expect(tipos.getByRole("row", { name: /Comercial/ })).toContainText("Console");
      await expect(tipos.getByRole("row", { name: /Contato de morador/ })).toContainText("180 dias depois de sair da última unidade");
    } else {
      await expect(page.getByRole("list", { name: "O que se guarda" }).getByRole("listitem")).toHaveCount(32);
    }
    await conferir(page);

    await page.getByRole("tab", { name: "Clientes que saíram" }).click();
    await expect(page.getByText("Nenhum cliente saiu ainda")).toBeVisible();
    await expect(page.getByText(/A exclusão no fim do contrato chega numa próxima entrega/)).toBeVisible();
    await conferir(page);

    await page.getByRole("tab", { name: "Rodadas" }).click();
    await modo.getByRole("button", { name: "Ligar a exclusão" }).click();
    const j = page.getByRole("dialog", { name: "Ligar a exclusão" });
    await expect(j).toContainText("às 03:10 (horário de Brasília)");
    await expect(j.getByRole("region", { name: /Pela última contagem/ })).toContainText("Pela última contagem (Hoje, 03:10): 54 itens em 2 clientes");
    await expect(j).toContainText("Mensagens de WhatsApp: 30");
    await expect(j).toContainText("Envios de WhatsApp e e-mail: 20");
    await expect(j).toContainText("O que for apagado não volta, nem pela TRÍADE.");
    await conferir(page);
    await j.getByRole("button", { name: "Cancelar" }).click();
    expect(api.retencao.mudancas).toEqual([]);

    await modo.getByRole("button", { name: "Ligar a exclusão" }).click();
    await j.getByRole("button", { name: "Ligar a exclusão" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Exclusão ligada." })).toBeVisible();
    const apagando = page.getByRole("region", { name: "Modo apagando" });
    await expect(apagando).toContainText("Ligada por Carolina em");
    await expect(apagando.getByRole("button", { name: "Voltar a só contar" })).toBeVisible();
    expect(api.retencao.mudancas).toEqual(["APAGANDO"]);
    await conferir(page);

    await apagando.getByRole("button", { name: "Voltar a só contar" }).click();
    await page.getByRole("dialog", { name: "Voltar a só contar" }).getByRole("button", { name: "Voltar a só contar" }).click();
    await expect(page.getByRole("region", { name: "Modo só contando" })).toBeVisible();
    expect(api.retencao.mudancas).toEqual(["APAGANDO", "CONTANDO"]);
  });

  test("Só a Administração: a Implantação não tem o item no menu e a tela diz quem vê", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/retencao`);
    await expect(page.getByText("Só a Administração da TRÍADE vê a retenção de dados.")).toBeVisible();
    if (!celular()) await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Retenção de dados" })).toHaveCount(0);
    await conferir(page);
  });
});

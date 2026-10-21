// Coerência das telas, Entrega 1 (folha docs/telas/coerencia-1-textos.html; AT-01, W-05, W-17,
// CD-02, AC-02, MP-05, CF-12, V-08, PT-10): os textos que mudaram, com a API falsa. Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

test.describe("Plataforma · coerência das telas, textos", () => {
  test("V-08: todo cartão do Início leva à tela inteira pelo mesmo link, no canto de cima", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    const cartoes = ["Agora", "Hoje na agenda", "Vencimentos", "Manutenção", "Vida em condomínio", "Comunicação e moradores"];
    for (const nome of cartoes) {
      const c = await abrirArea(page, nome);
      await expect(c.getByRole("heading", { level: 2, name: nome, exact: true })).toBeVisible();
      await expect(c.getByRole("link", { name: `Ver tudo de ${nome}`, exact: true })).toHaveText("Ver tudo");
    }
    const mes = await abrirArea(page, "Mês fechado · setembro");
    await expect(mes.getByRole("link", { name: "Ver indicadores" })).toBeVisible();
    for (const velho of ["Ver todas", "Ver todos", "Ver prontuário", "Ver agenda", "Ver unidades", "Abrir"]) {
      await expect(page.getByRole("main").getByRole("link", { name: velho, exact: true })).toHaveCount(0);
    }
    expect(await page.locator("#menu-plataforma").textContent()).not.toMatch(/próximo passo|Até lá/);
    await conferir(page);
    await page.getByRole("link", { name: "Ver tudo de Agora" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
  });

  test("AT-01: a ficha diz como o pedido chegou numa frase inteira", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("link", { name: /2026-0002/ }).click();
    await expect(page.getByText(/· visto pela gestão/)).toBeVisible();
    await expect(page.getByText(/por visto pela gestão/)).toHaveCount(0);
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("link", { name: /2026-0001/ }).click();
    await expect(page.getByText(/· por telefone/)).toBeVisible();
    await conferir(page);
  });

  test("MP-05 e PT-10: telefone do prestador formatado e botões de criar com +", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/manutencao/prestadores`);
    await expect(page.getByText("Marcos · +55 13 99812-4455")).toBeVisible();
    await expect(page.getByText("+5513998124455")).toHaveCount(0);
    await page.getByRole("link", { name: "HidroPress Bombas" }).click();
    await expect(page.getByRole("region", { name: "Contato" })).toContainText("+55 13 99812-4455");
    await conferir(page);
    for (const [url, botao] of [["/vida", "+ Nova reserva"], ["/vida?aba=enquetes", "+ Nova enquete"], ["/vida?aba=assembleias", "+ Nova assembleia"],
      ["/memoria", "+ Novo item"], ["/suporte", "+ Abrir chamado"]] as const) {
      await page.goto(PLATAFORMA + url);
      await expect(page.getByRole("button", { name: botao, exact: true })).toBeVisible();
    }
  });

  test("AC-02: o botão da unidade diz o que faz, diferente do selo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=assembleias`);
    await page.getByRole("link", { name: "Assembleia da fachada" }).click();
    await expect(page.getByRole("button", { name: /^Marcar sem direito a voto: / }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sem direito a voto/ })).toHaveCount(0);
    await conferir(page);
  });
});

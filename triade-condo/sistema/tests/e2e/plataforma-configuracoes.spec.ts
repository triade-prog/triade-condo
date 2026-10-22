// Configurações por tarefa (análise de Configurações, decisões A.1 a D.1 de 22/10/2026; CF-06,
// CF-08, CF-10, CF-12) com a API falsa: a entrada com 5 grupos e o que falta, uma página por
// tarefa com um Salvar na barra do rodapé, Desfazer, a gravação em partes quando uma falha e os
// endereços antigos com ?aba=. Cada tela passa no axe (WCAG 2.2 AA) e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { barraSalvar, salvarPagina } from "./configuracoes";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Configurações por tarefa", () => {
  test("A.1: a entrada mostra os 5 grupos, o que falta e leva a cada página", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
    for (const g of ["Atendimento", "Pedidos", "Prédio", "Comunicação", "Links e QR"]) {
      await expect(page.getByRole("heading", { level: 2, name: g, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Falta 1 coisa: horário de atendimento")).toBeVisible();
    const atendimento = page.getByRole("region", { name: "Atendimento" });
    await expect(atendimento.getByRole("link", { name: /^Horários/ })).toContainText("Falta");
    await expect(atendimento.getByRole("link", { name: /^Prazos e avisos/ })).toContainText("Prazo geral 24 h");
    await expect(page.getByRole("region", { name: "Pedidos" }).getByRole("link", { name: /^Categorias e prioridades/ })).toContainText("8 categorias · 4 prioridades");
    await expect(page.getByRole("region", { name: "Pedidos" }).getByRole("link", { name: /^Etapas/ })).toContainText("Feito pela TRÍADE");
    await expect(page.getByRole("region", { name: "Comunicação" }).getByRole("link", { name: /^Comunicados/ })).toContainText("sem envio das 21h às 8h");
    await expect(page.getByRole("link", { name: "Meus avisos" })).toHaveAttribute("href", "/conta/avisos");
    await conferir(page);
    await page.getByRole("region", { name: "Prédio" }).getByRole("link", { name: /^Áreas comuns/ }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/areas`);
    await expect(page.getByRole("heading", { level: 1, name: "Áreas comuns" })).toBeVisible();
    await page.getByRole("link", { name: "Configurações · Prédio" }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes`);
  });

  test("A.1: os endereços antigos com ?aba= levam à página nova", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=whatsapp`);
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/whatsapp`);
    await expect(page.getByRole("heading", { level: 1, name: "WhatsApp" })).toBeVisible();
    await page.goto(`${PLATAFORMA}/configuracoes/nao-existe`);
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes`);
  });

  test("B.1: a barra aparece quando algo muda, conta as mudanças e Desfazer volta ao salvo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/horarios`);
    await expect(page.getByRole("heading", { level: 2, name: "Ainda sem horário de atendimento" })).toBeVisible();
    await expect(barraSalvar(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Seg a sex, das 8h às 18h" }).click();
    await expect(barraSalvar(page)).toContainText("5 mudanças ainda não salvas");
    await expect(page.getByText("Seg a sex · 50 h por semana")).toBeVisible();
    await conferir(page);
    // Trocar no trilho não perde o que foi digitado.
    await page.getByRole("group", { name: "Qual horário" }).getByRole("button", { name: "Funcionamento" }).click();
    await page.getByRole("button", { name: "Seg a sáb, das 8h às 12h" }).click();
    await expect(barraSalvar(page)).toContainText("11 mudanças ainda não salvas");
    await page.getByRole("group", { name: "Qual horário" }).getByRole("button", { name: "Atendimento" }).click();
    await expect(page.getByLabel("Sexta, fim")).toHaveValue("18:00");
    await barraSalvar(page).getByRole("button", { name: "Desfazer" }).click();
    await expect(barraSalvar(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Ainda sem horário de atendimento" })).toBeVisible();
    // O fuso é da TRÍADE: no fim da página, com um selo só.
    const bloco = page.getByRole("region", { name: "Feito pela TRÍADE" });
    await expect(bloco).toContainText("Fuso do condomínio");
    await expect(bloco.getByRole("link", { name: "Pedir mudança" })).toBeVisible();
  });

  test("B.1: um Salvar grava as partes da página; se uma falha, as outras ficam e a tela diz qual falta", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes/prazos`);
    for (const [n, parte] of [[1, "Pedido novo"], [2, "Quando o retorno vence"], [3, "Prazos de retorno"], [4, "Revisar e reabrir"]] as const) {
      await expect(page.getByRole("region", { name: parte })).toContainText(String(n));
    }
    await page.getByRole("region", { name: "Pedido novo" }).getByRole("radiogroup", { name: "Avisar o síndico" }).getByRole("radio", { name: "Todos os pedidos" }).click();
    await page.getByLabel("3. Avisar o substituto depois de").fill("1");
    await expect(barraSalvar(page)).toContainText("2 mudanças ainda não salvas");
    await salvarPagina(page);
    await expect(page.getByRole("alert").filter({ hasText: "Regra de pedido novo salva. Falta: Quando o retorno vence." })).toBeVisible();
    expect(estado.avisoRegistro.regra.sindico).toBe("TODOS");
    await expect(barraSalvar(page)).toContainText("1 mudança ainda não salva");
    await page.getByLabel("3. Avisar o substituto depois de").fill("6");
    await salvarPagina(page);
    await expect(page.getByRole("status").filter({ hasText: "Regras de aviso salvas." })).toBeVisible();
    await expect(barraSalvar(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Como funciona" }).click();
    await expect(page.getByText("pedido aberto quinta às 17h com prazo de 4 h")).toBeVisible();
    await conferir(page);
  });

  test("C.1 e CF-03: Meus avisos fica no menu da conta; quem só vê não tem barra de salvar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/configuracoes/comunicados`);
    await expect(page.getByText("o síndico precisa dar a você a permissão Configurar")).toBeVisible();
    await expect(barraSalvar(page)).toHaveCount(0);
    await page.getByRole("button", { name: /^Conta de / }).click();
    await expect(page.getByRole("link", { name: "Meus avisos" })).toBeVisible();
  });
});

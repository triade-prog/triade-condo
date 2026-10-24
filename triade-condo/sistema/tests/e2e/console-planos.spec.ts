// Planos e pagamentos no Console (PI-03, CF-11, PI-07, PI-08, PI-16, PI-19, NG-06; quadros 241 a
// 252, aprovados em 23/10/2026) com a API falsa: contratado e liberado separados, liberar com a
// prévia do que o síndico passa a ter, teste com data, suspender sem perder o histórico, a
// cobrança por competência com recebimento a conferir e o atraso que só avisa. Cada tela passa no
// axe e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const status = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });

test.describe("Console · planos e pagamentos", () => {
  test("PI-03 e CF-11: contratado e liberado separados; liberar mostra o que o síndico passa a ter", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.clientes[0]!.sindicos.push({ vinculoId: "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e", pessoaId: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f", nome: "Ana Souza", desde: "2026-10-16T16:00:00Z" });
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    const lista = page.getByRole("list", { name: "Conjuntos do cliente" });
    await expect(lista.getByRole("listitem").filter({ hasText: "Atendimento" })).toContainText("Base · sempre incluída");
    const manut = lista.getByRole("listitem").filter({ hasText: "Manutenção" });
    await expect(manut).toContainText("Contratado");
    await expect(manut).toContainText("Falta liberar");
    await expect(lista.getByRole("listitem").filter({ hasText: "Vida em condomínio" })).toContainText("Fora do plano");
    await expect(page.getByText("Valor por mês")).toBeVisible();
    await expect(page.getByText("Setembro/2026 em atraso há 44 dias")).toBeVisible();
    await expect(page.getByText("O atraso não bloqueia o condomínio.")).toBeVisible();
    await conferir(page);

    await manut.getByRole("button", { name: "Liberar: Manutenção" }).click();
    const j = page.getByRole("dialog", { name: "Liberar Manutenção" });
    await expect(j).toContainText("O que Ana Souza passa a ter");
    await expect(j).toContainText("Preventivas");
    await conferir(page);
    await j.getByRole("button", { name: "Liberar Manutenção" }).click();
    await expect(j.getByText("Diga o motivo, com pelo menos 3 letras.")).toBeVisible();
    await j.getByRole("textbox", { name: "Motivo" }).fill("Aditivo assinado pela síndica.");
    await j.getByRole("button", { name: "Liberar Manutenção" }).click();
    await expect(status(page, "Manutenção liberado.")).toBeVisible();
    await expect(manut).toContainText("Liberado");
    await expect(manut.getByRole("button", { name: "Suspender: Manutenção" })).toBeVisible();
  });

  test("NG-06 e PI-16: teste com data para acabar; suspender pede por quê e mantém a consulta", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    const lista = page.getByRole("list", { name: "Conjuntos do cliente" });
    const vida = lista.getByRole("listitem").filter({ hasText: "Vida em condomínio" });
    await vida.getByRole("button", { name: "Liberar para teste: Vida em condomínio" }).click();
    const t = page.getByRole("dialog", { name: "Liberar para teste" });
    await expect(t.getByLabel("Termina em")).toHaveAttribute("max", /\d{4}-\d{2}-\d{2}/);
    await t.getByRole("textbox", { name: "Motivo" }).fill("A síndica quer testar as reservas.");
    await conferir(page);
    await t.getByRole("button", { name: "Liberar para teste" }).click();
    await expect(status(page, "Vida em condomínio em teste até")).toBeVisible();
    await expect(vida).toContainText("Em teste até");

    const agenda = lista.getByRole("listitem").filter({ hasText: "Agenda" });
    await agenda.getByRole("button", { name: "Suspender: Agenda" }).click();
    const s = page.getByRole("dialog", { name: "Suspender Agenda" });
    await expect(s).toContainText("Nada se perde");
    await s.getByRole("textbox", { name: "Motivo" }).fill("Pedido da síndica por e-mail.");
    await s.getByRole("button", { name: "Suspender Agenda" }).click();
    await expect(s.getByText("Escolha por quê.")).toBeVisible();
    await s.getByText("Pedido do cliente").click();
    await conferir(page);
    await s.getByRole("button", { name: "Suspender Agenda" }).click();
    await expect(status(page, "Agenda suspenso.")).toBeVisible();
    await expect(agenda).toContainText("Consulta e exportação continuam.");
  });

  test("PI-07 e PI-08: registrar recebimento parcial, conferir e ver a cobrança com o histórico; o atraso só avisa", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/pagamentos`);
    await expect(page.getByRole("heading", { name: "Pagamentos", level: 1 })).toBeVisible();
    await expect(page.getByText("Em atraso é só um aviso: nada bloqueia o condomínio.")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Registrar recebimento" }).click();
    const r = page.getByRole("dialog", { name: "Registrar recebimento" });
    await r.getByLabel("Valor recebido").fill("200,00");
    await r.getByLabel("Referência do comprovante").fill("E2E-PIX-0001");
    await conferir(page);
    await r.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(status(page, "Recebimento registrado. Ele entra A conferir.")).toBeVisible();

    await page.getByRole("region", { name: "Pagamentos" }).getByRole("button", { name: "Residencial Ipê" }).click();
    const c = page.getByRole("dialog", { name: "Conferir recebimento" });
    await expect(c).toContainText("E2E-PIX-0001");
    await c.getByText("Conferi no extrato da TRÍADE").click();
    await c.getByRole("button", { name: /Confirmar/ }).click();
    await expect(status(page, "Recebimento confirmado.")).toBeVisible();

    await page.goto(`${CONSOLE}/pagamentos/${IPE}/8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d`);
    await expect(page.getByRole("heading", { name: "Residencial Ipê · Setembro/2026" })).toBeVisible();
    await expect(page.getByText("Pago em parte")).toBeVisible();
    await expect(page.getByText("O atraso não bloqueia o condomínio")).toBeVisible();
    await expect(page.getByText("Recebimento confirmado")).toBeVisible();
    await conferir(page);
  });

  test("Implantação não vê Pagamentos no menu nem os valores na ficha", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await expect(page.getByRole("list", { name: "Conjuntos do cliente" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pagamentos" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver todos" })).toHaveCount(0);
  });
});

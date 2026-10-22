// Passo 4 (F4): pedidos no painel da Plataforma do síndico, com a API falsa. Cada tela passa
// no axe (WCAG 2.2 AA) no celular e no computador, só mostra o que a pessoa pode fazer
// (CF-03) e não usa emoji nem emoticon.
import { expect, test, type Page } from "@playwright/test";
import { salvarPagina } from "./configuracoes";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirMaisAcoes, historicoCompleto, irAoPasso } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirPedido(page: Page, assunto: string) {
  await page.getByRole("link", { name: new RegExp(assunto) }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(assunto) })).toBeVisible();
}

test.describe("Plataforma do síndico · passo 4", () => {
  test("AT-02: o início mostra o que pede atenção e leva à fila filtrada", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    const cartao = page.getByRole("region", { name: "Agora", exact: true });
    await expect(cartao).toContainText("1 retorno vencido");
    await expect(cartao).toContainText("1 sem responsável");
    await expect(cartao).toContainText("3 pedidos ativos");
    await conferir(page);
    await cartao.getByRole("link", { name: "Ver quais" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Retorno vencido/, pressed: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Vazamento no banheiro/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Portão não fecha/ })).toHaveCount(0);
    await conferir(page);
  });

  test("AT-01: registrar pedido de uma unidade, com quem pediu, e abrir com o protocolo", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await expect(page.getByRole("link", { name: /Portão não fecha/ })).toBeVisible();
    await page.getByRole("button", { name: "Registrar pedido" }).first().click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await expect(j.getByRole("combobox", { name: "Quem pediu" })).toContainText("Marina Souza");
    await j.getByRole("combobox", { name: "Quem pediu" }).selectOption({ label: "Marina Souza · proprietário (condômino)" });
    await irAoPasso(j, isMobile, 2);
    await j.getByLabel("Assunto").fill("Interfone mudo");
    await j.getByLabel("O que foi relatado").fill("O interfone da 101 não toca desde ontem.");
    await irAoPasso(j, isMobile, 3);
    await expect(j.getByLabel("Responsável", { exact: true })).toHaveValue(/.+/);
    await conferir(page);
    // Quem pediu recebe o protocolo (F6.4): o botão diz quantos ficam sabendo.
    await j.getByRole("button", { name: "Registrar e avisar 1" }).click();
    await expect(j.getByText("2026-0004", { exact: true })).toBeVisible();
    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /2026-0004 · Interfone mudo/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pedido registrado." })).toBeVisible();
    await expect(page.getByText("Sem previsão")).toBeVisible();
    await conferir(page);
  });

  test("AT-06, AT-11, AT-13, AT-15: retorno, previsão, pendência, conclusão e reabertura com histórico", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await abrirPedido(page, "Vazamento no banheiro");
    await expect(page.getByRole("region", { name: "Próximo retorno ao morador" })).toContainText("venceu às");
    await expect(page.getByRole("heading", { name: "Pendências abertas" })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Dar retorno ao morador" }).click();
    const r = page.getByRole("dialog", { name: /Dar retorno ao morador/ });
    await r.getByLabel("Usar um modelo").selectOption({ label: "Recebemos seu pedido" });
    await expect(r.getByLabel("O que foi dito")).toHaveValue(/Recebemos seu pedido/);
    await conferir(page);
    await r.getByRole("button", { name: "Registrar retorno" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Retorno registrado." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Próximo retorno ao morador" })).toContainText("daqui a 24 h");

    await page.getByRole("region", { name: "Previsão de solução" }).getByRole("button", { name: "Definir" }).click();
    const pv = page.getByRole("dialog", { name: "Previsão de solução" });
    await pv.getByLabel("Nova previsão").fill("2026-10-20");
    await pv.getByRole("button", { name: "Salvar previsão" }).click();
    await expect(page.getByRole("region", { name: "Previsão de solução" })).toContainText("20/10/2026");

    await page.getByRole("button", { name: "Concluir" }).click();
    const cj = page.getByRole("dialog", { name: /Concluir/ });
    await cj.getByLabel("Explicação ao morador").fill("Trocamos o cano do banheiro e secamos o teto.");
    await cj.getByRole("button", { name: "Concluir pedido" }).click();
    await expect(cj.getByText("Ainda há pendência aberta. Resolva as pendências antes de concluir.")).toBeVisible();
    await cj.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("button", { name: "Resolver" }).click();
    const rs = page.getByRole("dialog", { name: /Resolver/ });
    await rs.getByLabel("Como foi resolvida").fill("Encanador confirmado para quinta");
    await rs.getByRole("button", { name: "Resolver pendência" }).click();
    await expect(page.getByText("1 pendência resolvida")).toBeVisible();

    await page.getByRole("button", { name: "Concluir" }).click();
    await page.getByRole("dialog", { name: /Concluir/ }).getByLabel("Explicação ao morador").fill("Trocamos o cano do banheiro e secamos o teto.");
    await page.getByRole("dialog", { name: /Concluir/ }).getByRole("button", { name: "Concluir pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido concluído." })).toBeVisible();
    await expect(page.getByText("Encerrado", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Reabrir" }).click();
    const ra = page.getByRole("dialog", { name: /Reabrir/ });
    await ra.getByRole("button", { name: "Reabrir pedido" }).click();
    await expect(ra.getByText("Explique o motivo (3 a 500 caracteres).")).toBeVisible();
    await ra.getByLabel("Por que reabrir").fill("A mancha voltou");
    await ra.getByRole("button", { name: "Reabrir pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido reaberto." })).toBeVisible();

    await historicoCompleto(page);
    await expect(page.getByText("Reaberto. Situação: Encerrado → Em andamento. Motivo: A mancha voltou")).toBeVisible();
    await expect(page.getByText(/Previsão de solução: sem previsão → 20\/10\/2026/)).toBeVisible();
    await expect(page.getByText(/Reaberto por Ana Souza/)).toBeVisible();
    await conferir(page);
  });

  test("AT-03, CF-03: a responsável aceita e dá retorno, mas só quem pode conclui", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true, quem: "SECRETARIA" });
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("region", { name: "Agora", exact: true })).toContainText("1 pedido para você aceitar");
    await page.getByRole("region", { name: "Agora", exact: true }).getByRole("link", { name: "Ver e aceitar" }).click();
    await abrirPedido(page, "Vazamento no banheiro");
    await expect(page.getByText("Esperando aceite")).toBeVisible();
    await page.getByRole("button", { name: "Aceitar o pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Você aceitou o pedido." })).toBeVisible();
    await expect(page.getByText("Aceito", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar retorno ao morador" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Concluir" })).toHaveCount(0);
    await abrirMaisAcoes(page);
    await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Registrar pedido" })).toHaveCount(0);
    await conferir(page);
  });

  test("a busca no topo acha pedidos e moradores do condomínio", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Residencial Ipê");
    // No celular a busca abre pela lupa do topo.
    const lupa = page.getByRole("button", { name: "Buscar no condomínio" });
    if (await lupa.isVisible()) await lupa.click();
    const busca = page.getByRole("searchbox", { name: "Buscar no condomínio" }).filter({ visible: true });
    await busca.fill("vazamento");
    await busca.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Buscar no condomínio" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pedidos" }).getByRole("link", { name: /Vazamento no banheiro/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Moradores" })).toContainText("Nenhum morador encontrado.");
    await conferir(page);
  });

  test("AT-14, AT-15: as regras dos pedidos ficam nas configurações", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=regras`);
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/prazos`);
    await expect(page.getByRole("region", { name: "Revisar e reabrir" })).toBeVisible();
    await expect(page.getByLabel("Reabrir pedido encerrado")).toBeChecked();
    await page.getByLabel("Revisar a conclusão antes de encerrar").check();
    await conferir(page);
    await salvarPagina(page);
    await expect(page.getByRole("status").filter({ hasText: "Regras dos pedidos salvas." })).toBeVisible();
  });
});

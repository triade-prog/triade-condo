// Passo 4b (F4.8): fotos e documentos dos pedidos na Plataforma do síndico, com a API falsa.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji. O que é
// recusado diz o motivo e não impede os outros (PT-07).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirArquivos(page: Page, assunto: string) {
  await page.goto(`${PLATAFORMA}/pedidos`);
  await page.getByRole("link", { name: new RegExp(assunto) }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(assunto) })).toBeVisible();
  await page.getByRole("tab", { name: /Fotos e documentos/ }).click();
}

const escolher = (page: Page) => page.getByRole("dialog").locator('input[type="file"][multiple]');

test.describe("Plataforma do síndico · passo 4b", () => {
  test("PT-07: a aba mostra os arquivos por parte e a foto abre grande", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await abrirArquivos(page, "Vazamento no banheiro");
    await expect(page.getByRole("tab", { name: "Fotos e documentos (1)", selected: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Relato" })).toBeVisible();
    await expect(page.getByText("Cada vez que alguém abre, o link vale por 5 minutos.")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "teto-banheiro.jpg", exact: true }).click();
    const v = page.getByRole("dialog", { name: "teto-banheiro.jpg · 1 de 1" });
    await expect(v.getByRole("img", { name: "Mancha no teto" })).toBeVisible();
    await expect(v.getByRole("button", { name: "Baixar" })).toBeVisible();
    await conferir(page);
    await v.getByRole("button", { name: "Fechar" }).click();
    await expect(v).toBeHidden();
  });

  test("PT-07: enviar arquivos; o recusado diz o motivo e o resto segue", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await abrirArquivos(page, "Vazamento no banheiro");
    await page.getByRole("button", { name: "+ Enviar arquivos" }).click();
    const j = page.getByRole("dialog", { name: /Enviar arquivos/ });
    await escolher(page).setInputFiles([
      { name: "video.mov", mimeType: "video/quicktime", buffer: Buffer.from("video") },
      { name: "orcamento.pdf", mimeType: "application/pdf", buffer: PDF },
      { name: "fatura.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>não é PDF</html>") },
    ]);
    await expect(j.getByText(/não foi aceito: só fotos e PDF\. Vídeo e áudio chegam com o WhatsApp/)).toBeVisible();
    await j.getByLabel("Descrição de orcamento.pdf").fill("Orçamento do encanador");
    await expect(j.getByRole("button", { name: "Enviar 2 arquivos" })).toBeEnabled();
    await conferir(page);
    await j.getByRole("button", { name: "Enviar 2 arquivos" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 arquivo enviado e liberado. fatura.pdf: O conteúdo não é um PDF de verdade." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fotos e documentos (3)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Andamento" })).toBeVisible();
    await expect(page.getByText("Não liberado", { exact: true })).toBeVisible();
    await expect(page.getByText("Orçamento do encanador")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Tirar fatura.pdf do pedido" }).click();
    const t = page.getByRole("dialog", { name: "Tirar fatura.pdf do pedido" });
    await t.getByRole("button", { name: "Tirar do pedido" }).click();
    await expect(t.getByText("Explique o motivo (3 a 500 caracteres).")).toBeVisible();
    await t.getByLabel("Por que tirar").fill("Arquivo errado");
    await t.getByRole("button", { name: "Tirar do pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Arquivo tirado do pedido." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fotos e documentos (2)" })).toBeVisible();
    await page.getByRole("tab", { name: "Histórico" }).click();
    await expect(page.getByText("Arquivo enviado no andamento: orcamento.pdf")).toBeVisible();
    await expect(page.getByText("Tirou fatura.pdf do pedido. Motivo: Arquivo errado")).toBeVisible();
  });

  test("AT-01: registrar pedido com foto do relato", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("button", { name: "+ Registrar pedido" }).first().click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await j.getByLabel("Assunto").fill("Infiltração na parede");
    await j.getByLabel("O que foi relatado").fill("Mancha de umidade na parede da sala.");
    await escolher(page).setInputFiles([{ name: "parede.png", mimeType: "image/png", buffer: PNG }]);
    await expect(j.getByText("parede.png", { exact: true })).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Registrar pedido" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Infiltração na parede/ })).toBeVisible();
    await page.getByRole("tab", { name: "Fotos e documentos (1)" }).click();
    await expect(page.getByRole("heading", { name: "Relato" })).toBeVisible();
    await expect(page.getByRole("button", { name: "parede.png", exact: true })).toBeVisible();
  });

  test("AT-13: concluir com evidência em arquivo, sem foto obrigatória", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("link", { name: /Portão não fecha/ }).click();
    await page.getByRole("button", { name: "Concluir" }).click();
    const cj = page.getByRole("dialog", { name: /Concluir/ });
    await expect(cj.getByText("Evidência em arquivo (opcional)")).toBeVisible();
    await cj.getByLabel("Explicação ao morador").fill("Trocamos o motor do portão da garagem.");
    await escolher(page).setInputFiles([{ name: "depois-portao.png", mimeType: "image/png", buffer: PNG }]);
    await conferir(page);
    await cj.getByRole("button", { name: "Concluir pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido concluído. 1 arquivo enviado e liberado." })).toBeVisible();
    await page.getByRole("tab", { name: "Fotos e documentos (1)" }).click();
    await expect(page.getByRole("heading", { name: "Conclusão" })).toBeVisible();
    await expect(page.getByRole("button", { name: "depois-portao.png", exact: true })).toBeVisible();
  });
});

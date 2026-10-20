// Links e QR (peça R13; AT-30, MP-08, V-11) com a API falsa: Configurações › Links e QR, a
// etiqueta sem conta, a folha para imprimir, o link do prestador na manutenção e a página do
// prestador. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { ETIQUETA_FALSA, PRESTADOR_FALSO } from "./api-falsa-links";

const PLATAFORMA = "http://localhost:3000";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirAba(page: Page) {
  await page.goto(`${PLATAFORMA}/configuracoes?aba=links`);
  const aba = page.getByRole("tab", { name: "Links e QR" });
  if (await aba.isVisible()) await aba.click();
  await expect(page.getByRole("heading", { name: "Aberto sem conta" })).toBeVisible();
}

test.describe("Links e QR", () => {
  test("AT-30: Links e QR mostra tudo o que abre sem conta e cria etiqueta com recado que some", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrirAba(page);
    await expect(page.getByText("As etiquetas abrem o WhatsApp do condomínio: +55 61 99000-1234")).toBeVisible();
    await expect(page.getByText("Aberto 214 vezes em 7 dias")).toBeVisible();
    await expect(page.getByRole("cell", { name: "E04" })).toBeVisible();
    await expect(page.getByText("Desativada", { exact: true })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Nova etiqueta" }).click();
    const j = page.getByRole("dialog", { name: "Nova etiqueta" });
    await j.getByLabel("Local").fill("Garagem · subsolo 1");
    await j.getByRole("button", { name: "Salvar etiqueta" }).click();
    await expect(j.getByText("Já existe uma etiqueta em uso para este local.")).toBeVisible();
    await j.getByLabel("Local").fill("Hall do bloco B");
    await expect(j.getByText("Olá! Quero avisar um problema em: Hall do bloco B")).toBeVisible();
    await j.getByLabel(/Recado para quem abrir/).fill("Interfone em conserto até sexta.");
    await expect(j.getByLabel("O recado some em")).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Salvar etiqueta" }).click();
    await expect(page.getByText("Etiqueta criada. Imprima e cole no local.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hall do bloco B" })).toBeVisible();
  });

  test("AT-30: a etiqueta aberta mostra o QR, e trocar o código pede motivo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrirAba(page);
    await page.getByRole("button", { name: "Garagem · subsolo 1" }).click();
    const j = page.getByRole("dialog", { name: /Etiqueta E02/ });
    await expect(j.getByRole("img", { name: "QR da etiqueta E02" })).toBeVisible();
    await expect(j.getByText(`/l/${ETIQUETA_FALSA}`)).toBeVisible();
    await expect(j.getByText("Já sabemos do portão travando.", { exact: false })).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Trocar código" }).click();
    const t = page.getByRole("dialog", { name: /Trocar o código da etiqueta E02/ });
    await expect(t.getByText("A etiqueta colada para de funcionar na hora")).toBeVisible();
    await t.getByRole("button", { name: "Trocar código" }).click();
    await expect(t.getByText("Diga o motivo")).toBeVisible();
    await t.getByLabel("Por que trocar").fill("Alguém colou uma cópia no prédio vizinho.");
    await t.getByRole("button", { name: "Trocar código" }).click();
    await expect(page.getByText("Código da etiqueta E02 trocado.", { exact: false })).toBeVisible();
  });

  test("AT-30: quem aponta a câmera vê o local, o recado e o WhatsApp do condomínio, sem login", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/l/${ETIQUETA_FALSA}`);
    await expect(page.getByRole("heading", { name: "Garagem · subsolo 1" })).toBeVisible();
    await expect(page.getByText("Etiqueta E02")).toBeVisible();
    await expect(page.getByText("Já sabemos do portão travando.", { exact: false })).toBeVisible();
    const zap = page.getByRole("link", { name: "Avisar pelo WhatsApp do condomínio" });
    const href = await zap.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/5561990001234\?text=/);
    expect(decodeURIComponent(href!.split("text=")[1]!)).toBe("Olá! Quero avisar um problema em: Garagem · subsolo 1 (etiqueta E02). O que eu vi: ");
    await expect(page.getByText("ligue 193", { exact: false })).toBeVisible();
    await expect(page.getByText("Ana Souza")).toHaveCount(0);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/l/PQRS-TUVW-XY45`);
    await expect(page.getByText("Esta etiqueta não está mais em uso")).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/l/ABCD-EFGH-JKMN`);
    await expect(page.getByText("Esta etiqueta não existe")).toBeVisible();
  });

  test("AT-30: a folha para imprimir traz as etiquetas em uso, com QR e código curto", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/etiquetas`);
    await expect(page.getByText("3 etiquetas.", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR da etiqueta E01" })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR da etiqueta E04" })).toHaveCount(0);
    await page.getByRole("button", { name: "Uma por folha" }).click();
    await expect(page.getByRole("region", { name: "Folha 3" })).toBeVisible();
    await conferir(page);
  });

  test("V-11, MP-08: o síndico manda o link e o prestador registra a chegada e conta o que fez", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    const cartao = page.getByRole("region", { name: "Link do prestador" });
    await cartao.getByRole("button", { name: "Mandar link" }).click();
    const j = page.getByRole("dialog", { name: "Mandar link ao prestador" });
    await expect(j.getByText("A chegada é confirmada pela etiqueta E03", { exact: false })).toBeVisible();
    await j.getByLabel("O que fazer").fill("Trocar");
    await j.getByRole("button", { name: "Gerar link" }).click();
    await expect(j.getByText("Diga o que fazer")).toBeVisible();
    await j.getByLabel("O que fazer").fill("Bomba 2 com ruído forte. Diagnosticar e trocar o rolamento.");
    await j.getByLabel(/Quando/).fill("Hoje, 14h às 17h");
    await conferir(page);
    await j.getByRole("button", { name: "Gerar link" }).click();
    const pronto = page.getByRole("dialog", { name: "Link pronto" });
    await expect(pronto.getByText(`/p/${PRESTADOR_FALSO}`)).toBeVisible();
    expect(await pronto.getByRole("link", { name: "Mandar pelo WhatsApp" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5513998124455\?text=/);
    await conferir(page);
    await pronto.getByRole("button", { name: "Fechar" }).click();
    await expect(cartao.getByText("Esperando resposta")).toBeVisible();

    await page.goto(`${PLATAFORMA}/p/${PRESTADOR_FALSO}`);
    await expect(page.getByRole("heading", { name: "Bomba de recalque com ruído" })).toBeVisible();
    await expect(page.getByText("Bomba 2 com ruído forte.", { exact: false })).toBeVisible();
    await expect(page.getByText("Hoje, 14h às 17h")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Cheguei" }).click();
    await expect(page.getByRole("heading", { name: "Registrar a chegada" })).toBeVisible();
    await page.getByRole("button", { name: "Estou no local, mas não achei a etiqueta" }).click();
    await expect(page.getByText("Chegada registrada, informada por você.")).toBeVisible();

    await page.getByRole("button", { name: "Terminei" }).click();
    await page.getByLabel("O que foi feito").fill("Troquei o rolamento e testei as duas bombas.");
    await page.locator('input[type="file"]').setInputFiles({ name: "depois.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(page.getByText("depois.png: pronta")).toBeVisible();
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Diga quem fez o serviço.")).toBeVisible();
    await page.getByLabel("Quem fez").fill("Márcio");
    await conferir(page);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Enviado. O condomínio confere o que foi feito e conclui a manutenção.")).toBeVisible();

    await page.goBack();
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    await expect(cartao.getByText("HidroPress Bombas contou o que fez")).toBeVisible();
    await expect(cartao.getByText("Terminou: Troquei o rolamento", { exact: false })).toBeVisible();
    await expect(cartao.getByRole("button", { name: "depois.png" })).toBeVisible();
    await conferir(page);
  });
});

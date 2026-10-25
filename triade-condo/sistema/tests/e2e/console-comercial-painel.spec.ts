// Painel comercial, janelas do condomínio e o cartão Comercial no Início (0309, R17.5; quadros 334
// a 336; CM-10, CM-18, CM-04) com a API falsa: os números do mês sem nome de interessado, o funil
// em barras, a meta que só a Administração põe, o mês sem dados, o cartão que some quando nada pede
// atenção e as janelas na ficha com o Já vi e o síndico novo. Cada tela passa no axe, não usa emoji
// e não rola para o lado no celular.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { INDICADO } from "./api-falsa-console-comercial";

const CONSOLE = "http://localhost:3001";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const celular = () => test.info().project.name === "celular";
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const mesTexto = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const br = (d: string) => d.split("-").reverse().join("/");
function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a! - 1}-12` : `${a}-${String(m! - 1).padStart(2, "0")}`;
}

test.describe("Console · Painel comercial", () => {
  test("os números do mês, sem nome de interessado, e a meta que a Administração põe", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/painel`);
    await expect(page.getByRole("heading", { name: "Painel comercial", level: 1 })).toBeVisible();
    if (!celular()) {
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Painel comercial" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Interessados" })).not.toHaveAttribute("aria-current", "page");
    }
    const numeros = page.getByRole("region", { name: "Números do mês" });
    await expect(numeros).toContainText("Novo MRR no mês");
    await expect(numeros).toContainText("R$ 687,00");
    await expect(numeros).toContainText("sem meta para o mês");
    await expect(numeros).toContainText("10 de 14");
    await expect(numeros).toContainText("valor × chance da etapa");
    await expect(numeros).toContainText("2 de 5");
    const funil = page.getByRole("list", { name: /Até onde chegaram os 14 novos/ });
    await expect(funil.getByRole("listitem").first()).toContainText("14 · 100%");
    await expect(funil.getByRole("listitem").last()).toContainText("Ganho");
    await expect(funil.getByRole("listitem").last()).toContainText("3 · 21%");
    await expect(page.getByRole("table", { name: /por origem/ })).toContainText("WhatsApp comercial");
    await expect(page.getByRole("table", { name: /contra cada concorrente/ })).toContainText("App da administradora");
    await expect(page.getByRole("link", { name: "Edifício Ipê Amarelo · v1" })).toBeVisible();
    const corpo = await page.locator("main").innerText();
    for (const nome of ["Marta Alves", "João Reis", "Rita Gomes", "Lúcia Prado"]) expect(corpo).not.toContain(nome);
    await conferir(page);

    await page.getByRole("button", { name: "Pôr a meta" }).click();
    const janela = page.getByRole("dialog", { name: `Meta de ${mesTexto(hoje().slice(0, 7))}` });
    await janela.getByRole("textbox", { name: "Meta do mês (R$)" }).fill("1.000,00");
    await janela.getByRole("textbox", { name: /Bianca/ }).fill("600,00");
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar a meta" }).click();
    await expect(page.getByRole("status")).toContainText(`Meta de ${mesTexto(hoje().slice(0, 7))} salva.`);
    await expect(numeros).toContainText("meta R$ 1.000,00 · 69%");
    await expect(page.getByRole("table", { name: /por pessoa/ })).toContainText("meta R$ 600,00");
    await expect(page.getByRole("button", { name: "Mudar a meta" })).toBeVisible();
  });

  test("o mês que passou: sem novos, e a meta não muda", async ({ page }) => {
    await instalarApiFalsa(page);
    const passado = mesAnterior(hoje().slice(0, 7));
    await page.goto(`${CONSOLE}/comercial/painel`);
    await page.getByRole("combobox", { name: "Mês" }).selectOption(passado);
    await expect(page).toHaveURL(new RegExp(`mes=${passado}`));
    await expect(page.getByText("Nenhum interessado novo neste mês")).toBeVisible();
    await expect(page.getByText("Nenhum perdido no mês.")).toBeVisible();
    await expect(page.getByRole("button", { name: /a meta/ })).toHaveCount(0);
    await conferir(page);
  });

  test("o Comercial vê o painel, mas não põe a meta", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    await page.goto(`${CONSOLE}/comercial/painel`);
    await expect(page.getByRole("region", { name: "Números do mês" })).toContainText("10 de 14");
    await expect(page.getByRole("button", { name: /a meta/ })).toHaveCount(0);
    await conferir(page);
  });
});

test.describe("Console · Início com o cartão Comercial", () => {
  test("junta o que pede atenção, com o selo de cada um", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/`);
    const cartao = page.getByRole("region", { name: "Comercial" });
    await expect(cartao).toContainText("2 pedem atenção");
    const lago = cartao.getByRole("listitem").filter({ hasText: "Condomínio Lago Sul" });
    await expect(lago).toContainText("Parado · 6 dias");
    await expect(lago).toContainText("Proposta enviada · sem responsável");
    const assembleia = br(somarDias(hoje(), 45)).slice(0, 5);
    await expect(cartao.getByRole("listitem").filter({ hasText: "Edifício Ipê Amarelo" })).toContainText(`Assembleia ${assembleia}`);
    await expect(cartao.getByRole("link", { name: "Ver os interessados" })).toHaveAttribute("href", "/comercial");
    await conferir(page);
    await cartao.getByRole("link", { name: "Edifício Ipê Amarelo" }).click();
    await expect(page).toHaveURL(new RegExp(`/comercial/${INDICADO}$`));
  });

  test("some quando nada pede atenção e para quem não é do Comercial", async ({ page }) => {
    await instalarApiFalsa(page, { comercialSemAtencao: true });
    await page.goto(`${CONSOLE}/`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Carolina");
    await expect(page.getByRole("region", { name: "Clientes com situações a tratar" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Comercial" })).toHaveCount(0);
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Inês");
    await expect(page.getByRole("region", { name: "Comercial" })).toHaveCount(0);
  });
});

test.describe("Console · Janelas do condomínio na ficha", () => {
  test("a assembleia pede atenção até alguém ver; o síndico novo fica nas conversas", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    const cartao = page.getByRole("region", { name: "Janelas do condomínio" });
    const assembleia = somarDias(hoje(), 45);
    const linha = cartao.getByRole("listitem").filter({ hasText: "Assembleia ordinária" });
    await expect(linha).toContainText(`Assembleia ordinária em ${br(assembleia)} · aviso de ${br(somarDias(assembleia, -60)).slice(0, 5)} a ${br(somarDias(assembleia, -30)).slice(0, 5)}`);
    await expect(linha).toContainText("Pede atenção");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Fim do mandato" })).toContainText("Abre em");
    await expect(cartao).toContainText("de 60 a 30 dias antes");
    await conferir(page);
    await linha.getByRole("button", { name: /^Já vi/ }).click();
    await expect(linha).toContainText("Já visto");
    await expect(linha).toContainText("por Carolina");
    await expect(linha.getByRole("button", { name: /^Já vi/ })).toHaveCount(0);

    await cartao.getByRole("button", { name: "Síndico novo" }).click();
    const janela = page.getByRole("dialog", { name: "Síndico novo" });
    const mandato = somarDias(hoje(), 700);
    await janela.getByLabel("Mandato novo até").fill(mandato);
    await conferir(page);
    await janela.getByRole("button", { name: "Registrar o síndico novo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Síndico novo registrado nas conversas." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Janelas do condomínio" }).getByRole("listitem").filter({ hasText: "Fim do mandato" })).toContainText(br(mandato));
    await expect(page.getByRole("region", { name: "Conversas" })).toContainText("Síndico novo desde");
  });
});

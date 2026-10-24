// Portaria 1 · Encomendas (PA-01, PA-07, V-04, CF-12, W-20, W-21) com a API falsa: a lista com
// abas e atalhos, registrar (uma tela no computador, 3 passos no celular) com quem fica sabendo,
// a encomenda guardada, entregar a quem é da unidade ou a outra pessoa pelo nome, Sem aviso e
// Aviso falhou com Avisar de novo e Avisei por outro meio, a unidade vista pela portaria e
// Configurações › Prédio › Portaria. Cada tela passa no axe (WCAG 2.2 AA) e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { salvarPagina } from "./configuracoes";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

/** A linha (computador) ou o cartão (celular) de uma encomenda. */
const linha = (page: Page, texto: string) => page.getByRole("listitem").filter({ hasText: texto }).filter({ visible: true }).first();

test.describe("Plataforma · Portaria · Encomendas", () => {
  test("PA-01: registrar avisa a unidade pelo WhatsApp; quem pediu PARAR não recebe; entregar guarda quem retirou e quem entregou", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comPortaria: true });
    await page.goto(`${PLATAFORMA}/portaria`);
    await expect(page.getByRole("heading", { level: 1, name: "Portaria" })).toBeVisible();
    if (!isMobile) await expect(page.getByRole("navigation").getByRole("link", { name: /^Portaria/ }).first()).toBeVisible();
    const situacao = page.getByRole("navigation", { name: "Situação" });
    await expect(situacao.getByRole("button", { name: /Guardadas/ })).toContainText("3");
    await expect(linha(page, "Torre A · 101")).toContainText("Mercado Livre");
    await conferir(page);

    await page.getByRole("button", { name: "Registrar encomenda" }).filter({ visible: true }).first().click();
    const j = page.getByRole("dialog", { name: "Registrar encomenda" });
    await j.getByLabel("Unidade").fill("Torre A · 101");
    await expect(j.getByText("Escolhida: Torre A · 101")).toBeVisible();
    if (isMobile) {
      await expect(j.getByText("Passo 1 de 3")).toBeVisible();
      await j.getByRole("button", { name: "Continuar" }).click();
      await expect(j.getByText("Passo 2 de 3")).toBeVisible();
    }
    await j.getByRole("group", { name: "De quem veio" }).getByRole("button", { name: "Amazon" }).click();
    await j.getByRole("button", { name: "Um volume a mais" }).click();
    await j.getByRole("group", { name: "Onde guardou" }).getByRole("button", { name: "Armário 1" }).click();
    if (isMobile) await j.getByRole("button", { name: "Continuar" }).click();
    const quem = j.getByRole("complementary", { name: /Quem fica sabendo/ });
    await expect(quem).toContainText("Quem fica sabendo · 1 aviso");
    await expect(quem).toContainText("Marina Souza");
    await expect(quem).toContainText("Pedro Souza");
    await conferir(page);
    await j.getByRole("button", { name: "Registrar e avisar 1" }).click();

    const pronto = page.getByRole("dialog", { name: "Encomenda guardada" });
    await expect(pronto.getByText("Torre A · 101 · Amazon · 2 volumes")).toBeVisible();
    await expect(pronto.getByRole("region", { name: "Quem foi avisado" })).toContainText("Marina Souza");
    await expect(pronto.getByRole("region", { name: "Quem foi avisado" })).toContainText("Não recebe: pediu PARAR");
    await conferir(page);
    await pronto.getByRole("button", { name: "Ver as guardadas" }).click();
    await expect(situacao.getByRole("button", { name: /Guardadas/ })).toContainText("4");

    // Entregar a outra pessoa, pelo nome: sem código por mensagem.
    await linha(page, "Amazon · 2 volumes").getByRole("button", { name: "Entregar a encomenda de Torre A · 101" }).click();
    const en = page.getByRole("dialog", { name: "Entregar encomenda · Torre A · 101" });
    await expect(en.getByText("Não há código: o condomínio nunca pede código por mensagem.")).toBeVisible();
    await en.getByLabel("Outra pessoa").check();
    await en.getByLabel("Nome de quem retirou").fill("Carlos Mota");
    await en.getByLabel("Ligação com a unidade").fill("motorista");
    await expect(en.getByText(/Fica registrado: entregue por Ana Souza a Carlos Mota/)).toBeVisible();
    await conferir(page);
    await en.getByRole("button", { name: "Confirmar a entrega" }).click();
    await expect(page.getByText("Encomenda de Torre A · 101 entregue a Carlos Mota.")).toBeVisible();
    await situacao.getByRole("button", { name: "Entregues" }).click();
    await expect(page).toHaveURL(/aba=ENTREGUES/);
    await expect(linha(page, "Carlos Mota")).toContainText("motorista");
    await conferir(page);
  });

  test("PA-07, W-21: Sem aviso e Aviso falhou nos atalhos; avisar de novo, avisei por outro meio e a unidade vista pela portaria", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comPortaria: true });
    await page.goto(`${PLATAFORMA}/portaria`);
    const atencao = page.getByRole("group", { name: "O que pede atenção" });
    await expect(atencao.getByRole("button", { name: /Guardadas há mais de 7 dias/ })).toContainText("1");
    await atencao.getByRole("button", { name: /Sem aviso/ }).click();
    await expect(page).toHaveURL(/atalho=SEM_AVISO/);
    const caio = linha(page, "Torre A · 201");
    await expect(caio).toContainText("Sem aviso");
    await caio.getByRole("button", { name: "Ações da encomenda de Torre A · 201" }).click();
    await page.getByRole("group", { name: "Ações da encomenda de Torre A · 201" }).getByRole("button", { name: "Avisei por outro meio" }).click();
    const om = page.getByRole("dialog", { name: "Como avisou a Torre A · 201?" });
    await om.getByRole("button", { name: "Interfone" }).click();
    await om.getByLabel("Com quem falou").fill("Caio");
    await conferir(page);
    await om.getByRole("button", { name: "Registrar o aviso" }).click();
    await expect(page.getByText("Torre A · 201 avisada por outro meio: interfone.")).toBeVisible();

    await atencao.getByRole("button", { name: /Aviso falhou/ }).click();
    const joana = linha(page, "Torre A · 102");
    await expect(joana).toContainText("Aviso falhou");
    await joana.getByRole("button", { name: "Ações da encomenda de Torre A · 102" }).click();
    await page.getByRole("group", { name: "Ações da encomenda de Torre A · 102" }).getByRole("button", { name: "Avisar de novo" }).click();
    await expect(page.getByText("Torre A · 102 avisada de novo: 1 aviso saiu pelo WhatsApp.")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/portaria/unidade?id=8b9c0d1e-2f3a-4b4c-9d5e-a00000000101`);
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 101" })).toBeVisible();
    const cartao = page.getByRole("region", { name: "Encomendas" });
    await expect(cartao).toContainText("Guardadas agora · 1");
    await expect(cartao).toContainText("Retirou: Marina Souza");
    const retira = page.getByRole("region", { name: "Quem pode retirar" });
    await expect(retira).toContainText("Pedro Souza");
    await expect(retira).toContainText("Pediu PARAR");
    await expect(retira).not.toContainText(/\(\d{2}\)/);
    await conferir(page);
  });

  test("CF-12, V-04: Configurações › Prédio › Portaria com quem cuida, lugares, lembrete e o cenário do prédio", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comPortaria: true });
    await page.goto(`${PLATAFORMA}/configuracoes`);
    const predio = page.getByRole("region", { name: "Prédio" });
    await expect(predio.getByRole("link", { name: /^Portaria/ })).toContainText("2 pessoas cuidam · 2 lugares · lembrete em 7 dias");
    await predio.getByRole("link", { name: /^Portaria/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Portaria" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Quem cuida da portaria" })).toContainText("João Ribeiro");
    const lugares = page.getByRole("region", { name: "Onde se guarda" });
    await expect(lugares).toContainText("Sala da portaria");
    await expect(page.getByRole("region", { name: "O cenário do prédio" })).toContainText("Este prédio");
    await conferir(page);

    await page.getByLabel("Lembrar depois de").fill("10");
    await expect(page.getByText("Guardadas há mais de 10 dias")).toBeVisible();
    await salvarPagina(page);
    await expect(page.getByText("Portaria salva.")).toBeVisible();

    await lugares.getByRole("button", { name: "Incluir lugar" }).click();
    const j = page.getByRole("dialog", { name: "Incluir lugar" });
    await j.getByLabel("Nome do lugar").fill("Prateleira B");
    await j.getByRole("button", { name: "Salvar lugar" }).click();
    await expect(page.getByText("Lugar incluído.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Onde se guarda" })).toContainText("Prateleira B");
    await conferir(page);
  });
});

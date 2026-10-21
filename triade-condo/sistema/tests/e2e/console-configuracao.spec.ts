// Aba Configuração da ficha no Console (PI-04, CF-01, CF-09, CF-12; desenho "Configuração na
// implantação", aprovado em 20/10/2026) com a API falsa: a TRÍADE monta e confere as 11 partes,
// mudar uma parte tira a marca, a etapa 4 espera tudo conferido, e com o cliente ativo os
// ajustes da TRÍADE pedem motivo e avisam o síndico. Cada tela passa no axe e não usa emoji.
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

test.describe("Console · configuração na implantação", () => {
  test("PI-04 e CF-12: as 11 partes com quem conferiu; conferir com de onde veio; mudar o fuso tira a marca", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Configuração" }).click();
    const painel = page.getByRole("tabpanel");
    await expect(painel.getByRole("heading", { name: "10 de 11 partes conferidas" })).toBeVisible();
    await expect(painel).toContainText("Falta conferir: WhatsApp.");
    await expect(painel.getByRole("listitem").filter({ hasText: "Etapas dos pedidos" })).toContainText("Só a TRÍADE");
    await expect(painel.getByRole("listitem").filter({ hasText: "Feriados" })).toContainText("TRÍADE monta · síndico ajusta");
    await expect(painel.getByRole("region", { name: "O que o síndico faz no app" })).toContainText("Ainda não aceito");
    await conferir(page);

    await painel.getByRole("button", { name: "Marcar WhatsApp como conferida" }).click();
    const j = page.getByRole("dialog", { name: "Marcar como conferida: WhatsApp" });
    await j.getByLabel("De onde veio").fill("Mensagem combinada com a síndica na visita.");
    await conferir(page);
    await j.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(status(page, "WhatsApp conferida. 11 de 11 partes.")).toBeVisible();
    await expect(painel).toContainText("Tudo conferido. A etapa 4 do roteiro pode ser marcada como realizada.");
    expect(estado.configuracao.conferencias.get("WHATSAPP")?.nota).toBe("Mensagem combinada com a síndica na visita.");

    // Na implantação, o ajuste da TRÍADE muda sem motivo; a parte mudada volta a pedir conferência.
    await painel.getByRole("button", { name: "Fuso", exact: true }).click();
    await expect(page.getByText("Você muda como TRÍADE.")).toBeVisible();
    const fuso = page.getByRole("form", { name: "Fuso do condomínio" });
    await fuso.getByRole("button", { name: "Manaus (UTC−4)" }).click();
    await expect(fuso.getByLabel("Motivo")).toHaveCount(0);
    await conferir(page);
    await fuso.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Fuso salvo.")).toBeVisible();
    expect(estado.configuracao.config.fuso).toBe("America/Manaus");
    await page.getByRole("button", { name: "Voltar às partes" }).click();
    await expect(painel.getByRole("heading", { name: "10 de 11 partes conferidas" })).toBeVisible();
    await expect(painel.getByRole("listitem").filter({ hasText: "Horários e fuso" })).toContainText("Mudada depois de conferida");
  });

  test("PI-04: a etapa 4 mostra o andamento, leva à configuração e só fica realizada com tudo conferido", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Implantação" }).click();
    await expect(page.getByText("10 de 11 conferidas")).toBeVisible();
    await expect(page.getByText("Falta conferir: WhatsApp.")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Etapa 4: Configuração" }).click();
    const j = page.getByRole("dialog", { name: "Etapa 4 · Configuração" });
    await expect(j.getByRole("button", { name: "Não se aplica" })).toHaveCount(0);
    await j.getByRole("button", { name: "Realizada" }).click();
    await expect(j.getByLabel("O que foi feito")).toHaveValue(/Atendimento: Segunda, das 8h às 18h\./);
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(j.getByText("Confira as 11 partes da aba Configuração antes de marcar esta etapa como realizada.")).toBeVisible();
    await j.getByRole("button", { name: "Voltar" }).click();

    await page.getByRole("button", { name: "Abrir a configuração" }).click();
    await expect(page.getByRole("tab", { name: "Configuração", selected: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "10 de 11 partes conferidas" })).toBeVisible();
  });

  test("CF-09: com o cliente ativo, a etapa nova pede motivo e o síndico é avisado; o que ele ajusta fica em leitura", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.clientes[0]!.cliente.estagio = "ATIVO";
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Configuração" }).click();
    const painel = page.getByRole("tabpanel");
    await expect(painel.getByRole("heading", { name: "Configuração · cliente ativo" })).toBeVisible();
    await expect(painel.getByRole("listitem").filter({ hasText: "Feriados" })).toContainText("O síndico ajusta");
    await expect(painel.getByRole("button", { name: /como conferida/ })).toHaveCount(0);
    await expect(painel).toContainText("Com o cliente ativo, mudar pede motivo e avisa o síndico no sino.");
    await conferir(page);

    await painel.getByRole("button", { name: "Etapas dos pedidos", exact: true }).click();
    await expect(page.getByText("Cliente ativo: o que a TRÍADE montou, o síndico ajusta.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Modelo" })).toHaveCount(0);
    await page.getByRole("button", { name: "+ Etapa" }).click();
    const j = page.getByRole("dialog", { name: "Nova etapa" });
    await j.getByLabel("Nome da etapa").fill("Aguardando orçamento");
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(j.getByText("Diga o motivo (3 a 500 caracteres).")).toBeVisible();
    await j.getByLabel("Motivo").fill("A síndica pediu para separar a espera de orçamento.");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(j).toBeHidden();
    await expect(page.getByRole("listitem").filter({ hasText: "Aguardando orçamento" })).toBeVisible();
    expect(estado.configuracao.avisosSindico).toEqual([{ texto: "Etapas dos pedidos", motivo: "A síndica pediu para separar a espera de orçamento." }]);
  });
});

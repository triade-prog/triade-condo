// Link do serviço para o prestador avisado no registro (F6.7; MP-09, V-11; desenho "Link do
// serviço no registro") com a API falsa: no bloco Quem avisar, o prestador já vem com "Mandar o
// link do serviço" marcado, o prazo pela prioridade e a reserva do cadastro; quando e como entrar
// são apontados antes de gravar; a confirmação mostra a manutenção que nasceu; o pedido, a
// manutenção e a página do prestador mostram de onde veio. Cancelar o pedido não cancela a
// manutenção. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { PRESTADOR_FALSO } from "./api-falsa-links";
import { avisado, escolherPrioridade, irAoPasso, maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

/** Um pedido urgente na casa de bombas, com a Bruna responsável e a HidroPress escolhida. */
async function escolherPrestador(page: Page, isMobile: boolean) {
  await page.goto(`${PLATAFORMA}/pedidos`);
  await page.getByRole("button", { name: "Registrar pedido" }).first().click();
  const j = page.getByRole("dialog", { name: "Registrar pedido" });
  await j.getByRole("button", { name: "Em área comum" }).click();
  await j.getByLabel("Local").fill("Casa de bombas");
  await irAoPasso(j, isMobile, 2);
  await j.getByLabel("Assunto").fill("Bomba vazando");
  await j.getByLabel("O que foi relatado").fill("Água no piso da casa de bombas.");
  await irAoPasso(j, isMobile, 3);
  await escolherPrioridade(j, "Urgente");
  await j.getByLabel("Responsável", { exact: true }).selectOption({ label: "Bruna" });
  const qa = j.getByRole("region", { name: "Quem fica sabendo" });
  await qa.getByRole("button", { name: "Escolher", exact: true }).click();
  await qa.getByRole("button", { name: "Escolher HidroPress Bombas" }).click();
  return { j, qa };
}

async function registrarComLink(j: Locator, qa: Locator) {
  await qa.getByLabel("Quando").fill("Hoje, assim que possível");
  await qa.getByLabel("Como entrar").fill("Portaria; procurar o zelador");
  await j.getByRole("button", { name: "Registrar e avisar 2" }).click();
  await expect(j.getByText("2026-0004", { exact: true })).toBeVisible();
}

test.describe("Plataforma · link do serviço no registro", () => {
  test("V-11, MP-09: o prestador já sai com o link, o prazo pela prioridade e a reserva do cadastro", async ({ page, isMobile }) => {
    // Passa pelo axe sete vezes, em telas grandes: precisa de mais tempo que o padrão.
    test.slow();
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const { j, qa } = await escolherPrestador(page, isMobile);

    const marcar = qa.getByLabel("Mandar o link do serviço");
    await expect(marcar).toBeChecked();
    await expect(qa.getByText("WhatsApp do condomínio para +55 13 9••••-4455 · link do serviço")).toBeVisible();
    await expect(qa.getByLabel("O que fazer"))
      .toHaveValue("Casa de bombas: Bomba vazando.\n\nÁgua no piso da casa de bombas.\n\nPara combinar, fale com Ana, do condomínio.");
    const prazo = qa.getByRole("group", { name: "Prazo para responder" });
    await expect(prazo.getByRole("button", { name: "4 horas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(qa.getByLabel("Se não responder, passar para Bombas Litoral")).toBeChecked();
    await conferir(page);

    // Desmarcado, o prestador recebe só a mensagem, como no F6.4; marcado de novo, volta o link.
    await marcar.uncheck();
    await expect(qa.getByText("Sem o link, o prestador recebe só a mensagem e nenhuma manutenção nasce. O link pode ir depois, pela manutenção.")).toBeVisible();
    await expect(qa.getByLabel("Quando")).toHaveCount(0);
    await marcar.check();

    // O prazo segue a prioridade até alguém escolher outro (decisão 7).
    await escolherPrioridade(j, "Alta");
    await expect(prazo.getByRole("button", { name: "24 horas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await prazo.getByRole("button", { name: "8 horas", exact: true }).click();
    await escolherPrioridade(j, "Urgente");
    await expect(prazo.getByRole("button", { name: "8 horas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await prazo.getByRole("button", { name: "4 horas", exact: true }).click();

    // Sem quando nem como entrar, nada grava e a tela aponta o campo (decisão 9).
    await j.getByRole("button", { name: "Registrar e avisar 2" }).click();
    await expect(qa.getByText("Diga quando, de 2 a 120 caracteres.")).toBeVisible();
    await expect(qa.getByText("Diga como entrar, de 2 a 500 caracteres.")).toBeVisible();
    await expect(qa.getByLabel("Quando")).toBeFocused();
    await conferir(page);
    await registrarComLink(j, qa);

    await expect(avisado(j, "HidroPress Bombas, prestador")).toContainText("WhatsApp · link do serviço");
    await expect(avisado(j, "HidroPress Bombas, prestador")).toContainText("Esperando a mensagem sair");
    await expect(j.getByText("Manutenção corretiva criada")).toBeVisible();
    await expect(j.getByText("Bomba vazando · ligada a este pedido · se não responder, passa para Bombas Litoral")).toBeVisible();
    await expect(j.getByText("O prazo para responder só começa quando a mensagem sai.")).toBeVisible();
    await conferir(page);

    // No pedido, a mensagem já saiu: o prazo corre e o cartão leva à manutenção.
    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Bomba vazando/ })).toBeVisible();
    const cartao = page.getByRole("region", { name: "Avisos do registro" });
    const prestador = cartao.getByRole("listitem").filter({ hasText: "HidroPress Bombas" });
    await expect(prestador).toContainText("link pelo WhatsApp");
    await expect(prestador).toContainText("Esperando resposta até");
    await expect(prestador).toContainText("Manutenção Bomba vazando · planejada");
    await expect(page.getByRole("region", { name: "Manutenção ligada" }).getByRole("link", { name: "Bomba vazando" })).toBeVisible();
    await conferir(page);

    await prestador.getByRole("link", { name: "Bomba vazando" }).click();
    const link = page.getByRole("region", { name: "Link do prestador" });
    await expect(link).toContainText("Mandado no registro do pedido 2026-0004, pelo WhatsApp do condomínio");
    await expect(link).toContainText("Se não responder, passa para Bombas Litoral.");
    await conferir(page);

    // A página do prestador é a de sempre, com o número do pedido (decisão 10).
    await page.goto(`${PLATAFORMA}/p/${PRESTADOR_FALSO}`);
    await expect(page.getByText("Corretiva · pedido 2026-0004")).toBeVisible();
    await expect(page.getByText("Portaria; procurar o zelador")).toBeVisible();
    await conferir(page);
  });

  test("MP-05: cancelar o pedido não cancela a manutenção ligada; o pedido avisa que ela continua", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const { j, qa } = await escolherPrestador(page, isMobile);
    await registrarComLink(j, qa);
    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await maisAcoes(page, "Cancelar pedido");
    const c = page.getByRole("dialog", { name: /Cancelar/ });
    await c.getByLabel("Por que cancelar").fill("Vazamento era da torneira, já resolvido");
    await c.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByText("O pedido foi cancelado, mas a manutenção ligada continua aberta.", { exact: false })).toBeVisible();
    await conferir(page);
  });

  test("V-11: sem a permissão de editar manutenção, o prestador recebe só a mensagem", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA", comAtendimento: true, secretariaRegistra: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("button", { name: "Registrar pedido" }).first().click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByRole("button", { name: "Em área comum" }).click();
    await j.getByLabel("Local").fill("Casa de bombas");
    await irAoPasso(j, isMobile, 2);
    await j.getByLabel("Assunto").fill("Bomba vazando");
    await j.getByLabel("O que foi relatado").fill("Água no piso da casa de bombas.");
    await irAoPasso(j, isMobile, 3);
    const qa = j.getByRole("region", { name: "Quem fica sabendo" });
    await qa.getByRole("button", { name: "Escolher", exact: true }).click();
    await qa.getByRole("button", { name: "Escolher HidroPress Bombas" }).click();
    await expect(qa.getByText("O link do serviço fica com quem cuida da manutenção; daqui, o prestador recebe só a mensagem.")).toBeVisible();
    await expect(qa.getByLabel("Mandar o link do serviço")).toHaveCount(0);
    await expect(qa.getByLabel("Mensagem ao prestador")).toBeVisible();
    await conferir(page);
  });
});

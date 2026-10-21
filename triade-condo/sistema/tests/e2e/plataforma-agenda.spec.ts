// Agenda do condomínio (peça R7; AG-01 a AG-05, AG-08, AG-09, MP-04) com a API falsa. Cada
// tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { abrirFiltros, alternarOrigem, fecharFiltros, filtrarTipo } from "./agenda";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { hojeFalso, somar } from "./api-falsa-agenda";

const PLATAFORMA = "http://localhost:3000";
const curta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma do síndico · agenda", () => {
  test("AG-03: a agenda em lista, na semana e no mês; o dia do mês abre a lista", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible();
    const hoje = page.getByRole("region", { name: /, hoje$/ });
    await expect(hoje).toContainText("hoje");
    await expect(hoje).toContainText("Encanador no apto 101");
    await expect(hoje).toContainText("Confirmado");
    await expect(hoje).toContainText("Pedido 2026-0001 · Vazamento no banheiro");
    await expect(hoje).toContainText("Reunião do conselho");
    await expect(page.getByText("Limpeza da caixa-d'água")).toBeVisible();
    await expect(page.getByText("Todo mês").or(page.getByText("A cada 6 meses"))).toBeVisible();
    await conferir(page);

    await page.getByRole("group", { name: "Como ver a agenda" }).getByRole("button", { name: "Mês" }).click();
    const dia = page.getByRole("button", { name: /, hoje: 2 itens/ });
    await expect(dia).toBeVisible();
    await conferir(page);
    await page.getByRole("group", { name: "Como ver a agenda" }).getByRole("button", { name: "Semana" }).click();
    await expect(page.getByRole("button", { name: /, hoje: 2 itens/ })).toBeVisible();
    await conferir(page);
    await page.getByRole("group", { name: "Como ver a agenda" }).getByRole("button", { name: "Mês" }).click();
    await page.getByRole("button", { name: /, hoje: 2 itens/ }).click();
    await expect(page.getByRole("region", { name: /, hoje$/ })).toContainText("Reunião do conselho");

    await abrirFiltros(page);
    await conferir(page);
    await fecharFiltros(page);
    await filtrarTipo(page, "REUNIAO");
    await expect(page.getByText("Encanador no apto 101")).toHaveCount(0);
    await expect(page.getByText("Reunião do conselho")).toBeVisible();
  });

  test("AG-01, AG-04: marcar avisa o conflito com a mesma pessoa e deixa salvar mesmo assim", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/agenda`);
    await page.getByRole("button", { name: "Novo compromisso" }).click();
    const j = page.getByRole("dialog", { name: "Novo compromisso" });
    await j.getByRole("group", { name: "Tipo do compromisso" }).getByRole("button", { name: "Visita técnica" }).click();
    await j.getByLabel("Título").fill("Vistoria da bomba");
    await j.getByLabel("Começa").fill("14:30");
    await j.getByLabel("Termina").fill("15:30");
    await j.getByLabel("Bruna").check();
    await conferir(page);
    await j.getByRole("button", { name: "Salvar compromisso" }).click();
    const aviso = j.getByRole("status").filter({ hasText: "Conflita com outro compromisso" });
    await expect(aviso).toContainText(`Bruna já está em "Encanador no apto 101" em ${curta(hojeFalso())}, das 14:00 às 15:00.`);
    await expect(aviso).toContainText("Dá para salvar mesmo assim.");
    await j.getByRole("button", { name: "Salvar mesmo assim" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Compromisso marcado." })).toBeVisible();
    await expect(page.getByRole("region", { name: /, hoje$/ })).toContainText("Vistoria da bomba");

    await page.getByRole("button", { name: "Novo compromisso" }).click();
    await j.getByLabel("Título").fill("Ronda da portaria");
    await j.getByLabel("Dia todo").check();
    await j.getByLabel("Repetir").selectOption("SEMANAL");
    await j.getByLabel("Quantas vezes, contando a primeira").fill("3");
    await j.getByRole("button", { name: "Salvar compromisso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Compromisso marcado em 3 datas." })).toBeVisible();
    await expect(page.getByText("Ronda da portaria")).toHaveCount(3);
  });

  test("AG-02, AG-05: reagendar pede o motivo e deixa rastro; cancelar não volta", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/agenda`);
    await page.getByRole("link", { name: "Limpeza da caixa-d'água" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Limpeza da caixa-d'água" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Este compromisso se repete" })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Reagendar" }).click();
    const r = page.getByRole("dialog", { name: "Reagendar" });
    const nova = somar(hojeFalso(), 10);
    await r.getByLabel("Nova data").fill(nova);
    await r.getByRole("button", { name: "Reagendar" }).click();
    await expect(r.getByRole("alert")).toBeVisible();
    await r.getByLabel("Por que mudou").fill("A empresa remarcou por causa da chuva");
    await expect(r.getByRole("group", { name: "Vale para" }).getByRole("button", { name: "Só esta data" })).toHaveAttribute("aria-pressed", "true");
    await conferir(page);
    await r.getByRole("button", { name: "Reagendar" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Reagendado para ${curta(nova)}.` })).toBeVisible();
    const hist = page.getByRole("region", { name: "Histórico" });
    await expect(hist).toContainText(`Reagendado de ${curta(somar(hojeFalso(), 3))} para ${curta(nova)}`);
    await expect(hist).toContainText('"A empresa remarcou por causa da chuva"');

    await page.getByRole("button", { name: "Cancelar compromisso" }).click();
    const c = page.getByRole("dialog", { name: "Cancelar compromisso" });
    await c.getByLabel("Por que cancelar").fill("A obra da cobertura atrasou");
    await c.getByRole("button", { name: "Cancelar compromisso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Compromisso cancelado." })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Compromisso cancelado" }).filter({ hasText: "A obra da cobertura atrasou" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reagendar" })).toHaveCount(0);
  });

  test("AG-08, MP-04: o pedido mostra a visita e avisa quando a previsão não bate, sem mudar nada", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("link", { name: /Vazamento no banheiro/ }).click();
    const na = page.getByRole("region", { name: "Na agenda" });
    await expect(na).toContainText("Encanador no apto 101 · confirmado");
    await na.getByRole("button", { name: "Marcar visita" }).click();
    const j = page.getByRole("dialog", { name: "Novo compromisso" });
    await expect(j.getByLabel("Título")).toHaveValue("Vazamento no banheiro");
    await expect(j.getByLabel("Bruna")).toBeChecked();
    await expect(j.getByLabel("Pedido ligado")).toHaveValue(/.+/);
    const visita = somar(hojeFalso(), 5);
    await j.getByLabel("Data", { exact: true }).fill(visita);
    await j.getByLabel("Começa").fill("10:00");
    await j.getByRole("button", { name: "Salvar compromisso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Compromisso marcado." })).toBeVisible();
    await expect(na).toContainText(`${curta(visita).slice(0, 5)}, 10:00`);

    await page.getByRole("region", { name: "Previsão de solução" }).getByRole("button", { name: "Definir" }).click();
    const pv = page.getByRole("dialog", { name: "Previsão de solução" });
    await pv.getByLabel("Nova previsão").fill(somar(hojeFalso(), 2));
    await pv.getByRole("button", { name: "Salvar previsão" }).click();
    const aviso = page.getByRole("region", { name: "Na agenda" }).getByRole("status").filter({ hasText: "Datas diferentes" });
    await expect(aviso).toContainText(`A previsão de solução é ${curta(somar(hojeFalso(), 2)).slice(0, 5)}, mas a visita está marcada para ${curta(visita).slice(0, 5)}.`);
    await expect(page.getByRole("region", { name: "Previsão de solução" })).toContainText(curta(somar(hojeFalso(), 2)));
    await conferir(page);
  });

  test("AG-09: os feriados das configurações entram tracejados, levam às configurações e saem com o filtro", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=feriados`);
    await page.getByRole("button", { name: /Trazer feriados nacionais de 2026/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "feriados nacionais de 2026 incluídos" })).toBeVisible();
    await page.goto(`${PLATAFORMA}/agenda?data=2026-11-01`);
    await expect(page.getByText("Finados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Vem de Configurações › Feriados" }).first()).toHaveAttribute("href", /\/configuracoes\?aba=feriados/);
    await conferir(page);
    await alternarOrigem(page, "Feriados");
    await expect(page.getByText("Finados")).toHaveCount(0);
  });

  test("AG-07: quem só vê não marca; quem não tem a permissão não vê a agenda", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/agenda`);
    await expect(page.getByText("Encanador no apto 101")).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo compromisso" })).toHaveCount(0);
    await page.getByRole("link", { name: "Encanador no apto 101" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Encanador no apto 101" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reagendar" })).toHaveCount(0);
  });

  test("AG-07: a secretária sem a permissão não tem a agenda no menu nem no início", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Hoje na agenda" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Agenda", exact: true })).toHaveCount(0);
  });

  test("TR-11: hoje na agenda, no início", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    const cartao = page.getByRole("region", { name: "Hoje na agenda" });
    await expect(cartao).toContainText("Encanador no apto 101");
    await expect(cartao).toContainText("Reunião do conselho");
    await expect(cartao).toContainText("Amanhã: nada marcado.");
    await conferir(page);
    await cartao.getByRole("link", { name: "Ver tudo de Hoje na agenda" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible();
  });
});

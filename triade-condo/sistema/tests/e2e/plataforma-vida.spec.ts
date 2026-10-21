// Vida em condomínio (peça R12; AC-01, AC-06, AC-07) com a API falsa: Configurações › Áreas comuns,
// a aba Reservas com aprovar e recusar com motivo, a reserva pedida por telefone e o cartão no
// início. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Vida em condomínio", () => {
  test("AC-07: as áreas vêm prontas, o síndico ativa e cria uma área nova", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=areas`);
    await expect(page.getByText("5 áreas prontas, 2 ativas.", { exact: false })).toBeVisible();
    await expect(page.getByText("Síndico aprova · 2 a 60 dias de antecedência · 10h às 23h · até 80 pessoas · 1 por mês por unidade")).toBeVisible();
    await expect(page.getByText("Uso livre, sem reserva · 6h às 23h")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Nova área" }).click();
    const j = page.getByRole("dialog", { name: "Nova área" });
    await j.getByLabel("Nome").fill("Salão de festas");
    await j.getByRole("button", { name: "Salvar e ativar" }).click();
    await expect(j.getByText("Escreva o nome, com 2 a 60 letras, diferente das outras áreas")).toBeVisible();
    await j.getByLabel("Nome").fill("Brinquedoteca");
    await j.getByLabel("Como a reserva é confirmada").selectOption("AUTOMATICA");
    await j.getByLabel("Como se reserva").selectOption("BLOCOS");
    await j.getByLabel("Tamanho do bloco").selectOption("120");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar e ativar" }).click();
    await expect(page.getByText("Brinquedoteca salva e ativa.")).toBeVisible();
    await expect(page.getByText(/Criada pelo síndico · Automática · 1 a 30 dias de antecedência · blocos de 2 horas/)).toBeVisible();
  });

  test("AC-01 e AC-06: aprovar recusa o outro pedido da mesma data; recusar pede motivo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    const vida = await abrirArea(page, "Vida em condomínio");
    await expect(vida.getByText("2 reservas a aprovar")).toBeVisible();
    await page.getByRole("link", { name: "Ver as reservas a aprovar" }).click();

    await expect(page.getByRole("button", { name: "A aprovar · 2" })).toBeVisible();
    await expect(page.getByText("Mesma data de outro pedido: aprovar um recusa o outro, com o motivo.").first()).toBeVisible();
    await expect(page.getByText("1ª reserva da unidade", { exact: false }).first()).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Recusar a reserva 2026-R015" }).click();
    const recusa = page.getByRole("dialog", { name: "Recusar a reserva 2026-R015" });
    await recusa.getByRole("button", { name: "Recusar" }).click();
    await expect(recusa.getByText("Escreva o motivo, com pelo menos 3 letras")).toBeVisible();
    await conferir(page);
    await recusa.getByRole("button", { name: "Voltar" }).click();

    await page.getByRole("button", { name: "Aprovar a reserva 2026-R014" }).click();
    const ap = page.getByRole("dialog", { name: "Aprovar a reserva 2026-R014" });
    await ap.getByLabel(/Recado para o morador/).fill("A chave fica com o zelador.");
    await ap.getByRole("button", { name: "Aprovar" }).click();
    await expect(page.getByText("Reserva 2026-R014 aprovada. O morador recebe a confirmação pelo WhatsApp. O outro pedido da mesma data foi recusado, com o motivo.")).toBeVisible();
    await expect(page.getByText("Nada esperando aprovação")).toBeVisible();

    await page.getByRole("button", { name: "Todas" }).click();
    await expect(page.getByText("Recusada: A data ficou com outro pedido de reserva")).toBeVisible();
    await page.getByRole("button", { name: /Salão de festas · .* · 10:00 às 23:00/ }).first().click();
    await expect(page.getByRole("dialog", { name: /Reserva 2026-R01/ }).getByText("Histórico")).toBeVisible();
    await conferir(page);
  });

  test("Decisão 1: o síndico registra a reserva pedida por telefone, que segue a regra da área", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida`);
    await page.getByRole("button", { name: "Nova reserva" }).click();
    const j = page.getByRole("dialog", { name: "Nova reserva" });
    await j.getByLabel("Área").selectOption({ label: "Churrasqueira" });
    await j.getByLabel("Unidade").selectOption({ label: "Torre A · 302" });
    await j.getByLabel(/Quem pediu/).selectOption({ label: "Marta Lima" });
    const dia = new Date(Date.now() - 3 * 3600_000 + 10 * 86400_000).toISOString().slice(0, 10);
    await j.getByLabel("Dia").fill(dia);
    await expect(j.getByText(/Livre\..*Confirma na hora\./)).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Registrar reserva" }).click();
    await expect(page.getByText("Reserva 2026-R016 confirmada. O morador recebe a confirmação pelo WhatsApp.")).toBeVisible();
  });
});

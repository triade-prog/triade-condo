// Assembleias (peça R12; AC-02, CD-07) com a API falsa: a aba com as regras e as frações, a
// assembleia nova com a pauta, convocar, conferir a procuração, a votação item a item com o aviso
// de quórum, registrar o voto de quem está no salão, encerrar com a ata, e o link pessoal sem conta.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Assembleias", () => {
  test("AC-02: a assembleia nova, convocar e conferir a procuração", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    await expect(page.getByText("Assembleia: Assembleia geral ordinária 2026")).toBeVisible();
    await page.goto(`${PLATAFORMA}/vida?aba=assembleias`);
    await expect(page.getByRole("tab", { name: "Assembleias", selected: true })).toBeVisible();
    await expect(page.getByText(/Convocação com 10 dias de antecedência · pela fração ideal/)).toBeVisible();
    await expect(page.getByText(/1 procuração a conferir/)).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Frações ideais" }).click();
    const f = page.getByRole("dialog", { name: "Frações ideais" });
    await expect(f.getByText("Soma: 100%")).toBeVisible();
    await f.getByLabel("Torre A · 101").fill("130");
    await expect(f.getByText("Entre 0 e 100")).toBeVisible();
    await f.getByRole("button", { name: "Voltar" }).click();

    await page.getByRole("button", { name: "Nova assembleia" }).click();
    const d = page.getByRole("dialog", { name: "Nova assembleia" });
    await d.getByLabel("Nome").fill("Assembleia do elevador");
    await d.getByLabel("Tipo").selectOption("EXTRAORDINARIA");
    await d.getByLabel("1ª chamada").fill("2030-05-10T19:00");
    await d.getByLabel("2ª chamada").fill("2030-05-10T19:30");
    await d.getByLabel("Local").fill("Salão de festas");
    await d.getByLabel("Item 1", { exact: true }).fill("Trocar o elevador social");
    await d.getByRole("button", { name: "Item da pauta" }).click();
    await d.getByLabel("Item 2", { exact: true }).fill("Eleger a comissão de obra");
    await d.getByLabel("Votação").nth(1).selectOption("ESCOLHA");
    await d.getByLabel("Opção 1 do item 2").fill("Marta");
    await d.getByLabel("Opção 2 do item 2").fill("Rafael");
    await expect(d.getByText("Em branco entra sozinho no fim.")).toBeVisible();
    await conferir(page);
    await d.getByRole("button", { name: "Salvar o rascunho" }).click();

    await expect(page.getByRole("heading", { name: /Assembleia do elevador/ })).toBeVisible();
    await expect(page.getByText("Proprietário ou procurador")).toBeVisible();
    await expect(page.getByText("Marta, Rafael, Em branco")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Convocar" }).click();
    await page.getByRole("dialog", { name: "Convocar a assembleia?" }).getByRole("button", { name: "Convocar" }).click();
    await expect(page.getByText("Assembleia convocada. O edital foi publicado e 4 unidades recebem um link só dela.")).toBeVisible();

    await page.goto(`${PLATAFORMA}/vida?aba=assembleias`);
    await page.getByRole("link", { name: "Assembleia da fachada" }).click();
    await expect(page.getByText("Procuração a conferir")).toBeVisible();
    await page.getByRole("button", { name: "Conferir a procuração de Torre A · 201" }).click();
    const p = page.getByRole("dialog", { name: "Procuração de Torre A · 201" });
    await expect(p.getByText("Aceita, o link da Torre A · 302 passa a votar pelas duas.")).toBeVisible();
    await conferir(page);
    await p.getByRole("button", { name: "Aceitar" }).click();
    await expect(page.getByText("Procuração de Torre A · 201 aceita.", { exact: true })).toBeVisible();
    await expect(page.getByText("Procuração aceita", { exact: true })).toBeVisible();
  });

  test("AC-02: a votação item a item, o aviso de quórum, o voto do salão e a ata", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/vida?aba=assembleias`);
    await page.getByRole("link", { name: "Assembleia geral ordinária 2026" }).click();
    await expect(page.getByText("3 de 4 · 75% das frações")).toBeVisible();
    await expect(page.getByText(/Sim 73,3% · Não 26,7% · Abstenção 0% das frações presentes · 3 unidades votaram/)).toBeVisible();
    await expect(page.getByText("1 de 3 unidades presentes já votaram", { exact: false })).toBeVisible();
    await expect(page.getByText("Presentes somam 75%. Os presentes não alcançam unanimidade: mesmo com todos a favor, o item não passa.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir a votação do item 3" })).toBeDisabled();
    await conferir(page);

    await page.getByRole("button", { name: "Registrar voto" }).click();
    const v = page.getByRole("dialog", { name: "Registrar voto no item 2" });
    await v.getByLabel("Unidade").selectOption({ label: "Torre A · 102" });
    await v.getByLabel("Não").check();
    await conferir(page);
    await v.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Voto de Torre A · 102 no item 2: Não.")).toBeVisible();

    await page.getByRole("button", { name: "Encerrar a votação do item 2" }).click();
    await expect(page.getByText("Item 2 votado. Os números ficaram guardados.")).toBeVisible();
    await page.getByRole("button", { name: "Encerrar a assembleia" }).click();
    await page.getByRole("dialog", { name: "Encerrar a assembleia?" }).getByRole("button", { name: "Encerrar" }).click();
    await expect(page.getByText("Assembleia encerrada. O rascunho da ata está pronto para editar.")).toBeVisible();
    await expect(page.getByLabel("Texto da ata")).toHaveValue(/Presentes: 3 de 4 unidades/);
    await page.getByLabel("Texto da ata").fill("Presidente: Ana Souza\nSecretário: Bruna");
    await page.getByLabel("Ata assinada (de Documentos › Atas)").selectOption({ label: "Ata da AGO 2026 assinada" });
    await page.getByRole("button", { name: "Salvar a ata" }).click();
    await expect(page.getByText("Ata assinada ligada à assembleia. Ela aparece na Memória do prédio.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir a ata assinada" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar a lista de presença" }).click();
    expect((await download).suggestedFilename()).toBe("presenca-assembleia-geral-ordin-ria-2026.csv");
    await conferir(page);
  });

  test("AC-02: o link pessoal indica o procurador antes e vota durante, sem conta", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/a/F9NW-3HJK-5MPQ`);
    await expect(page.getByRole("heading", { name: "Assembleia da fachada" })).toBeVisible();
    await expect(page.getByText("Residencial Ipê · Torre A · 102 · Rafael Dias")).toBeVisible();
    await conferir(page);
    await page.getByLabel("Outra pessoa, por procuração").check();
    await page.getByRole("button", { name: "Indicar o procurador" }).click();
    await expect(page.getByText("Escreva o nome do procurador")).toBeVisible();
    await page.getByLabel("Nome do procurador").fill("Joana Dias");
    await page.getByRole("button", { name: "Indicar o procurador" }).click();
    await expect(page.getByText("Procuração para Joana Dias: a conferir.")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/a/K7QM-3XPA-9TRE`);
    await expect(page.getByText(/Em andamento · presença registrada às/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar na videochamada" })).toBeVisible();
    await expect(page.getByText("Item 2 de 3 · votação aberta")).toBeVisible();
    await expect(page.getByText("Voto registrado: Sim. Dá para trocar enquanto o item está aberto.")).toBeVisible();
    await page.getByLabel("Abstenção").check();
    await page.getByRole("button", { name: "Trocar o voto" }).click();
    await expect(page.getByText("Voto registrado: Abstenção. Dá para trocar enquanto o item está aberto.")).toBeVisible();
    await expect(page.getByText(/1\. Aprovar as contas de 2025: aprovado/)).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/a/ZZZZ-ZZZZ-ZZZZ`);
    await expect(page.getByText("Este link não existe.", { exact: false })).toBeVisible();
  });
});

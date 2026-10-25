// Relatório do mês para a assembleia (TR-02, TR-05, TR-08, TR-10) com a API falsa: o atalho e o
// cartão em Indicadores, montar com o modelo e o resumo pronto, juntar documento e foto, gerar,
// a folha com por categoria e por torre, o PDF único e a planilha, gerar de novo como versão 2,
// a parte trancada por permissão e o mês sem dados. Cada tela passa no axe (WCAG 2.2 AA) no
// celular e no computador e não usa emoji.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · relatório do mês", () => {
  test("TR-02/TR-10: montar com o modelo, juntar anexos, gerar, baixar o PDF e a planilha, gerar de novo", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/indicadores`);
    await expect(page.getByRole("link", { name: "Relatório do mês" })).toBeVisible();
    const chamada = page.getByRole("region", { name: "Setembro fechou e ainda não tem relatório" });
    await expect(chamada).toBeVisible();
    await conferir(page);

    await chamada.getByRole("link", { name: "Montar o relatório" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Montar o relatório do mês" })).toBeVisible();
    await expect(page.getByLabel("Mês fechado")).toHaveValue("2026-09");
    await expect(page.getByRole("checkbox", { name: /Reincidência/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Por bloco ou torre/ })).toBeChecked();
    await expect(page.getByRole("textbox", { name: "Resumo" })).toHaveValue(/^Em setembro, o condomínio registrou 45 pedidos e concluiu 41\. 86% dos retornos/);
    await page.getByRole("textbox", { name: "Palavra do síndico" }).fill("Obrigada a todos pela paciência com a obra da garagem.");
    await conferir(page);

    await page.getByRole("button", { name: "Dos documentos" }).click();
    const dialogo = page.getByRole("dialog", { name: "Juntar um documento" });
    await expect(dialogo.getByText("PDF · versão 1")).toBeVisible();
    await conferir(page);
    await dialogo.getByRole("button", { name: "Juntar Regimento interno" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "fachada.png", mimeType: "image/png", buffer: PNG_1PX });
    const anexos = page.getByRole("list", { name: "Anexos do relatório" });
    await expect(anexos.getByText("Anexo A · Regimento interno")).toBeVisible();
    await expect(anexos.getByText("Anexo B · fachada.png")).toBeVisible();
    await page.getByRole("checkbox", { name: /Guardar estas escolhas/ }).check();
    await page.getByRole("button", { name: "Gerar o relatório" }).click();

    await expect(page.getByRole("heading", { level: 1, name: /Relatório de setembro de 2026/ })).toBeVisible();
    await expect(page.getByText("Os números ficaram como estavam agora.", { exact: false })).toBeVisible();
    const folha = page.getByRole("article", { name: "Relatório de setembro de 2026" });
    await expect(folha.getByRole("heading", { name: "3 · Por categoria" })).toBeVisible();
    await expect(folha.getByRole("table", { name: "Por categoria" })).toContainText("Tempo médio de fechamento");
    await expect(folha.getByRole("table", { name: "Por bloco ou torre" })).toContainText("Áreas comuns e sem unidade");
    await expect(folha.getByRole("table", { name: "Decisões do síndico" })).toContainText("5 (1 devolvida)");
    // R5: as fechadas pelo conselho e as despesas entram na mesma tabela, com o valor aprovado.
    await expect(folha.getByRole("table", { name: "Decisões do síndico" })).toContainText("Fechadas pelo conselho, com os votos");
    await expect(folha.getByRole("table", { name: "Decisões do síndico" })).toContainText("2 · R$ 9.200");
    await expect(folha).toContainText("Obrigada a todos pela paciência");
    await expect(folha).toContainText("quando o relatório foi gerado");
    await conferir(page);

    const pdf = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o PDF" }).click();
    const arquivo = await pdf;
    expect(arquivo.suggestedFilename()).toBe("relatorio-2026-09-v1.pdf");
    expect(readFileSync((await arquivo.path())!).subarray(0, 5).toString()).toBe("%PDF-");
    await expect(page.getByText(/não baixou/)).toHaveCount(0);

    const csv = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar as tabelas" }).click();
    const planilha = readFileSync((await (await csv).path())!, "utf8");
    expect(planilha).toContain("Por categoria;Registrados;Concluídos;Tempo médio de fechamento;Retornos no prazo");
    expect(planilha).toContain("Manutenção;20;18;1 dia e 12 h;83% · 15 de 18");
    await expect.poll(() => estado.relatorios.baixados.map((b) => b.formato)).toEqual(["PDF", "CSV"]);
    expect(estado.relatorios.modelo.guardadoPor).toBe("Ana Souza");

    await page.getByRole("link", { name: "Gerar de novo" }).click();
    await expect(page.getByText("Gerando de novo a partir da versão 1")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Palavra do síndico" })).toHaveValue(/Obrigada a todos/);
    await expect(page.getByRole("list", { name: "Anexos do relatório" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Gerar o relatório" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /versão 2/ })).toBeVisible();

    await page.getByRole("link", { name: "Relatórios do mês" }).click();
    const gerados = page.getByRole("list", { name: "Relatórios gerados" });
    await expect(gerados.getByRole("listitem")).toHaveCount(2);
    await expect(gerados.getByRole("listitem").nth(1)).toContainText("há uma versão mais nova");
    await expect(page.getByText(/Guardado em .* por Ana Souza/)).toBeVisible();
    await conferir(page);
  });

  test("TR-08/TR-05: sem Aprovar, Decisões fica trancada; o mês sem pedido sai com sem dados, nunca zero", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/indicadores/relatorios/montar?mes=2026-09`);
    await expect(page.getByText("Uma parte não entra porque você não tem acesso a ela")).toBeVisible();
    const decisoes = page.getByRole("checkbox", { name: /Decisões do síndico/ });
    await expect(decisoes).toBeDisabled();
    await expect(decisoes).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Dos documentos" })).toBeDisabled();
    await conferir(page);

    await page.getByLabel("Mês fechado").selectOption("2026-07");
    await expect(page.getByRole("textbox", { name: "Resumo" })).toHaveValue("Em julho, o condomínio não registrou pedidos.");
    await page.getByRole("checkbox", { name: /Palavra do síndico/ }).uncheck();
    await page.getByRole("button", { name: "Gerar o relatório" }).click();
    const folha = page.getByRole("article", { name: "Relatório de julho de 2026" });
    await expect(folha.getByRole("table", { name: "Por categoria" })).toContainText("sem dados");
    await expect(folha.getByRole("table", { name: "Decisões do síndico" })).toHaveCount(0);
    await expect(folha).toContainText("Decisões do síndico ficou de fora");
    await conferir(page);
  });
});

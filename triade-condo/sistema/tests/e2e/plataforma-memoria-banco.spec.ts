// Documentos e memória com banco (0294; decisões D.1 a D.3 de 24/10/2026; MP-12, MP-05, CT-02, CT-03)
// com a API falsa: a linha do tempo com busca e período, o histórico do prontuário por Mais ações e
// por item, e o arquivo do contrato do prestador guardado em Documentos e visto no atalho Contratos.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const dia = (n: number) => new Date(Date.now() - 3 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
const curta = (iso: string) => iso.split("-").reverse().join("/");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

test.describe("Documentos e memória com banco", () => {
  test("D.3: a linha do tempo busca por palavra e filtra por período", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/documentos/linha`);
    await expect(page.getByText("Ana Souza assume a sindicatura")).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar na linha do tempo" }).fill("muro");
    await expect(page.getByRole("status").filter({ hasText: "1 resultado para “muro”" })).toBeVisible();
    await expect(page).toHaveURL(/busca=muro/);
    await expect(page.getByRole("button", { name: "Vizinho do lote 12 divide o muro" })).toBeVisible();
    await expect(page.getByText("Ana Souza assume a sindicatura")).toHaveCount(0);
    await conferir(page);

    await page.getByRole("searchbox", { name: "Buscar na linha do tempo" }).fill("parafuso");
    await page.getByRole("searchbox", { name: "Buscar na linha do tempo" }).press("Enter");
    await expect(page.getByText("Nada encontrado", { exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar na linha do tempo" }).fill("");
    await page.getByRole("searchbox", { name: "Buscar na linha do tempo" }).press("Enter");

    await page.getByRole("button", { name: "Filtros" }).click();
    const f = page.getByRole("dialog", { name: "Filtros" });
    await f.getByLabel("De", { exact: true }).fill(dia(0));
    await f.getByLabel("Até", { exact: true }).fill(dia(-10));
    await expect(f.getByText("O fim do período vem depois do começo")).toBeVisible();
    await f.getByLabel("De", { exact: true }).fill(dia(-10));
    await f.getByLabel("Até", { exact: true }).fill(dia(0));
    await conferir(page);
    await f.getByRole("button", { name: "Mostrar" }).click();
    await expect(page.getByRole("button", { name: "Filtros, 1 em uso" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manutenção concluída: troca da bomba de recalque" })).toBeVisible();
    await expect(page.getByText("AVCB (Corpo de Bombeiros) venceu")).toHaveCount(0);
    await page.getByRole("button", { name: "Tirar o período" }).click();
    await expect(page.getByText("AVCB (Corpo de Bombeiros) venceu")).toBeVisible();
  });

  test("D.1: o histórico do prontuário mostra quem mudou cada item e o que venceu", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/documentos/prontuario`);
    await page.getByRole("button", { name: "Para-raios (SPDA)", exact: true }).click();
    const s = page.getByRole("dialog", { name: "Para-raios (SPDA)" });
    await s.getByRole("button", { name: "Ligar este" }).click();
    await expect(page.getByText("Para-raios (SPDA): Laudo SPDA 2026 ligado ao item.")).toBeVisible();

    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await page.getByRole("link", { name: "Histórico do prontuário" }).click();
    await expect(page.getByRole("heading", { name: "Histórico do prontuário", level: 1 })).toBeVisible();
    const h = page.getByRole("region", { name: "Histórico do prontuário" });
    await expect(h.getByText("Documento ligado: Laudo SPDA 2026")).toBeVisible();
    await expect(h.getByText("Venceu: AVCB 2025")).toBeVisible();
    await expect(h.getByText("AVCB (Corpo de Bombeiros) · Sozinho, pela data de validade")).toBeVisible();
    await conferir(page);

    await page.getByLabel("Item").selectOption({ label: "Para-raios (SPDA)" });
    await expect(page).toHaveURL(/item=/);
    await expect(page.getByRole("status")).toHaveText("1 mudança neste item");
    await expect(h.getByText("Venceu: AVCB 2025")).toHaveCount(0);

    // Ver o histórico do item abre a mesma página já com o item.
    await page.goto(`${PLATAFORMA}/documentos/prontuario`);
    await page.getByRole("button", { name: "AVCB (Corpo de Bombeiros)", exact: true }).click();
    const a = page.getByRole("dialog", { name: "AVCB (Corpo de Bombeiros)" });
    await a.getByRole("button", { name: "Mais ações" }).click();
    await a.getByRole("link", { name: "Ver o histórico do item" }).click();
    await expect(page.getByLabel("Item")).toHaveValue(/.+/);
    await expect(page.getByRole("status")).toHaveText("1 mudança neste item");
  });

  test("D.2: o contrato do prestador é enviado pela ficha e fica em Documentos, no atalho Contratos", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao/prestadores`);
    await page.getByRole("link", { name: "Aqualimp" }).first().click();
    await expect(page.getByRole("heading", { name: "Aqualimp", level: 1 })).toBeVisible();
    await expect(page.getByText("Não enviado")).toBeVisible();
    await page.getByRole("button", { name: "Enviar o contrato" }).click();
    const j = page.getByRole("dialog", { name: "Enviar o contrato" });
    await expect(j.getByLabel("Vale até")).toHaveValue(dia(40));
    await j.getByLabel("Arquivo").setInputFiles({ name: "contrato-aqualimp-2026.pdf", mimeType: "application/pdf", buffer: PDF });
    await j.getByLabel("Vale até").fill(dia(400));
    await conferir(page);
    await j.getByRole("button", { name: "Enviar o contrato" }).click();
    await expect(page.getByText("Contrato guardado em Documentos e ligado ao prestador.")).toBeVisible();
    await expect(page.getByRole("button", { name: "contrato-aqualimp-2026.pdf" })).toBeVisible();
    await expect(page.getByText(`Contrato até ${curta(dia(400))}`)).toBeVisible();

    await page.getByRole("button", { name: "Enviar a versão nova" }).click();
    const v = page.getByRole("dialog", { name: "Enviar a versão nova" });
    await v.getByLabel("Arquivo").setInputFiles({ name: "contrato-aqualimp-aditivo.pdf", mimeType: "application/pdf", buffer: PDF });
    await v.getByRole("button", { name: "Enviar a versão nova" }).click();
    await expect(page.getByText(`Versão 2 do contrato guardada, vale até ${curta(dia(400))}.`)).toBeVisible();
    await expect(page.getByRole("button", { name: "contrato-aqualimp-aditivo.pdf" })).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/documentos?filtro=CONTRATOS`);
    const doPrestador = page.getByRole("list", { name: "Contratos dos prestadores" });
    await expect(doPrestador.getByText("Limpeza de reservatórios · contrato-aqualimp-aditivo.pdf")).toBeVisible();
    await expect(page.getByRole("list", { name: "Contratos guardados em Documentos" }).getByText("Contrato com Aqualimp")).toHaveCount(0);
    await conferir(page);
  });
});

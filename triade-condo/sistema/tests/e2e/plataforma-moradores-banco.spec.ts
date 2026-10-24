// Moradores e unidades com banco (fase D, área B; 0292; MU-02, MU-06, MU-10) com a API falsa: as
// abas Proprietários, Inquilinos e Moram na lista de pessoas (decisão B.1) e os veículos sem vaga
// em Garagens › Veículos (decisão B.2). Cada tela passa no axe (WCAG 2.2 AA) no celular e no
// computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A101, A102 } from "./api-falsa-moradores";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · moradores com banco", () => {
  test("MU-02 (decisão B.1): Proprietários, Inquilinos e Moram, com o número de cada aba e a aba no endereço", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    // A 102 ganha um proprietário que não mora.
    const ricardo = { id: "8b9c0d1e-2f3a-4b4c-9d5e-c00000000777", nome: "Ricardo Alves", telefone: "+5561977771212", versao: 1 };
    estado.moradores.contatos.push(ricardo);
    estado.moradores.vinculos.push({ ...estado.moradores.vinculos[0]!, id: "8b9c0d1e-2f3a-4b4c-9d5e-d00000000777", contatoId: ricardo.id, unidadeId: A102,
      relacao: "PROPRIETARIO", proprietario: true, mora: false, principal: false });
    await page.goto(`${PLATAFORMA}/moradores?aba=pessoas`);
    const abas = page.getByRole("navigation", { name: "Ligação com a unidade" });
    await expect(abas.getByRole("button", { name: "Todas 5" })).toHaveAttribute("aria-pressed", "true");
    await expect(abas.getByRole("button", { name: "Proprietários 2" })).toBeVisible();
    await expect(abas.getByRole("button", { name: "Inquilinos 1" })).toBeVisible();
    await expect(abas.getByRole("button", { name: "Moram 4" })).toBeVisible();
    await conferir(page);

    await abas.getByRole("button", { name: "Proprietários 2" }).click();
    const lista = page.getByRole("list", { name: "Pessoas" });
    await expect(lista.getByRole("listitem")).toHaveCount(2);
    await expect(lista.getByRole("listitem").filter({ hasText: "Ricardo Alves" })).toContainText("não mora");
    await expect(lista.getByRole("listitem").filter({ hasText: "Marina Souza" })).toContainText("mora · responsável");
    await expect(page.getByText("2 proprietários", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/ligacao=PROPRIETARIOS/);
    await conferir(page);

    await abas.getByRole("button", { name: "Moram 4" }).click();
    await expect(lista.getByRole("listitem")).toHaveCount(4);
    await expect(lista).not.toContainText("Ricardo Alves");
    // O número das abas já conta com a busca.
    await page.getByRole("searchbox", { name: "Buscar por nome, unidade ou telefone" }).fill("Lima");
    await expect(abas.getByRole("button", { name: "Todas 2" })).toBeVisible();
    await expect(abas.getByRole("button", { name: "Proprietários 0" })).toBeVisible();
    await expect(lista.getByRole("listitem")).toHaveCount(2);

    // A aba fica no endereço: recarregar volta nela.
    await page.goto(`${PLATAFORMA}/moradores?aba=pessoas&ligacao=INQUILINOS`);
    await expect(abas.getByRole("button", { name: "Inquilinos 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await expect(lista).toContainText("Joana Lima");
  });

  test("MU-06 (decisão B.2): Veículos mostra também os sem vaga, e o atalho deixa só esses", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const g23 = estado.moradores.vagas.find((v) => v.identificacao === "G-23")!.id;
    const veic = (id: string, placa: string, unidadeId: string, vagaId: string | null, modelo: string) =>
      ({ id: `8b9c0d1e-2f3a-4b4c-9d5e-e0000000000${id}`, placa, tipo: "CARRO" as const, modelo, unidadeId, contatoId: null, vagaId, retirado: false, versao: 1 });
    estado.moradores.veiculos.push(veic("1", "QMF2A41", A101, g23, "Onix prata"), veic("2", "BRA2E19", A101, null, "HB20 branco"),
      veic("3", "ABC1234", A102, null, "Kwid vermelho"));
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("tab", { name: "Garagens" }).click();
    await page.getByRole("navigation", { name: "De quem é" }).getByRole("button", { name: "Veículos 3" }).click();
    const lista = page.getByRole("list", { name: "Veículos" });
    await expect(lista.getByRole("listitem")).toHaveCount(3);
    await expect(lista.getByRole("listitem").nth(0)).toContainText("ABC-1234");
    await expect(lista.getByRole("listitem").nth(0)).toContainText("Sem vaga");
    await expect(lista.getByRole("listitem").filter({ hasText: "QMF2A41" })).toContainText("Vaga G-23");
    await conferir(page);

    await page.getByRole("group", { name: "Mostrar só" }).getByRole("button", { name: "Sem vaga 2" }).click();
    await expect(lista.getByRole("listitem")).toHaveCount(2);
    await expect(lista).not.toContainText("QMF2A41");
    await page.getByRole("searchbox", { name: "Buscar por vaga, unidade ou placa" }).fill("bra2");
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await expect(lista).toContainText("HB20 branco");
    await conferir(page);
    await lista.getByRole("link", { name: "Torre A · 101" }).click();
    await expect(page).toHaveURL(new RegExp(`unidade\\?id=${A101}`));
  });
});

// Família, pets, aniversário, histórico, menu da unidade e busca por etiqueta (F3.9, F3.10;
// MU-06, MU-11) com a API falsa: incluir familiar e pet na ficha, retirar por saída ou engano, o
// aniversário só com dia e mês, o histórico por mês com filtro, os aniversariantes do mês, o
// menu de cada linha da lista e a etiqueta na busca. Cada tela passa no axe (WCAG 2.2 AA) no
// celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A102 } from "./api-falsa-moradores";
import { linha, noMenu } from "./moradores-telas";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · família, pets, histórico e etiquetas", () => {
  test("MU-06: família e pets na ficha, com aniversário só de dia e mês, e retirar por saída ou engano", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await expect(page.getByText("2 moram aqui com 1 da família")).toBeVisible();
    const familia = page.getByRole("region", { name: "Família" });
    const lucas = linha(familia.getByRole("list", { name: "Família de Torre A · 102" }), "Lucas Lima");
    await expect(lucas).toContainText("Filho ou filha de Joana Lima · mora aqui");
    await expect(lucas).toContainText("14/11");
    await expect(linha(page.getByRole("list", { name: "Pessoas de Torre A · 102" }), "Joana Lima")).toContainText("03/11");
    await expect(page.getByRole("region", { name: "Histórico da unidade" })).toContainText("Marcada para alugar");
    await conferir(page);

    await familia.getByRole("button", { name: "Incluir familiar" }).click();
    const jf = page.getByRole("dialog", { name: "Incluir familiar" });
    await expect(jf.getByText("Familiar não tem telefone")).toBeVisible();
    await jf.getByLabel("Nome").fill("Sofia Lima");
    await jf.getByLabel("Mês").selectOption({ label: "Fevereiro" });
    // Fevereiro vai até 29: o dia 30 nem aparece.
    await expect(jf.getByLabel("Dia").locator("option", { hasText: "30" })).toHaveCount(0);
    await expect(jf.getByText("Escolha o dia e o mês.")).toBeVisible();
    await jf.getByLabel("Dia").selectOption({ label: "29" });
    await conferir(page);
    await jf.getByRole("button", { name: "Incluir familiar" }).click();
    await expect(page.getByText("Sofia Lima incluído na família.")).toBeVisible();
    expect(estado.moradores.familia.find((f) => f.nome === "Sofia Lima")?.aniversario).toEqual({ dia: 29, mes: 2 });

    const pets = page.getByRole("region", { name: "Pets" });
    await expect(pets.getByText("Nenhum pet cadastrado.")).toBeVisible();
    await pets.getByRole("button", { name: "Incluir pet" }).click();
    const jp = page.getByRole("dialog", { name: "Incluir pet" });
    await jp.getByLabel("Nome").fill("Thor");
    await jp.getByRole("group", { name: "Porte" }).getByRole("button", { name: "Médio" }).click();
    await jp.getByLabel("Raça").fill("Vira-lata");
    await jp.getByLabel("Observação").fill("Fica sozinho de dia; late com o interfone.");
    await conferir(page);
    await jp.getByRole("button", { name: "Incluir pet" }).click();
    await expect(page.getByText("Thor incluído nos pets.")).toBeVisible();
    await expect(linha(pets, "Thor")).toContainText("Cão · porte médio · vira-lata");
    await expect(page.getByText("Com pet", { exact: true })).toBeVisible();

    await noMenu(pets, "Ações de Thor", "Retirar Thor");
    const jr = page.getByRole("dialog", { name: "Retirar Thor da unidade" });
    await jr.getByLabel(/Foi cadastrado por engano/).check();
    await conferir(page);
    await jr.getByRole("button", { name: "Retirar Thor" }).click();
    await expect(page.getByText("Thor retirado e os dados apagados.")).toBeVisible();
    expect(estado.moradores.pets).toEqual([]);
    await expect(page.getByRole("region", { name: "Histórico da unidade" })).toContainText("Pet retirado");

    await noMenu(familia, "Ações de Sofia Lima", "Retirar Sofia Lima");
    await page.getByRole("dialog", { name: "Retirar Sofia Lima da unidade" }).getByRole("button", { name: "Retirar Sofia Lima" }).click();
    await expect(page.getByText("Sofia Lima saiu da unidade.")).toBeVisible();
    expect(estado.moradores.familia.find((f) => f.nome === "Sofia Lima")?.saiu).toBe(true);
  });

  test("MU-06: o aniversário entra no Editar da pessoa e o e-mail usa a versão nova", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await noMenu(page, "Ações de Joana Lima", "Editar Joana Lima");
    const j = page.getByRole("dialog", { name: "Editar Joana Lima" });
    await j.getByLabel("Dia").selectOption({ label: "05" });
    await j.getByLabel("E-mail").fill("joana@exemplo.com.br");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/Joana Lima atualizado/)).toBeVisible();
    const joana = estado.moradores.contatos.find((c) => c.nome === "Joana Lima")!;
    expect(joana.aniversario).toEqual({ dia: 5, mes: 11 });
    expect(joana.email).toBe("joana@exemplo.com.br");
  });

  test("MU-11: o histórico por mês, com filtro e páginas, sem telefone", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await noMenu(page, "Mais ações", "Ver o histórico");
    await expect(page.getByRole("heading", { name: "Histórico da unidade" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outubro de 2026" })).toBeVisible();
    await expect(page.getByText("3 registros desde 01/03/2025")).toBeVisible();
    await page.getByRole("button", { name: "Ver mais antigas" }).click();
    await expect(page.getByRole("heading", { name: "Março de 2025" })).toBeVisible();
    await expect(page.getByText("Carlos Prado saiu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver mais antigas" })).toHaveCount(0);
    await conferir(page);
    await page.getByRole("group", { name: "Filtrar o histórico" }).getByRole("button", { name: "Marcas" }).click();
    await expect(page.getByText("1 registro desde 12/10/2026")).toBeVisible();
    await expect(page.getByText("Carlos Prado saiu")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/\+55|98888/);
    await conferir(page);
  });

  test("MU-11: o menu de cada unidade na lista leva à ficha, ao histórico e aos aniversariantes", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("button", { name: "Ações de Torre A · 102" }).click();
    const menu = page.getByRole("group", { name: "Ações de Torre A · 102" });
    await expect(menu.getByRole("link", { name: "Pendentes (1)" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Garagens e veículos" })).toBeVisible();
    await conferir(page);
    await menu.getByRole("link", { name: "Aniversariantes" }).click();
    await expect(page.getByRole("heading", { name: "Aniversariantes" })).toBeVisible();
    await expect(page.getByLabel("Unidade")).toHaveValue(A102);
    const lista = page.getByRole("list", { name: "Aniversariantes de novembro" });
    await expect(lista.getByRole("listitem")).toHaveCount(2);
    await expect(linha(lista, "Lucas Lima")).toContainText("Família · filho ou filha");
    await conferir(page);
    await page.getByRole("button", { name: /Mês seguinte/ }).click();
    await expect(page.getByText("Ninguém faz aniversário em dezembro")).toBeVisible();
    await page.getByLabel("Unidade").selectOption({ label: "Todas" });
    await expect(page).toHaveURL(/mes=12$/);

    await page.goto(`${PLATAFORMA}/moradores`);
    await noMenu(page, "Ações de Torre A · 102", "Histórico");
    await expect(page.getByRole("heading", { name: "Histórico da unidade" })).toBeVisible();
  });

  test("MU-11: a busca sugere etiquetas com a contagem e filtra a lista e as abas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    const busca = page.getByRole("searchbox", { name: "Buscar unidade" });
    await expect(busca).toHaveAttribute("placeholder", "Buscar por unidade, nome, telefone, placa ou etiqueta");
    await busca.click();
    const sugestoes = page.getByRole("group", { name: "Buscar por etiqueta" });
    await expect(sugestoes.getByRole("button", { name: /À venda\s*0 unidades/ })).toBeDisabled();
    await expect(sugestoes.getByRole("button", { name: /Aniversariante do mês\s*1 unidade/ })).toBeEnabled();
    await conferir(page);
    await busca.fill("aniversa");
    await expect(sugestoes.getByRole("button")).toHaveCount(1);
    await sugestoes.getByRole("button", { name: /Aniversariante do mês/ }).click();
    await expect(page).toHaveURL(/etiqueta=ANIVERSARIO/);
    await expect(page.getByRole("button", { name: "Tirar a etiqueta Aniversariante do mês" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Unidades" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Ocupação" }).getByRole("button", { name: "Todas 1" })).toBeVisible();
    await conferir(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Tirar a etiqueta Aniversariante do mês" })).toBeVisible();
    await page.getByRole("button", { name: "Tirar a etiqueta Aniversariante do mês" }).click();
    await expect(page.getByRole("list", { name: "Unidades" }).getByRole("listitem")).toHaveCount(5);

    // O nome de quem é da família acha a unidade.
    await busca.fill("Lucas");
    await expect(page.getByText("família: Lucas Lima")).toBeVisible();
    await expect(page.getByText("1 unidade encontrada")).toBeVisible();
  });

  test("MU-11: Aniversariantes abre pela aba Pessoas, de todas as unidades", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("tab", { name: "Pessoas" }).click();
    await page.getByRole("link", { name: "Aniversariantes do mês" }).click();
    await expect(page.getByRole("list", { name: "Aniversariantes de novembro" }).getByRole("listitem")).toHaveCount(2);
    await conferir(page);
  });
});

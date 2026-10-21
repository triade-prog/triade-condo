// Ajudas dos testes de Moradores e unidades no padrão novo (DC15): listas em cartões, ações
// em menus, filtros numa janela e o Cadastrar pessoa em passos no celular.
import type { Locator, Page } from "@playwright/test";

/** A linha (cartão no celular) de uma lista que tem o texto. */
export function linha(onde: Page | Locator, texto: string | RegExp): Locator {
  return onde.getByRole("listitem").filter({ hasText: texto });
}

/** Os nomes das unidades na lista, na ordem em que aparecem. */
export function nomesUnidades(page: Page): Promise<string[]> {
  return page.getByRole("list", { name: "Unidades" }).getByRole("link").allInnerTexts();
}

/** Abre o menu (pelo nome do botão) e escolhe o item. */
export async function noMenu(onde: Page | Locator, menu: string, item: string): Promise<void> {
  await onde.getByRole("button", { name: menu, exact: true }).click();
  const grupo = onde.getByRole("group", { name: menu, exact: true });
  await grupo.getByRole("button", { name: item, exact: true }).or(grupo.getByRole("link", { name: item, exact: true })).click();
}

/** Escolhe na janela Filtros e mostra as unidades. */
export async function filtrar(page: Page, campos: Record<string, string>): Promise<void> {
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const janela = page.getByRole("dialog", { name: "Filtrar unidades" });
  for (const [rotulo, valor] of Object.entries(campos)) await janela.getByLabel(rotulo, { exact: true }).selectOption({ label: valor });
  await janela.getByRole("button", { name: "Mostrar unidades" }).click();
}

/** No celular, o Cadastrar pessoa vai em passos: segue para o próximo, se houver. */
export async function seguir(janela: Locator): Promise<void> {
  const botao = janela.getByRole("button", { name: "Continuar" });
  if (await botao.isVisible()) await botao.click();
}

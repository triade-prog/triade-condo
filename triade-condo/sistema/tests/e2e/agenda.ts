import { expect, type Page } from "@playwright/test";

const celular = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Abre "Filtrar a agenda" (o tipo do compromisso; no celular, também o "Mostrar"). */
export async function abrirFiltros(page: Page) {
  const j = page.getByRole("dialog", { name: "Filtrar a agenda" });
  if (!(await j.isVisible())) await page.getByRole("button", { name: /^Filtros/ }).click();
  await expect(j).toBeVisible();
  return j;
}

export async function fecharFiltros(page: Page) {
  const j = page.getByRole("dialog", { name: "Filtrar a agenda" });
  if (await j.isVisible()) await j.getByRole("button", { name: "Pronto" }).click();
  await expect(j).toBeHidden();
}

/** Liga ou desliga uma origem em "Mostrar": à vista no computador, em Filtros no celular. */
export async function alternarOrigem(page: Page, nome: string) {
  const onde = celular(page) ? await abrirFiltros(page) : page;
  await onde.getByRole("group", { name: "O que mostrar na agenda" }).getByRole("button", { name: nome }).click();
  if (celular(page)) await fecharFiltros(page);
}

export async function origemLigada(page: Page, nome: string, ligada: boolean) {
  const onde = celular(page) ? await abrirFiltros(page) : page;
  await expect(onde.getByRole("group", { name: "O que mostrar na agenda" }).getByRole("button", { name: nome })).toHaveAttribute("aria-pressed", String(ligada));
  if (celular(page)) await fecharFiltros(page);
}

export async function filtrarTipo(page: Page, tipo: string) {
  const j = await abrirFiltros(page);
  await j.getByLabel("Tipo do compromisso").selectOption(tipo);
  await fecharFiltros(page);
}

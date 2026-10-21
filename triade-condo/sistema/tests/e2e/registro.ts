// Registrar pedido no padrão novo (DC15): no computador a janela é uma tela só; no celular são
// três passos com barra de progresso. Estes atalhos levam o teste ao passo certo nos dois e
// abrem o histórico completo da ficha.
import { expect, type Locator, type Page } from "@playwright/test";

/** Vai ao passo do registro (1 Quem pediu e onde, 2 O que aconteceu, 3 Como tratar). No computador, nada a fazer. */
export async function irAoPasso(j: Locator, celular: boolean, n: 1 | 2 | 3) {
  if (!celular) return;
  const barra = j.getByRole("progressbar", { name: "Passos do registro" });
  for (let i = 0; i < 3; i++) {
    const atual = Number(await barra.getAttribute("aria-valuenow"));
    if (atual === n) return;
    await j.getByRole("button", { name: atual < n ? "Continuar" : "Voltar", exact: true }).click();
  }
  await expect(barra).toHaveAttribute("aria-valuenow", String(n));
}

/** Escolhe a prioridade (Baixa, Normal, Alta, Urgente). */
export async function escolherPrioridade(j: Locator, nome: string) {
  await j.getByRole("group", { name: "Prioridade" }).getByRole("button", { name: nome }).click();
}

/** Quem foi avisado, na confirmação do registro. */
export const avisado = (j: Locator, quem: string) => j.getByRole("list", { name: "Quem foi avisado" }).getByRole("listitem").filter({ hasText: quem });

/** Abre o histórico completo da ficha, se ainda estiver fechado, e devolve a lista. */
export async function historicoCompleto(page: Page) {
  const lista = page.getByRole("list", { name: "Histórico completo" });
  if (!(await lista.isVisible())) await page.getByRole("button", { name: /Ver histórico completo/ }).click();
  await expect(lista).toBeVisible();
  return lista;
}

/** Abre "Mais ações" no topo da ficha e escolhe a ação. */
export async function maisAcoes(page: Page, nome: string) {
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("group", { name: "Mais ações" }).getByRole("button", { name: nome }).click();
}

/** Abre "Mais ações", se a ficha tiver o menu, para conferir o que a pessoa pode fazer. */
export async function abrirMaisAcoes(page: Page) {
  const botao = page.getByRole("button", { name: "Mais ações" });
  if (await botao.count()) await botao.click();
}

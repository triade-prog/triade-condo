// Início no padrão novo (DC15): no celular, os cartões "Por área" ficam fechados numa linha curta.
// Este atalho abre o cartão no celular (no computador ele já está aberto) e devolve a região.
import { expect, type Page } from "@playwright/test";

export async function abrirArea(page: Page, nome: string) {
  const area = page.getByRole("region", { name: nome, exact: true });
  const celular = (page.viewportSize()?.width ?? 1280) < 768;
  if (!celular) return area;
  // Agora e Hoje na agenda ficam sempre abertos; os outros abrem pelo botão com o nome do cartão.
  if (nome === "Agora" || nome === "Hoje na agenda") return area;
  const botao = area.getByRole("button", { name: nome, exact: true });
  await expect(botao).toBeVisible();
  if ((await botao.getAttribute("aria-expanded")) === "false") await botao.click();
  await expect(botao).toHaveAttribute("aria-expanded", "true");
  return area;
}

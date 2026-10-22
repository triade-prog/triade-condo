// Configurações por tarefa (decisão B.1): cada página grava pela barra fixa do rodapé.
import type { Page } from "@playwright/test";

export const barraSalvar = (page: Page) => page.getByRole("region", { name: "Mudanças ainda não salvas" });

export async function salvarPagina(page: Page) {
  await barraSalvar(page).getByRole("button", { name: "Salvar", exact: true }).click();
}

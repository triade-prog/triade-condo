// Área E do Console (0297; decisão E.2 de 24/10/2026; PI-20) com a API falsa: no chamado, a
// imagem que o cliente mandou aparece dentro da própria mensagem, com "Foto conferida · abrir", e
// abre numa aba; a TRÍADE só vê, ainda não anexa. Cada tela passa no axe (WCAG 2.2 AA) no celular
// e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";
import { CHAMADO } from "./api-falsa-console-suporte";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

test.describe("Console · área E (imagem na mensagem)", () => {
  test("E.2: a imagem fica dentro da mensagem do cliente e só abre", async ({ page }) => {
    const est = await instalarApiFalsa(page);
    const c = est.suporte.chamado;
    c.mensagens[0]!.imagens = [{ id: "9a0b1c2d-3e4f-4a5b-8c6d-0000000e2001", nome: "print-da-fila.png", tipo: "image/png" }];
    c.mensagens.push(
      { id: "9a0b1c2d-3e4f-4a5b-8c6d-0000000e2002", lado: "TRIADE", interna: false, autor: "Diego", texto: "Acontece com outra categoria?", criadoEm: new Date().toISOString() },
      { id: "9a0b1c2d-3e4f-4a5b-8c6d-0000000e2003", lado: "CLIENTE", interna: false, autor: "Bruna Alves", texto: "Também com Elevadores. Mandei as duas telas.",
        criadoEm: new Date().toISOString(), imagens: [
          { id: "9a0b1c2d-3e4f-4a5b-8c6d-0000000e2004", nome: "elevadores-antes.png", tipo: "image/png" },
          { id: "9a0b1c2d-3e4f-4a5b-8c6d-0000000e2005", nome: "elevadores-depois.png", tipo: "image/png" },
        ] },
    );
    await page.goto(`${CONSOLE}/chamados/${IPE}/${CHAMADO}`);
    const conversa = page.getByRole("list", { name: "Conversa" });
    const primeira = conversa.getByRole("listitem").filter({ hasText: "Escolho Limpeza" }).first();
    await expect(primeira.getByRole("button", { name: "print-da-fila.png Foto conferida · abrir" })).toBeVisible();
    const terceira = conversa.getByRole("listitem").filter({ hasText: "Também com Elevadores" }).first();
    await expect(terceira.getByRole("button", { name: /Foto conferida · abrir$/ })).toHaveCount(2);
    await expect(conversa.getByRole("listitem").filter({ hasText: "Acontece com outra categoria?" }).first().getByRole("button")).toHaveCount(0);
    // Não há mais a lista de imagens solta, nem como anexar do lado da TRÍADE.
    await expect(page.getByRole("region", { name: "Imagens do chamado" })).toHaveCount(0);
    await expect(page.getByText("Anexar imagem")).toHaveCount(0);
    await conferir(page);

    const aba = page.waitForEvent("popup");
    await terceira.getByRole("button", { name: "elevadores-depois.png Foto conferida · abrir" }).click();
    await expect.poll(async () => (await aba).url()).toContain("/api/v1/armazenamento/9a0b1c2d-3e4f-4a5b-8c6d-0000000e2005");
  });
});

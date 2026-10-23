// Ajuda e suporte na Plataforma (peça R4; PI-11, PI-17, PI-20; DC15, decisões C.1 e D.1) com a API
// falsa: abrir chamado com imagem numa janela, acompanhar a conversa e dizer que resolveu; decidir
// o acesso excepcional da TRÍADE em Agora, no Início, e ver o que ela pediu em Acesso da TRÍADE.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · Ajuda e suporte", () => {
  test("PI-17: a tela diz que é suporte do sistema, não reparo nem emergência", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Residencial Ipê");
    // No celular o menu abre pelo botão.
    if (await page.getByRole("button", { name: "Mais", exact: true }).isVisible()) await page.getByRole("button", { name: "Mais", exact: true }).click();
    await expect(page.getByRole("link", { name: "Ajuda e suporte" })).toBeVisible();
    await page.goto(`${PLATAFORMA}/suporte`);
    await expect(page.getByRole("heading", { level: 1, name: "Ajuda e suporte" })).toBeVisible();
    await expect(page.getByText(/Não é reparo nem canal de emergência/)).toBeVisible();
    // C.1: abertos e resolvidos em abas, com o número.
    await expect(page.getByRole("button", { name: /^Abertos/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Nenhum chamado aberto")).toBeVisible();
    await page.getByRole("button", { name: /^Resolvidos/ }).click();
    await expect(page.getByRole("link", { name: "Como mudar o horário sem envio?" })).toBeVisible();
    await conferir(page);
  });

  test("PI-20: abrir chamado com imagem e responder", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/suporte`);
    await page.getByRole("button", { name: "Abrir chamado" }).click();
    const janela = page.getByRole("dialog", { name: "Abrir chamado" });
    await janela.getByRole("button", { name: "Abrir chamado" }).click();
    await expect(janela.getByText("Escreva um título (3 a 120 caracteres).")).toBeVisible();
    await janela.getByLabel("Título").fill("Fila some depois de filtrar por categoria");
    await janela.getByLabel("O que aconteceu").fill("Escolho a categoria Limpeza e a lista fica vazia.");
    await janela.getByLabel("Escolher imagens").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(janela.getByText("print.png")).toBeVisible();
    await conferir(page);
    await janela.getByRole("button", { name: "Abrir chamado" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fila some depois de filtrar por categoria" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir print.png" })).toBeVisible();
    expect(estado.suporte.chamados[0]!.arquivos[0]!.situacao).toBe("LIBERADO");
    // A conversa em bolhas e a faixa quando a TRÍADE espera a resposta.
    await expect(page.getByRole("list", { name: "Conversa" })).toContainText("Escolho a categoria Limpeza");
    estado.suporte.chamados[0]!.mensagens.push({ id: "m-triade", lado: "TRIADE", autor: "Diego", texto: "Acontece com outra categoria?", criadoEm: new Date().toISOString() });
    estado.suporte.chamados[0]!.situacao = "ESPERANDO_CLIENTE";
    await page.reload();
    await expect(page.getByText("A TRÍADE espera a sua resposta")).toBeVisible();
    await page.getByLabel("Responder").fill("Acontece também em Manutenção.");
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Resposta enviada." })).toBeVisible();
    await expect(page.getByText("A TRÍADE espera a sua resposta")).toHaveCount(0);
    await conferir(page);
    await page.getByRole("button", { name: "Resolveu" }).click();
    await expect(page.getByText("Resolvido", { exact: true })).toBeVisible();
    await conferir(page);
  });

  test("PI-11: a síndica decide em Agora, no Início, e encerra quando quiser", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAcessoPedido: true });
    await page.goto(PLATAFORMA);
    const agora = page.getByRole("region", { name: "Agora", exact: true });
    await expect(agora).toContainText("A TRÍADE pediu para ver Pedidos por 24 horas");
    await conferir(page);
    await agora.getByRole("button", { name: "Decidir o pedido de Diego" }).click();
    const j = page.getByRole("dialog", { name: "Acesso da TRÍADE" });
    await expect(j).toContainText("Diego (suporte TRÍADE) quer ver Pedidos por 24 horas");
    await j.getByRole("button", { name: "Recusar" }).click();
    await expect(j.getByText("Para recusar, diga o motivo (3 a 500 caracteres).")).toBeVisible();
    expect(estado.suporte.acessos[0]!.situacao).toBe("PEDIDO");
    await conferir(page);
    await j.getByRole("button", { name: "Aprovar por 24 horas" }).click();
    await expect.poll(() => estado.suporte.acessos[0]!.situacao).toBe("APROVADO");
    await expect(agora).toContainText("Diego vê Pedidos até");
    await conferir(page);
    await agora.getByRole("button", { name: "Encerrar o acesso de Diego" }).click();
    await expect.poll(() => estado.suporte.acessos[0]!.situacao).toBe("ENCERRADO");
    await expect(agora).not.toContainText("Diego vê Pedidos até");
  });

  test("D.1: Acesso da TRÍADE guarda o que ela pediu nos últimos 30 dias", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAcessoPedido: true });
    await page.goto(`${PLATAFORMA}/suporte`);
    await page.getByRole("navigation", { name: "Partes de ajuda e suporte" }).getByRole("link", { name: "Acesso da TRÍADE" }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/suporte/acesso`);
    const historico = page.getByRole("region", { name: "Últimos 30 dias" });
    await expect(historico.getByRole("listitem").filter({ hasText: "Paula" })).toContainText("recusado por Ana Souza: “Pode ver comigo em reunião.”");
    await expect(historico.getByRole("listitem").filter({ hasText: "Moradores por 4 horas" })).toContainText("encerrado por Ana Souza");
    await expect(page.getByRole("region", { name: "Valendo agora" })).toContainText("Nenhum acesso da TRÍADE valendo agora.");
    await page.getByRole("region", { name: "Esperando você" }).getByRole("button", { name: "Decidir o pedido de Diego" }).click();
    await page.getByRole("dialog", { name: "Acesso da TRÍADE" }).getByRole("button", { name: "Aprovar por 24 horas" }).click();
    await expect(page.getByRole("region", { name: "Valendo agora" })).toContainText("Diego vê Pedidos até");
    await expect(page.getByRole("region", { name: "Valendo agora" })).toContainText("aprovado por Ana Souza");
    await conferir(page);
  });

  test("D.1: quem não aprova não vê a parte Acesso da TRÍADE", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/suporte`);
    await expect(page.getByRole("heading", { level: 1, name: "Ajuda e suporte" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Partes de ajuda e suporte" })).toHaveCount(0);
  });
});

// Console no padrão novo (DC15, rodada Console de 23/10/2026; PI-01, V-10, PI-04, PI-05, PI-09,
// PI-20, W-01) com a API falsa: o Início com o Agora, a carteira com filtro e busca, a ficha em seis
// partes com Mais ações, o Resumo para o síndico fora da moldura e a barra de baixo no celular.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";
import { CHAMADO } from "./api-falsa-console-suporte";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Console · padrão novo", () => {
  test("B.1: o Console abre no Início, com o Agora juntando o que pede atenção", async ({ page }, info) => {
    await instalarApiFalsa(page);
    await page.goto(CONSOLE);
    await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Carolina$/ })).toBeVisible();
    // No celular a faixa fica curta, sem o resumo da carteira.
    const resumo = page.getByText("1 cliente na sua carteira · 1 em implantação");
    await (info.project.name === "celular" ? expect(resumo).toBeHidden() : expect(resumo).toBeVisible());
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora).toContainText("1 chamado sem responsável");
    await expect(agora).toContainText("1 pedido de acesso para verificar");
    await expect(agora).toContainText("1 pendência de implantação vencida");
    await expect(agora).toContainText("1 número sem credenciais");
    await expect(page.getByRole("region", { name: "Implantações em andamento" })).toContainText("Residencial Ipê");
    await conferir(page);

    // Assumir ali mesmo abre a conversa.
    await agora.getByRole("button", { name: "Assumir o chamado Fila some depois de filtrar por categoria" }).click();
    await expect(page).toHaveURL(new RegExp(`/chamados/${IPE}/${CHAMADO}`));
    await expect(page.getByRole("heading", { level: 1, name: "Fila some depois de filtrar por categoria" })).toBeVisible();
  });

  test("V-10: a carteira busca sem acento e filtra pelas situações a tratar", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes?filtro=tratar`);
    await expect(page.getByRole("button", { name: "Com situações a tratar 1", pressed: true })).toBeVisible();
    const busca = page.getByLabel("Buscar na carteira");
    await busca.fill("ipe");
    await expect(page.getByRole("listitem").filter({ hasText: "Residencial Ipê" })).toBeVisible();
    await busca.fill("jatoba");
    await expect(page.getByText('Nenhum cliente com "jatoba" aqui')).toBeVisible();
    await conferir(page);
    // A busca do alto da tela leva à carteira com o que foi escrito.
    await page.goto(`${CONSOLE}/clientes?q=Bras%C3%ADlia`);
    await expect(busca).toHaveValue("Brasília");
    await expect(page.getByRole("listitem").filter({ hasText: "Residencial Ipê" })).toBeVisible();
  });

  test("A.1 e D.1: a ficha em sete partes (com Plano e pagamentos, 0291), os links antigos e Mais ações", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}?aba=sindico`);
    const partes = page.getByRole("tablist", { name: "Partes da ficha" }).getByRole("tab");
    await expect(partes).toHaveText(["Visão geral", "Implantação", "Configuração", "Plano e pagamentos", "Pessoas", "WhatsApp", "Notas e histórico"]);
    await expect(page.getByRole("tab", { name: "Pessoas", selected: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Equipe TRÍADE neste cliente" })).toContainText("Carolina");
    await conferir(page);

    await page.getByRole("button", { name: "Mais ações" }).click();
    const mais = page.getByRole("group", { name: "Mais ações" });
    await expect(mais.getByRole("link", { name: "Resumo para o síndico" })).toHaveAttribute("target", "_blank");
    await conferir(page);
    await mais.getByRole("link", { name: "Acesso excepcional" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Acesso excepcional" })).toBeVisible();
  });

  test("D.1: o Resumo para o síndico abre fora da moldura, como prévia de impressão", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}/resumo-configuracao`);
    await expect(page.getByRole("heading", { level: 1, name: "Resumo para o síndico" })).toBeVisible();
    await expect(page.getByText("Como o condomínio vai funcionar na TRÍADE Condo")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Console" })).toHaveCount(0);
    await conferir(page);
  });

  test("No celular, Início, Clientes e Chamados ficam na barra de baixo e o resto em Mais", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "Só no celular");
    await instalarApiFalsa(page);
    await page.goto(CONSOLE);
    const barra = page.getByRole("navigation", { name: "Atalhos" });
    await expect(barra.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
    await expect(barra.getByRole("link", { name: /^Clientes/ })).toBeVisible();
    await expect(barra.getByRole("link", { name: "Chamados 1 em aberto" })).toBeVisible();
    await barra.getByRole("button", { name: /^Mais/ }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Pessoas e funções" })).toBeVisible();
    await conferir(page);
    await menu.getByRole("link", { name: /^Suporte de acesso/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Suporte de acesso" })).toBeVisible();
  });
});

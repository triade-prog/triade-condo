// Pedir mudança à TRÍADE (item 8 do novo frontend, 0286; PI-04, CF-09, PI-20; DC15, decisões A.1,
// B.1 e C.1 de 23/10/2026) com as APIs falsas: a janela na própria Configuração, a linha que mostra
// a mudança pedida, o tipo próprio em Ajuda e suporte e, no Console, o filtro Mudanças e o cartão
// Mudança pedida. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { instalarApiFalsa, IPE } from "./api-falsa";
import { CHAMADO_MUDANCA } from "./api-falsa-console-suporte";

const PLATAFORMA = "http://localhost:3000";
const CONSOLE = "http://localhost:3001";
const PEDIDO = "Mudar para o horário de Manaus: o condomínio fica em Manaus e os prazos estão contando uma hora adiantados.";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Pedir mudança à TRÍADE", () => {
  test("A.1 e B.1: pede ali mesmo, e a linha passa a mostrar a mudança pedida", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/horarios`);
    const bloco = page.getByRole("region", { name: "Feito pela TRÍADE" });
    await expect(bloco).toContainText("Peça aqui mesmo; a resposta chega no sino e em Ajuda e suporte.");
    await bloco.getByRole("button", { name: "Pedir mudança" }).click();
    const janela = page.getByRole("dialog", { name: "Pedir mudança à TRÍADE" });
    await expect(janela).toContainText("Fuso do condomínio");
    await expect(janela).toContainText("Brasília (UTC−3)");
    await janela.getByRole("button", { name: "Pedir a mudança" }).click();
    await expect(janela.getByText("Diga o que precisa e por quê.")).toBeVisible();
    await janela.getByLabel("O que precisa e por quê").fill(PEDIDO);
    await conferir(page);
    await janela.getByRole("button", { name: "Pedir a mudança" }).click();
    await expect(janela).toHaveCount(0);

    // A mesma linha agora diz que já foi pedido e leva ao chamado; não oferece pedir de novo.
    await expect(bloco.getByText("Mudança pedida")).toBeVisible();
    await expect(bloco.getByText("Com a TRÍADE")).toBeVisible();
    await expect(bloco.getByRole("button", { name: "Pedir mudança" })).toHaveCount(0);
    const c = estado.suporte.chamados[0]!;
    expect([c.tipo, c.area, c.titulo, c.parte, c.hoje]).toEqual(["MUDANCA", "CONFIGURACOES", "Mudar: Fuso do condomínio", "FUSO", "Brasília (UTC−3)"]);
    await conferir(page);

    // O chamado tem o cartão Mudança pedida, com o caminho de volta à Configuração.
    await bloco.getByRole("link", { name: `Ver chamado ${c.numero}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mudar: Fuso do condomínio" })).toBeVisible();
    const cartao = page.getByRole("region", { name: "Mudança pedida" });
    await expect(cartao).toContainText("Fuso do condomínio");
    await expect(cartao).toContainText("Brasília (UTC−3)");
    await expect(page.getByRole("list", { name: "Conversa" })).toContainText(PEDIDO);
    await conferir(page);
    await cartao.getByRole("link", { name: "Ver em Configurações › Horários" }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/horarios`);
  });

  test("A.1: Ajuda e suporte mostra o tipo próprio, e o Abrir chamado aponta para o Pedir mudança", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    estado.suporte.chamados.unshift({
      id: "8c9d0e1f-2a3b-4c4d-9e5f-a00000000001", numero: 2, tipo: "MUDANCA", area: "CONFIGURACOES", titulo: "Mudar: Etapas dos pedidos",
      situacao: "ESPERANDO_CLIENTE", abertoPor: "Ana Souza", criadoEm: new Date().toISOString(), parte: "ETAPAS_PEDIDOS", hoje: "6 etapas ativas", arquivos: [],
      mensagens: [{ id: "m1", lado: "CLIENTE", autor: "Ana Souza", texto: "Tirar a etapa Orçamento.", criadoEm: new Date().toISOString() }],
    });
    await page.goto(`${PLATAFORMA}/suporte`);
    await expect(page.getByText(/Dúvidas, problemas e pedidos de mudança no que a TRÍADE configurou/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Mudar: Etapas dos pedidos" })).toContainText("Mudança de configuração · Configurações");
    await conferir(page);
    await page.getByRole("button", { name: "Abrir chamado" }).first().click();
    const janela = page.getByRole("dialog", { name: "Abrir chamado" });
    await expect(janela.getByRole("group", { name: "Tipo do chamado" }).getByRole("button")).toHaveText(["Dúvida", "Problema", "Sugestão"]);
    await expect(janela).toContainText("Quer mudar algo que a TRÍADE configurou?");
    await expect(janela.getByRole("link", { name: "Ir para Configurações" })).toHaveAttribute("href", "/configuracoes");
    await conferir(page);

    // Nas Etapas, a faixa do alto diz que a TRÍADE espera a resposta.
    await page.goto(`${PLATAFORMA}/configuracoes/etapas`);
    await expect(page.getByText("Esperando você")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver chamado 2" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedir mudança" })).toHaveCount(0);
  });

  test("C.1: o Console filtra as mudanças e mostra a parte e o valor de hoje", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    const agora = new Date().toISOString();
    estado.suporte.mudanca = {
      id: CHAMADO_MUDANCA, condominioId: IPE, condominio: "Residencial Ipê", numero: 3, tipo: "MUDANCA", area: "CONFIGURACOES", titulo: "Mudar: Fuso do condomínio",
      situacao: "NOVO", abertoPor: "Ana Souza", imagens: 0, atualizadoEm: agora, versao: 1, parte: "FUSO", hoje: "Horário de Brasília",
      mensagens: [{ id: "m1", lado: "CLIENTE", interna: false, autor: "Ana Souza", texto: PEDIDO, criadoEm: agora }],
    };
    await page.goto(`${CONSOLE}/chamados`);
    await expect(page.getByRole("link", { name: "Fila some depois de filtrar por categoria" })).toBeVisible();
    await expect(page.getByText("1 pedido de mudança aberto", { exact: true })).toBeVisible();
    await page.getByRole("group", { name: "Tipo de chamado" }).getByRole("button", { name: "Mudanças" }).click();
    await expect(page).toHaveURL(`${CONSOLE}/chamados?tipo=MUDANCA`);
    await expect(page.getByRole("link", { name: "Fila some depois de filtrar por categoria" })).toHaveCount(0);
    const linha = page.getByRole("listitem").filter({ hasText: "Mudar: Fuso do condomínio" });
    await expect(linha).toContainText("Residencial Ipê · Mudança de configuração · Configurações");
    await conferir(page);

    await linha.getByRole("link", { name: "Mudar: Fuso do condomínio" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mudar: Fuso do condomínio" })).toBeVisible();
    const cartao = page.getByRole("region", { name: "Mudança pedida" });
    await expect(cartao).toContainText("Fuso do condomínio");
    await expect(cartao).toContainText("Horário de Brasília");
    await expect(cartao.getByRole("link", { name: "Abrir a Configuração do cliente" })).toHaveAttribute("href", `/clientes/${IPE}?aba=configuracao`);
    await conferir(page);
  });
});

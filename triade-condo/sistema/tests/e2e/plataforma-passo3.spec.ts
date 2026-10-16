// Passo 3 (F3): moradores e unidades na Plataforma do síndico, com a API falsa. Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador, só mostra o que a pessoa pode fazer
// (CF-03) e não usa emoji nem emoticon.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A101, A102 } from "./api-falsa-moradores";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirMenu(page: Page) {
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole("navigation", { name: "Plataforma" });
}

test.describe("Plataforma do síndico · passo 3", () => {
  test("MU-02: o início resume os moradores e leva ao que falta conferir", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    const cartao = page.getByRole("region", { name: "Moradores e unidades" });
    await expect(cartao).toContainText("5 unidades cadastradas");
    await expect(cartao).toContainText("1 contato a confirmar");
    await expect(cartao).toContainText("3 unidades sem contato confirmado");
    await conferir(page);
    await cartao.getByRole("link", { name: "Conferir" }).click();
    await expect(page.getByRole("tab", { name: "A confirmar (1)", selected: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Paulo Lima/ })).toContainText("Torre A · 102");
  });

  test("F3.1: unidades por bloco em ordem natural; novo bloco com unidades geradas pela numeração", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await expect(page.getByRole("heading", { level: 1, name: "Moradores e unidades" })).toBeVisible();
    await page.getByRole("group", { name: "Mostrar unidades" }).getByRole("button", { name: "Torre A" }).click();
    const nomes = await page.getByRole("table").locator("tbody tr td:first-child").allInnerTexts();
    expect(nomes).toEqual(["101", "102", "201", "1001"]);
    await expect(page.getByRole("row", { name: /^102/ })).toContainText("1 a confirmar");
    await conferir(page);

    await page.getByRole("button", { name: "+ Bloco" }).click();
    await page.getByRole("dialog", { name: "Novo bloco" }).getByLabel("Nome do bloco").fill("Torre C");
    await page.getByRole("button", { name: "Criar bloco" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bloco Torre C criado." })).toBeVisible();

    await page.getByRole("button", { name: "+ Unidades" }).click();
    const janela = page.getByRole("dialog", { name: "Incluir unidades" });
    await janela.getByLabel("Bloco").selectOption({ label: "Torre C" });
    await janela.getByRole("button", { name: "Gerar pela numeração" }).click();
    await janela.getByLabel("Até o andar").fill("2");
    await janela.getByLabel("Por andar").fill("2");
    await expect(janela).toContainText("101, 102, 201, 202");
    await conferir(page);
    await janela.getByRole("button", { name: "Incluir 4 unidades" }).click();
    await expect(page.getByRole("status").filter({ hasText: "4 unidades incluídas." })).toBeVisible();

    await page.getByRole("button", { name: "+ Unidades" }).click();
    await janela.getByLabel("Bloco").selectOption({ label: "Torre C" });
    await janela.getByLabel("Unidades").fill("101, 301");
    await expect(janela).toContainText("101 já existe e fica como está");
    await janela.getByRole("button", { name: "Incluir 1 unidade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 unidade incluída. 1 já existia" })).toBeVisible();
  });

  test("MU-01, MU-03 e MU-08: ficha da unidade, telefone compartilhado, confirmar e incluir contato", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 102" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "O telefone de Joana Lima e Paulo Lima também está em outro contato" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Paulo Lima/ })).toContainText("A confirmar");
    await conferir(page);
    await page.getByRole("button", { name: "Confirmar Paulo Lima" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Paulo Lima confirmado." })).toBeVisible();
    await expect(page.getByRole("row", { name: /Paulo Lima/ })).toContainText("Confirmado");

    await page.getByRole("button", { name: "+ Contato" }).click();
    const janela = page.getByRole("dialog", { name: "Incluir contato · Torre A · 102" });
    await janela.getByLabel("Nome").fill("Rita Lima");
    await janela.getByLabel("Telefone (WhatsApp)").fill("9999");
    await janela.getByLabel("Relação com a unidade").selectOption({ label: "Familiar ou cônjuge" });
    await janela.getByRole("button", { name: "Incluir contato" }).click();
    await expect(janela.getByText("Telefone com DDD, como (61) 99999-0000.")).toBeVisible();
    await conferir(page);
    await janela.getByLabel("Telefone (WhatsApp)").fill("(61) 97777-1234");
    await janela.getByRole("button", { name: "Incluir contato" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rita Lima incluído na unidade." })).toBeVisible();
    await expect(page.getByRole("row", { name: /Rita Lima/ })).toContainText("+55 61 97777-1234");

    await page.getByRole("button", { name: "Editar Joana Lima" }).click();
    await page.getByRole("dialog", { name: "Editar Joana Lima" }).getByLabel("Recebe comunicados do condomínio").uncheck();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("row", { name: /Joana Lima/ })).toContainText("não recebe comunicados");
  });

  test("MU-07 e PT-11: mudança com quem sai e quem entra; depois, remover os dados de quem saiu", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 101" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar mudança" }).click();
    const janela = page.getByRole("dialog", { name: "Registrar mudança · Torre A · 101" });
    await janela.getByLabel("Pedro Souza · familiar ou cônjuge").check();
    await expect(janela).toContainText("Ficam: Marina Souza.");
    await janela.getByLabel("Nome da pessoa 1").fill("Caio Nunes");
    await janela.getByLabel("Telefone da pessoa 1").fill("61966660001");
    await conferir(page);
    await janela.getByRole("button", { name: "Registrar mudança" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Mudança registrada: 1 saiu, 1 entrou." })).toBeVisible();
    await expect(page.getByRole("row", { name: /Caio Nunes/ })).toContainText("Inquilino · principal");
    const anteriores = page.getByRole("region", { name: "Anteriores" });
    await expect(anteriores).toContainText("Pedro Souza");
    await expect(anteriores).toContainText("mudou-se em");

    await anteriores.getByRole("button", { name: "Remover os dados de Pedro Souza" }).click();
    await page.getByRole("dialog", { name: "Remover os dados de Pedro Souza" }).getByRole("button", { name: "Remover dados" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Dados pessoais removidos." })).toBeVisible();
    await expect(anteriores).toContainText("Dados removidos");
    await expect(anteriores).not.toContainText("Pedro Souza");
    await conferir(page);
  });

  test("MU-02: a confirmar com seleção; recusar quem não se reconhece", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const m = estado.moradores;
    m.contatos.push({ id: "8b9c0d1e-2f3a-4b4c-9d5e-c00000000001", nome: "Padaria Sol", telefone: "+556133330000", versao: 1 });
    m.vinculos.push({ id: "8b9c0d1e-2f3a-4b4c-9d5e-d00000000001", contatoId: "8b9c0d1e-2f3a-4b4c-9d5e-c00000000001", unidadeId: m.unidades[4]!.id,
      relacao: "OUTRO", principal: false, recebeComunicados: true, estado: "PENDENTE", origem: "PLANILHA", criadoEm: "2026-10-16T15:00:00Z", versao: 1 });
    await page.goto(`${PLATAFORMA}/moradores?aba=confirmar`);
    await expect(page.getByRole("tab", { name: "A confirmar (2)", selected: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Contato a confirmar não recebe nada e não acessa nada." })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Recusar Padaria Sol" }).click();
    await page.getByRole("dialog", { name: "Recusar Padaria Sol" }).getByRole("button", { name: "Recusar contato" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Padaria Sol recusado em Loja 2." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "A confirmar (1)", selected: true })).toBeVisible();
    await page.getByLabel("Marcar todos desta página").check();
    await page.getByRole("button", { name: "Confirmar 1 selecionado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Contato confirmado." })).toBeVisible();
    await expect(page.getByText("Nenhum contato esperando confirmação")).toBeVisible();
  });

  test("F3.3: importar planilha com a prévia das linhas erradas; os contatos ficam a confirmar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("link", { name: "Importar planilha" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Importar planilha" })).toBeVisible();
    await conferir(page);
    const csv = "Torre;Apto;Nome;Celular;Tipo\r\nTorre D;11;Lia Reis;(61) 97777-0002;Inquilina\r\nTorre D;;Sem Unidade;123;\r\nTorre D;12;Rui Alves;61977770001;proprietário\r\n";
    await page.getByLabel("Arquivo da planilha (CSV)").setInputFiles({ name: "moradores.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
    await expect(page.getByText("2 prontas", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /^3/ })).toContainText("Unidade em branco");
    await expect(page.getByRole("row", { name: /^3/ })).toContainText("Telefone incompleto");
    await conferir(page);
    await page.getByRole("button", { name: "Importar 2 contatos" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Importados: 1 bloco novo, 2 unidades novas, 2 contatos a confirmar." })).toBeVisible();
    expect(estado.moradores.importacoes).toHaveLength(1);
    await page.getByRole("link", { name: "Conferir os contatos a confirmar" }).click();
    await expect(page.getByRole("tab", { name: "A confirmar (3)", selected: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Lia Reis/ })).toContainText("Torre D · 11");
  });

  test("CF-03: quem tem Cadastrar moradores inclui, mas não confirma; quem só vê não tem a parte", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/moradores?aba=confirmar`);
    await expect(page.getByRole("status").filter({ hasText: "Só o síndico confirma." })).toBeVisible();
    await expect(page.getByLabel("Marcar todos desta página")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Recusar/ })).toHaveCount(0);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await page.getByRole("button", { name: "+ Contato" }).click();
    const janela = page.getByRole("dialog", { name: "Incluir contato · Torre A · 101" });
    await janela.getByLabel("Nome").fill("Teo Dias");
    await janela.getByLabel("Telefone (WhatsApp)").fill("61955550001");
    await janela.getByRole("button", { name: "Incluir contato" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Teo Dias incluído na unidade. Fica a confirmar pelo síndico." })).toBeVisible();
    await expect(page.getByRole("row", { name: /Teo Dias/ })).toContainText("A confirmar");
    await expect(page.getByRole("button", { name: "Confirmar Teo Dias" })).toHaveCount(0);

    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(PLATAFORMA);
    const menu = await abrirMenu(page);
    await expect(menu.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Moradores e unidades" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Moradores e unidades" })).toHaveCount(0);
  });
});

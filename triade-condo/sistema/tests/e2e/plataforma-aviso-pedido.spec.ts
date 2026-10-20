// Aviso de pedido registrado (F6.4, AT-26; W-08, W-11, CD-02) com a API falsa: o bloco
// Quem avisar no registro, que já vem pelas regras e muda com a prioridade e o responsável; o
// prestador e os moradores afetados só quando quem registra escolhe e vê a mensagem; a
// confirmação com quem soube e por onde; o cartão Avisos do registro no pedido; e a regra do
// síndico em Configurações. No celular, o bloco abre num resumo. Cada tela passa no axe
// (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirRegistro(page: Page) {
  await page.goto(`${PLATAFORMA}/pedidos`);
  await page.getByRole("button", { name: "+ Registrar pedido" }).first().click();
  return page.getByRole("dialog", { name: "Registrar pedido" });
}

/** No celular, o bloco mostra só quantos ficam sabendo até a pessoa abrir. */
async function abrirQuemAvisar(qa: Locator, celular: boolean, resumo: string, nomes: string) {
  if (!celular) return;
  await expect(qa.getByText(resumo, { exact: true })).toBeVisible();
  await expect(qa.getByText(nomes, { exact: true })).toBeVisible();
  await qa.getByRole("button", { name: "Ver e mudar" }).click();
}

const linha = (tabela: Locator, quem: string) => tabela.getByRole("row").filter({ hasText: quem });

test.describe("Plataforma · aviso de pedido registrado", () => {
  test("AT-26, W-08: quem registra vê quem fica sabendo; o protocolo vai a quem pediu e o síndico entra pela regra no urgente", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA", comAtendimento: true, secretariaRegistra: true });
    const j = await abrirRegistro(page);
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await j.getByLabel("Quem pediu").selectOption({ label: "Marina Souza · proprietário (condômino)" });
    await j.getByLabel("Assunto").fill("Interfone mudo");
    await j.getByLabel("O que foi relatado").fill("O interfone da 101 não toca desde ontem.");
    await j.getByLabel("Responsável", { exact: true }).selectOption({ label: "Eu" });
    const qa = j.getByRole("region", { name: "Quem avisar" });
    await abrirQuemAvisar(qa, isMobile, "Quem avisar: 1", "Marina Souza (protocolo)");

    await expect(qa.getByLabel("Marina Souza, quem pediu")).toBeChecked();
    await expect(qa.getByText("Protocolo pelo WhatsApp do condomínio")).toBeVisible();
    await qa.getByRole("button", { name: "ver mensagem" }).click();
    await expect(qa.getByText("Olá, Marina. Registramos seu pedido [nº do protocolo] (Torre A · 101): Interfone mudo.")).toBeVisible();
    await expect(qa.getByText("É você: nada sai")).toBeVisible();
    const sindico = qa.getByLabel("Ana Souza, síndico");
    await expect(sindico).not.toBeChecked();
    await expect(qa.getByText("Pela regra do condomínio, só pedido sem responsável ou urgente. Marque para avisar mesmo assim.")).toBeVisible();
    // Sem a permissão de comunicados, a linha dos moradores afetados não aparece.
    await expect(qa.getByText("Moradores afetados")).toHaveCount(0);
    await expect(j.getByRole("button", { name: "Registrar e avisar 1" })).toBeVisible();

    await j.getByLabel("Prioridade").selectOption({ label: "Urgente" });
    await expect(sindico).toBeChecked();
    await expect(sindico).toBeDisabled();
    await expect(qa.getByText("Pedido urgente · no sino e no WhatsApp da pessoa, que ligou o aviso de pedido novo")).toBeVisible();
    await expect(qa.getByText("pela regra", { exact: true })).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Registrar e avisar 2" }).click();

    await expect(j.getByText("Pedido 2026-0004 registrado")).toBeVisible();
    const tabela = j.getByRole("table", { name: "Quem foi avisado" });
    await expect(linha(tabela, "Marina Souza, quem pediu")).toContainText("WhatsApp");
    await expect(linha(tabela, "Marina Souza, quem pediu")).toContainText("Na fila");
    const ana = linha(tabela, "Ana Souza, síndico");
    await expect(ana).toHaveCount(2);
    await expect(ana.first()).toContainText("pela regra");
    await expect(ana.first()).toContainText("No sino");
    await expect(ana.nth(1)).toContainText("Sai ");
    await expect(j.getByText("O WhatsApp de quem atende espera o horário de funcionamento. O sino já avisou.")).toBeVisible();
    await conferir(page);

    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /2026-0004 · Interfone mudo/ })).toBeVisible();
    const cartao = page.getByRole("region", { name: "Avisos do registro" });
    await expect(cartao.getByRole("listitem").filter({ hasText: "Marina Souza" })).toContainText("Na fila");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Ana Souza" })).toContainText("sino e WhatsApp · pela regra");
    await conferir(page);
  });

  test("AT-26, CD-02: o prestador e os moradores afetados só com a mensagem à vista, sem dado de morador", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const j = await abrirRegistro(page);
    await j.getByRole("button", { name: "Em área comum" }).click();
    await j.getByLabel("Local").fill("Casa de bombas");
    await j.getByLabel("Prioridade").selectOption({ label: "Alta" });
    await j.getByLabel("Assunto").fill("Bomba vazando");
    await j.getByLabel("O que foi relatado").fill("Água no piso da casa de bombas.");
    await j.getByLabel("Responsável", { exact: true }).selectOption({ label: "Bruna" });
    const qa = j.getByRole("region", { name: "Quem avisar" });
    await abrirQuemAvisar(qa, isMobile, "Quem avisar: 1", "Bruna");

    await expect(qa.getByText("Registrado sem contato, ninguém para avisar")).toBeVisible();
    await expect(qa.getByLabel("Bruna, responsável")).toBeChecked();
    await expect(qa.getByText("Ninguém de fora é avisado sem você escolher e ver a mensagem.")).toBeVisible();

    await qa.getByRole("button", { name: "+ Escolher" }).click();
    await expect(qa.getByRole("button", { name: "Escolher Bombas Litoral" })).toBeDisabled();
    await expect(qa.getByText("Bombas · sem celular nem e-mail no cadastro")).toBeVisible();
    await qa.getByLabel("Escolher o prestador").fill("bomba");
    await expect(qa.getByRole("button", { name: "Escolher Aqualimp" })).toHaveCount(0);
    await expect(qa.getByText("Bombas e pressurização · reserva: Bombas Litoral · WhatsApp")).toBeVisible();
    await conferir(page);
    await qa.getByRole("button", { name: "Escolher HidroPress Bombas" }).click();
    // Só a mensagem, como antes do link do serviço (F6.7 tem o próprio teste).
    await qa.getByLabel("Mandar o link do serviço").uncheck();
    await expect(qa.getByText("WhatsApp do condomínio para +55 13 9••••-4455")).toBeVisible();
    await expect(qa.getByText("Residencial Ipê · pedido [nº do protocolo] (alta)")).toBeVisible();
    const mensagem = qa.getByLabel("Mensagem ao prestador");
    await expect(mensagem).toHaveValue("Casa de bombas: Bomba vazando.\n\nÁgua no piso da casa de bombas.\n\nPara combinar, fale com Ana, do condomínio.");
    await mensagem.fill("Casa de bombas: bomba vazando. Ligue para a moradora no (61) 99999-0001.");
    await expect(qa.getByText("Tire o nome, o telefone ou o e-mail de morador: não vão para o prestador.")).toBeVisible();
    await expect(qa.getByText("Há dado de morador num texto editado. Tire antes de registrar, ou o registro é recusado.")).toBeVisible();
    await mensagem.fill("Casa de bombas: bomba vazando, água no piso. Precisamos de visita hoje.");
    await expect(qa.getByText("Tire o nome, o telefone ou o e-mail de morador: não vão para o prestador.")).toHaveCount(0);

    await qa.getByRole("button", { name: "+ Avisar" }).click();
    await expect(qa.getByText("5 unidades · comunicado por e-mail e no mural")).toBeVisible();
    await expect(qa.getByLabel("Título do comunicado")).toHaveValue("Bomba vazando");
    await expect(qa.getByLabel("Comunicado", { exact: true }))
      .toHaveValue("Bomba vazando (Casa de bombas). O condomínio já sabe e está cuidando. Avisaremos quando for resolvido.");
    await qa.getByRole("group", { name: "Para quem" }).getByRole("button", { name: "Blocos" }).click();
    await qa.getByLabel("Torre A").check();
    await expect(qa.getByText("Moradores de Torre A")).toBeVisible();
    await expect(qa.getByText("4 unidades · comunicado por e-mail ·")).toBeVisible();
    await expect(j.getByRole("button", { name: "Registrar e avisar 3" })).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Registrar e avisar 3" }).click();

    await expect(j.getByText("Pedido 2026-0004 registrado")).toBeVisible();
    const tabela = j.getByRole("table", { name: "Quem foi avisado" });
    await expect(linha(tabela, "Bruna, responsável")).toContainText("No sino");
    await expect(linha(tabela, "HidroPress Bombas, prestador")).toContainText("WhatsApp");
    await expect(linha(tabela, "Moradores · Torre A")).toContainText("E-mail");
    await expect(linha(tabela, "Moradores · Torre A")).toContainText("Publicado · 1 e-mail");
    await conferir(page);

    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Bomba vazando/ })).toBeVisible();
    await expect(page.getByText("prestador HidroPress Bombas")).toBeVisible();
    const cartao = page.getByRole("region", { name: "Avisos do registro" });
    await expect(cartao.getByRole("listitem").filter({ hasText: "HidroPress Bombas" })).toContainText("WhatsApp · texto editado");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Torre A" })).toContainText("Publicado · 1 e-mail");
    await conferir(page);
  });

  test("AT-26: pedido privado não mostra prestador nem moradores afetados", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const j = await abrirRegistro(page);
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 102" });
    await j.getByLabel("Assunto").fill("Barulho à noite");
    await j.getByLabel("O que foi relatado").fill("Vizinho de cima faz barulho depois das 22h.");
    await j.getByLabel("Pedido privado").check();
    const qa = j.getByRole("region", { name: "Quem avisar" });
    await expect(qa.getByText("Pedido privado: prestador e moradores afetados não aparecem.")).toBeVisible();
    if (isMobile) await qa.getByRole("button", { name: "Ver e mudar" }).click();
    await expect(qa.getByRole("button", { name: "+ Escolher" })).toHaveCount(0);
    await expect(qa.getByRole("button", { name: "+ Avisar" })).toHaveCount(0);
    await conferir(page);
  });

  test("AT-26: só o síndico muda quando fica sabendo de pedido novo e se o protocolo sai", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=prazos`);
    const cartao = page.getByRole("region", { name: "Pedido novo" });
    const regra = cartao.getByRole("radiogroup", { name: "Avisar o síndico" });
    await expect(regra.getByRole("radio", { name: "Sem responsável ou urgente" })).toBeChecked();
    await regra.getByRole("radio", { name: "Todos os pedidos" }).click();
    await expect(regra.getByRole("radio", { name: "Todos os pedidos" })).toBeChecked();
    await cartao.getByLabel("Mandar o protocolo para quem pediu").uncheck();
    await conferir(page);
    await cartao.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Regra de pedido novo salva." })).toBeVisible();
    expect(estado.avisoRegistro.regra).toEqual({ sindico: "TODOS", protocolo: false });
  });

  test("AT-26: quem configura sem ser síndico lê a regra de pedido novo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA", comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=prazos`);
    const cartao = page.getByRole("region", { name: "Pedido novo" });
    await expect(cartao).toContainText("Avisar o síndico: sem responsável ou urgente");
    await expect(cartao).toContainText("Protocolo para quem pediu: ligado");
    await expect(cartao).toContainText("Só o síndico muda esta regra.");
    await expect(cartao.getByRole("radiogroup")).toHaveCount(0);
    await conferir(page);
  });
});

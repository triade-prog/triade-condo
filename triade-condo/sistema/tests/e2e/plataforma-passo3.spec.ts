// Passo 3 (F3): moradores e unidades na Plataforma do síndico, com a API falsa. Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador, só mostra o que a pessoa pode fazer
// (CF-03) e não usa emoji nem emoticon.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { A101, A102 } from "./api-falsa-moradores";
import { filtrar, linha, noMenu, nomesUnidades, seguir } from "./moradores-telas";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrirMenu(page: Page) {
  await expect(page.getByRole("button", { name: /^Conta de / })).toBeVisible();
  const menu = page.getByRole("button", { name: "Mais", exact: true });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole("navigation", { name: "Plataforma" });
}

test.describe("Plataforma do síndico · passo 3", () => {
  test("MU-02: o início resume os moradores e leva ao que falta conferir", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    const cartao = await abrirArea(page, "Comunicação e moradores");
    await expect(cartao).toContainText("5 unidades cadastradas");
    await expect(cartao).toContainText("1 contato a confirmar");
    await expect(cartao).toContainText("3 unidades sem contato confirmado");
    await expect(cartao).toContainText("1 unidade com inquilino e sem proprietário");
    await conferir(page);
    await cartao.getByRole("link", { name: "Conferir" }).click();
    await expect(page.getByRole("tab", { name: "A confirmar (1)", selected: true })).toBeVisible();
    await expect(linha(page, "Paulo Lima")).toContainText("Torre A · 102");
  });

  test("F3.1: unidades por torre em ordem natural; nova torre; o prédio passa a usar andar e as unidades geradas já saem no andar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await expect(page.getByRole("heading", { level: 1, name: "Moradores e unidades" })).toBeVisible();
    await page.getByRole("button", { name: "Montar o prédio" }).click();
    await expect(page.getByRole("group", { name: "Montar o prédio" })).toContainText("Hoje: torres, sem andares");
    await page.keyboard.press("Escape");
    await filtrar(page, { Torre: "Torre A" });
    expect(await nomesUnidades(page)).toEqual(["101", "102", "201", "1001"]);
    await expect(linha(page, "Joana Lima")).toContainText("1 a confirmar");
    await conferir(page);

    await noMenu(page, "Montar o prédio", "Nova torre");
    await page.getByRole("dialog", { name: "Incluir torre" }).getByLabel("Nome (torre)").fill("Torre C");
    await page.getByRole("dialog", { name: "Incluir torre" }).getByRole("button", { name: "Incluir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Torre C incluído." })).toBeVisible();

    await noMenu(page, "Montar o prédio", "Organização do prédio");
    const org = page.getByRole("dialog", { name: "Como o prédio se organiza" });
    await expect(org.getByLabel(/Por torre/)).toBeChecked();
    await org.getByLabel("As unidades ficam em andares").check();
    await conferir(page);
    await org.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Organização do prédio: torres, com andares." })).toBeVisible();

    await noMenu(page, "Montar o prédio", "Novas unidades");
    const janela = page.getByRole("dialog", { name: "Incluir unidades" });
    await janela.getByLabel("Torre").selectOption({ label: "Torre C" });
    await janela.getByRole("button", { name: "Gerar pela numeração" }).click();
    await janela.getByLabel("Do andar").fill("0");
    await janela.getByLabel("Até o andar").fill("2");
    await janela.getByLabel("Por andar").fill("2");
    await expect(janela).toContainText("Térreo · 1, Térreo · 2, 1º andar · 101, 1º andar · 102, 2º andar · 201, 2º andar · 202");
    await conferir(page);
    await janela.getByRole("button", { name: "Incluir 6 unidades" }).click();
    await expect(page.getByRole("status").filter({ hasText: "6 unidades incluídas." })).toBeVisible();

    await filtrar(page, { Torre: "Torre C", Andar: "2º andar" });
    expect(await nomesUnidades(page)).toEqual(["201", "202"]);

    await noMenu(page, "Montar o prédio", "Novas unidades");
    await janela.getByLabel("Torre").selectOption({ label: "Torre C" });
    await janela.getByLabel("Andar").fill("2");
    await janela.getByLabel("Unidades").fill("201, 203");
    await expect(janela).toContainText("2º andar · 201 já existe e fica como está");
    await janela.getByRole("button", { name: "Incluir 1 unidade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 unidade incluída. 1 já existia" })).toBeVisible();
  });

  test("MU-01 e MU-08: cadastrar morador ou proprietário escolhendo a torre, o andar e a unidade", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const m = estado.moradores;
    m.estrutura.usaAndar = true;
    for (const u of m.unidades) u.andar = u.identificacao === "Loja 2" ? "Térreo" : String(Math.floor(Number(u.identificacao) / 100));
    await page.goto(`${PLATAFORMA}/moradores`);
    await expect(linha(page, "Torre A · 2º andar · 201")).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    const janela = page.getByRole("dialog", { name: "Cadastrar pessoa" });
    await janela.getByLabel("Torre").selectOption({ label: "Torre A" });
    await janela.getByLabel("Andar").selectOption({ label: "2º andar" });
    await janela.getByLabel("Unidade").selectOption({ label: "201" });
    await seguir(janela);
    await janela.getByLabel("Nome").fill("Helena Prado");
    await janela.getByLabel("Telefone (WhatsApp)").fill("(61) 94444-0001");
    await seguir(janela);
    // Unidade vazia: a primeira pessoa já vem como proprietária, responsável e moradora (MU-10).
    for (const marca of ["Proprietário", "Responsável pela unidade", "Mora na unidade"]) await expect(janela.getByRole("checkbox", { name: marca, exact: true })).toBeChecked();
    await conferir(page);
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Helena Prado incluído em Torre A · 2º andar · 201." })).toBeVisible();
    await expect(linha(page, "Torre A · 2º andar · 201")).toContainText("Helena Prado");
    await page.getByRole("link", { name: "Torre A · 2º andar · 201" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 2º andar · 201" })).toBeVisible();
    await expect(linha(page, "Helena Prado")).toContainText("Responsável · Proprietário · Mora aqui");
  });

  test("MU-01, MU-03 e MU-08: ficha da unidade, telefone compartilhado, confirmar e incluir contato", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 102" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "O telefone de Joana Lima e Paulo Lima também está em outro contato" })).toBeVisible();
    await expect(linha(page, "Paulo Lima")).toContainText("A confirmar");
    await conferir(page);
    await page.getByRole("button", { name: "Confirmar Paulo Lima" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Paulo Lima confirmado." })).toBeVisible();
    await expect(linha(page, "Paulo Lima")).toContainText("Confirmado");

    await page.getByRole("button", { name: "Incluir pessoa" }).first().click();
    const janela = page.getByRole("dialog", { name: "Incluir pessoa · Torre A · 102" });
    await janela.getByLabel("Nome").fill("Rita Lima");
    await janela.getByLabel("Telefone (WhatsApp)").fill("9999");
    await expect(janela.getByLabel("Ligação com a unidade")).toHaveValue("FAMILIAR");
    await janela.getByLabel("Parentesco com Joana Lima (responsável)").selectOption({ label: "Filho(a)" });
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(janela.getByText("Telefone com DDD, como (61) 99999-0000.")).toBeVisible();
    await conferir(page);
    await janela.getByLabel("Telefone (WhatsApp)").fill("(61) 97777-1234");
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rita Lima incluído na unidade." })).toBeVisible();
    await expect(linha(page, "Rita Lima")).toContainText("Mora aqui");
    await expect(linha(page, "Rita Lima")).toContainText("familiar: filho(a) · +55 61 97777-1234");

    await noMenu(page, "Ações de Joana Lima", "Editar Joana Lima");
    await page.getByRole("dialog", { name: "Editar Joana Lima" }).getByLabel("Recebe comunicados do condomínio").uncheck();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(linha(page, "Joana Lima")).toContainText("não recebe comunicados");
  });

  test("MU-01: inquilino com o proprietário do imóvel no cadastro; a unidade sem proprietário vira pendência", async ({ page }) => {
    // Cadastra, muda e confere com o axe em várias telas: com a suíte inteira rodando, passa dos 30 s.
    test.slow();
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    const cartao = await abrirArea(page, "Comunicação e moradores");
    const pendencia = cartao.getByRole("listitem").filter({ hasText: "1 unidade com inquilino e sem proprietário" });
    await expect(pendencia).toContainText("Para controle, o dono do imóvel fica no cadastro.");
    await pendencia.getByRole("link", { name: "Ver quais" }).click();
    await expect(page.getByRole("button", { name: "Inquilino sem proprietário", pressed: true })).toBeVisible();
    expect(await nomesUnidades(page)).toEqual(["Torre A · 102"]);
    await expect(linha(page, "Torre A · 102")).toContainText("Falta o proprietário");
    await conferir(page);

    await page.getByRole("link", { name: "Torre A · 102" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Esta unidade tem inquilino e o proprietário do imóvel não está no cadastro." })).toBeVisible();
    await page.getByRole("button", { name: "Incluir proprietário" }).click();
    const incluir = page.getByRole("dialog", { name: "Incluir proprietário · Torre A · 102" });
    await expect(incluir.getByRole("checkbox", { name: "Proprietário", exact: true })).toBeChecked();
    await expect(incluir.getByRole("checkbox", { name: "Mora na unidade" })).not.toBeChecked();
    await expect(incluir.getByLabel("Recebe comunicados do condomínio")).not.toBeChecked();
    await incluir.getByRole("button", { name: "Já cadastrada em outra unidade" }).click();
    await incluir.getByLabel("Buscar pelo nome ou telefone").fill("Marina");
    await incluir.getByRole("button", { name: "Buscar" }).click();
    await incluir.getByLabel(/Marina Souza/).check();
    await conferir(page);
    await incluir.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Marina Souza incluído na unidade." })).toBeVisible();
    await expect(linha(page, "Marina Souza")).toContainText("não mora aqui · +55 61 99999-0001 · não recebe comunicados");
    await expect(page.getByText("Alugada · 2 moram aqui · o proprietário não mora")).toBeVisible();
    await expect(page.getByText("Esta unidade tem inquilino e o proprietário")).toHaveCount(0);

    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    const janela = page.getByRole("dialog", { name: "Cadastrar pessoa" });
    await janela.getByLabel("Torre").selectOption({ label: "Torre A" });
    await janela.getByLabel("Unidade").selectOption({ label: "201" });
    await seguir(janela);
    await janela.getByLabel("Nome", { exact: true }).fill("Caio Nunes");
    await janela.getByLabel("Telefone (WhatsApp)", { exact: true }).fill("61966660001");
    await seguir(janela);
    await janela.getByRole("checkbox", { name: "Proprietário", exact: true }).uncheck();
    await expect(janela.getByLabel("Ligação com a unidade")).toHaveValue("INQUILINO");
    const dono = janela.getByRole("group", { name: "Proprietário do imóvel" });
    await expect(dono).toContainText("A unidade ainda não tem proprietário no cadastro.");
    await janela.getByRole("button", { name: "Incluir inquilino e proprietário" }).click();
    await expect(dono.getByText("Confira o nome e o telefone (com DDD) do proprietário.")).toBeVisible();
    await dono.getByLabel("Nome do proprietário").fill("Sara Melo");
    await dono.getByLabel("Telefone do proprietário (WhatsApp)").fill("(61) 96666-0002");
    await conferir(page);
    await janela.getByRole("button", { name: "Incluir inquilino e proprietário" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Caio Nunes incluído em Torre A · 201, com Sara Melo como proprietário." })).toBeVisible();

    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await noMenu(page, "Mais ações", "Registrar mudança");
    const mudanca = page.getByRole("dialog", { name: "Registrar mudança · Torre A · 101" });
    await mudanca.getByLabel("Marina Souza · proprietário (condômino) · responsável").check();
    await mudanca.getByLabel("Pedro Souza · familiar ou cônjuge").check();
    await mudanca.getByLabel("Nome da pessoa 1").fill("Lia Reis");
    await mudanca.getByLabel("Telefone da pessoa 1").fill("61977770002");
    await expect(mudanca.getByRole("status").filter({ hasText: "A unidade vai ficar com inquilino e sem proprietário." })).toBeVisible();
    await mudanca.getByRole("button", { name: "+ Proprietário" }).click();
    const pessoa2 = mudanca.getByRole("group", { name: "A pessoa 2 é" });
    await expect(pessoa2.getByRole("checkbox", { name: "Proprietário", exact: true })).toBeChecked();
    await expect(pessoa2.getByRole("checkbox", { name: "Mora na unidade" })).not.toBeChecked();
    await mudanca.getByLabel("Nome da pessoa 2").fill("Rui Alves");
    await mudanca.getByLabel("Telefone da pessoa 2").fill("61977770001");
    await expect(mudanca.getByText("A unidade vai ficar com inquilino e sem proprietário.")).toHaveCount(0);
    await conferir(page);
    await mudanca.getByRole("button", { name: "Registrar mudança" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Mudança registrada: 2 saíram, 2 entraram." })).toBeVisible();
    await expect(linha(page, "Rui Alves")).toContainText("não recebe comunicados");
  });

  test("MU-07 e PT-11: mudança com quem sai e quem entra; depois, remover os dados de quem saiu", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await expect(page.getByRole("heading", { level: 1, name: "Torre A · 101" })).toBeVisible();
    await noMenu(page, "Mais ações", "Registrar mudança");
    const janela = page.getByRole("dialog", { name: "Registrar mudança · Torre A · 101" });
    await janela.getByLabel("Pedro Souza · familiar ou cônjuge").check();
    await expect(janela).toContainText("Ficam: Marina Souza.");
    await janela.getByLabel("Nome da pessoa 1").fill("Caio Nunes");
    await janela.getByLabel("Telefone da pessoa 1").fill("61966660001");
    await conferir(page);
    await janela.getByRole("button", { name: "Registrar mudança" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Mudança registrada: 1 saiu, 1 entrou." })).toBeVisible();
    await expect(linha(page, "Caio Nunes")).toContainText("Responsável · Mora aqui");
    await expect(linha(page, "Caio Nunes")).toContainText(/inquilino · desde \d{2}\/\d{2}\/\d{4}/);
    const anteriores = page.getByRole("region", { name: "Anteriores" });
    await expect(anteriores).toContainText("Pedro Souza");
    await expect(anteriores).toContainText(/saiu em \d{2}\/\d{2}\/\d{4} · mudou-se/);

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
      relacao: "OUTRO", proprietario: false, mora: false, ligacao: "OUTRO", parentesco: null, ocupaDesde: null, principal: false, recebeComunicados: true, estado: "PENDENTE", origem: "PLANILHA", criadoEm: "2026-10-16T15:00:00Z", versao: 1 });
    await page.goto(`${PLATAFORMA}/moradores?aba=confirmar`);
    await expect(page.getByRole("tab", { name: "A confirmar (2)", selected: true })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "Contato a confirmar não recebe nada e não acessa nada." })).toBeVisible();
    await conferir(page);
    await noMenu(page, "Ações de Padaria Sol", "Recusar Padaria Sol");
    await page.getByRole("dialog", { name: "Recusar Padaria Sol" }).getByRole("button", { name: "Recusar contato" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Padaria Sol recusado em Loja 2." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "A confirmar (1)", selected: true })).toBeVisible();
    await page.getByLabel("Marcar todos desta página").check();
    await page.getByRole("button", { name: "Confirmar 1 pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Contato confirmado." })).toBeVisible();
    await expect(page.getByText("Nenhum contato esperando confirmação")).toBeVisible();
  });

  test("F3.3: importar planilha com a prévia das linhas erradas; os contatos ficam a confirmar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await noMenu(page, "Montar o prédio", "Importar planilha");
    await expect(page.getByRole("heading", { level: 1, name: "Importar planilha" })).toBeVisible();
    await conferir(page);
    const csv = "Torre;Andar;Apto;Nome;Celular;Tipo\r\nTorre D;1;11;Lia Reis;(61) 97777-0002;Inquilina\r\nTorre D;1;;Sem Unidade;123;\r\nTorre D;1;12;Rui Alves;61977770001;proprietário\r\n";
    await page.getByLabel("Arquivo da planilha (CSV)").setInputFiles({ name: "moradores.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
    await expect(page.getByText("2 prontas", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /^3/ })).toContainText("Unidade em branco");
    await expect(page.getByRole("row", { name: /^3/ })).toContainText("Telefone incompleto");
    await conferir(page);
    await page.getByRole("button", { name: "Importar 2 contatos" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Importados: 1 torre ou bloco novo, 2 unidades novas, 2 contatos a confirmar." })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "2 unidades ficaram com inquilino e sem proprietário." })).toBeVisible();
    expect(estado.moradores.importacoes).toHaveLength(1);
    await page.getByRole("link", { name: "Conferir os contatos a confirmar" }).click();
    await expect(page.getByRole("tab", { name: "A confirmar (3)", selected: true })).toBeVisible();
    await expect(linha(page, "Lia Reis")).toContainText("Torre D · 1º andar · 11");
  });

  test("D4.6: os menus abertos e o Cadastrar pessoa em passos passam no axe", async ({ page }, info) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("button", { name: "Montar o prédio" }).click();
    await expect(page.getByRole("group", { name: "Montar o prédio" }).getByRole("link", { name: "Importar planilha" })).toBeVisible();
    await conferir(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Montar o prédio" })).toHaveCount(0);

    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    const janela = page.getByRole("dialog", { name: "Cadastrar pessoa" });
    await janela.getByLabel("Torre").selectOption({ label: "Torre A" });
    await janela.getByLabel("Unidade").selectOption({ label: "201" });
    await conferir(page);
    const celular = info.project.name === "celular";
    // No celular, um passo por vez: a ligação só aparece depois de dizer quem é.
    await expect(janela.getByLabel("Recebe comunicados do condomínio")).toBeVisible({ visible: !celular });
    await seguir(janela);
    if (celular) await expect(janela.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await janela.getByLabel("Nome").fill("Ana Prado");
    await janela.getByLabel("Telefone (WhatsApp)").fill("61944440009");
    await seguir(janela);
    if (celular) {
      await expect(janela.getByRole("progressbar", { name: "Passos do cadastro" })).toHaveAttribute("aria-valuenow", "3");
      await janela.getByRole("button", { name: /Quem é.*Ana Prado/ }).click();
      await expect(janela.getByLabel("Nome")).toHaveValue("Ana Prado");
      await seguir(janela);
    }
    await conferir(page);
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ana Prado incluído em Torre A · 201." })).toBeVisible();

    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
    await page.getByRole("button", { name: "Ações de Joana Lima" }).click();
    await conferir(page);
  });

  test("CF-03: quem tem Cadastrar moradores inclui, mas não confirma; quem só vê não tem a parte", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/moradores?aba=confirmar`);
    await expect(page.getByRole("note").filter({ hasText: "Só o síndico confirma." })).toBeVisible();
    await expect(page.getByLabel("Marcar todos desta página")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Recusar/ })).toHaveCount(0);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    await page.getByRole("button", { name: "Incluir pessoa" }).first().click();
    const janela = page.getByRole("dialog", { name: "Incluir pessoa · Torre A · 101" });
    await janela.getByLabel("Nome").fill("Teo Dias");
    await janela.getByLabel("Telefone (WhatsApp)").fill("61955550001");
    await janela.getByRole("button", { name: "Incluir pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Teo Dias incluído na unidade. Fica a confirmar pelo síndico." })).toBeVisible();
    await expect(linha(page, "Teo Dias")).toContainText("A confirmar");
    await expect(page.getByRole("button", { name: "Confirmar Teo Dias" })).toHaveCount(0);

    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(PLATAFORMA);
    const menu = await abrirMenu(page);
    await expect(menu.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Moradores e unidades" })).toHaveCount(0);
    await expect(page.getByText("unidades cadastradas")).toHaveCount(0);
  });
});

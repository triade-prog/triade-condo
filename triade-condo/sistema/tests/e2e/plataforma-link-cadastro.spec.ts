// Link de cadastro e a fila do que chega por ele (F3.10; MU-09) com a API falsa: o síndico cria o
// link na ficha da unidade, a pessoa preenche pelo celular sem conta e corrige pela chave guardada
// no aparelho, e o síndico confere em A confirmar (Pendentes do menu da unidade), tira o que não
// serve e aprova, ou recusa com o motivo, que a pessoa vê ao abrir o link de novo. O link do prédio
// todo pede a unidade. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A102, CODIGO_LINK } from "./api-falsa-moradores";
import { linha, noMenu } from "./moradores-telas";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

/** Cria o link pela ficha da Torre A · 102, com veículos também. */
async function criarLink(page: Page) {
  await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}`);
  await noMenu(page, "Mais ações", "Link de cadastro");
  const j = page.getByRole("dialog", { name: "Link de cadastro" });
  await expect(j.getByText("Torre A · 102. Em A pessoa escolhe")).toBeVisible();
  await expect(j.getByLabel("Nome e telefone")).toBeDisabled();
  await j.getByLabel(/^Veículos/).check();
  await j.getByLabel("Vale por").selectOption({ index: 2 });
  await conferir(page);
  await j.getByRole("button", { name: "Criar link" }).click();
  await expect(j.getByText("Link criado")).toBeVisible();
  await expect(j.getByText(`localhost:3000/cadastro/${CODIGO_LINK}`)).toBeVisible();
  await expect(linha(j, "Torre A · 102")).toContainText("ninguém preencheu ainda");
  await conferir(page);
}

/** A pessoa preenche os três passos e envia. */
async function preencher(page: Page) {
  await page.goto(`${PLATAFORMA}/cadastro/${CODIGO_LINK}`);
  await expect(page.getByText("Cadastro da Torre A · 102")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Passo 1 de 3" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Escreva o seu nome")).toBeVisible();
  await page.getByLabel("Nome").fill("Roberto Prado");
  await page.getByLabel("Telefone (WhatsApp)").fill("(61) 96666-4321");
  await page.getByLabel("Sua ligação com a unidade").selectOption({ label: "Proprietário, não moro aqui" });
  await page.getByLabel("E-mail").fill("roberto.prado@email.com");
  await conferir(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("progressbar", { name: "Passo 2 de 3" })).toBeVisible();
  await page.getByRole("button", { name: "Incluir familiar" }).click();
  const jf = page.getByRole("dialog", { name: "Incluir familiar" });
  await jf.getByLabel("Nome").fill("Clara Prado");
  await jf.getByLabel("Parentesco com você").selectOption({ label: "Cônjuge" });
  await jf.getByLabel("Mora na unidade").click();
  await conferir(page);
  await jf.getByRole("button", { name: "Pronto" }).click();
  await expect(linha(page.getByRole("list", { name: "Família" }), "Clara Prado")).toContainText("Cônjuge · não mora aqui");
  await page.getByRole("button", { name: "Incluir veículo" }).click();
  const jv = page.getByRole("dialog", { name: "Incluir veículo" });
  await jv.getByLabel("Placa").fill("abc1d2");
  await jv.getByRole("button", { name: "Pronto" }).click();
  await expect(jv.getByText("Placa Mercosul")).toBeVisible();
  await jv.getByLabel("Placa").fill("abc1d23");
  await jv.getByLabel("Modelo e cor").fill("Onix prata");
  await jv.getByRole("button", { name: "Pronto" }).click();
  await conferir(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible();
  await expect(page.getByText("Clara Prado, cônjuge")).toBeVisible();
  await expect(page.getByText("ABC1D23, Onix prata")).toBeVisible();
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Cadastro enviado")).toBeVisible();
  await conferir(page);
}

test.describe("Plataforma · link de cadastro", () => {
  test("MU-09: criar o link, a pessoa manda e corrige, e o síndico confere, tira o veículo e aprova", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await criarLink(page);
    await preencher(page);
    expect(estado.moradores.cadastros[0]).toMatchObject({ nome: "Roberto Prado", telefone: "+5561966664321", ligacao: "PROPRIETARIO", estado: "ENVIADO" });

    // A chave ficou no aparelho: abrir de novo mostra o envio, e Corrigir algo troca o que foi mandado.
    await page.reload();
    await expect(page.getByText("Cadastro enviado")).toBeVisible();
    await page.getByRole("button", { name: "Corrigir algo" }).click();
    await expect(page.getByLabel("Nome")).toHaveValue("Roberto Prado");
    await page.getByLabel("Nome").fill("Roberto A. Prado");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Enviar correção" }).click();
    await expect(page.getByText("Cadastro enviado")).toBeVisible();
    expect(estado.moradores.cadastros).toHaveLength(1);
    expect(estado.moradores.cadastros[0]!.nome).toBe("Roberto A. Prado");

    // Pendentes, no menu da unidade, abre A confirmar só com a unidade.
    await page.goto(`${PLATAFORMA}/moradores`);
    await noMenu(page, "Ações de Torre A · 102", "Pendentes (2)");
    await expect(page).toHaveURL(/aba=confirmar&unidade=/);
    await expect(page.getByRole("link", { name: /Só Torre A · 102/ })).toBeVisible();
    const lista = page.getByRole("list", { name: "Contatos a confirmar" });
    const roberto = linha(lista, "Roberto A. Prado");
    await expect(roberto).toContainText("Pelo link");
    await expect(roberto).toContainText("Proprietário que não mora");
    await expect(roberto).toContainText("com 1 da família, 1 veículo");
    await expect(linha(lista, "Paulo Lima")).toBeVisible();
    await conferir(page);
    await page.getByRole("group", { name: "Veio de" }).getByRole("button", { name: /Pelo link/ }).click();
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await conferir(page);

    await roberto.getByRole("button", { name: "Conferir o cadastro de Roberto A. Prado" }).click();
    const j = page.getByRole("dialog", { name: "Conferir o cadastro de Roberto A. Prado" });
    await expect(j.getByLabel("Ligação com a unidade")).toHaveValue("PROPRIETARIO");
    await expect(j.getByText("Clara Prado")).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Não incluir ABC1D23" }).click();
    await expect(j.getByText("Clara entra em Família")).toBeVisible();
    await j.getByRole("button", { name: "Aprovar" }).click();
    await expect(page.getByText("Roberto A. Prado aprovado em Torre A · 102.")).toBeVisible();
    expect(estado.moradores.cadastros[0]!.estado).toBe("APROVADO");
    expect(estado.moradores.familia.some((f) => f.nome === "Clara Prado" && f.unidadeId === A102 && !f.mora)).toBe(true);
    expect(estado.moradores.contatos.some((c) => c.nome === "Roberto A. Prado")).toBe(true);

    // A pessoa vê que foi aprovado e não corrige mais.
    await page.goto(`${PLATAFORMA}/cadastro/${CODIGO_LINK}`);
    await expect(page.getByText("Cadastro aprovado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Corrigir algo" })).toHaveCount(0);
  });

  test("MU-09: recusar apaga os dados e a pessoa vê o motivo; o link encerrado não aceita mais", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await criarLink(page);
    await preencher(page);
    await page.goto(`${PLATAFORMA}/moradores?aba=confirmar`);
    await linha(page.getByRole("list", { name: "Contatos a confirmar" }), "Roberto Prado").getByRole("button", { name: /Conferir/ }).click();
    await page.getByRole("dialog", { name: "Conferir o cadastro de Roberto Prado" }).getByRole("button", { name: "Recusar…" }).click();
    const jr = page.getByRole("dialog", { name: "Recusar o cadastro de Roberto Prado" });
    await jr.getByLabel("Motivo").selectOption({ label: "Outro motivo" });
    await jr.getByRole("button", { name: "Recusar cadastro" }).click();
    await expect(jr.getByText("Explique o motivo")).toBeVisible();
    await jr.getByLabel("Explique").fill("O proprietário já está cadastrado com outro nome.");
    await conferir(page);
    await jr.getByRole("button", { name: "Recusar cadastro" }).click();
    await expect(page.getByText("Cadastro de Roberto Prado recusado. Os dados foram apagados.")).toBeVisible();
    expect(estado.moradores.cadastros[0]).toMatchObject({ estado: "RECUSADO", nome: null, telefone: null, familia: [] });

    await page.goto(`${PLATAFORMA}/cadastro/${CODIGO_LINK}`);
    await expect(page.getByText("O condomínio não aprovou este cadastro")).toBeVisible();
    await expect(page.getByText(/outro motivo\. O proprietário já está cadastrado/)).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A102}&abrir=link`);
    const j = page.getByRole("dialog", { name: "Link de cadastro" });
    await j.getByRole("button", { name: /Encerrar o link/ }).click();
    await expect(page.getByText("Link encerrado.")).toBeVisible();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`${PLATAFORMA}/cadastro/${CODIGO_LINK}`);
    await expect(page.getByText("Este link não aceita mais cadastro")).toBeVisible();
    await conferir(page);
  });

  test("MU-09: o link do prédio todo, criado em Montar o prédio, pede a unidade", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await noMenu(page, "Montar o prédio", "Link de cadastro");
    const j = page.getByRole("dialog", { name: "Link de cadastro" });
    await expect(j.getByText(/serve para o prédio todo/)).toBeVisible();
    await j.getByRole("button", { name: "Criar link" }).click();
    await expect(j.getByText("Link criado")).toBeVisible();
    await expect(linha(j, "Prédio todo")).toContainText("ninguém preencheu ainda");
    expect(estado.moradores.links[0]!.unidadeId).toBeNull();

    await page.goto(`${PLATAFORMA}/cadastro/${CODIGO_LINK}`);
    await expect(page.getByText("Cadastro de morador")).toBeVisible();
    await page.getByLabel("Nome").fill("Rita Alves");
    await page.getByLabel("Telefone (WhatsApp)").fill("61 97777-1234");
    await page.getByLabel("Sua ligação com a unidade").selectOption({ label: "Inquilino" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escolha a sua unidade.")).toBeVisible();
    await page.getByLabel("Sua unidade").selectOption({ label: "Torre A · 201" });
    await conferir(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: /Não tenho família nem pet/ }).click();
    await expect(page.getByText("Torre A · 201")).toBeVisible();
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Cadastro enviado")).toBeVisible();
    expect(estado.moradores.cadastros[0]!.ligacao).toBe("INQUILINO");
  });
});

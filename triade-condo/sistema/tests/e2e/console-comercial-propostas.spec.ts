// Propostas no Console (0304; quadros 325 a 329, 337 e 344) com a API falsa: a proposta nasce da
// Tabela de preços, o desconto passa pela Administração, o envio entrega o link uma vez, o síndico
// aceita sem conta, o kit sai em PDF com o comparativo pelos critérios do síndico (0307) e as
// respostas prontas ficam em Modelos. Cada tela passa no axe
// e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { CODIGO_IPE, CODIGO_VENCIDO, INDICADO, PROPOSTA_IPE, SITE } from "./api-falsa-console-comercial";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  // Nada vaza para o lado (a tela não pode ficar mais larga que o aparelho).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const celular = () => test.info().project.name === "celular";

test.describe("Console · Propostas", () => {
  test("Nova proposta com desconto: pede, a Administração aprova, envia e o síndico aceita pelo link", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${SITE}`);
    await page.getByRole("link", { name: "Fazer proposta" }).click();
    await expect(page.getByRole("heading", { name: "Nova proposta", level: 1 })).toBeVisible();
    // A sugestão vem da Tabela de preços com as unidades da ficha (72 → faixa até 80).
    await expect(page.getByLabel("Unidades ativas")).toHaveValue("72");
    const resumo = page.getByRole("region", { name: "O que vai na proposta" });
    await expect(resumo).toContainText("R$");
    await conferir(page);

    await page.getByLabel("Desconto na mensalidade (%)").fill("10");
    await page.getByLabel("Motivo").first().fill("Síndica fecha esta semana se o valor couber");
    await page.getByLabel("Só para a equipe").fill("Conselho reúne dia 30.");
    await expect(page.getByText("Precisa de aprovação")).toBeVisible();
    await page.getByRole("button", { name: "Pedir aprovação do desconto" }).click();
    await expect(page).toHaveURL(/\/comercial\/propostas\?proposta=.*feito=pedido/);
    const criada = api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/propostas");
    expect(criada?.corpo).toMatchObject({ interessadoId: SITE, desconto: 10, unidades: 72 });

    const proposta = page.getByRole("region", { name: "Proposta de Residencial Jatobá" });
    await expect(proposta.getByText("Esperando a Administração")).toBeVisible();
    await conferir(page);
    await proposta.getByRole("button", { name: "Responder ao desconto" }).click();
    const janela = page.getByRole("dialog", { name: "Aprovar desconto" });
    await expect(janela).toContainText("Síndica fecha esta semana se o valor couber");
    await expect(janela).toContainText("Só a Administração aprova.");
    await conferir(page);
    await janela.getByRole("button", { name: "Aprovar desconto" }).click();
    await expect(janela).toHaveCount(0);
    await expect(proposta.getByText(/Desconto de 10% aprovado/)).toBeVisible();

    await proposta.getByRole("button", { name: "Enviar a v1" }).click();
    const campo = proposta.getByLabel("Link da proposta");
    await expect(campo).toHaveValue(/\/o\/link-novo-/);
    const endereco = await campo.inputValue();
    await conferir(page);

    // O síndico abre o link sem conta, confere e aceita.
    await page.goto(endereco);
    await expect(page.getByRole("heading", { name: "Proposta para organizar os pedidos do seu prédio", level: 1 })).toBeVisible();
    await expect(page.getByText(/^Para Residencial Jatobá/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Console" })).toHaveCount(0);
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toContain("Conselho reúne dia 30.");
    expect(corpo).not.toContain("Síndica fecha esta semana");
    await conferir(page);
    await page.getByLabel("Nome").fill("Marta Ribeiro");
    await page.getByLabel("CPF").fill("111.111.111-11");
    await page.getByLabel("Cargo").fill("Síndica");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Aceitar a proposta" }).click();
    await expect(page.getByText(/Confira o CPF/)).toBeVisible();
    await page.getByLabel("CPF").fill("52998224725");
    await page.getByLabel("CPF").blur();
    await expect(page.getByLabel("CPF")).toHaveValue("529.982.247-25");
    await page.getByRole("button", { name: "Aceitar a proposta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Proposta aceita, Marta." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Baixar a proposta aceita" })).toBeVisible();
    await conferir(page);
    expect(api.comercial.pedidos.at(-1)?.corpo).toMatchObject({ nome: "Marta Ribeiro", cpf: "529.982.247-25", cargo: "Síndica", concordo: true });
  });

  test("Sob consulta: o valor digitado passa pela Administração antes do envio (0306)", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/propostas/nova?interessado=${SITE}`);
    await expect(page.getByLabel("Unidades ativas")).toHaveValue("72");
    await page.getByLabel("Unidades ativas").fill("450");
    await page.getByLabel("Mensalidade combinada").fill("1.500,00");
    await page.getByLabel("De onde veio o valor").fill("Combinado com a administradora da rede");
    await page.getByRole("button", { name: "Pedir aprovação do valor sob consulta" }).click();
    await expect(page).toHaveURL(/feito=pedidoValor/);
    expect(api.comercial.pedidos.some((x) => /\/desconto\/pedir$/.test(x.caminho))).toBe(true);

    const proposta = page.getByRole("region", { name: "Proposta de Residencial Jatobá" });
    await expect(proposta.getByText(/Valor sob consulta de R\$ 1\.500,00 por mês pedido/)).toBeVisible();
    await proposta.getByRole("button", { name: "Responder ao pedido" }).click();
    const janela = page.getByRole("dialog", { name: "Aprovar valor sob consulta" });
    await expect(janela).toContainText("R$ 1.500,00 por mês (sob consulta, 450 unidades)");
    await expect(janela).toContainText("Combinado com a administradora da rede");
    await conferir(page);
    await janela.getByRole("button", { name: "Aprovar valor" }).click();
    await expect(janela).toHaveCount(0);
    await expect(proposta.getByText(/Valor sob consulta de R\$ 1\.500,00 por mês aprovado/)).toBeVisible();
    await proposta.getByRole("button", { name: "Enviar a v1" }).click();
    await expect(proposta.getByLabel("Link da proposta")).toHaveValue(/\/o\/link-novo-/);
  });

  test("O Comercial pede o desconto mas não aprova", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    await page.goto(`${CONSOLE}/comercial/propostas/nova?interessado=${SITE}`);
    await expect(page.getByLabel("Unidades ativas")).toHaveValue("72");
    await page.getByLabel("Desconto na mensalidade (%)").fill("5");
    await page.getByLabel("Motivo").first().fill("Concorrente cobra menos");
    await page.getByRole("button", { name: "Pedir aprovação do desconto" }).click();
    const proposta = page.getByRole("region", { name: "Proposta de Residencial Jatobá" });
    await expect(proposta.getByText("Esperando a Administração")).toBeVisible();
    await expect(proposta.getByText("Só a Administração aprova.")).toBeVisible();
    await expect(proposta.getByRole("button", { name: "Responder ao desconto" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir o simulador" })).toHaveCount(0);
    await conferir(page);
  });

  test("Lista: abas, a proposta enviada com aberturas, e a ficha leva à proposta", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    await page.getByRole("link", { name: "Abrir a proposta" }).click();
    await expect(page).toHaveURL(new RegExp(`/comercial/propostas\\?proposta=${PROPOSTA_IPE}`));
    await expect(page.getByRole("heading", { name: "Propostas", level: 1 })).toBeVisible();
    if (!celular()) await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Propostas" })).toHaveAttribute("aria-current", "page");
    const proposta = page.getByRole("region", { name: "Proposta de Edifício Ipê Amarelo" });
    await expect(proposta.getByRole("button", { name: "Gerar link novo" })).toBeVisible();
    await expect(proposta.getByText(/Aberta \d+ vez/).first()).toBeVisible();
    await expect(proposta.getByText("Só para a equipe")).toBeVisible();
    await conferir(page);
    await page.getByRole("navigation", { name: "Abas das propostas" }).getByRole("button", { name: /Vencidas/ }).click();
    await expect(page.getByText("Condomínio Lago Sul").first()).toBeVisible();
    await expect(page.getByText("Edifício Ipê Amarelo")).toHaveCount(0);
  });

  test("Kit para o conselho: critérios do síndico, fato confirmado e o PDF (0307)", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/propostas/${PROPOSTA_IPE}/kit`);
    await expect(page.getByRole("heading", { name: "Kit para o conselho", level: 1 })).toBeVisible();
    await expect(page.getByText("Pedidos de manutenção somem no grupo do WhatsApp")).toBeVisible();
    const comparativo = page.getByRole("table", { name: "Comparativo para o conselho" });
    for (const coluna of ["Critério do síndico", "TRÍADE", "Planilha e WhatsApp", "CondoApp", "Outro App"]) {
      await expect(comparativo.getByRole("columnheader", { name: coluna })).toBeVisible();
    }
    await expect(comparativo.getByRole("row")).toHaveCount(3);
    const custo = comparativo.getByRole("row", { name: /Custo por apartamento por mês/ });
    await expect(custo).toContainText("por apartamento por mês (estimativa)");
    await expect(custo).toContainText("R$ 9,00 por apartamento (Básico: R$ 288,00 por mês)");
    await expect(comparativo.getByRole("row", { name: /Como cancelar/ })).toContainText("vale o que estiver no contrato assinado");
    await expect(comparativo).toContainText("a confirmar com eles");
    await expect(comparativo).not.toContainText(/retorno|ROI/);
    await conferir(page);

    // Escolher critérios: grava na ficha do prédio e a linha nova aparece.
    await page.getByRole("button", { name: "Escolher critérios" }).click();
    const criterios = page.getByRole("dialog", { name: "Escolher critérios" });
    await expect(criterios.getByRole("checkbox", { name: "Como cancelar" })).toBeChecked();
    await criterios.locator("label", { hasText: "Todo pedido com responsável e prazo" }).click();
    await expect(criterios.getByRole("checkbox", { name: "Todo pedido com responsável e prazo" })).toBeChecked();
    await conferir(page);
    await criterios.getByRole("button", { name: "Salvar os critérios" }).click();
    await expect(criterios).toHaveCount(0);
    await expect(comparativo.getByRole("row")).toHaveCount(4);
    await expect(comparativo.getByRole("row", { name: /Todo pedido com responsável e prazo/ })).toContainText("conclusão explicada");
    const salvo = api.comercial.pedidos.find((x) => x.caminho.endsWith(`/interessados/${INDICADO}/criterios`));
    expect(salvo?.corpo).toMatchObject({ versao: 1, criterios: ["PEDIDO_COM_PRAZO", "CUSTO_APARTAMENTO", "COMO_CANCELAR"] });

    // O fato confirmado de um concorrente num critério: o texto vai para a célula; a fonte, não.
    await page.getByRole("button", { name: "Registrar o fato: Outro App, Como cancelar" }).click();
    const fato = page.getByRole("dialog", { name: "Registrar o fato confirmado" });
    await fato.getByLabel("O que a equipe confirmou").fill("Fidelidade de 12 meses, com multa");
    await fato.getByLabel("Onde confirmou").fill("FONTE-SO-DA-EQUIPE: contrato que o síndico mostrou");
    await conferir(page);
    await fato.getByRole("button", { name: "Registrar o fato" }).click();
    await expect(fato).toHaveCount(0);
    const cancelar = comparativo.getByRole("row", { name: /Como cancelar/ });
    await expect(cancelar).toContainText("Fidelidade de 12 meses, com multa");
    await expect(comparativo).not.toContainText("FONTE-SO-DA-EQUIPE");
    await expect(page.getByRole("button", { name: "Mudar o fato: Outro App, Como cancelar" })).toBeVisible();
    await conferir(page);

    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o kit em PDF" }).click();
    const arquivo = await baixa;
    expect(arquivo.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("Link público: abre a proposta e o kit; vencida e inexistente avisam", async ({ page }) => {
    const api = await instalarApiFalsa(page, { logado: false });
    await page.goto(`${CONSOLE}/o/${CODIGO_IPE}`);
    await expect(page.getByRole("heading", { name: "Proposta para organizar os pedidos do seu prédio", level: 1 })).toBeVisible();
    await expect(page.getByText(/^Para Edifício Ipê Amarelo/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceitar a proposta" })).toBeVisible();
    await conferir(page);
    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o PDF" }).click();
    expect((await baixa).suggestedFilename()).toMatch(/\.pdf$/);

    // O kit pelo link traz o mesmo comparativo do Console, sem a fonte nem as notas da equipe (CM-12).
    api.comercial.fatos.push({ id: "bb5f6071-0000-4000-8000-000000000001", sistema: "CondoApp", criterio: "COMO_CANCELAR", interessadoId: null,
      texto: "Aviso de 60 dias", fonte: "FONTE-SO-DA-EQUIPE", confirmadoEm: "2026-10-20", versao: 1 });
    const kit = page.waitForResponse((r) => r.url().includes(`/v1/publico/propostas/${CODIGO_IPE}/kit`));
    const baixaKit = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o kit do conselho" }).click();
    const corpoKit = await (await kit).json();
    expect((await baixaKit).suggestedFilename()).toMatch(/\.pdf$/);
    expect(corpoKit.comparativo.linhas.map((l: { titulo: string }) => l.titulo)).toEqual(["Custo por apartamento por mês", "Como cancelar"]);
    expect(corpoKit.comparativo.linhas[1].valores[1]).toEqual({ confirmado: true, texto: "Aviso de 60 dias" });
    expect(corpoKit.predio.problema).toBe("Pedidos de manutenção somem no grupo do WhatsApp");
    expect(JSON.stringify(corpoKit)).not.toContain("FONTE-SO-DA-EQUIPE");
    expect(corpoKit).not.toHaveProperty("fatos");
    expect(corpoKit).not.toHaveProperty("interessado");

    await page.goto(`${CONSOLE}/o/${CODIGO_VENCIDO}`);
    await expect(page.getByRole("heading", { name: "Esta proposta venceu" })).toBeVisible();
    await conferir(page);
    await page.goto(`${CONSOLE}/o/codigo-que-nao-existe-em-lugar-nenhum`);
    await expect(page.getByRole("heading", { name: "Esta proposta não está mais disponível" })).toBeVisible();
    await conferir(page);
  });

  test("Modelos: a Administração escreve e revisa uma resposta pronta; as referências aparecem", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/modelos`);
    await page.getByRole("button", { name: /Respostas prontas/ }).click();
    await expect(page.getByText("A revisar")).toBeVisible();
    await expect(page.getByRole("table", { name: "Referências de clientes" })).toContainText("Paulo Dias");
    await conferir(page);
    await page.getByRole("button", { name: "Nova resposta" }).click();
    const janela = page.getByRole("dialog");
    await janela.getByLabel("Título").fill("Backup dos dados");
    await janela.getByLabel("Resposta").fill("Os dados ficam em servidor no Brasil, com cópia diária e acesso registrado.");
    await janela.getByRole("switch", { name: /Revisada pela Administração/ }).check({ force: true });
    await conferir(page);
    await janela.getByRole("button", { name: /Salvar/ }).click();
    await expect(janela).toHaveCount(0);
    await expect(page.getByText("Backup dos dados")).toBeVisible();
    expect(api.comercial.pedidos.at(-1)).toMatchObject({ caminho: "/v1/comercial/respostas", corpo: { titulo: "Backup dos dados", revisada: true } });
    if (celular()) return;
    await page.getByRole("button", { name: "Editar Backup dos dados" }).click();
    await page.getByRole("dialog").getByLabel("Título").fill("Backup e cópia dos dados");
    await page.getByRole("dialog").getByRole("button", { name: /Salvar/ }).click();
    await expect(page.getByText("Backup e cópia dos dados")).toBeVisible();
  });
});

// Contrato pelo gov.br no Console e no link do síndico (0308, R17.4; quadros 440 a 444; CM-13) com a
// API falsa: o CNPJ e a ata pelo link depois do aceite, Gerar contrato com a impressão digital, o
// síndico que baixa, assina e envia o PDF, a conferência no validador com as três marcas
// obrigatórias, a TRÍADE que assina sobre o mesmo arquivo, o Virar cliente que só liga com as duas
// conferidas, o PDF final no link, o recusar com motivo, o gerar de novo, os estados e Modelos ›
// Contrato, só da Administração. Cada tela passa no axe, não usa emoji e não vaza para o lado.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { CERRADO, INES } from "./api-falsa-console-comercial";
import { CODIGO_CERRADO, contratoAssinado, contratoGerado } from "./api-falsa-console-contrato";

const CONSOLE = "http://localhost:3001";
const pdf = (name: string, conteudo: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7\n${conteudo}\n%%EOF`) });

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function baixar(page: Page, clicar: () => Promise<void>) {
  const espera = page.waitForEvent("download");
  await clicar();
  return (await espera).suggestedFilename();
}

test.describe("Console · Comercial · contrato pelo gov.br (R17.4)", () => {
  test("Do CNPJ e da ata pelo link às duas assinaturas conferidas, o Virar cliente e o PDF final", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}`);
    await page.getByRole("region", { name: "Contrato" }).getByRole("link", { name: "Preparar o contrato" }).click();
    await expect(page.getByRole("heading", { name: "Contrato", level: 1 })).toBeVisible();
    await expect(page.getByText("Falta CNPJ ou ata")).toBeVisible();
    const gerar = page.getByRole("region", { name: "Gerar contrato" });
    await expect(gerar.getByRole("button", { name: "Gerar contrato" })).toBeDisabled();
    await expect(gerar.getByText("Falta o cartão do CNPJ ou a ata da eleição com o fim do mandato.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lembrar pelo WhatsApp" })).toHaveAttribute("href", /5561977776666/);
    await conferir(page);

    // O síndico, pelo link da proposta aceita: o CNPJ (conferido antes de enviar) e a ata com o fim do mandato.
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}`);
    await page.getByRole("link", { name: "Enviar o CNPJ e a ata" }).click();
    await expect(page.getByRole("heading", { name: "Falta pouco para começar", level: 1 })).toBeVisible();
    await conferir(page);
    const docs = page.getByRole("region", { name: "Documentos do condomínio" });
    await docs.getByLabel("CNPJ do condomínio").fill("11222333000180");
    await docs.getByLabel("Escolher o PDF").setInputFiles(pdf("cnpj-cerrado.pdf", "cartao do CNPJ"));
    await docs.getByRole("button", { name: "Enviar o documento" }).click();
    await expect(docs.getByText("Confira o CNPJ: os números não batem.")).toBeVisible();
    await docs.getByLabel("CNPJ do condomínio").fill("11222333000181");
    await docs.getByRole("button", { name: "Enviar o documento" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cartão do CNPJ recebido" })).toBeVisible();
    await expect(docs.getByRole("radio", { name: "Ata da eleição do síndico" })).toBeChecked();
    await docs.getByLabel("Mandato do síndico até").fill("2030-03-31");
    await docs.getByLabel("Escolher o PDF").setInputFiles(pdf("ata-2025.pdf", "ata da eleicao"));
    await docs.getByRole("button", { name: "Enviar o documento" }).click();
    await expect(docs.getByText("Enviados. A equipe confere e prepara o contrato.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Assine o contrato pelo gov.br" }).getByText("A equipe prepara o contrato depois dos documentos.", { exact: false })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/publico/propostas/${CODIGO_CERRADO}/documentos`)?.corpo).toMatchObject({ tipo: "CNPJ", nome: "cnpj-cerrado.pdf" });
    await conferir(page);

    // A equipe gera o contrato: os dados preenchidos, a impressão digital e as assinaturas na ordem.
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await page.getByRole("region", { name: "Gerar contrato" }).getByRole("button", { name: "Gerar contrato" }).click();
    const janelaGerar = page.getByRole("dialog", { name: "Gerar contrato" });
    await expect(janelaGerar.getByLabel("Data de início")).not.toHaveValue("");
    await conferir(page);
    await janelaGerar.getByRole("button", { name: "Gerar contrato" }).click();
    await expect(janelaGerar).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Contrato gerado." })).toBeVisible();
    const dados = page.getByRole("region", { name: "Preenchido da proposta e do interessado" });
    await expect(dados).toContainText("11.222.333/0001-81");
    await expect(dados).toContainText("Lúcia Prado, Síndica");
    await expect(dados).toContainText("31/03/2030");
    const gerado = page.getByRole("region", { name: "O PDF gerado" });
    await expect(gerado).toContainText("sha256 9f2c…41ab");
    expect(await baixar(page, () => gerado.getByRole("button", { name: "Baixar o PDF gerado" }).click())).toBe("contrato-1-residencial-cerrado.pdf");
    const assinaturas = page.getByRole("region", { name: "Assinaturas pelo gov.br" });
    await expect(assinaturas.getByText("0 de 2")).toBeVisible();
    const passos = assinaturas.getByRole("list", { name: "Assinaturas, nesta ordem" }).getByRole("listitem");
    await expect(passos.nth(0)).toContainText("Lúcia Prado assina pelo condomínio");
    await expect(passos.nth(0)).toContainText("Aguardando");
    await expect(passos.nth(1)).toContainText("Carolina assina pela TRÍADE");
    await expect(passos.nth(1)).toContainText("Espera o condomínio");
    await expect(page.getByRole("button", { name: "Baixar o PDF assinado pela Lúcia" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" })).toBeDisabled();
    await expect(page.getByRole("region", { name: "Depois de assinado" }).getByRole("button", { name: "Virar cliente" })).toBeDisabled();
    await conferir(page);

    // O síndico baixa, assina no gov.br e envia; o arquivo sem assinatura é recusado na hora.
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}/contrato`);
    const assinar = page.getByRole("region", { name: "Assine o contrato pelo gov.br" });
    expect(await baixar(page, () => assinar.getByRole("button", { name: "Baixar o contrato" }).click())).toBe("contrato-1-residencial-cerrado.pdf");
    await expect(assinar.getByRole("link", { name: "Abrir o assinador do gov.br" })).toHaveAttribute("href", "https://assinador.iti.br");
    await assinar.getByLabel("Enviar o PDF assinado").setInputFiles(pdf("contrato-sem.pdf", "SEM-ASSINATURA"));
    await assinar.getByRole("button", { name: "Enviar este PDF" }).click();
    await expect(assinar.getByText("Envie de novo")).toBeVisible();
    await expect(assinar.getByText("não tem assinatura digital nova", { exact: false })).toBeVisible();
    await assinar.getByLabel("Enviar o PDF assinado").setInputFiles(pdf("contrato-cerrado-assinado.pdf", "assinado pela Lucia"));
    await assinar.getByRole("button", { name: "Enviar este PDF" }).click();
    await expect(assinar.getByText(/PDF assinado recebido .*A equipe confere a assinatura/)).toBeVisible();
    await conferir(page);

    // A equipe confere no validador: as três marcas são obrigatórias.
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await expect(passos.nth(0)).toContainText("Falta conferir");
    await passos.nth(0).getByRole("button", { name: "Conferir a assinatura" }).click();
    const janela = page.getByRole("dialog", { name: "Conferir a assinatura da Lúcia" });
    await expect(janela.getByRole("region", { name: "O sistema já conferiu" })).toContainText("2 de 2");
    await expect(janela.getByText("contrato-cerrado-assinado.pdf · enviado pelo link", { exact: false })).toBeVisible();
    await expect(janela.getByRole("link", { name: "Abrir validar.iti.gov.br" })).toHaveAttribute("href", "https://validar.iti.gov.br");
    const marcar = janela.getByRole("button", { name: "Marcar como conferida" });
    await expect(marcar).toBeDisabled();
    await conferir(page);
    await janela.getByRole("checkbox", { name: /A assinatura é válida/ }).check();
    await janela.getByRole("checkbox", { name: /Quem assinou é a Lúcia Prado/ }).check();
    await expect(marcar).toBeDisabled();
    await janela.getByRole("checkbox", { name: /Foi assinado depois de gerado/ }).check();
    await janela.getByLabel("Observação").fill("Conferido pelo validador; selo gov.br ouro.");
    await marcar.click();
    await expect(janela).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Assinatura da Lúcia conferida." })).toBeVisible();
    const conferido = api.comercial.pedidos.filter((x) => x.caminho.endsWith("/conferir")).at(-1);
    expect(conferido?.corpo).toMatchObject({ versao: 1, assinaturaValida: true, pessoaConfere: true, dataConfere: true, observacao: "Conferido pelo validador; selo gov.br ouro." });
    await expect(assinaturas.getByText("1 de 2")).toBeVisible();
    await expect(passos.nth(1)).toContainText("Sua vez");

    // A TRÍADE baixa o PDF já assinado pela Lúcia, assina sobre ele e envia.
    expect(await baixar(page, () => page.getByRole("button", { name: "Baixar o PDF assinado pela Lúcia" }).click())).toBe("contrato-cerrado-assinado.pdf");
    await page.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" }).click();
    const enviar = page.getByRole("dialog", { name: "Enviar o PDF assinado pela TRÍADE" });
    await expect(enviar.getByRole("link", { name: "Abrir o assinador do gov.br" })).toBeVisible();
    await enviar.getByLabel("Escolher o PDF assinado").setInputFiles(pdf("contrato-cerrado-assinado-triade.pdf", "assinado pelos dois"));
    await conferir(page);
    await enviar.getByRole("button", { name: "Enviar o PDF assinado" }).click();
    await expect(enviar).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "PDF assinado pela TRÍADE recebido." })).toBeVisible();
    await passos.nth(1).getByRole("button", { name: "Conferir a assinatura" }).click();
    const daTriade = page.getByRole("dialog", { name: "Conferir a assinatura da TRÍADE" });
    for (const nome of [/A assinatura é válida/, /quem assina pela TRÍADE/, /Foi assinado depois de gerado/]) await daTriade.getByRole("checkbox", { name: nome }).check();
    await daTriade.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(daTriade.getByText("Digite o CPF que o validador mostra.")).toBeVisible();
    await daTriade.getByLabel("CPF de quem assinou pela TRÍADE").fill("11144477735");
    await daTriade.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(daTriade).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Contrato assinado pelos dois." })).toBeVisible();
    await expect(page.getByText("Assinado pelos dois", { exact: true }).first()).toBeVisible();
    await expect(assinaturas.getByText("2 de 2")).toBeVisible();
    await expect(page.getByRole("region", { name: "Histórico dos envios" })).toContainText("Recusado na hora");
    await conferir(page);

    // Com as duas conferidas, o Virar cliente liga.
    await page.getByRole("region", { name: "Depois de assinado" }).getByRole("button", { name: "Virar cliente" }).click();
    const virar = page.getByRole("dialog", { name: "Virar cliente" });
    await virar.getByLabel("Quem cuida da implantação").selectOption(INES);
    await virar.getByRole("button", { name: "Criar o cliente e abrir a implantação" }).click();
    await expect(virar).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Cliente criado na carteira" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir a implantação" })).toHaveAttribute("href", /\/clientes\/.+aba=implantacao/);

    // O síndico baixa o PDF final pelo mesmo link.
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}/contrato`);
    await expect(page.getByRole("heading", { name: "Contrato assinado", level: 1 })).toBeVisible();
    expect(await baixar(page, () => page.getByRole("button", { name: "Baixar o PDF final" }).click())).toBe("contrato-assinado-residencial-cerrado.pdf");
    await conferir(page);
  });

  test("Não é o contrato gerado, recusar com motivo e gerar de novo", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    contratoGerado(api.comercial, CERRADO);
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}/contrato`);
    const assinar = page.getByRole("region", { name: "Assine o contrato pelo gov.br" });
    await assinar.getByLabel("Enviar o PDF assinado").setInputFiles(pdf("outro.pdf", "OUTRO-ARQUIVO"));
    await assinar.getByRole("button", { name: "Enviar este PDF" }).click();
    await expect(assinar.getByText("O conteúdo assinado não é o contrato gerado.", { exact: false }).first()).toBeVisible();

    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await expect(page.getByText("Não é o contrato gerado").first()).toBeVisible();
    const passos = page.getByRole("list", { name: "Assinaturas, nesta ordem" }).getByRole("listitem");
    await passos.nth(0).getByRole("button", { name: "Ver e recusar o envio" }).click();
    const janela = page.getByRole("dialog", { name: "Conferir a assinatura da Lúcia" });
    await expect(janela.getByRole("region", { name: "O sistema já conferiu" })).toContainText("1 de 2");
    await expect(janela.getByRole("button", { name: "Marcar como conferida" })).toBeDisabled();
    await conferir(page);
    await janela.getByRole("button", { name: "Recusar e pedir de novo" }).click();
    const recusa = page.getByRole("dialog", { name: "Recusar e pedir de novo" });
    await recusa.getByRole("button", { name: "Recusar o envio" }).click();
    await expect(recusa.getByText("Diga o motivo, que o síndico vai ver.")).toBeVisible();
    await recusa.getByLabel("Motivo (o síndico vai ver)").fill("O arquivo enviado não é o contrato gerado; baixe de novo e assine sem mudar nada.");
    await conferir(page);
    await recusa.getByRole("button", { name: "Recusar o envio" }).click();
    await expect(recusa).toHaveCount(0);
    await expect(page.getByText("Assinatura recusada na conferência")).toBeVisible();
    await expect(page.getByText(/Carolina recusou em \d\d\/\d\d\/\d{4}: O arquivo enviado não é o contrato gerado/)).toBeVisible();
    expect(api.comercial.pedidos.filter((x) => x.caminho.endsWith("/recusar")).at(-1)?.corpo).toMatchObject({ versao: 1 });

    // O síndico vê o motivo no link.
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}/contrato`);
    await expect(page.getByRole("region", { name: "Assine o contrato pelo gov.br" }).getByText("baixe de novo e assine sem mudar nada", { exact: false })).toBeVisible();

    // Gerar de novo pede o motivo e zera as assinaturas.
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await page.getByRole("region", { name: "O PDF gerado" }).getByRole("button", { name: "Gerar de novo" }).click();
    const deNovo = page.getByRole("dialog", { name: "Gerar o contrato de novo" });
    await deNovo.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(deNovo.getByText("Diga por que gerar de novo (as assinaturas começam do zero).")).toBeVisible();
    await deNovo.getByLabel("Por que gerar de novo").fill("Corrigir a data de início");
    await deNovo.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(deNovo).toHaveCount(0);
    await expect(page.getByText("Contrato gerado de novo", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Histórico dos envios" })).toContainText("Contrato nº 1 · substituído");
    await expect(page.getByRole("region", { name: "O PDF gerado" })).toContainText("contrato nº 2");
    await conferir(page);
  });

  test("Modelos › Contrato: versões, campo escrito errado, revisão do advogado e Usar esta versão", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/modelos?aba=contrato`);
    const versoes = page.getByRole("region", { name: "Versões do modelo" });
    await expect(versoes).toContainText("Revisado por Rui Barros, OAB DF 12345");
    await expect(versoes.getByText("Em uso", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Texto da v1" })).toContainText("«condominio»");
    await expect(page.getByRole("list", { name: "Campos do modelo" }).getByRole("listitem")).toHaveCount(12);
    expect(await baixar(page, () => page.getByRole("button", { name: "Baixar em PDF de exemplo" }).click())).toBe("modelo-contrato-v1-exemplo.pdf");
    await conferir(page);

    await page.getByRole("button", { name: "Cadastrar versão nova" }).click();
    const janela = page.getByRole("dialog", { name: "Cadastrar versão nova" });
    const texto = janela.getByLabel("Texto do contrato");
    await expect(texto).toHaveValue(/«condominio»/);
    const original = await texto.inputValue();
    await texto.fill(`${original}\n\nAssina «nome_do_sindico».`);
    await expect(janela.getByText("Campo escrito errado ou que não existe: «nome_do_sindico».", { exact: false })).toBeVisible();
    await janela.getByLabel("OAB").fill("12345");
    await janela.getByRole("button", { name: "Cadastrar a versão" }).click();
    await expect(janela.getByText("Diga o nome do advogado que revisou.")).toBeVisible();
    await expect(janela.getByText("Diga a OAB do advogado (por exemplo, DF 12345).")).toBeVisible();
    await conferir(page);
    await texto.fill(`${original}\n\nAssina «representante».`);
    await janela.getByLabel("OAB").fill("");
    await janela.getByRole("button", { name: "Cadastrar a versão" }).click();
    await expect(janela).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Versão v2 cadastrada como rascunho." })).toBeVisible();
    await expect(versoes.getByText("Rascunho guardado")).toBeVisible();
    const v2 = page.getByRole("region", { name: "Texto da v2" });
    await expect(v2.getByRole("button", { name: "Usar esta versão" })).toBeDisabled();
    await expect(v2.getByText("Para usar falta a revisão do advogado (nome, OAB e data).")).toBeVisible();
    await conferir(page);

    await v2.getByRole("button", { name: "Editar o rascunho" }).click();
    const editar = page.getByRole("dialog", { name: "Editar o rascunho v2" });
    await editar.getByLabel("Advogado").fill("Rui Barros");
    await editar.getByLabel("OAB").fill("OAB/DF 12.345");
    await editar.getByLabel("Revisado em").fill(api.comercial.hoje);
    await editar.getByRole("button", { name: "Salvar o rascunho" }).click();
    await expect(editar).toHaveCount(0);
    await v2.getByRole("button", { name: "Usar esta versão" }).click();
    const usar = page.getByRole("dialog", { name: "Usar a v2" });
    await expect(usar.getByText("A v1, em uso hoje, fica substituída.", { exact: false })).toBeVisible();
    await conferir(page);
    await usar.getByRole("button", { name: "Usar esta versão" }).click();
    await expect(usar).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "A v2 está em uso." })).toBeVisible();
    await expect(versoes.getByText("Substituída")).toBeVisible();
    expect(api.comercial.pedidos.filter((x) => x.caminho.endsWith("/usar")).at(-1)?.corpo).toMatchObject({ versao: 2 });
  });

  test("Estados: sem modelo em uso, o Comercial sem a aba Contrato nem o contrato do cliente, e o link fechado do perdido", async ({ page }) => {
    const api = await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    api.comercial.contrato.modelos[0]!.situacao = "RASCUNHO";
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await expect(page.getByText("Sem modelo em uso")).toBeVisible();
    await expect(page.getByRole("region", { name: "Gerar contrato" }).getByRole("button", { name: "Gerar contrato" })).toBeDisabled();
    await expect(page.getByText("Nenhuma versão do modelo de contrato está em uso.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir Modelos › Contrato" })).toHaveCount(0);
    await conferir(page);

    await page.goto(`${CONSOLE}/comercial/modelos?aba=contrato`);
    await expect(page.getByRole("button", { name: "Mensagens" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Contrato", exact: true })).toHaveCount(0);

    // Assinado pelos dois, o Comercial vê o Virar cliente desligado e não envia pela TRÍADE.
    api.comercial.contrato.modelos[0]!.situacao = "EM_USO";
    contratoAssinado(api.comercial, CERRADO);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await expect(page.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" })).toHaveCount(0);
    const depois = page.getByRole("region", { name: "Depois de assinado" });
    await expect(depois.getByRole("button", { name: "Virar cliente" })).toBeDisabled();
    await expect(depois.getByText("Só a Administração cria o cliente.", { exact: false })).toBeVisible();
    await conferir(page);

    // Depois de virar cliente, o Comercial vê só que o contrato foi assinado (CM-11).
    const cerrado = api.comercial.interessados.find((i) => i.id === CERRADO)!;
    Object.assign(cerrado, { etapa: "GANHO", virouClienteEm: new Date().toISOString() });
    await page.goto(`${CONSOLE}/comercial/${CERRADO}/contrato`);
    await expect(page.getByText("O contrato está na ficha do cliente")).toBeVisible();
    await expect(page.getByText(/Contrato nº 1, assinado pelos dois em/)).toBeVisible();
    await conferir(page);

    Object.assign(cerrado, { etapa: "PERDIDO", virouClienteEm: undefined });
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}/contrato`);
    await expect(page.getByRole("heading", { name: "Este link não recebe mais arquivos", level: 1 })).toBeVisible();
    await conferir(page);
  });
});

// Desfazer e reativar (0318, R17.7c; quadros 487 a 491; CM-31 e CM-32) com a API falsa: os selos
// Desfeito e Reativado e o cartão "No último dia, fecha / Fica" na aba Cancelamentos; o confirmado
// que a Administração desfaz antes do último dia, com a nota; depois dele, o caminho para Reativar; a
// página Reativar com o Gerar sem modelo desligado, o aditivo de retorno gerado (e gerado de novo), o
// PDF, as duas assinaturas pelo gov.br enviadas e conferidas pela equipe e o Reativar que diz o que
// falta até ligar; o Comercial sem desfazer nem reativar; as assinaturas do aditivo de reajuste; e
// Modelos › Aditivo › Retorno. Cada tela passa no axe, não usa emoji e não rola para o lado no celular.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { K_CERRADO, K_JATOBA, ligarRetorno } from "./api-falsa-console-renovacoes";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** A competência do mês que vem ("2026-12-01"), a que o Gerar sugere. */
function mesQueVem(): string {
  const d = new Date(`${hoje()}T12:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const br = (d: string) => d.split("-").reverse().join("/");
const pdf = (name: string, conteudo: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7\n${conteudo}\n%%EOF`) });
const reativar = (id: string) => `${CONSOLE}/comercial/renovacoes/cancelamentos/${id}/reativar`;

test.describe("Console · Desfazer e reativar (R17.7c)", () => {
  test("cancelamentos (quadros 487, 490 e 491): os estados, o fecha e fica e desfazer antes do último dia", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    ligarRetorno(api.comercial.renovacoes);
    await page.goto(`${CONSOLE}/comercial/renovacoes?aba=cancelamentos`);
    const pedidos = page.getByRole("list", { name: "Pedidos de cancelamento" });
    const item = (nome: string) => pedidos.getByRole("listitem").filter({ hasText: nome });
    await expect(item("Residencial Cerrado Alto")).toContainText("Confirmado");
    await expect(item("Residencial Cerrado Alto")).toContainText(`último dia ${br(somarDias(hoje(), 24))} · faltam 24 dias`);
    await expect(item("Edifício Jatobá")).toContainText(`saiu em ${br(somarDias(hoje(), -15))} · só consulta`);
    await expect(item("Condomínio Ipê Amarelo")).toContainText("Desfeito");
    await expect(item("Condomínio Ipê Amarelo")).toContainText(`desfeito em ${diaMes(somarDias(hoje(), -1))} por Carolina`);
    await expect(item("Residencial Aroeira")).toContainText("Reativado");
    await expect(item("Residencial Aroeira")).toContainText(`reativado em ${br(somarDias(hoje(), -5))} por Carolina`);
    const fecha = page.getByRole("region", { name: "No último dia, fecha" });
    await expect(fecha).toContainText("Sozinho, à meia-noite");
    await expect(fecha.getByRole("list", { name: "O que fecha no último dia" })).toContainText("O mural, as etiquetas e todos os links públicos, que mostram a página de fora do ar.");
    await expect(page.getByRole("region", { name: "Fica", exact: true })).toContainText("O link para parar de receber e-mail.");
    await conferir(page);

    // O confirmado antes do último dia: a Administração desfaz, com a nota de quem pediu e como.
    await page.getByRole("button", { name: "Abrir o cancelamento do Residencial Cerrado Alto" }).click();
    const janela = page.getByRole("dialog", { name: "Cancelamento confirmado" });
    await expect(janela).toContainText(`${diaMes(somarDias(hoje(), -2))} 15:40 por Carolina · motivo: síndico novo`);
    await expect(janela).toContainText(`${br(somarDias(hoje(), 24))} · faltam 24 dias · o acesso continua até lá`);
    await expect(janela).toContainText("Pedida para o síndico ativo na confirmação; fica com ele.");
    await expect(janela.getByRole("list", { name: "O que acontece ao desfazer" })).toContainText("O último dia sai: o condomínio segue com tudo, sem nada para religar.");
    await conferir(page);
    await janela.getByRole("button", { name: "Desfazer o cancelamento" }).click();
    await expect(janela.getByText("Diga quem pediu para desfazer e como (de 3 a 300 letras).")).toBeVisible();
    await janela.getByLabel("Quem pediu para desfazer e como").fill("Marta Lima, síndica, pelo WhatsApp comercial");
    await janela.getByRole("button", { name: "Desfazer o cancelamento" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cancelamento desfeito. O Residencial Cerrado Alto segue com tudo, sem nada para religar." })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${K_CERRADO}/desfazer`)?.corpo)
      .toEqual({ versao: 2, nota: "Marta Lima, síndica, pelo WhatsApp comercial" });
    await expect(item("Residencial Cerrado Alto")).toContainText("Desfeito");

    // O desfeito e o reativado contam o que houve.
    await page.getByRole("button", { name: "Abrir o cancelamento do Condomínio Ipê Amarelo" }).click();
    const desfeito = page.getByRole("dialog", { name: "Cancelamento desfeito" });
    await expect(desfeito).toContainText('por Carolina: "Paula Reis, síndica, pelo WhatsApp comercial". O contrato de hoje continua.');
    await expect(desfeito.getByRole("button", { name: "Desfazer o cancelamento" })).toHaveCount(0);
    await desfeito.getByRole("button", { name: "Fechar" }).first().click();
    await page.getByRole("button", { name: "Abrir o cancelamento do Residencial Aroeira" }).click();
    const reativado = page.getByRole("dialog", { name: "Cliente reativado" });
    await expect(reativado).toContainText(`Reativado em ${br(somarDias(hoje(), -5))} por Carolina pelo aditivo nº 2`);
    await reativado.getByRole("button", { name: "Fechar" }).first().click();

    // Depois do último dia, Desfazer some e o caminho é Reativar.
    await page.getByRole("button", { name: "Abrir o cancelamento do Edifício Jatobá" }).click();
    const encerrado = page.getByRole("dialog", { name: "Cancelamento encerrado" });
    await expect(encerrado).toContainText("O último dia passou");
    await expect(encerrado.getByRole("button", { name: "Desfazer o cancelamento" })).toHaveCount(0);
    await conferir(page);
    await encerrado.getByRole("link", { name: "Reativar o cliente" }).click();
    await expect(page).toHaveURL(new RegExp(`/comercial/renovacoes/cancelamentos/${K_JATOBA}/reativar$`));
    await expect(page.getByRole("heading", { name: "Reativar · Edifício Jatobá", level: 1 })).toBeVisible();
  });

  test("Reativar sem modelo de retorno: Gerar e Reativar desligados, dizendo o que falta", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    ligarRetorno(api.comercial.renovacoes);
    await page.goto(reativar(K_JATOBA));
    await expect(page.getByRole("heading", { name: "Reativar · Edifício Jatobá", level: 1 })).toBeVisible();
    await expect(page.getByText("Nenhuma versão do aditivo de retorno está em uso.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar o aditivo" })).toBeDisabled();
    const botao = page.getByRole("button", { name: "Reativar o cliente" });
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveAccessibleDescription(/Falta pôr em uso o modelo de retorno e gerar o aditivo\./);
    await expect(page.getByRole("region", { name: "Ao reativar, volta" })).toContainText("A cobrança, a partir da competência escolhida.");
    await expect(page.getByRole("region", { name: "Não volta" })).toContainText("O preço de fundador.");
    await expect(page.getByRole("link", { name: "Abrir Modelos › Aditivo" })).toHaveAttribute("href", "/comercial/modelos?aba=aditivo&parte=retorno");
    await conferir(page);
  });

  test("Reativar (quadro 488): gerar o aditivo de retorno, gerar de novo, as duas assinaturas e reativar", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    ligarRetorno(api.comercial.renovacoes, { modeloRetorno: true });
    await page.goto(reativar(K_JATOBA));
    const botao = page.getByRole("button", { name: "Reativar o cliente" });
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveAccessibleDescription(/Falta gerar o aditivo de retorno\./);
    const aditivo = page.getByRole("region", { name: /Aditivo de retorno/ });
    await expect(aditivo).toContainText("Tabela cheia do dia · 38 unidades (até 40 unidades) · R$ 229,00 por mês");
    await conferir(page);

    // Gerar: quem assina, o CPF, a competência e o ciclo.
    await aditivo.getByRole("button", { name: "Gerar o aditivo" }).click();
    const gerar = page.getByRole("dialog", { name: "Gerar o aditivo de retorno" });
    await expect(gerar.getByLabel("Cobrança volta na competência")).toHaveValue(mesQueVem());
    await expect(gerar.getByLabel("Valor combinado por mês (R$)")).toHaveCount(0);
    await gerar.getByRole("button", { name: "Gerar o aditivo" }).click();
    await expect(gerar.getByText("Diga o nome de quem assina pelo condomínio.")).toBeVisible();
    await expect(gerar.getByText("Confira o CPF: os números não batem.")).toBeVisible();
    await gerar.getByLabel("Quem assina pelo condomínio").fill("Rui Campos, síndico");
    await gerar.getByLabel("CPF de quem assina").fill("11122233344");
    await conferir(page);
    await gerar.getByRole("button", { name: "Gerar o aditivo" }).click();
    await expect(gerar.getByText("Confira o CPF: os números não batem.")).toBeVisible();
    await gerar.getByLabel("CPF de quem assina").fill("52998224725");
    await expect(gerar.getByLabel("CPF de quem assina")).toHaveValue("529.982.247-25");
    await gerar.getByRole("button", { name: "Gerar o aditivo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Aditivo de retorno nº 2 gerado. Baixe o PDF e mande ao síndico para assinar pelo gov.br." })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${K_JATOBA}/retorno/aditivo`)?.corpo)
      .toEqual({ representante: "Rui Campos, síndico", cpf: "52998224725", competencia: mesQueVem(), ciclo: "MENSAL" });
    const n2 = page.getByRole("region", { name: "Aditivo de retorno nº 2" });
    await expect(n2).toContainText("Rui Campos, síndico · CPF ***.982.247-**");
    await expect(n2).toContainText(`cobrança desde a competência ${mesQueVem().slice(5, 7)}/${mesQueVem().slice(0, 4)}`);
    await expect(n2).toContainText("Aditivo de retorno ao contrato v1");

    // Gerar de novo pede o motivo; as assinaturas começam do zero.
    await n2.getByRole("button", { name: "Gerar de novo" }).click();
    const deNovo = page.getByRole("dialog", { name: "Gerar o aditivo de novo" });
    await deNovo.getByLabel("Quem assina pelo condomínio").fill("Rui Campos, síndico");
    await deNovo.getByLabel("CPF de quem assina").fill("52998224725");
    await deNovo.getByRole("radio", { name: "Anual" }).check({ force: true });
    await deNovo.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(deNovo.getByText("Diga por que gerar de novo (as assinaturas começam do zero).")).toBeVisible();
    await deNovo.getByLabel("Por que gerar de novo").fill("O síndico pediu o plano anual");
    await conferir(page);
    await deNovo.getByRole("button", { name: "Gerar de novo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Aditivo gerado de novo. As duas assinaturas começam do zero" })).toBeVisible();
    expect(api.comercial.pedidos.filter((x) => x.caminho === `/v1/comercial/cancelamentos/${K_JATOBA}/retorno/aditivo`).at(-1)?.corpo)
      .toEqual({ representante: "Rui Campos, síndico", cpf: "52998224725", competencia: mesQueVem(), ciclo: "ANUAL", motivo: "O síndico pediu o plano anual" });
    const n3 = page.getByRole("region", { name: "Aditivo de retorno nº 3" });
    await expect(n3).toContainText("Até 40 unidades, anual");
    const baixa = page.waitForEvent("download");
    await n3.getByRole("button", { name: "Baixar o PDF" }).click();
    expect((await baixa).suggestedFilename()).toBe("aditivo-3.pdf");

    // As assinaturas: primeiro o condomínio (a equipe envia o PDF que o síndico mandou), depois a TRÍADE.
    const assinaturas = page.getByRole("region", { name: "Assinaturas pelo gov.br" });
    await expect(assinaturas).toContainText("0 de 2");
    await expect(assinaturas).toContainText("Aguardando");
    await expect(assinaturas).toContainText("Espera o condomínio");
    await expect(botao).toHaveAccessibleDescription(/Falta: a assinatura do condomínio e a assinatura da TRÍADE\./);
    await expect(page.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Baixar o PDF assinado pelo condomínio" })).toBeDisabled();
    await conferir(page);

    await assinaturas.getByRole("button", { name: "Enviar o PDF que o condomínio mandou" }).click();
    const enviar = page.getByRole("dialog", { name: "Enviar o PDF que o condomínio assinou" });
    await enviar.getByLabel("Escolher o PDF assinado").setInputFiles(pdf("aditivo-sem.pdf", "SEM-ASSINATURA"));
    await enviar.getByRole("button", { name: "Enviar o PDF assinado" }).click();
    await expect(enviar.getByText("O PDF enviado não tem assinatura digital nova.")).toBeVisible();
    await enviar.locator("input[type=file]").setInputFiles(pdf("aditivo-rui.pdf", "assinado pelo sindico"));
    await conferir(page);
    await enviar.getByRole("button", { name: "Enviar o PDF assinado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "PDF assinado pelo condomínio recebido. Falta conferir no validar.iti.gov.br." })).toBeVisible();
    await expect(assinaturas).toContainText("Falta conferir");
    await expect(botao).toHaveAccessibleDescription(/Falta: conferir a assinatura do condomínio e a assinatura da TRÍADE\./);

    await assinaturas.getByRole("button", { name: "Conferir a assinatura" }).click();
    const conferirCond = page.getByRole("dialog", { name: "Conferir a assinatura do condomínio" });
    await expect(conferirCond.getByRole("button", { name: "Marcar como conferida" })).toBeDisabled();
    await expect(conferirCond.getByLabel("Nome de quem assinou")).toHaveValue("Rui Campos, síndico");
    await conferirCond.getByLabel("A assinatura é válida").check();
    await conferirCond.getByLabel("Quem assinou representa o condomínio").check();
    await conferirCond.getByLabel("Foi assinado depois de gerado").check();
    await conferir(page);
    await conferirCond.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Assinatura do condomínio conferida. Agora a TRÍADE assina sobre o mesmo arquivo." })).toBeVisible();
    const envioCond = api.comercial.pedidos.find((x) => /\/v1\/comercial\/envios-aditivo\/[0-9a-f-]+\/conferir$/.test(x.caminho));
    expect(envioCond?.corpo).toEqual({ versao: 1, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: null, assinanteNome: "Rui Campos, síndico", observacao: null });
    await expect(assinaturas).toContainText("1 de 2");
    await expect(assinaturas).toContainText("Sua vez");

    await page.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" }).click();
    const triade = page.getByRole("dialog", { name: "Enviar o PDF assinado pela TRÍADE" });
    await expect(triade.getByRole("button", { name: "Baixar o PDF assinado pelo condomínio" })).toBeEnabled();
    await triade.getByLabel("Escolher o PDF assinado").setInputFiles(pdf("aditivo-triade.pdf", "assinado pelos dois"));
    await triade.getByRole("button", { name: "Enviar o PDF assinado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "PDF assinado pela TRÍADE recebido." })).toBeVisible();

    await assinaturas.getByRole("button", { name: "Conferir a assinatura" }).click();
    const conferirTriade = page.getByRole("dialog", { name: "Conferir a assinatura da TRÍADE" });
    await conferirTriade.getByLabel("A assinatura é válida").check();
    await conferirTriade.getByLabel("Quem assinou é quem assina pela TRÍADE").check();
    await conferirTriade.getByLabel("Foi assinado depois de gerado").check();
    await conferirTriade.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(conferirTriade.getByText("Digite o CPF que o validador mostra.")).toBeVisible();
    await conferirTriade.getByLabel("CPF de quem assinou pela TRÍADE").fill("52998224725");
    await conferirTriade.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Assinatura da TRÍADE conferida. Aditivo assinado pelos dois." })).toBeVisible();
    await expect(assinaturas).toContainText("2 de 2");

    // Com as duas conferidas, Reativar liga.
    await expect(botao).toBeEnabled();
    await conferir(page);
    await botao.click();
    const confirmar = page.getByRole("dialog", { name: "Reativar o cliente" });
    await expect(confirmar).toContainText(`O último dia (${br(somarDias(hoje(), -15))}) é revogado e fica no histórico.`);
    await conferir(page);
    await confirmar.getByRole("button", { name: "Reativar o cliente" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Edifício Jatobá reativado. O acesso volta no modo completo e a cobrança volta na competência ${mesQueVem().slice(5, 7)}/${mesQueVem().slice(0, 4)}.` })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${K_JATOBA}/reativar`)?.corpo).toEqual({ versao: 3 });
    await expect(page.getByText("Cliente de novo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reativar o cliente" })).toHaveCount(0);
  });

  test("o Comercial vê e envia o PDF do síndico, mas não desfaz, não gera e não reativa", async ({ page }) => {
    const api = await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    ligarRetorno(api.comercial.renovacoes, { modeloRetorno: true });
    await page.goto(`${CONSOLE}/comercial/renovacoes?aba=cancelamentos`);
    await page.getByRole("button", { name: "Abrir o cancelamento do Residencial Cerrado Alto" }).click();
    const janela = page.getByRole("dialog", { name: "Cancelamento confirmado" });
    await expect(janela).toContainText("O Comercial vê o pedido e a volta, mas desfazer, gerar o aditivo e reativar são da Administração.");
    await expect(janela.getByRole("button", { name: "Desfazer o cancelamento" })).toHaveCount(0);
    await expect(janela.getByLabel("Quem pediu para desfazer e como")).toHaveCount(0);
    await conferir(page);

    await page.goto(reativar(K_JATOBA));
    await expect(page.getByRole("heading", { name: "Reativar · Edifício Jatobá", level: 1 })).toBeVisible();
    await expect(page.getByText("Só a Administração", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reativar o cliente" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Gerar o aditivo" })).toHaveCount(0);
    await conferir(page);
  });

  test("o aditivo de reajuste: o PDF e as assinaturas pelo gov.br, valendo pelo aviso", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/renovacoes`);
    await page.getByRole("button", { name: "Assinaturas do aditivo nº 1 do Condomínio Águas Claras" }).click();
    const janela = page.getByRole("dialog", { name: "Aditivo nº 1" });
    await expect(janela).toContainText("O reajuste vale pelo aviso");
    await expect(janela).toContainText("com ou sem estas assinaturas");
    const assinaturas = janela.getByRole("region", { name: "Assinaturas pelo gov.br" });
    await expect(assinaturas).toContainText("0 de 2");
    await expect(assinaturas).toContainText("No aditivo de reajuste, a assinatura só fica registrada: o reajuste continua valendo pelo aviso.");
    await expect(assinaturas.getByRole("button", { name: "Enviar o PDF assinado pela TRÍADE" })).toHaveCount(0);
    await conferir(page);
    const baixa = page.waitForEvent("download");
    await janela.getByRole("button", { name: "Baixar o PDF do aditivo" }).click();
    expect((await baixa).suggestedFilename()).toBe("aditivo-1-c3.pdf");

    await assinaturas.getByRole("button", { name: "Enviar o PDF que o condomínio mandou" }).click();
    const enviar = page.getByRole("dialog", { name: "Enviar o PDF que o condomínio assinou" });
    await enviar.getByLabel("Escolher o PDF assinado").setInputFiles(pdf("aditivo-paula.pdf", "assinado pela sindica"));
    await enviar.getByRole("button", { name: "Enviar o PDF assinado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "PDF assinado pelo condomínio recebido." })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/aditivos/9c3d4e5f-0000-4000-8000-0000000000f1/envios")?.corpo)
      .toEqual({ parte: "CONDOMINIO", nome: "aditivo-paula.pdf", tamanho: expect.any(Number) });
    await expect(page.getByRole("list", { name: "Aniversários de contrato" }).or(page.getByRole("table", { name: /Aniversários de contrato/ })))
      .toContainText("aditivo nº 1");

    await page.getByRole("button", { name: "Assinaturas do aditivo nº 1 do Condomínio Águas Claras" }).click();
    const de2 = page.getByRole("dialog", { name: "Aditivo nº 1" });
    await de2.getByRole("button", { name: "Conferir a assinatura" }).click();
    const conferirCond = page.getByRole("dialog", { name: "Conferir a assinatura do condomínio" });
    await conferirCond.getByLabel("A assinatura é válida").check();
    await conferirCond.getByLabel("Quem assinou representa o condomínio").check();
    await conferirCond.getByLabel("Foi assinado depois de gerado").check();
    await conferirCond.getByRole("button", { name: "Marcar como conferida" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Assinatura do condomínio conferida." })).toBeVisible();
    await expect(page.getByRole("list", { name: "Aniversários de contrato" }).or(page.getByRole("table", { name: /Aniversários de contrato/ })))
      .toContainText("aditivo nº 1, 1 de 2 assinaturas");
  });

  test("Modelos › Aditivo › Retorno: os campos, a versão nova e o usar", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/modelos?aba=aditivo&parte=retorno`);
    const partes = page.getByRole("navigation", { name: "Partes do aditivo" });
    await expect(partes.getByRole("button", { name: /Retorno/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Nenhuma versão do aditivo de retorno")).toBeVisible();
    const campos = page.getByRole("list", { name: "Campos do aditivo de retorno" });
    for (const c of ["condominio", "cnpj", "representante", "cpf_representante", "contrato", "data_contrato", "ultimo_dia", "plano", "valor_mensal", "vale_desde"]) {
      await expect(campos).toContainText(`«${c}»`);
    }
    await expect(campos).not.toContainText("«valor_novo»");
    await expect(page.getByRole("region", { name: "Onde é usado" })).toContainText("Renovações › Cancelamentos › Reativar");
    await conferir(page);

    await page.getByRole("button", { name: "Cadastrar versão nova" }).click();
    const nova = page.getByRole("dialog", { name: "Cadastrar versão nova do aditivo de retorno" });
    const texto = nova.getByLabel("Texto do aditivo");
    await expect(texto).toHaveValue(/«cpf_representante»/);
    const inicial = await texto.inputValue();
    await texto.fill(`${inicial} O valor novo é «valor_novo».`);
    await expect(nova.getByText("Campo escrito errado ou que não existe: «valor_novo». Use só os campos da lista.")).toBeVisible();
    await texto.fill(inicial);
    await conferir(page);
    await nova.getByRole("button", { name: "Cadastrar a versão" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Versão v1 do aditivo de retorno cadastrada como rascunho." })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/modelos/aditivo")?.corpo)
      .toEqual({ versao: null, tipo: "RETORNO", titulo: "Aditivo de retorno ao contrato", texto: inicial });
    await expect(page.getByRole("region", { name: "Versões do aditivo de retorno" })).toContainText("Rascunho");

    await page.getByRole("button", { name: "Usar esta versão" }).click();
    const usar = page.getByRole("dialog", { name: "Usar a v1 do aditivo de retorno" });
    await expect(usar).toContainText("A versão em uso da outra parte não muda.");
    await usar.getByRole("button", { name: "Usar esta versão" }).click();
    await expect(page.getByRole("status").filter({ hasText: "A v1 do aditivo de retorno está em uso." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Versões do aditivo de retorno" })).toContainText("Em uso");

    // A versão em uso do reajuste continua a mesma.
    await partes.getByRole("button", { name: /Reajuste/ }).click();
    await expect(page.getByRole("region", { name: "Versões do aditivo de reajuste" })).toContainText("Em uso");
    await expect(page.getByRole("list", { name: "Campos do aditivo de reajuste" })).toContainText("«valor_novo»");
    await conferir(page);
  });
});

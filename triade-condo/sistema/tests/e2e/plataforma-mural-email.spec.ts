// Mural online e e-mail (CD-12, CD-13, CD-14) com a API falsa: o mural sem conta, os links do
// e-mail, as configurações, como vai chegar e como chegou, o e-mail do contato e os pedidos de
// documento. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { LINK_FALSO, MURAL_FALSO } from "./api-falsa-comunicados";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Mural online e e-mail", () => {
  test("CD-12: o mural abre sem login, só com o que é de todos, e o link antigo diz que mudou", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await expect(page.getByRole("heading", { level: 1, name: "Mural do Residencial Ipê" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText("Assembleia geral ordinária")).toHaveCount(0);
    await expect(page.getByText("Ana Souza")).toHaveCount(0);
    await conferir(page);
    await page.getByRole("link", { name: /Ler tudo/ }).click();
    await expect(page.getByText("Ana, síndica do Residencial Ipê")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Voltar ao mural" }).click();
    await page.goto(`${PLATAFORMA}/m/AAAA-BBBB-CCCC`);
    await expect(page.getByText("Este mural não existe")).toBeVisible();
  });

  test("CD-14: pedir documento pelo mural tem resposta neutra", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await page.getByRole("button", { name: "Pedir por e-mail" }).click();
    await expect(page.getByRole("heading", { name: "Pedir documento por e-mail" })).toBeVisible();
    await page.getByLabel("Seu e-mail").fill("sem-arroba");
    await page.getByRole("button", { name: "Pedir", exact: true }).click();
    await expect(page.getByText("Confira o e-mail")).toBeVisible();
    await page.getByLabel("Seu e-mail").fill("joana@exemplo.com.br");
    await page.getByRole("button", { name: "Pedir", exact: true }).click();
    await expect(page.getByText("Se este e-mail estiver cadastrado no condomínio")).toBeVisible();
    await conferir(page);
  });

  test("CD-13, CD-14: os links do e-mail confirmam, param e abrem só com um toque", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/e/confirmar?c=${LINK_FALSO}`);
    await conferir(page);
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();
    await page.goto(`${PLATAFORMA}/e/parar?c=${LINK_FALSO}`);
    await page.getByRole("button", { name: "Parar de receber" }).click();
    await expect(page.getByRole("heading", { name: "Você não recebe mais e-mails do Residencial Ipê" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Voltar a receber" }).click();
    await expect(page.getByRole("heading", { name: "Você voltou a receber os comunicados por e-mail" })).toBeVisible();
    await page.goto(`${PLATAFORMA}/c/${LINK_FALSO}`);
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/e/confirmar?c=outro-codigo-que-venceu`);
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await expect(page.getByText(/venceu ou foi cancelado/)).toBeVisible();
    await page.goto(`${PLATAFORMA}/d/${LINK_FALSO}`);
    await expect(page.getByRole("button", { name: "Abrir o documento" })).toBeVisible();
    await conferir(page);
  });

  test("CD-12, CD-13: configurações mostram o link, o QR, o e-mail e trocam o link com motivo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=comunicados`);
    const aba = page.getByRole("tab", { name: "Comunicados" });
    if (await aba.isVisible()) await aba.click();
    await expect(page.getByRole("heading", { name: "Mural online e e-mail" })).toBeVisible();
    await expect(page.getByText(`/m/${MURAL_FALSO}`)).toBeVisible();
    await expect(page.getByRole("img", { name: "QR do mural online" })).toBeVisible();
    await expect(page.getByText("Aberto 214 vezes nos últimos 7 dias")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Trocar link" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Trocar link" }).click();
    await expect(page.getByText("Diga o motivo")).toBeVisible();
    await page.getByLabel("Por que trocar").fill("O link foi parar num grupo de vendas do bairro");
    await page.getByRole("dialog").getByRole("button", { name: "Trocar link" }).click();
    await expect(page.getByText("/m/AB3C-DE4F-GH5J")).toBeVisible();
    await page.getByRole("switch", { name: /Enviar os comunicados também por e-mail/ }).uncheck();
    await page.getByRole("button", { name: "Salvar mural e e-mail" }).click();
    await expect(page.getByText("Mural e e-mail salvos.")).toBeVisible();
  });

  test("CD-12, CD-13: escrever mostra como vai chegar; o publicado mostra como chegou e corrige avisando por e-mail", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    const chegar = page.getByRole("region", { name: "Como vai chegar" });
    await expect(chegar.getByRole("switch", { name: /Aparece no mural online/ })).toBeVisible();
    await expect(chegar.getByText("1 contato com e-mail confirmado.")).toBeVisible();
    await expect(chegar.getByText("2 contatos sem e-mail confirmado")).toBeVisible();
    await page.getByRole("group", { name: "Para quem" }).getByRole("button", { name: "Blocos" }).click();
    await page.getByRole("checkbox", { name: "Torre A" }).check();
    await expect(chegar.getByRole("switch", { name: /Aparece no mural online/ })).toBeDisabled();
    await conferir(page);
    await page.getByRole("group", { name: "Para quem" }).getByRole("button", { name: "Todo o condomínio" }).click();
    await page.getByLabel("Título").fill("Dedetização das áreas comuns");
    await page.getByRole("textbox", { name: "Texto", exact: true }).fill("Na segunda, das 8h às 12h.");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dedetização das áreas comuns" })).toBeVisible();
    const chegou = page.getByRole("region", { name: "Como chegou" });
    await expect(chegou.getByText("E-mail · 1 enviado")).toBeVisible();
    await expect(chegou.getByText("Aparece no mural agora.")).toBeVisible();
    await conferir(page);
    await chegou.getByRole("button", { name: "Tirar do mural" }).click();
    await expect(page.getByText("Comunicado tirado do mural online.")).toBeVisible();
    await expect(chegou.getByText("Fora do mural.")).toBeVisible();
    await page.getByRole("button", { name: "Corrigir" }).click();
    await page.getByRole("textbox", { name: "O que mudou" }).fill("Mudou o horário");
    await page.getByRole("checkbox", { name: /Avisar por e-mail quem recebeu a versão 1/ }).check();
    await page.getByRole("button", { name: "Publicar versão 2" }).click();
    await expect(page.getByText("E-mail da versão 2 para 1 contato")).toBeVisible();
  });

  test("CD-13: o e-mail do contato fica esperando a própria pessoa confirmar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("tab", { name: "Moradores", exact: true }).click();
    await page.getByRole("button", { name: /Sem e-mail confirmado/ }).click();
    await expect(page.getByText("Joana Lima")).toBeVisible();
    await expect(page.getByText("Marina Souza")).toHaveCount(0);
    await page.getByRole("link", { name: "Torre A · 102" }).first().click();
    await page.getByRole("button", { name: "Editar Joana Lima" }).click();
    await page.getByRole("textbox", { name: "E-mail (opcional)" }).fill("joana@");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Confira o e-mail")).toBeVisible();
    await page.getByRole("textbox", { name: "E-mail (opcional)" }).fill("joana@exemplo.com.br");
    await conferir(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/Joana Lima atualizado/)).toBeVisible();
    await expect(page.getByText(/· esperando confirmação/)).toBeVisible();
  });

  test("CD-14: os pedidos por e-mail esperam o síndico; o documento vai por e-mail e o link se cancela", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/documentos?filtro=PEDIDOS`);
    await expect(page.getByText("imobiliaria@exemplo.com.br")).toBeVisible();
    await expect(page.getByText("Não é contato do prédio", { exact: true })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: /Recusar o pedido de Regimento interno/ }).click();
    await page.getByRole("button", { name: "Recusar", exact: true }).click();
    await expect(page.getByText("Diga o motivo")).toBeVisible();
    await page.getByLabel("Por que recusar").fill("Não é do prédio");
    await page.getByRole("button", { name: "Recusar", exact: true }).click();
    await expect(page.getByText("Pedido recusado.")).toBeVisible();

    await page.goto(`${PLATAFORMA}/comunicados/documentos`);
    await page.getByRole("link", { name: "Regimento interno" }).click();
    await page.getByRole("button", { name: "Enviar por e-mail" }).click();
    await page.getByRole("checkbox", { name: /Marina Souza/ }).check();
    await page.getByLabel("Outros e-mails").fill("advogado@exemplo.com.br");
    await conferir(page);
    await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText("Documento enviado a 2 pessoas. O link vale 7 dias.")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar o link enviado a advogado@exemplo.com.br" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar o link" }).click();
    await expect(page.getByText("Link cancelado.")).toBeVisible();
  });
});

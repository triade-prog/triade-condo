// WhatsApp do condomínio na Plataforma (passo 5; W-05, W-10 a W-16, W-21) com a API falsa: a lista
// "A identificar" (arquivar com motivo, ligar a um contato), as falhas de envio, a conversa no
// pedido (responder é dar retorno; revisão do morador não reabre sozinha) e Configurações ›
// WhatsApp (termo do piloto, mensagem sem promessa de prazo, avisos no próprio celular). Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { pedirRevisao } from "./api-falsa-whatsapp";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · WhatsApp do condomínio", () => {
  test("W-15: o menu leva ao WhatsApp; arquivar pede motivo e ligar a um contato reconhece o número", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("heading", { level: 1, name: "Residencial Ipê" })).toBeVisible();
    if (await page.getByRole("button", { name: "Menu" }).isVisible()) await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: /^WhatsApp/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "WhatsApp" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "A identificar (2)" })).toBeVisible();
    await expect(page.getByText("Vínculo a confirmar")).toBeVisible();
    await conferir(page);

    const primeira = page.getByRole("listitem").filter({ hasText: "reservar o salão" });
    await primeira.getByRole("button", { name: "Arquivar" }).click();
    const arq = page.getByRole("dialog", { name: "Arquivar a conversa" });
    await arq.getByRole("button", { name: "Confirmar" }).click();
    await expect(arq.getByText("Diga o motivo (3 a 300 caracteres).")).toBeVisible();
    await arq.getByLabel("Motivo").fill("Dúvida respondida por telefone");
    await arq.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Conversa arquivada.")).toBeVisible();

    const segunda = page.getByRole("listitem").filter({ hasText: "interfone do 203" });
    await segunda.getByRole("button", { name: "Ligar a um contato" }).click();
    const lig = page.getByRole("dialog", { name: "Ligar o número a um contato" });
    await expect(lig.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await lig.getByLabel("Nome ou unidade").fill("Pedro");
    await lig.getByRole("button", { name: "Buscar" }).click();
    await lig.getByRole("button", { name: /^Pedro Souza/ }).first().click();
    await conferir(page);
    await lig.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Número ligado ao contato. As próximas mensagens já são reconhecidas.")).toBeVisible();
    await expect(page.getByText("Nada a identificar")).toBeVisible();
    expect(estado.whatsapp.aIdentificar).toHaveLength(0);
  });

  test("W-16: a falha de envio aparece com responsável e é reenviada com motivo", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("tab", { name: "Falhas de envio" }).click();
    await expect(page.getByText("Número sem WhatsApp")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText(/Ana Souza/)).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Reenviar com motivo" }).click();
    const j = page.getByRole("dialog", { name: "Reenviar a mensagem" });
    await j.getByRole("button", { name: "Reenviar" }).click();
    await expect(j.getByRole("alert")).toBeVisible();
    await j.getByLabel("Por que reenviar").fill("O morador ativou o WhatsApp no número");
    await j.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText("Nenhuma falha de envio")).toBeVisible();
    expect(estado.whatsapp.falhas).toHaveLength(0);

    await page.getByRole("tab", { name: "Conexão" }).click();
    await expect(page.getByText("Conexão de piloto, não oficial")).toBeVisible();
    await conferir(page);
  });

  test("W-13 e W-10: responder no pedido registra retorno; a revisão pedida não reabre sozinha", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const pedido = estado.pedidos[0]!;
    pedirRevisao(estado.whatsapp, pedido.id, "Continua pingando, pode olhar de novo?");
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${pedido.id}`);
    const conversa = page.getByRole("region", { name: "Conversa do WhatsApp" });
    await expect(conversa.getByText("A luz da garagem no subsolo 1 está piscando faz dois dias")).toBeVisible();
    await expect(conversa.getByText("O morador pediu revisão pelo WhatsApp")).toBeVisible();
    await expect(conversa.getByText("Entregue")).toBeVisible();
    await conferir(page);

    await conversa.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(conversa.getByText("Escreva a resposta (3 a 2000 caracteres).")).toBeVisible();
    await conversa.getByLabel("Responder pelo WhatsApp").fill("Marta, o eletricista passa amanhã às 9h.");
    await conversa.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(page.getByText("Retorno registrado e enviado pelo WhatsApp.")).toBeVisible();
    await expect(conversa.getByText("Marta, o eletricista passa amanhã às 9h.")).toBeVisible();
    expect(estado.whatsapp.enviados).toEqual(["Marta, o eletricista passa amanhã às 9h."]);

    await conversa.getByRole("button", { name: "Manter concluído e responder" }).click();
    const j = page.getByRole("dialog", { name: "Manter concluído e responder" });
    await j.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(j.getByText("Escreva a resposta ao morador.")).toBeVisible();
    await conferir(page);
    await j.getByLabel("Resposta ao morador").fill("O reparo foi conferido ontem; se voltar, abra um pedido novo.");
    await j.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText("Resposta enviada ao morador. O pedido segue concluído.")).toBeVisible();
    await expect(conversa.getByText("O morador pediu revisão pelo WhatsApp")).toBeHidden();
  });

  test("W-11, W-12 e W-21: termo do piloto, mensagem sem promessa de prazo e avisos no meu WhatsApp", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=whatsapp`);
    await expect(page.getByRole("heading", { name: "Termo do piloto do WhatsApp" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Li e aceito o termo do piloto" }).click();
    await expect(page.getByText("Termo do piloto aceito. A TRÍADE pode conectar o número.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Termo do piloto do WhatsApp" })).toBeHidden();
    expect(estado.whatsapp.conexao.termoAceitoEm).not.toBeNull();

    await page.getByLabel("Fora do horário").fill("Recebemos sua mensagem e respondemos em até 2 horas.");
    await expect(page.getByText("Tire a promessa de prazo ou de atendimento imediato.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
    await page.getByLabel("Fora do horário").fill("Recebemos sua mensagem fora do horário. O condomínio confere no próximo horário de atendimento.");
    await page.getByRole("button", { name: "60 min" }).click();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Configurações do WhatsApp salvas.")).toBeVisible();
    expect(estado.whatsapp.config.anexarMinutos).toBe(60);

    await page.getByLabel("Meu celular").fill("+55 61 99");
    await page.getByRole("button", { name: "Salvar meus avisos" }).click();
    await expect(page.getByText("Celular com DDI e DDD (ex.: +5561999998888).")).toBeVisible();
    await conferir(page);
    await page.getByLabel("Meu celular").fill("+55 (61) 99100-2233");
    await page.getByRole("button", { name: "Salvar meus avisos" }).click();
    await expect(page.getByText("Seus avisos no WhatsApp foram salvos.")).toBeVisible();
    expect(estado.whatsapp.meusAvisos?.telefone).toBe("+5561991002233");
  });
});

// WhatsApp do condomínio na Plataforma (passo 5; W-05, W-10 a W-17, W-20, W-21) com a API falsa,
// no padrão novo (D4, decisões A.1 a D.1 de 22/10/2026): a caixa em três partes (A identificar,
// Falhas, Quedas) com o selo do número no lugar da aba Conexão; a linha abre a conversa do número,
// de onde se arquiva com motivo, liga a um contato, junta a um pedido ou registra o pedido com a
// mensagem; a conversa no pedido logo abaixo do topo, a revisão do morador numa faixa que não
// reabre sozinha e a resposta pelo WhatsApp dentro de Dar retorno ao morador; e Configurações ›
// WhatsApp (termo do piloto, mensagem sem promessa de prazo, avisos no próprio celular). Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import { salvarPagina } from "./configuracoes";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { pedirRevisao } from "./api-falsa-whatsapp";
import { irAoPasso } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · WhatsApp do condomínio", () => {
  test("W-15: o menu leva ao WhatsApp; a conversa do número arquiva com motivo e liga a um contato", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Residencial Ipê");
    if (await page.getByRole("button", { name: "Mais", exact: true }).isVisible()) await page.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByRole("navigation", { name: "Plataforma" }).getByRole("link", { name: /^WhatsApp/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "WhatsApp" })).toBeVisible();
    const partes = page.getByRole("navigation", { name: "Partes do WhatsApp" });
    await expect(partes.locator('[aria-current="page"]')).toContainText("3");
    await expect(page.getByText("Chegou com o número desconectado").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Vínculo a confirmar").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("3 números · 3 mensagens.")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Abrir a conversa de +55 61 98877-1234" }).click();
    const conv = page.getByRole("dialog", { name: "+55 61 98877-1234" });
    await expect(conv.getByText("Oi, sou nova no 504, como faço para reservar o salão?")).toBeVisible();
    await expect(conv.getByText("Este número não é de ninguém ainda")).toBeVisible();
    await conferir(page);
    await conv.getByRole("button", { name: "Arquivar a conversa" }).click();
    const arq = page.getByRole("dialog", { name: "Arquivar a conversa" });
    await arq.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect(arq.getByText("Diga o motivo (3 a 300 caracteres).")).toBeVisible();
    await arq.getByLabel("Motivo").fill("Dúvida respondida por telefone");
    await arq.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect(page.getByText("Conversa arquivada.")).toBeVisible();
    expect(estado.whatsapp.triagens).toEqual([{ acao: "ARQUIVAR" }]);

    await page.getByRole("button", { name: "Abrir a conversa de +55 61 95555-4444" }).click();
    await page.getByRole("dialog", { name: "+55 61 95555-4444" }).getByRole("button", { name: "Ligar a um contato" }).click();
    const lig = page.getByRole("dialog", { name: "Ligar o número a um contato" });
    await expect(lig.getByRole("button", { name: "Ligar ao contato" })).toBeDisabled();
    await lig.getByLabel("Nome ou unidade").fill("Pedro");
    await lig.getByRole("button", { name: /^Pedro Souza/ }).first().click();
    await conferir(page);
    await lig.getByRole("button", { name: "Ligar ao contato" }).click();
    await expect(page.getByText("Número ligado ao contato. As próximas mensagens já são reconhecidas.")).toBeVisible();
    expect(estado.whatsapp.aIdentificar).toHaveLength(1);
    await expect(page.getByText("O interfone do 203 não toca")).toBeVisible();
  });

  test("B.1: registrar pedido com esta mensagem leva o relato e junta as mensagens ao pedido", async ({ page, isMobile }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("button", { name: "Abrir a conversa de +55 61 95555-4444" }).click();
    await page.getByRole("button", { name: "Registrar pedido com esta mensagem" }).click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await expect(j.getByText(/Das mensagens de/)).toContainText("+55 61 95555-4444");
    await expect(j.getByText("O morador não recebe o protocolo pelo WhatsApp")).toBeVisible();
    await conferir(page);
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await irAoPasso(j, isMobile, 2);
    await expect(j.getByLabel("O que foi relatado")).toHaveValue("Mandei ontem: o portão travou");
    await j.getByLabel("Assunto").fill("Portão travado");
    await irAoPasso(j, isMobile, 3);
    await j.getByRole("button", { name: /^Registrar/ }).last().click();
    await expect(j.getByText("Pedido registrado")).toBeVisible();
    await expect(j.getByText("As mensagens estão no pedido")).toBeVisible();
    await expect(j.getByRole("button", { name: "Registrar outro" })).toHaveCount(0);
    await conferir(page);
    const novo = estado.pedidos.find((p) => p.assunto === "Portão travado")!;
    expect(novo.historico[0]!.dados.canal).toBe("MENSAGEM");
    expect(estado.whatsapp.triagens).toEqual([{ acao: "PEDIDO", pedidoId: novo.id }]);
    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/pedido\\?id=${novo.id}`));
  });

  test("B.1: se juntar falhar, o pedido fica e dá para juntar de novo", async ({ page, isMobile }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    // A junção vai no mesmo registro (D4.20); aqui ela não acontece, e o pedido fica sem as mensagens.
    let falhar = true;
    await page.route(/\/v1\/condominio\/pedidos$/, (route) => {
      if (route.request().method() !== "POST" || !falhar) return route.fallback();
      falhar = false;
      const { mensagemId: _, ...resto } = route.request().postDataJSON() as Record<string, unknown>;
      return route.fallback({ postData: JSON.stringify(resto) });
    });
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("button", { name: "Abrir a conversa de +55 61 95555-4444" }).click();
    await page.getByRole("button", { name: "Registrar pedido com esta mensagem" }).click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await irAoPasso(j, isMobile, 2);
    await j.getByLabel("Assunto").fill("Portão travado");
    await irAoPasso(j, isMobile, 3);
    await j.getByRole("button", { name: /^Registrar/ }).last().click();
    await expect(j.getByText("As mensagens não foram juntadas")).toBeVisible();
    await conferir(page);
    expect(estado.whatsapp.aIdentificar).toHaveLength(3);
    await j.getByRole("button", { name: "Juntar de novo" }).click();
    await expect(j.getByText("As mensagens estão no pedido")).toBeVisible();
    expect(estado.whatsapp.aIdentificar).toHaveLength(2);
  });

  test("W-15: juntar a um pedido busca enquanto digita e leva as mensagens ao pedido escolhido", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const pedido = estado.pedidos[0]!;
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("button", { name: "Abrir a conversa de +55 61 96666-5555" }).click();
    await page.getByRole("button", { name: "Juntar a um pedido" }).click();
    const jn = page.getByRole("dialog", { name: "Juntar a um pedido" });
    await expect(jn.getByRole("button", { name: "Juntar ao pedido" })).toBeDisabled();
    await jn.getByLabel("Buscar pedido").fill(pedido.protocolo);
    await jn.getByRole("button", { name: new RegExp(`^${pedido.protocolo}`) }).click();
    await conferir(page);
    await jn.getByRole("button", { name: "Juntar ao pedido" }).click();
    await expect(page.getByText("Mensagens juntadas ao pedido.")).toBeVisible();
    expect(estado.whatsapp.triagens).toEqual([{ acao: "PEDIDO", pedidoId: pedido.id }]);
  });

  test("W-16 e A.1: a falha aparece com quem cuida e é reenviada com motivo; o selo mostra a conexão", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("navigation", { name: "Partes do WhatsApp" }).getByRole("link", { name: /Falhas/ }).click();
    await expect(page).toHaveURL(/parte=falhas/);
    const falhas = page.getByRole("region", { name: "Falhas de envio" });
    await expect(falhas.getByText("Número sem WhatsApp")).toBeVisible();
    await expect(falhas.getByText(/quem cuida: Ana Souza/)).toBeVisible();
    await conferir(page);
    await falhas.getByRole("button", { name: "Reenviar" }).click();
    const j = page.getByRole("dialog", { name: "Reenviar a mensagem" });
    await j.getByRole("button", { name: "Reenviar" }).click();
    await expect(j.getByRole("alert")).toBeVisible();
    await j.getByLabel("Por que reenviar").fill("O morador ativou o WhatsApp no número");
    await j.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.getByText("Nenhuma falha de envio")).toBeVisible();
    expect(estado.whatsapp.falhas).toHaveLength(0);

    await page.getByRole("button", { name: /^Número do condomínio: Conectado · piloto/ }).click();
    const selo = page.getByRole("group", { name: "Número do condomínio" });
    await expect(selo.getByText("Conexão de piloto, não oficial")).toBeVisible();
    await expect(selo.getByRole("link", { name: "Configurações do WhatsApp" })).toHaveAttribute("href", "/configuracoes/whatsapp");
    await conferir(page);
    await page.keyboard.press("Escape");
    await expect(selo).toBeHidden();
  });

  test("W-13, W-10 e C.1: a resposta pelo WhatsApp é dar retorno; a revisão pedida não reabre sozinha", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const pedido = estado.pedidos[0]!;
    pedirRevisao(estado.whatsapp, pedido.id, "Continua pingando, pode olhar de novo?");
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${pedido.id}`);
    const conversa = page.getByRole("region", { name: "Conversa do WhatsApp" });
    await expect(conversa.getByText("A luz da garagem no subsolo 1 está piscando faz dois dias")).toBeVisible();
    await expect(conversa.getByText("Entregue")).toBeVisible();
    await expect(conversa.getByText("Responder é em Dar retorno ao morador")).toBeVisible();
    await expect(conversa.getByRole("textbox")).toHaveCount(0);
    const faixa = page.getByRole("region", { name: "Pedido de revisão pelo WhatsApp" });
    await expect(faixa.getByText("O morador pediu revisão pelo WhatsApp")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Dar retorno ao morador" }).filter({ visible: true }).first().click();
    const r = page.getByRole("dialog", { name: /^Dar retorno ao morador/ });
    await expect(r.getByLabel("Como foi dado")).toHaveValue("WHATSAPP");
    await r.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(r.getByText("De 3 a 2000 caracteres.")).toBeVisible();
    await r.getByLabel("O que foi dito").fill("Marta, o eletricista passa amanhã às 9h.");
    await conferir(page);
    await r.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(page.getByText("Retorno registrado e enviado pelo WhatsApp.")).toBeVisible();
    await expect(conversa.getByText("Marta, o eletricista passa amanhã às 9h.")).toBeVisible();
    expect(estado.whatsapp.enviados).toEqual(["Marta, o eletricista passa amanhã às 9h."]);

    await faixa.getByRole("button", { name: "Manter concluído e responder" }).click();
    const j = page.getByRole("dialog", { name: "Manter concluído e responder" });
    await j.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(j.getByText("Escreva a resposta ao morador.")).toBeVisible();
    await conferir(page);
    await j.getByLabel("Resposta ao morador").fill("O reparo foi conferido ontem; se voltar, abra um pedido novo.");
    await j.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText("Resposta enviada ao morador. O pedido segue concluído.")).toBeVisible();
    await expect(faixa).toBeHidden();
  });

  test("C.1: outro meio no Dar retorno registra sem mandar pelo WhatsApp", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[0]!.id}`);
    await page.getByRole("button", { name: "Dar retorno ao morador" }).filter({ visible: true }).first().click();
    const r = page.getByRole("dialog", { name: /^Dar retorno ao morador/ });
    await r.getByLabel("Como foi dado").selectOption({ label: "Por telefone" });
    await expect(r.getByText(/Conversa aberta no WhatsApp/)).toHaveCount(0);
    await r.getByLabel("O que foi dito").fill("Liguei e combinei a visita.");
    await r.getByRole("button", { name: "Registrar retorno" }).click();
    await expect(page.getByText(/^Retorno registrado\. O próximo retorno foi recalculado/)).toBeVisible();
    expect(estado.whatsapp.enviados).toEqual([]);
  });

  test("W-11, W-12 e W-21: termo do piloto, mensagem sem promessa de prazo e avisos no meu WhatsApp", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    await expect(page.getByRole("heading", { name: "Termo do piloto do WhatsApp" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Li e aceito o termo do piloto" }).click();
    await expect(page.getByText("Termo do piloto aceito. A TRÍADE pode conectar o número.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Termo do piloto do WhatsApp" })).toBeHidden();
    expect(estado.whatsapp.conexao.termoAceitoEm).not.toBeNull();

    await page.getByLabel("Fora do horário").fill("Recebemos sua mensagem e respondemos em até 2 horas.");
    await expect(page.getByText("Tire a promessa de prazo ou de atendimento imediato.")).toBeVisible();
    await salvarPagina(page);
    await expect(page.getByRole("alert").filter({ hasText: "Nada foi salvo. Veja o que corrigir em Mensagens e pedidos que chegam." })).toBeVisible();
    await page.getByLabel("Fora do horário").fill("Recebemos sua mensagem fora do horário. O condomínio confere no próximo horário de atendimento.");
    await salvarPagina(page);
    await expect(page.getByText("Configurações do WhatsApp salvas.")).toBeVisible();
    // O tempo de anexar é ajuste da TRÍADE (CF-09): no app fica em leitura.
    const anexar = page.getByRole("region", { name: "Mensagens seguintes" });
    await expect(anexar).toContainText("30 min");
    await expect(anexar.getByRole("button", { name: "60 min" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Feito pela TRÍADE" })).toContainText("Mensagens seguintes");
    await expect(page.getByLabel("Meu celular")).toHaveCount(0);

    // Os avisos de cada pessoa ficam no menu da conta (decisão C.1).
    await page.getByRole("button", { name: /^Conta de / }).click();
    await page.getByRole("link", { name: "Meus avisos" }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/conta/avisos`);
    await expect(page.getByRole("heading", { level: 1, name: "Meus avisos" })).toBeVisible();

    await page.getByLabel("Meu celular").fill("+55 61 99");
    await salvarPagina(page);
    await expect(page.getByText("Celular com DDI e DDD (ex.: +5561999998888).")).toBeVisible();
    await conferir(page);
    await page.getByLabel("Meu celular").fill("+55 (61) 99100-2233");
    await salvarPagina(page);
    await expect(page.getByText("Seus avisos no WhatsApp foram salvos.")).toBeVisible();
    expect(estado.whatsapp.meusAvisos?.telefone).toBe("+5561991002233");
  });

  test("W-20: conversa fechada: a resposta vai pelo modelo, até 800 caracteres, e sem modelo avisa", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const pedido = estado.pedidos[0]!;
    estado.whatsapp.janela = { aberta: false, limite: 800, parou: false, modelo: { titulo: "Notícia do pedido",
      previa: `Notícia do seu pedido ${pedido.protocolo} no Residencial Ipê:\n\n{{texto}}\n\nAna, do condomínio\n\nPara responder, é só mandar mensagem aqui.\n\nPara não receber mais avisos, responda PARAR.` } };
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${pedido.id}`);
    await expect(page.getByRole("region", { name: "Conversa do WhatsApp" }).getByText("Conversa fechada")).toBeVisible();
    const abrir = () => page.getByRole("button", { name: "Dar retorno ao morador" }).filter({ visible: true }).first().click();
    const r = page.getByRole("dialog", { name: /^Dar retorno ao morador/ });
    await abrir();
    await expect(r.getByText(/A conversa no WhatsApp fechou/)).toBeVisible();
    await expect(r.getByText(/dentro do modelo Notícia do pedido, até 800 caracteres/)).toBeVisible();
    await r.getByLabel("O que foi dito").fill("O eletricista vem amanhã.");
    await expect(r.getByText(/no Residencial Ipê:\s+O eletricista vem amanhã\./)).toBeVisible();
    await conferir(page);
    await r.getByLabel("O que foi dito").fill("a".repeat(801));
    await expect(r.getByText(/^800 de 800 caracteres/)).toBeVisible();
    await r.getByLabel("O que foi dito").fill("O eletricista vem amanhã de manhã.");
    await r.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(page.getByText("Retorno registrado e enviado pelo WhatsApp.")).toBeVisible();

    estado.whatsapp.janela = { aberta: false, limite: 800, parou: false };
    await page.reload();
    await abrir();
    await expect(r.getByText(/Ainda não há modelo aprovado para esta mensagem/)).toBeVisible();
    await r.getByLabel("O que foi dito").fill("O reator chega amanhã.");
    await r.getByRole("button", { name: "Enviar e registrar retorno" }).click();
    await expect(page.getByText(/^Retorno registrado\. A mensagem não vai pelo WhatsApp: avise por outro meio\./)).toBeVisible();
    await conferir(page);
  });

  test("W-20: conversa aberta: diz até quando e que não é prazo de atendimento", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[0]!.id}`);
    await expect(page.getByRole("region", { name: "Conversa do WhatsApp" }).getByText(/^Aberta até/)).toBeVisible();
    await page.getByRole("button", { name: "Dar retorno ao morador" }).filter({ visible: true }).first().click();
    const r = page.getByRole("dialog", { name: /^Dar retorno ao morador/ });
    await expect(r.getByText(/Conversa aberta no WhatsApp até/)).toBeVisible();
    await expect(r.getByText(/Isto não é prazo de atendimento/)).toBeVisible();
    await expect(r.getByText(/de 2000 caracteres/)).toBeVisible();
  });
});

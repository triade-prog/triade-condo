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

  test("B.1: registrar pedido com esta mensagem leva o relato, chega pelo WhatsApp do condomínio e junta as mensagens", async ({ page, isMobile }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("button", { name: "Abrir a conversa de +55 61 95555-4444" }).click();
    await page.getByRole("button", { name: "Registrar pedido com esta mensagem" }).click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await expect(j.getByText(/Das mensagens de/)).toContainText("+55 61 95555-4444");
    await expect(j.getByText("O morador não recebe o protocolo pelo WhatsApp")).toBeVisible();
    // Decisão A.2 da área A (23/10/2026): Como chegou é o WhatsApp do condomínio, fixo.
    await expect(j.getByLabel("Como chegou")).toBeDisabled();
    await expect(j.getByLabel("Como chegou")).toHaveValue("WHATSAPP");
    await expect(j.getByText("Vem das mensagens, por isso não muda.", { exact: false })).toBeVisible();
    await conferir(page);
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await irAoPasso(j, isMobile, 2);
    await expect(j.getByLabel("O que foi relatado")).toHaveValue("Mandei ontem: o portão travou");
    await j.getByLabel("Assunto").fill("Portão travado");
    await irAoPasso(j, isMobile, 3);
    await j.getByRole("button", { name: /^Registrar/ }).last().click();
    await expect(j.getByText("Pedido registrado")).toBeVisible();
    await expect(j.getByText("As mensagens estão no pedido")).toBeVisible();
    await expect(j.getByText("Chegou pelo WhatsApp do condomínio.", { exact: false })).toBeVisible();
    await expect(j.getByRole("button", { name: "Registrar outro" })).toHaveCount(0);
    await conferir(page);
    const novo = estado.pedidos.find((p) => p.assunto === "Portão travado")!;
    expect(novo.canal).toBe("WHATSAPP");
    expect(novo.historico[0]!.dados.canal).toBe("WHATSAPP");
    expect(estado.whatsapp.triagens).toEqual([{ acao: "PEDIDO", pedidoId: novo.id }]);
    await j.getByRole("button", { name: "Abrir o pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/pedido\\?id=${novo.id}`));
  });

  test("A.2: se juntar falhar, nada fica gravado e dá para tentar de novo com o que foi escrito", async ({ page, isMobile }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    // O banco registra e junta na mesma transação (0289): a primeira tentativa volta com erro e sem pedido.
    let falhar = true;
    await page.route(/\/v1\/condominio\/pedidos$/, (route) => {
      if (route.request().method() !== "POST" || !falhar) return route.fallback();
      falhar = false;
      return route.fulfill({ status: 404, json: { erro: { codigo: "NOT_FOUND" } } });
    });
    const antes = estado.pedidos.length;
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await page.getByRole("button", { name: "Abrir a conversa de +55 61 95555-4444" }).click();
    await page.getByRole("button", { name: "Registrar pedido com esta mensagem" }).click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByLabel("Unidade", { exact: true }).selectOption({ label: "Torre A · 101" });
    await irAoPasso(j, isMobile, 2);
    await j.getByLabel("Assunto").fill("Portão travado");
    await irAoPasso(j, isMobile, 3);
    await j.getByRole("button", { name: /^Registrar/ }).last().click();
    await expect(j.getByText("Nada foi gravado: o pedido e as mensagens vão juntos.", { exact: false })).toBeVisible();
    await conferir(page);
    expect(estado.pedidos).toHaveLength(antes);
    expect(estado.whatsapp.aIdentificar).toHaveLength(3);
    await j.getByRole("button", { name: /^Registrar/ }).last().click();
    await expect(j.getByText("As mensagens estão no pedido")).toBeVisible();
    expect(estado.pedidos).toHaveLength(antes + 1);
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

  test("F5.12 (466): o síndico conecta pela janela da Meta e o número liga na hora, com a prévia e o cartão", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    const cartao = page.getByRole("region", { name: "Número oficial do WhatsApp" });
    await expect(cartao).toContainText("Ainda não ligado");
    await expect(cartao).toContainText("Tenha à mão");
    await expect(cartao.getByRole("link", { name: /Conectar/ })).toHaveCount(0);
    await expect(cartao.getByRole("button", { name: "Já terminei" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Número de teste (piloto)" })).toContainText("Conexão de piloto, não oficial");
    const conectar = cartao.getByRole("button", { name: "Conectar pelo WhatsApp oficial" });
    await expect(conectar).toBeVisible();
    await conferir(page);
    await conectar.click();
    await expect(cartao.getByText("Ligando o número do condomínio")).toBeVisible();
    await expect(cartao.getByText("Conta recebida da Meta")).toBeVisible();
    const ligado = page.getByRole("region", { name: "O Residencial Ipê já está no WhatsApp oficial" });
    await expect(ligado).toBeVisible();
    await expect(ligado).toContainText("+55 61 3333-0101");
    await expect(ligado).toContainText("20 com a Meta, que aprova de minutos a 1 dia");
    await expect(ligado.getByRole("figure", { name: "Assim o morador vê" })).toContainText("Esta é uma conta comercial do condomínio.");
    await expect(ligado).toContainText("Falta um passo: o cartão na Meta");
    await expect(ligado.getByRole("link", { name: /Pôr o cartão na Meta/ })).toHaveAttribute("target", "_blank");
    await conferir(page);
    // A janela recebeu o app e a configuração certos; só a mensagem do facebook.com contou.
    expect(await page.evaluate(() => (window as unknown as { __metaInit: unknown }).__metaInit)).toEqual({ appId: "28914484134911319", version: "v26.0", xfbml: false, cookie: false });
    expect(await page.evaluate(() => (window as unknown as { __metaLogin: { config_id: string; response_type: string } }).__metaLogin))
      .toMatchObject({ config_id: "3481812468673012", response_type: "code", override_default_response_type: true });
    expect(estado.whatsapp.meta.cadastros).toEqual([{ code: "x".repeat(20), wabaId: "102938475610", numeroId: "564738291001", empresaId: "998877665544" }]);
    await ligado.getByRole("button", { name: "Fazer depois" }).click();
    await expect(cartao).toContainText("Falta o cartão");
    await expect(page.getByText("Conexão de piloto, não oficial")).toHaveCount(0);
  });

  test("F5.12 (467): a Meta pede o código; o errado avisa quantas tentativas restam e o certo liga", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    estado.whatsapp.meta.proximo = "CODIGO";
    // A API manda esperar 60 s para reenviar; aqui, 3 s, para o teste ver a contagem acabar.
    estado.whatsapp.meta.reenviarEmSegundos = 3;
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    await page.getByRole("button", { name: "Conectar pelo WhatsApp oficial" }).click();
    const codigo = page.getByRole("dialog", { name: "Confirme o número do condomínio" });
    await expect(codigo).toContainText("A Meta mandou um código de 6 números por SMS para +55 61 3333-0101.");
    await expect(codigo.getByText(/Reenviar em/)).toBeVisible();
    expect(estado.whatsapp.meta.pedidos).toEqual(["SMS"]);
    const caixa1 = codigo.getByLabel("Número 1 de 6");
    await expect(caixa1).toHaveAttribute("autocomplete", "one-time-code");
    await expect(caixa1).toHaveAttribute("inputmode", "numeric");
    await expect(codigo.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await conferir(page);
    // Colar o código inteiro preenche as seis caixinhas e confere sozinho.
    await caixa1.fill("111111");
    await expect(codigo.getByText("Esse código não confere")).toBeVisible();
    await expect(codigo).toContainText("Restam 2 tentativas.");
    await expect(codigo.getByLabel("Número 6 de 6")).toHaveValue("1");
    await conferir(page);
    // Acabada a contagem, dá para pedir por ligação.
    await expect(codigo.getByText(/Receber por ligação em/)).toHaveCount(0, { timeout: 6000 });
    await codigo.getByRole("button", { name: "Receber por ligação" }).click();
    const voz = page.getByRole("dialog", { name: "Atenda a ligação da Meta" });
    await expect(voz).toContainText("A Meta está ligando para +55 61 3333-0101. Uma voz lê os 6 números.");
    await expect(voz.getByText(/Ligar de novo em/)).toBeVisible();
    expect(estado.whatsapp.meta.pedidos).toEqual(["SMS", "VOICE"]);
    await voz.getByLabel("Número 1 de 6").focus();
    await page.keyboard.type("482193");
    await expect(page.getByRole("dialog", { name: "Número confirmado" })).toContainText("Tudo certo com a Meta");
    await expect(page.getByRole("heading", { name: "O Residencial Ipê já está no WhatsApp oficial" })).toBeVisible();
    expect(estado.whatsapp.meta.codigos).toEqual(["111111", "482193"]);
  });

  test("F5.12 (466): fechou a janela no meio; quando o código da Meta vence, tentar de novo liga", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    const cartao = page.getByRole("region", { name: "Número oficial do WhatsApp" });
    await page.evaluate(() => { (window as unknown as { __cenarioMeta: string }).__cenarioMeta = "CANCEL"; });
    await cartao.getByRole("button", { name: "Conectar pelo WhatsApp oficial" }).click();
    await expect(cartao).toContainText("Você fechou a janela antes de terminar");
    await expect(cartao).toContainText("Nada foi ligado e nada foi cobrado.");
    expect(estado.whatsapp.meta.cadastros).toEqual([]);
    await conferir(page);

    await page.evaluate(() => { (window as unknown as { __cenarioMeta: string }).__cenarioMeta = "FINISH"; });
    estado.whatsapp.meta.proximo = "CODIGO_VENCIDO";
    await cartao.getByRole("button", { name: "Continuar na Meta" }).click();
    await expect(cartao).toContainText("A Meta terminou, mas o número não ligou");
    await expect(cartao).toContainText("Não ligou");
    await expect(cartao).toContainText("Parou aqui.");
    await conferir(page);
    await cartao.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("heading", { name: "O Residencial Ipê já está no WhatsApp oficial" })).toBeVisible();
    expect(estado.whatsapp.meta.cadastros).toHaveLength(2);
  });

  test("F5.12 (467): o número que espera o código abre a janela do código; o código vencido pede outro", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    estado.whatsapp.conexao.cadastroPendente = { numero: "+556133330101", desde: "2026-10-31T12:00:00Z" };
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    const codigo = page.getByRole("dialog", { name: "Confirme o número do condomínio" });
    await expect(codigo).toContainText("A Meta precisa confirmar que +55 61 3333-0101 é do condomínio.");
    expect(estado.whatsapp.meta.pedidos).toEqual([]);
    await conferir(page);
    await codigo.getByRole("button", { name: "Mandar SMS" }).click();
    await expect(codigo.getByText(/Reenviar em/)).toBeVisible();
    estado.whatsapp.meta.codigoVencido = true;
    await codigo.getByLabel("Número 1 de 6").fill("482193");
    await expect(codigo).toContainText("O código venceu");
    await conferir(page);
    await codigo.getByRole("button", { name: "Mandar outro SMS" }).click();
    expect(estado.whatsapp.meta.pedidos).toEqual(["SMS", "SMS"]);
    await codigo.getByLabel("Número 1 de 6").fill("482193");
    await expect(page.getByRole("heading", { name: "O Residencial Ipê já está no WhatsApp oficial" })).toBeVisible();
  });

  test("F5.12 (466): vindo de outra página pelo menu, a página recarrega uma vez para a janela da Meta poder abrir", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await page.getByRole("region", { name: "Comunicação" }).getByRole("link", { name: /^WhatsApp/ }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/whatsapp`);
    await expect(page.getByRole("button", { name: "Conectar pelo WhatsApp oficial" })).toBeVisible();
    // O documento agora nasceu nesta rota, com a CSP e o COOP da janela.
    expect(await page.evaluate(() => new URL(performance.getEntriesByType("navigation")[0]!.name).pathname)).toBe("/configuracoes/whatsapp");
  });

  test("F5.12: quem não é síndico vê o cartão sem o botão da janela", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    const cartao = page.getByRole("region", { name: "Número oficial do WhatsApp" });
    await expect(cartao).toContainText("Quem faz o cadastro na Meta é o síndico, no app.");
    await expect(cartao.getByRole("button", { name: "Conectar pelo WhatsApp oficial" })).toHaveCount(0);
  });

  test("F5.12: com o número oficial ligado, o aviso de piloto some e o cartão mostra o que falta", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    Object.assign(estado.whatsapp.conexao, { provedor: "META", oficial: true, nomeExibicao: "Residencial Ipê", qualidade: "VERDE", limiteDiario: 1000,
      faltaCartaoEm: "2026-10-31T18:00:00Z", modelos: { aprovados: 18, emAnalise: 1, recusados: 1, total: 20 } });
    await page.goto(`${PLATAFORMA}/configuracoes/whatsapp`);
    const cartao = page.getByRole("region", { name: "Número oficial do WhatsApp" });
    await expect(cartao).toContainText("Falta o cartão");
    await expect(cartao).toContainText("Os avisos pagos estão parados");
    await expect(cartao.getByRole("link", { name: /Pôr o cartão na Meta/ })).toBeVisible();
    await expect(cartao).toContainText("18 de 20 aprovados");
    await expect(cartao).toContainText("até 1.000 moradores diferentes");
    await expect(page.getByText("Conexão de piloto, não oficial")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Termo do piloto do WhatsApp" })).toHaveCount(0);
    await conferir(page);
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

// Comunicado pelo WhatsApp do condomínio (F6.6; CD-02, W-20, W-16) com a API falsa: o cartão de
// Configurações › WhatsApp, o cartaz, como vai chegar ao escrever, como chegou e a correção que
// avisa de novo, a ficha da unidade, o filtro da lista de contatos, a linha dos moradores no
// registro do pedido e o botão do mural e do link pessoal. As regras de verdade (aceite, fila
// lenta, horário sem envio) estão no banco (pgTAP 033). Cada tela passa no axe (WCAG 2.2 AA) no
// celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { LINK_FALSO, MURAL_FALSO } from "./api-falsa-comunicados";
import { avisado, irAoPasso } from "./registro";

const PLATAFORMA = "http://localhost:3000";
const CONVITE = "https://wa.me/5561981244000?text=COMUNICADOS";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · comunicado pelo WhatsApp", () => {
  test("CF-11, W-20: o cartão começa desligado, conta por telefone e dá o convite e o cartaz", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    await expect(page.getByRole("heading", { name: "Como vai chegar" })).toBeVisible();
    await expect(page.getByRole("switch", { name: /Vai pelo WhatsApp do condomínio/ })).toHaveCount(0);
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await expect(page.getByRole("heading", { level: 1, name: "Mural do Residencial Ipê" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Receber pelo WhatsApp" })).toHaveCount(0);

    await page.goto(`${PLATAFORMA}/configuracoes?aba=whatsapp`);
    const cartao = page.getByRole("region", { name: "Comunicados pelo WhatsApp" });
    const chave = cartao.getByRole("switch", { name: /Mandar comunicados pelo WhatsApp do condomínio/ });
    await expect(chave).not.toBeChecked();
    const contas = cartao.getByRole("list", { name: "Respostas por telefone" });
    await expect(contas.getByRole("listitem").filter({ hasText: "aceitaram" })).toContainText("2");
    await expect(contas.getByRole("listitem").filter({ hasText: "disseram não" })).toContainText("1");
    await expect(cartao.getByText(`Toque no link e envie a mensagem que aparece: ${CONVITE}`)).toBeVisible();
    await expect(cartao.getByText("As mensagens saem 10 por minuto")).toBeVisible();
    await conferir(page);
    // A chave muda depois que o servidor responde.
    await chave.click();
    await expect(page.getByText("Comunicados pelo WhatsApp ligados.")).toBeVisible();
    await expect(chave).toBeChecked();
    await expect(cartao.getByText(/Ligado desde .*, por Ana Souza/)).toBeVisible();
    await cartao.getByRole("button", { name: "Copiar o convite" }).click();
    await expect(cartao.getByRole("button", { name: "Convite copiado" })).toBeVisible();
    await expect(cartao.getByRole("link", { name: "Cartaz com QR" })).toHaveAttribute("href", "/mural/cartaz-whatsapp");

    await page.goto(`${PLATAFORMA}/mural/cartaz-whatsapp`);
    await expect(page.getByRole("heading", { name: "Receba os comunicados do Residencial Ipê no WhatsApp" })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR para receber os comunicados pelo WhatsApp" })).toBeVisible();
    await conferir(page);
  });

  test("CD-02, W-14: escrever mostra quem recebe por cada canal, quem fica sem nenhum e o ritmo da fila", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    const chegar = page.getByRole("region", { name: "Como vai chegar" });
    const zap = chegar.getByRole("switch", { name: /Vai pelo WhatsApp do condomínio/ });
    await expect(zap).toBeChecked();
    await expect(chegar.getByText("2 contatos aceitaram receber comunicados por lá.", { exact: false })).toBeVisible();
    const canais = chegar.getByRole("list", { name: "Por onde chega" });
    await expect(canais).toContainText("2 pelo WhatsApp");
    await expect(canais).toContainText("1 por e-mail");
    await expect(canais).toContainText("1 pelos dois");
    await expect(canais).toContainText("1 por nenhum");
    await expect(chegar.getByText("1 contato não recebe por nenhum dos dois")).toBeVisible();
    await chegar.getByRole("button", { name: "Ver quem" }).click();
    await expect(chegar.getByRole("listitem").filter({ hasText: "Joana Lima" })).toBeVisible();
    await expect(chegar.getByText("10 por minuto: estas 2 saem em cerca de 1 minuto.", { exact: false })).toBeVisible();
    await expect(chegar.getByRole("link", { name: "Como convidar" })).toHaveAttribute("href", "/configuracoes?aba=whatsapp");
    await conferir(page);
    await zap.uncheck();
    await expect(canais).toContainText("0 pelo WhatsApp");
    await expect(chegar.getByText("2 contatos não recebem por nenhum dos dois")).toBeVisible();
    await zap.check();

    await page.getByRole("textbox", { name: "Título" }).fill("Dedetização das áreas comuns");
    await page.getByRole("textbox", { name: "Texto", exact: true }).fill("Na segunda, das 8h às 12h.");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dedetização das áreas comuns" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Como chegou" }).getByText("WhatsApp do condomínio · 2 mensagens")).toBeVisible();
    await expect(page.getByText("WhatsApp da versão 1: 2 mensagens na fila")).toBeVisible();
    await conferir(page);
  });

  test("CD-08, CD-01: como chegou mostra o que falhou, sem reenvio, e corrigir avisa de novo com Corrigido", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "Falta de água na quinta" }).click();
    const chegou = page.getByRole("region", { name: "Como chegou" });
    await expect(chegou.getByText("WhatsApp do condomínio · 2 mensagens")).toBeVisible();
    await expect(chegou.getByText("1 entregue · 1 lida · 1 falhou")).toBeVisible();
    await expect(chegou.getByText("Link pessoal aberto por 1 pessoa.").last()).toBeVisible();
    await expect(chegou.getByText("Lida é o que o WhatsApp informa", { exact: false })).toBeVisible();
    const falhas = page.getByRole("region", { name: "Mensagens que não chegaram" });
    await expect(falhas.getByText("Pedro Souza · Torre A · 101")).toBeVisible();
    await expect(falhas.getByText("WhatsApp: não chegou (número sem WhatsApp).", { exact: false })).toBeVisible();
    await expect(falhas.getByText("não tem reenvio", { exact: false })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Corrigir" }).click();
    await page.getByRole("textbox", { name: "O que mudou" }).fill("Mudou o horário");
    const avisar = page.getByRole("checkbox", { name: /Avisar pelo WhatsApp quem recebeu a versão 1/ });
    await expect(avisar).not.toBeChecked();
    await expect(page.getByText('A mensagem começa com "Corrigido:".', { exact: false })).toBeVisible();
    await avisar.check();
    await page.getByRole("button", { name: "Publicar versão 2" }).click();
    await expect(page.getByText('WhatsApp da versão 2, com "Corrigido:": 1 mensagem na fila')).toBeVisible();
  });

  test("W-20, MU-01: a ficha mostra a escolha de cada contato e a lista filtra quem não recebe pelo WhatsApp", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("tab", { name: "Pessoas", exact: true }).click();
    await page.getByRole("button", { name: /^Sem WhatsApp para comunicados\s*2$/ }).click();
    await expect(page.getByText("Joana Lima")).toBeVisible();
    await expect(page.getByText("Marina Souza")).toHaveCount(0);
    await expect(page.getByText(/WhatsApp: disse não/)).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: /Sem WhatsApp para comunicados/ }).click();
    await page.getByRole("link", { name: "Torre A · 101" }).first().click();
    await expect(page.getByText(/Comunicados no WhatsApp: aceitou em 20\/10\/2026, na conversa/)).toBeVisible();
    await expect(page.getByText(/Comunicados no WhatsApp: aceitou em 20\/10\/2026, pelo comando COMUNICADOS/)).toBeVisible();
    await expect(page.getByRole("button", { name: /aceite/i })).toHaveCount(0);
    await conferir(page);
  });

  test("W-20: o mural e o link pessoal têm o botão que abre o WhatsApp com COMUNICADOS", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false, comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await expect(page.getByRole("heading", { name: "Receba os comunicados no WhatsApp" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Receber pelo WhatsApp" })).toHaveAttribute("href", CONVITE);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/c/${LINK_FALSO}`);
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Receber pelo WhatsApp" })).toHaveAttribute("href", CONVITE);
    await conferir(page);
  });

  test("AT-26, CD-02: o comunicado do registro do pedido segue o mesmo caminho e conta o WhatsApp", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true, comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("button", { name: "Registrar pedido" }).first().click();
    const j = page.getByRole("dialog", { name: "Registrar pedido" });
    await j.getByRole("button", { name: "Em área comum" }).click();
    await j.getByLabel("Local").fill("Casa de bombas");
    await irAoPasso(j, isMobile, 2);
    await j.getByLabel("Assunto").fill("Bomba vazando");
    await j.getByLabel("O que foi relatado").fill("Água no piso da casa de bombas.");
    await irAoPasso(j, isMobile, 3);
    await j.getByLabel("Responsável", { exact: true }).selectOption({ label: "Bruna" });
    const qa = j.getByRole("region", { name: "Quem fica sabendo" });
    await qa.getByRole("button", { name: "Avisar", exact: true }).click();
    await expect(qa.getByText("5 unidades · comunicado por e-mail, pelo WhatsApp de quem aceitou e no mural")).toBeVisible();
    await qa.getByRole("group", { name: "Para quem" }).getByRole("button", { name: "Blocos" }).click();
    await qa.getByLabel("Torre A").check();
    await expect(qa.getByText("4 unidades · comunicado por e-mail e pelo WhatsApp de quem aceitou ·")).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: /Registrar e avisar/ }).click();
    await expect(avisado(j, "Moradores · Torre A")).toContainText("Publicado · 1 e-mail · 2 pelo WhatsApp");
  });
});

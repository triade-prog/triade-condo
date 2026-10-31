// WhatsApp do condomínio no Console (passo 5; W-01, W-17, DC14) com a API falsa: a aba WhatsApp da
// ficha (credenciais, conectar pelo QR ou código, conferir, desconectar com motivo) e a lista de
// números no menu, e os modelos de mensagem (F5.4, W-20). Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Console · WhatsApp do condomínio", () => {
  test("W-01: guardar credenciais, conectar pelo QR, conferir e desconectar com motivo", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}?aba=whatsapp`);
    const aba = page.getByRole("tabpanel");
    await expect(aba.getByText("Conexão de piloto, não oficial (Wafly)")).toBeVisible();
    await expect(aba.getByText("Sem credenciais")).toBeVisible();
    await conferir(page);

    await aba.getByRole("button", { name: "Guardar credenciais" }).click();
    const cred = page.getByRole("dialog", { name: "Credenciais da instância" });
    await cred.getByLabel("Instância", { exact: true }).fill("ipe piloto");
    await cred.getByLabel("Token da instância").fill("token-de-teste-123");
    await cred.getByRole("button", { name: "Guardar" }).click();
    await expect(cred.getByText("Só letras, números, hífen e sublinhado.")).toBeVisible();
    await conferir(page);
    await cred.getByLabel("Instância", { exact: true }).fill("ipe-piloto");
    await cred.getByRole("button", { name: "Guardar" }).click();
    await expect(cred).toBeHidden();
    await expect(aba.getByText("Credenciais guardadas e avisos do provedor ligados.")).toBeVisible();
    await expect(aba.getByText("Desconectado", { exact: true })).toBeVisible();

    await aba.getByRole("button", { name: "Conectar" }).click();
    const con = page.getByRole("dialog", { name: "Conectar o número" });
    await con.getByRole("button", { name: "Mostrar o QR" }).click();
    await expect(con.getByRole("img", { name: "QR para conectar o WhatsApp do condomínio" })).toBeVisible();
    await con.getByRole("button", { name: "Usar código de emparelhamento" }).click();
    await expect(con.getByLabel("Código de emparelhamento ABCD-1234")).toBeVisible();
    await conferir(page);
    await con.getByRole("button", { name: "Pronto, conferir" }).click();
    await expect(aba.getByText("Conectado. O aparelho confere com a ficha.")).toBeVisible();
    await expect(aba.getByText("Aparelho conectado", { exact: true })).toBeVisible();
    await expect(aba.getByText("Conectado; o aparelho confere com a ficha")).toBeVisible();
    await conferir(page);

    await aba.getByRole("button", { name: "Desconectar" }).click();
    const des = page.getByRole("dialog", { name: "Desconectar o número" });
    await des.getByRole("button", { name: "Desconectar" }).click();
    await expect(des.getByText("Diga o motivo (3 a 300 caracteres).")).toBeVisible();
    await des.getByLabel("Motivo").fill("Troca do aparelho do condomínio");
    await des.getByRole("button", { name: "Desconectar" }).click();
    await expect(des).toBeHidden();
    await expect(aba.getByText("Número desconectado. O síndico foi avisado no sino.")).toBeVisible();
    await expect(aba.getByText(/Motivo: Troca do aparelho do condomínio/)).toBeVisible();
  });

  test("W-17: o menu WhatsApp lista os números e leva à aba da ficha", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/whatsapp`);
    await expect(page.getByRole("heading", { level: 1, name: "WhatsApp" })).toBeVisible();
    await expect(page.getByText("Sem credenciais", { exact: true })).toBeVisible();
    await expect(page.getByText("Piloto", { exact: true })).toBeVisible();
    await conferir(page);
    // O botão da linha é o próximo passo: sem credenciais, já abre a janela delas na ficha.
    await page.getByRole("link", { name: "Guardar credenciais: Residencial Ipê" }).click();
    await expect(page.getByRole("tab", { name: "WhatsApp" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("dialog", { name: "Credenciais da instância" })).toBeVisible();
  });

  test("W-20: modelos de mensagem: ver, criar versão, aprovar no piloto e registrar a recusa da Meta", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/whatsapp`);
    await page.getByRole("button", { name: "Modelos de mensagem" }).click();
    await expect(page.getByRole("button", { name: /Notícia do pedido/ })).toBeVisible();
    await expect(page.getByText("Aprovado no piloto").first()).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: /Notícia do pedido/ }).click();
    const j = page.getByRole("dialog", { name: "Notícia do pedido" });
    await expect(j.getByText("Em uso no piloto: versão 1")).toBeVisible();
    await expect(j.getByText(/Notícia do seu pedido 2026-0142 no Residencial Ipê/)).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Criar versão nova" }).click();
    await j.getByLabel("Texto da versão 2").fill("{{1}} notícia do pedido {{2}}: {{3}} · {{4}}.");
    await expect(j.getByText(/sem começar nem terminar com uma delas/)).toBeVisible();
    await expect(j.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
    await j.getByLabel("Texto da versão 2").fill("Notícia do seu pedido {{1}} ({{2}}):\n\n{{3}}\n\n{{4}}, do condomínio. Responda por aqui.");
    await expect(j.getByText(/Notícia do seu pedido 2026-0142 \(Residencial Ipê\)/)).toBeVisible();
    await j.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(j.getByText("Rascunho salvo. Ele só passa a valer depois de aprovado.")).toBeVisible();
    await expect(j.getByText("Em uso no piloto: versão 1")).toBeVisible();
    await j.getByRole("button", { name: "Aprovar no piloto" }).click();
    await j.getByRole("button", { name: "Confirmar" }).click();
    await expect(j.getByText("Em uso no piloto: versão 2")).toBeVisible();
    expect(estado.modelos.filter((m) => m.chave === "noticia_pedido").map((m) => m.situacao)).toEqual(["APROVADO_PILOTO", "APROVADO_PILOTO"]);

    await j.getByRole("button", { name: "Registrar envio à Meta" }).click();
    await j.getByRole("button", { name: "Confirmar" }).click();
    await j.getByRole("button", { name: "Registrar recusa da Meta" }).click();
    await j.getByRole("button", { name: "Confirmar" }).click();
    await expect(j.getByText("Diga o motivo (3 a 300 caracteres).")).toBeVisible();
    await j.getByLabel("Motivo").fill("A Meta classificou como marketing");
    await j.getByRole("button", { name: "Confirmar" }).click();
    await expect(j.getByText(/Versão 2: Recusado\. A Meta classificou como marketing/)).toBeVisible();
    await conferir(page);
  });

  test("F5.12: a conta que chega da Meta é ligada ao cliente provável e a ficha mostra o número oficial e os modelos", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.meta.numerosDaConta = 2;
    await page.goto(`${CONSOLE}/whatsapp`);
    await page.getByRole("button", { name: "Contas recebidas da Meta (2)" }).click();
    const lista = page.getByRole("region", { name: "Esperando ligar a um cliente" });
    await expect(lista.getByText("Provável: Residencial Ipê")).toBeVisible();
    await expect(lista.getByText("Sem cliente provável")).toBeVisible();
    await conferir(page);

    await lista.getByRole("button", { name: "Ligar ao cliente" }).first().click();
    const janela = page.getByRole("dialog", { name: "Ligar a conta ao cliente" });
    await expect(janela.getByLabel("Cliente")).toHaveValue(IPE);
    await expect(janela).toContainText("Condomínio Residencial Ipê");
    await conferir(page);
    await janela.getByRole("button", { name: "Ligar e registrar o número" }).click();
    await expect(janela.getByText("A conta tem mais de um número. Diga qual ligar.")).toBeVisible();
    await janela.getByLabel("Id do número na Meta").fill("1112223334");
    await janela.getByRole("button", { name: "Ligar e registrar o número" }).click();
    await expect(janela).toBeHidden();
    await expect(page.getByText("Conta ligada a Residencial Ipê. Número registrado e 3 modelos enviados para a Meta aprovar.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ligadas nos últimos 30 dias" })).toContainText("Residencial Ipê");

    await page.getByRole("link", { name: "Abrir a ficha" }).click();
    const aba = page.getByRole("tabpanel");
    const numero = aba.getByRole("region", { name: "Número oficial" });
    await expect(numero).toContainText("Oficial (Meta)");
    await expect(numero).toContainText("1029384756");
    await expect(aba.getByText("Conexão de piloto, não oficial (Wafly)")).toHaveCount(0);
    const modelos = aba.getByRole("region", { name: "Modelos de mensagem deste condomínio" });
    await expect(modelos).toContainText("1 aprovado · 1 em análise · 1 recusado");
    await expect(modelos).toContainText("“parece promoção”");
    await conferir(page);
    await modelos.getByRole("button", { name: "Mandar os modelos que faltam" }).click();
    await expect(aba.getByText("1 modelo mandado para a Meta aprovar.")).toBeVisible();
    await expect(modelos).toContainText("0 recusados");
  });
});

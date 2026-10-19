// WhatsApp do condomínio no Console (passo 5; W-01, W-17, DC14) com a API falsa: a aba WhatsApp da
// ficha (credenciais, conectar pelo QR ou código, conferir, desconectar com motivo) e a lista de
// números no menu. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
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
    await expect(page.getByText("Sem credenciais")).toBeVisible();
    await expect(page.getByText("Piloto")).toBeVisible();
    await conferir(page);
    await page.getByRole("link", { name: "Residencial Ipê" }).click();
    await expect(page.getByRole("tab", { name: "WhatsApp" })).toHaveAttribute("aria-selected", "true");
  });
});

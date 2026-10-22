// O mural visto do painel (CD-15; CD-12, AC-05) com a API falsa: a aba No mural mostra o mesmo
// mural do link, com o que só o painel vê embaixo de cada item; tirar e pôr no mural dali; o que
// ficou de fora e por quê; ver por aqui não conta abertura; o cartão No mural agora no Início;
// os classificados como vitrine e a página do anúncio, no painel e no link. Cada tela passa no axe
// (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { MURAL_FALSO } from "./api-falsa-comunicados";
import { abrirArea } from "./inicio";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const previa = (page: Page) => page.getByRole("region", { name: "O que o morador vê" });

test.describe("Mural no painel", () => {
  test("CD-15: a aba No mural mostra o que o morador vê, sem contar abertura", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "No mural" }).click();
    await expect(page).toHaveURL(/\/comunicados\/no-mural$/);
    await expect(page.getByRole("link", { name: "No mural" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Ao vivo")).toBeVisible();
    await expect(page.getByText(/Conferido agora · confere de novo a cada 30 s/)).toBeVisible();
    await expect(previa(page).getByRole("heading", { name: "Mural do Residencial Ipê" })).toBeVisible();
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    // O nome de quem escreveu não vai ao mural, nem na prévia.
    await expect(previa(page).getByText("Ana Souza")).toHaveCount(0);
    await expect(previa(page).getByRole("link", { name: "Abrir a ficha: Falta de água na quinta" })).toHaveAttribute("href", /\/comunicados\/comunicado\?id=/);
    await expect(page.getByText("214")).toBeVisible();
    await expect(page.getByText("Ver por aqui não conta.")).toBeVisible();
    await conferir(page);
    // Conferir de novo e recarregar não mudam as aberturas.
    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await page.reload();
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText("214")).toBeVisible();
  });

  test("CD-15: tira do mural e põe de volta sem sair da aba; o que ficou de fora diz por quê", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/no-mural`);
    const fora = page.getByRole("region", { name: "Publicados fora do mural" });
    await expect(fora.getByText("Todo comunicado publicado para o condomínio inteiro está no mural.")).toBeVisible();
    await previa(page).getByRole("button", { name: "Tirar do mural: Falta de água na quinta" }).click();
    await expect(page.getByText("\"Falta de água na quinta\" saiu do mural.")).toBeVisible();
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toHaveCount(0);
    await expect(fora.getByRole("link", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(fora.getByText("Foi tirado do mural.")).toBeVisible();
    await conferir(page);
    await fora.getByRole("button", { name: "Pôr no mural: Falta de água na quinta" }).click();
    await expect(page.getByText("\"Falta de água na quinta\" foi posto no mural.")).toBeVisible();
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
  });

  test("CD-15: quem só vê comunicados vê o mural, sem pôr nem tirar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/comunicados/no-mural`);
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tirar do mural/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Escrever comunicado" })).toHaveCount(0);
    // Sem cuidar dos classificados, a vitrine aparece igual, com a foto pelo caminho do morador.
    await previa(page).getByRole("button", { name: "Classificados" }).click();
    await expect(previa(page).getByRole("list", { name: "Classificados entre moradores" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Esperando aprovação" })).toHaveCount(0);
    await conferir(page);
  });

  test("CD-15, AC-05: no painel, os classificados são uma vitrine com a página de cada anúncio", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/no-mural`);
    await previa(page).getByRole("button", { name: "Classificados" }).click();
    const vitrine = previa(page).getByRole("list", { name: "Classificados entre moradores" });
    await expect(vitrine.getByRole("listitem")).toHaveCount(2);
    await expect(vitrine.getByText("Grátis")).toBeVisible();
    await expect(page.getByRole("region", { name: "Esperando aprovação" }).getByRole("link", { name: /Revisar/ })).toHaveCount(1);
    await conferir(page);
    await previa(page).getByRole("group", { name: "Tipo de anúncio" }).getByRole("button", { name: "Doação" }).click();
    await expect(vitrine.getByRole("listitem")).toHaveCount(1);
    await vitrine.getByRole("link", { name: /^Doação Grátis Doo berço de madeira/ }).click();
    await expect(previa(page).getByRole("heading", { name: "Doo berço de madeira" })).toBeVisible();
    await expect(previa(page).getByText("Contato pelo condomínio.")).toBeVisible();
    await conferir(page);
    await previa(page).getByRole("button", { name: "Voltar aos classificados" }).click();
    await previa(page).getByRole("link", { name: /^Serviço de morador Aulas de violão/ }).click();
    await expect(previa(page).getByRole("link", { name: "Chamar no WhatsApp" })).toHaveAttribute("href", "https://wa.me/5561977771212");
  });

  test("CD-15: o cartão No mural agora, no Início, leva à aba", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    const cartao = await abrirArea(page, "No mural agora");
    await expect(cartao.getByText("Falta de água na quinta")).toBeVisible();
    await expect(cartao.getByText(/214 aberturas em 7 dias/)).toBeVisible();
    await conferir(page);
    await cartao.getByRole("link", { name: "Ver o mural" }).click();
    await expect(page).toHaveURL(/\/comunicados\/no-mural$/);
  });

  test("CD-15: mural desligado e conexão que cai", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/no-mural`);
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    // Sem conexão: fica a última prévia e o selo muda.
    await page.route("**/v1/condominio/mural", (r) => r.abort());
    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await expect(page.getByText("Sem conexão")).toBeVisible();
    await expect(previa(page).getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await conferir(page);
    await page.unroute("**/v1/condominio/mural");
    await page.route("**/v1/condominio/mural", (r) => r.fulfill({ json: { ligado: false, aberturas: 0, versoes: {}, fora: [],
      pode: { mural: true, configurar: true, classificados: true } } }));
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await expect(page.getByText("O mural está desligado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ligar o mural" })).toHaveAttribute("href", "/configuracoes/mural");
    await conferir(page);
  });

  test("CD-12, AC-05: no link do morador, o anúncio tem endereço próprio para compartilhar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}?aba=classificados`);
    const vitrine = page.getByRole("list", { name: "Classificados entre moradores" });
    await expect(vitrine.getByRole("listitem")).toHaveCount(2);
    await conferir(page);
    await vitrine.getByRole("link", { name: /Aulas de violão para crianças/ }).click();
    await expect(page).toHaveURL(/\?anuncio=/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Aulas de violão para crianças" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Chamar no WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compartilhar" })).toBeVisible();
    await conferir(page);
    await page.goBack();
    await expect(vitrine).toBeVisible();
  });
});

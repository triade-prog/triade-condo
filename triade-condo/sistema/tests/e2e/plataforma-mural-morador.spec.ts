// O mural do morador no conceito Janela acesa (D4.40; CD-12, CD-16, CD-17, CD-18) com a API falsa:
// a faixa com a foto e o botão do WhatsApp, as abas com contagem, um só destaque com o bloco de
// data e o Pôr na agenda, o feed em Esta semana e Antes com o assunto em cada cartão, a marca de
// novo desde a última visita guardada só no aparelho, o cartão inteiro que abre o aviso, a prévia
// do painel com a mesma faixa e, no Escrever, os campos do evento que chegam ao mural. Cada tela
// passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { MURAL_FALSO } from "./api-falsa-comunicados";
import { hojeFalso, somar } from "./api-falsa-agenda";
import { irAoPasso } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Mural do morador", () => {
  test("CD-12, CD-17: a faixa, as abas, um só destaque com o bloco de data e o feed por tempo e assunto", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page, { logado: false, comComunicadosWhatsapp: true });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await expect(page.getByRole("heading", { level: 1, name: "Mural do Residencial Ipê" })).toBeVisible();
    await expect(page.getByText("o que o prédio precisa saber")).toBeVisible();
    await expect(page.getByText(/^Atualizado ontem às \d\d:\d\d · 3 avisos e 2 anúncios$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Receber os avisos no WhatsApp" })).toHaveAttribute("href", /wa\.me\/.*text=COMUNICADOS$/);
    await expect(page.getByRole("tab", { name: "Avisos (3)" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Classificados (2)" })).toBeVisible();

    // O destaque é a festa, o único aviso com evento futuro; a assembleia ainda é rascunho.
    const agora = page.getByRole("region", { name: "O que importa agora" });
    await expect(agora.getByRole("heading", { name: "Festa das crianças no salão" })).toBeVisible();
    await expect(agora.getByText("faltam 5 dias")).toBeVisible();
    await expect(agora.getByText("16:00")).toBeVisible();
    await expect(agora.getByText("Salão de festas")).toBeVisible();
    await expect(agora.getByRole("link", { name: "Pôr na agenda: Festa das crianças no salão" })).toHaveAttribute("href", new RegExp(`^/api/v1/publico/mural/${MURAL_FALSO}/comunicados/[^/]+/agenda$`));
    await expect(page.getByRole("region", { name: "O que importa agora" })).toHaveCount(1);

    // Esta semana tem a falta de água (ontem); Antes tem a coleta (há 10 dias). O destaque não repete no feed.
    const semana = page.getByRole("list", { name: "Esta semana" });
    await expect(semana.getByRole("listitem")).toHaveCount(1);
    await expect(semana.getByText("Obras e manutenção")).toBeVisible();
    await expect(semana.getByText(/^ontem, \d\d:\d\d$/)).toBeVisible();
    const antes = page.getByRole("list", { name: "Antes" });
    await expect(antes.getByRole("heading", { name: "Coleta de recicláveis às quartas" })).toBeVisible();
    await expect(antes.getByText("Lembrete")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Festa das crianças no salão" })).toHaveCount(1);
    // Sem nome de quem escreveu, sem curtidas, sem comentários.
    await expect(page.getByText("Ana Souza")).toHaveCount(0);
    await expect(page.getByText(/curtir|comentar/i)).toHaveCount(0);
    // A lateral: os dois anúncios, o manual em lista e os documentos.
    await expect(page.getByRole("list", { name: "Últimos anúncios" }).getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Ver os 2 anúncios" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Seções do manual" }).getByRole("link", { name: "Água e gás" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedir por e-mail" })).toBeVisible();
    await expect(page.getByText("Não precisa de conta nem senha. O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem.")).toBeVisible();
    await conferir(page);

    // No computador, a vitrine inteira fica na aba; no celular também, com o botão da lateral.
    await page.getByRole("button", { name: "Ver os 2 anúncios" }).click();
    await expect(page).toHaveURL(/aba=classificados/);
    await expect(page.getByRole("list", { name: "Classificados entre moradores" }).getByRole("listitem")).toHaveCount(2);
    await conferir(page);
    await page.getByRole("tab", { name: "Manual do prédio (1)" }).click();
    await expect(page.getByRole("heading", { name: "Água e gás" })).toBeVisible();
    if (!isMobile) await expect(page.getByText("Página pública do condomínio · sem nomes, telefones ou unidades")).toBeVisible();
  });

  test("CD-12, CD-18: o cartão inteiro abre o aviso; aberto, tem o bloco de data, o Pôr na agenda e o Voltar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    const festa = page.getByRole("region", { name: "O que importa agora" });
    // Clicar no texto do destaque (não num link) abre o aviso.
    await festa.getByText("Brincadeiras, pipoca e algodão-doce").click();
    await expect(page).toHaveURL(/\?c=/);
    await expect(page.getByRole("heading", { name: "Festa das crianças no salão" })).toBeVisible();
    await expect(page.getByText("Comissão de festas")).toBeVisible();
    await expect(page.getByText(/^(dom|seg|ter|qua|qui|sex|sáb) · 16h · Salão de festas$/)).toBeVisible();
    const agenda = page.getByRole("link", { name: "Pôr na agenda: Festa das crianças no salão" });
    // O endereço é de verdade (o celular abre a agenda), sem download forçado; o arquivo vem em UTC (16h em Brasília = 19h UTC).
    await expect(agenda).not.toHaveAttribute("download", /.*/);
    const resposta = await page.request.get(new URL((await agenda.getAttribute("href"))!, PLATAFORMA).toString());
    expect(resposta.headers()["content-type"]).toContain("text/calendar");
    expect(resposta.headers()["content-disposition"]).toContain('filename="festa-das-criancas-no-salao.ics"');
    const ics = await resposta.text();
    expect(ics).toContain(`DTSTART:${somar(hojeFalso(), 5).replace(/-/g, "")}T190000Z`);
    expect(ics).toContain("SUMMARY:Festa das crianças no salão");
    expect(ics).toContain("LOCATION:Salão de festas");
    await conferir(page);
    await page.getByRole("button", { name: "Voltar ao mural" }).click();
    await expect(page.getByRole("region", { name: "O que importa agora" })).toBeVisible();
    // No feed, o cartão da falta de água abre pelo clique no texto e o Ler o aviso diz qual é.
    await page.getByRole("list", { name: "Esta semana" }).getByText("A água será desligada").click();
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText("Ana, síndica do Residencial Ipê")).toBeVisible();
  });

  test("CD-16: a segunda visita marca o que é novo, só neste aparelho; a primeira não marca nada", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false });
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText(/avisos? novos? desde a sua última visita/)).toHaveCount(0);
    await expect(page.getByText("Novo", { exact: true })).toHaveCount(0);
    // Uma visita de 3 dias atrás: a falta de água (ontem) e a festa (há 2 dias) são novas; a coleta não.
    const tresDiasAtras = new Date(Date.now() - 3 * 86400_000).toISOString();
    await page.evaluate(([chave, quando]) => window.localStorage.setItem(chave!, quando!), [`triade-mural-visita:${MURAL_FALSO}`, tresDiasAtras]);
    await page.reload();
    await expect(page.getByText(/^2 avisos novos desde a sua última visita, (domingo|segunda|terça|quarta|quinta|sexta|sábado) \d\d\/\d\d\.$/)).toBeVisible();
    await expect(page.getByText("A marca fica só neste aparelho; ninguém sabe que você abriu.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Esta semana" }).getByText("Novo", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("list", { name: "Antes" }).getByText("Novo", { exact: true })).toHaveCount(0);
    await conferir(page);
    // A visita de agora ficou guardada: recarregar não mostra nada novo.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText(/avisos? novos? desde a sua última visita/)).toHaveCount(0);
    const guardada = await page.evaluate((chave) => window.localStorage.getItem(chave), `triade-mural-visita:${MURAL_FALSO}`);
    expect(Date.now() - Date.parse(guardada!)).toBeLessThan(60_000);
  });

  test("CD-15: a prévia do painel tem a mesma faixa e o mesmo destaque, com o Só no painel embaixo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/no-mural`);
    const previa = page.getByRole("region", { name: "O que o morador vê" });
    await expect(previa.getByRole("heading", { level: 2, name: "Mural do Residencial Ipê" })).toBeVisible();
    await expect(previa.getByText("o que o prédio precisa saber")).toBeVisible();
    const agora = previa.getByRole("region", { name: "O que importa agora" });
    await expect(agora.getByRole("heading", { name: "Festa das crianças no salão" })).toBeVisible();
    await expect(previa.getByRole("link", { name: "Abrir a ficha: Festa das crianças no salão" })).toBeVisible();
    await expect(previa.getByRole("button", { name: "Tirar do mural: Festa das crianças no salão" })).toBeVisible();
    await expect(previa.getByRole("list", { name: "Esta semana" }).getByRole("listitem")).toHaveCount(1);
    // No painel não há marca de novo nem o pedido por e-mail do morador.
    await expect(previa.getByText(/desde a sua última visita/)).toHaveCount(0);
    await expect(previa.getByRole("button", { name: "Pedir por e-mail" })).toBeDisabled();
    await conferir(page);
  });

  test("CD-17: no Escrever, o dia, as horas e o local do evento chegam ao mural com o bloco de data", async ({ page, isMobile }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    const dia = somar(hojeFalso(), 9);
    await page.getByRole("group", { name: "Assunto" }).getByRole("button", { name: "Obras e manutenção" }).click();
    await page.getByLabel("Título").fill("Dedetização das áreas comuns");
    await page.getByRole("textbox", { name: "Texto", exact: true }).fill("Mantenha os animais dentro de casa.");
    const quando = page.getByRole("group", { name: /Quando acontece/ });
    await expect(quando.getByLabel("Começa às")).toBeDisabled();
    await quando.getByLabel("Dia").fill(dia);
    await quando.getByLabel("Começa às").fill("07:00");
    await quando.getByLabel("Termina às").fill("11:00");
    await quando.getByLabel("Local").fill("Garagens e jardins");
    await conferir(page);
    await irAoPasso(page.locator("body"), isMobile, 3, "Passos do comunicado");
    await page.getByRole("button", { name: "Publicar agora", exact: true }).last().click();
    await expect(page.getByRole("heading", { level: 1, name: "Dedetização das áreas comuns" })).toBeVisible();
    await expect(page.getByText("Garagens e jardins")).toBeVisible();
    await expect(page.getByText(/7h às 11h/)).toBeVisible();

    // No mural do morador, o aviso novo vira o destaque, por ser o evento mais próximo.
    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    const agora = page.getByRole("region", { name: "O que importa agora" });
    await expect(agora.getByRole("heading", { name: "Festa das crianças no salão" })).toBeVisible();
    const semana = page.getByRole("list", { name: "Esta semana" });
    await expect(semana.getByRole("heading", { name: "Dedetização das áreas comuns" })).toBeVisible();
    await expect(semana.getByText(/7h às 11h · Garagens e jardins/)).toBeVisible();
    await expect(page.getByText("Novo", { exact: true })).toHaveCount(0);
    await conferir(page);
  });
});

// Passo 2 (F2): telas da Plataforma do síndico com a API falsa. Cada tela passa no axe
// (WCAG 2.2 AA) no celular e no computador, só mostra o que a pessoa pode fazer (CF-03) e
// não usa emoji nem emoticon (decisão da Carolina, 16/10/2026).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa, V_ANA, V_BRUNA } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function menuPara(page: Page, nome: string) {
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Plataforma" }).getByRole("link", { name: nome }).click();
}

test.describe("Plataforma do síndico · passo 2", () => {
  test("PT-08 e MU-04: sem sessão vai para o login; quem tem dois condomínios escolhe e troca", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { logado: false, doisCondominios: true });
    await page.goto(PLATAFORMA);
    await expect(page).toHaveURL(`${PLATAFORMA}/entrar`);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar na Plataforma" })).toBeVisible();
    await conferir(page);
    await page.getByLabel("E-mail").fill("ana@exemplo.invalid");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha não conferem." })).toBeVisible();
    await page.getByLabel("Senha").fill("senha-da-sindica");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Em qual condomínio?" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: /Residencial Ipê/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Residencial Ipê" })).toBeVisible();
    await page.getByRole("button", { name: "Trocar condomínio" }).click();
    await page.getByRole("dialog", { name: "Trocar condomínio" }).getByRole("button", { name: /Edifício Jatobá/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edifício Jatobá" })).toBeVisible();
  });

  test("V-08 e CF-12: o início diz o que falta configurar e o que já veio pronto", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("heading", { level: 1, name: "Residencial Ipê" })).toBeVisible();
    const falta = page.getByRole("region", { name: "O que falta configurar" });
    await expect(falta).toContainText("Horário de atendimento não definido");
    await expect(falta).toContainText("Ninguém escolhido para atender os pedidos");
    await expect(page.getByRole("region", { name: "Já veio pronto pelo cenário" })).toContainText("8 categorias · 4 prioridades");
    await conferir(page);
  });

  test("CF-06 e CF-10: horário de atendimento com dois intervalos; sobreposição avisa; a pendência sai", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await expect(page.getByRole("tab", { name: "Horários", selected: true })).toBeVisible();
    await page.getByRole("button", { name: "Acrescentar intervalo na Segunda" }).click();
    await page.getByRole("button", { name: "Acrescentar intervalo na Segunda" }).click();
    await page.getByLabel("Segunda, fim").nth(1).fill("18:00");
    await page.getByLabel("Segunda, início").nth(1).fill("11:00");
    await page.getByRole("button", { name: "Salvar horário de atendimento" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "se sobrepõem" })).toBeVisible();
    await page.getByLabel("Segunda, início").nth(1).fill("13:00");
    await page.getByRole("button", { name: "Copiar segunda para terça a sexta" }).click();
    await conferir(page);
    await page.getByRole("button", { name: "Salvar horário de atendimento" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Horário de atendimento salvo." })).toBeVisible();
    await expect(page.getByLabel("Sexta, início")).toHaveCount(2);
    await menuPara(page, "Início");
    await expect(page.getByRole("region", { name: "O que falta configurar" })).not.toContainText("Horário de atendimento");
  });

  test("CF-10: feriados nacionais com um toque; data mostrada como foi escrita; tirar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=feriados`);
    await expect(page.getByText("Nenhum feriado cadastrado")).toBeVisible();
    await page.getByRole("button", { name: /Trazer feriados nacionais de 2026/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "feriados nacionais de 2026 incluídos" })).toBeVisible();
    const linha = page.getByRole("row", { name: /Consciência Negra/ });
    await expect(linha).toContainText("20/11/2026");
    await conferir(page);
    await page.getByRole("button", { name: "Tirar o feriado Carnaval de 16/02/2026" }).click();
    await expect(page.getByRole("row", { name: /16\/02\/2026/ })).toHaveCount(0);
  });

  test("CF-08, CF-09 e AT-04: categoria renomeada e desativada; prioridade com significado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=categorias`);
    await page.getByRole("button", { name: "Renomear Limpeza" }).click();
    const janela = page.getByRole("dialog", { name: "Renomear Limpeza" });
    await expect(janela).toContainText("mantém o mesmo identificador");
    await janela.getByLabel("Nome da categoria").fill("Manutenção");
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(janela.getByRole("alert")).toContainText("Já existe um item ativo com este nome.");
    await janela.getByLabel("Nome da categoria").fill("Limpeza e conservação");
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Categoria salva." })).toBeVisible();
    await page.getByRole("button", { name: "Desativar Limpeza e conservação" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Limpeza e conservação" })).toContainText("Desativada");
    await page.getByRole("button", { name: "+ Prioridade" }).click();
    const nova = page.getByRole("dialog", { name: "Nova prioridade" });
    await nova.getByLabel("Nome da prioridade").fill("Crítica");
    await nova.getByLabel("O que ela significa").fill("Para o prédio inteiro.");
    await conferir(page);
    await nova.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Crítica" })).toContainText("Para o prédio inteiro.");
  });

  test("AT-05 e AT-25: etapa nova que pausa o prazo; modelo de resposta", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=etapas`);
    await expect(page.getByRole("listitem").filter({ hasText: "Aguardando o morador" })).toContainText("pausa o prazo");
    await page.getByRole("button", { name: "+ Etapa" }).click();
    const janela = page.getByRole("dialog", { name: "Nova etapa" });
    await janela.getByLabel("Nome da etapa").fill("Orçamento");
    await janela.getByLabel("Pausa o prazo enquanto o pedido estiver nesta etapa").check();
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Orçamento" })).toContainText("pausa o prazo");
    await page.getByRole("button", { name: "+ Modelo" }).click();
    const modelo = page.getByRole("dialog", { name: "Novo modelo de resposta" });
    await modelo.getByLabel("Título").fill("Vazamento");
    await modelo.getByLabel("Texto da resposta").fill("Vamos mandar alguém olhar ainda hoje.");
    await modelo.getByLabel("Categoria").selectOption({ label: "Manutenção" });
    await modelo.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Vazamento" })).toContainText("Manutenção");
  });

  test("AT-10: prazos com regra geral e exceções; sem horário, horas corridas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=prazos`);
    await expect(page.getByText("os prazos contam em horas corridas")).toBeVisible();
    await expect(page.getByRole("row", { name: /Regra geral/ })).toContainText("24 h de atendimento");
    await expect(page.getByRole("button", { name: "Tirar a exceção de Regra geral" })).toHaveCount(0);
    await page.getByRole("button", { name: "+ Exceção" }).click();
    const janela = page.getByRole("dialog", { name: "Nova exceção de prazo" });
    await janela.getByLabel("Categoria").selectOption({ label: "Limpeza" });
    await janela.getByLabel("Horas de atendimento").fill("48");
    await conferir(page);
    await janela.getByRole("button", { name: "Criar exceção" }).click();
    await expect(page.getByRole("row", { name: /Categoria Limpeza/ })).toContainText("48 h de atendimento");
    await page.getByRole("button", { name: "Mudar o prazo de Regra geral" }).click();
    await page.getByRole("dialog").getByLabel("Horas de atendimento").fill("16");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar prazo" }).click();
    await expect(page.getByRole("row", { name: /Regra geral/ })).toContainText("16 h de atendimento");
  });

  test("V-09, CF-03 e CF-05: autorizar pessoa, escolher quem atende e revogar a padrão com substituto", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await menuPara(page, "Pessoas e acesso");
    await expect(page.getByRole("row", { name: /Ana Souza/ })).toContainText("Todas");
    await expect(page.getByRole("row", { name: /Bruna/ })).toContainText("Configurar");
    await page.getByRole("button", { name: "+ Autorizar pessoa" }).click();
    const convite = page.getByRole("dialog", { name: "Autorizar pessoa" });
    await convite.getByLabel("Nome").fill("Caio");
    await convite.getByLabel("E-mail").fill("caio@exemplo.invalid");
    await convite.getByLabel("Cargo").fill("Subsíndico");
    await expect(convite.getByText("O cargo não dá permissão.")).toBeVisible();
    await conferir(page);
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Convite enviado" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Caio/ })).toContainText("Só vê");
    expect(estado.convites).toEqual(["caio@exemplo.invalid"]);

    await page.getByRole("tab", { name: "Quem atende" }).click();
    await page.getByLabel("Ana Souza atende os pedidos").check();
    await page.getByLabel("Bruna atende os pedidos").check();
    await page.getByLabel("Bruna é o padrão da fila").check();
    await conferir(page);
    await page.getByRole("button", { name: "Salvar quem atende" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Quem atende foi salvo." })).toBeVisible();
    expect(estado.responsavelPadrao).toBe(V_BRUNA);

    await page.getByRole("tab", { name: "Pessoas" }).click();
    await page.getByRole("button", { name: "Revogar o acesso de Bruna" }).click();
    const revogar = page.getByRole("dialog", { name: "Revogar o acesso de Bruna" });
    await expect(revogar.getByLabel("Bruna é o padrão da fila. Quem assume?")).toHaveValue(V_ANA);
    await revogar.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Acesso de Bruna revogado" })).toBeVisible();
    expect(estado.responsavelPadrao).toBe(V_ANA);
  });

  test("CF-03: quem só vê não encontra botão de mudar nem pessoas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=categorias`);
    await expect(page.getByText("o síndico precisa dar a você a permissão Configurar")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Categoria" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Renomear / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
    const menu = page.getByRole("button", { name: "Menu" });
    if (await menu.isVisible()) await menu.click();
    await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pessoas e acesso" })).toHaveCount(0);
    await conferir(page);
  });
});

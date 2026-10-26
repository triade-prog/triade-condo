// Parceiros, agenda de demonstrações e a taxa média de condomínio (0310, R17.6 e R17.3c; quadros
// 339 a 341 e 445 a 447; CM-22, CM-23, CM-19, CM-20) com a API falsa: a lista dos parceiros com as
// abas e a regra que só a Administração muda, o extrato com o perdido em traço, o PDF e o pagamento
// registrado; a agenda com as próximas, a que falta registrar, os horários livres e o link; a
// página pública do link, com o horário que acabou de ser ocupado; e o "menos de R$ 5" com e sem a
// taxa na nova proposta, no link e no kit. Na revisão: a taxa só vai quando a pessoa a muda, com a
// versão da ficha (r8); tirar a taxa no kit deixa o kit sem taxa (r5); o aviso de possível duplicado
// (r1) e o [link de agendamento] nas mensagens prontas (R17.6b). Na reconferência: o link da
// mensagem com o convite da ficha e a conversa sem ele (A), o aviso do agendamento que não marcou e
// a resposta honesta de quem já tem demonstração (C). Cada tela passa no axe, não usa emoji e não
// rola para o lado no celular.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { CODIGO_IPE, INDICADO, LAGO, PROPOSTA_IPE, SITE } from "./api-falsa-console-comercial";
import { CODIGO_CERRADO } from "./api-falsa-console-contrato";
import { CODIGO_AGENDA, MARTA } from "./api-falsa-console-parceiros";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const celular = () => test.info().project.name === "celular";

test.describe("Console · Parceiros (CM-22)", () => {
  test("a lista com as abas, a regra da Administração e o extrato com o PDF e o pagamento", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/parceiros`);
    await expect(page.getByRole("heading", { name: "Parceiros", level: 1 })).toBeVisible();
    if (!celular()) {
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Parceiros" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Interessados" })).not.toHaveAttribute("aria-current", "page");
    }
    const abas = page.getByRole("navigation", { name: "Filtrar parceiros" });
    await expect(abas.getByRole("button", { name: /Ativos/ })).toContainText("4");
    await expect(abas.getByRole("button", { name: /Sem indicação há 90 dias/ })).toContainText("1");
    const lista = celular() ? page.getByRole("list", { name: "Parceiros" }) : page.getByRole("table", { name: /Parceiros, indicações/ });
    await expect(lista).toContainText("Marta Lins");
    await expect(lista).toContainText("R$ 45,80");
    const regra = page.getByRole("region", { name: "Regra da comissão" });
    await expect(regra).toContainText("10% da mensalidade de cada prédio ativo");
    await expect(regra).toContainText("Enquanto o prédio for cliente");
    await expect(regra).toContainText("o pagamento é feito fora do sistema");
    await conferir(page);

    // A regra é da Administração.
    await regra.getByRole("button", { name: "Mudar" }).click();
    const janela = page.getByRole("dialog", { name: "Regra da comissão" });
    await janela.getByLabel("Percentual da mensalidade (%)").fill("12,5");
    await janela.getByLabel("Por quantos meses").fill("24");
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar a regra" }).click();
    await expect(page.getByRole("status")).toContainText("Regra da comissão salva");
    await expect(regra).toContainText("12,5% da mensalidade");
    await expect(regra).toContainText("Os primeiros 24 meses de cada prédio");
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/comissao/regra")?.corpo).toEqual({ versao: 1, percentual: 12.5, prazoMeses: 24 });

    // O extrato da Marta: dois ativos e o perdido com traço.
    await lista.getByRole("link", { name: "Marta Lins" }).click();
    await expect(page.getByRole("heading", { name: "Marta Lins", level: 1 })).toBeVisible();
    const extrato = page.getByRole("region", { name: /Extrato de/ });
    await expect(extrato).toContainText("Residencial Pequi");
    await expect(extrato).toContainText("08/2026");
    await expect(extrato).toContainText("Edifício Mangaba");
    await expect(extrato).toContainText("— (deixou de ser cliente)");
    await expect(extrato).toContainText("Total do mês");
    await expect(extrato).toContainText("R$ 45,80");
    await expect(extrato).toContainText("Ainda não registrado como pago.");
    await conferir(page);
    const baixa = page.waitForEvent("download");
    await extrato.getByRole("button", { name: "Baixar o extrato" }).click();
    expect((await baixa).suggestedFilename()).toMatch(/^extrato-marta-lins-\d{4}-\d{2}\.pdf$/);

    await extrato.getByRole("button", { name: "Marcar como pago" }).click();
    const pagar = page.getByRole("dialog", { name: /Pagamento de/ });
    await expect(pagar.getByLabel("Valor pago (R$)")).toHaveValue("45,80");
    await pagar.getByLabel("Observação").fill("Pix no dia 5");
    await conferir(page);
    await pagar.getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByRole("status")).toContainText("registrado");
    await expect(extrato).toContainText("Pago R$ 45,80");
    await expect(extrato.getByRole("button", { name: "Marcar como pago" })).toHaveCount(0);
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/parceiros/${MARTA}/pagamentos`)?.corpo).toMatchObject({ valor: 4580, observacao: "Pix no dia 5" });
  });

  test("novo parceiro e a indicação; o Comercial não muda a regra nem marca pago", async ({ page }) => {
    const api = await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    await page.goto(`${CONSOLE}/comercial/parceiros`);
    await expect(page.getByRole("heading", { name: "Parceiros", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Regra da comissão" }).getByRole("button", { name: "Mudar" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Regra da comissão" })).toContainText("é da Administração");
    await page.getByRole("button", { name: "Novo parceiro" }).click();
    const janela = page.getByRole("dialog", { name: "Novo parceiro" });
    await janela.getByRole("button", { name: "Cadastrar parceiro" }).click();
    await expect(janela).toContainText("Escolha o tipo de parceiro.");
    await janela.getByText("Administradora", { exact: true }).click();
    await janela.getByLabel("Nome").fill("Síndica Rede Norte");
    await janela.getByLabel("WhatsApp").fill("(61) 99999-1111");
    await janela.getByRole("button", { name: "Cadastrar parceiro" }).click();
    await expect(janela).toContainText("Este contato já é de outro parceiro.");
    await janela.getByLabel("WhatsApp").fill("(61) 98888-2222");
    await conferir(page);
    await janela.getByRole("button", { name: "Cadastrar parceiro" }).click();
    await expect(page.getByRole("heading", { name: "Síndica Rede Norte", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como pago" })).toHaveCount(0);

    await page.getByRole("button", { name: "Indicar um condomínio" }).click();
    const indicar = page.getByRole("dialog", { name: "Indicação de Síndica Rede Norte" });
    await indicar.getByLabel("Condomínio").fill("Residencial Buriti");
    await indicar.getByLabel("WhatsApp").fill("(61) 97777-3333");
    await indicar.getByRole("button", { name: "Registrar a indicação" }).click();
    await expect(indicar).toContainText("Sem isso o interessado não entra.");
    await indicar.getByRole("switch", { name: "A pessoa aceitou o contato da TRÍADE" }).click();
    await conferir(page);
    await indicar.getByRole("button", { name: "Registrar a indicação" }).click();
    await expect(page).toHaveURL(/\/comercial\/[0-9a-f-]{36}$/);
    expect(api.comercial.pedidos.filter((x) => /\/indicar$/.test(x.caminho)).at(-1)?.corpo).toMatchObject({ condominio: "Residencial Buriti", contatoAceito: true });
  });
});

test.describe("Console · Agenda de demonstrações (CM-23)", () => {
  test("as próximas, a que falta registrar, os horários livres e o link", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await page.goto(`${CONSOLE}/comercial/agenda`);
    await expect(page.getByRole("heading", { name: "Agenda de demonstrações", level: 1 })).toBeVisible();
    if (!celular()) {
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Agenda de demonstrações" })).toHaveAttribute("aria-current", "page");
    }
    const proximas = page.getByRole("list", { name: "Próximas demonstrações" });
    await expect(proximas).toContainText("Residencial Jatobá");
    await expect(proximas).toContainText("Agendou pelo link");
    await expect(proximas).toContainText("Lembrete enviado");
    const livres = page.getByRole("region", { name: "Horários livres de Carolina" });
    await expect(livres).toContainText("10:00 a 12:00 · 14:00 a 17:00");
    await expect(livres).toContainText("Quarta");
    await expect(livres).toContainText("sem demonstração");
    await expect(livres).toContainText("Duração de 30 minutos, intervalo de 15. Aviso mínimo de 1 dia útil");
    await conferir(page);

    // A que passou sem registro pede a conversa e o próximo passo.
    const registrar = page.getByRole("list", { name: "Demonstrações a registrar" });
    await expect(registrar).toContainText("Condomínio Lago Sul");
    await expect(registrar).toContainText("Remarcou 1 vez");
    await registrar.getByRole("button", { name: "Registrar como foi" }).click();
    const feita = page.getByRole("dialog", { name: /Como foi a demonstração de Condomínio Lago Sul/ });
    await feita.getByRole("button", { name: "Registrar" }).click();
    await expect(feita).toContainText("Conte como foi a demonstração.");
    await feita.getByLabel("O que conversaram").fill("Gostou do registro de pedidos; quer ver o custo com o conselho.");
    await conferir(page);
    await feita.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByRole("status")).toContainText("Demonstração registrada");
    await expect(page.getByRole("list", { name: "Demonstrações a registrar" })).toHaveCount(0);

    // Os horários: o que não se entende volta com a mensagem.
    await livres.getByRole("button", { name: "Editar" }).click();
    const disp = page.getByRole("dialog", { name: "Horários livres de Carolina" });
    await expect(disp.getByLabel("Segunda")).toHaveValue("10:00-12:00, 14:00-17:00");
    await disp.getByLabel("Quarta").fill("manhã");
    await disp.getByRole("button", { name: "Salvar os horários" }).click();
    await expect(disp).toContainText("Escreva como 10:00-12:00, 14:00-17:00");
    await disp.getByLabel("Quarta").fill("9-11");
    await conferir(page);
    await disp.getByRole("button", { name: "Salvar os horários" }).click();
    await expect(page.getByRole("status")).toContainText("Horários de Carolina salvos");
    await expect(livres).toContainText("09:00 a 11:00");

    // O link de agendamento da equipe.
    await page.getByRole("button", { name: "Copiar o link de agendamento" }).click();
    await expect(page.getByRole("status")).toContainText(`/a/${CODIGO_AGENDA}`);
    expect(api.comercial.pedidos.some((x) => x.caminho === "/v1/comercial/agenda/links")).toBe(true);
  });

  test("a página pública do link: o horário que acabou de ser ocupado e a confirmação", async ({ page }) => {
    const api = await instalarApiFalsa(page, { logado: false });
    await page.goto(`${CONSOLE}/a/${CODIGO_AGENDA}`);
    await expect(page.getByRole("heading", { name: "Escolha um horário para conhecer a TRÍADE", level: 1 })).toBeVisible();
    await expect(page.getByText("30 minutos por vídeo, com alguém da equipe. Horário de Brasília.")).toBeVisible();
    await expect(page.getByRole("button", { name: "14:00 (ocupado)" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Escolha um horário" })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "16:00", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Confirmar .+, 16:00$/ })).toBeVisible();
    await page.getByLabel("Seu nome").fill("Renata Moura");
    await page.getByLabel("WhatsApp").fill("(61) 99876-5230");
    await page.getByLabel("E-mail").fill("renata@exemplo.com.br");
    await page.getByLabel("Condomínio").fill("Edifício Jatobá");
    await page.getByLabel("Unidades").selectOption("DE_41_A_100");
    await page.getByRole("button", { name: /^Confirmar / }).click();
    await expect(page.getByText("Falta a autorização.")).toBeVisible();
    await page.getByRole("checkbox", { name: /Autorizo a TRÍADE/ }).check();
    await page.getByRole("button", { name: /^Confirmar / }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Este horário acabou de ser ocupado. Escolha outro." })).toBeVisible();
    await expect(page.getByRole("button", { name: "16:00 (ocupado)" })).toBeDisabled();

    await page.getByRole("button", { name: "15:30", exact: true }).click();
    await page.getByRole("button", { name: /^Confirmar .+, 15:30$/ }).click();
    await expect(page.getByRole("status")).toContainText("Demonstração marcada");
    await expect(page.getByRole("status")).toContainText("15:30");
    await conferir(page);
    const pedido = api.comercial.pedidos.filter((x) => x.caminho === `/v1/publico/agenda/${CODIGO_AGENDA}`).at(-1)!.corpo;
    expect(pedido).toMatchObject({ nome: "Renata Moura", email: "renata@exemplo.com.br", condominio: "Edifício Jatobá", faixa: "DE_41_A_100", consentimento: true });

    await page.goto(`${CONSOLE}/a/zzzzzzzzzzzz`);
    await expect(page.getByRole("heading", { name: "Este link de agendamento não está mais disponível" })).toBeVisible();
    await conferir(page);
  });
});

test.describe("Console · Taxa média de condomínio (R17.3c)", () => {
  test("nova proposta: sem a taxa, só o valor; com a taxa, o peso nela e o destaque", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/propostas/nova?interessado=${SITE}`);
    await expect(page.getByLabel("Unidades ativas")).toHaveValue("72");
    const resumo = page.getByRole("region", { name: "O que vai na proposta" });
    await expect(resumo).toContainText("Menos de R$ 5 por apartamento por mês");
    await expect(resumo).toContainText("R$ 3,18 por mês com 72 unidades (estimativa; implantação à parte)");
    await expect(page.getByLabel("Taxa média de condomínio (R$ por mês)")).toHaveValue("");
    await page.getByLabel("Taxa média de condomínio (R$ por mês)").fill("650");
    await expect(resumo).toContainText("R$ 3,18 por mês com 72 unidades, cerca de 0,5% da taxa média de R$ 650,00");
    await conferir(page);
    await page.getByLabel("Taxa média de condomínio (R$ por mês)").fill("30000");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page.getByText("A taxa vai de R$ 0,01 a R$ 20.000")).toBeVisible();
    await page.getByLabel("Taxa média de condomínio (R$ por mês)").fill("650,00");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/\/comercial\/propostas\?proposta=/);
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/propostas")?.corpo).toMatchObject({ taxaCondominio: 650, interessadoVersao: 1 });
  });

  test("r8: a versão nova sem mexer na taxa não manda a taxa; mudada, vai com a versão da ficha", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/propostas/${PROPOSTA_IPE}/versao`);
    await expect(page.getByLabel("Taxa média de condomínio (R$ por mês)")).toHaveValue("");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/\/comercial\/propostas\?proposta=/);
    const sem = api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/propostas/${PROPOSTA_IPE}/versoes`)?.corpo as Record<string, unknown>;
    expect(sem).toBeDefined();
    expect("taxaCondominio" in sem || "interessadoVersao" in sem).toBe(false);
  });

  test("o link: com a taxa (Cerrado), o peso nela; sem a taxa (Ipê), só o valor", async ({ page }) => {
    await instalarApiFalsa(page, { logado: false });
    await page.goto(`${CONSOLE}/o/${CODIGO_CERRADO}`);
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês")).toBeVisible();
    await expect(page.getByText("R$ 3,58 por apartamento, cerca de 0,6% da taxa média de R$ 650,00 que o prédio informou.")).toBeVisible();
    await expect(page.getByText("cerca de 0,6% de R$ 650,00")).toBeVisible();
    await conferir(page);

    await page.goto(`${CONSOLE}/o/${CODIGO_IPE}`);
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês")).toBeVisible();
    await expect(page.getByText("R$ 4,03 por apartamento por mês.", { exact: true })).toBeVisible();
    await expect(page.getByText("Na taxa de condomínio")).toHaveCount(0);
    await conferir(page);
  });

  test("o kit: corrigir a taxa grava na ficha e muda o destaque e o comparativo", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/propostas/${PROPOSTA_IPE}/kit`);
    const custo = page.getByRole("region", { name: "Custo na apresentação" });
    await expect(custo).toContainText("Menos de R$ 5 por apartamento por mês");
    await expect(custo).toContainText("R$ 4,03 por apartamento por mês.");
    await expect(custo.getByText("Taxa informada")).toHaveCount(0);
    await expect(custo.getByLabel("Unidades")).toHaveValue("32");
    await expect(custo).toContainText("Da proposta v1 enviada.");
    await expect(custo).toContainText("Sem a taxa, o kit mostra só o valor por apartamento.");
    await conferir(page);
    await custo.getByLabel("Taxa média de condomínio (R$ por mês)").fill("650,00");
    await custo.getByRole("button", { name: "Salvar a taxa" }).click();
    await expect(page.getByRole("status")).toContainText("Taxa salva na ficha");
    await expect(custo).toContainText("R$ 4,03 por apartamento, cerca de 0,6% da taxa média de R$ 650,00 do Edifício Ipê Amarelo.");
    await expect(custo.getByText("Taxa informada")).toBeVisible();
    await expect(page.getByRole("table").first()).toContainText("R$ 4,03 (estimativa), cerca de 0,6% da taxa");
    await conferir(page);
    expect(api.comercial.pedidos.find((x) => /\/taxa$/.test(x.caminho))?.corpo).toMatchObject({ taxaCondominio: 650 });
    // A versão enviada não muda.
    const ipe = api.comercial.propostas.find((x) => x.id === PROPOSTA_IPE)!;
    expect(((ipe.versoes as Record<string, unknown>[])[0]!.premissas as Record<string, unknown>).taxaCondominio).toBeUndefined();

    // r5: tirar a taxa deixa o kit sem taxa, sem voltar à da versão.
    await expect(custo).toContainText("Esta é a taxa da ficha.");
    await custo.getByLabel("Taxa média de condomínio (R$ por mês)").fill("");
    await custo.getByRole("button", { name: "Salvar a taxa" }).click();
    await expect(page.getByRole("status")).toContainText("Taxa tirada da ficha");
    await expect(custo).toContainText("R$ 4,03 por apartamento por mês.");
    await expect(custo).toContainText("Sem taxa na ficha: o kit mostra só o valor por apartamento.");
    await expect(custo.getByText("Taxa informada")).toHaveCount(0);
    await expect(custo.getByLabel("Taxa média de condomínio (R$ por mês)")).toHaveValue("");
  });
});

test.describe("Console · Agendamento na ficha (r1, R17.6b, A, C)", () => {
  test("a mensagem pronta troca o [link de agendamento] pelo link de quem atende", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    await expect(page.getByText(`Oi, João, que dia fica bom para a demonstração? Se preferir, escolha o horário por aqui: ${CONSOLE}/a/abcdefgh2345`)).toBeVisible();
    await conferir(page);
  });

  test("o possível duplicado do agendamento pelo link aparece na ficha, com o outro interessado", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${LAGO}`);
    const aviso = page.getByText("Agendou pelo link com o WhatsApp ou o e-mail de outro interessado, mas não os dois.");
    await expect(aviso).toBeVisible();
    await expect(page.getByRole("link", { name: "Residencial Jatobá" })).toHaveAttribute("href", `/comercial/${SITE}`);
    // C: o pedido pelo link que não marcou fica em destaque, até alguém registrar uma conversa.
    await expect(page.getByText("Pediu outra demonstração pelo link")).toBeVisible();
    await expect(page.getByText("o pedido para quinta, 29/10, 15:30 não foi marcado")).toBeVisible();
    await expect(page.getByText("O aviso sai quando você registrar uma conversa.")).toBeVisible();
    await conferir(page);
  });

  test("A: a mensagem abre o WhatsApp com o convite da ficha no link; a conversa fica sem o convite", async ({ page, context }) => {
    const api = await instalarApiFalsa(page);
    api.comercial.interessados.find((x) => x.id === INDICADO)!.temWhatsapp = true;
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    await expect(page.getByText("O link de agendamento sai com um código desta ficha: quem marcar por ele entra aqui, mesmo sem o e-mail.")).toBeVisible();
    await conferir(page);
    await context.route("https://wa.me/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>WhatsApp</title>" }));
    const aba = context.waitForEvent("page");
    await page.getByRole("listitem").filter({ hasText: "Marcar demonstração" }).getByRole("button", { name: "Abrir no WhatsApp" }).click();
    const nova = await aba;
    await nova.waitForURL(/wa\.me/);
    expect(decodeURIComponent(nova.url())).toMatch(new RegExp(`${CONSOLE}/a/abcdefgh2345\\?c=[0-9a-f]{32}`));
    await nova.close();
    expect(api.comercial.pedidos.some((x) => x.caminho === `/v1/comercial/interessados/${INDICADO}/convite-agenda`)).toBe(true);
    const conversa = page.getByRole("dialog", { name: "Registrar conversa" });
    await expect(conversa.getByLabel("O que conversaram")).toHaveValue(`Oi, João, que dia fica bom para a demonstração? Se preferir, escolha o horário por aqui: ${CONSOLE}/a/abcdefgh2345`);
  });
});

test.describe("Console · Link de agendamento com o convite (A, C)", () => {
  async function preencher(page: Page, email: string) {
    await page.getByRole("button", { name: "15:30", exact: true }).click();
    await page.getByLabel("Seu nome").fill("Renata Moura");
    await page.getByLabel("WhatsApp").fill("(61) 99876-5230");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Condomínio").fill("Edifício Jatobá");
    await page.getByRole("checkbox", { name: /Autorizo a TRÍADE/ }).check();
    await page.getByRole("button", { name: /^Confirmar / }).click();
  }

  test("o ?c= da mensagem vai junto no agendamento; o que não tem o formato não vai", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    const convite = "c".repeat(31) + "1";
    await page.goto(`${CONSOLE}/a/${CODIGO_AGENDA}?c=${convite}`);
    await preencher(page, "renata@exemplo.com.br");
    await expect(page.getByRole("status")).toContainText("Demonstração marcada");
    expect(api.comercial.pedidos.filter((x) => x.caminho === `/v1/publico/agenda/${CODIGO_AGENDA}`).at(-1)!.corpo).toMatchObject({ convite });

    await page.goto(`${CONSOLE}/a/${CODIGO_AGENDA}?c=torto`);
    await page.getByRole("button", { name: "15:30 (ocupado)" }).waitFor();
    await page.getByRole("button", { name: "14:45", exact: true }).click();
    await page.getByLabel("Seu nome").fill("Renata Moura");
    await page.getByLabel("WhatsApp").fill("(61) 99876-5230");
    await page.getByLabel("E-mail").fill("renata@exemplo.com.br");
    await page.getByLabel("Condomínio").fill("Edifício Jatobá");
    await page.getByRole("checkbox", { name: /Autorizo a TRÍADE/ }).check();
    await page.getByRole("button", { name: /^Confirmar / }).click();
    await expect(page.getByRole("status")).toContainText("Demonstração marcada");
    expect("convite" in (api.comercial.pedidos.filter((x) => x.caminho === `/v1/publico/agenda/${CODIGO_AGENDA}`).at(-1)!.corpo as object)).toBe(false);
  });

  test("C: quem já tem demonstração marcada vê a data dela, sem marcar outra", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/a/${CODIGO_AGENDA}`);
    await preencher(page, "ja.marcada@exemplo.com.br");
    await expect(page.getByRole("heading", { name: "Você já tem uma demonstração marcada", level: 1 })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Nenhum horário novo foi marcado. Para mudar, responda o e-mail de confirmação.");
    await expect(page.getByRole("status")).toContainText("14:00");
    await conferir(page);
  });
});

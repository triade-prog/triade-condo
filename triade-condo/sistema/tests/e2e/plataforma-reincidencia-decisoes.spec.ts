// F7.4 (design "Reincidência e decisões"): pedidos relacionados (AT-18), a decisão pedida ao
// síndico (AT-23) e os dois indicadores que faltavam (TR-01), com a API falsa. Cada tela passa no
// axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirMaisAcoes, historicoCompleto, maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

/** No celular o menu abre e fecha pelo botão Menu; no computador está sempre à vista. */
/** No celular, abre a folha do menu ou fecha a que estiver aberta. */
async function alternarMenu(page: Page) {
  if (await page.getByRole("dialog", { name: "Menu" }).isVisible()) await page.keyboard.press("Escape");
  else if (await page.getByRole("button", { name: "Mais", exact: true }).isVisible()) await page.getByRole("button", { name: "Mais", exact: true }).click();
}

const recado = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });

test.describe("Plataforma · reincidência e decisões", () => {
  test("AT-18: o pedido sugere os parecidos; Não é descarta; a reincidência fica no histórico e pode ser desfeita", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    const rel = page.getByRole("region", { name: "Pedidos relacionados" });
    await expect(rel).toContainText("Parecidos nos últimos 90 dias");
    await expect(rel).toContainText("2026-0005 Portão aberto de madrugada");
    await expect(rel).toContainText("2026-0004 Portão da garagem não fechava");
    await expect(rel).toContainText("Concluído em 26/09");
    // Só o concluído antes de este abrir pode ser reincidência.
    await expect(rel.getByRole("button", { name: "2026-0005 é reincidência" })).toHaveCount(0);
    await conferir(page);

    await rel.getByRole("button", { name: "2026-0005 não é o mesmo problema" }).click();
    await expect(recado(page, "Sugestão descartada: o 2026-0005 não aparece mais como parecido deste pedido.")).toBeVisible();
    await expect(rel.getByRole("button", { name: "2026-0005 é duplicado" })).toHaveCount(0);

    await rel.getByRole("button", { name: "2026-0004 é reincidência" }).click();
    const ligar = page.getByRole("dialog", { name: "Ligar como reincidência" });
    await expect(ligar).toContainText("Este pedido 2026-0002 fica marcado como reincidência de 2026-0004, concluído em 26/09. O problema voltou depois de resolvido.");
    await ligar.getByRole("button", { name: "Ligar", exact: true }).click();
    await expect(ligar.getByText("Escreva de 3 a 300 caracteres.")).toBeVisible();
    await ligar.getByLabel("O que faz pensar que é o mesmo problema").fill("O mesmo portão parou de fechar de novo.");
    await conferir(page);
    await ligar.getByRole("button", { name: "Ligar", exact: true }).click();
    await expect(recado(page, "Ligado como reincidência. Conta no indicador do período.")).toBeVisible();
    await expect(rel).toContainText("Reincidência de2026-0004");
    await expect(rel).toContainText("“O mesmo portão parou de fechar de novo.”");
    await expect(rel.getByRole("button", { name: "2026-0004 é reincidência" })).toHaveCount(0);

    await historicoCompleto(page);
    await expect((await historicoCompleto(page))).toContainText("Reincidência de 2026-0004");

    await rel.getByRole("button", { name: "Desfazer a ligação com 2026-0004" }).click();
    const desfazer = page.getByRole("dialog", { name: "Desfazer a ligação com 2026-0004" });
    await desfazer.getByLabel("Por que desfazer").fill("Era o portão de pedestres, não o da garagem.");
    await desfazer.getByRole("button", { name: "Desfazer a ligação" }).click();
    await expect(recado(page, "Ligação desfeita.")).toBeVisible();
    await expect(rel.getByRole("button", { name: "2026-0004 é reincidência" })).toBeVisible();
    await historicoCompleto(page);
    await expect((await historicoCompleto(page))).toContainText("Ligação com 2026-0004 desfeita. Motivo: Era o portão de pedestres, não o da garagem.");
  });

  test("AT-18: o duplicado pode ser encerrado com o retorno ao morador; cada um mostra o outro", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    const rel = page.getByRole("region", { name: "Pedidos relacionados" });
    await rel.getByRole("button", { name: "2026-0005 é duplicado" }).click();
    const ligar = page.getByRole("dialog", { name: "Ligar como duplicado" });
    await expect(ligar).toContainText("O pedido 2026-0005 (Portão da garagem) é o mesmo problema que este, relatado de novo. O 2026-0002 segue como o principal.");
    await expect(ligar.getByLabel("Encerrar o 2026-0005 e avisar o morador")).toBeChecked();
    await expect(ligar.getByLabel("Retorno ao morador")).toHaveValue(/já está sendo tratado no protocolo 2026-0002/);
    await ligar.getByLabel("O que faz pensar que é o mesmo problema").fill("A portaria registrou o mesmo portão uma hora depois.");
    await conferir(page);
    await ligar.getByRole("button", { name: "Ligar como duplicado" }).click();
    await expect(recado(page, "Ligado como duplicado. O 2026-0005 foi encerrado e o morador recebe o retorno.")).toBeVisible();
    await expect(rel).toContainText("Relatado de novo em2026-0005");

    await rel.getByRole("link", { name: "Abrir o pedido 2026-0005" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Portão aberto de madrugada/ })).toBeVisible();
    const outro = page.getByRole("region", { name: "Pedidos relacionados" });
    await expect(outro).toContainText("Duplicado de2026-0002");
    await expect(outro).toContainText("ligado por Ana Souza em 16/10");
    await historicoCompleto(page);
    await expect((await historicoCompleto(page))).toContainText("Duplicado de 2026-0002");
    await conferir(page);
  });

  test("AT-18: ligar à mão pelo protocolo, escolhendo como ligar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[4]!.id}`);
    const rel = page.getByRole("region", { name: "Pedidos relacionados" });
    await rel.getByRole("button", { name: "Ligar a outro pedido" }).click();
    const buscar = page.getByRole("dialog", { name: "Ligar a outro pedido" });
    await buscar.getByLabel("Protocolo ou assunto").fill("9999");
    await buscar.getByRole("button", { name: "Buscar" }).click();
    await expect(buscar.getByText("Nenhum pedido encontrado para ligar.")).toBeVisible();
    await buscar.getByLabel("Protocolo ou assunto").fill("0004");
    await buscar.getByRole("button", { name: "Buscar" }).click();
    await conferir(page);
    await buscar.getByRole("button", { name: "Escolher 2026-0004" }).click();

    const ligar = page.getByRole("dialog", { name: "Ligar ao 2026-0004" });
    const como = ligar.getByRole("group", { name: "Como ligar" });
    await expect(como.getByRole("button", { name: "Reincidência" })).toHaveAttribute("aria-pressed", "true");
    await como.getByRole("button", { name: "Duplicado" }).click();
    await expect(ligar).toContainText("Este pedido 2026-0005 é o mesmo problema que o 2026-0004 (portão da  garagem), relatado de novo.");
    await como.getByRole("button", { name: "Reincidência" }).click();
    await expect(ligar).toContainText("Este pedido 2026-0005 fica marcado como reincidência de 2026-0004, concluído em 26/09.");
    await ligar.getByLabel("O que faz pensar que é o mesmo problema").fill("O portão voltou a ficar aberto.");
    await conferir(page);
    await ligar.getByRole("button", { name: "Ligar", exact: true }).click();
    await expect(recado(page, "Ligado como reincidência. Conta no indicador do período.")).toBeVisible();
    await expect(rel).toContainText("Reincidência de2026-0004");
  });

  test("AT-23: pedir decisão abre a pendência que se resolve sozinha; quem pediu pode retirar com motivo", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    await maisAcoes(page, "Pedir decisão");
    const pedir = page.getByRole("dialog", { name: "Pedir decisão ao síndico" });
    await expect(pedir.getByLabel("Quem decide")).toContainText("Ana Souza (síndico)");
    await expect(pedir.getByLabel("Decidir até")).toHaveValue("2026-10-19");
    await pedir.getByRole("button", { name: "Pedir decisão" }).click();
    await expect(pedir.getByText("Diga o que precisa ser decidido (3 a 500 caracteres).")).toBeVisible();

    await pedir.getByLabel("O que precisa ser decidido").fill("Consertar ou trocar o motor do portão da garagem");
    await pedir.getByLabel("Alternativa 1").fill("Consertar o motor atual");
    await pedir.getByLabel("Custo estimado").fill("mil reais");
    await pedir.getByLabel("Detalhe").fill("Portões Lima, em 2 dias");
    await pedir.getByRole("button", { name: "+ Alternativa" }).click();
    await pedir.getByRole("textbox", { name: "Alternativa 2" }).fill("Trocar o motor");
    await pedir.getByLabel("Custo estimado").nth(1).fill("2.400");
    await pedir.getByLabel("Por que agora").fill("O portão parou duas vezes este mês.");
    await pedir.getByRole("button", { name: "Pedir decisão" }).click();
    await expect(pedir.getByText("Escreva o valor em reais, como 2.400,00.")).toBeVisible();
    await pedir.getByLabel("Custo estimado").first().fill("1.150,50");
    await conferir(page);
    await pedir.getByRole("button", { name: "Pedir decisão" }).click();
    await expect(recado(page, "Decisão registrada para você responder. O pedido ganhou a pendência Decisão.")).toBeVisible();

    const faixa = page.getByRole("status").filter({ hasText: "Esperando a sua decisão até 19/10" });
    await expect(faixa).toContainText("Consertar ou trocar o motor do portão da garagem · 2 alternativas · pedida por Ana Souza");
    const pendencia = page.getByRole("listitem").filter({ hasText: "Aguardando decisão do síndico" });
    await expect(pendencia).toContainText("resolve sozinha quando você responder");
    await expect(pendencia.getByRole("button", { name: "Resolver" })).toHaveCount(0);
    await conferir(page);

    await page.getByRole("button", { name: "Ver a decisão: Consertar ou trocar o motor do portão da garagem" }).click();
    const ver = page.getByRole("dialog", { name: "Decisão pedida" });
    await expect(ver).toContainText("Vence em 3 dias");
    await expect(ver.getByRole("listitem").filter({ hasText: "Consertar o motor atual" })).toContainText("R$ 1.150,50");
    await expect(ver.getByRole("listitem").filter({ hasText: "Trocar o motor" })).toContainText("R$ 2.400");
    await expect(ver).toContainText("Por que agora: O portão parou duas vezes este mês.");
    await conferir(page);
    await ver.getByRole("button", { name: "Retirar" }).click();
    const retirar = page.getByRole("dialog", { name: "Retirar o pedido de decisão" });
    await retirar.getByLabel("Por que retirar").fill("A administradora já autorizou o conserto.");
    await retirar.getByRole("button", { name: "Retirar" }).click();
    await expect(recado(page, "Pedido de decisão retirado. A pendência do pedido foi fechada.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pendências abertas" })).toHaveCount(0);
    await page.getByText("1 decisão respondida ou retirada").click();
    await expect(page.getByText(/Retirada por Ana Souza em .*: A administradora já autorizou o conserto\./)).toBeVisible();

    await historicoCompleto(page);
    await expect((await historicoCompleto(page))).toContainText("Decisão pedida ao síndico · 2 alternativas · prazo 19/10/2026");
    await expect((await historicoCompleto(page))).toContainText("Pedido de decisão retirado. Motivo: A administradora já autorizou o conserto.");
  });

  test("AT-23: a decisão vencida aparece no início, no menu e no sino; decidir pede a alternativa e a justificativa", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true });
    await page.goto(PLATAFORMA);
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora).toContainText("1 decisão aguardando você");
    await expect(agora).toContainText("1 com o prazo vencido; a mais antiga foi pedida há 2 dias.");
    await alternarMenu(page);
    await expect(page.getByRole("link", { name: /^Decisões/ })).toContainText("1");
    await alternarMenu(page);

    await page.getByRole("button", { name: "Avisos (3) sem ver" }).click();
    const sino = page.getByRole("dialog", { name: "Avisos" });
    const aviso = sino.getByRole("listitem").filter({ hasText: "Qual encanador chamar para o vazamento" });
    await expect(aviso).toContainText("Decisão");
    await expect(aviso).toContainText("Pediram a sua decisão até 15/10/2026.");
    await conferir(page);
    await aviso.getByRole("link", { name: "Decidir" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Decisões" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Quais decisões" }).getByRole("button", { name: "Aguardando 1" })).toHaveAttribute("aria-pressed", "true");
    const cartao = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Qual encanador chamar para o vazamento" }) });
    await expect(cartao).toContainText("Venceu ontem");
    await expect(cartao).toContainText("Pedido 2026-0001 · Vazamento no banheiro · pedida por Bruna em 14/10");
    await expect(cartao).toContainText("2 alternativas · de R$ 350 a R$ 520");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Encanador da administradora" })).toContainText("R$ 520");
    await conferir(page);

    await cartao.getByRole("button", { name: "Decidir: Qual encanador chamar para o vazamento" }).click();
    const decidir = page.getByRole("dialog", { name: "Decidir · 2026-0001" });
    await expect(decidir).toContainText("O morador está sem usar o banheiro.");
    await decidir.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(decidir.getByText("Escolha a alternativa que você aprova.")).toBeVisible();
    await decidir.getByRole("radio", { name: /Encanador da administradora/ }).check();
    await decidir.getByRole("button", { name: "Aprovar a alternativa 2" }).click();
    await expect(decidir.getByText("Explique a resposta (3 a 1000 caracteres).")).toBeVisible();
    await decidir.getByLabel("Justificativa").fill("A administradora dá garantia do serviço.");
    await conferir(page);
    await decidir.getByRole("button", { name: "Aprovar a alternativa 2" }).click();
    await expect(recado(page, "Alternativa 2 aprovada. Quem pediu foi avisado no sino.")).toBeVisible();
    await expect(page.getByText("Nenhuma decisão esperando você")).toBeVisible();

    await page.getByRole("group", { name: "Quais decisões" }).getByRole("button", { name: "Respondidas" }).click();
    const decidida = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Qual encanador chamar para o vazamento" }) });
    await expect(decidida).toContainText("Aprovada a alternativa 2 (Encanador da administradora) por Ana Souza");
    await expect(decidida.getByRole("button", { name: /^Decidir/ })).toHaveCount(0);
    await decidida.getByRole("link", { name: "Abrir o pedido 2026-0001" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Vazamento no banheiro/ })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Aguardando decisão do síndico" })).toHaveCount(0);
    await historicoCompleto(page);
    await expect((await historicoCompleto(page))).toContainText("Decisão respondida: aprovada a alternativa 2");
  });

  test("CF-03: quem só vê não pede, não decide e não liga; a janela dos parecidos muda nas Regras", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true, quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[0]!.id}`);
    await expect(page.getByRole("heading", { level: 1, name: /Vazamento no banheiro/ })).toBeVisible();
    const faixa = page.getByRole("status").filter({ hasText: "Esperando a decisão de Ana Souza até 15/10 (prazo vencido)" });
    await expect(faixa).toBeVisible();
    await expect(faixa.getByRole("button", { name: "Decidir" })).toHaveCount(0);
    await abrirMaisAcoes(page);
    await expect(page.getByRole("button", { name: "Pedir decisão" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Pedidos relacionados" })).toHaveCount(0);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/decisoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Decisões" })).toBeVisible();
    await expect(page.getByText("Você não tem a permissão Aprovar.")).toBeVisible();
    await alternarMenu(page);
    await expect(page.getByRole("link", { name: /^Decisões/ })).toHaveCount(0);
  });

  test("AT-18 e CF-09: a janela dos parecidos aparece nas Regras; para mudar, o síndico pede à TRÍADE", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAtendimento: true, comDecisoes: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=regras`);
    const bloco = page.getByRole("region", { name: "Feito pela TRÍADE" });
    await expect(bloco).toContainText("Só a TRÍADE muda.");
    const parecidos = bloco.getByRole("region", { name: "Pedidos parecidos" });
    await expect(parecidos).toContainText("90 dias");
    await expect(parecidos.getByRole("group", { name: "Janela dos parecidos" })).toHaveCount(0);
    await conferir(page);
    await parecidos.getByRole("link", { name: "Pedir mudança" }).click();
    await expect(page.getByLabel("Título")).toHaveValue("Mudar: Pedidos parecidos");
    await expect(page.getByLabel("O que aconteceu")).toHaveValue(/Hoje: 90 dias\./);
    await expect(page.getByLabel("Onde no sistema")).toHaveValue("CONFIGURACOES");
  });

  test("TR-01: reincidência no período e decisões aguardando o síndico nos indicadores", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/indicadores`);
    const periodo = page.getByRole("region", { name: "No período", exact: true });
    await expect(periodo).toContainText("1 de 3 pedidos");
    await expect(periodo).toContainText("33%");
    const volta = page.getByRole("region", { name: "Onde o problema volta" });
    await expect(volta).toContainText("Portão da garagem");
    await expect(volta.getByRole("link", { name: "Pedido 2026-0002" })).toHaveAttribute("href", /\/pedidos\?busca=2026-0002$/);
    await volta.getByRole("button", { name: "Como se calcula: reincidência" }).click();
    await expect(volta.getByText(/Duplicado não conta\./)).toBeVisible();
    // Aguardando é de agora; decididas e tempo típico, do período.
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora.getByRole("link", { name: /^1 decisão aguardando/ })).toHaveAttribute("href", /\/decisoes$/);
    await expect(agora).toContainText("1 com prazo vencido · a mais antiga espera há 2 dias.");
    const dec = page.getByRole("region", { name: "Decisões no período" });
    await expect(dec).toContainText(/Sem dados\s*tempo típico/);
    await conferir(page);
    await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "Mês passado" }).click();
    await expect(periodo).toContainText("3 de 45 pedidos");
    await expect(periodo).toContainText("7%");
    await expect(volta).toContainText("Garagem G2, vaga 31");
    await expect(volta).toContainText("2 vezes");
    await expect(volta.getByRole("link", { name: "Pedido 2026-0142" })).toBeVisible();
    await expect(dec).toContainText(/7\s*decididas/);
    await expect(dec).toContainText(/5\s*aprovadas/);
    await expect(dec).toContainText("e 2 devolvidas para o responsável");
    await expect(dec).toContainText(/1 dia e 3 h\s*tempo típico/);
  });
});

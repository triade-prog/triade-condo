// Peça R4 no Console (PI-04, PI-05, CT-01, PI-09, PI-11, PI-20, SH-01) com a API falsa: roteiro de
// implantação e entrega, troca de síndico, suporte de acesso, chamados e acesso excepcional. Cada
// tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";
import { CHAMADO } from "./api-falsa-console-suporte";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function convidarSindica(page: Page) {
  await page.getByRole("tab", { name: "Síndico" }).click();
  await page.getByRole("button", { name: "Convidar síndico" }).click();
  const convite = page.getByRole("dialog", { name: "Convidar síndico" });
  await convite.getByLabel("Nome").fill("Ana Souza");
  await convite.getByLabel("E-mail").fill("ana@exemplo.invalid");
  await convite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Ana Souza");
}

test.describe("Console · implantação e suporte", () => {
  test("PI-04 e SH-01: o roteiro tem etapas com situação, a apresentação diz a modalidade", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Implantação" }).click();
    await expect(page.getByText("3 de 8 etapas · roteiro versão 1")).toBeVisible();
    await expect(page.getByText("Interno · o cliente não vê")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Etapa 5: Apresentação ao síndico e ao conselho" }).click();
    const j = page.getByRole("dialog", { name: "Etapa 5 · Apresentação ao síndico e ao conselho" });
    await j.getByRole("button", { name: "Realizada" }).click();
    await j.getByLabel("O que foi feito").fill("Apresentado à síndica e ao conselho.");
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(j.getByText("Diga se foi presencial ou por vídeo.")).toBeVisible();
    await j.getByLabel("Modalidade").selectOption("VIDEO");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar" }).click();
    await expect(j).toBeHidden();
    await expect(page.getByText("4 de 8 etapas · roteiro versão 1")).toBeVisible();
  });

  test("PI-05: pendência vencida aparece e é resolvida", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/implantacoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Implantações" })).toBeVisible();
    await expect(page.getByText("1 pendência vencida")).toBeVisible();
    await conferir(page);
    await page.getByRole("link", { name: "Residencial Ipê" }).click();
    await page.getByRole("tab", { name: "Implantação" }).click();
    await expect(page.getByText(/Venceu em/)).toBeVisible();
    await page.getByRole("button", { name: "Síndica enviar a planilha de moradores" }).click();
    const j = page.getByRole("dialog", { name: "Pendência" });
    await j.getByLabel("Como resolveu (opcional)").fill("Planilha recebida");
    await j.getByRole("button", { name: "Marcar resolvida" }).click();
    await expect(page.getByText("Nenhuma pendência aberta.")).toBeVisible();
  });

  test("PI-04: a entrega só sai com tudo conferido e passa o cliente a ativo", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await convidarSindica(page);
    await page.getByRole("tab", { name: "Implantação" }).click();
    await expect(page.getByRole("button", { name: "Entregar ao cliente" })).toBeDisabled();
    await expect(page.getByText(/Falta: Etapas 1 a 7/)).toBeVisible();
    for (const e of estado.suporte.etapas.slice(3, 7)) Object.assign(e, { situacao: "REALIZADA", feito: "Feito." });
    estado.suporte.pedidoTeste = true;
    await page.reload();
    await page.getByRole("tab", { name: "Implantação" }).click();
    await page.getByRole("button", { name: "Entregar ao cliente" }).click();
    const j = page.getByRole("dialog", { name: "Entregar o Residencial Ipê" });
    await expect(j).toContainText("Pedido de teste 2026-0001 registrado, respondido e concluído pelo síndico");
    await expect(j.getByLabel("Recado de entrega ao síndico")).toHaveValue(/O Residencial Ipê está pronto/);
    await conferir(page);
    await j.getByRole("button", { name: "Entregar ao cliente" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Implantação entregue" })).toBeVisible();
    await expect(page.getByText("Ativo", { exact: true }).first()).toBeVisible();
  });

  test("CT-01: troca de síndico registra o que foi conferido e pede revisão das autorizadas", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await convidarSindica(page);
    await page.getByRole("button", { name: "Trocar síndico" }).click();
    const j = page.getByRole("dialog", { name: "Troca de síndico · Residencial Ipê" });
    await expect(j.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await j.getByLabel("Quem pediu").fill("Conselheira Rita");
    await j.getByRole("button", { name: "Continuar" }).click();
    await j.getByLabel("Item 1").fill("Ata da AGE de 12/10/2026 com a eleição");
    await conferir(page);
    await j.getByRole("button", { name: "Continuar" }).click();
    await j.getByLabel("Nome do novo síndico").fill("Marcos Lima");
    await j.getByLabel("E-mail").fill("marcos@exemplo.com.br");
    await j.getByRole("button", { name: "Continuar" }).click();
    await expect(j).toContainText("Ana Souza deixa de ser síndico e sai na hora");
    await conferir(page);
    await j.getByRole("button", { name: "Confirmar a troca" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Síndico trocado" })).toContainText("Bruna Alves");
    await expect(page.getByRole("tabpanel")).toContainText("Marcos Lima");
    expect(estado.suporte.trocas[0]!.conferido).toEqual(["Ata da AGE de 12/10/2026 com a eleição"]);
  });

  test("PI-09: o link só sai depois da verificação, para o e-mail mascarado", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/suporte-acesso`);
    await expect(page.getByRole("heading", { level: 1, name: "Suporte de acesso" })).toBeVisible();
    await conferir(page);
    await page.getByRole("link", { name: "Pedido de Bruna Alves · Residencial Ipê" }).click();
    await expect(page.getByText("b••••@exemplo.com.br", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar link para criar senha nova" })).toBeDisabled();
    // A caixa só fica marcada depois que o banco guarda a verificação.
    const dados = page.getByLabel("Confirmou dados que só a pessoa sabe, sem a equipe ver a senha");
    await dados.click();
    await expect(dados).toBeChecked();
    const canal = page.getByLabel("Pedido feito pelo canal já conhecido (o e-mail ou o telefone do cadastro)");
    await canal.click();
    await expect(canal).toBeChecked();
    await conferir(page);
    await page.getByRole("button", { name: "Enviar link para criar senha nova" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link para criar senha nova enviado" })).toBeVisible();
    expect(estado.suporte.suporte.linksEnviados).toBe(1);
    await expect(page.getByText("Link enviado", { exact: true })).toBeVisible();
  });

  test("PI-20 e PI-06: chamado com resposta ao cliente e nota interna", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/chamados`);
    await expect(page.getByRole("heading", { level: 1, name: "Chamados" })).toBeVisible();
    // No celular o menu abre pelo botão.
    if (await page.getByRole("button", { name: "Menu" }).isVisible()) await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("link", { name: "Chamados 1 em aberto" })).toBeVisible();
    await conferir(page);
    await page.getByRole("link", { name: "Fila some depois de filtrar por categoria" }).click();
    await expect(page).toHaveURL(new RegExp(`/chamados/${IPE}/${CHAMADO}`));
    await page.getByLabel("Resposta ao cliente").fill("Obrigado, Bruna. Reproduzi aqui.");
    await page.getByRole("button", { name: "Responder", exact: true }).last().click();
    await expect(page.getByRole("status").filter({ hasText: "Resposta enviada" })).toBeVisible();
    await page.getByRole("button", { name: "Nota interna", exact: true }).click();
    await page.getByLabel("Nota interna (o cliente não vê)").fill("Filtro ignora pedidos privados.");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("Nota interna · o cliente não vê")).toBeVisible();
    await conferir(page);
  });

  test("PI-11: pedir acesso excepcional e, aprovado, ler só a área com o registro", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}/acesso-excepcional`);
    await expect(page.getByRole("heading", { level: 1, name: "Acesso excepcional" })).toBeVisible();
    await page.getByRole("button", { name: "Pedir acesso" }).click();
    const j = page.getByRole("dialog", { name: /Pedir acesso excepcional/ });
    await j.getByLabel("Por que precisa ver os dados").fill("Ver");
    await j.getByRole("button", { name: "Pedir ao síndico" }).click();
    await expect(j.getByText("Explique o motivo")).toBeVisible();
    await j.getByLabel("Por que precisa ver os dados").fill("A fila some depois de filtrar por categoria.");
    await conferir(page);
    await j.getByRole("button", { name: "Pedir ao síndico" }).click();
    await expect(page.getByText("Esperando o síndico")).toBeVisible();

    Object.assign(estado.suporte.acessos[0]!, { situacao: "APROVADO", validoAte: new Date(Date.now() + 86400_000).toISOString() });
    await page.reload();
    await page.getByRole("button", { name: "Pedidos", exact: true }).click();
    await expect(page.getByText("2026-0007 · Limpeza do hall")).toBeVisible();
    await expect(page.getByText(/Esta abertura ficou no histórico/)).toBeVisible();
    expect(estado.suporte.acessos[0]!.leituras).toBe(1);
    await conferir(page);
  });
});

// O Next tem o próprio anunciador de rota (role=alert): os avisos são achados pelo texto.
// Passo 1 (F1): telas do Console TRÍADE com a API falsa. Cada tela passa no axe (WCAG 2.2 AA)
// no celular e no computador, e só mostra o que a pessoa pode fazer (PI-10).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE, NOVO } from "./api-falsa";

const CONSOLE = "http://localhost:3001";
const PLATAFORMA = "http://localhost:3000";

async function semErroDeAcessibilidade(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

test.describe("Console TRÍADE · passo 1", () => {
  test("sem sessão, o Console leva para o login", async ({ page }) => {
    await instalarApiFalsa(page, { logado: false });
    await page.goto(CONSOLE);
    await expect(page).toHaveURL(`${CONSOLE}/entrar`);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar no Console" })).toBeVisible();
    await semErroDeAcessibilidade(page);
  });

  test("PT-08: primeiro acesso cadastra o autenticador e abre a carteira", async ({ page }) => {
    await instalarApiFalsa(page, { logado: false, etapaSenha: "CADASTRAR_AUTENTICADOR" });
    await page.goto(`${CONSOLE}/entrar`);
    await page.getByLabel("E-mail").fill("carolina@triade.exemplo");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha não conferem." })).toBeVisible();

    await page.getByLabel("Senha").fill("senha-certa-da-equipe");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("img", { name: "QR code para cadastrar o autenticador" })).toBeVisible();
    await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
    await semErroDeAcessibilidade(page);

    await page.getByLabel("Código do autenticador").fill("000000");
    await page.getByRole("button", { name: "Confirmar código" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Código do autenticador não confere" })).toBeVisible();
    await page.getByLabel("Código do autenticador").fill("123456");
    await page.getByRole("button", { name: "Confirmar código" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Carteira de clientes" })).toBeVisible();
  });

  test("PT-08: recuperar acesso responde sempre a mesma coisa", async ({ page }) => {
    await instalarApiFalsa(page, { logado: false });
    await page.goto(`${CONSOLE}/recuperar`);
    await page.getByLabel("E-mail").fill("qualquer@exemplo.invalid");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se este e-mail tiver acesso" })).toBeVisible();
    await semErroDeAcessibilidade(page);
  });

  test("PI-01: carteira com estágio, situações a tratar e filtros", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(CONSOLE);
    const linha = page.getByRole("row", { name: /Residencial Ipê/ });
    await expect(linha).toContainText("Em implantação");
    await expect(linha).toContainText("Síndico ainda não convidado");
    await expect(linha).toContainText("Sem referência do contrato");
    await expect(page.getByText("Console TRÍADE · Admin").first()).toBeAttached();
    await page.getByRole("button", { name: "Ativos · 0" }).click();
    await expect(page.getByRole("row", { name: /Residencial Ipê/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Todos · 1" }).click();
    await semErroDeAcessibilidade(page);
  });

  test("V-04 a V-06: cadastrar condomínio com o cenário e cair na ficha", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(CONSOLE);
    await page.getByRole("link", { name: "+ Cadastrar condomínio" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cadastrar condomínio" })).toBeVisible();
    await page.getByLabel("Nome do condomínio").fill("Edifício Jatobá");
    await page.getByLabel("Cidade").fill("Goiânia");
    await page.getByRole("button", { name: "Cadastrar condomínio" }).click();
    await expect(page.getByText("Escolha a UF.")).toBeVisible();
    await page.getByLabel("UF").selectOption("GO");
    await page.getByRole("radio", { name: "Portaria remota" }).check();
    await semErroDeAcessibilidade(page);
    await page.getByRole("button", { name: "Cadastrar condomínio" }).click();
    await expect(page).toHaveURL(`${CONSOLE}/clientes/${NOVO}`);
    await expect(page.getByRole("heading", { level: 1, name: "Edifício Jatobá" })).toBeVisible();
  });

  test("CF-01 e AT-24: editar a ficha; conflito avisa sem perder o que foi escrito", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await expect(page.getByRole("tab", { name: "Ficha", selected: true })).toBeVisible();
    await expect(page.getByLabel("Número institucional (WhatsApp)")).toHaveValue("+55 61 99999-0001");
    await semErroDeAcessibilidade(page);

    // Outra pessoa salvou antes.
    estado.clientes[0]!.condominio.versao = 4;
    await page.getByLabel("Endereço").fill("SQS 308 bloco D");
    await page.getByRole("button", { name: "Salvar ficha" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Outra pessoa alterou este registro" })).toBeVisible();
    await expect(page.getByLabel("Endereço")).toHaveValue("SQS 308 bloco D");
    await page.getByRole("button", { name: "Carregar a versão nova" }).click();
    await page.getByLabel("Endereço").fill("SQS 308 bloco D");
    await page.getByRole("button", { name: "Salvar ficha" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ficha salva." })).toBeVisible();
    expect(estado.clientes[0]!.condominio.endereco).toBe("SQS 308 bloco D");
  });

  test("CF-02 e PI-01: convidar o síndico e concluir a implantação", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("button", { name: "Concluir implantação" }).click();
    const dialogo = page.getByRole("dialog", { name: "Concluir implantação" });
    await expect(dialogo).toContainText("convide o síndico antes");
    await expect(dialogo.getByRole("button", { name: "Concluir implantação" })).toBeDisabled();
    await dialogo.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("tab", { name: "Síndico" }).click();
    await expect(page.getByText("Nenhum síndico convidado ainda")).toBeVisible();
    await page.getByRole("button", { name: "Convidar síndico" }).click();
    const convite = page.getByRole("dialog", { name: "Convidar síndico" });
    await convite.getByLabel("Nome").fill("Ana Souza");
    await convite.getByLabel("E-mail").fill("ana@exemplo.invalid");
    await semErroDeAcessibilidade(page);
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Convite enviado" })).toBeVisible();
    await expect(page.getByRole("tabpanel")).toContainText("Ana Souza");

    await page.getByRole("button", { name: "Concluir implantação" }).click();
    await page.getByLabel("O que foi feito (opcional)").fill("A síndica fez o primeiro acesso");
    await page.getByRole("dialog").getByRole("button", { name: "Concluir implantação" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Implantação concluída" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Concluir implantação" })).toHaveCount(0);
  });

  test("PI-06 e PI-12: notas internas e histórico com o que é interno marcado", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Notas internas" }).click();
    await expect(page.getByText("Notas internas · o cliente nunca vê")).toBeVisible();
    await page.getByLabel("Nova nota para a equipe").fill("Boleto de outubro combinado para o dia 10.");
    await page.getByRole("button", { name: "Salvar nota" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Boleto de outubro" })).toContainText("Carolina · 16/10/2026 14:05");
    await semErroDeAcessibilidade(page);

    await page.getByRole("tab", { name: "Histórico" }).click();
    await expect(page.getByText("Ficha alterada: endereço, número institucional")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Referência do contrato alterada" })).toContainText("interno");
    await semErroDeAcessibilidade(page);
  });

  test("PI-10: implantação não muda contrato, não atribui equipe e não vê a equipe interna", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(CONSOLE);
    await expect(page.getByRole("link", { name: "+ Cadastrar condomínio" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pessoas e funções" })).toHaveCount(0);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await expect(page.getByLabel("Referência do contrato")).toBeDisabled();
    await expect(page.getByText("Só a administração muda.")).toBeVisible();
    await page.getByRole("tab", { name: "Equipe" }).click();
    await expect(page.getByRole("button", { name: "Atribuir pessoa" })).toHaveCount(0);
  });

  test("PI-10: a administração vê a equipe e as funções", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/equipe`);
    await expect(page.getByRole("row", { name: /Inês/ })).toContainText("Implantação");
    await expect(page.getByRole("row", { name: /Carolina/ }).getByRole("button", { name: /Desativar/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Rever funções de Inês" }).click();
    await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Implantação" })).toBeChecked();
    await semErroDeAcessibilidade(page);
    await page.keyboard.press("Escape");
    await page.goto(`${CONSOLE}/equipe/historico`);
    await expect(page.getByText("Pessoa cadastrada na equipe · Implantação")).toBeVisible();
    await semErroDeAcessibilidade(page);
  });

  test("CF-02: quem foi convidado cria a senha no Console e na Plataforma", async ({ page }) => {
    for (const base of [CONSOLE, PLATAFORMA]) {
      await instalarApiFalsa(page, { logado: false });
      await page.goto(`${base}/convite?token_hash=token-de-convite-valido-123`);
      await expect(page.getByRole("heading", { level: 1, name: "Criar sua senha" })).toBeVisible();
      await semErroDeAcessibilidade(page);
      await page.getByLabel("Senha nova").fill("uma frase bem comprida");
      await page.getByLabel("Repita a senha").fill("outra frase");
      await page.getByRole("button", { name: "Criar senha" }).click();
      await expect(page.getByText("As duas senhas não são iguais.")).toBeVisible();
      await page.getByLabel("Repita a senha").fill("uma frase bem comprida");
      await page.getByRole("button", { name: "Criar senha" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Senha criada" })).toBeVisible();
      await page.unrouteAll();
    }
  });
});

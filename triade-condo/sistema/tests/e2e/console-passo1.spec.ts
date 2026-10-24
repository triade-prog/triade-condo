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
  // Sem emoji nem emoticon nas telas (decisão da Carolina, 16/10/2026).
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
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
    // O Console abre no Início (rodada Console, decisão B.1).
    await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Carolina$/ })).toBeVisible();
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
    await page.goto(`${CONSOLE}/clientes`);
    const cliente = () => page.getByRole("listitem").filter({ hasText: "Residencial Ipê" });
    const linha = cliente();
    await expect(linha).toContainText("Em implantação");
    await expect(linha).toContainText("Síndico ainda não convidado");
    await expect(linha).toContainText("Sem referência do contrato");
    await expect(page.getByText("Console TRÍADE · Admin").first()).toBeAttached();
    const filtros = page.getByRole("navigation", { name: "Filtrar a carteira" });
    await filtros.getByRole("button", { name: "Ativos 0" }).click();
    await expect(cliente()).toHaveCount(0);
    await filtros.getByRole("button", { name: "Todos 1" }).click();
    await expect(cliente()).toHaveCount(1);
    await semErroDeAcessibilidade(page);
  });

  test("V-04 a V-06: cadastrar condomínio com o cenário e cair na ficha", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes`);
    await page.getByRole("link", { name: "Cadastrar condomínio" }).first().click();
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
    // A ficha abre na Visão geral, com os dados em cartões e a edição em janela (decisão A.1).
    await expect(page.getByRole("tab", { name: "Visão geral", selected: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Condomínio" })).toContainText("+55 61 99999-0001");
    await semErroDeAcessibilidade(page);

    // Outra pessoa salvou antes.
    estado.clientes[0]!.condominio.versao = 4;
    await page.getByRole("button", { name: "Editar condomínio" }).click();
    const janela = page.getByRole("dialog", { name: "Editar condomínio" });
    await expect(janela.getByLabel("Número institucional (WhatsApp)")).toHaveValue("+55 61 99999-0001");
    await janela.getByLabel("Endereço").fill("SQS 308 bloco D");
    await semErroDeAcessibilidade(page);
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(janela.getByRole("alert").filter({ hasText: "Outra pessoa alterou este registro" })).toBeVisible();
    await expect(janela.getByLabel("Endereço")).toHaveValue("SQS 308 bloco D");
    await janela.getByRole("button", { name: "Carregar a versão nova" }).click();
    await expect(janela).toHaveCount(0);
    await page.getByRole("button", { name: "Editar condomínio" }).click();
    await janela.getByLabel("Endereço").fill("SQS 308 bloco D");
    await janela.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ficha salva." })).toBeVisible();
    expect(estado.clientes[0]!.condominio.endereco).toBe("SQS 308 bloco D");
  });

  test("CF-02: convidar o síndico", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    // A situação a tratar leva direto ao convite, na parte Pessoas.
    await page.getByRole("list", { name: "Situações a tratar" }).getByRole("button", { name: "Convidar síndico" }).click();
    await expect(page.getByRole("tab", { name: "Pessoas", selected: true })).toBeVisible();
    await page.getByRole("dialog", { name: "Convidar síndico" }).getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Nenhum síndico convidado ainda")).toBeVisible();
    await page.getByRole("button", { name: "Convidar síndico" }).click();
    const convite = page.getByRole("dialog", { name: "Convidar síndico" });
    await convite.getByLabel("Nome").fill("Ana Souza");
    await convite.getByLabel("E-mail").fill("ana@exemplo.invalid");
    await semErroDeAcessibilidade(page);
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Convite enviado" })).toBeVisible();
    await expect(page.getByRole("tabpanel")).toContainText("Ana Souza");
    // A conclusão da implantação agora é a entrega, na aba Implantação (peça R4).
    await expect(page.getByRole("button", { name: "Concluir implantação" })).toHaveCount(0);
  });

  test("PI-06 e PI-12: notas internas e histórico com o que é interno marcado", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    // Notas e histórico viraram uma linha do tempo só (decisão A.1).
    await page.getByRole("tab", { name: "Notas e histórico" }).click();
    await expect(page.getByText("Notas internas · o cliente nunca vê")).toBeVisible();
    await page.getByLabel("Nova nota para a equipe").fill("Boleto de outubro combinado para o dia 10.");
    await page.getByRole("button", { name: "Salvar nota" }).click();
    const linha = page.getByRole("list", { name: "Notas e mudanças do cliente" });
    await expect(linha.getByRole("listitem").filter({ hasText: "Boleto de outubro" })).toContainText("16/10, 14:05· Carolina");
    await expect(linha.getByText("Ficha alterada: endereço, número institucional.")).toBeVisible();
    await expect(linha.getByRole("listitem").filter({ hasText: "Referência do contrato alterada" })).toContainText("Mudança · interno");
    await semErroDeAcessibilidade(page);

    const mostrar = page.getByRole("group", { name: "Mostrar" });
    await mostrar.getByRole("button", { name: "Notas", exact: true }).click();
    await expect(linha.getByText("Ficha alterada: endereço, número institucional.")).toHaveCount(0);
    await expect(linha.getByText("Boleto de outubro combinado para o dia 10.")).toBeVisible();
    await mostrar.getByRole("button", { name: "Mudanças" }).click();
    await expect(linha.getByText("Boleto de outubro combinado para o dia 10.")).toHaveCount(0);
  });

  test("PI-10: implantação não muda contrato, não atribui equipe e não vê a equipe interna", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/clientes`);
    await expect(page.getByRole("heading", { level: 1, name: "Carteira de clientes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar condomínio" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pessoas e funções" })).toHaveCount(0);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await expect(page.getByRole("button", { name: "Editar a referência do contrato" })).toHaveCount(0);
    await expect(page.getByText("Só a administração muda.")).toBeVisible();
    await page.getByRole("tab", { name: "Pessoas" }).click();
    await expect(page.getByRole("button", { name: "Atribuir pessoa" })).toHaveCount(0);
  });

  test("PI-10: a administração vê a equipe e as funções", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/equipe`);
    await expect(page.getByRole("listitem").filter({ hasText: "Inês" })).toContainText("Implantação");
    await expect(page.getByRole("listitem").filter({ hasText: "Carolina" }).getByRole("button", { name: /Desativar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desativar Inês" })).toBeVisible();
    await page.getByRole("button", { name: "Rever funções de Inês" }).click();
    await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Implantação" })).toBeChecked();
    await semErroDeAcessibilidade(page);
    await page.keyboard.press("Escape");
    await page.goto(`${CONSOLE}/equipe/historico`);
    await expect(page.getByText("Inês entrou na equipe · Implantação.")).toBeVisible();
    await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Funções" }).click();
    await expect(page.getByText("Inês entrou na equipe · Implantação.")).toHaveCount(0);
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

  test("PT-08: o link padrão do Supabase (com #) cria a senha nova e some do endereço; o vencido avisa", async ({ page }) => {
    for (const base of [CONSOLE, PLATAFORMA]) {
      await instalarApiFalsa(page, { logado: false });
      await page.goto(`${base}/redefinir#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery`);
      await expect(page.getByRole("heading", { level: 1, name: "Criar senha nova" })).toBeVisible();
      await expect(page.getByLabel("Senha nova")).toBeVisible();
      await expect.poll(() => new URL(page.url()).hash).toBe("");
      await page.getByLabel("Senha nova").fill("uma frase bem comprida");
      await page.getByLabel("Repita a senha").fill("uma frase bem comprida");
      await page.getByRole("button", { name: "Salvar senha nova" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Senha nova salva" })).toBeVisible();
      await page.goto("about:blank");
      await page.goto(`${base}/redefinir#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
      await expect(page.getByText("Link vencido ou já usado")).toBeVisible();
      await semErroDeAcessibilidade(page);
      await page.unrouteAll();
    }
  });
});

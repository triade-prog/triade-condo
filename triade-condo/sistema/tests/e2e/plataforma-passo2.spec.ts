// Passo 2 (F2): telas da Plataforma do síndico com a API falsa. Cada tela passa no axe
// (WCAG 2.2 AA) no celular e no computador, só mostra o que a pessoa pode fazer (CF-03) e
// não usa emoji nem emoticon (decisão da Carolina, 16/10/2026).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa, V_ANA, V_BRUNA } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { salvarPagina } from "./configuracoes";
import { maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function menuPara(page: Page, nome: string) {
  await expect(page.getByRole("button", { name: /^Conta de / })).toBeVisible();
  const menu = page.getByRole("button", { name: "Mais", exact: true });
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
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Residencial Ipê");
    // No computador o condomínio fica no topo; no celular, no menu da conta.
    const trocar = page.getByRole("button", { name: /^Trocar condomínio, agora / });
    if (await trocar.isVisible()) await trocar.click();
    else {
      await page.getByRole("button", { name: /^Conta de / }).click();
      await page.getByRole("button", { name: "Trocar condomínio", exact: true }).click();
    }
    await page.getByRole("dialog", { name: "Trocar condomínio" }).getByRole("button", { name: /Edifício Jatobá/ }).click();
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Edifício Jatobá");
  });

  test("V-08 e CF-12: o início diz o que falta configurar e o que já veio pronto", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await expect(page.getByRole("region", { name: "Resumo do dia" })).toContainText("Residencial Ipê");
    const falta = await abrirArea(page, "O que falta configurar");
    await expect(falta).toContainText("Horário de atendimento não definido");
    await expect(falta).toContainText("Ninguém escolhido para atender os pedidos");
    await expect(falta.getByRole("group", { name: "Já veio pronto pelo cenário" })).toContainText("8 categorias · 4 prioridades");
    await conferir(page);
  });

  test("CF-06 e CF-10: horário de atendimento com dois intervalos; sobreposição avisa; a pendência sai", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await page.getByRole("link", { name: /^Horários/ }).click();
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/horarios`);
    await expect(page.getByRole("heading", { level: 1, name: "Horários" })).toBeVisible();
    await page.getByRole("button", { name: "Montar dia a dia" }).click();
    await page.getByRole("button", { name: "Atender neste dia, Segunda" }).click();
    await page.getByRole("button", { name: "Mais um intervalo, Segunda" }).click();
    await page.getByLabel("Segunda, fim").nth(1).fill("18:00");
    await page.getByLabel("Segunda, início").nth(1).fill("11:00");
    await salvarPagina(page);
    await expect(page.getByRole("alert").filter({ hasText: "se sobrepõem" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Nada foi salvo. Veja o que corrigir em Horário de atendimento." })).toBeVisible();
    await page.getByLabel("Segunda, início").nth(1).fill("13:00");
    await page.getByRole("button", { name: "Copiar segunda para terça a sexta" }).click();
    await conferir(page);
    await salvarPagina(page);
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
    await page.goto(`${PLATAFORMA}/configuracoes/categorias`);
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
    const confirmar = page.getByRole("dialog", { name: "Desativar a categoria Limpeza e conservação?" });
    await expect(confirmar).toContainText("Os pedidos que já têm Limpeza e conservação continuam com ela");
    await conferir(page);
    await confirmar.getByRole("button", { name: "Desativar Limpeza e conservação" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Limpeza e conservação" })).toContainText("Desativada");
    await page.getByRole("button", { name: "Nova prioridade" }).click();
    const nova = page.getByRole("dialog", { name: "Nova prioridade" });
    await nova.getByLabel("Nome da prioridade").fill("Crítica");
    await nova.getByLabel("O que ela significa").fill("Para o prédio inteiro.");
    await conferir(page);
    await nova.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Crítica" })).toContainText("Para o prédio inteiro.");
  });

  test("AT-05, AT-25 e CF-09: etapas em leitura (são da TRÍADE); modelo de resposta", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=etapas`);
    await expect(page).toHaveURL(`${PLATAFORMA}/configuracoes/etapas`);
    await expect(page.getByRole("listitem").filter({ hasText: "Aguardando o morador" })).toContainText("pausa o prazo");
    await expect(page.getByText("Feito pela TRÍADE")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova etapa" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pedir mudança" })).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/configuracoes/respostas`);
    await page.getByRole("button", { name: "Nova resposta" }).click();
    const modelo = page.getByRole("dialog", { name: "Nova resposta pronta" });
    await modelo.getByLabel("Título").fill("Vazamento");
    await modelo.getByLabel("Texto da resposta").fill("Vamos mandar alguém olhar ainda hoje.");
    await modelo.getByLabel("Categoria").selectOption({ label: "Manutenção" });
    await modelo.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Vazamento" })).toContainText("Manutenção");
  });

  test("AT-10: prazos com regra geral e exceções; sem horário, horas corridas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/prazos`);
    await expect(page.getByText("os prazos contam em horas corridas")).toBeVisible();
    await expect(page.getByRole("link", { name: "Definir o horário" })).toHaveAttribute("href", "/configuracoes/horarios");
    await expect(page.getByRole("row", { name: /Regra geral/ })).toContainText("24 h de atendimento");
    await expect(page.getByRole("button", { name: "Tirar a exceção de Regra geral" })).toHaveCount(0);
    await page.getByRole("button", { name: "Nova exceção" }).click();
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

  test("V-09, CF-03 e CF-05: autorizar pessoa por área, atender na ficha e revogar a padrão com substituto", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await menuPara(page, "Pessoas e acesso");
    // Uma lista só (A.1): o acesso numa frase, e a linha abre a ficha.
    await expect(page.getByRole("listitem").filter({ hasText: "Ana Souza" })).toContainText("Todas as permissões");
    await expect(page.getByRole("listitem").filter({ hasText: "Bruna" })).toContainText("Cuida das configurações · cadastra moradores");
    await expect(page.getByRole("tab", { name: "Quem atende" })).toHaveCount(0);
    await page.getByRole("button", { name: "Autorizar pessoa" }).click();
    const convite = page.getByRole("dialog", { name: "Autorizar pessoa" });
    await convite.getByLabel("Nome").fill("Caio");
    await convite.getByLabel("E-mail").fill("caio@exemplo.invalid");
    await convite.getByLabel("Cargo").fill("Subsíndico");
    await expect(convite.getByText("O cargo é só um nome: não dá permissão.")).toBeVisible();
    // No celular, o convite vai em dois passos.
    const continuar = convite.getByRole("button", { name: "Continuar" });
    if (await continuar.isVisible()) await continuar.click();
    // B.1: uma escolha por área; marcar dar retorno já marca ver os pedidos.
    await convite.getByRole("group", { name: "Agenda" }).getByRole("button", { name: "Cuida", exact: true }).click();
    await convite.getByLabel("Dar retorno ao morador").check();
    await expect(convite.getByLabel("Ver os pedidos e o andamento")).toBeChecked();
    await expect(convite.getByRole("status")).toContainText("Cuida dos pedidos (sem atualizar nem concluir) e da agenda");
    await conferir(page);
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Convite enviado" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Caio" })).toContainText("Cuida dos pedidos (sem atualizar nem concluir) e da agenda");
    expect(estado.convites).toEqual(["caio@exemplo.invalid"]);
    expect([...estado.pessoas.find((p) => p.nome === "Caio")!.permissoes].sort()).toEqual(["ACOMPANHAR", "AGENDA", "RESPONDER"]);

    // O atendimento grava na hora, na ficha. Quem passa a atender sem padrão vira o padrão.
    await page.getByRole("link", { name: "Ana Souza" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mudar o acesso" })).toHaveCount(0);
    await page.getByRole("switch", { name: "Atende os pedidos" }).check();
    await expect(page.getByRole("status").filter({ hasText: "Ana Souza passa a atender os pedidos." })).toBeVisible();
    expect(estado.responsavelPadrao).toBe(V_ANA);
    await page.getByRole("link", { name: "Voltar às pessoas" }).click();
    await page.getByRole("link", { name: "Bruna" }).click();
    await page.getByRole("switch", { name: "Atende os pedidos" }).check();
    await expect(page.getByRole("status").filter({ hasText: "Bruna passa a atender os pedidos." })).toBeVisible();
    await page.getByRole("button", { name: "Tornar padrão da fila" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Os pedidos novos agora vão para Bruna." })).toBeVisible();
    expect(estado.responsavelPadrao).toBe(V_BRUNA);
    // A padrão só sai da fila depois de trocar.
    await expect(page.getByRole("switch", { name: "Disponível" })).toBeDisabled();
    await conferir(page);

    await maisAcoes(page, "Revogar acesso");
    const revogar = page.getByRole("dialog", { name: "Revogar o acesso de Bruna" });
    await expect(revogar.getByLabel("Bruna é o padrão da fila. Quem assume?")).toHaveValue(V_ANA);
    await revogar.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page).toHaveURL(/\/pessoas\?revogada=Bruna$/);
    await expect(page.getByRole("status").filter({ hasText: "Acesso de Bruna revogado" })).toBeVisible();
    expect(estado.responsavelPadrao).toBe(V_ANA);
  });

  test("B.1: mudar o acesso por área na ficha da pessoa", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/pessoas/pessoa?id=${V_BRUNA}`);
    const acesso = page.getByRole("region", { name: "Acesso" });
    await expect(acesso.getByRole("region", { name: "Gestão" })).toContainText("Muda");
    await expect(acesso.getByRole("region", { name: "Dia a dia" })).toContainText("Não vê");
    await page.getByRole("button", { name: "Mudar o acesso" }).click();
    const janela = page.getByRole("dialog", { name: "Mudar o acesso de Bruna" });
    await janela.getByRole("group", { name: "Manutenção" }).getByRole("button", { name: "Vê", exact: true }).click();
    await janela.getByRole("group", { name: "Comunicados e documentos" }).getByRole("button", { name: "Vê", exact: true }).click();
    await janela.getByLabel("Publicar comunicados").check();
    await expect(janela.getByRole("status")).toContainText("Cuida das configurações · publica comunicados · cadastra moradores · vê a manutenção, os comunicados e os documentos");
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar o acesso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Acesso de Bruna salvo." })).toBeVisible();
    expect([...estado.pessoas.find((p) => p.vinculoId === V_BRUNA)!.permissoes].sort()).toEqual(["CADASTRAR", "CONFIGURAR", "PUBLICAR", "VER_COMUNICADOS", "VER_MANUTENCAO"]);
    await expect(acesso.getByRole("region", { name: "Comunicação" })).toContainText("Publica comunicados; não cuida dos documentos");
  });

  test("CF-03: quem só vê não encontra botão de mudar nem pessoas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/configuracoes/categorias`);
    await expect(page.getByText("o síndico precisa dar a você a permissão Configurar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova categoria" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Renomear / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Conta de / })).toBeVisible();
    const menu = page.getByRole("button", { name: "Mais", exact: true });
    if (await menu.isVisible()) await menu.click();
    await expect(page.getByRole("link", { name: "Configurações", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pessoas e acesso" })).toHaveCount(0);
    await conferir(page);
  });
});

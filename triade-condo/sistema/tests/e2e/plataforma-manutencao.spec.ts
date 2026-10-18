// Manutenção e prestadores (peça R6; MP-01 a MP-05, MP-07, MP-09, MP-13) com a API falsa. Cada
// tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma do síndico · manutenção", () => {
  test("MP-01: a lista do que está aberto, com o retorno vencido e os atalhos; o início mostra o cartão", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    const cartao = page.getByRole("region", { name: /^Manutenção/ });
    await expect(cartao).toContainText("1 retorno vencido");
    await expect(cartao).toContainText("1 preventiva atrasada");
    await expect(cartao).toContainText("1 contrato vence em 60 dias");

    await page.goto(`${PLATAFORMA}/manutencao`);
    await expect(page.getByRole("heading", { level: 1, name: "Manutenção" })).toBeVisible();
    await expect(page.getByText("Bomba de recalque com ruído")).toBeVisible();
    await expect(page.getByText("Infiltração na garagem, vaga 14")).toBeVisible();
    await expect(page.getByText(/venceu/).first()).toBeVisible();
    await expect(page.getByText("Pedido 2026-0001")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: /Retorno vencido · 1/ }).click();
    await expect(page).toHaveURL(/atencao=RETORNO_VENCIDO/);
    await expect(page.getByText("Bomba de recalque com ruído")).toHaveCount(0);
    await expect(page.getByText("Infiltração na garagem, vaga 14")).toBeVisible();
  });

  test("MP-01, MP-04: registrar uma corretiva ligada ao pedido; o pedido mostra a manutenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("button", { name: "+ Nova manutenção" }).click();
    const j = page.getByRole("dialog", { name: "Nova manutenção" });
    await j.getByRole("button", { name: "Registrar manutenção" }).click();
    await expect(j.getByText("Diga o que precisa ser feito, de 3 a 120 caracteres.")).toBeVisible();
    await j.getByLabel("O que precisa ser feito").fill("Portão da garagem emperrado");
    await j.getByLabel("Local ou equipamento").fill("Portão da garagem");
    await j.getByLabel("Prioridade").selectOption({ label: "Alta: Afeta várias unidades ou uma área comum importante: vem antes das normais." });
    await j.getByLabel("Pedido ligado").selectOption({ label: "2026-0001 · Vazamento no banheiro" });
    await conferir(page);
    await j.getByRole("button", { name: "Registrar manutenção" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Portão da garagem emperrado" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ligações" })).toContainText("Pedido 2026-0001");
    await conferir(page);

    await page.getByRole("region", { name: "Ligações" }).getByRole("link", { name: /Pedido 2026-0001/ }).click();
    const ligada = page.getByRole("region", { name: "Manutenção ligada" });
    await expect(ligada).toContainText("Portão da garagem emperrado");
    await expect(ligada).toContainText("Bomba de recalque com ruído");
  });

  test("MP-02, MP-04: pendência pede o motivo; concluir não encerra o pedido e reabrir guarda o motivo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bomba de recalque com ruído" })).toBeVisible();
    await expect(page.getByText("Reserva indicada: Bombas Litoral.")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Pendência" }).click();
    const p = page.getByRole("dialog", { name: "Marcar como pendente" });
    await p.getByRole("button", { name: "Marcar pendente" }).click();
    await expect(p.getByText("Explique a pendência (de 3 a 300 caracteres).")).toBeVisible();
    await p.getByLabel("O que impede").selectOption("PECA");
    await p.getByLabel("Explique").fill("Rolamento encomendado");
    await p.getByRole("button", { name: "Marcar pendente" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pendente · Aguardando peça" })).toBeVisible();
    await page.getByRole("button", { name: "Resolver pendência" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pendência resolvida." })).toBeVisible();

    await page.getByRole("button", { name: "Concluir" }).click();
    const c = page.getByRole("dialog", { name: "Concluir manutenção" });
    await expect(c).toContainText("O pedido 2026-0001 continua aberto");
    await c.getByLabel("O que foi feito").fill("Rolamento trocado e as duas bombas testadas em revezamento.");
    await c.getByLabel("Fechar junto a providência aberta").check();
    await conferir(page);
    await c.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manutenção concluída." })).toBeVisible();
    await expect(page.getByText("O pedido 2026-0001 continua aberto: dê o retorno ao morador e conclua por lá.")).toBeVisible();

    await page.getByRole("button", { name: "Reabrir" }).click();
    const r = page.getByRole("dialog", { name: "Reabrir manutenção" });
    await r.getByLabel("Por que reabrir").fill("Voltou a fazer barulho");
    await r.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manutenção reaberta." })).toBeVisible();
    await expect(page.getByText("Reaberta", { exact: true })).toBeVisible();
  });

  test("MP-07: a vistoria responde cada item, e o item com problema vira manutenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Vistoria da fachada antes da chuva" }).click();
    const lista = page.getByRole("region", { name: "O que olhar" });
    await expect(lista).toContainText("Calhas e rufos sem entupimento");
    await lista.getByRole("button", { name: "Responder Trincas na fachada leste" }).click();
    const j = page.getByRole("dialog", { name: "Trincas na fachada leste" });
    await j.getByLabel("Como está").selectOption("PROBLEMA");
    await j.getByLabel("Observação").fill("Trinca de 40 cm acima do 7º andar");
    await j.getByRole("button", { name: "Salvar resposta" }).click();
    await expect(lista.getByText("Problema", { exact: true })).toBeVisible();
    await conferir(page);
    await lista.getByRole("button", { name: "Virar manutenção" }).click();
    await expect(page.getByRole("status").filter({ hasText: "virou uma manutenção corretiva" })).toBeVisible();
    await lista.getByRole("link", { name: /Virou manutenção/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Trincas na fachada leste" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ligações" })).toContainText("Veio da vistoria");
  });

  test("MP-03, MP-13: preventivas com a atrasada em vermelho e as sugestões que só entram se escolhidas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao/preventivas`);
    await expect(page.getByRole("heading", { level: 1, name: "Preventivas" })).toBeVisible();
    await expect(page.getByText("a cada 6 meses", { exact: true })).toBeVisible();
    await expect(page.getByText("Atrasada")).toBeVisible();
    const sug = page.getByRole("region", { name: "Sugestões para começar" });
    await expect(sug).not.toContainText("Limpeza dos reservatórios de água");
    await conferir(page);
    await sug.getByRole("button", { name: "Usar a sugestão Inspeção do sistema de para-raios" }).click();
    const j = page.getByRole("dialog", { name: "Nova preventiva" });
    await expect(j.getByLabel("Atividade")).toHaveValue("Inspeção do sistema de para-raios");
    await j.getByLabel("Próxima data").fill("2027-03-01");
    await j.getByRole("button", { name: "Salvar preventiva" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Preventiva salva." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspeção do sistema de para-raios" })).toBeVisible();
  });

  test("MP-05, MP-09: prestadores com contrato primeiro; cadastrar, ver a ficha e arquivar sem apagar", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao/prestadores`);
    await expect(page.getByRole("region", { name: "Com contrato" })).toContainText("Aqualimp");
    await expect(page.getByText("Contrato perto do fim")).toBeVisible();
    await expect(page.getByRole("region", { name: "Por chamado" })).toContainText("reserva: Bombas Litoral");
    await conferir(page);

    await page.getByRole("button", { name: "+ Novo prestador" }).click();
    const j = page.getByRole("dialog", { name: "Novo prestador" });
    await j.getByLabel("Nome ou empresa").fill("hidropress bombas");
    await j.getByLabel("Serviço").fill("Elétrica");
    await j.getByRole("button", { name: "Cadastrar prestador" }).click();
    await expect(j.getByText("De 2 a 120 caracteres, sem repetir outro ativo.")).toBeVisible();
    await j.getByLabel("Nome ou empresa").fill("Elétrica Sol");
    await j.getByLabel("Serviço").fill("Elétrica");
    await j.getByRole("button", { name: "Cadastrar prestador" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Prestador cadastrado." })).toBeVisible();

    await page.getByRole("link", { name: "HidroPress Bombas" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "HidroPress Bombas" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Manutenções" })).toContainText("Bomba de recalque com ruído");
    await conferir(page);
    await page.getByRole("button", { name: "Arquivar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Prestador arquivado." })).toBeVisible();
    await expect(page.getByText("Arquivado", { exact: true })).toBeVisible();
  });

  test("MP-02: as etapas da manutenção ficam nas configurações, dentro das situações fixas", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=manutencao`);
    const aba = page.getByRole("region", { name: "Etapas da manutenção" });
    await expect(aba).toContainText("Aguardando visita");
    await conferir(page);
    await aba.getByRole("button", { name: "+ Etapa" }).click();
    const j = page.getByRole("dialog", { name: "Nova etapa da manutenção" });
    await j.getByLabel("Nome da etapa").fill("Aguardando orçamento");
    await j.getByLabel("Situação").selectOption("PENDENTE");
    await j.getByRole("button", { name: "Salvar etapa" }).click();
    await expect(aba).toContainText("Aguardando orçamento");
  });
});

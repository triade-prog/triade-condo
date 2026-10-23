// Manutenção e prestadores (peça R6; MP-01 a MP-05, MP-07, MP-09, MP-13) com a API falsa. Cada
// tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";

const celular = () => test.info().project.name === "celular";

/** No celular a Nova manutenção vai em três passos; no computador é uma tela só. */
async function seguir(page: Page) {
  if (celular()) await page.getByRole("dialog", { name: "Nova manutenção" }).getByRole("button", { name: "Continuar" }).click();
}

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
    const cartao = await abrirArea(page, "Manutenção");
    await expect(cartao).toContainText("1 retorno vencido");
    await expect(cartao).toContainText("1 preventiva atrasada");
    await expect(await abrirArea(page, "Vencimentos")).toContainText(/Contrato da Aqualimp vence em \d+ dias/);

    await page.goto(`${PLATAFORMA}/manutencao`);
    await expect(page.getByRole("heading", { level: 1, name: "Manutenção" })).toBeVisible();
    await expect(page.getByText("Bomba de recalque com ruído")).toBeVisible();
    await expect(page.getByText("Infiltração na garagem, vaga 14")).toBeVisible();
    await expect(page.getByText(/Retorno venceu/).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await expect(page.getByRole("dialog", { name: "Filtrar manutenções" }).getByLabel("Prestador")).toBeVisible();
    await conferir(page);
    await page.getByRole("dialog", { name: "Filtrar manutenções" }).press("Escape");
    await expect(page.getByText("Pedido 2026-0001")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Retorno vencido 1" }).click();
    await expect(page).toHaveURL(/atencao=RETORNO_VENCIDO/);
    await expect(page.getByText("Bomba de recalque com ruído")).toHaveCount(0);
    await expect(page.getByText("Infiltração na garagem, vaga 14")).toBeVisible();
  });

  test("MP-01, MP-04: registrar uma corretiva ligada ao pedido; o pedido mostra a manutenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("button", { name: "Nova manutenção" }).click();
    const j = page.getByRole("dialog", { name: "Nova manutenção" });
    await j.getByRole("button", { name: celular() ? "Continuar" : "Registrar manutenção" }).click();
    await expect(j.getByText("Diga o que precisa ser feito, de 3 a 120 caracteres.")).toBeVisible();
    if (celular()) await expect(j.getByRole("progressbar", { name: "Passos da manutenção" })).toHaveAttribute("aria-valuenow", "1");
    await j.getByLabel("O que precisa ser feito").fill("Portão da garagem emperrado");
    await j.getByLabel("Local ou equipamento").fill("Portão da garagem");
    await j.getByLabel("Prioridade").selectOption({ label: "Alta: Afeta várias unidades ou uma área comum importante: vem antes das normais." });
    await conferir(page);
    await seguir(page);
    await j.getByLabel("Pedido ligado").selectOption({ label: "2026-0001 · Vazamento no banheiro" });
    if (celular()) {
      // O passo feito fica resumido, e Voltar não perde o que já foi preenchido.
      await expect(j.getByRole("button", { name: /O que e onde.*Portão da garagem emperrado/ })).toBeVisible();
      await conferir(page);
      await j.getByRole("button", { name: "Voltar" }).click();
      await expect(j.getByLabel("O que precisa ser feito")).toHaveValue("Portão da garagem emperrado");
      await seguir(page);
      await expect(j.getByLabel("Pedido ligado")).toHaveValue(/.+/);
    }
    await seguir(page);
    await expect(j.getByRole("textbox", { name: /^Detalhes/ })).toBeVisible();
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
    const quem = page.getByRole("region", { name: "Quem executa" });
    await expect(quem).toContainText("HidroPress Bombas");
    await expect(quem.getByText(/Reserva no cadastro: Bombas Litoral\./)).toBeVisible();
    await expect(quem.getByRole("link", { name: /Ligar/ })).toHaveAttribute("href", "tel:+5513998124455");
    await expect(quem.getByRole("region", { name: "Link do prestador" })).toBeVisible();
    await conferir(page);

    await maisAcoes(page, "Marcar pendência");
    const p = page.getByRole("dialog", { name: "Marcar como pendente" });
    await p.getByRole("button", { name: "Marcar pendente" }).click();
    await expect(p.getByText("Explique a pendência (de 3 a 300 caracteres).")).toBeVisible();
    await p.getByLabel("O que impede").selectOption("PECA");
    await p.getByLabel("Explique").fill("Rolamento encomendado");
    await p.getByRole("button", { name: "Marcar pendente" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pendente · Aguardando peça" })).toBeVisible();
    await page.getByRole("button", { name: "Resolver pendência" }).filter({ visible: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pendência resolvida." })).toBeVisible();

    await page.getByRole("button", { name: "Concluir" }).filter({ visible: true }).click();
    const c = page.getByRole("dialog", { name: "Concluir manutenção" });
    await expect(c).toContainText("O pedido 2026-0001 continua aberto");
    await expect(c.getByText("Anexar a foto do depois")).toBeVisible();
    await c.getByLabel("O que foi feito").fill("Rolamento trocado e as duas bombas testadas em revezamento.");
    await c.getByLabel("Fechar junto a providência aberta").check();
    await conferir(page);
    await c.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manutenção concluída." })).toBeVisible();
    await expect(page.getByText("O pedido 2026-0001 continua aberto: dê o retorno ao morador e conclua por lá.")).toBeVisible();

    await expect(page.getByRole("button", { name: "Mais ações" })).toHaveCount(0);
    await page.getByRole("button", { name: "Reabrir" }).filter({ visible: true }).click();
    const r = page.getByRole("dialog", { name: "Reabrir manutenção" });
    await r.getByLabel("Por que reabrir").fill("Voltou a fazer barulho");
    await r.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manutenção reaberta." })).toBeVisible();
    await expect(page.getByText("Reaberta", { exact: true })).toBeVisible();
  });

  test("MP-02: repassar a manutenção muda o responsável sem sair da ficha", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    const dados = page.getByRole("region", { name: "Dados da manutenção" });
    await dados.getByRole("button", { name: "Repassar" }).click();
    const j = page.getByRole("dialog", { name: "Repassar a manutenção" });
    await j.getByLabel("Responsável").selectOption({ label: "Ana Souza" });
    await conferir(page);
    await j.getByRole("button", { name: "Repassar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Manutenção repassada." })).toBeVisible();
    await expect(dados).toContainText("Ana Souza");
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
    await expect(page.getByText(/a cada 6 meses/).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Atrasada")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir a manutenção de Recarga dos extintores" })).toHaveAttribute("href", /\/manutencao\/manutencao\?id=/);
    // Já existindo preventiva, as sugestões ficam recolhidas.
    await expect(page.getByRole("region", { name: "Sugestões para começar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Ver sugestões" }).click();
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
    await expect(page.getByText("Contrato perto do fim").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Por chamado" })).toContainText("reserva: Bombas Litoral");
    await conferir(page);
    // Os atalhos e a busca filtram a lista na hora.
    await page.getByRole("button", { name: "Com pendência 1" }).click();
    await expect(page.getByRole("link", { name: "Impermeabiliza Sul" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aqualimp" })).toHaveCount(0);
    await page.getByRole("button", { name: "Com pendência 1" }).click();
    await page.getByRole("searchbox", { name: "Buscar prestadores" }).fill("limpeza");
    await expect(page.getByRole("link", { name: "Aqualimp" })).toBeVisible();
    await expect(page.getByRole("link", { name: "HidroPress Bombas" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Buscar prestadores" }).fill("");

    await page.getByRole("button", { name: "Novo prestador" }).filter({ visible: true }).click();
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
    await expect(page.getByRole("region", { name: "Contato" }).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me\/5513998124455/);
    await conferir(page);
    await maisAcoes(page, "Arquivar");
    await expect(page.getByRole("status").filter({ hasText: "Prestador arquivado." })).toBeVisible();
    await expect(page.getByText("Arquivado", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Ver todas na lista de manutenções" }).click();
    await expect(page).toHaveURL(/\/manutencao\?prestador=.+&situacao=TODAS/);
    await expect(page.getByText("Bomba de recalque com ruído")).toBeVisible();
  });

  test("MP-02 e CF-09: as etapas da manutenção aparecem nas configurações; quem muda é a TRÍADE", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/manutencao`);
    const aba = page.getByRole("region", { name: "Etapas da manutenção" });
    await expect(aba).toContainText("Aguardando visita");
    await expect(aba).toContainText("Feito pela TRÍADE");
    await expect(aba.getByRole("button", { name: "Nova etapa" })).toHaveCount(0);
    await expect(aba.getByRole("button", { name: /Editar a etapa/ })).toHaveCount(0);
    await conferir(page);
    await aba.getByRole("link", { name: "Pedir mudança" }).click();
    await expect(page.getByLabel("Título")).toHaveValue("Mudar: Etapas da manutenção");
    await expect(page.getByLabel("O que aconteceu")).toHaveValue(/Hoje: 1 etapa ativa\./);
  });
});

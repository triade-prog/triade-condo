// Área F do Console (D4.28) com a API falsa: no Agora, a pendência vencida mais antiga diz com quem
// está, o que é, de qual cliente e quando venceu; na etapa 4 a linha da implantação conta as partes
// da configuração já conferidas; e o histórico da equipe diz o nome de quem entrou. Cada tela passa
// no axe (WCAG 2.2 AA) no celular e no computador.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
}

const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
/** "22/10" a partir de "2026-10-22". */
const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

test.describe("Console · área F (D4.28)", () => {
  test("A vencida com o cliente e as partes conferidas na etapa 4, no Início e na carteira", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(CONSOLE);
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora).toContainText(`Com o cliente: Síndica enviar a planilha de moradores · Residencial Ipê · venceu em ${diaMes(dia(-1))}`);
    await expect(agora).not.toContainText("e mais");
    await expect(page.getByRole("region", { name: "Implantações em andamento" })).toContainText("Próxima: 4 · Configuração · 10 de 11 partes conferidas");
    await conferir(page);

    await page.goto(`${CONSOLE}/clientes?filtro=implantacao`);
    await expect(page.getByRole("listitem").filter({ hasText: "Residencial Ipê" })).toContainText("Próxima: Configuração · 10 de 11 partes conferidas");
    await conferir(page);
  });

  test("A vencida com a equipe, com e sem responsável, e as outras do cliente em \"e mais N\"", async ({ page }) => {
    const est = await instalarApiFalsa(page);
    est.suporte.pendencias.push(
      { id: "9a0b1c2d-3e4f-4a5b-8c6d-00000000f001", etapa: 4, texto: "Revisar as categorias com a síndica", comQuem: "EQUIPE", responsavelId: "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b",
        responsavel: "Diego", proximoRetorno: dia(-3), vencida: true, versao: 1 },
      { id: "9a0b1c2d-3e4f-4a5b-8c6d-00000000f002", etapa: 5, texto: "Marcar a apresentação", comQuem: "EQUIPE", responsavelId: "", responsavel: "",
        proximoRetorno: dia(-2), vencida: true, versao: 1 },
    );
    await page.goto(CONSOLE);
    const agora = page.getByRole("region", { name: "Agora" });
    await expect(agora).toContainText("3 pendências de implantação vencidas");
    await expect(agora).toContainText(`Com a equipe · Diego: Revisar as categorias com a síndica · Residencial Ipê · venceu em ${diaMes(dia(-3))} · e mais 2`);
    await conferir(page);

    // Resolvida a de Diego, a mais antiga passa a ser a que está com a equipe sem responsável.
    est.suporte.pendencias[1]!.resolvidaEm = new Date().toISOString();
    await page.reload();
    await expect(agora).toContainText(`Com a equipe: Marcar a apresentação · Residencial Ipê · venceu em ${diaMes(dia(-2))} · e mais 1`);
  });

  test("O histórico da equipe diz o nome de quem entrou", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/equipe/historico`);
    await expect(page.getByText("Inês entrou na equipe · Implantação.")).toBeVisible();
    await conferir(page);
  });
});

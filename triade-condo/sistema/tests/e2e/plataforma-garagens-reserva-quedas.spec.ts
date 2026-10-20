// Garagens, prestador reserva e queda do WhatsApp (F3.8, F5.9, F5.10; MU-06, MU-11, MP-09, W-17)
// com a API falsa: a busca por placa e o menu da lista de unidades, a parte Garagens e veículos da
// ficha e a aba Garagens; o prazo para o prestador confirmar, a recusa pelo link e a troca para a
// reserva; e a queda do número, com o canal alternativo na etiqueta e a conferência do que ficou
// parado. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { A101 } from "./api-falsa-moradores";
import { ETIQUETA_FALSA, PRESTADOR_FALSO, RESERVA_FALSO } from "./api-falsa-links";
import { derrubarNumero, numeroVoltou } from "./api-falsa-whatsapp";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma · garagens, prestador reserva e queda do WhatsApp", () => {
  test("MU-06, MU-11: o veículo entra na ficha da unidade e a busca acha a unidade pela placa, com ou sem hífen", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores/unidade?id=${A101}`);
    const garagens = page.getByRole("region", { name: "Garagens e veículos" });
    await expect(garagens.getByRole("cell", { name: "G-23", exact: true })).toBeVisible();
    await expect(garagens.getByText("Subsolo 1 · coberta").first()).toBeVisible();
    await garagens.getByRole("button", { name: "+ Veículo" }).click();
    const j = page.getByRole("dialog", { name: "Incluir veículo · Torre A · 101" });
    await j.getByLabel("Placa").fill("QMF 2A4");
    await j.getByRole("button", { name: "Incluir veículo" }).click();
    await expect(j.getByText("Placa Mercosul (ABC1D23) ou antiga (ABC-1234), sem repetir a de outra unidade.")).toBeVisible();
    await j.getByLabel("Placa").fill("qmf-2a41");
    await j.getByLabel("Modelo e cor").fill("Onix prata");
    await j.getByLabel("De quem").selectOption({ label: "Marina Souza" });
    await j.getByLabel("Vaga").selectOption({ label: "G-23 · Subsolo 1" });
    await conferir(page);
    await j.getByRole("button", { name: "Incluir veículo" }).click();
    await expect(page.getByText("Veículo incluído.")).toBeVisible();
    await expect(garagens.getByRole("cell", { name: "QMF2A41", exact: true })).toBeVisible();
    await expect(garagens.getByRole("cell", { name: "QMF2A41 · Onix prata" })).toBeVisible();
    await expect(garagens.getByRole("button", { name: "Tirar de uso a vaga G-23" })).toHaveCount(0);
    expect(estado.moradores.veiculos[0]!.placa).toBe("QMF2A41");
    await conferir(page);

    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByLabel("Buscar unidade").fill("qmf-2a");
    await expect(page.getByText("1 unidade encontrada")).toBeVisible();
    await expect(page.getByText("placa QMF2A41 · Onix prata · vaga G-23")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Atalhos de Torre A · 101" }).click();
    await expect(page.getByRole("link", { name: "Registrar mudança" })).toBeVisible();
    await page.getByRole("link", { name: "Garagens e veículos" }).click();
    await expect(page).toHaveURL(/#garagens$/);
    await expect(page.getByRole("region", { name: "Garagens e veículos" }).getByRole("cell", { name: "QMF2A41", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Retirar o veículo QMF2A41" }).click();
    await page.getByRole("dialog", { name: "Retirar o veículo QMF2A41" }).getByRole("button", { name: "Retirar veículo" }).click();
    await expect(page.getByText("Veículo QMF2A41 retirado.")).toBeVisible();
    await expect(page.getByText("Nenhuma vaga nem veículo nesta unidade.")).toHaveCount(0);
  });

  test("MU-06: a aba Garagens mostra todas as vagas e inclui a vaga do condomínio", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/moradores`);
    await page.getByRole("tab", { name: "Garagens" }).click();
    const resumo = page.getByRole("list", { name: "Resumo das garagens" });
    await expect(resumo.getByText("3vagas")).toBeVisible();
    await expect(resumo.getByText("1do condomínio")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Do condomínio" })).toBeVisible();
    await conferir(page);
    await page.getByRole("tabpanel").getByRole("button", { name: "+ Vaga" }).first().click();
    const j = page.getByRole("dialog", { name: "Incluir vaga" });
    await j.getByLabel("Identificação").fill("g-23");
    await j.getByRole("button", { name: "Incluir vaga" }).click();
    await expect(j.getByText("Escreva a identificação (até 20 caracteres), sem repetir a de outra vaga em uso.")).toBeVisible();
    await j.getByLabel("Identificação").fill("V-02");
    await j.getByLabel("Onde fica").fill("Térreo");
    await conferir(page);
    await j.getByRole("button", { name: "Incluir vaga" }).click();
    await expect(page.getByText("Vaga V-02 incluída.")).toBeVisible();
    await expect(resumo.getByText("4vagas")).toBeVisible();
  });

  test("MP-09: com prazo para confirmar, o prestador que não pode atender passa o serviço para a reserva", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    const cartao = page.getByRole("region", { name: "Link do prestador" });
    await cartao.getByRole("button", { name: "Mandar link" }).click();
    const j = page.getByRole("dialog", { name: "Mandar link ao prestador" });
    await expect(j.getByRole("group", { name: "Se não responder, passar para a reserva" })).toBeVisible();
    await expect(j.getByText("o serviço passa para Bombas Litoral, a reserva do cadastro", { exact: false })).toBeVisible();
    await expect(j.getByLabel("Prazo para confirmar")).toHaveValue("24");
    await j.getByLabel("Prazo para confirmar").selectOption("8");
    await j.getByLabel("O que fazer").fill("Bomba 2 com ruído forte. Diagnosticar e trocar o rolamento.");
    await conferir(page);
    await j.getByRole("button", { name: "Gerar link" }).click();
    await page.getByRole("dialog", { name: "Link pronto" }).getByRole("button", { name: "Fechar" }).click();
    await expect(cartao.getByText("Esperando resposta")).toBeVisible();
    await expect(cartao.getByText("Se não responder, passa para Bombas Litoral.")).toBeVisible();
    await expect(cartao.getByRole("button", { name: "Não trocar sozinho" })).toBeVisible();
    expect(estado.links.links.at(-1)!.responderHoras).toBe(8);
    await conferir(page);

    await page.goto(`${PLATAFORMA}/p/${PRESTADOR_FALSO}`);
    await expect(page.getByText("Confirme até", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmo que vou fazer" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Não posso atender" }).click();
    await page.getByLabel(/Por quê/).fill("Sem técnico livre nesta semana.");
    await conferir(page);
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText("Este link não vale mais")).toBeVisible();
    await expect(page.getByText("O condomínio passou o serviço para outro prestador.", { exact: false })).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    await expect(cartao.getByText("Passou de HidroPress Bombas para Bombas Litoral, a reserva.", { exact: false })).toBeVisible();
    await expect(page.getByText("Passou para a reserva: o prestador não pode atender; link mandado pelo WhatsApp")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/p/${RESERVA_FALSO}`);
    await expect(page.getByText("Serviço para Bombas Litoral")).toBeVisible();
    await page.getByRole("button", { name: "Confirmo que vou fazer" }).click();
    await expect(page.getByText("Obrigado. O condomínio sabe que você vai fazer o serviço.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Não posso atender" })).toHaveCount(0);
  });

  test("MP-09: Não trocar sozinho deixa o serviço com o principal", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/manutencao`);
    await page.getByRole("link", { name: "Bomba de recalque com ruído" }).click();
    const cartao = page.getByRole("region", { name: "Link do prestador" });
    await cartao.getByRole("button", { name: "Mandar link" }).click();
    const j = page.getByRole("dialog", { name: "Mandar link ao prestador" });
    await j.getByLabel("O que fazer").fill("Bomba 2 com ruído forte. Diagnosticar e trocar o rolamento.");
    await j.getByRole("button", { name: "Gerar link" }).click();
    await page.getByRole("dialog", { name: "Link pronto" }).getByRole("button", { name: "Fechar" }).click();
    await cartao.getByRole("button", { name: "Não trocar sozinho" }).click();
    const d = page.getByRole("dialog", { name: "Não trocar sozinho" });
    await expect(d.getByText("e não passa para Bombas Litoral", { exact: false })).toBeVisible();
    await conferir(page);
    await d.getByRole("button", { name: "Não trocar sozinho" }).click();
    await expect(cartao.getByText("Troca automática desligada em", { exact: false })).toBeVisible();
    await expect(cartao.getByRole("button", { name: "Não trocar sozinho" })).toHaveCount(0);
    await expect(page.getByText("Troca automática para a reserva desligada")).toBeVisible();
  });

  test("W-17: na queda, quem cuida escreve o canal alternativo, que aparece na etiqueta, e confere o que ficou parado", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    derrubarNumero(estado.whatsapp, estado.pedidos[0]!, "Ana Souza");
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await expect(page.getByText("WhatsApp fora do ar desde", { exact: false })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Quedas (1)" })).toHaveAttribute("aria-selected", "true");
    const queda = page.getByRole("region", { name: /Queda de/ });
    await expect(queda.getByText("Fora do ar", { exact: true })).toBeVisible();
    await expect(queda.getByText("2 na fila")).toBeVisible();
    await conferir(page);
    await queda.getByLabel(/Canal alternativo/).fill("Ligue para a portaria, (61) 3333-0000, das 7h às 22h.");
    await queda.getByLabel(/O que aconteceu/).fill("O celular do condomínio ficou sem bateria.");
    await queda.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Queda salva. As etiquetas e o mural já mostram o canal alternativo.")).toBeVisible();
    await expect(page.getByText("Enquanto isso, as etiquetas e o mural mostram", { exact: false })).toBeVisible();
    const comunicado = queda.getByRole("link", { name: "Avisar os moradores por comunicado" });
    expect(await comunicado.getAttribute("href")).toMatch(/^\/comunicados\/escrever\?titulo=WhatsApp/);
    await conferir(page);

    await page.goto(`${PLATAFORMA}/l/${ETIQUETA_FALSA}`);
    await expect(page.getByText("O WhatsApp do condomínio está fora do ar")).toBeVisible();
    await expect(page.getByText("Enquanto isso: Ligue para a portaria, (61) 3333-0000, das 7h às 22h.")).toBeVisible();
    await conferir(page);

    numeroVoltou(estado.whatsapp);
    await page.goto(`${PLATAFORMA}/whatsapp`);
    await expect(page.getByText("Confira o que ficou parado antes de encerrar a queda.", { exact: false })).toBeVisible();
    await expect(queda.getByText("Conferindo", { exact: true })).toBeVisible();
    await expect(queda.getByRole("button", { name: "Encerrar a queda · faltam 2" })).toBeDisabled();
    await expect(queda.getByText("Pedidos registrados por outro canal durante a queda: 2.", { exact: false })).toBeVisible();
    await conferir(page);
    const retorno = queda.getByRole("listitem").filter({ hasText: "O técnico vem amanhã" });
    await retorno.getByRole("button", { name: "Resolvido por outro canal" }).click();
    const d = page.getByRole("dialog", { name: "Resolvido por outro canal · 1 mensagem" });
    await d.getByRole("button", { name: "Resolvido por outro canal" }).click();
    await expect(d.getByText("De 3 a 300 caracteres.")).toBeVisible();
    await d.getByLabel("Por onde foi resolvido").fill("Liguei para a Marta e combinei a visita.");
    await conferir(page);
    await d.getByRole("button", { name: "Resolvido por outro canal" }).click();
    await expect(page.getByText("Resolvido por outro canal: 1 mensagem.")).toBeVisible();
    const conclusao = queda.getByRole("listitem").filter({ hasText: "Seu pedido foi concluído." });
    await conclusao.getByRole("button", { name: "Mandar agora" }).click();
    await page.getByRole("dialog", { name: "Mandar agora · 1 mensagem" }).getByRole("button", { name: "Mandar agora" }).click();
    await expect(page.getByText("Mandar agora: 1 mensagem.")).toBeVisible();
    await queda.getByLabel("O que foi feito (para encerrar)").fill("Respondi por telefone quem ligou. Carregador novo fica na portaria.");
    await queda.getByRole("button", { name: "Encerrar a queda" }).click();
    await expect(page.getByText("Queda encerrada. O canal alternativo saiu das etiquetas e do mural.")).toBeVisible();
    await expect(page.getByText("Nenhuma queda aberta")).toBeVisible();
    await page.getByRole("button", { name: /^Ver a queda de/ }).click();
    const ver = page.getByRole("dialog", { name: "Queda do WhatsApp" });
    await expect(ver.getByText("Liguei para a Marta e combinei a visita. · decidido por Ana Souza")).toBeVisible();
    await expect(ver.getByText("Queda do WhatsApp: o número desconectou")).toBeVisible();
    await conferir(page);
  });

  test("W-17: quem cuida das quedas se escolhe em Configurações › WhatsApp", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    await page.goto(`${PLATAFORMA}/configuracoes?aba=whatsapp`);
    await expect(page.getByRole("heading", { name: "Quando o WhatsApp cair" })).toBeVisible();
    await page.getByLabel("Quem cuida das quedas").selectOption({ label: "Bruna Lima" });
    await conferir(page);
    await page.getByRole("button", { name: "Salvar quem cuida" }).click();
    await expect(page.getByText("Bruna Lima cuida das quedas do WhatsApp.")).toBeVisible();
    expect(estado.whatsapp.quedasPessoa).toBe("1c8d4a1f-6e2b-4d3c-8f9a-2b3c4d5e6f7a");
  });
});

import { describe, expect, it } from "vitest";
import { avisarRegistroSchema, descreverEventoPedido, linkNoRegistroSchema, SITUACOES_LINK_REGISTRO } from "./pedidos.ts";
import { descreverEventoManutencao } from "./manutencao.ts";

const V = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const LINK = { quando: "Hoje, assim que possível", comoEntrar: "Portaria da Torre B", valeAte: "2027-03-10", responderHoras: 4, reserva: true };

describe("link do serviço no registro (F6.7)", () => {
  it("V-11: o link pede quando e como entrar, a validade, o prazo e se passa para a reserva", () => {
    expect(linkNoRegistroSchema.safeParse(LINK).success).toBe(true);
    expect(linkNoRegistroSchema.safeParse({ ...LINK, quando: "" }).success).toBe(false);
    expect(linkNoRegistroSchema.safeParse({ ...LINK, comoEntrar: "x" }).success).toBe(false);
    expect(linkNoRegistroSchema.safeParse({ ...LINK, valeAte: "10/03/2027" }).success).toBe(false);
  });

  it("MP-09: o prazo para responder é de 4, 8, 24 ou 48 horas", () => {
    for (const h of [4, 8, 24, 48]) expect(linkNoRegistroSchema.safeParse({ ...LINK, responderHoras: h }).success).toBe(true);
    expect(linkNoRegistroSchema.safeParse({ ...LINK, responderHoras: 12 }).success).toBe(false);
  });

  it("V-11: o link vai junto com o prestador, e sem ele o aviso segue só com o texto", () => {
    expect(avisarRegistroSchema.parse({ prestador: { id: V, texto: "Elevador parado.", link: LINK } }).prestador?.link).toEqual(LINK);
    expect(avisarRegistroSchema.parse({ prestador: { id: V, texto: "Elevador parado." } }).prestador?.link).toBeUndefined();
  });

  it("MP-09: o cartão do pedido diz em que pé está o link", () => {
    expect(SITUACOES_LINK_REGISTRO.ESPERANDO_ENVIO).toBe("Esperando a mensagem sair");
    expect(SITUACOES_LINK_REGISTRO.PASSOU_RESERVA).toBe("Passou para a reserva");
  });

  it("AT-17: o histórico do pedido diz que foi o link, por onde e o prazo", () => {
    expect(descreverEventoPedido("pedido.avisado", { destino: "PRESTADOR", quem: "Elevadores Sobe", meios: ["WHATSAPP"], link: true, horas: 4 }))
      .toBe("Link do serviço mandado ao prestador Elevadores Sobe pelo WhatsApp do condomínio · responder em 4 h");
    expect(descreverEventoPedido("pedido.avisado", { destino: "PRESTADOR", quem: "Hidráulica", meios: ["EMAIL"] }))
      .toBe("Aviso ao prestador Hidráulica por e-mail");
  });

  it("AT-17: e o da manutenção, o link do registro e o prazo vencido sem reserva", () => {
    expect(descreverEventoManutencao("manutencao.link_no_registro", { canal: "EMAIL", horas: 24 }))
      .toBe("Link mandado no registro do pedido por e-mail; responder em 24 h, contadas da saída da mensagem");
    expect(descreverEventoManutencao("manutencao.prestador_sem_resposta", {}))
      .toBe("O prestador não respondeu no prazo e não há reserva para passar");
  });
});

// Garagens e veículos (MU-06, MU-11), troca para o prestador reserva (MP-09) e queda do WhatsApp (W-17).
import { describe, expect, it } from "vitest";
import { descreverEvento } from "./eventos.ts";
import { descreverEventoManutencao } from "./manutencao.ts";
import { linkPrestadorSchema, recusarPrestadorSchema } from "./links.ts";
import { buscaUnidadesSchema, mostrarPlaca, normalizarPlaca, vagaSchema, veiculoSchema } from "./moradores.ts";
import { CHAVES_MODELO, conciliarQuedaSchema, editarQuedaSchema, encerrarQuedaSchema, FINALIDADES_ENVIO } from "./whatsapp.ts";

const ID = "6f2c7c1e-2a5b-4c1d-9e3f-0a1b2c3d4e5f";

describe("placa (MU-06)", () => {
  it("guarda em maiúsculas, sem hífen nem espaço", () => {
    expect(normalizarPlaca(" qmf-2a41 ")).toBe("QMF2A41");
    expect(normalizarPlaca("abc 1234")).toBe("ABC1234");
  });
  it("fora dos dois formatos não é placa", () => {
    expect(normalizarPlaca("AB1234")).toBeNull();
    expect(normalizarPlaca("ABCD123")).toBeNull();
    expect(normalizarPlaca(null)).toBeNull();
  });
  it("a antiga aparece com hífen e a Mercosul como é", () => {
    expect(mostrarPlaca("ABC1234")).toBe("ABC-1234");
    expect(mostrarPlaca("QMF2A41")).toBe("QMF2A41");
  });
  it("o veículo leva a placa normalizada e recusa placa errada", () => {
    expect(veiculoSchema.parse({ placa: "qmf-2a41", tipo: "CARRO" })).toMatchObject({ placa: "QMF2A41", modelo: null, vagaId: null });
    expect(veiculoSchema.safeParse({ placa: "XYZ", tipo: "CARRO" }).success).toBe(false);
    expect(veiculoSchema.safeParse({ placa: "ABC1234", tipo: "CAMINHAO" }).success).toBe(false);
    expect(veiculoSchema.safeParse({ placa: "ABC1234", tipo: "MOTO", modelo: "x" }).success).toBe(false);
  });
  it("a vaga pede identificação de 1 a 20 caracteres", () => {
    expect(vagaSchema.parse({ identificacao: " 31 ", onde: " " })).toMatchObject({ identificacao: "31", onde: null, unidadeId: null });
    expect(vagaSchema.safeParse({ identificacao: "" }).success).toBe(false);
    expect(vagaSchema.safeParse({ identificacao: "1".repeat(21) }).success).toBe(false);
  });
  it("a busca pede de 2 a 60 caracteres (MU-11)", () => {
    expect(buscaUnidadesSchema.safeParse({ busca: "a" }).success).toBe(false);
    expect(buscaUnidadesSchema.parse({ busca: " qmf2 " }).busca).toBe("qmf2");
  });
  it("o histórico diz o que aconteceu, sem placa", () => {
    expect(descreverEvento({ acao: "unidade.veiculo_retirado", dados: { motivo: "SAIU" } } as never)).toBe("Veículo retirado: a pessoa saiu da unidade");
    expect(descreverEvento({ acao: "vaga.fora_de_uso", dados: {} } as never)).toBe("Vaga fora de uso");
  });
});

describe("prestador reserva (MP-09)", () => {
  const base = { versao: 1, oQueFazer: "Trocar o rolamento da bomba 2.", valeAte: "2027-03-17" };
  it("o prazo para responder é de 4, 8, 24 ou 48 horas", () => {
    expect(linkPrestadorSchema.parse(base).responderHoras).toBeNull();
    expect(linkPrestadorSchema.parse({ ...base, responderHoras: 24 }).responderHoras).toBe(24);
    expect(linkPrestadorSchema.safeParse({ ...base, responderHoras: 12 }).success).toBe(false);
  });
  it("recusar pode dizer por quê, com 3 a 500 caracteres", () => {
    expect(recusarPrestadorSchema.parse({}).texto).toBeNull();
    expect(recusarPrestadorSchema.parse({ texto: " Equipe em outro serviço " }).texto).toBe("Equipe em outro serviço");
    expect(recusarPrestadorSchema.safeParse({ texto: "x" }).success).toBe(false);
  });
  it("o histórico conta a troca", () => {
    expect(descreverEventoManutencao("manutencao.reserva_assumiu", { motivo: "SEM_RESPOSTA", horas: 4, canal: "WHATSAPP" }))
      .toBe("Passou para a reserva: sem resposta em 4 h; link mandado pelo WhatsApp");
    expect(descreverEventoManutencao("manutencao.reserva_assumiu", { motivo: "RECUSOU", horas: 24 }))
      .toBe("Passou para a reserva: o prestador não pode atender; link a mandar");
    expect(descreverEventoManutencao("manutencao.reserva_programada", { horas: 24 })).toBe("Se não responder em 24 h, passa para a reserva");
  });
  it("o link da reserva sai pelo WhatsApp com modelo próprio", () => {
    expect(CHAVES_MODELO).toContain("link_prestador");
    expect(FINALIDADES_ENVIO.PRESTADOR).toBe("Link do prestador");
  });
});

describe("queda do WhatsApp (W-17)", () => {
  it("o canal alternativo tem de 5 a 300 caracteres", () => {
    expect(editarQuedaSchema.parse({ versao: 1, canalAlternativo: " Portaria: (61) 3333-4444 " }))
      .toEqual({ versao: 1, canalAlternativo: "Portaria: (61) 3333-4444", oQueAconteceu: null });
    expect(editarQuedaSchema.safeParse({ versao: 1, canalAlternativo: "Tel" }).success).toBe(false);
  });
  it("resolvido por outro canal pede por onde", () => {
    expect(conciliarQuedaSchema.safeParse({ envios: [ID], decisao: "OUTRO_CANAL" }).success).toBe(false);
    expect(conciliarQuedaSchema.parse({ envios: [ID, ID], decisao: "MANDAR" }).envios).toEqual([ID]);
    expect(conciliarQuedaSchema.safeParse({ envios: [], decisao: "MANDAR" }).success).toBe(false);
  });
  it("encerrar pede o que foi feito", () => {
    expect(encerrarQuedaSchema.safeParse({ versao: 2, resumo: "curto" }).success).toBe(false);
  });
  it("o histórico conta a queda", () => {
    expect(descreverEvento({ acao: "whatsapp.queda_conciliada", dados: { decisao: "MANDAR", mensagens: 2 } } as never)).toBe("Mandar agora: 2 mensagens");
    expect(descreverEvento({ acao: "whatsapp.queda_encerrada", dados: { minutos: 40 } } as never)).toBe("Queda do WhatsApp encerrada, 40 min fora do ar");
  });
});
